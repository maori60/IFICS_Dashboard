import type { Prisma } from '../../generated/prisma/client'

type Tx = Prisma.TransactionClient

export type FullInstanceResetResult = {
  deleted: Record<string, number>
  storedFiles: string[]
}

/**
 * Supprime les données fonctionnelles d'une association.
 *
 * CONSERVE volontairement :
 * - Association
 * - Role
 * - User
 * - AuthSession
 * - données MFA portées par User
 * - AuditLog
 *
 * IMPORTANT :
 * les CRA contiennent plusieurs FK ON DELETE RESTRICT.
 * Leur ordre de suppression est donc explicite.
 */
export async function fullInstanceReset(
  tx: Tx,
  associationId: string,
  actorUserId: string,
): Promise<FullInstanceResetResult> {
  const deleted: Record<string, number> = {}
  const storedFiles = new Set<string>()

  const rememberFile = (
    filePath: string | null | undefined,
  ) => {
    if (filePath) {
      storedFiles.add(filePath)
    }
  }

  const remember = (
    name: string,
    result: { count: number },
  ) => {
    deleted[name] = result.count
  }

  /*
   * Les fichiers sont uniquement COLLECTES ici.
   * Leur suppression physique sera faite après le commit DB.
   */
  const [
    craDocumentsForCleanup,
    projectDocumentsForCleanup,
    intervenorDocumentsForCleanup,
    accountingDocumentsForCleanup,
    projectReportsForCleanup,
    expenseAttachmentsForCleanup,
    projectProposalsForCleanup,
    jobApplicationsForCleanup,
    softwareVersionsForCleanup,
    hrTrainingsForCleanup,
    hrContractsForCleanup,
  ] = await Promise.all([
    tx.craDocument.findMany({
      where: {
        report: { associationId },
      },
      select: { filePath: true },
    }),
    tx.projectDocument.findMany({
      where: {
        project: { associationId },
      },
      select: { filePath: true },
    }),
    tx.intervenorDocument.findMany({
      where: {
        intervenor: { associationId },
      },
      select: { filePath: true },
    }),
    tx.intervenorAccountingDocument.findMany({
      where: {
        intervenor: { associationId },
      },
      select: { filePath: true },
    }),
    tx.projectReport.findMany({
      where: {
        project: { associationId },
      },
      select: { pdfPath: true },
    }),
    tx.expenseAttachment.findMany({
      where: {
        expense: { associationId },
      },
      select: { filePath: true },
    }),
    tx.projectProposal.findMany({
      where: { associationId },
      select: { attachmentPath: true },
    }),
    tx.jobApplication.findMany({
      where: {
        opening: { associationId },
      },
      select: { cvPath: true },
    }),
    tx.softwareVersion.findMany({
      where: {
        software: { associationId },
      },
      select: { filePath: true },
    }),
    tx.hrTraining.findMany({
      where: {
        profile: { associationId },
      },
      select: { certificatePath: true },
    }),
    tx.hrContract.findMany({
      where: { associationId },
      select: { pdfPath: true },
    }),
  ])

  for (const row of craDocumentsForCleanup) {
    rememberFile(row.filePath)
  }

  for (const row of projectDocumentsForCleanup) {
    rememberFile(row.filePath)
  }

  for (const row of intervenorDocumentsForCleanup) {
    rememberFile(row.filePath)
  }

  for (const row of accountingDocumentsForCleanup) {
    rememberFile(row.filePath)
  }

  for (const row of projectReportsForCleanup) {
    rememberFile(row.pdfPath)
  }

  for (const row of expenseAttachmentsForCleanup) {
    rememberFile(row.filePath)
  }

  for (const row of projectProposalsForCleanup) {
    rememberFile(row.attachmentPath)
  }

  for (const row of jobApplicationsForCleanup) {
    rememberFile(row.cvPath)
  }

  for (const row of softwareVersionsForCleanup) {
    rememberFile(row.filePath)
  }

  for (const row of hrTrainingsForCleanup) {
    rememberFile(row.certificatePath)
  }

  for (const row of hrContractsForCleanup) {
    rememberFile(row.pdfPath)
  }

  /*
   * ============================================================
   * CRA
   * ============================================================
   *
   * Ordre obligatoire à cause des FK RESTRICT :
   *
   * CraClientDecision
   *   -> CraClientAccess
   *   -> CraDocument
   *   -> CraDay
   *   -> CraReport
   *   -> ProjectIntervenor
   */

  const craReports = await tx.craReport.findMany({
    where: { associationId },
    select: { id: true },
  })

  const craReportIds = craReports.map((row) => row.id)

  if (craReportIds.length > 0) {
    remember(
      'CraClientDecision',
      await tx.craClientDecision.deleteMany({
        where: {
          reportId: { in: craReportIds },
        },
      }),
    )

    remember(
      'CraClientAccess',
      await tx.craClientAccess.deleteMany({
        where: {
          reportId: { in: craReportIds },
        },
      }),
    )

    /*
     * CraDocument possède une auto-relation RESTRICT
     * sourceDocumentId -> CraDocument.
     *
     * On casse uniquement cette relation interne avant suppression.
     */
    await tx.craDocument.updateMany({
      where: {
        reportId: { in: craReportIds },
        sourceDocumentId: { not: null },
      },
      data: {
        sourceDocumentId: null,
      },
    })

    remember(
      'CraDocument',
      await tx.craDocument.deleteMany({
        where: {
          reportId: { in: craReportIds },
        },
      }),
    )

    remember(
      'CraDay',
      await tx.craDay.deleteMany({
        where: {
          reportId: { in: craReportIds },
        },
      }),
    )

    remember(
      'CraReport',
      await tx.craReport.deleteMany({
        where: {
          associationId,
        },
      }),
    )
  }

  /*
   * ============================================================
   * FACTURATION / COMPTABILITE
   * ============================================================
   */

  remember(
    'BillingPayment',
    await tx.billingPayment.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'BillingDocument',
    await tx.billingDocument.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'BillingSequence',
    await tx.billingSequence.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'Expense',
    await tx.expense.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'AccountingPeriod',
    await tx.accountingPeriod.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'AccountingFiscalYear',
    await tx.accountingFiscalYear.deleteMany({
      where: { associationId },
    }),
  )

  /*
   * ============================================================
   * MODULES METIER
   * ============================================================
   *
   * Les enfants possédant ON DELETE CASCADE disparaissent avec
   * leur parent.
   */

  /*
   * TicketProgress ne possède pas associationId.
   * On le supprime via les tickets appartenant à l'association.
   */
  const supportTickets = await tx.supportTicket.findMany({
    where: { associationId },
    select: { id: true },
  })

  const supportTicketIds = supportTickets.map((row) => row.id)

  if (supportTicketIds.length > 0) {
    remember(
      'TicketProgress',
      await tx.ticketProgress.deleteMany({
        where: {
          ticketId: { in: supportTicketIds },
        },
      }),
    )
  }

  remember(
    'SupportTicket',
    await tx.supportTicket.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'TicketSequence',
    await tx.ticketSequence.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'CmsEntry',
    await tx.cmsEntry.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'Partner',
    await tx.partner.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'ProjectPublication',
    await tx.projectPublication.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'IntervenorPublicProfile',
    await tx.intervenorPublicProfile.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'ProjectProposal',
    await tx.projectProposal.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'ContactRequest',
    await tx.contactRequest.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'JobOpening',
    await tx.jobOpening.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'SoftwareItem',
    await tx.softwareItem.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'SoftwareCategory',
    await tx.softwareCategory.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'RndProject',
    await tx.rndProject.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'WorkTask',
    await tx.workTask.deleteMany({
      where: { associationId },
    }),
  )

  /*
   * ============================================================
   * RH / PARC
   * ============================================================
   */

  remember(
    'HrContract',
    await tx.hrContract.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'ContractTemplate',
    await tx.contractTemplate.deleteMany({
      where: { associationId },
    }),
  )

  /*
   * HrProfile peut avoir plusieurs enfants CASCADE.
   */
  const hrProfiles = await tx.hrProfile.findMany({
    where: { associationId },
    select: { id: true },
  })

  const hrProfileIds = hrProfiles.map((row) => row.id)

  if (hrProfileIds.length > 0) {
    remember(
      'HrEmploymentDetail',
      await tx.hrEmploymentDetail.deleteMany({
        where: {
          profileId: { in: hrProfileIds },
        },
      }),
    )
  }

  remember(
    'HrProfile',
    await tx.hrProfile.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'JobPosition',
    await tx.jobPosition.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'Department',
    await tx.department.deleteMany({
      where: { associationId },
    }),
  )

  const assets = await tx.asset.findMany({
    where: { associationId },
    select: { id: true },
  })

  const assetIds = assets.map((row) => row.id)

  if (assetIds.length > 0) {
    const assetDocuments = await tx.assetDocument.findMany({
      where: {
        assetId: { in: assetIds },
      },
      select: { filePath: true },
    })

    for (const row of assetDocuments) {
      rememberFile(row.filePath)
    }

    remember(
      'AssetDocument',
      await tx.assetDocument.deleteMany({
        where: {
          assetId: { in: assetIds },
        },
      }),
    )
  }

  remember(
    'Asset',
    await tx.asset.deleteMany({
      where: { associationId },
    }),
  )

  /*
   * ============================================================
   * PROJETS / INTERVENANTS / CLIENTS
   * ============================================================
   */

  remember(
    'ProjectIntervenor',
    await tx.projectIntervenor.deleteMany({
      where: {
        project: {
          associationId,
        },
      },
    }),
  )

  remember(
    'Project',
    await tx.project.deleteMany({
      where: { associationId },
    }),
  )

  /*
   * Un utilisateur conservé peut être rattaché à un Client.
   * Il faut donc détacher cette référence AVANT de supprimer
   * les clients.
   */
  await tx.user.updateMany({
    where: {
      associationId,
      clientId: { not: null },
    },
    data: {
      clientId: null,
    },
  })

  remember(
    'Client',
    await tx.client.deleteMany({
      where: { associationId },
    }),
  )

  /*
   * Un compte admin peut éventuellement posséder un profil
   * intervenant. Le reset des données métier doit supprimer
   * le profil sans supprimer le User.
   */
  remember(
    'Intervenor',
    await tx.intervenor.deleteMany({
      where: { associationId },
    }),
  )

  /*
   * ============================================================
   * CONFIGURATION FONCTIONNELLE
   * ============================================================
   */

  remember(
    'SystemSetting',
    await tx.systemSetting.deleteMany({
      where: { associationId },
    }),
  )

  remember(
    'MfaResetRequest',
    await tx.mfaResetRequest.deleteMany({
      where: { associationId },
    }),
  )


  /*
   * ============================================================
   * COMPTES
   * ============================================================
   *
   * Le compte ADMIN ayant déclenché le reset est conservé afin
   * de ne jamais verrouiller l'instance.
   *
   * Son MFA est porté par User et reste donc également conservé.
   * Les rôles et l'historique AuditLog sont conservés.
   */

  remember(
    'Notification',
    await tx.notification.deleteMany({
      where: {
        user: { associationId },
      },
    }),
  )

  remember(
    'PasswordResetToken',
    await tx.passwordResetToken.deleteMany({
      where: {
        user: { associationId },
      },
    }),
  )

  remember(
    'AuthSessionOtherUsers',
    await tx.authSession.deleteMany({
      where: {
        user: {
          associationId,
          id: { not: actorUserId },
        },
      },
    }),
  )

  remember(
    'User',
    await tx.user.deleteMany({
      where: {
        associationId,
        id: { not: actorUserId },
      },
    }),
  )

  /*
   * NE PAS supprimer ici :
   *
   * Association
   * AssociationFinanceSettings
   * Role
   * User
   * AuthSession
   * AuditLog
   *
   * AssociationFinanceSettings est volontairement conservé
   * jusqu'à décision explicite sur identité légale / banque /
   * TVA. Le reset technique existant pourra ensuite remettre
   * ses paramètres techniques à zéro.
   */

  return {
    deleted,
    storedFiles: [...storedFiles],
  }
}
