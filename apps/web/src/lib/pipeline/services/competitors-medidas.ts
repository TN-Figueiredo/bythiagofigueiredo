import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fraseDoMotivo } from './competitors-frases'
import { multiplosDoCanal } from '@/lib/youtube/observatorio/medidas-multiplos'
import type { Observatory } from '@/lib/youtube/observatorio'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { naoMedido, type Janela, type Medida, type MotivoNaoMedido, type Nota } from '@/lib/youtube/observatorio/medidas/tipos'
import { lerCanal, lerMarcasDoCanal, lerRetratosDoCanal, lerVideosDoCanal, type Parte } from '@/lib/youtube/observatorio/medidas/ler'
import { medidasDoCanal, type Insumos, type MedidasDoCanal, type PorFormato } from '@/lib/youtube/observatorio/medidas/do-canal'
import type { ValorDirecaoCanal, ValorDirecaoVideos } from '@/lib/youtube/observatorio/medidas/direcao'
import type { EstadoDoCanal } from '@/lib/youtube/observatorio/medidas/estado-canal'
import type { ValorAcerto } from '@/lib/youtube/observatorio/medidas/acerto'
import type { ValorRitmo } from '@/lib/youtube/observatorio/medidas/ritmo'

/**
 * A5 · E7, Tarefa 12: o orquestrador das medidas por canal para o Cowork. Lê com os leitores da E4, monta com `medidasDoCanal` e
 * projeta (só transporte: acrescenta `frase`, omite `notas` vazia, não arredonda nada). Nunca lança; todo canal pedido tem entrada.
 * Tempo: o prazo é do pedido (instante absoluto `prazoAteMs`); canal que não começou ou não terminou até ele sai `leitura_falhou`.
 */

/** Constantes operacionais (tempo e concorrência), não regra de negócio. */
export const CANAIS_EM_PARALELO = 4
export const PRAZO_DO_PEDIDO_MS = 40_000
export const PRAZO_DO_MOTOR_MS = 15_000

// ───── a forma que sai ─────

export type MedidaParaCowork<T> =
  | { estado: 'medido'; valor: T; n: number; janela: Janela; notas?: Nota[] }
  | { estado: 'nao_medido'; motivo: MotivoNaoMedido; frase: string; desde?: string; fechaEm?: string; n?: number; minimo?: number; notas?: Nota[] }

export type SituacaoDoCanal = EstadoDoCanal | 'nao_determinada'

export interface MedidasPorFormatoParaCowork {
  direcao_dos_videos_novos: MedidaParaCowork<ValorDirecaoVideos>
  ritmo: MedidaParaCowork<ValorRitmo>
  taxa_de_acerto: MedidaParaCowork<ValorAcerto>
}

export interface MedidasDoCanalParaCowork {
  direcao_do_canal: MedidaParaCowork<ValorDirecaoCanal>
  estado_do_canal: {
    situacao: SituacaoDoCanal
    confirmada: boolean
    parado: MedidaParaCowork<{ dias: number; limite: number; ultimaEm: number }>
    queda: MedidaParaCowork<{ janelas: number[] }>
  }
  por_formato: Record<'long' | 'short', MedidasPorFormatoParaCowork>
}

export interface MedidasIndisponiveis { total: number; indisponiveis: number; por_motivo: Record<string, number> }
export interface MedidasMeta { calculado_em: string; regra: number; duracao_ms: number; canais_cortados_por_tempo: number }

/** A projeção de uma medida: acrescenta `frase` à não medida e omite `notas` vazia. Nenhum número é tocado. */
export function paraCowork<T>(m: Medida<T>): MedidaParaCowork<T> {
  if (m.estado === 'medido') {
    return m.notas.length > 0
      ? { estado: 'medido', valor: m.valor, n: m.n, janela: m.janela, notas: m.notas }
      : { estado: 'medido', valor: m.valor, n: m.n, janela: m.janela }
  }
  return {
    estado: 'nao_medido', motivo: m.motivo, frase: fraseDoMotivo(m),
    ...(m.desde !== undefined ? { desde: m.desde } : {}),
    ...(m.fechaEm !== undefined ? { fechaEm: m.fechaEm } : {}),
    ...(m.n !== undefined ? { n: m.n } : {}),
    ...(m.minimo !== undefined ? { minimo: m.minimo } : {}),
    ...(m.notas.length > 0 ? { notas: m.notas } : {}),
  }
}

// ───── a corrida contra o prazo ─────

