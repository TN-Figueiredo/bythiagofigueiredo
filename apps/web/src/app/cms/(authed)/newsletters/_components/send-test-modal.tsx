'use client'

import { useState, useRef, useEffect } from 'react'
import { Mail } from 'lucide-react'

interface SendTestModalProps {
  open: boolean
  subject: string
  userEmail: string
  onConfirm: (email: string) => void
  onCancel: () => void
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function SendTestModal({ open, subject, userEmail, onConfirm, onCancel }: SendTestModalProps) {
  const [email, setEmail] = useState(userEmail)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setEmail(userEmail)
  }, [open, userEmail])

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return
    const focusable = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    focusable?.focus()
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onCancel(); return }
      if (e.key !== 'Tab') return
      const focusableEls = dialog!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      const first = focusableEls[0]
      const last = focusableEls[focusableEls.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="send-test-title"
        className="w-full max-w-sm rounded-xl bg-[#111827] border border-[#374151] p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-full bg-blue-500/15 flex items-center justify-center">
            <Mail size={16} className="text-[#60a5fa]" />
          </div>
          <h3 id="send-test-title" className="text-base font-semibold text-[#f3f4f6]">Send Test Email</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#9ca3af] mb-1">Send to</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[#374151] bg-[#0a0f1a] text-[#d1d5db] px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              placeholder="email@example.com" />
          </div>
          <p className="text-[10px] text-[#6b7280]">A preview email will be sent with [TEST] prefix in the subject line.</p>
          <div className="rounded-lg bg-[#0a0f1a] border border-[#1f2937] px-3 py-2">
            <span className="text-xs text-[#6b7280]">Subject: </span>
            <span className="text-xs text-[#d1d5db]">[TEST] {subject || 'Untitled'}</span>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium text-[#9ca3af] hover:bg-white/5">Cancel</button>
          <button type="button" onClick={() => onConfirm(email)} disabled={!email.includes('@')}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Send Test</button>
        </div>
      </div>
    </div>
  )
}
