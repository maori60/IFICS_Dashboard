import { getRouterParam, readBody } from 'h3'
import { assertProjectAccess, hasPermission, requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, jsonSafe, requireRouterId, success } from '../../utils/api'
import { optionalDate, optionalInteger, optionalMoney, optionalString, requiredEnum, requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

const PROJECT_STATUSES = ['DRAFT', 'VALIDATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
const PROJECT_TYPES = ['ASSOCIATIVE_ACTION', 'COMMERCIAL_SERVICE'] as const
const CLASSIFICATIONS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PROJECT_WRITE)
  const projectId = requireRouterId(getRouterParam(event, 'id'), 'Projet')
  await assertProjectAccess(context, projectId, true)

  const existing = await prisma.project.findFirst({
    where: { id: projectId, associationId: context.associationId, archivedAt: null },
    select: {
      id: true,
      type: true,
      status: true,
      classification: true,
      projectClients: {
        select: {
          id: true,
          clientId: true,
          isMainClient: true,
          isContractualClient: true,
          isEndClient: true,
        },
      },
    },
  })
  if (!existing) httpError(404, 'Projet introuvable.', 'PROJECT_NOT_FOUND')

  const body = safeObject(await readBody(event))
  const startDate = optionalDate(body.startDate, 'Date de début')
  const endDate = optionalDate(body.endDate, 'Date de fin')
  const projectType = requiredEnum(
    body.type || existing.type,
    PROJECT_TYPES,
    'Type de projet',
  )

  const classification = requiredEnum(body.classification || existing.classification, CLASSIFICATIONS, 'Classification')
  const legacyClientId
    = optionalString(
      body.clientId,
      'Client',
      { max: 191 },
    )

  const previousMainClientId
    = existing.projectClients.find(
      link => link.isMainClient,
    )?.clientId
      ?? existing.projectClients[0]?.clientId
      ?? null

  const previousContractualClientId
    = existing.projectClients.find(
      link => link.isContractualClient,
    )?.clientId
      ?? previousMainClientId

  const previousEndClientId
    = existing.projectClients.find(
      link => link.isEndClient,
    )?.clientId
      ?? previousMainClientId

  const contractualClientId
    = optionalString(
      body.contractualClientId,
      'Client contractuel',
      { max: 191 },
    )
      || legacyClientId
      || previousContractualClientId

  const endClientId
    = optionalString(
      body.endClientId,
      'Client final',
      { max: 191 },
    )
      || legacyClientId
      || previousEndClientId

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

  if (['CONFIDENTIAL', 'RESTRICTED'].includes(classification)
    && !hasPermission(context, PERMISSIONS.PROJECT_CONFIDENTIAL_READ)) {
    httpError(403, 'Vous ne pouvez pas classifier ce projet.', 'CLASSIFIED_PROJECT_FORBIDDEN')
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
  const project = await prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id: projectId },
      data: {
        reference: optionalString(body.reference, 'Référence', { max: 50 }),
        title: requiredString(body.title, 'Titre', { max: 255 }),
        description: optionalString(body.description, 'Description'),
        type: projectType,
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

    /*
     * On retire d'abord les rôles métier actuels.
     *
     * Les anciens liens ProjectClient sont conservés pour
     * l'historique de rattachement, mais ne portent plus
     * aucun rôle actif.
     */
    await tx.projectClient.updateMany({
      where: {
        projectId,
      },

      data: {
        isMainClient:
          false,

        isContractualClient:
          false,

        isEndClient:
          false,
      },
    })

    const upsertProjectClientRole = async (
      clientId: string,
      role: {
        isMainClient: boolean
        isContractualClient: boolean
        isEndClient: boolean
      },
    ) => {
      const existingLink
        = await tx.projectClient.findFirst({
          where: {
            projectId,
            clientId,
          },

          select: {
            id: true,
          },
        })

      if (existingLink) {
        await tx.projectClient.update({
          where: {
            id: existingLink.id,
          },

          data: role,
        })

        return
      }

      await tx.projectClient.create({
        data: {
          projectId,
          clientId,
          ...role,
        },
      })
    }

    if (contractualClientId === endClientId) {
      await upsertProjectClientRole(
        endClientId,
        {
          isMainClient:
            true,

          isContractualClient:
            true,

          isEndClient:
            true,
        },
      )
    }
    else {
      await upsertProjectClientRole(
        contractualClientId,
        {
          isMainClient:
            false,

          isContractualClient:
            true,

          isEndClient:
            false,
        },
      )

      await upsertProjectClientRole(
        endClientId,
        {
          // Compatibilité temporaire :
          // le client principal historique reste le client final.
          isMainClient:
            true,

          isContractualClient:
            false,

          isEndClient:
            true,
        },
      )
    }

    return updated
  })

  await writeAuditLog(event, context, {
    action: 'PROJECT_UPDATED',
    entityType: 'Project',
    entityId: projectId,
    metadata: {
      previousType:
        existing.type,
      type:
        project.type,

      previousStatus:
        existing.status,
      status:
        project.status,
      previousClassification: existing.classification,
      classification,
      previousMainClientId,

      previousContractualClientId,
      contractualClientId,

      previousEndClientId,
      endClientId,

      // Compatibilité de lecture de l'ancien audit.
      mainClientId:
        endClientId,
    },
  })
  return success(jsonSafe(project))
})
