import type { AbTestStatus } from './ab-types'
import { isCertainShort } from './short-classifier'

/** Formatação das linhas do seletor de vídeo e da prévia do A/B (M6). Funções puras. */

const FUSO = 'America/Sao_Paulo'

// Montados uma vez: 100 linhas × 2 formatos por render.
const FORMATO_DATA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, day: '2-digit', month: 'short', year: 'numeric',
})
const FORMATO_DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

function partes(f: Intl.DateTimeFormat, d: Date): (tipo: string) => string {
  const p = f.formatToParts(d)
  return (t) => p.find((x) => x.type === t)?.value ?? ''
}

function mesSemPonto(m: string): string {
  return m.replace(/\./g, '')
}

/** `m:ss` abaixo de 1 h, `h:mm:ss` a partir daí; zero ou negativo ⇒ null. */
export function duracaoDoVideo(seg: number): string | null {
  if (!Number.isFinite(seg) || seg <= 0) return null
  const total = Math.floor(seg)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  if (h === 0) return `${m}:${ss}`
  return `${h}:${String(m).padStart(2, '0')}:${ss}`
}

/** `21 out 2026`, em America/Sao_Paulo. ISO inválido: quem chama trata como ausente. */
export function dataDePublicacao(iso: string): string {
  const g = partes(FORMATO_DATA, new Date(iso))
  return `${g('day')} ${mesSemPonto(g('month'))} ${g('year')}`
}

/** `21 out 2026, 18:32`, em America/Sao_Paulo. */
export function dataHoraDePublicacao(iso: string): string {
  const g = partes(FORMATO_DATA_HORA, new Date(iso))
  return `${g('day')} ${mesSemPonto(g('month'))} ${g('year')}, ${g('hour')}:${g('minute')}`
}

export function textoDeVisualizacoes(n: number): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? 'visualização' : 'visualizações'}`
}

/* --- Seletor: estado do vídeo --- */


export type BloqueioDoVideo = 'short' | 'sem_thumb_hq'

const ABERTOS: ReadonlyArray<AbTestStatus> = ['active', 'paused', 'queued', 'draft']

/** Status aberto mais relevante entre os testes do vídeo (em andamento vence rascunho); nenhum aberto ⇒ null. */
export function statusAbertoDoVideo(statuses: ReadonlyArray<string>): AbTestStatus | null {
  for (const s of ABERTOS) if (statuses.includes(s)) return s
  return null
}

/** Mesmas duas recusas de `createAbTest`: Short e vídeo sem thumbnail HQ. */
export function bloqueioDoVideo(durationSeconds: number, thumbnailHqUrl: string | null): BloqueioDoVideo | null {
  // Duração 0 (coluna NOT NULL default 0) é vídeo ainda não sincronizado, não Short: o remédio é sincronizar.
  if (durationSeconds <= 0) return 'sem_thumb_hq'
  if (isCertainShort(durationSeconds)) return 'short'
  if (!thumbnailHqUrl) return 'sem_thumb_hq'
  return null
}
