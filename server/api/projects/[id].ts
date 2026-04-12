import { createError, getRouterParam } from 'h3'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Project id manquant',
    })
  }

  const project = await prisma.project.findFirst({
    where: {
      id,
      archivedAt: null,
    },
    include: {
      projectClients: {
        include: {
          client: true,
        },
      },
      projectIntervenors: {
        include: {
          intervenor: true,
        },
      },
    },
  })

  if (!project) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Projet introuvable',
    })
  }

  return project
})