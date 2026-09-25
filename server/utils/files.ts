import { createHash, randomUUID } from 'node:crypto'
import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { httpError } from './api'

const PDF_SIGNATURE = Buffer.from('%PDF-')
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
const JPEG_SIGNATURE = Buffer.from([0xFF, 0xD8, 0xFF])
const DANGEROUS_PDF_TOKENS = [
  '/JavaScript',
  '/JS',
  '/Launch',
  '/EmbeddedFile',
  '/OpenAction',
]

export type StoredPdf = {
  originalName: string
  storedName: string
  filePath: string
  mimeType: 'application/pdf'
  fileSize: bigint
  sha256: string
}

export type StoredImage = {
  originalName: string
  storedName: string
  filePath: string
  mimeType: 'image/png' | 'image/jpeg'
  fileSize: bigint
  sha256: string
}

export type StoredCraSignature = StoredPdf | StoredImage

export type StoredCraSignedDocument = StoredPdf | StoredImage

export type QuarantinedCraSignedDocument = {
  originalName: string
  storedName: string
  quarantinePath: string
  finalPath: string
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg'
  fileSize: bigint
  sha256: string
}

export function uploadRoot(): string {
  return resolve(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'))
}

export function maxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB || 10)
  const safeMb = Number.isFinite(mb) && mb >= 1 && mb <= 50 ? mb : 10
  return Math.floor(safeMb * 1024 * 1024)
}

export function maxBrandImageBytes(): number {
  return Math.min(maxUploadBytes(), 5 * 1024 * 1024)
}

export function maxCraSignatureBytes(): number {
  return Math.min(maxUploadBytes(), 5 * 1024 * 1024)
}

function safeSegment(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,191}$/.test(value)) {
    httpError(400, 'Identifiant de stockage invalide.', 'INVALID_STORAGE_SEGMENT')
  }

  return value
}

function stripControlCharacters(value: string): string {
  return [...value]
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code > 31 && code !== 127
    })
    .join('')
}

