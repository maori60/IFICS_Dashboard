import nodemailer from 'nodemailer'

export type MailAttachment = {
  filename: string
  content: Buffer
  contentType?: string
}

export type MailMessage = {
  to: string
  subject: string
  text: string
  html?: string
  from?: string
  replyTo?: string
  attachments?: MailAttachment[]
}

export type MailDeliveryResult = {
  delivered: boolean
  messageId: string | null
}

function smtpPort(): number {
  const value = Number(process.env.SMTP_PORT || 587)

  return Number.isInteger(value)
    && value > 0
    && value <= 65535
    ? value
    : 587
}

export function isMailEnabled(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim())
}

export async function sendMailDetailed(
  message: MailMessage,
): Promise<MailDeliveryResult> {
  const host = process.env.SMTP_HOST?.trim()

  if (!host) {
    return {
      delivered: false,
      messageId: null,
    }
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

  const result = await transporter.sendMail({
    from:
      message.from
      || process.env.SMTP_FROM
      || 'IFICS Dashboard <no-reply@localhost>',

    replyTo: message.replyTo,

    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,

    attachments: message.attachments?.map(
      attachment => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
        contentDisposition: 'attachment',
      }),
    ),
  })

  return {
    delivered: true,

    messageId:
      typeof result.messageId === 'string'
      && result.messageId.trim()
        ? result.messageId
        : null,
  }
}

export async function sendMail(
  message: MailMessage,
): Promise<boolean> {
  const result = await sendMailDetailed(message)

  return result.delivered
}
