export function TypeBadge({ name, color }: { name: string; color: string | null }) {
  const c = color ?? 'var(--cms-text-dim, #6b7280)'
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded font-medium"
      style={{
        background: c + '22',
        color: c,
        border: `1px solid ${c}44`,
      }}
    >
      {name}
    </span>
  )
}

export function LgpdLockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-label="Dados anonimizados (LGPD)"
      role="img"
    >
      <rect x="1" y="5" width="10" height="7" rx="1.5" fill="var(--cms-text-dim, #6b7280)" />
      <path
        d="M3 5V3.5a3 3 0 016 0V5"
        stroke="var(--cms-text-dim, #6b7280)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ConsentIcon({ consent }: { consent: boolean }) {
  return consent ? (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-label="Tracking consentido" role="img">
      <circle cx="6" cy="6" r="5" fill="color-mix(in srgb, var(--cms-green, #22c55e) 13%, transparent)" stroke="var(--cms-green, #22c55e)" strokeWidth="1" />
      <path d="M3.5 6l2 2 3-3" stroke="var(--cms-green, #22c55e)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-label="Sem consentimento de tracking" role="img">
      <circle cx="6" cy="6" r="5" fill="color-mix(in srgb, var(--cms-text-dim, #6b7280) 13%, transparent)" stroke="var(--cms-text-dim, #6b7280)" strokeWidth="1" />
      <path d="M4 4l4 4M8 4l-4 4" stroke="var(--cms-text-dim, #6b7280)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
