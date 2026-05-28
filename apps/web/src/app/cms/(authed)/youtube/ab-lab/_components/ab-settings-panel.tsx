'use client'

import { useState, useTransition, useEffect } from 'react'
import type { AbTestSiteSettings } from '@/lib/youtube/ab-types'
import { updateAbSiteSettings } from '../actions'

interface AbSettingsPanelProps {
  settings: AbTestSiteSettings
  onClose: () => void
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-cms-accent' : 'bg-cms-surface-hover'
      }`}
    >
      <span
        className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export function AbSettingsPanel({ settings, onClose }: AbSettingsPanelProps) {
  const [edited, setEdited] = useState<AbTestSiteSettings>(settings)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function setTop<K extends keyof AbTestSiteSettings>(key: K, value: AbTestSiteSettings[K]) {
    setEdited((prev) => ({ ...prev, [key]: value }))
  }

  function setCtrDrop<K extends keyof AbTestSiteSettings['ctr_drop_trigger']>(
    key: K,
    value: AbTestSiteSettings['ctr_drop_trigger'][K],
  ) {
    setEdited((prev) => ({
      ...prev,
      ctr_drop_trigger: { ...prev.ctr_drop_trigger, [key]: value },
    }))
  }

  function setPostPublish<K extends keyof AbTestSiteSettings['post_publish_trigger']>(
    key: K,
    value: AbTestSiteSettings['post_publish_trigger'][K],
  ) {
    setEdited((prev) => ({
      ...prev,
      post_publish_trigger: { ...prev.post_publish_trigger, [key]: value },
    }))
  }

  function setNotification<K extends keyof AbTestSiteSettings['notifications']>(
    key: K,
    value: boolean,
  ) {
    setEdited((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }))
  }

  function handleSave() {
    startTransition(async () => {
      await updateAbSiteSettings(edited)
      onClose()
    })
  }

  const inputCls =
    'rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg px-3 py-1.5 text-sm text-cms-text focus:outline-none focus:ring-1 focus:ring-cms-accent'

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md overflow-y-auto border-l border-cms-border bg-cms-surface">
        <div className="flex items-center justify-between border-b border-cms-border px-6 py-4">
          <h2 className="text-base font-semibold text-cms-text">A/B Test Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--cms-radius)] text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-8 px-6 py-6">
          <section className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-cms-text-dim">Automation</p>

            <div className="space-y-3 rounded-[var(--cms-radius)] border border-cms-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-cms-text">CTR drop trigger</p>
                  <p className="text-xs text-cms-text-muted">Auto-pause when CTR drops significantly</p>
                </div>
                <Toggle
                  checked={edited.ctr_drop_trigger.enabled}
                  onChange={(v) => setCtrDrop('enabled', v)}
                  disabled={isPending}
                />
              </div>
              {edited.ctr_drop_trigger.enabled && (
                <div className="space-y-2 border-t border-cms-border pt-3">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs text-cms-text-muted">Threshold</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={edited.ctr_drop_trigger.threshold_percent}
                        onChange={(e) => setCtrDrop('threshold_percent', Number(e.target.value))}
                        disabled={isPending}
                        className={`w-16 ${inputCls}`}
                      />
                      <span className="text-xs text-cms-text-muted">%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-[var(--cms-radius)] border border-cms-border p-4">
              <div>
                <p className="text-sm font-medium text-cms-text">Post-publish auto-test</p>
                <p className="text-xs text-cms-text-muted">Start a test automatically after publishing</p>
              </div>
              <Toggle
                checked={edited.post_publish_trigger.enabled}
                onChange={(v) => setPostPublish('enabled', v)}
                disabled={isPending}
              />
            </div>
          </section>

          <section className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-cms-text-dim">Defaults</p>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-cms-text-muted">Duration</label>
                <select
                  value={edited.default_duration_days}
                  onChange={(e) => setTop('default_duration_days', Number(e.target.value))}
                  disabled={isPending}
                  className={inputCls}
                >
                  {[7, 14, 21, 28].map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-cms-text-muted">Confidence threshold</label>
                  <span className="text-sm font-medium text-cms-text">
                    {Math.round(edited.default_confidence * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={99}
                  step={1}
                  value={Math.round(edited.default_confidence * 100)}
                  onChange={(e) => setTop('default_confidence', Number(e.target.value) / 100)}
                  disabled={isPending}
                  className="w-full accent-[var(--cms-accent)]"
                />
                <div className="flex justify-between text-[10px] text-cms-text-dim">
                  <span>80%</span>
                  <span>99%</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-cms-text-muted">Auto-apply winner</p>
                  <p className="text-xs text-cms-text-dim">Apply winning variant automatically</p>
                </div>
                <Toggle
                  checked={edited.default_auto_apply}
                  onChange={(v) => setTop('default_auto_apply', v)}
                  disabled={isPending}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <label className="text-sm text-cms-text-muted">Burn-in days</label>
                  <p className="text-xs text-cms-text-dim">Ignore early data for this many days</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={edited.default_burn_in_days}
                  onChange={(e) => setTop('default_burn_in_days', Number(e.target.value))}
                  disabled={isPending}
                  className={`w-16 ${inputCls}`}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-cms-text-dim">Notifications</p>

            <div className="space-y-3">
              {(
                [
                  { key: 'test_completed', label: 'Test completed' },
                  { key: 'test_auto_paused', label: 'Test auto-paused' },
                  { key: 'ctr_drop_alert', label: 'CTR drop alert' },
                  { key: 'daily_digest', label: 'Daily digest' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`notif-${key}`}
                    checked={edited.notifications[key]}
                    onChange={(e) => setNotification(key, e.target.checked)}
                    disabled={isPending}
                    className="h-4 w-4 rounded border-cms-border accent-[var(--cms-accent)]"
                  />
                  <label
                    htmlFor={`notif-${key}`}
                    className="text-sm text-cms-text-muted select-none cursor-pointer"
                  >
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-cms-border bg-cms-surface px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-[var(--cms-radius)] border border-cms-border bg-transparent px-4 py-2 text-sm font-medium text-cms-text hover:bg-cms-surface-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  )
}
