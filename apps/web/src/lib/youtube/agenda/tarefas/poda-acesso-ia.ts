import * as Sentry from '@sentry/nextjs'
import { podarAcessoIa, type FeitoDaPoda } from '@/lib/youtube/observatorio/acesso-ia/poda'
import { DEFINICAO_PODA_ACESSO_IA } from '../definicoes'
import type { ResultadoTarefa, Tarefa } from '../tipos'

const DIA_MS = 86_400_000

/** Tudo que a poda apagou, das tabelas antigas e das novas (tokens, pedidos, contadores, clientes). */
function apagadasDe(f: Partial<FeitoDaPoda>): number {
  return (f.registroApagadas ?? 0) + (f.taxaApagadas ?? 0) + (f.tokensApagadas ?? 0) + (f.pedidosApagadas ?? 0)
    + (f.rateIpApagadas ?? 0) + (f.ratePessoaApagadas ?? 0) + (f.clientesApagados ?? 0)
}

/** Só número vai ao `detalhe`: a data do limite inferior vira "há quantos dias". */
function detalheDe(f: FeitoDaPoda, agora: number): Record<string, number> {
  const d: Record<string, number> = {}
  if (f.registroTotal !== undefined) d.registro_total = f.registroTotal
  if (f.registroApagadas !== undefined) d.registro_apagadas = f.registroApagadas
  if (f.taxaTotal !== undefined) d.taxa_total = f.taxaTotal
  if (f.taxaApagadas !== undefined) d.taxa_apagadas = f.taxaApagadas
  if (f.tokensTotal !== undefined) d.tokens_total = f.tokensTotal
  if (f.tokensApagadas !== undefined) d.tokens_apagadas = f.tokensApagadas
  if (f.pedidosTotal !== undefined) d.pedidos_total = f.pedidosTotal
  if (f.pedidosApagadas !== undefined) d.pedidos_apagadas = f.pedidosApagadas
  if (f.rateIpTotal !== undefined) d.rate_ip_total = f.rateIpTotal
  if (f.rateIpApagadas !== undefined) d.rate_ip_apagadas = f.rateIpApagadas
  if (f.ratePessoaTotal !== undefined) d.rate_pessoa_total = f.ratePessoaTotal
  if (f.ratePessoaApagadas !== undefined) d.rate_pessoa_apagadas = f.ratePessoaApagadas
  if (f.clientesApagados !== undefined) d.clientes_apagados = f.clientesApagados
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
        return { estado: 'ok', feitas: apagadasDe(r.r), deixadas: 0, detalhe: detalheDe(r.r, c.agora()) }
      }
      const parcial = r.motivo === 'sem_tempo_para_terminar' || r.motivo === 'atraso_restante'
      const detalhe = detalheDe(r.feito, c.agora())
      return {
        estado: parcial ? 'parcial' : 'erro',
        feitas: apagadasDe(r.feito),
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
