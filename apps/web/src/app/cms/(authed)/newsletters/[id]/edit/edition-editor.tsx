'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import type { JSONContent } from '@tiptap/core'
import { ArrowLeft, Calendar, Send, Eye, BarChart3, RotateCcw, Command } from 'lucide-react'
import { TipTapEditor } from '../../_components/tiptap-editor'
import { useAutosave } from '../../_components/use-autosave'
import { AutosaveIndicator } from '../../_components/autosave-indicator'
import { NavigationGuard } from '../../_components/navigation-guard'
import { ReadOnlyOverlay } from '../../_components/read-only-overlay'
import { EmailPreview } from '../../_components/email-preview'
import { ScheduleModal } from '../../_components/schedule-modal'
import { SendNowModal } from '../../_components/send-now-modal'
import { DeleteConfirmModal } from '../../_components/delete-confirm-modal'
import { ContextualBanner } from '../../_components/contextual-banner'
import { MoreMenu } from '../../_components/more-menu'
import { TypeSelector } from '../../_components/type-selector'
import { StatsStrip } from '../../_components/stats-strip'
import { SendTestModal } from '../../_components/send-test-modal'
import {
  saveEdition,
  createEdition,
  sendTestEmail,
  duplicateEdition,
  deleteEdition,
  scheduleEdition,
  cancelEdition,
  sendNow,
  revertToDraft,
  renderEmailPreview,
  uploadNewsletterImage,
  retryEdition,
} from '../../actions'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EditionData {
  id: string
  subject: string
  preheader: string | null
  content_json: JSONContent | null
  content_html: string | null
  status: string
  notes: string | null
  newsletter_type_id: string | null
  newsletter_types: { name: string; color: string; sender_name: string | null; sender_email: string | null } | null
  segment: string | null
  web_archive_enabled: boolean
  scheduled_at?: string | null
  stats_delivered?: number | null
  stats_opens?: number | null
  stats_clicks?: number | null
  stats_bounces?: number | null
  error_message?: string | null
}

interface EditionEditorProps {
  edition: EditionData | null
  subscriberCount: number
  types: Array<{ id: string; name: string; color: string }>
  initialTypeId?: string | null
  userEmail?: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const LOCKED_STATUSES = ['sending', 'sent', 'failed', 'cancelled']

const STATUS_PILL: Record<string, string> = {
  draft: 'bg-[#374151] text-[#d1d5db]',
  scheduled: 'bg-purple-500/15 text-[#c084fc]',
  sending: 'bg-blue-500/15 text-[#60a5fa]',
  sent: 'bg-emerald-500/15 text-[#4ade80]',
  failed: 'bg-red-500/15 text-[#f87171]',
  cancelled: 'bg-[#374151] text-[#9ca3af]',
  idea: 'bg-[#374151] text-[#d1d5db]',
  ready: 'bg-indigo-500/15 text-[#818cf8]',
  review: 'bg-amber-500/15 text-[#fbbf24]',
  queued: 'bg-cyan-500/15 text-[#22d3ee]',
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EditionEditor({
  edition,
  subscriberCount,
  types,
  initialTypeId,
  userEmail = '',
}: EditionEditorProps) {
  const router = useRouter()

  // ── Ephemeral / isDirty pattern ───────────────────────────────────────────
  const [editionId, setEditionId] = useState(edition?.id ?? null)
  const isEphemeral = editionId === null
  const isCreatingRef = useRef(false)

  const status = edition?.status ?? 'draft'
  const isReadOnly = LOCKED_STATUSES.includes(status)

  // ── Field state ───────────────────────────────────────────────────────────
  const [subject, setSubject] = useState(edition?.subject ?? '')
  const [preheader, setPreheader] = useState(edition?.preheader ?? '')
  const [contentJson, setContentJson] = useState<JSONContent | null>(edition?.content_json ?? null)
  const [contentHtml, setContentHtml] = useState(edition?.content_html ?? '')
  const [notes, setNotes] = useState(edition?.notes ?? '')
  const [segment, setSegment] = useState(edition?.segment ?? 'all')
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(
    edition?.newsletter_type_id ?? initialTypeId ?? types[0]?.id ?? null,
  )

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showPreview, setShowPreview] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showSendNowModal, setShowSendNowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showSendTestModal, setShowSendTestModal] = useState(false)

