// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { prepararLeituras } from '@/lib/youtube/teste-youtube/preparar'
import { classificarMiniatura, representantes, sinaisFracos } from '@/lib/youtube/teste-youtube/miniatura'
import { resolverOpcoes, type LeituraWatch, type OpcoesDeteccao } from '@/lib/youtube/teste-youtube/tipos'
import { carregarQIg9, VIDEO_ID } from '../../fixtures/teste-youtube/qIg9a7vqcNo/carregar'
import { leitura } from './sintetico'

type Mini = LeituraWatch['miniaturas'][number]

const mini = (variante: string, dhash: string | null, o: Partial<Mini> = {}): Mini => ({
  url: `https://i.ytimg.com/vi/${VIDEO_ID}/${variante}.jpg`,
  host: 'i.ytimg.com',
  variante,
  largura: 480,
  altura: 360,
  http: 200,
  etag: null,
  sha16: null,
  dhash,
  ...o,
})

const prep = (ls: LeituraWatch[]) => prepararLeituras(ls).leituras
const cls = (ls: LeituraWatch[], opts?: OpcoesDeteccao) => classificarMiniatura(prep(ls), resolverOpcoes(opts))

const T0 = Date.parse('2026-10-18T10:00:00Z')
const em = (i: number) => new Date(T0 + i * 3_600_000).toISOString()
const video = (i: number, miniaturas: Mini[]) => leitura({ em: em(i), rodada: `r${i}`, miniaturas, video: VIDEO_ID })

