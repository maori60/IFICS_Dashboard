export type PaymentTaxInput = {
  billingDocumentId: string
  paymentCents: bigint
  paidAt: Date
  invoiceTotalCents: bigint
  invoiceTaxCents: bigint
}

function proportionalTaxCents(
  paidCents: bigint,
  totalCents: bigint,
  taxCents: bigint,
): bigint {
  if (
    paidCents <= BigInt(0)
    || totalCents <= BigInt(0)
    || taxCents <= BigInt(0)
  ) {
    return BigInt(0)
  }

  const effectivePaidCents =
    paidCents > totalCents
      ? totalCents
      : paidCents

  const taxShare =
    (
      effectivePaidCents * taxCents
      + totalCents / BigInt(2)
    )
    / totalCents

  return taxShare > taxCents
    ? taxCents
    : taxShare
}

/**
 * Calcule la TVA correspondant aux règlements reçus
 * dans une fenêtre comptable.
 *
 * Les paiements fournis doivent contenir tout l'historique
 * utile jusqu'à la fin de la fenêtre.
 *
 * Pour chaque facture :
 *
 * TVA période =
 *   TVA cumulée jusqu'à la fin
 *   - TVA cumulée avant le début
 *
 * Cette méthode évite :
 * - de recompter de la TVA après un règlement antérieur ;
 * - les incohérences d'arrondi entre plusieurs périodes ;
 * - de dépasser la TVA totale de la facture.
 *
 * Ce calcul ne décide pas du régime fiscal applicable
 * à l'organisation.
 */
export function collectedTaxFromPayments(
  payments: PaymentTaxInput[],
  from: Date | null = null,
): bigint {
  const byInvoice = new Map<
    string,
    {
      paidBeforeCents: bigint
      paidThroughCents: bigint
      totalCents: bigint
      taxCents: bigint
    }
  >()

  for (const payment of payments) {
    let invoice =
      byInvoice.get(
        payment.billingDocumentId,
      )

    if (!invoice) {
      invoice = {
        paidBeforeCents: BigInt(0),
        paidThroughCents: BigInt(0),
        totalCents:
          payment.invoiceTotalCents,
        taxCents:
          payment.invoiceTaxCents,
      }

      byInvoice.set(
        payment.billingDocumentId,
        invoice,
      )
    }

    invoice.paidThroughCents +=
      payment.paymentCents

    /*
     * Un paiement exactement à la date/heure de début
     * appartient à la période courante.
     */
    if (
      from
      && payment.paidAt < from
    ) {
      invoice.paidBeforeCents +=
        payment.paymentCents
    }
  }

  let result = BigInt(0)

  for (const invoice of byInvoice.values()) {
    const taxThrough =
      proportionalTaxCents(
        invoice.paidThroughCents,
        invoice.totalCents,
        invoice.taxCents,
      )

    const taxBefore =
      proportionalTaxCents(
        invoice.paidBeforeCents,
        invoice.totalCents,
        invoice.taxCents,
      )

    result += taxThrough - taxBefore
  }

  return result
}
