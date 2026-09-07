import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.CLIENT_READ)

  const clients = await prisma.client.findMany({
    where: {
      associationId: context.associationId,
      archivedAt: null,
      ...(context.roleCode === 'CLIENT'
        ? { id: context.clientId || '__no_client__' }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      associationId: true,
      type: true,
      status: true,
      name: true,
      serviceName: true,
      email: true,
      phone1: true,
      phone2: true,
      siret: true,
      addressLine1: true,
      addressLine2: true,
      postalCode: true,
      city: true,
      country: true,
      createdAt: true,
      updatedAt: true,
      contacts: {
        orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          email: true,
          phone1: true,
          phone2: true,
          isPrimary: true,
        },
      },
      _count: {
        select: { projectClients: true },
      },
    },
  })

  return success(clients)
})
