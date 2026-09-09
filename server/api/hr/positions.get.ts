import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.HR_READ)
  const [positions, departments] = await Promise.all([
    prisma.jobPosition.findMany({
      where: { associationId: context.associationId },
      orderBy: [{ active: 'desc' }, { title: 'asc' }],
    }),
    prisma.department.findMany({
      where: { associationId: context.associationId },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const departmentById = new Map(departments.map(department => [department.id, department]))
  return success({
    positions: positions.map(position => ({
      ...position,
      department: position.departmentId ? departmentById.get(position.departmentId) ?? null : null,
    })),
    departments,
  })
})