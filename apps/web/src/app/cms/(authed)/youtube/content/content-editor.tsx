'use client'

import { useState, useTransition } from 'react'
import type { YouTubeStrings } from '@/lib/content/types'
import { savePageContent, resetPageContent } from './actions'

interface FieldDef {
  key: keyof YouTubeStrings
  label: string
  type: 'text' | 'textarea'
  hint?: string
}

interface Section {
  id: string
  label: string
  fields: FieldDef[]
}

const SECTIONS: Section[] = [
  {
    id: 'hero_pt',
    label: 'Hero — PT Variant',
    fields: [
      { key: 'hero_pt_section_label', label: 'Section label', type: 'text' },
      { key: 'hero_pt_headline', label: 'Headline', type: 'text' },
      { key: 'hero_pt_description', label: 'Description', type: 'textarea' },
      { key: 'hero_pt_also_on', label: '"Also on" label', type: 'text' },
      { key: 'hero_pt_previously', label: '"Previously" label', type: 'text' },
    ],
  },
  {
    id: 'hero_en',
    label: 'Hero — EN Variant',
    fields: [
      { key: 'hero_en_section_label', label: 'Section label', type: 'text' },
      { key: 'hero_en_headline_line1', label: 'Headline line 1', type: 'text' },
      { key: 'hero_en_headline_line2', label: 'Headline line 2 (accent color)', type: 'text' },
      { key: 'hero_en_description', label: 'Description', type: 'textarea' },
      { key: 'hero_en_previously', label: '"Previously" label', type: 'text' },
    ],
  },
  {
    id: 'stats',
    label: 'Stats Strip',
    fields: [
      { key: 'stats_videos_published', label: 'Videos published', type: 'text' },
      { key: 'stats_hours_of_content', label: 'Hours of content', type: 'text' },
      { key: 'stats_comments_answered', label: 'Comments answered', type: 'text' },
      { key: 'stats_most_watched', label: 'Most watched', type: 'text' },
    ],
  },
  {
    id: 'feature',
    label: 'Featured Pick',
    fields: [
      { key: 'feature_section_label', label: 'Section label', type: 'text' },
      { key: 'feature_headline', label: 'Headline', type: 'textarea' },
      { key: 'feature_my_pick', label: '"My pick" annotation', type: 'text' },
      { key: 'feature_also_dropped', label: '"Also dropped" label', type: 'text' },
      { key: 'feature_jump_to_series', label: '"Jump to series" label', type: 'text' },
    ],
  },
  {
    id: 'comments',
    label: 'Comments Wall',
    fields: [
      { key: 'comments_section_label', label: 'Section label', type: 'text' },
      { key: 'comments_headline', label: 'Headline', type: 'textarea' },
      { key: 'comments_description', label: 'Description', type: 'textarea' },
      { key: 'comments_scroll_annotation', label: '"Enough scrolling" annotation', type: 'text' },
      { key: 'comments_relative_today', label: 'Relative: today', type: 'text' },
      { key: 'comments_relative_days', label: 'Relative: days', type: 'text', hint: 'Use {n} for the number, e.g. "{n}d ago"' },
      { key: 'comments_relative_weeks', label: 'Relative: weeks', type: 'text', hint: 'Use {n} for the number' },
      { key: 'comments_relative_months', label: 'Relative: months', type: 'text', hint: 'Use {n} for the number' },
      { key: 'comments_relative_years', label: 'Relative: years', type: 'text', hint: 'Use {n} for the number' },
    ],
  },
  {
    id: 'archive',
    label: 'Archive',
    fields: [
      { key: 'archive_section_label', label: 'Section label', type: 'text' },
      { key: 'archive_headline', label: 'Headline', type: 'text' },
      { key: 'archive_search_placeholder', label: 'Search placeholder', type: 'text' },
      { key: 'archive_search_aria', label: 'Search aria-label', type: 'text' },
      { key: 'archive_channel_label', label: '"Channel:" label', type: 'text' },
      { key: 'archive_channel_aria', label: 'Channel aria-label', type: 'text' },
      { key: 'archive_channel_both', label: '"Both" button', type: 'text' },
      { key: 'archive_clear_all', label: '"Clear all" button', type: 'text' },
      { key: 'archive_series_label', label: '"Series:" label', type: 'text' },
      { key: 'archive_series_aria', label: 'Series aria-label', type: 'text' },
      { key: 'archive_tags_label', label: '"Tags:" label', type: 'text' },
      { key: 'archive_tags_aria', label: 'Tags aria-label', type: 'text' },
      { key: 'archive_video_singular', label: 'Video (singular)', type: 'text' },
      { key: 'archive_video_plural', label: 'Videos (plural)', type: 'text' },
      { key: 'archive_filtered', label: '"Filtered" label', type: 'text' },
      { key: 'archive_newest_first', label: '"Newest first" annotation', type: 'text' },
      { key: 'archive_no_videos', label: 'No videos message', type: 'text' },
      { key: 'archive_clear_filters', label: '"Clear filters" button', type: 'text' },
      { key: 'archive_load_more', label: '"Load more" button', type: 'text' },
      { key: 'archive_latest', label: '"Latest" chip label', type: 'text' },
    ],
  },
  {
    id: 'shared',
    label: 'Shared',
    fields: [
      { key: 'card_views', label: '"Views" label', type: 'text' },
    ],
  },
  {
    id: 'channel',
    label: 'Channel Cards',
    fields: [
      { key: 'channel_subs', label: '"Subs" label', type: 'text' },
      { key: 'channel_videos', label: '"Videos" label', type: 'text' },
      { key: 'channel_open', label: '"Open" button', type: 'text' },
    ],
  },
  {
    id: 'subscribe',
    label: 'Subscribe CTA',
    fields: [
      { key: 'subscribe_floating_label', label: 'Floating label', type: 'text' },
      { key: 'subscribe_headline', label: 'Headline', type: 'textarea' },
      { key: 'subscribe_description', label: 'Description', type: 'textarea' },
      { key: 'subscribe_subs', label: '"Subs" label', type: 'text' },
      { key: 'subscribe_button', label: 'Button text', type: 'text' },
    ],
  },
  {
    id: 'empty',
    label: 'Empty State',
    fields: [
      { key: 'empty_headline', label: 'Headline', type: 'text' },
      { key: 'empty_description', label: 'Description', type: 'textarea' },
      { key: 'empty_subscribe_button', label: 'Subscribe button', type: 'text' },
    ],
  },
]

