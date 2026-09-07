import { getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { getPrimaryAssociationId } from '../../utils/association'
import { jsonSafe, success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const associationId = await getPrimaryAssociationId()
  const locale = getQuery(event).locale === 'en' ? 'en' : 'fr'
  const items = await prisma.softwareItem.findMany({ where: { associationId, publicEnabled: true, status: { in: ['BETA', 'STABLE'] } }, orderBy: { updatedAt: 'desc' }, include: { category: true, versions: { where: { publishedAt: { not: null } }, orderBy: { publishedAt: 'desc' }, take: 1 } } })
  return success(jsonSafe(items.map(item => ({ id: item.id, slug: item.slug, name: item.name, description: locale === 'en' && item.descriptionEn ? item.descriptionEn : item.descriptionFr, audience: item.audience, platforms: item.platforms, license: item.license, openSource: item.openSource, repoUrl: item.repoUrl, docsUrl: item.docsUrl, videoUrl: item.videoUrl, status: item.status, category: item.category, latestVersion: item.versions[0] || null, downloadCount: item.downloadCount }))))
})
