import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { prismaErrorCode, httpError, success } from '../../utils/api'
import { optionalString, requiredEnum, requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

const KINDS = ['PAGE', 'ARTICLE', 'NEWS', 'RND', 'ACTIVITY_REPORT'] as const
function slugify(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180) }

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.CONTENT_WRITE)
  const body = safeObject(await readBody(event))
  const titleFr = requiredString(body.titleFr, 'Titre', { max: 255 })
  const slug = slugify(optionalString(body.slug, 'Slug', { max: 180 }) || titleFr)
  if (!slug) httpError(400, 'Slug invalide.', 'INVALID_SLUG')
  try {
    const entry = await prisma.cmsEntry.create({ data: {
      associationId: context.associationId, kind: requiredEnum(body.kind, KINDS, 'Type'), slug, titleFr,
      titleEn: optionalString(body.titleEn, 'Titre EN', { max: 255 }), excerptFr: optionalString(body.excerptFr, 'Résumé FR'), excerptEn: optionalString(body.excerptEn, 'Résumé EN'),
      bodyFr: requiredString(body.bodyFr, 'Contenu FR', { max: 200000 }), bodyEn: optionalString(body.bodyEn, 'Contenu EN', { max: 200000 }),
      heroImageUrl: optionalString(body.heroImageUrl, 'Image', { max: 500 }), featured: body.featured === true, authorUserId: context.userId,
    } })
    await writeAuditLog(event, context, { action: 'CONTENT_CREATED', entityType: 'CmsEntry', entityId: entry.id, metadata: { kind: entry.kind, slug } })
    return success(entry)
  } catch (error) {
    if (prismaErrorCode(error) === 'P2002') httpError(409, 'Ce slug est déjà utilisé.', 'CONTENT_SLUG_DUPLICATE')
    throw error
  }
})
