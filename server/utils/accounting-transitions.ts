import type { H3Event } from 'h3'

import type { AuthContext } from './auth'

import {
  buildAccountingPeriodChecklist,
} from './accounting-checklist'

import { writeAuditLogStrict } from './audit'

import {
  httpError,
  prismaErrorCode,
} from './api'

import { prisma } from './prisma'

export const ACCOUNTING_PERIOD_ACTIONS = [
  'START_REVIEW',
  'PRE_CLOSE',
  'CLOSE',
  'REOPEN',
] as const

export type AccountingPeriodAction
  = typeof ACCOUNTING_PERIOD_ACTIONS[number]

type TransitionInput = {
  periodId: string
  action: AccountingPeriodAction
  expectedLockVersion: number
  reopenReason?: string | null
}

function targetStatus(
  action: AccountingPeriodAction,
): 'REVIEW' | 'PRE_CLOSED' | 'CLOSED' {
  switch (action) {
    case 'START_REVIEW':
    case 'REOPEN':
      return 'REVIEW'

    case 'PRE_CLOSE':
      return 'PRE_CLOSED'

    case 'CLOSE':
      return 'CLOSED'
  }
}

function auditAction(
  action: AccountingPeriodAction,
): string {
  switch (action) {
    case 'START_REVIEW':
      return 'ACCOUNTING_PERIOD_REVIEW_STARTED'

    case 'PRE_CLOSE':
      return 'ACCOUNTING_PERIOD_PRE_CLOSED'

    case 'CLOSE':
      return 'ACCOUNTING_PERIOD_CLOSED'

    case 'REOPEN':
      return 'ACCOUNTING_PERIOD_REOPENED'
  }
}

function assertTransitionAllowed(
  currentStatus: string,
  action: AccountingPeriodAction,
): void {
  const allowed
    = (
      action === 'START_REVIEW'
      && currentStatus === 'OPEN'
    )
    || (
      action === 'PRE_CLOSE'
      && currentStatus === 'REVIEW'
    )
    || (
      action === 'CLOSE'
      && currentStatus === 'PRE_CLOSED'
    )
    || (
      action === 'REOPEN'
      && (
        currentStatus === 'PRE_CLOSED'
        || currentStatus === 'CLOSED'
      )
    )

  if (!allowed) {
    httpError(
      409,
      `Transition comptable ${currentStatus} → ${targetStatus(action)} interdite.`,
      'ACCOUNTING_PERIOD_INVALID_TRANSITION',
    )
  }
}

function snapshotChecklist(
  checklist:
    Awaited<
      ReturnType<
        typeof buildAccountingPeriodChecklist
      >
    >,
) {
  /*
   * Le snapshot est volontairement sérialisé :
   * aucune référence mutable / Date / Decimal
   * ne doit être conservée dans le JSON Prisma.
   */
  return JSON.parse(
    JSON.stringify({
      computedAt:
        checklist.computedAt,

      readyForPreClose:
        checklist.readyForPreClose,

      blockerCount:
        checklist.blockerCount,

      warningCount:
        checklist.warningCount,

      metrics:
        checklist.metrics,

      items:
        checklist.items,
    }),
  )
}

