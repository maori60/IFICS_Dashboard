import { readBody } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { httpError, prismaErrorCode, success } from '../../../utils/api'
import { prisma } from '../../../utils/prisma'
import { HR_CONTRACT_TYPES } from '../../../utils/contracts'
import { optionalString, requiredEnum, requiredString, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.SETTINGS_MANAGE)
  const body = safeObject(await readBody(event))
  const id = optionalString(body.id, 'Modèle', { max: 191 })
  const contractType = requiredEnum(body.contractType, HR_CONTRACT_TYPES, 'Type de contrat')
  const name = requiredString(body.name, 'Nom', { max: 180 })
  const content = requiredString(body.content, 'Contenu', { max: 100_000 })
  const active = body.active !== false
  const isDefault = body.isDefault === true

  let template

  try {
    template = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.contractTemplate.updateMany({
          where: {
            associationId: context.associationId,
            contractType,
            isDefault: true,
            ...(id ? { id: { not: id } } : {}),
          },
          data: { isDefault: false },
        })
      }

      if (id) {
        const existing = await tx.contractTemplate.findFirst({
          where: { id, associationId: context.associationId },
          select: { id: true, version: true },
        })

        if (!existing) {
          httpError(
            404,
            'Modèle de contrat introuvable.',
            'CONTRACT_TEMPLATE_NOT_FOUND',
          )
        }

        return tx.contractTemplate.update({
          where: { id },
          data: {
            contractType,
            name,
            content,
            active,
            isDefault,
            version: { increment: 1 },
          },
        })
      }

      return tx.contractTemplate.create({
        data: {
          associationId: context.associationId,
          contractType,
          name,
          content,
          active,
          isDefault,
          version: 1,
        },
      })
    })
  }
  catch (error) {
    if (prismaErrorCode(error) === 'P2002') {
      httpError(
        409,
        'Un modèle de contrat portant ce nom existe déjà pour ce type.',
        'CONTRACT_TEMPLATE_DUPLICATE',
      )
    }

    throw error
  }

  await writeAuditLog(event, context, {
    action: id ? 'CONTRACT_TEMPLATE_UPDATED' : 'CONTRACT_TEMPLATE_CREATED',
    entityType: 'ContractTemplate',
    entityId: template.id,
    metadata: {
      contractType,
      name,
      version: template.version,
      active,
      isDefault,
    },
  })

  return success(template)
})
