import { getRouterParam } from 'h3'
import { hasPermission, requireAuth } from '../../../utils/auth'
import {
  httpError,
  requireRouterId,
  success,
} from '../../../utils/api'
import { PERMISSIONS } from '../../../utils/constants'
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
    },
  })

  if (!report) {
    httpError(404, 'CRA introuvable ou inaccessible.', 'CRA_NOT_FOUND')
  }

  const { assignment, days, ...details } = report
  const summary = summarizeCraDays(days)

  return success({
    ...details,
    project: assignment.project,
    intervenor: assignment.intervenor,
    days: days.map(day => ({
      ...day,
      date: day.date.toISOString().slice(0, 10),
      hours: day.durationMinutes / 60,
    })),
    ...summary,
  })
})