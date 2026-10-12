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

const PLANO_E12 = 'docs/superpowers/plans/2026-10-12-a5-e12-relatorios-em-lote-plan.md, Tarefa 8 (consultas A a D); anotar o resultado em .superpowers/sdd/a5/e12-ledger.md'
const PLANO_E19 = 'docs/superpowers/plans/2026-10-12-a5-e19-leitura-do-pipeline-plan.md, Tarefas 8 a 10'
const PLANO_E20 = 'docs/superpowers/plans/2026-10-12-a5-e20-guarda-do-bruto-plan.md, "Conferências depois do envio"'

// Em ordem de data. Datas das etapas já em produção: E12 com D0 = 13/10/2026 (primeiro cron depois do deploy de 12/10);
// E19 com `avisoDesde` = 12/10/2026 (lote 1 enviado em 12/10, dia de São Paulo); E20 com o envio antes do cron de 13/10.
// Se o envio da E20 atrasar, deslocar `e20-segundo-cron` e corrigir .superpowers/sdd/a5/conferencias-com-data.md.
export const CONFERENCIAS: readonly Conferencia[] = [
  { id: 'e19-d1', etapa: 'E19', data: '2026-10-13', responsavel: 'agente', onde: `${PLANO_E19}: contagem do dia 0 por chave, painel do CMS e /admin/audit sem as linhas, tamanho de audit_log (base: 204.800 bytes, 140 linhas)`, feitaEm: null },
  { id: 'e20-segundo-cron', etapa: 'E20', data: '2026-10-14', responsavel: 'agente', onde: `${PLANO_E20}: resumo do segundo cron depois do envio (consulta B do runbook da coleta): guarda.blobs_guardados_antes é número, baixados_sem_bruto = 0, conferencias_vencidas = [], ms_total e ms_passos.guarda; conta exata blobs_guardados = antes + baixados + vazios`, feitaEm: null },
  { id: 'e12-d3', etapa: 'E12', data: '2026-10-16', responsavel: 'agente', onde: `${PLANO_E12}: D+3: quais dos 9 tipos novos o YouTube gera (consulta C, zero relatórios de um tipo é "não ok"), maior_lido_por_tipo contra os tetos (um tipo recusado por tamanho só tem conserto enquanto o arquivo existe na origem) e ms_passos.relatorios`, feitaEm: null },
  { id: 'e12-d7', etapa: 'E12', data: '2026-10-20', responsavel: 'agente', onde: `${PLANO_E12}: D+7: a mesma leitura do D+3 (acao_do_dono não notifica ninguém: esta e a do D+3 são a única vigilância de um tipo que nunca gerou); pendentes caindo 70 ou mais por dia; item 97, três execuções seguidas`, feitaEm: null },
  { id: 'e19-veredito', etapa: 'E19', data: '2026-10-20', responsavel: 'agente', onde: `${PLANO_E19}: lista e veredito da janela, 7 dias medidos e um com tarefa da forja concluída; busca no Sentry (action:leitura_registro tipo:gravacao) antes`, feitaEm: null },
  { id: 'e20-tamanho-d8', etapa: 'E20', data: '2026-10-21', responsavel: 'agente', onde: `${PLANO_E20}: tamanho das duas tabelas, primeira medida (também é o D+8 da E12: fila zerada, tamanho por tipo)`, feitaEm: null },
  { id: 'e12-d9', etapa: 'E12', data: '2026-10-22', responsavel: 'agente', onde: `${PLANO_E12}: D+9: tipo que gerou histórico e parou de gerar diário (o cron deve estar vermelho: runbook da coleta, seção 10); consulta C`, feitaEm: null },
  { id: 'e19-15o-dia', etapa: 'E19', data: '2026-10-26', responsavel: 'agente', onde: `${PLANO_E19}: se a recusa não subiu, avisar o dono (o registro já está reduzido) e dizer por que a janela não fechou`, feitaEm: null },
  { id: 'e12-item95-a', etapa: 'E12', data: '2026-11-01', responsavel: 'agente', onde: `${PLANO_E12}: item 95, antes do primeiro vencimento na origem: listado_velho = 0 e vencidos_depois_do_deploy = 0 (nada vence sem baixar)`, feitaEm: null },
  { id: 'e12-item95-b', etapa: 'E12', data: '2026-11-08', responsavel: 'agente', onde: `${PLANO_E12}: item 95, depois do primeiro vencimento da fila atual (08/11 02:34 UTC e 10:40 UTC), a partir das 12:10 UTC: as mesmas duas consultas, esperado 0 e 0`, feitaEm: null },
  { id: 'e19-30o-dia', etapa: 'E19', data: '2026-11-11', responsavel: 'dono', onde: `${PLANO_E19}: se a janela ainda está aberta, escolher entre subir a recusa e congelar o controle (controleFechadoEm)`, feitaEm: null },
  { id: 'e20-tamanho-30d', etapa: 'E20', data: '2026-11-12', responsavel: 'agente', onde: `${PLANO_E20}: tamanho das duas tabelas, 30 dias`, feitaEm: null },
  { id: 'e12-d31', etapa: 'E12', data: '2026-11-13', responsavel: 'agente', onde: `${PLANO_E12}: D+31, depois de a origem apagar o histórico: as consultas do item 95 (0 e 0) e, nas três últimas execuções, ms_baixar ÷ (baixados + vazios) abaixo de 0,90 s (item 97; se passar, baixar MAX_DOWNLOADS)`, feitaEm: null },
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
