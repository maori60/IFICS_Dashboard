import { httpError, success } from '../../utils/api'
import { writeAuditLogStrict } from '../../utils/audit'
import {
  clearCraClientCookie,
  requireActiveCraClientAccess,
  setCraClientNoStoreHeaders,
} from '../../utils/cra-client-access'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  setCraClientNoStoreHeaders(event)

  const access
    = await requireActiveCraClientAccess(
      event,
    )

  if (
    access.purpose
    !== 'INITIAL_CONFIRMATION'
  ) {
    httpError(
      403,
      'Cet accès ne permet pas de confirmer le CRA.',
      'CRA_CLIENT_CONFIRMATION_FORBIDDEN',
    )
  }

  const now = new Date()

  await prisma.$transaction(
    async (tx) => {
      const updated
        = await tx.craClientAccess
          .updateMany({
            where: {
              id:
                access.id,

              purpose:
                'INITIAL_CONFIRMATION',

              status:
                'ACTIVE',

              confirmedAt:
                null,

              completedAt:
                null,

              revokedAt:
                null,

              expiresAt: {
                gt:
                  now,
              },
            },

            data: {
              status:
                'COMPLETED',

              confirmedAt:
                now,

              completedAt:
                now,
            },
          })

      if (updated.count !== 1) {
        httpError(
          409,
          'La confirmation du CRA a déjà été traitée.',
          'CRA_CLIENT_CONFIRMATION_CONFLICT',
        )
      }

      await writeAuditLogStrict(
        event,
        null,
        {
          associationId:
            access.document.report
              .associationId,

          userId:
            null,

          action:
            'CRA_CLIENT_ACCESS_CONFIRMED',

          entityType:
            'CraClientAccess',

          entityId:
            access.id,

          metadata: {
            reportId:
              access.reportId,

            documentId:
              access.documentId,

            purpose:
              access.purpose,

            confirmedAt:
              now,

            completedAt:
              now,
          },
        },
        tx,
      )
    },
  )

  /*
   * Le cookie n'est détruit qu'après validation
   * complète de la transaction métier + audit.
   */
  clearCraClientCookie(event)

  return success({
    confirmed:
      true,

    completedAt:
      now,
  })
})
