import {
  deleteCookie,
  getCookie,
  getRequestHeader,
  getRequestIP,
  setCookie,
  type H3Event,
} from 'h3'
import { prisma } from './prisma'
import {
  LOGIN_WINDOW_MINUTES,
  MAX_LOGIN_ATTEMPTS,
  MFA_REQUIRED_ROLE_CODES,
  PERMISSIONS,
  SESSION_COOKIE_DEFAULT,
  SESSION_TTL_HOURS_DEFAULT,
  type Permission,
  type RoleCode,
} from './constants'
import { httpError } from './api'
import { createOpaqueToken, hashIp, hashToken } from './security'

export type AuthContext = {
  sessionId: string
  userId: string
  associationId: string
  clientId: string | null
  intervenorId: string | null
  email: string
  firstName: string
  lastName: string
  roleCode: string
  roleName: string
  permissions: string[]
  mfaEnabled: boolean
  mfaVerified: boolean
  mfaSetupRequired: boolean
}

const SESSION_CONTEXT_KEY = 'ificsAuth'

function sessionCookieName(): string {
  return process.env.SESSION_COOKIE_NAME?.trim() || SESSION_COOKIE_DEFAULT
}

function sessionTtlHours(): number {
  const value = Number(process.env.SESSION_TTL_HOURS || SESSION_TTL_HOURS_DEFAULT)
  return Number.isFinite(value) && value >= 1 && value <= 168
    ? Math.floor(value)
    : SESSION_TTL_HOURS_DEFAULT
}

function clientIp(event: H3Event): string | null {
  const trustProxy = process.env.TRUST_PROXY === 'true'
  return getRequestIP(event, { xForwardedFor: trustProxy }) || null
}

export function getIpHash(event: H3Event): string | null {
  return hashIp(clientIp(event))
}

export function hasPermission(context: AuthContext, permission: Permission | string): boolean {
  return context.permissions.includes(PERMISSIONS.ALL) || context.permissions.includes(permission)
}

export async function createSession(
  event: H3Event,
  userId: string,
  options: { mfaVerified?: boolean } = {},
): Promise<AuthContext> {
  const token = createOpaqueToken(32)
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + sessionTtlHours() * 60 * 60 * 1000)

  const session = await prisma.authSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      mfaVerifiedAt: options.mfaVerified ? new Date() : null,
      ipHash: getIpHash(event),
      userAgent: getRequestHeader(event, 'user-agent')?.slice(0, 500) || null,
    },
    select: { id: true },
  })

  setCookie(event, sessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionTtlHours() * 60 * 60,
  })

  const context = await loadSessionContext(event, session.id)

  if (!context) {
    throw new Error('Session created but user context could not be loaded.')
  }

  event.context[SESSION_CONTEXT_KEY] = context
  return context
}

async function loadSessionContext(event: H3Event, expectedSessionId?: string): Promise<AuthContext | null> {
  const token = getCookie(event, sessionCookieName())

  if (!token) {
    return null
  }

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      lastSeenAt: true,
      mfaVerifiedAt: true,
      user: {
        select: {
          id: true,
          associationId: true,
          clientId: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
          accessExpiresAt: true,
          mfaEnabled: true,
          role: {
            select: {
              code: true,
              name: true,
              permissions: true,
            },
          },
          intervenorProfile: {
            select: { id: true },
          },
        },
      },
    },
  })

  if (!session || (expectedSessionId && session.id !== expectedSessionId)) {
    deleteCookie(event, sessionCookieName(), { path: '/' })
    return null
  }

  const now = new Date()
  const invalid = session.revokedAt
    || session.expiresAt <= now
    || session.user.status !== 'ACTIVE'
    || (session.user.accessExpiresAt && session.user.accessExpiresAt <= now)

  if (invalid) {
    deleteCookie(event, sessionCookieName(), { path: '/' })
    return null
  }

  if (now.getTime() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await prisma.authSession.update({
      where: { id: session.id },
      data: { lastSeenAt: now },
    })
  }

  const roleCode = session.user.role.code
  const roleRequiresMfa = MFA_REQUIRED_ROLE_CODES.has(roleCode as RoleCode)

  return {
    sessionId: session.id,
    userId: session.user.id,
    associationId: session.user.associationId,
    clientId: session.user.clientId,
    intervenorId: session.user.intervenorProfile?.id ?? null,
    email: session.user.email,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    roleCode,
    roleName: session.user.role.name,
    permissions: session.user.role.permissions,
    mfaEnabled: session.user.mfaEnabled,
    mfaVerified: Boolean(session.mfaVerifiedAt),
    mfaSetupRequired: roleRequiresMfa && !session.user.mfaEnabled,
  }
}

