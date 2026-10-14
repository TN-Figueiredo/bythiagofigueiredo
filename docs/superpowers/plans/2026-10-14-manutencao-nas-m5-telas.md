# Fase de manutenção (NAS e forja), M5: as telas. Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** as telas do Observatório passam a saber que a série online começa numa data lida do registro (`online desde`) e a dizer "desde dd/mm" e "no arquivo" no lugar de um número inventado; nasce a página **Arquivo** (peça 2) só de leitura, com o bloco "Canais removidos" só de leitura; a fila "Saíram do YouTube" ganha a leitura da peça 7; o aviso do banco passa ao `18-v2` (peça 5), com a marca "N canais removidos pedem um comando seu" ao lado da pastilha; e, no mesmo release, as classes `serie` e `horaria` ficam liberadas na política (condição 1 do portão, `02` §10.5).

**Architecture:** uma migration (`*_manutencao_m5_telas.sql`, rascunho em `supabase/rascunhos/m5.sql` até a Tarefa 13, TRAVA M5-1) cria três leitores só de leitura (`obs_archive_online_since`, `obs_archive_pagina`, `obs_archive_removed_channel_list` v2), corrige dois leitores das séries da A5 (`competitor_hourly_health.desde` e `competitor_channel_removal_impact`) e libera as duas classes. No site, módulos puros em `apps/web/src/lib/youtube/observatorio/arquivo-mensal/` (online desde, estado do mês, frases da página, bloco de canais removidos, aviso v2) e leitores de servidor que os alimentam; as telas consomem só os modelos puros. O carregador troca o teto de 365 dias pelo `online desde` num commit só (pedido 11).

**Tech Stack:** PostgreSQL 17 (Supabase), Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript strict, Zod, Vitest (node, jsdom), `pg` nos testes de integração, Playwright e chrome-devtools (Gio).

**Spec:** `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/` (aprovado em 14/10, commit `8b4dd7b61`). Trechos desta etapa: `05` §15.1 linha M5 (e linha M3b, "quando a página do Arquivo nascer (M5), o bloco 'Canais removidos' só de leitura"), §17 pedido 11; `04` §14 (vocabulário, três ausências, quem vê), §14.1 (peça 1, inteira), §14.2 (peça 2: estados do mês, de problema, grupo "Dado de teste", bloco "Canais removidos"), §14.5 (peça 5), §14.7 (peça 7, parte de leitura), §14.8, §14.9, §14.12; `02` §10.3 (classe liberada), §10.4 (`obs_archive_online_since`); `06` §18 itens 34 a 39, 81 a 87, 121 (parte de leitura), 163 (parte M5: bloco só de leitura e marca).

**Fonte das telas (manda sobre o spec onde divergem; não se redesenha):** mockup 19 (`docs/superpowers/mockups/2026-10-14-manutencao-nas/19-mes-fora-do-banco/`: `series.html` + `series.js` peça 1; `arquivo.html` + `arquivo.js` + `arq-dados.js` peça 2 e bloco; `peca7.html` + `peca7.js` peça 7; `m19.css` tokens e formas; `NOTAS.md`), `18-v2` (`docs/superpowers/mockups/2026-10-13-a5-lote-2/18-aviso-banco-limite/18-v2.html`, `bl2.js`, `bl2.css`, `NOTAS-18-v2.md`), base comum em `.../2026-10-14-manutencao-nas/PLANO-DAS-TELAS.md` §1. Aprovação do dono de todas as peças: índice dos planos, linha 6 (M4 concluída em 14/10).

**Planos que este consome (por `grep`, sem copiar):** M2 (`...-m2-particoes.md`: `obs_partitions_months_ahead()` linha 1307, `obs_archive_rehearsal`); M3b-site (`...-m3b-site.md`: registro, `obs_archive_policy()` D12, `obs_archive_b2_month_state`, `obs_archive_first_month`, `obs_archive_removed_channel_list`, `obs_archive_owner_pending` e `pendenciasParaTela` E-D2/E-D4, `estado-remocao.ts` e `capacidades.ts` Tarefa 9, `BLOCO_CANAIS_REMOVIDOS`); contrato `.superpowers/sdd/manutencao-nas/contrato-rotas-m3b.md` r2.5 (C8 batimento, C9 desfechos, C12 pendências). Código atual do SQL da M3b: `supabase/rascunhos/m3b.sql` (vira migration na Tarefa 10 da M3b). **Onde o código e o contrato da M3b divergem do spec, valem o código e o contrato** (brief da onda 2).

---

## Global Constraints

