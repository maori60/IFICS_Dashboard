import { createHash } from 'node:crypto'
import {
  mkdtemp,
  rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { PDFDocument } from 'pdf-lib'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import {
  discardQuarantinedExpenseAttachment,
  promoteExpenseAttachment,
  quarantineExpenseAttachment,
  readStoredFile,
  validateExpenseAttachmentBuffer,
} from '../../server/utils/files'

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

describe(
  'stockage sécurisé des justificatifs de dépenses',
  () => {
    let uploadDir: string

    const previousUploadDir
      = process.env.UPLOAD_DIR

    const previousMaxUploadMb
      = process.env.MAX_UPLOAD_MB

    beforeEach(async () => {
      uploadDir = await mkdtemp(
        join(
          tmpdir(),
          'ifics-expense-attachment-',
        ),
      )

      process.env.UPLOAD_DIR
        = uploadDir

      process.env.MAX_UPLOAD_MB
        = '10'
    })

    afterEach(async () => {
      if (previousUploadDir === undefined) {
        delete process.env.UPLOAD_DIR
      }
      else {
        process.env.UPLOAD_DIR
          = previousUploadDir
      }

      if (
        previousMaxUploadMb
        === undefined
      ) {
        delete process.env.MAX_UPLOAD_MB
      }
      else {
        process.env.MAX_UPLOAD_MB
          = previousMaxUploadMb
      }

      await rm(
        uploadDir,
        {
          recursive: true,
          force: true,
        },
      )
    })

    async function createPdf(): Promise<Buffer> {
      const pdf
        = await PDFDocument.create()

      pdf.addPage([
        300,
        200,
      ])

      return Buffer.from(
        await pdf.save(),
      )
    }

    it(
      'reconnaît un PDF valide à partir de son contenu',
      async () => {
        const buffer
          = await createPdf()

        const detected
          = await validateExpenseAttachmentBuffer(
            buffer,
          )

        expect(detected)
          .toEqual({
            mimeType:
              'application/pdf',
            extension:
              'pdf',
          })
      },
    )

    it(
      'reconnaît une image PNG valide à partir de son contenu',
      async () => {
        const detected
          = await validateExpenseAttachmentBuffer(
            ONE_PIXEL_PNG,
          )

        expect(detected)
          .toEqual({
            mimeType:
              'image/png',
            extension:
              'png',
          })
      },
    )

    it(
      'refuse un fichier arbitraire même s’il pourrait porter une extension autorisée',
      async () => {
        const fakePdf
          = Buffer.from(
            'ceci-n-est-pas-un-pdf',
          )

        await expect(
          validateExpenseAttachmentBuffer(
            fakePdf,
          ),
        ).rejects.toMatchObject({
          statusCode: 400,
        })
      },
    )

    it(
      'refuse un fichier vide',
      async () => {
        await expect(
          validateExpenseAttachmentBuffer(
            Buffer.alloc(0),
          ),
        ).rejects.toMatchObject({
          statusCode: 400,
        })
      },
    )

    it(
      'refuse un justificatif supérieur à MAX_UPLOAD_MB',
      async () => {
        process.env.MAX_UPLOAD_MB
          = '1'

        const oversized
          = Buffer.alloc(
            1024 * 1024 + 1,
            0x41,
          )

        await expect(
          validateExpenseAttachmentBuffer(
            oversized,
          ),
        ).rejects.toMatchObject({
          statusCode: 400,
        })
      },
    )

    it(
      'refuse un PDF contenant une fonctionnalité active interdite',
      async () => {
        const pdf
          = await createPdf()

        const unsafePdf
          = Buffer.concat([
            pdf,
            Buffer.from(
              '\n/JavaScript\n',
              'latin1',
            ),
          ])

        await expect(
          validateExpenseAttachmentBuffer(
            unsafePdf,
          ),
        ).rejects.toMatchObject({
          statusCode: 400,
        })
      },
    )

    it(
      'place un justificatif en quarantaine avec nom sécurisé, taille et SHA-256',
      async () => {
        const buffer
          = await createPdf()

        const quarantined
          = await quarantineExpenseAttachment(
            'expense_test_123',
            '../../facture"<script>.pdf',
            buffer,
          )

        expect(
          quarantined.quarantinePath,
        ).toMatch(
          /^quarantine\/expenses\/expense_test_123\/[0-9a-f-]+\.pdf$/,
        )

        expect(
          quarantined.finalPath,
        ).toMatch(
          /^expenses\/expense_test_123\/attachments\/[0-9a-f-]+\.pdf$/,
        )

        expect(
          quarantined.originalName,
        ).not.toContain('/')

        expect(
          quarantined.originalName,
        ).not.toContain('<')

        expect(
          quarantined.originalName,
        ).not.toContain('>')

        expect(
          quarantined.mimeType,
        ).toBe(
          'application/pdf',
        )

        expect(
          quarantined.fileSize,
        ).toBe(
          BigInt(buffer.length),
        )

        expect(
          quarantined.sha256,
        ).toBe(
          createHash('sha256')
            .update(buffer)
            .digest('hex'),
        )

        const stored
          = await readStoredFile(
            quarantined.quarantinePath,
          )

        expect(
          stored.equals(buffer),
        ).toBe(true)
      },
    )

    it(
      'promeut une pièce de la quarantaine vers le stockage définitif sans modifier son intégrité',
      async () => {
        const buffer
          = ONE_PIXEL_PNG

        const quarantined
          = await quarantineExpenseAttachment(
            'expense_png_123',
            'ticket.png',
            buffer,
          )

        const stored
          = await promoteExpenseAttachment(
            quarantined,
          )

        expect(
          stored.filePath,
        ).toBe(
          quarantined.finalPath,
        )

        expect(
          stored.mimeType,
        ).toBe(
          'image/png',
        )

        expect(
          stored.sha256,
        ).toBe(
          quarantined.sha256,
        )

        expect(
          stored.fileSize,
        ).toBe(
          quarantined.fileSize,
        )

        const finalBuffer
          = await readStoredFile(
            stored.filePath,
          )

        expect(
          finalBuffer.equals(buffer),
        ).toBe(true)

        await expect(
          readStoredFile(
            quarantined.quarantinePath,
          ),
        ).rejects.toMatchObject({
          statusCode: 404,
        })
      },
    )

    it(
      'supprime une pièce refusée présente en quarantaine',
      async () => {
        const buffer
          = await createPdf()

        const quarantined
          = await quarantineExpenseAttachment(
            'expense_discard_123',
            'recu.pdf',
            buffer,
          )

        await discardQuarantinedExpenseAttachment(
          quarantined,
        )

        await expect(
          readStoredFile(
            quarantined.quarantinePath,
          ),
        ).rejects.toMatchObject({
          statusCode: 404,
        })

        /*
         * La suppression est idempotente :
         * un second nettoyage ne doit pas échouer.
         */
        await expect(
          discardQuarantinedExpenseAttachment(
            quarantined,
          ),
        ).resolves.toBeUndefined()
      },
    )

    it(
      'refuse un identifiant de dépense utilisable pour une traversée de répertoires',
      async () => {
        const buffer
          = await createPdf()

        await expect(
          quarantineExpenseAttachment(
            '../outside',
            'facture.pdf',
            buffer,
          ),
        ).rejects.toMatchObject({
          statusCode: 400,
        })
      },
    )
  },
)
