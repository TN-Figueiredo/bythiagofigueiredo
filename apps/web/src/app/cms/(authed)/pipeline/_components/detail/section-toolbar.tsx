'use client'

import { CoworkDeepLink } from '@/components/cms/cowork-deep-link'
import { buildCoworkInstruction } from '@/lib/pipeline/cowork-instructions'
import { AiBadge } from '@/components/cms/ai-badge'

interface SectionToolbarProps {
  title: string
  lang: string
  showLang: boolean
  itemCode: string
  sectionKey: string
  source?: string | null
  edited?: boolean
  isEditing: boolean
  isSaving: boolean
  isDirty: boolean
  onToggleEdit: (editing: boolean) => void
  onSave: () => void
}

export function SectionToolbar({
  title, lang, showLang, itemCode, sectionKey, source, edited, isEditing, isSaving, isDirty, onToggleEdit, onSave,
}: SectionToolbarProps) {
  return (
    <div className="flex justify-between items-center px-4 py-2 flex-wrap gap-1.5" style={{ borderBottom: '1px solid var(--gem-border)', background: 'color-mix(in srgb, var(--gem-surface) 60%, transparent)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold flex items-center gap-1.5">
          {title}
          {showLang && <span className="text-[10px] font-bold" style={{ color: 'var(--gem-accent)' }}>{lang.toUpperCase()}</span>}
        </span>
        <AiBadge source={source} edited={edited} />
      </div>
      <div className="flex gap-1.5 items-center">
        <button
          type="button"
          aria-pressed={isEditing}
          aria-label={isEditing ? 'Desativar edição (Cmd+E)' : 'Ativar edição (Cmd+E)'}
          onClick={() => onToggleEdit(!isEditing)}
          className="px-2.5 py-1 text-[10px] font-semibold rounded cursor-pointer select-none flex items-center gap-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            background: isEditing ? 'color-mix(in srgb, var(--gem-accent) 15%, transparent)' : 'color-mix(in srgb, var(--gem-surface) 80%, transparent)',
            color: isEditing ? 'var(--gem-accent)' : 'var(--gem-dim)',
            border: `1px solid ${isEditing ? 'var(--gem-accent)' : 'var(--gem-border)'}`,
            outlineColor: 'var(--gem-accent)',
          }}
        >
          {isEditing ? 'Editando' : 'Editar'}
          <span aria-hidden="true" style={{ fontSize: '8px', opacity: 0.6, fontFamily: 'monospace' }}>&#x2318;E</span>
        </button>
        <CoworkDeepLink
          instruction={buildCoworkInstruction('pipeline-section', { section: sectionKey, code: itemCode })}
          variant="icon"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="px-3 py-1 text-[10px] font-semibold rounded transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            background: '#15803d',
            border: '1px solid #15803d',
            color: 'white',
            opacity: !isDirty || isSaving ? 0.3 : 1,
            cursor: !isDirty || isSaving ? 'default' : 'pointer',
            outlineColor: 'var(--gem-accent)',
          }}
        >
          {isSaving ? 'Salvando...' : 'Salvar'} <span aria-hidden="true" className="text-[8px] px-1 rounded ml-0.5" style={{ border: '1px solid rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>&#x2318;S</span>
        </button>
      </div>
    </div>
  )
}
