import { getRouterParam, readBody } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../utils/api'
import { optionalDate, optionalString, requiredString, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.HR_WRITE)
  const profileId = requireRouterId(getRouterParam(event, 'id'), 'Profil RH')
  const body = safeObject(await readBody(event))
  const profile = await prisma.hrProfile.findFirst({ where: { id: profileId, associationId: context.associationId }, select: { id: true } })
  if (!profile) httpError(404, 'Profil RH introuvable.', 'HR_PROFILE_NOT_FOUND')

  const training = await prisma.hrTraining.create({ data: {
    profileId,
    title: requiredString(body.title, 'Formation', { max: 255 }),
    provider: optionalString(body.provider, 'Organisme', { max: 200 }),
    completedAt: optionalDate(body.completedAt, 'Date de réalisation'),
    expiresAt: optionalDate(body.expiresAt, 'Date d’expiration'),
  } })
  await writeAuditLog(event, context, { action: 'HR_TRAINING_CREATED', entityType: 'HrTraining', entityId: training.id, metadata: { profileId } })
  return success(training)
})
