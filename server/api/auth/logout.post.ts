import { getAuthContext, revokeCurrentSession } from '../../utils/auth'
import { writeAuditLog } from '../../utils/audit'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await getAuthContext(event)

  if (context) {
    await writeAuditLog(event, context, { action: 'AUTH_LOGOUT' })
  }

  await revokeCurrentSession(event)
  return success({ loggedOut: true })
})
