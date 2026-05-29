'use client'

import React, { useState, useCallback, useId } from 'react'
import type { DisplayLabel, TestType } from './ab-constants'
import { VARIANT_COLORS, TYPE_META } from './ab-constants'
import { Image, Type, FileText, Layers } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* --- VChip --- */
export interface VChipProps {
  label: DisplayLabel
  size?: number
  ring?: boolean
  onClick?: () => void
}

export function VChip({ label, size = 22, ring, onClick }: VChipProps) {
  const color = VARIANT_COLORS[label]
  const Tag = onClick ? 'button' : 'span'
  return React.createElement(Tag, {
    'aria-label': `Variant ${label}`,
    ...(onClick ? { role: 'button', onClick, type: 'button' as const } : {}),
    className: 'inline-flex items-center justify-center rounded font-mono font-bold text-white shrink-0',
    style: {
      width: size, height: size, fontSize: size * 0.55, backgroundColor: color,
      ...(ring ? { boxShadow: `0 0 0 2px ${color}44` } : {}),
    },
  }, label)
}

/* --- Badge --- */
const BADGE_TONES = {
  neutral: 'bg-cms-surface text-cms-text-muted',
  accent:  'bg-cms-accent-subtle text-cms-accent',
  green:   'bg-cms-green-subtle text-cms-green',
  amber:   'bg-cms-amber-subtle text-cms-amber',
  cowork:  'text-[var(--cms-cowork)]',
  live:    'bg-cms-red-subtle text-cms-red',
} as const

export type BadgeTone = keyof typeof BADGE_TONES

export interface BadgeProps {
  tone?: BadgeTone
  children: React.ReactNode
  dot?: boolean
  className?: string
}

