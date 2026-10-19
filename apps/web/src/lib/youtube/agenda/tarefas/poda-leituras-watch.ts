import { schemaTablesReady } from '@/lib/youtube/competitor-health'
import { lerCandidatosDaWatch } from '@/lib/youtube/watch/alvos'
import { avisarDono, type Aviso } from '../aviso'
import { DEFINICAO_PODA_LEITURAS_WATCH } from '../definicoes'
import { relatarAgenda } from '../fecho'
import { BANCO_MS } from '../relogio'
import type { ContextoTarefa, ResultadoTarefa, Tarefa } from '../tipos'

const LOTE = 5000
const LOTES_MAX = 3
/** Folga mínima para começar mais um lote: a poda de 5.000 leva poucos segundos, e a prova e o aviso ainda precisam caber. */
const FOLGA_LOTE_MS = 20_000
const HORA_MS = 3_600_000
const AVISO_MIN_MS = 1_000
const AVISO_MAX_MS = 8_000

type Motivos = 'leitura_bloqueada' | 'layout_mudou' | 'rodadas_faltando' | 'sem_alvos' | 'oficial_sumiu' | 'capacidade_curta'
const ORDEM_MOTIVOS: readonly Motivos[] = ['leitura_bloqueada', 'layout_mudou', 'rodadas_faltando', 'sem_alvos', 'oficial_sumiu', 'capacidade_curta']

const eRec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)
const inteiroTxt = (x: unknown): string => String(Math.round(num(x) ?? 0))

/** A frase de cada motivo vermelho da prova: frase fixa e números. Texto de fora nunca entra. */
export const FRASE_PROVA: Record<Motivos, (p: Record<string, unknown>) => string> = {
  leitura_bloqueada: () => 'mais da metade das leituras falhou nas últimas 24 horas',
  layout_mudou: () => 'mais de 20% das leituras não acharam o título',
  rodadas_faltando: p => {
    const soma = (num(p.menos_de_3_rodadas_24h) ?? 0) + (num(p.alvos_atrasados) ?? 0)
    const ativos = num(p.alvos_ativos) ?? 0
    return inteiroTxt(ativos > 0 ? Math.min(soma, ativos) : soma) + ' vídeos sem as 3 rodadas do dia ou com rodada atrasada'
  },
  sem_alvos: p => 'há ' + inteiroTxt(p.candidatos_esperados) + ' vídeos na janela e só ' + inteiroTxt(p.alvos_ativos) + ' na coleta',
  oficial_sumiu: () => 'mais de 20% das leituras sem título oficial vieram sem o player bloqueado: o layout da página pode ter mudado',
  capacidade_curta: p => 'a demanda é de ' + inteiroTxt(p.demanda_rodadas_dia) + ' rodadas por dia, perto do limite de 1.152; tire os Shorts da coleta antes de perder rodadas',
}

const horasAtras = (iso: unknown, agora: number): number | null => {
  if (typeof iso !== 'string') return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? Math.max(0, Math.floor((agora - t) / HORA_MS)) : null
}

/** Só número vai ao `detalhe`: as duas datas viram "há quantas horas"; `por_erro` vira um contador por código. */
function detalheDaProva(p: Record<string, unknown>, agora: number): Record<string, number> {
  const d: Record<string, number> = {}
  for (const [k, v] of Object.entries(p)) {
    if (k === 'coleta_desde' || k === 'primeira_leitura' || k === 'por_erro' || k === 'motivos') continue
    const n = num(v)
    if (n !== null) d[k] = n
  }
  const desde = horasAtras(p.coleta_desde, agora)
  if (desde !== null) d.coleta_desde_horas = desde
  const primeira = horasAtras(p.primeira_leitura, agora)
  if (primeira !== null) d.primeira_leitura_horas = primeira
  if (eRec(p.por_erro)) {
    for (const [k, v] of Object.entries(p.por_erro)) {
      const n = num(v)
      if (n !== null && /^[a-z0-9_]{1,40}$/.test(k)) d['por_erro_' + k] = n
    }
  }
  const folga = num(p.capacidade_razao)
  if (folga !== null) d.folga_capacidade = folga
  return d
}

function motivosVermelhos(p: Record<string, unknown>): Motivos[] {
  const m = p.motivos
  return eRec(m) ? ORDEM_MOTIVOS.filter(k => m[k] === true) : []
}

