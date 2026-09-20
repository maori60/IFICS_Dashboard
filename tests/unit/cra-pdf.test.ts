import { PDFDocument, StandardFonts } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  generateCraPdf,
  type CraPdfInput,
} from '../../server/utils/cra-pdf'

async function createSignaturePdf(
  pages = 1,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.HelveticaBold)

  for (let index = 0; index < pages; index += 1) {
    const page = pdf.addPage([220, 90])

    page.drawText('Signature IFICS', {
      x: 18,
      y: 35,
      size: 18,
      font,
    })
  }

  return pdf.save()
}

function createBaseInput(
  signature: Uint8Array,
): CraPdfInput {
  return {
    reference: 'CRA-2026-09-TEST01-V1',
    generatedAt: new Date('2026-09-20T14:00:00.000Z'),
    ificsVisaDate: '2026-09-30',
    intervenorSignatureDate: '2026-09-30',
    year: 2026,
    month: 9,

    association: {
      name: 'IFICS',
      legalName: 'IFICS France',
      pdfFooter: 'IFICS France - Association loi 1901',
    },

    signature: {
      bytes: signature,
      mimeType: 'application/pdf',
    },

    intervenor: {
      firstName: 'Van',
      lastName: 'Bui',
    },

    project: {
      reference: 'PRJ-2026-001',
      title: 'Mission de développement Full Stack',
    },

    client: {
      name: 'Client partenaire',
      serviceName: 'Direction numérique',
    },

    days: [
      {
        date: '2026-09-01',
        dayType: 'WORK',
        durationMinutes: 420,
        comment: 'Développement du module CRA.',
        hasIncident: false,
        incident: null,
      },
      {
        date: '2026-09-02',
        dayType: 'TRAINING',
        durationMinutes: 420,
        comment: 'Formation technique.',
        hasIncident: false,
        incident: null,
      },
      {
        date: '2026-09-03',
        dayType: 'PAID_LEAVE',
        durationMinutes: 420,
        comment: null,
        hasIncident: false,
        incident: null,
      },
    ],

    summary: {
      declaredDays: 3,
      workedDays: 1,
      workedMinutes: 420,
      trainingDays: 1,
      trainingMinutes: 420,
      absenceDays: 1,
      paidLeaveDays: 1,
      rttDays: 0,
      sickLeaveDays: 0,
      authorizedAbsenceDays: 0,
      unjustifiedAbsenceDays: 0,
      otherAbsenceDays: 0,
      publicHolidayDays: 0,
    },
  }
}

describe('generateCraPdf', () => {
  it('génère un CRA PDF lisible avec une signature PDF', async () => {
    const signature = await createSignaturePdf()
    const bytes = await generateCraPdf(
      createBaseInput(signature),
    )

    const document = await PDFDocument.load(bytes)

    expect(bytes.byteLength).toBeGreaterThan(1_000)
    expect(document.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('pagine un CRA contenant de nombreuses lignes détaillées', async () => {
    const signature = await createSignaturePdf()

    const days = Array.from(
      { length: 31 },
      (_, index) => ({
        date: `2026-09-${String(
          Math.min(index + 1, 30),
        ).padStart(2, '0')}`,
        dayType: index % 5 === 0
          ? 'TRAINING'
          : 'WORK',
        durationMinutes: 420,
        comment:
          `Journée ${index + 1} avec une description détaillée permettant `
          + 'de vérifier la pagination automatique du document CRA.',
        hasIncident: index === 12,
        incident: index === 12
          ? 'Incident de test documenté dans le CRA.'
          : null,
      }),
    )

    const bytes = await generateCraPdf({
      ...createBaseInput(signature),
      days,
      summary: {
        declaredDays: 31,
        workedDays: 24,
        workedMinutes: 24 * 420,
        trainingDays: 7,
        trainingMinutes: 7 * 420,
        absenceDays: 0,
        paidLeaveDays: 0,
        rttDays: 0,
        sickLeaveDays: 0,
        authorizedAbsenceDays: 0,
        unjustifiedAbsenceDays: 0,
        otherAbsenceDays: 0,
        publicHolidayDays: 0,
      },
    })

    const document = await PDFDocument.load(bytes)

    expect(document.getPageCount()).toBeGreaterThan(1)
  })

  it('refuse une signature PDF contenant plusieurs pages', async () => {
    const signature = await createSignaturePdf(2)

    await expect(
      generateCraPdf(createBaseInput(signature)),
    ).rejects.toThrow(
      'La signature PDF doit contenir exactement une page.',
    )
  })
})
