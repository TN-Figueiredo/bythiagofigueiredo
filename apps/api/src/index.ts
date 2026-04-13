import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'

const server = Fastify({ logger: true })

// Plugin registration — Fastify resolves these during server.ready().
// Don't `await` here: this file is loaded as CommonJS on Vercel
// (package.json has no "type": "module") and top-level await is not
// allowed in CJS.
server.register(cors, {
  origin: process.env.WEB_URL ?? 'http://localhost:3001',
})

server.register(helmet)

// TODO: [APP_NAME] Register auth routes
// import { registerAuthRoutes } from '@tn-figueiredo/auth-fastify'
// server.register(registerAuthRoutes, { supabaseUrl: ..., supabaseKey: ... })

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
  start()
}

export default server
