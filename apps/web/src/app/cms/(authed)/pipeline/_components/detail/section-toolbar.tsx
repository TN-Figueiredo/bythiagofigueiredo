'use client'

interface SectionToolbarProps {
  title: string
  lang: string
  showLang: boolean
  source: string | null
  edited: boolean
  isEditing: boolean
  isSaving: boolean
  isDirty: boolean
  onToggleEdit: (editing: boolean) => void
  onSave: () => void
  onToggleCowork: () => void
}

export function SectionToolbar({
  title, lang, showLang, source, edited, isEditing, isSaving, isDirty, onToggleEdit, onSave, onToggleCowork,
}: SectionToolbarProps) {
  return (
    <div className="flex justify-between items-center px-4 py-2 flex-wrap gap-1.5" style={{ borderBottom: '1px solid var(--gem-border)', background: 'rgba(26,29,40,0.6)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold flex items-center gap-1.5">
          {title}
          {showLang && <span className="text-[10px] font-bold" style={{ color: 'var(--gem-accent)' }}>{lang.toUpperCase()}</span>}
        </span>
        {source && source !== 'user' && (
          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
            🤖 {source}
          </span>
        )}
        {edited && (
          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
            ✏️ editado
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
          style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}
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
