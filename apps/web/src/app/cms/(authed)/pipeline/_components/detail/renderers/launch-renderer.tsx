'use client'

import { useState } from 'react'
import type { RendererProps } from '../section-content'
import {
  LaunchContentSchema,
  MENTAL_TRIGGER_KEYS,
  TRIGGER_LABELS,
  type LaunchContent,
} from '@/lib/pipeline/launch-schemas'

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

const LAUNCH_TYPE_LABELS: Record<string, string> = {
  seed: 'Semente',
  internal: 'Interno',
  jv: 'Joint Venture',
  evergreen: 'Evergreen',
}

const THEME_COLORS: Record<string, string> = {
  opportunity: '#3b82f6',
  teaching: '#8b5cf6',
  ownership: '#10b981',
}

const THEME_LABELS: Record<string, string> = {
  opportunity: 'Oportunidade',
  teaching: 'Ensino',
  ownership: 'Posse',
}

const STATUS_COLORS: Record<string, string> = {
  planned: 'var(--gem-dim)',
  drafted: 'var(--gem-accent)',
  produced: 'var(--gem-warn)',
  published: 'var(--gem-done)',
}

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planejado',
  drafted: 'Rascunho',
  produced: 'Produzido',
  published: 'Publicado',
}

const BONUS_TYPE_LABELS: Record<string, string> = {
  content: 'Conteúdo',
  access: 'Acesso',
  tool: 'Ferramenta',
  community: 'Comunidade',
  coaching: 'Coaching',
}

