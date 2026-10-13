# A5, onda 2: reconciliação dos oito planos de 13/10/2026

Escrito em 13/10/2026, depois de os oito planos da onda 2 terem sido escritos em paralelo, sem se enxergarem. Fontes: as oito fichas de `.superpowers/sdd/a5-planos-onda-2/reconciliacao/ficha-*.md`, os oito planos, a seção 14 de `docs/superpowers/specs/2026-10-12-observatorio-a5/00-indice-decisoes-e-sequencia.md`, os planos de 12/10 já em execução, o SQL versionado em `supabase/migrations/` e o SQL de ensaio em `.superpowers/sdd/a5-e6-e8/sql/` e `.superpowers/sdd/a5-e11/sql/`. Onde o conflito era sobre um fato, o fato foi conferido no código ou no `git` local, e a linha diz onde.

**O que este documento decide e o que não decide.** Ele fixa a ordem das migrations, quem toca cada arquivo compartilhado e em que ordem, e resolve 16 conflitos (R1 a R16) com 51 emendas cirúrgicas nos oito planos, todas marcadas "(reconciliação 13/10: Rn)" e listadas em `.superpowers/sdd/a5-planos-onda-2/reconciliacao/emendas-r1.md`. **(emenda 1: rodada 1 dos pareceres) Os dois engenheiros reprovaram a rodada 0. A seção 3 foi refeita, a tabela da seção 1 reordenada (o lote C foi partido em C1 e C2) e os planos ganharam mais 40 marcas "(reconciliação 13/10, emenda 1: <id>)"; o resumo está no fim da seção 4 e a resposta, achado por achado, em `.superpowers/sdd/a5-planos-onda-2/reconciliacao/resposta-r1.md`.** **(emenda 2: rodada 2 dos pareceres) O de dados concordou com 9 menores; o de software reprovou com 1 crítico, 2 importantes e 4 menores. Os 16 procedem. O crítico corrige um fato da emenda 1: o envio deste programa é por árvore de lote sobre `origin/staging`, não por `git push` do `staging` local, e por isso o lote B e o Lote 2 não esperam o lote C1 nem a A4. A seção 3 ganhou o passo 1a; o resumo está em "Emenda 2", no fim da seção 4, e a resposta em `.superpowers/sdd/a5-planos-onda-2/reconciliacao/resposta-r2.md`.** **(emenda 3: rodada 3 dos pareceres) O de dados concordou com 6 menores; o de software reprovou com 2 importantes e 4 menores. Os 12 procedem. Os dois importantes nasceram da própria emenda 2, que trocou o "push único" pelo envio por árvore de lote sem levar a troca a dois lugares: a conferência de "já está em `main`" passa a ser por conteúdo e nunca por hash local (I1), e os três arquivos do lote C1 vão a `origin/staging` antes do código da E10 (I2). Entraram também a seção 8, "Avisos aos planos de 12/10", e, no plano da E10, o mockup 18 aprovado pelo dono em percentual. Resumo em "Emenda 3", no fim da seção 4; resposta em `.superpowers/sdd/a5-planos-onda-2/reconciliacao/resposta-r3.md`.** Nenhum código, teste ou migration foi alterado; nada foi lido nem escrito em produção. **Três decisões trazem desenho novo que nenhum SQL ou teste provou:** as duas entradas a mais no registro do export (R1 e R2), a pausa de coleta nas marcas e nas medidas (R3) e o aviso de lote exportado no "apagar" (R8). Elas estão escritas como obrigação da tarefa que as implementa e voltam aos engenheiros de dados e de software na revisão da implementação.

**Dois fatos que o pedido dava de outro jeito.** (1) O pedido dizia que os oito planos têm acordo dos dois engenheiros. O plano da E9 diz que o de software condicionou o acordo a um achado já emendado e que a confirmação não foi escrita; o do passo 0 da E17 diz que ainda não passou pelo portão. Para esses dois, o acordo formal é pré-requisito da migration, e continua pendente. (2) O plano da E9 dizia que o código da E1 não estava em `main`. Na referência local de 13/10, `origin/main` é `6d63f387` ("release: A5 E1 e E2, Lote 1", 12:27), que contém `competitor-capture.ts`: o pedido estava certo e a frase do plano foi atualizada (R12).

---

## 1. Tabela única de migrations da A5, na ordem de aplicação

O número não é a ordem. `npm run db:new` carimba pela hora: cada arquivo só nasce na vez dele. São **19 arquivos ativos** (as 16 do spec, a corretiva MG2b, a MG17a e a MG18) e **um número reservado** (MG19).

| Ordem | Migration | Lote | Etapa | O que traz | Depende de | Inerte para o código em `main`? | Estado em 13/10 |
|---|---|---|---|---|---|---|---|
| 1 | **MG13** `20261012000001` | A | E20 | a limpeza do bruto devolve 0; colunas de estado dos relatórios | nada | sim | **em produção** |
| 2 | **MG1** `20261012000002` | A | E1 (e a tabela da E9) | sinalizadores, `miss_streak`, histórico de campo, `raw`, `competitor_removed_items` | C0.8 | sim | **em produção** |
| 3 | **MG2** `20261012000003` | A | E2 | faixas, primeiras horas, faixas no tempo | MG1 | sim | **em produção** |
| 4 | **MG2b** `20261012000004` (corretiva; fora das 17) | A | E1/E2 | provas corrigidas (`competitor_capture_health`, `competitor_series_health`) | MG1, MG2 | sim | **em produção** |
| 5 | **MG10** `20261013000001` | B | E16 parte 1 | execuções da agenda, arrendamento, tomada atômica | nada | sim | **em produção** (código só local) |
| 6 | **MG9** `20261013000002` | B | E15 parte 1 | leitura horária, mapa, as quatro `yt_own_public_*`; corpo por catálogo de `youtube_channel_removal_impact` | MG2 | sim | **em produção** (código só local) |
| 7 | **MG8** `20261013000003` | B | E14 | retratos, comentários, marcas de comentário, identidade em tabela própria | MG1; C0.3 | sim | **em produção** (código só local) |
| 8 | **MG14** | **C1** (emenda 1: D-C1, S-C1) | E6 P1 | cobertura, `yt_own_daily_apply`, o `check` de `kind`; o mesmo corpo por catálogo de `youtube_channel_removal_impact` | C0.8 | sim | **SQL de ensaio** (`.superpowers/sdd/a5-e6-e8/sql/mg14.sql`; aplicada no `bythiago_int`) |
| 9 | **MG5** | **C1** | E8 | retenção | MG14; C0.1 | sim; antes da MG11 a policy nasce com `can_edit_site` e a MG11 a troca (E6/E8 de ontem, linha 66) | **SQL de ensaio** (`a5-e6-e8/sql/mg5.sql`) |
| 10 | **MG7** | **C1** | E11 | dimensões, detalhe da origem, alcance por dimensão; o mesmo corpo único de `youtube_channel_removal_impact` | MG14; MG13; C0.2 | sim; idem (a V2 da E11 passa a ver `can_edit_site` até a MG11 entrar) | **SQL de ensaio** (`a5-e11/sql/mg7.sql`) |
| 11 | **MG6** | sozinha | E10 | registro dos lotes, pausa de coleta (duas colunas em `competitor_channels`), tamanho do banco, 17 funções; remenda quatro funções de prova e de fila; **o registro do export com 22 entradas** (R1, R2) | MG13, MG2b, MG9, MG8 (âncoras do remendo: conferência C1) | sim: sem pausa aberta as quatro funções devolvem o mesmo | **só no plano** (Apêndice A rodado em transação no `bythiago_int`; sete mudanças das emendas 1 e 2, as duas entradas da reconciliação e o terceiro valor de `closed_reason` (emenda 1: D-m4) **não rodados**) |
| 12 | **MG11** | **C2** | E17 passo 0 | o direito "ver desempenho privado", funções por usuário, registro de acesso, contador de taxa, colunas de chave, troca da policy das doze tabelas que existirem | C0.7; arquivo da MG14 criado antes | sim: sem linha em `site_private_viewers` responde igual a `can_edit_site` | **só no plano** (sem acordo formal; SQL de ensaio ainda a nascer em `apps/web/test/fixtures/sql/`) |
| 13 | **MG12** | **C2** | E18 | versões do vídeo próprio e o estado da derivação; três funções | L1a; corpo por catálogo de `youtube_channel_removal_impact` (MG9, já em produção: o spec dizia "nada"); MG11 opcional pelo bloco PL | sim, nos dois sentidos | **só no plano** |
| 14 | **MG17a** (fora das 17) | **C2**, terceira e última (R15), ou sozinha depois | E18 parte 2 | alarga o `check` de `source` da cobertura (`data_api`, `imagem`); três funções de cobertura de metadados; carga da cobertura | MG14 | sim | **só no plano** |
| 15 | **MG4** | sozinha ou com outra aditiva | E4 | `competitor_video_marks`, `competitor_video_mark_misses`, três funções | MG2; MG1; **MG6 antes** (R1, R3) | sim | **só no plano** (Apêndice A rodado no `bythiago_int` **sem** a R3; a Tarefa 8b do plano escreve a pausa e roda de novo, com a MG6 aplicada antes, e isso é condição do `db:new`: emenda 1, D-I1, S-I2) |
| 16 | **MG18** (era "MG-E9"; fora das 17) | sozinha ou com outra aditiva | E9 | `competitor_missing_baseline`; 13 funções (apagar vídeo, canal e comentário, prévia, prova dos ausentes) | MG1, MG2, MG8; Envio A da E9 em `main`; MG6 antes (o registro já traz a tabela: R2) | sim, nos dois sentidos | **só no plano** (Apêndice A **não executado**; sem acordo formal) |
| 17 | **MG15** | **sozinha**, com o dono | E6 P3 | backup e apagamento das linhas vazias do diário | MG14; três execuções limpas de P2; portão G1 a G12; CSV e marca do dia | **não**: exige coletor novo e leitor tolerante em `main` | **só no plano** |
| 18 | **MG16** | **sozinha**, com o dono | E6 P4 | solta o backup | 14 dias depois da MG15; portão P | sim | **só no plano** |
| 19 | **MG17** | **sozinha**, com o dono | E18 parte 2 | dieta de `yt_own_video_meta_daily`; troca o corpo de `yt_own_meta_cover` | MG12, MG17a, passo de versões e código da cobertura em produção; 14 dias limpos; portão D | sim para quem não pede compactação | **só no plano** |
| sem ordem | **MG19** (número reservado; fora das 17) | n/a | fechamento do CMS para `reporter` | não tem desenho nem SQL | o inventário da Tarefa 10 do passo 0 da E17 e plano próprio | n/a | **não existe**; trava só a criação do usuário da irmã e a primeira concessão |
| sem ordem | ~~MG3~~ | n/a | ~~E3~~ | retirada na v2.3 | n/a | n/a | n/a |

**Leitura da tabela.**

- **(emenda 1: D-C1, S-C1) O lote C foi partido.** C1 = MG14, MG5, MG7: as três têm SQL de ensaio aplicado no `bythiago_int`, são inertes e os planos de ontem já as admitem sem a MG11 (E6/E8, linha 66: "a MG14 e a MG5 vão sozinhas, nessa ordem"; E11, V2: "rodado nos dois casos"). ~~Elas sobem para antes de **qualquer** push do `staging` local, porque os 321 commits locais já têm código que as lê (seção 3).~~ (emenda 2: S2-C1) Elas sobem para antes do lote que leva E6 P2, E8-coleta e E11, que é o código que as lê. O lote B e o Lote 2 não as leem (medido na árvore `refs/remontagem/lote-b-mais-lote2`) e vão antes, por árvore de lote: passo 1a da seção 3. C2 = MG11, MG12, MG17a, quando o acordo formal da E17 sair. A ordem fixada ontem era MG14, MG11, MG5, MG7, MG12: a mudança pede o aval do controlador.
- **A MG6 sobe de 13 para 11.** O spec a põe depois da MG15 porque numera pela etapa; ela não depende de nada do lote C, é inerte, e o plano da E10 pede que seja adiantada porque nenhum commit do código da pausa pode nascer antes dela. Ir antes da MG15 também a tira da frente do "arquivo armado". Condição: as conferências C1, C5 (pela CP4 da E9, que a contém), C6, C7 e C12 respondidas, e o Apêndice A rodado de novo com as 22 entradas. A ordem entre a MG6 e o lote C2 é livre; entre a MG6 e o C1, ~~o C1 vem antes só porque é ele que destrava o push~~ (emenda 2: S2-C1) a ordem também é livre: o C1 destrava o lote do canal próprio, a MG6 destrava o código da E10 (que pede o lote B em `main`, passo 1a). O C1 fica na frente na tabela porque o SQL dele já tem ensaio aplicado.
- **A ordem MG6 antes da MG4 é dura** (R1, R3). A MG18 vem depois da MG6 por hábito: o registro pula tabela ausente, então a inversão só custa rodar a V2 da E10 mais tarde.
- **MG4, MG18 e MG15 não têm ordem entre si.** Quem serializa é a fila do `db push` (R14): com arquivo armado (MG15, MG16, MG17) no repositório, nenhum outro `db:new` nem `db:push:prod`.
- **Migrations condicionais, sem número até o gatilho disparar:** índice `(site_id, first_seen_at desc)` em `competitor_field_versions`, se a tabela passar de 200.000 linhas (plano da E7, Apêndice A); índices em chave estrangeira sem índice, dentro da própria MG18, se a CP13 e a CP14 da E9 mandarem; a soma de todos os bancos em `obs_db_size_daily`, se a C2 da E10 mostrar que o painel conta assim; e a corretiva única do registro do export, só se a MG6 for aplicada sem as duas entradas da reconciliação (R1).
- **Três objetos são definidos por mais de uma migration, e a ordem acima é a que os mantém certos:** `youtube_channel_removal_impact` (MG9, MG14 e MG7 trazem o mesmo "corpo único" por catálogo: os três textos são idênticos, conferido em 13/10 no arquivo da MG9 e nos dois SQL de ensaio. (emenda 1: D-m7) O md5 que estava aqui, `1cb73dc5…`, não se reproduz; refeito com o comando escrito: `awk '/^create or replace function public.youtube_channel_removal_impact/{f=1} f{print} f&&/^grant execute on function public.youtube_channel_removal_impact/{exit}' <arquivo> | md5` dá `7d5ff43fde3423c21a4016e745958371` nos três. É o md5 do texto do arquivo, do `create` ao `grant`; o `4827d5ad…` que os testes e as V dos planos de ontem citam é o `md5(prosrc)` do corpo instalado, outra medida); o `check` de `source` de `yt_own_video_coverage` (nasce na MG14, é alargado na MG17a: R15); `yt_own_meta_cover` (criada na MG17a, corpo trocado na MG17 e nos dois roteiros de `docs/ops/sql/`). As quatro funções que a MG6 remenda (`competitor_series_health`, `competitor_hourly_health`, `competitor_comment_due`, `competitor_comment_health`) **não são recriadas por nenhum plano da onda 2** (conferido: E4 e E9 dizem que não recriam função existente); o aviso da linha 452 do plano da E10 fica valendo para a parte 2 da E15.
- **Janela comum do `db:push:prod` (R14):** fora de 11:30 a 13:00 UTC (cron do canal próprio às 12:00 UTC) e fora dos minutos 0, 20 e 40 (cron de concorrentes), com `lock_timeout` de 5 s em todas. É a mais estreita das janelas que os planos pediam (uns diziam 11:55 a 12:15).

---

## 2. Posse dos arquivos compartilhados

"Uma etapa por vez" quer dizer: o arquivo limpo no `git status` antes de editar, commit por caminho explícito, e a segunda etapa parte do commit da primeira. A ordem dada é a recomendada; onde ela pode inverter sem dano, a coluna diz.

| Arquivo ou objeto | Quem toca (tarefa) | Ordem | Observação |
|---|---|---|---|
| `apps/web/src/lib/conferencias.ts`, `test/lib/conferencias.test.ts`, `.superpowers/sdd/a5/conferencias-com-data.md` | todos: E10 (T14), E4 (T12 uma linha; T18), E9 (T13), E17 p0 (T11), E18 (T12), P3 (T4, T7), E7 (T9, T16), ordem 23 (T11; T13 a T15 só o valor) | a ordem do envio de cada lote | um bloco por etapa, no fim; conflito de junção resolvido pelo controlador. Conferência vencida há mais de 7 dias deixa o cron do canal próprio vermelho: data só entra no commit do deploy |
| `observatorio/rules.ts` | E4 T12 (`series.dailyGraceDays`), E10 T2 (4 chaves no fim), E4 T1 (`measures`), E18 T2 (`proprio`) | E4 T12 primeiro (envio antecipado, até 30/10); as outras três em qualquer ordem, uma por vez | a T12 pode ir como constante em `competitor-tiers.ts` se `rules.ts` local divergir do remoto no dia (saída prevista no plano da E4) |
| `competitor-tiers.ts` e o teste | E4 T12 | só ela | muda comportamento em produção (faixa diária de 30 para 32 dias) |
| `agenda/definicoes.ts`, `agenda/catalogo.ts`, `test/youtube/agenda/{catalogo,saude,tarefas,despachante}.test.ts` | E10 T9 (`tamanho_do_banco`, ordem 4), E4 T11 (`marcas_de_idade`, ordem 5.5); depois, a parte 2 da E16 e da E15 (ordens 3 e 5) | **E10 T9, depois E4 T11** (R13) | lista de ordens depois das duas: `[1, 2, 4, 5.5, 6, 7, 8]`. A E4 afirma a posição por relação; a E10 afirma nomes e ordens |
| `agenda/executar.ts`, `app/api/cron/sync-youtube/route.ts` | E10 T9, E9 T8 | **E10 T9, depois E9 T8** | os dois penduram leitura no fim do disparo; a soma está na seção 5 |
| `agenda/aviso.ts` | E10 T9 | só ela | |
| `agenda/fecho.ts` e o teste | E9 T8 | só ela | a E10 declara que não toca |
| `test/youtube/cron-competitors-{prova,invalidate,agenda}.test.ts`, `test/integration/agenda-despacho.test.ts` | E10 T9 (uma linha `vi.mock`), E9 T8 | E10, depois E9 | `agenda-despacho.test.ts` cai sem a MG18 no `bythiago_int` depois da T8 da E9: o controlador aplica antes |
| `competitor-sync.ts`, `test/youtube/competitor-sync-harness.ts`, `competitor-sync-a5.test.ts` | E10 T4a, E9 T7 (Envio A) | recomendado E10 4a, depois E9 7; **pode inverter** | a 4a só nasce com a V1 da MG6 em produção; se a MG6 atrasar, a T7 da E9 não espera por ela (espera o lote B e a A4 em `main`) |
| `competitor-sync-batch.ts`, `competitor-health.ts`, `horaria/{gravar,lista,executar}.ts`, `agenda/tarefas/leitura-horaria.ts` | E10 T4a e T4b | só a E10 | depende do lote B em produção |
| `app/cms/(authed)/youtube/competitors/actions.ts` | E9 T7 (`addCompetitorChannel`), E9 T9 e E10 T11b (**as duas em `removeCompetitorChannel`**) | E9 T7; depois E9 T9 e E10 T11b em qualquer ordem (R7) | zona da A4: só com ela em `staging` ou aval do controlador. Forma final: guardas, recusas da E9, `removerCanalArquivado` da E10 |
| `test/youtube/observatorio/lista-fechada-do-que-apaga.test.ts`, `test/integration/observatorio-a5-e10-lista-fechada.test.ts` | E10 (T10, T11a, T11b); recebem pares de E4 (T9), E9 (T11), ordem 23 (T15) | cada plano acrescenta o seu par no commit da própria migration (R6) | quem chegar antes de o teste existir deixa o par em `.superpowers/sdd/a5/fila-do-db-push.md`, seção "pares e classificações pendentes". (emenda 1: S-I3) Recebe também o par da MG17a (ordem 23, T13: `yt_own_meta_cover_set`); o teste de integração só vai a push com os arquivos da MG14 e da MG7 ~~no repositório~~ (emenda 3: I2) **na árvore do lote que vai a push** (existir no `staging` local ou estar aplicada no `bythiago_int` não basta: regra 1, item (iii), da seção 3) |
| `test/youtube/observatorio/saiu-varredura.test.ts` | E9 T11; recebe nomes de E10 (MG6) e E4 (MG4) | idem (R6) | |
| `test/youtube/observatorio/cache-writers.test.ts` | E9 T11a, depois E9 T9 | nessa ordem; a E10 T11b roda o teste | igualdade exata de `KNOWN_WRITERS` |
| `coleta/index.ts` e o teste | E18 T7 (e, dos planos de ontem, E11 T10, E6 P2, E8) | uma por vez; a T7 só depois da MG12 em produção | ~~qualquer push de `staging` leva o commit~~ (emenda 2: S2-C1) um `git push` simples do `staging` local leva o commit; por árvore de lote ele só vai se estiver na lista, e a conferência por árvore da regra 1 da seção 3 é quem garante |
| `coleta/meta-step.ts` e o teste | E18 T5, ordem 23 T3 | **E18 T5, depois ordem 23 T3** (a T3 só dentro da T13, depois da MG17a) | |
| `coleta/versoes-step.ts` e o teste | E18 T6 (cria), ordem 23 T5 | E18, depois ordem 23 | o teste 19 da E18 passa de 43 para 45 idas |
| `test/youtube/coleta/fake-supabase.ts` | E18 T6, ordem 23 T3 | E18, depois ordem 23 | um bloco cada, no fim |
| `observatorio/proprio/ler.ts`, `ler-retencao.ts`, `ler-dimensoes.ts`, `_proprio/dados.ts`, `_proprio/carregar-extras.ts`, `_chrome/page-data.ts`, as duas páginas | A4 (dona), E6 P2 (`ler.ts`), E17 p0 T6 | A4 em `staging`, E6 P2, depois E17 T6 | a T6 troca só o tipo do pedido |
| `observatorio/proprio-versoes/ler.ts` e o teste (novo) | E18 T9; E17 p0 T6 se já existir (R11) | quem vier depois adota o token novo | |
| `test/youtube/observatorio/proprio-varredura.test.ts` | E17 p0 T5, depois T6 | em sequência | |
| `test/integration/observatorio-a5-e17-p0-{doze,reporter-banco}.test.ts` | E17 p0 (T3, T10B, T11); recebem classificação de MG12, MG6, MG4, MG18 (R10) | no commit de cada migration | vermelhos de propósito para quem criar objeto sem classificar |
| `test/youtube/observatorio/acoes-recusam-leitora.test.ts` | E17 p0 T7; E9 T9 acrescenta `_saiu/actions.ts` se o teste existir (R10) | | |
| `_chrome/view-model.ts`, `_chrome/chrome-server.tsx`, `observatorio/links.ts` | A4 (dona), E9 T10a e T10b | A4 em `staging`, depois E9 | quinta aba |
| `app/api/cron/ab-watchdog/route.ts` | E9 T11a | só ela | a poda de retratos muda de lugar; entra na lista fechada da E10 (R6) |
| `e2e/fixtures/global-setup.ts`, `auth.setup.ts` | E17 p0 T8 | só ela | lança "MG11 não aplicada no banco do navegador" para toda trilha se entrar antes da migration local |
| `e2e/fixtures/observatorio-seed.ts`, `playwright.config.ts` | E9 T12 | só ela | precisa da MG18 no banco do navegador (54321) |
| `docs/ops/youtube-coleta-canais-proprios-runbook.md` | E18 T12, P3 T5, ordem 23 T12 (e, de ontem, E6 P2, E8, E11, E20) | a ordem do envio | seção nova no fim; P3 e ordem 23 acrescentam, cada um, uma linha na seção 11 |
| `docs/ops/env-vars.md` | E9 T13 (`OBS_PROVA_AUSENTES`), E10 T12 (`OBS_ARQUIVO_DB_URL`), ordem 23 T12 (`YT_OWN_META_DIETA_OFF`) (R16) | qualquer | uma linha cada |
| `lib/pipeline/services/competitors.ts`, as duas rotas, `mcp/tools.ts`, `mcp/services/youtube-observatory.ts`, `mcp/prompts.ts`, `data/pipeline-docs/cowork-docs-youtube.md` | só E7 (T5, T6a, T6b, T7, T13, T14) | em fila dentro da E7 | o commit que toca `data/pipeline-docs/` dispara a semente em produção: conferências P-8 e P-8b antes |
| SQL: `public.obs_archive_registry()` | **só a MG6** (R1) | n/a | 22 entradas; MG4 e MG18 não recriam |
| SQL: comentário de `public.yt_own_video_daily` | dono (marca `P3 armada em`, retirada depois da V7), MG16 (marca `P4 armada em` e resultado `MG16 …`) | P3, depois P4 | nunca armadas no mesmo dia; o resultado da MG15 fica no comentário do backup |
| SQL: `public.yt_own_meta_cover(uuid,uuid,date,boolean)` | MG17a (cria), MG17 (troca o corpo), roteiros de desligar e de religar | nessa ordem | teste "letra por letra" na ordem 23 |
| Banco `bythiago_int` (54421/54422) | todos os testes de integração | em série; quem aplica migration nele é o controlador | E17 p0 pede o banco livre nas rodadas dela; os testes da MG17a seguram trava exclusiva em `yt_own_video_coverage` |
| Fila do `db push`: `.superpowers/sdd/a5/fila-do-db-push.md` (o controlador cria) | P3, ordem 23 escrevem; E10, E4, E9, E17, E18 leem antes do `db:new` | n/a | uma linha por arquivo armado (R14). (emenda 1: S-m3) Duas seções: "db push bloqueado" e "pares e classificações pendentes". ~~Em 13/10 o arquivo não existe: o controlador o cria vazio antes do primeiro `db:new`.~~ (reconciliação 13/10, emenda 4: p8, n5) O arquivo foi criado em 13/10, com o cabeçalho, a regra do arquivo ausente, o estado do dia (nada pendente de `db:push`) e a ordem dos próximos lotes copiada da seção 1. (emenda 3: n6) **Arquivo ausente não é lista vazia:** a tarefa que o lê e não o acha para e pergunta ao controlador. Escrito nas três tarefas que leem a seção de pares (E10 T10, E17 p0 T3, E9 T11); vale igual, por esta linha, para quem lê a seção "db push bloqueado" antes do `db:new` (E10 T1, E4 T9, E9 seção 2, ordem 23 A4 e P10), ~~onde não foi repetido~~ (reconciliação 13/10, emenda 4: p8, n5) onde agora está repetido, e também nos dois pontos da ordem 23 que escrevem a linha (Tarefas da MG16 e da MG17: ausente, não recriar do zero) |

