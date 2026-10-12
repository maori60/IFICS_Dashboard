import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { describe, expect, it } from 'vitest'

describe.skipIf(process.env.REPORT_INTEGRATION_TESTS !== '1')(
  'Archives officielles : intégrité PostgreSQL',
  () => {
    it('refuse les références incohérentes et les doublons', async () => {
      const url = new URL(process.env.DATABASE_URL || '')

      if (url.hostname !== 'db' || url.pathname !== '/ifics_test') {
        throw new Error('Tests interdits hors de ifics_test')
      }

      const client = new pg.Client({
        connectionString: url.toString(),
      })

      await client.connect()

      let transactionOpen = false

      try {
        await client.query('BEGIN')
        transactionOpen = true

        const suffix = randomUUID()
        const associationId = `archive-test-${suffix}`
        const projectA = `archive-project-a-${suffix}`
        const projectB = `archive-project-b-${suffix}`
        const reportA = `archive-report-a-${suffix}`
        const reportB = `archive-report-b-${suffix}`
        const versionA = `archive-version-a-${suffix}`
        const versionB = `archive-version-b-${suffix}`

        await client.query(
          `INSERT INTO "Association" ("id", "name", "updatedAt")
           VALUES ($1, $2, NOW())`,
          [associationId, 'Association test archives'],
        )

        for (const [id, title] of [
          [projectA, 'Projet A'],
          [projectB, 'Projet B'],
        ]) {
          await client.query(
            `INSERT INTO "Project"
             ("id", "associationId", "title", "updatedAt")
             VALUES ($1, $2, $3, NOW())`,
            [id, associationId, title],
          )
        }

        for (const [id, projectId] of [
          [reportA, projectA],
          [reportB, projectB],
        ]) {
          await client.query(
            `INSERT INTO "ProjectReport"
             ("id", "projectId", "sessionDate", "currentVersion", "updatedAt")
             VALUES ($1, $2, NOW(), 1, NOW())`,
            [id, projectId],
          )
        }

        for (const [id, reportId] of [
          [versionA, reportA],
          [versionB, reportB],
        ]) {
          await client.query(
            `INSERT INTO "ProjectReportVersion"
             ("id", "reportId", "version", "content")
             VALUES ($1, $2, 1, $3)`,
            [id, reportId, 'Contenu de test'],
          )
        }

        async function insertArchive(
          id: string,
          reportId: string,
          reportVersionId: string,
          version: number,
          reference: string,
        ) {
          return client.query(
            `INSERT INTO "ProjectReportArchive" (
              "id", "reportId", "reportVersionId", "version",
              "reference", "associationName", "projectTitle",
              "reportTitle", "sessionDate", "content",
              "validatedAt", "originalName", "storedName",
              "filePath", "fileSize", "sha256"
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8,
              NOW(), $9, NOW(), $10, $11, $12, $13, $14
            )`,
            [
              id, reportId, reportVersionId, version,
              reference, 'Association test', 'Projet test',
              'Bilan test', 'Contenu test',
              'archive.pdf', 'archive-test.pdf',
              'reports/test/archive.pdf', '100',
              'a'.repeat(64),
            ],
          )
        }

        async function expectSqlError(
          name: string,
          expectedCode: string,
          operation: () => Promise<unknown>,
        ) {
          const savepoint = `sp_${name}`

          await client.query(`SAVEPOINT ${savepoint}`)

          try {
            await expect(operation()).rejects.toMatchObject({
              code: expectedCode,
            })
          } finally {
            await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
            await client.query(`RELEASE SAVEPOINT ${savepoint}`)
          }
        }

        await expectSqlError('missing', '23503', () =>
          insertArchive(
            `archive-missing-${suffix}`,
            reportA,
            `missing-${suffix}`,
            1,
            `REF-MISSING-${suffix}`,
          ),
        )

        await expectSqlError('wrongreport', '23503', () =>
          insertArchive(
            `archive-wrongreport-${suffix}`,
            reportA,
            versionB,
            1,
            `REF-WRONG-${suffix}`,
          ),
        )

        await expectSqlError('wrongversion', '23503', () =>
          insertArchive(
            `archive-wrongversion-${suffix}`,
            reportA,
            versionA,
            2,
            `REF-VERSION-${suffix}`,
          ),
        )

        await insertArchive(
          `archive-valid-${suffix}`,
          reportA,
          versionA,
          1,
          `REF-VALID-${suffix}`,
        )

        await expectSqlError('duplicate', '23505', () =>
          insertArchive(
            `archive-duplicate-${suffix}`,
            reportA,
            versionA,
            1,
            `REF-DUPLICATE-${suffix}`,
          ),
        )

        await expectSqlError('reference', '23505', () =>
          insertArchive(
            `archive-reference-${suffix}`,
            reportB,
            versionB,
            1,
            `REF-VALID-${suffix}`,
          ),
        )

        const result = await client.query(
          `SELECT count(*)::int AS total
           FROM "ProjectReportArchive"
           WHERE "reportId" IN ($1, $2)`,
          [reportA, reportB],
        )

        expect(result.rows[0]?.total).toBe(1)
      } finally {
        if (transactionOpen) {
          await client.query('ROLLBACK')
        }

        await client.end()
      }
    })
  },
)
