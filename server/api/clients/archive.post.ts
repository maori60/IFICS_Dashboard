import { createError, readBody } from 'h3'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const clientId = body?.id

  if (!clientId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Client id manquant',
    })
  }

  const existingClient = await prisma.client.findUnique({
    where: { id: clientId },
  })

  if (!existingClient) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Client introuvable',
    })
  }

  const archivedClient = await prisma.client.update({
    where: { id: clientId },
    data: {
      archivedAt: new Date(),
    },
  })

  return {
    ok: true,
    message: 'Client archivé avec succès',
    data: archivedClient,
  }
})