export async function rodarPodaLeiturasWatch(c: ContextoTarefa): Promise<ResultadoTarefa> {
  const def = DEFINICAO_PODA_LEITURAS_WATCH
  const fim = c.t0 + def.fimAteMs

  const falha = await schemaTablesReady(c.sb, [['MG-S4', [['yt_watch_readings', 'id']]]], { signal: AbortSignal.timeout(BANCO_MS) })
  if (falha !== null) return falha.tipo === 'ausente'
    ? { estado: 'parcial', feitas: 0, deixadas: null, motivo: 'schema_ausente' }
    : { estado: 'erro', feitas: 0, deixadas: null, motivo: 'banco_falhou' }

  let leituras = 0, miniaturas = 0, alvos = 0, sobrou = false, lotes = 0
  while (lotes < LOTES_MAX && (lotes === 0 || c.agora() + FOLGA_LOTE_MS < fim)) {
    lotes++
    let data: unknown
    try {
      const r = await c.sb.rpc('yt_watch_poda', { p_agora: new Date(c.agora()).toISOString(), p_lote: LOTE }).abortSignal(AbortSignal.timeout(BANCO_MS))
      if (r.error) {
        if (r.error.code === '42P01') return { estado: 'parcial', feitas: leituras, deixadas: null, motivo: 'schema_ausente' }
        return { estado: 'erro', feitas: leituras, deixadas: null, motivo: 'banco_falhou' }
      }
      data = r.data
    } catch {
      return { estado: 'erro', feitas: leituras, deixadas: null, motivo: 'banco_falhou' }
    }
    if (!eRec(data) || num(data.leituras) === null || typeof data.sobrou !== 'boolean') {
      return { estado: 'erro', feitas: leituras, deixadas: null, motivo: 'banco_falhou' }
    }
    leituras += num(data.leituras) ?? 0
    miniaturas += num(data.miniaturas) ?? 0
    alvos += num(data.alvos) ?? 0
    sobrou = data.sobrou
    if (!sobrou) break
  }

  // Só leitura da lista: o RPC de conciliação não é chamado aqui. Falhou = null (nunca 0): um 0 apagaria o `sem_alvos` no dia em que a lista está quebrada.
  const lidos = await lerCandidatosDaWatch(c.sb, c.agora(), relatarAgenda)
  const candidatosOk = 'valor' in lidos
  const candidatos = candidatosOk ? lidos.valor.candidatos : []
  const esperados: number | null = candidatosOk ? candidatos.length : null

  const ligada = process.env.OBS_WATCH_READ === 'on'
  let prova: Record<string, unknown>
  try {
    const r = await c.sb.rpc('yt_watch_prova', { p_agora: new Date(c.agora()).toISOString(), p_coleta_ligada: ligada, p_candidatos_esperados: esperados }).abortSignal(AbortSignal.timeout(BANCO_MS))
    if (r.error || !eRec(r.data)) return { estado: 'erro', feitas: leituras, deixadas: null, motivo: 'prova_falhou' }
    prova = r.data
  } catch {
    return { estado: 'erro', feitas: leituras, deixadas: null, motivo: 'prova_falhou' }
  }

  const detalhe: Record<string, number> = {
    leituras_podadas: leituras, miniaturas_podadas: miniaturas, alvos_podados: alvos,
    ...detalheDaProva(prova, c.agora()),
  }
  if (!candidatosOk) detalhe.candidatos_falhou = 1

  const vermelhos = motivosVermelhos(prova)
  for (const m of vermelhos) detalhe['prova_vermelha_' + m] = 1
  if (vermelhos.length > 0) {
    const sites = new Set<string>(candidatos.map(x => x.siteId))
    for (const l of c.linhas ?? []) sites.add(l.site_id)
    const frase = vermelhos.map(m => FRASE_PROVA[m](prova)).join('; ')
    const avisos: Aviso[] = [...sites].map(siteId => ({ siteId, chave: 'leitura_watch_vermelha', tarefa: def.rotulo, frase }))
    const restante = Math.min(AVISO_MAX_MS, fim - c.agora())
    if (avisos.length > 0 && restante >= AVISO_MIN_MS) {
      try { await avisarDono(c.sb, avisos, { agoraMs: c.agora(), prazoMs: restante }) } catch { /* o aviso nunca muda o resultado da poda */ }
    }
  }

  return sobrou
    ? { estado: 'parcial', feitas: leituras, deixadas: null, motivo: 'sobrou', detalhe }
    : { estado: 'ok', feitas: leituras, deixadas: 0, detalhe }
}

export const podaLeiturasWatch: Tarefa = {
  ...DEFINICAO_PODA_LEITURAS_WATCH,
  rodar: c => rodarPodaLeiturasWatch(c),
}
