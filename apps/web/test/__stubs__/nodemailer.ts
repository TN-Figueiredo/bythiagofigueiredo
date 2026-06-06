// Stub for nodemailer — an OPTIONAL peer dep of @tn-figueiredo/email (SMTP
// transport). The project sends via Resend, so nodemailer is not installed.
// Tests that inline the email package reach its SMTP chunk, which references
// nodemailer via Vite's `__vite-optional-peer-dep` wrapper; this stub keeps
// that resolvable instead of throwing "Could not resolve nodemailer".
export function createTransport(_opts?: Record<string, unknown>) {
  return {
    sendMail: async (_mail: Record<string, unknown>) =>
      ({ messageId: 'stub', accepted: [], rejected: [], response: 'stub' }) as const,
    verify: async () => true,
  }
}

export default { createTransport }
