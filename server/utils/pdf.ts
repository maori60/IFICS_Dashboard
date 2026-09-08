import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 44
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FOOTER_SAFE_Y = 66

const COLORS = {
  green: rgb(0.07, 0.23, 0.16),
  greenSoft: rgb(0.93, 0.97, 0.94),
  greenLine: rgb(0.80, 0.88, 0.83),
  gold: rgb(0.79, 0.60, 0.27),
  ink: rgb(0.09, 0.13, 0.11),
  muted: rgb(0.36, 0.42, 0.39),
  border: rgb(0.86, 0.90, 0.87),
  surface: rgb(0.98, 0.99, 0.98),
  white: rgb(1, 1, 1),
}

function safeText(value: unknown): string {
  return Array.from(String(value ?? ''))
    .map((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127 ? ' ' : character
    })
    .join('')
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safeText(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) current = candidate
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
  options: {
    font: PDFFont
    size: number
    maxWidth: number
    lineHeight?: number
    color?: ReturnType<typeof rgb>
  },
): number {
  const lineHeight = options.lineHeight ?? options.size * 1.35
  const lines = wrapText(text, options.font, options.size, options.maxWidth)
  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * lineHeight,
      size: options.size,
      font: options.font,
      color: options.color ?? COLORS.ink,
    })
  })
  return y - lines.length * lineHeight
}

function drawRightAligned(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  font: PDFFont,
  size: number,
  color = COLORS.ink,
) {
  const value = safeText(text)
  page.drawText(value, {
    x: rightX - font.widthOfTextAtSize(value, size),
    y,
    size,
    font,
    color,
  })
}

export function fitDimensions(width: number, height: number, maxWidth: number, maxHeight: number) {
  if (width <= 0 || height <= 0 || maxWidth <= 0 || maxHeight <= 0) return { width: 0, height: 0 }
  const factor = Math.min(maxWidth / width, maxHeight / height, 1)
  return { width: width * factor, height: height * factor }
}

