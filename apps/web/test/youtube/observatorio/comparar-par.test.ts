// @vitest-environment node
// A3 Tarefa 6: o par da comparação (modelo que roda no navegador): lados, cores, relação, barras, posição, rodapé e status.
// Bordas provadas com canais de mentira (par-helpers); invariantes provados sobre TODOS os pares do fixture, não sobre uma lista escolhida.
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { a3World } from './a3-fixture'
import { AGORA, canalDe, pacoteDe, type OpcoesCanal } from './par-helpers'
import { buildCompararPack, type CompararPack } from '@/app/cms/(authed)/youtube/competitors/_comparar/pack'
import { NUMEROS, NO_NICHO, type NumeroId } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import { buildPar, resolverPar, type LinhaPar, type ParView, type Relacao } from '@/app/cms/(authed)/youtube/competitors/_comparar/par-model'
import { dec, fx, haDias, juntar, quanto } from '@/app/cms/(authed)/youtube/competitors/_comparar/formatos'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

const PALAVRAS_INTERNAS = /\b(pack|pacote|dataset|conjunto do site|motor|sentinela|R73|escala √|ranking)\b/i
const PROIBIDAS = /ganha|vencedor|perdedor|melhor que|Infinity|NaN|undefined|\bnull\b|menor|menos que/i

const mk = (id: string, o: OpcoesCanal = {}) => canalDe(id, { name: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), ...o })
const linha = (v: ParView, id: NumeroId): LinhaPar => v.linhas.find(l => l.id === id)!
/** Um par de canais de mentira que só diferem em UM número; o resto fica sem dado (as linhas vazias saem). */
const duo = (id: NumeroId, a: number | null, b: number | null, oa: OpcoesCanal = {}, ob: OpcoesCanal = {}) =>
  buildPar(pacoteDe([mk('aa', { ...oa, n: { [id]: a, ...oa.n } }), mk('bb', { ...ob, n: { [id]: b, ...ob.n } })]), 'aa', 'bb')
const rel = (id: NumeroId, a: number | null, b: number | null, oa: OpcoesCanal = {}, ob: OpcoesCanal = {}): Relacao | null => linha(duo(id, a, b, oa, ob), id).relacao

describe('formatos', () => {
  it('vírgula decimal, "×" com uma casa até 10 e nenhuma depois, "+N%", "há N dias", "a, b e c"', () => {
    expect(dec(1.5, 1)).toBe('1,5'); expect(dec(12, 0)).toBe('12')
    expect(fx(2)).toBe('2,0×'); expect(fx(5)).toBe('5,0×'); expect(fx(9.94)).toBe('9,9×'); expect(fx(9.96)).toBe('10×'); expect(fx(10)).toBe('10×'); expect(fx(12.4)).toBe('12×')
    expect(quanto(1.1)).toBe('+10%'); expect(quanto(1.54)).toBe('+54%'); expect(quanto(1.99)).toBe('+99%'); expect(quanto(2)).toBe('2,0×'); expect(quanto(25)).toBe('25×')
    expect(haDias(0)).toBe('hoje'); expect(haDias(1)).toBe('há 1 dia'); expect(haDias(55)).toBe('há 55 dias')
    expect(juntar([])).toBe(''); expect(juntar(['a'])).toBe('a'); expect(juntar(['a', 'b'])).toBe('a e b'); expect(juntar(['a', 'b', 'c'])).toBe('a, b e c')
  })
})

