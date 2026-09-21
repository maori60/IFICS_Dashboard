import { httpError } from '../../utils/api'
import {
  setCraClientNoStoreHeaders,
} from '../../utils/cra-client-access'

export default defineEventHandler(async (event) => {
  setCraClientNoStoreHeaders(event)

  httpError(
    410,
    'La confirmation simple du CRA a été remplacée par la décision client sécurisée.',
    'CRA_CLIENT_CONFIRMATION_REPLACED',
  )
})
