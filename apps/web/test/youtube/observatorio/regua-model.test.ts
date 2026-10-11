// @vitest-environment node
/** Tarefa 7 (A3): a conta da régua do nicho (escala, empates, posição escrita, letras). Pura, sem tela. */
import { describe, it, expect } from 'vitest'
import { escalar, buildRegua, afastarLetras, alturaPilha, MIN_REGUA, type Traco, type ReguaView } from '@/app/cms/(authed)/youtube/competitors/_chrome/regua/regua-model'

const n = (x: number) => String(x)
const val = (id: string, x: number, nome = id) => ({ id, nome, x, texto: n(x) })
const O = { numero: 'inscritos', conjunto: 'em Viagem', un: 'inscritos' }
const A = (id: string, nome = id) => ({ id, letra: 'A' as const, nome })
const B = (id: string, nome = id) => ({ id, letra: 'B' as const, nome })
const tr = (v: ReguaView, id: string): Traco => { const t = v.tracos.find(x => x.id === id); if (!t) throw new Error('sem traço ' + id); return t }
/** Todo texto que o modelo devolve (para varrer palavras proibidas). */
const textos = (v: ReguaView): string[] => [v.aria, v.vazio ?? '', ...v.semTraco.map(s => s.texto), ...v.tracos.flatMap(t => [t.nome, t.texto, ...t.grupo])]

describe('escalar', () => {
  it('linear quando os valores se espalham', () => {
    const e = escalar([0, 25, 50, 75, 100])
    expect(e.comprimida).toBe(false)
    expect(e.min).toBe(0); expect(e.max).toBe(100)
    expect(e.pct(0)).toBe(0); expect(e.pct(25)).toBe(25); expect(e.pct(100)).toBe(100)
  })
  it('comprimida (raiz de x − min) quando 60% ou mais caem no primeiro quarto, e não com 59%', () => {
    const com = (baixos: number, total: number) => [...Array.from({ length: baixos }, (_, i) => i % 20), ...Array.from({ length: total - baixos }, (_, i) => 40 + i), 100]
    // 100 valores: o primeiro quarto do eixo [0,100] vai até 25 (exclusive)
    expect(escalar(com(60, 99)).comprimida).toBe(true)
    expect(escalar(com(59, 99)).comprimida).toBe(false)
    const c = escalar([0, 1, 2, 3, 4, 5, 60, 70, 80, 100])
    expect(c.comprimida).toBe(true)
    expect(c.pct(0)).toBe(0); expect(c.pct(100)).toBe(100)
    expect(c.pct(25)).toBeCloseTo(50, 6) // √(25/100) = 0,5
  })
  it('o valor exatamente no corte do primeiro quarto NÃO conta como baixo (x < corte)', () => {
    // [0, 25, 25, 100]: 25 é o corte; só o 0 é baixo -> 25%
    expect(escalar([0, 25, 25, 100]).comprimida).toBe(false)
    // 3 de 5 baixos (60%) com um sobre o corte
    expect(escalar([0, 1, 2, 25, 100]).comprimida).toBe(true)
  })
  it('todos iguais dão 50% e não comprimem; um valor só também', () => {
    const e = escalar([7, 7, 7])
    expect(e.comprimida).toBe(false); expect(e.pct(7)).toBe(50)
    const u = escalar([42])
    expect(u.comprimida).toBe(false); expect(u.pct(42)).toBe(50)
  })
  it('lista vazia não lança: 50% e linear', () => {
    const e = escalar([])
    expect(e.comprimida).toBe(false); expect(e.pct(3)).toBe(50)
  })
  it('valor abaixo do mínimo nunca dá porcentagem negativa nem NaN', () => {
    const e = escalar([10, 20, 100, 200, 300])
    expect(e.pct(5)).toBe(0)
    expect(Number.isNaN(escalar([0, 1, 2, 3, 4, 5, 60, 70, 80, 100]).pct(-4))).toBe(false)
  })
})

