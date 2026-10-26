# Fase de manutenção (NAS e forja), M5: as telas. Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** as telas do Observatório passam a saber que a série online começa numa data lida do registro (`online desde`) e a dizer "desde dd/mm" e "no arquivo" no lugar de um número inventado; nasce a página **Arquivo** (peça 2) só de leitura, com o bloco "Canais removidos" só de leitura; a fila "Saíram do YouTube" ganha a leitura da peça 7; o aviso do banco passa ao `18-v2` (peça 5), com a marca "N canais removidos pedem um comando seu" ao lado da pastilha; e, no mesmo release, as classes `serie` e `horaria` ficam liberadas na política (condição 1 do portão, `02` §10.5).

**Architecture:** uma migration (`*_manutencao_m5_telas.sql`, rascunho em `supabase/rascunhos/m5.sql` até a Tarefa 13, TRAVA M5-1) cria cinco leitores só de leitura (`obs_archive_online_since`, `obs_archive_pagina`, `obs_archive_aviso`, `obs_archive_horaria_desde`, `obs_archive_removed_channel_list` v2), estende `obs_archive_channel_archive_impact` (a parcela "no arquivo" do diálogo de remover), corrige o `desde` de `competitor_hourly_health` da A5 e libera as duas classes. A página Arquivo lê **uma** função (`obs_archive_pagina`, só na rota `/arquivo`); o chrome do Observatório lê só a leve (`obs_archive_aviso`, com cache de 60 s depois da guarda). No site, módulos puros em `apps/web/src/lib/youtube/observatorio/arquivo-mensal/` (online desde, estado do mês, frases da página, bloco de canais removidos, aviso v2) e leitores de servidor que os alimentam; as telas consomem só os modelos puros. O carregador troca o teto de 365 dias pelo `online desde` num commit só (pedido 11).

**Tech Stack:** PostgreSQL 17 (Supabase), Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript strict, Zod, Vitest (node, jsdom), `pg` nos testes de integração, Playwright e chrome-devtools (Gio).

**1ª revisão (14/10):** este plano foi consertado a partir dos pareceres de Phil (`.superpowers/sdd/manutencao-nas/revisao-plano-m5-phil.md`) e de Yannis (`...-yannis.md`); a tabela achado → onde ficou está em `.superpowers/sdd/manutencao-nas/resolucao-plano-m5.md`, e a seção "Onde Phil e Yannis divergiram" abaixo diz qual lado foi escolhido e por quê.

**Spec:** `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/` (aprovado em 14/10, commit `8b4dd7b61`). Trechos desta etapa: `05` §15.1 linha M5 (e linha M3b, "quando a página do Arquivo nascer (M5), o bloco 'Canais removidos' só de leitura"), §17 pedido 11; `04` §14 (vocabulário, três ausências, quem vê), §14.1 (peça 1, inteira), §14.2 (peça 2: estados do mês, de problema, grupo "Dado de teste", bloco "Canais removidos"), §14.5 (peça 5), §14.7 (peça 7, parte de leitura), §14.8, §14.9, §14.12; `02` §10.3 (classe liberada), §10.4 (`obs_archive_online_since`); `06` §18 itens 34 a 39, 81 a 87, 121 (parte de leitura), 163 (parte M5: bloco só de leitura e marca).

**Fonte das telas (manda sobre o spec onde divergem; não se redesenha):** mockup 19 (`docs/superpowers/mockups/2026-10-14-manutencao-nas/19-mes-fora-do-banco/`: `series.html` + `series.js` peça 1; `arquivo.html` + `arquivo.js` + `arq-dados.js` peça 2 e bloco; `peca7.html` + `peca7.js` peça 7; `m19.css` tokens e formas; `NOTAS.md`), `18-v2` (`docs/superpowers/mockups/2026-10-13-a5-lote-2/18-aviso-banco-limite/18-v2.html`, `bl2.js`, `bl2.css`, `NOTAS-18-v2.md`), base comum em `.../2026-10-14-manutencao-nas/PLANO-DAS-TELAS.md` §1. Aprovação do dono de todas as peças: índice dos planos, linha 6 (M4 concluída em 14/10).

**Planos que este consome (por `grep`, sem copiar):** M2 (`...-m2-particoes.md`: `obs_partitions_months_ahead()` linha 1307, `obs_archive_rehearsal`); M3b-site (`...-m3b-site.md`: registro, `obs_archive_policy()` D12, `obs_archive_b2_month_state`, `obs_archive_first_month`, `obs_archive_removed_channel_list`, `obs_archive_owner_pending` e `pendenciasParaTela` E-D2/E-D4, `estado-remocao.ts` e `capacidades.ts` Tarefa 9, `BLOCO_CANAIS_REMOVIDOS`); contrato `.superpowers/sdd/manutencao-nas/contrato-rotas-m3b.md` r2.5 (C8 batimento, C9 desfechos, C12 pendências). Código atual do SQL da M3b: `supabase/rascunhos/m3b.sql` (vira migration na Tarefa 10 da M3b). **Onde o código e o contrato da M3b divergem do spec, valem o código e o contrato** (brief da onda 2).

---

## Global Constraints

