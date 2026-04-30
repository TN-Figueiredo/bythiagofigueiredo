import type { IEmailService } from '@tn-figueiredo/email'
import { createSesEmailService } from './ses'

let cached: IEmailService | null = null

export function getEmailService(): IEmailService {
  if (cached) return cached
  cached = createSesEmailService(process.env.SES_DEFAULT_CONFIG_SET)
  return cached
}