function formatMoney(value: unknown, currency = 'EUR'): string {
  const number = Number(value)
  return safeText(new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(Number.isFinite(number) ? number : 0))
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : safeText(new Intl.DateTimeFormat('fr-FR').format(date))
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
    billingPhone?: string | null
    siret?: string | null
    pdfFooter?: string | null
  }
  finance?: {
    legalForm?: string | null
    rnaNumber?: string | null
    vatNumber?: string | null
    bankName?: string | null
    bankAccountHolder?: string | null
    iban?: string | null
    bic?: string | null
    paymentTerms?: string | null
    taxExemptionText?: string | null
  } | null
  logo?: { bytes: Uint8Array; mimeType: 'image/png' | 'image/jpeg' } | null
  client: {
    name: string
    serviceName?: string | null
    siret?: string | null
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

  const issuer = input.association.billingName || input.association.legalName || input.association.name
  const title = input.kind === 'QUOTE' ? 'DEVIS' : 'FACTURE'
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  const addPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    y = PAGE_HEIGHT - MARGIN
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: COLORS.green })
    page.drawText(`${title} ${safeText(input.number)}`, { x: MARGIN, y, size: 10, font: bold, color: COLORS.green })
    y -= 30
  }

  const ensureSpace = (height: number) => {
    if (y - height < FOOTER_SAFE_Y) addPage()
  }

  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: COLORS.green })

  let logoWidth = 0
  if (input.logo) {
    try {
      const image = input.logo.mimeType === 'image/png'
        ? await pdf.embedPng(input.logo.bytes)
        : await pdf.embedJpg(input.logo.bytes)
      const natural = image.scale(1)
      const fitted = fitDimensions(natural.width, natural.height, 118, 62)
      logoWidth = fitted.width
      page.drawImage(image, {
        x: MARGIN,
        y: y - fitted.height + 3,
        width: fitted.width,
        height: fitted.height,
      })
    }
    catch {
      logoWidth = 0
    }
  }

  if (!logoWidth) {
    page.drawRectangle({ x: MARGIN, y: y - 45, width: 45, height: 45, color: COLORS.green })
    page.drawText('I', { x: MARGIN + 18, y: y - 31, size: 22, font: bold, color: COLORS.white })
    page.drawText('IFICS', { x: MARGIN + 56, y: y - 18, size: 18, font: bold, color: COLORS.green })
    page.drawText('Association', { x: MARGIN + 56, y: y - 34, size: 8, font: regular, color: COLORS.muted })
  }

  const titleRight = PAGE_WIDTH - MARGIN
  drawRightAligned(page, title, titleRight, y - 8, bold, 25, COLORS.green)
  drawRightAligned(page, safeText(input.number), titleRight, y - 31, bold, 11, COLORS.ink)
  drawRightAligned(page, input.kind === 'QUOTE' ? 'Document commercial' : 'Document de facturation', titleRight, y - 47, regular, 8, COLORS.muted)
  y -= 82

  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1.2, color: COLORS.greenLine })
  y -= 22

  const leftX = MARGIN
  const leftWidth = 230
  const rightX = 322
  const rightWidth = PAGE_WIDTH - MARGIN - rightX

  page.drawText('ÉMETTEUR', { x: leftX, y, size: 7.5, font: bold, color: COLORS.green })
  page.drawText('DESTINATAIRE', { x: rightX + 14, y, size: 7.5, font: bold, color: COLORS.green })
  y -= 18

  const issuerTop = y
  page.drawText(safeText(issuer), { x: leftX, y, size: 11.5, font: bold, color: COLORS.ink })
  let issuerY = y - 16
  const issuerLines = [
    input.finance?.legalForm,
    input.association.billingAddress,
    [input.association.billingPostalCode, input.association.billingCity].filter(Boolean).join(' '),
    input.association.billingCountry,
    input.association.billingEmail,
    input.association.billingPhone,
    input.association.siret ? `SIRET : ${input.association.siret}` : null,
    input.finance?.rnaNumber ? `RNA : ${input.finance.rnaNumber}` : null,
    input.finance?.vatNumber ? `TVA intracommunautaire : ${input.finance.vatNumber}` : null,
  ].filter(Boolean) as string[]

  issuerLines.forEach((line) => {
    issuerY = drawWrapped(page, line, leftX, issuerY, { font: regular, size: 8.3, maxWidth: leftWidth, lineHeight: 11, color: COLORS.muted })
  })

  const recipientLines = [
    input.client.name,
    input.client.serviceName,
    input.client.addressLine1,
    input.client.addressLine2,
    `${input.client.postalCode} ${input.client.city}`,
    input.client.country,
    input.client.siret ? `SIRET : ${input.client.siret}` : null,
  ].filter(Boolean) as string[]

  const recipientHeight = Math.max(104, 40 + recipientLines.length * 13)
  page.drawRectangle({
    x: rightX,
    y: issuerTop - recipientHeight + 12,
    width: rightWidth,
    height: recipientHeight,
    color: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
  })

  let clientY = issuerTop - 6
  recipientLines.forEach((line, index) => {
    clientY = drawWrapped(page, line, rightX + 14, clientY, {
      font: index === 0 ? bold : regular,
      size: index === 0 ? 10.5 : 8.5,
      maxWidth: rightWidth - 28,
      lineHeight: index === 0 ? 14 : 11.5,
      color: index === 0 ? COLORS.ink : COLORS.muted,
    })
  })

  y = Math.min(issuerY, issuerTop - recipientHeight) - 22

  const metadataHeight = 46
  ensureSpace(metadataHeight + 25)
  page.drawRectangle({ x: MARGIN, y: y - metadataHeight + 10, width: CONTENT_WIDTH, height: metadataHeight, color: COLORS.greenSoft })
  const metaTop = y - 5
  const metaColumns = [
    { label: "DATE D'ÉMISSION", value: formatDate(input.issueDate), x: MARGIN + 14 },
    { label: input.kind === 'QUOTE' ? 'VALIDITÉ / ÉCHÉANCE' : 'ÉCHÉANCE', value: input.dueDate ? formatDate(input.dueDate) : '—', x: MARGIN + 185 },
    { label: 'DEVISE', value: safeText(input.currency || 'EUR'), x: MARGIN + 370 },
  ]
  metaColumns.forEach((meta) => {
    page.drawText(meta.label, { x: meta.x, y: metaTop, size: 6.7, font: bold, color: COLORS.green })
    page.drawText(meta.value, { x: meta.x, y: metaTop - 15, size: 9.2, font: bold, color: COLORS.ink })
  })
  y -= metadataHeight + 6

  if (input.subject) {
    ensureSpace(55)
    page.drawText('OBJET', { x: MARGIN, y, size: 7.5, font: bold, color: COLORS.green })
    y = drawWrapped(page, input.subject, MARGIN, y - 16, { font: bold, size: 10.5, maxWidth: CONTENT_WIDTH, lineHeight: 14, color: COLORS.ink }) - 8
  }

  const descriptionX = MARGIN + 10
  const quantityRight = MARGIN + 353
  const unitRight = MARGIN + 430
  const totalRight = PAGE_WIDTH - MARGIN - 10

  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 22, width: CONTENT_WIDTH, height: 28, color: COLORS.green })
    page.drawText('DESCRIPTION', { x: descriptionX, y: y - 13, size: 7.5, font: bold, color: COLORS.white })
    drawRightAligned(page, 'QTÉ', quantityRight, y - 13, bold, 7.5, COLORS.white)
    drawRightAligned(page, 'PU HT', unitRight, y - 13, bold, 7.5, COLORS.white)
    drawRightAligned(page, 'TOTAL HT', totalRight, y - 13, bold, 7.5, COLORS.white)
    y -= 31
  }

  ensureSpace(70)
  drawTableHeader()

  for (const [index, line] of input.lines.entries()) {
    const descriptionLines = wrapText(line.description, regular, 8.8, 277)
    const rowHeight = Math.max(28, descriptionLines.length * 12 + 10)
    if (y - rowHeight < 180) {
      addPage()
      drawTableHeader()
    }

    if (index % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: y - rowHeight + 3, width: CONTENT_WIDTH, height: rowHeight, color: COLORS.surface })
    }

    descriptionLines.forEach((text, lineIndex) => {
      page.drawText(text, { x: descriptionX, y: y - 13 - lineIndex * 12, size: 8.8, font: regular, color: COLORS.ink })
    })
    drawRightAligned(page, String(line.quantity), quantityRight, y - 13, regular, 8.5, COLORS.ink)
    drawRightAligned(page, formatMoney(line.unitPrice, input.currency), unitRight, y - 13, regular, 8.3, COLORS.ink)
    drawRightAligned(page, formatMoney(line.lineTotal, input.currency), totalRight, y - 13, bold, 8.3, COLORS.ink)
    page.drawLine({
      start: { x: MARGIN, y: y - rowHeight + 3 },
      end: { x: PAGE_WIDTH - MARGIN, y: y - rowHeight + 3 },
      thickness: 0.55,
      color: COLORS.border,
    })
    y -= rowHeight
  }

  y -= 14
  ensureSpace(128)

  const totalsWidth = 202
  const totalsX = PAGE_WIDTH - MARGIN - totalsWidth
  page.drawRectangle({ x: totalsX, y: y - 91, width: totalsWidth, height: 98, color: COLORS.surface, borderColor: COLORS.border, borderWidth: 1 })

  const totals = [
    ['Total HT', formatMoney(input.subtotal, input.currency)],
    [`TVA (${Number(input.taxRate).toFixed(2)} %)`, formatMoney(input.taxAmount, input.currency)],
  ]
  let totalY = y - 16
  totals.forEach(([label, value]) => {
    page.drawText(label!, { x: totalsX + 14, y: totalY, size: 8.5, font: regular, color: COLORS.muted })
    drawRightAligned(page, value!, totalsX + totalsWidth - 14, totalY, bold, 8.5, COLORS.ink)
    totalY -= 20
  })

  page.drawRectangle({ x: totalsX, y: y - 91, width: totalsWidth, height: 37, color: COLORS.green })
  page.drawText('TOTAL TTC', { x: totalsX + 14, y: y - 77, size: 9, font: bold, color: COLORS.white })
  drawRightAligned(page, formatMoney(input.total, input.currency), totalsX + totalsWidth - 14, y - 78, bold, 12, COLORS.white)

  if (Number(input.taxRate) === 0 && input.finance?.taxExemptionText) {
    y = drawWrapped(page, input.finance.taxExemptionText, MARGIN, y - 12, {
      font: regular,
      size: 7.5,
      maxWidth: CONTENT_WIDTH - totalsWidth - 22,
      lineHeight: 10.5,
      color: COLORS.muted,
    })
  }
  y -= 102

  const paymentData = input.kind === 'INVOICE' && input.finance?.iban
    ? [
        `Titulaire : ${input.finance.bankAccountHolder || issuer}`,
        input.finance.bankName ? `Banque : ${input.finance.bankName}` : null,
        `IBAN : ${input.finance.iban}`,
        input.finance.bic ? `BIC : ${input.finance.bic}` : null,
      ].filter(Boolean) as string[]
    : []

  if (paymentData.length || input.finance?.paymentTerms) {
    ensureSpace(130)
    page.drawText('RÈGLEMENT', { x: MARGIN, y, size: 8, font: bold, color: COLORS.green })
    y -= 16
    const paymentBoxTop = y
    const paymentHeight = Math.max(58, paymentData.length * 12 + (input.finance?.paymentTerms ? 42 : 10))
    page.drawRectangle({ x: MARGIN, y: paymentBoxTop - paymentHeight + 8, width: CONTENT_WIDTH, height: paymentHeight, color: COLORS.greenSoft })

    let paymentY = paymentBoxTop - 8
    if (paymentData.length) {
      paymentData.forEach((line) => {
        page.drawText(safeText(line), { x: MARGIN + 14, y: paymentY, size: 8.2, font: regular, color: COLORS.ink })
        paymentY -= 12
      })
    }
    if (input.finance?.paymentTerms) {
      if (paymentData.length) paymentY -= 4
      page.drawText('Conditions :', { x: MARGIN + 14, y: paymentY, size: 7.8, font: bold, color: COLORS.green })
      paymentY = drawWrapped(page, input.finance.paymentTerms, MARGIN + 68, paymentY, {
        font: regular,
        size: 7.8,
        maxWidth: CONTENT_WIDTH - 86,
        lineHeight: 10.5,
        color: COLORS.ink,
      })
    }
    y = paymentBoxTop - paymentHeight - 8
  }

  if (input.notes) {
    ensureSpace(72)
    page.drawText('NOTES', { x: MARGIN, y, size: 8, font: bold, color: COLORS.green })
    y = drawWrapped(page, input.notes, MARGIN, y - 15, { font: regular, size: 8, maxWidth: CONTENT_WIDTH, lineHeight: 11, color: COLORS.muted }) - 8
  }

  const footerParts = [
    input.association.pdfFooter,
    !input.association.pdfFooter && input.association.siret ? `SIRET ${input.association.siret}` : null,
    !input.association.pdfFooter && input.finance?.rnaNumber ? `RNA ${input.finance.rnaNumber}` : null,
  ].filter(Boolean) as string[]
  const footer = footerParts.length ? footerParts.join(' · ') : `${issuer} · Document généré par IFICS`

  for (const [pageIndex, pdfPage] of pdf.getPages().entries()) {
    pdfPage.drawLine({
      start: { x: MARGIN, y: 48 },
      end: { x: PAGE_WIDTH - MARGIN, y: 48 },
      thickness: 0.6,
      color: COLORS.border,
    })
    const footerLines = wrapText(footer, regular, 6.5, CONTENT_WIDTH - 55).slice(0, 2)
    footerLines.forEach((line, index) => {
      pdfPage.drawText(line, { x: MARGIN, y: 34 - index * 8, size: 6.5, font: regular, color: COLORS.muted })
    })
    drawRightAligned(pdfPage, `${pageIndex + 1} / ${pdf.getPageCount()}`, PAGE_WIDTH - MARGIN, 30, regular, 6.5, COLORS.muted)
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
    lines.forEach((line, index) => page.drawText(line, { x: MARGIN, y: y - index * 14, size: 10, font: regular }))
    y -= height
  }

  for (const pdfPage of pdf.getPages()) {
    pdfPage.drawText(`${safeText(input.associationName)} — IFICS Dashboard`, { x: MARGIN, y: 28, size: 7, font: regular, color: rgb(0.45, 0.49, 0.57) })
  }

  return pdf.save()
}
