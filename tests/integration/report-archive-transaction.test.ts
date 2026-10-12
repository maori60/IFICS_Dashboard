import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { H3Event } from 'h3'
import type { AuthContext } from '../../server/utils/auth'
import { prisma } from '../../server/utils/prisma'
import { findReportArchiveSource } from '../../server/utils/report-archive-reader'
import { reportArchiveStateFromSource } from '../../server/utils/report-archive-state'
import { buildReportArchiveFromSource } from '../../server/utils/report-archive-source'
import { commitOfficialReportArchive } from '../../server/utils/report-archive-transaction'

function assertIsolatedDatabase() {
  const url = new URL(process.env.DATABASE_URL || '')

  if (url.hostname !== 'db' || url.pathname !== '/ifics_test') {
    throw new Error('Tests interdits hors de ifics_test')
  }
}

describe.skipIf(process.env.REPORT_INTEGRATION_TESTS !== '1')(
  'Transaction des archives officielles',
  () => {
    it('empêche deux archivages simultanés du même bilan', async () => {
      assertIsolatedDatabase()

      const associationId = `archive-concurrent-${randomUUID()}`

      try {
        const association = await prisma.association.create({
          data: {
            id: associationId,
            name: 'IFICS TEST CONCURRENCE',
          },
        })

        const project = await prisma.project.create({
          data: {
            associationId: association.id,
            title: 'Projet concurrence',
          },
        })

        const report = await prisma.projectReport.create({
          data: {
            projectId: project.id,
            title: 'Séance concurrente',
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
            name: 'Rôle test concurrence',
            code: `TEST-${randomUUID().slice(0, 8)}`,
          },
        })

        const user = await prisma.user.create({
          data: {
            associationId,
            roleId: role.id,
            firstName: 'Test',
            lastName: 'Concurrence',
            email: `concurrent-${randomUUID()}@example.invalid`,
            passwordHash: 'test-only-not-a-real-password',
          },
        })

        const context = {
          sessionId: 'session-concurrent',
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
            requestId: 'archive-concurrent-test',
          },
          node: {
            req: {
              headers: {},
              socket: {},
            },
          },
        } as unknown as H3Event

        const source = await findReportArchiveSource(
          report.id,
          associationId,
        )

        if (!source) throw new Error('Source introuvable')

        const expectedState = reportArchiveStateFromSource(source)

        const snapshot = buildReportArchiveFromSource(
          source,
          user.id,
          new Date(),
        )

        const stored = {
          originalName: 'concurrent.pdf',
          storedName: 'concurrent.pdf',
          filePath: `reports/${report.id}/concurrent.pdf`,
          mimeType: 'application/pdf',
          fileSize: 100n,
          sha256: 'c'.repeat(64),
        }

        const attempt = () =>
          commitOfficialReportArchive({
            event,
            context,
            snapshot,
            expectedState,
            stored,
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

        const failure = failures[0]

        expect(failure).toMatchObject({
          status: 'rejected',
          reason: {
            statusCode: 409,
            data: {
              code: 'REPORT_ARCHIVE_CONFLICT',
            },
          },
        })

        const finalReport = await prisma.projectReport.findUniqueOrThrow({
          where: { id: report.id },
        })

        expect(finalReport.status).toBe('VALIDATED')

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
      }
      finally {
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

        await prisma.association.deleteMany({
          where: { id: associationId },
        })
      }
    })

    it('annule la validation si la création de l’archive échoue', async () => {
      assertIsolatedDatabase()

      const associationId = `archive-rollback-${randomUUID()}`

      try {
        const association = await prisma.association.create({
          data: {
            id: associationId,
            name: 'IFICS TEST ROLLBACK',
          },
        })

        const project = await prisma.project.create({
          data: {
            associationId: association.id,
            title: 'Projet rollback',
          },
        })

        const createReport = async (title: string) =>
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
                  content: 'Contenu du test rollback.',
                },
              },
            },
          })

        const first = await createReport('Premier bilan')
        const second = await createReport('Deuxième bilan')

        const role = await prisma.role.create({
          data: {
            associationId,
            name: 'Rôle test rollback',
            code: `TEST-${randomUUID().slice(0, 8)}`,
          },
        })

        const user = await prisma.user.create({
          data: {
            associationId,
            roleId: role.id,
            firstName: 'Test',
            lastName: 'Rollback',
            email: `rollback-${randomUUID()}@example.invalid`,
            passwordHash: 'test-only-not-a-real-password',
          },
        })

        const context = {
          sessionId: 'session-rollback',
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
            requestId: 'archive-rollback-test',
          },
          node: {
            req: {
              headers: {},
              socket: {},
            },
          },
        } as unknown as H3Event

        const firstSource = await findReportArchiveSource(
          first.id,
          associationId,
        )

        const secondSource = await findReportArchiveSource(
          second.id,
          associationId,
        )

        if (!firstSource || !secondSource) {
          throw new Error('Sources de test introuvables')
        }

        const firstSnapshot = buildReportArchiveFromSource(
          firstSource,
          user.id,
          new Date(),
        )

        const firstStored = {
          originalName: 'premier.pdf',
          storedName: 'premier.pdf',
          filePath: `reports/${first.id}/premier.pdf`,
          mimeType: 'application/pdf',
          fileSize: 100n,
          sha256: 'a'.repeat(64),
        }

        await commitOfficialReportArchive({
          event,
          context,
          snapshot: firstSnapshot,
          expectedState: reportArchiveStateFromSource(firstSource),
          stored: firstStored,
        })

        const secondSnapshot = {
          ...buildReportArchiveFromSource(
            secondSource,
            user.id,
            new Date(),
          ),
          reference: firstSnapshot.reference,
        }

        const secondStored = {
          originalName: 'deuxieme.pdf',
          storedName: 'deuxieme.pdf',
          filePath: `reports/${second.id}/deuxieme.pdf`,
          mimeType: 'application/pdf',
          fileSize: 100n,
          sha256: 'b'.repeat(64),
        }

        const auditCountBefore = await prisma.auditLog.count({
          where: {
            associationId,
            action: 'REPORT_OFFICIAL_ARCHIVED',
          },
        })

        await expect(
          commitOfficialReportArchive({
            event,
            context,
            snapshot: secondSnapshot,
            expectedState: reportArchiveStateFromSource(secondSource),
            stored: secondStored,
          }),
        ).rejects.toMatchObject({
          statusCode: 409,
          data: {
            code: 'REPORT_ARCHIVE_DUPLICATE',
          },
        })

        const auditCountAfter = await prisma.auditLog.count({
          where: {
            associationId,
            action: 'REPORT_OFFICIAL_ARCHIVED',
          },
        })

        expect(auditCountAfter).toBe(auditCountBefore)

        const unchanged = await prisma.projectReport.findUniqueOrThrow({
          where: { id: second.id },
        })

        expect(unchanged.status).toBe('SUBMITTED')
        expect(unchanged.validatedAt).toBeNull()
        expect(unchanged.pdfPath).toBeNull()

        expect(
          await prisma.projectReportArchive.count({
            where: { reportId: second.id },
          }),
        ).toBe(0)


      }
      finally {
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

        await prisma.association.deleteMany({
          where: { id: associationId },
        })
      }
    })

    it('valide et archive une seule fois avec audit', async () => {
      assertIsolatedDatabase()

      const associationId = `archive-tx-${randomUUID()}`

      try {
        const association = await prisma.association.create({
          data: {
            id: associationId,
            name: 'IFICS TEST ARCHIVE',
          },
        })

        const project = await prisma.project.create({
          data: {
            associationId: association.id,
            title: 'Projet pédagogique test',
          },
        })

        const report = await prisma.projectReport.create({
          data: {
            projectId: project.id,
            title: 'Séance test',
            sessionDate: new Date('2026-10-09T12:00:00.000Z'),
            status: 'SUBMITTED',
            currentVersion: 1,
            versions: {
              create: {
                version: 1,
                content: 'Contenu pédagogique de test.',
              },
            },
          },
        })

        const source = await findReportArchiveSource(
          report.id,
          associationId,
        )

        expect(source).not.toBeNull()
        if (!source) throw new Error('Source introuvable')

        const expectedState = reportArchiveStateFromSource(source)

        const userId = `archive-reviewer-${randomUUID()}`

        const role = await prisma.role.create({
          data: {
            associationId,
            name: 'Rôle test archive',
            code: `TEST-${randomUUID().slice(0, 8)}`,
          },
        })

        const user = await prisma.user.create({
          data: {
            id: userId,
            associationId,
            roleId: role.id,
            firstName: 'Test',
            lastName: 'Archive',
            email: `archive-${randomUUID()}@example.invalid`,
            passwordHash: 'test-only-not-a-real-password',
          },
        })

        const context = {
          sessionId: 'session-test',
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
            requestId: 'archive-transaction-test',
          },
          node: {
            req: {
              headers: {},
              socket: {},
            },
          },
        } as unknown as H3Event

        const snapshot = buildReportArchiveFromSource(
          source,
          user.id,
          new Date(),
        )

        const stored = {
          originalName: `${snapshot.reference}.pdf`,
          storedName: 'archive-test.pdf',
          filePath: `reports/${report.id}/archive-test.pdf`,
          mimeType: 'application/pdf',
          fileSize: 100n,
          sha256: 'a'.repeat(64),
        }

        const archive = await commitOfficialReportArchive({
          event,
          context,
          snapshot,
          expectedState,
          stored,
        })

        expect(archive.reportId).toBe(report.id)
        expect(archive.reportVersionId).toBe(
          snapshot.reportVersionId,
        )
        expect(archive.reference).toBe(snapshot.reference)
        expect(archive.sha256).toBe(stored.sha256)

        const updated = await prisma.projectReport.findUniqueOrThrow({
          where: { id: report.id },
        })

        expect(updated.status).toBe('VALIDATED')
        expect(updated.validatedAt).toEqual(snapshot.validatedAt)
        expect(updated.pdfPath).toBe(stored.filePath)

        const archives = await prisma.projectReportArchive.findMany({
          where: { reportId: report.id },
        })

        expect(archives).toHaveLength(1)

        const audit = await prisma.auditLog.findFirst({
          where: {
            associationId,
            action: 'REPORT_OFFICIAL_ARCHIVED',
            entityId: archive.id,
          },
        })

        expect(audit).not.toBeNull()

        await expect(
          commitOfficialReportArchive({
            event,
            context,
            snapshot,
            expectedState,
            stored,
          }),
        ).rejects.toThrow()

        expect(await prisma.projectReportArchive.count({
          where: { reportId: report.id },
        })).toBe(1)
      }
      finally {
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

        await prisma.association.deleteMany({
          where: { id: associationId },
        })
      }
    })
  },
)
