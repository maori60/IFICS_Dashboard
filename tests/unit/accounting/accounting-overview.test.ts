import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  collectedTaxFromPayments,
} from '../../../server/utils/accounting-overview'

describe('collectedTaxFromPayments', () => {
  it('retourne 0 sans règlement', () => {
    expect(
      collectedTaxFromPayments([]),
    ).toBe(BigInt(0))
  })

  it('calcule la TVA d’un règlement intégral', () => {
    expect(
      collectedTaxFromPayments([
        {
          billingDocumentId: 'invoice-1',
          paidAt: new Date('2026-09-15T12:00:00.000Z'),
          paymentCents: BigInt(46500),
          invoiceTotalCents: BigInt(46500),
          invoiceTaxCents: BigInt(7500),
        },
      ]),
    ).toBe(BigInt(7500))
  })

  it('calcule la quote-part de TVA d’un règlement partiel', () => {
    expect(
      collectedTaxFromPayments([
        {
          billingDocumentId: 'invoice-1',
          paidAt: new Date('2026-09-15T12:00:00.000Z'),
          paymentCents: BigInt(23250),
          invoiceTotalCents: BigInt(46500),
          invoiceTaxCents: BigInt(7500),
        },
      ]),
    ).toBe(BigInt(3750))
  })

  it('cumule plusieurs règlements de la même facture avant calcul', () => {
    expect(
      collectedTaxFromPayments([
        {
          billingDocumentId: 'invoice-1',
          paidAt: new Date('2026-09-15T12:00:00.000Z'),
          paymentCents: BigInt(10000),
          invoiceTotalCents: BigInt(46500),
          invoiceTaxCents: BigInt(7500),
        },
        {
          billingDocumentId: 'invoice-1',
          paidAt: new Date('2026-09-15T12:00:00.000Z'),
          paymentCents: BigInt(36500),
          invoiceTotalCents: BigInt(46500),
          invoiceTaxCents: BigInt(7500),
        },
      ]),
    ).toBe(BigInt(7500))
  })

  it('plafonne la TVA en cas de trop-perçu', () => {
    expect(
      collectedTaxFromPayments([
        {
          billingDocumentId: 'invoice-1',
          paidAt: new Date('2026-09-15T12:00:00.000Z'),
          paymentCents: BigInt(60000),
          invoiceTotalCents: BigInt(46500),
          invoiceTaxCents: BigInt(7500),
        },
      ]),
    ).toBe(BigInt(7500))
  })

  it('ignore une facture sans TVA', () => {
    expect(
      collectedTaxFromPayments([
        {
          billingDocumentId: 'invoice-1',
          paidAt: new Date('2026-09-15T12:00:00.000Z'),
          paymentCents: BigInt(46500),
          invoiceTotalCents: BigInt(46500),
          invoiceTaxCents: BigInt(0),
        },
      ]),
    ).toBe(BigInt(0))
  })

  it('additionne correctement plusieurs factures', () => {
    expect(
      collectedTaxFromPayments([
        {
          billingDocumentId: 'invoice-1',
          paidAt: new Date('2026-09-15T12:00:00.000Z'),
          paymentCents: BigInt(46500),
          invoiceTotalCents: BigInt(46500),
          invoiceTaxCents: BigInt(7500),
        },
        {
          billingDocumentId: 'invoice-2',
          paidAt: new Date('2026-09-15T12:00:00.000Z'),
          paymentCents: BigInt(12000),
          invoiceTotalCents: BigInt(12000),
          invoiceTaxCents: BigInt(2000),
        },
      ]),
    ).toBe(BigInt(9500))
  })
  it('attribue uniquement au mois courant la TVA du solde encaissé', () => {
    const from =
      new Date('2026-09-01T00:00:00.000Z')

    expect(
      collectedTaxFromPayments(
        [
          {
            billingDocumentId: 'invoice-1',
            paidAt:
              new Date('2026-08-15T12:00:00.000Z'),
            paymentCents: BigInt(23250),
            invoiceTotalCents: BigInt(46500),
            invoiceTaxCents: BigInt(7500),
          },
          {
            billingDocumentId: 'invoice-1',
            paidAt:
              new Date('2026-09-15T12:00:00.000Z'),
            paymentCents: BigInt(23250),
            invoiceTotalCents: BigInt(46500),
            invoiceTaxCents: BigInt(7500),
          },
        ],
        from,
      ),
    ).toBe(BigInt(3750))
  })

  it('ne recompte aucune TVA après paiement intégral antérieur', () => {
    const from =
      new Date('2026-09-01T00:00:00.000Z')

    expect(
      collectedTaxFromPayments(
        [
          {
            billingDocumentId: 'invoice-1',
            paidAt:
              new Date('2026-08-15T12:00:00.000Z'),
            paymentCents: BigInt(46500),
            invoiceTotalCents: BigInt(46500),
            invoiceTaxCents: BigInt(7500),
          },
          {
            billingDocumentId: 'invoice-1',
            paidAt:
              new Date('2026-09-15T12:00:00.000Z'),
            paymentCents: BigInt(1000),
            invoiceTotalCents: BigInt(46500),
            invoiceTaxCents: BigInt(7500),
          },
        ],
        from,
      ),
    ).toBe(BigInt(0))
  })

  it('conserve les arrondis par différence de cumul entre périodes', () => {
    const september =
      new Date('2026-09-01T00:00:00.000Z')

    const payments = [
      {
        billingDocumentId: 'invoice-rounding',
        paidAt:
          new Date('2026-08-15T12:00:00.000Z'),
        paymentCents: BigInt(1),
        invoiceTotalCents: BigInt(3),
        invoiceTaxCents: BigInt(1),
      },
      {
        billingDocumentId: 'invoice-rounding',
        paidAt:
          new Date('2026-09-15T12:00:00.000Z'),
        paymentCents: BigInt(2),
        invoiceTotalCents: BigInt(3),
        invoiceTaxCents: BigInt(1),
      },
    ]

    const augustTax =
      collectedTaxFromPayments(
        [payments[0]!],
      )

    const septemberTax =
      collectedTaxFromPayments(
        payments,
        september,
      )

    expect(
      augustTax + septemberTax,
    ).toBe(BigInt(1))
  })

})
