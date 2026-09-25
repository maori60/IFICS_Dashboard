import { requirePermission } from '../../../utils/auth'
import {
  businessDateAsUtc,
  DEFAULT_BUSINESS_TIMEZONE,
} from '../../../utils/business-date'
import { success } from '../../../utils/api'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(
    event,
    PERMISSIONS.ACCOUNTING_READ,
  )

  const association
    = await prisma.association.findUnique({
      where: {
        id: context.associationId,
      },

      select: {
        timezone: true,
      },
    })

  const timeZone
    = association?.timezone
      || DEFAULT_BUSINESS_TIMEZONE

  const businessDate
    = businessDateAsUtc(
      new Date(),
      timeZone,
    )

  const period
    = await prisma.accountingPeriod.findFirst({
      where: {
        associationId:
          context.associationId,

        startDate: {
          lte: businessDate,
        },

        endDate: {
          gte: businessDate,
        },
      },

      include: {
        fiscalYear: true,
      },

      orderBy: {
        startDate: 'desc',
      },
    })

  return success(period)
})
