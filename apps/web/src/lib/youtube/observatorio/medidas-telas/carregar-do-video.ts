import 'server-only'
// A5 E5a, portão do L7a (Phil I2, emenda 17/10 ao plano §4.8): o vídeo fora da janela do conjunto do canal.
// O conjunto só pede série e mudanças dos vídeos publicados nos últimos `curve.windowDays` (180) dias e as horas dos dos últimos 90; o vídeo
// mais velho chegava à tela com lista vazia, que passava por "lido e sem nada" (falha em verde). Aqui a série, as mudanças e as horas SÓ DESSE
// vídeo são lidas com os mesmos leitores e postas sobre o conjunto; o que não for lido vira `semLeitura` e o bloco diz "não carregou".
// Nunca rejeita. Vídeo dentro da janela: nenhuma consulta.
import { unstable_cache } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { observatoryTag } from '../cache-tag'
import { observatoryCacheEnabled } from '../load-page'
import { DAY } from '../time'
import { subidasDoVideoLido } from '../medidas/do-canal'
import { lerMudancasDoCanal, lerSeriesDoCanal, type MudancaLida } from '../medidas/ler'
import type { Leitura } from '../medidas/m1'
import { MEASURE_RULES } from '../medidas/regras'
import { naoMedido } from '../medidas/tipos'
import { PRAZO_DAS_MEDIDAS_MS, MEDIDAS_TELAS_V, comPrazo } from './carregar-do-site'
import type { CanalInteiro } from './carregar-do-canal'
import { lerHorasDoCanal, type LeituraPorHora } from './ler-horas'
import { REGRAS_DAS_72_HORAS as R72 } from './tracao-72h'

const VALIDADE_S = 900

/** O que não foi lido do vídeo: a tela diz "não carregou" nesses blocos, nunca "nenhuma mudança" nem "sem contagem". */
export interface SemLeitura { serie?: true; mudancas?: true; horas?: true }
export interface CanalComOVideo { canal: CanalInteiro; semLeitura: SemLeitura; leituraExtra: boolean }

export interface PedidoDoVideo {
  siteId: string
  channelId: string
  agoraMs: number
  /** `canal.sync.last` do motor: parte da chave do cache (muda quando o canal sincroniza). */
  okSyncedAt: number | null
  video: { id: string; publicadoEmMs: number; baseMs: number }
  /** Teste: troca os leitores. */
  leitores?: { series: typeof lerSeriesDoCanal; mudancas: typeof lerMudancasDoCanal; horas: typeof lerHorasDoCanal }
}

/** Guarda por vídeo; o que lança não é guardado (o Next não guarda erro) e vira `null`. */
async function lerGuardado<T>(p: PedidoDoVideo, parte: string, ler: () => Promise<T>): Promise<T | null> {
  try {
    const f = comPrazo(
      observatoryCacheEnabled() && p.okSyncedAt !== null
        ? unstable_cache(ler, ['medidas-telas-video', parte, String(MEDIDAS_TELAS_V), p.siteId, p.video.id, String(p.okSyncedAt)], { tags: [observatoryTag(p.siteId)], revalidate: VALIDADE_S })()
        : ler(),
      PRAZO_DAS_MEDIDAS_MS,
    )
    const r = await f
    return r === 'tempo_esgotado' ? null : r
  } catch {
    return null
  }
}

