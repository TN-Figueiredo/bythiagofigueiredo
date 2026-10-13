// A4 Tarefa 13.3: o diário com % assistido para os testes da tela do canal. Tudo relativo ao `hoje` do mundo (nada de data fixa).
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { DadosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import type { DiaYt, DiarioCanal, DiarioLinha } from '@/lib/youtube/observatorio/proprio/tipos'

export interface PlanoDoVideo { dias: number; views: number; pct: number | null }

/**
 * Um diário que termina em hoje-2. `plano[i]` descreve o i-ésimo vídeo da lista: `dias` dias seguidos de dados, `views` views por dia e o
 * % assistido de cada dia (`pct`, em pontos; null = % não medido). Vídeo fora do plano não tem linha nenhuma.
 */
export function diarioComPct(canalId: string, ytIds: readonly string[], hoje: DiaYt, plano: readonly PlanoDoVideo[]): DiarioCanal {
  const ultimo = addDays(hoje, -2)
  const linhas: DiarioLinha[] = []
  plano.forEach((p, i) => {
    const ytId = ytIds[i]
    if (!ytId) return
    for (let n = 0; n < p.dias; n++) linhas.push({ ytId, dia: addDays(ultimo, -n), views: p.views, pctAssistido: p.pct, duracaoMediaSeg: null })
  })
  return { canalId, ultimoDia: ultimo, linhas, descartados: 0 }
}

/** Troca só o diário de um `DadosDoCanal` (o alcance fica). */
export const comDiario = (d: DadosDoCanal, diario: DiarioCanal): DadosDoCanal => ({ ...d, diario: { acesso: 'ok', dado: diario } })

const DIA_MS = 86_400_000
/** Mutação do dataset (roda antes do motor): o vídeo mais novo do primeiro canal próprio passa a ter exatamente `dias` dias; os outros acompanham. */
export function ultimoVideoHa(dias: number): (ds: import('@/lib/youtube/observatorio/types').Dataset) => void {
  return ds => {
    const id = ds.channels.find(c => c.own)!.id
    const vs = ds.videos.filter(v => v.ch === id)
    const maisNovo = Math.min(...vs.map(v => v.ageDays))
    const delta = dias - maisNovo
    for (const v of vs) { v.pub -= delta * DIA_MS; v.ageDays += delta }
  }
}

/**
 * Mutação do dataset: dá a duração (em segundos) aos longos acompanhados do primeiro canal próprio, na ordem de `longosAcompanhados` (mais novo primeiro).
 * `duracoes[i]` vale para o i-ésimo longo; os que passam do fim da lista ficam SEM duração (null).
 */
export function duracoesDosLongos(duracoes: readonly number[]): (ds: import('@/lib/youtube/observatorio/types').Dataset) => void {
  return ds => {
    const id = ds.channels.find(c => c.own)!.id
    const longos = ds.videos.filter(v => v.ch === id && v.tracked && v.fmt === 'long').sort((a, b) => b.pub - a.pub || (a.ytId < b.ytId ? -1 : 1))
    longos.forEach((v, i) => { v.dur = duracoes[i] ?? null })
  }
}
