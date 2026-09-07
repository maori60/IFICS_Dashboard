import { success } from '../utils/api'

export default defineEventHandler(() => success({
  status: 'ok',
  service: 'ifics-dashboard',
  timestamp: new Date().toISOString(),
}))
