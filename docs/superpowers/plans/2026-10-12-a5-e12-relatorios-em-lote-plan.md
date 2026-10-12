# A5 · E12: relatórios em lote ligados e bruto guardado — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Perguntas que só o dono responde

Nenhuma trava o início. As três primeiras são decisões que o plano já tomou e o dono pode vetar; a 4 e a 5 são avisos do que o deploy faz.

1. **São 9 tipos novos, não 10.** O spec (7.4) diz "mais 10" e lista 9 nomes. Em produção (leitura de 12/10) o YouTube oferece 10 tipos de canal em `desativado`; o décimo é `channel_annotations_a1` (anotações, recurso extinto), que o próprio spec manda deixar de fora. O plano liga os 9 (total 13). Confirma anotações fora?
2. **Ordem de download em três faixas** (o spec dizia só "a ordem da lista é a prioridade"): primeiro o que vence em até 7 dias, de qualquer tipo; depois os de alcance (são o que as telas da A4 leem; no máximo 8 por dia); depois todo o resto, pelo vencimento. A posição do tipo na lista vira só desempate. Sem isso, os cerca de 558 relatórios de histórico dos tipos novos atrasariam o alcance do dia em até 9 dias, ou o alcance passaria na frente de algo vencendo.
3. **Teto de tamanho em 10 MB comprimido** (proposta do spec; maior relatório real até hoje: 564 bytes) e **teto de tempo do passo de relatórios de 60 s para 120 s**, com 100 downloads por execução. A folga do relógio do cron no pior caso cai de 66 s para 6 s (conta na seção "Orçamento").
4. **O deploy cria 18 jobs no YouTube, sozinho.** Na primeira execução do cron depois do deploy (12:00 UTC, 09:00 de Brasília), o passo de jobs chama `jobs.create` da Reporting API 9 vezes por canal. É escrita externa, feita pelo cron (nenhum agente chama a API), igual à que o L1a já fez em 08/10 para os 4 tipos atuais. Desfazer é tirar a linha da lista (o job fica parado do lado do Google; apagar o job lá é ação do dono no Google).
5. **Escrita de dado em produção nesta etapa: nenhuma prevista.** Só haverá se aparecer um relatório `grande_demais` (aí o `update` que o recoloca na fila, depois de subir o teto, é do dono; o comando está no runbook, seção 8). A conferência depois do deploy é só leitura.

Ponto para o dono conferir quando puder (não trava): a página de cotas da "YouTube Reporting API" no Google Cloud Console. A cota por chamada não está documentada (inventário, linha 105); a evidência que temos é de produção: 48 chamadas em cerca de 30 s, quatro dias seguidos, sem recusa.

---

**Goal:** Ligar os 9 tipos de relatório em lote do YouTube que estão desligados e guardar o bruto de todos, sem que nenhum relatório vença na origem sem ser baixado e sem que nenhuma perda fique em verde.

**Architecture:** Nenhuma tabela nova. A lista `REPORT_TYPES_ENABLED` ganha 9 linhas e o passo de jobs cria os jobs sozinho. Antes disso, o passo de relatórios ganha uma fila ordenada pelo vencimento (módulo puro novo), tetos maiores com a conta presa por teste, e cada caminho de perda (vencido, grande demais, tipo sem job, job sem relatório) passa a deixar o cron vermelho. A lista só é ligada na última tarefa de código, para os tetos e os alarmes irem no mesmo deploy.

**Tech Stack:** Next.js 16 (rota de cron), TypeScript estrito, Supabase (PostgREST), Vitest com o banco em memória `test/youtube/coleta/fake-supabase.ts`.

**Spec:** `docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md`, seção 7.4 e itens de aceite 94 a 97. Sequência e o que é do dono: `00-indice-decisoes-e-sequencia.md`, seções 13 (risco 15) e 14. Ciclo de vida do bruto: `06-ciclo-de-vida-volume-e-cota.md`, linhas 32 e 84 (a troca da limpeza é da E10, não desta etapa).

## Global Constraints

- **Sem migration.** Conferido: os estados usados (`listado`, `baixado`, `vazio`, `erro`, `expirado_sem_baixar`; `ativo`, `desativado`, `tipo_indisponivel`) já estão nos `check` de `20261007000006_coleta_canais_proprios_l1a.sql`, e o resumo do cron é `jsonb`. Se uma tarefa parecer pedir migration, pare e relate.
- **Não tocar** em `docs/cowork-*`, `apps/web/data/pipeline-docs/` nem `apps/web/src/lib/pipeline/api-registry.ts`. A E12 não cria nem muda rota de pipeline. Se parecer preciso, pare e relate.
- **Zero cron novo** e **zero variável de ambiente nova.** Os tetos são constantes no código.
- Branch `staging`, sem branch nem worktree. **Nunca** `git stash` nem `git reset`. Commit só por caminho explícito (`git commit -m "..." -- <arquivos>`): há outros terminais com arquivos modificados (`apps/web/next-env.d.ts`, `apps/web/tsconfig.json`, mockups). Não os inclua.
- Nada que escreva em produção. Leitura em produção só por `npx supabase db query --linked "<select>"`.
- Nenhum comando nem espera acima de 4 minutos. Suíte de pasta: saída para arquivo e só as falhas no contexto.
- TypeScript `strict`, nunca `any`. Arquivos em kebab-case. Testes com `// @vitest-environment node` na primeira linha.
- Datas nos testes: relativas a um `AGORA` com `vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })`, como os testes vizinhos; nunca uma data solta comparada com o relógio real.
- **Este sistema falha em verde.** Em toda tarefa, antes de "o que acontece no erro?", responda "o que acontece quando o dado não existe?" (coluna nula, leitura vazia, contagem ausente, job sem relatório). Ausência nunca vira zero nem "ok".
- Um implementador por vez. Ao fim de cada tarefa: testes do arquivo verdes, `npm run typecheck -w apps/web` verde.

## Fatos medidos em produção (leitura de 12/10/2026, 4 execuções)

| Fato | Valor |
|---|---|
| Agenda do cron | `0 12 * * *` (uma execução por dia, 12:00 UTC); `maxDuration` 300 s; relógio global 270 s |
| Passo de relatórios hoje | 28,5 a 36,0 s para listar 8 jobs e baixar 40 relatórios, um por vez |
| Custo por download (limite de cima) | 36,0 s ÷ 40 = **0,90 s** (inclui a listagem; o real é menor) |
| Parte antiga da rota | 19,9 a 23,7 s. Execução inteira: 73 a 145 s |
| Tamanho | maior relatório comprimido: **564 bytes**; 160 brutos somam 21.262 bytes; a tabela ocupa 180 kB |
| Fila hoje | 104 `listado`: 38 de `channel_traffic_source_a3` (34 de histórico + 4 do dia) e 66 de `channel_basic_a3` (62 + 4) |
| Histórico por tipo | 62 relatórios por tipo nos 2 canais (31 dias cada) |
| Quando o histórico aparece | jobs criados em 08/10 12:01 UTC; relatórios de histórico criados de 09/10 02:34 a 10/10 08:38 UTC (até 2 dias depois) |
| Mais antigo dos 34 de tráfego na fila | criado em 09/10 10:40 UTC; vence na origem em **08/11 10:40 UTC** |
| Jobs | 2 canais × 4 tipos `ativo`; 2 × 16 `desativado` (9 de canal que a E12 liga, anotações, 6 de playlist). Nenhum relatório em `erro` nem `expirado_sem_baixar` |

## Orçamento (a conta)

**Os 38 que têm data.** O mais antigo vence em 08/11 10:40 UTC; a regra local o marca vencido na execução de 08/11 12:00 UTC. A última execução útil é a de **07/11 12:00 UTC**. De 13/10 a 07/11 há **26 execuções**.
- Com o código novo: os 96 de histórico já na fila (34 de tráfego + 62 de basic) são os que vencem primeiro e cabem no teto de 100. **1 execução.** Sobra de 25.
- Mesmo sem deploy, o código de hoje (40 por dia, alcance e tráfego antes de basic) zera o tráfego em 14/10 (2 execuções) e basic em 17/10. Os 38 não dependem desta etapa para sobreviver; dependem de o cron seguir rodando.

**O risco real nasce ao ligar os tipos.** 9 tipos × 62 = **558 relatórios de histórico**, que vencem 30 dias depois de criados, mais 26 novos por dia (13 tipos × 2 canais). Com o teto de hoje (40 por dia, 26 de entrada, 14 líquidos) levaria 40 dias: perda certa. Por isso o teto sobe **antes** de a lista mudar (ordem das tarefas).

| Item | Conta | Resultado |
|---|---|---|
| Downloads por execução | `MAX_DOWNLOADS` | **100** |
| Tempo dos downloads | 100 × 0,90 s | 90 s |
| Listagem de 26 jobs, 4 em paralelo | reserva (não medida em separado; a Tarefa 2 passa a medir) | 20 s |
| Passo de relatórios | 90 + 20 = 110 s ≤ teto novo de **120 s** | cabe, 10 s de folga |
| Relógio global, pior caso | tetos 30 + 20 + 120 + 20 + 50 = 240 s, mais 30 s de reserva da parte antiga (medida: até 23,7 s) | 270 s ≤ 270 s |
| Relógio global, caso medido | pior execução de hoje 145 s, mais até 74 s a mais no passo | cerca de 220 s |
| Fila no pior caso | 558 + 104 (se nada for baixado antes do deploy) | 662 |
| Vazão líquida | 100 − 26 por dia | 74 por dia |
| Execuções para esvaziar | 662 ÷ 74 | **9** (8 se a fila antiga já tiver zerado) |
| Prazo | jobs criados no dia D; histórico aparece até D+2; fila vazia em D+11; o primeiro vence em D+30 | **19 dias de folga**; o spec pede "menos de 20 dias" para esvaziar: 11 |
| Chamadas à Reporting API por execução | 26 listagens + até 100 downloads + 4 de sondagem no dia da criação | cerca de 130, em série, no mesmo ritmo de hoje (1,6 por segundo) |
| Volume | 26 relatórios por dia, de dezenas a centenas de bytes | da ordem de 10 kB por dia de conteúdo; 558 de histórico, menos de 300 kB |

Se o tempo real por download for pior que 0,90 s, o relógio corta a fila, o resto fica `listado` para o dia seguinte (nada se perde), a tentativa do canal vira `nao_alcancado_orcamento` e, na terceira execução seguida assim, o cron fica vermelho com `orçamento: N escopo(s) de relatorio sem alcançar nas 3 últimas tentativas`. Aí se baixa `MAX_DOWNLOADS` (o teste da Tarefa 5 obriga a refazer a conta).

## O que acontece em cada falha (antes e depois)

| Situação | Hoje | Depois deste plano | Como o dono vê |
|---|---|---|---|
| Download cortado no meio, rede ou 5xx | fica `listado`, tenta amanhã | igual | 3 dias seguidos: `jobs: <canal> não consegue baixar o relatório <tipo> há 3 dias` |
| Download cortado que chega como gzip que não abre | vira `erro: gzip_invalido`, **nunca mais é tentado**, e em tipo que não é de alcance ninguém avisa | fica `listado`, tenta amanhã (Tarefa 2) | a mesma nota de 3 dias, com `último erro: gzip_invalido` |
| Prazo do passo acaba | fica `listado`; `nao_alcancado_orcamento` | igual; `pendentes` e `vence_primeiro_em_dias` no resumo | resumo do cron; 3 execuções: nota de orçamento |
| Gzip acima do teto | `erro: grande_demais`, bruto **não guardado**, verde em tipo que não é de alcance | nota na hora e por 14 dias (Tarefas 2 e 3); aviso antes, ao passar da metade do teto | `relatórios: <tipo> recusado por tamanho (...)`: cron vermelho |
| Relatório vence sem baixar (30 ou 60 dias, ou 404/410) | `expirado_sem_baixar`; nota só se tiver menos de 14 dias, ou seja, **quase nunca** | nota na execução em que vence, com contagem por tipo (Tarefa 2) | `relatórios: N relatório(s) venceram sem baixar nesta execução (...)` |
| Relatório parado na fila | nota aos 14 dias de `listado` | igual (sobram 16 dias de vermelho antes de um de histórico vencer) | `relatórios: N relatório(s) listado(s) há mais de 14 dias sem baixar` |
| Fila acima de 1000 | corte silencioso | nota (Tarefa 2) | `relatórios: fila de download cortada em 1000 ...` |
| Tipo que o YouTube não oferece ao canal | `tipo_indisponivel`; aviso único que diz "relatório de alcance" para qualquer tipo | aviso por tipo, com o nome do tipo (Tarefa 4) | notificação e `acao_do_dono` |
| Tipo habilitado cujo job não foi criado (linha segue `desativado`) | invisível: os critérios ignoram `desativado` | nota (Tarefa 3) | `jobs: <canal> tem N tipo(s) de relatório habilitado(s) sem job: ...` |
| Job criado e o YouTube nunca gera relatório | invisível fora do alcance: zero relatórios é "nada a baixar" | nota aos 6 dias (Tarefa 3) | `relatórios: <canal> está sem relatório novo de <tipo> há mais de 6 dias` |
| Erro ao criar o job | `erro`; nota aos 3 dias | igual | `jobs: <canal> está com o job <tipo> em erro há 3 dias` |

