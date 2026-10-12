import { describe, expect, it, vi } from 'vitest'
import {
  isReportArchiveRetryableError,
  retryReportArchiveTransaction,
} from '../../server/utils/report-archive-retry'

describe('Reprise des transactions d’archivage', () => {
  it('reconnaît P2034', () => {
    expect(isReportArchiveRetryableError({ code: 'P2034' })).toBe(true)
  })

  it('reconnaît le conflit de l’adaptateur PostgreSQL', () => {
    expect(isReportArchiveRetryableError({
      name: 'DriverAdapterError',
      cause: { kind: 'TransactionWriteConflict' },
    })).toBe(true)
  })

  it('ne réessaie pas une violation d’unicité', () => {
    expect(isReportArchiveRetryableError({ code: 'P2002' })).toBe(false)
  })

  it('ne réessaie pas un conflit métier HTTP', () => {
    expect(isReportArchiveRetryableError({
      statusCode: 409,
      data: { code: 'REPORT_ARCHIVE_CONFLICT' },
    })).toBe(false)
  })

  it('ne réessaie pas une erreur inconnue', () => {
    expect(isReportArchiveRetryableError(new Error('unexpected'))).toBe(false)
  })

  it('réussit après un conflit transitoire', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockResolvedValueOnce('ARCHIVE_OK')

    await expect(
      retryReportArchiveTransaction(operation, { delayMs: 0 }),
    ).resolves.toBe('ARCHIVE_OK')

    expect(operation).toHaveBeenCalledTimes(2)
  })

  it('arrête après trois tentatives', async () => {
    const conflict = { code: 'P2034' }
    const operation = vi.fn().mockRejectedValue(conflict)

    await expect(
      retryReportArchiveTransaction(operation, { delayMs: 0 }),
    ).rejects.toBe(conflict)

    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('ne relance jamais P2002', async () => {
    const duplicate = { code: 'P2002' }
    const operation = vi.fn().mockRejectedValue(duplicate)

    await expect(
      retryReportArchiveTransaction(operation, { delayMs: 0 }),
    ).rejects.toBe(duplicate)

    expect(operation).toHaveBeenCalledTimes(1)
  })


  it('ne réessaie pas une erreur HTTP même avec un code P2034', () => {
    expect(isReportArchiveRetryableError({
      statusCode: 409,
      code: 'P2034',
      data: { code: 'REPORT_ARCHIVE_CONFLICT' },
    })).toBe(false)
  })

  it('arrête après trois conflits de l’adaptateur', async () => {
    const conflict = {
      name: 'DriverAdapterError',
      cause: { kind: 'TransactionWriteConflict' },
    }

    const operation = vi.fn().mockRejectedValue(conflict)

    await expect(
      retryReportArchiveTransaction(operation, { delayMs: 0 }),
    ).rejects.toBe(conflict)

    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('ne relance jamais un conflit métier', async () => {
    const conflict = {
      statusCode: 409,
      data: { code: 'REPORT_ARCHIVE_CONFLICT' },
    }

    const operation = vi.fn().mockRejectedValue(conflict)

    await expect(
      retryReportArchiveTransaction(operation, { delayMs: 0 }),
    ).rejects.toBe(conflict)

    expect(operation).toHaveBeenCalledTimes(1)
  })
})
