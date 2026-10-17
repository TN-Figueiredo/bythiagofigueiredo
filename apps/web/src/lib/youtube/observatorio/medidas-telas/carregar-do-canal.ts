import 'server-only'
import { unstable_cache } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { observatoryTag } from '../cache-tag'
import { observatoryCacheEnabled } from '../load-page'
import { DAY } from '../time'
import { medidasDoCanal, type Insumos, type MedidasDoCanal } from '../medidas/do-canal'
import { MEASURE_RULES } from '../medidas/regras'
import { lerMudancasDoCanal, lerSeriesDoCanal, type CausaNaoLida, type MarcasDoCanal, type MudancaLida, type Parte, type VideoLido } from '../medidas/ler'
import type { Leitura } from '../medidas/m1'
import type { RetratoDoCanal } from '../medidas/direcao'
import { remontar, type InsumosPlanos } from './insumos-planos'
import { multiplosDoCanal } from './multiplos'
import {
  MEDIDAS_TELAS_V, PRAZO_DAS_MEDIDAS_MS, comPrazo, lerPlanosDoCanal, novosAvisos,
  type CausaDeFalha, type IObservatorioDeMedidas,
} from './carregar-do-site'
import { lerHorasDoCanal, type HorasDoCanal, type LeituraPorHora } from './ler-horas'
import { REGRAS_DAS_72_HORAS as R72 } from './tracao-72h'

/**
 * E5a Tarefa 14a: as medidas de UM canal inteiro, para a página do canal e a do vídeo.
 * Os quatro leitores baratos saem da entrada de cache da Tarefa 2 (mesma função, mesma chave: `lerPlanosDoCanal`); a série e as
 * mudanças, de uma entrada própria por canal (900 s); as horas, de outra (300 s). Só o que foi lido por inteiro é guardado.
 * NUNCA rejeita: toda falha vira `naoCarregou` ou parte não lida. O montador da E4 roda depois, com o relógio da página.
 */

/** Metade do limite de 2 MB por entrada do cache de dados do Next. */
export const SERIE_MAX_BYTES_NO_CACHE = 1_000_000
const VALIDADE_SERIE_S = 900
const VALIDADE_HORAS_S = 300

export type PedidoDoCanalInteiro = {
  siteId: string
  obs: IObservatorioDeMedidas
  channelId: string
  agoraMs: number
  pedir: { serie: boolean; mudancas: boolean; horas: boolean }
}

/** Parte lida ou não lida; a causa de uma parte também pode ser o prazo. */
export type ParteDoCanal<T> = { lido: true; dados: T } | { lido: false; causa: CausaDeFalha }

export interface CanalInteiro {
  medidas: MedidasDoCanal | { naoCarregou: CausaDeFalha }
  videos: ParteDoCanal<VideoLido[]>
  retratos: ParteDoCanal<RetratoDoCanal[]>
  /** As marcas de 1, 7 e 30 dias (as telas refazem o normal sem o próprio vídeo). */
  marcas: ParteDoCanal<MarcasDoCanal>
  serie: ParteDoCanal<Map<string, Leitura[]>> | 'nao_pedida'
  /** Por id do vídeo (a lista plana perderia o vídeo de cada mudança). */
  mudancas: ParteDoCanal<Map<string, MudancaLida[]>> | 'nao_pedida'
  horas: ParteDoCanal<HorasDoCanal> | 'nao_pedida'
  falhas: Array<{ medida: string; classe: string }>
  esgotou: Array<'base' | 'serie' | 'mudancas' | 'horas'>
}

class ParteNaoLida extends Error {
  constructor(public readonly causa: CausaNaoLida) {
    super('parte não lida')
    this.name = 'ParteNaoLida'
  }
}
/** Lançado dentro do cache quando a leitura passou do limite: o Next não guarda o que lança; quem chama usa o dado. */
class ParteGrande<E> extends Error {
  constructor(public readonly entrada: E) {
    super('parte grande demais para o cache')
    this.name = 'ParteGrande'
  }
}

interface EntradaSerie { lidoEm: number; pares: Array<[string, Leitura[]]>; foraDoCanal: number }
interface EntradaMudancas { lidoEm: number; pares: Array<[string, MudancaLida[]]>; foraDoCanal: number }
interface EntradaHoras {
  lidoEm: number
  pares: Array<[string, LeituraPorHora[]]>
  primeiraHoraDoSiteMs: number | null
  ultimoOkDaTarefaMs: number | null
  primeiraExecucaoDaTarefaMs: number | null
  foraDoCanal: number
}

