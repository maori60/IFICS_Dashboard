import { createError, readBody } from 'h3'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const projectId = String(body.projectId || '').trim()
  const intervenorId = String(body.intervenorId || '').trim()

  if (!projectId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Le projet est obligatoire.',
    })
  }

  if (!intervenorId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'L’intervenant est obligatoire.',
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
      statusMessage: 'Projet introuvable.',
    })
  }

  const intervenor = await prisma.intervenor.findFirst({
    where: {
      id: intervenorId,
      archivedAt: null,
    },
    select: {
      id: true,
    },
  })

  if (!intervenor) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Intervenant introuvable.',
    })
  }

  try {
    const link = await prisma.projectIntervenor.create({
      data: {
        projectId,
        intervenorId,
        assignmentStatus: 'PENDING',
      },
      select: {
        id: true,
        assignmentStatus: true,
        project: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        intervenor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    return {
      ok: true,
      data: link,
    }
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cet intervenant est déjà lié à ce projet.',
      })
    }

    console.error(err)

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la liaison avec le projet.',
    })
  }
})