// A ordem de uma chamada da ferramenta do Observatório (plano, 4.5): relógio → taxa → `limite` → `responder` com prazo → registro → texto.
// REGRA DURA: o texto só sai daqui depois de `{ ok: true }` do registro ("sem linha, sem dado"). Nunca lança, salvo "sem contexto"
// (ferramenta chamada fora da porta). Erro, log e Sentry levam só o passo e o código, nunca a mensagem crua, o texto nem o id da pessoa.
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ACOES } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { FRASES_DA_FERRAMENTA, fraseDeLimite } from '@/lib/youtube/observatorio/acesso-ia/frases'
import { ACESSO_IA_RULES, prazoDoResponder } from '@/lib/youtube/observatorio/acesso-ia/regras'
import { registrarAcessoDaChave } from '@/lib/youtube/observatorio/acesso-ia/registrar'
import { decidirTaxa, somarNaTaxa } from '@/lib/youtube/observatorio/acesso-ia/taxa'
import { contextoDoObservatorio, type ContextoDoObservatorio } from './contexto'

/** A forma que `responder` (Tarefa 10, `C/_acesso-ia/responder.ts`) devolve; declarada aqui para a ferramenta não importar código de tela. */
export interface Resposta {
  texto: string
  desfecho: 'ok' | 'nao_encontrado' | 'pedido_invalido' | 'falhou'
  incluiuPrivado: boolean
  params: Record<string, string | number | boolean | string[]>
}
export type Responder = (entrada: unknown, c: ContextoDoObservatorio, agora: number) => Promise<Resposta>

const R = ACESSO_IA_RULES
/** Depois disto não cabe nem a taxa: (teto − reserva − folga − uma ida). 47.000. */
const LIMITE_PARA_SOMAR_MS = R.tetoDaRequisicaoMs - R.reservaDoRegistroMs - R.folgaMs - R.prazoPorIdaMs
/** Depois disto nem a linha `tempo` cabe (teto − reserva − folga). 52.000. */
const LIMITE_PARA_REGISTRAR_MS = R.tetoDaRequisicaoMs - R.reservaDoRegistroMs - R.folgaMs

const TAGS = { component: 'observatorio-ia', step: 'executar-chamada' } as const
const avisar = (passo: string, code?: string): void => {
  Sentry.captureMessage(`observatorio_leitura: ${passo}`, { level: 'warning', tags: TAGS, extra: { passo, ...(code ? { code } : {}) } })
}
const erro = (texto: string): { texto: string; erro: boolean } => ({ texto, erro: true })

const acaoDe = (entrada: unknown): string => {
  const a = typeof entrada === 'object' && entrada !== null ? (entrada as { acao?: unknown }).acao : undefined
  return typeof a === 'string' && (ACOES as readonly string[]).includes(a) ? a : 'invalida'
}

const ESTOUROU = Symbol('estourou')

export async function executarChamada(
  entrada: unknown,
  deps: { sb: SupabaseClient; responder: Responder; agora: () => number },
): Promise<{ texto: string; erro: boolean }> {
  const c = contextoDoObservatorio()
  const { sb, responder, agora } = deps
  const acao = acaoDe(entrada)
  const base = { prova: c.prova, acao, incluiuPrivado: false, caracteres: null, resultado: 'ok' as const }

  /** Grava a linha `tempo` só se ainda cabe; erro de gravação vai ao Sentry e não muda a resposta (nada era entregue). */
  const registrarTempo = async (decorrido: number): Promise<void> => {
    if (!(decorrido <= LIMITE_PARA_REGISTRAR_MS)) { avisar('sem_tempo_para_registrar'); return }
    const r = await registrarAcessoDaChave(sb, { ...base, params: { acao, desfecho: 'tempo' } })
    if (!r.ok) avisar('registro_tempo_falhou', r.code)
  }

  // 1. o relógio: antes de somar na taxa. t0 ausente, no futuro ou ilegível = sem tempo (nunca prazo cheio).
  const decorrido0 = agora() - c.t0
  if (!Number.isFinite(decorrido0) || decorrido0 < 0) { avisar('t0_invalido'); return erro(FRASES_DA_FERRAMENTA.demorou) }
  if (decorrido0 > LIMITE_PARA_SOMAR_MS) { await registrarTempo(decorrido0); return erro(FRASES_DA_FERRAMENTA.demorou) }

  // 2. a taxa
  const t = await somarNaTaxa(sb, c.prova.keyId, agora())
  if (!t.ok) { avisar('taxa_nao_conferida', t.code); return erro(FRASES_DA_FERRAMENTA.taxa_nao_conferida) }
  const decisao = decidirTaxa(t.noMinuto, t.noDia, agora())
  if (!decisao.serve) {
    if (decisao.registrar) {
      const r = await registrarAcessoDaChave(sb, { ...base, resultado: 'limite', params: { acao, desfecho: 'limite', por: decisao.por } })
      if (!r.ok) avisar('registro_limite_falhou', r.code)
    }
    return erro(fraseDeLimite(decisao.voltaEm))
  }

  // 3. o prazo que sobrou, contado do início da requisição
  const decorrido1 = agora() - c.t0
  const prazo = prazoDoResponder(decorrido1)
  if (prazo === null) { await registrarTempo(decorrido1); return erro(FRASES_DA_FERRAMENTA.demorou) }

  // 4. responder, com prazo
  let resposta: Resposta | null = null
  let desfechoDeFalha: 'tempo' | 'falhou' | null = null
  let relogio: ReturnType<typeof setTimeout> | undefined
  try {
    const estouro = new Promise<typeof ESTOUROU>((resolve) => { relogio = setTimeout(() => resolve(ESTOUROU), prazo) })
    const r = await Promise.race([responder(entrada, c, agora()), estouro])
    if (r === ESTOUROU) desfechoDeFalha = 'tempo'
    else resposta = r
  } catch {
    desfechoDeFalha = 'falhou'
  } finally {
    if (relogio !== undefined) clearTimeout(relogio)
  }
  if (resposta === null) {
    const r = await registrarAcessoDaChave(sb, { ...base, params: { acao, desfecho: desfechoDeFalha ?? 'falhou' } })
    if (!r.ok) avisar('registro_falha_falhou', r.code)
    return erro(desfechoDeFalha === 'tempo' ? FRASES_DA_FERRAMENTA.demorou : FRASES_DA_FERRAMENTA.nao_montou)
  }

  // 5. o registro, ANTES de o texto sair
  const entregue = resposta.desfecho === 'ok'
  const reg = await registrarAcessoDaChave(sb, {
    prova: c.prova,
    acao,
    params: { ...resposta.params, acao, desfecho: resposta.desfecho },
    incluiuPrivado: entregue ? resposta.incluiuPrivado : false,
    caracteres: entregue ? resposta.texto.length : null,
    resultado: 'ok',
  })
  if (!reg.ok) { avisar('registro_falhou', reg.code); return erro(FRASES_DA_FERRAMENTA.nao_registrou) }
  return { texto: resposta.texto, erro: !entregue }
}
