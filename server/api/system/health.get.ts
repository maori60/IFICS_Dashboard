import os from 'node:os'
import { statfs } from 'node:fs/promises'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'
import { uploadRoot } from '../../utils/files'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.AUDIT_READ)
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [database, activeSessions, failedLogins, auditFailures] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    prisma.authSession.count({ where: { revokedAt: null, expiresAt: { gt: now }, user: { associationId: context.associationId } } }),
    prisma.loginAttempt.count({ where: { success: false, createdAt: { gte: oneHourAgo } } }),
    prisma.auditLog.count({ where: { associationId: context.associationId, outcome: 'FAILURE', createdAt: { gte: oneDayAgo } } }),
  ])

  const memory = process.memoryUsage()
  let storage: { totalBytes: string; freeBytes: string; availableBytes: string } | null = null
  try {
    const fs = await statfs(uploadRoot())
    storage = {
      totalBytes: (fs.blocks * fs.bsize).toString(),
      freeBytes: (fs.bfree * fs.bsize).toString(),
      availableBytes: (fs.bavail * fs.bsize).toString(),
    }
  }
  catch {
    storage = null
  }

  return success({
    status: database ? 'ok' : 'degraded',
    checkedAt: now,
    application: {
      uptimeSeconds: Math.floor(process.uptime()),
      node: process.version,
      rssBytes: memory.rss.toString(),
      heapUsedBytes: memory.heapUsed.toString(),
      heapTotalBytes: memory.heapTotal.toString(),
    },
    host: {
      platform: os.platform(),
      release: os.release(),
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg(),
      totalMemoryBytes: os.totalmem().toString(),
      freeMemoryBytes: os.freemem().toString(),
    },
    database: { reachable: database },
    security: { activeSessions, failedLoginsLastHour: failedLogins, auditFailuresLast24h: auditFailures },
    storage,
  })
})
