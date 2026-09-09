import { setHeader } from 'h3'
import { prisma } from '../../../utils/prisma'
import { httpError } from '../../../utils/api'
import { readStoredFile } from '../../../utils/files'

export default defineEventHandler(async (event) => {
  const settings = await prisma.associationFinanceSettings.findFirst({
    where: { logoFilePath: { not: null } },
    select: { logoFilePath: true },
    orderBy: { updatedAt: 'desc' },
  })

  if (!settings?.logoFilePath) {
    httpError(404, 'Logo non configuré.', 'LOGO_NOT_FOUND')
  }

  const file = await readStoredFile(settings.logoFilePath)
  const mimeType = settings.logoFilePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
  setHeader(event, 'Content-Type', mimeType)
  setHeader(event, 'Cache-Control', 'public, max-age=3600')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  return file
})