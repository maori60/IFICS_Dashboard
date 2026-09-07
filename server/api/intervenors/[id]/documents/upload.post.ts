import { getRouterParam, readMultipartFormData } from 'h3'
import { assertIntervenorAccess, requirePermission } from '../../../../utils/auth'
import { PERMISSIONS } from '../../../../utils/constants'
import { prisma } from '../../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../../utils/api'
import { storePdf } from '../../../../utils/files'
import { optionalDate, requiredEnum } from '../../../../utils/validation'
import { writeAuditLog } from '../../../../utils/audit'

const TYPES = ['IDENTITY', 'SIRENE', 'RC_PRO', 'CONTRACT', 'CONVENTION', 'SIGNED_CONVENTION', 'OTHER'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.DOCUMENT_WRITE)
  const intervenorId = requireRouterId(getRouterParam(event, 'id'), 'Intervenant')
  await assertIntervenorAccess(context, intervenorId, false)
  const exists = await prisma.intervenor.findFirst({ where: { id: intervenorId, associationId: context.associationId, archivedAt: null }, select: { id: true } })
  if (!exists) httpError(404, 'Intervenant introuvable.', 'INTERVENOR_NOT_FOUND')

  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file')
  if (!file?.filename || !file.data) httpError(400, 'Fichier PDF manquant.', 'FILE_REQUIRED')
  const typeRaw = parts?.find(part => part.name === 'type')?.data.toString()
  const title = parts?.find(part => part.name === 'title')?.data.toString().trim().slice(0, 255) || null
  const issuedAtRaw = parts?.find(part => part.name === 'issuedAt')?.data.toString()
  const expiresAtRaw = parts?.find(part => part.name === 'expiresAt')?.data.toString()
  const type = requiredEnum(typeRaw, TYPES, 'Type de document')
  const issuedAt = optionalDate(issuedAtRaw, 'Date d’émission')
  const expiresAt = optionalDate(expiresAtRaw, 'Date d’expiration')
  if (issuedAt && expiresAt && expiresAt <= issuedAt) {
    httpError(400, 'La date d’expiration doit être postérieure à la date d’émission.', 'INVALID_DOCUMENT_DATE_RANGE')
  }

  const stored = await storePdf('intervenors', intervenorId, file.filename, file.data)
  const previous = await prisma.intervenorDocument.findFirst({ where: { intervenorId, type, archivedAt: null }, orderBy: { version: 'desc' }, select: { version: true } })
  const document = await prisma.intervenorDocument.create({
    data: { intervenorId, type, title, status: 'PENDING', version: (previous?.version || 0) + 1, issuedAt, expiresAt, ...stored },
    select: { id: true, type: true, status: true, title: true, originalName: true, fileSize: true, sha256: true, version: true, issuedAt: true, expiresAt: true, createdAt: true },
  })

  await writeAuditLog(event, context, {
    action: 'INTERVENOR_DOCUMENT_UPLOADED', entityType: 'IntervenorDocument', entityId: document.id,
    metadata: { intervenorId, type, sha256: document.sha256, issuedAt, expiresAt },
  })
  return success({ ...document, fileSize: document.fileSize.toString() })
})
