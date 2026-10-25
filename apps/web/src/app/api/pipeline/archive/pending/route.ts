import { NextRequest } from 'next/server'
import { leituraDoDono } from '@/lib/pipeline/archive-auth'
import { lerPendencias } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'

export const dynamic = 'force-dynamic'

/** C13: as pendências do dono, lidas pelo Mac (obs:arquivo). Zero medido é `total: 0`, nunca `data` vazio. */
export async function GET(req: NextRequest) {
  return leituraDoDono(req, { rota: 'pending', funcao: 'obs_archive_owner_pending', ler: lerPendencias })
}
