import { randomUUID } from 'node:crypto'
import { resolveStoredPath } from '../../server/utils/files'
import { mkdtemp, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { defineEventHandler, type H3Event } from 'h3'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PERMISSIONS } from '../../server/utils/constants'

const request = vi.hoisted(() => ({
  reportId: '',
  associationId: '',
  userId: '',
  intervenorId: null as string | null,
  roleCode: 'ADMIN',
  permissions: [] as string[],
  body: {} as Record<string, unknown>,
}))

const audit = vi.hoisted(() => vi.fn())
const notifyRoles = vi.hoisted(() => vi.fn())
const notifyUser = vi.hoisted(() => vi.fn())
const responseHeaders = vi.hoisted(() => vi.fn())

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    getRouterParam: () => request.reportId,
    readBody: async () => request.body,
    setHeader: responseHeaders,
  }
})

vi.mock('../../server/utils/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/utils/auth')>()

  const context = () => ({
    sessionId: 'report-security-test',
    userId: request.userId,
    associationId: request.associationId,
    intervenorId: request.intervenorId,
    clientId: null,
    roleCode: request.roleCode,
    roleName: request.roleCode,
    permissions: request.permissions,
    email: 'test@example.invalid',
    firstName: 'Test',
    lastName: 'IFICS',
    mfaEnabled: true,
    mfaVerified: true,
    mfaSetupRequired: false,
  })

  return {
    ...actual,
    requirePermission: async (_event: H3Event, permission: string) => {
      if (!request.permissions.includes('*')
        && !request.permissions.includes(permission)) {
        const error = new Error('Accès interdit') as Error & {
          statusCode: number
        }
        error.statusCode = 403
        throw error
      }
      return context()
    },
  }
})

vi.mock('../../server/utils/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/utils/audit')>()
  return {
    ...actual,
    writeAuditLog: audit,
  }
})

vi.mock('../../server/utils/notifications', () => ({
  notifyRoles,
  notifyUser,
}))

