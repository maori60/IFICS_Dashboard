import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { jsonSafe, success } from '../../utils/api'
export default defineEventHandler(async (event) => { const context = await requirePermission(event, PERMISSIONS.PROJECT_WRITE); return success(jsonSafe(await prisma.projectProposal.findMany({ where: { associationId: context.associationId }, orderBy: { createdAt: 'desc' } }))) })
