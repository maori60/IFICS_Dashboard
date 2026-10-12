import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  verifyDatabaseConnection,
} from '../../scripts/guard-test-database.mjs'

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
  clientConstructor: vi.fn(),
}))

vi.mock('pg', () => ({
  default: {
    Client: class {
      constructor(options: unknown) {
        mocks.clientConstructor(options)
      }

      connect = mocks.connect
      query = mocks.query
      end = mocks.end
    },
  },
}))

const databaseUrl =
  'postgresql://ifics_test_runner:password@db:5432/ifics_test'

const env = {
  DATABASE_URL: databaseUrl,
  SHADOW_DATABASE_URL: '',
}

const validRow = {
  database_name: 'ifics_test',
  system_identifier: '7686974272440598561',
  schema_name: 'public',
  server_port: 5432,
  session_role: 'ifics_test_runner',
  effective_role: 'ifics_test_runner',
  is_superuser: false,
  can_create_database: false,
  can_create_role: false,
  can_replicate: false,
  can_bypass_rls: false,
}

function simulateRow(
  overrides: Record<string, unknown> = {},
) {
  const row = { ...validRow, ...overrides }

  mocks.query.mockImplementation(async (sql: string) => {
    if (sql === 'BEGIN READ ONLY' || sql === 'ROLLBACK') {
      return { rows: [] }
    }

    if (sql.includes('current_database()')) {
      return { rows: [row] }
    }

    throw new Error('Requete SQL inattendue')
  })
}

describe('PostgreSQL physical identity guard', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    mocks.connect.mockResolvedValue(undefined)
    mocks.end.mockResolvedValue(undefined)

    simulateRow()
  })

  it('accepts the authorized physical instance', async () => {
    await expect(
      verifyDatabaseConnection(env),
    ).resolves.toBe('ifics_test')

    expect(mocks.connect).toHaveBeenCalledOnce()
    expect(mocks.end).toHaveBeenCalledOnce()

    const sql = mocks.query.mock.calls.map(
      ([statement]) => String(statement),
    )

    expect(sql[0]).toBe('BEGIN READ ONLY')
    expect(sql[1]).toContain('pg_control_system()')
    expect(sql.at(-1)).toBe('ROLLBACK')
  })

  it('rejects another physical instance', async () => {
    simulateRow({
      system_identifier: '9999999999999999999',
    })

    await expect(
      verifyDatabaseConnection(env),
    ).rejects.toThrow('Instance PostgreSQL non autorisee')

    expect(mocks.end).toHaveBeenCalledOnce()
  })

  it('rejects a missing physical identifier', async () => {
    simulateRow({
      system_identifier: null,
    })

    await expect(
      verifyDatabaseConnection(env),
    ).rejects.toThrow('Instance PostgreSQL non autorisee')
  })

  it('rejects another database', async () => {
    simulateRow({
      database_name: 'ifics',
    })

    await expect(
      verifyDatabaseConnection(env),
    ).rejects.toThrow('Base connectee inattendue')
  })

  it('rejects another PostgreSQL role', async () => {
    simulateRow({
      effective_role: 'ifics_app',
    })

    await expect(
      verifyDatabaseConnection(env),
    ).rejects.toThrow('Role PostgreSQL inattendu')
  })

  it.each([
    'is_superuser',
    'can_create_database',
    'can_create_role',
    'can_replicate',
    'can_bypass_rls',
  ])('rejects excessive privilege: %s', async (field) => {
    simulateRow({
      [field]: true,
    })

    await expect(
      verifyDatabaseConnection(env),
    ).rejects.toThrow('Privileges PostgreSQL non autorises')
  })

  it('rejects a SQL permission error', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN READ ONLY' || sql === 'ROLLBACK') {
        return { rows: [] }
      }

      throw new Error('permission denied for pg_control_system')
    })

    await expect(
      verifyDatabaseConnection(env),
    ).rejects.toThrow('permission denied')

    expect(mocks.end).toHaveBeenCalledOnce()
  })

  it('rejects a failed connection', async () => {
    mocks.connect.mockRejectedValue(
      new Error('connection refused'),
    )

    await expect(
      verifyDatabaseConnection(env),
    ).rejects.toThrow('connection refused')

    expect(mocks.end).toHaveBeenCalledOnce()
  })

  it('rolls back after an identity failure', async () => {
    simulateRow({
      system_identifier: '1',
    })

    await expect(
      verifyDatabaseConnection(env),
    ).rejects.toThrow('Instance PostgreSQL non autorisee')

    const statements = mocks.query.mock.calls.map(
      ([sql]) => String(sql),
    )

    expect(statements).toContain('BEGIN READ ONLY')
    expect(statements).toContain('ROLLBACK')
    expect(mocks.end).toHaveBeenCalledOnce()
  })
})
