import { getRouterParam, setHeader } from 'h3'
import { assertProjectAccess, requirePermission } from '../../../../utils/auth'
import { PERMISSIONS, ROLE_CODES } from '../../../../utils/constants'
import { prisma } from '../../../../utils/prisma'
import { httpError, requireRouterId } from '../../../../utils/api'
import { contentDispositionFilename, readStoredFile } from '../../../../utils/files'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.DOCUMENT_READ)
  const documentId = requireRouterId(getRouterParam(event, 'documentId'), 'Document')
  const document = await prisma.projectDocument.findFirst({
    where: { id: documentId, archivedAt: null, project: { associationId: context.associationId, archivedAt: null } },
    select: { projectId: true, visibility: true, originalName: true, filePath: true },
  })
  if (!document) httpError(404, 'Document introuvable.', 'DOCUMENT_NOT_FOUND')
  await assertProjectAccess(context, document.projectId, false)
  if (context.roleCode === ROLE_CODES.CLIENT && document.visibility !== 'CLIENT_VISIBLE') httpError(403, 'Document non partagé avec le client.', 'DOCUMENT_FORBIDDEN')
  if (context.roleCode === ROLE_CODES.INTERVENOR && document.visibility !== 'INTERVENOR_VISIBLE') httpError(403, 'Document non partagé avec l’intervenant.', 'DOCUMENT_FORBIDDEN')

  const file = await readStoredFile(document.filePath)
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `inline; filename*=UTF-8''${contentDispositionFilename(document.originalName)}`)
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  return file
})
