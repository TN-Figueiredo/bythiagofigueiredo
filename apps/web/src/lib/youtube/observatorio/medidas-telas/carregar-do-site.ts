import 'server-only'
import { unstable_cache } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { observatoryTag } from '../cache-tag'
import { observatoryCacheEnabled } from '../load-page'
import { DAY } from '../time'
import { medidasDoCanal, type Insumos, type MedidasDoCanal } from '../medidas/do-canal'
import { lerCanal, lerMarcasDoCanal, lerRetratosDoCanal, lerSeriesDoCanal, lerVideosDoCanal, type CausaNaoLida, type Parte } from '../medidas/ler'
import { lerExtrasDosCanais, type ExtrasDoCanal } from './ler-extras-dos-canais'
import { aplanar, remontar, type InsumosPlanos } from './insumos-planos'
import { multiplosDoCanal } from './multiplos'
import type { IMotorDeMultiplos } from '../medidas-multiplos'

/**
 * A5 E5a, Tarefa 2: as medidas de todos os canais concorrentes do site, para as telas (Canais, Comparar, Outliers, Insights...).
 * Lê com os leitores da E4 (que recebem o cliente por parâmetro: aqui nenhum cliente de serviço é criado), guarda em cache só o
 * que foi lido por inteiro (por canal, 900 s) e monta as medidas com `medidasDoCanal` a cada abertura (o montador depende do relógio
 * e nunca é guardado). Nunca derruba a tela: canal que falha vira `{ naoCarregou: causa }`.
 */

export const MEDIDAS_TELAS_V = 2
export const CANAIS_AO_MESMO_TEMPO = 6
export const PRAZO_DAS_MEDIDAS_MS = 12_000
const VALIDADE_S = 900
const VALIDADE_MS = VALIDADE_S * 1000

export type CausaDeFalha = CausaNaoLida | 'tempo_esgotado'

/** O pedaço do `Observatory` de que este módulo precisa. */
export interface IObservatorioDeMedidas extends IMotorDeMultiplos {
  channels: ReadonlyArray<{ id: string; own: boolean; sync: { last: number | null } }>
}

export interface MedidasDoSite {
  porCanal: Map<string, MedidasDoCanal | { naoCarregou: CausaDeFalha }>
  extras: Parte<Map<string, ExtrasDoCanal>> | { lido: false; causa: 'tempo_esgotado' }
  falhas: Array<{ canal: string; medida: string; classe: string }>
  esgotou: number
  /** E5a T8 (Outliers): de cada vídeo lido, só o que a tela não acha nas medidas (`was_live` e `missing_since`). Ausente = quem montou o conjunto não o trouxe. */
  videos?: Map<string, InfoDoVideo>
}
export interface InfoDoVideo { wasLive: boolean | null; missingSince: number | null }

/** Lançado dentro do cache quando alguma parte voltou não lida: o Next não guarda o que lança. Carrega o que foi lido. */
export class LeituraParcial extends Error {
  constructor(public readonly insumos: InsumosPlanos) {
    super('leitura parcial')
    this.name = 'LeituraParcial'
  }
}
class ExtrasNaoLidos extends Error {
  constructor(public readonly causa: CausaNaoLida) {
    super('extras não lidos')
    this.name = 'ExtrasNaoLidos'
  }
}

interface EntradaDoCanal { lidoEm: number; planos: InsumosPlanos }
interface EntradaDosExtras { lidoEm: number; pares: Array<[string, ExtrasDoCanal]> }

const naoLida = <T>(causa: CausaNaoLida): Parte<T> => ({ lido: false, causa })

/** Lê as quatro partes pesadas. Canal que não responde: as outras já nascem não lidas com a mesma causa, sem mais consultas. */
async function lerPartes(sb: SupabaseClient, o: { siteId: string; channelId: string; agoraMs: number }): Promise<InsumosPlanos> {
  const base = (c: Insumos['canal'], v: Insumos['videos'], m: Insumos['marcas'], r: Insumos['retratos']): InsumosPlanos =>
    aplanar({ canal: c, videos: v, marcas: m, retratos: r, series: 'nao_pedida', mudancas: 'nao_pedida', multiplos: 'nao_pedido', comentarios: 'nao_pedido' })
  const esc = { siteId: o.siteId, channelId: o.channelId }
  const canal = await lerCanal(sb, esc)
  if (!canal.lido) return base(canal, naoLida(canal.causa), naoLida(canal.causa), naoLida(canal.causa))
  const [videos, retratos] = await Promise.all([lerVideosDoCanal(sb, esc), lerRetratosDoCanal(sb, { ...esc, agoraMs: o.agoraMs })])
  const marcas = videos.lido ? await lerMarcasDoCanal(sb, { ...esc, videoIds: videos.dados.map((v) => v.id) }) : naoLida<Insumos['marcas'] extends Parte<infer M> ? M : never>(videos.causa)
  return base(canal, videos, marcas, retratos)
}

const tudoLido = (p: InsumosPlanos): boolean => p.canal.lido && p.videos.lido && p.marcas.lido && p.retratos.lido