/* ------------------------------------------------------------------------------------------------------------------ resolverPar */
describe('resolverPar', () => {
  // eu: 1.000 inscritos; concorrentes: A 5.000, B 3.000, C 2.000, D 500
  const mundo = pacoteDe([
    mk('eu', { own: true, subs: 1000 }), mk('ca', { subs: 5000 }), mk('cb', { subs: 3000 }), mk('cc', { subs: 2000 }), mk('cd', { subs: 500 }),
  ])
  it('sem a → o canal próprio; sem b → o concorrente logo acima de A em inscritos; sem ninguém acima → o maior', () => {
    expect(resolverPar(mundo, undefined, undefined)).toEqual({ a: 'eu', b: 'cc' }) // o logo acima de 1.000 é 2.000
    expect(resolverPar(mundo, 'cd', undefined)).toEqual({ a: 'cd', b: 'cc' }) // o concorrente logo acima de 500 (o próprio, com 1.000, não é concorrente)
    expect(resolverPar(mundo, 'cc', undefined)).toEqual({ a: 'cc', b: 'cb' })
    expect(resolverPar(mundo, 'ca', undefined)).toEqual({ a: 'ca', b: 'cb' }) // ninguém acima de 5.000: o maior dos outros
    expect(resolverPar(mundo, 'eu', 'cd')).toEqual({ a: 'eu', b: 'cd' }) // b informado e válido vale
    expect(resolverPar(mundo, undefined, 'ca')).toEqual({ a: 'eu', b: 'ca' })
  })
  it('a = b, a=lixo, b de canal que não existe → o padrão, sem lançar; site sem canal próprio → os dois maiores concorrentes', () => {
    expect(() => resolverPar(mundo, 'eu', 'eu')).not.toThrow()
    expect(resolverPar(mundo, 'eu', 'eu')).toEqual({ a: 'eu', b: 'cc' })
    expect(resolverPar(mundo, 'ca', 'ca')).toEqual({ a: 'ca', b: 'cb' })
    expect(resolverPar(mundo, 'lixo', undefined)).toEqual({ a: 'eu', b: 'cc' })
    expect(resolverPar(mundo, 'lixo', 'lixo')).toEqual({ a: 'eu', b: 'cc' })
    expect(resolverPar(mundo, 'cd', 'removido')).toEqual({ a: 'cd', b: 'cc' })
    expect(resolverPar(mundo, '', '')).toEqual({ a: 'eu', b: 'cc' })
    // a inválido e b válido: o padrão de A nunca coincide com o b que a pessoa pediu
    const r = resolverPar(mundo, 'lixo', 'eu')!
    expect(r.b).toBe('eu'); expect(r.a).not.toBe('eu')
    const semProprio = pacoteDe([mk('ca', { subs: 5000 }), mk('cb', { subs: 3000 }), mk('cc', { subs: 2000 })])
    expect(resolverPar(semProprio, undefined, undefined)).toEqual({ a: 'ca', b: 'cb' })
    expect(resolverPar(semProprio, 'lixo', 'lixo')).toEqual({ a: 'ca', b: 'cb' })
  })
  it('o canal próprio sem vídeos não é o padrão de A quando há outro próprio com vídeos; só ele → o maior concorrente', () => {
    const w = pacoteDe([mk('eu-vazio', { own: true, subs: 3, semVideos: true }), mk('eu', { own: true, subs: 1000 }), mk('ca', { subs: 5000 }), mk('cb', { subs: 3000 })])
    expect(w.ordem.slice(0, 2)).toEqual(['eu-vazio', 'eu']) // a ordem do servidor não prefere quem tem vídeos: o padrão é que decide
    expect(resolverPar(w, undefined, undefined)).toEqual({ a: 'eu', b: 'cb' })
    const so = pacoteDe([mk('eu-vazio', { own: true, subs: 3, semVideos: true }), mk('ca', { subs: 5000 }), mk('cb', { subs: 3000 })])
    expect(resolverPar(so, undefined, undefined)).toEqual({ a: 'ca', b: 'cb' })
  })
  it('11c, "o meu canal" com vários canais próprios: o lado A padrão é o de publicação mais recente (dias desde o último vídeo), a escolha do dono vale, e a URL vence tudo', () => {
    const w = pacoteDe([
      mk('eu-grande', { own: true, subs: 3000, n: { diasUltimo: 20 } }), mk('eu-novo', { own: true, subs: 40, n: { diasUltimo: 2 } }), mk('eu-parado', { own: true, subs: 900, n: { diasUltimo: 400 } }),
      mk('ca', { subs: 5000 }), mk('cb', { subs: 100 }),
    ])
    expect(resolverPar(w, undefined, undefined)!.a).toBe('eu-novo') // sem lembrança: o mais recente
    expect(resolverPar(w, undefined, undefined, null)!.a).toBe('eu-novo') // o teste que apaga o cookie
    expect(resolverPar(w, undefined, undefined, 'eu-grande')!.a).toBe('eu-grande') // a lembrança (ativa) vale
    expect(resolverPar(w, undefined, undefined, 'eu-parado')!.a).toBe('eu-novo') // lembrança de canal parado cede ao ativo
    expect(resolverPar(w, undefined, undefined, 'ca')!.a).toBe('eu-novo') // lembrança de quem não é próprio: ignorada
    expect(resolverPar(w, undefined, undefined, 'removido')!.a).toBe('eu-novo')
    expect(resolverPar(w, 'eu-parado', undefined, 'eu-grande')!.a).toBe('eu-parado') // a URL sempre vence
    expect(resolverPar(w, 'ca', 'cb', 'eu-grande')).toEqual({ a: 'ca', b: 'cb' })
    // b vem da URL e é o próprio mais recente: o A padrão não pode ser o mesmo canal; cai no seguinte
    expect(resolverPar(w, undefined, 'eu-novo')!.a).toBe('eu-grande')
  })
  it('13 (I-11c-2): a data exata do último vídeo decide, não os dias inteiros: no mesmo dia vence quem publicou depois, e a lembrança de 91,5 dias já é parada', () => {
    const DIA = 86_400_000, A = AGORA
    // os dois publicaram "há 2 dias" (dias inteiros iguais), o MAIOR um pouco antes: a lista escolhe o menor (publicou depois)
    const mesmoDia = pacoteDe([mk('eu-grande', { own: true, subs: 3000, ultimo: A - 2.9 * DIA, n: { diasUltimo: 2 } }), mk('eu-novo', { own: true, subs: 40, ultimo: A - 2.1 * DIA, n: { diasUltimo: 2 } }), mk('ca', { subs: 5000 })])
    expect(resolverPar(mesmoDia, undefined, undefined)!.a).toBe('eu-novo')
    // a ordem do pacote não pode desempatar quando a data exata separa os dois (nos dois sentidos)
    const inverso = pacoteDe([mk('eu-grande', { own: true, subs: 3000, ultimo: A - 2.1 * DIA, n: { diasUltimo: 2 } }), mk('eu-novo', { own: true, subs: 40, ultimo: A - 2.9 * DIA, n: { diasUltimo: 2 } }), mk('ca', { subs: 5000 })])
    expect(resolverPar(inverso, undefined, undefined)!.a).toBe('eu-grande')
    // a fronteira dos 91 dias: 91,5 dias é parado (a lista diz parado), então a lembrança cede ao canal ativo
    const fronteira = pacoteDe([mk('eu-lembrado', { own: true, subs: 3000, ultimo: A - 91.5 * DIA, n: { diasUltimo: 91 } }), mk('eu-ativo', { own: true, subs: 40, ultimo: A - 10 * DIA, n: { diasUltimo: 10 } }), mk('ca', { subs: 5000 })])
    expect(resolverPar(fronteira, undefined, undefined, 'eu-lembrado')!.a).toBe('eu-ativo')
    // e 90,5 dias ainda é ativo: a lembrança vale
    const dentro = pacoteDe([mk('eu-lembrado', { own: true, subs: 3000, ultimo: A - 90.5 * DIA, n: { diasUltimo: 90 } }), mk('eu-ativo', { own: true, subs: 40, ultimo: A - 10 * DIA, n: { diasUltimo: 10 } }), mk('ca', { subs: 5000 })])
    expect(resolverPar(dentro, undefined, undefined, 'eu-lembrado')!.a).toBe('eu-lembrado')
    // sem data exata (ultimo nulo) o canal nunca é ativo, mesmo com dias no número
    const semData = pacoteDe([mk('eu-sem', { own: true, subs: 3000, ultimo: null }), mk('eu-ativo', { own: true, subs: 40, ultimo: A - 10 * DIA }), mk('ca', { subs: 5000 })])
    expect(resolverPar(semData, undefined, undefined, 'eu-sem')!.a).toBe('eu-ativo')
  })
  it('13 (I-11c-2, critério único `canalTemVideos` da revisão da T9): canal próprio só com vídeos sem data É candidato (como na lista e no menu), mas sem data exata nunca é ativo', () => {
    const w = pacoteDe([mk('eu-sd', { own: true, subs: 3000, comDatas: false, ultimo: null }), mk('eu', { own: true, subs: 40, ultimo: AGORA - 300 * 86_400_000 }), mk('ca', { subs: 5000 })])
    // a lembrança vale: ele é candidato, e nenhum candidato está ativo
    expect(resolverPar(w, undefined, undefined, 'eu-sd')!.a).toBe('eu-sd')
    // com um ativo, o sem data (nunca ativo) cede, como antes
    const ativo = pacoteDe([mk('eu-sd', { own: true, subs: 3000, comDatas: false, ultimo: null }), mk('eu', { own: true, subs: 40, ultimo: AGORA - 10 * 86_400_000 }), mk('ca', { subs: 5000 })])
    expect(resolverPar(ativo, undefined, undefined, 'eu-sd')!.a).toBe('eu')
  })
  it('11c: todos os próprios sem data → a ordem do pacote; canal novo sem vídeos nunca é padrão nem por lembrança', () => {
    const sem = pacoteDe([mk('eu1', { own: true, subs: 500 }), mk('eu2', { own: true, subs: 400 }), mk('ca', { subs: 5000 })])
    expect(resolverPar(sem, undefined, undefined)!.a).toBe('eu1')
    const novo = pacoteDe([mk('eu-novo', { own: true, subs: 40, semVideos: true }), mk('eu', { own: true, subs: 100, n: { diasUltimo: 300 } }), mk('ca', { subs: 5000 })])
    expect(resolverPar(novo, undefined, undefined, 'eu-novo')!.a).toBe('eu')
  })
  it('inscritos escondidos: quem não tem a contagem nunca é "o logo acima"; sem a contagem de A, vale o maior', () => {
    const w = pacoteDe([mk('eu', { own: true, subs: 1000 }), mk('ca', { subs: null }), mk('cb', { subs: 3000 })])
    expect(resolverPar(w, undefined, undefined)).toEqual({ a: 'eu', b: 'cb' })
    const sem = pacoteDe([mk('eu', { own: true, subs: null }), mk('ca', { subs: 5000 }), mk('cb', { subs: 3000 })])
    expect(resolverPar(sem, undefined, undefined)).toEqual({ a: 'eu', b: 'ca' })
  })
  it('só os próprios: dois canais próprios formam o par', () => {
    const w = pacoteDe([mk('eu', { own: true, subs: 1000 }), mk('eu2', { own: true, subs: 800 })])
    expect(resolverPar(w, undefined, undefined)).toEqual({ a: 'eu', b: 'eu2' })
  })
  it('site com um canal só ou sem canais → null', () => {
    expect(resolverPar(pacoteDe([mk('so', { subs: 10 })]), undefined, undefined)).toBeNull()
    expect(resolverPar(pacoteDe([mk('so', { own: true, subs: 10 })]), 'so', 'so')).toBeNull()
    expect(resolverPar(pacoteDe([]), 'x', 'y')).toBeNull()
  })
  it('o resultado é sempre dois canais DIFERENTES e existentes, para qualquer entrada (todas as combinações)', () => {
    const entradas = [undefined, '', 'lixo', 'eu', 'ca', 'cb', 'cc', 'cd', '  ', '__proto__']
    for (const a of entradas) for (const b of entradas) {
      const r = resolverPar(mundo, a, b)!
      expect(r, `${a}/${b}`).not.toBeNull()
      expect(r.a).not.toBe(r.b)
      expect(mundo.ordem).toContain(r.a); expect(mundo.ordem).toContain(r.b)
    }
  })
})

