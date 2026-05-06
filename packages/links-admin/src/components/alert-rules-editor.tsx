'use client'
import { useState } from 'react'
import type { AlertRule } from '../types'

export interface AlertRulesEditorProps {
  rules: AlertRule[]
  onSave: (rule: Omit<AlertRule, 'id'>) => Promise<{ ok: boolean }>
  onDelete: (id: string) => Promise<{ ok: boolean }>
}

type NewRuleForm = {
  metric: AlertRule['metric']
  condition: AlertRule['condition']
  threshold: number
  window: AlertRule['window']
  channel: AlertRule['channel']
  webhookUrl: string
}

const EMPTY_FORM: NewRuleForm = {
  metric: 'clicks',
  condition: 'gt',
  threshold: 100,
  window: '24h',
  channel: 'email',
  webhookUrl: '',
}

export function AlertRulesEditor({ rules, onSave, onDelete }: AlertRulesEditorProps) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewRuleForm>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave({
        metric: form.metric,
        condition: form.condition,
        threshold: form.threshold,
        window: form.window,
        channel: form.channel,
        webhookUrl: form.channel === 'webhook' ? form.webhookUrl : undefined,
        active: true,
      })
      setShowForm(false)
      setForm(EMPTY_FORM)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Alert Rules</h3>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Rule
        </button>
      </div>

      {/* Existing rules */}
      <div className="space-y-2">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center justify-between rounded-lg border border bg-card p-3"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={rule.active}
                readOnly
                className="h-4 w-4 rounded border"
              />
              <div className="text-sm">
                <span className="font-medium">{rule.metric}</span>
                <span className="mx-1 text-muted-foreground">{rule.condition}</span>
                <span className="font-bold">{rule.threshold}</span>
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">
                  {rule.window}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">{rule.channel}</span>
              </div>
            </div>
            <button
              type="button"
              aria-label="Delete rule"
              onClick={() => onDelete(rule.id)}
              className="rounded p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {/* New rule form */}
      {showForm && (
        <div className="space-y-3 rounded-lg border border bg-primary/10 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="alert-metric" className="block text-xs font-medium text-foreground">
                Metric
              </label>
              <select
                id="alert-metric"
                value={form.metric}
                onChange={(e) =>
                  setForm((f) => ({ ...f, metric: e.target.value as AlertRule['metric'] }))
                }
                className="mt-1 block w-full rounded-md border border px-2 py-1.5 text-sm"
              >
                <option value="clicks">clicks</option>
                <option value="unique_visitors">unique_visitors</option>
                <option value="bounce_rate">bounce_rate</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="alert-condition"
                className="block text-xs font-medium text-foreground"
              >
                Condition
              </label>
              <select
                id="alert-condition"
                value={form.condition}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    condition: e.target.value as AlertRule['condition'],
                  }))
                }
                className="mt-1 block w-full rounded-md border border px-2 py-1.5 text-sm"
              >
                <option value="gt">Greater than</option>
                <option value="lt">Less than</option>
                <option value="eq">Equal to</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="alert-threshold"
                className="block text-xs font-medium text-foreground"
              >
                Threshold
              </label>
              <input
                id="alert-threshold"
                type="number"
                min={0}
                value={form.threshold}
                onChange={(e) =>
                  setForm((f) => ({ ...f, threshold: Number(e.target.value) }))
                }
                className="mt-1 block w-full rounded-md border border px-2 py-1.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="alert-window" className="block text-xs font-medium text-foreground">
                Window
              </label>
              <select
                id="alert-window"
                value={form.window}
                onChange={(e) =>
                  setForm((f) => ({ ...f, window: e.target.value as AlertRule['window'] }))
                }
                className="mt-1 block w-full rounded-md border border px-2 py-1.5 text-sm"
              >
                <option value="1h">1h</option>
                <option value="6h">6h</option>
                <option value="24h">24h</option>
                <option value="7d">7d</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="alert-channel"
                className="block text-xs font-medium text-foreground"
              >
                Channel
              </label>
              <select
                id="alert-channel"
                value={form.channel}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    channel: e.target.value as AlertRule['channel'],
                  }))
                }
                className="mt-1 block w-full rounded-md border border px-2 py-1.5 text-sm"
              >
                <option value="email">email</option>
                <option value="webhook">webhook</option>
              </select>
            </div>

            {form.channel === 'webhook' && (
              <div className="col-span-full">
                <label
                  htmlFor="alert-webhook-url"
                  className="block text-xs font-medium text-foreground"
                >
                  Webhook URL
                </label>
                <input
                  id="alert-webhook-url"
                  type="url"
                  value={form.webhookUrl}
                  onChange={(e) => setForm((f) => ({ ...f, webhookUrl: e.target.value }))}
                  placeholder="https://hooks.example.com/..."
                  className="mt-1 block w-full rounded-md border border px-2 py-1.5 text-sm"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setForm(EMPTY_FORM)
              }}
              className="rounded-md border border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
