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
  roleCode: 'INTERVENOR',
  actorIntervenorId: null as string | null,
  permissions: [] as string[],
  body: {} as Record<string, unknown>,
  query: {} as Record<string, string>,
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()

  return {
    ...actual,
    getRouterParam: () => request.reportId,
    readBody: async () => request.body,
    getQuery: () => request.query,
  }
})

vi.mock('../../server/utils/auth', () => ({
  requireAuth: async () => ({
    associationId: request.associationId,
    roleCode: request.roleCode,
    intervenorId: request.actorIntervenorId,
    permissions: request.permissions,
  }),
  hasPermission: (
    context: { permissions: string[] },
    permission: string,
  ) => context.permissions.includes('*')
    || context.permissions.includes(permission),
}))

describe.skipIf(process.env.CRA_INTEGRATION_TESTS !== '1')(
  'Journées CRA avec PostgreSQL',
  () => {
    let prisma: typeof import('../../server/utils/prisma')['prisma']
    let handler: typeof import('../../server/api/cra/[id]/day.put')['default']
    let submitHandler: typeof import('../../server/api/cra/[id]/submit.post')['default']
    let readHandler: typeof import('../../server/api/cra/[id]/index.get')['default']
    let createHandler: typeof import('../../server/api/cra/create.post')['default']
    let assignmentsHandler: typeof import('../../server/api/cra/assignments.get')['default']

    let intervenorId: string
    let otherIntervenorId: string
    let firstProjectId: string
    let firstReportId: string
    let secondReportId: string

    const event = {} as H3Event
    const associationId = `cra-test-${randomUUID()}`

    function useAdmin() {
      request.roleCode = 'ADMIN'
      request.actorIntervenorId = null
      request.permissions = ['*']
    }

    async function reportSnapshot() {
      return prisma.craReport.findUniqueOrThrow({
        where: { id: firstReportId },
        include: {
          days: { orderBy: { date: 'asc' } },
        },
      })
    }

    beforeAll(async () => {
      vi.stubGlobal('defineEventHandler', defineEventHandler)

      prisma = (await import('../../server/utils/prisma')).prisma

      handler = (
        await import('../../server/api/cra/[id]/day.put')
      ).default

      submitHandler = (
        await import('../../server/api/cra/[id]/submit.post')
      ).default

      readHandler = (
        await import('../../server/api/cra/[id]/index.get')
      ).default

      createHandler = (
        await import('../../server/api/cra/create.post')
      ).default

      assignmentsHandler = (
        await import('../../server/api/cra/assignments.get')
      ).default

      await prisma.association.create({
        data: {
          id: associationId,
          name: 'Test temporaire CRA',
        },
      })

      const intervenor = await prisma.intervenor.create({
        data: {
          associationId,
          firstName: 'Test',
          lastName: 'CRA',
          email: `${associationId}@example.invalid`,
          status: 'ACTIVE',
        },
      })

      const otherIntervenor = await prisma.intervenor.create({
        data: {
          associationId,
          firstName: 'Autre',
          lastName: 'Intervenant',
          email: `${associationId}-other@example.invalid`,
          status: 'ACTIVE',
        },
      })

      intervenorId = intervenor.id
      otherIntervenorId = otherIntervenor.id

      const reportIds: string[] = []
      const projectIds: string[] = []

      for (const title of ['Projet test A', 'Projet test B']) {
        const project = await prisma.project.create({
          data: {
            associationId,
            title,
            status: 'IN_PROGRESS',
            classification: 'INTERNAL',
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

        projectIds.push(project.id)
        reportIds.push(report.id)
      }

      firstProjectId = projectIds[0]!
      firstReportId = reportIds[0]!
      secondReportId = reportIds[1]!

      await prisma.projectIntervenor.create({
        data: {
          projectId: firstProjectId,
          intervenorId: otherIntervenorId,
          assignmentStatus: 'ACCEPTED',
        },
      })
    })

    beforeEach(async () => {
      request.reportId = firstReportId
      request.associationId = associationId
      request.roleCode = 'INTERVENOR'
      request.actorIntervenorId = intervenorId
      request.permissions = ['cra:read:own', 'cra:write:own']
      request.query = {}

      await prisma.craDay.deleteMany({
        where: { report: { associationId } },
      })

      // Supprime uniquement les CRA supplémentaires créés par ces tests.
      await prisma.craReport.deleteMany({
        where: {
          associationId,
          id: { notIn: [firstReportId, secondReportId] },
        },
      })

      await prisma.craReport.updateMany({
        where: { associationId },
        data: {
          status: 'DRAFT',
          revision: 1,
          submittedAt: null,
          validatedAt: null,
          reviewedAt: null,
          reviewedById: null,
          correctionRequestedAt: null,
          correctionRequestedById: null,
          correctionReason: null,
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

          await prisma.projectIntervenor.deleteMany({
            where: { project: { associationId } },
          })

          await prisma.project.deleteMany({
            where: { associationId },
          })

          await prisma.intervenor.deleteMany({
            where: { associationId },
          })

          await prisma.association.deleteMany({
            where: { id: associationId },
          })
        }
      }
      finally {
        vi.unstubAllGlobals()

        if (prisma) {
          await prisma.$disconnect()
        }
      }
    })

    it('crée son propre CRA à partir de son identité de session', async () => {
      request.body = {
        projectId: firstProjectId,
        year: 2026,
        month: 10,
      }

      const result = await createHandler(event)

      expect(result.data).toMatchObject({
        projectId: firstProjectId,
        intervenorId,
        year: 2026,
        month: 10,
        status: 'DRAFT',
        revision: 1,
      })

      const created = await prisma.craReport.findUniqueOrThrow({
        where: { id: result.data.id },
      })

      expect(created.associationId).toBe(associationId)
      expect(created.intervenorId).toBe(intervenorId)
    })

    it('refuse la création administrative même avec tous les droits', async () => {
      useAdmin()
      request.body = {
        projectId: firstProjectId,
        intervenorId,
        year: 2026,
        month: 10,
      }

      await expect(createHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      })

      expect(await prisma.craReport.count({
        where: { associationId },
      })).toBe(2)
    })

    it('refuse de créer un CRA pour un autre intervenant affecté au projet', async () => {
      request.body = {
        projectId: firstProjectId,
        intervenorId: otherIntervenorId,
        year: 2026,
        month: 10,
      }

      await expect(createHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      })

      expect(await prisma.craReport.count({
        where: { associationId },
      })).toBe(2)
    })

    it('refuse de créer un doublon de CRA', async () => {
      request.body = {
        projectId: firstProjectId,
        year: 2026,
        month: 9,
      }

      await expect(createHandler(event)).rejects.toMatchObject({
        statusCode: 409,
      })

      expect(await prisma.craReport.count({
        where: { associationId },
      })).toBe(2)
    })

    it('propose uniquement les missions acceptées de l’intervenant connecté', async () => {
      const result = await assignmentsHandler(event)

      expect(result.data.pagination.total).toBe(2)
      expect(result.data.items).toHaveLength(2)

      for (const item of result.data.items) {
        expect(item.intervenorId).toBe(intervenorId)
      }

      request.actorIntervenorId = otherIntervenorId

      const otherResult = await assignmentsHandler(event)

      expect(otherResult.data.pagination.total).toBe(1)
      expect(otherResult.data.items).toHaveLength(1)
      expect(otherResult.data.items[0]).toMatchObject({
        projectId: firstProjectId,
        intervenorId: otherIntervenorId,
      })
    })

    it('refuse à l’admin la liste des missions destinée à la création', async () => {
      useAdmin()

      await expect(assignmentsHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('ajoute 7 heures puis retire la journée', async () => {
      const added = await handler(event)

      expect(added.data).toMatchObject({
        selected: true,
        totalDays: 1,
        totalHours: 7,
        revision: 2,
      })

      expect(await prisma.craDay.count({
        where: { reportId: firstReportId },
      })).toBe(1)

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

      expect(await prisma.craDay.count({
        where: { reportId: firstReportId },
      })).toBe(0)
    })

    it('refuse la modification administrative sans changer le CRA', async () => {
      await handler(event)
      const before = await reportSnapshot()

      useAdmin()
      request.body = {
        date: '2026-09-18',
        selected: false,
        revision: 2,
      }

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 403,
      })

      expect(await reportSnapshot()).toEqual(before)
    })

    it('refuse la modification par un autre intervenant sans changer le CRA', async () => {
      await handler(event)
      const before = await reportSnapshot()

      request.actorIntervenorId = otherIntervenorId
      request.body = {
        date: '2026-09-18',
        selected: false,
        revision: 2,
      }

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 403,
      })

      expect(await reportSnapshot()).toEqual(before)
    })

    it('refuse la modification sans permission de saisie', async () => {
      const before = await reportSnapshot()
      request.permissions = ['cra:read:own']

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 403,
      })

      expect(await reportSnapshot()).toEqual(before)
    })

    it('refuse de modifier un CRA soumis', async () => {
      await prisma.craReport.update({
        where: { id: firstReportId },
        data: { status: 'SUBMITTED' },
      })

      const before = await reportSnapshot()

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 409,
      })

      expect(await reportSnapshot()).toEqual(before)
    })

    it('refuse une journée déjà utilisée sur un autre projet', async () => {
      await prisma.craDay.create({
        data: {
          reportId: secondReportId,
          intervenorId,
          date: new Date('2026-09-18T00:00:00.000Z'),
        },
      })

      const before = await reportSnapshot()

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 409,
      })

      expect(await reportSnapshot()).toEqual(before)

      expect(await prisma.craDay.count({
        where: { reportId: secondReportId },
      })).toBe(1)
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

      const report = await reportSnapshot()

      expect(report.revision).toBe(2)
      expect(report.days).toHaveLength(1)
    })

    it('refuse une soumission sans confirmation', async () => {
      const before = await reportSnapshot()

      request.body = {
        confirmed: false,
        revision: 1,
      }

      await expect(submitHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      })

      expect(await reportSnapshot()).toEqual(before)
    })

    it('conserve le brouillon lorsqu’un CRA vide est soumis', async () => {
      const before = await reportSnapshot()

      request.body = {
        confirmed: true,
        revision: 1,
      }

      await expect(submitHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      })

      expect(await reportSnapshot()).toEqual(before)
    })

    it('refuse la soumission administrative sans changer le CRA', async () => {
      await handler(event)
      const before = await reportSnapshot()

      useAdmin()
      request.body = {
        confirmed: true,
        revision: 2,
      }

      await expect(submitHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      })

      expect(await reportSnapshot()).toEqual(before)
    })

    it('refuse la soumission par un autre intervenant sans changer le CRA', async () => {
      await handler(event)
      const before = await reportSnapshot()

      request.actorIntervenorId = otherIntervenorId
      request.body = {
        confirmed: true,
        revision: 2,
      }

      await expect(submitHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      })

      expect(await reportSnapshot()).toEqual(before)
    })

    it('soumet un CRA rempli puis bloque les modifications', async () => {
      await handler(event)

      request.body = {
        confirmed: true,
        revision: 2,
      }

      const result = await submitHandler(event)

      expect(result.data).toMatchObject({
        status: 'SUBMITTED',
        revision: 3,
        totalDays: 1,
        totalHours: 7,
      })

      const submitted = await reportSnapshot()

      expect(submitted.status).toBe('SUBMITTED')
      expect(submitted.revision).toBe(3)
      expect(submitted.submittedAt).toBeInstanceOf(Date)

      request.body = {
        date: '2026-09-18',
        selected: false,
        revision: 3,
      }

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 409,
      })

      expect(await reportSnapshot()).toEqual(submitted)
    })

    it('retransmet un CRA refusé après correction puis verrouille les journées', async () => {
      request.body = {
        date: '2026-09-18',
        selected: true,
        revision: 1,
      }

      await handler(event)

      request.body = {
        date: '2026-09-21',
        selected: true,
        revision: 2,
      }

      await handler(event)

      request.body = {
        confirmed: true,
        revision: 3,
      }

      const firstSubmission = await submitHandler(event)

      expect(firstSubmission.data).toMatchObject({
        status: 'SUBMITTED',
        revision: 4,
        totalDays: 2,
        totalHours: 14,
      })

      const correctionRequestedAt = new Date(
        '2026-09-20T07:00:00.000Z',
      )

      await prisma.craReport.update({
        where: { id: firstReportId },
        data: {
          status: 'REFUSED',
          revision: 5,
          correctionRequestedAt,
          correctionRequestedById: 'admin-test',
          correctionReason: 'Retirer la journée du 21 septembre 2026.',
        },
      })

      request.body = {
        date: '2026-09-21',
        selected: false,
        revision: 5,
      }

      const corrected = await handler(event)

      expect(corrected.data).toMatchObject({
        selected: false,
        revision: 6,
        totalDays: 1,
        totalHours: 7,
      })

      request.body = {
        confirmed: true,
        revision: 6,
      }

      const resubmitted = await submitHandler(event)

      expect(resubmitted.data).toMatchObject({
        status: 'SUBMITTED',
        revision: 7,
        totalDays: 1,
        totalHours: 7,
      })

      const submitted = await reportSnapshot()

      expect(submitted.status).toBe('SUBMITTED')
      expect(submitted.revision).toBe(7)
      expect(submitted.days).toHaveLength(1)
      expect(submitted.submittedAt).toBeInstanceOf(Date)

      expect(submitted.correctionReason).toBe(
        'Retirer la journée du 21 septembre 2026.',
      )

      expect(submitted.correctionRequestedAt).toEqual(
        correctionRequestedAt,
      )

      expect(submitted.correctionRequestedById).toBe('admin-test')

      request.body = {
        date: '2026-09-18',
        selected: false,
        revision: 7,
      }

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 409,
      })

      expect(await reportSnapshot()).toEqual(submitted)
    })

    it('refuse une soumission basée sur une ancienne révision', async () => {
      await handler(event)
      const before = await reportSnapshot()

      request.body = {
        confirmed: true,
        revision: 1,
      }

      await expect(submitHandler(event)).rejects.toMatchObject({
        statusCode: 409,
      })

      expect(await reportSnapshot()).toEqual(before)
    })

    it('permet à un intervenant de consulter son propre CRA', async () => {
      request.permissions = ['cra:read:own']

      const result = await readHandler(event)

      expect(result.data).toMatchObject({
        id: firstReportId,
        intervenorId,
        totalDays: 0,
        totalHours: 0,
      })
    })

    it('refuse la lecture sans permission CRA', async () => {
      request.permissions = []

      await expect(readHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('masque le CRA d’un autre intervenant', async () => {
      request.actorIntervenorId = otherIntervenorId
      request.permissions = ['cra:read:own']

      await expect(readHandler(event)).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('masque le CRA d’une autre association même avec tous les droits', async () => {
      useAdmin()
      request.associationId = 'another-association'

      await expect(readHandler(event)).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('permet à l’admin de consulter le CRA et ses totaux', async () => {
      await handler(event)
      useAdmin()

      const result = await readHandler(event)

      expect(result.data).toMatchObject({
        id: firstReportId,
        intervenorId,
        totalDays: 1,
        totalHours: 7,
      })

      expect(result.data.days).toHaveLength(1)
      expect(result.data.days[0]).toMatchObject({
        date: '2026-09-18',
        hours: 7,
      })
    })

    it('permet la consultation avec le droit de lecture globale', async () => {
      request.roleCode = 'MANAGER'
      request.actorIntervenorId = null
      request.permissions = ['cra:read:all']

      const result = await readHandler(event)

      expect(result.data).toMatchObject({
        id: firstReportId,
        intervenorId,
      })
    })
  },
)