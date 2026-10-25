/**
 * M3b (lado da forja): a decisão do `pode-desligar` (spec 02 §10.10; contrato C11). Pura: recebe o jsonb de
 * `public.obs_archive_pode_desligar(p_site)` e devolve o que o comando imprime. Só `node:`/relativo (o `tsx` da raiz importa).
 *
 * Regra que não muda: leitura que não está na forma do contrato NUNCA vira "pode desligar" (o sistema falha em verde).
 */

export type MotivoPodeDesligar = 'automatico_armado' | 'mes_nao_recebido' | 'b2_vencido_mes_fora'
export interface FaltaPodeDesligar {
  motivo: MotivoPodeDesligar
  classe: string | null
  tabela: string | null
  mes: string | null
  detalhe: string | null
}
export type LeituraPodeDesligar = { ok: true; pode: boolean; faltam: FaltaPodeDesligar[] } | { ok: false; porque: string }

const MOTIVOS: ReadonlySet<string> = new Set(['automatico_armado', 'mes_nao_recebido', 'b2_vencido_mes_fora'])
export const COMANDO_CONFERIR_B2_COMPLETO =
  'bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-casa-conferir-b2-completo.sh'

const textoOuNulo = (v: unknown): v is string | null => v === null || typeof v === 'string'

export function lerPodeDesligar(bruto: unknown): LeituraPodeDesligar {
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) return { ok: false, porque: 'a função não devolveu um objeto' }
  const r = bruto as Record<string, unknown>
  if (typeof r.pode !== 'boolean') return { ok: false, porque: 'sem o campo pode' }
  if (!Array.isArray(r.faltam)) return { ok: false, porque: 'sem a lista faltam' }
  const faltam: FaltaPodeDesligar[] = []
  for (const f of r.faltam as unknown[]) {
    if (typeof f !== 'object' || f === null) return { ok: false, porque: 'pendência que não é objeto' }
    const x = f as Record<string, unknown>
    if (typeof x.motivo !== 'string' || !MOTIVOS.has(x.motivo)) return { ok: false, porque: `motivo desconhecido: ${String(x.motivo)}` }
    const classe = x.classe ?? null
    const tabela = x.tabela ?? null
    const mes = x.mes ?? null
    const detalhe = x.detalhe ?? null
    if (!textoOuNulo(classe) || !textoOuNulo(tabela) || !textoOuNulo(mes) || !textoOuNulo(detalhe)) return { ok: false, porque: 'pendência com campo fora da forma' }
    faltam.push({ motivo: x.motivo as MotivoPodeDesligar, classe, tabela, mes, detalhe })
  }
  if (r.pode && faltam.length > 0) return { ok: false, porque: 'leitura incoerente: pode desligar com pendências' }
  if (!r.pode && faltam.length === 0) return { ok: false, porque: 'leitura incoerente: não pode desligar e nenhuma pendência' }
  return { ok: true, pode: r.pode, faltam }
}

function linha(f: FaltaPodeDesligar): string {
  const onde = [f.classe, f.tabela, f.mes].filter((v): v is string => v !== null).join(' ')
  const extra = f.detalhe === null ? '' : ` (${f.detalhe})`
  switch (f.motivo) {
    case 'automatico_armado': return `- o automático está armado: desarme na página do Arquivo (clique) e rode de novo${extra}`
    case 'mes_nao_recebido': return `- ${onde}: selado e ainda não recebido no NAS; espere o copiador das 03:17 ou das 15:17 e rode de novo${extra}`
    case 'b2_vencido_mes_fora': return `- ${onde}: fora do banco, com a conferência do B2 de mais de 7 dias; rode ${COMANDO_CONFERIR_B2_COMPLETO} e rode de novo${extra}`
  }
}

export function frasesPodeDesligar(l: LeituraPodeDesligar): { codigo: 0 | 1; saida: string[] } {
  if (!l.ok) return { codigo: 1, saida: [`não consegui ler o estado do arquivo: ${l.porque}`, 'NÃO DESLIGUE: sem leitura não há "pode desligar"'] }
  if (l.pode) return { codigo: 0, saida: ['nada pendente: tudo recebido no NAS, automático desarmado, conferências do B2 em dia', 'PODE DESLIGAR'] }
  return { codigo: 1, saida: [...l.faltam.map(linha), `NÃO DESLIGUE AINDA (${l.faltam.length} pendência${l.faltam.length === 1 ? '' : 's'})`] }
}
