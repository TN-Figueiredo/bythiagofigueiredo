/**
 * Vercel serverless handler.
 *
 * Adapts Fastify to run as a Vercel function. All HTTP requests are
 * routed here via vercel.json rewrites. We let Fastify's underlying
 * http.Server process the raw req/res — no framework adapter needed.
 */

import type { IncomingMessage, ServerResponse } from 'http'
import buildServer from '../src/index'

let app: Awaited<ReturnType<typeof buildServer>> | null = null

async function getApp() {
  if (!app) {
    app = await buildServer()
    await app.ready()
  }
  return app
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const server = await getApp()
    server.server.emit('request', req, res)
  } catch (err) {
    console.error('Serverless handler error:', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      }),
    )
  }
}
