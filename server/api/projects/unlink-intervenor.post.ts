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

  const existingLink = await prisma.projectIntervenor.findFirst({
    where: {
      projectId,
      intervenorId,
    },
    select: {
      id: true,
    },
  })

  if (!existingLink) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Aucune liaison trouvée entre ce projet et cet intervenant.',
    })
  }

  try {
    await prisma.projectIntervenor.delete({
      where: {
        id: existingLink.id,
      },
    })

    return {
      ok: true,
      message: 'Intervenant délié du projet avec succès.',
    }
  } catch (err) {
    console.error(err)

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors du retrait de l’intervenant.',
    })
  }
})