/**
 * Chama `f` UMA vez e a disputa com um temporizador de `ateMs - relogio()`. Prazo já vencido: `terminou: false` sem chamar `f`.
 * A rejeição de `f` sobe. A promessa que perdeu a corrida ganha um `.catch` vazio. O temporizador é sempre limpo.
 */
export async function contraOPrazo<T>(
  f: () => Promise<T>, ateMs: number, relogio: () => number,
): Promise<{ terminou: true; valor: T } | { terminou: false }> {
  const resta = ateMs - relogio()
  if (resta <= 0) return { terminou: false }
  const promessa = f()
  let temporizador: ReturnType<typeof setTimeout> | undefined
  const prazo = new Promise<{ terminou: false }>((resolve) => {
    temporizador = setTimeout(() => resolve({ terminou: false }), resta)
  })
  try {
    return await Promise.race([promessa.then((valor) => ({ terminou: true as const, valor })), prazo])
  } finally {
    clearTimeout(temporizador)
    promessa.catch(() => undefined)
  }
}

// ───── as nove medidas quando não há o que dizer ─────

/** As nove em `leitura_falhou` e a situação `nao_determinada`: o que um canal recebe quando nada pôde ser lido. */
export function medidasTodasEmFalha(): MedidasDoCanalParaCowork {
  const f = (): MedidaParaCowork<never> => paraCowork(naoMedido('leitura_falhou'))
  const formato = (): MedidasPorFormatoParaCowork => ({ direcao_dos_videos_novos: f(), ritmo: f(), taxa_de_acerto: f() })
  return {
    direcao_do_canal: f(),
    estado_do_canal: { situacao: 'nao_determinada', confirmada: false, parado: f(), queda: f() },
    por_formato: { long: formato(), short: formato() },
  }
}

/** As nove medidas de um canal, na ordem fixa em que `medidas_indisponiveis` as conta. */
function asNove(m: MedidasDoCanalParaCowork): Array<MedidaParaCowork<unknown>> {
  return [
    m.direcao_do_canal, m.estado_do_canal.parado, m.estado_do_canal.queda,
    m.por_formato.long.direcao_dos_videos_novos, m.por_formato.long.ritmo, m.por_formato.long.taxa_de_acerto,
    m.por_formato.short.direcao_dos_videos_novos, m.por_formato.short.ritmo, m.por_formato.short.taxa_de_acerto,
  ]
}

/**
 * O Short não tem direção dos vídeos novos na E4 (M3 b é dos longos: `PorFormato` não tem `m3b`). A chave existe nos dois
 * formatos para a forma ser a mesma; no Short ela diz "poucos vídeos" sem número, que é o exemplo do plano (apêndice B).
 */
// TEXTO-A-REVISAR: a E4 não tem motivo "não se aplica ao Short"; ver o relatório (decisão do dono ou da E4).
const direcaoDoShort = (videosLidos: boolean): Medida<ValorDirecaoVideos> => naoMedido(videosLidos ? 'poucos_videos' : 'leitura_falhou')

function projetar(m: MedidasDoCanal, obsNulo: boolean, videosLidos: boolean): MedidasDoCanalParaCowork {
  const acerto = (f: PorFormato): MedidaParaCowork<ValorAcerto> => paraCowork(obsNulo ? naoMedido('leitura_falhou') : f.m4)
  const { estado, parado, queda } = m.m8
  const situacao: SituacaoDoCanal = estado.estado === 'medido' ? estado.valor : 'nao_determinada'
  // "ativo" só é afirmado com a queda e o parado medidos; fora do ar, parado e em queda são fatos; pausado e indeterminado não.
  const confirmada = situacao === 'nao_determinada' || situacao === 'pausado' ? false
    : situacao !== 'ativo' ? true
    : parado.estado === 'medido' && queda.estado === 'medido'
  return {
    direcao_do_canal: paraCowork(m.m3a),
    estado_do_canal: { situacao, confirmada, parado: paraCowork(parado), queda: paraCowork(queda) },
    por_formato: {
      long: { direcao_dos_videos_novos: paraCowork(m.porFormato.long.m3b), ritmo: paraCowork(m.porFormato.long.m6), taxa_de_acerto: acerto(m.porFormato.long) },
      short: { direcao_dos_videos_novos: paraCowork(direcaoDoShort(videosLidos)), ritmo: paraCowork(m.porFormato.short.m6), taxa_de_acerto: acerto(m.porFormato.short) },
    },
  }
}

// ───── um canal ─────

