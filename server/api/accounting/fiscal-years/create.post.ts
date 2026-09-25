import { readBody } from 'h3'

import { writeAuditLogStrict } from '../../../utils/audit'
import {
  buildAccountingPeriods,
  defaultFiscalYearLabel,
  fiscalYearEndDate,
  requireFiscalYearStartDate,
} from '../../../utils/accounting-fiscal-years'
import { requirePermission } from '../../../utils/auth'
import {
  httpError,
  jsonSafe,
  prismaErrorCode,
  success,
} from '../../../utils/api'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import {
  optionalString,
  safeObject,
} from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(
    event,
    PERMISSIONS.ACCOUNTING_PERIOD_MANAGE,
  )

  const body = safeObject(
    await readBody(event),
  )

  const startDate
    = requireFiscalYearStartDate(
      body.startDate,
    )

  const endDate
    = fiscalYearEndDate(startDate)

  const label
    = optionalString(
      body.label,
      'Libellé de l’exercice',
      { max: 80 },
    )
    || defaultFiscalYearLabel(startDate)

  const periodSeeds
    = buildAccountingPeriods(startDate)

  try {
    const fiscalYear
      = await prisma.$transaction(
        async (tx) => {
          /*
           * On refuse tout chevauchement :
           *
           * existant.start <= nouveau.end
           * ET
           * existant.end >= nouveau.start
           */
          const overlapping
            = await tx.accountingFiscalYear.findFirst({
              where: {
                associationId:
                  context.associationId,

                startDate: {
                  lte: endDate,
                },

                endDate: {
                  gte: startDate,
                },
              },

              select: {
                id: true,
                label: true,
                startDate: true,
                endDate: true,
              },
            })

          if (overlapping) {
            httpError(
              409,
              `L’exercice « ${overlapping.label} » `
              + 'chevauche la période demandée.',
              'ACCOUNTING_FISCAL_YEAR_OVERLAP',
            )
          }

          const created
            = await tx.accountingFiscalYear.create({
              data: {
                associationId:
                  context.associationId,

                label,
                startDate,
                endDate,
                status: 'OPEN',

                periods: {
                  create:
                    periodSeeds.map(
                      period => ({
                        associationId:
                          context.associationId,

                        number:
                          period.number,

                        label:
                          period.label,

                        startDate:
                          period.startDate,

                        endDate:
                          period.endDate,

                        status: 'OPEN',
                      }),
                    ),
                },
              },

              include: {
                periods: {
                  orderBy: {
                    number: 'asc',
                  },
                },
              },
            })

          /*
           * Pour une opération structurelle comptable,
           * l'audit est strict et appartient à la même
           * transaction que la création.
           */
          await writeAuditLogStrict(
            event,
            context,
            {
              action:
                'ACCOUNTING_FISCAL_YEAR_CREATED',

              entityType:
                'AccountingFiscalYear',

              entityId:
                created.id,

              metadata: {
                label:
                  created.label,

                startDate:
                  created.startDate,

                endDate:
                  created.endDate,

                periodCount:
                  created.periods.length,
              },
            },
            tx,
          )

          return created
        },
        {
          isolationLevel:
            'Serializable',
        },
      )

    return success(
      jsonSafe(fiscalYear),
    )
  }
  catch (error) {
    /*
     * Une création concurrente peut provoquer
     * une sérialisation PostgreSQL à recommencer.
     * On retourne un conflit explicite à l'UI.
     */
    if (
      prismaErrorCode(error) === 'P2034'
      || prismaErrorCode(error) === 'P2002'
    ) {
      httpError(
        409,
        'Un exercice comptable concurrent vient d’être créé ou modifié. Actualisez puis recommencez.',
        'ACCOUNTING_FISCAL_YEAR_CONFLICT',
      )
    }

    throw error
  }
})
