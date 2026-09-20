import { requirePermission } from '../../utils/auth'
import { success } from '../../utils/api'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(
    event,
    PERMISSIONS.SETTINGS_MANAGE,
  )

  const settings = await prisma.associationFinanceSettings.findUnique({
    where: {
      associationId: context.associationId,
    },
    select: {
      craSignatureFilePath: true,
      craSignatureOriginalName: true,
      craSignatureMimeType: true,
      craSignatureFileSize: true,
      craSignatureSha256: true,
      craSignatureUpdatedAt: true,
    },
  })

  if (!settings?.craSignatureFilePath) {
    return success({
      configured: false,
    })
  }

  return success({
    configured: true,
    originalName: settings.craSignatureOriginalName,
    mimeType: settings.craSignatureMimeType,
    fileSize: settings.craSignatureFileSize?.toString() ?? null,
    sha256: settings.craSignatureSha256,
    updatedAt: settings.craSignatureUpdatedAt,
  })
})
