import { createError, getRouterParam } from 'h3'
import { prisma } from '../../../utils/prisma'

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
    },
    select: {
      id: true,
      archivedAt: true,
    },
  })

  if (!project) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Projet introuvable',
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

  return {
    ok: true,
    data: documents,
  }
})