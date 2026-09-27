import { readBody } from 'h3'

import { PERMISSIONS } from '../../utils/constants'
import { requirePermission } from '../../utils/auth'
import { httpError, success } from '../../utils/api'
import { fullInstanceReset } from '../../utils/full-instance-reset'
import { removeStoredFile } from '../../utils/files'
import { prisma } from '../../utils/prisma'
import { safeObject } from '../../utils/validation'
import { writeAuditLogStrict } from '../../utils/audit'

const CONFIRMATION = 'EFFACER TOUTES LES DONNEES'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.SETTINGS_MANAGE)

  if (context.roleCode !== 'ADMIN') {
    throw httpError(
      403,
      'RESET_ADMIN_REQUIRED',
      'Le reset complet est réservé à un compte administrateur.',
    )
  }

  if (!context.mfaVerified) {
    throw httpError(
      403,
      'MFA_REQUIRED',
      'Une authentification multifacteur validée est requise.',
    )
  }

  const body = safeObject(await readBody(event))

  if (body.confirmation !== CONFIRMATION) {
    throw httpError(
      400,
      'INVALID_CONFIRMATION',
      `Saisissez exactement « ${CONFIRMATION} ».`,
    )
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const resetResult = await fullInstanceReset(
        tx,
        context.associationId,
        context.userId,
      )

      await writeAuditLogStrict(
        event,
        context,
        {
          action: 'ASSOCIATION_FULL_DATA_RESET',
          entityType: 'Association',
          entityId: context.associationId,
          metadata: {
            confirmation: CONFIRMATION,
            preservedAssociation: true,
            preservedCurrentAdmin: true,
            preservedRoles: true,
            preservedAuthentication: true,
            preservedMfa: true,
            preservedAuditLogs: true,
            preservedFinanceIdentity: true,
            deleted: resetResult.deleted,
          },
        },
        tx,
      )

      return resetResult
    },
    {
      timeout: 30_000,
    },
  )

  let cleanupFailed = 0

  for (const filePath of result.storedFiles) {
    try {
      await removeStoredFile(filePath)
    }
    catch (error) {
      cleanupFailed += 1

      console.error(
        'FULL_RESET_FILE_CLEANUP_FAILED',
        {
          associationId: context.associationId,
          filePath,
          error,
        },
      )
    }
  }

  return success({
    reset: true,
    deleted: result.deleted,
    filesDeleted:
      result.storedFiles.length - cleanupFailed,
    fileCleanupFailed: cleanupFailed,
    preserved: [
      'association',
      'currentAdmin',
      'roles',
      'authentication',
      'mfa',
      'auditLogs',
      'financeIdentity',
    ],
  })
})
