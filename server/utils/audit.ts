import { getRequestHeader, type H3Event } from 'h3'
import { prisma } from './prisma'
import { getIpHash, type AuthContext } from './auth'

type AuditInput = {
  action: string
  entityType?: string
  entityId?: string
  outcome?: 'SUCCESS' | 'FAILURE'
  metadata?: unknown
  associationId?: string
  userId?: string | null
}

const SENSITIVE_KEY_PATTERN = /(password|secret|token|authorization|cookie|recovery|iban|bic|ciphertext)/i

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[TRUNCATED]'
  }

  if (Array.isArray(value)) {
    return value.slice(0, 100).map(item => redact(item, depth + 1))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : redact(item, depth + 1),
      ]),
    )
  }

  if (typeof value === 'string' && value.length > 2_000) {
    return `${value.slice(0, 2_000)}…`
  }

  return value
}

export async function writeAuditLog(
  event: H3Event,
  context: AuthContext | null,
  input: AuditInput,
): Promise<void> {
  const associationId = input.associationId || context?.associationId

  if (!associationId) {
    return
  }

  try {
    await prisma.auditLog.create({
      data: {
        associationId,
        userId: input.userId === undefined ? context?.userId ?? null : input.userId,
        action: input.action.slice(0, 100),
        outcome: input.outcome || 'SUCCESS',
        entityType: input.entityType?.slice(0, 100) || null,
        entityId: input.entityId?.slice(0, 191) || null,
        requestId: typeof event.context.requestId === 'string'
          ? event.context.requestId.slice(0, 100)
          : null,
        ipHash: getIpHash(event),
        userAgent: getRequestHeader(event, 'user-agent')?.slice(0, 500) || null,
        metadata: input.metadata === undefined ? undefined : redact(input.metadata),
      },
    })
  }
  catch (error) {
    // Audit failures must be visible in operational logs. They do not mask the
    // original business response, but production monitoring must alert on them.
    console.error(JSON.stringify({
      level: 'error',
      event: 'audit_write_failed',
      action: input.action,
      requestId: event.context.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))
  }
}
