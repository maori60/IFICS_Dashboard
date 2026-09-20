import { writeAuditLog } from '../../utils/audit'
import { requirePermission } from '../../utils/auth'
import { success } from '../../utils/api'
import { PERMISSIONS } from '../../utils/constants'
import { removeStoredFile } from '../../utils/files'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(
    event,
    PERMISSIONS.SETTINGS_MANAGE,
  )

  const current = await prisma.associationFinanceSettings.findUnique({
    where: {
      associationId: context.associationId,
    },
    select: {
      craSignatureFilePath: true,
      craSignatureOriginalName: true,
      craSignatureMimeType: true,
      craSignatureSha256: true,
    },
  })

  if (!current?.craSignatureFilePath) {
    return success({
      configured: false,
    })
  }

  await prisma.associationFinanceSettings.update({
    where: {
      associationId: context.associationId,
    },
    data: {
      craSignatureFilePath: null,
      craSignatureOriginalName: null,
      craSignatureMimeType: null,
      craSignatureFileSize: null,
      craSignatureSha256: null,
      craSignatureUpdatedByUserId: null,
      craSignatureUpdatedAt: null,
    },
  })

  try {
    await removeStoredFile(current.craSignatureFilePath)
  }
  catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'cra_signature_delete_failed',
      error: error instanceof Error ? error.message : String(error),
    }))
  }

  await writeAuditLog(event, context, {
    action: 'CRA_SIGNATURE_REMOVED',
    entityType: 'AssociationFinanceSettings',
    entityId: context.associationId,
    metadata: {
      originalName: current.craSignatureOriginalName,
      mimeType: current.craSignatureMimeType,
      sha256: current.craSignatureSha256,
    },
  })

  return success({
    configured: false,
  })
})
