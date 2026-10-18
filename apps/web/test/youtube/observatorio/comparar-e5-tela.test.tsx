// @vitest-environment jsdom
/** A5 E5a T7: a tela de Comparar com as medidas novas (estado, Direção, primeiros dias, acerto, reação), sem rede, nos estados que o plano manda provar. */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { canalDe, pacoteDe } from './par-helpers'
import { a3World } from './a3-fixture'
import { buildCompararPack, type CompararPack } from '@/app/cms/(authed)/youtube/competitors/_comparar/pack'
import { CompararScreen } from '@/app/cms/(authed)/youtube/competitors/_comparar/comparar-screen'
import type { MedidasDoCanalPack, MedidasPlanas } from '@/app/cms/(authed)/youtube/competitors/_comparar/medidas-do-lado'
import type { MedidasDoSite } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => { throw new Error('a tela não usa o router') } }))

const JAN = { de: '2026-07-01', ate: '2026-09-30', dias: 90 }
const medido = <T,>(valor: T, n = 10, notas: unknown[] = []) => ({ estado: 'medido' as const, valor, n, janela: JAN, notas })
const nao = (motivo: string, extra: Record<string, unknown> = {}) => ({ estado: 'nao_medido' as const, motivo, notas: [], ...extra })
const planas = (o: Record<string, unknown> = {}): MedidasPlanas => ({
  m3a: medido({ variacao: 0.3, direcao: 'subindo', ganhoRecente: 130_000, ganhoAnterior: 100_000 }),
  m3b: medido({ variacao: 0.2, direcao: 'subindo', medianaRecente: 12_000, medianaAnterior: 10_000 }),
  m3c: medido({ variacao: -0.2, direcao: 'descendo', medianaRecente: 8_000, medianaAnterior: 10_000 }),
  m1: { 1: medido(1000), 7: medido(5000), 30: medido(9000) },
  m4: medido({ acertos: 3, fracassos: 2, total: 12, pctAcerto: 0.25, pctFracasso: 0.17 }),
  m7: medido(0.04),
  m8: { estado: medido('ativo'), parado: medido({ dias: 3, limite: 40, ultimaEm: 1_790_000_000_000 }), queda: nao('poucos_videos') },
  ...o,
} as unknown as MedidasPlanas)
const doLado = (m: MedidasPlanas | null, o: Partial<MedidasDoCanalPack> = {}): MedidasDoCanalPack => ({
  fonte: m ? { tipo: 'medidas', m, extras: null } : { tipo: 'nao_carregou', causa: 'leitura_falhou' },
  videosN: 20, buscando: false, ultimaBoa: null, longos: { recente: 6, anterior: 5, cobertura: { ok: true }, fora: { semFormato: 0, aoVivo: 0, agendados: 0 } }, ...o,
})

function pacote(hojeSP: string, lados: Record<string, MedidasDoCanalPack | undefined>, ajusta?: (c: ReturnType<typeof canalDe>[]) => void): CompararPack {
  const canais = [
    canalDe('c1', { name: 'Leo Khev', subs: 5000 }), canalDe('c2', { name: 'Ana Viaja', subs: 3000 }), canalDe('c3', { name: 'Beto Rota', subs: 120 }),
    canalDe('eu', { name: 'tnFigueiredo', subs: 1000, own: true }),
  ]
  ajusta?.(canais)
  const p = pacoteDe(canais.map(c => ({ ...c, medidasDoLado: lados[c.id] })))
  return { ...p, hojeSP }
}
const mostrar = (pack: CompararPack, a: string, b: string) => {
  window.history.replaceState(null, '', `/cms/youtube/competitors/comparar?a=${a}&b=${b}`)
  return render(<div data-obs=""><CompararScreen pack={pack} inicial={{ a, b }} /></div>)
}
const linha = (g: string, k: string, v: string) => document.querySelector(`[data-grupo="${g}"] tr[${k}="${v}"]`) as HTMLElement | null
const texto = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ')

beforeEach(() => { window.history.replaceState(null, '', '/cms/youtube/competitors/comparar') })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.unstubAllGlobals() })

