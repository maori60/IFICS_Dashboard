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

const COLORS = {
  green: rgb(0.07, 0.23, 0.16),
  greenSoft: rgb(0.93, 0.97, 0.94),
  greenLine: rgb(0.80, 0.88, 0.83),
  red: rgb(0.62, 0.16, 0.13),
  redSoft: rgb(0.99, 0.94, 0.93),
  ink: rgb(0.09, 0.13, 0.11),
  muted: rgb(0.36, 0.42, 0.39),
  border: rgb(0.86, 0.90, 0.87),
  surface: rgb(0.98, 0.99, 0.98),
  white: rgb(1, 1, 1),
}

export type CraClientDecisionValue
  = | 'ACCEPTED'
    | 'REFUSED'

export type CraClientAttestationPdfInput = {
  sourceBytes: Uint8Array

  sourceMimeType:
    | 'application/pdf'
    | 'image/png'
    | 'image/jpeg'

  attestedReference: string

  decision: CraClientDecisionValue

  firstName: string
  lastName: string
  jobTitle: string

  organizationName: string
  recipientEmail: string

  comment?: string | null

  decidedAt: Date | string

  sourceDocumentReference: string
  sourceDocumentSha256: string
}

function safePdfText(
  value: unknown,
): string {
  const raw = String(value ?? '')
    .replace(/[\u2018\u2019]/g, '\'')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[\u00A0\u202F]/g, ' ')

  const output: string[] = []

  for (const character of Array.from(raw)) {
    const code = character.charCodeAt(0)

    if (code < 32 || code === 127) {
      output.push(' ')
      continue
    }

    if (code <= 255) {
      output.push(character)
      continue
    }

    const fallback = character
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    let appended = false

    for (const fallbackCharacter of fallback) {
      const fallbackCode
        = fallbackCharacter.charCodeAt(0)

      if (
        fallbackCode >= 32
        && fallbackCode <= 255
        && fallbackCode !== 127
      ) {
        output.push(fallbackCharacter)
        appended = true
      }
    }

    if (!appended) {
      output.push('?')
    }
  }

  return output
    .join('')
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
    const candidate
      = `${current}${character}`

    if (
      current
      && font.widthOfTextAtSize(
        candidate,
        size,
      ) > maxWidth
    ) {
      chunks.push(current)
      current = character
    }
    else {
      current = candidate
    }
  }

  if (current) {
    chunks.push(current)
  }

  return chunks.length
    ? chunks
    : ['']
}

function wrapText(
  value: unknown,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const text = safePdfText(value)

  if (!text) {
    return ['']
  }

  const words = text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap(word =>
      font.widthOfTextAtSize(
        word,
        size,
      ) > maxWidth
        ? splitLongWord(
            word,
            font,
            size,
            maxWidth,
          )
        : [word],
    )

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current
      ? `${current} ${word}`
      : word

    if (
      !current
      || font.widthOfTextAtSize(
        candidate,
        size,
      ) <= maxWidth
    ) {
      current = candidate
      continue
    }

    lines.push(current)
    current = word
  }

  if (current) {
    lines.push(current)
  }

  return lines.length
    ? lines
    : ['']
}

function fitInside(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
) {
  if (
    width <= 0
    || height <= 0
    || maxWidth <= 0
    || maxHeight <= 0
  ) {
    return {
      width: 0,
      height: 0,
    }
  }

  const factor = Math.min(
    maxWidth / width,
    maxHeight / height,
    1,
  )

  return {
    width: width * factor,
    height: height * factor,
  }
}

function requireText(
  value: string,
  label: string,
): string {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error(
      `${label} est obligatoire.`,
    )
  }

  return normalized
}

function parseDecisionDate(
  value: Date | string,
): Date {
  const date = value instanceof Date
    ? value
    : new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      'Date de décision client invalide.',
    )
  }

  return date
}

function formatDecisionDate(
  date: Date,
): string {
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Europe/Paris',
    },
  ).format(date)
}

function drawWrappedValue(
  page: PDFPage,
  value: unknown,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = wrapText(
    value,
    font,
    size,
    maxWidth,
  )

  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * lineHeight,
      size,
      font,
      color: COLORS.ink,
    })
  })

  return y - lines.length * lineHeight
}

function drawField(
  page: PDFPage,
  label: string,
  value: unknown,
  x: number,
  y: number,
  width: number,
  regular: PDFFont,
  bold: PDFFont,
): number {
  page.drawText(
    safePdfText(label).toUpperCase(),
    {
      x,
      y,
      size: 7,
      font: bold,
      color: COLORS.green,
    },
  )

  return drawWrappedValue(
    page,
    value,
    x,
    y - 15,
    regular,
    9.3,
    width,
    12,
  ) - 8
}

