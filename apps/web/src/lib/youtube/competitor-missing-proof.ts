/**
 * A5 · E9, Tarefa 8: a prova dos ausentes no cron. Prova a cada disparo que nenhum vídeo fora do ar perdeu linhas sem resposta de "apagar",
 * acusa apagamento pela metade e termina o que ficou no Blob. Nunca devolve verde por não saber: tudo que não se lê vira vermelho.
 * Este módulo NÃO importa `agenda/fecho.ts` (que o importa): quem chama passa o limitador de tempo.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { HealthVerdict } from './competitor-health'
import { schemaE9 } from './observatorio/saiu/schema'
import { concluirApagamentos, sitesComApagamentoPendente } from './observatorio/saiu/responder'
import type { DepsDoApagar } from './observatorio/saiu/responder'
import { comPrazo } from './agenda/relogio'

export interface ProvaDosAusentes {
  videos_ausentes: number
  linhas_de_ausentes: number
  miniaturas_de_ausentes: number
  ausentes_com_queda: number
  pisos_novos: number
  esperando: number
  mais_antigo_dias: number | null
  apagando: number
  apagando_ha_mais_de_1d: number
  voltaram_sem_resposta: number
}
export type VereditoDosAusentes = HealthVerdict & { numeros: ProvaDosAusentes | null }

export const PREFIXO_PROVA = 'prova dos ausentes: '
const NAO_LEU = PREFIXO_PROVA + 'não foi possível ler'
const NOTA_DESLIGADA = 'prova dos ausentes desligada (OBS_PROVA_AUSENTES=off)'
const CHAVES_INTEIRAS = [
  'videos_ausentes', 'linhas_de_ausentes', 'miniaturas_de_ausentes', 'ausentes_com_queda', 'pisos_novos',
  'esperando', 'apagando', 'apagando_ha_mais_de_1d', 'voltaram_sem_resposta',
] as const

export function provaLigada(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.OBS_PROVA_AUSENTES ?? '').trim().toLowerCase() !== 'off'
}

const naoLeu = (): VereditoDosAusentes => ({ ok: false, problems: [NAO_LEU], notes: [], numeros: null })
const inteiroNaoNegativo = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0

function validar(x: unknown): ProvaDosAusentes | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null
  const o = x as Record<string, unknown>
  for (const k of CHAVES_INTEIRAS) if (!inteiroNaoNegativo(o[k])) return null
  const m = o.mais_antigo_dias
  if (m !== null && !inteiroNaoNegativo(m)) return null
  return {
    videos_ausentes: o.videos_ausentes as number, linhas_de_ausentes: o.linhas_de_ausentes as number,
    miniaturas_de_ausentes: o.miniaturas_de_ausentes as number, ausentes_com_queda: o.ausentes_com_queda as number,
    pisos_novos: o.pisos_novos as number, esperando: o.esperando as number, mais_antigo_dias: m,
    apagando: o.apagando as number, apagando_ha_mais_de_1d: o.apagando_ha_mais_de_1d as number,
    voltaram_sem_resposta: o.voltaram_sem_resposta as number,
  }
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios)

/** Nunca lança: qualquer exceção vira "não foi possível ler" (se lançasse, a frase final citaria a prova errada). */
export async function readMissingProof(sb: SupabaseClient, siteId: string, nowIso: string): Promise<VereditoDosAusentes> {
  try {
    const falta = await schemaE9(sb)
    if (falta !== null) {
      const ausente = falta.includes('ainda não foi aplicada')
      return { ok: false, problems: [PREFIXO_PROVA + (ausente ? 'schema ausente (MG-E9 não aplicada)' : 'não foi possível conferir o schema')], notes: [], numeros: null }
    }
    const r = await sb.rpc('competitor_missing_proof', { p_site: siteId, p_now: nowIso })
    if (r.error) return naoLeu()
    const n = validar(r.data)
    if (n === null) return naoLeu()
    const problems: string[] = []
    const notes: string[] = []
    if (n.ausentes_com_queda > 0) {
      problems.push(PREFIXO_PROVA + n.ausentes_com_queda + ' ' + plural(n.ausentes_com_queda, 'vídeo fora do ar perdeu', 'vídeos fora do ar perderam') + ' linhas sem resposta de apagar')
    }
    if (n.apagando_ha_mais_de_1d > 0) {
      problems.push(PREFIXO_PROVA + n.apagando_ha_mais_de_1d + ' ' + plural(n.apagando_ha_mais_de_1d, 'item apagando', 'itens apagando') + ' há mais de 1 dia')
    }
    if (n.esperando > 0) {
      const d = n.mais_antigo_dias
      notes.push(n.esperando + ' ' + plural(n.esperando, 'item esperando', 'itens esperando') + ' resposta na fila' + (d !== null ? ' (o mais antigo há ' + d + ' ' + plural(d, 'dia', 'dias') + ')' : ''))
    }
    if (n.voltaram_sem_resposta > 0) {
      notes.push(n.voltaram_sem_resposta + ' ' + plural(n.voltaram_sem_resposta, 'item voltou', 'itens voltaram') + ' ao ar sem resposta na fila')
    }
    return { ok: problems.length === 0, problems, notes, numeros: n }
  } catch {
    return naoLeu()
  }
}

