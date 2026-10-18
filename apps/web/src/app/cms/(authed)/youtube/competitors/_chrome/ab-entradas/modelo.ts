// Decide, para cada entrada do vídeo próprio, entre `testar`, `ver` (teste aberto), `sem-dado` (frase) e nada.
// Puro e importável por cliente: os módulos do leitor entram só como tipo.
import { hrefNovoTesteProprio, type TipoTroca } from '@/lib/youtube/ab-referencia'
import { isCertainShort } from '@/lib/youtube/short-classifier'
import type { EstadoAusencia } from '../ausencia/estado'
import type { VideoBlocosView } from '../../_proprio/video-blocos-model'
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
  | { tipo: 'ver'; href: string; rotulo: string; frase: string; curto: string }
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
  if (isCertainShort(a.dur)) return null
  if (a.abertos?.acesso === 'negado') return null
  if (a.abertos?.acesso === 'ok') {
    const t = a.abertos.porVideo[a.videoUuid]
    if (t) return { tipo: 'ver', href: t.href, rotulo: t.rotulo, frase: t.frase, curto: t.curto }
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
