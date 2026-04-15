import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { env } from './env.js'
import { healthPlugin } from './plugins/health.js'
import { authPlugin } from './plugins/auth.js'

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true })
  await app.register(cors, { origin: env.WEB_URL })
  await app.register(helmet)
  await app.register(healthPlugin)
  await app.register(authPlugin)
  return app
}
