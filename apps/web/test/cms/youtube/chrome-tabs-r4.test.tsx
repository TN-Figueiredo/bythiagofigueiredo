// @vitest-environment jsdom
// F3 T8 r4 (D2b): trilha ocupa a linha inteira em contêiner estreito; rolagem por rect é só reforço.
import { cleanup, render } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Tabs } from '@/app/cms/(authed)/youtube/competitors/_chrome/tabs'
import type { ChromeView } from '@/app/cms/(authed)/youtube/competitors/_chrome/view-model'

vi.mock('next/link', () => ({ default: ({ children, href, ...r }: { children: React.ReactNode; href: string }) => <a href={href} {...r}>{children}</a> }))
afterEach(cleanup)

const css = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_chrome/chrome.css'), 'utf8')

describe('regra CSS', () => {
  it('abaixo de 480 px de contêiner a trilha ocupa a linha e o nicho desce', () => {
    const m = css.match(/@container obscontent \(max-width: 480px\)\{([\s\S]*?)\n\}/)
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/\.obs-ch-tabs[^{]*\{flex:1 1 100%/)
    expect(m![1]).toMatch(/\.obs-ch-niche[^{]*\{flex:1 1 100%/)
    expect(m![1]).toMatch(/flex-wrap:wrap/)
  })
})

function rect(l: number, r: number): DOMRect { return { left: l, right: r, top: 0, bottom: 40, width: r - l, height: 40, x: l, y: 0, toJSON() {} } }

describe('rolagem por rect', () => {
  const tabs: ChromeView['tabs'] = [
    { key: 'canais', label: 'Canais', href: '/a', current: false, count: 3, title: 't' },
    { key: 'sugestoes', label: 'Sugestões', href: '/b', current: false, count: 2, title: 't' },
  ]
  function mount(atual: boolean, sugR: number, curL = 10, curR = 80, nav = rect(0, 111), sugL = 28, atualKey: 'canais' | 'sugestoes' = 'canais') {
    const proto = HTMLElement.prototype
    const orig = proto.getBoundingClientRect
    proto.getBoundingClientRect = function (this: HTMLElement) {
      if (this.tagName === 'NAV') return nav
      if (this.dataset.tab === 'sugestoes') return rect(sugL, sugR)
      if (this.dataset.tab === 'canais') return rect(curL, curR)
      return orig.call(this)
    }
    const t: ChromeView['tabs'] = atual ? tabs.map(x => (x.key === atualKey ? { ...x, current: true } : x)) : tabs
    const { container } = render(<Tabs tabs={t} />)
    proto.getBoundingClientRect = orig
    return container.querySelector('nav') as HTMLElement
  }
  it('sem aba atual, rola até Sugestões caber', () => {
    expect(mount(false, 157).scrollLeft).toBe(157 - 111 + 8)
  })
  it('aba atual inteira visível mantém, e Sugestões só rola se a atual continuar inteira', () => {
    expect(mount(true, 157, 60, 100).scrollLeft).toBe(54)
    expect(mount(true, 157, 10, 80).scrollLeft).toBe(0)
  })
  it('r4 do Gio: em /sugestoes, com a trilha larga e Sugestões cabendo, a trilha fica no começo (Canais à vista)', () => {
    expect(mount(true, 252, 28, 119, rect(28, 362), 123, 'sugestoes').scrollLeft).toBe(0)
  })
  it('a aba atual que não cabe é trazida para a vista', () => {
    expect(mount(true, 252, 28, 119, rect(28, 139), 123, 'sugestoes').scrollLeft).toBe(252 - 28 - 111 + 8)
  })
})
