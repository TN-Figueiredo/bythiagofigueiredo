/**
 * E5a Tarefa 21c (mockup 13): os blocos do Histórico do vídeo de concorrente. Componente de servidor assíncrono, dentro do `<Suspense>` da página:
 * espera as medidas do canal inteiro e DEVOLVE o `HistoricoScreen` (cliente) com os acréscimos do gráfico como dado serializável e os blocos
 * novos como dois `ReactNode` já desenhados. Nenhum componente passa como prop; nenhuma ação é importada aqui: as cinco chegam por prop da página.
 * Nunca lança: o conjunto do canal que falha vira o estado `erro` do mockup; parte não lida (série, mudanças, horas) vira "não carregou" só no bloco
 * que depende dela, e o resto da tela (versões, comparação, fixar) segue de pé.
 */
import { Suspense, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ObsVideo } from '@/lib/youtube/observatorio/types'
import { lerLeituraDoConjunto, type IObservatorioDaLeitura } from '../../_chrome/medidas/estourou-leitura'
import type { ForjaAsk, ForjaCancel } from '../../_chrome/forja-view-model'
import type { PinAction } from '../../_chrome/pin-kit'
import { Carregando } from '../../_chrome/comentarios/estados'
import { PastilhaAusencia } from '../../_chrome/ausencia/pastilhas'
import { ComentariosDeDestaque, type ProvasResolvidas } from '../comentarios-de-destaque'
import { EstourouEParou } from '../estourou-e-parou'
import { HistoricoScreen } from '../historico-screen'
import type { HistoricoView } from '../view-model'
import { CartaoSubida } from './cartao-subida'
import { CurvaPorIdade } from './curva-por-idade'
import { lerMedidasDoVideo } from './ler-do-video'
import { Horas72 } from './horas-72'
import type { CriadorDoFio } from '../../_chrome/comentarios/fio-model'
import { ListaDeMudancasHistorico } from './lista-de-mudancas'
import { ResumoDoVideo } from './resumo'
import { cabecalhoDoSaiu } from './saiu-model'
import './historico-medidas.css'


export interface PropsBlocosDoVideo {
  /** O cliente de serviço só nasce quando o bloco roda (a página não o cria à toa: vídeo não encontrado nem toca nele). */
  obterSb: () => SupabaseClient
  siteId: string
  obs: IObservatorioDaLeitura
  agoraMs: number
  view: HistoricoView
  /** O vídeo do motor (`obs.videos`); o canal vem dele. */
  video: Pick<ObsVideo, 'id' | 'ch' | 'pub' | 'views' | 'dur'>
  /**
   * "Estourou e parou": um elemento já pronto (a leitura não precisa de consulta), `'ler'` (o bloco sai do MESMO conjunto do canal que esta tela
   * lê: uma leitura só, plano E5a §4.8) ou ausente (o vídeo não tem o bloco). Entra depois de "Views por idade".
   */
  estourou?: ReactNode | 'ler'
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
   * C3: as provas de quem vê (os tokens do passo 0 da E17) EM PROMESSA, de servidor para servidor; a reserva NÃO as recebe. A página não espera
   * por elas: a seção espera dentro do `Suspense` dela. Ausente (`undefined`) = a página não pede a seção. Quem decide o nível é o leitor.
   */
  provas?: Promise<ProvasResolvidas>
  /** C3: id do canal para o nome (o motor da página tem os nomes; `IObservatorioDeMedidas` não). */
  canaisDoSite?: ReadonlyMap<string, { nome: string }>
}

async function estourouDoConjunto(p: PropsBlocosDoVideo, sb: SupabaseClient, c: Parameters<typeof lerLeituraDoConjunto>[0]['c']): Promise<ReactNode> {
  const leitura = await lerLeituraDoConjunto({ c, sb, siteId: p.siteId, obs: p.obs, videoId: p.video.id, now: p.agoraMs })
  return leitura ? <EstourouEParou leitura={leitura} /> : null
}

/** O canal do vídeo para o fio: foto, inicial e cor vêm do cabeçalho da página; sem cabeçalho, só o nome e a inicial com a cor padrão do canal. */
function criadorDoVideo(view: PropsBlocosDoVideo['view'], nomeDoSite: string): CriadorDoFio {
  const c = view.header?.chan
  if (c) return { nome: c.name, avatar: c.avatar, ini: c.ini, color: c.color }
  return { nome: nomeDoSite, avatar: null, ini: nomeDoSite.slice(0, 2).toUpperCase(), color: '#3B2F8F' }
}

export async function BlocosDoVideo(p: PropsBlocosDoVideo) {
  const comum = { onAskForja: p.onAskForja, onCancelForja: p.onCancelForja, onSyncChannel: p.onSyncChannel, onPin: p.onPin, onUnpin: p.onUnpin, pagerNaTrilha: p.pagerNaTrilha }
  const lidas = await lerMedidasDoVideo(p)
  // "O conjunto falhou" é só a base (canal, vídeos, marcas, retratos): parte não lida de série, mudanças ou horas não é falha do conjunto
  if (lidas === null) return <HistoricoScreen view={p.view} erro {...comum} />
  const { sb, c, d, t0Ms, descobertoMs } = lidas
  const canais = p.canaisDoSite ?? new Map<string, { nome: string }>()
  // C3: a seção de comentários vai por último e num `Suspense` PRÓPRIO: ela não segura os blocos de cima
  const comentarios = p.provas === undefined ? null : (
    <Suspense fallback={<Carregando />}>
      <ComentariosDeDestaque sb={sb} siteId={p.siteId} provas={p.provas} videoId={p.video.id} agoraMs={p.agoraMs}
        canaisDoSite={canais} criador={criadorDoVideo(p.view, canais.get(p.video.ch)?.nome ?? '')}
        video={{ t0Ms, descobertoEmMs: descobertoMs, canalId: p.video.ch }} hrefFilaSaiu={p.linkSaiu?.href} />
    </Suspense>
  )
  // "Estourou e parou" do conjunto que a tela já leu (o conjunto SEM a sobreposição do vídeo, que é o que mostra se a série dele faltava)
  const estourou = p.estourou === 'ler' ? await estourouDoConjunto(p, sb, c) : (p.estourou ?? null)
  const cab = cabecalhoDoSaiu({ saiuEm: d.saiuEm, mantido: !!p.view.pin?.pinned, aoVivo: d.aoVivo, linkSaiu: p.linkSaiu })
  const antes = (
    <>
      <ResumoDoVideo resumo={d.resumo} />
      <CurvaPorIdade bloco={d.idade} />
      {estourou}
      <Horas72 bloco={d.horas} />
      {/* a série não foi lida; o gráfico por dia vem do motor, só os acréscimos dele faltam */}
      {d.serieLida ? null : <section className="hv-card" aria-label="Acréscimos do gráfico por dia" data-dias="nao_carregou"><PastilhaAusencia estado="falhou" motivo="os acréscimos do gráfico por dia (subida, saída do YouTube, forma por semana)" /></section>}
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
