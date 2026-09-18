import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '../../server/utils/auth'
import { PERMISSIONS } from '../../server/utils/constants'

const { findFirst } = vi.hoisted(() => ({
  findFirst: vi.fn(),
}))

vi.mock('../../server/utils/prisma', () => ({
  prisma: {
    projectIntervenor: { findFirst },
  },
}))

vi.mock('../../server/utils/auth', () => ({
  hasPermission: (context: AuthContext, permission: string) =>
    context.permissions.includes('*')
    || context.permissions.includes(permission),
}))

import { requireCraAssignmentForCreation } from '../../server/utils/cra'

function context(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    sessionId: 'session-test',
    userId: 'user-test',
    associationId: 'association-test',
    clientId: null,
    intervenorId: 'intervenor-test',
    email: 'test@example.invalid',
    firstName: 'Test',
    lastName: 'CRA',
    roleCode: 'INTERVENOR',
    roleName: 'Intervenant',
    permissions: [PERMISSIONS.CRA_WRITE_OWN],
    mfaEnabled: true,
    mfaVerified: true,
    mfaSetupRequired: false,
    ...overrides,
  }
}

function assignment(classification = 'INTERNAL') {
  return {
    id: 'assignment-test',
    projectId: 'project-test',
    intervenorId: 'intervenor-test',
    project: {
      classification,
      startDate: null,
      endDate: null,
    },
  }
}

describe('Accès à la création des CRA', () => {
  beforeEach(() => {
    findFirst.mockReset()
  })

  it('refuse un intervenant sans permission CRA', async () => {
    await expect(
      requireCraAssignmentForCreation(
        context({ permissions: [] }),
        'project-test',
        'intervenor-test',
      ),
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(findFirst).not.toHaveBeenCalled()
  })

  it('refuse la création pour un autre intervenant', async () => {
    await expect(
      requireCraAssignmentForCreation(
        context(),
        'project-test',
        'another-intervenor',
      ),
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(findFirst).not.toHaveBeenCalled()
  })

  it('autorise sa propre mission admissible', async () => {
    const mission = assignment()
    findFirst.mockResolvedValue(mission)

    await expect(
      requireCraAssignmentForCreation(
        context(),
        'project-test',
        'intervenor-test',
      ),
    ).resolves.toEqual(mission)
  })

  it('autorise un gestionnaire disposant du droit CRA_MANAGE', async () => {
    findFirst.mockResolvedValue(assignment())

    await expect(
      requireCraAssignmentForCreation(
        context({
          intervenorId: null,
          roleCode: 'MANAGER',
          permissions: [PERMISSIONS.CRA_MANAGE],
        }),
        'project-test',
        'intervenor-test',
      ),
    ).resolves.toMatchObject({ id: 'assignment-test' })
  })

  it('refuse une mission absente des affectations admissibles', async () => {
    findFirst.mockResolvedValue(null)

    await expect(
      requireCraAssignmentForCreation(
        context(),
        'project-test',
        'intervenor-test',
      ),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('refuse un projet confidentiel sans permission spécifique', async () => {
    findFirst.mockResolvedValue(assignment('CONFIDENTIAL'))

    await expect(
      requireCraAssignmentForCreation(
        context(),
        'project-test',
        'intervenor-test',
      ),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('autorise un projet confidentiel avec la permission spécifique', async () => {
    findFirst.mockResolvedValue(assignment('CONFIDENTIAL'))

    await expect(
      requireCraAssignmentForCreation(
        context({
          permissions: [
            PERMISSIONS.CRA_WRITE_OWN,
            PERMISSIONS.PROJECT_CONFIDENTIAL_READ,
          ],
        }),
        'project-test',
        'intervenor-test',
      ),
    ).resolves.toMatchObject({ id: 'assignment-test' })
  })
})
