import type { DeliverySummary } from '@/lib/newsletter/delivery'

/**
 * Compact per-edition delivery summary derived from `newsletter_sends`.
 * Literal colors only (no color-mix / opacity-modifier classes — Opera
 * renders color-mix() transparent).
 */

interface StatDef {
  key: keyof Pick<
    DeliverySummary,
    'total' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'
  >
  label: string
  valueClass: string
}

const STAT_DEFS: StatDef[] = [
  { key: 'total', label: 'Enviados', valueClass: 'text-gray-100' },
  { key: 'delivered', label: 'Entregues', valueClass: 'text-green-400' },
  { key: 'opened', label: 'Abertos', valueClass: 'text-sky-400' },
  { key: 'clicked', label: 'Cliques', valueClass: 'text-indigo-400' },
  { key: 'bounced', label: 'Bounces', valueClass: 'text-red-400' },
  { key: 'complained', label: 'Reclamações', valueClass: 'text-amber-400' },
]

export function DeliverySummaryPanel({ summary }: { summary: DeliverySummary }) {
  return (
    <section aria-label="Resumo de entrega">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Entrega
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" role="list">
        {STAT_DEFS.map((def) => (
          <div
            key={def.key}
            role="listitem"
            className="flex flex-col rounded-[10px] border border-gray-800 bg-gray-900 px-4 py-3"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
              {def.label}
            </span>
            <span className={`mt-1 text-xl font-extrabold tabular-nums ${def.valueClass}`}>
              {summary[def.key].toLocaleString('pt-BR')}
            </span>
          </div>
        ))}
      </div>

      {summary.awaitingEvents > 0 && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500 bg-[rgba(245,158,11,0.12)] px-3 py-1 text-[11px] font-medium text-amber-400">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          {summary.awaitingEvents.toLocaleString('pt-BR')} aguardando eventos de entrega
        </p>
      )}

      {summary.noEventsYet && (
        <p className="mt-2 text-[11px] text-gray-400">
          Sem eventos ainda — os envios foram disparados, mas nenhuma confirmação de entrega
          chegou até agora.
        </p>
      )}

      {summary.total === 0 && (
        <p className="mt-2 text-[11px] text-gray-400">
          Nenhum envio registrado para esta edição.
        </p>
      )}
    </section>
  )
}
