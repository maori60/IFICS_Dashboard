import {
  getRouterParam,
} from 'h3'

import {
  httpError,
  requireRouterId,
  success,
} from '../../../../utils/api'

import { requireAuth } from '../../../../utils/auth'
import { writeAuditLog } from '../../../../utils/audit'

import {
  requireExpenseAccess,
  requireExpenseCreator,
} from '../../../../utils/expenses'

import {
  removeStoredFile,
} from '../../../../utils/files'

import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  const expenseId = requireRouterId(
    getRouterParam(event, 'id'),
    'Dépense',
  )

  const attachmentId = requireRouterId(
    getRouterParam(
      event,
      'attachmentId',
    ),
    'Justificatif',
  )

  const expense
    = await requireExpenseAccess(
      context,
      expenseId,
    )

  /*
   * null = expense:manage
   * string = intervenant expense:write:own
   */
  const ownIntervenorId
    = requireExpenseCreator(context)

  /*
   * Une pièce justificative devient immuable dès SUBMITTED.
   *
   * Un manager doit d'abord rejeter la dépense pour rendre
   * ses justificatifs modifiables à nouveau.
   */
  const allowedStatuses = [
    'DRAFT',
    'REJECTED',
  ] as const

  if (
    !allowedStatuses.includes(
      expense.status as
        typeof allowedStatuses[number],
    )
  ) {
    httpError(
      409,
      'Il n’est plus possible de supprimer un justificatif de cette dépense.',
      'EXPENSE_ATTACHMENT_DELETE_STATUS_LOCKED',
    )
  }

  const attachment
    = await prisma.expenseAttachment.findFirst({
      where: {
        id: attachmentId,
        expenseId,
      },

      select: {
        id: true,
        uploadedByUserId: true,
        originalName: true,
        storedName: true,
        filePath: true,
        mimeType: true,
        fileSize: true,
        sha256: true,
      },
    })

  if (!attachment) {
    httpError(
      404,
      'Justificatif introuvable ou inaccessible.',
      'EXPENSE_ATTACHMENT_NOT_FOUND',
    )
  }

  /*
   * Le chemin physique doit correspondre exactement
   * au nom généré par le pipeline sécurisé.
   *
   * Cette vérification est effectuée avant toute
   * suppression en base ou sur le stockage.
   */
  const validStoredName
    = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/
      .test(
        attachment.storedName,
      )
      && attachment.storedName !== '.'
      && attachment.storedName !== '..'

  const expectedFilePath
    = `expenses/${expenseId}/attachments/${attachment.storedName}`

  if (
    !validStoredName
    || attachment.filePath
      !== expectedFilePath
  ) {
    httpError(
      409,
      'Le chemin du justificatif enregistré est invalide.',
      'EXPENSE_ATTACHMENT_INVALID_PATH',
    )
  }

  /*
   * Un intervenant peut retirer uniquement
   * les justificatifs qu'il a lui-même déposés.
   *
   * Cela évite qu'il supprime une pièce ajoutée
   * par IFICS / un manager.
   */
  if (
    ownIntervenorId !== null
    && attachment.uploadedByUserId
      !== context.userId
  ) {
    httpError(
      403,
      'Vous ne pouvez pas supprimer ce justificatif.',
      'EXPENSE_ATTACHMENT_DELETE_FORBIDDEN',
    )
  }

  /*
   * Le deleteMany rejoue les contraintes importantes
   * au moment exact de la suppression :
   *
   * - association ;
   * - propriétaire intervenant ;
   * - statut ;
   * - uploader.
   *
   * Cela réduit le risque TOCTOU entre les contrôles
   * précédents et la suppression.
   */
  const deleted
    = await prisma.expenseAttachment.deleteMany({
      where: {
        id: attachmentId,
        expenseId,

        ...(ownIntervenorId !== null
          ? {
              uploadedByUserId:
                context.userId,
            }
          : {}),

        expense: {
          associationId:
            context.associationId,

          archivedAt:
            null,

          status: {
            in: [
              ...allowedStatuses,
            ],
          },

          ...(ownIntervenorId !== null
            ? {
                intervenorId:
                  ownIntervenorId,
              }
            : {}),
        },
      },
    })

  if (deleted.count !== 1) {
    httpError(
      409,
      'Le justificatif ou la dépense a été modifié simultanément. Actualisez la page.',
      'EXPENSE_ATTACHMENT_DELETE_CONFLICT',
    )
  }

  let storageCleanup:
    | 'DELETED'
    | 'FAILED'
      = 'DELETED'

  try {
    await removeStoredFile(
      attachment.filePath,
    )
  }
  catch (error) {
    storageCleanup = 'FAILED'

    /*
     * La ligne DB est déjà supprimée :
     * le fichier n'est donc plus accessible depuis
     * l'application.
     *
     * On conserve une trace exploitable pour un futur
     * job de nettoyage des fichiers orphelins.
     */
    console.error(
      JSON.stringify({
        level:
          'error',

        event:
          'expense_attachment_file_cleanup_failed',

        expenseId,
        attachmentId,

        filePath:
          attachment.filePath,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      }),
    )
  }

  await writeAuditLog(
    event,
    context,
    {
      action:
        'EXPENSE_ATTACHMENT_DELETED',

      entityType:
        'ExpenseAttachment',

      entityId:
        attachment.id,

      metadata: {
        expenseId,

        expenseStatus:
          expense.status,

        originalName:
          attachment.originalName,

        mimeType:
          attachment.mimeType,

        fileSize:
          attachment.fileSize
            .toString(),

        sha256:
          attachment.sha256,

        storageCleanup,
      },
    },
  )

  return success({
    id:
      attachment.id,

    expenseId,

    deleted:
      true,

    storageCleanup,
  })
})
