export function officialReportArchiveEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.IFICS_REPORT_OFFICIAL_ARCHIVE !== 'enabled') {
    return false
  }

  const databaseUrl = env.DATABASE_URL

  if (!databaseUrl) {
    return false
  }

  try {
    const url = new URL(databaseUrl)

    if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
      return false
    }

    if (url.pathname === '/ifics_test') {
      return env.REPORT_INTEGRATION_TESTS === '1'
        && env.NODE_ENV === 'test'
    }

    return url.pathname === '/ifics'
      && env.IFICS_REPORT_ARCHIVE_SCHEMA_READY === 'confirmed'
  }
  catch {
    return false
  }
}
