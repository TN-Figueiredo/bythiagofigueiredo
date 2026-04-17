import type { FastifyInstance } from 'fastify'
import { getServiceClient } from '../lib/supabase.js'

export async function healthPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async () => {
    const supabase = getServiceClient()
    let db: 'ok' | 'fail' = 'fail'
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 2000)
    try {
      const { error } = await supabase
        .from('authors')
        .select('id')
        .limit(1)
        .abortSignal(ac.signal)
      db = error ? 'fail' : 'ok'
    } catch {
      db = 'fail'
    } finally {
      clearTimeout(timer)
    }
    return { status: 'ok', db, time: new Date().toISOString() }
  })
}
