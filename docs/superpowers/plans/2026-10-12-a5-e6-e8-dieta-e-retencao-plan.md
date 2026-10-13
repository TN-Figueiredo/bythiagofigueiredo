# A5, ordens 8 e 10: dieta do diário do canal próprio (E6, P1 e P2) e curva de retenção (E8)

Escrito em 12/10/2026 (noite). Spec: `docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md`, seções 7.1 e 7.2, itens de aceite 42 a 46, 50 e 58 a 65; `00-indice-decisoes-e-sequencia.md`, seção 14 (ordens 8 e 10, MG14 e MG5, lote C). Regras deste plano: `.superpowers/sdd/a5/regras-planejador.md`.

**Emendado em 13/10/2026, depois do portão** (os dois pareceres reprovaram a primeira versão: `.superpowers/sdd/a5/revisao-plano-e6-e8-dieta-e-retencao-dados.md` e `…-software.md`). Cada trecho mudado traz **"(emenda do portão: código)"**: `I1` a `I5` e `m1` a `m11` são do parecer de dados; `I-1` a `I-9` e `m-1` a `m-11`, do de software; `R1` a `R10`, decisões do controlador para os quatro planos. A resposta achado a achado e o SQL rodado de novo estão em `.superpowers/sdd/a5/resposta-revisao-plano-e6-e8-dieta-e-retencao.md`. **As duas migrations mudaram** (apêndices A e B) e foram rodadas de novo; o texto dos apêndices é o que vale.

**Segunda emenda, em 13/10/2026** (os dois especialistas conferiram a primeira e deixaram um importante cada: **N1** no parecer de dados e **F-1** no de software, mais os menores `n1`, `n2` e `m-F1` a `m-F8`). Cada trecho mudado traz **"(emenda 2 do portão: código)"**. A MG5 mudou **numa condição** (apêndice B, campo `diario_falhas_4d`) e foi rodada de novo (fato L22); **a MG14 e o corpo de `youtube_channel_removal_impact` não foram tocados** (o `sha256` do bloco entre as marcas e o `md5(prosrc)` são os mesmos antes e depois: desvio 4). As três decisões do controlador que a primeira emenda deixou em aberto (posse dos arquivos, passo desligado, orçamento da cauda) estão decididas, na seção 2, e na seção 5 para a terceira.

**Terceira emenda, em 13/10/2026** (fecho da emenda 2: dados CONCORDO com 2 menores; software NÃO CONCORDO com 2 travas, **T1** e **T2**, e 6 menores; pareceres em `.superpowers/sdd/a5/fecho-emenda-2/`). Cada trecho mudado traz **"(emenda 3 do portão: código)"**: `T1` e `T2` são as travas de software; `menor 1` a `menor 6`, os menores de software; `dados 1` e `dados 2`, os de dados. **Nenhum SQL mudou** (apêndices A e B intactos). As três perguntas da seção 2 estão respondidas pela decisão 61 do dono. A Tarefa 2 ganhou dois arquivos na lista dela (o falso do Supabase e o teste dele).

## 1. Objetivo, e o que fica fora

**Objetivo.** (1) O diário por vídeo do canal próprio passa a guardar só os dias em que houve alguma atividade, e uma tabela pequena (`yt_own_video_coverage`) passa a dizer quais dias foram coletados, de modo que "zero medido" continua diferente de "não medido" e nenhuma tela muda de número. (2) A curva de retenção de cada vídeo próprio passa a ser coletada (a vida inteira, e os primeiros 7 e 30 dias dos vídeos novos), guardada com histórico e mostrada na página do vídeo, no desenho do mockup 6. (3) Tudo o que avisa falha chega ao dono por cron vermelho; nada novo falha em verde.

**Fora deste plano.**
- **A agenda de tarefas** (plano da ordem 5, decisão R4): este plano não registra tarefa nela; os passos daqui entram em `coleta/index.ts`. **A redação da chave de API no Sentry** (R8): não é daqui; os passos deste plano usam a Analytics API com token no cabeçalho, sem `key=` na URL.
- **Qualquer apagamento em massa de linhas do diário**: P3 (MG15), o `vacuum full` e P4 (MG16). São do dono, com ritual próprio, em plano próprio. Este plano entrega o que eles precisam (seção 8, desvio 13, tem um recado para esse plano).
- A dieta de `yt_own_video_meta_daily` (MG17, E18 parte 2) e os conjuntos de cobertura da E11 (`trafego`, `pais` etc.): o `check` de `metric_set` já os aceita, e é só.
- O token `LeituraPrivadaDoSite` e a função `can_view_private_site` (E17, passo 0, MG11). Este plano convive com os dois estados (seção 8, desvio 15).
- O seletor de janela (7 dias, 30 dias, vida) e a faixa "acima, na média ou abaixo de vídeos de duração parecida" **na tela**: não estão no mockup 6 (pergunta 2). São coletados e calculados; a tela deles espera desenho.
- Retenção para a forja, para o Cowork ou em rota de `api/pipeline/`: nada. **Este plano não cria rota em `api/pipeline/`** e não toca `docs/cowork-*`, `apps/web/data/pipeline-docs/` nem `api-registry.ts`.
- Limpar zeros falsos de `youtube_video_analytics` (R7 do índice): não é desta etapa.

**Dependências duras, ditas de uma vez.**

| Parte | Precisa antes |
|---|---|
| SQL de ensaio no banco de integração e teste de schema (Tarefa 1a) | a Tarefa 2 (catálogo de `kind`). **Não** cria arquivo em `supabase/migrations/` (emenda do portão: I-3, R2) |
| Arquivos das migrations (Tarefa 1b) | **a vez do lote C**: os arquivos do lote B (MG10, MG9, MG8) já criados e aplicados em produção. Antes disso, nenhum arquivo (emenda do portão: I-3, R2) |
| Coleta da retenção (lote E8-coleta: Tarefas 2, 2b, 2c, 7 a 10, 9b, 11a) | MG14 **e** MG5 aplicadas em produção; e em `main` os lotes que já mexeram nos mesmos arquivos e ainda não foram enviados (E12, E20, E1+E2: fato P11). **Não** depende da A4 (emenda do portão: I-8) |
| Código da dieta (lote E6-P2: Tarefas 3a, 3, 3b, 4, 5, 6, 11b) | MG14 aplicada; **a A4 fechada** (a Tarefa 5 mexe em `proprio/ler.ts`, arquivo da A4; em 13/10 a A4 ainda tem trabalho de outro terminal sem commit: fato P11); o lote E8-coleta já integrado (mesmo `coleta/index.ts`) |
| Leitor e tela da retenção (lote E8-tela: Tarefas 12a, 12b, 13) | a A4 fechada; MG5. **Não** depende do lote E6-P2 nem de "uma execução" da coleta (emenda do portão: I-8) |

A conferência **C0.1 deu o caso A** (a API respeita o período): a E8 **não sobe** na sequência e este plano é o do caso A. A C0.8 já estava feita. Nenhuma conferência de que este plano depende ficou sem resultado; o que a C0.1 **não** conseguiu verificar está na seção 13.

## 2. Perguntas que só o dono responde (nenhuma trava o início)

| # | Pergunta | Recomendação | Vale se ele não responder |
|---|---|---|---|
| 1 | **RESPONDIDA em 13/10 (decisão 61): 3 dias de vermelho, com o id do vídeo, e depois ação do dono.** Um vídeo do seu canal que o YouTube Analytics deixa de devolver (apagado: resposta sem dias, ou 403, 404 ou 410 que não é de cota) fica sem diário e sem curva. **Erro nosso (banco, resposta em forma inesperada) ou do YouTube que não é o vídeo (500, 429, cota) nunca tira o vídeo do vermelho** (emenda 2 do portão: N1). O cron fica **vermelho 3 dias, com o id do vídeo**, e depois o vídeo vira "ação do dono" no resumo e o vermelho acaba; ou fica vermelho até você agir? (emenda do portão: I4, m-3) | 3 dias e depois ação do dono: é o que o controlador já fixou para os canais de concorrente (decisão 48); vermelho para sempre esconde as outras falhas do mesmo e-mail. Metade ou mais dos vídeos do canal nessa situação é pane e **não** sai do vermelho | 3 dias e depois ação do dono |
| 2 | **RESPONDIDA em 13/10 (decisão 61): sim, a tela da retenção sai agora só com o que o mockup 6 tem; o seletor e a faixa ficam para o próximo lote de mockups.** O mockup 6 aprovado mostra a curva da **vida inteira**. O spec pede também um seletor (primeiros 7 dias, 30 dias, vida) e a faixa "acima, na média, abaixo de vídeos parecidos". Faço a tela agora só com o que o mockup 6 tem, e o seletor e a faixa entram no próximo lote de mockups? | sim: a coleta guarda as três janelas desde o primeiro dia, nada se perde por a tela esperar | sim |
| 3 | **RESPONDIDA em 13/10 (decisão 61): SIM, o ensaio com a API real roda, gravando só no banco local e com o token só em memória.** Antes do envio, um ensaio lê a curva dos 35 vídeos na API real e grava **só no banco local** (Tarefa 14). O token de acesso é pedido à Google e fica só em memória, como na conferência C0.1; nada é gravado em produção, nem o token (emenda do portão: I-5, R6). Pode? | sim: é a única medida real de tempo e de quantos vídeos têm curva antes de ligar | **o ensaio não roda** sem o seu sim; o resto segue e o risco 1 fica aberto |

**As três perguntas estão respondidas** (decisão 61 do dono, 13/10, em `.superpowers/sdd/a5/decisoes-do-dono.md`); nenhuma fica aberta neste plano. Os outros itens da mesma decisão (funções `invoker`, a migration pequena da soma do mapa na parte 2, comentários, MG10 e MG9, inscritos de hora em hora, a coleta do canal próprio a partir do deploy menos 10 dias) são de outros planos: este não tem pergunta sobre eles.

**Sobre a pergunta 1, para o dono saber:** hoje nenhum código tira um vídeo seu de `youtube_videos` (não há coluna de estado nem apagamento; só a remoção do canal inteiro). Um vídeo apagado no YouTube continua na lista. Tirá-lo é ato seu, por SQL, e o runbook (seção 6) passa a trazer a consulta. Hoje os 35 vídeos estão públicos e com diário em dia.

**Decidido pelo controlador (emenda 2 do portão: controlador a, b, c), sem pergunta ao dono:**
- **(a) Posse.** A Tarefa 2 deste plano é a **DONA** de `coleta/passos-desligados.ts`, `coleta/kinds.ts` e `coleta/clock.ts` (a chave `TETOS_DE_FIM_MS` e o auxiliar `prazoDoCriterio`), e também de `motivo.ts` e `criteria-desligados.ts`. Ela roda primeiro e sozinha e é commitada antes de a E11 começar. **A E11 só confere** que os arquivos existem e importa deles; não cria nem edita (o plano dela já diz isso).
- **(b) Passo desligado por variável.** Fica vermelho **a partir da 8ª execução seguida desligado**, para a E8, a E11 e a E18, **regra única** (Tarefa 2c, desvio 18). Até a 7ª a nota vai para `acao_do_dono`.
- **(c) Orçamento da cauda.** Somadas as caudas do cron do canal próprio (as de hoje, a da E11 e a deste plano), o pior caso chega a cerca de **294 s de 300 s**. O plano declara o orçamento por passo e o que é cortado primeiro quando o relógio aperta (seção 5, "Orçamento da cauda"), e a conferência com data que mede o tempo real nos 3 primeiros dias (`e8-tempo-real`, Tarefa 11a).
- **Continua do controlador (confirmação):** o leitor que nasce com a prova de edição em vez do token de leitura (desvio 15; m-9).

## 3. O que é do dono

**Duas migrations, no lote C** (emenda do portão: R2, I-3). O controlador fixou a ordem de aplicação dos lotes: **lote B** = MG10, MG9, MG8 (planos das ordens 5 e 6); **lote C** = **MG14**, MG11, **MG5**, MG7, MG12, nessa ordem, num só `npm run db:push:prod`. As deste plano são a MG14 e a MG5. Produção está na versão **`20261012000004`** (conferido em 13/10; é a corretiva das provas de E1/E2).

| Ordem no lote C | Comando do agente, **só na vez do lote** | MG do spec | O que faz |
|---|---|---|---|
| 1ª | `npm run db:new observatorio_a5_e6_dieta_cobertura` | MG14 | cobertura, carga inicial, `yt_own_daily_apply`, `check` de `kind`, `youtube_channel_removal_impact` (o corpo único da A5) |
| 2ª | (MG11, do plano da E17) | MG11 | |
| 3ª | `npm run db:new observatorio_a5_e8_retencao` | MG5 | `yt_own_video_retention`, `yt_own_retention_facts` |
| 4ª e 5ª | (MG7 da E11, MG12 da E18) | | |

- **Nenhum arquivo de migration deste plano é criado antes da vez do lote C** (emenda do portão: I-3, R2). O `db:new` carimba pela hora, e `npm run db:push:prod` aplica **todo** arquivo pendente de `supabase/migrations/`: um arquivo criado cedo entraria no próximo envio do dono, de qualquer lote, sem ele saber. Até lá o SQL vive nos apêndices deste plano e numa cópia de ensaio fora de `supabase/migrations/` (Tarefa 1a). Quem chama os `db:new` do lote C, na ordem da tabela, é o controlador (os arquivos são de planos diferentes e o carimbo é a ordem).
- **A ordem entre as duas é dura**: a MG5 falha, por inteiro e sem deixar nada, se a MG14 não existir (fato L5). A MG7 (E11) também depende da MG14. **Se a MG11 (E17) ou a MG12 (E18) não estiverem prontas quando o lote C for aplicado, a MG14 e a MG5 vão sozinhas, nessa ordem, e o lote E8-coleta não espera pelas outras** (V1 aceita os dois estados da policy) (emenda 2 do portão: m-F7). Com a MG11 antes da MG5, a policy da retenção já nasce pelo direito novo; a da cobertura nasce por `can_edit_site` e a MG11 a troca (o bloco da policy é o mesmo nos dois arquivos).
- **Convivem com o código que está em `main`** (conferido no código de HEAD e no schema de produção): o código atual não lê as tabelas novas, não chama as funções novas, e só grava os seis valores antigos de `kind` (em produção há cinco em uso: `diario, meta, relatorio, sondagem, thumbnail`; zero linhas fora do padrão novo). A única função recriada, `youtube_channel_removal_impact`, mantém assinatura, permissões e as chaves do resultado; o número de `serie_coletada` é o mesmo de hoje mais as linhas das tabelas novas presas ao canal (as quatro `yt_own_public_*` do lote B e a cobertura).
- **Janela.** Qualquer hora **fora de 11:30 a 13:00 UTC** (08:30 a 10:00 de Brasília; o cron diário roda às 12:00 UTC e grava no diário e nas tentativas; é a mesma janela que o spec reserva para P3). A MG14 troca um `check` (trava `yt_own_collection_attempts`, 530 linhas, por milissegundos) e lê as 96.892 linhas do diário uma vez (0,2 a 0,5 s medido em volume igual). `lock_timeout` de 5 s: se bater, é só rodar de novo.
- **Nada aqui apaga dado.** A função nova só apaga linha quando o código novo a chamar (lote E6-P2).
- **Como desfazer** (emenda do portão: m6; só se for preciso, e só antes de o lote E8-coleta ir a `main`): `drop function public.yt_own_retention_facts(uuid, date); drop table public.yt_own_video_retention; drop function public.yt_own_daily_apply(text, jsonb, jsonb, date[], text[]); drop table public.yt_own_video_coverage;`. Três avisos: (1) `youtube_channel_removal_impact` **fica** com o corpo novo (ele funciona sem as tabelas; voltar ao corpo de `20261009000001` tiraria da soma as tabelas das outras etapas); (2) o `check` antigo de `kind` (lista de seis) **não volta** depois que existir uma tentativa `retencao_7d` ou de outro valor novo: fica o padrão por expressão; (3) depois de o lote E6-P2 rodar uma vez, apagar a cobertura transforma os zeros já apagados em "não medido" (o caminho de volta desse lote está na Tarefa 15).

**Conferências depois de aplicar** (o controlador roda, só `select`; as mesmas consultas foram rodadas no banco local, seção 11):

| # | Consulta (resumo; texto na seção 11) | Esperado |
|---|---|---|
| V1 | `to_regclass` das duas tabelas; expressão das duas policies | existem; `can_edit_site(site_id)` se a MG11 ainda não foi aplicada, `can_view_private_site(site_id)` se foi |
| V2 | `T` = linhas do diário com `views` não nulo; `C` = soma dos dias da cobertura `base`; nº de intervalos | `C = T` (96.892 em 12/10, mais o que o cron gravar até o dia); 70 intervalos (35 vídeos × 2 conjuntos, um por vídeo e conjunto) |
| V3 | definição do `check` de `kind` | `CHECK ((kind ~ '^[a-z0-9_]{1,40}$'::text))` |
| V4 | `has_function_privilege` de `yt_own_daily_apply(text,jsonb,jsonb,date[],text[])` e de `yt_own_retention_facts(uuid,date)` para `anon`, `authenticated`, `service_role` | falso, falso, verdadeiro |
| V5 | `serie_coletada` do canal `tnFigueiredo` × a soma, contada pelo catálogo, das linhas de toda tabela com FK `on delete restrict` para `youtube_channels` (consulta na seção 11) | iguais. A lista de tabelas é a que existir no dia: as seis de hoje, mais as quatro `yt_own_public_*` do lote B, mais cobertura e retenção (emenda do portão: I5, I-2) |
| V6 | `select count(*) from yt_own_video_retention` | 0 |
| V7 | `select md5(prosrc) from pg_proc where oid = 'public.youtube_channel_removal_impact(uuid,uuid)'::regprocedure` | `4827d5ad12a0120b52ebc1280491b00c` (o corpo único; hoje, antes do lote, produção tem `37214ca7d95f3bae16317115bfcf0dc3`). Se outra migration do lote aplicada depois mudar este valor, ela trouxe outro corpo: parar (emenda do portão: R1) |

## 4. Fatos medidos

**Produção** (só `select`, `npx supabase db query --linked`, 12/10/2026 entre 22:35 e 22:50 de Brasília):

| # | Fato | Consulta |
|---|---|---|
| P1 | Diário: **96.892** linhas, **2.455** com atividade (2,5%), soma de views 6.915, 35 vídeos, de 26/08/2015 a 09/10/2026; **72,0 MB** | `count(*)`, `count(*) filter (atividade)`, `sum(views)`, `pg_total_relation_size` |
| P2 | Nenhuma linha com `views`, `engaged_views` ou `card_impressions` nulos | `count(*) filter (where … is null)` = 0 nas três |
| P3 | **35 ilhas para 35 vídeos**: nenhum vídeo tem buraco de dia. A API devolve **todo** dia, inclusive os de zero | ilhas por `day_pt − row_number()` |
| P4 | Em 12/10 (cron das 12:00 UTC) o último dia gravado dos 35 vídeos era **09/10**: a fonte entrega até hoje − 3 | `max(day_pt)` por vídeo |
| P5 | Execuções do cron: 12/10 total 88 s (diário 9,6 s, 280 linhas = 35 vídeos × 8 dias); 11/10 total 102 s (diário 13,7 s); 10/10, o dia da carga inicial, diário 50,4 s com 2 vídeos sem tempo. Outros passos em 12/10: metadados 17,0 s, jobs 0,7 s, relatórios 28,5 s, alcance 2,3 s, parte antiga 23,7 s | `yt_own_collection_runs`, 4 últimas |
| P6 | Views recentes: **3** vídeos com view nos últimos 14 dias, 6 em 28, 15 em 90. Nenhum vídeo publicado nos últimos 45 dias (o mais novo é de 10/12/2024) | somas por janela; `max(published_at)` |
| P7 | Tabelas com FK `on delete restrict` para `youtube_channels`: `yt_own_collection_attempts`, `yt_own_video_daily`, `yt_own_video_meta_daily`, `yt_own_video_reach_daily`, `yt_reporting_jobs`, `yt_reporting_reports`. São as seis somadas **hoje** em `serie_coletada` (depois do lote B serão dez: as quatro `yt_own_public_*` da MG9 nascem com a mesma FK; emenda do portão: I5, I-2). O corpo da função em produção é idêntico ao do banco local (`md5(prosrc)` = `37214ca7d95f3bae16317115bfcf0dc3` nos dois, conferido de novo em 13/10) | `pg_constraint`; `md5(pg_get_functiondef(...))` |
| P8 | Constraint: `yt_own_collection_attempts_kind_check`, lista de seis valores. Tentativas: 530 linhas desde 08/10, 0,45 MB, **nunca são apagadas** (não há limpeza no código) | `pg_constraint`; `count(*)`; grep de `.delete()` em `lib/youtube/coleta` |
| P9 | Não existem em produção: `yt_own_video_coverage`, `yt_own_video_retention`, `can_view_private_site`. Última migration: **`20261012000004`** (conferido em 13/10; o `bythiago_int` está em `…000003`: a Tarefa 1a diz o que fazer) (emenda do portão: m5, R7) | `to_regclass`, `to_regprocedure`, `supabase_migrations.schema_migrations` |
| P10 | Dois canais próprios ativos; um deles (`Thiago Figueiredo`) tem 0 vídeos. Um site só; `youtube_videos.published_at` é `not null` e os 35 têm data | `youtube_channels`, `youtube_videos` |
| P11 | **Estado do repositório em 13/10** (emenda do portão: R7, I-8): o HEAD local de `staging` está 204 commits à frente de `origin/staging`, e `origin/main` = `origin/staging`. Commits **não enviados** em arquivos que este plano edita: `coleta/index.ts` 4, `coleta/clock.ts` 1, `lib/conferencias.ts` 3, `test/youtube/coleta/index.test.ts` 8, runbook da coleta 10, `proprio/ler.ts` 7, `e2e/fixtures/observatorio-seed.ts` 5, `database.types.ts` 2. `e2e/fixtures/observatorio-seed.ts` tem ainda **alteração sem commit de outro terminal** (26 linhas; a A4 não fechou). A URL do banco de teste por variável **já existe** (commit `69bd83c7`: `localSupabaseUrl()` em `test/helpers/db-skip.ts`, lida por `db-seed.ts`) | `git log origin/staging..HEAD -- <arquivo>`, `git status` |

**Banco local `bythiago_int`** (porta 54422, tudo dentro de `begin; … rollback;`, 12/10 22:40 a 22:50; os roteiros estão no scratch da sessão: `t14.sql`, `t14b.sql`, `t5.sql`, `tk.sql`):

| # | Fato |
|---|---|
| L1 | MG14 aplicada **três vezes** na mesma transação: mesmas 6 linhas de cobertura na semente pequena; nenhum erro; na terceira, com uma função `can_view_private_site` presente, a policy passou a usá-la |
| L2 | Carga da cobertura sobre 96.880 linhas sintéticas (35 vídeos × 2.768 dias, 2,5% com view): **0,30 s**; 70 intervalos; `C = T = 96.880` |
| L3 | `yt_own_daily_apply`: 35 chamadas de 9 dias, **36 ms no total**; uma chamada com 2.768 dias (a vida inteira de um vídeo novo), **37 ms** |
| L4 | Primeira execução simulada da coleta nova: apagou **280** linhas (35 × 8 dias de zero), cobertura estendida, `C` (96.915) passou a ser **maior** que `T` (96.600) |
| L5 | MG5 sem a MG14: erro `relation "public.yt_own_video_coverage" does not exist`, e a tabela de retenção **não** ficou criada |
| L6 | Uma linha de retenção com 100 pontos e as três métricas ocupa **1.863 bytes** (os pontos, 1.581) |
| L7 | As recusas da função (dias diferentes entre `p_rows` e `p_days_returned`, dia repetido, conjunto fora de `base`/`estendidas`, `p_ids` sem canal, `metric_version` inválida) e do `check` de `kind` (`'Ruim!'`) falham; `retencao_7d` e `diario` são aceitos |
| L8 | `authenticated` sem vínculo lê 0 linhas das duas tabelas; `anon` e `authenticated` não têm `execute` nas duas funções |
| L9 | `youtube_channel_remove` devolve `serie_coletada` (recusa) com as tabelas novas preenchidas; `serie_coletada` = soma manual das tabelas presas ao canal (iguais na semente) |
| L10 | `yt_own_retention_facts` sobre 35 vídeos × 2.768 linhas de diário: **109 ms**, 35 itens |
| L11 | O retrato K1 (seção 11) deu o **mesmo md5** antes e depois de a função apagar 376 linhas de zero (soma 81, 27 dias com view, 1.085 dias medidos nos dois) |

**Rodado de novo na emenda** (13/10, madrugada; `bythiago_int`, tudo em `begin; … rollback;`; roteiros no scratch da sessão, pasta `e6e8-emenda/`: `a_apply.sql`, `b_fatos.sql`, `c_ordem.sql`, `d_volume.sql`, `e_resto.sql`, `f_k.sql`; no fim, conferido que nada ficou: sem as duas tabelas, sem `yt_own_daily_apply`, `check` antigo de `kind`, corpo antigo da função de impacto, 0 linhas no diário, 0 canais):

| # | Fato |
|---|---|
| L12 | **I1, os dois sentidos.** Dia sem a chave `views`, ou com `views` nulo, ou com `views` em texto, numa chamada com `base`: **recusado** (`22023`), nada gravado. Resposta sem `engaged_views` com `p_sets = {base,estendidas}`: recusada; **a mesma resposta com `{base}`: aceita**, cobertura só de `base`. Os casos bons da primeira rodada (T1 a T6 do parecer de dados: 9 dias com 1 view, idempotência, revisão para zero, chave ausente, negativo, buraco e fusão, vazio) dão o mesmo resultado de antes |
| L13 | **Linha com `views` nulo nunca é apagada.** Linha (`views` nulo, `engaged_views` 0) mais uma chamada só de `estendidas` em zero: a linha **fica** (antes da emenda saía). Com a base chegando depois em zero medido: a linha sai e o dia fica coberto nos dois conjuntos |
| L14 | **m4.** Dia de zero sem `metric_version`: recusado. **Parâmetro nulo** (R9): `p_video`, `p_ids` e `p_sets` nulos são recusados; `p_rows` e `p_days_returned` nulos devolvem os cinco zeros sem mexer em nada |
| L15 | **R1, qualquer ordem.** Cinco ordens (MG14, MG5, X · X, MG14, MG5 · MG14, X, MG5 · tudo duas vezes · X, X, MG14, MG14, MG5, MG5), em que X faz as vezes de outra migration do lote: cria uma tabela presa ao canal por FK `restrict` (e outra por `cascade`, que não pode contar) e traz o mesmo corpo. Nas cinco: `md5(prosrc)` = `4827d5ad12a0120b52ebc1280491b00c`, `serie_coletada` = 12 = a soma manual (3 do diário, 2 intervalos, 1 curva, 2 tentativas, 4 da tabela de X), o `jsonb` inteiro do resultado com o mesmo md5, e `youtube_channel_remove` devolve `serie_coletada` (recusa limpa) |
| L16 | **Fatos, campos novos.** Âncora da leva: nula sem tentativa de canal; = a tentativa de escopo `canal`, kind `retencao_vida`, **mais antiga** do canal, com qualquer resultado (`2026-10-01`, de orçamento); tentativa de outro canal, de outro `kind` ou com `scope_id` errado não entra. `diario_falhas_4d` (emenda 2 do portão: N1): **4** com quatro dias seguidos de `sem_dado_na_janela` ou de `erro_http` com status 403, 404 ou 410 que não seja de cota; **0** com quatro dias de `erro_de_banco`, `forma_inesperada`, `excecao`, `http_500`, `http_429` ou 403 de cota (falha nossa ou de cota: não é o vídeo); **2** com um `ok` e um orçamento no meio; **3** com só três dias de tentativa; **0** sem tentativa; a janela anda com `p_hoje_utc` (no dia seguinte, 3). Canal nulo: `[]`. `p_hoje_utc` nulo = `current_date`, e a chamada só com o canal funciona |
| L17 | **Checks da retenção, um de cada vez com o resto da linha válido:** `point_count 0`, tamanho de `points` diferente, `requested_end` menor, janela inventada, `points` objeto, `window_end` antes de `window_start`, `metrics_returned` vazio e `metric_version` vazia: os oito recusados; a linha boa é aceita |
| L18 | **RLS com o GUC forjado** (m9): `authenticated` sem vínculo, com `set_config('app.site_id', <o site>, true)`, lê 0 linhas das duas tabelas (como `postgres`: 1 e 3). `anon` e `authenticated` sem `execute` nas três funções (por `has_function_privilege`, nunca chamando) |
| L19 | **Simulação do dia do deploy em volume de produção, de novo** (35 vídeos × 2.768 dias = 96.880 linhas; as duas migrations aplicadas duas vezes): carga 0,48 s; `T = C = 96.880`, 70 intervalos; entre M e D, 280 linhas fora da cobertura (esperado); dieta: `apagadas 311`, `atualizadas 315`, 70 intervalos; depois: K3 = 0, K4 = 0, K8 = 0, `T 96.849`, `C 97.195`; fatos em 94 ms antes e 62 ms depois |
| L20 | **Retrato novo, por vídeo e dia** (K1 da seção 11), com **duas revisões do YouTube simuladas dentro da janela** (um dia de 2 para 3 views; um de 0 para 1): 1.085 pares nos dois retratos; `medido` diferente: **0**; `views` diferente antes da janela: **0**; dentro da janela: **2**, exatamente as duas revisões, listadas. É a comparação que o agregado antigo não fechava |
| L21 | K5, K6 e K7 na forma nova (site por parâmetro, com o total de vídeos ao lado): com o site, `8 e 1`, `8 e 7`, `8 e 1`; com **site nulo ou de outro site, `0 e 0`** (zero vídeos avaliados aparece como tal; não é "nada atrasado"). K8 (buraco): 0, e 1 com um buraco posto à mão |
| L22 | **N1: o filtro de `diario_falhas_4d` da MG5 emendada** (emenda 2 do portão: N1). Rodado duas vezes no `bythiago_int` (porta 54422), tudo em `begin; … rollback;`: MG14 duas vezes, MG5 duas vezes, 29 vídeos de teste, nada gravado. **4** em quatro dias seguidos de `sem_dado_na_janela`; de `erro_http` 404 (`http_404`, `http_404_notFound`, o formato antigo `HTTP 404 notFound` e `error` nulo); de 410; de 403 `http_403_forbidden`. **0** em quatro dias de `erro_de_banco`, de `forma_inesperada` (com status 200 e sem status), de `excecao`, de `http_500`, de `http_429`, de 403 `quotaExceeded`, `rateLimitExceeded`, `userRateLimitExceeded`, do formato antigo `HTTP 403 dailyLimitExceeded` e `HTTP 403 quotaExceeded`, de `ok` e de orçamento. **3** com só três dias de 404; **2** com dois dias de `sem_dado_na_janela` e dois de `erro_de_banco`; **3** com três de 404 e o 4º de `erro_de_banco` (a falha nossa quebra a sequência); a janela anda (com `p_hoje_utc` = D + 1, 3). A forma do teste da Tarefa 1a (A 4, B 2, C 3, D 0, mais E de `http_500` 0) dá `4, 2, 3, 0, 0`. Sem nenhuma tentativa de diário: 0 nos 29 vídeos. Canal nulo: `[]`. As duas execuções deram saída igual. Depois do `rollback`: sem as tabelas e sem as funções, 0 canais, 0 tentativas, `md5(prosrc)` da função de impacto o antigo; **dentro** da transação, com as duas migrations aplicadas, `md5(prosrc)` = `4827d5ad12a0120b52ebc1280491b00c` |

**Não medido** (dito como tal; detalhe na seção 13): a duração de uma chamada de retenção; a cota diária da Analytics API; quantos dos 35 vídeos devolvem curva; o comportamento das janelas de 7 e 30 dias num vídeo recém-publicado; `yt_own_retention_facts` com os dados de produção (só no banco local, fato L10).

## 5. As contas

**Tempo (a função do cron morre aos 300 s; o relógio da coleta para aos 270 s).**

| Passo | Teto | Medido (P5) |
|---|---|---|
| metadados | 30 s | 13 a 17 s |
| jobs | 20 s | 0,6 a 1,1 s |
| relatórios | 120 s | 28 a 36 s |
| alcance | 20 s | 2 a 20 s |
| diário | 50 s | 9,6 a 13,7 s |
| reserva da parte antiga | 30 s | 20 a 24 s |
| **soma (`TETOS_MS` mais a reserva, travada por teste)** | **270 s** | 88 a 102 s |
| retenção (novo, **teto de fim**, fora da soma) | 20 s | não medido |

