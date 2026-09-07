import { describe, expect, it } from 'vitest'
import { requireEnv } from '../../server/utils/env'

describe('requireEnv', () => {
  it('returns a trimmed configured value', () => {
    expect(requireEnv('DATABASE_URL', { DATABASE_URL: '  postgresql://db/test  ' }))
      .toBe('postgresql://db/test')
  })

  it('throws when the variable is absent', () => {
    expect(() => requireEnv('DATABASE_URL', {}))
      .toThrow('DATABASE_URL is missing')
  })

  it('throws when the variable only contains whitespace', () => {
    expect(() => requireEnv('DATABASE_URL', { DATABASE_URL: '   ' }))
      .toThrow('DATABASE_URL is missing')
  })
})