- **Next 16:** antes de escrever página, layout, Server Action ou `searchParams`, ler `apps/web/AGENTS.md` e o guia correspondente em `node_modules/next/dist/docs/` da **raiz** do repositório (workspaces: o pacote sobe para a raiz; o redator não pôde conferir o caminho, a leitura de `node_modules` é negada a ele: a Tarefa 0, Passo 4, confere) (App Router: `page`, `searchParams` como `Promise`, `dynamic`). `searchParams` é `Promise` (padrão de `competitors/mudancas/page.tsx:13-16`).
- **`next/link` nunca vai como prop de Server Component para client component;** link dentro de componente client é importado no próprio módulo `'use client'` (padrão de `_chrome/tabs.tsx:3`) ou passa por `src/app/cms/(authed)/_shared/cms-link.tsx`.
- **Server Action não é importada em client component;** vai por prop a partir da página (padrão de `mudancas/page.tsx:19`). Esta etapa não cria ação de escrita (só leitura); a única exceção seria o grupo "Dado de teste", cujo botão é da M6 (D-M5-6).
- **Telas de dados** (`feedback_telas_cor_e_simbolo`): frase-resumo no topo com número, mês e data; régua ou barra por peça; cada estado por cor **e** forma (círculo com visto, círculo pontilhado neutro ou âmbar, triângulo âmbar com "!", octógono vermelho com "!", hachura rosa, caixa de arquivo, caixa vazada com 0); legenda num só lugar ("Como ler as formas"); método só no ⓘ; nenhum bloco só de prosa nem só de uma cor; o que está bem recua (cinza com verde pequeno).
- **Cor:** só tokens já existentes, hex ou `rgba()` literal; **nenhum `color-mix()`** em borda, fundo, texto ou forma (Opera do dono). `--warning-text` para texto âmbar; `--danger` só no símbolo e na borda, texto da linha em `--text`; `--dir-up`, `--dir-dn`, `--forja` e `--border-strong` proibidos em estado (`PLANO-DAS-TELAS.md` §1.2).
- **Vocabulário** (`04` §14, item 38): na tela, fora do ⓘ, nunca "lote", "unidade", "selar", "selado", "selagem", "partição", "cadeia", "atestação", "hash", "ensaio", "restauração", "divergente", "ambiente", "tabela", "linhas", "MB", "toco", "congelado", "congelamento", "estágio", "classe". Exceções declaradas do mockup: "snapshot(s) do NAS", "lido em dd/mm".
- **As três ausências nunca viram zero, vazio nem verde:** "não respondeu" (a casa; triângulo até 36 h, octógono a partir de 36 h, sempre com data e hora do último sinal), "não medido" (hachura rosa com o que não foi lido), "no arquivo" (caixa de arquivo com a data). Toda lista que pode vir vazia tem zero medido (caixa `--im-zero`) e não medido (hachura).
- **Uma data só, lida de uma função:** nenhum arquivo de tela escreve 365, 180 ou data de início de coleta à mão (item 83).
- **Quem vê** (`04` §14): peça 1 todo mundo (o mesmo texto, sem máquina, arquivo nem comando); página Arquivo, bloco, peça 7 e aviso do banco só quem edita (`requireSiteScope({ area: 'cms', siteId, mode: 'edit' })`, exposto como `permissoesDoSite(siteId).podeEditar` em `_chrome/permissoes.ts`, Tarefa 9); "Ver os comandos" e a linha do dono só quem administra (`canAdminSiteUsers` de `lib/youtube/competitor-admin.ts:7`, exposto como `permissoesDoSite(siteId).canUnlock`; E-D4 da M3b). **`canEditSite` e `canAdminSite` não existem no repositório** (Yannis I-1): quem os escrever em código novo está inventando. A leitura de quem só edita passa pelo cliente de serviço **só depois** da guarda de edição; nunca `grant ... to authenticated` (a exceção à regra de RBAC do CLAUDE.md fica escrita em `docs/ops`, Tarefa 16).
- **390 e 1440 px, claro e escuro,** alvo de toque 44 px, sem rolagem horizontal, foco visível, Esc fecha e devolve o foco, movimento reduzido, contraste 3:1 em forma e 4,5:1 em texto, escala de cinza com a linha de problema à frente.
- Migration nova só por `npm run db:new manutencao_m5_telas` (Tarefa 13), nunca à mão. Idempotência: `create or replace function`, `drop ... if exists` antes de `create policy/trigger`. Funções novas em `public`: `security definer`, `set search_path = ''`, `revoke all ... from public, anon, authenticated`, `grant execute ... to service_role` (produção já tem `20261014000007`, A5: função nova nasce sem EXECUTE para anon/PUBLIC).
- Todo `db:push:prod` é do dono, precedido de `npx supabase migration list --linked`, e só segue se as pendentes forem exatamente as do dia (`05` §16). Fora de 11:30 a 13:00 UTC e dos minutos 0, 20 e 40.
- Testes com banco: `describe.skipIf(skipIfNoLocalDb())`, banco `bythiago_int` (API 54421, Postgres 54422; **nunca** o 54322, que é do navegador), `--no-file-parallelism`, rascunho aplicado dentro de `begin … rollback`, a trava de DDL do helper `travarDdl` (lock 7339001) na 1ª instrução. O relógio do banco é simulável: `select set_config('obs_archive.hoje', 'AAAA-MM-DD', true)` e `'obs_archive.agora'` (`m3b.sql:420` e `:1441`). Componente: `// @vitest-environment jsdom`; módulo de servidor e sanitizer: `// @vitest-environment node`.
- TypeScript strict, sem `any`, Zod na borda (`.safeParse`, nunca `as`); kebab-case; commits `tipo: descrição`, um por tarefa, por caminho explícito (`git add -- <novos>` e `git commit -- <caminhos>`), no `staging`; nunca `git add -A`, stash ou reset. Mensagem termina com `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Arquivo que outra trilha está mexendo sem commit:** antes de editar qualquer arquivo de "Modify", `git diff --stat -- <arquivo>`; mudança alheia → não editar, registrar no ledger (`.superpowers/sdd/manutencao-nas/m5-progresso.md`) o arquivo, o autor provável e a hora, e seguir com a tarefa seguinte que não o toque.
- **O sistema falha em VERDE.** Toda tarefa diz o que acontece quando o dado NÃO existe (função ausente, nenhum mês saiu, lista vazia, variável apagada, casa sem batimento) antes do que acontece quando dá erro.
- Variável com padrão: `OBS_ARQUIVO_LIMPEZA_CANAL` (só `on` é "sim"; já tem teste da M3b) e `OBS_ARQUIVO` (só `on` liga). Esta etapa não cria variável nova, e todo teste de variável **apaga** a variável (`delete process.env.X`) e afirma sobre o padrão.
- **Tempo nos módulos novos:** `number` (ms) em tudo que é puro; `Date` só na borda, quando uma função existente a pede (`corDaRemocao`, `pendenciasParaTela` recebem `agora: Date`). O relógio da página é `Date.parse(lido_em)` com `lido_em = obs_archive_agora()` do banco (Phil M5).
- **`explain analyze` antes de aceitar uma leitura nova** (Tarefa 2, Passo 4): acima de 1,5 s a página, ou 400 ms o aviso, é achado para Phil.
- Sem datas-meta; só relógio real.

## Travas e ordem de execução

- **TRAVA M5-0 (dependências):** a Tarefa 1 só começa com (a) a M3b aplicada em produção e conferida (ledger `.superpowers/sdd/manutencao-nas/m3b-site-progresso.md`, linha "TRAVA M3b-2 solta"); (b) `git ls-files apps/web/test/helpers/m3b.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-remocao.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/pendencias.ts` listando os quatro. Faltando um: registrar a espera no ledger e parar.
- **TRAVA M5-1:** nenhum arquivo `*_manutencao_m5_*` em `supabase/migrations/` antes da Tarefa 13. Até lá o SQL vive em `supabase/rascunhos/m5.sql`, lido pelos testes por `M5_SQL_CAMINHO` (um só lugar: `apps/web/test/helpers/m5.ts`).
- **TRAVA M5-2 (pedido 11):** a Tarefa 4 (troca do teto de 365 dias em `load.ts`, `load-channel.ts` e `series.ts`) só começa com a janela combinada com o controlador da A5 registrada no ledger ("janela pedido 11: <data hora>, combinada com <quem>"). Sem resposta até o dia em que as Tarefas 1 a 3 fecharem, a fase faz a troca assim mesmo (texto do pedido 11, coluna "Se não entrar"): relê os três arquivos no dia, faz a troca num commit só e resolve o conflito no próprio commit.
- **TRAVA M5-3 (liberação, reescrita na 1ª revisão):** a parte 4 do rascunho (liberar `serie` e `horaria`) entra na mesma migration das partes 1 a 3. O código das Tarefas 4 a 11 é commitado tarefa a tarefa no `staging` (que não é produção) e vai ao `main` **no push final** da Tarefa 13, depois do `db:push:prod`. Para que o `staging` e uma inversão de ordem sobrevivam **sem** as funções novas, o código trata função ausente (`42883`/`PGRST202`) assim: `obs_archive_online_since` ausente = `{ lido: true, nulos }` (nada saiu: verdade, porque nenhuma saída existe antes da migration da M5, e as funções de saída são da M6, de migration posterior; **só enquanto `SAIDA_DE_MES_EXISTE` for `false`**, dívida D-M5-15), `obs_archive_aviso` ou `obs_archive_pagina` ausente = a aba e a pastilha novas não aparecem. Nenhuma saída de mês é possível antes da M6; o teste do item 87 segura o resto da ordem: `serie` liberada com `DAILY_MAX_DAYS` ainda no carregador falha. Texto completo na Tarefa 13.
- **Emenda 26/10 (Yannis I-4):** o `staging` é promovido à `main` por árvore 1×/dia, então o código de cada tarefa vai à produção antes da migration da M5; o caminho "função ausente" (`obs_archive_online_since` ausente = nada saiu) é o de produção até a Tarefa 13, e o "staging não é produção" da TRAVA M5-3 vale só como intenção. Cada commit das Tarefas 4 a 11 tem de ser seguro em produção sem a migration, e o revisor de cada tarefa o prova. A conferência do Gio sobre `viewsAtAge` (a consulta que conta os vídeos afetados está no parecer do Phil, `rev-m5-t4-phil.md`, M5) acontece no dia da promoção que levar a Tarefa 4, não na Tarefa 14. A Sentry "ausente" sai 1× por instância; `SAIDA_DE_MES_EXISTE = true` (M6) só vai à `main` depois do `db:push:prod` da M5.
- **TRAVA M5-4 (reserva da tela do aviso):** antes de começar a Tarefa 11, a M5 escreve em `.superpowers/sdd/manutencao-nas/reserva-tela-18.md` "M5 reservou `_chrome/aviso-banco/*` e `aviso-v2.ts` em <data hora>" e confere se a A5 escreveu a mesma reserva antes; quem chegou depois espera ou implementa só a diferença (D-M5-5). Sem isso, duas trilhas desenham a mesma tela.
- Ordem: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16. As Tarefas 7, 8, 10 e 11 são independentes entre si depois da 2 e podem correr em paralelo (agentes Sonnet, um por tarefa, sem tocar o mesmo arquivo).

## Review Focus

1. **A função `obs_archive_online_since` ausente, com erro ou com `{lido:false}` no carregador.** Esperado: a série é lida inteira desde `seriesStart` (o dado fora do banco não está na tabela-mãe, então ler tudo é sempre correto); `erro_do_banco`/`fora_do_esquema`/`divergencia` mostram "Não foi possível ler desde quando há dado online." no lugar do "desde dd/mm"; função ausente (`42883`/`PGRST202`) vale "nada saiu" **só com `SAIDA_DE_MES_EXISTE = false`** (decisão 1 de "Onde Phil e Yannis divergiram" e D-M5-15); com `true` vale `{ lido: false, porque: 'funcao_ausente' }`, ou seja, "não medido"; e as medidas que pedem ponto mais velho que a janela mínima garantida (181 dias para `serie`, 89 para `horaria`: a menor soma de dias de 3 meses seguidos, fevereiro incluído) saem "não medido"; nada assume 365 dias, nada interpola. Teste na Tarefa 4 (`online desde não lido`).
2. **`viewsAtAge` pedindo idade anterior ao primeiro ponto de um vídeo cortado.** Hoje (`series.ts:75-90`) o laço começa em `earliestIdx` e, se o primeiro ponto já é posterior à idade pedida, interpola entre os dois primeiros pontos, ou seja, extrapola para trás. Esperado: `null` (a tela diz "no arquivo desde dd/mm"). Teste na Tarefa 4 (`14 dias de vídeo cortado`).
3. **Casa sem batimento nenhum (forja nunca instalada) com mês devido.** Esperado: "A casa não respondeu desde <data do último sinal>" ou, sem sinal nunca recebido, "A casa ainda não deu sinal" em triângulo, nunca "Em coleta" nem verde. Teste na Tarefa 7 (`casa sem batimento`).
4. **Nome de canal removido com 100 caracteres, e canal removido pela vigia sem nome nem data.** Esperado: rótulo com reticências e nome inteiro em `title` e `aria-label`; frase de alerta quebra sem cortar; linha da vigia usa o código interno (8 caracteres) e a faixa de meses, nunca "removido em" sem data. Teste na Tarefa 8 (`nome longo` e `linha da vigia`).
5. **Perfil "só lê" chegando à URL da página Arquivo pela barra de endereço.** Esperado: a página responde com "Esta página é de quem edita o site." e "Voltar para Canais", sem ler o registro (nenhuma chamada ao cliente de serviço), e a aba não aparece. Teste na Tarefa 9 (`só lê pela URL`).
6. **Página que nasce sem linha de registro (Phil C1).** Casa nunca instalada ou parada antes do 1º mês: a página tem de mostrar o mês devido, atrasado, com "Copiando: 0 de N canais" ou "Cópia atrasada há N dias", nunca "A primeira cópia é a de outubro" com novembro atrasado. Testes da Tarefa 2 (`C1`) e da Tarefa 7 (`semLinha`).
7. **O aviso do chrome não pode custar uma `obs_archive_pagina` por navegação (Phil I9).** Testes da Tarefa 11 (o chrome nunca chama a página) e medida da Tarefa 2, Passo 4.
8. **Vermelho que a página não conhece (Phil I1).** Esperado: linha genérica em octógono, nunca engolido. Teste da Tarefa 7.

---

## Decisões deste plano (para Phil e Yannis; nenhuma muda regra do spec sem dizer)

| # | Decisão | Por quê |
|---|---|---|
| D-M5-1 | **`online desde` não lido: a série é lida inteira e só a rotulagem cai em "não medido".** A janela mínima garantida pela política (`window_months` de `obs_archive_policy()`: 6 meses seguidos, ≥181 dias para `serie`; 3 meses seguidos, ≥89 dias para `horaria`, derivada por `minDias(n)` em `online-desde.ts` e travada contra a política por teste) separa o que é seguro mostrar. **Exceção com prazo de validade: função ausente = "nada saiu" só enquanto `SAIDA_DE_MES_EXISTE` for `false`** (Yannis I-3, D-M5-15) | `02` §10.4 e item 35 pedem "não medido" e proíbem os 365; apagar o Observatório inteiro por um erro de leitura do registro seria falha vermelha desnecessária; o dado fora do banco não está na tabela-mãe, então nada lido é falso |
| D-M5-2 | **`obs_archive_removed_channel_list` ganha versão 2** com `nome` (`name_at_removal`, nulo na linha da vigia), `removido_em` (`removed_at`), `meses` e `registros` (**só do conjunto corrente de unidades; nulos, não zero, quando o canal não tem unidade**: `units_at_removal` conta unidades, não meses, `m3b.sql:2449-2452`), `primeiro_mes`, `ultimo_mes` (do conjunto, com o retrato `first_month`/`last_month` como reserva) para toda linha; contrato `versao: 2`, leitor estrito novo. **"Nome anulado ao concluir" não existe em código nenhum** (Phil M8): vira requisito da M9 no ledger (Tarefa 16), e esta decisão não o promete | O mockup aprovado (`arq-dados.js:75-85`) diz "Viagem Lenta, removido em 28/04/2028. Limpeza pedida: 14 meses, de 10/2026 a 11/2027"; a v1 da M3b exclui o nome ("Nunca `name_at_removal`", plano M3b-site, Tarefa 8). O nome de canal do YouTube é público (o dono o vê em qualquer canal: `feedback_visivel_nos_outros_e_publico`); continua fora do `audit_log` e do C12 |
| D-M5-3 | **Uma leitura só para a página: `obs_archive_pagina(p_site) returns jsonb`**, que parte de uma **grade** (classe, tabela, mês) do início da classe até o mês corrente com `left join` no registro (a linha de `obs_archive_months` só nasce com a 1ª unidade recebida: Phil C1), com `devido_em` de cada mês, o progresso de cópia por canal dos meses sem selo (`obs_archive_expected_units` contra `obs_archive_current_units` e `obs_archive_is_terminal`), a última recuperação por (classe, tabela) com o `schema_fp_atual`, o batimento dos três programas, `online_since`, `first_month` por classe (lido de `obs_archive_switch`, sem gravar), os meses à frente (`obs_partitions_months_ahead()`), o estado do grupo de teste e os vermelhos e o atraso do pulso. **O chrome lê só `obs_archive_aviso`**, a versão leve (Phil I9). O estado de cada linha é derivado em TS puro (`estado-do-mes.ts`) | Um RPC por página (sem N+1); regra de tela testável sem banco; a função só lê (`stable`), nunca grava `first_month` (diferente de `obs_archive_first_month`, que grava) |
| D-M5-4 | **Libera `serie` e `horaria`; `texto`, `video_antigo` e `ensaio` continuam fechadas.** | Linha M5 do `05` §15.1 ("a classe `serie` fica liberada") e item 87, cuja frase final diz que "a primeira saída real é a da leitura horária": a peça 1 (as 72 horas) e o `competitor_hourly_health` corrigido estão nesta etapa. `texto` é da onda 2 (frase digitada, M6); `video_antigo` é da M10b |
| D-M5-5 | **O aviso do banco: se a tela do mockup 18 da A5 não estiver no `staging` no dia da Tarefa 11, esta fase implementa o `18-v2` inteiro** (que é o 18 aprovado mais a diferença), consumindo `aviso.ts` e `sinal-do-banco.ts` da E10 sem editá-los, e avisa o controlador da A5 no ledger | Hoje nenhum componente desenha o 18 (`grep -rln "Quase cheio" apps/web/src` só acha `sinal-do-banco.ts`); o plano da E10 (linha 8) deixa a tela fora dele; `04` §14.9 ponto 3 manda implementar só a diferença, mas não há base para ela |
| D-M5-6 | **Grupo "Dado de teste" só de leitura nesta etapa; o botão "Encerrar o dado de teste" e a ação são da M6** | O botão só aparece com "a recuperação testada e o descarte de teste feitos" (`04` L199); o descarte nasce na M6; desenhar o botão aqui seria código que nunca renderiza |
| D-M5-7 | **Os espaços do interruptor (peça 4) e de "Vídeos antigos" (peça 8) não vão à produção** como tracejado: o cartão do tipo simplesmente não os tem até a M6 e a M10b | O tracejado "+ novo" é marca do mockup (`PLANO-DAS-TELAS.md` §1.1), não estado de produção |
| D-M5-8 | **Peça 7, parte de leitura:** o bloco "Esperam você rodar os comandos" com a frase-resumo, a barra de idade (0 a 60 dias) e a linha fixa `LINHA_DO_DONO` (só quem administra); sem "Já rodei" (M9) | Plano M3b-site, linhas 3772 e 3805: "a tela: M5; os tempos com passo e 'Já rodei': M9" |
| D-M5-9 | **"Meses à frente acabando"** lê `obs_partitions_months_ahead()` (M2) dentro de `obs_archive_pagina`; tabela não convertida (`months_ahead` nulo) é "não medido", e `months_ahead = -1` ("o mês corrente não existe") tem frase e octógono próprios, nunca "0 meses" nem "−1 meses" | A frase do `04` L190 depende disso; a M2 já a vigia na agenda; `-1` e nulo são os dois valores especiais da função (`m2.sql:440-475`) |
| D-M5-10 | **Impacto da remoção em duas parcelas, sem recriar `competitor_channel_removal_impact`.** "No banco agora" é a função da A5 como está; "no arquivo" é `obs_archive_channel_archive_impact` (M3b) estendida com `registros` e `por_tabela`; **a soma do diálogo usa só `fora_do_banco.registros`/`.meses`** (Phil r2 N2); nenhum campo do arquivo diz "dias" | Os resumos do arquivo não têm dias (`m3b.sql:184-203`); recriar a função da A5 de cabeça apagaria a extensão da migration de leitura horária (Phil I6, Yannis I-8) |
| D-M5-11 | **`desde` da horária por `obs_archive_horaria_desde`** (mês fora → 1º dia do mês mais antigo à meia-noite de São Paulo, precisão `mes`; senão a 1ª hora lida, precisão `hora`). Nunca `min_key` | `first_month::timestamptz` mostra 30/09 em UTC (Yannis I-14); `min_key` não tem formato verificado |
| D-M5-12 | **Coleta por vídeo = `max(seriesStart, dia SP de channel.added_at)`** na peça 1 (`antes_da_coleta`) | Um canal adicionado depois do começo da série não tem coleta anterior a `added_at`; sem isto o vídeo diz "no arquivo" de um dado que nunca existiu (Phil I8) |
| D-M5-13 | **A peça 7 sem a E9 nasce como seção própria do filtro `sairam`** e a E9 a move depois | A E9 não está no `staging` (Yannis I-11); a M9 espera a peça 7 em `_saiu/*` |
| D-M5-14 | **A M6 encaixa em slots (`acoes?: ReactNode`) por linha e por cartão** e lê `reattach_out_of_order` já presente no JSON. **Quem encaixa as peças de `_arquivo-saida/` é a M6** (`montar.ts`, no servidor, preenche `acoes` depois de `montarPagina`, que continua `.ts` puro); a M5 nunca importa `_arquivo-saida/`. O plano da M6 diz o contrário em vários trechos; o que ele precisa mudar está em `.superpowers/sdd/manutencao-nas/pedidos-m6-para-m5.md` (Yannis r2 N-3) | Yannis I-12 e r2 N-3; a página funciona antes e depois da M6 sem trocar a ordem de deploy; cada lado esperando o outro era o risco |
| D-M5-15 | **Dívida declarada: "função ausente = nada saiu" tem gatilho de validade.** Constante `SAIDA_DE_MES_EXISTE = false` em `arquivo-mensal/capacidades.ts`; a M6 a vira `true` **no mesmo commit da primeira função de saída** (requisito no ledger e em `pedidos-m6-para-m5.md`). Com `true`, `lerOnlineDesde` com função ausente devolve `{ lido: false, porque: 'funcao_ausente' }` (série lida inteira, peça 1 em "não medido"), com Sentry de erro. Gatilho de pagamento: aplicar a migration da M6 em produção | Phil r2 N1, Yannis r2 §4: depois da M6 um `PGRST202` (cache de esquema velho, migration desfeita) com "nada saiu" seria falha em verde: série com buraco, sem `truncated` e sem aviso |

### Onde Phil e Yannis divergiram (a escolha mais segura, anotada)

| Tema | Phil | Yannis | Escolha |
|---|---|---|---|
| Função `obs_archive_online_since` ausente | D-M5-1: não lido (série inteira, frase "não foi possível ler") | I-3: "nada saiu" (`{lido:true, nulos}`), porque sem a migration da M5 não há saída possível | **Yannis** para função ausente (nenhuma saída pode ter acontecido, e a alternativa travava a TRAVA M5-3 em commits por tarefa); **Phil** para `erro_do_banco`, `fora_do_esquema` e `divergencia` (erro real = não medido). Sentry de aviso nos dois |
| Onde o aviso do banco lê | I9: função leve nova (`obs_archive_aviso`), página só em `/arquivo` | I-10: o chrome decide aba e pastilha pela guarda memoizada | **Os dois**, porque tratam camadas diferentes: a guarda decide **se** lê, a função leve decide **o que** lê; `unstable_cache` de 60 s só depois da guarda |
| `desde` da horária | I7: nunca o `min()` cru; precisão mês/hora | I-14: `::timestamptz` mostra 30/09; usar fuso SP | **Os dois**: `obs_archive_horaria_desde` com fuso SP e precisão |
| Impacto da remoção | I6: usar a função da M3b, sem dias | I-8: duas parcelas | **Os dois**: duas parcelas, a do arquivo vem de `obs_archive_channel_archive_impact` |
| Datas fixas em tela (item 83) | M-: lista fechada | I-9: `INICIO_DAS_MARCAS` é exceção a nomear | **Yannis**: única exceção nomeada com motivo, sujeita à confirmação de Phil (Tarefa 16); nunca silenciosa |
| `explain analyze` e cache da página | M6: medir; acima de 1,5 s, cache | — | **Phil**: medir na Tarefa 2; cache de 60 s só se passar do limiar |

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `supabase/rascunhos/m5.sql` e `gerar-m5-parte3.py` | rascunho da migration, em 4 partes (`-- M5 PARTE n`); o script gera a `competitor_hourly_health` nova a partir da migration da A5 | 1, 2, 3, 13 |
| `apps/web/test/helpers/m5.ts` | caminho do rascunho, `aplicarM5(c, ate?)`, `M5_EM_MIGRATION` | 1, 13 |
| `apps/web/test/integration/manutencao-m5-leitores.test.ts` | integração das funções SQL | 1, 2, 3 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/online-desde.ts` | Zod + leitor do `online desde` por tabela; `janelaMinima` | 4 |
| `apps/web/src/lib/youtube/observatorio/load.ts`, `load-channel.ts`, `series.ts`, `types.ts` | troca do teto de 365 dias (pedido 11) | 4 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/peca1.ts` | frases e formas da peça 1 (puro) | 5 |
| telas de série (`_historico/`, `_canal/`, `_comparar/`, `_outliers/`, comentários de destaque) | consumir a peça 1 | 5 |
| `apps/web/src/lib/youtube/horaria/prova.ts`, `competitor-removal-impact.ts`, `observatorio/medidas/ler.ts` | leitores das séries (`04` §14.1, tabela "Quem lê") | 6 |
| `apps/web/test/manutencao/leitores-das-series.test.ts` | a lista fechada por busca (item 82) e o 365/180 (item 83) | 6 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pagina.ts` | Zod + leitor de `obs_archive_pagina` | 7 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-do-mes.ts`, `vermelhos.ts` | estado, régua, frase e forma de cada mês e de cada problema, a casa e os vermelhos do pulso (puro) | 7 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/info.ts` | `INFO()` (o ⓘ marcado, fora de `app`) | 9 |
| `apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/permissoes.ts` | `permissoesDoSite` com `cache()` do React (extraída de `page.tsx`) | 9 |
| `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/pendencias-da-fila.ts` | leitura de `obs_archive_owner_pending` atrás da guarda | 10 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/aviso-leve.ts` | leitor de `obs_archive_aviso` com `unstable_cache` de 60 s | 11 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/canais-removidos.ts` | leitor v2 + modelo do bloco (puro) e da marca | 8 |
| `apps/web/src/app/cms/(authed)/youtube/competitors/arquivo/page.tsx` | a rota da página | 9 |
| `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo/*` | componentes da página (formas, régua, cartão do tipo, bloco, legenda) e `arquivo.css` | 9 |
| `apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/view-model.ts`, `tabs.tsx` | aba "Arquivo" (só quem edita) | 9 |
| `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/*` (fila) | peça 7, parte de leitura | 10 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/aviso-v2.ts` + `_chrome/aviso-banco/*` | peça 5 (`18-v2`) e as marcas ao lado da pastilha | 11 |
| `apps/web/test/manutencao/vocabulario-das-telas.test.ts` | item 38 | 12 |
| `apps/web/test/manutencao/classe-liberada.test.ts` | item 87 | 13 |

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
- [ ] **Passo 4. Next 16.** Ler `apps/web/AGENTS.md` e, em `node_modules/next/dist/docs/` **da raiz do repositório** (o workspace sobe o pacote para a raiz; `ls node_modules/next/dist/docs | head` confirma, e se estiver em `apps/web/node_modules/next/dist/docs/` anotar o caminho certo no ledger), os guias de `page.js`, `searchParams`, `dynamic` e Server Components. Anotar no ledger qualquer API que este plano usa e o guia marca como mudada (o plano usa: `export const dynamic = 'force-dynamic'`, `searchParams: Promise<...>`, `metadata`).
- [ ] **Passo 5. Estado da E9 e da peça 7.** `grep -rln "Esperam a sua resposta" apps/web/src` (em 14/10: nada; a E9 vive no worktree `wt-e9`, `37617d174`). Vazio → a Tarefa 10 usa o encaixe próprio (D-M5-13); achou → o bloco entra depois dele. Registrar no ledger e avisar o redator da M9 (que espera a peça 7 em `_saiu/*`).
- [ ] **Passo 6. Reserva do aviso (TRAVA M5-4)** e conferência de `ls docs/ops/runbook-arquivo-mensal.md` (a M3b-site Tarefa 14 o cria; em 14/10 só existe `docs/ops/observatorio-arquivo-runbook.md`).
- [ ] **Passo 7. Abrir os mockups no Opera do controlador** (não do dono) só para conferência visual: `series.html?e=todos-p1`, `arquivo.html?e=todos-meses`, `arquivo.html?e=todos-canais`, `peca7.html?e=cheia`, `18-v2.html?caso=v2`. Sem commit.

---

### Task 1: rascunho, parte 1: `obs_archive_online_since` e o helper de teste

**Files:**
- Create: `supabase/rascunhos/m5.sql`
- Create: `apps/web/test/helpers/m5.ts`
- Create: `apps/web/test/integration/manutencao-m5-leitores.test.ts`

**Interfaces:**
- Consumes: `aplicarM2`, `travarDdl` (`test/helpers/m2.ts:37,42`), `aplicarM3b`, `q1`, `semearCanal`, `SITE_TESTE` (`test/helpers/m3b.ts`), `M10A_SQL` (`test/integration/video-antigo-m10a-caminho.ts`); `obs_archive_months`, `obs_archive_switch` e `obs_archive_policy()` da M3b (`m3b.sql:9, 113, 150`); a convenção de nome de partição `obs_part.nome_da_particao` = `<tabela>_AAAAMM` no esquema `obs_part` (`m2.sql:42-45`).
- Produces: `public.obs_archive_online_since(p_site uuid) returns table (class text, table_name text, online_since date, divergencia boolean)` (só `horaria` e `serie`: Phil M2); `M5_SQL_CAMINHO`, `M5_EM_MIGRATION`, `aplicarM5(c, ate?)`, `prepararM5(c, ate?)`.

**O que acontece quando o dado não existe:** nenhum mês com `detached_at` ou `dropped_at` → `online_since` nulo ("nada saiu", a tela não muda). Site sem nenhuma linha no registro → uma linha por tabela da política, todas nulas (nunca zero linhas, que a tela leria como "não medido"). Classes `texto`, `video_antigo` e `ensaio` não voltam (nenhuma tela lê data de série nelas: Phil M2). **A saída é da tabela inteira, não do site** (`obs_partitions_ensure`, `m2.sql:400`, não tem `site_id`; a partição some para todos), então os meses fora são lidos sem filtro de site; o site entra só para ler `obs_archive_switch.first_month`. **Conferência barata contra o registro vazio mentindo** (Phil M2): se o registro diz "nada saiu" mas a partição mais antiga presente em `obs_part` começa depois do primeiro mês da classe (`obs_archive_switch.first_month`), `divergencia = true` e a TS devolve "não lido", nunca "nada saiu" (a falha em verde que esta tarefa existe para fechar).

- [ ] **Passo 1. Helper de teste e teste, falhando.** O helper junta o preparo que todas as integrações da fase usam (lock de DDL **na 1ª instrução** da transação, M2, M10a, M3b, M5: plano M6 linha "Teste"; Yannis R3-1):

```ts
// apps/web/test/helpers/m5.ts
/** Manutenção M5: o SQL vive em supabase/rascunhos/m5.sql até a Tarefa 13 (TRAVA M5-1). Único lugar que a Tarefa 13 muda. */
import type { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { aplicarM2, travarDdl } from './m2'
import { aplicarM3b } from './m3b'
import { M10A_SQL } from '../integration/video-antigo-m10a-caminho'

export const M5_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/rascunhos/m5.sql')
export const M5_EM_MIGRATION = false
export type ParteM5 = 1 | 2 | 3 | 4

/** O texto do rascunho até a parte `ate` (inclusive). Parte pedida que não existe, ou marcador faltando no meio, FALHA ALTO (nunca aplica "o que há"). */
export function sqlM5Ate(ate?: ParteM5): string {
  const sql = readFileSync(M5_SQL_CAMINHO, 'utf8')
  const partes = [...sql.matchAll(/^-- M5 PARTE (\d+)/gm)].map(m => Number(m[1]))
  const maior = partes.length ? Math.max(...partes) : 0
  if (ate === undefined) return sql
  if (ate > maior) throw new Error(`parte ${ate} não encontrada no rascunho (a maior é ${maior})`)
  if (ate === maior) return sql
  const fim = sql.indexOf(`-- M5 PARTE ${ate + 1}`)
  if (fim < 0) throw new Error(`marcador da parte ${ate + 1} ausente no meio do rascunho`)
  return sql.slice(0, fim)
}
export async function aplicarM5(c: Client, ate?: ParteM5): Promise<void> { await travarDdl(c); await c.query(sqlM5Ate(ate)) }

/** Logo depois de `begin`: lock, M2, M10a, M3b e a M5 até a parte pedida. */
export async function prepararM5(c: Client, ate?: ParteM5): Promise<void> {
  await travarDdl(c)
  await aplicarM2(c)
  await c.query(readFileSync(M10A_SQL, 'utf8'))
  await aplicarM3b(c)
  await aplicarM5(c, ate)
}
```

```ts
// apps/web/test/integration/manutencao-m5-leitores.test.ts
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { q1, SITE_TESTE } from '../helpers/m3b'
import { prepararM5 } from '../helpers/m5'

/** Banco de integração (54422), nunca o 54322 do navegador. */
const URL_INT = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54422/postgres'

describe.skipIf(skipIfNoLocalDb())('M5 parte 1: online desde', () => {
  // Yannis r2 N-4: `JANELA_MINIMA_DIAS` usa minDias(6)/minDias(3) fixos; este caso é o que de fato os trava contra a política. Acrescentar:
  //   it('window_months da política: serie 6, horaria 3', async () => { const r = await c.query(`select class, table_name, window_months from public.obs_archive_policy() where class in ('serie','horaria')`); for (const l of r.rows) expect(l.window_months, l.table_name).toBe(l.class === 'serie' ? 6 : 3) })
  let c: Client
  beforeEach(async () => { c = new Client({ connectionString: URL_INT }); await c.connect(); await c.query('begin'); await prepararM5(c, 1) })
  afterEach(async () => { await c.query('rollback'); await c.end() })

  const fora = (site: string, classe: string, tabela: string, mes: string, col: 'detached_at' | 'dropped_at') =>
    c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, ${col}) values ($1, $2, $3, $4, now())`, [site, classe, tabela, mes])
  const linha = (tabela: string) => q1(c, `select online_since::text as d, divergencia from public.obs_archive_online_since($1) where table_name = $2`, [SITE_TESTE, tabela])

  it('nenhum mês saiu: só horária e série, todas nulas, sem divergência', async () => {
    const r = await c.query(`select class, table_name, online_since, divergencia from public.obs_archive_online_since($1) order by 2`, [SITE_TESTE])
    expect(r.rows.map(x => x.table_name)).toEqual(['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly'])
    expect(r.rows.every(x => x.online_since === null && x.divergencia === false)).toBe(true)
    expect(new Set(r.rows.map(x => x.class))).toEqual(new Set(['serie', 'horaria']))
  })
  it('mês destacado conta como fora; trazer de volta recua', async () => {
    await fora(SITE_TESTE, 'serie', 'competitor_video_daily', '2027-04-01', 'detached_at')
    expect((await linha('competitor_video_daily')).d).toBe('2027-05-01')
    await c.query(`update public.obs_archive_months set detached_at = null where site_id = $1`, [SITE_TESTE])
    expect((await linha('competitor_video_daily')).d).toBeNull()
  })
  it('descartado e destacado: vale o mês seguinte ao último fora', async () => {
    await fora(SITE_TESTE, 'serie', 'competitor_video_daily', '2027-03-01', 'dropped_at')
    await fora(SITE_TESTE, 'serie', 'competitor_video_daily', '2027-04-01', 'detached_at')
    expect((await linha('competitor_video_daily')).d).toBe('2027-05-01')
  })
  it('a saída é da tabela, não do site: o mês de outro site também conta', async () => {
    await fora(randomUUID(), 'serie', 'competitor_video_daily', '2027-04-01', 'dropped_at')
    expect((await linha('competitor_video_daily')).d).toBe('2027-05-01')
  })
  it('registro vazio com a partição mais antiga depois do primeiro mês: divergência, nunca "nada saiu"', async () => {
    expect((await q1(c, `select relkind::text as k from pg_class where oid = 'public.competitor_video_daily'::regclass`)).k).toBe('p')
    await c.query(`insert into public.obs_archive_switch (site_id, class, first_month) values ($1, 'serie', '2020-01-01')`, [SITE_TESTE])
    const r = await linha('competitor_video_daily')
    expect(r).toMatchObject({ d: null, divergencia: true })
  })
  it('a função é só de service_role', async () => {
    const r = await q1(c, `select has_function_privilege('anon', 'public.obs_archive_online_since(uuid)', 'execute') as anon,
                                 has_function_privilege('authenticated', 'public.obs_archive_online_since(uuid)', 'execute') as auth,
                                 has_function_privilege('service_role', 'public.obs_archive_online_since(uuid)', 'execute') as svc`)
    expect(r).toEqual({ anon: false, auth: false, svc: true })
  })
})
```

- [ ] **Passo 2. Rodar e ver falhar.** `HAS_LOCAL_DB=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run apps/web/test/integration/manutencao-m5-leitores.test.ts --no-file-parallelism > .superpowers/sdd/manutencao-nas/saidas/m5-t1.txt 2>&1; grep -E "FAIL|✓|×" .superpowers/sdd/manutencao-nas/saidas/m5-t1.txt | head -20`. Esperado: FAIL (`ENOENT` do rascunho).
- [ ] **Passo 3. SQL.**

```sql
-- supabase/rascunhos/m5.sql
-- Manutenção M5: as telas (spec 2026-10-13-fase-manutencao-nas, 04 §14; 02 §10.4). RASCUNHO até a Tarefa 13 do plano M5 (TRAVA M5-1):
-- não mover para supabase/migrations à mão; o arquivo nasce por `npm run db:new manutencao_m5_telas`. Depende da M2, da M10a e da M3b em produção.

-- M5 PARTE 1: online desde (02 §10.4)
-- Por tabela de série (horária e série; o texto e o vídeo antigo não têm data de série): o 1º dia do mês seguinte ao último mês com detached_at OU
-- dropped_at. Nada saiu: nulo ("tudo online desde o começo da série"), nunca "sem dado". O mês destacado já conta como fora (a tabela-mãe não o lê).
-- A saída é da TABELA inteira (obs_partitions_ensure não tem site_id): os meses fora são lidos sem filtro de site. `divergencia`: o registro diz "nada
-- saiu" mas a partição mais antiga presente começa depois do 1º mês da classe (obs_archive_switch.first_month): a tela trata como NÃO LIDO.
create or replace function public.obs_archive_online_since(p_site uuid)
returns table (class text, table_name text, online_since date, divergencia boolean)
language plpgsql stable security definer set search_path = '' as $$
declare t record; v_rel regclass; v_min date; v_fm date;
begin
  for t in select distinct x.class as cl, x.table_name as tb from public.obs_archive_policy() x where x.class in ('horaria', 'serie') order by 1, 2 loop
    class := t.cl; table_name := t.tb; divergencia := false;
    select (max(m.month) + interval '1 month')::date into online_since from public.obs_archive_months m
     where m.class = t.cl and m.table_name = t.tb and (m.detached_at is not null or m.dropped_at is not null);
    if online_since is null then
      v_rel := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(t.tb));
      select s.first_month into v_fm from public.obs_archive_switch s where s.site_id = p_site and s.class = t.cl;
      if v_rel is not null and v_fm is not null and (select c.relkind from pg_catalog.pg_class c where c.oid = v_rel) = 'p' then
        select min(pg_catalog.to_date(pg_catalog.right(f.relname, 6), 'YYYYMM')) into v_min
          from pg_catalog.pg_inherits h join pg_catalog.pg_class f on f.oid = h.inhrelid join pg_catalog.pg_namespace n on n.oid = f.relnamespace
         where h.inhparent = v_rel and n.nspname = 'obs_part';
        divergencia := v_min is not null and v_min > v_fm;
      end if;
    end if;
    return next;
  end loop;
end $$;
revoke all on function public.obs_archive_online_since(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_online_since(uuid) to service_role;
```

- [ ] **Passo 4. Rodar e ver passar** (mesmo comando do Passo 2). Esperado: 6 PASS.
- [ ] **Passo 5. Commit.**

```bash
git add -- supabase/rascunhos/m5.sql apps/web/test/helpers/m5.ts apps/web/test/integration/manutencao-m5-leitores.test.ts
git commit -m "feat: rascunho da M5, parte 1: obs_archive_online_since (manutenção M5, 02 §10.4, item 35)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m5.sql apps/web/test/helpers/m5.ts apps/web/test/integration/manutencao-m5-leitores.test.ts
```

---

### Task 2: rascunho, parte 2: `obs_archive_pagina` (uma leitura para a página) e `obs_archive_aviso` (a leitura leve do chrome)

**Files:**
- Modify: `supabase/rascunhos/m5.sql` (acrescenta `-- M5 PARTE 2`)
- Modify: `apps/web/test/integration/manutencao-m5-leitores.test.ts`

**Interfaces:**
- Consumes (todas conferidas no rascunho da M3b): `obs_archive_policy()` (`m3b.sql:9`), `obs_archive_hoje_sp()` (`:420`) e `obs_archive_agora()` (`:1441`), os dois lidos do GUC `obs_archive.hoje`/`obs_archive.agora` (o relógio é simulável); `obs_archive_due_on(mês, margem)` (`:426`); `obs_archive_expected_units(site, classe, mês)` (`:436`, a "única definição" do devido, D19); `obs_archive_is_terminal(...)` (`:735`) e `obs_archive_current_units(site, classe, mês)` (`:742`, o `distinct on` sobre **todas** as versões, sem filtro de `purged_at`); `obs_archive_b2_month_state` (`:1912`); `obs_archive_b2_teto_cor` (`:1932`); `obs_archive_atraso` (`:2062`); `obs_archive_vermelhos` (`:2101`); `obs_archive_schema_fp(regclass)` (`:301`); `obs_archive_restores`, `obs_archive_heartbeat`, `obs_archive_switch`; `obs_partitions_months_ahead()` (M2, `m2.sql:440`). As funções acima são `security definer` do dono do banco: a chamada de dentro de outra `security definer` passa mesmo as que revogam `service_role` (`obs_archive_current_units`, `obs_archive_is_terminal`, `obs_archive_b2_teto_cor`).
- Produces: `public.obs_archive_pagina(p_site uuid) returns jsonb` e `public.obs_archive_aviso(p_site uuid) returns jsonb`, com as formas abaixo.

```json
{ "versao": 1, "lido_em": "<obs_archive_agora()>", "hoje": "2028-05-03",
  "casa": [ { "worker": "copiador|respondedor|conferir_b2", "last_poll_at": "...|null", "updated_at": "...|null", "version": "...|null",
              "machine_time": "...|null", "stopped_at_cap": "dia|mes|null", "nas_ok": true, "nas_checked_at": "...|null", "last_error": "...|null",
              "livre_bytes": {}, "total_bytes": {}, "sentinel_ok": {}, "mounts_ok": {} } ],
  "classes": [ { "class": "serie", "first_month": "2026-10-01|null", "released": true, "window_months": 6, "seal_margin_days": 28, "wait_days": 7 } ],
  "online_since": [ { "class": "serie", "table_name": "competitor_video_daily", "online_since": "2027-05-01|null", "divergencia": false } ],
  "meses": [ { "class": "serie", "table_name": "competitor_video_daily", "month": "2028-04-01", "devido_em": "2028-05-28", "tem_linha": true,
               "<as colunas fechadas de obs_archive_months, sem nenhum *_by, sem id nem site_id>": "...", "reattach_out_of_order": false,
               "b2": { "<as chaves de obs_archive_b2_month_state, menos `por`: atestada_em, via, forja_ok_at, dono_ok_at, forja_divergiu_em, retirada, ultima_tentativa, idade_dias>": "..." } } ],
  "progresso": [ { "class": "serie", "month": "2028-04-01", "canais_esperados": 45, "canais_prontos": 12, "canais_perdidos": 0 } ],
  "recuperacao": [ { "class": "serie", "table_name": "competitor_video_daily", "done_at": "...|null", "schema_fp": "...|null", "schema_fp_atual": "...|null", "diff_rows": 0 } ],
  "meses_a_frente": [ { "table_name": "competitor_video_daily", "months_ahead": 12, "last_month": "2027-10-01", "converted_at": "...|null" } ],
  "teste": { "aberto": true, "meses": [ { "month": "...", "sealed_at": "...", "nas_attested_at": "...", "b2_attested_at": "...", "detached_at": "...", "dropped_at": "...", "closed_at": null } ], "encerrado_em": "...|null" },
  "vermelhos": [ "nas_80:numerico", "atraso de cópia: 3 unidades há mais de 30 dias" ],
  "atraso": { "amarelos": 0, "vermelhos": 0, "mais_antiga": null, "meses_sem_selo": 0 },
  "teto_b2": "verde|ambar|vermelho" }
```

```json
{ "versao": 1, "lido_em": "...", "hoje": "2028-05-03",
  "proximo_mes": { "class": "horaria", "month": "2028-01-01", "pronto_em": "2028-05-08" } ,
  "primeira_devida_em": "2026-11-28", "ultima_copia": "...|null",
  "casa": [ { "worker": "copiador", "last_poll_at": "...", "updated_at": "...", "nas_ok": true, "nas_checked_at": "..." } ],
  "vermelhos_n": 0, "atraso": { "amarelos": 0, "vermelhos": 0, "mais_antiga": null, "meses_sem_selo": 0 } }
```

**Por que a página parte de uma grade e não das linhas do registro (Phil C1, o achado crítico).** A linha de `obs_archive_months` nasce **só** dentro de `obs_archive_record_core`, no 1º recebimento de unidade (`m3b.sql:686`, `insert ... on conflict do nothing`; não há outro `insert into public.obs_archive_months` no rascunho). Casa nunca instalada, ou parada antes do 1º mês: não existe linha para o mês corrente, para o mês na margem nem para o mês devido, e a tela diria "A primeira cópia é a de outubro…" com novembro atrasado 31 dias. Por isso a função monta a **grade** (classe, tabela, mês) do início da classe (`obs_archive_switch.first_month`, com o piso de 2026-10-01, a mesma conta de `obs_archive_expected_units` e `obs_archive_meses_devidos`, `m3b.sql:1989-2006`) até o **mês corrente**, com `left join` no registro (`tem_linha`, colunas nulas quando não há linha, `devido_em = obs_archive_due_on(mês, margem)` sempre). O progresso de cada (classe, mês) **sem selo** (`sealed_at is null or unsealed_at is not null`, o mesmo predicado de `obs_archive_atraso_itens`, `m3b.sql:2055-2058`) sai do devido de verdade (`obs_archive_expected_units`) contra o conjunto corrente (`obs_archive_current_units`, maior versão sem filtro de `purged_at`) e da regra terminal da M3b (`obs_archive_is_terminal`): unidade recebida e depois marcada para refazer (`redo_reason`) **não** conta como pronta. Contagem em **canais** (o dono lê "12 de 45 canais"): um canal está pronto quando **todas** as suas tabelas devidas na classe estão terminadas (a série tem 2 tabelas por mês e o texto 3: Phil M7). Mês com selo vale pelo registro (`units_total`, `units_empty`), sem chamar `expected_units`: só 1 a 2 meses por classe varrem unidades (Phil M6).

**O que acontece quando o dado não existe:** site sem canal e sem mês → a grade existe (um mês por tabela até o corrente), `tem_linha` falso em todos, `canais_esperados = 0` (a tela diz "A primeira cópia é a de outubro, a partir de dd/mm", calculado de `due_on`, nunca "0 meses"); sem batimento → `casa: []` (triângulo "A casa ainda não deu sinal"); tabela não convertida → `months_ahead` nulo (não medido); tabela da política ausente → `schema_fp_atual` nulo (não medido); `teste.aberto` falso sem linha `ensaio` aberta. A função **nunca grava** (`stable`; `first_month` lido de `obs_archive_switch`, sem chamar `obs_archive_first_month`, que grava).

- [ ] **Passo 1. Testes, falhando** (acrescentar ao arquivo da Tarefa 1; novo `describe` com `prepararM5(c)` sem parte; `import { semearCanal } from '../helpers/m3b'`):

```ts
describe.skipIf(skipIfNoLocalDb())('M5 parte 2: a página e o aviso', () => {
  let c: Client
  beforeEach(async () => { c = new Client({ connectionString: URL_INT }); await c.connect(); await c.query('begin'); await prepararM5(c) })
  afterEach(async () => { await c.query('rollback'); await c.end() })

  type Prog = { class: string; month: string; canais_esperados: number; canais_prontos: number; canais_perdidos: number }
  const hoje = (d: string) => c.query(`select set_config('obs_archive.hoje', $1, true)`, [d])
  const pagina = async () => (await q1(c, `select public.obs_archive_pagina($1) as p`, [SITE_TESTE])).p as Record<string, unknown> & { meses: Record<string, unknown>[]; progresso: Prog[] }
  const unidade = (canal: string, tabela: string, extra: { versao?: number; recebida?: boolean; redo?: string | null } = {}) =>
    c.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at, redo_reason)
             values ($1, 'serie', $2, $3, '2026-10-01', $4, 5, md5('a') || md5('a'), md5('s') || md5('s'), md5('b') || md5('b'), md5('c') || md5('c'), 100, ${extra.recebida === false ? 'null' : 'now()'}, $5)`,
      [SITE_TESTE, tabela, canal, extra.versao ?? 1, extra.redo ?? null])
  const DIARIA = 'competitor_video_daily', CEDO = 'competitor_video_early'
  const progDe = (p: { progresso: Prog[] }, classe: string, mes: string) => p.progresso.find(x => x.class === classe && x.month === mes)

  it('C1: dois canais, 40 dias depois de outubro, nenhuma unidade: o mês devido aparece, esperado 2, pronto 0, devido em 28/11', async () => {
    await semearCanal(c, { site: SITE_TESTE, videos: 0 }); await semearCanal(c, { site: SITE_TESTE, videos: 0 })
    await hoje('2026-12-10')
    const p = await pagina()
    const out = p.meses.find(m => m.class === 'serie' && m.table_name === DIARIA && m.month === '2026-10-01')
    expect(out).toMatchObject({ tem_linha: false, devido_em: '2026-11-28', sealed_at: null })
    expect(p.meses.some(m => m.month === '2026-12-01')).toBe(true)                    // o mês corrente também tem linha de grade
    expect(progDe(p, 'serie', '2026-10-01')).toEqual({ class: 'serie', month: '2026-10-01', canais_esperados: 2, canais_prontos: 0, canais_perdidos: 0 })
    expect(progDe(p, 'horaria', '2026-10-01')).toMatchObject({ canais_esperados: 2, canais_prontos: 0 })
  })
  it('site vazio: grade sem linha de registro, zero esperado, casa vazia', async () => {
    const p = await pagina()
    expect(p.versao).toBe(1); expect(typeof p.lido_em).toBe('string'); expect(p.casa).toEqual([])
    expect(p.meses.length).toBeGreaterThan(0)
    expect(p.meses.every(m => m.tem_linha === false)).toBe(true)
    expect(p.progresso.every(x => x.canais_esperados === 0)).toBe(true)
  })
  it('progresso conta canais com todas as tabelas terminadas; unidade a refazer não conta', async () => {
    const a = await semearCanal(c, { videos: 0 }), b = await semearCanal(c, { videos: 0 }), d = await semearCanal(c, { videos: 0 })
    await unidade(a.canal, DIARIA); await unidade(a.canal, CEDO)                     // pronto
    await unidade(b.canal, DIARIA); await unidade(b.canal, CEDO, { redo: 'conteudo_mudou' })   // recebida, mas a refazer: não terminal
    void d                                                                             // sem unidade
    await hoje('2026-12-10')
    expect(progDe(await pagina(), 'serie', '2026-10-01')).toMatchObject({ canais_esperados: 3, canais_prontos: 1 })
  })
  it('vale a maior versão, sem filtro: v2 ainda não recebida desfaz a v1 recebida', async () => {
    const a = await semearCanal(c, { videos: 0 })
    await unidade(a.canal, DIARIA); await unidade(a.canal, CEDO)
    await unidade(a.canal, DIARIA, { versao: 2, recebida: false })
    await hoje('2026-12-10')
    expect(progDe(await pagina(), 'serie', '2026-10-01')).toMatchObject({ canais_esperados: 1, canais_prontos: 0 })
  })
  it('os vermelhos do site chegam à página (paridade com o pulso)', async () => {
    await semearCanal(c, { videos: 0 }); await hoje('2027-01-15')
    const p = await pagina() as unknown as { vermelhos: string[]; atraso: { vermelhos: number } }
    expect(p.vermelhos.some(v => v.startsWith('atraso de cópia'))).toBe(true)
    expect(p.atraso.vermelhos).toBeGreaterThan(0)
  })
  it('o registro vai por lista fechada: nenhum *_by, nem id, nem site_id', async () => {
    await semearCanal(c, { videos: 0 })
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, detached_at, detached_by) values ($1, 'serie', $2, '2026-10-01', now(), gen_random_uuid())`, [SITE_TESTE, DIARIA])
    const m = (await pagina()).meses.find(x => x.tem_linha === true)!
    expect(Object.keys(m).filter(k => k.endsWith('_by') || k === 'id' || k === 'site_id')).toEqual([])
    expect(m).toHaveProperty('reattach_out_of_order', false)
  })
  it('não grava first_month (a função é stable)', async () => {
    await pagina()
    expect((await q1(c, `select count(*)::int as n from public.obs_archive_switch where site_id = $1`, [SITE_TESTE])).n).toBe(0)
  })
  it('recuperação: leva o fp atual da tabela, e ele muda com um alter table (o visto da época deixa de valer)', async () => {
    const fp = async () => ((await pagina()).recuperacao as { table_name: string; schema_fp_atual: string | null }[]).find(r => r.table_name === DIARIA)!.schema_fp_atual
    const antes = await fp()
    expect(antes).toMatch(/^[0-9a-f]{64}$/)
    await c.query(`alter table public.competitor_video_daily add column zz_m5 integer`)
    expect(await fp()).not.toBe(antes)
  })
  it('meses à frente: uma linha por tabela da série, com months_ahead número ou nulo', async () => {
    const a = (await pagina()).meses_a_frente as { table_name: string; months_ahead: number | null; converted_at: string | null }[]
    expect(a.map(x => x.table_name).sort()).toEqual([DIARIA, CEDO, 'competitor_video_hourly'].sort())
    for (const m of a) expect(m.months_ahead === null || Number.isInteger(m.months_ahead)).toBe(true)
  })
  it('aviso: leve, só com o que o 18-v2 usa', async () => {
    await semearCanal(c, { videos: 0 })
    const a = (await q1(c, `select public.obs_archive_aviso($1) as a`, [SITE_TESTE])).a as Record<string, unknown>
    expect(Object.keys(a).sort()).toEqual(['atraso', 'casa', 'hoje', 'lido_em', 'primeira_devida_em', 'proximo_mes', 'ultima_copia', 'versao', 'vermelhos_n'])
    expect(a.proximo_mes).toBeNull(); expect(a.ultima_copia).toBeNull(); expect(a.primeira_devida_em).toBe('2026-11-28'); expect(typeof a.vermelhos_n).toBe('number')
  })
  it('as duas funções são só de service_role', async () => {
    const r = await q1(c, `select has_function_privilege('anon', 'public.obs_archive_pagina(uuid)', 'execute') as a1, has_function_privilege('authenticated', 'public.obs_archive_pagina(uuid)', 'execute') as a2,
                                 has_function_privilege('service_role', 'public.obs_archive_pagina(uuid)', 'execute') as a3, has_function_privilege('anon', 'public.obs_archive_aviso(uuid)', 'execute') as b1,
                                 has_function_privilege('authenticated', 'public.obs_archive_aviso(uuid)', 'execute') as b2, has_function_privilege('service_role', 'public.obs_archive_aviso(uuid)', 'execute') as b3`)
    expect(r).toEqual({ a1: false, a2: false, a3: true, b1: false, b2: false, b3: true })
  })
})
```

- [ ] **Passo 2. Rodar e ver falhar.** Mesmo comando da Tarefa 1. Esperado: FAIL `function public.obs_archive_pagina(uuid) does not exist` (e, nos testes da parte 1, nada muda).
- [ ] **Passo 3. SQL** (acrescentar ao rascunho). Antes, `sed -n 59,98p supabase/rascunhos/m3b.sql` e `sed -n 113,136p` para conferir os nomes de coluna usados abaixo (já conferidos em 14/10):

```sql
-- M5 PARTE 2: a leitura única da página do Arquivo (04 §14.2) e a leitura leve do aviso (18-v2). Só leem; nunca gravam.
-- A GRADE (classe, tabela, mês) vem do início da classe até o mês corrente e NÃO das linhas do registro: a linha só nasce com a 1ª unidade recebida
-- (m3b.sql:686), então o mês que a casa nunca copiou não teria linha (Phil C1). O devido vem de obs_archive_expected_units (D19), nunca de count(*) das unidades.
create or replace function public.obs_archive_pagina(p_site uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_hoje date := public.obs_archive_hoje_sp();
  v_agora timestamptz := public.obs_archive_agora();
  v_teto date := pg_catalog.date_trunc('month', public.obs_archive_hoje_sp())::date;
  v_meses jsonb; v_prog jsonb := '[]'::jsonb;
  g record; v_esp integer; v_pro integer; v_per integer;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'class', x.cl, 'table_name', x.tb, 'month', x.mes, 'devido_em', public.obs_archive_due_on(x.mes, x.mg), 'tem_linha', m.id is not null,
      'sealed_at', m.sealed_at, 'sealed_kind', m.sealed_kind, 'unsealed_at', m.unsealed_at, 'unsealed_reason', m.unsealed_reason,
      'nas_attested_at', m.nas_attested_at, 'manifest_nas_withdrawn_at', m.manifest_nas_withdrawn_at,
      'b2_attested_at', m.b2_attested_at, 'b2_attested_via', m.b2_attested_via, 'b2_forja_ok_at', m.b2_forja_ok_at, 'b2_dono_ok_at', m.b2_dono_ok_at,
      'b2_forja_diverged_at', m.b2_forja_diverged_at, 'b2_withdrawn_at', m.b2_withdrawn_at, 'b2_withdrawn_reason', m.b2_withdrawn_reason,
      'b2_last_attempt_at', m.b2_last_attempt_at, 'b2_last_attempt_result', m.b2_last_attempt_result,
      'detached_at', m.detached_at, 'dropped_at', m.dropped_at, 'closed_at', m.closed_at,
      'rows_total', m.rows_total, 'units_total', m.units_total, 'units_empty', m.units_empty, 'days_measured', m.days_measured, 'days_in_month', m.days_in_month,
      'rows_dropped', m.rows_dropped, 'bytes_freed', m.bytes_freed,
      -- a coluna é da M6 (plano M6 :1020): lida pelo jsonb da linha, então existe ou não sem quebrar esta função nem a ordem do deploy
      'reattach_out_of_order', coalesce((pg_catalog.to_jsonb(m) ->> 'reattach_out_of_order')::boolean, false),
      -- lista fechada de chaves, SEM `por` (uuid de pessoa; Phil r3 N5): nunca o jsonb inteiro de obs_archive_b2_month_state
      'b2', (select coalesce(pg_catalog.jsonb_object_agg(e.key, e.value), '{}'::jsonb)
               from pg_catalog.jsonb_each(public.obs_archive_b2_month_state(p_site, x.cl, x.mes)) e
              where e.key in ('atestada_em', 'via', 'forja_ok_at', 'dono_ok_at', 'forja_divergiu_em', 'retirada', 'ultima_tentativa', 'idade_dias'))
    ) order by x.cl, x.tb, x.mes desc), '[]'::jsonb)
    into v_meses
    from (select p.class as cl, p.table_name as tb, p.seal_margin_days as mg, gs.mes
            from public.obs_archive_policy() p
            cross join lateral (select greatest(coalesce((select sw.first_month from public.obs_archive_switch sw where sw.site_id = p_site and sw.class = p.class), date '2026-10-01'), date '2026-10-01') as ini) i
            cross join lateral (select s::date as mes from generate_series(greatest(i.ini, (v_teto - interval '239 months')::date), v_teto, interval '1 month') s) gs
           where p.class in ('horaria', 'serie', 'texto')) x
    left join public.obs_archive_months m on m.site_id = p_site and m.class = x.cl and m.table_name = x.tb and m.month = x.mes;

  -- o progresso de cópia, só dos (classe, mês) SEM selo: o devido de verdade contra o conjunto corrente; canal pronto = todas as suas tabelas terminadas
  for g in
    select distinct p.class as cl, gs.mes
      from public.obs_archive_policy() p
      cross join lateral (select greatest(coalesce((select sw.first_month from public.obs_archive_switch sw where sw.site_id = p_site and sw.class = p.class), date '2026-10-01'), date '2026-10-01') as ini) i
      cross join lateral (select s::date as mes from generate_series(greatest(i.ini, (v_teto - interval '239 months')::date), v_teto, interval '1 month') s) gs
     where p.class in ('horaria', 'serie', 'texto')
       and not exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = p.class and m.month = gs.mes and m.sealed_at is not null and m.unsealed_at is null)
     order by 1, 2
  loop
    with cu as (select * from public.obs_archive_current_units(p_site, g.cl, g.mes)),
         por_canal as (
           select e.channel_ref,
                  bool_and(exists (select 1 from cu where cu.table_name = e.table_name and cu.channel_ref = e.channel_ref
                                      and public.obs_archive_is_terminal(cu.received_at, cu.redo_reason, cu.row_count, cu.lost_at, cu.purged_at))) as pronto,
                  bool_or(exists (select 1 from cu where cu.table_name = e.table_name and cu.channel_ref = e.channel_ref and cu.lost_at is not null)) as perdido
             from public.obs_archive_expected_units(p_site, g.cl, g.mes) e group by e.channel_ref)
    select count(*), count(*) filter (where pronto), count(*) filter (where perdido) into v_esp, v_pro, v_per from por_canal;
    v_prog := v_prog || jsonb_build_object('class', g.cl, 'month', g.mes, 'canais_esperados', v_esp, 'canais_prontos', v_pro, 'canais_perdidos', v_per);
  end loop;

  return jsonb_build_object(
    'versao', 1, 'lido_em', v_agora, 'hoje', v_hoje,
    'casa', coalesce((select jsonb_agg(jsonb_build_object('worker', h.worker, 'last_poll_at', h.last_poll_at, 'updated_at', h.updated_at, 'version', h.version,
              'machine_time', h.machine_time, 'stopped_at_cap', h.stopped_at_cap, 'nas_ok', h.nas_ok, 'nas_checked_at', h.nas_checked_at, 'last_error', h.last_error,
              'livre_bytes', h.free_bytes, 'total_bytes', h.total_bytes, 'sentinel_ok', h.sentinel_ok, 'mounts_ok', h.mounts_ok) order by h.worker)
              from public.obs_archive_heartbeat h where h.site_id = p_site), '[]'::jsonb),
    'classes', coalesce((select jsonb_agg(jsonb_build_object('class', k.class, 'first_month', s.first_month, 'released', k.released,
              'window_months', k.window_months, 'seal_margin_days', k.seal_margin_days, 'wait_days', k.wait_days) order by k.class)
              from (select distinct on (p.class) p.class, p.released, p.window_months, p.seal_margin_days, p.wait_days
                      from public.obs_archive_policy() p where p.class in ('horaria', 'serie', 'texto') order by p.class, p.table_name) k
              left join public.obs_archive_switch s on s.site_id = p_site and s.class = k.class), '[]'::jsonb),
    'online_since', coalesce((select jsonb_agg(jsonb_build_object('class', o.class, 'table_name', o.table_name, 'online_since', o.online_since, 'divergencia', o.divergencia)
              order by o.table_name) from public.obs_archive_online_since(p_site) o), '[]'::jsonb),
    'meses', v_meses, 'progresso', v_prog,
    'recuperacao', coalesce((select jsonb_agg(jsonb_build_object('class', t.class, 'table_name', t.table_name, 'done_at', r.done_at, 'schema_fp', r.schema_fp,
              'schema_fp_atual', public.obs_archive_schema_fp(pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(t.table_name))), 'diff_rows', r.diff_rows)
              order by t.class, t.table_name)
              from (select distinct p.class, p.table_name from public.obs_archive_policy() p where p.class in ('horaria', 'serie', 'texto')) t
              left join lateral (select x.done_at, x.schema_fp, x.diff_rows from public.obs_archive_restores x
                                  where x.site_id = p_site and x.class = t.class and x.table_name = t.table_name order by x.done_at desc limit 1) r on true), '[]'::jsonb),
    'meses_a_frente', coalesce((select jsonb_agg(jsonb_build_object('table_name', a.table_name, 'months_ahead', a.months_ahead, 'last_month', a.last_month,
              'converted_at', a.converted_at) order by a.table_name) from public.obs_partitions_months_ahead() a), '[]'::jsonb),
    'teste', jsonb_build_object(
              'aberto', exists (select 1 from public.obs_archive_months t where t.site_id = p_site and t.class = 'ensaio' and t.closed_at is null),
              'meses', coalesce((select jsonb_agg(jsonb_build_object('month', t.month, 'sealed_at', t.sealed_at, 'nas_attested_at', t.nas_attested_at,
                        'b2_attested_at', t.b2_attested_at, 'detached_at', t.detached_at, 'dropped_at', t.dropped_at, 'closed_at', t.closed_at) order by t.month)
                        from public.obs_archive_months t where t.site_id = p_site and t.class = 'ensaio' and t.closed_at is null), '[]'::jsonb),
              'encerrado_em', (select max(t.closed_at) from public.obs_archive_months t where t.site_id = p_site and t.class = 'ensaio')),
    -- o que o pulso já mostra, para a página e o pulso não dizerem coisas diferentes do mesmo fato (paridade; Phil I1)
    'vermelhos', to_jsonb(public.obs_archive_vermelhos(p_site)),
    'atraso', public.obs_archive_atraso(p_site),
    'teto_b2', public.obs_archive_b2_teto_cor(p_site));
end $$;
revoke all on function public.obs_archive_pagina(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_pagina(uuid) to service_role;

-- A leitura leve do chrome (Phil I9): o aviso do banco aparece em toda aba do Observatório, e a página inteira (grade + expected_units por mês + b2_month_state
-- por linha) não pode ir em cada navegação. Só o que o 18-v2 usa: o próximo mês pronto, a última cópia, a casa e os vermelhos CONTADOS.
create or replace function public.obs_archive_aviso(p_site uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'versao', 1, 'lido_em', public.obs_archive_agora(), 'hoje', public.obs_archive_hoje_sp(),
    'proximo_mes', (select jsonb_build_object('class', x.class, 'month', x.month, 'pronto_em', ((x.sealed_at at time zone 'America/Sao_Paulo')::date + k.wait_days))
                      from public.obs_archive_months x
                      join (select distinct p.class, p.wait_days from public.obs_archive_policy() p where p.class in ('horaria', 'serie')) k on k.class = x.class
                     where x.site_id = p_site and x.sealed_at is not null and x.unsealed_at is null and x.detached_at is null and x.dropped_at is null
                     order by x.month, x.class limit 1),
    'primeira_devida_em', public.obs_archive_due_on(
        greatest(coalesce((select sw.first_month from public.obs_archive_switch sw where sw.site_id = p_site and sw.class = 'horaria'), date '2026-10-01'), date '2026-10-01'),
        (select min(p.seal_margin_days) from public.obs_archive_policy() p where p.class = 'horaria')),
    'ultima_copia', (select max(u.received_at) from public.obs_archive_units u where u.site_id = p_site),
    'casa', coalesce((select jsonb_agg(jsonb_build_object('worker', h.worker, 'last_poll_at', h.last_poll_at, 'updated_at', h.updated_at, 'nas_ok', h.nas_ok,
              'nas_checked_at', h.nas_checked_at) order by h.worker) from public.obs_archive_heartbeat h where h.site_id = p_site), '[]'::jsonb),
    'vermelhos_n', cardinality(public.obs_archive_vermelhos(p_site)),
    'atraso', public.obs_archive_atraso(p_site))
$$;
revoke all on function public.obs_archive_aviso(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_aviso(uuid) to service_role;
```

**Conferir antes do commit:** as chamadas a `obs_archive_b2_teto_cor`, `obs_archive_current_units`, `obs_archive_is_terminal` e `obs_archive_hoje_sp` passam porque a função é `security definer` do dono; um teste de catálogo (`has_function_privilege('service_role', ...)` falso para elas, verdadeiro para as duas novas) já está no teste de permissão acima e na M3b. `to_jsonb(m)` com `m` nulo (linha de grade sem registro) devolve nulo, e o `coalesce` cai em `false`.

- [ ] **Passo 4. Rodar e ver passar.** Esperado: os 6 testes da parte 1 e os 11 da parte 2 PASS (mesmo comando da Tarefa 1). **Medir o custo** no `bythiago_int`, em transação desfeita, com o caso cheio (a conta de Phil M6: 75 canais × 6 tabelas = 450 unidades/mês; 03/05/2028). **Só os canais não é o caso cheio (Phil r2 N3):** depois do laço abaixo, semear também 450 unidades por mês em 19 meses (10/2026 a 04/2028; parte já recebida e terminada, parte a refazer) com o helper de unidade de `apps/web/test/helpers/m3b.ts`, para medir `current_units`, `is_terminal`, `b2_month_state` e `obs_archive_vermelhos` com dado, e medir `obs_archive_aviso` nesse mesmo volume:

```ts
// dentro de um it.skipIf(!process.env.M5_MEDIR) do mesmo arquivo; roda só com M5_MEDIR=1
for (let i = 0; i < 75; i++) await semearCanal(c, { site: SITE_TESTE, videos: 0, addedAt: '2026-09-15T12:00:00Z' })
await c.query(`select set_config('obs_archive.hoje', '2028-05-03', true), set_config('obs_archive.agora', '2028-05-03 12:00-03', true)`)
const plano = await c.query(`explain (analyze, buffers) select public.obs_archive_pagina($1)`, [SITE_TESTE])
console.log(plano.rows.map(r => r['QUERY PLAN']).join('\n'))
```

Anotar no ledger o tempo da página e o do aviso. **Limiares:** a página acima de 1,5 s, ou o aviso acima de 400 ms, abre achado para Phil antes de seguir (D-M5-12 já põe cache de 60 s no aviso; a página só roda em `/arquivo`).
- [ ] **Passo 5. Commit** (mesmo formato da Tarefa 1): `feat: rascunho da M5, parte 2: obs_archive_pagina, a leitura única da página do Arquivo, e obs_archive_aviso (manutenção M5, 04 §14.2 e §14.5)`.

---

### Task 3: rascunho, parte 3: lista de canais removidos v2, o `desde` da horária e o impacto da remoção

**Files:**
- Modify: `supabase/rascunhos/m5.sql` (`-- M5 PARTE 3`)
- Create: `supabase/rascunhos/gerar-m5-parte3.py` (gera, a partir da migration da A5, o `create or replace` de `competitor_hourly_health`; o script fica no repositório para o Yannis reproduzir)
- Modify: `apps/web/test/integration/manutencao-m5-leitores.test.ts`

**Interfaces:**
- Consumes: `obs_archive_removed_channel_list` v1 (`m3b.sql:2547-2586`), `obs_archive_channel_archive_impact` (`m3b.sql:2632-2667`), `obs_archive_channel_removals`, `obs_archive_units`, `obs_archive_months`, `obs_archive_switch`; `competitor_hourly_health(p_site_id uuid, p_now timestamptz, p_age_days integer, p_cap integer)` da migration `supabase/migrations/20261013000002_observatorio_a5_e15_leitura_horaria.sql:182-271` (`language sql stable strict security invoker`, revoke e grant para `service_role` no fim). **Conferido em 14/10: é a única definição dela em `supabase/migrations` e em `supabase/rascunhos`; o plano antigo a chamava com 1 argumento, errado (Yannis I-6/m, Phil I7).**
- Produces: (a) `obs_archive_removed_channel_list(p_site)` `versao: 2`; (b) `obs_archive_horaria_desde(p_site) returns table (desde timestamptz, precisao text)`; (c) `competitor_hourly_health` com `desde` vindo de (b) e os campos novos `desde_precisao` e `online_desde`; (d) `obs_archive_channel_archive_impact` com `fora_do_banco.registros` e `fora_do_banco.por_tabela`.

**Decisão de Phil I6 e Yannis I-8 (impacto da remoção).** A função `competitor_channel_removal_impact` **não** é recriada nesta tarefa. O plano antigo a recriava para somar dias do arquivo, mas (1) os resumos do arquivo (`obs_archive_summaries`, `m3b.sql:184-203`) não têm dias, só contagens; (2) o corpo vigente dela é o de `m10a.sql:255-297` e a A5 a estendeu na migration de leitura horária (linhas 274 em diante): recriar de cabeça apagaria a extensão de uma ou de outra. A parcela "no arquivo" já tem dono: `obs_archive_channel_archive_impact` (`m3b.sql:2632`, a M3b a escreveu para o diálogo). Esta tarefa a estende com o que o diálogo precisa (`registros` e `por_tabela` do que está fora do banco) e o diálogo (Tarefa 8) mostra **duas parcelas**: "no banco agora" (o `competitor_channel_removal_impact` de hoje, intocado) e "no arquivo" (a função da M3b). Nenhum texto diz "dias" para a parcela do arquivo, porque nada no arquivo mede dias por canal (m-1 do Yannis: dias medidos só existem por mês, em `obs_archive_months.days_measured`). O teste "a soma online + arquivo não cai depois de uma saída" está abaixo.

**Decisão de Phil I7 (`desde` da horária).** `min(hour_slot)` pula de outubro para novembro quando o mês de outubro saiu; o plano antigo trocava por `first_month::timestamptz`, que no fuso do banco (UTC) mostra 30/09 para `2026-10-01` (Yannis I-14). Agora: `obs_archive_horaria_desde(p_site)` devolve, **com mês fora** (algum `obs_archive_months` da classe `horaria` com `detached_at` ou `dropped_at` e `sealed_kind = 'com_dado'`), o menor desses meses à meia-noite de São Paulo (`month::timestamp at time zone 'America/Sao_Paulo'`) com `precisao = 'mes'` (a tela diz "desde outubro de 2026", nunca uma hora inventada); **sem mês fora**, `min(hour_slot)` com `precisao = 'hora'`. Não usa `min_key` das unidades (o formato da chave não está verificado: NÃO VERIFICADO).

**O que acontece quando o dado não existe:** remoção sem `name_at_removal` (vigia, ou concluída) → `nome` nulo, a tela cai para o código interno; sem `removed_at` → `removido_em` nulo, a tela diz "removido sem aviso, limpeza pedida em dd/mm" (`04` L225); canal sem unidade no arquivo → `meses: null` e `registros: null` (**nulo, não zero**: Phil I5; zero diria "0 meses guardados" de um canal que talvez tenha unidades que a tela não soube contar), estado `sem_arquivo` como na v1; `competitor_hourly_health` sem leitura nenhuma → `desde` nulo e `desde_precisao` nulo; função `obs_archive_horaria_desde` ausente (a migration ainda não subiu) não existe como caso: as duas chegam juntas na mesma migration (Tarefa 13).

**Por que `meses` e `registros` mudaram (Phil I5).** O plano antigo punha `meses = coalesce(a.meses, r.units_at_removal, 0)`. `units_at_removal` conta **unidades** (uma por tabela e mês), não meses (`m3b.sql:2449-2452`); misturar as duas dava "14 meses" para 7 meses de 2 tabelas. A v2 usa só `a.meses` (meses distintos com `row_count > 0`, já calculado no `agg` da v1) e deixa nulo quando o `agg` não tem linha. `first_month`/`last_month` do retrato (`r.first_month`, `r.last_month`) continuam como reserva das datas, que são de mesma natureza.

- [ ] **Passo 1. Testes, falhando** (acrescentar ao arquivo; `describe` próprio com `prepararM5(c)`):

```ts
describe.skipIf(skipIfNoLocalDb())('M5 parte 3: lista v2, desde da horária, impacto', () => {
  let c: Client
  beforeEach(async () => { c = new Client({ connectionString: URL_INT }); await c.connect(); await c.query('begin'); await prepararM5(c) })
  afterEach(async () => { await c.query('rollback'); await c.end() })
  const lista = async () => (await q1(c, `select public.obs_archive_removed_channel_list($1) as l`, [SITE_TESTE])).l as Record<string, unknown>[]
  const U = (canal: string, tabela: string, mes: string, linhas = 5) =>
    c.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at)
             values ($1, 'serie', $2, $3, $4, 1, $5, md5('a') || md5('a'), md5('s') || md5('s'), md5('b') || md5('b'), md5('c') || md5('c'), 100, now())`, [SITE_TESTE, tabela, canal, mes, linhas])

  it('lista v2: nome, removido_em e faixa para a remoção com linha', async () => {
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, name_at_removal, removed_at, removed_via, archive_decision, decided_at, units_at_removal, first_month, last_month, online_thumbs_known)
                   values ($1, 'aaaaaaaa-0000-0000-0000-000000000001', 'Viagem Lenta', '2028-04-28', 'botao', 'apagar', '2028-04-28', 14, '2026-10-01', '2027-11-01', true)`, [SITE_TESTE])
    const l = await lista()
    expect(l[0]).toMatchObject({ versao: 2, nome: 'Viagem Lenta', primeiro_mes: '2026-10', ultimo_mes: '2027-11', removido_via: 'botao' })
    expect(String(l[0]!.removido_em)).toMatch(/^2028-04-28/)
  })
  it('lista v2: linha da vigia sem nome nem data, com o código', async () => {
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, online_thumbs_known)
                   values ($1, '7f3a91c2-0000-0000-0000-000000000002', 'vigia', 'apagar', now(), false)`, [SITE_TESTE])
    expect((await lista())[0]).toMatchObject({ nome: null, removido_em: null, removido_via: 'vigia', channel_ref: '7f3a91c2-0000-0000-0000-000000000002' })
  })
  it('Phil I5: duas tabelas em três meses são 3 meses (não 6, não units_at_removal)', async () => {
    const ref = 'aaaaaaaa-0000-0000-0000-000000000004'
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, units_at_removal, online_thumbs_known) values ($1, $2, 'botao', 'apagar', now(), 99, true)`, [SITE_TESTE, ref])
    for (const mes of ['2026-10-01', '2026-11-01', '2026-12-01']) for (const t of ['competitor_video_daily', 'competitor_video_early']) await U(ref, t, mes)
    expect((await lista())[0]).toMatchObject({ meses: 3, registros: 30, primeiro_mes: '2026-10', ultimo_mes: '2026-12' })
  })
  it('Phil I5: remoção sem nenhuma unidade tem meses e registros nulos, não zero', async () => {
    await c.query(`insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, units_at_removal, online_thumbs_known) values ($1, 'aaaaaaaa-0000-0000-0000-000000000005', 'botao', 'apagar', now(), 14, true)`, [SITE_TESTE])
    const r = (await lista())[0]!
    expect(r.meses).toBeNull(); expect(r.registros).toBeNull(); expect(r.estado).toBe('sem_arquivo')
  })
  it('Yannis I-14: horária com outubro fora diz 1º de outubro à meia-noite de São Paulo, precisão mês', async () => {
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, sealed_kind, detached_at) values ($1, 'horaria', 'competitor_video_hourly', '2026-10-01', now(), 'com_dado', now())`, [SITE_TESTE])
    const r = await q1(c, `select desde, precisao from public.obs_archive_horaria_desde($1)`, [SITE_TESTE])
    expect(new Date(r.desde as string).toISOString()).toBe('2026-10-01T03:00:00.000Z')   // não 2026-09-30
    expect(r.precisao).toBe('mes')
  })
  it('horária sem mês fora: desde é a primeira leitura, precisão hora', async () => {
    const { canal } = await semearCanal(c, { site: SITE_TESTE, videos: 1 })
    await c.query(`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id) select v.id, '2026-11-02 14:00-03', now(), $1 from public.competitor_videos v where v.competitor_channel_id = $2`, [SITE_TESTE, canal])
    const r = await q1(c, `select desde, precisao from public.obs_archive_horaria_desde($1)`, [SITE_TESTE])
    expect(new Date(r.desde as string).toISOString()).toBe('2026-11-02T17:00:00.000Z'); expect(r.precisao).toBe('hora')
  })
  it('hourly health: leva desde, desde_precisao e online_desde, com os 4 argumentos de hoje', async () => {
    const h = (await q1(c, `select public.competitor_hourly_health($1, now(), 14, 100) as h`, [SITE_TESTE])).h as Record<string, unknown>
    expect(h).toHaveProperty('desde'); expect(h).toHaveProperty('desde_precisao'); expect(h).toHaveProperty('online_desde')
  })
  it('impacto: fora_do_banco leva registros e por_tabela; a soma online + arquivo não cai depois de uma saída', async () => {
    const { canal } = await semearCanal(c, { site: SITE_TESTE, videos: 0 })
    await U(canal, 'competitor_video_daily', '2026-10-01', 10); await U(canal, 'competitor_video_early', '2026-10-01', 4)
    const antes = (await q1(c, `select public.obs_archive_channel_archive_impact($1, $2) as r`, [SITE_TESTE, canal])).r as { registros: number; fora_do_banco: { registros: number } }
    expect(antes.registros).toBe(14); expect(antes.fora_do_banco.registros).toBe(0)
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, sealed_kind, dropped_at) values
                   ($1, 'serie', 'competitor_video_daily', '2026-10-01', now(), 'com_dado', now()), ($1, 'serie', 'competitor_video_early', '2026-10-01', now(), 'com_dado', now())`, [SITE_TESTE])
    const depois = (await q1(c, `select public.obs_archive_channel_archive_impact($1, $2) as r`, [SITE_TESTE, canal])).r as { registros: number; fora_do_banco: { registros: number; por_tabela: { table_name: string; registros: number }[] } }
    expect(depois.registros).toBe(14)                                  // o que o arquivo guarda não cai
    expect(depois.fora_do_banco.registros).toBe(14)
    expect(depois.fora_do_banco.por_tabela.map(t => t.table_name).sort()).toEqual(['competitor_video_daily', 'competitor_video_early'])
  })
  it('as duas funções novas são só de service_role', async () => {
    const r = await q1(c, `select has_function_privilege('authenticated', 'public.obs_archive_horaria_desde(uuid)', 'execute') as a, has_function_privilege('service_role', 'public.obs_archive_horaria_desde(uuid)', 'execute') as b`)
    expect(r).toEqual({ a: false, b: true })
  })
})
```

Antes de escrever, `grep -n "^export" apps/web/test/helpers/m3b.ts` e `\d public.competitor_video_hourly` no `bythiago_int` para ajustar as colunas obrigatórias do `insert` (a migration `20261013000002...sql:10-20` lista `video_id, hour_slot, taken_at, site_id, views...`; as de `views` têm default ou aceitam nulo? conferir, e passar o que faltar).

- [ ] **Passo 2. Rodar e ver falhar** (mesmo comando da Tarefa 1).
- [ ] **Passo 3. SQL.** (a) `create or replace function public.obs_archive_removed_channel_list`: copiar o corpo de `m3b.sql:2547-2586` e trocar **só** o `jsonb_build_object` final por:

```sql
      'channel_ref', f.channel_ref, 'versao', 2,
      'estado', case when r.channel_ref is null then 'sem_destino'
                     when not exists (select 1 from public.obs_archive_units u where u.site_id = p_site and u.channel_ref = f.channel_ref)
                          and not exists (select 1 from public.obs_archive_summaries s where s.site_id = p_site and s.channel_ref = f.channel_ref) then 'sem_arquivo'
                     when r.archive_decision = 'guardar' then 'guardado'
                     else 'pedido' end,
      'decided_at', r.decided_at, 'nas_absent_at', r.nas_absent_at, 'b2_absent_at', r.b2_absent_at, 'snapshots_clear_on', r.snapshots_clear_on,
      'reappeared_at', r.reappeared_at, 'reappeared_count', coalesce(r.reappeared_count, 0), 'online_thumbs_known', r.online_thumbs_known,
      'thumbs_unknown_ack_at', r.thumbs_unknown_ack_at, 'blobs_pendentes', coalesce(array_length(r.blobs_pending, 1), 0), 'youtube_channel_id', r.youtube_channel_id,
      'nome', r.name_at_removal, 'removido_em', r.removed_at, 'removido_via', coalesce(r.removed_via, 'sem_registro'),
      'primeiro_mes', to_char(coalesce(a.primeiro, r.first_month), 'YYYY-MM'), 'ultimo_mes', to_char(coalesce(a.ultimo, r.last_month), 'YYYY-MM'),
      'meses', a.meses, 'registros', a.registros, 'classes', to_jsonb(coalesce(a.classes, '{}'::text[]))
```

  O `agg` da v1 já sai de `cur`; ele só tem linha para canal com alguma unidade, então `a.meses` e `a.registros` ficam nulos sem unidade (o `left join agg`). **Nota:** o `cur` da v1 usa `distinct on ... version desc` **sem** filtro de `purged_at`; fica assim de propósito (a M3b trata "conjunto corrente" como a maior versão, e a lista precisa mostrar o que existe, expurgado ou não: o expurgo é da M9).
  (b) `obs_archive_horaria_desde`:

```sql
create or replace function public.obs_archive_horaria_desde(p_site uuid) returns table (desde timestamptz, precisao text)
language sql stable security definer set search_path = '' as $$
  select coalesce(m.d, h.d), case when m.d is not null then 'mes' when h.d is not null then 'hora' end
    from (select (min(x.month)::timestamp at time zone 'America/Sao_Paulo') as d
            from public.obs_archive_months x
           where x.site_id = p_site and x.class = 'horaria' and x.sealed_kind = 'com_dado' and (x.detached_at is not null or x.dropped_at is not null)) m
    cross join (select min(hv.hour_slot) as d from public.competitor_video_hourly hv where hv.site_id = p_site) h
$$;
revoke all on function public.obs_archive_horaria_desde(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_horaria_desde(uuid) to service_role;
```

  (c) `competitor_hourly_health`: **não retranscrever o corpo**; gerar. Criar `supabase/rascunhos/gerar-m5-parte3.py`:

```python
#!/usr/bin/env python3
"""Gera o create or replace de competitor_hourly_health para a M5 (parte 3) a partir da migration da A5, trocando só a linha 'desde'."""
import re, sys, pathlib
MIG = pathlib.Path('supabase/migrations/20261013000002_observatorio_a5_e15_leitura_horaria.sql')
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'supabase/rascunhos/m5-parte3-hourly-health.sql')
src = MIG.read_text()
ini = src.index('create or replace function public.competitor_hourly_health(')
fim = src.index("to service_role;", src.index('grant execute on function public.competitor_hourly_health(')) + len("to service_role;")
bloco = src[ini:fim]
antiga = "    'desde', (select min(h.hour_slot) from public.competitor_video_hourly h where h.site_id = p_site_id),"
assert bloco.count(antiga) == 1, f"a linha 'desde' apareceu {bloco.count(antiga)} vezes; a migration mudou, reescreva a troca"
nova = ("    'desde', (select d.desde from public.obs_archive_horaria_desde(p_site_id) d),\n"
        "    'desde_precisao', (select d.precisao from public.obs_archive_horaria_desde(p_site_id) d),\n"
        "    'online_desde', (select min(h.hour_slot) from public.competitor_video_hourly h where h.site_id = p_site_id),")
OUT.write_text("-- Gerado por gerar-m5-parte3.py a partir de " + MIG.name + "; só a linha 'desde' muda (M5, Phil I7).\n" + bloco.replace(antiga, nova) + "\n")
print('ok', OUT)
```

  Rodar `python3 supabase/rascunhos/gerar-m5-parte3.py` e acrescentar o conteúdo gerado ao `m5.sql` com `cat supabase/rascunhos/m5-parte3-hourly-health.sql >> supabase/rascunhos/m5.sql` (o arquivo gerado fica fora do commit; o script e o `m5.sql` entram). O `desde` antigo era `timestamptz`; o novo também.
  (d) `obs_archive_channel_archive_impact`: `create or replace` do corpo de `m3b.sql:2632-2667`, trocando o CTE `fora` e o campo `fora_do_banco`:

```sql
  fora as (
    select c.table_name, c.month, c.row_count from cheios c
     where exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = c.class and m.table_name = c.table_name and m.month = c.month
                      and (m.dropped_at is not null or m.detached_at is not null))
  ), ...
      'fora_do_banco', jsonb_build_object('meses', (select count(distinct month) from fora), 'de', (select to_char(min(month), 'YYYY-MM') from fora), 'ate', (select to_char(max(month), 'YYYY-MM') from fora),
         'registros', (select coalesce(sum(row_count), 0) from fora),
         'por_tabela', coalesce((select jsonb_agg(jsonb_build_object('table_name', t.table_name, 'meses', t.meses, 'registros', t.registros) order by t.table_name)
                                   from (select table_name, count(distinct month) as meses, sum(row_count) as registros from fora group by table_name) t), '[]'::jsonb)),
```

  O resto do corpo (campos `status`, `meses`, `de`, `ate`, `registros`, `videos_retirados`, `imagens_blob`) fica **idêntico** ao de `m3b.sql`.
- [ ] **Passo 4. Rodar e ver passar.** Rodar também os testes da A5 que leem as funções: `grep -rl "competitor_hourly_health" apps/web/test > ...` e rodar esses arquivos com saída em arquivo; só as falhas no contexto. O teste de `m3b` da `obs_archive_channel_archive_impact` (se existir, `grep -rln "channel_archive_impact" apps/web/test`) tem que continuar verde: as chaves antigas não mudam.
- [ ] **Passo 5. Commit** `feat: rascunho da M5, parte 3: lista de canais removidos v2, desde da horária e impacto da remoção (manutenção M5, 04 §14.1 e §14.2, item 82)` com os caminhos explícitos, `git add --` antes para os novos (`supabase/rascunhos/m5.sql`, `supabase/rascunhos/gerar-m5-parte3.py`, o teste de integração da parte 3).

---

### Task 4: o carregador deixa de cortar em 365 dias e passa a marcar o corte pelo `online desde` (pedido 11, um commit só)

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/online-desde.ts`
- Modify: `apps/web/src/lib/youtube/observatorio/load.ts:65-69 (ObservatoryRows), 113-119, 237-244, 321, 379, 544-550, 565-585, 586-595, 605, 662-664`
- Modify: `apps/web/src/lib/youtube/observatorio/load-channel.ts:8, 35, 53-55`
- Modify: `apps/web/src/lib/youtube/observatorio/series.ts:75-90`
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts` (acrescenta `export const SAIDA_DE_MES_EXISTE = false`, com o comentário "a M6 vira true no mesmo commit da primeira função de saída; D-M5-15")
- Create: `apps/web/test/youtube/observatorio/helpers/fabrica-load.ts` (a fábrica movida de `load.test.ts`, ver Passo 3)
- Modify: `apps/web/src/lib/youtube/observatorio/types.ts:47-48, 120-123`
- Modify (testes que mudam com o conserto, no mesmo commit): `apps/web/test/youtube/observatorio/load.test.ts:384-387` e `:403-420`
- Test: `apps/web/test/youtube/observatorio/online-desde.test.ts`, `apps/web/test/youtube/observatorio/carregador-online-desde.test.ts`

**Interfaces:**
- Consumes: `obs_archive_online_since` (Tarefa 1), `ObservatoryLoadError` (`load.ts:14`), `spDateStart` e `spDate` (`time.ts`).
- Produces:

```ts
// online-desde.ts (sem 'server-only': é puro, o cliente entra por parâmetro; Yannis m-7)
export type TabelaDaSerie = 'competitor_video_daily' | 'competitor_video_early' | 'competitor_video_hourly'
export type OnlineDesde =
  | { lido: true; porTabela: Record<TabelaDaSerie, number | null> }
  | { lido: false; porque: 'funcao_ausente' | 'erro_do_banco' | 'fora_do_esquema' }
/** Dias online garantidos pela política: a soma mínima de `window_months` meses seguidos, contada no dia 1 (181 para a série, 89 para a horária). */
export const JANELA_MINIMA_DIAS: Record<TabelaDaSerie, number>
export function minDias(meses: number): number
export function lerOnlineDesdeBruto(bruto: unknown): OnlineDesde
export async function lerOnlineDesde(sb: SupabaseClient, siteId: string, saidaDeMesExiste: boolean): Promise<OnlineDesde>
/** Início (ms, meia-noite SP) a partir do qual há série online garantida: o online desde; não lido, agora menos a janela mínima. */
export function inicioSeguro(o: OnlineDesde, t: TabelaDaSerie, now: number): number | null
```

```ts
// load.ts (assinaturas novas; DAILY_MAX_DAYS sai)
export function dailyReadFrom(seriesStart: number): string                       // só tira o teto; não espera o online desde (Yannis I-4)
export function dailyCappedFrom(seriesStart: number, onlineDesde: number | null): number | null
// ObservatoryRows e Dataset ganham `onlineDesde?: OnlineDesde` (OPCIONAL: oracle.ts:49, fase4-world.ts:40 e o golden video-antigo/__golden__/dataset-antes.json não mudam)
```

**Por que a leitura da diária não espera o `online desde` (Yannis I-4).** O plano antigo passava o `online desde` a `dailyReadFrom`, e o `online desde` só chega depois de `readSiteLive` (é lido nele); os chamadores `load.ts:605` (`readSiteScope`), `:664` (`loadRows`) e `load-channel.ts:35` (dentro de `loadChannelRows`, que roda no `buildPack` em cache, `load-page.ts:52-55`) calculam a data de leitura **antes** ou **fora** dessa leitura. Resolver isso exigiria reordenar as leituras e invalidar a chave do pacote. A tabela online não tem linhas antes do `online desde` (o mês saiu dela), então ler a partir de `seriesStart - 1 dia` devolve o mesmo que ler do `online desde`, sem a espera. O `online desde` entra em **dois** lugares só: `rowsToDataset` (a marca `truncated` e `dailyCappedFrom`) e `assembleRows` (descarta em memória as linhas do pacote em cache anteriores a ele: um pacote de até 900 s, `load-page.ts:24`, pode ter sido montado quando o mês ainda estava online, e o Dataset diria `truncated` com a série inteira à frente).

**O que acontece quando o dado não existe:** `online_since` nulo para a diária (nada saiu) → `dailyCappedFrom` nulo, nenhum vídeo `truncated`, a tela não muda (item 35). Função ausente (`42883`/`PGRST202`) com `SAIDA_DE_MES_EXISTE = false` → `{lido:true, nulos}`, **mesmo efeito de "nada saiu"**; com `true` → `{lido:false, porque:'funcao_ausente'}` e Sentry de erro (D-M5-15; hoje o tipo `funcao_ausente` só nasce nessa posição) (D-M5-1 e a decisão 1 de "Onde Phil e Yannis divergiram": sem a migration da M5 não há saída possível, porque a liberação das classes vive nela), com `Sentry.captureMessage('obs_archive_online_since ausente', 'warning')`. `erro_do_banco`, `fora_do_esquema` e `divergencia` → `{lido:false}` com a peça 1 dizendo "Não foi possível ler desde quando há dado online." (Tarefa 5), a série inteira lida e nada anulado além do que `inicioSeguro` cobre. **Nunca 365.** Série com mais de 300 dias, lida e com todos nulos → `Sentry.captureMessage('online_since nulo com série de mais de 300 dias', 'warning')` (a primeira saída da série é em 05/2027; depois disso, nulo é sinal de que algo não saiu como previsto, não erro).

- [ ] **Passo 1. Testes do leitor, falhando:**

```ts
// apps/web/test/youtube/observatorio/online-desde.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { lerOnlineDesdeBruto, lerOnlineDesde, inicioSeguro, minDias, JANELA_MINIMA_DIAS } from '@/lib/youtube/observatorio/arquivo-mensal/online-desde'

const linha = (t: string, d: string | null) => ({ class: t === 'competitor_video_hourly' ? 'horaria' : 'serie', table_name: t, online_since: d, divergencia: false })
const tudo = (d: string | null) => ['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly'].map(t => linha(t, d))
const sbCom = (error: { code: string } | null, data: unknown = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error }) }) as never

describe('online desde', () => {
  it('nulo é "nada saiu", lido', () => {
    expect(lerOnlineDesdeBruto(tudo(null))).toEqual({ lido: true, porTabela: { competitor_video_daily: null, competitor_video_early: null, competitor_video_hourly: null } })
  })
  it('data vira meia-noite de São Paulo (UTC-3)', () => {
    const o = lerOnlineDesdeBruto(tudo('2027-05-01'))
    expect(o.lido && o.porTabela.competitor_video_daily).toBe(Date.parse('2027-05-01T03:00:00Z'))
  })
  it('faltando uma tabela: fora do esquema, nunca "nada saiu"', () => {
    expect(lerOnlineDesdeBruto(tudo(null).slice(0, 2))).toEqual({ lido: false, porque: 'fora_do_esquema' })
    expect(lerOnlineDesdeBruto([])).toEqual({ lido: false, porque: 'fora_do_esquema' })
  })
  it('divergência apontada pelo banco: não lido, nunca "nada saiu"', () => {
    const t = tudo(null); t[0] = { ...t[0]!, divergencia: true }
    expect(lerOnlineDesdeBruto(t)).toEqual({ lido: false, porque: 'fora_do_esquema' })
  })
  it('função ausente (42883 e PGRST202) com SAIDA_DE_MES_EXISTE=false: lido e nulo, nada saiu', async () => {
    for (const code of ['42883', 'PGRST202']) {
      expect(await lerOnlineDesde(sbCom({ code }), 's', false)).toEqual({ lido: true, porTabela: { competitor_video_daily: null, competitor_video_early: null, competitor_video_hourly: null } })
    }
  })
  it('função ausente com SAIDA_DE_MES_EXISTE=true: não lido (falha em verde fechada, D-M5-15), Sentry de erro', async () => {
    for (const code of ['42883', 'PGRST202']) {
      expect(await lerOnlineDesde(sbCom({ code }), 's', true)).toEqual({ lido: false, porque: 'funcao_ausente' })
    }
    expect(Sentry.captureMessage).toHaveBeenCalledWith('obs_archive_online_since ausente com saída de mês existindo', 'error')
  })
  it('a constante vale false hoje e o carregador a passa (sem ela o teste acima nunca roda em produção)', async () => {
    const { SAIDA_DE_MES_EXISTE } = await import('@/lib/youtube/observatorio/arquivo-mensal/capacidades')
    expect(typeof SAIDA_DE_MES_EXISTE).toBe('boolean')
    expect(readFileSync(resolve(__dirname, '../../../src/lib/youtube/observatorio/load.ts'), 'utf8')).toMatch(/lerOnlineDesde\([^)]*SAIDA_DE_MES_EXISTE/)
  })
  it('outro erro do banco: não lido', async () => {
    expect(await lerOnlineDesde(sbCom({ code: '57014' }), 's')).toEqual({ lido: false, porque: 'erro_do_banco' })
  })
  it('a janela mínima vem da política: 181 na série (6 meses), 89 na horária (3 meses)', () => {
    expect(minDias(6)).toBe(181); expect(minDias(3)).toBe(89)
    expect(JANELA_MINIMA_DIAS).toEqual({ competitor_video_daily: 181, competitor_video_early: 181, competitor_video_hourly: 89 })
  })
  it('não lido: início seguro é agora menos a janela mínima, nunca 365', () => {
    const now = Date.parse('2027-06-10T15:00:00Z')
    expect(inicioSeguro({ lido: false, porque: 'erro_do_banco' }, 'competitor_video_daily', now)).toBe(now - 181 * 86_400_000)
  })
  it('lido e nulo: sem início seguro (tudo online)', () => {
    expect(inicioSeguro(lerOnlineDesdeBruto(tudo(null)), 'competitor_video_daily', Date.now())).toBeNull()
  })
})
```

`minDias(n)` é a soma mínima de `n` meses seguidos de calendário (fevereiro 28 + 2 de 30/31 em 3 meses = 89; 6 meses = 181): `Math.floor(n * 30.4)` não serve. Escrever `minDias` pela tabela real de dias do calendário (menor soma de `n` meses consecutivos de um ano não bissexto: 6 → 181, 3 → 89) e deixar o teste de integração da Tarefa 1 afirmar que `window_months` da política é 6 e 3 (se a política mudar, o teste do banco quebra e arrasta o do TS).

- [ ] **Passo 2. Implementar `online-desde.ts`:**

```ts
// apps/web/src/lib/youtube/observatorio/arquivo-mensal/online-desde.ts
/** Manutenção M5 (02 §10.4, itens 34, 35, 81): desde quando cada série está online. Nulo = nada saiu. Não lido = "não medido", nunca 365 dias. */
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { spDateStart } from '../time'

export type TabelaDaSerie = 'competitor_video_daily' | 'competitor_video_early' | 'competitor_video_hourly'
const TABELAS: readonly TabelaDaSerie[] = ['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly']
export type OnlineDesde =
  | { lido: true; porTabela: Record<TabelaDaSerie, number | null> }
  | { lido: false; porque: 'funcao_ausente' | 'erro_do_banco' | 'fora_do_esquema' }
const DIA = 86_400_000
/** Dias de cada mês de um ano não bissexto, em sequência circular: a menor soma de n meses seguidos é a garantia de dias online. */
const MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
export function minDias(meses: number): number {
  let menor = Infinity
  for (let i = 0; i < 12; i++) { let s = 0; for (let k = 0; k < meses; k++) s += MES[(i + k) % 12]!; menor = Math.min(menor, s) }
  return menor
}
export const JANELA_MINIMA_DIAS: Record<TabelaDaSerie, number> = { competitor_video_daily: minDias(6), competitor_video_early: minDias(6), competitor_video_hourly: minDias(3) }
const Linha = z.object({ class: z.string(), table_name: z.string(), online_since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), divergencia: z.boolean() }).strict()
const NADA_SAIU: OnlineDesde = { lido: true, porTabela: { competitor_video_daily: null, competitor_video_early: null, competitor_video_hourly: null } }

export function lerOnlineDesdeBruto(bruto: unknown): OnlineDesde {
  const r = z.array(Linha).safeParse(bruto)
  if (!r.success || r.data.some(l => l.divergencia)) return { lido: false, porque: 'fora_do_esquema' }
  const por = new Map(r.data.map(l => [l.table_name, l.online_since]))
  if (!TABELAS.every(t => por.has(t))) return { lido: false, porque: 'fora_do_esquema' }
  const porTabela = Object.fromEntries(TABELAS.map(t => { const d = por.get(t); return [t, d == null ? null : spDateStart(d)] })) as Record<TabelaDaSerie, number | null>
  return { lido: true, porTabela }
}

/** `saidaDeMesExiste` é obrigatório (sem default, para o teste não ser vazio): o chamador servidor passa `SAIDA_DE_MES_EXISTE` de `capacidades.ts` (que é 'server-only'; este módulo continua puro). */
export async function lerOnlineDesde(sb: SupabaseClient, siteId: string, saidaDeMesExiste: boolean): Promise<OnlineDesde> {
  const { data, error } = await sb.rpc('obs_archive_online_since', { p_site: siteId })
  if (error) {
    if (error.code === '42883' || error.code === 'PGRST202') {
      if (!saidaDeMesExiste) { Sentry.captureMessage('obs_archive_online_since ausente', 'warning'); return NADA_SAIU }
      Sentry.captureMessage('obs_archive_online_since ausente com saída de mês existindo', 'error')
      return { lido: false, porque: 'funcao_ausente' }
    }
    Sentry.captureMessage('obs_archive_online_since: ' + error.code, 'error')
    return { lido: false, porque: 'erro_do_banco' }
  }
  return lerOnlineDesdeBruto(data)
}

export function inicioSeguro(o: OnlineDesde, t: TabelaDaSerie, now: number): number | null {
  return o.lido ? o.porTabela[t] : now - JANELA_MINIMA_DIAS[t] * DIA
}
```

Antes de gravar, `grep -n "export function spDateStart" apps/web/src/lib/youtube/observatorio/time.ts` e conferir que `spDateStart('2027-05-01')` dá `Date.parse('2027-05-01T03:00:00Z')` (o teste acima o exige); se `time.ts` tiver outra assinatura, ajustar a chamada, nunca duplicar a função (Yannis m-8).

- [ ] **Passo 3. Testes do carregador, falhando** (itens 34, 35, 81; Review Focus 1 e 2). Os testes usam a fábrica que `load.test.ts` tem (`rows()`, `channel()`, `video()`, `daily()`, `sp()`, `iso()`; `load.test.ts:9-31`). **Fato conferido (Yannis r2 N-7): nada disso é exportado, `daily` é posicional (`daily(video_id, snap_date, views)`, `load.test.ts:31`, não recebe objeto), a pasta `test/youtube/observatorio/helpers/` não existe e nenhum `series.test.ts` existe** (`viewsAtAge` não tem teste hoje; `insights.test.ts` monta o `EngineCtx` por cast). Portanto: (1) **criar** `helpers/fabrica-load.ts`, movendo (não copiando) `NOW`, `H`, `sp`, `iso`, `rows`, `channel`, `video`, `version`, `legacy` e `daily` de `load.test.ts` e exportando-os com a mesma assinatura; `load.test.ts` passa a importá-los de lá; (2) **escrever** `ctxDe(ds: Dataset): EngineCtx` no mesmo helper com o formato real de `EngineCtx` (`{ ds, clock, fmt, CH, V, CHG, niches }`: abrir `grep -n "interface EngineCtx" apps/web/src/lib/youtube/observatorio/*.ts` e montar cada campo a partir do dataset, no estilo do cast de `insights.test.ts`); (3) **o commit da Tarefa 4 lista os dois arquivos** no `git add`: `apps/web/test/youtube/observatorio/helpers/fabrica-load.ts` e `apps/web/test/youtube/observatorio/load.test.ts`. Sem isso a CI fica vermelha por import inexistente. Chamadas de `daily` nos testes abaixo usam a forma posicional.

```ts
// apps/web/test/youtube/observatorio/carregador-online-desde.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { dailyReadFrom, dailyCappedFrom, rowsToDataset } from '@/lib/youtube/observatorio/load'
import { viewsAtAge } from '@/lib/youtube/observatorio/series'
import { rows, channel, video, daily, iso, ctxDe /* os que load.test.ts usa; ctxDe: o que series.test.ts usa para montar o contexto de um Dataset */ } from './helpers/fabrica-load'

const DIA = 86_400_000
const SS = Date.parse('2026-10-03T03:00:00Z')           // seriesStart: começo da coleta
const OD = Date.parse('2027-05-01T03:00:00Z')           // online desde da diária
const AGORA = Date.parse('2027-06-10T15:00:00Z')
const dias = (de: string, ate: string) => { const r: string[] = []; for (let t = Date.parse(de); t <= Date.parse(ate); t += DIA) r.push(new Date(t).toISOString().slice(0, 10)); return r }
const comOd = (od: number | null | 'nao-lido') => rows({
  settings: { series_started_at: iso(SS), channel_limit: 75 }, channels: [channel()],
  videos: [video({ id: 'cortado', video_id: 'vid-cortado', published_at: iso(Date.parse('2026-10-10T12:00:00Z')) })],
  daily: dias('2027-05-01', '2027-06-10').map((d, i) => daily({ video_id: 'cortado', snap_date: d, views: 1000 + i * 10 })),
  onlineDesde: od === 'nao-lido' ? { lido: false, porque: 'erro_do_banco' } : { lido: true, porTabela: { competitor_video_daily: od, competitor_video_early: od, competitor_video_hourly: null } },
})

describe('carregador com online desde', () => {
  it('a leitura da diária não espera o online desde: sempre a véspera do começo', () => {
    expect(dailyReadFrom(SS)).toBe('2026-10-02')
    expect(dailyReadFrom(Date.parse('2026-10-03T03:00:00Z') - 900 * DIA)).not.toMatch(/^2024-/) // nunca recorta em 365
  })
  it('nada saiu: nenhum corte', () => { expect(dailyCappedFrom(SS, null)).toBeNull() })
  it('online desde depois do começo: marca o corte nele', () => { expect(dailyCappedFrom(SS, OD)).toBe(OD) })
  it('online desde antes da véspera do começo: não corta', () => { expect(dailyCappedFrom(SS, SS - 5 * DIA)).toBeNull() })
  it('item 34: vídeo publicado antes do corte → truncated; a média só entre pontos reais; 14 dias é nulo', () => {
    const ds = rowsToDataset(comOd(OD), AGORA)
    const v = ds.videos.find(x => x.ytId === 'vid-cortado')!
    expect(v.truncated).toBe(true)
    expect(ds.dailyCappedFrom).toBe(OD)
    expect(viewsAtAge(ctxDe(ds), v, 14, 'dias')).toBeNull()        // assinatura real de viewsAtAge: series.ts:75
  })
  it('item 81: com o corte o vídeo antigo é truncated; sem o corte (nada saiu) não é', () => {
    const sem = rowsToDataset(comOd(null), AGORA).videos.find(x => x.ytId === 'vid-cortado')!
    expect(sem.truncated).toBeUndefined()
  })
  it('Review Focus 1: online desde não lido → Dataset diz não lido, nenhum vídeo truncated, nada assume 365', () => {
    const ds = rowsToDataset(comOd('nao-lido'), AGORA)
    expect(ds.onlineDesde).toEqual({ lido: false, porque: 'erro_do_banco' })
    expect(ds.dailyCappedFrom).toBeNull()
    expect(ds.videos.some(v => v.truncated)).toBe(false)
  })
  it('Review Focus 2: viewsAtAge antes do primeiro ponto é nulo, incondicionalmente (Yannis I-5), nunca extrapolado', () => {
    const ds = rowsToDataset(comOd(OD), AGORA)
    const v = ds.videos.find(x => x.ytId === 'vid-cortado')!
    expect(viewsAtAge(ctxDe(ds), v, 2, 'dias')).toBeNull()
  })
  it('sem onlineDesde nas linhas (o golden e o oracle): o Dataset não ganha a chave', () => {
    const r = comOd(null) as { onlineDesde?: unknown }; delete r.onlineDesde
    expect('onlineDesde' in rowsToDataset(r as never, AGORA)).toBe(false)
  })
})
```

Antes de escrever, abrir `series.ts:75-90` e `grep -n "viewsAtAge(" apps/web/test/youtube/observatorio/*.test.ts | head -3` e ajustar a **assinatura real** de `viewsAtAge` e o contexto (`ctxDe` é o nome do que os testes de `series` usam para isso; usar o nome que existir). E o caso do cartão `assembleRows`: acrescentar a `carregador-online-desde.test.ts` um `it('assembleRows descarta as linhas do pacote anteriores ao online desde')` com `live.onlineDesde` de 2027-05-01 e um pacote com uma linha de `snap_date: '2027-04-15'`: ela não aparece em `assembleRows(...).daily`.

**`viewsAtAge` (Yannis I-5).** Hoje (`series.ts:75-90`) a extrapolação para trás acontece quando `T` cai antes do primeiro ponto, e esse `if` **não existe** no código atual (Phil r2 N8): é para **acrescentar** `if (T < pointTime(ctx,u,a)) return null`, valendo **sem condição**, não só com `truncated` (um vídeo sem a marca, com buraco de coleta, extrapolava do mesmo jeito). Mexer: depois de achar o primeiro ponto `a`, `if (T < pointTime(ctx, u, a)) return null`. **Esta mudança altera números já no deploy, sem arquivo algum** (Yannis r2 N-10): a curva esperada deixa de incluir vídeos anteriores à coleta, que antes eram extrapolados. Declarar no ledger e ao Gio (Tarefa 14), e rodar a pasta inteira `apps/web/test/youtube/observatorio` com saída em arquivo para achar teste que dependa da extrapolação. Rodar `expectedCurve` (`series.ts` ~L183, o consumidor) com um vídeo cortado e afirmar que ele sai da curva esperada (teste no mesmo arquivo: vídeo antigo cortado, curva dos demais inalterada).

- [ ] **Passo 4. Rodar e ver falhar.** `npx vitest run apps/web/test/youtube/observatorio/online-desde.test.ts apps/web/test/youtube/observatorio/carregador-online-desde.test.ts > .superpowers/sdd/manutencao-nas/saidas/m5-t4.txt 2>&1; grep -E "FAIL|×" .superpowers/sdd/manutencao-nas/saidas/m5-t4.txt | head -30`.
- [ ] **Passo 5. Implementar a troca, num commit só.**
  - `load.ts`: apagar `DAILY_MAX_DAYS` e o comentário dele (113-119); novas funções:

```ts
/** First SP date of the daily read: one day before the series start (the day-0 baseline). No lookback cap: a series is as old as the collection (2026-10-03). */
export function dailyReadFrom(seriesStart: number): string { return spDate(seriesStart - DAY) }

/** SP midnight where the ONLINE series starts when that cut into the series (a month of the daily series left the online database); else null. */
export function dailyCappedFrom(seriesStart: number, onlineDesde: number | null): number | null {
  return onlineDesde != null && seriesStart - DAY < onlineDesde ? onlineDesde : null
}
```

  - `ObservatoryRows` (`load.ts:65`) e `LiveRows` ganham `onlineDesde?: OnlineDesde`; `readSiteLive` lê `lerOnlineDesde(sb, siteId, SAIDA_DE_MES_EXISTE)` (constante nova de `capacidades.ts`, `false` até a M6; Phil r2 N1) dentro do mesmo `Promise.all` e o devolve; `loadLiveRows` e `loadRows` o repassam; `assembleRows` o copia de `live` (`...live`) e acrescenta ao filtro de `daily`: `&& (od == null || d.snap_date >= spDate(od))`, com `od = live.onlineDesde?.lido ? live.onlineDesde.porTabela.competitor_video_daily : null`.
  - `rowsToDataset` (`load.ts:244`): `const od = rows.onlineDesde?.lido ? rows.onlineDesde.porTabela.competitor_video_daily : null; const cappedFrom = dailyCappedFrom(seriesStart, od)`; o `Dataset` leva `...(rows.onlineDesde ? { onlineDesde: rows.onlineDesde } : {})` (`load.ts:379`). `truncated` (`:321`) fica como está (`pub >= seriesStart && pub < cappedFrom`).
  - Chamadores: `load.ts:605` → `dailyReadFrom(seriesStart ?? now)`; `:664` → `dailyReadFrom(seriesStart)`; `load-channel.ts:35` → `dailyReadFrom(seriesStart)`; `:55` → `dailyReadFrom(seriesStart ?? now)`.
  - `types.ts:47`: comentário de `truncated` passa a "The online series starts after the publication (a month of the daily series left the online database, ds.dailyCappedFrom): no day-0 baseline may be assumed."; `Dataset` (`:120-123`) ganha `onlineDesde?: OnlineDesde` com o comentário "ausente = as linhas não o traziam (oracle, golden)".
  - Sentry: o aviso do ">300 dias, lido e nulo" vai em `loadLiveRows` (um lugar só), depois de ler `onlineDesde`.
  - `series.ts`: o conserto de `viewsAtAge` do Passo 3.
  - **Testes existentes que mudam com o conserto (regra anti-regressão: mesmo commit):** `load.test.ts:384-387` ("reads from series start − 1 d, never older than 365 d") vira `dailyReadFrom(NOW - 30 * DAY)` = `'2026-09-23'` e `dailyReadFrom(NOW - 900 * DAY)` = a véspera de 900 dias (não 365); `load.test.ts:403-420` ("daily lookback cap") troca `dailyCappedFrom(NOW - 30 * DAY, NOW)` por `dailyCappedFrom(NOW - 30 * DAY, null)` (nulo), a segunda por `dailyCappedFrom(NOW - 900 * DAY, OD)` com `rows({ ..., onlineDesde: { lido: true, porTabela: ... } })`, e o segundo `it` do bloco ("a video published after seriesStart but before the cap is truncated") passa a usar o mesmo `onlineDesde`. `grep -rn "dailyReadFrom\|dailyCappedFrom" apps/web/test` e conferir cada ocorrência (as de `load-page.test.ts:406, 553, 574` leem o pacote, não essas duas funções: rodar o arquivo inteiro e corrigir só o que falhar, registrando no ledger).
- [ ] **Passo 6. Rodar e ver passar** os dois arquivos novos **e** toda a pasta `apps/web/test/youtube/observatorio` (saída em arquivo, só falhas no contexto), incluindo o golden `video-antigo/__golden__/dataset-antes.json` (não deve mudar: `onlineDesde` é opcional).
- [ ] **Passo 7. Typecheck.** `npm run typecheck -w apps/web > .superpowers/sdd/manutencao-nas/saidas/m5-tc.txt 2>&1; tail -5 .superpowers/sdd/manutencao-nas/saidas/m5-tc.txt`.
- [ ] **Passo 8. Commit único (pedido 11), caminhos explícitos** (os arquivos novos entram com `git add --` antes):

```bash
git add -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/online-desde.ts apps/web/test/youtube/observatorio/online-desde.test.ts apps/web/test/youtube/observatorio/carregador-online-desde.test.ts apps/web/test/youtube/observatorio/helpers/fabrica-load.ts apps/web/test/youtube/observatorio/series.test.ts   # series.test.ts só se o Passo 3 o criou; se os testes de viewsAtAge ficaram em carregador-online-desde.test.ts, tirar do comando
git commit -m "feat: carregador sem o teto de 365 dias, com o corte marcado pelo online desde do registro (manutenção M5, pedido 11, itens 34, 35 e 81)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/online-desde.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts apps/web/src/lib/youtube/observatorio/load.ts apps/web/src/lib/youtube/observatorio/load-channel.ts apps/web/src/lib/youtube/observatorio/series.ts apps/web/src/lib/youtube/observatorio/types.ts apps/web/test/youtube/observatorio/online-desde.test.ts apps/web/test/youtube/observatorio/carregador-online-desde.test.ts apps/web/test/youtube/observatorio/helpers/fabrica-load.ts apps/web/test/youtube/observatorio/series.test.ts apps/web/test/youtube/observatorio/load.test.ts
```

(Mais os arquivos de teste que o Passo 6 mandou corrigir, por caminho.) Registrar no ledger "pedido 11 feito: <hash>" e avisar o controlador da A5 no arquivo da Tarefa 0, Passo 2.

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
/** Dia SP de início da coleta DESTE vídeo: o maior entre o começo da série e o dia em que o canal foi adicionado (Phil I8, D-M5-12). */
export function coletaDoVideo(o: { seriesStart: number; addedAt: number | null }): number
export function frasePeca1(e: EstadoPeca1, quem: 'edita' | 'so_le'): { texto: string; forma: 'nenhuma' | 'arquivo' | 'pontilhado' | 'zero' | 'hachura'; portaVerAntigo: boolean }
export function frase72h(o: { horasNoArquivoDesde: number | null; lido: boolean }): { texto: string; forma: 'arquivo' | 'hachura' } | null
export function fraseNormalDoCanal(o: { n: number; noArquivo: number; minimo: 3; desde: number | null }): string | null
export function frasePeriodo(o: { pedidoDias: number; online: { desde: number; meses: number }; motivo: 'coleta_recente' | 'arquivo' }): string
export function fraseComentarioSemTexto(mesAno: string): string    // "Comentário de mm/aaaa. O texto está no arquivo e não aparece aqui."
/** O `desde` da leitura de hora em hora: precisão 'mes' (um mês saiu) diz o mês, nunca uma hora inventada (Phil I7). */
export function fraseDesdeDaHoraria(o: { desde: number; precisao: 'hora' | 'mes' }): string   // 'mes': "desde outubro de 2026"; 'hora': "desde 02/11 às 14:00"
```

**O que acontece quando o dado não existe:** `onlineDesde` nulo e lido → `nada_saiu` em toda idade (a tela de hoje, inalterada: teste de instantâneo contra a saída atual); não lido → só as idades cujo ponto é anterior a `inicioSeguro` saem `nao_medido`; idade anterior ao começo da coleta → `antes_da_coleta` (pontilhado), nunca "no arquivo"; 1, 7 e 30 dias nunca saem "no arquivo" (marcas ficam online). Porta "Ver antigo" nunca aparece nesta etapa (a peça 6 é da M7): `portaVerAntigo` é `false` até a M7 e quem só lê vê a frase do trecho (item 85; `04` L39).

- [ ] **Passo 1. Fechar a lista dos consumidores.** `grep -rn "viewsAtAge\|vpdSince\|truncated\|dailyCappedFrom\|72 h\|72h\|primeiras 72" apps/web/src/app/cms/\(authed\)/youtube/competitors apps/web/src/lib/youtube/observatorio/medidas-telas > .superpowers/sdd/manutencao-nas/saidas/m5-p1.txt`; cada achado vira uma linha do ledger (arquivo, linha, o estado da `04` §14.1 que ele mostra). Leitor sem estado correspondente reprova (`04` L90).
- [ ] **Passo 2. Testes, falhando** (itens 36 e 84; um caso por linha da tabela `04` L71-84):

```ts
// apps/web/test/youtube/observatorio/peca1.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { estadoDaIdade, coletaDoVideo, frasePeca1, frase72h, fraseNormalDoCanal, frasePeriodo, fraseComentarioSemTexto, fraseDesdeDaHoraria } from '@/lib/youtube/observatorio/arquivo-mensal/peca1'

const D = 86_400_000, sp = (d: string) => Date.parse(d + 'T03:00:00Z')
const base = { pub: sp('2026-10-10'), deMarca: false, onlineDesde: sp('2027-05-01'), lido: true, coleta: sp('2026-10-03'), now: sp('2027-06-10') }

describe('peça 1', () => {
  it('nada saiu: a tela não muda', () => expect(estadoDaIdade({ ...base, onlineDesde: null, idadeDias: 14 })).toEqual({ k: 'nada_saiu' }))
  it('14 dias com o dia 14 no arquivo: no arquivo, nunca número', () => expect(estadoDaIdade({ ...base, idadeDias: 14 }).k).toBe('no_arquivo'))
  it('Phil I8: canal adicionado depois do começo da série: coleta por vídeo, antes_da_coleta e não no arquivo', () => {
    // canal adicionado em 15/03/2027, online desde 01/05/2027, vídeo de 10/01/2027, pedido de 14 dias (24/01/2027 < coleta)
    expect(coletaDoVideo({ seriesStart: sp('2026-10-03'), addedAt: sp('2027-03-15') })).toBe(sp('2027-03-15'))
    expect(coletaDoVideo({ seriesStart: sp('2026-10-03'), addedAt: null })).toBe(sp('2026-10-03'))
    expect(estadoDaIdade({ pub: sp('2027-01-10'), idadeDias: 14, deMarca: false, onlineDesde: sp('2027-05-01'), lido: true, coleta: sp('2027-03-15'), now: sp('2027-06-10') }).k).toBe('antes_da_coleta')
  })
  it('Phil I7: o desde da horária com um mês fora diz o mês', () => {
    expect(fraseDesdeDaHoraria({ desde: sp('2026-10-01'), precisao: 'mes' })).toBe('desde outubro de 2026')
    expect(fraseDesdeDaHoraria({ desde: Date.parse('2026-11-02T17:00:00Z'), precisao: 'hora' })).toBe('desde 02/11 às 14:00')
  })
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

Quem chama `estadoDaIdade` passa `coleta = coletaDoVideo({ seriesStart: ds.seriesStart, addedAt: <início do dia SP de channel.added_at> })` (o canal vem de `ds.channels`); `ds.obsStart` **não** serve (é a menor `added_at` do site, `load.ts:379`). `lido` e `onlineDesde` vêm de `ds.onlineDesde` (Tarefa 4; ausente no Dataset = `lido: true`, `onlineDesde: null`).

**Atenção:** as frases acima são as do `04` §14.1 com as decisões M4 do dono; antes de fixar cada uma, conferir com `series.js` do mockup 19 (`grep -n "no arquivo\|desde\|coleta começou" docs/superpowers/mockups/2026-10-14-manutencao-nas/19-mes-fora-do-banco/series.js`). **O mockup vale**: diferença de palavra → usar a do mockup e anotar no ledger.

- [ ] **Passo 3. Rodar e ver falhar.**
- [ ] **Passo 4. Implementar `peca1.ts`** como função pura sobre os campos acima (sem `Date.now()` dentro; `now` vem do Dataset). A regra de `estadoDaIdade`: `deMarca` → `nada_saiu`; `pub + idade*D < coleta` → `antes_da_coleta`; `!lido` e `pub + idade*D < inicioSeguro` → `nao_medido`; `onlineDesde != null && pub + idade*D < onlineDesde` → `no_arquivo` com `de` = início do mês do ponto e `ate` = véspera de `onlineDesde`; senão, com `onlineDesde` posterior a `pub`, `desde`; senão `nada_saiu`.
- [ ] **Passo 5. Ligar nas telas.** Para cada linha do ledger do Passo 1: o view-model chama `estadoDaIdade`/`frase*` e o componente desenha a forma pelo `formas-arquivo.tsx`; o eixo do gráfico ganha o trecho "no arquivo" com preenchimento `--sunk`, contorno sólido `--dim` e o rótulo repetido na borda esquerda (mockup `series.js`, `.m-seg.arq`, largura `max(120px,22%)`; a 390 px o rótulo em linha própria). Selo "ajuste de mockup aprovado" não vai à produção (é marca do mockup).
- [ ] **Passo 6. Teste de componente** (jsdom) para o eixo: com `no_arquivo`, o SVG tem um `<rect>` com a classe da forma `arquivo` e um `<text>` com "no arquivo"; com `nada_saiu`, nenhum dos dois (`apps/web/test/youtube/observatorio/eixo-arquivo.test.tsx`, `// @vitest-environment jsdom`).
- [ ] **Passo 7. Rodar, typecheck, commit** `feat: peça 1 nas telas de série: desde dd/mm e no arquivo, sem número interpolado (manutenção M5, 04 §14.1, itens 36, 84 e 85)`, por caminho.

---

### Task 6: os outros leitores das séries, a lista fechada e o teste dos 180 dias

**Files:**
- Modify: `apps/web/src/lib/youtube/horaria/prova.ts` (campos `online_desde` e `desde_precisao` novos; `desde` passa a ser o começo real, Tarefa 3)
- Modify: `apps/web/src/lib/youtube/competitor-removal-impact.ts` (as duas parcelas; a segunda vem de `obs_archive_channel_archive_impact`, Tarefa 3)
- Modify: `apps/web/src/lib/youtube/observatorio/medidas/ler.ts:219-253` (`lerSeriesDoCanal` com `desde` anterior ao `online desde`: devolve também `cortadoEm`)
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/leitores-das-series.ts`
- Create: `apps/web/test/manutencao/leitores-das-series.test.ts`

**Interfaces:**
- Consumes: Tarefas 1, 3, 4.
- Produces: `export const LEITORES_DAS_SERIES: readonly { arquivo: string; comoTrata: 'janela_por_construcao' | 'registro' | 'texto_online_desde' | 'escritor' }[]` em `leitores-das-series.ts`; `export const EXCECOES_DE_DATA_FIXA: readonly { arquivo: string; motivo: string }[]` no mesmo arquivo (item 83; **toda** entrada tem motivo e a confirmação de Phil na Tarefa 16).

**O que acontece quando o dado não existe:** leitor novo de `competitor_video_daily|early|hourly` sem linha na lista → o teste falha com o caminho do arquivo (a lista é fechada por busca, item 82). `online_desde` ausente na resposta de `competitor_hourly_health` (função antiga, antes da migration) → `prova.ts` lê `null` e o vigia diz "não medido", nunca "verde". `desde_precisao` ausente → trata como `'hora'`.

**Fatos conferidos em 14/10 (Yannis I-9).** `git grep -l -E '\b(365|180)\b|2026-10-0[1-3]'` sobre `competitors/` e `medidas-telas/` acha hoje **7 arquivos**: seis cabeçalhos de CSS (`_canais/canais.css`, `_chrome/chrome.css`, `_historico/historico.css`, `_insights/insights.css`, `_mudancas/mudancas.css`, `_outliers/outliers.css`, a data no comentário de licença/versão) e `medidas-telas/calendario.ts`, linha 10, `INICIO_DAS_MARCAS = '2026-10-03'`. Por isso o teste do plano antigo falhava de saída. Além disso `git grep` sai com status 1 quando não acha nada, e `execFileSync` **lança** nesse status: o plano antigo quebraria justamente quando tudo está certo. As correções: (1) um helper que trata o status 1 como lista vazia; (2) a busca é limitada a `*.ts` e `*.tsx` (CSS não é "leitura de série"); (3) `INICIO_DAS_MARCAS` é a data de início das **marcas** V1, V7 e V30 (`competitor_video_marks`, que nunca saem do banco), não a da série; entra como **única** entrada de `EXCECOES_DE_DATA_FIXA`, com o motivo escrito e a confirmação de Phil na Tarefa 16 (Yannis: nunca exceção silenciosa); (4) um "teste do teste" prova que a busca enxerga um arquivo novo com `'2026-10-02'`.

- [ ] **Passo 1. Teste, falhando:**

```ts
// apps/web/test/manutencao/leitores-das-series.test.ts
// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { writeFileSync, rmSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { LEITORES_DAS_SERIES, EXCECOES_DE_DATA_FIXA } from '@/lib/youtube/observatorio/arquivo-mensal/leitores-das-series'
import { JANELA_MINIMA_DIAS } from '@/lib/youtube/observatorio/arquivo-mensal/online-desde'

const RAIZ = resolve(__dirname, '../../../..')
/** `git grep` sai com 1 quando não acha: isso é "lista vazia", não erro. Qualquer outro status propaga. */
function achar(padrao: string, dirs: string[], fora?: string): string[] {  // `fora`: diretório fora do repositório (teste do teste): git grep --no-index nele
  try {
    return execFileSync('git', ['grep', '-l', '-E', fora ? '--no-index' : '--untracked', padrao, '--', ...dirs], { cwd: fora ?? RAIZ, encoding: 'utf8' }).split('\n').filter(Boolean)
  } catch (e) {
    if ((e as { status?: number }).status === 1) return []
    throw e
  }
}
/** Pathspec padrão do git: `*` atravessa `/`, então `dir/*.ts` pega a árvore inteira (conferido em 14/10; `**` não pega os filhos diretos). */
const SO_CODIGO = ['*.ts', '*.tsx']
const DIRS_DE_TELA = ['apps/web/src/app/cms/(authed)/youtube/competitors', 'apps/web/src/lib/youtube/observatorio/medidas-telas']

describe('quem lê as três séries (04 §14.1, item 82)', () => {
  it('todo arquivo que menciona uma das três tabelas está na lista, com o seu tratamento', () => {
    const achados = achar("competitor_video_(daily|early|hourly)", SO_CODIGO.map(g => 'apps/web/src/' + g))
    const lista = new Set(LEITORES_DAS_SERIES.map(l => l.arquivo))
    expect(achados.filter(a => !lista.has(a))).toEqual([])
  })
  it('a lista não cita arquivo que não existe mais', () => {
    for (const l of LEITORES_DAS_SERIES) expect(() => readFileSync(resolve(RAIZ, l.arquivo), 'utf8'), l.arquivo).not.toThrow()
  })
})

describe('janelas e datas fixas (item 83)', () => {
  const DIR_TEMP = mkdtempSync(join(tmpdir(), 'item83-')), ARQUIVO_TEMP = join(DIR_TEMP, '__tmp_item83.ts')  // fora de src (Yannis r2 N-9): processo morto não deixa lixo na árvore
  afterEach(() => { rmSync(DIR_TEMP, { recursive: true, force: true }) })
  it('nenhum arquivo de código de tela escreve 365, 180 ou data de início de coleta, salvo a lista nomeada', () => {
    const achados = achar('\\b(365|180)\\b|2026-10-0[1-3]', DIRS_DE_TELA.flatMap(d => SO_CODIGO.map(g => d + '/' + g)))
    const permitidos = new Set(EXCECOES_DE_DATA_FIXA.map(e => e.arquivo))
    expect(achados.filter(a => !permitidos.has(a))).toEqual([])
  })
  it('toda exceção tem motivo escrito', () => { for (const e of EXCECOES_DE_DATA_FIXA) expect(e.motivo.length, e.arquivo).toBeGreaterThan(30) })
  it('o teste do teste: a busca enxerga um arquivo novo com a data de início', () => {
    writeFileSync(ARQUIVO_TEMP, "export const X = '2026-10-02'\n")
    // a mesma função `achar`, com cwd no diretório temporário (fora do repositório, `--no-index`)
    const achados = achar('\\b(365|180)\\b|2026-10-0[1-3]', ['*.ts'], DIR_TEMP)
    expect(achados.some(a => a.endsWith('__tmp_item83.ts'))).toBe(true)
  })
  it('as telas de 180 dias dependem da janela online da política, lida e não escrita', () => {
    expect(JANELA_MINIMA_DIAS.competitor_video_daily).toBeGreaterThanOrEqual(181)
    expect(JANELA_MINIMA_DIAS.competitor_video_hourly).toBeGreaterThanOrEqual(89)
  })
})
```

`--untracked` faz o `git grep` enxergar o arquivo temporário do "teste do teste" sem `git add`. O `INICIO_DAS_MARCAS` de `calendario.ts` é a única entrada inicial de `EXCECOES_DE_DATA_FIXA`. Os achados de hoje fora desses diretórios (por exemplo "a janela de 91–180 dias" de `insights.ts:204-217`) são regra de engenho, não data de início; se a busca achar algo novo em tela, o achado é corrigido (lido de `JANELA_MINIMA_DIAS` ou da constante existente) e anotado no ledger, **nunca** posto na lista de exceção sem a revisão de Yannis.

- [ ] **Passo 2. Rodar e ver falhar** (a lista ainda não existe).
- [ ] **Passo 3. Escrever `leitores-das-series.ts`** com uma linha por arquivo achado pelo `git grep` do teste (hoje: `agenda/tarefas/leitura-horaria.ts` e `horaria/gravar.ts` como `escritor`, `competitor-sync.ts` como `escritor`, `observatorio/cache-tag.ts` como `janela_por_construcao`, `types/database.types.ts` como `janela_por_construcao` (tipos gerados), `competitor-health.ts` e `medidas/ler.ts` como `registro`/`texto_online_desde`, `observatorio/load.ts` e `load-channel.ts` como `registro`, `arquivo-mensal/contrato.ts` como `janela_por_construcao`; a busca do Passo 2 diz o que mais há), cada uma com um comentário de uma linha dizendo o que a tela passa a dizer depois de uma saída (`04` L92-96). Mais `EXCECOES_DE_DATA_FIXA = [{ arquivo: 'apps/web/src/lib/youtube/observatorio/medidas-telas/calendario.ts', motivo: 'INICIO_DAS_MARCAS é o início das marcas V1, V7 e V30 (competitor_video_marks), que nunca saem do banco; não é o início da série diária e não depende do online desde.' }]`.
- [ ] **Passo 4. Ajustar os três leitores**, cada um com teste no arquivo que já o cobre (`grep -rl "prova\|removal-impact\|lerSeriesDoCanal" apps/web/test`): (a) `prova.ts` lê `online_desde` e `desde_precisao` (ausentes = `null` e `'hora'`) e mantém `desde` como o começo real; com um mês de horária fora, `desde` não pula de outubro para novembro (a função do banco é a da Tarefa 3; o teste do TS prova que o leitor passa os três campos adiante); (b) `competitor-removal-impact.ts` devolve as duas parcelas, "no banco agora" (o `competitor_channel_removal_impact` de hoje, intocado) e "no arquivo" (`obs_archive_channel_archive_impact`, tolerando função ausente = parcela `null`, "não medido"), e o diálogo de remover (da M3b) soma **"no banco agora" mais `fora_do_banco.registros` e `fora_do_banco.meses` (o que já saiu do banco), nunca os `registros`/`meses` totais do arquivo**, que incluem o que ainda está no banco e contariam o mesmo dado duas vezes (Phil r2 N2); teste com as duas respostas fixas antes e depois de uma saída: `online + fora_do_banco` é constante, e antes da saída `fora_do_banco.registros = 0` e a soma é só a parcela online; nenhum campo do arquivo diz "dias"; (c) `lerSeriesDoCanal` com `desde` anterior ao `online desde` devolve `cortadoEm` e quem consome (M10 e medidas) diz "desde dd/mm".
- [ ] **Passo 5. Rodar, typecheck, commit** `feat: leitores das séries respeitam o online desde, lista fechada e datas fixas (manutenção M5, itens 82 e 83)`.

---

### Task 7: o estado de cada mês e de cada problema (puro) e o leitor da página

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pagina.ts` (Zod `.strict()` com lista fechada de chaves + leitor de `obs_archive_pagina`)
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-do-mes.ts`
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/vermelhos.ts` (a tabela prefixo do vermelho → frase e forma)
- Create: `apps/web/test/youtube/observatorio/fixtures/arquivo-pagina.ts`
- Test: `apps/web/test/youtube/observatorio/arquivo-estado-do-mes.test.ts`, `apps/web/test/youtube/observatorio/arquivo-pagina-leitor.test.ts`, `apps/web/test/integration/manutencao-m5-pagina-chaves.test.ts`

**Interfaces:**
- Consumes: a forma da Tarefa 2 (grade com `tem_linha`, `devido_em`, `progresso`, `vermelhos`, `atraso`, `casa` com `updated_at`/`nas_checked_at`); `obs_archive_b2_month_state` (`m3b.sql:1912-1930`).
- Produces (tempo sempre em **ms** `number`; a conversão para `Date` é só na borda, quando uma função existente a pede: decisão 7):

```ts
// pagina.ts
export const CHAVES_LINHA_MES: readonly string[]      // a lista fechada das chaves de cada elemento de `meses` (a mesma do SQL da Tarefa 2; o teste de integração compara)
export const CHAVES_CASA: readonly string[]
export type PaginaLida = z.infer<typeof Pagina>        // `lido_em` string ISO; `relogio = Date.parse(lido_em)`
export type ResultadoPagina = { ok: true; pagina: PaginaLida } | { ok: false; porque: 'funcao_ausente' | 'erro_do_banco' | 'fora_do_esquema' }
export function lerPaginaBruta(bruto: unknown): ResultadoPagina
export async function lerPagina(sb: SupabaseClient, siteId: string): Promise<ResultadoPagina>

// estado-do-mes.ts
export type Forma = 'visto' | 'pontilhado' | 'pontilhado_ambar' | 'triangulo' | 'octogono' | 'hachura' | 'arquivo' | 'zero' | 'barra'
export type Etapa = { rotulo: string; curto: string; forma: Forma }
export type Gravidade = 'nenhuma' | 'ambar' | 'vermelho' | 'nao_medido'
export interface LinhaDoMes { chave: string; mesNome: string; regua: Etapa[] /* 5, ou 2 depois de "pode sair" */; frase: string; secundaria: string | null
  gravidade: Gravidade; sobeAoTopo: boolean
  /** O encaixe da M6: o botão (Sair do banco, Liberar, Trazer de volta) entra aqui; a M5 nunca o preenche. */
  acoes?: ReactNode }
export interface CartaoDoTipo { tipo: 'horaria' | 'serie' | 'texto'; titulo: string; resumo: string; linhas: LinhaDoMes[]; anosNoArquivo: { ano: number; meses: number; todosConferidos: boolean }[]; acoes?: ReactNode }
export interface Casa { estado: 'responde' | 'nao_respondeu' | 'nunca_deu_sinal' | 'nas_fora' | 'nas_cheio' | 'nas_sem_verificar'; desde: number | null; forma: Forma; frase: string }
export interface ModeloPagina { resumo: { texto: string; forma: Forma }; casa: Casa; tipos: CartaoDoTipo[]; problemas: LinhaDeProblema[]; mesesAFrente: { tabela: string; frase: string; forma: Forma }[]
  teste: null | { faixa: string; linhas: LinhaDoMes[]; encerradoEm: number | null }; ligado: boolean }
export function montarPagina(p: PaginaLida, o: { arquivoLigado: boolean }): ModeloPagina      // o relógio é Date.parse(p.lido_em): só um relógio na página (Phil M5)
export function casaDe(batimentos: PaginaLida['casa'], vermelhos: readonly string[], agora: number): Casa
export interface LinhaDeProblema { prefixo: string | null; frase: string; forma: 'octogono' | 'triangulo'; bruto: string /* o texto cru do pulso, para o ⓘ */ }
/** O que a página mostra com o arquivo desligado (`montarPagina(_, { arquivoLigado: false })` devolve o mesmo) e quando a leitura falhou. `funcao_ausente`: "O arquivo ainda não foi instalado neste banco."; os outros: "Não foi possível ler o estado do arquivo". Ambos em hachura; a casa fica "não medida" (hachura), nunca "A casa ainda não deu sinal", que é a leitura bem-sucedida sem batimento. */
export function modeloDesligado(): ModeloPagina
export function modeloNaoLido(porque: 'funcao_ausente' | 'erro_do_banco' | 'fora_do_esquema'): ModeloPagina
```

`ReactNode` vem de `import type { ReactNode } from 'react'`: o arquivo é `.ts` puro sem JSX, só o tipo.

**Regras (de `04` §14.2 e do mockup `arq-dados.js`; o mockup manda nas palavras):**
- **O tempo da página é o do banco.** `montarPagina` não recebe `agora`: usa `Date.parse(p.lido_em)`, com `lido_em = obs_archive_agora()` (Phil M5). Com isso os testes simulam o relógio por `lido_em`, e a página nunca discorda do banco sobre "hoje" (o banco já devolve `hoje`, em SP).
- **Ordem dentro do tipo:** a linha que precisa do dono no topo (única com contorno de cor); logo depois o mês que já saiu das telas (`11.7` do Logan: "Liberar o espaço devolve cerca de N% do banco."); depois "Pode sair"; depois os online do mais novo ao mais velho; meses no arquivo agrupados por ano numa linha.
- **Classes (Phil M4).** A página tem **três** cartões: `horaria`, `serie`, `texto`. O vídeo antigo (`video_antigo`) não é cartão nem linha: a coluna `classes` do SQL só traz as três. Teste: JSON com uma quarta classe → Zod recusa (`.strict()` sobre a lista fechada de classes).
- **Etapas:** NAS (visto com verificação < 24 h; triângulo "Cópia sem verificação há N horas" acima; pontilhado sem atestação); B2 (visto com forja < 7 dias ou você < 35; triângulo quando só resta a sua; triângulo a 6 dias da forja, 2 no mês que pode sair em 7; octógono sem nenhuma válida; a origem só no texto); Recuperação (visto com a última restauração < 180 dias **e** `schema_fp` igual ao `schema_fp_atual` que o banco devolve (Phil I4: o fp muda quando uma coluna entra e o teste da época deixa de valer); senão "Refaça o teste de recuperação…"; triângulo 30 dias antes de vencer); Prazo (pontilhado até `devido_em` + janela); Pode sair.
- **Mês sem linha de registro** (`tem_linha: false`, Phil C1): é a linha de **grade**. Frase pelo progresso: antes de `devido_em`, "Em coleta" (corrente) ou "Fechado. Cópia a partir de dd/mm" (`devido_em`); depois de `devido_em` e com `canais_prontos < canais_esperados`, "Copiando: X de Y canais" (X > 0) ou "Cópia atrasada há N dias" (X = 0; N = `hoje − devido_em`; triângulo âmbar acima de 5 dias, octógono vermelho acima de 30, as mesmas faixas de `obs_archive_atraso`, `m3b.sql:2062`). Com `canais_esperados = 0` e nenhum canal no site: "Sem canais neste mês" em `zero`, nunca "Copiando: 0 de 0".
- **Meses à frente (Phil M3):** `months_ahead` ≥ 6 sem aviso; 3 a 5 âmbar; menos de 3 vermelho; **-1** → "O mês corrente não existe nesta tabela. Rode a criação de partições." em octógono (nunca "−1 meses"); **nulo** → "Tabela ainda não particionada: não medido" em hachura. Cada tabela da série tem a sua frase (3 tabelas).
- **`casaDe` (Phil I2):** o sinal de cada programa (`copiador`, `respondedor`, `conferir_b2`) é `max(last_poll_at, updated_at)`: `last_poll_at` só o copiador grava (`m3b.sql:2258-2259`), os outros dois só gravam `updated_at` (`obs_archive_heartbeat_write`, `m3b.sql:2186-2225`). Sem nenhum batimento → `nunca_deu_sinal` (triângulo, "A casa ainda não deu sinal"). **Programa esperado sem linha (Phil r2 N7, Yannis r2 N-8):** `casaDe` exige linha do `copiador` e do `conferir_b2` (o `respondedor` só a partir da M7); a falta de qualquer um dos dois, mesmo com os outros batendo, é triângulo "<programa> ainda não deu sinal" (`estado: 'programa_sem_sinal'`), nunca "responde"; teste: só o `conferir_b2` bateu → triângulo `programa_sem_sinal` do copiador (o caso do teste "só o conferir_b2 deu sinal" abaixo muda de `responde` para isso, e `responde` passa a exigir os dois). **Âncora dos limiares (Phil r2 N6):** os limiares de 5 e 30 dias existem em `obs_archive_atraso` (SQL) e em `estado-do-mes.ts` (TS); um teste de integração semeia unidade a 5, 6, 30 e 31 dias de atraso e compara a gravidade de `obs_archive_atraso` com a de `montarPagina` para o mesmo mês (mesmos números nos dois lados). Sinal de qualquer programa com mais de **36 h** → octógono `nao_respondeu`; entre **24 h** e 36 h → triângulo (24 h e 36 h são o limiar da varredura do NAS, `m3b.sql` na `heartbeat_write`: "varredura abre com `nas_checked_at` anterior > 24 h"; comentário no código com essa fonte). `nas_checked_at` do copiador com mais de 24 h → `nas_sem_verificar` (triângulo), mais de 36 h → octógono. `nas_ok` falso → `nas_fora`; **"NAS cheio" não vem de `last_error`** (Phil I2): vem de um vermelho com prefixo `nas_80:` em `vermelhos` → `nas_cheio`.
- **Vermelhos (Phil I1):** a seção "Problemas" lê `p.vermelhos` (a mesma lista do pulso) por **prefixo**, tabela em `vermelhos.ts` (um prefixo → frase com o resto da linha, forma `octogono` ou `triangulo`): `atraso de cópia`, `mês sem selo`, `NAS: `, `B2: `, `conteúdo divergente`, `mês descartado sem releitura`, `b2_atrasado`, `B2 recusou o fileId`, `canário do filho`, `canario_regravado:`, `nas_ilegivel:`, `b2_ilegivel:`, `nas_80:`, `tabela_ausente:`, `b2_piso_acima_do_teto`, `b2_completo_atrasado`, `b2_teto_2_dias`, `vigia da remoção: consulta`. **Prefixo desconhecido** → linha genérica "O arquivo tem um problema que esta página ainda não descreve." com o texto cru no ⓘ, em octógono (a página nunca engole um vermelho que não conhece).
- **Arquivo desligado** (`arquivoLigado` falso, `OBS_ARQUIVO !== 'on'`) → toda a página é a frase "O arquivo está desligado neste site: nada está sendo copiado nem tirado", pontilhado neutro, e nenhum mês.

**O que acontece quando o dado não existe:** leitura falhou ou fora do esquema → `lerPagina` devolve `{ ok: false }` e a página mostra só "Não foi possível ler o estado do arquivo" em hachura (nunca lista vazia, nunca "nada precisa de você"); `funcao_ausente` (a migration ainda não subiu): `{ ok:false, porque:'funcao_ausente' }`, sem Sentry, e **a aba Arquivo nem aparece** (Tarefa 9/11); nenhum canal e `first_month` nulo → resumo "A primeira cópia é a de outubro, a partir de dd/mm" (de `devido_em` da primeira linha da grade) com o pontilhado, nunca "0 meses"; `casa: []` → `nunca_deu_sinal`.

- [ ] **Passo 1. A fixture** `apps/web/test/youtube/observatorio/fixtures/arquivo-pagina.ts`: `AGORA = Date.parse('2028-05-03T15:00:00Z')`, `paginaVazia(over)` (forma da Tarefa 2 com `versao: 1`, `lido_em: new Date(AGORA).toISOString()`, `hoje: '2028-05-03'`, um batimento de cada programa há 1 h, três classes com `first_month: '2026-10-01'`, `recuperacao`, `meses_a_frente` com 12, `vermelhos: []`, `teto_b2: 'verde'`) e `mesCom(o)` que devolve `{ linha, progresso? }` coerentes (o mês fechado mais recente por padrão), com as opções `mes`, `dias`, `devidoHa`, `esperadas`, `recebidas`, `nasHorasAtras`, `b2Forja` (dias), `b2Dono` (dias), `b2Tentativa`, `b2Divergiu`, `conteudoDivergente`, `unsealed`, `recuperacaoHa`, `vazioConferido`, `destacadoHa`, `descartadoHa`. `paginaVazia({ meses: [mesCom(...)] })` junta as linhas e os progressos.
- [ ] **Passo 2. Testes, falhando:** um `it` por estado das duas tabelas da `04` L145-192 (item 39: "cada estado de problema da peça 2 tem frase e forma próprias; nenhum cai em 'ok' nem em linha vazia"), como tabela; mais os casos novos desta revisão:

```ts
// apps/web/test/youtube/observatorio/arquivo-estado-do-mes.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { montarPagina, casaDe } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { paginaVazia, mesCom, AGORA } from './fixtures/arquivo-pagina'

// [nome do estado (04), mês semeado, frase que começa assim, forma da etapa que manda, gravidade]
const CASOS: [string, ReturnType<typeof mesCom>, string, string, string][] = [
  ['No ar', mesCom({ mes: 'corrente' }), 'Em coleta', 'pontilhado', 'nenhuma'],
  ['Aguardando a margem', mesCom({ mes: 'fechado_ha', dias: 10 }), 'Fechado. Cópia a partir de', 'pontilhado', 'nenhuma'],
  ['Copiando', mesCom({ devidoHa: 1, esperadas: 45, recebidas: 12 }), 'Copiando: 12 de 45 canais', 'barra', 'nenhuma'],
  ['No NAS', mesCom({ nasHorasAtras: 3 }), 'No NAS, verificado hoje às', 'visto', 'nenhuma'],
  ['No B2 pela forja', mesCom({ nasHorasAtras: 3, b2Forja: 1 }), 'No B2, conferido pela forja', 'visto', 'nenhuma'],
  ['Só a sua vale', mesCom({ nasHorasAtras: 3, b2Forja: 9, b2Dono: 20 }), 'No B2, conferido por você em', 'triangulo', 'ambar'],
  ['B2 sem nenhuma válida', mesCom({ nasHorasAtras: 3, b2Forja: 9, b2Dono: 40 }), 'A forja não confere o B2 há 9 dias. Nada sai deste mês', 'octogono', 'vermelho'],
  ['Atrasado 6 dias', mesCom({ devidoHa: 6, esperadas: 2, recebidas: 0 }), 'Cópia atrasada há 6 dias', 'triangulo', 'ambar'],
  ['Atrasado 31 dias', mesCom({ devidoHa: 31, esperadas: 2, recebidas: 0 }), 'Cópia atrasada há 31 dias', 'octogono', 'vermelho'],
  ['Verificação vencida', mesCom({ nasHorasAtras: 30 }), 'Cópia sem verificação há 30 horas', 'triangulo', 'ambar'],
  ['Tentativa falhou', mesCom({ b2Tentativa: 'arquivo_ausente' }), 'Última tentativa de conferir o B2', 'octogono', 'vermelho'],
  ['Sem chave', mesCom({ b2Forja: 2, b2Tentativa: 'chave_ausente' }), 'não pôde ser feita: falta a chave', 'triangulo', 'ambar'],
  ['Forja e Mac discordam', mesCom({ b2Divergiu: true }), 'A forja disse que o arquivo de', 'octogono', 'vermelho'],
  ['Arquivo não bate', mesCom({ conteudoDivergente: true }), 'está diferente do que o site guardou', 'octogono', 'vermelho'],
  ['Voltou a não selado', mesCom({ unsealed: 'conteudo_mudou' }), 'O dado deste mês mudou depois da cópia', 'pontilhado', 'nenhuma'],
  ['Recuperação vencida', mesCom({ recuperacaoHa: 200 }), 'Refaça o teste de recuperação: o último é de', 'triangulo', 'ambar'],
  ['Recuperação vence em 30 dias', mesCom({ recuperacaoHa: 151 }), 'O teste de recuperação de', 'triangulo', 'ambar'],
  ['Recuperação de um esquema antigo', mesCom({ recuperacaoHa: 10, fpMudou: true }), 'Refaça o teste de recuperação', 'triangulo', 'ambar'],
  ['Sem registro', mesCom({ vazioConferido: true }), 'Sem registro neste mês (conferimos em', 'zero', 'nenhuma'],
  ['Destacado', mesCom({ destacadoHa: 2 }), 'Saiu das telas em', 'pontilhado', 'nenhuma'],
  ['Destacado 15 dias', mesCom({ destacadoHa: 15 }), 'Saiu das telas há 15 dias', 'triangulo', 'ambar'],
  ['No arquivo', mesCom({ descartadoHa: 30, nasHorasAtras: 5 }), 'No arquivo desde', 'arquivo', 'nenhuma'],
  ['No arquivo sem verificação 22 dias', mesCom({ descartadoHa: 60, nasHorasAtras: 22 * 24 }), 'No arquivo. Sem verificação há 22 dias', 'triangulo', 'ambar'],
  ['No arquivo sem verificação 46 dias', mesCom({ descartadoHa: 90, nasHorasAtras: 46 * 24 }), 'No arquivo. Sem verificação há 46 dias', 'octogono', 'vermelho'],
]

describe('peça 2: o caminho de cada mês (item 39)', () => {
  it.each(CASOS)('%s', (_n, mes, comeco, forma, grav) => {
    const p = montarPagina(paginaVazia({ meses: [mes] }), { arquivoLigado: true })
    const l = p.tipos.flatMap(t => t.linhas)[0]!
    expect(l.frase.startsWith(comeco)).toBe(true)
    expect(l.regua.some(e => e.forma === forma) || (forma === 'arquivo' && l.regua[0]?.forma === 'arquivo')).toBe(true)
    expect(l.gravidade).toBe(grav)
    expect(l.frase.trim().length).toBeGreaterThan(0)
  })
  it('Phil C1: mês devido sem nenhuma linha de registro aparece, atrasado, e não some', () => {
    const p = montarPagina(paginaVazia({ meses: [mesCom({ semLinha: true, devidoHa: 31, esperadas: 2, recebidas: 0 })] }), { arquivoLigado: true })
    expect(p.tipos[0]!.linhas[0]).toMatchObject({ gravidade: 'vermelho' })
    expect(p.tipos[0]!.linhas[0]!.frase).toMatch(/^Cópia atrasada há 31 dias/)
  })
  it('a linha que precisa do dono sobe e é a única com gravidade', () => {
    const p = montarPagina(paginaVazia({ meses: [mesCom({ nasHorasAtras: 3 }), mesCom({ devidoHa: 31, esperadas: 2, recebidas: 0, mesNum: 2 })] }), { arquivoLigado: true })
    expect(p.tipos[0]!.linhas[0]!.gravidade).toBe('vermelho')
  })
  it('as três ausências têm formas diferentes', () => {
    const nr = casaDe([], [], AGORA).forma, nm = 'hachura', arq = 'arquivo'
    expect(new Set([nr, nm, arq]).size).toBe(3)
  })
  it('Review Focus 3: casa sem batimento com mês devido nunca é "Em coleta" nem verde', () => {
    const p = montarPagina(paginaVazia({ casa: [], meses: [mesCom({ devidoHa: 2, esperadas: 2, recebidas: 0 })] }), { arquivoLigado: true })
    expect(p.casa.estado).toBe('nunca_deu_sinal')
    expect(p.resumo.texto).toMatch(/A casa ainda não deu sinal/)
  })
  it('arquivo desligado: uma frase só', () => {
    const p = montarPagina(paginaVazia({ meses: [mesCom({ nasHorasAtras: 3 })] }), { arquivoLigado: false })
    expect(p.tipos).toEqual([])
    expect(p.resumo.texto).toBe('O arquivo está desligado neste site: nada está sendo copiado nem tirado')
  })
  it('site sem nenhum mês: primeira cópia, nunca "0 meses"', () => {
    const p = montarPagina(paginaVazia({}), { arquivoLigado: true })
    expect(p.resumo.texto).not.toMatch(/\b0 meses\b/)
  })
  it('a página usa o relógio do banco (lido_em), não o da máquina', () => {
    const lido = Date.parse('2027-03-01T15:00:00Z')
    const p = montarPagina(paginaVazia({ lido_em: new Date(lido).toISOString(), hoje: '2027-03-01', casa: [{ worker: 'copiador', last_poll_at: new Date(lido - 30 * 3_600_000).toISOString(), updated_at: new Date(lido - 30 * 3_600_000).toISOString() }] }), { arquivoLigado: true })
    expect(p.casa.forma).toBe('triangulo')
  })
})

describe('Phil I2: a casa', () => {
  const h = (h: number) => new Date(AGORA - h * 3_600_000).toISOString()
  const bat = (worker: string, o: Record<string, unknown>) => ({ worker, last_poll_at: null, updated_at: null, nas_ok: true, nas_checked_at: null, last_error: null, ...o })
  it('só o conferir_b2 deu sinal, 1 h atrás por updated_at: responde (last_poll_at nulo não é silêncio)', () => {
    // r2 N7/N-8: sem linha do copiador não é 'responde'
    expect(casaDe([bat('conferir_b2', { updated_at: h(1) })] as never, [], AGORA)).toMatchObject({ estado: 'programa_sem_sinal', forma: 'triangulo' })
    expect(casaDe([bat('copiador', { last_poll_at: h(1), updated_at: h(1), nas_checked_at: h(1) }), bat('conferir_b2', { updated_at: h(1) })] as never, [], AGORA).estado).toBe('responde')
  })
  it('copiador há 25 h: triângulo; há 37 h: octógono', () => {
    expect(casaDe([bat('copiador', { last_poll_at: h(25), updated_at: h(25) })] as never, [], AGORA).forma).toBe('triangulo')
    expect(casaDe([bat('copiador', { last_poll_at: h(37), updated_at: h(37) })] as never, [], AGORA)).toMatchObject({ forma: 'octogono', estado: 'nao_respondeu' })
  })
  it('nas_checked_at velho: o NAS não foi verificado, mesmo com o copiador respondendo', () => {
    expect(casaDe([bat('copiador', { last_poll_at: h(1), updated_at: h(1), nas_checked_at: h(30) })] as never, [], AGORA)).toMatchObject({ estado: 'nas_sem_verificar', forma: 'triangulo' })
  })
  it('NAS cheio vem do vermelho nas_80:, não de last_error', () => {
    expect(casaDe([bat('copiador', { last_poll_at: h(1), updated_at: h(1), nas_checked_at: h(1), last_error: 'nas_cheio' })] as never, [], AGORA).estado).toBe('responde')
    expect(casaDe([bat('copiador', { last_poll_at: h(1), updated_at: h(1), nas_checked_at: h(1) })] as never, ['nas_80:numerico'], AGORA).estado).toBe('nas_cheio')
  })
  it('nas_ok falso: nas_fora', () => {
    expect(casaDe([bat('copiador', { last_poll_at: h(1), updated_at: h(1), nas_ok: false })] as never, [], AGORA).estado).toBe('nas_fora')
  })
})

describe('Phil I1: os vermelhos do pulso chegam à página', () => {
  const PREFIXOS = ['atraso de cópia: 3 unidades', 'mês sem selo: 2026-10', 'NAS: a cópia sumiu', 'B2: arquivo ausente', 'conteúdo divergente em 2026-10', 'mês descartado sem releitura: 2026-10',
    'b2_atrasado', 'B2 recusou o fileId', 'canário do filho falhou', 'canario_regravado:2026-10', 'nas_ilegivel:2026-10', 'b2_ilegivel:2026-10', 'nas_80:numerico',
    'tabela_ausente:competitor_video_early', 'b2_piso_acima_do_teto', 'b2_completo_atrasado', 'b2_teto_2_dias', 'vigia da remoção: consulta 3 com 1']
  it.each(PREFIXOS)('%s tem frase e forma próprias, não a genérica', v => {
    const p = montarPagina(paginaVazia({ vermelhos: [v] }), { arquivoLigado: true })
    expect(p.problemas).toHaveLength(1)
    expect(p.problemas[0]!.frase).not.toMatch(/ainda não descreve/)
    expect(['octogono', 'triangulo']).toContain(p.problemas[0]!.forma)
  })
  it('prefixo desconhecido: linha genérica em octógono, nunca engolido', () => {
    const p = montarPagina(paginaVazia({ vermelhos: ['xyz:1'] }), { arquivoLigado: true })
    expect(p.problemas[0]).toMatchObject({ frase: 'O arquivo tem um problema que esta página ainda não descreve.', forma: 'octogono' })
  })
})

describe('Phil M3: os meses à frente', () => {
  it('-1 e nulo têm frase própria; nunca "-1 meses"', () => {
    const p = montarPagina(paginaVazia({ meses_a_frente: [
      { table_name: 'competitor_video_daily', months_ahead: -1, last_month: null, converted_at: null },
      { table_name: 'competitor_video_early', months_ahead: null, last_month: null, converted_at: null },
      { table_name: 'competitor_video_hourly', months_ahead: 2, last_month: '2028-07-01', converted_at: '2028-01-01T00:00:00Z' }] }), { arquivoLigado: true })
    const f = p.mesesAFrente
    expect(f[0]!.frase).toBe('O mês corrente não existe nesta tabela. Rode a criação de partições.'); expect(f[0]!.forma).toBe('octogono')
    expect(f[1]!.frase).toMatch(/não particionada: não medido/); expect(f[1]!.forma).toBe('hachura')
    expect(f[2]!.forma).toBe('octogono')                                      // menos de 3
    expect(f.some(x => /-1|−1/.test(x.frase))).toBe(false)
  })
})
```

```ts
// apps/web/test/youtube/observatorio/arquivo-pagina-leitor.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { lerPagina, lerPaginaBruta } from '@/lib/youtube/observatorio/arquivo-mensal/pagina'
import { paginaVazia } from './fixtures/arquivo-pagina'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))
const sbCom = (error: { code: string } | null, data: unknown = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error }) }) as never
beforeEach(() => vi.mocked(Sentry.captureMessage).mockClear())

describe('leitor da página', () => {
  it('a fixture de página vazia passa no esquema', () => { expect(lerPaginaBruta(paginaVazia({}))).toMatchObject({ ok: true }) })
  it('chave a mais na raiz: fora do esquema', () => { expect(lerPaginaBruta({ ...paginaVazia({}), nova: 1 })).toEqual({ ok: false, porque: 'fora_do_esquema' }) })
  it('classe fora das três (video_antigo): fora do esquema', () => {
    const p = paginaVazia({}) as { classes: unknown[] }
    expect(lerPaginaBruta({ ...p, classes: [...p.classes, { class: 'video_antigo', first_month: null, released: false, window_months: 1, seal_margin_days: 1, wait_days: 1 }] })).toEqual({ ok: false, porque: 'fora_do_esquema' })
  })
  it('fora do esquema vai ao Sentry como erro', async () => {
    await lerPagina(sbCom(null, { nada: true }), 's')
    expect(Sentry.captureMessage).toHaveBeenCalledWith('obs_archive_pagina fora do esquema', 'error')
  })
  it('42883 e PGRST202: funcao_ausente, sem Sentry', async () => {
    for (const code of ['42883', 'PGRST202']) expect(await lerPagina(sbCom({ code }), 's')).toEqual({ ok: false, porque: 'funcao_ausente' })
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })
  it('outro erro: erro_do_banco, com Sentry', async () => {
    expect(await lerPagina(sbCom({ code: '57014' }), 's')).toEqual({ ok: false, porque: 'erro_do_banco' })
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })
})
```

```ts
// apps/web/test/integration/manutencao-m5-pagina-chaves.test.ts  (integração, banco 54422)
// Yannis I-7: o SQL e a lista fechada do Zod andam juntos.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearCanal, q1, SITE_TESTE } from '../helpers/m3b'
import { prepararM5 } from '../helpers/m5'

const URL_INT = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54422/postgres'
import { CHAVES_LINHA_MES, CHAVES_CASA } from '@/lib/youtube/observatorio/arquivo-mensal/pagina'

describe.skipIf(skipIfNoLocalDb())('as chaves do SQL são as da lista fechada do Zod', () => {
  let c: Client
  beforeEach(async () => { c = new Client({ connectionString: URL_INT }); await c.connect(); await c.query('begin'); await prepararM5(c) })
  afterEach(async () => { await c.query('rollback'); await c.end() })
  it('linha de mês, com e sem registro, e a casa', async () => {
    await semearCanal(c, { site: SITE_TESTE, videos: 0 })
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month) values ($1, 'serie', 'competitor_video_daily', '2026-10-01')`, [SITE_TESTE])
    await c.query(`insert into public.obs_archive_heartbeat (site_id, worker, last_poll_at, updated_at, nas_ok) values ($1, 'copiador', now(), now(), true)`, [SITE_TESTE])
    const p = (await q1(c, `select public.obs_archive_pagina($1) as p`, [SITE_TESTE])).p as { meses: Record<string, unknown>[]; casa: Record<string, unknown>[] }
    const com = p.meses.find(m => m.tem_linha === true)!, sem = p.meses.find(m => m.tem_linha === false)!
    expect(Object.keys(com).sort()).toEqual([...CHAVES_LINHA_MES].sort())
    expect(Object.keys(sem).sort()).toEqual([...CHAVES_LINHA_MES].sort())
    expect(Object.keys(p.casa[0]!).sort()).toEqual([...CHAVES_CASA].sort())
  })
})
```

**Contrato SQL → Zod com a saída REAL (Yannis r2 N-5).** Comparar só chaves de topo não prova o `b2` aninhado (2 chaves sem registro: `atestada_em`, `retirada`; ~8 com registro (a página recebe `via`, `forja_ok_at`, `dono_ok_at`, `forja_divergiu_em`, `ultima_tentativa`, `idade_dias`; **`por` não está na lista**, Phil r3 N5). Um `.strict()` derivado da fixture à mão recusaria a página inteira ("Não foi possível ler o estado do arquivo") no 1º uso em produção. Acrescentar ao mesmo arquivo de integração (banco 54422) estes casos, que passam a saída crua do `pg` pelos leitores reais e exigem `ok: true`:

```ts
import { lerPaginaBruta } from '@/lib/youtube/observatorio/arquivo-mensal/pagina'
import { lerAvisoLeveBruto } from '@/lib/youtube/observatorio/arquivo-mensal/aviso-leve'
import { lerCanaisRemovidosBruto } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { lerOnlineDesdeBruto } from '@/lib/youtube/observatorio/arquivo-mensal/online-desde'

