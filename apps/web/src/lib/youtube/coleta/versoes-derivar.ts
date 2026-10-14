// Derivação de um dia das versões do vídeo próprio (E18, plano seção 4.2). Pura: sem banco, sem `server-only`.
// Recebe as versões correntes do canal e os fatos (linhas diárias) de um dia; devolve o que confirmar, o que abrir
// (ainda sem origem: quem atribui é `versoes-origem.ts`) e o que pulou. Nunca devolve origem.

import { hashValue } from '@/lib/youtube/competitor-versions'
import { DHASH_MAX_SAME, hamming } from '@/lib/youtube/thumb-fingerprint'
import { diffDias } from './day-pt'
import type { CampoVersao, DiaYt, PrecisaoJanela } from '@/lib/youtube/observatorio/proprio-versoes/tipos'

type Privacidade = 'public' | 'unlisted' | 'private'

export interface FatoDoDia {
  ytId: string
  dia: DiaYt
  videoId: string | null
  capturadoEm: string
  privacidade: Privacidade | null
  /** A última privacidade conhecida em dia ANTERIOR; null = nenhuma. */
  privacidadeConhecida: Privacidade | null
  titulo: string | null
  descHash: string | null
  dhash: string | null
  sha256: string | null
  blobUrl: string | null
}

export interface CorrenteDoCampo {
  id: string
  ytId: string
  campo: CampoVersao
  hash: string
  ancoraDhash: string | null
  sha256: string | null
  ultimoDia: DiaYt
  vistaAte: string
}

export interface AberturaSemOrigem {
  ytId: string
  videoId: string | null
  campo: CampoVersao
  tituloOuNulo: string | null
  hash: string
  thumb: { dhash: string; ancoraDhash: string; sha256: string | null; blobUrl: string | null; retoque: boolean } | null
  capturadoEm: string
  janela: { de: string; ate: string } | null
  precisao: PrecisaoJanela
}

export type MotivoPulo = 'sem_captura' | 'sem_dhash' | 'privado'

export interface PlanoDoDia {
  confirmar: Array<{ id: string; vistaEm: string }>
  abrir: AberturaSemOrigem[]
  pulados: Record<MotivoPulo, number>
}

function precisaoDe(c: CorrenteDoCampo, dia: DiaYt): PrecisaoJanela {
  return diffDias(c.ultimoDia, dia) <= 1 ? '1d' : 'lacuna'
}

export function derivarDia(correntes: readonly CorrenteDoCampo[], fatos: readonly FatoDoDia[]): PlanoDoDia {
  const plano: PlanoDoDia = { confirmar: [], abrir: [], pulados: { sem_captura: 0, sem_dhash: 0, privado: 0 } }
  const vistos = new Set<string>()
  const corrente = (ytId: string, campo: CampoVersao): CorrenteDoCampo | undefined =>
    correntes.find(c => c.ytId === ytId && c.campo === campo)

  for (const f of fatos) {
    const chave = `${f.ytId}|${f.dia}`
    // Mensagem só com o id de 11 caracteres e o dia: nunca o título (dado privado).
    if (vistos.has(chave)) throw new Error(`fato repetido para o vídeo ${f.ytId} no dia ${f.dia}`)
    vistos.add(chave)

    // Texto (título e descrição): comparação por hash do valor.
    const texto = (campo: 'title' | 'desc', hash: string | null, tituloOuNulo: string | null): void => {
      if (hash === null) {
        // Título nulo é falha de captura; descrição sem hash só conta quando a privacidade também faltou.
        if (campo === 'title' || f.privacidade === null) plano.pulados.sem_captura++
        return
      }
      if (f.privacidade === null) { plano.pulados.sem_captura++; return }
      const c = corrente(f.ytId, campo)
      if (!c) {
        plano.abrir.push({ ytId: f.ytId, videoId: f.videoId, campo, tituloOuNulo, hash, thumb: null, capturadoEm: f.capturadoEm, janela: null, precisao: 'first' })
      } else if (c.hash === hash) {
        plano.confirmar.push({ id: c.id, vistaEm: f.capturadoEm })
      } else {
        plano.abrir.push({
          ytId: f.ytId, videoId: f.videoId, campo, tituloOuNulo, hash, thumb: null, capturadoEm: f.capturadoEm,
          janela: { de: c.vistaAte, ate: f.capturadoEm }, precisao: precisaoDe(c, f.dia),
        })
      }
    }
    texto('title', f.titulo === null ? null : hashValue(f.titulo), f.titulo)
    texto('desc', f.descHash, null)

    // Thumbnail.
    if (f.privacidade === 'private' || (f.privacidade === null && f.privacidadeConhecida === 'private')) { plano.pulados.privado++; continue }
    if (f.dhash === null) { plano.pulados.sem_dhash++; continue }
    const c = corrente(f.ytId, 'thumb')
    const base = { ytId: f.ytId, videoId: f.videoId, campo: 'thumb' as const, tituloOuNulo: null, hash: f.dhash, capturadoEm: f.capturadoEm }
    if (!c) {
      plano.abrir.push({ ...base, thumb: { dhash: f.dhash, ancoraDhash: f.dhash, sha256: f.sha256, blobUrl: f.blobUrl, retoque: false }, janela: null, precisao: 'first' })
      continue
    }
    const ancora = c.ancoraDhash ?? c.hash
    const janela = { de: c.vistaAte, ate: f.capturadoEm }
    if (hamming(f.dhash, ancora) > DHASH_MAX_SAME) {
      plano.abrir.push({ ...base, thumb: { dhash: f.dhash, ancoraDhash: f.dhash, sha256: f.sha256, blobUrl: f.blobUrl, retoque: false }, janela, precisao: precisaoDe(c, f.dia) })
    } else if (f.sha256 !== null && c.sha256 !== null && f.sha256 !== c.sha256) {
      plano.abrir.push({ ...base, thumb: { dhash: f.dhash, ancoraDhash: ancora, sha256: f.sha256, blobUrl: f.blobUrl, retoque: true }, janela, precisao: precisaoDe(c, f.dia) })
    } else {
      plano.confirmar.push({ id: c.id, vistaEm: f.capturadoEm })
    }
  }
  return plano
}

/**
 * Depois de um dia gravado SEM abertura: as correntes confirmadas avançam em memória (ultimoDia = dia, vistaAte = vistaEm).
 * Com abertura no plano lança: aí o passo relê do banco, porque os ids das versões novas nascem lá.
 */
export function aplicarPlanoNasCorrentes(correntes: readonly CorrenteDoCampo[], plano: PlanoDoDia, dia: DiaYt): CorrenteDoCampo[] {
  if (plano.abrir.length > 0) throw new Error('plano com abertura: reler as correntes do banco')
  const vista = new Map(plano.confirmar.map(c => [c.id, c.vistaEm]))
  return correntes.map(c => {
    const vistaEm = vista.get(c.id)
    return vistaEm === undefined ? { ...c } : { ...c, ultimoDia: dia, vistaAte: vistaEm }
  })
}