- **Next 16:** antes de escrever página, layout, Server Action ou `searchParams`, ler `apps/web/AGENTS.md` e o guia correspondente em `apps/web/node_modules/next/dist/docs/` (App Router: `page`, `searchParams` como `Promise`, `dynamic`). `searchParams` é `Promise` (padrão de `competitors/mudancas/page.tsx:13-16`).
- **`next/link` nunca vai como prop de Server Component para client component;** link dentro de componente client é importado no próprio módulo `'use client'` (padrão de `_chrome/tabs.tsx:3`) ou passa por `src/app/cms/(authed)/_shared/cms-link.tsx`.
- **Server Action não é importada em client component;** vai por prop a partir da página (padrão de `mudancas/page.tsx:19`). Esta etapa não cria ação de escrita (só leitura); a única exceção seria o grupo "Dado de teste", cujo botão é da M6 (D-M5-6).
- **Telas de dados** (`feedback_telas_cor_e_simbolo`): frase-resumo no topo com número, mês e data; régua ou barra por peça; cada estado por cor **e** forma (círculo com visto, círculo pontilhado neutro ou âmbar, triângulo âmbar com "!", octógono vermelho com "!", hachura rosa, caixa de arquivo, caixa vazada com 0); legenda num só lugar ("Como ler as formas"); método só no ⓘ; nenhum bloco só de prosa nem só de uma cor; o que está bem recua (cinza com verde pequeno).
- **Cor:** só tokens já existentes, hex ou `rgba()` literal; **nenhum `color-mix()`** em borda, fundo, texto ou forma (Opera do dono). `--warning-text` para texto âmbar; `--danger` só no símbolo e na borda, texto da linha em `--text`; `--dir-up`, `--dir-dn`, `--forja` e `--border-strong` proibidos em estado (`PLANO-DAS-TELAS.md` §1.2).
- **Vocabulário** (`04` §14, item 38): na tela, fora do ⓘ, nunca "lote", "unidade", "selar", "selado", "selagem", "partição", "cadeia", "atestação", "hash", "ensaio", "restauração", "divergente", "ambiente", "tabela", "linhas", "MB", "toco", "congelado", "congelamento", "estágio", "classe". Exceções declaradas do mockup: "snapshot(s) do NAS", "lido em dd/mm".
- **As três ausências nunca viram zero, vazio nem verde:** "não respondeu" (a casa; triângulo até 36 h, octógono a partir de 36 h, sempre com data e hora do último sinal), "não medido" (hachura rosa com o que não foi lido), "no arquivo" (caixa de arquivo com a data). Toda lista que pode vir vazia tem zero medido (caixa `--im-zero`) e não medido (hachura).
- **Uma data só, lida de uma função:** nenhum arquivo de tela escreve 365, 180 ou data de início de coleta à mão (item 83).
- **Quem vê** (`04` §14): peça 1 todo mundo (o mesmo texto, sem máquina, arquivo nem comando); página Arquivo, bloco, peça 7 e aviso do banco só quem edita (`canEditSite`); "Ver os comandos" e a linha do dono só quem administra (`canAdminSite`, E-D4 da M3b). A leitura de quem só edita passa pelo cliente de serviço **só depois** de `canEditSite(siteId)`; nunca `grant ... to authenticated`.
- **390 e 1440 px, claro e escuro,** alvo de toque 44 px, sem rolagem horizontal, foco visível, Esc fecha e devolve o foco, movimento reduzido, contraste 3:1 em forma e 4,5:1 em texto, escala de cinza com a linha de problema à frente.
- Migration nova só por `npm run db:new manutencao_m5_telas` (Tarefa 13), nunca à mão. Idempotência: `create or replace function`, `drop ... if exists` antes de `create policy/trigger`. Funções novas em `public`: `security definer`, `set search_path = ''`, `revoke all ... from public, anon, authenticated`, `grant execute ... to service_role` (produção já tem `20261014000007`, A5: função nova nasce sem EXECUTE para anon/PUBLIC).
- Todo `db:push:prod` é do dono, precedido de `npx supabase migration list --linked`, e só segue se as pendentes forem exatamente as do dia (`05` §16). Fora de 11:30 a 13:00 UTC e dos minutos 0, 20 e 40.
- Testes com banco: `describe.skipIf(skipIfNoLocalDb())`, banco `bythiago_int` (API 54421, Postgres 54422), `--no-file-parallelism`, rascunho aplicado dentro de `begin … rollback`. Componente: `// @vitest-environment jsdom`; módulo de servidor e sanitizer: `// @vitest-environment node`.
- TypeScript strict, sem `any`, Zod na borda (`.safeParse`, nunca `as`); kebab-case; commits `tipo: descrição`, um por tarefa, por caminho explícito (`git add -- <novos>` e `git commit -- <caminhos>`), no `staging`; nunca `git add -A`, stash ou reset. Mensagem termina com `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. **Este plano não é commitado pelo redator; o controlador commita.**
- **Arquivo que outra trilha está mexendo sem commit:** antes de editar qualquer arquivo de "Modify", `git diff --stat -- <arquivo>`; mudança alheia → não editar, registrar no ledger (`.superpowers/sdd/manutencao-nas/m5-progresso.md`) o arquivo, o autor provável e a hora, e seguir com a tarefa seguinte que não o toque.
- **O sistema falha em VERDE.** Toda tarefa diz o que acontece quando o dado NÃO existe (função ausente, nenhum mês saiu, lista vazia, variável apagada, casa sem batimento) antes do que acontece quando dá erro.
- Variável com padrão: `OBS_ARQUIVO_LIMPEZA_CANAL` (só `on` é "sim"; já tem teste da M3b) e `OBS_ARQUIVO` (só `on` liga). Esta etapa não cria variável nova.
- Sem datas-meta; só relógio real.

## Travas e ordem de execução

- **TRAVA M5-0 (dependências):** a Tarefa 1 só começa com (a) a M3b aplicada em produção e conferida (ledger `.superpowers/sdd/manutencao-nas/m3b-site-progresso.md`, linha "TRAVA M3b-2 solta"); (b) `git ls-files apps/web/test/helpers/m3b.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-remocao.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/pendencias.ts` listando os quatro. Faltando um: registrar a espera no ledger e parar.
- **TRAVA M5-1:** nenhum arquivo `*_manutencao_m5_*` em `supabase/migrations/` antes da Tarefa 13. Até lá o SQL vive em `supabase/rascunhos/m5.sql`, lido pelos testes por `M5_SQL_CAMINHO` (um só lugar: `apps/web/test/helpers/m5.ts`).
- **TRAVA M5-2 (pedido 11):** a Tarefa 4 (troca do teto de 365 dias em `load.ts`, `load-channel.ts` e `series.ts`) só começa com a janela combinada com o controlador da A5 registrada no ledger ("janela pedido 11: <data hora>, combinada com <quem>"). Sem resposta até o dia em que as Tarefas 1 a 3 fecharem, a fase faz a troca assim mesmo (texto do pedido 11, coluna "Se não entrar"): relê os três arquivos no dia, faz a troca num commit só e resolve o conflito no próprio commit.
- **TRAVA M5-3 (liberação):** a parte 4 do rascunho (liberar `serie` e `horaria`) entra na mesma migration das partes 1 a 3, e o código das Tarefas 4 a 11 vai ao `main` **no mesmo push** em que a migration é aplicada (Tarefa 13). Nenhuma saída de mês é possível antes da M6 (as funções de saída nascem lá), então a classe liberada sozinha não tira nada; mas o teste do item 87 segura a ordem: `serie` liberada com `DAILY_MAX_DAYS` ainda no carregador falha.
- Ordem: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16. As Tarefas 7, 8, 10 e 11 são independentes entre si depois da 2 e podem correr em paralelo (agentes Sonnet, um por tarefa, sem tocar o mesmo arquivo).

## Review Focus

1. **A função `obs_archive_online_since` ausente, com erro ou com `{lido:false}` no carregador.** Esperado: a série é lida inteira desde `seriesStart` (o dado fora do banco não está na tabela-mãe, então ler tudo é sempre correto), a frase "Não foi possível ler desde quando há dado online." aparece no lugar do "desde dd/mm", e as medidas que pedem ponto mais velho que a janela mínima garantida (181 dias para `serie`, 90 para `horaria`) saem "não medido"; nada assume 365 dias, nada interpola. Teste na Tarefa 4 (`online desde não lido`).
2. **`viewsAtAge` pedindo idade anterior ao primeiro ponto de um vídeo cortado.** Hoje (`series.ts:75-90`) o laço começa em `earliestIdx` e, se o primeiro ponto já é posterior à idade pedida, interpola entre os dois primeiros pontos, ou seja, extrapola para trás. Esperado: `null` (a tela diz "no arquivo desde dd/mm"). Teste na Tarefa 4 (`14 dias de vídeo cortado`).
3. **Casa sem batimento nenhum (forja nunca instalada) com mês devido.** Esperado: "A casa não respondeu desde <data do último sinal>" ou, sem sinal nunca recebido, "A casa ainda não deu sinal" em triângulo, nunca "Em coleta" nem verde. Teste na Tarefa 7 (`casa sem batimento`).
4. **Nome de canal removido com 100 caracteres, e canal removido pela vigia sem nome nem data.** Esperado: rótulo com reticências e nome inteiro em `title` e `aria-label`; frase de alerta quebra sem cortar; linha da vigia usa o código interno (8 caracteres) e a faixa de meses, nunca "removido em" sem data. Teste na Tarefa 8 (`nome longo` e `linha da vigia`).
5. **Perfil "só lê" chegando à URL da página Arquivo pela barra de endereço.** Esperado: a página responde com "Esta página é de quem edita o site." e "Voltar para Canais", sem ler o registro (nenhuma chamada ao cliente de serviço), e a aba não aparece. Teste na Tarefa 9 (`só lê pela URL`).

---

## Decisões deste plano (para Phil e Yannis; nenhuma muda regra do spec sem dizer)

| # | Decisão | Por quê |
|---|---|---|
| D-M5-1 | **`online desde` não lido: a série é lida inteira e só a rotulagem cai em "não medido".** A janela mínima garantida pela política (`window_months` de `obs_archive_policy()`, 6 meses fechados + o corrente, ≥181 dias para `serie`; 3 meses + o corrente, ≥90 dias para `horaria`) separa o que é seguro mostrar | `02` §10.4 e item 35 pedem "não medido" e proíbem os 365; apagar o Observatório inteiro por um erro de leitura do registro seria falha vermelha desnecessária; o dado fora do banco não está na tabela-mãe, então nada lido é falso |
| D-M5-2 | **`obs_archive_removed_channel_list` ganha versão 2** com `nome` (`name_at_removal`, nulo na linha da vigia e anulado ao concluir), `removido_em` (`removed_at`), `meses`, `primeiro_mes`, `ultimo_mes` também para as remoções com linha (de `units_at_removal`, `first_month`, `last_month`) e `casa` não; contrato `versao: 2`, leitor estrito novo | O mockup aprovado (`arq-dados.js:75-85`) diz "Viagem Lenta, removido em 28/04/2028. Limpeza pedida: 14 meses, de 10/2026 a 11/2027"; a v1 da M3b exclui o nome ("Nunca `name_at_removal`", plano M3b-site, Tarefa 8). O nome de canal do YouTube é público (o dono o vê em qualquer canal: `feedback_visivel_nos_outros_e_publico`); continua fora do `audit_log` e do C12 |
| D-M5-3 | **Uma leitura só para a página: `obs_archive_pagina(p_site) returns jsonb`**, com os meses de `obs_archive_months` (todas as colunas que a régua usa), o progresso de cópia por mês (unidades recebidas sobre esperadas), a última recuperação por (classe, tabela) de `obs_archive_restores`, o batimento dos três programas, `online_since`, `first_month` por classe (lido de `obs_archive_switch`, sem gravar), os meses à frente (`obs_partitions_months_ahead()`) e o estado do grupo de teste. O estado de cada linha é derivado em TS puro (`estado-do-mes.ts`) | Um RPC por página (sem N+1); regra de tela testável sem banco; a função só lê (`stable`), nunca grava `first_month` (diferente de `obs_archive_first_month`, que grava) |
| D-M5-4 | **Libera `serie` e `horaria`; `texto`, `video_antigo` e `ensaio` continuam fechadas.** | Linha M5 do `05` §15.1 ("a classe `serie` fica liberada") e item 87, cuja frase final diz que "a primeira saída real é a da leitura horária": a peça 1 (as 72 horas) e o `competitor_hourly_health` corrigido estão nesta etapa. `texto` é da onda 2 (frase digitada, M6); `video_antigo` é da M10b |
| D-M5-5 | **O aviso do banco: se a tela do mockup 18 da A5 não estiver no `staging` no dia da Tarefa 11, esta fase implementa o `18-v2` inteiro** (que é o 18 aprovado mais a diferença), consumindo `aviso.ts` e `sinal-do-banco.ts` da E10 sem editá-los, e avisa o controlador da A5 no ledger | Hoje nenhum componente desenha o 18 (`grep -rln "Quase cheio" apps/web/src` só acha `sinal-do-banco.ts`); o plano da E10 (linha 8) deixa a tela fora dele; `04` §14.9 ponto 3 manda implementar só a diferença, mas não há base para ela |
| D-M5-6 | **Grupo "Dado de teste" só de leitura nesta etapa; o botão "Encerrar o dado de teste" e a ação são da M6** | O botão só aparece com "a recuperação testada e o descarte de teste feitos" (`04` L199); o descarte nasce na M6; desenhar o botão aqui seria código que nunca renderiza |
| D-M5-7 | **Os espaços do interruptor (peça 4) e de "Vídeos antigos" (peça 8) não vão à produção** como tracejado: o cartão do tipo simplesmente não os tem até a M6 e a M10b | O tracejado "+ novo" é marca do mockup (`PLANO-DAS-TELAS.md` §1.1), não estado de produção |
| D-M5-8 | **Peça 7, parte de leitura:** o bloco "Esperam você rodar os comandos" com a frase-resumo, a barra de idade (0 a 60 dias) e a linha fixa `LINHA_DO_DONO` (só quem administra); sem "Já rodei" (M9) | Plano M3b-site, linhas 3772 e 3805: "a tela: M5; os tempos com passo e 'Já rodei': M9" |
| D-M5-9 | **"Meses à frente acabando"** lê `obs_partitions_months_ahead()` (M2) dentro de `obs_archive_pagina`; tabela não convertida (`months_ahead` nulo) é "não medido", nunca "0 meses" | A frase do `04` L190 depende disso; a M2 já a vigia na agenda |

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `supabase/rascunhos/m5.sql` | rascunho da migration, em 4 partes (`-- M5 PARTE n`) | 1, 2, 3, 12 |
| `apps/web/test/helpers/m5.ts` | caminho do rascunho, `aplicarM5(c, ate?)`, `M5_EM_MIGRATION` | 1, 13 |
| `apps/web/test/integration/manutencao-m5-leitores.test.ts` | integração das funções SQL | 1, 2, 3 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/online-desde.ts` | Zod + leitor do `online desde` por tabela; `janelaMinima` | 4 |
| `apps/web/src/lib/youtube/observatorio/load.ts`, `load-channel.ts`, `series.ts`, `types.ts` | troca do teto de 365 dias (pedido 11) | 4 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/peca1.ts` | frases e formas da peça 1 (puro) | 5 |
| telas de série (`_historico/`, `_canal/`, `_comparar/`, `_outliers/`, comentários de destaque) | consumir a peça 1 | 5 |
| `apps/web/src/lib/youtube/horaria/prova.ts`, `competitor-removal-impact.ts`, `observatorio/medidas/ler.ts` | leitores das séries (`04` §14.1, tabela "Quem lê") | 6 |
| `apps/web/test/manutencao/leitores-das-series.test.ts` | a lista fechada por busca (item 82) e o 365/180 (item 83) | 6 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pagina.ts` | Zod + leitor de `obs_archive_pagina` | 7 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-do-mes.ts` | estado, régua, frase e forma de cada mês e de cada problema (puro) | 7 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/canais-removidos.ts` | leitor v2 + modelo do bloco (puro) e da marca | 8 |
| `apps/web/src/app/cms/(authed)/youtube/competitors/arquivo/page.tsx` | a rota da página | 9 |
| `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo/*` | componentes da página (formas, régua, cartão do tipo, bloco, legenda) e `arquivo.css` | 9 |
| `apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/view-model.ts`, `tabs.tsx` | aba "Arquivo" (só quem edita) | 9 |
| `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/*` (fila) | peça 7, parte de leitura | 10 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/aviso-v2.ts` + `_chrome/aviso-banco/*` | peça 5 (`18-v2`) e as marcas ao lado da pastilha | 11 |
| `apps/web/test/manutencao/vocabulario-das-telas.test.ts` | item 38 | 12 |

---

### Task 0: pré-voo (sem código)

**Files:** nenhum de código. Ledger: `.superpowers/sdd/manutencao-nas/m5-progresso.md` (não rastreado).

- [ ] **Passo 1. Conferir as travas M5-0.** Rodar:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
grep -n "TRAVA M3b-2 solta" .superpowers/sdd/manutencao-nas/m3b-site-progresso.md
git ls-files apps/web/test/helpers/m3b.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-remocao.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/pendencias.ts
ls supabase/migrations | grep _manutencao_m3b_
```

Esperado: a linha do ledger, os quatro arquivos e a migration da M3b. **Dado não existe:** qualquer um ausente → registrar "M5 esperando: <o quê>" no ledger e parar.

- [ ] **Passo 2. Pedido 11.** Mandar ao controlador da A5 (por arquivo `.superpowers/sdd/manutencao-nas/aviso-a5-pedido-11-m5.md`, como os `aviso-a5-*.md` já existentes) o texto: "A fase de manutenção vai trocar o teto de 365 dias pelo `online desde` em `load.ts`, `load-channel.ts` e `series.ts`, num commit só. Até o commit, nenhuma trilha muda `dailyReadFrom`, `dailyCappedFrom` nem `truncated`. Proponho a janela <data hora>." Registrar no ledger a janela combinada (TRAVA M5-2).
- [ ] **Passo 3. Estado da tela do mockup 18.** `grep -rln "Quase cheio\|aviso-banco" apps/web/src/app` . Vazio → D-M5-5 vale (a Tarefa 11 implementa o `18-v2` inteiro); registrar no ledger e avisar o controlador da A5 no mesmo arquivo do Passo 2. Achou → a Tarefa 11 só implementa a diferença sobre o componente achado (anotar o caminho no ledger).
- [ ] **Passo 4. Next 16.** Ler `apps/web/AGENTS.md` e, em `apps/web/node_modules/next/dist/docs/`, os guias de `page.js`, `searchParams`, `dynamic` e Server Components. Anotar no ledger qualquer API que este plano usa e o guia marca como mudada (o plano usa: `export const dynamic = 'force-dynamic'`, `searchParams: Promise<...>`, `metadata`).
- [ ] **Passo 5. Abrir os mockups no Opera do controlador** (não do dono) só para conferência visual: `series.html?e=todos-p1`, `arquivo.html?e=todos-meses`, `arquivo.html?e=todos-canais`, `peca7.html?e=cheia`, `18-v2.html?caso=v2`. Sem commit.

---

### Task 1: rascunho, parte 1: `obs_archive_online_since`

**Files:**
- Create: `supabase/rascunhos/m5.sql`
- Create: `apps/web/test/helpers/m5.ts`
- Create: `apps/web/test/integration/manutencao-m5-leitores.test.ts`

**Interfaces:**
- Consumes: `aplicarM3b`, `escalar`, `q1`, `SITE_TESTE` de `apps/web/test/helpers/m3b.ts`; `obs_archive_months` e `obs_archive_policy()` da M3b.
- Produces: `public.obs_archive_online_since(p_site uuid) returns table (class text, table_name text, online_since date)`; `M5_SQL_CAMINHO`, `M5_EM_MIGRATION`, `aplicarM5(c, ate?)`.

**O que acontece quando o dado não existe:** nenhum mês com `detached_at` ou `dropped_at` → a linha da tabela vem com `online_since` nulo ("nada saiu", a tela não muda). Site sem nenhuma linha no registro → uma linha por tabela da política, todas nulas (nunca zero linhas, que a tela leria como "não medido"). Classe `ensaio` não volta (nenhuma tela a lê: `04` L200).

- [ ] **Passo 1. Teste, falhando.**

```ts
// apps/web/test/integration/manutencao-m5-leitores.test.ts
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { aplicarM3b, q1, SITE_TESTE } from '../helpers/m3b'
import { aplicarM5 } from '../helpers/m5'

const URL_INT = 'postgresql://postgres:postgres@127.0.0.1:54422/postgres'

describe.skipIf(skipIfNoLocalDb())('M5: leitores do registro', () => {
  let c: Client
  beforeEach(async () => { c = new Client({ connectionString: URL_INT }); await c.connect(); await c.query('begin'); await aplicarM3b(c); await aplicarM5(c, 1) })
  afterEach(async () => { await c.query('rollback'); await c.end() })

  const mes = (class_: string, table: string, month: string, extra = '') =>
    c.query(`insert into public.obs_archive_months (site_id, class, table_name, month${extra ? ', ' + extra.split('=')[0] : ''})
             values ($1, $2, $3, $4${extra ? ', ' + extra.split('=')[1] : ''})`, [SITE_TESTE, class_, table, month])

  it('nenhum mês saiu: uma linha por tabela, online_since nulo', async () => {
    const r = await c.query(`select class, table_name, online_since from public.obs_archive_online_since($1) order by 1, 2`, [SITE_TESTE])
    expect(r.rows.map(x => x.table_name)).toEqual(expect.arrayContaining(['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly']))
    expect(r.rows.every(x => x.online_since === null)).toBe(true)
    expect(r.rows.some(x => x.class === 'ensaio')).toBe(false)
  })

  it('mês destacado conta como fora; trazer de volta recua', async () => {
    await mes('serie', 'competitor_video_daily', '2027-04-01', "detached_at=now()")
    const a = await q1(c, `select online_since::text as d from public.obs_archive_online_since($1) where table_name = 'competitor_video_daily'`, [SITE_TESTE])
    expect(a.d).toBe('2027-05-01')
    await c.query(`update public.obs_archive_months set detached_at = null where site_id = $1`, [SITE_TESTE])
    const b = await q1(c, `select online_since as d from public.obs_archive_online_since($1) where table_name = 'competitor_video_daily'`, [SITE_TESTE])
    expect(b.d).toBeNull()
  })

  it('descartado e destacado: vale o mês seguinte ao último fora', async () => {
    await mes('serie', 'competitor_video_daily', '2027-03-01', "dropped_at=now()")
    await mes('serie', 'competitor_video_daily', '2027-04-01', "detached_at=now()")
    const a = await q1(c, `select online_since::text as d from public.obs_archive_online_since($1) where table_name = 'competitor_video_daily'`, [SITE_TESTE])
    expect(a.d).toBe('2027-05-01')
  })

  it('a função é só de service_role', async () => {
    const r = await q1(c, `select has_function_privilege('anon', 'public.obs_archive_online_since(uuid)', 'execute') as anon,
                                 has_function_privilege('authenticated', 'public.obs_archive_online_since(uuid)', 'execute') as auth,
                                 has_function_privilege('service_role', 'public.obs_archive_online_since(uuid)', 'execute') as svc`)
    expect(r).toEqual({ anon: false, auth: false, svc: true })
  })
})
```

- [ ] **Passo 2. Helper.**

```ts
// apps/web/test/helpers/m5.ts
/** Manutenção M5: o SQL vive em supabase/rascunhos/m5.sql até a Tarefa 13 (TRAVA M5-1). Único lugar que a Tarefa 13 muda. */
import type { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { travarDdl } from './m2'

export const M5_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/rascunhos/m5.sql')
export const M5_EM_MIGRATION = false
export type ParteM5 = 1 | 2 | 3 | 4

export function sqlM5Ate(ate?: ParteM5): string {
  const sql = readFileSync(M5_SQL_CAMINHO, 'utf8')
  const partes = [...sql.matchAll(/^-- M5 PARTE (\d+)/gm)].map(m => Number(m[1]))
  const maior = partes.length ? Math.max(...partes) : 0
  if (ate === undefined || ate === maior) { if (ate !== undefined && ate > maior) throw new Error(`parte ${ate} ausente`); return sql }
  if (ate > maior) throw new Error(`parte ${ate} não encontrada no rascunho (a maior é ${maior})`)
  const fim = sql.indexOf(`-- M5 PARTE ${ate + 1}`)
  return sql.slice(0, fim)
}
export async function aplicarM5(c: Client, ate?: ParteM5): Promise<void> { await travarDdl(c); await c.query(sqlM5Ate(ate)) }
```

- [ ] **Passo 3. Rodar e ver falhar.** `HAS_LOCAL_DB=1 npx vitest run apps/web/test/integration/manutencao-m5-leitores.test.ts --no-file-parallelism > /tmp/claude-m5-t1.txt 2>&1; grep -E "FAIL|✓|×" /tmp/claude-m5-t1.txt | head -20`. Esperado: FAIL (`parte 1 não encontrada` ou arquivo ausente).
- [ ] **Passo 4. SQL.**

```sql
-- supabase/rascunhos/m5.sql
-- Manutenção M5: as telas (spec 2026-10-13-fase-manutencao-nas, 04 §14; 02 §10.4). RASCUNHO até a Tarefa 13 do plano M5 (TRAVA M5-1):
-- não mover para supabase/migrations à mão; o dia é o de `npm run db:new manutencao_m5_telas`. Depende da M3b em produção.

-- M5 PARTE 1: online desde (02 §10.4)
-- Por tabela da política (fora o ensaio): o 1º dia do mês seguinte ao último mês com detached_at OU dropped_at. Nada saiu: nulo
-- ("tudo online desde o começo da série"), nunca "sem dado". O mês destacado já conta como fora (a tabela-mãe não o lê).
create or replace function public.obs_archive_online_since(p_site uuid)
returns table (class text, table_name text, online_since date)
language sql stable security definer set search_path = '' as $$
  select p.class, p.table_name,
         (select (max(m.month) + interval '1 month')::date
            from public.obs_archive_months m
           where m.site_id = p_site and m.class = p.class and m.table_name = p.table_name
             and (m.detached_at is not null or m.dropped_at is not null))
    from (select distinct x.class, x.table_name from public.obs_archive_policy() x where x.class <> 'ensaio') p
$$;
revoke all on function public.obs_archive_online_since(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_online_since(uuid) to service_role;
```

- [ ] **Passo 5. Rodar e ver passar** (mesmo comando do Passo 3). Esperado: 4 PASS.
- [ ] **Passo 6. Commit.**

```bash
git add -- supabase/rascunhos/m5.sql apps/web/test/helpers/m5.ts apps/web/test/integration/manutencao-m5-leitores.test.ts
git commit -m "feat: rascunho da M5, parte 1: obs_archive_online_since (manutenção M5, 02 §10.4, item 35)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m5.sql apps/web/test/helpers/m5.ts apps/web/test/integration/manutencao-m5-leitores.test.ts
```

---

### Task 2: rascunho, parte 2: `obs_archive_pagina` (uma leitura para a página)

**Files:**
- Modify: `supabase/rascunhos/m5.sql` (acrescenta `-- M5 PARTE 2`)
- Modify: `apps/web/test/integration/manutencao-m5-leitores.test.ts`

**Interfaces:**
- Consumes: `obs_archive_months`, `obs_archive_units` (colunas `site_id, class, table_name, month, channel_ref, version, received_at, lost_at, purged_at`; conferir no rascunho da M3b, linha 59, antes de escrever), `obs_archive_expected_units(p_site, p_class, p_month)` (M3b, linha 436), `obs_archive_restores`, `obs_archive_heartbeat`, `obs_archive_switch`, `obs_archive_policy()`, `obs_archive_b2_month_state`, `obs_archive_online_since` (Task 1), `obs_partitions_months_ahead()` (M2).
- Produces: `public.obs_archive_pagina(p_site uuid) returns jsonb` com a forma:

```json
{ "versao": 1, "lido_em": "<timestamptz>",
  "casa": [ { "worker": "copiador|respondedor|conferir_b2", "last_poll_at": "...|null", "nas_ok": true, "nas_checked_at": "...", "last_error": "...|null",
              "livre_bytes": {}, "total_bytes": {} } ],
  "classes": [ { "class": "serie", "first_month": "2026-10-01|null", "released": true, "window_months": 6, "seal_margin_days": 28, "wait_days": 7 } ],
  "online_since": [ { "class": "serie", "table_name": "competitor_video_daily", "online_since": "2027-05-01|null" } ],
  "meses": [ { "class", "table_name", "month", "<todas as colunas de obs_archive_months que a régua lê>",
               "unidades_esperadas": 45, "unidades_recebidas": 12, "unidades_perdidas": 0,
               "b2": { "<o jsonb de obs_archive_b2_month_state>" } } ],
  "recuperacao": [ { "class", "table_name", "done_at", "schema_fp", "diff_rows" } ],
  "meses_a_frente": [ { "table_name", "months_ahead": 12, "last_month": "2027-10-01" } ],
  "teste": { "aberto": true, "meses": [ { "month", "sealed_at", "dropped_at", "closed_at" } ] } }
```

**O que acontece quando o dado não existe:** site sem nenhum mês → `meses: []` e `classes` com `first_month` nulo onde a classe nunca foi planejada (a tela diz "A primeira cópia é a de outubro, a partir de dd/mm", calculado de `obs_archive_due_on(date '2026-10-01', seal_margin_days)`, nunca "0 meses"); sem batimento → `casa: []` (a tela diz "A casa ainda não deu sinal", triângulo); tabela não convertida → `months_ahead` nulo (não medido); `teste.aberto` falso sem linha `ensaio` aberta. A função **nunca grava** (é `stable`; `first_month` lido de `obs_archive_switch`, sem chamar `obs_archive_first_month`, que grava).

- [ ] **Passo 1. Testes, falhando** (acrescentar ao arquivo da Task 1, dentro do mesmo `describe`, com `aplicarM5(c)` sem parte):

```ts
it('página: site vazio é zero medido, não erro', async () => {
  const p = (await q1(c, `select public.obs_archive_pagina($1) as p`, [SITE_TESTE])).p as Record<string, unknown>
  expect(p.versao).toBe(1)
  expect(p.meses).toEqual([])
  expect(p.casa).toEqual([])
  expect(Array.isArray(p.classes)).toBe(true)
  expect(typeof p.lido_em).toBe('string')
})
it('página: progresso da cópia conta unidades recebidas sobre esperadas', async () => {
  // semeia um mês fechado com 3 unidades esperadas e 1 recebida, pelo helper da M3b que já semeia unidades (semearUnidades em m3b.ts;
  // conferir o nome exato por grep "export async function semear" apps/web/test/helpers/m3b.ts antes de escrever)
  const p = (await q1(c, `select public.obs_archive_pagina($1) as p`, [SITE_TESTE])).p as { meses: { unidades_esperadas: number; unidades_recebidas: number }[] }
  expect(p.meses[0]).toMatchObject({ unidades_esperadas: 3, unidades_recebidas: 1 })
})
it('página: não grava first_month', async () => {
  await c.query(`select public.obs_archive_pagina($1)`, [SITE_TESTE])
  const n = await q1(c, `select count(*)::int as n from public.obs_archive_switch where site_id = $1`, [SITE_TESTE])
  expect(n.n).toBe(0)
})
it('página: tabela sem conversão dá months_ahead nulo', async () => {
  const p = (await q1(c, `select public.obs_archive_pagina($1) as p`, [SITE_TESTE])).p as { meses_a_frente: { months_ahead: number | null }[] }
  for (const m of p.meses_a_frente) expect(m.months_ahead === null || m.months_ahead >= 0).toBe(true)
})
```

- [ ] **Passo 2. Rodar e ver falhar.** Mesmo comando da Task 1. Esperado: FAIL `function public.obs_archive_pagina(uuid) does not exist`.
- [ ] **Passo 3. SQL** (acrescentar ao rascunho). Antes, `grep -n "create table if not exists public.obs_archive_units" -A 40 supabase/rascunhos/m3b.sql` e usar os nomes de coluna que estão lá; o corpo abaixo usa os nomes do contrato (`received_at`, `lost_at`, `purged_at`, `version`):

```sql
-- M5 PARTE 2: a leitura única da página do Arquivo (04 §14.2). Só lê; nunca grava (first_month vem de obs_archive_switch).
create or replace function public.obs_archive_pagina(p_site uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with cur as (
    select distinct on (u.class, u.table_name, u.month, u.channel_ref) u.*
      from public.obs_archive_units u
     where u.site_id = p_site and u.purged_at is null
     order by u.class, u.table_name, u.month, u.channel_ref, u.version desc
  ), prog as (
    select c.class, c.table_name, c.month, count(*) as esperadas,
           count(*) filter (where c.received_at is not null) as recebidas,
           count(*) filter (where c.lost_at is not null) as perdidas
      from cur c group by 1, 2, 3
  )
  select jsonb_build_object(
    'versao', 1,
    'lido_em', now(),
    'casa', coalesce((select jsonb_agg(jsonb_build_object('worker', h.worker, 'last_poll_at', h.last_poll_at, 'nas_ok', h.nas_ok,
              'nas_checked_at', h.nas_checked_at, 'last_error', h.last_error, 'livre_bytes', h.free_bytes, 'total_bytes', h.total_bytes) order by h.worker)
              from public.obs_archive_heartbeat h where h.site_id = p_site), '[]'::jsonb),
    'classes', (select jsonb_agg(jsonb_build_object('class', k.class, 'first_month', s.first_month, 'released', k.released,
              'window_months', k.window_months, 'seal_margin_days', k.seal_margin_days, 'wait_days', k.wait_days) order by k.class)
              from (select distinct on (p.class) p.class, p.released, p.window_months, p.seal_margin_days, p.wait_days
                      from public.obs_archive_policy() p where p.class not in ('ensaio') order by p.class, p.table_name) k
              left join public.obs_archive_switch s on s.site_id = p_site and s.class = k.class),
    'online_since', (select jsonb_agg(jsonb_build_object('class', o.class, 'table_name', o.table_name, 'online_since', o.online_since))
              from public.obs_archive_online_since(p_site) o),
    'meses', coalesce((select jsonb_agg(to_jsonb(m) - 'site_id' - 'id'
              || jsonb_build_object('unidades_esperadas', coalesce(g.esperadas, 0), 'unidades_recebidas', coalesce(g.recebidas, 0),
                                    'unidades_perdidas', coalesce(g.perdidas, 0),
                                    'b2', public.obs_archive_b2_month_state(p_site, m.class, m.month))
              order by m.class, m.table_name, m.month desc)
              from public.obs_archive_months m
              left join prog g on g.class = m.class and g.table_name = m.table_name and g.month = m.month
             where m.site_id = p_site and m.class <> 'ensaio'), '[]'::jsonb),
    'recuperacao', coalesce((select jsonb_agg(jsonb_build_object('class', r.class, 'table_name', r.table_name, 'done_at', r.done_at,
              'schema_fp', r.schema_fp, 'diff_rows', r.diff_rows))
              from (select distinct on (x.class, x.table_name) x.* from public.obs_archive_restores x where x.site_id = p_site
                     order by x.class, x.table_name, x.done_at desc) r), '[]'::jsonb),
    'meses_a_frente', coalesce((select jsonb_agg(jsonb_build_object('table_name', a.table_name, 'months_ahead', a.months_ahead, 'last_month', a.last_month))
              from public.obs_partitions_months_ahead() a), '[]'::jsonb),
    'teste', jsonb_build_object(
              'aberto', exists (select 1 from public.obs_archive_months t where t.site_id = p_site and t.class = 'ensaio' and t.closed_at is null),
              'meses', coalesce((select jsonb_agg(jsonb_build_object('month', t.month, 'sealed_at', t.sealed_at, 'nas_attested_at', t.nas_attested_at,
                        'b2_attested_at', t.b2_attested_at, 'detached_at', t.detached_at, 'dropped_at', t.dropped_at, 'closed_at', t.closed_at) order by t.month)
                        from public.obs_archive_months t where t.site_id = p_site and t.class = 'ensaio' and t.closed_at is null), '[]'::jsonb),
              'encerrado_em', (select max(t.closed_at) from public.obs_archive_months t where t.site_id = p_site and t.class = 'ensaio'))
  )
$$;
revoke all on function public.obs_archive_pagina(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_pagina(uuid) to service_role;
```

**Conferir antes do commit:** `obs_archive_b2_month_state` e `obs_archive_online_since` são `security definer` com `execute` só de `service_role`; dentro de outra função `security definer` (dona `postgres`) a chamada passa. Se a M3b tiver revogado `execute` também do dono (como em `obs_archive_first_month`), trocar a chamada pelo `select` equivalente e anotar.

- [ ] **Passo 4. Rodar e ver passar.** Esperado: os 8 testes do arquivo PASS. Medir no `bythiago_int` o tempo com o caso cheio do helper da M3b (75 canais, 7 meses): `explain analyze select public.obs_archive_pagina('<site>')`, anotar no ledger; acima de 300 ms, abrir achado para Phil antes de seguir.
- [ ] **Passo 5. Commit** (mesmo formato da Task 1): `feat: rascunho da M5, parte 2: obs_archive_pagina, a leitura única da página do Arquivo (manutenção M5, 04 §14.2)`.

---

### Task 3: rascunho, parte 3: lista de canais removidos v2 e os dois leitores da A5

**Files:**
- Modify: `supabase/rascunhos/m5.sql` (`-- M5 PARTE 3`)
- Modify: `apps/web/test/integration/manutencao-m5-leitores.test.ts`

**Interfaces:**
- Consumes: `obs_archive_removed_channel_list` v1 (`m3b.sql:2547-2586`), `obs_archive_channel_removals`; os corpos instalados de `competitor_hourly_health` (última definição em `supabase/migrations/20261013000002_observatorio_a5_e15_leitura_horaria.sql`; conferir por `grep -ln "function public.competitor_hourly_health" supabase/migrations/* | tail -1`) e `competitor_channel_removal_impact` (`grep -ln "function public.competitor_channel_removal_impact" supabase/migrations/* | tail -1`; a M10a pode tê-la mudado depois: vale a última).
- Produces: `obs_archive_removed_channel_list(p_site)` com `versao: 2` em cada linha e os campos novos `nome`, `removido_em`, `removido_via`, `meses`, `primeiro_mes`, `ultimo_mes`, `registros` para **todas** as linhas (D-M5-2); `competitor_hourly_health.desde` = começo real; `competitor_channel_removal_impact` somando a parcela no arquivo.

**O que acontece quando o dado não existe:** remoção sem `name_at_removal` (vigia, ou já concluída) → `nome` nulo e a tela cai para o código interno; sem `removed_at` → `removido_em` nulo e a tela diz "removido sem aviso, limpeza pedida em dd/mm" (`04` L225); canal sem unidade no arquivo → `meses: 0`, `registros: 0`, e o estado `sem_arquivo` como na v1. `competitor_hourly_health` sem nenhum mês fora → `desde` igual ao de hoje (`min(hour_slot)`); com mês fora → o primeiro mês do registro (`obs_archive_switch.first_month` da classe `horaria`, ou o menor `month` de `obs_archive_months` da tabela), nunca o `min()` cru, que pularia de outubro para novembro.

- [ ] **Passo 1. Testes, falhando:**

```ts
it('lista v2: nome, removido_em e faixa para a remoção com linha', async () => {
  await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, name_at_removal, removed_at, removed_via, archive_decision,
                   decided_at, units_at_removal, first_month, last_month, online_thumbs_known)
                 values ($1, 'aaaaaaaa-0000-0000-0000-000000000001', 'Viagem Lenta', '2028-04-28', 'botao', 'apagar', '2028-04-28', 14, '2026-10-01', '2027-11-01', true)`, [SITE_TESTE])
  const l = (await q1(c, `select public.obs_archive_removed_channel_list($1) as l`, [SITE_TESTE])).l as Record<string, unknown>[]
  expect(l[0]).toMatchObject({ versao: 2, nome: 'Viagem Lenta', primeiro_mes: '2026-10', ultimo_mes: '2027-11', removido_via: 'botao' })
  expect(String(l[0]!.removido_em)).toMatch(/^2028-04-28/)
})
it('lista v2: linha da vigia sem nome nem data, com código', async () => {
  await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known)
                 values ($1, '7f3a91c2-0000-0000-0000-000000000002', 'vigia', 'apagar', now(), false)`, [SITE_TESTE])
  const l = (await q1(c, `select public.obs_archive_removed_channel_list($1) as l`, [SITE_TESTE])).l as Record<string, unknown>[]
  expect(l[0]).toMatchObject({ nome: null, removido_em: null, removido_via: 'vigia' })
})
it('hourly health: com um mês de horária fora, desde não pula para o mês seguinte', async () => {
  // semeia leitura horária em outubro e novembro (helper da M2 garantirParticoesDaDiaria + o equivalente da horária; conferir nome),
  // marca outubro como descartado em obs_archive_months e apaga as linhas de outubro dentro do teste
  const h = await q1(c, `select (public.competitor_hourly_health($1)->>'desde') as d`, [SITE_TESTE])
  expect(String(h.d)).toMatch(/^2026-10/)
})
it('removal impact: as três contagens não caem depois de uma saída', async () => {
  // canal com 10 dias medidos em outubro (resumo do arquivo) e 5 online em novembro; outubro descartado
  const r = await q1(c, `select public.competitor_channel_removal_impact($1, $2) as r`, [SITE_TESTE, 'aaaaaaaa-0000-0000-0000-000000000003'])
  expect((r.r as Record<string, number>).daily_days).toBe(15)
})
```

Os dois últimos testes semeiam pelo helper existente; antes de escrever, `grep -n "^export" apps/web/test/helpers/m2.ts apps/web/test/helpers/m3b.ts` e usar só funções que existem (nunca criar cópia de helper). A assinatura de `competitor_hourly_health` e `competitor_channel_removal_impact` é a da última migration: conferir e ajustar a chamada.

- [ ] **Passo 2. Rodar e ver falhar.**
- [ ] **Passo 3. SQL.** (a) `create or replace function public.obs_archive_removed_channel_list` copiando o corpo de `m3b.sql:2547-2586` e mudando o `jsonb_build_object` final para incluir:

```sql
      'versao', 2,
      'nome', r.name_at_removal, 'removido_em', r.removed_at, 'removido_via', coalesce(r.removed_via, 'sem_registro'),
      'primeiro_mes', to_char(coalesce(a.primeiro, r.first_month), 'YYYY-MM'),
      'ultimo_mes', to_char(coalesce(a.ultimo, r.last_month), 'YYYY-MM'),
      'meses', coalesce(a.meses, r.units_at_removal, 0),
      'registros', coalesce(a.registros, 0),
      'classes', to_jsonb(coalesce(a.classes, '{}'::text[])),
```

no lugar dos cinco campos condicionados a `r.channel_ref is null`; os demais campos ficam iguais. **Nota para Phil:** `meses` passa a valer para toda linha; na linha `pedido` com unidades já marcadas `purged_at` (a M3b filtra o conjunto corrente sem esse filtro: conferir) vale o retrato `units_at_removal`.
(b) `competitor_hourly_health`: `create or replace` partindo do corpo da última migration, trocando a expressão de `desde` por `coalesce((select (s.first_month)::timestamptz from public.obs_archive_switch s where s.site_id = p_site and s.class = 'horaria' and exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = 'horaria' and (m.detached_at is not null or m.dropped_at is not null))), <expressão min(hour_slot) de hoje>)` e acrescentando o campo `online_desde` = `<expressão min(hour_slot) de hoje>`.
(c) `competitor_channel_removal_impact`: `create or replace` partindo do corpo instalado; `early` e `hourly` passam a somar `sum(u.row_count)` das unidades correntes do canal com `obs_archive_months.dropped_at` ou `detached_at` no mesmo (classe, tabela, mês); `daily_days` soma os dias medidos do resumo (`obs_archive_summaries`, campo de dias medidos: conferir o nome em `m3b.sql:184-203`) dos meses fora; e devolve as duas parcelas (`*_online`, `*_arquivo`). Manter as concessões de hoje da função (conferir com `\df+` no `bythiago_int`).
- [ ] **Passo 4. Rodar e ver passar.** Rodar também os testes da A5 que leem as duas funções: `grep -rl "competitor_hourly_health\|competitor_channel_removal_impact" apps/web/test` e rodar esses arquivos com saída em arquivo; só as falhas no contexto.
- [ ] **Passo 5. Commit** `feat: rascunho da M5, parte 3: lista de canais removidos v2 e os leitores das séries (manutenção M5, 04 §14.1 e §14.2, item 82)`.

---

### Task 4: o carregador troca o teto de 365 dias pelo `online desde` (pedido 11, um commit só)

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/online-desde.ts`
- Modify: `apps/web/src/lib/youtube/observatorio/load.ts:113-119, 244, 321, 379, 544-550, 605, 664`
- Modify: `apps/web/src/lib/youtube/observatorio/load-channel.ts:8, 35, 55`
- Modify: `apps/web/src/lib/youtube/observatorio/series.ts:75-90`
- Modify: `apps/web/src/lib/youtube/observatorio/types.ts:47-48, 120-123`
- Test: `apps/web/test/youtube/observatorio/online-desde.test.ts`, `apps/web/test/youtube/observatorio/carregador-online-desde.test.ts`

**Interfaces:**
- Consumes: `obs_archive_online_since` (Task 1), `ObservatoryLoadError` (`load.ts:14`).
- Produces:

```ts
// online-desde.ts
export type TabelaDaSerie = 'competitor_video_daily' | 'competitor_video_early' | 'competitor_video_hourly'
export type OnlineDesde = { lido: true; porTabela: Record<TabelaDaSerie, number | null> } | { lido: false; porque: 'funcao_ausente' | 'erro_do_banco' | 'fora_do_esquema' }
/** Dias online garantidos pela política (window_months fechados + o corrente, contados no dia 1): 181 para a série, 90 para a horária. */
export const JANELA_MINIMA_DIAS: Record<TabelaDaSerie, number>
export function lerOnlineDesdeBruto(bruto: unknown): OnlineDesde
export async function lerOnlineDesde(sb: SupabaseClient, siteId: string): Promise<OnlineDesde>
/** Início (ms, meia-noite SP) a partir do qual há série online garantida: o online desde; não lido, agora menos a janela mínima. */
export function inicioSeguro(o: OnlineDesde, t: TabelaDaSerie, now: number): number | null
```

```ts
// load.ts (assinaturas novas; DAILY_MAX_DAYS sai)
export function dailyReadFrom(seriesStart: number, onlineDesde: number | null): string
export function dailyCappedFrom(seriesStart: number, onlineDesde: number | null): number | null
// LiveRows ganha 'onlineDesde'; Dataset ganha onlineDesde: OnlineDesde
```

**O que acontece quando o dado não existe:** `online_since` nulo para a diária → `dailyReadFrom` = véspera de `seriesStart` (a série inteira, como hoje antes dos 365 dias), `dailyCappedFrom` nulo, nenhum vídeo `truncated`: a tela não muda (item 35). Função ausente (`42883`) ou erro → `{ lido: false }`: lê a série inteira (D-M5-1) e o Dataset leva `onlineDesde.lido = false`; a peça 1 (Task 5) mostra "Não foi possível ler desde quando há dado online." e anula o que precisa de ponto anterior a `inicioSeguro`. Nunca 365.

- [ ] **Passo 1. Testes do leitor, falhando:**

```ts
// apps/web/test/youtube/observatorio/online-desde.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { lerOnlineDesdeBruto, inicioSeguro, JANELA_MINIMA_DIAS } from '@/lib/youtube/observatorio/arquivo-mensal/online-desde'

const linha = (t: string, d: string | null) => ({ class: t === 'competitor_video_hourly' ? 'horaria' : 'serie', table_name: t, online_since: d })
const tudo = (d: string | null) => ['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly'].map(t => linha(t, d))

describe('online desde', () => {
  it('nulo é "nada saiu", lido', () => {
    const o = lerOnlineDesdeBruto(tudo(null))
    expect(o).toEqual({ lido: true, porTabela: { competitor_video_daily: null, competitor_video_early: null, competitor_video_hourly: null } })
  })
  it('data vira meia-noite de São Paulo', () => {
    const o = lerOnlineDesdeBruto(tudo('2027-05-01'))
    expect(o.lido && o.porTabela.competitor_video_daily).toBe(Date.parse('2027-05-01T03:00:00Z'))
  })
  it('faltando uma tabela: fora do esquema, nunca "nada saiu"', () => {
    expect(lerOnlineDesdeBruto(tudo(null).slice(0, 2))).toEqual({ lido: false, porque: 'fora_do_esquema' })
  })
  it('lista vazia (função devolveu nada): fora do esquema', () => {
    expect(lerOnlineDesdeBruto([])).toEqual({ lido: false, porque: 'fora_do_esquema' })
  })
  it('não lido: início seguro é agora menos a janela mínima; nunca 365', () => {
    const now = Date.parse('2027-06-10T15:00:00Z')
    expect(inicioSeguro({ lido: false, porque: 'erro_do_banco' }, 'competitor_video_daily', now)).toBe(now - JANELA_MINIMA_DIAS.competitor_video_daily * 86_400_000)
    expect(JANELA_MINIMA_DIAS).toEqual({ competitor_video_daily: 181, competitor_video_early: 181, competitor_video_hourly: 90 })
  })
  it('lido e nulo: sem início seguro (tudo online)', () => {
    expect(inicioSeguro(lerOnlineDesdeBruto(tudo(null)), 'competitor_video_daily', Date.now())).toBeNull()
  })
})
```

- [ ] **Passo 2. Implementar `online-desde.ts`:**

```ts
// apps/web/src/lib/youtube/observatorio/arquivo-mensal/online-desde.ts
/** Manutenção M5 (02 §10.4, itens 34, 35, 81): desde quando cada série está online. Nulo = nada saiu. Não lido = "não medido", nunca 365 dias. */
import 'server-only'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export type TabelaDaSerie = 'competitor_video_daily' | 'competitor_video_early' | 'competitor_video_hourly'
const TABELAS: readonly TabelaDaSerie[] = ['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly']
export type OnlineDesde = { lido: true; porTabela: Record<TabelaDaSerie, number | null> } | { lido: false; porque: 'funcao_ausente' | 'erro_do_banco' | 'fora_do_esquema' }
export const JANELA_MINIMA_DIAS: Record<TabelaDaSerie, number> = { competitor_video_daily: 181, competitor_video_early: 181, competitor_video_hourly: 90 }
const DIA = 86_400_000
const Linha = z.object({ class: z.string(), table_name: z.string(), online_since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }).strict()

/** 00:00 de São Paulo (UTC−3, sem horário de verão desde 2019) do dia `d`. */
const meiaNoiteSP = (d: string): number => Date.parse(d + 'T03:00:00Z')

export function lerOnlineDesdeBruto(bruto: unknown): OnlineDesde {
  const r = z.array(Linha).safeParse(bruto)
  if (!r.success) return { lido: false, porque: 'fora_do_esquema' }
  const por = new Map(r.data.map(l => [l.table_name, l.online_since]))
  if (!TABELAS.every(t => por.has(t))) return { lido: false, porque: 'fora_do_esquema' }
  const porTabela = Object.fromEntries(TABELAS.map(t => { const d = por.get(t); return [t, d == null ? null : meiaNoiteSP(d)] })) as Record<TabelaDaSerie, number | null>
  return { lido: true, porTabela }
}

export async function lerOnlineDesde(sb: SupabaseClient, siteId: string): Promise<OnlineDesde> {
  const { data, error } = await sb.rpc('obs_archive_online_since', { p_site: siteId })
  if (error) return { lido: false, porque: error.code === '42883' || error.code === 'PGRST202' ? 'funcao_ausente' : 'erro_do_banco' }
  return lerOnlineDesdeBruto(data)
}

export function inicioSeguro(o: OnlineDesde, t: TabelaDaSerie, now: number): number | null {
  return o.lido ? o.porTabela[t] : now - JANELA_MINIMA_DIAS[t] * DIA
}
```

(Se o erro de leitura não for "função ausente", mandar ao Sentry: `Sentry.captureMessage('obs_archive_online_since: ' + error.code, 'error')`, como as rotas da M3b fazem; conferir o import usado em `apps/web/src/app/api/pipeline/archive/*/route.ts`.)

- [ ] **Passo 3. Testes do carregador, falhando** (itens 34, 35, 81; e Review Focus 1 e 2):

```ts
// apps/web/test/youtube/observatorio/carregador-online-desde.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { dailyReadFrom, dailyCappedFrom, rowsToDataset } from '@/lib/youtube/observatorio/load'
import { viewsAtAge, vpdSince } from '@/lib/youtube/observatorio/series'
// fábrica de linhas: a que os testes de load.ts já usam (grep "function rowsBase\|export function linhas" apps/web/test/youtube/observatorio/*.test.ts);
// importar a existente, nunca criar outra

const DIA = 86_400_000
const SS = Date.parse('2026-10-03T03:00:00Z')        // seriesStart (começo da coleta)

describe('carregador com online desde', () => {
  it('nada saiu: lê desde a véspera do começo, nenhum corte', () => {
    expect(dailyReadFrom(SS, null)).toBe('2026-10-02')
    expect(dailyCappedFrom(SS, null)).toBeNull()
  })
  it('online desde depois do começo: lê dali e marca o corte', () => {
    const od = Date.parse('2027-05-01T03:00:00Z')
    expect(dailyReadFrom(SS, od)).toBe('2027-05-01')
    expect(dailyCappedFrom(SS, od)).toBe(od)
  })
  it('item 34: série começando 7 meses depois da publicação → cortada, média só entre pontos reais, 14 dias nulo', () => {
    // vídeo publicado em 2026-10-10; online desde 2027-05-01; pontos diários de 2027-05-01 a 2027-06-10
    const ds = rowsToDataset(/* linhas com onlineDesde lido { daily: 2027-05-01 } e o vídeo acima */ fabrica(), Date.parse('2027-06-10T15:00:00Z'))
    const v = ds.videos.find(x => x.ytId === 'vid-cortado')!
    expect(v.truncated).toBe(true)
    expect(viewsAtAge(ctxDe(ds), v, 14 * DIA, null)).toBeNull()
    const media = vpdSince(ctxDe(ds), v)!
    expect(media).toBeCloseTo((v.series.at(-1)!.views - v.series[0]!.views) / ((v.series.at(-1)!.t - v.series[0]!.t) / DIA), 6)
  })
  it('item 81: mês destacado e não descartado também corta; trazer de volta recua', () => {
    const now = Date.parse('2027-06-10T15:00:00Z')
    const com = rowsToDataset(fabrica({ onlineDesdeDiaria: '2027-05-01' }), now)
    const sem = rowsToDataset(fabrica({ onlineDesdeDiaria: null }), now)
    expect(com.videos.find(x => x.ytId === 'vid-cortado')!.truncated).toBe(true)
    expect(sem.videos.find(x => x.ytId === 'vid-cortado')!.truncated).toBeUndefined()
  })
  it('Review Focus 1: online desde não lido → lê tudo, Dataset diz não lido, nada assume 365', () => {
    const ds = rowsToDataset(fabrica({ onlineDesdeNaoLido: true }), Date.parse('2027-06-10T15:00:00Z'))
    expect(ds.onlineDesde.lido).toBe(false)
    expect(ds.dailyCappedFrom).toBeNull()
  })
  it('Review Focus 2: viewsAtAge antes do primeiro ponto de vídeo cortado é nulo, nunca extrapolado', () => {
    const ds = rowsToDataset(fabrica({ onlineDesdeDiaria: '2027-05-01' }), Date.parse('2027-06-10T15:00:00Z'))
    const v = ds.videos.find(x => x.ytId === 'vid-cortado')!
    expect(viewsAtAge(ctxDe(ds), v, 2 * DIA, null)).toBeNull()
  })
})
```

Antes de escrever, achar a fábrica e o `ctxDe` que os testes atuais de `series.ts` usam (`grep -rln "rowsToDataset(" apps/web/test | head`), estendê-la com os três parâmetros acima **no arquivo dela** (sem cópia) e manter os testes existentes verdes.

- [ ] **Passo 4. Rodar e ver falhar.** `npx vitest run apps/web/test/youtube/observatorio/online-desde.test.ts apps/web/test/youtube/observatorio/carregador-online-desde.test.ts > /tmp/claude-m5-t4.txt 2>&1; grep -E "FAIL|×" /tmp/claude-m5-t4.txt | head -30`.
- [ ] **Passo 5. Implementar a troca, num commit só.**
  - `load.ts`: apagar `DAILY_MAX_DAYS` e o comentário dele (linhas 113-119); novas funções:

```ts
/** First SP date of the daily read: one day before the series start (the day-0 baseline), never before the online start of the series (registro do arquivo). */
export function dailyReadFrom(seriesStart: number, onlineDesde: number | null): string {
  return spDate(onlineDesde == null ? seriesStart - DAY : Math.max(seriesStart - DAY, onlineDesde))
}
/** SP midnight where the online series starts when that cut into the series (a month left the online database); else null. */
export function dailyCappedFrom(seriesStart: number, onlineDesde: number | null): number | null {
  return onlineDesde != null && seriesStart - DAY < onlineDesde ? spDateStart(dailyReadFrom(seriesStart, onlineDesde)) : null
}
```

  - `readSiteLive`/`loadLiveRows`: ler `lerOnlineDesde(sb, siteId)` em paralelo com as leituras de hoje e devolver `onlineDesde` em `LiveRows` (acrescentar `'onlineDesde'` ao `Pick` de `LiveRows` e o campo a `ObservatoryRows`).
  - Os quatro chamadores (`load.ts:244, 605, 664`; `load-channel.ts:35, 55`) passam `od = rows.onlineDesde.lido ? rows.onlineDesde.porTabela.competitor_video_daily : null` no lugar de `now`.
  - `rowsToDataset` copia `onlineDesde` para o `Dataset` (`types.ts:120`: `onlineDesde: OnlineDesde`); o comentário de `truncated` (`types.ts:47`) passa a "The online series starts after the publication (a month of the daily series left the online database, ds.dailyCappedFrom)".
  - `series.ts:75-90`, `viewsAtAge`: depois de calcular `a = earliestIdx(...)`, acrescentar `if (u.truncated && T < pointTime(ctx, u, a)) return null` (nunca extrapolar para trás de um corte).
- [ ] **Passo 6. Rodar e ver passar** os dois arquivos novos **e** toda a pasta `apps/web/test/youtube/observatorio` (saída em arquivo, só falhas no contexto). Falha em teste da A5 que assumia 365: corrigir o teste no mesmo commit (regra anti-regressão), registrando no ledger qual e por quê.
- [ ] **Passo 7. Typecheck.** `npm run typecheck -w apps/web > /tmp/claude-m5-tc.txt 2>&1; tail -5 /tmp/claude-m5-tc.txt`.
- [ ] **Passo 8. Commit único (pedido 11):**

```bash
git add -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/online-desde.ts apps/web/test/youtube/observatorio/online-desde.test.ts apps/web/test/youtube/observatorio/carregador-online-desde.test.ts
git commit -m "feat: carregador lê a série desde o online desde do registro, sem o teto de 365 dias (manutenção M5, pedido 11, itens 34, 35 e 81)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/online-desde.ts apps/web/src/lib/youtube/observatorio/load.ts apps/web/src/lib/youtube/observatorio/load-channel.ts apps/web/src/lib/youtube/observatorio/series.ts apps/web/src/lib/youtube/observatorio/types.ts apps/web/test/youtube/observatorio/online-desde.test.ts apps/web/test/youtube/observatorio/carregador-online-desde.test.ts
```

(Mais os arquivos de teste da A5 corrigidos no Passo 6, por caminho.) Registrar no ledger "pedido 11 feito: <hash>" e avisar o controlador da A5 no arquivo do Task 0, Passo 2.

---

### Task 5: peça 1 nas telas de série ("desde dd/mm", "no arquivo")

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/peca1.ts`
- Test: `apps/web/test/youtube/observatorio/peca1.test.ts`
- Modify (consumidores; a lista exata sai do Passo 1): `_historico/view-model.ts:371` e o componente que mostra "views por idade" e as 72 horas; `_canal/*` (primeiras 72 horas, linha do tempo de 90 dias, barras de 180 dias, normal do canal); comentários de destaque (mockup 20); seletor 6/12 meses (mockup 21, se a tela já existir em código); o componente de eixo do gráfico.
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/formas-arquivo.tsx` (`'use client'` não é preciso: componente puro de SVG; os dois ícones novos, caixa de arquivo e ◐, desenhados como em `m19.css`/`m19.js` do mockup) e as classes de forma em `_chrome/tokens-telas.css` (só acrescentar).

**Interfaces:**
- Consumes: `Dataset.onlineDesde`, `Dataset.dailyCappedFrom`, `ObsVideo.truncated`, `inicioSeguro` (Task 4).
- Produces:

```ts
// peca1.ts (puro; datas formatadas por fmt.ts existente: conferir o nome do formatador dd/mm, grep "export function dm\b\|ddmm" src/lib/youtube/observatorio/fmt.ts)
export type EstadoPeca1 =
  | { k: 'nada_saiu' }
  | { k: 'desde'; desde: number }                                  // "desde dd/mm" junto do número
  | { k: 'no_arquivo'; de: number; ate: number }                   // "dd/mm a dd/mm/aaaa no arquivo" (decisão do dono, M4)
  | { k: 'antes_da_coleta'; coleta: number }                       // "A coleta começou em mm/aaaa"
  | { k: 'sem_registro'; conferidoEm: number }                     // "Sem registro neste mês (conferimos em dd/mm)"
  | { k: 'nao_medido' }                                             // "Não foi possível ler desde quando há dado online."
