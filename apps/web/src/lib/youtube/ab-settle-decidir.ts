import { DHASH_MAX_SAME, hamming } from '@/lib/youtube/thumb-fingerprint'
import type { DhashDaVariante } from '@/lib/youtube/ab-variant-dhash'
import { paraErroGravado } from '@/lib/youtube/youtube-api-error'
import type { CampoNome, ErroGravado, RestoreStatus } from '@/lib/youtube/ab-restore'

export type Decisao =
  | { acao: 'ok_sem_escrever' }
  | { acao: 'escrever' }
  | { acao: 'pular'; estado: 'pulado_drift'; motivo: null | 'sem_base_de_comparacao' }
  | { acao: 'pular'; estado: 'pulado_sem_original'; motivo: null }
  | { acao: 'falhar'; erro: ErroGravado }
  | { acao: 'desistir'; motivo: 'video_inexistente' }

export interface EntradaTitulo {
  campo: 'title'
  destino: 'original' | { varianteId: string }
  atual: { tipo: 'lido'; valor: string } | { tipo: 'video_inexistente' } | { tipo: 'falha'; erro: ErroGravado }
  originalTitle: string | null
  variantes: Array<{ id: string; title_text: string | null }>
  forcar: boolean
}

export interface EntradaThumb {
  campo: 'thumbnail'
  destino: 'original' | { varianteId: string }
  atual: { tipo: 'lido'; dhash: string } | { tipo: 'video_inexistente' } | { tipo: 'falha'; erro: ErroGravado }
  originalNoBlob: boolean
  dhashes: Map<string, DhashDaVariante>
  idOriginal: string
  ultimaEscrita: Date | null
  marcador: string | null
  agora: Date
  forcar: boolean
}

export const HORAS_THUMB_RECENTE = 3
const limpo = (s: string) => s.trim()

export function decidirCampo(e: EntradaTitulo | EntradaThumb): Decisao {
  if (e.atual.tipo === 'video_inexistente') return { acao: 'desistir', motivo: 'video_inexistente' }
  return e.campo === 'title' ? decidirTitulo(e) : decidirThumb(e)
}

function decidirTitulo(e: EntradaTitulo): Decisao {
  const destino = e.destino
  const alvo = destino === 'original'
    ? e.originalTitle
    : (e.variantes.find((v) => v.id === destino.varianteId)?.title_text ?? null)
  if (destino === 'original' && (alvo === null || limpo(alvo) === '')) {
    return { acao: 'pular', estado: 'pulado_sem_original', motivo: null }
  }
  if (alvo === null || limpo(alvo) === '') return { acao: 'falhar', erro: { motivo: 'variante_sem_titulo' } }
  if (e.atual.tipo === 'falha') return { acao: 'falhar', erro: e.atual.erro }
  if (e.atual.tipo !== 'lido') return { acao: 'falhar', erro: { motivo: 'erro_interno' } }
  const atual = limpo(e.atual.valor)
  if (atual === limpo(alvo)) return { acao: 'ok_sem_escrever' }
  const conhecidos = new Set(
    [...e.variantes.map((v) => v.title_text), e.originalTitle]
      .filter((x): x is string => x !== null)
      .map(limpo),
  )
  if (conhecidos.has(atual) || e.forcar) return { acao: 'escrever' }
  return { acao: 'pular', estado: 'pulado_drift', motivo: null }
}

function decidirThumb(e: EntradaThumb): Decisao {
  const idDestino = e.destino === 'original' ? e.idOriginal : e.destino.varianteId
  if (e.destino === 'original' && !e.originalNoBlob) {
    return { acao: 'pular', estado: 'pulado_sem_original', motivo: null }
  }
  const dDestino = e.dhashes.get(idDestino)
  if (!dDestino || (dDestino.tipo === 'sem_base' && e.destino !== 'original')) {
    return { acao: 'falhar', erro: { motivo: 'arquivo_do_destino_indisponivel' } }
  }
  if (dDestino.tipo === 'sem_base') return { acao: 'pular', estado: 'pulado_sem_original', motivo: null }
  if (e.atual.tipo === 'falha') return { acao: 'falhar', erro: e.atual.erro }
  if (e.atual.tipo !== 'lido') return { acao: 'falhar', erro: { motivo: 'erro_interno' } }
  if (dDestino.tipo === 'falha') return { acao: 'falhar', erro: paraErroGravado(dDestino.erro) }
  const falhaDeBlob = [...e.dhashes.values()].find(
    (d): d is Extract<DhashDaVariante, { tipo: 'falha' }> => d.tipo === 'falha',
  )

  const atual = e.atual.dhash
  const casa = (d: DhashDaVariante | undefined) => d?.tipo === 'ok' && hamming(d.dhash, atual) <= DHASH_MAX_SAME
  const recente =
    e.ultimaEscrita !== null && e.agora.getTime() - e.ultimaEscrita.getTime() < HORAS_THUMB_RECENTE * 3_600_000
  const parecidas = [...e.dhashes].some(
    ([id, d]) => id !== idDestino && d.tipo === 'ok' && hamming(d.dhash, dDestino.dhash) <= DHASH_MAX_SAME,
  )

  if (casa(dDestino)) return recente || e.marcador !== null || parecidas ? { acao: 'escrever' } : { acao: 'ok_sem_escrever' }
  if ([...e.dhashes.values()].some(casa)) return { acao: 'escrever' }
  if (falhaDeBlob) return { acao: 'falhar', erro: paraErroGravado(falhaDeBlob.erro) }
  if (e.forcar) return { acao: 'escrever' }
  const algumSemBase = [...e.dhashes.values()].some((d) => d.tipo === 'sem_base')
  return { acao: 'pular', estado: 'pulado_drift', motivo: algumSemBase ? 'sem_base_de_comparacao' : null }
}

// F-P2, Y-P1: só o `em` do PRÓPRIO campo e só com escreveu !== false.
export function ultimaEscritaDoApp(
  t: { inicioUltimoCiclo: string | null; restoreStatus: RestoreStatus | null; winnerAppliedAt: string | null },
  campo: CampoNome,
): Date | null {
  const proprio = t.restoreStatus?.[campo]
  const emProprio = proprio && proprio.escreveu !== false ? proprio.em : null
  const cands = [t.inicioUltimoCiclo, t.winnerAppliedAt, emProprio]
    .map((s) => (s ? Date.parse(s) : NaN))
    .filter(Number.isFinite)
  return cands.length ? new Date(Math.max(...cands)) : null
}
