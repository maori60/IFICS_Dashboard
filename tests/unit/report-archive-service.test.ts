import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import type { AuthContext } from '../../server/utils/auth'
import { validateAndArchiveOfficialReport } from '../../server/utils/report-archive-service'

const mocks = vi.hoisted(() => ({
  findSource: vi.fn(),
  buildState: vi.fn(),
  buildSnapshot: vi.fn(),
  generatePdf: vi.fn(),
  storePdf: vi.fn(),
  removeFile: vi.fn(),
  commit: vi.fn(),
}))

vi.mock('../../server/utils/report-archive-reader', () => ({
  findReportArchiveSource: mocks.findSource,
}))

vi.mock('../../server/utils/report-archive-state', () => ({
  reportArchiveStateFromSource: mocks.buildState,
}))

vi.mock('../../server/utils/report-archive-source', () => ({
  buildReportArchiveFromSource: mocks.buildSnapshot,
}))

vi.mock('../../server/utils/report-archive-pdf', () => ({
  generateOfficialReportPdf: mocks.generatePdf,
}))

vi.mock('../../server/utils/files', () => ({
  storePdf: mocks.storePdf,
  removeStoredFile: mocks.removeFile,
}))

vi.mock('../../server/utils/report-archive-transaction', () => ({
  commitOfficialReportArchive: mocks.commit,
}))


describe('Service d’archivage officiel des bilans', () => {
  const context = {
    associationId: 'association-test',
    userId: 'user-test',
  } as AuthContext

  const event = {} as H3Event

  const source = { id: 'report-test' }
  const state = { currentVersion: 1 }
  const snapshot = {
    reportId: 'report-test',
    reference: 'IFICS-BILAN-2026-TEST',
  }
  const stored = {
    filePath: 'reports/report-test/archive.pdf',
    sha256: 'a'.repeat(64),
  }
  const archive = { id: 'archive-test' }

  beforeEach(() => {
    vi.clearAllMocks()

    mocks.findSource.mockResolvedValue(source)
    mocks.buildState.mockReturnValue(state)
    mocks.buildSnapshot.mockReturnValue(snapshot)
    mocks.generatePdf.mockResolvedValue(
      new Uint8Array([37, 80, 68, 70]),
    )
    mocks.storePdf.mockResolvedValue(stored)
    mocks.removeFile.mockResolvedValue(undefined)
    mocks.commit.mockResolvedValue(archive)
  })

  it('conserve le PDF après une validation réussie', async () => {
    const result = await validateAndArchiveOfficialReport({
      event,
      context,
      reportId: 'report-test',
    })

    expect(result).toBe(archive)
    expect(mocks.storePdf).toHaveBeenCalledOnce()
    expect(mocks.commit).toHaveBeenCalledOnce()
    expect(mocks.removeFile).not.toHaveBeenCalled()
  })

  it('supprime le PDF lorsque la transaction échoue', async () => {
    const failure = new Error('Transaction refusée')
    mocks.commit.mockRejectedValue(failure)

    await expect(
      validateAndArchiveOfficialReport({
        event,
        context,
        reportId: 'report-test',
      }),
    ).rejects.toBe(failure)

    expect(mocks.removeFile).toHaveBeenCalledExactlyOnceWith(
      stored.filePath,
    )
  })

  it('préserve l’erreur initiale si le nettoyage échoue', async () => {
    const failure = new Error('Conflit de validation')
    mocks.commit.mockRejectedValue(failure)
    mocks.removeFile.mockRejectedValue(
      new Error('Suppression impossible'),
    )

    const consoleSpy = vi.spyOn(console, 'error')
      .mockImplementation(() => {})

    try {
      await expect(
        validateAndArchiveOfficialReport({
          event,
          context,
          reportId: 'report-test',
        }),
      ).rejects.toBe(failure)

      expect(consoleSpy).toHaveBeenCalledWith(
        'REPORT_OFFICIAL_FILE_CLEANUP_FAILED',
        expect.objectContaining({
          reportId: 'report-test',
          filePath: stored.filePath,
        }),
      )
    }
    finally {
      consoleSpy.mockRestore()
    }
  })

  it('ne stocke aucun fichier si le PDF ne peut pas être généré', async () => {
    mocks.generatePdf.mockRejectedValue(
      new Error('Génération PDF impossible'),
    )

    await expect(
      validateAndArchiveOfficialReport({
        event,
        context,
        reportId: 'report-test',
      }),
    ).rejects.toThrow('Génération PDF impossible')

    expect(mocks.storePdf).not.toHaveBeenCalled()
    expect(mocks.commit).not.toHaveBeenCalled()
    expect(mocks.removeFile).not.toHaveBeenCalled()
  })
})
