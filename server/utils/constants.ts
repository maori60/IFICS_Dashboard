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
  CLIENT_READ: 'client:read', CLIENT_WRITE: 'client:write',
  PROJECT_READ: 'project:read', PROJECT_WRITE: 'project:write', PROJECT_ASSIGN: 'project:assign',
  INTERVENOR_READ: 'intervenor:read', INTERVENOR_WRITE: 'intervenor:write',
  DOCUMENT_READ: 'document:read', DOCUMENT_WRITE: 'document:write', DOCUMENT_REVIEW: 'document:review',
  REPORT_READ: 'report:read', REPORT_WRITE: 'report:write', REPORT_REVIEW: 'report:review',
  BILLING_READ: 'billing:read', BILLING_WRITE: 'billing:write',
  NOTIFICATION_READ: 'notification:read', USER_MANAGE: 'user:manage', SETTINGS_MANAGE: 'settings:manage', AUDIT_READ: 'audit:read',
  TICKET_READ: 'ticket:read', TICKET_WRITE: 'ticket:write', TICKET_MANAGE: 'ticket:manage',
  CONTENT_READ: 'content:read', CONTENT_WRITE: 'content:write', CONTENT_PUBLISH: 'content:publish',
  PARTNER_READ: 'partner:read', PARTNER_WRITE: 'partner:write',
  RND_READ: 'rnd:read', RND_WRITE: 'rnd:write',
  IT_READ: 'it:read', IT_WRITE: 'it:write',
  HR_READ: 'hr:read', HR_WRITE: 'hr:write',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const SYSTEM_ROLES: Record<RoleCode, { name: string; description: string; permissions: Permission[] }> = {
  ADMIN: { name: 'Administrateur', description: 'Accès complet à l’instance IFICS.', permissions: [PERMISSIONS.ALL] },
  MANAGER: {
    name: 'Gestionnaire', description: 'Gestion opérationnelle de la plateforme IFICS.', permissions: [
      PERMISSIONS.DASHBOARD_READ, PERMISSIONS.CLIENT_READ, PERMISSIONS.CLIENT_WRITE,
      PERMISSIONS.PROJECT_READ, PERMISSIONS.PROJECT_WRITE, PERMISSIONS.PROJECT_ASSIGN,
      PERMISSIONS.INTERVENOR_READ, PERMISSIONS.INTERVENOR_WRITE,
      PERMISSIONS.DOCUMENT_READ, PERMISSIONS.DOCUMENT_WRITE, PERMISSIONS.DOCUMENT_REVIEW,
      PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_WRITE, PERMISSIONS.REPORT_REVIEW,
      PERMISSIONS.BILLING_READ, PERMISSIONS.BILLING_WRITE, PERMISSIONS.NOTIFICATION_READ,
      PERMISSIONS.TICKET_READ, PERMISSIONS.TICKET_WRITE, PERMISSIONS.TICKET_MANAGE,
      PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_WRITE, PERMISSIONS.CONTENT_PUBLISH,
      PERMISSIONS.PARTNER_READ, PERMISSIONS.PARTNER_WRITE, PERMISSIONS.RND_READ, PERMISSIONS.RND_WRITE,
      PERMISSIONS.IT_READ, PERMISSIONS.IT_WRITE, PERMISSIONS.HR_READ, PERMISSIONS.HR_WRITE,
    ],
  },
  CLIENT: {
    name: 'Client', description: 'Accès aux informations explicitement partagées avec le client.', permissions: [
      PERMISSIONS.DASHBOARD_READ, PERMISSIONS.CLIENT_READ, PERMISSIONS.PROJECT_READ, PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.REPORT_READ, PERMISSIONS.BILLING_READ, PERMISSIONS.NOTIFICATION_READ, PERMISSIONS.TICKET_READ, PERMISSIONS.TICKET_WRITE,
    ],
  },
  INTERVENOR: {
    name: 'Intervenant', description: 'Accès aux missions et documents propres à l’intervenant.', permissions: [
      PERMISSIONS.DASHBOARD_READ, PERMISSIONS.PROJECT_READ, PERMISSIONS.INTERVENOR_READ,
      PERMISSIONS.DOCUMENT_READ, PERMISSIONS.DOCUMENT_WRITE, PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_WRITE,
      PERMISSIONS.NOTIFICATION_READ, PERMISSIONS.TICKET_READ, PERMISSIONS.TICKET_WRITE,
    ],
  },
}

export const MFA_REQUIRED_ROLE_CODES = new Set<RoleCode>([
  ROLE_CODES.ADMIN,
  ROLE_CODES.MANAGER,
  ROLE_CODES.INTERVENOR,
])

export const SESSION_COOKIE_DEFAULT = 'ifics_session'
export const SESSION_TTL_HOURS_DEFAULT = 12
export const MAX_LOGIN_ATTEMPTS = 5
export const LOGIN_WINDOW_MINUTES = 15
