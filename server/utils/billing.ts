import type { Prisma } from '../../generated/prisma/client'
import { badRequest, requiredString } from './validation'

export type BillingLineInput = {
  description: unknown
  quantity: unknown
  unitPrice: unknown
}

export type CalculatedBillingLine = {
  position: number
  description: string
  quantity: string
  unitPrice: string
  lineTotal: string
}

export type BillingTotals = {
  lines: CalculatedBillingLine[]
  subtotal: string
  taxRate: string
  taxAmount: string
  total: string
}

const ZERO = BigInt(0)
const ONE = BigInt(1)
const TEN = BigInt(10)
const FIFTY = BigInt(50)
const HUNDRED = BigInt(100)
const FIVE_THOUSAND = BigInt(5000)
const TEN_THOUSAND = BigInt(10000)

function scaledInteger(value: unknown, scale: number, label: string, allowZero = false): bigint {
  const raw = String(value ?? '').trim().replace(',', '.')

  if (!/^\d+(?:\.\d+)?$/.test(raw)) {
    badRequest(`${label} doit être un nombre positif.`)
  }

  const [wholeRaw, fractionRaw = ''] = raw.split('.')
  const factor = TEN ** BigInt(scale)
  const padded = `${fractionRaw}${'0'.repeat(scale)}`.slice(0, scale + 1)
  const retained = padded.slice(0, scale)
  const nextDigit = Number(padded[scale] || '0')
  let result = BigInt(wholeRaw || '0') * factor + BigInt(retained || '0')

  if (nextDigit >= 5) {
    result += ONE
  }

  if (allowZero ? result < ZERO : result <= ZERO) {
    badRequest(`${label} doit être ${allowZero ? 'positif' : 'strictement positif'}.`)
  }

  return result
}

function scaledString(value: bigint, scale: number): string {
  const factor = TEN ** BigInt(scale)
  const whole = value / factor
  const fraction = (value % factor).toString().padStart(scale, '0')
  return scale === 0 ? whole.toString() : `${whole}.${fraction}`
}

export function calculateBillingTotals(
  rawLines: unknown,
  rawTaxRate: unknown = 0,
): BillingTotals {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    badRequest('Au moins une ligne de facturation est obligatoire.')
  }

  if (rawLines.length > 100) {
    badRequest('Un document de facturation ne peut pas dépasser 100 lignes.')
  }

  const taxBasisPoints = scaledInteger(rawTaxRate, 2, 'Taux de TVA', true)

  if (taxBasisPoints > TEN_THOUSAND) {
    badRequest('Le taux de TVA ne peut pas dépasser 100 %.')
  }

  let subtotalCents = ZERO
  const lines = rawLines.map((rawLine, index) => {
    if (!rawLine || typeof rawLine !== 'object' || Array.isArray(rawLine)) {
      badRequest(`Ligne ${index + 1} invalide.`)
    }

    const line = rawLine as BillingLineInput
    const description = requiredString(line.description, `Description ligne ${index + 1}`, { max: 500 })
    const quantityHundredths = scaledInteger(line.quantity, 2, `Quantité ligne ${index + 1}`)
    const unitPriceCents = scaledInteger(line.unitPrice, 2, `Prix unitaire ligne ${index + 1}`, true)
    const lineTotalCents = (unitPriceCents * quantityHundredths + FIFTY) / HUNDRED

    subtotalCents += lineTotalCents

    return {
      position: index + 1,
      description,
      quantity: scaledString(quantityHundredths, 2),
      unitPrice: scaledString(unitPriceCents, 2),
      lineTotal: scaledString(lineTotalCents, 2),
    }
  })

  const taxAmountCents = (subtotalCents * taxBasisPoints + FIVE_THOUSAND) / TEN_THOUSAND
  const totalCents = subtotalCents + taxAmountCents

  return {
    lines,
    subtotal: scaledString(subtotalCents, 2),
    taxRate: scaledString(taxBasisPoints, 2),
    taxAmount: scaledString(taxAmountCents, 2),
    total: scaledString(totalCents, 2),
  }
}

export async function nextBillingNumber(
  tx: Prisma.TransactionClient,
  associationId: string,
  kind: 'QUOTE' | 'INVOICE',
  issueDate: Date,
): Promise<string> {
  const year = issueDate.getUTCFullYear()

  await tx.billingSequence.upsert({
    where: {
      associationId_kind_year: {
        associationId,
        kind,
        year,
      },
    },
    create: {
      associationId,
      kind,
      year,
      lastNumber: 0,
    },
    update: {},
  })

  const sequence = await tx.billingSequence.update({
    where: {
      associationId_kind_year: {
        associationId,
        kind,
        year,
      },
    },
    data: {
      lastNumber: { increment: 1 },
    },
    select: { lastNumber: true },
  })

  const prefix = kind === 'QUOTE' ? 'DEV' : 'FAC'
  return `${prefix}-${year}-${String(sequence.lastNumber).padStart(4, '0')}`
}
