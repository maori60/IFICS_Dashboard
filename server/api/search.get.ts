import { getQuery } from 'h3'
import { hasPermission, requireAuth } from '../utils/auth'
import { PERMISSIONS } from '../utils/constants'
import { prisma } from '../utils/prisma'
import { success } from '../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)
  const raw = String(getQuery(event).q || '').trim()
  if (raw.length < 2) return success({ query: raw, results: [] })
  const q = raw.slice(0, 100)
  const results: Array<{ type: string; id: string; title: string; subtitle?: string | null; href: string }> = []

  if (hasPermission(context, PERMISSIONS.CLIENT_READ)) {
    const clients = await prisma.client.findMany({ where: { associationId: context.associationId, archivedAt: null, OR: [{ name: { contains: q, mode: 'insensitive' } }, { city: { contains: q, mode: 'insensitive' } }] }, take: 8, select: { id: true, name: true, city: true } })
    results.push(...clients.map(item => ({ type: 'Client', id: item.id, title: item.name, subtitle: item.city, href: '/dashboard/clients' })))
  }
  if (hasPermission(context, PERMISSIONS.PROJECT_READ)) {
    const mayReadClassified = hasPermission(context, PERMISSIONS.PROJECT_CONFIDENTIAL_READ)
    const projects = await prisma.project.findMany({ where: { associationId: context.associationId, archivedAt: null, ...(!mayReadClassified ? { classification: { in: ['PUBLIC', 'INTERNAL'] } } : {}), OR: [{ title: { contains: q, mode: 'insensitive' } }, { reference: { contains: q, mode: 'insensitive' } }] }, take: 8, select: { id: true, title: true, reference: true } })
    results.push(...projects.map(item => ({ type: 'Projet', id: item.id, title: item.title, subtitle: item.reference, href: '/dashboard/projects' })))
  }
  if (hasPermission(context, PERMISSIONS.INTERVENOR_READ)) {
    const items = await prisma.intervenor.findMany({ where: { associationId: context.associationId, archivedAt: null, OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] }, take: 8, select: { id: true, firstName: true, lastName: true, specialty: true } })
    results.push(...items.map(item => ({ type: 'Intervenant', id: item.id, title: `${item.firstName} ${item.lastName}`, subtitle: item.specialty, href: '/dashboard/intervenors' })))
  }
  if (hasPermission(context, PERMISSIONS.PARTNER_READ)) {
    const items = await prisma.partner.findMany({ where: { associationId: context.associationId, name: { contains: q, mode: 'insensitive' } }, take: 8, select: { id: true, name: true, category: true } })
    results.push(...items.map(item => ({ type: 'Partenaire', id: item.id, title: item.name, subtitle: item.category, href: '/dashboard/partners' })))
  }
  if (hasPermission(context, PERMISSIONS.TICKET_READ)) {
    const items = await prisma.supportTicket.findMany({ where: { associationId: context.associationId, OR: [{ number: { contains: q, mode: 'insensitive' } }, { subject: { contains: q, mode: 'insensitive' } }] }, take: 8, select: { id: true, number: true, subject: true } })
    results.push(...items.map(item => ({ type: 'Ticket', id: item.id, title: `${item.number} — ${item.subject}`, href: '/dashboard/tickets' })))
  }
  if (hasPermission(context, PERMISSIONS.CONTENT_READ)) {
    const items = await prisma.cmsEntry.findMany({ where: { associationId: context.associationId, OR: [{ titleFr: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] }, take: 8, select: { id: true, titleFr: true, kind: true } })
    results.push(...items.map(item => ({ type: 'Contenu', id: item.id, title: item.titleFr, subtitle: item.kind, href: '/dashboard/content' })))
  }
  if (hasPermission(context, PERMISSIONS.IT_READ)) {
    const items = await prisma.asset.findMany({ where: { associationId: context.associationId, OR: [{ inventoryTag: { contains: q, mode: 'insensitive' } }, { serialNumber: { contains: q, mode: 'insensitive' } }, { model: { contains: q, mode: 'insensitive' } }] }, take: 8, select: { id: true, inventoryTag: true, model: true } })
    results.push(...items.map(item => ({ type: 'Matériel', id: item.id, title: item.inventoryTag, subtitle: item.model, href: '/dashboard/assets' })))
  }

  return success({ query: q, results: results.slice(0, 40) })
})
