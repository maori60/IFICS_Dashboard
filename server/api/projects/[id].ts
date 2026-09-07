import { getRouterParam } from 'h3'
import { assertProjectAccess, requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, jsonSafe, requireRouterId, success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PROJECT_READ)
  const projectId = requireRouterId(getRouterParam(event, 'id'), 'Projet')
  await assertProjectAccess(context, projectId)

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      associationId: context.associationId,
      archivedAt: null,
    },
    select: {
      id: true,
      reference: true,
      title: true,
      description: true,
      status: true,
      startDate: true,
      endDate: true,
      plannedBudget: true,
      actualBudget: true,
      totalIntervenorCost: true,
      materialCost: true,
      printingCost: true,
      otherCost: true,
      estimatedNetMargin: true,
      actualNetMargin: true,
      totalSessions: true,
      sessionUnitPrice: true,
      internalComments: true,
      createdAt: true,
      updatedAt: true,
      projectClients: {
        select: {
          id: true,
          isMainClient: true,
          client: {
            select: { id: true, name: true, type: true, email: true },
          },
        },
      },
      projectIntervenors: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          assignmentStatus: true,
          invitedAt: true,
          respondedAt: true,
          responseComment: true,
          intervenor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              specialty: true,
              status: true,
            },
          },
        },
      },
      documents: {
        where: { archivedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          visibility: true,
          title: true,
          originalName: true,
          fileSize: true,
          version: true,
          createdAt: true,
        },
      },
      reports: {
        orderBy: { sessionDate: 'desc' },
        select: {
          id: true,
          title: true,
          sessionDate: true,
          studentsCount: true,
          status: true,
          currentVersion: true,
          submittedAt: true,
          validatedAt: true,
        },
      },
      billingDocuments: {
        orderBy: { issueDate: 'desc' },
        select: {
          id: true,
          kind: true,
          number: true,
          status: true,
          issueDate: true,
          dueDate: true,
          total: true,
          currency: true,
        },
      },
    },
  })

  if (!project) httpError(404, 'Projet introuvable.', 'PROJECT_NOT_FOUND')

  if (context.roleCode === 'CLIENT' || context.roleCode === 'INTERVENOR') {
    project.internalComments = null
    project.actualBudget = null
    project.totalIntervenorCost = null
    project.materialCost = null
    project.printingCost = null
    project.otherCost = null
    project.estimatedNetMargin = null
    project.actualNetMargin = null
  }

  return success(jsonSafe(project))
})
