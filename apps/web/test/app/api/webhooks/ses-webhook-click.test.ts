import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Click routing logic — unit-tested in isolation
// ---------------------------------------------------------------------------
// The processEvent function in the SES webhook handler is not exported, so we
// test the click branching logic by extracting the same pattern into a testable
// function. This mirrors the handler's clicked case exactly.

function makeSend(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'send-1',
    edition_id: 'ed-1',
    subscriber_email: 'sub@test.com',
    link_rewrite_enabled: false,
    newsletter_editions: { site_id: 'site-1', newsletter_type_id: 'type-1' },
    ...overrides,
  }
}

function makeSupabase(opts: {
  send: ReturnType<typeof makeSend>
  trackingConsent?: boolean
  trackedLinkId?: string | null
}) {
  const insertNewsletterClick = vi.fn().mockResolvedValue({ data: null, error: null })
  const insertLinkClick = vi.fn().mockResolvedValue({ data: null, error: null })

  const from = vi.fn((table: string) => {
    if (table === 'tracked_links') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: opts.trackedLinkId ? { id: opts.trackedLinkId } : null,
                error: null,
              }),
            })),
          })),
        })),
      }
    }
    if (table === 'newsletter_click_events') {
      return { insert: insertNewsletterClick }
    }
    if (table === 'link_clicks') {
      return { insert: insertLinkClick }
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  })

  return { from, insertNewsletterClick, insertLinkClick }
}

// Extracted click handler logic (mirrors processEvent click branch exactly)
async function handleClick(opts: {
  supabase: { from: ReturnType<typeof vi.fn> }
  send: ReturnType<typeof makeSend>
  url: string
  ip: string
  userAgent: string
  trackPii: boolean
  siteId: string
  editionId: string
}) {
  const { supabase, send, url, ip, userAgent, trackPii, siteId, editionId } = opts

  if (send.link_rewrite_enabled) {
    const { data: trackedLink } = await supabase
      .from('tracked_links')
      .select('id')
      .eq('site_id', siteId)
      .eq('destination_url', url)
      .maybeSingle()

    if (trackedLink) {
      await supabase
        .from('link_clicks')
        .insert({
          link_id: (trackedLink as { id: string }).id,
          source_type: 'newsletter',
          source_id: editionId,
          ...(trackPii ? { ip, user_agent: userAgent } : {}),
        })
    } else {
      await supabase
        .from('newsletter_click_events')
        .insert({ send_id: send.id, url, ...(trackPii ? { ip, user_agent: userAgent } : {}) })
    }
  } else {
    await supabase
      .from('newsletter_click_events')
      .insert({ send_id: send.id, url, ...(trackPii ? { ip, user_agent: userAgent } : {}) })
  }
}

describe('click routing logic', () => {
  it('legacy send routes to newsletter_click_events', async () => {
    const send = makeSend({ link_rewrite_enabled: false })
    const { from, insertNewsletterClick, insertLinkClick } = makeSupabase({
      send,
      trackedLinkId: null,
    })

    await handleClick({
      supabase: { from },
      send,
      url: 'https://example.com',
      ip: '1.2.3.4',
      userAgent: 'UA',
      trackPii: true,
      siteId: 'site-1',
      editionId: 'ed-1',
    })

    expect(insertNewsletterClick).toHaveBeenCalledTimes(1)
    expect(insertLinkClick).not.toHaveBeenCalled()
  })

  it('unified send with known tracked_link routes to link_clicks', async () => {
    const send = makeSend({ link_rewrite_enabled: true })
    const { from, insertNewsletterClick, insertLinkClick } = makeSupabase({
      send,
      trackedLinkId: 'tl-1',
    })

    await handleClick({
      supabase: { from },
      send,
      url: 'https://example.com',
      ip: '1.2.3.4',
      userAgent: 'UA',
      trackPii: true,
      siteId: 'site-1',
      editionId: 'ed-1',
    })

    expect(insertLinkClick).toHaveBeenCalledTimes(1)
    expect(insertNewsletterClick).not.toHaveBeenCalled()
    const insertArg = insertLinkClick.mock.calls[0][0] as Record<string, unknown>
    expect(insertArg.link_id).toBe('tl-1')
    expect(insertArg.source_type).toBe('newsletter')
  })

  it('unified send without tracked_link falls back to newsletter_click_events', async () => {
    const send = makeSend({ link_rewrite_enabled: true })
    const { from, insertNewsletterClick, insertLinkClick } = makeSupabase({
      send,
      trackedLinkId: null,
    })

    await handleClick({
      supabase: { from },
      send,
      url: 'https://example.com',
      ip: '1.2.3.4',
      userAgent: 'UA',
      trackPii: true,
      siteId: 'site-1',
      editionId: 'ed-1',
    })

    expect(insertNewsletterClick).toHaveBeenCalledTimes(1)
    expect(insertLinkClick).not.toHaveBeenCalled()
  })

  it('PII is omitted when trackPii=false', async () => {
    const send = makeSend({ link_rewrite_enabled: false })
    const { from, insertNewsletterClick } = makeSupabase({ send })

    await handleClick({
      supabase: { from },
      send,
      url: 'https://example.com',
      ip: '1.2.3.4',
      userAgent: 'UA',
      trackPii: false,
      siteId: 'site-1',
      editionId: 'ed-1',
    })

    const insertArg = insertNewsletterClick.mock.calls[0][0] as Record<string, unknown>
    expect(insertArg.ip).toBeUndefined()
    expect(insertArg.user_agent).toBeUndefined()
  })
})
