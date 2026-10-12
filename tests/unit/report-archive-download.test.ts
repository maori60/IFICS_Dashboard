import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readVerifiedOfficialReportPdf } from '../../server/utils/report-archive-download'
import { generateReportPdf } from '../../server/utils/pdf'

describe('Téléchargement sécurisé des bilans officiels', () => {
  const originalUploadDir = process.env.UPLOAD_DIR

  let directory: string
  let pdf: Buffer
  let filePath: string

  beforeEach(async () => {
    directory = await mkdtemp(
      join(tmpdir(), 'ifics-report-download-'),
    )

    process.env.UPLOAD_DIR = directory

    pdf = Buffer.from(await generateReportPdf({
      title: 'Bilan de test',
      projectTitle: 'Projet IFICS',
      intervenorName: 'Intervenant test',
      sessionDate: new Date('2026-10-10T12:00:00.000Z'),
      startTime: '09:30',
      endTime: '12:00',
      studentsCount: 4,
      content: 'Contenu officiel du bilan.',
      version: 1,
      associationName: 'IFICS',
    }))

    filePath = 'reports/test/official.pdf'
    const { mkdir } = await import('node:fs/promises')
    await mkdir(join(directory, 'reports', 'test'), {
      recursive: true,
    })

    await writeFile(
      join(directory, filePath),
      pdf,
    )
  })

  afterEach(async () => {
    if (originalUploadDir === undefined) {
      delete process.env.UPLOAD_DIR
    }
    else {
      process.env.UPLOAD_DIR = originalUploadDir
    }

    if (directory) {
      await rm(directory, {
        recursive: true,
        force: true,
      })
    }
  })

  function archive() {
    return {
      filePath,
      fileSize: BigInt(pdf.length),
      sha256: createHash('sha256').update(pdf).digest('hex'),
      mimeType: 'application/pdf',
    }
  }

  it('restitue exactement le PDF officiel intact', async () => {
    const downloaded = await readVerifiedOfficialReportPdf(archive())

    expect(downloaded.equals(pdf)).toBe(true)
  })

  it('refuse un fichier dont le contenu a changé', async () => {
    const modified = Buffer.from(pdf)
    modified[modified.length - 1] ^= 1

    await writeFile(join(directory, filePath), modified)

    await expect(
      readVerifiedOfficialReportPdf(archive()),
    ).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('refuse une taille incorrecte', async () => {
    await expect(
      readVerifiedOfficialReportPdf({
        ...archive(),
        fileSize: BigInt(pdf.length + 1),
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('refuse une empreinte SHA-256 incorrecte', async () => {
    await expect(
      readVerifiedOfficialReportPdf({
        ...archive(),
        sha256: '0'.repeat(64),
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('refuse un fichier absent', async () => {
    await expect(
      readVerifiedOfficialReportPdf({
        ...archive(),
        filePath: 'reports/test/missing.pdf',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('refuse des métadonnées invalides', async () => {
    await expect(
      readVerifiedOfficialReportPdf({
        ...archive(),
        mimeType: 'text/plain',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    })

    await expect(
      readVerifiedOfficialReportPdf({
        ...archive(),
        sha256: 'incorrect',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    })
  })
})
