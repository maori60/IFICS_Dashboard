import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'
import { optionalEmail, optionalHexColor, optionalString, requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.SETTINGS_MANAGE)
  const body = safeObject(await readBody(event))
  const updated = await prisma.association.update({
    where: { id: context.associationId },
    data: {
      name: requiredString(body.name, 'Nom', { max: 150 }), legalName: optionalString(body.legalName, 'Raison sociale', { max: 255 }),
      logoUrl: optionalString(body.logoUrl, 'Logo', { max: 500 }), primaryColor: optionalHexColor(body.primaryColor, 'Couleur principale'), secondaryColor: optionalHexColor(body.secondaryColor, 'Couleur secondaire'),
      legalNotice: optionalString(body.legalNotice, 'Mentions légales'), billingName: optionalString(body.billingName, 'Nom de facturation', { max: 255 }),
      billingAddress: optionalString(body.billingAddress, 'Adresse de facturation', { max: 255 }), billingPostalCode: optionalString(body.billingPostalCode, 'Code postal', { max: 20 }),
      billingCity: optionalString(body.billingCity, 'Ville', { max: 120 }), billingCountry: optionalString(body.billingCountry, 'Pays', { max: 100 }),
      billingEmail: optionalEmail(body.billingEmail, 'Email de facturation'), billingPhone: optionalString(body.billingPhone, 'Téléphone', { max: 30 }),
      siret: optionalString(body.siret, 'SIRET', { max: 30 }), pdfFooter: optionalString(body.pdfFooter, 'Pied de page PDF'),
      timezone: optionalString(body.timezone, 'Fuseau horaire', { max: 100 }) || 'Europe/Paris', locale: optionalString(body.locale, 'Locale', { max: 20 }) || 'fr-FR', currency: (optionalString(body.currency, 'Devise', { max: 3 }) || 'EUR').toUpperCase(),
    },
  })
  await writeAuditLog(event, context, { action: 'ASSOCIATION_SETTINGS_UPDATED', entityType: 'Association', entityId: context.associationId })
  return success(updated)
})
