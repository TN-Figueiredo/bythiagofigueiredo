// @vitest-environment node
// A5 F1a (T5): o gerador de CSV. Cada teste tem um mutante na nota do relatório (a5/f1a-relatorio.md).
import { describe, expect, it } from 'vitest'
import { blocoDaTabela, campoCsv, csvDaTabela, novaLegenda, numeroCsv, PIZZA_PERMITIDA, FRASE_DO_GRAFICO } from '@/lib/youtube/observatorio/contexto-ia/tabela-csv'
import { FIM_DE_LINHA } from '@/lib/youtube/observatorio/contexto-ia/terceiros'
import type { Celula, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'

/** Parser RFC 4180 mínimo (campos com aspas, aspas dobradas, quebra dentro de campo). */
function parse(csv: string): string[][] {
  const linhas: string[][] = []
  let campo = ''; let linha: string[] = []; let aspas = false
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i]!
    if (aspas) {
      if (ch === '"') { if (csv[i + 1] === '"') { campo += '"'; i++ } else aspas = false } else campo += ch
    } else if (ch === '"') aspas = true
    else if (ch === ',') { linha.push(campo); campo = '' }
    else if (ch === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = '' }
    else campo += ch
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha) }
  return linhas
}

const num = (x: number | null, texto = 'n'): Celula => ({ papel: 'numero', estado: 'medido', texto, x, origem: 'o' })
const zero = (): Celula => ({ papel: 'numero', estado: 'zero_medido', texto: '0', x: 0, origem: 'o' })
const nm = (motivo = 'ainda não há leitura de views deste canal'): Celula => ({ papel: 'numero', estado: 'nao_medido', motivo, origem: 'o' })
const falhou = (motivo = 'a leitura do canal falhou'): Celula => ({ papel: 'numero', estado: 'falhou', motivo, origem: 'o' })
const restrito = (motivo = 'sem permissão'): Celula => ({ papel: 'numero', estado: 'restrito', motivo, origem: 'o' })
const rot = (texto: string): Celula => ({ papel: 'rotulo', texto, origem: 'o' })
const ter = (texto: string): Celula => ({ papel: 'terceiros', texto, origem: 'o' })

const tabela = (extra: Partial<Tabela> = {}): Tabela => ({
  id: 't', titulo: 'Canais', colunas: ['Canal', 'Inscritos', 'Crescimento (%)'], chaves: ['canal', 'inscritos', 'crescimento_pct'],
  linhas: [[rot('Ana'), num(15230), num(12.3)]], tipo: 'lista', nomeNoCorte: 'Canais', privada: false, ...extra,
})

describe('campoCsv (a): escape', () => {
  const casos: Array<[string, string]> = [
    ['a,b', 'a,b'], ['diz "oi"', 'diz "oi"'], ['linha1\nlinha2', 'linha1 linha2'], ['x y', 'x y'],
    ['=HYPERLINK("x")', '\'=HYPERLINK("x")'], ['+1', "'+1"], ['-2', "'-2"], ['@a', "'@a"], ['\tabc', "'\tabc"],
    ['```fim```', "'''fim'''"], ['a\u000bb', 'a b'], ['a\u000cb', 'a b'], ['a\u001eb', 'a b'],
    ['a\u000bb\u000cc\nd', 'a b c d'], [' =1+1', "' =1+1"], ['\n=x', "' =x"], ['\u202eabc', 'abc'], ['a\u0007b', 'ab'], ['', ''], [' ao redor ', ' ao redor '],
  ]
  for (const [entrada, esperado] of casos) {
    it(`${JSON.stringify(entrada)} relido pelo parser dá ${JSON.stringify(esperado)}`, () => {
      const linhas = parse(`${campoCsv(entrada)}\n`)
      expect(linhas).toHaveLength(1)
      expect(linhas[0]).toEqual([esperado])
    })
  }
  it('nenhuma quebra de linha (nem as do splitlines) sobra no campo, nenhum ``` , nenhum bidi', () => {
    const c = campoCsv('a\u000bb\u000cc\nd\u0085e\u2028f\u2029g\r\nh``` ` \u202ai\u2066j')
    expect(/[\r\n\u0085\u000b\u000c\u001c-\u001e\u2028\u2029]/.test(c)).toBe(false)
    expect(c.includes('```')).toBe(false)
    expect(/[\u202a-\u202e\u2066-\u2069]/.test(c)).toBe(false)
  })
  it('usa a fonte única de fim de linha (a mesma de terceiros.ts)', () => {
    for (const ch of ['\u000b', '\u000c', '\u001c', '\u001d', '\u001e', '\u0085', '\u2028', '\u2029', '\r']) {
      expect(FIM_DE_LINHA.test(ch)).toBe(true)
      expect(campoCsv(`a${ch}b`)).toBe('a b')
    }
  })
})

