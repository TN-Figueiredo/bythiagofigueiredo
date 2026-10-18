import { timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { VIDEO_PV } from './contar'
import { executarPv } from './executar'

// Rota TEMPORÁRIA do portão P-V da S4: só leitura, não grava nada, não importa Supabase.
// Não está no cron do vercel.json (só roda quando chamada com o segredo). Removida no lote da S4.
export const runtime = 'nodejs'
export const maxDuration = 300

/** Depois desta data a rota se desativa sozinha (cada chamada faz 78 requisições ao YouTube). */
export const VALIDA_ATE = Date.parse('2026-10-22T00:00:00Z')

export async function GET(req: NextRequest) {
  // 1) autenticação ANTES de olhar `v` (um 400 com segredo certo prova o segredo sem gastar o P-V).
  const authHeader = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected || !authHeader) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const expectedBuf = Buffer.from(`Bearer ${expected}`)
  const actualBuf = Buffer.from(authHeader)
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (req.nextUrl.searchParams.get('v') !== VIDEO_PV) return Response.json({ error: 'invalid v' }, { status: 400 })
  if (Date.now() >= VALIDA_ATE) return Response.json({ error: 'expired' }, { status: 410 })

  const resposta = await executarPv({
    fetch,
    agora: Date.now,
    dormir: (ms) => new Promise<void>((r) => setTimeout(r, ms)),
    regiao: process.env.VERCEL_REGION ?? null,
  })
  return Response.json(resposta)
}
