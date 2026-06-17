'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { ExportDialog } from './export-dialog'
import type { ExportSignupsOpts, ExportSignupsResult } from '../actions'

/**
 * Detail-page export island: owns the ExportDialog open-state and bridges the
 * `exportWaitlistSignups` server action (passed in as a prop — never imported into a
 * client component). On success it triggers a client-side CSV download.
 */
export function WaitlistExportButton({
  slug,
  waitlistId,
  exportAction,
}: {
  slug: string
  waitlistId: string
  exportAction: (waitlistId: string, opts: ExportSignupsOpts) => Promise<ExportSignupsResult>
}) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport(opts: ExportSignupsOpts) {
    setExporting(true)
    setError(null)
    const res = await exportAction(waitlistId, opts)
    setExporting(false)
    if (!res.ok) {
      setError(res.error === 'not_found' ? 'This waitlist could not be found.' : 'Export failed — please try again.')
      return
    }
    // Trigger the download client-side (guarded for non-browser/test environments).
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const url = URL.createObjectURL(new Blob([res.csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = res.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-[var(--cms-radius)] border border-cms-border px-4 py-2 text-sm text-cms-text hover:bg-cms-surface"
      >
        <Download size={14} aria-hidden="true" />
        Export CSV
      </button>
      {open && (
        <ExportDialog
          slug={slug}
          exporting={exporting}
          error={error}
          onExport={handleExport}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
