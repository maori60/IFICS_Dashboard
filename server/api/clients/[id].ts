import { getRouterParam } from 'h3'
import { assertClientAccess, requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, requireRouterId, success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.CLIENT_READ)
  const clientId = requireRouterId(getRouterParam(event, 'id'), 'Client')

  await assertClientAccess(context, clientId)

  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      associationId: context.associationId,
      archivedAt: null,
    },
    select: {
      id: true,
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
      billingAddressLine1: true,
      billingAddressLine2: true,
      billingPostalCode: true,
      billingCity: true,
      billingCountry: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      contacts: {
        orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }],
      },
      projectClients: {
        orderBy: { createdAt: 'desc' },
        select: {
          isMainClient: true,
          project: {
            select: {
              id: true,
              reference: true,
              title: true,
              status: true,
              startDate: true,
              endDate: true,
            },
          },
        },
      },
      billingDocuments: {
        orderBy: { issueDate: 'desc' },
        take: 20,
        select: {
          id: true,
          kind: true,
          number: true,
          status: true,
          issueDate: true,
          dueDate: true,
          currency: true,
          total: true,
        },
      },
    },
  })

  if (!client) {
    httpError(404, 'Client introuvable.', 'CLIENT_NOT_FOUND')
  }

  return success(client)
})