const bruto = async (c: Client, sql: string, p: unknown[]) => (await q1(c, sql, p)).x   // jsonb vem como objeto do `pg`, igual ao PostgREST
it('obs_archive_pagina REAL passa em lerPaginaBruta: sem linha, com linha, com b2 atestado, com batimento e com unidade', async () => {
  await semearCanal(c, { site: SITE_TESTE, videos: 0 })
  // (1) só canais: toda a grade é "sem linha"
  expect(lerPaginaBruta(await bruto(c, `select public.obs_archive_pagina($1) as x`, [SITE_TESTE]))).toMatchObject({ ok: true })
  // (2) linha de registro + atestação B2 com os dois lados (preencher as colunas que o seed da M3b usa: `grep -n "b2_attested" apps/web/test/helpers/m3b.ts`)
  await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, b2_attested_at, b2_attested_via) values ($1, 'serie', 'competitor_video_daily', '2026-10-01', now(), 'forja')`, [SITE_TESTE])
  await c.query(`insert into public.obs_archive_heartbeat (site_id, worker, last_poll_at, updated_at, nas_ok, nas_checked_at) values ($1, 'copiador', now(), now(), true, now())`, [SITE_TESTE])
  // (3) uma unidade recebida (colunas de obs_archive_units: m3b.sql:59-98; `channel_ref` é o uuid do canal semeado)
  const { canal } = await semearCanal(c, { site: SITE_TESTE, videos: 0 })
  await c.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp) values ($1, 'serie', 'competitor_video_daily', $2, '2026-10-01', 1, 0, repeat('a', 64), repeat('b', 64))`, [SITE_TESTE, canal])
  const r = lerPaginaBruta(await bruto(c, `select public.obs_archive_pagina($1) as x`, [SITE_TESTE]))
  expect(r).toMatchObject({ ok: true })
  expect(r.ok && r.valor.meses.length).toBeGreaterThan(0)   // a unidade e a linha do passo (2) aparecem de fato (ajustar o caminho à forma real de `lerPaginaBruta`)
})
it('b2 de meses[] NÃO traz `por` (Phil r3 N5: o identificador de pessoa não chega ao navegador de quem só edita)', async () => {
  await semearCanal(c, { site: SITE_TESTE, videos: 0 })
  await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, b2_attested_at, b2_attested_via, b2_attested_by) values ($1, 'serie', 'competitor_video_daily', '2026-10-01', now(), 'dono', gen_random_uuid())`, [SITE_TESTE])
  const pg = await bruto(c, `select public.obs_archive_pagina($1) as x`, [SITE_TESTE]) as { meses: { b2: Record<string, unknown> }[] }
  const comRegistro = pg.meses.filter((m) => m.b2 && m.b2.via != null)
  expect(comRegistro.length).toBeGreaterThan(0)
  for (const m of pg.meses) expect(Object.keys(m.b2)).not.toContain('por')
})
it('obs_archive_aviso, obs_archive_removed_channel_list e obs_archive_online_since REAIS passam nos leitores', async () => {
  await semearCanal(c, { site: SITE_TESTE, videos: 0 })
  expect(lerAvisoLeveBruto(await bruto(c, `select public.obs_archive_aviso($1) as x`, [SITE_TESTE]))).toMatchObject({ ok: true })
  expect(lerCanaisRemovidosBruto(await bruto(c, `select public.obs_archive_removed_channel_list($1) as x`, [SITE_TESTE]))).toMatchObject({ ok: true })
  expect(lerOnlineDesdeBruto(await bruto(c, `select jsonb_agg(t) as x from public.obs_archive_online_since($1) t`, [SITE_TESTE]))).toMatchObject({ lido: true })
})
```

Cada leitor `...Bruto` (síncrono, sem rede) é exportado só para este teste e para os testes unitários. Se um leitor recusar a saída real, o erro é do Zod do plano, não do SQL: ajustar o schema. **Decisão (Phil r2 N5):** `b2.por` (uuid de pessoa) NÃO vai à página: o `b2` de `meses[]` é montado na Tarefa 2 por lista fechada de chaves, sem `por` (a página não usa o campo e o navegador de quem só edita não deve receber o identificador de outra pessoa); conferir em `m3b.sql:1896` o que `p_by` guarda e registrar no ledger.

Antes de gravar o teste de integração, conferir as colunas obrigatórias de `obs_archive_heartbeat` (`sed -n 157,170p supabase/rascunhos/m3b.sql`) e ajustar o `insert`. **Por que `.strict()` com lista fechada e não `to_jsonb(m)`:** `to_jsonb(m)` com Zod estrito quebrava no deploy da M6, que acrescenta colunas a `obs_archive_months` (`reattach_out_of_order` e outras); a Tarefa 2 lista as colunas à mão e a coluna da M6 entra por `coalesce(... ->> 'reattach_out_of_order', false)`, então a página funciona antes e depois da M6.

- [ ] **Passo 3. Rodar e ver falhar.**
- [ ] **Passo 4. Implementar `pagina.ts`** (Zod `.strict()` sobre a forma da Tarefa 2, com `CHAVES_LINHA_MES` derivada do próprio schema: `Object.keys(LinhaMes.shape)`; `{ ok: false, porque }` fora do esquema, com `Sentry.captureMessage('obs_archive_pagina fora do esquema', 'error')`; `funcao_ausente` sem Sentry), **`vermelhos.ts`** e **`estado-do-mes.ts`** com as regras acima. As frases são copiadas de `arq-dados.js` (MES, PROB e PAG) trocando os números de exemplo por parâmetros; um comentário por frase com a linha de origem (`arq-dados.js:NN`). Frase sem equivalente no mockup (os prefixos do pulso que o mockup não desenhou): escrever a frase em linguagem do dono, curta, e anotar no ledger para a revisão de Logan (Tarefa 15).
- [ ] **Passo 5. Rodar e ver passar; typecheck; commit** `feat: estado de cada mês e de cada problema da página do Arquivo, puro, e o leitor da página (manutenção M5, 04 §14.2, item 39)`.

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

Tempo em ms (`number`); `corDaRemocao` e `pendenciasParaTela` recebem `new Date(agora)`, convertido uma vez na borda. `ListaRemovidosV2` tem `meses: number | null` e `registros: number | null` (nulos, não zero, quando o canal não tem unidade: Phil I5); `Casa` é a da Tarefa 7 (com `frase`).

**Regras (`04` §14.2 L202-245, item 163 parte M5; frases de `arq-dados.js:75-95`):** sem o comando de limpeza (`cap.comandoDeLimpeza` falso, o caso da M5 até a M9), toda remoção `pedido` diz "Limpeza pedida. Espera o comando, que <chega em dd/mm | ainda não tem data para chegar>." sem cor de atraso em idade nenhuma, o resumo é "Canais removidos: N esperam o comando de limpeza, que <…>.", **a marca ao lado da pastilha não existe** (`null`) e "ver os comandos" e "Apagar do arquivo" não são desenhados (M9). `sem_destino` vermelho com o octógono, no topo, frase com o código e a faixa de meses, nunca nome nem "removido em". `guardado` cinza com a caixa de arquivo. `sem_arquivo` com `blobs_pendentes > 0` fica à vista só com a linha das imagens (cinza, pontilhado, em qualquer idade sem o comando); com 0, entra em "Já limpos (N)". Casa sem responder → triângulo "Espera a casa, que não responde desde dd/mm. Nada a fazer agora." sem vermelho por idade. Nunca "apagado" antes de `nas_absent_at`/`b2_absent_at`.

**O que acontece quando o dado não existe:** lista vazia lida → "Nenhum canal removido pede limpeza." na caixa de zero medido, e "Já limpos (0)"; leitura falhou → `{ ok: false }` e a tela diz "Não foi possível ler os canais removidos." em hachura, nunca lista vazia; nome nulo → código interno; `removido_em` nulo com `decided_at` → "removido sem aviso, limpeza pedida em dd/mm".

- [ ] **Passo 1. Testes, falhando** (um por linha da tabela `04` L206-237 que a M5 desenha, e os casos do item 163 que são da M5):

```ts
// apps/web/test/youtube/observatorio/arquivo-canais-removidos.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { montarBloco, marcaAoLadoDaPastilha } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'

const AGORA = Date.parse('2028-05-03T15:00:00Z'), D = 86_400_000
const casa = { estado: 'responde', desde: null, forma: 'visto', frase: '' } as const
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
  it('Phil I5: canal sem nenhuma unidade tem meses e registros nulos e a frase não fala em "0 meses"', () => {
    const b = montarBloco([linha({ estado: 'sem_arquivo', meses: null, registros: null, primeiro_mes: null, ultimo_mes: null, blobs_pendentes: 2 })], { agora: AGORA, casa, cap: semCmd })
    expect(b.linhas[0]!.frase).not.toMatch(/\b0 meses\b|Há null/)
  })
  it('sem_destino com meses nulos: a frase omite a faixa em vez de inventá-la', () => {
    const b = montarBloco([linha({ estado: 'sem_destino', nome: null, removido_em: null, meses: null, registros: null, primeiro_mes: null, ultimo_mes: null })], { agora: AGORA, casa, cap: semCmd })
    expect(b.linhas[0]!.frase).toContain('código interno: AAAAAAAA'); expect(b.linhas[0]!.frase).not.toMatch(/Há .* meses no arquivo/)
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
    const fora = { estado: 'nao_respondeu', desde: AGORA - 3 * D, forma: 'octogono', frase: '' } as const
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
- [ ] **Passo 3. Implementar** `canais-removidos.ts`: Zod estrito da lista v2 (`versao: z.literal(2)`), `montarBloco` e `marcaAoLadoDaPastilha` (a marca só existe com `cap.comandoDeLimpeza`, que a M5 nunca liga: o chrome **não lê a lista de canais removidos** nesta etapa; a M9 planeja a leitura leve da marca) chamando `corDaRemocao` da M3b para a idade (nunca recalcular os limiares: `IDADE` é a fonte); os estados `apagado_nas`, `apagado_b2`, `reapareceu` e `concluido` são desenhados com as frases do mockup para quando a M9 os produzir, mas, sem a M9, a v2 nunca os devolve (a função só emite `sem_destino`, `sem_arquivo`, `guardado`, `pedido`): um teste afirma que um estado desconhecido vem como "não medido" da linha, nunca "ok".
- [ ] **Passo 4. Rodar e ver passar.**
- [ ] **Passo 5. (Movido para a Tarefa 9, Passo 6.)** O teste da variável `OBS_ARQUIVO_LIMPEZA_CANAL` ia aqui, mas `lerCapacidades().comandoDeLimpeza` só é `true` com `BLOCO_CANAIS_REMOVIDOS = true`, e essa constante só muda na Tarefa 9: o teste do plano antigo se contradizia (Yannis I-15). Aqui, `cap` é sempre passado por parâmetro.
- [ ] **Passo 6. Commit** `feat: bloco Canais removidos só de leitura e a marca ao lado da pastilha, puros (manutenção M5, 04 §14.2, item 163 parte M5)`. **`BLOCO_CANAIS_REMOVIDOS` só vira `true` no commit da Task 9**, junto do componente (comentário de `capacidades.ts:9`).

---

### Task 9: a página Arquivo (rota, aba, componentes)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/permissoes.ts` (extraído de `page.tsx:27-31`, com `cache()` do React; Yannis I-1; exporta também `podeEditarSite` e `podeAdministrarSite`, r2 N-6)
- Create: `apps/web/test/youtube/observatorio/permissoes.test.ts` (o módulo real, r2 N-1)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx:26-31` (importa `permissoesDoSite` em vez de definir; nada mais muda)
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/arquivo/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo/montar.ts` (servidor: permissões e leituras), `so-le.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo/arquivo-screen.tsx`, `regua.tsx`, `cartao-do-tipo.tsx`, `bloco-canais-removidos.tsx`, `legenda.tsx`, `grupo-teste.tsx`, `arquivo.css`
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/info.ts` (a função `INFO()`; Yannis m-5: fora de `app`, importável pelos módulos puros)
- Modify: `apps/web/src/lib/youtube/observatorio/links.ts` (`arquivo()` ao lado de `mudancas()`, `links.ts:106-125`)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/view-model.ts:11-13, 46-56` (aba `arquivo`, só com `arquivoVisivel`) e `_chrome/chrome-server.tsx` (decide a aba; ver Passo 5)
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts:9` (`BLOCO_CANAIS_REMOVIDOS = true`)
- Test: `apps/web/test/youtube/observatorio/arquivo-pagina.test.tsx` (jsdom), `apps/web/test/youtube/observatorio/arquivo-montar.test.ts` (node), `apps/web/test/youtube/observatorio/arquivo-chrome-aba.test.ts` (node), `apps/web/test/youtube/observatorio/arquivo-bloco-flag.test.ts` (node)

**Interfaces:**
- Consumes: `montarPagina`, `modeloDesligado`, `modeloNaoLido`, `lerPagina` (Tarefa 7); `montarBloco`, `lerCanaisRemovidos` (Tarefa 8); `lerCapacidades`; **`requireSiteScope({ area: 'cms', siteId, mode: 'edit' })` do `@tn-figueiredo/auth-nextjs/server`** e **`canAdminSiteUsers`** de `lib/youtube/competitor-admin.ts:7` (Yannis I-1: `canEditSite` e `canAdminSite` **não existem** no repositório; o plano antigo os citava em três tarefas; o nome real da pergunta "pode editar?" é o `requireSiteScope` com `mode: 'edit'`, e o de "administra?" é `canAdminSiteUsers`, exatamente como `competitors/page.tsx:27-31` os usa hoje); `getSiteContext()`; `openObservatoryPage` (`_chrome/page-data.ts`); `ObservatoryChromeServer` (`_chrome/chrome-server.tsx:17`).
- Produces:

```ts
// _chrome/permissoes.ts
import 'server-only'
import { cache } from 'react'
export interface PermissoesDoSite { canUnlock: boolean; podeEditar: boolean }
/** Uma pergunta por requisição (React cache): a página, o chrome e a peça 7 dividem a resposta. "+25" é de quem administra (can_admin_site_users); `podeEditar`: quem só lê vê a lista com as ações desligadas. */
export const permissoesDoSite: (siteId: string) => Promise<PermissoesDoSite>

// _arquivo/montar.ts
export type ArquivoMontado =
  | { acesso: 'so_le' }
  | { acesso: 'edita' | 'administra'; obs: Observatory; forja: ForjaView | null; meuCanalLembrado: string | null; modelo: ModeloPagina; bloco: LeituraBloco }
export async function montarArquivo(): Promise<ArquivoMontado>
```

`ChromeTab` ganha `'arquivo'`.

**Regras:** (a) **Só lê** (`!podeEditar`) → `montarArquivo` devolve `{ acesso: 'so_le' }` **antes de qualquer leitura do arquivo com o cliente de serviço** (a leitura do conjunto do Observatório por `openObservatoryPage` é a de sempre e já exige `mode: 'view'`; a do arquivo não acontece); a tela diz "Esta página é de quem edita o site." com o link "Voltar para Canais" (mockup A5 da revisão 19-1) e a aba não aparece. (b) Ordem da tela (mockup `arquivo.js` e `NOTAS.md` "Peça 2"): frase-resumo (cinco variantes do Logan 11.8: casa fora vence tudo; meses que precisam do dono; mais o canal removido; nada precisa de você em `--muted` sem caixa e sem verde; não medido em hachura), legenda recolhida "Como ler as formas", bloco "Canais removidos" acima dos tipos quando alguma linha pede algo do dono (sem a M9, nenhuma pede comando: o bloco vai abaixo, salvo `sem_destino`, que é vermelho e sobe), seção "Problemas" (os vermelhos do pulso, Tarefa 7), um cartão por tipo na ordem Leitura de hora em hora, Views por dia, Comentários e dados antigos do YouTube, os meses à frente das partições, e o grupo "Dado de teste" só para quem administra (D-M5-6: sem botão). (c) Perfil "edita": "esperam quem administra o site" numa frase única abaixo do resumo (revisão 19-1, A4). (d) Leitura do servidor numa rodada só, sem esqueleto (anotar no índice de estados). (e) Cores e formas: copiar as classes de `m19.css` para `arquivo.css` com prefixo `arq-`, só hex/`rgba()` literais; `grep -n "color-mix" arquivo.css` só pode achar comentário. (f) `next/link`: "Voltar para Canais" e os links da frase-resumo saem de componente `'use client'` que importa `Link` (ou de `cms-link.tsx`), nunca como prop de Server Component. (g) `export const maxDuration = 60` na rota, como as outras páginas do Observatório (`page.tsx:23`, `mudancas/page.tsx:10`); a leitura da página mais o conjunto do Observatório não pode cair no teto padrão (Yannis m-4). (h) **Slots da M6 (Yannis I-12):** `LinhaDoMes.acoes?: ReactNode` e `CartaoDoTipo.acoes?: ReactNode` (Tarefa 7) são renderizados por `arquivo-screen.tsx` ao lado direito da linha e do cabeçalho do cartão; a M5 nunca os preenche, e a M6 os preenche sem tocar na estrutura (a M6 planeja o encaixe em `_arquivo-saida/` que importa `arquivo-screen`). A coluna `reattach_out_of_order`/`volta_fora_de_ordem` (M6) já chega à linha como booleano `false` (Tarefa 2) e a linha mostra, quando verdadeiro, "Voltou fora de ordem" em triângulo âmbar com o mês: **a leitura é desta tarefa**; o botão que trata é da M6.

**O que acontece quando o dado não existe:** leitura da página falhou → só a frase "Não foi possível ler o estado do arquivo" em hachura (`modeloNaoLido()`), e o bloco lido à parte (se ele leu, aparece); leitura do bloco falhou → o bloco mostra "Não foi possível ler os canais removidos." e o resto da página segue; `OBS_ARQUIVO` apagada → frase do arquivo desligado e **nenhuma** leitura do arquivo, nem a do bloco (com o arquivo desligado não há registro novo para mostrar; as remoções continuam acontecendo, o bloco volta a aparecer quando o arquivo liga: Yannis, bloco com o arquivo desligado); `funcao_ausente` → a aba nem aparece (Tarefa 11) e, pela URL direta, a página diz "O arquivo ainda não foi instalado neste banco." sem Sentry.

- [ ] **Passo 1. Testes, falhando:**

```ts
// apps/web/test/youtube/observatorio/arquivo-montar.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { paginaVazia } from './fixtures/arquivo-pagina'

const servico = { rpc: vi.fn() }
const getSupabaseServiceClient = vi.fn(() => servico)
const permissoes = vi.fn()
const abrir = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => getSupabaseServiceClient() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/permissoes', () => ({ permissoesDoSite: (s: string) => permissoes(s) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({ openObservatoryPage: (f: (s: string) => unknown) => abrir(f) }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

const pagina = (perm: { canUnlock: boolean; podeEditar: boolean }) => ({ siteId: 's', now: Date.parse('2028-05-03T15:00:00Z'), obs: {}, meuCanalLembrado: null, savedNiche: 'todos', rows: {}, extra: perm })
const importar = async () => (await import('@/app/cms/(authed)/youtube/competitors/_arquivo/montar')).montarArquivo

describe('montarArquivo', () => {
  beforeEach(() => { vi.resetModules(); servico.rpc.mockReset(); getSupabaseServiceClient.mockClear(); delete process.env.OBS_ARQUIVO })
  it('Review Focus 5: só lê pela URL não cria o cliente de serviço nem chama rpc', async () => {
    abrir.mockResolvedValue(pagina({ canUnlock: false, podeEditar: false }))
    process.env.OBS_ARQUIVO = 'on'
    expect(await (await importar())()).toEqual({ acesso: 'so_le' })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled(); expect(servico.rpc).not.toHaveBeenCalled()
  })
  it('OBS_ARQUIVO apagada: frase do arquivo desligado e nenhuma leitura do arquivo', async () => {
    abrir.mockResolvedValue(pagina({ canUnlock: false, podeEditar: true }))
    const r = await (await importar())()
    if (r.acesso === 'so_le') throw new Error('não devia ser só lê')
    expect(r.modelo.resumo.texto).toBe('O arquivo está desligado neste site: nada está sendo copiado nem tirado')
    expect(servico.rpc).not.toHaveBeenCalled()
  })
  it.each([[false, 'edita', null], [true, 'administra', 'objeto']] as const)('canUnlock=%s: acesso %s, grupo de teste %s', async (admin, acesso, esperado) => {
    abrir.mockResolvedValue(pagina({ canUnlock: admin, podeEditar: true }))
    servico.rpc.mockImplementation(async (nome: string) => nome === 'obs_archive_pagina'
      ? { data: paginaVazia({ teste: { aberto: true, meses: [], encerrado_em: null } }), error: null } : { data: [], error: null })
    process.env.OBS_ARQUIVO = 'on'
    const r = await (await importar())()
    if (r.acesso === 'so_le') throw new Error('não devia ser só lê')
    expect(r.acesso).toBe(acesso)
    expect(r.modelo.teste === null ? null : 'objeto').toBe(esperado)
  })
  it('leitura da página falhou: modelo "não foi possível ler", bloco lido à parte', async () => {
    abrir.mockResolvedValue(pagina({ canUnlock: false, podeEditar: true }))
    servico.rpc.mockImplementation(async (nome: string) => nome === 'obs_archive_pagina' ? { data: null, error: { code: '57014' } } : { data: [], error: null })
    process.env.OBS_ARQUIVO = 'on'
    const r = await (await importar())()
    if (r.acesso === 'so_le') throw new Error('não devia ser só lê')
    expect(r.modelo.resumo.texto).toBe('Não foi possível ler o estado do arquivo')
    expect(r.bloco).toMatchObject({ ok: true })
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
  it('quem edita não vê "Ver os comandos" nem "Apagar do arquivo" (M9) nem o grupo de teste, e lê a frase do perfil', () => {
    render(<ArquivoScreen modelo={modeloCheio()} bloco={{ ok: true, bloco: blocoComSemDestino() }} acesso="edita" />)
    expect(screen.queryByText(/Ver os comandos|Apagar do arquivo|Dado de teste/)).toBeNull()
    expect(screen.getByText(/esperam quem administra o site/)).toBeTruthy()
  })
  it('arquivo desligado: uma frase, sem cartões e sem o bloco', () => {
    render(<ArquivoScreen modelo={{ ...modeloVazio(), ligado: false }} bloco={{ ok: false }} acesso="edita" />)
    expect(document.querySelectorAll('[data-secao]')).toHaveLength(0)
    expect(screen.queryByText('Não foi possível ler os canais removidos.')).toBeNull()
  })
  it('M6 encaixa: o slot acoes da linha e do cartão aparece quando preenchido', () => {
    const m = modeloCheio(); m.tipos[0]!.linhas[0]!.acoes = <button type="button">Sair do banco</button>
    render(<ArquivoScreen modelo={m} bloco={{ ok: false }} acesso="administra" />)
    expect(screen.getByText('Sair do banco')).toBeTruthy()
  })
  it('mês que voltou fora de ordem: triângulo com a frase, sem botão', () => {
    const m = modeloCheio(); m.tipos[0]!.linhas[0]!.secundaria = 'Voltou fora de ordem'
    render(<ArquivoScreen modelo={m} bloco={{ ok: false }} acesso="administra" />)
    expect(screen.getByText('Voltou fora de ordem')).toBeTruthy()
  })
})
```

```ts
// apps/web/test/youtube/observatorio/arquivo-bloco-flag.test.ts  (a variável com padrão, Passo 6)
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { lerCapacidades } from '@/lib/youtube/observatorio/arquivo-mensal/capacidades'
import { montarBloco, marcaAoLadoDaPastilha } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
vi.mock('server-only', () => ({}))
const AGORA = Date.parse('2028-05-03T15:00:00Z')
const casa = { estado: 'responde', desde: null, forma: 'visto', frase: '' } as const
const um = [{ versao: 2, channel_ref: 'aaaaaaaa-1111-2222-3333-444444444444', estado: 'pedido', decided_at: new Date(AGORA - 5 * 86_400_000).toISOString(), nas_absent_at: null, b2_absent_at: null, snapshots_clear_on: null, reappeared_at: null, reappeared_count: 0, online_thumbs_known: true, thumbs_unknown_ack_at: null, blobs_pendentes: 0, youtube_channel_id: 'UCx', nome: 'N', removido_em: null, removido_via: 'botao', primeiro_mes: null, ultimo_mes: null, meses: null, registros: null, classes: [] }]
describe('OBS_ARQUIVO_LIMPEZA_CANAL: só "on" liga o comando de limpeza (com o bloco já entregue)', () => {
  beforeEach(() => { delete process.env.OBS_ARQUIVO_LIMPEZA_CANAL })
  it('variável apagada: bloco na forma "espera o comando", marca nula', () => {
    const cap = lerCapacidades()
    expect(cap).toMatchObject({ comandoDeLimpeza: false, blocoCanaisRemovidos: true })
    expect(montarBloco(um as never, { agora: AGORA, casa, cap }).linhas[0]!.frase).toMatch(/Espera o comando/)
    expect(marcaAoLadoDaPastilha(um as never, { agora: AGORA, casa, cap })).toBeNull()
  })
  it.each(['ON', '1', 'true', ''])('valor %j: o mesmo que apagada', v => {
    process.env.OBS_ARQUIVO_LIMPEZA_CANAL = v
    expect(lerCapacidades().comandoDeLimpeza).toBe(false)
  })
  it("'on': a marca é desenhada", () => {
    process.env.OBS_ARQUIVO_LIMPEZA_CANAL = 'on'
    const cap = lerCapacidades()
    expect(cap.comandoDeLimpeza).toBe(true)
    expect(marcaAoLadoDaPastilha(um as never, { agora: AGORA, casa, cap })).not.toBeNull()
  })
})
```

`fixtures/arquivo-modelos.ts` (`modeloCheio`, `modeloVazio`, `blocoComSemDestino`) monta `ModeloPagina` e `BlocoCanaisRemovidos` **chamando `montarPagina` e `montarBloco` sobre `paginaVazia`/`mesCom`** (Tarefa 7), nunca a mão: o modelo da fixture e o da produção são o mesmo código.

- [ ] **Passo 2. Rodar e ver falhar.**
- [ ] **Passo 3. Permissões e `montar.ts`:**

```ts
// apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/permissoes.ts
import 'server-only'
import { cache } from 'react'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { canAdminSiteUsers } from '@/lib/youtube/competitor-admin'

export interface PermissoesDoSite { canUnlock: boolean; podeEditar: boolean }
/** Só o direito de editar (2 idas: getUser + rpc). É o que o chrome usa em toda navegação (Yannis r2 N-6). */
export const podeEditarSite = cache(async (siteId: string): Promise<boolean> => {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  return res.ok
})
/** Quem administra: só chamada onde a tela precisa (página Arquivo, peça 7), depois de `podeEditarSite`. */
export const podeAdministrarSite = cache(async (siteId: string): Promise<boolean> => canAdminSiteUsers(siteId))
export const permissoesDoSite = cache(async (siteId: string): Promise<PermissoesDoSite> => {
  if (!(await podeEditarSite(siteId))) return { canUnlock: false, podeEditar: false }
  return { canUnlock: await podeAdministrarSite(siteId), podeEditar: true }
})
```

`page.tsx` apaga a função local e faz `import { permissoesDoSite } from './_chrome/permissoes'` (o resto idêntico: `openObservatoryPage(permissoesDoSite)`). Teste existente da página, se houver, continua verde (`grep -rln "permissoesDoSite" apps/web/test`).

**Teste do módulo real (Yannis r2 N-1; sem ele um `mode: 'view'` exporia o estado do arquivo a leitores e todos os outros testes, que mockam este módulo, passariam):**

```ts
// apps/web/test/youtube/observatorio/permissoes.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireSiteScope = vi.fn(); const canAdminSiteUsers = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T,>(f: T) => f }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (a: unknown) => requireSiteScope(a) }))
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: (s: string) => canAdminSiteUsers(s) }))
const SITE = '00000000-0000-0000-0000-00000000a3b0'

