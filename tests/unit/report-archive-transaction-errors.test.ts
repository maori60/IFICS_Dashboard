import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { commitOfficialReportArchive } from '../../server/utils/report-archive-transaction'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}))

vi.mock('../../server/utils/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}))


describe('Erreurs de la transaction officielle', () => {
  beforeEach(() => {
    mocks.transaction.mockReset()
  })

  const execute = () =>
    commitOfficialReportArchive({
      event: {} as Parameters<typeof commitOfficialReportArchive>[0]['event'],
      context: {} as Parameters<typeof commitOfficialReportArchive>[0]['context'],
      snapshot: {} as Parameters<typeof commitOfficialReportArchive>[0]['snapshot'],
      expectedState: {} as Parameters<typeof commitOfficialReportArchive>[0]['expectedState'],
      stored: {} as Parameters<typeof commitOfficialReportArchive>[0]['stored'],
    })

  it('convertit trois conflits P2034 en HTTP 409', async () => {
    mocks.transaction.mockRejectedValue({ code: 'P2034' })

    await expect(execute()).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'REPORT_ARCHIVE_CONFLICT' },
    })

    expect(mocks.transaction).toHaveBeenCalledTimes(3)
  })

  it('convertit trois conflits DriverAdapterError en HTTP 409', async () => {
    mocks.transaction.mockRejectedValue({
      name: 'DriverAdapterError',
      cause: { kind: 'TransactionWriteConflict' },
    })

    await expect(execute()).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'REPORT_ARCHIVE_CONFLICT' },
    })

    expect(mocks.transaction).toHaveBeenCalledTimes(3)
  })

  it('ne réessaie pas une violation d’unicité P2002', async () => {
    mocks.transaction.mockRejectedValue({ code: 'P2002' })

    await expect(execute()).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'REPORT_ARCHIVE_DUPLICATE' },
    })

    expect(mocks.transaction).toHaveBeenCalledTimes(1)
  })

  it('préserve une erreur HTTP métier sans reprise', async () => {
    mocks.transaction.mockRejectedValue(createError({
      statusCode: 409,
      message: 'Le bilan a changé.',
      data: { code: 'REPORT_ARCHIVE_CONFLICT' },
    }))

    await expect(execute()).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'REPORT_ARCHIVE_CONFLICT' },
    })

    expect(mocks.transaction).toHaveBeenCalledTimes(1)
  })
})
