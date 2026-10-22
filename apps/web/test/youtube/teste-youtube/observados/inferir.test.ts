// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { inferirObservado, inferirObservadoDetalhe, type LeituraObs, type ThumbObs } from '@/lib/youtube/teste-youtube/observados/inferir'
import { agoraEm, DH_A, DH_A2, DH_B, DH_C, DH_D, leitura, PUB, rodadas, sequencia, thumb } from './fabrica'

const T0 = 30 // primeira leitura, depois da carência de 24 h
const porTitulo = (r: string): Partial<LeituraObs> => ({ tituloOficial: 'Titulo ' + r })
const base = { publicadoEm: PUB, alvoSaiu: false }

function titulos(rotulos: string[], agoraH: number, extra: Partial<Parameters<typeof inferirObservado>[0]> = {}) {
  return inferirObservado({ ...base, leituras: sequencia(T0, rotulos, (r) => porTitulo(r)), thumbsPorId: new Map(), agoraMs: agoraEm(agoraH), ...extra })
}
/** Miniatura: rótulo -> dhash; cada rótulo vira um thumb por dhash. */
function miniaturas(rotulos: string[], dh: Record<string, string>, agoraH: number, mut?: (t: ThumbObs, i: number) => ThumbObs, h0 = T0) {
  const thumbs = new Map<number, ThumbObs>()
  const ls = rotulos.map((r, i) => {
    const t0 = thumb(1000 + i, dh[r]!)
    const t = mut ? mut(t0, i) : t0
    thumbs.set(t.id, t)
    return leitura(h0 + i * 6, { tituloOficial: null, tituloFonte: null, miniaturaId: t.id })
  })
  return inferirObservadoDetalhe({ ...base, leituras: ls, thumbsPorId: thumbs, agoraMs: agoraEm(agoraH) })
}
const DH = { A: DH_A, B: DH_B, C: DH_C, A2: DH_A2, D: DH_D }

