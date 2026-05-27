// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/constants.ts

import type { TrackDef, TrackGroup } from './types'

/* ── Layout constants ──────────────────────────────── */

export const PANEL_W = 170
export const RULER_H = 26
export const DEF_H = 34
export const EMPTY_H = 18
export const MIN_H = 16
export const MAX_H = 120
export const PRIMARY_H = 42
export const HANDLE_H = 4
export const DIVIDER_H = 16

/* ── Zoom ──────────────────────────────────────────── */

export const ZOOM_MIN = 0.3
export const ZOOM_MAX = 4
export const ZOOM_DEFAULT = 1
export const ZOOM_STEP = 0.15

/* ── Track definitions ─────────────────────────────── */

export const TL_TRACKS: TrackGroup = {
  video: [
    { id: 'V7', name: 'Overlays + End Screen', color: '#A3CB38', fn: 'End screen, cards, transições visuais, vignettes' },
    { id: 'V6', name: 'Subtitles',             color: '#F1C40F', fn: 'Captions estilizados (Text+ ou Fusion)' },
    { id: 'V5', name: 'Graphics + QR',         color: '#E84393', fn: 'QR codes, subscribe CTA, logos, infográficos' },
    { id: 'V4', name: 'Lower Thirds',          color: '#9B59B6', fn: 'Nome, localização, chapter titles' },
    { id: 'V3', name: 'B-Roll',                color: '#1ABC9C', fn: 'Cutaways, insert shots' },
    { id: 'V2', name: 'Background Layer',      color: '#A0845C', fn: 'Conteúdo por trás da pessoa (Fusion Magic Mask)' },
    { id: 'V1', name: 'Main Footage',          color: '#C4A882', fn: 'Talking head, A-roll principal' },
  ],
  audio: [
    { id: 'A1', name: 'Voice',            color: '#27AE60', fn: 'Narração, talking head' },
    { id: 'A2', name: 'Music',            color: '#3498DB', fn: 'Bed musical (ducked sob voz)' },
    { id: 'A3', name: 'SFX Punctuation',  color: '#E67E22', fn: 'Impactos, bass drops, risers' },
    { id: 'A4', name: 'SFX Textures',     color: '#F0B27A', fn: 'Whooshes, shimmers, transições' },
    { id: 'A5', name: 'Ambience',         color: '#7D8B5E', fn: 'Room tone, ambience' },
    { id: 'A6', name: 'Sound Design',     color: '#8E44AD', fn: 'Branded sounds, notificações, stingers' },
  ],
}

export const ALL_TRACKS: TrackDef[] = [...TL_TRACKS.video, ...TL_TRACKS.audio]

/* ── Theme tokens (maps to GEM + DaVinci palette) ──── */

export const TH = {
  bg:       'var(--gem-well)',        // #0c1222
  surface:  'var(--gem-surface)',     // #161d2d
  surface2: 'var(--gem-surface-hi)', // #1a2236
  header:   'var(--gem-surface-hi)', // #1a2236
  border:   'var(--gem-border)',     // #222d40
  brdLight: 'var(--gem-faint)',      // #2a3650
  text:     'var(--gem-text)',       // #edf2f7
  muted:    'var(--gem-muted)',      // #7a8ba3
  dim:      'var(--gem-dim)',        // #5a6b7f
  accent:   'var(--gem-accent)',     // #6366f1
  ruler:    '#0e1628',
  playhead: '#e04040',
  divLine:  'rgba(99,102,241,0.18)',
} as const

/* ── Typography class helpers ──────────────────────── */

export const MONO_CLS = 'font-mono'
export const MONO_SM_CLS = 'font-mono text-[10px] tracking-wide'
export const MONO_XS_CLS = 'font-mono text-[10px] tracking-widest uppercase'