- **`TETOS_MS` não muda.** A retenção entra em `TETOS_DE_FIM_MS` (objeto de `clock.ts` que o plano da E11 também usa para "dimensões", 30 s, e "normalizadores", 20 s): um teto de fim só gasta o que **sobrar** dos 270 s, porque o prazo de todo passo é `min(agora + teto, fim do relógio)`. Num dia normal sobram mais de 160 s (P5). No pior dia (fila da E12 cheia e os outros no teto) a retenção não roda: grava `nao_alcancado_orcamento` por canal, e o critério de orçamento existente (3 faltas, uma delas hoje) deixa o cron vermelho.
- **Ordem no cron, escrita uma vez** (emenda do portão: I-9): diário → dimensões → normalizadores (os dois da E11) → `criteriosL2` → `criterioCobertura` → `criteriosE11` → **retenção** → `criteriosRetencao` → `criterioDesligados` → metadados → orçamento. A retenção é a última a gastar tempo: nada dela se perde por esperar um dia (caso A da C0.1). É a mesma ordem do texto de integração da E11 (linha 614 do plano dela: os dois passos dela logo depois do diário e antes de `criteriosL2`); a linha 333 daquele plano ("dimensões, retenção, normalizadores") contradiz a 614 e é a que tem de mudar. O passo "versões" (E18) fica onde a E18 disser (logo depois dos metadados).
- **A cauda depois dos 270 s** (emenda do portão: m-8). Os passos param no relógio; os critérios rodam depois dele e não tinham conta. O que este plano acrescenta: `criteriosRetencao`, 1 `rpc` por canal (2 canais; 60 a 110 ms no banco local em volume de produção); `criterioCobertura`, 2 leituras por canal e mais até 6 só quando há vídeo atrasado há mais de 3 dias; `criterioDesligados`, 1 leitura e só quando há passo desligado; `criterioOrcamento`, 3 `kind` a mais na mesma consulta. Cerca de 8 idas ao banco, menos de 2 s em dia normal. Cada critério novo tem **prazo total próprio** (o `comPrazo` de `clock.ts`): cobertura 3 s, retenção 3 s, desligados 1 s; vencido o prazo, a nota é "não foi possível avaliar" (vermelho), nunca silêncio. Pior caso deste plano: **7 s** depois dos 270 s. O plano da E11 leva o pior caso de 281 s para cerca de 287 s; com estes 7 s, **cerca de 294 s, a 6 s do limite de 300 s**. É apertado e é o pior caso (todos os passos no teto e todos os critérios estourando o prazo); em dia normal o cron inteiro leva 88 a 102 s (P5). **Decidido na segunda emenda (controlador c): ver "Orçamento da cauda", logo abaixo.** Se outra etapa acrescentar cauda, os prazos destes três critérios caem para 2 s, 2 s e 1 s.
- **Orçamento da cauda** (emenda 2 do portão: controlador c). As contas, por passo (pior caso teórico; em dia normal o cron inteiro leva 88 a 102 s, P5):

  | Parte | Quando | Pior caso |
  |---|---|---|
  | passos (tetos de `TETOS_MS` mais reserva) | até os 270 s do relógio | 270 s |
  | cauda de hoje (critérios de relatórios, metadados, orçamento, conferências; ledger da E20) | depois dos 270 s | 11 s (total 281 s) |
  | `criteriosE11` (prova por site, prazo de 5 s) | depois dos 270 s | 5 s (total 286 s; o plano da E11 emendado diz cerca de 286 s) |
  | `criterioCobertura` 3 s, `criteriosRetencao` 3 s, `criterioDesligados` 1 s (este plano) | depois dos 270 s | 7 s |
  | **soma** | | **293 s (281 + 5 + 7); a primeira emenda somou 294 s com o número antigo da E11. Folga de 6 a 7 s até os 300 s** |

  **O que é cortado primeiro quando o relógio aperta, nesta ordem:** (1) **antes dos 270 s**: os passos de teto de fim, do último para o primeiro da ordem da seção 5, isto é, a **retenção** (a última a rodar) e depois os da E11; o que não coube vira `nao_alcancado_orcamento` por canal e o critério de orçamento avisa (nada some em silêncio, e o que ficou para trás espera um dia: caso A da C0.1); (2) **depois dos 270 s**: nenhum critério é pulado em silêncio. Os três deste plano usam `prazoDoCriterio` (Tarefa 2), que é o prazo próprio **ou os 296 s da função, o que vier primeiro**; quem roda **mais tarde na ordem da seção 5 perde primeiro** (`criterioDesligados`, o menos urgente, porque só vira vermelho depois de 7 execuções), e o que não tem tempo dá a nota vermelha \"não foi possível avaliar … (sem tempo)\", nunca verde (o texto exato de cada critério está na Tarefa 2; emenda 3 do portão: menor 2). Os critérios que já existem (metadados, orçamento) **não** ganham o limite de 296 s neste plano e não são reordenados (a ordem é a mesma dos três planos). **A conferência com data `e8-tempo-real`** (Tarefa 11a, R + 3) lê os 3 primeiros dias reais: `resumo.ms` (inclusive `ms.cauda`, a Tarefa 11a) e a duração da invocação no painel da Vercel; se o maior total passar de 250 s, o controlador corta os prazos para 2 s, 2 s e 1 s e o teto de fim da retenção para 10 s **antes** do envio do lote seguinte.
- **Diário novo, por canal:** 1 leitura da cobertura (paginada) no lugar de 35 leituras de "último dia"; por vídeo, 1 chamada à API, 1 `rpc` de gravação (1 ms medido no banco) e 1 `rpc` de tentativa. Idas ao banco: de cerca de 3 por vídeo para 2 por vídeo mais 1 por canal. O relógio é conferido antes de cada vídeo (já é) e o `fetch` aborta em `min(15 s, o que resta)`.
- **Retenção, por canal:** 1 `rpc` de fatos (109 ms no banco local com o volume de produção); se não há nada a ler, **nem pede token**. Por leitura: 1 a 3 chamadas à API (a repetição só em erro 400 ou 500), 1 `upsert` e 1 `rpc` de tentativa. Com 4 em paralelo e supondo até 1,5 s por leitura (suposição: o diário faz 35 vídeos em 9,6 s, 1,1 s por vídeo e por operário), 20 s dão cerca de 50 leituras. Precisa-se de 3 a 8 por dia na primeira semana e de menos de 3 por dia depois (P6). O ensaio da Tarefa 14 mede o número de verdade antes do envio.
- **Corpo da gravação de um vídeo sem cobertura** (emenda do portão: m11): a vida inteira de um vídeo antigo são até 2.768 dias em `p_rows`, cerca de 700 kB de JSON por PostgREST. **Não medido** pela rede (só o tempo dentro do banco: 37 ms). Só acontece com vídeo sem cobertura nenhuma (canal novo, ou cobertura perdida); é estimativa.

**Cota.** A retenção e o diário usam a **Analytics API**, que não gasta a cota de 10.000 unidades da Data API. Hoje: 35 consultas por dia do diário. A retenção soma no máximo 8 por dia na primeira semana (35 vídeos em 7 dias, mais os 3 com view recente no primeiro dia) e depois só vídeo com view nova e leitura com 7 dias ou mais. A cota diária da Analytics API **não foi conferida** (é do dono, no console do Google; C0.2). Um 403 ou 429 de cota aparece como `erro_http` com o motivo do Google e deixa o cron vermelho no mesmo dia.

**Volume no banco.**

| Tabela | Hoje | Depois deste plano | Por ano |
|---|---|---|---|
| `yt_own_video_coverage` | não existe | 70 linhas (menos de 100 kB com índices) | 2 linhas por vídeo novo |
| `yt_own_video_daily` | 96.892 linhas, 72 MB | −280 linhas no primeiro dia do código novo; **o tamanho não cai** (o espaço só volta com P3 e o `vacuum full`, fora deste plano) | só dias com atividade: cerca de 220 linhas por ano no ritmo de hoje, contra 12.775 |
| `yt_own_video_retention` | não existe | até 35 linhas na primeira semana (65 kB) | no ritmo de hoje menos de 0,3 MB; pior caso (35 vídeos relidos toda semana) 3,4 MB |
| `yt_own_collection_attempts` | 530 linhas em 5 dias, 0,45 MB | mais 3 a 8 linhas por dia | a tabela inteira cresce cerca de 30 MB por ano **e nada a limpa** (P8): não é deste plano, vai para os riscos |

**Blob.** Nada.

## 6. O que acontece quando o dado não existe, e em cada falha

| Situação | O que o sistema faz | Onde aparece |
|---|---|---|
| **Diário:** a API devolve 200 sem nenhum dia | nada é gravado e **a cobertura não avança**; tentativa `video_novo` (menos de 3 dias de vida) ou `sem_dado_na_janela` | o vídeo fica atrasado; o critério de cobertura deixa o cron **vermelho por 3 dias, com o id**, e depois o vídeo vira "ação do dono" (pergunta 1; regra na Tarefa 2b) (emenda do portão: I4) |
| a API devolve 200 com um dia **sem `views` numérico** (célula nula, ou a coluna some do cabeçalho) (emenda do portão: I1, I-1) | **falha da chamada do vídeo** (`forma_inesperada`): a função não é chamada, nada é gravado, a cobertura não avança. Se o código falhasse nisso, a função recusa do mesmo jeito (`22023`) | `diário: N de M vídeos com erro (a resposta veio em forma inesperada)` (vermelho) |
| a API devolve os dias sem `engaged_views` numérico em algum deles (emenda do portão: I1) | só o conjunto `base` é gravado e coberto (`p_sets = ['base']`); as colunas estendidas gravadas ficam como estão | nota "estendidas ausentes na resposta de N vídeo(s)" (vermelho) |
| a API devolve dias com um buraco no meio | o intervalo de cobertura é partido no buraco; o dia do buraco lê como "não medido" | tela. Some sozinho **só se o buraco estiver nos últimos 10 dias** (a janela repede); buraco mais antigo não é repedido (risco 16 e consulta K8) (emenda do portão: m1) |
| a API recusa as métricas estendidas | só o conjunto `base` é estendido; as colunas estendidas gravadas ficam como estão | nota existente "recusou as métricas estendidas" (vermelho) |
| dia revisado para zero pelo YouTube | a linha é apagada e o dia continua coberto: lê como zero medido | não é falha |
| `yt_own_daily_apply` não existe (código novo sem a MG14) | `schema_ausente`: o passo para para todos os canais, **não grava pelo caminho antigo** | `schema_ausente: yt_own_daily_apply` (vermelho) |
| a função recusa a chamada (dias divergentes, `metric_version` inválida) | nada do vídeo é gravado (a transação inteira volta) | `erro de banco ao gravar yt_own_daily_apply`, `N de M vídeos com erro` (vermelho) |
| cobertura vazia com vídeos cadastrados (MG14 sem carga, ou tabela truncada), ou a cobertura de **um** vídeo perdida | o diário pede a vida inteira do vídeo (como num vídeo nunca coletado) e reconstrói a cobertura; **a função apaga, nessa chamada, todas as linhas de zero da vida dele**: é o P3 daquele vídeo, sem o ritual do dono. Nada se perde (a informação "zero medido" passa a estar na cobertura), mas o runbook avisa (emenda do portão: m7). Se não couber no teto, o resto fica para o dia seguinte | critério de cobertura e de orçamento (vermelho) |
| leitura da cobertura cortada (mais de 5.000 intervalos por canal) | o passo e o critério param para o canal | `critérios: não foi possível avaliar …` (vermelho) |
| **Leitor da tela:** tabela de cobertura ausente (prévia sem a MG14) | lê só as linhas, como hoje; avisa o Sentry uma vez | telas iguais às de hoje |
| leitor: dia coberto sem linha | devolve a linha `views: 0`, `% assistido` e duração nulos | "zero medido", como hoje |
| leitor: dia fora de qualquer intervalo e sem linha | não devolve linha | "não medido", como hoje |
| leitor: canal sem nenhuma linha na janela e com cobertura em dia | `ultimoDia` = maior `covered_to` | não diz "coleta parada" |
| **Retenção:** a API devolve 200 com `rows: []` (o caso **comum** neste canal, C0.1) | tentativa `sem_dado_na_janela`; nenhuma linha | tela: "O YouTube não devolveu curva para este vídeo (poucas views)" |
| 200 sem `columnHeaders`, ou sem `rows`, ou com ponto sem `t` ou sem `ratio`, ou com `t` repetido | **falha da chamada** (`forma_inesperada`), nada gravado | `erro_http` e nota do canal (vermelho) |
| resposta com 37 pontos | grava os 37, `point_count = 37` | a tela diz quantos pontos tem a curva |
| ponto com `relative` ou `segment_impressions` ausente | o campo fica nulo no ponto, nunca 0 | não é falha |
| `ratio` maior que 1 | preservado | o gráfico corta o desenho em 120% e diz o valor |
| erro 400 nas três métricas | repete com as duas básicas; `metrics_returned` diz o que veio | não é falha |
| erro 500 | repete uma vez; de novo 500, tenta com as duas básicas; de novo, `erro_http` | vermelho no dia |
| 401 ou 403 de autorização | canal vai a `reautorizar` (regra existente), tentativas `sem_autorizacao` | aviso por e-mail existente |
| vídeo sem diário em dia (fonte parada há mais de 7 dias) | **não lê a curva** (o fim da janela não seria confiável) e conta em `sem_diario_em_dia` | nota "N vídeo(s) sem diário em dia" (vermelho) **por 3 dias**; depois, se o diário tentou 4 dias seguidos e o YouTube não devolveu o vídeo (`sem_dado_na_janela`, ou `erro_http` 403, 404 ou 410 que não seja de cota; erro de banco, resposta em forma inesperada, 500, 429 e cota **não** contam e o vídeo segue vermelho: emenda 2 do portão: N1), vira "ação do dono" com o id (a mesma regra do diário; metade ou mais do canal é pane e fica vermelho) (emenda do portão: I4, m-3) |
| vídeo com menos de 5 dias de vida e ainda sem diário | espera; conta em `novos` | resumo (não é falha) |
| `views` do diário desconhecido num vídeo já lido | não relê | resumo |
| tabela de retenção vazia, primeira execução | os 3 vídeos com view recente e os do "dia da leva" são lidos; os outros esperam o seu dia | `adiados_pela_leva` no resumo |
| `yt_own_retention_facts` ou a tabela não existem (código sem a MG5) | `schema_ausente`, o passo para | vermelho |
| sem tempo | `nao_alcancado_orcamento` por vídeo; o vídeo volta com prioridade no dia seguinte | 3 dias seguidos: vermelho (critério de orçamento) |
| `YT_OWN_STEPS_OFF=retencao` | o passo não roda; `resumo.retencao = { desligado: true }` | até a 7ª execução seguida: `acao_do_dono`, "retenção: passo desligado por YT_OWN_STEPS_OFF". **Da 8ª em diante: vermelho** ("…desligado há N execuções; religue, ou tire o passo por commit") (emenda do portão: I-7) |
| passo desligado e a leitura das execuções anteriores falha | não se sabe há quanto tempo | "critérios: não foi possível avaliar há quanto tempo o passo retenção está desligado" (vermelho) |
| nome desconhecido em `YT_OWN_STEPS_OFF` (erro de digitação) | nenhum passo é desligado por ele | "YT_OWN_STEPS_OFF tem nome desconhecido: x" (vermelho) |
| **Tela:** nenhuma linha e nenhuma tentativa com resposta | "Ainda não coletamos esta curva" (o texto de hoje) | não é falha |
| tela: quem pede não tem a prova de acesso | nada é consultado; a seção diz "Só quem edita o site vê a curva de retenção deste vídeo.", sem número e sem desenho | não é falha |
| tela: pontos gravados em forma ruim | a curva é tratada como ausente e o Sentry é avisado uma vez | "A leitura falhou agora" |

## 7. Simulação do dia do deploy e dos seguintes

Datas relativas: **M** = dia em que o dono aplica o lote C; **R** = dia em que o lote E8-coleta chega a `main`; **D** = dia em que o lote E6-P2 chega a `main` (depois da A4).

| Quando | O que roda | O que acontece |
|---|---|---|
| M | código antigo, schema novo | cobertura carregada até o último dia gravado (X ≈ M − 3). O cron antigo segue gravando 280 linhas por dia, zeros inclusive; a cobertura **não** avança (ninguém a escreve). `C = T` só vale neste dia |
| M+1 a R−1 | idem | o diário ganha dias além de X; a cobertura fica em X. Nada lê a cobertura ainda |
| R, 12:00 UTC | retenção ligada, diário antigo | fatos: `fonte_ate` vem da **última linha gravada** (a cobertura está parada em X, e por isso a função usa o maior dos dois). Lidos: os 3 vídeos com view nos últimos 14 dias mais os cerca de 5 do dia da leva. A maioria deve voltar vazia (C0.1) |
| R+1 a R+6 | idem | os outros dias da leva. Em R+6 todo vídeo tem curva ou tentativa com resposta |
| R+7 em diante | regime | só é relido o vídeo com 7 dias desde a última leitura **e** views novas |
| D (antes das 12:00 UTC) | leitor novo, coleta nova ainda sem rodar | o leitor junta as linhas (todas existem, zeros inclusive) com a cobertura (até X): mesmos números. `ultimoDia` = o maior entre a última linha e o último dia coberto |
| D, 12:00 UTC | primeira execução da dieta | para cada vídeo a janela começa em `min(hoje − 10, X)`: se D − M passou de 7 dias, começa em X e cobre tudo o que o coletor antigo gravou. A função apaga os zeros da janela (280 ou mais), estende a cobertura até hoje − 3. O critério de cobertura roda depois do passo: verde |
| D+1, D+2 | idem | nenhuma linha nova sem atividade; `max(covered_to)` avança um dia por execução. **Três execuções limpas liberam P3** (conferência com data) |
| qualquer dia | um vídeo novo é publicado | diário: sem cobertura, pede desde a publicação; nos 3 primeiros dias a API não devolve nada (`video_novo`). Retenção: espera o diário; depois lê `vida`; `primeiros_7_dias` quando a fonte passar do 7º dia; `primeiros_30_dias` idem |

**Ordem que não pode ser invertida:** a A4 não vai a `main` **sem** a Tarefa 5 se a Tarefa 3 já estiver em `main` (o leitor antigo leria os zeros apagados como "não medido"). Por isso as Tarefas 3 e 5 vão **no mesmo lote** (E6-P2), e esse lote só existe depois de a A4 estar fechada. **E a volta não é simétrica** (emenda do portão: I2): depois de a dieta rodar, **o leitor tolerante nunca mais sai**; só o coletor pode ser revertido (Tarefa 15).

**O que só liga depois (decisão 56: a espera de calendário não segura código).**

| O que | Como fica agora | O que só acontece depois |
|---|---|---|
| "3 execuções limpas de P2" antes de P3 | conferência com data `e6-p2-tres-execucoes` (D + 3) em `lib/conferencias.ts`; o critério de cobertura no cron | o plano de P3 |
| "primeira leva, 7 dias" (item 59) | conferência `e8-primeira-leva` (R + 8) | o resultado |
| tela com dado real nos três estados (item 64) | a tela vai com teste e semente, **sem esperar execução nenhuma da coleta** (antes da primeira leva ela mostra "ainda não coletamos", que é verdade) (emenda do portão: I-8); conferência `e8-tela-dado-real` (o que vier por último entre R + 8 e o envio da tela, mais 1) | a conferência em navegador com dois vídeos reais e a conta à mão |
| passo desligado esquecido | `criterioDesligados` no cron | vermelho na 8ª execução seguida |
| janelas de 7 e 30 dias | código e teste prontos | só rodam em produção quando houver vídeo novo (não há desde 12/2024) |

## 8. Desvios do texto do spec, com o motivo

1. **`points` não tem `started` nem `stopped`** e a lista de métricas é `audienceWatchRatio, relativeRetentionPerformance, totalSegmentImpressions` (C0.1: as outras duas dão 500 ou resposta vazia com essa dimensão).
2. **"Se a API recusar métrica" vira três regras**: 400 repete com as duas básicas (é o item 62); 500 repete uma vez e depois tenta as básicas; **200 vazio não é recusa**, é `sem_dado_na_janela` (C0.1: é o caso comum).
3. **Teto da retenção: 20 s, não 40 s, e como teto de fim** (`TETOS_DE_FIM_MS`, fora da soma de `TETOS_MS`; seção 5). O spec dizia "200 s de tetos em 270"; o código de HEAD já está em 240 s mais 30 s de reserva, sem folga na soma.
4. **`youtube_channel_removal_impact` deixa de ter a lista escrita** e passa a somar toda tabela com FK `on delete restrict` para `youtube_channels`. **Decisão R1 do controlador (emenda do portão: R1, I5, I-2): este é o corpo ÚNICO da A5, e este plano é o dono do texto.** Três planos recriavam a função com três corpos (MG9 da E16/E15, por lista; MG14, por catálogo; MG7 da E11, por outra lista), e a ordem de aplicação apagava tabelas de um no outro. Agora: toda migration que precisar que a função conheça tabela nova traz **exatamente** o bloco do apêndice A entre as marcas `-- >>> corpo único` e `-- <<< corpo único` (76 linhas, `create or replace`, com o `revoke` e o `grant`), sem mudar um byte, e nunca uma lista de tabelas. Na prática nem precisa trazer: a tabela nova entra sozinha se tiver `channel_id … on delete restrict`. **A MG5 não recria a função.** Como conferir a igualdade: `md5(prosrc)` = `4827d5ad12a0120b52ebc1280491b00c` depois de qualquer migration do lote (V7), e o `sha256` do bloco de 76 linhas = `83daff580903450b98a6ee480f5b098067f03eb1595233ca67a1268746f47ac6`. Provado no banco local em cinco ordens de aplicação (fato L15). **O corpo da função não mudou nesta emenda** (só os comentários em volta e as duas marcas): quem já copiou não precisa copiar de novo, só conferir o md5. **Conferido de novo na segunda emenda** (emenda 2 do portão: N1): o bloco entre as marcas continua com 76 linhas e `sha256` `83daff580903450b98a6ee480f5b098067f03eb1595233ca67a1268746f47ac6` (antes e depois da edição do apêndice B); `md5(prosrc)` dentro da transação de ensaio, com a MG14 e a MG5 emendada aplicadas duas vezes, = `4827d5ad12a0120b52ebc1280491b00c`.
5. **Índice da cobertura** em (`channel_id`, `metric_set`, `covered_to`), não (`channel_id`, `covered_to`): todas as leituras filtram pelo conjunto.
6. **`yt_own_daily_apply` exige que `p_rows` e `p_days_returned` sejam o mesmo conjunto de dias** (uma linha por dia devolvido, zeros inclusive) e recusa se não forem; quem decide "tem atividade" é **só** a função. Devolve `jsonb` com as contagens. Trava por vídeo (`pg_advisory_xact_lock`).
7. **A carga da cobertura só toca vídeo e conjunto que ainda não têm intervalo.** Sem isso, rodar a migration de novo depois da dieta criaria intervalos picados por cima do intervalo certo.
8. **Três `check` a mais na retenção**: `window_end >= window_start`, `requested_end >= window_end`, e o tamanho de `points` igual a `point_count`.
9. **`window_end` é inferido.** A resposta da API não diz até que dia cobriu. Usa-se o último dia que a mesma API devolveu no diário do vídeo (`fonte_ate`), limitado ao fim pedido. Se o diário do vídeo está parado há mais de 7 dias, a curva não é lida (linha da seção 6).
10. **Função nova `yt_own_retention_facts`**, que não está no spec: devolve numa ida ao banco os fatos por vídeo. A regra fica em código puro, testado sem banco.
11. **Primeira leva:** os vídeos com view nos últimos 14 dias são lidos no primeiro dia, fora do espalhamento por 7 dias. O espalhamento usa `sha256` do id do YouTube (não do uuid).
12. **Item 59 e NP-E8 só contam tentativa com resposta** (`ok` ou `sem_dado_na_janela`). Do jeito que o spec escreve, uma tentativa `nao_alcancado_orcamento` ou `erro_http` contaria como "tem tentativa": verde falso.
13. **Recado ao plano de P3: `C = T` deixa de valer depois de P2** (fato L4: a primeira execução apaga os zeros da janela e `C` fica maior). As igualdades de antes de P3 passam a ser: nenhuma linha do diário fora de um intervalo `base` (consulta K4, seção 11) e `C = T +` dias cobertos sem linha.
14. **`ultimoDia` do leitor** é o maior entre o último dia coberto e a última linha (não só `max(covered_to)`): vale nos dois estados e no intervalo entre M e D. E o leitor tolera a tabela de cobertura ausente.
15. **O leitor da retenção nasce com o `Pedido` de `ler.ts`**, que hoje carrega `EdicaoDoSite`: o token `LeituraPrivadaDoSite` ainda não existe no código. O passo 0 da E17 troca o tipo de `Pedido` num lugar só e os dois leitores mudam juntos. As policies já nascem pelo bloco PL. **Discordância declarada com o texto do spec** (emenda do portão: m-9): o índice (linhas 474 e 501) diz que os leitores nascem com o token de leitura e põe a E17 passo 0 (ordem 9) antes da E8 (ordem 10). Não espero a E17 porque a ordem do dono é implementar o quanto antes (decisão 56) e o efeito hoje é nulo (não há usuário só com o direito de leitura). **O controlador confirma**, e o plano da E17 passo 0 tem de listar `proprio/ler-retencao.ts` e o estado `negado` da tela da retenção entre o que ele troca e testa.
16. **Janelas de 7 e de 30 dias param de ser tentadas 45 dias depois do fim da janela**, e só valem para vídeo cuja janela fecha a partir de `RETENCAO_JANELAS_DESDE`, fixada em 13/10/2026 (decisão 32: nada é retroagido; não há vídeo publicado desde 12/2024, então a data exata não muda nenhuma leitura).
17. **`metric_version` da curva** = a do `window_end`.
18. **Passo desligado** devolve `{ desligado: true }` no resumo (a mesma forma do plano da E11) e uma nota em `acao_do_dono`. **Até a 7ª execução seguida o cron não fica vermelho por isso; da 8ª em diante fica** (emenda do portão: I-7): `acao_do_dono` só vai para o corpo da resposta e para `yt_own_collection_runs`, ninguém recebe e-mail de cron verde, e o critério da retenção não é avaliado com o passo desligado; um passo desligado e esquecido ficaria verde para sempre, e o item 245 pede "desligado" no retorno **e no vigia**. A conta sai de `yt_own_collection_runs.resumo` (execuções seguidas com `<passo>.desligado = true`), no arquivo novo `coleta/criteria-desligados.ts` (Tarefa 2c), **escrito para qualquer passo com interruptor**: é a **regra única, decidida pelo controlador** para E8, E11 e E18 (emenda 2 do portão: controlador b): a E11 e a E18 só acrescentam o nome à lista. Desligar de vez é commit (tirar o passo), não variável. É o mesmo desenho das conferências vencidas (`DIAS_ATE_O_VERMELHO`).
19. **`COLLECTION_KINDS` já nasce com os cinco valores novos** do spec, inclusive os três da E11, para a E11 não mexer no catálogo.
20. **Vídeo que nunca teve curva (só resposta vazia)** é tentado de novo com 7 dias **e** view no diário depois da última resposta (menos 3 dias de atraso da fonte): a regra do spec usa `views_at_read`, que não existe sem linha.
21. O cabeçalho de `diario-step.ts` diz "dia sem atividade não vem na resposta": é falso (fato P3) e é corrigido.
22. **`yt_own_daily_apply` recusa a chamada em que a métrica que define o conjunto não veio como número** (`views` para `base`, `engaged_views` para `estendidas`), recusa linha sem `metric_version`, e **não apaga linha com `views` nulo** (emenda do portão: I1, I-1, m4). O spec (D11) não previa a recusa; sem ela, "a métrica não veio" virava "zero medido" dentro da função, em verde. As três mudanças estão no apêndice A e foram rodadas (fatos L12 a L14).
23. **`yt_own_retention_facts` ganhou um parâmetro e quatro campos** (emenda do portão: I3, I4, m-2): `p_hoje_utc date default null` (o código passa o seu dia UTC; os testes não dependem do relógio do banco), `leva_ancora_dia` (a primeira execução do passo no canal), `diario_tent_dia`, `diario_tent_resultado` e `diario_falhas_4d` (o diário do vídeo nos 4 últimos dias). O parecer de dados propunha a âncora por uma leitura a mais no código; ficou na função porque a regra do passo (m-2) e o critério (I3) precisam do mesmo valor na mesma ida ao banco, e o SQL da MG5 ia ser rodado de novo de qualquer jeito (m10). **`diario_falhas_4d` conta só quando o YouTube não devolveu o vídeo** (emenda 2 do portão: N1): `sem_dado_na_janela`, ou `erro_http` com `http_status` 403, 404 ou 410 e `error` que não case `(quota|Limit)Exceeded`. Na primeira emenda contava todo `erro_http`, e uma falha NOSSA de 4 dias (erro de banco, `forma_inesperada`, 500, cota) tirava o vídeo do vermelho e o mandava para `acao_do_dono` com o texto "o YouTube não devolve mais o vídeo". A mesma regra está escrita em TypeScript (`youtubeNaoDevolveu`, Tarefa 2b), com os mesmos casos de teste dos dois lados.
24. **Fim do alarme do vídeo que o YouTube não devolve** (emenda do portão: I4, m-3): regra nova, que o spec não tem, igual à que o controlador fixou para os canais de concorrente (decisão 48). Vale para a nota do diário, a do critério de cobertura e a "sem diário em dia" da retenção, por uma função pura só (Tarefa 2b).
25. **A coluna `error` das tentativas recebe um código de um catálogo fechado, nunca o texto da exceção** (emenda do portão: R3). O passo novo (retenção) e o passo reescrito (diário) gravam `motivoDoErro(e)` (Tarefa 2: `coleta/motivo.ts`); o texto que o dono lê sai de `textoDoMotivo(código)`; o detalhe técnico vai ao Sentry, só com o id do vídeo. Os outros passos antigos (`meta-step`, `reports-step`, `jobs-step`) ainda gravam `describeCronCause(e)` nessa coluna: **não são deste plano**; vai para a lista de dívida (seção 13).
26. **Vídeo nunca tentado depois que a primeira leva acabou é lido no mesmo dia** (emenda do portão: m-2): o dia da leva só vale nos 7 primeiros dias do passo no canal (`leva_ancora_dia`). Sem isso, um vídeo que perdesse o seu dia (cron caído, passo desligado) esperava mais 7 dias com o critério vermelho e sem o passo se curar.
27. **A regra 2(a) da retenção ganhou a trava do fim da janela** (emenda do portão: m3): com linha gravada, uma tentativa sem resposta só é refeita quando o fim da janela novo é posterior ao da linha; senão a leitura cairia na mesma chave e trocaria a curva da semana anterior.

## 9. Arquivos, tarefas, ordem e paralelismo

Caminhos relativos a `apps/web/`, salvo `supabase/`, `scripts/`, `docs/` e `.superpowers/`. **N** = arquivo novo. **Tabela refeita na emenda** (emenda do portão: I-3, I-6, I-8, I-9, m-4, m-6, m-11, R2, R5): a Tarefa 0 saiu (já feita), a Tarefa 1 virou 1a e 1b, a leitura da cobertura saiu da Tarefa 3 e virou a 3a (a 3 e a 4 importam dela e não podiam rodar juntas), e entraram 2b, 2c, 3b e 9b. Nenhuma tarefa da mesma linha de "pode rodar junto" toca arquivo de outra.

