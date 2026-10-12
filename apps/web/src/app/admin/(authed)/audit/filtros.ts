import { ACOES_DE_LEITURA } from '@/lib/pipeline/leitura-acoes'   // sem Sentry nem cliente de serviço

export interface ConsultaDeAuditoria<Q> {
  eq(coluna: string, valor: string): Q
  not(coluna: string, operador: string, valor: string): Q
}

/**
 * Filtros da listagem de /admin/audit. O registro de leitura do pipeline (E19) grava uma linha por leitura feita por chave:
 * sem isto, a listagem padrão do super admin viraria só essas linhas. Filtrando pela ação elas aparecem.
 */
export function aplicarFiltrosDeAuditoria<Q extends ConsultaDeAuditoria<Q>>(q: Q, f: { org?: string; action?: string; resource?: string }): Q {
  let out = q
  if (f.org) out = out.eq('org_id', f.org)
  if (f.action) out = out.eq('action', f.action)
  else out = out.not('action', 'in', `(${ACOES_DE_LEITURA.join(',')})`)
  if (f.resource) out = out.eq('resource_type', f.resource)
  return out
}
