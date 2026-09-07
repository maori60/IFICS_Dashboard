import { getRouterParam, readBody } from 'h3'
import { assertClientAccess, requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, requireRouterId, success } from '../../utils/api'
import {
  normalizeSiret,
  optionalEmail,
  optionalString,
  requiredEnum,
  requiredString,
  safeObject,
} from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

const CLIENT_TYPES = ['MAIRIE', 'SERVICE_MUNICIPAL', 'ETABLISSEMENT_SCOLAIRE', 'ASSOCIATION', 'AUTRE'] as const
const CLIENT_STATUSES = ['ACTIVE', 'INACTIVE'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.CLIENT_WRITE)
  const clientId = requireRouterId(getRouterParam(event, 'id'), 'Client')
  await assertClientAccess(context, clientId, true)

  const existing = await prisma.client.findFirst({
    where: { id: clientId, associationId: context.associationId, archivedAt: null },
    select: { id: true },
  })
  if (!existing) httpError(404, 'Client introuvable.', 'CLIENT_NOT_FOUND')

  const body = safeObject(await readBody(event))
  const client = await prisma.client.update({
    where: { id: clientId },
    data: {
      type: requiredEnum(body.type, CLIENT_TYPES, 'Type de client'),
      status: requiredEnum(body.status || 'ACTIVE', CLIENT_STATUSES, 'Statut'),
      name: requiredString(body.name, 'Nom', { max: 150 }),
      serviceName: optionalString(body.serviceName, 'Service', { max: 150 }),
      email: optionalEmail(body.email),
      phone1: optionalString(body.phone1, 'Téléphone principal', { max: 30 }),
      phone2: optionalString(body.phone2, 'Téléphone secondaire', { max: 30 }),
      siret: normalizeSiret(body.siret),
      addressLine1: requiredString(body.addressLine1, 'Adresse', { max: 255 }),
      addressLine2: optionalString(body.addressLine2, 'Complément d’adresse', { max: 255 }),
      postalCode: requiredString(body.postalCode, 'Code postal', { max: 20 }),
      city: requiredString(body.city, 'Ville', { max: 120 }),
      country: requiredString(body.country || 'France', 'Pays', { max: 100 }),
      billingAddressLine1: optionalString(body.billingAddressLine1, 'Adresse de facturation', { max: 255 }),
      billingAddressLine2: optionalString(body.billingAddressLine2, 'Complément de facturation', { max: 255 }),
      billingPostalCode: optionalString(body.billingPostalCode, 'Code postal de facturation', { max: 20 }),
      billingCity: optionalString(body.billingCity, 'Ville de facturation', { max: 120 }),
      billingCountry: optionalString(body.billingCountry, 'Pays de facturation', { max: 100 }),
      notes: optionalString(body.notes, 'Notes'),
    },
    select: {
      id: true,
      type: true,
      status: true,
      name: true,
      serviceName: true,
      email: true,
      phone1: true,
      phone2: true,
      siret: true,
      addressLine1: true,
      addressLine2: true,
      postalCode: true,
      city: true,
      country: true,
      billingAddressLine1: true,
      billingAddressLine2: true,
      billingPostalCode: true,
      billingCity: true,
      billingCountry: true,
      notes: true,
      updatedAt: true,
    },
  })

  await writeAuditLog(event, context, {
    action: 'CLIENT_UPDATED',
    entityType: 'Client',
    entityId: clientId,
  })

  return success(client)
})
