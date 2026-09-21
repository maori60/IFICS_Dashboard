import { createConnection } from 'node:net'

const CLAMAV_COMMAND = Buffer.from('zINSTREAM\0')
const STREAM_END = Buffer.alloc(4)
const STREAM_CHUNK_BYTES = 64 * 1024
const MAX_RESPONSE_BYTES = 8 * 1024

export type ClamAvScanResult =
  | {
      status: 'CLEAN'
      rawResult: string
    }
  | {
      status: 'INFECTED'
      signature: string
      rawResult: string
    }

export type ClamAvErrorCode =
  | 'CLAMAV_UNAVAILABLE'
  | 'CLAMAV_SCAN_ERROR'

export class ClamAvError extends Error {
  constructor(
    public readonly code: ClamAvErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ClamAvError'
  }
}

function configuredPort(): number {
  const value = Number(process.env.CLAMAV_PORT || 3310)

  if (
    !Number.isSafeInteger(value)
    || value < 1
    || value > 65535
  ) {
    return 3310
  }

  return value
}

function configuredTimeoutMs(): number {
  const value = Number(
    process.env.CLAMAV_TIMEOUT_MS || 15_000,
  )

  if (
    !Number.isSafeInteger(value)
    || value < 1000
    || value > 60_000
  ) {
    return 15_000
  }

  return value
}

export function clamAvConfig() {
  return {
    host:
      process.env.CLAMAV_HOST?.trim()
      || 'clamav',

    port: configuredPort(),
    timeoutMs: configuredTimeoutMs(),
  }
}

export function parseClamAvResponse(
  value: string,
): ClamAvScanResult {
  const normalized = value
    .replaceAll('\0', '')
    .trim()

  if (normalized === 'stream: OK') {
    return {
      status: 'CLEAN',
      rawResult: normalized,
    }
  }

  const infected = normalized.match(
    /^stream:\s+(.+?)\s+FOUND$/,
  )

  if (infected?.[1]) {
    return {
      status: 'INFECTED',
      signature: infected[1],
      rawResult: normalized,
    }
  }

  if (
    !normalized
    || normalized.includes('ERROR')
  ) {
    throw new ClamAvError(
      'CLAMAV_SCAN_ERROR',
      normalized
        ? `ClamAV a retourné une erreur : ${normalized}`
        : 'ClamAV a retourné une réponse vide.',
    )
  }

  throw new ClamAvError(
    'CLAMAV_SCAN_ERROR',
    `Réponse ClamAV inattendue : ${normalized}`,
  )
}

export async function scanBufferWithClamAv(
  buffer: Buffer,
): Promise<ClamAvScanResult> {
  const {
    host,
    port,
    timeoutMs,
  } = clamAvConfig()

  return new Promise((resolve, reject) => {
    const socket = createConnection({
      host,
      port,
    })

    let settled = false
    let response = Buffer.alloc(0)

    function finish(
      callback: () => void,
    ) {
      if (settled) return

      settled = true
      socket.destroy()
      callback()
    }

    function unavailable(
      message: string,
    ) {
      finish(() => {
        reject(
          new ClamAvError(
            'CLAMAV_UNAVAILABLE',
            message,
          ),
        )
      })
    }

    function parseResponse() {
      finish(() => {
        try {
          resolve(
            parseClamAvResponse(
              response.toString('utf8'),
            ),
          )
        }
        catch (error) {
          reject(error)
        }
      })
    }

    socket.setTimeout(timeoutMs)

    socket.on('connect', () => {
      socket.write(CLAMAV_COMMAND)

      for (
        let offset = 0;
        offset < buffer.length;
        offset += STREAM_CHUNK_BYTES
      ) {
        const chunk = buffer.subarray(
          offset,
          Math.min(
            offset + STREAM_CHUNK_BYTES,
            buffer.length,
          ),
        )

        const frame = Buffer.allocUnsafe(
          4 + chunk.length,
        )

        frame.writeUInt32BE(
          chunk.length,
          0,
        )

        chunk.copy(frame, 4)

        socket.write(frame)
      }

      socket.write(STREAM_END)
    })

    socket.on('data', (data) => {
      response = Buffer.concat([
        response,
        data,
      ])

      if (
        response.length
        > MAX_RESPONSE_BYTES
      ) {
        finish(() => {
          reject(
            new ClamAvError(
              'CLAMAV_SCAN_ERROR',
              'La réponse ClamAV est anormalement volumineuse.',
            ),
          )
        })

        return
      }

      if (response.includes(0)) {
        parseResponse()
      }
    })

    socket.on('end', () => {
      if (settled) return

      if (response.length > 0) {
        parseResponse()
        return
      }

      unavailable(
        'ClamAV a fermé la connexion sans réponse.',
      )
    })

    socket.on('timeout', () => {
      unavailable(
        `ClamAV n’a pas répondu dans le délai de ${timeoutMs} ms.`,
      )
    })

    socket.on('error', (error) => {
      unavailable(
        `Connexion à ClamAV impossible : ${error.message}`,
      )
    })
  })
}
