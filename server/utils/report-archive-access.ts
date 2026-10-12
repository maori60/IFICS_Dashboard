import type { AuthContext } from './auth'
import { hasPermission } from './auth'
import { PERMISSIONS, ROLE_CODES } from './constants'
import { httpError } from './api'

type ArchiveProject = {
  associationId: string
  classification: string
}

export function assertOfficialArchiveReadAccess(
  context: AuthContext,
  project: ArchiveProject,
): void {
  if (context.associationId !== project.associationId) {
    httpError(404, 'Archive introuvable.', 'REPORT_ARCHIVE_NOT_FOUND')
  }

  if (
    context.roleCode === ROLE_CODES.CLIENT
    || context.roleCode === ROLE_CODES.INTERVENOR
  ) {
    httpError(403, 'Accès aux archives interdit.', 'REPORT_ARCHIVE_FORBIDDEN')
  }

  if (
    !hasPermission(context, PERMISSIONS.REPORT_ARCHIVE_READ)
    || !hasPermission(context, PERMISSIONS.REPORT_READ)
  ) {
    httpError(403, 'Permission archives requise.', 'REPORT_ARCHIVE_FORBIDDEN')
  }

  if (
    ['CONFIDENTIAL', 'RESTRICTED'].includes(project.classification)
    && !hasPermission(context, PERMISSIONS.PROJECT_CONFIDENTIAL_READ)
  ) {
    httpError(403, 'Archive confidentielle interdite.', 'REPORT_ARCHIVE_CLASSIFIED')
  }
}
