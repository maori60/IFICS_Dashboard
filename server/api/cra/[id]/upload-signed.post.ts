import {
  getRouterParam,
  readMultipartFormData,
} from 'h3'
import {
  ClamAvError,
  scanBufferWithClamAv,
} from '../../../utils/antivirus'
import {
  httpError,
  prismaErrorCode,
  requireRouterId,
  success,
} from '../../../utils/api'
import { writeAuditLog } from '../../../utils/audit'
import { requireAuth } from '../../../utils/auth'
import {
  requireCraAssignmentForCreation,
  requireCraWriter,
} from '../../../utils/cra'
import {
  discardQuarantinedCraDocument,
  promoteCraSignedDocument,
  quarantineCraSignedDocument,
  removeStoredFile,
} from '../../../utils/files'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)
  const intervenorId = requireCraWriter(context)

  const reportId = requireRouterId(
    getRouterParam(event, 'id'),
    'CRA',
  )

  const report = await prisma.craReport.findFirst({
    where: {
      id: reportId,
      associationId: context.associationId,
      intervenorId,
    },

    select: {
      id: true,
      projectId: true,
      intervenorId: true,
      year: true,
      month: true,
      status: true,
      revision: true,
    },
  })

  if (!report) {
    httpError(
      404,
      'CRA introuvable ou inaccessible.',
      'CRA_NOT_FOUND',
    )
  }

  await requireCraAssignmentForCreation(
    context,
    report.projectId,
    report.intervenorId,
  )

  if (report.status !== 'REVIEWED') {
    httpError(
      409,
      'Le CRA doit avoir été vérifié par IFICS avant le dépôt du document signé.',
      'CRA_SIGNED_UPLOAD_INVALID_STATUS',
    )
  }

  const sourceDocument
    = await prisma.craDocument.findFirst({
      where: {
        reportId: report.id,
        type: 'IFICS_TO_SIGN',
        status: 'SENT_TO_INTERVENOR',
        archivedAt: null,
        reportRevision: report.revision,
      },

      orderBy: {
        version: 'desc',
      },

      select: {
        id: true,
        version: true,
        reference: true,
        reportRevision: true,
      },
    })

  if (!sourceDocument) {
    httpError(
      409,
      'Aucun CRA officiel envoyé à signer n’est disponible.',
      'CRA_SIGNED_SOURCE_REQUIRED',
    )
  }

  const pendingSignedDocument
    = await prisma.craDocument.findFirst({
      where: {
        reportId: report.id,
        type: 'INTERVENOR_SIGNED',
        archivedAt: null,

        status: {
          in: [
            'RECEIVED',
            'APPROVED',
          ],
        },
      },

      orderBy: {
        version: 'desc',
      },

      select: {
        id: true,
        status: true,
        version: true,
      },
    })

  if (pendingSignedDocument) {
    httpError(
      409,
      pendingSignedDocument.status === 'APPROVED'
        ? 'Un CRA signé a déjà été approuvé pour cette période.'
        : 'Un CRA signé est déjà en attente de vérification par IFICS.',
      pendingSignedDocument.status === 'APPROVED'
        ? 'CRA_SIGNED_ALREADY_APPROVED'
        : 'CRA_SIGNED_ALREADY_RECEIVED',
    )
  }

  const parts = await readMultipartFormData(event)

  if (!parts) {
    httpError(
      400,
      'Formulaire de dépôt invalide.',
      'CRA_SIGNED_MULTIPART_REQUIRED',
    )
  }

  const files = parts.filter(
    part => part.name === 'file',
  )

  if (
    files.length !== 1
    || !files[0]?.filename
    || !files[0].data?.length
  ) {
    httpError(
      400,
      'Un seul fichier CRA signé est requis.',
      'CRA_SIGNED_FILE_REQUIRED',
    )
  }

  const unexpectedParts = parts.filter(
    part => part.name !== 'file',
  )

  if (unexpectedParts.length > 0) {
    httpError(
      400,
      'Le formulaire contient un champ non autorisé.',
      'CRA_SIGNED_UNEXPECTED_FIELD',
    )
  }

  const file = files[0]

  const quarantined
    = await quarantineCraSignedDocument(
      report.id,
      file.filename!,
      file.data,
    )

  let scanResult:
    Awaited<ReturnType<typeof scanBufferWithClamAv>>

  try {
    scanResult = await scanBufferWithClamAv(
      file.data,
    )
  }
  catch (error) {
    await discardQuarantinedCraDocument(
      quarantined,
    )

    await writeAuditLog(event, context, {
      action: 'CRA_SIGNED_DOCUMENT_SCAN_FAILED',
      outcome: 'FAILURE',
      entityType: 'CraReport',
      entityId: report.id,

      metadata: {
        sourceDocumentId: sourceDocument.id,
        sourceReference: sourceDocument.reference,
        originalName: quarantined.originalName,
        sha256: quarantined.sha256,
        errorCode:
          error instanceof ClamAvError
            ? error.code
            : 'UNKNOWN',
      },
    })

    httpError(
      503,
      'Le contrôle antivirus est temporairement indisponible. Le fichier n’a pas été conservé.',
      error instanceof ClamAvError
        ? error.code
        : 'CLAMAV_SCAN_ERROR',
    )
  }

  if (scanResult.status === 'INFECTED') {
    await discardQuarantinedCraDocument(
      quarantined,
    )

    await writeAuditLog(event, context, {
      action: 'CRA_SIGNED_DOCUMENT_INFECTED',
      outcome: 'FAILURE',
      entityType: 'CraReport',
      entityId: report.id,

      metadata: {
        sourceDocumentId: sourceDocument.id,
        sourceReference: sourceDocument.reference,
        originalName: quarantined.originalName,
        sha256: quarantined.sha256,
        antivirusSignature:
          scanResult.signature,
      },
    })

    httpError(
      422,
      'Le fichier a été refusé par le contrôle antivirus et n’a pas été conservé.',
      'CRA_SIGNED_FILE_INFECTED',
    )
  }

  const previous
    = await prisma.craDocument.findFirst({
      where: {
        reportId: report.id,
        type: 'INTERVENOR_SIGNED',
      },

      orderBy: {
        version: 'desc',
      },

      select: {
        version: true,
      },
    })

  const version = (previous?.version ?? 0) + 1

  const suffix = `-SIGNED-V${version}`

  const reference = [
    sourceDocument.reference.slice(
      0,
      Math.max(
        1,
        80 - suffix.length,
      ),
    ),
    suffix,
  ].join('')

  const stored
    = await promoteCraSignedDocument(
      quarantined,
    )

  const receivedAt = new Date()

  try {
    const document
      = await prisma.craDocument.create({
        data: {
          reportId: report.id,
          type: 'INTERVENOR_SIGNED',
          status: 'RECEIVED',
          version,
          reportRevision:
            sourceDocument.reportRevision,

          sourceDocumentId:
            sourceDocument.id,

          reference,

          originalName:
            stored.originalName,

          storedName:
            stored.storedName,

          filePath:
            stored.filePath,

          mimeType:
            stored.mimeType,

          fileSize:
            stored.fileSize,

          sha256:
            stored.sha256,

          uploadedByUserId:
            context.userId,

          receivedAt,

          antivirusStatus:
            'CLEAN',

          antivirusCheckedAt:
            receivedAt,

          antivirusResult:
            scanResult.rawResult.slice(
              0,
              255,
            ),
        },

        select: {
          id: true,
          type: true,
          status: true,
          version: true,
          reference: true,
          sourceDocumentId: true,
          originalName: true,
          mimeType: true,
          fileSize: true,
          sha256: true,
          antivirusStatus: true,
          antivirusCheckedAt: true,
          receivedAt: true,
          createdAt: true,
        },
      })

    await writeAuditLog(event, context, {
      action: 'CRA_SIGNED_DOCUMENT_RECEIVED',
      entityType: 'CraDocument',
      entityId: document.id,

      metadata: {
        reportId: report.id,

        sourceDocumentId:
          sourceDocument.id,

        sourceReference:
          sourceDocument.reference,

        sourceVersion:
          sourceDocument.version,

        documentReference:
          document.reference,

        documentVersion:
          document.version,

        mimeType:
          document.mimeType,

        fileSize:
          document.fileSize.toString(),

        sha256:
          document.sha256,

        antivirusStatus:
          document.antivirusStatus,
      },
    })

    return success({
      ...document,
      fileSize:
        document.fileSize.toString(),
    })
  }
  catch (error) {
    try {
      await removeStoredFile(
        stored.filePath,
      )
    }
    catch (cleanupError) {
      console.error(JSON.stringify({
        level: 'error',
        event:
          'cra_signed_document_cleanup_failed',
        reportId: report.id,
        filePath: stored.filePath,
        error:
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError),
      }))
    }

    if (prismaErrorCode(error) === 'P2002') {
      httpError(
        409,
        'Un autre dépôt du CRA signé a été enregistré simultanément. Actualisez la page.',
        'CRA_SIGNED_UPLOAD_CONFLICT',
      )
    }

    throw error
  }
})
