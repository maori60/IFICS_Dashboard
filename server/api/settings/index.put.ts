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
import { FINANCE_SETTINGS_CLIENT_SELECT } from '../../utils/settings'

const VAT_LIABILITY_STATUSES = [
  'NOT_CONFIGURED',
  'SUBJECT',
  'NOT_SUBJECT',
] as const

const VAT_COLLECTION_BASES = [
  'NOT_CONFIGURED',
  'DEBITS',
  'COLLECTIONS',
] as const

const VAT_FILING_FREQUENCIES = [
  'NOT_CONFIGURED',
  'MONTHLY',
  'QUARTERLY',
  'ANNUAL',
] as const

function enumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string,
): T[number] {
  if (
    typeof value !== 'string'
    || !allowed.includes(value as T[number])
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} invalide.`,
    })
  }

  return value as T[number]
}

function optionalBusinessDate(
  value: unknown,
  label: string,
): Date | null {
  if (
    value === undefined
    || value === null
    || value === ''
  ) {
    return null
  }

  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} doit être une date au format AAAA-MM-JJ.`,
    })
  }

  const date = new Date(`${value}T00:00:00.000Z`)

  if (
    Number.isNaN(date.getTime())
    || date.toISOString().slice(0, 10) !== value
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} invalide.`,
    })
  }

  return date
}

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
    vatLiabilityStatus: enumValue(
      body.vatLiabilityStatus ?? 'NOT_CONFIGURED',
      VAT_LIABILITY_STATUSES,
      'Statut TVA',
    ),
    vatCollectionBasis: enumValue(
      body.vatCollectionBasis ?? 'NOT_CONFIGURED',
      VAT_COLLECTION_BASES,
      'Exigibilité TVA',
    ),
    vatFilingFrequency: enumValue(
      body.vatFilingFrequency ?? 'NOT_CONFIGURED',
      VAT_FILING_FREQUENCIES,
      'Périodicité TVA',
    ),
    vatEffectiveFrom: optionalBusinessDate(
      body.vatEffectiveFrom,
      'Date d’effet TVA',
    ),
    maxAssetDocuments: optionalInteger(body.maxAssetDocuments, 'Nombre maximal de documents par matériel', { min: 1, max: 100 }) ?? 20,
    maxAssetDocumentMb: optionalInteger(body.maxAssetDocumentMb, 'Taille maximale des documents matériels', { min: 1, max: 50 }) ?? 10,
  }

  if (
    financeData.vatLiabilityStatus === 'SUBJECT'
    && financeData.vatCollectionBasis === 'NOT_CONFIGURED'
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Le mode d’exigibilité TVA doit être configuré lorsque la structure est assujettie.',
    })
  }

  if (
    financeData.vatLiabilityStatus === 'SUBJECT'
    && financeData.vatFilingFrequency === 'NOT_CONFIGURED'
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'La périodicité de déclaration TVA doit être configurée lorsque la structure est assujettie.',
    })
  }

  if (
    financeData.vatLiabilityStatus === 'SUBJECT'
    && !financeData.vatEffectiveFrom
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'La date d’effet TVA est obligatoire lorsque la structure est assujettie.',
    })
  }

  if (
    financeData.vatLiabilityStatus !== 'SUBJECT'
    && (
      financeData.vatCollectionBasis !== 'NOT_CONFIGURED'
      || financeData.vatFilingFrequency !== 'NOT_CONFIGURED'
      || financeData.vatEffectiveFrom !== null
    )
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Les paramètres d’exigibilité, de déclaration et de date d’effet sont réservés au statut TVA assujetti.',
    })
  }

  const [association, finance] = await prisma.$transaction([
    prisma.association.update({ where: { id: context.associationId }, data: associationData }),
    prisma.associationFinanceSettings.upsert({
      where: { associationId: context.associationId },
      create: { associationId: context.associationId, ...financeData },
      update: financeData,
      select: FINANCE_SETTINGS_CLIENT_SELECT,
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
      vatConfigurationUpdated: true,
    },
  })

  return success({ ...association, finance })
})