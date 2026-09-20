import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 42
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FOOTER_SAFE_Y = 58

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

const DAY_TYPE_LABELS: Record<string, string> = {
  WORK: 'Travail',
  PAID_LEAVE: 'Congé payé',
  RTT: 'RTT',
  SICK_LEAVE: 'Maladie',
  AUTHORIZED_ABSENCE: 'Absence autorisée',
  UNJUSTIFIED_ABSENCE: 'Absence injustifiée',
  TRAINING: 'Formation',
  PUBLIC_HOLIDAY: 'Jour férié',
  OTHER: 'Autre',
}

export type CraPdfSignature = {
  bytes: Uint8Array
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg'
}

export type CraPdfLogo = {
  bytes: Uint8Array
  mimeType: 'image/png' | 'image/jpeg'
}

export type CraPdfInput = {
  reference: string
  generatedAt: Date | string
  year: number
  month: number

  association: {
    name: string
    legalName?: string | null
    billingName?: string | null
    pdfFooter?: string | null
  }

  logo?: CraPdfLogo | null
  signature: CraPdfSignature

  intervenor: {
    firstName: string
    lastName: string
  }

  project: {
    title: string
    reference?: string | null
  }

  client?: {
    name: string
    serviceName?: string | null
  } | null

  days: Array<{
    date: Date | string
    dayType: string
    durationMinutes: number
    comment?: string | null
    hasIncident?: boolean
    incident?: string | null
  }>

  summary: {
    declaredDays: number
    workedDays: number
    workedMinutes: number
    trainingDays: number
    trainingMinutes: number
    absenceDays: number
    paidLeaveDays: number
    rttDays: number
    sickLeaveDays: number
    authorizedAbsenceDays: number
    unjustifiedAbsenceDays: number
    otherAbsenceDays: number
    publicHolidayDays: number
  }
}

function safeText(value: unknown): string {
  return Array.from(String(value ?? ''))
    .map((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127 ? ' ' : character
    })
    .join('')
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/[\u2018\u2019]/g, '\'')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitLongWord(
  word: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const chunks: string[] = []
  let current = ''

  for (const character of word) {
    const candidate = `${current}${character}`

    if (
      current
      && font.widthOfTextAtSize(candidate, size) > maxWidth
    ) {
      chunks.push(current)
      current = character
    }
    else {
      current = candidate
    }
  }

  if (current) chunks.push(current)

  return chunks.length ? chunks : ['']
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const rawWords = safeText(text).split(/\s+/).filter(Boolean)

  if (!rawWords.length) return ['']

  const words = rawWords.flatMap(word =>
    font.widthOfTextAtSize(word, size) > maxWidth
      ? splitLongWord(word, font, size, maxWidth)
      : [word],
  )

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word

    if (
      !current
      || font.widthOfTextAtSize(candidate, size) <= maxWidth
    ) {
      current = candidate
      continue
    }

    lines.push(current)
    current = word
  }

  if (current) lines.push(current)

  return lines
}

function boundedLines(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines = wrapText(text, font, size, maxWidth)

  if (lines.length <= maxLines) return lines

  const visible = lines.slice(0, maxLines)
  let last = visible[maxLines - 1] || ''

  while (
    last.length > 0
    && font.widthOfTextAtSize(`${last}...`, size) > maxWidth
  ) {
    last = last.slice(0, -1).trimEnd()
  }

  visible[maxLines - 1] = last ? `${last}...` : '...'

  return visible
}

