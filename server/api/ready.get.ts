import { prisma } from '../utils/prisma'
import { httpError, success } from '../utils/api'

export default defineEventHandler(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return success({ status: 'ready', database: 'reachable' })
  }
  catch {
    httpError(503, 'Service temporairement indisponible.', 'NOT_READY')
  }
})
