'use client'

import { useState, useTransition } from 'react'
import type { SocialTemplate } from '@/lib/social/template-schemas'
import {
  updateSocialDefaults,
  type SocialDefaults,
  type SocialContentType,
  type SocialPlatform,
} from '@/lib/social/actions/settings'

interface TemplateMatrixProps {
  siteId: string
  templates: SocialTemplate[]
  defaults: SocialDefaults
}

const CONTENT_TYPES: { key: SocialContentType; label: string }[] = [
  { key: 'blog', label: 'Blog Post' },
  { key: 'newsletter', label: 'Newsletter' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'video', label: 'Video' },
]

const PLATFORMS: { key: SocialPlatform; label: string; ratios: string[] }[] = [
  { key: 'facebook', label: 'Facebook', ratios: ['16:9'] },
  { key: 'instagram', label: 'Instagram', ratios: ['9:16', '1:1'] },
  { key: 'bluesky', label: 'Bluesky', ratios: ['16:9'] },
]

export function TemplateMatrix({ siteId, templates, defaults: initialDefaults }: TemplateMatrixProps) {
  const [defaults, setDefaults] = useState<SocialDefaults>(initialDefaults)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function getKey(contentType: SocialContentType, platform: SocialPlatform): string {
    return `${contentType}:${platform}`
  }

  function getCompatibleTemplates(platform: SocialPlatform): SocialTemplate[] {
    const platformConfig = PLATFORMS.find(p => p.key === platform)
    if (!platformConfig) return []
    return templates.filter(t => platformConfig.ratios.includes(t.aspect_ratio))
  }

  function handleChange(contentType: SocialContentType, platform: SocialPlatform, templateId: string) {
    const key = getKey(contentType, platform)
    const next = { ...defaults }
    if (templateId === '') {
      delete next[key]
    } else {
      next[key] = templateId
    }
    setDefaults(next)
    setSaved(false)
  }

  function handleSave() {
    const entries = Object.entries(defaults).map(([key, templateId]) => {
      const [contentType, platform] = key.split(':') as [SocialContentType, SocialPlatform]
      return { contentType, platform, templateId }
    })

    startTransition(async () => {
      const result = await updateSocialDefaults(siteId, { entries })
      if (result.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-cms-text">Template Defaults</h3>
          <p className="text-xs text-cms-text-dim">
            Choose default templates for each content type and platform combination.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover disabled:opacity-50"
        >
          {isPending ? 'Saving...' : saved ? 'Saved' : 'Save Defaults'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-cms-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-cms-border bg-cms-bg">
              <th className="px-4 py-3 text-left text-xs font-medium text-cms-text-dim uppercase tracking-wider">
                Content Type
              </th>
              {PLATFORMS.map(p => (
                <th
                  key={p.key}
                  className="px-4 py-3 text-left text-xs font-medium text-cms-text-dim uppercase tracking-wider"
                >
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-cms-border">
            {CONTENT_TYPES.map(ct => (
              <tr key={ct.key} className="bg-cms-surface">
                <td className="px-4 py-3 text-sm font-medium text-cms-text">
                  {ct.label}
                </td>
                {PLATFORMS.map(p => {
                  const key = getKey(ct.key, p.key)
                  const compatible = getCompatibleTemplates(p.key)
                  const current = defaults[key] ?? ''

                  return (
                    <td key={p.key} className="px-4 py-3">
                      <select
                        value={current}
                        onChange={e => handleChange(ct.key, p.key, e.target.value)}
                        className="w-full rounded-md border border-cms-border bg-cms-bg px-2 py-1.5 text-sm text-cms-text focus:border-cms-accent focus:outline-none focus:ring-1 focus:ring-cms-accent"
                      >
                        <option value="">None</option>
                        {compatible.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.aspect_ratio})
                          </option>
                        ))}
                      </select>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
