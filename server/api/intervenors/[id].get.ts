import { getRouterParam } from 'h3'
import { assertIntervenorAccess, requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, jsonSafe, requireRouterId, success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.INTERVENOR_READ)
  const intervenorId = requireRouterId(getRouterParam(event, 'id'), 'Intervenant')
  await assertIntervenorAccess(context, intervenorId, false)

  const intervenor = await prisma.intervenor.findFirst({
    where: { id: intervenorId, associationId: context.associationId, archivedAt: null },
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true, specialty: true,
      status: true, siret: true, ribIban: true, ribBic: true, addressLine1: true,
      addressLine2: true, postalCode: true, city: true, country: true, notes: true,
      createdAt: true, updatedAt: true,
      user: { select: { id: true, status: true, accessExpiresAt: true, lastLoginAt: true, mfaEnabled: true } },
      projectLinks: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, assignmentStatus: true, invitedAt: true, respondedAt: true, responseComment: true,
          project: { select: { id: true, reference: true, title: true, status: true, startDate: true, endDate: true } } },
      },
      documents: {
        where: { archivedAt: null }, orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, status: true, title: true, originalName: true, fileSize: true, sha256: true, version: true, adminComment: true, createdAt: true, reviewedAt: true },
      },
      accountingDocuments: {
        where: { archivedAt: null }, orderBy: { createdAt: 'desc' },
        select: { id: true, projectId: true, type: true, status: true, title: true, periodMonth: true, periodYear: true, originalName: true, fileSize: true, sha256: true, version: true, adminComment: true, createdAt: true, reviewedAt: true },
      },
      reports: {
        orderBy: { sessionDate: 'desc' },
        select: { id: true, projectId: true, title: true, sessionDate: true, studentsCount: true, status: true, currentVersion: true, submittedAt: true, validatedAt: true, createdAt: true },
      },
    },
  })

  if (!intervenor) httpError(404, 'Intervenant introuvable.', 'INTERVENOR_NOT_FOUND')
  return success(jsonSafe(intervenor))
})
