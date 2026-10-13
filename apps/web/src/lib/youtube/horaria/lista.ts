// Quem é lido nesta hora (A5 E16, Tarefa 7). Módulo puro: sem banco, sem rede, sem relógio.
// O instante "agora" entra por parâmetro.
//
// Dado ausente primeiro: tudo o que sai da lista é CONTADO em `fora`, nunca cortado em silêncio.
// Vídeo mais velho que a janela não é "fora": é só vídeo velho, e não entra em contagem nenhuma.
// A lista dos canais do dono NÃO olha a captura de privacidade: quem decide se a leitura é gravada
// é a resposta do YouTube daquela hora (Tarefas 8 e 9).

import { RULES } from '../observatorio/rules'

const DAY_MS = 24 * 60 * 60 * 1000

export interface CandConcorrente {
  id: string
  ytId: string
  canalId: string
  siteId: string
  publishedAt: string | null
  discoveredAt: string | null
  lbc: string | null
  missingSince: string | null
  canalAusente: boolean
}

export interface CandProprio {
  id: string
  ytId: string
  canalId: string
  siteId: string
  publishedAt: string | null
  createdAt: string
}

export interface Alvo {
  ytId: string
  tipo: 'concorrente' | 'proprio'
  uuid: string
  canalId: string
  siteId: string
  publishedAt: string
  descobertoEm: string | null
}

export interface Fora {
  teto: number
  tetoProprio: number
  aoVivo: number
  ausente: number
  semData: number
}

/** Instante da publicação em ms, ou null se nula, vazia ou ilegível. */
function instante(publishedAt: string | null): number | null {
  if (publishedAt === null || publishedAt === '') return null
  const ms = Date.parse(publishedAt)
  return Number.isFinite(ms) ? ms : null
}

interface Candidato {
  alvo: Alvo
  ms: number
}

/** Mais novo primeiro; no empate, o id (uuid) menor primeiro: a mesma ordem da função de prova. */
function maisNovoPrimeiro(a: Candidato, b: Candidato): number {
  if (a.ms !== b.ms) return b.ms - a.ms
  if (a.alvo.uuid < b.alvo.uuid) return -1
  if (a.alvo.uuid > b.alvo.uuid) return 1
  return 0
}

/** Fica com os `videosMax` mais novos de cada canal; devolve os escolhidos e quantos sobraram. */
function aplicarTeto(candidatos: Candidato[]): { alvos: Alvo[]; cortados: number } {
  const porCanal = new Map<string, Candidato[]>()
  for (const c of candidatos) {
    const lista = porCanal.get(c.alvo.canalId)
    if (lista) lista.push(c)
    else porCanal.set(c.alvo.canalId, [c])
  }
  const alvos: Alvo[] = []
  let cortados = 0
  // canais em ordem fixa: o resultado não depende da ordem em que as linhas chegaram
  const canais = [...porCanal.keys()].sort()
  for (const canal of canais) {
    const ordenados = (porCanal.get(canal) ?? []).sort(maisNovoPrimeiro)
    const ficam = ordenados.slice(0, RULES.hourly.videosMax)
    cortados += ordenados.length - ficam.length
    for (const c of ficam) alvos.push(c.alvo)
  }
  return { alvos, cortados }
}

/** Idade válida: 0 <= idade < ageDays. Devolve o instante, ou 'velho', ou null (sem data / futuro). */
function naJanela(publishedAt: string | null, agoraMs: number): number | 'velho' | null {
  const ms = instante(publishedAt)
  if (ms === null) return null
  const idade = agoraMs - ms
  if (idade < 0) return null
  if (idade >= RULES.hourly.ageDays * DAY_MS) return 'velho'
  return ms
}

export function montarLista(
  conc: readonly CandConcorrente[],
  prop: readonly CandProprio[],
  agoraMs: number,
): { alvos: Alvo[]; fora: Fora } {
  const fora: Fora = { teto: 0, tetoProprio: 0, aoVivo: 0, ausente: 0, semData: 0 }

  const doConcorrente: Candidato[] = []
  for (const c of conc) {
    const ms = naJanela(c.publishedAt, agoraMs)
    if (ms === null) {
      fora.semData += 1
      continue
    }
    if (ms === 'velho') continue
    if (c.missingSince !== null || c.canalAusente) {
      fora.ausente += 1
      continue
    }
    if (c.lbc === 'live' || c.lbc === 'upcoming') {
      fora.aoVivo += 1
      continue
    }
    doConcorrente.push({
      ms,
      alvo: {
        ytId: c.ytId,
        tipo: 'concorrente',
        uuid: c.id,
        canalId: c.canalId,
        siteId: c.siteId,
        publishedAt: c.publishedAt ?? '',
        descobertoEm: c.discoveredAt,
      },
    })
  }

  const doDono: Candidato[] = []
  for (const p of prop) {
    const ms = naJanela(p.publishedAt, agoraMs)
    if (ms === null) {
      fora.semData += 1
      continue
    }
    if (ms === 'velho') continue
    doDono.push({
      ms,
      alvo: {
        ytId: p.ytId,
        tipo: 'proprio',
        uuid: p.id,
        canalId: p.canalId,
        siteId: p.siteId,
        publishedAt: p.publishedAt ?? '',
        descobertoEm: p.createdAt,
      },
    })
  }

  const c = aplicarTeto(doConcorrente)
  const d = aplicarTeto(doDono)
  fora.teto = c.cortados
  fora.tetoProprio = d.cortados
  return { alvos: [...c.alvos, ...d.alvos], fora }
}
