import { gemMix } from './gem-design'

export interface FormatColor {
  accent: string
  bg: string
  text: string
  border: string
}

const DEFAULT_COLOR: FormatColor = { accent: 'var(--gem-accent)', bg: gemMix('--gem-accent', 8), text: 'var(--gem-muted)', border: gemMix('--gem-accent', 25) }

export function getFormatColor(format: string): FormatColor {
  return FORMAT_COLORS[format] ?? DEFAULT_COLOR
}

export const FORMAT_COLORS: Record<string, FormatColor> = {
  video: { accent: 'var(--gem-danger)', bg: gemMix('--gem-danger', 8), text: 'var(--gem-danger)', border: gemMix('--gem-danger', 25) },
  blog_post: { accent: 'var(--gem-warn)', bg: gemMix('--gem-warn', 8), text: 'var(--gem-warn)', border: gemMix('--gem-warn', 25) },
  newsletter: { accent: 'var(--gem-accent)', bg: gemMix('--gem-accent', 8), text: 'var(--gem-muted)', border: gemMix('--gem-accent', 25) },
  course: { accent: '#22d3ee', bg: gemMix('#22d3ee', 8), text: '#22d3ee', border: gemMix('#22d3ee', 25) },
  campaign: { accent: 'var(--gem-done)', bg: gemMix('--gem-done', 8), text: 'var(--gem-done)', border: gemMix('--gem-done', 25) },
}

const PLAYLIST_COLOR_PALETTE: FormatColor[] = [
  { accent: 'var(--gem-warn)', bg: gemMix('--gem-warn', 8), text: 'var(--gem-warn)', border: gemMix('--gem-warn', 25) },
  { accent: 'var(--gem-accent)', bg: gemMix('--gem-accent', 8), text: 'var(--gem-accent)', border: gemMix('--gem-accent', 25) },
  { accent: 'var(--gem-done)', bg: gemMix('--gem-done', 8), text: 'var(--gem-done)', border: gemMix('--gem-done', 25) },
  { accent: 'var(--gem-danger)', bg: gemMix('--gem-danger', 8), text: 'var(--gem-danger)', border: gemMix('--gem-danger', 25) },
  { accent: '#e879f9', bg: gemMix('#e879f9', 8), text: '#e879f9', border: gemMix('#e879f9', 25) },
  { accent: '#22d3ee', bg: gemMix('#22d3ee', 8), text: '#22d3ee', border: gemMix('#22d3ee', 25) },
  { accent: '#fb923c', bg: gemMix('#fb923c', 8), text: '#fb923c', border: gemMix('#fb923c', 25) },
  { accent: '#a3e635', bg: gemMix('#a3e635', 8), text: '#a3e635', border: gemMix('#a3e635', 25) },
]

export function getPlaylistColor(playlistId: string): FormatColor {
  let hash = 0
  for (let i = 0; i < playlistId.length; i++) {
    hash = ((hash << 5) - hash + playlistId.charCodeAt(i)) | 0
  }
  return PLAYLIST_COLOR_PALETTE[Math.abs(hash) % PLAYLIST_COLOR_PALETTE.length]!
}
