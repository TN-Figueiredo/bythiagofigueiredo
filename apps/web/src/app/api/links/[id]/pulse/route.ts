import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const liveEnabled = process.env.LINKS_LIVE_PULSE_ENABLED !== 'false'
  if (!liveEnabled) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 404 })
  }

  const { id } = await params

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      let closed = false

      // Heartbeat every 30s to keep the connection alive
      const heartbeat = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          closed = true
          clearInterval(heartbeat)
        }
      }, 30_000)

      // Initial data event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ linkId: id, clicks: 0, ts: Date.now() })}\n\n`),
      )

      // In production, wire a Supabase Realtime channel here to push live events.
      // For now this is a scaffold -- the package UI handles the EventSource.

      return () => {
        closed = true
        clearInterval(heartbeat)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
