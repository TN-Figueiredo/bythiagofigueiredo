// @vitest-environment jsdom
// Mudanças: the line "parte de N trocas em sequência" and its definition (plan 2026-10-07-observatorio-historico-muitas-versoes, Task 10).
import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from '@testing-library/react'
import { loadFase4, VID } from './fase4-world'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildMudancasView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'
import { VideoGroup } from '@/app/cms/(authed)/youtube/competitors/_mudancas/change-hero'
import { PinProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/pin-kit'

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/x', useSearchParams: () => new URLSearchParams('') }))

const heroes = (obs: ReturnType<typeof createObservatory>, video: string) => buildMudancasView(obs, { video, win: '90' }, new Set()).heroes
function card(obs: ReturnType<typeof createObservatory>, video: string) {
  const hs = heroes(obs, video)
  return render(<PinProvider><VideoGroup heroes={hs} swipeOf={() => ({ saved: false, label: 'Salvar no swipe file', busy: false, disabled: false })} onSwipe={() => {}} /></PinProvider>).container
}

describe('view model', () => {
  it('estado 6a: cada troca de thumbnail da sequência traz a linha; a de título não', () => {
    const { ds } = loadFase4(), hs = heroes(createObservatory(ds), VID.open)
    expect(hs.map(h => [h.type, h.when.run])).toEqual([
      ['thumb', 'parte de 5 trocas em sequência em 9 dias'], ['thumb', 'parte de 5 trocas em sequência em 9 dias'], ['thumb', 'parte de 5 trocas em sequência em 9 dias'],
      ['title', null], ['thumb', 'parte de 5 trocas em sequência em 9 dias'], ['thumb', 'parte de 5 trocas em sequência em 9 dias']])
    expect(hs[0]!.runNote).toBe('Trocas em sequência: trocas do mesmo campo com até 14 dias entre uma e outra. Pode ser um teste; o YouTube não informa.')
    expect(hs[3]!.runNote).toBeNull()
  })
  it('estado 1: vídeo sem sequência fica como hoje', () => {
    const { ds } = loadFase4()
    expect(heroes(createObservatory(ds), VID.few).map(h => [h.when.run, h.runNote])).toEqual([[null, null], [null, null]])
  })
  it('estado 6c, o dado não existe: testRun ausente não vira linha nem definição', () => {
    const { ds } = loadFase4(), obs = createObservatory(ds)
    for (const c of obs.changes) delete c.testRun
    expect(heroes(obs, VID.open).map(h => [h.when.run, h.runNote])).toEqual(Array.from({ length: 6 }, () => [null, null]))
  })
  it('a contagem "Nª de M trocas deste vídeo" continua, ao lado da linha nova', () => {
    const { ds } = loadFase4(), hs = heroes(createObservatory(ds), VID.open)
    expect(hs[0]!.when.seq).toBe('6ª de 6 trocas deste vídeo')
  })
})

describe('cartão', () => {
  it('a linha aparece em cada troca da sequência e a definição, com a ressalva, UMA vez no cabeçalho', () => {
    const { ds } = loadFase4(), c = card(createObservatory(ds), VID.open)
    expect(c.querySelectorAll('.chg [data-run]').length).toBe(5)
    expect(c.querySelector('.chg [data-run]')!.textContent).toBe('parte de 5 trocas em sequência em 9 dias')
    const notes = c.querySelectorAll('[data-run-note]')
    expect(notes.length).toBe(1)
    expect(notes[0]!.closest('.vid-h')).not.toBeNull()
    expect(notes[0]!.textContent).toBe('Trocas em sequência: trocas do mesmo campo com até 14 dias entre uma e outra. Pode ser um teste; o YouTube não informa.')
  })
  it('sem sequência: nem linha nem definição', () => {
    const { ds } = loadFase4(), c = card(createObservatory(ds), VID.few)
    expect([c.querySelectorAll('[data-run]').length, c.querySelectorAll('[data-run-note]').length]).toEqual([0, 0])
  })
  it('o oráculo de 02/10: matt-opus55 ganha a linha (3 trocas de thumbnail em 5 dias; 2 de título em 7)', () => {
    const obs = createObservatory(datasetFromOracle(loadOracle()))
    expect(heroes(obs, 'matt-opus55').map(h => h.when.run).filter(Boolean).sort()).toEqual(['parte de 2 trocas em sequência em 7 dias', 'parte de 2 trocas em sequência em 7 dias', 'parte de 3 trocas em sequência em 5 dias', 'parte de 3 trocas em sequência em 5 dias', 'parte de 3 trocas em sequência em 5 dias'])
  })
})

describe('folha de estilo', () => {
  const css = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/app/cms/(authed)/youtube/competitors/_mudancas/mudancas.css'), 'utf8')
  it('a linha e a definição têm regra dentro da tela, sem color-mix()', () => {
    expect(css).toMatch(/\[data-obs-screen="mudancas"\] \.when \.seq\.run\{/)
    expect(css).toMatch(/\[data-obs-screen="mudancas"\] \.seqnote\{/)
    expect(css.includes('color-mix')).toBe(false)
  })
  it('a linha não herda a caixa de ".run" da seção YouTube (youtube-motion.css): borda, fundo e respiro zerados', () => {
    const youtube = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/app/cms/(authed)/youtube/youtube-motion.css'), 'utf8')
    expect(youtube).toMatch(/\[data-cms-section="youtube"\] \.run \{/)
    const r = css.split('\n').find(l => l.startsWith('[data-obs-screen="mudancas"] .when .seq.run{')) ?? ''
    for (const d of ['border:0', 'background:none', 'padding:0']) expect(r.includes(d), d).toBe(true)
  })
  it('a coluna da data só alarga acima de 1180 px: o ajuste de 1001 a 1180 px continua valendo', () => {
    expect(css).toMatch(/@media \(min-width:1181px\)\{ \[data-obs-screen="mudancas"\] \.chg\{grid-template-columns:190px minmax\(0,1fr\) 340px\} \}/)
    expect(css).toMatch(/@media \(max-width:1180px\)\{ \[data-obs-screen="mudancas"\] \.chg\{grid-template-columns:150px minmax\(0,1fr\) 290px\}/)
  })
})
