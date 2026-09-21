import {
  PDFDocument,
} from 'pdf-lib'
import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  generateCraClientAttestationPdf,
} from '../../server/utils/cra-client-attestation'

async function createSourcePdf(
  pageCount = 1,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()

  for (let index = 0; index < pageCount; index += 1) {
    pdf.addPage([
      595.28,
      841.89,
    ])
  }

  return pdf.save()
}

describe(
  'generateCraClientAttestationPdf',
  () => {
    it(
      'préserve les pages source et ajoute une page d’attestation en cas d’acceptation',
      async () => {
        const sourceBytes
          = await createSourcePdf(2)

        const result
          = await generateCraClientAttestationPdf({
            sourceBytes,

            sourceMimeType:
              'application/pdf',

            attestedReference:
              'CRA-TEST-CLIENT-ACCEPTED-V1',

            decision:
              'ACCEPTED',

            firstName:
              'Van Tien',

            lastName:
              'BUI',

            jobTitle:
              'Responsable informatique',

            organizationName:
              'ESN',

            recipientEmail:
              'client@example.invalid',

            comment:
              'Document vérifié et accepté.',

            decidedAt:
              new Date(
                '2026-09-22T00:30:00+02:00',
              ),

            sourceDocumentReference:
              'CRA-TEST-SIGNED-V1',

            sourceDocumentSha256:
              'a'.repeat(64),
          })

        const pdf
          = await PDFDocument.load(
            result,
          )

        expect(
          pdf.getPageCount(),
        ).toBe(3)

        expect(
          result.length,
        ).toBeGreaterThan(0)
      },
    )

    it(
      'autorise une acceptation sans commentaire',
      async () => {
        const sourceBytes
          = await createSourcePdf()

        const result
          = await generateCraClientAttestationPdf({
            sourceBytes,

            sourceMimeType:
              'application/pdf',

            attestedReference:
              'CRA-TEST-NO-COMMENT',

            decision:
              'ACCEPTED',

            firstName:
              'Jean',

            lastName:
              'Dupont',

            jobTitle:
              'Chef de projet',

            organizationName:
              'Client Test',

            recipientEmail:
              'client@example.invalid',

            comment:
              null,

            decidedAt:
              new Date(),

            sourceDocumentReference:
              'CRA-TEST-SIGNED-V1',

            sourceDocumentSha256:
              'b'.repeat(64),
          })

        const pdf
          = await PDFDocument.load(
            result,
          )

        expect(
          pdf.getPageCount(),
        ).toBe(2)
      },
    )

    it(
      'refuse un refus sans commentaire',
      async () => {
        const sourceBytes
          = await createSourcePdf()

        await expect(
          generateCraClientAttestationPdf({
            sourceBytes,

            sourceMimeType:
              'application/pdf',

            attestedReference:
              'CRA-TEST-CLIENT-REFUSED-V1',

            decision:
              'REFUSED',

            firstName:
              'Jean',

            lastName:
              'Dupont',

            jobTitle:
              'Chef de projet',

            organizationName:
              'Client Test',

            recipientEmail:
              'client@example.invalid',

            comment:
              '   ',

            decidedAt:
              new Date(),

            sourceDocumentReference:
              'CRA-TEST-SIGNED-V1',

            sourceDocumentSha256:
              'c'.repeat(64),
          }),
        ).rejects.toThrow(
          'Le commentaire est obligatoire en cas de refus.',
        )
      },
    )

    it(
      'génère correctement une attestation de refus avec motif',
      async () => {
        const sourceBytes
          = await createSourcePdf()

        const result
          = await generateCraClientAttestationPdf({
            sourceBytes,

            sourceMimeType:
              'application/pdf',

            attestedReference:
              'CRA-TEST-REFUSED-WITH-COMMENT',

            decision:
              'REFUSED',

            firstName:
              'Marie',

            lastName:
              'Martin',

            jobTitle:
              'Responsable cliente',

            organizationName:
              'Client Test',

            recipientEmail:
              'client@example.invalid',

            comment:
              'Une correction est nécessaire avant validation.',

            decidedAt:
              new Date(
                '2026-09-22T00:31:00+02:00',
              ),

            sourceDocumentReference:
              'CRA-TEST-SIGNED-V1',

            sourceDocumentSha256:
              'd'.repeat(64),
          })

        const pdf
          = await PDFDocument.load(
            result,
          )

        expect(
          pdf.getPageCount(),
        ).toBe(2)

        expect(
          result.length,
        ).toBeGreaterThan(0)
      },
    )

    it(
      'rejette une empreinte SHA-256 source invalide',
      async () => {
        const sourceBytes
          = await createSourcePdf()

        await expect(
          generateCraClientAttestationPdf({
            sourceBytes,

            sourceMimeType:
              'application/pdf',

            attestedReference:
              'CRA-TEST-BAD-SHA',

            decision:
              'ACCEPTED',

            firstName:
              'Jean',

            lastName:
              'Dupont',

            jobTitle:
              'Chef de projet',

            organizationName:
              'Client Test',

            recipientEmail:
              'client@example.invalid',

            comment:
              null,

            decidedAt:
              new Date(),

            sourceDocumentReference:
              'CRA-TEST-SIGNED-V1',

            sourceDocumentSha256:
              'not-a-sha256',
          }),
        ).rejects.toThrow(
          'Empreinte SHA-256 du document source invalide.',
        )
      },
    )
  },
)
