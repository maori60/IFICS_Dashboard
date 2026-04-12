import { createError, getRouterParam } from 'h3'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')

  if (!projectId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Project ID manquant',
    })
  }

  const documents = await prisma.projectDocument.findMany({
    where: {
      projectId,
      archivedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      projectId: true,
      type: true,
      visibility: true,
      title: true,
      originalName: true,
      storedName: true,
      filePath: true,
      mimeType: true,
      fileSize: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const safeDocuments = documents.map((document) => ({
    ...document,
    fileSize: document.fileSize.toString(),
  }))

  return {
    ok: true,
    data: safeDocuments,
  }
})