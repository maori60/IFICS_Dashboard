import { beforeAll, describe, expect, it } from 'vitest'
import {
  decryptSecret,
  encryptSecret,
  generateTotpCode,
  generateTotpSecret,
  hashPassword,
  hashToken,
  validatePasswordPolicy,
  verifyPassword,
  verifyTotp,
} from '../../server/utils/security'

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
})

describe('security primitives', () => {
  it('enforces the password policy', () => {
    expect(() => validatePasswordPolicy('short')).toThrow()
    expect(() => validatePasswordPolicy('LongPasswordOnlyLetters')).toThrow()
    expect(() => validatePasswordPolicy('Correct-Password-2026!')).not.toThrow()
  })

  it('hashes passwords and rejects a different password', async () => {
    const encoded = await hashPassword('Correct-Password-2026!')
    expect(encoded.startsWith('scrypt$')).toBe(true)
    expect(await verifyPassword('Correct-Password-2026!', encoded)).toBe(true)
    expect(await verifyPassword('Wrong-Password-2026!', encoded)).toBe(false)
    expect(await verifyPassword('anything', 'invalid-hash')).toBe(false)
  })

  it('encrypts secrets with authenticated encryption', () => {
    const encrypted = encryptSecret('totp-secret-value')
    expect(encrypted.ciphertext).not.toContain('totp-secret-value')
    expect(decryptSecret(encrypted)).toBe('totp-secret-value')

    expect(() => decryptSecret({ ...encrypted, tag: Buffer.alloc(16, 1).toString('base64') })).toThrow()
  })

  it('generates and validates TOTP codes inside the accepted window', () => {
    const secret = generateTotpSecret()
    const now = 1_800_000_000_000
    const code = generateTotpCode(secret, now)

    expect(code).toMatch(/^\d{6}$/)
    expect(verifyTotp(secret, code, now)).toBe(true)
    expect(verifyTotp(secret, code, now + 31_000)).toBe(true)
    expect(verifyTotp(secret, 'abcdef', now)).toBe(false)
  })

  it('hashes opaque tokens deterministically without exposing the raw token', () => {
    const token = 'example-one-time-token'
    const digest = hashToken(token)
    expect(digest).toHaveLength(64)
    expect(digest).not.toContain(token)
    expect(hashToken(token)).toBe(digest)
  })
})
