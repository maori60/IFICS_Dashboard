import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import {
  readStoredFile,
  removeStoredFile,
  resolveStoredPath,
  storeCraSignature,
} from '../../server/utils/files'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let directory = ''
let previousUploadDir: string | undefined

async function onePagePdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  pdf.addPage([200, 100])

  return Buffer.from(await pdf.save())
}

async function twoPagePdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  pdf.addPage([200, 100])
  pdf.addPage([200, 100])

  return Buffer.from(await pdf.save())
}

// PNG 1x1 valide.
const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

describe('Stockage privé de la signature CRA', () => {
  beforeEach(async () => {
    previousUploadDir = process.env.UPLOAD_DIR
    directory = await mkdtemp(join(tmpdir(), 'ifics-cra-signature-'))
    process.env.UPLOAD_DIR = directory
  })

  afterEach(async () => {
    if (previousUploadDir === undefined) {
      delete process.env.UPLOAD_DIR
    }
    else {
      process.env.UPLOAD_DIR = previousUploadDir
    }

    if (directory) {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('stocke un PDF valide d’une page dans l’espace privé signatures', async () => {
    const stored = await storeCraSignature(
      'association-test',
      'ma-signature.pdf',
      await onePagePdf(),
    )

    expect(stored).toMatchObject({
      originalName: 'ma-signature.pdf',
      mimeType: 'application/pdf',
    })

    expect(stored.filePath).toMatch(
      /^signatures[/\\]association-test[/\\].+\.pdf$/,
    )

    expect(stored.sha256).toMatch(/^[a-f0-9]{64}$/)

    const content = await readStoredFile(stored.filePath)

    expect(content.length).toBeGreaterThan(0)
    expect(content.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('stocke une image PNG réellement décodable', async () => {
    const stored = await storeCraSignature(
      'association-test',
      'signature.png',
      VALID_PNG,
    )

    expect(stored.mimeType).toBe('image/png')
    expect(stored.filePath).toMatch(
      /^signatures[/\\]association-test[/\\].+\.png$/,
    )
  })

  it('refuse un faux PNG même avec la bonne signature binaire', async () => {
    const fake = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      Buffer.from('ceci-ne-suffit-pas-a-faire-un-png'),
    ])

    await expect(
      storeCraSignature(
        'association-test',
        'faux.png',
        fake,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('refuse un PDF contenant plusieurs pages', async () => {
    await expect(
      storeCraSignature(
        'association-test',
        'signature.pdf',
        await twoPagePdf(),
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('refuse un fichier qui n’est ni PDF, ni PNG, ni JPEG', async () => {
    await expect(
      storeCraSignature(
        'association-test',
        'signature.txt',
        Buffer.from('pas une signature valide'),
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('refuse une signature supérieure à 5 Mo', async () => {
    await expect(
      storeCraSignature(
        'association-test',
        'signature.png',
        Buffer.alloc(5 * 1024 * 1024 + 1),
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('supprime physiquement un fichier privé stocké', async () => {
    const stored = await storeCraSignature(
      'association-test',
      'signature.pdf',
      await onePagePdf(),
    )

    const absolute = resolveStoredPath(stored.filePath)

    expect((await readFile(absolute)).length).toBeGreaterThan(0)

    await removeStoredFile(stored.filePath)

    await expect(readFile(absolute)).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('refuse de résoudre un chemin sortant de la racine de stockage', () => {
    expect(() =>
      resolveStoredPath('../../etc/passwd'),
    ).toThrow()
  })
})
