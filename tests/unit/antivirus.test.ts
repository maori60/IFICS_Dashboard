import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  ClamAvError,
  parseClamAvResponse,
} from '../../server/utils/antivirus'

describe('parseClamAvResponse', () => {
  it('reconnaît un fichier sain', () => {
    expect(
      parseClamAvResponse(
        'stream: OK\0',
      ),
    ).toEqual({
      status: 'CLEAN',
      rawResult: 'stream: OK',
    })
  })

  it('reconnaît un fichier infecté', () => {
    expect(
      parseClamAvResponse(
        'stream: Eicar-Test-Signature FOUND\0',
      ),
    ).toEqual({
      status: 'INFECTED',
      signature:
        'Eicar-Test-Signature',
      rawResult:
        'stream: Eicar-Test-Signature FOUND',
    })
  })

  it('refuse une erreur ClamAV', () => {
    expect(() =>
      parseClamAvResponse(
        'stream: INSTREAM size limit exceeded. ERROR',
      ),
    ).toThrowError(ClamAvError)

    try {
      parseClamAvResponse(
        'stream: INSTREAM size limit exceeded. ERROR',
      )
    }
    catch (error) {
      expect(error).toMatchObject({
        code: 'CLAMAV_SCAN_ERROR',
      })
    }
  })

  it('refuse une réponse inconnue', () => {
    expect(() =>
      parseClamAvResponse(
        'réponse-inconnue',
      ),
    ).toThrowError(ClamAvError)
  })
})
