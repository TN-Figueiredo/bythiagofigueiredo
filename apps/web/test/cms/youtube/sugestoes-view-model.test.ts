import { describe, expect, it, vi } from 'vitest'

const regra = vi.hoisted(() => ({ mult: 5 }))
vi.mock('@/lib/youtube/observatorio/sinais/regra', async (orig) => {
  const o = await orig<typeof import('@/lib/youtube/observatorio/sinais/regra')>()
  return { ...o, REGRA_SINAIS: new Proxy(o.REGRA_SINAIS, { get: (t, k) => (k === 'multSozinho' ? regra.mult : (t as Record<string | symbol, unknown>)[k]) }) }
})

import { filtrarVista, montarVistaDaLista, resumoDaLista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/view-model'
import type { ItemDeSinal, ListaDeSinais } from '@/lib/youtube/observatorio/sinais/leitura'
import type { AmostraDoVideo } from '@/lib/youtube/observatorio/sinais/amostra'

const AGORA = new Date('2026-10-23T15:00:00-03:00')
type Out = ItemDeSinal['evidence']['outliers'][number]
const out = (video_id: string, mult: number): Out => ({ video_id, canal_id: 'c', published_at: '2026-10-20T00:00:00Z', mult_vpd7: mult, mult_tela: mult, vpd7: 100, formato: 'long' })

function item(id: string, o: Partial<ItemDeSinal> & { outliers?: Out[] } = {}): ItemDeSinal {
  const outliers = o.outliers ?? [out('v-' + id, 8.4)]
  const { outliers: _x, ...resto } = o
  void _x
  return {
    id, kind: 'destino', subject_key: 'pais:vn', acao: 'titulo_descricao', rotulo_acao: 'abrir-seus', n_proprios: 2, acao_gravada: 'titulo_descricao', forca: 1,
    motivo: 'm', rule_version: 'sinais-v1+semente-1', first_seen_at: '2026-10-18T10:00:00Z', expires_at: '2026-11-17T10:00:00Z',
    proprios_agora: ['p1', 'p2'], proprios_agora_n: 2,
    evidence: { outliers, outliers_total: outliers.length, canais: 2, proprios: [] },
    ...resto,
  }
}
function lista(itens: ItemDeSinal[], o: Partial<ListaDeSinais> = {}): ListaDeSinais {
  return { n: itens.length, itens, computado_em: '2026-10-23T10:02:00Z', desatualizado: false, motivoVazio: null, contagens: {}, calculoLigado: true, ...o }
}
const am = (titulo: string, o: Partial<AmostraDoVideo> = {}): AmostraDoVideo => ({ titulo, miniatura: 'https://x/y.jpg', origem: 'competidor', canal: 'Canal', chaves: null, ...o })
const montar = (l: ListaDeSinais, amostra: Map<string, AmostraDoVideo> = new Map(), o: Partial<Parameters<typeof montarVistaDaLista>[0]> = {}) =>
  montarVistaDaLista({ lista: l, amostra, agora: AGORA, filtro: 'todas', saiuDoAviso: false, limite: 100, ...o })

const tres = () => [
  item('s1', { subject_key: 'pais:vn', rotulo_acao: 'abrir-concorrente', n_proprios: 0, acao: 'video_novo', proprios_agora: [], proprios_agora_n: 0, outliers: [out('o1', 8.4), out('o1b', 6.1), out('o1c', 5.3)] }),
  item('s2', { subject_key: 'pais:jp', outliers: [out('o2', 6.1)] }),
  item('s3', { kind: 'parecido', subject_key: 'outlier:o3', outliers: [out('o3', 5.2)], expires_at: '2026-10-25T15:00:00-03:00' }),
]

describe('lista de 3', () => {
  const v = montar(lista(tres()), new Map([['o1', am('48 horas em Hanói', { canal: 'Mochila Barata' })]]))
  it('3 linhas, só a 1ª cheia, 1ª sem vídeo seu', () => {
    expect(v.linhas).toHaveLength(3)
    expect(v.linhas.map((l) => l.primario.cheio)).toEqual([true, false, false])
    expect(v.linhas[0]!.primario.texto).toBe('Abrir o vídeo do concorrente')
    expect(v.linhas[0]!.seus.texto).toMatch(/Nenhum vídeo seu cita Vietnã/)
    expect(v.linhas[1]!.primario.texto).toBe('Abrir seus 2 vídeos sobre Japão')
  })
  it('chips, título e Puxado por (outlier mais forte)', () => {
    expect(v.linhas[0]!.chip).toEqual({ rotulo: 'Destino esquentou', simbolo: 'alfinete' })
    expect(v.linhas[2]!.chip).toEqual({ rotulo: 'Concorrente bombou', simbolo: 'chama' })
    expect(v.linhas[0]!.titulo).toBe('3 vídeos sobre Vietnã, de 2 canais, passaram do normal nos últimos 14 dias')
    expect(v.linhas[1]!.titulo).toBe('Um vídeo sobre Japão passou de 5× o normal do canal')
    expect(v.linhas[0]!.puxadoPor).toEqual({ titulo: '48 horas em Hanói', canal: 'Mochila Barata', miniatura: 'https://x/y.jpg' })
    expect(v.linhas[1]!.puxadoPor).toBeNull()
  })
  it('régua, venceEm e info', () => {
    expect(v.linhas[0]!.regua).toEqual({ valor: 8.4, acimaDe20: false, limiar: 5, texto: '8,4× o normal do canal, o mais alto de 3' })
    expect(v.linhas[0]!.venceEm).toBeNull()
    expect(v.linhas[2]!.venceEm).toBe('vence em 2 dias')
    expect(v.linhas[0]!.info.mults).toBe('8,4×, 6,1× e 5,3×')
    expect(v.linhas[0]!.info.surgiu).toBe('18/10')
    expect(v.linhas[0]!.info.vence).toBe('17/11')
    expect(v.linhas[0]!.info.regra).toContain('5×')
  })
  it('motivos por kind, Já fiz em feito', () => {
    expect(v.linhas[0]!.motivos).toEqual([
      { valor: 'lugar_errado', rotulo: 'Lugar errado', grupo: 'motivo' },
      { valor: 'nao_interessa', rotulo: 'Não me interessa', grupo: 'motivo' },
      { valor: 'ja_fiz', rotulo: 'Já fiz', grupo: 'feito' },
    ])
    expect(v.linhas[2]!.motivos[0]).toEqual({ valor: 'nao_e_parecido', rotulo: 'Não é parecido', grupo: 'motivo' })
  })
  it('cabeçalho', () => {
    expect(v.n).toBe(3)
    expect(v.calculado).toBe('Calculado hoje às 07:02')
    expect(v.resumo).toBe('3 sugestões: 2 destinos (Vietnã e Japão), 1 concorrente.')
    expect(v.filtro).toBeNull()
    expect(v.vazio).toBeNull()
    expect(v.faixa).toBeNull()
    expect(v.totalAlemDoLimite).toBeNull()
  })
  it('href do primário', () => {
    expect(v.linhas[0]!.primario.href).toBe('/cms/youtube/competitors/video/o1')
    expect(v.linhas[1]!.primario.href).toBe('/cms/youtube/videos?ids=p1,p2&total=2')
  })
})

describe('régua e limiar', () => {
  it('48,3 -> acimaDe20, sem miniatura', () => {
    const v = montar(lista([item('a', { outliers: [out('o', 48.3)] })]), new Map([['o', am('T', { miniatura: null })]]))
    expect(v.linhas[0]!.regua!.acimaDe20).toBe(true)
    expect(v.linhas[0]!.regua!.texto).toBe('48,3× o normal do canal')
    expect(v.linhas[0]!.puxadoPor!.miniatura).toBeNull()
  })
  it('limiar vem de REGRA_SINAIS.multSozinho', () => {
    regra.mult = 7
    try {
      const v = montar(lista([item('a')]))
      expect(v.linhas[0]!.titulo).toContain('passou de 7×')
      expect(v.linhas[0]!.regua!.limiar).toBe(7)
      expect(v.linhas[0]!.info.regra).toContain('7×')
    } finally { regra.mult = 5 }
  })
  it('outliers fora de ordem: href e puxadoPor do mais forte; desempate por video_id', () => {
    const v = montar(lista([item('a', { rotulo_acao: 'abrir-concorrente', outliers: [out('fraco', 3), out('b', 9), out('a', 9)] })]),
      new Map([['a', am('Forte A')], ['b', am('Forte B')], ['fraco', am('Fraco')]]))
    expect(v.linhas[0]!.puxadoPor!.titulo).toBe('Forte A')
    expect(v.linhas[0]!.primario.href).toBe('/cms/youtube/competitors/video/a')
    expect(v.linhas[0]!.regua!.valor).toBe(9)
  })
  it('outliers vazios não lança: sem régua, sem puxado, href de outliers', () => {
    const v = montar(lista([item('a', { rotulo_acao: 'abrir-concorrente', outliers: [] })]))
    const l = v.linhas[0]!
    expect(l.regua).toBeNull()
    expect(l.puxadoPor).toBeNull()
    expect(l.primario.href).toBe('/cms/youtube/competitors/outliers')
  })
})

describe('"seus vídeos"', () => {
  it('não medido', () => {
    const v = montar(lista([item('a', { rotulo_acao: 'generico', n_proprios: null, proprios_agora: null, proprios_agora_n: null })]))
    expect(v.linhas[0]!.seus.naoMedido).toBe(true)
    expect(v.linhas[0]!.seus.texto).toBe('Não temos como confirmar quantos vídeos seus citam Vietnã.')
    expect(v.linhas[0]!.primario).toMatchObject({ texto: 'Abrir seus vídeos', href: '/cms/youtube/videos' })
  })
  it('site sem vídeo próprio', () => {
    const v = montar(lista([item('a', { rotulo_acao: 'abrir-concorrente', n_proprios: 0, proprios_agora: [], proprios_agora_n: 0 })], { contagens: { proprios: 0 } }))
    expect(v.linhas[0]!.seus.texto).toBe('Seu canal não tinha vídeo no cálculo de hoje, 07:02.')
    expect(v.linhas[0]!.seus.naoMedido).toBe(false)
  })
})

describe('parecido e lugar', () => {
  const par = (proprios: string[] | null) => item('p', { kind: 'parecido', subject_key: 'outlier:o', outliers: [out('o', 7)], proprios_agora: proprios, n_proprios: proprios?.length ?? null, rotulo_acao: proprios ? 'abrir-seus' : 'generico' })
  const SEM = 'Um vídeo de tema parecido com um seu passou do normal'
  it('mesmo lugar', () => {
    const a = new Map([['o', am('T', { chaves: ['pais:vn'] })], ['x', am('P', { origem: 'proprio', chaves: ['pais:vn', 'local:hanoi'] })]])
    expect(montar(lista([par(['x'])]), a).linhas[0]!.titulo).toBe(`${SEM}, no mesmo lugar (Vietnã)`)
  })
  it('lugar diferente quando os dois foram medidos', () => {
    const a = new Map([['o', am('T', { chaves: ['pais:vn'] })], ['x', am('P', { origem: 'proprio', chaves: ['pais:jp'] })]])
    expect(montar(lista([par(['x'])]), a).linhas[0]!.titulo).toBe(`${SEM} (lugar diferente: Vietnã)`)
  })
  it('próprio sem chaves ou ausente: frase sem lugar, igual em limite 100 e 3', () => {
    const a = new Map([['o', am('T', { chaves: ['pais:vn'] })], ['x', am('P', { origem: 'proprio', chaves: null })]])
    for (const limite of [100, 3]) expect(montar(lista([par(['x'])]), a, { limite }).linhas[0]!.titulo).toBe(SEM)
    expect(montar(lista([par(['x'])]), new Map([['o', am('T', { chaves: ['pais:vn'] })]])).linhas[0]!.titulo).toBe(SEM)
  })
  it('outlier sem chaves ou proprios_agora nulo: frase sem lugar', () => {
    expect(montar(lista([par(['x'])]), new Map([['o', am('T')]])).linhas[0]!.titulo).toBe(SEM)
    expect(montar(lista([par(null)]), new Map([['o', am('T', { chaves: ['pais:vn'] })]])).linhas[0]!.titulo).toBe(SEM)
  })
  it('seus do parecido', () => {
    expect(montar(lista([par(['x', 'y'])])).linhas[0]!.seus.texto).toMatch(/^Parecido com 2 vídeos seus/)
    expect(montar(lista([par(['x'])])).linhas[0]!.primario.texto).toBe('Abrir seu vídeo parecido')
  })
})

describe('quarenta', () => {
  const itens = [
    ...Array.from({ length: 28 }, (_, i) => item('d' + i, { subject_key: 'pais:vn', outliers: [out('od' + i, 14 - i * 0.3)] })),
    ...Array.from({ length: 12 }, (_, i) => item('p' + i, { kind: 'parecido', subject_key: 'outlier:o' + i, outliers: [out('op' + i, 9 - i * 0.3)] })),
  ]
  itens[9] = item('d9', { acao: 'video_novo', n_proprios: 1, proprios_agora: ['p1'], proprios_agora_n: 1, rotulo_acao: 'abrir-seus' })
  const q = montar(lista(itens))
  it('filtro presente com contagens', () => {
    expect(q.filtro).toEqual({ atual: 'todas', contagens: { todas: 40, destino: 28, parecido: 12 } })
  })
  it('10ª linha video_novo com 1 próprio usa o próprio', () => expect(q.linhas[9]!.primario.texto).toBe('Abrir seu vídeo sobre Vietnã'))
  it('filtrarVista parecido', () => {
    const f = filtrarVista(q, 'parecido')
    expect(f.linhas).toHaveLength(12)
    expect(f.linhas.map((l) => l.primario.cheio)).toEqual([true, ...Array(11).fill(false)])
    expect(f.filtro).toEqual({ atual: 'parecido', contagens: { todas: 40, destino: 28, parecido: 12 } })
    expect(f.vazio).toBeNull()
    expect(q.linhas).toHaveLength(40)
  })
  it('montar com filtro destino devolve também parecido; filtro presente com n = 8', () => {
    expect(montar(lista(itens), new Map(), { filtro: 'destino' }).linhas.some((l) => l.chip.simbolo === 'chama')).toBe(true)
    const oito = montar(lista(tres().concat(Array.from({ length: 5 }, (_, i) => item('z' + i)))), new Map(), { filtro: 'destino' })
    expect(oito.n).toBe(8)
    expect(oito.filtro?.atual).toBe('destino')
  })
  it('filtro sem linha e n > 0', () => {
    const so = montar(lista([item('a'), item('b')].concat(Array.from({ length: 7 }, (_, i) => item('c' + i)))))
    const f = filtrarVista(so, 'parecido')
    expect(f.linhas).toEqual([])
    expect(f.vazio).toMatchObject({ titulo: 'Nenhum concorrente aberto agora.' })
    expect(filtrarVista(montar(lista(itens.slice(28))), 'destino').linhas).toHaveLength(0)
  })
  it('n 120 com limite 100: sem filtro, total além do limite', () => {
    const v = montar(lista(itens.slice(0, 40), { n: 120 }), new Map(), { limite: 100 })
    expect(v.totalAlemDoLimite).toBe(120)
    expect(v.filtro).toBeNull()
    const v2 = montar(lista(itens.slice(0, 40), { n: 120 }), new Map(), { limite: 40 })
    expect(v2.totalAlemDoLimite).toBe(120)
    expect(v2.filtro).toBeNull()
  })
})

describe('faixas, cabeçalho e vazios', () => {
  it('velho com faixa e data', () => {
    const v = montar(lista(tres(), { desatualizado: true, computado_em: '2026-10-19T10:02:00Z' }))
    expect(v.velho).toBe(true)
    expect(v.calculado).toBe('Calculado em 19/10, 07:02')
    expect(v.faixa).toEqual({ tipo: 'velho', titulo: 'As sugestões não são recalculadas desde 19/10, 07:02.', texto: 'A lista abaixo é a do último cálculo.' })
  })
  it('saiuDoAviso', () => {
    const v = montar(lista(tres()), new Map(), { saiuDoAviso: true })
    expect(v.faixa).toMatchObject({ tipo: 'sino-saiu', titulo: 'Algumas sugestões do aviso já saíram da lista.' })
  })
  const vz = (motivoVazio: ListaDeSinais['motivoVazio'], contagens: Record<string, number> = {}, calculoLigado = true) =>
    montar(lista([], { n: 0, motivoVazio, contagens, calculoLigado, computado_em: null }))
  it.each([
    ['tudo-respondido', 'resolvido'], ['sem-terceiro-outlier', 'calmo'], ['abaixo-do-minimo', 'calmo'], ['sem-grupo', 'calmo'],
    ['nunca-calculado', 'espera'], ['sem-historico', 'espera'], ['sync-atrasado', 'problema'], ['sem-lugar', 'nm'],
  ] as const)('%s -> %s', (m, fam) => {
    const v = vz(m)
    expect(v.vazio!.familia).toBe(fam)
    expect(v.vazio!.titulo.length).toBeGreaterThan(0)
    expect(v.linhas).toEqual([])
    expect(v.calculado).toBeNull()
  })
  it('frases com número e sem a chave', () => {
    expect(vz('tudo-respondido', { respondidos_30d: 7 }).vazio!.texto).toBe('Todas as sugestões recentes já foram respondidas (7 nos últimos 30 dias).')
    expect(vz('tudo-respondido').vazio!.texto).toBe('Todas as sugestões recentes já foram respondidas.')
    expect(vz('abaixo-do-minimo').vazio!.texto).not.toMatch(/\d/)
  })
  it('nunca-calculado desligado', () => {
    const v = vz('nunca-calculado', {}, false)
    expect(v.vazio!.titulo).toBe('O cálculo das sugestões ainda não foi ligado.')
    expect(v.vazio!.texto).toMatch(/^Quando for ligado, o 1º cálculo roda depois das \d\d:00 \(Brasília\)\.$/)
  })
})

describe('resumoDaLista', () => {
  const d = (lugar: string) => ({ kind: 'destino' as const, lugar })
  it('1, 2 e 5 destinos', () => {
    expect(resumoDaLista([d('Vietnã')])).toBe('1 sugestão: 1 destino (Vietnã).')
    expect(resumoDaLista([d('Vietnã'), d('Japão')])).toBe('2 sugestões: 2 destinos (Vietnã e Japão).')
    expect(resumoDaLista(['Vietnã', 'Japão', 'Peru', 'Chile', 'Índia'].map(d))).toBe('5 sugestões: 5 destinos (Vietnã, Japão e +3).')
  })
})

describe('dado hostil', () => {
  it('<script> sai como string igual', () => {
    const t = '<script>alert(1)</script> 🌴'
    const v = montar(lista([item('a', { outliers: [out('o', 6)] })]), new Map([['o', am(t, { canal: '<b>x</b>' })]]))
    expect(v.linhas[0]!.puxadoPor!.titulo).toBe(t)
    expect(v.linhas[0]!.puxadoPor!.canal).toBe('<b>x</b>')
  })
})