describe('inferirObservado: título', () => {
  it('A,A,B,B,A,A -> 2 trocas (corridas), 2 versões, ficou A, alternada', () => {
    const [o] = titulos(['A', 'A', 'B', 'B', 'A', 'A'], T0 + 40)
    expect(o).toMatchObject({ campo: 'titulo', tipoTroca: 'alternada', veredito: 'possivel_teste_youtube', nVersoes: 2, versaoRegra: 1 })
    expect(o!.trocas).toHaveLength(3)
    expect(o!.ficou).toEqual({ titulo: 'Titulo A' })
  })
  it('A,A,B,B (B fica) -> sequencial, "troca observada", nunca "teste"', () => {
    const [o] = titulos(['A', 'A', 'B', 'B'], T0 + 30)
    expect(o).toMatchObject({ tipoTroca: 'sequencial', veredito: 'troca_observada', nVersoes: 2 })
    expect(o!.ficou).toEqual({ titulo: 'Titulo B' })
    expect(o!.primeiraTrocaEm).toBe(new Date(PUB.getTime() + (T0 + 12) * 3_600_000).toISOString())
  })
  it('só 1 leitura, ou nenhuma troca -> nenhuma linha', () => {
    expect(titulos(['A'], T0 + 1)).toEqual([])
    expect(titulos(['A', 'A', 'A', 'A'], T0 + 30)).toEqual([])
    expect(inferirObservado({ ...base, leituras: [], thumbsPorId: new Map(), agoraMs: agoraEm(60) })).toEqual([])
  })
  it('blip de 1 leitura no meio não conta; corrida recente de 1 leitura (dia 5) fica em_andamento', () => {
    expect(titulos(['A', 'A', 'B', 'A', 'A'], T0 + 40)).toEqual([])
    const [o] = titulos(['A', 'A', 'B', 'B', 'C'], T0 + 31)
    expect(o).toMatchObject({ nVersoes: 2, ficouEstado: 'em_andamento' })
  })
  it('troca no dia 5 com as duas corridas >= 2 leituras -> 1 linha', () => {
    const ls = sequencia(5 * 24 - 12, ['A', 'A', 'B', 'B'], (r) => porTitulo(r))
    const out = inferirObservado({ ...base, leituras: ls, thumbsPorId: new Map(), agoraMs: agoraEm(5 * 24 + 12) })
    expect(out).toHaveLength(1)
  })
  it('carência: B só nas primeiras 24 h -> 0 trocas; A, B(20 h, descartada), C(dia 3) -> nenhuma troca A->C', () => {
    const ls = [leitura(0, porTitulo('A')), leitura(6, porTitulo('A')), leitura(12, porTitulo('B')), leitura(18, porTitulo('B')), leitura(30, porTitulo('A')), leitura(36, porTitulo('A'))]
    expect(inferirObservado({ ...base, leituras: ls, thumbsPorId: new Map(), agoraMs: agoraEm(40) })).toEqual([])
    const l2 = [leitura(0, porTitulo('A')), leitura(20, porTitulo('B')), leitura(21, porTitulo('B')), leitura(72, porTitulo('C')), leitura(78, porTitulo('C'))]
    // a versão inicial é a vigente aos 24 h: só C aparece depois da carência, então não há troca A->C
    expect(inferirObservado({ ...base, leituras: l2, thumbsPorId: new Map(), agoraMs: agoraEm(80) })).toEqual([])
  })
  it('estável: 24 h na mesma versão, > 12 h de span e leitura fresca; troca há 6 h = em_andamento; leitura velha = em_andamento', () => {
    const rot = ['A', 'A', 'B', 'B', 'B', 'B', 'B', 'B', 'B']
    const [e] = titulos(rot, T0 + 8 * 6 + 1)
    expect(e!.ficouEstado).toBe('estavel')
    const [rec] = titulos(['A', 'A', 'B', 'B'], T0 + 3 * 6 + 1)
    expect(rec!.ficouEstado).toBe('em_andamento')
    const [velha] = titulos(rot, T0 + 8 * 6 + 10) // última leitura há 10 h (> FRESCOR_H = 9)
    expect(velha!.ficouEstado).toBe('em_andamento')
    const [justo] = titulos(rot, T0 + 8 * 6 + 8)
    expect(justo!.ficouEstado).toBe('estavel')
  })
  it('estável exige MAIS de 12 h entre a 1ª e a última leitura da versão (a janela de 24 h sozinha não basta)', () => {
    const mk = (hs: number[]) => hs.map(h => leitura(h, { tituloOficial: h < 60 ? 'Titulo A' : 'Titulo B' }))
    const doze = inferirObservado({ ...base, leituras: mk([30, 36, 66, 72, 78]), thumbsPorId: new Map(), agoraMs: agoraEm(80) })
    expect(doze[0]!.ficouEstado).toBe('em_andamento')
    const dezoito = inferirObservado({ ...base, leituras: mk([30, 36, 66, 72, 78, 84]), thumbsPorId: new Map(), agoraMs: agoraEm(85) })
    expect(dezoito[0]!.ficouEstado).toBe('estavel')
  })
  it('título oscilando nunca é estável', () => {
    const [o] = titulos(['A', 'A', 'B', 'B', 'A', 'A', 'B', 'B', 'A', 'A'], T0 + 9 * 6 + 1)
    expect(o!.ficouEstado).toBe('em_andamento')
  })
  it('alvo que saiu em troca -> sem_desfecho com motivo = saiu_por; estável que saiu continua estável', () => {
    const [o] = titulos(['A', 'A', 'B', 'B'], T0 + 400, { alvoSaiu: true, saiuPor: 'janela' })
    expect(o).toMatchObject({ ficouEstado: 'sem_desfecho', motivo: 'janela' })
    const [e] = titulos(['A', 'A', 'B', 'B', 'B', 'B', 'B', 'B', 'B'], T0 + 400, { alvoSaiu: true, saiuPor: 'janela' })
    expect(e).toMatchObject({ ficouEstado: 'estavel', motivo: null })
  })
  it('títulos iguais com fontes diferentes -> nenhuma; A/B com mesma fonte e idioma -> 1 troca; idioma minoritário não entra', () => {
    const ls = [leitura(30), leitura(36), leitura(42, { tituloFonte: 'og_title' }), leitura(48, { tituloFonte: 'og_title', tituloOficial: 'Titulo A' })]
    expect(inferirObservado({ ...base, leituras: ls, thumbsPorId: new Map(), agoraMs: agoraEm(55) })).toEqual([])
    const mix = [...sequencia(30, ['A', 'A', 'B', 'B'], (r) => porTitulo(r)), leitura(55, { idioma: 'en', tituloOficial: 'Other' })]
    const out = inferirObservado({ ...base, leituras: mix, thumbsPorId: new Map(), agoraMs: agoraEm(60) })
    expect(out).toHaveLength(1)
    expect(out[0]!.nVersoes).toBe(2)
  })
  it('leituras com erro, http != 200 ou jogador bloqueado não contam', () => {
    const ls = sequencia(T0, ['A', 'A', 'B', 'B'], (r) => ({ ...porTitulo(r), ...(r === 'B' ? { erro: 'timeout', tituloOficial: null, tituloFonte: null } : {}) }))
    expect(inferirObservado({ ...base, leituras: ls, thumbsPorId: new Map(), agoraMs: agoraEm(60) })).toEqual([])
    const bl = sequencia(T0, ['A', 'A', 'B', 'B'], (r) => ({ ...porTitulo(r), ...(r === 'B' ? { jogadorBloqueado: true } : {}) }))
    expect(inferirObservado({ ...base, leituras: bl, thumbsPorId: new Map(), agoraMs: agoraEm(60) })).toEqual([])
    const h404 = sequencia(T0, ['A', 'A', 'B', 'B'], (r) => ({ ...porTitulo(r), ...(r === 'B' ? { http: 404 } : {}) }))
    expect(inferirObservado({ ...base, leituras: h404, thumbsPorId: new Map(), agoraMs: agoraEm(60) })).toEqual([])
  })
  it('60 leituras alternando 6 títulos (>= 50 corridas): guarda as 20 mais recentes, n_versoes = 6, cada corrida <= 1000 bytes (título de 100 caracteres)', () => {
    const rot = Array.from({ length: 60 }, (_, i) => 'TRC'[0] + String(Math.floor(i / 2) % 6))
    const longo = 'ç'.repeat(100)
    const ls = rot.map((r, i) => leitura(30 + i * 6, { tituloOficial: longo + r }))
    const [o] = inferirObservado({ ...base, leituras: ls, thumbsPorId: new Map(), agoraMs: agoraEm(30 + 60 * 6) })
    expect(o!.trocas).toHaveLength(20)
    expect(o!.nVersoes).toBe(6)
    for (const c of o!.trocas) expect(Buffer.byteLength(JSON.stringify(c), 'utf8')).toBeLessThanOrEqual(1000)
  })
  it('corrida cabe em 1000 bytes mesmo com texto enorme', () => {
    const enorme = 'ç'.repeat(5000)
    const ls = sequencia(30, ['A', 'A', 'B', 'B'], (r) => ({ tituloOficial: enorme + r }))
    const [o] = inferirObservado({ ...base, leituras: ls, thumbsPorId: new Map(), agoraMs: agoraEm(60) })
    for (const c of o!.trocas) expect(Buffer.byteLength(JSON.stringify(c), 'utf8')).toBeLessThanOrEqual(1000)
  })
})

