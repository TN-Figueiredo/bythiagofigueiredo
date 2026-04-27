'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { JSONContent } from '@tiptap/core'
import { TipTapEditor } from '../../_components/tiptap-editor'
import { useAutosave } from '../../_components/use-autosave'
import { AutosaveIndicator } from '../../_components/autosave-indicator'
import { NavigationGuard } from '../../_components/navigation-guard'
import { ReadOnlyOverlay } from '../../_components/read-only-overlay'
import { EmailPreview } from '../../_components/email-preview'
import { ScheduleModal } from '../../_components/schedule-modal'
import { SendNowModal } from '../../_components/send-now-modal'
import { DeleteConfirmModal } from '../../_components/delete-confirm-modal'
import {
  saveEdition,
  sendTestEmail,
  duplicateEdition,
  deleteEdition,
  scheduleEdition,
  sendNow,
  renderEmailPreview,
  uploadNewsletterImage,
} from '../../actions'

interface EditionEditorProps {
  edition: {
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
  }
  subscriberCount: number
  types: Array<{ id: string; name: string; color: string }>
}

const LOCKED_STATUSES = ['sending', 'sent', 'failed', 'cancelled']

export function EditionEditor({ edition, subscriberCount, types }: EditionEditorProps) {
  const router = useRouter()
  const isReadOnly = LOCKED_STATUSES.includes(edition.status)

  const [subject, setSubject] = useState(edition.subject)
  const [preheader, setPreheader] = useState(edition.preheader ?? '')
  const [contentJson, setContentJson] = useState<JSONContent | null>(edition.content_json)
  const [contentHtml, setContentHtml] = useState(edition.content_html ?? '')
  const [notes, setNotes] = useState(edition.notes ?? '')
  const [segment, setSegment] = useState(edition.segment ?? 'all')
  const [showPreview, setShowPreview] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showSendNowModal, setShowSendNowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const saveFn = useCallback(async (data: Record<string, unknown>) => {
    return saveEdition(edition.id, data as Parameters<typeof saveEdition>[1])
  }, [edition.id])

  const { state: saveState, lastSavedAt, hasUnsavedChanges, scheduleSave, saveNow: saveImmediate } = useAutosave({
    editionId: edition.id,
    saveFn,
    enabled: !isReadOnly,
  })

  function scheduleAutosave() {
    scheduleSave({
      subject,
      preheader: preheader || undefined,
      content_json: contentJson ?? undefined,
      content_html: contentHtml || undefined,
      notes: notes || undefined,
      segment,
    })
  }

  function handleEditorChange(json: JSONContent, html: string) {
    setContentJson(json)
    setContentHtml(html)
    scheduleSave({
      subject,
      preheader: preheader || undefined,
      content_json: json,
      content_html: html,
      notes: notes || undefined,
      segment,
    })
  }

  async function handleImageUpload(file: File): Promise<string | null> {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('editionId', edition.id)
    const result = await uploadNewsletterImage(fd)
    if (result.ok) return result.url
    toast.error(`Upload failed: ${result.error}`)
    return null
  }

  async function handleSendTest() {
    const result = await sendTestEmail(edition.id)
    if (result.ok) toast.success('Test email sent')
    else toast.error(`Test failed: ${result.error}`)
  }

  async function handleDuplicate() {
    const result = await duplicateEdition(edition.id)
    if (result.ok && result.editionId) {
      toast.success('Duplicated')
      router.push(`/cms/newsletters/${result.editionId}/edit`)
    } else {
      toast.error('Duplicate failed')
    }
  }

  async function handleDelete(confirmText?: string) {
    const result = await deleteEdition(edition.id, { confirmed: true, confirmText })
    if (result.ok) {
      toast.success('Deleted')
      router.push('/cms/newsletters')
    } else {
      toast.error(`Delete failed: ${'error' in result ? result.error : 'unknown'}`)
    }
  }

  async function handleSchedule(scheduledAt: string) {
    const result = await scheduleEdition(edition.id, scheduledAt)
    if (result.ok) {
      toast.success(`Scheduled for ${new Date(scheduledAt).toLocaleString()}`)
      setShowScheduleModal(false)
      router.refresh()
    } else {
      toast.error(`Schedule failed: ${result.error}`)
    }
  }

  async function handleSendNow() {
    const result = await sendNow(edition.id)
    if (result.ok) {
      toast.success('Sending to subscribers...')
      setShowSendNowModal(false)
      router.refresh()
    } else {
      toast.error(`Send failed: ${result.error}`)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveImmediate({
          subject,
          preheader: preheader || undefined,
          content_json: contentJson ?? undefined,
          content_html: contentHtml || undefined,
          notes: notes || undefined,
          segment,
        })
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault()
        setShowPreview((v) => !v)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [subject, preheader, contentJson, contentHtml, notes, segment, saveImmediate])

  const typeColor = edition.newsletter_types?.color ?? '#7c3aed'
  const typeName = edition.newsletter_types?.name ?? 'Unassigned'

  return (
    <div className="relative max-w-5xl mx-auto">
      <NavigationGuard hasUnsavedChanges={hasUnsavedChanges} />

      {/* Status bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: typeColor }}
          >
            {typeName}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 capitalize">
            {edition.status}
          </span>
          <AutosaveIndicator state={saveState} lastSavedAt={lastSavedAt} />
        </div>
        <div className="flex items-center gap-2">
          {!isReadOnly && (
            <>
              <button type="button" onClick={handleSendTest} className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1">
                Send Test
              </button>
              <button type="button" onClick={handleDuplicate} className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1">
                Duplicate
              </button>
            </>
          )}
          <button type="button" onClick={() => setShowDeleteModal(true)} className="text-xs text-red-600 hover:text-red-800 px-2 py-1">
            Delete
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => { setSubject(e.target.value); scheduleAutosave() }}
            disabled={isReadOnly}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
            placeholder="Newsletter subject line"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Preheader</label>
          <input
            type="text"
            value={preheader}
            onChange={(e) => { setPreheader(e.target.value); scheduleAutosave() }}
            disabled={isReadOnly}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
            placeholder="Preview text shown in inbox"
          />
        </div>
      </div>

      {/* Segment + options */}
      <div className="flex items-center gap-4 mb-4">
        <select
          value={segment}
          onChange={(e) => { setSegment(e.target.value); scheduleAutosave() }}
          disabled={isReadOnly}
          className="rounded border px-2 py-1.5 text-sm"
        >
          <option value="all">All subscribers ({subscriberCount})</option>
          <option value="high_engagement">High engagement</option>
          <option value="re_engagement">Re-engagement</option>
          <option value="new_subscribers">New subscribers</option>
        </select>
      </div>

      {/* Editor area */}
      <div className="relative mb-6">
        {isReadOnly && <ReadOnlyOverlay status={edition.status} />}
        {showPreview ? (
          <EmailPreview editionId={edition.id} renderPreview={renderEmailPreview} />
        ) : (
          <TipTapEditor
            content={contentJson}
            onChange={handleEditorChange}
            onImageUpload={handleImageUpload}
            editable={!isReadOnly}
          />
        )}
      </div>

      {/* Notes */}
      <details className="mb-6">
        <summary className="text-sm font-medium text-gray-600 cursor-pointer">Internal Notes</summary>
        <textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); scheduleAutosave() }}
          disabled={isReadOnly}
          className="mt-2 w-full rounded border px-3 py-2 text-sm h-20 resize-none"
          placeholder="Internal notes (not included in email)"
        />
      </details>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-6 px-6 py-3 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {subscriberCount} subscribers
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {showPreview ? 'Editor' : 'Preview'}
          </button>
          {!isReadOnly && (
            <>
              <button
                type="button"
                onClick={() => setShowSendNowModal(true)}
                className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
              >
                Send Now
              </button>
              <button
                type="button"
                onClick={() => setShowScheduleModal(true)}
                className="rounded-md bg-purple-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
              >
                Schedule...
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
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
        senderName={edition.newsletter_types?.sender_name ?? 'Thiago Figueiredo'}
        senderEmail={edition.newsletter_types?.sender_email ?? 'newsletter@bythiagofigueiredo.com'}
        onConfirm={handleSendNow}
        onCancel={() => setShowSendNowModal(false)}
      />
      <DeleteConfirmModal
        open={showDeleteModal}
        title={`Delete "${subject}"?`}
        description="This cannot be undone."
        impactLevel={edition.status === 'sent' ? 'high' : contentHtml ? 'medium' : 'low'}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  )
}