describe('permissoesDoSite (módulo real)', () => {
  beforeEach(() => { vi.resetModules(); requireSiteScope.mockReset(); canAdminSiteUsers.mockReset() })
  it('pede o direito de EDITAR no cms do site, nunca view', async () => {
    requireSiteScope.mockResolvedValue({ ok: true }); canAdminSiteUsers.mockResolvedValue(false)
    await (await import('@/app/cms/(authed)/youtube/competitors/_chrome/permissoes')).permissoesDoSite(SITE)
    expect(requireSiteScope).toHaveBeenCalledWith({ area: 'cms', siteId: SITE, mode: 'edit' })
  })
  it('recusado: nada de edição e canAdminSiteUsers nem é chamado', async () => {
    requireSiteScope.mockResolvedValue({ ok: false })
    expect(await (await import('@/app/cms/(authed)/youtube/competitors/_chrome/permissoes')).permissoesDoSite(SITE)).toEqual({ canUnlock: false, podeEditar: false })
    expect(canAdminSiteUsers).not.toHaveBeenCalled()
  })
  it('edita e administra: os dois verdadeiros; edita sem administrar: canUnlock falso', async () => {
    requireSiteScope.mockResolvedValue({ ok: true })
    const { permissoesDoSite } = await import('@/app/cms/(authed)/youtube/competitors/_chrome/permissoes')
    canAdminSiteUsers.mockResolvedValueOnce(true)
    expect(await permissoesDoSite(SITE)).toEqual({ canUnlock: true, podeEditar: true })
    vi.resetModules(); canAdminSiteUsers.mockResolvedValueOnce(false)
    expect(await (await import('@/app/cms/(authed)/youtube/competitors/_chrome/permissoes')).permissoesDoSite(SITE)).toEqual({ canUnlock: false, podeEditar: true })
  })
  it('podeEditarSite sozinho não toca canAdminSiteUsers (o chrome não paga a segunda ida)', async () => {
    requireSiteScope.mockResolvedValue({ ok: true })
    expect(await (await import('@/app/cms/(authed)/youtube/competitors/_chrome/permissoes')).podeEditarSite(SITE)).toBe(true)
    expect(canAdminSiteUsers).not.toHaveBeenCalled()
  })
})
```

Entra no `git add` da Tarefa 9 junto de `_chrome/permissoes.ts`.

```ts
// apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo/montar.ts
import 'server-only'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { Observatory } from '@/lib/youtube/observatorio'
import { lerPagina } from '@/lib/youtube/observatorio/arquivo-mensal/pagina'
import { montarPagina, modeloDesligado, modeloNaoLido, type ModeloPagina } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { montarBloco, lerCanaisRemovidos, type LeituraBloco } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { lerCapacidades } from '@/lib/youtube/observatorio/arquivo-mensal/capacidades'
import { openObservatoryPage } from '../_chrome/page-data'
import { permissoesDoSite } from '../_chrome/permissoes'
import type { ForjaView } from '../_chrome/forja-view-model'