## Review Focus

1. **Job novo ativo e nenhum relatório chega nunca.** Esperado: vermelho aos 6 dias, não "0 pendentes, tudo certo". Teste na Tarefa 3.
2. **Relatório com `is_backfill` nulo ou `create_time` ilegível.** Esperado: tratado como o de prazo mais curto e posto na frente da fila, nunca no fim. Teste na Tarefa 1.
3. **Download cortado que parece um arquivo.** Esperado: nova tentativa no dia seguinte, não um `erro` definitivo e mudo. Teste na Tarefa 2.
4. **Leitura de critério que falha.** Esperado: `critérios: não foi possível avaliar ...`, nunca verde. Testes na Tarefa 3.
5. **Canal que perdeu a autorização no dia em que os tipos são ligados.** Esperado: os 9 tipos ficam `desativado` e isso aparece em `acao_do_dono`, não some. Teste na Tarefa 3.

## Mapa de arquivos

| Arquivo | Papel | Tarefas |
|---|---|---|
| `apps/web/src/lib/youtube/coleta/fila-relatorios.ts` (novo) | módulo puro: validade na origem, vencimento, ordem da fila | 1 |
| `apps/web/test/youtube/coleta/fila-relatorios.test.ts` (novo) | prova da ordem | 1 |
| `apps/web/src/lib/youtube/coleta/reports-step.ts` | usa a fila; perdas viram nota; medidas no resumo; tetos | 1, 2, 5 |
| `apps/web/src/lib/youtube/coleta/criteria.ts` | erro em qualquer tipo; tipo sem job; job sem relatório | 3 |
| `apps/web/src/lib/youtube/coleta/alerts.ts`, `jobs-step.ts` | aviso por tipo; data de descontinuação | 4 |
| `apps/web/src/lib/youtube/coleta/clock.ts` | teto do passo | 5 |
| `apps/web/src/lib/youtube/reporting/types.ts` | `deprecateTime` (4); a lista de tipos (6) | 4, 6 |
| `apps/web/test/youtube/coleta/*.test.ts` | os testes ao lado de cada arquivo | todas |
| `docs/ops/youtube-coleta-canais-proprios-runbook.md` | tetos, ordem, notas novas | 7 |
| `.superpowers/sdd/a5/e12-ledger.md` (novo, na Tarefa 8) | anotações dos itens 94 a 97 | 8 |

Comando de teste, sempre a partir da raiz do repositório (o diretório de trabalho não persiste entre chamadas):

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/coleta/<arquivo>.test.ts
```

---

### Task 1: Fila pelo vencimento

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/fila-relatorios.ts`
- Create: `apps/web/test/youtube/coleta/fila-relatorios.test.ts`
- Modify: `apps/web/src/lib/youtube/coleta/reports-step.ts` (linhas 15-17, 39-47, 315-347)
- Test: `apps/web/test/youtube/coleta/reports-step.test.ts` (substitui o teste "prioridade: alcance básico → combinado → tráfego → channel_basic_a3", linha 218; acrescenta um)

**Interfaces:**
- Consumes: `REACH_TYPES`, `REPORT_TYPES_ENABLED` de `@/lib/youtube/reporting/types`.
- Produces: `DIA_MS: number`; `VALIDADE_DIAS: { historico: 30; corrente: 60 }`; `URGENTE_DIAS: 7`; `interface ItemDaFila { report_type_id: string; create_time: string; is_backfill?: boolean | null }`; `venceEm(p: ItemDaFila): number` (epoch ms); `ordenarFila<T extends ItemDaFila>(fila: readonly T[], agora: number): T[]` (não muta a entrada).

- [ ] **Step 1: Escrever o teste do módulo puro (falha)**

`apps/web/test/youtube/coleta/fila-relatorios.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { DIA_MS, URGENTE_DIAS, VALIDADE_DIAS, ordenarFila, venceEm } from '@/lib/youtube/coleta/fila-relatorios'

// A função é pura: recebe o "agora" por parâmetro e nunca lê o relógio.
const AGORA = Date.UTC(2026, 9, 7, 12, 0, 0)
const ha = (dias: number) => new Date(AGORA - dias * DIA_MS).toISOString()
const item = (id: string, tipo: string, criadoHa: number, historico: boolean | null = false) =>
  ({ id, report_type_id: tipo, create_time: ha(criadoHa), is_backfill: historico })
const ordem = (fila: Array<ReturnType<typeof item>>) => ordenarFila(fila, AGORA).map(p => p.id)

describe('venceEm', () => {
  it('histórico vale 30 dias, corrente 60, contados do create_time', () => {
    expect(VALIDADE_DIAS).toEqual({ historico: 30, corrente: 60 })
    expect(venceEm(item('a', 'channel_basic_a3', 0, true)) - AGORA).toBe(30 * DIA_MS)
    expect(venceEm(item('b', 'channel_basic_a3', 0, false)) - AGORA).toBe(60 * DIA_MS)
  })

  it('sem a marca de histórico (nula ou ausente) vale o prazo curto: dado ausente nunca alonga o prazo', () => {
    expect(venceEm(item('a', 'channel_basic_a3', 0, null)) - AGORA).toBe(30 * DIA_MS)
    expect(venceEm({ report_type_id: 'channel_basic_a3', create_time: ha(0) }) - AGORA).toBe(30 * DIA_MS)
  })
})

describe('ordenarFila', () => {
  it('entre os que não são de alcance, quem vence primeiro vai primeiro, mesmo criado depois e de tipo de menor prioridade', () => {
    // basic de histórico criado há 10 dias vence em 20; tráfego corrente criado há 20 dias vence em 40.
    expect(ordem([item('trafego-corrente', 'channel_traffic_source_a3', 20), item('basic-historico', 'channel_basic_a3', 10, true)]))
      .toEqual(['basic-historico', 'trafego-corrente'])
  })

  it('sem nada urgente, o alcance do dia passa na frente do resto', () => {
    expect(ordem([item('basic-historico', 'channel_basic_a3', 10, true), item('alcance', 'channel_reach_basic_a1', 1)]))
      .toEqual(['alcance', 'basic-historico'])
  })

  it('o que vence em até 7 dias passa na frente de tudo, inclusive do alcance', () => {
    expect(URGENTE_DIAS).toBe(7)
    // histórico criado há 24 dias vence em 6.
    expect(ordem([item('alcance', 'channel_reach_basic_a1', 1), item('quase-vencendo', 'channel_basic_a3', 24, true)]))
      .toEqual(['quase-vencendo', 'alcance'])
  })

  it('a fronteira da urgência: exatamente 7 dias é urgente; 7 dias e 1 ms não é', () => {
    const noLimite = { id: 'no-limite', report_type_id: 'channel_basic_a3', create_time: ha(23), is_backfill: true }
    const logoDepois = { id: 'logo-depois', report_type_id: 'channel_basic_a3', create_time: new Date(AGORA - 23 * DIA_MS + 1).toISOString(), is_backfill: true }
    const alcance = item('alcance', 'channel_reach_basic_a1', 1)
    expect(ordenarFila([alcance, logoDepois, noLimite], AGORA).map(p => p.id)).toEqual(['no-limite', 'alcance', 'logo-depois'])
  })

  it('já vencido pela conta (prazo negativo) é o primeiro de todos', () => {
    expect(ordem([item('alcance', 'channel_reach_basic_a1', 1), item('urgente', 'channel_basic_a3', 25, true), item('passou', 'channel_basic_a3', 31, true)]))
      .toEqual(['passou', 'urgente', 'alcance'])
  })

  it('mesmo vencimento: a posição do tipo na lista desempata; tipo fora da lista fica por último', () => {
    expect(ordem([
      item('fora', 'channel_annotations_a1', 5, true),
      item('basic', 'channel_basic_a3', 5, true),
      item('trafego', 'channel_traffic_source_a3', 5, true),
    ])).toEqual(['trafego', 'basic', 'fora'])
  })

  it('create_time ilegível vai para a frente da fila, nunca para o fim', () => {
    const ruim = { id: 'ruim', report_type_id: 'channel_basic_a3', create_time: 'isto não é data', is_backfill: false }
    expect(ordenarFila([item('alcance', 'channel_reach_basic_a1', 1), ruim], AGORA).map(p => p.id)).toEqual(['ruim', 'alcance'])
  })

  it('não muda a lista recebida e devolve todos os itens', () => {
    const fila = [item('b', 'channel_basic_a3', 1), item('a', 'channel_basic_a3', 2)]
    const copia = [...fila]
    expect(ordenarFila(fila, AGORA)).toHaveLength(2)
    expect(fila).toEqual(copia)
    expect(ordenarFila([], AGORA)).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/coleta/fila-relatorios.test.ts`
Expected: FAIL, "Failed to resolve import ... fila-relatorios".

- [ ] **Step 3: Escrever o módulo**

`apps/web/src/lib/youtube/coleta/fila-relatorios.ts`:

```ts
// Ordem de download dos relatórios em lote (A5, E12). Módulo puro: sem banco e sem rede.
// O arquivo de um relatório some na origem 60 dias depois de gerado, ou 30 se for de histórico (gerado ao criar o
// job). A fila anda pelo que vence primeiro; a posição do tipo em REPORT_TYPES_ENABLED só desempata.
import { REACH_TYPES, REPORT_TYPES_ENABLED } from '@/lib/youtube/reporting/types'

export const DIA_MS = 86_400_000
/** Validade do arquivo na origem, em dias desde `create_time`. É a mesma regra que o passo usa para marcar `expirado_sem_baixar`. */
export const VALIDADE_DIAS = { historico: 30, corrente: 60 } as const
/** Faltando isto ou menos para vencer, o relatório passa na frente de tudo, inclusive do alcance. */
export const URGENTE_DIAS = 7

export interface ItemDaFila {
  report_type_id: string
  create_time: string
  is_backfill?: boolean | null
}

const ALCANCE: readonly string[] = REACH_TYPES
const TIPOS: readonly string[] = REPORT_TYPES_ENABLED

/** Texto ilegível vira 0 (o mais antigo possível): dado ruim vai para a FRENTE da fila, nunca para o fim. */
const criadoEm = (p: ItemDaFila): number => {
  const t = new Date(p.create_time).getTime()
  return Number.isNaN(t) ? 0 : t
}

/** Instante (epoch ms) em que o arquivo some na origem. Sem a marca de histórico vale o prazo curto. */
export function venceEm(p: ItemDaFila): number {
  const dias = p.is_backfill === false ? VALIDADE_DIAS.corrente : VALIDADE_DIAS.historico
  return criadoEm(p) + dias * DIA_MS
}

/**
 * Três faixas: (0) vence em até URGENTE_DIAS, de qualquer tipo; (1) alcance, que é o que as telas leem e nunca passa
 * de poucos por dia; (2) o resto. Dentro da faixa: vencimento crescente, depois a posição do tipo, depois a criação.
 */
export function ordenarFila<T extends ItemDaFila>(fila: readonly T[], agora: number): T[] {
  const prioridade = (tipo: string): number => {
    const i = TIPOS.indexOf(tipo)
    return i === -1 ? TIPOS.length : i
  }
  const faixa = (p: T): number =>
    venceEm(p) - agora <= URGENTE_DIAS * DIA_MS ? 0 : ALCANCE.includes(p.report_type_id) ? 1 : 2
  return [...fila].sort((a, b) =>
    faixa(a) - faixa(b)
    || venceEm(a) - venceEm(b)
    || prioridade(a.report_type_id) - prioridade(b.report_type_id)
    || criadoEm(a) - criadoEm(b))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: o mesmo do Step 2. Expected: PASS, 10 testes.

- [ ] **Step 5: Trocar o teste de ordem do passo (falha)**

Em `apps/web/test/youtube/coleta/reports-step.test.ts`, **substitua** o teste inteiro `it('prioridade: alcance básico → combinado → tráfego → channel_basic_a3; dentro do tipo, create_time crescente', ...)` por estes dois:

```ts
  it('ordem de drenagem: o que vence em até 7 dias, depois o alcance, depois o resto pelo vencimento; o tipo só desempata', async () => {
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [
        listado('trafego-corrente', { report_type_id: 'channel_traffic_source_a3', create_time: ha(20) }),               // vence em 40 dias
        listado('basic-historico', { report_type_id: 'channel_basic_a3', create_time: ha(10), is_backfill: true }),      // vence em 20 dias
        listado('alcance-novo', { create_time: ha(1) }),                                                                  // vence em 59 dias
        listado('basic-quase-vencendo', { report_type_id: 'channel_basic_a3', create_time: ha(24), is_backfill: true }), // vence em 6 dias
      ],
    })
    await passoRelatorios(ctxDe(db))
    expect(api.download.mock.calls.map(c => c[0])).toEqual([
      'https://dl.test/basic-quase-vencendo', 'https://dl.test/alcance-novo', 'https://dl.test/basic-historico', 'https://dl.test/trafego-corrente',
    ])
  })

  it('fila maior que o teto: o que vence primeiro entra, mesmo criado por último e de tipo de menor prioridade; fica para trás o que vence por último', async () => {
    const correntes = Array.from({ length: MAX_DOWNLOADS }, (_, i) =>
      listado(`corrente-${i}`, { report_type_id: 'channel_traffic_source_a3', create_time: new Date(AGORA.getTime() - 5 * DIA_MS + i * 1000).toISOString() }))
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [...correntes, listado('historico', { report_type_id: 'channel_basic_a3', create_time: ha(2), is_backfill: true })],
    })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(api.download.mock.calls[0]![0]).toBe('https://dl.test/historico')
    expect(rel(db, 'historico')!.status).toBe('baixado')
    expect(comStatus(db, 'listado')).toHaveLength(1)
    expect(rel(db, `corrente-${MAX_DOWNLOADS - 1}`)!.status).toBe('listado')
    expect(resumo.pendentes).toBe(1)
  })
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/coleta/reports-step.test.ts -t "drenagem|maior que o teto"`
Expected: FAIL nos dois (a ordem atual é por tipo: `alcance-novo` vem primeiro; `historico` fica de fora).

- [ ] **Step 6: Ligar a fila no passo**

Em `apps/web/src/lib/youtube/coleta/reports-step.ts`:

(a) Acrescente o import, depois da linha de `./clock`:

```ts
import { DIA_MS, VALIDADE_DIAS, ordenarFila } from './fila-relatorios'
```

(b) Apague a linha `const DIA_MS = 86_400_000` (a constante agora vem do módulo).

(c) Em `interface Pendente`, acrescente o campo:

```ts
  is_backfill: boolean
