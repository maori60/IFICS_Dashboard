import type { H3Event } from 'h3'
import type { AuthContext } from './auth'
import { prisma } from './prisma'
import { httpError, prismaErrorCode } from './api'
import {
  isReportArchiveRetryableError,
  retryReportArchiveTransaction,
} from './report-archive-retry'
import { writeAuditLogStrict } from './audit'
import { findReportArchiveSource } from './report-archive-reader'
import { reportArchiveStateFromSource } from './report-archive-state'
import { reportArchiveStateMatches } from './report-archive-guard'
import type { ReportArchiveGuardState } from './report-archive-guard'
import type { OfficialReportPdfSnapshot } from './report-archive-pdf'
import type { StoredPdf } from './files'

type ArchiveTransactionInput = {
  event: H3Event
  context: AuthContext
  snapshot: OfficialReportPdfSnapshot
  expectedState: ReportArchiveGuardState
  stored: StoredPdf
}

export async function commitOfficialReportArchive(
  input: ArchiveTransactionInput,
) {
  const {
    event,
    context,
    snapshot,
    expectedState,
    stored,
  } = input

  try {
    return await retryReportArchiveTransaction(() =>
      prisma.$transaction(async (tx) => {
    const current = await findReportArchiveSource(
      snapshot.reportId,
      context.associationId,
      tx,
    )

    if (!current) {
      httpError(
        409,
        'Le bilan a changé pendant la validation.',
        'REPORT_ARCHIVE_CONFLICT',
      )
    }

    const currentState = reportArchiveStateFromSource(current)

    if (!reportArchiveStateMatches(expectedState, currentState)) {
      httpError(
        409,
        'Les informations du bilan ont changé. Actualisez la page.',
        'REPORT_ARCHIVE_CONFLICT',
      )
    }

    const transition = await tx.projectReport.updateMany({
      where: {
        id: snapshot.reportId,
        status: 'SUBMITTED',
        currentVersion: snapshot.version,
        updatedAt: expectedState.updatedAt,
        project: {
          associationId: context.associationId,
          archivedAt: null,
        },
      },
      data: {
        status: 'VALIDATED',
        refusalReason: null,
        reviewedByUserId: context.userId,
        reviewedAt: snapshot.validatedAt,
        validatedAt: snapshot.validatedAt,
        pdfPath: stored.filePath,
      },
    })

    if (transition.count !== 1) {
      httpError(
        409,
        'Le bilan a déjà été modifié ou validé.',
        'REPORT_ARCHIVE_CONFLICT',
      )
    }

    const archive = await tx.projectReportArchive.create({
      data: {
        reportId: snapshot.reportId,
        reportVersionId: snapshot.reportVersionId,
        version: snapshot.version,
        reference: snapshot.reference,
        associationName: snapshot.associationName,
        projectTitle: snapshot.projectTitle,
        reportTitle: snapshot.reportTitle,
        intervenorName: snapshot.intervenorName,
        sessionDate: snapshot.sessionDate,
        startTime: snapshot.startTime,
        endTime: snapshot.endTime,
        studentsCount: snapshot.studentsCount,
        content: snapshot.content,
        validatedByUserId: snapshot.validatedByUserId,
        validatedAt: snapshot.validatedAt,
        originalName: stored.originalName,
        storedName: stored.storedName,
        filePath: stored.filePath,
        mimeType: stored.mimeType,
        fileSize: stored.fileSize,
        sha256: stored.sha256,
      },
    })

    await writeAuditLogStrict(
      event,
      context,
      {
        action: 'REPORT_OFFICIAL_ARCHIVED',
        entityType: 'ProjectReportArchive',
        entityId: archive.id,
        metadata: {
          reportId: snapshot.reportId,
          version: snapshot.version,
          reference: snapshot.reference,
          sha256: stored.sha256,
        },
      },
      tx,
    )

    await writeAuditLogStrict(
      event,
      context,
      {
        action: 'REPORT_REVIEWED',
        entityType: 'ProjectReport',
        entityId: snapshot.reportId,
        metadata: {
          status: 'VALIDATED',
          version: snapshot.version,
          reference: snapshot.reference,
        },
      },
      tx,
    )

    return archive
    }, {
      isolationLevel: 'Serializable',
      maxWait: 10_000,
      timeout: 20_000,
      }),
    )
  }
  catch (error) {
    const code = prismaErrorCode(error)

    if (isReportArchiveRetryableError(error)) {
      httpError(
        409,
        'Une autre opération a modifié ce bilan. Actualisez la page.',
        'REPORT_ARCHIVE_CONFLICT',
      )
    }

    if (code === 'P2002') {
      httpError(
        409,
        'Un archivage concurrent ou une collision de référence a été détecté. Actualisez la page.',
        'REPORT_ARCHIVE_DUPLICATE',
      )
    }

    throw error
  }
}
