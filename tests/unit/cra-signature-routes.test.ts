import type { H3Event } from 'h3'
import { defineEventHandler } from 'h3'
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const request = vi.hoisted(() => ({
  permissions: [] as string[],
  requestedPermission: '',
}))

vi.mock('../../server/utils/auth', () => ({
  requirePermission: async (
    _event: H3Event,
    permission: string,
  ) => {
    request.requestedPermission = permission

    if (
      !request.permissions.includes('*')
      && !request.permissions.includes(permission)
    ) {
      const error = new Error('Accès interdit.') as Error & {
        statusCode: number
      }

      error.statusCode = 403
      throw error
    }

    return {
      associationId: 'association-test',
      userId: 'user-test',
      roleCode: 'ADMIN',
      intervenorId: null,
      permissions: request.permissions,
    }
  },
}))

describe('Routes de signature CRA', () => {
  let getHandler:
    typeof import('../../server/api/settings/cra-signature.get')['default']

  let postHandler:
    typeof import('../../server/api/settings/cra-signature.post')['default']

  let deleteHandler:
    typeof import('../../server/api/settings/cra-signature.delete')['default']

  const event = {} as H3Event

  beforeAll(async () => {
    vi.stubGlobal('defineEventHandler', defineEventHandler)

    getHandler = (
      await import('../../server/api/settings/cra-signature.get')
    ).default

    postHandler = (
      await import('../../server/api/settings/cra-signature.post')
    ).default

    deleteHandler = (
      await import('../../server/api/settings/cra-signature.delete')
    ).default
  })

  beforeEach(() => {
    request.permissions = []
    request.requestedPermission = ''
  })

  it('refuse la lecture sans settings:manage', async () => {
    await expect(
      getHandler(event),
    ).rejects.toMatchObject({
      statusCode: 403,
    })

    expect(request.requestedPermission).toBe('settings:manage')
  })

  it('refuse le remplacement sans settings:manage', async () => {
    await expect(
      postHandler(event),
    ).rejects.toMatchObject({
      statusCode: 403,
    })

    expect(request.requestedPermission).toBe('settings:manage')
  })

  it('refuse la suppression sans settings:manage', async () => {
    await expect(
      deleteHandler(event),
    ).rejects.toMatchObject({
      statusCode: 403,
    })

    expect(request.requestedPermission).toBe('settings:manage')
  })
})
