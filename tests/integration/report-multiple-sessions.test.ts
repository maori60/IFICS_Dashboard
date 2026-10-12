import { randomUUID } from 'node:crypto'
import { defineEventHandler, type H3Event } from 'h3'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PERMISSIONS } from '../../server/utils/constants'

const request = vi.hoisted(() => ({
  associationId: '',
  userId: '',
  intervenorId: null as string | null,
  roleCode: 'ADMIN',
  permissions: [] as string[],
  body: {} as Record<string, unknown>,
}))

const audit = vi.hoisted(() => vi.fn())

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    readBody: async () => request.body,
  }
})

vi.mock('../../server/utils/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/utils/auth')>()

  return {
    ...actual,
    requirePermission: async (_event: H3Event, permission: string) => {
      if (!request.permissions.includes('*')
        && !request.permissions.includes(permission)) {
        throw Object.assign(new Error('Accès interdit'), { statusCode: 403 })
      }

      return {
        sessionId: 'multiple-sessions-test',
        userId: request.userId,
        associationId: request.associationId,
        intervenorId: request.intervenorId,
        clientId: null,
        roleCode: request.roleCode,
        roleName: request.roleCode,
        permissions: request.permissions,
        email: 'test@example.invalid',
        firstName: 'Test',
        lastName: 'IFICS',
        mfaEnabled: true,
        mfaVerified: true,
        mfaSetupRequired: false,
      }
    },
  }
})

vi.mock('../../server/utils/audit', () => ({
  writeAuditLog: audit,
}))