| # | Tarefa | Lote | Arquivos (lista fechada) | Depende de | Pode rodar junto com |
|---|---|---|---|---|---|
| 2 | Catálogo de `kind`, interruptor, relógio, motivos | E8-coleta | `src/lib/youtube/coleta/kinds.ts` N, `…/coleta/passos-desligados.ts` N, `…/coleta/motivo.ts` N, `…/coleta/types.ts`, `…/coleta/attempts.ts`, `…/coleta/clock.ts`, `…/coleta/day-pt.ts` (um alias), `test/youtube/coleta/kinds.test.ts` N, `…/passos-desligados.test.ts` N, `…/motivo.test.ts` N, `…/clock.test.ts`, **`test/youtube/coleta/fake-supabase.ts`** (só a lista de `kind` do manipulador de `yt_own_attempt_record`, que passa a vir de `COLLECTION_KINDS`), **`test/youtube/coleta/fake-supabase.test.ts`** (emenda 3 do portão: T2) | nada. **É a primeira e roda sozinha**: é a dona de arquivos que a E11 também queria criar (ver abaixo) | nenhuma; as outras começam quando ela estiver commitada |
| 2b | Regra pura do fim do alarme | E8-coleta | `src/lib/youtube/coleta/atraso-permanente.ts` N, `test/youtube/coleta/atraso-permanente.test.ts` N | 2 | 2c, 3a, 7, 12a, 1a |
| 2c | Critério do passo desligado | E8-coleta | `src/lib/youtube/coleta/criteria-desligados.ts` N, `test/youtube/coleta/criteria-desligados.test.ts` N | 2 | 2b, 3a, 7, 12a, 1a |
| 3a | Leitura da cobertura | E6-P2 | `src/lib/youtube/coleta/cobertura.ts` N, `test/youtube/coleta/cobertura.test.ts` N | 2 | 2b, 2c, 7, 12a, 1a |
| 7 | Chamada da retenção | E8-coleta | `src/lib/youtube/coleta/analytics-retencao.ts` N, `test/youtube/coleta/analytics-retencao.test.ts` N, `test/youtube/coleta/fixtures/retencao/*.json` N (cópias das fixtures da C0.1) | 2 | 2b, 2c, 3a, 12a, 1a |
| 8 | Regra pura da retenção | E8-coleta | `src/lib/youtube/coleta/retencao-regra.ts` N, `test/youtube/coleta/retencao-regra.test.ts` N | 2, **2b** (importa `separarPermanentes`) | 3, 4, 2c, 7, 12a, 1a |
| 12a | Modelo puro da curva | E8-tela | `src/lib/youtube/observatorio/proprio/retencao-curva.ts` N, `test/youtube/observatorio/proprio-retencao-curva.test.ts` N | nada | todas |
| 1a | SQL de ensaio e teste de schema | M | `.superpowers/sdd/a5-e6-e8/sql/mg14.sql` N, `.superpowers/sdd/a5-e6-e8/sql/mg5.sql` N (cópias dos apêndices, **fora** de `supabase/migrations/`), `test/integration/a5-e6-e8-schema.test.ts` N, `src/types/database.types.ts` | 2 (o teste de `kind` importa o catálogo); **o controlador aplica o SQL no `bythiago_int`** | 2b, 2c, 3a, 7, 8, 12a |
| 9 | Passo "retenção" | E8-coleta | `src/lib/youtube/coleta/retencao-step.ts` N, `test/youtube/coleta/retencao-step.test.ts` N, `test/youtube/coleta/fake-retencao.ts` N | 2, 7, 8 | 10, 3, 4 |
| 10 | Critério da retenção | E8-coleta | `src/lib/youtube/coleta/criteria-retencao.ts` N, `test/youtube/coleta/criteria-retencao.test.ts` N | 2, 8 | 9, 3, 4 |
| 9b | Retenção contra o banco de verdade | E8-coleta | `test/integration/a5-e8-passos.test.ts` N | 1a, 9, 10 | 3, 4, 3b |
| 11a | Integração da retenção no cron | E8-coleta | `src/lib/youtube/coleta/index.ts`, `test/youtube/coleta/index.test.ts`, `src/lib/conferencias.ts`, `test/lib/conferencias.test.ts`, `.superpowers/sdd/a5/conferencias-com-data.md`, `docs/ops/youtube-coleta-canais-proprios-runbook.md`, **`test/youtube/coleta/fake-supabase.ts`** (manipulador padrão de `yt_own_retention_facts` que devolve `[]`), **`test/youtube/coleta/fake-supabase.test.ts`**, **`test/youtube/coleta/tres-dias.test.ts`**, **`test/youtube/coleta/orcamento.test.ts`** (emenda 2 do portão: F-1; os dois testes de relógio estourado passam a 280 s e entra um teste novo de 300 s: emenda 3 do portão: T1) | 2c, 9, 10 | nenhuma que toque `index.ts`, `conferencias.ts`, o runbook, `fake-supabase.ts`, `tres-dias.test.ts` ou `orcamento.test.ts` (a 3, a 11b e a E11) |
| 14 | Ensaio com a API real, gravando só no banco local | E8-coleta | `scripts/ensaio-retencao-ler-producao.ts` N, `scripts/ensaio-retencao.ts` N (fora do build), `.superpowers/sdd/a5-e6-e8/ensaio.md` N | 1a, 9; **o sim do dono à pergunta 3** (dado em 13/10, decisão 61) | 3, 4 |
| 3 | Diário pela função | E6-P2 | `src/lib/youtube/coleta/diario-step.ts`, `test/youtube/coleta/diario-step.test.ts`, `test/youtube/coleta/tres-dias.test.ts`, `test/youtube/coleta/fake-daily-apply.ts` N, **`test/youtube/coleta/fake-supabase.ts`** (instala o manipulador padrão de `yt_own_daily_apply`), **`test/youtube/coleta/fake-supabase.test.ts`**, **`test/youtube/coleta/orcamento.test.ts` e `test/youtube/coleta/index.test.ts`** (só se a suíte pedir; com o manipulador padrão não deveriam) (emenda 2 do portão: F-1) | 2, 3a (não espera a migration: usa o falso) | 4, 8, 9, 10; **não com a 11a nem com a 11b** (dividem `fake-supabase.ts`, `tres-dias.test.ts`, `orcamento.test.ts` e `index.test.ts`) |
| 4 | Critério de cobertura | E6-P2 | `src/lib/youtube/coleta/criteria-cobertura.ts` N, `test/youtube/coleta/criteria-cobertura.test.ts` N | 2, 2b, 3a (importa `separarPermanentes` e `lerCoberturaBase`) | 3, 8, 9, 10 |
| 5 | Leitor tolerante | E6-P2 | `src/lib/youtube/observatorio/proprio/cobertura-leitor.ts` N, `src/lib/youtube/observatorio/proprio/ler.ts`, `test/youtube/observatorio/proprio-cobertura-leitor.test.ts` N, `test/youtube/observatorio/proprio-ler.test.ts`, `test/youtube/observatorio/proprio-ler-db.test.ts` | **A4 fechada**; 1a | 12b, 9b |
| 3b | Dieta contra o banco de verdade | E6-P2 | `test/integration/a5-e6-passos.test.ts` N | 1a, 3, 4, 5 | 12b |
| 6 | Semente e2e e prova de "mesmos números" | E6-P2 | `e2e/fixtures/observatorio-seed.ts`, `e2e/tests/cms/observatorio/proprio-a5-dieta.spec.ts` N | **A4 fechada** (e a semente sem alteração pendente de outro terminal); 5 | nenhuma que toque a semente (a 13) |
| 11b | Integração da dieta no cron | E6-P2 | `src/lib/youtube/coleta/index.ts`, `test/youtube/coleta/index.test.ts`, `src/lib/conferencias.ts`, `test/lib/conferencias.test.ts`, `.superpowers/sdd/a5/conferencias-com-data.md`, `docs/ops/youtube-coleta-canais-proprios-runbook.md`, **`test/youtube/coleta/fake-supabase.ts`** (auxiliar `semearCobertura`), **`test/youtube/coleta/fake-supabase.test.ts`** (o teste de `semearCobertura`; emenda 3 do portão: menor 5), **`test/youtube/coleta/tres-dias.test.ts`**, **`test/youtube/coleta/orcamento.test.ts`** (emenda 2 do portão: F-1; o teste de 300 s ganha a nota de sem tempo da cobertura: emenda 3 do portão: T1) | 3, 4, 11a | nenhuma que toque `index.ts`, `conferencias.ts`, o runbook, `fake-supabase.ts`, `tres-dias.test.ts` ou `orcamento.test.ts` |
| 12b | Leitor da retenção | E8-tela | `src/lib/youtube/observatorio/proprio/ler-retencao.ts` N, `test/youtube/observatorio/proprio-ler-retencao.test.ts` N, `test/youtube/observatorio/proprio-ler-retencao-db.test.ts` N, `test/youtube/observatorio/proprio-varredura.test.ts` | **A4 fechada**; 1a; 12a; **8** (o tipo `Janela`, de `coleta/retencao-regra.ts`: o lote E8-coleta em `main`) (emenda 2 do portão: m-F4). **Não toca `ler.ts`** e não espera a Tarefa 5 (emenda do portão: I-8) | 5, 3b |
| 13 | Tela da retenção (mockup 6) | E8-tela | `src/app/cms/(authed)/youtube/competitors/_proprio/retencao-curva-model.ts` N, `…/_proprio/retencao-curva.tsx` N, `…/_proprio/retencao-curva.css` N, `…/_proprio/video-blocos-model.ts`, `…/_proprio/video-blocos.tsx`, `…/_proprio/dados.ts`, `…/_proprio/header-model.ts` (uma frase), `…/video/[id]/page.tsx`, `test/youtube/observatorio/proprio-retencao-curva-tela.test.tsx` N, `test/youtube/observatorio/proprio-dados.test.ts`, `e2e/fixtures/observatorio-seed.ts`, `e2e/tests/cms/observatorio/proprio-a5-retencao.spec.ts` N, **`src/lib/conferencias.ts`, `test/lib/conferencias.test.ts`, `.superpowers/sdd/a5/conferencias-com-data.md`** (`E8_TELA_DEPLOY`) (emenda 2 do portão: m-F4) | **A4 fechada**; 12b | nenhuma que toque a semente (a 6) nem `conferencias.ts` (a 11a e a 11b). A 6 e a 13 não dependem uma da outra: mexem na semente **uma de cada vez, em qualquer ordem** (emenda do portão: I-8) |
| 1b | Os dois arquivos de migration | M | `supabase/migrations/<ts>_observatorio_a5_e6_dieta_cobertura.sql` N, `supabase/migrations/<ts>_observatorio_a5_e8_retencao.sql` N | **a vez do lote C** (R2); o acordo dos dois especialistas | nenhuma (o controlador chama os `db:new` do lote em ordem) |
| 15 | Envio, retrato e conferências | todos | `.superpowers/sdd/a5-e6-e8/progress.md` N, `.superpowers/sdd/a5/retratos/e6-antes.json` N e `e6-depois.json` N, `src/lib/conferencias.ts` (as datas) | cada lote | nenhuma |

**O que pode começar JÁ, sem esperar migration em produção, mockup nem resposta do dono** (emenda do portão: I-3, I-9): a **2** (sozinha, primeiro). Com ela commitada: **2b, 2c, 3a, 7, 12a e 1a** (seis frentes, arquivos diferentes; a 12a pode até rodar junto com a 2; a 1a precisa do controlador para aplicar o SQL de ensaio no banco de integração). Depois: **8, 3 e 4** (a 3 e a 4 usam o banco falso e não esperam migration); depois **9 e 10**; depois **9b** e **11a**. Isso é o lote E8-coleta inteiro pronto e a parte de coleta do lote E6-P2 pronta, tudo antes de o dono aplicar qualquer coisa. **Uma restrição de ordem que a segunda emenda acrescentou** (emenda 2 do portão: F-1): as Tarefas **3, 11a e 11b** dividem `test/youtube/coleta/fake-supabase.ts`, `tres-dias.test.ts` e `orcamento.test.ts` (e `index.test.ts`), e a E11 também (Tarefa 10 dela). **Nunca duas ao mesmo tempo**: a ordem entre a 3 e a 11a é a que o controlador der (cada uma parte do HEAD e toca só o seu bloco do falso: o manipulador de `yt_own_daily_apply` na 3, o de `yt_own_retention_facts` na 11a), e a 11b vem depois das duas. A Tarefa 9 **não** toca o falso (os `kind` novos já são aceitos por ele desde a Tarefa 2, que roda sozinha), por isso continua podendo rodar junto com a 3 (emenda 3 do portão: T2). Esperam a A4 fechar: 5, 3b, 6, 12b, 13. Esperava o sim do dono, dado em 13/10 (decisão 61): 14. Espera a vez do lote C: 1b. Esperam as migrations em produção: só os **envios**.

**Ondas.** Onda 0: 2. Onda 1: 2b, 2c, 3a, 7, 12a, 1a. Onda 2: 8, 3, 4. Onda 3: 9, 10. Onda 4: 9b, 11a, 14 (a 11a só depois de a 3 estar commitada, ou antes dela, nunca junto: ver acima). (Lote C aplicado pelo dono: 1b na vez dele.) Envio do lote E8-coleta. Onda 5 (com a A4 fechada): 5 e 12b; depois 3b, 6 e 13 (6 e 13 uma de cada vez); 11b. Envio do lote E6-P2 e do lote E8-tela, em qualquer ordem entre os dois.

**Arquivos compartilhados com outras etapas da A5** (emenda do portão: I-9, I5, I-2, m-7):

| Arquivo | Quem mais mexe | Combinação |
|---|---|---|
| `coleta/passos-desligados.ts` e o teste dele; `coleta/kinds.ts`; a chave nova de `coleta/clock.ts` (`TETOS_DE_FIM_MS`) | E11 (a Tarefa 6 dela também os criava, "quem chegar primeiro cria"), E18 | **Posse: a Tarefa 2 deste plano** (ordem 8, a menor das três), feita e **commitada antes** de a E11 começar a Tarefa 6 dela. Dois agentes na mesma árvore de trabalho criando o mesmo arquivo é um sobrescrevendo o outro. No plano da E11, "cria" vira "confere que existe"; o contrato de `passos-desligados.ts` é o dela (linhas 509 a 511 do plano dela), mais uma função. `TETOS_DE_FIM_MS` **já nasce com as três chaves** (`retencao: 20_000`, e as duas da E11 com os valores do plano dela, `dimensoes: 30_000` e `normalizadores: 20_000`), e `COLLECTION_KINDS` já nasce com os três `kind` da E11: a E11 não precisa abrir nenhum desses arquivos; se mudar um número, muda uma linha. **Decidido pelo controlador**: a Tarefa 2 é a DONA de `passos-desligados.ts`, `kinds.ts` e `clock.ts` (e de `motivo.ts` e `criteria-desligados.ts`); a E11 só confere (emenda 2 do portão: controlador a). `clock.ts` ganha também `prazoDoCriterio` (Tarefa 2) |
| `coleta/types.ts` | E11 (o plano dela edita a união `AttemptKind`) | a união some na Tarefa 2 (vira reexportação de `kinds.ts`); a E11 não edita mais `types.ts` |
| `coleta/criteria-desligados.ts` | E11, E18 | nasce aqui (Tarefa 2c), para qualquer passo com interruptor; a E11 e a E18 só passam o nome delas na chamada de `index.ts` |
| `coleta/index.ts`, `test/youtube/coleta/index.test.ts` | E11, E18 | uma integração por vez. **A ordem dos passos e dos critérios é a da seção 5, escrita uma vez**; quem integrar depois encaixa nela. A nota de nome desconhecido é `pushUnico(falhas, notaNomesDesconhecidos())`: o texto vem de uma função só e `pushUnico` não repete, então as duas integrações podem chamá-la |
| `youtube_channel_removal_impact` (SQL) | MG9 (E16/E15), MG7 (E11), MG12 (E18) | desvio 4 e R1: **um corpo só, o do apêndice A, e este plano é o dono do texto**. Quem recriar copia o bloco entre as marcas; o fecho confere `md5(prosrc)` |
| `test/youtube/coleta/fake-supabase.ts`, `…/tres-dias.test.ts`, `…/orcamento.test.ts`, `test/cron/sync-analytics-metrics-veredito.test.ts` (emenda 2 do portão: F-1) | **E11 (a Tarefa 10 dela edita os quatro)**, E6-P2 (3 e 11b), E8 (11a), a Tarefa 2 (só a lista de `kind`, antes de todas) (emenda 3 do portão: T2) | O falso devolve `PGRST202` para `rpc` sem manipulador, e o passo trata isso como `schema_ausente` em `falhas`: todo teste que roda `rodarColeta` e afirma `falhas` vazia quebra quando uma função nova entra no cron. **Cada etapa acrescenta só o seu**, e `fakeSupabase()` já devolve o objeto com os manipuladores padrão instalados: `yt_own_daily_apply` (Tarefa 3, regra de `fake-daily-apply.ts`), `yt_own_retention_facts` devolvendo `{ data: [], error: null }` (Tarefa 11a), as seis da E11 (Tarefa 10 dela), e a semeadura de cobertura em dia dos testes que têm vídeo antigo (Tarefa 11b, auxiliar `semearCobertura`). Teste que quer a função ausente usa `db.errors['rpc:<nome>']` (que já tem precedência). **Uma etapa por vez, na ordem de integração; quem chega depois encaixa.** `veredito` **este plano não edita**: ele troca `rodarColeta` inteira por `vi.fn()` (conferido por `grep`), e só entra no comando de "pronto quando", junto com `test/cron/sync-analytics-metrics.test.ts` e `test/api/cron/sync-analytics-metrics.test.ts`, que também a trocam |
| `proprio/ler.ts` | A4 (dona), E17 passo 0, E11, E18 | só a Tarefa 5, depois da A4 fechada; a 12b não toca mais |
| `_proprio/dados.ts`, `e2e/fixtures/observatorio-seed.ts` | A4, E11, E18 | acréscimos em blocos próprios, uma etapa por vez. **Antes de editar: `git status` do arquivo; se houver alteração sem commit de outro terminal, não tocar e avisar o controlador** (hoje há: fato P11) |
| `src/lib/conferencias.ts`, `test/lib/conferencias.test.ts`, `conferencias-com-data.md` | toda etapa | só acrescenta: uma constante `…_DEPLOY` nula e uma função por lote, no molde de `conferenciasE1E2` |
| `src/types/database.types.ts` | toda etapa com migration | regenerado do `bythiago_int`, nunca editado à mão; o diff traz também o que outras etapas já aplicaram lá |
| o banco `bythiago_int` | toda etapa com teste de integração | **aplicar SQL ou `migration up` nele é do controlador, um de cada vez** (a pasta de migrations dele é um atalho para a do repositório: o `migration up` de um agente aplicaria o arquivo meio escrito de outro). Todo teste semeia o **seu** site e o **seu** canal e só olha para eles (R5) |
| `docs/ops/youtube-coleta-canais-proprios-runbook.md` | E11, E18, E20 | seções próprias |

**A agenda (R4) não é tocada por este plano.** Os passos daqui entram em `coleta/index.ts` (cron `sync-analytics-metrics`), não na agenda de tarefas do plano da ordem 5; não há tipo de tarefa nem relógio dela a citar.

**Restrições globais** (valem para toda tarefa):
- TypeScript `strict`, nunca `any`; entrada vinda de fora validada (Zod ou guarda de tipo); arquivo em kebab-case.
- Nenhuma mensagem de erro leva o corpo da resposta do Google nem o texto do Postgres; toda mensagem que o dono lê é em português. **Nenhuma coluna de motivo recebe texto de exceção** (emenda do portão: R3): grava-se `motivoDoErro(e)`, um código do catálogo de `coleta/motivo.ts`; o texto humanizado sai de `textoDoMotivo`; o detalhe técnico vai ao Sentry, com o id do vídeo e mais nada.
- **Aviso ao dono é cron vermelho (que vira e-mail) ou e-mail** (R10): nada neste plano conta com push nem com o sino do CMS. `acao_do_dono` não avisa ninguém: o que vai para lá ficou vermelho antes, por 3 dias ou por 7 execuções.
- **Todo número de prova tem quem o chame e um teste contra o banco** (emenda do portão: R9, I-6): `criterioCobertura`, `criteriosRetencao` e `criterioDesligados` são chamados em `coleta/index.ts` (Tarefas 11a e 11b), que a rota `sync-analytics-metrics` transforma em `recordCronFailure`; cada um tem teste de unidade nos dois sentidos e com o estado vazio, **e** um teste contra o `bythiago_int` (Tarefas 9b e 3b); as duas funções SQL são testadas com parâmetro nulo (Tarefa 1a).
- Nulo nunca vira zero. Toda leitura que pode passar de 1.000 linhas é paginada ou falha; todo teto que corta conta quanto cortou.
- Nada chama `recordCronSuccess` nem `recordCronFailure`: os passos só acumulam `falhas[]`.
- Teste de integração: `describe.skipIf(skipIfNoLocalDb())`, `// @vitest-environment node`, contra o `bythiago_int`, sem paralelismo entre arquivos, semeia e limpa o que semeou, **e só lê o seu site e o seu canal** (o banco é dividido entre etapas). Datas relativas ou relógio falso, nunca ano fixo no futuro. **Como rodar** (emenda do portão: R5, m-4; a variável `TEST_SUPABASE_URL` da primeira versão não existe): `HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run <arquivo> --no-file-parallelism`.
- Para toda variável com padrão: um teste que **apaga** a variável e afirma o padrão.
- Commits em `staging`, `tipo: descrição`, por caminho explícito. Nenhum `db:reset`. Produção: só `select`.

**Foco de revisão** (o que o revisor confere primeiro): (a) a função `yt_own_daily_apply` contra o banco, nos dois sentidos, **com `views` ausente**; (b) o leitor devolve as mesmas `DiarioLinha` nos dois estados do banco; (c) cada critério tem uma entrada que o faz subir, uma que não pode fazê-lo subir e o estado "tabela vazia"; (d) nenhuma tentativa sem resposta conta como leitura; (e) a tela não inventa curva; (f) cada critério **contra o banco** (Tarefas 9b e 3b); (g) o ensaio: o roteiro que roda o passo não importa `token-refresh`, não chama `obterToken` e o processo não tem credencial de produção; (h) nenhum vídeo sai do vermelho para "ação do dono" sem 3 dias de vermelho antes, nem quando metade do canal está igual.

## 10. As tarefas

### Tarefa 0: retirada (emenda do portão: m-4, R5)

A "URL do banco de teste por variável" **já foi feita** no lote de E1/E2 (commit `69bd83c7`): `localSupabaseUrl()` em `test/helpers/db-skip.ts` lê `NEXT_PUBLIC_SUPABASE_URL` (padrão `http://127.0.0.1:54321`), `test/helpers/db-seed.ts` a usa, e há `test/helpers-env/local-db-url.test.ts`. Este plano **não** toca esses arquivos e **não** cria `TEST_SUPABASE_URL`. O comando de rodar a integração está nas restrições globais (seção 9).

### Tarefa 1a: SQL de ensaio no banco de integração e teste de schema (emenda do portão: I-3, R2, m5, m-7, m-11)

**Objetivo.** O SQL dos apêndices A e B aplicado no `bythiago_int`, o teste de schema verde e os tipos regenerados, **sem criar nenhum arquivo em `supabase/migrations/`**. É o que deixa as tarefas de código e os testes de integração andarem antes da vez do lote C.
**Passos.**
1. O agente copia os dois blocos de SQL dos apêndices, byte a byte, para `.superpowers/sdd/a5-e6-e8/sql/mg14.sql` e `mg5.sql` (na MG5, `<MG14>` do cabeçalho fica como está; a Tarefa 1b troca pelo nome do arquivo).
2. **O controlador** (não o agente; um de cada vez no banco dividido) aplica no `bythiago_int`: primeiro a `20261012000004`, se ainda não estiver lá (hoje o banco está em `…000003`; sem ela os tipos regenerados perdem o que ela criou), por `npx supabase migration up --workdir ~/.local/share/bythiago-db-int`, **só se não houver arquivo de outra etapa pela metade na pasta de migrations**; depois `psql postgresql://postgres:postgres@127.0.0.1:54422/postgres -v ON_ERROR_STOP=1 -f mg14.sql -f mg5.sql` e `notify pgrst, 'reload schema'`. Os dois arquivos rodam duas vezes sem erro (fato L19): quando a Tarefa 1b criar os arquivos de verdade e o `migration up` os aplicar de novo, nada muda.
3. Tipos: `npx supabase@2.98.2 gen types typescript --db-url postgresql://postgres:postgres@127.0.0.1:54422/postgres --schema public > apps/web/src/types/database.types.ts`; conferir que o diff só acrescenta as duas tabelas e as duas funções (mais o que outras etapas já aplicaram lá).
**Armadilhas.** Não usar `npm run db:new` nem `npx supabase migration new` nesta tarefa. Não aplicar no banco das portas 54321/54322. Neste Postgres local, chamar função sem `EXECUTE` como `anon` ou `authenticated` derruba o servidor: o teste confere a permissão por `has_function_privilege`, **nunca chamando**. Tipos commitados com tabela que ainda não existe em produção não quebram nada (o código que as usa só vai a `main` depois das migrations).
**Testes** (`test/integration/a5-e6-e8-schema.test.ts`, com o cliente de serviço; cada um semeia um site, um canal e os vídeos de que precisa, e só lê o que semeou):

| Nome | Entrada | Esperado |
|---|---|---|
| a cobertura nasce do diário existente | o teste insere linhas de um vídeo sem cobertura e executa, pela conexão `pg` que `db-seed.ts` já usa, o trecho **lido do arquivo de ensaio** `.superpowers/sdd/a5-e6-e8/sql/mg14.sql` (entre os comentários `── 2.` e `── 3.`), não uma cópia | uma ilha por sequência de dias; conjunto `estendidas` só onde `engaged_views` não é nulo; linha com `views` nulo não gera intervalo `base`; rodar o trecho de novo não cria nada |
| apply: dia com atividade entra, dia de zero não | 9 dias, um com `views: 2` | 1 linha; cobertura `base` de 9 dias; retorno `inseridas: 1` |
| apply: dia revisado para zero perde a linha e continua coberto (item 46) | mesma chamada com o dia a zero | 0 linhas; cobertura igual; `apagadas: 1` |
| apply: chave ausente não apaga valor gravado | linha com `card_impressions: 7`; chamada só com as métricas base em zero, `p_sets: ['base']` | a linha fica, `views 0`, `card_impressions 7` |
| apply: chave presente e nula grava nulo | `avg_view_percentage: null` | coluna nula |
| apply: buraco parte o intervalo e o dia que chega depois funde | dias 20, 21, 23; depois 16 a 22 | 2 intervalos, depois 1 |
| apply: conjuntos independentes | `p_sets: ['base']` | `estendidas` não muda |
| **apply recusa dia sem `views` no conjunto base, e nada é gravado** (emenda do portão: I1, I-1) | três chamadas: dia sem a chave `views`; `views: null`; `views: "3"` (texto) | erro `22023` nas três; 0 linhas e 0 intervalos depois |
| **apply recusa `estendidas` sem `engaged_views`; a mesma resposta só com `base` é aceita** (I1) | dias só com as métricas base; `p_sets` com e sem `estendidas` | recusa; depois aceita, com cobertura só de `base` |
| **apply não apaga linha com `views` nulo** (I-1 b) | linha (`views` nulo, `engaged_views` 0); chamada só de `estendidas`, tudo em zero | a linha fica; cobertura só de `estendidas`. Depois, chamada de `base` com `views: 0`: a linha sai e o dia fica coberto nos dois |
| **apply recusa linha sem `metric_version`, mesmo em dia de zero** (m4) | `[{ day_pt, views: 0 }]` | erro `22023` |
| apply: recusa dias divergentes, dia repetido, conjunto de fora, `p_ids` sem canal | quatro chamadas | erro em cada uma **e nada gravado** |
| **apply com parâmetro nulo** (emenda do portão: R9) | `p_video` nulo; `p_ids` nulo; `p_sets` nulo; `p_rows` e `p_days_returned` nulos | recusa, recusa, recusa; os cinco zeros sem mexer em nada |
| apply: resposta vazia não mexe em nada | `p_rows: []`, `p_days_returned: []` | retorno com zeros; cobertura igual |
| invariante: nenhuma linha fora da cobertura, nenhum intervalo sobreposto ou vizinho | depois de todos os casos acima, **só nas linhas do site do teste** | as duas contagens = 0 |
| `kind`: todo valor de `COLLECTION_KINDS` é aceito; `'Ruim!'` e texto de 41 letras são recusados | `yt_own_attempt_record` e `insert` direto; a lista é **importada** de `coleta/kinds.ts` (a Tarefa 2 vem antes; emenda do portão: m-11) | conforme |
| permissões | `has_function_privilege` de `yt_own_daily_apply(text,jsonb,jsonb,date[],text[])`, `yt_own_retention_facts(uuid,date)` e `youtube_channel_removal_impact(uuid,uuid)` | só `service_role` executa as três |
| RLS: sessão sem vínculo com o site não lê cobertura nem retenção | cliente `anon` autenticado como usuário sem papel (padrão de `coleta-l2-migration.test.ts`) | 0 linhas, sem erro |
| **RLS: o GUC forjado não abre nada** (emenda do portão: m9; item 63) | pela conexão `pg`: `set local role authenticated`, `request.jwt.claims` de usuário sem vínculo, `set_config('app.site_id', <o site do teste>, true)` | 0 linhas nas duas tabelas. O teste diz por quê: as policies usam `can_edit_site` (ou `can_view_private_site`), que não confiam no GUC |
| **remoção: `serie_coletada` é a soma, pelo catálogo, do que está preso ao canal** (emenda do portão: m-7, I5, I-2) | insere linhas **só nas tabelas deste plano** (diário, cobertura, retenção, tentativas) para o canal do teste; a soma esperada é contada no teste percorrendo `pg_constraint` (toda FK `restrict` para `youtube_channels`), com `count(*) … where channel_id = <o canal>` | `serie_coletada` = essa soma, **qualquer que seja o número de tabelas presas ao canal no dia** (as quatro `yt_own_public_*` do lote B, as da E11 e da E18 entram sozinhas, sem editar o teste); `youtube_channel_remove` com o `slug` certo devolve `serie_coletada` e não apaga nada |
| **o corpo da função de impacto é o único** (R1) | `select md5(prosrc) …` | `4827d5ad12a0120b52ebc1280491b00c` |
| retenção: checks, **um de cada vez com o resto da linha válido** | `point_count 0`; `points` de tamanho diferente; `window_kind` inventado; `requested_end < window_end`; `window_end < window_start`; `points` objeto; `metrics_returned` vazio; `metric_version` vazia (os dois últimos: emenda do portão: m10) | os oito recusados; a linha boa é aceita |
| fatos: tabelas vazias | canal com 2 vídeos, nada coletado | 2 itens, `fonte_ate`, `views_total`, `vida_window_end`, `leva_ancora_dia`, `diario_tent_dia` e tentativas nulos; `tem_7d false`; `diario_falhas_4d 0` |
| fatos: canal que não existe; **canal nulo** (R9) | uuid qualquer; `null` | `[]` nos dois |
| fatos: vídeo só com linhas do coletor antigo (sem cobertura) | linhas até hoje − 3, cobertura vazia | `fonte_ate` = hoje − 3, `views_total` = soma |
| fatos: vídeo coberto sem nenhuma view | cobertura de 2 dias, sem linha | `views_total = 0` (não nulo), `ultimo_dia_com_view` nulo |
| fatos: última tentativa × última resposta × primeira tentativa | `ok` em D − 10, `nao_alcancado_orcamento` em D − 3 | `vida_tent_dia` = D − 3, `vida_tent_resultado` = `nao_alcancado_orcamento`, `vida_resposta_dia` = D − 10, `primeira_tent_dia` = D − 10 |
| **fatos: âncora da leva** (emenda do portão: I3) | sem tentativa de canal; depois tentativas de escopo `canal`, kind `retencao_vida`, em D − 9 (`nao_alcancado_orcamento`) e D − 7 (`ok`); mais uma de **outro canal** em D − 30 e uma de kind `diario` em D − 30 | nulo; depois D − 9 em **todo** item do canal (a mais antiga, com qualquer resultado; as outras duas não entram) |
| **fatos: o diário do vídeo nos 4 últimos dias** (emenda do portão: I4; emenda 2 do portão: N1) | A: `sem_dado_na_janela`, `erro_http` com `http_status 404` e `error 'http_404'`, `sem_dado_na_janela`, `sem_dado_na_janela` em D − 3 a D; B: um `ok` e um `nao_alcancado_orcamento` no meio; C: só três dias de tentativa; D: nenhuma | `diario_falhas_4d` = 4, 2, 3, 0; em A, `diario_tent_resultado` = `sem_dado_na_janela`. Com `p_hoje_utc` = D + 1, A dá 3 (a janela anda). `p_hoje_utc` nulo = `current_date` |
| **fatos: falha NOSSA ou de cota, em quatro dias seguidos, não conta como "o YouTube não devolve o vídeo"** (emenda 2 do portão: N1) | um vídeo por caso, quatro dias seguidos (D − 3 a D) de `erro_http` com: `error 'erro_de_banco'` sem status; `forma_inesperada` com status 200 e outro sem status; `excecao` sem status; `http_500` (500); `http_429` (429); `http_403_quotaExceeded`, `http_403_rateLimitExceeded`, `http_403_userRateLimitExceeded` (403); os formatos antigos `HTTP 403 quotaExceeded` e `HTTP 403 dailyLimitExceeded` (403) | `diario_falhas_4d` = **0** em todos; `diario_tent_resultado` = `erro_http` (continuam sendo a última tentativa) |
| **fatos: quatro dias de "o YouTube não devolveu" contam** (emenda 2 do portão: N1) | quatro dias seguidos de `erro_http` 404 com `http_404`, com `http_404_notFound`, com o formato antigo `HTTP 404 notFound` e com `error` nulo; 410; 403 `http_403_forbidden`; e de `sem_dado_na_janela` | **4** em cada |
| **fatos: dois motivos misturados** (emenda 2 do portão: N1) | dois `sem_dado_na_janela` e dois `erro_de_banco`; três 404 e o 4º dia `erro_de_banco` | 2 e 3 (a falha nossa quebra a sequência) |
| (os mesmos casos, em TypeScript, estão em `youtubeNaoDevolveu`, Tarefa 2b: um comentário nos dois testes aponta o outro) | | |
| fatos: dia de publicação no Pacífico | `published_at` 02:00 UTC | `publicado_dia_pt` = o dia anterior; igual a `dayPt()` do código |

**Pronto quando:** o teste passa duas vezes seguidas contra o `bythiago_int`; `npx tsc --noEmit` do web passa com os tipos novos; os dois arquivos de ensaio são byte a byte os apêndices (diff vazio).

### Tarefa 1b: os dois arquivos de migration, **só na vez do lote C** (emenda do portão: I-3, R2)

**Quando.** Depois do acordo dos dois especialistas (decisão 45) **e** com os arquivos do lote B (MG10, MG9, MG8) já criados e aplicados em produção. Antes disso esta tarefa **não roda**: um arquivo em `supabase/migrations/` entra no próximo `npm run db:push:prod` do dono, de qualquer lote.
**Passos.** O controlador chama, na ordem do lote C (seção 3): `npm run db:new observatorio_a5_e6_dieta_cobertura`; (a MG11, do plano dela); `npm run db:new observatorio_a5_e8_retencao`. O agente cola o apêndice A no primeiro e o apêndice B no segundo, trocando `<MG14>` no cabeçalho pelo nome do primeiro arquivo.
**Pronto quando:** `diff` de cada arquivo contra o de ensaio da Tarefa 1a é vazio (fora o nome no cabeçalho da MG5); `md5` do bloco entre as marcas `corpo único` confere com o do desvio 4; o `migration up` do controlador no `bythiago_int` roda sem erro e o teste da Tarefa 1a continua verde; o commit vai por caminho explícito, com os dois arquivos e mais nada.

### Tarefa 2: catálogo de `kind`, interruptor, relógio e motivos