export type ArquivoMontado =
  | { acesso: 'so_le' }
  | { acesso: 'edita' | 'administra'; obs: Observatory; forja: ForjaView | null; meuCanalLembrado: string | null; modelo: ModeloPagina; bloco: LeituraBloco }

/** O servidor da página Arquivo. A guarda de acesso vem primeiro (openObservatoryPage); depois a de edição; só então o cliente de serviço. */
export async function montarArquivo(): Promise<ArquivoMontado> {
  const pagina = await openObservatoryPage(permissoesDoSite)
  const perm = pagina.extra
  if (!perm.podeEditar) return { acesso: 'so_le' }
  const base = { acesso: perm.canUnlock ? 'administra' : 'edita', obs: pagina.obs, forja: null, meuCanalLembrado: pagina.meuCanalLembrado } as const
  if (process.env.OBS_ARQUIVO !== 'on') return { ...base, modelo: modeloDesligado(), bloco: { ok: false } }
  const sb = getSupabaseServiceClient()
  const [lida, removidos] = await Promise.all([lerPagina(sb, pagina.siteId), lerCanaisRemovidos(sb, pagina.siteId)])
  if (!lida.ok) {
    // o bloco lido à parte continua à vista; sem a página não há "casa" nem relógio do banco: o relógio do dataset serve só para a idade
    const cap = lerCapacidades()
    const modelo = modeloNaoLido(lida.porque)
    return { ...base, modelo, bloco: removidos.ok ? { ok: true, bloco: montarBloco(removidos.lista, { agora: pagina.now, casa: modelo.casa, cap }) } : { ok: false } }
  }
  const modelo = montarPagina(lida.pagina, { arquivoLigado: true })
  const cap = lerCapacidades()
  const bloco: LeituraBloco = removidos.ok ? { ok: true, bloco: montarBloco(removidos.lista, { agora: Date.parse(lida.pagina.lido_em), casa: modelo.casa, cap }) } : { ok: false }
  return { ...base, modelo, bloco }
}
```

  `modeloNaoLido('funcao_ausente')` troca o resumo por "O arquivo ainda não foi instalado neste banco." (sem Sentry); os outros motivos dizem "Não foi possível ler o estado do arquivo".
- [ ] **Passo 4. A rota** (padrão de `mudancas/page.tsx`; conferir no guia do Next 16 da Tarefa 0):

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
export const maxDuration = 60

export default async function ArquivoPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  const r = await montarArquivo()
  if (r.acesso === 'so_le') return <SoLe />
  return (
    <ObservatoryChromeServer tab="arquivo" searchParams={sp} obs={r.obs} forja={r.forja} meuCanalLembrado={r.meuCanalLembrado}>
      <ArquivoScreen modelo={r.modelo} bloco={r.bloco} acesso={r.acesso} />
    </ObservatoryChromeServer>
  )
}
```

  `SoLe` é um componente `'use client'` que importa `next/link` no próprio módulo ("Voltar para Canais" aponta para `obs.link.canais()`: como o componente não tem `obs`, usa a constante do `OBS_BASE` exportada de `links.ts`).
