'use client'

import type { z } from 'zod'
import type { LinktreeConfigSchema, HighlightSchema } from '@/app/go/linktree/_lib/types'
import { CharCount, LangBadge } from './form-primitives'

type Config = z.infer<typeof LinktreeConfigSchema>
type Highlight = z.infer<typeof HighlightSchema>

interface Props {
  config: Config
  onChange: (patch: Partial<Config>) => void
  readOnly: boolean
}

export function HighlightSection({ config, onChange, readOnly }: Props) {
  const h = config.highlight

  function updateHighlight(patch: Partial<Highlight>) {
    onChange({ highlight: { ...h, ...patch } })
  }

  return (
    <section>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
        margin: '8px 0 18px',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Highlight Card</div>
          <div style={{ fontSize: '11.5px', color: 'var(--ink-dim)', marginTop: 2 }}>Destaca um lançamento no topo da árvore.</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={h.active}
          aria-label="Ativar Highlight Card"
          onClick={() => updateHighlight({ active: !h.active })}
          disabled={readOnly}
          style={{
            width: 42, height: 24, borderRadius: 99, border: 'none', padding: 3,
            background: h.active ? 'var(--accent)' : 'var(--surface-3, var(--surface-2))',
            transition: 'background 0.2s',
            display: 'flex', justifyContent: h.active ? 'flex-end' : 'flex-start',
            flexShrink: 0, cursor: 'pointer',
          }}
        >
          <span style={{ width: 18, height: 18, borderRadius: 99, background: '#fff', transition: '0.2s' }} />
        </button>
      </div>

      {h.active && (
        <div className="space-y-4">
          <div>
            <label htmlFor="highlight-url" className="mb-1 block text-xs font-medium text-foreground">URL</label>
            <input
              id="highlight-url"
              type="url"
              value={h.url}
              onChange={(e) => updateHighlight({ url: e.target.value })}
              disabled={readOnly}
              maxLength={2048}
              style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '10px 12px', color: 'var(--ink)', fontSize: 13, outline: 'none' }} className="disabled:opacity-50"
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <label htmlFor="highlight-badge-pt" className="text-xs font-medium text-foreground">Badge</label>
                <LangBadge lang="PT" />
              </div>
              <input id="highlight-badge-pt" type="text" value={h.badge_pt} onChange={(e) => updateHighlight({ badge_pt: e.target.value })} disabled={readOnly} maxLength={30}
                aria-describedby="highlight-badge-pt-count" style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '10px 12px', color: 'var(--ink)', fontSize: 13, outline: 'none' }} className="disabled:opacity-50" />
              <div className="mt-0.5 text-right"><CharCount current={h.badge_pt.length} max={30} id="highlight-badge-pt-count" /></div>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <label htmlFor="highlight-badge-en" className="text-xs font-medium text-foreground">Badge</label>
                <LangBadge lang="EN" />
              </div>
              <input id="highlight-badge-en" type="text" value={h.badge_en} onChange={(e) => updateHighlight({ badge_en: e.target.value })} disabled={readOnly} maxLength={30}
                aria-describedby="highlight-badge-en-count" style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '10px 12px', color: 'var(--ink)', fontSize: 13, outline: 'none' }} className="disabled:opacity-50" />
              <div className="mt-0.5 text-right"><CharCount current={h.badge_en.length} max={30} id="highlight-badge-en-count" /></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <label htmlFor="highlight-title-pt" className="text-xs font-medium text-foreground">Título</label>
                <LangBadge lang="PT" />
              </div>
              <input id="highlight-title-pt" type="text" value={h.title_pt} onChange={(e) => updateHighlight({ title_pt: e.target.value })} disabled={readOnly} maxLength={80}
                aria-describedby="highlight-title-pt-count" style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '10px 12px', color: 'var(--ink)', fontSize: 13, outline: 'none' }} className="disabled:opacity-50" />
              <div className="mt-0.5 text-right"><CharCount current={h.title_pt.length} max={80} id="highlight-title-pt-count" /></div>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <label htmlFor="highlight-title-en" className="text-xs font-medium text-foreground">Título</label>
                <LangBadge lang="EN" />
              </div>
              <input id="highlight-title-en" type="text" value={h.title_en} onChange={(e) => updateHighlight({ title_en: e.target.value })} disabled={readOnly} maxLength={80}
                aria-describedby="highlight-title-en-count" style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '10px 12px', color: 'var(--ink)', fontSize: 13, outline: 'none' }} className="disabled:opacity-50" />
              <div className="mt-0.5 text-right"><CharCount current={h.title_en.length} max={80} id="highlight-title-en-count" /></div>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center gap-2">
              <label htmlFor="highlight-desc-pt" className="text-xs font-medium text-foreground">Descrição</label>
              <LangBadge lang="PT" />
            </div>
            <textarea id="highlight-desc-pt" value={h.desc_pt} onChange={(e) => updateHighlight({ desc_pt: e.target.value })} disabled={readOnly} maxLength={200} rows={2}
              aria-describedby="highlight-desc-pt-count" style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '10px 12px', color: 'var(--ink)', fontSize: 13, outline: 'none' }} className="disabled:opacity-50" />
            <div className="mt-0.5 text-right"><CharCount current={h.desc_pt.length} max={200} id="highlight-desc-pt-count" /></div>
          </div>

          <div>
            <div className="mb-1 flex items-center gap-2">
              <label htmlFor="highlight-desc-en" className="text-xs font-medium text-foreground">Descrição</label>
              <LangBadge lang="EN" />
            </div>
            <textarea id="highlight-desc-en" value={h.desc_en} onChange={(e) => updateHighlight({ desc_en: e.target.value })} disabled={readOnly} maxLength={200} rows={2}
              aria-describedby="highlight-desc-en-count" style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '10px 12px', color: 'var(--ink)', fontSize: 13, outline: 'none' }} className="disabled:opacity-50" />
            <div className="mt-0.5 text-right"><CharCount current={h.desc_en.length} max={200} id="highlight-desc-en-count" /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <label htmlFor="highlight-cta-pt" className="text-xs font-medium text-foreground">CTA</label>
                <LangBadge lang="PT" />
              </div>
              <input id="highlight-cta-pt" type="text" value={h.cta_pt} onChange={(e) => updateHighlight({ cta_pt: e.target.value })} disabled={readOnly} maxLength={40}
                aria-describedby="highlight-cta-pt-count" style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '10px 12px', color: 'var(--ink)', fontSize: 13, outline: 'none' }} className="disabled:opacity-50" />
              <div className="mt-0.5 text-right"><CharCount current={h.cta_pt.length} max={40} id="highlight-cta-pt-count" /></div>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <label htmlFor="highlight-cta-en" className="text-xs font-medium text-foreground">CTA</label>
                <LangBadge lang="EN" />
              </div>
              <input id="highlight-cta-en" type="text" value={h.cta_en} onChange={(e) => updateHighlight({ cta_en: e.target.value })} disabled={readOnly} maxLength={40}
                aria-describedby="highlight-cta-en-count" style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '10px 12px', color: 'var(--ink)', fontSize: 13, outline: 'none' }} className="disabled:opacity-50" />
              <div className="mt-0.5 text-right"><CharCount current={h.cta_en.length} max={40} id="highlight-cta-en-count" /></div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
