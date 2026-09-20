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
import {
  CRA_HOURS_PER_DAY,
  validateCraDate,
} from '../../../utils/cra-calendar'
import { prisma } from '../../../utils/prisma'
import { badRequest, safeObject } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)
  requireCraWriter(context)

  const reportId = requireRouterId(getRouterParam(event, 'id'), 'CRA')
  const body = safeObject(await readBody(event))

  const allowedFields = new Set(['date', 'selected', 'revision'])

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
          select: { reportId: true },
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

      const totalDays = await tx.craDay.count({
        where: { reportId: report.id },
      })

      return {
        reportId: report.id,
        date: date.toISOString().slice(0, 10),
        selected,
        revision: revision + 1,
        totalDays,
        totalHours: totalDays * CRA_HOURS_PER_DAY,
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