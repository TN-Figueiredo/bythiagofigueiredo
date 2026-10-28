// @vitest-environment node
import { describe, expect, it } from 'vitest'
import semente from '../../../../data/lugares/semente-v2.json'
import { normalizarLugar } from '../../../../src/lib/youtube/observatorio/lugar/normalizar'
import {
  entradaHash,
  extrairLugares,
  montarIndice,
  paisesPadraoPorCanal,
  LUGAR_REGRA_VERSAO,
  type EntradaDeLugar,
} from '../../../../src/lib/youtube/observatorio/lugar/casar'
import { paresPadrao } from '../../../../src/lib/youtube/observatorio/lugar/coordenada'

const linhas = semente.lugares.flatMap((l) =>
  l.aliases.map((a) => ({
    alias_norm: normalizarLugar(a.alias),
    slug: l.slug,
    ambiguo: a.ambiguo,
    pais_iso2: l.pais_iso2,
  })),
)
const ind = montarIndice(linhas, semente.versao)

function ex(
  titulo: string,
  o: Partial<Omit<EntradaDeLugar, 'titulo'>> = {},
): ReturnType<typeof extrairLugares> {
  return extrairLugares(
    { titulo, tags: [], descricaoInicio: '', locationDescription: null, coordenadaPadraoDoCanal: false, ...o },
    ind,
  )
}

describe('normalizarLugar', () => {
  it.each([
    ['Phú Quốc', 'phu quoc'],
    ['Đảo Phú Quốc', 'dao phu quoc'],
    ['Łódź', 'lodz'],
    ['İstanbul', 'istanbul'],
    ['Tromsø', 'tromso'],
    ['Straße', 'strasse'],
    ["Côte d'Ivoire", 'cote d ivoire'],
    ['  a,,b  ', 'a b'],
  ])('%s -> %s', (e, s) => expect(normalizarLugar(e)).toBe(s))
})

describe('semente-v2', () => {
  it('sem alias normalizado repetido entre slugs; todo local tem o pais', () => {
    const dono = new Map<string, string>()
    for (const l of linhas) {
      expect(dono.get(l.alias_norm) ?? l.slug).toBe(l.slug)
      dono.set(l.alias_norm, l.slug)
    }
    const paises = new Set(semente.lugares.filter((l) => l.nivel === 'pais').map((l) => l.slug))
    for (const l of semente.lugares.filter((x) => x.nivel === 'local')) {
      expect(paises.has(`pais:${l.pais_iso2}`)).toBe(true)
    }
  })
  it('tamanho e ambíguos', () => {
    expect(semente.lugares.filter((l) => l.nivel === 'pais').length).toBeGreaterThanOrEqual(220)
    expect(semente.lugares.filter((l) => l.nivel === 'local').length).toBeGreaterThanOrEqual(100)
    const amb = new Set(linhas.filter((l) => l.ambiguo).map((l) => l.alias_norm))
    const obrigatorios = [
      'natal', 'porto', 'lima', 'cuba', 'salvador', 'belem', 'vitoria', 'georgia', 'jordan', 'chad', 'turkey',
      'peru', 'reuniao', 'reunion', 'ira', 'oma', 'male', 'jersey', 'guinea', 'bermuda', 'bermudas',
      'malta', 'granada', 'formosa', 'dominica', 'gana', 'eau',
    ]
    for (const a of obrigatorios) expect(amb.has(a), a).toBe(true)
    expect(ind.porAlias.has('rio')).toBe(false)
    expect(ind.porAlias.get('machu picchu')?.slug).toBe('local:pe-cusco')
    expect(ind.porAlias.get('turquia')).toEqual({ slug: 'pais:TR', ambiguo: false, pais: 'TR' })
    expect(ind.porAlias.get('turkiye')?.ambiguo).toBe(false)
  })
})

