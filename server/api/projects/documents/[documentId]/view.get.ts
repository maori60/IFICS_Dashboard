import { createError, getRouterParam, setHeader } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  const documentId = getRouterParam(event, 'documentId')

  if (!documentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Document manquant.',
    })
  }

  const document = await prisma.intervenorDocument.findFirst({
    where: {
      id: documentId,
    },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      filePath: true,
    },
  })

  if (!document) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Document introuvable.',
    })
  }

  const absoluteFilePath = join(process.cwd(), document.filePath)

  try {
    await access(absoluteFilePath, constants.R_OK)
  } catch {
    throw createError({
      statusCode: 404,
      statusMessage: 'Fichier introuvable sur le disque.',
    })
  }

  const fileBuffer = await readFile(absoluteFilePath)

  setHeader(event, 'Content-Type', document.mimeType || 'application/pdf')
  setHeader(
    event,
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(document.originalName)}"`,
  )
  setHeader(event, 'Cache-Control', 'no-store')

  return fileBuffer
})