---

## 3. Ordem de envio recomendada das etapas que restam

**(emenda 1: D-C1, S-C1, S-I1, S-I3; seção refeita. A versão da rodada 0 mandava o código do lote B a `main` no passo 1 e as migrations do lote C no passo 4; seguida ao pé da letra, parava o diário do canal próprio em produção.)**

Estado de partida: em produção, MG13, MG1, MG2, MG2b, MG10, MG9, MG8 e o código de E12, E20, E19 (modo aviso) e o Lote 1 de E1/E2. Só locais: o código do lote B (agenda, leitura horária, comentários), o Lote 2 de E1/E2, a A4, a E11 e a E6/E8.

**O fato que manda na ordem (conferido no `git` local em 13/10, só leitura).**

- `git rev-list --count origin/staging..staging` = **321** (emenda 3: m4, n5: retrato da tarde de 13/10; a mesma medida deu 322 mais tarde no mesmo dia, por um commit de documentação. Todo número de `git` desta seção é retrato, e o controlador repete a medida no dia do envio), e 0 no sentido contrário: ~~a história local é uma linha só, à frente de `origin/staging` (`63db57ba`). O envio é o push dessa linha; não há como mandar um lote sem os commits que vieram antes dele.~~ **(emenda 2: S2-C1) A frase riscada é falsa e a seção foi refeita em cima dela.** Medido em 13/10, só leitura: `git rev-list --merges --count origin/staging..staging` = **4** (o local já foi reencontrado com o remoto depois de envio separado: não é uma linha só). `git for-each-ref refs/remontagem`: `lote-b` (`1b368f90`, 49 à frente de `origin/staging`), `lote-b-mais-lote2` (`14eb9bca`, 54 à frente), `noite-13-10` (`4b8ec515`, 55), `a4` (`7111fac2`, 136, montada em cima de `lote-b-mais-lote2`); as quatro 0 atrás. **O que vale: um `git push` simples do `staging` local leva os 321 commits e está proibido enquanto houver nele código que lê migration não aplicada. O envio é por árvore de lote sobre `origin/staging` (lista explícita de commits), como nos envios anteriores (`.superpowers/sdd/a5-e12/progress.md:96`; `.superpowers/sdd/a5-e16-e15/progress.md:66`, "ENVIO SEPARÁVEL: sim") e como cinco dos oito planos de hoje já escrevem (E4, E7, E10, ordem 23, P3); depois de cada envio o controlador faz `git merge origin/staging` no local.**
- Nessa linha, contando do mais novo: `3f3d42d1` na posição 62 (E8 T11a: a retenção entra no cron), `2418d51f` na 69 (E11 T10: dimensões e normalizadores entram no cron), `6d600b29` na 93 (E6 T3: "o diário grava pela função `yt_own_daily_apply`"); o fim do lote B (`57266abf`) está na 40. Nenhum dos três está em `origin/main` (`git merge-base --is-ancestor`: falso nos três). (emenda 3: I1, m1) `is-ancestor` falso não prova ausência quando o envio é por árvore de lote (a cópia tem outro hash); a prova que vale é por conteúdo, e ela confirma: `git grep -l yt_own_daily_apply origin/main -- apps/web/src` dá 0 arquivos (medido em 13/10). **Todo push além de `63db57ba` leva os três, inclusive um push parcial até o fim do lote B.** (emenda 2: S2-C1) Isso vale para o `git push` da linha local, não para a árvore de lote: em `refs/remontagem/lote-b-mais-lote2`, `git grep -lE "yt_own_daily_apply|yt_own_video_coverage|yt_own_retention_facts|yt_own_video_retention|yt_own_dim_" -- apps/web/src` dá **0 arquivos**, `coleta/cobertura.ts` não existe, não há teste `a5-e11-*` nem `a5-e6-e8-*` em `test/integration/`, nenhum teste de integração cita `.superpowers`, e `supabase/migrations/` termina em `20261013000003` (as três do lote B, já em produção). O mesmo `git grep` dá 0 em `lote-b`, `noite-13-10` e `a4`. O relatório da remontagem (`.superpowers/sdd/a5-lote-b/remontagem-b-mais-l2-report.md`: árvore `754fab32…`, 26.735 testes sem falha) não foi refeito aqui.
- `apps/web/src/lib/youtube/coleta/diario-step.ts:10`: "Função ou tabela de cobertura ausentes: `schema_ausente` e o passo para; nunca se grava pelo caminho antigo". O diário não tem interruptor: `PASSOS_COM_INTERRUPTOR` é `retencao`, `dimensoes`, `versoes`, `normalizadores` (`coleta/passos-desligados.ts:6`).
- O leitor tolerante (E6, Tarefa 5) não existe: `proprio/cobertura-leitor.ts` não está em `HEAD` nem na árvore, e `proprio/ler.ts` não cita `yt_own_video_coverage`. O plano de ontem (E6/E8, linha 237) diz que as Tarefas 3 e 5 vão no mesmo lote.
- `apps/web/test/integration/a5-e11-schema.test.ts:37` lê o SQL de `.superpowers/sdd/a5-e11/sql/`, pasta que o `git` ignora (`git ls-files .superpowers`: 0): "quebra na CI até a 1b". `supabase/migrations/` termina em `20261013000003`.

**Consequência.** Sem MG14, MG5 e MG7 em produção, e sem os arquivos delas em `supabase/migrations/`, qualquer ~~push do `staging` local~~ envio que leve E6 P2, E8-coleta ou E11 (emenda 2: S2-C1) deixa a CI de integração vermelha e, promovido, para o diário do canal próprio para todos os canais, todo dia às 12:00 UTC, até as migrations entrarem. Com as migrations e sem o leitor tolerante, o coletor novo para de gravar dia vazio e as telas leem a ausência com o leitor antigo. Por isso **o lote C foi partido em dois** e a parte que tem SQL de ensaio rodado sobe para antes ~~de qualquer push~~ do lote do canal próprio (emenda 2: S2-C1). O lote B e o Lote 2 não esperam por ela: passo 1a.

| Passo | O que vai | Depende de | O que destrava |
|---|---|---|---|
| 0 (hoje; ~~**nenhum push**~~ (emenda 2: S2-C1) nenhum `git push` simples do `staging` local) | Conferências do grupo 0 da seção 7: **C-14 primeiro** e C-16 (decidem o caminho da Tarefa 12 da E4) e C-5. Pergunta E4-1 ao dono | nada | a escolha entre os caminhos (a) e (b) da Tarefa 12 da E4, abaixo |
| **1a** (emenda 2: S2-C1; **não espera o lote C1, a A4 nem o leitor tolerante**) | **Lote B (agenda, leitura horária, comentários) mais Lote 2 de E1/E2, por árvore de lote sobre `origin/staging`:** `refs/remontagem/lote-b-mais-lote2` (`14eb9bca`, 54 à frente e 0 atrás em 13/10) ou a que o controlador remontar no dia. Push por refspec em `bash -c`, CI, promoção; depois, `git merge origin/staging` no `staging` local (junção, nunca rebase), sem agente commitando | MG10, MG9 e MG8, já em produção; as condições E-2 a E-5 do portão do lote B (`.superpowers/sdd/a5-e16-e15/progress.md:64-82`) e a aprovação do Lote 2 (**não conferi se estão fechadas: é do controlador**); a conferência por árvore da regra 1; se `origin/staging` tiver andado, remontar | **a hora não lida não volta: é o que perde dado por dia até este passo.** Destrava E10 (T3, T4a, T4b, T9), o lote da E4, a E9 (Envio A), o Lote 1 da E7; começam a contar os 14 dias da parte 2 da E16 |
| 1 | **Lote C1, num só `db:push:prod` (dono): MG14, MG5, MG7**, nessa ordem. Os arquivos nascem pela "Tarefa 1b" dos planos de ontem, do SQL de ensaio já aplicado no `bythiago_int`; V1 a V7 da E6/E8 e V1 a V3 da E11 depois. **(emenda 3: I2) Segunda metade do passo, do controlador: depois das V, os três arquivos `.sql` do C1, e só eles, vão a `origin/staging` e são promovidos**, por árvore própria ou dentro da primeira árvore de código que precisar deles (a da E10, passo 7, ou a do passo 2), o que economiza um push. São inertes para o código em `main` (seção 1). É o lote "M" que o plano de ontem da E6/E8 já escreve para a MG14 e a MG5 (Tarefa 15), estendido ao arquivo da MG7, que pelo plano de ontem da E11 só subiria com o código (Tarefa 14): seção 8. A árvore é montada depois do passo 1a, para já ter os três arquivos do lote B (em 13/10 `origin/staging` termina em `20261012000004`) | o aval do controlador para mudar a ordem fixada ontem (MG14, MG11, MG5, MG7, MG12); a fila do `db push` livre; janela comum. **Não** depende do acordo do passo 0 da E17 nem da A4 | ~~o push único (passo 2)~~ (emenda 2: S2-C1) o lote do canal próprio (passo 2), e só ele; o teste de integração da lista fechada da E10 (a F17 lista funções da MG14 e da MG7): (emenda 3: I2) quem o destrava é a segunda metade deste passo (os arquivos em `origin/staging`), não a aplicação em produção |
| 2 | **Lote do canal próprio: E6 P2, E8-coleta e E11, com o leitor tolerante e a "1b" da E11**, por árvore de lote (ou por push do `staging` local, se nesse dia não restar nele nada que leia migration não aplicada). (emenda 2: S2-C1) A emenda 1 chamava este passo de "push único" e punha nele também o lote B, o Lote 2 e a A4. **A A4 vai pela árvore dela quando fechar** (`refs/remontagem/a4`, montada sobre o lote B mais Lote 2: 0 arquivos com objeto do C1, medido em 13/10), antes deste passo ou junto | passo 1 conferido em produção; **a Tarefa 5 da E6 (leitor tolerante) commitada**, o que pede a A4 fechada (ela mexe em `proprio/ler.ts`); os testes de integração lendo de `supabase/migrations/` (a "1b" da E11) no mesmo envio; a revisão final de cada lote e as condições de envio dos planos de ontem (`E6_P2_DEPLOY`, `E8_COLETA_DEPLOY`, as conferências com data); `dimensoes` em `YT_OWN_STEPS_OFF` gravada na Vercel antes do push, se for o caso | começam a contar as três execuções limpas de P2 (portão da MG15). Com a A4 em `main`: o passo 0 da E17 (T5, T6, T8), a T9 da E18, a T11b da E10, as Tarefas 9 e 10 da E9. **(emenda 2: D2-m9) Na primeira execução do coletor novo, o esperado de `apagadas` da conferência `e6-p2-primeira-execucao` ("perto de 280" = 35 vídeos × 8 dias; plano de ontem da E6/E8, P5 e L4) cresce com os dias entre o passo 1 e este:** cerca de 35 por dia a mais, pela mesma conta (estimativa, não medida; o plano de ontem já escreve "280 ou mais" na linha do dia D). `com_buraco` continua 0: a janela de cada vídeo começa no menor entre hoje menos 10 e o último dia coberto (`coleta/diario-step.ts:5`) |
| 3 | **MG6** (dono), sozinha; V1 a V4b | C1, CP4, C6, C7, C12; Apêndice A rodado de novo com 22 entradas e o terceiro valor de `closed_reason` | os commits das Tarefas 4a, 4b, 9 e 11b da E10; a Tarefa 8b da E4 e a MG4 |
| 4 | **Lote C2, num só `db:push:prod`: MG11, MG12, MG17a** | acordo formal do passo 0 da E17; P1 a P10 e P12 da E17; P1, P6 e P7 da E18. Se o acordo da E17 demorar, MG12 e MG17a vão sem a MG11 (o bloco PL delas escolhe a policy) e a MG11 as troca quando entrar, desde que a lista dela inclua as duas tabelas da MG12 | o código do passo 0 da E17 e da E18 |
| 5 | Código do lote C2 a `main`: E17 p0 e E18 (a T7 só depois de V1 a V5 da MG12) | passos 2 e 4 | 14 execuções limpas do passo de versões |
| 6 | Código da cobertura de metadados (ordem 23, Tarefa 13 com a Tarefa 3 dentro) | MG17a em produção com VA1 a VA4; Tarefas 5, 6 e 7 da E18 em `main` | os 14 dias limpos do portão D (MG17) |
| 7 | **Código da E10** (T4a, T4b, T9; a T11b quando a A4 liberar `actions.ts`) | passos 1a e 3 (emenda 2: S2-C1; era "2 e 3"); **a Tarefa 10 (teste de integração da lista fechada) depende também do passo 1**, (emenda 3: I2) **inteiro: os arquivos da MG14 e da MG7 têm de estar na árvore que vai a push** (já em `origin/staging`, pela segunda metade do passo 1, ou dentro da própria árvore da E10). Aplicadas em produção não basta: o banco da CI nasce de `supabase/migrations/` da árvore enviada, e a suíte local contra o `bythiago_int` passa sem eles. A emenda 1 tinha essa garantia de graça porque o passo 7 dependia do passo 2; a emenda 2 trocou a dependência e a perdeu. E ganha o par da MG17a quando o passo 4 chegar | a pausa, o export, o sinal de limite; a T9 abre a vez da T11 da E4 e da T8 da E9 nos arquivos da agenda |
| 8 | **MG4** e o lote da E4 | passos 1a, 3 e 7 (emenda 2: S2-C1; era "2, 3 e 7"); **a Tarefa 8b da E4 fechada, com acordo**; **a Tarefa 11 só commitada com a MG4 em produção** (emenda 2: D2-m6); a T12 já em produção; depois das 04:00 de São Paulo | a E5 (telas), o Lote 2 da E7 |
| 9 | **E9:** Envio A (T7), depois **MG18**, depois Envio B (T13) | acordo formal; passo 1a (emenda 2: S2-C1; era "passo 2"), e a A4 em `staging` para as Tarefas 9 e 10; (emenda 3: I1) a conferência "o que veio antes já está em `main`" do Envio A e do Envio B é por conteúdo (`git diff --quiet origin/main <commit-pai> -- <caminhos>`, código de saída 0), e os dois sobem por árvore de lote; E10 T9 antes da T8 (mesmos arquivos); mockup 10 já aprovado | a fila "Saíram do YouTube"; a ordem A, migration, B não inverte |
| 10 | **MG15** (dono, sozinha, com o ritual do CSV) | portão G1 a G12: três execuções limpas depois do passo 2, a última com menos de 36 h | o espaço do diário; começam a contar os 14 dias da MG16 |
| 11 | **E7:** Lote 1 pode ir desde o passo 1a (emenda 2: S2-C1; era "passo 2") (não depende da E4); **Lote 2** depois do passo 8 e da `e4-d0` | P-2, P-7, P-13, P-15 para o Lote 1; P-10, P-12, P-14 para o Lote 2 | o Cowork lê perfil, mudanças de campo e medidas |
| 12 | **MG16** e **MG17** (dono, cada uma sozinha, em dias diferentes, em qualquer ordem entre si) | portão P (14 dias depois da MG15) e portão D (14 dias limpos) | fecham a dieta |
| sem data | Sem plano na onda 2: parte 2 da E16 e da E15 (ordem 13), E13 (mockups), E5 (telas), E17 degraus 1 e 2, MG19 | | |

**A Tarefa 12 da E4 (faixa diária de 32 dias; data: em produção até 30/10/2026).** Ela é a única com perda sem volta e data, e o commit dela nasce no topo dos 321. Dois caminhos, escritos também no "Envio" da Tarefa 12 do plano:

- ~~**(a) Padrão, se a C-16 der zero linhas:** vai dentro do push único do passo 2, até 27/10/2026, conferido em 23/10.~~ **(emenda 2: S2-I1, D2-m5) (a) deixa de ser o padrão e fica só para: C-14 com zero linhas, nenhum canal a menos de 5 do `video_limit` (segunda consulta da C-14) e C-16 com zero linhas.** Nesse caso a tarefa vai na primeira árvore de lote que sair (a do passo 1a), com teto em 27/10/2026. (emenda 3: m3) A árvore nomeada no passo 1a (`14eb9bca`) foi testada **sem** a tarefa: com ela dentro é árvore nova, e o typecheck e a suíte rodam de novo nela antes do push (é a regra 1; faltava dizer aqui). A C-16 e a segunda consulta da C-14 são retrato do dia: rodam de novo a cada dois dias enquanto a tarefa não estiver em produção, e uma linha em qualquer das duas passa para (b). Em 23/10 a pergunta é "o envio que leva a tarefa tem data até 27/10?", não "o lote C1 está aplicado?". As duas datas continuam proposta da emenda 1.
- **(b) (emenda 2: S2-I1, D2-m5) A regra: sempre que a C-14 der uma linha ou mais, qualquer que seja a C-16** (é o que o plano da E4 já dizia na C-14: "uma linha ou mais: o envio antecipado é obrigatório"), ou a C-16 der linha, ou a data de (a) não fechar. Árvore de lote própria, só com os três arquivos, sobre `origin/staging`, **logo depois das duas conferências**; push por refspec (`bash -c 'git push origin <sha>:refs/heads/staging'`); CI; promoção. Depois, no `staging` local, `git merge origin/staging` (junção, nunca rebase), sem agente commitando; a tarefa não é commitada duas vezes. (emenda 3: m3) O envio de (b) deixa as quatro `refs/remontagem/*` 1 commit atrás de `origin/staging`: a remontagem da árvore do passo 1a passa a ser certa, e não "se o remoto tiver andado". **Condição no dia, no lugar do "`git diff` vazio" da emenda 1, que é falso hoje** (`rules.ts` tem 8 linhas a mais no local: a importação de `COMMENT_RULES` e as chaves `hourly` e `comments`): `competitor-tiers.ts` e o teste dele iguais nos dois lados, e nenhuma linha de `rules.ts` mudada a menos de 3 linhas de `series:` (medido em 13/10: as duas valem); senão, a constante vai em `competitor-tiers.ts`, saída que o plano já prevê. ~~Cria divergência entre a árvore local e o remoto: pede o aval do dono.~~ É o modo de envio normal deste programa: decisão do controlador.

A Tarefa 5 da E18 (guardar a imagem quando o dHash muda 1 bit) não tem data: ~~vai no push do passo 2 ou depois, nunca sozinha~~ (emenda 2: S2-C1) vai por árvore de lote como qualquer outra, sozinha ou acompanhada, com a conferência por árvore da regra 1.

**Se o controlador não avalizar a partida do lote C** (saída 2 do parecer de software): o lote C continua inteiro (MG14, MG11, MG5, MG7, MG12, MG17a) e o passo 2 passa a depender dele. ~~O custo, dito na tabela: a hora não lida do lote B espera também o acordo formal do passo 0 da E17 e o SQL de ensaio da MG11, que ainda não nasceu.~~ (emenda 2: S2-C1) O custo deixou de cair na hora não lida, que sai no passo 1a de qualquer jeito: cai só na dieta do diário, que volta a esperar o acordo formal do passo 0 da E17 e o SQL de ensaio da MG11.

**Caminho crítico em dias de calendário.** Dieta do diário: A4 fechada e Tarefa 5 da E6 commitada → lote C1 → ~~push único~~ (emenda 3: m2, n5) lote do canal próprio (passo 2) → três execuções limpas (3 dias) → MG15 → 14 dias → MG16. Dieta dos metadados: lote C2 → código da E18 → MG17a e código da cobertura → 14 dias limpos → MG17. As duas pedem pelo menos 17 a 20 dias depois do seu ponto de partida. ~~**O que encurta o fim da A5 e para de perder dado é a mesma coisa: a A4 fechar, o leitor tolerante ser commitado e o lote C1 ser aplicado, porque sem os três o passo 2 não sai.**~~ **(emenda 2: S2-C1) São duas coisas, e a emenda 1 as amarrou sem precisar. O que para de perder dado é o passo 1a (e a Tarefa 12 da E4), que não espera nada além do portão do próprio lote. O que encurta o fim da A5 é a A4 fechar, o leitor tolerante ser commitado e o lote C1 ser aplicado, porque sem os três o passo 2 não sai.** MG6, MG4, E9 e E7 não estão no caminho crítico. Com a partida do lote C, a dieta do diário deixou de esperar o acordo da E17.

**Três regras de envio que vieram de planos diferentes e valem para todos.**

1. **O `staging` local é um só, e o envio é por árvore de lote.** ~~O push de qualquer trilha leva todos os commits ancestrais. Nenhum push do `staging` local antes de MG14, MG5 e MG7 estarem em produção e de o leitor tolerante estar commitado.~~ **(emenda 2: S2-C1; substitui a redação da emenda 1.) Um `git push` simples do `staging` local leva todos os commits ancestrais, e os 321 de hoje contêm código que lê MG14, MG5 e MG7: ele está proibido enquanto isso durar. Cada lote sobe por árvore própria sobre `origin/staging`, com lista explícita de commits (como dizem a E4, a E7, a E10, a ordem 23 e a P3; (emenda 3: I1) e a E9, cujos Envio A e Envio B passaram a dizer o mesmo), e o push sai do `HEAD` da árvore em que o typecheck e a suíte rodaram. Conferência obrigatória por árvore, antes do push: (i) `git grep` dos objetos de toda migration ainda não aplicada dá 0 arquivos em `apps/web/src` dessa árvore; (ii) nenhum teste de `test/integration/` dela lê SQL de fora de `supabase/migrations/` dela; (emenda 3: I2) (iii) toda função ou tabela que um teste de `test/integration/` da árvore espera no catálogo vem de arquivo de `supabase/migrations/` da própria árvore. A suíte local contra o `bythiago_int` não prova (iii): esse banco tem migrations aplicadas que a árvore não tem (em 13/10: MG14, MG5 e MG7), e o teste fica verde local e vermelho na CI. Prova que serve: para cada nome que o teste lista, `git grep -l <nome> <árvore> -- supabase/migrations` acha arquivo. (emenda 3: I1) Conferência de "já está em `main`" (ou em `origin/staging`) é sempre por conteúdo: `git diff --quiet origin/main <commit> -- <caminhos>`, `git grep` ou `git cat-file -e` em `origin/main`, como o G1 da P3 já faz; nunca por ancestralidade de hash local (`rev-list --count`, `merge-base --is-ancestor`), porque o commit que chega por árvore de lote é cópia com outro hash e o original nunca vira ancestral de `origin/main`. Medido em 13/10: `competitors/actions.ts` é igual nos dois lados e `rev-list --count` dá 1; `7f28d3de` (E19) não é ancestral de `origin/main`, onde a cópia é `41e563bc`. Depois de cada envio, `git merge origin/staging` no local, sem agente commitando.** A regra de nascimento continua, como segunda trava (outra trilha commita o mesmo arquivo por caminho, e a lista de um lote pode puxá-lo): nenhum commit que leia tabela, coluna ou função nova nasce antes de a migration dela estar em produção e conferida: Tarefas 4a, 4b, 9 e 11b da E10 (MG6), Tarefa 7 da E18 (MG12), Tarefa 3 da ordem 23 (MG17a), Tarefa 8 em diante da E9 (MG18), **e a Tarefa 11 da E4 (MG4) (emenda 2: D2-m6: ela põe `marcas_de_idade` no catálogo da agenda e, sem a MG4, devolve `schema_ausente` todo dia; alternativa escrita no plano: `OBS_AGENDA_TASKS_OFF=marcas_de_idade` gravada antes do envio).** "Pronto e sem commit" também não serve: outra trilha commita o mesmo arquivo por caminho.
2. **Teste de integração só vai a push junto do arquivo da migration que ele lê** (P3 e ordem 23), porque a CI roda `test/integration/` inteira com banco. **(emenda 1: S-C1, S-I3) Vale também para os que já estão commitados (`a5-e11-*`, `a5-e6-e8-schema`) e para o teste da lista fechada da E10, cuja lista inicial cita funções da MG14 e da MG7.**
3. **Arquivo de migration destrutiva é arquivo armado** (R14): entre o `db:new` e a aplicação, nenhum outro `db:new` nem `db:push:prod`; recusou e não vai ser reaplicada no mesmo dia, o arquivo sai por commit. **(emenda 1: D-I2) As listas fechadas da E10 e do passo 0 da E17 se acertam no commit do arquivo e se conferem ~~no `bythiago_int`~~ antes de armar, nunca depois.** **(emenda 2: D2-m3) "Conferir" é rodar a consulta de catálogo de cada teste dentro da mesma transação desfeita em que o teste da tarefa aplica o ensaio. Migration destrutiva nunca é aplicada de forma persistente em banco local antes de produção verde (regra que a P3 e a ordem 23 já tinham e que a redação da emenda 1 contradizia). Para a MG17a, aditiva, a aplicação no `bythiago_int` pelo controlador continua valendo.**

---

## 4. Os conflitos, com a decisão

Os números de linha são os de antes das emendas; o trecho citado acha a frase. "Emenda" lista onde o texto mudou; o antes e o depois, linha a linha, estão em `emendas-r1.md`.

### R1. O registro do export (E10) não conhecia a segunda tabela da E4, e a ordem MG6 × MG4 (conflito (a) do pedido)

