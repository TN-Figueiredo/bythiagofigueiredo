'use client'

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import type { AbTestSiteSettings } from '@/lib/youtube/ab-types'
import { Settings, X, Zap, FlaskConical, Mail, Check } from 'lucide-react'
import { InfoTip } from './ab-primitives'

export interface SettingsDrawerProps {
  settings: AbTestSiteSettings | null
  onSave: (changes: Partial<AbTestSiteSettings>) => Promise<void>
  onClose: () => void
}

function SettingsToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="shrink-0"
      style={{
        width: 42, height: 24, borderRadius: 99, border: 'none', padding: 3,
        background: checked ? 'var(--cms-accent)' : 'var(--cms-surface-3, var(--cms-surface-hover))',
        transition: 'background 0.2s', display: 'flex',
        justifyContent: checked ? 'flex-end' : 'flex-start',
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: 99, background: '#fff', transition: '0.2s' }} />
    </button>
  )
}

function SettingsCheckbox({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className="flex items-start gap-[11px] w-full text-left py-[9px]"
      style={{ background: 'transparent', border: 'none', opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <span
        className="shrink-0"
        style={{
          width: 19, height: 19, borderRadius: 6, marginTop: 1,
          border: checked ? '1.5px solid var(--cms-accent)' : '1.5px solid var(--cms-border, #332D25)',
          background: checked ? 'var(--cms-accent)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.15s',
        }}
      >
        {checked && <Check size={12} style={{ color: 'rgb(21,18,13)' }} />}
      </span>
      <span className="min-w-0">
        <span className="text-[13.5px] font-medium text-cms-text block">{label}</span>
        <span className="text-[11.5px] text-cms-text-dim block mt-[2px]">{hint}</span>
      </span>
    </button>
  )
}

function Stepper({ value, onChange, suffix }: { value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <div
      className="inline-flex items-center overflow-hidden shrink-0"
      style={{ width: 92, background: 'var(--cms-surface)', border: '1px solid var(--cms-border, #332D25)', borderRadius: 8 }}
    >
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="text-cms-text-dim text-[16px]" style={{ width: 28, height: 32, background: 'transparent', border: 'none' }}>−</button>
      <span className="flex-1 text-center font-mono text-[13px] font-semibold">{value}{suffix}</span>
      <button type="button" onClick={() => onChange(value + 1)} className="text-cms-text-dim text-[16px]" style={{ width: 28, height: 32, background: 'transparent', border: 'none' }}>+</button>
    </div>
  )
}

export function SettingsDrawer({ settings, onSave, onClose }: SettingsDrawerProps) {
  const [edited, setEdited] = useState<AbTestSiteSettings | null>(settings)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestEdited = useRef(edited)
  const drawerRef = useRef<HTMLDivElement>(null)
  latestEdited.current = edited

  useEffect(() => { if (settings && !edited) setEdited(settings) }, [settings, edited])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => { return () => { if (debounceRef.current) clearTimeout(debounceRef.current) } }, [])

  const scheduleAutoSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const current = latestEdited.current
      if (!current) return
      setSaveStatus('saving')
      startTransition(async () => {
        try { await onSave(current); setSaveStatus('saved') }
        catch { setSaveStatus('error') }
      })
    }, 500)
  }, [onSave, startTransition])

  function update<K extends keyof AbTestSiteSettings>(key: K, value: AbTestSiteSettings[K]) {
    setEdited(prev => prev ? { ...prev, [key]: value } : prev)
    scheduleAutoSave()
  }

  function updateNested<P extends 'ctr_drop_trigger' | 'post_publish_trigger' | 'notifications'>(
    parent: P, key: keyof AbTestSiteSettings[P], value: AbTestSiteSettings[P][keyof AbTestSiteSettings[P]]
  ) {
    setEdited(prev => prev ? { ...prev, [parent]: { ...prev[parent], [key]: value } } : prev)
    scheduleAutoSave()
  }

  return (
    <>
      <div className="fixed inset-0 z-90 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Configurações do A/B Lab"
        className="fixed top-0 right-0 bottom-0 z-95 flex flex-col"
        style={{
          width: 'min(440px, 100%)',
          background: 'var(--cms-surface)',
          borderLeft: '1px solid var(--cms-border, #332D25)',
          boxShadow: 'rgba(0,0,0,0.6) -24px 0 60px -20px',
          animation: '0.28s cubic-bezier(0.2,0.7,0.2,1) 0s 1 normal both running drawerIn',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-[11px] py-[20px] px-[22px]" style={{ borderBottom: '1px solid var(--cms-border, #332D25)' }}>
          <span className="flex items-center justify-center rounded-[9px] text-cms-accent" style={{ width: 32, height: 32, background: 'var(--accent-soft, rgba(255,130,64,0.08))' }}>
            <Settings size={17} aria-hidden="true" />
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-bold text-cms-text">Configurações do A/B Lab</div>
            <div className="text-[11.5px] text-cms-text-dim">Valem pra todos os testes deste canal</div>
          </div>
          <button type="button" onClick={onClose} className="text-cms-text-dim p-[4px]" style={{ background: 'transparent', border: 'none' }} aria-label="Fechar">
            <X size={19} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-[4px] px-[22px]">
          {!edited ? (
            <div className="space-y-6 py-6 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="space-y-3"><div className="h-3 w-24 rounded bg-cms-surface-hover" /><div className="h-10 rounded bg-cms-surface-hover" /></div>)}
            </div>
          ) : (
            <>
              {/* Automação */}
              <div className="flex items-center gap-[8px] mt-[26px] mb-[4px]">
                <Zap size={15} className="text-cms-accent" aria-hidden="true" />
                <span className="text-[10.5px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">Automação</span>
              </div>

              <div className="flex items-center justify-between gap-[16px] py-[13px]" style={{ borderTop: '1px solid var(--cms-border, #332D25)' }}>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold flex items-center">Pausar se o CTR cair <InfoTip text="Protege contra uma variante que afunda o CTR abaixo do limiar configurado." /></div>
                  <div className="text-[11.5px] text-cms-text-dim mt-[2px] leading-[1.4]">Protege contra uma variante que começa a afundar.</div>
                </div>
                <SettingsToggle checked={edited.ctr_drop_trigger.enabled} onChange={v => updateNested('ctr_drop_trigger', 'enabled', v)} />
              </div>

              <div className="flex items-center justify-between gap-[16px] py-[13px]" style={{ borderTop: '1px solid var(--cms-border, #332D25)' }}>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold flex items-center">Auto-teste pós-publicação <InfoTip text="Cria um teste A/B automaticamente quando você publica um novo vídeo." /></div>
                  <div className="text-[11.5px] text-cms-text-dim mt-[2px] leading-[1.4]">Cria um teste sozinho quando você publica um vídeo.</div>
                </div>
                <SettingsToggle checked={edited.post_publish_trigger.enabled} onChange={v => updateNested('post_publish_trigger', 'enabled', v)} />
              </div>

              {/* Padrões dos novos testes */}
              <div className="flex items-center gap-[8px] mt-[26px] mb-[4px]">
                <FlaskConical size={15} className="text-cms-accent" aria-hidden="true" />
                <span className="text-[10.5px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">Padrões dos novos testes</span>
              </div>
              <div className="text-[11.5px] text-cms-text-dim mt-[4px] mb-[2px]">Pré-preenchem o passo Config do wizard — dá pra mudar caso a caso.</div>

              <div className="flex items-center justify-between gap-[16px] py-[13px]" style={{ borderTop: '1px solid var(--cms-border, #332D25)' }}>
                <div className="text-[13.5px] font-semibold">Duração máxima</div>
                <select
                  value={edited.default_duration_days}
                  onChange={e => update('default_duration_days', Number(e.target.value))}
                  className="text-[13px] text-cms-text rounded-[8px] py-[8px] px-[12px]"
                  style={{ background: 'var(--cms-surface)', border: '1px solid var(--cms-border, #332D25)' }}
                >
                  {[7,14,21,28].map(d => <option key={d} value={d}>{d} dias</option>)}
                </select>
              </div>

              <div className="flex items-center justify-between gap-[16px] py-[13px]" style={{ borderTop: '1px solid var(--cms-border, #332D25)' }}>
                <div className="text-[13.5px] font-semibold flex items-center">Confiança alvo <InfoTip text="O motor só declara vencedor quando a probabilidade Bayesiana atinge este limiar." /></div>
                <div className="flex items-center gap-[12px] shrink-0" style={{ width: 200 }}>
                  <input
                    type="range" min={80} max={99}
                    value={Math.round(edited.default_confidence * 100)}
                    onChange={e => update('default_confidence', Number(e.target.value) / 100)}
                    className="flex-1"
                  />
                  <span className="font-mono text-[13px] font-bold text-cms-accent w-[38px] text-right">
                    {Math.round(edited.default_confidence * 100)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-[16px] py-[13px]" style={{ borderTop: '1px solid var(--cms-border, #332D25)' }}>
                <div className="text-[13.5px] font-semibold flex items-center">
                  Aplicar vencedor automaticamente
                  <InfoTip text="Quando o teste conclui, troca a thumbnail/título no YouTube para a variante vencedora." />
                </div>
                <SettingsToggle checked={edited.default_auto_apply} onChange={v => update('default_auto_apply', v)} />
              </div>

              <div className="flex items-center justify-between gap-[16px] py-[13px]" style={{ borderTop: '1px solid var(--cms-border, #332D25)' }}>
                <div className="text-[13.5px] font-semibold flex items-center">
                  Burn-in
                  <InfoTip text="Ignora os primeiros N dias de dados para evitar viés do algoritmo do YouTube." />
                </div>
                <Stepper value={edited.default_burn_in_days} onChange={v => update('default_burn_in_days', Math.min(5, Math.max(0, v)))} suffix="d" />
              </div>

              {/* Notificações */}
              <div className="flex items-center gap-[8px] mt-[26px] mb-[4px]">
                <Mail size={15} className="text-cms-accent" aria-hidden="true" />
                <span className="text-[10.5px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">Notificações</span>
              </div>

              <div className="pt-[4px]">
                <SettingsCheckbox
                  checked={edited.notifications.test_completed}
                  onChange={v => updateNested('notifications', 'test_completed', v)}
                  label="Teste concluído"
                  hint="Quando um teste declara vencedor."
                />
                <SettingsCheckbox
                  checked={edited.notifications.test_auto_paused}
                  onChange={v => updateNested('notifications', 'test_auto_paused', v)}
                  label="Teste pausado automaticamente"
                  hint="Mudança externa de thumb ou token revogado."
                />
                <SettingsCheckbox
                  checked={edited.notifications.ctr_drop_alert}
                  onChange={v => updateNested('notifications', 'ctr_drop_alert', v)}
                  label="Alerta de queda de CTR"
                  hint="Requer 'Pausar se o CTR cair' ligado."
                  disabled={!edited.ctr_drop_trigger.enabled}
                />
                <SettingsCheckbox
                  checked={edited.notifications.daily_digest}
                  onChange={v => updateNested('notifications', 'daily_digest', v)}
                  label="Resumo diário"
                  hint="Um e-mail por dia com os testes ativos."
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-[8px] py-[13px] px-[22px]"
          style={{ borderTop: '1px solid var(--cms-border, #332D25)', background: 'var(--cms-bg-side)' }}
        >
          <Check size={14} className="text-cms-green" aria-hidden="true" />
          <span className="text-[12px] text-cms-text-dim">
            {saveStatus === 'saving' || isPending ? 'Salvando...' : saveStatus === 'error' ? 'Erro ao salvar' : 'Salvo automaticamente'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex items-center justify-center py-[6px] px-[11px] text-[12.5px] font-semibold rounded-[9px] whitespace-nowrap transition-[0.15s] tracking-[-0.01em] text-cms-text-dim"
            style={{ border: '1px solid var(--cms-border, #332D25)' }}
          >
            Fechar
          </button>
        </div>
      </div>
    </>
  )
}
