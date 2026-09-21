import { getRouterParam } from 'h3'
import { hasPermission, requireAuth } from '../../../utils/auth'
import {
  httpError,
  requireRouterId,
  success,
} from '../../../utils/api'
import { PERMISSIONS } from '../../../utils/constants'
import { getCraClientRecipients } from '../../../utils/cra-client-recipients'
import { craPeriodPolicy } from '../../../utils/cra-calendar'
import { summarizeCraDays } from '../../../utils/cra-summary'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)
  const reportId = requireRouterId(getRouterParam(event, 'id'), 'CRA')

  const canReadAll = hasPermission(context, PERMISSIONS.CRA_READ_ALL)
  const canReadOwn = hasPermission(context, PERMISSIONS.CRA_READ_OWN)
    && Boolean(context.intervenorId)

  if (!canReadAll && !canReadOwn) {
    httpError(403, 'Consultation des CRA interdite.', 'CRA_FORBIDDEN')
  }

  const canReadConfidential = hasPermission(
    context,
    PERMISSIONS.PROJECT_CONFIDENTIAL_READ,
  )

  const canManageCra = hasPermission(
    context,
    PERMISSIONS.CRA_MANAGE,
  )

  const canReadClientPublication = Boolean(
    canReadAll
    && hasPermission(
      context,
      PERMISSIONS.CRA_SEND_CLIENT,
    ),
  )

  const report = await prisma.craReport.findFirst({
    where: {
      id: reportId,
      associationId: context.associationId,
      ...(!canReadAll
        ? { intervenorId: context.intervenorId! }
        : {}),
      assignment: {
        project: {
          associationId: context.associationId,
          ...(!canReadConfidential
            ? { classification: { notIn: ['CONFIDENTIAL', 'RESTRICTED'] } }
            : {}),
        },
        intervenor: {
          associationId: context.associationId,
        },
      },
    },
    select: {
      id: true,
      projectId: true,
      intervenorId: true,
      year: true,
      month: true,
      status: true,
      revision: true,
      submittedAt: true,
      validatedAt: true,
      reviewedAt: true,
      reviewedById: true,
      correctionRequestedAt: true,
      correctionRequestedById: true,
      correctionReason: true,
      createdAt: true,
      updatedAt: true,
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
              email: true,
            },
          },
        },
      },
      days: {
        orderBy: { date: 'asc' },
        select: {
          id: true,
          date: true,
          dayType: true,
          durationMinutes: true,
          comment: true,
          hasIncident: true,
          incident: true,
        },
      },
      documents: {
        where: {
          type: 'IFICS_TO_SIGN',
        },
        orderBy: {
          version: 'desc',
        },
        take: 1,
        select: {
          id: true,
          type: true,
          status: true,
          version: true,
          reportRevision: true,
          reference: true,
          ificsVisaDate: true,
          intervenorSignatureDate: true,
          createdAt: true,
          sentToIntervenorAt: true,
        },
      },
    },
  })

  if (!report) {
    httpError(404, 'CRA introuvable ou inaccessible.', 'CRA_NOT_FOUND')
  }

  const signedDocument = await prisma.craDocument.findFirst({
    where: {
      reportId: report.id,
      type: 'INTERVENOR_SIGNED',
      archivedAt: null,
    },

    orderBy: {
      version: 'desc',
    },

    select: {
      id: true,
      type: true,
      status: true,
      version: true,
      reportRevision: true,
      reference: true,
      originalName: true,
      mimeType: true,
      fileSize: true,
      antivirusStatus: true,
      receivedAt: true,
      reviewedAt: true,
      rejectionReason: true,
      createdAt: true,

      sourceDocument: {
        select: {
          id: true,
          reference: true,
          version: true,
        },
      },
    },
  })

  const clientRecipientMap
    = canReadClientPublication
      ? await getCraClientRecipients(
          report.assignment.project.id,
          context.associationId,
        )
      : null

  const clientRecipients
    = clientRecipientMap
      ? Array.from(
          clientRecipientMap.values(),
        )
          .map(recipient => ({
            email:
              recipient.email,

            clientName:
              recipient.clientName,

            contactFirstName:
              recipient.contactFirstName,

            contactLastName:
              recipient.contactLastName,

            isPrimary:
              recipient.isPrimary,
          }))
          .sort((left, right) =>
            left.clientName.localeCompare(
              right.clientName,
              'fr',
            )
            || Number(right.isPrimary)
              - Number(left.isPrimary)
            || left.email.localeCompare(
              right.email,
              'fr',
            ),
          )
      : []

  /*
   * On ne rattache l'état de publication qu'au
   * document signé approuvé correspondant à la
   * révision actuelle du CRA.
   *
   * Un verrou PENDING déjà expiré est ignoré ici :
   * il ne doit pas masquer un éventuel accès ACTIVE
   * précédent dans l'interface d'administration.
   */
  const latestClientAccess
    = canReadClientPublication
      && signedDocument?.status === 'APPROVED'
      && signedDocument.antivirusStatus === 'CLEAN'
      && signedDocument.reportRevision === report.revision
      ? await prisma.craClientAccess.findFirst({
          where: {
            reportId:
              report.id,

            documentId:
              signedDocument.id,

            OR: [
              {
                status: {
                  not: 'PENDING',
                },
              },
              {
                status:
                  'PENDING',

                expiresAt: {
                  gt: new Date(),
                },
              },
            ],
          },

          orderBy: {
            createdAt:
              'desc',
          },

          select: {
            purpose: true,
            status: true,
            recipientEmail: true,

            expiresAt: true,
            firstViewedAt: true,
            downloadedAt: true,
            confirmedAt: true,
            completedAt: true,
            revokedAt: true,
            emailSentAt: true,
            createdAt: true,
          },
        })
      : null

  const clientPublication
    = latestClientAccess
      ? {
          purpose:
            latestClientAccess.purpose,

          status:
            latestClientAccess.status,

          recipientEmail:
            latestClientAccess.recipientEmail,

          expiresAt:
            latestClientAccess.expiresAt
              .toISOString(),

          firstViewedAt:
            latestClientAccess.firstViewedAt
              ?.toISOString()
            ?? null,

          downloadedAt:
            latestClientAccess.downloadedAt
              ?.toISOString()
            ?? null,

          confirmedAt:
            latestClientAccess.confirmedAt
              ?.toISOString()
            ?? null,

          completedAt:
            latestClientAccess.completedAt
              ?.toISOString()
            ?? null,

          revokedAt:
            latestClientAccess.revokedAt
              ?.toISOString()
            ?? null,

          emailSentAt:
            latestClientAccess.emailSentAt
              ?.toISOString()
            ?? null,

          createdAt:
            latestClientAccess.createdAt
              .toISOString(),
        }
      : null

  const latestOfficialDocument = report.documents[0] ?? null

  const canUploadSignedDocument = Boolean(
    canReadOwn
    && context.intervenorId === report.intervenorId
    && hasPermission(
      context,
      PERMISSIONS.CRA_WRITE_OWN,
    )
    && report.status === 'REVIEWED'
    && latestOfficialDocument?.status === 'SENT_TO_INTERVENOR'
    && (
      !signedDocument
      || signedDocument.status === 'REJECTED'
      || signedDocument.status === 'SUPERSEDED'
    )
  )

  const {
    assignment,
    days,
    documents,
    ...details
  } = report
  const summary = summarizeCraDays(days)
  const periodPolicy = craPeriodPolicy(report)

  return success({
    ...details,
    project: assignment.project,
    intervenor: {
      id: assignment.intervenor.id,
      firstName: assignment.intervenor.firstName,
      lastName: assignment.intervenor.lastName,
      email: canReadAll && canManageCra
        ? assignment.intervenor.email
        : null,
    },
    officialDocument: canReadAll && documents[0]
      ? {
          ...documents[0],
          ificsVisaDate:
            documents[0].ificsVisaDate
              ?.toISOString()
              .slice(0, 10)
            ?? null,
          intervenorSignatureDate:
            documents[0].intervenorSignatureDate
              ?.toISOString()
              .slice(0, 10)
            ?? null,
        }
      : null,

    signedDocument: signedDocument
      ? {
          ...signedDocument,
          fileSize:
            signedDocument.fileSize.toString(),
        }
      : null,

    canUploadSignedDocument,

    clientRecipients,
    clientPublication,

    periodPolicy,
    days: days.map(day => ({
      ...day,
      date: day.date.toISOString().slice(0, 10),
      hours: day.durationMinutes / 60,
    })),
    ...summary,
  })
})