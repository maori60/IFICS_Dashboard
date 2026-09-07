import { requireAuth, revokeUserSessions } from '../../utils/auth'
import { writeAuditLog } from '../../utils/audit'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  await revokeUserSessions(context.userId, context.sessionId)
  await writeAuditLog(event, context, { action: 'AUTH_REVOKE_OTHER_SESSIONS' })

  return success({ revoked: true })
})
