import {
  getRouterParam,
  readBody,
} from 'h3'

import {
  hasPermission,
  requireAuth,
} from '../../../../utils/auth'

import {
  httpError,
  jsonSafe,
  requireRouterId,
  success,
} from '../../../../utils/api'

import { PERMISSIONS } from '../../../../utils/constants'

import {
  ACCOUNTING_PERIOD_ACTIONS,
  transitionAccountingPeriod,
} from '../../../../utils/accounting-transitions'

import {
  badRequest,
  requiredEnum,
  requiredString,
  safeObject,
} from '../../../../utils/validation'

export default defineEventHandler(
  async (event) => {
    const context
      = await requireAuth(event)

    const periodId
      = requireRouterId(
        getRouterParam(event, 'id'),
        'Période comptable',
      )

    const body
      = safeObject(
        await readBody(event),
      )

    const allowedFields = new Set([
      'action',
      'lockVersion',
      'confirmed',
      'reason',
    ])

    if (
      Object.keys(body).some(
        key =>
          !allowedFields.has(key),
      )
    ) {
      badRequest(
        'La demande contient un champ non autorisé.',
      )
    }

    const action
      = requiredEnum(
        body.action,
        ACCOUNTING_PERIOD_ACTIONS,
        'Action',
      )

    const permission
      = action === 'REOPEN'
        ? PERMISSIONS
            .ACCOUNTING_PERIOD_REOPEN
        : action === 'START_REVIEW'
          ? PERMISSIONS
              .ACCOUNTING_PERIOD_MANAGE
          : PERMISSIONS
              .ACCOUNTING_PERIOD_CLOSE

    if (
      !hasPermission(
        context,
        permission,
      )
    ) {
      httpError(
        403,
        'Vous ne disposez pas des droits nécessaires pour cette opération comptable.',
        'ACCOUNTING_PERIOD_FORBIDDEN',
      )
    }

    if (body.confirmed !== true) {
      badRequest(
        'Vous devez confirmer cette opération.',
      )
    }

    const lockVersion
      = body.lockVersion

    if (
      typeof lockVersion !== 'number'
      || !Number.isSafeInteger(
        lockVersion,
      )
      || lockVersion < 0
      || lockVersion >= 2147483647
    ) {
      badRequest(
        'Version de période invalide.',
      )
    }

    let reason: string | null = null

    if (action === 'REOPEN') {
      reason = requiredString(
        body.reason,
        'Motif de réouverture',
        {
          min: 10,
          max: 1000,
        },
      )
    }
    else if (
      body.reason !== undefined
      && body.reason !== null
      && body.reason !== ''
    ) {
      badRequest(
        'Le motif est réservé à une réouverture.',
      )
    }

    const result
      = await transitionAccountingPeriod(
        event,
        context,
        {
          periodId,
          action,

          expectedLockVersion:
            lockVersion,

          reopenReason:
            reason,
        },
      )

    return success(
      jsonSafe(result),
    )
  },
)
