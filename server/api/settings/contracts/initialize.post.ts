import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { success } from '../../../utils/api'
import { prisma } from '../../../utils/prisma'
import { BUILT_IN_CONTRACT_TEMPLATES, HR_CONTRACT_TYPES } from '../../../utils/contracts'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.SETTINGS_MANAGE)

  const result = await prisma.$transaction(async (tx) => {
    let created = 0
    for (const contractType of HR_CONTRACT_TYPES) {
      const builtIn = BUILT_IN_CONTRACT_TEMPLATES[contractType]
      const existing = await tx.contractTemplate.findFirst({
        where: { associationId: context.associationId, contractType, name: builtIn.name },
        select: { id: true },
      })
      if (existing) continue
      const hasDefault = await tx.contractTemplate.count({
        where: { associationId: context.associationId, contractType, isDefault: true, active: true },
      }) > 0
      await tx.contractTemplate.create({
        data: {
          associationId: context.associationId,
          contractType,
          name: builtIn.name,
          content: builtIn.content,
          active: true,
          isDefault: !hasDefault,
          version: 1,
        },
      })
      created += 1
    }
    return { created }
  })

  await writeAuditLog(event, context, {
    action: 'CONTRACT_TEMPLATES_INITIALIZED',
    entityType: 'ContractTemplate',
    entityId: context.associationId,
    metadata: result,
  })

  return success(result)
})
