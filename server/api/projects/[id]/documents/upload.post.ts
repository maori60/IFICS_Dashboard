import { getRouterParam, readMultipartFormData } from 'h3'
import { assertProjectAccess, requirePermission } from '../../../../utils/auth'
import { PERMISSIONS } from '../../../../utils/constants'
import { prisma } from '../../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../../utils/api'
import { storePdf } from '../../../../utils/files'
import { requiredEnum } from '../../../../utils/validation'
import { writeAuditLog } from '../../../../utils/audit'

const TYPES = ['CONTRACT', 'CONVENTION', 'QUOTE', 'INVOICE', 'REPORT', 'ANNEX', 'OTHER'] as const
const VISIBILITIES = ['ADMIN_ONLY', 'INTERNAL', 'CLIENT_VISIBLE', 'INTERVENOR_VISIBLE'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PROJECT_WRITE)
  const projectId = requireRouterId(getRouterParam(event, 'id'), 'Projet')
  await assertProjectAccess(context, projectId, true)
  const project = await prisma.project.findFirst({ where: { id: projectId, associationId: context.associationId, archivedAt: null }, select: { id: true } })
  if (!project) httpError(404, 'Projet introuvable.', 'PROJECT_NOT_FOUND')

  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file')
  if (!file?.filename || !file.data) httpError(400, 'Fichier PDF manquant.', 'FILE_REQUIRED')
  const type = requiredEnum(parts?.find(part => part.name === 'type')?.data.toString() || 'OTHER', TYPES, 'Type de document')
  const visibility = requiredEnum(parts?.find(part => part.name === 'visibility')?.data.toString() || 'ADMIN_ONLY', VISIBILITIES, 'Visibilité')
  const title = parts?.find(part => part.name === 'title')?.data.toString().trim().slice(0, 255) || null
  const stored = await storePdf('projects', projectId, file.filename, file.data)
  const previous = await prisma.projectDocument.findFirst({ where: { projectId, type, archivedAt: null }, orderBy: { version: 'desc' }, select: { version: true } })

  const document = await prisma.projectDocument.create({
    data: { projectId, uploadedByUserId: context.userId, type, visibility, title, version: (previous?.version || 0) + 1, ...stored },
    select: { id: true, type: true, visibility: true, title: true, originalName: true, fileSize: true, sha256: true, version: true, createdAt: true },
  })
  await writeAuditLog(event, context, { action: 'PROJECT_DOCUMENT_UPLOADED', entityType: 'ProjectDocument', entityId: document.id, metadata: { projectId, type, visibility, sha256: document.sha256 } })
  return success({ ...document, fileSize: document.fileSize.toString() })
})
