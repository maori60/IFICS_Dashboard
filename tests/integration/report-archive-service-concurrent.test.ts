import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { H3Event } from 'h3'
import { describe, expect, it } from 'vitest'
import type { AuthContext } from '../../server/utils/auth'
import { readStoredFile } from '../../server/utils/files'
import { prisma } from '../../server/utils/prisma'
import { validateAndArchiveOfficialReport } from '../../server/utils/report-archive-service'

function assertIsolatedDatabase() {
  const url = new URL(process.env.DATABASE_URL || '')

  if (url.hostname !== 'db' || url.pathname !== '/ifics_test') {
    throw new Error('Tests interdits hors de ifics_test')
  }
}

describe.skipIf(process.env.REPORT_INTEGRATION_TESTS !== '1')(
  'Concurrence réelle des archives officielles',
  () => {
    it('conserve un seul PDF pour deux validations simultanées', async () => {
      assertIsolatedDatabase()

      const originalUploadDir = process.env.UPLOAD_DIR
      const directory = await mkdtemp(
        join(tmpdir(), 'ifics-report-concurrent-'),
      )

      const associationId = `archive-service-concurrent-${randomUUID()}`

      process.env.UPLOAD_DIR = directory

      try {
        const association = await prisma.association.create({
          data: {
            id: associationId,
            name: 'IFICS TEST CONCURRENCE REELLE',
          },
        })

        const project = await prisma.project.create({
          data: {
            associationId: association.id,
            title: 'Projet concurrence réelle',
          },
        })

        const report = await prisma.projectReport.create({
          data: {
            projectId: project.id,
            title: 'Bilan concurrent',
            sessionDate: new Date('2026-10-09T12:00:00.000Z'),
            status: 'SUBMITTED',
            currentVersion: 1,
            versions: {
              create: {
                version: 1,
                content: 'Contenu pédagogique concurrent.',
              },
            },
          },
        })

        const role = await prisma.role.create({
          data: {
            associationId,
            name: 'Rôle test concurrence réelle',
            code: 'TEST-CONCURRENT',
          },
        })

        const user = await prisma.user.create({
          data: {
            associationId,
            roleId: role.id,
            firstName: 'Test',
            lastName: 'Concurrence',
            email: `concurrent-real-${randomUUID()}@example.invalid`,
            passwordHash: 'test-only-not-a-real-password',
          },
        })

        const context = {
          sessionId: 'session-concurrent-real',
          userId: user.id,
          associationId,
          clientId: null,
          intervenorId: null,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roleCode: 'ADMIN',
          roleName: 'Administration',
          permissions: [],
          mfaEnabled: false,
          mfaVerified: true,
          mfaSetupRequired: false,
        } satisfies AuthContext

        const event = {
          context: {
            requestId: 'archive-concurrent-real-test',
          },
          node: {
            req: {
              headers: {},
              socket: {},
            },
          },
        } as unknown as H3Event

        const attempt = () =>
          validateAndArchiveOfficialReport({
            event,
            context,
            reportId: report.id,
          })

        const results = await Promise.allSettled([
          attempt(),
          attempt(),
        ])

        const successes = results.filter(
          result => result.status === 'fulfilled',
        )

        const failures = results.filter(
          result => result.status === 'rejected',
        )

        expect(successes).toHaveLength(1)
        expect(failures).toHaveLength(1)

        expect(failures[0]).toMatchObject({
          status: 'rejected',
          reason: {
            statusCode: 409,
            data: {
              code: 'REPORT_ARCHIVE_CONFLICT',
            },
          },
        })

        const archive = await prisma.projectReportArchive.findFirstOrThrow({
          where: { reportId: report.id },
        })

        expect(
          await prisma.projectReportArchive.count({
            where: { reportId: report.id },
          }),
        ).toBe(1)

        expect(
          await prisma.auditLog.count({
            where: {
              associationId,
              action: 'REPORT_OFFICIAL_ARCHIVED',
            },
          }),
        ).toBe(1)

        const reportDirectory = join(
          directory,
          'reports',
          report.id,
        )

        const files = await readdir(reportDirectory)

        expect(files).toHaveLength(1)
        expect(files[0]).toBe(archive.storedName)

        const pdf = await readStoredFile(archive.filePath)

        expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
        expect(BigInt(pdf.length)).toBe(archive.fileSize)

        expect(
          createHash('sha256').update(pdf).digest('hex'),
        ).toBe(archive.sha256)

        const finalReport = await prisma.projectReport.findUniqueOrThrow({
          where: { id: report.id },
        })

        expect(finalReport.status).toBe('VALIDATED')
        expect(finalReport.pdfPath).toBe(archive.filePath)
      }
      finally {
        try {
          await prisma.auditLog.deleteMany({
            where: { associationId },
          })

          await prisma.projectReportArchive.deleteMany({
            where: {
              report: {
                project: { associationId },
              },
            },
          })

          await prisma.projectReportVersion.deleteMany({
            where: {
              report: {
                project: { associationId },
              },
            },
          })

          await prisma.projectReport.deleteMany({
            where: {
              project: { associationId },
            },
          })

          await prisma.project.deleteMany({
            where: { associationId },
          })

          await prisma.user.deleteMany({
            where: { associationId },
          })

          await prisma.role.deleteMany({
            where: { associationId },
          })

          await prisma.association.deleteMany({
            where: { id: associationId },
          })
        }
        finally {
          if (originalUploadDir === undefined) {
            delete process.env.UPLOAD_DIR
          }
          else {
            process.env.UPLOAD_DIR = originalUploadDir
          }

          await rm(directory, {
            recursive: true,
            force: true,
          })
        }
      }
    })
  },
)