**Roda primeiro e sozinha; é commitada antes de qualquer outra tarefa deste plano e antes de a E11 começar a Tarefa 6 dela** (emenda do portão: I-9). É a dona de `kinds.ts`, `passos-desligados.ts`, da chave nova de `clock.ts` e de `motivo.ts`.
**Contrato.**
- `coleta/kinds.ts`: `COLLECTION_KINDS = ['sondagem','meta','thumbnail','relatorio','diario','retencao_vida','retencao_7d','retencao_30d','dimensoes','normalizador_trafego','normalizador_alcance_dim'] as const`; `type AttemptKind = (typeof COLLECTION_KINDS)[number]`; `KIND_RE = /^[a-z0-9_]{1,40}$/`; `ehKind(x: unknown): x is AttemptKind`.
- `coleta/types.ts`: `AttemptKind` passa a ser reexportado de `kinds.ts` (some a união escrita). Reexporta também `COLLECTION_KINDS` (o plano da E11 importa de lá).
- `coleta/attempts.ts`: `registrarTentativa` com `kind` fora do catálogo **não chama o banco** e registra a falha `tentativa com kind fora do catálogo: <kind, até 40 caracteres>`.
- `test/youtube/coleta/fake-supabase.ts` (emenda 3 do portão: T2): a lista `KINDS` do manipulador de `yt_own_attempt_record` (linha 230) deixa de ser escrita à mão e passa a ser `COLLECTION_KINDS`, importada de `@/lib/youtube/coleta/kinds`. Hoje ela tem só os seis valores antigos e o falso devolve `23514` para `retencao_7d`, `retencao_30d`, `dimensoes` e os dois normalizadores (rodado no fecho da emenda 2): sem esta troca, os testes da Tarefa 9 e os da E11 que gravam tentativa no falso ficam vermelhos, ou alguém edita o falso junto com a Tarefa 3. **É a única edição desta tarefa no falso**: nenhum manipulador novo, nenhuma outra lista (`SCOPES`, `OUTCOMES_OK` ficam como estão). Teste em `fake-supabase.test.ts`: todo valor de `COLLECTION_KINDS` é aceito pelo manipulador, e `'Ruim!'` devolve `23514`.
- `coleta/passos-desligados.ts`, **com o contrato do plano da E11** (linhas 509 a 511 de lá): `type PassoComInterruptor = 'retencao' | 'dimensoes' | 'versoes' | 'normalizadores'`; `PASSOS_COM_INTERRUPTOR` (a lista, `as const`); `passoDesligado(nome: PassoComInterruptor, env: NodeJS.ProcessEnv = process.env): boolean`; `nomesDesconhecidos(env?): string[]`; e **uma função a mais** (emenda do portão: I-9): `notaNomesDesconhecidos(env?): string | null`, que devolve `YT_OWN_STEPS_OFF tem nome desconhecido: <nomes separados por vírgula>` ou `null`. Toda integração usa essa função com `pushUnico`: o texto é um só e a nota nunca se repete. Lê `YT_OWN_STEPS_OFF`: nomes separados por vírgula, espaços tolerados, sem diferenciar maiúsculas. Variável ausente ou vazia: nada desligado. Nome desconhecido não desliga nada e volta em `nomesDesconhecidos`.
- `coleta/clock.ts`: `export const TETOS_DE_FIM_MS = { retencao: 20_000, dimensoes: 30_000, normalizadores: 20_000 } as const`, com o comentário "não entram na soma de `TETOS_MS`: `relogio.prazo` os corta no fim do relógio". As duas chaves da E11 nascem aqui, com os valores do plano dela, para ela não abrir o arquivo (emenda do portão: I-9). **`TETOS_MS` não muda.** Também **só nesta tarefa** (emenda 2 do portão: controlador c): `export const LIMITE_DA_FUNCAO_MS = 296_000` (a função morre aos 300 s; 4 s para a resposta da rota) e `export function prazoDoCriterio(relogio: Relogio, proprioMs: number): number`, que devolve `Math.min(Date.now() + proprioMs, relogio.inicio + LIMITE_DA_FUNCAO_MS)`. É o prazo dos critérios que rodam **depois** dos 270 s (cobertura, retenção, desligados): ao contrário de `relogio.prazo`, não é cortado nos 270 s, e sim nos 296 s. Prazo que já passou: o critério não consulta e dá a nota vermelha de sem tempo. **O texto é um por critério, fixo, e é o mesmo quando o prazo vence no meio de uma leitura** (emenda 3 do portão: menor 2): `critérios: não foi possível avaliar cobertura de <canal> (sem tempo)` (Tarefa 4), `critérios: não foi possível avaliar retenção de <canal> (sem tempo)` (Tarefa 10) e `critérios: não foi possível avaliar há quanto tempo o passo <passo> está desligado (sem tempo)` (Tarefa 2c). Uma nota por canal avaliado (os canais chegam no `ctx`, como em `criteriosL2`: o critério sem tempo não lê nada para saber o nome) ou por passo desligado. A nota de leitura que **falha** continua sendo a outra, que termina no nome da tabela. Os critérios que já existem não usam o auxiliar (seção 5).
- `coleta/day-pt.ts` (emenda do portão: m-5): `export type DiaPt = string` ("dia do Pacífico, `AAAA-MM-DD`"). Nenhum arquivo de `coleta/` importa de `observatorio/`: nos contratos de `coleta/` deste plano o tipo de dia é `DiaPt`, não o `DiaYt` de `observatorio/proprio/tipos.ts` (os dois são `string`).
- `coleta/motivo.ts` (emenda do portão: R3), o catálogo fechado do que vai para a coluna `error` das tentativas:
  ```ts
  export const REASONS_CONHECIDOS = ['quotaExceeded', 'rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded', 'forbidden', 'insufficientPermissions', 'badRequest', 'invalid', 'notFound', 'backendError', 'internalError'] as const
  export const MOTIVOS_FIXOS = ['erro_de_banco', 'forma_inesperada', 'corpo_invalido', 'retorno_inesperado', 'excecao'] as const
  export type Motivo = string   // sempre um valor que passa em ehMotivo
  export function ehMotivo(x: string): boolean        // um dos fixos, ou /^http_[1-5]\d\d$/, ou `http_<status>_<reason de REASONS_CONHECIDOS>`
  export function motivoDoErro(e: unknown): Motivo    // AnalyticsApiError: 'forma_inesperada' e 'corpo_invalido' viram o próprio código;
                                                      //   senão `http_<status>`, com `_<reason>` só se o reason está em REASONS_CONHECIDOS;
                                                      //   erro de banco (o objeto que conferirBanco recusa) → 'erro_de_banco'; qualquer outra coisa → 'excecao'
  export function textoDoMotivo(m: string): string    // português, para a nota que o dono lê; código desconhecido → 'erro não classificado'
  ```
  Textos: `http_403_quotaExceeded` → "o YouTube recusou por cota (403)"; `http_500` → "erro do YouTube (500)"; `forma_inesperada` → "a resposta veio em forma inesperada"; `erro_de_banco` → "erro de banco"; `excecao` → "erro interno (detalhe no Sentry)". O `reason` do Google que **não** está na lista não é gravado (vira só `http_<status>`): é texto vindo de fora. **Exceção: o `reason` fora da lista que casa `/(quota|limit)exceeded/i` é gravado como `http_<status>_quotaExceeded`** (a regra do fim do alarme, Tarefa 2b e apêndice B, lê esse sufixo; sem ele um 403 de cota desconhecido contaria como vídeo apagado) (emenda 3 do portão: dados 1). O texto de fora continua não passando: grava-se o sufixo fixo, não o `reason`.

**Testes.**

| Arquivo | Nome | Esperado |
|---|---|---|
| `kinds.test.ts` | todo valor do catálogo casa com `KIND_RE` e não se repete | (o nome diz) |
| | os seis valores antigos continuam no catálogo | (o nome diz) |
| | `registrarTentativa` com `kind` forjado não chama a `rpc` e deixa a falha | `rpcCalls` vazio |
| `passos-desligados.test.ts` | variável **apagada** (`delete process.env.YT_OWN_STEPS_OFF`): nada desligado | os quatro nomes falsos; sem desconhecidos; `notaNomesDesconhecidos()` nulo |
| | `'retencao'` | `passoDesligado('retencao')` verdadeiro; os outros, falsos |
| | `' Retencao , versoes '` | os dois |
| | `'retençao'` (erro de digitação) | nada desligado; `nomesDesconhecidos` = `['retençao']`; a nota com o texto exato |
| | `''` | nada |
| `clock.test.ts` | `TETOS_MS` igual ao de hoje e a soma mais 30 s não passa de 270 s; `TETOS_DE_FIM_MS` = as três chaves com 20.000, 30.000 e 20.000 | (o nome diz) |
| | `prazoDoCriterio(relogio, 3_000)` com 250 s decorridos / com 294 s / com 297 s (relógio falso) (emenda 2 do portão: controlador c) | 3 s à frente / 2 s à frente (corta nos 296 s) / um instante já passado (`restante` = 0) |
| | `prazoDoCriterio(relogio, 3_000)` com 269 s decorridos | o prazo vai até 272 s: passa dos 270 s, ao contrário de `relogio.prazo` |
| `motivo.test.ts` | `AnalyticsApiError(403, 'quotaExceeded')` | `http_403_quotaExceeded` |
| | `AnalyticsApiError(400, '<texto qualquer vindo do Google>')` | `http_400` (o texto não passa) |
| | `AnalyticsApiError(403, 'limitExceeded')` e `(403, 'concurrentLimitExceeded')` (emenda 3 do portão: dados 1) | `http_403_quotaExceeded`; passa em `ehMotivo`; `youtubeNaoDevolveu` (Tarefa 2b) dá falso para uma tentativa `erro_http` 403 com esse `error` |
| | `AnalyticsApiError(200, 'forma_inesperada')` | `forma_inesperada` |
| | `new Error('duplicate key value violates … (dado de terceiro)')` | `excecao`; a mensagem não aparece em lugar nenhum da saída |
| | todo valor que `motivoDoErro` devolve passa em `ehMotivo`, e `textoDoMotivo` nunca devolve o código cru nem texto vazio | propriedade, sobre uma lista de entradas |
| | `textoDoMotivo('qualquer coisa')` | "erro não classificado" |
| `fake-supabase.test.ts` (emenda 3 do portão: T2) | todo valor de `COLLECTION_KINDS` é aceito por `rpc('yt_own_attempt_record')` no falso | nenhum devolve erro (hoje `retencao_7d`, `retencao_30d` e `dimensoes` devolvem `23514`) |
| | `p_kind: 'Ruim!'` | `23514` |

**Armadilha.** `criterioOrcamento` e outros recebem `readonly AttemptKind[]`: o tipo fica mais largo, nada deixa de compilar. Conferir com `tsc`.
**Pronto quando:** os quatro arquivos de teste desta tarefa e `fake-supabase.test.ts` passam (emenda 3 do portão: T2), `npx vitest run test/youtube/coleta` inteiro continua verde, e o commit está feito (as outras tarefas partem dele).

### Tarefa 2b: a regra pura do fim do alarme (emenda do portão: I4, m-3)

**Objetivo.** Uma regra só para "vídeo atrasado deixa de ser vermelho e vira ação do dono", usada pelo passo do diário (Tarefa 3), pelo critério de cobertura (Tarefa 4) e pelo passo da retenção (Tarefas 8 e 9).
**Contrato** (`coleta/atraso-permanente.ts`, sem banco e sem rede):
```ts
export const ATRASO = { diasDeVermelho: 3, diasDeTentativa: 4 } as const
export interface Atrasado { ytId: string; diasAtrasado: number; falhasDoDiario4d: number | null }
//   diasAtrasado: 0 no primeiro dia em que o vídeo passou do limite de atraso de quem chama; cresce 1 por dia.
//   falhasDoDiario4d: em quantos dos 4 últimos dias UTC a tentativa `diario` do vídeo terminou com o YouTube NÃO devolvendo o vídeo (`youtubeNaoDevolveu`, abaixo; falha nossa não conta). null = não foi lido.
export interface TentativaDoDiario { outcome: string; http_status: number | null; error: string | null }
export function youtubeNaoDevolveu(t: TentativaDoDiario): boolean
//   (emenda 2 do portão: N1) A MESMA regra de `diario_falhas_4d` no apêndice B. Verdadeiro quando
//   outcome === 'sem_dado_na_janela', OU outcome === 'erro_http' E http_status é 403, 404 ou 410 E (error ?? '') NÃO casa /(quota|Limit)Exceeded/.
//   Falso para: erro_de_banco, forma_inesperada, excecao, erro sem status, 400, 429, 5xx, 403 de cota, ok, nao_alcancado_orcamento, sem_autorizacao, schema_ausente.
export function separarPermanentes<T extends Atrasado>(atrasados: readonly T[], elegiveis: number): { vermelho: T[]; acaoDoDono: T[]; pane: boolean }
```
**A regra.** Um atrasado é candidato a "ação do dono" quando `diasAtrasado >= 3` (já ficou vermelho 3 dias) **e** `falhasDoDiario4d === 4` (o diário tentou de verdade 4 dias seguidos e o YouTube não devolveu o vídeo, isto é, `youtubeNaoDevolveu`: `sem_dado_na_janela`, ou `erro_http` 403, 404 ou 410 que não seja de cota; uma tentativa `nao_alcancado_orcamento`, `schema_ausente`, `sem_autorizacao`, `erro_de_banco`, `forma_inesperada`, `excecao`, 500, 429, de cota, ou um dia sem tentativa quebram a sequência, porque aí a falha é nossa ou de cota) (emenda 2 do portão: N1). `elegiveis` = quantos vídeos do canal estão em idade de ter diário. Se os candidatos são **metade ou mais** de `elegiveis` (ou `elegiveis <= 0`), é pane: `pane: true`, **todos ficam em `vermelho`**. `falhasDoDiario4d` nulo nunca vira ação do dono.
**Testes:**

| Nome | Esperado |
|---|---|
| sobe (fica vermelho): atrasado há 2 dias, 4 falhas | `vermelho` |
| sobe: atrasado há 3 dias, só 3 falhas (um dia sem tentativa, ou de orçamento) | `vermelho` |
| sobe: atrasado há 9 dias e `falhasDoDiario4d` nulo (não lido) | `vermelho` |
| não sobe: atrasado há 3 dias, 4 falhas, 1 de 35 | `acaoDoDono` |
| pane: 18 candidatos de 35 | todos em `vermelho`, `pane: true` |
| não é pane: 17 de 35 | os 17 em `acaoDoDono` |
| canal de 1 vídeo com o vídeo candidato | `vermelho`, `pane: true` (1 de 1 é metade ou mais) |
| **`youtubeNaoDevolveu`: sim** (emenda 2 do portão: N1) | `sem_dado_na_janela`; `erro_http` 404 com `http_404`, com `http_404_notFound`, com `HTTP 404 notFound` e com `error` nulo; 410; 403 `http_403_forbidden` | verdadeiro |
| **`youtubeNaoDevolveu`: não (falha nossa ou de cota)** (emenda 2 do portão: N1) | `erro_http` sem status com `erro_de_banco`; `forma_inesperada` com status 200 e sem status; `excecao`; 500; 429; 400; 403 com `http_403_quotaExceeded`, `http_403_rateLimitExceeded`, `http_403_userRateLimitExceeded`, `HTTP 403 dailyLimitExceeded`; `ok`; `nao_alcancado_orcamento`; `sem_autorizacao`; `schema_ausente` | falso em todos. Os casos são os mesmos do teste de fatos da Tarefa 1a (SQL): um comentário nos dois apontam um para o outro |
| lista vazia | três listas vazias, `pane: false` |
| `elegiveis` 0 com candidato | `vermelho` (nunca ação do dono sem saber o tamanho do canal) |

**Pronto quando:** os testes passam.

### Tarefa 2c: critério do passo desligado (emenda do portão: I-7)

**Contrato** (`coleta/criteria-desligados.ts`): `criterioDesligados(ctx: { supabase; falhas: string[]; relogio: Relogio }, desligados: readonly PassoComInterruptor[]): Promise<string[]>` (emenda 3 do portão: menor 1). `desligados` = os passos que **esta** execução deixou de rodar por `YT_OWN_STEPS_OFF`. Lista vazia: não lê nada, devolve `[]`. Senão lê as **8** execuções mais recentes de `yt_own_collection_runs` (`select ran_at, resumo … order by ran_at desc limit 8`, com `conferirBanco`) e, para cada passo, conta quantas execuções **seguidas, a partir da mais recente,** têm `resumo.<passo>.desligado === true`; com a de hoje são `N = seguidas + 1`. `N <= 7`: a nota `<passo>: passo desligado por YT_OWN_STEPS_OFF (há N execuções)` volta na lista devolvida, que a integração põe em `acao_do_dono`. `N >= 8`: `pushUnico(falhas, '<passo>: passo desligado há N execuções ou mais por YT_OWN_STEPS_OFF; religue (tire o nome da variável na Vercel e faça um deploy) ou tire o passo por commit')`. Leitura que falha: `critérios: não foi possível avaliar há quanto tempo o passo <passo> está desligado (yt_own_collection_runs)` em `falhas`. Constante `EXECUCOES_ATE_O_VERMELHO = 7`. Prazo total de 1 s (`comPrazo(…, prazoDoCriterio(ctx.relogio, 1_000))`, seções 5 e Tarefa 2; o `ctx` ganha `relogio`) (emenda 2 do portão: controlador c); vencido (antes de ler ou no meio da leitura), `critérios: não foi possível avaliar há quanto tempo o passo <passo> está desligado (sem tempo)` em `falhas`, uma por passo desligado (emenda 3 do portão: menor 2). A chave do resumo é o nome do passo (`retencao`, `dimensoes`, `normalizadores`, `versoes`).
**Testes** (`fake-supabase`):

| Nome | Esperado |
|---|---|
| nenhum passo desligado: não lê a tabela | nenhuma consulta |
| não sobe: 6 execuções anteriores desligadas (a de hoje é a 7ª) | nota na lista devolvida; `falhas` vazio |
| sobe: 7 anteriores desligadas (hoje é a 8ª) | nota em `falhas` |
| não sobe: 7 anteriores, mas a 3ª mais recente rodou o passo | a sequência é 2; hoje é a 3ª |
| não sobe: tabela de execuções vazia (primeiro dia) | nota de 1ª execução na lista devolvida |
| execução antiga sem a chave do passo (de antes do envio) | conta como "não desligado" |
| leitura falha | "não foi possível avaliar", em `falhas` |
| tabela ausente | `schema_ausente: yt_own_collection_runs` |
| dois passos desligados, um há 8 e outro há 2 | um em `falhas`, outro na lista devolvida |
| **prazo já vencido** (relógio com 297 s) e um passo desligado (emenda 3 do portão: menor 1, menor 2) | não lê a tabela; `critérios: não foi possível avaliar há quanto tempo o passo retencao está desligado (sem tempo)` em `falhas`; lista devolvida vazia |

**Pronto quando:** os testes passam.

### Tarefa 3: o diário grava pela função (D11, D12)

**Objetivo.** O passo `diario` deixa de fazer `upsert` e de ler o último dia no diário: lê a cobertura uma vez por canal e grava cada vídeo por `yt_own_daily_apply`.
**São duas tarefas** (emenda do portão: I-9, pela regra de paralelismo por arquivo): a **3a** entrega `coleta/cobertura.ts` e `cobertura.test.ts` (o primeiro item do contrato abaixo e os testes "cobertura cortada" e os quatro de `inicioDaJanela`), sem depender de mais nada além da Tarefa 2; a **3** entrega o resto, em `diario-step.ts`. A Tarefa 4 importa da 3a.
**Contrato.**
- `coleta/cobertura.ts` (novo): `lerCoberturaBase(ctx, canal): Promise<'schema_ausente' | 'erro' | Map<string, { ate: DiaPt; coletadoEm: string; intervalos: number }>>`: `select youtube_video_id, covered_to, collected_at` de `yt_own_video_coverage` com `site_id = canal.site_id`, `channel_id = canal.id` e `metric_set = 'base'`, paginado de 1.000 em 1.000, até 5.000 linhas; passou disso é `'erro'` com a falha `diário: cobertura de <canal> cortada em 5000`. Por vídeo fica o **maior** `covered_to` e quantos intervalos ele tem (mais de um = há buraco; vai para o resumo, ver abaixo). `inicioDaJanela(o: { hoje: DiaPt; cobertoAte: DiaPt | null; publicadoEm: string }): DiaPt`: com cobertura, o menor entre `hoje − 10` e `cobertoAte`; sem cobertura, o dia da publicação no Pacífico; nunca depois de `hoje`.
- `diario-step.ts`: a fila continua "nunca coletado primeiro, depois o coletado há mais tempo", agora por `coletadoEm` da cobertura. Para cada vídeo com dias na resposta: `rpc('yt_own_daily_apply', { p_video, p_ids: { site_id, channel_id, video_id }, p_rows, p_days_returned, p_sets })`, onde `p_rows` = **todos** os dias devolvidos, cada um `{ day_pt, metric_version: metricVersion(day), ...valores }` (o que `diarioDoVideo` já entrega: chave ausente fica ausente, as médias nulas de dia sem view vão com a chave presente); `p_days_returned` = os mesmos dias.
- **Antes de chamar a função, o passo confere o que veio** (emenda do portão: I1, I-1): (a) se **algum** dia devolvido não tem `views` numérico (a chave falta: `numeroOuNada` de `analytics-diario.ts` tira a chave quando a célula é nula ou a coluna some do cabeçalho), a resposta é falha da chamada do vídeo: `AnalyticsApiError(200, 'forma_inesperada')`, **a função não é chamada**, nada é gravado, a cobertura não avança; (b) `p_sets` leva `'estendidas'` **só quando todo dia devolvido tem `engaged_views` numérico**; senão `p_sets = ['base']` e o vídeo conta em `resumo.estendidas_ausentes`, com a nota `diário: <canal>: estendidas ausentes na resposta de N vídeo(s)` em `falhas` (a mesma gravidade da nota existente de estendidas recusadas); (c) quando `estendidas === 'recusadas'`, `p_sets = ['base']`, como antes. A função do banco recusa as mesmas duas situações (apêndice A): a conferência no passo existe para a mensagem sair certa, não para substituir a do banco.
- **Motivo, não texto** (emenda do portão: R3): toda tentativa `erro_http` deste passo grava `error: motivoDoErro(e)` (Tarefa 2). A exceção que não é `AnalyticsApiError` continua indo ao Sentry com o id do vídeo, e na tentativa fica `excecao` (hoje o passo grava `describeCronCause(e)`, o texto da exceção). A nota do canal usa `textoDoMotivo`.
- **`http_status` em toda tentativa `erro_http` que veio de erro HTTP, e em nenhuma outra** (emenda 2 do portão: N1): o passo grava `http_status: e.status` quando o erro é `AnalyticsApiError` (inclusive `forma_inesperada`, que leva status 200), e **nenhum** status para erro de banco e para exceção (o HEAD já faz assim: `diario-step.ts:234` com status, e `:152`, `:216`, `:240` sem). A regra do fim do alarme (apêndice B e Tarefa 2b) lê esse campo: um status posto a mais num erro nosso apagaria o alarme.
- **Fake: manipulador padrão** (emenda 2 do portão: F-1). `test/youtube/coleta/fake-supabase.ts` (parte do HEAD local, não de nenhuma cópia em outro terminal) importa `comDailyApply` de `fake-daily-apply.ts` (que importa de volta **só tipos**, `import type`, para não haver ciclo) e `fakeSupabase()` o instala por padrão: o falso devolve `PGRST202` para `rpc` sem manipulador (`fake-supabase.ts`, perto da linha 289), o que o passo trata como `schema_ausente` em `falhas`, e `tres-dias.test.ts`, `orcamento.test.ts` e `index.test.ts` rodam `rodarColeta` de verdade e afirmam `falhas` vazia. Teste que quer a função ausente usa `db.errors['rpc:yt_own_daily_apply']`, que tem precedência sobre o manipulador (é o caso do teste "função ausente para tudo" abaixo). `fake-supabase.test.ts` ganha: "o manipulador padrão de `yt_own_daily_apply` está instalado" e "`rpc` de nome desconhecido continua devolvendo `PGRST202`".
- **O erro de vídeo atrasado há muito tempo não entra na nota do passo** (emenda do portão: I4, m-3): se o vídeo que falhou (ou voltou sem dias) tem cobertura anterior a `hoje − 8`, ou não tem cobertura e foi publicado há 8 dias ou mais, ele **não** conta em "N de M vídeos com erro" e conta em `resumo.atrasados_antigos`. Quem decide se ele é vermelho ou ação do dono é o critério de cobertura (Tarefa 4), que sempre o enxerga (a condição daqui é mais estreita que a de "atrasado" de lá) e que, se não conseguir avaliar, fica vermelho. Sem isso, um vídeo apagado que o YouTube passasse a recusar deixaria a nota do passo vermelha para sempre, e o fim do alarme não existiria.
- `DiarioResumo` ganha `apagadas: number`, `intervalos: number`, `estendidas_ausentes: number`, `atrasados_antigos: number` e `com_buraco: number` (vídeos com mais de um intervalo `base`: emenda do portão: m1; é só informação no resumo, a conferência K8 lê); `gravados` = `inseridas + atualizadas − apagadas` (as linhas que ficaram).
- Resposta sem dias: como hoje (`video_novo` ou `sem_dado_na_janela`), **sem** chamar a função.
- `conferirBanco(res, 'yt_own_daily_apply', …)`: `schema_ausente` para todos os canais, como hoje com a tabela; outro erro é `erro de banco` do vídeo.
- O retorno da função é validado (objeto com cinco números); forma inesperada conta como erro do vídeo.

**Testes** (`cobertura.test.ts`; `diario-step.test.ts` reescrito onde afirmava `upsert`; `tres-dias.test.ts` ajustado; o arquivo novo `fake-daily-apply.ts` traz `comDailyApply(db)`, um manipulador em memória com a mesma regra de atividade, de recusa e de fusão; **a prova da regra é a Tarefa 1a, contra o banco**, não ele):

| Nome | Entrada | Esperado |
|---|---|---|
| vídeo sem view há dois anos pede só os últimos 10 dias (item 45) | cobertura até hoje − 3, nenhuma linha recente | a URL da chamada tem `startDate` = hoje − 10 |
| vídeo com a cobertura parada há 40 dias pede desde o último dia coberto | cobertura até hoje − 40 | `startDate` = hoje − 40 |
| vídeo nunca coletado pede desde a publicação | sem cobertura | `startDate` = dia da publicação no Pacífico |
| publicação no futuro não gera janela invertida | `published_at` amanhã | `startDate` = hoje |
| manda todos os dias devolvidos, zeros inclusive, e os mesmos dias em `p_days_returned` | 8 dias, 1 com view | `p_rows` com 8 itens; os dois conjuntos de dias iguais |
| estendidas recusadas: só o conjunto base | a API responde 400 e depois 200 | `p_sets` = `['base']`; nota de estendidas recusadas |
| **cabeçalho sem `views` não avança a cobertura** (emenda do portão: I1, I-1) | 200 com os dias e sem a coluna `views` | nenhuma `rpc` de gravação; tentativa `erro_http` com `error: 'forma_inesperada'`; nota "N de M vídeos com erro (a resposta veio em forma inesperada)" |
| **um dia com `views` nulo no meio de oito** | a célula de um dia é `null` | idem: nada é aplicado, nem os outros sete dias |
| **`engaged_views` ausente manda só a base** (I1) | 200 com `views` em todos os dias e `engaged_views` faltando num deles | `p_sets` = `['base']`; `estendidas_ausentes: 1`; a nota em `falhas` |
| **`engaged_views` em todos os dias manda os dois conjuntos** | (o nome diz) | `p_sets` = `['base','estendidas']`; sem nota |
| **a coluna `error` recebe código, nunca o texto** (emenda do portão: R3) | o `fetch` lança `new Error('texto com dado de terceiro')` | tentativa com `error: 'excecao'`; o texto só no Sentry; `ehMotivo` verdadeiro em toda tentativa do teste |
| **erro em vídeo atrasado há mais de 8 dias não entra na nota do passo** (emenda do portão: I4) | dois vídeos com 500: um coberto até hoje − 3, outro até hoje − 20 | nota "1 de 2 vídeos com erro"; `atrasados_antigos: 1`; as duas tentativas são `erro_http` |
| **erro em vídeo atrasado há 8 dias exatos ainda entra** | coberto até hoje − 8 | conta na nota (o limite é "anterior a hoje − 8") |
| resposta sem dias não chama a função | `rows` vazio | nenhuma `rpc` de gravação; tentativa `sem_dado_na_janela` (ou `video_novo` com menos de 3 dias) |
| função ausente para tudo | `rpc` devolve `PGRST202` | `schema_ausente` por canal; nenhuma chamada à API depois disso; **nenhum `upsert`** |
| erro da função num vídeo não para os outros | um vídeo com erro `P0001` | `1 de N vídeos com erro (erro de banco)`; os demais `ok` |
| cobertura cortada | 5.001 intervalos | falha "cortada em 5000"; o canal não é coletado |
| nunca coletado vai primeiro; depois o coletado há mais tempo | três vídeos | ordem das chamadas |
| sem tempo no meio | relógio falso | `nao_alcancado_orcamento` e `pendentes`; nenhuma gravação parcial do vídeo em curso |
| o resumo soma `apagadas` e `intervalos` | dois vídeos | somas |
| nenhuma leitura de `yt_own_video_daily` no passo | varredura das tabelas tocadas no fake | só `youtube_videos`, `yt_own_video_coverage`, as `rpc` |
| **`http_status` e `error` da tentativa** (emenda 2 do portão: N1) | 404 da API; 500; exceção qualquer do `fetch`; erro da `rpc` | 404 com `http_404…`; 500 com `http_500`; **status nulo** com `excecao`; **status nulo** com `erro_de_banco` |
| **o falso padrão deixa `index.test.ts`, `tres-dias.test.ts` e `orcamento.test.ts` verdes sem edição** (emenda 2 do portão: F-1) | (rodar os três) | verdes; se algum quebrar por outro motivo, ele entra na lista desta tarefa |

**Armadilhas.** O `p_rows` não pode passar por um filtro de "tem atividade" no código: se passar, a função recusa (dias divergentes) e isso é o comportamento desejado. O fake não é a prova da regra: a prova da função é a Tarefa 1a, e **a prova do passo contra o banco de verdade é a Tarefa 3b** (emenda do portão: I-6). O fake recusa as mesmas chamadas que a função recusa (dia sem `views` com `base`; sem `engaged_views` com `estendidas`; sem `metric_version`), para um teste de unidade não passar com uma chamada que o banco recusaria.
**Pronto quando:** `npx vitest run test/youtube/coleta test/cron test/api/cron test/lib/conferencias.test.ts` verde (emenda 2 do portão: F-1) (`test/cron/sync-analytics-metrics.test.ts` e `test/api/cron/sync-analytics-metrics.test.ts` trocam `rodarColeta` inteira e não devem mudar; entram no comando para provar); `grep -n "from('yt_own_video_daily')" apps/web/src/lib/youtube/coleta` não devolve nada; o cabeçalho do arquivo descreve a regra nova (desvio 21).

### Tarefa 4: critério de cobertura (o alarme da dieta)

**Contrato.** `coleta/criteria-cobertura.ts`:
- função pura `atrasadosDaCobertura(videos: Array<{ ytId: string; publicadoEm: string }>, cobertura: Map<string, DiaPt>, hoje: DiaPt): { elegiveis: number; atrasados: Array<{ ytId: string; ate: DiaPt | null; diasAtrasado: number }> }`. Elegível = publicado há 5 dias ou mais. Atrasado = elegível **e** sem cobertura ou com `ate < hoje − 5`. `diasAtrasado` = `(hoje − 6) − ate` com cobertura (0 no primeiro dia de atraso), ou `idade − 5` sem cobertura.
- `criterioCobertura(ctx): Promise<{ acaoDoDono: string[] }>`: para cada canal com `sync_enabled` e `collection_status = 'ok'`, lê os vídeos (até 1.000; passou, "não foi possível avaliar") e a cobertura (`lerCoberturaBase`, da Tarefa 3a). Sem atrasado: nada mais é lido.
- **Fim do alarme** (emenda do portão: I4, m-3). Havendo atrasado com `diasAtrasado >= 3`, lê as tentativas `diario` desses vídeos nos 4 últimos dias UTC (`yt_own_collection_attempts`: `site_id`, `scope_type = 'video'`, `kind = 'diario'`, `scope_id in (…)`, `attempt_day >= hojeUtc − 3` **e** `attempt_day <= hojeUtc` (a mesma janela do apêndice B: o dia da tentativa é o relógio do banco, e sem o teto uma execução que cruza a meia-noite UTC traria 5 dias; emenda 3 do portão: dados 2); colunas `scope_id, attempt_day, outcome, http_status, error`; até 1.000 linhas, passou é "não foi possível avaliar"), conta por vídeo os dias em que `youtubeNaoDevolveu` (Tarefa 2b) é verdadeiro: `sem_dado_na_janela`, ou `erro_http` com status 403, 404 ou 410 que não seja de cota. **Erro de banco, `forma_inesperada`, exceção, 500, 429 e cota NÃO contam** (emenda 2 do portão: N1) (o dia vira "falha nossa" e quebra a sequência de 4), e chama `separarPermanentes(atrasados, elegiveis)` (Tarefa 2b). Se essa leitura falha, `falhasDoDiario4d` fica nulo e todos ficam vermelhos, com a nota "não foi possível avaliar".
  - Os de `vermelho`: `pushUnico(falhas, 'diário: <canal>: N de M vídeos sem cobertura até dd/mm (<até 5 ids, cada um com "coberto até dd/mm" ou "nunca coberto">[, e mais K])')`. Com `pane: true` a nota termina em "; metade ou mais do canal: é pane da coleta, não dos vídeos". O id vai na nota desde o primeiro dia: são os 3 e-mails em que o dono fica sabendo qual é o vídeo.
  - Os de `acaoDoDono` (voltam na lista devolvida; a integração põe em `resumo.acao_do_dono`): `diário: <canal>: o YouTube não devolve mais o vídeo <id> (última situação conhecida: público | não listado | privado | desconhecida; coberto até dd/mm). Se foi apagado, tire-o da lista (runbook, seção 6)`. A situação vem de `yt_own_video_meta_daily.privacy_status` do dia mais recente do vídeo (uma leitura de uma linha por vídeo, **só para os 5 primeiros**; falha de leitura vira "desconhecida", nunca derruba o critério).
- Leitura que falha (vídeos ou cobertura): `critérios: não foi possível avaliar cobertura de <canal> (<tabela>)`, nunca "nada de errado". O critério inteiro tem **prazo total de 3 s** (`comPrazo(…, prazoDoCriterio(relogio, 3_000))`, seção 5 e Tarefa 2); vencido (antes de ler ou no meio), `critérios: não foi possível avaliar cobertura de <canal> (sem tempo)`, e nenhuma nota de atraso (emenda do portão: m-8; emenda 3 do portão: menor 2).

**Testes** (os dois sentidos e o vazio; `fake-supabase`):

