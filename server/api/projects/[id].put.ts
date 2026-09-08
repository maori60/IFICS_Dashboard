import { getRouterParam, readBody } from 'h3'
import { assertProjectAccess, hasPermission, requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, jsonSafe, requireRouterId, success } from '../../utils/api'
import { optionalDate, optionalInteger, optionalMoney, optionalString, requiredEnum, requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

const PROJECT_STATUSES = ['DRAFT', 'VALIDATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
const CLASSIFICATIONS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PROJECT_WRITE)
  const projectId = requireRouterId(getRouterParam(event, 'id'), 'Projet')
  await assertProjectAccess(context, projectId, true)

  const existing = await prisma.project.findFirst({
    where: { id: projectId, associationId: context.associationId, archivedAt: null },
    select: {
      id: true,
      status: true,
      classification: true,
      projectClients: { where: { isMainClient: true }, take: 1, select: { id: true, clientId: true } },
    },
  })
  if (!existing) httpError(404, 'Projet introuvable.', 'PROJECT_NOT_FOUND')

  const body = safeObject(await readBody(event))
  const startDate = optionalDate(body.startDate, 'Date de début')
  const endDate = optionalDate(body.endDate, 'Date de fin')
  const classification = requiredEnum(body.classification || existing.classification, CLASSIFICATIONS, 'Classification')
  const clientId = optionalString(body.clientId, 'Client principal', { max: 191 })

  if (['CONFIDENTIAL', 'RESTRICTED'].includes(classification)
    && !hasPermission(context, PERMISSIONS.PROJECT_CONFIDENTIAL_READ)) {
    httpError(403, 'Vous ne pouvez pas classifier ce projet.', 'CLASSIFIED_PROJECT_FORBIDDEN')
  }
  if (startDate && endDate && endDate < startDate) {
    httpError(400, 'La date de fin doit être postérieure à la date de début.', 'INVALID_DATE_RANGE')
  }

  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, associationId: context.associationId, archivedAt: null, status: 'ACTIVE' },
      select: { id: true },
    })
    if (!client) httpError(404, 'Client principal introuvable.', 'CLIENT_NOT_FOUND')
  }

  const previousMainClientId = existing.projectClients[0]?.clientId || null
  const project = await prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id: projectId },
      data: {
        reference: optionalString(body.reference, 'Référence', { max: 50 }),
        title: requiredString(body.title, 'Titre', { max: 255 }),
        description: optionalString(body.description, 'Description'),
        status: requiredEnum(body.status || existing.status, PROJECT_STATUSES, 'Statut du projet'),
        classification,
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

    if (clientId && clientId !== previousMainClientId) {
      await tx.projectClient.updateMany({
        where: { projectId, isMainClient: true },
        data: { isMainClient: false },
      })

      const existingLink = await tx.projectClient.findFirst({
        where: { projectId, clientId },
        select: { id: true },
      })

      if (existingLink) {
        await tx.projectClient.update({ where: { id: existingLink.id }, data: { isMainClient: true } })
      }
      else {
        await tx.projectClient.create({ data: { projectId, clientId, isMainClient: true } })
      }
    }

    return updated
  })

  await writeAuditLog(event, context, {
    action: 'PROJECT_UPDATED',
    entityType: 'Project',
    entityId: projectId,
    metadata: {
      previousStatus: existing.status,
      status: project.status,
      previousClassification: existing.classification,
      classification,
      previousMainClientId,
      mainClientId: clientId || previousMainClientId,
    },
  })
  return success(jsonSafe(project))
})
