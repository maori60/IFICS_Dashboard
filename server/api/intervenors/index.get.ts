import { prisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  const intervenors = await prisma.intervenor.findMany({
    where: {
      archivedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      specialty: true,
      status: true,
      createdAt: true,
    },
  })

  return {
    ok: true,
    data: intervenors,
  }
})