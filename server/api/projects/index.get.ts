import { prisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  const projects = await prisma.project.findMany({
    where: {
      archivedAt: null,
    },
    include: {
      projectClients: {
        include: {
          client: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return {
    ok: true,
    data: projects,
  }
})