import { readMultipartFormData } from 'h3'
import { writeAuditLog } from '../../utils/audit'
import { requirePermission } from '../../utils/auth'
import { httpError, success } from '../../utils/api'
import { PERMISSIONS } from '../../utils/constants'
import {
  removeStoredFile,
  storeCraSignature,
} from '../../utils/files'
import { prisma } from '../../utils/prisma'

async function cleanupFile(filePath: string): Promise<void> {
  try {
    await removeStoredFile(filePath)
  }
  catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'cra_signature_cleanup_failed',
      error: error instanceof Error ? error.message : String(error),
    }))
  }
}

export default defineEventHandler(async (event) => {
  const context = await requirePermission(
    event,
    PERMISSIONS.SETTINGS_MANAGE,
  )

  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file')

  if (!file?.filename || !file.data) {
    httpError(
      400,
      'Fichier de signature manquant.',
      'FILE_REQUIRED',
    )
  }

  const previous = await prisma.associationFinanceSettings.findUnique({
    where: {
      associationId: context.associationId,
    },
    select: {
      craSignatureFilePath: true,
    },
  })

  const stored = await storeCraSignature(
    context.associationId,
    file.filename,
    file.data,
  )

  const updatedAt = new Date()

  try {
    await prisma.associationFinanceSettings.upsert({
      where: {
        associationId: context.associationId,
      },
      create: {
        associationId: context.associationId,
        craSignatureFilePath: stored.filePath,
        craSignatureOriginalName: stored.originalName,
        craSignatureMimeType: stored.mimeType,
        craSignatureFileSize: stored.fileSize,
        craSignatureSha256: stored.sha256,
        craSignatureUpdatedByUserId: context.userId,
        craSignatureUpdatedAt: updatedAt,
      },
      update: {
        craSignatureFilePath: stored.filePath,
        craSignatureOriginalName: stored.originalName,
        craSignatureMimeType: stored.mimeType,
        craSignatureFileSize: stored.fileSize,
        craSignatureSha256: stored.sha256,
        craSignatureUpdatedByUserId: context.userId,
        craSignatureUpdatedAt: updatedAt,
      },
    })
  }
  catch (error) {
    await cleanupFile(stored.filePath)
    throw error
  }

  if (
    previous?.craSignatureFilePath
    && previous.craSignatureFilePath !== stored.filePath
  ) {
    await cleanupFile(previous.craSignatureFilePath)
  }

  await writeAuditLog(event, context, {
    action: 'CRA_SIGNATURE_UPDATED',
    entityType: 'AssociationFinanceSettings',
    entityId: context.associationId,
    metadata: {
      originalName: stored.originalName,
      mimeType: stored.mimeType,
      fileSize: stored.fileSize.toString(),
      sha256: stored.sha256,
    },
  })

  return success({
    configured: true,
    originalName: stored.originalName,
    mimeType: stored.mimeType,
    fileSize: stored.fileSize.toString(),
    sha256: stored.sha256,
    updatedAt,
  })
})
