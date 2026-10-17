/**
 * E5a Tarefa 21c (mockup 13): os blocos do Histórico do vídeo de concorrente. Componente de servidor assíncrono, dentro do `<Suspense>` da página:
 * espera as medidas do canal inteiro e DEVOLVE o `HistoricoScreen` (cliente) com os acréscimos do gráfico como dado serializável e os blocos
 * novos como dois `ReactNode` já desenhados. Nenhum componente passa como prop; nenhuma ação é importada aqui: as cinco chegam por prop da página.
 * Nunca lança: o conjunto do canal que falha vira o estado `erro` do mockup; parte não lida (série, mudanças, horas) vira "não carregou" só no bloco
 * que depende dela, e o resto da tela (versões, comparação, fixar) segue de pé.
 */
import { Suspense, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProvasDeQuemVe } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import type { ObsVideo } from '@/lib/youtube/observatorio/types'
import type { IObservatorioDeMedidas } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import { carregarMedidasDoCanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import type { ForjaAsk, ForjaCancel } from '../../_chrome/forja-view-model'
import type { PinAction } from '../../_chrome/pin-kit'
import { Carregando } from '../../_chrome/comentarios/estados'
import { NaoCarregou } from '../../_chrome/medidas/marcas'
import { ComentariosDeDestaque } from '../comentarios-de-destaque'
import { HistoricoScreen } from '../historico-screen'
import type { HistoricoView } from '../view-model'
import { CartaoSubida } from './cartao-subida'
import { CurvaPorIdade } from './curva-por-idade'
import { derivarDoVideo } from './derivar-do-video'
import { Horas72 } from './horas-72'
import { ListaDeMudancasHistorico } from './lista-de-mudancas'
import { ResumoDoVideo } from './resumo'
import { cabecalhoDoSaiu } from './saiu-model'
import './historico-medidas.css'

const H = 3_600_000

export interface PropsBlocosDoVideo {
  /** O cliente de serviço só nasce quando o bloco roda (a página não o cria à toa: vídeo não encontrado nem toca nele). */
  obterSb: () => SupabaseClient
  siteId: string
  obs: IObservatorioDeMedidas
  agoraMs: number
  view: HistoricoView
  /** O vídeo do motor (`obs.videos`); o canal vem dele. */
  video: Pick<ObsVideo, 'id' | 'ch' | 'pub' | 'views' | 'dur'>
  /** "Estourou e parou", já pronto (elemento de servidor num `Suspense` próprio): entra depois de "Views por idade". */
  estourou?: ReactNode
  /** `obs.link.saiu()`: o botão da fila só existe quando o vídeo saiu e o link existe. */
  linkSaiu: { href: string } | null
  onAskForja?: ForjaAsk
  onCancelForja?: ForjaCancel
  onSyncChannel?: (channelRowId: string) => Promise<{ ok: boolean }>
  onPin?: PinAction
  onUnpin?: PinAction
  pagerNaTrilha?: boolean
  /** Último bloco da tela, depois de todos os do mockup 13, dentro do mesmo `Suspense`. */
  depois?: ReactNode
  /**
   * C3: as provas de quem vê (os tokens do passo 0 da E17), de servidor para servidor; a reserva NÃO as recebe. Ausente (`undefined`) = a página
   * não pede a seção; `null` = a seção existe no nível contagem. Quem decide o nível é o leitor.
   */
  provas?: ProvasDeQuemVe | null
  /** C3: id do canal para o nome (o motor da página tem os nomes; `IObservatorioDeMedidas` não). */
  canaisDoSite?: ReadonlyMap<string, { nome: string }>
  /** C3: a conferência de permissão falhou (a faixa diz que só há contagem). */
  permissaoFalhou?: boolean
}

export async function BlocosDoVideo(p: PropsBlocosDoVideo) {
  const comum = { onAskForja: p.onAskForja, onCancelForja: p.onCancelForja, onSyncChannel: p.onSyncChannel, onPin: p.onPin, onUnpin: p.onUnpin, pagerNaTrilha: p.pagerNaTrilha }
  const sb = p.obterSb()
  const c = await carregarMedidasDoCanalInteiro(sb, {
    siteId: p.siteId, obs: p.obs, channelId: p.video.ch, agoraMs: p.agoraMs, pedir: { serie: true, mudancas: true, horas: true },
  })
  // "O conjunto falhou" é só a base (canal, vídeos, marcas, retratos): parte não lida de série, mudanças ou horas não é falha do conjunto
  if ('naoCarregou' in c.medidas) return <HistoricoScreen view={p.view} erro {...comum} />

  const chart = p.view.chart
  const d = derivarDoVideo(c, {
    agoraMs: p.agoraMs,
    video: { id: p.video.id, publicadoEmMs: p.video.pub, viewsAgora: p.video.views, dur: p.video.dur },
    eixoH: chart ? { fromH: chart.fromH, H: chart.H } : { fromH: 0, H: Math.max(0, (p.agoraMs - p.video.pub) / H) },
  })
  const lidoDoCanal = c.videos.lido ? c.videos.dados.find((v) => v.id === p.video.id) : undefined
  const descobertoMs = lidoDoCanal?.discoveredAt ? Date.parse(lidoDoCanal.discoveredAt) : NaN
  const canais = p.canaisDoSite ?? new Map<string, { nome: string }>()
  // C3: a seção de comentários vai por último e num `Suspense` PRÓPRIO: ela não segura os blocos de cima
  const comentarios = p.provas === undefined ? null : (
    <Suspense fallback={<Carregando />}>
      <ComentariosDeDestaque sb={sb} siteId={p.siteId} provas={p.provas} permissaoFalhou={p.permissaoFalhou} videoId={p.video.id} agoraMs={p.agoraMs}
        canaisDoSite={canais} canalNome={canais.get(p.video.ch)?.nome ?? ''}
        video={{ t0Ms: p.video.pub, descobertoEmMs: Number.isNaN(descobertoMs) ? null : descobertoMs, canalId: p.video.ch }} hrefFilaSaiu={p.linkSaiu?.href} />
    </Suspense>
  )
  const cab = cabecalhoDoSaiu({ saiuEm: d.saiuEm, mantido: !!p.view.pin?.pinned, aoVivo: d.aoVivo, linkSaiu: p.linkSaiu })
  const antes = (
    <>
      <ResumoDoVideo resumo={d.resumo} />
      <CurvaPorIdade bloco={d.idade} />
      {p.estourou ?? null}
      <Horas72 bloco={d.horas} />
      {/* TEXTO-A-REVISAR: a série não foi lida; o gráfico por dia vem do motor, só os acréscimos dele faltam */}
      {d.serieLida ? null : <section className="hv-card" aria-label="Acréscimos do gráfico por dia" data-dias="nao_carregou"><NaoCarregou medida="a contagem extra do gráfico por dia (subida, saída do YouTube, forma por semana)" /></section>}
    </>
  )
  const depois = (
    <>
      <CartaoSubida cartao={d.subida} />
      <ListaDeMudancasHistorico lista={d.lista} />
      {p.depois ?? null}
      {comentarios}
    </>
  )
  return <HistoricoScreen view={p.view} acrescimos={d.acrescimos} antesDoGrafico={antes} depoisDoGrafico={depois} cabecalhoDoSaiu={cab} {...comum} />
}
