import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import type {
  IEmailService,
  EmailMessage,
  EmailResult,
  IEmailTemplate,
  EmailSender,
} from '@tn-figueiredo/email'

export function createSesEmailService(defaultConfigSet?: string): IEmailService {
  const region = process.env.AWS_SES_REGION
  const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY
  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'AWS SES credentials not configured (AWS_SES_REGION, AWS_SES_ACCESS_KEY_ID, AWS_SES_SECRET_ACCESS_KEY)',
    )
  }

  const client = new SESv2Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })

  const service: IEmailService = {
    async send(msg: EmailMessage): Promise<EmailResult> {
      const configSet =
        (msg.metadata?.configurationSet as string) ?? defaultConfigSet

      const headers = msg.metadata?.headers as
        | Record<string, string>
        | undefined

      const displayName = /[,;"<>@()\\]/.test(msg.from.name)
        ? `"${msg.from.name.replace(/[\\"]/g, '\\$&')}"`
        : msg.from.name

      const cmd = new SendEmailCommand({
        FromEmailAddress: `${displayName} <${msg.from.email}>`,
        Destination: {
          ToAddresses: Array.isArray(msg.to) ? msg.to : [msg.to],
        },
        Content: {
          Simple: {
            Subject: { Data: msg.subject },
            Body: {
              Html: { Data: msg.html },
              ...(msg.text ? { Text: { Data: msg.text } } : {}),
            },
            ...(headers && Object.keys(headers).length > 0
              ? {
                  Headers: Object.entries(headers).map(([Name, Value]) => ({
                    Name,
                    Value,
                  })),
                }
              : {}),
          },
        },
        ...(configSet ? { ConfigurationSetName: configSet } : {}),
        ...(msg.replyTo ? { ReplyToAddresses: [msg.replyTo] } : {}),
      })

      const MAX_RETRIES = 3
      let lastError: unknown
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const res = await client.send(cmd)
          if (!res.MessageId) throw new Error('SES returned no MessageId')
          return {
            messageId: res.MessageId,
            provider: 'ses' as EmailResult['provider'],
          }
        } catch (err: unknown) {
          lastError = err
          const name = (err as { name?: string })?.name ?? ''
          const retryable =
            name === 'TooManyRequestsException' ||
            name === 'ServiceUnavailableException' ||
            name === 'ThrottlingException'
          if (!retryable || attempt === MAX_RETRIES - 1) throw err
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
        }
      }
      throw lastError
    },

    async sendTemplate<V extends Record<string, unknown>>(
      template: IEmailTemplate<V>,
      sender: EmailSender,
      to: string,
      variables: V,
      locale?: string,
    ): Promise<EmailResult> {
      const rendered = await template.render(variables, locale ?? 'en')
      return service.send({
        from: sender,
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      })
    },
  }

  return service
}
