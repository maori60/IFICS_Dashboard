import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../server/utils/prisma'

const request = vi.hoisted(() => ({
  associationId: '',
  userId: '',
  mfaVerified: true,
  roleCode: 'ADMIN',
  entity: 'partner',
  id: '',
  body: {} as Record<string, unknown>,
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    readBody: async () => request.body,
    getRouterParam: (_event: unknown, name: string) => name === 'entity' ? request.entity : request.id,
    getRequestHeader: () => undefined,
  }
})

vi.mock('../../server/utils/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/utils/auth')>()
  return {
    ...actual,
    requireAuth: async () => ({
      sessionId: 'permanent-delete-test',
      userId: request.userId,
      associationId: request.associationId,
      clientId: null,
      intervenorId: null,
      email: 'delete@example.invalid',
      firstName: 'Delete',
      lastName: 'Admin',
      roleCode: request.roleCode,
      roleName: 'Administrateur',
      permissions: ['*'],
      mfaEnabled: true,
      mfaVerified: request.mfaVerified,
      mfaSetupRequired: false,
    }),
    getIpHash: () => null,
  }
})

describe.skipIf(process.env.ENTITY_DELETE_INTEGRATION_TESTS !== '1')(
  'Suppression définitive encadrée',
  () => {
    const token = `${Date.now()}-${process.pid}`
    const associationId = `delete-${token}`
    let handler: typeof import('../../server/api/admin/delete/[entity]/[id].delete')['default']

    beforeAll(async () => {
      vi.stubGlobal('defineEventHandler', (candidate: unknown) => candidate)
      handler = (await import('../../server/api/admin/delete/[entity]/[id].delete')).default

      const association = await prisma.association.create({
        data: { id: associationId, name: 'IFICS Delete Test' },
      })
      const role = await prisma.role.create({
        data: {
          associationId,
          name: `Delete admin ${token}`,
          code: `DELETE_ADMIN_${token}`,
          permissions: ['*'],
        },
      })
      const user = await prisma.user.create({
        data: {
          associationId,
          roleId: role.id,
          firstName: 'Delete',
          lastName: 'Admin',
          email: `delete-${token}@example.invalid`,
          passwordHash: 'not-used',
        },
      })

      request.associationId = association.id
      request.userId = user.id
    })

    beforeEach(() => {
      request.mfaVerified = true
      request.roleCode = 'ADMIN'
      request.entity = 'partner'
      request.id = 'missing'
      request.body = { confirmation: 'SUPPRIMER' }
    })

    afterAll(async () => {
      await prisma.auditLog.deleteMany({ where: { associationId } })
      await prisma.partner.deleteMany({ where: { associationId } })
      await prisma.client.deleteMany({ where: { associationId } })
      await prisma.cmsEntry.deleteMany({ where: { associationId } })
      await prisma.user.deleteMany({ where: { associationId } })
      await prisma.role.deleteMany({ where: { associationId } })
      await prisma.association.deleteMany({ where: { id: associationId } })
    })

    it('exige le mot de confirmation exact', async () => {
      request.body = { confirmation: 'supprimer' }
      await expect(
        handler({ context: { requestId: 'delete-confirmation' } } as never),
      ).rejects.toMatchObject({
        statusCode: 400,
        data: { code: 'PERMANENT_DELETE_CONFIRMATION_REQUIRED' },
      })
    })

    it('exige un administrateur avec MFA validé', async () => {
      request.mfaVerified = false
      await expect(
        handler({ context: { requestId: 'delete-mfa' } } as never),
      ).rejects.toMatchObject({
        statusCode: 403,
        data: { code: 'PERMANENT_DELETE_MFA_REQUIRED' },
      })

      request.mfaVerified = true
      request.roleCode = 'MANAGER'
      await expect(
        handler({ context: { requestId: 'delete-admin' } } as never),
      ).rejects.toMatchObject({
        statusCode: 403,
        data: { code: 'PERMANENT_DELETE_ADMIN_REQUIRED' },
      })
    })

    it('supprime réellement un partenaire de test avec ses données CRM secondaires', async () => {
      const partner = await prisma.partner.create({
        data: {
          associationId,
          name: `Partenaire test ${token}`,
          type: 'TECHNICAL',
          contacts: {
            create: {
              firstName: 'Test',
              lastName: 'Contact',
            },
          },
          interactions: {
            create: {
              kind: 'MEETING',
              summary: 'Interaction de test',
            },
          },
        },
      })

      request.entity = 'partner'
      request.id = partner.id

      const response = await handler({ context: { requestId: 'delete-partner' } } as never)
      expect(response.data.deleted).toBe(true)
      expect(await prisma.partner.findUnique({ where: { id: partner.id } })).toBeNull()
      expect(await prisma.partnerContact.count({ where: { partnerId: partner.id } })).toBe(0)
      expect(await prisma.partnerInteraction.count({ where: { partnerId: partner.id } })).toBe(0)
    })

    it('supprime un client isolé mais bloque un client déjà utilisé', async () => {
      const isolated = await prisma.client.create({
        data: {
          associationId,
          type: 'AUTRE',
          name: `Client isolé ${token}`,
          addressLine1: '1 rue Test',
          postalCode: '60200',
          city: 'Compiègne',
          country: 'France',
        },
      })

      request.entity = 'client'
      request.id = isolated.id
      await expect(
        handler({ context: { requestId: 'delete-client-isolated' } } as never),
      ).resolves.toMatchObject({ data: { deleted: true } })

      const used = await prisma.client.create({
        data: {
          associationId,
          type: 'AUTRE',
          name: `Client utilisé ${token}`,
          addressLine1: '2 rue Test',
          postalCode: '60200',
          city: 'Compiègne',
          country: 'France',
        },
      })
      const project = await prisma.project.create({
        data: {
          associationId,
          title: `Projet client ${token}`,
          projectClients: { create: { clientId: used.id, isMainClient: true } },
        },
      })

      request.id = used.id
      await expect(
        handler({ context: { requestId: 'delete-client-blocked' } } as never),
      ).rejects.toMatchObject({
        statusCode: 409,
        data: { code: 'PERMANENT_DELETE_BLOCKED' },
      })

      await prisma.project.delete({ where: { id: project.id } })
      await prisma.client.delete({ where: { id: used.id } })
    })

    it('refuse de supprimer définitivement un contenu déjà publié', async () => {
      const entry = await prisma.cmsEntry.create({
        data: {
          associationId,
          kind: 'NEWS',
          slug: `published-${token}`,
          titleFr: 'Publication test',
          bodyFr: 'Contenu',
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      })

      request.entity = 'content'
      request.id = entry.id

      await expect(
        handler({ context: { requestId: 'delete-published-content' } } as never),
      ).rejects.toMatchObject({
        statusCode: 409,
        data: { code: 'PERMANENT_DELETE_BLOCKED' },
      })
    })
  },
)
