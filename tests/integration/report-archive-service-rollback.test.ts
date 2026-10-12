import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { H3Event } from 'h3'
import { describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '../../server/utils/auth'
import { readStoredFile } from '../../server/utils/files'
import { prisma } from '../../server/utils/prisma'
import { validateAndArchiveOfficialReport } from '../../server/utils/report-archive-service'

const fixedReference = 'IFICS-BILAN-2026-ROLLBACK-TEST'

vi.mock('../../server/utils/report-archive-reference', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('../../server/utils/report-archive-reference')
  >()

  return {
    ...original,
    generateReportArchiveReference: () => fixedReference,
  }
})

function assertIsolatedDatabase() {
  const url = new URL(process.env.DATABASE_URL || '')

  if (url.hostname !== 'db' || url.pathname !== '/ifics_test') {
    throw new Error('Tests interdits hors de ifics_test')
  }
}

describe.skipIf(process.env.REPORT_INTEGRATION_TESTS !== '1')(
  'Rollback réel des archives officielles',
  () => {
    it('supprime le PDF si la référence officielle existe déjà', async () => {
      assertIsolatedDatabase()

      const originalUploadDir = process.env.UPLOAD_DIR
      const directory = await mkdtemp(
        join(tmpdir(), 'ifics-report-rollback-'),
      )

      const associationId = `archive-service-rollback-${randomUUID()}`
      process.env.UPLOAD_DIR = directory

      try {
        const association = await prisma.association.create({
          data: {
            id: associationId,
            name: 'IFICS TEST ROLLBACK REEL',
          },
        })

        const project = await prisma.project.create({
          data: {
            associationId: association.id,
            title: 'Projet rollback réel',
          },
        })

        const createReport = (title: string) =>
          prisma.projectReport.create({
            data: {
              projectId: project.id,
              title,
              sessionDate: new Date('2026-10-09T12:00:00.000Z'),
              status: 'SUBMITTED',
              currentVersion: 1,
              versions: {
                create: {
                  version: 1,
                  content: 'Contenu pédagogique du test rollback.',
                },
              },
            },
          })

        const first = await createReport('Premier bilan')
        const second = await createReport('Deuxième bilan')

        const role = await prisma.role.create({
          data: {
            associationId,
            name: 'Rôle test rollback réel',
            code: `TEST-${randomUUID().slice(0, 8)}`,
          },
        })

        const user = await prisma.user.create({
          data: {
            associationId,
            roleId: role.id,
            firstName: 'Test',
            lastName: 'Rollback',
            email: `rollback-real-${randomUUID()}@example.invalid`,
            passwordHash: 'test-only-not-a-real-password',
          },
        })

        const context = {
          sessionId: 'session-rollback-real',
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
            requestId: 'archive-rollback-real-test',
          },
          node: {
            req: {
              headers: {},
              socket: {},
            },
          },
        } as unknown as H3Event

        const firstArchive = await validateAndArchiveOfficialReport({
          event,
          context,
          reportId: first.id,
        })

        expect(firstArchive.reference).toBe(fixedReference)

        await expect(
          validateAndArchiveOfficialReport({
            event,
            context,
            reportId: second.id,
          }),
        ).rejects.toMatchObject({
          statusCode: 409,
          data: {
            code: 'REPORT_ARCHIVE_DUPLICATE',
          },
        })

        const firstReport = await prisma.projectReport.findUniqueOrThrow({
          where: { id: first.id },
        })

        const secondReport = await prisma.projectReport.findUniqueOrThrow({
          where: { id: second.id },
        })

        expect(firstReport.status).toBe('VALIDATED')
        expect(firstReport.pdfPath).toBe(firstArchive.filePath)

        expect(secondReport.status).toBe('SUBMITTED')
        expect(secondReport.pdfPath).toBeNull()
        expect(secondReport.validatedAt).toBeNull()

        expect(
          await prisma.projectReportArchive.count({
            where: { reportId: first.id },
          }),
        ).toBe(1)

        expect(
          await prisma.projectReportArchive.count({
            where: { reportId: second.id },
          }),
        ).toBe(0)

        expect(
          await prisma.auditLog.count({
            where: {
              associationId,
              action: 'REPORT_OFFICIAL_ARCHIVED',
            },
          }),
        ).toBe(1)

        expect(
          await prisma.auditLog.count({
            where: {
              associationId,
              action: 'REPORT_REVIEWED',
              entityId: first.id,
            },
          }),
        ).toBe(1)

        expect(
          await prisma.auditLog.count({
            where: {
              associationId,
              action: 'REPORT_REVIEWED',
              entityId: second.id,
            },
          }),
        ).toBe(0)

        const firstFiles = await readdir(
          join(directory, 'reports', first.id),
        )

        const secondFiles = await readdir(
          join(directory, 'reports', second.id),
        )

        expect(firstFiles).toEqual([firstArchive.storedName])
        expect(secondFiles).toHaveLength(0)

        const firstPdf = await readStoredFile(firstArchive.filePath)

        expect(firstPdf.subarray(0, 5).toString()).toBe('%PDF-')

        expect(
          createHash('sha256').update(firstPdf).digest('hex'),
        ).toBe(firstArchive.sha256)
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
