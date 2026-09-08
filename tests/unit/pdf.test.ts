import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { fitDimensions, generateBillingPdf } from '../../server/utils/pdf'

describe('fitDimensions', () => {
  it('preserves the image aspect ratio inside the requested bounds', () => {
    const fitted = fitDimensions(400, 200, 118, 62)

    expect(fitted.width).toBeCloseTo(118)
    expect(fitted.height).toBeCloseTo(59)
    expect(fitted.width / fitted.height).toBeCloseTo(2)
  })

  it('does not upscale an image that already fits', () => {
    expect(fitDimensions(80, 40, 118, 62)).toEqual({ width: 80, height: 40 })
  })

  it('returns zero dimensions for invalid source dimensions', () => {
    expect(fitDimensions(0, 40, 118, 62)).toEqual({ width: 0, height: 0 })
  })
})

describe('generateBillingPdf', () => {
  const baseInput = {
    kind: 'INVOICE' as const,
    number: 'FAC-2026-0012',
    issueDate: '2026-09-08',
    dueDate: '2026-10-08',
    currency: 'EUR',
    subject: 'Ateliers pédagogiques et accompagnement terrain',
    notes: 'Merci pour votre confiance.',
    subtotal: 1000,
    taxRate: 0,
    taxAmount: 0,
    total: 1000,
    association: {
      name: 'IFICS',
      legalName: 'IFICS France',
      billingAddress: '1 rue de la Transmission',
      billingPostalCode: '75000',
      billingCity: 'Paris',
      billingCountry: 'France',
      billingEmail: 'contact@example.org',
      siret: '12345678900012',
      pdfFooter: 'IFICS France · Association loi 1901 · SIRET 12345678900012',
    },
    finance: {
      legalForm: 'Association loi 1901',
      rnaNumber: 'W123456789',
      bankName: 'Banque IFICS',
      bankAccountHolder: 'IFICS France',
      iban: 'FR7612345678901234567890123',
      bic: 'ABCDEFGHXXX',
      paymentTerms: 'Règlement par virement bancaire à réception de la facture.',
      taxExemptionText: 'TVA non applicable selon la situation fiscale configurée par IFICS.',
    },
    client: {
      name: 'Collectivité partenaire',
      serviceName: 'Service jeunesse',
      addressLine1: '10 avenue du Partenariat',
      postalCode: '75001',
      city: 'Paris',
      country: 'France',
    },
    lines: [
      { position: 1, description: 'Animation de cinq ateliers éducatifs', quantity: 5, unitPrice: 200, lineTotal: 1000 },
    ],
  }

  it('produces a readable PDF invoice with French-formatted amounts', async () => {
    const bytes = await generateBillingPdf(baseInput)
    const document = await PDFDocument.load(bytes)

    expect(bytes.byteLength).toBeGreaterThan(1_000)
    expect(document.getPageCount()).toBe(1)
  })

  it('creates additional pages when the invoice contains many lines', async () => {
    const lines = Array.from({ length: 45 }, (_, index) => ({
      position: index + 1,
      description: `Ligne de prestation ${index + 1} avec un descriptif suffisamment détaillé pour vérifier la pagination automatique du document`,
      quantity: 1,
      unitPrice: 25,
      lineTotal: 25,
    }))

    const bytes = await generateBillingPdf({
      ...baseInput,
      subtotal: 1125,
      total: 1125,
      lines,
    })
    const document = await PDFDocument.load(bytes)

    expect(document.getPageCount()).toBeGreaterThan(1)
  })
})
