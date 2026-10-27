import type { AbTestBaseView } from '@/lib/youtube/ab-types'
import { dataCurtaSp } from '@/lib/youtube/ab-data-curta'
import { publicaBaixa, dimensoesDeTexto } from '@/lib/youtube/ab-original-resolucao'

/** Props de dados do diálogo "O que fica no vídeo?" montadas a partir da visão do teste (Tarefa 15). */
export interface OpcaoDoDialogo {
  id: string
  rotulo: string
  isOriginal: boolean
  titulo: string | null
  miniatura: string | null
}

export interface DadosDoDialogoEncerrar {
  noArAgora: { rotulo: string; desde: string }
  opcoes: OpcaoDoDialogo[]
  originalBaixaResolucao: boolean
  /** Teste só de título: a miniatura do vídeo não muda, então todas as versões mostram a mesma (a original) com a nota "miniatura não muda". */
  miniaturaNaoMuda: boolean
}

export { dataCurtaSp, diaMesSp } from '@/lib/youtube/ab-data-curta'

/** D1/D12: largura < 1280 (ou ilegível) avisa; mesma régua do aviso do assistente. */
export function originalBaixaResolucao(dimensions: string | null | undefined): boolean {
  return publicaBaixa(dimensoesDeTexto(dimensions)?.largura ?? null)
}

export function dadosDoDialogoEncerrar(view: Pick<AbTestBaseView, 'variantDb' | 'videoTitle' | 'noArAgora' | 'activeNow'> & Partial<Pick<AbTestBaseView, 'flag'>>): DadosDoDialogoEncerrar {
  const original = view.variantDb.find(v => v.is_original)
  const miniaturaNaoMuda = view.flag === 'title'
  const opcoes = [...view.variantDb]
    .sort((a, b) => (a.is_original === b.is_original ? a.label.localeCompare(b.label) : a.is_original ? -1 : 1))
    .map(v => ({
      id: v.id,
      rotulo: v.is_original ? `${v.label} (original)` : v.label,
      isOriginal: v.is_original,
      titulo: v.title_text ?? view.videoTitle ?? null,
      miniatura: miniaturaNaoMuda ? (original?.blob_url ?? null) : v.blob_url,
    }))
  const rotulo = view.noArAgora?.label ?? view.activeNow ?? original?.label ?? 'A'
  return {
    noArAgora: { rotulo, desde: dataCurtaSp(view.noArAgora?.desde) },
    opcoes,
    originalBaixaResolucao: originalBaixaResolucao(original?.dimensions),
    miniaturaNaoMuda,
  }
}
