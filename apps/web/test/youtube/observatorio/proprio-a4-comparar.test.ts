// @vitest-environment node
// A4 Tarefa 5 (comparação): o lado do canal próprio mostra as views por dia reais do diário, com a base escrita; cada
// ausência diz o motivo, nunca vira zero, e a linha fica sem relação.
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import type { ReactElement } from 'react'
import { a3World } from './a3-fixture'
import { numerosDoCanal, MOTIVOS, motivoTexto, type Numero } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import { buildCompararPack } from '@/app/cms/(authed)/youtube/competitors/_comparar/pack'
import { buildPar } from '@/app/cms/(authed)/youtube/competitors/_comparar/par-model'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { vpdText } from '@/app/cms/(authed)/youtube/competitors/_canal/numeros'
import type { ExtrasProprio } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import { baseVpdTexto, motivoVpdTexto, type MotivoSemVpd, type VpdCanal } from '@/lib/youtube/observatorio/proprio/vpd'
import type { DiaYt } from '@/lib/youtube/observatorio/proprio/tipos'
import type { Dataset } from '@/lib/youtube/observatorio/types'

const dados = vi.hoisted(() => ({ podeVerPrivado: vi.fn(), lerDiarioDosCanais: vi.fn(), lerAlcanceDosCanais: vi.fn(), longosAcompanhadosDe: vi.fn(), abrir: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({ openObservatoryPage: dados.abrir }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados', () => ({
  podeVerPrivado: dados.podeVerPrivado, lerDiarioDosCanais: dados.lerDiarioDosCanais, lerAlcanceDosCanais: dados.lerAlcanceDosCanais, longosAcompanhadosDe: dados.longosAcompanhadosDe,
}))

afterEach(() => new Promise<void>(r => setTimeout(r, 0)))

const BASE = a3World()
const [OWN, OWN2] = BASE.owns as [string, string]
const CH = 'leo-khev'
const dm = (d: DiaYt) => d.slice(8) + '/' + d.slice(5, 7)
const JANELA = { de: '2026-09-11', ate: '2026-10-08' }
const medido = (valor: number, n = 3): VpdCanal => ({ valor, motivo: null, n, janela: JANELA, ultimoDia: JANELA.ate })
const semValor = (motivo: MotivoSemVpd, ultimoDia: DiaYt | null = null): VpdCanal => ({ valor: null, motivo, n: 0, janela: null, ultimoDia })
const extras = (m: Record<string, VpdCanal>): ExtrasProprio => ({ vpd: new Map(Object.entries(m)), dm })
const nums = (obs = BASE.obs, id = OWN, ex?: ExtrasProprio) => numerosDoCanal(obs, id, undefined, ex)
const naoMedido = (n: Numero, motivo: string) => { expect(n.x).toBeNull(); expect(n.texto).toBeNull(); expect(n.motivo).toBe(motivo); expect(n.nota).toBeNull() }
const NBSP = / /g

const SEIS: Array<[MotivoSemVpd, DiaYt | null, string]> = [
  ['sem-acesso', null, 'só quem edita o site vê as views por dia do seu canal'],
  ['leitura-falhou', null, 'a leitura das views por dia falhou agora; recarregue a página'],
  ['sem-diario', null, 'a coleta diária ainda não gravou este canal'],
  ['diario-parado', '2026-10-02', 'a coleta diária deste canal parou em 02/10'],
  ['sem-longos', '2026-10-08', 'nenhum vídeo longo acompanhado'],
  ['poucos-dias', '2026-10-08', 'menos de 7 dias medidos nos últimos 28'],
]

describe('A4.5 comparação: números do lado próprio', () => {
  it('lado próprio com views por dia medidas: a linha mostra o número e a base diz a janela de 28 dias; o lado concorrente diz a dele', () => {
    const subs = BASE.obs.channel(OWN)!.subs!
    const ex = extras({ [OWN]: medido(2.4, 3), [OWN2]: semValor('sem-diario') })
    const n = nums(BASE.obs, OWN, ex)
    expect(n.vpd).toEqual({ x: 2.4, texto: '2,4', motivo: null, nota: 'média dos últimos 28 dias do YouTube com medida (de 11/09 a 08/10), mediana de 3 longos' })
    const porMil = 2.4 / (subs / 1000)
    expect(n.vpdPorMil.x).toBeCloseTo(porMil, 10)
    expect(n.vpdPorMil.texto).toBe(vpdText(porMil, BASE.obs.fmt.num))
    expect(n.vpdPorMil.motivo).toBeNull()
    expect(n.vpdPorMil.nota).toBe(n.vpd.nota)
    // o lado concorrente diz a janela dele ("desde 03/10"), não a de 28 dias
    const S = BASE.obs.channelStats(CH, 'long')
    const c = nums(BASE.obs, CH, ex)
    expect(c.vpd.x).toBe(S.vpdMedian)
    expect(c.vpd.nota).toBe(`views por dia ${S.vpdWindow}, mediana de ${S.vpdN} ${S.vpdN === 1 ? 'longo' : 'longos'}`)
    expect(c.vpd.nota).toContain(`desde ${BASE.obs.SERIES_START_LABEL}`)
    expect(c.vpdPorMil.nota).toBe(c.vpd.nota)
    // a base chega ao par: cada lado com a sua
    const pack = buildCompararPack(BASE.obs, () => {}, ex)
    const l = buildPar(pack, OWN, CH).linhas.find(x => x.id === 'vpd')!
    expect(l.lados[0].nota).toBe(baseVpdTexto(medido(2.4), dm))
    expect(l.lados[1].nota).toBe(c.vpd.nota)
    expect(l.relacao).not.toBeNull()
    expect(l.pos[0]).not.toBeNull() // o número do canal próprio conta na posição do nicho
  })

  it('zero medido do canal próprio (parado) é "0" com a base escrita, nunca "não medido"', () => {
    const n = nums(BASE.obs, OWN, extras({ [OWN]: medido(0, 2) }))
    expect(n.vpd).toEqual({ x: 0, texto: '0', motivo: null, nota: 'média dos últimos 28 dias do YouTube com medida (de 11/09 a 08/10), mediana de 2 longos' })
    expect(n.vpdPorMil.x).toBe(0); expect(n.vpdPorMil.texto).toBe('0')
  })

  it('a lista e a comparação escrevem o MESMO número para o mesmo canal (formatador único), em todas as faixas', () => {
    for (const v of [0, 0.01, 0.04, 0.05, 0.96, 2.4, 9.96, 10.4, 999.4, 1234.5, 15_800]) {
      const ex = extras({ [OWN]: medido(v), [OWN2]: semValor('sem-diario') })
      for (const scale of ['abs', 'per-mil'] as const) {
        const lista = buildCanaisView(BASE.obs, { niche: 'todos', limit: 75, sort: 'vpd', scale }, ex)
        const cel = [...lista.list.ranked, ...lista.list.unranked].find(r => r.id === OWN)!.cells.vpd
        expect(cel.kind, `${v}/${scale}`).toBe('ok')
        if (cel.kind !== 'ok') continue
        const n = nums(BASE.obs, OWN, ex)
        expect((scale === 'abs' ? n.vpd : n.vpdPorMil).texto, `${v}/${scale}`).toBe(cel.big.replace(NBSP, ' '))
      }
    }
  })

  it('lado próprio sem o número: pastilha "não medido" com o motivo de motivoVpdTexto, e a linha fica sem relação', () => {
    for (const [m, ultimo, texto] of SEIS) {
      const c = semValor(m, ultimo)
      expect(motivoVpdTexto(m, c, dm), m).toBe(texto)
      const ex = extras({ [OWN]: c, [OWN2]: c })
      const n = nums(BASE.obs, OWN, ex)
      naoMedido(n.vpd, texto); naoMedido(n.vpdPorMil, texto)
      const pack = buildCompararPack(BASE.obs, () => {}, ex)
      const l = buildPar(pack, OWN, CH).linhas.find(x => x.id === 'vpd')!
      expect(l.lados[0].x, m).toBeNull()
      expect(l.lados[0].motivo, m).toBe(texto)
      expect(l.lados[1].x, m).not.toBeNull() // o concorrente continua medido
      expect(l.relacao, m).toBeNull()
      expect(l.pos[0], m).toBeNull()
      expect(buildPar(pack, OWN, CH).linhas.find(x => x.id === 'vpdPorMil')!.relacao, m).toBeNull()
      // dois canais próprios sem número: a linha some do par (nenhum dos dois tem dado), em vez de mostrar dois "não medido"
      expect(buildPar(pack, OWN, OWN2).linhas.find(x => x.id === 'vpd'), m).toBeUndefined()
    }
  })

  it('sem extras (o dado não foi lido): "a coleta diária ainda não gravou este canal", nunca um número, nunca a frase antiga', () => {
    const n = nums(BASE.obs, OWN)
    naoMedido(n.vpd, 'a coleta diária ainda não gravou este canal'); naoMedido(n.vpdPorMil, 'a coleta diária ainda não gravou este canal')
    // canal que o mapa não traz = como não lido
    naoMedido(nums(BASE.obs, OWN2, extras({ [OWN]: medido(1) })).vpd, 'a coleta diária ainda não gravou este canal')
  })

  it('inscritos ocultos e zero inscritos: o absoluto continua medido; o por mil diz o motivo de hoje', () => {
    const ex = extras({ [OWN]: medido(3) })
    const oc = a3World(ds => { ds.channels.find(c => c.id === OWN)!.subs = null })
    const a = nums(oc.obs, OWN, ex)
    expect(a.vpd.x).toBe(3); naoMedido(a.vpdPorMil, 'inscritos ocultos pelo canal')
    const z = a3World(ds => { ds.channels.find(c => c.id === OWN)!.subs = 0 })
    const b = nums(z.obs, OWN, ex)
    expect(b.vpd.x).toBe(3); naoMedido(b.vpdPorMil, 'o canal ainda não tem inscritos')
  })

  it('canal próprio sem vídeos continua "sem vídeos", mesmo com um número vindo de fora', () => {
    const w = a3World(ds => { ds.videos = ds.videos.filter(v => v.ch !== OWN2); ds.channels.find(c => c.id === OWN2)!.undated = [] })
    naoMedido(nums(w.obs, OWN2, extras({ [OWN2]: medido(9) })).vpd, 'sem vídeos')
  })

  it('nenhum par do fixture mostra "ainda não aparecem nesta tela" (nem a frase antiga em nenhum motivo possível)', () => {
    expect(MOTIVOS.map(m => motivoTexto(m)).join('|')).not.toMatch(/ainda não aparecem nesta tela|chegam com a página/)
    const w = a3World(ds => { ds.videos = ds.videos.filter(v => v.ch !== 'paddy-doyle') })
    const mundos: Array<[string, ExtrasProprio | undefined]> = [
      ['sem extras', undefined], ['medido', extras({ [OWN]: medido(3.3), [OWN2]: medido(0) })],
      ['motivos', extras({ [OWN]: semValor('diario-parado', '2026-10-02'), [OWN2]: semValor('sem-acesso') })],
    ]
    let pares = 0
    for (const [nome, ex] of mundos) {
      const pack = buildCompararPack(w.obs, () => {}, ex)
      const n = pack.ordem.length
      expect(n).toBeGreaterThan(12)
      let deste = 0
      for (const a of pack.ordem) for (const b of pack.ordem) {
        if (a === b) continue
        deste++
        const json = JSON.stringify(buildPar(pack, a, b))
        expect(json, `${nome}/${a}×${b}`).not.toMatch(/ainda não aparecem nesta tela|começa em breve|chegam com a página/)
      }
      expect(deste).toBe(n * (n - 1))
      pares += deste
    }
    expect(pares).toBe(3 * (w.obs.channels.length * (w.obs.channels.length - 1)))
  })
})

describe('A4.5 comparação: a página lê o diário só quando há canal próprio e só depois da guarda', () => {
  const ordem: string[] = []
  async function pagina() {
    const { default: Page } = await import('@/app/cms/(authed)/youtube/competitors/comparar/page')
    return (await Page({ searchParams: Promise.resolve({}) })) as ReactElement<{ children: ReactElement<{ pack: { canais: Array<{ id: string; numeros: Record<string, Numero> }> } }> }>
  }
  function mundo(obs: typeof BASE.obs) {
    dados.abrir.mockImplementation(async () => { ordem.push('guarda'); return { siteId: 'site-1', now: obs.NOW, rows: {}, obs, savedNiche: 'todos', meuCanalLembrado: null, extra: undefined } })
  }
  beforeEach(() => {
    ordem.length = 0
    for (const f of Object.values(dados)) f.mockReset()
    dados.longosAcompanhadosDe.mockImplementation((_obs: unknown, id: string) => [`yt-${id}`])
    dados.podeVerPrivado.mockImplementation(async () => { ordem.push('prova'); return { siteId: 'site-1' } })
    dados.lerDiarioDosCanais.mockImplementation(async () => { ordem.push('diario'); return new Map() })
    dados.lerAlcanceDosCanais.mockImplementation(async () => new Map()) // o alcance do cartão "Só o seu canal mede" (Tarefa 14) não é o assunto deste arquivo
  })

  it('sem canal próprio no site: lerDiarioDosCanais não é chamado (nem a prova de edição)', async () => {
    const w = a3World(ds => { ds.channels = ds.channels.filter(c => !c.own); const o = new Set(ds.channels.map(c => c.id)); ds.videos = ds.videos.filter(v => o.has(v.ch)) })
    expect(w.obs.ownChannels()).toHaveLength(0)
    mundo(w.obs)
    const e = await pagina()
    expect(dados.lerDiarioDosCanais).not.toHaveBeenCalled()
    expect(dados.podeVerPrivado).not.toHaveBeenCalled()
    expect(e.props.children.props.pack.canais.length).toBeGreaterThan(5) // a página abre normalmente
  })

  it('com canal próprio: a prova de edição vem depois da guarda, o diário é lido uma vez com os dois canais e os longos acompanhados', async () => {
    mundo(BASE.obs)
    await pagina()
    expect(ordem).toEqual(['guarda', 'prova', 'diario'])
    expect(dados.lerDiarioDosCanais).toHaveBeenCalledTimes(1)
    const arg = dados.lerDiarioDosCanais.mock.calls[0]![0] as { canais: Array<{ id: string; longosAcompanhados: string[] }>; agora: number; edicao: unknown }
    expect(arg.canais.map(c => c.id)).toEqual(BASE.obs.ownChannels().map(c => c.id))
    expect(arg.canais[0]!.longosAcompanhados).toEqual([`yt-${arg.canais[0]!.id}`])
    expect(arg.agora).toBe(BASE.obs.NOW)
    expect(arg.edicao).toEqual({ siteId: 'site-1' })
  })

  it('quem só lê o site (sem prova): nenhum número do canal próprio na página, o motivo é "só quem edita o site vê…"', async () => {
    mundo(BASE.obs)
    dados.podeVerPrivado.mockImplementation(async () => null)
    dados.lerDiarioDosCanais.mockImplementation(async (a: { canais: Array<{ id: string }> }) => new Map(a.canais.map(c => [c.id, { acesso: 'negado' }])))
    const e = await pagina()
    for (const c of e.props.children.props.pack.canais.filter(x => BASE.owns.includes(x.id))) {
      naoMedido(c.numeros.vpd!, 'só quem edita o site vê as views por dia do seu canal')
      naoMedido(c.numeros.vpdPorMil!, 'só quem edita o site vê as views por dia do seu canal')
    }
  })

  it('o diário que falhou no servidor vira a frase de erro na comparação, distinta de "não medido"; a página abre', async () => {
    mundo(BASE.obs)
    dados.lerDiarioDosCanais.mockImplementation(async (a: { canais: Array<{ id: string }> }) => new Map(a.canais.map(c => [c.id, { acesso: 'erro' }])))
    const e = await pagina()
    const dono = e.props.children.props.pack.canais.find(c => c.id === OWN)!
    naoMedido(dono.numeros.vpd!, 'a leitura das views por dia falhou agora; recarregue a página')
    expect(dono.numeros.vpd!.motivo).not.toContain('coleta diária')
  })

  it('o diário com dados chega como número no pacote (a cadeia leitor → vpdDoCanal → pacote)', async () => {
    mundo(BASE.obs)
    // 10 dias com 5 views, para cada vídeo longo acompanhado do canal, terminando ontem
    dados.longosAcompanhadosDe.mockImplementation((obs: typeof BASE.obs, id: string) => obs.videos.filter(v => v.ch === id && v.tracked && v.fmt === 'long').map(v => v.ytId))
    dados.lerDiarioDosCanais.mockImplementation(async (a: { canais: Array<{ id: string; longosAcompanhados: string[] }> }) => new Map(a.canais.map(c => {
      const linhas = c.longosAcompanhados.flatMap(yt => Array.from({ length: 10 }, (_, i) => ({ ytId: yt, dia: new Date(BASE.obs.NOW - (i + 1) * 86_400_000).toISOString().slice(0, 10), views: 5 })))
      const ultimoDia = new Date(BASE.obs.NOW - 86_400_000).toISOString().slice(0, 10)
      return [c.id, { acesso: 'ok', dado: { linhas, ultimoDia, descartados: 0 } }]
    })))
    const e = await pagina()
    const dono = e.props.children.props.pack.canais.find(c => c.id === OWN)!
    expect(dono.numeros.vpd!.x).toBe(5); expect(dono.numeros.vpd!.texto).toBe('5,0')
    expect(dono.numeros.vpd!.nota).toMatch(/^média dos últimos 28 dias do YouTube com medida \(de \d\d\/\d\d a \d\d\/\d\d\), mediana de \d+ longos?$/)
  })
})
