'use client'

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import type { AbTestSiteSettings } from '@/lib/youtube/ab-types'
import { SectionLabel, Toggle, NumberField, Slider, CheckRow, CfgRow } from './ab-primitives'

export interface SettingsDrawerProps {
  settings: AbTestSiteSettings | null
  onSave: (changes: Partial<AbTestSiteSettings>) => Promise<void>
  onClose: () => void
}

function Skeleton() {
  return (
    <div data-skeleton className="space-y-6 px-6 py-6 animate-pulse">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-3">
          <div className="h-3 w-24 rounded bg-cms-surface-hover" />
          <div className="h-10 rounded bg-cms-surface-hover" />
          <div className="h-10 rounded bg-cms-surface-hover" />
        </div>
      ))}
    </div>
  )
}

export function SettingsDrawer({ settings, onSave, onClose }: SettingsDrawerProps) {
  const [edited, setEdited] = useState<AbTestSiteSettings | null>(settings)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestEdited = useRef(edited)
  const drawerRef = useRef<HTMLDivElement>(null)
  latestEdited.current = edited

  // Sync if settings prop changes (e.g. from null to loaded)
  useEffect(() => {
    if (settings && !edited) {
      setEdited(settings)
    }
  }, [settings, edited])

  // Focus trap: auto-focus first element + Tab cycling
  useEffect(() => {
    const el = drawerRef.current
    if (!el) return
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [tabindex]:not([tabindex="-1"]), input, select, textarea',
    )
    if (focusable.length > 0) focusable[0]!.focus()

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const nodes = el!.querySelectorAll<HTMLElement>(
        'button, [tabindex]:not([tabindex="-1"]), input, select, textarea',
      )
      if (nodes.length === 0) return
      const first = nodes[0]!
      const last = nodes[nodes.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    el.addEventListener('keydown', handleTab)
    return () => el.removeEventListener('keydown', handleTab)
  }, [])

  // Escape closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Auto-save with debounce
  const scheduleAutoSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const current = latestEdited.current
      if (!current) return
      setSaveStatus('saving')
      startTransition(async () => {
        try {
          await onSave(current)
          setSaveStatus('saved')
        } catch {
          setSaveStatus('error')
        }
      })
    }, 500)
  }, [onSave, startTransition])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function update<K extends keyof AbTestSiteSettings>(key: K, value: AbTestSiteSettings[K]) {
    setEdited(prev => {
      if (!prev) return prev
      return { ...prev, [key]: value }
    })
    scheduleAutoSave()
  }

  function updateNotification(key: keyof AbTestSiteSettings['notifications'], value: boolean) {
    setEdited(prev => {
      if (!prev) return prev
      return { ...prev, notifications: { ...prev.notifications, [key]: value } }
    })
    scheduleAutoSave()
  }

  function handleRetry() {
    const current = latestEdited.current
    if (!current) return
    setSaveStatus('saving')
    startTransition(async () => {
      try {
        await onSave(current)
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    })
  }

  const statusText = saveStatus === 'saving' || isPending
    ? 'Saving...'
    : saveStatus === 'saved'
      ? 'Saved automatically'
      : saveStatus === 'error'
        ? 'Failed to save'
        : ''

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-90 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
        data-backdrop
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="A/B Test Settings"
        className="fixed right-0 top-0 bottom-0 z-95 w-full overflow-y-auto border-l border-cms-border bg-cms-surface animate-ab-drawer-in"
        style={{ maxWidth: 'min(440px, 100%)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cms-border px-6 py-4">
          <h2 className="text-base font-semibold text-cms-text">A/B Test Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--cms-radius)] text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {!edited ? (
          <Skeleton />
        ) : (
          <div className="space-y-8 px-6 py-6">
            {/* Automation */}
            <section data-section="automation">
              <SectionLabel>Automation</SectionLabel>
              <div className="space-y-3">
                <CfgRow label="Auto-apply winner" hint="Apply winning variant automatically when test resolves">
                  <Toggle
                    checked={edited.default_auto_apply}
                    onChange={v => update('default_auto_apply', v)}
                  />
                </CfgRow>
              </div>
            </section>

            {/* Defaults */}
            <section data-section="defaults">
              <SectionLabel>Defaults</SectionLabel>
              <div className="space-y-3">
                <CfgRow label="Duration" hint="Default test duration in days">
                  <NumberField
                    value={edited.default_duration_days}
                    onChange={v => update('default_duration_days', v)}
                    min={7}
                    max={28}
                    suffix="d"
                  />
                </CfgRow>
                <CfgRow label="Confidence threshold">
                  <Slider
                    value={Math.round(edited.default_confidence * 100)}
                    onChange={v => update('default_confidence', v / 100)}
                    min={80}
                    max={99}
                    format={v => `${v}%`}
                  />
                </CfgRow>
                <CfgRow label="Burn-in period" hint="Ignore early data for this many days">
                  <NumberField
                    value={edited.default_burn_in_days}
                    onChange={v => update('default_burn_in_days', v)}
                    min={0}
                    max={3}
                    suffix="d"
                  />
                </CfgRow>
              </div>
            </section>

            {/* Notifications */}
            <section data-section="notifications">
              <SectionLabel>Notifications</SectionLabel>
              <div className="space-y-1">
                <CheckRow
                  checked={edited.notifications.test_completed}
                  onChange={v => updateNotification('test_completed', v)}
                  label="Test completed"
                  hint="Get notified when a test finishes"
                />
                <CheckRow
                  checked={edited.notifications.test_auto_paused}
                  onChange={v => updateNotification('test_auto_paused', v)}
                  label="Test auto-paused"
                  hint="Alert when a test is paused automatically"
                />
                <CheckRow
                  checked={edited.notifications.ctr_drop_alert}
                  onChange={v => updateNotification('ctr_drop_alert', v)}
                  label="CTR drop alert"
                  hint="Alert when CTR drops significantly"
                />
                <CheckRow
                  checked={edited.notifications.daily_digest}
                  onChange={v => updateNotification('daily_digest', v)}
                  label="Daily digest"
                  hint="Receive a daily summary of test activity"
                />
              </div>
            </section>
          </div>
        )}

        {/* Footer status */}
        <div
          className="sticky bottom-0 border-t border-cms-border bg-cms-surface px-6 py-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs ${saveStatus === 'error' ? 'text-red-400' : 'text-cms-text-muted'}`}>
              {statusText}
            </span>
            {saveStatus === 'error' && (
              <button
                type="button"
                onClick={handleRetry}
                className="text-xs text-cms-accent hover:underline focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
