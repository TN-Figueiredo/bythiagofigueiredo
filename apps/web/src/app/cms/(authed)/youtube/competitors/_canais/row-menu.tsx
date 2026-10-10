'use client'
/**
 * The row menu ⋯ of Canais (canais.html #menu). Its position, its outside click and its Esc belong to the floating
 * layer (`_chrome/flut`): the menu renders in #flut, a child of <body>, so no ancestor of the CMS shell captures its
 * `position: fixed` (in production one threw it ~495 px to the right of the button).
 */
import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { CanaisRow } from './view-model'
import { useCanAdminSite, siteAdminOnlyText } from '@/lib/cms/site-admin-context'
import { Popover } from '../_chrome/flut/flut'

/** The ⋯ button of a channel in whichever view is on screen (table row or card). */
export const rowMenuButton = (id: string) => document.querySelector<HTMLElement>(`[data-obs-screen="canais"] [data-menu="${CSS.escape(id)}"]`)

export function RowMenu({ row, onClose, onOpen, onSync, onYoutube, onCopy, onRemove }: {
  row: CanaisRow
  /** Closes the menu; `focus` sends the focus back to the ⋯ button. */
  onClose: (focus: boolean) => void
  onOpen: () => void; onSync: () => void; onYoutube: () => void; onCopy: () => void; onRemove: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // "Administrar o site" step: removing a channel is for admins; an editor reads why instead of a dead button.
  const canAdminSite = useCanAdminSite()

  // the first item takes the focus when the menu opens (menu button pattern)
  useEffect(() => { ref.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus({ preventScroll: true }) }, [row.id])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])')]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus() }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus() }
    if (e.key === 'Home') { e.preventDefault(); items[0]?.focus() }
    if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus() }
    // Tab / Shift+Tab: the floating layer stitches the menu back to the ⋯ button (flut/store.ts)
  }

  return (
    <Popover open anchor={() => rowMenuButton(row.id)} onClose={() => onClose(false)} className="cn-menu" role="menu" label="Ações do canal" align="fim" gap={4}>
      <div ref={ref} data-menu-for={row.id} onKeyDown={onKey}>
        <button type="button" role="menuitem" onClick={onOpen}>Abrir detalhes</button>
        <button type="button" role="menuitem" disabled={row.backfill} title={row.backfill ? 'Ainda buscando vídeos: a sincronização só depois da busca' : undefined} onClick={onSync}>Sincronizar só este canal</button>
        <button type="button" role="menuitem" onClick={onYoutube}>Abrir no YouTube</button>
        <button type="button" role="menuitem" onClick={onCopy}><span className="cw">Copiar pedido para o Cowork</span></button>
        <hr />
        {canAdminSite
          ? <button type="button" role="menuitem" className="del" onClick={onRemove}>Remover canal…</button>
          : <p role="note" data-testid="admin-only-note" style={{ margin: 0, padding: '6px 12px', maxWidth: 220, fontSize: 11, lineHeight: 1.35, color: 'var(--muted)' }}>{siteAdminOnlyText('remover um canal')}</p>}
      </div>
    </Popover>
  )
}
