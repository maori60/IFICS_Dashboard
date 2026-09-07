import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { prismaErrorCode, httpError, success } from '../../utils/api'
import { optionalDate, optionalEnum, optionalString, requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'
const STATUSES = ['STOCK', 'ASSIGNED', 'MAINTENANCE', 'RETIRED', 'LOST'] as const
export default defineEventHandler(async (event) => { const context = await requirePermission(event, PERMISSIONS.IT_WRITE); const body = safeObject(await readBody(event)); try { const asset = await prisma.asset.create({ data: { associationId: context.associationId, inventoryTag: requiredString(body.inventoryTag, 'Référence', { max: 100 }), type: requiredString(body.type, 'Type', { max: 100 }), brand: optionalString(body.brand, 'Marque', { max: 100 }), model: optionalString(body.model, 'Modèle', { max: 150 }), serialNumber: optionalString(body.serialNumber, 'Numéro de série', { max: 150 }), status: optionalEnum(body.status, STATUSES, 'Statut') || 'STOCK', assignedUserId: optionalString(body.assignedUserId, 'Utilisateur', { max: 191 }), location: optionalString(body.location, 'Localisation', { max: 200 }), purchaseDate: optionalDate(body.purchaseDate, 'Achat'), warrantyUntil: optionalDate(body.warrantyUntil, 'Garantie'), notes: optionalString(body.notes, 'Notes') } }); await writeAuditLog(event, context, { action: 'ASSET_CREATED', entityType: 'Asset', entityId: asset.id }); return success(asset) } catch (error) { if (prismaErrorCode(error) === 'P2002') httpError(409, 'Cette référence de parc existe déjà.', 'ASSET_DUPLICATE'); throw error } })