/** A entrada do cache passou de ~1,5 MB: o Next recusa acima de 2 MB (e só avisa no console), e toda abertura do canal vira fria. */
export const ORCAMENTO_DA_ENTRADA = 1_500_000

async function lerParaOCache(sb: SupabaseClient, o: { siteId: string; channelId: string; agoraMs: number }, avisos: Avisos): Promise<EntradaDoCanal> {
  const planos = await lerPartes(sb, o)
  // o que não foi lido por inteiro não é guardado
  if (!tudoLido(planos)) throw new LeituraParcial(planos)
  if (JSON.stringify(planos).length > ORCAMENTO_DA_ENTRADA) avisos.add('cache', 'acima_do_orcamento', o.channelId)
  return { lidoEm: o.agoraMs, planos }
}

const naoLidas = (p: InsumosPlanos): Array<{ medida: string; causa: CausaNaoLida }> => {
  const out: Array<{ medida: string; causa: CausaNaoLida }> = []
  if (!p.canal.lido) out.push({ medida: 'canal', causa: p.canal.causa })
  if (!p.videos.lido) out.push({ medida: 'videos', causa: p.videos.causa })
  if (!p.marcas.lido) out.push({ medida: 'marcas', causa: p.marcas.causa })
  if (!p.retratos.lido) out.push({ medida: 'retratos', causa: p.retratos.causa })
  return out
}

/**
 * Falhas de uma abertura, agrupadas: UM evento por par medida/causa ao fechar, com o nº de canais (cada captureMessage conta na cota
 * do Sentry; uma falha persistente por canal e por abertura a esgotaria). Depois de fechado, escritas tardias (leitura que estourou o
 * prazo) são descartadas.
 */
export interface Avisos { add(medida: string, causa: string, canal: string): void; fechar(): void; readonly fechado: boolean }

export function novosAvisos(): Avisos {
  const grupos = new Map<string, { medida: string; causa: string; canais: Set<string> }>()
  let fechado = false
  return {
    get fechado() { return fechado },
    add(medida, causa, canal) {
      if (fechado) return
      const k = medida + '|' + causa
      const g = grupos.get(k) ?? { medida, causa, canais: new Set<string>() }
      g.canais.add(canal)
      grupos.set(k, g)
    },
    fechar() {
      if (fechado) return
      fechado = true
      for (const g of grupos.values()) {
        Sentry.captureMessage('observatório: medida das telas não carregou (' + g.medida + ': ' + g.causa + ')', {
          level: 'warning', fingerprint: ['medidas-telas', g.medida, g.causa], tags: { component: 'observatorio', step: 'medidas-telas' },
          extra: { canais: g.canais.size, exemplo: [...g.canais].slice(0, 5) },
        })
      }
    },
  }
}

export function comPrazo<T>(p: Promise<T>, ms: number): Promise<T | 'tempo_esgotado'> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve('tempo_esgotado'), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e: unknown) => { clearTimeout(t); reject(e) })
  })
}

export async function mapaComLimite<A, B>(itens: readonly A[], limite: number, f: (a: A) => Promise<B>): Promise<B[]> {
  const out = new Array<B>(itens.length)
  let prox = 0
  const operario = async (): Promise<void> => { for (let i = prox++; i < itens.length; i = prox++) out[i] = await f(itens[i]!) }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, operario))
  return out
}

export interface PedidoDasMedidas {
  siteId: string
  obs: IObservatorioDeMedidas
  canais: readonly string[]
  agoraMs: number
  seriesDe?: ReadonlyMap<string, readonly string[]>
}

async function lerExtras(sb: SupabaseClient, siteId: string, agoraMs: number): Promise<Parte<Map<string, ExtrasDoCanal>>> {
  const direto = async (): Promise<EntradaDosExtras> => {
    const r = await lerExtrasDosCanais(sb, { siteId })
    if (!r.lido) throw new ExtrasNaoLidos(r.causa)
    return { lidoEm: agoraMs, pares: [...r.dados] }
  }
  try {
    let e: EntradaDosExtras
    if (!observatoryCacheEnabled()) e = await direto()
    else {
      const guardada = await unstable_cache(direto, ['medidas-telas-extras', String(MEDIDAS_TELAS_V), siteId], { tags: [observatoryTag(siteId)], revalidate: VALIDADE_S })()
      // entrada velha não é falha: lê de novo, direto
      e = agoraMs - guardada.lidoEm > VALIDADE_MS ? await direto() : guardada
    }
    return { lido: true, dados: new Map(e.pares) }
  } catch (err) {
    if (err instanceof ExtrasNaoLidos) return naoLida(err.causa)
    return naoLida('erro_do_banco')
  }
}

/**
 * E5a T14a: os quatro leitores baratos de UM canal, pela mesma entrada de cache de `carregarMedidasDoSite` (mesma função, mesma chave:
 * a página do canal depois da lista não relê). Devolve os planos mesmo parciais (`LeituraParcial`); qualquer outro erro lança.
 */
