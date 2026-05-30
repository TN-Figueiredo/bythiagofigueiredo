'use client'

import type { z } from 'zod'
import type { LinktreeConfigSchema } from '@/app/go/linktree/_lib/types'
import { CharCount, LangBadge } from './form-primitives'

type Config = z.infer<typeof LinktreeConfigSchema>

interface Props {
  config: Config
  onChange: (patch: Partial<Config>) => void
  readOnly: boolean
}

export function GeneralSection({ config, onChange, readOnly }: Props) {
  return (
    <section>
      <div className="eyebrow" style={{ marginBottom: 14, fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Geral</div>
      <div className="space-y-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <label htmlFor="tagline-pt" style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)' }}>Tagline</label>
            <LangBadge lang="PT" />
            <span className="text-[10px] text-red-400">*</span>
          </div>
          <input
            id="tagline-pt"
            type="text"
            value={config.tagline_pt}
            onChange={(e) => onChange({ tagline_pt: e.target.value })}
            disabled={readOnly}
            maxLength={120}
            aria-required="true"
            aria-describedby="tagline-pt-count"
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '10px 12px', color: 'var(--ink)', fontSize: 13, outline: 'none' }}
            className="disabled:opacity-50"
            placeholder="Ex: Reflexões sobre tecnologia, fé e propósito"
          />
          <div className="mt-0.5 text-right">
            <CharCount current={config.tagline_pt.length} max={120} id="tagline-pt-count" />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2">
            <label htmlFor="tagline-en" style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)' }}>Tagline</label>
            <LangBadge lang="EN" />
            <span className="text-[10px] text-red-400">*</span>
          </div>
          <input
            id="tagline-en"
            type="text"
            value={config.tagline_en}
            onChange={(e) => onChange({ tagline_en: e.target.value })}
            disabled={readOnly}
            maxLength={120}
            aria-required="true"
            aria-describedby="tagline-en-count"
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '10px 12px', color: 'var(--ink)', fontSize: 13, outline: 'none' }}
            className="disabled:opacity-50"
            placeholder="Ex: Reflections on technology, faith, and purpose"
          />
          <div className="mt-0.5 text-right">
            <CharCount current={config.tagline_en.length} max={120} id="tagline-en-count" />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2">
            <label htmlFor="blog-desc-pt" style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)' }}>Descrição do Blog</label>
            <LangBadge lang="PT" />
          </div>
          <textarea
            id="blog-desc-pt"
            value={config.blog_desc_pt}
            onChange={(e) => onChange({ blog_desc_pt: e.target.value })}
            disabled={readOnly}
            maxLength={300}
            rows={3}
            aria-describedby="blog-desc-pt-count"
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '10px 12px', color: 'var(--ink)', fontSize: 13, outline: 'none' }}
            className="disabled:opacity-50"
            placeholder="Descrição exibida na seção de blog da linktree"
          />
          <div className="mt-0.5 text-right">
            <CharCount current={config.blog_desc_pt.length} max={300} id="blog-desc-pt-count" />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2">
            <label htmlFor="blog-desc-en" style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)' }}>Descrição do Blog</label>
            <LangBadge lang="EN" />
          </div>
          <textarea
            id="blog-desc-en"
            value={config.blog_desc_en}
            onChange={(e) => onChange({ blog_desc_en: e.target.value })}
            disabled={readOnly}
            maxLength={300}
            rows={3}
            aria-describedby="blog-desc-en-count"
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '10px 12px', color: 'var(--ink)', fontSize: 13, outline: 'none' }}
            className="disabled:opacity-50"
            placeholder="Description shown in the blog section of the linktree"
          />
          <div className="mt-0.5 text-right">
            <CharCount current={config.blog_desc_en.length} max={300} id="blog-desc-en-count" />
          </div>
        </div>
      </div>
    </section>
  )
}
