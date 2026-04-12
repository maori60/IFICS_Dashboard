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
      status: true,
    },
  })

  return {
    ok: true,
    data: projects,
  }
})