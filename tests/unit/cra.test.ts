import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '../../server/utils/auth'
import { PERMISSIONS } from '../../server/utils/constants'

import {
  requireCraAssignmentForCreation,
  requireCraWriter,
} from '../../server/utils/cra'

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

beforeEach(() => {
  findFirst.mockReset()
})

describe('Droit de saisie des CRA', () => {
  it('identifie l’intervenant autorisé à saisir ses CRA', () => {
    expect(requireCraWriter(context())).toBe('intervenor-test')
  })

  it('refuse un intervenant sans permission de saisie', () => {
    expect(() =>
      requireCraWriter(context({
        permissions: [PERMISSIONS.CRA_READ_OWN],
      })),
    ).toThrow(expect.objectContaining({ statusCode: 403 }))
  })

  it('refuse un compte sans fiche intervenant liée', () => {
    expect(() =>
      requireCraWriter(context({ intervenorId: null })),
    ).toThrow(expect.objectContaining({ statusCode: 403 }))
  })

  it('refuse un administrateur même avec tous les droits', () => {
    expect(() =>
      requireCraWriter(context({
        roleCode: 'ADMIN',
        intervenorId: null,
        permissions: [PERMISSIONS.ALL],
      })),
    ).toThrow(expect.objectContaining({ statusCode: 403 }))
  })

  it('autorise un administrateur lié à sa propre fiche intervenant', () => {
    expect(
      requireCraWriter(context({
        roleCode: 'ADMIN',
        permissions: [PERMISSIONS.ALL],
      })),
    ).toBe('intervenor-test')
  })

  it('refuse un gestionnaire disposant du droit CRA_MANAGE', () => {
    expect(() =>
      requireCraWriter(context({
        roleCode: 'MANAGER',
        intervenorId: null,
        permissions: [PERMISSIONS.CRA_MANAGE],
      })),
    ).toThrow(expect.objectContaining({ statusCode: 403 }))
  })

  it('refuse un client même avec une permission de saisie', () => {
    expect(() =>
      requireCraWriter(context({
        roleCode: 'CLIENT',
        permissions: [PERMISSIONS.CRA_WRITE_OWN],
      })),
    ).toThrow(expect.objectContaining({ statusCode: 403 }))
  })

  it('ne considère pas CRA_MANAGE comme un droit de saisie personnelle', () => {
    expect(() =>
      requireCraWriter(context({
        permissions: [PERMISSIONS.CRA_MANAGE],
      })),
    ).toThrow(expect.objectContaining({ statusCode: 403 }))
  })
})

describe('Accès aux missions pour la saisie des CRA', () => {
  it('refuse un intervenant sans permission avant toute recherche', async () => {
    await expect(
      requireCraAssignmentForCreation(
        context({ permissions: [] }),
        'project-test',
        'intervenor-test',
      ),
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(findFirst).not.toHaveBeenCalled()
  })

  it('refuse la saisie pour un autre intervenant', async () => {
    await expect(
      requireCraAssignmentForCreation(
        context(),
        'project-test',
        'another-intervenor',
      ),
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(findFirst).not.toHaveBeenCalled()
  })

  it('refuse la saisie pour autrui même avec la permission globale', async () => {
    await expect(
      requireCraAssignmentForCreation(
        context({ permissions: [PERMISSIONS.ALL] }),
        'project-test',
        'another-intervenor',
      ),
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(findFirst).not.toHaveBeenCalled()
  })

  it('refuse la saisie administrative avant toute recherche', async () => {
    await expect(
      requireCraAssignmentForCreation(
        context({
          roleCode: 'ADMIN',
          intervenorId: null,
          permissions: [PERMISSIONS.ALL],
        }),
        'project-test',
        'intervenor-test',
      ),
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(findFirst).not.toHaveBeenCalled()
  })

  it('autorise un administrateur lié à sa propre fiche sur sa propre mission', async () => {
    const mission = assignment()
    findFirst.mockResolvedValue(mission)

    await expect(
      requireCraAssignmentForCreation(
        context({
          roleCode: 'ADMIN',
          permissions: [PERMISSIONS.ALL],
        }),
        'project-test',
        'intervenor-test',
      ),
    ).resolves.toEqual(mission)
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

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: 'project-test',
          intervenorId: 'intervenor-test',
          assignmentStatus: 'ACCEPTED',
          project: expect.objectContaining({
            associationId: 'association-test',
            archivedAt: null,
            status: { not: 'CANCELLED' },
          }),
          intervenor: expect.objectContaining({
            associationId: 'association-test',
            archivedAt: null,
            status: 'ACTIVE',
          }),
        }),
      }),
    )
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

  it.each(['CONFIDENTIAL', 'RESTRICTED'])(
    'refuse un projet %s sans permission spécifique',
    async (classification) => {
      findFirst.mockResolvedValue(assignment(classification))

      await expect(
        requireCraAssignmentForCreation(
          context(),
          'project-test',
          'intervenor-test',
        ),
      ).rejects.toMatchObject({ statusCode: 403 })
    },
  )

  it.each(['CONFIDENTIAL', 'RESTRICTED'])(
    'autorise sa propre mission sur un projet %s avec la permission spécifique',
    async (classification) => {
      findFirst.mockResolvedValue(assignment(classification))

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
    },
  )
})