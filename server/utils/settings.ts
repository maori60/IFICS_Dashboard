import type { Prisma } from '../../generated/prisma/client'

export const FINANCE_SETTINGS_CLIENT_SELECT = {
  legalForm: true,
  rnaNumber: true,
  vatNumber: true,
  bankName: true,
  bankAccountHolder: true,
  iban: true,
  bic: true,
  paymentTerms: true,
  taxExemptionText: true,
  logoFilePath: true,
  maxAssetDocuments: true,
  maxAssetDocumentMb: true,
} satisfies Prisma.AssociationFinanceSettingsSelect