- **E10, seção 2:** "Pode ir no mesmo `db:push:prod` da MG4 (o spec permite), em qualquer ordem entre as duas. […] A ordem é livre **porque** a tabela que a MG4 cria (`competitor_video_marks` […]) já está no registro do export da MG6." V2: "Esperado: `{}` (lista vazia) e `20`".
- **E4, seção 0.1, dependência 3:** "A MG4 cria **duas** tabelas com cascata para `competitor_videos`; o registro do export […] tem de conhecer as duas, e o plano da E10 só tem `competitor_video_marks`" e, como saída de reserva, "a MG4 recria `obs_archive_registry()` no fim do próprio arquivo".
- **Conferido:** `obs_archive_uncovered()` (Apêndice A da E10) percorre toda chave em cascata a partir de `competitor_channels`; com as duas migrations aplicadas e sem a entrada ela devolve `{competitor_video_mark_misses}`, o export e a remoção recusam e uma linha sai em `acao_do_dono` a cada disparo.
- **Decisão:** o registro é definido **uma vez só, na MG6**, com todas as tabelas que a A5 já sabe que terá (22: R2 acrescenta a da E9); tabela ausente é pulada, como o plano já fazia para `competitor_video_marks`. Nenhuma outra migration recria a função. **Por quê:** a alternativa (cada migration recria o registro a partir da sua cópia) é o caso clássico de `create or replace` em que a última a rodar apaga a entrada da outra, e aqui haveria duas candidatas (MG4 e MG18). A ordem MG6 antes da MG4 fica dura por causa da R3.
- **Emendas:** E10 (seção 2, V2, tabela de arquivos compartilhados, tabela de funções da Tarefa 1, Apêndice A, Tarefa 1); E4 (0.1 dependência 3, V5, Tarefa 9).
- **Não provado:** as duas entradas novas do registro não foram rodadas.

### R2. A tabela da E9 também cai fora do registro do export

- **E9, seção 2:** a migration cria `competitor_missing_baseline` com `video_id` em cascata para `competitor_videos`; o plano não cita `obs_archive`, MG6 nem registro (busca textual: zero).
- **E10, seção 9:** "toda migration futura que crie tabela com chave em cascata para `competitor_channels`, `competitor_videos` ou `competitor_video_comments` […] **recria `obs_archive_registry()` no mesmo arquivo**".
- **Decisão:** a entrada de `competitor_missing_baseline` nasce na MG6 (chave `video_id, missing_since`, lida do Apêndice A da E9); a MG18 não recria nada e roda a V2 da E10 depois de aplicar. Exportar o piso em vez de excluí-lo é a escolha que não perde dado. **Risco aceito, o mesmo que a E10 já aceitava para as marcas:** a entrada foi escrita para uma tabela que não existe; se a chave mudar na Tarefa 1 da E9, o primeiro export depois dela falha com erro visível.
- **Emendas:** E10 (Apêndice A, mesmas da R1); E9 (seção 2, "Janela").

### R3. A pausa de coleta (E10) e as marcas e medidas (E4): contrato pedido por um plano e ignorado pelo outro

- **E10, seção 9:** "**contrato novo desta etapa:** não gravar linha de canal com `collection_paused_at` preenchido; senão a remoção recusa por contagem diferente". E no topo: "O motivo 'não medido: coleta pausada' nas telas. Este plano grava o histórico das pausas; quem lê e mostra é a etapa das medidas e marcas (E4)".
- **E4, seção 4.2 e 6.1:** `leitura_parou_antes` é "a última leitura é anterior ao instante alvo (vídeo que saiu do YouTube, canal pausado)", e par com esse motivo, série anterior ao alvo e vídeo no ar "conta em `perdidas`" e deixa o disparo "**vermelho, uma vez**: `marcas_perdidas`". O plano não lê `collection_paused_at` nem tem motivo de pausa (34 códigos, nenhum de pausa); M8 chama de `parado` o canal sem publicação há mais de `max(28, 4 × intervalo)` dias.
- **O que aconteceria:** o dono pausa um canal para exportar; a tarefa da E4 grava marcas e motivos nele (a remoção recusa com `banco_difere_do_manifesto`), acusa `marcas_perdidas` em vermelho por uma pausa feita de propósito, e semanas depois M8 e o Cowork (E7) dizem "parado" de um canal que só não está sendo lido.
- **Decisão:** (1) a MG4 exige a MG6; (2) par de canal pausado não é decidido enquanto a pausa durar; (3) depois de despausar, par cujo buraco cruza uma pausa registrada não conta como perda; (4) motivo novo `coleta_pausada` (35 códigos) e estado próprio para canal pausado. **Por quê:** é a opção que não afirma o que não foi medido ("parado", "perdida") e não grava em canal que a E10 está contando. Nada se perde: a série fica online e a decisão é refeita ao despausar.
- **Emendas:** E4 (0.1 dependência 3, tabela de 4.2, `M/tipos.ts` na Tarefa 1, `estadoDoCanal` na Tarefa 4, Tarefa 9); E10 (topo e seção 9); E7 (0.1 e 4.4: 35 códigos, `situacao` do canal pausado).
- **Não provado:** nenhum SQL nem teste. É a emenda de maior peso desta rodada e volta aos dois engenheiros na revisão da implementação da E4. **(emenda 1: D-I1, S-I2) Na rodada 0 ela só existia como parágrafo de 0.1: a Tarefa 9 da E4 mandava colar o Apêndice A, que não tem a pausa, e o `diff` vazio era o critério de pronto. Agora a Tarefa 8b da E4 escreve e roda o SQL antes da 9, o literal do estado é `'pausado'` e as chaves da prova são `pares_em_pausa` e `pausadas`.** (emenda 3: m2, n2) Pela emenda 2, `pausadas` não é chave da prova: o banco devolve `pares_em_pausa` e, por item, `gap_crossed_pause`, e quem conta `pausadas` é o escritor. E "buraco que cruza uma pausa", na decisão (3) acima, passou a ser "buraco cujo tempo não pausado cabe no limite do par": uma pausa curta dentro de um buraco longo não tira o par de `perdidas` (Tarefa 8b da E4, item 3). Não rodado.

### R4. Interruptor por variável da Vercel: "sem deploy" × "exige redeploy" (conflito (b))

- **E18, seção 2 ("Como voltar"):** "`YT_OWN_STEPS_OFF=versoes` na Vercel (vale na execução seguinte, sem deploy)"; a saída de emergência da Tarefa 7 dependia disso.
- **E11 (ontem), emenda I7:** "`YT_OWN_STEPS_OFF=dimensoes,normalizadores` na Vercel **e um redeploy de produção** (a variável só vale para deploys feitos depois da mudança; o deploy em pé continua com o valor antigo)". A ordem 23 e a E10 dizem o mesmo das variáveis delas.
- **Conferido:** `coleta/passos-desligados.ts` lê `process.env` a cada chamada, o que é verdade e não resolve: o valor de `process.env` de um deploy da Vercel é fixado no build.
- **Decisão:** vale o redeploy, para toda variável. ~~A saída de emergência da E18 passa a exigir que o redeploy **termine antes** do push que ela protege.~~ **(emenda 1: S-m1) Para a saída de emergência da E18 basta a variável gravada antes do push: o deploy que o push gera já nasce com ela. O redeploy é necessário quando a variável muda sem deploy novo (desligar um passo que já está em produção, ou religar).** Os planos da E4 (`OBS_AGENDA_TASKS_OFF=marcas_de_idade`) e da E9 (`OBS_PROVA_AUSENTES`) não diziam nada e ganharam a mesma frase.
- **Emendas:** E18 (seção 6 "Interruptor", Tarefa 7, seção 2); E4 (seção 2 "Volta"); E9 (seção 6); ordem 23 (dívida: marcada como corrigida).

### R5. Migrations fora das 17 do spec (conflito (c))

- **E9:** "Não tem número na tabela de migrations do spec (MG1 a MG17); chamo de **MG-E9** e o controlador numera." **E17 p0:** "O fechamento pede código e migration que não estão na MG11 nem em etapa numerada do spec." **Ordem 23:** "A tabela de migrations do spec (16 linhas) precisa de uma linha a mais."
- **Decisão:** MG17a mantém o nome; a da E9 é **MG18**; a do fechamento do CMS fica com o número **MG19** reservado, sem desenho. A tabela da seção 1 é a tabela única. A MG2b (corretiva, de ontem) também está fora das 17 e entra nela.
- **Emendas:** E9 (seção 2), E17 p0 (lista do que não faz), ordem 23 (dívida).

### R6. Duas listas fechadas do que apaga, cada uma cega para o que os outros planos criam; e uma poda por idade que a E10 não viu

- **E10, Tarefa 10:** o teste estático "passa no código de hoje com as **seis** ocorrências de cliente em cinco pares" (F18) e afirma "`nenhum par com disparo "cron" aponta para tabela de série`", com `competitor_channel_snapshots` no conjunto proibido; o de integração casa toda função `competitor_*`, `yt_*` e `obs_*` com `delete from` contra a lista.
- **E9, Tarefa 11:** o conjunto de funções SQL que apagam de `competitor_*` "tem de ser exatamente" o das três funções dela mais duas antigas; e "a prova do `ab-watchdog` já está em produção e apaga `competitor_channel_snapshots` > 365 dias".
- **Conferido no código:** `apps/web/src/app/api/cron/ab-watchdog/route.ts:205-208` faz `.from('competitor_channel_snapshots').delete().lt('snapshot_date', oneYearAgo)`. A E9 está certa; a F18 da E10 não tem essa ocorrência, e a pasta está fora do alcance do item 231. O item 78 ("nenhum caminho desta fase apaga série por idade") sairia verde com uma poda por idade em produção, numa tabela que 9.2 do spec diz que "nunca sai do online".
- **Cruzamentos:** `competitor_channel_remove_archived` (MG6) e `competitor_marks_apply` (MG4) têm `delete from competitor_*` e quebram o teste da E9; as funções de apagar da E9 (MG18), `competitor_marks_apply` (MG4) e `yt_own_meta_cover` (MG17) quebram o de integração da E10. A ordem 23 dizia que os apagamentos dela estavam "fora do alcance" do teste da E10: só do estático.
- **Decisão:** cada plano acrescenta os seus pares nas listas dos outros no commit da própria migration; quem chegar antes de o teste existir deixa o par na fila do ledger comum. A varredura da E10 passa a incluir o `ab-watchdog`, e a poda entra como **exceção declarada com pergunta ao dono (R-A)**, em vez de passar por não ser vista. **Por quê:** teste verde que não enxerga é afirmação não medida. Nada se apaga antes de o retrato mais antigo fazer 365 dias; a C-5 da E4 dá a data por canal.
- **Lacuna que fica:** as funções temporárias da MG15, da MG16 e da dieta da MG17 nascem e somem no mesmo arquivo; nenhum dos testes as vê. Os três pares de arquivo ficam declarados em `.superpowers/sdd/a5/fila-do-db-push.md`.
- **(emenda 1: S-I3, D-I2) Faltava uma função e faltava o lugar.** `yt_own_meta_cover_set` (MG17a) também tem `delete from` numa tabela `yt_*`. E a obrigação estava em seção de dívida: passou para dentro das tarefas que criam cada arquivo (ordem 23, Tarefas 13, 14 e 15; P3, Tarefa 6), com conferência no `bythiago_int` antes de armar.
- **Emendas:** E10 (Tarefa 10), E9 (Tarefa 11), E4 (Tarefa 9), ordem 23 (dívida), P3 (dívida).

### R7. `removeCompetitorChannel` é editada por dois planos

- **E10, Tarefa 11b:** "o `delete` direto sai; entra `removerCanalArquivado(…)`" e o teste `o delete direto não existe mais`.
- **E9, Tarefa 9:** "Depois da guarda e antes do `delete`: lê `missing_since` do canal […]"; e a lista fechada dela exige o par `competitors/actions.ts` (remover canal no ar).
- **Decisão:** forma final única: guardas de acesso, recusas da E9, chamada da E10. Em qualquer ordem de chegada; a segunda mantém o trecho da primeira. Com a 11b aplicada, o par sai da lista da E9.
- **Emendas:** E10 (Tarefa 11b), E9 (Tarefa 9).

### R8. "Apagar" da fila × arquivo já exportado: cada plano deixa para o outro

- **E10, runbook e riscos:** "A resposta 'apagar' da fila (E9) tem de alcançar esta pasta também, além do NAS" e "(o expurgo no arquivo não é deste plano)".
- **E9, lista do que não faz:** "O export para o NAS e os comandos de apagar lá […]: dependem da E10 e da MG6, que não existem. Nesta fase `archive_pending` é sempre `false` e a tela diz que não há exportação".
- **O que aconteceria:** a E10 vem antes (ordem 15 contra 18). Um canal é pausado e exportado; antes de ser removido, sai do YouTube; o dono responde "apagar" na fila. O banco apaga, a tela diz "não há exportação", e o texto de comentários de terceiros continua no NAS e na pasta local.
- **Decisão:** a E9 passa a contar os lotes exportados do canal e a dizer na tela que o "apagar" não os alcança; `archive_pending` continua `false` (ligá-lo sem o botão "Já rodei" deixaria o cron vermelho para sempre). Apagar do NAS continua sem dono: vira a **pergunta R-B**. **Por quê:** não dá para implementar o expurgo do arquivo numa emenda; dá para não afirmar que não há arquivo.
- **Emendas:** E9 (lista do que não faz), E10 (Tarefa 12).
- **Não provado:** o SQL da contagem de lotes não está escrito. **(emenda 1: D-I1, S-m7, D-m4) Passou a estar descrito na Tarefa 1 da E9: `count(distinct batch)` (a tabela tem uma linha por lote, tabela e período), `null` com a tabela ausente, e o "apagar canal" encerra os lotes abertos com `closed_reason = 'canal_apagado'`, valor que a MG6 passa a aceitar. Continua não rodado.**

### R9. Dois apagadores de miniaturas no Blob, um sem a guarda do outro

- **E10, Tarefa 10:** a varredura de `del(` "tem **uma** linha: `lib/youtube/observatorio/arquivo/remover.ts`". **E9, Tarefa 5:** cria `saiu/blob.ts` com `del` e `list`, e uma guarda de `OBS_E2E` porque o `.env.local` do Playwright tem o token de produção do Blob.
- **Decisão:** o apagador da E10 ganha a mesma guarda, com teste; o segundo a chegar reusa o filtro de prefixo do primeiro; a lista da E10 terá dois pares.
- **Emendas:** E10 (Tarefa 11a), E9 (Tarefa 5).

### R10. As listas do passo 0 da E17 ficam vermelhas para todo plano que cria tabela, e nenhum sabia

- **E17 p0, seção 9:** os dois testes ficam "**vermelhos de propósito** no push dessa trilha até alguém classificar o objeto novo […]. O controlador avisa isso nos planos da MG12 em diante".
- **E18, E10, E4, E9:** nenhum cita os testes (busca textual por `-doze`, `reporter-banco`, `PODEM_FALTAR`: zero nos quatro).
- **Decisão:** a obrigação foi escrita na tarefa da migration de cada um. O mesmo para o teste de ações (`acoes-recusam-leitora.test.ts`), que não enxerga `_saiu/actions.ts` da E9.
- **Emendas:** E18 (Tarefa 1), E10 (Tarefa 1), E4 (Tarefa 9), E9 (seção 2 e Tarefa 9), E17 p0 (seção 9).
- **Fica com o controlador:** MG5 e MG7 (planos de ontem) não foram avisados por emenda. (emenda 1: D-I2) MG15, MG16, MG17 e MG17a passaram a ter a obrigação dentro da tarefa do arquivo.

### R11. O leitor de versões (E18) e a troca do token (E17 p0)

- **E18, Tarefa 9:** "sem token válido (`edicaoValida(p.edicao)` falso) devolve `{ acesso: 'negado' }` […] quando a E17, passo 0, trocar `Pedido` para o token de leitura privada, este leitor acompanha sem mudança."
- **E17 p0, Tarefa 6:** troca o campo `edicao` de `Pedido` por `leitura`, com lista fechada de oito arquivos de `src` que não inclui o leitor da E18.
- **Decisão:** quem vier depois adota o token novo: se a Tarefa 6 da E17 já existir, o leitor nasce com `leituraValida(p.leitura)`; se não, a Tarefa 6 inclui o arquivo. O `tsc` pegaria o erro de qualquer jeito; a emenda evita que ele apareça como arquivo "fora da lista".
- **Emendas:** E18 (Tarefa 9), E17 p0 (Tarefa 6).

### R12. "O código da E1 não está em `main`" (E9) × o pedido

- **E9, 0.1:** "`main` = `4a9387ac` (12/10, 19:15), que **não contém** […] `competitor-capture.ts`". **Pedido e E7 (P-8):** Lote 1 de E1/E2 em produção; `origin/main` local `6d63f387`.
- **Conferido:** `git log -1 origin/main` = `6d63f387`, 13/10 12:27; `git cat-file -e origin/main:apps/web/src/lib/youtube/competitor-capture.ts` passa. A leitura da E9 era anterior à promoção.
- **Emenda:** E9 (0.1). A condição do Envio A (lote B e A4 em `main`) não muda.

### R13. Agenda: duas tarefas leves novas, e a soma de tempo que cada plano fez sozinho

- **E4, desvio 19:** "pior disparo […] 25 + 10 + 10 + 5 + 5 + 150 = 205 s […] com a tarefa nova, 215 s", e a lista de ordens "hoje `[1, 2, 5.5, 6, 7, 8]`".
- **E10, 5.2:** `tamanho_do_banco` gasta até 10 s da medida e mais "20 s **no total**" na nova tentativa das miniaturas, contra os 5 s que a conta do spec lhe dá.
- **Decisão:** ordem de chegada E10 T9, depois E4 T11; a soma nominal das leves é 90 s e o pior disparo nominal 240 s, não 215. Cabe por construção (seção 5), e a consequência fica escrita: quando as duas coincidem, `marcas_de_idade` é a adiada.
- **Emendas:** E4 (desvio 19 e Tarefa 11).

### R14. A fila do `db push` e a janela

- **P3, seção 2:** "**Nenhum outro `db:push:prod`, de lote nenhum** […] 'MG15 pendente: db push bloqueado' no ledger comum" e "nenhum outro `db:new`". **Ordem 23:** o mesmo para MG16 e MG17.
- **E10, E4, E9:** criam arquivo de migration "na vez dela" sem olhar ledger nenhum. Janelas: E10 e E9 dizem 11:55 a 12:15 UTC; E17 p0 e P3, 11:30 a 13:00; E18 dizia 11:55 a 12:15 para uma migration que vai no mesmo push da MG11.
- **Decisão:** um arquivo só para a fila (`.superpowers/sdd/a5/fila-do-db-push.md`), conferido antes de todo `db:new`; janela comum, a mais estreita.
- **Emendas:** E10 (Tarefa 1), E4 (Tarefa 9), E9 (seção 2), E18 (seção 2 "Janela"), P3 (seção 2).

### R15. A MG17a: onde entra, e o pedido de mudar a MG14

- **Ordem 23:** "a MG17a pode ir junto do lote C, se o carimbo dela for posterior ao da MG14" e "(prioridade alta […]) Pedir ao plano irmão que a MG14 já nasça com `data_api` e `imagem` no `check` de `source`".
- **E17 p0 e E18:** "Ordem de aplicação do lote C, fixada pelo controlador: MG14, **MG11**, MG5, MG7, MG12."
- **Conferido:** `.superpowers/sdd/a5-e6-e8/sql/mg14.sql:29` tem `check (source in ('analytics_api', 'reporting_api'))`.
- **Decisão:** se for no lote C, a MG17a é a sexta e última (emenda 1: D-C1, S-C1: com o lote partido, a terceira e última do C2; a MG14 já estará em produção desde o C1). A MG14 **nasce como foi provada**: é SQL de ensaio de um plano em execução, e o bloco 1 da MG17a funciona nos dois casos. O custo (trava exclusiva nos testes da ordem 23) se paga rodando-os em série. O controlador pode rever.
- **Emendas:** ordem 23 (seção 2 e dívida).

### R16. Variáveis novas fora de `docs/ops/env-vars.md`

- **`CLAUDE.md`:** "Lista completa, flags operacionais e o detalhe de cada variável: `docs/ops/env-vars.md`." A E9 acrescenta a linha dela; a ordem 23 (`YT_OWN_META_DIETA_OFF`) e a E10 (`OBS_ARQUIVO_DB_URL`) só citavam o runbook.
- **Emendas:** ordem 23 (seção 6), E10 (Tarefa 12).

### Conferido e sem conflito (para ninguém procurar de novo)

- **`youtube_channel_removal_impact`** é recriada por MG9, MG14 e MG7, as três com o mesmo "corpo único" por catálogo (decisão do controlador, de ontem; textos idênticos, conferido por md5); a guarda da MG12 passa com qualquer uma. O spec dizia que a MG12 "não depende de nada": depende desse corpo, que já está em produção.
- **As quatro funções remendadas pela MG6** não são recriadas pela MG4 nem pela MG18.
- **A dieta (MG15, MG16, MG17) só apaga em `yt_own_*`.** O risco 7 da E9 ("migration futura da dieta que apague versão redundante de vídeo ausente") não se aplica aos planos de hoje.
- **A MG11 não troca a policy de `competitor_removed_items`** (a lista dela são doze tabelas, e essa não está): a CP10 da E9 continua valendo como conferência.
- **Comentário de `yt_own_video_daily`:** a P3 usa a marca do dia e a retira; a MG16 usa a mesma tabela para a marca dela. Não colidem porque nunca são armadas no mesmo dia (CP8 da ordem 23 confere).
- **Orçamentos da forja** (20 min, 25 min, 30 min, 70 min): nenhum plano toca. A E9 acrescenta um quarto dependente (a janela da recusa de "apagar" = `STALE_AFTER_MINUTES`), com teste que acusa se divergir.
- **Pedidos da E7 à E4** (`marcas: 'nao_pedida'` no montador; tempo limite por consulta nos leitores): são economia, não conflito. A E7 funciona sem eles. Não foram levados ao plano da E4; ficam com o controlador.
- **`obs_archive_is_site_admin` (MG6) e `is_org_admin_as` (MG11)** respondem perguntas parecidas com corpos próprios. Não colidem; é duplicação a unificar depois do lote C.

### Emenda 1: o que a rodada 1 dos pareceres mudou

Os dois pareceres reprovaram a rodada 0 (dados: 1 crítico, 2 importantes, 8 menores; software: 1 crítico, 3 importantes, 7 menores). Dos 22 achados, 21 procedem e 1 não (S-m6, com a prova em `.superpowers/sdd/a5-planos-onda-2/reconciliacao/resposta-r1.md`). As marcas nos planos são "(reconciliação 13/10, emenda 1: <id>)"; D- é o parecer de dados, S- o de software.

- **D-C1, S-C1, S-I1 (ordem de envio).** Seção 3 refeita: lote C partido em C1 (MG14, MG5, MG7) e C2 (MG11, MG12, MG17a); push único do `staging` local depois do C1 e do leitor tolerante; dois caminhos escritos para a Tarefa 12 da E4. A tabela da seção 1 foi reordenada. Emendas: E4 (linhas do "envio próprio" e o "Envio" da Tarefa 12), E18, E17 p0 e ordem 23 (a frase da ordem do lote C). **Fica com o controlador:** o aval da nova ordem; avisar os planos de ontem, que não foram tocados (a V2 da E11 espera `can_view_private_site` "porque a MG11 vem antes da MG7" e passa a ver `can_edit_site` até a MG11 entrar, caso que aquele plano diz ter rodado).
- **D-I1, S-I2 (R3 dentro das tarefas).** A pausa de coleta saiu do parágrafo de 0.1 e entrou nas tarefas da E4: Tarefa 8b nova e bloqueante (reescreve e roda o Apêndice A com a pausa, com a MG6 aplicada antes, e pede o acordo dos dois), Tarefa 4 (literal `'pausado'` fixado, precedência, quatro testes), Tarefa 9 (o arquivo é o Apêndice A depois da 8b), Tarefa 10 (duas chaves, dois testes), Tarefa 13 (`collectionPausedAt`), 6.1 (chaves `pares_em_pausa` e `pausadas`). A E7 passou a citar o literal fixado. **Continua não provado:** nenhum SQL foi rodado nesta emenda; a 8b é quem prova.
- **D-I1, S-m7, D-m4 (R8 dentro da tarefa).** A Tarefa 1 da E9 ganhou o SQL de `lotes_exportados` (`count(distinct batch)`, `null` com a tabela ausente) e o encerramento dos lotes abertos no "apagar canal" (`closed_reason = 'canal_apagado'`); a Tarefa 1 da E10 alarga o `check` para aceitar o valor. **Não provado.**
- **D-I2, S-I3 (listas fechadas dentro das tarefas das migrations).** Ordem 23, Tarefas 13, 14 e 15, e P3, Tarefa 6: par e classificação no commit do arquivo, conferidos no `bythiago_int` antes de armar; conferência a mais nos portões P e D, sem número. Faltava uma função na R6: `yt_own_meta_cover_set` (MG17a) tem `delete from public.yt_own_video_coverage` (Apêndice A da ordem 23); o par entrou na Tarefa 13 de lá e na Tarefa 10 da E10. O teste de integração da E10 passa a depender do lote C1.
- **S-m1 (R4, a saída de emergência da E18).** A decisão da R4 exigia um redeploy que terminasse antes do push protegido. Não precisa: a variável gravada vale para o deploy que o push gera. O redeploy continua necessário para tirar a variável e para qualquer mudança que não venha acompanhada de deploy. Emenda: E18, Tarefa 7.
- **S-m2:** a sobra da Tarefa 9 da E4 que mandava a MG4 recriar o registro foi riscada.
- **S-m3, D-m8:** o nome `.superpowers/sdd/a5/fila-do-db-push.md` foi escrito na E10 (Tarefa 1), na E4 (Tarefa 9), na E9 (seção 2) e na ordem 23 (A4, P10, Tarefas 14 e 15). O arquivo tem duas seções: "db push bloqueado" e "pares e classificações pendentes". **O controlador cria o arquivo vazio já.**
- **S-m4:** a "Janela e travas" da E10 remete à janela comum.
- **D-m1, D-m3, S-m5:** seção 5 corrigida (a reserva do cron do canal próprio, o rótulo de estimativa, o teto de 60 s da leitura horária).
- **D-m2:** a data da R-A se prova sem produção (01/06/2027); a CP15 saiu do "hoje".
- **D-m5, D-m6:** frase no runbook da E10 sobre a corrida de 20 minutos; o portão D8 da ordem 23 confere também o deploy em pé.
- **D-m7:** o md5 do corpo único foi refeito com o comando escrito (seção 1).
- **D-m8 (contagem):** as "51 emendas" da rodada 0 são linhas de `emendas-r1.md`; as marcas nos planos são 53, porque duas emendas têm duas marcas. A emenda 1 acrescentou 40 marcas em oito planos (`grep -o "reconciliação 13/10, emenda 1" docs/superpowers/plans/2026-10-13-a5-e*.md | wc -l`).
- **Não procede, S-m6:** `catalogoCompleto()` de `apps/web/test/youtube/agenda/despachante.test.ts:36-47` já tem as oito ordens do spec, com `tarefa('tamanho_do_banco', 4, …)` na linha 41; com `marcas_de_idade` são nove, como o plano da E4 diz. A Tarefa 9 da E10 não acrescenta nada a essa função (busca por `catalogoCompleto` no plano da E10: zero).

