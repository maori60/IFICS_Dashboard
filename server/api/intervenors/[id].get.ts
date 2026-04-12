import { createError, getRouterParam } from 'h3'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const intervenorId = getRouterParam(event, 'id')

  if (!intervenorId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Intervenor ID manquant.',
    })
  }

  const intervenor = await prisma.intervenor.findFirst({
    where: {
      id: intervenorId,
      archivedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      specialty: true,
      status: true,
      siret: true,
      ribIban: true,
      ribBic: true,
      addressLine1: true,
      addressLine2: true,
      postalCode: true,
      city: true,
      country: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      projectLinks: {
        select: {
          id: true,
          assignmentStatus: true,
          project: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      documents: {
        select: {
          id: true,
          type: true,
          status: true,
          title: true,
          originalName: true,
          createdAt: true,
          reviewedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      accountingDocuments: {
        select: {
          id: true,
          type: true,
          status: true,
          title: true,
          periodMonth: true,
          periodYear: true,
          originalName: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      reports: {
        select: {
          id: true,
          sessionDate: true,
          studentsCount: true,
          status: true,
          createdAt: true,
        },
        orderBy: {
          sessionDate: 'desc',
        },
      },
    },
  })

  if (!intervenor) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Intervenant introuvable.',
    })
  }

  return {
    ok: true,
    data: intervenor,
  }
})