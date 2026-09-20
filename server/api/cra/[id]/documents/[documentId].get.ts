import { createHash } from 'node:crypto'
import {
  getQuery,
  getRouterParam,
  setResponseHeader,
} from 'h3'
import {
  hasPermission,
  requireAuth,
} from '../../../../utils/auth'
import {
  httpError,
  requireRouterId,
} from '../../../../utils/api'
import { PERMISSIONS } from '../../../../utils/constants'
import { readStoredFile } from '../../../../utils/files'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  if (!hasPermission(context, PERMISSIONS.CRA_READ_ALL)) {
    httpError(
      403,
      'Consultation des documents CRA interdite.',
      'CRA_DOCUMENT_FORBIDDEN',
    )
  }

  const reportId = requireRouterId(
    getRouterParam(event, 'id'),
    'CRA',
  )

  const documentId = requireRouterId(
    getRouterParam(event, 'documentId'),
    'document CRA',
  )

  const canReadConfidential = hasPermission(
    context,
    PERMISSIONS.PROJECT_CONFIDENTIAL_READ,
  )

  const document = await prisma.craDocument.findFirst({
    where: {
      id: documentId,
      reportId,
      type: 'IFICS_TO_SIGN',

      report: {
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
        },
      },
    },

    select: {
      id: true,
      reference: true,
      originalName: true,
      filePath: true,
      mimeType: true,
      fileSize: true,
      sha256: true,
    },
  })

  if (!document) {
    httpError(
      404,
      'Document CRA introuvable ou inaccessible.',
      'CRA_DOCUMENT_NOT_FOUND',
    )
  }

  if (document.mimeType !== 'application/pdf') {
    httpError(
      409,
      'Le document CRA demandé n’est pas un PDF.',
      'CRA_DOCUMENT_INVALID_TYPE',
    )
  }

  const buffer = await readStoredFile(document.filePath)

  if (BigInt(buffer.length) !== document.fileSize) {
    httpError(
      409,
      'L’intégrité du document CRA ne peut pas être confirmée.',
      'CRA_DOCUMENT_SIZE_MISMATCH',
    )
  }

  if (document.sha256) {
    const sha256 = createHash('sha256')
      .update(buffer)
      .digest('hex')

    if (sha256 !== document.sha256) {
      httpError(
        409,
        'L’intégrité du document CRA ne peut pas être confirmée.',
        'CRA_DOCUMENT_HASH_MISMATCH',
      )
    }
  }

  const query = getQuery(event)
  const download = query.download === '1'

  const filename = document.originalName
    .replace(/[\r\n"\\]/g, '_')

  setResponseHeader(
    event,
    'Content-Type',
    'application/pdf',
  )

  setResponseHeader(
    event,
    'Content-Length',
    buffer.length,
  )

  setResponseHeader(
    event,
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
  )

  setResponseHeader(
    event,
    'Cache-Control',
    'private, no-store, max-age=0',
  )

  setResponseHeader(
    event,
    'X-Content-Type-Options',
    'nosniff',
  )

  return buffer
})
