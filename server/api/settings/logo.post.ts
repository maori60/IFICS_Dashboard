import { readMultipartFormData } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, success } from '../../utils/api'
import { storeBrandImage } from '../../utils/files'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.SETTINGS_MANAGE)
  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file')

  if (!file?.filename || !file.data) {
    httpError(400, 'Fichier logo manquant.', 'FILE_REQUIRED')
  }

  const stored = await storeBrandImage(context.associationId, file.filename, file.data)

  await prisma.$transaction([
    prisma.associationFinanceSettings.upsert({
      where: { associationId: context.associationId },
      create: { associationId: context.associationId, logoFilePath: stored.filePath },
      update: { logoFilePath: stored.filePath },
    }),
    prisma.association.update({
      where: { id: context.associationId },
      data: { logoUrl: '/api/public/branding/logo' },
    }),
  ])

  await writeAuditLog(event, context, {
    action: 'ASSOCIATION_LOGO_UPDATED',
    entityType: 'Association',
    entityId: context.associationId,
    metadata: {
      mimeType: stored.mimeType,
      fileSize: stored.fileSize.toString(),
      sha256: stored.sha256,
    },
  })

  return success({
    logoUrl: '/api/public/branding/logo',
    mimeType: stored.mimeType,
    fileSize: stored.fileSize.toString(),
  })
})