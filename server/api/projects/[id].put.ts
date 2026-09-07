import { getRouterParam, readBody } from 'h3'
import { assertProjectAccess, requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, jsonSafe, requireRouterId, success } from '../../../utils/api'
import {
  optionalDate,
  optionalInteger,
  optionalMoney,
  optionalString,
  requiredEnum,
  requiredString,
  safeObject,
} from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'

const PROJECT_STATUSES = ['DRAFT', 'VALIDATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PROJECT_WRITE)
  const projectId = requireRouterId(getRouterParam(event, 'id'), 'Projet')
  await assertProjectAccess(context, projectId, true)

  const existing = await prisma.project.findFirst({
    where: { id: projectId, associationId: context.associationId, archivedAt: null },
    select: { id: true, status: true },
  })
  if (!existing) httpError(404, 'Projet introuvable.', 'PROJECT_NOT_FOUND')

  const body = safeObject(await readBody(event))
  const startDate = optionalDate(body.startDate, 'Date de début')
  const endDate = optionalDate(body.endDate, 'Date de fin')
  if (startDate && endDate && endDate < startDate) {
    httpError(400, 'La date de fin doit être postérieure à la date de début.', 'INVALID_DATE_RANGE')
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      reference: optionalString(body.reference, 'Référence', { max: 50 }),
      title: requiredString(body.title, 'Titre', { max: 255 }),
      description: optionalString(body.description, 'Description'),
      status: requiredEnum(body.status || existing.status, PROJECT_STATUSES, 'Statut du projet'),
      internalComments: optionalString(body.internalComments, 'Commentaires internes'),
      startDate,
      endDate,
      plannedBudget: optionalMoney(body.plannedBudget, 'Budget prévisionnel'),
      actualBudget: optionalMoney(body.actualBudget, 'Budget réel'),
      totalIntervenorCost: optionalMoney(body.totalIntervenorCost, 'Coût intervenants'),
      materialCost: optionalMoney(body.materialCost, 'Coût matériel'),
      printingCost: optionalMoney(body.printingCost, 'Coût impressions'),
      otherCost: optionalMoney(body.otherCost, 'Autres coûts'),
      estimatedNetMargin: optionalMoney(body.estimatedNetMargin, 'Marge prévisionnelle'),
      actualNetMargin: optionalMoney(body.actualNetMargin, 'Marge réelle'),
      totalSessions: optionalInteger(body.totalSessions, 'Nombre de séances', { min: 0, max: 10000 }),
      sessionUnitPrice: optionalMoney(body.sessionUnitPrice, 'Prix unitaire séance'),
    },
  })

  await writeAuditLog(event, context, {
    action: 'PROJECT_UPDATED',
    entityType: 'Project',
    entityId: projectId,
    metadata: { previousStatus: existing.status, status: project.status },
  })

  return success(jsonSafe(project))
})
