import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'
export default defineEventHandler(async (event) => { const context = await requirePermission(event, PERMISSIONS.IT_READ); return success(await prisma.asset.findMany({ where: { associationId: context.associationId }, orderBy: [{ status: 'asc' }, { inventoryTag: 'asc' }] })) })
