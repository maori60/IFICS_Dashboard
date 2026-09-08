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

  const review = await prisma.hrReview.create({ data: {
    profileId,
    reviewerUserId: context.userId,
    reviewDate: optionalDate(body.reviewDate, 'Date d’évaluation') || new Date(),
    summary: requiredString(body.summary, 'Synthèse', { max: 20000 }),
    objectives: optionalString(body.objectives, 'Objectifs', { max: 20000 }),
  } })
  await writeAuditLog(event, context, { action: 'HR_REVIEW_CREATED', entityType: 'HrReview', entityId: review.id, metadata: { profileId } })
  return success(review)
})