describe('extrairLugares', () => {
  it.each(['Phú Quốc', 'Phu Quoc', 'Đảo Phú Quốc', 'Ilha de Phu Quoc'])('%s', (t) => {
    expect(ex(t).chaves).toEqual(['local:vn-phu-quoc', 'pais:VN'])
  })
  it.each([
    ['Vietnã', ['pais:VN']],
    ['Vietnam', ['pais:VN']],
    ['Hồ Chí Minh', ['local:vn-ho-chi-minh', 'pais:VN']],
    ['Łódź', ['local:pl-lodz', 'pais:PL']],
    ['İstanbul', ['local:tr-istanbul', 'pais:TR']],
    ['Tromsø', ['local:no-tromso', 'pais:NO']],
    ['Turquia', ['pais:TR']],
    ['Georgia', []],
    ['Natal', []],
    ['Turkey', []],
  ])('%s', (t, esperado) => expect(ex(t).chaves).toEqual(esperado))

  it('Turkey + Istanbul na descrição', () => {
    expect(ex('Turkey', { descricaoInicio: 'Conheça Istanbul' }).chaves).toEqual([
      'pais:TR',
      'local:tr-istanbul',
    ])
    expect(ex('Turkey', { descricaoInicio: 'Conheça Istanbul' }).chaves).toContain('pais:TR')
  })
  it('ordem e teto de 3 países', () => {
    expect(ex('Tailândia, Vietnã e Camboja em 15 dias').chaves).toEqual(['pais:TH', 'pais:VN', 'pais:KH'])
    expect(ex('Tailândia, Vietnã, Camboja e Laos').chaves).toEqual(['pais:TH', 'pais:VN', 'pais:KH'])
  })
  it('tags antes de descrição (sem chave no título; v2 b: com chave no título, tag/descrição não acrescentam país)', () => {
    // v2 a': sem chave no título, dois países entre tag e descrição = lista genérica, não assunto
    expect(ex('Minha viagem', { tags: ['Argentina'], descricaoInicio: 'Chile' }).chaves).toEqual([])
    expect(ex('Minha viagem', { tags: ['Argentina'], descricaoInicio: 'Argentina' }).chaves).toEqual(['pais:AR'])
    expect(ex('Japão', { tags: ['Argentina'], descricaoInicio: 'Chile' }).chaves).toEqual(['pais:JP'])
  })
  it('ambíguo em pt com preposição; em inglês não', () => {
    expect(ex('Viagem em Natal').chaves).toEqual(['local:br-natal', 'pais:BR'])
    expect(ex('Fomos a Cuba no verão').chaves).toEqual([])
    expect(ex('Estive em Cuba').chaves).toEqual(['pais:CU'])
    expect(ex('Trip to Georgia').chaves).toEqual([])
    expect(ex('Trip in Turkey').chaves).toEqual([])
  })
  it('ambíguo com outro alias do mesmo país em tags ou descrição', () => {
    expect(ex('Natal', { tags: ['Brasil'] }).chaves).toEqual(['local:br-natal', 'pais:BR'])
    expect(ex('Natal', { descricaoInicio: 'Rio Grande, Brasil' }).chaves).toContain('local:br-natal')
    expect(ex('Natal', { tags: ['Portugal'] }).chaves).toEqual(['pais:PT'])
    expect(ex('Georgia', { tags: ['Georgia'] }).chaves).toEqual([])
  })
  it('locationDescription: conta se não for a padrão do canal', () => {
    const base = { locationDescription: 'Brasil' }
    expect(ex('Natal', { ...base, coordenadaPadraoDoCanal: false })).toEqual({
      chaves: ['local:br-natal', 'pais:BR'],
      fonte: 'texto+coordenada',
    })
    expect(ex('Natal', { ...base, coordenadaPadraoDoCanal: true }).chaves).toEqual([])
    expect(ex('Passeio', { locationDescription: 'Phu Quoc', coordenadaPadraoDoCanal: true }).chaves).toEqual([])
    expect(ex('Passeio', { locationDescription: 'Phu Quoc' }).chaves).toEqual(['local:vn-phu-quoc', 'pais:VN'])
    expect(ex('Vietnã').fonte).toBe('texto')
  })
  it.each([
    'Trip to Georgia',
    'Porto seguro de vida',
    'Natal em família',
    'Chad reage',
    'Lima limão receita',
    'Salvador Dalí documentário',
    'Jordan Peterson entrevista',
    'Cuba Gooding Jr melhores filmes',
    'Vitória do time ontem',
    'Belém do Pará culinária',
    'Turkey sandwich recipe',
    'Chad e Brad jogam',
    'Natal de luz',
    'Porto Alegre',
    'Lima e limão',
    'Georgia on my mind',
    'Jordan vs Lebron',
    'Turkey day dinner',
    'Salvador Sobral canta',
    'Receita de ceia de Natal',
    'Peru assado de Natal',
    'Reunião de família',
    'Ira de Deus',
    'no Natal com a família',
    'Vitória do time na final',
    'Malta de amigos',
    'Granada de mão',
    'Rio de lágrimas',
    'Passei no Porto',
    'Fui na Vitória',
  ])('negativo: %s', (t) => {
    expect(ex(t).chaves).toEqual([])
  })
})

