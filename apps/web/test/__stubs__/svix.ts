// Stub for svix — an OPTIONAL peer dep of @tn-figueiredo/email used only by
// ResendWebhookProcessor (Resend was removed; SES is the sole provider, and
// the SNS signature scheme is cert-based, not svix). Not installed. Tests
// that inline the email package's `webhooks` entry reach the top-level
// `import { Webhook } from 'svix'` via Vite's `__vite-optional-peer-dep`
// wrapper; this stub keeps that resolvable instead of throwing
// "Could not resolve svix".
export class Webhook {
  constructor(_secret: string) {}
  verify(_payload: string, _headers: Record<string, string>): unknown {
    return {}
  }
}

export default { Webhook }