describe('numeroCsv (d)', () => {
  it('bordas (M3)', () => {
    expect(() => numeroCsv(1e-21)).toThrow()
    expect(numeroCsv(123456789012.5)).toBe('123456789012.5')
  })
  it('formatos', () => {
    expect(numeroCsv(15230)).toBe('15230')
    expect(numeroCsv(12.3)).toBe('12.3')
    expect(numeroCsv(0.1 + 0.2)).toBe('0.3')
    expect(numeroCsv(-4.5)).toBe('-4.5')
    expect(numeroCsv(0.00004)).toBe('0.00004')
    expect(numeroCsv(-0)).toBe('0')
    expect(numeroCsv(1e21)).toBe('1000000000000000000000')
    expect(numeroCsv(12.345678)).toBe('12.3457')
    expect(numeroCsv(1.2345678e-9)).toBe('0.00000000123457')
    expect(numeroCsv(1234567.891)).toBe('1234567.891')
    expect(numeroCsv(100)).toBe('100')
  })
  it('NaN e infinitos lançam', () => {
    expect(() => numeroCsv(NaN)).toThrow()
    expect(() => numeroCsv(Infinity)).toThrow()
    expect(() => numeroCsv(-Infinity)).toThrow()
  })
})

describe('csvDaTabela (b): estados', () => {
  it('nao_medido, falhou e restrito saem vazios com a chave e o id em motivos; zero_medido sai 0; medido com x:0 sai 0', () => {
    const t = tabela({ linhas: [[rot('A'), nm(), falhou()], [rot('B'), restrito(), zero()], [rot('C'), num(0, '0%'), num(5)]] })
    const L = novaLegenda()
    const c = csvDaTabela(t, L)!
    const l = c.linhas.map((x) => parse(`${x}\n`)[0]!)
    expect(c.cabecalho).toBe('canal,inscritos,crescimento_pct,motivos')
    expect(l[0]).toEqual(['A', '', '', 'inscritos:m1; crescimento_pct:m2'])
    expect(l[1]).toEqual(['B', '', '0', 'inscritos:m3'])
    expect(l[2]).toEqual(['C', '0', '5', ''])
    expect(L.linhas()).toEqual([
      'Motivos (célula vazia não é zero; os ids valem só nesta resposta):',
      '- m1 (nao_medido): ainda não há leitura de views deste canal',
      '- m2 (falhou): a leitura do canal falhou',
      '- m3 (restrito): sem permissão',
    ])
    expect(c.semX).toBe(0)
  })
  it('medido com x nulo (dado ausente): vazio, semX 1, motivo "número sem valor de máquina" como falhou', () => {
    const L = novaLegenda()
    const c = csvDaTabela(tabela({ linhas: [[rot('A'), num(null, '15 mil'), num(1)]] }), L)!
    expect(parse(`${c.linhas[0]}\n`)[0]).toEqual(['A', '', '1', 'inscritos:m1'])
    expect(c.semX).toBe(1)
    expect(L.linhas()[1]).toBe('- m1 (falhou): número sem valor de máquina')
  })
  it('zero_medido com x nulo e x não finito também contam como semX (nunca viram 0)', () => {
    const z: Celula = { papel: 'numero', estado: 'zero_medido', texto: '0', x: null, origem: 'o' }
    const c = csvDaTabela(tabela({ linhas: [[rot('A'), z, num(NaN)]] }), novaLegenda())!
    expect(parse(`${c.linhas[0]}\n`)[0]!.slice(1, 3)).toEqual(['', ''])
    expect(c.semX).toBe(2)
  })
  it('célula com semXMotivo: vazia, semX 0, motivo próprio', () => {
    const s: Celula = { papel: 'numero', estado: 'medido', texto: 'sem variação', semXMotivo: 'dentro do arredondamento do YouTube (±100 inscritos)', origem: 'o' }
    const L = novaLegenda()
    const c = csvDaTabela(tabela({ linhas: [[rot('A'), num(1), s]] }), L)!
    expect(parse(`${c.linhas[0]}\n`)[0]).toEqual(['A', '1', '', 'crescimento_pct:m1'])
    expect(c.semX).toBe(0)
    expect(L.linhas()[1]).toBe('- m1 (nao_medido): dentro do arredondamento do YouTube (±100 inscritos)')
  })
  it('célula de texto passa por campoCsv (terceiros com vírgula, fórmula e quebra)', () => {
    const c = csvDaTabela(tabela({ linhas: [[ter('=SOMA(A1)\nx,y'), num(1), num(2)]] }), novaLegenda())!
    expect(parse(`${c.linhas[0]}\n`)[0]![0]).toBe("'=SOMA(A1) x,y")
  })
})

