import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const PASSWORD_COST = 16_384
const PASSWORD_BLOCK_SIZE = 8
const PASSWORD_PARALLELIZATION = 1
const PASSWORD_KEY_LENGTH = 64

export type EncryptedValue = {
  ciphertext: string
  iv: string
  tag: string
}

function equalBuffers(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right)
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function hashToken(token: string): string {
  return sha256(token)
}

export function validatePasswordPolicy(password: string, minLength = 12): void {
  if (password.length < minLength || password.length > 128) {
    throw new Error(`Le mot de passe doit contenir entre ${minLength} et 128 caractères.`)
  }

  const categories = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  if (categories < 3) {
    throw new Error('Le mot de passe doit utiliser au moins trois catégories : minuscules, majuscules, chiffres, caractères spéciaux.')
  }
}

export async function hashPassword(password: string): Promise<string> {
  validatePasswordPolicy(password)

  const salt = randomBytes(16)
  const derivedKey = await scrypt(password, salt, PASSWORD_KEY_LENGTH, {
    cost: PASSWORD_COST,
    blockSize: PASSWORD_BLOCK_SIZE,
    parallelization: PASSWORD_PARALLELIZATION,
    maxmem: 64 * 1024 * 1024,
  }) as Buffer

  return [
    'scrypt',
    PASSWORD_COST,
    PASSWORD_BLOCK_SIZE,
    PASSWORD_PARALLELIZATION,
    salt.toString('base64'),
    derivedKey.toString('base64'),
  ].join('$')
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, costRaw, blockSizeRaw, parallelizationRaw, saltRaw, hashRaw] = encoded.split('$')

  if (algorithm !== 'scrypt' || !costRaw || !blockSizeRaw || !parallelizationRaw || !saltRaw || !hashRaw) {
    return false
  }

  const cost = Number(costRaw)
  const blockSize = Number(blockSizeRaw)
  const parallelization = Number(parallelizationRaw)

  if (!Number.isInteger(cost) || !Number.isInteger(blockSize) || !Number.isInteger(parallelization)) {
    return false
  }

  try {
    const salt = Buffer.from(saltRaw, 'base64')
    const expected = Buffer.from(hashRaw, 'base64')
    const actual = await scrypt(password, salt, expected.length, {
      cost,
      blockSize,
      parallelization,
      maxmem: 64 * 1024 * 1024,
    }) as Buffer

    return equalBuffers(actual, expected)
  }
  catch {
    return false
  }
}

function encryptionKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY

  if (!raw) {
    throw new Error('APP_ENCRYPTION_KEY is required for encrypted secrets.')
  }

  const key = Buffer.from(raw, 'base64')

  if (key.length !== 32) {
    throw new Error('APP_ENCRYPTION_KEY must be exactly 32 random bytes encoded as base64.')
  }

  return key
}

export function encryptSecret(plaintext: string): EncryptedValue {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  }
}

export function decryptSecret(value: EncryptedValue): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(value.iv, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

function base32Decode(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/=+$/g, '').replace(/\s/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character)

    if (index === -1) {
      throw new Error('Invalid base32 secret.')
    }

    value = (value << 5) | index
    bits += 5

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

function generateTotpCode(secret: string, timestampMs = Date.now()): string {
  const counter = Math.floor(timestampMs / 30_000)
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))

  const digest = createHmac('sha1', base32Decode(secret))
    .update(counterBuffer)
    .digest()
  const offset = digest[digest.length - 1]! & 0x0f
  const binary = (
    ((digest[offset]! & 0x7f) << 24)
    | ((digest[offset + 1]! & 0xff) << 16)
    | ((digest[offset + 2]! & 0xff) << 8)
    | (digest[offset + 3]! & 0xff)
  )

  return String(binary % 1_000_000).padStart(6, '0')
}

export function verifyTotp(secret: string, candidate: string, now = Date.now()): boolean {
  if (!/^\d{6}$/.test(candidate)) {
    return false
  }

  for (const window of [-1, 0, 1]) {
    const expected = generateTotpCode(secret, now + window * 30_000)
    const left = Buffer.from(expected)
    const right = Buffer.from(candidate)

    if (equalBuffers(left, right)) {
      return true
    }
  }

  return false
}

export function buildTotpUri(email: string, secret: string): string {
  const issuer = process.env.MFA_ISSUER?.trim() || 'IFICS Dashboard'
  const label = encodeURIComponent(`${issuer}:${email}`)
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })

  return `otpauth://totp/${label}?${query.toString()}`
}

function securityPepper(): string {
  const pepper = process.env.IP_HASH_PEPPER

  if (!pepper) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('IP_HASH_PEPPER is required in production.')
    }

    return 'ifics-development-only-pepper'
  }

  return pepper
}

export function hashIp(ip: string | undefined | null): string | null {
  if (!ip) {
    return null
  }

  return createHmac('sha256', securityPepper()).update(ip).digest('hex')
}

export function hashRecoveryCode(code: string): string {
  return createHmac('sha256', securityPepper())
    .update(code.replace(/\s/g, '').toUpperCase())
    .digest('hex')
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(8).toString('hex').toUpperCase()
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`
  })
}

export function validateProductionSecrets(): void {
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  encryptionKey()

  if (!process.env.IP_HASH_PEPPER || process.env.IP_HASH_PEPPER.startsWith('CHANGE_ME')) {
    throw new Error('IP_HASH_PEPPER must be configured with a unique random value.')
  }
}
