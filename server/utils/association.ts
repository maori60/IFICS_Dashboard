import { DEFAULT_ASSOCIATION_ID } from './constants'
import { prisma } from './prisma'
import { httpError } from './api'

export async function getPrimaryAssociationId(): Promise<string> {
  const preferred = await prisma.association.findUnique({ where: { id: DEFAULT_ASSOCIATION_ID }, select: { id: true } })
  if (preferred) return preferred.id
  const first = await prisma.association.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } })
  if (!first) httpError(503, 'Association non initialisée.', 'ASSOCIATION_NOT_INITIALIZED')
  return first.id
}
