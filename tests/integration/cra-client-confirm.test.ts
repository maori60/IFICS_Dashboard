import {
  defineEventHandler,
  type H3Event,
} from 'h3'
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const browser = vi.hoisted(() => ({
  setResponseHeader:
    vi.fn(),
}))

vi.mock(
  'h3',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('h3')
    >()

    return {
      ...actual,

      setResponseHeader:
        browser.setResponseHeader,
    }
  },
)

describe(
  'Ancienne confirmation CRA client',
  () => {
    let handler:
      typeof import(
        '../../server/api/cra-client/confirm.post'
      )['default']

    const event = {
      context: {},
    } as H3Event

    beforeAll(async () => {
      vi.stubGlobal(
        'defineEventHandler',
        defineEventHandler,
      )

      handler = (
        await import(
          '../../server/api/cra-client/confirm.post'
        )
      ).default
    })

    afterAll(() => {
      vi.unstubAllGlobals()
    })

    it(
      'refuse définitivement la confirmation simple',
      async () => {
        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode:
            410,

          data: {
            code:
              'CRA_CLIENT_CONFIRMATION_REPLACED',
          },
        })
      },
    )

    it(
      'applique les en-têtes no-store avant le refus',
      async () => {
        browser.setResponseHeader
          .mockReset()

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode:
            410,
        })

        expect(
          browser.setResponseHeader,
        ).toHaveBeenCalledWith(
          event,
          'Cache-Control',
          'no-store',
        )

        expect(
          browser.setResponseHeader,
        ).toHaveBeenCalledWith(
          event,
          'Pragma',
          'no-cache',
        )
      },
    )
  },
)
