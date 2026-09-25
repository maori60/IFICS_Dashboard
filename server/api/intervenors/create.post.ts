import { readBody } from 'h3'
import { hasPermission, requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, prismaErrorCode, success } from '../../utils/api'
import { normalizeBic, normalizeIban, normalizeSiret, optionalString, requiredEmail, requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.INTERVENOR_WRITE)
  const body = safeObject(await readBody(event))
  const userId = optionalString(body.userId, 'Compte utilisateur', { max: 191 })

  if (userId) {
    if (!hasPermission(context, PERMISSIONS.USER_MANAGE)) {
      httpError(
        403,
        'Vous ne pouvez pas rattacher une fiche intervenant à un compte utilisateur.',
        'INTERVENOR_USER_LINK_FORBIDDEN',
      )
    }

    const linkedUser = await prisma.user.findFirst({
      where: {
        id: userId,
        associationId: context.associationId,
      },
      select: {
        id: true,
        role: {
          select: {
            code: true,
          },
        },
        intervenorProfile: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!linkedUser) {
      httpError(
        404,
        'Compte utilisateur introuvable.',
        'USER_NOT_FOUND',
      )
    }

    if (linkedUser.role.code === 'CLIENT') {
      httpError(
        400,
        'Un compte client ne peut pas être rattaché à une fiche intervenant.',
        'CLIENT_INTERVENOR_CONFLICT',
      )
    }

    if (linkedUser.intervenorProfile) {
      httpError(
        409,
        'Ce compte utilisateur possède déjà une fiche intervenant.',
        'USER_ALREADY_INTERVENOR',
      )
    }
  }

  try {
    const intervenor = await prisma.intervenor.create({
      data: {
        associationId: context.associationId,
        userId,
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
      action: 'INTERVENOR_CREATED',
      entityType: 'Intervenor',
      entityId: intervenor.id,
      metadata: { userId },
    })

    return success(intervenor)
  }
  catch (error) {
    if (prismaErrorCode(error) === 'P2002') {
      httpError(
        409,
        'Cet email ou ce compte utilisateur est déjà associé à un intervenant.',
        'INTERVENOR_DUPLICATE',
      )
    }
    throw error
  }
})
