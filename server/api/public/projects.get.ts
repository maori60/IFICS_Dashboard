import { getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { getPrimaryAssociationId } from '../../utils/association'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const associationId = await getPrimaryAssociationId()
  const locale = getQuery(event).locale === 'en' ? 'en' : 'fr'
  const items = await prisma.projectPublication.findMany({ where: { associationId, publicEnabled: true, publishedAt: { lte: new Date() } }, orderBy: { publishedAt: 'desc' } })
  return success(items.map(item => ({ id: item.id, projectId: item.projectId, slug: item.slug, title: locale === 'en' && item.titleEn ? item.titleEn : item.titleFr, summary: locale === 'en' && item.summaryEn ? item.summaryEn : item.summaryFr, imageUrl: item.imageUrl, territory: item.territory, status: item.publicStatus, publishedAt: item.publishedAt })))
})
