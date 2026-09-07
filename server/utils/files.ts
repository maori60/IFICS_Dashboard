import { createHash, randomUUID } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { httpError } from './api'

const PDF_SIGNATURE = Buffer.from('%PDF-')
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

export function uploadRoot(): string {
  return resolve(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'))
}

export function maxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB || 10)
  const safeMb = Number.isFinite(mb) && mb >= 1 && mb <= 50 ? mb : 10
  return Math.floor(safeMb * 1024 * 1024)
}

function safeSegment(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,191}$/.test(value)) {
    httpError(400, 'Identifiant de stockage invalide.', 'INVALID_STORAGE_SEGMENT')
  }

  return value
}

export function safeOriginalFilename(value: string): string {
  const clean = basename(value)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/["'<>\\/]/g, '_')
    .trim()
    .slice(0, 180)

  return clean || 'document.pdf'
}

export async function validatePdf(buffer: Buffer): Promise<void> {
  if (!buffer.length || buffer.length > maxUploadBytes()) {
    httpError(
      400,
      `Le PDF doit faire entre 1 octet et ${Math.floor(maxUploadBytes() / 1024 / 1024)} Mo.`,
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
  scope: 'projects' | 'intervenors' | 'accounting' | 'reports',
  ownerId: string,
  originalFilename: string,
  buffer: Buffer,
): Promise<StoredPdf> {
  await validatePdf(buffer)

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

export function contentDispositionFilename(filename: string): string {
  return encodeURIComponent(safeOriginalFilename(filename))
}