function fittedFontSize(
  text: string,
  font: PDFFont,
  preferredSize: number,
  minimumSize: number,
  maxWidth: number,
): number {
  const value = safeText(text)
  let size = preferredSize

  while (
    size > minimumSize
    && font.widthOfTextAtSize(value, size) > maxWidth
  ) {
    size -= 0.25
  }

  return size
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

function fitInside(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
  allowUpscale = false,
) {
  if (
    width <= 0
    || height <= 0
    || maxWidth <= 0
    || maxHeight <= 0
  ) {
    return { width: 0, height: 0 }
  }

  const rawFactor = Math.min(maxWidth / width, maxHeight / height)
  const factor = allowUpscale
    ? rawFactor
    : Math.min(rawFactor, 1)

  return {
    width: width * factor,
    height: height * factor,
  }
}

function formatDuration(value: number): string {
  const minutes = Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0

  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60

  if (!remaining) return `${hours} h`
  if (!hours) return `${remaining} min`

  return `${hours} h ${String(remaining).padStart(2, '0')}`
}

function toDate(value: Date | string): Date {
  if (
    typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return new Date(`${value}T00:00:00.000Z`)
  }

  return value instanceof Date
    ? value
    : new Date(value)
}

function formatCraDate(value: Date | string): string {
  const date = toDate(value)

  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function formatGeneratedDate(value: Date | string): string {
  const date = value instanceof Date
    ? value
    : new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(date)
}

function periodLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

async function drawSignature(
  pdf: PDFDocument,
  page: PDFPage,
  signature: CraPdfSignature,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
): Promise<void> {
  if (signature.mimeType === 'application/pdf') {
    const source = await PDFDocument.load(signature.bytes, {
      ignoreEncryption: false,
      updateMetadata: false,
    })

    if (source.getPageCount() !== 1) {
      throw new Error(
        'La signature PDF doit contenir exactement une page.',
      )
    }

    const embedded = await pdf.embedPage(source.getPage(0))
    const fitted = fitInside(
      embedded.width,
      embedded.height,
      maxWidth,
      maxHeight,
      true,
    )

    const drawX = x + (maxWidth - fitted.width) / 2
    const drawY = y + (maxHeight - fitted.height) / 2

    page.drawPage(embedded, {
      x: drawX,
      y: drawY,
      width: fitted.width,
      height: fitted.height,
    })

    return
  }

  const image = signature.mimeType === 'image/png'
    ? await pdf.embedPng(signature.bytes)
    : await pdf.embedJpg(signature.bytes)

  const fitted = fitInside(
    image.width,
    image.height,
    maxWidth,
    maxHeight,
    true,
  )

  const drawX = x + (maxWidth - fitted.width) / 2
  const drawY = y + (maxHeight - fitted.height) / 2

  page.drawImage(image, {
    x: drawX,
    y: drawY,
    width: fitted.width,
    height: fitted.height,
  })
}

export async function generateCraPdf(
  input: CraPdfInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()

  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const issuer
    = input.association.billingName
      || input.association.legalName
      || input.association.name

  const generatedDate = formatGeneratedDate(input.generatedAt)

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  const addContinuationPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])

    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 8,
      width: PAGE_WIDTH,
      height: 8,
      color: COLORS.green,
    })

    page.drawText('COMPTE RENDU D\'ACTIVITE', {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN,
      size: 10,
      font: bold,
      color: COLORS.green,
    })

    drawRightAligned(
      page,
      input.reference,
      PAGE_WIDTH - MARGIN,
      PAGE_HEIGHT - MARGIN,
      bold,
      8,
      COLORS.muted,
    )

    y = PAGE_HEIGHT - MARGIN - 30
  }

  const ensureSpace = (height: number) => {
    if (y - height < FOOTER_SAFE_Y) {
      addContinuationPage()
    }
  }

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 8,
    width: PAGE_WIDTH,
    height: 8,
    color: COLORS.green,
  })

  let logoWidth = 0

  if (input.logo) {
    const logo = input.logo.mimeType === 'image/png'
      ? await pdf.embedPng(input.logo.bytes)
      : await pdf.embedJpg(input.logo.bytes)

    const fitted = fitInside(
      logo.width,
      logo.height,
      118,
      58,
    )

    logoWidth = fitted.width

    page.drawImage(logo, {
      x: MARGIN,
      y: y - fitted.height + 4,
      width: fitted.width,
      height: fitted.height,
    })
  }

  if (!logoWidth) {
    page.drawRectangle({
      x: MARGIN,
      y: y - 42,
      width: 42,
      height: 42,
      color: COLORS.green,
    })

    page.drawText('I', {
      x: MARGIN + 17,
      y: y - 29,
      size: 21,
      font: bold,
      color: COLORS.white,
    })

    page.drawText('IFICS', {
      x: MARGIN + 53,
      y: y - 17,
      size: 17,
      font: bold,
      color: COLORS.green,
    })

  }

  drawRightAligned(
    page,
    'COMPTE RENDU',
    PAGE_WIDTH - MARGIN,
    y - 4,
    bold,
    22,
    COLORS.green,
  )

  drawRightAligned(
    page,
    'D\'ACTIVITE',
    PAGE_WIDTH - MARGIN,
    y - 29,
    bold,
    22,
    COLORS.green,
  )

  drawRightAligned(
    page,
    input.reference,
    PAGE_WIDTH - MARGIN,
    y - 48,
    bold,
    8.5,
    COLORS.muted,
  )

  y -= 76

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1.2,
    color: COLORS.greenLine,
  })

  y -= 22

  page.drawRectangle({
    x: MARGIN,
    y: y - 96,
    width: CONTENT_WIDTH,
    height: 104,
    color: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
  })

  const leftX = MARGIN + 14
  const rightX = MARGIN + 268

  page.drawText('PERIODE', {
    x: leftX,
    y: y - 14,
    size: 7,
    font: bold,
    color: COLORS.green,
  })

  page.drawText(
    safeText(periodLabel(input.year, input.month)),
    {
      x: leftX,
      y: y - 31,
      size: 11,
      font: bold,
      color: COLORS.ink,
    },
  )

  page.drawText('INTERVENANT', {
    x: leftX,
    y: y - 51,
    size: 7,
    font: bold,
    color: COLORS.green,
  })

  const intervenorFullName
    = `${input.intervenor.firstName} ${input.intervenor.lastName}`

  const intervenorNameSize = fittedFontSize(
    intervenorFullName,
    bold,
    10,
    7.5,
    225,
  )

  page.drawText(
    safeText(intervenorFullName),
    {
      x: leftX,
      y: y - 68,
      size: intervenorNameSize,
      font: bold,
      color: COLORS.ink,
    },
  )

  page.drawText('PROJET / MISSION', {
    x: rightX,
    y: y - 14,
    size: 7,
    font: bold,
    color: COLORS.green,
  })

  const projectLabel = input.project.reference
    ? `${input.project.reference} - ${input.project.title}`
    : input.project.title

  const infoRightWidth = PAGE_WIDTH - MARGIN - rightX - 14

  const projectLines = boundedLines(
    projectLabel,
    bold,
    9.2,
    infoRightWidth,
    2,
  )

  projectLines.forEach((line, index) => {
    page.drawText(line, {
      x: rightX,
      y: y - 31 - index * 12,
      size: 9.5,
      font: bold,
      color: COLORS.ink,
    })
  })

  if (input.client) {
    page.drawText('CLIENT', {
      x: rightX,
      y: y - 61,
      size: 7,
      font: bold,
      color: COLORS.green,
    })

    const client = input.client.serviceName
      ? `${input.client.name} - ${input.client.serviceName}`
      : input.client.name

    const clientLines = boundedLines(
      client,
      regular,
      8.6,
      infoRightWidth,
      2,
    )

    clientLines.forEach((line, index) => {
      page.drawText(line, {
        x: rightX,
        y: y - 77 - index * 10.5,
        size: 8.6,
        font: regular,
        color: COLORS.ink,
      })
    })
  }

  y -= 122

  const dateX = MARGIN + 8
  const typeX = MARGIN + 83
  const durationRight = MARGIN + 261
  const detailX = MARGIN + 278
  const detailWidth = PAGE_WIDTH - MARGIN - detailX - 8

  const drawTableHeader = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - 21,
      width: CONTENT_WIDTH,
      height: 27,
      color: COLORS.green,
    })

    page.drawText('DATE', {
      x: dateX,
      y: y - 12,
      size: 7,
      font: bold,
      color: COLORS.white,
    })

    page.drawText('TYPE', {
      x: typeX,
      y: y - 12,
      size: 7,
      font: bold,
      color: COLORS.white,
    })

    drawRightAligned(
      page,
      'DUREE',
      durationRight,
      y - 12,
      bold,
      7,
      COLORS.white,
    )

    page.drawText('COMMENTAIRE / INCIDENT', {
      x: detailX,
      y: y - 12,
      size: 7,
      font: bold,
      color: COLORS.white,
    })

    y -= 30
  }

  drawTableHeader()

  if (!input.days.length) {
    page.drawText('Aucune journée déclarée.', {
      x: MARGIN + 10,
      y: y - 14,
      size: 9,
      font: regular,
      color: COLORS.muted,
    })

    y -= 32
  }

  for (const [index, day] of input.days.entries()) {
    const details: string[] = []

    if (day.comment) {
      details.push(day.comment)
    }

    if (day.hasIncident && day.incident) {
      details.push(`Incident : ${day.incident}`)
    }

    const detailLines = details.length
      ? wrapText(
          details.join(' - '),
          regular,
          7.6,
          detailWidth,
        )
      : ['—']

    const rowHeight = Math.max(
      27,
      detailLines.length * 10 + 10,
    )

    if (y - rowHeight < 230) {
      addContinuationPage()
      drawTableHeader()
    }

    if (index % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: y - rowHeight + 3,
        width: CONTENT_WIDTH,
        height: rowHeight,
        color: COLORS.surface,
      })
    }

    page.drawText(formatCraDate(day.date), {
      x: dateX,
      y: y - 13,
      size: 7.7,
      font: regular,
      color: COLORS.ink,
    })

    page.drawText(
      safeText(DAY_TYPE_LABELS[day.dayType] ?? day.dayType),
      {
        x: typeX,
        y: y - 13,
        size: 7.7,
        font: regular,
        color: COLORS.ink,
      },
    )

    drawRightAligned(
      page,
      formatDuration(day.durationMinutes),
      durationRight,
      y - 13,
      regular,
      7.7,
      COLORS.ink,
    )

    detailLines.forEach((line, lineIndex) => {
      page.drawText(line, {
        x: detailX,
        y: y - 13 - lineIndex * 10,
        size: 7.6,
        font: regular,
        color: line === '—'
          ? COLORS.muted
          : COLORS.ink,
      })
    })

    page.drawLine({
      start: {
        x: MARGIN,
        y: y - rowHeight + 3,
      },
      end: {
        x: PAGE_WIDTH - MARGIN,
        y: y - rowHeight + 3,
      },
      thickness: 0.45,
      color: COLORS.border,
    })

    y -= rowHeight
  }

  ensureSpace(245)

  y -= 12

  page.drawText('SYNTHESE DU MOIS', {
    x: MARGIN,
    y,
    size: 8,
    font: bold,
    color: COLORS.green,
  })

  y -= 13

  const summaryHeight = 72

  page.drawRectangle({
    x: MARGIN,
    y: y - summaryHeight,
    width: CONTENT_WIDTH,
    height: summaryHeight,
    color: COLORS.greenSoft,
  })

  const summaryItems = [
    {
      label: 'Journées déclarées',
      value: String(input.summary.declaredDays),
    },
    {
      label: 'Jours travaillés',
      value: String(input.summary.workedDays),
    },
    {
      label: 'Temps travaillé',
      value: formatDuration(input.summary.workedMinutes),
    },
    {
      label: 'Formation',
      value: input.summary.trainingDays
        ? `${input.summary.trainingDays} j - ${formatDuration(input.summary.trainingMinutes)}`
        : '0',
    },
  ]

  const summaryColumnWidth = CONTENT_WIDTH / 4

  summaryItems.forEach((item, index) => {
    const x = MARGIN + index * summaryColumnWidth + 12

    const labelLines = boundedLines(
      item.label.toUpperCase(),
      bold,
      6.2,
      summaryColumnWidth - 24,
      2,
    )

    labelLines.forEach((line, lineIndex) => {
      page.drawText(line, {
        x,
        y: y - 17 - lineIndex * 8,
        size: 6.2,
        font: bold,
        color: COLORS.green,
      })
    })

    const valueSize = fittedFontSize(
      item.value,
      bold,
      11,
      8,
      summaryColumnWidth - 24,
    )

    page.drawText(safeText(item.value), {
      x,
      y: y - 44,
      size: valueSize,
      font: bold,
      color: COLORS.ink,
    })
  })

  y -= summaryHeight + 12

  const absenceDetails = [
    input.summary.paidLeaveDays
      ? `Congés payés : ${input.summary.paidLeaveDays}`
      : null,
    input.summary.rttDays
      ? `RTT : ${input.summary.rttDays}`
      : null,
    input.summary.sickLeaveDays
      ? `Maladie : ${input.summary.sickLeaveDays}`
      : null,
    input.summary.authorizedAbsenceDays
      ? `Abs. autorisées : ${input.summary.authorizedAbsenceDays}`
      : null,
    input.summary.unjustifiedAbsenceDays
      ? `Abs. injustifiées : ${input.summary.unjustifiedAbsenceDays}`
      : null,
    input.summary.otherAbsenceDays
      ? `Autres : ${input.summary.otherAbsenceDays}`
      : null,
    input.summary.publicHolidayDays
      ? `Jours fériés : ${input.summary.publicHolidayDays}`
      : null,
  ].filter(Boolean) as string[]

  const absenceText = absenceDetails.length
    ? absenceDetails.join(' - ')
    : 'Aucune absence ou congé déclaré.'

  page.drawText(
    `Congés / absences : ${safeText(absenceText)}`,
    {
      x: MARGIN,
      y,
      size: 7.4,
      font: regular,
      color: COLORS.muted,
    },
  )

  y -= 26

  const signatureBlockHeight = 148

  if (y - signatureBlockHeight < FOOTER_SAFE_Y) {
    addContinuationPage()
  }

  const gap = 12
  const blockWidth = (CONTENT_WIDTH - gap) / 2
  const blockTop = y

  page.drawRectangle({
    x: MARGIN,
    y: blockTop - signatureBlockHeight,
    width: blockWidth,
    height: signatureBlockHeight,
    color: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
  })

  page.drawRectangle({
    x: MARGIN + blockWidth + gap,
    y: blockTop - signatureBlockHeight,
    width: blockWidth,
    height: signatureBlockHeight,
    color: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
  })

  page.drawText('VISA IFICS', {
    x: MARGIN + 12,
    y: blockTop - 18,
    size: 7,
    font: bold,
    color: COLORS.green,
  })

  const issuerSize = fittedFontSize(
    issuer,
    bold,
    8.5,
    6.8,
    blockWidth - 24,
  )

  page.drawText(safeText(issuer), {
    x: MARGIN + 12,
    y: blockTop - 34,
    size: issuerSize,
    font: bold,
    color: COLORS.ink,
  })

  page.drawText(`Date : ${generatedDate}`, {
    x: MARGIN + 12,
    y: blockTop - 50,
    size: 7.3,
    font: regular,
    color: COLORS.muted,
  })

  await drawSignature(
    pdf,
    page,
    input.signature,
    MARGIN + 14,
    blockTop - signatureBlockHeight + 14,
    blockWidth - 28,
    76,
  )

  const intervenorBoxX = MARGIN + blockWidth + gap

  page.drawText('SIGNATURE DE L\'INTERVENANT', {
    x: intervenorBoxX + 12,
    y: blockTop - 18,
    size: 7,
    font: bold,
    color: COLORS.green,
  })

  const signatureIntervenorSize = fittedFontSize(
    intervenorFullName,
    bold,
    8.5,
    6.8,
    blockWidth - 24,
  )

  page.drawText(
    safeText(intervenorFullName),
    {
      x: intervenorBoxX + 12,
      y: blockTop - 35,
      size: signatureIntervenorSize,
      font: bold,
      color: COLORS.ink,
    },
  )

  page.drawText(`Date : ${generatedDate}`, {
    x: intervenorBoxX + 12,
    y: blockTop - 51,
    size: 7.3,
    font: regular,
    color: COLORS.muted,
  })

  const instructionLines = boundedLines(
    'À signer après réception du document.',
    regular,
    7.1,
    blockWidth - 24,
    2,
  )

  instructionLines.forEach((line, index) => {
    page.drawText(line, {
      x: intervenorBoxX + 12,
      y: blockTop - 68 - index * 9,
      size: 7.1,
      font: regular,
      color: COLORS.muted,
    })
  })

  page.drawLine({
    start: {
      x: intervenorBoxX + 18,
      y: blockTop - 118,
    },
    end: {
      x: intervenorBoxX + blockWidth - 18,
      y: blockTop - 118,
    },
    thickness: 0.7,
    color: COLORS.border,
  })

  const footer = input.association.pdfFooter
    || `${issuer} - Document CRA généré par IFICS`

  for (const [pageIndex, pdfPage] of pdf.getPages().entries()) {
    pdfPage.drawLine({
      start: {
        x: MARGIN,
        y: 45,
      },
      end: {
        x: PAGE_WIDTH - MARGIN,
        y: 45,
      },
      thickness: 0.5,
      color: COLORS.border,
    })

    const footerText = safeText(
      `${footer} - ${input.reference}`,
    )

    const footerLines = wrapText(
      footerText,
      regular,
      6.2,
      CONTENT_WIDTH - 70,
    ).slice(0, 2)

    footerLines.forEach((line, index) => {
      pdfPage.drawText(line, {
        x: MARGIN,
        y: 31 - index * 7,
        size: 6.2,
        font: regular,
        color: COLORS.muted,
      })
    })

    drawRightAligned(
      pdfPage,
      `${pageIndex + 1} / ${pdf.getPageCount()}`,
      PAGE_WIDTH - MARGIN,
      29,
      regular,
      6.2,
      COLORS.muted,
    )
  }

  pdf.setTitle(`CRA ${input.reference}`)
  pdf.setSubject(
    `Compte rendu d'activité ${periodLabel(input.year, input.month)}`,
  )
  pdf.setCreator('IFICS')
  pdf.setProducer('IFICS')

  return pdf.save()
}