describe('buildRegua · traços e ordem', () => {
  it('um traço por canal com valor, do menor ao maior; empate de valor desempata pelo nome', () => {
    const v = buildRegua([val('c', 30, 'Cris'), val('a', 10, 'Ana'), val('d', 30, 'Beto'), val('b', 20, 'Bia')], [], O)
    expect(v.n).toBe(4)
    expect(v.tracos.map(t => t.nome)).toEqual(['Ana', 'Bia', 'Beto', 'Cris'])
    expect(v.tracos.map(t => t.pct)).toEqual([0, 50, 100, 100])
  })
  it('só entra na régua quem tem valor: a marca de um lado sem valor não vira traço', () => {
    const v = buildRegua([val('a', 10), val('b', 20), val('c', 30), val('d', 40)], [A('a'), B('zz', 'Sem Medida')], O)
    expect(v.n).toBe(4)
    expect(v.tracos.filter(t => t.marca)).toHaveLength(1)
    expect(tr(v, 'a').marca).toBe('A')
    expect(v.tracos.find(t => t.id === 'zz')).toBeUndefined()
  })
  it('a marca de A e de B chega ao traço certo', () => {
    const v = buildRegua([val('a', 10), val('b', 20), val('c', 30)], [A('c'), B('a')], O)
    expect(tr(v, 'c').marca).toBe('A'); expect(tr(v, 'a').marca).toBe('B'); expect(tr(v, 'b').marca).toBeNull()
  })
  it('valor não finito lança (falha alto, nunca some um traço em silêncio)', () => {
    expect(() => buildRegua([val('a', NaN), val('b', 1), val('c', 2)], [], O)).toThrow()
    expect(() => buildRegua([val('a', Infinity), val('b', 1), val('c', 2)], [], O)).toThrow()
  })
  it('o texto do valor escrito acompanha o traço (para a dica e para o leitor de tela)', () => {
    const v = buildRegua([{ id: 'a', nome: 'Ana', x: 1530, texto: '1,53 mil' }, val('b', 2000), val('c', 3000)], [], O)
    expect(tr(v, 'a').texto).toBe('1,53 mil')
  })
})

