import { getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { getPrimaryAssociationId } from '../../../utils/association'
import { success } from '../../../utils/api'

export default defineEventHandler(async (event) => {
  const associationId = await getPrimaryAssociationId()
  const query = getQuery(event)
  const kind = typeof query.kind === 'string' ? query.kind : undefined
  const locale = query.locale === 'en' ? 'en' : 'fr'
  const entries = await prisma.cmsEntry.findMany({
    where: { associationId, status: 'PUBLISHED', publishedAt: { lte: new Date() }, archivedAt: null, ...(kind && ['PAGE', 'ARTICLE', 'NEWS', 'RND', 'ACTIVITY_REPORT'].includes(kind) ? { kind: kind as 'PAGE' | 'ARTICLE' | 'NEWS' | 'RND' | 'ACTIVITY_REPORT' } : {}) },
    orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }], take: 100,
    select: { id: true, kind: true, slug: true, titleFr: true, titleEn: true, excerptFr: true, excerptEn: true, heroImageUrl: true, featured: true, publishedAt: true },
  })
  return success(entries.map(entry => ({ id: entry.id, kind: entry.kind, slug: entry.slug, title: locale === 'en' && entry.titleEn ? entry.titleEn : entry.titleFr, excerpt: locale === 'en' && entry.excerptEn ? entry.excerptEn : entry.excerptFr, heroImageUrl: entry.heroImageUrl, featured: entry.featured, publishedAt: entry.publishedAt })))
})