- [ ] **Passo 5. Componentes e aba.** `regua.tsx` (cinco ou duas etapas; a 390 px vira coluna de ícones 24 px com rótulo curto embaixo, `Etapa.curto`); `formas-arquivo.tsx` da Tarefa 5 para os símbolos; `cartao-do-tipo.tsx` com `role="region"` e `aria-label` do título, a frase-resumo do tipo, a lista `<ul>` dos meses e a linha por ano (`<details>` com "2027: 12 meses no arquivo, todos conferidos"); `bloco-canais-removidos.tsx` (régua de 4 etapas, rótulo com `text-overflow: ellipsis` e `title`/`aria-label` com o nome inteiro, frase que quebra, "Já limpos (N)" em `<details>`); `legenda.tsx` (as nove formas e as duas origens da conferência do B2 com o mesmo visto); `grupo-teste.tsx` (faixa "Dado de teste. Isto é um mês fictício…" e a marca "teste" em cada linha; sem botão). **A aba:** `ChromeTab` ganha `'arquivo'`; `TAB_NAME.arquivo = 'Arquivo'`; `hrefOf.arquivo = obs.link.arquivo()`; `buildChromeView` ganha `arquivoVisivel?: boolean` (ausente = a aba não entra em `tabs`). **Quem decide** é `chrome-server.tsx` (Yannis I-10), não a página: ele lê `getSiteContext()` e `await permissoesDoSite(siteId)` (a mesma resposta em cache da requisição) e passa `arquivoVisivel: perm.podeEditar`; assim a aba aparece em **toda** aba do Observatório (Canais, Mudanças, Outliers, Insights) para quem edita, e nunca para quem só lê, sem cada página precisar passar um campo. `coworkText` ganha a chave `arquivo` com uma frase curta sem palavra proibida. Teste em `arquivo-chrome-aba.test.ts`: com `permissoesDoSite` mockado, `ObservatoryChromeServer tab="outliers"` renderiza a aba "Arquivo" para `podeEditar: true` e não a renderiza para `false`; conferir os testes de `view-model.ts` que contam abas e atualizá-los no mesmo commit.
- [ ] **Passo 6. `BLOCO_CANAIS_REMOVIDOS = true`** em `capacidades.ts`; rodar o `arquivo-bloco-flag.test.ts` (acima: é o **teste de variável que antes estava na Tarefa 8**, Yannis I-15: na Tarefa 8 a constante ainda vale `false` e `lerCapacidades().comandoDeLimpeza` nunca é `true`, então o teste do plano antigo se contradizia), o teste da M3b de `capacidades` e o do diálogo de remover (`grep -rl "lerCapacidades\|BLOCO_CANAIS_REMOVIDOS" apps/web/test`): as três linhas da tabela "O que o diálogo, o depois do clique e a lista mostram" (`04` §14.3) passam a cair na linha "bloco sim"; corrigir os testes que afirmavam "bloco não" no mesmo commit, anotando no ledger.
- [ ] **Passo 7. Rodar** os testes novos e toda a pasta `apps/web/test/youtube/observatorio` (saída em arquivo); **typecheck**; **`next build` local** (mudança arriscada: rota nova e aba): `npm run build -w apps/web > .superpowers/sdd/manutencao-nas/saidas/m5-build.txt 2>&1; tail -30 .superpowers/sdd/manutencao-nas/saidas/m5-build.txt` (em background se passar de 4 minutos: `run_in_background`, saída em arquivo).
- [ ] **Passo 8. Commit** `feat: página Arquivo do Observatório, só de leitura, com o bloco Canais removidos (manutenção M5, 04 §14.2, itens 39, 85, 121 parte de leitura e 163 parte M5)`, por caminho.