### Emenda 2: o que a rodada 2 dos pareceres mudou

Dados: CONCORDO, com 9 menores. Software: NÃO CONCORDO, com 1 crítico, 2 importantes e 4 menores. Os 16 procedem (dois com a correção ajustada: D2-m8 e D2-m9). As marcas nos planos são "(reconciliação 13/10, emenda 2: <id>)"; D2- é o parecer de dados da rodada 2, S2- o de software. A resposta, achado por achado, está em `.superpowers/sdd/a5-planos-onda-2/reconciliacao/resposta-r2.md`.

- **S2-C1 (crítico; o "fato que manda" da seção 3 era falso).** O `staging` local não é uma linha só (4 junções) e o envio deste programa é por árvore de lote. A árvore `refs/remontagem/lote-b-mais-lote2` tem o lote B e o Lote 2 sem nenhum arquivo que leia MG14, MG5 ou MG7. Passo 1a novo: lote B mais Lote 2 vão já, sem esperar o C1, a A4 nem o leitor tolerante. O passo 2 deixou de ser "push único" e ficou só com o lote do canal próprio. Regra 1 reescrita, com a conferência por árvore. Emendas nos planos: E17 e E18 (a frase "antes de qualquer push"), E4 (Tarefa 12).
- **S2-I1, D2-m5 (Tarefa 12 da E4).** Quem escolhe o caminho é a C-14, não a C-16; o envio por árvore própria é a regra quando a C-14 dá linha, e é decisão do controlador; a condição "`git diff` vazio" era falsa e foi trocada pela do próprio plano.
- **S2-I2, D2-m4 (a pausa na Tarefa 8b da E4).** O item 3 nomeava uma função que não existe e mandava o SQL tirar o par de `perdidas`, que é contada no TypeScript. Contrato fechado nas quatro pontas: `gap_crossed_pause` por item e `pares_em_pausa` em `competitor_marks_pending`; `atrasadas` sem canal pausado em `competitor_marks_health`; `cruzouPausa` em `PendenteDeMarca`, `marcaPerdida` falso com ele, `pausadas` contado no escritor; testes das Tarefas 2, 8b e 10 renomeados para partir do pendente e não do número pronto. O `check` de `reason` fica com seis valores, a confirmar na 8b. **Não rodado.**
- **D2-m1 (sobras da ordem velha do lote C).** E17 (carimbo "anterior ao da MG5", "segunda migration", "as cinco", a narrativa do D0, a Tarefa 1b) e E18 ("quinta e última", "as cinco", os arquivos que "já existem", a prova contra a MG11). **Fica com o controlador, porque o brief não nomeia os planos de ontem:** E11 de 12/10, linhas 90, 367, 431 e 434 (esperam o arquivo da MG11 antes de criar o da MG7; com o C1, a MG7 nasce sem ele) e E6/E8 de 12/10, linha 403 ("(a MG11, do plano dela)" entre a MG14 e a MG5). Sem esse aviso, o agente da Tarefa 1 da E11 para à espera de um arquivo que só nasce no C2.
- **D2-m2, S2-m2:** o terceiro valor de `closed_reason` foi escrito no Apêndice A da E10, com restrição nomeada e `drop` + `add`. Não rodado.
- **D2-m3:** a conferência a mais dos portões das destrutivas (P3, MG16, MG17) passa a ser feita dentro da transação desfeita do ensaio; a redação da emenda 1 pedia aplicação persistente, que os mesmos planos proíbem. Regra 3 da seção 3 corrigida.
- **D2-m6:** a Tarefa 11 da E4 entrou na lista da regra 1 e nas "Ondas" do plano.
- **D2-m7, S2-m1:** E7 com `'pausado'` nos dois tipos, a regra (a) com a exceção, 35 códigos na Tarefa 10 e um teste nomeado na Tarefa 12.
- **D2-m8:** seção 5 e P12 da E18. A condição "parte antiga abaixo de 17 s" não se media (emenda 3: n1: media-se, pela coluna `ms_existente`; a P12 é que não a pedia) e, pelo número do plano de ontem (23,7 s), já era falsa: o pior caso nominal não cabe por cerca de 7 s, e o que segura é o relógio e a folga real (88 a 102 s de 270 s). A correção pedida pelo parecer ("`ms_total` menos a soma de `ms_passos`, menor que 17 s") reprovaria o passo de versões sem motivo com esse mesmo número; a P12 passou a descontar só os passos de fim.
- **D2-m9:** o esperado de `apagadas` na primeira execução do coletor novo cresce com os dias entre o C1 e o passo 2 (cerca de 35 por dia; o parecer estimou 28; os 280 são 35 vídeos × 8 dias, do plano de ontem). Frase no passo 2.
- **S2-m3:** as três tarefas que criam os testes de lista (E10 Tarefa 10, E17 passo 0 Tarefa 3, E9 Tarefa 11) passam a ler a seção "pares e classificações pendentes" de `.superpowers/sdd/a5/fila-do-db-push.md`. **O arquivo continua sem existir: o controlador cria.**
- **S2-m4:** título do Grupo 3, a precedência velha riscada em E4 (Tarefa 4), a janela da promoção separada da janela do `db:push:prod` na ordem 23.
- **Contagem:** 36 marcas em oito planos (`grep -o "reconciliação 13/10, emenda 2" docs/superpowers/plans/2026-10-13-a5-e*.md | wc -l`; E4 9, E17 passo 0 8, E18 6, E7 5, E10 3, ordem 23 3, P3 1, E9 1), e 23 linhas deste documento com "(emenda 2: …)". Nenhum código, teste ou migration foi alterado; nada foi rodado em banco nem lido em produção.

### Emenda 3: o que a rodada 3 dos pareceres mudou

Dados: CONCORDO, com 6 menores (n1 a n6). Software: NÃO CONCORDO, com 2 importantes (I1, I2) e 4 menores (m1 a m4). Os 12 procedem; nenhum foi contestado. As marcas nos planos são "(reconciliação 13/10, emenda 3: <id>)". A resposta, achado por achado, com a lista das ocorrências do termo antigo que sobraram e por que podem ficar, está em `.superpowers/sdd/a5-planos-onda-2/reconciliacao/resposta-r3.md`.

- **I1 (a conferência de envio da E9 contava por ancestralidade).** No envio por árvore de lote o commit que chega a `main` é cópia com outro hash; `git rev-list --count origin/main..<commit>` nunca dá 0 e o Envio A esperaria para sempre. Refeito aqui, só leitura: `competitors/actions.ts` é igual em `origin/main` e no `staging` local (`git diff --quiet`: 0) e a contagem dá 1; `competitor-sync.ts` é igual em `refs/remontagem/lote-b-mais-lote2` e no local, e a contagem contra `origin/main` dá 18. Emendas: E9 (seção 2, passo 1; "Por último" das ondas; "Antes" do Envio B), regra 1 da seção 3 (a E9 entrou na lista; frase geral: conferência de "já está em `main`" é sempre por conteúdo) e o passo 9.
- **m1 (a mesma falha na E7).** `git merge-base --is-ancestor 7f28d3de origin/main` responde `nao` com a E19 em produção (a cópia em `main` é `41e563bc`). A P-6 da E7 passou a `git cat-file -e <hash-de-main>:apps/web/src/lib/pipeline/leitura-registro.ts`, arquivo que nasce naquele commit (medido: existe em `origin/main`). A linha do "fato que manda" da seção 3 que usava `is-ancestor` ganhou a prova por conteúdo.
- **I2 (os arquivos do C1 não chegavam à árvore que vai à CI).** Lido nos planos de ontem, sem suposição: o da E6/E8 manda os arquivos da MG14 e da MG5 num envio só deles (Tarefa 15, lote "M": "Três envios de código e um de migrations, cada um por lista explícita de commits", com CI e promoção), antes do lote E8-coleta; o da E11 **não** tem envio próprio para o arquivo da MG7: a Tarefa 1 termina em "Commit local" e o arquivo só sobe na Tarefa 14, com o código ("todos os da tabela da seção 9"), que pede o lote C em produção e os lotes de E12, E20 e E1/E2 em `main`. Então a MG14 tinha caminho escrito e a MG7 não, e a lista F17 da E10 cita cinco funções da MG7: o achado fica importante. Decisão: a saída (a) do parecer. O passo 1 ganhou a segunda metade (os três arquivos `.sql` do C1 vão a `origin/staging` por árvore própria, ou dentro da primeira árvore de código que precisar deles), o passo 7 voltou a dizer do que a Tarefa 10 da E10 depende, a regra 1 ganhou o item (iii) e "no repositório" virou "na árvore do lote" (seção 2 e E10, Tarefa 10). O que isso muda nos planos de ontem está na seção 8.
- **m2, n5 (sobras de texto da emenda 2).** "Caminho crítico": "push único" virou "lote do canal próprio (passo 2)". E4: as três frases erradas da emenda 1 no "Envio" da Tarefa 12 foram riscadas (o texto que vale é o das quatro correções), e as duas frases que davam `pausadas` como chave da prova foram corrigidas (0.1 e Tarefa 9); a mesma frase na R3 deste documento também. E17: "antes da MG12" só vale se as duas forem no mesmo `db:push:prod`.
- **m3 (Tarefa 12 da E4).** No caminho (a), a árvore do passo 1a com a tarefa dentro é árvore nova e a suíte roda de novo nela; no (b), as quatro `refs/remontagem/*` ficam 1 commit atrás e a remontagem do 1a é certa. Escrito na seção 3 e no plano.
- **m4, n5 (contagem).** `git rev-list --count origin/staging..staging` dá 322 agora (entrou um commit de documentação). Os números de `git` da seção 3 são retrato de 13/10 e o controlador repete a medida no dia; a frase ficou escrita no primeiro deles.
- **n1 (a parte antiga da rota é medida).** `yt_own_collection_runs.ms_existente` existe desde `20261008000002_coleta_canais_proprios_l1b.sql:71` e a rota a grava (`sync-analytics-metrics/route.ts:599` e `:619`, lidos nesta rodada). A seção 5 dizia "não medida" em três lugares: corrigidos. A P12 da E18 passou a trazer a coluna; a regra de decisão dela não muda.
- **n2 (`gap_crossed_pause` absolvia o buraco inteiro por qualquer pausa).** A definição da Tarefa 8b da E4 passou a ser: o tempo NÃO pausado do buraco cabe no limite do par. Um teste nomeado a mais: `despausado: pausa curta dentro de buraco longo continua em perdidas`. **Não rodado;** vai aos dois especialistas na 8b, que continua bloqueante.
- **n3 (par E7 × E10 que ninguém tinha lido).** Canal pausado segura `lido_ate.mais_antigo` e mascara canal parado por falha. Entrou como dívida 12 da E7, presa à MG6 em produção, com o campo `canais_pausados` e o teste nomeado.
- **n4 (os planos de ontem com a ordem velha do lote C).** Seção 8, nova: "Avisos aos planos de 12/10". O reconciliador continua sem tocar esses planos; o controlador leva o aviso aos ledgers **antes** de despachar a "Tarefa 1b".
- **n6 (arquivo ausente se lia como "nada pendente").** E10 (Tarefa 10), E17 passo 0 (Tarefa 3) e E9 (Tarefa 11): "arquivo ausente: parar e perguntar ao controlador; ausente não é vazio". `.superpowers/sdd/a5/fila-do-db-push.md` continua sem existir em 13/10: o controlador cria antes do primeiro `db:new`.
- **Mudança de tela aprovada pelo dono em 13/10 (não é achado de parecer): o mockup 18, em percentual.** O limite de 500 MB é do banco inteiro do site. No plano da E10, só o que a tela consome: a regra de cor passa a ser decidida sobre o inteiro mostrado (70 e 85; acima de 100, o percentual real), `RULES.dbSize` troca `yellowMb` e `redMb` por `yellowPct` e `redPct`, `SinalDoBanco` ganha `tela` (percentual, partes "do que está ocupado" e "do crescimento", MB só para o botão de informação), a `frase` passa a ser a do mockup e é a mesma na tela, em `acao_do_dono` e no e-mail, `LoteAberto` ganha quatro campos, a palavra "lote" sai das frases que chegam à tela (vira "exportação"; nomes internos não mudam) e a linha do NAS fica declarada como texto sem dado deste plano. O SQL da MG6 e o export não mudaram. **Três pontos em que o autor decidiu e que voltam aos especialistas na implementação:** o corte pelo inteiro adianta o amarelo e o vermelho em até 2,5 MB (pergunta E10-P10); o caso "uma parte encolheu e o banco cresceu" não está no mockup e o contrato devolve `parte_encolheu` sem percentual (E10-P9); e a frase de "ainda sem medida" promete a leitura do dia seguinte, quando no dia do deploy ela chega antes. **Nada disso foi rodado.**
- **Contagem:** ver `resposta-r3.md`, que traz o `grep` das marcas por plano. Nenhum código, teste ou migration foi alterado; nada foi rodado em banco nem lido em produção.

### Emenda 4: os menores do fecho (rodada 4 dos pareceres)

Dados: CONCORDO, 9 menores (p1 a p9). Software: CONCORDO, 5 menores (n1 a n5). Os dois deixaram a lista "para o controlador consertar sem nova rodada". Os 14 procedem; nenhum foi recusado. As marcas nos planos são "(reconciliação 13/10, emenda 4: <id>)". A resposta, um por linha, com o `grep` do termo antigo, está em `.superpowers/sdd/a5-planos-onda-2/reconciliacao/resposta-r4.md`. Nada rodado, nenhum código, teste ou migration alterado.

- **p1 (E10, Tarefa 8).** `periodoDe` e `periodoAte` saem só das linhas com período de verdade; linha de arquivo único (`1970-01-01`) fica fora, e lote só com arquivo único tem os dois nulos ("sem período"). O teste nomeado passou a ter a linha de `competitor_channels`, que é o caso que falha com a regra antiga.
- **p2, n1 (E10, Tarefa 9).** `ilegiveis` maior que zero gera linha própria em `acao_do_dono` em qualquer cor, inclusive verde; teste nomeado em `extras-arquivo.test.ts`.
- **p3 (E10).** A frase de `nunca_medido` só promete "A primeira leitura é em <dia>, às 05:00" com a medida agendada (`fraseDeNuncaMedido`); sem agenda, ou com mais de 72 h, a frase para na primeira oração e a linha diz o motivo. Pergunta nova ao dono: E10-P11.
- **p4, n3 (E10).** "Acima do limite" vale com qualquer valor acima de 500 MB, pelos bytes, mesmo com o inteiro em 100 (de 500,0 a 502,5 MB): pastilha "Banco do site: 100% do limite", rótulo "Acima do limite", frase sem segunda parte, `passouPct: 0`. Com o banco no limite ou acima a frase nunca leva segunda parte. **Isto corrige a frase do item "mockup 18" da emenda 3 acima ("acima de 100, o percentual real"): o percentual continua o real, mas o nível não espera o inteiro passar de 100.** Pergunta nova ao dono: E10-P12 (o texto da célula "Passou" com 0).
- **p5 (E10).** `Cresceu28d.medido` leva `medidas`; crescimento positivo que arredonda a 0,0 é `menos_de_um_decimo`, não `zero_medido`.
- **p6 (E10).** Desvio D16 na seção 8: limiares em MB do item 80 viraram o inteiro do percentual.
- **p7 (E10).** `diasAteOLimite` é arredondado ao inteiro mais próximo, e a comparação dos 90 dias usa esse inteiro (decisão desta emenda; o `bl.js` compara com fração). O teste saiu da borda: 1,36 MB por dia, 79 dias.
- **n2 (E10).** Dois testes: "do crescimento" com números (43, 31, 26; Observatório 74) e linha em que as partes somam mais que o banco.
- **n4.** `RULES.dbSize.limitMb` é que desce se o painel contar mais; os cortes são percentuais (seção 7, grupo 2, e a C2 da E10).
- **p8, n5.** `.superpowers/sdd/a5/fila-do-db-push.md` criado; a regra "arquivo ausente ou ilegível: parar e perguntar" repetida em E10 T1, E4 T9, E9 seção 2 e ordem 23 (A4, P10 e as duas tarefas que escrevem a linha).
- **p9 (E7, dívida 12).** Todos os canais pausados: `mais_antigo` e `mais_recente` nulos, `canais_pausados` igual ao total, com o caso no teste nomeado.

---

## 5. Soma dos orçamentos de tempo e de cota

Cada plano contou o seu. Somados:

**Cron de concorrentes (`/api/cron/sync-youtube`, a cada 20 minutos, função de 300 s).**

| Peça | De quem | Pior caso | Contra qual teto |
|---|---|---|---|
| Leves que o spec já contava (leitura horária 25 s, `anular_identidade` 10 s, `soma_do_mapa` 10 s, `podas` 5 s) | E16, E15, E14 | 50 s pela conta do spec. (emenda 1: S-m5) O código deixa a leitura horária ir até 60 s (`HORARIA_FIM_MS` em `agenda/relogio.ts:6`), não 25: no teto do código a soma é 85 s | `LEVE_FIM_MS` 90 s |
| `tamanho_do_banco`: medida | E10 | 10 s (o spec contava 5) | `fimAteMs` 85 s |
| `tamanho_do_banco`: nova tentativa das miniaturas | E10 | 20 s, só se a medida deu `ok` e sobram mais de 25 s | o mesmo `fimAteMs` |
| `marcas_de_idade` | E4 | 10 s (duas idas de 5 s) | `comecaAteMs` 75 s, `fimAteMs` 85 s |
| **Soma nominal das leves** | | **90 s** | `fimAteMs` 85 s: **não cabem todas no mesmo disparo, e não precisam** |
| Pesada do disparo | E16 | 150 s | `PESADA_FIM_MS` 285 s |
| **Pior disparo nominal** | | **240 s** (o spec dizia 205; a E4, 215) | `LIMITE_FUNCAO_MS` 300 s |
| Sinal do banco e pendências do arquivo | E10 | 3 s, em paralelo com as provas | não soma |
| Prova dos ausentes | E9 | dentro do mesmo `Promise.all` e do mesmo `proofMs` das provas | não soma (72 chamadas de banco por dia) |
| Conclusão de apagamentos | E9 | 6 s, só depois de `cron_health` gravado e com 8 s de sobra | não atrasa o registro |

**(emenda 1: S-m5) Com a leitura horária no teto de 60 s do código, `marcas_de_idade` é adiada com mais frequência do que "só quando uma falhou": a conclusão não muda, o D0 da E4 mede quantas vezes.** Cabe por três travas que já estão nos planos: nenhuma leve começa depois de 75 s; a nova tentativa das miniaturas só começa com mais de 25 s de sobra; a pesada confere o próprio relógio contado de `t0`. **Consequência:** as leves novas rodam em horas diferentes (03:00, 04:00 e 05:00 de São Paulo) e só coincidem quando uma falhou ou está drenando carga; nesse disparo a última (`marcas_de_idade`, ordem 5.5) é adiada com `sem_tempo`, sem gastar tentativa. No D0 da E4 a carga inicial pede 3 execuções ou mais: é o dia em que isso acontece. **Não medido:** o tempo real de nenhuma das peças novas em produção; os tempos das quatro funções remendadas pela MG6 (teto de 3 s da prova) e de `competitor_missing_proof`.

**Cron do canal próprio (`sync-analytics-metrics`, 12:00 UTC, relógio de 270 s, função de 296 s).**

| Peça | De quem | Pior caso | Contra qual teto |
|---|---|---|---|
| `TETOS_MS` (metadados 30, jobs 20, relatórios 120, alcance 20, diário 50) | código de hoje (`coleta/clock.ts:5`) | 240 s | 270 s |
| Passo de versões | E18 | 5 s, **fora** de `TETOS_MS` | sai da reserva de 30 s, que cai para 25 s |
| Cobertura de metadados | ordem 23 | dentro dos 30 s do passo de metadados | **não medido** quanto o passo já gasta (CP21): acima de 25 s num dia, a cobertura fecha `sem_tempo` e as 14 execuções limpas não fecham |
| Duas idas a mais no passo de versões (11 para 13; 43 para 45 na primeira execução) | ordem 23 | cerca de 0,1 s a 50 ms por ida (estimativa da E18, não medida) | os mesmos 5 s |
| Passos de fim (retenção 20, dimensões 30, normalizadores 20) | E8, E11 (ontem) | só gastam o que sobra | ~~sobra 25 s no pior caso, 5 s a menos que hoje~~ (emenda 1: D-m1) sobra 25 s **menos** a guarda da E20 (até 8 s) e a parte antiga da rota (~~não medida~~ (emenda 3: n1) medida em `yt_own_collection_runs.ms_existente`: 23,7 s em 12/10, pelo plano de ontem; o pior dos 7 dias sai da P12 da E18) |

**Soma dos tetos: 245 s de 270 s.** ~~Cabe.~~ **(emenda 1: D-m1) A conta estava incompleta. Os 30 s que sobram de 270 − 240 são, pelo código, "a reserva da parte antiga da rota" (`coleta/clock.ts:4`), e a guarda da E20 gasta até 8 s dela (`coleta/guarda.ts:31-32`). Conta certa: 270 − 240 − 5 (versões) − 8 (guarda) = 17 s, menos a parte antiga da rota, ~~que ninguém mediu~~ (emenda 3: n1: é medida, ver o fim deste parágrafo). ~~Cabe se a P12 da E18 mostrar a parte antiga abaixo de 17 s no pior `ms_total` dos últimos 7 dias, e não no típico.~~** **(emenda 2: D2-m8) A condição estava mal posta, por dois motivos. (1) A P12 não produz esse número: pedia "`ms_total` com folga de mais de 5 s", e `ms_passos` não tem chave para a parte antiga (`sync-analytics-metrics/route.ts:581`; `ms_total` é o relógio do pedido inteiro, `:495` e `:598`). (2) O número já existe e é maior que 17 s: o plano de ontem da E6/E8 (P5) anota a parte antiga em 23,7 s em 12/10. Então, no pior caso nominal, a soma dos tetos **não cabe** (240 + 5 + 8 + 23,7 = 276,7 s contra 270 s); o que protege é o relógio, que corta o que vier por último com `sem_tempo`, e a distância entre o nominal e o real: as execuções de 10 a 12/10 levaram de 88 a 102 s no total (mesma P5). Nenhum desses números foi medido de novo aqui. A P12 da E18 passa a medir o que decide: no pior dos 7 dias, `ms_total` menos o tempo dos passos de fim, com folga de mais de 5 s para os 270 s (emendada no plano).** **(emenda 3: n1) Correção ao motivo (1): a parte antiga TEM medida própria, a coluna `yt_own_collection_runs.ms_existente` (`integer not null` desde `20261008000002_coleta_canais_proprios_l1b.sql:71`; `sync-analytics-metrics/route.ts:599` e `:619` gravam `ms_existente: msExistente`), e é dela que saem os 23,7 s. O que continua verdade é só que `ms_passos` não a traz e que a P12 não a pedia: passou a pedir. A regra de decisão (total menos passos de fim) não muda.** O que encolhe é a sobra dos passos de fim no pior caso: se a E8 e a E11 estiverem contando com os 30 s inteiros, a retenção e as dimensões fecham `sem_tempo` 5 s mais cedo nos dias ruins. A P12 da E18 mede a folga real antes do envio; se for menor que 5 s, o passo de versões muda de fase (tarefa 7b de lá, não detalhada).

**Cota da API do YouTube.** Sete dos oito planos gastam zero. A exceção é a Tarefa 12 da E4 (dois dias a mais de faixa diária): "menos de 1 unidade de cota por sincronização", em lotes de 50 ids por unidade; o plano não converte em unidades por dia, e a C-14 dá a base. A pausa da E10 reduz o gasto. A Tarefa 5 da E18 não gasta cota: guarda até 35 imagens a mais por dia no Blob, no pior caso.

**Tamanho do banco (teto de 500 MB; 170,7 MB em 12/10).** E4: menos de 1 MB por ano. E18, E9, E10, MG17a: tabelas pequenas, sem número. E17 p0: `obs_ai_access_log` cresce com o uso e só ganha poda no degrau 2. P3: pico estimado de 194 MB entre a MG15 e o `vacuum full`, depois cerca de 123 MB, e cerca de 100 MB depois da MG16 (os três **não medidos**). Os limiares do sinal da E10 (350 MB amarelo, 425 MB vermelho; (emenda 3: mockup 18 aprovado em percentual) a regra passou a 70% e 85% do limite do banco inteiro, decidida sobre o inteiro mostrado, e os MB só aparecem no botão de informação) foram calculados sobre a base de antes da dieta: até a MG15 rodar, o amarelo chega cerca de 4 meses mais cedo do que a conta final diz (emenda 1: D-m3: **ESTIMATIVA**, de 68 MB sobre 0,6 MB por dia, número que o plano da E10 marca como estimativa na conferência `e10-d7`).