  // ── Refs ───────────────────────────────────────────────────────────────────
  const fieldsRef = useRef({ subject, preheader, contentJson, contentHtml, notes, segment })
  fieldsRef.current = { subject, preheader, contentJson, contentHtml, notes, segment }

  // ── Autosave ──────────────────────────────────────────────────────────────
  const saveFn = useCallback(async (data: Record<string, unknown>) => {
    if (!editionId) return { ok: false, error: 'ephemeral' }
    return saveEdition(editionId, data as Parameters<typeof saveEdition>[1])
  }, [editionId])

  const { state: saveState, lastSavedAt, hasUnsavedChanges, scheduleSave, saveNow: saveImmediate, setHasUnsavedChanges } = useAutosave({
    editionId,
    saveFn,
    enabled: !isReadOnly && !isEphemeral,
  })

  // ── Payload builder ───────────────────────────────────────────────────────
  function getSavePayload(overrides?: Partial<typeof fieldsRef.current>) {
    const f = { ...fieldsRef.current, ...overrides }
    return {
      subject: f.subject,
      preheader: f.preheader || undefined,
      content_json: f.contentJson ? JSON.stringify(f.contentJson) : undefined,
      content_html: f.contentHtml || undefined,
      notes: f.notes || undefined,
      segment: f.segment,
    }
  }

  function scheduleAutosave(overrides?: Partial<typeof fieldsRef.current>) {
    if (overrides) Object.assign(fieldsRef.current, overrides)
    scheduleSave(getSavePayload())
  }

  // ── Ephemeral creation ────────────────────────────────────────────────────
  const handleFirstEdit = useCallback(async () => {
    if (!isEphemeral || isCreatingRef.current) return
    isCreatingRef.current = true
    const payload = {
      subject: fieldsRef.current.subject,
      preheader: fieldsRef.current.preheader || undefined,
      content_json: fieldsRef.current.contentJson ? JSON.stringify(fieldsRef.current.contentJson) : undefined,
      content_html: fieldsRef.current.contentHtml || undefined,
      newsletter_type_id: selectedTypeId,
      segment: fieldsRef.current.segment,
    }
    const result = await createEdition(payload)
    if (result.ok && result.editionId) {
      setEditionId(result.editionId)
      setHasUnsavedChanges(false)
      router.replace(`/cms/newsletters/${result.editionId}/edit`)
    } else {
      toast.error('Failed to create edition')
      isCreatingRef.current = false
    }
  }, [isEphemeral, selectedTypeId, router, setHasUnsavedChanges])

  function maybeCreateEphemeral() {
    if (isEphemeral && fieldsRef.current.subject.trim().length > 0) {
      handleFirstEdit()
    }
  }

  // ── Field handlers ────────────────────────────────────────────────────────
  function handleSubjectChange(value: string) {
    setSubject(value)
    if (!isEphemeral) {
      scheduleAutosave({ subject: value })
    }
  }

  function handlePreheaderChange(value: string) {
    setPreheader(value)
    if (!isEphemeral) {
      scheduleAutosave({ preheader: value })
    } else {
      fieldsRef.current.preheader = value
      maybeCreateEphemeral()
    }
  }

  function handleEditorChange(json: JSONContent, html: string) {
    setContentJson(json)
    setContentHtml(html)
    if (!isEphemeral) {
      scheduleAutosave({ contentJson: json, contentHtml: html })
    } else {
      fieldsRef.current.contentJson = json
      fieldsRef.current.contentHtml = html
      maybeCreateEphemeral()
    }
  }

