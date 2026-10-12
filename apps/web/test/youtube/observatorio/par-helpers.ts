// Ajudantes dos testes do par da comparação (A3 Tarefa 6): canais de mentira com os números que o teste quer, para provar
// as bordas (10%, 2×, zero, nulo) sem depender do que o fixture tem.
import { NUMEROS, type Numero, type NumeroId } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import type { CanalPack, CompararPack } from '@/app/cms/(authed)/youtube/competitors/_comparar/pack'

/** Um número do teste: o valor (texto = o valor), `[valor, texto]`, ou null (não medido, "sem dado"). */
export type Val = number | [number, string] | null

export function numero(v: Val | undefined, motivo = 'sem dado'): Numero {
  if (v == null) return { x: null, texto: null, motivo, nota: null }
  const [x, texto] = Array.isArray(v) ? v : [v, String(v).replace('.', ',')]
  return { x, texto, motivo: null, nota: null }
}

export interface OpcoesCanal {
  name?: string; own?: boolean; niche?: string | null; nicheLabel?: string | null; semVideos?: boolean; comDatas?: boolean
  /** A data exata do último vídeo (ms). Sem ela: derivada de `n.diasUltimo` (dias inteiros antes de AGORA) ou nula. */
  ultimo?: number | null
  /** Os números; o que não for dado é "não medido: sem dado". */
  n?: Partial<Record<NumeroId, Val>>
  /** Atalho para n.inscritos. */
  subs?: number | null
  motivos?: Partial<Record<NumeroId, string>>
}

/** O `now` de `pacoteDe`. */
export const AGORA = 1_800_000_000_000

export function canalDe(id: string, o: OpcoesCanal = {}): CanalPack {
  const numeros = {} as Record<NumeroId, Numero>
  const n = { ...o.n, ...(o.subs !== undefined ? { inscritos: o.subs } : {}) }
  for (const k of NUMEROS) numeros[k] = numero(n[k], o.motivos?.[k] ?? 'sem dado')
  const dias = numeros.diasUltimo.x
  const ultimo = o.ultimo !== undefined ? o.ultimo : dias == null ? null : AGORA - dias * 86_400_000
  const niche = o.niche === undefined ? 'viagem' : o.niche
  return {
    id, name: o.name ?? id, own: o.own ?? false, niche, nicheLabel: niche == null ? null : (o.nicheLabel ?? (niche === 'viagem' ? 'Viagem' : niche)),
    avatar: null, ini: (o.name ?? id).slice(0, 1).toUpperCase(), color: '#888888', subsTexto: numeros.inscritos.texto,
    semVideos: o.semVideos ?? false, comDatas: o.comDatas ?? true, ultimo, href: `/cms/youtube/competitors/${id}`, numeros,
    top5: [], top5Nota: 'Este canal não tem vídeos.', pub90: [], pub90Nota: 'ainda sem vídeos sincronizados',
  }
}

/** O pacote com esses canais: próprios primeiro, depois os concorrentes por inscritos (a mesma ordem do servidor). */
export function pacoteDe(canais: CanalPack[], semanasRitmo = 13): CompararPack {
  const subs = (c: CanalPack) => c.numeros.inscritos.x
  const comps = canais.filter(c => !c.own).sort((a, b) => (subs(a) == null ? 1 : 0) - (subs(b) == null ? 1 : 0) || (subs(b) ?? 0) - (subs(a) ?? 0) || a.id.localeCompare(b.id))
  return {
    now: AGORA, inicio90: AGORA - 90 * 86_400_000, semanasRitmo, eixo: ['01/01', '31/01', '02/03', 'hoje, 01/04'],
    canais, ordem: [...canais.filter(c => c.own).map(c => c.id), ...comps.map(c => c.id)],
  }
}
