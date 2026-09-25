import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { success } from '../../../utils/api'
import { prisma } from '../../../utils/prisma'
import { BUILT_IN_CONTRACT_TEMPLATES, HR_CONTRACT_TYPES } from '../../../utils/contracts'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.SETTINGS_MANAGE)
  const templates = await prisma.contractTemplate.findMany({
    where: { associationId: context.associationId },
    orderBy: [{ contractType: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
  })

  return success({
    templates,
    builtIns: HR_CONTRACT_TYPES.map(contractType => ({
      contractType,
      ...BUILT_IN_CONTRACT_TEMPLATES[contractType],
    })),
  })
})
