import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 48

function safeText(value: unknown): string {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safeText(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate
    }
    else {
      lines.push(current)
      current = word
    }
  }

  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  options: { font: PDFFont; size: number; maxWidth: number; lineHeight?: number },
): number {
  const lineHeight = options.lineHeight ?? options.size * 1.35
  const lines = wrapText(text, options.font, options.size, options.maxWidth)

  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * lineHeight,
      size: options.size,
      font: options.font,
      color: rgb(0.12, 0.16, 0.23),
    })
  })

  return y - lines.length * lineHeight
}

function formatMoney(value: unknown, currency = 'EUR'): string {
  const number = Number(value)
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(Number.isFinite(number) ? number : 0)
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR').format(date)
}

export type BillingPdfInput = {
  kind: 'QUOTE' | 'INVOICE'
  number: string
  issueDate: Date | string
  dueDate?: Date | string | null
  currency: string
  subject?: string | null
  notes?: string | null
  subtotal: unknown
  taxRate: unknown
  taxAmount: unknown
  total: unknown
  association: {
    name: string
    legalName?: string | null
    billingName?: string | null
    billingAddress?: string | null
    billingPostalCode?: string | null
    billingCity?: string | null
    billingCountry?: string | null
    billingEmail?: string | null
    siret?: string | null
    pdfFooter?: string | null
  }
  client: {
    name: string
    serviceName?: string | null
    addressLine1: string
    addressLine2?: string | null
    postalCode: string
    city: string
    country: string
  }
  lines: Array<{
    position: number
    description: string
    quantity: unknown
    unitPrice: unknown
    lineTotal: unknown
  }>
}

export async function generateBillingPdf(input: BillingPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  const title = input.kind === 'QUOTE' ? 'DEVIS' : 'FACTURE'
  page.drawText(title, { x: MARGIN, y, size: 24, font: bold, color: rgb(0.10, 0.29, 0.63) })
  page.drawText(input.number, { x: PAGE_WIDTH - MARGIN - 160, y: y + 2, size: 13, font: bold })
  y -= 42

  const issuer = input.association.billingName || input.association.legalName || input.association.name
  page.drawText(safeText(issuer), { x: MARGIN, y, size: 12, font: bold })
  y -= 16
  const issuerLines = [
    input.association.billingAddress,
    [input.association.billingPostalCode, input.association.billingCity].filter(Boolean).join(' '),
    input.association.billingCountry,
    input.association.billingEmail,
    input.association.siret ? `SIRET : ${input.association.siret}` : null,
  ].filter(Boolean) as string[]
  issuerLines.forEach((line) => {
    page.drawText(safeText(line), { x: MARGIN, y, size: 9, font: regular })
    y -= 13
  })

  const clientX = 335
  let clientY = PAGE_HEIGHT - MARGIN - 42
  page.drawText('DESTINATAIRE', { x: clientX, y: clientY, size: 9, font: bold, color: rgb(0.35, 0.39, 0.47) })
  clientY -= 17
  page.drawText(safeText(input.client.name), { x: clientX, y: clientY, size: 11, font: bold })
  clientY -= 15
  if (input.client.serviceName) {
    page.drawText(safeText(input.client.serviceName), { x: clientX, y: clientY, size: 9, font: regular })
    clientY -= 13
  }
  ;[
    input.client.addressLine1,
    input.client.addressLine2,
    `${input.client.postalCode} ${input.client.city}`,
    input.client.country,
  ].filter(Boolean).forEach((line) => {
    page.drawText(safeText(line), { x: clientX, y: clientY, size: 9, font: regular })
    clientY -= 13
  })

  y = Math.min(y, clientY) - 24
  page.drawText(`Émis le : ${formatDate(input.issueDate)}`, { x: MARGIN, y, size: 9, font: regular })
  if (input.dueDate) {
    page.drawText(`Échéance : ${formatDate(input.dueDate)}`, { x: 220, y, size: 9, font: regular })
  }
  y -= 26

  if (input.subject) {
    page.drawText('Objet', { x: MARGIN, y, size: 10, font: bold })
    y = drawWrapped(page, input.subject, MARGIN, y - 15, { font: regular, size: 10, maxWidth: PAGE_WIDTH - 2 * MARGIN }) - 10
  }

  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 18, width: PAGE_WIDTH - 2 * MARGIN, height: 24, color: rgb(0.94, 0.96, 1) })
    page.drawText('Description', { x: MARGIN + 6, y: y - 10, size: 9, font: bold })
    page.drawText('Qté', { x: 360, y: y - 10, size: 9, font: bold })
    page.drawText('PU', { x: 410, y: y - 10, size: 9, font: bold })
    page.drawText('Total', { x: 490, y: y - 10, size: 9, font: bold })
    y -= 30
  }

  drawTableHeader()

  for (const line of input.lines) {
    const descriptionLines = wrapText(line.description, regular, 9, 280)
    const rowHeight = Math.max(22, descriptionLines.length * 12 + 8)

    if (y - rowHeight < 150) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
      drawTableHeader()
    }

    descriptionLines.forEach((text, index) => {
      page.drawText(text, { x: MARGIN + 6, y: y - 10 - index * 12, size: 9, font: regular })
    })
    page.drawText(String(line.quantity), { x: 360, y: y - 10, size: 9, font: regular })
    page.drawText(formatMoney(line.unitPrice, input.currency), { x: 410, y: y - 10, size: 8, font: regular })
    page.drawText(formatMoney(line.lineTotal, input.currency), { x: 490, y: y - 10, size: 8, font: bold })
    page.drawLine({
      start: { x: MARGIN, y: y - rowHeight + 3 },
      end: { x: PAGE_WIDTH - MARGIN, y: y - rowHeight + 3 },
      thickness: 0.5,
      color: rgb(0.86, 0.88, 0.92),
    })
    y -= rowHeight
  }

  y -= 12
  const totalsX = 370
  const totals = [
    ['Sous-total', formatMoney(input.subtotal, input.currency)],
    [`TVA (${Number(input.taxRate).toFixed(2)} %)`, formatMoney(input.taxAmount, input.currency)],
    ['TOTAL', formatMoney(input.total, input.currency)],
  ]

  totals.forEach(([label, value], index) => {
    const font = index === totals.length - 1 ? bold : regular
    const size = index === totals.length - 1 ? 12 : 9
    page.drawText(label!, { x: totalsX, y, size, font })
    page.drawText(value!, { x: 480, y, size, font })
    y -= index === totals.length - 1 ? 24 : 17
  })

  if (input.notes) {
    y = Math.max(y - 10, 80)
    page.drawText('Notes', { x: MARGIN, y, size: 9, font: bold })
    drawWrapped(page, input.notes, MARGIN, y - 14, { font: regular, size: 8, maxWidth: 300 })
  }

  const footer = input.association.pdfFooter || `${issuer} — document généré par IFICS Dashboard`
  for (const pdfPage of pdf.getPages()) {
    pdfPage.drawText(safeText(footer).slice(0, 140), {
      x: MARGIN,
      y: 28,
      size: 7,
      font: regular,
      color: rgb(0.45, 0.49, 0.57),
    })
  }

  return pdf.save()
}

