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
  associationId: '',
  intervenorId: null as string | null,
  permissions: ['*'] as string[],
  query: {} as Record<string, unknown>,
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()

  return {
    ...actual,
    getQuery: () => request.query,
  }
})

vi.mock('../../server/utils/auth', () => ({
  requireAuth: async () => ({
    associationId: request.associationId,
    intervenorId: request.intervenorId,
    permissions: request.permissions,
  }),
  hasPermission: (
    context: { permissions: string[] },
    permission: string,
  ) => context.permissions.includes('*')
    || context.permissions.includes(permission),
}))

describe.skipIf(process.env.CRA_INTEGRATION_TESTS !== '1')(
  'Liste paginée des CRA avec PostgreSQL',
  () => {
    let prisma: typeof import('../../server/utils/prisma')['prisma']
    let listHandler: typeof import('../../server/api/cra/index.get')['default']
    let ownIntervenorId: string
    let ownReportId: string

    const event = {} as H3Event
    const associationId = `cra-list-${randomUUID()}`
    const foreignAssociationId = `cra-list-${randomUUID()}`
    const associationIds = [associationId, foreignAssociationId]

    beforeAll(async () => {
      vi.stubGlobal('defineEventHandler', defineEventHandler)

      prisma = (await import('../../server/utils/prisma')).prisma
      listHandler = (
        await import('../../server/api/cra/index.get')
      ).default

      for (const id of associationIds) {
        await prisma.association.create({
          data: { id, name: 'Test temporaire liste CRA' },
        })
      }

      for (let index = 0; index < 3; index++) {
        const ownerId = index === 2
          ? foreignAssociationId
          : associationId

        const intervenor = await prisma.intervenor.create({
          data: {
            associationId: ownerId,
            firstName: 'Test',
            lastName: `Intervenant ${index}`,
            email: `${associationId}-${index}@example.invalid`,
          },
        })

        const project = await prisma.project.create({
          data: {
            associationId: ownerId,
            title: `Projet temporaire ${index}`,
            status: 'IN_PROGRESS',
            classification: index === 1 ? 'CONFIDENTIAL' : 'INTERNAL',
            projectIntervenors: {
              create: {
                intervenorId: intervenor.id,
                assignmentStatus: 'ACCEPTED',
              },
            },
          },
        })

        const report = await prisma.craReport.create({
          data: {
            associationId: ownerId,
            projectId: project.id,
            intervenorId: intervenor.id,
            year: 2026,
            month: 9,
            days: {
              create: {
                date: new Date('2026-09-18T00:00:00.000Z'),
              },
            },
          },
        })

        if (index === 0) {
          ownIntervenorId = intervenor.id
          ownReportId = report.id
        }
      }
    })

    beforeEach(() => {
      request.associationId = associationId
      request.intervenorId = null
      request.permissions = ['*']
      request.query = {}
    })

    afterAll(async () => {
      try {
        if (prisma) {
          await prisma.craDay.deleteMany({
            where: {
              report: { associationId: { in: associationIds } },
            },
          })

          await prisma.craReport.deleteMany({
            where: { associationId: { in: associationIds } },
          })

          await prisma.association.deleteMany({
            where: { id: { in: associationIds } },
          })
        }
      }
      finally {
        vi.unstubAllGlobals()
        if (prisma) await prisma.$disconnect()
      }
    })

    it('limite la liste et son total à l’association courante', async () => {
      const result = await listHandler(event)

      expect(result.data.items).toHaveLength(2)
      expect(result.data.pagination).toMatchObject({
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 1,
        hasNextPage: false,
      })
    })

    it('renvoie deux pages distinctes sans doublon', async () => {
      request.query = { page: '1', pageSize: '1' }
      const first = await listHandler(event)

      request.query = { page: '2', pageSize: '1' }
      const second = await listHandler(event)

      expect(first.data.items).toHaveLength(1)
      expect(second.data.items).toHaveLength(1)

      expect(first.data.items[0]!.id)
        .not.toBe(second.data.items[0]!.id)

      expect(first.data.pagination).toMatchObject({
        total: 2,
        totalPages: 2,
        hasNextPage: true,
      })

      expect(second.data.pagination.hasNextPage).toBe(false)
    })

    it('limite la lecture personnelle au CRA de l’intervenant', async () => {
      request.intervenorId = ownIntervenorId
      request.permissions = ['cra:read:own']

      const result = await listHandler(event)

      expect(result.data.pagination.total).toBe(1)
      expect(result.data.items).toHaveLength(1)
      expect(result.data.items[0]).toMatchObject({
        id: ownReportId,
        totalDays: 1,
        totalHours: 7,
      })

      expect(result.data.items[0]).not.toHaveProperty('days')
    })

    it('exclut les projets confidentiels sans permission spécifique', async () => {
      request.permissions = ['cra:read:all']

      const result = await listHandler(event)

      expect(result.data.pagination.total).toBe(1)
      expect(result.data.items).toHaveLength(1)
      expect(result.data.items[0]!.id).toBe(ownReportId)
    })

    it('renvoie une liste vide pour un intervenant sans CRA', async () => {
      request.intervenorId = 'intervenor-without-reports'
      request.permissions = ['cra:read:own']

      const result = await listHandler(event)

      expect(result.data.items).toEqual([])
      expect(result.data.pagination.total).toBe(0)
    })

    it('refuse la consultation sans permission', async () => {
      request.permissions = []

      await expect(listHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('refuse une page dépassant 50 résultats', async () => {
      request.query = { pageSize: '51' }

      await expect(listHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('refuse un numéro de page négatif', async () => {
      request.query = { page: '-1' }

      await expect(listHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      })
    })
  },
)