| Nome | Entrada | Esperado |
|---|---|---|
| sobe: vídeo antigo sem cobertura | publicado há 30 dias, mapa vazio, sem tentativa lida | 1 atrasado, "nunca coberto", em `falhas` |
| sobe: cobertura parada | `ate` = hoje − 6 | 1 atrasado, `diasAtrasado 0`, com a data e o id |
| não sobe: cobertura em hoje − 5 | (o nome diz) | nenhum |
| não sobe: vídeo de 2 dias sem cobertura | (o nome diz) | nenhum; não conta em `elegiveis` |
| não sobe: canal desligado ou em `reautorizar` | (o nome diz) | nenhuma leitura, nenhuma nota |
| tabela vazia com vídeos antigos | cobertura sem linha, 35 vídeos | **todos** atrasados, vermelho, "pane" não é dito (não há candidato), e nenhum vira ação do dono |
| **3 dias de vermelho antes de virar ação do dono** (I4) | `ate` = hoje − 6, − 7, − 8, com 4 falhas do diário | vermelho nos três |
| **no 4º dia vira ação do dono e sai de `falhas`** | `ate` = hoje − 9, 4 falhas, 1 de 35 | `falhas` vazio; a nota na lista devolvida, com o id e "privado" |
| **não vira ação do dono se o diário não tentou de verdade** | `ate` = hoje − 20; tentativas: 3 `erro_http` e 1 `nao_alcancado_orcamento` | vermelho |
| **não vira ação do dono sem tentativa nenhuma** (o passo do diário não rodou) | `ate` = hoje − 20; nenhuma tentativa | vermelho |
| **metade do canal sem resposta é pane** | 18 de 35 com `ate` = hoje − 20 e 4 falhas | os 18 em `falhas`, com "é pane da coleta" |
| **N1: 4 dias de `erro_de_banco` NÃO viram "o YouTube não devolve mais o vídeo"** (emenda 2 do portão: N1) | `ate` = hoje − 20; 4 tentativas `erro_http` sem status e `error = 'erro_de_banco'`; 1 de 35 | vermelho, a nota traz o id; `acaoDoDono` vazio |
| **N1: o mesmo com `forma_inesperada`, `http_500` e `http_403_quotaExceeded`** | um vídeo por caso, 4 dias seguidos | vermelho nos três |
| **N1: 4 dias de 404 viram ação do dono** | `ate` = hoje − 20; 4 tentativas `erro_http` com status 404 e `http_404`; 1 de 35 | `falhas` vazio; a nota na lista devolvida com o id |
| **N1: 3 dias de 404 e o 4º de `erro_de_banco`** | `ate` = hoje − 20 | vermelho (a falha nossa quebra a sequência) |
| **janela com teto** (emenda 3 do portão: dados 2) | 4 dias de 404 mais uma tentativa 404 com `attempt_day` = hoje + 1 | ação do dono (conta 4, não 5); a consulta leva o teto `<= hojeUtc` |
| **a leitura das tentativas falha** | erro no fake | todos vermelhos e a nota "não foi possível avaliar"; nenhum em ação do dono |
| a situação do vídeo não pôde ser lida | erro na leitura de `yt_own_video_meta_daily` | a nota sai com "desconhecida" |
| canal sem vídeo | (o nome diz) | nenhuma nota |
| leitura da cobertura falha | erro no fake | "não foi possível avaliar", e nenhuma nota de atraso |
| tabela ausente | `42P01` | `schema_ausente: yt_own_video_coverage` |
| prazo de 3 s vencido | leitura que não volta | `critérios: não foi possível avaliar cobertura de <canal> (sem tempo)` (emenda 3 do portão: menor 2) |
| prazo já vencido na entrada (relógio com 297 s) | (o nome diz) | a mesma nota, **sem nenhuma leitura** |
| a nota diz quantos, de quantos, e até 5 ids | 7 de 10 | texto exato, com "e mais 2" |

**Pronto quando:** os testes passam e o texto das notas foi lido por alguém que não escreveu o código (é o que o dono lê no e-mail do cron).

### Tarefa 5: o leitor tolera os dois estados (D13)

**Só depois de a A4 estar fechada. Parte do HEAD local de `ler.ts`, que a A4 mexeu (7 commits ainda não enviados em 13/10: fato P11). Depois da dieta rodar em produção, este leitor não é revertido nunca (Tarefa 15; emenda do portão: I2).**
**Contrato.**
- `proprio/cobertura-leitor.ts` (novo, puro): `materializarZeros(linhas: readonly DiarioLinha[], intervalos: ReadonlyArray<{ ytId: string; de: DiaYt; ate: DiaYt }>, janela: { desde: DiaYt; ate: DiaYt }): DiarioLinha[]`. Devolve as linhas recebidas **mais** uma `{ ytId, dia, views: 0, pctAssistido: null, duracaoMediaSeg: null }` para cada dia de cada intervalo, dentro da janela, que não tenha linha daquele vídeo. Ordem do resultado: por `dia`, depois por `ytId` (a ordem que a consulta de hoje entrega). Linha existente nunca é trocada (a coluna nula numa linha continua "não medido"). Teto de sanidade: mais de 50 vídeos × 60 dias lança erro.
- `ler.ts`, `lerDiario`: (a) `ultimoDia` = o maior entre a última linha do canal (consulta de hoje) e o maior `covered_to` do canal no conjunto `base` (consulta nova, uma linha); (b) lê os intervalos `base` dos `ytIds` com `covered_to >= desde` (`readAll`, paginado); (c) passa por `materializarZeros` com a janela `[desde, ultimoDia]`. **Nada mais muda**: `DiarioCanal`, `DiarioLinha`, `descartados`, `TETO_VIDEOS_DIARIO`, a guarda `siteAutorizado`.
- Tabela de cobertura ausente (`42P01` ou `PGRST205`): o leitor segue sem cobertura e avisa o Sentry uma vez (`component: 'observatorio-proprio'`, `step: 'cobertura-ausente'`). Qualquer outro erro é lançado, como hoje.
- `tipos.ts`, `vpd.ts`, `dias.ts`, `assistido.ts`, `serie-video.ts` e os modelos de tela **não mudam**.

**Testes.**

| Arquivo | Nome | Esperado |
|---|---|---|
| `proprio-cobertura-leitor.test.ts` | dia coberto sem linha vira `views: 0` (item 44) | linha nova com os dois nulos |
| | dia fora da cobertura não vira linha (item 44) | nada |
| | linha existente com `views` nulo não é trocada por zero | fica nula |
| | intervalo maior que a janela é cortado nas duas pontas | só dias da janela |
| | dois intervalos do mesmo vídeo com buraco | o dia do buraco não aparece |
| | sem intervalos devolve as mesmas linhas, na mesma ordem | igualdade |
| | ordem: dia, depois vídeo | (o nome diz) |
| | teto de sanidade | lança |
| `proprio-ler.test.ts` (acréscimos) | banco **antes** da dieta (todas as linhas, cobertura igual) e **depois** (só linhas com atividade, mesma cobertura) devolvem exatamente as mesmas `DiarioLinha` | `toEqual` entre os dois |
| | canal parado: nenhuma linha na janela, cobertura até hoje − 3 | `ultimoDia` = hoje − 3; linhas de zero; (com o modelo da A4) não diz "coleta parada" |
| | cobertura atrasada e linhas mais novas (o intervalo entre M e D) | `ultimoDia` = a última linha |
| | tabela de cobertura ausente | mesmas linhas de hoje; Sentry avisado uma vez |
| | erro de banco na cobertura | lança `ObservatoryLoadError` |
| | sem prova de acesso | `negado`, **nenhuma** consulta, nem à cobertura |
| `proprio-ler-db.test.ts` (acréscimos, banco local) | 50 vídeos × 38 dias cobertos e só 60 linhas com atividade | 1.900 linhas devolvidas (prova a paginação dos intervalos e a materialização) |
| | cobertura de **outro site** com o mesmo id de vídeo não vaza | 0 linhas do outro |

**Armadilhas.** A janela do leitor termina em `ultimoDia`, não em hoje. O filtro por `site_id` **e** `channel_id` vale também para a cobertura. `proprio-varredura.test.ts` (que barra consulta fora dos leitores) tem de continuar verde.
**Pronto quando:** os testes passam; os testes de tela da A4 (`proprio-*.test.tsx`) passam sem nenhuma mudança neles.

### Tarefa 6: semente e2e e a prova de "mesmos números" (itens 43 e 247, parte de teste)

**Contrato.** `seedOwnL2` passa a gravar, para cada vídeo com diário, um intervalo `base` e um `estendidas` do primeiro ao último dia semeado; ganha a opção `dieta?: boolean` no preset: com ela, as linhas sem atividade **não** são inseridas (só a cobertura). `clearOwnL2` apaga também `yt_own_video_coverage`, **antes** dos canais (FK `restrict`); o apagamento de `yt_own_video_retention` é da Tarefa 13, que mexe na mesma semente (as duas, uma de cada vez, em qualquer ordem: emenda do portão: I-8). **Antes de editar a semente: `git status`; em 13/10 ela tem alteração sem commit de outro terminal (a A4), e enquanto tiver esta tarefa não começa** (emenda do portão: R7).
**Teste e2e** (`proprio-a5-dieta.spec.ts`): para os perfis `cheio`, `parado` e `retencao`, abre as três telas da A4 (lista de canais, canal próprio, vídeo) com `dieta: false` e com `dieta: true` e compara os números mostrados (views por dia do canal, "35" no perfil que o item 43 cita; % assistido; a série do vídeo). O perfil `parado` com `dieta: true` não mostra "coleta parada".
**Pronto quando:** o spec passa nos dois estados; `seed.spec.ts` continua verde; a semente limpa o que escreveu (rodar duas vezes seguidas).

### Tarefa 7: a chamada da retenção

**Contrato** (`coleta/analytics-retencao.ts`, no molde de `analytics-diario.ts`; o `fetch` vem de fora):
```ts
export const METRICAS_RETENCAO = ['audienceWatchRatio', 'relativeRetentionPerformance', 'totalSegmentImpressions'] as const
export const METRICAS_RETENCAO_BASICAS = ['audienceWatchRatio', 'relativeRetentionPerformance'] as const
export interface PontoRetencao { t: number; ratio: number; relative: number | null; segment_impressions: number | null }
export interface RespostaRetencao { pontos: PontoRetencao[]; metricas: string[]; chamadas: number }
export function retencaoDoVideo(i: { token: string; canalUc: string; videoId: string; inicio: string; fim: string; f: typeof fetch }): Promise<RespostaRetencao>
```
- URL: `ids=channel==<UC>`, `startDate`, `endDate`, `dimensions=elapsedVideoTimeRatio`, `filters=video==<id>;audienceType==ORGANIC`, `metrics=<lista>`. Sem `sort` (a chamada conferida na C0.1 não tinha).
- 400 na primeira: repete com as básicas. 500: repete a mesma uma vez; de novo 500, uma vez com as básicas. Qualquer outro não-ok, ou não-ok depois das repetições: `AnalyticsApiError(status, reason)` (a classe de `analytics-diario.ts`). No máximo 3 chamadas.
- Corpo ilegível: `AnalyticsApiError(status, 'corpo_invalido')`. `columnHeaders` ausente, sem `elapsedVideoTimeRatio` ou sem `audienceWatchRatio`, ou `rows` que não é lista: `AnalyticsApiError(200, 'forma_inesperada')`.
- `rows: []`: `pontos: []` (sem dado; **não** é erro).
- Cada linha, lida por nome de coluna: `t` e `ratio` finitos, `0 <= t <= 1`, `ratio >= 0`, senão `forma_inesperada`. `relative` e `segment_impressions`: número finito ou nulo (nunca 0 por ausência). `t` repetido: `forma_inesperada`. Saída ordenada por `t`. `ratio` não é cortado.
- `metricas` = as métricas presentes no cabeçalho da resposta que valeu.

**Testes** (`fetch` falso; fixtures copiadas de `.superpowers/sdd/a5/c0-fixtures/`: `c01-vida-so2.json` com 100 pontos e `c01-28d.json` vazia, mais as montadas no teste):

| Nome | Esperado |
|---|---|
| resposta real de 100 pontos | 100 pontos em ordem, primeiro `t 0.01`, último `t 1` |
| resposta real vazia (`rows: []`) | `pontos: []`, sem erro |
| 37 pontos | 37 |
| `ratio` 1,2 fica 1,2 | (o nome diz) |
| `relative` ausente num ponto fica nulo, não 0 | (o nome diz) |
| sem a coluna `totalSegmentImpressions` | `segment_impressions` nulo em todos; `metricas` sem ela |
| 400 e depois 200 (item 62) | 2 chamadas; a segunda só com as básicas; `metricas` = as duas |
| 500 e depois 200 | 2 chamadas iguais |
| 500, 500, 200 | a terceira com as básicas |
| 500 três vezes | lança `AnalyticsApiError(500, …)`; 3 chamadas, não 4 |
| 401 | lança com `status 401`, 1 chamada |
| sem `columnHeaders`; sem `rows`; `t` repetido; `ratio` não numérico; `t` 1,5 | `forma_inesperada` |
| a URL tem o filtro `audienceType==ORGANIC` e não pede `startedWatching` nem `stoppedWatching` | (o nome diz) |
| o erro nunca leva o corpo da resposta | a mensagem só tem o status |
| `fetch` que estoura o prazo do passo | propaga `SemTempoError` |

**Pronto quando:** os testes passam.

### Tarefa 8: a regra pura (quem é lido hoje)

**Contrato** (`coleta/retencao-regra.ts`, sem banco e sem rede):
```ts
export const RETENCAO = { vencimentoDias: 7, levaDias: 7, viewRecenteDias: 14, diarioAtrasadoDias: 7, videoNovoDias: 5, janelaDesisteDias: 45, margemDaFonteDias: 3 } as const
/** O dia (Pacífico) a partir do qual uma janela de 7 ou 30 dias que FECHA é lida (decisão 32: nada antes). Valor fixo: '2026-10-13'. */
export const RETENCAO_JANELAS_DESDE: DiaPt = '2026-10-13'
export type Janela = 'vida' | 'primeiros_7_dias' | 'primeiros_30_dias'
export interface FatoRetencao { /* os campos de yt_own_retention_facts, com os mesmos nomes */ }
export function lerFatos(x: unknown): FatoRetencao[]          // valida a forma; lança se vier diferente
export interface Leitura { ytId: string; videoId: string | null; siteId: string; janela: Janela; kind: 'retencao_vida' | 'retencao_7d' | 'retencao_30d'; inicio: DiaPt; fim: DiaPt; windowEnd: DiaPt; viewsAtRead: number | null; prioridade: 0 | 1 | 2 }
export interface Decisao { ler: Leitura[]; semDiarioEmDia: string[]; semRespostaDoYoutube: string[]; pane: boolean; novos: string[]; adiadosPelaLeva: number }
export function decidirRetencao(fatos: readonly FatoRetencao[], o: { hojePt: DiaPt; hojeUtc: string; janelasDesde?: DiaPt; vencimentoDias?: number; levaDias?: number }): Decisao
export function diaDaLeva(ytId: string): number               // sha256(ytId), 4 primeiros bytes, módulo 7
```
`FatoRetencao` tem os campos do apêndice B, inclusive os quatro da emenda: `leva_ancora_dia`, `diario_tent_dia`, `diario_tent_resultado`, `diario_falhas_4d`. `levaDias` tem padrão 7 (`RETENCAO.levaDias`) e existe para o ensaio da Tarefa 14 ler tudo numa execução (emenda do portão: I-5); um teste afirma que **sem a opção** o valor é 7.

**A regra, por vídeo:**
1. `fonte_ate` nulo ou anterior a `hojePt − 7`: se o vídeo tem menos de 5 dias, entra em `novos`; senão está **sem diário em dia** e nada é lido. Os sem diário em dia passam por `separarPermanentes` (Tarefa 2b), com `diasAtrasado` = `(hojePt − 8) − fonte_ate` (0 no primeiro dia), ou `idade − 5` quando `fonte_ate` é nulo, `falhasDoDiario4d` = `diario_falhas_4d` (que a função SQL já conta só com os dias em que o YouTube não devolveu o vídeo: emenda 2 do portão: N1), e `elegiveis` = vídeos do canal com 5 dias ou mais: os de `vermelho` vão para `semDiarioEmDia`; os de `acaoDoDono`, para `semRespostaDoYoutube`; `pane` é repassado (emenda do portão: I4, m-3).
2. `vida`, com `inicio` = `publicado_dia_pt`, `fim` = `hojePt`, `windowEnd` = o menor entre `hojePt` e `fonte_ate`, `viewsAtRead` = `views_total`:
   - (a) a última tentativa não teve resposta (`vida_tent_dia` depois de `vida_resposta_dia`, ou há tentativa e nenhuma resposta): **lê**, prioridade 0. **Com uma trava** (emenda do portão: m3): se já há linha (`vida_window_end` não nulo), só lê quando o `windowEnd` novo é posterior a `vida_window_end`; senão a leitura cairia na mesma chave e trocaria a curva da semana anterior, e o vídeo espera o diário andar;
   - (b) tem linha: lê (prioridade 1) se passaram `vencimentoDias` desde o mais recente entre o dia de `vida_collected_at` e `vida_resposta_dia`, **e** `views_total` é conhecido e maior que `vida_views_at_read` (ou `vida_views_at_read` é nulo), **e** o `windowEnd` novo é posterior a `vida_window_end` (senão a leitura regravaria a linha antiga em vez de criar a da semana);
   - (c) sem linha, com resposta vazia: lê (prioridade 1) se passaram `vencimentoDias` desde `vida_resposta_dia` **e** `ultimo_dia_com_view >= vida_resposta_dia − 3`;
   - (d) nunca tentado (nenhuma tentativa de `vida` e nenhuma linha): lê hoje (prioridade 0) se `ultimo_dia_com_view >= hojePt − 14`; senão, **se a primeira leva do canal já acabou** (`leva_ancora_dia` não nulo e `<= hojeUtc − levaDias`), lê hoje, prioridade 2 (emenda do portão: m-2: o vídeo que perdeu o seu dia não espera mais 7); senão lê (prioridade 2) quando `diaDaLeva(ytId)` é igual a (dias desde a época de `hojeUtc`) módulo `levaDias`; senão `adiadosPelaLeva++`;
   - (e) linha gravada e **nenhuma** tentativa registrada (a função do cron morreu entre o `upsert` e a tentativa; emenda do portão: m-1): vale a regra (b), com o dia de `vida_collected_at`.
3. `primeiros_7_dias` (fim = `publicado_dia_pt + 6`) e `primeiros_30_dias` (`+ 29`), cada uma: lê (prioridade 1) se o fim é `>= janelasDesde`, `fonte_ate >= fim`, ainda não há linha, `hojePt <= fim + 45`, e (nunca tentada, ou a última tentativa não teve resposta, ou passaram 7 dias desde a última resposta). `windowEnd` = `fim`; `viewsAtRead` = `views_7d` ou `views_30d`.
4. Ordem de saída: prioridade, depois `ytId`.

**Testes** (um por linha; `hojePt` e `hojeUtc` fixos por parâmetro, sem relógio):

| Nome | Esperado |
|---|---|
| lista vazia | decisão vazia |
| nunca tentado, com view há 3 dias | lê hoje, prioridade 0 |
| nunca tentado, sem view recente, no dia da sua leva | lê, prioridade 2 |
| idem, fora do dia da leva | não lê; `adiadosPelaLeva = 1` |
| em 7 dias seguidos, todo vídeo nunca tentado é lido exatamente uma vez | 35 ids, 7 chamadas da função |
| nunca tentado e com zero views na vida | entra na leva como os outros (a resposta vazia é que fecha o item 59) |
| com linha de 6 dias e views novas | não lê |
| com linha de 7 dias e views novas | lê |
| com linha de 7 dias e **sem** views novas (item 60) | **não** lê |
| com linha de 30 dias, sem views novas | não lê |
| com linha e `views_total` desconhecido | não lê |
| com linha cujo `views_at_read` é nulo | lê aos 7 dias |
| com linha de 7 dias, views novas, mas a fonte não andou desde a última leitura (`windowEnd` igual) | não lê (não sobrescreve o histórico) |
| resposta vazia há 7 dias, view depois dela | lê |
| resposta vazia há 7 dias, nenhuma view depois | não lê |
| última tentativa sem resposta (ontem, `erro_http`) | lê hoje, prioridade 0 |
| **última tentativa sem resposta, com linha, e a fonte não andou** (emenda do portão: m3) | não lê (não troca a curva da semana anterior) |
| **idem, a fonte andou um dia** | lê, prioridade 0 |
| **linha gravada sem nenhuma tentativa** (m-1) | segue a regra (b): não lê antes de 7 dias; lê aos 7 com views novas |
| **nunca tentado, fora do seu dia, com a leva do canal acabada** (âncora há 7 dias; emenda do portão: m-2) | lê hoje, prioridade 2 |
| **idem, âncora há 6 dias** | não lê; `adiadosPelaLeva = 1` |
| **idem, âncora nula (primeira execução)** | segue o dia da leva |
| **`levaDias: 1` lê todos os nunca tentados de uma vez; sem a opção o padrão é 7** (emenda do portão: I-5) | 35 leituras; e 5 em média com o padrão |
| **sem diário há 8, 9 e 10 dias, com 4 falhas do diário** (emenda do portão: I4) | `semDiarioEmDia` nos três (vermelho) |
| **sem diário há 11 dias, 4 falhas, 1 de 35** | `semRespostaDoYoutube`; não está em `semDiarioEmDia` |
| **sem diário há 30 dias, só 3 falhas** | `semDiarioEmDia` |
| **18 de 35 sem diário há 30 dias, 4 falhas** | todos em `semDiarioEmDia`; `pane: true` |
| **N1: sem diário há 11 dias; o diário falhou 4 dias por erro nosso, e por isso o fato traz `diario_falhas_4d 0`; 1 de 35** (emenda 2 do portão: N1) | `semDiarioEmDia` (vermelho); não está em `semRespostaDoYoutube` |
| diário parado há 8 dias | `semDiarioEmDia`; não lê |
| vídeo de 2 dias sem diário | `novos`; não é falha |
| `windowEnd` = `fonte_ate` quando a fonte está 3 dias atrás | (o nome diz) |
| janela de 7 dias: fechou e a fonte já passou do fim | lê `retencao_7d` com `inicio` e `fim` certos |
| janela de 7 dias: a fonte ainda não chegou ao fim | não lê |
| janela de 7 dias fechada antes de `janelasDesde` (decisão 32) | nunca lê |
| janela de 7 dias: resposta vazia há 3 dias | não lê; há 7, lê; 46 dias depois do fim, não lê mais |
| janela de 30 dias independe da de 7 | (o nome diz) |
| `lerFatos` com campo faltando ou tipo errado | lança |
| ordem: prioridade e depois id | (o nome diz) |

**Pronto quando:** os testes passam. O contrato de `FatoRetencao` bate, campo a campo, com o `jsonb` do apêndice B (o teste com um item real copiado do banco local está na Tarefa 9b: precisa da 1a aplicada) (emenda 2 do portão: m-F3).

### Tarefa 9: o passo "retenção"

**Contrato** (`coleta/retencao-step.ts`): `passoRetencao(ctx: StepCtx, deps?: { token?: (c: ColetaChannel) => Promise<string | null>; levaDias?: number }): Promise<RetencaoResumo>`, com `RetencaoResumo extends StepResumo { ate: DiaPt; vazios: number; chamadas: number; adiados_pela_leva: number; sem_diario_em_dia: number; sem_resposta_do_youtube: string[]; novos: number }` (`gravados` = curvas gravadas; `sem_resposta_do_youtube` = as notas prontas para `acao_do_dono`, uma por canal, com até 5 ids). Nunca lança por causa de um vídeo.
**As duas entradas de `deps`** (emenda do portão: I-5, R6): `token` tem como padrão o `obterToken` de `autorizacao.ts` (que renova **e grava** o token no banco do ambiente, por `ensureFreshToken`); `levaDias` tem como padrão `RETENCAO.levaDias` (7). Existem para o ensaio da Tarefa 14 entregar um token que já está em memória e ler tudo de uma vez, sem que o passo toque a tabela de conexões. Um teste afirma que **sem `deps`** o passo chama `obterToken` e usa 7.
Por canal com `sync_enabled` e `collection_status = 'ok'` (canal em `reautorizar` não é servido e **não gera nota nenhuma** deste passo: já há o e-mail próprio; emenda do portão: m-3), nesta ordem:
1. Sem tempo: tentativa de canal `nao_alcancado_orcamento` (kind `retencao_vida`, `scope_type 'canal'`) e fim.
2. `rpc('yt_own_retention_facts', { p_channel_id: c.id, p_hoje_utc: utcDay(agora) })` (o canal é do site do contexto; a função só devolve vídeos desse canal); `conferirBanco(…, 'yt_own_retention_facts', …, 'ler')`: `schema_ausente` para o passo inteiro (tentativa `schema_ausente` por canal). `lerFatos` que lança: falha `retenção: <canal>: fatos em forma inesperada` e segue para o próximo canal.
3. `decidirRetencao`. Lista vazia: tentativa de canal `ok` **sem pedir token**.
4. `deps.token ?? obterToken` (`null` = canal sem conexão ou sem autorização, já registrado).
5. `emParalelo(ler, PARALELO)`: confere o relógio antes de cada leitura (sem tempo: tentativa do vídeo `nao_alcancado_orcamento` com o `kind` da janela, `pendentes++`); `retencaoDoVideo`; na primeira resposta boa, `marcarAutorizado` (uma promessa por canal, como no diário).
   - `pontos` vazio: tentativa `sem_dado_na_janela`; `vazios++`.
   - senão: `upsert` em `yt_own_video_retention` com `onConflict: 'youtube_video_id,window_kind,segment,window_end'` e **todas** as colunas: `window_kind`, `segment: 'organico'`, `window_end`, `window_start`, `requested_end`, `site_id`, `video_id`, `channel_id`, `points`, `point_count`, `metrics_returned`, `views_at_read`, `source: 'analytics_api'`, `collected_at`, `metric_version: metricVersion(window_end)`. Gravou: tentativa `ok`, `gravados++`. `schema_ausente` na escrita: para tudo. Outro erro: `erro_http` com `erro de banco`.
   - erros: perda de autorização (`ehPerdaDeAutorizacao`) marca `reautorizar` uma vez e grava `sem_autorizacao` nos restantes; `AnalyticsApiError` vira `erro_http` com `http_status` e **`error: motivoDoErro(e)`** (um código do catálogo da Tarefa 2, nunca o texto: emenda do portão: R3); `SemTempoError` vira orçamento; o resto vai ao Sentry com `tags: { cron: 'sync-analytics-metrics', passo: 'retencao' }` e **só o id do vídeo** em `extra`, e na tentativa fica `error: 'excecao'`. Erro de banco no `upsert`: `error: 'erro_de_banco'`.
6. Notas em `falhas`: `retenção: <canal>: N de M leituras com erro (<textoDoMotivo da primeira causa>)`; `retenção: <canal>: N vídeo(s) sem diário em dia; a curva espera o diário (<até 5 ids>)`, só para os de `decisao.semDiarioEmDia` (com `pane`, a nota termina em "; metade ou mais do canal: é pane da coleta"). Os de `decisao.semRespostaDoYoutube` **não** vão para `falhas`: viram a nota `retenção: <canal>: N vídeo(s) que o YouTube não devolve mais (<até 5 ids>); a curva não é lida` em `resumo.sem_resposta_do_youtube` (emenda do portão: I4, m-3).
7. Tentativa de canal: `sem_autorizacao`, `nao_alcancado_orcamento` ou `ok`.

**Testes** (`fake-supabase` mais o arquivo novo `fake-retencao.ts`, com `comRetencao(db, fatos)`; `fetch` falso; relógio falso):

| Nome | Esperado |
|---|---|
| nada a ler: não pede token, não chama a API (item 60) | 0 chamadas; tentativa de canal `ok` |
| curva de 100 pontos é gravada com todas as colunas | linha com `point_count 100`, `metrics_returned` de três, `requested_end` = hoje, `window_end` = `fonte_ate` |
| duas execuções que decidiram ler a mesma janela regravam a mesma linha (item 60; execuções sobrepostas) | 1 linha depois de dois `upsert` com a mesma chave; a regra, sozinha, não relê no mesmo dia (trava da Tarefa 8) |
| na semana seguinte, com views novas, cria outra linha | 2 linhas |
| resposta vazia: tentativa `sem_dado_na_janela` e nenhuma linha (item 61) | (o nome diz) |
| 37 pontos; `ratio` 1,3; campo ausente | `point_count 37`; preservado; nulo no ponto |
| janela de 7 dias grava com `kind retencao_7d` e `window_kind primeiros_7_dias` | (o nome diz) |
| 401 no primeiro vídeo | canal em `reautorizar`; os demais `sem_autorizacao`, sem chamar a API |
| 500 três vezes | `erro_http`, `http_status 500`, `error: 'http_500'`; nota do canal com "erro do YouTube (500)" |
| **403 com `reason` que não está no catálogo** (emenda do portão: R3) | `error: 'http_403'`; o texto do `reason` não aparece na tentativa nem na nota |
| **exceção com texto qualquer** | `error: 'excecao'`; o texto só no Sentry |
| **`deps.token` é usado no lugar de `obterToken`** (emenda do portão: I-5, R6) | o `fetch` recebe o token injetado; nenhuma leitura nem escrita em `social_connections` no fake |
| **sem `deps`: chama `obterToken` e a leva é de 7 dias** | (o nome diz; é o padrão de produção) |
| **`deps.levaDias: 1` lê todos os nunca tentados** | 35 leituras numa execução |
| **vídeo sem resposta do YouTube há mais de 3 dias vira nota de ação do dono, não de falha** (emenda do portão: I4): fato com `fonte_ate` = hoje − 20 e `diario_falhas_4d 4`, 1 de 35 | `falhas` sem a nota de "sem diário em dia"; `sem_resposta_do_youtube` com o id |
| **a `rpc` de fatos recebe `p_hoje_utc`** | o dia UTC do relógio falso |
| `forma_inesperada` | `erro_http`; nada gravado |
| erro de banco no `upsert` | `erro_http` "erro de banco"; nota |
| função de fatos ausente | `schema_ausente`; nenhum token, nenhuma chamada |
| tabela ausente na escrita | para o canal em curso e os seguintes |
| fatos em forma inesperada | nota; próximo canal segue |
| sem tempo no meio | os restantes com `nao_alcancado_orcamento` do `kind` certo; `pendentes` |
| vídeos sem diário em dia | nota com a contagem; nenhuma chamada para eles |
| canal `reautorizar` ou sem conexão | nenhuma chamada; **nenhuma nota deste passo** para o canal em `reautorizar` (emenda do portão: m-3) |
| um item de fatos **escrito à mão com todos os campos do apêndice B** passa por `lerFatos` (emenda 2 do portão: m-F3) | sem erro; o item real, copiado do banco, é o teste da Tarefa 9b |
| o Sentry não recebe pontos nem corpo de resposta | `extra` só com o id |

**Pronto quando:** os testes passam.

### Tarefa 10: critério da retenção (o alarme da E8)

**Contrato** (`coleta/criteria-retencao.ts`): `criteriosRetencao(ctx)` lê os fatos de cada canal com `sync_enabled` e `collection_status = 'ok'` (a mesma `rpc` do passo, com `p_hoje_utc`, **depois** do passo; prazo total de 3 s por `prazoDoCriterio(relogio, 3_000)`, seção 5 e Tarefa 2) e chama a função pura `atrasadosDaRetencao(fatos, { hojePt, hojeUtc }): string[]` (os ids, do mais atrasado ao menos). Como o passo roda todo dia e serve quem vence aos 7, quem ainda está vencido aos 8 **depois** de o passo rodar é o que o passo deixou de fazer.
**A regra, por extenso** (emenda do portão: m-1, I3). Só é avaliado o vídeo **com diário em dia** (o que está em `novos`, em `semDiarioEmDia` ou em `semRespostaDoYoutube` tem a nota própria e não entra aqui). "Resposta" = tentativa `ok` ou `sem_dado_na_janela`. Um vídeo conta como atrasado em exatamente um destes casos:
- **(A) tem linha de `vida`** e a regra (b) da Tarefa 8, com 8 no lugar de 7, mandaria ler: passaram 8 dias ou mais desde o mais recente entre `vida_collected_at` e `vida_resposta_dia`, há views novas (`views_total` conhecido e maior que `vida_views_at_read`, ou `vida_views_at_read` nulo) e o fim da janela novo é posterior a `vida_window_end`;
- **(B) sem linha, com resposta vazia**: a regra (c) com 8 (8 dias ou mais desde `vida_resposta_dia` e `ultimo_dia_com_view >= vida_resposta_dia − 3`);
- **(C) a última tentativa não teve resposta, mas já houve resposta antes**: conta **só se** `vida_resposta_dia` tem mais de 8 dias **e** o caso (A) ou (B) contaria sem olhar a última tentativa. Erro hoje com resposta há 3 dias **não** conta (o erro do dia já tem a nota do passo);
- **(D) nunca teve resposta** (nunca tentado, ou só tentativas sem resposta): conta quando **o passo roda neste canal há mais de 8 dias**, isto é, `leva_ancora_dia` não nulo e **`< hojeUtc − 8`** (emenda do portão: I3; emenda 2 do portão: n1: a fórmula antiga `<=` não fechava com o teste de "8 dias exatos: 0"), **e o vídeo não começou a ser tentado há pouco**: `primeira_tent_dia` nulo ou `< hojeUtc − 8` (emenda 2 do portão: m-F6; sem isso, um vídeo que acabou de ficar em idade, com a primeira tentativa de hoje em `erro_http`, recebia no mesmo dia a nota "vencida há mais de 8 dias", que é texto falso, pois o erro de hoje já tem a nota do passo). A âncora é a primeira **execução do passo** no canal (tentativa de escopo `canal`), não a primeira tentativa de vídeo: se o passo rodar todo dia e nunca tentar vídeo nenhum (defeito na regra, lista sempre vazia), a âncora existe, envelhece, e no 9º dia **todo** vídeo com diário em dia e sem resposta conta. Com a âncora nula (o passo nunca rodou neste canal) ninguém conta: é o primeiro dia.

Nota: `retenção: <canal>: N vídeo(s) com leitura da curva vencida há mais de 8 dias (<até 5 ids>)`. Leitura que falha: `critérios: não foi possível avaliar retenção de <canal>`. `lerFatos` que lança: a mesma nota. Prazo vencido (antes de ler ou no meio): `critérios: não foi possível avaliar retenção de <canal> (sem tempo)`, sem chamar a `rpc` quando já entrou vencido (emenda 3 do portão: menor 2).
Somado a isso, na integração (Tarefa 11a), `criterioOrcamento` passa a receber os três kinds da retenção.

**Testes** (função pura, e o critério com `fake-supabase`):

