import { success } from '../../utils/api'
import {
  requireActiveCraClientAccess,
  setCraClientNoStoreHeaders,
} from '../../utils/cra-client-access'

export default defineEventHandler(async (event) => {
  setCraClientNoStoreHeaders(event)

  const access
    = await requireActiveCraClientAccess(
      event,
    )

  const report
    = access.document.report

  const canConfirm
    = access.purpose
      === 'INITIAL_CONFIRMATION'

  return success({
    access: {
      purpose:
        access.purpose,

      expiresAt:
        access.expiresAt,

      canViewDocument:
        true,

      canDownloadDocument:
        true,

      canConfirm,
    },

    report: {
      year:
        report.year,

      month:
        report.month,

      project: {
        reference:
          report.assignment.project
            .reference,

        title:
          report.assignment.project
            .title,
      },

      intervenor: {
        firstName:
          report.assignment.intervenor
            .firstName,

        lastName:
          report.assignment.intervenor
            .lastName,
      },
    },

    document: {
      reference:
        access.document.reference,

      status:
        access.document.status,

      originalName:
        access.document.originalName,

      mimeType:
        access.document.mimeType,

      fileSize:
        access.document.fileSize
          .toString(),
    },
  })
})
