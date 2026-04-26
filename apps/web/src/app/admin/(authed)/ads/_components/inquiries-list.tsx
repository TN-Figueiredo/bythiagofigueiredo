'use client'

import { useState, useTransition } from 'react'

export interface AdInquiryRow {
  id: string
  name: string
  email: string
  company: string | null
  website: string | null
  message: string
  budget: string | null
  status: string
  admin_notes: string | null
  submitted_at: string
  contacted_at: string | null
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  contacted: { label: 'Contactado', color: 'bg-blue-100 text-blue-800' },
  negotiating: { label: 'Negociando', color: 'bg-purple-100 text-purple-800' },
  converted: { label: 'Convertido', color: 'bg-green-100 text-green-800' },
  archived: { label: 'Arquivado', color: 'bg-gray-100 text-gray-600' },
}

const BUDGET_LABELS: Record<string, string> = {
  under_500: 'Até R$ 500',
  '500_2000': 'R$ 500–2.000',
  '2000_5000': 'R$ 2.000–5.000',
  above_5000: '> R$ 5.000',
  not_sure: 'Não definido',
}

interface Props {
  inquiries: AdInquiryRow[]
  updateStatusAction: (id: string, status: string) => Promise<void>
  updateNotesAction: (id: string, notes: string) => Promise<void>
}

export function InquiriesList({ inquiries, updateStatusAction, updateNotesAction }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [isPending, startTransition] = useTransition()

  const filtered = filter === 'all'
    ? inquiries
    : inquiries.filter((i) => i.status === filter)

  const selectedInquiry = inquiries.find((i) => i.id === selected)

  function handleStatusChange(id: string, newStatus: string) {
    startTransition(async () => {
      await updateStatusAction(id, newStatus)
    })
  }

  function handleSaveNotes(id: string, notes: string) {
    startTransition(async () => {
      await updateNotesAction(id, notes)
    })
  }

  const pendingCount = inquiries.filter((i) => i.status === 'pending').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[
            { key: 'all', label: `Todos (${inquiries.length})` },
            { key: 'pending', label: `Pendentes (${pendingCount})` },
            { key: 'contacted', label: 'Contactados' },
            { key: 'negotiating', label: 'Negociando' },
            { key: 'converted', label: 'Convertidos' },
            { key: 'archived', label: 'Arquivados' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhum interessado{filter !== 'all' ? ` com status "${STATUS_LABELS[filter]?.label}"` : ''}.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((inq) => {
            const st = STATUS_LABELS[inq.status] ?? { label: inq.status, color: 'bg-gray-100 text-gray-600' }
            const isSelected = selected === inq.id
            return (
              <div key={inq.id}>
                <button
                  onClick={() => setSelected(isSelected ? null : inq.id)}
                  className={`w-full text-left rounded-lg border p-4 transition-colors ${
                    isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{inq.name}</span>
                        {inq.company && (
                          <span className="text-xs text-muted-foreground">· {inq.company}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{inq.email}</p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{inq.message}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(inq.submitted_at).toLocaleDateString('pt-BR')}
                      </span>
                      {inq.budget && (
                        <span className="text-xs text-muted-foreground">
                          {BUDGET_LABELS[inq.budget] ?? inq.budget}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {isSelected && selectedInquiry && (
                  <InquiryDetail
                    inquiry={selectedInquiry}
                    isPending={isPending}
                    onStatusChange={handleStatusChange}
                    onSaveNotes={handleSaveNotes}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function InquiryDetail({
  inquiry,
  isPending,
  onStatusChange,
  onSaveNotes,
}: {
  inquiry: AdInquiryRow
  isPending: boolean
  onStatusChange: (id: string, status: string) => void
  onSaveNotes: (id: string, notes: string) => void
}) {
  const [notes, setNotes] = useState(inquiry.admin_notes ?? '')
  const [notesDirty, setNotesDirty] = useState(false)

  return (
    <div className="mt-2 rounded-lg border border-border p-4 space-y-4 bg-muted/30">
      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Email</span>
          <p><a href={`mailto:${inquiry.email}`} className="text-primary hover:underline">{inquiry.email}</a></p>
        </div>
        {inquiry.company && (
          <div>
            <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Empresa</span>
            <p>{inquiry.company}</p>
          </div>
        )}
        {inquiry.website && (
          <div>
            <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Site</span>
            <p><a href={inquiry.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{inquiry.website}</a></p>
          </div>
        )}
        {inquiry.budget && (
          <div>
            <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Orcamento</span>
            <p>{BUDGET_LABELS[inquiry.budget] ?? inquiry.budget}</p>
          </div>
        )}
        <div>
          <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Enviado em</span>
          <p>{new Date(inquiry.submitted_at).toLocaleString('pt-BR')}</p>
        </div>
        {inquiry.contacted_at && (
          <div>
            <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Contactado em</span>
            <p>{new Date(inquiry.contacted_at).toLocaleString('pt-BR')}</p>
          </div>
        )}
      </div>

      <div>
        <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Mensagem</span>
        <p className="text-sm mt-1 whitespace-pre-wrap">{inquiry.message}</p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Status:</span>
        {(['pending', 'contacted', 'negotiating', 'converted', 'archived'] as const).map((st) => {
          const info = STATUS_LABELS[st] as { label: string; color: string }
          const isActive = inquiry.status === st
          return (
            <button
              key={st}
              disabled={isPending || isActive}
              onClick={() => onStatusChange(inquiry.id, st)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                isActive
                  ? `${info.color} ring-1 ring-current`
                  : 'bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50'
              }`}
            >
              {info.label}
            </button>
          )
        })}
      </div>

      <div>
        <label className="font-medium text-xs text-muted-foreground uppercase tracking-wide block mb-1">Notas internas</label>
        <textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setNotesDirty(true) }}
          rows={2}
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-primary resize-y"
          placeholder="Anotacoes sobre esse interessado…"
        />
        {notesDirty && (
          <button
            disabled={isPending}
            onClick={() => { onSaveNotes(inquiry.id, notes); setNotesDirty(false) }}
            className="mt-1 px-3 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Salvar notas
          </button>
        )}
      </div>
    </div>
  )
}