/* ------------------------------------------------------------------------------------------------------------------ cores */
describe('cores dos lados', () => {
  it('o canal próprio é laranja no lado A e no lado B; o outro é azul; sem canal próprio, A areia e B azul; dois próprios → A laranja e B azul', () => {
    const p = pacoteDe([mk('eu', { own: true, subs: 10 }), mk('eu2', { own: true, subs: 9 }), mk('ca', { subs: 5 }), mk('cb', { subs: 4 })])
    expect(buildPar(p, 'eu', 'ca').cores).toEqual(['o', 'b'])
    expect(buildPar(p, 'ca', 'eu').cores).toEqual(['b', 'o'])
    expect(buildPar(p, 'ca', 'cb').cores).toEqual(['n', 'b'])
    expect(buildPar(p, 'eu', 'eu2').cores).toEqual(['o', 'b'])
    expect(buildPar(p, 'eu2', 'eu').cores).toEqual(['o', 'b'])
  })
  it('inverter os lados troca as cores junto com os canais', () => {
    const p = pacoteDe([mk('eu', { own: true, subs: 10 }), mk('ca', { subs: 5 })])
    const ab = buildPar(p, 'eu', 'ca'), ba = buildPar(p, 'ca', 'eu')
    expect(ab.a.id).toBe('eu'); expect(ba.b.id).toBe('eu')
    expect(ab.cores).toEqual([ba.cores[1], ba.cores[0]])
  })
})

/* ------------------------------------------------------------------------------------------------------------------ relação */
describe('relação', () => {
  it('diferença abaixo de 10% é "praticamente igual"; exatamente 10% já nomeia o maior', () => {
    const ig = (a: number, b: number) => rel('engajamento', a, b)
    expect(ig(100, 100)).toMatchObject({ tipo: 'igual', texto: 'praticamente igual' })
    expect(ig(100, 109)).toMatchObject({ tipo: 'igual' }); expect(ig(109, 100)).toMatchObject({ tipo: 'igual' })
    expect(ig(100, 109.99)).toMatchObject({ tipo: 'igual' }); expect(ig(109.99, 100)).toMatchObject({ tipo: 'igual' })
    expect(ig(100, 110)).toMatchObject({ tipo: 'maior', lado: 1, texto: 'Bb: +10% de engajamento' })
    expect(ig(110, 100)).toMatchObject({ tipo: 'maior', lado: 0, texto: 'Aa: +10% de engajamento' })
    // a borda exata com decimais que o ponto flutuante estraga (3,3 ÷ 3 dá 1,0999999999999999)
    expect(ig(3, 3.3)).toMatchObject({ tipo: 'maior', lado: 1 }); expect(ig(3.3, 3)).toMatchObject({ tipo: 'maior', lado: 0 })
    expect(ig(0.055, 0.0605)).toMatchObject({ tipo: 'maior', lado: 1 })
  })
  it('a classificação não depende de qual canal está de que lado: 90,5 contra 100 é a mesma coisa nos dois sentidos', () => {
    // com r = B÷A, 100→90,5 daria "igual" e 90,5→100 daria "+11%": o par trocado mudaria de classe. A conta é maior÷menor.
    const x = rel('engajamento', 100, 90.5), y = rel('engajamento', 90.5, 100)
    expect(x!.tipo).toBe(y!.tipo)
    expect(x).toMatchObject({ tipo: 'maior', lado: 0, texto: 'Aa: +10% de engajamento' }); expect(y).toMatchObject({ tipo: 'maior', lado: 1, texto: 'Bb: +10% de engajamento' })
  })
  it('"×" só a partir de 2× (1,99× vira "+99%"; 2,0× vira "2,0×"); a partir de 10× sem casa decimal', () => {
    expect((rel('longosAcomp', 100, 199) as { texto: string }).texto).toBe('Bb: +99% de longos acompanhados')
    expect((rel('longosAcomp', 100, 200) as { texto: string }).texto).toBe('Bb: 2,0× os longos acompanhados de Aa')
    expect((rel('longosAcomp', 10, 50) as { texto: string }).texto).toBe('Bb: 5,0× os longos acompanhados de Aa')
    expect((rel('longosAcomp', 10, 100) as { texto: string }).texto).toBe('Bb: 10× os longos acompanhados de Aa')
    expect((rel('longosAcomp', 10, 124) as { texto: string }).texto).toBe('Bb: 12× os longos acompanhados de Aa')
    expect(rel('longosAcomp', 100, 200.1)).toMatchObject({ tipo: 'maior' })
  })
  it('sempre nomeia o maior ("Você" para o canal próprio), sem sinal de menos, com o artigo e o possessivo da linha', () => {
    expect(rel('engajamento', 154, 100, { own: true })).toEqual({ tipo: 'maior', lado: 0, quem: 'Você', texto: 'Você: +54% de engajamento' })
    expect(rel('engajamento', 100, 154, {}, { own: true })).toEqual({ tipo: 'maior', lado: 1, quem: 'Você', texto: 'Você: +54% de engajamento' })
    expect(rel('longosAcomp', 4, 10, { own: true })).toMatchObject({ lado: 1, texto: 'Bb: 2,5× os seus longos acompanhados' })
    expect(rel('medianaViews', 10, 4, {}, { own: true })).toMatchObject({ lado: 0, texto: 'Aa: 2,5× a sua mediana de views dos longos' })
    expect(rel('vpd', 10, 4, {}, { own: true })).toMatchObject({ texto: 'Aa: 2,5× as suas views por dia nos longos' })
    expect(rel('ritmo', 10, 4, {}, { own: true })).toMatchObject({ texto: 'Aa: 2,5× o seu ritmo de publicação' })
    expect(rel('inscritos', 1000, 100)).toMatchObject({ lado: 0, texto: 'Aa: 10× os inscritos de Bb' })
    for (const id of NUMEROS) {
      const r = rel(id, 30, 100)
      if (r && r.tipo === 'maior') { expect(r.texto, id).not.toMatch(/−|-\d|menos/); expect(r.texto.startsWith(r.quem + ':')).toBe(true) }
    }
  })
  it('com os dois canais próprios, ninguém é "Você": a frase usa os nomes', () => {
    const r = rel('engajamento', 154, 100, { own: true }, { own: true })
    expect(r).toMatchObject({ tipo: 'maior', quem: 'Aa', texto: 'Aa: +54% de engajamento' })
    expect(rel('longosAcomp', 4, 10, { own: true }, { own: true })).toMatchObject({ texto: 'Bb: 2,5× os longos acompanhados de Aa' })
    expect(rel('longos90', 0, 5, { own: true }, { own: true })).toMatchObject({ tipo: 'zero', texto: 'Aa não publicou longos em 90 dias' })
  })
  it('zero em um lado: a frase de gente da linha; nas outras linhas "<quem> tem 0"; nunca razão', () => {
    expect(rel('longos90', 0, 5, { own: true })).toEqual({ tipo: 'zero', texto: 'você não publicou longos em 90 dias' })
    expect(rel('longos90', 5, 0, {}, { name: 'Leo Khev' })).toEqual({ tipo: 'zero', texto: 'Leo Khev não publicou longos em 90 dias' })
    expect(rel('ritmo', 0, 0.4, { own: true })).toEqual({ tipo: 'zero', texto: 'você não publicou em 13 semanas' })
    expect(rel('acima2x', 0, 3, { own: true })).toEqual({ tipo: 'zero', texto: 'você não tem vídeo acima de 2× em 90 dias' })
    expect(rel('acima2x', 3, 0, {}, { name: 'Leo Khev' })).toEqual({ tipo: 'zero', texto: 'Leo Khev não tem vídeo acima de 2× em 90 dias' })
    expect(rel('longosAcomp', 0, 5, { own: true })).toEqual({ tipo: 'zero', texto: 'Você tem 0' })
    expect(rel('engajamento', 12, 0, {}, { name: 'Leo Khev' })).toEqual({ tipo: 'zero', texto: 'Leo Khev tem 0' })
    for (const id of NUMEROS.filter(k => k !== 'diasUltimo')) { const r = rel(id, 0, 7); if (r) { expect(r.tipo, id).toBe('zero'); expect(JSON.stringify(r), id).not.toMatch(/Infinity|NaN|\d%|\d,\d×/) } }
  })
  it('a janela do ritmo é a da regra (não um "13" fixo)', () => {
    const p = pacoteDe([mk('aa', { n: { ritmo: 0 } }), mk('bb', { n: { ritmo: 1 } })], 8)
    expect(linha(buildPar(p, 'aa', 'bb'), 'ritmo').relacao).toEqual({ tipo: 'zero', texto: 'Aa não publicou em 8 semanas' })
  })
  it('zero nos dois: "nenhum dos dois publicou longos em 90 dias" / "… publicou em 13 semanas" / "… tem vídeo acima de 2× em 90 dias" / "os dois em 0"', () => {
    expect(rel('longos90', 0, 0)).toEqual({ tipo: 'igual', texto: 'nenhum dos dois publicou longos em 90 dias' })
    expect(rel('ritmo', 0, 0)).toEqual({ tipo: 'igual', texto: 'nenhum dos dois publicou em 13 semanas' })
    expect(rel('acima2x', 0, 0)).toEqual({ tipo: 'igual', texto: 'nenhum dos dois tem vídeo acima de 2× em 90 dias' })
    expect(rel('longosAcomp', 0, 0)).toEqual({ tipo: 'igual', texto: 'os dois em 0' })
    expect(rel('engajamento', 0, 0)).toEqual({ tipo: 'igual', texto: 'os dois em 0' })
  })
  it('um lado não medido: relacao null, eixo sem barra, e o lado traz o motivo', () => {
    for (const id of NUMEROS) {
      const v = duo(id, 5, null, {}, { motivos: { [id]: 'sem vídeos' } })
      const l = linha(v, id)
      expect(l.relacao, id).toBeNull()
      expect(l.lados[1].x, id).toBeNull(); expect(l.lados[1].motivo, id).toBe('sem vídeos'); expect(l.lados[0].x, id).toBe(5)
      if (l.eixo.tipo === 'barras') throw new Error(`${id}: barra com um lado não medido`)
      expect(l.pos[1], id).toBeNull()
    }
  })
  it('os dois não medidos: a linha não está em linhas e o nome dela está em fora; o rodapé conta e nomeia', () => {
    const v = buildPar(pacoteDe([mk('aa', { n: { inscritos: 10, longosAcomp: 3 } }), mk('bb', { n: { inscritos: 20, longosAcomp: 5 } })]), 'aa', 'bb')
    expect(v.linhas.map(l => l.id)).toEqual(['inscritos', 'longosAcomp'])
    expect(v.fora.length).toBe(11)
    expect(v.fora).toContain('Engajamento nos longos'); expect(v.fora).toContain('Trocas de título e thumbnail em 30 dias')
    for (const f of v.fora) expect(v.linhas.map(l => l.nome)).not.toContain(f)
    expect(v.rodape).toContain('11 números ficaram de fora')
    expect(v.rodape).toContain('engajamento nos longos')
    expect(v.status).toBe('Comparando Aa e Bb. 11 números sem dado em nenhum dos dois canais ficaram de fora.')
    const um = buildPar(pacoteDe([mk('aa', { n: Object.fromEntries(NUMEROS.slice(0, 12).map(k => [k, 5])) }), mk('bb', { n: Object.fromEntries(NUMEROS.slice(0, 12).map(k => [k, 5])) })]), 'aa', 'bb')
    expect(um.fora).toEqual(['Trocas de título e thumbnail em 30 dias'])
    expect(um.rodape).toContain('1 número ficou de fora'); expect(um.status).toBe('Comparando Aa e Bb. 1 número sem dado em nenhum dos dois canais ficou de fora.')
    const nada = buildPar(pacoteDe([mk('aa', { n: Object.fromEntries(NUMEROS.map(k => [k, 5])) }), mk('bb', { n: Object.fromEntries(NUMEROS.map(k => [k, 5])) })]), 'aa', 'bb')
    expect(nada.fora).toEqual([]); expect(nada.status).toBe('Comparando Aa e Bb.'); expect(nada.rodape).not.toMatch(/de fora/)
  })
  it('dias desde o último vídeo: frase "<quem> publicou mais recentemente: há N dias; <outro>, há M dias", sem barra; iguais: "Os dois publicaram há N dias"', () => {
    expect(rel('diasUltimo', 55, 666, {}, { own: true })).toEqual({ tipo: 'recente', lado: 0, quem: 'Aa', texto: 'Aa publicou mais recentemente: há 55 dias; você, há 666 dias' })
    expect(rel('diasUltimo', 666, 55, { own: true })).toEqual({ tipo: 'recente', lado: 1, quem: 'Bb', texto: 'Bb publicou mais recentemente: há 55 dias; você, há 666 dias' })
    expect(rel('diasUltimo', 30, 12, { own: true })).toMatchObject({ tipo: 'recente', lado: 1, quem: 'Bb', texto: 'Bb publicou mais recentemente: há 12 dias; você, há 30 dias' })
    expect(rel('diasUltimo', 12, 30, { own: true })).toMatchObject({ tipo: 'recente', lado: 0, quem: 'Você', texto: 'Você publicou mais recentemente: há 12 dias; Bb, há 30 dias' })
    expect(rel('diasUltimo', 0, 3)).toMatchObject({ texto: 'Aa publicou mais recentemente: hoje; Bb, há 3 dias' })
    expect(rel('diasUltimo', 1, 2)).toMatchObject({ texto: 'Aa publicou mais recentemente: há 1 dia; Bb, há 2 dias' })
    expect(rel('diasUltimo', 40, 40)).toEqual({ tipo: 'igual', texto: 'Os dois publicaram há 40 dias' })
    expect(rel('diasUltimo', 0, 0)).toEqual({ tipo: 'igual', texto: 'Os dois publicaram hoje' })
    expect(linha(duo('diasUltimo', 55, 666), 'diasUltimo').eixo).toEqual({ tipo: 'nenhum' })
    // a diferença pequena também diz quem publicou por último: aqui não há "praticamente igual" nem razão
    expect(rel('diasUltimo', 100, 105)).toMatchObject({ tipo: 'recente' })
  })
  it('inscritos em 30 dias: sem barra e sem relação', () => {
    const l = linha(duo('inscritos30', 0.05, 0.2), 'inscritos30')
    expect(l.relacao).toBeNull(); expect(l.eixo).toEqual({ tipo: 'nenhum' }); expect(l.pos).toEqual([null, null])
  })
  it('a linha de trocas tem relação (a lista conta outra coisa, a comparação diz o que conta na base)', () => {
    const l = linha(duo('trocas30', 2, 8), 'trocas30')
    expect(l.nome).toBe('Trocas de título e thumbnail em 30 dias')
    expect(l.relacao).toMatchObject({ tipo: 'maior', lado: 1, texto: 'Bb: 4,0× as trocas em 30 dias de Aa' })
    expect(l.base).toMatch(/descrição não conta/)
  })
})

