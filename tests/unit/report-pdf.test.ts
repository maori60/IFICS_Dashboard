import { describe, expect, it } from 'vitest'
import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import { generateReportPdf, type ReportPdfInput } from '../../server/utils/pdf'

const base: ReportPdfInput = {
  title: 'Bilan de séance',
  projectTitle: 'Projet test IFICS',
  intervenorName: 'Intervenant test',
  sessionDate: new Date('2026-10-10T12:00:00Z'),
  studentsCount: 4,
  content: 'Compte rendu de séance de test.',
  version: 1,
  associationName: 'IFICS',
}

async function pdfContent(bytes: Uint8Array): Promise<string> {
  const document = await PDFDocument.load(bytes)
  const streams: string[] = []

  for (const page of document.getPages()) {
    const contents = page.node.get(PDFName.of('Contents'))
    if (!contents) continue

    const resolved = document.context.lookup(contents)
    const references = resolved instanceof PDFRawStream
      ? [contents]
      : 'asArray' in resolved && typeof resolved.asArray === 'function'
        ? resolved.asArray()
        : []

    for (const reference of references) {
      const stream = document.context.lookup(reference)
      if (stream instanceof PDFRawStream) {
        streams.push(new TextDecoder().decode(decodePDFRawStream(stream).decode()))
      }
    }
  }

  const decoder = new TextDecoder('windows-1252')
  const extracted: string[] = []

  for (const stream of streams) {
    for (const match of stream.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      const hex = match[1]
      if (!hex || hex.length % 2 !== 0) continue

      const bytes = Uint8Array.from(
        hex.match(/.{2}/g) ?? [],
        value => Number.parseInt(value, 16),
      )

      extracted.push(decoder.decode(bytes))
    }
  }

  return extracted.join('\\n')
}


describe('Mentions officielles des bilans', () => {
  const official = {
    reference: 'IFICS-BILAN-2026-ABCDEF1234567890ABCDEF12',
    validatedAt: new Date('2026-10-10T15:00:00.000Z'),
  }

  it('affiche la référence et la validation dans le PDF officiel', async () => {
    const bytes = await generateReportPdf({
      ...base,
      official,
    })

    const content = await pdfContent(bytes)

    expect(content).toContain('BILAN OFFICIELLEMENT VALIDÉ')
    expect(content).toContain(official.reference)
    expect(content).toContain('Validation :')
    expect(content).toContain('Version 1')
  })

  it('ne présente pas un bilan provisoire comme validé', async () => {
    const bytes = await generateReportPdf(base)
    const content = await pdfContent(bytes)

    expect(content).not.toContain('BILAN OFFICIELLEMENT VALIDÉ')
    expect(content).not.toContain('IFICS-BILAN-')
    expect(content).not.toContain('Validation :')
  })

  it('préserve les horaires et le contenu du bilan officiel', async () => {
    const bytes = await generateReportPdf({
      ...base,
      startTime: '09:30',
      endTime: '12:00',
      content: 'Atelier pédagogique réalisé.',
      official,
    })

    const content = await pdfContent(bytes)

    expect(content).toContain('Horaires : 09:30 - 12:00')
    expect(content).toContain('Atelier pédagogique réalisé.')
    expect(content).toContain(official.reference)
  })
})

describe('Génération PDF des bilans', () => {
  const cases = [
    {
      name: 'début et fin',
      startTime: '09:30',
      endTime: '12:00',
    },
    {
      name: 'début uniquement',
      startTime: '09:30',
      endTime: null,
    },
    {
      name: 'fin uniquement',
      startTime: null,
      endTime: '12:00',
    },
    {
      name: 'sans horaires',
      startTime: null,
      endTime: null,
    },
  ]

  for (const scenario of cases) {
    it(`génère un PDF valide : ${scenario.name}`, async () => {
      const bytes = await generateReportPdf({
        ...base,
        startTime: scenario.startTime,
        endTime: scenario.endTime,
      })

      expect(bytes.length).toBeGreaterThan(100)
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')

      const document = await PDFDocument.load(bytes)
      expect(document.getPageCount()).toBeGreaterThanOrEqual(1)

      const content = await pdfContent(bytes)
      const expected = scenario.startTime && scenario.endTime
        ? `Horaires : ${scenario.startTime} - ${scenario.endTime}`
        : scenario.startTime
          ? `Horaires : Début : ${scenario.startTime}`
          : scenario.endTime
            ? `Horaires : Fin : ${scenario.endTime}`
            : null

      if (expected) {
        expect(content).toContain(expected)
      } else {
        expect(content).not.toContain('Horaires :')
      }
    })
  }
})
