import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'
import { optionalMoney, optionalString, requiredEnum, requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'
const STATUSES = ['IDEA', 'EXPLORATION', 'PROTOTYPE', 'PILOT', 'ACTIVE', 'ARCHIVED'] as const
export default defineEventHandler(async (event) => { const context = await requirePermission(event, PERMISSIONS.RND_WRITE); const body = safeObject(await readBody(event)); const item = await prisma.rndProject.create({ data: { associationId: context.associationId, title: requiredString(body.title, 'Titre', { max: 255 }), description: optionalString(body.description, 'Description'), ownerUserId: optionalString(body.ownerUserId, 'Responsable', { max: 191 }) || context.userId, status: requiredEnum(body.status ?? 'IDEA', STATUSES, 'Statut'), budget: optionalMoney(body.budget, 'Budget'), repoUrl: optionalString(body.repoUrl, 'Dépôt', { max: 500 }), documentationUrl: optionalString(body.documentationUrl, 'Documentation', { max: 500 }), testResults: optionalString(body.testResults, 'Résultats'), publicEnabled: body.publicEnabled === true } }); await writeAuditLog(event, context, { action: 'RND_PROJECT_CREATED', entityType: 'RndProject', entityId: item.id }); return success(item) })
