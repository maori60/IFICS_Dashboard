import {
  readBody,
  setCookie,
} from 'h3'
import {
  httpError,
  success,
} from '../../utils/api'
import { writeAuditLog } from '../../utils/audit'
import {
  CRA_CLIENT_COOKIE_NAME,
  CRA_CLIENT_COOKIE_PATH,
  setCraClientNoStoreHeaders,
} from '../../utils/cra-client-access'
import { prisma } from '../../utils/prisma'
import {
  createOpaqueToken,
  hashToken,
} from '../../utils/security'
import {
  requiredString,
  safeObject,
} from '../../utils/validation'

function invalidate(): never {
  httpError(
    410,
    'Ce lien CRA est invalide, expiré ou a déjà été utilisé.',
    'CRA_CLIENT_ACCESS_INVALID',
  )
}

export default defineEventHandler(async (event) => {
  const body = safeObject(
    await readBody(event),
  )

  const token = requiredString(
    body.token,
    'Jeton d’accès',
    {
      min: 20,
      max: 200,
    },
  )

  const now = new Date()

  const tokenHash = hashToken(token)

  const access
    = await prisma.craClientAccess.findUnique({
      where: {
        tokenHash,
      },

      select: {
        id: true,
        reportId: true,
        documentId: true,
        purpose: true,
        status: true,
        recipientEmail: true,
        expiresAt: true,
        firstViewedAt: true,
        revokedAt: true,
        completedAt: true,

        document: {
          select: {
            id: true,
            reportId: true,
            type: true,
            status: true,
            reportRevision: true,
            antivirusStatus: true,
            archivedAt: true,

            report: {
              select: {
                associationId: true,
                status: true,
                revision: true,
              },
            },
          },
        },
      },
    })

  if (!access) {
    invalidate()
  }

  if (access.expiresAt <= now) {
    if (access.status === 'ACTIVE') {
      await prisma.craClientAccess
        .updateMany({
          where: {
            id: access.id,
            status: 'ACTIVE',
          },

          data: {
            status: 'EXPIRED',
          },
        })
    }

    invalidate()
  }

  if (
    access.status !== 'ACTIVE'
    || access.revokedAt
    || access.completedAt
  ) {
    invalidate()
  }

  if (
    access.document.type
      !== 'INTERVENOR_SIGNED'
    || access.document.status
      !== 'APPROVED'
    || access.document.antivirusStatus
      !== 'CLEAN'
    || access.document.archivedAt
    || access.document.report.status
      !== 'REVIEWED'
    || access.document.reportRevision
      !== access.document.report.revision
  ) {
    invalidate()
  }

  /*
   * Le token reçu par email est à usage unique.
   * Après son échange, un nouveau secret devient
   * exclusivement le cookie HttpOnly du navigateur.
   */
  const sessionToken
    = createOpaqueToken(32)

  const sessionTokenHash
    = hashToken(sessionToken)

  const rotated
    = await prisma.craClientAccess
      .updateMany({
        where: {
          id: access.id,
          tokenHash,

          status:
            'ACTIVE',

          revokedAt: null,
          completedAt: null,

          expiresAt: {
            gt: now,
          },
        },

        data: {
          tokenHash:
            sessionTokenHash,

          firstViewedAt:
            access.firstViewedAt ?? now,
        },
      })

  if (rotated.count !== 1) {
    invalidate()
  }

  const remainingSeconds = Math.max(
    1,
    Math.floor(
      (
        access.expiresAt.getTime()
        - now.getTime()
      ) / 1000,
    ),
  )

  setCookie(
    event,
    CRA_CLIENT_COOKIE_NAME,
    sessionToken,
    {
      httpOnly: true,

      secure:
        process.env.NODE_ENV
        === 'production',

      sameSite:
        'strict',

      path:
        CRA_CLIENT_COOKIE_PATH,

      maxAge:
        remainingSeconds,
    },
  )

  setCraClientNoStoreHeaders(event)

  await writeAuditLog(
    event,
    null,
    {
      associationId:
        access.document.report
          .associationId,

      userId: null,

      action:
        'CRA_CLIENT_ACCESS_OPENED',

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

        expiresAt:
          access.expiresAt,
      },
    },
  )

  return success({
    exchanged: true,

    purpose:
      access.purpose,

    expiresAt:
      access.expiresAt,
  })
})
