import { montarFaixa, faixaTentando, faixaIlegivel, type Faixa, type CtxFaixa } from './faixa-restauracao-texto'
import { restoreStatusIlegivel } from '@/lib/youtube/ab-restore'
import type { AbTestBaseView } from '@/lib/youtube/ab-types'

export interface FaixaDaPagina {
  faixa: Faixa | null
  /** `em` do campo em_andamento mais antigo; nulo = não montar a ilha. */
  emAndamentoDesde: string | null
  ilegivel: boolean
  /** A faixa enquanto "Tentar agora" corre; nulo quando não há faixa. */
  faixaTentando: Faixa | null
}

/** Dados do servidor que a faixa precisa (P4b); o padrão é o mundo sem vigia conhecido e sem permissão. */
export type DadosDaFaixa = Pick<CtxFaixa, 'vigiaUltimaExecucao' | 'podeAdministrar' | 'bloqueio' | 'inicioDoSim'>
export const SEM_DADOS_DA_FAIXA: DadosDaFaixa = { vigiaUltimaExecucao: null, podeAdministrar: false, bloqueio: null, inicioDoSim: {} }

/**
 * Decide o que a página mostra. Encerrado/pausado: a faixa sempre que houver retrato; ativo: só com campo
 * em_andamento. Nulo = mundo antigo (sem faixa); ilegível = aviso de "não sabemos" (quem chama avisa o Sentry).
 */
export function faixaDaPagina(view: AbTestBaseView, bruto: unknown, agora: Date, dados: DadosDaFaixa = SEM_DADOS_DA_FAIXA): FaixaDaPagina {
  const ilegivel = restoreStatusIlegivel(bruto)
  const rs = view.restoreStatus
  const ems = rs ? (['title', 'thumbnail'] as const).flatMap(k => (rs[k]?.estado === 'em_andamento' ? [rs[k]!.em] : [])) : []
  const emAndamentoDesde = ems.length > 0 ? ems.sort()[0]! : null
  const ctxYoutube = { youtubeId: view.youtubeVideoId }
  const ativo = view.status === 'active' || view.status === 'queued' || view.status === 'draft'
  if (ilegivel) return { faixa: ativo ? null : faixaIlegivel(ctxYoutube), emAndamentoDesde: null, ilegivel: true, faixaTentando: null }
  if (ativo && emAndamentoDesde === null) return { faixa: null, emAndamentoDesde: null, ilegivel: false, faixaTentando: null }
  const rotuloDe = (id: string) => view.variantDb.find(v => v.id === id)?.label ?? id
  const ctx: CtxFaixa = {
    agora, rotulo: rotuloDe, noArAntes: view.noArAntes?.label ?? 'A', noArDesde: view.noArAntes?.desde ?? null, youtubeId: view.youtubeVideoId, ...dados,
  }
  const faixa = montarFaixa(rs, ctx)
  return { faixa, emAndamentoDesde, ilegivel: false, faixaTentando: rs && faixa ? faixaTentando(rs, ctx) : null }
}
