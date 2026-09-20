import { getRouterParam, readBody } from 'h3'
import { requireAuth } from '../../../utils/auth'
import {
  httpError,
  prismaErrorCode,
  requireRouterId,
  success,
} from '../../../utils/api'
import {
  requireCraAssignmentForCreation,
  requireCraWriter,
} from '../../../utils/cra'
import { validateCraDate } from '../../../utils/cra-calendar'
import {
  CRA_DEFAULT_DAY_MINUTES,
  CRA_MAX_DAY_MINUTES,
  isCraWritableDayType,
  summarizeCraDays,
  type CraWritableDayType,
} from '../../../utils/cra-summary'
import { prisma } from '../../../utils/prisma'
import { badRequest, safeObject } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)
  requireCraWriter(context)

  const reportId = requireRouterId(getRouterParam(event, 'id'), 'CRA')
  const body = safeObject(await readBody(event))

  const allowedFields = new Set([
    'date',
    'selected',
    'revision',
    'dayType',
    'durationMinutes',
  ])

  if (Object.keys(body).some(key => !allowedFields.has(key))) {
    badRequest('La demande contient un champ non autorisé.')
  }

  const selected = body.selected
  const revision = body.revision

  if (typeof selected !== 'boolean') {
    badRequest('La sélection doit être un booléen.')
  }

  if (
    typeof revision !== 'number'
    || !Number.isSafeInteger(revision)
    || revision < 1
    || revision >= 2147483647
  ) {
    badRequest('Révision du CRA invalide.')
  }

  let dayType: CraWritableDayType = 'WORK'
  let durationMinutes = CRA_DEFAULT_DAY_MINUTES

  if (selected) {
    if (body.dayType !== undefined) {
      if (!isCraWritableDayType(body.dayType)) {
        badRequest('Type de journée CRA invalide.')
      }

      dayType = body.dayType
    }

    if (body.durationMinutes !== undefined) {
      if (
        typeof body.durationMinutes !== 'number'
        || !Number.isSafeInteger(body.durationMinutes)
        || body.durationMinutes < 1
        || body.durationMinutes > CRA_MAX_DAY_MINUTES
      ) {
        badRequest(
          `La durée doit être comprise entre 1 et ${CRA_MAX_DAY_MINUTES} minutes.`,
        )
      }

      durationMinutes = body.durationMinutes
    }
  }

  const report = await prisma.craReport.findFirst({
    where: {
      id: reportId,
      associationId: context.associationId,
    },
    select: {
      id: true,
      projectId: true,
      intervenorId: true,
      year: true,
      month: true,
    },
  })

  if (!report) {
    httpError(404, 'CRA introuvable.', 'CRA_NOT_FOUND')
  }

  await requireCraAssignmentForCreation(
    context,
    report.projectId,
    report.intervenorId,
  )

  const date = validateCraDate(body.date, report)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.craReport.updateMany({
        where: {
          id: report.id,
          associationId: context.associationId,
          status: { in: ['DRAFT', 'REFUSED'] },
          revision,
        },
        data: {
          revision: { increment: 1 },
        },
      })

      if (updated.count !== 1) {
        httpError(
          409,
          'Ce CRA a été modifié ou verrouillé. Rechargez-le avant de continuer.',
          'CRA_EDIT_CONFLICT',
        )
      }

      if (selected) {
        const existing = await tx.craDay.findUnique({
          where: {
            intervenorId_date: {
              intervenorId: report.intervenorId,
              date,
            },
          },
          select: { id: true, reportId: true },
        })

        if (existing && existing.reportId !== report.id) {
          httpError(
            409,
            'Cette journée est déjà déclarée sur un autre CRA.',
            'CRA_DAY_ALREADY_USED',
          )
        }

        if (!existing) {
          await tx.craDay.create({
            data: {
              reportId: report.id,
              intervenorId: report.intervenorId,
              date,
              dayType,
              durationMinutes,
            },
          })
        }
        else {
          await tx.craDay.update({
            where: { id: existing.id },
            data: {
              dayType,
              durationMinutes,
            },
          })
        }
      }
      else {
        await tx.craDay.deleteMany({
          where: {
            reportId: report.id,
            intervenorId: report.intervenorId,
            date,
          },
        })
      }

      const days = await tx.craDay.findMany({
        where: { reportId: report.id },
        select: {
          dayType: true,
          durationMinutes: true,
        },
      })

      return {
        reportId: report.id,
        date: date.toISOString().slice(0, 10),
        selected,
        dayType: selected ? dayType : null,
        durationMinutes: selected ? durationMinutes : null,
        revision: revision + 1,
        ...summarizeCraDays(days),
      }
    })

    return success(result)
  }
  catch (error) {
    if (prismaErrorCode(error) === 'P2002') {
      httpError(
        409,
        'Cette journée vient d’être déclarée sur un autre CRA.',
        'CRA_DAY_ALREADY_USED',
      )
    }

    throw error
  }
})