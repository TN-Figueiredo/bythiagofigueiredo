import { Resend } from 'resend'

const client = new Resend(process.env.RESEND_API_KEY)

export async function sendTransactionalEmail(params: {
  to: string
  subject: string
  html: string
  from?: string
}): Promise<void> {
  const { data, error } = await client.emails.send({
    from: params.from ?? 'Thiago <no-reply@bythiagofigueiredo.com>',
    to: params.to,
    subject: params.subject,
    html: params.html,
  })
  if (error) throw new Error(error.message)
}
