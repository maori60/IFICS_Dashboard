import { setHeader } from 'h3'
import { requireAuth } from '../../utils/auth'
import { httpError } from '../../utils/api'
import { writeAuditLog } from '../../utils/audit'
import {
  canExportExpenses,
  expenseVisibilityWhere,
} from '../../utils/expenses'
import { prisma } from '../../utils/prisma'

function csvCell(value: unknown): string {
  let text = value === null || value === undefined
    ? ''
    : String(value)

  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`
  }

  return `"${text.replace(/"/g, '""')}"`
}

function dateOnly(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : ''
}

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  if (!canExportExpenses(context)) {
    httpError(
      403,
      'Vous ne disposez pas de l’autorisation nécessaire pour exporter les dépenses.',
      'EXPENSE_EXPORT_FORBIDDEN',
    )
  }

  const expenses = await prisma.expense.findMany({
    where: expenseVisibilityWhere(context),
    orderBy: [
      { expenseDate: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 10_000,
    select: {
      id: true,
      expenseDate: true,
      category: true,
      status: true,
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
      submittedAt: true,
      reviewedAt: true,
      paidAt: true,
      cancelledAt: true,
      project: {
        select: {
          reference: true,
          title: true,
        },
      },
      intervenor: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      _count: {
        select: { attachments: true },
      },
    },
  })

  const rows = [
    [
      'ID',
      'Date',
      'Catégorie',
      'Statut',
      'Fournisseur',
      'Description',
      'Référence',
      'Projet',
      'Intervenant',
      'Devise',
      'Montant HT',
      'Taux TVA',
      'Montant TVA',
      'Montant TTC',
      'Moyen de paiement',
      'Remboursable',
      'Justificatifs',
      'Soumise le',
      'Validée le',
      'Payée le',
      'Annulée le',
    ],
    ...expenses.map(expense => [
      expense.id,
      dateOnly(expense.expenseDate),
      expense.category,
      expense.status,
      expense.supplierName ?? '',
      expense.description,
      expense.reference ?? '',
      expense.project
        ? expense.project.reference || expense.project.title
        : '',
      expense.intervenor
        ? `${expense.intervenor.firstName} ${expense.intervenor.lastName}`
        : '',
      expense.currency,
      expense.amountExclTax.toString(),
      expense.taxRate.toString(),
      expense.taxAmount.toString(),
      expense.amountInclTax.toString(),
      expense.paymentMethod ?? '',
      expense.reimbursable ? 'Oui' : 'Non',
      expense._count.attachments,
      dateOnly(expense.submittedAt),
      dateOnly(expense.reviewedAt),
      dateOnly(expense.paidAt),
      dateOnly(expense.cancelledAt),
    ]),
  ]

  const csv = `\uFEFF${rows
    .map(row => row.map(csvCell).join(';'))
    .join('\r\n')}\r\n`

  await writeAuditLog(event, context, {
    action: 'EXPENSES_EXPORTED',
    entityType: 'Expense',
    entityId: context.associationId,
    metadata: {
      count: expenses.length,
      format: 'CSV',
    },
  })

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename="depenses-ifics-${new Date().toISOString().slice(0, 10)}.csv"`,
  )
  setHeader(event, 'Cache-Control', 'private, no-store')

  return csv
})