export async function transitionAccountingPeriod(
  event: H3Event,
  context: AuthContext,
  input: TransitionInput,
) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const period
          = await tx.accountingPeriod.findFirst({
            where: {
              id: input.periodId,

              associationId:
                context.associationId,
            },

            select: {
              id: true,
              label: true,
              status: true,
              number: true,
              startDate: true,
              endDate: true,
              lockVersion: true,

              fiscalYear: {
                select: {
                  id: true,
                  label: true,
                  status: true,
                },
              },
            },
          })

        if (!period) {
          httpError(
            404,
            'Période comptable introuvable.',
            'ACCOUNTING_PERIOD_NOT_FOUND',
          )
        }

        if (
          period.lockVersion
          !== input.expectedLockVersion
        ) {
          httpError(
            409,
            'Cette période a été modifiée depuis son affichage. Actualisez les données avant de recommencer.',
            'ACCOUNTING_PERIOD_VERSION_CONFLICT',
          )
        }

        if (
          period.fiscalYear.status === 'CLOSED'
        ) {
          httpError(
            409,
            'L’exercice comptable est clôturé. La période ne peut plus être modifiée.',
            'ACCOUNTING_FISCAL_YEAR_CLOSED',
          )
        }

        assertTransitionAllowed(
          period.status,
          input.action,
        )

        /*
         * Une réouverture d'une ancienne période
         * invaliderait la cohérence des périodes
         * suivantes déjà verrouillées.
         *
         * On impose donc une réouverture en ordre
         * chronologique inverse.
         */
        if (input.action === 'REOPEN') {
          const laterLockedPeriods
            = await tx.accountingPeriod.count({
              where: {
                associationId:
                  context.associationId,

                fiscalYearId:
                  period.fiscalYear.id,

                number: {
                  gt: period.number,
                },

                status: {
                  in: [
                    'PRE_CLOSED',
                    'CLOSED',
                  ],
                },
              },
            })

          if (laterLockedPeriods > 0) {
            httpError(
              409,
              laterLockedPeriods === 1
                ? 'Une période ultérieure est encore verrouillée. Réouvrez-la d’abord.'
                : `${laterLockedPeriods} périodes ultérieures sont encore verrouillées. Réouvrez-les d’abord en partant de la plus récente.`,
              'ACCOUNTING_PERIOD_REOPEN_ORDER_CONFLICT',
            )
          }
        }

        const now = new Date()

        let checklist:
          Awaited<
            ReturnType<
              typeof buildAccountingPeriodChecklist
            >
          >
          | null
          = null

        /*
         * Un contrôle réel est recalculé DANS
         * la transaction avant chaque opération
         * de clôture.
         */
        if (
          input.action === 'START_REVIEW'
          || input.action === 'PRE_CLOSE'
          || input.action === 'CLOSE'
        ) {
          checklist
            = await buildAccountingPeriodChecklist(
              context.associationId,
              period.id,
              tx,
            )
        }

        if (
          input.action === 'START_REVIEW'
          && !checklist?.metrics.periodEnded
        ) {
          httpError(
            409,
            'La période est encore en cours. Le contrôle de clôture ne peut pas être démarré.',
            'ACCOUNTING_PERIOD_NOT_ENDED',
          )
        }

        if (
          (
            input.action === 'PRE_CLOSE'
            || input.action === 'CLOSE'
          )
          && !checklist?.readyForPreClose
        ) {
          httpError(
            409,
            `${checklist?.blockerCount ?? 0} ${(checklist?.blockerCount ?? 0) === 1 ? 'point bloquant empêche' : 'points bloquants empêchent'} la clôture de cette période.`,
            'ACCOUNTING_PERIOD_CHECKLIST_BLOCKED',
          )
        }

        if (
          input.action === 'REOPEN'
          && !input.reopenReason
        ) {
          httpError(
            400,
            'Le motif de réouverture est obligatoire.',
            'ACCOUNTING_PERIOD_REOPEN_REASON_REQUIRED',
          )
        }

        const nextStatus
          = targetStatus(input.action)

        const checklistJson
          = checklist
            ? snapshotChecklist(checklist)
            : undefined

        const data = (() => {
          switch (input.action) {
            case 'START_REVIEW':
              return {
                status:
                  'REVIEW' as const,

                reviewStartedAt:
                  now,

                reviewStartedByUserId:
                  context.userId,

                lockVersion: {
                  increment: 1,
                },
              }

            case 'PRE_CLOSE':
              return {
                status:
                  'PRE_CLOSED' as const,

                preClosedAt:
                  now,

                preClosedByUserId:
                  context.userId,

                closureChecklist:
                  checklistJson,

                lockVersion: {
                  increment: 1,
                },
              }

            case 'CLOSE':
              return {
                status:
                  'CLOSED' as const,

                closedAt:
                  now,

                closedByUserId:
                  context.userId,

                closureChecklist:
                  checklistJson,

                lockVersion: {
                  increment: 1,
                },
              }

            case 'REOPEN':
              return {
                status:
                  'REVIEW' as const,

                reviewStartedAt:
                  now,

                reviewStartedByUserId:
                  context.userId,

                preClosedAt:
                  null,

                preClosedByUserId:
                  null,

                closedAt:
                  null,

                closedByUserId:
                  null,

                reopenedAt:
                  now,

                reopenedByUserId:
                  context.userId,

                reopenReason:
                  input.reopenReason,

                lockVersion: {
                  increment: 1,
                },
              }
          }
        })()

        /*
         * Optimistic locking :
         * même si deux personnes agissent presque
         * simultanément, une seule transition peut
         * utiliser la même version.
         */
        const changed
          = await tx.accountingPeriod.updateMany({
            where: {
              id: period.id,

              associationId:
                context.associationId,

              status:
                period.status,

              lockVersion:
                input.expectedLockVersion,
            },

            data,
          })

        if (changed.count !== 1) {
          httpError(
            409,
            'Cette période vient d’être modifiée par une autre opération. Actualisez puis recommencez.',
            'ACCOUNTING_PERIOD_VERSION_CONFLICT',
          )
        }

        const updated
          = await tx.accountingPeriod.findUnique({
            where: {
              id: period.id,
            },

            include: {
              fiscalYear: true,
            },
          })

        if (!updated) {
          httpError(
            500,
            'La période modifiée est introuvable.',
            'ACCOUNTING_PERIOD_UPDATE_FAILED',
          )
        }

        await writeAuditLogStrict(
          event,
          context,
          {
            action:
              auditAction(input.action),

            entityType:
              'AccountingPeriod',

            entityId:
              period.id,

            metadata: {
              fiscalYearId:
                period.fiscalYear.id,

              fiscalYearLabel:
                period.fiscalYear.label,

              periodLabel:
                period.label,

              previousStatus:
                period.status,

              newStatus:
                nextStatus,

              previousLockVersion:
                period.lockVersion,

              newLockVersion:
                updated.lockVersion,

              reopenReason:
                input.action === 'REOPEN'
                  ? input.reopenReason
                  : null,

              checklist:
                checklist
                  ? {
                      readyForPreClose:
                        checklist
                          .readyForPreClose,

                      blockerCount:
                        checklist
                          .blockerCount,

                      warningCount:
                        checklist
                          .warningCount,

                      computedAt:
                        checklist
                          .computedAt
                          .toISOString(),
                    }
                  : null,
            },
          },
          tx,
        )

        return {
          period: updated,
          checklist,
        }
      },
      {
        isolationLevel:
          'Serializable',
      },
    )
  }
  catch (error) {
    if (
      prismaErrorCode(error) === 'P2034'
    ) {
      httpError(
        409,
        'Une opération comptable concurrente a été détectée. Actualisez les données puis recommencez.',
        'ACCOUNTING_PERIOD_CONCURRENT_OPERATION',
      )
    }

    throw error
  }
}

export function isAccountingTransitionAllowed(
  currentStatus: string,
  action: AccountingPeriodAction,
): boolean {
  try {
    assertTransitionAllowed(
      currentStatus,
      action,
    )

    return true
  }
  catch {
    return false
  }
}
