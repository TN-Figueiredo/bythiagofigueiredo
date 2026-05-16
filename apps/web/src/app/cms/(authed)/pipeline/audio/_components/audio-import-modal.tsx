'use client'

import { useState, useRef, useEffect } from 'react'

interface AudioImportModalProps { onClose: () => void }

type Step = 'input' | 'preview' | 'result'

interface ImportPreview { preview: { to_create: number; to_update: number; to_skip: number } }
interface ImportResult { dry_run: false; import_log_id: string; created: number; updated: number; skipped: number; errors: Array<{ asset_id: string; error: string }> }

export function AudioImportModal({ onClose }: AudioImportModalProps) {
  const [step, setStep] = useState<Step>('input')
  const [jsonText, setJsonText] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const focusable = el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    first?.focus()
    function onKeydown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
    el.addEventListener('keydown', onKeydown)
    return () => el.removeEventListener('keydown', onKeydown)
  }, [step])

  const handlePreview = async () => {
    setError(null)
    let parsed: unknown
    try { parsed = JSON.parse(jsonText) } catch { setError('Invalid JSON'); return }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) { setError('JSON must be an object'); return }

    setLoading(true)
    const res = await fetch('/api/pipeline/audio-library/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...parsed, dry_run: true }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { setError(json.error?.message ?? 'Import failed'); return }
    setPreview(json.data)
    setStep('preview')
  }

  const handleExecute = async () => {
    setLoading(true)
    let parsed: unknown
    try { parsed = JSON.parse(jsonText) } catch { setError('Invalid JSON'); setLoading(false); setStep('input'); return }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) { setError('JSON must be an object'); setLoading(false); setStep('input'); return }
    const res = await fetch('/api/pipeline/audio-library/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...parsed, dry_run: false }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error?.message ?? 'Import failed'); setStep('input'); return }
    setResult(json.data)
    setStep('result')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="import-modal-title" onClick={e => e.stopPropagation()} style={{ width: 520, maxHeight: '80vh', background: 'var(--gem-surface)', border: '1px solid var(--gem-border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 id="import-modal-title" style={{ fontSize: 14, fontWeight: 600, color: 'var(--gem-text)', margin: 0 }}>Import Audio Library</h3>
          <button aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--gem-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        {step === 'input' && (
          <>
            <textarea value={jsonText} onChange={e => setJsonText(e.target.value)} placeholder="Paste JSON here..." style={{ width: '100%', height: 200, padding: 8, fontSize: 12, fontFamily: 'monospace', borderRadius: 5, border: '1px solid var(--gem-border)', background: 'var(--gem-well)', color: 'var(--gem-text)', resize: 'vertical' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--gem-muted)' }}>Or upload a JSON file</label>
              <label style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid var(--gem-border)', color: 'var(--gem-text)', background: 'var(--gem-surface-hi)', cursor: 'pointer' }}>
                Choose file
                <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = ev => { setJsonText(ev.target?.result as string ?? '') }
                  reader.readAsText(file)
                  e.target.value = ''
                }} />
              </label>
            </div>
            {error && <span style={{ fontSize: 12, color: 'var(--gem-danger)' }}>{error}</span>}
            <button onClick={handlePreview} disabled={loading || !jsonText.trim()} style={{ padding: '6px 16px', fontSize: 12, borderRadius: 5, border: 'none', background: 'var(--gem-accent)', color: '#fff', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Validating...' : 'Preview Import'}
            </button>
          </>
        )}

        {step === 'preview' && preview && (
          <>
            <div style={{ fontSize: 12, color: 'var(--gem-text)' }}>
              <div>Create: <strong>{preview.preview.to_create}</strong></div>
              <div>Update: <strong>{preview.preview.to_update}</strong></div>
              <div>Skip: <strong>{preview.preview.to_skip}</strong></div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('input')} style={{ padding: '6px 16px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-text)', cursor: 'pointer' }}>Back</button>
              <button onClick={handleExecute} disabled={loading} style={{ padding: '6px 16px', fontSize: 12, borderRadius: 5, border: 'none', background: 'var(--gem-done)', color: '#fff', cursor: 'pointer' }}>
                {loading ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </>
        )}

        {step === 'result' && result && (
          <>
            <div style={{ fontSize: 12, color: 'var(--gem-text)' }}>
              <div>Created: <strong>{result.created}</strong></div>
              <div>Updated: <strong>{result.updated}</strong></div>
              <div>Skipped: <strong>{result.skipped}</strong></div>
              {result.errors.length > 0 && <div style={{ color: 'var(--gem-danger)' }}>Errors: {result.errors.length}</div>}
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--gem-muted)' }}>Import log: {result.import_log_id}</div>
            </div>
            <button onClick={onClose} style={{ padding: '6px 16px', fontSize: 12, borderRadius: 5, border: 'none', background: 'var(--gem-accent)', color: '#fff', cursor: 'pointer' }}>Done</button>
          </>
        )}
      </div>
    </div>
  )
}