interface Props {
  initialEn: YouTubeStrings
  initialPt: YouTubeStrings
}

export function YouTubeContentEditor({ initialEn, initialPt }: Props) {
  const [locale, setLocale] = useState<'en' | 'pt-BR'>('en')
  const [enData, setEnData] = useState<YouTubeStrings>(initialEn)
  const [ptData, setPtData] = useState<YouTubeStrings>(initialPt)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [saving, startSave] = useTransition()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const data = locale === 'en' ? enData : ptData
  const setData = locale === 'en' ? setEnData : setPtData

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function update(key: keyof YouTubeStrings, value: string) {
    setData((prev) => ({ ...prev, [key]: value }))
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function handleSave() {
    startSave(async () => {
      const result = await savePageContent(locale, data)
      if (result.ok) {
        showToast('Saved!', 'success')
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  function handleReset() {
    if (!confirm('Reset all fields to defaults? This cannot be undone.')) return
    startSave(async () => {
      const result = await resetPageContent(locale)
      if (result.ok) {
        setData(result.content)
        showToast('Reset to defaults', 'success')
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Locale toggle + actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['en', 'pt-BR'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                locale === l
                  ? 'bg-cms-accent text-white'
                  : 'bg-cms-surface text-cms-text-muted hover:text-cms-text'
              }`}
            >
              {l === 'en' ? '🇺🇸 English' : '🇧🇷 Português'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={saving}
            className="rounded-md border border-cms-border px-3 py-1.5 text-sm text-cms-text-muted hover:text-cms-text transition disabled:opacity-50"
          >
            Reset to defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-cms-accent px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-md px-4 py-2 text-sm ${
            toast.type === 'success'
              ? 'bg-green-900/50 text-green-200 border border-green-800'
              : 'bg-red-900/50 text-red-200 border border-red-800'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Sections */}
      {SECTIONS.map((section) => (
        <div key={section.id} className="rounded-lg border border-cms-border bg-cms-surface/50">
          <button
            onClick={() => toggle(section.id)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-cms-text">{section.label}</span>
            <span className="text-xs text-cms-text-muted">
              {collapsed.has(section.id) ? '▸' : '▾'} {section.fields.length} fields
            </span>
          </button>
          {!collapsed.has(section.id) && (
            <div className="space-y-3 border-t border-cms-border px-4 py-4">
              {section.fields.map((field) => (
                <div key={field.key}>
                  <label className="mb-1 block text-xs font-medium text-cms-text-muted">
                    {field.label}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={data[field.key]}
                      onChange={(e) => update(field.key, e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-cms-border bg-cms-surface px-3 py-2 text-sm text-cms-text focus:border-cms-accent focus:outline-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={data[field.key]}
                      onChange={(e) => update(field.key, e.target.value)}
                      className="w-full rounded-md border border-cms-border bg-cms-surface px-3 py-2 text-sm text-cms-text focus:border-cms-accent focus:outline-none"
                    />
                  )}
                  {field.hint && (
                    <p className="mt-1 text-xs text-cms-text-muted">{field.hint}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
