import { getRouterParam, setHeader } from 'h3'
import { assertIntervenorAccess, requirePermission } from '../../../../../utils/auth'
import { PERMISSIONS } from '../../../../../utils/constants'
import { prisma } from '../../../../../utils/prisma'
import { contentDispositionFilename, readStoredFile } from '../../../../../utils/files'
import { httpError, requireRouterId } from '../../../../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.DOCUMENT_READ)
  const intervenorId = requireRouterId(getRouterParam(event, 'id'), 'Intervenant')
  const documentId = requireRouterId(getRouterParam(event, 'documentId'), 'Document')
  await assertIntervenorAccess(context, intervenorId, false)
  const document = await prisma.intervenorAccountingDocument.findFirst({ where: { id: documentId, intervenorId, archivedAt: null, intervenor: { associationId: context.associationId } }, select: { originalName: true, filePath: true } })
  if (!document) httpError(404, 'Document introuvable.', 'DOCUMENT_NOT_FOUND')
  const file = await readStoredFile(document.filePath)
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `inline; filename*=UTF-8''${contentDispositionFilename(document.originalName)}`)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return file
})