describe('csvDaTabela (c): nenhum 0 nasce de ausência', () => {
  it('200 tabelas sorteadas com semente fixa', () => {
    let s = 12345
    const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
    for (let n = 0; n < 200; n++) {
      const linhas: Celula[][] = []
      const esperadoZero: boolean[][] = []
      for (let r = 0; r < 5; r++) {
        const cs: Celula[] = []; const ez: boolean[] = []
        for (let k = 0; k < 3; k++) {
          const q = Math.floor(rnd() * 9)
          const c = [num(rnd() * 100), zero(), num(0, '0%'), nm(), falhou(), restrito(), num(null), num(Math.round(rnd() * 5)), { papel: 'numero', estado: 'medido', texto: 'sem variação', semXMotivo: 'arred', origem: 'o' } as Celula][q]!
          cs.push(c)
          ez.push(c.papel === 'numero' && (c.estado === 'zero_medido' || (c.estado === 'medido' && c.x === 0)))
        }
        linhas.push(cs); esperadoZero.push(ez)
      }
      const t = tabela({ colunas: ['a', 'b', 'c'], chaves: ['a', 'b', 'c'], linhas })
      const c = csvDaTabela(t, novaLegenda())!
      c.linhas.forEach((ln, r) => {
        const cel = parse(`${ln}\n`)[0]!
        for (let k = 0; k < 3; k++) if (cel[k] === '0') expect(esperadoZero[r]![k], `tabela ${n} linha ${r} col ${k}`).toBe(true)
      })
    }
  })
})

describe('legenda (e)', () => {
  it('mesmo motivo em 50 linhas = um id; dois estados com a mesma frase = dois ids', () => {
    const L = novaLegenda()
    const linhas = Array.from({ length: 50 }, () => [rot('A'), nm('x'), num(1)])
    csvDaTabela(tabela({ linhas }), L)
    expect(L.linhas()).toHaveLength(2)
    expect(L.idDe('nao_medido', 'x')).toBe('m1')
    expect(L.idDe('falhou', 'x')).toBe('m2')
    expect(L.linhas()).toHaveLength(3)
  })
  it('sem motivo nenhum a legenda não escreve nada', () => { expect(novaLegenda().linhas()).toEqual([]) })
  it('os ids são compartilhados entre tabelas da mesma resposta', () => {
    const L = novaLegenda()
    csvDaTabela(tabela(), L)
    const a = csvDaTabela(tabela({ linhas: [[rot('A'), nm('y'), num(1)]] }), L)!
    const b = csvDaTabela(tabela({ linhas: [[rot('A'), nm('y'), num(1)]] }), L)!
    expect(a.linhas[0]).toBe(b.linhas[0])
  })
})

