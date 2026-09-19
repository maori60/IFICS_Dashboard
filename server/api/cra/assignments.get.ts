import { getQuery } from 'h3'
import type { Prisma } from '../../../generated/prisma/client'
import { hasPermission, requireAuth } from '../../utils/auth'
import { success } from '../../utils/api'
import { PERMISSIONS } from '../../utils/constants'
import { requireCraWriter } from '../../utils/cra'
import { prisma } from '../../utils/prisma'
import { badRequest } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)
  const intervenorId = requireCraWriter(context)

  const query = getQuery(event)
  const allowedFields = new Set(['search', 'page'])

  if (Object.keys(query).some(key => !allowedFields.has(key))) {
    badRequest('La demande contient un paramètre non autorisé.')
  }

  let search = ''

  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.length > 100) {
      badRequest('La recherche doit contenir au maximum 100 caractères.')
    }

    search = query.search.trim()
  }

  let page = 1

  if (query.page !== undefined) {
    if (
      typeof query.page !== 'string'
      || !/^[1-9]\d{0,4}$/.test(query.page)
      || Number(query.page) > 10000
    ) {
      badRequest('La page doit être un entier entre 1 et 10000.')
    }

    page = Number(query.page)
  }

  const pageSize = 20
  const canReadConfidential = hasPermission(
    context,
    PERMISSIONS.PROJECT_CONFIDENTIAL_READ,
  )

  const where: Prisma.ProjectIntervenorWhereInput = {
    intervenorId,
    assignmentStatus: 'ACCEPTED',
    project: {
      associationId: context.associationId,
      archivedAt: null,
      status: { not: 'CANCELLED' },
      ...(!canReadConfidential
        ? { classification: { notIn: ['CONFIDENTIAL', 'RESTRICTED'] } }
        : {}),
    },
    intervenor: {
      associationId: context.associationId,
      archivedAt: null,
      status: 'ACTIVE',
    },
    ...(search
      ? {
          OR: [
            {
              project: {
                title: { contains: search, mode: 'insensitive' },
              },
            },
            {
              project: {
                reference: { contains: search, mode: 'insensitive' },
              },
            },
            {
              intervenor: {
                firstName: { contains: search, mode: 'insensitive' },
              },
            },
            {
              intervenor: {
                lastName: { contains: search, mode: 'insensitive' },
              },
            },
          ],
        }
      : {}),
  }

  const [total, items] = await prisma.$transaction(
    [
      prisma.projectIntervenor.count({ where }),
      prisma.projectIntervenor.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [
          { project: { title: 'asc' } },
          { intervenor: { lastName: 'asc' } },
          { intervenor: { firstName: 'asc' } },
          { id: 'asc' },
        ],
        select: {
          id: true,
          projectId: true,
          intervenorId: true,
          project: {
            select: {
              title: true,
              reference: true,
            },
          },
          intervenor: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ],
    { isolationLevel: 'RepeatableRead' },
  )

  return success({
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNextPage: page * pageSize < total,
    },
  })
})