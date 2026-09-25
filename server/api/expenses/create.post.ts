import { readBody } from 'h3'
import { requireAuth } from '../../utils/auth'
import { httpError, jsonSafe, success } from '../../utils/api'
import {
  requireExpenseCreator,
  requireExpenseIntervenor,
  requireExpenseProject,
  requireExpenseProjectAssignment,
} from '../../utils/expenses'
import { prisma } from '../../utils/prisma'
import {
  optionalDate,
  optionalEnum,
  optionalString,
  requiredEnum,
  requiredPositiveNumber,
  requiredString,
  safeObject,
} from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'
import { assertAccountingDateWritable } from '../../utils/accounting-periods'

const CATEGORIES = [
  'FUEL',
  'TOLL',
  'PARKING',
  'TRANSPORT',
  'MEAL',
  'ACCOMMODATION',
  'INTERNET',
  'PHONE',
  'HARDWARE',
  'SOFTWARE',
  'PRINTING',
  'SUPPLIES',
  'TRAINING',
  'INSURANCE',
  'MILEAGE',
  'BANK_FEES',
  'PROFESSIONAL_SERVICE',
  'OTHER',
] as const

const PAYMENT_METHODS = [
  'CARD',
  'BANK_TRANSFER',
  'DIRECT_DEBIT',
  'CASH',
  'CHEQUE',
  'PERSONAL_ADVANCE',
  'OTHER',
] as const

function money(value: number): string {
  return value.toFixed(2)
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  // Le contrôle d’accès est volontairement effectué avant
  // toute validation du corps de requête.
  const ownIntervenorId = requireExpenseCreator(context)

  const body = safeObject(await readBody(event))

  const category = requiredEnum(
    body.category,
    CATEGORIES,
    'Catégorie',
  )

  const description = requiredString(
    body.description,
    'Description',
    { max: 10_000 },
  )

  const supplierName = optionalString(
    body.supplierName,
    'Fournisseur',
    { max: 255 },
  )

  const reference = optionalString(
    body.reference,
    'Référence',
    { max: 120 },
  )

  const expenseDate = optionalDate(
    body.expenseDate,
    'Date de dépense',
  )

  if (!expenseDate) {
    httpError(
      400,
      'La date de dépense est obligatoire.',
      'EXPENSE_DATE_REQUIRED',
    )
  }

  const amountExclTaxNumber = requiredPositiveNumber(
    body.amountExclTax,
    'Montant HT',
  )

  if (amountExclTaxNumber > 999_999_999.99) {
    httpError(
      400,
      'Le montant HT dépasse la valeur maximale autorisée.',
      'EXPENSE_AMOUNT_TOO_LARGE',
    )
  }

  const taxRateNumber = Number(body.taxRate ?? 0)

  if (
    !Number.isFinite(taxRateNumber)
    || taxRateNumber < 0
    || taxRateNumber > 100
  ) {
    httpError(
      400,
      'Le taux de TVA doit être compris entre 0 et 100.',
      'EXPENSE_INVALID_TAX_RATE',
    )
  }

  const taxAmountNumber = roundMoney(
    amountExclTaxNumber * taxRateNumber / 100,
  )

  const amountInclTaxNumber = roundMoney(
    amountExclTaxNumber + taxAmountNumber,
  )

  const paymentMethod = optionalEnum(
    body.paymentMethod,
    PAYMENT_METHODS,
    'Moyen de paiement',
  )

  const currency = requiredString(
    body.currency || 'EUR',
    'Devise',
    { min: 3, max: 3 },
  ).toUpperCase()

  if (!/^[A-Z]{3}$/.test(currency)) {
    httpError(
      400,
      'La devise doit utiliser un code ISO à 3 lettres.',
      'EXPENSE_INVALID_CURRENCY',
    )
  }

  const projectId = optionalString(
    body.projectId,
    'Projet',
    { max: 191 },
  )

  let intervenorId: string | null

  if (ownIntervenorId === null) {
    intervenorId = optionalString(
      body.intervenorId,
      'Intervenant',
      { max: 191 },
    )

    if (intervenorId) {
      await requireExpenseIntervenor(
        context,
        intervenorId,
      )
    }
  }
  else {
    const requestedIntervenorId = optionalString(
      body.intervenorId,
      'Intervenant',
      { max: 191 },
    )

    if (
      requestedIntervenorId
      && requestedIntervenorId !== ownIntervenorId
    ) {
      httpError(
        403,
        'Vous pouvez uniquement créer vos propres dépenses.',
        'EXPENSE_INTERVENOR_FORBIDDEN',
      )
    }

    intervenorId = ownIntervenorId
  }

  if (projectId && intervenorId) {
    await requireExpenseProjectAssignment(
      context,
      projectId,
      intervenorId,
    )
  }
  else if (projectId) {
    await requireExpenseProject(
      context,
      projectId,
    )
  }

  const reimbursable = body.reimbursable === true

  if (reimbursable && !intervenorId) {
    httpError(
      400,
      'Une dépense remboursable doit être rattachée à un intervenant.',
      'EXPENSE_REIMBURSEMENT_INTERVENOR_REQUIRED',
    )
  }

  await assertAccountingDateWritable(
    context.associationId,
    expenseDate,
    'dépense',
  )

  const expense = await prisma.expense.create({
    data: {
      associationId: context.associationId,
      projectId,
      intervenorId,
      createdByUserId: context.userId,

      category,
      status: 'DRAFT',
      expenseDate,

      supplierName,
      description,
      reference,

      currency,
      amountExclTax: money(amountExclTaxNumber),
      taxRate: taxRateNumber.toFixed(2),
      taxAmount: money(taxAmountNumber),
      amountInclTax: money(amountInclTaxNumber),

      paymentMethod,
      reimbursable,
    },

    select: {
      id: true,
      category: true,
      status: true,
      expenseDate: true,
      supplierName: true,
      description: true,
      reference: true,
      currency: true,
      amountExclTax: true,
      taxRate: true,
      taxAmount: true,
      amountInclTax: true,
      paymentMethod: true,
      reimbursable: true,
      projectId: true,
      intervenorId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  await writeAuditLog(event, context, {
    action: 'EXPENSE_CREATED',
    entityType: 'Expense',
    entityId: expense.id,
    metadata: {
      category: expense.category,
      projectId: expense.projectId,
      intervenorId: expense.intervenorId,
      amountExclTax: expense.amountExclTax.toString(),
      taxRate: expense.taxRate.toString(),
      taxAmount: expense.taxAmount.toString(),
      amountInclTax: expense.amountInclTax.toString(),
      currency: expense.currency,
      reimbursable: expense.reimbursable,
    },
  })

  return success(jsonSafe(expense))
})