---

### Task 10: peça 7, parte de leitura, na fila "Saíram do YouTube"

**Pré-requisito (Yannis I-11).** Em 14/10 a fila "Esperam a sua resposta" (E9) **não está no `staging`** (`grep -rln "Esperam a sua resposta" apps/web/src` não acha nada; a E9 vive no worktree `wt-e9`, `37617d174`). O filtro "Saíram do YouTube" que existe hoje é `filtroDe('sairam', ...)` em `_canais/view-model.ts:722`, com `estado.pastilha === 'fora_do_ar'` (`_canais/estado-model.ts:163`). A Tarefa 0, Passo 6, confere o estado da E9 no dia: **E9 no staging** → o novo bloco entra depois de "Esperam a sua resposta", como o mockup; **E9 ausente** → o bloco "Esperam você rodar os comandos" nasce como **seção própria** do filtro `sairam` (abaixo da tabela filtrada), sem tocar nada que a E9 vá trazer, e o ledger anota "peça 7 sem a E9: encaixe provisório; a E9 move a seção" e avisa o redator da M9 (que espera a peça 7 em `_saiu/*`).

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/pendencias-da-fila.ts` (servidor: a leitura de `obs_archive_owner_pending` e a proteção do cliente de serviço)
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/esperam-comandos.tsx` (+ classes `p7-` em `_canais/esperam-comandos.css`)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx` (lê `lerPendenciasDaFila` dentro do `extra` de `openObservatoryPage`, **depois** de `permissoesDoSite`) e `_canais/canais-screen.tsx` (prop `pendencias?: PendenciasDaTela | null`, desenhada com o filtro `sairam`)
- Test: `apps/web/test/youtube/observatorio/peca7-servidor.test.ts` (node), `apps/web/test/youtube/observatorio/peca7-leitura.test.tsx` (jsdom)

**Interfaces:**
- Consumes: `lerPendencias`, `pendenciasParaTela`, `PendenciasDaTela`, `LINHA_DO_DONO` (`pendencias.ts:11, 73, 88, 95`; `pendenciasParaTela` recebe `agora: Date`); `permissoesDoSite` (Tarefa 9); `obs_archive_owner_pending(p_site)` (`m3b.sql:2711`, versão 1, tempo `sem_comando` até a M9).
- Produces: `lerPendenciasDaFila(siteId: string, perm: PermissoesDoSite, agora: Date): Promise<PendenciasDaTela | null>`; `<EsperamComandos t={PendenciasDaTela} />`.

**Regras (mockup `peca7.js`, NOTAS "Peça 7", correção da revisão 1):** ordem resumo → "Esperam a sua resposta" (E9, se existir) → "Esperam você rodar os comandos" (novo); frase-resumo "N itens esperam você rodar os comandos; o mais antigo há N dias." com a frase "Esperar não perde nada…" uma vez; barra de idade de 0 a 60 dias com marcas em 30 e 60, a cor só no contorno da linha e no preenchimento, texto em cor normal; para quem administra, "Ver os comandos" abre a linha fixa `LINHA_DO_DONO` com botão Copiar; **sem "Já rodei"** (M9, D-M5-8); quem só edita vê resumo e idade, sem a linha (E-D4). **Permissão:** a leitura passa pelo cliente de serviço só com `perm.podeEditar`; quem só lê não a dispara. `perm.canUnlock` (quem administra) decide `podeVerComandos` (Yannis I-1: não existe `canAdminSite`).

**O que acontece quando o dado não existe:** `itens: []` lido → caixa de zero medido "Nenhum item espera você rodar os comandos." (sem segunda frase); leitura falhou → `{ estado: 'nao_medido' }` (o tipo `PendenciasDaTela.nao_medido` **não traz `lidoEm`**: a frase do plano antigo "com a hora da última leitura" sai; a tela diz "Não foi possível ler se há cópia no arquivo. Isto não quer dizer que não há cópia." em hachura); `OBS_ARQUIVO` desligada → `null` e o bloco não é desenhado (o arquivo desligado já é dito na página Arquivo); função ausente → `nao_medido` com `Sentry.captureMessage` de aviso (ela nasce na M3b, que precede a M5).

- [ ] **Passo 1. Testes do servidor, falhando** (Yannis I-2; sem estes, a regra "não chamar o cliente de serviço para quem só lê" não tinha nada que a prendesse):

```ts
// apps/web/test/youtube/observatorio/peca7-servidor.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LINHA_DO_DONO } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'

const rpc = vi.fn(); const criar = vi.fn(() => ({ rpc })); const captureMessage = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => criar() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a) }))
vi.mock('server-only', () => ({}))

const SITE = '00000000-0000-0000-0000-00000000a3b0', AGORA = new Date('2028-05-03T15:00:00Z')
const ITEM = { item_id: 'canal:aaaaaaaa-1111-2222-3333-444444444444', kind: 'canal', tempo: 'apagar_antigas', desde: '2028-03-01T12:00:00Z', mes: null,
  channel_ref: 'aaaaaaaa-1111-2222-3333-444444444444', youtube_id: null, marcado_rodado_em: null,
  apagar: [{ filho: 'numerico', caminho: 'canal/x.csv', sha256: 'a'.repeat(64), nova: null }], b2_nomes: ['canal/b2-secreto.csv'] }
// Yannis r2 N-2: o Zod é estrito. `total` é obrigatório e igual a itens.length; `apagar`/`b2_nomes` só existem (e não vazios) em 'apagar_antigas'. Com 'sem_comando' o corpo era recusado e o teste ficava vazio.
const CORPO = { versao: 1, lido_em: '2028-05-03T15:00:00Z', total: 1, itens: [ITEM] }
const chamar = async (perm: { podeEditar: boolean; canUnlock: boolean }) => (await import('@/app/cms/(authed)/youtube/competitors/_canais/pendencias-da-fila')).lerPendenciasDaFila(SITE, perm, AGORA)

describe('lerPendenciasDaFila', () => {
  beforeEach(() => { vi.resetModules(); rpc.mockReset(); criar.mockClear(); captureMessage.mockClear(); process.env.OBS_ARQUIVO = 'on' })
  it('sem edição: o cliente de serviço não é criado e a resposta é nula', async () => {
    expect(await chamar({ podeEditar: false, canUnlock: false })).toBeNull()
    expect(criar).not.toHaveBeenCalled()
  })
  it('só edita: serializado sem linha, sem apagar, sem b2_nomes', async () => {
    rpc.mockResolvedValue({ data: CORPO, error: null })
    const r = await chamar({ podeEditar: true, canUnlock: false })
    expect(r).toMatchObject({ estado: 'com_itens', linha: null })   // se for 'nao_medido', a fixture voltou a ser inválida
    expect(JSON.stringify(r)).not.toMatch(/apagar|b2_nomes|b2Nomes|b2-secreto|canal\/x\.csv/)
  })
  it('administra: a linha é exatamente a linha do dono', async () => {
    rpc.mockResolvedValue({ data: CORPO, error: null })
    expect(await chamar({ podeEditar: true, canUnlock: true })).toMatchObject({ linha: LINHA_DO_DONO })
  })
  it('OBS_ARQUIVO apagada: nulo e rpc não chamada', async () => {
    delete process.env.OBS_ARQUIVO
    expect(await chamar({ podeEditar: true, canUnlock: true })).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rpc com erro: não medido e Sentry', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '57014' } })
    expect(await chamar({ podeEditar: true, canUnlock: true })).toEqual({ estado: 'nao_medido' })
    expect(captureMessage).toHaveBeenCalledWith('obs_archive_owner_pending: 57014', 'error')
  })
  it('resposta fora da forma: não medido, nunca lista vazia', async () => {
    rpc.mockResolvedValue({ data: { versao: 2, itens: [] }, error: null })
    expect(await chamar({ podeEditar: true, canUnlock: true })).toEqual({ estado: 'nao_medido' })
  })
})
```

- [ ] **Passo 2. Testes de leitura (jsdom), falhando:** os seis casos do mockup:

```tsx
// apps/web/test/youtube/observatorio/peca7-leitura.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EsperamComandos } from '@/app/cms/(authed)/youtube/competitors/_canais/esperam-comandos'
import { LINHA_DO_DONO, type PendenciasDaTela } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'

const LIDO = new Date('2028-05-03T15:00:00Z')
const item = (idadeDias: number, i: number) => ({ item_id: 'canal:aaaaaaaa-1111-2222-3333-44444444444' + i, kind: 'canal', tempo: 'sem_comando' as const, idadeDias })
const tres = (linha: string | null): PendenciasDaTela => ({ estado: 'com_itens', lidoEm: LIDO, n: 3, maisAntigoDias: 63, itens: [item(63, 1), item(20, 2), item(3, 3)], linha })

describe('peça 7, parte de leitura', () => {
  it('zero medido: frase própria, uma frase só', () => {
    render(<EsperamComandos t={{ estado: 'zero', lidoEm: LIDO, linha: null }} />)
    expect(screen.getByText('Nenhum item espera você rodar os comandos.')).toBeTruthy()
    expect(screen.queryByText(/Esperar não perde nada/)).toBeNull()
  })
  it('não medido: hachura e a ressalva', () => {
    render(<EsperamComandos t={{ estado: 'nao_medido' }} />)
    expect(screen.getByText(/Não foi possível ler se há cópia no arquivo/)).toBeTruthy()
    expect(screen.getByText(/Isto não quer dizer que não há cópia/)).toBeTruthy()
    expect(document.querySelector('[data-forma="hachura"]')).not.toBeNull()
  })
  it('3 itens com o mais antigo de 63 dias: resumo exato e octógono', () => {
    render(<EsperamComandos t={tres(null)} />)
    expect(screen.getByText('3 itens esperam você rodar os comandos; o mais antigo há 63 dias.')).toBeTruthy()
    expect(document.querySelector('[data-forma="octogono"]')).not.toBeNull()
  })
  it('só edita: sem a linha e sem "Ver os comandos"', () => {
    render(<EsperamComandos t={tres(null)} />)
    expect(screen.queryByText('Ver os comandos')).toBeNull()
    expect(document.body.textContent).not.toContain(LINHA_DO_DONO)
  })
  it('administra: a linha é a LINHA_DO_DONO, com o botão Copiar', () => {
    render(<EsperamComandos t={tres(LINHA_DO_DONO)} />)
    expect(screen.getByText('Ver os comandos')).toBeTruthy()
    expect(document.body.textContent).toContain(LINHA_DO_DONO)
    expect(screen.getByRole('button', { name: /Copiar/ })).toBeTruthy()
  })
  it('nunca "Já rodei" (é da M9)', () => {
    render(<EsperamComandos t={tres(LINHA_DO_DONO)} />)
    expect(screen.queryByText(/Já rodei/)).toBeNull()
  })
})
```

- [ ] **Passo 3. Rodar e ver falhar.**
- [ ] **Passo 4. Implementar `pendencias-da-fila.ts`:**

```ts
// apps/web/src/app/cms/(authed)/youtube/competitors/_canais/pendencias-da-fila.ts
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerPendencias, pendenciasParaTela, type PendenciasDaTela } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'
import type { PermissoesDoSite } from '../_chrome/permissoes'

