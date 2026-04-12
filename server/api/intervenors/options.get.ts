import { prisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  const intervenors = await prisma.intervenor.findMany({
    where: {
      archivedAt: null,
    },
    orderBy: [
      { firstName: 'asc' },
      { lastName: 'asc' },
    ],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
    },
  })

  return {
    ok: true,
    data: intervenors,
  }
})