describe('buildRegua · empates', () => {
  const cinco = () => buildRegua([...[1, 2, 3, 4, 5].map(i => val('t' + i, 50, 'Canal ' + i)), val('lo', 10), val('hi', 90)], [], O)
  it('sem lado destacado empilha na vertical: cinco canais = coluna de 23 px (bloco de 3 px, passo de 5 px)', () => {
    const v = cinco()
    const pilha = v.tracos.filter(t => t.x === 50)
    expect(pilha).toHaveLength(5)
    expect(pilha.map(t => t.pilha?.i)).toEqual([0, 1, 2, 3, 4])
    for (const t of pilha) { expect(t.pilha?.passo).toBe(5); expect(t.dx).toBe(0) }
    expect(alturaPilha(5)).toBe(3)
    // do pé do primeiro bloco ao topo do último
    expect((5 - 1) * 5 + alturaPilha(5)).toBe(23)
    for (const t of v.tracos.filter(t => t.x !== 50)) expect(t.pilha).toBeNull()
  })
  it('a dica diz "5 canais com 50" e carrega os nomes de quem tem o mesmo valor', () => {
    const t = tr(cinco(), 't1')
    expect(t.grupo).toEqual(['Canal 1', 'Canal 2', 'Canal 3', 'Canal 4', 'Canal 5'])
  })
  it('a pilha cabe em 26 px mesmo com muitos canais (o passo encolhe, nunca passa de 5)', () => {
    const v = buildRegua([...Array.from({ length: 14 }, (_, i) => val('t' + i, 50, 'C' + String(i).padStart(2, '0'))), val('lo', 1), val('hi', 100)], [], O)
    const p = v.tracos.filter(t => t.x === 50)
    const passo = p[0]!.pilha!.passo
    expect(passo).toBeLessThanOrEqual(5); expect(passo).toBeGreaterThanOrEqual(1)
    expect((14 - 1) * passo + alturaPilha(passo)).toBeLessThanOrEqual(26)
    expect(new Set(p.map(t => t.pilha!.passo)).size).toBe(1)
  })
  it('empate com um lado destacado: o destacado fica no valor exato (dx 0) e os outros abrem para os lados', () => {
    const v = buildRegua([val('m', 50, 'Meu'), val('o1', 50), val('o2', 50), val('o3', 50), val('lo', 10), val('hi', 90)], [A('m')], O)
    expect(tr(v, 'm').dx).toBe(0)
    const dxs = ['o1', 'o2', 'o3'].map(id => tr(v, id).dx)
    expect(dxs).toEqual([4.4, -4.4, 7])
    // o passo entre vizinhos do mesmo lado é de 2,6 px
    expect(dxs[2]! - dxs[0]!).toBeCloseTo(2.6, 6)
    for (const id of ['m', 'o1', 'o2', 'o3']) expect(tr(v, id).pilha).toBeNull()
  })
  it('nas pontas o empate abre só para dentro da régua', () => {
    const noMin = buildRegua([val('m', 10, 'Meu'), val('o1', 10), val('o2', 10), val('o3', 10), val('mid', 50), val('hi', 90)], [A('m')], O)
    expect(['o1', 'o2', 'o3'].map(id => tr(noMin, id).dx)).toEqual([4.4, 7, 9.6])
    const noMax = buildRegua([val('m', 90, 'Meu'), val('o1', 90), val('o2', 90), val('mid', 50), val('lo', 10)], [A('m')], O)
    expect(['o1', 'o2'].map(id => tr(noMax, id).dx)).toEqual([-4.4, -7])
  })
  it('os dois lados empatados entre si ficam distinguíveis: A abre para a esquerda, B para a direita, sem se cobrir', () => {
    const v = buildRegua([val('a', 50, 'Aa'), val('b', 50, 'Bb'), val('lo', 10), val('hi', 90)], [A('a'), B('b')], O)
    expect(tr(v, 'a').dx).toBe(-2.5); expect(tr(v, 'b').dx).toBe(2.5)
    expect(tr(v, 'a').pilha).toBeNull()
    // o terceiro canal empatado abre além dos dois
    const w = buildRegua([val('a', 50, 'Aa'), val('b', 50, 'Bb'), val('c', 50, 'Cc'), val('lo', 10), val('hi', 90)], [A('a'), B('b')], O)
    expect(Math.abs(tr(w, 'c').dx)).toBeGreaterThan(2.5 + 2)
  })
  it('o empate é o do valor ESCRITO: dois valores que se escrevem igual formam um grupo, cada um no seu lugar', () => {
    const v = buildRegua([
      { id: 'p', nome: 'P', x: 1530, texto: '1,53 mil' }, { id: 'q', nome: 'Q', x: 1534, texto: '1,53 mil' },
      val('lo', 10), val('hi', 9000),
    ], [], O)
    expect(tr(v, 'p').grupo).toEqual(['P', 'Q'])
    expect(tr(v, 'p').pilha).not.toBeNull()
    expect(tr(v, 'p').pct).not.toBe(tr(v, 'q').pct) // a posição no eixo continua a do valor real
  })
  it('valor sem empate não tem pilha, nem dx, e o grupo é só ele mesmo', () => {
    const v = buildRegua([val('a', 1), val('b', 2), val('c', 3)], [], O)
    for (const t of v.tracos) { expect(t.pilha).toBeNull(); expect(t.dx).toBe(0); expect(t.grupo).toEqual([t.nome]) }
  })
})

