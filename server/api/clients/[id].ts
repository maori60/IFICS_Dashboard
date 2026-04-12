import { getRouterParam, createError } from 'h3'
import prisma from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Client id manquant',
    })
  }

  const client = await prisma.client.findUnique({
    where: { id },
  })

  if (!client) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Client introuvable',
    })
  }

  return client
})