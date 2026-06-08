import type { IEmailService } from '@tn-figueiredo/email'
import { createSesEmailService } from './ses'

let cached: IEmailService | null = null

export function getEmailService(): IEmailService {
  if (cached) return cached
  // Default this singleton to the TRANSACTIONAL config-set (safe). Bulk
  // newsletter editions override it per-send via metadata.configurationSet =
  // SES_MARKETING_CONFIG_SET in the send-scheduled-newsletters cron, so the
  // singleton default stays transactional and any un-tagged send (welcome,
  // confirm, account mail) keeps its own clean sender reputation.
  cached = createSesEmailService(
    process.env.SES_TRANSACTIONAL_CONFIG_SET ?? process.env.SES_DEFAULT_CONFIG_SET,
  )
  return cached
}
