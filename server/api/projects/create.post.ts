import { readBody } from 'h3'
import { hasPermission, requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, jsonSafe, success } from '../../utils/api'
import { optionalDate, optionalInteger, optionalMoney, optionalString, requiredEnum, requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

const PROJECT_STATUSES = ['DRAFT', 'VALIDATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
const PROJECT_TYPES = ['ASSOCIATIVE_ACTION', 'COMMERCIAL_SERVICE'] as const
const CLASSIFICATIONS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PROJECT_WRITE)
  const body = safeObject(await readBody(event))

  const legacyClientId
    = optionalString(body.clientId, 'Client', { max: 191 })

  const contractualClientId
    = optionalString(
      body.contractualClientId,
      'Client contractuel',
      { max: 191 },
    ) || legacyClientId

  const endClientId
    = optionalString(
      body.endClientId,
      'Client final',
      { max: 191 },
    ) || legacyClientId

  if (!contractualClientId) {
    httpError(
      400,
      'Le client contractuel est obligatoire.',
      'CONTRACTUAL_CLIENT_REQUIRED',
    )
  }

  if (!endClientId) {
    httpError(
      400,
      'Le client final est obligatoire.',
      'END_CLIENT_REQUIRED',
    )
  }

  const startDate = optionalDate(body.startDate, 'Date de début')
  const endDate = optionalDate(body.endDate, 'Date de fin')
  const classification = requiredEnum(body.classification || 'INTERNAL', CLASSIFICATIONS, 'Classification')

  if (['CONFIDENTIAL', 'RESTRICTED'].includes(classification)
    && !hasPermission(context, PERMISSIONS.PROJECT_CONFIDENTIAL_READ)) {
    httpError(403, 'Vous ne pouvez pas créer un projet classifié.', 'CLASSIFIED_PROJECT_FORBIDDEN')
  }
  if (startDate && endDate && endDate < startDate) {
    httpError(400, 'La date de fin doit être postérieure à la date de début.', 'INVALID_DATE_RANGE')
  }

  const selectedClientIds
    = [...new Set([
      contractualClientId,
      endClientId,
    ])]

  const selectedClients
    = await prisma.client.findMany({
      where: {
        id: {
          in: selectedClientIds,
        },
        associationId:
          context.associationId,
        archivedAt:
          null,
        status:
          'ACTIVE',
      },
      select: {
        id: true,
      },
    })

  if (selectedClients.length !== selectedClientIds.length) {
    httpError(
      404,
      'Un des clients sélectionnés est introuvable ou inactif.',
      'PROJECT_CLIENT_NOT_FOUND',
    )
  }

  const projectClientLinks
    = contractualClientId === endClientId
      ? [
          {
            clientId:
              endClientId,

            isMainClient:
              true,

            isContractualClient:
              true,

            isEndClient:
              true,
          },
        ]
      : [
          {
            clientId:
              contractualClientId,

            isMainClient:
              false,

            isContractualClient:
              true,

            isEndClient:
              false,
          },

          {
            clientId:
              endClientId,

            // Compatibilité temporaire avec le code historique :
            // le client principal reste le client final.
            isMainClient:
              true,

            isContractualClient:
              false,

            isEndClient:
              true,
          },
        ]

  const project = await prisma.project.create({
    data: {
      associationId: context.associationId,
      reference: optionalString(body.reference, 'Référence', { max: 50 }),
      title: requiredString(body.title, 'Titre', { max: 255 }),
      description: optionalString(body.description, 'Description'),
      type: requiredEnum(
        body.type || 'ASSOCIATIVE_ACTION',
        PROJECT_TYPES,
        'Type de projet',
      ),
      status: requiredEnum(body.status || 'DRAFT', PROJECT_STATUSES, 'Statut du projet'),
      classification,
      internalComments: optionalString(body.internalComments, 'Commentaires internes'),
      startDate, endDate,
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
      projectClients: {
        create:
          projectClientLinks,
      },
    },
    include: { projectClients: { include: { client: true } } },
  })

  await writeAuditLog(event, context, {
    action: 'PROJECT_CREATED', entityType: 'Project', entityId: project.id,
    metadata: {
      contractualClientId,
      endClientId,
      type:
        project.type,
      status:
        project.status,
      reference:
        project.reference,
      classification,
    },
  })
  return success(jsonSafe(project))
})
