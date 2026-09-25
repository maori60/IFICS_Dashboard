import { getRouterParam } from 'h3'

import { buildAccountingPeriodChecklist } from '../../../../utils/accounting-checklist'
import { requirePermission } from '../../../../utils/auth'
import {
  jsonSafe,
  requireRouterId,
  success,
} from '../../../../utils/api'
import { PERMISSIONS } from '../../../../utils/constants'

export default defineEventHandler(
  async (event) => {
    const context
      = await requirePermission(
        event,
        PERMISSIONS.ACCOUNTING_READ,
      )

    const periodId
      = requireRouterId(
        getRouterParam(event, 'id'),
        'Période comptable',
      )

    const checklist
      = await buildAccountingPeriodChecklist(
        context.associationId,
        periodId,
      )

    return success(
      jsonSafe(checklist),
    )
  },
)