**Banco de integração e CI.** Os oito planos somam cerca de 30 arquivos novos em `test/integration/`, todos contra o `bythiago_int`, sem paralelismo entre arquivos; o da E17 p0 pede o banco livre e os da MG17a seguram trava exclusiva em `yt_own_video_coverage`. **Não medido:** quanto o job "Integration (DB-gated)" da CI cresce.

**Leitura de produção.** A seção 7 tem 97 conferências de leitura (algumas com duas ou três consultas), todas do controlador, com autorização do dono.

---

## 6. Perguntas ao dono, numa lista só

"Trava" diz o que não anda sem a resposta. Sem marca, o padrão basta e nada espera.

**Novas, desta reconciliação**

| # | Pergunta | Padrão | Trava |
|---|---|---|---|
| R-A | O cron `ab-watchdog` apaga retrato diário de canal de concorrente com mais de 365 dias, e o spec (06, 9.2) diz que essa tabela nunca sai do online (é a base de M3(a) e M8). Mantém a poda ou tira? | Nada muda até a resposta: a poda continua como a Tarefa 11a da E9 a deixa (sem apagar retrato de canal ausente) e fica declarada como exceção no teste da E10. **Recomendação: tirar a poda**, que é a opção que não perde dado e a que o spec descreve | nada hoje. (emenda 1: D-m2) A frase "a C-5 confirma" afirmava conferência que não rodou. O fato se prova sem produção: a tabela nasce em `supabase/migrations/20260601000002_competitor_enrichment.sql` e o único escritor é `competitor-sync.ts`, então nenhum retrato faz 365 dias antes de **01/06/2027** (a não ser por carga manual com data retroativa, que nenhuma migration faz). A C-5 só dá o primeiro dia por canal. **Tem data: resposta antes de 01/06/2027** |
| R-B | Quando um "apagar" da fila atinge canal que já foi exportado para o NAS, quem apaga o arquivo? Nenhum dos dois planos faz | A tela avisa e lista os lotes; o dono apaga à mão no NAS e na pasta local, com os comandos do runbook da E10 | nada; precisa de resposta antes do primeiro export seguido de "apagar". (emenda 1: D-m4) Até lá o lote do canal apagado fecha com `closed_reason = 'canal_apagado'`, e a consulta do runbook da E10 lista o que ainda está no NAS; se a MG6 for aplicada sem esse valor, o lote fica aberto ("exportado e não confirmado") apontando para canal que não existe |

**E4 (medidas e marcas)**

| # | Pergunta | Padrão | Trava |
|---|---|---|---|
| E4-1 | A faixa diária dos vídeos fora dos N mais recentes pode durar 32 dias em vez de 30? | Sim (Tarefa 12). "Não": a tarefa não é feita e V30 só existe para os N mais recentes, fixados e promovidos | **a Tarefa 12, que tem data: em produção até 30/10/2026** |
| E4-2 | Limites de distância entre leituras: 36 h (idades 7 e 30) e 8 h (idade 1)? | Sim; se a C-2 passar de 10% dos pares, propõe-se 48 h | |
| E4-3 | Limiares de subida (2× e 1.000 views em 7 dias) e de "pico sem cauda"? | Os do spec | |
| E4-4 | M12 entra, sendo o caso da política III.E.4.h do YouTube? | Entra, como função pura e leitor | |
| E4-5 | A idade conta da estreia, quando ela é posterior à publicação? | Sim | |
| E4-6 | Vídeo com `is_short` nulo fica fora das medianas novas, e é contado? | Sim | |

**E10 (export, pausa, sinal de limite)**

| # | Pergunta | Padrão | Trava |
|---|---|---|---|
| E10-P1 | Credencial do `exportar` | `OBS_ARQUIVO_DB_URL`, conexão direta, exportada pelo dono no terminal | **só o ensaio em produção (Tarefa 13)** |
| E10-P2 | Banco no amarelo ou no vermelho deixa o cron vermelho? | Não; só 72 h sem medida ou leitor quebrado. E-mail 1 por mês no amarelo, 1 por semana no vermelho | |
| E10-P3 | Apagar as miniaturas do Blob depois de remover o canal? | Sim, até 200 por dia | |
| E10-P4 | Idade de corte do que fica online | 12 meses | |
| E10-P5 | Quem pode pausar e confirmar | `org_admin` do site ou da organização raiz, por `--por <e-mail>` | |
| E10-P6 | Nome do lote | `canal-<8 caracteres do id>-<AAAA-MM-DD>` | |
| E10-P7 | Trava no banco contra `delete` direto de `competitor_channels`? | Não (quebraria o botão antes do código novo e o "apagar" da E9) | |
| E10-P8 | Mockups a pedir à E13 | Os quatro: 18, pastilha "coleta pausada", passo "exportar antes", "Sugestões" | as telas, não o plano |
| E10-a | A pasta local `~/Workspace/arquivo-observatorio/<lote>/` é a segunda cópia (fica) ou sai depois da conferência no NAS? | Sem padrão: o dono anota no runbook | |

**E9 (fila "Saíram do YouTube")**

| # | Pergunta | Padrão | Trava |
|---|---|---|---|
| E9-1 | O número da aba soma esperando, apagando e voltaram? | Soma os três | |
| E9-2 | Apagar canal pela fila não exporta antes? | Não exporta (é a exceção do spec; a regra do export vale para "remover canal" no ar) | |
| E9-3 | Comentários: cartão por canal ou por vídeo? | Por canal | |
| E9-4 | Leitura de nicho da forja que cita vídeo apagado fica? | Fica; o painel diz | |
| E9-5 | Conferir por id, todo dia, se apagado antigo voltou? | Não (custa 1 unidade por 50 ids) | |
| E9-a | Se o PostgREST de produção não aplicar o teto de 30 s de "apagar canal" | Só vira pergunta se a prova da Tarefa 1 falhar, com os números da CP9 | |

**E17, passo 0 (direito "ver desempenho privado")**

| # | Pergunta | Padrão | Trava |
|---|---|---|---|
| E17-1 | Como conceder e retirar o direito | SQL do runbook no painel; nenhuma ação de servidor | **a concessão** |
| E17-2 | As frases "só quem edita o site vê…" | Não mudam aqui; lote de UX | |
| E17-3 | Exigir vínculo com o site além da concessão? | Sim, as duas | |
| E17-4 | `setUserNiche` da leitora | Mantido, como exceção declarada | |
| E17-5 | As peças do degrau 2 vão junto na MG11? | Sim | |
| E17-6 | Fechar o resto do CMS para `reporter` (37 arquivos, 85 tabelas no banco local) | Plano próprio depois do inventário (MG19) | **a criação do usuário da irmã e toda concessão** |
| E17-7 | Rastro em `audit_log` por gatilho, com `granted_by` e `revoked_by`? | Sim | |
| E17-8 | Botões de edição visíveis a quem só lê | Ficam; esconder vira condição do fechamento | |
| E17-P14 | Qual é o e-mail do login do dono em produção (o runbook grava quem concede) | O do Apêndice C, conferido pela P14 | **o "pronto" da Tarefa 9** |

**E18 (versões do vídeo próprio)**

| # | Pergunta | Padrão | Trava |
|---|---|---|---|
| E18-1 | Retoque de thumbnail com dHash idêntico: guardar imagem nova? | Registra a versão; a imagem guardada continua a anterior | |
| E18-2 | O passo de metadados guarda a imagem sempre que o dHash mudar 1 bit? | Sim | **a Tarefa 5** |
| E18-3 | Semear os títulos dos ciclos do A/B Lab de 31/05 a 07/06/2026 como "antes do registro"? | Sim, por comando que o dono cola | **a Tarefa 11** |
| E18-4 | Mudança só de espaço no fim da descrição conta como versão nova? | Conta | |

**Dieta: E6 P3 (MG15), E6 P4 (MG16) e E18 parte 2 (MG17)**. As três perguntas repetidas nos dois planos estão unidas.

| # | Pergunta | Padrão | Trava |
|---|---|---|---|
| D-1 | Onde guardar os CSVs (P3-1, O23-3) | `~/Workspace/arquivo-observatorio/dieta-diario/` e `…/dieta-meta/`, com `.sha256`; cópia ao NAS depois | |
| D-2 | Dia e hora de cada migration destrutiva (P3-2, O23-7) | O dono escolhe; entre 14:00 e 20:00 de Brasília; cada uma no seu dia | **as datas das Tarefas 7 (P3), 14 e 15 (ordem 23)** |
| D-3 | `vacuum full` no mesmo dia (P3-4, O23-5) | Diário: sim, logo depois das conferências. Metadados: só se a tabela passar de 1 MB | o item 48 (espaço) fica aberto sem ele |
| D-4 | Linhas vazias do diário com média ou taxa preenchida, inclusive 0: apagar? (P3-3) | **Ficam**; a variante que apaga está escrita e testada. Vai fechada ao dono com os números da CP2 | **a Tarefa 1 da P3**; com o padrão e média 0 nas linhas antigas, a etapa pode terminar sem ganho de espaço |
| D-5 | A MG17 vale a pena agora (175 linhas, cerca de 108 kB)? (O23-1) | Fazer, com o portão D verde | **a Tarefa 15** |
| D-6 | Qual regra de apagar metadados: a do spec ou a do plano (primeira, última, as duas mais recentes; só a idêntica às duas vizinhas)? (O23-2) | A do plano. Se for a do spec, o plano não serve | |
| D-7 | Cópia dentro do banco para a MG17? (O23-4) | Não | |
| D-8 | Soltar o backup do diário aos 14 dias ou esperar mais? (O23-6) | Aos 14 dias, com CSV do próprio backup antes | **a Tarefa 14** |

**E7 (Cowork)**

| # | Pergunta | Padrão | Trava |
|---|---|---|---|
| E7-1 | O Cowork recebe série por vídeo e comentários? | Não | |
| E7-2 | M11 entra em `channels`? | Não | |
| E7-3 | `campos=todos` devolve quais campos? | Todos menos a descrição do canal | |
| E7-4 | Dois envios? | Sim | |
| E7-5 | Autoriza o agente a fazer GET nas rotas em produção com a chave do Cowork? | Não; o dono cola os comandos | |
| E7-6 | MCP: tirar `channel_id` e anunciar `type`, `bookmarked`, `tier`? | Sim | |
| E7-7 | `docs/cowork-pipeline-reference.md` fica como está? | Sim | |
| E7-8 | Aceita que a chave `forja (so leitura)` alcance os campos novos? | Sim; a P-5 e a P-7 levam o fato | o Lote 1, se a P-7 achar leitura da forja |
| E7-9 | Por qual programa o Cowork chama a ferramenta, e qual o teto de resposta? | 60.000 caracteres | |
| E10-P9 (emenda 3: mockup 18) | O banco cresceu em 28 dias, mas uma das três partes encolheu (depois de uma dieta, por exemplo): o que a coluna "Do crescimento" mostra? | o contrato devolve `parte_encolheu`, sem percentual inventado; o que a tela desenha é do mockup | a tela do aviso, não o plano da E10 |
| E10-P10 (emenda 3: mockup 18) | O corte de cor é pelo inteiro mostrado (70 e 85) ou pelos MB exatos (350 e 425)? | pelo inteiro: o amarelo começa em 347,5 MB e o vermelho em 422,5 MB | |

**O que trava alguma coisa, em uma linha:** E4-1 (data: 30/10), D-4 (Tarefa 1 da P3), E17-6 e E17-1 (usuário da irmã e concessão), E18-2 e E18-3 (Tarefas 5 e 11), D-2, D-5 e D-8 (datas e tarefas das migrations destrutivas), E10-P1 (ensaio), E17-P14 (fecho do runbook).

---

## 7. Conferências pendentes em produção, numa lista só

Todas são leitura. Quem roda é o controlador, com `npx supabase db query --linked "<consulta>"` e a autorização do dono; nenhum agente de etapa roda. O resultado vai para o ledger da etapa e, onde o plano pede, para `.superpowers/sdd/a5/conferencias-c0-resultado.md`. Os textos abaixo são cópia dos planos; onde duas ou mais conferências pediam a mesma coisa, fica uma e a linha diz quais ela cobre. A ordem é a de prioridade: primeiro o que perde dado ou tem data, depois o que decide a próxima migration, depois o que só muda número.

**Já respondida por esta reconciliação, na referência local:** CP2 da E9 e P-6 da E7 (o remoto tem o Lote 1 de E1/E2: `origin/main` = `6d63f387`). O `git fetch` do controlador confirma.

### Grupo 0. Hoje: perde dado ou tem data

A C-14 e a C-16 decidem se a Tarefa 12 da E4 vai hoje (a data limite é 30/10/2026). ~~A CP15 decide se a poda de retratos do `ab-watchdog` pode apagar retrato de canal ausente no próximo disparo.~~ (emenda 1: D-m2) A CP15 dá zero por construção até 01/06/2027 (a tabela de retratos nasceu em 01/06/2026): sai do "hoje" e continua listada abaixo só para registro; a mudança do `ab-watchdog` vai no Envio B. A C-5 dá, por canal, o primeiro dia de retrato: somado a 365 dias, é a data em que a poda começa a apagar (pergunta R-A).

**[E4] C-14. Quais canais publicam mais do que o `video_limit` em 32 dias?** É o tamanho do problema da seção 4.4. **(emenda 1: d:I-1, s:I3) É a primeira conferência a rodar, antes de qualquer outra.** Zero linhas e nenhum canal perto do limite (`publicados_32d` a menos de 5 do `video_limit`, pela segunda consulta abaixo): o prazo de 30/10 da Tarefa 12 deixa de apertar, o controlador escreve isso no ledger, e a tarefa entra assim mesmo (custa quase nada), podendo ir com o lote. Uma linha ou mais: o envio antecipado da Tarefa 12 é obrigatório, até 30/10/2026; sem ele esses canais perdem, sem volta, V30 dos vídeos de 03/10 em diante que saem dos N mais recentes antes do 30º dia. (emenda 2: d:m-4) 30/10 é o teto para os vídeos de 03/10 em diante; para os de setembro a perda já corre, e quem mede é a C-16.
```sql
select c.channel_name, c.video_limit, count(*) as publicados_32d from public.competitor_channels c join public.competitor_videos v on v.competitor_channel_id = c.id where v.published_at > now() - interval '32 days' group by 1, 2 having count(*) > coalesce(c.video_limit, 50) order by 3 desc;
select c.channel_name, c.video_limit, count(v.id) as publicados_32d from public.competitor_channels c left join public.competitor_videos v on v.competitor_channel_id = c.id and v.published_at > now() - interval '32 days' group by 1, 2 order by count(v.id) - coalesce(c.video_limit, 50) desc limit 5;
```

**[E4] C-16 (emenda 2: d:m-4). Quantos vídeos já saíram da faixa diária com 30 a 45 dias, por canal?** Rodar junto da C-14, antes de tudo. São os vídeos de setembro que tinham leitura diária desde 03/10, estão fora dos N mais recentes e perderam (ou estão perdendo hoje) a leitura do dia seguinte ao 30º. Zero linhas: nenhum V30 está se perdendo hoje e o prazo da Tarefa 12 é só o de 30/10. Uma linha ou mais: **cada dia sem a Tarefa 12 em produção perde o V30 dos vídeos que fazem 30 dias naquele dia nesses canais**; o envio dela é para hoje, e a soma das linhas é a ordem de grandeza de `perdidas_30` no vermelho esperado do D0 (seção 7). A consulta supõe que a série diária de antes de 13/10 foi gravada todo dia para todo vídeo guardado (não conferido; se não foi, os vídeos aparecem aqui e o motivo deles será `leitura_comecou_depois`, que não avisa).
```sql
select c.channel_name, count(*) as fora_da_diaria_com_30_a_45_dias from public.competitor_videos v join public.competitor_channels c on c.id = v.competitor_channel_id where v.series_tier = 'semanal' and v.published_at between now() - interval '45 days' and now() - interval '30 days' group by 1 order by 2 desc;
```

**[E9] CP15**

- Comando: (emenda 1: S-I4) `select count(*) from competitor_channel_snapshots s join competitor_channels c on c.id = s.competitor_channel_id where c.missing_since is not null and s.snapshot_date < current_date - 365;`
- O que muda: Maior que zero: a poda de 365 dias do `ab-watchdog`, que **já está em produção**, pode apagar retrato de canal ausente no próximo disparo dela; a mudança do `ab-watchdog` (Tarefa 11) sai junto com o **Envio A**, em commit próprio, em vez de esperar o Envio B. Zero: vai no Envio B

**[E4] C-5. Retratos de canal: início, buracos e nulos (item 30; M3(a) e M8).** `dias − linhas > 0` em algum canal: há buraco de verdade e M3(a) responde "sem registro na borda" nesses dias (é o comportamento do plano; o número diz com que frequência). `view_nulo > 0`: confirma que o leitor novo (Tarefa 13) não pode passar pelo carregador antigo.
```sql
select c.channel_name, min(s.snapshot_date) as primeiro, max(s.snapshot_date) as ultimo, count(*) as linhas, (max(s.snapshot_date) - min(s.snapshot_date) + 1) as dias, count(*) filter (where s.view_count is null) as view_nulo, count(*) filter (where s.subscriber_count is null) as subs_nulo from public.competitor_channel_snapshots s join public.competitor_channels c on c.id = s.competitor_channel_id group by 1 order by 1;
```

> Reconciliação: Serve também à pergunta R-A (a coluna `primeiro`) e é vizinha da P-10 da E7 (grupo 6), que pede quase as mesmas colunas.


### Grupo 1. O que está aplicado, e o que ninguém pode ter criado por fora

Decidem qual migration pode nascer. Qualquer objeto que já exista onde se espera nulo: parar.

**[O23] CP1 (já): o que está aplicado.**
```sql
select version from supabase_migrations.schema_migrations order by version desc limit 20;
```
Esperado em 13/10: até `20261013000003`, sem MG14, MG11, MG5, MG7, MG12, MG15. **Muda o quê:** nada no desenho; diz qual portão pode começar.

> Reconciliação: **Cobre:** a C6 da E10, a P1 da E17, a segunda consulta da P7 da E18 e a coluna `ultima` da C-1 da E4 e da P-3 da E7. Esperado em 13/10: a mais nova é `20261013000003`.

**[E7] P-3. As tabelas da E4 existem em produção?** Decide a ordem do Lote 2.
```sql
select to_regclass('public.competitor_video_marks') as marcas, to_regclass('public.competitor_video_mark_misses') as faltas, (select max(version) from supabase_migrations.schema_migrations) as ultima;
```
Nulo: normal até o lote da E4; o Lote 2 não vai antes dele. Não nulo sem o lote da E4 enviado: parar (alguém criou fora do plano).

> Reconciliação: **Cobre** a C-1 da E4 (mesma pergunta, com a segunda tabela).

**[E9] CP3**

- Comando: `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('competitor_video_purge','competitor_channel_purge','competitor_comments_purge','competitor_cascade_counts','competitor_missing_proof','competitor_missing_keep','competitor_return_decide','competitor_removed_blobs_done','competitor_purge_preview','competitor_jsonb_sum','competitor_missing_count','competitor_comments_preview','competitor_removed_comment_groups'); select to_regclass('public.competitor_missing_baseline');`
- O que muda: Esperado: nenhuma linha e `null`. Qualquer outra coisa: alguém aplicou fora do repositório; parar

**[E17] P5**

- Consulta: `select to_regclass('public.site_private_viewers'), to_regclass('public.obs_ai_access_log'), to_regclass('public.obs_ai_rate'), to_regprocedure('public.can_view_private_site(uuid)'), to_regprocedure('public.can_view_site_as(uuid,uuid)'), to_regprocedure('public.can_edit_site_as(uuid,uuid)'), to_regprocedure('public.can_view_private_site_as(uuid,uuid)'), to_regprocedure('public.is_super_admin_as(uuid)'), to_regprocedure('public.is_org_admin_as(uuid,uuid)'), to_regprocedure('public.obs_ai_rate_hit(uuid,timestamp with time zone)'), to_regprocedure('public.tg_site_private_viewers_audit()');`
- Esperado: onze nulos
- O que muda se vier diferente: algum já existe: parar. `create or replace` não troca nome de parâmetro nem tipo de retorno, e uma tabela homônima com outra forma faria o `create table if not exists` passar em silêncio com a forma errada

**[E18] P7**

- Comando: `select to_regclass('public.yt_own_video_versions') is not null a, to_regclass('public.yt_own_versions_state') is not null b; select version from supabase_migrations.schema_migrations order by version desc limit 8;`
- Esperado: `false`, `false`; e as versões já aplicadas
- O que muda se for diferente: `true`: alguém aplicou antes; parar e avisar

**[E10] C10**

- Pergunta: (emenda 1: S-I3, D-I5) Qual é o teto de tempo de uma instrução para cada papel?
- Comando: `select rolname, rolconfig from pg_roles where rolname in ('authenticator', 'service_role', 'postgres');`
- O que muda: É o teto da remoção quando ela vem do CMS (cliente de serviço, pela API do banco) e de `competitor_archive_suggestions`. Comparar com o tempo medido na Tarefa 1 (seção 5.2). Teto menor que três vezes o tempo medido para um canal de um ano: a remoção **só** pelo subcomando `remover` (conexão direta, com o teto que ele mesmo declara) e a Tarefa 11b passa a mostrar a frase que manda usar o comando, sem chamar a função. Teto folgado: os dois caminhos valem. Sem resposta: vale o caminho do comando, que não depende do número

> Reconciliação: **Rodar uma vez só, com os cinco papéis** (consulta unida por esta reconciliação): `select rolname, rolconfig from pg_roles where rolname in ('authenticator', 'service_role', 'postgres', 'authenticated', 'anon');`. Responde esta, a CP8 da E9 (abaixo) e a CP10 da P3 (que só registra o valor no ledger; lá fica **não medido** se o `vacuum full` é aceito pela conexão "Session pooler").

**[E9] CP8**

- Comando: `select rolname, rolconfig from pg_roles where rolname in ('service_role','authenticator','authenticated','anon');`
- O que muda: Se `service_role` (ou `authenticator`, de quem ele herda a sessão) tiver `statement_timeout` de 8 s ou menos e a CP9 mostrar canal com mais de 100 mil linhas filhas: "apagar canal" pode estourar (a transação volta inteira, nada é apagado, a tela mostra `tempo_esgotado`). (emenda 1: D-I4 e S-I6; o conserto que estava aqui, `set local statement_timeout` dentro do corpo, **não funciona**: o Postgres arma o relógio no começo do comando, e a chamada inteira da função é um comando só) O teto passa a ser cláusula da própria definição de `competitor_video_purge` e `competitor_channel_purge` (`set statement_timeout = '30s'`, já no Apêndice A, sem condição). Que o PostgREST aplica essa cláusula antes de chamar é **afirmação dos dois revisores, não medida**: a Tarefa 1 (passo 5) prova pela API local; se a prova falhar, a cláusula fica inofensiva e a saída vai ao dono como pergunta, com os números da CP9 (a tela continua dizendo `tempo_esgotado`, nada é apagado)


### Grupo 2. Antes da MG6 (~~a próxima migration a ser aplicada~~ emenda 1, D-C1: a próxima passou a ser o lote C1; a MG6 é o passo 3)

A C1 e a CP4 podem adiar a Tarefa 1 da E10; a C7 pode parar a etapa; a C12 pode mudar um `insert` do Apêndice A; a C2 pode mudar os limiares do sinal.

**[E10] C1**

- Pergunta: As âncoras do remendo existem em produção, uma vez em cada função?
- Comando: `select p.proname, (length(p.prosrc) - length(replace(p.prosrc, a.ancora, ''))) / length(a.ancora) as vezes from (values ('competitor_series_health', 'or v.missing_since is not null or c.missing_since is not null'), ('competitor_hourly_health', 'and v.missing_since is null and c.missing_since is null'), ('competitor_comment_due', 'and v.missing_since is null and c.missing_since is null and v.published_at is not null'), ('competitor_comment_health', 'and v.missing_since is null and c.missing_since is null and v.published_at is not null')) as a(nome, ancora) join pg_proc p on p.proname = a.nome and p.pronamespace = 'public'::regnamespace order by 1;`
- O que muda: Esperado: quatro linhas com `1` (é o que o banco local dá, rodado em 13/10). Outro número = o corpo de produção difere do local: a MG6 recusaria sozinha, mas é melhor saber antes. Conferir o corpo e ajustar a âncora no Apêndice A

**[E9] CP4**

- Comando: `select k.conrelid::regclass as tabela, k.confrelid::regclass as referencia, k.conname, k.confdeltype, cardinality(k.conkey) as colunas from pg_constraint k where k.contype = 'f' and k.confrelid in ('public.competitor_videos'::regclass, 'public.competitor_channels'::regclass, 'public.competitor_video_comments'::regclass, 'public.youtube_intelligence_tasks'::regclass, 'public.competitor_video_versions'::regclass, 'public.competitor_readings'::regclass) order by 2, 1;`
- O que muda: Esperado: as cascatas da tabela 0.2, `colunas = 1` em todas, e nenhum `confdeltype` `a` ou `r`. `a` ou `r` para vídeo, canal ou comentário: "apagar" falharia com erro de chave (nada apagado, vermelho na tela); a Tarefa 1 acrescenta o `delete` explícito daquela tabela antes do da raiz. Cascata apontando para `competitor_video_versions`, `competitor_readings` ou para uma tabela filha de `youtube_intelligence_tasks`: é nível 3, e `competitor_cascade_counts` **lança** de propósito; a Tarefa 1 estende a função para três níveis antes de seguir. Tabela que o repositório não conhece: anotar e parar

