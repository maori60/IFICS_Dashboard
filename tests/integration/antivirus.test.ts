import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  scanBufferWithClamAv,
} from '../../server/utils/antivirus'

describe.skipIf(
  process.env.CLAMAV_INTEGRATION_TESTS !== '1',
)(
  'ClamAV réel',
  () => {
    it('accepte un contenu sain', async () => {
      const result
        = await scanBufferWithClamAv(
          Buffer.from(
            'Bonjour IFICS, fichier sain.',
          ),
        )

      expect(result).toMatchObject({
        status: 'CLEAN',
      })
    })

    it('détecte EICAR', async () => {
      const eicar = Buffer.from(
        'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
      )

      const result
        = await scanBufferWithClamAv(
          eicar,
        )

      expect(result).toMatchObject({
        status: 'INFECTED',
        signature:
          'Eicar-Test-Signature',
      })
    })
  },
)
