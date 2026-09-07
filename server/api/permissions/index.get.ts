import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.USER_MANAGE)
  const items = Object.entries(PERMISSIONS).map(([key, value]) => ({ key, value })).filter(item => item.value !== PERMISSIONS.ALL)
  return success(items)
})