| Nome | Esperado |
|---|---|
| sobe (A): linha de 9 dias com views novas e a fonte andou | 1 atrasado |
| não sobe (A): linha de 9 dias **sem** views novas | 0 (é aqui que o NP-E8 do spec, ao pé da letra, daria vermelho falso) |
| não sobe (A): linha de 9 dias, views novas, a fonte não andou (`windowEnd` igual) | 0 |
| sobe (B): resposta vazia há 9 dias e view depois dela | 1 |
| não sobe (B): resposta vazia há 9 dias, nenhuma view depois | 0 |
| sobe (C): última tentativa sem resposta há 2 dias, última resposta há 9, views novas | 1 |
| **não sobe (C): erro hoje com resposta há 3 dias** (emenda do portão: m-1) | 0 |
| **não sobe (C): erro hoje, resposta há 9 dias, sem views novas** | 0 |
| **sobe (D): nenhuma tentativa de vídeo e a primeira execução do passo no canal foi há 9 dias** (emenda do portão: I3) | **todos** os vídeos com diário em dia contam |
| **sobe (D): só tentativas de orçamento há 9 dias, âncora há 9 dias** | 1 |
| não sobe (D): âncora há 8 dias exatos | 0 |
| **não sobe (D): âncora há 9 dias e a primeira tentativa de retenção do vídeo é de hoje, `erro_http`** (emenda 2 do portão: m-F6) | 0 (o erro de hoje já tem a nota do passo) |
| não sobe (D): âncora há 3 dias, vídeo esperando o seu dia da leva | 0 |
| **não sobe (D): âncora nula, tabela vazia, primeiro dia, depois de o passo rodar** | 0 |
| não sobe: vídeo novo sem diário; vídeo sem diário em dia; vídeo sem resposta do YouTube (os três têm a nota do passo) | 0 |
| não sobe: lido hoje | 0 |
| não sobe: linha gravada sem nenhuma tentativa, de 3 dias (m-1) | 0; com 9 dias e views novas, 1 |
| leitura dos fatos falha | "não foi possível avaliar retenção de <canal>", e nenhuma nota de atraso |
| fatos em forma inesperada (`lerFatos` lança) | "não foi possível avaliar" |
| prazo de 3 s vencido (leitura que não volta) | `critérios: não foi possível avaliar retenção de <canal> (sem tempo)` (emenda 3 do portão: menor 2) |
| prazo já vencido na entrada (relógio com 297 s) | a mesma nota; `yt_own_retention_facts` **não** é chamada |
| função ausente | `schema_ausente` |
| canal desligado ou em `reautorizar` | não avalia |

**Pronto quando:** os testes passam. O caso (D) com âncora antiga e zero tentativa de vídeo é o que fecha o verde falso do parecer de dados (I3): o teste tem esse nome.

### Tarefa 9b: a retenção contra o banco de verdade (emenda do portão: I-6, R9)

**Objetivo.** O passo, a função de fatos, a regra e o critério rodando juntos contra o `bythiago_int`, antes da produção: é o que o banco falso esconde (o `upsert` com `onConflict` de quatro colunas, `points` em `jsonb`, `metrics_returned` em `text[]`, os `check`, os `kind` novos passando pelo `check` trocado, e o ciclo "o passo grava → os fatos leem → a regra não relê").
**Arquivo:** `test/integration/a5-e8-passos.test.ts`. `fetch` falso com as fixtures da C0.1 (as mesmas da Tarefa 7), banco real, relógio largo, `deps.token` devolvendo um texto fixo (nenhuma conexão é semeada), um site e um canal **do teste**, `ctx.channels` só com esse canal.

| Nome | Esperado |
|---|---|
| retenção: 100 pontos → 1 linha, tentativa `ok`, e a tentativa de canal `ok` | linha com `point_count 100`, `jsonb_array_length(points) = 100`, `metrics_returned` com três itens |
| **segunda execução no mesmo dia não chama a API** (item 60) | 0 `fetch` (conta as chamadas); 1 linha |
| retenção: resposta vazia → `sem_dado_na_janela`, 0 linhas, e não relê na execução seguinte | (o nome diz) |
| janela de 7 dias grava com `kind retencao_7d` | a tentativa passa pelo `check` novo de `kind` |
| 500 três vezes | tentativa `erro_http` com `error = 'http_500'` **na tabela** |
| critério: verde depois do passo | `falhas` vazio |
| **critério: vermelho com a âncora antiga e nenhuma resposta** | semeia a tentativa de canal de 9 dias atrás e nenhuma de vídeo: a nota lista os vídeos |
| critério: tabelas vazias, primeiro dia | `falhas` vazio (âncora nula) |
| **só o canal do teste é olhado** (R5) | um segundo canal, de outro site, com vídeo vencido, não aparece em nota nenhuma |
| um item real dos fatos passa por `lerFatos` | sem erro (trava o contrato de `FatoRetencao` com o apêndice B, campo a campo) |
| **N1: 4 dias de `erro_de_banco` do diário não tiram o vídeo do vermelho** (emenda 2 do portão: N1) | semeia o vídeo com `fonte_ate` parada há 20 dias e quatro tentativas `diario` `erro_http` com `erro_de_banco` e sem status (o fato real traz `diario_falhas_4d 0`) | a nota "sem diário em dia" fica em `falhas`; `sem_resposta_do_youtube` vazio |
| **N1: 4 dias de 404 tiram** | o mesmo com `http_status 404` e `http_404` (o fato real traz `diario_falhas_4d 4`), 1 de 35 | `falhas` sem a nota; `sem_resposta_do_youtube` com o id |

**Pronto quando:** passa duas vezes seguidas contra o `bythiago_int`, limpa o que semeou, e não depende da resposta do dono à pergunta 3.

### Tarefa 11a: a retenção entra no cron

**Contrato** (`coleta/index.ts`, fase `'depois'`). **A ordem é a da seção 5, e é a que vale para as três etapas** (emenda do portão: I-9): diário → [dimensões, normalizadores, se a E11 já integrou] → `criteriosL2` → [`criterioCobertura`, da Tarefa 11b] → [`criteriosE11`] → **retenção** → `criteriosRetencao` → `criterioDesligados` → critério de metadados → orçamento.
```
const nota = notaNomesDesconhecidos(); if (nota) pushUnico(falhas, nota)        // o texto vem de passos-desligados.ts; pushUnico não repete se a E11 também chamar
const desligados: PassoComInterruptor[] = []
passoDesligado('retencao')
  ? (resumo.retencao = { desligado: true }, desligados.push('retencao'))
  : resumo.retencao = await passo('retencao', TETOS_DE_FIM_MS.retencao, 'retencao_vida', ativos, passoRetencao); depois criteriosRetencao (em try, como os outros)
// as notas de resumo.retencao.sem_resposta_do_youtube entram em resumo.acao_do_dono
const notasDesligados = await criterioDesligados({ supabase, falhas, relogio }, desligados)   // em try; até a 7ª execução devolve a nota para acao_do_dono, da 8ª em diante põe em falhas
```
`criterioOrcamento` recebe também `'retencao_vida', 'retencao_7d', 'retencao_30d'`. **Os três critérios deste plano recebem o `relogio`** e usam `prazoDoCriterio` (Tarefa 2) (emenda 2 do portão: controlador c). A chamada de `criterioDesligados` leva o `relogio` no `ctx` (emenda 3 do portão: menor 1). **`resumo.ms.cauda`** = `max(0, Date.now() − relogio.fim)` lido no fim da fase `'depois'` (milissegundos que a cauda gastou depois dos 270 s; a rota já junta qualquer chave numérica de `resumo.ms` em `ms_passos`): é o número que a conferência `e8-tempo-real` lê. A lista `desligados` é uma só para a fase: a E11 e a E18, quando integrarem, fazem `push` do nome delas na mesma lista, antes da chamada de `criterioDesligados` (emenda do portão: I-7). O comentário de `PASSOS_LIGADOS` ("não há variável de ambiente") é corrigido: os passos antigos seguem no objeto; os novos, na variável. A rota não muda (`ms_passos` já junta qualquer chave numérica de `resumo.ms`; `acao_do_dono` já é unida e gravada em `yt_own_collection_runs`).
**`lib/conferencias.ts`** (emenda do portão: m-6), no molde de `E1_E2_DEPLOY` e `conferenciasE1E2`: constante `export const E8_COLETA_DEPLOY: string | null = null` (dia de São Paulo da promoção a `main`, preenchido **no commit do envio**) e função `conferenciasE8Coleta(deploy)`, que devolve `[]` com `null`, a entrada `e8-coleta-deploy-invalido` com data malformada, e senão, com `etapa: 'E8'` (o teste `test/lib/conferencias.test.ts` exige `E<n>`): `e8-primeira-execucao` (R + 1, agente: `resumo.retencao` do primeiro cron, `ms_passos.retencao`, quantas vazias e quantas com curva), `e8-tres-dias` (R + 3, agente: consulta K7 em três dias), `e8-primeira-leva` (R + 8, agente: consulta K6) e **`e8-tempo-real`** (R + 3, agente: lê `resumo.ms` das 3 primeiras execuções, inclusive `ms.cauda`, e a duração da invocação no painel da Vercel; o maior total passando de 250 s manda cortar os prazos dos três critérios para 2 s, 2 s e 1 s e o teto de fim da retenção para 10 s antes do envio do lote seguinte; seção 5, "Orçamento da cauda"; emenda 2 do portão: controlador c). `CONFERENCIAS` passa a espalhar também essa lista. O espelho `conferencias-com-data.md` recebe as mesmas linhas. `test/lib/conferencias.test.ts` ganha: "sem a data não há entradas de E8", "com a data, as quatro, nas datas certas", "data malformada vira a entrada de aviso".
**Fake: manipulador padrão** (emenda 2 do portão: F-1): `test/youtube/coleta/fake-supabase.ts` (do HEAD) passa a instalar por padrão `yt_own_retention_facts` → `{ data: [], error: null }` (lista vazia: nenhum vídeo, nenhuma nota), no molde de `comReachApply`. Sem isso, `criteriosRetencao` (que roda para todo canal `ok` depois do relógio) pega `PGRST202` e põe `schema_ausente` em `falhas`, e quebram os testes que rodam `rodarColeta` e afirmam `falhas` vazia: **`tres-dias.test.ts` (várias afirmações de `falhas` vazia), `orcamento.test.ts` (o de relógio estourado e o de "falha crítica", que compara `falhas` por igualdade) e `index.test.ts`**; entram nesta tarefa, assim como `fake-supabase.test.ts`. **Relógio dos dois testes de `orcamento.test.ts`** (emenda 3 do portão: T1): eles rodam a fase `'depois'` com o relógio 300 s atrás (linhas 61 e 73), e com isso `prazoDoCriterio` (limite de 296 s) já venceu: os critérios deste plano dariam "sem tempo" em `falhas` antes de ler qualquer coisa, e o manipulador padrão não seria nem chamado (**não é o manipulador padrão que deixa esses dois verdes**, ao contrário do que a frase acima dava a entender). Os dois testes passam a usar `criarRelogio(Date.now() - 280_000)` (os passos continuam sem tempo, porque o relógio de 270 s venceu; os critérios ainda têm prazo) e mantêm as afirmações de `falhas` como estão. Entra um teste novo no mesmo arquivo: "com 300 s decorridos, `criteriosRetencao` não chama `yt_own_retention_facts` e deixa a nota de sem tempo em `falhas`". **Nunca** afrouxar a afirmação de `falhas` nem calar o critério sem tempo. A E11 acrescenta as dela no mesmo lugar (Tarefa 10 dela, uma etapa por vez). Teste que quer a função ausente usa `db.errors['rpc:yt_own_retention_facts']`.
**Runbook:** seção 2 (o teto de fim da retenção; a ordem dos passos), seção 4 (as duas tabelas novas e como ler), seção 6 ("Retenção": cada nota nova e o que fazer; **a consulta para tirar da lista um vídeo apagado**, que é ato do dono; emenda do portão: m-3), seção 10 (desligar pelo `YT_OWN_STEPS_OFF` na Vercel: **sem commit, mas a variável só vale no deploy seguinte**, então é preciso um redeploy; e na 8ª execução desligado o cron fica vermelho; emenda do portão: m-10, I-7).

**Testes** (`index.test.ts`, acréscimos):

| Nome | Esperado |
|---|---|
| variável apagada: o passo roda e `resumo.retencao` é o resumo do passo (item 245) | (o nome diz) |
| `YT_OWN_STEPS_OFF=retencao`: não roda, `{ desligado: true }`, nota em `acao_do_dono`, nenhuma `rpc` de fatos, critério da retenção não avaliado (item 245) | (o nome diz) |
| **desligado pela 8ª execução seguida: a nota vai para `falhas`** (emenda do portão: I-7) | 7 execuções anteriores com `retencao.desligado` no fake |
| **desligado e a leitura das execuções falha** | "não foi possível avaliar há quanto tempo…", em `falhas` |
| nome desconhecido na variável | nota em `falhas`, **uma vez só** mesmo chamando `notaNomesDesconhecidos` duas vezes |
| a retenção roda depois do diário e de `criteriosL2` | ordem das chamadas |
| a nota de vídeo que o YouTube não devolve chega a `acao_do_dono` e não a `falhas` (emenda do portão: I4) | (o nome diz) |
| o passo lança: os outros critérios rodam e a nota das conferências continua a última | (o nome diz) |
| sem tempo antes do passo: tentativa de canal de orçamento com `kind retencao_vida` | (o nome diz) |
| `ms.retencao` aparece | (o nome diz) |
| **`ms.cauda` mede o que passou dos 270 s** (emenda 2 do portão: controlador c): relógio falso que termina a fase 'depois' 4 s depois de `relogio.fim`; e outra que termina antes | 4.000 ms; 0 |
| **os três critérios usam `prazoDoCriterio`**: relógio com 295 s decorridos e uma leitura que não volta | a nota de sem tempo do critério (texto exato da Tarefa 2) em `falhas`, em até ~1 s de relógio falso |
| **o falso padrão** (emenda 2 do portão: F-1; emenda 3 do portão: menor 4) | `rpc('yt_own_retention_facts')` sem semear devolve `[]`; `tres-dias.test.ts` e `orcamento.test.ts` ficam verdes só com as edições descritas nesta tarefa |
| **`orcamento.test.ts`, os dois testes de relógio estourado, com 280 s** (emenda 3 do portão: T1) | as afirmações de `falhas` de hoje, sem mudar (`[]` no primeiro; a nota de orçamento, por igualdade, no segundo) |
| **`orcamento.test.ts`, teste novo: com 300 s decorridos** (emenda 3 do portão: T1) | `criteriosRetencao` não chama `yt_own_retention_facts` (`rpcCalls` sem ela); `falhas` tem `critérios: não foi possível avaliar retenção de <canal> (sem tempo)` |

**Pronto quando:** `npx vitest run test/youtube/coleta test/cron test/api/cron test/lib/conferencias.test.ts` verde (emenda 2 do portão: F-1) (as listas da 3, da 11a e da 11b fecham verde com isto: a suíte inteira da coleta e as três da rota); `npx tsc --noEmit` do web e da api verdes.

### Tarefa 14: ensaio com a API real, gravando só no banco local (reescrita; emenda do portão: I-5, R6)

**Só roda com o sim do dono à pergunta 3 (dado em 13/10, decisão 61). Nunca grava em produção, nem o token.** O caminho normal do passo (`obterToken` → `ensureFreshToken`) **renova e grava** o token em `social_connections` do ambiente carregado e marca a conexão como revogada se a renovação falhar: o ensaio **não passa por ele**. São **dois processos**:

1. **`scripts/ensaio-retencao-ler-producao.ts`** (o único com credencial de produção; só lê). Lê de produção, **só por `select`**, os vídeos do canal (`youtube_video_id`, `published_at`, `duration_seconds`) e o `refresh_token` cifrado da conexão; decifra em memória; pede **um** token de acesso à Google (o mesmo pedido da conferência C0.1); e escreve **na saída padrão** um JSON `{ videos: […], accessToken, canalUc }`. Não escreve arquivo, não grava no banco, não imprime o token em log. Não importa `token-refresh` nem `autorizacao`.
2. **`scripts/ensaio-retencao.ts`** (sem nenhuma variável de serviço de produção no ambiente; só as do `bythiago_int`). Lê o JSON da entrada padrão (os dois rodam ligados por um `|`: o token nunca toca o disco), semeia no `bythiago_int` um site, um canal, os vídeos e um diário mínimo com cobertura em dia, e roda `passoRetencao(ctx, { token: async () => accessToken, levaDias: 1 })` com o cliente de serviço **local**. No fim apaga o que semeou.

**O que anota em `.superpowers/sdd/a5-e6-e8/ensaio.md`:** duração por chamada (mediana e máximo), duração total com 4 em paralelo, quantos dos 35 vídeos devolveram curva, `point_count` mínimo e máximo, maior `ratio`, se `rows` vem como lista vazia em todos os vazios, tamanho médio da linha gravada, e as duas fixtures novas (uma curva com mais de 100% e uma com menos de 100 pontos, se existirem), sem id de canal e sem token.
**Pronto quando:** o ensaio rodou; o número de segundos por leitura confirma (ou corrige) o teto de fim de 20 s da seção 5; e, **conferido por leitura e por `grep` antes de rodar**: (a) o segundo roteiro não importa `token-refresh` nem `autorizacao` diretamente, não chama `obterToken`, e o processo dele não tem `SUPABASE_SERVICE_ROLE_KEY` nem URL de produção no ambiente, **nem credencial de e-mail (SES) nem DSN do Sentry** (emenda 2 do portão: m-F8) (num 401 do ensaio, `marcarReautorizar` chama `avisarEntrada`, que mandaria e-mail de verdade; sem credencial ele falha em silêncio no banco local) (o roteiro **aborta** se `NEXT_PUBLIC_SUPABASE_URL` não for `http://127.0.0.1:54421`); (b) o primeiro roteiro não tem `insert`, `update`, `delete`, `upsert` nem `rpc`; (c) `select token_expires_at from social_connections where provider = 'youtube'` em produção (e `updated_at`, se a coluna existir) dá o mesmo resultado antes e depois do ensaio (a prova de que nada foi gravado lá).

### Tarefa 11b: a dieta entra no cron

**Contrato** (`coleta/index.ts`): `criterioCobertura` é chamado logo depois de `criteriosL2`, dentro do mesmo `if` do diário, em `try`; as notas que ele devolve (`acaoDoDono`) entram em `resumo.acao_do_dono` (emenda do portão: I4). Nada mais.
**`lib/conferencias.ts`** (emenda do portão: m-6, I-4): constante `E6_P2_DEPLOY: string | null = null` e função `conferenciasE6P2(deploy)`, no mesmo molde da Tarefa 11a, com `etapa: 'E6'`: `e6-p2-primeira-execucao` (D + 1, agente: `resumo.diario.apagadas` perto de 280, `intervalos` 70, `com_buraco` 0, consultas K2 a K5 e K8), `e6-retrato` (D + 1, agente: o retrato "depois" comparado com o "antes" **pela regra de três partes da Tarefa 15**, com a lista das diferenças no ledger; "igual" não é o critério), `e6-p2-tres-execucoes` (D + 3, agente: K3 = 0, K5 em dia e K8 = 0 nos três dias; **é o que libera P3**). O teste de `conferencias` ganha os três casos do molde. `CONFERENCIAS` passa a espalhar também `conferenciasE6P2(E6_P2_DEPLOY)`; o teste ganha o caso do molde "a constante publicada é nula ou uma data real, e a lista publicada tem a entrada" (`test/lib/conferencias.test.ts:163`): esquecido o espalhamento, a conferência nunca vence e nada avisa (emenda 3 do portão: menor 3).
**Runbook:** seção 1 (o diário guarda só dia com atividade; a cobertura), seção 4 (como ler zero medido × não medido por SQL), seção 6 ("Diário": as notas novas; o que é "o YouTube não devolve mais o vídeo" e a consulta para tirá-lo da lista; **o aviso de que um vídeo que perde a cobertura tem os zeros da vida inteira apagados na execução seguinte**, emenda do portão: m7), seção 12 (plano de volta, **com o texto da Tarefa 15**: reverter só o coletor; o leitor fica; a primeira execução do coletor antigo repede a vida dos vídeos parados e pode levar dois dias; emenda do portão: I2).
**Fake: semeadura de cobertura** (emenda 2 do portão: F-1): `fake-supabase.ts` ganha o auxiliar `semearCobertura(db, videos, hoje)` (uma linha `base` em dia por vídeo). Com `criterioCobertura` no cron, a tabela de cobertura vazia e um vídeo antigo é, **corretamente**, "todos atrasados, vermelho" (teste da Tarefa 4): `orcamento.test.ts` (o vídeo de 01/09) e os testes de `tres-dias.test.ts` e `index.test.ts` que têm vídeo antigo e afirmam `falhas` vazia passam a semear a cobertura em dia. `orcamento.test.ts` já está com o relógio em 280 s (Tarefa 11a); o teste de 300 s ganha a nota de sem tempo da cobertura na lista esperada (`critérios: não foi possível avaliar cobertura de <canal> (sem tempo)`) (emenda 3 do portão: T1). `fake-supabase.test.ts` ganha o teste de `semearCobertura`: uma linha `base` em dia por vídeo, e lista de vídeos vazia não semeia nada (emenda 3 do portão: menor 5). Entram na lista desta tarefa; outro arquivo que quebrar, para e avisa.
**Testes** (`index.test.ts`): o critério roda mesmo quando o passo do diário lançou ou ficou sem tempo; canal em `reautorizar` não gera nota; a nota de ação do dono do critério chega a `resumo.acao_do_dono`; `criterioCobertura` roda antes da retenção.
**Pronto quando:** `npx vitest run test/youtube/coleta test/cron test/api/cron test/lib/conferencias.test.ts` verde (emenda 2 do portão: F-1).

### Tarefa 3b: a dieta contra o banco de verdade (emenda do portão: I-6, R9)

**Arquivo:** `test/integration/a5-e6-passos.test.ts`. `fetch` falso (respostas do diário montadas no teste), banco real (`bythiago_int`), relógio largo, token por `ensureFreshToken` trocado no teste (`vi.mock('@/lib/social/token-refresh')`, como `diario-step.test.ts` já faz; **não** trocar `autorizacao` inteira, que esconderia `marcarAutorizado` contra o banco) e `avisarEntrada`/`avisarSaida` de `coleta/alerts` trocados, para nenhum e-mail sair (emenda 2 do portão: m-F2), um site e um canal **do teste**, `ctx.channels` só com ele.

| Nome | Esperado |
|---|---|
| diário: 8 dias, 1 com view → 1 linha, cobertura de 8 dias nos dois conjuntos, tentativa `ok` | o `p_rows` que o passo monta de verdade (médias nulas com a chave presente, `watch_time_minutes` fracionário, `metric_version`) é aceito pela função; o retorno tem os cinco números |
| segunda execução com a mesma resposta não muda nada | mesmas linhas, mesma cobertura (`atualizadas`, sem `inseridas`) |
| **resposta sem `views`: nada é gravado no banco** (I1) | 0 linhas, 0 intervalos, tentativa `erro_http` com `error = 'forma_inesperada'` |
| **resposta sem `engaged_views`: só o intervalo `base` existe** | 1 intervalo |
| **diário e leitor: `lerDiario` devolve as mesmas `DiarioLinha` antes e depois do passo** | semeia 8 dias de linhas (zeros inclusive) pelo coletor antigo mais a cobertura; lê; roda o passo (a função apaga os zeros); lê de novo: `toEqual` |
| critério de cobertura: verde depois do passo | `falhas` vazio |
| **critério: vermelho ao apagar a cobertura de um vídeo** | a nota com o id |
| **critério: vermelho com a tabela de cobertura vazia** | todos os vídeos do canal do teste |
| critério: 4º dia sem resposta do YouTube vira ação do dono | semeia a cobertura até hoje − 9 e quatro tentativas `sem_dado_na_janela` do diário; `falhas` vazio e a nota na lista devolvida, com a situação lida de `yt_own_video_meta_daily` |
| **N1: 4 dias de `erro_de_banco` ficam vermelhos** (emenda 2 do portão: N1) | cobertura até hoje − 9; quatro tentativas `diario` `erro_http` com `error = 'erro_de_banco'` e sem status | `falhas` com a nota do vídeo; nada na lista de ação do dono |
| **N1: 4 dias de 404 viram ação do dono** | o mesmo com `http_status 404` e `error = 'http_404'` | `falhas` vazio; a nota na lista devolvida |
| **só o canal do teste é olhado** (R5) | um vídeo sem cobertura de outro site não aparece |
| `lerCoberturaBase` com mais de 1.000 intervalos pagina | 1.200 intervalos semeados, 1.200 lidos |

**Pronto quando:** passa duas vezes seguidas contra o `bythiago_int` e limpa o que semeou.

### Tarefa 12a: o modelo puro da curva

**Contrato** (`proprio/retencao-curva.ts`, sem banco). As regras de "metade" e de "maiores saídas" são **as do mockup 6** (`video.js`, função `curvaInfo`), portadas sem mudar:
```ts
export interface PontoCurva { t: number; ratio: number; relative: number | null }
export interface LeituraDaCurva {
  pontos: number                       // quantos pontos a curva tem
  completa: boolean                    // 100 pontos
  meio: number | null                  // t do primeiro ponto com ratio < 0,5; null = nunca cruza
  saidas: Array<{ de: number; ate: number; ratioDe: number; ratioAte: number }>   // no máximo 2
  revistos: Array<{ de: number; ate: number }>                                    // no máximo 3
  pico: number                         // maior ratio (pode passar de 1)
  relativa: 'acima' | 'na-media' | 'abaixo' | null
}
export function lerCurva(pontos: readonly PontoCurva[]): LeituraDaCurva | null    // null com lista vazia
```
- Saídas: para cada índice `i` com `i + 5 < n`, a queda `ratio[i] − ratio[i+5]`; ordena da maior para a menor; fica com até duas que distem **mais de 12 pontos** uma da outra e sejam positivas; devolve em ordem de posição. Curva com menos de 13 pontos: sem saídas.
- Revistos (regra deste plano; o mockup traz os trechos escritos à mão): sequências seguidas em que `ratio` sobe de um ponto ao seguinte, com subida total de 0,02 ou mais; as três maiores, em ordem de posição.
- `relativa`: mediana de `relative` dos pontos que o têm; acima de 0,55 "acima"; abaixo de 0,45 "abaixo"; senão "na-media"; nulo se menos da metade dos pontos tem o campo. **Sem tela nesta entrega** (pergunta 2).

**Testes:**

| Nome | Esperado |
|---|---|
| lista vazia | `null` |
| curva real de 100 pontos (fixture da C0.1): `meio` | o `t` conferido à mão no teste |
| nunca cruza 0,5 | `meio: null` |
| cruza no primeiro ponto | `meio` = primeiro `t` |
| duas quedas grandes a 30 pontos uma da outra | as duas, em ordem de posição |
| duas quedas grandes a 8 pontos uma da outra | só a maior, mais a seguinte que diste mais de 12 |
| curva que só sobe | sem saídas |
| 12 pontos | sem saídas; `completa: false` |
| subida de 0,01 | não é revisto |
| subida de 0,05 em três pontos | um revisto com `de` e `ate` certos |
| `ratio` 1,3 | `pico 1.3` |
| `relative` em 30 de 100 pontos | `relativa: null` |
| mediana 0,60; 0,50; 0,40 | acima; na-media; abaixo |
| entrada fora de ordem | lança (o leitor entrega ordenado) |

**Pronto quando:** os testes passam.

### Tarefa 12b: o leitor da retenção

**Depois da A4 fechada. Não toca `ler.ts` e não espera a Tarefa 5** (emenda do portão: I-8).
**Contrato** (`proprio/ler-retencao.ts`, `server-only`): `lerRetencao(sb, p: Pedido & { ytId: string }): Promise<Privado<RetencaoDoVideo>>`, com
```ts
export interface CurvaLida { janela: Janela; windowStart: DiaYt; windowEnd: DiaYt; coletadaEm: string; pontos: PontoCurva[]; metricas: string[]; viewsAtRead: number | null }
export interface RetencaoDoVideo {
  ytId: string
  curvas: Partial<Record<Janela, CurvaLida>>      // a mais recente de cada janela
  leituras: Array<{ janela: Janela; windowEnd: DiaYt; coletadaEm: string }>   // todas, da mais nova para a mais velha
  leiturasCortadas: boolean                       // passou de 200
  ultimaTentativa: { dia: string; resultado: string } | null                  // kind retencao_vida, qualquer resultado
  ultimaResposta: { dia: string; resultado: 'ok' | 'sem_dado_na_janela' } | null   // a última em que a API respondeu (emenda do portão: m2)
  descartados: number                             // curvas com ponto em forma ruim, tratadas como ausentes
}
```
- A guarda é a mesma regra de `ler.ts`, **escrita aqui em uma linha**, sem editar aquele arquivo (emenda do portão: I-8): `edicaoValida(p.edicao) && UUID.test(p.canalId) ? p.edicao.siteId : null`, com `edicaoValida` importada de `./edicao` (já é exportada), `Pedido` importado como tipo de `./ler` e **`UUID` declarada de novo neste arquivo** (`const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`, a mesma de `ler.ts:25`, que **não a exporta** e não é editado) (emenda 2 do portão: m-F1). Sem prova, `negado` **sem consultar nada**. Toda consulta filtra `site_id`, `channel_id` e `youtube_video_id`. Um teste trava a igualdade com a guarda de `ler.ts`: os mesmos pedidos inválidos dão `negado` nos dois leitores.
- Consultas: a lista sem `points` (até 201, por `window_end` decrescente); os `points` da mais recente de cada janela (no máximo três consultas pequenas); as tentativas de `retencao_vida` do vídeo, da mais nova para a mais velha, **até 30 linhas** (`yt_own_collection_attempts`, `scope_type 'video'`, `scope_id`, `kind 'retencao_vida'`, `site_id`): a primeira é `ultimaTentativa`; a primeira com `ok` ou `sem_dado_na_janela` é `ultimaResposta` (emenda do portão: m2). Erro de banco é lançado (`ObservatoryLoadError`).
- `ytId` é validado (`/^[A-Za-z0-9_-]{11}$/`); fora disso, `negado`.
- Tabela de retenção ausente (`42P01` ou `PGRST205`, prévia sem a MG5): devolve o vazio (`curvas {}`, sem tentativa) e avisa o Sentry uma vez; a tela mostra "ainda não coletamos".
- Pontos lidos passam por validação (número finito, `0 <= t <= 1`, `ratio >= 0`, ordenados): se algum falha, a curva é tratada como ausente e `descartados++`.

**Testes** (unidade com o fake; e `proprio-ler-retencao-db.test.ts` contra o banco local):

| Nome | Esperado |
|---|---|
| sem prova de acesso: `negado`, nenhuma consulta | (o nome diz) |
| tabelas vazias | `curvas {}`, `leituras []`, `ultimaTentativa null` |
| só tentativa `sem_dado_na_janela` | `ultimaTentativa` e `ultimaResposta` com o dia e o resultado |
| **resposta vazia há 8 dias e `erro_http` ontem** (emenda do portão: m2) | `ultimaTentativa` = ontem, `erro_http`; `ultimaResposta` = há 8 dias, `sem_dado_na_janela` |
| só tentativas sem resposta | `ultimaResposta` nulo |
| **a guarda é a mesma de `ler.ts`** (emenda do portão: I-8) | `edicao` forjada, `canalId` que não é uuid e `ytId` inválido dão `negado` aqui e em `lerDiario` |
| duas leituras de `vida`: a mais nova é a curva, as duas na lista | (o nome diz) |
| três janelas | três curvas |
| 201 leituras | `leiturasCortadas: true`, 200 na lista |
| ponto com `ratio` de texto | curva ausente, `descartados 1` |
| erro de banco | lança |
| tabela ausente | vazio, sem lançar; Sentry avisado |
| banco local: linha de **outro site** com o mesmo id de vídeo não vaza | 0 |
| banco local: `points` volta como lista de objetos com números | tipos conferidos |
| `proprio-varredura.test.ts`: o arquivo novo entra na lista de leitores permitidos, e só ele consulta `yt_own_video_retention` | (o nome diz) |

**Pronto quando:** os testes passam.

### Tarefa 13: a seção "Retenção" da página do vídeo próprio (mockup 6)

**Mockup:** item 6 do lote de 12/10, **aprovado** (decisão 35): `docs/superpowers/mockups/2026-10-12-a4-proprio-e-ajustes/video.html?caso=cheio`, bloco "Retenção" (`video.js`, `secRetencao`; desenho da curva em `a4-comum.js`, `A.curva`). **O que este plano faz de tela é só o que esse bloco tem.** Fica de fora, esperando desenho (pergunta 2): seletor de janela, faixa "vídeos de duração parecida", lista de datas de leitura e "como a curva mudou".
**Contrato.**
- `_proprio/dados.ts`: `lerDadosDoVideo` passa a ler também a retenção (em paralelo com as outras duas); falha da retenção não derruba o resto (vira `{ acesso: 'erro' }` só nela, com aviso ao Sentry, como os outros).
- `_proprio/retencao-curva-model.ts` (puro): recebe `Privado<RetencaoDoVideo>`, a duração do vídeo em segundos e o formatador de data, e devolve a vista. Cinco estados (os textos de `sem-curva`, `erro` e `negado` são novos e passam pelo revisor de UX):

| Estado | Quando | Texto (do mockup ou do spec) |
|---|---|---|
| `coletada` | há curva `vida` | frase: "Metade das pessoas já saiu aos **m:ss** (N% do vídeo)." ou "Mais da metade das pessoas ficou até o fim."; lista "Maiores saídas: m:ss a m:ss, de X% para Y%; …" e "Trechos revistos: m:ss a m:ss; …" (cada item só aparece se houver); aviso: "Curva da vida inteira do vídeo, coletada em dd/mm. O % assistido da seção anterior é dos últimos dias." Com menos de 100 pontos, acrescenta "Curva com N pontos." |
| `sem-curva` | sem linha e **`ultimaResposta`** = `sem_dado_na_janela`, mesmo que a última tentativa de todas tenha sido um erro (emenda do portão: m2) | "**O YouTube não devolveu curva para este vídeo (poucas views).** Tentamos de novo quando o vídeo ganhar views. Última resposta: dd/mm." (a data é a de `ultimaResposta`) |
| `nao-coletada` | sem linha e `ultimaResposta` nulo | o texto de hoje: "Ainda não coletamos esta curva. Quando coletarmos, esta seção mostra onde as pessoas saem do vídeo e onde voltam." |
| `erro` | a leitura falhou | "A leitura da curva falhou agora; recarregue a página." |
| `negado` | sem a prova de acesso | a seção continua (hoje ela aparece para todos) com o método no ⓘ e a frase "Só quem edita o site vê a curva de retenção deste vídeo."; **nenhum** número, nenhuma data, nenhum SVG |

  Duração do vídeo desconhecida ou zero: os tempos saem em **% do vídeo**, nunca "0:00".
