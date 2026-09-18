import { getRouterParam, readBody } from 'h3'
import { hasPermission, requireAuth } from '../../../utils/auth'
import {
  httpError,
  requireRouterId,
  success,
} from '../../../utils/api'
import { PERMISSIONS } from '../../../utils/constants'
import { requireCraAssignmentForCreation } from '../../../utils/cra'
import {
  CRA_HOURS_PER_DAY,
  validateCraDate,
} from '../../../utils/cra-calendar'
import { prisma } from '../../../utils/prisma'
import { badRequest, safeObject } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)
  const reportId = requireRouterId(getRouterParam(event, 'id'), 'CRA')
  const body = safeObject(await readBody(event))

  const allowedFields = new Set(['confirmed', 'revision'])

  if (Object.keys(body).some(key => !allowedFields.has(key))) {
    badRequest('La demande contient un champ non autorisé.')
  }

  if (body.confirmed !== true) {
    badRequest('Vous devez confirmer le verrouillage du CRA.')
  }

  const revision = body.revision

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

  const canManage = hasPermission(context, PERMISSIONS.CRA_MANAGE)
  const canWriteOwn = hasPermission(context, PERMISSIONS.CRA_WRITE_OWN)
    && context.intervenorId === report.intervenorId

  if (!canManage && !canWriteOwn) {
    httpError(403, 'Soumission de ce CRA interdite.', 'CRA_FORBIDDEN')
  }

  await requireCraAssignmentForCreation(
    context,
    report.projectId,
    report.intervenorId,
  )

  const result = await prisma.$transaction(async (tx) => {
    const submittedAt = new Date()

    const updated = await tx.craReport.updateMany({
      where: {
        id: report.id,
        associationId: context.associationId,
        status: 'DRAFT',
        revision,
      },
      data: {
        status: 'SUBMITTED',
        submittedAt,
        revision: { increment: 1 },
      },
    })

    if (updated.count !== 1) {
      httpError(
        409,
        'Ce CRA a été modifié ou déjà soumis. Rechargez-le avant de continuer.',
        'CRA_SUBMIT_CONFLICT',
      )
    }

    const days = await tx.craDay.findMany({
      where: { reportId: report.id },
      select: { date: true },
      orderBy: { date: 'asc' },
    })

    if (days.length === 0) {
      badRequest('Un CRA vide ne peut pas être soumis.')
    }

    for (const day of days) {
      validateCraDate(day.date.toISOString().slice(0, 10), report)
    }

    return {
      reportId: report.id,
      status: 'SUBMITTED',
      revision: revision + 1,
      submittedAt,
      totalDays: days.length,
      totalHours: days.length * CRA_HOURS_PER_DAY,
    }
  })

  return success(result)
})
