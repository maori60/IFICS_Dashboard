import { prisma } from './prisma'
import { sendMail } from './mail'

export type NotificationInput = {
  type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ACTION' | 'SECURITY'
  title: string
  message: string
  href?: string | null
  email?: boolean
}

export async function notifyUser(userId: string, input: NotificationInput): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, status: true },
  })

  if (!user || user.status !== 'ACTIVE') return

  await prisma.notification.create({
    data: {
      userId,
      type: input.type || 'INFO',
      title: input.title.slice(0, 180),
      message: input.message,
      href: input.href?.slice(0, 500) || null,
    },
  })

  if (input.email) {
    try {
      await sendMail({
        to: user.email,
        subject: input.title,
        text: `${input.message}${input.href ? `\n\n${input.href}` : ''}`,
      })
    }
    catch (error) {
      console.error(JSON.stringify({
        level: 'error', event: 'notification_email_failed', userId,
        error: error instanceof Error ? error.message : String(error),
      }))
    }
  }
}

export async function notifyRoles(associationId: string, roleCodes: string[], input: NotificationInput): Promise<void> {
  const users = await prisma.user.findMany({
    where: { associationId, status: 'ACTIVE', role: { code: { in: roleCodes } } },
    select: { id: true },
  })
  await Promise.all(users.map(user => notifyUser(user.id, input)))
}

export async function notifyClientUsers(clientId: string, input: NotificationInput): Promise<void> {
  const users = await prisma.user.findMany({
    where: { clientId, status: 'ACTIVE' },
    select: { id: true },
  })
  await Promise.all(users.map(user => notifyUser(user.id, input)))
}
