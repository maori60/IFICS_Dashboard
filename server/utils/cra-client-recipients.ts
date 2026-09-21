import { prisma } from './prisma'

export type CraClientRecipient = {
  email: string
  normalizedEmail: string

  clientId: string
  clientName: string

  contactId: string | null
  contactFirstName: string | null
  contactLastName: string | null
  isPrimary: boolean
}

export function normalizeCraClientEmail(
  value: string,
): string {
  return value.trim().toLowerCase()
}

export async function getCraClientRecipients(
  projectId: string,
  associationId: string,
): Promise<Map<string, CraClientRecipient>> {
  const projectClients
    = await prisma.projectClient.findMany({
      where: {
        projectId,

        client: {
          associationId,
          status: 'ACTIVE',
          archivedAt: null,
        },
      },

      select: {
        clientId: true,

        client: {
          select: {
            id: true,
            name: true,
            email: true,

            contacts: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                isPrimary: true,
              },
            },
          },
        },
      },
    })

  const recipients
    = new Map<string, CraClientRecipient>()

  for (const projectClient of projectClients) {
    const client = projectClient.client

    if (client.email) {
      const normalizedEmail
        = normalizeCraClientEmail(
          client.email,
        )

      recipients.set(
        normalizedEmail,
        {
          email: client.email,
          normalizedEmail,

          clientId: client.id,
          clientName: client.name,

          contactId: null,
          contactFirstName: null,
          contactLastName: null,
          isPrimary: false,
        },
      )
    }

    for (const contact of client.contacts) {
      if (!contact.email) continue

      const normalizedEmail
        = normalizeCraClientEmail(
          contact.email,
        )

      recipients.set(
        normalizedEmail,
        {
          email: contact.email,
          normalizedEmail,

          clientId: client.id,
          clientName: client.name,

          contactId: contact.id,
          contactFirstName:
            contact.firstName,
          contactLastName:
            contact.lastName,
          isPrimary:
            contact.isPrimary,
        },
      )
    }
  }

  return recipients
}
