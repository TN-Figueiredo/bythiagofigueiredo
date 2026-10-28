// Na Vercel (Node) a função congela ao responder; o SDK do Sentry só descarrega
// a fila em SIGTERM (que nunca chega) ou dentro de wrappers que a config desliga
// (autoInstrument* = false). Resultado: captureMessage/captureException feitos
// em server component ou rota morriam na fila. Aqui entregamos o flush ao
// waitUntil da requisição (mesmo contrato do @vercel/functions).
import * as Sentry from '@sentry/nextjs'

interface ContextoVercel { waitUntil?: (tarefa: Promise<unknown>) => void }

// Fora do alcance: captura sem contexto de requisição (boot, promessa solta após a resposta) continua sem flush.

/** Um flush pendente por requisição; evento capturado durante ele marca "sujo" e ganha nova volta. */
const pendente = new WeakSet<object>()
const sujo = new WeakSet<object>()
const MAX_VOLTAS = 5 // 5 × ~4 s no pior caso < maxDuration mínimo (30 s)

/** Chame após enfileirar um evento. No-op fora de uma requisição da Vercel. */
export function agendarFlushNaVercel(): void {
  try {
    const global = globalThis as unknown as Record<symbol, { get?: () => ContextoVercel | undefined } | undefined>
    const ctx = global[Symbol.for('@vercel/request-context')]?.get?.()
    if (!ctx?.waitUntil) return
    if (pendente.has(ctx)) { sujo.add(ctx); return }
    pendente.add(ctx)
    const descarregar = async (): Promise<void> => {
      try {
        let voltas = 0
        do { sujo.delete(ctx); await Sentry.flush(2000); voltas++ } while (sujo.has(ctx) && voltas < MAX_VOLTAS)
      } finally { pendente.delete(ctx); sujo.delete(ctx) }
    }
    ctx.waitUntil(descarregar())
  } catch {
    // telemetria nunca derruba a requisição
  }
}
