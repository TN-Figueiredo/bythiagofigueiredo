/**
 * A tarefa `leitura_horaria` inteira (A5 E16, Tarefa 9): guarda, lista, o que a hora já tem, a curva que faltou, as
 * chamadas ao YouTube, a gravação, a classificação dos negados do dono e a cota.
 *
 * Nenhum texto de fora (banco, YouTube, chave) entra no resultado: o motivo é um código do catálogo da tarefa
 * (`agenda/catalogo.ts`) e o `detalhe` é só número.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { recordQuota } from '@/lib/youtube/competitor-quota'
import { BANCO_MS, HORARIA_FIM_MS, HORARIA_ULTIMA_ONDA_MS, comPrazo } from '@/lib/youtube/agenda/relogio'
import type { Lido, ResultadoTarefa } from '@/lib/youtube/agenda/tipos'
import { RULES } from '@/lib/youtube/observatorio/rules'
import {
  completarCurva, contarNegadosCobraveis, ErroDeLeitura, gravarLeituras, jaLidosNaHora, lerCandidatos, relatarSeguro,
  type RelatarHoraria,
} from './gravar'
import { lerContadores, type ResultadoLeitura } from './leitura'
import { montarLista, type Alvo } from './lista'

const HORA_MS = 3_600_000
/** Nenhuma ida ao banco começa depois de 55 s (o despachante desiste aos 60 s). */
const FOLGA_GRAVACAO_MS = 5_000
const BLOCO_API = 50

export interface ContextoHoraria {
  sb: SupabaseClient
  apiKey: string
  t0: number
  agora: () => number
  guarda: () => Promise<null | { tipo: 'ausente' | 'nao_conferido' }>
  fetchImpl?: typeof fetch
  /** Opcional: a mesma forma de `OpsAgenda.relatar`. Só código de catálogo e `{ classe, sqlstate }`; sem ele, nada é relatado. */
  relatar?: RelatarHoraria
}

const SEM_LEITURA: ResultadoLeitura = {
  contagens: [], chamadas: 0, falhas: 0, idsQueFicaram: [], naoDevolvidos: 0, idsNaoDevolvidos: [],
  semContagem: 0, aoVivo: 0, cotaEsgotada: false,
}

const chaveDe = (a: Alvo): string => `${a.tipo}:${a.tipo === 'proprio' ? a.ytId : a.uuid}`

/** Cada chamada é contada para o site com mais ids no bloco; empate: o menor id de site. */
function unidadesPorSite(blocos: readonly string[][], siteDe: ReadonlyMap<string, string>): Map<string, number> {
  const unidades = new Map<string, number>()
  for (const bloco of blocos) {
    const votos = new Map<string, number>()
    for (const id of bloco) {
      const site = siteDe.get(id)
      if (site !== undefined) votos.set(site, (votos.get(site) ?? 0) + 1)
    }
    let melhor: string | null = null
    for (const [site, n] of votos) {
      const nMelhor = melhor === null ? -1 : votos.get(melhor) ?? -1
      if (n > nMelhor || (n === nMelhor && melhor !== null && site < melhor)) melhor = site
    }
    if (melhor !== null) unidades.set(melhor, (unidades.get(melhor) ?? 0) + 1)
  }
  return unidades
}