export async function lerPlanosDoCanal(sb: SupabaseClient, o: { siteId: string; channelId: string; agoraMs: number }, last: number | null, avisos: Avisos): Promise<InsumosPlanos> {
  try {
    let entrada: EntradaDoCanal
    if (!observatoryCacheEnabled() || last === null) entrada = await lerParaOCache(sb, o, avisos)
    else {
      const guardada = await unstable_cache(() => lerParaOCache(sb, o, avisos), ['medidas-telas', String(MEDIDAS_TELAS_V), o.siteId, o.channelId, String(last)], { tags: [observatoryTag(o.siteId)], revalidate: VALIDADE_S })()
      entrada = o.agoraMs - guardada.lidoEm > VALIDADE_MS ? await lerParaOCache(sb, o, avisos) : guardada
    }
    return entrada.planos
  } catch (err) {
    if (err instanceof LeituraParcial) return err.insumos
    throw err
  }
}

export async function carregarMedidasDoSite(sb: SupabaseClient, p: PedidoDasMedidas): Promise<MedidasDoSite> {
  const falhas: MedidasDoSite['falhas'] = []
  const avisos = novosAvisos()
  /** Registra a falha de um canal (tela) e a soma ao aviso do par medida/causa; nada depois do fechamento. */
  const falhou = (canal: string, medida: string, classe: string): void => {
    if (avisos.fechado) return
    falhas.push({ canal, medida, classe })
    avisos.add(medida, classe, canal)
  }
  const porCanal: MedidasDoSite['porCanal'] = new Map()
  const videos = new Map<string, InfoDoVideo>()
  let esgotou = 0
  const proprios = new Set(p.obs.channels.filter((c) => c.own).map((c) => c.id))
  const aLer = [...new Set(p.canais)].filter((id) => !proprios.has(id))
  const lastDe = new Map(p.obs.channels.map((c) => [c.id, c.sync.last]))

  const lerUm = async (channelId: string): Promise<MedidasDoCanal | { naoCarregou: CausaDeFalha }> => {
    const o = { siteId: p.siteId, channelId, agoraMs: p.agoraMs }
    const last = lastDe.get(channelId) ?? null
    let planos: InsumosPlanos
    try {
      planos = await lerPlanosDoCanal(sb, o, last, avisos)
    } catch {
      falhou(channelId, 'leitura', 'erro_do_banco')
      return { naoCarregou: 'erro_do_banco' }
    }
    for (const f of naoLidas(planos)) {
      falhou(channelId, f.medida, f.causa)
    }
    if (!planos.canal.lido) return { naoCarregou: planos.canal.causa }
    const insumos = remontar(planos)
    if (insumos.videos.lido) {
      for (const v of insumos.videos.dados) {
        const ms = v.missingSince === null ? Number.NaN : Date.parse(v.missingSince)
        videos.set(v.id, { wasLive: v.wasLive, missingSince: Number.isNaN(ms) ? null : ms })
      }
    }
    const series = p.seriesDe?.get(channelId)
    if (series !== undefined && series.length > 0) {
      insumos.series = await lerSeriesDoCanal(sb, { siteId: p.siteId, channelId, videoIds: series, desde: new Date(p.agoraMs - 120 * DAY).toISOString().slice(0, 10) })
    }
    insumos.multiplos = multiplosDoCanal(p.obs, channelId, p.agoraMs)
    const m = medidasDoCanal(insumos, { agoraMs: p.agoraMs })
    for (const f of m.falhas) {
      falhou(channelId, f.medida, f.classe)
    }
    return m
  }

  // um prazo só para o conjunto (a página tem 60 s): fim = início + PRAZO, e não 12 s por canal
  const fim = Date.now() + PRAZO_DAS_MEDIDAS_MS
  const [extrasLidos] = await Promise.all([
    comPrazo(lerExtras(sb, p.siteId, p.agoraMs), Math.max(1, fim - Date.now())),
    mapaComLimite(aLer, CANAIS_AO_MESMO_TEMPO, async (id) => {
      let r: Awaited<ReturnType<typeof lerUm>> | 'tempo_esgotado'
      const restante = fim - Date.now()
      if (restante <= 0) r = 'tempo_esgotado' // o prazo do conjunto já passou: nem começa (sem consulta)
      else {
        try {
          r = await comPrazo(lerUm(id), restante)
        } catch {
          // lançou fora das leituras (cálculo): erro de código, não do banco; vai ao Sentry com causa própria
          r = { naoCarregou: 'erro_do_banco' }
          falhou(id, 'leitura', 'calculo_falhou')
        }
      }
      if (r === 'tempo_esgotado') {
        esgotou++
        falhou(id, 'leitura', 'tempo_esgotado')
        r = { naoCarregou: 'tempo_esgotado' }
      }
      porCanal.set(id, r)
    }),
  ])
  const extras: MedidasDoSite['extras'] = extrasLidos === 'tempo_esgotado' ? { lido: false, causa: 'tempo_esgotado' } : extrasLidos
  if (!extras.lido) avisos.add('extras', extras.causa, '-')
  avisos.fechar()
  return { porCanal, extras, falhas, esgotou, videos }
}
