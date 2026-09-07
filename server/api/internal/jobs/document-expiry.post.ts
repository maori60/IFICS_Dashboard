import { getRequestHeader } from 'h3'
import { prisma } from '../../../utils/prisma'
import { hashToken } from '../../../utils/security'
import { httpError, success } from '../../../utils/api'
import { notifyRoles, notifyUser } from '../../../utils/notifications'
import { writeAuditLog } from '../../../utils/audit'

const DAY_MS = 24 * 60 * 60 * 1000
const REMINDER_THRESHOLDS = [7, 15, 30, 60] as const

function reminderThreshold(days: number): number | null {
  return REMINDER_THRESHOLDS.find(threshold => days <= threshold) ?? null
}

export default defineEventHandler(async (event) => {
  const expected = process.env.INTERNAL_JOB_TOKEN?.trim() || ''
  const supplied = getRequestHeader(event, 'x-internal-job-token')?.trim() || ''
  if (expected.length < 32) httpError(503, 'Le jeton de tâches internes n’est pas configuré.', 'JOB_TOKEN_NOT_CONFIGURED')
  if (!supplied || hashToken(supplied) !== hashToken(expected)) {
    httpError(401, 'Jeton de tâche interne invalide.', 'INVALID_JOB_TOKEN')
  }

  const now = new Date()
  const documents = await prisma.intervenorDocument.findMany({
    where: {
      archivedAt: null,
      expiresAt: { not: null },
      status: { in: ['ACCEPTED', 'TO_RENEW', 'EXPIRED'] },
    },
    select: {
      id: true, type: true, status: true, expiresAt: true, lastExpiryReminderDays: true,
      intervenor: { select: { id: true, userId: true, associationId: true, firstName: true, lastName: true } },
    },
  })

  let expired = 0
  let reminded = 0
  for (const document of documents) {
    if (!document.expiresAt) continue
    const days = Math.ceil((document.expiresAt.getTime() - now.getTime()) / DAY_MS)

    if (days <= 0) {
      if (document.status !== 'EXPIRED') {
        await prisma.intervenorDocument.update({ where: { id: document.id }, data: { status: 'EXPIRED', lastExpiryReminderDays: 0 } })
        expired += 1
        if (document.intervenor.userId) {
          await notifyUser(document.intervenor.userId, {
            type: 'WARNING', title: 'Document expiré',
            message: `Votre document ${document.type} est expiré. Déposez une nouvelle version pour maintenir votre dossier à jour.`,
            href: '/dashboard/intervenors', email: true,
          })
        }
        await notifyRoles(document.intervenor.associationId, ['ADMIN', 'MANAGER'], {
          type: 'WARNING', title: 'Document prestataire expiré',
          message: `${document.intervenor.firstName} ${document.intervenor.lastName} doit renouveler le document ${document.type}.`,
          href: '/dashboard/intervenors',
        })
      }
      continue
    }

    const threshold = reminderThreshold(days)
    if (!threshold || document.lastExpiryReminderDays === threshold) continue

    await prisma.intervenorDocument.update({
      where: { id: document.id },
      data: { status: 'TO_RENEW', lastExpiryReminderDays: threshold },
    })
    reminded += 1
    if (document.intervenor.userId) {
      await notifyUser(document.intervenor.userId, {
        type: 'ACTION', title: 'Document bientôt à renouveler',
        message: `Votre document ${document.type} expire dans environ ${days} jour${days > 1 ? 's' : ''}. Préparez son renouvellement.`,
        href: '/dashboard/intervenors', email: threshold <= 15,
      })
    }
  }

  const associationIds = [...new Set(documents.map(document => document.intervenor.associationId))]
  await Promise.all(associationIds.map(associationId => writeAuditLog(event, null, {
    associationId, action: 'DOCUMENT_EXPIRY_JOB_COMPLETED', entityType: 'IntervenorDocument',
    metadata: { scanned: documents.length, expired, reminded },
  })))

  return success({ scanned: documents.length, expired, reminded })
})
