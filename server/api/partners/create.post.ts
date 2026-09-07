import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'
import { optionalString, requiredEnum, requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

const TYPES = ['INSTITUTIONAL', 'COLLECTIVITY', 'COMPANY', 'PATRON', 'OPERATIONAL', 'TECHNICAL'] as const
const STAGES = ['IDENTIFIED', 'CONTACTED', 'MEETING', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PARTNER_WRITE)
  const body = safeObject(await readBody(event))
  const partner = await prisma.partner.create({ data: {
    associationId: context.associationId, name: requiredString(body.name, 'Nom', { max: 200 }), type: requiredEnum(body.type, TYPES, 'Type'),
    stage: requiredEnum(body.stage ?? 'IDENTIFIED', STAGES, 'Étape'), website: optionalString(body.website, 'Site', { max: 500 }), logoUrl: optionalString(body.logoUrl, 'Logo', { max: 500 }),
    descriptionFr: optionalString(body.descriptionFr, 'Description FR'), descriptionEn: optionalString(body.descriptionEn, 'Description EN'), publicEnabled: body.publicEnabled === true,
    notes: optionalString(body.notes, 'Notes'),
  } })
  await writeAuditLog(event, context, { action: 'PARTNER_CREATED', entityType: 'Partner', entityId: partner.id, metadata: { type: partner.type, stage: partner.stage } })
  return success(partner)
})