type CausaDeLeitura = Extract<Parte<never>, { lido: false }>['causa']
const naoLida = (p: { causa: CausaDeLeitura }): { lido: false; causa: CausaDeLeitura } => ({ lido: false, causa: p.causa })

async function medirCanal(
  sb: SupabaseClient, siteId: string, channelId: string, obs: Observatory | null, agoraMs: number,
): Promise<MedidasDoCanalParaCowork> {
  const e = { siteId, channelId }
  const canal = await lerCanal(sb, e)
  const multiplos = obs === null ? ('nao_pedido' as const) : multiplosDoCanal(obs, channelId, agoraMs)
  if (!canal.lido) {
    // outro site ou erro: nenhum outro leitor é chamado para este canal
    const nl = naoLida(canal)
    const insumos: Insumos = { canal, videos: nl, marcas: nl, retratos: nl, series: 'nao_pedida', mudancas: 'nao_pedida', multiplos, comentarios: 'nao_pedido' }
    return projetar(medidasDoCanal(insumos, { agoraMs }), obs === null, false)
  }
  const videos = await lerVideosDoCanal(sb, e)
  const [marcas, retratos] = await Promise.all([
    videos.lido ? lerMarcasDoCanal(sb, { ...e, videoIds: videos.dados.map((v) => v.id) }) : Promise.resolve(naoLida(videos)),
    lerRetratosDoCanal(sb, { ...e, agoraMs }),
  ])
  const montado = medidasDoCanal(
    { canal, videos, marcas, retratos, series: 'nao_pedida', mudancas: 'nao_pedida', multiplos, comentarios: 'nao_pedido' },
    { agoraMs },
  )
  for (const f of montado.falhas) {
    Sentry.captureMessage('competitors-medidas.calculo_falhou', { extra: { medida: f.medida, classe: f.classe } })
  }
  return projetar(montado, obs === null, canal.lido && videos.lido)
}

// ───── os canais ─────

export interface DependenciasDeMedidas { supabase: SupabaseClient; siteId: string }
export interface OpcoesDeMedidas {
  obs: Observatory | null
  agoraMs: number
  /** Instante absoluto (na escala de `relogio`) em que o pedido inteiro deve estar resolvido. */
  prazoAteMs: number
  relogio?: () => number
}
export interface ResultadoDeMedidas {
  porCanal: Map<string, MedidasDoCanalParaCowork>
  indisponiveis: MedidasIndisponiveis
  meta: MedidasMeta
}

/** Nunca lança; todo `id` de `canais` tem entrada em `porCanal`. No pior caso devolve em `prazoAteMs` mais o tempo de montar a saída. */
export async function medidasDosCanais(
  dep: DependenciasDeMedidas, canais: ReadonlyArray<{ id: string }>, o: OpcoesDeMedidas,
): Promise<ResultadoDeMedidas> {
  const relogio = o.relogio ?? Date.now
  const inicio = relogio()
  const porCanal = new Map<string, MedidasDoCanalParaCowork>()
  let cortados = 0

  async function um(id: string): Promise<void> {
    try {
      const r = await contraOPrazo(() => medirCanal(dep.supabase, dep.siteId, id, o.obs, o.agoraMs), o.prazoAteMs, relogio)
      if (r.terminou) { porCanal.set(id, r.valor); return }
      cortados++
    } catch (err) {
      // defeito: o canal sai com as nove em falha, os outros seguem
      Sentry.captureException(err)
    }
    if (!porCanal.has(id)) porCanal.set(id, medidasTodasEmFalha())
  }

  let proximo = 0
  const trabalhadores = Array.from({ length: Math.min(CANAIS_EM_PARALELO, canais.length) }, async () => {
    for (;;) {
      const i = proximo++
      const c = canais[i]
      if (c === undefined) return
      await um(c.id)
    }
  })
  await Promise.all(trabalhadores)

  let indisponiveis = 0
  const por_motivo: Record<string, number> = {}
  for (const c of canais) {
    if (!porCanal.has(c.id)) porCanal.set(c.id, medidasTodasEmFalha())
    for (const m of asNove(porCanal.get(c.id)!)) {
      if (m.estado === 'nao_medido') { indisponiveis++; por_motivo[m.motivo] = (por_motivo[m.motivo] ?? 0) + 1 }
    }
  }
  return {
    porCanal,
    indisponiveis: { total: canais.length * 9, indisponiveis, por_motivo },
    meta: { calculado_em: new Date(o.agoraMs).toISOString(), regra: MEASURE_RULES.ruleVersion, duracao_ms: Math.max(0, relogio() - inicio), canais_cortados_por_tempo: cortados },
  }
}
