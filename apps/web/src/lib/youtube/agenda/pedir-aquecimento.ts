// F3-cache T3: o pedido de aquecimento que o cron `sync-youtube` faz depois de invalidar o cache. Um pedido por request do cron (nada em estado de
// módulo: no Fluid compute vários requests dividem a instância). O primeiro `.somar` registra UM só `after()`, que lê a lista final e chama a rota
// `api/cron/observatorio-aquecer`, esperando só o 202.
import * as Sentry from '@sentry/nextjs'
import { recordCronFailure, recordCronSuccess } from '@/lib/cron-health'
import { logCron } from '../../../../lib/logger'
import { LIMITE_FUNCAO_MS } from './relogio'

export const JOB_AQUECER = 'observatorio-aquecer'
export const JOB_AQUECER_PEDIDO = 'observatorio-aquecer-pedido'
/** Com menos que isto sobrando no disparo o pedido nem sai. */
export const SOBRA_MINIMA_PARA_PEDIR_MS = 10_000
export const PRAZO_DO_202_MS = 8_000

export interface PedidoDeAquecimento {
  /** `ids` null (ou vazio vindo de um site inteiro) = o site inteiro; lista vazia sem site inteiro não pede. */
  somar(siteId: string, ids: readonly string[] | null): void
}

export interface DepsDoPedido {
  after: (f: () => Promise<void>) => void
  fetch: typeof fetch
  agora: () => number
  /** Quando o disparo começou (o relógio do request). */
  t0: number
  limiteMs?: number
  saude?: { sucesso: typeof recordCronSuccess; falha: typeof recordCronFailure }
  logar?: typeof logCron
}

export function criarPedidoDeAquecimento(d: DepsDoPedido): PedidoDeAquecimento {
  const alvos = new Map<string, Set<string> | 'inteiro'>()
  let registrado = false
  const saude = d.saude ?? { sucesso: (...a: Parameters<typeof recordCronSuccess>) => recordCronSuccess(...a), falha: (...a: Parameters<typeof recordCronFailure>) => recordCronFailure(...a) }
  const logar: typeof logCron = d.logar ?? (e => logCron(e)) // lazy: a mock de módulo sem logCron só falha se alguém chamar
  const limite = d.limiteMs ?? LIMITE_FUNCAO_MS

  const falhar = async (resumo: string): Promise<void> => {
    try { logar({ job: JOB_AQUECER, status: 'error', err_code: 'pedido', motivo: resumo }) } catch { /* segue */ }
    try { await saude.falha(JOB_AQUECER, resumo, 'info') } catch { /* segue */ }
  }

  const pedir = async (): Promise<void> => {
    try {
      if (limite - (d.agora() - d.t0) < SOBRA_MINIMA_PARA_PEDIR_MS) return await falhar('sem tempo para pedir')
      const base = process.env.NEXT_PUBLIC_APP_URL
      const segredo = process.env.CRON_SECRET
      if (!base) return await falhar('sem endereço')
      if (!segredo) return await falhar('sem segredo')
      // a rota aceita no máximo 500 ids por corpo
      const lotes = [...alvos].flatMap(([siteId, v]): Array<{ siteId: string; ids?: string[] }> => {
        if (v === 'inteiro') return [{ siteId }]
        const todos = [...v]
        return Array.from({ length: Math.ceil(todos.length / 500) }, (_x, k) => ({ siteId, ids: todos.slice(k * 500, (k + 1) * 500) }))
      })
      // medido aqui, logo antes do envio: é quando o envio das etiquetas do cron termina (a agenda ainda avisa o dono e fecha apagamentos depois da invalidação)
      const invalidadoEm = d.agora()
      // a linha "pedido" do vigia; se o upsert falha o cron_health só faz console.error, então a falha de gravar é vista no Sentry
      try { await saude.sucesso(JOB_AQUECER_PEDIDO, 'info') } catch (e) { Sentry.captureException(e, { fingerprint: ['observatorio-aquecer', 'pedido-nao-gravado'], tags: { component: 'observatorio-aquecer' } }) }
      await Promise.all(lotes.map(async lote => {
        try {
          const r = await d.fetch(base.replace(/\/+$/, '') + '/api/cron/observatorio-aquecer', {
            method: 'POST',
            headers: { authorization: 'Bearer ' + segredo, 'content-type': 'application/json' },
            body: JSON.stringify({ ...lote, invalidadoEm }),
            signal: AbortSignal.timeout(PRAZO_DO_202_MS),
            redirect: 'manual',
            cache: 'no-store',
          })
          if (r.status !== 202) await falhar('a rota respondeu ' + r.status + ' em vez de 202')
        } catch (err) {
          await falhar('o pedido não chegou (' + (err instanceof Error ? err.name : 'erro') + ')')
        }
      }))
    } catch (e) {
      Sentry.captureException(e, { tags: { component: 'observatorio-aquecer', step: 'pedido' } })
    }
  }

  return {
    somar(siteId, ids) {
      if (typeof siteId !== 'string' || siteId === '') return
      if (ids !== null) {
        const bons = ids.filter(i => typeof i === 'string' && i !== '')
        if (bons.length === 0) return // lista vazia: nada a aquecer
        const atual = alvos.get(siteId)
        if (atual !== 'inteiro') { const s = atual ?? new Set<string>(); for (const i of bons) s.add(i); alvos.set(siteId, s) }
      } else alvos.set(siteId, 'inteiro')
      if (registrado) return
      registrado = true
      try {
        d.after(pedir)
      } catch (e) {
        // fora de um request (teste, script) o Next lança: não há como pedir, e o pedido nunca derruba a coleta
        Sentry.captureException(e, { tags: { component: 'observatorio-aquecer', step: 'after' } })
      }
    },
  }
}
