import { pathToFileURL } from 'node:url'

export const ALLOWED_DATABASES = Object.freeze([
  'ifics_test',
  'ifics_migration_audit',
])

const ALLOWED_PARAMETERS = new Set(['schema'])

export function validateDatabaseUrl(value, label = 'DATABASE_URL') {
  let url

  try {
    url = new URL(value || '')
  } catch {
    throw new Error(`${label}: URL invalide`)
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(`${label}: protocole PostgreSQL obligatoire`)
  }

  if (url.hostname !== 'db') {
    throw new Error(`${label}: serveur non autorise`)
  }

  if (url.port && url.port !== '5432') {
    throw new Error(`${label}: port non autorise`)
  }

  if (!url.username || !url.password) {
    throw new Error(`${label}: identifiants manquants`)
  }

  if (url.username !== 'ifics_test_runner') {
    throw new Error(`${label}: utilisateur PostgreSQL non autorise`)
  }

  if (url.hash) {
    throw new Error(`${label}: fragment interdit`)
  }

  const rawDatabase = url.pathname.slice(1)

  if (!ALLOWED_DATABASES.includes(rawDatabase)) {
    throw new Error(`${label}: base non autorisee`)
  }

  const seen = new Set()

  for (const [key, parameterValue] of url.searchParams) {
    if (!ALLOWED_PARAMETERS.has(key)) {
      throw new Error(`${label}: parametre interdit: ${key}`)
    }

    if (seen.has(key)) {
      throw new Error(`${label}: parametre duplique: ${key}`)
    }

    seen.add(key)

    if (key === 'schema' && parameterValue !== 'public') {
      throw new Error(`${label}: schema non autorise`)
    }
  }

  return { url, database: rawDatabase }
}

export function validateEnvironment(env = process.env) {
  const primary = validateDatabaseUrl(env.DATABASE_URL)

  if (env.SHADOW_DATABASE_URL) {
    const shadow = validateDatabaseUrl(
      env.SHADOW_DATABASE_URL,
      'SHADOW_DATABASE_URL',
    )

    if (shadow.database === primary.database) {
      throw new Error('La base shadow doit etre distincte')
    }
  }

  return primary
}

export async function verifyDatabaseConnection(env = process.env) {
  const { url, database } = validateEnvironment(env)

  const { default: pg } = await import('pg')

  const client = new pg.Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 5000,
  })

  try {
    await client.connect()
    await client.query('BEGIN READ ONLY')

    const result = await client.query(`
      SELECT
        current_database() AS database_name,
        (SELECT system_identifier::text FROM pg_control_system()) AS system_identifier,
        current_schema() AS schema_name,
        inet_server_port() AS server_port,
        session_user AS session_role,
        current_user AS effective_role,
        r.rolsuper AS is_superuser,
        r.rolcreatedb AS can_create_database,
        r.rolcreaterole AS can_create_role,
        r.rolreplication AS can_replicate,
        r.rolbypassrls AS can_bypass_rls
      FROM pg_roles r
      WHERE r.rolname = session_user
    `)

    const actual = result.rows[0]

    if (actual?.database_name !== database) {
      throw new Error('Base connectee inattendue')
    }

    if (actual?.system_identifier !== '7686974272440598561') {
      throw new Error('Instance PostgreSQL non autorisee')
    }

    if (actual?.schema_name !== 'public') {
      throw new Error('Schema connecte inattendu')
    }

    if (actual?.server_port !== 5432) {
      throw new Error('Port PostgreSQL inattendu')
    }

    if (
      actual?.session_role !== 'ifics_test_runner' ||
      actual?.effective_role !== 'ifics_test_runner'
    ) {
      throw new Error('Role PostgreSQL inattendu')
    }

    if (
      actual.is_superuser !== false ||
      actual.can_create_database !== false ||
      actual.can_create_role !== false ||
      actual.can_replicate !== false ||
      actual.can_bypass_rls !== false
    ) {
      throw new Error('Privileges PostgreSQL non autorises')
    }

    await client.query('ROLLBACK')

    return database
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // Connexion potentiellement interrompue.
    }

    throw error
  } finally {
    await client.end()
  }
}

async function main() {
  const database = await verifyDatabaseConnection()

  if (process.argv.includes('--destructive')) {
    if (
      process.env.IFICS_TEST_DB_RESET_CONFIRM !==
      `RESET:${database}`
    ) {
      throw new Error('Confirmation de reinitialisation absente')
    }
  }

  console.log(`DATABASE_GUARD_OK: ${database}`)
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(`DATABASE_GUARD_REFUSED: ${error.message}`)
    process.exitCode = 1
  })
}