/** Guarda por canal com a etiqueta do site; entrada velha (ou canal sem sincronização boa) lê direto, e o que lança não é guardado. */
async function viaCache<E extends { lidoEm: number }>(o: {
  chave: string[]; siteId: string; agoraMs: number; validadeS: number; usarCache: boolean; ler: () => Promise<E>
}): Promise<E> {
  if (!o.usarCache) return o.ler()
  const guardada = await unstable_cache(o.ler, o.chave, { tags: [observatoryTag(o.siteId)], revalidate: o.validadeS })()
  return o.agoraMs - guardada.lidoEm > o.validadeS * 1000 ? o.ler() : guardada
}

type Lida<E> = { lido: true; entrada: E; grande: boolean } | { lido: false; causa: CausaNaoLida }
async function lerEntrada<E extends { lidoEm: number }>(f: () => Promise<E>): Promise<Lida<E>> {
  try {
    return { lido: true, entrada: await f(), grande: false }
  } catch (err) {
    if (err instanceof ParteGrande) return { lido: true, entrada: err.entrada as E, grande: true }
    if (err instanceof ParteNaoLida) return { lido: false, causa: err.causa }
    return { lido: false, causa: 'erro_do_banco' }
  }
}

const naoLida = <T>(causa: CausaDeFalha): ParteDoCanal<T> => ({ lido: false, causa })
/** O montador da E4 só conhece as causas dos leitores; o prazo vira erro do banco para ele (a tela do canal lê a causa de `CanalInteiro`). */
const paraOMontador = <T>(p: ParteDoCanal<T>): Parte<T> => (p.lido ? p : { lido: false, causa: p.causa === 'tempo_esgotado' ? 'erro_do_banco' : p.causa })

export async function carregarMedidasDoCanalInteiro(sb: SupabaseClient, p: PedidoDoCanalInteiro): Promise<CanalInteiro> {
  try {
    return await carregar(sb, p)
  } catch {
    // erro de código, nunca do banco: nada rejeita
    const pedida = <T>(pediu: boolean): ParteDoCanal<T> | 'nao_pedida' => (pediu ? naoLida('erro_do_banco') : 'nao_pedida')
    return {
      medidas: { naoCarregou: 'erro_do_banco' }, videos: naoLida('erro_do_banco'), retratos: naoLida('erro_do_banco'), marcas: naoLida('erro_do_banco'),
      serie: pedida(p.pedir.serie), mudancas: pedida(p.pedir.mudancas), horas: pedida(p.pedir.horas),
      falhas: [{ medida: 'canal', classe: 'calculo_falhou' }], esgotou: [],
    }
  }
}

