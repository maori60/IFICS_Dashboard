import { getQuery } from 'h3'
import type { Prisma } from '../../../generated/prisma/client'
import { hasPermission, requireAuth } from '../../utils/auth'
import { httpError, success } from '../../utils/api'
import { PERMISSIONS } from '../../utils/constants'
import { summarizeCraDays } from '../../utils/cra-summary'
import { prisma } from '../../utils/prisma'
import { badRequest } from '../../utils/validation'

function queryInteger(
  value: unknown,
  label: string,
  fallback: number,
  max: number,
): number {
  if (value === undefined) return fallback

  if (typeof value !== 'string' || !/^[1-9]\d{0,5}$/.test(value)) {
    badRequest(`${label} doit être un entier positif.`)
  }

  const number = Number(value)

  if (number > max) {
    badRequest(`${label} ne peut pas dépasser ${max}.`)
  }

  return number
}

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  const canReadAll = hasPermission(context, PERMISSIONS.CRA_READ_ALL)
  const canReadOwn = hasPermission(context, PERMISSIONS.CRA_READ_OWN)
    && Boolean(context.intervenorId)

  if (!canReadAll && !canReadOwn) {
    httpError(403, 'Consultation des CRA interdite.', 'CRA_FORBIDDEN')
  }

  const query = getQuery(event)
  const allowedFields = new Set(['page', 'pageSize'])

  if (Object.keys(query).some(key => !allowedFields.has(key))) {
    badRequest('La demande contient un paramètre non autorisé.')
  }

  const page = queryInteger(query.page, 'La page', 1, 10000)
  const pageSize = queryInteger(
    query.pageSize,
    'La taille de page',
    20,
    50,
  )

  const canReadConfidential = hasPermission(
    context,
    PERMISSIONS.PROJECT_CONFIDENTIAL_READ,
  )

  const where: Prisma.CraReportWhereInput = {
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
  }

  const [total, reports] = await prisma.$transaction(
    [
      prisma.craReport.count({ where }),
      prisma.craReport.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [
          { year: 'desc' },
          { month: 'desc' },
          { createdAt: 'desc' },
          { id: 'asc' },
        ],
        select: {
          id: true,
          year: true,
          month: true,
          status: true,
          revision: true,
          submittedAt: true,
          validatedAt: true,
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
            select: {
              dayType: true,
              durationMinutes: true,
            },
          },
        },
      }),
    ],
    { isolationLevel: 'RepeatableRead' },
  )

  return success({
    items: reports.map(({ assignment, days, ...report }) => ({
      ...report,
      project: assignment.project,
      intervenor: assignment.intervenor,
      ...summarizeCraDays(days),
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNextPage: page * pageSize < total,
    },
  })
})