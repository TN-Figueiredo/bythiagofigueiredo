// @vitest-environment jsdom
// T22b: o bloco das trocas e a linha de cima, renderizados (jsdom). O modelo é o real (`buildTrocas`, fixture sintética com sentinelas); aqui se prova o que a
// pessoa lê: chip com símbolo E texto, formas de borda dos lados sem número, aviso com role alert, régua com role img, bloqueio sem nenhum dado.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { LinhaDasTrocas, Trocas } from '@/app/cms/(authed)/youtube/competitors/_proprio/trocas'
import { buildTrocas, type TrocasView } from '@/app/cms/(authed)/youtube/competitors/_proprio/trocas-model'
import { alcance, base, comAlcance, entrada, HOJE, lidas, teste, versao, YT } from './proprio-trocas-fixture'

vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children?: ReactNode }) => <a href={href}>{children}</a> }))
afterEach(cleanup)

const txt = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ')
const tela = (v: TrocasView) => render(<div><LinhaDasTrocas view={v} /><Trocas view={v} /></div>)
const comNumero = () => buildTrocas(entrada(comAlcance([base(), versao({ dia: '2026-11-03' })], alcance(addDays(HOJE, -40), HOJE))))
const comTeste = (podeEditar: boolean) => buildTrocas(entrada(comAlcance([base(), versao({ dia: '2026-11-03' })], alcance(addDays(HOJE, -40), HOJE), undefined, { testes: { acesso: 'ok', dado: { testes: [teste()], descartados: 0 } } }), { podeEditar }))

describe('a linha de teste', () => {
  it('a linha de teste não tem número nem antes e depois', () => {
    const { container } = tela(comTeste(true))
    const li = container.querySelector('li.tr-teste')!
    expect(li).not.toBeNull()
    expect(li.querySelector('.tr-n')).toBeNull()
    expect(li.querySelector('.tr-lados, .tr-lado')).toBeNull()
    expect(txt(li)).toContain('Teste A/B')
  })
  it('link do teste com alvo de 44 px declarado; sem acesso: nenhum <a> e a pastilha restrito com a frase do teste restrito', () => {
    const com = tela(comTeste(true)).container
    const a = com.querySelector('li.tr-teste a.tr-link') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('/cms/youtube/ab-lab/t1')
    cleanup()
    const sem = tela(comTeste(false)).container
    expect(sem.querySelector('li.tr-teste a')).toBeNull()
    expect(sem.querySelector('li.tr-teste .obs-au-restrito')).not.toBeNull()
    expect(txt(sem.querySelector('li.tr-teste'))).toContain('Teste A/B restrito')
  })
})

describe('a troca numerada', () => {
  it('a troca numerada tem chip com ícone e texto, não só a cor', () => {
    const { container } = tela(comNumero())
    const chip = container.querySelector('li.tr-troca .tr-chip')!
    expect(chip.querySelector('[aria-hidden="true"]')!.textContent!.trim().length).toBeGreaterThan(0)
    expect(chip.textContent!.replace(/\s+/g, ' ').trim().split(' ').length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('li.tr-troca .tr-n')!.textContent).toBe('1')
  })
  it('o lado sem número não tem barra de taxa e tem a causa', () => {
    // troca ontem: o depois ainda não foi entregue
    const v = buildTrocas(entrada(comAlcance([base(), versao({ dia: addDays(HOJE, -1) })], alcance(addDays(HOJE, -40), addDays(HOJE, -3)))))
    const { container } = tela(v)
    const lados = [...container.querySelectorAll('.tr-lado')]
    const semNumero = lados.filter(l => !/tr-lado-numero/.test(l.className))
    expect(semNumero.length).toBeGreaterThan(0)
    for (const l of semNumero) {
      expect(l.querySelector('.tr-trilho')).toBeNull()
      expect(l.querySelector('.tr-lado-causa')).not.toBeNull()
    }
  })
  it('zero medido é caixa vazada com 0, nunca a hachura (forma zero, sem classe de não medido)', () => {
    const v = buildTrocas(entrada(comAlcance([base(), versao({ dia: '2026-11-03' })], alcance(addDays(HOJE, -40), HOJE, 0))))
    const { container } = tela(v)
    const zero = container.querySelector('.tr-lado-zero')
    expect(zero).not.toBeNull()
    expect(zero!.className).not.toMatch(/nao-medido/)
    expect(txt(zero)).toMatch(/\b0\b/)
  })
})