export type ReportPdfInput = {
  title: string
  projectTitle: string
  intervenorName?: string | null
  sessionDate: Date | string
  studentsCount?: number | null
  content: string
  version: number
  associationName: string
}

export async function generateReportPdf(input: ReportPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  const addPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    y = PAGE_HEIGHT - MARGIN
  }

  page.drawText(safeText(input.title || 'Bilan de séance'), { x: MARGIN, y, size: 22, font: bold, color: rgb(0.10, 0.29, 0.63) })
  y -= 32
  page.drawText(safeText(input.projectTitle), { x: MARGIN, y, size: 12, font: bold })
  y -= 18
  page.drawText(`Séance : ${formatDate(input.sessionDate)}${input.studentsCount !== null && input.studentsCount !== undefined ? ` — ${input.studentsCount} participant(s)` : ''}`, { x: MARGIN, y, size: 9, font: regular })
  y -= 15
  if (input.intervenorName) {
    page.drawText(`Intervenant : ${safeText(input.intervenorName)}`, { x: MARGIN, y, size: 9, font: regular })
    y -= 15
  }
  page.drawText(`Version ${input.version}`, { x: MARGIN, y, size: 8, font: regular, color: rgb(0.45, 0.49, 0.57) })
  y -= 28

  const paragraphs = input.content.split(/\n{2,}/)
  for (const paragraph of paragraphs) {
    const lines = wrapText(paragraph.replace(/\n/g, ' '), regular, 10, PAGE_WIDTH - 2 * MARGIN)
    const height = lines.length * 14 + 10

    if (y - height < 60) addPage()

    lines.forEach((line, index) => {
      page.drawText(line, { x: MARGIN, y: y - index * 14, size: 10, font: regular })
    })
    y -= height
  }

  for (const pdfPage of pdf.getPages()) {
    pdfPage.drawText(`${safeText(input.associationName)} — IFICS Dashboard`, {
      x: MARGIN,
      y: 28,
      size: 7,
      font: regular,
      color: rgb(0.45, 0.49, 0.57),
    })
  }

  return pdf.save()
}
