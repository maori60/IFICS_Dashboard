import type { H3Event } from 'h3'
import { getIpHash } from './auth'
import { httpError } from './api'

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function enforceRateLimit(event: H3Event, namespace: string, limit: number, windowMs: number): void {
  const now = Date.now()
  if (buckets.size > 10_000) {
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key)
  }
  const key = `${namespace}:${getIpHash(event) || 'unknown'}`
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  if (current.count >= limit) httpError(429, 'Trop de requêtes. Réessayez plus tard.', 'RATE_LIMITED')
  current.count += 1
}
