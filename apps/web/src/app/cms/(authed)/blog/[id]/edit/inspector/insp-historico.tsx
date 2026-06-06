'use client'

import { Clock } from 'lucide-react'
import { useEditorState } from '../context'
import { InspAccordion } from './insp-accordion'

export function InspHistorico() {
  const state = useEditorState()
  const { history } = state.shared

  return (
    <div data-testid="insp-historico">
      <InspAccordion
        icon={<Clock size={15} className="lucide" />}
        title="Histórico"
        defaultOpen={false}
        badge={
          history.length > 0 ? (
            <span
              data-testid="hist-count"
              style={{
                fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                minWidth: 20, height: 19, padding: '0 6px', borderRadius: 20,
                display: 'inline-grid', placeItems: 'center',
                background: 'var(--surface-2)', color: 'var(--text-dim)',
                border: '1px solid var(--border-soft)',
              }}
            >
              {history.length}
            </span>
          ) : undefined
        }
      >
        {history.length === 0 ? (
          <div
            data-testid="hist-empty"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '18px 12px', textAlign: 'center',
              fontSize: 12, color: 'var(--text-faint)',
              border: '1.5px dashed var(--border-soft)', borderRadius: 10,
            }}
          >
            <Clock size={16} className="lucide" style={{ opacity: 0.6 }} />
            Nenhuma mudança de etapa ainda
          </div>
        ) : (
          <div data-testid="hist-timeline">
            {history.map((entry, i) => (
              <div key={i} className="hist-row">
                <span className="hr-dot" />
                <span className="hr-to">
                  Etapa → <b>{entry.to}</b>
                </span>
                <span className="hr-date">{entry.date}</span>
              </div>
            ))}
          </div>
        )}
      </InspAccordion>
    </div>
  )
}