  function handleNotesChange(value: string) {
    setNotes(value)
    if (!isEphemeral) {
      scheduleAutosave({ notes: value })
    }
  }

  function handleSegmentChange(value: string) {
    setSegment(value)
    if (!isEphemeral) {
      scheduleAutosave({ segment: value })
    } else {
      fieldsRef.current.segment = value
    }
  }

  function handleTypeChange(typeId: string | null) {
    setSelectedTypeId(typeId)
  }

  // ── Subject blur triggers creation ────────────────────────────────────────
  function handleSubjectBlur() {
    if (isEphemeral && subject.trim().length > 0) {
      fieldsRef.current.subject = subject
      handleFirstEdit()
    }
  }

  // ── Image upload ──────────────────────────────────────────────────────────
  async function handleImageUpload(file: File): Promise<string | null> {
    if (!editionId) {
      toast.error('Save the edition first before uploading images')
      return null
    }
    const toastId = toast.loading('Uploading image...')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('editionId', editionId)
      const result = await uploadNewsletterImage(fd)
      if (result.ok) {
        toast.success('Image uploaded', { id: toastId })
        return result.url
      }
      toast.error(`Upload failed: ${result.error}`, { id: toastId })
      return null
    } catch {
      toast.error('Upload failed unexpectedly', { id: toastId })
      return null
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleSendTest(email: string) {
    if (!editionId) return
    const result = await sendTestEmail(editionId)
    if (result.ok) toast.success(`Test email sent to ${email}`)
    else toast.error(`Test failed: ${result.error}`)
    setShowSendTestModal(false)
  }

  async function handleDuplicate() {
    if (!editionId) return
    const result = await duplicateEdition(editionId)
    if (result.ok && result.editionId) {
      toast.success('Duplicated')
      router.push(`/cms/newsletters/${result.editionId}/edit`)
    } else {
      toast.error('Duplicate failed')
    }
  }

  async function handleDelete(confirmText?: string) {
    if (!editionId) return
    const result = await deleteEdition(editionId, { confirmed: true, confirmText })
    if (result.ok) {
      toast.success('Deleted')
      router.push('/cms/newsletters')
    } else {
      toast.error(`Delete failed: ${'error' in result ? result.error : 'unknown'}`)
    }
  }

  async function handleSchedule(scheduledAt: string) {
    if (!editionId) return
    const result = await scheduleEdition(editionId, scheduledAt)
    if (result.ok) {
      toast.success(`Scheduled for ${new Date(scheduledAt).toLocaleString()}`)
      setShowScheduleModal(false)
      router.refresh()
    } else {
      toast.error(`Schedule failed: ${result.error}`)
    }
  }

  async function handleSendNow() {
    if (!editionId) return
    const result = await sendNow(editionId)
    if (result.ok) {
      toast.success('Sending to subscribers...')
      setShowSendNowModal(false)
      router.refresh()
    } else {
      toast.error(`Send failed: ${result.error}`)
    }
  }

  async function handleUnschedule() {
    if (!editionId) return
    const result = await cancelEdition(editionId)
    if (result.ok) {
      toast.success('Unscheduled, reverted to draft')
      router.refresh()
    } else {
      toast.error(`Unschedule failed: ${result.error}`)
    }
  }

  async function handleRetry() {
    if (!editionId) return
    const result = await retryEdition(editionId)
    if (result.ok) {
      toast.success('Retrying send...')
      router.refresh()
    } else {
      toast.error(`Retry failed: ${result.error}`)
    }
  }

  async function handleRevertToDraft() {
    if (!editionId) return
    const result = await revertToDraft(editionId)
    if (result.ok) {
      toast.success('Reverted to draft')
      router.refresh()
    } else {
      toast.error(`Revert failed: ${result.error}`)
    }
  }

  // ── NavigationGuard save callback ─────────────────────────────────────────
  const handleGuardSave = useCallback(async () => {
    if (editionId) {
      saveImmediate(getSavePayload())
    }
  }, [editionId, saveImmediate])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (!isEphemeral) {
          saveImmediate(getSavePayload())
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        if (!isEphemeral) {
          setShowPreview((v) => !v)
        }
      }
      if (e.key === 'Escape') {
        if (showPreview) {
          setShowPreview(false)
        } else if (isEphemeral) {
          router.push('/cms/newsletters')
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [saveImmediate, isEphemeral, showPreview, router])

  // ── Derived values ────────────────────────────────────────────────────────
  const selectedType = types.find((t) => t.id === selectedTypeId)
  const senderName = edition?.newsletter_types?.sender_name ?? 'Thiago Figueiredo'
  const senderEmail = edition?.newsletter_types?.sender_email ?? 'newsletter@bythiagofigueiredo.com'

  // Reading time estimate (~200 wpm)
  const wordCount = contentHtml
    ? contentHtml.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
    : 0
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200))

