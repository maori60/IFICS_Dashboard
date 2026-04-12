import { prisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  const projects = await prisma.project.findMany({
    where: {
      archivedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,

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

      // 🔥 IMPORTANT
      projectIntervenors: {
        select: {
          id: true,
        },
      },
    },
  })

  return {
    ok: true,
    data: projects,
  }
})