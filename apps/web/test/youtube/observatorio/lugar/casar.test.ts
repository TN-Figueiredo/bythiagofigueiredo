// @vitest-environment node
import { describe, expect, it } from 'vitest'
import semente from '../../../../data/lugares/semente-v1.json'
import { normalizarLugar } from '../../../../src/lib/youtube/observatorio/lugar/normalizar'
import {
  entradaHash,
  extrairLugares,
  montarIndice,
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

describe('semente-v1', () => {
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
    const amb = [...new Set(linhas.filter((l) => l.ambiguo).map((l) => l.alias_norm))].sort()
    expect(amb).toEqual(
      ['natal', 'porto', 'lima', 'cuba', 'salvador', 'belem', 'vitoria', 'georgia', 'jordan', 'chad', 'turkey'].sort(),
    )
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
  it('título antes de tags antes de descrição', () => {
    const r = ex('Japão', { tags: ['Peru'], descricaoInicio: 'Chile' })
    expect(r.chaves).toEqual(['pais:JP', 'pais:PE', 'pais:CL'])
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
