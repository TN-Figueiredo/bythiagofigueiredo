// A5 · E5a, Tarefa 5: medidas sintéticas (M3a e M8 de cada canal) e extras para as telas da lista de Canais. Só dado sintético.
import { medido, naoMedido, type Medida } from '@/lib/youtube/observatorio/medidas/tipos'
import type { ValorDirecaoCanal } from '@/lib/youtube/observatorio/medidas/direcao'
import type { M8DoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import type { EstadoDoCanal } from '@/lib/youtube/observatorio/medidas/estado-canal'
import type { ExtrasDoCanal } from '@/lib/youtube/observatorio/medidas-telas/ler-extras-dos-canais'
import type { MedidasParaLista } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import type { Observatory } from '@/lib/youtube/observatorio'

export const JANELA = { de: '2026-08-25', ate: '2026-10-13', dias: 56 }

export const direcaoMedida = (rec: number, ant: number, janela = JANELA): Medida<ValorDirecaoCanal> =>
  medido<ValorDirecaoCanal>({ variacao: rec / ant - 1, direcao: 'igual', ganhoRecente: rec, ganhoAnterior: ant }, 3, janela)

export function m8De(estado: EstadoDoCanal, o: { dias?: number; limite?: number; queda?: M8DoCanal['queda'] } = {}): M8DoCanal {
  return {
    estado: medido(estado, 1, { de: null, ate: '2026-10-14', dias: null }),
    parado: medido({ dias: o.dias ?? 3, limite: o.limite ?? 28 }, 1, { de: null, ate: null, dias: o.dias ?? 3 }),
    queda: o.queda ?? naoMedido('janela_cruza_mudanca_de_contagem', { fechaEm: '2026-12-14' }),
  }
}

export const EXTRAS_OK: ExtrasDoCanal = { missingSince: null, subscribersHidden: false, lastOkSyncedAt: null }

export type PorCanal = Record<string, { m3a?: Medida<ValorDirecaoCanal>; m8?: M8DoCanal; extras?: Partial<ExtrasDoCanal> } | 'nao_carregou'>

/** Todo concorrente do motor tem medida: ativo, direção +20%, salvo o que `sobre` troca. Canal próprio fica de fora (como no carregador). */
export function medidasDoMotor(obs: Pick<Observatory, 'channels'>, sobre: PorCanal = {}, extrasNaoLidos = false): MedidasParaLista {
  const porCanal = new Map<string, MedidasParaLista['porCanal'] extends ReadonlyMap<string, infer V> ? V : never>()
  const extras = new Map<string, ExtrasDoCanal>()
  for (const c of obs.channels) {
    if (c.own) continue
    const o = sobre[c.id]
    if (o === 'nao_carregou') { porCanal.set(c.id, { naoCarregou: 'erro_do_banco' }); extras.set(c.id, EXTRAS_OK); continue }
    porCanal.set(c.id, { m3a: o?.m3a ?? direcaoMedida(120, 100), m8: o?.m8 ?? m8De('ativo') })
    extras.set(c.id, { ...EXTRAS_OK, ...(o?.extras ?? {}) })
  }
  return { porCanal, extras: extrasNaoLidos ? { lido: false, causa: 'erro_do_banco' } : { lido: true, dados: extras } }
}

/** O oráculo não tem retratos: o M8 sintético diz "parado" para os canais que o motor chama de parados, com os mesmos dias (`pausedDays`). */
export function medidasDoOraculo(obs: Pick<Observatory, 'channels'>): MedidasParaLista {
  const sobre: PorCanal = {}
  for (const c of obs.channels) {
    if (c.own) continue
    sobre[c.id] = c.activity.state === 'parado' ? { m8: m8De('parado', { dias: c.activity.pausedDays ?? 40, limite: 28 }) } : {}
  }
  return medidasDoMotor(obs, sobre)
}