describe('paresPadrao', () => {
  it('10 vídeos na mesma coordenada formam par; 4 não', () => {
    const v = (canal: string, lat: number, lng: number) => ({ canal, lat, lng })
    const vids = [
      ...Array.from({ length: 10 }, () => v('c1', -23.55, -46.63)),
      ...Array.from({ length: 4 }, () => v('c2', 10.01, 20.02)),
      { canal: 'c3', lat: null, lng: null },
    ]
    const p = paresPadrao(vids)
    expect(p.has('c1|-23.6|-46.6')).toBe(true)
    expect([...p].some((k) => k.startsWith('c2'))).toBe(false)
    expect(p.size).toBe(1)
  })
})

describe('entradaHash', () => {
  const e: EntradaDeLugar = {
    titulo: 'Phu Quoc', tags: ['a'], descricaoInicio: 'x', locationDescription: null, coordenadaPadraoDoCanal: false,
  }
  it('estável e sensível à versão', () => {
    expect(entradaHash(e, 1)).toBe(entradaHash({ ...e }, 1))
    expect(entradaHash(e, 1)).toMatch(/^[0-9a-f]{64}$/)
    expect(entradaHash(e, 2)).not.toBe(entradaHash(e, 1))
  })
})

describe('entradaHash: bandeira e versão da regra (Phil I-2, I-3)', () => {
  const base: EntradaDeLugar = { titulo: 'X', tags: [], descricaoInicio: '', locationDescription: null, coordenadaPadraoDoCanal: false }
  it('bandeira entra no hash', () => {
    const h = (t: string) => entradaHash({ ...base, titulo: t }, 2)
    expect(h('X 🇻🇳')).not.toBe(h('X 🇹🇭'))
    expect(h('X')).not.toBe(h('X 🇻🇳'))
  })
  it('a versão da regra de lugar muda o hash', () => {
    expect(LUGAR_REGRA_VERSAO).toBe(2)
    const h2 = entradaHash(base, 2)
    // o hash carrega `r`: o mesmo texto com outra versão de regra seria outro hash (provado pelo JSON do hash)
    expect(h2).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('regra v2 (T6b)', () => {
  const pais = (r: ReturnType<typeof extrairLugares>): string[] => r.chaves.filter((c) => c.startsWith('pais:'))

  describe('c: bandeira emoji', () => {
    it.each([
      ['Entrei no MERCADO mais BIZARRO da Amazônia 🇵🇪', 'pais:PE'],
      ['🇮🇹 Eu errei pra você acertar: pedágio de €3 virou multa de €80!', 'pais:IT'],
      ['🇨🇳 DESCOBRIMOS COMO FUNCIONA A VIDA REAL NO INTERIOR', 'pais:CN'],
      ['Trying Afghanistan’s National Dish 🇦🇫', 'pais:AF'],
    ])('%s', (t, esperado) => expect(pais(ex(t))).toEqual([esperado]))

    it('bandeira de país fora da semente não vira chave', () => {
      expect(ex('Olá 🇧🇻').chaves).toEqual([])
    })
  })

  describe('a: padrão do canal no texto', () => {
    const tags = ['Vietnam', 'Thailand', 'Philippines']
    it('país de tag que é padrão do canal não conta sozinho', () => {
      const t = 'This Southeast Asia Retirement Loophole Blew My Mind!'
      expect(ex(t, { tags: ['Thailand'] }).chaves.length).toBeGreaterThan(0)
      expect(ex(t, { tags: ['Thailand'], paisesPadraoDoCanal: ['VN', 'TH', 'PH'] }).chaves).toEqual([])
    })
    it('mas conta quando o título também o traz', () => {
      expect(pais(ex('Comida de rua no Vietnã', { tags, paisesPadraoDoCanal: ['VN', 'TH', 'PH'] }))).toEqual(['pais:VN'])
    })
    it('paisesPadraoPorCanal: >= 50% dos vídeos, mínimo de 4 vídeos, só tag/descrição', () => {
      const v = (canal: string, tags: string[]) => ({ canal, tags, descricaoInicio: '' })
      const r = paisesPadraoPorCanal(
        [
          v('a', ['Thailand']), v('a', ['Thailand']), v('a', ['x']), v('a', ['y']),
          v('b', ['Thailand']), v('b', ['Thailand']), v('b', ['Thailand']),
          v('c', ['Thailand']), v('c', ['x']), v('c', ['y']), v('c', ['z']),
        ],
        ind,
      )
      expect(r.get('a')).toEqual(['TH'])
      expect(r.has('b')).toBe(false)
      expect(r.has('c')).toBe(false)
    })
  })

  describe('I-1: base recente com texto + regra a\'', () => {
    const v = (canal: string, tags: string[], publicadoEm: string) => ({ canal, tags, descricaoInicio: '', publicadoEm })
    it('40 antigos sem tag e 10 recentes com Thailand resulta em TH', () => {
      const velhos = Array.from({ length: 40 }, (_, i) => v('k', [], `2020-01-${String((i % 28) + 1).padStart(2, '0')}`))
      const novos = Array.from({ length: 10 }, (_, i) => v('k', ['Thailand'], `2026-10-${String(i + 1).padStart(2, '0')}`))
      expect(paisesPadraoPorCanal([...velhos, ...novos], ind).get('k')).toEqual(['TH'])
    })
    it('antigos COM tag de outro assunto fora da janela de 30 não diluem', () => {
      const velhos = Array.from({ length: 40 }, (_, i) => v('k', ['cooking'], `2020-01-${String((i % 28) + 1).padStart(2, '0')}`))
      const novos = Array.from({ length: 30 }, (_, i) => v('k', ['Thailand'], `2026-09-${String((i % 28) + 1).padStart(2, '0')}`))
      expect(paisesPadraoPorCanal([...velhos, ...novos], ind).get('k')).toEqual(['TH'])
    })
    it('4 vídeos, 2 sem texto: não forma padrão', () => {
      const r = paisesPadraoPorCanal(
        [v('k', ['Thailand'], '2026-10-01'), v('k', ['Thailand'], '2026-10-02'), v('k', [], '2026-10-03'), v('k', [], '2026-10-04')],
        ind,
      )
      expect(r.has('k')).toBe(false)
    })
    it('título sem chave e 3 países nas tags, sem padrão: []', () => {
      expect(ex('Isso mudou minha vida', { tags: ['Vietnam', 'Thailand', 'Philippines'] }).chaves).toEqual([])
    })
    it('título sem chave e um país nas tags: pais:JP', () => {
      expect(pais(ex('Fluffiest Egg Sandwich', { tags: ['Japan'] }))).toEqual(['pais:JP'])
    })
    it('próprios: 4 com "Brasil" na descrição e títulos sem lugar resultam em []', () => {
      const d = { titulo: 'Meu dia', tags: [], descricaoInicio: 'Canal do Brasil. Inscreva-se', locationDescription: null, coordenadaPadraoDoCanal: false }
      const padrao = paisesPadraoPorCanal(Array.from({ length: 4 }, () => ({ canal: 'proprio', tags: [], descricaoInicio: d.descricaoInicio })), ind).get('proprio') ?? []
      expect(padrao).toEqual(['BR'])
      expect(extrairLugares({ ...d, paisesPadraoDoCanal: padrao }, ind).chaves).toEqual([])
    })
  })

  describe('b: prioridade do título', () => {
    it('com chave no título, tag/descrição não acrescentam país novo', () => {
      const r = ex('Vietnamese Oil Shower Chicken 🇻🇳🍗', { tags: ['Thailand'], descricaoInicio: 'Filmed near Bangkok, Thailand and Cambodia' })
      expect(pais(r)).toEqual(['pais:VN'])
    })
    it('mesmo país em tag continua valendo; sem chave no título, tag/descrição seguem valendo', () => {
      expect(ex('Japan’s Fluffiest Egg Sandwich 🇯🇵🥪', { tags: ['Osaka'] }).chaves).toContain('local:jp-osaka')
      expect(pais(ex('Fluffiest Egg Sandwich', { tags: ['Japan'] }))).toEqual(['pais:JP'])
    })
  })

  describe('d: semente v2', () => {
    it.each([
      ['A CIDADE CHINESA DO LUXO, DINHEIRO, FAMA E OSTENTAÇÃO (Chengdu)', 'local:cn-chengdu', 'pais:CN'],
      ['EXPLORANDO UBUD E CONHECENDO GENTE PELO CAMINHO...', 'local:id-ubud', 'pais:ID'],
      ['The Transformers are having a short vacation in Jomtien!#jomtien #pattaya', 'local:th-jomtien', 'pais:TH'],
      ['Seria essa a melhor capital do Nordeste? #joaopessoa #jampa #dicasdeviagem', 'local:br-joao-pessoa', 'pais:BR'],
      ['A menor capital da Europa #malta  #europa #viagem #shorts', 'pais:MT', 'pais:MT'],
    ])('%s', (t, a, b) => {
      const r = ex(t)
      expect(r.chaves).toContain(a)
      expect(r.chaves).toContain(b)
    })
    it('"malta" sozinho continua ambíguo', () => {
      expect(ex('A malta toda junta').chaves).toEqual([])
    })
  })
})

describe('extrairLugaresDetalhado', () => {
  it('mesmo resultado de extrairLugares e origem por chave (título, tags, bandeira)', async () => {
    const { extrairLugares, extrairLugaresDetalhado } = await import('../../../../src/lib/youtube/observatorio/lugar/casar')
    const base = { tags: [], descricaoInicio: '', locationDescription: null, coordenadaPadraoDoCanal: false }
    for (const e of [{ ...base, titulo: 'Viagem ao Japão' }, { ...base, titulo: 'Tokyo', tags: ['japão'] }, { ...base, titulo: 'dia 🇯🇵' }, { ...base, titulo: 'Natal em família' }]) {
      const d = extrairLugaresDetalhado(e, ind)
      expect({ chaves: d.chaves, fonte: d.fonte }).toEqual(extrairLugares(e, ind))
      expect(Object.keys(d.origens).sort()).toEqual([...d.chaves].sort())
    }
    expect(extrairLugaresDetalhado({ ...base, titulo: 'dia 🇯🇵' }, ind).origens['pais:JP']).toBe('bandeira')
    expect(extrairLugaresDetalhado({ ...base, titulo: 'Viagem ao Japão' }, ind).origens['pais:JP']).toBe('titulo')
  })
})