/** Depois da guarda de edição (`permissoesDoSite`), nunca antes: sem edição o cliente de serviço nem é criado. */
export async function lerPendenciasDaFila(siteId: string, perm: PermissoesDoSite, agora: Date): Promise<PendenciasDaTela | null> {
  if (!perm.podeEditar) return null
  if (process.env.OBS_ARQUIVO !== 'on') return null
  const { data, error } = await getSupabaseServiceClient().rpc('obs_archive_owner_pending', { p_site: siteId })
  if (error) {
    Sentry.captureMessage('obs_archive_owner_pending: ' + error.code, 'error')
    return { estado: 'nao_medido' }
  }
  return pendenciasParaTela(lerPendencias(data), { podeVerComandos: perm.canUnlock, agora })
}
```

  `page.tsx` troca `openObservatoryPage(permissoesDoSite)` por `openObservatoryPage(async siteId => { const perm = await permissoesDoSite(siteId); return { ...perm, pendencias: await lerPendenciasDaFila(siteId, perm, new Date(observatoryNow())) } })` (a leitura roda em paralelo com o conjunto, depois da guarda de acesso do `openObservatoryPage`); o resto da página usa `permissoes.canUnlock` e `permissoes.podeEditar` como antes. `esperam-comandos.tsx`: os textos e as classes `p7-` do `peca7.html`/`peca7.js`; o botão Copiar é componente `'use client'` próprio (navegador, `navigator.clipboard`).
- [ ] **Passo 5. Rodar, typecheck.** Rodar também o teste existente da página Canais (`grep -rln "CanaisScreen\|competitors/page" apps/web/test`) e corrigir o que a prop nova quebrar, no mesmo commit.
- [ ] **Passo 6. Commit** `feat: fila Saíram do YouTube mostra o que espera você rodar os comandos, só leitura (manutenção M5, peça 7 parte de leitura)`.

---

### Task 11: peça 5, o aviso do banco (`18-v2`) e as marcas ao lado da pastilha

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/aviso-v2.ts` (puro)
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/aviso-banco/pastilha.tsx`, `painel.tsx`, `regua-tempo.tsx`, `aviso-banco.css` (D-M5-5: inteiro, se o 18 não existir em código; senão, só a diferença sobre o componente achado no Task 0, Passo 3)
- Modify: `_chrome/freshness.tsx` (a pastilha e as marcas na faixa de frescor; `flex-wrap`), `_chrome/chrome-server.tsx` (decide a pastilha e a aba pela guarda **`podeEditarSite`** em cache, não por `permissoesDoSite`, para não pagar `canAdminSiteUsers` em toda navegação, e lê o aviso leve **só depois** dela; a guarda e a leitura da resolução do nicho/engine correm em `Promise.all`, Yannis r2 N-6)
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/arquivo-do-chrome.ts` (a decisão da aba e da pastilha)
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/aviso-leve.ts` (leitor de `obs_archive_aviso`: Zod `.strict()`, `unstable_cache` com `revalidate: 60` e a tag `observatoryTag(siteId)`, chave com o `siteId`; **chamado só depois da guarda**)
- Test: `apps/web/test/youtube/observatorio/aviso-v2.test.ts` (node), `apps/web/test/youtube/observatorio/aviso-pastilha.test.tsx` (jsdom), `apps/web/test/youtube/observatorio/aviso-chrome-leve.test.ts` (node)

**Interfaces:**
- Consumes: `AvisoDoArquivo` e o leitor de `aviso.ts` (E10; não editar); `sinalDoBanco` de `sinal-do-banco.ts` (E10; não editar: a previsão sem serrote, pedido 4, é da M6); `AvisoLeve` (a resposta de `obs_archive_aviso`, Tarefa 2: próximo mês pronto, última cópia, casa, vermelhos contados; **nunca** `ModeloPagina`, Phil I9); `casaDe` (Tarefa 7, com `vermelhos` vazio: "NAS cheio" só aparece na página); `marcaAoLadoDaPastilha` (Tarefa 8; nula na M5).
- Produces:

```ts
export interface AvisoV2 { pastilha: { pct: number | null; cor: 'neutra' | 'ambar' | 'vermelho' | 'nao_medido'; texto: string }
  barra: { hojePct: number | null; chegaAPct: number | null; rotuloChegaA: string | null }
  regua: null | { losango85: number | null; tracoProximaSaida: number | null; alivioDepoisDoAperto: boolean; frase: string | null }
  linhaDaCopia: { forma: Forma; texto: string; portaArquivo: boolean }
  oQueLibera: string[] | null   // com 85%+; nenhuma linha fala em plano pago
  casa: null | { texto: string; oQueFazer: string[]; forma: Forma }
  marcas: { automatico: null /* M6 */; canaisRemovidos: ReturnType<typeof marcaAoLadoDaPastilha> } }
export function montarAvisoV2(o: { aviso: AvisoDoArquivo; leve: AvisoLeve | null; agora: number; casa: Casa; marcaCanais: AvisoV2['marcas']['canaisRemovidos'] }): AvisoV2
```

**Regras (`04` §14.5 e `NOTAS-18-v2.md`):** a cor da pastilha e da frase segue **o mais alto que o banco chega antes da próxima saída** (projetado pela reta da E10 até a data em que o próximo mês fica pronto, de `AvisoLeve.proximo_mes.pronto_em`), a barra continua na cor do tamanho de hoje, com o segundo marcador "chega a N% antes da próxima saída" (texto visível, não só `title`); a régua do tempo com o losango "o banco chega a 85%" e o traço "o próximo mês fica pronto", com a faixa âmbar-vermelho (`linear-gradient` entre dois hex) e "O alívio chega depois do aperto" quando o losango vem antes; a linha da cópia em cinco estados (antes da 1ª cópia: pontilhado "A primeira cópia é a de outubro, a partir de 28/11"; em dia: visto cinza; atrasada: triângulo até 30 dias, octógono acima, com "Abrir o Arquivo"; não medida: hachura, nunca visto); "Quem ocupa" ganha a sub-linha do mês fora das telas sem liberar o espaço (a partir da M6: sem mês destacado, a sub-linha não aparece); casa fora com a frase e "O que fazer" em três itens, e "A pausa da coleta ainda não existe" enquanto a pausa da E10 não estiver em produção (decidir pela presença do comando `pausar` na E10: conferir no dia por `grep -n "pausar" apps/web/src/lib/youtube/observatorio/arquivo/cli.ts`); a palavra "pico" nunca vai à tela; nenhuma linha fala em plano pago; o chip do automático é da M6 (`marcas.automatico` sempre `null` aqui).

**O que acontece quando o dado não existe:** sem leitura do tamanho hoje → como o 18: data e valor da última medida, cor nunca verde; séries particionadas sem medida (`obs_db_size_record` sem as partições) → pastilha "Não medido", nunca o número parcial; `leve` nulo (a leitura do aviso falhou) → a linha da cópia é hachura "não medido" e a régua não desenha o traço da próxima saída (sem data, sem marco), nunca "verde"; sem nenhuma saída ainda → a previsão é a reta da E10 e o "chega a" é o máximo da reta até a data em que o próximo mês fica pronto.

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
- [ ] **Passo 1b. Testes do chrome com o aviso leve, falhando** (Phil I9, Yannis I-10):

A decisão do chrome vive numa função testável, `arquivoNoChrome(siteId)` em `_chrome/arquivo-do-chrome.ts` (o `chrome-server.tsx` só a chama e passa `arquivoVisivel` e o aviso a `buildChromeView`):

```ts
// apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/arquivo-do-chrome.ts
import 'server-only'
import { lerAvisoLeve, type AvisoLeve } from '@/lib/youtube/observatorio/arquivo-mensal/aviso-leve'
import { permissoesDoSite } from './permissoes'

export type ArquivoNoChrome = { arquivoVisivel: boolean; aviso: { ok: true; leve: AvisoLeve } | { ok: false; porque: 'sem_permissao' | 'desligado' | 'funcao_ausente' | 'erro_do_banco' } }
/** Quem decide a aba Arquivo e a pastilha: a guarda primeiro, a variável depois, a leitura leve por último. Nunca chama obs_archive_pagina. */
export async function arquivoNoChrome(siteId: string): Promise<ArquivoNoChrome> {
  const perm = await permissoesDoSite(siteId)
  if (!perm.podeEditar) return { arquivoVisivel: false, aviso: { ok: false, porque: 'sem_permissao' } }
  if (process.env.OBS_ARQUIVO !== 'on') return { arquivoVisivel: true, aviso: { ok: false, porque: 'desligado' } }
  const r = await lerAvisoLeve(siteId)
  if (r.ok) return { arquivoVisivel: true, aviso: { ok: true, leve: r.leve } }
  return { arquivoVisivel: r.porque !== 'funcao_ausente', aviso: { ok: false, porque: r.porque } }
}
```

```ts
// apps/web/test/youtube/observatorio/aviso-chrome-leve.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.fn(); const criar = vi.fn(() => ({ rpc })); const captureMessage = vi.fn(); const permissoes = vi.fn(); const cacheado = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => criar() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/permissoes', () => ({ permissoesDoSite: (s: string) => permissoes(s) }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown, chave: unknown, opcoes: unknown) => { cacheado(chave, opcoes); return fn } }))

const SITE = '00000000-0000-0000-0000-00000000a3b0'
const LEVE = { versao: 1, lido_em: '2028-05-03T15:00:00Z', hoje: '2028-05-03', proximo_mes: null, primeira_devida_em: '2026-11-28', ultima_copia: null, casa: [], vermelhos_n: 0, atraso: { amarelos: 0, vermelhos: 0, mais_antiga: null, meses_sem_selo: 0 } }
const chamar = async () => (await import('@/app/cms/(authed)/youtube/competitors/_chrome/arquivo-do-chrome')).arquivoNoChrome(SITE)

describe('o chrome e o aviso leve', () => {
  beforeEach(() => { vi.resetModules(); for (const f of [rpc, criar, captureMessage, permissoes, cacheado]) f.mockReset(); criar.mockImplementation(() => ({ rpc })); process.env.OBS_ARQUIVO = 'on'; permissoes.mockResolvedValue({ podeEditar: true, canUnlock: false }) })
  it('o chrome nunca chama obs_archive_pagina: só obs_archive_aviso', async () => {
    rpc.mockResolvedValue({ data: LEVE, error: null })
    await chamar()
    expect(rpc.mock.calls.map(c => c[0])).toEqual(['obs_archive_aviso'])
  })
  it('quem só lê: o cliente de serviço não é criado, nem aba, nem pastilha', async () => {
    permissoes.mockResolvedValue({ podeEditar: false, canUnlock: false })
    expect(await chamar()).toEqual({ arquivoVisivel: false, aviso: { ok: false, porque: 'sem_permissao' } })
    expect(criar).not.toHaveBeenCalled()
  })
  it('OBS_ARQUIVO apagada: aba visível para quem edita, rpc não chamada', async () => {
    delete process.env.OBS_ARQUIVO
    expect(await chamar()).toEqual({ arquivoVisivel: true, aviso: { ok: false, porque: 'desligado' } })
    expect(rpc).not.toHaveBeenCalled()
  })
  it('obs_archive_aviso ausente (42883 e PGRST202): aba e pastilha nova não aparecem, sem Sentry', async () => {
    for (const code of ['42883', 'PGRST202']) {
      vi.resetModules(); rpc.mockResolvedValue({ data: null, error: { code } })
      expect(await chamar()).toEqual({ arquivoVisivel: false, aviso: { ok: false, porque: 'funcao_ausente' } })
    }
    expect(captureMessage).not.toHaveBeenCalled()
  })
  it('erro do banco no aviso: aba visível, motivo erro_do_banco, Sentry', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '57014' } })
    expect(await chamar()).toEqual({ arquivoVisivel: true, aviso: { ok: false, porque: 'erro_do_banco' } })
    expect(captureMessage).toHaveBeenCalledWith('obs_archive_aviso: 57014', 'error')
  })
  it('resposta fora da forma: erro_do_banco, nunca "sem problema"', async () => {
    rpc.mockResolvedValue({ data: { versao: 2 }, error: null })
    expect((await chamar()).aviso).toEqual({ ok: false, porque: 'erro_do_banco' })
  })
  it('a leitura leve é embrulhada em cache de 60 s, com o site na chave', async () => {
    rpc.mockResolvedValue({ data: LEVE, error: null })
    await chamar()
    expect(cacheado).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ revalidate: 60 }))
  })
})
```

`aviso-leve.ts` define `AvisoLeve` (Zod `.strict()` sobre as chaves da Tarefa 2: `versao, lido_em, hoje, proximo_mes, primeira_devida_em, ultima_copia, casa, vermelhos_n, atraso`), `lerAvisoLeve(siteId): Promise<{ ok: true; leve: AvisoLeve } | { ok: false; porque: 'funcao_ausente' | 'erro_do_banco' }>` com `unstable_cache(buscar, ['arquivo-aviso-leve', siteId], { revalidate: 60, tags: [observatoryTag(siteId)] })` (padrão de `load-page.ts:62`), `42883`/`PGRST202` → `funcao_ausente` sem Sentry, outro erro ou forma inválida → `Sentry.captureMessage('obs_archive_aviso: <code>' ou 'obs_archive_aviso fora do esquema', 'error')` e `erro_do_banco`. O chrome-server troca a leitura direta pela chamada de `arquivoNoChrome(siteId)` (em lugar de decidir a aba só por `permissoesDoSite`, como a Tarefa 9 deixou) e passa `arquivoVisivel` a `buildChromeView`. O arquivo novo entra no commit da Tarefa 11.
- [ ] **Passo 2. Rodar e ver falhar. Passo 3. Implementar `aviso-v2.ts` e `aviso-leve.ts`. Passo 4. Rodar.**
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
/** Os arquivos que a Tarefa 5 tocou para a peça 1 (lista do ledger do Passo 1 da Tarefa 5): textos de tela também. Vazia = a Tarefa 5 não foi feita. */
const CONSUMIDORES_PECA1: string[] = [ /* preenchida na Tarefa 5, Passo 1, com os caminhos do ledger */ ]
const ARQUIVOS = [
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/peca1.ts',
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-do-mes.ts',
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/canais-removidos.ts',
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/aviso-v2.ts',
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/vermelhos.ts',
  ...CONSUMIDORES_PECA1,
  ...execFileSync('git', ['ls-files', 'apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo', 'apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/aviso-banco',
    'apps/web/src/app/cms/(authed)/youtube/competitors/_canais/esperam-comandos.tsx'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter(f => /\.(ts|tsx)$/.test(f)),
]
/** Só o texto que vai à tela: literais de string e texto JSX; fora o que está dentro de um ⓘ marcado com /* ⓘ *\/ e os comentários. */
function textosDeTela(fonte: string): string[] {
  const semComentario = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const semInfo = semComentario.replace(/INFO\(([`'"])[\s\S]*?\1\)/g, '')
  const literais = [...semInfo.matchAll(/(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g)].map(m => m[2]!).filter(s => /[a-zà-ú]/i.test(s) && !/^[a-z0-9_\-./@:]+$/.test(s))
  const jsx = [...semInfo.matchAll(/>([^<>{}]*[a-zà-ú][^<>{}]*)</gi)].map(m => m[1]!)
  return [...literais, ...jsx]
}
describe('item 38: vocabulário das telas da fase', () => {
  it('a lista dos consumidores da peça 1 não está vazia (a Tarefa 5 a preenche)', () => { expect(CONSUMIDORES_PECA1.length).toBeGreaterThan(0) })
  it('o teste enxerga uma palavra proibida solta e ignora identificadores (teste do teste)', () => {
    expect(textosDeTela("const a = 'Unidade'; const b = 'competitor_video_daily'; const c = 'arq-contorno'")).toEqual(['Unidade'])
  })
  it.each(ARQUIVOS)('%s', arq => {
    const ruins = textosDeTela(readFileSync(resolve(RAIZ, arq), 'utf8'))
      .flatMap(t => PROIBIDAS.filter(p => new RegExp(`(^|[^\\p{L}])${p}([^\\p{L}]|$)`, p === 'MB' ? 'u' : 'iu').test(t)).map(p => `${p}: ${t.slice(0, 80)}`))
    expect(ruins).toEqual([])
  })
})
```

Convenção que o teste impõe: todo texto de ⓘ passa por `INFO('...')` (uma função identidade exportada de `apps/web/src/lib/youtube/observatorio/arquivo-mensal/info.ts`, criada na Tarefa 9: os módulos puros não podem importar de `app/`), o que torna a exceção do ⓘ visível no código. O filtro de literais agora aceita palavra solta (`'Unidade'`) e só ignora o que tem forma de identificador ou caminho (`/^[a-z0-9_\-./@:]+$/`); o preço é que uma palavra proibida **toda em minúsculas e sem espaço** (`'lote'`) passa por identificador: o texto de tela da fase começa com maiúscula ou tem espaço, e a revisão de Logan (Tarefa 15) cobre o resto. As exceções "snapshot(s) do NAS" e "lido em" não estão na lista e passam.
- [ ] **Passo 2. Rodar; corrigir as frases que caírem (com a palavra do mockup; se o mockup também a usa fora do ⓘ, anotar para Logan na Task 15).**
- [ ] **Passo 3. Sincronia (item 86):** preencher a coluna "commit" do `index.html` do 19 com o hash de cada tela (Tarefas 5, 9, 10, 11); conferir a tabela de status do roteiro contra `docs/superpowers/mockups/APROVACOES-DO-DONO.md` (`04` §14.9 ponto 5) e anotar a divergência que restar.
- [ ] **Passo 4. Commit** `test: vocabulário das telas da manutenção e tabela de sincronia com os commits (manutenção M5, itens 38 e 86)`.

---

### Task 13: a migration, a liberação das classes e a ida a produção

**Files:**
- Modify: `supabase/rascunhos/m5.sql` (`-- M5 PARTE 4`: liberar `serie` e `horaria`)
- Create (por `npm run db:new manutencao_m5_telas`): `supabase/migrations/<timestamp>_manutencao_m5_telas.sql`
- Modify: `apps/web/test/helpers/m5.ts` (`M5_SQL_CAMINHO` passa à migration; `M5_EM_MIGRATION = true`)
- Create: `apps/web/test/manutencao/classe-liberada.test.ts` (item 87)

**Como a TRAVA M5-3 se cumpre com um commit por tarefa (Yannis I-3).** O código das Tarefas 4 a 11 é commitado tarefa a tarefa no `staging`, e o `staging` não é produção: o que vai ao `main` e ao Vercel é o **push final** da Tarefa 13, Passo 8, depois do `db:push:prod`. Mas o `staging` já roda o carregador novo contra o banco de produção em desenvolvimento, antes da migration, e a ordem do deploy pode se inverter. Por isso o código das Tarefas 1 a 11 é escrito para sobreviver **sem** as funções novas:
- `obs_archive_online_since` ausente (`42883`/`PGRST202`) → `{ lido: true, nulos }` com Sentry de aviso (Tarefa 4): nada saiu, e isso é verdade, porque nenhuma saída existe sem a migration da M5 (a liberação das classes vive nela) e as funções de saída são da M6, que tem migration posterior à desta. O Observatório continua como hoje, sem o teto de 365 dias.
- `obs_archive_aviso` ausente → o chrome não mostra a aba Arquivo nem a pastilha nova (Tarefa 11); `obs_archive_pagina` ausente → a página diz "O arquivo ainda não foi instalado neste banco." (Tarefa 9); `obs_archive_horaria_desde` e a nova `competitor_hourly_health` chegam juntas, na mesma migration; o leitor `prova.ts` trata `online_desde` ausente como nulo (Tarefa 6).
- O teste do item 87 segura a ordem do que **não** pode inverter: classe liberada com `DAILY_MAX_DAYS` ainda no carregador, ou com a horária ainda no `min(hour_slot)` cru, falha.

- [ ] **Passo 1. Teste do item 87, falhando:**

```ts
// apps/web/test/manutencao/classe-liberada.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const RAIZ = resolve(__dirname, '../../../..')
const MIG = resolve(RAIZ, 'supabase/migrations')
const RASCUNHO = resolve(RAIZ, 'supabase/rascunhos/m5.sql')
const ler = (p: string): string => { try { return readFileSync(p, 'utf8') } catch { return '' } }
/** A última definição de `nome` entre o rascunho da M5 (antes da Tarefa 13) e as migrations (a mais nova que a define). */
function ultimaDefinicao(nome: string): string {
  const re = new RegExp(`function public\\.${nome}\\(`)
  const r = ler(RASCUNHO)
  const arqs = readdirSync(MIG).filter(f => f.endsWith('.sql')).sort().filter(f => re.test(ler(resolve(MIG, f))))
  const m = arqs.length ? ler(resolve(MIG, arqs.at(-1)!)) : ''
  return re.test(r) ? r : m
}
const liberada = (classe: string, tabela: string): boolean =>
  new RegExp(`\\('${classe}', '${tabela}', '[a-z_]+', \\d+, \\d+, \\d+, '[a-z_0-9]+', true`).test(ultimaDefinicao('obs_archive_policy'))

describe('item 87: classe liberada só com as telas', () => {
  it('serie liberada exige o carregador sem DAILY_MAX_DAYS e a função do online desde', () => {
    if (!liberada('serie', 'competitor_video_daily')) return
    expect(ler(resolve(RAIZ, 'apps/web/src/lib/youtube/observatorio/load.ts'))).not.toMatch(/DAILY_MAX_DAYS/)
    expect(ultimaDefinicao('obs_archive_online_since')).not.toBe('')
  })
  it('horaria liberada exige competitor_hourly_health lendo o desde de obs_archive_horaria_desde', () => {
    if (!liberada('horaria', 'competitor_video_hourly')) return
    expect(ultimaDefinicao('competitor_hourly_health')).toMatch(/obs_archive_horaria_desde/)
  })
  it('texto, video_antigo e ensaio continuam fechadas', () => {
    expect(liberada('texto', 'competitor_video_comments')).toBe(false)
    expect(liberada('video_antigo', 'competitor_raw')).toBe(false)
    expect(liberada('ensaio', 'obs_archive_rehearsal')).toBe(false)
  })
  it('o teste enxerga uma classe liberada (teste do teste)', () => {
    expect(new RegExp("\\('serie', 'competitor_video_daily', '[a-z_]+', \\d+, \\d+, \\d+, '[a-z_0-9]+', true").test("('serie', 'competitor_video_daily', 'particao', 6, 28, 7, 'depois_de_3', true, 'views', 'numerico')")).toBe(true)
  })
})
```

- [ ] **Passo 2. Parte 4 do rascunho:** `create or replace function public.obs_archive_policy()` **partindo do corpo instalado** (o da migration da M3b, ou de qualquer migration posterior que o tenha mudado: `grep -ln "function public.obs_archive_policy" supabase/migrations/* | tail -1`), mudando só `released` para `true` nas três linhas `horaria`/`competitor_video_hourly`, `serie`/`competitor_video_daily` e `serie`/`competitor_video_early` (a função é `language sql immutable`: manter); repetir o `revoke`/`grant` da M3b. Teste de integração: depois de `aplicarM5(c)`, `select count(*) from obs_archive_policy() where released` = 3.
- [ ] **Passo 3. Conferir a TRAVA M5-3 e o portão de Yannis e Phil (Tarefa 16) antes de seguir.** Sem o acordo dos dois sobre o código das Tarefas 1 a 12, parar aqui.
- [ ] **Passo 4. A migration.** `npm run db:new manutencao_m5_telas`; copiar `supabase/rascunhos/m5.sql` inteiro para o arquivo criado (cabeçalho de rascunho trocado pelo de migration); `M5_SQL_CAMINHO` passa a apontar para ela e `M5_EM_MIGRATION = true`; apagar o rascunho **e** `supabase/rascunhos/gerar-m5-parte3.py` no mesmo commit (`git rm -- supabase/rascunhos/m5.sql supabase/rascunhos/gerar-m5-parte3.py`); trocar no teste da Tarefa 6 e em qualquer teste que lê `m3b.sql` a leitura do rascunho pela migration da M3b. Rodar toda a suíte de integração da fase com o banco local (`HAS_LOCAL_DB=1 npx vitest run apps/web/test/integration --no-file-parallelism > .superpowers/sdd/manutencao-nas/saidas/m5-int.txt 2>&1`; só as falhas no contexto; em background se passar de 4 minutos) e a suíte completa (`npx vitest run > .superpowers/sdd/manutencao-nas/saidas/m5-all.txt 2>&1`, ~160 s; idem).
- [ ] **Passo 5. Commit** `feat: migration da M5: online desde, leitura da página e do aviso, lista v2, desde da horária e classes serie e horaria liberadas (manutenção M5, itens 35, 82 e 87)`.
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
- [ ] **Passo 7. Conferências em produção** (leitura, pelo agente, `npx supabase db query --linked`, saída em arquivo; cada uma com a **data** em que vale, no ledger):
  - **No dia do `db:push:prod`:** `select class, table_name, released from public.obs_archive_policy() where released` (três linhas `true`); `select * from public.obs_archive_online_since('<site>')` (as três tabelas, `online_since` nulo: nenhum mês saiu); `select (jsonb_path_query_first(public.obs_archive_pagina('<site>'), '$.progresso[*] ? (@.month == "2026-10-01")')->>'canais_esperados')::int` **igual a** `select count(*) from competitor_channels where site_id = '<site>' and added_at < '2026-11-01'` (Phil r2 N4: "`meses` nunca 0" era vazio, a grade sempre tem linhas); `select * from public.obs_archive_online_since('<site>')` com `divergencia = false` nas três tabelas (a divergência compara a partição mais antiga com `obs_archive_switch.first_month`, que ninguém testou em produção; `true` derruba a leitura para "não lido"); `select public.obs_archive_pagina('<site>')->'versao'` (1); `select public.obs_archive_aviso('<site>')->'versao'` (1).
  - **No dia seguinte (D+1):** `select * from public.obs_archive_heartbeat` contra o que a página mostra em "A casa" (mesmo `last_poll_at`/`updated_at`; o triângulo e o octógono nas horas certas).
  - **No dia em que a M6 liga a primeira saída (D-M5-15):** `SAIDA_DE_MES_EXISTE = true` no mesmo commit; função ausente deixa de valer "nada saiu".
  - **Em 01/09/2027:** algum mês da série saiu do banco? A primeira saída da série é a de outubro de 2026, devida em 28/11/2026 e liberada pela janela de 6 meses (a partir de maio de 2027); se em 01/09/2027 nenhum mês da série tiver saído, abrir **achado de custo** (o volume V·D do banco) **antes de 03/10/2027**, quando a leitura de 365 dias teria sido o teto de hoje e a coleta passa a ter um ano. Depois de 03/10/2027 o carregador lê sem teto: o volume lido cresce até a primeira saída.
  Se a leitura em produção for negada no modo automático, preparar o arquivo de comandos e a linha para o dono (`reference_controlador_muitos_agentes`).
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

- [ ] **Passo 1. Revisão do código** (antes da Tarefa 13, Passo 3, e de novo depois de consertos de Gio/Logan/Naksu que toquem lógica): `phil-dados` (leituras: o custo medido de `obs_archive_pagina` e de `obs_archive_aviso` no caso cheio, a grade e o progresso por canal, a lista v2 e o nome, `obs_archive_horaria_desde`, `obs_archive_channel_archive_impact` estendida, a janela mínima de D-M5-1; **confirmar a exceção `INICIO_DAS_MARCAS` de `EXCECOES_DE_DATA_FIXA`**) e `yannis-software` (o commit único do pedido 11, `viewsAtAge`, permissões e cliente de serviço, Next 16, os testes que mudaram de lugar, **a exceção de `docs/ops` da Tarefa 16, Passo 3**). Opus na 1ª rodada, Sonnet nas seguintes, effort `medium`. Conserta-se até haver acordo.
- [ ] **Passo 2. Ledger e índice:** marcar a M5 no índice dos planos (linha 7) como feita, com o hash; registrar no ledger o que fica para depois: botões da peça 3 e o interruptor (M6), "Encerrar o dado de teste" (M6, D-M5-6), sub-linha "mês fora das telas" do `18-v2` e o chip do automático (M6), o botão de `reattach_out_of_order`/`volta_fora_de_ordem` (M6; a leitura é da M5, Tarefa 9), "Já rodei" e "Ver os comandos" do canal removido (M9), a regra "nome anulado ao concluir" (**requisito novo da M9**: nenhum código a faz hoje; D-M5-2 não promete mais isso), "Ver antigo" (M7), seção "Vídeos antigos" (M10b), e o encaixe da peça 7 se a E9 chegar depois (Tarefa 10). **Requisito da M6 (D-M5-15):** `SAIDA_DE_MES_EXISTE = true` em `capacidades.ts` no mesmo commit da primeira função de saída, com o teste das duas posições da Tarefa 4; e o encaixe das peças de `_arquivo-saida/` é da M6 (D-M5-14, `pedidos-m6-para-m5.md`).
- [ ] **Passo 3. `docs/ops/runbook-arquivo-mensal.md`** (criado pela Tarefa 14 da M3b-site; **conferir que existe** com `ls docs/ops/runbook-arquivo-mensal.md`, e, se não, usar `docs/ops/observatorio-arquivo-runbook.md` e anotar): acrescentar (a) a seção "A página Arquivo" (onde fica, quem vê, o que cada forma quer dizer, o que fazer quando ela diz "não medido"); (b) a **exceção à regra de RLS/RBAC do CLAUDE.md** ("leitura pelo cliente de serviço depois de `can_edit_site`, nunca `grant ... to authenticated`"), listando as sete funções de leitura que a fase usa assim (a lista abaixo tem sete; Phil r2 N8): `obs_archive_owner_pending`, `obs_archive_pagina`, `obs_archive_aviso`, `obs_archive_removed_channel_list`, `obs_archive_online_since`, mais `obs_archive_horaria_desde` e `obs_archive_channel_archive_impact`, todas `security definer`, `revoke ... from public, anon, authenticated`, `grant ... to service_role`, chamadas só depois da guarda de edição (E-D4, Yannis I-13). Commit próprio `docs: runbook do arquivo mensal ganha a página Arquivo e a exceção do cliente de serviço (manutenção M5)`.

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
| Grade da página (Phil C1), vermelhos do pulso (I1), casa (I2), colunas fechadas (I3, Yannis I-7), `schema_fp_atual` (I4) | 2, 7 |
| Aviso leve do chrome (Phil I9), aba e pastilha pela guarda (Yannis I-10) | 2, 9, 11 |
| Permissões reais (`requireSiteScope`, `canAdminSiteUsers`) e a exceção em `docs/ops` (Phil I10, Yannis I-1, I-13) | 9, 10, 16 |
| Coleta por vídeo (Phil I8), `desde` da horária (I7), impacto em duas parcelas (I6, Yannis I-8) | 3, 5, 6 |
| Carregador sem esperar o online desde (Yannis I-4), `viewsAtAge` (I-5) | 4 |

## NÃO VERIFICADO neste plano

- (Fechado na 2ª rodada: o corpo de `requireSiteScope` foi lido por Phil em `node_modules/@tn-figueiredo/auth-nextjs/dist/server/require-site-scope.js:4-5`: `edit` → `can_edit_site`, `view` → `can_view_site`; e por Yannis no fonte do pacote.)
- O caminho do guia do Next 16 (`node_modules/next/dist/docs/` da raiz, suposto): a Tarefa 0, Passo 4, o confere.
- O formato de `min_key` das unidades (por isso `obs_archive_horaria_desde` não o usa); o volume V·D em produção (por isso a conferência de 01/09/2027 da Tarefa 13); a bateria de ordem de grandeza da `obs_archive_pagina` no caso cheio (medida na Tarefa 2, Passo 4, não estimada).
- Os nomes exatos das colunas obrigatórias de `obs_archive_heartbeat`, `competitor_video_hourly` e do helper de teste que semeia canais (`semearCanal` aceita `{ site, videos, addedAt }`; conferidos por `grep` em cada tarefa antes de escrever os `insert`).
- Se `obs_archive_months` ou `obs_archive_units` têm gatilho que recuse os `insert` diretos dos testes (a Tarefa 2 insere unidades e meses sem passar por `obs_archive_record_core`); se recusar, o teste passa a semear pela função de gravação e o ajuste vai para o ledger.
- Se a tela do mockup 18 da A5 chega ao `staging` antes da Tarefa 11 (D-M5-5 e a TRAVA M5-4 cobrem os dois casos) e se a E9 chega antes da Tarefa 10 (D-M5-13).
- Se o relógio do banco pode ser simulado para a semente de Gio (Tarefa 14, Passo 2): pode, por `obs_archive.hoje`/`obs_archive.agora` (`m3b.sql:420`, `:1441`), dentro de uma transação.
