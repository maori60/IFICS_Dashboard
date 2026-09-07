import { readBody } from 'h3'
import { prisma } from '../../utils/prisma'
import {
  assertLoginAllowed,
  createSession,
  getIpHash,
  recordLoginAttempt,
} from '../../utils/auth'
import { MFA_REQUIRED_ROLE_CODES, type RoleCode } from '../../utils/constants'
import { httpError, success } from '../../utils/api'
import { verifyPassword } from '../../utils/security'
import { requiredEmail, requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const body = safeObject(await readBody(event))
  const email = requiredEmail(body.email)
  const password = requiredString(body.password, 'Mot de passe', { min: 1, max: 128 })
  const ipHash = getIpHash(event)

  await assertLoginAllowed(email, ipHash)

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      associationId: true,
      passwordHash: true,
      status: true,
      accessExpiresAt: true,
      mfaEnabled: true,
      role: {
        select: { code: true },
      },
    },
  })

  const passwordValid = user ? await verifyPassword(password, user.passwordHash) : false
  const active = Boolean(
    user
    && user.status === 'ACTIVE'
    && (!user.accessExpiresAt || user.accessExpiresAt > new Date()),
  )

  if (!user || !passwordValid || !active) {
    await recordLoginAttempt(email, ipHash, false)

    if (user) {
      await writeAuditLog(event, null, {
        associationId: user.associationId,
        userId: user.id,
        action: 'AUTH_LOGIN',
        outcome: 'FAILURE',
        metadata: { reason: !passwordValid ? 'invalid_credentials' : 'inactive_or_expired' },
      })
    }

    httpError(401, 'Email ou mot de passe incorrect.', 'INVALID_CREDENTIALS')
  }

  await recordLoginAttempt(email, ipHash, true)

  const mfaRequiredForRole = MFA_REQUIRED_ROLE_CODES.has(user.role.code as RoleCode)
  const context = await createSession(event, user.id, {
    mfaVerified: !mfaRequiredForRole,
  })

  if (!mfaRequiredForRole) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })
  }

  await writeAuditLog(event, context, {
    action: 'AUTH_LOGIN',
    metadata: {
      mfaRequired: mfaRequiredForRole,
      mfaEnabled: user.mfaEnabled,
    },
  })

  return success({
    user: {
      id: context.userId,
      email: context.email,
      firstName: context.firstName,
      lastName: context.lastName,
      roleCode: context.roleCode,
      roleName: context.roleName,
    },
    mfaRequired: mfaRequiredForRole && user.mfaEnabled,
    mfaSetupRequired: mfaRequiredForRole && !user.mfaEnabled,
  })
})
