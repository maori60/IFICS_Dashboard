import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { prisma } from '../../server/utils/prisma'

describe.skipIf(process.env.REPORT_INTEGRATION_TESTS !== '1')(
  'Révisions administratives des bilans avec PostgreSQL',
  () => {
    it('conserve la version originale et refuse une révision concurrente', async () => {
      const databaseUrl = new URL(process.env.DATABASE_URL || '')

      if (
        databaseUrl.hostname !== 'db'
        || databaseUrl.pathname !== '/ifics_test'
      ) {
        throw new Error('Tests interdits hors de ifics_test')
      }

      const associationId = `report-admin-${randomUUID()}`
      let created = false

      try {
        const association = await prisma.association.create({
          data: {
            id: associationId,
            name: 'IFICS TEST REVISION',
          },
        })
        created = true

        const project = await prisma.project.create({
          data: {
            associationId: association.id,
            title: 'Projet test révision',
            status: 'IN_PROGRESS',
          },
        })

        const report = await prisma.projectReport.create({
          data: {
            projectId: project.id,
            sessionDate: new Date('2026-10-10T10:00:00.000Z'),
            status: 'SUBMITTED',
            currentVersion: 1,
            submittedAt: new Date(),
          },
        })

        await prisma.projectReportVersion.create({
          data: {
            reportId: report.id,
            version: 1,
            content: 'Version originale de l’intervenant.',
          },
        })

        async function revise(content: string) {
          return prisma.$transaction(async (tx) => {
            const transition = await tx.projectReport.updateMany({
              where: {
                id: report.id,
                currentVersion: 1,
                status: 'SUBMITTED',
              },
              data: {
                currentVersion: { increment: 1 },
                status: 'IN_PROGRESS',
                submittedAt: null,
              },
            })

            if (transition.count !== 1) return false

            await tx.projectReportVersion.create({
              data: {
                reportId: report.id,
                version: 2,
                content,
              },
            })

            return true
          })
        }

        const results = await Promise.all([
          revise('Correction IFICS A'),
          revise('Correction IFICS B'),
        ])

        expect(results.filter(Boolean)).toHaveLength(1)

        const updated = await prisma.projectReport.findUniqueOrThrow({
          where: { id: report.id },
          include: {
            versions: {
              orderBy: { version: 'asc' },
            },
          },
        })

        expect(updated.status).toBe('IN_PROGRESS')
        expect(updated.currentVersion).toBe(2)
        expect(updated.submittedAt).toBeNull()
        expect(updated.versions).toHaveLength(2)
        expect(updated.versions[0]?.content)
          .toBe('Version originale de l’intervenant.')
        expect([
          'Correction IFICS A',
          'Correction IFICS B',
        ]).toContain(updated.versions[1]?.content)
      }
      finally {
        if (created) {
          await prisma.association.deleteMany({
            where: { id: associationId },
          })
        }
      }
    })
  },
)
