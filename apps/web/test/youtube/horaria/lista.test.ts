// @vitest-environment node
// Quem é lido nesta hora (A5 E16, Tarefa 7). Módulo puro: sem banco, sem rede, sem relógio.
// O instante "agora" entra por parâmetro; nenhuma data é fixa (higiene do repositório).
import { describe, it, expect } from 'vitest'
import { RULES } from '@/lib/youtube/observatorio/rules'
import {
  montarLista,
  type CandConcorrente,
  type CandProprio,
} from '@/lib/youtube/horaria/lista'

const MIN = 60_000
const H = 60 * MIN
const D = 24 * H
const AGORA = Date.now()
const iso = (ms: number) => new Date(ms).toISOString()
const idade = (ms: number) => iso(AGORA - ms)

let seq = 0
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function conc(over: Partial<CandConcorrente> = {}): CandConcorrente {
  seq += 1
  return {
    id: uuid(seq),
    ytId: `yt-c-${seq}`,
    canalId: 'canal-a',
    siteId: 'site-1',
    publishedAt: idade(1 * D),
    discoveredAt: idade(1 * D - H),
    lbc: 'none',
    missingSince: null,
    canalAusente: false,
    ...over,
  }
}

function prop(over: Partial<CandProprio> = {}): CandProprio {
  seq += 1
  return {
    id: uuid(seq),
    ytId: `yt-p-${seq}`,
    canalId: 'dono-1',
    siteId: 'site-1',
    publishedAt: idade(1 * D),
    createdAt: idade(1 * D - H),
    ...over,
  }
}

const ZERO = { teto: 0, tetoProprio: 0, aoVivo: 0, ausente: 0, semData: 0 }
const dias = RULES.hourly.ageDays
const max = RULES.hourly.videosMax

