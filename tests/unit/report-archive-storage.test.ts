import { createHash } from 'node:crypto'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildReportArchiveSnapshot } from '../../server/utils/report-archive-snapshot'
import { generateOfficialReportPdf } from '../../server/utils/report-archive-pdf'
import {
  readStoredFile,
  removeStoredFile,
  storePdf,
} from '../../server/utils/files'

describe('Stockage physique des bilans officiels', () => {
  const originalUploadDir = process.env.UPLOAD_DIR
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    if (originalUploadDir === undefined) {
      delete process.env.UPLOAD_DIR
    }
    else {
      process.env.UPLOAD_DIR = originalUploadDir
    }

    for (const directory of temporaryDirectories.splice(0)) {
      await rm(directory, {
        recursive: true,
        force: true,
      })
    }
  })

  it('génère, stocke et relit un PDF avec son SHA-256', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'ifics-report-archive-'),
    )

    temporaryDirectories.push(directory)
    process.env.UPLOAD_DIR = directory

    const snapshot = buildReportArchiveSnapshot({
      reportId: 'report-storage-test',
      reportVersionId: 'version-storage-test',
      version: 1,
      associationName: 'IFICS TEST',
      projectTitle: 'Projet pédagogique',
      reportTitle: 'Bilan de séance',
      intervenorName: null,
      sessionDate: new Date('2026-10-09T12:00:00.000Z'),
      startTime: '09:30',
      endTime: '12:00',
      studentsCount: 4,
      content: 'Bilan pédagogique de test.',
      validatedByUserId: 'reviewer-storage-test',
      validatedAt: new Date('2026-10-10T12:00:00.000Z'),
    })

    const pdf = Buffer.from(
      await generateOfficialReportPdf(snapshot),
    )

    const stored = await storePdf(
      'reports',
      snapshot.reportId,
      `${snapshot.reference}.pdf`,
      pdf,
    )

    expect(stored.filePath).toMatch(
      /^reports\/report-storage-test\/[a-f0-9-]+\.pdf$/,
    )

    expect(stored.fileSize).toBe(BigInt(pdf.length))

    const expectedHash = createHash('sha256')
      .update(pdf)
      .digest('hex')

    expect(stored.sha256).toBe(expectedHash)

    const downloaded = await readStoredFile(stored.filePath)

    expect(downloaded.equals(pdf)).toBe(true)

    expect(
      createHash('sha256').update(downloaded).digest('hex'),
    ).toBe(stored.sha256)

    await removeStoredFile(stored.filePath)

    const files = await readdir(
      join(directory, 'reports', snapshot.reportId),
    )

    expect(files).toHaveLength(0)

    await removeStoredFile(stored.filePath)
  })
})