describe('Comparar T7: estados', () => {
  it('lado que não carregou: só o nome e "Não carregou" no cartão, o aviso com "Tentar de novo", e o outro lado segue', () => {
    mostrar(pacote('2027-12-01', { c1: doLado(planas()), c2: doLado(null) }), 'c1', 'c2')
    const b = document.querySelector('[data-lado="B"]')!
    expect(b.textContent).toContain('falhou')
    expect(b.textContent).not.toContain('inscritos')
    const aviso = document.querySelector('[data-erro-lado]')!
    expect(aviso.textContent).toContain('Ana Viaja (lado B)')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(texto(linha('direcao', 'data-leitura', 'a'))).toContain('subindo') // o lado A segue medido
  })

  it('canal próprio de um lado: a frase quieta, nunca zero; e nenhum lado seu = a linha quieta', () => {
    const lados = { c1: doLado(planas()), eu: { ...doLado(null), fonte: { tipo: 'canal_proprio' } as const } }
    mostrar(pacote('2027-12-01', lados), 'eu', 'c1')
    const a = texto(linha('direcao', 'data-leitura', 'a'))
    expect(a).toContain('o YouTube não dá esse número do seu canal')
    cleanup()
    mostrar(pacote('2027-12-01', { c1: doLado(planas()), c2: doLado(planas()) }), 'c1', 'c2')
    expect(document.querySelector('[data-sem-proprio]')).not.toBeNull()
  })

  it('(c) antes da data é "ainda não existe" e (a) é a principal; depois da data (c) é a principal', () => {
    mostrar(pacote('2026-10-16', { c1: doLado(planas()), c2: doLado(planas()) }), 'c1', 'c2')
    expect(linha('direcao', 'data-leitura', 'a')!.getAttribute('data-papel')).toBe('principal')
    expect(texto(linha('direcao', 'data-leitura', 'c'))).toContain('só a partir de 01/04')
    cleanup()
    mostrar(pacote('2027-12-01', { c1: doLado(planas()), c2: doLado(planas()) }), 'c1', 'c2')
    expect(linha('direcao', 'data-leitura', 'c')!.getAttribute('data-papel')).toBe('principal')
    expect(texto(linha('direcao', 'data-leitura', 'a'))).not.toContain('só a partir de')
  })

  it('a marca da mudança de contagem aparece na janela que cruza 24/08 e some na que não cruza', () => {
    const limpa = planas({ m3b: { ...medido({ variacao: 0.2, direcao: 'subindo', medianaRecente: 12_000, medianaAnterior: 10_000 }), janela: { de: '2026-09-10', ate: '2026-12-09', dias: 90 } } })
    mostrar(pacote('2027-12-01', { c1: doLado(planas()), c2: doLado(limpa) }), 'c1', 'c2')
    const l = linha('direcao', 'data-leitura', 'b')!
    const marcas = l.querySelectorAll('[data-marca-contagem]')
    expect(marcas).toHaveLength(1) // só o lado A cruza
    expect(marcas[0]!.textContent).toContain('24/08')
  })

  it('canal que saiu do YouTube: o estado e "até dd/mm" nos números', () => {
    const fora = planas({ m8: { estado: medido('fora_do_ar'), parado: nao('poucos_videos'), queda: nao('poucos_videos') } })
    mostrar(pacote('2027-12-01', { c1: doLado(planas()), c2: doLado(fora, { ultimaBoa: '20/09' }) }), 'c1', 'c2')
    expect(document.querySelector('[data-lado="B"]')!.textContent).toContain('Saiu do YouTube')
    expect(texto(linha('primeiros-dias', 'data-idade', '7'))).toContain('até 20/09')
  })
})

describe('Comparar T7: números', () => {
  it('acerto: "3 de 12" com porcentagem; "3 de 9" sem porcentagem', () => {
    const b = planas({ m4: medido({ acertos: 3, fracassos: 1, total: 9, pctAcerto: 0.33, pctFracasso: 0.11 }) })
    mostrar(pacote('2027-12-01', { c1: doLado(planas()), c2: doLado(b) }), 'c1', 'c2')
    const t = document.querySelector('[data-grupo="acerto"]')!
    expect(t.querySelector('.cA')!.textContent).toContain('3 de 12')
    expect(t.querySelector('.cA')!.textContent).toContain('25% de acerto')
    expect(t.querySelector('.cB')!.textContent).toContain('3 de 9')
    expect(t.querySelector('.cB')!.textContent).not.toContain('%')
  })

  it('reação: idades diferentes não dizem quem é maior, nem "×"; idades iguais dizem', () => {
    const hoje = planas({ m7: medido(0.08, 10, [{ tipo: 'total_de_hoje' }]) })
    mostrar(pacote('2027-12-01', { c1: doLado(planas()), c2: doLado(hoje) }), 'c1', 'c2')
    const r = document.querySelector('[data-grupo="reacao"] .rel')!
    expect(r.textContent).toContain('Leituras diferentes')
    expect(r.textContent).not.toMatch(/×/)
    cleanup()
    mostrar(pacote('2027-12-01', { c1: doLado(planas()), c2: doLado(planas({ m7: medido(0.08) })) }), 'c1', 'c2')
    expect(document.querySelector('[data-grupo="reacao"] .rel')!.textContent).toContain('Ana Viaja')
  })

  it('só curtidas é dito no chip da célula', () => {
    mostrar(pacote('2027-12-01', { c1: doLado(planas({ m7: medido(0.04, 10, [{ tipo: 'so_curtidas' }]) })), c2: doLado(planas()) }), 'c1', 'c2')
    expect(document.querySelector('[data-grupo="reacao"] .cA')!.textContent).toContain('só curtidas')
    expect(document.querySelector('[data-grupo="reacao"] .rel')!.textContent).toContain('Leituras diferentes')
  })

  it('nichos diferentes: uma régua por lado e a frase de contexto', () => {
    mostrar(pacote('2027-12-01', { c1: doLado(planas()), c2: doLado(planas()) }, cs => { cs[1] = { ...cs[1]!, niche: 'culinaria', nicheLabel: 'Culinária' } }), 'c1', 'c2')
    expect(document.querySelectorAll('[data-grupo="direcao"] .cp-rd')).toHaveLength(2)
    expect(document.querySelector('[data-contexto]')!.textContent).toContain('Nichos diferentes')
  })

  it('"praticamente igual" nos primeiros 30 dias com a diferença abaixo de 10%', () => {
    const b = planas({ m1: { 1: medido(1000), 7: medido(5000), 30: medido(9300) } })
    mostrar(pacote('2027-12-01', { c1: doLado(planas()), c2: doLado(b) }), 'c1', 'c2')
    expect(texto(linha('primeiros-dias', 'data-idade', '30'))).toContain('Praticamente igual')
  })

  it('fora da escala: a régua de direção é desenhada com o texto do valor verdadeiro', () => {
    const grande = planas({ m3c: medido({ variacao: 2.5, direcao: 'subindo', medianaRecente: 35_000, medianaAnterior: 10_000 }) })
    mostrar(pacote('2027-12-01', { c1: doLado(grande), c2: doLado(planas()) }), 'c1', 'c2')
    const r = document.querySelector('[data-grupo="direcao"] .cp-rd-t')!
    expect(r.getAttribute('aria-label')).toContain('fora da escala')
  })
})

