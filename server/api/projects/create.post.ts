import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.clientId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Client is required.',
    })
  }

  if (!body.title || !String(body.title).trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Project title is required.',
    })
  }

  const client = await prisma.client.findUnique({
    where: { id: body.clientId },
    select: {
      id: true,
      associationId: true,
    },
  })

  if (!client) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Selected client not found.',
    })
  }

  const project = await prisma.project.create({
    data: {
      associationId: client.associationId,
      title: String(body.title).trim(),
      description: body.description?.trim() || null,
      status: body.status || 'DRAFT',
      projectClients: {
        create: [
          {
            clientId: client.id,
            isMainClient: true,
          },
        ],
      },
    },
    include: {
      projectClients: {
        include: {
          client: true,
        },
      },
    },
  })

  return {
    ok: true,
    data: project,
  }
})