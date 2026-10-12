import { describe, expect, it } from 'vitest'
import { assertOfficialArchiveReadAccess } from '../../server/utils/report-archive-access'
import type { AuthContext } from '../../server/utils/auth'
import { PERMISSIONS } from '../../server/utils/constants'

function context(
  roleCode: string,
  permissions: string[],
  associationId = 'association-a',
): AuthContext {
  return {
    sessionId: 'session',
    userId: 'user',
    associationId,
    clientId: null,
    intervenorId: null,
    email: 'test@example.invalid',
    firstName: 'Test',
    lastName: 'IFICS',
    roleCode,
    roleName: roleCode,
    permissions,
    mfaEnabled: true,
    mfaVerified: true,
    mfaSetupRequired: false,
  }
}

const project = {
  associationId: 'association-a',
  classification: 'INTERNAL',
}

const read = [
  PERMISSIONS.REPORT_READ,
  PERMISSIONS.REPORT_ARCHIVE_READ,
]

describe('Accès aux archives officielles', () => {
  it('autorise un administrateur habilité', () => {
    expect(() =>
      assertOfficialArchiveReadAccess(
        context('ADMIN', [PERMISSIONS.ALL]),
        project,
      ),
    ).not.toThrow()
  })

  it('autorise un gestionnaire habilité', () => {
    expect(() =>
      assertOfficialArchiveReadAccess(
        context('MANAGER', read),
        project,
      ),
    ).not.toThrow()
  })

  it('refuse les clients même avec permission', () => {
    expect(() =>
      assertOfficialArchiveReadAccess(
        context('CLIENT', read),
        project,
      ),
    ).toThrow()
  })

  it('refuse les intervenants même avec permission', () => {
    expect(() =>
      assertOfficialArchiveReadAccess(
        context('INTERVENOR', read),
        project,
      ),
    ).toThrow()
  })

  it('refuse une permission manquante', () => {
    expect(() =>
      assertOfficialArchiveReadAccess(
        context('MANAGER', [PERMISSIONS.REPORT_READ]),
        project,
      ),
    ).toThrow()
  })

  it('refuse une autre association', () => {
    expect(() =>
      assertOfficialArchiveReadAccess(
        context('ADMIN', [PERMISSIONS.ALL], 'association-b'),
        project,
      ),
    ).toThrow()
  })

  it('refuse les projets confidentiels sans permission', () => {
    expect(() =>
      assertOfficialArchiveReadAccess(
        context('MANAGER', read),
        { ...project, classification: 'CONFIDENTIAL' },
      ),
    ).toThrow()
  })

  it('autorise un projet confidentiel avec permission', () => {
    expect(() =>
      assertOfficialArchiveReadAccess(
        context('MANAGER', [
          ...read,
          PERMISSIONS.PROJECT_CONFIDENTIAL_READ,
        ]),
        { ...project, classification: 'CONFIDENTIAL' },
      ),
    ).not.toThrow()
  })
})
