import { createError, readBody } from 'h3'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const projectId = body?.id

  if (!projectId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Project id manquant',
    })
  }

  const existingProject = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!existingProject) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Projet introuvable',
    })
  }

  const archivedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      archivedAt: new Date(),
    },
  })

  return {
    ok: true,
    message: 'Projet archivé avec succès',
    data: archivedProject,
  }
})