/* ------------------------------------------------------------------------------------------------------------------ barras */
describe('barras', () => {
  const barras = (id: NumeroId, a: number | null, b: number | null) => linha(duo(id, a, b), id).eixo
  it('proporcionais ao maior dos dois', () => {
    expect(barras('engajamento', 5, 10)).toEqual({ tipo: 'barras', larguras: [0.5, 1], aviso: null })
    expect(barras('engajamento', 10, 2.5)).toEqual({ tipo: 'barras', larguras: [1, 0.25], aviso: null })
    expect(barras('engajamento', 7, 7)).toEqual({ tipo: 'barras', larguras: [1, 1], aviso: null })
  })
  it('a menor abaixo de 3% ganha a largura mínima e o aviso por escrito; exatamente 3% não', () => {
    expect(barras('engajamento', 1, 100)).toEqual({ tipo: 'barras', larguras: [0.03, 1], aviso: 'menos de 3% da barra do outro lado' })
    expect(barras('engajamento', 100, 2.9)).toMatchObject({ larguras: [1, 0.03], aviso: 'menos de 3% da barra do outro lado' })
    expect(barras('engajamento', 3, 100)).toEqual({ tipo: 'barras', larguras: [0.03, 1], aviso: null })
  })
  it('um lado em zero: a barra dele é zero (medido, vazio), sem aviso; os dois em zero: sem barra', () => {
    expect(barras('engajamento', 0, 8)).toEqual({ tipo: 'barras', larguras: [0, 1], aviso: null })
    expect(barras('engajamento', 0, 0)).toEqual({ tipo: 'nenhum' })
  })
  it('as linhas de barra são as cinco "só dos dois"; as seis do nicho têm régua; as duas de frase têm nada', () => {
    const v = buildPar(pacoteDe([mk('aa', { n: Object.fromEntries(NUMEROS.map(k => [k, 5])) }), mk('bb', { n: Object.fromEntries(NUMEROS.map(k => [k, 9])) })]), 'aa', 'bb')
    for (const l of v.linhas) {
      const esperado = NO_NICHO.has(l.id) ? 'regua' : l.id === 'diasUltimo' || l.id === 'inscritos30' ? 'nenhum' : 'barras'
      expect(l.eixo.tipo, l.id).toBe(esperado)
    }
    expect(v.linhas.filter(l => l.eixo.tipo === 'barras').map(l => l.id)).toEqual(['ritmo', 'engajamento', 'acima2x', 'duracao', 'trocas30'])
  })
})

