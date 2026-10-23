// Resposta do dia 14 (§5.3): o dono diz o que viu no Studio. Aditiva: `sempre` grava a resposta; `seEmAndamento` só entra se a
// linha ainda não tem veredito (em_andamento, ou sem_desfecho sem `vencedor_fonte`). Com veredito de outra fonte guardam-se as duas.
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { titulosAntesDoTeste } from '@/lib/youtube/observatorio/proprio-versoes/ler'
import { normalizarTitulo } from '../normalizar-titulo'
import { variantesDaResposta, patchDaResposta, type RespostaDono, type VariantesDaResposta } from './versoes'

export { derivadasDeVariantesTitulo, patchDaResposta, variantesDaResposta, MOTIVO_RESPOSTA_DO_DONO } from './versoes'
export type { RespostaDono, VariantesDaResposta, PatchDaResposta } from './versoes'

export type ErroResponder = 'nao_encontrado' | 'nao_respondivel' | 'ja_respondido' | 'variante_invalida' | 'estado_mudou' | 'falha_escrita'
export type ResultadoResponder =
  | { ok: true; conflito: { youtube: string; dono: string } | null }
  | { ok: false; erro: ErroResponder }

interface Params {
  sb: SupabaseClient
  siteId: string
  userId: string
  /** Para a linha de auditoria; sem org, a linha leva só `site_id`. */
  orgId?: string | null
  registroId: string
  /** `updated_at` que a tela viu (CAS da 1ª tentativa). */
  lido: string
  resposta: RespostaDono
  n: number | null
  /** Título que a tela mostrava na versão tocada (numeração congelada, D-1). Ausente numa derivada = bundle antigo: devolve `estado_mudou`. */
  tituloVisto?: string | null
  agora: Date
}
interface Linha {
  id: string; estado: string; desfecho_motivo: string | null; resposta_dono: string | null; vencedor_fonte: string | null; vencedor_titulo: string | null
  confirmado_em: string | null; variantes: unknown; variantes_titulo: unknown; updated_at: string
  variante_vencedora: number | null; youtube_video_id: string; primeira_vista: string | null
}
const COLUNAS = 'id, estado, desfecho_motivo, resposta_dono, vencedor_fonte, vencedor_titulo, confirmado_em, variantes, variantes_titulo, updated_at, variante_vencedora, youtube_video_id, primeira_vista'

/** Título vigente na Data API em `primeira_vista` (D-1), pelo leitor único de versões. Só para derivada. */
async function lerTituloAntes(p: Params, l: Linha): Promise<string | null> {
  const m = await titulosAntesDoTeste(p.sb, p.siteId, [{ id: l.id, youtubeVideoId: l.youtube_video_id, primeiraVista: l.primeira_vista }])
  return m.get(l.id) ?? null
}

const varianteDaResposta = (r: RespostaDono, n: number | null): number | null => (r === 'venceu_original' ? 1 : r === 'venceu_nova' ? n : null)

function tituloConfere(v: VariantesDaResposta, tituloDaVersao: string | undefined, tituloVisto: string | null | undefined): boolean {
  if (typeof tituloVisto !== 'string') return v.origem === 'ficha' // ficha: ausente ou nulo (só miniatura) grava como antes; derivada exige o título
  return normalizarTitulo(tituloDaVersao ?? '') === normalizarTitulo(tituloVisto)
}

async function lerLinha(p: Params): Promise<Linha | null> {
  const { data, error } = await p.sb.from('ab_native_tests').select(COLUNAS).eq('id', p.registroId).eq('site_id', p.siteId).maybeSingle()
  if (error) throw new Error(`ab_native_tests: ${error.message}`)
  return (data as Linha | null) ?? null
}