export function estadoDaIdade(o: { pub: number; idadeDias: number; deMarca: boolean; onlineDesde: number | null; lido: boolean; coleta: number; now: number }): EstadoPeca1
export const IDADES_DE_MARCA: readonly number[]   // [1, 7, 30]: vêm de competitor_video_marks, nunca "no arquivo"
export function frasePeca1(e: EstadoPeca1, quem: 'edita' | 'so_le'): { texto: string; forma: 'nenhuma' | 'arquivo' | 'pontilhado' | 'zero' | 'hachura'; portaVerAntigo: boolean }
export function frase72h(o: { horasNoArquivoDesde: number | null; lido: boolean }): { texto: string; forma: 'arquivo' | 'hachura' } | null
export function fraseNormalDoCanal(o: { n: number; noArquivo: number; minimo: 3; desde: number | null }): string | null
export function frasePeriodo(o: { pedidoDias: number; online: { desde: number; meses: number }; motivo: 'coleta_recente' | 'arquivo' }): string
export function fraseComentarioSemTexto(mesAno: string): string    // "Comentário de mm/aaaa. O texto está no arquivo e não aparece aqui."
```

**O que acontece quando o dado não existe:** `onlineDesde` nulo e lido → `nada_saiu` em toda idade (a tela de hoje, inalterada: teste de instantâneo contra a saída atual); não lido → só as idades cujo ponto é anterior a `inicioSeguro` saem `nao_medido`; idade anterior ao começo da coleta → `antes_da_coleta` (pontilhado), nunca "no arquivo"; 1, 7 e 30 dias nunca saem "no arquivo" (marcas ficam online). Porta "Ver antigo" nunca aparece nesta etapa (a peça 6 é da M7): `portaVerAntigo` é `false` até a M7 e quem só lê vê a frase do trecho (item 85; `04` L39).

- [ ] **Passo 1. Fechar a lista dos consumidores.** `grep -rn "viewsAtAge\|vpdSince\|truncated\|dailyCappedFrom\|72 h\|72h\|primeiras 72" apps/web/src/app/cms/\(authed\)/youtube/competitors apps/web/src/lib/youtube/observatorio/medidas-telas > /tmp/claude-m5-p1.txt`; cada achado vira uma linha do ledger (arquivo, linha, o estado da `04` §14.1 que ele mostra). Leitor sem estado correspondente reprova (`04` L90).
- [ ] **Passo 2. Testes, falhando** (itens 36 e 84; um caso por linha da tabela `04` L71-84):

```ts
// apps/web/test/youtube/observatorio/peca1.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { estadoDaIdade, frasePeca1, frase72h, fraseNormalDoCanal, frasePeriodo, fraseComentarioSemTexto } from '@/lib/youtube/observatorio/arquivo-mensal/peca1'