export async function executarLeituraHoraria(c: ContextoHoraria): Promise<ResultadoTarefa> {
  const d: Record<string, number> = {
    lista: 0, ja_lidos: 0, pedidos: 0, lidos: 0, cruas: 0, curva: 0, curva_completada: 0,
    proprios_lista: 0, proprios_cruas: 0, proprios_curva: 0,
    fora_do_teto: 0, proprios_fora_do_teto: 0, fora_ao_vivo: 0, fora_ausente: 0, fora_sem_data: 0,
    proprios_fora_nao_publico: 0, proprios_fora_sem_status: 0,
    nao_devolvidos: 0, proprios_nao_devolvidos: 0, proprios_negados_cobraveis: 0, proprios_negados_sem_classe: 0,
    sem_contagem: 0, ao_vivo_na_resposta: 0, chamadas: 0, chamadas_falhas: 0,
  }
  const erro = (motivo: string, feitas = 0): ResultadoTarefa => ({ estado: 'erro', feitas, deixadas: null, motivo, detalhe: { ...d } })
  const podeGravar = (): boolean => c.agora() - c.t0 < HORARIA_FIM_MS - FOLGA_GRAVACAO_MS
  /** O prazo de uma ida ao banco: o de sempre, ou o que falta para os 60 s, o que for menor. */
  const prazoDoBanco = (): number => Math.min(BANCO_MS, HORARIA_FIM_MS - (c.agora() - c.t0))

  // (1) a guarda da MG9
  let guarda: Awaited<ReturnType<ContextoHoraria['guarda']>>
  try {
    guarda = await c.guarda()
  } catch (e) {
    relatarSeguro(c.relatar, 'schema_nao_conferido', e)
    return erro('schema_nao_conferido')
  }
  if (guarda) return erro(guarda.tipo === 'ausente' ? 'schema_ausente' : 'schema_nao_conferido')

  // (2) a lista
  const inicio = c.agora()
  const horaMs = Math.floor(inicio / HORA_MS) * HORA_MS
  const horaIso = new Date(horaMs).toISOString()
  let candidatos: Awaited<ReturnType<typeof lerCandidatos>>
  try {
    candidatos = await lerCandidatos(c.sb, inicio, c.relatar)
  } catch (e) {
    return erro(e instanceof ErroDeLeitura && e.codigo === 'lista_cortada' ? 'lista_cortada' : 'lista_falhou')
  }
  const { alvos, fora } = montarLista(candidatos.conc, candidatos.prop, inicio)
  d.lista = alvos.length
  d.proprios_lista = alvos.filter(a => a.tipo === 'proprio').length
  d.fora_do_teto = fora.teto
  d.proprios_fora_do_teto = fora.tetoProprio
  d.fora_ao_vivo = fora.aoVivo
  d.fora_ausente = fora.ausente
  d.fora_sem_data = fora.semData
  // lista vazia é "nada a ler" (ok, zero), diferente de "não li" (erro)
  if (alvos.length === 0) return { estado: 'ok', feitas: 0, deixadas: 0, detalhe: { ...d } }

  // (3) o que a hora já tem
  let ja: Awaited<ReturnType<typeof jaLidosNaHora>>
  try {
    ja = await jaLidosNaHora(c.sb, horaIso, c.relatar)
  } catch {
    return erro('ja_lidos_falhou')
  }
  const pedidosAlvos = alvos.filter(a => !ja.cruas.has(chaveDe(a)))
  d.ja_lidos = alvos.length - pedidosAlvos.length
  d.pedidos = pedidosAlvos.length

  // (4) a curva que falhou antes, a partir da crua, sem chamar o YouTube
  const completada = await completarCurva(c.sb, alvos, ja, { agoraMs: c.agora(), podeGravar, relatar: c.relatar })
  d.curva_completada = completada.curva + completada.curvaProprio
  const curvaFalhouAntes = completada.falhou

  // (5) as chamadas
  const ids: string[] = []
  const siteDe = new Map<string, string>()
  const proprioDe = new Set<string>()
  for (const a of pedidosAlvos) {
    if (!siteDe.has(a.ytId)) { siteDe.set(a.ytId, a.siteId); ids.push(a.ytId) }
    if (a.tipo === 'proprio') proprioDe.add(a.ytId)
  }
  const leitura = ids.length === 0
    ? SEM_LEITURA
    : await lerContadores(ids, {
        apiKey: c.apiKey, fetchImpl: c.fetchImpl, agora: c.agora,
        podeComecar: () => c.agora() - c.t0 < HORARIA_ULTIMA_ONDA_MS,
      })
  d.chamadas = leitura.chamadas
  d.chamadas_falhas = leitura.falhas
  if (leitura.primeiraFalha?.http != null) d.http_da_primeira_falha = leitura.primeiraFalha.http
  d.nao_devolvidos = leitura.naoDevolvidos
  d.sem_contagem = leitura.semContagem
  d.ao_vivo_na_resposta = leitura.aoVivo
  d.lidos = leitura.contagens.length
  if (leitura.chamadas > 0) {
    const primeira = leitura.contagens.length > 0
      ? Math.min(...leitura.contagens.map(x => Date.parse(x.lidoEm)).filter(Number.isFinite))
      : c.agora()
    d.atraso_s = Math.max(0, Math.round(((Number.isFinite(primeira) ? primeira : c.agora()) - horaMs) / 1000))
  }

  // (6) a gravação
  const g = await gravarLeituras(c.sb, pedidosAlvos, leitura.contagens, { agoraMs: c.agora(), podeGravar, relatar: c.relatar })
  const feitas = g.cruas + g.cruasProprio
  d.cruas = feitas
  d.proprios_cruas = g.cruasProprio
  d.curva = g.curva + g.curvaProprio
  d.proprios_curva = g.curvaProprio
  d.proprios_fora_nao_publico = g.naoPublico
  d.proprios_fora_sem_status = g.semStatus

  // (6b) os vídeos do dono que a resposta desta hora negou: quantos a captura diária ainda diz públicos
  const naoDevolvidos = new Set(leitura.idsNaoDevolvidos)
  d.proprios_nao_devolvidos = pedidosAlvos.filter(a => a.tipo === 'proprio' && naoDevolvidos.has(a.ytId)).length
  const negados = new Set<string>()
  for (const x of leitura.contagens) {
    if (proprioDe.has(x.ytId) && typeof x.privacidade === 'string' && x.privacidade !== 'public') negados.add(x.ytId)
  }
  for (const id of naoDevolvidos) if (proprioDe.has(id)) negados.add(id)
  if (negados.size > 0) {
    let lido: Lido<number>
    try {
      const r = await comPrazo(contarNegadosCobraveis(c.sb, [...negados], c.agora(), c.relatar), prazoDoBanco())
      lido = 'valor' in r ? r.valor : { porque: 'prazo' }
    } catch {
      lido = { porque: 'falhou' }
    }
    if ('valor' in lido) d.proprios_negados_cobraveis = lido.valor
    else d.proprios_negados_sem_classe = negados.size
  }

  // (7) a cota, uma vez por site; não muda o estado do trabalho: o contador `cota_nao_registrada` vai ao detalhe e o
  // despachante o torna problema (vermelho, item 227 do plano), com as leituras gravadas intactas
  if (leitura.chamadas > 0) {
    const blocos: string[][] = []
    for (let i = 0; i < ids.length; i += BLOCO_API) blocos.push(ids.slice(i, i + BLOCO_API))
    const unidades = unidadesPorSite(blocos.slice(0, leitura.chamadas), siteDe)
    const lidosPorSite = new Map<string, number>()
    for (const x of leitura.contagens) {
      const site = siteDe.get(x.ytId)
      if (site !== undefined) lidosPorSite.set(site, (lidosPorSite.get(site) ?? 0) + 1)
    }
    const nowMs = c.agora()
    const registros = await Promise.all([...unidades].map(async ([siteId, units]) => {
      try {
        const r = await comPrazo(
          recordQuota(c.sb, { siteId, nowMs, units, mode: 'horario', extra: { horario_lidos: lidosPorSite.get(siteId) ?? 0, horario_chamadas: units } }),
          prazoDoBanco(),
        )
        if (!('valor' in r)) relatarSeguro(c.relatar, 'cota_nao_registrada')
        return 'valor' in r ? 0 : units
      } catch (e) {
        relatarSeguro(c.relatar, 'cota_nao_registrada', e)
        return units
      }
    }))
    const naoRegistradas = registros.reduce((s, n) => s + n, 0)
    if (naoRegistradas > 0) d.cota_nao_registrada = naoRegistradas
  }

  // o estado, na ordem: o primeiro que valer
  if (g.falhouCruas) return erro('gravacao_falhou', feitas)
  if (g.semTempo && feitas === 0) return erro('gravacao_sem_tempo')
  if (leitura.chamadas > 0 && leitura.falhas === leitura.chamadas) {
    if (leitura.cotaEsgotada) return erro('cota_esgotada')
    if (leitura.primeiraFalha?.tipo === 'api_vazia') {
      d.pedidos_sem_resposta = ids.length
      return erro('resposta_vazia')
    }
    return erro('api_falhou')
  }
  // HTTP 200 sem nenhuma contagem para quase todos os pedidos não é "ok"
  if (leitura.chamadas > 0 && ids.length - leitura.aoVivo > RULES.hourly.emptyAnswerMin && leitura.contagens.length === 0) {
    d.pedidos_sem_resposta = ids.length
    return erro('resposta_vazia')
  }
  const sobrou = leitura.idsQueFicaram.length
  const semGravar = g.semTempo ? Math.max(0, leitura.contagens.length - feitas - g.naoPublico - g.semStatus) : 0
  const deixadas = sobrou + semGravar
  if (sobrou > 0) return { estado: 'parcial', feitas, deixadas, motivo: 'sobrou', detalhe: { ...d } }
  if (curvaFalhouAntes || g.falhouCurva) return { estado: 'parcial', feitas, deixadas, motivo: 'curva_falhou', detalhe: { ...d } }
  if (g.semTempo) return { estado: 'parcial', feitas, deixadas, motivo: 'gravacao_sem_tempo', detalhe: { ...d } }
  return { estado: 'ok', feitas, deixadas: 0, detalhe: { ...d } }
}