/* ------------------------------------------------------------------------------------------------------------------ posição e conjunto */
describe('posição', () => {
  // viagem: v1..v4 (100, 200, 300, 400); tecnologia: t1, t2 (150, 350); sem nicho: s1 (250)
  const mundo = pacoteDe([
    mk('v1', { niche: 'viagem', subs: 100 }), mk('v2', { niche: 'viagem', subs: 200 }), mk('v3', { niche: 'viagem', subs: 300 }), mk('v4', { niche: 'viagem', subs: 400 }),
    mk('t1', { niche: 'tec', nicheLabel: 'Tecnologia', subs: 150 }), mk('t2', { niche: 'tec', nicheLabel: 'Tecnologia', subs: 350 }), mk('s1', { niche: null, subs: 250 }),
  ])
  it('mesmo nicho → "3º de 4 em Viagem" e a geral em geral; o conjunto é o nicho', () => {
    const v = buildPar(mundo, 'v2', 'v3')
    const l = linha(v, 'inscritos')
    expect(v.conjunto).toEqual({ tipo: 'nicho', niche: 'viagem', label: 'Viagem' })
    expect(l.pos[0]).toEqual({ texto: '3º de 4 em Viagem', geral: '5º de 7 no geral' })
    expect(l.pos[1]).toEqual({ texto: '2º de 4 em Viagem', geral: '3º de 7 no geral' })
  })
  it('nichos diferentes ou um sem nicho → só "no geral" e conjunto geral', () => {
    const dif = buildPar(mundo, 'v2', 't2')
    expect(dif.conjunto).toEqual({ tipo: 'geral' })
    expect(linha(dif, 'inscritos').pos).toEqual([{ texto: '5º de 7 no geral', geral: null }, { texto: '2º de 7 no geral', geral: null }])
    const sem = buildPar(mundo, 'v4', 's1')
    expect(sem.conjunto).toEqual({ tipo: 'geral' })
    expect(linha(sem, 'inscritos').pos).toEqual([{ texto: '1º de 7 no geral', geral: null }, { texto: '4º de 7 no geral', geral: null }])
    const dois = buildPar(pacoteDe([mk('x', { niche: null, subs: 1 }), mk('y', { niche: null, subs: 2 })]), 'x', 'y')
    expect(dois.conjunto).toEqual({ tipo: 'geral' }) // dois sem nicho não são "do mesmo nicho"
  })
  it('só as seis do nicho têm posição; as outras sete não', () => {
    const v = buildPar(pacoteDe([mk('aa', { n: Object.fromEntries(NUMEROS.map(k => [k, 5])) }), mk('bb', { n: Object.fromEntries(NUMEROS.map(k => [k, 9])) })]), 'aa', 'bb')
    for (const l of v.linhas) {
      if (NO_NICHO.has(l.id)) { expect(l.pos[0], l.id).not.toBeNull(); expect(l.pos[1], l.id).not.toBeNull() }
      else expect(l.pos, l.id).toEqual([null, null])
    }
    expect(v.linhas.filter(l => l.pos[0]).length).toBe(6)
  })
  it('empate dito; lado sem valor não tem posição e o "de N" não o conta', () => {
    const m = pacoteDe([
      mk('a1', { subs: 100 }), mk('a2', { subs: 100 }), mk('a3', { subs: 300 }), mk('a4', { subs: null }), mk('a5', { subs: 50 }),
    ])
    const v = buildPar(m, 'a1', 'a2')
    expect(linha(v, 'inscritos').pos[0]!.texto).toBe('2º de 4 em Viagem (empate)'); expect(linha(v, 'inscritos').pos[1]!.texto).toBe('2º de 4 em Viagem (empate)')
    expect(linha(v, 'inscritos').pos[0]!.geral).toBe('2º de 4 no geral (empate)')
    const w = buildPar(m, 'a4', 'a3') // A esconde os inscritos
    const l = linha(w, 'inscritos')
    expect(l.pos[0]).toBeNull(); expect(l.pos[1]).toEqual({ texto: '1º de 4 em Viagem', geral: '1º de 4 no geral' })
    expect(l.lados[0].x).toBeNull()
  })
  it('a posição é calculada sobre os valores do conjunto: quem não tem o número fica fora do "de N"', () => {
    const m = pacoteDe([mk('a1', { n: { longos90: 4 } }), mk('a2', { n: { longos90: 9 } }), mk('a3', { n: { longos90: null } }), mk('a4', { n: { longos90: 1 } })])
    const l = linha(buildPar(m, 'a1', 'a2'), 'longos90')
    expect(l.pos[0]!.texto).toBe('2º de 3 em Viagem'); expect(l.pos[1]!.texto).toBe('1º de 3 em Viagem')
  })
})

/* ------------------------------------------------------------------------------------------------------------------ cabeçalho, subtítulo, rodapé */
describe('título, subtítulo, status e rodapé', () => {
  it('título "Comparar: A e B"; subtítulo do mockup para o mesmo nicho, o de D4 (c) para nichos diferentes', () => {
    const m = pacoteDe([mk('aa', { name: 'Leo Khev', niche: 'viagem' }), mk('bb', { name: 'Dale Philip', niche: 'viagem' }), mk('cc', { name: 'Matt Wolfe', niche: 'tec', nicheLabel: 'Tecnologia' }), mk('dd', { name: 'Sem Nicho', niche: null })])
    const v = buildPar(m, 'aa', 'bb')
    expect(v.titulo).toBe('Comparar: Leo Khev e Dale Philip')
    expect(v.subtitulo).toBe('Dois canais de Viagem, lado a lado, com o mesmo peso.')
    expect(buildPar(m, 'aa', 'cc').subtitulo).toBe('Dois canais de nichos diferentes, lado a lado, com o mesmo peso. A régua e as posições comparam com todos os canais do site.')
    // um sem nicho: "de nichos diferentes" seria falso; a frase só diz o que vale
    expect(buildPar(m, 'aa', 'dd').subtitulo).toBe('Dois canais, lado a lado, com o mesmo peso. A régua e as posições comparam com todos os canais do site.')
    for (const t of [v.subtitulo, v.titulo]) expect(t).not.toMatch(/relações partem|lado A\./)
  })
  it('rodapé: "Maior não quer dizer melhor…", mais a contagem dos que ficaram de fora e o aviso do bloco de publicação', () => {
    const cheio = Object.fromEntries(NUMEROS.map(k => [k, 5]))
    const v = buildPar(pacoteDe([mk('aa', { n: cheio }), mk('bb', { n: cheio })]), 'aa', 'bb')
    expect(v.rodape).toBe('Maior não quer dizer melhor: são canais de tamanhos diferentes.')
    expect(v.publicacao).toBe(true)
    const sem = buildPar(pacoteDe([mk('aa', { n: cheio, comDatas: false }), mk('bb', { n: cheio, comDatas: false })]), 'aa', 'bb')
    expect(sem.publicacao).toBe(false)
    expect(sem.rodape).toBe('Maior não quer dizer melhor: são canais de tamanhos diferentes. O bloco de publicação não aparece: nenhum dos dois canais tem datas de publicação.')
    const um = buildPar(pacoteDe([mk('aa', { n: cheio, comDatas: false }), mk('bb', { n: cheio, comDatas: true })]), 'aa', 'bb')
    expect(um.publicacao).toBe(true); expect(um.rodape).not.toMatch(/publicação não aparece/)
  })
})

