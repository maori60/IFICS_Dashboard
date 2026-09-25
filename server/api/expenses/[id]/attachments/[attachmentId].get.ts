import { createHash } from 'node:crypto'

import {
  getQuery,
  getRouterParam,
  setResponseHeader,
} from 'h3'

import {
  httpError,
  requireRouterId,
} from '../../../../utils/api'

import { requireAuth } from '../../../../utils/auth'

import {
  contentDispositionFilename,
  readStoredFile,
} from '../../../../utils/files'

import {
  requireExpenseReviewReadAccess,
} from '../../../../utils/expenses'

import { prisma } from '../../../../utils/prisma'

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  const expenseId = requireRouterId(
    getRouterParam(event, 'id'),
    'Dépense',
  )

  const attachmentId = requireRouterId(
    getRouterParam(
      event,
      'attachmentId',
    ),
    'Justificatif',
  )

  /*
   * Vérifie d'abord que l'utilisateur peut voir
   * la dépense. Cela masque notamment les dépenses
   * des autres intervenants.
   */
  await requireExpenseReviewReadAccess(
    context,
    expenseId,
  )

  const attachment
    = await prisma.expenseAttachment.findFirst({
      where: {
        id: attachmentId,
        expenseId,
      },

      select: {
        id: true,
        originalName: true,
        storedName: true,
        filePath: true,
        mimeType: true,
        fileSize: true,
        sha256: true,
      },
    })

  if (!attachment) {
    httpError(
      404,
      'Justificatif introuvable ou inaccessible.',
      'EXPENSE_ATTACHMENT_NOT_FOUND',
    )
  }

  /*
   * Le chemin enregistré doit appartenir à la dépense.
   * Cela empêche une éventuelle altération en base
   * de pointer vers un autre document du stockage.
   */
  const validStoredName
    = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/
      .test(
        attachment.storedName,
      )
      && attachment.storedName !== '.'
      && attachment.storedName !== '..'

  const expectedFilePath
    = `expenses/${expenseId}/attachments/${attachment.storedName}`

  if (
    !validStoredName
    || attachment.filePath
      !== expectedFilePath
  ) {
    httpError(
      409,
      'Le chemin du justificatif enregistré est invalide.',
      'EXPENSE_ATTACHMENT_INVALID_PATH',
    )
  }

  if (
    !ALLOWED_MIME_TYPES.includes(
      attachment.mimeType as
        typeof ALLOWED_MIME_TYPES[number],
    )
  ) {
    httpError(
      409,
      'Le type du justificatif enregistré n’est pas autorisé.',
      'EXPENSE_ATTACHMENT_INVALID_TYPE',
    )
  }

  /*
   * Tous les justificatifs créés par le pipeline
   * sécurisé doivent posséder un SHA-256.
   */
  if (
    !attachment.sha256
    || !/^[a-f0-9]{64}$/.test(
      attachment.sha256,
    )
  ) {
    httpError(
      409,
      'L’intégrité du justificatif ne peut pas être confirmée.',
      'EXPENSE_ATTACHMENT_HASH_MISSING',
    )
  }

  const buffer
    = await readStoredFile(
      attachment.filePath,
    )

  if (
    BigInt(buffer.length)
    !== attachment.fileSize
  ) {
    httpError(
      409,
      'L’intégrité du justificatif ne peut pas être confirmée.',
      'EXPENSE_ATTACHMENT_SIZE_MISMATCH',
    )
  }

  const actualSha256
    = createHash('sha256')
      .update(buffer)
      .digest('hex')

  if (
    actualSha256
    !== attachment.sha256
  ) {
    httpError(
      409,
      'L’intégrité du justificatif ne peut pas être confirmée.',
      'EXPENSE_ATTACHMENT_HASH_MISMATCH',
    )
  }

  const query = getQuery(event)

  const download
    = query.download === '1'

  const encodedFilename
    = contentDispositionFilename(
      attachment.originalName,
    )

  setResponseHeader(
    event,
    'Content-Type',
    attachment.mimeType,
  )

  setResponseHeader(
    event,
    'Content-Length',
    buffer.length,
  )

  setResponseHeader(
    event,
    'Content-Disposition',
    `${
      download
        ? 'attachment'
        : 'inline'
    }; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
  )

  setResponseHeader(
    event,
    'Cache-Control',
    'private, no-store, max-age=0',
  )

  setResponseHeader(
    event,
    'X-Content-Type-Options',
    'nosniff',
  )

  return buffer
})