> Reconciliação: **Cobre** a C5 da E10 (as mesmas chaves, mais três tabelas referenciadas, o nome da restrição e o número de colunas). Com as três tabelas novas da reconciliação no registro, esta lista é também o que a V2 da E10 vai comparar.

**[E10] C7**

- Pergunta: O corpo da limpeza do bruto é o da MG13
- Comando: `select prosrc from pg_proc where oid = 'public.yt_reporting_blobs_purge(text[])'::regprocedure;`
- O que muda: Se não for `return 0`, a E20 não está como se supõe: a E10 não começa

**[E10] C12**

- Pergunta: (emenda 1: D-m11) `audit_log` em produção tem gatilho ou chave que o banco local não tem?
- Comando: `select tgname, pg_get_triggerdef(oid) from pg_trigger where tgrelid = 'public.audit_log'::regclass and not tgisinternal;` e `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.audit_log'::regclass;`
- O que muda: O F10 foi lido só no banco local. Gatilho ou chave para `auth.users` em produção: o `insert` da remoção tem de respeitar (a falha seria segura, a transação é desfeita, mas apareceria só no ensaio). Ajustar o `insert` do Apêndice A antes de aplicar

**[E10] C2**

- Pergunta: Tamanho do banco hoje, e o painel conta o mesmo?
- Comando: `select pg_database_size(current_database()) as db_bytes;` e, **(emenda 1: D-m12)** `select sum(pg_database_size(datname)) as todos_os_bancos from pg_database;` (se esta segunda der erro de permissão, anotar o erro: é resposta). Comparar as duas com Supabase, Settings, Usage, Database size
- O que muda: Se o painel mostrar mais que `pg_database_size`, ~~os limiares de `RULES.dbSize` descem~~ (reconciliação 13/10, emenda 4: n4) `RULES.dbSize.limitMb` desce na mesma proporção (constante, sem migration; os cortes, 70 e 85, são percentuais e não mudam) e o runbook registra a diferença. Se o painel bater com a soma de todos os bancos e não com o banco corrente, uma migration pequena e posterior acrescenta essa soma a `obs_db_size_daily`; a MG6 não a grava agora porque não está medido se o papel dono da função pode ler o tamanho dos outros bancos, e um erro ali derrubaria a medida de todo dia

**[E10] C9**

- Pergunta: Quem é `org_admin` do site
- Comando: (emenda 1: D-m13) `select om.user_id, u.email, om.org_id, o.parent_org_id, (select array_agg(s.id) from sites s where s.org_id = om.org_id) as sites_da_org from organization_members om join auth.users u on u.id = om.user_id join organizations o on o.id = om.org_id where om.role = 'org_admin';`
- O que muda: O e-mail que o dono passa em `--por` (P5). Só serve quem é `org_admin` da organização do site (o site aparece em `sites_da_org`) ou de uma organização raiz (`parent_org_id` nulo): é a regra de `obs_archive_is_site_admin`. Nenhuma linha assim = ninguém consegue pausar: avisar antes do ensaio


### Grupo 3. Antes do lote C (~~MG14, MG11, MG5, MG7, MG12, MG17a~~ emenda 2: S2-m4: C1 = MG14, MG5, MG7; C2 = MG11, MG12, MG17a)

**(emenda 1: D-C1, S-C1) Com o lote C partido, este grupo é o do lote C2 (MG11, MG12, MG17a) e das migrations da dieta.** As conferências do lote C1 (MG14, MG5, MG7) são as dos planos de ontem (C0.1, C0.2, C0.8 e as V de cada uma), que esta lista não repete; elas vêm antes de tudo, porque o C1 é o passo 1 da seção 3.

A P2 faz a MG11 recusar se achar policy de outro nome; a P10 obriga a refazer as funções por usuário; a P8 muda o plano de fechamento; a P1 da E18 decide se a MG12 entra.

**[E17] P2**

- Consulta: `select tablename, policyname, cmd, roles, qual from pg_policies where schemaname='public' and tablename in ('yt_own_video_daily','yt_own_video_reach_daily','yt_own_video_meta_daily','yt_own_video_coverage','yt_own_video_retention','yt_own_video_dim_daily','yt_own_video_traffic_detail_daily','yt_own_video_reach_dim_daily','yt_own_video_versions','yt_own_versions_state','competitor_video_comments','competitor_video_comment_marks','competitor_video_comment_authors','competitor_video_comment_snaps','competitor_raw','yt_reporting_reports','yt_reporting_jobs','yt_reporting_report_blobs','yt_own_collection_attempts','yt_own_collection_runs','yt_own_public_video_hourly','yt_own_public_video_early','yt_own_public_hour_map','yt_own_public_hour_fold_log') order by 1, 2;`
- Esperado: para cada tabela da lista das doze que existe: **uma** linha, `policyname = <tabela>_select`, `cmd = SELECT`, `qual = can_edit_site(site_id)`
- O que muda se vier diferente: policy com outro nome numa das doze: **a MG11 recusa** (a guarda do laço lança "tem policy fora do padrão") e não aplica nada. Antes de criar o arquivo, o plano ganha uma linha `drop policy if exists "<nome real>"` naquela tabela e o roteiro é rodado de novo

**[E17] P4**

- Consulta: `select column_name, data_type from information_schema.columns where table_schema='public' and table_name='pipeline_api_keys' order by ordinal_position;` e `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.pipeline_api_keys'::regclass;` e `select count(*) from public.pipeline_api_keys where 'observatorio_leitura' = any(permissions);`
- Esperado: 9 colunas, sem `user_id` nem `expires_at`; três constraints (`_pkey`, `_site_id_fkey`, `_created_by_fkey`); `0`
- O que muda se vier diferente: já existe `check` em `permissions`: a MG11 passa a recriá-lo com `observatorio_leitura` incluída. A contagem maior que 0 com permissão misturada faria o `check` novo falhar: parar e levar ao dono (seria uma chave criada fora do processo)

**[E17] P10**

- Consulta: `select p.proname, md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('is_super_admin','is_org_admin','can_view_site','can_edit_site','can_admin_site_users') order by 1;`
- Esperado: `can_admin_site_users` `9033e7ad6b4de34b6ff9e49819326ae1`; `can_edit_site` `6d6c32924fcc665d2ccfd8fc6d91142f`; `can_view_site` `df45c50ea5227460e94f6f36fd89f020`; `is_org_admin` `1f3abb7a269da195958a610a504e3d92`; `is_super_admin` `7115a5fbae7c81e990e431cad6fac7e7` (medidos no banco local)
- O que muda se vier diferente: md5 diferente: o corpo de produção não é o que as `_as` espelham. Parar, ler o corpo real (`pg_get_functiondef`) e refazer o espelho antes de criar o arquivo

**[E17] P6**

- Consulta: `select defaclrole::regrole, defaclnamespace::regnamespace, defaclobjtype, defaclacl from pg_default_acl where defaclnamespace = 'public'::regnamespace;`
- Esperado: igual ao local: função criada por `postgres` em `public` nasce com `execute` para `anon` e `authenticated`
- O que muda se vier diferente: nada muda no SQL (o `revoke` explícito já está lá); confirma que ele é **obrigatório**, não enfeite

**[E17] P9**

- Consulta: `select column_name || ':' || data_type from information_schema.columns where table_schema='public' and table_name='audit_log' order by ordinal_position;`
- Esperado: as 12 colunas de 0.1
- O que muda se vier diferente: coluna obrigatória a mais: o gatilho da seção 4 do Apêndice A ganha a coluna, e o roteiro é rodado de novo

**[E17] P8**

- Consulta: `select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'lgpd_phase%';`
- Esperado: a fase 3 apaga a linha de `auth.users`
- O que muda se vier diferente: se a fase 3 **não** apaga `auth.users` (só anonimiza), as chaves estrangeiras da MG11 não disparam e a limpeza LGPD precisa de três linhas próprias (apagar de `site_private_viewers`, anular `obs_ai_access_log.user_id` e `pipeline_api_keys.user_id`): vira item do plano de fechamento, **antes** de existir a primeira linha de concessão

**[E17] P7**

- Consulta: `select role, count(*) from public.site_memberships group by role;` e `select count(*) from public.organization_members where role = 'org_admin';`
- Esperado: `editor` 1; `org_admin` 1; nenhum `reporter`
- O que muda se vier diferente: existe `reporter`: ele continua sem ler nada privado (não tem linha de concessão), mas o inventário da Tarefa 10 passa a ser urgente, porque já descreve um login real

**[E17] P12 *(emenda 1: D-m4)***

- Consulta: `select jobname, schedule, active from cron.job order by 1;` e, local, `grep -n "agenda" apps/web/vercel.json` (hoje, local: nenhuma linha)
- Esperado: nenhum cron que escreva em `competitor_video_comments` nem em `competitor_video_comment_marks` (o lote B, que traz o despachante da agenda, ainda é só local)
- O que muda se vier diferente: existe: a janela do `db:push:prod` passa a excluir também o minuto em que ele roda

**[E17] P14 *(emenda 2: D-N1)***

- Consulta: `select count(*) from auth.users where email = 'tnfigueiredotv@gmail.com';` (o e-mail que o Apêndice C escreve como "quem concede e quem retira" é o do login do dono em produção? **Não foi medido**)
- Esperado: `1`
- O que muda se vier diferente: `0`: toda instrução de conceder e de retirar gravaria o autor em branco, sem erro. O Apêndice C e o runbook passam a levar o e-mail real do login do dono (o controlador pergunta a ele qual é e repete a contagem com esse e-mail até dar `1`); o roteiro do Apêndice B não muda (usa `dono@mg11.test`). Trava o "Pronto quando" da Tarefa 9, não a 1b

**[E17] P3**

- Consulta: as quatro consultas da Tarefa 10, parte B (lista de policies de leitura; tabelas sem RLS; tabelas com RLS e sem policy; e, *emenda 1: D-I2 e S-I6*, funções executáveis por `authenticated` ou por `anon`)
- Esperado: não há esperado: é o inventário
- O que muda se vier diferente: vai ao dono com a pergunta 37 já respondida ("só o Observatório"); decide o tamanho do plano de fechamento. **Não muda a MG11**

**[E18] P1**

- Comando: `select md5(prosrc), prosrc like '%pg_catalog.pg_constraint%' from pg_proc where proname = 'youtube_channel_removal_impact' and pronamespace = 'public'::regnamespace;`
- Esperado: `true` na segunda coluna
- O que muda se for diferente: `false`: a MG9 não está como se supôs; a MG12 só pode entrar depois da MG14 (que traz o corpo). No lote C já é assim; a guarda da MG12 recusaria sozinha

**[E18] P6**

- Comando: `select to_regprocedure('public.can_view_private_site(uuid)') is not null;`
- Esperado: `false` hoje; `true` depois da MG11
- O que muda se for diferente: só o esperado da V2

**[O23] CP10 (depois da MG14): o `check` de `source`.**
```sql
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.yt_own_video_coverage'::regclass and contype = 'c' order by 1;
```
Esperado: três restrições; a de `source` com `analytics_api` e `reporting_api`. **Muda o quê:** se a MG14 for aplicada já com `data_api` e `imagem` (o controlador pode pedir isso ao plano irmão antes de o arquivo dela nascer), o bloco 1 da MG17a não faz nada, por desenho.

> Reconciliação: Depois da MG14. Pela decisão R15, o esperado é o do texto: `analytics_api` e `reporting_api`.


### Grupo 4. Dieta do diário (MG15)

A CP2 roda **antes da Tarefa 1 da P3** e leva a pergunta D-4 ao dono com números. Da CP1 à CP14 e a CP8 da ordem 23 podem rodar já; CP3, CP4, CP5 e CP6 dependem da MG14 e do código de P2.

**[P3] CP2 (já): linha vazia com média ou taxa preenchida, e o estado das estendidas.**
```sql
select count(*) as vazias, count(*) filter (where avg_view_duration_seconds is not null or avg_view_percentage is not null or card_click_rate is not null) as a_com_media, count(*) filter (where coalesce(avg_view_duration_seconds,0) <> 0 or coalesce(avg_view_percentage,0) <> 0 or coalesce(card_click_rate,0) <> 0) as com_media_diferente_de_zero, count(*) filter (where engaged_views is null and card_impressions is not null) as so_cartao, count(*) filter (where engaged_views is not null and card_impressions is null) as so_engajadas, count(*) filter (where engaged_views is null and card_impressions is null) as sem_estendidas from public.yt_own_video_daily where views = 0 and coalesce(engaged_views,0)=0 and coalesce(watch_time_minutes,0)=0 and coalesce(likes,0)=0 and coalesce(comments,0)=0 and coalesce(shares,0)=0 and coalesce(subscribers_gained,0)=0 and coalesce(subscribers_lost,0)=0 and coalesce(card_impressions,0)=0;
```
Esperado: `a_com_media` = 0 (o spec afirma em D8; o registro da conferência não está nos arquivos lidos). **Muda o quê:** `a_com_media` maior que 0 com `com_media_diferente_de_zero` = 0 quer dizer que as linhas antigas trazem média 0 em dia sem view: a migration, no texto padrão, **não apagaria quase nada** (as linhas ficam por causa da regra 2). Nesse caso a pergunta 3 vai ao dono com os números; o padrão continua "ficam" e a etapa termina sem ganho de espaço, dito no ledger; se ele responder "apaga", entra a variante Z da regra 2 (seção 4.2 e Apêndice A), já testada. **(emenda 1: D-I-2) Esta conferência roda antes da Tarefa 1** (seção 9, "Ondas"). `com_media_diferente_de_zero` maior que 0: essas linhas ficam nos dois textos, contadas. `so_cartao` maior que 0: a regra 4 exige cobertura `estendidas` para essas linhas, e a carga da MG14 só cobre `engaged_views` não nulo; elas ficam, contadas.

**[P3] CP1 (já): os números do dia.**
```sql
select count(*) as t, count(*) filter (where coalesce(views,0)<>0 or coalesce(engaged_views,0)<>0 or coalesce(watch_time_minutes,0)<>0 or coalesce(likes,0)<>0 or coalesce(comments,0)<>0 or coalesce(shares,0)<>0 or coalesce(subscribers_gained,0)<>0 or coalesce(subscribers_lost,0)<>0 or coalesce(card_impressions,0)<>0) as a, count(*) filter (where views is null) as views_nulo, coalesce(sum(views),0) as s, count(distinct youtube_video_id) as videos, count(distinct site_id) as sites, min(day_pt), max(day_pt), pg_total_relation_size('public.yt_own_video_daily') as bytes from public.yt_own_video_daily;
```
Esperado: `t` perto de 96.892 mais 35 por dia desde 12/10; `sites` = 1. **Muda o quê:** `sites` maior que 1 não muda o SQL (a migration percorre os sites), mas a A1 e as V passam a rodar uma vez por site.

**[P3] CP1b (já): a forma do diário.**
```sql
select string_agg(a.attname, ',' order by a.attnum) from pg_attribute a where a.attrelid = 'public.yt_own_video_daily'::regclass and a.attnum > 0 and not a.attisdropped;
```
Esperado: a lista de 20 nomes do Apêndice A, seção 0. **Muda o quê:** qualquer diferença corrige a lista do Apêndice A e as listas de colunas dos Apêndices B e C.

**[P3] CP7 (já): as linhas que têm de ficar.**
```sql
select count(*) filter (where views = 0 and (coalesce(likes,0)<>0 or coalesce(comments,0)<>0 or coalesce(shares,0)<>0 or coalesce(subscribers_gained,0)<>0 or coalesce(subscribers_lost,0)<>0 or coalesce(watch_time_minutes,0)<>0 or coalesce(engaged_views,0)<>0 or coalesce(card_impressions,0)<>0)) as views0_com_atividade, count(*) filter (where least(coalesce(views,0), coalesce(engaged_views,0), coalesce(likes,0), coalesce(comments,0), coalesce(shares,0), coalesce(subscribers_gained,0), coalesce(subscribers_lost,0), coalesce(card_impressions,0), coalesce(watch_time_minutes,0)) < 0) as com_negativo from public.yt_own_video_daily;
```
Esperado em 12/10: 22 e 14. Tem de dar o mesmo antes e depois da P3 (entra na V3).

**[P3] CP8 (já): tamanhos.**
```sql
select pg_database_size(current_database()) as banco, pg_total_relation_size('public.yt_own_video_daily') as diario, pg_relation_size('public.yt_own_video_daily') as heap, pg_indexes_size('public.yt_own_video_daily') as indices, (select n_dead_tup from pg_stat_user_tables where relname = 'yt_own_video_daily') as mortas;
```
**Muda o quê:** `banco` acima de 400 MB no dia da P3 pede o `vacuum full` no mesmo minuto (o backup acrescenta até 23 MB, estimativa do spec).

**[P3] CP9 (já, e de novo no portão): o que no banco cita o diário.**
```sql
select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosrc ilike '%yt_own_video_daily%' union all select 'visão: ' || viewname from pg_views where definition ilike '%yt_own_video_daily%' union all select 'gatilho: ' || tgname from pg_trigger where tgrelid = 'public.yt_own_video_daily'::regclass and not tgisinternal order by 1;
```
Esperado hoje: só `youtube_channel_removal_impact`. No portão: mais `yt_own_daily_apply`, as da MG5 e as da MG7, se o lote C já entrou. **Muda o quê:** nome fora da lista é lido antes; gatilho no diário muda o custo do `delete`.

**[P3] CP13 (já; emenda 1: D-M-2): linha do diário de vídeo que saiu do cadastro.**
```sql
select count(distinct d.youtube_video_id) as videos_fora_do_cadastro, count(*) as linhas from public.yt_own_video_daily d where not exists (select 1 from public.youtube_videos v where v.youtube_video_id = d.youtube_video_id);
```
Esperado `0, 0`. **Muda o quê:** a migration apaga pela linha do diário e pela cobertura, sem olhar `youtube_videos`; a V5 percorre `youtube_videos`. Maior que 0, a V5 passa a partir da lista de ids do próprio dado (a forma alternativa está escrita ao lado da V5, seção 11), senão linhas sairiam sem entrar no retrato.

**[P3] CP14 (já; emenda 1: S-M-8): a hora real em que o cron grava.**
```sql
select count(*) as execucoes, min((ran_at at time zone 'utc')::time) as mais_cedo, max((ran_at at time zone 'utc')::time) as mais_tarde from public.yt_own_collection_runs where ran_at > now() - interval '30 days';
```
Esperado: tudo entre 12:00 e 12:10 UTC (cron às 12:00, função de até 300 s). **Muda o quê:** `execucoes` 0 = nada foi avaliado, não é "pontual". `mais_tarde` depois de 12:55 UTC, ou `mais_cedo` antes de 11:35: a janela proibida do Apêndice A (11:30 a 13:00) é alargada até cobrir o horário visto com 30 minutos de folga, no SQL, na seção 2, na seção 6 e no teste `janela do cron`. A trava `share row exclusive` já garante a correção em qualquer horário; a janela existe para o cron não tomar erro de espera.

> Reconciliação: **Cobre** a CP16 da ordem 23 (que é esta, sem mudança).

**[O23] CP8 (já): os comentários das duas tabelas que recebem marca.**
```sql
select obj_description('public.yt_own_video_daily'::regclass, 'pg_class') as diario, obj_description('public.yt_own_video_meta_daily'::regclass, 'pg_class') as meta;
```
Esperado: nulo nos dois (no diário, depois da P3, nulo de novo: o Apêndice D do plano P3 retira a marca). **Muda o quê:** texto presente: a linha da marca do Apêndice E passa a gravar o texto antigo seguido da marca, e a linha de limpeza devolve o texto antigo.

> Reconciliação: **Cobre** a CP12 da P3 (a metade do diário).

**[P3] CP3 (depois da MG14): linha fora da cobertura `base`.**
```sql
select count(*) from public.yt_own_video_daily d where d.views is not null and not exists (select 1 from public.yt_own_video_coverage c where c.site_id = d.site_id and c.youtube_video_id = d.youtube_video_id and c.metric_set = 'base' and d.day_pt between c.covered_from and c.covered_to);
```
Esperado 0 depois da primeira execução de P2. **Muda o quê:** maior que 0, a migration recusa (G4). (emenda 1: S-M-5) A cobertura casa também pelo site, como na função: sem isso, cobertura gravada em outro site daria 0 aqui e recusa na migration.

**[P3] CP4 (depois da MG14): buraco e atraso.**
```sql
select (select count(*) from (select youtube_video_id from public.yt_own_video_coverage where site_id = :site and metric_set = 'base' group by 1 having count(*) > 1) x) as com_buraco, count(*) as videos, count(*) filter (where not exists (select 1 from public.yt_own_video_coverage c where c.site_id = v.site_id and c.youtube_video_id = v.youtube_video_id and c.metric_set = 'base' and c.covered_to >= current_date - 4)) as atrasados from public.youtube_videos v where v.site_id = :site;
```
Esperado `0, 35, 0`. (emenda 1: D-M-9) **Qual é a regra do "em dia":** esta conferência usa a K5 do plano irmão, `current_date − 4`, e pede **todos** os vídeos em dia; a guarda (4) da migration usa `hoje em UTC − 5` e pede **algum** vídeo. A migration é de propósito um dia mais folgada: uma virada de dia UTC entre o portão e o `db push` nunca transforma portão verde em recusa. O portão é o mais estreito dos dois; a guarda da migration só pega cobertura parada. Com a emenda 1 a guarda (4) pede também gravação recente (`collected_at`), ver Apêndice A. **Muda o quê:** `videos` 0 = site errado (nada foi avaliado, não é "nada atrasado"). `atrasados` igual a `videos`: a migration recusa (nenhum vídeo em dia).

**[P3] CP5 (depois de três dias de P2): as três execuções limpas, pela regra da migration.** (emenda 1: D-I-1, S-I-1: a expressão de `limpa` é a do passo (3) do Apêndice A, letra por letra.)
```sql
with por_dia as (select distinct on ((r.ran_at at time zone 'utc')::date) (r.ran_at at time zone 'utc')::date as dia, r.ran_at, r.falhas, j.d as diario, (coalesce(jsonb_typeof(j.d->'apagadas') = 'number', false) and coalesce(j.d->'pendentes' = '0'::jsonb, false) and coalesce(j.d->'atrasados_antigos' = '0'::jsonb, false) and coalesce(j.d->'estendidas_recusadas' = '0'::jsonb, false) and coalesce(case when jsonb_typeof(j.d->'intervalos') = 'number' then (j.d->>'intervalos')::numeric >= 1 end, false) and coalesce(case when jsonb_typeof(j.d->'tentativas'->'ok') = 'number' then (j.d->'tentativas'->>'ok')::numeric >= 1 end, false) and not coalesce(j.d->'tentativas' ?| array['sem_autorizacao','sem_conexao','nao_alcancado_orcamento','erro_http','schema_ausente'], true) and not exists (select 1 from unnest(r.falhas) f where f like 'diário:%' or f like 'diario:%' or f like '%yt_own_video_coverage%' or f like '%yt_own_daily_apply%' or f like '%cobertura%' or f like '%youtube_videos%')) as limpa from public.yt_own_collection_runs r cross join lateral (select r.resumo->'diario' as d) j where r.ran_at > now() - interval '10 days' order by (r.ran_at at time zone 'utc')::date desc, r.ran_at desc) select dia, ran_at, limpa, diario, falhas from por_dia order by dia desc limit 3;
```
Esperado: três linhas, dias seguidos, `limpa` verdadeiro nas três, a primeira com `ran_at` de menos de 36 horas. **Muda o quê:** se `diario` vier com outra forma (sem `apagadas`, ou em outro caminho), o Apêndice A é corrigido e a Tarefa 1 roda de novo antes de qualquer coisa. Uma das três linhas, **sem os nomes de canal nas notas**, vira a fixture real da Tarefa 6.

**Conferência pendente dentro da CP5 (emenda 1: S-I-1), respondida pela primeira execução real de P2:** a coluna `diario` de uma execução normal traz `intervalos` maior ou igual a 1, `tentativas.ok` maior ou igual a 1, `pendentes` 0, `atrasados_antigos` 0 e nenhuma das cinco chaves de falha em `tentativas`? **Muda o quê:** (a) se uma execução normal trouxer `intervalos` 0 (a API não devolveu dia nenhum para vídeo nenhum), a exigência de `intervalos` sai do Apêndice A e da CP5 e fica só a de `collected_at` recente da guarda (4), com a Tarefa 1 rodada de novo; (b) se uma execução normal trouxer `atrasados_antigos` maior que 0 ou `erro_http` (um vídeo que falha todo dia, por exemplo um vídeo tornado privado), a regra **não é afrouxada sozinha**: o portão fica vermelho, o vídeo é explicado no ledger e a decisão (consertar o vídeo, ou emendar a regra com novo parecer) vai ao controlador. Recusar é o lado seguro; aceitar seria dar por limpa uma execução com falha.

**[P3] CP6 (depois de P2): nenhuma linha vazia nova.** A K3 do plano irmão, com `:d` = `E6_P2_DEPLOY`. Esperado 0.

**[P3] CP11 (dono, no dia): a URL de conexão.** O dono copia do painel (Connect, "Session pooler"). O host exato não está em arquivo nenhum do repositório.

> Reconciliação: **Cobre** a CP18 da ordem 23.


### Grupo 5. Versões do vídeo próprio (MG12) e dieta de metadados (MG17a, MG16, MG17)

A P12 e a CP21 são a mesma leitura de `yt_own_collection_runs`: rodar a P12 com `limit 14` e usar a resposta nas duas. P2 a P15 mudam os números esperados no D0 da E18; CP2 a CP7, CP19 e CP20 podem rodar já; CP11 a CP15 são dos portões.

**[E18] P2**

