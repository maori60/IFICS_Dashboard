export const DEFAULT_ASSOCIATION_ID = 'assoc_default_ifics'

export const ROLE_CODES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  CLIENT: 'CLIENT',
  INTERVENOR: 'INTERVENOR',
} as const

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES]

export const PERMISSIONS = {
  ALL: '*',
  DASHBOARD_READ: 'dashboard:read',
  CLIENT_READ: 'client:read',
  CLIENT_WRITE: 'client:write',
  PROJECT_READ: 'project:read',
  PROJECT_WRITE: 'project:write',
  PROJECT_ASSIGN: 'project:assign',
  INTERVENOR_READ: 'intervenor:read',
  INTERVENOR_WRITE: 'intervenor:write',
  DOCUMENT_READ: 'document:read',
  DOCUMENT_WRITE: 'document:write',
  DOCUMENT_REVIEW: 'document:review',
  REPORT_READ: 'report:read',
  REPORT_WRITE: 'report:write',
  REPORT_REVIEW: 'report:review',
  BILLING_READ: 'billing:read',
  BILLING_WRITE: 'billing:write',
  NOTIFICATION_READ: 'notification:read',
  USER_MANAGE: 'user:manage',
  SETTINGS_MANAGE: 'settings:manage',
  AUDIT_READ: 'audit:read',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const SYSTEM_ROLES: Record<RoleCode, {
  name: string
  description: string
  permissions: Permission[]
}> = {
  ADMIN: {
    name: 'Administrateur',
    description: 'Accès complet à l’instance IFICS.',
    permissions: [PERMISSIONS.ALL],
  },
  MANAGER: {
    name: 'Gestionnaire',
    description: 'Gestion opérationnelle des clients, projets, intervenants et documents.',
    permissions: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.CLIENT_READ,
      PERMISSIONS.CLIENT_WRITE,
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.PROJECT_WRITE,
      PERMISSIONS.PROJECT_ASSIGN,
      PERMISSIONS.INTERVENOR_READ,
      PERMISSIONS.INTERVENOR_WRITE,
      PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.DOCUMENT_WRITE,
      PERMISSIONS.DOCUMENT_REVIEW,
      PERMISSIONS.REPORT_READ,
      PERMISSIONS.REPORT_WRITE,
      PERMISSIONS.REPORT_REVIEW,
      PERMISSIONS.BILLING_READ,
      PERMISSIONS.BILLING_WRITE,
      PERMISSIONS.NOTIFICATION_READ,
    ],
  },
  CLIENT: {
    name: 'Client',
    description: 'Accès en lecture aux projets, documents et factures rattachés au client.',
    permissions: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.CLIENT_READ,
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.REPORT_READ,
      PERMISSIONS.BILLING_READ,
      PERMISSIONS.NOTIFICATION_READ,
    ],
  },
  INTERVENOR: {
    name: 'Intervenant',
    description: 'Accès aux missions, documents et bilans de l’intervenant connecté.',
    permissions: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.INTERVENOR_READ,
      PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.DOCUMENT_WRITE,
      PERMISSIONS.REPORT_READ,
      PERMISSIONS.REPORT_WRITE,
      PERMISSIONS.NOTIFICATION_READ,
    ],
  },
}

export const MFA_REQUIRED_ROLE_CODES = new Set<RoleCode>([
  ROLE_CODES.ADMIN,
  ROLE_CODES.MANAGER,
])

export const SESSION_COOKIE_DEFAULT = 'ifics_session'
export const SESSION_TTL_HOURS_DEFAULT = 12
export const MAX_LOGIN_ATTEMPTS = 5
export const LOGIN_WINDOW_MINUTES = 15