const D = 86_400_000, sp = (d: string) => Date.parse(d + 'T03:00:00Z')
const base = { pub: sp('2026-10-10'), deMarca: false, onlineDesde: sp('2027-05-01'), lido: true, coleta: sp('2026-10-03'), now: sp('2027-06-10') }

describe('peça 1', () => {
  it('nada saiu: a tela não muda', () => expect(estadoDaIdade({ ...base, onlineDesde: null, idadeDias: 14 })).toEqual({ k: 'nada_saiu' }))
  it('14 dias com o dia 14 no arquivo: no arquivo, nunca número', () => expect(estadoDaIdade({ ...base, idadeDias: 14 }).k).toBe('no_arquivo'))
  it('7 dias vem da marca: nunca no arquivo', () => expect(estadoDaIdade({ ...base, idadeDias: 7, deMarca: true }).k).not.toBe('no_arquivo'))
  it('item 36: no arquivo, sem registro e antes da coleta dão três frases diferentes', () => {
    const a = frasePeca1({ k: 'no_arquivo', de: sp('2026-10-01'), ate: sp('2027-04-30') }, 'edita').texto
    const b = frasePeca1({ k: 'sem_registro', conferidoEm: sp('2027-05-02') }, 'edita').texto
    const c = frasePeca1({ k: 'antes_da_coleta', coleta: sp('2026-10-03') }, 'edita').texto
    expect(new Set([a, b, c]).size).toBe(3)
    expect(a).toBe('01/10 a 30/04/2027 no arquivo')
    expect(b).toBe('Sem registro neste mês (conferimos em 02/05)')
    expect(c).toBe('A coleta começou em 10/2026')
  })
  it('não lido: frase própria, hachura', () => {
    expect(frasePeca1({ k: 'nao_medido' }, 'edita')).toEqual({ texto: 'Não foi possível ler desde quando há dado online.', forma: 'hachura', portaVerAntigo: false })
  })
  it('item 85: quem só lê vê a frase do trecho e nunca a porta', () => {
    expect(frasePeca1({ k: 'no_arquivo', de: sp('2027-08-25'), ate: sp('2027-09-30') }, 'so_le')).toEqual({ texto: '25/08 a 30/09/2027 no arquivo.', forma: 'arquivo', portaVerAntigo: false })
  })
  it('item 84: as 72 horas no arquivo', () => {
    expect(frase72h({ horasNoArquivoDesde: sp('2027-02-01'), lido: true })).toEqual({ texto: 'As 72 primeiras horas deste vídeo estão no arquivo desde 01/02. Não dá para calcular sem as horas.', forma: 'arquivo' })
  })
  it('item 84: normal do canal com menos vídeos, e abaixo do mínimo', () => {
    expect(fraseNormalDoCanal({ n: 9, noArquivo: 4, minimo: 3, desde: null })).toBe('Calculado com 9 vídeos; 4 estão no arquivo.')
    expect(fraseNormalDoCanal({ n: 2, noArquivo: 7, minimo: 3, desde: sp('2027-03-01') })).toBe('não medido: desde 01/03 só há 2 vídeos com as 72 horas online')
  })
  it('item 84: período maior que o online, com o motivo', () => {
    expect(frasePeriodo({ pedidoDias: 365, online: { desde: sp('2027-03-01'), meses: 3 }, motivo: 'arquivo' })).toBe('Mostrando desde 01/03 (3 meses online). Os meses anteriores estão no arquivo')
  })
  it('item 84: comentário em destaque sem texto', () => {
    expect(fraseComentarioSemTexto('03/2027')).toBe('Comentário de 03/2027. O texto está no arquivo e não aparece aqui.')
  })
})
```

**Atenção:** as frases acima são as do `04` §14.1 com as decisões M4 do dono; antes de fixar cada uma, conferir com `series.js` do mockup 19 (`grep -n "no arquivo\|desde\|coleta começou" docs/superpowers/mockups/2026-10-14-manutencao-nas/19-mes-fora-do-banco/series.js`). **O mockup vale**: diferença de palavra → usar a do mockup e anotar no ledger.

- [ ] **Passo 3. Rodar e ver falhar.**
- [ ] **Passo 4. Implementar `peca1.ts`** como função pura sobre os campos acima (sem `Date.now()` dentro; `now` vem do Dataset). A regra de `estadoDaIdade`: `deMarca` → `nada_saiu`; `pub + idade*D < coleta` → `antes_da_coleta`; `!lido` e `pub + idade*D < inicioSeguro` → `nao_medido`; `onlineDesde != null && pub + idade*D < onlineDesde` → `no_arquivo` com `de` = início do mês do ponto e `ate` = véspera de `onlineDesde`; senão, com `onlineDesde` posterior a `pub`, `desde`; senão `nada_saiu`.
- [ ] **Passo 5. Ligar nas telas.** Para cada linha do ledger do Passo 1: o view-model chama `estadoDaIdade`/`frase*` e o componente desenha a forma pelo `formas-arquivo.tsx`; o eixo do gráfico ganha o trecho "no arquivo" com preenchimento `--sunk`, contorno sólido `--dim` e o rótulo repetido na borda esquerda (mockup `series.js`, `.m-seg.arq`, largura `max(120px,22%)`; a 390 px o rótulo em linha própria). Selo "ajuste de mockup aprovado" não vai à produção (é marca do mockup).
- [ ] **Passo 6. Teste de componente** (jsdom) para o eixo: com `no_arquivo`, o SVG tem um `<rect>` com a classe da forma `arquivo` e um `<text>` com "no arquivo"; com `nada_saiu`, nenhum dos dois (`apps/web/test/youtube/observatorio/eixo-arquivo.test.tsx`, `// @vitest-environment jsdom`).
- [ ] **Passo 7. Rodar, typecheck, commit** `feat: peça 1 nas telas de série: desde dd/mm e no arquivo, sem número interpolado (manutenção M5, 04 §14.1, itens 36, 84 e 85)`, por caminho.