- Comando: `select day_pt, count(*) n, count(*) filter (where privacy_status is null) sem_priv, count(*) filter (where thumbnail_dhash is null) sem_dhash, count(*) filter (where thumbnail_dhash is not null and thumbnail_sha256_at_capture is null) dhash_sem_sha, count(*) filter (where thumbnail_blob_url is null) sem_blob from yt_own_video_meta_daily group by 1 order by 1;`
- Esperado: um dia por linha desde 07/10, 35 por dia, `sem_priv` = 35 só em 07/10, `dhash_sem_sha` = 0
- O que muda se for diferente: dia faltando: a primeira execução nasce com um buraco, fica vermelha uma vez e segue (seção 6, linha 5). `dhash_sem_sha` maior que zero: nesses dias não há como ver retoque; o resumo conta e o plano não muda. Contagem de vídeos diferente de 35: muda o número esperado no D0 (3 × vídeos)

> Reconciliação: **Cobre** a CP5 da ordem 23 (mesmas contagens por dia, com duas colunas a mais).

**[E18] P3**

- Comando: `select youtube_video_id, count(distinct title_at_capture) titulos, count(distinct description_sha256) descricoes, count(distinct thumbnail_sha256_at_capture) sha_thumb, count(distinct thumbnail_dhash) dhashes from yt_own_video_meta_daily where privacy_status is not null group by 1 having count(distinct title_at_capture) > 1 or count(distinct description_sha256) > 1 or count(distinct thumbnail_sha256_at_capture) > 1;`
- Esperado: zero linhas
- O que muda se for diferente: qualquer linha: a primeira execução vai gravar essas trocas, e o D0 espera esse número em vez de zero. O teste do item 188 usa semente de mesma forma e não muda

**[E18] P4**

- Comando: `select count(*) from (select distinct on (youtube_video_id) * from yt_own_video_meta_daily where privacy_status is not null and description_sha256 is not null order by youtube_video_id, day_pt) x where description_text is null;`
- Esperado: número anotado (pode ser maior que zero: a primeira linha capturada, de 08/10, pode repetir o hash da linha de 07/10, que foi quem guardou o texto)
- O que muda se for diferente: nada no desenho: o passo busca o texto, **em uma leitura por canal e dia**, na linha mais recente com o mesmo hash (seção 4.3; emenda 1: D-I4, S-I4). Com P4 perto de 35, a busca de recuo acontece para quase todos os vídeos no dia 08/10 (é o esperado pelo código: `meta-step.ts:444` só grava o texto quando o hash difere do da linha anterior). Se depois da busca ainda faltar texto, o D0 mostra `desc_sem_texto` maior que zero e uma nota vermelha naquele dia

**[E18] P13 (emenda 1: S-I4)**

- Comando: `select day_pt, count(*) filter (where description_sha256 is not null) com_hash, count(*) filter (where description_text is not null) com_texto from yt_own_video_meta_daily where day_pt <= '2026-10-09' group by 1 order by 1;`
- Esperado: em 08/10, `com_texto` perto de 0 e `com_hash` perto de 35 (o texto ficou na linha de 07/10)
- O que muda se for diferente: `com_texto` perto de 35 em 08/10: a busca de recuo quase não acontece e a primeira execução faz 2 idas a menos; o desenho não muda (a busca em lote fica)

**[E18] P5**

- Comando: `select t.id, t.status, t.youtube_video_id, t.started_at, t.paused_at, t.completed_at, t.winner_applied_at, (t.original_title is not null) tem_titulo, count(c.id) ciclos, count(c.id) filter (where c.applied_metadata ->> 'title_set' is not null) com_titulo from ab_tests t left join ab_test_cycles c on c.test_id = t.id group by t.id order by t.started_at;`
- Esperado: 2 testes encerrados, 7 ciclos, de 31/05 a 07/06/2026
- O que muda se for diferente: teste `active`, `paused` ou `queued`, ou iniciado depois de 07/10: a primeira execução grava rotações e o D0 não espera "zero trocas". `com_titulo` é o número de linhas que a semente da Tarefa 11 vai gravar

**[E18] P14 (emenda 1: D-I3, S-I2; emenda 2: D-N1, S-N1)**

- Comando: `select t.id, t.status, t.test_type, t.completed_reason, (t.winner_variant_id is not null) tem_vencedor, t.paused_at, t.completed_at, t.winner_applied_at, (t.original_thumbnail_url is not null) tem_thumb_original, (t.original_thumbnail_url like '%blob.vercel-storage.com%') original_no_blob, count(c.id) filter (where (c.applied_metadata ->> 'thumbnail_set')::boolean) ciclos_com_thumb from ab_tests t left join ab_test_cycles c on c.test_id = t.id group by t.id order by t.started_at;`
- Esperado: 2 testes do tipo `combo`, encerrados; `completed_reason` de cada um **não é suposto** (anotar)
- O que muda se for diferente: não muda a regra da seção 4.4 (os caminhos estão no código, não no dado); diz qual caminho de encerramento os testes existentes tomaram. Linha com `completed_reason = 'manual_winner'` e `winner_applied_at` nulo, ou `auto_resolve` com `winner_applied_at` nulo, vira fixture dos casos 18 a 20 da Tarefa 4. `original_no_blob` falso em algum teste: nesse teste as paradas automáticas e as de reenvio condicional não devolvem a imagem (risco 3); anotar o id. Esta consulta cobre também a conferência CP4 pedida pelo parecer de dados da rodada 2 (a contagem por `completed_reason` sai da lista)

**[E18] P9**

- Comando: `select youtube_video_id, count(distinct thumbnail_sha256_at_capture) from yt_own_video_meta_daily where thumbnail_sha256_at_capture is not null group by 1 having count(distinct thumbnail_sha256_at_capture) > 1;`
- Esperado: zero linhas
- O que muda se for diferente: qualquer linha: o retoque (ou a recodificação pelo YouTube) deixou de ser teórico; a pergunta 1 e a Tarefa 5 sobem de prioridade e o D+7 da Tarefa 5 é adiantado

**[E18] P15 (emenda 1: S-m5)**

- Comando: `select count(*) from (select distinct on (youtube_video_id) youtube_video_id, privacy_status from yt_own_video_meta_daily where privacy_status is not null order by youtube_video_id, day_pt) x where privacy_status = 'private';`
- Esperado: 0
- O que muda se for diferente: maior que zero: a linha de base de thumbnail desses vídeos, aberta com a linha de 07/10 (sem privacidade conhecida), pode ser a imagem de substituição do YouTube (risco 15). O controlador anota os ids; o plano não muda

**[E18] P11**

- Comando: `select id, name, sync_enabled, collection_status, video_count from youtube_channels; select channel_id, count(*) from yt_own_video_meta_daily where day_pt >= current_date - 3 group by 1;`
- Esperado: 2 canais, os dois com linha nos últimos dias
- O que muda se for diferente: canal com vídeos e sem linha: o passo nasce vermelho para ele (é o comportamento certo, item 189); avisar antes do envio para não surpreender

**[E18] P8**

- Comando: `select min(day_pt), max(day_pt), count(*), count(distinct youtube_video_id), coalesce(sum(thumbnail_impressions) filter (where day_pt >= current_date - 30), 0) imp_30d from yt_own_video_reach_daily;`
- Esperado: por volta de 158 impressões em 30 dias (12/10)
- O que muda se for diferente: só o texto do relatório da etapa: com o limiar em 100 por lado, toda troca de hoje dá "ainda não dá para dizer"

**[E18] P12**

- Comando: `select ran_at, ms_total, ms_passos from yt_own_collection_runs order by ran_at desc limit 7;`
- Esperado: `ms_total` com folga de mais de 5 s para os 270 s; `ms_passos.metadados` bem abaixo de 30 s
- O que muda se for diferente: folga menor que 5 s em alguma execução: o bloco do passo vai para o fim da fase `'depois'` em vez da fase `'antes'` (desvio 6 diz como). **Mover não é só mover um bloco** (emenda 1: S-m8): exige a tarefa 7b descrita no desvio 6. A mesma resposta dá o tempo real por ida ao banco, que troca os 50 ms estimados da seção 5.2 (emenda 1: D-I4)

**[O23] CP21 (já, e de novo antes da Tarefa 3; emenda 1: S-m-2): quanto do teto de 30 s o passo de metadados já gasta.**
```sql
select ran_at, ms_passos->>'metadados' as ms from public.yt_own_collection_runs order by ran_at desc limit 14;
```
Esperado: não medido. **Muda o quê:** todas abaixo de 20.000: a chamada da cobertura segue no prazo do passo (`ctx.deadline`), como está. Alguma acima de 25.000: a cobertura sairia `sem_tempo` nesses dias e as 14 execuções nunca fechariam; a chamada ganha prazo próprio (como `TETO_CAPTURA_MS` faz para a captura) **antes** da Tarefa 3, por emenda com parecer. Entre 20.000 e 25.000: anotar, seguir, e conferir de novo na `e18p2-cob-d1`. `ms` nulo = o passo não rodou naquela execução: não conta como "abaixo".

**[O23] CP9 (portão D): as variáveis.** `vercel env ls production | grep -E "YT_OWN_STEPS_OFF|YT_OWN_META_DIETA_OFF"` (dono ou controlador). Esperado: as duas ausentes, ou a primeira sem `versoes`. **Muda o quê:** com a dieta desligada a migration apagaria o acumulado e o cron não enxugaria mais: tirar a variável antes.

> Reconciliação: **Cobre** a P10 da E18 (que olha só `YT_OWN_STEPS_OFF`). Lembrar a R4: mudar qualquer das duas exige redeploy.

**[O23] CP2 (já): tamanho e forma da tabela diária.**
```sql
select count(*) as linhas, count(distinct youtube_video_id) as videos, count(distinct site_id) as sites, count(distinct channel_id) as canais, min(day_pt) as de, max(day_pt) as ate, pg_total_relation_size('public.yt_own_video_meta_daily') as bytes from public.yt_own_video_meta_daily;
```
Esperado: cerca de 35 linhas por dia desde 07/10; `sites` 1; `canais` 2. **Muda o quê:** os números da pergunta 1. `sites` maior que 1 não muda o SQL (as funções percorrem os sites), mas as conferências passam a rodar uma vez por site.

**[O23] CP2b (já): as colunas.**
```sql
select count(*) as n, string_agg(a.attname, ',' order by a.attname) from pg_attribute a where a.attrelid = 'public.yt_own_video_meta_daily'::regclass and a.attnum > 0 and not a.attisdropped;
```
Esperado: 25 nomes, a lista em ordem alfabética do bloco 0 do Apêndice C. **Muda o quê:** nome a mais ou a menos corrige a lista do Apêndice C e as listas de colunas do Apêndice D (a regra de comparação não muda: ela compara a linha inteira).

**[O23] CP3 (já, e de novo no portão D): quantas linhas são "do meio".**
```sql
with l as (select m.privacy_status, m.ab_test_id, (to_jsonb(m) - 'day_pt' - 'captured_at') as t, lag(to_jsonb(m) - 'day_pt' - 'captured_at') over w as ta, lead(to_jsonb(m) - 'day_pt' - 'captured_at') over w as ts, lead(m.day_pt) over w as ds, max(m.day_pt) over (partition by m.channel_id) as ate from public.yt_own_video_meta_daily m window w as (partition by m.youtube_video_id order by m.day_pt)) select count(*) as linhas, count(*) filter (where ta is null) as primeiras, count(*) filter (where ta is not null and t <> ta) as mudancas, count(*) filter (where ta is not null and ts is not null and t = ta and ts = t and ds < ate and privacy_status is not null and ab_test_id is null) as do_meio, count(*) filter (where privacy_status is null) as sem_privacidade from l;
```
Esperado em 12/10 (não medido): `primeiras` 35; `mudancas` perto de 70 (a linha de 08/10 difere da de 07/10 na privacidade, e a de 09/10 difere da de 08/10 em `description_text` e `tags`, que só a primeira linha com captura traz); `do_meio` crescendo cerca de 35 por dia. (emenda 1: D-I-2, D-m-3) A consulta aplica a regra 8 (linha de dia de teste A/B não conta) e **não** aplica a regra 9 (fronteira de versão, que precisa das tabelas da MG12): por isso é um teto, e o número exato é o `do_meio` que a MG17 anota no comentário. **Muda o quê:** `do_meio` 0 depois de muitos dias quer dizer que alguma coluna muda todo dia sem que se saiba (a regra não apagaria nada): descobrir qual antes de seguir, com `select key, count(*) from (…) group by 1` sobre as chaves que diferem entre vizinhas; o plano não afrouxa a regra sozinho.

**[O23] CP4 (já, e de novo no portão D): teste A/B e segundos gravados.**
```sql
select count(*) filter (where ab_test_id is not null) as com_teste, count(*) filter (where seconds_on_air_analytics is not null or seconds_on_air_reporting is not null) as com_segundos from public.yt_own_video_meta_daily;
```
Esperado: 0 e 0 (os dois testes acabaram em junho). **Muda o quê:** maior que zero não muda regra (emenda 1: D-I-2: linha com `ab_test_id` nunca é "do meio", pela regra 8); a Tarefa 6 já testa o caso; anotar no ledger.

**[O23] CP6 (já): buraco por vídeo.**
```sql
select count(*) as videos_com_buraco from (select youtube_video_id from public.yt_own_video_meta_daily group by 1 having count(*) <> max(day_pt) - min(day_pt) + 1) x;
```
Esperado 0. **Muda o quê:** buraco antigo é dia sem linha e sem cobertura: continua "ausência" depois da dieta (não é coberto). Só o número muda nas conferências.

**[O23] CP7 (já, e de novo no portão D): quem no banco cita a tabela.**
```sql
select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosrc ilike '%yt_own_video_meta_daily%' union all select 'visão: ' || viewname from pg_views where definition ilike '%yt_own_video_meta_daily%' union all select 'gatilho: ' || tgname from pg_trigger where tgrelid = 'public.yt_own_video_meta_daily'::regclass and not tgisinternal union all select 'job: ' || jobname from cron.job where command ilike '%meta_daily%' union all select 'chave estrangeira de: ' || conrelid::regclass::text from pg_constraint where contype = 'f' and confrelid = 'public.yt_own_video_meta_daily'::regclass order by 1;
```
Esperado hoje (emenda 1: S-m-5, D-m-6): **só** `competitor_hourly_health`, e nenhuma linha "chave estrangeira de". A `youtube_channel_removal_impact` conta pelo catálogo de chaves estrangeiras e não cita a tabela no corpo (`supabase/migrations/20261013000002_observatorio_a5_e15_leitura_horaria.sql:315-386`): ela não aparece, e isso não é defeito. No portão D: mais as da MG12 (`yt_own_versions_apply_day`, `yt_own_versions_prova`) e as três da MG17a (`yt_own_meta_cover_set`, `yt_own_meta_prova`, `yt_own_meta_cover`). **Muda o quê:** nome fora da lista é leitor novo: lido e posto na tabela de F5 e no teste "os leitores respondem o mesmo" antes da MG17.

**[O23] CP19 (já; emenda 1: D-I-3, S-I-2): dias com mais de uma execução do cron.**
```sql
select (ran_at at time zone 'utc')::date as dia, count(*) as execucoes from public.yt_own_collection_runs where ran_at > now() - interval '30 days' group by 1 having count(*) > 1 order by 1;
```
Esperado: não medido. **Muda o quê:** nenhuma linha: a reexecução é só risco do futuro, e a regra por dia do Apêndice C fica como defesa. Com linhas: a reexecução acontece de verdade; no portão D, a K3 mostra o detalhe de cada uma (`base`, `confirmou`, `sem_dia_novo`), e uma reexecução boa que não passe em `base` emenda o Apêndice C com novo parecer (a regra não é afrouxada sozinha). Antes de o passo de versões estar em produção não há `resumo.versoes`: a consulta só responde "acontece ou não".

**[O23] CP20 (já; emenda 1: D-m-4): a metade de metadados da regra, contra uma execução real.** `resumo.metadados` é gravado em produção desde 07/10.
```sql
select ran_at, resumo->'metadados' as m, falhas from public.yt_own_collection_runs order by ran_at desc limit 3;
```
Comparar à mão com as condições do bloco (4) do Apêndice C: `gravados` é número maior ou igual a 1; `pendentes` é 0; `tentativas.ok` é número maior ou igual a 1; `tentativas` não tem `sem_autorizacao`, `sem_conexao`, `nao_alcancado_orcamento` nem `schema_ausente`; `dias_sem_meta` é um objeto não vazio com todo valor 0; nenhuma nota começa por `metadados:`. **Muda o quê:** se uma execução boa de verdade não passar numa dessas, o Apêndice C é emendado **agora**, com novo parecer, e não no portão D. Se passar, o risco 3 fica só com a metade de versões e de cobertura, que ainda não tem linha real.

**[O23] CP11 (portão P): o backup.**
```sql
select count(*) as linhas, pg_total_relation_size('public.yt_own_video_daily_zeros_bkp') as bytes, obj_description('public.yt_own_video_daily_zeros_bkp'::regclass, 'pg_class') as nota from public.yt_own_video_daily_zeros_bkp;
```
Esperado: `nota` começando por `MG15 ` com `estado: apagado`, e `linhas` igual à soma de `apagadas`. **Muda o quê:** nota nula com linhas, ou contagem diferente: a MG16 recusa; descobrir antes.

**[O23] CP12 (portão P): nada depende do backup.**
```sql
select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosrc ilike '%yt_own_video_daily_zeros_bkp%' and p.proname <> 'yt_own_daily_bkp_soltar' union all select 'visão: ' || viewname from pg_views where definition ilike '%yt_own_video_daily_zeros_bkp%';
```
Esperado: nenhuma linha. **Muda o quê:** linha achada: a MG16 recusa. (emenda 1: D-m-6) A própria `yt_own_daily_bkp_soltar` fica de fora da busca: ela só sobra no banco depois de uma recusa em cliente que não aplique o arquivo numa transação só, e quem a procura é a leitura "Depois de uma recusa" do Apêndice E.

**[O23] CP13 (depois do código da cobertura; e no portão D): a prova da cobertura, por canal.**
```sql
select c.id, public.yt_own_meta_prova(c.site_id, c.id, (select max(day_pt) from public.yt_own_video_meta_daily m where m.channel_id = c.id)) from public.youtube_channels c where exists (select 1 from public.yt_own_video_meta_daily m where m.channel_id = c.id);
```
Esperado: `descobertas` 0 e `sem_explicacao` 0, com `linhas` maior que zero. **Muda o quê:** `linhas` 0 = nada foi avaliado. Qualquer número diferente de zero trava o portão D.

**[O23] CP14 (portão D): as 14 execuções limpas, pela regra da migration.** A consulta é o bloco (4) da função `yt_own_meta_diet` do Apêndice C, letra por letra, com `now()` no lugar de `p_agora` e devolvendo, dos 14 dias mais recentes, `dia, ultima, execucoes, limpa` e o detalhe de cada execução do dia (o texto inteiro está na seção 11, K3). Esperado: 14 linhas, uma por dia (emenda 1: D-I-3, S-I-2), 14 dias seguidos, `limpa` verdadeiro em todas, a primeira com a última execução há menos de 24 horas (emenda 1: D-m-8). **Muda o quê:** se o formato real de `resumo.metadados.cobertura` ou de `resumo.versoes` não for o que a regra lê, **o Apêndice C é corrigido antes** e as Tarefas 6 e 10 rodam de novo. Uma das 14 linhas, sem nomes de canal nas notas, vira a fixture real da Tarefa 15.

**Conferência pendente dentro da CP14, respondida pela primeira execução real:** uma execução normal traz `metadados.tentativas.ok` maior ou igual a 1, `pendentes` 0, `dias_sem_meta` com todos os canais em 0, `cobertura.ok` igual a `cobertura.canais`, e `versoes.confirmadas` maior ou igual a 1 com `atraso_dias` 0 em todo canal? **Muda o quê:** se uma execução boa de verdade não passar na regra (por exemplo, um canal sem vídeo publicado que nunca entra em `dias_sem_meta`), a regra **não é afrouxada sozinha**: o portão fica vermelho, o caso vai ao controlador e a novo parecer (a mesma regra do achado m-2 do parecer de dados da rodada 2 do plano P3).

**[O23] CP15 (portão D): a prova das versões.** A K2 do plano E18 (0) e `select origin, count(*) from public.yt_own_video_versions group by 1;` com `cms` ausente. **Muda o quê:** diferente disso, a MG17 não roda.


### Grupo 6. Cowork (E7)

Sem a P-2 o Lote 1 não vai. A P-8b roda antes de cada commit que dispara a semente. A P-12 é leitura do painel da Vercel.

**[E7] P-2. Quantas mudanças de campo existem, de quais campos e de que tamanho?** Decide se o teto de 100 linhas basta e se há valor grande.
```sql
select field, (video_id is null) as do_canal, count(*) filter (where precision <> 'first') as mudancas, max(length(value::text)) as bytes_max, min(first_seen_at) as desde from public.competitor_field_versions group by 1, 2 order by 3 desc;
```
Se `bytes_max` de algum campo que sai passar de 2.000: a Tarefa 4 ganha um corte por valor (texto cortado em 500 caracteres, com `cortado_em` no item) antes do envio. Se toda `mudancas` for zero: o D0 espera `estado: 'lido'`, `count: 0` e `coleta_desde` com data. Se a tabela estiver vazia: espera `nao_lido`, `coleta_ainda_nao_comecou` (e isso contradiz o brief, que dá a E1 em produção: parar e avisar).

**(emenda 1: d:I-4, d:m-1) Segunda consulta da P-2: o volume por dia e por campo, e o tamanho da tabela.**
```sql
select (first_seen_at at time zone 'America/Sao_Paulo')::date as dia, field, count(*) as mudancas from public.competitor_field_versions where precision <> 'first' group by 1, 2 order by 1 desc, 3 desc;
select count(*) as linhas, count(*) filter (where precision = 'first') as primeiras from public.competitor_field_versions;
```
O ramo, com número: somando só os campos que saem (lista da Tarefa 4), **se algum dia tiver mais de 100 mudanças, ou se a soma de 7 dias seguidos passar de 100, o Lote 1 só vai com a continuação da leitura** (o contrato está escrito em 4.3, "Continuação", e a Tarefa 4 ganha os testes dela). Abaixo disso, o Lote 1 vai sem a continuação, e o documento diz o que `cortado: true` significa e o que fazer (Tarefa 7). Sem a resposta da P-2 o Lote 1 não vai. `linhas` é o número que o Apêndice A compara com 200.000; a conta de ordem de grandeza está na seção 5. **(emenda 2: d:m-3)** A captura de campos começou em 12/10: a P-2 anota no ledger **quantos dias de dado** a consulta viu (o número de valores distintos de `dia`). Com menos de 7 dias a regra "soma de 7 dias seguidos" ainda não pôde ser aplicada inteira, e por isso a mesma consulta é repetida na `e7-l1-d7` com o mesmo ramo (Tarefa 9).

**[E7] P-1. O perfil está preenchido?** Decide o que o D0 do Lote 1 espera.
```sql
select count(*) as canais, count(custom_url) as com_handle, count(country) as com_pais, count(published_at) as com_criacao, count(last_seen_at) as relidos, (select count(distinct competitor_channel_id) from public.competitor_field_versions where video_id is null and field = 'custom_url' and is_current) as com_versao_de_handle from public.competitor_channels;
```
Esperado: `com_versao_de_handle` = `canais` (todo canal foi relido depois da E1). Se for menor: a diferença sai `nao_lido`, motivo `canal_ainda_nao_relido`, e o esperado do D0 passa a ser esse número. `com_pais` menor que `canais` é normal (o YouTube não obriga país). **(emenda 1: s:m6)** Como a prova do perfil passou a ser as **duas** versões correntes (handle e país, 4.2), a P-1 ganha uma segunda consulta, e o número que o D0 espera em `lido` é o dela:
```sql
select count(*) as com_as_duas_versoes from (select competitor_channel_id from public.competitor_field_versions where video_id is null and is_current and field in ('custom_url', 'country') group by 1 having count(distinct field) = 2) t;
```
Esperado: igual a `com_versao_de_handle` (as duas versões nascem na mesma leitura). Se for menor: anotar a diferença (canais com handle lido e país não), que sai `nao_lido`, e avisar, porque contradiz o que o código da coleta faz (`competitor-capture.ts:176-184`).

**[E7] P-15. (emenda 2: d:I-2b) Até quando os vídeos foram lidos?** Decide o que o D0 do Lote 1 espera na ponta dos vídeos e o que o documento diz de `videos_mais_antigo`. Só leitura:
```sql
select count(*) as videos, count(last_seen_at) as com_leitura, min(last_seen_at) as mais_antiga, max(last_seen_at) as mais_recente, count(*) filter (where last_seen_at < now() - interval '8 days') as mais_de_8_dias from public.competitor_videos where missing_since is null;
```
`mais_recente` do dia (ou de ontem, antes da coleta): é o esperado de `lido_ate.videos_mais_recente` na `e7-l1-d0`. `mais_recente` mais antiga que isso: a captura de vídeo está parada **hoje**; parar e avisar antes do envio (não é defeito desta etapa, mas é exatamente o que ela passaria a mostrar). `mais_de_8_dias` maior que zero: há vídeo que nenhuma faixa relê, `videos_mais_antigo` não serve de sinal de coleta parada, e o documento (Tarefa 7) diz isso com a frase escrita lá; o campo continua saindo, porque é dado. `videos` menos `com_leitura` maior que zero: há vídeo nunca lido desde a E1, que não entra em nenhuma das duas pontas; o documento diz, e fica a dívida 11.

**[E7] P-4. Quanto pesa uma chamada?** Decide o teto de tempo e se a resposta cabe.
```sql
select count(*) as canais, (select count(*) from public.competitor_videos) as videos, (select count(*) from public.competitor_video_daily) as leituras_diarias, (select count(*) from public.competitor_channel_snapshots where snapshot_date > current_date - 120) as retratos_120d from public.competitor_channels;
```
Com `canais` até 20 e `videos` até 2.500, vale a conta da seção 5. Acima disso, refazer a conta antes do Lote 2 e, se o total de consultas passar de 200, baixar `CANAIS_EM_PARALELO` não ajuda: a Tarefa 12 passa a ler os vídeos de todos os canais numa consulta só (pedido novo ao plano, não improviso).