```

(d) No passo "2. Expirar por idade", troque o cabeçalho do laço:

```ts
  for (const [backfill, dias] of [[true, VALIDADE_DIAS.historico], [false, VALIDADE_DIAS.corrente]] as const) {
```

(e) No passo "3. Baixar", troque o comentário do título, acrescente `is_backfill` ao `select` e substitua o bloco que vai de `const prioridade = ...` até o fim do `.sort(...)` por uma chamada:

```ts
  // ── 3. Baixar: pelo vencimento na origem (fila-relatorios.ts), no máximo MAX_DOWNLOADS ──
  const idsDosCanais = canais.map(c => c.id)
  const filaLida = await ctx.supabase
    .from('yt_reporting_reports')
    .select('site_id, report_id, channel_id, report_type_id, job_id, download_url, create_time, is_backfill')
    .eq('status', 'listado')
    .in('channel_id', idsDosCanais)
    .in('report_type_id', [...HABILITADOS]) // os `listado` de um tipo desligado ficam como estão
    .order('create_time', { ascending: true })
    .limit(1000)
  if (conferirBanco(filaLida, 'yt_reporting_reports', ctx.falhas, 'ler') !== 'ok') return fechar()
  const fila = ordenarFila(((filaLida.data ?? []) as Pendente[]).filter(p => clientes.has(p.channel_id)), agora)
```

(`agora` já existe: é o `const agora = Date.now()` do passo 2.) Atualize também as duas primeiras linhas de comentário do arquivo: troque "a fila é por prioridade (alcance primeiro)" por "a fila é pelo vencimento na origem (fila-relatorios.ts)".

- [ ] **Step 7: Rodar o arquivo inteiro do passo**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/coleta/reports-step.test.ts test/youtube/coleta/fila-relatorios.test.ts`
Expected: PASS em tudo. Se algum outro teste do arquivo quebrar por depender da ordem antiga, pare e relate o nome do teste (não é esperado: os demais semeiam um tipo só).

- [ ] **Step 8: Typecheck e commit**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run typecheck -w apps/web`
Expected: sem erros.

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/coleta/fila-relatorios.ts apps/web/test/youtube/coleta/fila-relatorios.test.ts && git commit -m "feat: fila de relatórios em lote pelo vencimento na origem (urgente, alcance, resto)" -- apps/web/src/lib/youtube/coleta/fila-relatorios.ts apps/web/test/youtube/coleta/fila-relatorios.test.ts apps/web/src/lib/youtube/coleta/reports-step.ts apps/web/test/youtube/coleta/reports-step.test.ts
```

---

### Task 2: Perda no passo de relatórios nunca fica em verde

**Files:**
- Modify: `apps/web/src/lib/youtube/coleta/reports-step.ts`
- Modify: `apps/web/test/youtube/coleta/index.test.ts` (o `mockResolvedValue` de `passoRelatorios`, perto da linha 43)
- Test: `apps/web/test/youtube/coleta/reports-step.test.ts`

**Interfaces:**
- Consumes: `DIA_MS`, `venceEm`, `type ItemDaFila` de `./fila-relatorios` (Tarefa 1).
- Produces: `RelatoriosResumo` ganha `maior_bytes: number`, `expirados_por_tipo: Record<string, number>`, `vence_primeiro_em_dias: number | null`, `ms_listar: number`, `ms_baixar: number`. Notas novas em `falhas[]`, com este texto exato:
  - `relatórios: N relatório(s) venceram sem baixar nesta execução (<tipo>: n, <tipo>: n)`
  - `relatórios: <tipo> recusado por tamanho (<bytes> bytes comprimidos; teto <teto>): o bruto NÃO foi guardado`
  - `relatórios: <tipo> chegou a <bytes> bytes comprimidos, mais da metade do teto de <teto>`
  - `relatórios: fila de download cortada em 1000 relatórios; a ordem por vencimento não cobre o que ficou de fora`

- [ ] **Step 1: Escrever os testes (falham)**

Em `apps/web/test/youtube/coleta/reports-step.test.ts`:

(a) **Substitua** o teste `it('bytes que não viram gzip (gzip corrompido): o relatório vira erro com texto curto; o passo segue com o próximo', ...)` por:

```ts
  it('bytes que não abrem como gzip (um download cortado chega assim): continua listado para amanhã, com tentativa erro_http "gzip_invalido"; o passo segue', async () => {
    api.download.mockImplementation(async (url: string) =>
      url.endsWith('/r1') ? empacotarCsv(Buffer.from([0x1f, 0x8b, 1, 2, 3, 4])) : empacotarCsv(CSV))
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('r1', { create_time: ha(3) }), listado('r2', { create_time: ha(2) })],
    })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(rel(db, 'r1')!.status).toBe('listado')
    expect(rel(db, 'r1')!.error ?? null).toBeNull()
    expect(rel(db, 'r2')!.status).toBe('baixado')
    expect(resumo).toMatchObject({ baixados: 1, erros_download: 1, pendentes: 1 })
    expect(db.tables.yt_own_collection_attempts!.find(r => r.scope_type === 'job')).toMatchObject({ outcome: 'erro_http', error: 'gzip_invalido' })
    expect(ctx.falhas).toEqual([])
  })
```

(b) Acrescente um bloco novo no fim do arquivo:

```ts
describe('passoRelatorios: E12, perda nunca fica em verde', () => {
  it('relatório que vence sem baixar (por idade e por 404): a execução ganha uma nota com a contagem por tipo', async () => {
    api.download.mockImplementation(async (url: string) => {
      if (url.endsWith('/sumiu')) throw new ReportingHttpError(404, null)
      return empacotarCsv(CSV)
    })
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [
        listado('velho', { report_type_id: 'channel_traffic_source_a3', create_time: ha(31), is_backfill: true }),
        listado('sumiu', { report_type_id: 'channel_traffic_source_a3', create_time: ha(3) }),
        listado('alcance-velho', { create_time: ha(61) }),
      ],
    })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(resumo.expirados).toBe(3)
    expect(resumo.expirados_por_tipo).toEqual({ channel_traffic_source_a3: 2, channel_reach_basic_a1: 1 })
    expect(ctx.falhas).toEqual(['relatórios: 3 relatório(s) venceram sem baixar nesta execução (channel_traffic_source_a3: 2, channel_reach_basic_a1: 1)'])
  })

  it('vencido de tipo fora da lista habilitada não vira nota (ninguém ia baixá-lo); nada vencido = nenhuma nota', async () => {
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('fora', { report_type_id: 'channel_annotations_a1', create_time: ha(61) }), listado('ok', { create_time: ha(1) })],
    })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(rel(db, 'fora')!.status).toBe('expirado_sem_baixar')
    expect(resumo.expirados_por_tipo).toEqual({})
    expect(ctx.falhas).toEqual([])
  })

  it('acima do teto: erro grande_demais, sem bruto, e a execução diz que o bruto não foi guardado', async () => {
    api.download.mockResolvedValue({ gz: Buffer.alloc(MAX_GZ_BYTES + 1), sha256: 'x', rowCount: 10 })
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(rel(db, 'r1')).toMatchObject({ status: 'erro', error: 'grande_demais' })
    expect(db.tables.yt_reporting_report_blobs ?? []).toEqual([])
    expect(resumo.maior_bytes).toBe(MAX_GZ_BYTES + 1)
    expect(ctx.falhas).toEqual([
      `relatórios: channel_reach_basic_a1 recusado por tamanho (${MAX_GZ_BYTES + 1} bytes comprimidos; teto ${MAX_GZ_BYTES}): o bruto NÃO foi guardado`,
    ])
  })

  it('mais da metade do teto: o bruto é guardado e a execução avisa antes de perder; exatamente a metade não avisa', async () => {
    const metade = MAX_GZ_BYTES / 2
    api.download
      .mockResolvedValueOnce({ gz: Buffer.alloc(metade + 1), sha256: 'x', rowCount: 10 })
      .mockResolvedValueOnce({ gz: Buffer.alloc(metade), sha256: 'y', rowCount: 10 })
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('grande', { create_time: ha(3) }), listado('no-limite', { create_time: ha(2) })],
    })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(rel(db, 'grande')!.status).toBe('baixado')
    expect(rel(db, 'no-limite')!.status).toBe('baixado')
    expect(db.tables.yt_reporting_report_blobs).toHaveLength(2)
    expect(resumo.maior_bytes).toBe(metade + 1)
    expect(ctx.falhas).toEqual([`relatórios: channel_reach_basic_a1 chegou a ${metade + 1} bytes comprimidos, mais da metade do teto de ${MAX_GZ_BYTES}`])
  })

  it('nenhum download: maior_bytes é 0 e nada ficou para trás (vence_primeiro_em_dias nulo)', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(resumo).toMatchObject({ maior_bytes: 0, pendentes: 0, vence_primeiro_em_dias: null, expirados_por_tipo: {} })
  })

  it('o que ficou para trás aparece com prazo: pendentes e os dias até o primeiro vencer', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(500, null))
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [
        listado('corrente', { create_time: ha(1) }),                                                              // vence em 59 dias
        listado('historico', { report_type_id: 'channel_basic_a3', create_time: ha(10), is_backfill: true }),      // vence em 20 dias
      ],
    })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(resumo).toMatchObject({ pendentes: 2, vence_primeiro_em_dias: 20 })
  })

  it('fila que bate em 1000 linhas: nota de corte, nunca "tudo lido"', async () => {
    const mil = Array.from({ length: 1000 }, (_, i) => listado(`r-${i}`, { create_time: new Date(AGORA.getTime() - DIA_MS - i * 1000).toISOString() }))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: mil })
    const ctx = ctxDe(db)
    await passoRelatorios(ctx)
    expect(ctx.falhas).toContain('relatórios: fila de download cortada em 1000 relatórios; a ordem por vencimento não cobre o que ficou de fora')
  })

  it('mede a listagem e os downloads em separado (item de aceite 97)', async () => {
    api.reportsList.mockImplementation(async () => {
      vi.setSystemTime(new Date(Date.now() + 700))
      return { reports: [], nextPageToken: null }
    })
    api.download.mockImplementation(async () => {
      vi.setSystemTime(new Date(Date.now() + 1500))
      return empacotarCsv(CSV)
    })
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('r1', { create_time: ha(3) }), listado('r2', { create_time: ha(2) })],
    })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(resumo.ms_listar).toBe(700)
    expect(resumo.ms_baixar).toBe(3000)
  })
})
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/coleta/reports-step.test.ts -t "E12|não abrem como gzip"`
Expected: FAIL em todos (campos inexistentes, notas ausentes, `r1` em `erro`).

- [ ] **Step 2: Implementar no passo**

Em `apps/web/src/lib/youtube/coleta/reports-step.ts`:

(a) Troque o import da Tarefa 1 por:

```ts
import { DIA_MS, VALIDADE_DIAS, ordenarFila, venceEm, type ItemDaFila } from './fila-relatorios'
```

(b) Abaixo de `const MAX_PAGINAS = 50`:

```ts
/** O PostgREST corta em 1000 linhas: bater nisso é leitura cortada, nunca "tudo lido". */
const LIMITE_FILA = 1000
```

(c) Em `RelatoriosResumo`, acrescente:

```ts
  /** Maior relatório comprimido visto nesta execução, em bytes (inclui o recusado por tamanho). 0 = nenhum download. */
  maior_bytes: number
  /** Dos `expirados`, quantos por tipo HABILITADO: é o que vira nota em falhas[]. */
  expirados_por_tipo: Record<string, number>
  /** Dias inteiros até vencer o primeiro relatório que ficou `listado`. null = nada ficou para trás (ou a leitura falhou: aí há nota em falhas[]). */
  vence_primeiro_em_dias: number | null
  ms_listar: number
  ms_baixar: number
```

(d) Acima de `baixarUm`:

```ts
/** Relatório que venceu sem ser baixado: só o de tipo habilitado conta (o de tipo desligado ninguém ia baixar). */
function contarVencido(resumo: RelatoriosResumo, tipo: string): void {
  if (!HABILITADOS.includes(tipo)) return
  resumo.expirados_por_tipo[tipo] = (resumo.expirados_por_tipo[tipo] ?? 0) + 1
}
```

(e) Em `baixarUm`, **apague** o bloco `if (ehGzipInvalido(erro)) { ... return }` inteiro. No bloco do 404/410, depois de `resumo.expirados++`, acrescente `contarVencido(resumo, p.report_type_id)`. E troque o trecho "Erro passageiro" por:

```ts
      // Erro passageiro: continua `listado` e tenta amanhã. Gzip que não abre entra aqui: um download cortado no meio
      // chega assim, e marcá-lo `erro` seria desistir de um relatório que ainda existe na origem.
      resumo.erros_download++
      await registrarTentativa(ctx, {
        site_id: p.site_id, scope_type: 'job', scope_id: scopeJob(p.channel_id, p.report_type_id), kind: 'relatorio',
        outcome: 'erro_http', http_status: statusHttp(erro), error: ehGzipInvalido(erro) ? 'gzip_invalido' : descreverErro(erro), channel_id: p.channel_id,
      })
      return
```

(f) Ainda em `baixarUm`, substitua o bloco `if (pacote.gz.length > MAX_GZ_BYTES) { ... }` por:

```ts
    resumo.maior_bytes = Math.max(resumo.maior_bytes, pacote.gz.length)
    if (pacote.gz.length > MAX_GZ_BYTES) {
      resumo.erros_download++
      // Sem conserto automático: o bruto não é guardado. Fica vermelho na hora (aqui) e por 14 dias (critérios).
      pushUnico(ctx.falhas, `relatórios: ${p.report_type_id} recusado por tamanho (${pacote.gz.length} bytes comprimidos; teto ${MAX_GZ_BYTES}): o bruto NÃO foi guardado`)
      conferirBanco(
        await marcar({ status: 'erro', error: 'grande_demais', bytes: pacote.gz.length, sha256: pacote.sha256, row_count: pacote.rowCount }),
        'yt_reporting_reports', ctx.falhas,
      )
      return
    }
```

e, logo depois de `resumo.gravados++`:

```ts
    if (pacote.gz.length > MAX_GZ_BYTES / 2) {
      pushUnico(ctx.falhas, `relatórios: ${p.report_type_id} chegou a ${pacote.gz.length} bytes comprimidos, mais da metade do teto de ${MAX_GZ_BYTES}`)
    }
```

(g) Em `passoRelatorios`, o resumo inicial e o `fechar`:

```ts
  const resumo: RelatoriosResumo = {
    gravados: 0, tentativas: {}, pendentes: 0, vistos: 0, baixados: 0, vazios: 0, expirados: 0, erros_download: 0, bruto_apagado: 0,
    maior_bytes: 0, expirados_por_tipo: {}, vence_primeiro_em_dias: null, ms_listar: 0, ms_baixar: 0,
  }
  const fechar = (): RelatoriosResumo => {
    // Em toda saída do passo: o que venceu sem baixar nesta execução vira nota, com a contagem por tipo.
    const vencidos = Object.entries(resumo.expirados_por_tipo)
    if (vencidos.length > 0) {
      const total = vencidos.reduce((s, [, n]) => s + n, 0)
      pushUnico(ctx.falhas, `relatórios: ${total} relatório(s) venceram sem baixar nesta execução (${vencidos.map(([t, n]) => `${t}: ${n}`).join(', ')})`)
    }
    resumo.tentativas = contarPorResultado(ctx.tentativas, ['relatorio'])
    return resumo
  }
```

(h) Medidas: imediatamente antes do comentário `// ── 1. Listar`, `const t0 = Date.now()`; imediatamente antes do comentário `// ── 2. Expirar`, `resumo.ms_listar = Date.now() - t0`. Imediatamente antes de `const alvo = fila.slice(0, MAX_DOWNLOADS)`, `const t1 = Date.now()`; imediatamente antes do comentário `// ── 4. Limpar o bruto`, `resumo.ms_baixar = Date.now() - t1`.

(i) No passo 2, o `select` do `update` passa a `.select('report_id, report_type_id')`, e a linha do `escrita === 'ok'` vira:

```ts
    if (escrita === 'ok') {
      const linhas = (r.data ?? []) as Array<{ report_type_id: string }>
      resumo.expirados += linhas.length
      for (const l of linhas) contarVencido(resumo, l.report_type_id)
    }
```

(j) No passo 3, troque `.limit(1000)` por `.limit(LIMITE_FILA)` e, logo depois do `if (conferirBanco(filaLida, ...) !== 'ok') return fechar()`:

```ts
  if (((filaLida.data ?? []) as unknown[]).length >= LIMITE_FILA) {
    pushUnico(ctx.falhas, `relatórios: fila de download cortada em ${LIMITE_FILA} relatórios; a ordem por vencimento não cobre o que ficou de fora`)
  }
```

(k) Substitua o passo 5 inteiro por:

```ts
  // ── 5. O que ficou para depois, e quando vence o primeiro ────────────────
  const resta = await ctx.supabase
    .from('yt_reporting_reports')
    .select('report_type_id, create_time, is_backfill', { count: 'exact' })
    .eq('status', 'listado')
    .in('channel_id', idsDosCanais)
    .in('report_type_id', [...HABILITADOS]) // o que nunca será baixado não é pendência
    .order('create_time', { ascending: true })
    .limit(LIMITE_FILA)
  if (conferirBanco(resta, 'yt_reporting_reports', ctx.falhas, 'ler') === 'ok') {
    const linhas = (resta.data ?? []) as ItemDaFila[]
    // Contagem ausente não é zero: vale o número de linhas lidas.
    resumo.pendentes += resta.count ?? linhas.length
    if (linhas.length > 0) {
      resumo.vence_primeiro_em_dias = Math.floor((Math.min(...linhas.map(venceEm)) - Date.now()) / DIA_MS)
    }
  }
```

- [ ] **Step 3: Ajustar o mock do teste de `index`**

Em `apps/web/test/youtube/coleta/index.test.ts`, no `beforeEach`, a linha do `passoRelatorios` passa a:

```ts
  vi.mocked(passoRelatorios).mockResolvedValue({
    ...resumoVazio, vistos: 0, baixados: 3, vazios: 0, expirados: 0, erros_download: 0, bruto_apagado: 0,
    maior_bytes: 0, expirados_por_tipo: {}, vence_primeiro_em_dias: null, ms_listar: 0, ms_baixar: 0,
  })
```

Faça o mesmo em qualquer outro `mockResolvedValue` de `passoRelatorios` que o typecheck apontar.

- [ ] **Step 4: Rodar a pasta e o typecheck**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/coleta > /tmp/e12-t2.txt 2>&1; tail -n 30 /tmp/e12-t2.txt`
Expected: tudo PASS. Quebra esperada e já tratada: o teste do gzip (Step 1a). Adaptação permitida em teste existente, e só esta: um teste que provoca vencimento (404, 410 ou idade) em tipo habilitado e afirma `falhas` vazio passa a esperar a nota `venceram sem baixar nesta execução`. Qualquer outra quebra: pare e relate o nome do teste e a diferença.

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run typecheck -w apps/web`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git commit -m "fix: relatório em lote vencido, grande demais ou cortado nunca fica em verde; passo mede listagem e download" -- apps/web/src/lib/youtube/coleta/reports-step.ts apps/web/test/youtube/coleta/reports-step.test.ts apps/web/test/youtube/coleta/index.test.ts
```

---

### Task 3: Critérios para os tipos que só guardam bruto

**Files:**
- Modify: `apps/web/src/lib/youtube/coleta/criteria.ts` (função `criteriosRelatorios`, linhas 62-69 e 138-211)
- Test: `apps/web/test/youtube/coleta/criteria.test.ts`

**Interfaces:**
- Consumes: nada das tarefas anteriores.
- Produces: `criteriosRelatorios` mantém a assinatura e o tipo de retorno. Notas novas, texto exato:
  - `relatórios: <canal> tem relatório <tipo> em erro (<error ou "sem texto">)` (tipo habilitado que não é de alcance, até 14 dias)
  - `jobs: <canal> tem N tipo(s) de relatório habilitado(s) sem job: <tipos em ordem alfabética, separados por ", ">` (em `falhas`)
  - `<canal> tem N tipo(s) de relatório habilitado(s) sem job: <tipos> (o canal precisa ser reconectado)` (em `acao_do_dono`, quando o canal está em `reautorizar`)
  - `relatórios: <canal> está sem relatório novo de <tipo> há mais de 6 dias` (o texto que já existe para alcance, agora também para os outros tipos, pela marca `last_create_time` do job)
  - `perdidos` passa a contar `erro` de qualquer tipo habilitado.

- [ ] **Step 1: Escrever os testes (falham)**

Em `apps/web/test/youtube/coleta/criteria.test.ts`:

(a) **Substitua** `it('relatório de alcance em erro é falha; de outro tipo, não', ...)` por:

```ts
  it('relatório em erro é falha em qualquer tipo habilitado: o de alcance com o texto de sempre, o que só guarda bruto com o motivo', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [
        rel('a', 'erro', 1),
        { ...rel('b', 'erro', 1, 'channel_basic_a3'), error: 'grande_demais' },
        rel('c', 'erro', 1, 'channel_traffic_source_a3'),
      ],
    })
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([
      'relatórios: Canal Um tem relatório de alcance channel_reach_basic_a1 em erro',
      'relatórios: Canal Um tem relatório channel_basic_a3 em erro (grande_demais)',
      'relatórios: Canal Um tem relatório channel_traffic_source_a3 em erro (sem texto)',
    ])
  })

  it('erro de tipo fora da lista habilitada não é falha', async () => {
    const ctx = ctxDe(fakeSupabase({ yt_reporting_reports: [rel('a', 'erro', 1, 'channel_annotations_a1')] }))
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([])
  })
