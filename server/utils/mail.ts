import nodemailer from 'nodemailer'

export type MailMessage = {
  to: string
  subject: string
  text: string
  html?: string
}

function smtpPort(): number {
  const value = Number(process.env.SMTP_PORT || 587)
  return Number.isInteger(value) && value > 0 && value <= 65535 ? value : 587
}

export function isMailEnabled(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim())
}

export async function sendMail(message: MailMessage): Promise<boolean> {
  const host = process.env.SMTP_HOST?.trim()

  if (!host) {
    return false
  }

  const transporter = nodemailer.createTransport({
    host,
    port: smtpPort(),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD || '',
        }
      : undefined,
  })

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'IFICS Dashboard <no-reply@localhost>',
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  })

  return true
}
