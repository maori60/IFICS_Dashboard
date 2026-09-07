import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event, { skipMfa: true })

  const association = await prisma.association.findUnique({
    where: { id: context.associationId },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
      locale: true,
      timezone: true,
      currency: true,
    },
  })

  return success({
    user: {
      id: context.userId,
      email: context.email,
      firstName: context.firstName,
      lastName: context.lastName,
      roleCode: context.roleCode,
      roleName: context.roleName,
      permissions: context.permissions,
      clientId: context.clientId,
      intervenorId: context.intervenorId,
    },
    mfa: {
      enabled: context.mfaEnabled,
      verified: context.mfaVerified,
      setupRequired: context.mfaSetupRequired,
    },
    association,
  })
})
