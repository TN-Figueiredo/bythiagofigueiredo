interface BotFilterToggleProps {
  enabled: boolean
  botPct: number
  onChange: (enabled: boolean) => void
}

export function BotFilterToggle({ enabled, botPct, onChange }: BotFilterToggleProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        style={{
          width: 36, height: 20, borderRadius: 99, border: 'none', cursor: 'pointer', position: 'relative',
          background: enabled ? 'var(--accent, #FF8240)' : 'var(--surface-2, #272219)',
          transition: 'background .2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, width: 16, height: 16, borderRadius: 99,
          background: '#fff', transition: 'left .2s',
          left: enabled ? 18 : 2,
        }} />
      </button>
      <span style={{ fontSize: 12, color: 'var(--ink, #ECE6DA)' }}>Excluir bots</span>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-faint, #6E685D)' }}>{botPct}% bots</span>
    </div>
  )
}