describe('inferirObservado: miniatura', () => {
  it('troca de miniatura vista -> 2 versões, ficou B', () => {
    const { observados: [o] } = miniaturas(['A', 'A', 'B', 'B'], DH, T0 + 30)
    expect(o).toMatchObject({ campo: 'miniatura', nVersoes: 2, tipoTroca: 'sequencial' })
    expect(o!.ficou).toEqual({ dhash: DH_B })
  })
  it('A,A,B,B,A,A -> alternada, ficou A', () => {
    const { observados: [o] } = miniaturas(['A', 'A', 'B', 'B', 'A', 'A'], DH, T0 + 40)
    expect(o).toMatchObject({ tipoTroca: 'alternada', nVersoes: 2 })
    expect(o!.ficou).toEqual({ dhash: DH_A })
  })
  it('mesma imagem recomprimida (distância 2, outro sha) -> nenhuma troca', () => {
    expect(miniaturas(['A', 'A', 'A2', 'A2'], DH, T0 + 30).observados).toEqual([])
  })
  it('distância 8 -> indeterminada: 0 trocas e o contador conta', () => {
    const r = miniaturas(['A', 'A', 'C', 'C'], DH, T0 + 30)
    expect(r.observados).toEqual([])
    expect(r.indeterminadas).toBe(1)
  })
  it('fronteira: distância exatamente 10 é troca (não indeterminada); 9 é indeterminada', () => {
    const dez = miniaturas(['A', 'A', 'X', 'X'], { A: DH_A, X: '00000000000003ff' }, T0 + 30)
    expect(dez.observados).toHaveLength(1)
    expect(dez.indeterminadas).toBe(0)
    const nove = miniaturas(['A', 'A', 'X', 'X'], { A: DH_A, X: '00000000000001ff' }, T0 + 30)
    expect(nove.observados).toEqual([])
    expect(nove.indeterminadas).toBe(1)
  })
  it('mesma imagem em hqdefault e maxresdefault -> 0 trocas (só a variante dominante conta)', () => {
    const r = miniaturas(['A', 'A', 'A', 'B', 'B'], DH, T0 + 30, (t, i) => (i >= 3 ? { ...t, variante: 'hqdefault' } : t))
    expect(r.observados).toEqual([])
  })
  it('placeholder 120x90 descartado: A,A,placeholder,placeholder,A,A -> nenhuma', () => {
    const r = miniaturas(['A', 'A', 'B', 'B', 'A', 'A'], DH, T0 + 40, (t, i) => (i === 2 || i === 3 ? { ...t, largura: 120, altura: 90 } : t))
    expect(r.observados).toEqual([])
  })
  it('dhash nulo não conta; thumb ausente (miniatura_id nulo) não conta', () => {
    const r = miniaturas(['A', 'A', 'B', 'B'], DH, T0 + 30, (t, i) => (i >= 2 ? { ...t, dhash: null } : t))
    expect(r.observados).toEqual([])
    const ls = [leitura(30, { miniaturaId: null }), leitura(36, { miniaturaId: null })]
    expect(inferirObservadoDetalhe({ ...base, leituras: ls, thumbsPorId: new Map(), agoraMs: agoraEm(40) }).observados).toEqual([])
  })
  it('miniatura estável + título oscilante -> 2 linhas com estados distintos', () => {
    const thumbs = new Map<number, ThumbObs>()
    const rot = ['A', 'A', 'B', 'B', 'B', 'B', 'B', 'B', 'B']
    const ls = rot.map((r, i) => {
      const id = 2000 + i; thumbs.set(id, thumb(id, r === 'A' ? DH_A : DH_B))
      return leitura(30 + i * 6, { miniaturaId: id, tituloOficial: i % 4 < 2 ? 'Titulo X' : 'Titulo Y' })
    })
    const out = inferirObservado({ ...base, leituras: ls, thumbsPorId: thumbs, agoraMs: agoraEm(30 + 8 * 6 + 1) })
    expect(out.map(o => [o.campo, o.ficouEstado])).toEqual([['titulo', 'em_andamento'], ['miniatura', 'estavel']])
  })
})

