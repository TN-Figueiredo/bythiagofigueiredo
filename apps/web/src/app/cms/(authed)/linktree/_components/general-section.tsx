'use client'

import type { z } from 'zod'
import type { LinktreeConfigSchema } from '@/app/go/linktree/_lib/types'

type Config = z.infer<typeof LinktreeConfigSchema>

interface Props {
  config: Config
  onChange: (patch: Partial<Config>) => void
  readOnly: boolean
}

function CharCount({ current, max }: { current: number; max: number }) {
  return (
    <span className={`text-[10px] ${current > max ? 'text-red-400' : 'text-muted-foreground'}`}>
      {current}/{max}
    </span>
  )
}

function LangBadge({ lang }: { lang: 'PT' | 'EN' }) {
  const colors = lang === 'PT' ? 'bg-green-500/10 text-green-400' : 'bg-cyan-500/10 text-cyan-400'
  return <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${colors}`}>{lang}</span>
}

export function GeneralSection({ config, onChange, readOnly }: Props) {
  return (
    <section>
      <h2 className="mb-4 text-sm font-bold text-foreground">Geral</h2>
      <div className="space-y-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <label className="text-xs font-medium text-foreground">Tagline</label>
            <LangBadge lang="PT" />
            <span className="text-[10px] text-red-400">*</span>
          </div>
          <input
            type="text"
            value={config.tagline_pt}
            onChange={(e) => onChange({ tagline_pt: e.target.value })}
            disabled={readOnly}
            maxLength={120}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
            placeholder="Ex: Reflexões sobre tecnologia, fé e propósito"
          />
          <div className="mt-0.5 text-right">
            <CharCount current={config.tagline_pt.length} max={120} />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2">
            <label className="text-xs font-medium text-foreground">Tagline</label>
            <LangBadge lang="EN" />
            <span className="text-[10px] text-red-400">*</span>
          </div>
          <input
            type="text"
            value={config.tagline_en}
            onChange={(e) => onChange({ tagline_en: e.target.value })}
            disabled={readOnly}
            maxLength={120}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
            placeholder="Ex: Reflections on technology, faith, and purpose"
          />
          <div className="mt-0.5 text-right">
            <CharCount current={config.tagline_en.length} max={120} />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2">
            <label className="text-xs font-medium text-foreground">Descrição do Blog</label>
            <LangBadge lang="PT" />
          </div>
          <textarea
            value={config.blog_desc_pt}
            onChange={(e) => onChange({ blog_desc_pt: e.target.value })}
            disabled={readOnly}
            maxLength={300}
            rows={3}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
            placeholder="Descrição exibida na seção de blog da linktree"
          />
          <div className="mt-0.5 text-right">
            <CharCount current={config.blog_desc_pt.length} max={300} />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2">
            <label className="text-xs font-medium text-foreground">Descrição do Blog</label>
            <LangBadge lang="EN" />
          </div>
          <textarea
            value={config.blog_desc_en}
            onChange={(e) => onChange({ blog_desc_en: e.target.value })}
            disabled={readOnly}
            maxLength={300}
            rows={3}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
            placeholder="Description shown in the blog section of the linktree"
          />
          <div className="mt-0.5 text-right">
            <CharCount current={config.blog_desc_en.length} max={300} />
          </div>
        </div>
      </div>
    </section>
  )
}
