import {
  getRouterParam,
  readBody,
} from 'h3'

import {
  requirePermission,
} from '../../../utils/auth'

import {
  PERMISSIONS,
} from '../../../utils/constants'

import {
  prisma,
} from '../../../utils/prisma'

import {
  httpError,
  jsonSafe,
  requireRouterId,
  success,
} from '../../../utils/api'

import {
  optionalString,
  requiredEnum,
  safeObject,
} from '../../../utils/validation'

import {
  assertAccountingDateWritable,
} from '../../../utils/accounting-periods'

import {
  writeAuditLogStrict,
} from '../../../utils/audit'

const TAX_DEDUCTIBILITY = [
  'PENDING',
  'DEDUCTIBLE',
  'NON_DEDUCTIBLE',
] as const

function moneyCents(
  value: {
    toFixed(decimals: number): string
  } | string,
): bigint {
  const fixed =
    typeof value === 'object'
      ? value.toFixed(2)
      : value

  if (!/^\d+(?:\.\d{1,2})?$/.test(fixed)) {
    httpError(
      400,
      'Le montant de TVA déductible est invalide.',
      'EXPENSE_DEDUCTIBLE_TAX_INVALID',
    )
  }

  const [
    whole = '0',
    fraction = '',
  ] = fixed.split('.')

  return (
    BigInt(whole) * BigInt(100)
    + BigInt(
      fraction.padEnd(2, '0'),
    )
  )
}

function centsAsDecimal(
  value: bigint,
): string {
  const whole =
    value / BigInt(100)

  const fraction =
    (
      value % BigInt(100)
    )
      .toString()
      .padStart(2, '0')

  return `${whole}.${fraction}`
}