describe.skipIf(process.env.REPORT_INTEGRATION_TESTS !== '1')(
  'Sécurité des routes de bilans IFICS',
  () => {
    const associationId = `report-security-${randomUUID()}`
    const event = {
      context: {
        requestId: 'report-api-security-test',
      },
      node: {
        req: {
          headers: {},
          socket: {},
        },
      },
    } as unknown as H3Event

    const originalUploadDir = process.env.UPLOAD_DIR
    let temporaryUploadDir: string | null = null

    let prisma: typeof import('../../server/utils/prisma')['prisma']
    let save: typeof import('../../server/api/reports/[id]/save.post')['default']
    let submit: typeof import('../../server/api/reports/[id]/submit.post')['default']
    let review: typeof import('../../server/api/reports/[id]/review.post')['default']
    let downloadPdf: typeof import('../../server/api/reports/[id]/pdf.get')['default']
    let downloadArchivePdf: typeof import('../../server/api/reports/archives/[id]/pdf.get')['default']

    let adminId: string
    let intervenorUserId: string
    let intervenorId: string

    function asAdmin() {
      request.roleCode = 'ADMIN'
      request.userId = adminId
      request.intervenorId = null
      request.permissions = ['*']
    }

    function asIntervenor() {
      request.roleCode = 'INTERVENOR'
      request.userId = intervenorUserId
      request.intervenorId = intervenorId
      request.permissions = [
        PERMISSIONS.REPORT_READ,
        PERMISSIONS.REPORT_WRITE,
        PERMISSIONS.PROJECT_READ,
      ]
    }

    async function snapshot() {
      return prisma.projectReport.findUniqueOrThrow({
        where: { id: request.reportId },
        include: { versions: { orderBy: { version: 'asc' } } },
      })
    }

    async function expectDenied(
      handler: typeof save | typeof submit,
      status: number,
    ) {
      const before = await snapshot()
      const audits = audit.mock.calls.length
      const notifications = notifyRoles.mock.calls.length
        + notifyUser.mock.calls.length

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: status,
      })

      const after = await snapshot()
      expect(after).toEqual(before)
      expect(audit).toHaveBeenCalledTimes(audits)
      expect(
        notifyRoles.mock.calls.length + notifyUser.mock.calls.length,
      ).toBe(notifications)
    }

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL || '')
      if (url.hostname !== 'db' || url.pathname !== '/ifics_test') {
        throw new Error('Tests interdits hors de ifics_test')
      }

      temporaryUploadDir = await mkdtemp(
        join(tmpdir(), 'ifics-report-api-security-'),
      )

      const normalUploadDir = resolve(
        originalUploadDir || join(process.cwd(), 'uploads'),
      )

      if (resolve(temporaryUploadDir) === normalUploadDir) {
        throw new Error('Stockage temporaire non isolé')
      }

      process.env.UPLOAD_DIR = temporaryUploadDir

      vi.stubGlobal('defineEventHandler', defineEventHandler)

      prisma = (await import('../../server/utils/prisma')).prisma
      save = (await import('../../server/api/reports/[id]/save.post')).default
      submit = (await import('../../server/api/reports/[id]/submit.post')).default
      review = (await import('../../server/api/reports/[id]/review.post')).default
      downloadPdf = (await import('../../server/api/reports/[id]/pdf.get')).default
      downloadArchivePdf = (await import('../../server/api/reports/archives/[id]/pdf.get')).default

      request.associationId = associationId

      await prisma.association.create({
        data: { id: associationId, name: 'IFICS TEST SECURITE' },
      })

      const adminRole = await prisma.role.create({
        data: {
          associationId,
          name: 'Administrateur test',
          code: 'ADMIN',
          permissions: ['*'],
        },
      })

      const intervenorRole = await prisma.role.create({
        data: {
          associationId,
          name: 'Intervenant test',
          code: 'INTERVENOR',
          permissions: [PERMISSIONS.REPORT_WRITE, PERMISSIONS.PROJECT_READ],
        },
      })

      const admin = await prisma.user.create({
        data: {
          associationId,
          roleId: adminRole.id,
          firstName: 'Admin',
          lastName: 'Test',
          email: `${randomUUID()}@example.invalid`,
          passwordHash: 'test-only',
        },
      })
      adminId = admin.id

      const user = await prisma.user.create({
        data: {
          associationId,
          roleId: intervenorRole.id,
          firstName: 'Intervenant',
          lastName: 'Test',
          email: `${randomUUID()}@example.invalid`,
          passwordHash: 'test-only',
        },
      })
      intervenorUserId = user.id

      const intervenor = await prisma.intervenor.create({
        data: {
          associationId,
          userId: user.id,
          firstName: 'Intervenant',
          lastName: 'Test',
          email: `${randomUUID()}@example.invalid`,
        },
      })
      intervenorId = intervenor.id

      const project = await prisma.project.create({
        data: {
          associationId,
          title: 'Projet test sécurité des bilans',
          status: 'IN_PROGRESS',
          classification: 'INTERNAL',
        },
      })

      await prisma.projectIntervenor.create({
        data: {
          projectId: project.id,
          intervenorId,
        },
      })

      const report = await prisma.projectReport.create({
        data: {
          projectId: project.id,
          intervenorId,
          sessionDate: new Date('2026-10-10T12:00:00.000Z'),
          status: 'NOT_STARTED',
        },
      })

      request.reportId = report.id
    })

    afterAll(async () => {
      try {
        if (
          associationId.startsWith('report-security-')
          && prisma
        ) {
          await prisma.projectReportArchive.deleteMany({
            where: {
              report: {
                project: {
                  associationId,
                },
              },
            },
          })

          await prisma.association.deleteMany({
            where: { id: associationId },
          })
        }
      }
      finally {
        try {
          vi.unstubAllGlobals()
          await prisma?.$disconnect()
        }
        finally {
          if (originalUploadDir === undefined) {
            delete process.env.UPLOAD_DIR
          }
          else {
            process.env.UPLOAD_DIR = originalUploadDir
          }

          if (temporaryUploadDir) {
            await rm(temporaryUploadDir, {
              recursive: true,
              force: true,
            })
          }
        }
      }
    })

    it('refuse les accès depuis une autre association', async () => {
      asAdmin()
      request.associationId = `other-${randomUUID()}`
      request.body = { content: 'Tentative externe' }

      try {
        await expectDenied(save, 404)
        await expectDenied(submit, 404)

        request.body = { status: 'VALIDATED' }
        await expect(review(event)).rejects.toMatchObject({
          statusCode: 404,
        })
      }
      finally {
        request.associationId = associationId
      }
    })

    it('refuse la modification par un autre intervenant', async () => {
      asIntervenor()
      request.intervenorId = `other-${randomUUID()}`
      request.body = { content: 'Modification non autorisée' }

      try {
        await expectDenied(save, 403)
        await expectDenied(submit, 403)
      }
      finally {
        request.intervenorId = intervenorId
      }
    })

    it('refuse la validation sans permission de revue', async () => {
      asIntervenor()
      request.body = { status: 'VALIDATED' }

      const before = await snapshot()

      await expect(review(event)).rejects.toMatchObject({
        statusCode: 403,
      })

      expect(await snapshot()).toEqual(before)
    })

    it('protège les bilans des projets confidentiels', async () => {
      asIntervenor()
      request.body = { content: 'Accès confidentiel interdit' }

      const original = await prisma.projectReport.findUniqueOrThrow({
        where: { id: request.reportId },
        select: { projectId: true },
      })

      await prisma.project.update({
        where: { id: original.projectId },
        data: { classification: 'CONFIDENTIAL' },
      })

      try {
        await expectDenied(save, 403)
        await expectDenied(submit, 403)
      }
      finally {
        await prisma.project.update({
          where: { id: original.projectId },
          data: { classification: 'INTERNAL' },
        })
      }
    })

    it('protège le cycle complet de révision IFICS', async () => {
      asIntervenor()
      request.body = { content: 'Version initiale' }

      await save(event)
      expect((await snapshot()).currentVersion).toBe(1)

      responseHeaders.mockClear()
      const provisionalPdf = await downloadPdf(event)

      expect(Buffer.isBuffer(provisionalPdf)).toBe(true)
      expect(Buffer.from(provisionalPdf).subarray(0, 5).toString())
        .toBe('%PDF-')
      expect(responseHeaders).toHaveBeenCalledWith(
        event, 'Content-Type', 'application/pdf',
      )

      await submit(event)
      expect((await snapshot()).status).toBe('SUBMITTED')

      await expectDenied(save, 409)

      asAdmin()
      request.body = { content: 'Révision administrative IFICS' }
      await save(event)

      let report = await snapshot()
      expect(report.status).toBe('IN_PROGRESS')
      expect(report.revisionByIfics).toBe(true)
      expect(report.currentVersion).toBe(2)
      expect(report.versions.map(v => v.content)).toEqual([
        'Version initiale',
        'Révision administrative IFICS',
      ])

      asIntervenor()
      request.body = { content: 'Modification interdite' }
      await expectDenied(save, 403)
      await expectDenied(submit, 403)

      asAdmin()
      await submit(event)
      expect((await snapshot()).status).toBe('SUBMITTED')

      request.body = {
        status: 'REFUSED',
        refusalReason: 'Compléter les observations.',
      }
      await review(event)

      report = await snapshot()
      expect(report.status).toBe('REFUSED')
      expect(report.revisionByIfics).toBe(false)

      asIntervenor()
      request.body = { content: 'Correction après refus' }
      await save(event)

      report = await snapshot()
      expect(report.currentVersion).toBe(3)
      expect(report.versions).toHaveLength(3)

      await submit(event)

      asAdmin()
      request.body = { status: 'VALIDATED' }
      await review(event)

      report = await snapshot()
      expect(report.status).toBe('VALIDATED')
      expect(report.validatedAt).not.toBeNull()

      request.body = { content: 'Modification après validation' }
      await expectDenied(save, 409)
      await expectDenied(submit, 409)

      expect(notifyRoles).toHaveBeenCalledTimes(3)
      expect(notifyUser).toHaveBeenCalledTimes(2)
      expect(audit).toHaveBeenCalledTimes(7)

      const auditActions = audit.mock.calls.map(
        call => call[2]?.action,
      )

      expect(auditActions).toEqual([
        'REPORT_VERSION_SAVED',
        'REPORT_SUBMITTED',
        'REPORT_VERSION_SAVED',
        'REPORT_SUBMITTED',
        'REPORT_REVIEWED',
        'REPORT_VERSION_SAVED',
        'REPORT_SUBMITTED',
      ])

      const officialArchive = await prisma.projectReportArchive.findMany({
        where: { reportId: request.reportId },
      })

      expect(officialArchive).toHaveLength(1)
      expect(officialArchive[0]?.version).toBe(report.currentVersion)

      const archive = officialArchive[0]!
      const archivePath = resolveStoredPath(archive.filePath)
      const originalPdf = await readFile(archivePath)

      responseHeaders.mockClear()
      const officialPdf = await downloadPdf(event)

      expect(Buffer.from(officialPdf).equals(originalPdf)).toBe(true)

      // ACTIVE_PDF_AUDIT_INTEGRATION_STEP_233
      // Un PDF officiel sur projet actif doit être audité.
      const activePdfAudits = await prisma.auditLog.findMany({
        where: {
          associationId,
          entityId: archive.id,
          action: 'REPORT_OFFICIAL_ARCHIVE_DOWNLOADED',
        },
      })

      expect(activePdfAudits).toHaveLength(1)
      expect(activePdfAudits[0]?.metadata).toMatchObject({
        reportId: request.reportId,
        projectId: report.projectId,
        version: archive.version,
        reference: archive.reference,
      })

      // Si l'audit échoue, aucun PDF officiel ne doit être transmis.
      responseHeaders.mockClear()

      const activePdfAuditSpy = vi.spyOn(prisma.auditLog, 'create')
        .mockRejectedValueOnce(new Error('SIMULATED_ACTIVE_PDF_AUDIT_FAILURE'))

      try {
        await expect(downloadPdf(event)).rejects.toThrow(
          'SIMULATED_ACTIVE_PDF_AUDIT_FAILURE',
        )

        expect(responseHeaders).not.toHaveBeenCalled()
      }
      finally {
        activePdfAuditSpy.mockRestore()
      }

      // La récupération du service d'audit restaure le téléchargement.
      const recoveredActivePdf = await downloadPdf(event)
      expect(Buffer.from(recoveredActivePdf).equals(originalPdf)).toBe(true)
      expect(responseHeaders).toHaveBeenCalledWith(
        event, 'Content-Type', 'application/pdf',
      )
      expect(responseHeaders).toHaveBeenCalledWith(
        event, 'Cache-Control', 'private, no-store',
      )
      expect(responseHeaders).toHaveBeenCalledWith(
        event, 'X-Content-Type-Options', 'nosniff',
      )
      expect(responseHeaders).toHaveBeenCalledWith(
        event,
        'Content-Disposition',
        expect.stringContaining('bilan-officiel-'),
      )

      asIntervenor()
      request.intervenorId = 'other-intervenor'

      try {
        await expect(downloadPdf(event)).rejects.toMatchObject({
          statusCode: 403,
        })
      }
      finally {
        request.intervenorId = intervenorId
      }

      asAdmin()
      request.associationId = 'other-association'

      try {
        await expect(downloadPdf(event)).rejects.toMatchObject({
          statusCode: 404,
        })
      }
      finally {
        request.associationId = associationId
      }

      request.permissions = []

      try {
        await expect(downloadPdf(event)).rejects.toMatchObject({
          statusCode: 403,
        })
      }
      finally {
        asAdmin()
      }

      request.roleCode = 'CLIENT'
      request.permissions = [PERMISSIONS.REPORT_READ]

      try {
        await expect(downloadPdf(event)).rejects.toMatchObject({
          statusCode: 404,
        })
      }
      finally {
        asAdmin()
      }

      const modifiedPdf = Buffer.from(originalPdf)
      modifiedPdf[modifiedPdf.length - 1] ^= 1

      try {
        await writeFile(archivePath, modifiedPdf)

        await expect(downloadPdf(event)).rejects.toMatchObject({
          statusCode: 409,
        })
      }
      finally {
        await writeFile(archivePath, originalPdf)
      }

      const verifiedPdf = await downloadPdf(event)
      expect(Buffer.from(verifiedPdf).equals(originalPdf)).toBe(true)

      // Le lien symbolique ne doit jamais être suivi,
      // même si sa cible contient exactement le PDF attendu.
      const externalPdfPath = archivePath + '.external-test'

      await writeFile(externalPdfPath, originalPdf)

      try {
        await unlink(archivePath)
        await symlink(externalPdfPath, archivePath)

        await expect(downloadPdf(event)).rejects.toMatchObject({
          statusCode: 409,
        })
      }
      finally {
        await unlink(archivePath)
        await writeFile(archivePath, originalPdf)
        await unlink(externalPdfPath)
      }

      const restoredPdf = await downloadPdf(event)
      expect(Buffer.from(restoredPdf).equals(originalPdf)).toBe(true)


      // ARCHIVE_DOWNLOAD_INTEGRATION_STEP_223
      // Les contrôles sont exécutés sur le projet temporaire de ce test.
      const archivedProject = await prisma.projectReport.findUniqueOrThrow({
        where: { id: request.reportId },
        select: { projectId: true },
      })

      const archivedProjectId = archivedProject.projectId

      // La route archives doit refuser un projet encore actif.
      asAdmin()
      await expect(downloadArchivePdf(event)).rejects.toMatchObject({
        statusCode: 404,
      })

      // ARCHIVE_AUDIT_COUNT_STEP_238
      // Compter les téléchargements déjà audités sur le projet actif.
      // ARCHIVE_AUDIT_DETERMINISTIC_STEP_239
      const auditsBeforeArchiveDownload = await prisma.auditLog.findMany({
        where: {
          associationId,
          entityId: archive.id,
          action: 'REPORT_OFFICIAL_ARCHIVE_DOWNLOADED',
        },
        select: { id: true },
      })

      const previousAuditIds = new Set(
        auditsBeforeArchiveDownload.map(entry => entry.id),
      )

      await prisma.project.update({
        where: { id: archivedProjectId },
        data: { archivedAt: new Date() },
      })

      try {
        responseHeaders.mockClear()

        const archivedPdf = await downloadArchivePdf(event)
        expect(Buffer.from(archivedPdf).equals(originalPdf)).toBe(true)

        expect(responseHeaders).toHaveBeenCalledWith(
          event, 'Cache-Control', 'private, no-store',
        )

        const downloadAudits = await prisma.auditLog.findMany({
          where: {
            associationId,
            entityId: archive.id,
            action: 'REPORT_OFFICIAL_ARCHIVE_DOWNLOADED',
          },
        })

        expect(downloadAudits).toHaveLength(
          auditsBeforeArchiveDownload.length + 1,
        )

        const newDownloadAudits = downloadAudits.filter(
          entry => !previousAuditIds.has(entry.id),
        )

        expect(newDownloadAudits).toHaveLength(1)
        expect(newDownloadAudits[0]?.metadata).toMatchObject({
          reportId: request.reportId,
          projectId: archivedProjectId,
          version: archive.version,
          reference: archive.reference,
        })

        request.associationId = 'other-association'

        try {
          await expect(downloadArchivePdf(event)).rejects.toMatchObject({
            statusCode: 404,
          })
        }
        finally {
          request.associationId = associationId
        }

        asIntervenor()
        request.permissions = [
          PERMISSIONS.REPORT_ARCHIVE_READ,
          PERMISSIONS.REPORT_READ,
        ]

        await expect(downloadArchivePdf(event)).rejects.toMatchObject({
          statusCode: 403,
        })

        asAdmin()
        request.roleCode = 'MANAGER'
        request.permissions = [
          PERMISSIONS.REPORT_ARCHIVE_READ,
          PERMISSIONS.REPORT_READ,
        ]

        const managerPdf = await downloadArchivePdf(event)
        expect(Buffer.from(managerPdf).equals(originalPdf)).toBe(true)

        // ARCHIVE_INTEGRITY_CASES_STEP_225

        // Une permission de lecture ne remplace pas la permission archives.
        request.permissions = [PERMISSIONS.REPORT_READ]

        await expect(downloadArchivePdf(event)).rejects.toMatchObject({
          statusCode: 403,
        })

        // La permission archives seule est également insuffisante.
        request.permissions = [PERMISSIONS.REPORT_ARCHIVE_READ]

        await expect(downloadArchivePdf(event)).rejects.toMatchObject({
          statusCode: 403,
        })

        request.permissions = [
          PERMISSIONS.REPORT_ARCHIVE_READ,
          PERMISSIONS.REPORT_READ,
        ]

        const auditsBeforeFailures = await prisma.auditLog.count({
          where: {
            associationId,
            entityId: archive.id,
            action: 'REPORT_OFFICIAL_ARCHIVE_DOWNLOADED',
          },
        })

        // Un PDF modifié doit être rejeté sans être transmis.
        const corruptedPdf = Buffer.from(originalPdf)
        corruptedPdf[corruptedPdf.length - 1] ^= 1

        try {
          await writeFile(archivePath, corruptedPdf)

          await expect(downloadArchivePdf(event)).rejects.toMatchObject({
            statusCode: 409,
          })
        }
        finally {
          await writeFile(archivePath, originalPdf)
        }

        // Un fichier absent ne doit pas être régénéré automatiquement.
        try {
          await unlink(archivePath)

          await expect(downloadArchivePdf(event)).rejects.toMatchObject({
            statusCode: 409,
          })
        }
        finally {
          await writeFile(archivePath, originalPdf)
        }

        // Une incohérence de chemin doit être détectée.
        try {
          await prisma.projectReport.update({
            where: { id: request.reportId },
            data: { pdfPath: 'reports/invalid/archive.pdf' },
          })

          await expect(downloadArchivePdf(event)).rejects.toMatchObject({
            statusCode: 409,
          })
        }
        finally {
          await prisma.projectReport.update({
            where: { id: request.reportId },
            data: { pdfPath: archive.filePath },
          })
        }

        const auditsAfterFailures = await prisma.auditLog.count({
          where: {
            associationId,
            entityId: archive.id,
            action: 'REPORT_OFFICIAL_ARCHIVE_DOWNLOADED',
          },
        })

        expect(auditsAfterFailures).toBe(auditsBeforeFailures)

        // Le document reste accessible après restauration.
        const recoveredArchivePdf = await downloadArchivePdf(event)
        expect(Buffer.from(recoveredArchivePdf).equals(originalPdf)).toBe(true)


        // ARCHIVE_AUDIT_FAIL_CLOSED_STEP_227
        // Une panne d'audit doit interdire la transmission du PDF.
        responseHeaders.mockClear()

        const auditCreateSpy = vi.spyOn(prisma.auditLog, 'create')
          .mockRejectedValueOnce(new Error('SIMULATED_AUDIT_FAILURE'))

        try {
          await expect(downloadArchivePdf(event)).rejects.toThrow(
            'SIMULATED_AUDIT_FAILURE',
          )

          expect(responseHeaders).not.toHaveBeenCalled()
        }
        finally {
          auditCreateSpy.mockRestore()
        }

        // Après restauration de l'audit, le téléchargement fonctionne.
        const pdfAfterAuditRecovery = await downloadArchivePdf(event)
        expect(Buffer.from(pdfAfterAuditRecovery).equals(originalPdf)).toBe(true)

        await prisma.project.update({
          where: { id: archivedProjectId },
          data: { classification: 'CONFIDENTIAL' },
        })

        try {
          await expect(downloadArchivePdf(event)).rejects.toMatchObject({
            statusCode: 403,
          })

          request.permissions.push(
            PERMISSIONS.PROJECT_CONFIDENTIAL_READ,
          )

          const confidentialPdf = await downloadArchivePdf(event)
          expect(Buffer.from(confidentialPdf).equals(originalPdf)).toBe(true)
        }
        finally {
          await prisma.project.update({
            where: { id: archivedProjectId },
            data: { classification: 'INTERNAL' },
          })
        }
      }
      finally {
        asAdmin()
        await prisma.project.update({
          where: { id: archivedProjectId },
          data: { archivedAt: null },
        })
      }

      // INTEGRITY_CASES_STEP_196
      // Simulations réversibles exclusivement sur le bilan de test.
      const originalReport = await prisma.projectReport.findUniqueOrThrow({
        where: { id: request.reportId },
        select: {
          pdfPath: true,
          currentVersion: true,
          status: true,
        },
      })

      expect(originalReport.status).toBe('VALIDATED')
      expect(originalReport.pdfPath).toBe(archive.filePath)
      expect(originalReport.currentVersion).toBe(archive.version)

      async function expectArchiveConflict(
        data: { pdfPath?: string | null, currentVersion?: number },
      ) {
        try {
          await prisma.projectReport.update({
            where: { id: request.reportId },
            data,
          })

          await expect(downloadPdf(event)).rejects.toMatchObject({
            statusCode: 409,
          })
        }
        finally {
          await prisma.projectReport.update({
            where: { id: request.reportId },
            data: {
              pdfPath: originalReport.pdfPath,
              currentVersion: originalReport.currentVersion,
            },
          })
        }

        const recovered = await downloadPdf(event)
        expect(Buffer.from(recovered).equals(originalPdf)).toBe(true)
      }

      await expectArchiveConflict({ pdfPath: null })

      await expectArchiveConflict({
        pdfPath: 'reports/invalid/another-document.pdf',
      })

      await expectArchiveConflict({
        currentVersion: archive.version + 1,
      })

      // Le fichier archivé disparaît temporairement.
      // Il doit être refusé sans régénération automatique.
      await unlink(archivePath)

      try {
        await expect(downloadPdf(event)).rejects.toMatchObject({
          statusCode: 409,
        })
      }
      finally {
        await writeFile(archivePath, originalPdf)
      }

      const recoveredAfterMissingFile = await downloadPdf(event)
      expect(Buffer.from(recoveredAfterMissingFile).equals(originalPdf))
        .toBe(true)


      const officialAudits = await prisma.auditLog.findMany({
        where: {
          associationId,
          entityId: request.reportId,
          action: 'REPORT_REVIEWED',
        },
      })

      expect(officialAudits).toHaveLength(1)
      expect(officialAudits[0]?.metadata).toMatchObject({
        status: 'VALIDATED',
        version: report.currentVersion,
      })

      const archiveAudits = await prisma.auditLog.findMany({
        where: {
          associationId,
          entityId: officialArchive[0]!.id,
          action: 'REPORT_OFFICIAL_ARCHIVED',
        },
      })

      expect(archiveAudits).toHaveLength(1)
      expect(archiveAudits[0]?.metadata).toMatchObject({
        reportId: request.reportId,
        version: report.currentVersion,
        reference: officialArchive[0]!.reference,
        sha256: officialArchive[0]!.sha256,
      })
    })
  },
)
