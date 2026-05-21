import { notFound } from 'next/navigation'

import {
  UnsubscribeLayout,
  type StateKind,
} from '@/app/unsubscribe/[token]/_layouts/unsubscribe-layout'
import UnsubscribeLoading from '@/app/unsubscribe/[token]/loading'

import { ErrorBoundaryPreview } from './error-preview'

/* ── Valid preview states ───────────────────────────────────────────────── */

const VALID_STATES = [
  'initial',
  'ok',
  'already',
  'not_found',
  'error',
  'invalid',
  'loading',
  'error-boundary',
] as const

type PreviewState = (typeof VALID_STATES)[number]

function isValidState(v: string): v is PreviewState {
  return (VALID_STATES as readonly string[]).includes(v)
}

/* ── Mock content per state (pt-BR) ─────────────────────────────────────── */

const MOCK: Record<
  Exclude<PreviewState, 'loading' | 'error-boundary'>,
  {
    state: StateKind
    title: string
    body: string
    backLabel: string
    manageLabel?: string
    signoff?: string
    lang: string
    locale: string
    form?: React.ReactNode
  }
> = {
  initial: {
    state: 'initial',
    title: 'Cancelar inscrição',
    body: 'Você está prestes a cancelar sua inscrição na newsletter. Sentiremos sua falta, mas respeitamos sua decisão.',
    backLabel: 'Voltar ao início',
    lang: 'pt-BR',
    locale: 'pt-BR',
    form: (
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button
          type="button"
          style={{
            padding: '12px 32px',
            border: '1.5px solid #958A75',
            borderRadius: 4,
            background: 'transparent',
            color: '#958A75',
            fontFamily: 'var(--font-inter-var), Arial, sans-serif',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Confirmar cancelamento
        </button>
      </div>
    ),
  },
  ok: {
    state: 'ok',
    title: 'Inscrição cancelada',
    body: 'Sua inscrição foi cancelada com sucesso. Você não receberá mais e-mails da nossa newsletter.',
    backLabel: 'Voltar ao início',
    manageLabel: 'Gerenciar preferências',
    signoff: 'Obrigado por ter nos acompanhado até aqui.',
    lang: 'pt-BR',
    locale: 'pt-BR',
  },
  already: {
    state: 'already',
    title: 'Já cancelada',
    body: 'Esta inscrição já foi cancelada anteriormente. Nenhuma ação adicional é necessária.',
    backLabel: 'Voltar ao início',
    manageLabel: 'Gerenciar preferências',
    lang: 'pt-BR',
    locale: 'pt-BR',
  },
  not_found: {
    state: 'not_found',
    title: 'Inscrição não encontrada',
    body: 'Não encontramos nenhuma inscrição associada a este link. Ele pode ter expirado ou já sido utilizado.',
    backLabel: 'Voltar ao início',
    lang: 'pt-BR',
    locale: 'pt-BR',
  },
  error: {
    state: 'error',
    title: 'Erro ao processar',
    body: 'Ocorreu um erro inesperado ao processar sua solicitação. Tente novamente mais tarde.',
    backLabel: 'Voltar ao início',
    lang: 'pt-BR',
    locale: 'pt-BR',
  },
  invalid: {
    state: 'invalid',
    title: 'Link inválido',
    body: 'Este link de cancelamento é inválido. Verifique se copiou o endereço corretamente.',
    backLabel: 'Voltar ao início',
    lang: 'pt-BR',
    locale: 'pt-BR',
  },
}

/* ── Page component ─────────────────────────────────────────────────────── */

export default async function UnsubscribePreviewPage({
  params,
}: {
  params: Promise<{ state: string }>
}) {
  const { state } = await params

  if (!isValidState(state)) notFound()

  /* Special states that render dedicated components */
  if (state === 'loading') return <UnsubscribeLoading />
  if (state === 'error-boundary') return <ErrorBoundaryPreview />

  /* Standard layout states */
  const mock = MOCK[state]
  return <UnsubscribeLayout {...mock} />
}
