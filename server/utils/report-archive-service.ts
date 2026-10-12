import type { H3Event } from 'h3'
import type { AuthContext } from './auth'
import { httpError } from './api'
import { findReportArchiveSource } from './report-archive-reader'
import { buildReportArchiveFromSource } from './report-archive-source'
import { reportArchiveStateFromSource } from './report-archive-state'
import { generateOfficialReportPdf } from './report-archive-pdf'
import { commitOfficialReportArchive } from './report-archive-transaction'
import { removeStoredFile, storePdf } from './files'

type ArchiveServiceInput = {
  event: H3Event
  context: AuthContext
  reportId: string
}

export async function validateAndArchiveOfficialReport(
  input: ArchiveServiceInput,
) {
  const { event, context, reportId } = input

  const source = await findReportArchiveSource(
    reportId,
    context.associationId,
  )

  if (!source) {
    httpError(
      409,
      'Ce bilan n’est plus disponible pour validation.',
      'REPORT_ARCHIVE_CONFLICT',
    )
  }

  const expectedState = reportArchiveStateFromSource(source)

  const snapshot = buildReportArchiveFromSource(
    source,
    context.userId,
    new Date(),
  )

  const pdfBytes = await generateOfficialReportPdf(snapshot)

  const stored = await storePdf(
    'reports',
    reportId,
    `${snapshot.reference}.pdf`,
    Buffer.from(pdfBytes),
  )

  try {
    return await commitOfficialReportArchive({
      event,
      context,
      snapshot,
      expectedState,
      stored,
    })
  }
  catch (error) {
    try {
      await removeStoredFile(stored.filePath)
    }
    catch (cleanupError) {
      console.error('REPORT_OFFICIAL_FILE_CLEANUP_FAILED', {
        reportId,
        filePath: stored.filePath,
        cleanupError,
      })
    }

    throw error
  }
}
