// Na Vercel (Node) a função congela ao responder; o SDK do Sentry só descarrega
// a fila em SIGTERM (que nunca chega) ou dentro de wrappers que a config desliga
// (autoInstrument* = false). Resultado: captureMessage/captureException feitos
// em server component ou rota morriam na fila. Aqui entregamos o flush ao
// waitUntil da requisição (mesmo contrato do @vercel/functions).
import * as Sentry from '@sentry/nextjs'

interface ContextoVercel { waitUntil?: (tarefa: Promise<unknown>) => void }

/** Um flush pendente por requisição; ao terminar, um evento capturado depois agenda outro. */
const pendente = new WeakSet<object>()

/** Chame após enfileirar um evento. No-op fora de uma requisição da Vercel. */
export function agendarFlushNaVercel(): void {
  try {
    const global = globalThis as unknown as Record<symbol, { get?: () => ContextoVercel | undefined } | undefined>
    const ctx = global[Symbol.for('@vercel/request-context')]?.get?.()
    if (!ctx?.waitUntil || pendente.has(ctx)) return
    pendente.add(ctx)
    ctx.waitUntil(Sentry.flush(2000).finally(() => pendente.delete(ctx)))
  } catch {
    // telemetria nunca derruba a requisição
  }
}
