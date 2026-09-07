import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'
export default defineEventHandler(async (event) => { const context = await requirePermission(event, PERMISSIONS.HR_READ); return success(await prisma.hrProfile.findMany({ where: { associationId: context.associationId }, orderBy: { createdAt: 'desc' }, include: { absences: { orderBy: { startDate: 'desc' } }, trainings: { orderBy: { createdAt: 'desc' } }, reviews: { orderBy: { reviewDate: 'desc' } } } })) })
