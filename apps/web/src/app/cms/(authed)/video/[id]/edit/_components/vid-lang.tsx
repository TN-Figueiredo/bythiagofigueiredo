'use client'

import { Plus } from 'lucide-react'
import { CHANNELS } from '@/lib/pipeline/channels'
import type { EditorModel } from '../editor-model'
import type { VideoLang } from '../types'

const LANGS: VideoLang[] = ['pt', 'en']
const channel = (lang: VideoLang) => CHANNELS.find((c) => c.lang === lang)!

export interface VidLangProps {
  versions: EditorModel
  /** Langs that actually exist on this video (have a Version). */
  present: VideoLang[]
  active: VideoLang
  onSwitch: (lang: VideoLang) => void
  onAdd: (lang: VideoLang) => void
}

/**
 * PT/EN language toggle. Single existing version → `.single` chip with a `.ver-add`
 * to create the other; both present → two `.lang-opt` segments. Mirrors `VidLang`
 * in design_handoff_video_module/views-video.jsx (~190-214).
 */
export function VidLang({ present, active, onSwitch, onAdd }: VidLangProps) {
  const existing = LANGS.filter((l) => present.includes(l))
  const missing = LANGS.find((l) => !present.includes(l))

  if (existing.length === 1) {
    const only = existing[0]!
    return (
      <div className="lang-toggle single" role="group">
        <span className="lang-current">
          {channel(only).flag} {channel(only).label}
        </span>
        {missing && (
          <button
            type="button"
            className="ver-add"
            onClick={() => onAdd(missing)}
            title={`Adicionar versão ${channel(missing).label}`}
          >
            <Plus size={12} /> {channel(missing).label}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="lang-toggle" role="group">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          className={'lang-opt' + (active === l ? ' on' : '')}
          onClick={() => onSwitch(l)}
        >
          {channel(l).flag} {channel(l).label}
        </button>
      ))}
    </div>
  )
}
