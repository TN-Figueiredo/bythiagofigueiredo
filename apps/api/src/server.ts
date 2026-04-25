import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { env } from './env.js'
import { healthPlugin } from './plugins/health.js'
import { authPlugin } from './plugins/auth.js'
import { adsPlugin } from './routes/ads.js'
import { initSentry, isSentryInitialized, Sentry } from './sentry.js'

export async function buildServer(): Promise<FastifyInstance> {
  // Init Sentry before anything else so bootstrap errors get captured too.
  initSentry()

  const app = Fastify({ logger: true })
  await app.register(cors, { origin: env.WEB_URL })
  await app.register(helmet)
  await app.register(healthPlugin)
  await app.register(authPlugin)
  await app.register(adsPlugin)

  // Sprint 4 Epic 9 T67 — forward unhandled errors to Sentry with route tag.
  app.addHook('onError', async (req, _reply, err) => {
    if (isSentryInitialized()) {
      Sentry.captureException(err, {
        tags: { route: req.routeOptions?.url ?? req.url },
      })
    }
  })

  return app
}
