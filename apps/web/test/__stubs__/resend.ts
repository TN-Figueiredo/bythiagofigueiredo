// Stub for resend — the package is consumed via @tn-figueiredo/email at runtime,
// but tests that mock it need a resolvable module path.
export class Resend {
  constructor(_apiKey: string) {}
  emails = {
    send: async (_opts: Record<string, unknown>) =>
      ({ data: { id: 'stub' }, error: null }) as const,
  }
}