/** A única função que os dois caminhos do cron chamam. */
export async function provaDosAusentes(
  sb: SupabaseClient, siteId: string, nowIso: string,
  dentroDoPrazo: (ler: () => Promise<HealthVerdict>) => Promise<HealthVerdict>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<VereditoDosAusentes> {
  if (!provaLigada(env)) return { ok: true, problems: [], notes: [NOTA_DESLIGADA], numeros: null }
  const caixa: { lido: VereditoDosAusentes | null } = { lido: null }
  const v = await dentroDoPrazo(async () => { caixa.lido = await readMissingProof(sb, siteId, nowIso); return caixa.lido })
  const numeros = caixa.lido !== null && v === caixa.lido ? caixa.lido.numeros : null
  const prefixar = (p: string) => (p.startsWith(PREFIXO_PROVA) ? p : PREFIXO_PROVA + p)
  return { ok: v.ok, problems: v.problems.map(prefixar), notes: v.notes, numeros }
}

export interface ResultadoDoFecho { tentados: number; concluidos: number; sites: string[]; erro?: string }

/** Termina o que ficou no Blob. Não roda com a prova desligada; os sites vêm das pendências; nunca lança. */
export async function fecharApagamentos(
  sb: SupabaseClient, o: { prazoMs: number; deps?: DepsDoApagar; env?: NodeJS.ProcessEnv },
): Promise<ResultadoDoFecho> {
  const vazio: ResultadoDoFecho = { tentados: 0, concluidos: 0, sites: [] }
  if (!provaLigada(o.env ?? process.env)) return vazio
  try {
    const agora = o.deps?.agora ?? Date.now
    const fim = agora() + o.prazoMs
    const sites = await sitesComApagamentoPendente(sb)
    if (!Array.isArray(sites)) return { ...vazio, erro: sites.erro }
    const r: ResultadoDoFecho = { ...vazio }
    for (const siteId of sites) {
      const restante = fim - agora()
      if (restante <= 0) break
      const c = await comPrazo(concluirApagamentos(sb, siteId, { prazoMs: restante, deps: o.deps }), restante)
      if ('estourou' in c) break
      r.tentados += c.valor.tentados
      r.concluidos += c.valor.concluidos
      if (c.valor.concluidos > 0) r.sites.push(siteId)
      if (c.valor.erro && !r.erro) r.erro = c.valor.erro
    }
    return r
  } catch {
    return { ...vazio, erro: 'não foi possível concluir os apagamentos' }
  }
}
