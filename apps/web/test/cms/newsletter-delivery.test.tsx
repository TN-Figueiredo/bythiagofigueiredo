import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import {
  aggregateDeliverySummary,
  sortSendRows,
  type SendDetailRow,
  type SendStatusRow,
} from '../../lib/newsletter/delivery'
import { DeliverySummaryPanel } from '../../src/app/cms/(authed)/newsletters/[id]/analytics/delivery-summary'
import { DeliverySendsTable } from '../../src/app/cms/(authed)/newsletters/[id]/analytics/delivery-sends-table'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function row(overrides: Partial<SendStatusRow> = {}): SendStatusRow {
  return {
    status: 'sent',
    delivered_at: null,
    opened_at: null,
    clicked_at: null,
    ...overrides,
  }
}

function detailRow(overrides: Partial<SendDetailRow> = {}): SendDetailRow {
  return {
    subscriber_email: 'a@example.com',
    status: 'sent',
    delivered_at: null,
    opened_at: null,
    clicked_at: null,
    bounce_type: null,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  aggregateDeliverySummary                                          */
/* ------------------------------------------------------------------ */

describe('aggregateDeliverySummary', () => {
  it('counts each status bucket correctly', () => {
    const summary = aggregateDeliverySummary([
      row({ status: 'delivered', delivered_at: '2026-06-09T10:00:00Z' }),
      row({ status: 'opened', delivered_at: '2026-06-09T10:00:00Z', opened_at: '2026-06-09T11:00:00Z' }),
      row({ status: 'clicked', delivered_at: '2026-06-09T10:00:00Z', opened_at: '2026-06-09T11:00:00Z', clicked_at: '2026-06-09T11:05:00Z' }),
      row({ status: 'bounced' }),
      row({ status: 'complained' }),
      row({ status: 'sent' }),
    ])

    expect(summary.total).toBe(6)
    expect(summary.delivered).toBe(3) // delivered + opened + clicked are cumulative
    expect(summary.opened).toBe(2) // opened + clicked
    expect(summary.clicked).toBe(1)
    expect(summary.bounced).toBe(1)
    expect(summary.complained).toBe(1)
    expect(summary.awaitingEvents).toBe(1) // the bare status=sent row
    expect(summary.noEventsYet).toBe(false)
  })

  it('flags rows still status=sent with no timestamps as aguardando eventos', () => {
    const summary = aggregateDeliverySummary([
      row({ status: 'sent' }),
      row({ status: 'queued' }),
      row({ status: 'sent', delivered_at: '2026-06-09T10:00:00Z' }), // event arrived, status lagging
    ])

    expect(summary.awaitingEvents).toBe(2)
    expect(summary.delivered).toBe(1) // delivered_at counts even if status lags
    expect(summary.noEventsYet).toBe(false)
  })

  it('marks noEventsYet for pre-webhook editions (all sends, zero events)', () => {
    const summary = aggregateDeliverySummary([
      row({ status: 'sent' }),
      row({ status: 'sent' }),
    ])

    expect(summary.total).toBe(2)
    expect(summary.delivered).toBe(0)
    expect(summary.awaitingEvents).toBe(2)
    expect(summary.noEventsYet).toBe(true)
  })

  it('handles empty editions', () => {
    const summary = aggregateDeliverySummary([])
    expect(summary.total).toBe(0)
    expect(summary.awaitingEvents).toBe(0)
    expect(summary.noEventsYet).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  sortSendRows                                                      */
/* ------------------------------------------------------------------ */

describe('sortSendRows', () => {
  it('sorts problems first, then awaiting, then delivered', () => {
    const sorted = sortSendRows([
      detailRow({ subscriber_email: 'ok@example.com', status: 'delivered' }),
      detailRow({ subscriber_email: 'waiting@example.com', status: 'sent' }),
      detailRow({ subscriber_email: 'bad@example.com', status: 'bounced', bounce_type: 'hard' }),
    ])

    expect(sorted.map((r) => r.subscriber_email)).toEqual([
      'bad@example.com',
      'waiting@example.com',
      'ok@example.com',
    ])
  })
})

/* ------------------------------------------------------------------ */
/*  DeliverySummaryPanel                                              */
/* ------------------------------------------------------------------ */

describe('DeliverySummaryPanel', () => {
  const baseSummary = {
    total: 100,
    delivered: 95,
    opened: 40,
    clicked: 10,
    bounced: 3,
    complained: 1,
    awaitingEvents: 0,
    noEventsYet: false,
  }

  it('renders all six stat labels with counts', () => {
    render(<DeliverySummaryPanel summary={baseSummary} />)

    expect(screen.getByText('Enviados')).toBeDefined()
    expect(screen.getByText('Entregues')).toBeDefined()
    expect(screen.getByText('Abertos')).toBeDefined()
    expect(screen.getByText('Cliques')).toBeDefined()
    expect(screen.getByText('Bounces')).toBeDefined()
    expect(screen.getByText('Reclamações')).toBeDefined()
    expect(screen.getByText('100')).toBeDefined()
    expect(screen.getByText('95')).toBeDefined()
  })

  it('shows the aguardando eventos pill when sends lack events', () => {
    render(
      <DeliverySummaryPanel
        summary={{ ...baseSummary, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, awaitingEvents: 100, noEventsYet: true }}
      />,
    )

    expect(screen.getByText(/aguardando eventos de entrega/)).toBeDefined()
    expect(screen.getByText(/Sem eventos ainda/)).toBeDefined()
  })

  it('does not show aguardando eventos when all sends have events', () => {
    render(<DeliverySummaryPanel summary={baseSummary} />)
    expect(screen.queryByText(/aguardando eventos/)).toBeNull()
    expect(screen.queryByText(/Sem eventos ainda/)).toBeNull()
  })

  it('shows empty state when edition has zero sends', () => {
    render(
      <DeliverySummaryPanel
        summary={{ ...baseSummary, total: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 }}
      />,
    )
    expect(screen.getByText(/Nenhum envio registrado/)).toBeDefined()
  })
})

/* ------------------------------------------------------------------ */
/*  DeliverySendsTable                                                */
/* ------------------------------------------------------------------ */

describe('DeliverySendsTable', () => {
  it('renders email, status badge, timestamps and bounce_type', () => {
    render(
      <DeliverySendsTable
        timezone="America/Sao_Paulo"
        total={2}
        rows={[
          detailRow({
            subscriber_email: 'bad@example.com',
            status: 'bounced',
            bounce_type: 'hard',
          }),
          detailRow({
            subscriber_email: 'ok@example.com',
            status: 'opened',
            delivered_at: '2026-06-09T10:00:00Z',
            opened_at: '2026-06-09T11:00:00Z',
          }),
        ]}
      />,
    )

    expect(screen.getByText('bad@example.com')).toBeDefined()
    expect(screen.getByText('Bounce')).toBeDefined()
    expect(screen.getByText('hard')).toBeDefined()
    expect(screen.getByText('ok@example.com')).toBeDefined()
    expect(screen.getByText('Aberto')).toBeDefined()
  })

  it('labels status=sent rows as aguardando eventos', () => {
    render(
      <DeliverySendsTable
        timezone="America/Sao_Paulo"
        total={1}
        rows={[detailRow({ subscriber_email: 'wait@example.com', status: 'sent' })]}
      />,
    )

    expect(screen.getByText('Aguardando eventos')).toBeDefined()
  })

  it('renders nothing when there are no rows', () => {
    const { container } = render(
      <DeliverySendsTable timezone="America/Sao_Paulo" total={0} rows={[]} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('notes truncation when rows are capped below total', () => {
    render(
      <DeliverySendsTable
        timezone="America/Sao_Paulo"
        total={1200}
        rows={[detailRow()]}
      />,
    )
    expect(screen.getByText(/Mostrando os primeiros 1 de 1\.200 envios/)).toBeDefined()
  })
})
