'use client'

import { useState } from 'react'

interface AudioImportModalProps { onClose: () => void }

type Step = 'input' | 'preview' | 'result'

export function AudioImportModal({ onClose }: AudioImportModalProps) {
  const [step, setStep] = useState<Step>('input')
  const [jsonText, setJsonText] = useState('')
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handlePreview = async () => {
    setError(null)
    let parsed: unknown
    try { parsed = JSON.parse(jsonText) } catch { setError('Invalid JSON'); return }

    setLoading(true)
    const res = await fetch('/api/pipeline/audio-library/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(parsed as object), dry_run: true }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { setError(json.error?.message ?? 'Import failed'); return }
    setPreview(json.data)
    setStep('preview')
  }

  const handleExecute = async () => {
    setLoading(true)
    const parsed = JSON.parse(jsonText)
    const res = await fetch('/api/pipeline/audio-library/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...parsed, dry_run: false }),
    })
    const json = await res.json()
    setLoading(false)
    setResult(json.data)
    setStep('result')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 520, maxHeight: '80vh', background: 'var(--gem-surface)', border: '1px solid var(--gem-border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--gem-text)', margin: 0 }}>Import Audio Library</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--gem-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        {step === 'input' && (
          <>
            <textarea value={jsonText} onChange={e => setJsonText(e.target.value)} placeholder="Paste JSON here..." style={{ width: '100%', height: 200, padding: 8, fontSize: 12, fontFamily: 'monospace', borderRadius: 5, border: '1px solid var(--gem-border)', background: 'var(--gem-well)', color: 'var(--gem-text)', resize: 'vertical' }} />
            {error && <span style={{ fontSize: 12, color: 'var(--gem-danger)' }}>{error}</span>}
            <button onClick={handlePreview} disabled={loading || !jsonText.trim()} style={{ padding: '6px 16px', fontSize: 12, borderRadius: 5, border: 'none', background: 'var(--gem-accent)', color: '#fff', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Validating...' : 'Preview Import'}
            </button>
          </>
        )}

        {step === 'preview' && preview && (
          <>
            <div style={{ fontSize: 12, color: 'var(--gem-text)' }}>
              <div>Create: <strong>{(preview.preview as Record<string, unknown>)?.to_create as number ?? 0}</strong></div>
              <div>Update: <strong>{(preview.preview as Record<string, unknown>)?.to_update as number ?? 0}</strong></div>
              <div>Skip: <strong>{(preview.preview as Record<string, unknown>)?.to_skip as number ?? 0}</strong></div>
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
              <div>Created: <strong>{result.created as number}</strong></div>
              <div>Updated: <strong>{result.updated as number}</strong></div>
              <div>Skipped: <strong>{result.skipped as number}</strong></div>
              {((result.errors as unknown[])?.length ?? 0) > 0 && <div style={{ color: 'var(--gem-danger)' }}>Errors: {(result.errors as unknown[]).length}</div>}
            </div>
            <button onClick={onClose} style={{ padding: '6px 16px', fontSize: 12, borderRadius: 5, border: 'none', background: 'var(--gem-accent)', color: '#fff', cursor: 'pointer' }}>Done</button>
          </>
        )}
      </div>
    </div>
  )
}