async function carregar(sb: SupabaseClient, p: PedidoDoCanalInteiro): Promise<CanalInteiro> {
  const { siteId, channelId, agoraMs, pedir } = p
  const avisos = novosAvisos()
  const falhas: CanalInteiro['falhas'] = []
  const esgotou: CanalInteiro['esgotou'] = []
  const falhou = (medida: string, classe: string): void => { falhas.push({ medida, classe }); avisos.add(medida, classe, channelId) }
  const pedida = <T>(pediu: boolean, causa: CausaDeFalha): ParteDoCanal<T> | 'nao_pedida' => (pediu ? naoLida(causa) : 'nao_pedida')

  // canal próprio ou de outro site: nenhuma consulta
  const canal = p.obs.channels.find((c) => c.id === channelId)
  if (canal === undefined || canal.own) {
    return {
      medidas: { naoCarregou: 'canal_de_outro_site' }, videos: naoLida('canal_de_outro_site'), retratos: naoLida('canal_de_outro_site'), marcas: naoLida('canal_de_outro_site'),
      serie: pedida(pedir.serie, 'canal_de_outro_site'), mudancas: pedida(pedir.mudancas, 'canal_de_outro_site'), horas: pedida(pedir.horas, 'canal_de_outro_site'),
      falhas, esgotou,
    }
  }

  // um prazo só para o conjunto (a página tem 60 s): cada parte ganha o que sobra
  const fim = Date.now() + PRAZO_DAS_MEDIDAS_MS
  const restante = (): number => Math.max(1, fim - Date.now())
  const last = canal.sync.last
  const usarCache = observatoryCacheEnabled() && last !== null

  // ───── a base: canal, vídeos, marcas, retratos ─────
  let planos: InsumosPlanos | 'tempo_esgotado'
  try {
    planos = await comPrazo(lerPlanosDoCanal(sb, { siteId, channelId, agoraMs }, last, avisos), restante())
  } catch {
    falhou('leitura', 'erro_do_banco')
    avisos.fechar()
    return {
      medidas: { naoCarregou: 'erro_do_banco' }, videos: naoLida('erro_do_banco'), retratos: naoLida('erro_do_banco'), marcas: naoLida('erro_do_banco'),
      serie: pedida(pedir.serie, 'erro_do_banco'), mudancas: pedida(pedir.mudancas, 'erro_do_banco'), horas: pedida(pedir.horas, 'erro_do_banco'),
      falhas, esgotou,
    }
  }
  if (planos === 'tempo_esgotado') {
    esgotou.push('base')
    falhou('leitura', 'tempo_esgotado')
    avisos.fechar()
    return {
      medidas: { naoCarregou: 'tempo_esgotado' }, videos: naoLida('tempo_esgotado'), retratos: naoLida('tempo_esgotado'), marcas: naoLida('tempo_esgotado'),
      serie: pedida(pedir.serie, 'tempo_esgotado'), mudancas: pedida(pedir.mudancas, 'tempo_esgotado'), horas: pedida(pedir.horas, 'tempo_esgotado'),
      falhas, esgotou,
    }
  }
  if (!planos.canal.lido) {
    falhou('canal', planos.canal.causa)
    avisos.fechar()
    const c = planos.canal.causa
    return {
      medidas: { naoCarregou: c }, videos: naoLida(c), retratos: naoLida(c), marcas: naoLida(c),
      serie: pedida(pedir.serie, c), mudancas: pedida(pedir.mudancas, c), horas: pedida(pedir.horas, c),
      falhas, esgotou,
    }
  }
  if (!planos.videos.lido) falhou('videos', planos.videos.causa)
  if (!planos.marcas.lido) falhou('marcas', planos.marcas.causa)
  if (!planos.retratos.lido) falhou('retratos', planos.retratos.causa)
  const insumos = remontar(planos)
  const videos: ParteDoCanal<VideoLido[]> = insumos.videos
  const retratos: ParteDoCanal<RetratoDoCanal[]> = insumos.retratos

  // ───── série, mudanças e horas, ao mesmo tempo ─────
  const publicados = (dias: number): Array<{ id: string; publicadoEmMs: number }> => {
    if (!videos.lido) return []
    const minimo = agoraMs - dias * DAY
    const out: Array<{ id: string; publicadoEmMs: number }> = []
    for (const v of videos.dados) {
      const ms = v.publishedAt === null ? Number.NaN : Date.parse(v.publishedAt)
      if (!Number.isNaN(ms) && ms >= minimo) out.push({ id: v.id, publicadoEmMs: ms })
    }
    return out
  }
  const janelaDaSerie = MEASURE_RULES.curve.windowDays
  const desdeDaSerie = new Date(agoraMs - janelaDaSerie * DAY).toISOString().slice(0, 10)
  const idsDaSerie = publicados(janelaDaSerie).map((v) => v.id)
  const esc = { siteId, channelId }

  const quandoVideosNaoLidos = (): ParteDoCanal<never> | null => (videos.lido ? null : naoLida(videos.causa))

  const pedirSerie = async (): Promise<ParteDoCanal<Map<string, Leitura[]>>> => {
    const semVideos = quandoVideosNaoLidos()
    if (semVideos !== null) return semVideos
    if (idsDaSerie.length === 0) return { lido: true, dados: new Map() }
    const l = await lerEntrada<EntradaSerie>(() => viaCache({
      chave: ['medidas-telas-serie', String(MEDIDAS_TELAS_V), siteId, channelId, String(last)], siteId, agoraMs, validadeS: VALIDADE_SERIE_S, usarCache,
      ler: async () => {
        const r = await lerSeriesDoCanal(sb, { ...esc, videoIds: idsDaSerie, desde: desdeDaSerie })
        if (!r.lido) throw new ParteNaoLida(r.causa)
        const e: EntradaSerie = { lidoEm: agoraMs, pares: [...r.dados.series], foraDoCanal: r.dados.foraDoCanal }
        // a decisão de guardar é de agora: o JSON desta leitura, e não o de uma semente
        if (JSON.stringify(e).length > SERIE_MAX_BYTES_NO_CACHE) throw new ParteGrande(e)
        return e
      },
    }))
    if (!l.lido) return naoLida(l.causa)
    if (l.grande) avisos.add('serie', 'grande_demais', channelId)
    return { lido: true, dados: new Map(l.entrada.pares) }
  }

  const pedirMudancas = async (): Promise<ParteDoCanal<Map<string, MudancaLida[]>>> => {
    const semVideos = quandoVideosNaoLidos()
    if (semVideos !== null) return semVideos
    if (idsDaSerie.length === 0) return { lido: true, dados: new Map() }
    const l = await lerEntrada<EntradaMudancas>(() => viaCache({
      chave: ['medidas-telas-mudancas', String(MEDIDAS_TELAS_V), siteId, channelId, String(last)], siteId, agoraMs, validadeS: VALIDADE_SERIE_S, usarCache,
      ler: async () => {
        const r = await lerMudancasDoCanal(sb, { ...esc, videoIds: idsDaSerie, desde: desdeDaSerie })
        if (!r.lido) throw new ParteNaoLida(r.causa)
        const e: EntradaMudancas = { lidoEm: agoraMs, pares: [...r.dados.mudancas], foraDoCanal: r.dados.foraDoCanal }
        if (JSON.stringify(e).length > SERIE_MAX_BYTES_NO_CACHE) throw new ParteGrande(e)
        return e
      },
    }))
    if (!l.lido) return naoLida(l.causa)
    if (l.grande) avisos.add('mudancas', 'grande_demais', channelId)
    return { lido: true, dados: new Map(l.entrada.pares) }
  }

  const pedirHoras = async (): Promise<ParteDoCanal<HorasDoCanal>> => {
    const semVideos = quandoVideosNaoLidos()
    if (semVideos !== null) return semVideos
    const dosNoventa = publicados(R72.VIDEOS_DOS_ULTIMOS_DIAS)
    const l = await lerEntrada<EntradaHoras>(() => viaCache({
      chave: ['medidas-telas-horas', String(MEDIDAS_TELAS_V), siteId, channelId], siteId, agoraMs, validadeS: VALIDADE_HORAS_S, usarCache: observatoryCacheEnabled(),
      ler: async () => {
        const r = await lerHorasDoCanal(sb, { ...esc, videos: dosNoventa, agoraMs })
        if (!r.lido) throw new ParteNaoLida(r.causa)
        const d = r.dados
        return {
          lidoEm: agoraMs, pares: [...d.porVideo], primeiraHoraDoSiteMs: d.primeiraHoraDoSiteMs, ultimoOkDaTarefaMs: d.ultimoOkDaTarefaMs,
          primeiraExecucaoDaTarefaMs: d.primeiraExecucaoDaTarefaMs, foraDoCanal: d.foraDoCanal,
        }
      },
    }))
    if (!l.lido) return naoLida(l.causa)
    const e = l.entrada
    return {
      lido: true,
      dados: {
        porVideo: new Map(e.pares), primeiraHoraDoSiteMs: e.primeiraHoraDoSiteMs, ultimoOkDaTarefaMs: e.ultimoOkDaTarefaMs,
        primeiraExecucaoDaTarefaMs: e.primeiraExecucaoDaTarefaMs, foraDoCanal: e.foraDoCanal,
      },
    }
  }

  /** Cada parte com o que sobra do prazo; a que estoura vira parte não lida com `tempo_esgotado`. */
  const comOPrazo = async <T>(parte: 'serie' | 'mudancas' | 'horas', f: () => Promise<ParteDoCanal<T>>): Promise<ParteDoCanal<T>> => {
    try {
      const r = await comPrazo(f(), restante())
      if (r === 'tempo_esgotado') { esgotou.push(parte); return naoLida('tempo_esgotado') }
      return r
    } catch {
      return naoLida('erro_do_banco')
    }
  }
  const [serie, mudancas, horas] = await Promise.all([
    pedir.serie ? comOPrazo('serie', pedirSerie) : Promise.resolve('nao_pedida' as const),
    pedir.mudancas ? comOPrazo('mudancas', pedirMudancas) : Promise.resolve('nao_pedida' as const),
    pedir.horas ? comOPrazo('horas', pedirHoras) : Promise.resolve('nao_pedida' as const),
  ])
  if (serie !== 'nao_pedida' && !serie.lido) falhou('serie', serie.causa)
  if (mudancas !== 'nao_pedida' && !mudancas.lido) falhou('mudancas', mudancas.causa)
  if (horas !== 'nao_pedida' && !horas.lido) falhou('horas', horas.causa)

  // ───── o montador, com o relógio da página ─────
  const montar: Insumos = {
    ...insumos,
    series: serie === 'nao_pedida' ? 'nao_pedida' : serie.lido ? { lido: true, dados: { series: serie.dados, foraDoCanal: 0 } } : paraOMontador(serie),
    mudancas: mudancas === 'nao_pedida' ? 'nao_pedida' : mudancas.lido ? { lido: true, dados: { mudancas: mudancas.dados, foraDoCanal: 0 } } : paraOMontador(mudancas),
    multiplos: multiplosDoCanal(p.obs, channelId, agoraMs),
  }
  let medidas: CanalInteiro['medidas']
  try {
    const m = medidasDoCanal(montar, { agoraMs })
    for (const f of m.falhas) falhou(f.medida, f.classe)
    medidas = m
  } catch {
    falhou('medidas', 'calculo_falhou')
    medidas = { naoCarregou: 'erro_do_banco' }
  }
  avisos.fechar()
  return { medidas, videos, retratos, marcas: insumos.marcas, serie, mudancas, horas, falhas, esgotou }
}