export function safeOriginalFilename(value: string): string {
  const clean = stripControlCharacters(basename(value))
    .replace(/["'<>\\/]/g, '_')
    .trim()
    .slice(0, 180)

  return clean || 'document.pdf'
}

export async function validatePdf(buffer: Buffer, maxBytes = maxUploadBytes()): Promise<void> {
  if (!buffer.length || buffer.length > maxBytes) {
    httpError(
      400,
      `Le PDF doit faire entre 1 octet et ${Math.floor(maxBytes / 1024 / 1024)} Mo.`,
      'INVALID_FILE_SIZE',
    )
  }

  if (buffer.subarray(0, PDF_SIGNATURE.length).compare(PDF_SIGNATURE) !== 0) {
    httpError(400, 'Le contenu du fichier n’est pas un PDF valide.', 'INVALID_PDF_SIGNATURE')
  }

  const asciiProbe = buffer.subarray(0, Math.min(buffer.length, 2 * 1024 * 1024)).toString('latin1')
  const dangerousToken = DANGEROUS_PDF_TOKENS.find(token => asciiProbe.includes(token))

  if (dangerousToken) {
    httpError(400, 'Le PDF contient une fonctionnalité active non autorisée.', 'UNSAFE_PDF_CONTENT')
  }

  try {
    await PDFDocument.load(buffer, {
      ignoreEncryption: false,
      updateMetadata: false,
    })
  }
  catch {
    httpError(400, 'Le PDF est corrompu, chiffré ou non pris en charge.', 'INVALID_PDF')
  }
}

export async function storePdf(
  scope: 'projects' | 'intervenors' | 'accounting' | 'reports' | 'assets' | 'contracts' | 'cra',
  ownerId: string,
  originalFilename: string,
  buffer: Buffer,
  options: { maxBytes?: number } = {},
): Promise<StoredPdf> {
  await validatePdf(buffer, options.maxBytes ?? maxUploadBytes())

  const cleanOwnerId = safeSegment(ownerId)
  const cleanOriginalName = safeOriginalFilename(originalFilename)
  const storedName = `${randomUUID()}.pdf`
  const directory = join(uploadRoot(), scope, cleanOwnerId)

  await mkdir(directory, { recursive: true, mode: 0o750 })

  const absolutePath = join(directory, storedName)
  await writeFile(absolutePath, buffer, { flag: 'wx', mode: 0o640 })

  return {
    originalName: cleanOriginalName,
    storedName,
    filePath: join(scope, cleanOwnerId, storedName),
    mimeType: 'application/pdf',
    fileSize: BigInt(buffer.length),
    sha256: createHash('sha256').update(buffer).digest('hex'),
  }
}

function detectBrandImage(buffer: Buffer): { mimeType: 'image/png' | 'image/jpeg'; extension: 'png' | 'jpg' } | null {
  if (buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, PNG_SIGNATURE.length).compare(PNG_SIGNATURE) === 0) {
    return { mimeType: 'image/png', extension: 'png' }
  }
  if (buffer.length >= JPEG_SIGNATURE.length && buffer.subarray(0, JPEG_SIGNATURE.length).compare(JPEG_SIGNATURE) === 0) {
    return { mimeType: 'image/jpeg', extension: 'jpg' }
  }
  return null
}

export async function storeBrandImage(
  associationId: string,
  originalFilename: string,
  buffer: Buffer,
): Promise<StoredImage> {
  if (!buffer.length || buffer.length > maxBrandImageBytes()) {
    httpError(400, 'Le logo doit faire au maximum 5 Mo.', 'INVALID_FILE_SIZE')
  }

  const detected = detectBrandImage(buffer)
  if (!detected) {
    httpError(400, 'Le logo doit être une image PNG ou JPEG valide.', 'INVALID_IMAGE_SIGNATURE')
  }

  const cleanAssociationId = safeSegment(associationId)
  const cleanOriginalName = safeOriginalFilename(originalFilename)
  const storedName = `${randomUUID()}.${detected.extension}`
  const directory = join(uploadRoot(), 'branding', cleanAssociationId)
  await mkdir(directory, { recursive: true, mode: 0o750 })
  const absolutePath = join(directory, storedName)
  await writeFile(absolutePath, buffer, { flag: 'wx', mode: 0o640 })

  return {
    originalName: cleanOriginalName,
    storedName,
    filePath: join('branding', cleanAssociationId, storedName),
    mimeType: detected.mimeType,
    fileSize: BigInt(buffer.length),
    sha256: createHash('sha256').update(buffer).digest('hex'),
  }
}

export async function storeCraSignature(
  associationId: string,
  originalFilename: string,
  buffer: Buffer,
): Promise<StoredCraSignature> {
  const maxBytes = maxCraSignatureBytes()

  if (!buffer.length || buffer.length > maxBytes) {
    httpError(
      400,
      'La signature doit faire entre 1 octet et 5 Mo.',
      'INVALID_FILE_SIZE',
    )
  }

  const cleanAssociationId = safeSegment(associationId)
  const cleanOriginalName = safeOriginalFilename(originalFilename)

  const directory = join(
    uploadRoot(),
    'signatures',
    cleanAssociationId,
  )

  await mkdir(directory, {
    recursive: true,
    mode: 0o750,
  })

  if (
    buffer.length >= PDF_SIGNATURE.length
    && buffer.subarray(0, PDF_SIGNATURE.length).compare(PDF_SIGNATURE) === 0
  ) {
    await validatePdf(buffer, maxBytes)

    const pdf = await PDFDocument.load(buffer, {
      ignoreEncryption: false,
      updateMetadata: false,
    })

    if (pdf.getPageCount() !== 1) {
      httpError(
        400,
        'Le PDF de signature doit contenir exactement une page.',
        'INVALID_SIGNATURE_PDF_PAGE_COUNT',
      )
    }

    const storedName = `${randomUUID()}.pdf`
    const absolutePath = join(directory, storedName)

    await writeFile(absolutePath, buffer, {
      flag: 'wx',
      mode: 0o640,
    })

    return {
      originalName: cleanOriginalName,
      storedName,
      filePath: join('signatures', cleanAssociationId, storedName),
      mimeType: 'application/pdf',
      fileSize: BigInt(buffer.length),
      sha256: createHash('sha256').update(buffer).digest('hex'),
    }
  }

  const detected = detectBrandImage(buffer)

  if (!detected) {
    httpError(
      400,
      'La signature doit être un fichier PDF, PNG ou JPEG valide.',
      'INVALID_SIGNATURE_FILE',
    )
  }

  try {
    const validationPdf = await PDFDocument.create()

    if (detected.mimeType === 'image/png') {
      await validationPdf.embedPng(buffer)
    }
    else {
      await validationPdf.embedJpg(buffer)
    }
  }
  catch {
    httpError(
      400,
      'L’image de signature est corrompue ou invalide.',
      'INVALID_SIGNATURE_IMAGE',
    )
  }

  const storedName = `${randomUUID()}.${detected.extension}`
  const absolutePath = join(directory, storedName)

  await writeFile(absolutePath, buffer, {
    flag: 'wx',
    mode: 0o640,
  })

  return {
    originalName: cleanOriginalName,
    storedName,
    filePath: join('signatures', cleanAssociationId, storedName),
    mimeType: detected.mimeType,
    fileSize: BigInt(buffer.length),
    sha256: createHash('sha256').update(buffer).digest('hex'),
  }
}

async function validateCraSignedBuffer(
  buffer: Buffer,
): Promise<{
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg'
  extension: 'pdf' | 'png' | 'jpg'
}> {
  const maxBytes = maxUploadBytes()

  if (!buffer.length || buffer.length > maxBytes) {
    httpError(
      400,
      `Le CRA signé doit faire entre 1 octet et ${Math.floor(maxBytes / 1024 / 1024)} Mo.`,
      'INVALID_FILE_SIZE',
    )
  }

  if (
    buffer.length >= PDF_SIGNATURE.length
    && buffer.subarray(0, PDF_SIGNATURE.length).compare(PDF_SIGNATURE) === 0
  ) {
    await validatePdf(buffer, maxBytes)

    return {
      mimeType: 'application/pdf',
      extension: 'pdf',
    }
  }

  const detected = detectBrandImage(buffer)

  if (!detected) {
    httpError(
      400,
      'Le CRA signé doit être un fichier PDF, PNG ou JPEG valide.',
      'INVALID_CRA_SIGNED_FILE',
    )
  }

  try {
    const validationPdf = await PDFDocument.create()

    if (detected.mimeType === 'image/png') {
      await validationPdf.embedPng(buffer)
    }
    else {
      await validationPdf.embedJpg(buffer)
    }
  }
  catch {
    httpError(
      400,
      'L’image du CRA signé est corrompue ou invalide.',
      'INVALID_CRA_SIGNED_IMAGE',
    )
  }

  return detected
}

export async function quarantineCraSignedDocument(
  reportId: string,
  originalFilename: string,
  buffer: Buffer,
): Promise<QuarantinedCraSignedDocument> {
  const detected = await validateCraSignedBuffer(buffer)

  const cleanReportId = safeSegment(reportId)
  const cleanOriginalName = safeOriginalFilename(originalFilename)
  const storedName = `${randomUUID()}.${detected.extension}`

  const quarantineDirectory = join(
    uploadRoot(),
    'quarantine',
    'cra',
    cleanReportId,
  )

  await mkdir(quarantineDirectory, {
    recursive: true,
    mode: 0o750,
  })

  const quarantinePath = join(
    'quarantine',
    'cra',
    cleanReportId,
    storedName,
  )

  const finalPath = join(
    'cra',
    cleanReportId,
    storedName,
  )

  await writeFile(
    resolveStoredPath(quarantinePath),
    buffer,
    {
      flag: 'wx',
      mode: 0o640,
    },
  )

  return {
    originalName: cleanOriginalName,
    storedName,
    quarantinePath,
    finalPath,
    mimeType: detected.mimeType,
    fileSize: BigInt(buffer.length),
    sha256: createHash('sha256')
      .update(buffer)
      .digest('hex'),
  }
}

export async function promoteCraSignedDocument(
  document: QuarantinedCraSignedDocument,
): Promise<StoredCraSignedDocument> {
  if (
    !document.quarantinePath.startsWith('quarantine/cra/')
    || !document.finalPath.startsWith('cra/')
  ) {
    httpError(
      400,
      'Chemin de quarantaine CRA invalide.',
      'INVALID_CRA_QUARANTINE_PATH',
    )
  }

  const source = resolveStoredPath(
    document.quarantinePath,
  )

  const destination = resolveStoredPath(
    document.finalPath,
  )

  const finalDirectory = resolve(
    destination,
    '..',
  )

  await mkdir(finalDirectory, {
    recursive: true,
    mode: 0o750,
  })

  await rename(
    source,
    destination,
  )

  return {
    originalName: document.originalName,
    storedName: document.storedName,
    filePath: document.finalPath,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    sha256: document.sha256,
  }
}

export async function discardQuarantinedCraDocument(
  document: QuarantinedCraSignedDocument,
): Promise<void> {
  await removeStoredFile(
    document.quarantinePath,
  )
}

export function resolveStoredPath(filePath: string): string {
  const root = uploadRoot()
  const normalized = filePath.replace(/^uploads[\\/]/, '')
  const absolute = resolve(root, normalized)

  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {
    httpError(400, 'Chemin de document invalide.', 'INVALID_FILE_PATH')
  }

  return absolute
}

export async function readStoredFile(filePath: string): Promise<Buffer> {
  const absolute = resolveStoredPath(filePath)

  try {
    await access(absolute, constants.R_OK)
    return await readFile(absolute)
  }
  catch {
    httpError(404, 'Fichier introuvable sur le stockage.', 'FILE_NOT_FOUND')
  }
}

export async function removeStoredFile(
  filePath: string,
): Promise<void> {
  const absolute = resolveStoredPath(filePath)

  try {
    await unlink(absolute)
  }
  catch (error) {
    if (
      error
      && typeof error === 'object'
      && 'code' in error
      && error.code === 'ENOENT'
    ) {
      return
    }

    throw error
  }
}

export function contentDispositionFilename(filename: string): string {
  return encodeURIComponent(safeOriginalFilename(filename))
}

/**
 * Pièce justificative associée à une dépense.
 *
 * Le type MIME n'est jamais déduit du nom du fichier ni du navigateur :
 * il est déterminé à partir du contenu réel.
 */
export type StoredExpenseAttachment =
  | StoredPdf
  | StoredImage

export type QuarantinedExpenseAttachment = {
  originalName: string
  storedName: string
  quarantinePath: string
  finalPath: string
  mimeType:
    | 'application/pdf'
    | 'image/png'
    | 'image/jpeg'
  fileSize: bigint
  sha256: string
}

/**
 * Valide une pièce justificative avant stockage.
 *
 * Formats autorisés :
 * - PDF
 * - PNG
 * - JPEG
 *
 * Taille :
 * - MAX_UPLOAD_MB
 */
export async function validateExpenseAttachmentBuffer(
  buffer: Buffer,
): Promise<{
  mimeType:
    | 'application/pdf'
    | 'image/png'
    | 'image/jpeg'
  extension:
    | 'pdf'
    | 'png'
    | 'jpg'
}> {
  const maxBytes = maxUploadBytes()

  if (
    !buffer.length
    || buffer.length > maxBytes
  ) {
    httpError(
      400,
      `Le justificatif doit faire entre 1 octet et ${Math.floor(maxBytes / 1024 / 1024)} Mo.`,
      'INVALID_EXPENSE_ATTACHMENT_SIZE',
    )
  }

  /*
   * PDF :
   * - signature réelle %PDF-
   * - taille
   * - contenu actif dangereux
   * - parsing pdf-lib
   */
  if (
    buffer.length >= PDF_SIGNATURE.length
    && buffer
      .subarray(
        0,
        PDF_SIGNATURE.length,
      )
      .compare(PDF_SIGNATURE) === 0
  ) {
    await validatePdf(
      buffer,
      maxBytes,
    )

    return {
      mimeType:
        'application/pdf',

      extension:
        'pdf',
    }
  }

  /*
   * Image :
   * détection par signature binaire,
   * jamais par extension ou Content-Type.
   */
  const detected
    = detectBrandImage(buffer)

  if (!detected) {
    httpError(
      400,
      'Le justificatif doit être un fichier PDF, PNG ou JPEG valide.',
      'INVALID_EXPENSE_ATTACHMENT_FILE',
    )
  }

  /*
   * pdf-lib décode réellement l'image.
   * Une simple signature PNG/JPEG ne suffit donc pas.
   */
  try {
    const validationPdf
      = await PDFDocument.create()

    if (
      detected.mimeType
      === 'image/png'
    ) {
      await validationPdf.embedPng(
        buffer,
      )
    }
    else {
      await validationPdf.embedJpg(
        buffer,
      )
    }
  }
  catch {
    httpError(
      400,
      'L’image du justificatif est corrompue ou invalide.',
      'INVALID_EXPENSE_ATTACHMENT_IMAGE',
    )
  }

  return detected
}

/**
 * Stocke temporairement le justificatif dans une zone
 * de quarantaine.
 *
 * Aucun ExpenseAttachment ne doit être créé en base
 * tant que le contrôle antivirus n'a pas confirmé CLEAN.
 */
export async function quarantineExpenseAttachment(
  expenseId: string,
  originalFilename: string,
  buffer: Buffer,
): Promise<QuarantinedExpenseAttachment> {
  const detected
    = await validateExpenseAttachmentBuffer(
      buffer,
    )

  const cleanExpenseId
    = safeSegment(expenseId)

  const cleanOriginalName
    = safeOriginalFilename(
      originalFilename,
    )

  const storedName
    = `${randomUUID()}.${detected.extension}`

  const quarantineDirectory
    = join(
      uploadRoot(),
      'quarantine',
      'expenses',
      cleanExpenseId,
    )

  await mkdir(
    quarantineDirectory,
    {
      recursive: true,
      mode: 0o750,
    },
  )

  const quarantinePath
    = join(
      'quarantine',
      'expenses',
      cleanExpenseId,
      storedName,
    )

  const finalPath
    = join(
      'expenses',
      cleanExpenseId,
      'attachments',
      storedName,
    )

  await writeFile(
    resolveStoredPath(
      quarantinePath,
    ),
    buffer,
    {
      flag: 'wx',
      mode: 0o640,
    },
  )

  return {
    originalName:
      cleanOriginalName,

    storedName,

    quarantinePath,

    finalPath,

    mimeType:
      detected.mimeType,

    fileSize:
      BigInt(buffer.length),

    sha256:
      createHash('sha256')
        .update(buffer)
        .digest('hex'),
  }
}

/**
 * Déplace un justificatif CLEAN depuis la quarantaine
 * vers son stockage définitif.
 */
export async function promoteExpenseAttachment(
  document:
    QuarantinedExpenseAttachment,
): Promise<StoredExpenseAttachment> {
  if (
    !document.quarantinePath
      .startsWith(
        'quarantine/expenses/',
      )
    || !document.finalPath
      .startsWith(
        'expenses/',
      )
  ) {
    httpError(
      400,
      'Chemin de quarantaine de justificatif invalide.',
      'INVALID_EXPENSE_ATTACHMENT_QUARANTINE_PATH',
    )
  }

  const source
    = resolveStoredPath(
      document.quarantinePath,
    )

  const destination
    = resolveStoredPath(
      document.finalPath,
    )

  const finalDirectory
    = resolve(
      destination,
      '..',
    )

  await mkdir(
    finalDirectory,
    {
      recursive: true,
      mode: 0o750,
    },
  )

  await rename(
    source,
    destination,
  )

  return {
    originalName:
      document.originalName,

    storedName:
      document.storedName,

    filePath:
      document.finalPath,

    mimeType:
      document.mimeType,

    fileSize:
      document.fileSize,

    sha256:
      document.sha256,
  }
}

/**
 * Supprime une pièce présente dans la quarantaine.
 *
 * Utilisé notamment si :
 * - ClamAV est indisponible ;
 * - le fichier est infecté ;
 * - une erreur survient avant promotion.
 */
export async function discardQuarantinedExpenseAttachment(
  document:
    QuarantinedExpenseAttachment,
): Promise<void> {
  await removeStoredFile(
    document.quarantinePath,
  )
}