describe('buildRegua · posição escrita e aria', () => {
  const mundo = () => Array.from({ length: 14 }, (_, i) => val('c' + i, (i + 1) * 100, 'Canal ' + (i + 1)))
  it('o aria diz a posição dos dois lados e o conjunto ("13º de 14 em Viagem"), 1º = o maior', () => {
    const v = buildRegua(mundo(), [{ id: 'c1', letra: 'A', nome: 'Canal 2' }, { id: 'c13', letra: 'B', nome: 'Canal 14' }], O)
    expect(v.aria).toContain('Lado A, Canal 2: 13º de 14 em Viagem')
    expect(v.aria).toContain('Lado B, Canal 14: 1º de 14 em Viagem')
    expect(v.aria).toContain('inscritos')
  })
  it('conjunto geral: a frase diz "no geral", nunca só "de N"', () => {
    const v = buildRegua(mundo(), [A('c0', 'Canal 1')], { numero: 'inscritos', conjunto: 'no geral' })
    expect(v.aria).toContain('14º de 14 no geral')
    expect(v.aria).not.toMatch(/de 14(?! (em|no) )/)
  })
  it('empate dito pelo valor escrito, e a posição divide (1º, 1º, 3º)', () => {
    const v = buildRegua([val('a', 90, 'Aa'), val('b', 90, 'Bb'), val('c', 10, 'Cc'), val('d', 5, 'Dd')], [A('a', 'Aa'), B('c', 'Cc')], O)
    expect(v.aria).toContain('Lado A, Aa: 1º de 4 em Viagem (empate)')
    expect(v.aria).toContain('Lado B, Cc: 3º de 4 em Viagem')
    const w = buildRegua([
      { id: 'a', nome: 'Aa', x: 1530, texto: '1,53 mil' }, { id: 'b', nome: 'Bb', x: 1534, texto: '1,53 mil' }, val('c', 10), val('d', 5),
    ], [A('a', 'Aa')], O)
    expect(w.aria).toContain('Lado A, Aa: 1º de 4 em Viagem (empate)')
  })
  it('lado sem valor: não ganha traço, fora do "de N", e o texto diz por quê', () => {
    const v = buildRegua(mundo(), [A('c4', 'Canal 5'), { id: 'x', letra: 'B', nome: 'Fulano', motivo: 'inscritos ocultos pelo canal' }], O)
    expect(v.n).toBe(14)
    expect(v.semTraco).toEqual([{ letra: 'B', nome: 'Fulano', texto: 'sem traço de Fulano (lado B): inscritos ocultos pelo canal' }])
    expect(v.aria).toContain('Lado A, Canal 5: 10º de 14 em Viagem')
    expect(v.aria).toContain('sem traço de Fulano (lado B): inscritos ocultos pelo canal')
    expect(v.aria).not.toMatch(/Lado B, Fulano: \d/)
  })
  it('lado sem valor e sem motivo informado: o texto ainda diz que não foi medido (nunca vazio)', () => {
    const v = buildRegua(mundo(), [A('c4', 'Canal 5'), { id: 'x', letra: 'B', nome: 'Fulano' }], O)
    expect(v.semTraco[0]!.texto).toBe('sem traço de Fulano (lado B): este número não foi medido')
  })
  it('"escala comprimida" no aria só quando é', () => {
    const linear = buildRegua(mundo(), [A('c0')], O)
    expect(linear.comprimida).toBe(false); expect(linear.aria).not.toMatch(/escala comprimida/i)
    const baixos = [...Array.from({ length: 12 }, (_, i) => val('b' + i, 1 + i, 'B' + i)), val('g1', 500), val('g2', 1000)]
    const c = buildRegua(baixos, [A('b0')], O)
    expect(c.comprimida).toBe(true); expect(c.aria).toMatch(/escala comprimida/i)
  })
  it('nenhum texto do modelo diz "escala √" nem "raiz" (nem palavra interna)', () => {
    const baixos = [...Array.from({ length: 12 }, (_, i) => val('b' + i, 1 + i, 'B' + i)), val('g1', 500), val('g2', 1000)]
    for (const v of [buildRegua(baixos, [A('b0')], O), buildRegua(mundo(), [A('c0'), B('zz', 'Z')], O), buildRegua([val('a', 1)], [], O)]) {
      for (const t of textos(v)) { expect(t).not.toMatch(/√/); expect(t).not.toMatch(/raiz/i); expect(t).not.toMatch(/\b(pacote|dataset|ranking|sentinela|motor|R73)\b|conjunto do site/i) }
    }
  })
})

