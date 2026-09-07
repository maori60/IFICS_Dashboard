import { getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { getPrimaryAssociationId } from '../../utils/association'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const associationId = await getPrimaryAssociationId()
  const locale = getQuery(event).locale === 'en' ? 'en' : 'fr'
  const partners = await prisma.partner.findMany({ where: { associationId, publicEnabled: true }, orderBy: [{ type: 'asc' }, { name: 'asc' }], select: { id: true, name: true, type: true, website: true, logoUrl: true, descriptionFr: true, descriptionEn: true } })
  return success(partners.map(partner => ({ ...partner, description: locale === 'en' && partner.descriptionEn ? partner.descriptionEn : partner.descriptionFr, descriptionFr: undefined, descriptionEn: undefined })))
})
