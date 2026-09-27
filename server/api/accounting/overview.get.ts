import { getQuery } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { httpError, success } from '../../utils/api'
import { prisma } from '../../utils/prisma'
import { collectedTaxFromPayments } from '../../utils/accounting-overview'

function cents(
  value: {
    toFixed(decimals: number): string
  } | string | number | bigint | null | undefined,
): bigint {
  if (value == null) {
    return BigInt(0)
  }

  const fixed =
    typeof value === 'object'
      ? value.toFixed(2)
      : typeof value === 'bigint'
        ? `${value}.00`
        : Number(value).toFixed(2)

  if (!/^-?\d+\.\d{2}$/.test(fixed)) {
    throw new Error('Montant monétaire invalide.')
  }

  const negative = fixed.startsWith('-')
  const unsigned = negative
    ? fixed.slice(1)
    : fixed

  const [whole = '0', fraction = '00'] =
    unsigned.split('.')

  const result =
    BigInt(whole) * BigInt(100)
    + BigInt(fraction)

  return negative
    ? -result
    : result
}

function money(value: bigint): string {
  const negative = value < BigInt(0)
  const absolute = negative ? -value : value

  return `${negative ? '-' : ''}${absolute / BigInt(100)}.${(absolute % BigInt(100))
    .toString()
    .padStart(2, '0')}`
}

function parseBusinessDate(
  value: unknown,
): Date | null {
  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null
  }

  const date = new Date(
    `${value}T00:00:00.000Z`,
  )

  if (
    Number.isNaN(date.getTime())
    || date.toISOString().slice(0, 10) !== value
  ) {
    return null
  }

  return date
}

function nextBusinessDate(
  date: Date,
): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + 1,
    ),
  )
}

