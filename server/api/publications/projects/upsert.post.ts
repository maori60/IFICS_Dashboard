import { readBody } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, success } from '../../../utils/api'
import { optionalDate, optionalString, requiredString, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'

function slugify(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180) }
export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.CONTENT_PUBLISH)
  const body = safeObject(await readBody(event))
  const projectId = requiredString(body.projectId, 'Projet', { max: 191 })
  const project = await prisma.project.findFirst({ where: { id: projectId, associationId: context.associationId, archivedAt: null }, select: { id: true, title: true } })
  if (!project) httpError(404, 'Projet introuvable.', 'PROJECT_NOT_FOUND')
  const titleFr = requiredString(body.titleFr ?? project.title, 'Titre public', { max: 255 })
  const publication = await prisma.projectPublication.upsert({ where: { projectId }, create: { associationId: context.associationId, projectId, slug: slugify(optionalString(body.slug, 'Slug', { max: 180 }) || titleFr), titleFr, titleEn: optionalString(body.titleEn, 'Titre EN', { max: 255 }), summaryFr: requiredString(body.summaryFr, 'Résumé FR', { max: 10000 }), summaryEn: optionalString(body.summaryEn, 'Résumé EN', { max: 10000 }), imageUrl: optionalString(body.imageUrl, 'Image', { max: 500 }), territory: optionalString(body.territory, 'Territoire', { max: 150 }), publicStatus: optionalString(body.publicStatus, 'Statut public', { max: 80 }), publicEnabled: body.publicEnabled === true, publishedAt: body.publicEnabled === true ? (optionalDate(body.publishedAt, 'Publication') || new Date()) : null }, update: { titleFr, titleEn: optionalString(body.titleEn, 'Titre EN', { max: 255 }), summaryFr: requiredString(body.summaryFr, 'Résumé FR', { max: 10000 }), summaryEn: optionalString(body.summaryEn, 'Résumé EN', { max: 10000 }), imageUrl: optionalString(body.imageUrl, 'Image', { max: 500 }), territory: optionalString(body.territory, 'Territoire', { max: 150 }), publicStatus: optionalString(body.publicStatus, 'Statut public', { max: 80 }), publicEnabled: body.publicEnabled === true, publishedAt: body.publicEnabled === true ? (optionalDate(body.publishedAt, 'Publication') || new Date()) : null } })
  await writeAuditLog(event, context, { action: 'PROJECT_PUBLICATION_UPSERTED', entityType: 'ProjectPublication', entityId: publication.id, metadata: { projectId, publicEnabled: publication.publicEnabled } })
  return success(publication)
})
