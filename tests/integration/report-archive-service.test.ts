import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
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
  'Service complet des archives officielles',
  () => {
    it('conserve le PDF officiel avec son empreinte et son audit', async () => {
      assertIsolatedDatabase()

      const originalUploadDir = process.env.UPLOAD_DIR
      const directory = await mkdtemp(
        join(tmpdir(), 'ifics-report-service-'),
      )

      const associationId = `archive-service-${randomUUID()}`

      process.env.UPLOAD_DIR = directory

      let testError: unknown
      try {
        const association = await prisma.association.create({
          data: {
            id: associationId,
            name: 'IFICS TEST SERVICE',
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
            title: 'Bilan de séance test',
            sessionDate: new Date('2026-10-09T12:00:00.000Z'),
            status: 'SUBMITTED',
            currentVersion: 1,
            versions: {
              create: {
                version: 1,
                content: 'Contenu pédagogique officiel.',
              },
            },
          },
        })

        const role = await prisma.role.create({
          data: {
            associationId,
            name: 'Rôle test service',
            code: `TEST-${randomUUID().slice(0, 8)}`,
          },
        })

        const user = await prisma.user.create({
          data: {
            associationId,
            roleId: role.id,
            firstName: 'Test',
            lastName: 'Service',
            email: `service-${randomUUID()}@example.invalid`,
            passwordHash: 'test-only-not-a-real-password',
          },
        })

        const context = {
          sessionId: 'session-service-test',
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
            requestId: 'archive-service-test',
          },
          node: {
            req: {
              headers: {},
              socket: {},
            },
          },
        } as unknown as H3Event

        const archive = await validateAndArchiveOfficialReport({
          event,
          context,
          reportId: report.id,
        })

        const storedPdf = await readStoredFile(archive.filePath)

        expect(storedPdf.subarray(0, 5).toString()).toBe('%PDF-')
        expect(BigInt(storedPdf.length)).toBe(archive.fileSize)

        expect(
          createHash('sha256').update(storedPdf).digest('hex'),
        ).toBe(archive.sha256)

        expect(archive.reference).toMatch(/^IFICS-BILAN-2026-/)

        const updated = await prisma.projectReport.findUniqueOrThrow({
          where: { id: report.id },
        })

        expect(updated.status).toBe('VALIDATED')
        expect(updated.pdfPath).toBe(archive.filePath)

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

        expect(
          await prisma.auditLog.count({
            where: {
              associationId,
              action: 'REPORT_REVIEWED',
              entityType: 'ProjectReport',
              entityId: report.id,
            },
          }),
        ).toBe(1)
      }
      catch (error) {
        testError = error
      }

      const cleanupErrors: unknown[] = []

      try {
        await prisma.$transaction(async (tx) => {
          if (!associationId.startsWith('archive-service-')) {
            throw new Error('Identifiant de nettoyage invalide')
          }

          await tx.auditLog.deleteMany({
            where: { associationId },
          })

          await tx.projectReportArchive.deleteMany({
            where: {
              report: { project: { associationId } },
            },
          })

          await tx.projectReportVersion.deleteMany({
            where: {
              report: { project: { associationId } },
            },
          })

          await tx.projectReport.deleteMany({
            where: { project: { associationId } },
          })

          await tx.project.deleteMany({
            where: { associationId },
          })

          await tx.user.deleteMany({
            where: { associationId },
          })

          await tx.role.deleteMany({
            where: { associationId },
          })

          await tx.association.deleteMany({
            where: { id: associationId },
          })
        })
      }
      catch (error) {
        cleanupErrors.push(error)
      }

      if (originalUploadDir === undefined) {
        delete process.env.UPLOAD_DIR
      }
      else {
        process.env.UPLOAD_DIR = originalUploadDir
      }

      try {
        await rm(directory, { recursive: true, force: true })
      }
      catch (error) {
        cleanupErrors.push(error)
      }

      if (testError !== undefined || cleanupErrors.length > 0) {
        const errors = [
          ...(testError === undefined ? [] : [testError]),
          ...cleanupErrors,
        ]
        throw new AggregateError(errors, 'Échec du test ou du nettoyage des archives')
      }
    })
  },
)
