import {
  deleteCookie,
  getCookie,
  setResponseHeader,
  type H3Event,
} from 'h3'
import { httpError } from './api'
import { prisma } from './prisma'
import { hashToken } from './security'

export const CRA_CLIENT_COOKIE_NAME
  = 'ifics_cra_client_access'

export const CRA_CLIENT_COOKIE_PATH
  = '/api/cra-client'

export function setCraClientNoStoreHeaders(
  event: H3Event,
) {
  setResponseHeader(
    event,
    'Cache-Control',
    'no-store',
  )

  setResponseHeader(
    event,
    'Pragma',
    'no-cache',
  )
}

export function clearCraClientCookie(
  event: H3Event,
) {
  deleteCookie(
    event,
    CRA_CLIENT_COOKIE_NAME,
    {
      path:
        CRA_CLIENT_COOKIE_PATH,
    },
  )
}

function invalidAccess(
  event: H3Event,
): never {
  clearCraClientCookie(event)

  httpError(
    410,
    'Cet accès CRA est invalide ou expiré.',
    'CRA_CLIENT_ACCESS_INVALID',
  )
}

export async function requireActiveCraClientAccess(
  event: H3Event,
) {
  const sessionToken
    = getCookie(
      event,
      CRA_CLIENT_COOKIE_NAME,
    )

  if (!sessionToken) {
    httpError(
      401,
      'Session CRA client absente.',
      'CRA_CLIENT_SESSION_REQUIRED',
    )
  }

  const now = new Date()

  const access
    = await prisma.craClientAccess.findUnique({
      where: {
        tokenHash:
          hashToken(sessionToken),
      },

      select: {
        id: true,
        reportId: true,
        documentId: true,
        purpose: true,
        status: true,
        expiresAt: true,
        firstViewedAt: true,
        downloadedAt: true,
        confirmedAt: true,
        completedAt: true,
        revokedAt: true,

        document: {
          select: {
            id: true,
            type: true,
            status: true,
            version: true,
            reportRevision: true,
            reference: true,
            originalName: true,
            filePath: true,
            mimeType: true,
            fileSize: true,
            sha256: true,
            antivirusStatus: true,
            archivedAt: true,

            report: {
              select: {
                id: true,
                associationId: true,
                status: true,
                revision: true,
                year: true,
                month: true,

                assignment: {
                  select: {
                    project: {
                      select: {
                        id: true,
                        reference: true,
                        title: true,
                      },
                    },

                    intervenor: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

  if (!access) {
    invalidAccess(event)
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

    invalidAccess(event)
  }

  if (
    access.status !== 'ACTIVE'
    || access.revokedAt
    || access.completedAt
  ) {
    invalidAccess(event)
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
    invalidAccess(event)
  }

  return access
}
