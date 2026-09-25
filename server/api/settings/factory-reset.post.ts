import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { httpError, success } from '../../utils/api'
import { prisma } from '../../utils/prisma'
import { safeObject } from '../../utils/validation'
import { removeStoredFile } from '../../utils/files'
import { writeAuditLogStrict } from '../../utils/audit'

const CONFIRMATION = 'RESTAURER'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.SETTINGS_MANAGE)

  if (!context.mfaVerified) {
    httpError(
      403,
      'Une validation MFA est requise pour restaurer les paramètres usine.',
      'FACTORY_RESET_MFA_REQUIRED',
    )
  }

  const body = safeObject(await readBody(event))

  if (body.confirmation !== CONFIRMATION) {
    httpError(
      400,
      `Saisissez exactement ${CONFIRMATION} pour confirmer.`,
      'FACTORY_RESET_CONFIRMATION_REQUIRED',
    )
  }

  const currentFinance = await prisma.associationFinanceSettings.findUnique({
    where: { associationId: context.associationId },
    select: {
      logoFilePath: true,
      craSignatureFilePath: true,
    },
  })

  await prisma.$transaction(async (tx) => {
    await tx.association.update({
      where: { id: context.associationId },
      data: {
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null,
        pdfFooter: null,
        timezone: 'Europe/Paris',
        locale: 'fr-FR',
        currency: 'EUR',
        maintenanceEnabled: false,
        maintenanceMessage: null,
        maintenanceStartsAt: null,
        maintenanceEndsAt: null,
      },
    })

    await tx.associationFinanceSettings.upsert({
      where: { associationId: context.associationId },
      create: {
        associationId: context.associationId,
        maxAssetDocuments: 20,
        maxAssetDocumentMb: 10,
      },
      update: {
        paymentTerms: null,
        taxExemptionText: null,
        logoFilePath: null,
        craSignatureFilePath: null,
        craSignatureOriginalName: null,
        craSignatureMimeType: null,
        craSignatureFileSize: null,
        craSignatureSha256: null,
        craSignatureUpdatedByUserId: null,
        craSignatureUpdatedAt: null,
        maxAssetDocuments: 20,
        maxAssetDocumentMb: 10,
      },
    })

    await writeAuditLogStrict(
      event,
      context,
      {
        action:
          'ASSOCIATION_FACTORY_SETTINGS_RESTORED',
        entityType: 'Association',
        entityId: context.associationId,
        metadata: {
          preservedBusinessData: true,
          preservedLegalIdentity: true,
          preservedBankingIdentity: true,
          resetBranding: true,
          resetDocumentDefaults: true,
          resetLocaleAndTimezone: true,
          resetMaintenance: true,
          fileCleanupBestEffort: true,
        },
      },
      tx,
    )
  })

  const cleanupErrors: string[] = []

  for (const filePath of [
    currentFinance?.logoFilePath,
    currentFinance?.craSignatureFilePath,
  ]) {
    if (!filePath) continue

    try {
      await removeStoredFile(filePath)
    }
    catch (error) {
      cleanupErrors.push(filePath)
      console.error(JSON.stringify({
        level: 'error',
        event: 'factory_reset_file_cleanup_failed',
        associationId: context.associationId,
        filePath,
        error: error instanceof Error ? error.message : String(error),
      }))
    }
  }


  return success({
    restored: true,
    defaults: {
      timezone: 'Europe/Paris',
      locale: 'fr-FR',
      currency: 'EUR',
      maxAssetDocuments: 20,
      maxAssetDocumentMb: 10,
    },
    preserved: [
      'clients',
      'projects',
      'users',
      'intervenors',
      'cra',
      'billingDocuments',
      'billingPayments',
      'expenses',
      'documents',
      'legalIdentity',
      'bankingIdentity',
    ],
    cleanupErrors,
  })
})
