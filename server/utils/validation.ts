import { createError } from 'h3'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/
const SIRET_PATTERN = /^\d{14}$/
const IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/

export function badRequest(message: string, code = 'VALIDATION_ERROR'): never {
  throw createError({
    statusCode: 400,
    statusMessage: message,
    data: { code },
  })
}

export function requiredString(
  value: unknown,
  label: string,
  options: { min?: number; max?: number } = {},
): string {
  const text = typeof value === 'string' ? value.trim() : ''
  const min = options.min ?? 1
  const max = options.max ?? 10_000

  if (text.length < min) {
    badRequest(`${label} est obligatoire.`)
  }

  if (text.length > max) {
    badRequest(`${label} dépasse la longueur maximale autorisée (${max}).`)
  }

  return text
}

export function optionalString(
  value: unknown,
  label: string,
  options: { max?: number } = {},
): string | null {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const text = String(value).trim()
  const max = options.max ?? 10_000

  if (!text) {
    return null
  }

  if (text.length > max) {
    badRequest(`${label} dépasse la longueur maximale autorisée (${max}).`)
  }

  return text
}

export function requiredEmail(value: unknown, label = 'Email'): string {
  const email = requiredString(value, label, { max: 255 }).toLowerCase()

  if (!EMAIL_PATTERN.test(email)) {
    badRequest(`${label} invalide.`)
  }

  return email
}

export function optionalEmail(value: unknown, label = 'Email'): string | null {
  const email = optionalString(value, label, { max: 255 })?.toLowerCase() ?? null

  if (email && !EMAIL_PATTERN.test(email)) {
    badRequest(`${label} invalide.`)
  }

  return email
}

export function requiredEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  const candidate = String(value ?? '').trim() as T

  if (!allowed.includes(candidate)) {
    badRequest(`${label} invalide.`)
  }

  return candidate
}

export function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T | null {
  if (value === undefined || value === null || value === '') {
    return null
  }

  return requiredEnum(value, allowed, label)
}

export function optionalDate(value: unknown, label: string): Date | null {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const date = new Date(String(value))

  if (Number.isNaN(date.getTime())) {
    badRequest(`${label} invalide.`)
  }

  return date
}

export function optionalInteger(
  value: unknown,
  label: string,
  options: { min?: number; max?: number } = {},
): number | null {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const number = Number(value)

  if (!Number.isInteger(number)) {
    badRequest(`${label} doit être un nombre entier.`)
  }

  if (options.min !== undefined && number < options.min) {
    badRequest(`${label} doit être supérieur ou égal à ${options.min}.`)
  }

  if (options.max !== undefined && number > options.max) {
    badRequest(`${label} doit être inférieur ou égal à ${options.max}.`)
  }

  return number
}

export function requiredPositiveNumber(value: unknown, label: string): number {
  const number = Number(value)

  if (!Number.isFinite(number) || number <= 0) {
    badRequest(`${label} doit être un nombre strictement positif.`)
  }

  return number
}

export function optionalMoney(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const number = Number(value)

  if (!Number.isFinite(number) || number < 0) {
    badRequest(`${label} doit être un montant positif.`)
  }

  if (number > 999_999_999.99) {
    badRequest(`${label} dépasse le montant maximal autorisé.`)
  }

  return number.toFixed(2)
}

export function requiredMoney(value: unknown, label: string): string {
  const amount = optionalMoney(value, label)

  if (amount === null) {
    badRequest(`${label} est obligatoire.`)
  }

  return amount
}

export function normalizeSiret(value: unknown): string | null {
  const raw = optionalString(value, 'SIRET', { max: 30 })

  if (!raw) {
    return null
  }

  const normalized = raw.replace(/\s/g, '')

  if (!SIRET_PATTERN.test(normalized)) {
    badRequest('Le SIRET doit contenir 14 chiffres.')
  }

  return normalized
}

export function normalizeIban(value: unknown): string | null {
  const raw = optionalString(value, 'IBAN', { max: 50 })

  if (!raw) {
    return null
  }

  const normalized = raw.replace(/\s/g, '').toUpperCase()

  if (!IBAN_PATTERN.test(normalized)) {
    badRequest('IBAN invalide.')
  }

  return normalized
}

export function normalizeBic(value: unknown): string | null {
  const raw = optionalString(value, 'BIC', { max: 20 })
  return raw ? raw.replace(/\s/g, '').toUpperCase() : null
}

export function optionalHexColor(value: unknown, label: string): string | null {
  const raw = optionalString(value, label, { max: 20 })

  if (raw && !HEX_COLOR_PATTERN.test(raw)) {
    badRequest(`${label} doit être une couleur hexadécimale, par exemple #2563EB.`)
  }

  return raw
}

export function stringArray(value: unknown, label: string, maxItems = 100): string[] {
  if (!Array.isArray(value)) {
    badRequest(`${label} doit être une liste.`)
  }

  if (value.length > maxItems) {
    badRequest(`${label} contient trop d’éléments.`)
  }

  return [...new Set(value.map(item => requiredString(item, label, { max: 100 })))]
}

export function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    badRequest('Corps de requête invalide.')
  }

  return value as Record<string, unknown>
}
