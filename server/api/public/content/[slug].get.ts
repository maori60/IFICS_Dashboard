import { getRouterParam, getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { getPrimaryAssociationId } from '../../../utils/association'
import { httpError, requireRouterId, success } from '../../../utils/api'

export default defineEventHandler(async (event) => {
  const associationId = await getPrimaryAssociationId()
  const slug = requireRouterId(getRouterParam(event, 'slug'), 'Contenu')
  const locale = getQuery(event).locale === 'en' ? 'en' : 'fr'
  const entry = await prisma.cmsEntry.findFirst({ where: { associationId, slug, status: 'PUBLISHED', publishedAt: { lte: new Date() }, archivedAt: null }, select: { kind: true, slug: true, titleFr: true, titleEn: true, excerptFr: true, excerptEn: true, bodyFr: true, bodyEn: true, heroImageUrl: true, gallery: true, publishedAt: true, updatedAt: true } })
  if (!entry) httpError(404, 'Contenu introuvable.', 'PUBLIC_CONTENT_NOT_FOUND')
  return success({ kind: entry.kind, slug: entry.slug, title: locale === 'en' && entry.titleEn ? entry.titleEn : entry.titleFr, excerpt: locale === 'en' && entry.excerptEn ? entry.excerptEn : entry.excerptFr, body: locale === 'en' && entry.bodyEn ? entry.bodyEn : entry.bodyFr, heroImageUrl: entry.heroImageUrl, gallery: entry.gallery, publishedAt: entry.publishedAt, updatedAt: entry.updatedAt })
})
