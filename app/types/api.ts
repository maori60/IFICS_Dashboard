export type ApiSuccess<T> = { ok: true; data: T }

export type SessionUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  roleCode: string
  roleName: string
  permissions: string[]
  clientId: string | null
  intervenorId: string | null
}

export type SessionPayload = {
  user: SessionUser
  mfa: { enabled: boolean; verified: boolean; setupRequired: boolean }
  association: {
    id: string
    name: string
    logoUrl: string | null
    primaryColor: string | null
    secondaryColor: string | null
    locale: string
    timezone: string
    currency: string
  } | null
}

export type PublicProject = {
  id: string
  projectId: string
  slug: string
  title: string
  summary: string | null
  imageUrl: string | null
  territory: string | null
  status: string | null
  publishedAt: string | null
}

export type PublicContent = {
  id: string
  kind: string
  slug: string
  title: string
  excerpt: string | null
  heroImageUrl: string | null
  featured: boolean
  publishedAt: string | null
}

export type PublicPartner = {
  id: string
  name: string
  category: string
  description: string | null
  logoUrl: string | null
  websiteUrl: string | null
}