export function Badge({ tone = 'neutral', children, dot, className = '' }: BadgeProps) {
  const toneClass = tone === 'cowork'
    ? `bg-[var(--cms-cowork-subtle)] ${BADGE_TONES.cowork}`
    : BADGE_TONES[tone]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium tracking-wide uppercase ${toneClass} ${className}`}>
      {dot && <span className="size-1.5 rounded-full bg-current animate-ab-slot-pulse" />}
      {children}
    </span>
  )
}

/* --- InfoTip --- */
export interface InfoTipProps { text: string }

export function InfoTip({ text }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
  }, [])

  return (
    <span className="relative inline-flex" onKeyDown={handleKey}>
      <button
        type="button"
        aria-label="More information"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen(o => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center justify-center size-4 rounded-full text-3xs text-cms-text-dim border border-cms-border-subtle hover:text-cms-text-muted focus-visible:ring-2 focus-visible:ring-cms-accent cursor-help"
      >?</button>
      {open && (
        <span id={id} role="tooltip"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded-lg bg-cms-surface text-2xs text-cms-text shadow-popover whitespace-nowrap z-tooltip animate-ab-fade-up"
        >{text}</span>
      )}
    </span>
  )
}

/* --- TypeBadge --- */
export interface TypeBadgeProps { type: TestType }

const TYPE_ICONS: Record<TestType, LucideIcon> = { thumbnail: Image, title: Type, description: FileText, combo: Layers }

export function TypeBadge({ type }: TypeBadgeProps) {
  const meta = TYPE_META[type]
  const Icon = TYPE_ICONS[type]
  return (
    <Badge tone="neutral" className="gap-1.5">
      <Icon size={11} aria-hidden="true" />
      {meta.label}
    </Badge>
  )
}

/* --- Seg --- */
export interface SegProps<T extends string> {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  labels?: Partial<Record<T, string>>
}

export function Seg<T extends string>({ options, value, onChange, labels }: SegProps<T>) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const idx = options.indexOf(value)
    if (idx < 0) return
    let next = idx
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); next = (idx + 1) % options.length }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); next = (idx - 1 + options.length) % options.length }
    if (next !== idx) onChange(options[next]!)
  }, [options, value, onChange])

  return (
    <div role="radiogroup" className="inline-flex rounded-lg bg-cms-surface p-0.5 gap-0.5" onKeyDown={handleKeyDown}>
      {options.map(opt => (
        <button key={opt} type="button" role="radio" aria-checked={opt === value}
          onClick={() => onChange(opt)} tabIndex={opt === value ? 0 : -1}
          className={`px-2.5 py-1 text-2xs font-medium rounded-md transition-colors duration-150 ${opt === value ? 'bg-cms-accent text-white' : 'text-cms-text-muted hover:text-cms-text'}`}
        >{labels?.[opt] ?? opt}</button>
      ))}
    </div>
  )
}

/* --- Toggle --- */
export interface ToggleProps { checked: boolean; onChange: (v: boolean) => void; id?: string }

export function Toggle({ checked, onChange, id }: ToggleProps) {
  return (
    <button id={id} type="button" role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:ring-offset-1 ${checked ? 'bg-cms-accent' : 'bg-cms-surface'}`}
    >
      <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform duration-200 ${checked ? 'translate-x-4' : ''}`} />
    </button>
  )
}

/* --- NumberField --- */
export interface NumberFieldProps { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }

export function NumberField({ value, onChange, min = 0, max = 100, step = 1, suffix }: NumberFieldProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clamp(value + step)) }
    if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(value - step)) }
  }
  return (
    <div className="inline-flex items-center gap-1" role="spinbutton" aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}
      aria-valuetext={suffix ? `${value} ${suffix}` : String(value)} tabIndex={0} onKeyDown={handleKey}>
      <button type="button" onClick={() => onChange(clamp(value - step))} className="size-6 rounded bg-cms-surface text-cms-text-muted hover:text-cms-text flex items-center justify-center" aria-label="Decrease">-</button>
      <span className="min-w-[2.5rem] text-center text-xs font-mono">{value}{suffix && <span className="text-cms-text-dim ml-0.5">{suffix}</span>}</span>
      <button type="button" onClick={() => onChange(clamp(value + step))} className="size-6 rounded bg-cms-surface text-cms-text-muted hover:text-cms-text flex items-center justify-center" aria-label="Increase">+</button>
    </div>
  )
}

/* --- CheckRow --- */
export interface CheckRowProps { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }

export function CheckRow({ checked, onChange, label, hint }: CheckRowProps) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 py-1.5 cursor-pointer group">
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-cms-border accent-cms-accent transition-colors duration-150" />
      <span className="flex-1">
        <span className="text-xs text-cms-text">{label}</span>
        {hint && <span className="block text-2xs text-cms-text-dim mt-0.5">{hint}</span>}
      </span>
    </label>
  )
}

/* --- Slider --- */
export interface SliderProps { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string }

export function Slider({ value, onChange, min = 0, max = 100, step = 1, format }: SliderProps) {
  return (
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-valuetext={format ? format(value) : String(value)}
        className="flex-1 h-1 rounded-full appearance-none bg-cms-surface accent-cms-accent" />
      <span className="text-xs font-mono text-cms-text-muted min-w-[2.5rem] text-right">{format ? format(value) : value}</span>
    </div>
  )
}

/* --- CfgRow --- */
export interface CfgRowProps { label: string; htmlFor?: string; children: React.ReactNode; hint?: string }

export function CfgRow({ label, htmlFor, children, hint }: CfgRowProps) {
  const labelId = useId()
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex-1 min-w-0">
        <label id={labelId} htmlFor={htmlFor} className="text-xs text-cms-text">{label}</label>
        {hint && <p className="text-2xs text-cms-text-dim mt-0.5">{hint}</p>}
      </div>
      <div aria-labelledby={labelId}>{children}</div>
    </div>
  )
}

/* --- SectionLabel --- */
export interface SectionLabelProps { children: React.ReactNode; as?: 'h2' | 'h3' | 'h4' | 'div'; right?: React.ReactNode }

export function SectionLabel({ children, as: Tag = 'h3', right }: SectionLabelProps) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <Tag className="text-xs font-semibold uppercase tracking-wider text-cms-text-dim">{children}</Tag>
      {right && <div>{right}</div>}
    </div>
  )
}

/* --- Legend --- */
export interface LegendProps { items: Array<{ label: string; color: string }> }

export function Legend({ items }: LegendProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map(it => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-2xs text-cms-text-muted">
          <span className="size-2.5 rounded-sm shrink-0" style={{ backgroundColor: it.color }} aria-hidden="true" />
          {it.label}
        </span>
      ))}
    </div>
  )
}
