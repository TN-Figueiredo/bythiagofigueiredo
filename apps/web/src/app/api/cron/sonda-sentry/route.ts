// SONDA TEMPORÁRIA (frente sentry-node-producao): remover depois da prova em produção.
// Só booleanos e o id da sonda; nunca devolve DSN, segredo nem dado de usuário.
// Não entra em vercel.json. Separa: init ausente (cliente=false), envio perdido
// (cliente=true, flush=false) e canal bom (flush=true + evento no Sentry).
import { randomUUID, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!expected || !authHeader) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const expectedBuf = Buffer.from(`Bearer ${expected}`)
  const actualBuf = Buffer.from(authHeader)
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const cliente = Sentry.getClient()
  const sondaId = randomUUID()
  const fonte = Reflect.get(globalThis, Symbol.for('@vercel/request-context')) as
    | { get?: () => { waitUntil?: unknown } | undefined }
    | undefined
  const contextoVercel = typeof fonte?.get?.()?.waitUntil === 'function'

  Sentry.captureMessage('sonda-sentry', { level: 'warning', tags: { sonda: sondaId } })
  const flush = await Sentry.flush(3000)

  return Response.json({
    runtimeNode: process.env.NEXT_RUNTIME === 'nodejs',
    cliente: !!cliente,
    dsnNoCliente: !!cliente?.getDsn(),
    contextoVercel,
    flush,
    sondaId,
  })
}
