import type { IEmailService } from '@tn-figueiredo/email'
import { createResendEmailService } from './resend'

let cached: IEmailService | null = null

export function getEmailService(): IEmailService {
  if (cached) return cached
  cached = createResendEmailService()
  return cached
}