describe('montarLista', () => {
  it('tudo vazio', () => {
    expect(montarLista([], [], AGORA)).toEqual({ alvos: [], fora: ZERO })
  })

  it('canal sem vídeo nenhum não gera alvo nem contagem', () => {
    // o canal existe, mas não trouxe candidato: o resultado é o mesmo da lista vazia
    const r = montarLista([], [], AGORA)
    expect(r.alvos).toHaveLength(0)
    expect(r.fora).toEqual(ZERO)
  })

  it('vídeo de 15 dias não é lido; de 13 dias e 23 horas é', () => {
    const novo = conc({ publishedAt: idade(13 * D + 23 * H) })
    const velho = conc({ publishedAt: idade(15 * D) })
    const r = montarLista([novo, velho], [], AGORA)
    expect(r.alvos.map((a) => a.uuid)).toEqual([novo.id])
    // fora da janela de idade não é "fora" contado: é só vídeo velho
    expect(r.fora).toEqual(ZERO)
  })

  it('o limite de idade: exatamente ageDays fica fora; um milissegundo a menos entra', () => {
    const noLimite = conc({ publishedAt: idade(dias * D) })
    const quaseLimite = conc({ publishedAt: idade(dias * D - 1) })
    const r = montarLista([noLimite, quaseLimite], [], AGORA)
    expect(r.alvos.map((a) => a.uuid)).toEqual([quaseLimite.id])
    expect(r.fora).toEqual(ZERO)
  })

  it('o mesmo limite vale para o canal do dono', () => {
    const noLimite = prop({ publishedAt: idade(dias * D) })
    const quase = prop({ publishedAt: idade(dias * D - 1) })
    const r = montarLista([], [noLimite, quase], AGORA)
    expect(r.alvos.map((a) => a.uuid)).toEqual([quase.id])
  })

  it('publicado agora mesmo (idade zero) entra; um milissegundo no futuro é sem data', () => {
    const agora = conc({ publishedAt: iso(AGORA) })
    const futuro = conc({ publishedAt: iso(AGORA + 1) })
    const r = montarLista([agora, futuro], [], AGORA)
    expect(r.alvos.map((a) => a.uuid)).toEqual([agora.id])
    expect(r.fora.semData).toBe(1)
  })

  it('canal com 40 vídeos em 14 dias: 25 lidos, 15 fora', () => {
    const vids = Array.from({ length: 40 }, (_, i) =>
      conc({ publishedAt: idade((i + 1) * H) }),
    )
    const r = montarLista(vids, [], AGORA)
    expect(r.alvos).toHaveLength(max)
    expect(r.fora.teto).toBe(40 - max)
    expect(r.fora.tetoProprio).toBe(0)
    const esperados = new Set(vids.slice(0, max).map((v) => v.id))
    expect(new Set(r.alvos.map((a) => a.uuid))).toEqual(esperados)
  })

  it('o teto é por canal', () => {
    const a = Array.from({ length: 30 }, (_, i) =>
      conc({ canalId: 'canal-a', publishedAt: idade((i + 1) * H) }),
    )
    const b = Array.from({ length: 30 }, (_, i) =>
      conc({ canalId: 'canal-b', publishedAt: idade((i + 1) * H) }),
    )
    const r = montarLista([...a, ...b], [], AGORA)
    expect(r.alvos).toHaveLength(2 * max)
    expect(r.fora.teto).toBe(10)
    expect(r.alvos.filter((x) => x.canalId === 'canal-a')).toHaveLength(max)
    expect(r.alvos.filter((x) => x.canalId === 'canal-b')).toHaveLength(max)
  })

  it('empate de data no teto desempata pelo id, como a prova', () => {
    const mesmaData = idade(2 * D)
    const vids = Array.from({ length: max + 1 }, (_, i) =>
      conc({ id: uuid(900 + i), publishedAt: mesmaData }),
    )
    // embaralha a entrada: o resultado não pode depender da ordem de chegada
    const embaralhado = [...vids].reverse()
    const r = montarLista(embaralhado, [], AGORA)
    const maior = vids[vids.length - 1]
    expect(r.alvos).toHaveLength(max)
    expect(r.alvos.map((a) => a.uuid)).not.toContain(maior.id)
    expect(r.fora.teto).toBe(1)
  })

  it('o teto escolhe os mais novos, mesmo com a entrada em ordem trocada', () => {
    const vids = Array.from({ length: max + 5 }, (_, i) =>
      conc({ publishedAt: idade((i + 1) * H) }),
    )
    const r = montarLista([...vids].reverse(), [], AGORA)
    const fica = new Set(vids.slice(0, max).map((v) => v.id))
    expect(new Set(r.alvos.map((a) => a.uuid))).toEqual(fica)
    expect(r.fora.teto).toBe(5)
  })

  it('o resultado não depende da ordem da entrada', () => {
    const vids = Array.from({ length: 33 }, (_, i) =>
      conc({
        canalId: i % 2 ? 'canal-a' : 'canal-b',
        publishedAt: idade(((i % 7) + 1) * H),
      }),
    )
    const r1 = montarLista(vids, [], AGORA)
    const r2 = montarLista([...vids].reverse(), [], AGORA)
    expect(r2).toEqual(r1)
  })

  it('ao vivo em andamento e estreia ficam fora', () => {
    const live = conc({ lbc: 'live' })
    const upcoming = conc({ lbc: 'upcoming' })
    const none = conc({ lbc: 'none' })
    const nulo = conc({ lbc: null })
    const r = montarLista([live, upcoming, none, nulo], [], AGORA)
    expect(r.fora.aoVivo).toBe(2)
    expect(new Set(r.alvos.map((a) => a.uuid))).toEqual(new Set([none.id, nulo.id]))
  })

  it('vídeo ausente e canal ausente ficam fora', () => {
    const ausenteDesde = conc({ missingSince: idade(2 * H) })
    const canalSumiu = conc({ canalAusente: true })
    const bom = conc()
    const r = montarLista([ausenteDesde, canalSumiu, bom], [], AGORA)
    expect(r.fora.ausente).toBe(2)
    expect(r.alvos.map((a) => a.uuid)).toEqual([bom.id])
  })

  it('sem data de publicação, ilegível ou com data no futuro', () => {
    const cNulo = conc({ publishedAt: null })
    const cFuturo = conc({ publishedAt: iso(AGORA + D) })
    const pNulo = prop({ publishedAt: null })
    const pFuturo = prop({ publishedAt: iso(AGORA + D) })
    const r = montarLista([cNulo, cFuturo], [pNulo, pFuturo], AGORA)
    expect(r.fora.semData).toBe(4)
    expect(r.alvos).toHaveLength(0)
  })

  it('data ilegível conta como sem data, nunca como "agora"', () => {
    const lixo = conc({ publishedAt: 'ontem à tarde' })
    const vazio = conc({ publishedAt: '' })
    const r = montarLista([lixo, vazio], [], AGORA)
    expect(r.fora.semData).toBe(2)
    expect(r.alvos).toHaveLength(0)
  })

  it('o que está fora por ausência não gasta vaga do teto', () => {
    const ausentes = Array.from({ length: 10 }, () =>
      conc({ missingSince: idade(H), publishedAt: idade(1 * MIN) }),
    )
    const bons = Array.from({ length: max }, (_, i) =>
      conc({ publishedAt: idade((i + 1) * H) }),
    )
    const r = montarLista([...ausentes, ...bons], [], AGORA)
    expect(r.alvos).toHaveLength(max)
    expect(r.fora.ausente).toBe(10)
    expect(r.fora.teto).toBe(0)
  })

  it('os canais do dono estão na lista, sem depender de captura', () => {
    const p = prop({ publishedAt: idade(2 * D), createdAt: idade(H) })
    const r = montarLista([], [p], AGORA)
    expect(r.alvos).toEqual([
      {
        ytId: p.ytId,
        tipo: 'proprio',
        uuid: p.id,
        canalId: p.canalId,
        siteId: p.siteId,
        publishedAt: p.publishedAt,
        descobertoEm: p.createdAt,
      },
    ])
  })

  it('o concorrente leva discoveredAt em descobertoEm (e nulo continua nulo)', () => {
    const a = conc({ discoveredAt: idade(3 * H) })
    const b = conc({ discoveredAt: null })
    const r = montarLista([a, b], [], AGORA)
    const por = new Map(r.alvos.map((x) => [x.uuid, x]))
    expect(por.get(a.id)?.descobertoEm).toBe(a.discoveredAt)
    expect(por.get(a.id)?.tipo).toBe('concorrente')
    expect(por.get(b.id)?.descobertoEm).toBeNull()
  })

  it('o teto do dono é contado à parte', () => {
    const vids = Array.from({ length: 27 }, (_, i) =>
      prop({ publishedAt: idade((i + 1) * H) }),
    )
    const r = montarLista([], vids, AGORA)
    expect(r.alvos).toHaveLength(max)
    expect(r.fora.tetoProprio).toBe(2)
    expect(r.fora.teto).toBe(0)
    expect(new Set(r.alvos.map((a) => a.uuid))).toEqual(
      new Set(vids.slice(0, max).map((v) => v.id)),
    )
  })

  it('o teto do dono e o dos concorrentes são independentes', () => {
    const c = Array.from({ length: 26 }, (_, i) => conc({ publishedAt: idade((i + 1) * H) }))
    const p = Array.from({ length: 28 }, (_, i) => prop({ publishedAt: idade((i + 1) * H) }))
    const r = montarLista(c, p, AGORA)
    expect(r.alvos).toHaveLength(2 * max)
    expect(r.fora.teto).toBe(1)
    expect(r.fora.tetoProprio).toBe(3)
  })

  it('o mesmo id do YouTube nas duas listas: um alvo de cada tipo', () => {
    const c = conc({ ytId: 'UC-igual-v1' })
    const p = prop({ ytId: 'UC-igual-v1' })
    const r = montarLista([c], [p], AGORA)
    expect(r.alvos).toHaveLength(2)
    expect(r.alvos.map((a) => a.tipo).sort()).toEqual(['concorrente', 'proprio'])
    expect(r.alvos.every((a) => a.ytId === 'UC-igual-v1')).toBe(true)
    expect(r.fora).toEqual(ZERO)
  })

  it('o mesmo vídeo em dois canais de concorrente: um alvo por linha, cada um no teto do seu canal', () => {
    const a = conc({ ytId: 'yt-repetido', canalId: 'canal-a' })
    const b = conc({ ytId: 'yt-repetido', canalId: 'canal-b' })
    const r = montarLista([a, b], [], AGORA)
    expect(r.alvos.map((x) => x.uuid).sort()).toEqual([a.id, b.id].sort())
    expect(r.fora).toEqual(ZERO)
  })

  it('o mesmo id de canal em tipos diferentes não divide o teto', () => {
    const c = Array.from({ length: max }, (_, i) =>
      conc({ canalId: 'mesmo', publishedAt: idade((i + 1) * H) }),
    )
    const p = Array.from({ length: max }, (_, i) =>
      prop({ canalId: 'mesmo', publishedAt: idade((i + 1) * H) }),
    )
    const r = montarLista(c, p, AGORA)
    expect(r.alvos).toHaveLength(2 * max)
    expect(r.fora.teto + r.fora.tetoProprio).toBe(0)
  })

  it('toda candidata é contada: alvos + fora + velhas = entrada', () => {
    const entrada: CandConcorrente[] = [
      conc({ publishedAt: null }),
      conc({ missingSince: idade(H) }),
      conc({ lbc: 'live' }),
      conc({ publishedAt: idade(30 * D) }),
      ...Array.from({ length: 30 }, (_, i) => conc({ publishedAt: idade((i + 1) * H) })),
    ]
    const r = montarLista(entrada, [], AGORA)
    const f = r.fora
    const contados = r.alvos.length + f.teto + f.aoVivo + f.ausente + f.semData
    expect(contados).toBe(entrada.length - 1) // a de 30 dias é só velha
  })

  it('não altera a entrada', () => {
    const vids = [conc({ publishedAt: idade(2 * H) }), conc({ publishedAt: idade(1 * H) })]
    const copia = vids.map((v) => ({ ...v }))
    montarLista(vids, [], AGORA)
    expect(vids).toEqual(copia)
  })
})