```

(b) **Substitua** `it('perdidos só conta alcance em erro e qualquer expirado; erro de outro tipo velho não conta', ...)` por:

```ts
  it('perdidos conta erro velho de qualquer tipo habilitado e qualquer expirado; erro velho de tipo fora da lista não conta', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [
        rel('a', 'erro', 20), rel('b', 'expirado_sem_baixar', 20, 'channel_basic_a3'), rel('c', 'erro', 20, 'channel_basic_a3'),
        rel('d', 'erro', 20, 'channel_annotations_a1'),
      ],
    })
    const ctx = ctxDe(db)
    expect((await criteriosRelatorios(ctx)).perdidos).toBe(3)
    expect(ctx.falhas).toEqual([])
  })
```

(c) No teste `it('sem_acesso, api_nao_ativada e tipo_indisponivel vão para acao_do_dono e nunca para falhas', ...)`, troque a linha semeada `{ ..., report_type_id: 'channel_traffic_source_a3', status: 'desativado' }` por `{ channel_id: 'ch-1', report_type_id: 'channel_annotations_a1', status: 'desativado' }` (o teste é sobre os estados do dono; o caso do `desativado` de tipo habilitado tem teste próprio abaixo).

(d) **Substitua** `it('jobs desativados não entram na leitura da lista', ...)` por este bloco:

```ts
  it('tipo habilitado com a linha em desativado: o job não foi criado e isso é falha, com os tipos em ordem', async () => {
    const ctx = ctxDe(fakeSupabase({
      yt_reporting_jobs: [
        { channel_id: 'ch-1', report_type_id: 'channel_traffic_source_a3', status: 'desativado' },
        { channel_id: 'ch-1', report_type_id: 'channel_basic_a3', status: 'desativado' },
        { channel_id: 'ch-1', report_type_id: 'channel_annotations_a1', status: 'desativado' }, // fora da lista: é o estado certo
      ],
    }))
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual(['jobs: Canal Um tem 2 tipo(s) de relatório habilitado(s) sem job: channel_basic_a3, channel_traffic_source_a3'])
  })

  it('tipo habilitado em desativado num canal que perdeu a autorização: ação do dono, não falha', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [{ channel_id: 'ch-1', report_type_id: 'channel_basic_a3', status: 'desativado' }] })
    const ctx = { supabase: db.client, falhas: [] as string[], channels: [{ ...canal, collection_status: 'reautorizar' as const }] }
    const r = await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([])
    expect(r.acao_do_dono).toEqual(['Canal Um tem 1 tipo(s) de relatório habilitado(s) sem job: channel_basic_a3 (o canal precisa ser reconectado)'])
  })

  it('tipo habilitado em desativado num canal com a sincronização desligada: nada (o canal não pede job)', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [{ channel_id: 'ch-1', report_type_id: 'channel_basic_a3', status: 'desativado' }] })
    const ctx = { supabase: db.client, falhas: [] as string[], channels: [{ ...canal, sync_enabled: false }] }
    const r = await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([])
    expect(r.acao_do_dono).toEqual([])
  })

  it('job ativo de tipo que só guarda bruto, há mais de 6 dias, sem relatório novo (marca nula ou velha): falha; com marca recente, não', async () => {
    const job = (tipo: string, marca: string | null): Row => ({
      channel_id: 'ch-1', report_type_id: tipo, status: 'ativo', job_id: `j-${tipo}`, job_create_time: ha(10), created_at: ha(10), last_create_time: marca,
    })
    const ctx = ctxDe(fakeSupabase({
      yt_reporting_jobs: [job('channel_basic_a3', null), job('channel_traffic_source_a3', ha(7)), { ...job('channel_annotations_a1', null) }],
    }))
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([
      'relatórios: Canal Um está sem relatório novo de channel_basic_a3 há mais de 6 dias',
      'relatórios: Canal Um está sem relatório novo de channel_traffic_source_a3 há mais de 6 dias',
    ])

    const bom = ctxDe(fakeSupabase({ yt_reporting_jobs: [job('channel_basic_a3', ha(1))] }))
    await criteriosRelatorios(bom)
    expect(bom.falhas).toEqual([])
  })

  it('job ativo de tipo que só guarda bruto criado há menos de 6 dias e ainda sem relatório: cedo demais, não é falha', async () => {
    const ctx = ctxDe(fakeSupabase({
      yt_reporting_jobs: [{ channel_id: 'ch-1', report_type_id: 'channel_basic_a3', status: 'ativo', job_id: 'j', job_create_time: ha(3), created_at: ha(3), last_create_time: null }],
    }))
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('a leitura dos jobs falha: nenhum dos critérios de job avalia como "nada de errado"', async () => {
    const db = fakeSupabase({})
    db.errors.yt_reporting_jobs = { code: 'XX000', message: 'boom' }
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toContain('critérios: não foi possível avaliar tipos habilitados sem job (yt_reporting_jobs)')
    expect(ctx.falhas).toContain('critérios: não foi possível avaliar jobs de alcance sem relatório novo (yt_reporting_jobs)')
  })
```

Se o arquivo não importar `Row`, ele já importa (`import { fakeSupabase, type FakeDb, type FakeErr, type Row } from './fake-supabase'`).

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/coleta/criteria.test.ts > /tmp/e12-t3.txt 2>&1; tail -n 40 /tmp/e12-t3.txt`
Expected: FAIL nos testes novos e trocados.

- [ ] **Step 2: Implementar em `criteria.ts`**

(a) Em `interface JobLinha`, acrescente:

```ts
  /** O maior `createTime` que a listagem já viu neste job. Nulo = nunca listou relatório nenhum. */
  last_create_time: string | null
```

(b) Em `criteriosRelatorios`, logo **depois** do bloco "Expirado sem baixar" (o `if (leituraOk(exp, ...)) { ... }`), acrescente:

```ts
  // Em erro, de tipo habilitado que NÃO é de alcance (o de alcance está na leitura lá de cima), nos últimos 14 dias.
  // Esses tipos só guardam o bruto: `erro` aqui é bruto que não foi guardado (grande_demais, url_inesperada).
  const outros = HABILITADOS.filter(t => !ALCANCE.includes(t))
  if (outros.length > 0) {
    const err = await ctx.supabase
      .from('yt_reporting_reports')
      .select('report_id, channel_id, report_type_id, status, create_time, error')
      .eq('status', 'erro')
      .in('report_type_id', outros)
      .gte('create_time', corte14)
      .limit(LIMITE_LEITURA)
    if (leituraOk(err, 'yt_reporting_reports', 'relatórios em erro', ctx.falhas)) {
      const lidos = (err.data ?? []) as Array<Recente & { error: string | null }>
      if (lidos.length >= LIMITE_LEITURA) {
        naoAvaliou(ctx.falhas, `relatórios em erro (yt_reporting_reports): leitura cortada em ${LIMITE_LEITURA}`)
      }
      for (const r of lidos) {
        pushUnico(ctx.falhas, `relatórios: ${nome(r.channel_id)} tem relatório ${r.report_type_id} em erro (${r.error ?? 'sem texto'})`)
      }
    }
  }
```

(c) Na leitura `perdErro`, troque `.in('report_type_id', [...ALCANCE])` por `.in('report_type_id', [...HABILITADOS])` e o comentário acima dela por:

```ts
  // Perdidos: sem conserto. Manter o vermelho para sempre esconderia as falhas novas.
  // Erro conta em qualquer tipo habilitado (depois da E12 todos guardam bruto); expirado conta em qualquer tipo.
```

(d) Imediatamente **antes** do comentário `// Jobs: uma leitura só (...)`, acrescente:

```ts
  // Tipo HABILITADO cuja linha está em `desativado`: o passo de jobs não passou por este canal (sem token, sem tempo
  // ou exceção) e o job não foi criado. Sem job não há relatório, e cada dia sem job é um dia de histórico que não volta.
  const semJob = await ctx.supabase
    .from('yt_reporting_jobs')
    .select('channel_id, report_type_id')
    .eq('status', 'desativado')
    .in('report_type_id', [...HABILITADOS])
    .limit(LIMITE_LEITURA)
  if (leituraOk(semJob, 'yt_reporting_jobs', 'tipos habilitados sem job', ctx.falhas)) {
    const linhas = (semJob.data ?? []) as Array<{ channel_id: string; report_type_id: string }>
    if (linhas.length >= LIMITE_LEITURA) {
      naoAvaliou(ctx.falhas, `tipos habilitados sem job (yt_reporting_jobs): leitura cortada em ${LIMITE_LEITURA}`)
    }
    const porCanal = new Map<string, string[]>()
    for (const l of linhas) {
      const canal = ctx.channels.find(c => c.id === l.channel_id)
      if (!canal || !canal.sync_enabled) continue // canal desligado não pede job
      porCanal.set(l.channel_id, [...(porCanal.get(l.channel_id) ?? []), l.report_type_id])
    }
    for (const [id, tipos] of porCanal) {
      const canal = ctx.channels.find(c => c.id === id)!
      const texto = `${canal.name} tem ${tipos.length} tipo(s) de relatório habilitado(s) sem job: ${[...tipos].sort().join(', ')}`
      // Canal que perdeu a autorização: só o dono resolve (reconectar); já sai como "<canal>: reautorizar".
      if (canal.collection_status === 'reautorizar') out.acao_do_dono!.push(`${texto} (o canal precisa ser reconectado)`)
      else pushUnico(ctx.falhas, `jobs: ${texto}`)
    }
  }
```

(e) Na leitura dos jobs logo abaixo, acrescente `last_create_time` ao `select`:

```ts
    .select('channel_id, report_type_id, status, job_create_time, created_at, last_create_time')
```

(f) Logo **depois** do laço `for (const j of linhasJob) { if (ESTADOS_DO_DONO.includes(j.status)) ... }`, acrescente:

```ts
  // Tipos que só guardam bruto: job ativo há mais de 6 dias cuja listagem não vê relatório novo há mais de 6 dias.
  // Usa a marca do próprio job (`last_create_time`), sem ler relatórios: o YouTube gera relatório todo dia, mesmo só
  // com cabeçalho, então job ativo sem relatório é job parado, não "nada a baixar". Marca nula = nunca chegou nenhum.
  for (const j of linhasJob) {
    if (j.status !== 'ativo' || ALCANCE.includes(j.report_type_id) || !HABILITADOS.includes(j.report_type_id)) continue
    const canal = ctx.channels.find(c => c.id === j.channel_id)
    if (!canal || !canal.sync_enabled || canal.collection_status === 'reautorizar') continue
    const idade = j.job_create_time ?? j.created_at
    if (!idade || Date.parse(idade) >= corte6) continue
    if (j.last_create_time && Date.parse(j.last_create_time) >= corte6) continue
    pushUnico(ctx.falhas, `relatórios: ${nome(j.channel_id)} está sem relatório novo de ${j.report_type_id} há mais de 6 dias`)
  }
```

- [ ] **Step 3: Rodar o arquivo**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/coleta/criteria.test.ts > /tmp/e12-t3.txt 2>&1; tail -n 40 /tmp/e12-t3.txt`
Expected: PASS. Adaptação permitida em teste **existente**, e só esta: se um teste semear um job `ativo` de `channel_basic_a3` ou `channel_traffic_source_a3` com mais de 6 dias e sem `last_create_time` para provar outra coisa, acrescente `last_create_time: ha(1)` à semente dele. Qualquer outra quebra: pare e relate.

- [ ] **Step 4: Pasta, typecheck e commit**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/coleta > /tmp/e12-t3b.txt 2>&1; tail -n 20 /tmp/e12-t3b.txt`
Expected: PASS. (`tres-dias.test.ts` roda os passos e os critérios juntos; se ele acusar "sem relatório novo" de `channel_basic_a3` ou de tráfego, é sinal de que o simulador dele não lista esses tipos: pare e relate, não mexa no critério.)

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run typecheck -w apps/web`

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git commit -m "fix: critérios dos relatórios em lote cobrem os tipos que só guardam bruto (erro, tipo sem job, job sem relatório)" -- apps/web/src/lib/youtube/coleta/criteria.ts apps/web/test/youtube/coleta/criteria.test.ts
```

---

### Task 4: Aviso de tipo indisponível com o nome do tipo, e data de descontinuação à vista

**Files:**
- Modify: `apps/web/src/lib/youtube/coleta/alerts.ts` (`TITULO`, `chaveAviso`, `textoAviso`, `entregar`, `avisarEntrada`)
- Modify: `apps/web/src/lib/youtube/coleta/jobs-step.ts` (linhas 65-70 e 103)
- Modify: `apps/web/src/lib/youtube/reporting/types.ts` (`interface ReportType`)
- Test: `apps/web/test/youtube/coleta/alerts.test.ts`, `apps/web/test/youtube/coleta/jobs-step.test.ts`

**Interfaces:**
- Produces: `chaveAviso(channelUuid: string, motivo: MotivoAviso, tipo?: string): string`; `textoAviso(motivo: MotivoAviso | 'saida', nome: string, tipo?: string): string`; `avisarEntrada(ctx, ch, motivo: MotivoAviso, tipo?: string): Promise<void>`; `ReportType.deprecateTime?: string`. Nota nova em `resumo.jobs.acao_do_dono`: `<canal>: <tipo> tem data de descontinuação no YouTube (<deprecateTime>)`.

- [ ] **Step 1: Testes dos avisos (falham)**

Em `apps/web/test/youtube/coleta/alerts.test.ts`:

(a) No teste `'são exatamente os do spec'`, troque a linha do `tipo_indisponivel` por:

```ts
    expect(textoAviso('tipo_indisponivel', 'Canal Um', 'channel_cards_a1')).toBe('O YouTube não oferece o relatório channel_cards_a1 para o canal Canal Um.')
    expect(textoAviso('tipo_indisponivel', 'Canal Um')).toBe('O YouTube não oferece o relatório (tipo não informado) para o canal Canal Um.')
    expect(chaveAviso('ch-1', 'tipo_indisponivel', 'channel_cards_a1')).toBe('sync-analytics:ch-1:tipo_indisponivel:channel_cards_a1')
```

(b) **Substitua** `it('tipo_indisponivel avisa uma vez só: janela de 3650 dias', ...)` por:

```ts
  it('tipo_indisponivel avisa uma vez por tipo (janela de 3650 dias), com o nome do tipo no texto', async () => {
    vi.mocked(claimAlert).mockResolvedValue(true)
    vi.mocked(getSiteOwners).mockResolvedValue(['dono-1'] as never)
    vi.mocked(fanOutToSiteAdmins).mockResolvedValue(1 as never)
    const ctx = novoCtx()
    await avisarEntrada(ctx, canal, 'tipo_indisponivel', 'channel_cards_a1')
    await avisarEntrada(ctx, canal, 'tipo_indisponivel', 'channel_subtitles_a3')
    expect(claimAlert).toHaveBeenNthCalledWith(1, ctx.supabase, 'sync-analytics:ch-1:tipo_indisponivel:channel_cards_a1', '3650 days')
    expect(claimAlert).toHaveBeenNthCalledWith(2, ctx.supabase, 'sync-analytics:ch-1:tipo_indisponivel:channel_subtitles_a3', '3650 days')
    expect(fanOutToSiteAdmins).toHaveBeenCalledTimes(2)
    const enviados = vi.mocked(fanOutToSiteAdmins).mock.calls.map(c => c[0] as { message: string; dedupKey: string })
    expect(enviados[0]!.message).toBe('O YouTube não oferece o relatório channel_cards_a1 para o canal Canal Um.')
    expect(enviados[1]!.message).toBe('O YouTube não oferece o relatório channel_subtitles_a3 para o canal Canal Um.')
    expect(enviados[0]!.dedupKey).not.toBe(enviados[1]!.dedupKey)
    expect(ctx.falhas).toEqual([])
  })
```

(Se os outros testes do arquivo montam o retorno de `getSiteOwners`/`fanOutToSiteAdmins` de outra forma, use a mesma forma deles; o que importa são as seis asserções.)

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/coleta/alerts.test.ts`
Expected: FAIL (texto ainda diz "relatório de alcance"; a chave não leva o tipo).

- [ ] **Step 2: Implementar em `alerts.ts`**

```ts
const TITULO: Record<MotivoAviso | 'saida', string> = {
  api_nao_ativada: 'YouTube Reporting API não ativada',
  sem_acesso: 'YouTube recusou o acesso aos relatórios',
  tipo_indisponivel: 'Relatório do YouTube indisponível',
  reautorizar: 'Canal do YouTube perdeu a autorização',
  saida: 'Coleta do YouTube voltou ao normal',
}

/** `tipo` só é usado em `tipo_indisponivel`: um carimbo por tipo de relatório, para cada tipo avisar uma vez. */
export function chaveAviso(channelUuid: string, motivo: MotivoAviso, tipo?: string): string {
  return tipo ? `sync-analytics:${channelUuid}:${motivo}:${tipo}` : `sync-analytics:${channelUuid}:${motivo}`
}
```

Em `textoAviso`, a assinatura vira `(motivo: MotivoAviso | 'saida', nome: string, tipo?: string)` e o caso:

```ts
    case 'tipo_indisponivel':
      return `O YouTube não oferece o relatório ${tipo ?? '(tipo não informado)'} para o canal ${nome}.`
```

Em `entregar`, a assinatura vira `(ctx: Ctx, ch: ColetaChannel, motivo: MotivoAviso | 'saida', tipo?: string)`, e dentro dela:

```ts
  const nota = `aviso ${motivo}${tipo ? ` ${tipo}` : ''} (${ch.name})`
```

```ts
      message: textoAviso(motivo, ch.name, tipo),
      dedupKey: `coleta-${motivo}${tipo ? `-${tipo}` : ''}-${ch.id}-${new Date().toISOString().slice(0, 10)}`,
```

Em `avisarEntrada`:

```ts
export async function avisarEntrada(ctx: Ctx, ch: ColetaChannel, motivo: MotivoAviso, tipo?: string): Promise<void> {
  const chave = chaveAviso(ch.id, motivo, tipo)
```

e a penúltima linha vira `const entregue = await entregar(ctx, ch, motivo, tipo)`. Atualize o comentário de `JANELA` para "`tipo_indisponivel` avisa uma vez por tipo".

Run: o mesmo do Step 1. Expected: PASS.

- [ ] **Step 3: Testes do passo de jobs (falham)**

Em `apps/web/test/youtube/coleta/jobs-step.test.ts`:

(a) Nas duas asserções `expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), canal, 'tipo_indisponivel')` (testes "tipo habilitado ausente da lista..." e "lista vazia de tipos da API..."), acrescente o quarto argumento: `'channel_reach_basic_a1'`.

(b) Acrescente ao `describe('passoJobs: tipos', ...)`:

```ts
  it('cada tipo indisponível avisa com o seu nome', async () => {
    api.reportTypesList.mockResolvedValue(REPORT_TYPES_ENABLED.filter(t => t !== 'channel_basic_a3' && t !== 'channel_traffic_source_a3').map(id => ({ id })))
    const db = fakeSupabase()
    const resumo = await passoJobs(ctxDe(db))
    expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), canal, 'tipo_indisponivel', 'channel_basic_a3')
    expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), canal, 'tipo_indisponivel', 'channel_traffic_source_a3')
    expect([...resumo.tipo_indisponivel].sort()).toEqual(['Canal Um: channel_basic_a3', 'Canal Um: channel_traffic_source_a3'])
  })

  it('tipo habilitado com data de descontinuação: o job é criado mesmo assim e a data aparece em acao_do_dono', async () => {
    const quando = new Date(Date.now() + 90 * 86_400_000).toISOString()
    api.reportTypesList.mockResolvedValue(REPORT_TYPES_ENABLED.map(id => (id === 'channel_basic_a3' ? { id, deprecateTime: quando } : { id })))
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'ativo' })
    expect(resumo.acao_do_dono).toEqual([`Canal Um: channel_basic_a3 tem data de descontinuação no YouTube (${quando})`])
    expect(ctx.falhas).toEqual([])
  })

  it('tipo fora da lista com data de descontinuação: nenhuma nota', async () => {
    api.reportTypesList.mockResolvedValue([...REPORT_TYPES_ENABLED.map(id => ({ id })), { id: 'channel_annotations_a1', deprecateTime: '2019-01-15T00:00:00Z' }])
    const resumo = await passoJobs(ctxDe(fakeSupabase()))
    expect(resumo.acao_do_dono).toEqual([])
  })
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/coleta/jobs-step.test.ts`
Expected: FAIL nos três novos e nos dois alterados.

- [ ] **Step 4: Implementar em `types.ts` e `jobs-step.ts`**

`apps/web/src/lib/youtube/reporting/types.ts`:

```ts
export interface ReportType {
  id: string
  name?: string
  /** Quando o YouTube marcou (ou vai marcar) o tipo como descontinuado. Ausente = tipo corrente. */
  deprecateTime?: string
}
```

`apps/web/src/lib/youtube/coleta/jobs-step.ts`, em `sondarCanal`, dentro do `try` logo depois de `oferecidos = new Set(tipos.map(t => t.id))`:

```ts
    // O job de um tipo com data de descontinuação é criado mesmo assim (o bruto vale enquanto vier), mas o dono fica
    // sabendo: quando o YouTube desligar o tipo, os relatórios param e a versão nova precisa entrar na lista.
    for (const t of tipos) {
      if (t.deprecateTime && HABILITADOS.includes(t.id)) {
        pushUnico(resumo.acao_do_dono, `${c.name}: ${t.id} tem data de descontinuação no YouTube (${t.deprecateTime})`)
      }
    }