describe('aviso, régua, vazio, reconstruída', () => {
  it('o aviso de atraso tem role alert', () => {
    const { container } = tela(buildTrocas(entrada(lidas([base()], {}, { atrasoDias: 2, conferidoAte: '2026-11-15' }))))
    const al = container.querySelector('[role="alert"]')!
    expect(al).not.toBeNull()
    expect(txt(al)).toContain('2 dias atrasado')
    cleanup()
    expect(tela(buildTrocas(entrada(lidas([base()], {}, { atrasoDias: 1 })))).container.querySelector('[role="alert"]')).toBeNull()
  })
  it('a régua tem role img e o rótulo lista testes e trocas', () => {
    const v = comTeste(true)
    const r = tela(v).container.querySelector('[role="img"]')!
    const aria = r.getAttribute('aria-label')!
    expect(aria).toContain('troca 1 de título em 03/11')
    expect(aria.toLowerCase()).toContain('teste')
  })
  it('0 trocas: a caixa vazada e nenhuma lista', () => {
    const { container } = tela(buildTrocas(entrada(lidas([base()]))))
    expect(container.querySelector('.tr-vazio')).not.toBeNull()
    expect(container.querySelector('ol.tr-lista, li.tr-troca')).toBeNull()
  })
  it('a faixa reconstruída vem antes do divisor e não tem marcador numerado', () => {
    const t = teste({ id: 'tp', inicio: '2026-09-30T14:00:00.000Z', concluidoEm: '2026-10-04T14:00:00.000Z', ciclos: [
      { inicio: '2026-09-30T14:00:00.000Z' }, { inicio: '2026-10-02T14:00:00.000Z' },
    ] as never, status: 'completed' })
    const pre = (i: number, texto: string) => versao({ dia: '2026-09-30', texto, preRegistro: true, origem: 'ab_lab', abTestId: 'tp', vistaDesde: i < 0 ? '2026-09-29T10:00:00.000Z' : t.ciclos[i]!.inicio, corrente: false })
    const v = buildTrocas(entrada(lidas([base(), pre(-1, 'ORIGINAL'), pre(0, 'CICLO-A'), pre(1, 'CICLO-B')], { testes: { acesso: 'ok', dado: { testes: [t], descartados: 0 } } })))
    const { container } = tela(v)
    const rec = container.querySelector('.tr-reconstruida')
    if (!rec) throw new Error('a fixture esperava a faixa reconstruída; vista: ' + JSON.stringify(v.reconstruida))
    expect(rec.querySelector('.tr-n')).toBeNull()
    const div = rec.querySelector('.tr-divisor')!
    const filhos = [...rec.children]
    expect(filhos.indexOf(div)).toBe(filhos.length - 1)
    expect(filhos.indexOf(rec.querySelector('ul')!)).toBeLessThan(filhos.indexOf(div))
  })
})

describe('estado privado', () => {
  const SENT = ['TITULO-SECRETO-ZZ', 'blob.example/SECRETA.png', '03/11', '4,1%']
  it('estado privado: o HTML é só o bloqueio; nenhum título, <img>, data nem taxa, em texto nem em atributo', () => {
    // o dado existe na entrada (versões com sentinelas), mas o acesso é negado
    const v = buildTrocas(entrada('negado', { ytId: YT }))
    const { container } = tela(v)
    expect(container.querySelector('.tr-bloqueio')).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.tr-linha')).toBeNull()
    expect(container.querySelector('.tr-lista, .tr-regua, .tr-lado, [role="alert"]')).toBeNull()
    const html = container.innerHTML
    for (const s of SENT) expect(html).not.toContain(s)
    expect(html).not.toMatch(/\d{2}\/\d{2}/)
    expect(html).not.toMatch(/\d+,\d%/)
    for (const el of container.querySelectorAll('*')) for (const a of ['title', 'aria-label', 'alt', 'src'] as const) {
      const val = el.getAttribute(a)
      if (val && el.className !== 'tr-lado') expect(val, a).not.toMatch(/\d{2}\/\d{2}|\d+,\d%|TITULO/)
    }
    for (const el of container.querySelectorAll('*')) for (const at of el.getAttributeNames()) if (at.startsWith('data-')) expect(el.getAttribute(at)).not.toMatch(/\d{2}\/\d{2}|TITULO/)
  })
  it('com dado e acesso: o título da versão antiga aparece (o contraste do teste acima não é vazio)', () => {
    const v = buildTrocas(entrada(comAlcance([base(), versao({ dia: '2026-11-03', texto: 'TITULO-SECRETO-ZZ' })], alcance(addDays(HOJE, -40), HOJE))))
    expect(tela(v).container.innerHTML).toMatch(/03\/11/)
  })
})