export default defineEventHandler(async (event) => {
  const context =
    await requirePermission(
      event,
      PERMISSIONS.ACCOUNTING_WRITE,
    )

  const id =
    requireRouterId(
      getRouterParam(event, 'id'),
      'Dépense',
    )

  const body =
    safeObject(
      await readBody(event),
    )

  const taxDeductibility =
    requiredEnum(
      body.taxDeductibility,
      TAX_DEDUCTIBILITY,
      'Déductibilité de la TVA',
    )

  const taxReviewNote =
    optionalString(
      body.taxReviewNote,
      'Note fiscale',
      {
        max: 5_000,
      },
    )

  const expense =
    await prisma.expense.findFirst({
      where: {
        id,
        associationId:
          context.associationId,
      },

      select: {
        id: true,
        status: true,
        expenseDate: true,
        currency: true,
        taxAmount: true,
        updatedAt: true,

        taxDeductibility: true,
        deductibleTaxAmount: true,
        taxReviewNote: true,
      },
    })

  if (!expense) {
    httpError(
      404,
      'Dépense introuvable.',
      'EXPENSE_NOT_FOUND',
    )
  }

  if (
    expense.status !== 'APPROVED'
    && expense.status !== 'PAID'
  ) {
    httpError(
      409,
      'La qualification fiscale est possible uniquement sur une dépense approuvée ou payée.',
      'EXPENSE_TAX_REVIEW_STATUS_INVALID',
    )
  }

  await assertAccountingDateWritable(
    context.associationId,
    expense.expenseDate,
    'qualification fiscale de la dépense',
  )

  const recordedTaxCents =
    moneyCents(
      expense.taxAmount,
    )

  let deductibleTaxCents =
    BigInt(0)

  if (
    body.deductibleTaxAmount !== undefined
    && body.deductibleTaxAmount !== null
    && body.deductibleTaxAmount !== ''
  ) {
    deductibleTaxCents =
      moneyCents(
        String(
          body.deductibleTaxAmount,
        ).trim(),
      )
  }

  if (
    deductibleTaxCents
    > recordedTaxCents
  ) {
    httpError(
      400,
      'La TVA déductible ne peut pas dépasser la TVA enregistrée sur la dépense.',
      'EXPENSE_DEDUCTIBLE_TAX_OUT_OF_RANGE',
    )
  }

  if (
    taxDeductibility === 'PENDING'
    && deductibleTaxCents !== BigInt(0)
  ) {
    httpError(
      400,
      'Une TVA à vérifier doit avoir un montant déductible nul.',
      'EXPENSE_PENDING_TAX_AMOUNT_FORBIDDEN',
    )
  }

  if (
    taxDeductibility === 'NON_DEDUCTIBLE'
    && deductibleTaxCents !== BigInt(0)
  ) {
    httpError(
      400,
      'Une TVA non déductible doit avoir un montant déductible nul.',
      'EXPENSE_NON_DEDUCTIBLE_TAX_AMOUNT_FORBIDDEN',
    )
  }

  if (
    taxDeductibility === 'DEDUCTIBLE'
  ) {
    if (
      recordedTaxCents <= BigInt(0)
      || deductibleTaxCents <= BigInt(0)
    ) {
      httpError(
        400,
        'Une TVA qualifiée déductible doit avoir un montant déductible supérieur à zéro.',
        'EXPENSE_DEDUCTIBLE_TAX_AMOUNT_REQUIRED',
      )
    }

    /*
     * DEDUCTIBLE signifie ici :
     * "le montant deductibleTaxAmount a été qualifié
     * comme déductible".
     *
     * Il peut donc être inférieur à taxAmount en cas
     * de déductibilité partielle.
     */
    if (
      deductibleTaxCents
      < recordedTaxCents
      && !taxReviewNote
    ) {
      httpError(
        400,
        'Une déductibilité partielle doit être justifiée par une note fiscale.',
        'EXPENSE_PARTIAL_TAX_NOTE_REQUIRED',
      )
    }
  }

  const reviewedAt =
    new Date()

  const deductibleTaxAmount =
    centsAsDecimal(
      deductibleTaxCents,
    )

  const updated =
    await prisma.$transaction(
      async (tx) => {
        /*
         * Transition protégée contre une modification
         * concurrente de la dépense entre lecture et écriture.
         */
        const changed =
          await tx.expense.updateMany({
            where: {
              id,
              associationId:
                context.associationId,

              status: {
                in: [
                  'APPROVED',
                  'PAID',
                ],
              },

              updatedAt:
                expense.updatedAt,
            },

            data: {
              taxDeductibility,

              deductibleTaxAmount,

              taxReviewNote,

              taxReviewedAt:
                taxDeductibility
                === 'PENDING'
                  ? null
                  : reviewedAt,

              taxReviewedByUserId:
                taxDeductibility
                === 'PENDING'
                  ? null
                  : context.userId,
            },
          })

        if (changed.count !== 1) {
          httpError(
            409,
            'La dépense a été modifiée pendant la qualification fiscale. Rechargez-la avant de recommencer.',
            'EXPENSE_TAX_REVIEW_CONFLICT',
          )
        }

        await writeAuditLogStrict(
          event,
          context,
          {
            action:
              'EXPENSE_TAX_REVIEWED',

            entityType:
              'Expense',

            entityId:
              id,

            metadata: {
              previous: {
                taxDeductibility:
                  expense.taxDeductibility,

                deductibleTaxAmount:
                  expense
                    .deductibleTaxAmount
                    .toString(),

                taxReviewNote:
                  expense.taxReviewNote,
              },

              next: {
                taxDeductibility,

                deductibleTaxAmount,

                taxReviewNote,
              },

              recordedTaxAmount:
                expense.taxAmount
                  .toString(),

              currency:
                expense.currency,
            },
          },
          tx,
        )

        return tx.expense.findUniqueOrThrow({
          where: {
            id,
          },

          select: {
            id: true,
            status: true,

            taxAmount: true,
            taxDeductibility: true,
            deductibleTaxAmount: true,
            taxReviewNote: true,
            taxReviewedAt: true,
            taxReviewedByUserId: true,

            updatedAt: true,
          },
        })
      },
    )

  return success(
    jsonSafe(updated),
  )
})
