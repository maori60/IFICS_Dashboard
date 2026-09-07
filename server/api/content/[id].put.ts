import { getRouterParam, readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, requireRouterId, success } from '../../utils/api'
import { optionalString, requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.CONTENT_WRITE)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Contenu')
  const body = safeObject(await readBody(event))
  const existing = await prisma.cmsEntry.findFirst({ where: { id, associationId: context.associationId, archivedAt: null }, select: { id: true, status: true } })
  if (!existing) httpError(404, 'Contenu introuvable.', 'CONTENT_NOT_FOUND')
  if (existing.status === 'PUBLISHED') httpError(409, 'Archivez ou repassez par le workflow avant de modifier un contenu publié.', 'CONTENT_LOCKED')
  const entry = await prisma.cmsEntry.update({ where: { id }, data: {
    titleFr: requiredString(body.titleFr, 'Titre', { max: 255 }), titleEn: optionalString(body.titleEn, 'Titre EN', { max: 255 }),
    excerptFr: optionalString(body.excerptFr, 'Résumé FR'), excerptEn: optionalString(body.excerptEn, 'Résumé EN'),
    bodyFr: requiredString(body.bodyFr, 'Contenu FR', { max: 200000 }), bodyEn: optionalString(body.bodyEn, 'Contenu EN', { max: 200000 }),
    heroImageUrl: optionalString(body.heroImageUrl, 'Image', { max: 500 }), featured: body.featured === true,
  } })
  await writeAuditLog(event, context, { action: 'CONTENT_UPDATED', entityType: 'CmsEntry', entityId: id })
  return success(entry)
})