```

E a chamada do aviso, no ramo `if (!oferecidos.has(tipo))`:

```ts
        await avisarEntrada(ctx, c, 'tipo_indisponivel', tipo)
```

- [ ] **Step 5: Rodar, typecheck e commit**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/coleta/jobs-step.test.ts test/youtube/coleta/alerts.test.ts`
Expected: PASS.

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run typecheck -w apps/web`

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git commit -m "fix: aviso de relatório indisponível diz qual tipo e avisa uma vez por tipo; data de descontinuação do tipo vai para ação do dono" -- apps/web/src/lib/youtube/coleta/alerts.ts apps/web/src/lib/youtube/coleta/jobs-step.ts apps/web/src/lib/youtube/reporting/types.ts apps/web/test/youtube/coleta/alerts.test.ts apps/web/test/youtube/coleta/jobs-step.test.ts
```

---

### Task 5: Os tetos, com a conta presa por teste

**Files:**
- Modify: `apps/web/src/lib/youtube/coleta/reports-step.ts` (`MAX_DOWNLOADS`, `MAX_GZ_BYTES`)
- Modify: `apps/web/src/lib/youtube/coleta/clock.ts` (`TETOS_MS`)
- Test: `apps/web/test/youtube/coleta/clock.test.ts`, `apps/web/test/youtube/coleta/reports-step.test.ts`, `apps/web/test/youtube/coleta/index.test.ts` (linha 78)