describe('o canal sem vídeos entra no par', () => {
  it('todas as linhas de vídeo "não medido · sem vídeos"; só inscritos comparável', () => {
    const w = a3World(ds => { ds.videos = ds.videos.filter(v => v.ch !== 'tnfigueiredo-en'); ds.channels.find(c => c.id === 'tnfigueiredo-en')!.undated = [] })
    const pack = buildCompararPack(w.obs)
    const v = buildPar(pack, 'tnfigueiredo-en', 'leo-khev')
    expect(v.a.semVideos).toBe(true)
    const doVideo: NumeroId[] = ['longosAcomp', 'longos90', 'ritmo', 'diasUltimo', 'medianaViews', 'vpd', 'vpdPorMil', 'engajamento', 'acima2x', 'duracao', 'trocas30']
    for (const id of doVideo) { const l = linha(v, id); expect(l.lados[0].x, id).toBeNull(); expect(l.lados[0].motivo, id).toBe('sem vídeos'); expect(l.relacao, id).toBeNull() }
    expect(linha(v, 'inscritos').relacao).not.toBeNull()
    expect(v.linhas.filter(l => l.relacao).map(l => l.id)).toEqual(['inscritos'])
    expect(v.publicacao).toBe(true) // o outro lado tem datas
    expect(v.fora).toEqual([]) // o outro lado tem tudo (menos o que o canal próprio sem vídeos não tem, que fica na linha)
  })
})

