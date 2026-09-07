import type { Prisma } from '../../generated/prisma/client'
import { hasPermission, type AuthContext } from './auth'
import { PERMISSIONS } from './constants'
import { httpError } from './api'

export async function nextTicketNumber(
  tx: Prisma.TransactionClient,
  associationId: string,
  date = new Date(),
): Promise<string> {
  const year = date.getFullYear()
  const sequence = await tx.ticketSequence.upsert({
    where: { associationId_year: { associationId, year } },
    create: { associationId, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  })
  return `INC-${year}-${String(sequence.lastNumber).padStart(4, '0')}`
}

export function canManageTickets(context: AuthContext): boolean {
  return hasPermission(context, PERMISSIONS.TICKET_MANAGE)
}

export function assertTicketOwner(context: AuthContext, requesterUserId: string | null): void {
  if (canManageTickets(context) || requesterUserId === context.userId) return
  httpError(403, 'Accès à ce ticket interdit.', 'TICKET_FORBIDDEN')
}
