import { createError, getRouterParam } from 'h3'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')

  if (!projectId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Project ID manquant.',
    })
  }

  try {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        archivedAt: null,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        archivedAt: true,
        projectClients: {
          select: {
            id: true,
            isMainClient: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        projectIntervenors: {
          select: {
            id: true,
            assignmentStatus: true,
            intervenor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    if (!project) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Projet introuvable.',
      })
    }

    return {
      ok: true,
      data: project,
    }
  } catch (error) {
    console.error('Erreur API projet:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la récupération du projet.',
    })
  }
})