/** Embaralhamento determinístico (LCG). */
function embaralhar<T>(xs: readonly T[], semente: number): T[] {
  const a = [...xs]
  let s = semente
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

const { sondas } = carregarQIg9()

describe('C6 e C7: sondas da fixture', () => {
  it('C6: um valor só; 0e5e e 967c no mesmo grupo', () => {
    const r = classificarMiniatura(prep(sondas), resolverOpcoes())
    expect(r.estado).toEqual({ estado: 'nada_visivel', motivo: 'um_valor_so' })
    const reps = representantes(['106068c9a7a3c3c8', '106068cba7a3c3c8'], 6)
    expect(new Set(reps.values()).size).toBe(1)
  })

  const esperado = ['hq720', 'hqdefault', 'maxresdefault', 'mqdefault', 'sddefault'].map(v => ({
    tipo: 'reenvio_mesma_imagem',
    em: '2026-10-18T16:42:25.000Z',
    variante: v,
  }))

  it('C7: 5 sinais exatos', () => {
    const s = sinaisFracos(prep(sondas), resolverOpcoes())
    expect(s).toEqual(esperado)
    expect(s).toHaveLength(5)
    expect(s.every(x => x.em >= '2026-10-18')).toBe(true)
  })

  it('C7: ordem de entrada e das miniaturas dentro da leitura não mudam o resultado', () => {
    const emb = embaralhar(sondas, 7).map((l, i) => ({ ...l, miniaturas: embaralhar(l.miniaturas, i + 1) }))
    expect(sinaisFracos(prep(emb), resolverOpcoes())).toEqual(esperado)
  })

  it('variante com duas imagens diferentes na mesma classe não emite sinal', () => {
    const a = video(0, [mini('hqdefault', '106068cba7a3c3c8', { etag: '"1567171355"' })])
    const b = video(1, [mini('hqdefault', 'e9f9e90c1a3a3a9c', { etag: '"1792341745"' })])
    expect(sinaisFracos(prep([a, b]), resolverOpcoes())).toEqual([])
  })

  it('a primeira leitura nunca emite sozinha', () => {
    const a = video(0, [mini('hqdefault', '106068cba7a3c3c8', { etag: '"1792341745"' })])
    expect(sinaisFracos(prep([a]), resolverOpcoes())).toEqual([])
  })
})

describe('C8: sondas 404 não votam', () => {
  it('uma sonda 404 e uma com o cinza forçado não mudam o estado', () => {
    const forcada = leitura({
      em: '2026-10-18T17:00:00Z',
      rodada: 'x',
      video: VIDEO_ID,
      miniaturas: [mini('hqdefault', '400e716969691648')],
    })
    const r = classificarMiniatura(prep([...sondas, forcada]), resolverOpcoes())
    expect(r.estado).toEqual({ estado: 'nada_visivel', motivo: 'um_valor_so' })
  })
})

const A480 = '106068cba7a3c3c8'

describe('C22, C23, I6', () => {
  it('C22: 9 leituras com as 5 entradas hqdefault (classes diferentes por tamanho) = um valor só', () => {
    const ls = Array.from({ length: 9 }, (_, i) =>
      video(i * 2, [
        mini('hqdefault', A480),
        mini('hqdefault', '686060cbc7a3a3a3', { largura: 168, altura: 94 }),
        mini('hqdefault', '686068c9a5a3a3c3', { largura: 196, altura: 110 }),
        mini('hqdefault', '686068cfa7a3a383', { largura: 336, altura: 188 }),
        mini('hqdefault', '606068cda5a3a3c3', { largura: 246, altura: 138 }),
      ]),
    )
    expect(cls(ls).estado).toEqual({ estado: 'nada_visivel', motivo: 'um_valor_so' })
  })

  it('C23: dois dHash a 30 bits na mesma classe, alternando = miniatura_variou', () => {
    const outro = 'e9f9e90c1a3a3a9c'
    const ls = Array.from({ length: 9 }, (_, i) => video(i * 2, [mini('hqdefault', i % 2 === 0 ? '686068cfa7a3a3c6' : outro, { largura: 1280, altura: 720 })]))
    expect(cls(ls).estado).toEqual({ estado: 'nada_visivel', motivo: 'miniatura_variou' })
  })

  it('I6: 4 bits na mesma classe: padrão um valor só; limiar 3 varia', () => {
    const z = '0000000000000000'
    const quatro = '000000000000000f'
    const ls = Array.from({ length: 9 }, (_, i) => video(i, [mini('hqdefault', i % 2 === 0 ? z : quatro)]))
    expect(cls(ls).estado).toEqual({ estado: 'nada_visivel', motivo: 'um_valor_so' })
    expect(cls(ls, { dhashMaxSame: 3 }).estado).toEqual({ estado: 'nada_visivel', motivo: 'miniatura_variou' })
  })
})

describe('equivalência do agrupamento (condição a da A5)', () => {
  it('limiar 6: laço local e thumbRepresentatives dão o mesmo agrupamento', () => {
    const c22 = ['106068cba7a3c3c8', '686060cbc7a3a3a3', '686068c9a5a3a3c3', '686068cfa7a3a383', '606068cda5a3a3c3']
    const cadeia = ['0000000000000000', '000000000000001f', '00000000000003ff', '0000000000000007', '0000000000000fff']
    for (const base of [c22, cadeia, [...c22, ...cadeia]]) {
      for (let s = 1; s <= 20; s++) {
        const k = embaralhar(base, s)
        const padrao = representantes(k, 6)
        const local = representantes(k, 6, true)
        expect([...local.entries()]).toEqual([...padrao.entries()])
      }
    }
  })
})

describe('contagem e dedupe', () => {
  it('uma leitura com o mesmo dHash em 2 hosts conta 1 voto', () => {
    const z = '0000000000000000'
    const outro = 'ffffffffffffffff'
    // 8 leituras só com z e 1 com outro em dois hosts: outro tem 1 voto (< 2), não varia
    const ls = Array.from({ length: 8 }, (_, i) => video(i, [mini('hqdefault', z)]))
    ls.push(video(8, [mini('hqdefault', outro), mini('hqdefault', outro, { host: 'i1.ytimg.com' })]))
    expect(cls(ls).estado).toEqual({ estado: 'nada_visivel', motivo: 'um_valor_so' })
  })

  it('nenhuma leitura com miniatura: nao_lido', () => {
    expect(cls([video(0, [])])).toEqual({ estado: { estado: 'nao_lido' }, validasMiniatura: 0 })
  })

  it('menos de 9 leituras: insuficiente', () => {
    const ls = Array.from({ length: 8 }, (_, i) => video(i, [mini('hqdefault', A480)]))
    expect(cls(ls)).toEqual({ estado: { estado: 'insuficiente', motivo: 'poucas_leituras' }, validasMiniatura: 8 })
  })
})