- `_proprio/retencao-curva.tsx` e `.css`: o gráfico do mockup em SVG (grade em 0, 50 e 100%; eixo de tempo em 0, 25, 50, 75 e 100% da duração; a linha vertical "metade já saiu aqui"; triângulos nas maiores saídas; faixas nos trechos revistos; legenda). O desenho é cortado em 120% como no mockup; se `pico` passa de 1,2, a legenda diz "pico de N% no começo". `role="img"` com `aria-label` que diz a frase principal. Cor por literal `rgba`/hex onde a cor carrega informação (nada de `color-mix`).
- `video-blocos-model.ts` e `video-blocos.tsx`: `BlocoRetencao` vira a vista nova; `SecRetencao` mostra o estado. O método (ⓘ "De onde vem a curva") fica como está.
- `header-model.ts`: a célula `retencao` do cabeçalho do **canal** hoje diz "a curva ainda não é coletada"; passa a dizer "a curva fica na página de cada vídeo" (é a única frase que ficaria falsa).
- **`lib/conferencias.ts`** (emenda 2 do portão: m-F4), no molde da Tarefa 11a: constante `E8_TELA_DEPLOY: string | null = null` (a data é posta no commit do envio) e função `conferenciasE8Tela(deploy)`, com `etapa: 'E8'` e a entrada `e8-tela-dado-real` (D + 1, agente: item 64, a frase "metade já saiu aos m:ss" refeita à mão em dois vídeos); `test/lib/conferencias.test.ts` e `conferencias-com-data.md` acompanham, com os três casos do molde (sem data, com data, data malformada). `CONFERENCIAS` passa a espalhar também `conferenciasE8Tela(E8_TELA_DEPLOY)`; o teste ganha o caso do molde "a constante publicada é nula ou uma data real, e a lista publicada tem a entrada" (`test/lib/conferencias.test.ts:163`) (emenda 3 do portão: menor 3).
- Semente e2e: o perfil `retencao` ganha uma curva de 100 pontos num vídeo, uma tentativa vazia em outro (seguida de um `erro_http` mais novo, para o caso m2) e nada num terceiro; `clearOwnL2` passa a apagar `yt_own_video_retention` antes dos canais (FK `restrict`). **Antes de editar a semente: `git status`; com alteração sem commit de outro terminal, esta parte espera** (emenda do portão: I-8, R7). A 13 e a 6 mexem na semente uma de cada vez, em qualquer ordem.

**Testes** (`proprio-retencao-curva-tela.test.tsx`, `// @vitest-environment jsdom`; `proprio-dados.test.ts`; e2e):

| Nome | Esperado |
|---|---|
| coletada: a frase traz o minuto certo para uma curva e uma duração conhecidas | "aos 2:06 (35% do vídeo)", conta escrita no teste |
| nunca cruza | "Mais da metade das pessoas ficou até o fim." |
| a data da leitura está na tela (item 64) | "coletada em dd/mm" |
| sem saídas e sem revistos | as duas linhas não aparecem (nada de "Maiores saídas: .") |
| 37 pontos | "Curva com 37 pontos." |
| duração desconhecida | porcentagens, nenhum "0:00" |
| `sem-curva` | o texto com a data da **última resposta** |
| **`sem-curva` com erro mais novo que a resposta vazia** (emenda do portão: m2) | continua `sem-curva`, com a data da resposta; não cai em "Ainda não coletamos" |
| `nao-coletada` | o texto de hoje, palavra por palavra |
| erro só na retenção | as outras seções aparecem; a retenção diz que a leitura falhou |
| `negado` | a frase de acesso; nenhum número, nenhuma data, nenhum SVG, e o leitor não foi consultado |
| nenhuma curva é desenhada sem pontos | o SVG não existe nos quatro estados sem curva |
| `ratio` 1,3 | legenda de pico; o caminho não sai da área |
| e2e: os três estados, a 1440 e a 390 px, tema claro e escuro, sem rolagem horizontal | capturas em `docs/superpowers/mockups/2026-10-12-a4-proprio-e-ajustes/e8-shots/` |

**Portões desta tarefa:** o agente `revisor-ux-senior` compara a tela com o mockup 6 (0 diferença de estrutura; os dois estados novos de texto são avaliados por ele); os dois especialistas revisam no fim; a validação autenticada do CMS (`docs/ops/runbook-cms-e2e-local.md`) antes da promoção. **Navegador só em subagente Sonnet.** A conferência com dado real (item 64: a frase "metade já saiu aos m:ss" refeita à mão em dois vídeos) é a entrada `e8-tela-dado-real` de `lib/conferencias.ts`.
**Pronto quando:** os testes passam, o revisor de UX concorda, e as capturas estão na pasta.

### Tarefa 15: envio, retrato e conferências

Três envios de código e um de migrations, cada um por **lista explícita de commits** (em 13/10 o HEAD local está 204 commits à frente de `origin/staging`: fato P11), com CI verde a cada push e promoção a `main` em seguida.

| Lote | Vai | Tem de estar em produção (ou em `main`) antes | No commit do envio |
|---|---|---|---|
| **M** | Tarefa 1b (os dois `.sql`). A Tarefa 1a (teste de schema e tipos) vai com o lote E8-coleta | os arquivos do lote B aplicados; o acordo dos especialistas. O dono aplica o lote C | nada |
| **E8-coleta** | 2, 2b, 2c, 7, 8, 9, 10, 9b, 11a, 1a (e o relatório da 14, se o dono autorizar) | MG14 e MG5 aplicadas e V1 a V7 conferidas; **em `main`, os lotes E12, E20 e E1+E2** (emenda do portão: I-8): são deles os commits não enviados em `coleta/index.ts` (4), `coleta/clock.ts` (1), `lib/conferencias.ts` (3), `index.test.ts` (8) e no runbook (10). Sem eles na frente, a lista de commits deste lote não aplica, ou arrasta commit de outro lote sem revisão | `E8_COLETA_DEPLOY` |
| **E6-P2** | 3a, 3, 3b, 4, 5, 6, 11b | MG14; a A4 em `main` (o leitor da Tarefa 5 parte do `ler.ts` dela); o lote E8-coleta | `E6_P2_DEPLOY`; **o retrato "antes"** |
| **E8-tela** | 12a, 12b, 13 | a A4 em `main`; MG5; **o lote E8-coleta em `main`** (os tipos de `Janela` e de `FatoRetencao` moram nele) (emenda 2 do portão: m-F4). **Não** espera o lote E6-P2 nem execução nenhuma da coleta (emenda do portão: I-8): sem curva coletada a tela diz "ainda não coletamos", que é verdade | a data de `E8_TELA_DEPLOY` (a constante e a função `conferenciasE8Tela` nascem na Tarefa 13) |

**Retrato (item 247), reescrito** (emenda do portão: I-4). A primeira versão comparava três somas por vídeo com corte na véspera do envio e exigia igualdade; **dava "diferente" por construção**: a fonte entrega até hoje − 3, então o primeiro cron depois do envio traz um dia novo que cabia no corte, e o YouTube revisa os últimos dias. O retrato agora é assim:
1. **Corte** = o último dia gravado no momento do "antes": `select max(day_pt) from yt_own_video_daily where site_id = :site`. Vai anotado no arquivo, com o instante da consulta e o uuid do site.
2. **O retrato guarda uma linha por vídeo e por dia** dos 31 dias até o corte (35 × 31 = 1.085 linhas), com `medido` e `views` (consulta K1, seção 11), e não somas. "Antes": tirado em produção depois do último cron do coletor antigo e antes da promoção do lote E6-P2; vai para `.superpowers/sdd/a5/retratos/e6-antes.json`. "Depois": a mesma consulta, com o **mesmo corte**, depois do primeiro cron do código novo; vai para `e6-depois.json`. Anota-se também `J`, o primeiro dia da janela que a primeira execução da dieta pediu (`min(hoje − 10, X)`, com X = o último dia coberto antes dela).
3. **Regra de comparação, em três partes:**
   - (a) `medido` **igual em todo** par (vídeo, dia). Qualquer diferença é defeito: um zero que virou "não medido", ou o contrário.
   - (b) `views` **igual em todo** par com dia **anterior a `J`** (o que a dieta não repediu). Qualquer diferença é defeito.
   - (c) `views` diferente num dia **de `J` em diante** só é aceito como revisão do YouTube, **listada uma a uma no ledger** (vídeo, dia, antes, depois). Mais de 5 diferenças, ou qualquer dia que passou de views maior que zero para zero, **para a conferência**: antes de dar por boa, conferir os pares contra o retrato do dia seguinte (uma revisão do YouTube se mantém; um defeito da dieta se repete em outros dias).
   - Zero diferença sem explicação. "É só o dia novo" não é explicação: com o corte no último dia gravado, não existe dia novo.
4. A regra foi rodada no banco local em volume de produção com duas revisões simuladas (fato L20): (a) 0, (b) 0, (c) exatamente as 2.

**Plano de volta** (emenda do portão: I2, m-10).
- **Lote E8-coleta:** `YT_OWN_STEPS_OFF=retencao` na Vercel **e um redeploy** (a variável só vale no deploy seguinte; não precisa de commit), ou reverter; as linhas ficam. Desligado por mais de 7 execuções o cron fica vermelho (desvio 18).
- **Lote E6-P2: reverte-se SÓ O COLETOR** (os commits das Tarefas 3 e 11b; a 3a pode ficar, só lê). **O leitor tolerante (Tarefa 5) fica**, e fica para sempre: ele lê certo nos dois estados, e é para isso que existe. A primeira versão mandava reverter o lote inteiro e dizia que o coletor antigo regravaria os zeros; é falso depois de alguns dias de dieta. A janela anda um dia por execução, então os zeros apagados vão de X até hoje − 3, e o coletor antigo recomeça de `min(hoje − 10, a última LINHA do vídeo)`. Com o leitor antigo de volta: num vídeo com view recente ficam dias sem linha entre X e hoje − 10, lidos como "não medido" numa janela que está na tela; num vídeo sem view desde 2019 (32 dos 35) a última linha é de 2019. **O que acontece ao reverter só o coletor:** o coletor antigo volta a gravar linha em todo dia que pedir, zeros inclusive; para os vídeos parados ele **repede a vida inteira** (a última linha é antiga), como no dia da carga inicial: em 10/10 o passo bateu o teto de 50 s e deixou 2 vídeos para o dia seguinte (fato P5), então a volta pode levar **dois dias** para fechar, com a nota de orçamento do diário nesse intervalo. A cobertura fica parada e o leitor tolerante usa o maior entre ela e a última linha: as telas não mudam de número.
- **Se algum dia for preciso reverter também o leitor**, o caminho é do dono e **não está neste plano**: uma consulta que recria as linhas de zero a partir da cobertura (para cada dia coberto sem linha, uma linha com as contagens em zero). Fica como obrigação do plano de P3, que é quem apaga em massa e precisa do mesmo caminho.
- **Lote E8-tela:** reverter; a seção volta ao texto de hoje.

**Pronto quando:** cada lote está em `main` com CI verde, as constantes `…_DEPLOY` de `lib/conferencias.ts` têm data, e o ledger `.superpowers/sdd/a5-e6-e8/progress.md` traz, por lote, os commits, o resultado das consultas, a lista de diferenças do retrato e o que ficou pendente.

## 11. Consultas de conferência (rodadas)

Todas foram rodadas no `bythiago_int`, dentro de `begin; … rollback;`, sobre semente (12/10, 22:40 a 22:50 de Brasília); o resultado sobre a semente está ao lado. Em produção só rodam depois das migrations (hoje as tabelas não existem lá).

**Em toda consulta desta seção o site entra por parâmetro** (`:site`, o uuid; emenda do portão: R5) e, onde a resposta é "quantos estão atrasados", a consulta devolve também **de quantos**: com o site errado ou nulo o resultado é `0 de 0`, que se lê como "nada foi avaliado", e não como "nada atrasado" (rodado: fato L21). A conferência anota o uuid usado.

**K1, retrato do item 247, por vídeo e dia** (emenda do portão: I-4; `:site`, `:corte` = o último dia gravado no momento do "antes"; rodada antes e depois da primeira execução simulada da dieta sobre a semente de 96.880 linhas, com duas revisões dentro da janela: fato L20):
```sql
select v.youtube_video_id, g::date as dia,
       case when d.youtube_video_id is not null then d.views is not null else c.covered_from is not null end as medido,
       case when d.youtube_video_id is not null then d.views when c.covered_from is not null then 0 end as views
  from youtube_videos v
  cross join generate_series(:corte::date - 30, :corte::date, '1 day') g
  left join yt_own_video_daily d on d.youtube_video_id = v.youtube_video_id and d.day_pt = g::date
  left join yt_own_video_coverage c on c.youtube_video_id = v.youtube_video_id and c.metric_set = 'base'
                                    and g::date between c.covered_from and c.covered_to
 where v.site_id = :site
 order by 1, 2;
```
`medido` segue o leitor da Tarefa 5: havendo linha, vale a linha (`views` nulo é "não medido", mesmo em dia coberto); sem linha, vale a cobertura, e o valor é 0. Semente: 1.085 pares nos dois retratos, 1.085 medidos nos dois; `medido` diferente: 0; `views` diferente antes da janela: 0; dentro da janela: 2 (as duas revisões simuladas, 2 → 3 e 0 → 1); soma de views 90 antes e 92 depois. A regra de comparação está na Tarefa 15.

**K2, V2 do dono e item 42** (`C = T` logo depois da MG14; depois da dieta `C >= T`):
```sql
select (select count(*) from yt_own_video_daily where views is not null) as t,
       (select sum(covered_to - covered_from + 1) from yt_own_video_coverage where metric_set = 'base') as c,
       (select count(*) from yt_own_video_coverage) as intervalos;
```
Semente: `t = c = 96880`, 70 intervalos; depois da primeira execução simulada, `t 96504` e `c 96880` (os 376 zeros da janela saíram). Quando a janela passa do último dia coberto, `c` também cresce (fato L4: `t 96600`, `c 96915`).

**K3, nenhuma linha nova sem atividade (item 43)**, a partir do dia do envio `:d`:
```sql
select count(*) from yt_own_video_daily
 where day_pt >= :d::date - 10
   and coalesce(views,0) = 0 and coalesce(engaged_views,0) = 0 and coalesce(watch_time_minutes,0) = 0
   and coalesce(likes,0) = 0 and coalesce(comments,0) = 0 and coalesce(shares,0) = 0
   and coalesce(subscribers_gained,0) = 0 and coalesce(subscribers_lost,0) = 0 and coalesce(card_impressions,0) = 0;
```
Semente depois da função: 0. **Sobe:** com uma linha de zero posta à mão num dia da janela, deu 1.

**K4, nenhuma linha fora da cobertura** (o que substitui `C = T` antes de P3) **e nenhum intervalo sobreposto ou vizinho:**
```sql
select count(*) from yt_own_video_daily d
 where d.views is not null and not exists (select 1 from yt_own_video_coverage c
   where c.youtube_video_id = d.youtube_video_id and c.metric_set = 'base' and d.day_pt between c.covered_from and c.covered_to);
select count(*) from yt_own_video_coverage a join yt_own_video_coverage b
  on a.youtube_video_id = b.youtube_video_id and a.metric_set = b.metric_set
 and a.covered_from < b.covered_from and b.covered_from <= a.covered_to + 1;
```
Semente: 0 e 0, depois de seis chamadas da função com buraco, fusão e revisão. **Sobe:** a linha posta à mão fora da cobertura fez a primeira dar 1.

**K5, NP-E6 (item 50):**
```sql
select count(*) as videos,
       count(*) filter (where not exists (select 1 from yt_own_video_coverage c
         where c.youtube_video_id = v.youtube_video_id and c.metric_set = 'base' and c.covered_to >= current_date - 4)) as sem_cobertura_em_dia
  from youtube_videos v where v.site_id = :site;
```
Semente: `8 e 1` com 7 de 8 vídeos cobertos até hoje − 3; `0 e 0` com o site nulo ou de outro site. Na semente grande (35 vídeos, com data fixa no lugar de `current_date`), os atrasados deram 0 com todos em dia, 1 depois de tirar a cobertura de um vídeo e **35** com a tabela vazia (vermelho, como deve). **Atenção:** `current_date` do banco é UTC e a fonte entrega hoje − 3; com 4 a folga é de um dia. O critério do cron (Tarefa 4) usa 5 dias no dia do Pacífico e é quem avisa; esta consulta é a conferência manual. Esta consulta **não** aplica o fim do alarme da pergunta 1: um vídeo que virou "ação do dono" continua contando aqui, e é para contar.

**K6, item 59, corrigido** (só tentativa com resposta):
```sql
select count(*) as videos,
       count(*) filter (where not exists (select 1 from yt_own_video_retention r where r.youtube_video_id = v.youtube_video_id and r.window_kind = 'vida')
         and not exists (select 1 from yt_own_collection_attempts a
           where a.scope_type = 'video' and a.scope_id = v.youtube_video_id and a.kind = 'retencao_vida'
             and a.outcome in ('ok', 'sem_dado_na_janela') and a.attempt_day >= current_date - 8)) as sem_curva_nem_resposta
  from youtube_videos v where v.site_id = :site;
```
Semente de 8 vídeos: **`8 e 8`** com as tabelas vazias; **continua 8** depois de uma tentativa `nao_alcancado_orcamento` (é o verde falso que o texto do spec deixava passar); **`8 e 7`** depois de uma resposta vazia num vídeo; uma resposta vazia de 9 dias atrás não desce. Depois do 8º dia a consulta deixa de valer ao pé da letra para vídeo sem curva e sem view nova (a regra não o relê): é conferência **do dia R + 8**, uma vez. **O alarme permanente é o critério do cron** (Tarefa 10, caso D, com a âncora da leva), não esta consulta.

**K7, NP-E8 (item 65), corrigido** (views novas desde a leitura, não "views nos últimos 14 dias"):
```sql
select count(*) as videos,
       count(*) filter (where exists (select 1 from yt_own_video_daily d where d.youtube_video_id = v.youtube_video_id and d.views > 0 and d.day_pt >= current_date - 14)
         and not exists (select 1 from yt_own_video_retention r where r.youtube_video_id = v.youtube_video_id and r.window_kind = 'vida' and r.collected_at >= current_date - 8)
         and not exists (select 1 from yt_own_collection_attempts a where a.scope_type = 'video' and a.scope_id = v.youtube_video_id
           and a.kind = 'retencao_vida' and a.outcome in ('ok', 'sem_dado_na_janela') and a.attempt_day >= current_date - 8)) as com_view_e_sem_leitura
  from youtube_videos v where v.site_id = :site;
```
Semente: `8 e 0` sem view recente; **`8 e 1`** com um vídeo com view há 4 dias e só uma tentativa de orçamento (sobe), enquanto o vídeo com resposta de hoje e o vídeo com view de 20 dias atrás não sobem. Esta é a forma do spec com a correção das tentativas; ela ainda pode dar **1 falso** para um vídeo cuja única view dos 14 dias já estava contada na última leitura (desvio 12 e Tarefa 10). Quem vale como alarme é o critério do cron; se K7 der diferente de 0, conferir o vídeo contra `views_at_read` antes de tratar como falha.

**K8, buraco de cobertura** (emenda do portão: m1; vídeo com mais de um intervalo `base`):
```sql
select count(*) from (select youtube_video_id from yt_own_video_coverage
                       where site_id = :site and metric_set = 'base' group by 1 having count(*) > 1) x;
```
Semente depois da dieta: 0; **1** com um buraco posto à mão. Em produção hoje há 35 ilhas para 35 vídeos (fato P3): esperado 0. Buraco dentro dos últimos 10 dias some sozinho; mais antigo, não (risco 16).

**V5, `serie_coletada` contra a soma pelo catálogo** (emenda do portão: I5, I-2; `:canal` = o uuid do canal):
```sql
select k.conrelid::regclass as tabela,
       (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %s where %I = %L', k.conrelid::regclass, a.attname, :canal), false, true, '')))[1]::text::bigint as linhas
  from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
 where k.contype = 'f' and k.confrelid = 'public.youtube_channels'::regclass and k.confdeltype = 'r' and cardinality(k.conkey) = 1
 order by 1;
```
A soma da coluna `linhas` tem de ser igual a `youtube_channel_removal_impact(:site, :canal)->'serie_coletada'` (`:canal` entra como texto entre aspas simples). A lista de tabelas é a do dia (seis hoje). Rodada na semente, com as duas migrations: oito tabelas, soma 5 (3 do diário, 2 intervalos), `serie_coletada` 5.

**V4** (permissões): rodada; resultados nos fatos L8 e L18. **V7** (`md5(prosrc)`): rodada nas cinco ordens (fato L15).

## 12. Onde está cada item de aceite do spec

| Item | Onde |
|---|---|
| 42 (`C = T` depois de P1; um intervalo por conjunto) | V2 do dono; K2; Tarefa 1a; fatos L2 e L19 |
| 43 (3 execuções; nenhuma linha nova sem atividade; `max(covered_to)` avança; telas iguais; base congelada) | K3, K5, K8; conferências `e6-p2-*`; Tarefa 6 (semente); Tarefa 3b (`lerDiario` igual antes e depois, contra o banco); retrato da Tarefa 15 (K1 por vídeo e dia, regra de três partes) |
| 44 (leitor) | Tarefa 5 |
| 45 (janela começa em hoje − 10) | Tarefa 3, primeiro teste |
| 46 (dia revisado para zero) | Tarefa 1a (contra o banco) e fatos L7 e L12 |
| 47, 48, 49 (depois de P3) | **fora deste plano** (P3); o desvio 13 corrige a igualdade de antes |
| 50 (NP-E6) | K5; Tarefa 4 (critério no cron), Tarefa 3b (o critério contra o banco) |
| 58 (conferência antes da migration) | feita: C0.1, `.superpowers/sdd/a5/conferencias-c0-resultado.md`, fixtures em `c0-fixtures/` |
| 59 (primeira leva) | K6; conferência `e8-primeira-leva` |
| 60 (reler no mesmo dia; semana seguinte; sem views novas a API não é chamada) | Tarefas 8 e 9 |
| 61 (sem ponto; campo ausente; `ratio` > 1; 37 pontos) | Tarefas 7 e 9; `check` da MG5 |
| 62 (métrica recusada) | Tarefa 7 (com o desvio 2) |
| 63 (quem não lê) | Tarefa 1a (RLS, inclusive com o GUC `app.site_id` forjado); a troca para o direito novo é do teste do item 169 (E17) |
| 64 (tela em navegador com dado real) | Tarefa 13 (teste, semente, capturas) e conferência `e8-tela-dado-real` |
| 65 (NP-E8) | Tarefa 10 (critério, com a âncora da leva), Tarefa 9b (contra o banco); K7 |
| 191 (nenhuma tabela da lista fica em `can_edit_site`) | o bloco PL nas duas tabelas (fato L1); a prova final é da E17 |
| 201 (`serie_coletada` conta as tabelas novas) | desvio 4 (corpo único, R1); Tarefa 1a; V5 e V7 |
| 245 (interruptor: "desligado" no retorno **e no vigia**) | Tarefas 2 e 11a (retorno); Tarefa 2c (o vigia fica vermelho na 8ª execução) |
| 246 (conferência com data) | Tarefas 11a, 11b e 15 |
| 247 (base congelada) | Tarefas 6, 3b e 15 (retrato reescrito) |

## 13. Riscos que ficam, sem suavizar

1. **A duração de uma chamada de retenção não foi medida.** O teto de fim de 20 s é uma conta sobre o diário. A Tarefa 14 mede antes do envio; se der mais de 2 s por leitura, a primeira leva passa a ficar sem tempo em parte dos dias (visível: orçamento) e o teto volta à mesa.
2. **A cota diária da Analytics API é desconhecida** (do dono, C0.2). O acréscimo é pequeno (até 8 consultas por dia sobre 35), mas a E11 vem atrás com mais.
3. **É provável que a maioria dos vídeos não tenha curva.** A C0.1 mostrou que janela com poucas views volta vazia; a curva da vida inteira veio em 2 de 3 vídeos testados. A tela vai dizer "o YouTube não devolveu curva" em muitos vídeos, e isso é o dado, não defeito.
4. **As janelas de 7 e de 30 dias nunca rodaram contra um vídeo novo** (não há vídeo novo desde 12/2024, e a C0.1 não pôde testar). O código é testado com resposta simulada; a primeira execução real será no próximo vídeo publicado, sem ninguém olhando. A conferência disso não tem data possível: fica anotada no ledger para o primeiro vídeo novo.
5. **`window_end` é inferência** (desvio 9). Se a retenção da API andar atrás do diário, o `window_end` gravado fica um ou dois dias à frente do que a curva cobre. Não há como saber pela resposta.
6. **`yt_own_retention_facts` não foi rodada com os dados de produção** (depende de tabelas que não existem lá). No banco local, sobre semente do tamanho de produção (35 vídeos, 96.880 linhas), levou 109 ms (fato L10). Em produção, não medido.
7. **O fim do alarme do vídeo que o YouTube não devolve depende de uma coisa que ninguém mediu** (emenda do portão: I4): não sei o que a Analytics API responde para um vídeo apagado (200 sem dias, 403 ou 404). A regra cobre `sem_dado_na_janela` e `erro_http` com 403, 404 ou 410 que não seja de cota (emenda 2 do portão: N1: erro de banco, `forma_inesperada`, 500, 429 e cota **não** contam e deixam o vídeo vermelho); um erro que derrube a autorização do canal inteiro seguiria outro caminho (`reautorizar`, e o 403 `insufficientPermissions` já é `sem_autorizacao`). **Lado seguro, declarado:** um vídeo apagado que a API responda com **outro** status (400, ou 500 persistente) fica vermelho até o dono tirá-lo da lista ou até alguém ampliar a lista de status. No sentido contrário, um 403 de cota com `reason` desconhecido (`limitExceeded`, `concurrentLimitExceeded`) contaria como vídeo não devolvido: a Tarefa 2 passa a gravá-lo como `http_403_quotaExceeded` (emenda 3 do portão: dados 1); um `reason` de cota que não case `/(quota|limit)exceeded/i` continua contando, e esse resto é risco aceito (exige 4 dias seguidos, menos da metade do canal e 3 e-mails vermelhos antes). E a "ação do dono" não avisa ninguém: o dono fica sabendo pelos 3 e-mails de vermelho que vêm antes, com o id. Canal de 1 vídeo com o vídeo apagado fica vermelho para sempre (1 de 1 é "metade ou mais"): é o lado seguro, e o canal `Thiago Figueiredo` tem 0 vídeos hoje.
8. **Entre M e D a cobertura fica parada** e `C = T` só vale no dia M. Quem conferir V2 dias depois vai ver `T` maior que `C`: é o esperado, e some na primeira execução da dieta.
9. **O espaço não volta com este plano.** O diário continua com 72 MB até P3 e o `vacuum full`.
10. **O fake de `yt_own_daily_apply` nos testes de unidade pode divergir da função.** A função é provada na Tarefa 1a e o passo contra o banco de verdade na Tarefa 3b (emenda do portão: I-6); os testes de unidade provam só o que o passo manda. O que continua sem prova antes da produção: a resposta **real** da Analytics API (os testes de integração usam `fetch` falso) e a trava por vídeo com duas sessões ao mesmo tempo.
11. **A função de impacto da remoção depende do catálogo do Postgres** (desvio 4). Uma tabela futura presa ao canal por `restrict` que **não** seja série coletada passaria a contar em `serie_coletada` e a bloquear a remoção com a recusa limpa (sem o corpo por catálogo ela bloquearia do mesmo jeito, com erro de banco). Nenhum teste lista mais "as tabelas esperadas" (emenda do portão: m-7): a lista mudaria a cada etapa e quebraria o teste dos outros. Quem cria tabela presa ao canal que não é série tem de usar `cascade` ou `set null`.
12. **`yt_own_collection_attempts` cresce cerca de 30 MB por ano e nada a limpa** (fato P8). Este plano acrescenta poucas linhas, mas o problema é da tabela e não está em nenhuma etapa que eu tenha lido: vai para o controlador.
13. **A regra dos "trechos revistos" e o corte do desenho em 120% são deste plano**, não do mockup (que trazia os trechos escritos à mão). Passam pelo revisor de UX na Tarefa 13; podem mudar.
14. **Três planos mexem em `coleta/index.ts`** (este, E11, E18). A ordem dos passos está escrita uma vez (seção 5) e a posse dos arquivos-base é da Tarefa 2 (seção 9), mas **as duas coisas estão decididas pelo controlador** (emenda 2 do portão: controlador a) e o plano da E11 emendado já as copia; falta o plano da E18 copiá-las (emenda do portão: I-9). A função de impacto está resolvida pela decisão R1 (um corpo só); o que resta é os outros planos colarem o bloco sem mudar, e o fecho conferir o md5.
15. **O leitor da retenção nasce com a prova de edição** (desvio 15): até a E17 trocar o tipo, a irmã do dono não veria a curva pela tela. Ela ainda não tem usuário. É discordância declarada com o spec; o controlador confirma.
16. **Buraco de cobertura com mais de 10 dias nunca é repedido** (emenda do portão: m1): a janela começa no **maior** dia coberto. Vale também para o conjunto `estendidas` depois de um período em que a API recusou ou não mandou as estendidas: aqueles dias ficam "não medido" nas colunas estendidas para sempre. Hoje não há buraco (35 ilhas para 35 vídeos). Fica visível (`resumo.diario.com_buraco`, consulta K8 nas conferências), mas não se cura sozinho; o conserto (a janela começar no primeiro dia não coberto, com um limite) está na lista de dívida.
17. **Depois da dieta, o leitor tolerante não pode mais ser revertido** (emenda do portão: I2), e não existe neste plano o caminho para recriar as linhas de zero a partir da cobertura. Se o leitor novo tiver um defeito, o conserto é para a frente.
18. **A cauda do cron, no pior caso, chega a cerca de 294 s de 300 s** somando este plano e o da E11 (seção 5). É o pior caso teórico, mas a folga é de 6 a 7 s e mais uma etapa com critério depois do relógio não cabe sem cortar prazo. (emenda 2 do portão: controlador c): o orçamento por passo, a ordem de corte e o limite de 296 s dos três critérios estão na seção 5; a medida real é a conferência `e8-tempo-real`.
19. **As tentativas de vídeo que morrem entre o `upsert` e o registro** (a função do cron morta aos 300 s) deixam linha sem tentativa: a regra trata (Tarefa 8, caso e), mas a contagem de K6 e K7 não vê essa leitura por tentativa, só pela linha.
20. **O ensaio (Tarefa 14) usa a chave mestra das conexões em memória** para decifrar o `refresh_token`, como a C0.1 fez. Nada é gravado, mas é a credencial mais sensível do sistema passando por um roteiro de scratch: por isso a pergunta 3 continua sendo do dono e o padrão é não rodar. O dono respondeu SIM em 13/10 (decisão 61): o ensaio roda, com as travas da Tarefa 14.

**Dívida registrada** (achados menores que não são de uma linha, e o que apareceu na emenda e não é deste plano):

| # | O quê | De onde | Para quem |
|---|---|---|---|
| D1 | A janela do diário repedir o buraco antigo (começar no primeiro dia não coberto, com limite de dias para a chamada não pedir a vida inteira todo dia) | m1 (dados) | plano de P3, que mexe na mesma janela |
| D2 | Ciclo de vida das leituras antigas da retenção (spec 9.2): 1.863 B × 35 vídeos × 52 semanas = 3,4 MB por ano no pior caso; nada apaga | m8 (dados) | a etapa do ciclo de vida |
| D3 | `yt_own_collection_attempts` cresce sem limpeza (119 linhas por dia hoje, cerca de 43 mil por ano; teto de 30 MB por ano) e este plano acrescenta de 5 a 10 por dia | risco 12; parecer de dados | controlador |
| D4 | Os passos antigos (`meta-step`, `reports-step`, `jobs-step`) gravam o texto da exceção (`describeCronCause`) na coluna `error` das tentativas, contra a decisão R3; `coleta/motivo.ts` (Tarefa 2) serve para eles | R3, achado na emenda | controlador (um commit próprio) |
| D5 | A consulta que recria as linhas de zero a partir da cobertura (a volta do leitor) | I2 (dados) | plano de P3 |
| D6 | O plano da E17 passo 0 listar `proprio/ler-retencao.ts` e o estado `negado` da tela da retenção entre o que troca e testa | m-9 (software) | plano da E17 |
| D7 | Medir o corpo de 700 kB da gravação de um vídeo sem cobertura por PostgREST | m11 (dados) | Tarefa 3b, se sobrar; senão o primeiro canal novo |
| D8 | A conferência das janelas de 7 e de 30 dias no primeiro vídeo novo (não há data possível) | risco 4 | ledger |
| D9 | `p_sets = {base,base}` é aceito pela `yt_own_daily_apply` e conta `intervalos` em dobro (só o número do retorno; rodado: 2 para 1 intervalo). `select distinct` no laço da MG14. O passo nunca manda repetido | `n2` (dados, fecho da primeira emenda) | o próximo SQL que mexer na MG14 |
| D10 | `test/youtube/coleta/criteria.test.ts` cita `rodarColeta` só em títulos de teste e não o chama; o parecer de software o listou entre os que a chamam. Não muda nada | F-1 (software) | nenhum |
| D11 | O plano da E11 justifica a edição de `sync-analytics-metrics-veredito.test.ts` por "exercitar `rodarColeta` de verdade"; o arquivo troca `rodarColeta` por `vi.fn()`. A edição dela (dois testes novos da rota) continua válida; só a justificativa está imprecisa | F-1 (software) | controlador, ao emendar o plano da E11 |
| D12 | O "pronto quando" da Tarefa 10 do plano da E11 ainda não traz o comando `npx vitest run test/youtube/coleta test/cron test/api/cron test/lib/conferencias.test.ts`, e o `criteriosE11` segue com `comPrazo` de 5 s em vez de `prazoDoCriterio`. A emenda 3 só pôde acrescentar uma linha à tabela de compartilhados de lá | fecho da emenda 2 (software, menor 6) e resposta da emenda 2 | controlador, **antes de despachar a Tarefa 10 da E11** |
| D13 | `resumo.ms.cauda` mede só até o fim de `rodarColeta`; o que a rota faz depois (gravar a execução) só aparece na duração da invocação na Vercel | fecho da emenda 2 (software, "o que não verifiquei") | a conferência `e8-tempo-real` (R + 3), que lê os dois números |

## 14. Apêndices: SQL final de cada migration

O texto abaixo é o que foi rodado **na emenda** (seção 4, fatos L12 a L22; os fatos L1 a L11 são da primeira versão e foram refeitos onde o SQL mudou; o L22 é da segunda emenda). A Tarefa 1a copia para os arquivos de ensaio e a Tarefa 1b cola nos arquivos de migration, sem mudar.