  const segmentLabel = segment === 'all'
    ? `All subscribers`
    : segment === 'high_engagement'
      ? 'High engagement'
      : segment === 're_engagement'
        ? 'Re-engagement'
        : segment === 'new_subscribers'
          ? 'New subscribers'
          : segment

  // Stats for sent/failed editions
  const hasStats = (status === 'sent' || status === 'failed') && (
    edition?.stats_delivered != null || edition?.stats_opens != null
  )
  const statsData = hasStats ? {
    delivered: edition?.stats_delivered ?? undefined,
    openRate: edition?.stats_opens != null && edition?.stats_delivered
      ? Math.round((edition.stats_opens / edition.stats_delivered) * 100)
      : undefined,
    clickRate: edition?.stats_clicks != null && edition?.stats_delivered
      ? Math.round((edition.stats_clicks / edition.stats_delivered) * 100)
      : undefined,
    bounces: edition?.stats_bounces ?? undefined,
  } : null

  // ── Render ────────────────────────────────────────────────────────────────

  if (showPreview && editionId) {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)] bg-[#030712]">
        <NavigationGuard hasUnsavedChanges={hasUnsavedChanges} onSave={handleGuardSave} />
        <EmailPreview
          editionId={editionId}
          renderPreview={renderEmailPreview}
          onSendTest={() => setShowSendTestModal(true)}
          onBack={() => setShowPreview(false)}
        />
        <SendTestModal
          open={showSendTestModal}
          subject={subject}
          userEmail={userEmail}
          onConfirm={handleSendTest}
          onCancel={() => setShowSendTestModal(false)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#030712]">
      <NavigationGuard hasUnsavedChanges={hasUnsavedChanges} onSave={handleGuardSave} />

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-[#1f2937] bg-[#030712] shrink-0">
        {/* Left side */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/cms/newsletters"
            className="flex items-center gap-1.5 text-xs text-[#9ca3af] hover:text-[#d1d5db] transition-colors shrink-0"
          >
            <ArrowLeft size={14} />
            Hub
          </Link>
          <div className="w-px h-5 bg-[#1f2937] shrink-0" />
          <TypeSelector
            types={types}
            selectedTypeId={selectedTypeId}
            onChange={handleTypeChange}
            disabled={isReadOnly}
          />
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize shrink-0 ${STATUS_PILL[status] ?? STATUS_PILL.draft}`}>
            {isEphemeral ? 'new' : status}
          </span>
          {!isEphemeral && (
            <AutosaveIndicator state={saveState} lastSavedAt={lastSavedAt} />
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {status === 'draft' && !isEphemeral && (
            <>
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-1.5 rounded-md border border-[#374151] px-3 py-1.5 text-xs font-medium text-[#d1d5db] hover:bg-[#111827] transition-colors"
              >
                <Eye size={13} />
                Preview
              </button>
              <button
                type="button"
                onClick={() => setShowScheduleModal(true)}
                className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <Calendar size={13} />
                Schedule
              </button>
            </>
          )}
          {status === 'scheduled' && (
            <>
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-1.5 rounded-md border border-[#374151] px-3 py-1.5 text-xs font-medium text-[#d1d5db] hover:bg-[#111827] transition-colors"
              >
                <Eye size={13} />
                Preview
              </button>
              <button
                type="button"
                onClick={handleUnschedule}
                className="flex items-center gap-1.5 rounded-md border border-purple-500/40 px-3 py-1.5 text-xs font-medium text-[#c084fc] hover:bg-purple-500/10 transition-colors"
              >
                Unschedule
              </button>
            </>
          )}
          {status === 'sending' && (
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 rounded-md border border-[#374151] px-3 py-1.5 text-xs font-medium text-[#d1d5db] hover:bg-[#111827] transition-colors"
            >
              <Eye size={13} />
              Preview
            </button>
          )}
          {status === 'sent' && editionId && (
            <Link
              href={`/cms/newsletters/${editionId}/analytics`}
              className="flex items-center gap-1.5 rounded-md border border-[#374151] px-3 py-1.5 text-xs font-medium text-[#d1d5db] hover:bg-[#111827] transition-colors"
            >
              <BarChart3 size={13} />
              Analytics
            </Link>
          )}
          {status === 'failed' && (
            <>
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-1.5 rounded-md border border-[#374151] px-3 py-1.5 text-xs font-medium text-[#d1d5db] hover:bg-[#111827] transition-colors"
              >
                <Eye size={13} />
                Preview
              </button>
              <button
                type="button"
                onClick={handleRetry}
                className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
              >
                <RotateCcw size={13} />
                Retry
              </button>
            </>
          )}
          {isEphemeral && (
            <button
              type="button"
              disabled
              className="flex items-center gap-1.5 rounded-md border border-[#374151] px-3 py-1.5 text-xs font-medium text-[#4b5563] cursor-not-allowed"
            >
              <Eye size={13} />
              Preview
            </button>
          )}

          {/* MoreMenu */}
          {!isEphemeral ? (
            <MoreMenu
              status={status}
              onSendTest={() => setShowSendTestModal(true)}
              onDuplicate={handleDuplicate}
              onSendNow={status !== 'sending' && status !== 'sent' ? () => setShowSendNowModal(true) : undefined}
              onDelete={() => setShowDeleteModal(true)}
              webArchiveUrl={status === 'sent' && edition?.web_archive_enabled ? `/newsletter/archive/${editionId}` : null}
            />
          ) : (
            <MoreMenu
              status="draft"
              onDelete={() => router.push('/cms/newsletters')}
            />
          )}
        </div>
      </div>

      {/* ── Contextual banner ──────────────────────────────────────────────── */}
      <ContextualBanner
        status={isEphemeral ? null : status}
        scheduledAt={edition?.scheduled_at ?? null}
        sendProgress={null}
        errorMessage={edition?.error_message ?? null}
      />

      {/* ── Stats strip (sent/failed only) ─────────────────────────────────── */}
      {hasStats && statsData && (
        <StatsStrip
          stats={statsData}
          variant={status === 'failed' ? 'failed' : 'sent'}
        />
      )}

      {/* ── Scrollable content area ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {isReadOnly && <ReadOnlyOverlay status={status} />}

        {/* Hero inputs */}
        <div className="px-16 pt-7 pb-2">
          <input
            type="text"
            value={subject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            onBlur={handleSubjectBlur}
            disabled={isReadOnly}
            className="w-full bg-transparent text-[26px] font-bold tracking-[-0.5px] text-[#f9fafb] placeholder-[#374151] outline-none border-none disabled:opacity-50"
            placeholder="Edition subject..."
            autoFocus={isEphemeral}
          />
          <input
            type="text"
            value={preheader}
            onChange={(e) => handlePreheaderChange(e.target.value)}
            disabled={isReadOnly}
            className="w-full bg-transparent text-sm text-[#6b7280] placeholder-[#374151] outline-none border-none mt-2 disabled:opacity-50"
            placeholder="Preview text shown in inbox..."
          />
        </div>

        {/* Segment selector */}
        <div className="px-16 pb-4 flex items-center gap-2">
          <span className="text-[10px] text-[#6b7280] uppercase tracking-wider">Send to:</span>
          <select
            value={segment}
            onChange={(e) => handleSegmentChange(e.target.value)}
            disabled={isReadOnly}
            className="rounded-full border border-[#1f2937] bg-[#111827] text-[#d1d5db] px-2.5 py-0.5 text-[11px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50"
          >
            <option value="all">All subscribers ({subscriberCount})</option>
            <option value="high_engagement">High engagement</option>
            <option value="re_engagement">Re-engagement</option>
            <option value="new_subscribers">New subscribers</option>
          </select>
        </div>

        {/* TipTap Editor */}
        <div className="px-16 pb-6">
          <TipTapEditor
            content={contentJson}
            onChange={handleEditorChange}
            onImageInserted={() => {
              if (!isEphemeral) saveImmediate(getSavePayload())
            }}
            onImageUpload={handleImageUpload}
            editable={!isReadOnly}
          />
        </div>

        {/* Notes section */}
        <div className="px-16 pb-8">
          <details className="group">
            <summary className="text-xs font-medium text-[#6b7280] cursor-pointer hover:text-[#9ca3af] transition-colors select-none">
              Internal Notes
            </summary>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              disabled={isReadOnly}
              className="mt-2 w-full rounded-lg border border-[#1f2937] bg-[#0a0f1a] text-[#d1d5db] px-3 py-2 text-sm h-20 resize-none outline-none focus:border-[#374151] disabled:opacity-50 placeholder-[#374151]"
              placeholder="Internal notes (not included in email)"
            />
          </details>
        </div>
      </div>

      {/* ── Bottom bar ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-[#1f2937] bg-[#030712] px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px] text-[#6b7280]">
          <span>{subscriberCount.toLocaleString()} subscriber{subscriberCount !== 1 ? 's' : ''}</span>
          <span className="w-px h-3 bg-[#1f2937]" />
          <span>{segmentLabel}</span>
          <span className="w-px h-3 bg-[#1f2937]" />
          <span>{readingTimeMin} min read</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[#4b5563]">
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-[#1f2937] text-[9px] text-[#6b7280] font-mono">
              <Command size={8} />S
            </kbd>
            Save
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-[#1f2937] text-[9px] text-[#6b7280] font-mono">
              <Command size={8} /><span className="text-[8px]">&#8679;</span>P
            </kbd>
            Preview
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-[#1f2937] text-[9px] text-[#6b7280] font-mono">
              Esc
            </kbd>
            Exit
          </span>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <ScheduleModal
        open={showScheduleModal}
        audienceCount={subscriberCount}
        onConfirm={handleSchedule}
        onCancel={() => setShowScheduleModal(false)}
      />
      <SendNowModal
        open={showSendNowModal}
        subject={subject}
        recipientCount={subscriberCount}
        senderName={senderName}
        senderEmail={senderEmail}
        onConfirm={handleSendNow}
        onCancel={() => setShowSendNowModal(false)}
      />
      <DeleteConfirmModal
        open={showDeleteModal}
        title={`Delete "${subject || 'Untitled'}"?`}
        description="This cannot be undone."
        impactLevel={status === 'sent' ? 'high' : contentHtml ? 'medium' : 'low'}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
      <SendTestModal
        open={showSendTestModal}
        subject={subject}
        userEmail={userEmail}
        onConfirm={handleSendTest}
        onCancel={() => setShowSendTestModal(false)}
      />
    </div>
  )
}
