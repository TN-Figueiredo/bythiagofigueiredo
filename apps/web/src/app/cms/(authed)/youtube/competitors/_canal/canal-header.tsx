'use client'
/**
 * Cabeçalho da página do canal (spec 5.3, mockup canal.html + faixa-numeros.js): avatar, nome, nicho, @, "Abrir no YouTube" e o
 * menu ⋯; a faixa de seis números; a linha de sincronização com o ⓘ e "Todos os números"; as doze células abaixo dela.
 * Nenhum botão preenchido. O menu e o ⓘ são Popover de #flut (nunca filhos desta tela). Dado ausente mostra a frase na
 * classe obs-ch-nm, nunca "0" nem "—"; zero medido é "0". Estado (aberto/fechado, rodando) é da CanalScreen.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import type { Niche } from '@/lib/youtube/observatorio/niche'
import { siteAdminOnlyText } from '@/lib/cms/site-admin-context'
import { ChannelAvatar } from '../_chrome/channel-avatar'
import { Popover } from '../_chrome/flut/flut'
import { Icon } from '../_chrome/icons'
import { NicheSelect } from '../_canais/niche-editor'
import type { CanalHeaderView, NumCell } from './header-model'

const Ext = () => (
  <svg className="i" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M9 3h4v4M13 3L7.5 8.5M12 9.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.5" /></svg>
)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function Cell({ c }: { c: NumCell }) {
  // no DOM o valor vem antes do rótulo ("84 mil inscritos"); na tela os dois ficam um sobre o outro
  return (
    <div className="nc">
      {c.value != null
        ? <dd><b className="num">{c.value}</b>{c.n ? <small className="num"> {c.n}</small> : null}</dd>
        : <dd className="nf"><span className="obs-ch-nm">{c.missing}</span></dd>}
      <dt>{c.label}</dt>
    </div>
  )
}

/** Itens do menu ⋯: setas, Home e End andam entre eles; o primeiro recebe o foco ao abrir (padrão menu button). */
function MenuItems({ syncing, canAdmin, onSync, onRemove }: { syncing: boolean; canAdmin: boolean; onSync: () => void; onRemove: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true }) }, [])
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    const i = items.indexOf(document.activeElement as HTMLElement)
    const go = (j: number) => { e.preventDefault(); items[(j + items.length) % items.length]?.focus() }
    if (e.key === 'ArrowDown') go(i + 1)
    else if (e.key === 'ArrowUp') go(i - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(items.length - 1)
    // Tab / Shift+Tab: a camada flutuante costura o menu de volta ao botão ⋯ (flut/store.ts)
  }
  return (
    <div ref={ref} onKeyDown={onKey}>
      <button type="button" role="menuitem" aria-disabled={syncing ? true : undefined} onClick={() => { if (!syncing) onSync() }}>Sincronizar só este canal</button>
      {canAdmin ? (
        <>
          <hr />
          <button type="button" role="menuitem" className="del" onClick={onRemove}>Remover canal…</button>
        </>
      ) : <><hr /><p role="note">{siteAdminOnlyText('remover um canal')}</p></>}
    </div>
  )
}

export function CanalHeader({ h, nums, syncing, canAdmin, menuBtnRef, onToggleNums, onSync, onAskRemove, onNiche }: {
  h: CanalHeaderView; nums: boolean; syncing: boolean; canAdmin: boolean
  menuBtnRef: RefObject<HTMLButtonElement | null>
  onToggleNums: () => void; onSync: () => void; onAskRemove: () => void; onNiche: (n: Niche) => void
}) {
  const [menu, setMenu] = useState(false)
  const [tip, setTip] = useState(false)
  const tipBtn = useRef<HTMLButtonElement>(null)
  const cells = nums ? [...h.faixa, ...h.todos] : h.faixa
  const tone = h.sync.tone === 'warn' ? ' warn' : h.sync.tone === 'danger' ? ' err' : ''
  return (
    <header className="chead">
      <ChannelAvatar src={h.avatar} ini={h.ini} color={h.color} className="av" />
      <div className="l1">
        <h1>{h.name}</h1>
        <NicheSelect id={h.id} name={h.name} niche={h.niche} ctx="canal" onChange={onNiche} />
        {h.handle ? (
          <a className="handle" href={h.url} target="_blank" rel="noopener noreferrer">{h.handle}<Ext /><span className="obs-ch-sr"> (abre em nova aba)</span></a>
        ) : null}
      </div>
      <div className="acts">
        <a className="obs-ch-btn" href={h.url} target="_blank" rel="noopener noreferrer">Abrir no YouTube<Ext /><span className="obs-ch-sr"> (abre em nova aba)</span></a>
        <button ref={menuBtnRef} type="button" className="obs-ch-btn obs-ch-ghost obs-ch-icon" aria-haspopup="menu" aria-expanded={menu} aria-label="Ações do canal"
          onClick={() => setMenu(o => !o)}
          onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setMenu(true) } }}>
          {Icon.dots()}
        </button>
        <Popover open={menu} anchor={() => menuBtnRef.current} onClose={() => setMenu(false)} role="menu" label="Ações do canal" className="canal-menu" align="fim" gap={4}>
          <MenuItems syncing={syncing} canAdmin={canAdmin}
            onSync={() => { setMenu(false); menuBtnRef.current?.focus(); onSync() }}
            onRemove={() => { setMenu(false); onAskRemove() }} />
        </Popover>
      </div>

      <div className="nrow">
        <div className="nclip">
          <dl className="nstrip" aria-label="Números do canal">{h.faixa.map(c => <Cell key={c.key} c={c} />)}</dl>
        </div>
      </div>

      <div className="lrow">
        <p className={'l3' + tone}>
          {tone ? Icon.warn() : null}
          <span>{syncText(h.sync)}</span>
        </p>
        <div className="ntools">
          <button ref={tipBtn} type="button" className="ibtn" aria-expanded={tip} aria-controls="canal-tip" aria-label="De onde vêm os números do canal" onClick={() => setTip(o => !o)}>
            {Icon.info()}
          </button>
          <button type="button" className="nmore" aria-expanded={nums} aria-controls="canal-nums2" onClick={onToggleNums}>
            Todos os números{Icon.chev()}
          </button>
          <Popover open={tip} anchor={() => tipBtn.current} onClose={() => setTip(false)} id="canal-tip" role="dialog" labelledBy="canal-tip-t" className="canal-tip" pref="baixo" align="fim" maxW={380}>
            <h3 id="canal-tip-t">De onde vêm os números do canal</h3>
            <ul>{cells.map(c => <li key={c.key}><b>{cap(c.label)}:</b> {c.base}</li>)}</ul>
            {nums ? null : <p className="m">Abra “Todos os números” para ver a base dos outros {h.todos.length}.</p>}
          </Popover>
        </div>
      </div>

      <div className="nclip n2" id="canal-nums2" hidden={!nums}>
        <dl className="nstrip" aria-label="Mais números do canal">{h.todos.map(c => <Cell key={c.key} c={c} />)}</dl>
      </div>
    </header>
  )
}

/** A frase de sincronização, com o instante dentro de <time datetime>; o texto lido é o mesmo de sync.text. */
function syncText(s: CanalHeaderView['sync']): ReactNode {
  const i = s.at != null && s.atText != null ? s.text.indexOf(s.atText) : -1
  if (i < 0 || s.at == null || s.atText == null) return s.text
  return <>{s.text.slice(0, i)}<time dateTime={s.at}>{s.atText}</time>{s.text.slice(i + s.atText.length)}</>
}
