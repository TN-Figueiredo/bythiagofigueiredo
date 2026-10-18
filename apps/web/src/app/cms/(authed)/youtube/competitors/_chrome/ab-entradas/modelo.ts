// Decide, para cada entrada do vídeo próprio, entre `testar`, `ver` (teste aberto), `sem-dado` (frase) e nada.
// Puro e importável por cliente: os módulos do leitor entram só como tipo.
import { hrefNovoTesteConcorrente, hrefNovoTesteProprio, refTrocaValida, thumbReferenciaSegura, tituloReferencia, type TipoTroca } from '@/lib/youtube/ab-referencia'
import { isCertainShort } from '@/lib/youtube/short-classifier'
import type { EstadoAusencia } from '../ausencia/estado'
import type { VideoBlocosView } from '../../_proprio/video-blocos-model'
import { ehProprio } from '../../_proprio/eh-proprio'
import type { ChannelVideoView } from '../../_canal/videos-model'
import type { Chip, TrocaView } from '../../_proprio/trocas-model'
import type { ProprioVideoView } from '../../_proprio/videos-model'
import type { TestesAbertos } from './testes-abertos'
import type { AbEntradas } from './contexto'

/** Um nome só nas três entradas do vídeo próprio (decisão do dono, 17/10). */
export const ROTULO_TESTAR = 'Testar no A/B Lab'

export const FRASE_SEM_DADO: Record<'restrito' | 'falhou', string> = {
  restrito: 'A leitura deste vídeo é restrita: só quem tem acesso ao Analytics vê os números.',
  falhou: 'A leitura deste vídeo falhou. Recarregue a página para tentar de novo.',
}

export type EntradaProprio =
  | { tipo: 'testar'; href: string }
  | { tipo: 'ver'; href: string; rotulo: string; frase: string; curto: string; aviso: string }
  | { tipo: 'sem-dado'; frase: string }

export function entradaDoProprio(a: {
  podeEditar: boolean
  videoUuid: string
  dur: number | null
  abertos: TestesAbertos | null
  semDado: EstadoAusencia | null
  tipo?: TipoTroca
}): EntradaProprio | null {
  if (!a.podeEditar) return null
  // A MESMA função de createAbTest: o destino recusa Short, então a entrada some (sem botão nem frase).
  // Duração nula vale 0 (Short) lá, então vale aqui também (Phil I-1).
  if (isCertainShort(a.dur ?? 0)) return null
  if (a.abertos?.acesso === 'negado') return null
  if (a.abertos?.acesso === 'ok') {
    const t = a.abertos.porVideo[a.videoUuid]
    if (t) return { tipo: 'ver', href: t.href, rotulo: t.rotulo, frase: t.frase, curto: t.curto, aviso: t.aviso }
  }
  if (a.semDado === 'restrito' || a.semDado === 'falhou') return { tipo: 'sem-dado', frase: FRASE_SEM_DADO[a.semDado] }
  return { tipo: 'testar', href: hrefNovoTesteProprio(a.videoUuid, a.tipo) }
}

/**
 * Cabeçalho e Antes e depois. [PERGUNTA AO DONO] Q-a: padrão SIM, `nao_medido` (acesso ok) mostra o botão; só restrito e falhou escondem.
 * Se o dono disser não, é aqui que `nao_medido` volta como estado de sem-dado.
 */
export function semDadoDoVideo(b: Pick<VideoBlocosView, 'acesso' | 'ausencia'>): EstadoAusencia | null {
  if (b.acesso === 'ok') return null
  if (b.acesso === 'negado' && b.ausencia === 'restrito') return 'restrito'
  return 'falhou'
}

/** Menu ⋯: restrito/falhou escondem o item; nao_medido e zero medido (P3) mostram. */
export function semDadoDoCartao(v: ProprioVideoView): EstadoAusencia | null {
  return v.impEstado === 'restrito' || v.impEstado === 'falhou' ? v.impEstado : null
}

export function valorAbEntradas(a: { podeEditar: boolean; abertos: TestesAbertos | null }): AbEntradas | null {
  if (!a.podeEditar) return null
  if (a.abertos?.acesso === 'negado') return null
  return { podeEditar: true, abertos: a.abertos }
}

/** Troca com medida (subiu, caiu, sem diferença) ou ainda sem medida depois: só estes chips ganham entrada. */
export const CHIPS_COM_MEDIDA: ReadonlySet<Chip> = new Set<Chip>(['subiu', 'caiu', 'sem-diferenca'])
const CHIPS_SEM_MEDIDA_DEPOIS: ReadonlySet<Chip> = new Set<Chip>(['depois-nao-medido', 'ainda-nao-da'])
export const FRASE_SEM_MEDIDA = 'Sem medida depois da troca, não há base para comparar.'
/** Dica sob o botão do Antes e depois. Não promete "variante B vazia" (dívida do rascunho local do assistente) nem "esta troca como ponto de partida" (a URL leva só o tipo). */
export const DICA_TROCA_PROPRIA = 'Abre o teste neste vídeo com o tipo desta troca já marcado.'