describe('Comparar T7: sem rede', () => {
  it('trocar o seletor para um terceiro canal usa as medidas dele, que já estavam no pacote', () => {
    const fetchSpy = vi.fn(() => { throw new Error('a tela não vai à rede') })
    vi.stubGlobal('fetch', fetchSpy)
    const pack = pacote('2027-12-01', { c1: doLado(planas()), c2: doLado(planas()), c3: doLado(planas({ m4: medido({ acertos: 7, fracassos: 1, total: 20, pctAcerto: 0.35, pctFracasso: 0.05 }) })) })
    mostrar(pack, 'c1', 'c2')
    fireEvent.change(screen.getByLabelText('Lado B'), { target: { value: 'c3' } })
    expect(document.querySelector('[data-grupo="acerto"] .cB')!.textContent).toContain('7 de 20')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('inverter carrega as medidas junto', () => {
    const pack = pacote('2027-12-01', { c1: doLado(planas()), c2: doLado(planas({ m4: medido({ acertos: 7, fracassos: 1, total: 20, pctAcerto: 0.35, pctFracasso: 0.05 }) })) })
    mostrar(pack, 'c1', 'c2')
    expect(document.querySelector('[data-grupo="acerto"] .cB')!.textContent).toContain('7 de 20')
    fireEvent.click(screen.getByRole('button', { name: /Inverter lados/ }))
    expect(document.querySelector('[data-grupo="acerto"] .cA')!.textContent).toContain('7 de 20')
  })
})

describe('Comparar T7: o pacote do servidor', () => {
  const plano = (v: unknown): boolean => JSON.stringify(v) === JSON.stringify(JSON.parse(JSON.stringify(v)))
  const site = (obs: ReturnType<typeof a3World>['obs']): MedidasDoSite => {
    const porCanal = new Map<string, never>()
    for (const c of obs.channels.filter(x => !x.own)) {
      porCanal.set(c.id, {
        porFormato: { long: { m1: planas().m1, m4: planas().m4, m7: planas().m7, m3b: planas().m3b, m3c: planas().m3c }, short: {} },
        m3a: planas().m3a, m8: planas().m8, porVideo: new Map([['v1', { segredo: true }]]), falhas: [],
      } as never)
    }
    return { porCanal, extras: { lido: false, causa: 'tempo_esgotado' } as never, falhas: [], esgotou: 0 }
  }

  it('o pacote é dado simples: sem Map, sem função, sem undefined e sem porVideo', () => {
    const w = a3World()
    const p = buildCompararPack(w.obs, undefined, undefined, undefined, site(w.obs))
    const json = JSON.stringify(p)
    expect(json).not.toContain('porVideo')
    expect(json).not.toContain('segredo')
    expect(json).not.toContain('undefined')
    expect(p.hojeSP).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(plano(p)).toBe(true)
    for (const c of p.canais) if (!c.own) expect(c.medidasDoLado?.fonte.tipo).toBe('medidas')
  })

  it('sem o argumento das medidas (`undefined`): o pacote não ganha nenhum campo novo', () => {
    const p = buildCompararPack(a3World().obs)
    expect('hojeSP' in p).toBe(false)
    expect(p.canais.every(c => !('medidasDoLado' in c))).toBe(true)
  })

  it('medidas que falharam por inteiro (`null`): cada concorrente diz "não carregou", nunca "sem dado"', () => {
    const p = buildCompararPack(a3World().obs, undefined, undefined, undefined, null)
    expect(p.hojeSP).toBeDefined()
    for (const c of p.canais) if (!c.own) expect(c.medidasDoLado?.fonte.tipo).toBe('nao_carregou')
  })

  it('o canal próprio nunca recebe medidas de concorrente', () => {
    const w = a3World()
    const p = buildCompararPack(w.obs, undefined, undefined, undefined, site(w.obs))
    for (const c of p.canais) if (c.own) expect(c.medidasDoLado?.fonte.tipo).toBe('canal_proprio')
  })
})
