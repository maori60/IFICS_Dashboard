import { readBody } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, success } from '../../../utils/api'
import { optionalString, requiredString, safeObject, stringArray } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.CONTENT_PUBLISH)
  const body = safeObject(await readBody(event))
  const intervenorId = requiredString(body.intervenorId, 'Intervenant', { max: 191 })
  const intervenor = await prisma.intervenor.findFirst({ where: { id: intervenorId, associationId: context.associationId, archivedAt: null }, select: { firstName: true, lastName: true } })
  if (!intervenor) httpError(404, 'Intervenant introuvable.', 'INTERVENOR_NOT_FOUND')
  const enabled = body.publicEnabled === true
  const profile = await prisma.intervenorPublicProfile.upsert({ where: { intervenorId }, create: { associationId: context.associationId, intervenorId, displayName: optionalString(body.displayName, 'Nom public', { max: 200 }) || `${intervenor.firstName} ${intervenor.lastName}`, bioFr: optionalString(body.bioFr, 'Bio FR', { max: 20000 }), bioEn: optionalString(body.bioEn, 'Bio EN', { max: 20000 }), photoUrl: optionalString(body.photoUrl, 'Photo', { max: 500 }), skills: stringArray(body.skills ?? [], 'Compétences', { maxItems: 50, itemMax: 120 }), languages: stringArray(body.languages ?? [], 'Langues', { maxItems: 30, itemMax: 80 }), certifications: stringArray(body.certifications ?? [], 'Certifications', { maxItems: 50, itemMax: 160 }), publicEnabled: enabled, approvedAt: enabled ? new Date() : null, approvedByUserId: enabled ? context.userId : null }, update: { displayName: optionalString(body.displayName, 'Nom public', { max: 200 }) || `${intervenor.firstName} ${intervenor.lastName}`, bioFr: optionalString(body.bioFr, 'Bio FR', { max: 20000 }), bioEn: optionalString(body.bioEn, 'Bio EN', { max: 20000 }), photoUrl: optionalString(body.photoUrl, 'Photo', { max: 500 }), skills: stringArray(body.skills ?? [], 'Compétences', { maxItems: 50, itemMax: 120 }), languages: stringArray(body.languages ?? [], 'Langues', { maxItems: 30, itemMax: 80 }), certifications: stringArray(body.certifications ?? [], 'Certifications', { maxItems: 50, itemMax: 160 }), publicEnabled: enabled, approvedAt: enabled ? new Date() : null, approvedByUserId: enabled ? context.userId : null } })
  await writeAuditLog(event, context, { action: 'INTERVENOR_PUBLIC_PROFILE_UPSERTED', entityType: 'IntervenorPublicProfile', entityId: profile.id, metadata: { intervenorId, publicEnabled: enabled } })
  return success(profile)
})
