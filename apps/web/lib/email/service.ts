import type { IEmailService } from '@tn-figueiredo/email'
import { createResendEmailService } from './resend'
import { createSesEmailService } from './ses'

let cached: IEmailService | null = null

export function getActiveProvider(): 'ses' | 'resend' {
  return (process.env.EMAIL_PROVIDER ?? 'ses') as 'ses' | 'resend'
}

export function getEmailService(): IEmailService {
  if (cached) return cached
  cached =
    getActiveProvider() === 'resend'
      ? createResendEmailService()
      : createSesEmailService(process.env.SES_DEFAULT_CONFIG_SET)
  return cached
}
