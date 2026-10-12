import { randomBytes } from 'node:crypto'

/**
 * Référence publique d'un bilan officiel.
 *
 * - indépendante des informations personnelles ;
 * - indépendante du projet ;
 * - générée à partir d'un aléa cryptographique ;
 * - unicité garantie définitivement par PostgreSQL.
 */
export function generateReportArchiveReference(
  validatedAt: Date,
): string {
  if (Number.isNaN(validatedAt.getTime())) {
    throw new Error('Date de validation invalide')
  }

  const year = validatedAt.getUTCFullYear()
  const randomPart = randomBytes(12)
    .toString('hex')
    .toUpperCase()

  return `IFICS-BILAN-${year}-${randomPart}`
}
