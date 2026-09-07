import { getRouterParam, readBody } from 'h3'
import { assertIntervenorAccess, requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, prismaErrorCode, requireRouterId, success } from '../../../utils/api'
import { normalizeBic, normalizeIban, normalizeSiret, optionalEnum, optionalString, requiredEmail, requiredString, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'

const STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.INTERVENOR_WRITE)
  const intervenorId = requireRouterId(getRouterParam(event, 'id'), 'Intervenant')
  await assertIntervenorAccess(context, intervenorId, true)
  const body = safeObject(await readBody(event))

  const existing = await prisma.intervenor.findFirst({
    where: { id: intervenorId, associationId: context.associationId, archivedAt: null }, select: { id: true },
  })
  if (!existing) httpError(404, 'Intervenant introuvable.', 'INTERVENOR_NOT_FOUND')

  try {
    const intervenor = await prisma.intervenor.update({
      where: { id: intervenorId },
      data: {
        firstName: requiredString(body.firstName, 'Prénom', { max: 100 }),
        lastName: requiredString(body.lastName, 'Nom', { max: 100 }),
        email: requiredEmail(body.email),
        phone: optionalString(body.phone, 'Téléphone', { max: 30 }),
        specialty: optionalString(body.specialty, 'Spécialité', { max: 150 }),
        status: optionalEnum(body.status, STATUSES, 'Statut') || 'ACTIVE',
        siret: normalizeSiret(body.siret), ribIban: normalizeIban(body.ribIban), ribBic: normalizeBic(body.ribBic),
        addressLine1: optionalString(body.addressLine1, 'Adresse', { max: 255 }),
        addressLine2: optionalString(body.addressLine2, 'Complément d’adresse', { max: 255 }),
        postalCode: optionalString(body.postalCode, 'Code postal', { max: 20 }),
        city: optionalString(body.city, 'Ville', { max: 120 }), country: optionalString(body.country, 'Pays', { max: 100 }),
        notes: optionalString(body.notes, 'Notes'),
      },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, specialty: true, status: true, siret: true, ribIban: true, ribBic: true, addressLine1: true, addressLine2: true, postalCode: true, city: true, country: true, notes: true, updatedAt: true },
    })

    await writeAuditLog(event, context, { action: 'INTERVENOR_UPDATED', entityType: 'Intervenor', entityId: intervenorId })
    return success(intervenor)
  }
  catch (error) {
    if (prismaErrorCode(error) === 'P2002') httpError(409, 'Cet email est déjà utilisé.', 'INTERVENOR_DUPLICATE')
    throw error
  }
})
