import { createError, getRouterParam, setHeader } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join, isAbsolute } from 'node:path'

export default defineEventHandler(async (event) => {
  const documentId = getRouterParam(event, 'documentId')

  if (!documentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Document id manquant',
    })
  }

  const document = await prisma.projectDocument.findFirst({
    where: {
      id: documentId,
      archivedAt: null,
    },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      filePath: true,
      visibility: true,
    },
  })

  if (!document) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Document introuvable',
    })
  }

  const absoluteFilePath = isAbsolute(document.filePath)
    ? document.filePath
    : join(process.cwd(), document.filePath)

  console.log('--- PDF DEBUG ---')
  console.log('documentId:', documentId)
  console.log('document.filePath:', document.filePath)
  console.log('process.cwd():', process.cwd())
  console.log('absoluteFilePath:', absoluteFilePath)
  console.log('-----------------')

  try {
    await access(absoluteFilePath, constants.R_OK)
  } catch (error) {
    console.error('ACCESS ERROR:', error)

    throw createError({
      statusCode: 404,
      statusMessage: 'Fichier introuvable sur le disque',
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