export async function getAuthContext(event: H3Event): Promise<AuthContext | null> {
  const existing = event.context[SESSION_CONTEXT_KEY] as AuthContext | undefined

  if (existing) {
    return existing
  }

  const context = await loadSessionContext(event)

  if (context) {
    event.context[SESSION_CONTEXT_KEY] = context
  }

  return context
}

export async function requireAuth(
  event: H3Event,
  options: { skipMfa?: boolean } = {},
): Promise<AuthContext> {
  const context = await getAuthContext(event)

  if (!context) {
    httpError(401, 'Authentification requise.', 'AUTH_REQUIRED')
  }

  if (!options.skipMfa && MFA_REQUIRED_ROLE_CODES.has(context.roleCode as RoleCode)) {
    if (context.mfaSetupRequired) {
      httpError(403, 'Configuration MFA requise.', 'MFA_SETUP_REQUIRED')
    }

    if (!context.mfaVerified) {
      httpError(403, 'Validation MFA requise.', 'MFA_REQUIRED')
    }
  }

  return context
}

export async function requirePermission(
  event: H3Event,
  permission: Permission | string,
): Promise<AuthContext> {
  const context = await requireAuth(event)

  if (!hasPermission(context, permission)) {
    httpError(403, 'Vous ne disposez pas de la permission nécessaire.', 'FORBIDDEN')
  }

  return context
}

export async function revokeCurrentSession(event: H3Event): Promise<void> {
  const context = await getAuthContext(event)

  if (context) {
    await prisma.authSession.updateMany({
      where: { id: context.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  deleteCookie(event, sessionCookieName(), { path: '/' })
  delete event.context[SESSION_CONTEXT_KEY]
}

export async function revokeUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  })
}

export async function markSessionMfaVerified(sessionId: string): Promise<void> {
  await prisma.authSession.update({
    where: { id: sessionId },
    data: { mfaVerifiedAt: new Date() },
  })
}

export async function recordLoginAttempt(email: string, ipHash: string | null, success: boolean): Promise<void> {
  await prisma.loginAttempt.create({
    data: { email, ipHash, success },
  })

  if (success) {
    await prisma.loginAttempt.deleteMany({
      where: {
        email,
        createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    })
  }
}

export async function assertLoginAllowed(email: string, ipHash: string | null): Promise<void> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000)
  const failures = await prisma.loginAttempt.count({
    where: {
      success: false,
      createdAt: { gte: since },
      OR: [
        { email },
        ...(ipHash ? [{ ipHash }] : []),
      ],
    },
  })

  if (failures >= MAX_LOGIN_ATTEMPTS) {
    httpError(
      429,
      `Trop de tentatives. Réessayez dans ${LOGIN_WINDOW_MINUTES} minutes.`,
      'LOGIN_RATE_LIMITED',
    )
  }
}

export async function assertClientAccess(context: AuthContext, clientId: string, write = false): Promise<void> {
  if (hasPermission(context, write ? PERMISSIONS.CLIENT_WRITE : PERMISSIONS.CLIENT_READ)
    && !['CLIENT', 'INTERVENOR'].includes(context.roleCode)) {
    return
  }

  if (!write && context.roleCode === 'CLIENT' && context.clientId === clientId) {
    return
  }

  httpError(403, 'Accès à ce client interdit.', 'RESOURCE_FORBIDDEN')
}

export async function assertProjectAccess(context: AuthContext, projectId: string, write = false): Promise<void> {
  if (hasPermission(context, write ? PERMISSIONS.PROJECT_WRITE : PERMISSIONS.PROJECT_READ)
    && !['CLIENT', 'INTERVENOR'].includes(context.roleCode)) {
    return
  }

  if (write) {
    httpError(403, 'Modification de ce projet interdite.', 'RESOURCE_FORBIDDEN')
  }

  if (context.roleCode === 'CLIENT' && context.clientId) {
    const link = await prisma.projectClient.findFirst({
      where: { projectId, clientId: context.clientId },
      select: { id: true },
    })
    if (link) return
  }

  if (context.roleCode === 'INTERVENOR' && context.intervenorId) {
    const link = await prisma.projectIntervenor.findFirst({
      where: { projectId, intervenorId: context.intervenorId },
      select: { id: true },
    })
    if (link) return
  }

  httpError(403, 'Accès à ce projet interdit.', 'RESOURCE_FORBIDDEN')
}

export async function assertIntervenorAccess(
  context: AuthContext,
  intervenorId: string,
  write = false,
): Promise<void> {
  if (hasPermission(context, write ? PERMISSIONS.INTERVENOR_WRITE : PERMISSIONS.INTERVENOR_READ)
    && context.roleCode !== 'INTERVENOR') {
    return
  }

  if (!write && context.roleCode === 'INTERVENOR' && context.intervenorId === intervenorId) {
    return
  }

  httpError(403, 'Accès à cet intervenant interdit.', 'RESOURCE_FORBIDDEN')
}