**Interfaces:**
- Produces: `MAX_DOWNLOADS = 100`; `MAX_GZ_BYTES = 10 * 1024 * 1024`; `TETOS_MS.relatorios = 120_000`. Nada mais muda de nome nem de tipo.

- [ ] **Step 1: Testes (falham)**

(a) `apps/web/test/youtube/coleta/clock.test.ts`, no teste `'as constantes são as do spec'`, a linha de `TETOS_MS` vira:

```ts
    expect(TETOS_MS).toEqual({ metadados: 30_000, jobs: 20_000, relatorios: 120_000, alcance: 20_000, diario: 50_000 })
```

e acrescente, no mesmo `describe`:

```ts
  it('a conta do orçamento fecha: a soma dos tetos mais a reserva da parte antiga da rota cabe no relógio global', () => {
    // Parte antiga da rota (analytics por janela), medida em produção de 09 a 12/10/2026: 19,9 a 23,7 s.
    const RESERVA_PARTE_ANTIGA_MS = 30_000
    const soma = Object.values(TETOS_MS).reduce((s, n) => s + n, 0)
    expect(soma + RESERVA_PARTE_ANTIGA_MS).toBeLessThanOrEqual(RELOGIO_GLOBAL_MS)
  })
```

(b) `apps/web/test/youtube/coleta/reports-step.test.ts`: acrescente `import { TETOS_MS } from '@/lib/youtube/coleta/clock'` (junte ao import de `SemTempoError` que já existe: `import { SemTempoError, TETOS_MS } from '@/lib/youtube/coleta/clock'`).

**Substitua** `it('100 listados: 40 baixados e 60 pendentes; no dia seguinte baixa mais 40 pelo download_url gravado', ...)` por:

```ts
  it('fila de 250: baixa o teto (100) e deixa 150; no dia seguinte baixa mais 100 pelo download_url gravado', async () => {
    const todos = Array.from({ length: 250 }, (_, i) => listado(`r-${String(i).padStart(3, '0')}`, { create_time: new Date(AGORA.getTime() - (400 - i) * 60_000).toISOString() }))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: todos })
    const ctx = ctxDe(db)
    const um = await passoRelatorios(ctx)
    expect(MAX_DOWNLOADS).toBe(100)
    expect(um).toMatchObject({ baixados: 100, pendentes: 150 })
    expect(comStatus(db, 'baixado')).toHaveLength(100)
    expect(rel(db, 'r-000')!.status).toBe('baixado')
    expect(rel(db, 'r-100')!.status).toBe('listado')
    // O teto de downloads não é falta de orçamento: só o relógio é.
    expect(ctx.tentativas.some(t => t.outcome === 'nao_alcancado_orcamento')).toBe(false)
    const dois = await passoRelatorios(ctxDe(db))
    expect(dois).toMatchObject({ baixados: 100, pendentes: 50 })
    expect(api.download).toHaveBeenLastCalledWith('https://dl.test/r-199')
  })

  it('o teto de downloads cabe no teto de tempo do passo, pela medida de produção: mexer num exige refazer a conta', () => {
    const MS_POR_DOWNLOAD = 900   // pior medida: 36,0 s para listar 8 jobs e baixar 40 (execução de 11/10/2026)
    const MS_LISTAGEM = 20_000    // reserva para listar 26 jobs, 4 em paralelo
    expect(MAX_DOWNLOADS * MS_POR_DOWNLOAD + MS_LISTAGEM).toBeLessThanOrEqual(TETOS_MS.relatorios)
  })

  it('o teto de tamanho é 10 MB comprimido', () => {
    expect(MAX_GZ_BYTES).toBe(10 * 1024 * 1024)
  })
```

No teste antigo `it('acima de 2 MB comprimido: erro grande_demais, sem bruto', ...)`: **apague-o** (o teste "acima do teto" da Tarefa 2 cobre o mesmo caso sem número fixo, e o de cima fixa o número).

(c) `apps/web/test/youtube/coleta/index.test.ts`, linha 78: troque `toBe(60_000)` por `toBe(120_000)`.

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/coleta/clock.test.ts test/youtube/coleta/reports-step.test.ts test/youtube/coleta/index.test.ts > /tmp/e12-t5.txt 2>&1; tail -n 30 /tmp/e12-t5.txt`
Expected: FAIL em quatro pontos: as constantes do relógio, "fila de 250", "o teto de tamanho" e `index` linha 78. Os dois testes de conta já passam com os números de hoje (180 + 30 ≤ 270 s; 40 × 900 + 20.000 = 56.000 ≤ 60.000 ms): eles não provam a mudança, são a trava que impede mexer num teto sem refazer a conta. Depois do Step 2 valem 240 + 30 ≤ 270 s e 100 × 900 + 20.000 = 110.000 ≤ 120.000 ms.

- [ ] **Step 2: Mudar as constantes**

`apps/web/src/lib/youtube/coleta/reports-step.ts`:

```ts
// Tetos da E12 (A5). Medida de produção, 09 a 12/10/2026: até 0,90 s por download (um por vez) e o maior relatório
// com 564 bytes comprimidos. 100 downloads + a listagem cabem em TETOS_MS.relatorios; reports-step.test.ts refaz a conta.
export const MAX_DOWNLOADS = 100
/** Acima disto o relatório vira `erro: grande_demais` e o bruto NÃO é guardado. O download e a descompressão acontecem
 *  em memória antes desta conferência: subir este número pede conferir a memória da função. */
export const MAX_GZ_BYTES = 10 * 1024 * 1024
```

`apps/web/src/lib/youtube/coleta/clock.ts`:

```ts
// Soma dos tetos: 240 s. Com os 30 s de reserva da parte antiga da rota fecha os 270 s do relógio (clock.test.ts).
export const TETOS_MS = { metadados: 30_000, jobs: 20_000, relatorios: 120_000, alcance: 20_000, diario: 50_000 } as const
```

Em `reports-step.ts`, corrija os dois comentários que citam "40": `// Só o relógio conta como nao_alcancado_orcamento; o teto de 40 e a fila não.` vira `...; o teto de downloads e a fila não.`

