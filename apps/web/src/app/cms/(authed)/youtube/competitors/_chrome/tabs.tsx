'use client'
/** Observatório tabs: links with counts, title= and aria-current (port of chrome.js navHtml tabs + fitTabs/tabFades). */
import Link from 'next/link'
import { useCallback, useEffect, useRef } from 'react'
import type { ChromeView } from './view-model'

export function Tabs({ tabs }: { tabs: ChromeView['tabs'] }) {
  const ref = useRef<HTMLElement>(null)
  // fades on the rail edges: right = more tabs after, left = scrolled (scrollLeft > 0)
  const fades = useCallback(() => {
    const tb = ref.current
    if (!tb) return
    tb.classList.toggle('obs-ch-more', tb.scrollLeft + tb.clientWidth < tb.scrollWidth - 2)
    tb.classList.toggle('obs-ch-less', tb.scrollLeft > 2)
  }, [])
  useEffect(() => {
    const tb = ref.current
    if (!tb) return
    // contas por getBoundingClientRect (independe do offsetParent), em coordenadas do conteúdo da trilha; rola a própria trilha, nunca a página.
    // Refeita quando a trilha muda de largura (a regra de contêiner pode chegar depois da montagem; r4 do Gio: rolava para 95 com a trilha ainda estreita).
    const ajustar = () => {
      const tr = tb.getBoundingClientRect(), w = tr.width
      const pos = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return { l: r.left - tr.left + tb.scrollLeft, r: r.right - tr.left + tb.scrollLeft } }
      let alvo = 0
      // a aba atual inteira visível; se já cabe sem rolar, a trilha fica no começo (Canais à vista)
      const cur = tb.querySelector<HTMLElement>('[aria-current]')
      const c = cur ? pos(cur) : null
      if (c && c.r + 8 > w) alvo = c.r - w + 8
      // plano B (D2b), só reforço: a aba Sugestões com contador não fica cortada, desde que a aba atual continue inteira visível
      const sug = tb.querySelector<HTMLElement>('[data-tab="sugestoes"]')
      if (sug && sug.querySelector('[data-count]')) {
        const need = pos(sug).r - w + 8
        if (need > alvo && (!c || c.l >= need)) alvo = need
      }
      tb.scrollLeft = alvo
      fades()
    }
    ajustar()
    tb.addEventListener('scroll', fades, { passive: true })
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(ajustar) : null
    ro?.observe(tb)
    return () => { tb.removeEventListener('scroll', fades); ro?.disconnect() }
  }, [tabs, fades])
  return (
    <nav className="obs-ch-tabs" aria-label="Seções do Observatório" ref={ref}>
      {tabs.map(t => {
        const sug = t.key === 'sugestoes'
        return (
          <Link key={t.key} className="obs-ch-tab" href={t.href} data-tab={t.key} aria-current={t.current ? 'page' : undefined} title={t.title}
            style={sug ? { minHeight: 44 } : undefined}>
            {t.label}
            {t.countText != null || t.count != null ? (
              <span className="obs-ch-ct" data-count={t.key} style={sug ? { fontSize: 12, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' } : undefined}
                {...(t.ariaLabel ? { role: 'img', 'aria-label': t.ariaLabel } : {})}>
                {t.velho ? <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" data-velho="1" style={{ color: 'var(--warning-text)', marginRight: 3, verticalAlign: '-1px' }}><path d="M8 1.5 15 14H1L8 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M8 6v4M8 11.6v.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg> : null}
                {t.countText ?? t.count}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
