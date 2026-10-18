import type { AbTestBaseView } from '@/lib/youtube/ab-types'

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
}

/**
 * Ruling do Phil (T15): `dimensions` é TEXT "1280x720". Largura <= 480 avisa; nulo ou ilegível também avisa
 * (originais de antes da T4 e sem thumbnail_hq_url são hq 480x360).
 */
export function originalBaixaResolucao(dimensions: string | null | undefined): boolean {
  const m = /^(\d+)x(\d+)$/.exec(dimensions ?? '')
  return m ? Number(m[1]) <= 480 : true
}

/** "07/10 05:00" no fuso de São Paulo; vazio quando a data falta ou é inválida. */
export function dataCurtaSp(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d)
  const g = (t: string) => p.find(x => x.type === t)?.value ?? ''
  return `${g('day')}/${g('month')} ${g('hour')}:${g('minute')}`
}

export function dadosDoDialogoEncerrar(view: Pick<AbTestBaseView, 'variantDb' | 'videoTitle' | 'noArAgora' | 'activeNow'>): DadosDoDialogoEncerrar {
  const original = view.variantDb.find(v => v.is_original)
  const opcoes = [...view.variantDb]
    .sort((a, b) => (a.is_original === b.is_original ? a.label.localeCompare(b.label) : a.is_original ? -1 : 1))
    .map(v => ({
      id: v.id,
      rotulo: v.is_original ? `${v.label} (original)` : v.label,
      isOriginal: v.is_original,
      titulo: v.title_text ?? view.videoTitle ?? null,
      miniatura: v.blob_url,
    }))
  const rotulo = view.noArAgora?.label ?? view.activeNow ?? original?.label ?? 'A'
  return {
    noArAgora: { rotulo, desde: dataCurtaSp(view.noArAgora?.desde) },
    opcoes,
    originalBaixaResolucao: originalBaixaResolucao(original?.dimensions),
  }
}