const CONTENT_FORMAT_LABELS: Record<string, string> = {
  video: 'Vídeo',
  blog: 'Blog',
  email: 'Email',
  live: 'Live',
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[10px] font-semibold uppercase tracking-wider mb-2"
      style={{ color: 'var(--gem-dim)' }}
    >
      {children}
    </div>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function parseLaunch(content: RendererProps['content']): LaunchContent {
  const raw = typeof content === 'string' ? {} : (content ?? {})
  const result = LaunchContentSchema.safeParse(raw)
  return result.success ? result.data : LaunchContentSchema.parse({})
}

// ──────────────────────────────────────────────────────────────
// Read Mode sub-components
// ──────────────────────────────────────────────────────────────

function PlcCard({ item }: { item: LaunchContent['plc_sequence'][number] }) {
  const themeColor = THEME_COLORS[item.theme] ?? 'var(--gem-accent)'
  const statusColor = STATUS_COLORS[item.status] ?? 'var(--gem-dim)'

  return (
    <div
      className="p-3 rounded-lg flex flex-col gap-2"
      style={{
        background: 'var(--gem-well)',
        border: `1px solid ${themeColor}44`,
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          style={{ background: themeColor, color: '#fff' }}
        >
          {item.number}
        </span>
        <Badge label={THEME_LABELS[item.theme] ?? item.theme} color={themeColor} />
        <span className="ml-auto">
          <Badge label={STATUS_LABELS[item.status] ?? item.status} color={statusColor} />
        </span>
      </div>

      {/* Title */}
      <div className="text-[12px] font-semibold leading-snug" style={{ color: 'var(--gem-text)' }}>
        {item.title || <span style={{ color: 'var(--gem-dim)', fontStyle: 'italic' }}>Sem título</span>}
      </div>

      {/* Key message */}
      {item.key_message && (
        <div className="text-[11px] leading-relaxed" style={{ color: 'var(--gem-muted)' }}>
          {item.key_message}
        </div>
      )}

      {/* Date + format */}
      <div className="flex items-center gap-2 flex-wrap mt-auto">
        {item.planned_date && (
          <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>
            {formatDate(item.planned_date)}
          </span>
        )}
        <Badge
          label={CONTENT_FORMAT_LABELS[item.content_format] ?? item.content_format}
          color="var(--gem-dim)"
        />
      </div>

      {/* Mental trigger tags */}
      {item.mental_triggers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.mental_triggers.map((t) => (
            <span
              key={t}
              className="text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(167,139,250,0.12)', color: 'var(--gem-accent)' }}
            >
              {TRIGGER_LABELS[t] ?? t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Edit Mode sub-components
// ──────────────────────────────────────────────────────────────

function PlcCardEdit({
  item,
  onChange,
}: {
  item: LaunchContent['plc_sequence'][number]
  onChange: (updated: LaunchContent['plc_sequence'][number]) => void
}) {
  const themeColor = THEME_COLORS[item.theme] ?? 'var(--gem-accent)'

  return (
    <div
      className="p-3 rounded-lg flex flex-col gap-2"
      style={{ background: 'var(--gem-well)', border: `1px solid ${themeColor}44` }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          style={{ background: themeColor, color: '#fff' }}
        >
          {item.number}
        </span>
        <Badge label={THEME_LABELS[item.theme] ?? item.theme} color={themeColor} />
      </div>

      <input
        type="text"
        value={item.title}
        placeholder="Título do PLC..."
        onChange={(e) => onChange({ ...item, title: e.target.value })}
        className="w-full text-[11px] p-2 rounded-md"
        style={{
          background: 'var(--gem-surface)',
          border: '1px solid var(--gem-border)',
          color: 'var(--gem-text)',
        }}
      />

      <textarea
        value={item.key_message}
        placeholder="Mensagem principal..."
        onChange={(e) => onChange({ ...item, key_message: e.target.value })}
        rows={2}
        className="w-full text-[11px] p-2 rounded-md resize-none"
        style={{
          background: 'var(--gem-surface)',
          border: '1px solid var(--gem-border)',
          color: 'var(--gem-text)',
        }}
      />

      <div className="flex gap-2">
        <select
          value={item.content_format}
          onChange={(e) =>
            onChange({
              ...item,
              content_format: e.target.value as LaunchContent['plc_sequence'][number]['content_format'],
            })
          }
          className="flex-1 text-[10px] p-1.5 rounded-md"
          style={{
            background: 'var(--gem-surface)',
            border: '1px solid var(--gem-border)',
            color: 'var(--gem-muted)',
          }}
        >
          {Object.entries(CONTENT_FORMAT_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <select
          value={item.status}
          onChange={(e) =>
            onChange({
              ...item,
              status: e.target.value as LaunchContent['plc_sequence'][number]['status'],
            })
          }
          className="flex-1 text-[10px] p-1.5 rounded-md"
          style={{
            background: 'var(--gem-surface)',
            border: '1px solid var(--gem-border)',
            color: 'var(--gem-muted)',
          }}
        >
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <input
        type="date"
        value={item.planned_date ?? ''}
        onChange={(e) => onChange({ ...item, planned_date: e.target.value || null })}
        className="w-full text-[10px] p-1.5 rounded-md"
        style={{
          background: 'var(--gem-surface)',
          border: '1px solid var(--gem-border)',
          color: 'var(--gem-muted)',
        }}
      />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────

export function LaunchRenderer({ content, isEditing, onContentChange }: RendererProps) {
  const launch = parseLaunch(content)
  const [bonusError, setBonusError] = useState<string | null>(null)

  function update(patch: Partial<LaunchContent>) {
    onContentChange({ ...launch, ...patch } as Record<string, unknown>)
  }

  function updatePlc(idx: number, updated: LaunchContent['plc_sequence'][number]) {
    const next = [...launch.plc_sequence]
    next[idx] = updated
    update({ plc_sequence: next })
  }

  function addBonus() {
    setBonusError(null)
    update({ bonuses: [...launch.bonuses, { title: '', description: '', type: 'content', deadline: null }] })
  }

  function removeBonus(idx: number) {
    update({ bonuses: launch.bonuses.filter((_, i) => i !== idx) })
  }

  function updateBonus(idx: number, patch: Partial<LaunchContent['bonuses'][number]>) {
    const next = [...launch.bonuses]
    next[idx] = { ...next[idx], ...patch } as LaunchContent['bonuses'][number]
    update({ bonuses: next })
  }

  // ── Read mode ──────────────────────────────────────────────

  if (!isEditing) {
    const triggers = launch.mental_triggers as Record<string, string | null>

    return (
      <div className="p-5 space-y-5">
        {/* Launch type */}
        <div className="flex items-center gap-2">
          <SectionLabel>Tipo de Lançamento</SectionLabel>
          <Badge
            label={LAUNCH_TYPE_LABELS[launch.launch_type] ?? launch.launch_type}
            color="var(--gem-accent)"
          />
        </div>

        {/* PLC Sequence */}
        <div>
          <SectionLabel>Sequência PLC</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            {launch.plc_sequence.map((item) => (
              <PlcCard key={item.number} item={item} />
            ))}
          </div>
        </div>

        {/* Cart dates */}
        <div>
          <SectionLabel>Datas do Carrinho</SectionLabel>
          <div
            className="grid grid-cols-3 gap-3 p-3 rounded-lg"
            style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
          >
            <div>
              <div className="text-[9px] mb-1" style={{ color: 'var(--gem-dim)' }}>Abertura</div>
              <div className="text-[11px] font-medium" style={{ color: 'var(--gem-text)' }}>
                {formatDate(launch.cart_open_date)}
              </div>
            </div>
            <div>
              <div className="text-[9px] mb-1" style={{ color: 'var(--gem-dim)' }}>Fechamento</div>
              <div className="text-[11px] font-medium" style={{ color: 'var(--gem-text)' }}>
                {formatDate(launch.cart_close_date)}
              </div>
            </div>
            <div>
              <div className="text-[9px] mb-1" style={{ color: 'var(--gem-dim)' }}>Early Bird</div>
              <div className="text-[11px] font-medium" style={{ color: 'var(--gem-text)' }}>
                {formatDate(launch.early_bird_deadline)}
              </div>
            </div>
          </div>
        </div>

        {/* Mental triggers */}
        <div>
          <SectionLabel>Gatilhos Mentais</SectionLabel>
          <div className="space-y-1.5">
            {MENTAL_TRIGGER_KEYS.map((key) => {
              const val = triggers[key]
              const filled = !!val
              return (
                <div
                  key={key}
                  className="flex items-start gap-2.5 p-2 rounded-md"
                  style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
                >
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center text-[9px]"
                    style={{
                      background: filled ? 'rgba(16,185,129,0.2)' : 'var(--gem-surface)',
                      border: `1px solid ${filled ? '#10b981' : 'var(--gem-border)'}`,
                      color: filled ? '#10b981' : 'var(--gem-dim)',
                    }}
                  >
                    {filled ? '✓' : ''}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold mb-0.5" style={{ color: filled ? 'var(--gem-text)' : 'var(--gem-dim)' }}>
                      {TRIGGER_LABELS[key]}
                    </div>
                    {filled && (
                      <div className="text-[11px] leading-relaxed" style={{ color: 'var(--gem-muted)' }}>
                        {val}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bonuses */}
        {launch.bonuses.length > 0 && (
          <div>
            <SectionLabel>Bônus ({launch.bonuses.length})</SectionLabel>
            <div className="space-y-2">
              {launch.bonuses.map((bonus, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg flex items-start gap-3"
                  style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[12px] font-semibold" style={{ color: 'var(--gem-text)' }}>
                        {bonus.title}
                      </span>
                      <Badge
                        label={BONUS_TYPE_LABELS[bonus.type] ?? bonus.type}
                        color="var(--gem-accent)"
                      />
                      {bonus.deadline && (
                        <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>
                          até {formatDate(bonus.deadline)}
                        </span>
                      )}
                    </div>
                    {bonus.description && (
                      <div className="text-[11px]" style={{ color: 'var(--gem-muted)' }}>
                        {bonus.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {launch.notes && (
          <div>
            <SectionLabel>Notas</SectionLabel>
            <pre
              className="text-[11px] leading-relaxed whitespace-pre-wrap p-3 rounded-lg"
              style={{
                background: 'var(--gem-well)',
                border: '1px solid var(--gem-border)',
                color: 'var(--gem-muted)',
                fontFamily: 'inherit',
              }}
            >
              {launch.notes}
            </pre>
          </div>
        )}
      </div>
    )
  }

  // ── Edit mode ──────────────────────────────────────────────

  const triggers = launch.mental_triggers as Record<string, string | null>

  return (
    <div className="p-5 space-y-5">
      {/* Launch type selector */}
      <div>
        <SectionLabel>Tipo de Lançamento</SectionLabel>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(LAUNCH_TYPE_LABELS).map(([val, label]) => (
            <button
              key={val}
              onClick={() => update({ launch_type: val as LaunchContent['launch_type'] })}
              className="text-[11px] px-3 py-1.5 rounded-md font-medium transition-opacity"
              style={
                launch.launch_type === val
                  ? { background: 'var(--gem-accent)', color: '#fff' }
                  : { background: 'var(--gem-well)', color: 'var(--gem-muted)', border: '1px solid var(--gem-border)' }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* PLC Cards */}
      <div>
        <SectionLabel>Sequência PLC</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          {launch.plc_sequence.map((item, idx) => (
            <PlcCardEdit key={item.number} item={item} onChange={(updated) => updatePlc(idx, updated)} />
          ))}
        </div>
      </div>

      {/* Cart dates */}
      <div>
        <SectionLabel>Datas do Carrinho</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-[10px] mb-1" style={{ color: 'var(--gem-dim)' }}>Abertura do Carrinho</div>
            <input
              type="date"
              value={launch.cart_open_date ?? ''}
              onChange={(e) => update({ cart_open_date: e.target.value || null })}
              className="w-full text-[11px] p-2 rounded-md"
              style={{
                background: 'var(--gem-well)',
                border: '1px solid var(--gem-border)',
                color: 'var(--gem-text)',
              }}
            />
          </div>
          <div>
            <div className="text-[10px] mb-1" style={{ color: 'var(--gem-dim)' }}>Fechamento do Carrinho</div>
            <input
              type="date"
              value={launch.cart_close_date ?? ''}
              onChange={(e) => update({ cart_close_date: e.target.value || null })}
              className="w-full text-[11px] p-2 rounded-md"
              style={{
                background: 'var(--gem-well)',
                border: '1px solid var(--gem-border)',
                color: 'var(--gem-text)',
              }}
            />
          </div>
          <div>
            <div className="text-[10px] mb-1" style={{ color: 'var(--gem-dim)' }}>Prazo Early Bird</div>
            <input
              type="date"
              value={launch.early_bird_deadline ?? ''}
              onChange={(e) => update({ early_bird_deadline: e.target.value || null })}
              className="w-full text-[11px] p-2 rounded-md"
              style={{
                background: 'var(--gem-well)',
                border: '1px solid var(--gem-border)',
                color: 'var(--gem-text)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Mental triggers */}
      <div>
        <SectionLabel>Gatilhos Mentais</SectionLabel>
        <div className="space-y-2">
          {MENTAL_TRIGGER_KEYS.map((key) => (
            <div key={key}>
              <div className="text-[10px] mb-1" style={{ color: 'var(--gem-dim)' }}>{TRIGGER_LABELS[key]}</div>
              <textarea
                value={triggers[key] ?? ''}
                placeholder={`Como você vai usar ${(TRIGGER_LABELS[key] ?? key).toLowerCase()}...`}
                onChange={(e) =>
                  update({ mental_triggers: { ...launch.mental_triggers, [key]: e.target.value || null } })
                }
                rows={2}
                className="w-full text-[11px] p-2 rounded-md resize-none"
                style={{
                  background: 'var(--gem-well)',
                  border: '1px solid var(--gem-border)',
                  color: 'var(--gem-text)',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bonuses */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Bônus ({launch.bonuses.length})</SectionLabel>
          <button
            onClick={addBonus}
            className="text-[10px] px-2 py-1 rounded"
            style={{ background: 'var(--gem-well)', color: 'var(--gem-accent)', border: '1px solid var(--gem-border)' }}
          >
            + Adicionar
          </button>
        </div>
        {bonusError && (
          <div className="text-[10px] mb-2" style={{ color: '#f87171' }}>{bonusError}</div>
        )}
        <div className="space-y-3">
          {launch.bonuses.map((bonus, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg"
              style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold" style={{ color: 'var(--gem-dim)' }}>
                  Bônus {idx + 1}
                </span>
                <button
                  onClick={() => removeBonus(idx)}
                  className="text-[10px] px-2 py-0.5 rounded"
                  style={{ color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}
                >
                  Remover
                </button>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={bonus.title}
                  placeholder="Título do bônus..."
                  onChange={(e) => updateBonus(idx, { title: e.target.value })}
                  className="w-full text-[11px] p-2 rounded-md"
                  style={{
                    background: 'var(--gem-surface)',
                    border: '1px solid var(--gem-border)',
                    color: 'var(--gem-text)',
                  }}
                />
                <textarea
                  value={bonus.description}
                  placeholder="Descrição do bônus..."
                  onChange={(e) => updateBonus(idx, { description: e.target.value })}
                  rows={2}
                  className="w-full text-[11px] p-2 rounded-md resize-none"
                  style={{
                    background: 'var(--gem-surface)',
                    border: '1px solid var(--gem-border)',
                    color: 'var(--gem-text)',
                  }}
                />
                <div className="flex gap-2">
                  <select
                    value={bonus.type}
                    onChange={(e) =>
                      updateBonus(idx, { type: e.target.value as LaunchContent['bonuses'][number]['type'] })
                    }
                    className="flex-1 text-[10px] p-1.5 rounded-md"
                    style={{
                      background: 'var(--gem-surface)',
                      border: '1px solid var(--gem-border)',
                      color: 'var(--gem-muted)',
                    }}
                  >
                    {Object.entries(BONUS_TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={bonus.deadline ?? ''}
                    onChange={(e) => updateBonus(idx, { deadline: e.target.value || null })}
                    className="flex-1 text-[10px] p-1.5 rounded-md"
                    style={{
                      background: 'var(--gem-surface)',
                      border: '1px solid var(--gem-border)',
                      color: 'var(--gem-muted)',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <SectionLabel>Notas</SectionLabel>
        <textarea
          value={launch.notes}
          placeholder="Anotações gerais sobre o lançamento..."
          onChange={(e) => update({ notes: e.target.value })}
          rows={4}
          className="w-full text-[11px] p-3 rounded-lg resize-none"
          style={{
            background: 'var(--gem-well)',
            border: '1px solid var(--gem-border)',
            color: 'var(--gem-text)',
          }}
        />
      </div>
    </div>
  )
}
