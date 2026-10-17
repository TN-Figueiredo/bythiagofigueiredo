/**
 * A leitura das medidas do Histórico do vídeo de concorrente, UMA só, para a tela (`BlocosDoVideo`) e para o pacote "Perguntar a uma IA": o
 * conjunto do canal inteiro, o vídeo fora da janela completado e `derivarDoVideo`. Nunca lança por causa do conjunto (devolve `null`: a tela
 * mostra o estado de erro e o pacote diz "não carregou"); falha inesperada de banco sobe, como na tela.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { ObsVideo } from '@/lib/youtube/observatorio/types'
import { baseDaIdade } from '@/lib/youtube/observatorio/medidas/m1'
import { carregarMedidasDoCanalInteiro, type CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import { completarVideoForaDaJanela } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-video'
import { leituraSemConsulta, lerLeituraDoConjunto, type IObservatorioDaLeitura } from '../../_chrome/medidas/estourou-leitura'
import type { Leitura } from '../../_chrome/medidas/estourou-model'
import type { HistoricoView } from '../view-model'
import { derivarDoVideo, type DerivadoDoVideo } from './derivar-do-video'

const H = 3_600_000

export interface PedidoDeMedidasDoVideo {
  obterSb: () => SupabaseClient
  siteId: string
  obs: IObservatorioDaLeitura
  agoraMs: number
  view: HistoricoView
  /** O vídeo do motor (`obs.videos`); o canal vem dele. */
  video: Pick<ObsVideo, 'id' | 'ch' | 'pub' | 'views' | 'dur'>
}

export interface MedidasLidasDoVideo {
  sb: SupabaseClient
  /** O conjunto como veio do carregador (SEM a sobreposição do vídeo): é dele que sai o "Estourou e parou". */
  c: CanalInteiro
  d: DerivadoDoVideo
  /** A âncora única de idade, horas e marcos de comentário (início real quando há, publicação quando não). */
  t0Ms: number
  descobertoMs: number | null
}

/** `null` = o conjunto do canal falhou (a base: canal, vídeos, marcas, retratos). Parte não lida de série, mudanças ou horas não é falha do conjunto. */
export async function lerMedidasDoVideo(p: PedidoDeMedidasDoVideo): Promise<MedidasLidasDoVideo | null> {
  const sb = p.obterSb()
  const c = await carregarMedidasDoCanalInteiro(sb, {
    siteId: p.siteId, obs: p.obs, channelId: p.video.ch, agoraMs: p.agoraMs, pedir: { serie: true, mudancas: true, horas: true },
  })
  if ('naoCarregou' in c.medidas) return null
  const lidoDoCanal = c.videos.lido ? c.videos.dados.find((v) => v.id === p.video.id) : undefined
  // uma âncora só para idade, horas e marcos de comentário: o início real (live ou estreia) quando há, a publicação quando não (portão Phil I4)
  const t0Ms = lidoDoCanal ? (baseDaIdade(lidoDoCanal) ?? p.video.pub) : p.video.pub
  // vídeo fora da janela do conjunto (180 dias de série e mudanças, 90 de horas): lê só o dele; dentro da janela, nenhuma consulta (portão Phil I2)
  const ultimoOk = p.obs.channels.find((x) => x.id === p.video.ch)?.sync.last ?? null
  const comVideo = await completarVideoForaDaJanela(sb, c, {
    siteId: p.siteId, channelId: p.video.ch, agoraMs: p.agoraMs, okSyncedAt: ultimoOk, video: { id: p.video.id, publicadoEmMs: p.video.pub, baseMs: t0Ms },
  })
  const chart = p.view.chart
  const d = derivarDoVideo(comVideo.canal, {
    agoraMs: p.agoraMs,
    video: { id: p.video.id, publicadoEmMs: p.video.pub, viewsAgora: p.video.views, dur: p.video.dur },
    semLeitura: comVideo.semLeitura,
    eixoH: chart ? { fromH: chart.fromH, H: chart.H } : { fromH: 0, H: Math.max(0, (p.agoraMs - p.video.pub) / H) },
  })
  const descobertoMs = lidoDoCanal?.discoveredAt ? Date.parse(lidoDoCanal.discoveredAt) : NaN
  return { sb, c, d, t0Ms, descobertoMs: Number.isNaN(descobertoMs) ? null : descobertoMs }
}

/**
 * A leitura de "Estourou e parou" que a página mostraria, pela MESMA regra: sem consulta antes da data em que ela existe, e do conjunto que a tela já
 * leu depois dela. Nula = o vídeo não tem o bloco (não é do site, é de canal próprio, não é acompanhado) ou o conjunto falhou (a tela mostra o erro).
 */
export async function lerEstourouDoVideo(p: PedidoDeMedidasDoVideo & { lidas: MedidasLidasDoVideo | null }): Promise<Leitura | null> {
  const antes = p.view.notFound || p.view.untracked || !p.view.video ? null : leituraSemConsulta(p.obs, p.view.video.id, p.agoraMs)
  if (antes !== 'ler') return antes
  if (p.lidas === null) return null
  return lerLeituraDoConjunto({ c: p.lidas.c, sb: p.lidas.sb, siteId: p.siteId, obs: p.obs, videoId: p.video.id, now: p.agoraMs })
}

/** Cliente de serviço do pedido do pacote da IA (fica aqui, fora da varredura do botão: só o registrar-acesso cria cliente lá). */
export const clienteDeServicoDoVideo = (): SupabaseClient => getSupabaseServiceClient()