describe.skipIf(process.env.REPORT_INTEGRATION_TESTS !== '1')(
  'Bilans IFICS : plusieurs séances le même jour',
  () => {
    const associationId = `report-multisession-${randomUUID()}`
    const event = {} as H3Event

    let prisma: typeof import('../../server/utils/prisma')['prisma']
    let create: typeof import('../../server/api/reports/create.post')['default']

    let projectId: string
    let intervenorId: string
    let adminId: string
    let intervenorUserId: string

    function asAdmin() {
      request.roleCode = 'ADMIN'
      request.userId = adminId
      request.intervenorId = null
      request.permissions = ['*']
    }

    function asIntervenor() {
      request.roleCode = 'INTERVENOR'
      request.userId = intervenorUserId
      request.intervenorId = intervenorId
      request.permissions = [
        PERMISSIONS.REPORT_WRITE,
        PERMISSIONS.PROJECT_READ,
      ]
    }

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL || '')
      if (url.hostname !== 'db' || url.pathname !== '/ifics_test') {
        throw new Error('Tests interdits hors de ifics_test')
      }

      vi.stubGlobal('defineEventHandler', defineEventHandler)

      prisma = (await import('../../server/utils/prisma')).prisma
      create = (await import('../../server/api/reports/create.post')).default

      request.associationId = associationId

      await prisma.association.create({
        data: { id: associationId, name: 'IFICS TEST MULTISESSIONS' },
      })

      const adminRole = await prisma.role.create({
        data: {
          associationId,
          name: 'Administrateur test',
          code: 'ADMIN',
          permissions: ['*'],
        },
      })

      const intervenorRole = await prisma.role.create({
        data: {
          associationId,
          name: 'Intervenant test',
          code: 'INTERVENOR',
          permissions: [PERMISSIONS.REPORT_WRITE, PERMISSIONS.PROJECT_READ],
        },
      })

      const admin = await prisma.user.create({
        data: {
          associationId,
          roleId: adminRole.id,
          firstName: 'Admin',
          lastName: 'Test',
          email: `${randomUUID()}@example.invalid`,
          passwordHash: 'test-only',
        },
      })
      adminId = admin.id

      const intervenorUser = await prisma.user.create({
        data: {
          associationId,
          roleId: intervenorRole.id,
          firstName: 'Intervenant',
          lastName: 'Test',
          email: `${randomUUID()}@example.invalid`,
          passwordHash: 'test-only',
        },
      })
      intervenorUserId = intervenorUser.id

      const intervenor = await prisma.intervenor.create({
        data: {
          associationId,
          userId: intervenorUser.id,
          firstName: 'Intervenant',
          lastName: 'Test',
          email: `${randomUUID()}@example.invalid`,
        },
      })
      intervenorId = intervenor.id

      const project = await prisma.project.create({
        data: {
          associationId,
          title: 'Projet test séances multiples',
          status: 'IN_PROGRESS',
          classification: 'INTERNAL',
        },
      })
      projectId = project.id

      await prisma.projectIntervenor.create({
        data: { projectId, intervenorId },
      })
    })

    afterAll(async () => {
      if (request.associationId === associationId
        && associationId.startsWith('report-multisession-')
        && prisma) {
        await prisma.association.deleteMany({
          where: { id: associationId },
        })
      }

      vi.unstubAllGlobals()
      await prisma?.$disconnect()
    })

    it('autorise deux séances du même intervenant le même jour', async () => {
      asIntervenor()

      request.body = {
        projectId,
        sessionDate: '2026-10-10',
        title: 'Atelier du matin',
        startTime: '09:30',
        endTime: '12:00',
        intervenorId: 'valeur-qui-doit-etre-ignoree',
      }

      const first = await create(event)

      request.body = {
        projectId,
        sessionDate: '2026-10-10',
        title: 'Atelier de l’après-midi',
        startTime: '14:00',
        endTime: '16:00',
      }

      const second = await create(event)

      expect(first.data.id).not.toBe(second.data.id)
      expect(first.data.intervenorId).toBe(intervenorId)
      expect(second.data.intervenorId).toBe(intervenorId)
      expect(first.data.startTime).toBe('09:30')
      expect(second.data.startTime).toBe('14:00')

      expect(await prisma.projectReport.count({
        where: { projectId, intervenorId },
      })).toBe(2)
    })

    it('autorise deux bilans IFICS sans intervenant le même jour', async () => {
      asAdmin()

      request.body = {
        projectId,
        sessionDate: '2026-10-10',
        title: 'Bilan IFICS numéro 1',
      }

      const first = await create(event)

      request.body = {
        projectId,
        sessionDate: '2026-10-10',
        title: 'Bilan IFICS numéro 2',
      }

      const second = await create(event)

      expect(first.data.id).not.toBe(second.data.id)
      expect(first.data.intervenorId).toBeNull()
      expect(second.data.intervenorId).toBeNull()
      expect(first.data.startTime).toBeNull()
      expect(second.data.endTime).toBeNull()

      expect(await prisma.projectReport.count({
        where: { projectId, intervenorId: null },
      })).toBe(2)
    })

    it('refuse les horaires incohérents sans créer de bilan', async () => {
      asAdmin()

      const before = await prisma.projectReport.count({
        where: { projectId },
      })
      const auditBefore = audit.mock.calls.length

      request.body = {
        projectId,
        sessionDate: '2026-10-10',
        title: 'Séance invalide',
        startTime: '14:00',
        endTime: '12:00',
      }

      await expect(create(event)).rejects.toMatchObject({
        statusCode: 400,
      })

      expect(await prisma.projectReport.count({
        where: { projectId },
      })).toBe(before)
      expect(audit).toHaveBeenCalledTimes(auditBefore)
    })

    it('refuse la création sans permission', async () => {
      asAdmin()
      request.permissions = []

      const before = await prisma.projectReport.count({
        where: { projectId },
      })

      request.body = {
        projectId,
        sessionDate: '2026-10-10',
        title: 'Création interdite',
      }

      await expect(create(event)).rejects.toMatchObject({
        statusCode: 403,
      })

      expect(await prisma.projectReport.count({
        where: { projectId },
      })).toBe(before)
    })
  },
)
