import { readFile, writeFile } from 'node:fs/promises'

const path = 'prisma/schema.prisma'
let schema = await readFile(path, 'utf8')

function replaceOnce(search, replacement, label) {
  if (!schema.includes(search)) throw new Error(`Schema anchor missing: ${label}`)
  schema = schema.replace(search, replacement)
}

replaceOnce(
`enum IntervenorDocumentStatus {
  PENDING
  ACCEPTED
  REFUSED
}`,
`enum IntervenorDocumentStatus {
  PENDING
  UNDER_REVIEW
  ACCEPTED
  REFUSED
  TO_RENEW
  EXPIRED
  ARCHIVED
}

enum DataClassification {
  PUBLIC
  INTERNAL
  CONFIDENTIAL
  RESTRICTED
}

enum MfaResetStatus {
  PENDING
  APPROVED
  USED
  REJECTED
  EXPIRED
}`,
'intervenor status enums',
)

replaceOnce(
`  currency          String   @default("EUR") @db.VarChar(3)
  createdAt         DateTime @default(now())`,
`  currency          String   @default("EUR") @db.VarChar(3)
  maintenanceEnabled Boolean  @default(false)
  maintenanceMessage String?
  maintenanceStartsAt DateTime?
  maintenanceEndsAt   DateTime?
  createdAt         DateTime @default(now())`,
'association maintenance fields',
)

replaceOnce(
`  status              ProjectStatus @default(DRAFT)
  internalComments    String?`,
`  status              ProjectStatus       @default(DRAFT)
  classification      DataClassification   @default(INTERNAL)
  internalComments    String?`,
'project classification',
)

replaceOnce(
`  version          Int                      @default(1)
  adminComment     String?
  archivedAt       DateTime?`,
`  version                Int                      @default(1)
  adminComment           String?
  issuedAt               DateTime?
  expiresAt              DateTime?
  lastExpiryReminderDays Int?
  archivedAt             DateTime?`,
'intervenor document expiry fields',
)

replaceOnce(
`  @@index([status])
  @@index([reviewedByUserId])
  @@index([archivedAt])
  @@index([sha256])
}

model IntervenorAccountingDocument`,
`  @@index([status])
  @@index([reviewedByUserId])
  @@index([archivedAt])
  @@index([expiresAt])
  @@index([sha256])
}

model IntervenorAccountingDocument`,
'intervenor expiry index',
)

if (!schema.includes('model MfaResetRequest {')) {
  schema += `

model MfaResetRequest {
  id               String         @id @default(cuid())
  associationId    String
  userId           String
  status           MfaResetStatus @default(PENDING)
  tokenHash        String?        @unique @db.VarChar(64)
  approvedByUserId String?
  requestedAt      DateTime       @default(now())
  approvedAt       DateTime?
  expiresAt        DateTime?
  usedAt           DateTime?
  rejectedAt       DateTime?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@index([associationId, status, requestedAt])
  @@index([userId, status])
  @@index([expiresAt])
}
`
}

await writeFile(path, schema)
