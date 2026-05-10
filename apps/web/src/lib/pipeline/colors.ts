export interface FormatColor {
  accent: string
  bg: string
  text: string
  border: string
}

const DEFAULT_COLOR: FormatColor = { accent: '#6366f1', bg: '#1e1b4b', text: '#a5b4fc', border: '#312e81' }

export function getFormatColor(format: string): FormatColor {
  return FORMAT_COLORS[format] ?? DEFAULT_COLOR
}

export function getPlaylistColor(code: string): FormatColor {
  return PLAYLIST_COLORS[code] ?? DEFAULT_COLOR
}

export const FORMAT_COLORS: Record<string, FormatColor> = {
  video: { accent: '#ef4444', bg: '#450a0a', text: '#fca5a5', border: '#7f1d1d' },
  blog_post: { accent: '#f59e0b', bg: '#451a03', text: '#fcd34d', border: '#78350f' },
  newsletter: { accent: '#6366f1', bg: '#1e1b4b', text: '#a5b4fc', border: '#312e81' },
  course: { accent: '#10b981', bg: '#022c22', text: '#6ee7b7', border: '#064e3b' },
  campaign: { accent: '#ec4899', bg: '#500724', text: '#f9a8d4', border: '#831843' },
}

export const PLAYLIST_COLORS: Record<string, FormatColor> = {
  'playlist-a': { accent: '#f59e0b', bg: '#451a03', text: '#fcd34d', border: '#78350f' },
  'playlist-b': { accent: '#8b5cf6', bg: '#2e1065', text: '#c4b5fd', border: '#4c1d95' },
  'playlist-c': { accent: '#10b981', bg: '#022c22', text: '#6ee7b7', border: '#064e3b' },
  'playlist-e': { accent: '#6366f1', bg: '#1e1b4b', text: '#a5b4fc', border: '#312e81' },
  'playlist-f': { accent: '#ec4899', bg: '#500724', text: '#f9a8d4', border: '#831843' },
  'playlist-g': { accent: '#ef4444', bg: '#450a0a', text: '#fca5a5', border: '#7f1d1d' },
}
