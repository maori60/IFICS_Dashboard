import { readBody } from 'h3'
import { requireAuth } from '../../utils/auth'
import { httpError, prismaErrorCode, success } from '../../utils/api'
import { requireCraAssignmentForCreation } from '../../utils/cra'
import { prisma } from '../../utils/prisma'
import {
  badRequest,
  requiredString,
  safeObject,
} from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)
  const body = safeObject(await readBody(event))

  const allowedFields = new Set([
    'projectId',
    'intervenorId',
    'year',
    'month',
  ])

  if (Object.keys(body).some(key => !allowedFields.has(key))) {
    badRequest('La demande contient un champ non autorisé.')
  }

  const projectId = requiredString(body.projectId, 'Projet', { max: 191 })

  const intervenorId = requiredString(
    body.intervenorId ?? context.intervenorId,
    'Intervenant',
    { max: 191 },
  )

  const year = body.year
  const month = body.month

  if (
    typeof year !== 'number'
    || !Number.isInteger(year)
    || year < 2000
    || year > 2100
  ) {
    badRequest('Année invalide : indiquez un entier entre 2000 et 2100.')
  }

  if (
    typeof month !== 'number'
    || !Number.isInteger(month)
    || month < 1
    || month > 12
  ) {
    badRequest('Mois invalide : indiquez un entier entre 1 et 12.')
  }

  await requireCraAssignmentForCreation(context, projectId, intervenorId)

  try {
    const report = await prisma.craReport.create({
      data: {
        associationId: context.associationId,
        projectId,
        intervenorId,
        year,
        month,
      },
      select: {
        id: true,
        projectId: true,
        intervenorId: true,
        year: true,
        month: true,
        status: true,
        revision: true,
      },
    })

    return success(report)
  }
  catch (error) {
    if (prismaErrorCode(error) === 'P2002') {
      httpError(
        409,
        'Un CRA existe déjà pour cet intervenant, ce projet et ce mois.',
        'CRA_ALREADY_EXISTS',
      )
    }

    throw error
  }
})
