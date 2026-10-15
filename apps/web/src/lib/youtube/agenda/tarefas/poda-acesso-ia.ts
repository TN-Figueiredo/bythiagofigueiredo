import * as Sentry from '@sentry/nextjs'
import { podarAcessoIa, type FeitoDaPoda } from '@/lib/youtube/observatorio/acesso-ia/poda'
import { DEFINICAO_PODA_ACESSO_IA } from '../definicoes'
import type { ResultadoTarefa, Tarefa } from '../tipos'

const DIA_MS = 86_400_000

/** Só número vai ao `detalhe`: a data do limite inferior vira "há quantos dias". */
function detalheDe(f: FeitoDaPoda, agora: number): Record<string, number> {
  const d: Record<string, number> = {}
  if (f.registroTotal !== undefined) d.registro_total = f.registroTotal
  if (f.registroApagadas !== undefined) d.registro_apagadas = f.registroApagadas
  if (f.taxaTotal !== undefined) d.taxa_total = f.taxaTotal
  if (f.taxaApagadas !== undefined) d.taxa_apagadas = f.taxaApagadas
  if (f.limpoAte !== undefined) {
    const t = Date.parse(f.limpoAte)
    if (Number.isFinite(t)) d.limpo_ha_dias = Math.max(0, Math.floor((agora - t) / DIA_MS))
  }
  return d
}

/**
 * `poda_acesso_ia` (A5 E17 degrau 2, Tarefa 13b): adapta `podarAcessoIa` à agenda. Devolve só CÓDIGO de catálogo e número; nenhuma exceção chega ao
 * despachante (quem lança vira `excecao`, e só a classe do erro vai ao Sentry). `ok` com as duas tabelas em zero é dado lido, não dado ausente.
 * Erro de banco, contagem ausente e tabela ausente são `erro`; falta de tempo e atraso restante são `parcial` (a poda converge sozinha, um dia por vez).
 * A definição mora em `agenda/definicoes.ts`, o módulo leve que o vigia também lê.
 */
export const podaAcessoIa: Tarefa = {
  ...DEFINICAO_PODA_ACESSO_IA,
  rodar: async (c): Promise<ResultadoTarefa> => {
    try {
      const sobraMs = () => c.t0 + DEFINICAO_PODA_ACESSO_IA.fimAteMs - c.agora()
      const r = await podarAcessoIa(c.sb, c.agora(), sobraMs)
      if (r.ok) {
        return { estado: 'ok', feitas: r.r.registroApagadas + r.r.taxaApagadas, deixadas: 0, detalhe: detalheDe(r.r, c.agora()) }
      }
      const parcial = r.motivo === 'sem_tempo_para_terminar' || r.motivo === 'atraso_restante'
      const detalhe = detalheDe(r.feito, c.agora())
      return {
        estado: parcial ? 'parcial' : 'erro',
        feitas: (r.feito.registroApagadas ?? 0) + (r.feito.taxaApagadas ?? 0),
        deixadas: null,
        motivo: r.motivo,
        ...(Object.keys(detalhe).length > 0 ? { detalhe } : {}),
      }
    } catch (err) {
      Sentry.captureMessage('poda_acesso_ia: inesperado: ' + (err instanceof Error ? err.name : typeof err), 'error')
      return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'excecao' }
    }
  },
}
