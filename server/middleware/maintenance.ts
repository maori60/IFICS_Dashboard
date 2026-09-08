import { prisma } from '../utils/prisma'
import { getPrimaryAssociationId } from '../utils/association'

const ALWAYS_ALLOWED_PREFIXES = [
  '/_nuxt/', '/favicon.ico', '/api/health', '/api/ready', '/api/auth/', '/api/system/', '/api/internal/',
  '/login', '/mfa', '/mfa-recovery', '/activate', '/reset-password', '/mot-de-passe-oublie', '/dashboard',
]

let cache: { associationId: string; enabled: boolean; message: string | null; startsAt: Date | null; endsAt: Date | null; loadedAt: number } | null = null

export default defineEventHandler(async (event) => {
  const path = event.path || '/'
  if (ALWAYS_ALLOWED_PREFIXES.some(prefix => path.startsWith(prefix))) return

  const nowMs = Date.now()
  if (!cache || nowMs - cache.loadedAt > 5_000) {
    const associationId = await getPrimaryAssociationId()
    const association = await prisma.association.findUnique({
      where: { id: associationId },
      select: { maintenanceEnabled: true, maintenanceMessage: true, maintenanceStartsAt: true, maintenanceEndsAt: true },
    })
    cache = {
      associationId,
      enabled: association?.maintenanceEnabled || false,
      message: association?.maintenanceMessage || null,
      startsAt: association?.maintenanceStartsAt || null,
      endsAt: association?.maintenanceEndsAt || null,
      loadedAt: nowMs,
    }
  }

  const now = new Date(nowMs)
  const active = cache.enabled
    && (!cache.startsAt || cache.startsAt <= now)
    && (!cache.endsAt || cache.endsAt > now)
  if (active) {
    throw createError({
      statusCode: 503,
      statusMessage: cache.message || 'Maintenance IFICS en cours.',
      data: { code: 'MAINTENANCE_MODE' },
    })
  }
})
