import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { prisma } from '../../server/utils/prisma'

describe.skipIf(process.env.REPORT_INTEGRATION_TESTS !== '1')(
  'Transitions des bilans avec PostgreSQL',
  () => {
    it('empêche deux décisions concurrentes', async () => {
      const url = process.env.DATABASE_URL
      if (!url) throw new Error('DATABASE_URL manquante')

      const parsed = new URL(url)
      if (parsed.hostname !== 'db' || parsed.pathname !== '/ifics_test') {
        throw new Error('Tests interdits hors de ifics_test')
      }

      const associationId = `report-review-test-${randomUUID()}`

      try {
        const association = await prisma.association.create({
          data: {
            id: associationId,
            name: 'Tests validation bilans IFICS',
          },
        })

        const project = await prisma.project.create({
          data: {
            associationId: association.id,
            title: 'Projet validation test',
            status: 'IN_PROGRESS',
            classification: 'INTERNAL',
          },
        })

        const report = await prisma.projectReport.create({
          data: {
            projectId: project.id,
            sessionDate: new Date('2026-10-09T12:00:00.000Z'),
            status: 'SUBMITTED',
            currentVersion: 1,
          },
        })

        const decide = (status: 'VALIDATED' | 'REFUSED') =>
          prisma.projectReport.updateMany({
            where: {
              id: report.id,
              status: 'SUBMITTED',
            },
            data: {
              status,
              reviewedAt: new Date(),
              validatedAt: status === 'VALIDATED' ? new Date() : null,
              refusalReason: status === 'REFUSED'
                ? 'Correction demandée'
                : null,
            },
          })

        const results = await Promise.all([
          decide('VALIDATED'),
          decide('REFUSED'),
        ])

        expect(results.map(result => result.count).sort()).toEqual([0, 1])

        const finalReport = await prisma.projectReport.findUniqueOrThrow({
          where: { id: report.id },
        })

        expect(['VALIDATED', 'REFUSED']).toContain(finalReport.status)

        if (finalReport.status === 'VALIDATED') {
          expect(finalReport.validatedAt).not.toBeNull()
          expect(finalReport.refusalReason).toBeNull()
        }
        else {
          expect(finalReport.validatedAt).toBeNull()
          expect(finalReport.refusalReason).toBe('Correction demandée')
        }
      }
      finally {
        await prisma.association.deleteMany({
          where: { id: associationId },
        })
      }
    })

    it('empêche deux transmissions concurrentes', async () => {
      const url = process.env.DATABASE_URL

      if (!url) throw new Error('DATABASE_URL manquante')

      const parsed = new URL(url)

      if (
        parsed.hostname !== 'db'
        || parsed.pathname !== '/ifics_test'
      ) {
        throw new Error('Tests interdits hors de ifics_test')
      }

      const associationId = `report-test-${randomUUID()}`

      try {
        const association = await prisma.association.create({
          data: {
            id: associationId,
            name: 'Tests bilans IFICS',
          },
        })

        const project = await prisma.project.create({
          data: {
            associationId: association.id,
            title: 'Projet de test',
            status: 'IN_PROGRESS',
            classification: 'INTERNAL',
          },
        })

        const report = await prisma.projectReport.create({
          data: {
            projectId: project.id,
            sessionDate: new Date('2026-10-08T12:00:00.000Z'),
            status: 'IN_PROGRESS',
            currentVersion: 1,
          },
        })

        const attempt = () =>
          prisma.projectReport.updateMany({
            where: {
              id: report.id,
              status: 'IN_PROGRESS',
              currentVersion: 1,
            },
            data: {
              status: 'SUBMITTED',
              submittedAt: new Date(),
            },
          })

        const results = await Promise.all([attempt(), attempt()])

        expect(results.map(r => r.count).sort()).toEqual([0, 1])

        const finalReport = await prisma.projectReport.findUniqueOrThrow({
          where: { id: report.id },
        })

        expect(finalReport.status).toBe('SUBMITTED')
      }
      finally {
        await prisma.association.deleteMany({
          where: { id: associationId },
        })
      }
    })
  },
)