describe('gráfico sugerido (f)', () => {
  it('pizza fora da lista vira barra e avisa', () => {
    const c = csvDaTabela(tabela({ grafico: 'pizza' }), novaLegenda())!
    expect(c.grafico).toBe('barra'); expect(c.avisos).toEqual(['pizza_nao_fecha'])
  })
  it('pizza da lista com todas as partes medidas fica pizza; com uma parte nao_medido vira barra e avisa', () => {
    const mut = PIZZA_PERMITIDA as Set<string>
    mut.add('pz')
    try {
      const ok = csvDaTabela(tabela({ id: 'pz', grafico: 'pizza' }), novaLegenda())!
      expect(ok.grafico).toBe('pizza'); expect(ok.avisos).toEqual([])
      expect(ok.dicionario).toContain('Gráfico sugerido: pizza (as partes somam o todo da tela; toda parte foi medida nesta resposta)')
      const ruim = csvDaTabela(tabela({ id: 'pz', grafico: 'pizza', linhas: [[rot('A'), nm(), num(1)], [rot('B'), num(2), num(1)]] }), novaLegenda())!
      expect(ruim.grafico).toBe('barra'); expect(ruim.avisos).toEqual(['pizza_nao_fecha'])
      const semX = csvDaTabela(tabela({ id: 'pz', grafico: 'pizza', linhas: [[rot('A'), num(null), num(1)]] }), novaLegenda())!
      expect(semX.grafico).toBe('barra')
    } finally { mut.delete('pz') }
  })
  it('a lista branca de produção tem só os dois ids provados em acesso-ia-tabela.test.ts (11)', () => { expect([...PIZZA_PERMITIDA].sort()).toEqual(['canais-resumo-direcao', 'grupos']) })
  it('pizza com uma linha sem a célula numérica das outras (grupo de base fraca) vira barra e avisa', () => {
    const mut = PIZZA_PERMITIDA as Set<string>
    mut.add('pz2')
    try {
      const c = csvDaTabela(tabela({ id: 'pz2', grafico: 'pizza', colunas: ['Canal', 'Canais'], chaves: ['canal', 'canais'], linhas: [[rot('A'), num(3)], [rot('B'), rot('base fraca')]] }), novaLegenda())!
      expect(c.grafico).toBe('barra'); expect(c.avisos).toEqual(['pizza_nao_fecha'])
    } finally { mut.delete('pz2') }
  })
  it('padrões: dia_a_dia vira linha; lista com número vira barra; lista sem coluna numérica vira nenhum; fixa vira nenhum; declarado vale', () => {
    expect(csvDaTabela(tabela({ tipo: 'dia_a_dia' }), novaLegenda())!.grafico).toBe('linha')
    expect(csvDaTabela(tabela(), novaLegenda())!.grafico).toBe('barra')
    expect(csvDaTabela(tabela({ colunas: ['a'], chaves: ['a'], linhas: [[rot('x')], [rot('y')]] }), novaLegenda())!.grafico).toBe('nenhum')
    expect(csvDaTabela(tabela({ tipo: 'fixa' }), novaLegenda())!.grafico).toBe('nenhum')
    expect(csvDaTabela(tabela({ tipo: 'fixa', grafico: 'barra' }), novaLegenda())!.grafico).toBe('barra')
  })
  it('a frase de cada gráfico vem do dicionário e está no bloco', () => {
    const c = csvDaTabela(tabela({ tipo: 'dia_a_dia' }), novaLegenda())!
    expect(c.dicionario.split('\n').at(-1)).toBe(`Gráfico sugerido: ${FRASE_DO_GRAFICO.linha}`)
  })
})

