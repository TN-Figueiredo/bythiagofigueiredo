'use client'

import { useState, useCallback } from 'react'
import { API_REGISTRY, type CapabilityDomain } from '@/lib/pipeline/api-registry'

const METHOD_STYLES: Record<string, { bg: string; color: string }> = {
  GET: { bg: '#166534', color: '#86efac' },
  POST: { bg: '#1e3a5f', color: '#93c5fd' },
  PATCH: { bg: '#713f12', color: '#fde68a' },
  PUT: { bg: '#713f12', color: '#fde68a' },
  DELETE: { bg: '#7f1d1d', color: '#fca5a5' },
}

function MethodBadge({ method }: { method: string }) {
  const s = METHOD_STYLES[method] ?? { bg: '#334155', color: '#94a3b8' }
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 700,
        fontFamily: 'monospace',
        padding: '1px 6px',
        borderRadius: 3,
        backgroundColor: s.bg,
        color: s.color,
        minWidth: 40,
        textAlign: 'center',
      }}
    >
      {method === 'DELETE' ? 'DEL' : method}
    </span>
  )
}

function DomainAccordion({ cap, isOpen, onToggle }: { cap: CapabilityDomain; isOpen: boolean; onToggle: () => void }) {
  return (
    <div
      style={{
        border: '1px solid var(--gem-border)',
        borderRadius: 8,
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="transition-colors duration-100 hover:brightness-110"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '10px 14px',
          backgroundColor: 'var(--gem-well)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            color: 'var(--gem-muted)',
            flexShrink: 0,
            transition: 'transform 0.15s',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          <path d="M3 1.5l3.5 3.5L3 8.5" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gem-text)', flex: 1 }}>
          {cap.name}
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--gem-muted)',
            backgroundColor: 'rgba(99,102,241,0.08)',
            borderRadius: 9999,
            padding: '1px 8px',
            lineHeight: '16px',
          }}
        >
          {cap.endpoint_count} endpoints
        </span>
      </button>

      {isOpen && (
        <div style={{ borderTop: '1px solid var(--gem-border)', animation: 'card-in 0.15s ease-out' }}>
          <div style={{ fontSize: 11, color: 'var(--gem-muted)', padding: '8px 14px', lineHeight: '16px' }}>
            {cap.description}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {cap.endpoints.map((ep, i) => (
                <tr
                  key={`${ep.method}-${ep.path}`}
                  className="transition-colors duration-75 hover:bg-white/[0.03]"
                  style={{
                    borderTop: i === 0 ? '1px solid var(--gem-border)' : 'none',
                    borderBottom: i < cap.endpoints.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}
                >
                  <td style={{ padding: '7px 14px', width: 60 }}>
                    <MethodBadge method={ep.method} />
                  </td>
                  <td style={{ padding: '7px 0', fontFamily: 'monospace', color: 'var(--gem-text)', fontSize: 11 }}>
                    {ep.path}
                  </td>
                  <td style={{ padding: '7px 14px', color: 'var(--gem-muted)', fontSize: 11 }}>
                    {ep.summary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function ApiCatalogView() {
  const [openDomains, setOpenDomains] = useState<Record<string, boolean>>({
    [API_REGISTRY.capabilities[0]?.domain ?? '']: true,
  })

  const toggleDomain = useCallback((domain: string) => {
    setOpenDomains((prev) => ({ ...prev, [domain]: !prev[domain] }))
  }, [])

  const expandAll = useCallback(() => {
    const all: Record<string, boolean> = {}
    for (const cap of API_REGISTRY.capabilities) all[cap.domain] = true
    setOpenDomains(all)
  }, [])

  const collapseAll = useCallback(() => {
    setOpenDomains({})
  }, [])

  const totalEndpoints = API_REGISTRY.capabilities.reduce((s, c) => s + c.endpoint_count, 0)

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '16px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--gem-text)' }}>
          {API_REGISTRY.name}
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--gem-muted)',
            backgroundColor: 'var(--gem-well)',
            borderRadius: 4,
            padding: '2px 8px',
            fontFamily: 'monospace',
          }}
        >
          v{API_REGISTRY.version}
        </span>
        <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
          <button
            onClick={expandAll}
            title="Expand all"
            type="button"
            className="rounded bg-transparent transition-colors hover:bg-white/[0.06]"
            style={{
              border: 'none',
              cursor: 'pointer',
              padding: '3px 4px',
              color: 'var(--gem-muted)',
              lineHeight: 1,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="1" y="1" width="10" height="10" rx="1.5" />
              <path d="M6 3.5v5M3.5 6h5" />
            </svg>
          </button>
          <button
            onClick={collapseAll}
            title="Collapse all"
            type="button"
            className="rounded bg-transparent transition-colors hover:bg-white/[0.06]"
            style={{
              border: 'none',
              cursor: 'pointer',
              padding: '3px 4px',
              color: 'var(--gem-muted)',
              lineHeight: 1,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="1" y="1" width="10" height="10" rx="1.5" />
              <path d="M3.5 6h5" />
            </svg>
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--gem-muted)' }}>
          Auth: <code style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--gem-text)', backgroundColor: 'var(--gem-well)', padding: '1px 5px', borderRadius: 3 }}>{API_REGISTRY.auth.header}</code>
        </span>
        <span style={{ fontSize: 11, color: 'var(--gem-muted)' }}>
          Rate: <code style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--gem-text)', backgroundColor: 'var(--gem-well)', padding: '1px 5px', borderRadius: 3 }}>{API_REGISTRY.auth.rate_limit}</code>
        </span>
      </div>

      {/* Summary */}
      <div
        style={{
          fontSize: 11,
          color: 'var(--gem-muted)',
          marginBottom: 16,
          padding: '9px 14px',
          backgroundColor: 'var(--gem-well)',
          borderRadius: 6,
          borderLeft: '3px solid rgba(99,102,241,0.5)',
          display: 'flex',
          gap: 16,
        }}
      >
        <span><strong style={{ color: 'var(--gem-text)' }}>{totalEndpoints}</strong> endpoints</span>
        <span><strong style={{ color: 'var(--gem-text)' }}>{API_REGISTRY.capabilities.length}</strong> domains</span>
        <span><strong style={{ color: 'var(--gem-text)' }}>{API_REGISTRY.cross_domain_workflows.length}</strong> workflows</span>
      </div>

      {/* Domain accordions */}
      {API_REGISTRY.capabilities.map((cap) => (
        <DomainAccordion
          key={cap.domain}
          cap={cap}
          isOpen={openDomains[cap.domain] ?? false}
          onToggle={() => toggleDomain(cap.domain)}
        />
      ))}

      {/* Cross-domain workflows */}
      {API_REGISTRY.cross_domain_workflows.length > 0 && (
        <div
          style={{
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 8,
            marginTop: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              backgroundColor: 'rgba(99,102,241,0.06)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgb(165,180,252)' }}>
              Cross-Domain Workflows
            </span>
            <span
              style={{
                fontSize: 10,
                color: 'rgb(165,180,252)',
                backgroundColor: 'rgba(99,102,241,0.12)',
                borderRadius: 9999,
                padding: '1px 8px',
                lineHeight: '16px',
              }}
            >
              {API_REGISTRY.cross_domain_workflows.length}
            </span>
          </div>
          <div style={{ borderTop: '1px solid rgba(99,102,241,0.15)', padding: '10px 14px' }}>
            {API_REGISTRY.cross_domain_workflows.map((wf) => (
              <div key={wf.name} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gem-text)', marginBottom: 2 }}>
                  {wf.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--gem-muted)', marginBottom: 4 }}>
                  {wf.description}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {wf.domains.map((d) => (
                    <span
                      key={d}
                      style={{
                        fontSize: 9,
                        color: 'rgb(165,180,252)',
                        backgroundColor: 'rgba(99,102,241,0.1)',
                        borderRadius: 3,
                        padding: '1px 6px',
                        fontFamily: 'monospace',
                      }}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
