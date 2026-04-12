import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const project = await prisma.project.create({
    data: {
      associationId: body.associationId,
      title: body.title,
      description: body.description || null,
      status: body.status || 'DRAFT',
      projectClients: {
        create: [
          {
            clientId: body.clientId,
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