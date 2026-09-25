import {
  getRouterParam,
  readMultipartFormData,
} from 'h3'

import {
  ClamAvError,
  scanBufferWithClamAv,
} from '../../../utils/antivirus'

import {
  httpError,
  requireRouterId,
  success,
} from '../../../utils/api'

import { requireAuth } from '../../../utils/auth'

import {
  discardQuarantinedExpenseAttachment,
  promoteExpenseAttachment,
  quarantineExpenseAttachment,
  removeStoredFile,
} from '../../../utils/files'

import {
  requireExpenseAccess,
  requireExpenseCreator,
} from '../../../utils/expenses'

import { prisma } from '../../../utils/prisma'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  const expenseId = requireRouterId(
    getRouterParam(event, 'id'),
    'Dépense',
  )

  /*
   * Vérifie l'association et la visibilité avant même
   * de lire le multipart.
   */
  const expense
    = await requireExpenseAccess(
      context,
      expenseId,
    )

  /*
   * null = expense:manage
   * string = intervenant avec expense:write:own
   *
   * Cette valeur est réutilisée après le scan antivirus
   * pour revérifier le propriétaire sous verrou DB.
   */
  const ownIntervenorId
    = requireExpenseCreator(context)

  /*
   * Les justificatifs sont immuables dès la soumission.
   *
   * Même un manager doit rejeter la dépense avant de pouvoir
   * modifier ses pièces justificatives.
   */
  const allowedStatuses = new Set<string>([
    'DRAFT',
    'REJECTED',
  ])

  if (
    !allowedStatuses.has(
      expense.status,
    )
  ) {
    httpError(
      409,
      'Il n’est plus possible d’ajouter un justificatif à cette dépense.',
      'EXPENSE_ATTACHMENT_STATUS_LOCKED',
    )
  }

  const parts
    = await readMultipartFormData(event)

  if (!parts) {
    httpError(
      400,
      'Formulaire de dépôt invalide.',
      'EXPENSE_ATTACHMENT_MULTIPART_REQUIRED',
    )
  }

  const files = parts.filter(
    part => part.name === 'file',
  )

  if (
    files.length !== 1
    || !files[0]?.filename
    || !files[0].data?.length
  ) {
    httpError(
      400,
      'Un seul justificatif est requis.',
      'EXPENSE_ATTACHMENT_FILE_REQUIRED',
    )
  }

  const unexpectedParts
    = parts.filter(
      part => part.name !== 'file',
    )

  if (
    unexpectedParts.length > 0
  ) {
    httpError(
      400,
      'Le formulaire contient un champ non autorisé.',
      'EXPENSE_ATTACHMENT_UNEXPECTED_FIELD',
    )
  }

  const file = files[0]

  /*
   * La validation du contenu réel est effectuée
   * avant même le scan antivirus.
   */
  const quarantined
    = await quarantineExpenseAttachment(
      expenseId,
      file.filename!,
      file.data,
    )

  let scanResult:
    Awaited<
      ReturnType<
        typeof scanBufferWithClamAv
      >
    >

  try {
    scanResult
      = await scanBufferWithClamAv(
        file.data,
      )
  }
  catch (error) {
    await discardQuarantinedExpenseAttachment(
      quarantined,
    )

    await writeAuditLog(
      event,
      context,
      {
        action:
          'EXPENSE_ATTACHMENT_SCAN_FAILED',

        outcome:
          'FAILURE',

        entityType:
          'Expense',

        entityId:
          expenseId,

        metadata: {
          originalName:
            quarantined.originalName,

          sha256:
            quarantined.sha256,

          errorCode:
            error instanceof ClamAvError
              ? error.code
              : 'UNKNOWN',
        },
      },
    )

    httpError(
      503,
      'Le contrôle antivirus est temporairement indisponible. Le justificatif n’a pas été conservé.',
      error instanceof ClamAvError
        ? error.code
        : 'CLAMAV_SCAN_ERROR',
    )
  }

  if (
    scanResult.status
    === 'INFECTED'
  ) {
    await discardQuarantinedExpenseAttachment(
      quarantined,
    )

    await writeAuditLog(
      event,
      context,
      {
        action:
          'EXPENSE_ATTACHMENT_INFECTED',

        outcome:
          'FAILURE',

        entityType:
          'Expense',

        entityId:
          expenseId,

        metadata: {
          originalName:
            quarantined.originalName,

          sha256:
            quarantined.sha256,

          antivirusSignature:
            scanResult.signature,
        },
      },
    )

    httpError(
      422,
      'Le justificatif a été refusé par le contrôle antivirus et n’a pas été conservé.',
      'EXPENSE_ATTACHMENT_INFECTED',
    )
  }

  /*
   * Le scan antivirus peut durer plusieurs secondes.
   *
   * Pendant ce délai, la dépense peut être soumise,
   * archivée ou réaffectée par une autre requête.
   *
   * On verrouille donc la ligne Expense APRÈS le scan
   * avec SELECT ... FOR UPDATE, puis on rejoue les
   * contraintes critiques avant de sortir le fichier
   * de quarantaine.
   *
   * Une soumission concurrente attendra la fin de cette
   * transaction. Si elle a déjà gagné la course, nous
   * verrons le nouveau statut et refuserons le dépôt.
   */
  let attachment

  let attachmentExpenseStatus:
    typeof expense.status

  try {
    const persisted
      = await prisma.$transaction(
        async (tx) => {
          const lockedExpenses
            = await tx.$queryRaw<Array<{
              id: string
              associationId: string
              intervenorId: string | null
              archivedAt: Date | null
              status: typeof expense.status
            }>>`
              SELECT
                "id",
                "associationId",
                "intervenorId",
                "archivedAt",
                "status"::text AS "status"
              FROM "Expense"
              WHERE "id" = ${expenseId}
              FOR UPDATE
            `

          const lockedExpense
            = lockedExpenses[0]

          /*
           * La ressource existait et était visible au début
           * du dépôt. Si ces propriétés ont changé pendant
           * le scan, on traite cela comme un conflit.
           */
          if (
            !lockedExpense
            || lockedExpense.associationId
              !== context.associationId
            || lockedExpense.archivedAt
              !== null
            || (
              ownIntervenorId !== null
              && lockedExpense.intervenorId
                !== ownIntervenorId
            )
          ) {
            httpError(
              409,
              'La dépense a été modifiée simultanément. Actualisez la page.',
              'EXPENSE_ATTACHMENT_CONFLICT',
            )
          }

          /*
           * Point critique TOCTOU :
           * le statut est revérifié sous verrou.
           */
          if (
            !allowedStatuses.has(
              lockedExpense.status,
            )
          ) {
            httpError(
              409,
              'Il n’est plus possible d’ajouter un justificatif à cette dépense.',
              'EXPENSE_ATTACHMENT_STATUS_LOCKED',
            )
          }

          /*
           * Le fichier ne quitte la quarantaine qu'après
           * validation du statut verrouillé.
           */
          const stored
            = await promoteExpenseAttachment(
              quarantined,
            )

          const created
            = await tx.expenseAttachment.create({
              data: {
                expenseId,

                uploadedByUserId:
                  context.userId,

                originalName:
                  stored.originalName,

                storedName:
                  stored.storedName,

                filePath:
                  stored.filePath,

                mimeType:
                  stored.mimeType,

                fileSize:
                  stored.fileSize,

                sha256:
                  stored.sha256,
              },

              select: {
                id: true,
                expenseId: true,
                uploadedByUserId: true,

                originalName: true,
                mimeType: true,
                fileSize: true,
                sha256: true,

                createdAt: true,
              },
            })

          return {
            attachment:
              created,

            expenseStatus:
              lockedExpense.status,
          }
        },
      )

    attachment
      = persisted.attachment

    attachmentExpenseStatus
      = persisted.expenseStatus
  }
  catch (error) {
    /*
     * Selon le moment où l'erreur survient, le fichier
     * peut être :
     *
     * - encore en quarantaine ;
     * - déjà promu dans le stockage final.
     *
     * removeStoredFile() est idempotent sur ENOENT :
     * on peut donc nettoyer les deux emplacements.
     */
    for (
      const filePath
      of [
        quarantined.quarantinePath,
        quarantined.finalPath,
      ]
    ) {
      try {
        await removeStoredFile(
          filePath,
        )
      }
      catch (cleanupError) {
        console.error(
          JSON.stringify({
            level:
              'error',

            event:
              'expense_attachment_cleanup_failed',

            expenseId,

            filePath,

            error:
              cleanupError
              instanceof Error
                ? cleanupError.message
                : String(cleanupError),
          }),
        )
      }
    }

    throw error
  }

  await writeAuditLog(
    event,
    context,
    {
      action:
        'EXPENSE_ATTACHMENT_UPLOADED',

      entityType:
        'ExpenseAttachment',

      entityId:
        attachment.id,

      metadata: {
        expenseId,

        expenseStatus:
          attachmentExpenseStatus,

        originalName:
          attachment.originalName,

        mimeType:
          attachment.mimeType,

        fileSize:
          attachment.fileSize
            .toString(),

        sha256:
          attachment.sha256,

        antivirusStatus:
          'CLEAN',
      },
    },
  )

  return success({
    ...attachment,

    fileSize:
      attachment.fileSize
        .toString(),
  })
})
