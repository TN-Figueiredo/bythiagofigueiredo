'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  saveLinkSettings,
  saveUtmPreset,
  deleteUtmPreset,
  saveQrTemplate,
  deleteQrTemplate,
} from '../actions'

interface UtmPreset {
  id: string
  name: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
}

interface QrTemplate {
  id: string
  name: string
  config: Record<string, unknown>
}

export default function LinkSettingsPage() {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const [defaultRedirectType, setDefaultRedirectType] = useState(302)
  const [defaultCodeLength, setDefaultCodeLength] = useState(6)
  const [autoQr, setAutoQr] = useState(false)
  const [botFiltering, setBotFiltering] = useState(true)

  const [utmPresets, setUtmPresets] = useState<UtmPreset[]>([])
  const [qrTemplates, setQrTemplates] = useState<QrTemplate[]>([])

  function flash(type: 'ok' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  function handleSaveDefaults() {
    startTransition(async () => {
      const res = await saveLinkSettings({
        default_redirect_type: defaultRedirectType,
        default_code_length: defaultCodeLength,
        auto_qr: autoQr,
        bot_filtering: botFiltering,
      })
      flash(res.ok ? 'ok' : 'error', res.ok ? 'Settings saved' : res.error)
    })
  }

  function handleAddUtmPreset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    startTransition(async () => {
      const res = await saveUtmPreset({
        name: fd.get('name') as string,
        utm_source: fd.get('utm_source') as string,
        utm_medium: fd.get('utm_medium') as string,
        utm_campaign: fd.get('utm_campaign') as string,
      })
      if (res.ok) {
        setUtmPresets((p) => [...p, { id: res.id, name: fd.get('name') as string, utm_source: fd.get('utm_source') as string, utm_medium: fd.get('utm_medium') as string, utm_campaign: fd.get('utm_campaign') as string }])
        form.reset()
        flash('ok', 'Preset added')
      } else {
        flash('error', res.error)
      }
    })
  }

  function handleDeletePreset(id: string) {
    startTransition(async () => {
      const res = await deleteUtmPreset(id)
      if (res.ok) {
        setUtmPresets((p) => p.filter((x) => x.id !== id))
        flash('ok', 'Preset deleted')
      }
    })
  }

  function handleDeleteTemplate(id: string) {
    startTransition(async () => {
      const res = await deleteQrTemplate(id)
      if (res.ok) {
        setQrTemplates((t) => t.filter((x) => x.id !== id))
        flash('ok', 'Template deleted')
      }
    })
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Link Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Site-wide defaults for new links.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-md px-4 py-2 text-sm ${message.type === 'ok' ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'}`}
          data-testid="settings-message"
        >
          {message.text}
        </div>
      )}

      {/* Default behavior */}
      <section className="space-y-4 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Default Behavior</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">Redirect Type</span>
            <select
              value={defaultRedirectType}
              onChange={(e) => setDefaultRedirectType(Number(e.target.value))}
              className="w-full rounded-md border px-3 py-2 text-sm"
              data-testid="settings-redirect-type"
            >
              <option value={302}>302 Temporary</option>
              <option value={301}>301 Permanent</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Code Length</span>
            <input
              type="number"
              min={4}
              max={16}
              value={defaultCodeLength}
              onChange={(e) => setDefaultCodeLength(Number(e.target.value))}
              className="w-full rounded-md border px-3 py-2 text-sm"
              data-testid="settings-code-length"
            />
          </label>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoQr}
              onChange={(e) => setAutoQr(e.target.checked)}
              data-testid="settings-auto-qr"
            />
            Auto-generate QR on creation
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={botFiltering}
              onChange={(e) => setBotFiltering(e.target.checked)}
              data-testid="settings-bot-filtering"
            />
            Filter bot clicks
          </label>
        </div>

        <button
          onClick={handleSaveDefaults}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          data-testid="settings-save-defaults"
        >
          {isPending ? 'Saving…' : 'Save Defaults'}
        </button>
      </section>

      {/* UTM Presets */}
      <section className="space-y-4 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">UTM Presets</h2>

        {utmPresets.length > 0 && (
          <div className="space-y-2">
            {utmPresets.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                <span className="font-medium">{p.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    {[p.utm_source, p.utm_medium, p.utm_campaign].filter(Boolean).join(' / ')}
                  </span>
                  <button
                    onClick={() => handleDeletePreset(p.id)}
                    className="text-red-600 hover:text-red-800 text-xs"
                    data-testid={`delete-preset-${p.id}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddUtmPreset} className="grid gap-3 sm:grid-cols-4">
          <input name="name" required placeholder="Preset name" className="rounded-md border px-3 py-2 text-sm" data-testid="preset-name" />
          <input name="utm_source" placeholder="utm_source" className="rounded-md border px-3 py-2 text-sm" data-testid="preset-source" />
          <input name="utm_medium" placeholder="utm_medium" className="rounded-md border px-3 py-2 text-sm" data-testid="preset-medium" />
          <div className="flex gap-2">
            <input name="utm_campaign" placeholder="utm_campaign" className="rounded-md border px-3 py-2 text-sm flex-1" data-testid="preset-campaign" />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-secondary px-3 py-2 text-sm font-medium hover:bg-secondary/80 disabled:opacity-50"
              data-testid="preset-add"
            >
              Add
            </button>
          </div>
        </form>
      </section>

      {/* QR Templates */}
      <section className="space-y-4 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">QR Templates</h2>
        <p className="text-sm text-muted-foreground">
          Saved QR code styling presets. Create templates from the QR composer on any link detail page.
        </p>

        {qrTemplates.length > 0 ? (
          <div className="space-y-2">
            {qrTemplates.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                <span className="font-medium">{t.name}</span>
                <button
                  onClick={() => handleDeleteTemplate(t.id)}
                  className="text-red-600 hover:text-red-800 text-xs"
                  data-testid={`delete-template-${t.id}`}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No templates yet. Save a template from the QR composer.
          </p>
        )}
      </section>
    </div>
  )
}