export async function responderDia14(p: Params): Promise<ResultadoResponder> {
  let cas = p.lido
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const l = await lerLinha(p)
    if (!l) return { ok: false, erro: 'nao_encontrado' }
    if (tentativa > 0) cas = l.updated_at // perdeu a 1ª: reavalia sobre a linha recém-lida
    if (l.estado === 'descartado' || l.confirmado_em === null) return { ok: false, erro: 'nao_respondivel' }
    if (l.resposta_dono !== null && l.resposta_dono !== 'sem_resposta') {
      // Duplo toque / outra aba com a mesma resposta: já está gravada, nada a escrever.
      if (l.resposta_dono === p.resposta && l.variante_vencedora === varianteDaResposta(p.resposta, p.n)) {
        // Mesma (resposta, n) mas outro título (renumeração entre as duas abas): não é a mesma resposta, a tela relê.
        const derivadaJa = l.variantes === null || l.variantes === undefined
        if (p.resposta.startsWith('venceu') && l.vencedor_fonte === 'dono' && typeof l.vencedor_titulo === 'string') {
          if (typeof p.tituloVisto === 'string' ? normalizarTitulo(l.vencedor_titulo) !== normalizarTitulo(p.tituloVisto) : derivadaJa) return { ok: false, erro: 'estado_mudou' }
        }
        return { ok: true, conflito: null }
      }
      return { ok: false, erro: 'ja_respondido' }
    }
    const derivada = l.variantes === null || l.variantes === undefined
    const v = variantesDaResposta({ variantes: l.variantes, variantes_titulo: l.variantes_titulo, titulo_antes: derivada && p.resposta.startsWith('venceu') ? await lerTituloAntes(p, l) : null })
    // Numeração congelada: o título que a tela mostrava tem de ser o da versão `n` de agora (o registrador pode ter renumerado).
    if (v && p.resposta.startsWith('venceu')) {
      const item = v.itens.find((x) => x.n === (p.resposta === 'venceu_original' ? 1 : p.n))
      if (item && !tituloConfere(v, item.titulo, p.tituloVisto)) return { ok: false, erro: 'estado_mudou' }
    }
    const patch = patchDaResposta(p.resposta, p.n, v)
    if ('erro' in patch) return { ok: false, erro: patch.erro }

    const elegivel = l.estado === 'em_andamento' || (l.estado === 'sem_desfecho' && l.vencedor_fonte === null)
    const payload: Record<string, unknown> = { ...patch.sempre, respondido_em: p.agora.toISOString() }
    if (elegivel) {
      Object.assign(payload, patch.seEmAndamento)
      // O veredito passa a ser do dono: a versão da regra que o desfecho carregava deixa de valer.
      payload.desfecho_versao_regra = null
      // `teste_novo` é o motivo que o registrador usa para cortar a janela do teste seguinte: a resposta do dono não o troca.
      if (l.desfecho_motivo === 'teste_novo') delete payload.desfecho_motivo
      if (l.estado === 'em_andamento') Object.assign(payload, { encerrado_em: p.agora.toISOString(), desfecho_em: p.agora.toISOString() })
    }
    const { data, error } = await p.sb.from('ab_native_tests').update(payload)
      .eq('id', p.registroId).eq('site_id', p.siteId).eq('updated_at', cas)
      .or('resposta_dono.is.null,resposta_dono.eq.sem_resposta')
      .select('id')
    if (error) {
      Sentry.captureException(new Error(`ab_native_tests: ${error.message}`), { tags: { area: 'ab-nativo' }, extra: { registroId: p.registroId } })
      return { ok: false, erro: 'falha_escrita' }
    }
    if ((data as unknown[] | null)?.length) {
      await registrarRastro(p, l, patch.sempre.variante_vencedora as number | null)
      await expirarLembrete(p)
      if (elegivel || l.vencedor_fonte === null) return { ok: true, conflito: null }
      const dono = typeof patch.seEmAndamento.vencedor_titulo === 'string'
        ? patch.seEmAndamento.vencedor_titulo
        : (p.n !== null && p.resposta.startsWith('venceu') ? `variante ${p.resposta === 'venceu_original' ? 1 : p.n}` : p.resposta)
      const youtube = l.vencedor_titulo ?? 'sem título'
      if (patch.seEmAndamento.vencedor_fonte === 'dono' && patch.seEmAndamento.vencedor_titulo === l.vencedor_titulo) return { ok: true, conflito: null }
      return { ok: true, conflito: { youtube, dono } }
    }
  }
  return { ok: false, erro: 'estado_mudou' }
}

/** Resolvida a pergunta, o lembrete sai do contador do sino. Falha vai ao log: a resposta já está gravada. */
async function expirarLembrete(p: Params): Promise<void> {
  try {
    const { error } = await p.sb.from('notifications').update({ expired_at: p.agora.toISOString() })
      .eq('site_id', p.siteId).eq('domain', 'youtube').eq('dedup_key', `lembrete-nativo:${p.registroId}`).is('expired_at', null)
    if (error) avisarLembrete(p, error.message)
  } catch (e) {
    avisarLembrete(p, e instanceof Error ? e.message : String(e))
  }
}

function avisarLembrete(p: Params, msg: string): void {
  console.error('[ab-nativo] expirar lembrete-nativo', msg)
  Sentry.captureMessage('expirar lembrete-nativo falhou', { level: 'warning', tags: { area: 'ab-nativo' }, extra: { registroId: p.registroId } })
}

/** Quem respondeu: só ids, a resposta e o estado anterior. Falha vai ao log e não desfaz a resposta (mesmo molde de `descartar.ts`). */
async function registrarRastro(p: Params, l: Linha, varianteEscrita: number | null): Promise<void> {
  try {
    const aud = await p.sb.from('audit_log').insert({
      actor_user_id: p.userId, org_id: p.orgId ?? null, site_id: p.siteId,
      action: 'ab_native_respondido', resource_type: 'ab_native_test', resource_id: p.registroId,
      after_data: { registro_id: p.registroId, resposta_dono: p.resposta, variante_vencedora: varianteEscrita, estado_anterior: l.estado },
    })
    if (aud?.error) console.error('[ab-nativo] audit_log da resposta', aud.error.message)
  } catch (e) {
    console.error('[ab-nativo] audit_log da resposta', e instanceof Error ? e.message : e)
  }
}
