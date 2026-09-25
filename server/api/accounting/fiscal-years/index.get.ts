import { requirePermission } from '../../../utils/auth'
import { success } from '../../../utils/api'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(
    event,
    PERMISSIONS.ACCOUNTING_READ,
  )

  const fiscalYears
    = await prisma.accountingFiscalYear.findMany({
      where: {
        associationId: context.associationId,
      },

      orderBy: {
        startDate: 'desc',
      },

      include: {
        periods: {
          orderBy: {
            number: 'asc',
          },
        },
      },
    })

  return success(fiscalYears)
})
