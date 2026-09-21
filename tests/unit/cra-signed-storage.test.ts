import {
  access,
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import { PDFDocument } from 'pdf-lib'
import {
  promoteCraSignedDocument,
  quarantineCraSignedDocument,
  resolveStoredPath,
} from '../../server/utils/files'

let temporaryUploadRoot = ''

beforeEach(async () => {
  temporaryUploadRoot = await mkdtemp(
    join(tmpdir(), 'ifics-cra-upload-'),
  )

  process.env.UPLOAD_DIR = temporaryUploadRoot
})

afterEach(async () => {
  delete process.env.UPLOAD_DIR

  if (temporaryUploadRoot) {
    await rm(
      temporaryUploadRoot,
      {
        recursive: true,
        force: true,
      },
    )
  }
})

async function validPdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  pdf.addPage([595, 842])

  return Buffer.from(
    await pdf.save(),
  )
}

describe('stockage CRA signé', () => {
  it(
    'place le fichier en quarantaine avant promotion',
    async () => {
      const buffer = await validPdf()

      const quarantined
        = await quarantineCraSignedDocument(
          'report_test_123',
          'CRA-signe.pdf',
          buffer,
        )

      expect(
        quarantined.quarantinePath,
      ).toMatch(
        /^quarantine\/cra\/report_test_123\//,
      )

      expect(
        quarantined.finalPath,
      ).toMatch(
        /^cra\/report_test_123\//,
      )

      await expect(
        access(
          resolveStoredPath(
            quarantined.quarantinePath,
          ),
        ),
      ).resolves.toBeUndefined()

      await expect(
        access(
          resolveStoredPath(
            quarantined.finalPath,
          ),
        ),
      ).rejects.toBeTruthy()

      const stored
        = await promoteCraSignedDocument(
          quarantined,
        )

      expect(stored.mimeType)
        .toBe('application/pdf')

      expect(stored.sha256)
        .toBe(quarantined.sha256)

      await expect(
        access(
          resolveStoredPath(
            quarantined.quarantinePath,
          ),
        ),
      ).rejects.toBeTruthy()

      const finalBuffer = await readFile(
        resolveStoredPath(
          stored.filePath,
        ),
      )

      expect(
        finalBuffer.equals(buffer),
      ).toBe(true)
    },
  )

  it(
    'refuse un contenu qui n’est ni PDF, PNG ni JPEG',
    async () => {
      await expect(
        quarantineCraSignedDocument(
          'report_test_123',
          'faux.pdf',
          Buffer.from(
            'ceci n est pas un document autorise',
          ),
        ),
      ).rejects.toBeTruthy()
    },
  )
})