async function appendSourceImage(
  pdf: PDFDocument,
  input: CraClientAttestationPdfInput,
): Promise<void> {
  const page = pdf.addPage([
    PAGE_WIDTH,
    PAGE_HEIGHT,
  ])

  const image = input.sourceMimeType
    === 'image/png'
    ? await pdf.embedPng(input.sourceBytes)
    : await pdf.embedJpg(input.sourceBytes)

  const fitted = fitInside(
    image.width,
    image.height,
    CONTENT_WIDTH,
    PAGE_HEIGHT - MARGIN * 2,
  )

  page.drawImage(image, {
    x:
      (PAGE_WIDTH - fitted.width)
      / 2,

    y:
      (PAGE_HEIGHT - fitted.height)
      / 2,

    width:
      fitted.width,

    height:
      fitted.height,
  })
}

async function loadSourceDocument(
  input: CraClientAttestationPdfInput,
): Promise<PDFDocument> {
  if (
    input.sourceMimeType
    === 'application/pdf'
  ) {
    return PDFDocument.load(
      input.sourceBytes,
      {
        ignoreEncryption: false,
        updateMetadata: false,
      },
    )
  }

  const pdf = await PDFDocument.create()

  await appendSourceImage(
    pdf,
    input,
  )

  return pdf
}

