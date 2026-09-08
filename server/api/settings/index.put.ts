import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'
import {
  normalizeBic,
  normalizeIban,
  normalizeSiret,
  optionalEmail,
  optionalHexColor,
  optionalInteger,
  optionalString,
  requiredString,
  safeObject,
} from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.SETTINGS_MANAGE)
  const body = safeObject(await readBody(event))

  const associationData = {
    name: requiredString(body.name, 'Nom', { max: 150 }),
    legalName: optionalString(body.legalName, 'Raison sociale', { max: 255 }),
    logoUrl: optionalString(body.logoUrl, 'Logo', { max: 500 }),
    primaryColor: optionalHexColor(body.primaryColor, 'Couleur principale'),
    secondaryColor: optionalHexColor(body.secondaryColor, 'Couleur secondaire'),
    legalNotice: optionalString(body.legalNotice, 'Mentions légales'),
    billingName: optionalString(body.billingName, 'Nom de facturation', { max: 255 }),
    billingAddress: optionalString(body.billingAddress, 'Adresse de facturation', { max: 255 }),
    billingPostalCode: optionalString(body.billingPostalCode, 'Code postal', { max: 20 }),
    billingCity: optionalString(body.billingCity, 'Ville', { max: 120 }),
    billingCountry: optionalString(body.billingCountry, 'Pays', { max: 100 }),
    billingEmail: optionalEmail(body.billingEmail, 'Email de facturation'),
    billingPhone: optionalString(body.billingPhone, 'Téléphone', { max: 30 }),
    siret: normalizeSiret(body.siret),
    pdfFooter: optionalString(body.pdfFooter, 'Pied de page PDF'),
    timezone: optionalString(body.timezone, 'Fuseau horaire', { max: 100 }) || 'Europe/Paris',
    locale: optionalString(body.locale, 'Locale', { max: 20 }) || 'fr-FR',
    currency: (optionalString(body.currency, 'Devise', { max: 3 }) || 'EUR').toUpperCase(),
  }

  const financeData = {
    legalForm: optionalString(body.legalForm, 'Forme juridique', { max: 100 }),
    rnaNumber: optionalString(body.rnaNumber, 'Numéro RNA', { max: 40 }),
    vatNumber: optionalString(body.vatNumber, 'Numéro de TVA', { max: 40 }),
    bankName: optionalString(body.bankName, 'Banque', { max: 150 }),
    bankAccountHolder: optionalString(body.bankAccountHolder, 'Titulaire du compte', { max: 200 }),
    iban: normalizeIban(body.iban),
    bic: normalizeBic(body.bic),
    paymentTerms: optionalString(body.paymentTerms, 'Conditions de règlement'),
    taxExemptionText: optionalString(body.taxExemptionText, 'Mention de TVA'),
    maxAssetDocuments: optionalInteger(body.maxAssetDocuments, 'Nombre maximal de documents par matériel', { min: 1, max: 100 }) ?? 20,
    maxAssetDocumentMb: optionalInteger(body.maxAssetDocumentMb, 'Taille maximale des documents matériels', { min: 1, max: 50 }) ?? 10,
  }

  const [association, finance] = await prisma.$transaction([
    prisma.association.update({ where: { id: context.associationId }, data: associationData }),
    prisma.associationFinanceSettings.upsert({
      where: { associationId: context.associationId },
      create: { associationId: context.associationId, ...financeData },
      update: financeData,
    }),
  ])

  await writeAuditLog(event, context, {
    action: 'ASSOCIATION_SETTINGS_UPDATED',
    entityType: 'Association',
    entityId: context.associationId,
    metadata: {
      legalIdentityUpdated: true,
      bankingConfigurationUpdated: true,
      documentLimitsUpdated: true,
    },
  })

  return success({ ...association, finance })
})