import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'
export default defineEventHandler(async (event) => { const context = await requirePermission(event, PERMISSIONS.PROJECT_READ); return success(await prisma.workTask.findMany({ where: { associationId: context.associationId }, orderBy: [{ status: 'asc' }, { priority: 'desc' }, { dueDate: 'asc' }] })) })