**O que mudou no SQL em relação à primeira versão** (emenda do portão):
- **Apêndice A, `yt_own_daily_apply`:** (1) recusa (`22023`) linha sem `metric_version` (m4); (2) recusa a chamada com `base` em que algum dia não tem `views` numérico, e com `estendidas` em que algum dia não tem `engaged_views` numérico (I1, I-1 a); (3) o passo (2), que apaga a linha sem atividade, exige `t.views = 0` em vez de `coalesce(t.views, 0) = 0`: linha com `views` nulo nunca é apagada (I-1 b). Mais três linhas de comentário no cabeçalho da função.
- **Apêndice A, `youtube_channel_removal_impact`:** **o corpo não mudou um byte**; ganhou as duas marcas `-- >>> corpo único` e `-- <<< corpo único` em volta (o bloco que os outros planos copiam: R1) e o comentário que explica.
- **Apêndice B, tabela:** dois `check` a mais, `cardinality(metrics_returned) > 0` e `metric_version <> ''` (m10).
- **Apêndice B, `diario_falhas_4d` (emenda 2 do portão: N1):** a contagem passou a ser só `sem_dado_na_janela` ou `erro_http` com `http_status` 403, 404 ou 410 e `error` sem `quotaExceeded`/`LimitExceeded`; comentário do campo refeito (4 linhas). Nada mais mudou no SQL: a MG14 e o corpo único da função de impacto não foram tocados.
- **Apêndice B, `yt_own_retention_facts`:** assinatura `(p_channel_id uuid, p_hoje_utc date default null)`; campos novos `leva_ancora_dia`, `diario_tent_dia`, `diario_tent_resultado`, `diario_falhas_4d` (I3, I4, m-2); o `revoke` e o `grant` com a assinatura nova.

### Apêndice A: MG14 (`npm run db:new observatorio_a5_e6_dieta_cobertura`)

```sql
-- =============================================================================
-- MIGRATION: Observatório A5, E6 (dieta do diário do canal próprio), parte ADITIVA (MG14 do spec)
-- Spec: docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md, seção 7.1
-- Aditiva. Roda duas vezes sem erro. NÃO apaga nenhuma linha de dado. Depende de 20261009000001 (L2).
--
-- O que faz:
--   1. yt_own_video_coverage: "o dia D foi coletado para o vídeo V", por intervalo e por conjunto de métricas.
--   2. Carga da cobertura a partir das linhas que já existem (só para vídeo e conjunto ainda SEM cobertura).
--   3. yt_own_daily_apply: a gravação atômica do diário (linhas com atividade, dia revisado para zero, cobertura).
--   4. yt_own_collection_attempts.kind: a lista sai do banco (o catálogo passa a ser do código).
--   5. youtube_channel_removal_impact: serie_coletada passa a somar TODA tabela com FK "restrict" para o canal.
-- Convive com o código que está em main: ele não lê a tabela nova, não chama a função nova e só grava
-- os seis valores antigos de kind, todos aceitos pela expressão nova.
-- =============================================================================
set lock_timeout = '5s';

-- ── 1. Cobertura ────────────────────────────────────────────────────────────
create table if not exists public.yt_own_video_coverage (
  youtube_video_id text not null,
  metric_set text not null check (metric_set in (
    'base', 'estendidas',                                              -- diário (E6)
    'trafego', 'dispositivo', 'pais', 'inscrito', 'detalhe', 'alcance_dim',  -- E11
    'meta_texto', 'meta_thumb')),                                      -- dieta de yt_own_video_meta_daily (E18, parte 2)
  covered_from date not null,          -- dia do YouTube, inclusive
  covered_to date not null,            -- idem; o último dia que a fonte DEVOLVEU, não "hoje"
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  source text not null default 'analytics_api' check (source in ('analytics_api', 'reporting_api')),
  collected_at timestamptz not null default now(),
  primary key (youtube_video_id, metric_set, covered_from),
  check (covered_to >= covered_from)
);
create index if not exists idx_yt_own_video_coverage_channel
  on public.yt_own_video_coverage (channel_id, metric_set, covered_to);

alter table public.yt_own_video_coverage enable row level security;
-- Leitura pelo direito "ver desempenho privado" se a MG11 já existir; senão, por quem edita (a MG11 troca depois).
do $$
declare v_fn text := case when to_regprocedure('public.can_view_private_site(uuid)') is not null
                          then 'public.can_view_private_site(site_id)' else 'public.can_edit_site(site_id)' end;
begin
  execute 'drop policy if exists "yt_own_video_coverage_select" on public.yt_own_video_coverage';
  execute format('create policy "yt_own_video_coverage_select" on public.yt_own_video_coverage for select using (%s)', v_fn);
end $$;
-- Nenhuma policy de escrita: insert, update e delete só por service role.

-- ── 2. Carga da cobertura (ilhas de dias seguidos, por vídeo e conjunto) ─────
-- Só entra vídeo e conjunto que ainda não têm NENHUM intervalo: rodar de novo depois de a coleta nova
-- começar (ou depois de as linhas vazias saírem) não cria intervalo picado por cima do que já existe.
with linhas as (
  select youtube_video_id, day_pt, site_id, video_id, channel_id, 'base'::text as metric_set
    from public.yt_own_video_daily where views is not null
  union all
  select youtube_video_id, day_pt, site_id, video_id, channel_id, 'estendidas'::text
    from public.yt_own_video_daily where engaged_views is not null
), ilhas as (
  select l.*, l.day_pt - (row_number() over (partition by l.youtube_video_id, l.metric_set order by l.day_pt))::integer as g
    from linhas l
)
insert into public.yt_own_video_coverage
  (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, source, collected_at)
select i.youtube_video_id, i.metric_set, min(i.day_pt), max(i.day_pt),
       (array_agg(i.site_id order by i.day_pt desc))[1],
       (array_agg(i.video_id order by i.day_pt desc))[1],
       (array_agg(i.channel_id order by i.day_pt desc))[1],
       'analytics_api', now()
  from ilhas i
 where not exists (select 1 from public.yt_own_video_coverage c
                    where c.youtube_video_id = i.youtube_video_id and c.metric_set = i.metric_set)
 group by i.youtube_video_id, i.metric_set, i.g
on conflict do nothing;

-- ── 3. Gravação atômica do diário ───────────────────────────────────────────
-- p_ids:  {"site_id": uuid, "channel_id": uuid, "video_id": uuid ou null}
-- p_rows: uma linha por dia DEVOLVIDO pela fonte: {"day_pt": "AAAA-MM-DD", "metric_version": "...", <métricas que vieram>}.
--         Chave ausente = a métrica não veio: o valor gravado fica como está. Chave presente e nula = grava nulo.
-- p_days_returned: os mesmos dias de p_rows (conferência: se divergirem, a função recusa em vez de adivinhar).
-- p_sets: os conjuntos que esta resposta cobre ('base', 'estendidas').
-- Na mesma transação: (1) atualiza a linha que já existe e insere a que tem atividade; (2) apaga a linha de um dia
-- devolvido que ficou sem atividade (o YouTube revisa os últimos dias); (3) estende, funde ou parte a cobertura.
-- Atividade = alguma das nove contagens diferente de zero (negativo conta).
-- Um dia só fica coberto num conjunto se a métrica que DEFINE o conjunto veio como número naquele dia (base = views;
-- estendidas = engaged_views): sem ela a chamada inteira é recusada, e "não veio" nunca vira "zero medido".
create or replace function public.yt_own_daily_apply(
  p_video text,
  p_ids jsonb,
  p_rows jsonb,
  p_days_returned date[],
  p_sets text[]
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_site uuid := (p_ids->>'site_id')::uuid;
  v_channel uuid := (p_ids->>'channel_id')::uuid;
  v_video uuid := nullif(p_ids->>'video_id', '')::uuid;
  v_days date[];
  v_rows jsonb := coalesce(p_rows, '[]'::jsonb);
  v_n integer;
  v_upd integer := 0;
  v_ins integer := 0;
  v_del integer := 0;
  v_int integer := 0;
  v_set text;
  v_mr datemultirange;
begin
  if p_video is null or p_video = '' then
    raise exception 'yt_own_daily_apply: p_video vazio' using errcode = '22023';
  end if;
  if v_site is null or v_channel is null then
    raise exception 'yt_own_daily_apply: p_ids sem site_id ou channel_id' using errcode = '22023';
  end if;
  if p_sets is null or cardinality(p_sets) = 0 or not (p_sets <@ array['base', 'estendidas']::text[]) then
    raise exception 'yt_own_daily_apply: p_sets tem de ser um subconjunto não vazio de {base, estendidas}' using errcode = '22023';
  end if;
  if jsonb_typeof(v_rows) <> 'array' then
    raise exception 'yt_own_daily_apply: p_rows não é lista' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct d order by d), '{}'::date[]) into v_days
    from unnest(coalesce(p_days_returned, '{}'::date[])) as d where d is not null;
  select count(*) into v_n from jsonb_array_elements(v_rows) as e;
  if cardinality(v_days) = 0 and v_n = 0 then
    return jsonb_build_object('dias', 0, 'atualizadas', 0, 'inseridas', 0, 'apagadas', 0, 'intervalos', 0);
  end if;
  -- p_rows e p_days_returned têm de ser o mesmo conjunto de dias, sem dia repetido.
  if v_n <> cardinality(v_days)
     or exists (select 1 from jsonb_array_elements(v_rows) as e
                 where e->>'day_pt' is null or (e->>'day_pt')::date <> all (v_days))
     or (select count(distinct e->>'day_pt') from jsonb_array_elements(v_rows) as e) <> v_n then
    raise exception 'yt_own_daily_apply: p_rows e p_days_returned não são o mesmo conjunto de dias' using errcode = '22023';
  end if;

  -- Toda linha traz a versão da métrica (o dia de zero também: ele pode virar linha numa revisão).
  if exists (select 1 from jsonb_array_elements(v_rows) as e where coalesce(e->>'metric_version', '') = '') then
    raise exception 'yt_own_daily_apply: linha sem metric_version' using errcode = '22023';
  end if;
  -- Um dia só conta como coberto num conjunto se a métrica que define o conjunto VEIO como número naquele dia
  -- (a mesma regra da carga: base = views não nulo; estendidas = engaged_views não nulo).
  if 'base' = any (p_sets) and exists (select 1 from jsonb_array_elements(v_rows) as e
                                        where jsonb_typeof(e->'views') is distinct from 'number') then
    raise exception 'yt_own_daily_apply: dia sem views numa resposta do conjunto base' using errcode = '22023';
  end if;
  if 'estendidas' = any (p_sets) and exists (select 1 from jsonb_array_elements(v_rows) as e
                                        where jsonb_typeof(e->'engaged_views') is distinct from 'number') then
    raise exception 'yt_own_daily_apply: dia sem engaged_views numa resposta do conjunto estendidas' using errcode = '22023';
  end if;

  -- Uma gravação por vídeo de cada vez (duas execuções do cron ao mesmo tempo não intercalam intervalos).
  perform pg_advisory_xact_lock(hashtextextended('yt_own_daily_apply:' || p_video, 0));

  -- (1a) a linha que já existe recebe só o que veio
  update public.yt_own_video_daily as t set
    views                     = case when e ? 'views'                     then (e->>'views')::bigint                      else t.views end,
    engaged_views             = case when e ? 'engaged_views'             then (e->>'engaged_views')::bigint              else t.engaged_views end,
    watch_time_minutes        = case when e ? 'watch_time_minutes'        then (e->>'watch_time_minutes')::numeric        else t.watch_time_minutes end,
    avg_view_duration_seconds = case when e ? 'avg_view_duration_seconds' then (e->>'avg_view_duration_seconds')::numeric else t.avg_view_duration_seconds end,
    avg_view_percentage       = case when e ? 'avg_view_percentage'       then (e->>'avg_view_percentage')::numeric       else t.avg_view_percentage end,
    likes                     = case when e ? 'likes'                     then (e->>'likes')::bigint                      else t.likes end,
    comments                  = case when e ? 'comments'                  then (e->>'comments')::bigint                   else t.comments end,
    shares                    = case when e ? 'shares'                    then (e->>'shares')::bigint                     else t.shares end,
    subscribers_gained        = case when e ? 'subscribers_gained'        then (e->>'subscribers_gained')::bigint         else t.subscribers_gained end,
    subscribers_lost          = case when e ? 'subscribers_lost'          then (e->>'subscribers_lost')::bigint           else t.subscribers_lost end,
    card_impressions          = case when e ? 'card_impressions'          then (e->>'card_impressions')::bigint           else t.card_impressions end,
    card_click_rate           = case when e ? 'card_click_rate'           then (e->>'card_click_rate')::numeric           else t.card_click_rate end,
    video_id = coalesce(v_video, t.video_id),
    source = 'analytics_api',
    collected_at = now(),
    metric_version = e->>'metric_version'
  from jsonb_array_elements(v_rows) as e
  where t.youtube_video_id = p_video and t.day_pt = (e->>'day_pt')::date;
  get diagnostics v_upd = row_count;

  -- (1b) dia novo: só entra se tem atividade
  insert into public.yt_own_video_daily
    (youtube_video_id, day_pt, site_id, video_id, channel_id,
     views, engaged_views, watch_time_minutes, avg_view_duration_seconds, avg_view_percentage,
     likes, comments, shares, subscribers_gained, subscribers_lost, card_impressions, card_click_rate,
     source, collected_at, metric_version)
  select p_video, (e->>'day_pt')::date, v_site, v_video, v_channel,
         (e->>'views')::bigint, (e->>'engaged_views')::bigint, (e->>'watch_time_minutes')::numeric,
         (e->>'avg_view_duration_seconds')::numeric, (e->>'avg_view_percentage')::numeric,
         (e->>'likes')::bigint, (e->>'comments')::bigint, (e->>'shares')::bigint,
         (e->>'subscribers_gained')::bigint, (e->>'subscribers_lost')::bigint,
         (e->>'card_impressions')::bigint, (e->>'card_click_rate')::numeric,
         'analytics_api', now(), e->>'metric_version'
    from jsonb_array_elements(v_rows) as e
   where (coalesce((e->>'views')::numeric, 0) <> 0 or coalesce((e->>'engaged_views')::numeric, 0) <> 0
          or coalesce((e->>'watch_time_minutes')::numeric, 0) <> 0 or coalesce((e->>'likes')::numeric, 0) <> 0
          or coalesce((e->>'comments')::numeric, 0) <> 0 or coalesce((e->>'shares')::numeric, 0) <> 0
          or coalesce((e->>'subscribers_gained')::numeric, 0) <> 0 or coalesce((e->>'subscribers_lost')::numeric, 0) <> 0
          or coalesce((e->>'card_impressions')::numeric, 0) <> 0)
     and not exists (select 1 from public.yt_own_video_daily d
                      where d.youtube_video_id = p_video and d.day_pt = (e->>'day_pt')::date);
  get diagnostics v_ins = row_count;

  -- (2) dia devolvido que ficou sem atividade: a linha sai (o dia continua coberto, logo abaixo).
  -- views NULO não é zero: linha cuja base nunca foi medida não é apagada (só sai com views = 0 medido).
  delete from public.yt_own_video_daily as t
   where t.youtube_video_id = p_video and t.day_pt = any (v_days)
     and t.views = 0 and coalesce(t.engaged_views, 0) = 0 and coalesce(t.watch_time_minutes, 0) = 0
     and coalesce(t.likes, 0) = 0 and coalesce(t.comments, 0) = 0 and coalesce(t.shares, 0) = 0
     and coalesce(t.subscribers_gained, 0) = 0 and coalesce(t.subscribers_lost, 0) = 0
     and coalesce(t.card_impressions, 0) = 0;
  get diagnostics v_del = row_count;

  -- (3) cobertura: a união do que já havia com os dias devolvidos; vizinhos se fundem, buraco parte o intervalo
  foreach v_set in array p_sets loop
    select range_agg(x.r) into v_mr from (
      select daterange(c.covered_from, c.covered_to, '[]') as r
        from public.yt_own_video_coverage c
       where c.youtube_video_id = p_video and c.metric_set = v_set
      union all
      select daterange(d, d, '[]') from unnest(v_days) as d
    ) x;
    delete from public.yt_own_video_coverage c
     where c.youtube_video_id = p_video and c.metric_set = v_set
       and not exists (select 1 from unnest(v_mr) as r where lower(r) = c.covered_from);
    insert into public.yt_own_video_coverage as c
      (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, source, collected_at)
    select p_video, v_set, lower(r), (upper(r) - 1), v_site, v_video, v_channel, 'analytics_api', now()
      from unnest(v_mr) as r
    on conflict (youtube_video_id, metric_set, covered_from) do update
      set covered_to = excluded.covered_to,
          site_id = excluded.site_id,
          channel_id = excluded.channel_id,
          video_id = coalesce(excluded.video_id, c.video_id),
          source = excluded.source,
          collected_at = excluded.collected_at;
    get diagnostics v_n = row_count;
    v_int := v_int + v_n;
  end loop;

  return jsonb_build_object('dias', cardinality(v_days), 'atualizadas', v_upd, 'inseridas', v_ins,
                            'apagadas', v_del, 'intervalos', v_int);
end $$;

revoke all on function public.yt_own_daily_apply(text, jsonb, jsonb, date[], text[]) from public, anon, authenticated;
grant execute on function public.yt_own_daily_apply(text, jsonb, jsonb, date[], text[]) to service_role;

-- ── 4. kind das tentativas: a lista sai do banco ────────────────────────────
-- O catálogo passa a ser COLLECTION_KINDS no código (com teste). Nome da constraint conferido em produção em 12/10/2026.
alter table public.yt_own_collection_attempts drop constraint if exists yt_own_collection_attempts_kind_check;
alter table public.yt_own_collection_attempts
  add constraint yt_own_collection_attempts_kind_check check (kind ~ '^[a-z0-9_]{1,40}$');

-- ── 5. Remover canal: toda tabela presa ao canal conta como série ───────────
-- Recriada por inteiro. Única mudança em relação a 20261009000001: serie_coletada deixa de ser uma lista escrita
-- (seis tabelas) e passa a somar toda tabela de public com chave estrangeira "on delete restrict" para
-- youtube_channels. Em 12/10/2026 são exatamente as mesmas seis; cada tabela nova da A5 que nascer presa ao canal
-- (cobertura, retenção, dimensões, versões, yt_own_public_*) entra sozinha, em qualquer ordem de migration.
-- public.youtube_channel_remove não muda (ela lê serie_coletada daqui).
-- CORPO ÚNICO DA A5 (decisão R1 do controlador): toda migration que precisar que esta função conheça tabela nova
-- traz o bloco entre as marcas abaixo SEM MUDAR UM BYTE (create or replace), nunca uma lista de tabelas.
-- >>> corpo único: youtube_channel_removal_impact (início)
create or replace function public.youtube_channel_removal_impact(p_site_id uuid, p_channel_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_name text;
  v_slug text;
  v_yt text;
  v_serie bigint := 0;
  v_n bigint;
  v_t record;
begin
  select c.name, c.slug, c.channel_id into v_name, v_slug, v_yt
  from public.youtube_channels c where c.id = p_channel_id and c.site_id = p_site_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- linhas da coleta que apontam para o canal (o bruto vai junto com o relatório, por cascata)
  for v_t in
    select k.conrelid::regclass::text as tabela, a.attname::text as coluna
      from pg_catalog.pg_constraint k
      join pg_catalog.pg_class r on r.oid = k.conrelid
      join pg_catalog.pg_namespace n on n.oid = r.relnamespace
      join pg_catalog.pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
     where k.contype = 'f' and k.confrelid = 'public.youtube_channels'::regclass
       and k.confdeltype = 'r' and n.nspname = 'public' and cardinality(k.conkey) = 1
     order by 1
  loop
    execute format('select count(*) from %s t where t.%I = $1', v_t.tabela, v_t.coluna) into v_n using p_channel_id;
    v_serie := v_serie + v_n;
  end loop;

  return jsonb_build_object(
    'status', 'ok',
    'name', v_name,
    'slug', v_slug,
    'videos', (select count(*) from public.youtube_videos v where v.channel_id = p_channel_id),
    'comments', (select count(*) from public.youtube_curated_comments cc
                 join public.youtube_videos v on v.id = cc.video_id where v.channel_id = p_channel_id),
    'sync_logs', (select count(*) from public.youtube_sync_log l where l.channel_id = p_channel_id),
    'ab_tests', (select count(*) from public.ab_tests t
                 join public.youtube_videos v on v.id = t.youtube_video_id
                 where v.channel_id = p_channel_id and t.status not in ('active', 'paused', 'queued', 'draft')),
    'ab_drafts', (select count(*) from public.ab_tests t
                  join public.youtube_videos v on v.id = t.youtube_video_id
                  where v.channel_id = p_channel_id and t.status = 'draft'),
    'analyses', (select count(*) from public.youtube_intelligence i
                 where i.channel_id = p_channel_id
                    or i.video_id in (select v.id from public.youtube_videos v where v.channel_id = p_channel_id)),
    'tasks', (select count(*) from public.youtube_intelligence_tasks k where k.channel_id = p_channel_id),
    'notes', (select count(*) from public.youtube_notes n where n.channel_id = p_channel_id),
    'notifications', (select count(*) from public.yt_notifications nt
                      where nt.youtube_video_id in (select v.id from public.youtube_videos v where v.channel_id = p_channel_id)
                         or nt.ab_test_id in (select t.id from public.ab_tests t join public.youtube_videos v on v.id = t.youtube_video_id
                                              where v.channel_id = p_channel_id)
                         or nt.optimization_cycle_id in (select oc.id from public.optimization_cycles oc
                                                         join public.youtube_videos v on v.id = oc.youtube_video_id
                                                         where v.channel_id = p_channel_id)),
    'connections', (select count(*) from public.social_connections sc
                    where sc.site_id = p_site_id and sc.provider = 'youtube' and sc.account_id = v_yt and sc.revoked_at is null),
    'pipeline_links', (select count(*) from public.content_pipeline p
                       where p.youtube_channel_id = p_channel_id
                          or p.youtube_video_id in (select v.id from public.youtube_videos v where v.channel_id = p_channel_id)),
    'serie_coletada', v_serie,
    'blockers', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'status', t.status, 'started_at', t.started_at,
                                          'paused_at', t.paused_at, 'video_title', v.title)
                       order by t.started_at nulls last, t.id)
      from public.ab_tests t join public.youtube_videos v on v.id = t.youtube_video_id
      where v.channel_id = p_channel_id and t.status in ('active', 'paused', 'queued')), '[]'::jsonb)
  );
end $$;

revoke all on function public.youtube_channel_removal_impact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.youtube_channel_removal_impact(uuid, uuid) to service_role;
-- <<< corpo único: youtube_channel_removal_impact (fim)
```

### Apêndice B: MG5 (`npm run db:new observatorio_a5_e8_retencao`)

```sql
-- =============================================================================
-- MIGRATION: Observatório A5, E8 (curva de retenção do vídeo próprio) (MG5 do spec)
-- Spec: docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md, seção 7.2
-- Aditiva. Roda duas vezes sem erro. Depende de <MG14> (yt_own_video_coverage e o check de kind):
-- sem ela, a função do item 2 não é criada e a migration para com erro, sem deixar nada pela metade.
--
-- O que faz:
--   1. yt_own_video_retention: uma linha por vídeo, janela, segmento e fim da janela (o histórico da curva).
--   2. yt_own_retention_facts: os fatos de cada vídeo de um canal que o passo "retenção" usa para decidir o que ler.
-- Convive com o código que está em main: ele não lê nem grava nada disto.
-- youtube_channel_removal_impact NÃO é recriada: desde a MG14 ela soma toda tabela presa ao canal por FK "restrict".
-- =============================================================================
set lock_timeout = '5s';

-- ── 1. A curva ──────────────────────────────────────────────────────────────
create table if not exists public.yt_own_video_retention (
  youtube_video_id text not null,           -- id de 11 caracteres (NÃO o uuid), como nas outras yt_own_*
  window_kind text not null check (window_kind in ('vida', 'primeiros_7_dias', 'primeiros_30_dias')),
  segment text not null default 'organico' check (segment in ('organico')),   -- audienceType==ORGANIC
  window_end date not null,                 -- último dia (dia do YouTube) que a leitura cobre
  window_start date not null,               -- o dia da publicação
  requested_end date not null,              -- o fim PEDIDO à API (window_end <= requested_end)
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  points jsonb not null,                    -- lista ordenada por t: {t, ratio, relative, segment_impressions}
                                            --   t = fração do vídeo (0,01 a 1,00); ratio = fração da audiência (PODE passar de 1)
                                            --   relative = relativeRetentionPerformance (0 a 1); campo que não veio fica nulo, nunca 0
  point_count integer not null check (point_count > 0),   -- pontos que VIERAM (pode ser menos de 100)
  metrics_returned text[] not null,         -- as métricas que a API devolveu nesta leitura
  views_at_read bigint,                     -- views do diário na leitura (vida: a vida inteira; janelas: as da janela); nulo = não se sabia
  source text not null default 'analytics_api' check (source in ('analytics_api')),
  collected_at timestamptz not null default now(),
  metric_version text not null,             -- catálogo no código (METRIC_VERSIONS), sem check aqui
  primary key (youtube_video_id, window_kind, segment, window_end),
  check (window_end >= window_start),
  check (requested_end >= window_end),
  check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) = point_count),
  check (cardinality(metrics_returned) > 0),
  check (metric_version <> '')
);
create index if not exists idx_yt_own_video_retention_channel
  on public.yt_own_video_retention (channel_id, window_end);

alter table public.yt_own_video_retention enable row level security;
do $$
declare v_fn text := case when to_regprocedure('public.can_view_private_site(uuid)') is not null
                          then 'public.can_view_private_site(site_id)' else 'public.can_edit_site(site_id)' end;
begin
  execute 'drop policy if exists "yt_own_video_retention_select" on public.yt_own_video_retention';
  execute format('create policy "yt_own_video_retention_select" on public.yt_own_video_retention for select using (%s)', v_fn);
end $$;
-- Nenhuma policy de escrita: insert, update e delete só por service role.

-- ── 2. Fatos por vídeo, para o passo decidir ────────────────────────────────
-- Devolve UMA lista jsonb (não um conjunto de linhas): o limite de 1.000 linhas do PostgREST não corta nada.
-- A função só entrega fatos; a regra (quem vence, quem espera) é código, testado sem banco.
--   views_total: soma de views do diário; NULO quando o vídeo nunca teve diário (nem linha, nem cobertura). Nunca 0 por ausência.
--   fonte_ate: último dia que a Analytics API devolveu no diário deste vídeo: o maior entre a cobertura 'base' e a
--              última linha gravada (vale antes e depois de a coleta nova do diário entrar); nulo = nunca.
--   *_tent_*: a última tentativa (qualquer resultado); *_resposta_dia: a última com resposta da API ('ok' ou 'sem_dado_na_janela').
--   primeira_tent_dia: a tentativa de retenção mais antiga do vídeo (qualquer janela, qualquer resultado); nulo = nunca.
--   leva_ancora_dia: o dia (UTC) da PRIMEIRA execução do passo "retenção" neste canal (a tentativa de escopo 'canal',
--              kind 'retencao_vida', mais antiga; o passo grava uma por execução, com qualquer resultado). Igual em todo
--              item do canal; nulo = o passo nunca rodou. É a âncora de "a primeira leva já acabou".
--   diario_tent_dia / diario_tent_resultado: a última tentativa do DIÁRIO deste vídeo (qualquer resultado).
--   diario_falhas_4d: em quantos dos 4 últimos dias UTC (p_hoje_utc e os 3 anteriores) a tentativa do diário deste vídeo
--              terminou com O YOUTUBE NÃO DEVOLVENDO O VÍDEO: 'sem_dado_na_janela', ou 'erro_http' com http_status 403, 404 ou 410
--              que não seja de cota (error sem 'quotaExceeded' nem 'LimitExceeded'). Falha NOSSA não conta: 'erro_de_banco',
--              'forma_inesperada', 'excecao', erro sem status, 500, 429 e 403 de cota. 4 = quatro dias seguidos em que o
--              YouTube não devolveu o vídeo. (emenda 2 do portão: N1)
-- p_hoje_utc: o dia UTC de quem chama (o código passa o seu relógio; nulo = current_date). Parâmetro para o teste
--              não depender do relógio do banco.
create or replace function public.yt_own_retention_facts(p_channel_id uuid, p_hoje_utc date default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(f) order by f.youtube_video_id), '[]'::jsonb)
  from (
    select v.youtube_video_id,
           v.id as video_id,
           v.site_id,
           v.duration_seconds,
           (v.published_at at time zone 'America/Los_Angeles')::date as publicado_dia_pt,
           fonte.ate as fonte_ate,
           case when fonte.ate is null then null else coalesce(d.views_total, 0) end as views_total,
           d.ultimo_dia_com_view,
           case when fonte.ate >= pub.dia + 6  then coalesce(d.views_7d, 0)  end as views_7d,
           case when fonte.ate >= pub.dia + 29 then coalesce(d.views_30d, 0) end as views_30d,
           r.vida_window_end, r.vida_collected_at, r.vida_views_at_read,
           coalesce(r.tem_7d, false) as tem_7d,
           coalesce(r.tem_30d, false) as tem_30d,
           a.primeira_tent_dia,
           leva.ancora_dia as leva_ancora_dia,
           dia.tent_dia as diario_tent_dia, dia.tent_resultado as diario_tent_resultado,
           coalesce(dia.falhas_4d, 0) as diario_falhas_4d,
           a.vida_tent_dia, a.vida_tent_resultado, a.vida_resposta_dia,
           a.d7_tent_dia, a.d7_tent_resultado, a.d7_resposta_dia,
           a.d30_tent_dia, a.d30_tent_resultado, a.d30_resposta_dia
      from public.youtube_videos v
      cross join lateral (select (v.published_at at time zone 'America/Los_Angeles')::date as dia) pub
      left join lateral (
        select max(c.covered_to) as coberto_ate
          from public.yt_own_video_coverage c
         where c.youtube_video_id = v.youtube_video_id and c.metric_set = 'base'
      ) cov on true
      left join lateral (
        select max(x.day_pt) filter (where x.views is not null) as ultimo_dia_gravado,
               sum(x.views) as views_total,
               max(x.day_pt) filter (where x.views > 0) as ultimo_dia_com_view,
               sum(x.views) filter (where x.day_pt between pub.dia and pub.dia + 6) as views_7d,
               sum(x.views) filter (where x.day_pt between pub.dia and pub.dia + 29) as views_30d
          from public.yt_own_video_daily x
         where x.youtube_video_id = v.youtube_video_id
      ) d on true
      cross join lateral (
        select nullif(greatest(coalesce(cov.coberto_ate, '-infinity'::date), coalesce(d.ultimo_dia_gravado, '-infinity'::date)), '-infinity'::date) as ate
      ) fonte
      left join lateral (
        select max(t.window_end) filter (where t.window_kind = 'vida') as vida_window_end,
               (array_agg(t.collected_at order by t.window_end desc) filter (where t.window_kind = 'vida'))[1] as vida_collected_at,
               (array_agg(t.views_at_read order by t.window_end desc) filter (where t.window_kind = 'vida'))[1] as vida_views_at_read,
               bool_or(t.window_kind = 'primeiros_7_dias') as tem_7d,
               bool_or(t.window_kind = 'primeiros_30_dias') as tem_30d
          from public.yt_own_video_retention t
         where t.youtube_video_id = v.youtube_video_id and t.segment = 'organico'
      ) r on true
      left join lateral (
        select min(t.attempt_day) as primeira_tent_dia,
               max(t.attempt_day) filter (where t.kind = 'retencao_vida') as vida_tent_dia,
               (array_agg(t.outcome order by t.attempt_day desc) filter (where t.kind = 'retencao_vida'))[1] as vida_tent_resultado,
               max(t.attempt_day) filter (where t.kind = 'retencao_vida' and t.outcome in ('ok', 'sem_dado_na_janela')) as vida_resposta_dia,
               max(t.attempt_day) filter (where t.kind = 'retencao_7d') as d7_tent_dia,
               (array_agg(t.outcome order by t.attempt_day desc) filter (where t.kind = 'retencao_7d'))[1] as d7_tent_resultado,
               max(t.attempt_day) filter (where t.kind = 'retencao_7d' and t.outcome in ('ok', 'sem_dado_na_janela')) as d7_resposta_dia,
               max(t.attempt_day) filter (where t.kind = 'retencao_30d') as d30_tent_dia,
               (array_agg(t.outcome order by t.attempt_day desc) filter (where t.kind = 'retencao_30d'))[1] as d30_tent_resultado,
               max(t.attempt_day) filter (where t.kind = 'retencao_30d' and t.outcome in ('ok', 'sem_dado_na_janela')) as d30_resposta_dia
          from public.yt_own_collection_attempts t
         where t.scope_type = 'video' and t.scope_id = v.youtube_video_id
           and t.kind in ('retencao_vida', 'retencao_7d', 'retencao_30d')
      ) a on true
      left join lateral (
        select max(t.attempt_day) as tent_dia,
               (array_agg(t.outcome order by t.attempt_day desc))[1] as tent_resultado,
               count(*) filter (where (t.outcome = 'sem_dado_na_janela'
                                       or (t.outcome = 'erro_http' and t.http_status in (403, 404, 410)
                                           and coalesce(t.error, '') !~ '(quota|Limit)Exceeded'))
                                  and t.attempt_day between coalesce(p_hoje_utc, current_date) - 3
                                                        and coalesce(p_hoje_utc, current_date)) as falhas_4d
          from public.yt_own_collection_attempts t
         where t.scope_type = 'video' and t.scope_id = v.youtube_video_id and t.kind = 'diario'
      ) dia on true
      cross join (
        select min(t.attempt_day) as ancora_dia
          from public.yt_own_collection_attempts t
         where t.scope_type = 'canal' and t.scope_id = p_channel_id::text and t.kind = 'retencao_vida'
      ) leva
     where v.channel_id = p_channel_id and v.published_at is not null
  ) f
$$;

revoke all on function public.yt_own_retention_facts(uuid, date) from public, anon, authenticated;
grant execute on function public.yt_own_retention_facts(uuid, date) to service_role;
```
