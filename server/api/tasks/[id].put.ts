import { getRouterParam, readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, requireRouterId, success } from '../../utils/api'
import { optionalDate, optionalEnum, optionalString, requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'
const STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const; const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const
export default defineEventHandler(async (event) => { const context = await requirePermission(event, PERMISSIONS.PROJECT_WRITE); const id = requireRouterId(getRouterParam(event, 'id'), 'Tâche'); const body = safeObject(await readBody(event)); const existing = await prisma.workTask.findFirst({ where: { id, associationId: context.associationId }, select: { id: true } }); if (!existing) httpError(404, 'Tâche introuvable.', 'TASK_NOT_FOUND'); const task = await prisma.workTask.update({ where: { id }, data: { title: requiredString(body.title, 'Titre', { max: 255 }), description: optionalString(body.description, 'Description'), status: optionalEnum(body.status, STATUSES, 'Statut') || undefined, priority: optionalEnum(body.priority, PRIORITIES, 'Priorité') || undefined, assigneeUserId: body.assigneeUserId === null ? null : optionalString(body.assigneeUserId, 'Assigné', { max: 191 }), dueDate: body.dueDate === null ? null : optionalDate(body.dueDate, 'Échéance') } }); await writeAuditLog(event, context, { action: 'TASK_UPDATED', entityType: 'WorkTask', entityId: id }); return success(task) })
