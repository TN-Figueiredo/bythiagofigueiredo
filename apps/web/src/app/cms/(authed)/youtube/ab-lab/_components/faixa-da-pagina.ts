import { montarFaixa, faixaIlegivel, type Faixa } from './faixa-restauracao-texto'
import { restoreStatusIlegivel } from '@/lib/youtube/ab-restore'
import type { AbTestBaseView } from '@/lib/youtube/ab-types'

export interface FaixaDaPagina {
  faixa: Faixa | null
  /** `em` do campo em_andamento mais antigo; nulo = não montar a ilha. */
  emAndamentoDesde: string | null
  ilegivel: boolean
}

/**
 * Decide o que a página mostra. Encerrado/pausado: a faixa sempre que houver retrato; ativo: só com campo
 * em_andamento. Nulo = mundo antigo (sem faixa); ilegível = aviso de "não sabemos" (quem chama avisa o Sentry).
 */
export function faixaDaPagina(view: AbTestBaseView, bruto: unknown, agora: Date): FaixaDaPagina {
  const ilegivel = restoreStatusIlegivel(bruto)
  const rs = view.restoreStatus
  const ems = rs ? (['title', 'thumbnail'] as const).flatMap(k => (rs[k]?.estado === 'em_andamento' ? [rs[k]!.em] : [])) : []
  const emAndamentoDesde = ems.length > 0 ? ems.sort()[0]! : null
  const ctxYoutube = { youtubeId: view.youtubeVideoId }
  const ativo = view.status === 'active' || view.status === 'queued' || view.status === 'draft'
  if (ilegivel) return { faixa: ativo ? null : faixaIlegivel(ctxYoutube), emAndamentoDesde: null, ilegivel: true }
  if (ativo && emAndamentoDesde === null) return { faixa: null, emAndamentoDesde: null, ilegivel: false }
  const rotuloDe = (id: string) => view.variantDb.find(v => v.id === id)?.label ?? id
  const faixa = montarFaixa(rs, {
    agora, rotulo: rotuloDe, noArAntes: view.noArAntes?.label ?? 'A', noArDesde: view.noArAntes?.desde ?? null, youtubeId: view.youtubeVideoId,
    // Provisório até a Tarefa 8 (a página passa os valores reais).
    vigiaUltimaExecucao: null, podeAdministrar: false, bloqueio: null, inicioDoSim: {},
  })
  return { faixa, emAndamentoDesde, ilegivel: false }
}
