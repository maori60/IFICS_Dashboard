import { createHash, timingSafeEqual } from 'node:crypto'
import { httpError } from './api'
import { readSecureOfficialReportFile } from './report-archive-secure-read'

type OfficialArchiveFile = {
  filePath: string
  fileSize: bigint
  sha256: string
  mimeType: string
}

export async function readVerifiedOfficialReportPdf(
  archive: OfficialArchiveFile,
): Promise<Buffer> {
  if (
    archive.mimeType !== 'application/pdf'
    || !/^[a-f0-9]{64}$/i.test(archive.sha256)
    || archive.fileSize <= 0n
  ) {
    httpError(
      409,
      'Les métadonnées du document officiel sont invalides.',
      'REPORT_ARCHIVE_INVALID',
    )
  }

  let pdf: Buffer

  try {
    pdf = await readSecureOfficialReportFile(archive.filePath)
  }
  catch {
    httpError(
      409,
      'Le fichier officiel archivé est indisponible.',
      'REPORT_ARCHIVE_FILE_MISSING',
    )
  }

  if (
    BigInt(pdf.length) !== archive.fileSize
    || pdf.subarray(0, 5).toString() !== '%PDF-'
  ) {
    httpError(
      409,
      'Le document officiel ne correspond plus à son archive.',
      'REPORT_ARCHIVE_INTEGRITY_FAILED',
    )
  }

  const actual = createHash('sha256').update(pdf).digest()
  const expected = Buffer.from(archive.sha256, 'hex')

  if (!timingSafeEqual(actual, expected)) {
    httpError(
      409,
      'L’intégrité du document officiel est compromise.',
      'REPORT_ARCHIVE_INTEGRITY_FAILED',
    )
  }

  return pdf
}