export default defineEventHandler(async (event) => {
  const context = await requirePermission(
    event,
    PERMISSIONS.ACCOUNTING_READ,
  )

  const query = getQuery(event)

  const from = parseBusinessDate(query.from)
  const to = parseBusinessDate(query.to)
  const toExclusive = to
    ? nextBusinessDate(to)
    : null

  if (
    typeof query.from === 'string'
    && query.from
    && !from
  ) {
    httpError(
      400,
      'Date de début invalide.',
      'ACCOUNTING_OVERVIEW_INVALID_FROM',
    )
  }

  if (
    typeof query.to === 'string'
    && query.to
    && !to
  ) {
    httpError(
      400,
      'Date de fin invalide.',
      'ACCOUNTING_OVERVIEW_INVALID_TO',
    )
  }

  if (from && to && from > to) {
    httpError(
      400,
      'La date de début doit précéder la date de fin.',
      'ACCOUNTING_OVERVIEW_INVALID_RANGE',
    )
  }

  const invoiceDateWhere = {
    ...(from ? { gte: from } : {}),
    ...(toExclusive ? { lt: toExclusive } : {}),
  }

  const expenseDateWhere = {
    ...(from ? { gte: from } : {}),
    ...(toExclusive ? { lt: toExclusive } : {}),
  }

  /*
   * Pour la trésorerie, seuls les règlements compris
   * dans la fenêtre seront additionnés.
   *
   * Pour la TVA sur encaissements, nous avons en revanche
   * besoin de l'historique antérieur afin de calculer
   * une différence de cumul.
   */
  const paymentHistoryDateWhere = {
    ...(toExclusive ? { lt: toExclusive } : {}),
  }

  const [
    invoices,
    expenses,
    payments,
    paidExpenses,
  ] = await Promise.all([
    prisma.billingDocument.findMany({
      where: {
        associationId: context.associationId,
        kind: 'INVOICE',

        status: {
          notIn: [
            'DRAFT',
            'CANCELLED',
          ],
        },

        ...(from || to
          ? {
              issueDate:
                invoiceDateWhere,
            }
          : {}),
      },

      select: {
        id: true,
        subtotal: true,
        taxAmount: true,
        total: true,
        status: true,
      },
    }),

    prisma.expense.findMany({
      where: {
        associationId:
          context.associationId,

        status: {
          notIn: [
            'DRAFT',
            'REJECTED',
            'CANCELLED',
          ],
        },

        ...(from || to
          ? {
              expenseDate:
                expenseDateWhere,
            }
          : {}),
      },

      select: {
        id: true,
        amountExclTax: true,
        taxAmount: true,
        amountInclTax: true,
        status: true,
        taxDeductibility: true,
        deductibleTaxAmount: true,
      },
    }),

    prisma.billingPayment.findMany({
      where: {
        associationId:
          context.associationId,

        reversedAt: null,

        ...(to
          ? {
              paidAt:
                paymentHistoryDateWhere,
            }
          : {}),

        billingDocument: {
          kind: 'INVOICE',
        },
      },

      select: {
        id: true,
        billingDocumentId: true,
        amount: true,
        paidAt: true,
        billingDocument: {
          select: {
            total: true,
            taxAmount: true,
          },
        },
      },
    }),

    /*
     * Flux sortants réellement enregistrés pour l'association.
     *
     * Une dépense simplement soumise ou approuvée n'est pas
     * encore un décaissement.
     *
     * PERSONAL_ADVANCE est exclu : la dépense a été avancée
     * personnellement et ne constitue donc pas, à ce stade,
     * une sortie de trésorerie de l'association.
     */
    prisma.expense.findMany({
      where: {
        associationId:
          context.associationId,

        status: 'PAID',

        paidAt: {
          not: null,

          ...(from
            ? { gte: from }
            : {}),

          ...(toExclusive
            ? { lt: toExclusive }
            : {}),
        },

        paymentMethod: {
          not: 'PERSONAL_ADVANCE',
        },
      },

      select: {
        id: true,
        amountInclTax: true,
      },
    }),
  ])

  let invoicedExclTax = BigInt(0)
  let invoicedTax = BigInt(0)
  let invoicedInclTax = BigInt(0)

  for (const invoice of invoices) {
    invoicedExclTax += cents(invoice.subtotal)
    invoicedTax += cents(invoice.taxAmount)
    invoicedInclTax += cents(invoice.total)
  }

  let expenseExclTax = BigInt(0)
  let expenseTax = BigInt(0)
  let expenseInclTax = BigInt(0)

  let deductibleExpenseTax = BigInt(0)
  let pendingTaxReviewCount = 0
  let pendingTaxReviewAmount = BigInt(0)

  for (const expense of expenses) {
    expenseExclTax += cents(
      expense.amountExclTax,
    )

    expenseTax += cents(
      expense.taxAmount,
    )

    expenseInclTax += cents(
      expense.amountInclTax,
    )

    if (
      expense.taxDeductibility
      === 'DEDUCTIBLE'
    ) {
      deductibleExpenseTax += cents(
        expense.deductibleTaxAmount,
      )
    }

    if (
      expense.taxDeductibility
      === 'PENDING'
      && cents(expense.taxAmount) > BigInt(0)
    ) {
      pendingTaxReviewCount += 1
      pendingTaxReviewAmount += cents(
        expense.taxAmount,
      )
    }
  }

  const collected = payments.reduce(
    (total, payment) => {
      const belongsToWindow =
        (!from || payment.paidAt >= from)
        && (
          !toExclusive
          || payment.paidAt < toExclusive
        )

      return belongsToWindow
        ? total + cents(payment.amount)
        : total
    },

    BigInt(0),
  )

  const disbursed = paidExpenses.reduce(
    (total, expense) =>
      total + cents(expense.amountInclTax),

    BigInt(0),
  )

  const collectedTax =
    collectedTaxFromPayments(
      payments.map(payment => ({
        billingDocumentId:
          payment.billingDocumentId,

        paymentCents:
          cents(payment.amount),

        paidAt:
          payment.paidAt,

        invoiceTotalCents:
          cents(payment.billingDocument.total),

        invoiceTaxCents:
          cents(payment.billingDocument.taxAmount),
      })),
      from,
    )

  /*
   * ATTENTION :
   *
   * expenseTax représente uniquement la TVA
   * renseignée sur les dépenses.
   *
   * Elle ne doit PAS être présentée comme
   * automatiquement déductible fiscalement.
   *
   * La déductibilité fera l'objet d'une règle
   * métier dédiée.
   */
  return success({
    period: {
      from:
        typeof query.from === 'string'
          ? query.from
          : null,

      to:
        typeof query.to === 'string'
          ? query.to
          : null,
    },

    currency: 'EUR',

    billing: {
      invoiceCount:
        invoices.length,

      exclTax:
        money(invoicedExclTax),

      tax:
        money(invoicedTax),

      inclTax:
        money(invoicedInclTax),

      collected:
        money(collected),

      /*
       * Les encaissements sont filtrés par date de paiement,
       * tandis que le CA facturé est filtré par date d'émission.
       * On ne calcule donc pas ici un "reste à encaisser"
       * par simple soustraction entre ces deux périodes.
       */
      outstanding: null,
    },

    expenses: {
      expenseCount:
        expenses.length,

      exclTax:
        money(expenseExclTax),

      declaredTax:
        money(expenseTax),

      inclTax:
        money(expenseInclTax),
    },

    cash: {
      customerReceipts:
        money(collected),

      disbursements:
        money(disbursed),

      difference:
        money(
          collected - disbursed,
        ),
    },

    tax: {
      invoicedTax:
        money(invoicedTax),

      /*
       * TVA devenue exigible à partir des règlements reçus
       * pendant la période, selon une logique d'encaissements.
       */
      collectedTax:
        money(collectedTax),

      collectionBasis:
        'PAYMENTS',

      expenseTaxRecorded:
        money(expenseTax),

      /*
       * Seuls les montants explicitement qualifiés
       * DEDUCTIBLE sont agrégés ici.
       *
       * Une dépense PENDING ou NON_DEDUCTIBLE
       * ne contribue jamais à ce montant.
       */
      deductibleTax:
        money(deductibleExpenseTax),

      pendingReviewCount:
        pendingTaxReviewCount,

      pendingReviewTax:
        money(pendingTaxReviewAmount),

      /*
       * Le montant à décaisser reste volontairement
       * indéterminé tant que le régime fiscal complet
       * de l'association n'est pas modélisé.
       */
      payableTax: null,

      status:
        'PARTIAL',
    },
  })
})
