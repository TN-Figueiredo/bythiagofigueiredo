import type { NextRequest } from 'next/server'
import {
  metadadoDoEmissor,
  responderMetadado,
} from '@/lib/youtube/observatorio/acesso-ia/oauth/metadados'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = 'gru1'

export function GET(req: NextRequest) {
  return responderMetadado(req, metadadoDoEmissor)
}