**[E7] P-5. Quem lê estas rotas hoje, e com que chave?**
```sql
select after_data->>'key_name' as chave, after_data->>'rota' as rota, count(*) as vezes, min(created_at) as primeira, max(created_at) as ultima from public.audit_log where action = 'pipeline_leitura_aviso' and after_data->>'rota' like '%competitors%' group by 1, 2 order by 1, 2;
```
Só cobre HTTP desde 12/10 e **não cobre o MCP** (`/api/mcp` não passa por `authenticateRead`). Se `forja (so leitura)` ou `forja (fila)` aparecer em `channels` ou `changes`: rodar a P-7 antes do envio e levar a pergunta 8 ao dono com o fato. Se só `cowork-permanent`: seguir. Zero linhas não prova que ninguém usa. **(emenda 1: d:m-6)** Dois limites a mais, conferidos em `leitura-registro.ts:172-181`: a linha de uma chave que **tem** `read` (o caso de `cowork-permanent`) só é gravada enquanto o controle estiver aberto, então depois do veredito da E19 (20/10) ou do fechamento do controle ela deixa de aparecer, e zero linhas passa a ser o normal; e a rota é gravada sem a query (`rotaNormalizada(pathname)`), então a P-5 nunca distingue `changes` de `changes?campos=todos`.

**[E7] P-8b. (emenda 1: s:I6) O banco tem o mesmo texto que o disco?** Rodar **antes** de cada commit que dispara a semente (os das Tarefas 7 e 14 e os reverts da volta), junto com a P-8, só leitura:
```sql
select key, version, updated_at, md5(coalesce(content_md, '')) as md5_banco from public.reference_content where key not like '%-memory' order by key;
```
comparada com `md5 -q <arquivo>` de cada arquivo que o script lê. Igual em todas as entradas de arquivo: seguir. Diferente em alguma: **parar**, porque a semente apagaria uma edição feita em produção; a decisão é do dono. As entradas de sistema (sem arquivo) não têm com o que comparar: anotar a `version` e o `updated_at` de antes, e rodar a mesma consulta depois do commit para ver o que o carimbo mudou (é o que responde se `version` sobe com conteúdo igual).

**[E7] P-10. (emenda 1: d:I-3) Quantos dias de retrato cada canal tem?** Decide o que o D0 do Lote 2 e a conferência de 15/12 esperam por canal. Rodar antes do Lote 2:
```sql
select c.channel_name, c.added_at::date as entrou, min(s.snapshot_date) as primeiro, max(s.snapshot_date) as ultimo, count(*) filter (where s.view_count is not null) as dias_com_views, (max(s.snapshot_date) - min(s.snapshot_date)) as cobertura_dias from public.competitor_channels c left join public.competitor_channel_snapshots s on s.competitor_channel_id = c.id group by 1, 2 order by 6 nulls first;
```
A queda de M8 precisa de cinco bordas em 112 dias. Canal com `cobertura_dias` menor que 112 tem a queda não medida por falta de borda, antes e depois de 14/12/2026, e a data em que ela fecha é `primeiro` mais 112 dias (anotar por canal no ledger). Qual motivo aparece quando faltam bordas **e** a janela cruza a mudança de contagem, o plano da E4 não diz: é a pergunta (i) da Tarefa 10. Por isso nenhuma conferência deste plano escreve um número de canais por motivo.

**[E7] P-12. (emenda 1: s:m10) Qual o tempo máximo de função do projeto na Vercel?** Leitura do painel (Project Settings, Functions, "Function Max Duration"), do dono ou do controlador. Se for 60 s ou menos: `maxDuration = 60` não baixa nada. Se for maior: a rota `channels` passa a ter um teto **menor** que o de hoje; o desenho não muda (o prazo do pedido é 40 s, seção 5), e o fato fica anotado no ledger e no relatório da Tarefa 13. **(emenda 2: d:m-4)** Nesse ramo (teto do projeto maior que 60 s), antes do envio do Lote 2 confere-se o `time_total` que o dono devolveu na terceira linha dos comandos do Lote 1 (seção 2): abaixo de 30 s, seguir; **30 s ou mais, parar**, porque a rota de hoje já anda perto do teto novo e `maxDuration = 60` passaria a matar chamadas que hoje respondem (a decisão é do dono: enviar sem `maxDuration`, ou antes consertar a dívida 10).


### Grupo 7. Números que mudam contas e esperados, não o desenho

Podem rodar junto de qualquer outra leva.

**[E4] C-2. Quantos pares de leituras diárias seguidas passam de 36 horas?** Decide a pergunta 2. Abaixo de 10% dos pares: fica 36 horas. Acima: o controlador propõe 48 horas antes do envio (um número e `ruleVersion`).
```sql
with p as (select d.video_id, d.taken_at, lag(d.taken_at) over (partition by d.video_id order by d.taken_at) as ant from public.competitor_video_daily d join public.competitor_videos v on v.id = d.video_id where v.series_tier = 'diaria') select count(*) filter (where ant is not null) as pares, count(*) filter (where taken_at - ant > interval '36 hours') as acima_de_36h, count(*) filter (where taken_at - ant > interval '48 hours') as acima_de_48h, min(extract(hour from taken_at at time zone 'America/Sao_Paulo')) as menor_hora_sp, max(extract(hour from taken_at at time zone 'America/Sao_Paulo')) as maior_hora_sp from p;
```

**[E4] C-3. Quantos vídeos foram publicados desde 03/10 e três candidatos para o item 29.** Esperado pelo spec: 39. Outro número: corrigir a conta de volume da seção 5 e as datas da Tarefa 18. **(emenda 1: d:I-2, s:I1) A mesma consulta dá o tamanho da carga inicial:** pares no pior caso = `(todos − sem_data) × 3`, e execuções para zerá-la = `teto(pares ÷ 1.500)`; o controlador escreve os dois números na seção 5.2. A conferência que o parecer de software pediu é esta, com as colunas que já existiam.
```sql
select count(*) filter (where published_at >= timestamptz '2026-10-03 00:00:00-03') as desde_03_10, count(*) as todos, count(*) filter (where published_at is null) as sem_data from public.competitor_videos;
select v.id, v.video_id, v.published_at, v.live_actual_start_at, count(d.*) as pontos, min(d.taken_at) as primeiro, max(d.taken_at) as ultimo from public.competitor_videos v join public.competitor_video_daily d on d.video_id = v.id where v.published_at >= timestamptz '2026-10-03 00:00:00-03' and v.published_at <= now() - interval '9 days' group by 1, 2, 3, 4 order by v.published_at limit 20;
```

**[E4] C-8. As primeiras horas existem, e com que distância?** Esperado: linhas só de 13/10 12:27 em diante, cerca de 6 horas entre leituras. Se `acima_de_8h` for a maioria, a marca de 1 dia quase nunca será medida até a leitura horária (E15) entrar: o desenho não muda, e a seção 13 já diz isso. **(emenda 2: d:m-3, s:n1) O que isso faria com o aviso, e o que o plano faz:** cada marca de 1 dia perdida por distância seria uma `perdida`, e o disparo ficaria vermelho quase todo dia. Como a frequência é fato não medido, a idade 1 **não entra** no vermelho (`MEASURE_RULES.lost.alarmAges` é `[7, 30]`): conta em `perdidas_1`, no detalhe e na tabela de motivos. A `e4-d7` mede a taxa com o Lote B em produção; abaixo de 10% dos pares de idade 1, o controlador propõe pôr o 1 em `alarmAges` (um número); acima, fica fora e o risco 1 diz por quê.
```sql
with p as (select video_id, taken_at, lag(taken_at) over (partition by video_id order by taken_at) as ant from public.competitor_video_early) select count(*) as linhas, count(distinct video_id) as videos, min(taken_at) as primeira, count(*) filter (where taken_at - ant > interval '8 hours') as acima_de_8h, count(*) filter (where ant is not null) as pares from p;
```

**[E4] C-17 (emenda 2: s:n1). Quantas marcas de 1 dia já nascem perdidas por desenho?** Vídeos de 03/10 em diante que só têm série diária ao redor do primeiro dia (as primeiras horas só existem desde 13/10 12:27): a distância entre as vizinhas é de 24 horas contra o limite de 8, e o par sai `leituras_distantes`. O número é o `perdidas_1` esperado na carga do D0. **Não deixa o disparo vermelho** (C-8); serve para o controlador conferir o detalhe e a consulta das perdas da Tarefa 18. Muito diferente do `perdidas_1` lido no D0: parar e olhar `marcaPerdida`.
```sql
select count(*) as idade_1_perdida_por_desenho from public.competitor_videos v where v.published_at >= timestamptz '2026-10-03 00:00:00-03' and v.published_at <= now() - interval '33 hours' and coalesce(v.live_broadcast_content, 'none') not in ('upcoming', 'live') and exists (select 1 from public.competitor_video_daily d where d.video_id = v.id and d.taken_at < v.published_at + interval '1 day') and not exists (select 1 from public.competitor_video_early e where e.video_id = v.id and e.taken_at between v.published_at + interval '16 hours' and v.published_at + interval '1 day');
```

**[E4] C-15 (emenda 1: d:C-1). Quantos vídeos estão agendados ou no ar, e em quantos a base da idade anda mais de 1 dia?** Mede o tamanho do defeito que a emenda consertou. As duas colunas do meio em zero: o caso ainda não aconteceu com os canais de hoje; o conserto fica assim mesmo. `agendados_ou_no_ar` maior que zero: esses vídeos não têm par pendente nem atrasado, e isso é o esperado (conferir na `e4-d0`). Antes de 20/10 `live_broadcast_content` ainda é nulo em quem não foi relido (nulo conta como "nem agendado nem no ar").
```sql
select count(*) filter (where live_broadcast_content in ('upcoming', 'live')) as agendados_ou_no_ar, count(*) filter (where live_scheduled_start_at > published_at + interval '1 day') as agendado_mais_de_1_dia_depois, count(*) filter (where live_actual_start_at > published_at + interval '1 day') as comecou_mais_de_1_dia_depois, count(*) filter (where was_live) as ao_vivo_ou_estreia, count(*) filter (where live_broadcast_content is null) as estado_ainda_nulo from public.competitor_videos;
```

**[E4] C-4. Sinalizadores ainda nulos.** Só tem sentido a partir de 20/10 (uma passada semanal completa). `was_live_nulo` alto: a medida trata nulo como "não se sabe" e mantém o vídeo na mediana (o spec só tira o verdadeiro), dizendo quantos são. `is_short_nulo`: tamanho do efeito da pergunta 6.
```sql
select count(*) as videos, count(*) filter (where was_live is null) as was_live_nulo, count(*) filter (where was_live) as ao_vivo_ou_estreia, count(*) filter (where live_actual_start_at > published_at) as base_muda_com_a_estreia, count(*) filter (where likes_hidden is null) as likes_hidden_nulo, count(*) filter (where comments_disabled is null) as comments_disabled_nulo, count(*) filter (where discovered_at is null) as discovered_at_nulo, count(*) filter (where is_short is null) as is_short_nulo, count(*) filter (where missing_since is not null) as ausentes from public.competitor_videos;
```

**[E4] C-7. Zeros que podem ser ausência.** Se `curtidas_zero_ambiguo` ou `comentarios_zero_ambiguo` passar de zero, vale a regra já escrita em M7 (Tarefa 5): zero com sinalizador nulo é "não medido" (emenda 1: d:m-5: o sinalizador nulo É o sinal de "ainda não relido depois da E1"; não há data no código).
```sql
select count(*) filter (where like_count = 0 and likes_hidden is null) as curtidas_zero_ambiguo, count(*) filter (where comment_count = 0 and comments_disabled is null) as comentarios_zero_ambiguo from public.competitor_videos;
```

**[E4] C-11. E14 e E15 já escrevem em produção?** Esperado: zero linhas (código local). Com linhas, M11 e M12 já têm insumo e a Tarefa 15 sobe de prioridade.
```sql
select (select count(*) from public.competitor_video_comment_snaps) as retratos, (select count(*) from public.competitor_video_hourly) as horarias;
```

**[E9] CP1**

- Comando: `select (select count(*) from competitor_videos where missing_since is not null) as videos_ausentes, (select count(*) from competitor_videos where miss_streak > 0 and missing_since is null) as com_uma_falta, (select count(*) from competitor_channels where missing_since is not null) as canais_ausentes, (select count(*) from competitor_video_comments where missing_since is not null) as comentarios_ausentes, (select count(*) from competitor_removed_items) as ja_apagados, (select count(*) from competitor_videos where removal_decision is not null) as mantidos;`
- O que muda: Tudo zero (o esperado enquanto a E1 não está em `main`): a primeira prova em produção só acontece no D+1 da E1 ou depois. `videos_ausentes > 0`: a conferência `e9-d0` ganha a leitura do painel de um item real **antes** de qualquer "apagar". `ja_apagados > 0`: alguém gravou fora do código; parar e avisar

**[E9] CP6**

- Comando: `select count(*) filter (where thumb_blob_url like '%/observatorio/thumbs/%') as no_prefixo, count(*) filter (where thumb_blob_url not like '%/observatorio/thumbs/%') as fora, count(*) as total from competitor_video_versions where thumb_blob_url is not null; select count(*) from competitor_videos where thumbnail_url like '%blob.vercel-storage.com%' or original_thumbnail_url like '%blob.vercel-storage.com%';`
- O que muda: (emenda 1: S-m3; a frase anterior dizia "nada muda no código" e contradizia a Tarefa 5) A Tarefa 5 **recusa** URL que não contém `/observatorio/thumbs/`: com `fora > 0` essas URLs ficariam em `blobs_pending` para sempre e o cron ficaria vermelho depois de 24 h. Então, com `fora > 0`: parar antes da Tarefa 5 e fechar com o controlador a forma aceita (a regra da Tarefa 5 passa a aceitar a forma real medida, com teste). Com `fora = 0` (o esperado: há um escritor só, `thumb-fingerprint.ts:104`), nada muda; a saída para uma entrada recusada que apareça depois é o comando K7 da seção 11, que o dono cola. Segunda consulta maior que 0: há arquivo do Blob apontado pela linha do vídeo que nenhuma versão cita; a Tarefa 2 acrescenta essas duas colunas à lista de URLs da função

**[E9] CP9**

- Comando: para o maior canal: `select c.channel_name, (select count(*) from competitor_videos v where v.competitor_channel_id = c.id) as videos, (select count(*) from competitor_video_daily d join competitor_videos v on v.id = d.video_id where v.competitor_channel_id = c.id) as dias, (select count(*) from competitor_video_versions x join competitor_videos v on v.id = x.video_id where v.competitor_channel_id = c.id and x.thumb_blob_url is not null) as miniaturas from competitor_channels c order by 2 desc limit 3;`
- O que muda: Fecha a conta da seção 5 (tempo do `delete` e quantos disparos o Blob leva). Canal com mais de 2.000 vídeos: o teto de 2.000 prefixos por item (Tarefa 5) corta, e o resto fica em `blobs_pending`. (emenda 1: D-I4) Esta consulta conta só três tabelas e vale como piso. A conta inteira, por catálogo, é `select public.competitor_cascade_counts('canal', '<id do maior canal>');` (depois da MG-E9; no banco de integração já na Tarefa 1), e é ela que fecha a conta da seção 5

**[E9] CP14**

- Comando: (emenda 1: D-I4 e S-I6) `select (select count(*) from competitor_changes) as mudancas, (select count(*) from youtube_intelligence_tasks) as tarefas, (select count(*) from competitor_readings) as leituras, (select count(*) from competitor_video_daily) as dias, (select count(*) from competitor_video_hourly) as horas;`
- O que muda: Dá o tamanho das tabelas que a CP13 pode apontar, e a base da estimativa de tempo de "apagar canal" (seção 5)

**[E9] CP5**

- Comando: `select task_type, status, count(*), max(started_at) from youtube_intelligence_tasks where task_type <> 'diagnostico' group by 1, 2 order by 1, 2; select count(*) from competitor_readings where video_id is not null;`
- O que muda: Diz se `leitura-video` é usada. Zero tarefas com alvo: a recusa fica provada só por teste e isso vai em "o que nenhum teste prova" como não visto em produção

**[E9] CP7**

- Comando: `select count(*) as leituras_de_nicho from competitor_readings where video_id is null; select count(*) as citam_video from competitor_readings r where r.video_id is null and exists (select 1 from competitor_videos v where r.sent::text like '%' || v.video_id || '%' or r.evidence::text like '%' || v.video_id || '%');` e (emenda 1: D-M1) `select count(*) as pacotes_de_nicho, count(*) filter (where exists (select 1 from competitor_videos v where t.sent::text like '%' || v.video_id || '%')) as pacotes_citam_video from youtube_intelligence_tasks t where t.target_video_id is null and t.sent is not null;`
- O que muda: `citam_video > 0` confirma o resíduo (pergunta 4 ao dono). O padrão não muda: a linha no painel é verdadeira nos dois casos. `pacotes_citam_video > 0` confirma o segundo resíduo (o pacote enviado à forja, guardado em `youtube_intelligence_tasks.sent`, que a cascata não alcança nas tarefas de nicho): a linha do painel já o cobre (desvio 8)

**[E9] CP10**

- Comando: `select tablename, policyname, cmd, qual from pg_policies where tablename = 'competitor_removed_items'; select relrowsecurity from pg_class where oid = 'public.competitor_removed_items'::regclass;`
- O que muda: Esperado: uma policy `SELECT` com `can_edit_site(site_id)` e `true`. Repetir depois da MG11 (lote C): se ela trocar a policy, avisar (a fila é de quem edita, não de quem tem o direito de desempenho privado)

> Reconciliação: A MG11 não troca essa policy (a tabela não está na lista das doze): a repetição depois do lote C deve dar o mesmo.

**[E10] C3**

- Pergunta: As maiores relações (de onde vêm os "20 MB por ano do site")
- Comando: `select n.nspname, c.relname, pg_total_relation_size(c.oid) as bytes from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind in ('r','m') order by 3 desc limit 30;`
- O que muda: Os prefixos de `own_bytes` (hoje `yt_own_` e `yt_reporting_`). A partir do deploy a mesma lista fica gravada por dia em `top_relations`

**[E10] C4**

- Pergunta: Linhas e bytes das tabelas de concorrente, e vídeos por canal
- Comando: `select c.relname, c.reltuples::bigint as linhas, pg_total_relation_size(c.oid) as bytes from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'competitor\_%' order by 3 desc;`
- O que muda: A tabela da OP-9 (seção 5.4) é refeita com o tamanho de linha medido

**[E10] C8**

- Pergunta: Miniaturas guardadas, por canal
- Comando: `select v.competitor_channel_id, count(distinct x.thumb_blob_url) as miniaturas from competitor_video_versions x join competitor_videos v on v.id = x.video_id where x.thumb_blob_url is not null group by 1 order by 2 desc;`
- O que muda: O tempo do `exportar` por canal e o espaço da pasta local (seção 5.3)

**[E10] C11**

- Pergunta: (emenda 1: D-m11) Quanto ocupa o bruto dos relatórios, que com o desvio D1 fica para sempre?
- Comando: `select count(*) as brutos, sum(octet_length(csv_gz)) as bytes from public.yt_reporting_report_blobs;`
- O que muda: Uma linha de MB por ano na seção 5.4 (dividir os bytes pelos dias entre o bruto mais antigo e hoje). Se a coluna não se chamar `csv_gz` em produção, a consulta falha: anotar e medir por `pg_total_relation_size('public.yt_reporting_report_blobs')`

### Fora da lista acima

**Cobertas por outra (não rodar duas vezes):** E10 C5 (pela CP4 da E9) e C6 (pela CP1 da ordem 23); E17 P1 (idem); E4 C-1 (pela P-3 da E7); P3 CP10 (pela consulta unida dos papéis) e CP12 (pela CP8 da ordem 23); ordem 23 CP5 (pela P2 da E18), CP16 (pela CP14 da P3) e CP18 (pela CP11 da P3); E18 P10 (pela CP9 da ordem 23); E9 CP2 e E7 P-6 (respondidas acima, na referência local).

**Não são de produção (repositório, banco de integração, kit local da forja, pergunta ao dono):** E9 CP11, CP12, CP13, CP16, CP17, CP18; E17 P0, P11, P13; E7 P-7, P-8, P-9, P-11, P-13, P-14; ordem 23 CP17. Ficam nos planos, com o comando.

**Só em `fatos.md` da E4, seção 7 (não mudam o desenho):** C-6, C-9, C-10, C-13.

**Depois de cada migration e de cada deploy** valem as consultas V, K, A e as conferências com data de cada plano (`e4-*`, `e7-*`, `e9-*`, `e10-*`, `e18-*`, `e6-p3-*`, `e6-p4-*`, `e18p2-*`, `e17-p0-*`), que entram em `lib/conferencias.ts` no commit do deploy. Uma a mais, desta reconciliação: **depois da MG4 e depois da MG18, rodar de novo a V2 da E10** (`select public.obs_archive_uncovered() as sem_export, (select count(*) from public.obs_archive_registry()) as tabelas_no_registro;`), esperado `{}` e `22`.

---

## 8. Avisos aos planos de 12/10 (emenda 3: n4, I2)

Os dois planos de ontem (`2026-10-12-a5-e11-canal-proprio-em-tabelas-plan.md` e `2026-10-12-a5-e6-e8-dieta-e-retencao-plan.md`) não foram tocados por esta reconciliação. O que muda neles com a partida do lote C (C1 = MG14, MG5, MG7; C2 = MG11, MG12, MG17a), para o controlador levar aos ledgers `.superpowers/sdd/a5-e11/progress.md` e `.superpowers/sdd/a5-e6-e8/progress.md` **antes de despachar a "Tarefa 1b"** (passo 1 da seção 3). Depende do aval do controlador para a nova ordem; sem o aval, vale a ordem de ontem e esta seção não se aplica.

| # | Plano de 12/10, onde | O que está escrito | O que passa a valer |
|---|---|---|---|
| 1 | E11, seção 2 (linhas 83, 85 e 91) | "a MG7 é a quarta migration"; "lote C = MG14, MG11, MG5, MG7, MG12"; o dono aplica "as cinco do lote C" | a MG7 é a terceira e última do C1; o dono aplica as três (MG14, MG5, MG7) num `db:push:prod`; MG11, MG12 e MG17a vão depois, no C2 |
| 2 | E11, seção 2 (linha 90), tabela da seção 9 (linha 367), Tarefa 1 (linhas 431 e 434) | o arquivo da MG7 nasce "depois dos arquivos da MG14, da MG11 e da MG5", com carimbo posterior ao dos três | o arquivo da MG7 nasce depois dos arquivos da MG14 e da MG5, e só deles. **O agente da Tarefa 1 não espera o arquivo da MG11**, que só nasce no C2. O roteiro de prova do passo 3 roda como está (ele usa MG14, MG5 e MG7) |
| 3 | E11, V2 e V3 | a V2 espera `can_view_private_site`, "porque a MG11 vem antes da MG7"; a V3 roda "depois de TODO o lote C" | a V2 vê `can_edit_site` até a MG11 entrar (caso que o plano diz ter rodado: "a policy se ajusta") e é refeita depois do C2; a V3 roda depois do C1 e de novo depois do C2 |
| 4 | E6/E8, Tarefa 1b (linha 403) | "`db:new` da MG14; (a MG11, do plano dela); `db:new` da MG5" | os dois `db:new` em seguida, MG14 e MG5; depois o da MG7 (E11, Tarefa 1). A linha "a vez do lote C" lê-se "a vez do lote C1" |
| 5 | E6/E8, Tarefa 15, lote "M"; E11, Tarefa 14 | o lote M envia os dois `.sql` (MG14, MG5); o arquivo da MG7 sobe com o código da E11 ("todos os da tabela da seção 9") | **(I2) o arquivo da MG7 vai junto no lote M:** os três `.sql` do C1 chegam a `origin/staging` depois das V, por árvore própria ou dentro da primeira árvore de código que precisar deles (a da E10, pela lista F17, ou a do passo 2). Quando o lote de código da E11 sair, o arquivo já estará no remoto e sai da lista dele. Se o commit da Tarefa 1 da E11 trouxer os dois testes de integração junto do `.sql`, eles só entram nessa árvore se passarem nela; senão a árvore leva só o arquivo, por caminho |
| 6 | E11, `apps/web/test/integration/a5-e11-schema.test.ts:37` ("quebra na CI até a 1b") | o teste lê o SQL de `.superpowers/sdd/a5-e11/sql/`, pasta que o `git` ignora | a troca para `supabase/migrations/` continua indo com o lote de código da E11 (passo 2). O teste não entra em árvore nenhuma antes disso: regra 1, item (ii) |
| 7 | os dois, condições "tem de estar em `main` antes" (E6/E8, Tarefa 15; E11, Tarefa 14) | commits não enviados contados por arquivo | **(I1) a conferência é por conteúdo** (`git diff --quiet origin/main <commit-pai> -- <caminhos>`), nunca por contagem de commits nem por `is-ancestor`: o envio é por árvore de lote e o hash muda |
| 8 | os dois | nada sobre a fila do `db push` | antes do primeiro `db:new` o controlador cria `.superpowers/sdd/a5/fila-do-db-push.md` com as duas seções (n6); ~~o arquivo não existe em 13/10~~ (reconciliação 13/10, emenda 4: p8, n5) criado em 13/10 |

**O que não muda nos planos de ontem:** o SQL (apêndices), as consultas V e K, as tarefas de código, as condições de envio dos lotes E8-coleta, E6-P2 e E8-tela, e o plano de volta. **Não conferido:** se os três arquivos do C1 aplicam do zero numa árvore que ainda não tenha os três arquivos do lote B (`origin/staging` termina em `20261012000004` em 13/10); por isso a árvore do lote M é montada depois do passo 1a, como o plano de ontem da E6/E8 já pede ("os arquivos do lote B aplicados").
