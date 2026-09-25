import { getRouterParam, readBody } from 'h3'
import { requireAuth } from '../../../../utils/auth'
import { httpError, requireRouterId, success } from '../../../../utils/api'
import { ROLE_CODES } from '../../../../utils/constants'
import { prisma } from '../../../../utils/prisma'
import { safeObject } from '../../../../utils/validation'
import { writeAuditLogStrict } from '../../../../utils/audit'

const CONFIRMATION = 'SUPPRIMER'

type DeletableEntity
  = | 'client'
    | 'partner'
    | 'intervenor'
    | 'project'
    | 'asset'
    | 'rnd'
    | 'content'
    | 'billing'
    | 'expense'
    | 'cra'
    | 'report'

const SUPPORTED = new Set<DeletableEntity>([
  'client',
  'partner',
  'intervenor',
  'project',
  'asset',
  'rnd',
  'content',
  'billing',
  'expense',
  'cra',
  'report',
])

function blocked(message: string, details: Record<string, number | string | boolean> = {}): never {
  httpError(409, message, 'PERMANENT_DELETE_BLOCKED', details)
}

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  if (context.roleCode !== ROLE_CODES.ADMIN) {
    httpError(
      403,
      'La suppression définitive est réservée aux administrateurs.',
      'PERMANENT_DELETE_ADMIN_REQUIRED',
    )
  }

  if (!context.mfaVerified) {
    httpError(
      403,
      'Une validation MFA est requise pour supprimer définitivement une donnée.',
      'PERMANENT_DELETE_MFA_REQUIRED',
    )
  }

  const rawEntity = getRouterParam(event, 'entity')
  const entity = typeof rawEntity === 'string'
    ? rawEntity.toLowerCase() as DeletableEntity
    : '' as DeletableEntity

  if (!SUPPORTED.has(entity)) {
    httpError(404, 'Type de donnée non pris en charge.', 'DELETE_ENTITY_NOT_SUPPORTED')
  }

  const id = requireRouterId(getRouterParam(event, 'id'), 'Donnée')
  const body = safeObject(await readBody(event))

  if (body.confirmation !== CONFIRMATION) {
    httpError(
      400,
      `Saisissez exactement « ${CONFIRMATION} » pour confirmer la suppression définitive.`,
      'PERMANENT_DELETE_CONFIRMATION_REQUIRED',
    )
  }

  const result = await prisma.$transaction(async (tx) => {
    let label = id
    let entityType: string = entity

    switch (entity) {
      case 'client': {
        const item = await tx.client.findFirst({
          where: { id, associationId: context.associationId },
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                projectClients: true,
                users: true,
                billingDocuments: true,
              },
            },
          },
        })
        if (!item) httpError(404, 'Client introuvable.', 'CLIENT_NOT_FOUND')
        label = item.name
        if (item._count.projectClients || item._count.users || item._count.billingDocuments) {
          blocked(
            'Ce client possède un historique métier. Archivez-le ou retirez d’abord ses dépendances supprimables.',
            item._count,
          )
        }
        await tx.client.delete({ where: { id } })
        entityType = 'Client'
        break
      }

      case 'partner': {
        const item = await tx.partner.findFirst({
          where: { id, associationId: context.associationId },
          select: { id: true, name: true },
        })
        if (!item) httpError(404, 'Partenaire introuvable.', 'PARTNER_NOT_FOUND')
        label = item.name
        await tx.partner.delete({ where: { id } })
        entityType = 'Partner'
        break
      }

      case 'intervenor': {
        const item = await tx.intervenor.findFirst({
          where: { id, associationId: context.associationId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            userId: true,
            _count: {
              select: {
                projectLinks: true,
                documents: true,
                accountingDocuments: true,
                reports: true,
                expenses: true,
              },
            },
          },
        })
        if (!item) httpError(404, 'Intervenant introuvable.', 'INTERVENOR_NOT_FOUND')
        label = `${item.firstName} ${item.lastName}`
        const dependencyCount = Object.values(item._count).reduce((sum, value) => sum + value, 0)
        if (item.userId || dependencyCount) {
          blocked(
            'Cet intervenant possède un compte ou un historique métier. Archivez-le au lieu de le supprimer.',
            { linkedUser: Boolean(item.userId), ...item._count },
          )
        }
        await tx.intervenor.delete({ where: { id } })
        entityType = 'Intervenor'
        break
      }

      case 'project': {
        const item = await tx.project.findFirst({
          where: { id, associationId: context.associationId },
          select: {
            id: true,
            title: true,
            _count: {
              select: {
                documents: true,
                reports: true,
                accountingDocuments: true,
                billingDocuments: true,
                expenses: true,
              },
            },
          },
        })
        if (!item) httpError(404, 'Projet introuvable.', 'PROJECT_NOT_FOUND')
        const craCount = await tx.craReport.count({ where: { projectId: id } })
        label = item.title
        const dependencyCount = Object.values(item._count).reduce((sum, value) => sum + value, 0) + craCount
        if (dependencyCount) {
          blocked(
            'Ce projet contient des documents ou un historique métier. Archivez-le au lieu de le supprimer.',
            { ...item._count, craReports: craCount },
          )
        }
        // ProjectClient and ProjectIntervenor are only links at this point and cascade safely.
        await tx.project.delete({ where: { id } })
        entityType = 'Project'
        break
      }

      case 'asset': {
        const item = await tx.asset.findFirst({
          where: { id, associationId: context.associationId },
          select: { id: true, inventoryTag: true },
        })
        if (!item) httpError(404, 'Matériel introuvable.', 'ASSET_NOT_FOUND')
        const documents = await tx.assetDocument.count({ where: { assetId: id } })
        if (documents) {
          blocked(
            'Ce matériel possède des documents. Ils doivent être conservés ou traités avant une suppression définitive.',
            { documents },
          )
        }
        label = item.inventoryTag
        await tx.asset.delete({ where: { id } })
        entityType = 'Asset'
        break
      }

      case 'rnd': {
        const item = await tx.rndProject.findFirst({
          where: { id, associationId: context.associationId },
          select: { id: true, title: true },
        })
        if (!item) httpError(404, 'Projet R&D introuvable.', 'RND_NOT_FOUND')
        label = item.title
        await tx.rndProject.delete({ where: { id } })
        entityType = 'RndProject'
        break
      }

      case 'content': {
        const item = await tx.cmsEntry.findFirst({
          where: { id, associationId: context.associationId },
          select: { id: true, titleFr: true, status: true, publishedAt: true },
        })
        if (!item) httpError(404, 'Contenu introuvable.', 'CONTENT_NOT_FOUND')
        if (item.publishedAt || ['PUBLISHED', 'ARCHIVED'].includes(item.status)) {
          blocked('Un contenu déjà publié doit rester traçable. Archivez-le au lieu de le supprimer.', { status: item.status })
        }
        label = item.titleFr
        await tx.cmsEntry.delete({ where: { id } })
        entityType = 'CmsEntry'
        break
      }

      case 'billing': {
        const item = await tx.billingDocument.findFirst({
          where: { id, associationId: context.associationId },
          select: {
            id: true,
            number: true,
            status: true,
            sourceQuoteId: true,
            _count: { select: { payments: true, convertedInvoices: true } },
          },
        })
        if (!item) httpError(404, 'Document de facturation introuvable.', 'BILLING_NOT_FOUND')
        if (item.status !== 'DRAFT' || item.sourceQuoteId || item._count.payments || item._count.convertedInvoices) {
          blocked(
            'Seul un brouillon de facturation sans règlement ni conversion peut être supprimé définitivement.',
            { status: item.status, payments: item._count.payments, convertedInvoices: item._count.convertedInvoices },
          )
        }
        label = item.number
        await tx.billingDocument.delete({ where: { id } })
        entityType = 'BillingDocument'
        break
      }

      case 'expense': {
        const item = await tx.expense.findFirst({
          where: { id, associationId: context.associationId, archivedAt: null },
          select: { id: true, description: true, status: true, _count: { select: { attachments: true } } },
        })
        if (!item) httpError(404, 'Dépense introuvable.', 'EXPENSE_NOT_FOUND')
        if (item.status !== 'DRAFT' || item._count.attachments) {
          blocked(
            'Seule une dépense brouillon sans justificatif peut être supprimée définitivement.',
            { status: item.status, attachments: item._count.attachments },
          )
        }
        label = item.description.slice(0, 120)
        await tx.expense.delete({ where: { id } })
        entityType = 'Expense'
        break
      }

      case 'cra': {
        const item = await tx.craReport.findFirst({
          where: { id, associationId: context.associationId },
          select: { id: true, status: true, year: true, month: true, _count: { select: { documents: true, clientDecisions: true } } },
        })
        if (!item) httpError(404, 'CRA introuvable.', 'CRA_NOT_FOUND')
        if (item.status !== 'DRAFT' || item._count.documents || item._count.clientDecisions) {
          blocked(
            'Seul un CRA brouillon sans document officiel ni décision client peut être supprimé définitivement.',
            { status: item.status, documents: item._count.documents, clientDecisions: item._count.clientDecisions },
          )
        }
        label = `CRA ${item.year}-${String(item.month).padStart(2, '0')}`
        await tx.craDay.deleteMany({ where: { reportId: id } })
        await tx.craReport.delete({ where: { id } })
        entityType = 'CraReport'
        break
      }

      case 'report': {
        const item = await tx.projectReport.findFirst({
          where: { id, project: { associationId: context.associationId } },
          select: { id: true, title: true, status: true, currentVersion: true, _count: { select: { versions: true } } },
        })
        if (!item) httpError(404, 'Bilan introuvable.', 'REPORT_NOT_FOUND')
        if (!['NOT_STARTED', 'IN_PROGRESS'].includes(item.status) || item.currentVersion > 0 || item._count.versions) {
          blocked(
            'Un bilan déjà versionné, soumis ou validé doit rester traçable.',
            { status: item.status, versions: item._count.versions },
          )
        }
        label = item.title || 'Bilan'
        await tx.projectReport.delete({ where: { id } })
        entityType = 'ProjectReport'
        break
      }
    }

    await writeAuditLogStrict(
      event,
      context,
      {
        action: 'ENTITY_PERMANENTLY_DELETED',
        entityType,
        entityId: id,
        metadata: { entity, label, confirmation: true },
      },
      tx,
    )

    return { id, entity, label }
  })

  return success({ deleted: true, ...result })
})
