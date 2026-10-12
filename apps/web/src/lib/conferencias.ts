// A5, item 246: toda conferência "N dias depois do deploy" tem data absoluta, responsável e a data em que foi feita.
// É o lugar onde as etapas acrescentam as suas (uma entrada na lista, no commit do deploy; o cron não muda).
//
// O que o cron diário da coleta faz com a lista (lib/youtube/coleta/index.ts, fase 'depois'):
//   - vencida (a data passou) e sem `feitaEm`: aparece em `coleta.conferencias_vencidas`, com o nome;
//   - vencida há MAIS de 7 dias e sem `feitaEm`: entra também em `falhas` e deixa o cron vermelho.
// Fazer uma conferência = rodar a consulta de `onde`, anotar o resultado no ledger da etapa e preencher `feitaEm` aqui,
// num commit (a linha some do resumo e do vermelho no deploy seguinte). Conferência vencida há muito tempo continua
// vermelha até alguém preencher `feitaEm`: é intencional, o vermelho que some sozinho ensina a esquecer a conferência.
// A mesma lista, para quem lê sem abrir o código: .superpowers/sdd/a5/conferencias-com-data.md.
export interface Conferencia {
  id: string
  etapa: string
  /** Dia de São Paulo (AAAA-MM-DD) em que a conferência é devida. Vence no dia seguinte. */
  data: string
  responsavel: 'agente' | 'dono'
  /** Onde está a consulta e o que se espera. */
  onde: string
  /** Dia em que foi feita (AAAA-MM-DD). null = por fazer. */
  feitaEm: string | null
}

/** Decisão do controlador (12/10/2026): até 7 dias de atraso só o resumo; com 8 dias ou mais o cron fica vermelho. */
export const DIAS_ATE_O_VERMELHO = 7

const PLANO_E20 = 'docs/superpowers/plans/2026-10-12-a5-e20-guarda-do-bruto-plan.md, "Conferências depois do envio"'

export const CONFERENCIAS: readonly Conferencia[] = [
  { id: 'e20-tamanho-d8', etapa: 'E20', data: '2026-10-21', responsavel: 'agente', onde: `${PLANO_E20}: tamanho das duas tabelas, primeira medida`, feitaEm: null },
  { id: 'e20-tamanho-30d', etapa: 'E20', data: '2026-11-12', responsavel: 'agente', onde: `${PLANO_E20}: tamanho das duas tabelas, 30 dias`, feitaEm: null },
  { id: 'e20-prova-90d', etapa: 'E20', data: '2027-01-09', responsavel: 'agente', onde: `${PLANO_E20}: salvos_pela_e20 > 0 (item 205)`, feitaEm: null },
  { id: 'e20-prova-180d', etapa: 'E20', data: '2027-04-09', responsavel: 'agente', onde: `${PLANO_E20}: salvos_pela_e20 maior que em janeiro`, feitaEm: null },
]

const FMT_SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
/** O dia de São Paulo (AAAA-MM-DD) do instante dado. */
export function hojeSP(agora: Date = new Date()): string {
  return FMT_SP.format(agora)
}

const emDias = (dia: string): number => Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10))) / 86_400_000

/** Dias de calendário entre a data devida e `hoje`. 0 = é hoje; 1 = venceu ontem; negativo = ainda não chegou. */
export function diasDeAtraso(hoje: string, c: Pick<Conferencia, 'data'>): number {
  return Math.round(emDias(hoje) - emDias(c.data))
}

/** Vencida = a data já passou (o próprio dia ainda não conta) e ninguém preencheu `feitaEm`. */
export function conferenciasVencidas(hoje: string, lista: readonly Conferencia[] = CONFERENCIAS): Conferencia[] {
  return lista.filter(c => c.feitaEm === null && c.data < hoje)
}

/** As vencidas há mais de `DIAS_ATE_O_VERMELHO` dias: as que deixam o cron vermelho. */
export function conferenciasEmFalha(hoje: string, lista: readonly Conferencia[] = CONFERENCIAS): Conferencia[] {
  return conferenciasVencidas(hoje, lista).filter(c => diasDeAtraso(hoje, c) > DIAS_ATE_O_VERMELHO)
}
