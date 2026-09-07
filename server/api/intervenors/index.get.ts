import { requirePermission } from '../../utils/auth'
import { PERMISSIONS, ROLE_CODES } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.INTERVENOR_READ)

  const intervenors = await prisma.intervenor.findMany({
    where: {
      associationId: context.associationId,
      archivedAt: null,
      ...(context.roleCode === ROLE_CODES.INTERVENOR
        ? { id: context.intervenorId || '__none__' }
        : {}),
    },
    orderBy: [{ status: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      specialty: true,
      status: true,
      siret: true,
      city: true,
      country: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, status: true, mfaEnabled: true } },
      _count: { select: { projectLinks: true, documents: true, accountingDocuments: true, reports: true } },
    },
  })

  return success(intervenors)
})