---

### Task 6: os outros leitores das séries, a lista fechada e o teste dos 180 dias

**Files:**
- Modify: `apps/web/src/lib/youtube/horaria/prova.ts` (campo `online_desde` novo; `desde` passa a ser o começo real, Task 3)
- Modify: `apps/web/src/lib/youtube/competitor-removal-impact.ts` (as duas parcelas, Task 3)
- Modify: `apps/web/src/lib/youtube/observatorio/medidas/ler.ts:219-253` (`lerSeriesDoCanal` com `desde` anterior ao `online desde`: devolve também `cortadoEm`)
- Create: `apps/web/test/manutencao/leitores-das-series.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4.
- Produces: `export const LEITORES_DAS_SERIES: readonly { arquivo: string; comoTrata: 'janela_por_construcao' | 'registro' | 'texto_online_desde' }[]` em `apps/web/src/lib/youtube/observatorio/arquivo-mensal/leitores-das-series.ts`.

**O que acontece quando o dado não existe:** leitor novo de `competitor_video_daily|early|hourly` sem linha na lista → o teste falha com o caminho do arquivo (a lista é fechada por busca, item 82). `online_desde` ausente na resposta de `competitor_hourly_health` (função antiga, antes da migration) → `prova.ts` lê `null` e o vigia diz "não medido", nunca "verde".

- [ ] **Passo 1. Teste, falhando:**

```ts
// apps/web/test/manutencao/leitores-das-series.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { LEITORES_DAS_SERIES } from '@/lib/youtube/observatorio/arquivo-mensal/leitores-das-series'