describe('roda no navegador: não importa o motor nem nada de servidor', () => {
  const dir = resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_comparar')
  /** Os módulos de que o par depende, seguidos até o fim (só os do próprio diretório e os puros de lib). */
  const PERMITIDOS = /^(\.\/(formatos|numeros-model|pack)|\.\.\/_canal\/numeros|\.\.\/_chrome\/principal|@\/lib\/youtube\/observatorio\/(posicao|time|proprio\/vpd)|\.\.\/_proprio\/extras)$/
  const importacoes = (arq: string) => {
    const src = readFileSync(resolve(dir, arq), 'utf8')
    return [...src.matchAll(/^import\s+(type\s+)?[^'"]*from\s+['"]([^'"]+)['"]/gm)].map(m => ({ tipo: !!m[1], de: m[2]! }))
  }
  it('par-model.ts e formatos.ts só importam o que é puro, e o pacote só como tipo', () => {
    for (const arq of ['par-model.ts', 'formatos.ts']) for (const i of importacoes(arq)) {
      expect(i.de, `${arq} importa ${i.de}`).toMatch(PERMITIDOS)
      if (i.de === './pack') expect(i.tipo, `${arq}: o pacote vem só como tipo (ele importa o Sentry)`).toBe(true)
    }
  })
  it('numeros-model.ts, de onde o par tira NUMEROS e NO_NICHO, também é puro (o motor só como tipo)', () => {
    for (const i of importacoes('numeros-model.ts')) {
      if (i.de === '@/lib/youtube/observatorio') expect(i.tipo, 'o motor só como tipo').toBe(true)
      else expect(i.de).toMatch(PERMITIDOS)
    }
  })
})

/* ------------------------------------------------------------------------------------------------------------------ fixture: 13 linhas e invariantes sobre TODOS os pares */
const BASE = a3World()
const BASE_PACK = buildCompararPack(BASE.obs)
const EXTREMO = (() => {
  const w = a3World(ds => {
    ds.videos = ds.videos.filter(v => v.ch !== 'paddy-doyle' && v.ch !== 'tnfigueiredo-en' && !(v.ch === 'matheus-fonseca' && v.fmt === 'long'))
    ds.channels.find(c => c.id === 'nomade-raiz')!.subs = null
    for (const v of ds.videos) if (v.ch === 'dale-philip') { v.series = []; v.firstIdx = null }
    ds.channels.find(c => c.id === 'tnfigueiredo-en')!.undated = []
    ds.channels.find(c => c.id === 'luke-damant')!.snapshots = []
    for (const v of ds.videos) if (v.ch === 'bald-and-bankrupt') v.views = 0
  })
  return buildCompararPack(w.obs)
})()
const MUNDOS: Array<[string, CompararPack]> = [['base', BASE_PACK], ['extremo', EXTREMO]]
/** Todos os pares ordenados (a ≠ b) de um pacote. */
const pares = (p: CompararPack) => p.ordem.flatMap(a => p.ordem.filter(b => b !== a).map(b => [a, b] as const))

describe('o par mais completo do fixture', () => {
  it('13 linhas no par mais completo do fixture, nos três grupos, na ordem do spec 18.4', () => {
    const v = buildPar(BASE_PACK, 'leo-khev', 'nate-herk')
    expect(v.linhas.length).toBe(13)
    expect(v.linhas.map(l => l.id)).toEqual([...NUMEROS])
    expect(v.linhas.map(l => l.grupo)).toEqual([
      'tamanho', 'tamanho', 'publicacao', 'publicacao', 'publicacao', 'publicacao', 'desempenho', 'desempenho', 'desempenho', 'desempenho', 'desempenho', 'desempenho', 'desempenho',
    ])
    expect(v.fora).toEqual([])
    for (const l of v.linhas) { expect(l.nome.length).toBeGreaterThan(0); expect(l.base.length).toBeGreaterThan(0) }
    expect(v.linhas.map(l => l.nome)).toEqual([
      'Inscritos', 'Inscritos em 30 dias', 'Longos acompanhados', 'Longos publicados em 90 dias', 'Longos + Shorts por semana', 'Dias desde o último vídeo', 'Mediana de views dos longos',
      'Views por dia nos longos', 'Views por dia por mil inscritos', 'Engajamento nos longos', 'Vídeos acima de 2× em 90 dias', 'Duração mediana dos longos', 'Trocas de título e thumbnail em 30 dias',
    ])
  })
  it('o par de dois concorrentes com tudo medido tem relação em doze linhas (inscritos em 30 dias não tem)', () => {
    const v = buildPar(BASE_PACK, 'leo-khev', 'nate-herk')
    expect(v.linhas.filter(l => !l.relacao).map(l => l.id)).toEqual(['inscritos30'])
  })
})

describe('invariantes sobre TODOS os pares (base e mundo extremo)', () => {
  const todos: Array<{ nome: string; v: ParView; p: CompararPack }> = []
  for (const [mundo, p] of MUNDOS) for (const [a, b] of pares(p)) todos.push({ nome: `${mundo}/${a}×${b}`, v: buildPar(p, a, b), p })
  it('há pares de verdade para olhar (todos os pares ordenados, nos dois mundos)', () => { const n = BASE_PACK.ordem.length; expect(n).toBeGreaterThan(12); expect(todos.length).toBe(2 * n * (n - 1)) })

  it('nenhuma frase de relação aparece quando um dos lados é nulo; relacao null é a regra, e vale para linhas sem relação', () => {
    let nulos = 0
    for (const { nome, v } of todos) for (const l of v.linhas) {
      const algumNulo = l.lados[0].x == null || l.lados[1].x == null
      if (algumNulo) { nulos++; expect(l.relacao, `${nome}/${l.id}`).toBeNull() }
      if (l.relacao) { expect(algumNulo).toBe(false); expect(l.id).not.toBe('inscritos30') }
    }
    expect(nulos).toBeGreaterThan(200)
  })
  it('linhas e fora: toda linha tem ao menos um lado medido, nenhuma linha some sem ir para fora, e fora é o que ficou sem os dois', () => {
    for (const { nome, v } of todos) {
      expect(v.linhas.length + v.fora.length, nome).toBe(13)
      for (const l of v.linhas) expect(l.lados[0].x != null || l.lados[1].x != null, `${nome}/${l.id}`).toBe(true)
      expect(v.status.includes(`${v.fora.length} ${v.fora.length === 1 ? 'número sem' : 'números sem'}`) || v.fora.length === 0, nome).toBe(true)
    }
  })
  it('trocar os lados (inverter) troca os nomes e nunca o sentido', () => {
    let maiores = 0
    for (const { nome, v, p } of todos) {
      const [a, b] = [v.a.id, v.b.id]
      if (a > b) continue // cada par uma vez
      const w = buildPar(p, b, a)
      // a cor segue o canal quando exatamente um é seu; com os dois seus ou nenhum, ela segue o lado (A laranja/areia, B azul)
      expect(w.cores).toEqual(v.a.own !== v.b.own ? [v.cores[1], v.cores[0]] : v.cores)
      expect(w.linhas.map(l => l.id), nome).toEqual(v.linhas.map(l => l.id))
      for (const l of v.linhas) {
        const m = linha(w, l.id)
        expect(m.lados, `${nome}/${l.id}`).toEqual([l.lados[1], l.lados[0]])
        expect(m.pos, `${nome}/${l.id}`).toEqual([l.pos[1], l.pos[0]])
        if (l.relacao == null) { expect(m.relacao).toBeNull(); continue }
        const r = l.relacao, s = m.relacao!
        expect(s.tipo, `${nome}/${l.id}`).toBe(r.tipo)
        expect(s.texto, `${nome}/${l.id}`).toBe(r.texto) // a frase nomeia o maior, de qualquer lado que ele esteja
        if (r.tipo === 'maior' || r.tipo === 'recente') {
          maiores++
          const t = s as typeof r
          expect(t.lado, `${nome}/${l.id}`).toBe(r.lado === 0 ? 1 : 0)
          expect(t.quem, `${nome}/${l.id}`).toBe(r.quem)
        }
        if (l.eixo.tipo === 'barras' && m.eixo.tipo === 'barras') expect(m.eixo.larguras).toEqual([l.eixo.larguras[1], l.eixo.larguras[0]])
      }
      // a Leitura rápida também troca de lado: o mesmo texto, no lado de lá (o item "sem como comparar" cita os lados na ordem em que estão)
      const flip = (i: ParView['leitura'][number]) => `${i.simbolo}|${i.lado == null ? '-' : 1 - i.lado}|${i.texto}`
      const sem = (l: ParView['leitura']) => l.filter(i => i.simbolo !== 'sem')
      expect(sem(w.leitura).map(i => `${i.simbolo}|${i.lado ?? '-'}|${i.texto}`).sort(), nome).toEqual(sem(v.leitura).map(flip).sort())
    }
    expect(maiores).toBeGreaterThan(400)
  })
  it('o nome na frase é o do lado que tem MAIS (ou o que publicou por último): o sentido bate com os números', () => {
    for (const { nome, v } of todos) for (const l of v.linhas) {
      const r = l.relacao
      if (!r || (r.tipo !== 'maior' && r.tipo !== 'recente')) continue
      const x = [l.lados[0].x!, l.lados[1].x!]
      if (r.tipo === 'maior') expect(x[r.lado], `${nome}/${l.id}`).toBeGreaterThan(x[r.lado === 0 ? 1 : 0]!)
      else expect(x[r.lado], `${nome}/${l.id}`).toBeLessThan(x[r.lado === 0 ? 1 : 0]!)
      const canal = r.lado === 0 ? v.a : v.b, outro = r.lado === 0 ? v.b : v.a
      expect(r.quem, `${nome}/${l.id}`).toBe(canal.own && !outro.own ? 'Você' : canal.name)
      expect(r.texto.startsWith(r.tipo === 'maior' ? `${r.quem}: ` : `${r.quem} publicou mais recentemente`), `${nome}/${l.id}`).toBe(true)
    }
  })
  it('a frase nunca diz "maior" e "menor" sobre o mesmo canal na mesma linha: nem diz "menor"', () => {
    for (const { nome, v } of todos) for (const l of v.linhas) if (l.relacao) {
      expect(l.relacao.texto, `${nome}/${l.id}`).not.toMatch(/menor|menos|−|abaixo|perde/i)
      const m = l.relacao.texto.match(/maior/gi) ?? []
      expect(m.length, `${nome}/${l.id}`).toBeLessThanOrEqual(1)
    }
  })
  it('nenhum texto contém "ganha", "vencedor", "perdedor", "melhor que", "Infinity", "NaN" ou palavra interna (todos os pares do fixture)', () => {
    for (const { nome, v } of todos) {
      const textos = [v.titulo, v.subtitulo, v.rodape, v.status, ...v.fora, ...v.leitura.map(i => i.texto)]
      for (const l of v.linhas) {
        textos.push(l.nome, l.base)
        if (l.relacao) textos.push(l.relacao.texto)
        for (const p of l.pos) if (p) textos.push(p.texto, ...(p.geral ? [p.geral] : []))
        if (l.eixo.tipo === 'barras' && l.eixo.aviso) textos.push(l.eixo.aviso)
        for (const n of l.lados) for (const t of [n.texto, n.motivo, n.nota]) if (t != null) textos.push(t)
      }
      for (const t of textos) {
        expect(t, nome).not.toMatch(PROIBIDAS)
        expect(t, nome).not.toMatch(PALAVRAS_INTERNAS)
        expect(t.trim().length, nome).toBeGreaterThan(0)
      }
    }
  })
  it('zero nunca vira razão: toda relação em que um lado vale 0 é "zero" ou "igual", nunca "maior"', () => {
    let zeros = 0
    for (const { nome, v } of todos) for (const l of v.linhas) {
      if (l.lados[0].x !== 0 && l.lados[1].x !== 0) continue
      if (l.lados[0].x == null || l.lados[1].x == null || l.id === 'inscritos30' || l.id === 'diasUltimo') continue
      zeros++
      expect(['zero', 'igual'], `${nome}/${l.id}`).toContain(l.relacao!.tipo)
    }
    expect(zeros).toBeGreaterThan(20)
  })
  it('as larguras das barras ficam entre 0 e 1, a maior vale 1 e nenhuma é NaN', () => {
    for (const { nome, v } of todos) for (const l of v.linhas) if (l.eixo.tipo === 'barras') {
      const [a, b] = l.eixo.larguras as [number, number]
      for (const w of [a, b]) { expect(Number.isFinite(w), `${nome}/${l.id}`).toBe(true); expect(w).toBeGreaterThanOrEqual(0); expect(w).toBeLessThanOrEqual(1) }
      expect(Math.max(a, b), `${nome}/${l.id}`).toBe(1)
    }
  })
  it('a posição "de N" nunca passa de quem tem valor, e só as seis do nicho têm', () => {
    for (const { nome, v, p } of todos) for (const l of v.linhas) {
      if (!NO_NICHO.has(l.id)) { expect(l.pos, `${nome}/${l.id}`).toEqual([null, null]); continue }
      const tem = p.canais.filter(c => c.numeros[l.id].x != null).length
      for (const [i, ps] of l.pos.entries()) {
        if (l.lados[i]!.x == null) { expect(ps, `${nome}/${l.id}`).toBeNull(); continue }
        const m = ps!.texto.match(/^(\d+)º de (\d+) /)!
        expect(Number(m[1]), `${nome}/${l.id}`).toBeGreaterThanOrEqual(1)
        expect(Number(m[1]), `${nome}/${l.id}`).toBeLessThanOrEqual(Number(m[2]))
        expect(Number(m[2]), `${nome}/${l.id}`).toBeLessThanOrEqual(tem)
      }
    }
  })
  it('o conjunto bate com os nichos dos dois lados', () => {
    for (const { nome, v } of todos) {
      const mesmo = v.a.niche != null && v.a.niche === v.b.niche
      expect(v.conjunto.tipo, nome).toBe(mesmo ? 'nicho' : 'geral')
      for (const l of v.linhas) for (const ps of l.pos) if (ps) {
        if (mesmo) { expect(ps.texto, nome).toContain(` em ${v.a.nicheLabel}`); expect(ps.geral, nome).toMatch(/ no geral/) }
        else { expect(ps.texto, nome).toMatch(/ no geral/); expect(ps.geral, nome).toBeNull() }
      }
    }
  })
  it('resolverPar sobre os pacotes de verdade devolve um par que o buildPar aceita', () => {
    for (const [, p] of MUNDOS) {
      const r = resolverPar(p, undefined, undefined)!
      expect(r).not.toBeNull()
      expect(() => buildPar(p, r.a, r.b)).not.toThrow()
      expect(BASE_PACK.canais.find(c => c.id === r.a)!.own).toBe(true) // o padrão do fixture: o canal próprio no lado A
    }
  })
})

/* ------------------------------------------------------------------------------------------------------------------ conserto: relação coerente com o número escrito */
describe('relação coerente com o número ESCRITO (I-T6-1)', () => {
  const pTxt = (id: NumeroId, a: [number, string], b: [number, string]) => linha(duo(id, a, b), id)
  it('0,26 e 0,34 views por dia, ambos escritos "0,3": praticamente igual, posição empatada, e a Leitura os põe entre os iguais', () => {
    const l = pTxt('vpd', [0.26, '0,3'], [0.34, '0,3'])
    expect(l.relacao).toEqual({ tipo: 'igual', texto: 'praticamente igual' })
    expect(l.pos[0]!.texto).toMatch(/\(empate\)/); expect(l.pos[1]!.texto).toMatch(/\(empate\)/)
    const v = duo('vpd', [0.26, '0,3'], [0.34, '0,3'])
    expect(v.leitura.some(i => i.simbolo === 'igual' && i.texto.includes('views por dia'))).toBe(true)
    expect(v.leitura.some(i => i.simbolo === 'maior')).toBe(false)
  })
  it('os dois "menos de 0,1" (0,01 e 0,04): praticamente igual, nunca "4,0×"', () => {
    const l = pTxt('vpdPorMil', [0.01, 'menos de 0,1'], [0.04, 'menos de 0,1'])
    expect(l.relacao).toEqual({ tipo: 'igual', texto: 'praticamente igual' })
  })
  it('textos diferentes continuam comparados pelo valor: 0,26 ("0,3") contra 0,34 ("0,34") é maior', () => {
    expect(pTxt('vpd', [0.26, '0,3'], [0.34, '0,34']).relacao?.tipo).toBe('maior')
  })
  it('vale em todas as linhas com relação: dois valores bem diferentes escritos igual dão "igual" (ou o zero de gente, nunca a razão)', () => {
    for (const id of NUMEROS) {
      const l = linha(duo(id, [1, 'x'], [50, 'x']), id)
      if (id === 'inscritos30') { expect(l.relacao).toBeNull(); continue }
      expect(l.relacao?.tipo, id).toBe(id === 'diasUltimo' ? 'recente' : 'igual')
    }
  })
  it('invariante sobre TODOS os pares dos dois mundos: texto igual nos dois lados ⇒ relação "igual"; nunca duas células iguais com uma diferença ao lado', () => {
    let iguais = 0
    for (const [mundo, p] of MUNDOS) for (const [a, b] of pares(p)) for (const l of buildPar(p, a, b).linhas) {
      const [na, nb] = l.lados
      if (na.texto == null || nb.texto == null || na.texto !== nb.texto || !l.relacao) continue
      iguais++
      expect(l.relacao.tipo, `${mundo}/${a}×${b}/${l.id}: ${l.relacao.texto}`).toBe('igual')
    }
    expect(iguais).toBeGreaterThan(0)
  })
  it('invariante sobre um mundo com faixas pequenas: pares de canais de mentira com textos iguais e valores diferentes', () => {
    const textos = ['0', '0,3', 'menos de 0,1', '1,2', '10']
    const valores = [0.01, 0.04, 0.26, 0.34, 1.2, 1.24, 9.97, 10.04]
    for (const t of textos) for (const xa of valores) for (const xb of valores) {
      const l = pTxt('vpd', [xa, t], [xb, t])
      if (xa === 0 || xb === 0) continue
      expect(l.relacao?.tipo, `${t}: ${xa}/${xb}`).toBe('igual')
    }
  })
})

describe('"+100%" nunca aparece abaixo de 2× (o percentual e o limiar de "×" concordam)', () => {
  it('quanto(): 1,996 vira "2,0×"; 1,99 continua "+99%"; de 1,1 a 3 em passos de 0,0001 nunca sai "+100%" nem "+N%" com N >= 100', () => {
    expect(quanto(1.996)).toBe('2,0×'); expect(quanto(1.999999)).toBe('2,0×'); expect(quanto(1.99)).toBe('+99%'); expect(quanto(1.994)).toBe('+99%')
    for (let q = 1.1; q < 3; q += 0.0001) {
      const t = quanto(q)
      expect(t, String(q)).not.toMatch(/^\+(\d{3,}|100)%$/)
      if (q >= 2) expect(t, String(q)).toMatch(/×$/)
    }
  })
  it('a relação com razão 1,996: "2,0× …" com a forma do ×, nunca "+100% de …"', () => {
    const r = rel('engajamento', 100, 199.6)!
    expect(r.texto).toMatch(/2,0× /); expect(r.texto).not.toMatch(/\+100%/)
    expect(rel('engajamento', 100, 199)!.texto).toMatch(/\+99% de engajamento/)
  })
  it('a Leitura rápida também: nunca "+100%"', () => {
    const v = duo('vpd', 100, 199.6)
    expect(v.leitura.map(i => i.texto).join(' ')).not.toMatch(/\+100%/)
    expect(v.leitura.map(i => i.texto).join(' ')).toMatch(/2,0×/)
  })
  it('invariante sobre todos os pares: nenhum texto de relação ou da Leitura tem "+100%" ou mais', () => {
    for (const [mundo, p] of MUNDOS) for (const [a, b] of pares(p)) {
      const v = buildPar(p, a, b)
      for (const t of [...v.linhas.flatMap(l => (l.relacao ? [l.relacao.texto] : [])), ...v.leitura.map(i => i.texto)]) expect(t, `${mundo}/${a}×${b}`).not.toMatch(/\+(100|[1-9]\d{2,})%/)
    }
  })
})

describe('o mesmo canal dos dois lados é recusado', () => {
  it('buildPar(x, x) lança em vez de comparar o canal com ele mesmo', () => {
    expect(() => buildPar(BASE_PACK, 'leo-khev', 'leo-khev')).toThrow(/mesmo canal/)
    expect(() => buildPar(BASE_PACK, 'tnfigueiredo', 'tnfigueiredo')).toThrow(/mesmo canal/)
  })
  it('resolverPar nunca devolve a === b (a e b iguais, só um dado, ou o mesmo dos dois lados na URL)', () => {
    for (const [, p] of MUNDOS) {
      for (const id of p.ordem) { const r = resolverPar(p, id, id); expect(r).not.toBeNull(); expect(r!.a).not.toBe(r!.b) }
    }
  })
})

describe('relação ausente com os dois lados medidos: só onde a regra manda, nunca calada', () => {
  it('em todos os pares dos dois mundos, linha com os dois lados medidos tem relação, exceto inscritos em 30 dias (o valor não finito ou negativo não chega ao par: o modelo dos números o recusa)', () => {
    let vistas = 0
    for (const [mundo, p] of MUNDOS) for (const [a, b] of pares(p)) for (const l of buildPar(p, a, b).linhas) {
      if (l.lados[0].x == null || l.lados[1].x == null) continue
      vistas++
      if (l.id === 'inscritos30') { expect(l.relacao).toBeNull(); continue }
      expect(l.relacao, `${mundo}/${a}×${b}/${l.id}`).not.toBeNull()
      for (const x of [l.lados[0].x, l.lados[1].x]) { expect(Number.isFinite(x)).toBe(true); expect(x).toBeGreaterThanOrEqual(0) }
    }
    expect(vistas).toBeGreaterThan(1000)
  })
  it('os 12 números que não são inscritos em 30 dias nunca saem negativos do modelo dos números, em todos os canais dos dois mundos', () => {
    for (const [mundo, p] of MUNDOS) for (const c of p.canais) for (const k of NUMEROS) {
      if (k === 'inscritos30') continue
      const x = c.numeros[k].x
      if (x != null) expect(x, `${mundo}/${c.id}/${k}`).toBeGreaterThanOrEqual(0)
    }
  })
})
