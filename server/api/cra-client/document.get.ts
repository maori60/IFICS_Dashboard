import { createHash } from 'node:crypto'
import {
  getQuery,
  setResponseHeader,
} from 'h3'
import { httpError } from '../../utils/api'
import {
  requireActiveCraClientAccess,
  setCraClientNoStoreHeaders,
} from '../../utils/cra-client-access'
import {
  contentDispositionFilename,
  readStoredFile,
} from '../../utils/files'
import { prisma } from '../../utils/prisma'

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
])

export default defineEventHandler(async (event) => {
  setCraClientNoStoreHeaders(event)

  /*
   * Exception volontaire au middleware global :
   * ce document doit pouvoir être affiché dans
   * l'iframe du portail CRA client, mais uniquement
   * depuis la même origine.
   */
  setResponseHeader(
    event,
    'X-Frame-Options',
    'SAMEORIGIN',
  )

  setResponseHeader(
    event,
    'Content-Security-Policy',
    "frame-ancestors 'self'",
  )

  const access
    = await requireActiveCraClientAccess(
      event,
    )

  const document
    = access.document

  if (
    !ALLOWED_MIME_TYPES.has(
      document.mimeType,
    )
  ) {
    httpError(
      409,
      'Le type du document CRA n’est pas autorisé.',
      'CRA_CLIENT_DOCUMENT_INVALID_TYPE',
    )
  }

  if (!document.sha256) {
    httpError(
      409,
      'L’intégrité du document CRA ne peut pas être confirmée.',
      'CRA_CLIENT_DOCUMENT_HASH_MISSING',
    )
  }

  const buffer
    = await readStoredFile(
      document.filePath,
    )

  if (
    BigInt(buffer.length)
    !== document.fileSize
  ) {
    httpError(
      409,
      'L’intégrité du document CRA ne peut pas être confirmée.',
      'CRA_CLIENT_DOCUMENT_SIZE_MISMATCH',
    )
  }

  const sha256
    = createHash('sha256')
      .update(buffer)
      .digest('hex')

  if (sha256 !== document.sha256) {
    httpError(
      409,
      'L’intégrité du document CRA ne peut pas être confirmée.',
      'CRA_CLIENT_DOCUMENT_HASH_MISMATCH',
    )
  }

  const query = getQuery(event)

  const download
    = query.download === '1'

  if (download) {
    await prisma.craClientAccess
      .updateMany({
        where: {
          id:
            access.id,

          status:
            'ACTIVE',

          downloadedAt:
            null,
        },

        data: {
          downloadedAt:
            new Date(),
        },
      })
  }

  setResponseHeader(
    event,
    'Content-Type',
    document.mimeType,
  )

  setResponseHeader(
    event,
    'Content-Length',
    buffer.length,
  )

  setResponseHeader(
    event,
    'Content-Disposition',
    [
      download
        ? 'attachment'
        : 'inline',

      `filename*=UTF-8''${contentDispositionFilename(
        document.originalName,
      )}`,
    ].join('; '),
  )

  setResponseHeader(
    event,
    'X-Content-Type-Options',
    'nosniff',
  )

  setResponseHeader(
    event,
    'Referrer-Policy',
    'no-referrer',
  )

  return buffer
})