/**
 * Antes e depois do próprio. `ab` nulo, `sem-dado` ou `ver` → null (com `ver`, o aviso único no topo cuida); troca vinda de teste → null (o link
 * "Abrir o teste A/B" já existe). Chips `antes-nao-medido`, `sem-antes` e `sem-dias` ficam em null (o chip já diz o motivo; a confirmar com o Logan).
 */
export function entradaDaTroca(t: Pick<TrocaView, 'campo' | 'chip' | 'veioDeTeste'>, ab: EntradaProprio | null, videoUuid: string):
  | { tipo: 'testar'; href: string } | { tipo: 'sem-medida'; frase: string } | null {
  if (!ab || ab.tipo !== 'testar') return null
  if (t.veioDeTeste) return null
  if (CHIPS_COM_MEDIDA.has(t.chip)) return { tipo: 'testar', href: hrefNovoTesteProprio(videoUuid, t.campo === 'thumb' ? 'thumbnail' : 'title') }
  if (CHIPS_SEM_MEDIDA_DEPOIS.has(t.chip)) return { tipo: 'sem-medida', frase: FRASE_SEM_MEDIDA }
  return null
}

export type ItemAb = { rotulo: string; href: string; curto?: string }
export const ROTULO_IDEIA_THUMB = 'Testar uma ideia a partir desta thumbnail'
export const ROTULO_IDEIA_TITULO = 'Testar uma ideia a partir deste título'

/**
 * Itens do menu ⋯ do cartão. `ab` nulo (reporter, fora do provedor) → []. Próprio: a mesma decisão do cabeçalho (sem frase: no menu o item não existe
 * quando não há o que oferecer). Concorrente: título sempre; thumbnail só com imagem de origem permitida.
 */
export function itensDoMenu(v: ChannelVideoView, ab: AbEntradas | null): ItemAb[] {
  if (!ab) return []
  if (ehProprio(v)) {
    const e = entradaDoProprio({ podeEditar: true, videoUuid: v.id, dur: v.dur, abertos: ab.abertos, semDado: semDadoDoCartao(v) })
    if (e?.tipo === 'testar') return [{ rotulo: ROTULO_TESTAR, href: e.href }]
    if (e?.tipo === 'ver') return [{ rotulo: e.rotulo, href: e.href, curto: e.curto }]
    return []
  }
  const itens: ItemAb[] = []
  if (thumbReferenciaSegura(v.thumbSrc)) {
    itens.push({ rotulo: ROTULO_IDEIA_THUMB, href: hrefNovoTesteConcorrente({ tipo: 'thumbnail', thumb: v.thumbSrc, titulo: v.title, refVideoId: v.id }) })
  }
  itens.push({ rotulo: ROTULO_IDEIA_TITULO, href: hrefNovoTesteConcorrente({ tipo: 'title', thumb: null, titulo: v.title, refVideoId: v.id }) })
  return itens
}

export type AbRefTroca = { tipo: 'testar'; href: string } | { tipo: 'sem-imagem'; frase: string }
export const FRASE_SEM_IMAGEM = 'Sem imagem guardada desta troca: não há o que usar de referência.'
export const ROTULO_IDEIA_NO_MEU_CANAL = 'Testar uma ideia no meu canal'

/**
 * Troca de concorrente → entrada do A/B Lab. `own` é explícito (vídeo de canal próprio → null: a entrada dele é o Antes e depois). Descrição → null.
 * A medida não entra (decisão 2 do dono: troca "não medido" mantém o botão). O estado `sem-imagem` é frase sem botão (a imagem substituta de P1 vale só na faixa de `ab-lab/new`).
 * Título sem texto aproveitável → null (não há ideia a levar).
 */
export function abRefDaTroca(p: { tipo: TipoTroca | null; own: boolean; desfaz?: boolean; thumbDepois: string | null; tituloDepois: string | null; tituloDoVideo: string; refVideoId: string; refTroca: string }): AbRefTroca | null {
  // troca que DESFAZ outra (A→B→A): o "Depois" é a versão restaurada, não uma ideia nova (Yannis I1)
  if (p.own || p.desfaz || p.tipo == null) return null
  const refTroca = refTrocaValida(p.refTroca)
  if (p.tipo === 'thumbnail') {
    const thumb = thumbReferenciaSegura(p.thumbDepois)
    if (!thumb) return { tipo: 'sem-imagem', frase: FRASE_SEM_IMAGEM }
    return { tipo: 'testar', href: hrefNovoTesteConcorrente({ tipo: 'thumbnail', thumb, titulo: p.tituloDoVideo, refVideoId: p.refVideoId, refTroca }) }
  }
  if (!tituloReferencia(p.tituloDepois)) return null
  return { tipo: 'testar', href: hrefNovoTesteConcorrente({ tipo: 'title', thumb: null, titulo: p.tituloDepois, refVideoId: p.refVideoId, refTroca }) }
}
