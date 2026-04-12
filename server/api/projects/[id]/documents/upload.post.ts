import { createError, getRouterParam, readMultipartFormData } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { randomUUID } from 'node:crypto'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_ACTIVE_FILES_PER_PROJECT = 5

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')

  if (!projectId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Project id manquant',
    })
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      archivedAt: null,
    },
    select: {
      id: true,
    },
  })

  if (!project) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Projet introuvable',
    })
  }

  const existingDocumentsCount = await prisma.projectDocument.count({
    where: {
      projectId,
      archivedAt: null,
    },
  })

  if (existingDocumentsCount >= MAX_ACTIVE_FILES_PER_PROJECT) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Limite de 5 fichiers atteinte pour ce projet',
    })
  }

  const formData = await readMultipartFormData(event)

  if (!formData || !formData.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Aucune donnée reçue',
    })
  }

  const filePart = formData.find((part) => part.name === 'file')
  const titlePart = formData.find((part) => part.name === 'title')
  const typePart = formData.find((part) => part.name === 'type')
  const visibilityPart = formData.find((part) => part.name === 'visibility')
  const uploadedByUserIdPart = formData.find((part) => part.name === 'uploadedByUserId')

  if (!filePart || !filePart.filename || !filePart.data) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Fichier manquant',
    })
  }

  const mimeType = filePart.type || 'application/octet-stream'
  const originalName = filePart.filename
  const fileBuffer = filePart.data

  if (mimeType !== 'application/pdf') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Seuls les fichiers PDF sont autorisés',
    })
  }

  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Le fichier dépasse la taille maximale de 10 Mo',
    })
  }

  const safeExtension = extname(originalName).toLowerCase() || '.pdf'
  const storedName = `${randomUUID()}${safeExtension}`

  const uploadDirectory = join(process.cwd(), 'uploads', 'projects', projectId)
  await mkdir(uploadDirectory, { recursive: true })

  const absoluteFilePath = join(uploadDirectory, storedName)
  await writeFile(absoluteFilePath, fileBuffer)

  const relativeFilePath = join('uploads', 'projects', projectId, storedName)

  const document = await prisma.projectDocument.create({
    data: {
      projectId,
      uploadedByUserId: uploadedByUserIdPart?.data?.toString() || null,
      type: (typePart?.data?.toString() as any) || 'OTHER',
      visibility: (visibilityPart?.data?.toString() as any) || 'ADMIN_ONLY',
      title: titlePart?.data?.toString() || null,
      originalName,
      storedName,
      filePath: relativeFilePath,
      mimeType,
      fileSize: fileBuffer.length,
    },
  })

  return {
    ok: true,
    message: 'Document ajouté avec succès',
    data: document,
  }
})