import { buildServer } from './server.js'
import { env } from './env.js'

async function start(): Promise<void> {
  const app = await buildServer()
  try {
    await app.listen({ port: env.PORT, host: process.env.HOST ?? '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

if (!process.env.VERCEL) {
  void start()
}

export default buildServer
