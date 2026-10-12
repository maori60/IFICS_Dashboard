import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const base = 'server/api/reports/[id]'

function source(name: string) {
  return readFileSync(`${base}/${name}`, 'utf8')
}

describe('Sécurité du cycle de vie des bilans', () => {
  it('verrouille les bilans transmis et validés', () => {
    const code = source('save.post.ts')
    expect(code).toContain("report.status === 'SUBMITTED'")
    expect(code).toContain("report.status === 'VALIDATED'")
    expect(code).toContain("'REPORT_LOCKED'")
  })

  it('protège la sauvegarde contre les modifications concurrentes', () => {
    const code = source('save.post.ts')
    expect(code).toContain('prisma.$transaction')
    expect(code).toContain('tx.projectReport.updateMany')
    expect(code).toContain('currentVersion: report.currentVersion')
    expect(code).toContain('updated.count !== 1')
    expect(code).toContain('tx.projectReportVersion.create')
  })

  it('limite la transmission aux bilans en cours', () => {
    const code = source('submit.post.ts')
    expect(code).toContain("report.status !== 'IN_PROGRESS'")
    expect(code).toContain("status: 'IN_PROGRESS'")
    expect(code).toContain('transition.count !== 1')
  })

  it('limite la validation aux bilans soumis', () => {
    const code = source('review.post.ts')
    expect(code).toContain("status: 'SUBMITTED'")
    expect(code).toContain('transition.count !== 1')
  })

  it('conserve les notifications et les audits', () => {
    const submit = source('submit.post.ts')
    const review = source('review.post.ts')
    expect(submit).toContain('await notifyRoles(')
    expect(submit).toContain("'REPORT_SUBMITTED'")
    expect(review).toContain('await notifyUser(')
    expect(review).toContain("'REPORT_REVIEWED'")
  })
})