- [ ] **Step 3: Rodar a pasta, typecheck, commit**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/coleta > /tmp/e12-t5b.txt 2>&1; tail -n 30 /tmp/e12-t5b.txt`
Expected: PASS. Se outro teste da pasta fixar `60_000` do passo de relatórios ou `40` downloads, troque pelo símbolo (`TETOS_MS.relatorios`, `MAX_DOWNLOADS`); qualquer outra quebra, pare e relate.

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run typecheck -w apps/web`

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git commit -m "feat: tetos dos relatórios em lote (100 downloads, 10 MB, 120 s) com a conta do orçamento presa por teste" -- apps/web/src/lib/youtube/coleta/reports-step.ts apps/web/src/lib/youtube/coleta/clock.ts apps/web/test/youtube/coleta/clock.test.ts apps/web/test/youtube/coleta/reports-step.test.ts apps/web/test/youtube/coleta/index.test.ts
```

---

### Task 6: Ligar os 9 tipos

Só depois das Tarefas 1 a 5 em `staging`: é esta linha que faz o YouTube gerar 558 relatórios com prazo de 30 dias.

**Files:**
- Modify: `apps/web/src/lib/youtube/reporting/types.ts` (linhas 3-16)
- Test: `apps/web/test/youtube/coleta/reporting-client.test.ts`, `apps/web/test/youtube/coleta/jobs-step.test.ts`, e a troca de `FORA` em `criteria.test.ts`, `jobs-step.test.ts`, `reports-step.test.ts`

**Interfaces:**
- Produces: `REPORT_TYPES_ENABLED` com 13 ids, os 4 de hoje nas 4 primeiras posições; `SEM_NORMALIZADOR` derivado (12 ids: todos menos `channel_reach_basic_a1`).

- [ ] **Step 1: Testes (falham)**

(a) `apps/web/test/youtube/coleta/reporting-client.test.ts`, **substitua** o teste `'tipos habilitados na ordem de prioridade de download, e os derivados'` por:

```ts
  it('E12: 13 tipos de canal; os 4 de sempre na frente, depois os 9 que só guardam bruto', () => {
    const ANTIGOS = ['channel_reach_basic_a1', 'channel_reach_combined_a1', 'channel_traffic_source_a3', 'channel_basic_a3']
    const NOVOS = [
      'channel_combined_a3', 'channel_device_os_a3', 'channel_playback_location_a3', 'channel_province_a3', 'channel_demographics_a1',
      'channel_subtitles_a3', 'channel_cards_a1', 'channel_end_screens_a1', 'channel_sharing_service_a1',
    ]
    expect([...REPORT_TYPES_ENABLED]).toEqual([...ANTIGOS, ...NOVOS])
    expect(new Set(REPORT_TYPES_ENABLED).size).toBe(13)
    expect([...REACH_TYPES]).toEqual(['channel_reach_basic_a1', 'channel_reach_combined_a1'])
    expect(SEM_NORMALIZADOR).toEqual([...ANTIGOS, ...NOVOS].filter(t => t !== 'channel_reach_basic_a1'))
    expect(REPORTING_BASE).toBe('https://youtubereporting.googleapis.com/v1')
  })

  it('E12: fora da lista ficam anotações (recurso extinto) e todos os tipos de playlist', () => {
    for (const t of REPORT_TYPES_ENABLED) expect(t).toMatch(/^channel_[a-z_]+_a\d$/)
    expect(REPORT_TYPES_ENABLED as readonly string[]).not.toContain('channel_annotations_a1')
  })
```

(b) Nos três arquivos de teste que declaram `const FORA = 'channel_demographics_a1'` (`criteria.test.ts` linha 150, `jobs-step.test.ts` linha 411, `reports-step.test.ts` linha 552), troque o valor por `'channel_annotations_a1'`: `channel_demographics_a1` deixa de ser "tipo fora da lista".

(c) `apps/web/test/youtube/coleta/jobs-step.test.ts`:

- Onde o teste fixa o número 4 como "quantos tipos habilitados" (`toHaveBeenCalledTimes(4)`, `resumo.gravados).toBe(4)`, `.toHaveLength(4)` nas linhas 55, 59, 63, 171, 232 e 278), troque `4` por `REPORT_TYPES_ENABLED.length`. Nos títulos, "os quatro" vira "todos os habilitados".
- **Substitua** o teste `'tipo habilitado ausente da lista: tipo_indisponivel, avisa e fica na resposta; tipo não habilitado: desativado, sem chamada'` por:

```ts
  it('tipo habilitado ausente da lista: tipo_indisponivel, avisa e fica na resposta; tipo não habilitado: desativado, sem chamada', async () => {
    api.reportTypesList.mockResolvedValue([
      ...REPORT_TYPES_ENABLED.filter(t => t !== 'channel_reach_basic_a1').map(id => ({ id })),
      { id: 'channel_annotations_a1' },
    ])
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(job(db, 'channel_reach_basic_a1')).toMatchObject({ status: 'tipo_indisponivel' })
    expect(job(db, 'channel_reach_basic_a1')!.job_id).toBeUndefined()
    expect(job(db, 'channel_annotations_a1')).toMatchObject({ status: 'desativado' })
    expect(api.jobsCreate).toHaveBeenCalledTimes(REPORT_TYPES_ENABLED.length - 1)
    expect(api.jobsCreate.mock.calls.map(c => (c[0] as { reportTypeId: string }).reportTypeId)).not.toContain('channel_annotations_a1')
    expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), canal, 'tipo_indisponivel', 'channel_reach_basic_a1')
    expect(resumo.tipo_indisponivel).toEqual(['Canal Um: channel_reach_basic_a1'])
    expect(resumo.acao_do_dono).toEqual([])
    expect(ctx.falhas).toEqual([])
  })
```

- Acrescente ao `describe('passoJobs: caminho feliz', ...)` o retrato da produção de 12/10:

```ts
  it('E12, como a produção em 12/10: os 4 de sempre ativos e os 9 novos em desativado; cria só os 9 e nenhum habilitado fica em desativado', async () => {
    const ANTIGOS = ['channel_reach_basic_a1', 'channel_reach_combined_a1', 'channel_traffic_source_a3', 'channel_basic_a3']
    const NOVOS = REPORT_TYPES_ENABLED.filter(t => !ANTIGOS.includes(t))
    expect(NOVOS).toHaveLength(9)
    const desativado = (tipo: string): Row => ({ site_id: 'site-1', channel_id: 'ch-1', report_type_id: tipo, status: 'desativado' })
    const db = fakeSupabase({ yt_reporting_jobs: [...ANTIGOS.map(linhaAtiva), ...NOVOS.map(desativado), desativado('channel_annotations_a1'), desativado('playlist_basic_a2')] })
    api.reportTypesList.mockResolvedValue([...REPORT_TYPES_ENABLED.map(id => ({ id })), { id: 'channel_annotations_a1' }, { id: 'playlist_basic_a2' }])
    api.jobsList.mockResolvedValue(ANTIGOS.map(t => ({ id: `job-${t}`, reportTypeId: t, createTime: '2026-10-01T00:00:00.000Z' })))
    const ctx = ctxDe(db)
    await passoJobs(ctx)
    expect(api.jobsCreate.mock.calls.map(c => (c[0] as { reportTypeId: string }).reportTypeId).sort()).toEqual([...NOVOS].sort())
    for (const t of REPORT_TYPES_ENABLED) expect(job(db, t)).toMatchObject({ status: 'ativo' })
    for (const t of NOVOS) expect(job(db, t)!.job_id).toBe(`job-${t}`)
    expect(job(db, 'channel_annotations_a1')).toMatchObject({ status: 'desativado' })
    expect(job(db, 'playlist_basic_a2')).toMatchObject({ status: 'desativado' })
    expect(ctx.falhas).toEqual([])
  })
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/coleta/reporting-client.test.ts test/youtube/coleta/jobs-step.test.ts > /tmp/e12-t6.txt 2>&1; tail -n 30 /tmp/e12-t6.txt`
Expected: FAIL em "E12: 13 tipos" e em "E12, como a produção" (`NOVOS` tem 0 itens).

- [ ] **Step 2: A lista**

`apps/web/src/lib/youtube/reporting/types.ts`, substitua o bloco de `REPORT_TYPES_ENABLED`:

```ts
/**
 * Tipos de relatório que o site pede. Habilitar um tipo é um commit de uma linha: o passo de jobs cria o job na
 * execução seguinte e o YouTube gera os 30 dias anteriores, que vencem 30 dias depois de gerados.
 * A ORDEM só desempata a fila de download (quem manda é o vencimento: coleta/fila-relatorios.ts).
 * Os 9 depois de `channel_basic_a3` entraram na E12 da A5 e só guardam o bruto (sem normalizador, sem tela).
 * Ids como o YouTube os ofereceu aos dois canais em 12/10/2026 (linhas `desativado` de yt_reporting_jobs).
 * Fora de propósito: `channel_annotations_a1` (recurso extinto) e os tipos `playlist_*`.
 */
export const REPORT_TYPES_ENABLED = [
  'channel_reach_basic_a1',
  'channel_reach_combined_a1',
  'channel_traffic_source_a3',
  'channel_basic_a3',
  'channel_combined_a3',
  'channel_device_os_a3',
  'channel_playback_location_a3',
  'channel_province_a3',
  'channel_demographics_a1',
  'channel_subtitles_a3',
  'channel_cards_a1',
  'channel_end_screens_a1',
  'channel_sharing_service_a1',
] as const
```

- [ ] **Step 3: Rodar a pasta da coleta e a do Observatório**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/coleta test/youtube/observatorio > /tmp/e12-t6b.txt 2>&1; tail -n 40 /tmp/e12-t6b.txt`
Expected: PASS. Conserto permitido em teste existente, e só este: número fixo de tipos habilitados (4) ou a lista dos 4 escrita por extenso, trocados por `REPORT_TYPES_ENABLED.length` ou pela constante. Se quebrar um teste que conta **relatórios** ou **chamadas** de um simulador (por exemplo `tres-dias.test.ts`, `orcamento.test.ts`), leia o que ele prova antes de mexer; se a quebra não for só contagem de tipos, pare e relate.

- [ ] **Step 4: Typecheck e commit**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run typecheck -w apps/web`

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git commit -m "feat: liga os 9 tipos de relatório em lote do YouTube que estavam desligados (A5, E12)" -- apps/web/src/lib/youtube/reporting/types.ts apps/web/test/youtube/coleta/reporting-client.test.ts apps/web/test/youtube/coleta/jobs-step.test.ts apps/web/test/youtube/coleta/criteria.test.ts apps/web/test/youtube/coleta/reports-step.test.ts
```

(Inclua no `--` qualquer outro arquivo de teste consertado no Step 3.)

---

### Task 7: Runbook e verificação final antes do push

**Files:**
- Modify: `docs/ops/youtube-coleta-canais-proprios-runbook.md` (seções 1, 2, 5, 6, 8, 10)

**Interfaces:** nenhuma (documento e conferência).

- [ ] **Step 1: Atualizar o runbook**

Ache cada trecho por busca (`grep -n`), não pelo número da linha.

(a) Seção 1, o parágrafo "Tipos de relatório habilitados (...)": troque por

```markdown
Tipos de relatório habilitados (`REPORT_TYPES_ENABLED`): os 4 de sempre (`channel_reach_basic_a1`, `channel_reach_combined_a1`, `channel_traffic_source_a3`, `channel_basic_a3`) e, desde a E12 da A5, mais 9 que **só guardam o bruto** (sem normalizador e sem tela): `channel_combined_a3`, `channel_device_os_a3`, `channel_playback_location_a3`, `channel_province_a3`, `channel_demographics_a1`, `channel_subtitles_a3`, `channel_cards_a1`, `channel_end_screens_a1`, `channel_sharing_service_a1`. Os dois primeiros da lista são os "de alcance". Ficam fora de propósito `channel_annotations_a1` (recurso extinto) e os `playlist_*`. A ordem da lista só desempata a fila de download.
```

(b) Seção 2: a linha dos tetos passa a "metadados 30 s, jobs 20 s, **relatórios 120 s**, alcance 20 s, diário 50 s" e ganha, logo abaixo:

```markdown
- A soma dos tetos é 240 s; com 30 s de reserva para a parte antiga (medida: 20 a 24 s) fecha os 270 s. `clock.test.ts` trava essa conta: mexer num teto quebra o teste até a conta ser refeita.
```

A linha "No máximo **40 downloads** ..." e a seguinte passam a:

```markdown
- No máximo **100 downloads de relatório por execução**, um por vez. Medida de produção (09 a 12/10/2026): até 0,90 s por download; 100 downloads mais a listagem de 26 jobs cabem nos 120 s (`reports-step.test.ts` trava a conta). Bater nesse teto é normal e **não é falha** enquanto a fila estiver caindo: `coleta.relatorios.pendentes` diz quantos ficaram e `coleta.relatorios.vence_primeiro_em_dias` diz em quantos dias vence o primeiro deles (`null` = nada ficou para trás). `ms_listar` e `ms_baixar` dão o tempo de cada parte.
- **Ordem da fila** (`coleta/fila-relatorios.ts`): primeiro o que vence na origem em até 7 dias, de qualquer tipo; depois os de alcance; depois o resto, pelo vencimento. O arquivo vence 60 dias depois de gerado, ou 30 se for de histórico (`is_backfill`).
- Só o **relógio** produz `nao_alcancado_orcamento`. O teto de 100 não.
```

A linha "Bruto comprimido acima de 2 MB ..." passa a:

```markdown
- Bruto comprimido acima de **10 MB** vira relatório em `erro` com `error = 'grande_demais'` e **não é guardado**; o cron fica vermelho na hora e por 14 dias. Acima de 5 MB o bruto é guardado e a execução avisa (`... mais da metade do teto ...`). `coleta.relatorios.maior_bytes` é o maior relatório da execução.
```

