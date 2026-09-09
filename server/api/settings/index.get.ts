import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.SETTINGS_MANAGE)
  const [association, finance] = await Promise.all([
    prisma.association.findUnique({ where: { id: context.associationId } }),
    prisma.associationFinanceSettings.findUnique({ where: { associationId: context.associationId } }),
  ])

  if (!association) httpError(404, 'Association introuvable.', 'ASSOCIATION_NOT_FOUND')

  return success({
    ...association,
    finance: finance ?? {
      legalForm: null,
      rnaNumber: null,
      vatNumber: null,
      bankName: null,
      bankAccountHolder: null,
      iban: null,
      bic: null,
      paymentTerms: null,
      taxExemptionText: null,
      logoFilePath: null,
      maxAssetDocuments: 20,
      maxAssetDocumentMb: 10,
    },
  })
})