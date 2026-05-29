'use client'

import Link from 'next/link'
import type { PlaylistStatus } from '@/lib/playlists/types'
import { CoworkDeepLink } from '@/components/cms/cowork-deep-link'
import { buildCoworkInstruction } from '@/lib/pipeline/cowork-instructions'

type SaveState = 'saved' | 'saving' | 'error'

interface PlaylistToolbarProps {
  playlistName: string
  status: PlaylistStatus
  saveState: SaveState
  canUndo: boolean
  canRedo: boolean
  zoomPercent: number
  onUndo: () => void
  onRedo: () => void
  onAutoLayout: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomToFit: () => void
  onToggleExportMenu: () => void
  onPrint: () => void
  exportButtonRef: React.RefObject<HTMLButtonElement | null>
  onToggleSettings: () => void
  hasNotes: boolean
  onRefresh: () => void
  onToggleHistory: () => void
}

export function PlaylistToolbar({
  playlistName,
  status,
  saveState,
  canUndo,
  canRedo,
  zoomPercent,
  onUndo,
  onRedo,
  onAutoLayout,
  onZoomIn,
  onZoomOut,
  onZoomToFit,
  onToggleExportMenu,
  onPrint,
  exportButtonRef,
  onToggleSettings,
  hasNotes,
  onRefresh,
  onToggleHistory,
}: PlaylistToolbarProps) {
  const statusColors: Record<PlaylistStatus, string> = {
    draft: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    published: 'bg-green-500/10 text-green-400 border-green-500/20',
    archived: 'bg-white/5 text-white/40 border-white/10',
  }

  const saveIndicator: Record<SaveState, { text: string; color: string }> = {
    saved: { text: 'Saved', color: 'text-green-400/60' },
    saving: { text: 'Saving...', color: 'text-white/40' },
    error: { text: 'Error', color: 'text-red-400' },
  }

  const indicator = saveIndicator[saveState]

  return (
    <div className="flex h-12 items-center justify-between border-b border-white/10 bg-[#0a0a12] px-4">
      {/* Left */}
      <div className="flex items-center gap-3">
        <Link
          href="/cms/playlists"
          className="text-sm text-white/40 transition-colors hover:text-white/70"
        >
          &larr; Playlists
        </Link>
        <span className="text-white/20">|</span>
        <h1 className="text-sm font-semibold text-white">{playlistName}</h1>
        <span
          className={`rounded-md border px-2 py-0.5 text-[0.65rem] font-medium ${statusColors[status]}`}
        >
          {status}
        </span>
      </div>

      {/* Center */}
      <div className={`text-xs ${indicator.color}`}>{indicator.text}</div>

      {/* Right */}
      <div className="flex items-center gap-1">
        <ToolbarButton label="Undo" shortcut="Cmd+Z" disabled={!canUndo} onClick={onUndo}>
          <UndoIcon />
        </ToolbarButton>
        <ToolbarButton label="Redo" shortcut="Cmd+Shift+Z" disabled={!canRedo} onClick={onRedo}>
          <RedoIcon />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-white/10" />
        <ToolbarButton label="Auto-layout" onClick={onAutoLayout}>
          <LayoutIcon />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-white/10" />
        <ToolbarButton label="Zoom out" shortcut="Cmd+-" onClick={onZoomOut}>
          <ZoomOutIcon />
        </ToolbarButton>
        <span className="min-w-[3ch] text-center text-[0.6rem] tabular-nums text-white/30">
          {zoomPercent}%
        </span>
        <ToolbarButton label="Zoom in" shortcut="Cmd+=" onClick={onZoomIn}>
          <ZoomInIcon />
        </ToolbarButton>
        <ToolbarButton label="Zoom to fit" shortcut="Cmd+0" onClick={onZoomToFit}>
          <FitIcon />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-white/10" />
        <ToolbarButton label="Print" shortcut="Cmd+P" onClick={onPrint}>
          <PrintIcon />
        </ToolbarButton>
        <button
          ref={exportButtonRef}
          type="button"
          onClick={onToggleExportMenu}
          aria-label="Export"
          title="Export"
          className="rounded-md px-2 py-1 text-sm text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
        >
          <ExportIcon />
        </button>
        <CoworkDeepLink
          instruction={buildCoworkInstruction('playlist-organize', { name: playlistName })}
          variant="icon"
          label="Cowork"
        />
        <ToolbarButton label="Refresh" onClick={onRefresh}>
          <RefreshIcon />
        </ToolbarButton>
        <ToolbarButton label="Versões (⌘H)" onClick={onToggleHistory}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </ToolbarButton>
        <div className="relative">
          <ToolbarButton label="Settings" onClick={onToggleSettings}>
            <SettingsIcon />
          </ToolbarButton>
          {hasNotes && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-indigo-400" />
          )}
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({
  label,
  shortcut,
  disabled,
  onClick,
  children,
}: {
  label: string
  shortcut?: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md px-2 py-1 text-sm text-white/50 transition-colors hover:bg-white/5 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  )
}

/* ── Inline SVG icons (14x14) ─────────────────────────────────────────── */

function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  )
}

function RedoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
    </svg>
  )
}

function LayoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  )
}

function FitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

function ZoomInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  )
}

function ZoomOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  )
}

function PrintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  )
}

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
