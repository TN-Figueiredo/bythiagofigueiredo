import * as Sentry from '@sentry/nextjs'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { link } from '@/lib/youtube/observatorio/links'
import { TELAS_IA } from '@/lib/youtube/observatorio/contexto-ia/telas'
import { ObservatoryChromeServer } from '../_chrome/chrome-server'
import type { ObsSearchParams } from '../_chrome/resolve-niche'
import { gerarPacoteIa } from '../contexto-ia-actions'
import { dispensarSugestao } from '../_sugestoes/actions'
import { saiuDoAviso } from '../_sugestoes/aviso'
import { abrirListaDaTela } from '../_sugestoes/dados-da-tela'
import { SugestoesLista } from '../_sugestoes/sugestoes-lista'
import { montarVistaDaLista, type VistaDaLista } from '../_sugestoes/view-model'
import type { AcoesDaLista } from '../_sugestoes/tipos'

export const metadata = { title: 'Sugestões · Competidores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const LIMITE = 100
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/** Leitura que falhou: n nulo ("?"); a lista nunca lança para o `error.tsx`. */
const VISTA_COM_ERRO: VistaDaLista = { n: null, calculado: null, velho: false, resumo: '', faixa: null, filtro: null, linhas: [], completas: [], totalAlemDoLimite: null, vazio: null }

/** A faixa "algumas saíram": só na abertura vinda do sino (`de=sino`) e só com o aviso do próprio usuário. */
async function avisoDoSino(sp: ObsSearchParams, agora: Date): Promise<boolean> {
  const chave = one(sp.aviso)
  if (one(sp.de) !== 'sino' || !chave) return false
  try {
    const { siteId } = await getSiteContext()
    const edicao = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
    if (!edicao.ok) return false
    return await saiuDoAviso(getSupabaseServiceClient(), siteId, edicao.user.id, chave, agora)
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'sugestoes', step: 'aviso' } })
    return false
  }
}

export default async function SugestoesPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  const agora = new Date(observatoryNow())
  const leitura = await abrirListaDaTela(agora, LIMITE)
  let corpo: React.ReactNode
  switch (leitura.estado) {
    case 'sem_acesso':
      corpo = <section className="sg" data-obs-screen="sugestoes"><p role="alert">Você não tem acesso a esta lista.</p></section>
      break
    case 'erro':
      corpo = <SugestoesLista modo="pagina" vista={VISTA_COM_ERRO} acoes={null} />
      break
    case 'ok': {
      const saiu = await avisoDoSino(sp ?? {}, agora)
      const vista = montarVistaDaLista({ lista: leitura.lista, amostra: leitura.amostra, agora, filtro: 'todas', saiuDoAviso: saiu, limite: LIMITE })
      const acoes: AcoesDaLista | null = leitura.podeResponder ? { dispensar: dispensarSugestao } : null
      corpo = <SugestoesLista modo="pagina" vista={vista} acoes={acoes} verTodasHref={link.sugestoes()} />
      break
    }
  }
  return (
    <ObservatoryChromeServer tab="sugestoes" searchParams={sp}
      perguntarIa={{ tela: 'sugestoes', nomeDaTela: TELAS_IA['sugestoes'].nome, exemplos: TELAS_IA['sugestoes'].exemplos, onGerar: gerarPacoteIa }}>
      {corpo}
    </ObservatoryChromeServer>
  )
}