describe('buildRegua · poucos canais', () => {
  it(`menos de ${MIN_REGUA} canais com valor: sem traços e a frase diz o conjunto e a conta`, () => {
    const v = buildRegua([val('a', 10), val('b', 20)], [A('a'), B('b')], O)
    expect(v.tracos).toEqual([])
    expect(v.vazio).toBe('poucos canais para comparar em Viagem (2; precisa de 3)')
  })
  it('um canal só (o conjunto tem só o lado): frase, sem traço', () => {
    const v = buildRegua([val('a', 10)], [A('a')], { numero: 'inscritos', conjunto: 'no geral' })
    expect(v.vazio).toBe('poucos canais para comparar no geral (1; precisa de 3)')
    expect(v.tracos).toHaveLength(0)
  })
  it('nenhum canal com valor: a frase diz 0, nunca "NaN" nem traço', () => {
    const v = buildRegua([], [A('a', 'Aa'), B('b', 'Bb')], O)
    expect(v.vazio).toBe('poucos canais para comparar em Viagem (0; precisa de 3)')
    expect(v.semTraco.map(s => s.letra)).toEqual(['A', 'B'])
  })
  it('com o mínimo de canais a régua existe e não há frase de falta', () => {
    const v = buildRegua([val('a', 1), val('b', 2), val('c', 3)], [A('a')], O)
    expect(v.vazio).toBeNull(); expect(v.tracos).toHaveLength(3)
  })
})

describe('afastarLetras', () => {
  const dist = (pa: number, pb: number, w: number) => { const [da, db] = afastarLetras(pa, pb, w); return Math.abs((pa * w) / 100 + da - ((pb * w) / 100 + db)) }
  it('separa letras a menos de 20 px (fica pelo menos a 20 px) e mantém o meio entre as duas', () => {
    const [da, db] = afastarLetras(50, 51, 400) // 4 px de distância
    expect(dist(50, 51, 400)).toBeGreaterThanOrEqual(20)
    expect((200 + da + (204 + db)) / 2).toBeCloseTo(202, 6)
    expect(da).toBeLessThan(0); expect(db).toBeGreaterThan(0) // A à esquerda de B: A vai para a esquerda
  })
  it('A à direita de B: A vai para a direita, B para a esquerda', () => {
    const [da, db] = afastarLetras(60, 59, 400)
    expect(da).toBeGreaterThan(0); expect(db).toBeLessThan(0)
  })
  it('exatamente no mesmo ponto: A fica à esquerda', () => {
    const [da, db] = afastarLetras(50, 50, 400)
    expect(da).toBeLessThan(0); expect(db).toBeGreaterThan(0)
    expect(dist(50, 50, 400)).toBeGreaterThanOrEqual(20)
  })
  it('não mexe quando há folga (20 px ou mais)', () => {
    expect(afastarLetras(10, 60, 400)).toEqual([0, 0])
    expect(afastarLetras(50, 55, 400)).toEqual([0, 0]) // 20 px exatos
  })
  it('na ponta da régua as letras não saem para fora: a folga vem toda do outro lado', () => {
    const [da, db] = afastarLetras(0, 0, 300)
    expect((0 * 300) / 100 + da).toBeGreaterThanOrEqual(0)
    expect(dist(0, 0, 300)).toBeGreaterThanOrEqual(20)
    expect(db).toBeGreaterThan(0)
    const [ea, eb] = afastarLetras(100, 100, 300)
    expect(300 + ea).toBeLessThanOrEqual(300 + 1e-9); expect(300 + eb).toBeLessThanOrEqual(300 + 1e-9)
    expect(dist(100, 100, 300)).toBeGreaterThanOrEqual(20)
  })
  it('largura zero ou inválida (sem layout) não mexe nem devolve NaN', () => {
    expect(afastarLetras(50, 50, 0)).toEqual([0, 0])
    expect(afastarLetras(50, 50, NaN)).toEqual([0, 0])
  })
})
