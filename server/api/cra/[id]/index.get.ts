import { getRouterParam } from 'h3'
import { hasPermission, requireAuth } from '../../../utils/auth'
import {
  httpError,
  requireRouterId,
  success,
} from '../../../utils/api'
import { PERMISSIONS } from '../../../utils/constants'
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
    periodPolicy,
    days: days.map(day => ({
      ...day,
      date: day.date.toISOString().slice(0, 10),
      hours: day.durationMinutes / 60,
    })),
    ...summary,
  })
})