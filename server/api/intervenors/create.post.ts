import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, prismaErrorCode, success } from '../../utils/api'
import { normalizeBic, normalizeIban, normalizeSiret, optionalString, requiredEmail, requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.INTERVENOR_WRITE)
  const body = safeObject(await readBody(event))

  try {
    const intervenor = await prisma.intervenor.create({
      data: {
        associationId: context.associationId,
        firstName: requiredString(body.firstName, 'Prénom', { max: 100 }),
        lastName: requiredString(body.lastName, 'Nom', { max: 100 }),
        email: requiredEmail(body.email),
        phone: optionalString(body.phone, 'Téléphone', { max: 30 }),
        specialty: optionalString(body.specialty, 'Spécialité', { max: 150 }),
        siret: normalizeSiret(body.siret),
        ribIban: normalizeIban(body.ribIban),
        ribBic: normalizeBic(body.ribBic),
        addressLine1: optionalString(body.addressLine1, 'Adresse', { max: 255 }),
        addressLine2: optionalString(body.addressLine2, 'Complément d’adresse', { max: 255 }),
        postalCode: optionalString(body.postalCode, 'Code postal', { max: 20 }),
        city: optionalString(body.city, 'Ville', { max: 120 }),
        country: optionalString(body.country, 'Pays', { max: 100 }),
        notes: optionalString(body.notes, 'Notes'),
      },
      select: { id: true, firstName: true, lastName: true, email: true, status: true, createdAt: true },
    })

    await writeAuditLog(event, context, {
      action: 'INTERVENOR_CREATED', entityType: 'Intervenor', entityId: intervenor.id,
    })

    return success(intervenor)
  }
  catch (error) {
    if (prismaErrorCode(error) === 'P2002') {
      httpError(409, 'Un intervenant avec cet email existe déjà.', 'INTERVENOR_DUPLICATE')
    }
    throw error
  }
})
