// @vitest-environment jsdom
// E5a T21b: as raias e o gráfico por dia ganham os acréscimos (faixas da subida, "saiu", 24/08, "Outras", forma por semana) sem tocar no que existe.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildHistoricoView, type AcrescimosDoGrafico } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { Timeline } from '@/app/cms/(authed)/youtube/competitors/_historico/views-chart'
import { acrescimosDoGrafico, contagemPorSemana, LEGENDA_DE_OUTRAS } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/dias-model'
import { numerarMudancas } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/mudancas-model'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/video/x',
  useSearchParams: () => new URLSearchParams(''),
}))
afterEach(() => { document.getElementById('flut')?.remove() })

const oracle = loadOracle()
const obs = createObservatory(datasetFromOracle(oracle))
const view = buildHistoricoView(obs, 'matt-opus55', {})
const noop = () => undefined
const DAY = 864e5
const PUB = Date.UTC(2026, 9, 1, 15)

function montar(acrescimos: AcrescimosDoGrafico | null) {
  if (!view.chart) throw new Error('o vídeo do oráculo precisa de gráfico')
  return render(<Timeline chart={view.chart} lanes={view.lanes} legend={view.legends[''] ?? []} pair={null} hl={null} onHl={noop} onSelectPair={noop} onGoVersion={noop} acrescimos={acrescimos} />)
}
const mud = (h: number, campos: Array<'tags' | 'descricao'>) => ({ campos, deMs: PUB + (h - 1) * 36e5, ateMs: PUB + h * 36e5, precisao: 'min' as const })
const acr = (o: Partial<Parameters<typeof acrescimosDoGrafico>[0]> = {}) => acrescimosDoGrafico({
  publicadoEmMs: PUB, subidaDia: '2026-10-10', saiuEm: null, eixo: { de: '2026-10-01', ate: '2026-10-20' }, mudancas: numerarMudancas([mud(30, ['tags']), mud(31, ['tags']), mud(400, ['descricao'])]), semanal: null, ...o,
})

describe('E5a T21b, raias e gráfico por dia', () => {
  it('sem acréscimos o gráfico é o de hoje: a raia da descrição continua "Descrição" e nada novo aparece', () => {
    const { container } = montar(null)
    expect(container.querySelector('[data-lane="desc"] .lane-l')?.textContent).toBe('Descrição')
    expect(container.querySelector('[data-faixa],[data-linha],[data-outras-marca],[data-forma-por-semana]')).toBeNull()
    expect(container.textContent).not.toContain(LEGENDA_DE_OUTRAS)
  })
  it('a raia "Outras" junta os cinco tipos e a legenda diz quais; o campo continua `desc`', () => {
    const { container } = montar(acr())
    expect(container.querySelector('[data-lane="desc"] .lane-l')?.textContent).toBe('Outras')
    expect(container.textContent).toContain('outras (descrição, tags, categoria, duração, capítulos)')
    expect(container.querySelector('[data-lane="outras"]')).toBeNull()
  })
  it('marcas de Outras a menos de 26 px viram "×N" e cada uma tem o texto no aria-label', () => {
    const { container } = montar(acr())
    const marcas = [...container.querySelectorAll('[data-outras-marca]')]
    expect(marcas.length).toBeGreaterThan(0)
    for (const m of marcas) expect(m.getAttribute('aria-label')).toMatch(/Mudança \d/)
  })
  it('as faixas da subida e dos 14 dias antes, a linha de "saiu" com o resto pontilhado e a de 24/08', () => {
    const { container } = montar(acr({ saiuEm: '2026-10-15', eixo: { de: '2026-08-20', ate: '2026-10-20' } }))
    expect(container.querySelector('[data-faixa="subida"]')).not.toBeNull()
    expect(container.querySelector('[data-faixa="antes"]')).not.toBeNull()
    expect(container.querySelector('[data-linha="saiu"]')).not.toBeNull()
    expect(container.querySelector('[data-resto-pontilhado]')).not.toBeNull()
    expect(container.querySelector('[data-linha="corte"]')).not.toBeNull()
  })
  it('a faixa da subida cobre 7 dias a partir da borda direita do dia da subida', () => {
    const a = acr()
    expect(a.faixaSubida!.ateH - a.faixaSubida!.deH).toBeCloseTo(7 * 24, 6)
    expect(a.faixaAntes!.ateH).toBeCloseTo(a.faixaSubida!.deH - 24, 6)
    expect(a.faixaAntes!.ateH - a.faixaAntes!.deH).toBeCloseTo(14 * 24, 6)
  })
  it('contagem por semana: no lugar das barras por dia, sem o desenho do gráfico de hoje', () => {
    const sem = contagemPorSemana([0, 1, 2].map((k) => ({ t: PUB + 7 * k * DAY, views: 100 + 40 * k })), PUB - 3 * DAY)
    const { container } = montar(acr({ semanal: sem }))
    expect(container.querySelector('[data-forma-por-semana]')).not.toBeNull()
    expect(container.querySelector('svg.hv-chart')).toBeNull()
    expect(container.querySelector('.gl-barra')).toBeNull()
  })
  it('LaneType continua com `desc` e os arquivos que a 21b não lista não mudaram', () => {
    const dir = path.join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_historico')
    expect(fs.readFileSync(path.join(dir, 'view-model.ts'), 'utf8')).toContain("export type LaneType = 'title' | 'thumb' | 'desc'")
    for (const f of ['versions.tsx']) expect(fs.readFileSync(path.join(dir, f), 'utf8'), f).toContain("'desc'")
  })
})
