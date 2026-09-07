import { getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { getPrimaryAssociationId } from '../../utils/association'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const associationId = await getPrimaryAssociationId()
  const locale = getQuery(event).locale === 'en' ? 'en' : 'fr'
  const items = await prisma.intervenorPublicProfile.findMany({ where: { associationId, publicEnabled: true, approvedAt: { not: null } }, orderBy: { displayName: 'asc' } })
  return success(items.map(item => ({ intervenorId: item.intervenorId, displayName: item.displayName, bio: locale === 'en' && item.bioEn ? item.bioEn : item.bioFr, photoUrl: item.photoUrl, skills: item.skills, languages: item.languages, certifications: item.certifications, links: item.links })))
})
