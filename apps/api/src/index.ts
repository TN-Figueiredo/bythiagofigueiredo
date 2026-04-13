import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'

const server = Fastify({ logger: true })

await server.register(cors, {
  origin: process.env.WEB_URL ?? 'http://localhost:3001',
})

await server.register(helmet)

// TODO: [APP_NAME] Register auth routes
// import { registerAuthRoutes } from '@tn-figueiredo/auth-fastify'
// await registerAuthRoutes(server, { supabaseUrl: ..., supabaseKey: ... })

// TODO: [APP_NAME] Register app-specific routes

server.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '1.0.0',
  env: process.env.NODE_ENV ?? 'development',
}))

const start = async (): Promise<void> => {
  try {
    const port = Number(process.env.PORT) || 3333
    const host = process.env.HOST ?? '0.0.0.0'
    await server.listen({ port, host })
    console.log(`🚀 API running on http://${host}:${port}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

// Vercel runs the app via the serverless handler (api/index.ts).
// Locally we boot the long-running Fastify server.
if (!process.env.VERCEL) {
  await start()
}

export default server
