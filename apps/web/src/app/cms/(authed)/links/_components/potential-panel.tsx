'use client'

import { Target, Tag, Users, Globe, Zap, TrendingUp } from 'lucide-react'

const FEATURES = [
  { Icon: Target, label: 'Metas & conversão', desc: 'Marcar destinos como meta e medir conversão por link/origem.' },
  { Icon: Tag, label: 'Atribuição UTM', desc: 'Quebrar por source / medium / campaign automaticamente.' },
  { Icon: Users, label: 'Novos vs. recorrentes', desc: 'Separar visitantes novos de quem já clicou antes.' },
  { Icon: Globe, label: 'Mapa geográfico', desc: 'Mapa-múndi com cidades e calor por região.' },
  { Icon: Zap, label: 'Filtro de bots', desc: 'Excluir tráfego automatizado das métricas.' },
  { Icon: TrendingUp, label: 'Funil QR → página → ação', desc: 'Acompanhar do scan até a conversão final.' },
]

export function PotentialPanel() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
          <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
          <path d="M18 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
        </svg>
        <span style={{ fontSize: '13.5px', fontWeight: 600, flex: 1, color: 'var(--ink)' }}>
          Potencial — a implementar
        </span>
        <span className="mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 999,
          fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
          background: 'var(--surface-3, var(--surface-2))', color: 'var(--ink-dim)',
        }}>
          roadmap
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {FEATURES.map((f) => (
          <div
            key={f.label}
            style={{
              display: 'flex', gap: 10, padding: '11px 12px',
              border: '1px dashed var(--line-strong)', borderRadius: 10,
            }}
          >
            <f.Icon size={16} strokeWidth={1.7} style={{ color: 'var(--ink-faint)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)' }}>{f.label}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 2, lineHeight: 1.45 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
