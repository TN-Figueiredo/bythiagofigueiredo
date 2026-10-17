// @vitest-environment jsdom
// Gio 17/10 (G-2, G-4, G-5, G-6, M-5): o que dá para provar sem navegador. A conferência a 390/1000 px com scrollWidth <= innerWidth é do Gio.
import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from '@testing-library/react'
import { medido, naoMedido } from '@/lib/youtube/observatorio/medidas/tipos'
import type { MedidasDoSite } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import { DirecaoNicho } from '@/app/cms/(authed)/youtube/competitors/_insights/direcao-nicho'
import { direcaoDoNicho } from '@/app/cms/(authed)/youtube/competitors/_insights/direcao-nicho-model'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/insights',
  useSearchParams: () => new URLSearchParams(''),
}))

const C = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/app/cms/(authed)/youtube/competitors')
const css = (rel: string) => fs.readFileSync(path.join(C, rel), 'utf8')

describe('CSS das telas estreitas', () => {
  it('Comparar: a frase por lado e o "Para conferir" ocupam a largura toda a 820 px ou menos (G-4)', () => {
    expect(css('_comparar/comparar.css')).toMatch(/max-width:820px\)\{\s*\[data-obs-screen="comparar"\] \.cp-t tr\.cp-fr,\[data-obs-screen="comparar"\] \.cp-t tr\.sub-grp\{display:block\}/)
  })
  it('chip de direção: o número e a palavra não quebram no meio (G-5)', () => {
    const c = css('_chrome/medidas/medidas.css')
    expect(c).toMatch(/\.obs-md-dir\{display:inline-flex;flex-wrap:wrap;/)
    expect(c).toMatch(/\.obs-md-dir-w\{[^}]*white-space:nowrap/)
    expect(c).toMatch(/\.obs-md-dir-n\{white-space:nowrap/)
  })
  it('Outliers: a linha do tempo de idades rola dentro do grupo, não corta nem alarga a página (G-6)', () => {
    expect(css('_outliers/outliers.css')).toMatch(/\.obs-out-tl-group\{flex:0 1 auto;max-width:100%;overflow-x:auto\}/)
  })
  it('Outliers: o grupo que rola é alcançável por teclado (tabindex 0, role group e rótulo; Naksu 2.3)', () => {
    expect(css('_outliers/age-timeline.tsx')).toMatch(/className="obs-out-tl-group" tabIndex=\{0\} role="group" aria-label="Faixas de idade/)
  })
  it('Insights: o título não nasce com base zero ao lado da meta (G-2)', () => {
    expect(css('_insights/direcao-nicho.css')).toMatch(/\.q-ch h2\{order:1;flex:1 1 200px;/)
  })
})

describe('Insights: botões de leitura', () => {
  const HOJE = '2026-10-13'
  const cs = [0, 1, 2].map(i => ({ id: 'c' + i, name: 'Canal ' + i, href: '/c/' + i }))
  const medidas = {
    porCanal: new Map(cs.map((c, i) => [c.id, {
      m3a: medido({ variacao: 0.3 - i * 0.2, direcao: 'subindo', ganhoRecente: 130_000, ganhoAnterior: 100_000 }, 3, { de: '2026-08-18', ate: HOJE, dias: 56 }),
      porFormato: { long: { m3b: naoMedido('poucos_videos', { n: 1, minimo: 3 }), m3c: naoMedido('poucos_videos', { n: 0, minimo: 3 }) } },
    }])),
    extras: { lido: false, causa: 'tempo_esgotado' }, falhas: [], esgotou: 0,
  } as unknown as MedidasDoSite
  it('o botão mostra o nome curto no celular e o completo na tela larga, sem estourar a coluna (G-2)', () => {
    const v = direcaoDoNicho(medidas, cs, { leitura: 'a', hojeSP: HOJE, nicho: 'Viagem', seusCanais: [] })
    const { container } = render(<DirecaoNicho v={v} />)
    const c = container.querySelectorAll('.q-op')[2]!
    expect(c.querySelector('.q-onl')!.textContent).toBe('Vídeos novos, mesma idade')
    expect(c.querySelector('.q-onc')!.textContent).toBe('Mesma idade')
  })
})
