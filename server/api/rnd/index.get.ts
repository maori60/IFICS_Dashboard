import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { jsonSafe, success } from '../../utils/api'
export default defineEventHandler(async (event) => { const context = await requirePermission(event, PERMISSIONS.RND_READ); return success(jsonSafe(await prisma.rndProject.findMany({ where: { associationId: context.associationId }, orderBy: { updatedAt: 'desc' } }))) })
