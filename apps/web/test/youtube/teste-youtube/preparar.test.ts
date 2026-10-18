// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { prepararLeituras, montarRodadas, compararDesempate } from '@/lib/youtube/teste-youtube/preparar'
import { resolverOpcoes, RENDERERS_TITULO } from '@/lib/youtube/teste-youtube/tipos'
import { leitura, rodadas, VIDEO } from './sintetico'
import { carregarQIg9, TITULO_A, TITULO_B } from '../../fixtures/teste-youtube/qIg9a7vqcNo/carregar'

const o = resolverOpcoes()
const prep = (ls: unknown[]) => prepararLeituras(ls).leituras
const ordem = (ls: unknown[]) => prep(ls).map(p => `${p.l.lidaEm}|${p.l.rodadaId}|${p.l.idioma}`)

function embaralhar<T>(xs: readonly T[], semente: number): T[] {
  const a = [...xs]
  let s = semente
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

describe('prepararLeituras', () => {
  it('conta recebidas, inválidas e com erro; só as sem erro seguem', () => {
    const ls = [
      leitura({ em: '2026-10-18T10:00:00Z', rodada: 'a', titulo: 'X' }),
      leitura({ em: '2026-10-18T10:00:01Z', rodada: 'a', erro: 'http_429', renderers: [] }),
      { lixo: true },
    ]
    const r = prepararLeituras(ls)
    expect(r).toMatchObject({ recebidas: 3, invalidas: 1, comErro: 1 })
    expect(r.leituras.length).toBe(1)
  })

  it('M8: dois vídeos entre as válidas lançam, mesmo que um tenha erro', () => {
    expect(() =>
      prepararLeituras([
        leitura({ em: '2026-10-18T10:00:00Z', rodada: 'a', titulo: 'X' }),
        leitura({ em: '2026-10-18T10:00:01Z', rodada: 'a', erro: 'timeout', renderers: [], video: 'zzzzzzzzzzz' }),
      ]),
    ).toThrow(Error)
  })

  it('ordena por ms, não por texto ISO', () => {
    const ls = [
      leitura({ em: '2026-10-18T10:00:57Z', rodada: 'a', titulo: 'X' }),
      leitura({ em: '2026-10-18T10:00:56.500Z', rodada: 'b', titulo: 'X' }),
      leitura({ em: '2026-10-18T10:00:56Z', rodada: 'c', titulo: 'X' }),
    ]
    expect(prep(ls).map(p => p.l.rodadaId)).toEqual(['c', 'b', 'a'])
  })

  it('M3: mesmo ms e mesmo rodadaId com idioma diferente dão a mesma ordem em qualquer entrada', () => {
    const a = leitura({ em: '2026-10-18T10:00:00Z', rodada: 'r', titulo: 'X', idioma: 'pt-BR' })
    const b = leitura({ em: '2026-10-18T10:00:00Z', rodada: 'r', titulo: 'X', idioma: 'en' })
    expect(ordem([a, b])).toEqual(ordem([b, a]))
  })

  it('desempate total: leituras idênticas em tudo menos o texto canônico', () => {
    const a = leitura({ em: '2026-10-18T10:00:00Z', rodada: 'r', titulo: 'X', oficial: 'um' })
    const b = leitura({ em: '2026-10-18T10:00:00Z', rodada: 'r', titulo: 'X', oficial: 'dois' })
    const [p, q] = prep([a, b])
    const [p2, q2] = prep([b, a])
    expect(p!.l.tituloOficial).toBe(p2!.l.tituloOficial)
    expect(q!.l.tituloOficial).toBe(q2!.l.tituloOficial)
    expect(compararDesempate(p!, q!)).toBeLessThan(0)
  })

  it('Review Focus 1: entrada embaralhada dá a mesma preparação (fixture)', () => {
    const { leituras } = carregarQIg9()
    const base = prep(leituras).map(p => p.l)
    expect(prep(embaralhar(leituras, 7)).map(p => p.l)).toEqual(base)
    expect(prep(embaralhar(leituras, 99)).map(p => p.l)).toEqual(base)
  })

  it('Review Focus 1: mesmo lidaEm em rodadas distintas, ordem de entrada trocada', () => {
    const a = leitura({ em: '2026-10-18T10:00:00Z', rodada: 'x', titulo: 'A' })
    const b = leitura({ em: '2026-10-18T10:00:00Z', rodada: 'y', titulo: 'B' })
    expect(prep([a, b]).map(p => p.l)).toEqual(prep([b, a]).map(p => p.l))
  })

  it('voto: renderers iguais votam (normalizado); discordantes não votam mas leem', () => {
    const [ok] = prep([leitura({ em: '2026-10-18T10:00:00Z', rodada: 'a', titulo: 'Consistência' })])
    expect(ok!.voto).toBe('Consistência')
    expect(ok!.votoCru).toBe('Consistência')
    expect(ok!.idxRenderer).toBe(0)
    const [disc] = prep([
      leitura({
        em: '2026-10-18T10:00:00Z',
        rodada: 'a',
        renderers: [
          { renderer: RENDERERS_TITULO[0], texto: 'A' },
          { renderer: RENDERERS_TITULO[1], texto: 'B' },
          { renderer: RENDERERS_TITULO[2], texto: 'A' },
        ],
      }),
    ])
    expect(disc!.voto).toBeNull()
    expect(disc!.leuTitulo).toBe(true)
  })

  it('votoCru vem do renderer de menor índice; renderer fora da lista vem depois', () => {
    const [p] = prep([
      leitura({
        em: '2026-10-18T10:00:00Z',
        rodada: 'a',
        renderers: [
          { renderer: 'zzz', texto: 'B́' },
          { renderer: RENDERERS_TITULO[2], texto: 'É' },
          { renderer: RENDERERS_TITULO[0], texto: null },
        ],
      }),
    ])
    expect(p!.idxRenderer).toBe(2)
    expect(p!.votoCru).toBe('É')
  })

  it('C21: NFC e NFD no mesmo segundo escolhem o mesmo votoCru em qualquer ordem', () => {
    const nfc = leitura({ em: '2026-10-18T10:00:00Z', rodada: 'r', titulo: 'Consistência' })
    const nfd = leitura({ em: '2026-10-18T10:00:00Z', rodada: 'r', titulo: 'Consistência' })
    expect(prep([nfc, nfd])[0]!.votoCru).toBe(prep([nfd, nfc])[0]!.votoCru)
  })

  it('leuMiniatura', () => {
    const m = { url: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg', host: 'i.ytimg.com', variante: 'hqdefault', largura: 480, altura: 360, http: 200, etag: null, sha16: null, dhash: '106068cba7a3c3c8' }
    const [p, q] = prep([
      leitura({ em: '2026-10-18T10:00:00Z', rodada: 'a', titulo: 'X', miniaturas: [m] }),
      leitura({ em: '2026-10-18T10:00:01Z', rodada: 'a', titulo: 'X' }),
    ])
    expect([p!.leuMiniatura, q!.leuMiniatura]).toEqual([true, false])
  })
})

describe('montarRodadas', () => {
  it('ordena por deMs e marca mista só com 2+ textos votantes', () => {
    const ls = rodadas({ inicio: '2026-10-18T10:00:00Z', intervaloMs: 6 * 3_600_000, padroes: ['AAA', 'ABB', 'BBB'], textos: { A: 'A', B: 'B' } })
    const r = montarRodadas(prep(embaralhar(ls, 3)), o)
    expect(r.map(x => x.chave === x.leituras[0]!.chaveRodada)).toEqual([true, true, true])
    expect(r.map(x => x.mista)).toEqual([false, true, false])
    expect(r[1]!.votos.get('A')).toBe(1)
    expect(r[1]!.votos.get('B')).toBe(2)
    expect(r[1]!.votosValidos).toBe(3)
    expect(r.map(x => x.deMs)).toEqual([...r.map(x => x.deMs)].sort((a, b) => a - b))
  })

  it('C16: idioma diferente separa rodadas e nada vira mista', () => {
    const ls = []
    for (let i = 0; i < 6; i++) {
      const t0 = Date.parse('2026-10-18T00:00:00Z') + i * 6 * 3_600_000
      ls.push(leitura({ em: new Date(t0).toISOString(), rodada: `r${i}`, titulo: 'A', idioma: 'pt-BR' }))
      ls.push(leitura({ em: new Date(t0 + 2000).toISOString(), rodada: `r${i}`, titulo: 'A', idioma: 'pt-BR' }))
      ls.push(leitura({ em: new Date(t0 + 4000).toISOString(), rodada: `r${i}`, titulo: 'X', idioma: 'en' }))
    }
    const r = montarRodadas(prep(ls), o)
    expect(r.length).toBe(12)
    expect(r.some(x => x.mista)).toBe(false)
  })

  it('Review Focus 2: 1 leitura votante não mistura; discordante não vota', () => {
    const disc = leitura({
      em: '2026-10-18T10:00:00Z',
      rodada: 'a',
      renderers: [
        { renderer: RENDERERS_TITULO[0], texto: 'A' },
        { renderer: RENDERERS_TITULO[1], texto: 'B' },
      ],
    })
    const um = leitura({ em: '2026-10-18T10:00:02Z', rodada: 'a', titulo: 'A' })
    const [r] = montarRodadas(prep([disc, um]), o)
    expect(r!.mista).toBe(false)
    expect(r!.votosValidos).toBe(1)
    const dois = leitura({ em: '2026-10-18T10:00:04Z', rodada: 'a', titulo: 'B' })
    const [r2] = montarRodadas(prep([disc, um, dois]), o)
    expect(r2!.mista).toBe(true)
    expect(r2!.votosValidos).toBe(2)
  })

  it('C28: rodada que atravessa a escrita fica em quarentena e não é mista; sem escrita é', () => {
    const ls = [
      leitura({ em: '2026-10-18T09:58:00Z', rodada: 'q', titulo: 'A' }),
      leitura({ em: '2026-10-18T10:00:00Z', rodada: 'q', titulo: 'B' }),
      leitura({ em: '2026-10-18T10:02:00Z', rodada: 'q', titulo: 'B' }),
    ]
    const com = montarRodadas(prep(ls), resolverOpcoes({ escritasConhecidas: [{ em: '2026-10-18T10:00:00Z', campo: 'titulo' }] }))
    expect(com[0]!.emQuarentena).toBe(true)
    expect(com[0]!.mista).toBe(false)
    expect(com[0]!.votosValidos).toBe(3)
    const sem = montarRodadas(prep(ls), o)
    expect(sem[0]!.emQuarentena).toBe(false)
    expect(sem[0]!.mista).toBe(true)
  })

  it('Review Focus 3: escrita de miniatura não põe título em quarentena', () => {
    const ls = [
      leitura({ em: '2026-10-18T09:58:00Z', rodada: 'q', titulo: 'A' }),
      leitura({ em: '2026-10-18T10:00:00Z', rodada: 'q', titulo: 'B' }),
      leitura({ em: '2026-10-18T10:02:00Z', rodada: 'q', titulo: 'B' }),
    ]
    const [r] = montarRodadas(prep(ls), resolverOpcoes({ escritasConhecidas: [{ em: '2026-10-18T10:00:00Z', campo: 'miniatura' }] }))
    expect(r!.mista).toBe(true)
  })

  it('quarentena: borda exata antes (maxDuracao) e depois (quarentena) toca; além não', () => {
    const w = { em: '2026-10-18T10:00:00Z', campo: 'titulo' as const }
    const q = (iso: string) => montarRodadas(prep([leitura({ em: iso, rodada: 'q', titulo: 'A' })]), resolverOpcoes({ escritasConhecidas: [w] }))[0]!.emQuarentena
    expect(q('2026-10-18T09:50:00Z')).toBe(true)
    expect(q('2026-10-18T09:49:59Z')).toBe(false)
    expect(q('2026-10-18T11:00:00Z')).toBe(true)
    expect(q('2026-10-18T11:00:01Z')).toBe(false)
  })

  it('C26: rodada que reusa o rodadaId por horas é longa e não mista', () => {
    const ls = [
      leitura({ em: '2026-10-19T10:00:00Z', rodada: 'x', titulo: 'A' }),
      leitura({ em: '2026-10-19T10:01:00Z', rodada: 'x', titulo: 'A' }),
      leitura({ em: '2026-10-19T16:00:00Z', rodada: 'x', titulo: 'B' }),
    ]
    const [r] = montarRodadas(prep(ls), o)
    expect(r!.longa).toBe(true)
    expect(r!.mista).toBe(false)
    expect(r!.votosValidos).toBe(3)
  })

  it('rodada sem título lido (só miniatura) não vira rodada', () => {
    const [p] = [leitura({ em: '2026-10-18T10:00:00Z', rodada: 's0', renderers: [] })]
    expect(montarRodadas(prep([p!]), o)).toEqual([])
  })

  it('fixture: 20 rodadas, 13 mistas, nenhuma longa', () => {
    const { leituras } = carregarQIg9()
    const r = montarRodadas(prep(leituras), o)
    expect(r.length).toBe(20)
    expect(r.filter(x => x.mista).length).toBe(13)
    expect(r.some(x => x.longa || x.emQuarentena)).toBe(false)
    const todos = new Set(r.flatMap(x => [...x.votos.keys()]))
    expect(todos).toEqual(new Set([TITULO_A, TITULO_B]))
    expect(VIDEO).toBeTruthy()
  })
})
