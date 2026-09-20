import { describe, expect, it } from 'vitest'
import { FINANCE_SETTINGS_CLIENT_SELECT } from '../../server/utils/settings'

describe('Sélection publique des paramètres financiers', () => {
  it('n’expose aucun champ privé de signature CRA', () => {
    const keys = Object.keys(FINANCE_SETTINGS_CLIENT_SELECT)

    expect(
      keys.filter(key => key.startsWith('craSignature')),
    ).toEqual([])

    expect(FINANCE_SETTINGS_CLIENT_SELECT).not.toHaveProperty(
      'craSignatureFilePath',
    )

    expect(FINANCE_SETTINGS_CLIENT_SELECT).not.toHaveProperty(
      'craSignatureUpdatedByUserId',
    )

    expect(FINANCE_SETTINGS_CLIENT_SELECT).not.toHaveProperty(
      'craSignatureSha256',
    )
  })

  it('conserve les champs nécessaires à la page paramètres', () => {
    expect(FINANCE_SETTINGS_CLIENT_SELECT).toMatchObject({
      legalForm: true,
      rnaNumber: true,
      vatNumber: true,
      bankName: true,
      bankAccountHolder: true,
      iban: true,
      bic: true,
      paymentTerms: true,
      taxExemptionText: true,
      logoFilePath: true,
      maxAssetDocuments: true,
      maxAssetDocumentMb: true,
    })
  })
})
