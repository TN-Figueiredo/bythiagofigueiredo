'use client'

import { useState, useTransition } from 'react'

interface SlotFormData {
  isEnabled: boolean
  headline: string
  body: string
  ctaText: string
  ctaUrl: string
  imageUrl: string
  brandColor: string
  logoUrl: string
  dismissAfterMs: number
}

interface SlotFormProps {
  slotKey: string
  initial: SlotFormData
  onSave: (slotId: string, data: Partial<SlotFormData>) => Promise<void>
  onChange: (data: SlotFormData) => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

export function SlotForm({ slotKey, initial, onSave, onChange }: SlotFormProps) {
  const [form, setForm] = useState<SlotFormData>(initial)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function update(patch: Partial<SlotFormData>) {
    const next = { ...form, ...patch }
    setForm(next)
    onChange(next)
    setSaved(false)
  }

  function handleSave() {
    startTransition(async () => {
      await onSave(slotKey, form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const format = slotKey.split(':')[2] ?? ''

  const showBody = format !== 'banner'
  const showLogo = !['banner', 'bowtie'].includes(format)
  const showDismiss = ['banner', 'bookmark', 'coda'].includes(format)
  const showImage = false

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isEnabled}
            onChange={(e) => update({ isEnabled: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          Habilitado
        </label>
      </div>

      <Field label="Título / Headline">
        <input
          type="text"
          value={form.headline}
          onChange={(e) => update({ headline: e.target.value })}
          className={inputClass}
          placeholder="Anuncie aqui"
        />
      </Field>

      {showBody && (
        <Field label="Corpo">
          <textarea
            value={form.body}
            onChange={(e) => update({ body: e.target.value })}
            className={`${inputClass} resize-none`}
            rows={2}
            placeholder="Alcance nossos leitores."
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Texto do CTA">
          <input
            type="text"
            value={form.ctaText}
            onChange={(e) => update({ ctaText: e.target.value })}
            className={inputClass}
            placeholder="Saiba mais"
          />
        </Field>
        <Field label="URL do CTA">
          <input
            type="text"
            value={form.ctaUrl}
            onChange={(e) => update({ ctaUrl: e.target.value })}
            className={inputClass}
            placeholder="/anuncie"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Cor da marca">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.brandColor}
              onChange={(e) => update({ brandColor: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded border border-border"
              title={form.brandColor}
            />
            <input
              type="text"
              value={form.brandColor}
              onChange={(e) => update({ brandColor: e.target.value })}
              className={`${inputClass} flex-1`}
              placeholder="#f97316"
            />
          </div>
        </Field>

        {showLogo && (
          <Field label="URL do logo">
            <input
              type="text"
              value={form.logoUrl}
              onChange={(e) => update({ logoUrl: e.target.value })}
              className={inputClass}
              placeholder="https://..."
            />
          </Field>
        )}
      </div>

      {showImage && (
        <Field label="URL da imagem">
          <input
            type="text"
            value={form.imageUrl}
            onChange={(e) => update({ imageUrl: e.target.value })}
            className={inputClass}
            placeholder="https://..."
          />
        </Field>
      )}

      {showDismiss && (
        <Field label="Auto-dismiss (ms, 0 = desabilitado)">
          <input
            type="number"
            value={form.dismissAfterMs}
            onChange={(e) => update({ dismissAfterMs: Number(e.target.value) || 0 })}
            className={inputClass}
            min={0}
            step={1000}
          />
        </Field>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? 'Salvando...' : 'Salvar'}
        </button>
        {saved && (
          <span className="text-xs text-green-600">Salvo com sucesso</span>
        )}
      </div>
    </div>
  )
}