(c) Seção 5, `tipo_indisponivel`: o texto do aviso passa a `"O YouTube não oferece o relatório <tipo> para o canal <nome>."`, com "Avisa uma vez **por tipo**". Acrescente no fim da seção 5:

```markdown
### `<canal>: <tipo> tem data de descontinuação no YouTube (<data>)`
Aparece só na execução em que o passo de jobs sonda os tipos (quando falta job para algum). O job é criado mesmo assim. Anote a data no ledger: quando o YouTube desligar o tipo, a versão nova precisa entrar em `REPORT_TYPES_ENABLED`.

### `<canal> tem N tipo(s) de relatório habilitado(s) sem job: ... (o canal precisa ser reconectado)`
O canal perdeu a autorização e o job desses tipos não pôde ser criado. Reconecte o canal: o job é criado na execução seguinte. Cada dia sem job é um dia de histórico que não volta.
```

(d) Seção 6, tabela "Relatórios (passo 1C e critérios)": na linha `tem relatório de alcance <tipo> em erro`, tire `gzip_invalido` da lista de causas do passo de relatórios (gzip que não abre agora é tentado de novo). Na linha `tem relatório <tipo> expirado sem baixar`, acrescente ao "Significa": "vale só para relatório com menos de 14 dias; o vencimento por idade aparece na nota `venceram sem baixar nesta execução`". Acrescente as linhas:

```markdown
| `relatórios: N relatório(s) venceram sem baixar nesta execução (<tipo>: n, ...)` | nesta execução, N relatórios de tipo habilitado passaram do prazo da origem (30 dias de histórico, 60 dos demais) ou o download devolveu 404/410. **O dado não volta** | ver por que a fila não andou: `pendentes`, `ms_baixar`, tentativas `relatorio`. Anote no ledger o tipo e o período perdido |
| `relatórios: <canal> tem relatório <tipo> em erro (<motivo>)` | relatório de até 14 dias em `erro`, de tipo que só guarda bruto. Motivos: `grande_demais`, `url_inesperada` | `grande_demais`: subir `MAX_GZ_BYTES` e recolocar na fila (seção 8); `url_inesperada`: não tem conserto |
| `relatórios: <tipo> recusado por tamanho (<bytes> bytes comprimidos; teto <teto>): o bruto NÃO foi guardado` | o relatório passou do teto na execução de hoje | idem `grande_demais` acima |
| `relatórios: <tipo> chegou a <bytes> bytes comprimidos, mais da metade do teto de <teto>` | o bruto **foi** guardado; aviso para subir o teto antes de perder | subir `MAX_GZ_BYTES` (e conferir a memória da função) |
| `relatórios: fila de download cortada em 1000 relatórios; ...` | há mais de 1000 `listado`; a ordem por vencimento não enxerga o que passou do corte | conferir o que vence primeiro pela consulta da seção 4 e baixar a fila |
| `jobs: <canal> tem N tipo(s) de relatório habilitado(s) sem job: ...` | a linha do tipo segue `desativado`: o passo de jobs não passou pelo canal (sem conexão, sem tempo ou exceção) | ver tentativas `sondagem` do canal; resolvido, o job nasce na execução seguinte |
| `jobs: <canal> não consegue baixar o relatório <tipo> há 3 dias (último erro: gzip_invalido)` | o arquivo chega e não abre, três dias seguidos | exportar a URL e tentar à mão; se o arquivo da origem estiver mesmo corrompido, ele vence e vira `perdidos` |
```

Na linha `está sem relatório novo de <tipo> há mais de 6 dias`, acrescente: "Para os tipos que só guardam bruto vale a marca `yt_reporting_jobs.last_create_time` (nula = nunca chegou relatório) e não há o filtro de publicação."

(e) Seção 8, onde diz que `grande_demais` "não se resolve com estes `update`": acrescente

```markdown
Exceção: `grande_demais` **dentro do prazo da origem** se resolve subindo `MAX_GZ_BYTES`, fazendo o deploy e, depois, recolocando o relatório na fila (escrita em produção: **é do dono**):

    update yt_reporting_reports set status = 'listado', error = null where status = 'erro' and error = 'grande_demais';
```

(f) Seção 10: em "Habilitar um tipo", troque "A posição na lista é a prioridade de download" por "A posição na lista só desempata a fila. **Antes** de habilitar, refaça a conta da seção 2: cada tipo novo traz cerca de 62 relatórios de histórico que vencem em 30 dias."

- [ ] **Step 2: Verificação final**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube test/api/cron > /tmp/e12-final.txt 2>&1; tail -n 30 /tmp/e12-final.txt`
Expected: PASS (menos de 4 minutos; se passar disso, rode `test/youtube/coleta` e `test/api/cron` em separado).

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run typecheck -w apps/web`
Expected: sem erros.

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && git status --short | grep -v '^??' | grep -v 'next-env.d.ts\|apps/web/tsconfig.json\|mockups/'`
Expected: só o runbook modificado (o resto já foi commitado por tarefa).

- [ ] **Step 3: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git commit -m "docs: runbook da coleta com os tetos, a ordem da fila e as notas novas da E12" -- docs/ops/youtube-coleta-canais-proprios-runbook.md
```

Push de `staging`, CI e promoção para `main` são do controlador (não do implementador), depois da revisão do lote. O deploy em `main` precisa estar no ar **antes de 12:00 UTC** do dia em que se quer a primeira execução; cada dia de atraso perde um dia de histórico dos 9 tipos (o YouTube só gera os 30 dias anteriores à criação do job).

---

### Task 8: Conferência em produção (só leitura) e ledger

Não é tarefa de implementador: é do controlador, com as respostas anotadas em `.superpowers/sdd/a5/e12-ledger.md` (criar na primeira anotação: data, consulta, resultado). Toda consulta é `select`; nada aqui escreve. Uma consulta por comando:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx supabase db query --linked "<consulta>" 2>&1 | grep '"l"'
```

- [ ] **Antes do deploy (D−0): retrato de partida.** Anote o resultado das consultas A, B e D abaixo e a data e hora do deploy em `main` (é o `<deploy>` do item 95).

- [ ] **Depois da primeira execução (D, 12:05 UTC ou mais): item 94.**

Consulta A (jobs por tipo e estado):

```sql
select report_type_id || ' | ' || status || ' | n=' || count(*) as l from yt_reporting_jobs group by report_type_id, status order by 1, 2
```

Esperado: os 13 tipos da lista com `ativo | n=2`; `channel_annotations_a1` e os 6 `playlist_*` com `desativado | n=2`. Um tipo da lista em `tipo_indisponivel`: anote o tipo e o canal (o aviso chega com o nome). Um tipo da lista em `desativado` ou `erro`: o cron tem de estar vermelho com a nota da Tarefa 3; se estiver verde, é defeito, pare.

Consulta B (a execução: tempos e resumo; itens 96 e 97):

```sql
select to_char(ran_at, 'MM-DD HH24:MI') || ' | total=' || ms_total || ' | passos=' || ms_passos::text || ' | rel=' || coalesce((resumo->'relatorios')::text, '-') || ' | dono=' || array_to_string(acao_do_dono, ' ; ') || ' | falhas=' || array_to_string(falhas, ' ; ') as l from yt_own_collection_runs order by ran_at desc limit 3
```

Esperado na primeira execução: `baixados + vazios` perto de 100, `pendentes` caindo, `vence_primeiro_em_dias` maior que 20, `ms_passos.relatorios` abaixo de 120000, `ms_total` abaixo de 270000, `falhas` vazio. Procure em `dono` a palavra "descontinuação": se aparecer, anote o tipo e a data (responde ao "NC" do spec sobre a versão corrente). Anote `ms_listar`, `ms_baixar` e `ms_baixar ÷ (baixados + vazios)`: é a medida real por download.

- [ ] **D+1 a D+3: o histórico dos tipos novos aparece.**

Consulta C (a fila, por tipo, com o primeiro vencimento):

```sql
select report_type_id || ' | listado=' || count(*) || ' | vence_primeiro=' || to_char(min(create_time + case when is_backfill then interval '30 days' else interval '60 days' end), 'MM-DD HH24:MI') as l from yt_reporting_reports where status = 'listado' group by report_type_id order by 2
```

Esperado: os 9 tipos novos com cerca de 62 cada no pico; `channel_traffic_source_a3` e `channel_basic_a3` de histórico zerados na primeira execução. Zero relatórios de um tipo novo depois de D+3: não é "ok"; aos 6 dias o cron fica vermelho (Tarefa 3). Anote já.

- [ ] **Três execuções seguidas: item 97.** Anote `ms_passos.relatorios`, `ms_listar`, `ms_baixar` e `ms_total` das três (consulta B). Se o tempo por download medido passar de 0,90 s, refaça a conta e baixe `MAX_DOWNLOADS` (o teste obriga).

- [ ] **Até D+11: a fila esvazia.** Consulta C devolve só os relatórios do dia (ou nada). Se `pendentes` não cair 70 ou mais por dia, pare e investigue.

- [ ] **Antes de 01/11/2026 e em todo dia dos 30 seguintes: item 95.**

```sql
select 'listado_velho=' || count(*) as l from yt_reporting_reports where status = 'listado' and create_time < now() - interval '20 days'
```

```sql
select 'vencidos_depois_do_deploy=' || count(*) as l from yt_reporting_reports where status = 'expirado_sem_baixar' and create_time > '<deploy>'
```

Esperado: 0 e 0. (O cron faz essa vigilância sozinho: `listado` há mais de 14 dias e "venceram sem baixar nesta execução" deixam o veredito vermelho. A consulta é a prova para o ledger.)

- [ ] **Item 96 e o tamanho (D+30).**

Consulta D:

```sql
select 'grande_demais=' || count(*) filter (where status = 'erro' and error = 'grande_demais') || ' | maior_bytes=' || coalesce(max(bytes)::text, '-') || ' | erro=' || count(*) filter (where status = 'erro') as l from yt_reporting_reports
```

```sql
select 'blobs=' || count(*) || ' | bytes=' || sum(octet_length(csv_gz)) || ' | tabela=' || pg_total_relation_size('public.yt_reporting_report_blobs') as l from yt_reporting_report_blobs
```

Esperado: `grande_demais=0`; `maior_bytes` abaixo de 5.242.880 (metade do teto); o tamanho da tabela anotado e comparado com a estimativa de 7.4 ("centenas de kB por ano" no canal de hoje). Partida em 12/10: 160 brutos, 21.262 bytes, tabela de 180.224 bytes.

- [ ] **Sanidade do dado ausente.**

```sql
select 'jobs_ativos_sem_data=' || count(*) as l from yt_reporting_jobs where status = 'ativo' and job_create_time is null
```

Esperado: 0. Se não for zero: sem `job_create_time` o passo não reconhece relatório de histórico (`is_backfill` fica falso) e passa a contar 60 dias para um arquivo que vence em 30. Anote e avise o dono; o conserto é recriar o job (runbook, seção 9).

**O que é do dono nesta etapa:** responder às perguntas do topo; reconectar um canal se aparecer "precisa ser reconectado"; o `update` do runbook (seção 8) se algum dia houver `grande_demais`; conferir a cota no Google Cloud Console se quiser. **O que o deploy faz sozinho:** cria 18 jobs no YouTube pela Reporting API (escrita externa, do cron). **O que é do agente:** commits, push de `staging`, CI, promoção para `main` e todas as leituras acima.

## Limites conhecidos (ficam no plano, não viram tarefa)

- **Memória com relatório grande.** O download e a descompressão são feitos em memória antes da conferência de tamanho, e o bruto vai ao banco como texto hexadecimal (o dobro do tamanho). Com o maior relatório real em 564 bytes isso é teórico; o aviso de "mais da metade do teto" existe para a conversa acontecer antes.
- **Cota da Reporting API não documentada.** Evidência: 4 execuções a 1,6 chamada por segundo sem recusa; o ritmo novo é o mesmo, por mais tempo. Um 429 deixa o relatório `listado` para o dia seguinte e, em 3 dias, o cron fica vermelho.
- **A limpeza de 180 dias segue valendo** para o bruto sem normalizador (a partir de abril de 2027). Quem a troca por "só apaga o que foi exportado" é a E10 (spec 9.2), não esta etapa.
- **Fora deste plano: as conferências de leitura da retenção (7.2, item 58) e da E11 (7.3, item 83).** A tabela da seção 14 as põe "junto" da E12, mas são chamadas autenticadas à Analytics API e pertencem aos planos da E8 e da E11. Uma delas (se o CSV de tráfego traz o termo pesquisado) pode ser respondida lendo um bruto já baixado, quando o plano da E11 for escrito.
- **Job sem `job_create_time`.** Sem essa data o passo não reconhece relatório de histórico e conta 60 dias para um arquivo que vence em 30. Em produção todos os jobs têm a data; a Tarefa 8 confere, e o plano não muda a regra de `is_backfill`.
- **Nenhum leitor novo.** O bruto dos 9 tipos não é lido por tela, forja nem Cowork; a RLS de hoje segue (o bruto só é lido com a chave de serviço).
