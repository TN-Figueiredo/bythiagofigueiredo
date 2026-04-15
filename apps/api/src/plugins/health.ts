import type { FastifyInstance } from 'fastify'
import { getServiceClient } from '../lib/supabase.js'

export async function healthPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async () => {
    const supabase = getServiceClient()
    const { error } = await supabase.from('authors').select('id').limit(1)
    return {
      status: 'ok',
      db: error ? 'fail' : 'ok',
      time: new Date().toISOString(),
    }
  })
}
