// Public waitlist form copy (pt-BR + en). Pure data — no DOM/visual deps — so it is
// safe to unit-test without the component or the Pinboard kit. Consumed by
// <WaitlistSignupForm> (Task 12). Covers every state in the public form state machine
// (spec §7): idle/submitting/success/duplicate/closed/launched/raceClosed/error/
// rateLimited/unavailable.
export type WaitlistLocale = 'pt-BR' | 'en'

export interface WaitlistStrings {
  // consentLabel is a FUNCTION taking the waitlist name so the rendered consent text
  // matches the consent_texts ledger string verbatim after {name} substitution (the
  // signup audit snapshots that exact rendered text — LGPD proof-of-consent). The
  // component renders {name} as a bolded span (handoff waitlist-public.jsx:257).
  emailPlaceholder: string
  /** Accessible name (and visible label) for the email field — localized per the public surface. */
  emailLabel: string
  consentLabel: (name: string) => string
  button: string
  buttonLoading: string
  successHeadline: string
  successBody: string
  duplicateHeadline: string
  duplicateBody: string
  closed: string
  launched: string
  raceClosed: string
  error: string
  rateLimited: string
  unavailable: string
  reassurance: string
}

export const FORM_STRINGS: Record<WaitlistLocale, WaitlistStrings> = {
  'pt-BR': {
    emailPlaceholder: 'seu@email.com',
    emailLabel: 'Seu email',
    consentLabel: (name: string) =>
      `Quero ser avisado(a) por email quando ${name} for lançado. Posso cancelar quando quiser.`,
    button: 'Quero ser avisado',
    buttonLoading: 'Enviando…',
    successHeadline: 'Pronto!',
    successBody: 'Te avisamos quando lançar.',
    duplicateHeadline: 'Você já está na lista',
    duplicateBody: 'Avisaremos quando lançar.',
    closed: 'As inscrições estão encerradas.',
    launched: 'Já lançou!',
    raceClosed: 'Esta lista acabou de fechar.',
    error: 'Algo deu errado. Tente novamente.',
    rateLimited: 'Muitas tentativas. Aguarde um instante.',
    unavailable: 'Temporariamente indisponível, tente em instantes.',
    reassurance: 'Enviaremos um único email — cancele quando quiser.',
  },
  en: {
    emailPlaceholder: 'you@email.com',
    emailLabel: 'Email',
    consentLabel: (name: string) =>
      `Notify me by email when ${name} launches. I can unsubscribe anytime.`,
    button: 'Notify me',
    buttonLoading: 'Sending…',
    successHeadline: 'Done!',
    successBody: "We'll email you when it launches.",
    duplicateHeadline: "You're already on the list",
    duplicateBody: "We'll email you when it launches.",
    closed: 'Signups are closed.',
    launched: 'It launched!',
    raceClosed: 'This waitlist just closed.',
    error: 'Something went wrong. Please try again.',
    rateLimited: 'Too many attempts. Please wait a moment.',
    unavailable: 'Temporarily unavailable, please try again shortly.',
    reassurance: "We'll send one email only — unsubscribe anytime.",
  },
}
