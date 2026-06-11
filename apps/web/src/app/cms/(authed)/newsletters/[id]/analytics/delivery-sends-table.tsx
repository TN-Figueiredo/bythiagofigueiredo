import type { SendDetailRow } from '@/lib/newsletter/delivery'

/**
 * Per-subscriber drill-down behind a native <details> — no client JS.
 * Badge backgrounds use literal rgba (no opacity-modifier classes — Opera
 * renders color-mix() transparent).
 */

const STATUS_LABELS: Record<string, string> = {
  queued: 'Na fila',
  sent: 'Aguardando eventos',
  delivered: 'Entregue',
  opened: 'Aberto',
  clicked: 'Clicou',
  bounced: 'Bounce',
  complained: 'Reclamação',
}

const STATUS_BADGE: Record<string, string> = {
  queued: 'bg-[rgba(107,114,128,0.18)] text-gray-400',
  sent: 'bg-[rgba(245,158,11,0.15)] text-amber-400',
  delivered: 'bg-[rgba(34,197,94,0.15)] text-green-400',
  opened: 'bg-[rgba(14,165,233,0.15)] text-sky-400',
  clicked: 'bg-[rgba(99,102,241,0.18)] text-indigo-400',
  bounced: 'bg-[rgba(239,68,68,0.15)] text-red-400',
  complained: 'bg-[rgba(245,158,11,0.15)] text-amber-400',
}

function formatTimestamp(iso: string | null, timezone: string): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(new Date(iso))
  } catch {
    return '—'
  }
}

interface Props {
  rows: SendDetailRow[]
  total: number
  timezone: string
}

export function DeliverySendsTable({ rows, total, timezone }: Props) {
  if (rows.length === 0) return null

  return (
    <details className="group rounded-[10px] border border-gray-800 bg-gray-900">
      <summary className="cursor-pointer select-none px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-300">
        Envios por assinante ({total.toLocaleString('pt-BR')})
      </summary>
      <div className="overflow-x-auto border-t border-gray-800">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-gray-800">
              <th scope="col" className="px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-gray-500">E-mail</th>
              <th scope="col" className="px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
              <th scope="col" className="px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-gray-500">Entregue em</th>
              <th scope="col" className="px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-gray-500">Aberto em</th>
              <th scope="col" className="px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-gray-500">Tipo de bounce</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.subscriber_email}
                className="border-b border-gray-800 hover:bg-[rgba(31,41,55,0.4)]"
              >
                <td className="px-4 py-2 text-[11px] text-gray-300">{r.subscriber_email}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${STATUS_BADGE[r.status] ?? 'bg-[rgba(107,114,128,0.18)] text-gray-400'}`}
                  >
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-[11px] tabular-nums text-gray-400">
                  {formatTimestamp(r.delivered_at, timezone)}
                </td>
                <td className="px-4 py-2 text-[11px] tabular-nums text-gray-400">
                  {formatTimestamp(r.opened_at, timezone)}
                </td>
                <td className="px-4 py-2 text-[11px] text-gray-400">{r.bounce_type ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length < total && (
        <p className="border-t border-gray-800 px-4 py-2 text-[10px] text-gray-500">
          Mostrando os primeiros {rows.length.toLocaleString('pt-BR')} de{' '}
          {total.toLocaleString('pt-BR')} envios.
        </p>
      )}
    </details>
  )
}