describe('inferirObservado: a versão só vale se vista em >= 2 RODADAS distintas (Phil C1 = Yannis I2)', () => {
  const tit = (itens: string[], agoraH = T0 + 80) => inferirObservado({ ...base, leituras: rodadas(T0, itens, (l) => porTitulo(l)), thumbsPorId: new Map(), agoraMs: agoraEm(agoraH) })
  it('B nas 3 passadas de UMA rodada só (blip de espectador) -> nenhuma troca', () => {
    expect(tit(['AAA', 'AAA', 'BBB', 'AAA', 'AAA', 'AAA'])).toEqual([])
    expect(tit(['AAA', 'BBB', 'AAA'])).toEqual([])
  })
  it('passadas A,B,B | A,A,A | A,A,A -> nenhuma linha (B não passa de uma rodada)', () => {
    expect(tit(['ABB', 'AAA', 'AAA'])).toEqual([])
  })
  it('A,A,A | A,A,A | B,B,B | B,B,B -> 1 troca sequencial (cada versão em 2 rodadas)', () => {
    const out = tit(['AAA', 'AAA', 'BBB', 'BBB'])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ tipoTroca: 'sequencial', nVersoes: 2 })
    expect(out[0]!.trocas.map(t => t.leituras)).toEqual([6, 6]) // `leituras` continua contando leituras
  })
  it('A,A,A | B,B,B | B,B,B: a 1ª versão do vídeo vale com 1 rodada unânime (exceção) -> 1 troca sequencial com rodadas:1', () => {
    const out = tit(['AAA', 'BBB', 'BBB'])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ tipoTroca: 'sequencial', veredito: 'troca_observada', nVersoes: 2 })
    expect(out[0]!.trocas.map(t => t.rodadas)).toEqual([1, 2])
  })
  it('A,A,A | B,B,B (B numa rodada só) -> nenhuma; a exceção exige a seguinte confirmada', () => {
    expect(tit(['AAA', 'BBB'])).toEqual([])
  })
  it('a exceção vale só na 1ª corrida: A,A,A | A,A,A | B,B,B | C,C,C | C,C,C não grava a troca A->B no meio da série', () => {
    const out = tit(['AAA', 'AAA', 'BBB', 'CCC', 'CCC'])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ nVersoes: 2 })
    expect(out[0]!.trocas.map(t => t.rodadas)).toEqual([2, 2]) // A (2 rodadas) -> C; o B de uma rodada não entrou
  })
  it('a exceção exige que a corrida SEGUINTE se confirme: A,A,A | B,B,B | C,C,C | C,C,C -> nenhuma (B é blip)', () => {
    expect(tit(['AAA', 'BBB', 'CCC', 'CCC'])).toEqual([])
  })
  it('com a exceção, as corridas do meio de uma rodada só continuam descartadas: A | B,B | C (1 rodada) | D,D', () => {
    const out = tit(['AAA', 'BBB', 'BBB', 'CCC', 'DDD', 'DDD'])
    expect(out[0]!.nVersoes).toBe(3) // A (exceção), B, D; o C de uma rodada não entra
    expect(out[0]!.trocas.map(t => t.rodadas)).toEqual([1, 2, 2])
  })
  it('a exceção exige 3 passadas concordantes: A,A | B,B,B | B,B,B (rodada inicial com 2 passadas) -> nenhuma', () => {
    expect(tit(['AA', 'BBB', 'BBB'])).toEqual([])
  })
  it('a exceção nunca vira alternada: A,A,A | B,B,B | B,B,B | A,A,A | A,A,A não usa a 1ª rodada', () => {
    const out = tit(['AAA', 'BBB', 'BBB', 'AAA', 'AAA'])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ tipoTroca: 'sequencial', nVersoes: 2 })
    expect(out[0]!.trocas.map(t => t.rodadas)).toEqual([2, 2])
  })
  it('a corrida não atravessa a fronteira de rodada: AAB | BAA | AAA -> nenhuma troca (Yannis C2)', () => {
    expect(tit(['AAB', 'BAA', 'AAA'])).toEqual([])
    expect(tit(['AAB', 'BBB', 'BBB'])).toEqual([]) // a rodada inicial mista não abre a exceção, e não há 2ª versão qualificada
  })
  it('A,A | B,B continua 1 troca (rodadas unânimes de 1 passada)', () => {
    const out = titulos(['A', 'A', 'B', 'B'], T0 + 30)
    expect(out).toHaveLength(1)
  })
  it('rodada mista (A,B,A) entre rodadas de A não forma versão', () => {
    expect(tit(['AAA', 'ABA', 'AAA'])).toEqual([])
  })
  it('mesma regra na miniatura: B em uma rodada só -> nenhuma; em duas -> 1 troca', () => {
    const mk = (itens: string[]) => {
      const thumbs = new Map<number, ThumbObs>([[1, thumb(1, DH_A)], [2, thumb(2, DH_B)]])
      const ls = rodadas(T0, itens, (l) => ({ tituloOficial: null, tituloFonte: null, miniaturaId: l === 'A' ? 1 : 2 }))
      return inferirObservadoDetalhe({ ...base, leituras: ls, thumbsPorId: thumbs, agoraMs: agoraEm(T0 + 80) }).observados
    }
    expect(mk(['AAA', 'BBB', 'AAA', 'AAA'])).toEqual([])
    expect(mk(['AAA', 'AAA', 'BBB', 'BBB'])).toHaveLength(1)
  })
})

