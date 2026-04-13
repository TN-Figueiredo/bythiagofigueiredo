import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: process.env.WEB_URL ?? 'http://localhost:3001',
})

await app.register(helmet)

// TODO: [APP_NAME] Register auth routes
// import { registerAuthRoutes } from '@tn-figueiredo/auth-fastify'
// await registerAuthRoutes(app, { supabaseUrl: ..., supabaseKey: ... })

// TODO: [APP_NAME] Register app-specific routes

app.get('/health', async () => ({ status: 'ok' }))

const port = Number(process.env.PORT) ?? 3333

try {
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`🚀 API running on port ${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
