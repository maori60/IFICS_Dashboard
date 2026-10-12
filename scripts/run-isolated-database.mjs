import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import {
  validateEnvironment,
  verifyDatabaseConnection,
} from './guard-test-database.mjs'

const OPERATIONS = Object.freeze({
  unit: ['npx', 'vitest', 'run', 'tests/unit'],
  'integration:expense-tax-review': [
    'npx', 'vitest', 'run',
    'tests/integration/expense-tax-review.test.ts',
  ],
  'integration:report-archive-service': [
    'npx', 'vitest', 'run',
    'tests/integration/report-archive-service.test.ts',
  ],
  lint: ['npm', 'run', 'lint'],
  typecheck: ['npm', 'run', 'typecheck'],
})

const SECRET_PATH = '/run/secrets/ifics-test-password'

function buildTestDatabaseUrl() {
  const password = readFileSync(SECRET_PATH, 'utf8').trim()

  if (password.length < 32) {
    throw new Error('Secret PostgreSQL de test invalide')
  }

  const url = new URL(
    'postgresql://ifics_test_runner@db:5432/ifics_test',
  )

  url.password = password
  url.searchParams.set('schema', 'public')

  return url.toString()
}

function createIsolatedEnvironment(databaseUrl, operation) {
  // Ne jamais transmettre l'environnement complet du processus parent.
  const env = {
    PATH: '/usr/local/bin:/usr/bin:/bin',
    HOME: '/tmp',
    TMPDIR: '/tmp',
    CI: '1',
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    SHADOW_DATABASE_URL: '',
    UPLOAD_DIR: '/tmp/ifics-test-uploads',
    APP_BASE_URL: 'http://localhost.invalid',
    SMTP_HOST: '',
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    SMTP_FROM: 'tests@example.invalid',
  }

  if (operation === 'integration:expense-tax-review') {
    env.EXPENSE_INTEGRATION_TESTS = '1'
  }

  if (operation === 'integration:report-archive-service') {
    env.REPORT_INTEGRATION_TESTS = '1'
  }

  return env
}

async function main() {
  const args = process.argv.slice(2)

  if (
    args.length !== 1 ||
    !Object.hasOwn(OPERATIONS, args[0])
  ) {
    throw new Error('Operation non autorisee')
  }

  const operation = args[0]
  const databaseUrl = buildTestDatabaseUrl()
  const env = createIsolatedEnvironment(databaseUrl, operation)

  const { database } = validateEnvironment(env)

  if (database !== 'ifics_test') {
    throw new Error('Cette operation exige ifics_test')
  }

  await verifyDatabaseConnection(env)

  const [executable, ...commandArgs] = OPERATIONS[operation]

  console.log(`ISOLATED_DATABASE: ${database}`)
  console.log(`OPERATION: ${operation}`)

  if (
    operation === 'lint'
    || operation === 'unit'
    || operation === 'integration:expense-tax-review'
    || operation === 'integration:report-archive-service'
  ) {
    console.log('NUXT_PREPARE_START')

    const preparation = spawnSync(
      process.execPath,
      ['node_modules/nuxt/bin/nuxt.mjs', 'prepare'],
      {
        env,
        stdio: 'inherit',
        cwd: '/app',
      },
    )

    if (preparation.error || preparation.status !== 0) {
      throw new Error('Preparation Nuxt echouee')
    }

    console.log('NUXT_PREPARE_OK')
  }

  const result = spawnSync(executable, commandArgs, {
    env,
    stdio: 'inherit',
  })

  if (result.error) {
    throw new Error('Echec du lancement de la commande isolee')
  }

  process.exitCode = result.status ?? 1
}

main().catch(() => {
  console.error('ISOLATED_COMMAND_REFUSED')
  process.exitCode = 1
})
