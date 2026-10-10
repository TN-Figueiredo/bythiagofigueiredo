/**
 * O efeito de uma troca como texto, o mesmo motor em toda tela: `effView` (o bloco do painel de Canais, extraído de
 * `_canais/view-model.ts` sem mudar uma letra; só recebe `obs` no lugar do fecho) e `effLine` (a frase de uma linha da aba Trocas
 * do canal). Puro: nenhuma leitura de relógio.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import type { EffectResult } from '@/lib/youtube/observatorio/effect'
import type { EffectView } from '../_canais/view-model'

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)

export function effView(obs: Observatory, e: EffectResult | null): EffectView | null {
  const F = obs.fmt
  if (!e) return null
  const VD: Record<string, [EffectView['vd'], EffectView['icon'], string]> = {
    ganhou: ['won', 'up', 'Ganhou'], perdeu: ['lost', 'down', 'Perdeu'], neutro: ['neu', 'eq', 'Neutro'], inconclusivo: ['inc', 'q', 'Inconclusivo'],
    aguardando: ['wait', 'wait', 'Aguardando'], 'sem-serie': ['wait', 'nodata', 'Sem série antes da troca'], 'sem-antes': ['wait', 'nodata', 'Sem base para comparar'],
  }
  const V = VD[e.status] ?? ['wait', 'q', e.label]
  if (e.status === 'aguardando' && e.waitText) return { vd: 'wait', icon: 'wait', label: null, main: [{ t: e.waitText }], sub: null, subWeak: null }
  if (e.status === 'aguardando') return { vd: 'wait', icon: 'wait', label: 'Aguardando', main: [{ t: `${e.collected ?? 0} de 7 dias coletados, ${e.readyText ?? ''}.` }], sub: e.willBeInconclusive ?? null, subWeak: null }
  if (e.status === 'sem-serie' || e.status === 'sem-antes') return { vd: V[0], icon: V[1], label: V[2], main: [{ t: e.reason }], sub: null, subWeak: null }
  const bd = e.beforeDays ?? 0
  const antes = /antes|anterior/i.test(e.reason || '')
  const range = e.iqr && e.iqr[0] != null ? ` Intervalo dos outros vídeos: ${F.pct(e.iqr[0])} a ${F.pct(e.iqr[1] ?? null)}.` : ''
  const meth = e.n ? ` Esperado = variação mediana dos outros vídeos do canal, ${(e.methodFallback && e.fallbackText ? e.fallbackText : `${e.method}, ${e.band}`).replace(/\s*\(n\s*=\s*0\)/, '')}.` : ''
  const main: EffectView['main'] = e.n
    ? [{ t: e.numbersFlat ?? e.numbers ?? '', mono: true }, ...(e.effectPp != null ? [{ t: ' · efeito ' }, { t: F.pp(e.effectPp), mono: true }] : [])]
    : [{ t: 'observado ' }, { t: F.pct(e.observed ?? null), mono: true }, { t: `; ${e.noBaseText ?? ''}` }]
  return {
    vd: V[0], icon: V[1], label: V[2], main,
    sub: `Views/dia, 7 dias depois${antes ? '' : ` vs ${bd} ${bd === 1 ? 'dia' : 'dias'} antes`}.${meth}${range} ${cap(F.lcfirst(e.reason || ''))}`,
    subWeak: bd < 7 && !antes ? `Antes: ${bd} ${bd === 1 ? 'dia' : 'dias'} (${e.beforeCutBy ? 'desde a troca anterior do mesmo vídeo' : `a coleta por vídeo começou em ${obs.SERIES_START_LABEL}`}).` : null,
  }
}

/**
 * A frase de uma linha da aba Trocas, do mesmo `EffectResult` do Histórico e sem número inventado:
 * "aguardando: 1 de 7 dias coletados, leitura em 13/10", "sem série: …", "sem base: …" ou "{veredito}: {números}".
 * Sem leitura do motor, a frase diz isso em vez de calar.
 */
export function effLine(obs: Observatory, e: EffectResult | null): string {
  if (!e) return 'sem série: o motor não devolveu leitura de efeito para esta troca'
  if (e.status === 'aguardando') return `aguardando: ${e.collected ?? 0} de ${obs.RULES.effect.afterDays} dias coletados, ${e.readyText ?? ''}`.replace(/,\s*$/, '')
  if (e.status === 'sem-serie' || e.status === 'sem-antes') return `${e.label}: ${e.reason}`
  if (e.n) return `${e.label}: ${e.numbersFlat ?? e.numbers ?? e.reason}`
  if (e.observed != null) return `${e.label}: observado ${obs.fmt.pct(e.observed)}; ${e.noBaseText ?? ''}`.replace(/;\s*$/, '')
  return `${e.label}: ${e.reason}`
}