export async function completarVideoForaDaJanela(sb: SupabaseClient, canal: CanalInteiro, p: PedidoDoVideo): Promise<CanalComOVideo> {
  const nada: CanalComOVideo = { canal, semLeitura: {}, leituraExtra: false }
  try {
    const { id, publicadoEmMs, baseMs } = p.video
    const foraDaSerie = publicadoEmMs < p.agoraMs - MEASURE_RULES.curve.windowDays * DAY
    const foraDasHoras = baseMs < p.agoraMs - R72.VIDEOS_DOS_ULTIMOS_DIAS * DAY
    // só se completa o que o conjunto leu: parte do canal não lida continua não lida (misturar um vídeo só estragaria o normal do canal)
    const serie = canal.serie !== 'nao_pedida' && canal.serie.lido ? canal.serie : null
    const mud = canal.mudancas !== 'nao_pedida' && canal.mudancas.lido ? canal.mudancas : null
    const horas = canal.horas !== 'nao_pedida' && canal.horas.lido ? canal.horas : null
    const querSerie = foraDaSerie && serie !== null
    const querMud = foraDaSerie && mud !== null
    const querHoras = foraDasHoras && horas !== null
    if (!querSerie && !querMud && !querHoras) return nada

    const l = p.leitores ?? { series: lerSeriesDoCanal, mudancas: lerMudancasDoCanal, horas: lerHorasDoCanal }
    const esc = { siteId: p.siteId, channelId: p.channelId }
    // a série inteira do vídeo: do dia anterior à publicação (a leitura diária só existe desde 24/08, então são poucas linhas)
    const desde = new Date(publicadoEmMs - DAY).toISOString().slice(0, 10)
    const [leituras, mudancas, porHora] = await Promise.all([
      querSerie ? lerGuardado<Leitura[]>(p, 'serie', async () => {
        const r = await l.series(sb, { ...esc, videoIds: [id], desde })
        if (!r.lido) throw new Error('serie_nao_lida')
        return r.dados.series.get(id) ?? []
      }) : Promise.resolve(undefined),
      querMud ? lerGuardado<MudancaLida[]>(p, 'mudancas', async () => {
        const r = await l.mudancas(sb, { ...esc, videoIds: [id], desde })
        if (!r.lido) throw new Error('mudancas_nao_lidas')
        return r.dados.mudancas.get(id) ?? []
      }) : Promise.resolve(undefined),
      querHoras ? lerGuardado<LeituraPorHora[]>(p, 'horas', async () => {
        const r = await l.horas(sb, { ...esc, videos: [{ id, publicadoEmMs: baseMs }], agoraMs: p.agoraMs })
        if (!r.lido) throw new Error('horas_nao_lidas')
        return r.dados.porVideo.get(id) ?? []
      }) : Promise.resolve(undefined),
    ])

    const semLeitura: SemLeitura = {}
    let serieNova = canal.serie
    let mudNova = canal.mudancas
    let horasNova = canal.horas
    if (querSerie) { if (leituras === null || leituras === undefined) semLeitura.serie = true; else serieNova = { lido: true, dados: new Map(serie!.dados).set(id, leituras) } }
    if (querMud) { if (mudancas === null || mudancas === undefined) semLeitura.mudancas = true; else mudNova = { lido: true, dados: new Map(mud!.dados).set(id, mudancas) } }
    if (querHoras) {
      if (porHora === null || porHora === undefined) semLeitura.horas = true
      else horasNova = { lido: true, dados: { ...horas!.dados, porVideo: new Map(horas!.dados.porVideo).set(id, porHora) } }
    }

    // a subida (M5) foi calculada pelo conjunto SEM a série deste vídeo; refaz só a dele
    let medidas = canal.medidas
    if (querSerie && 'porVideo' in medidas) {
      const mv = medidas.porVideo.get(id)
      if (mv !== undefined) {
        const m5 = semLeitura.serie === true || semLeitura.mudancas === true || leituras == null || mudancas == null
          ? naoMedido('leitura_falhou')
          : subidasDoVideoLido(leituras, mudancas)
        medidas = { ...medidas, porVideo: new Map(medidas.porVideo).set(id, { ...mv, m5 }) }
      }
    }
    return { canal: { ...canal, serie: serieNova, mudancas: mudNova, horas: horasNova, medidas }, semLeitura, leituraExtra: true }
  } catch {
    // erro de código: o vídeo fica sem leitura nas três partes, nunca "lido e vazio"
    return { canal, semLeitura: { serie: true, mudancas: true, horas: true }, leituraExtra: false }
  }
}
