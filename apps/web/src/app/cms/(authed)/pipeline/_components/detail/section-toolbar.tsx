'use client'

interface SectionToolbarProps {
  title: string
  lang: string
  showLang: boolean
  source?: string | null
  edited?: boolean
  isEditing: boolean
  isSaving: boolean
  isDirty: boolean
  onToggleEdit: (editing: boolean) => void
  onSave: () => void
  onToggleCowork: () => void
}

export function SectionToolbar({
  title, lang, showLang, isEditing, isSaving, isDirty, onToggleEdit, onSave, onToggleCowork,
}: SectionToolbarProps) {
  return (
    <div className="flex justify-between items-center px-4 py-2 flex-wrap gap-1.5" style={{ borderBottom: '1px solid var(--gem-border)', background: 'color-mix(in srgb, var(--gem-surface) 60%, transparent)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold flex items-center gap-1.5">
          {title}
          {showLang && <span className="text-[10px] font-bold" style={{ color: 'var(--gem-accent)' }}>{lang.toUpperCase()}</span>}
        </span>
        {isDirty && (
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--gem-warn) 12%, transparent)', color: 'var(--gem-warn)' }}>
            ✏️ não salvo
          </span>
        )}
      </div>
      <div className="flex gap-1.5 items-center">
        <label className="flex items-center gap-1.5 text-[10px] cursor-pointer select-none" style={{ color: 'var(--gem-dim)' }}>
          <input type="checkbox" checked={isEditing} onChange={(e) => onToggleEdit(e.target.checked)} className="w-3 h-3" style={{ accentColor: 'var(--gem-accent)' }} />
          Editar
        </label>
        <button
          onClick={onToggleCowork}
          className="px-2 py-0.5 text-[10px] rounded transition-colors"
          style={{ background: 'color-mix(in srgb, var(--gem-accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--gem-accent) 30%, transparent)', color: 'var(--gem-accent)' }}
        >
          🤖 Pedir atualização
        </button>
        <button
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="px-3 py-0.5 text-[10px] font-semibold rounded transition-opacity"
          style={{
            background: 'var(--gem-done)',
            border: '1px solid var(--gem-done)',
            color: 'white',
            opacity: !isDirty || isSaving ? 0.3 : 1,
            cursor: !isDirty || isSaving ? 'default' : 'pointer',
          }}
        >
          {isSaving ? '⏳' : '💾'} Salvar <span className="text-[8px] px-1 rounded ml-0.5" style={{ border: '1px solid rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>⌘S</span>
        </button>
      </div>
    </div>
  )
}
