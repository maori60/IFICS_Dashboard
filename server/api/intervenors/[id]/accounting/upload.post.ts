import { getRouterParam, readMultipartFormData } from 'h3'
import { assertIntervenorAccess, requirePermission } from '../../../../utils/auth'
import { PERMISSIONS } from '../../../../utils/constants'
import { prisma } from '../../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../../utils/api'
import { storePdf } from '../../../../utils/files'
import { requiredEnum } from '../../../../utils/validation'
import { writeAuditLog } from '../../../../utils/audit'

const TYPES = ['QUOTE', 'INVOICE'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.DOCUMENT_WRITE)
  const intervenorId = requireRouterId(getRouterParam(event, 'id'), 'Intervenant')
  await assertIntervenorAccess(context, intervenorId, false)
  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file')
  if (!file?.filename || !file.data) httpError(400, 'Fichier PDF manquant.', 'FILE_REQUIRED')
  const type = requiredEnum(parts?.find(part => part.name === 'type')?.data.toString(), TYPES, 'Type comptable')
  const projectId = parts?.find(part => part.name === 'projectId')?.data.toString().trim() || null
  const title = parts?.find(part => part.name === 'title')?.data.toString().trim().slice(0, 255) || null
  const description = parts?.find(part => part.name === 'description')?.data.toString().trim().slice(0, 5000) || null
  const periodMonthRaw = parts?.find(part => part.name === 'periodMonth')?.data.toString()
  const periodYearRaw = parts?.find(part => part.name === 'periodYear')?.data.toString()
  const periodMonth = periodMonthRaw ? Number(periodMonthRaw) : null
  const periodYear = periodYearRaw ? Number(periodYearRaw) : null
  if (periodMonth !== null && (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12)) httpError(400, 'Mois invalide.', 'INVALID_PERIOD_MONTH')
  if (periodYear !== null && (!Number.isInteger(periodYear) || periodYear < 2000 || periodYear > 2100)) httpError(400, 'Année invalide.', 'INVALID_PERIOD_YEAR')

  if (projectId) {
    const link = await prisma.projectIntervenor.findFirst({ where: { projectId, intervenorId, project: { associationId: context.associationId, archivedAt: null } }, select: { id: true } })
    if (!link) httpError(400, 'Ce projet n’est pas rattaché à cet intervenant.', 'PROJECT_NOT_ASSIGNED')
  }

  const stored = await storePdf('accounting', intervenorId, file.filename, file.data)
  const previous = await prisma.intervenorAccountingDocument.findFirst({ where: { intervenorId, projectId, type, archivedAt: null }, orderBy: { version: 'desc' }, select: { version: true } })
  const document = await prisma.intervenorAccountingDocument.create({
    data: { intervenorId, projectId, type, status: 'PENDING', title, description, periodMonth, periodYear, version: (previous?.version || 0) + 1, ...stored },
    select: { id: true, projectId: true, type: true, status: true, title: true, originalName: true, fileSize: true, sha256: true, version: true, createdAt: true },
  })
  await writeAuditLog(event, context, { action: 'INTERVENOR_ACCOUNTING_DOCUMENT_UPLOADED', entityType: 'IntervenorAccountingDocument', entityId: document.id, metadata: { intervenorId, projectId, type, sha256: document.sha256 } })
  return success({ ...document, fileSize: document.fileSize.toString() })
})