describe('coluna motivos única', () => {
  it('sem motivos em chaves: acrescenta ao fim, só refs; cabeçalho sem nome repetido', () => {
    const c = csvDaTabela(tabela({ linhas: [[rot('A'), nm(), num(1)]] }), novaLegenda())!
    const h = c.cabecalho.split(',')
    expect(new Set(h).size).toBe(h.length)
    expect(h.at(-1)).toBe('motivos')
    expect(c.dicionario).toContain('- motivos:')
  })
  it('com motivos em chaves: usa a coluna, junta refs + texto da A4 sem sobrescrever nem duplicar', () => {
    const t = tabela({ colunas: ['Canal', 'Inscritos', 'Motivos'], chaves: ['canal', 'inscritos', 'motivos'], linhas: [[rot('A'), nm(), rot('só 3 vídeos')], [rot('B'), num(1), rot('')], [rot('C'), nm(), rot('')]] })
    const c = csvDaTabela(t, novaLegenda())!
    const h = c.cabecalho.split(',')
    expect(h).toEqual(['canal', 'inscritos', 'motivos'])
    const l = c.linhas.map((x) => parse(`${x}\n`)[0]!)
    expect(l[0]).toEqual(['A', '', 'inscritos:m1; só 3 vídeos'])
    expect(l[1]).toEqual(['B', '1', '']) // ambos vazios = campo vazio
    expect(l[2]).toEqual(['C', '', 'inscritos:m1'])
    expect(c.dicionario.split('\n').filter((x) => x.startsWith('- motivos:'))).toHaveLength(1)
  })
})

describe('tabela sem chaves ou torta (h)', () => {
  it('sem chaves devolve null', () => { expect(csvDaTabela(tabela({ chaves: undefined }), novaLegenda())).toBeNull() })
  it('chaves que não casam com colunas, chave repetida e linha de largura errada devolvem null (nunca desalinha em silêncio)', () => {
    expect(csvDaTabela(tabela({ chaves: ['a', 'b'] }), novaLegenda())).toBeNull()
    expect(csvDaTabela(tabela({ chaves: ['a', 'a', 'b'] }), novaLegenda())).toBeNull()
    expect(csvDaTabela(tabela({ linhas: [[rot('A'), num(1)]] }), novaLegenda())).toBeNull()
  })
})

describe('cabeçalho sem nome repetido (I1)', () => {
  it('motivos fora do fim ou extra com nome de chave devolve null', () => {
    expect(csvDaTabela(tabela({ chaves: ['canal', 'motivos', 'x'] }), novaLegenda())).toBeNull()
    expect(csvDaTabela(tabela(), novaLegenda(), [{ chave: 'canal', titulo: 'x', valor: () => 'a' }])).toBeNull()
    expect(csvDaTabela(tabela(), novaLegenda(), [{ chave: 'motivos', titulo: 'x', valor: () => 'a' }])).toBeNull()
  })
})

describe('prosa do bloco (M1, M5)', () => {
  it('título, coluna e extra com quebra e crases não abrem cerca nem cabeçalho falso', () => {
    const c = csvDaTabela(tabela({ titulo: 'T\n```\n## x', colunas: ['Canal', 'A\nB', 'C```'] }), novaLegenda(), [{ chave: 'e', titulo: 'E\n## y', valor: () => 'v' }])!
    const b = blocoDaTabela(c, c.linhas)
    expect(b.split('```').length - 1).toBe(2)
    expect(b.split('\n').filter((l) => l.startsWith('## '))).toHaveLength(1)
  })
  it('legenda é prosa: vírgula sem aspas', () => {
    const l = novaLegenda(); l.idDe('nao_medido', 'a, b')
    expect(l.linhas()[1]).toBe('- m1 (nao_medido): a, b')
  })
})

describe('colunas extras (D7)', () => {
  it('vêm primeiro, no cabeçalho, no dicionário e em cada linha; valor nulo vira vazio', () => {
    const c = csvDaTabela(tabela({ linhas: [[rot('A'), num(1), num(2)], [rot('B'), num(3), num(4)]] }), novaLegenda(), [{ chave: 'canal_id', titulo: 'Id do canal', valor: (i) => (i === 0 ? 'uuid-0' : null) }])!
    expect(c.cabecalho).toBe('canal_id,canal,inscritos,crescimento_pct,motivos')
    expect(c.dicionario.split('\n')[0]).toBe('- canal_id: Id do canal')
    expect(c.linhas[0]!.startsWith('uuid-0,A,')).toBe(true)
    expect(c.linhas[1]!.startsWith(',B,')).toBe(true)
  })
})