const RAIZ = resolve(__dirname, '../../../..')
const achar = (padrao: string, dirs: string[]): string[] =>
  execFileSync('git', ['grep', '-l', '-E', padrao, '--', ...dirs], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter(Boolean)

describe('quem lê as três séries (04 §14.1, item 82)', () => {
  it('todo arquivo que lê uma das três séries está na lista', () => {
    const achados = achar("competitor_video_(daily|early|hourly)'|from\\('competitor_video_(daily|early|hourly)", ['apps/web/src'])
    const lista = new Set(LEITORES_DAS_SERIES.map(l => l.arquivo))
    expect(achados.filter(a => !lista.has(a) && !/\/(gravar|competitor-sync|leitura-horaria)\.ts$/.test(a))).toEqual([])
  })
})
describe('janelas de 180 dias (item 83)', () => {
  it('nenhum arquivo de tela escreve 365, 180 ou data de início de coleta', () => {
    const telas = achar('\\b(365|180)\\b|2026-10-0[1-3]', ['apps/web/src/app/cms/(authed)/youtube/competitors', 'apps/web/src/lib/youtube/observatorio/medidas-telas'])
    expect(telas).toEqual([])
  })
  it('as telas de 180 dias falham se a janela online for menor que 181 dias', async () => {
    const { JANELA_MINIMA_DIAS } = await import('@/lib/youtube/observatorio/arquivo-mensal/online-desde')
    expect(JANELA_MINIMA_DIAS.competitor_video_daily).toBeGreaterThanOrEqual(181)
    const pol = readFileSync(resolve(RAIZ, 'supabase/rascunhos/m3b.sql'), 'utf8')   // na Tarefa 13 passa a ler a migration
    expect(pol).toMatch(/\('serie', 'competitor_video_daily', 'particao', 6,/)
  })
})
```

Os achados de hoje do item 83 (por exemplo `insights.ts:204-217`, "a janela de 91–180 dias") **estão fora** do diretório de telas e são regra de engenho, não data de início; se a busca do primeiro `it` do item 83 achar algo em tela, o achado é corrigido (lido de `JANELA_MINIMA_DIAS` ou da constante já existente) e anotado no ledger, nunca posto numa lista de exceção sem a revisão de Yannis.

- [ ] **Passo 2. Rodar e ver falhar** (a lista ainda não existe).
- [ ] **Passo 3. Escrever `leitores-das-series.ts`** com uma linha por arquivo achado pelo `git grep` do teste, cada uma com `comoTrata` e um comentário de uma linha dizendo o que passa a dizer depois de uma saída (as três linhas da `04` L92-96 mais as que a busca achar, entre elas `medidas/ler.ts`, `competitor-health.ts`, `observatorio/load.ts`, `load-channel.ts`).
- [ ] **Passo 4. Ajustar os três leitores** (prova, impacto, medidas) com teste próprio cada um, no arquivo de teste que já os cobre (`grep -rl "prova\|removal-impact\|lerSeriesDoCanal" apps/web/test`): (a) `prova.ts` lê `online_desde` e mantém `desde` como o começo real; com um mês de horária fora, `desde` não pula de outubro para novembro; (b) `competitor-removal-impact.ts` devolve as duas parcelas e o diálogo de remover (da M3b) soma; nenhuma das três contagens cai depois de uma saída; (c) `lerSeriesDoCanal` com `desde` anterior ao `online desde` devolve `cortadoEm` e quem consome (M10 e medidas) diz "desde dd/mm".
- [ ] **Passo 5. Rodar, typecheck, commit** `feat: leitores das séries respeitam o online desde, lista fechada e janelas de 180 dias (manutenção M5, itens 82 e 83)`.

---

### Task 7: o estado de cada mês e de cada problema (puro) e o leitor da página

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pagina.ts` (Zod + leitor de `obs_archive_pagina`)
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-do-mes.ts`
- Test: `apps/web/test/youtube/observatorio/arquivo-estado-do-mes.test.ts`

**Interfaces:**
- Consumes: forma da Task 2; `obs_archive_b2_month_state` (forma em `m3b.sql:1912-1925`).
- Produces:

```ts
// estado-do-mes.ts
export type Forma = 'visto' | 'pontilhado' | 'pontilhado_ambar' | 'triangulo' | 'octogono' | 'hachura' | 'arquivo' | 'zero' | 'barra'
export type Etapa = { rotulo: string; curto: string; forma: Forma }
export type Gravidade = 'nenhuma' | 'ambar' | 'vermelho' | 'nao_medido'
export interface LinhaDoMes { chave: string; mesNome: string; regua: Etapa[] /* 5, ou 2 depois de "pode sair" */; frase: string; secundaria: string | null
  gravidade: Gravidade; sobeAoTopo: boolean; acaoFutura: null | 'sair' | 'liberar' | 'trazer' | 'comando' /* botões: M6; aqui só a frase */ }
export interface CartaoDoTipo { tipo: 'horaria' | 'serie' | 'texto'; titulo: string; resumo: string; linhas: LinhaDoMes[]; anosNoArquivo: { ano: number; meses: number; todosConferidos: boolean }[] }
export interface Casa { estado: 'responde' | 'nao_respondeu' | 'nunca_deu_sinal' | 'nas_fora' | 'nas_cheio'; desde: number | null; forma: Forma }
export interface ModeloPagina { resumo: { texto: string; forma: Forma }; casa: Casa; tipos: CartaoDoTipo[]; teste: null | { faixa: string; linhas: LinhaDoMes[]; encerradoEm: number | null }; ligado: boolean }
export function montarPagina(p: PaginaLida, o: { agora: number; arquivoLigado: boolean }): ModeloPagina
export function casaDe(batimentos: PaginaLida['casa'], agora: number): Casa
```

**Regras (de `04` §14.2 e do mockup `arq-dados.js`; o mockup manda nas palavras):**
- Ordem dentro do tipo: a linha que precisa do dono no topo (única com contorno de cor); logo depois o mês que já saiu das telas (`11.7` do Logan: "Liberar o espaço devolve cerca de N% do banco."); depois "Pode sair"; depois os online do mais novo ao mais velho; meses no arquivo agrupados por ano numa linha.
- Etapas: NAS (visto com verificação < 24 h; triângulo "Cópia sem verificação há N horas" acima; pontilhado sem atestação); B2 (visto com forja < 7 dias ou você < 35; triângulo quando só resta a sua; triângulo a 6 dias da forja, 2 no mês que pode sair em 7; octógono sem nenhuma válida; a origem só no texto); Recuperação (visto com `obs_archive_restores` < 180 dias e `schema_fp` igual ao atual; senão "Refaça o teste de recuperação…"; triângulo 30 dias antes de vencer); Prazo (pontilhado até `due_on + window`); Pode sair.
- Casa (`casaDe`): sem nenhum batimento → `nunca_deu_sinal` (triângulo, "A casa ainda não deu sinal"); `last_poll_at` há mais de 36 h → octógono; entre o prazo de batimento e 36 h → triângulo (o prazo do batimento é o do contrato C8; conferir `grep -n "36\|prazo" .superpowers/sdd/manutencao-nas/contrato-rotas-m3b.md` e usar a constante já exportada pela M3b se houver); `nas_ok` falso com `last_error` `nas_cheio` → `nas_cheio`; falso com outro → `nas_fora`.
- `arquivoLigado` falso (`OBS_ARQUIVO !== 'on'`) → toda a página é a frase "O arquivo está desligado neste site: nada está sendo copiado nem tirado", forma pontilhada neutra, e nenhum mês.
- Meses à frente: menos de 6 → âmbar, menos de 3 → vermelho; nulo → hachura "não medido".

**O que acontece quando o dado não existe:** leitura falhou ou fora do esquema → `ModeloPagina` não existe: o leitor devolve `{ ok: false }` e a página mostra só "Não foi possível ler o estado do arquivo" em hachura (nunca lista vazia, nunca "nada precisa de você"); mês sem `sealed_at` com unidades devidas e zero recebidas há mais de 5 dias → "Cópia atrasada há N dias" (âmbar acima de 5, vermelho acima de 30); nenhum mês e `first_month` nulo → resumo "A primeira cópia é a de outubro, a partir de dd/mm" com o pontilhado, nunca "0 meses".

- [ ] **Passo 1. Testes, falhando:** um `it` por estado das duas tabelas da `04` L145-192 (item 39: "cada estado de problema da peça 2 tem frase e forma próprias; nenhum cai em 'ok' nem em linha vazia"), escritos como tabela:

```ts
// apps/web/test/youtube/observatorio/arquivo-estado-do-mes.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { montarPagina, casaDe } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { paginaVazia, mesCom, AGORA } from './fixtures/arquivo-pagina'   // fixture nova, Passo 2

// [nome do estado (04), mês semeado, frase que começa assim, forma da etapa que manda, gravidade]
const CASOS: [string, ReturnType<typeof mesCom>, string, string, string][] = [
  ['No ar', mesCom({ mes: 'corrente' }), 'Em coleta', 'pontilhado', 'nenhuma'],
  ['Aguardando a margem', mesCom({ mes: 'fechado_ha', dias: 10 }), 'Fechado. Cópia a partir de', 'pontilhado', 'nenhuma'],
  ['Copiando', mesCom({ esperadas: 45, recebidas: 12 }), 'Copiando: 12 de 45 canais', 'barra', 'nenhuma'],
  ['No NAS', mesCom({ nasHorasAtras: 3 }), 'No NAS, verificado hoje às', 'visto', 'nenhuma'],
  ['No B2 pela forja', mesCom({ nasHorasAtras: 3, b2Forja: 1 }), 'No B2, conferido pela forja', 'visto', 'nenhuma'],
  ['Só a sua vale', mesCom({ nasHorasAtras: 3, b2Forja: 9, b2Dono: 20 }), 'No B2, conferido por você em', 'triangulo', 'ambar'],
  ['B2 sem nenhuma válida', mesCom({ nasHorasAtras: 3, b2Forja: 9, b2Dono: 40 }), 'A forja não confere o B2 há 9 dias. Nada sai deste mês', 'octogono', 'vermelho'],
  ['Atrasado 6 dias', mesCom({ devidoHa: 6, recebidas: 0 }), 'Cópia atrasada há 6 dias', 'triangulo', 'ambar'],
  ['Atrasado 31 dias', mesCom({ devidoHa: 31, recebidas: 0 }), 'Cópia atrasada há 31 dias', 'octogono', 'vermelho'],
  ['Verificação vencida', mesCom({ nasHorasAtras: 30 }), 'Cópia sem verificação há 30 horas', 'triangulo', 'ambar'],
  ['Tentativa falhou', mesCom({ b2Tentativa: 'arquivo_ausente' }), 'Última tentativa de conferir o B2', 'octogono', 'vermelho'],
  ['Sem chave', mesCom({ b2Forja: 2, b2Tentativa: 'chave_ausente' }), 'não pôde ser feita: falta a chave', 'triangulo', 'ambar'],
  ['Forja e Mac discordam', mesCom({ b2Divergiu: true }), 'A forja disse que o arquivo de', 'octogono', 'vermelho'],
  ['Arquivo não bate', mesCom({ conteudoDivergente: true }), 'está diferente do que o site guardou', 'octogono', 'vermelho'],
  ['Voltou a não selado', mesCom({ unsealed: 'conteudo_mudou' }), 'O dado deste mês mudou depois da cópia', 'pontilhado', 'nenhuma'],
  ['Recuperação vencida', mesCom({ recuperacaoHa: 200 }), 'Refaça o teste de recuperação: o último é de', 'triangulo', 'ambar'],
  ['Recuperação vence em 30 dias', mesCom({ recuperacaoHa: 151 }), 'O teste de recuperação de', 'triangulo', 'ambar'],
  ['Sem registro', mesCom({ vazioConferido: true }), 'Sem registro neste mês (conferimos em', 'zero', 'nenhuma'],
  ['Destacado', mesCom({ destacadoHa: 2 }), 'Saiu das telas em', 'pontilhado', 'nenhuma'],
  ['Destacado 15 dias', mesCom({ destacadoHa: 15 }), 'Saiu das telas há 15 dias', 'triangulo', 'ambar'],
  ['No arquivo', mesCom({ descartadoHa: 30, nasHorasAtras: 5 }), 'No arquivo desde', 'arquivo', 'nenhuma'],
  ['No arquivo sem verificação 22 dias', mesCom({ descartadoHa: 60, nasHorasAtras: 22 * 24 }), 'No arquivo. Sem verificação há 22 dias', 'triangulo', 'ambar'],
  ['No arquivo sem verificação 46 dias', mesCom({ descartadoHa: 90, nasHorasAtras: 46 * 24 }), 'No arquivo. Sem verificação há 46 dias', 'octogono', 'vermelho'],
]

describe('peça 2: o caminho de cada mês (item 39)', () => {
  it.each(CASOS)('%s', (_n, mes, comeco, forma, grav) => {
    const p = montarPagina(paginaVazia({ meses: [mes] }), { agora: AGORA, arquivoLigado: true })
    const l = p.tipos.flatMap(t => t.linhas)[0]!
    expect(l.frase.startsWith(comeco)).toBe(true)
    expect(l.regua.some(e => e.forma === forma) || (forma === 'arquivo' && l.regua[0]?.forma === 'arquivo')).toBe(true)
    expect(l.gravidade).toBe(grav)
    expect(l.frase.trim().length).toBeGreaterThan(0)
  })
  it('a linha que precisa do dono sobe e é a única com gravidade', () => {
    const p = montarPagina(paginaVazia({ meses: [mesCom({ nasHorasAtras: 3 }), mesCom({ devidoHa: 31, recebidas: 0, mesNum: 2 })] }), { agora: AGORA, arquivoLigado: true })
    expect(p.tipos[0]!.linhas[0]!.gravidade).toBe('vermelho')
  })
  it('as três ausências têm formas diferentes', () => {
    const nr = casaDe([], AGORA).forma, nm = 'hachura', arq = 'arquivo'
    expect(new Set([nr, nm, arq]).size).toBe(3)
  })
  it('Review Focus 3: casa sem batimento com mês devido nunca é "Em coleta" nem verde', () => {
    const p = montarPagina(paginaVazia({ casa: [], meses: [mesCom({ devidoHa: 2, recebidas: 0 })] }), { agora: AGORA, arquivoLigado: true })
    expect(p.casa.estado).toBe('nunca_deu_sinal')
    expect(p.resumo.texto).toMatch(/A casa ainda não deu sinal/)
  })
  it('arquivo desligado: uma frase só', () => {
    const p = montarPagina(paginaVazia({ meses: [mesCom({ nasHorasAtras: 3 })] }), { agora: AGORA, arquivoLigado: false })
    expect(p.tipos).toEqual([])
    expect(p.resumo.texto).toBe('O arquivo está desligado neste site: nada está sendo copiado nem tirado')
  })
  it('site sem nenhum mês: primeira cópia, nunca "0 meses"', () => {
    const p = montarPagina(paginaVazia({}), { agora: AGORA, arquivoLigado: true })
    expect(p.resumo.texto).not.toMatch(/\b0 meses\b/)
  })
})
```

- [ ] **Passo 2. A fixture** `apps/web/test/youtube/observatorio/fixtures/arquivo-pagina.ts` com `paginaVazia(over)` (forma da Task 2 com `versao: 1`, `lido_em`, um batimento de cada programa há 1 h, classes `horaria`, `serie`, `texto` com `first_month: '2026-10-01'`) e `mesCom(o)` que monta uma linha de `meses` coerente (o mês fechado mais recente por padrão; `AGORA = Date.parse('2028-05-03T15:00:00Z')`, o caso cheio do mockup).
- [ ] **Passo 3. Rodar e ver falhar.**
- [ ] **Passo 4. Implementar `pagina.ts`** (Zod `.strict()` sobre a forma da Task 2; `{ ok: false, porque }` fora do esquema, com `Sentry.captureMessage('obs_archive_pagina fora do esquema', 'error')`) e **`estado-do-mes.ts`** com as regras acima. As frases são copiadas de `arq-dados.js` (MES, PROB e PAG) trocando os números de exemplo por parâmetros; um comentário por frase com a linha de origem (`arq-dados.js:NN`).
- [ ] **Passo 5. Rodar e ver passar; typecheck; commit** `feat: estado de cada mês da página do Arquivo, puro, e o leitor da página (manutenção M5, 04 §14.2, item 39)`.

---

### Task 8: o bloco "Canais removidos" só de leitura e a marca ao lado da pastilha

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/canais-removidos.ts`
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts` (`BLOCO_CANAIS_REMOVIDOS = true`, no mesmo commit do componente da Task 9: ver Passo 6)
- Test: `apps/web/test/youtube/observatorio/arquivo-canais-removidos.test.ts`

**Interfaces:**
- Consumes: `corDaRemocao`, `IDADE`, `EstadoRemocao` (`estado-remocao.ts`, M3b Tarefa 9); `lerCapacidades` (`capacidades.ts`); lista v2 (Task 3); `Casa` (Task 7).
- Produces:

```ts
export interface LinhaCanalRemovido { channelRef: string; codigo: string /* 8 primeiros, maiúsculos */; rotulo: string; regua: Etapa[] /* 4 */; frase: string
  forma: Forma; gravidade: Gravidade; noTopo: boolean; blob: null | { frase: string; forma: Forma } }
export interface BlocoCanaisRemovidos { resumo: string; acimaDosTipos: boolean; linhas: LinhaCanalRemovido[]; jaLimpos: { n: number; ultimoEm: number | null } }
export type LeituraBloco = { ok: true; bloco: BlocoCanaisRemovidos } | { ok: false }
export function montarBloco(lista: ListaRemovidosV2, o: { agora: number; casa: Casa; cap: Capacidades }): BlocoCanaisRemovidos
export function marcaAoLadoDaPastilha(lista: ListaRemovidosV2, o: { agora: number; casa: Casa; cap: Capacidades }): null | { n: number; forma: 'arquivo' | 'triangulo' | 'octogono' }
export async function lerCanaisRemovidos(sb: SupabaseClient, siteId: string): Promise<{ ok: true; lista: ListaRemovidosV2 } | { ok: false }>
```

**Regras (`04` §14.2 L202-245, item 163 parte M5; frases de `arq-dados.js:75-95`):** sem o comando de limpeza (`cap.comandoDeLimpeza` falso, o caso da M5 até a M9), toda remoção `pedido` diz "Limpeza pedida. Espera o comando, que <chega em dd/mm | ainda não tem data para chegar>." sem cor de atraso em idade nenhuma, o resumo é "Canais removidos: N esperam o comando de limpeza, que <…>.", **a marca ao lado da pastilha não existe** (`null`) e "ver os comandos" e "Apagar do arquivo" não são desenhados (M9). `sem_destino` vermelho com o octógono, no topo, frase com o código e a faixa de meses, nunca nome nem "removido em". `guardado` cinza com a caixa de arquivo. `sem_arquivo` com `blobs_pendentes > 0` fica à vista só com a linha das imagens (cinza, pontilhado, em qualquer idade sem o comando); com 0, entra em "Já limpos (N)". Casa sem responder → triângulo "Espera a casa, que não responde desde dd/mm. Nada a fazer agora." sem vermelho por idade. Nunca "apagado" antes de `nas_absent_at`/`b2_absent_at`.

**O que acontece quando o dado não existe:** lista vazia lida → "Nenhum canal removido pede limpeza." na caixa de zero medido, e "Já limpos (0)"; leitura falhou → `{ ok: false }` e a tela diz "Não foi possível ler os canais removidos." em hachura, nunca lista vazia; nome nulo → código interno; `removido_em` nulo com `decided_at` → "removido sem aviso, limpeza pedida em dd/mm".

- [ ] **Passo 1. Testes, falhando** (um por linha da tabela `04` L206-237 que a M5 desenha, e os casos do item 163 que são da M5):

```ts
// apps/web/test/youtube/observatorio/arquivo-canais-removidos.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { montarBloco, marcaAoLadoDaPastilha } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'

const AGORA = Date.parse('2028-05-03T15:00:00Z'), D = 86_400_000
const casa = { estado: 'responde', desde: null, forma: 'visto' } as const
const semCmd = { comandoDeLimpeza: false, blocoCanaisRemovidos: true, dataDoComando: null }
const comCmd = { comandoDeLimpeza: true, blocoCanaisRemovidos: true, dataDoComando: null }
const linha = (o: Record<string, unknown>) => ({ versao: 2, channel_ref: 'aaaaaaaa-1111-2222-3333-444444444444', estado: 'pedido', decided_at: new Date(AGORA - 5 * D).toISOString(),
  nas_absent_at: null, b2_absent_at: null, snapshots_clear_on: null, reappeared_at: null, reappeared_count: 0, online_thumbs_known: true, thumbs_unknown_ack_at: null,
  blobs_pendentes: 0, youtube_channel_id: 'UCx', nome: 'Viagem Lenta', removido_em: new Date(AGORA - 5 * D).toISOString(), removido_via: 'botao',
  primeiro_mes: '2026-10', ultimo_mes: '2027-11', meses: 14, registros: 118402, classes: ['serie'], ...o })

describe('bloco Canais removidos, só de leitura (item 163, parte M5)', () => {
  it('sem o comando: limpeza pedida espera o comando, sem cor aos 30 nem aos 60 dias', () => {
    for (const dias of [29, 30, 60, 90]) {
      const b = montarBloco([linha({ decided_at: new Date(AGORA - dias * D).toISOString() })], { agora: AGORA, casa, cap: semCmd })
      expect(b.linhas[0]!.gravidade).toBe('nenhuma')
      expect(b.linhas[0]!.frase).toMatch(/Espera o comando, que ainda não tem data para chegar\./)
    }
  })
  it('sem o comando: a marca ao lado da pastilha não existe', () => {
    expect(marcaAoLadoDaPastilha([linha({})], { agora: AGORA, casa, cap: semCmd })).toBeNull()
  })
  it('com o comando: a marca conta pedido e apagado_nas, muda aos 30 e aos 60', () => {
    expect(marcaAoLadoDaPastilha([linha({ decided_at: new Date(AGORA - 29 * D).toISOString() })], { agora: AGORA, casa, cap: comCmd })).toEqual({ n: 1, forma: 'arquivo' })
    expect(marcaAoLadoDaPastilha([linha({ decided_at: new Date(AGORA - 30 * D).toISOString() })], { agora: AGORA, casa, cap: comCmd })!.forma).toBe('triangulo')
    expect(marcaAoLadoDaPastilha([linha({ decided_at: new Date(AGORA - 60 * D).toISOString() })], { agora: AGORA, casa, cap: comCmd })!.forma).toBe('octogono')
  })
  it('sem_destino: vermelho, no topo, código e faixa, nunca nome nem "removido em"', () => {
    const b = montarBloco([linha({ estado: 'sem_destino', nome: null, removido_em: null, removido_via: 'sem_registro', meses: 9, primeiro_mes: '2026-10', ultimo_mes: '2027-06' })], { agora: AGORA, casa, cap: semCmd })
    expect(b.linhas[0]).toMatchObject({ gravidade: 'vermelho', forma: 'octogono', noTopo: true })
    expect(b.linhas[0]!.frase).toContain('código interno: AAAAAAAA')
    expect(b.linhas[0]!.frase).toContain('Há 9 meses no arquivo, de 10/2026 a 06/2027.')
    expect(b.linhas[0]!.frase).not.toMatch(/removido em/)
  })
  it('linha da vigia sem nome e sem data: "removido sem aviso, limpeza pedida em dd/mm"', () => {
    const b = montarBloco([linha({ nome: null, removido_em: null, removido_via: 'vigia' })], { agora: AGORA, casa, cap: semCmd })
    expect(b.linhas[0]!.frase).toMatch(/^AAAAAAAA, removido sem aviso, limpeza pedida em \d\d\/\d\d/)
  })
  it('Review Focus 4: nome de 100 caracteres não é cortado na frase', () => {
    const nome = 'N'.repeat(100)
    const b = montarBloco([linha({ nome })], { agora: AGORA, casa, cap: semCmd })
    expect(b.linhas[0]!.frase).toContain(nome)
    expect(b.linhas[0]!.rotulo).toBe(nome)        // as reticências são do CSS; title e aria-label recebem o nome inteiro
  })
  it('sem_arquivo com imagens no Blob fica à vista; sem imagens vai para Já limpos', () => {
    const com = montarBloco([linha({ estado: 'sem_arquivo', blobs_pendentes: 3 })], { agora: AGORA, casa, cap: semCmd })
    const sem = montarBloco([linha({ estado: 'sem_arquivo', blobs_pendentes: 0 })], { agora: AGORA, casa, cap: semCmd })
    expect(com.linhas).toHaveLength(1); expect(com.jaLimpos.n).toBe(0)
    expect(sem.linhas).toHaveLength(0); expect(sem.jaLimpos.n).toBe(1)
  })
  it('zero medido: frase própria, Já limpos (0)', () => {
    const b = montarBloco([], { agora: AGORA, casa, cap: semCmd })
    expect(b.resumo).toBe('Nenhum canal removido pede limpeza.')
    expect(b.jaLimpos.n).toBe(0)
  })
  it('casa fora: triângulo, sem vermelho por idade', () => {
    const fora = { estado: 'nao_respondeu', desde: AGORA - 3 * D, forma: 'octogono' } as const
    const b = montarBloco([linha({ decided_at: new Date(AGORA - 90 * D).toISOString() })], { agora: AGORA, casa: fora, cap: comCmd })
    expect(b.linhas[0]!.gravidade).not.toBe('vermelho')
  })
  it('nunca diz "apagado" antes da prova', () => {
    const b = montarBloco([linha({})], { agora: AGORA, casa, cap: semCmd })
    expect(b.linhas[0]!.frase).not.toMatch(/[Aa]pagado/)
  })
})
```

- [ ] **Passo 2. Rodar e ver falhar.**
- [ ] **Passo 3. Implementar** `canais-removidos.ts`: Zod estrito da lista v2 (`versao: z.literal(2)`), `montarBloco` e `marcaAoLadoDaPastilha` chamando `corDaRemocao` da M3b para a idade (nunca recalcular os limiares: `IDADE` é a fonte); os estados `apagado_nas`, `apagado_b2`, `reapareceu` e `concluido` são desenhados com as frases do mockup para quando a M9 os produzir, mas, sem a M9, a v2 nunca os devolve (a função só emite `sem_destino`, `sem_arquivo`, `guardado`, `pedido`): um teste afirma que um estado desconhecido vem como "não medido" da linha, nunca "ok".
- [ ] **Passo 4. Rodar e ver passar.**
- [ ] **Passo 5. Teste da variável** (regra de env com padrão): `delete process.env.OBS_ARQUIVO_LIMPEZA_CANAL` → bloco na forma "espera o comando" e marca `null`; `'ON'`, `'1'`, `'true'` → idem; `'on'` → marca desenhada. (A M3b já testa `lerCapacidades`; este teste prova o caminho até o bloco.)
- [ ] **Passo 6. Commit** `feat: bloco Canais removidos só de leitura e a marca ao lado da pastilha, puros (manutenção M5, 04 §14.2, item 163 parte M5)`. **`BLOCO_CANAIS_REMOVIDOS` só vira `true` no commit da Task 9**, junto do componente (comentário de `capacidades.ts:9`).

---

### Task 9: a página Arquivo (rota, aba, componentes)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/arquivo/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo/montar.ts` (servidor: permissões e leituras)
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo/arquivo-screen.tsx`, `regua.tsx`, `cartao-do-tipo.tsx`, `bloco-canais-removidos.tsx`, `legenda.tsx`, `grupo-teste.tsx`, `arquivo.css`
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/view-model.ts:11-13, 46-56` (aba `arquivo`, só com `podeEditar`)
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts:9` (`BLOCO_CANAIS_REMOVIDOS = true`)
- Test: `apps/web/test/youtube/observatorio/arquivo-pagina.test.tsx` (jsdom), `apps/web/test/youtube/observatorio/arquivo-montar.test.ts` (node)

**Interfaces:**
- Consumes: `montarPagina`, `lerPagina` (Task 7); `montarBloco`, `lerCanaisRemovidos` (Task 8); `lerCapacidades`; `canEditSite`, `canAdminSite` (conferir o caminho com `grep -rn "export async function canEditSite\|export async function canAdminSite" apps/web/src/lib`); `getSiteContext()`; `ObservatoryChromeServer` (`_chrome/chrome-server.tsx:17`).
- Produces: `export async function montarArquivo(sp): Promise<{ acesso: 'so_le' } | { acesso: 'edita' | 'administra'; modelo: ModeloPagina | null; bloco: LeituraBloco; pagina: … }>`; `ChromeTab` ganha `'arquivo'`.

**Regras:** (a) **Só lê** (`!canEditSite`) → `montarArquivo` devolve `{ acesso: 'so_le' }` **antes** de qualquer leitura com o cliente de serviço; a tela diz "Esta página é de quem edita o site." com o link "Voltar para Canais" (mockup A5 da revisão 19-1) e a aba não aparece. (b) Ordem da tela (mockup `arquivo.js` e `NOTAS.md` "Peça 2"): frase-resumo (cinco variantes do Logan 11.8: casa fora vence tudo; meses que precisam do dono; mais o canal removido; nada precisa de você em `--muted` sem caixa e sem verde; não medido em hachura), legenda recolhida "Como ler as formas", bloco "Canais removidos" acima dos tipos quando alguma linha pede algo do dono (sem a M9, nenhuma pede comando: o bloco vai abaixo, salvo `sem_destino`, que é vermelho e sobe), um cartão por tipo na ordem Leitura de hora em hora, Views por dia, Comentários e dados antigos do YouTube, e o grupo "Dado de teste" só para quem administra (D-M5-6: sem botão). (c) Perfil "edita": "esperam quem administra o site" numa frase única abaixo do resumo (revisão 19-1, A4). (d) Leitura do servidor, sem esqueleto, exceto o bloco, que tem esqueleto com a altura final (187 px; 312 px até 1200 px; Naksu A1) só se for carregado à parte; nesta etapa ele vem do servidor junto (uma rodada), então **não há esqueleto**: anotar no índice de estados. (e) Cores e formas: copiar as classes de `m19.css` para `arquivo.css` com prefixo `arq-`, só hex/`rgba()` literais (o `m19.css` já é assim); `grep -n "color-mix" arquivo.css` só pode achar comentário. (f) `next/link`: "Voltar para Canais" e os links da frase-resumo saem de componente `'use client'` que importa `Link` (ou de `cms-link.tsx`), nunca como prop de Server Component.

**O que acontece quando o dado não existe:** leitura da página falhou → só a frase "Não foi possível ler o estado do arquivo" em hachura, e o bloco lido à parte (se ele leu, aparece); leitura do bloco falhou → o bloco mostra "Não foi possível ler os canais removidos." e o resto da página segue; `OBS_ARQUIVO` apagada → frase do arquivo desligado (teste que **apaga** a variável).

- [ ] **Passo 1. Testes, falhando:**

```ts
// apps/web/test/youtube/observatorio/arquivo-montar.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
// mocks do módulo de permissão e do cliente de serviço, no padrão dos testes de páginas do Observatório
// (grep -rln "vi.mock('@/lib/supabase/service'" apps/web/test | head -3: usar o mesmo alvo de mock)

describe('montarArquivo', () => {
  beforeEach(() => { vi.resetModules(); delete process.env.OBS_ARQUIVO })
  it('Review Focus 5: só lê pela URL não chama o cliente de serviço', async () => {
    // canEditSite → false
    const { montarArquivo } = await import('@/app/cms/(authed)/youtube/competitors/_arquivo/montar')
    const r = await montarArquivo({})
    expect(r).toEqual({ acesso: 'so_le' })
    expect(servico.rpc).not.toHaveBeenCalled()
  })
  it('OBS_ARQUIVO apagada: página na frase do arquivo desligado', async () => {
    // canEditSite → true; rpc devolve a fixture paginaVazia
    const { montarArquivo } = await import('@/app/cms/(authed)/youtube/competitors/_arquivo/montar')
    const r = await montarArquivo({})
    expect(r.acesso).not.toBe('so_le')
    if (r.acesso !== 'so_le') expect(r.modelo!.resumo.texto).toBe('O arquivo está desligado neste site: nada está sendo copiado nem tirado')
  })
  it.each([[false, null], [true, 'objeto']] as const)('canAdminSite=%s: grupo de teste %s', async (admin, esperado) => {
    permissao.canEditSite.mockResolvedValue(true); permissao.canAdminSite.mockResolvedValue(admin)
    servico.rpc.mockResolvedValue({ data: paginaVazia({ testeAberto: true }), error: null })
    process.env.OBS_ARQUIVO = 'on'
    const { montarArquivo } = await import('@/app/cms/(authed)/youtube/competitors/_arquivo/montar')
    const r = await montarArquivo({})
    if (r.acesso === 'so_le') throw new Error('não devia ser só lê')
    expect(r.modelo!.teste === null ? null : 'objeto').toBe(esperado)
  })
})
```

```tsx
// apps/web/test/youtube/observatorio/arquivo-pagina.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ArquivoScreen } from '@/app/cms/(authed)/youtube/competitors/_arquivo/arquivo-screen'
import { modeloCheio, modeloVazio, blocoComSemDestino } from './fixtures/arquivo-modelos'

describe('página Arquivo', () => {
  it('a linha que precisa do dono é a primeira do tipo e a única com contorno', () => {
    render(<ArquivoScreen modelo={modeloCheio()} bloco={{ ok: true, bloco: blocoComSemDestino() }} acesso="administra" />)
    const tipo = screen.getByRole('region', { name: 'Views por dia' })
    const linhas = within(tipo).getAllByRole('listitem')
    expect(linhas[0]!.className).toMatch(/arq-contorno/)
    expect(linhas.slice(1).every(l => !/arq-contorno/.test(l.className))).toBe(true)
  })
  it('cada forma tem texto alternativo, nunca só cor', () => {
    render(<ArquivoScreen modelo={modeloCheio()} bloco={{ ok: true, bloco: blocoComSemDestino() }} acesso="administra" />)
    for (const el of document.querySelectorAll('[data-forma]')) expect(el.getAttribute('aria-label') || el.textContent).toBeTruthy()
  })
  it('sem_destino sobe acima dos tipos', () => {
    render(<ArquivoScreen modelo={modeloCheio()} bloco={{ ok: true, bloco: blocoComSemDestino() }} acesso="administra" />)
    const ordem = [...document.querySelectorAll('[data-secao]')].map(e => e.getAttribute('data-secao'))
    expect(ordem.indexOf('canais-removidos')).toBeLessThan(ordem.indexOf('tipo-serie'))
  })
  it('bloco não lido: frase em hachura, nunca lista vazia', () => {
    render(<ArquivoScreen modelo={modeloVazio()} bloco={{ ok: false }} acesso="edita" />)
    expect(screen.getByText('Não foi possível ler os canais removidos.')).toBeTruthy()
  })
  it('quem edita não vê "Ver os comandos" nem "Apagar do arquivo" (M9) nem o grupo de teste', () => {
    render(<ArquivoScreen modelo={modeloCheio()} bloco={{ ok: true, bloco: blocoComSemDestino() }} acesso="edita" />)
    expect(screen.queryByText(/Ver os comandos|Apagar do arquivo|Dado de teste/)).toBeNull()
  })
})
```

- [ ] **Passo 2. Rodar e ver falhar.**
- [ ] **Passo 3. A rota** (padrão de `mudancas/page.tsx`; conferir no guia do Next 16 do Task 0):

```tsx
// apps/web/src/app/cms/(authed)/youtube/competitors/arquivo/page.tsx
import { ObservatoryChromeServer } from '../_chrome/chrome-server'
import type { ObsSearchParams } from '../_chrome/resolve-niche'
import { montarArquivo } from '../_arquivo/montar'
import { ArquivoScreen } from '../_arquivo/arquivo-screen'
import { SoLe } from '../_arquivo/so-le'
import '../_arquivo/arquivo.css'

export const metadata = { title: 'Arquivo · Competidores' }
export const dynamic = 'force-dynamic'

export default async function ArquivoPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  const r = await montarArquivo(sp)
  if (r.acesso === 'so_le') return <SoLe />
  return (
    <ObservatoryChromeServer tab="arquivo" searchParams={sp} obs={r.obs} forja={r.forja} meuCanalLembrado={r.meuCanalLembrado}>
      <ArquivoScreen modelo={r.modelo} bloco={r.bloco} acesso={r.acesso} />
    </ObservatoryChromeServer>
  )
}
```

(`r.obs`, `r.forja`, `r.meuCanalLembrado`: o que a casca precisa; montar como `montarMudancas` faz, reaproveitando a função dela, sem cópia: `grep -n "export async function" apps/web/src/app/cms/\(authed\)/youtube/competitors/_mudancas/montar.ts`.)
- [ ] **Passo 4. Componentes.** `regua.tsx` (cinco ou duas etapas; a 390 px vira coluna de ícones 24 px com rótulo curto embaixo, `Etapa.curto`); `formas-arquivo.tsx` da Task 5 para os símbolos; `cartao-do-tipo.tsx` com `role="region"` e `aria-label` do título, a frase-resumo do tipo, a lista `<ul>` dos meses e a linha por ano (`<details>` com "2027: 12 meses no arquivo, todos conferidos"); `bloco-canais-removidos.tsx` (régua de 4 etapas, rótulo com `text-overflow: ellipsis` e `title`/`aria-label` com o nome inteiro, frase que quebra, "Já limpos (N)" em `<details>`); `legenda.tsx` (as nove formas e as duas origens da conferência do B2 com o mesmo visto); `grupo-teste.tsx` (faixa "Dado de teste. Isto é um mês fictício…" e a marca "teste" em cada linha; sem botão).
- [ ] **Passo 5. Aba.** `ChromeTab` ganha `'arquivo'`; `TAB_NAME.arquivo = 'Arquivo'`; `hrefOf.arquivo = obs.link.arquivo()` (acrescentar `arquivo` ao construtor de links do Observatório: `grep -rn "mudancas: () =>" apps/web/src/lib/youtube/observatorio/links.ts`); a aba só entra em `tabs` com `o.podeEditar === true` (novo campo opcional em `buildChromeView`; ausente = não entra). `coworkText` ganha a chave `arquivo` com uma frase curta sem palavra proibida. Conferir os testes de `view-model.ts` que contam abas e atualizá-los no mesmo commit.
- [ ] **Passo 6. `BLOCO_CANAIS_REMOVIDOS = true`** em `capacidades.ts`; rodar o teste da M3b de `capacidades` e o do diálogo de remover (`grep -rl "lerCapacidades\|BLOCO_CANAIS_REMOVIDOS" apps/web/test`): as três linhas da tabela "O que o diálogo, o depois do clique e a lista mostram" (`04` §14.3) passam a cair na linha "bloco sim"; corrigir os testes que afirmavam "bloco não" no mesmo commit, anotando no ledger.
- [ ] **Passo 7. Rodar** os dois testes novos e toda a pasta `apps/web/test/youtube/observatorio` (saída em arquivo); **typecheck**; **`next build` local** (mudança arriscada: rota nova e aba): `npm run build -w apps/web > /tmp/claude-m5-build.txt 2>&1; tail -30 /tmp/claude-m5-build.txt`.
- [ ] **Passo 8. Commit** `feat: página Arquivo do Observatório, só de leitura, com o bloco Canais removidos (manutenção M5, 04 §14.2, itens 39, 85, 121 parte de leitura e 163 parte M5)`, por caminho.

---

### Task 10: peça 7, parte de leitura, na fila "Saíram do YouTube"

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/esperam-comandos.tsx` (+ classes `p7-` em `_canais/*.css` existente ou arquivo novo `esperam-comandos.css`)
- Modify: o montador server da tela Canais (`grep -rn "Saíram do YouTube" apps/web/src/app/cms/\(authed\)/youtube/competitors/_canais/view-model.ts` → seguir até quem monta a fila) para ler `obs_archive_owner_pending` **depois** de `canEditSite` e passar `pendenciasParaTela(l, { podeVerComandos: await canAdminSite(siteId), agora })`
- Test: `apps/web/test/youtube/observatorio/peca7-leitura.test.tsx` (jsdom)

**Interfaces:**
- Consumes: `lerPendencias`, `pendenciasParaTela`, `PendenciasDaTela`, `LINHA_DO_DONO` (`pendencias.ts:11, 73, 88, 95`).
- Produces: `<EsperamComandos t={PendenciasDaTela} />`.

**Regras (mockup `peca7.js`, NOTAS "Peça 7", correção da revisão 1):** ordem resumo → "Esperam a sua resposta" (já existe, da E9) → "Esperam você rodar os comandos" (novo); frase-resumo "N itens esperam você rodar os comandos; o mais antigo há N dias." com a frase "Esperar não perde nada…" uma vez; barra de idade de 0 a 60 dias com marcas em 30 e 60, a cor só no contorno da linha e no preenchimento, texto em cor normal; para quem administra, "Ver os comandos" abre a linha fixa `LINHA_DO_DONO` com botão Copiar; **sem "Já rodei"** (M9, D-M5-8); quem só edita vê resumo e idade, sem a linha (E-D4).

**O que acontece quando o dado não existe:** `itens: []` lido → caixa de zero medido "Nenhum item espera você rodar os comandos." (sem segunda frase); leitura falhou (`ok: false`) → hachura "Não foi possível ler se há cópia no arquivo." com "isto não quer dizer que não há cópia" e a hora da última leitura, se houver; `OBS_ARQUIVO` desligada → o bloco não é desenhado (o arquivo desligado já é dito na página Arquivo).

- [ ] **Passo 1. Testes, falhando:** zero medido; não medido; 3 itens com o mais antigo de 63 dias (resumo exato e barra com a forma octógono); quem só edita sem a linha e sem "Ver os comandos"; quem administra com a linha igual a `LINHA_DO_DONO`; nenhum "Já rodei".
- [ ] **Passo 2. Rodar e ver falhar. Passo 3. Implementar. Passo 4. Rodar, typecheck.**
- [ ] **Passo 5. Commit** `feat: fila Saíram do YouTube mostra o que espera você rodar os comandos, só leitura (manutenção M5, peça 7 parte de leitura)`.

---

### Task 11: peça 5, o aviso do banco (`18-v2`) e as marcas ao lado da pastilha

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/aviso-v2.ts` (puro)
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/aviso-banco/pastilha.tsx`, `painel.tsx`, `regua-tempo.tsx`, `aviso-banco.css` (D-M5-5: inteiro, se o 18 não existir em código; senão, só a diferença sobre o componente achado no Task 0, Passo 3)
- Modify: `_chrome/freshness.tsx` (a pastilha e as marcas na faixa de frescor; `flex-wrap`), `_chrome/chrome-server.tsx` (ler o aviso no servidor, só com `canEditSite`)
- Test: `apps/web/test/youtube/observatorio/aviso-v2.test.ts` (node), `apps/web/test/youtube/observatorio/aviso-pastilha.test.tsx` (jsdom)

**Interfaces:**
- Consumes: `AvisoDoArquivo` e o leitor de `aviso.ts` (E10; não editar); `sinalDoBanco` de `sinal-do-banco.ts` (E10; não editar: a previsão sem serrote, pedido 4, é da M6); `ModeloPagina` (Task 7: "2 meses prontos para sair", última cópia, casa); `marcaAoLadoDaPastilha` (Task 8).
- Produces:

```ts
export interface AvisoV2 { pastilha: { pct: number | null; cor: 'neutra' | 'ambar' | 'vermelho' | 'nao_medido'; texto: string }
  barra: { hojePct: number | null; chegaAPct: number | null; rotuloChegaA: string | null }
  regua: null | { losango85: number | null; tracoProximaSaida: number | null; alivioDepoisDoAperto: boolean; frase: string | null }
  linhaDaCopia: { forma: Forma; texto: string; portaArquivo: boolean }
  oQueLibera: string[] | null   // com 85%+; nenhuma linha fala em plano pago
  casa: null | { texto: string; oQueFazer: string[]; forma: Forma }
  marcas: { automatico: null /* M6 */; canaisRemovidos: ReturnType<typeof marcaAoLadoDaPastilha> } }
export function montarAvisoV2(o: { aviso: AvisoDoArquivo; pagina: ModeloPagina | null; agora: number; casa: Casa; marcaCanais: AvisoV2['marcas']['canaisRemovidos'] }): AvisoV2
```

**Regras (`04` §14.5 e `NOTAS-18-v2.md`):** a cor da pastilha e da frase segue **o mais alto que o banco chega antes da próxima saída** (projetado pela reta da E10 até a data em que o próximo mês fica pronto, de `ModeloPagina`), a barra continua na cor do tamanho de hoje, com o segundo marcador "chega a N% antes da próxima saída" (texto visível, não só `title`); a régua do tempo com o losango "o banco chega a 85%" e o traço "o próximo mês fica pronto", com a faixa âmbar-vermelho (`linear-gradient` entre dois hex) e "O alívio chega depois do aperto" quando o losango vem antes; a linha da cópia em cinco estados (antes da 1ª cópia: pontilhado "A primeira cópia é a de outubro, a partir de 28/11"; em dia: visto cinza; atrasada: triângulo até 30 dias, octógono acima, com "Abrir o Arquivo"; não medida: hachura, nunca visto); "Quem ocupa" ganha a sub-linha do mês fora das telas sem liberar o espaço (a partir da M6: sem mês destacado, a sub-linha não aparece); casa fora com a frase e "O que fazer" em três itens, e "A pausa da coleta ainda não existe" enquanto a pausa da E10 não estiver em produção (decidir pela presença do comando `pausar` na E10: conferir no dia por `grep -n "pausar" apps/web/src/lib/youtube/observatorio/arquivo/cli.ts`); a palavra "pico" nunca vai à tela; nenhuma linha fala em plano pago; o chip do automático é da M6 (`marcas.automatico` sempre `null` aqui).

**O que acontece quando o dado não existe:** sem leitura do tamanho hoje → como o 18: data e valor da última medida, cor nunca verde; séries particionadas sem medida (`obs_db_size_record` sem as partições) → pastilha "Não medido", nunca o número parcial; `pagina` nula (leitura do arquivo falhou) → a linha da cópia é hachura "não medido" e a régua não desenha o traço da próxima saída (sem data, sem marco), nunca "verde"; sem nenhuma saída ainda → a previsão é a reta da E10 e o "chega a" é o máximo da reta até a data em que o próximo mês fica pronto.

- [ ] **Passo 1. Testes, falhando** (um por estado V0-V12 das NOTAS do `18-v2` que não dependam da M6: V0, V1, V1a 12 e 34 dias, V1n, V2, V3, V4, V5, V8 64 h e 20 h, V8a, V8b, V8c, V9, V10, V12 12/34/64 dias, V12n). Exemplos:

```ts
it('V2: 66% hoje e chega a 78% antes da próxima saída → pastilha âmbar, barra na cor de hoje, sem "pico"', () => {
  const a = montarAvisoV2(caso('v2'))
  expect(a.pastilha.cor).toBe('ambar')
  expect(a.barra).toMatchObject({ hojePct: 66, chegaAPct: 78, rotuloChegaA: 'chega a 78% antes da próxima saída' })
  expect(JSON.stringify(a)).not.toMatch(/pico/i)
})
it('V5: com 85%+, o que libera nunca fala em plano pago', () => {
  expect(montarAvisoV2(caso('v5')).oQueLibera!.join(' ')).not.toMatch(/plano pago|upgrade|Pro\b/i)
})
it('V1n: cópia não medida é hachura, nunca visto', () => {
  expect(montarAvisoV2(caso('v1n')).linhaDaCopia.forma).toBe('hachura')
})
it('V12n: sem o comando de limpeza a marca não é desenhada', () => {
  expect(montarAvisoV2(caso('v12n')).marcas.canaisRemovidos).toBeNull()
})
it('V10: séries sem medida → pastilha não medido, sem número', () => {
  expect(montarAvisoV2(caso('v10')).pastilha).toMatchObject({ cor: 'nao_medido', pct: null })
})
```

`caso(id)` vem de uma fixture nova `apps/web/test/youtube/observatorio/fixtures/aviso-v2-casos.ts`, que reproduz os números dos estados do `bl2.js` do mockup (`grep -n "v2\|v5\|v1n\|v10\|v12" docs/superpowers/mockups/2026-10-13-a5-lote-2/18-aviso-banco-limite/bl2.js`).
- [ ] **Passo 2. Rodar e ver falhar. Passo 3. Implementar `aviso-v2.ts`. Passo 4. Rodar.**
- [ ] **Passo 5. Componentes** (copiar a estrutura e as classes de `18-v2.html`/`bl2.css`, prefixo `bl-`): pastilha dentro da faixa de frescor (`freshness.tsx`), marcas **ao lado** (nunca dentro; `flex-wrap`), painel com o ⓘ reescrito (cópia mensal e sempre; cor pela próxima saída; limite de 36 h). Só para quem edita: quem não edita recebe a faixa sem a pastilha (plano da E10, linha 246).
- [ ] **Passo 6. Teste de componente** (jsdom): a marca de canais removidos é irmã da pastilha, não filha; a 390 px (classe aplicada por `use-janela-estreita.ts`) as duas quebram linha sem rolagem; o rótulo "chega a" é texto visível.
- [ ] **Passo 7. Rodar, typecheck, `next build` local, commit** `feat: aviso do banco 18-v2, cor pela próxima saída, linha da cópia e marca dos canais removidos (manutenção M5, 04 §14.5)`.

---

### Task 12: vocabulário, sincronia e roteiro (itens 38 e 86)

**Files:**
- Create: `apps/web/test/manutencao/vocabulario-das-telas.test.ts`
- Modify: `docs/superpowers/mockups/2026-10-14-manutencao-nas/19-mes-fora-do-banco/index.html` (coluna "commit" da tabela de sincronia; é o único arquivo do mockup que muda, e só nessa coluna)
- Modify: `docs/superpowers/mockups/ROTEIRO-DE-TESTE-E-MELHORIAS.md` (seção "O que a fase de manutenção muda" em cada mockup tocado e o roteiro das peças 1, 2, 5 e 7 em produção; **o arquivo tem mudança sem commit de outra trilha no `git status` de hoje: aplicar a regra do Global Constraints antes de editar**)

- [ ] **Passo 1. Teste do item 38, falhando antes das telas existirem e passando depois:**

```ts
// apps/web/test/manutencao/vocabulario-das-telas.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const RAIZ = resolve(__dirname, '../../../..')
const PROIBIDAS = ['lote', 'unidade', 'selar', 'selado', 'selagem', 'partição', 'cadeia', 'atestação', 'hash', 'ensaio', 'restauração', 'divergente',
  'ambiente', 'tabela', 'linhas', 'MB', 'toco', 'congelado', 'congelamento', 'estágio', 'classe']
const ARQUIVOS = [
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/peca1.ts',
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-do-mes.ts',
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/canais-removidos.ts',
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/aviso-v2.ts',
  ...execFileSync('git', ['ls-files', 'apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo', 'apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/aviso-banco',
    'apps/web/src/app/cms/(authed)/youtube/competitors/_canais/esperam-comandos.tsx'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter(f => /\.(ts|tsx)$/.test(f)),
]
/** Só o texto que vai à tela: literais de string e texto JSX; fora o que está dentro de um ⓘ marcado com /* ⓘ *\/ e os comentários. */
function textosDeTela(fonte: string): string[] {
  const semComentario = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const semInfo = semComentario.replace(/INFO\(([`'"])[\s\S]*?\1\)/g, '')
  const literais = [...semInfo.matchAll(/(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g)].map(m => m[2]!).filter(s => /\s/.test(s) && /[a-zà-ú]/i.test(s))
  const jsx = [...semInfo.matchAll(/>([^<>{}]*[a-zà-ú][^<>{}]*)</gi)].map(m => m[1]!)
  return [...literais, ...jsx]
}
describe('item 38: vocabulário das telas da fase', () => {
  it.each(ARQUIVOS)('%s', arq => {
    const ruins = textosDeTela(readFileSync(resolve(RAIZ, arq), 'utf8'))
      .flatMap(t => PROIBIDAS.filter(p => new RegExp(`(^|[^\\p{L}])${p}([^\\p{L}]|$)`, p === 'MB' ? 'u' : 'iu').test(t)).map(p => `${p}: ${t.slice(0, 80)}`))
    expect(ruins).toEqual([])
  })
})
```

Convenção que o teste impõe: todo texto de ⓘ passa por `INFO('...')` (uma função identidade exportada de `formas-arquivo.tsx`), o que torna a exceção do ⓘ visível no código. As exceções "snapshot(s) do NAS" e "lido em" não estão na lista e passam.
- [ ] **Passo 2. Rodar; corrigir as frases que caírem (com a palavra do mockup; se o mockup também a usa fora do ⓘ, anotar para Logan na Task 15).**
- [ ] **Passo 3. Sincronia (item 86):** preencher a coluna "commit" do `index.html` do 19 com o hash de cada tela (Tasks 5, 9, 10, 11); conferir a tabela de status do roteiro contra `docs/superpowers/mockups/APROVACOES-DO-DONO.md` (`04` §14.9 ponto 5) e anotar a divergência que restar.
- [ ] **Passo 4. Commit** `test: vocabulário das telas da manutenção e tabela de sincronia com os commits (manutenção M5, itens 38 e 86)`.

---

### Task 13: a migration, a liberação das classes e a ida a produção

**Files:**
- Modify: `supabase/rascunhos/m5.sql` (`-- M5 PARTE 4`: liberar `serie` e `horaria`)
- Create (por `npm run db:new manutencao_m5_telas`): `supabase/migrations/<timestamp>_manutencao_m5_telas.sql`
- Modify: `apps/web/test/helpers/m5.ts` (`M5_SQL_CAMINHO` passa à migration; `M5_EM_MIGRATION = true`)
- Create: `apps/web/test/manutencao/classe-liberada.test.ts` (item 87)

- [ ] **Passo 1. Teste do item 87, falhando:**

```ts
// apps/web/test/manutencao/classe-liberada.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const RAIZ = resolve(__dirname, '../../../..')
const MIG = resolve(RAIZ, 'supabase/migrations')
/** A última definição de obs_archive_policy() entre as migrations (ou o rascunho da M5, antes da Tarefa 13). */
function politicaVigente(): string {
  const arqs = readdirSync(MIG).filter(f => f.endsWith('.sql')).sort()
  const comPolitica = arqs.filter(f => /function public\.obs_archive_policy\(\)/.test(readFileSync(resolve(MIG, f), 'utf8')))
  const fonte = comPolitica.length ? readFileSync(resolve(MIG, comPolitica.at(-1)!), 'utf8') : ''
  const rasc = resolve(RAIZ, 'supabase/rascunhos/m5.sql')
  const r = (() => { try { return readFileSync(rasc, 'utf8') } catch { return '' } })()
  return /function public\.obs_archive_policy\(\)/.test(r) ? r : fonte
}
const liberada = (classe: string, tabela: string): boolean =>
  new RegExp(`\\('${classe}', '${tabela}', '[a-z_]+', \\d+, \\d+, \\d+, '[a-z_0-9]+', true`).test(politicaVigente())

describe('item 87: classe liberada só com as telas', () => {
  it('serie liberada exige o carregador sem DAILY_MAX_DAYS', () => {
    if (!liberada('serie', 'competitor_video_daily')) return
    expect(readFileSync(resolve(RAIZ, 'apps/web/src/lib/youtube/observatorio/load.ts'), 'utf8')).not.toMatch(/DAILY_MAX_DAYS/)
  })
  it('horaria liberada exige competitor_hourly_health sem o min(hour_slot) cru em desde', () => {
    if (!liberada('horaria', 'competitor_video_hourly')) return
    const arqs = readdirSync(MIG).filter(f => f.endsWith('.sql')).sort()
    const ultima = arqs.filter(f => /function public\.competitor_hourly_health/.test(readFileSync(resolve(MIG, f), 'utf8'))).at(-1)!
    expect(readFileSync(resolve(MIG, ultima), 'utf8')).toMatch(/obs_archive_switch/)
  })
  it('texto, video_antigo e ensaio continuam fechadas', () => {
    expect(liberada('texto', 'competitor_video_comments')).toBe(false)
    expect(liberada('video_antigo', 'competitor_raw')).toBe(false)
  })
})
```

- [ ] **Passo 2. Parte 4 do rascunho:** `create or replace function public.obs_archive_policy()` **partindo do corpo instalado** (o da migration da M3b, ou de qualquer migration posterior que o tenha mudado: `grep -ln "function public.obs_archive_policy" supabase/migrations/* | tail -1`), mudando só `released` para `true` nas três linhas `horaria`/`competitor_video_hourly`, `serie`/`competitor_video_daily` e `serie`/`competitor_video_early`; repetir o `revoke`/`grant` da M3b. Teste de integração: depois de `aplicarM5(c)`, `select count(*) from obs_archive_policy() where released` = 3.
- [ ] **Passo 3. Conferir a TRAVA M5-3 e o portão do Yannis e do Phil (Task 16) antes de seguir.** Sem o acordo dos dois sobre o código das Tasks 1 a 12, parar aqui.
- [ ] **Passo 4. A migration.** `npm run db:new manutencao_m5_telas`; copiar `supabase/rascunhos/m5.sql` inteiro para o arquivo criado (cabeçalho de rascunho trocado pelo de migration); `M5_SQL_CAMINHO` passa a apontar para ela e `M5_EM_MIGRATION = true`; apagar o rascunho no mesmo commit (`git rm -- supabase/rascunhos/m5.sql`); trocar no teste da Task 6 a leitura de `m3b.sql` pela migration da M3b. Rodar toda a suíte de integração da fase com o banco local (`HAS_LOCAL_DB=1 npx vitest run apps/web/test/integration --no-file-parallelism > /tmp/claude-m5-int.txt 2>&1`; só as falhas no contexto) e a suíte completa (`npx vitest run > /tmp/claude-m5-all.txt 2>&1`, ~160 s; idem).
- [ ] **Passo 5. Commit** `feat: migration da M5: online desde, leitura da página, lista v2, leitores das séries e classes serie e horaria liberadas (manutenção M5, itens 35, 82 e 87)`.
- [ ] **Passo 6. Arquivo de comandos do dono** `.superpowers/sdd/manutencao-nas/m5-db-push.sh` (uma ação por linha, saída em `saidas/m5-db-push-<data>.txt`):

```bash
#!/usr/bin/env bash
set -euo pipefail
cd ~/Workspace/bythiagofigueiredo
npx supabase migration list --linked | tee .superpowers/sdd/manutencao-nas/saidas/m5-migration-list-$(date +%Y%m%d-%H%M).txt
echo "Confira: a única pendente tem de ser *_manutencao_m5_telas.sql. Se houver outra, PARE (Ctrl-C)."
read -r -p "Só a da M5 está pendente? (digite YES) " ok; [ "$ok" = "YES" ] || exit 1
npm run db:push:prod 2>&1 | tee .superpowers/sdd/manutencao-nas/saidas/m5-db-push-$(date +%Y%m%d-%H%M).txt
```

A linha que o dono roda, no clipboard (`pbcopy`), na hora (não antes): `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m5-db-push.sh`. Janela: fora de 11:30 a 13:00 UTC e dos minutos 0, 20 e 40.
- [ ] **Passo 7. Conferência em produção** (leitura, pelo agente, `npx supabase db query --linked`, saída em arquivo): `select class, table_name, released from public.obs_archive_policy()` (três `true`), `select * from public.obs_archive_online_since('<site>')` (três nulos: nenhum mês saiu), `select public.obs_archive_pagina('<site>')->'versao'` (1). Se a leitura em produção for negada no modo automático, preparar o arquivo de comandos e a linha para o dono (`reference_controlador_muitos_agentes`).
- [ ] **Passo 8. Push do código** (staging → CI verde → promoção a `main` no mesmo dia, `feedback_push_e_promocao_do_agente`), com a migration já aplicada. Registrar no ledger: hash, hora do `db:push:prod`, hora do deploy, "M5 em produção".

---

### Task 14: validação por Gio (QA, navegador)

**Quem:** agente `gio-qa`, modelo Sonnet, effort `medium`. Brief em arquivo: `.superpowers/sdd/manutencao-nas/brief-m5-gio.md`. Relatório ≤10 linhas; capturas e detalhe em `.superpowers/sdd/manutencao-nas/m5-gio/`.

- [ ] **Passo 1. Escrever o brief** com: a URL local (`npm run dev -w apps/web`, banco `bythiago_int` com semente) e a de produção; os três perfis (administra, edita, só lê) e como entrar em cada um (runbook `docs/ops/runbook-cms-e2e-local.md`); os quadros a reproduzir, um por linha dos índices de estados do mockup 19 (`index.html`, tabela "estado → quadro") que a M5 implementa: peça 1 (P1-0 a P1-12 que a semente consegue produzir), peça 2 (meses, problemas, página, casa, bloco "Canais removidos", grupo de teste), peça 5 (V0-V12 sem os da M6), peça 7 (cheia, vazia, nm, perfil edita); para cada quadro, o mockup ao lado (`open -a Opera` não: Gio usa Playwright/chrome-devtools e compara com a captura do mockup em `shots/`).
- [ ] **Passo 2. Semente local** (Gio escreve; não é código de produto): `apps/web/test/e2e/seeds/m5-arquivo.sql` com o caso cheio (hoje simulado 03/05/2028 por relógio do banco `obs_archive_agora()` se a M3b o permitir, senão datas relativas), um mês em cada estado da `04` §14.2 que o banco produz sem a M6 (sem destacado/descartado reais: esses quadros são conferidos só no modelo puro, Task 7, e no mockup), três remoções (`pedido`, `sem_destino`, `sem_arquivo` com Blob) e batimentos (casa respondendo, casa fora há 20 h e há 64 h).
- [ ] **Passo 3. O que Gio mede e devolve:** 1440 e 390 px, claro e escuro: rolagem horizontal 0, alvos < 44 px = 0, texto < 12 px = 0, contraste (4,5:1 texto, 3:1 forma) medido com a cor composta, foco visível e ordem de tabulação, Esc nos `<details>` e no painel do aviso, `prefers-reduced-motion`, escala de cinza com a linha de problema à frente, `grep color-mix` no CSS servido, console sem erro, perfil "só lê" pela URL (Review Focus 5), nome de canal com 100 caracteres (Review Focus 4). Para cada quadro: veredito "igual ao mockup / difere em X" com a captura.
- [ ] **Passo 4. Defeitos:** Gio não conserta; cada defeito vira item no ledger com os passos exatos, e o controlador abre um agente executor (Sonnet) com o conserto, e Gio confere de novo só os quadros tocados.

---

### Task 15: revisão de Logan (UX) e Naksu (UI) da tela implementada

**Quem:** `logan-ux` e `naksu-ui`, em paralelo, Opus na 1ª revisão, effort `medium`; re-revisão de emenda em Sonnet. Briefs em arquivo (`brief-m5-logan.md`, `brief-m5-naksu.md`); relatórios em `.superpowers/sdd/manutencao-nas/revisao-m5-logan-r1.md` e `revisao-m5-naksu-r1.md`, ≤10 linhas no retorno.

- [ ] **Passo 1. Brief comum:** comparar a tela implementada (capturas de Gio, Task 14, e a URL local) com o mockup aprovado, **não redesenhar**; olhar os quadros que o mockup não tinha e a implementação criou (zero medido real, nomes reais, datas reais). Logan: fluxo, ordem, texto de interface, os três perfis, as frases que o Task 12 trocou por causa do vocabulário. Naksu: contraste medido, hierarquia, tokens, 390 px, formas a 16 px (caixa de arquivo, ◐, pontilhado), dado real (texto longo, carregando, erro).
- [ ] **Passo 2.** Achados viram consertos por agente executor (Sonnet), um commit por conserto, e voltam aos dois **até haver acordo** (regra do dono). Divergência entre os dois ou com o mockup aprovado: a decisão é do dono, com a recomendação de Hanna (só recomenda).
- [ ] **Passo 3.** Depois do acordo, o roteiro do dono (`feedback_roteiro_de_teste_dos_mockups`): uma tela por vez, aberta no Opera do dono (`open -a Opera <url>`), com o que testar, anotado em `docs/superpowers/mockups/ROTEIRO-DE-TESTE-E-MELHORIAS.md`.

---

### Task 16: revisão de Phil e Yannis e fecho

- [ ] **Passo 1. Revisão do código** (antes da Task 13, Passo 3, e de novo depois de consertos de Gio/Logan/Naksu que toquem lógica): `phil-dados` (leituras: custo de `obs_archive_pagina` no caso cheio, a lista v2 e o nome, os dois leitores da A5 que mudam de corpo, a janela mínima de D-M5-1) e `yannis-software` (o commit único do pedido 11, `viewsAtAge`, permissões e cliente de serviço, Next 16, testes). Opus na 1ª rodada, Sonnet nas seguintes, effort `medium`. Conserta-se até haver acordo.
- [ ] **Passo 2. Ledger e índice:** marcar a M5 no índice dos planos (linha 7) como feita, com o hash; registrar no ledger o que fica para depois: botões da peça 3 e o interruptor (M6), "Encerrar o dado de teste" (M6, D-M5-6), sub-linha "mês fora das telas" do `18-v2` e o chip do automático (M6), "Já rodei" e "Ver os comandos" do canal removido (M9), "Ver antigo" (M7), seção "Vídeos antigos" (M10b).
- [ ] **Passo 3. `docs/ops/runbook-arquivo-mensal.md`:** acrescentar a seção "A página Arquivo" (onde fica, quem vê, o que cada forma quer dizer, o que fazer quando ela diz "não medido"), por commit próprio `docs: runbook do arquivo mensal ganha a página Arquivo (manutenção M5)`.

---

## Cobertura do spec (autoconferência)

| Requisito | Tarefa |
|---|---|
| `05` §15.1 M5: carregador pela janela real | 4 |
| "no arquivo" nas telas de série; peça 1 inteira (`04` §14.1) | 5 |
| os outros leitores das séries (`04` L90-96) | 3, 6 |
| página do arquivo com o bloco "Canais removidos" só de leitura | 2, 7, 8, 9 |
| marca "N canais removidos pedem um comando seu" ao lado da pastilha | 8, 11 |
| aviso de limite ajustado (`18-v2`) | 11 |
| classe `serie` liberada (e `horaria`, D-M5-4) | 13 |
| pedido 11 | 0, 4 |
| itens 34, 35, 81 | 4 |
| item 36, 84, 85 | 5, 9 |
| item 37 (aprovação antes do commit de tela) | já cumprido na M4 (índice, linha 6); a Task 0 confere |
| item 38 | 12 |
| item 39 | 7 |
| item 82, 83 | 6 |
| item 86 | 12 |
| item 87 | 13 |
| item 121 (parte de leitura) | 2, 9 (botão: M6) |
| item 163 (parte M5) | 8, 9, 11 |
| peça 7, parte de leitura (plano M3b-site, 3772/3805) | 10 |
| Gio, Logan, Naksu; Phil, Yannis | 14, 15, 16 |

## NÃO VERIFICADO neste plano

- Os nomes exatos das colunas de `obs_archive_units` e `obs_archive_summaries` usados na Task 2 e na Task 3 (o plano manda conferir por `grep` no rascunho da M3b antes de escrever).
- A assinatura e o corpo instalados de `competitor_hourly_health` e `competitor_channel_removal_impact` (podem ter mudado pela M10a); a Task 3 manda partir da última migration.
- O nome da fábrica de linhas dos testes de `load.ts`, do helper de semente de unidades da M3b, do formatador dd/mm em `fmt.ts`, e o caminho de `canEditSite`/`canAdminSite`: conferidos por `grep` em cada tarefa.
- Se a tela do mockup 18 da A5 chega ao `staging` antes da Task 11 (D-M5-5 cobre os dois casos).
- O custo de `obs_archive_pagina` no caso cheio (medido na Task 2, Passo 4).
- Se o relógio do banco pode ser simulado para a semente de Gio (Task 14, Passo 2).
