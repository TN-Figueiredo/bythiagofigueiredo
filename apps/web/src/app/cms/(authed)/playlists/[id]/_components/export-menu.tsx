'use client'

import { useEffect, useRef } from 'react'
import type { PlaylistItemEnriched } from '@/lib/playlists/types'

interface ExportMenuProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  playlistName: string
  filterLabel: string
  items: PlaylistItemEnriched[]
  viewNumbers: Map<string, number | null>
  onPrint: () => void
  onExportPng: () => void
  onClose: () => void
}

export function ExportMenu({
  anchorRef, playlistName, filterLabel, items, viewNumbers,
  onPrint, onExportPng, onClose,
}: ExportMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const handleCsvExport = () => {
    const csv = generateCsv(items, viewNumbers)
    download(`${playlistName}.csv`, csv, 'text/csv')
    onClose()
  }

  const handleJsonExport = () => {
    const json = generateJson(items, viewNumbers, playlistName, filterLabel)
    download(`${playlistName}.json`, json, 'application/json')
    onClose()
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 w-[180px] rounded-xl border border-white/10 bg-[#14141f]/90 p-1 shadow-2xl shadow-black/60 backdrop-blur-xl"
      style={{
        top: (anchorRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
        right: window.innerWidth - (anchorRef.current?.getBoundingClientRect().right ?? 0),
      }}
    >
      <button type="button" onClick={() => { onPrint(); onClose() }} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-white/70 hover:bg-white/5">
        <PrintIcon /> Print List <span className="ml-auto text-[0.55rem] text-white/20">&#8984;P</span>
      </button>
      <button type="button" onClick={() => { onExportPng(); onClose() }} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-white/70 hover:bg-white/5">
        <ImageIcon /> Export PNG
      </button>
      <div className="my-1 h-px bg-white/5" />
      <button type="button" onClick={handleCsvExport} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-white/70 hover:bg-white/5">
        <FileIcon /> Export CSV
      </button>
      <button type="button" onClick={handleJsonExport} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-white/70 hover:bg-white/5">
        <FileIcon /> Export JSON
      </button>
    </div>
  )
}

function csvEscape(s: string | null): string {
  if (!s) return ''
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

export function generateCsv(
  items: PlaylistItemEnriched[],
  viewNumbers: Map<string, number | null>,
): string {
  const header = 'order,type,language,status,title,tags,uuid'
  const rows = items
    .filter(item => viewNumbers.get(item.id) !== null)
    .sort((a, b) => (viewNumbers.get(a.id) ?? 0) - (viewNumbers.get(b.id) ?? 0))
    .map(item => {
      const n = viewNumbers.get(item.id) ?? 0
      const tags = item.tags?.length > 0 ? csvEscape(item.tags.join('; ')) : ''
      return [n, item.content_type ?? '', item.language ?? '', item.status ?? '', csvEscape(item.title), tags, item.id].join(',')
    })
  return [header, ...rows].join('\n')
}

export function generateJson(
  items: PlaylistItemEnriched[],
  viewNumbers: Map<string, number | null>,
  playlistName: string,
  filterLabel: string,
): string {
  const filtered = items
    .filter(item => viewNumbers.get(item.id) !== null)
    .sort((a, b) => (viewNumbers.get(a.id) ?? 0) - (viewNumbers.get(b.id) ?? 0))
    .map(item => ({
      order: viewNumbers.get(item.id) ?? 0,
      type: item.content_type,
      language: item.language,
      status: item.status,
      title: item.title,
      tags: item.tags ?? [],
      uuid: item.id,
    }))

  return JSON.stringify({
    playlist: playlistName,
    filter: filterLabel,
    exported_at: new Date().toISOString(),
    items: filtered,
  }, null, 2)
}

function download(filename: string, content: string, mime: string) {
  const safeName = filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
  const bom = mime.startsWith('text/csv') ? '\uFEFF' : ''
  const type = mime.startsWith('text/') ? `${mime};charset=utf-8` : mime
  const blob = new Blob([bom + content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = safeName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function PrintIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
}
function ImageIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
}
function FileIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
}