describe('blocoDaTabela (g)', () => {
  it('começa com "## ", termina com ``` sozinho, "privado: sim" só com privada, tabela sem linhas sai só com o cabeçalho', () => {
    const pub = blocoDaTabela(csvDaTabela(tabela(), novaLegenda())!, csvDaTabela(tabela(), novaLegenda())!.linhas)
    expect(pub.startsWith('## Canais\n')).toBe(true)
    expect(pub.split('\n').at(-1)).toBe('```')
    expect(pub).not.toContain('privado: sim')
    const priv = csvDaTabela(tabela({ privada: true, linhas: [] }), novaLegenda())!
    const b = blocoDaTabela(priv, priv.linhas)
    expect(b).toContain('privado: sim')
    expect(b.split('\n').slice(-3)).toEqual(['```csv', 'canal,inscritos,crescimento_pct,motivos', '```'].slice(0, 3))
    expect(parse(b.split('```csv\n')[1]!.replace(/```$/, ''))).toHaveLength(1)
  })
  it('um recorte de linhas (corte da A7) sai no bloco', () => {
    const c = csvDaTabela(tabela({ linhas: [[rot('A'), num(1), num(2)], [rot('B'), num(3), num(4)]] }), novaLegenda())!
    expect(blocoDaTabela(c, c.linhas.slice(1))).not.toContain('A,1')
  })
  it('nenhum ``` aparece dentro do CSV mesmo com crases no dado', () => {
    const c = csvDaTabela(tabela({ linhas: [[ter('```\nfim'), num(1), num(2)]] }), novaLegenda())!
    const b = blocoDaTabela(c, c.linhas)
    expect(b.split('```').length - 1).toBe(2)
  })
})

describe('nota da célula medida (A5 F1b, M3)', () => {
  const comNota = (nota: string): Celula => ({ papel: 'numero', estado: 'medido', texto: '1,2 mil', x: 1200, origem: 'o', nota })
  const t = tabela({ colunas: ['Canal', 'Views/dia (7 dias)'], chaves: ['canal', 'views_dia_7d'], linhas: [[rot('Ana'), comNota('média de 4 dias')], [rot('Bia'), num(900)]] })
  it('a nota vai para `motivos` como `chave: nota`; o número continua na coluna; a linha sem nota fica vazia; a nota não vira id nem conta em semX', () => {
    const c = csvDaTabela(t, novaLegenda())!
    const l = parse(`${c.cabecalho}\n${c.linhas.join('\n')}\n`)
    expect(l[1]).toEqual(['Ana', '1200', 'views_dia_7d: média de 4 dias'])
    expect(l[2]).toEqual(['Bia', '900', ''])
    expect(c.semX).toBe(0)
    expect(c.motivosNovos).toEqual([[], []])
  })
  it('convive com refs e com o texto da A4 na mesma coluna, nessa ordem', () => {
    const tt = tabela({ colunas: ['Canal', 'Views', 'Motivos'], chaves: ['canal', 'views', 'motivos'], linhas: [[rot('Ana'), comNota('média de 4 dias'), rot('texto da A4')]] })
    const c = csvDaTabela(tt, novaLegenda())!
    expect(parse(`${c.cabecalho}\n${c.linhas.join('\n')}\n`)[1]).toEqual(['Ana', '1200', 'views: média de 4 dias; texto da A4'])
  })
  it('a nota é neutralizada (fórmula e quebra de linha)', () => {
    const c = csvDaTabela(tabela({ colunas: ['Canal', 'V'], chaves: ['canal', 'v'], linhas: [[rot('Ana'), comNota('=1+1\noutra')]] }), novaLegenda())!
    expect(parse(`${c.cabecalho}\n${c.linhas.join('\n')}\n`)[1]![2]).toBe("v: =1+1 outra")
  })
})