describe('inferirObservadoDetalhe: rodadas válidas por campo (Phil C2)', () => {
  it('conta rodadas distintas com leitura válida, por campo', () => {
    const ls = rodadas(T0, ['AAA', 'AAA', 'AAA', 'AAA'], (l) => porTitulo(l))
    const r = inferirObservadoDetalhe({ ...base, leituras: ls, thumbsPorId: new Map(), agoraMs: agoraEm(T0 + 40) })
    expect(r.validasTitulo).toBe(4)
    expect(r.validasMiniatura).toBe(0) // título lido, nenhum dhash
  })
  it('todas as leituras com erro, bloqueadas ou antes da carência -> zero nos dois campos', () => {
    const ls = rodadas(T0, ['AAA', 'AAA', 'AAA'], (l) => ({ ...porTitulo(l), erro: 'timeout' }))
    expect(inferirObservadoDetalhe({ ...base, leituras: ls, thumbsPorId: new Map(), agoraMs: agoraEm(T0 + 40) })).toMatchObject({ validasTitulo: 0, validasMiniatura: 0 })
    const cedo = rodadas(2, ['AAA', 'AAA'], (l) => porTitulo(l))
    expect(inferirObservadoDetalhe({ ...base, leituras: cedo, thumbsPorId: new Map(), agoraMs: agoraEm(T0 + 40) })).toMatchObject({ validasTitulo: 0 })
  })
})
