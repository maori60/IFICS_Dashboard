import { prisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  const clients = await prisma.client.findMany({
    where: {
      archivedAt: null,
    },
    include: {
      contacts: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return {
    ok: true,
    data: clients,
  }
})