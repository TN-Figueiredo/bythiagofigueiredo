import { NextRequest } from 'next/server'
import { leituraDoDono } from '@/lib/pipeline/archive-auth'
import { lerPodeDesligar } from '@/lib/youtube/observatorio/arquivo/pode-desligar'

export const dynamic = 'force-dynamic'

/** C11 (r2.5): se o arquivo do NAS pode ficar offline, lido pelo Mac. Fora da forma é 500, nunca `pode: true`. */
export async function GET(req: NextRequest) {
  return leituraDoDono(req, { rota: 'pode-desligar', funcao: 'obs_archive_pode_desligar', ler: lerPodeDesligar })
}
