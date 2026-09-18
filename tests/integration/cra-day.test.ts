import { randomUUID } from 'node:crypto'
import { defineEventHandler, type H3Event } from 'h3'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const request = vi.hoisted(() => ({
  reportId: '',
  associationId: '',
  body: {} as Record<string, unknown>,
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()

  return {
    ...actual,
    getRouterParam: () => request.reportId,
    readBody: async () => request.body,
  }
})

vi.mock('../../server/utils/auth', () => ({
  requireAuth: async () => ({
    associationId: request.associationId,
    intervenorId: null,
    permissions: ['*'],
  }),
  hasPermission: () => true,
}))

describe.skipIf(process.env.CRA_INTEGRATION_TESTS !== '1')(
  'Journées CRA avec PostgreSQL',
  () => {
    let prisma: typeof import('../../server/utils/prisma')['prisma']
    let handler: typeof import('../../server/api/cra/[id]/day.put')['default']
    let submitHandler: typeof import('../../server/api/cra/[id]/submit.post')['default']
    let intervenorId: string
    let secondReportId: string

    const event = {} as H3Event
    const associationId = `cra-test-${randomUUID()}`

    beforeAll(async () => {
      vi.stubGlobal('defineEventHandler', defineEventHandler)

      prisma = (await import('../../server/utils/prisma')).prisma
      handler = (
        await import('../../server/api/cra/[id]/day.put')
      ).default

      submitHandler = (
        await import('../../server/api/cra/[id]/submit.post')
      ).default

      request.associationId = associationId

      await prisma.association.create({
        data: { id: associationId, name: 'Test temporaire CRA' },
      })

      const intervenor = await prisma.intervenor.create({
        data: {
          associationId,
          firstName: 'Test',
          lastName: 'CRA',
          email: `${associationId}@example.invalid`,
        },
      })

      intervenorId = intervenor.id

      const reportIds: string[] = []

      for (const title of ['Projet test A', 'Projet test B']) {
        const project = await prisma.project.create({
          data: {
            associationId,
            title,
            status: 'IN_PROGRESS',
            projectIntervenors: {
              create: {
                intervenorId,
                assignmentStatus: 'ACCEPTED',
              },
            },
          },
        })

        const report = await prisma.craReport.create({
          data: {
            associationId,
            projectId: project.id,
            intervenorId,
            year: 2026,
            month: 9,
          },
        })

        reportIds.push(report.id)
      }

      request.reportId = reportIds[0]!
      secondReportId = reportIds[1]!
    })

    beforeEach(async () => {
      await prisma.craDay.deleteMany({
        where: { report: { associationId } },
      })

      await prisma.craReport.updateMany({
        where: { associationId },
        data: {
          status: 'DRAFT',
          revision: 1,
          submittedAt: null,
          validatedAt: null,
        },
      })

      request.body = {
        date: '2026-09-18',
        selected: true,
        revision: 1,
      }
    })

    afterAll(async () => {
      try {
        if (prisma) {
          await prisma.craDay.deleteMany({
            where: { report: { associationId } },
          })
          await prisma.craReport.deleteMany({
            where: { associationId },
          })
          await prisma.association.deleteMany({
            where: { id: associationId },
          })
        }
      }
      finally {
        vi.unstubAllGlobals()
        if (prisma) await prisma.$disconnect()
      }
    })

    it('ajoute 7 heures puis retire la journée', async () => {
      const added = await handler(event)

      expect(added.data).toMatchObject({
        selected: true,
        totalDays: 1,
        totalHours: 7,
        revision: 2,
      })

      request.body = {
        date: '2026-09-18',
        selected: false,
        revision: 2,
      }

      const removed = await handler(event)

      expect(removed.data).toMatchObject({
        selected: false,
        totalDays: 0,
        totalHours: 0,
        revision: 3,
      })
    })

    it('refuse de modifier un CRA soumis', async () => {
      await prisma.craReport.update({
        where: { id: request.reportId },
        data: { status: 'SUBMITTED' },
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 409,
      })

      expect(await prisma.craDay.count({
        where: { reportId: request.reportId },
      })).toBe(0)
    })

    it('refuse une journée déjà utilisée sur un autre projet', async () => {
      await prisma.craDay.create({
        data: {
          reportId: secondReportId,
          intervenorId,
          date: new Date('2026-09-18T00:00:00.000Z'),
        },
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 409,
      })

      const report = await prisma.craReport.findUniqueOrThrow({
        where: { id: request.reportId },
      })

      expect(report.revision).toBe(1)
      expect(await prisma.craDay.count({
        where: { reportId: request.reportId },
      })).toBe(0)
    })

    it('accepte une seule modification pour une même révision', async () => {
      const results = await Promise.allSettled([
        handler(event),
        handler(event),
      ])

      expect(results.filter(result =>
        result.status === 'fulfilled',
      )).toHaveLength(1)

      const failure = results.find(result =>
        result.status === 'rejected',
      )

      expect(failure).toMatchObject({
        status: 'rejected',
        reason: { statusCode: 409 },
      })

      const report = await prisma.craReport.findUniqueOrThrow({
        where: { id: request.reportId },
      })

      expect(report.revision).toBe(2)
      expect(await prisma.craDay.count({
        where: { reportId: request.reportId },
      })).toBe(1)
    })
    it('refuse une soumission sans confirmation', async () => {
      request.body = { confirmed: false, revision: 1 }

      await expect(submitHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('conserve le brouillon lorsqu’un CRA vide est soumis', async () => {
      request.body = { confirmed: true, revision: 1 }

      await expect(submitHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      })

      const report = await prisma.craReport.findUniqueOrThrow({
        where: { id: request.reportId },
      })

      expect(report.status).toBe('DRAFT')
      expect(report.revision).toBe(1)
      expect(report.submittedAt).toBeNull()
    })

    it('soumet un CRA rempli puis bloque les modifications', async () => {
      await handler(event)

      request.body = { confirmed: true, revision: 2 }

      const result = await submitHandler(event)

      expect(result.data).toMatchObject({
        status: 'SUBMITTED',
        revision: 3,
        totalDays: 1,
        totalHours: 7,
      })

      const report = await prisma.craReport.findUniqueOrThrow({
        where: { id: request.reportId },
      })

      expect(report.status).toBe('SUBMITTED')
      expect(report.submittedAt).toBeInstanceOf(Date)

      request.body = {
        date: '2026-09-18',
        selected: false,
        revision: 3,
      }

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 409,
      })

      expect(await prisma.craDay.count({
        where: { reportId: request.reportId },
      })).toBe(1)
    })

    it('refuse une soumission basée sur une ancienne révision', async () => {
      await handler(event)

      request.body = { confirmed: true, revision: 1 }

      await expect(submitHandler(event)).rejects.toMatchObject({
        statusCode: 409,
      })

      const report = await prisma.craReport.findUniqueOrThrow({
        where: { id: request.reportId },
      })

      expect(report.status).toBe('DRAFT')
      expect(report.revision).toBe(2)
    })
  },
)