export async function generateCraClientAttestationPdf(
  input: CraClientAttestationPdfInput,
): Promise<Uint8Array> {
  const firstName = requireText(
    input.firstName,
    'Le prénom',
  )

  const lastName = requireText(
    input.lastName,
    'Le nom',
  )

  const jobTitle = requireText(
    input.jobTitle,
    'La fonction',
  )

  const organizationName = requireText(
    input.organizationName,
    'L’organisation',
  )

  const recipientEmail = requireText(
    input.recipientEmail,
    'L’adresse email',
  )

  const sourceDocumentReference
    = requireText(
      input.sourceDocumentReference,
      'La référence du document source',
    )

  const attestedReference
    = requireText(
      input.attestedReference,
      'La référence du document attesté',
    )

  if (
    input.decision !== 'ACCEPTED'
    && input.decision !== 'REFUSED'
  ) {
    throw new Error(
      'Décision client invalide.',
    )
  }

  const comment
    = input.comment?.trim()
    || null

  if (
    input.decision === 'REFUSED'
    && !comment
  ) {
    throw new Error(
      'Le commentaire est obligatoire en cas de refus.',
    )
  }

  if (
    !/^[a-f0-9]{64}$/i.test(
      input.sourceDocumentSha256,
    )
  ) {
    throw new Error(
      'Empreinte SHA-256 du document source invalide.',
    )
  }

  const decidedAt = parseDecisionDate(
    input.decidedAt,
  )

  const pdf = await loadSourceDocument(
    input,
  )

  const regular = await pdf.embedFont(
    StandardFonts.Helvetica,
  )

  const bold = await pdf.embedFont(
    StandardFonts.HelveticaBold,
  )

  const mono = await pdf.embedFont(
    StandardFonts.Courier,
  )

  pdf.setTitle(
    `Attestation client ${attestedReference}`,
  )

  pdf.setSubject(
    'Décision client relative à un compte-rendu d’activité IFICS',
  )

  pdf.setCreator('IFICS')
  pdf.setProducer('IFICS')

  pdf.setCreationDate(decidedAt)
  pdf.setModificationDate(decidedAt)

  const page = pdf.addPage([
    PAGE_WIDTH,
    PAGE_HEIGHT,
  ])

  const decisionColor
    = input.decision === 'ACCEPTED'
      ? COLORS.green
      : COLORS.red

  const decisionSoftColor
    = input.decision === 'ACCEPTED'
      ? COLORS.greenSoft
      : COLORS.redSoft

  const decisionLabel
    = input.decision === 'ACCEPTED'
      ? 'ACCEPTE PAR LE CLIENT'
      : 'REFUSE PAR LE CLIENT'

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 8,
    width: PAGE_WIDTH,
    height: 8,
    color: decisionColor,
  })

  page.drawText(
    'IFICS',
    {
      x: MARGIN,
      y: PAGE_HEIGHT - 54,
      size: 19,
      font: bold,
      color: COLORS.green,
    },
  )

  page.drawText(
    'ATTESTATION DE DECISION CLIENT',
    {
      x: MARGIN,
      y: PAGE_HEIGHT - 82,
      size: 16,
      font: bold,
      color: COLORS.ink,
    },
  )

  page.drawText(
    safePdfText(attestedReference),
    {
      x: MARGIN,
      y: PAGE_HEIGHT - 100,
      size: 8,
      font: regular,
      color: COLORS.muted,
    },
  )

  page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - 158,
    width: CONTENT_WIDTH,
    height: 38,
    color: decisionSoftColor,
    borderColor: decisionColor,
    borderWidth: 1,
  })

  page.drawText(
    decisionLabel,
    {
      x: MARGIN + 14,
      y: PAGE_HEIGHT - 144,
      size: 12,
      font: bold,
      color: decisionColor,
    },
  )

  let y = PAGE_HEIGHT - 190

  page.drawText(
    'IDENTITE DU DECLARANT',
    {
      x: MARGIN,
      y,
      size: 9,
      font: bold,
      color: COLORS.green,
    },
  )

  y -= 18

  page.drawRectangle({
    x: MARGIN,
    y: y - 162,
    width: CONTENT_WIDTH,
    height: 170,
    color: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
  })

  const leftX = MARGIN + 14
  const rightX = MARGIN + 272
  const fieldWidth = 225

  let leftY = y - 18
  let rightY = y - 18

  leftY = drawField(
    page,
    'Prénom',
    firstName,
    leftX,
    leftY,
    fieldWidth,
    regular,
    bold,
  )

  leftY = drawField(
    page,
    'Nom',
    lastName,
    leftX,
    leftY,
    fieldWidth,
    regular,
    bold,
  )

  drawField(
    page,
    'Fonction',
    jobTitle,
    leftX,
    leftY,
    fieldWidth,
    regular,
    bold,
  )

  rightY = drawField(
    page,
    'Organisation',
    organizationName,
    rightX,
    rightY,
    fieldWidth,
    regular,
    bold,
  )

  rightY = drawField(
    page,
    'Adresse de notification',
    recipientEmail,
    rightX,
    rightY,
    fieldWidth,
    regular,
    bold,
  )

  drawField(
    page,
    'Décision enregistrée',
    `${formatDecisionDate(decidedAt)} - Europe/Paris`,
    rightX,
    rightY,
    fieldWidth,
    regular,
    bold,
  )

  y -= 194

  page.drawText(
    input.decision === 'REFUSED'
      ? 'MOTIF / COMMENTAIRE'
      : 'COMMENTAIRE',
    {
      x: MARGIN,
      y,
      size: 9,
      font: bold,
      color: COLORS.green,
    },
  )

  y -= 17

  const commentText = comment
    || 'Aucun commentaire renseigné.'

  const commentLines = wrapText(
    commentText,
    regular,
    8.6,
    CONTENT_WIDTH - 28,
  )

  const commentHeight
    = Math.max(
      62,
      commentLines.length * 11 + 28,
    )

  page.drawRectangle({
    x: MARGIN,
    y: y - commentHeight,
    width: CONTENT_WIDTH,
    height: commentHeight,
    color: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
  })

  commentLines.forEach(
    (line, index) => {
      page.drawText(line, {
        x: MARGIN + 14,
        y: y - 20 - index * 11,
        size: 8.6,
        font: regular,
        color: COLORS.ink,
      })
    },
  )

  y -= commentHeight + 30

  page.drawText(
    'DOCUMENT EXAMINE',
    {
      x: MARGIN,
      y,
      size: 9,
      font: bold,
      color: COLORS.green,
    },
  )

  y -= 18

  y = drawField(
    page,
    'Référence source',
    sourceDocumentReference,
    MARGIN,
    y,
    CONTENT_WIDTH,
    regular,
    bold,
  )

  page.drawText(
    'EMPREINTE SHA-256 DU DOCUMENT SOURCE',
    {
      x: MARGIN,
      y,
      size: 7,
      font: bold,
      color: COLORS.green,
    },
  )

  page.drawText(
    input.sourceDocumentSha256
      .toLowerCase(),
    {
      x: MARGIN,
      y: y - 16,
      size: 7.2,
      font: mono,
      color: COLORS.ink,
    },
  )

  page.drawLine({
    start: {
      x: MARGIN,
      y: 72,
    },
    end: {
      x: PAGE_WIDTH - MARGIN,
      y: 72,
    },
    thickness: 0.7,
    color: COLORS.greenLine,
  })

  page.drawText(
    'Décision enregistrée par la plateforme IFICS. Le document signé source est conservé séparément et n’est pas modifié.',
    {
      x: MARGIN,
      y: 54,
      size: 6.8,
      font: regular,
      color: COLORS.muted,
    },
  )

  page.drawText(
    'Cette attestation constitue une trace de décision horodatée et auditée ; elle ne constitue pas une signature électronique qualifiée.',
    {
      x: MARGIN,
      y: 42,
      size: 6.8,
      font: regular,
      color: COLORS.muted,
    },
  )

  return pdf.save()
}
