import type { ChannelSnapshot, ObsChannel } from './types'
import { DAY, H, spDayStart } from './time'

/** Regras de Inscritos em 28 dias (neutras: o Cowork lê as mesmas). A coluna "Crescimento, 30 d" da lista tem outra janela (RI-D2). */
export const REGRAS_INSCRITOS = { janelaDias: 28, folgaDias: 3, exatoAbaixoDe: 1000, multiploDoPasso: 2, retratoVelhoDias: 2 } as const

export type MotivoInscritos = 'canal_proprio' | 'oculto' | 'ainda_nao_coletado' | 'retrato_velho' | 'novo' | 'buraco' | 'arred'
export type InscritosDoCanal =
  | { canal: string; tipo: 'ok'; hoje: number; antes: number; ganho: number; pct: number | null; classe: 'up' | 'dn' | 'eq'; de: string; ate: string }
  | { canal: string; tipo: 'nm'; motivo: MotivoInscritos; hoje: number | null; passo?: number; diasDeHistorico?: number; faltam?: number; data?: string }

/** Passo com que o YouTube arredonda a contagem: 0 abaixo de 1.000 (exata); 10^(⌊log10 n⌋−2) a partir dele. */
export function passoDoYouTube(n: number): number {
  if (!(n >= REGRAS_INSCRITOS.exatoAbaixoDe)) return 0
  return Math.pow(10, Math.floor(Math.log10(n)) - 2)
}

/** Distância em dias inteiros entre dois instantes de meio-dia de São Paulo. */
const dias = (a: number, b: number) => Math.round((a - b) / DAY)
/** 'dd/mm' do dia de São Paulo do instante (só para escrever na tela). */
const ddmm = (ms: number) => { const d = new Date(spDayStart(ms) + 12 * H - 3 * H); const p = (n: number) => String(n).padStart(2, '0'); return p(d.getUTCDate()) + '/' + p(d.getUTCMonth() + 1) }

/** Retratos públicos diários do canal próprio (MG20), lidos por `lerRetratosProprios`; `oculto` vem do retrato mais novo. */
export interface RetratosDoProprio { retratos: readonly ChannelSnapshot[]; oculto: boolean }

export function inscritosDoCanal(c: ObsChannel, p: { agoraMs: number; proprio?: RetratosDoProprio }): InscritosDoCanal {
  const canal = c.id
  const nm = (motivo: MotivoInscritos, hoje: number | null, extra: { passo?: number; diasDeHistorico?: number; faltam?: number; data?: string } = {}): InscritosDoCanal =>
    ({ canal, tipo: 'nm', motivo, hoje, ...extra })
  // Canal próprio: a MESMA régua dos concorrentes (o dado é o mesmo: total público, 3 algarismos), sobre os retratos da MG20 e nunca sobre `c.snapshots`.
  // Sem `proprio` (a leitura falhou) não há medida: canal_proprio ("não lido").
  if (c.own && !p.proprio) return nm('canal_proprio', null)
  const oculto = c.own ? p.proprio!.oculto : c.subs == null
  const retratos = c.own ? p.proprio!.retratos : c.snapshots
  if (oculto) return nm('oculto', null)
  const snaps = [...retratos].sort((a, b) => a.t - b.t)
  const hoje = snaps[snaps.length - 1]
  if (!hoje) return nm('ainda_nao_coletado', null)
  const meioDiaHoje = spDayStart(p.agoraMs) + 12 * H
  if (dias(meioDiaHoje, hoje.t) > REGRAS_INSCRITOS.retratoVelhoDias) return nm('retrato_velho', hoje.subs, { data: ddmm(hoje.t) })
  const { janelaDias, folgaDias, multiploDoPasso } = REGRAS_INSCRITOS
  const primeiro = snaps[0]!
  const historico = dias(hoje.t, primeiro.t)
  if (historico < janelaDias) return nm('novo', hoje.subs, { diasDeHistorico: historico, faltam: janelaDias - historico })
  // o mais novo entre 28 e 31 dias antes de `hoje`
  let antes: typeof hoje | undefined
  for (const s of snaps) { const d = dias(hoje.t, s.t); if (d >= janelaDias && d <= janelaDias + folgaDias) antes = s }
  if (!antes) return nm('buraco', hoje.subs, { data: ddmm(hoje.t - janelaDias * DAY) })
  const ganho = hoje.subs - antes.subs
  const passo = passoDoYouTube(Math.max(hoje.subs, antes.subs))
  if (passo > 0 && Math.abs(ganho) < multiploDoPasso * passo) return nm('arred', hoje.subs, { passo })
  return {
    canal, tipo: 'ok', hoje: hoje.subs, antes: antes.subs, ganho,
    pct: antes.subs === 0 ? null : ganho / antes.subs * 100,
    classe: ganho > 0 ? 'up' : ganho < 0 ? 'dn' : 'eq',
    de: antes.date, ate: hoje.date,
  }
}
