import { notFound } from 'next/navigation'

import {
  ConfirmLayout,
  type StateKind,
  type NlType,
} from '@/app/newsletter/confirm/[token]/_layouts/confirm-layout'
import Loading from '@/app/newsletter/confirm/[token]/loading'
import { ErrorBoundaryPreview } from './error-preview'

/* ── Valid preview states ───────────────────────────────────────────────── */

const VALID_STATES = [
  'success',
  'already',
  'expired',
  'not_found',
  'error',
  'invalid',
  'loading',
  'error-boundary',
] as const

type PreviewState = (typeof VALID_STATES)[number]

function isValidState(s: string): s is PreviewState {
  return (VALID_STATES as readonly string[]).includes(s)
}

/* ── Mock data ──────────────────────────────────────────────────────────── */

const MOCK_NEWSLETTERS: NlType[] = [
  {
    name: 'Perspectivas',
    tagline: 'Reflexoes sobre tecnologia, lideranca e vida criativa',
    color: '#FF8240',
    colorDark: '#CC6833',
    cadenceLabel: 'Semanal',
  },
  {
    name: 'Behind the Build',
    tagline: 'Bastidores de projetos e decisoes tecnicas',
    color: '#5B8DEF',
    colorDark: '#4A71BF',
    cadenceLabel: 'Quinzenal',
  },
]

const MOCK_PROPS: Record<StateKind, {
  title: string
  body: string
  backLabel: string
  locale: string
  lang: string
  newsletters?: NlType[]
  subscribedToLabel?: string
  signoff?: string
  showCta?: boolean
  ctaLabel?: string
  readLatestLabel?: string
  bodyContinuation?: string
}> = {
  success: {
    title: 'Inscricao confirmada!',
    body: 'Sua inscricao foi confirmada com sucesso. Voce agora recebera:',
    bodyContinuation: 'Fique de olho na sua caixa de entrada — a proxima edicao esta a caminho.',
    backLabel: 'Voltar ao inicio',
    locale: 'pt-BR',
    lang: 'pt-BR',
    newsletters: MOCK_NEWSLETTERS,
    subscribedToLabel: 'Voce esta inscrito em:',
    signoff: 'Obrigado por se inscrever!',
    showCta: true,
    ctaLabel: 'Conhecer o site',
    readLatestLabel: 'Ler ultimos artigos →',
  },
  already: {
    title: 'Ja confirmado',
    body: 'Este email ja foi confirmado anteriormente. Voce ja recebe:',
    backLabel: 'Voltar ao inicio',
    locale: 'pt-BR',
    lang: 'pt-BR',
    newsletters: MOCK_NEWSLETTERS,
    subscribedToLabel: 'Voce esta inscrito em:',
    signoff: undefined,
    showCta: false,
  },
  expired: {
    title: 'Link expirado',
    body: 'Este link de confirmacao expirou. Inscreva-se novamente para receber um novo email de confirmacao.',
    backLabel: '← Voltar ao inicio',
    locale: 'pt-BR',
    lang: 'pt-BR',
  },
  not_found: {
    title: 'Token nao encontrado',
    body: 'Nao encontramos nenhuma inscricao pendente para este link. Ele pode ter sido usado ou ja expirou.',
    backLabel: '← Voltar ao inicio',
    locale: 'pt-BR',
    lang: 'pt-BR',
  },
  error: {
    title: 'Erro inesperado',
    body: 'Algo deu errado ao confirmar sua inscricao. Tente novamente mais tarde.',
    backLabel: '← Voltar ao inicio',
    locale: 'pt-BR',
    lang: 'pt-BR',
  },
  invalid: {
    title: 'Token invalido',
    body: 'O formato do token de confirmacao e invalido. Verifique o link no seu email.',
    backLabel: '← Voltar ao inicio',
    locale: 'pt-BR',
    lang: 'pt-BR',
  },
}

/* ── Page component ─────────────────────────────────────────────────────── */

export default async function ConfirmPreviewPage({
  params,
}: {
  params: Promise<{ state: string }>
}) {
  const { state } = await params

  if (!isValidState(state)) {
    notFound()
  }

  /* Special states that use dedicated components */
  if (state === 'loading') {
    return <Loading />
  }

  if (state === 'error-boundary') {
    return <ErrorBoundaryPreview />
  }

  /* Standard ConfirmLayout states */
  const props = MOCK_PROPS[state]

  return (
    <ConfirmLayout
      state={state}
      title={props.title}
      body={props.body}
      bodyContinuation={props.bodyContinuation}
      backLabel={props.backLabel}
      lang={props.lang}
      locale={props.locale}
      newsletters={props.newsletters}
      subscribedToLabel={props.subscribedToLabel}
      signoff={props.signoff}
      showCta={props.showCta}
      ctaLabel={props.ctaLabel}
      readLatestLabel={props.readLatestLabel}
    />
  )
}
