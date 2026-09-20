import { getRouterParam, readBody } from 'h3'
import type { Prisma } from '../../../../generated/prisma/client'
import { hasPermission, requireAuth } from '../../../utils/auth'
import {
  httpError,
  requireRouterId,
  success,
} from '../../../utils/api'
import { writeAuditLog } from '../../../utils/audit'
import { PERMISSIONS } from '../../../utils/constants'
import { summarizeCraDays } from '../../../utils/cra-summary'
import {
  readStoredFile,
  removeStoredFile,
  storePdf,
} from '../../../utils/files'
import { generateCraPdf } from '../../../utils/cra-pdf'
import { prisma } from '../../../utils/prisma'
import {
  badRequest,
  safeObject,
} from '../../../utils/validation'

function shortReportReference(reportId: string): string {
  const compact = reportId
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()

  return compact.slice(-8).padStart(8, '0')
}

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  if (
    !hasPermission(context, PERMISSIONS.CRA_READ_ALL)
    || !hasPermission(context, PERMISSIONS.CRA_MANAGE)
  ) {
    httpError(
      403,
      'Vous ne disposez pas des droits de génération des CRA officiels.',
      'CRA_GENERATE_FORBIDDEN',
    )
  }

  const reportId = requireRouterId(
    getRouterParam(event, 'id'),
    'CRA',
  )

  const body = safeObject(await readBody(event))

  const allowedFields = new Set([
    'confirmed',
    'revision',
  ])

  if (
    Object.keys(body)
      .some(key => !allowedFields.has(key))
  ) {
    badRequest(
      'La demande contient un champ non autorisé.',
    )
  }

  if (body.confirmed !== true) {
    badRequest(
      'Vous devez confirmer la génération du CRA officiel.',
    )
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

  const canReadConfidential = hasPermission(
    context,
    PERMISSIONS.PROJECT_CONFIDENTIAL_READ,
  )

  const reportScope: Prisma.CraReportWhereInput = {
    id: reportId,
    associationId: context.associationId,
    assignment: {
      project: {
        associationId: context.associationId,
        ...(!canReadConfidential
          ? {
              classification: {
                notIn: [
                  'CONFIDENTIAL',
                  'RESTRICTED',
                ],
              },
            }
          : {}),
      },
      intervenor: {
        associationId: context.associationId,
      },
    },
  }

  const report = await prisma.craReport.findFirst({
    where: reportScope,
    select: {
      id: true,
      year: true,
      month: true,
      status: true,
      revision: true,

      assignment: {
        select: {
          project: {
            select: {
              id: true,
              title: true,
              reference: true,

              projectClients: {
                orderBy: [
                  { isMainClient: 'desc' },
                  { createdAt: 'asc' },
                ],
                take: 1,
                select: {
                  client: {
                    select: {
                      name: true,
                      serviceName: true,
                    },
                  },
                },
              },
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
        orderBy: {
          date: 'asc',
        },
        select: {
          date: true,
          dayType: true,
          durationMinutes: true,
          comment: true,
          hasIncident: true,
          incident: true,
        },
      },
    },
  })

  if (!report) {
    httpError(
      404,
      'CRA introuvable ou inaccessible.',
      'CRA_NOT_FOUND',
    )
  }

  if (report.status !== 'REVIEWED') {
    httpError(
      409,
      'Le CRA doit être vérifié par IFICS avant de générer le document officiel.',
      'CRA_NOT_REVIEWED',
    )
  }

  if (report.revision !== revision) {
    httpError(
      409,
      'Ce CRA a été modifié. Rechargez-le avant de générer le document officiel.',
      'CRA_GENERATION_CONFLICT',
    )
  }

  const [association, finance] = await Promise.all([
    prisma.association.findFirst({
      where: {
        id: context.associationId,
      },
      select: {
        id: true,
        name: true,
        legalName: true,
        billingName: true,
        pdfFooter: true,
      },
    }),

    prisma.associationFinanceSettings.findUnique({
      where: {
        associationId: context.associationId,
      },
      select: {
        logoFilePath: true,

        craSignatureFilePath: true,
        craSignatureMimeType: true,
      },
    }),
  ])

  if (!association) {
    httpError(
      404,
      'Association introuvable.',
      'ASSOCIATION_NOT_FOUND',
    )
  }

  if (
    !finance?.craSignatureFilePath
    || !finance.craSignatureMimeType
  ) {
    httpError(
      409,
      'Aucune signature officielle CRA n’est configurée.',
      'CRA_SIGNATURE_REQUIRED',
    )
  }

  const allowedSignatureMimeTypes = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
  ])

  if (
    !allowedSignatureMimeTypes.has(
      finance.craSignatureMimeType,
    )
  ) {
    httpError(
      409,
      'Le format de la signature officielle configurée est invalide.',
      'CRA_SIGNATURE_INVALID',
    )
  }

  const signatureBytes = await readStoredFile(
    finance.craSignatureFilePath,
  )

  let logo: {
    bytes: Uint8Array
    mimeType: 'image/png' | 'image/jpeg'
  } | null = null

  if (finance.logoFilePath) {
    try {
      const bytes = await readStoredFile(
        finance.logoFilePath,
      )

      logo = {
        bytes,
        mimeType: finance.logoFilePath
          .toLowerCase()
          .endsWith('.png')
          ? 'image/png'
          : 'image/jpeg',
      }
    }
    catch {
      logo = null
    }
  }

  const previousDocument
    = await prisma.craDocument.findFirst({
      where: {
        reportId: report.id,
        type: 'IFICS_TO_SIGN',
      },
      orderBy: {
        version: 'desc',
      },
      select: {
        version: true,
      },
    })

  const version = (previousDocument?.version ?? 0) + 1

  const reference = [
    'CRA',
    report.year,
    String(report.month).padStart(2, '0'),
    shortReportReference(report.id),
    `V${version}`,
  ].join('-')

  const summary = summarizeCraDays(
    report.days.map(day => ({
      dayType: day.dayType,
      durationMinutes: day.durationMinutes,
    })),
  )

  const client
    = report.assignment.project
      .projectClients[0]?.client
      ?? null

  const generatedAt = new Date()

  const pdfBytes = await generateCraPdf({
    reference,
    generatedAt,

    year: report.year,
    month: report.month,

    association: {
      name: association.name,
      legalName: association.legalName,
      billingName: association.billingName,
      pdfFooter: association.pdfFooter,
    },

    logo,

    signature: {
      bytes: signatureBytes,
      mimeType: finance.craSignatureMimeType as
        | 'application/pdf'
        | 'image/png'
        | 'image/jpeg',
    },

    intervenor: {
      firstName:
        report.assignment.intervenor.firstName,
      lastName:
        report.assignment.intervenor.lastName,
    },

    project: {
      title: report.assignment.project.title,
      reference:
        report.assignment.project.reference,
    },

    client,

    days: report.days.map(day => ({
      date: day.date,
      dayType: day.dayType,
      durationMinutes: day.durationMinutes,
      comment: day.comment,
      hasIncident: day.hasIncident,
      incident: day.incident,
    })),

    summary,
  })

  const stored = await storePdf(
    'cra',
    report.id,
    `${reference}.pdf`,
    Buffer.from(pdfBytes),
  )

  let document

  try {
    document = await prisma.$transaction(
      async (tx) => {
        const current
          = await tx.craReport.findFirst({
            where: {
              ...reportScope,
              status: 'REVIEWED',
              revision,
            },
            select: {
              id: true,
            },
          })

        if (!current) {
          httpError(
            409,
            'Le CRA a changé pendant la génération. Rechargez-le avant de recommencer.',
            'CRA_GENERATION_CONFLICT',
          )
        }

        await tx.craDocument.updateMany({
          where: {
            reportId: report.id,
            type: 'IFICS_TO_SIGN',
            status: {
              in: [
                'GENERATED',
                'SENT_TO_INTERVENOR',
              ],
            },
            archivedAt: null,
          },
          data: {
            status: 'SUPERSEDED',
            archivedAt: generatedAt,
          },
        })

        return tx.craDocument.create({
          data: {
            reportId: report.id,
            type: 'IFICS_TO_SIGN',
            status: 'GENERATED',

            version,
            reportRevision: revision,

            reference,

            originalName: `${reference}.pdf`,
            storedName: stored.storedName,
            filePath: stored.filePath,
            mimeType: stored.mimeType,
            fileSize: stored.fileSize,
            sha256: stored.sha256,

            generatedByUserId: context.userId,

            antivirusStatus: 'NOT_APPLICABLE',
            antivirusCheckedAt: generatedAt,
            antivirusResult:
              'Document généré en interne par IFICS.',
          },

          select: {
            id: true,
            reportId: true,
            type: true,
            status: true,
            version: true,
            reportRevision: true,
            reference: true,
            originalName: true,
            mimeType: true,
            fileSize: true,
            sha256: true,
            antivirusStatus: true,
            createdAt: true,
          },
        })
      },
    )
  }
  catch (error) {
    try {
      await removeStoredFile(stored.filePath)
    }
    catch (cleanupError) {
      console.error(
        'CRA_GENERATED_FILE_CLEANUP_FAILED',
        {
          reportId: report.id,
          filePath: stored.filePath,
          cleanupError,
        },
      )
    }

    if (
      typeof error === 'object'
      && error !== null
      && 'code' in error
      && error.code === 'P2002'
    ) {
      httpError(
        409,
        'Une autre génération du CRA vient d’être enregistrée. Rechargez le CRA avant de recommencer.',
        'CRA_GENERATION_CONFLICT',
      )
    }

    throw error
  }

  await writeAuditLog(event, context, {
    action: 'CRA_OFFICIAL_DOCUMENT_GENERATED',
    entityType: 'CraDocument',
    entityId: document.id,
    metadata: {
      reportId: report.id,
      reportRevision: revision,
      type: document.type,
      status: document.status,
      version: document.version,
      reference: document.reference,
      fileSize: document.fileSize.toString(),
      sha256: document.sha256,
      antivirusStatus:
        document.antivirusStatus,
    },
  })

  return success({
    ...document,
    fileSize: document.fileSize.toString(),
  })
})
