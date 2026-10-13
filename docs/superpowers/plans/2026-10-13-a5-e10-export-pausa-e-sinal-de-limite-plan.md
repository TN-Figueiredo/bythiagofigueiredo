# A5, ordem 15: E10, export com conferência, pausa de coleta e sinal de limite (plano de implementação)

Escrito em 13/10/2026. Spec: `docs/superpowers/specs/2026-10-12-observatorio-a5/06-ciclo-de-vida-volume-e-cota.md`, seção 9.2 (ciclo de vida, export, pausa, lista fechada, sinal de limite) e 9.6 (folga do plano gratuito); itens de aceite 74 a 82 e 229 a 231; obrigações de plano OP-3, OP-9 e OP-11. Migration: **MG6**. Fatos de partida: `.superpowers/sdd/a5-planos-onda-2/e10-export-pausa-e-sinal-de-limite/fatos.md` (conferidos no código onde o desenho depende deles: seção 3).

**Objetivo, em três frases.** Dar ao dono um caminho seguro para tirar um canal de concorrente do banco online: pausar a coleta do canal, exportar tudo o que é dele para arquivos conferidos, confirmar a cópia no NAS e só então remover, com o banco recontando o canal contra o arquivo dentro da mesma transação que apaga. Medir o tamanho do banco uma vez por dia e dizer, com meses de antecedência, quando ele chega aos 500 MB do plano gratuito, sem nunca ficar verde por falta de medida. Fechar a lista do que apaga dado no Observatório com um teste que falha quando aparece um `delete` fora dela.

**Fica FORA deste plano.**
- **Toda tela.** O aviso de banco no cabeçalho (mockup 18), a pastilha "coleta pausada" com o botão de despausar, o passo "exportar antes" do diálogo de remover canal, a lista de lotes não confirmados e a seção "Sugestões" esperam mockup aprovado pelo dono. Aqui entram o dado, os leitores de servidor e os modelos puros, sem nenhum componente. Até a tela existir, pausar e despausar são comandos de linha.
- **A fase de manutenção** (spec próprio): banco no NAS, carga dos exports, lote por idade, `apagar <lote>` e a função `obs_archive_delete`, o botão "Ver antigo", o estado "arquivado" nas telas. O comando `exportar` daqui **recusa** lote por idade.
- **Reabrir a limpeza do bruto dos relatórios.** A MG6 **não toca** `yt_reporting_blobs_purge`: ela continua devolvendo 0 (MG13). O motivo está no desvio D1 da seção 8.
- **Export do canal próprio** (o spec diz que esta fase não tem: linha 11 da lista fechada).
- **O motivo "não medido: coleta pausada" nas telas.** Este plano grava o histórico das pausas; quem lê e mostra é a etapa das medidas e marcas (E4) e os mockups (E13).
- Nenhuma rota nova em `apps/web/src/app/api/pipeline/`; nada em `docs/cowork-*`, `apps/web/data/pipeline-docs/` nem em `lib/pipeline/api-registry.ts`. Nenhuma entrada nova em `vercel.json` (a tarefa entra na agenda que já existe).

---

## 0. Dependências duras e avisos de topo (ler antes de tudo)

### 0.1 O que este plano usa de outras migrations

| O que uso | De onde | Como uso |
|---|---|---|
| `yt_reporting_blobs_purge(text[])` devolvendo 0 | MG13 (em produção) | **não toco**; a consulta V1 confere que o corpo instalado não tem `delete` |
| `competitor_series_health(uuid, timestamptz)` | MG2b, recriada pela MG9 (em produção) | a MG6 acrescenta UMA condição ao corpo instalado (seção 4.3) |
| `competitor_hourly_health(uuid, timestamptz, integer, integer)` | MG9 (em produção) | idem |
| `competitor_comment_due(...)` e `competitor_comment_health(...)` | MG8 (em produção) | idem |
| `competitor_agenda_runs` e o despachante | MG10 (em produção); código do lote B só local | a tarefa `tamanho_do_banco` é uma entrada do catálogo |
| `can_edit_site(uuid)`, `is_member_staff()` | schema base | as três policies de leitura |
| `audit_log` (sem gatilho, `actor_user_id` anulável, `resource_id uuid`) | schema base (lido no banco local) | uma linha por canal removido; `resource_id` = id do canal |

A MG6 **recusa** na primeira instrução se alguma dessas sete funções não existir, e não cria nada (rodado: seção 11).

### 0.2 Dependência de código

**O código do lote B (agenda, leitura horária, comentários) tem de estar em produção antes do código da E10.** A tarefa `tamanho_do_banco` é uma entrada do catálogo da agenda, e a pausa edita arquivos do lote B (`agenda/executar.ts`, `horaria/gravar.ts`, `horaria/lista.ts`). Esses arquivos hoje só existem no HEAD local. Se o controlador quiser a E10 antes do lote B, só a Tarefa 1 (migration) e as Tarefas 2, 5, 6, 7, 8, 10, 11a e 12 podem ir; as Tarefas 3, 4a, 4b e 9 esperam.

### 0.3 Avisos de topo

- **A migration vem antes do código, sem exceção.** O código novo lê `competitor_channels.collection_paused_at` nas duas consultas que alimentam toda a coleta de concorrentes. Sem a MG6, a guarda de schema para a coleta em vermelho com "migration MG6 não aplicada" e **as horas da leitura horária desse intervalo não são recuperadas**. A ordem e a volta estão na seção 2 e na Tarefa 14.
- **(emenda 1: S-C1) Nenhum commit que leia `collection_paused_at` ou registre `tamanho_do_banco` nasce antes de a V1 dar `3, 3, 2, 17, 4, 4, true, false` em produção.** O `staging` local é um só para todas as trilhas e o envio de qualquer trilha leva todos os commits ancestrais: um commit da Tarefa 4b feito hoje iria a produção no push da A4, da E11 ou da E6/E8, antes da MG6, e a coleta de concorrentes pararia (a proteção da Tarefa 14 só cobre o push da própria E10). Por isso as Tarefas **4a, 4b, 9 e 11b não começam** antes de o ledger da E10 ter a V1 de produção anotada. Também não ficam "prontas e sem commit" na árvore: outra trilha commita os mesmos arquivos por caminho e levaria o trabalho junto. Como a MG6 é inerte para o código antigo (seção 2), o plano **recomenda ao controlador adiantar a vez dela**: a Tarefa 1 e o `db:push:prod` do dono podem ser o primeiro passo da etapa, sem custo. Cinto extra: ao abrir a etapa, o controlador escreve no ledger `.superpowers/sdd/a5-e10/progress.md` a linha `TRAVA E10: nenhum commit das Tarefas 4a, 4b, 9 e 11b antes da V1 em produção`, e o agente dessas tarefas confere a linha da V1 antes do primeiro commit.
- **Enquanto a Tarefa 11b não entrar, o botão "Remover canal" do CMS continua apagando sem export.** A 11b edita `competitors/actions.ts`, que está na zona reservada da A4. O arquivo está limpo no `git status` de 13/10 (as alterações não commitadas da A4 são em `_canal/*`), mas a regra da zona vale: a 11b só começa com o aval do controlador. Até lá o runbook (Tarefa 12) diz ao dono para não remover canal pelo CMS.
- **Nenhum agente escreve no NAS nem roda `confirmar-nas`.** O script recusa `confirmar-nas` quando a entrada não é um terminal e pede o nome do lote digitado. O agente prepara os comandos, curtos, um por linha (subcomando `comandos-nas`, que só imprime).
- **Nenhum comando deste plano carrega `apps/web/.env.local`** (aponta para produção). O script lê a URL do banco de uma variável que o dono exporta no terminal dele (pergunta P1).
- **O arquivo da MG6 não é criado antes da vez dela** (o `db:new` carimba pela hora, e um arquivo criado cedo entraria no próximo `db:push:prod` de outro lote). Até lá o SQL vive no Apêndice A e a prova é o roteiro do Apêndice B.
- **Texto de exceção do banco não sai das funções deste plano para tela, nota, e-mail nem Sentry.** As funções da MG6 lançam com o prefixo `E10:<codigo>:`; o código TypeScript lê só o código e escreve a frase de um catálogo fechado.
- **Comentários de terceiros vão para o arquivo; a identidade do autor, não** (decisão 20). Detalhe na seção 6.3.

---

## 1. Perguntas que só o dono responde

Nenhuma trava o início. Cada uma tem a recomendação e o padrão que vale se ele não responder (decisão 44); o plano segue com o padrão.

| # | Pergunta | Recomendação e PADRÃO | O que trava |
|---|---|---|---|
| P1 | Com qual credencial o `exportar` lê o banco de produção? | Conexão direta do Postgres, com a URL numa variável `OBS_ARQUIVO_DB_URL` que **o dono** exporta no terminal dele (senha do chaveiro). Só a conexão direta garante a sessão fixa (`time zone 'UTC'`, `extra_float_digits = 3`) e uma leitura num retrato único do banco. **Padrão: essa.** O agente nunca vê a senha; em produção, `exportar` e `conferir` rodam no terminal do dono | só o ensaio em produção (Tarefa 13). Código, testes e ensaio no banco local não esperam |
| P2 | Banco amarelo ou vermelho deixa o **cron** vermelho? | Não. Uma condição que dura meses deixaria o cron vermelho o tempo todo e esconderia as outras falhas. **Padrão:** a frase vai em `acao_do_dono` a cada disparo e sai um e-mail (um por mês no amarelo, um por semana no vermelho). Cron vermelho só para "tamanho sem medida há mais de 72 h" e, pela emenda 1 (S-I2), para leitor do sinal quebrado de forma permanente (seção 4.5) | nada |
| P3 | Depois de remover um canal com lote confirmado, apagar as miniaturas dele do Blob? | Sim: são imagens de terceiros em URL pública, e a cópia está no NAS. **Padrão: sim**, logo depois da remoção; o que falhar fica registrado como pendência visível e não se perde | nada (hoje a remoção já deixa as miniaturas órfãs e públicas) |
| P4 | Idade de corte do arquivo (pergunta 2 do spec) | 12 meses. **Padrão: `RULES.archiveCutMonths = 12`.** Nesta fase o número só alimenta a sugestão de canal parado | nada |
| P5 | Quem pode pausar, despausar e confirmar a cópia no NAS? | Só quem administra o site (`org_admin` da organização do site ou da organização raiz). **Padrão: isso**, conferido dentro das funções do banco; o comando recebe `--por <e-mail>` | nada |
| P6 | Nome do lote de uma remoção de canal | **Padrão:** `canal-<8 primeiros caracteres do id>-<AAAA-MM-DD>`, gerado pelo script; o dono pode passar outro com `--lote` | nada |
| P7 | Quer uma trava no banco que impeça apagar `competitor_channels` fora do caminho com arquivo? | Não agora: a trava quebraria o botão do CMS no instante em que a MG6 fosse aplicada, antes de o código novo chegar, e bloquearia a resposta "apagar" da fila (E9). **Padrão: sem trava no banco**; quem garante é a ação do CMS (Tarefa 11b) e o teste da lista fechada | nada |
| P8 | Mockups a pedir à E13 além do 18 | Quatro peças: 18 (aviso de banco e lotes não confirmados), pastilha "coleta pausada" com despausar, passo "exportar antes" no diálogo de remover, seção "Sugestões". **Padrão: pedir as quatro** | as telas, que não são deste plano |

---

## 2. O que é do dono

**Uma coisa: aplicar a MG6.** Nenhum agente roda `db:push:prod`.

| Passo | Quem | O quê |
|---|---|---|
| 0 | controlador | roda as conferências C1 a C12 da seção 3.2 (emenda 1: S-I3, D-m11) (só leitura) e anota no ledger `.superpowers/sdd/a5-e10/progress.md` |
| 1 | controlador | avisa que chegou a vez da MG6 |
| 2 | agente (Tarefa 1) | `npm run db:new observatorio_a5_e10_export_pausa_e_limite`; confere que o carimbo é posterior a `20261013000003`; cola o Apêndice A; roda o roteiro do Apêndice B duas vezes. Commit local |
| 3 | **dono** | `npm run db:push:prod` (digita `YES`) |
| 4 | agente | V1 a V5 em produção (só leitura), resultado no ledger |
| 5 | agente | push do código (Tarefa 14), promoção fora de 11:55 a 12:15 UTC |
| 6 | **dono** (com o agente preparando) | o ensaio de ponta a ponta do item 82 (Tarefa 13) |

**Nome para o `db:new`:** `observatorio_a5_e10_export_pausa_e_limite`. Uma migration só. Pode ir no mesmo `db:push:prod` da MG4 (o spec permite), em qualquer ordem entre as duas. **(emenda 1: D-I1)** A ordem é livre **porque** a tabela que a MG4 cria (`competitor_video_marks`, com cascata para `competitor_videos`: `04-medidas-telas-e-mockups.md:29-41`) já está no registro do export da MG6. Sem essa entrada, aplicar a MG4 faria `obs_archive_uncovered()` devolver `{competitor_video_marks}` e o export e a remoção passariam a recusar com `tabela_sem_export`. A regra para as próximas migrations está na tabela de arquivos compartilhados da seção 9.

**Janela e travas.** A MG6 cria três tabelas vazias, duas colunas anuláveis sem padrão em `competitor_channels` (alteração só de catálogo: não reescreve a tabela), dezessete funções novas, e recria quatro funções com uma condição a mais. O único bloqueio em tabela com tráfego é o `ACCESS EXCLUSIVE` de `alter table competitor_channels add column`, de milissegundos; `set lock_timeout = '5s'` na primeira linha faz a migration desistir em vez de enfileirar atrás de uma sincronização longa. Recriar função não bloqueia quem a está executando. Aplicar fora dos minutos 0, 20 e 40 de cada hora (o cron de concorrentes) e fora de 11:55 a 12:15 UTC (o cron do canal próprio). Se desistir por `lock_timeout`, nada foi criado: repetir.

**Convive com o código que está em `main`?**
- **MG6 aplicada, código antigo: inerte.** Ninguém lê nem grava as tabelas novas. As duas colunas novas são nulas em todos os canais. As quatro funções remendadas devolvem exatamente o que devolviam enquanto `competitor_collection_pauses` estiver vazia, e só as funções da MG6 gravam nela; o código antigo não as chama. Assinaturas, atributos e privilégios das quatro são preservados (rodado: V1, coluna `remendadas_com_grant_de_4`).
- **Código novo sem a MG6: a coleta de concorrentes para em vermelho.** A guarda de schema acusa "migration MG6 não aplicada" antes de qualquer chamada à API; nada é gravado pela metade. É por isso que a ordem não inverte.
- **MG6 sem as migrations de que depende:** recusa na primeira instrução (rodado).

### Consultas de conferência (rodadas no banco local `bythiago_int` em 13/10, com a MG6 aplicada duas vezes dentro de `begin; … rollback;`)

**V1: a migration entrou inteira?** Esperado: **3, 3, 2, 17, 4, 4, true, false**. (Em produção, hoje, antes: 0, 0, 0, 0, 0, 4, true, false.)

```sql
select (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and c.relname in ('obs_archive_batches','competitor_collection_pauses','obs_db_size_daily')) as tabelas_rls_de_3, (select count(*) from pg_policies where schemaname='public' and tablename in ('obs_archive_batches','competitor_collection_pauses','obs_db_size_daily') and cmd='SELECT') as policies_de_3, (select count(*) from information_schema.columns where table_schema='public' and table_name='competitor_channels' and column_name in ('collection_paused_at','collection_paused_by')) as colunas_de_2, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('obs_db_size_record','obs_archive_is_site_admin','competitor_channel_pause_covers','competitor_channel_pause','competitor_channel_unpause','obs_archive_registry','obs_archive_excluded','obs_archive_uncovered','obs_archive_channel_counts','obs_archive_diff','obs_archive_register','obs_archive_guard','obs_archive_verify','obs_archive_confirm_nas','competitor_channel_remove_archived','obs_archive_blobs_done','competitor_archive_suggestions') and not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute') and has_function_privilege('service_role', p.oid, 'execute')) as funcoes_so_service_role_de_17, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('competitor_series_health','competitor_hourly_health','competitor_comment_due','competitor_comment_health') and p.prosrc like '%competitor_channel_pause_covers%') as remendadas_de_4, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('competitor_series_health','competitor_hourly_health','competitor_comment_due','competitor_comment_health') and not has_function_privilege('anon', p.oid, 'execute') and has_function_privilege('service_role', p.oid, 'execute')) as remendadas_com_grant_de_4, (select p.prosrc !~* 'delete' from pg_proc p where p.oid='public.yt_reporting_blobs_purge(text[])'::regprocedure) as limpeza_do_bruto_sem_delete, (select has_table_privilege('anon','public.obs_db_size_daily','select') or has_table_privilege('authenticated','public.obs_archive_batches','insert') or has_table_privilege('authenticated','public.competitor_collection_pauses','delete')) as privilegio_indevido;
```

**V2: o export cobre toda tabela que some com um canal?** Esperado: `{}` (lista vazia) e `20` (emenda 1: D-I1: as 19 tabelas que existem hoje mais `competitor_video_marks`, que só passa a existir com a MG4; o esperado é o mesmo antes e depois da MG4, e a V2 é rodada de novo depois de toda migration que crie tabela com cascata para canal, vídeo ou comentário de concorrente). Uma tabela na lista = existe em produção uma tabela com chave estrangeira em cascata para o canal que o registro não conhece: **não seguir**; acrescentar ao registro (nova migration) ou à lista de exclusão, com o motivo.

```sql
select public.obs_archive_uncovered() as sem_export, (select count(*) from public.obs_archive_registry()) as tabelas_no_registro;
```

**V3: nada foi gravado pela migration e a pausa está desligada em todos os canais.** Esperado: `0, 0, 0, 0`.

```sql
select (select count(*) from public.obs_archive_batches) as lotes, (select count(*) from public.competitor_collection_pauses) as pausas, (select count(*) from public.obs_db_size_daily) as medidas, (select count(*) from public.competitor_channels where collection_paused_at is not null) as canais_pausados;
```

**V4: as provas respondem o mesmo que antes** (rodar uma vez ANTES de aplicar e uma DEPOIS, com o mesmo instante fixo, e comparar). Esperado: as duas saídas iguais, byte a byte. Rodado no banco local: `8b5fefe80ec8dae428b2972d8ac8e550` antes e depois (o valor de produção é outro; o que importa é a igualdade). Diferença = o remendo mudou a resposta sem pausa nenhuma: parar e avisar.

```sql
select md5(string_agg(public.competitor_series_health(s.site_id, timestamptz '2026-10-13 12:00+00')::text || public.competitor_hourly_health(s.site_id, timestamptz '2026-10-13 12:00+00', 14, 25)::text, '|' order by s.site_id)) from (select distinct site_id from public.competitor_channels) s;
```

**V4b (emenda 1: D-m2, S-M6): as duas funções de comentários também respondem o mesmo.** Mesma regra da V4 (antes e depois, iguais). **Escrita na emenda 1 e ainda não rodada:** a Tarefa 1 roda as duas vezes no `bythiago_int` antes de alguém usar em produção, e corrige aqui se a consulta não rodar. Os argumentos são os do roteiro 2 do Apêndice B.

```sql
select md5(string_agg(public.competitor_comment_health(s.site_id, timestamptz '2026-10-13 12:00+00', '[{"mark":1,"from_h":20,"until_h":36}]'::jsonb, 28, interval '2 hours', null)::text || (select coalesce(string_agg(d::text, ',' order by d::text), '') from public.competitor_comment_due(timestamptz '2026-10-13 12:00+00', '[{"mark":1,"from_h":20,"until_h":36}]'::jsonb, interval '20 hours', 10000, '{}', interval '15 minutes', null, s.site_id) d), '|' order by s.site_id)) from (select distinct site_id from public.competitor_channels) s;
```

**Cuidado ao ler a V4 e a V4b em produção (emenda 1).** A coleta grava a cada 20 minutos. Rodar o "antes" e o "depois" dentro do mesmo intervalo entre dois disparos (fora dos minutos 0, 20 e 40) e com poucos minutos entre um e outro. Uma diferença pode ser gravação nova, e não o remendo: antes de parar, rodar o "depois" mais uma vez; se as duas rodadas de "depois" também diferirem entre si, a diferença é da coleta e a comparação é refeita no intervalo seguinte. Não está medido se as quatro funções ignoram linhas gravadas depois de `p_now`.

**Tempo das quatro funções (emenda 1: D-m3, S-M6): medida pendente.** `competitor_channel_pause_covers` tem `set search_path`, então o Postgres não a embute: é uma chamada por linha de vídeo dentro de provas que têm teto de 3 s e rodam 72 vezes por dia. A Tarefa 1 roda a V4 e a V4b com `\timing`, antes e depois de aplicar, no `bythiago_int`, com uma semente de 75 canais (`RULES.channelLimit`) e o número de vídeos por canal da C4, e anota os oito tempos no ledger e na seção 5.2. O que muda: depois acima de 1 s em qualquer uma (um terço do teto), a condição do bloco 10 passa de chamada de função para o `exists` escrito por extenso na âncora (mesmo resultado, sem a chamada por linha), em emenda própria e rodada.

**V5: coerência entre a coluna e o histórico de pausas** (rodar em qualquer dia). Esperado: `0`. Diferente de zero = alguém gravou a coluna fora das funções.

```sql
select count(*) from public.competitor_channels c where (c.collection_paused_at is not null) is distinct from exists (select 1 from public.competitor_collection_pauses p where p.competitor_channel_id = c.id and p.resumed_at is null);
```

---

## 3. Fatos medidos, e o que falta medir

### 3.1 Fatos de que o desenho depende

| # | Fato | Fonte |
|---|---|---|
| F1 | Nada de E10 existe no código nem nas migrations. `tamanho_do_banco` só aparece como tarefa fictícia de fixture | `grep` em 13/10; `apps/web/test/youtube/agenda/despachante.test.ts:41` |
| F2 | O catálogo real da agenda tem cinco tarefas, ordens 1, 2, 6, 7 e 8; o vigia percorre `TODAS_AS_DEFINICOES` sozinho | `agenda/definicoes.ts`, `agenda/saude.ts`; `test/youtube/agenda/catalogo.test.ts:170-171` |
| F3 | O contrato de tarefa: `motivo` é código de catálogo, `detalhe` é só número, `extra` é descartado da resposta; texto de fora só cabe em `acao_do_dono` e `notas` | `agenda/tipos.ts:34-41`, `agenda/executar.ts:308-317` |
| F4 | Toda sincronização de um canal (lote, fase semanal, ações manuais do CMS, primeira sincronização) passa pela trava de `runChannel`: um `update … where sync_status <> 'syncing' …` que devolve zero linhas quando não toma a trava, e o resultado é `skipped: true` | `competitor-sync.ts:211, 300-316` |
| F5 | A lista da leitura horária lê `competitor_videos` com o canal embutido (`competitor_channels!inner(site_id, missing_since)`) e `montarLista` já conta o que tira em `fora` | `horaria/gravar.ts:123, 138-162`, `horaria/lista.ts:108-121` |
| F6 | A fila de retratos de comentário é escolhida **no banco** por `competitor_comment_due` | MG8, `observatorio/comentarios/gravar.ts:172` |
| F7 | **Quatro funções do banco escolhem ou cobram vídeo por canal** e hoje só excluem canal ausente: `competitor_series_health`, `competitor_hourly_health`, `competitor_comment_due`, `competitor_comment_health`. Um canal pausado deixaria o cron vermelho (série diária sem ponto, horas não lidas, retratos atrasados) e a fila de comentários gravando nele. `competitor_capture_health` não cobra leitura recente de canal: fica como está | corpos lidos no banco local em 13/10 (`pg_get_functiondef`) |
| F8 | Dezenove tabelas somem em cascata com um canal de concorrente. Três chaves são `set null`: `competitor_changes.from_version_id` e `to_version_id` (mesmo canal), `competitor_readings.task_id` (mesmo canal) e **`competitor_video_comments.featured_channel_id`**, que aponta para o canal de quem comentou e por isso é anulada em comentários de OUTROS canais | `pg_constraint` no banco local em 13/10 |
| F9 | `competitor_channel_id` é `not null` em `competitor_field_versions`, `competitor_raw`, `competitor_video_comment_snaps` e `competitor_video_comments`; `competitor_videos` não tem `site_id` (o site vem do canal) | `information_schema.columns` no banco local |
| F10 | `audit_log` não tem gatilho nem `check`; `actor_user_id` é anulável; as linhas que existem no banco local têm ator nulo | `pg_constraint` e `pg_trigger` no banco local |
| F11 | `removeCompetitorChannel` apaga com um `delete` em `competitor_channels` filtrado por `id` e `site_id`; nenhum código apaga os arquivos de `observatorio/thumbs/` no Blob | `competitors/actions.ts:152-168`; `grep` por `observatorio/thumbs` |
| F12 | `competitor_channels` só tem policies de `select`, `insert` e `delete`: quem atualiza é o cliente de serviço | `20260531000008_competitor_observatory.sql:34-40` |
| F13 | `pg` 8.13.1 e `@types/pg` são dependências de `apps/web`; `pg-copy-streams` não está instalado; `tsx` está na raiz; o precedente de comando fino é `scripts/e19-janela.ts` | `apps/web/package.json:109,116`; `ls node_modules` |
| F14 | As três leituras de quem lê as provas respondem a cada disparo (a cada 20 minutos): uma prova vermelha por causa de um canal pausado seria vermelha 72 vezes por dia | `agenda/fecho.ts` |
| F15 | O aviso por e-mail da agenda deduplica por (chave, tarefa, site, **dia**) | `agenda/aviso.ts:31-32` |
| F16 | Tamanho do banco em 12/10: 170,7 MB, dos quais 68,7 MB são `yt_own_video_daily` antes da dieta | spec, 9.6 (medido em produção em 12/10) |
| F17 | Funções instaladas com `delete from` cujo nome começa por `competitor_`, `yt_`, `youtube_channel_` ou `obs_` (banco local, com a MG6): `competitor_agenda_lease_release`, `competitor_comment_identity_purge`, `youtube_channel_remove`, `yt_own_daily_apply`, `yt_own_dim_apply`, `yt_own_dim_cover_idle`, `yt_own_dim_coverage_extend`, `yt_own_reach_dim_apply`, `yt_own_traffic_detail_apply`, e as duas da MG6 (`obs_archive_register`, `competitor_channel_remove_archived`) | consulta em `pg_proc` no banco local em 13/10 |
| F18 | `.delete()` no código do escopo do item 231 e vizinhos: `coleta/alerts.ts:89`, `app/api/cron/sync-analytics-metrics/route.ts:608`, `competitors/actions.ts:162`, `lib/pipeline/services/forja-queue.ts:246, 422, 439` | `grep` em 13/10 |

### 3.2 Conferências pendentes (só produção responde; o controlador roda; todas são só leitura)

Nenhum destes números foi medido por este plano. Cada linha diz o que muda conforme a resposta.

| # | Pergunta | Comando | O que muda |
|---|---|---|---|
| C1 | As âncoras do remendo existem em produção, uma vez em cada função? | `select p.proname, (length(p.prosrc) - length(replace(p.prosrc, a.ancora, ''))) / length(a.ancora) as vezes from (values ('competitor_series_health', 'or v.missing_since is not null or c.missing_since is not null'), ('competitor_hourly_health', 'and v.missing_since is null and c.missing_since is null'), ('competitor_comment_due', 'and v.missing_since is null and c.missing_since is null and v.published_at is not null'), ('competitor_comment_health', 'and v.missing_since is null and c.missing_since is null and v.published_at is not null')) as a(nome, ancora) join pg_proc p on p.proname = a.nome and p.pronamespace = 'public'::regnamespace order by 1;` | Esperado: quatro linhas com `1` (é o que o banco local dá, rodado em 13/10). Outro número = o corpo de produção difere do local: a MG6 recusaria sozinha, mas é melhor saber antes. Conferir o corpo e ajustar a âncora no Apêndice A |
| C2 | Tamanho do banco hoje, e o painel conta o mesmo? | `select pg_database_size(current_database()) as db_bytes;` e, **(emenda 1: D-m12)** `select sum(pg_database_size(datname)) as todos_os_bancos from pg_database;` (se esta segunda der erro de permissão, anotar o erro: é resposta). Comparar as duas com Supabase, Settings, Usage, Database size | Se o painel mostrar mais que `pg_database_size`, os limiares de `RULES.dbSize` descem na mesma proporção (constante, sem migration) e o runbook registra a diferença. Se o painel bater com a soma de todos os bancos e não com o banco corrente, uma migration pequena e posterior acrescenta essa soma a `obs_db_size_daily`; a MG6 não a grava agora porque não está medido se o papel dono da função pode ler o tamanho dos outros bancos, e um erro ali derrubaria a medida de todo dia |
| C3 | As maiores relações (de onde vêm os "20 MB por ano do site") | `select n.nspname, c.relname, pg_total_relation_size(c.oid) as bytes from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind in ('r','m') order by 3 desc limit 30;` | Os prefixos de `own_bytes` (hoje `yt_own_` e `yt_reporting_`). A partir do deploy a mesma lista fica gravada por dia em `top_relations` |
| C4 | Linhas e bytes das tabelas de concorrente, e vídeos por canal | `select c.relname, c.reltuples::bigint as linhas, pg_total_relation_size(c.oid) as bytes from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'competitor\_%' order by 3 desc;` | A tabela da OP-9 (seção 5.4) é refeita com o tamanho de linha medido |
| C5 | As chaves estrangeiras para canal e vídeo de concorrente são as do banco local? | `select conrelid::regclass::text as tabela, confrelid::regclass::text as aponta_para, confdeltype::text from pg_constraint where contype = 'f' and confrelid in ('public.competitor_channels'::regclass, 'public.competitor_videos'::regclass, 'public.competitor_video_comments'::regclass) order by 2, 1;` | Tabela a mais = a V2 acusa depois de aplicar; saber antes evita aplicar duas vezes |
| C6 | Quais migrations do lote B estão aplicadas | `select version from supabase_migrations.schema_migrations order by version desc limit 8;` | Sem `20261013000001` a `…003` a MG6 recusa |
| C7 | O corpo da limpeza do bruto é o da MG13 | `select prosrc from pg_proc where oid = 'public.yt_reporting_blobs_purge(text[])'::regprocedure;` | Se não for `return 0`, a E20 não está como se supõe: a E10 não começa |
| C8 | Miniaturas guardadas, por canal | `select v.competitor_channel_id, count(distinct x.thumb_blob_url) as miniaturas from competitor_video_versions x join competitor_videos v on v.id = x.video_id where x.thumb_blob_url is not null group by 1 order by 2 desc;` | O tempo do `exportar` por canal e o espaço da pasta local (seção 5.3) |
| C9 | Quem é `org_admin` do site | (emenda 1: D-m13) `select om.user_id, u.email, om.org_id, o.parent_org_id, (select array_agg(s.id) from sites s where s.org_id = om.org_id) as sites_da_org from organization_members om join auth.users u on u.id = om.user_id join organizations o on o.id = om.org_id where om.role = 'org_admin';` | O e-mail que o dono passa em `--por` (P5). Só serve quem é `org_admin` da organização do site (o site aparece em `sites_da_org`) ou de uma organização raiz (`parent_org_id` nulo): é a regra de `obs_archive_is_site_admin`. Nenhuma linha assim = ninguém consegue pausar: avisar antes do ensaio |
| C10 | (emenda 1: S-I3, D-I5) Qual é o teto de tempo de uma instrução para cada papel? | `select rolname, rolconfig from pg_roles where rolname in ('authenticator', 'service_role', 'postgres');` | É o teto da remoção quando ela vem do CMS (cliente de serviço, pela API do banco) e de `competitor_archive_suggestions`. Comparar com o tempo medido na Tarefa 1 (seção 5.2). Teto menor que três vezes o tempo medido para um canal de um ano: a remoção **só** pelo subcomando `remover` (conexão direta, com o teto que ele mesmo declara) e a Tarefa 11b passa a mostrar a frase que manda usar o comando, sem chamar a função. Teto folgado: os dois caminhos valem. Sem resposta: vale o caminho do comando, que não depende do número |
| C11 | (emenda 1: D-m11) Quanto ocupa o bruto dos relatórios, que com o desvio D1 fica para sempre? | `select count(*) as brutos, sum(octet_length(csv_gz)) as bytes from public.yt_reporting_report_blobs;` | Uma linha de MB por ano na seção 5.4 (dividir os bytes pelos dias entre o bruto mais antigo e hoje). Se a coluna não se chamar `csv_gz` em produção, a consulta falha: anotar e medir por `pg_total_relation_size('public.yt_reporting_report_blobs')` |
| C12 | (emenda 1: D-m11) `audit_log` em produção tem gatilho ou chave que o banco local não tem? | `select tgname, pg_get_triggerdef(oid) from pg_trigger where tgrelid = 'public.audit_log'::regclass and not tgisinternal;` e `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.audit_log'::regclass;` | O F10 foi lido só no banco local. Gatilho ou chave para `auth.users` em produção: o `insert` da remoção tem de respeitar (a falha seria segura, a transação é desfeita, mas apareceria só no ensaio). Ajustar o `insert` do Apêndice A antes de aplicar |

---

## 4. Desenho, no que difere de "copiar o spec"

### 4.1 A pausa tem dois lugares no banco: o estado e o histórico

O spec pede duas colunas em `competitor_channels` (`collection_paused_at`, `collection_paused_by`). Elas dizem "está pausado agora" e somem quando o canal é despausado. Este plano acrescenta a tabela `competitor_collection_pauses` (uma linha por pausa, com início, fim e quem), por dois motivos medidos:

1. **Sem o histórico, despausar deixa o cron vermelho.** A prova da série cobra "buraco na série diária nos últimos 3 dias"; a da leitura horária cobra "menos de 20 horas lidas nas últimas 24"; a de comentários cobra "janela que fechou nos últimos 7 dias sem retrato". Os dias de pausa são buraco de verdade, e sem saber que houve pausa as três provas ficariam vermelhas por 3 dias, 26 horas e 7 dias depois de despausar.
2. **O intervalo sem coleta é dado que a origem não devolve.** Um canal despausado tem dias sem linha; só o histórico permite a tela dizer "sem coleta de dd/mm a dd/mm" em vez de mostrar um buraco.

As duas colunas e a tabela são gravadas **só** por `competitor_channel_pause` e `competitor_channel_unpause` (não existe policy de `update` em `competitor_channels`; o cliente de serviço só chama as funções). A V5 confere a coerência.

### 4.2 Onde a pausa é aplicada (cinco pontos, um por caminho de gravação)

| Caminho | Onde | Como |
|---|---|---|
| Sincronização de um canal (lote, ações manuais, primeira sincronização) | a trava de `runChannel` em `competitor-sync.ts` | o `update` que toma a trava ganha `.is('collection_paused_at', null)`: canal pausado não é travado, o resultado é `skipped: true` com `paused: true`. É atômico: vale mesmo se o lote leu a lista antes de a pausa ser gravada |
| Leitura semanal de um canal | a leitura de estado de `runChannel` no modo `weekly` | lê a coluna e devolve `skipped: true, paused: true` |
| Escolha dos canais devidos (lote e fase semanal) | `competitor-sync-batch.ts` | `semPausados(linhas)` antes de escolher: canal pausado não é devido, não conta como "sobrou" nem como dívida semanal |
| Leitura horária | `horaria/gravar.ts` e `horaria/lista.ts` | a coluna vem embutida no canal; `montarLista` tira o vídeo e conta em `fora.pausado` |
| Retratos de comentários | `competitor_comment_due` (banco) | condição acrescentada pela MG6 |

O que **não** é pausado, de propósito: a anulação de identidade aos 28 dias (obrigação de LGPD; ela não muda a contagem de nenhuma tabela exportada) e a leitura do cadastro de canais para identificar autor de destaque (não é coleta).

### 4.3 As quatro funções ganham uma condição por remendo sobre o corpo instalado

A MG6 não copia o corpo de nenhuma das quatro. Um bloco `do` lê o corpo instalado com `pg_get_functiondef`, troca uma âncora de texto por "âncora mais uma condição" e executa. Motivos: (a) três planos já brigaram por causa de corpo copiado (decisão R1 do plano da E11): copiar quatro corpos de MG2b, MG9 e MG8 para a MG6 apagaria qualquer correção que entrasse neles depois; (b) o remendo recusa e desfaz a migration se a âncora não aparecer exatamente uma vez (rodado); (c) função já remendada é pulada (idempotente, rodado).

A condição chama `competitor_channel_pause_covers(canal, agora, cauda)`: verdadeiro se o canal está pausado ou foi despausado há menos que a cauda. Caudas: série 3 dias, leitura horária 26 horas, saúde dos comentários 7 dias, fila de comentários 0 (a fila volta no instante em que o canal é despausado).

**O que acontece se outra migration recriar uma das quatro sem a condição** (E9, E4 e a parte 2 da E15 mexem nessa vizinhança): `competitor_channel_pause` confere, a cada chamada, que as quatro contêm a chamada, e **recusa pausar** com o nome da função que perdeu o remendo. Não há pausa silenciosa com prova vermelha. O conserto é reaplicar o bloco 10 do Apêndice A numa migration nova.

### 4.4 O export é um retrato único, e o banco confere três vezes

- **Leitura:** uma transação `repeatable read read only`, com `time zone 'UTC'`, `extra_float_digits = 3`, `datestyle = 'ISO, YMD'`, `intervalstyle = 'postgres'` e `bytea_output = 'hex'`. Toda coluna é lida como texto (`coluna::text`), em ordem de chave, por cursor de 5.000 linhas. O CSV é escrito pelo script (sem dependência nova): nulo é campo vazio sem aspas, texto vazio é `""`, e o `\copy … csv header` do Postgres relê os dois corretamente.
- **O que o export cobre vem do banco:** `obs_archive_registry()` lista as 20 tabelas (emenda 1: D-I1: as 19 que existem hoje e `competitor_video_marks`, da MG4, pulada pela contagem e listada em `tabelasAusentes` do manifesto enquanto não existir), o filtro por canal, a coluna do mês e a coluna somada. O script e as funções de conferência leem a **mesma** lista. `obs_archive_uncovered()` compara essa lista com as chaves em cascata do catálogo do Postgres; tabela nova sem export faz `exportar` e a remoção recusarem (uma etapa futura que crie tabela por canal é pega em tempo de execução, não só em teste).
- **Conferência 1 (no registro, passo 1):** `obs_archive_register` compara as linhas e a soma de cada arquivo com `obs_archive_channel_counts(canal)` e recusa registrar o que não bate.
- **Conferência 2 (`conferir`, passo 2):** no disco, refaz o sha256 de todo arquivo e de toda miniatura, descomprime, conta registros, refaz a soma. No banco, relê cada tabela e mês com a mesma consulta e compara o **sha256 do CSV sem compressão**: igualdade de conteúdo, não só de contagem. Depois chama `obs_archive_verify`, que reconta.
- **Conferência 3 (remoção, passo 4):** `competitor_channel_remove_archived` trava a linha do canal, as dos vídeos e as dos comentários (`for update`), o que impede qualquer linha filha nova de entrar (a chave estrangeira de quem insere precisa de uma trava que conflita), reconta, compara com o registro e só então apaga. Depois de apagar, confere que não sobrou linha em nenhuma tabela do registro. Qualquer diferença lança, e a transação inteira é desfeita.

Não há trava de tabela em lugar nenhum: só travas de linha do canal que está sendo removido.

### 4.5 O sinal de limite

- **A medida** é a tarefa `tamanho_do_banco` (leve, ordem 4, a partir das 05:00 de São Paulo, tolerância de 36 h no vigia), que chama `obs_db_size_record`: grava a linha do dia (`on conflict (day) do update`: a última medida do dia vale) com `pg_database_size`, a soma das tabelas `competitor_*`, a soma de `yt_own_*` e `yt_reporting_*`, e as 30 maiores relações (`top_relations`, que responde "de onde vem o crescimento" comparando dois dias).
- **O "dia de leitura"** começa às 05:00 de São Paulo: é a data de São Paulo de (agora menos 5 horas). Antes das 05:00 o dia esperado ainda é o de ontem, então a madrugada não acusa "sem leitura hoje" por engano.
- **O veredito** é uma função pura (`sinalDoBanco`) lida a cada disparo, **depois** das tarefas (a medida das 05:00 já está gravada quando o sinal é lido), em paralelo com as provas e sob o teto de 3 s.
- **Regras:** amarelo a partir de 350 MB; vermelho a partir de 425 MB ou com a projeção chegando a 500 MB em menos de 90 dias; projeção = reta de mínimos quadrados das medidas dos últimos 28 dias, e "não medida" com menos de 14 medidas nesse intervalo; reta parada ou descendo = "sem crescimento" (nunca vermelho pela projeção). 1 MB = 1.048.576 bytes.
- **Sem a linha do dia de leitura:** o estado é `sem_leitura_hoje`, a frase diz a data e o valor da última medida, e a cor nunca é verde (fica a cor da última medida se era amarela ou vermelha; senão, sem cor).
- **Para onde vai:** o campo novo `banco` da resposta do cron; uma linha em `acao_do_dono` quando amarelo, vermelho ou sem leitura; e-mail (P2). Cron vermelho só com mais de 72 h sem medida.
- **(emenda 1: S-I1) O sinal é lido nos dois caminhos do cron.** Com `OBS_AGENDA=off`, ou com a guarda da MG10 falhando, a agenda não roda e o lote antigo coleta no lugar. Nesse caminho o sinal e as pendências também são lidos (emenda 2: N1: por `lerArquivoSemAgenda`, função separada que a rota chama logo depois de `rodarAntesDoLoteAntigo`; o contrato desta última não muda) e a regra das 72 h vale igual. A medida **não** entra na lista que roda antes do lote antigo: essa lista só aceita tarefa `nuncaDesliga` (`agenda/executar.ts:176`), e `tamanho_do_banco` tem interruptor de propósito. Consequência escrita: agenda desligada por mais de 72 h deixa o cron vermelho com "tamanho do banco sem medida", que é verdade.
- **(emenda 1: S-I2) Leitor do sinal que falha.** Causa que não passa sozinha (`forma_invalida`, `schema_ausente`) é **vermelho** já no primeiro disparo. Causa transitória (`prazo`, `erro_do_banco`, `excecao`) é nota; e, se a tarefa `tamanho_do_banco` tem `ok` nas últimas 36 h (a medida existe e o aviso não sai), a frase vai também para `acao_do_dono`. Isso afina o padrão da P2: o cron fica vermelho por falta de medida há mais de 72 h **ou** por leitor quebrado de forma permanente; nunca pela cor do banco. **(emenda 2: S-m3)** No caminho sem agenda `tamanhoOkHa36h` é sempre `null` e a medida não roda: ali, sinal não lido **por qualquer causa** vai também para `acao` (campo `acao_do_dono_arquivo`), a cada disparo, para a falha repetida não ficar só em nota.

### 4.6 O que o plano entrega para as telas que ainda não existem

Dois leitores de servidor, sem componente: `lerAvisoDoArquivo` (o sinal, os lotes exportados e não confirmados, os canais pausados, as miniaturas pendentes) e `lerSugestoes` (canais sem publicar há `RULES.archiveCutMonths` meses, com última publicação, vídeos, linhas e uma estimativa de espaço marcada como estimativa). Quem chamar os dois já tem de ter passado por `requireEditAccess`; eles usam o cliente de serviço e filtram por `site_id` recebido.

**(emenda 1: D-I1, D-I3) Pendências do arquivo, lidas a cada disparo.** Um terceiro leitor, `lerPendenciasDoArquivo`, roda em paralelo com o do sinal e responde duas coisas que hoje só apareceriam no dia da remoção: (a) `obs_archive_uncovered()` não vazio (tabela nova com cascata e sem export): linha "arquivo: N tabela(s) sem export: <nomes>" em `acao_do_dono`, todo disparo, até uma migration recriar o registro; (b) miniaturas de canal removido ainda no Blob: a tarefa diária tenta apagar de novo (Tarefa 11a) e, passados `RULES.archive.blobPendingAlertDays` dias da remoção, sai a linha "N miniatura(s) de canal removido ainda públicas há D dias", (emenda 2: D-m3) seguida de "; a tarefa diária apaga até 200 por dia: no ritmo normal faltam K dia(s)", com K = N dividido por `RULES.archive.blobRetryMaxPerDay`, arredondado para cima. Fila andando = N cai de um dia para o outro; N parado = está falhando. O plano não guarda o resultado da tentativa anterior, então a frase dá os dois números e não afirma qual dos dois casos é. Nenhuma das duas deixa o cron vermelho. Leitura que falha vira nota "arquivo: não foi possível ler as pendências", nunca "nenhuma pendência".

---

## 5. As contas

### 5.1 Cota e chamadas de API

**Zero chamadas à API do YouTube**, em toda a etapa. A pausa **reduz** o gasto (um canal pausado deixa de ser lido). O `exportar` faz uma requisição `GET` por miniatura ao Blob público, com 4 em paralelo e prazo de 15 s cada; o número por canal é a conferência C8 (o spec fala em 707 miniaturas para 13 canais, cerca de 54 por canal e 38 kB cada: ESTIMATIVA).

### 5.2 Tempo dentro do orçamento do cron

| Onde | Idas ao banco | Pior caso | Contra qual teto |
|---|---|---|---|
| Tarefa `tamanho_do_banco` (uma vez por dia) | 2 (guarda de schema, `obs_db_size_record`) | 10 s (5 s cada, `BANCO_MS`) | `comecaAteMs` 75 s, `fimAteMs` 85 s, dentro de `LEVE_FIM_MS` (90 s) |
| Leitura do sinal (a cada disparo) | 1 | 3 s, **em paralelo** com as provas, que já têm teto mínimo de 3 s | não acrescenta tempo ao fim do disparo |
| Lista de canais com a coluna nova | 0 a mais (mesma consulta) | igual | igual |
| Leitura horária com a coluna embutida | 0 a mais | igual | igual |
| Trava do canal com a condição da pausa | 0 a mais; **1 a mais** só quando a trava não é tomada (para dizer se foi pausa) | 5 s nesse caminho raro | orçamento do canal |
| (emenda 1: S-I1, D-I3) Leitura das pendências do arquivo (a cada disparo) | 2, em paralelo entre si e com o sinal | 3 s | não acrescenta tempo ao fim do disparo |
| (emenda 1: D-I3) Nova tentativa das miniaturas pendentes, dentro da tarefa `tamanho_do_banco` | (emenda 2: S-m1) 1 para a lista, **uma baixa de pendência por lote** e até 2 chamadas ao Blob (200 URLs em blocos de 100) | 20 s **no total**, garantidos por um prazo único em volta da tentativa inteira: o menor entre 20 s e (`fimAteMs` menos agora menos 5 s); **só começa se a medida deu `ok` (emenda 2: D-m2) e se faltarem mais de 25 s para o `fimAteMs`**; senão fica para o dia seguinte e é contada | o mesmo `fimAteMs` de 85 s; a tarefa devolve `ok` antes dele mesmo com o Blob pendurado |
| (emenda 2: S-m9) Caminho sem agenda: sinal e pendências lidos por `lerArquivoSemAgenda` | 3, em paralelo entre si, **em série com o lote antigo e antes dele** | 3 s a menos para o lote antigo (a rota já desconta de `t0`) | o orçamento do lote antigo |
| (emenda 1: S-I3, D-I5) `competitor_channel_remove_archived` (uma instrução: duas recontagens das 20 tabelas, trava de vídeos e comentários, cascata) | 1 | **MEDIDA PENDENTE** (Tarefa 1, teste `tempo da remoção com um ano de dado`); anotar aqui o tempo | pelo comando `remover`: `statement_timeout` de 10 minutos declarado pelo próprio comando; pelo CMS: o teto do papel (C10, não medido) e os 60 s da página (`competitors/page.tsx:19`) |
| (emenda 1: D-I5) `obs_archive_register` e `obs_archive_verify` (uma recontagem das 20 tabelas cada) | 1 | **MEDIDA PENDENTE** (mesmo teste) | conexão direta do `exportar` e do `conferir`: 60 s (`abrirLeitura`); a transação de escrita declara os mesmos 60 s |
| (emenda 1: S-I3) `competitor_archive_suggestions` (uma recontagem por canal parado) | 1 | **MEDIDA PENDENTE** (mesmo teste, com 5 canais parados) | o teto do papel (C10); o leitor devolve `{ porque }` e a tela diz "não foi possível avaliar", nunca lista vazia |
| (emenda 1: D-m3, S-M6) As quatro funções remendadas, antes e depois | 0 a mais | **MEDIDA PENDENTE** (V4 e V4b com `\timing`, 75 canais) | 3 s (`PROOF_MIN_MS`) |

**(emenda 1: D-I5) Chaves sem índice na cascata.** `competitor_changes.from_version_id` e `to_version_id` são `on delete set null` e não têm índice (`20261003000002_observatorio_versoes.sql:43-44`; `grep` por índice nelas nas migrations: nenhum): cada versão apagada varre `competitor_changes`. O plano **não** cria o índice às cegas (é outra tabela, com gravação a cada disparo). Se o tempo medido da remoção passar de 60 s, a Tarefa 1 mede de novo com os dois índices criados dentro do teste e, se a diferença pagar, eles entram na MG6 em emenda própria.

Duas leves no mesmo disparo: `anular_identidade` (a partir das 03:00) e `tamanho_do_banco` (a partir das 05:00) só coincidem se a primeira falhou até as 05:00. O despachante não começa leve depois de 75 s: a segunda vira `adiada` com `sem_tempo` e roda no disparo seguinte (20 minutos), com teto de 12 tentativas no dia. O pior disparo do catálogo completo do spec é 205 s (item 215); com o catálogo desta ordem (horária, duas leves, uma pesada) é menor. O teste do pior disparo roda com o catálogo real (Tarefa 9).

**O que acontece quando estoura:** a tarefa passa de `fimAteMs` e o despachante a encerra com `passou_do_tempo` (vermelho do disparo); tenta de novo no seguinte. A leitura do sinal que passa de 3 s vira nota "banco: não foi possível ler o tamanho" e não muda o veredito.

Os orçamentos acoplados da forja (20 min do claim, 25 min do cron, 30 min do watchdog) **não são tocados**: nenhuma mudança na fila de inteligência.

### 5.3 Volume

| Tabela | Linhas por dia | Linhas por ano | Tamanho (ESTIMATIVA) |
|---|---|---|---|
| `obs_db_size_daily` | 1 | 365 | cerca de 2 kB por linha com `top_relations`: 0,7 MB por ano |
| `competitor_collection_pauses` | 0 (uma por pausa) | dezenas | desprezível |
| `obs_archive_batches` | 0 (só em export) | por canal exportado: cerca de 10 tabelas com mês × meses de dado + 9 arquivos únicos; um canal com 12 meses dá cerca de 130 linhas | cerca de 45 kB por canal exportado; **nunca é apagado** |
| `audit_log` | 0 (uma por canal removido) | unidades | desprezível |

Pasta local de um export (ESTIMATIVA, a confirmar pela C4 e C8): CSV comprimido de um canal de 200 vídeos com um ano de série, de 2 a 6 MB; miniaturas, cerca de 2 MB por canal.

### 5.4 OP-9: quando o banco cruza os 500 MB, de 20 a 200 canais

Refeita com a fórmula e as constantes da seção 9.6 do spec (base 102,7 MB depois da dieta; 31 MB por ano do resto do site; por canal e por ano 7,4, 8,2 e 9,0 MB mais 5,2 MB da leitura horária crua que não é apagada, que é o padrão da pergunta 36; linha de 156 B). Mês contado de outubro de 2026. **ESTIMATIVA: nenhum destes números é medido.** Conferência: com 15 canais a fórmula dá 497 MB no mês 21, o mesmo número do spec.

| Canais | Mês em que cruza 500 MB | Mês em que cruza 350 MB (amarelo) |
|---|---|---|
| 15 (hoje são 13) | 21 a 22 | 13 a 14 |
| 20 | 17 | 10 a 11 |
| 30 | 12 | 7 a 8 |
| 50 | 8 | 5 |
| 75 (o teto `RULES.channelLimit`) | 5 | 3 a 4 |
| 100 | 4 | 2 a 3 |
| 200 | 2 | 1 a 2 |

Duas ressalvas que mudam a leitura: (1) **antes da dieta** (`yt_own_video_daily` com 68,7 MB) o banco está em 170,7 MB, e não em 102,7: o amarelo chega cerca de 4 meses antes do que a tabela diz enquanto a dieta não rodar; (2) o tamanho de linha medido no banco local para a leitura horária foi 170 B, e não 156 B (plano da E15): cerca de 9% a mais nessa parcela. A Tarefa 12 grava esta tabela no runbook e a Tarefa 14 a refaz com a reta medida no D+28 (conferência `e10-d28`).

---

## 6. O que acontece quando o dado não existe, e em cada falha

### 6.1 A medida e o sinal

| Situação | O que o código faz | Veredito | E-mail |
|---|---|---|---|
| MG6 não aplicada (tabela `obs_db_size_daily` ausente) | a tarefa para na guarda, `schema_ausente`, sem chamar a função | **vermelho** ("tamanho do banco: migration não aplicada"); na prática a coleta inteira já está vermelha pela guarda da pausa | não |
| `obs_db_size_record` devolve erro do banco ou passa de 5 s | `medida_falhou`; nada gravado; nova tentativa no disparo seguinte | **vermelho** do disparo; verde quando a tentativa seguinte gravar | não |
| A função devolve nulo, sem `db_bytes`, com `db_bytes` zero ou negativo, ou com `day` diferente do dia de São Paulo | `resposta_invalida` | **vermelho** | não |
| Tabela vazia (primeiro dia, antes das 05:00) | estado `nunca_medido`; frase "banco: sem leitura hoje; nunca foi medido" | linha em `acao_do_dono`; **vermelho só** se a agenda roda há mais de 72 h | não |
| Falta a linha do dia de leitura (tarefa desligada, esgotada, linha apagada) | estado `sem_leitura_hoje`, com a data e o valor da última medida; cor nunca verde | linha em `acao_do_dono`; **vermelho** com mais de 72 h sem medida; o vigia acusa `tamanho_do_banco` atrasada depois de 36 h, pelo nome | o do vigia |
| Menos de 14 medidas nos últimos 28 dias | projeção `nao_medida`, com quantas há; a cor vem só do tamanho | verde, amarelo ou vermelho pelo tamanho | conforme a cor |
| Reta parada ou descendo (dieta, `vacuum full`) | projeção `sem_crescimento` | pelo tamanho | conforme a cor |
| A leitura do sinal falha por causa transitória (`prazo`, `erro_do_banco`, `excecao`) ou passa de 3 s | campo `banco: { nao_lido: <código> }`; nota "banco: não foi possível ler o tamanho" | **nota**; nunca verde escrito; (emenda 1: S-I2) se a tarefa tem `ok` nas últimas 36 h, a frase vai também para `acao_do_dono` (a medida existe e o aviso não está saindo) | não |
| (emenda 1: S-I2) A leitura do sinal falha por causa que não passa sozinha (`forma_invalida`, `schema_ausente`) | campo `banco: { nao_lido: <código> }`; frase "banco: o tamanho está sendo medido, mas não pôde ser lido (<código>)" | **vermelho** já no primeiro disparo | não |
| (emenda 1: D-m1) A última medida tem mais de 29 dias | o leitor traz as 29 linhas mais recentes, seja qual for a data; estado `sem_leitura_hoje` com a data e o valor da última, e a cor dela se era amarela ou vermelha (nunca "nunca foi medido") | linha em `acao_do_dono`; **vermelho** (mais de 72 h) | o do vigia |
| (emenda 1: S-I1) Agenda desligada (`OBS_AGENDA=off`) ou guarda da MG10 falhando | a medida não roda (não é `nuncaDesliga`); o sinal e as pendências são lidos no caminho do lote antigo; (emenda 2: S-m3) sinal não lido, por qualquer causa, vai para nota **e** para `acao_do_dono_arquivo` | linha em `acao_do_dono_arquivo` ("sem leitura hoje"; emenda 2: é o nome do campo neste caminho) a cada disparo; **vermelho** com mais de 72 h sem medida, mesmo com o lote antigo verde. Exceção declarada: banco nunca medido **e** agenda nunca ligada não tem de onde contar as 72 h: fica a linha em `acao_do_dono`, sem vermelho | não |
| Amarelo (350 MB ou mais) | frase com tamanho e projeção em `acao_do_dono` | **nota com ação** | um por mês e por site |
| Vermelho (425 MB ou mais, ou menos de 90 dias) | idem | **nota com ação** (P2: não deixa o cron vermelho) | um por semana e por site |
| Tarefa em `OBS_AGENDA_TASKS_OFF` e esquecida | o vigia mostra "desligada"; o sinal cai em `sem_leitura_hoje`; (emenda 2: S-m7) a nova tentativa das miniaturas pendentes também para, porque mora na mesma tarefa: a linha das miniaturas em `acao_do_dono` continua saindo depois de 3 dias | **vermelho** depois de 72 h (não fica desligada em silêncio) | não |
| A lista de canais não foi lida neste disparo (sites desconhecidos) | o e-mail não tem destinatário neste disparo | a linha em `acao_do_dono` sai do mesmo jeito; o e-mail sai no disparo seguinte | adiado |

### 6.2 A pausa

| Situação | O que o código faz | Veredito |
|---|---|---|
| Coluna `collection_paused_at` ausente (MG6 não aplicada) | a guarda de schema (grupo `MG6`) acusa antes de qualquer chamada | **vermelho**, "migration MG6 não aplicada"; nada é coletado nem gravado |
| A linha do canal vem sem o campo (forma inesperada) | `isBatchRow` recusa: "competitor batch" lança, como já faz para qualquer forma inválida | **vermelho** ("não foi possível ler os canais") |
| Nenhum canal pausado | nada muda | verde |
| Canal pausado | fora do lote, da fase semanal, da leitura horária e da fila de comentários; `fora_pausado` na leitura horária; nota "1 canal com a coleta pausada" | **nota** |
| Canal pausado há mais de 7 dias | linha em `acao_do_dono` com o nome do canal e os dias | **nota com ação**; e-mail um por semana |
| (emenda 1: S-M8) Todos os canais pausados, ou o único canal pausado | `semPausados` devolve lista vazia: `sincronizar_canais` e a leitura horária não têm o que ler e fecham sem chamada à API; a nota diz quantos estão pausados | **nota**, não erro e não "ok" mudo. O que a prova `canais_vistos_dia_pacifico` de `competitor_capture_health` diz com zero canal ativo **não está medido**: o teste da Tarefa 9 roda o caso e, se a prova acusar, o agente para e avisa (a saída é uma emenda, não um ajuste do teste) |
| A pausa é gravada com uma sincronização do canal em andamento | a sincronização em curso termina (até 5 minutos); `exportar` recusa canal pausado há menos de 6 minutos ou com `sync_status = 'syncing'` recente, **(emenda 1: D-m4) já no passo 3, antes de criar a pasta e de baixar qualquer miniatura** (o banco confere de novo no registro) | recusa com a frase; nada exportado |
| Uma das quatro funções perdeu o remendo | `competitor_channel_pause` recusa com `pausa_sem_remendo` e o nome da função | o comando falha com a frase; nada é pausado |
| Canal em erro e pausado | as regras de canal em erro continuam (vermelho de 12 h a 3 dias, depois `acao_do_dono`), porque `competitor_capture_health` não é remendada | conhecido; está na seção 13 |
| Canal despausado | volta à coleta no disparo seguinte; fica fora das provas pela cauda (26 h, 3 dias, 7 dias); os arquivos exportados perdem `verified_at` e `nas_confirmed_at` | **nota** ("fora da prova de série"); verde |

### 6.3 O export, a conferência e a remoção

| Situação | O que acontece | O que fica gravado |
|---|---|---|
| `OBS_ARQUIVO_DB_URL` ausente ou vazia | o script sai com código 2 e a frase; não tenta `.env.local` | nada |
| Canal não encontrado no site, ou não pausado | `exportar` recusa **antes** de criar a pasta | nada |
| Tabela nova com cascata e sem export | `exportar` recusa com o nome da tabela | nada |
| Uma tabela do registro não existe neste banco | é pulada (não tem linha); o manifesto diz "tabela ausente" | o manifesto |
| Tabela sem nenhuma linha do canal | nenhum arquivo; o manifesto lista a tabela com zero arquivos | o manifesto |
| Erro do banco no meio da leitura | o script para; **não escreve o manifesto** (ele é o último arquivo); a pasta fica incompleta e `conferir` recusa "sem manifesto" | arquivos soltos, sem valor |
| Miniatura responde 404 | `exportar` para e lista quantas; só segue com `--aceitar-miniaturas-ausentes`, e aí o manifesto e `blob_missing` registram cada uma | conforme a opção |
| Miniatura responde 403, 429 ou 500, ou passa de 15 s (3 tentativas) | `exportar` para; nada registrado | nada no banco |
| A contagem do arquivo difere da do banco no registro | `obs_archive_register` lança `banco_difere_do_manifesto`; a transação é desfeita | nada no banco; os arquivos ficam |
| Pasta do lote já existe e não está vazia | recusa; com `--refazer` apaga só o que o manifesto anterior lista e exporta de novo; o registro antigo sai e `verified_at` e `nas_confirmed_at` voltam a nulo | lote reexportado |
| Pasta dentro de um repositório git | recusa | nada |
| `conferir`: arquivo faltando, sobrando, sha256 diferente, contagem ou soma diferente, conteúdo do banco diferente | para na primeira classe de diferença, lista até 20, sai com código 1; **não marca nada** | nada |
| `confirmar-nas` sem `conferir` | recusa (`lote_nao_conferido`) | nada |
| `confirmar-nas` fora de um terminal, ou com o nome do lote digitado errado | recusa | nada |
| Remoção sem lote, sem confirmação, com o canal despausado depois do export, ou com contagem diferente | a função lança com o código; a ação do CMS mostra a frase do catálogo; **nada é apagado** | nada |
| Remoção com tudo certo | o canal e tudo dele somem; os arquivos do lote ganham `deleted_at` e `rows_deleted`; uma linha em `audit_log`; as URLs das miniaturas ficam em `blob_urls_pending` | o registro e a auditoria |
| Apagar as miniaturas do Blob falha (rede, token), ou a remoção foi pelo comando `remover`, que não fala com o Blob | a remoção já aconteceu e não é desfeita; as URLs continuam em `blob_urls_pending`; `lerAvisoDoArquivo` conta; Sentry recebe só a contagem. **(emenda 1: D-I3)** A tarefa diária tenta de novo todo dia (emenda 2: D-m2: só no disparo em que a medida deu `ok`, isto é, uma vez por dia, até 200 URLs); passados `RULES.archive.blobPendingAlertDays` dias, sai a linha em `acao_do_dono` com a contagem, os dias e o ritmo (4.6) | pendência visível e com nova tentativa |
| (emenda 1: D-I4, S-M2) Uma URL de `thumb_blob_url` não está sob `observatorio/thumbs/` | não é enviada ao Blob para apagar; fica na pendência e é contada à parte ("N fora do prefixo") | pendência visível; nada apagado fora do prefixo |
| (emenda 1: D-I3, S-M4) O dono exporta e desiste (despausa) | os arquivos do lote perdem a conferência (como antes) e ganham `closed_at` com `closed_reason = 'despausado'`: o lote deixa de aparecer como "exportado e não confirmado" | lote encerrado, sem apagamento |
| (emenda 1: D-I3, S-M4) O canal é removido e havia lotes anteriores dele (outro nome, outro dia) | a remoção marca `deleted_at` no lote usado e encerra os outros com `closed_reason = 'substituido'` | lotes encerrados |
| (emenda 1: D-I3, S-M4) Lote aberto cujo canal não existe mais (removido pelo botão antigo antes da 11b, ou pela resposta "apagar" da E9) | `lerAvisoDoArquivo` não o lista como "a confirmar"; conta em `lotesDeCanalInexistente` | contado, nunca escondido |
| (emenda 1: D-m8) Uma tarefa da forja está em execução para um vídeo do canal | `obs_archive_register` recusa com `forja_em_andamento` (ela ainda pode gravar uma leitura); esperar a tarefa terminar (o watchdog a encerra em 30 minutos) e exportar de novo | nada no banco |
| (emenda 1: S-I3, D-I5) A remoção pelo CMS passa do teto de tempo do papel (`57014`) | a transação é desfeita; código `demorou_demais`, frase "nada foi apagado; o canal continua pausado e o lote continua confirmado; remova pelo comando `remover`" | nada |

---

## 7. Simulação do dia do deploy e dos seguintes

Suposição: MG6 aplicada às 15:00 de São Paulo de um dia D, código no ar às 16:00.

| Quando | O que acontece | O que se lê |
|---|---|---|
| D, 15:00, MG6 aplicada, código antigo | nada muda. V1 a V4b conferidas (emenda 1) | V3 = 0, 0, 0, 0 |
| D, 16:00, primeiro disparo com o código novo | `tamanho_do_banco` é devida (passou das 05:00 e não tem `ok` no dia): roda, grava a primeira linha. O sinal lê uma medida: cor pelo tamanho, projeção "não medida (1 de 14)". No vigia a tarefa aparece `late` por no máximo 20 minutos (a agenda é mais velha que 36 h e a tarefa nunca teve `ok`), e passa a `ok` | resposta do cron com `banco`; `obs_db_size_daily` com 1 linha |
| D, restante | disparos sem a tarefa (já `ok` no dia); o sinal é relido a cada disparo | `acao_do_dono` sem linha de banco, salvo se já estiver acima de 350 MB |
| D+1, 05:00 a 05:20 | o dia de leitura vira; a tarefa roda no primeiro disparo depois das 05:00 | 2 linhas |
| D+1, 00:00 a 04:59 | o dia de leitura ainda é D: sem "sem leitura hoje" falso | |
| D+7 | 8 linhas; comparar `top_relations` de D e de D+7 | conferência `e10-d7` |
| D+13 | 14 linhas: a projeção passa a "medida" | conferência `e10-d14` |
| D+28 | a reta usa a janela inteira; a tabela da OP-9 é refeita com ela | conferência `e10-d28` |

Nada na etapa depende de retroação nem preenche o passado: não há linha de tamanho anterior ao deploy, e o sinal diz isso ("não medida").

---

## 8. Desvios do texto do spec, com o motivo

| # | O spec diz | Este plano faz | Motivo |
|---|---|---|---|
| D1 | a MG6 troca `yt_reporting_blobs_purge` por "apaga só o que está em lote confirmado" | a MG6 **não toca** a função; ela segue devolvendo 0 | O registro de lotes é por tabela, canal e mês; o bruto é por relatório. Casar por mês apagaria um relatório baixado depois do export e que nunca esteve no arquivo. O vínculo certo é por `report_id`, e o export do canal próprio é da fase de manutenção: nesta fase não existe lote de bruto, então a função reaberta apagaria 0 para sempre, e o alarme "apagou mais que 0" do passo de relatórios (`reports-step.ts:531`) teria de ser afrouxado sem ganho. O item 81 fica satisfeito e testado: nada é apagado |
| D2 | `obs_archive_batches` sem `csv_sha256`, `kind`, `blob_missing`, `rows_deleted`, `blob_urls_pending` | a tabela tem as colunas do spec e mais essas cinco | `csv_sha256` permite conferir conteúdo, e não só contagem; `kind` reserva o lote por idade; `blob_missing` impede miniatura ausente de passar em silêncio; `rows_deleted` é o que o item 76 confere; `blob_urls_pending` é a pendência da pergunta P3 |
| D3 | só duas colunas para a pausa | mais a tabela `competitor_collection_pauses` | seção 4.1 |
| D4 | "nenhuma tarefa da agenda lê canal pausado" | também as ações manuais do CMS e a primeira sincronização | qualquer gravação entre o export e a remoção faz a remoção recusar; a trava de `runChannel` cobre todos de uma vez |
| D5 | `obs_db_size_daily` com quatro colunas | mais `top_relations jsonb` | responde, sem consulta manual, a pergunta do item 80 ("de onde vêm os 20 MB por ano do site") e a origem de qualquer salto |
| D6 | orçamento de 5 s para `tamanho_do_banco` | `fimAteMs` de 85 s contados do começo do disparo, com duas idas de até 5 s | o contrato de tarefa do código mede "até quando termina", não "quanto dura"; é a mesma forma de `anular_identidade` |
| D7 | catálogo em `lib/agenda.ts` | `agenda/definicoes.ts` e `agenda/catalogo.ts` | é onde o código da E16 o pôs |
| D8 | lista fechada com catorze linhas | o teste nasce com as ocorrências de hoje (F17 e F18) e duas linhas novas: 15, "regravar o registro de um lote reexportado" (`obs_archive_register`, tabela `obs_archive_batches`, estado de registro, não exporta), e 16, a forja (`forja-queue.ts`: tarefa pendente cancelada pelo dono e leitura órfã ou incompleta desfeita na mesma chamada; OP-11) | o spec foi escrito antes de MG8, MG10 e do lote da E11 existirem |
| D9 | "nenhuma linha de outro canal mudou" (item 76) | o teste afirma isso para **todas** as tabelas, com uma exceção nomeada: `competitor_video_comments.featured_channel_id` de comentários de outros canais vira nulo quando o canal removido era o autor de destaque | é a chave `on delete set null` da MG8 (F8); a função devolve e audita quantas foram |
| D10 | item 77: o export recusa arquivar série de vídeo com idade 30 fechada e sem marca | `exportar` recusa **todo** lote por idade nesta fase; a remoção de canal não é bloqueada (testado) | a tabela de marcas (`competitor_video_marks`, MG4) ainda não existe e o lote por idade é da manutenção; a regra fina vai para o plano dela |
| D11 | o sinal "no retorno do cron" | campo novo `banco` na resposta, e linhas em `acao_do_dono` e `notas` | o contrato de tarefa descarta `extra` e não aceita texto (F3) |
| D12 | policy de `obs_db_size_daily` por `is_member_staff()` e aviso "para quem edita o site" | a policy é a do spec; o leitor da tela exige `requireEditAccess` antes | a tabela é do sistema (não tem `site_id`); quem decide quem vê o aviso é a checagem da aplicação |
| D13 | (emenda 1: D-I3, S-M4) `obs_archive_batches` sem estado de encerramento | mais `closed_at` e `closed_reason` (`'despausado'` ou `'substituido'`), (emenda 2: D-m4) amarradas por um `check`: ou as duas nulas, ou as duas preenchidas | sem isso um lote exportado e abandonado fica "exportado e não confirmado" para sempre (o risco 13 do spec), e `deleted_at` não pode ser reaproveitado por causa do `check` que o amarra à confirmação |
| D14 | (emenda 1: S-M1, D-m13) `obs_db_size_daily` legível por `is_member_staff()` | a policy é a mesma, mas `authenticated` só tem `select` nas cinco colunas do spec; `top_relations` só é lida pelo cliente de serviço | a coluna lista as 30 maiores relações de todos os esquemas (inclusive `auth` e `storage`): é o mapa do banco, e um `reporter` não precisa dele |
| D15 | (emenda 1: S-I3) a remoção de canal só pelo CMS | também pelo subcomando `remover`, na conexão direta, com guarda de terminal e nome do lote digitado | tira do item 82 a dependência da Tarefa 11b (zona da A4) e do teto de tempo não medido da API do banco |

---

## 9. Arquivos, tarefas, ordem e paralelismo

Caminhos relativos a `apps/web/`, salvo onde dito. "Novo" = arquivo criado por esta etapa. **A lista de cada tarefa é fechada: se a tarefa precisar de outro arquivo, para e avisa.**

| T | O que | Arquivos (lista fechada) | Depende de | Pode rodar junto com |
|---|---|---|---|---|
| 0 | Conferências C1 a C12 (leitura, controlador; emenda 1) | só o ledger `.superpowers/sdd/a5-e10/progress.md` | autorização de leitura em produção | todas |
| 1 | Migration MG6 e as provas no banco. **Só na vez dela** | `supabase/migrations/<carimbo>_observatorio_a5_e10_export_pausa_e_limite.sql` (novo, por `db:new`); `test/integration/observatorio-a5-e10-migration.test.ts` (novo); `test/integration/observatorio-a5-e10-rls.test.ts` (novo); `.superpowers/sdd/a5-e10/mg6-prova.sql` e `mg6-prova-saida.txt` (novos) | aviso do controlador | todas menos a 6 (integração) |
| 2 | Regras e modelo puro do sinal | `src/lib/youtube/observatorio/rules.ts` (**quatro chaves novas, nada mais**; emenda 1: D-I3); `src/lib/youtube/observatorio/arquivo/sinal-do-banco.ts` (novo); `test/youtube/observatorio/arquivo-sinal-do-banco.test.ts` (novo) | nada | todas |
| 3 | A medida (código da tarefa) e o leitor do sinal | `src/lib/youtube/observatorio/arquivo/medir-tamanho.ts` (novo); `src/lib/youtube/observatorio/arquivo/ler-sinal.ts` (novo); `src/lib/youtube/observatorio/arquivo/ler-pendencias.ts` (novo; emenda 1: D-I1, D-I3); `test/youtube/observatorio/arquivo-medir-tamanho.test.ts` (novo); `test/youtube/observatorio/arquivo-ler-sinal.test.ts` (novo); `test/youtube/observatorio/arquivo-ler-pendencias.test.ts` (novo) | 2; contrato da MG6 (neste plano) | 4a, 4b, 5, 6, 7, 8, 10, 11a, 12 |
| 4a | Pausa na sincronização | `src/lib/youtube/competitor-sync-batch.ts`; `src/lib/youtube/competitor-sync.ts`; `src/lib/youtube/competitor-health.ts`; `test/youtube/competitor-sync-batch.test.ts`; `test/youtube/competitor-sync-a5.test.ts`; `test/youtube/competitor-health.test.ts`; `test/youtube/competitor-sync-harness.ts` | 2; **a V1 anotada em produção** (emenda 1: S-C1) | 3, 4b, 5, 6, 7, 8, 10, 11a, 12 |
| 4b | Pausa na leitura horária | `src/lib/youtube/horaria/gravar.ts`; `src/lib/youtube/horaria/lista.ts`; `src/lib/youtube/horaria/executar.ts`; `src/lib/youtube/agenda/tarefas/leitura-horaria.ts`; `test/youtube/horaria/gravar.test.ts`; `test/youtube/horaria/lista.test.ts`; `test/youtube/horaria/executar.test.ts` | **a V1 anotada em produção** (emenda 1: S-C1) | 3, 4a, 5, 6, 7, 8, 10, 11a, 12 |
| 5 | Arquivo: CSV, manifesto e catálogo de códigos (puros) | `src/lib/youtube/observatorio/arquivo/csv.ts` (novo); `src/lib/youtube/observatorio/arquivo/manifesto.ts` (novo); `src/lib/youtube/observatorio/arquivo/codigos.ts` (novo; emenda 2: S-m4); `test/youtube/observatorio/arquivo-csv.test.ts` (novo); `test/youtube/observatorio/arquivo-manifesto.test.ts` (novo); `test/youtube/observatorio/arquivo-codigos.test.ts` (novo; emenda 2: S-m4) | nada | todas |
| 6 | Arquivo: exportar e conferir | `src/lib/youtube/observatorio/arquivo/sessao.ts` (novo); `…/arquivo/exportar.ts` (novo); `…/arquivo/conferir.ts` (novo); `…/arquivo/miniaturas.ts` (novo); `test/youtube/observatorio/arquivo-exportar.test.ts` (novo); `test/youtube/observatorio/arquivo-conferir.test.ts` (novo); `test/integration/observatorio-a5-e10-ida-e-volta.test.ts` (novo) | 5; para o teste de integração, a 1 aplicada no `bythiago_int` | 2, 3, 4a, 4b, 8, 10, 11a, 12 |
| 7 | O comando | `src/lib/youtube/observatorio/arquivo/cli.ts` (novo); `test/youtube/observatorio/arquivo-cli.test.ts` (novo); `scripts/obs-arquivo.ts` (novo, na raiz do repositório) | 5, 6 | 2, 3, 4a, 4b, 8, 10, 11a, 12 |
| 8 | Leitores sem tela (aviso e sugestões) | `src/lib/youtube/observatorio/arquivo/aviso.ts` (novo); `…/arquivo/sugestoes.ts` (novo); `test/youtube/observatorio/arquivo-aviso.test.ts` (novo); `test/youtube/observatorio/arquivo-sugestoes.test.ts` (novo) | 2, 3 | 4a, 4b, 5, 6, 7, 10, 11a, 12 |
| 9 | **Integração na agenda** (a única que toca os arquivos da agenda) | `src/lib/youtube/agenda/definicoes.ts`; `…/agenda/catalogo.ts`; `…/agenda/tarefas/tamanho-do-banco.ts` (novo); `…/agenda/extras-arquivo.ts` (novo); `…/agenda/aviso.ts`; `…/agenda/executar.ts`; `test/youtube/agenda/catalogo.test.ts`; `test/youtube/agenda/saude.test.ts`; `test/youtube/agenda/tarefas.test.ts`; `test/youtube/agenda/aviso.test.ts`; `test/youtube/agenda/executar.test.ts`; `test/youtube/agenda/extras-arquivo.test.ts` (novo); **(emenda 1: S-I1)** `src/app/api/cron/sync-youtube/route.ts` e `test/youtube/cron-competitors-agenda.test.ts`; **(emenda 2: N1)** `src/lib/youtube/agenda/arquivo-sem-agenda.ts` (novo); `test/youtube/agenda/arquivo-sem-agenda.test.ts` (novo); `test/youtube/cron-competitors-prova.test.ts`, `test/youtube/cron-competitors-invalidate.test.ts` e `test/integration/agenda-despacho.test.ts` (**uma linha de falso de módulo em cada um, nada mais**). Em `route.ts` os pontos são os quatro do passo 7, e não "só `alemDoLote`" | 2, 3, 4a, 11a (a nova tentativa das miniaturas); a V1 anotada em produção | nenhuma desta etapa; **fila com a E14, a parte 2 da E15 e a E9** nos mesmos arquivos |
| 10 | A lista fechada do que apaga | `test/youtube/observatorio/lista-fechada-do-que-apaga.test.ts` (novo); `test/integration/observatorio-a5-e10-lista-fechada.test.ts` (novo) | para o teste de integração, a 1 | todas; (emenda 2: S-m2) a parte estática nasce **sem** a linha 17, e a 11a vem depois dela |
| 11a | Remoção liberada por lote: a biblioteca | `src/lib/youtube/observatorio/arquivo/remover.ts` (novo); `test/youtube/observatorio/arquivo-remover.test.ts` (novo); (emenda 2: S-m2) `test/youtube/observatorio/lista-fechada-do-que-apaga.test.ts` (**só a linha 17 da lista**, no mesmo commit de `remover.ts`) | contrato da MG6; (emenda 2: S-m4, S-m2) 5 (`codigos.ts`) e a parte estática da 10 | todas menos a 10 |
| 11b | Remoção liberada por lote: a ação do CMS. **Só com o aval do controlador (zona da A4)** | `src/app/cms/(authed)/youtube/competitors/actions.ts` (**só `removeCompetitorChannel`, a frase de `syncCompetitorNow` e `syncCompetitorsNow` para canal pausado e, pela emenda 1 (D-m6), a recusa de `syncFullHistory` para canal pausado**); `test/youtube/observatorio/canais-remove-action.test.ts` (novo) | 11a, 4a, 1 em produção | nenhuma |
| 12 | Runbook | `docs/ops/observatorio-arquivo-runbook.md` (novo, na raiz) | 7 | todas |
| 13 | Ensaio com o dono (item 82) | nenhum arquivo do repositório além do runbook e do ledger | tudo em produção; P1 | |
| 14 | Envio e conferências com data | `src/lib/conferencias.ts`; `test/lib/conferencias.test.ts`; `.superpowers/sdd/a5/conferencias-com-data.md` | tudo | |

**Ondas.**
(Ondas reescritas pela emenda 1: S-C1. Antes, a 4b estava na primeira onda e a 4a na segunda.)
- **Já, em paralelo** (sem migration, sem resposta do dono; nenhuma destas lê a coluna nova em caminho que roda em produção): 2, 5, 10 (parte estática, sem a linha 17), 12 (rascunho). (emenda 2: S-m2, S-m4) A 11a saiu desta onda: ela precisa de `codigos.ts` (Tarefa 5) e acrescenta a linha 17 ao teste estático da 10.
- **Em seguida, em paralelo:** 3 (depois da 2), 6 (depois da 5), 8 (depois da 3), 11a (depois da 5 e da parte estática da 10); depois, 7 (depois da 6).
- **Na vez da migration, que o plano recomenda adiantar para o começo:** 1. Com ela aplicada no `bythiago_int`: os testes de integração da 1, da 6 e da 10 e as medidas de tempo da seção 5.2. Depois, `db:push:prod` pelo dono e a V1 a V4b anotadas no ledger.
- **Só depois da V1 anotada em produção:** 4a e 4b, em paralelo; depois a 9, sozinha (depois de 2, 3, 4a e 11a).
- **Por último:** 14 (envio), 11b (com o aval), 13 (ensaio; pelo comando `remover`, não espera a 11b).

**Arquivos compartilhados com OUTRAS etapas da A5.**

| Arquivo | Quem mais mexe | Regra |
|---|---|---|
| `agenda/definicoes.ts`, `agenda/catalogo.ts`, `test/youtube/agenda/catalogo.test.ts`, `saude.test.ts`, `tarefas.test.ts` | E16 (dona), E14, parte 2 da E15 (`soma_do_mapa`, `podas`), E9 | uma definição, uma importação e uma entrada; os asserts de nomes e ordens mudam no mesmo commit; uma etapa por vez |
| `agenda/executar.ts`, `agenda/aviso.ts` e os testes | E16, E14 | um bloco em cada; a lógica nova mora em `agenda/extras-arquivo.ts`, que é só desta etapa |
| `agenda/fecho.ts` | E16, E15 | **este plano não toca** |
| `competitor-sync-batch.ts`, `competitor-sync.ts`, `competitor-health.ts` | E1, E2, E16, E9 | só a Tarefa 4a desta etapa; a E9 (ordem 18) vem depois |
| `horaria/gravar.ts`, `horaria/lista.ts`, `horaria/executar.ts` | E15 (dona), parte 2 da E15 | só a Tarefa 4b |
| `observatorio/rules.ts` | E15, E14, E2, E4 | quatro chaves novas (emenda 1), em bloco próprio no fim do objeto |
| `competitors/actions.ts` | **A4** (zona reservada) | só a Tarefa 11b, com aval; nunca commit por caminho com trabalho de outro terminal dentro |
| `lib/conferencias.ts`, `test/lib/conferencias.test.ts` | todas | um bloco por etapa, no molde de `conferenciasE14` |
| `supabase/migrations`: as quatro funções de prova e de fila | E9, E4, parte 2 da E15 | **quem recriar uma delas tem de reaplicar o bloco 10 da MG6** (ou partir do corpo instalado). `competitor_channel_pause` recusa se faltar, e o teste de integração acusa. Avisar os planos dessas etapas |
| `supabase/migrations`: toda migration futura que crie tabela com chave em cascata para `competitor_channels`, `competitor_videos` ou `competitor_video_comments` (emenda 1: D-I1) | E4 (MG4), E9, parte 2 da E15, manutenção | **recria `obs_archive_registry()` no mesmo arquivo**, com a entrada da tabela nova (ou `obs_archive_excluded()`, com o motivo), e roda a V2 depois de aplicar. A MG4 já está coberta: `competitor_video_marks` entra no registro pela MG6; o plano da E4 só precisa rodar a V2 e o teste `o registro e o catálogo concordam` depois da MG4, porque o filtro e a ordem da entrada (`video_id`, `age_days`) foram escritos a partir do DDL do spec e a tabela ainda não existe. Enquanto houver lacuna, a linha "arquivo: N tabela(s) sem export" sai em `acao_do_dono` a cada disparo |
| `src/app/api/cron/sync-youtube/route.ts`, `test/youtube/cron-competitors-agenda.test.ts` (emenda 1: S-I1) | E16 (dona), E14 | só a Tarefa 9. (emenda 2: N1) Em `route.ts`: uma importação, a chamada de `lerArquivoSemAgenda` logo depois de `rodarAntesDoLoteAntigo`, dois campos em `alemDoLote` e os três pontos em que `antes.problemas` entra no vermelho (linhas 174, 190 e 220-221 de hoje). `AntesDoLote`, a linha 87 e `rodarAntesDoLoteAntigo` **não mudam** |
| `test/youtube/cron-competitors-prova.test.ts`, `test/youtube/cron-competitors-invalidate.test.ts`, `test/integration/agenda-despacho.test.ts` (emenda 2: N1) | E16 (dona) | só a Tarefa 9: uma linha `vi.mock` do módulo novo em cada um; o falso de `rodarAntesDoLoteAntigo` e o literal que `cron-competitors-agenda.test.ts:73` confere ficam como estão |
| Toda tarefa futura que grave por canal de concorrente (`soma_do_mapa`, marcas de idade da E4) | parte 2 da E15, E4 | **contrato novo desta etapa:** não gravar linha de canal com `collection_paused_at` preenchido; senão a remoção recusa por contagem diferente (falha segura, mas trava o dono) |
| `coleta/index.ts`, `coleta/reports-step.ts`, `coleta/guarda.ts` | E6, E8, E11, E20 | **este plano não toca** (desvio D1) |
| `lib/pipeline/services/forja-queue.ts` | trilha da forja | **não toca**; a Tarefa 10 só o classifica no teste |
| `observatorio/proprio/**`, `e2e/**`, `docs/superpowers/mockups/**`, `types/database.types.ts`, `test/helpers/db-seed.ts`, `db-skip.ts`, `next-env.d.ts`, `tsconfig.json` | A4 e todas | **não toca** |

**Restrições globais.** TypeScript estrito, sem `any`, nenhum `as unknown as` novo. Arquivos em kebab-case. Erro que o dono lê, em português. **Os módulos de `observatorio/arquivo/` que o comando importa (`csv`, `manifesto`, `codigos` (emenda 2: S-m4), `sessao`, `exportar`, `conferir`, `miniaturas`, `cli`) usam só importação relativa e não importam `next/*`, `@sentry/nextjs`, `server-only` nem o apelido `@/`:** o `tsx` da raiz não resolve o apelido. Eles recebem o cliente do banco, o sistema de arquivos, o relógio e o `fetch` por parâmetro; quem cria o `pg.Client` é `scripts/obs-arquivo.ts`. Nenhuma mensagem do banco vai para tela, nota, e-mail ou Sentry: só o código `E10:<codigo>` e números. O nome do canal só aparece em `acao_do_dono`, no e-mail (escapado pelo adaptador) e no manifesto. Testes de servidor com `// @vitest-environment node`. Datas de teste relativas ou com relógio falso. Todo padrão de variável de ambiente tem teste que **apaga** a variável. Testes de integração só com `HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres`, sem paralelismo entre arquivos; cada teste cria o **seu** site, os seus canais e os seus usuários, e nunca conta linhas "do banco inteiro". Neste Postgres local, chamar função sem `execute` como `anon` ou `authenticated` derruba o servidor: conferir privilégio por `has_function_privilege`, nunca chamando. Cada tarefa termina com `npm run typecheck -w apps/web` limpo e os testes dos seus arquivos verdes; commit local por caminho explícito, sem push. Despacho: Sonnet, effort `high` nas Tarefas 1, 4a, 6 e 9; `medium` nas demais.

**Foco de revisão** (o que os dois especialistas devem atacar primeiro): (1) o remendo por âncora das quatro funções e as caudas; (2) a trava de linhas na remoção e a prova de que nenhuma linha filha entra entre a recontagem e o apagamento; (3) o desvio D1 (não reabrir a limpeza do bruto); (4) a ordem "migration antes do código" e o custo de inverter; (5) o sinal lido depois das tarefas e a regra do dia de leitura; (6) o que fica sem tela e por quanto tempo o botão antigo continua apagando sem export.

---

## 10. As tarefas

### Tarefa 0: conferências de leitura em produção

**Objetivo.** Trocar por número cada linha "conferência pendente" da seção 3.2.
**Como.** O controlador roda as doze consultas (emenda 1: C10, C11 e C12 são novas) (`npx supabase db query --linked "<select>"`, com a autorização de leitura em produção) e cola a saída no ledger.
**Decide.** C1, C6 e C7 podem **adiar** a Tarefa 1; C2 pode mudar três constantes de `RULES.dbSize`; C5 pode acrescentar tabela ao registro; C9 define o `--por` do ensaio; C10 decide se a remoção pelo CMS vale ou se só o comando remove; C11 acrescenta uma linha à seção 5.4; C12 pode mudar o `insert` de auditoria do Apêndice A.
**Pronto quando:** as doze têm resposta no ledger, ou o ledger diz qual não pôde ser lida e o que fica valendo (o padrão do plano).

### Tarefa 1: migration MG6 e as provas no banco (só na vez dela)

**Objetivo.** O arquivo da migration, idêntico ao Apêndice A, e os testes que provam cada função nos dois sentidos.
**Passos, nesta ordem.**
1. Gravar o Apêndice B em `.superpowers/sdd/a5-e10/mg6-prova.sql`.
2. `npm run db:new observatorio_a5_e10_export_pausa_e_limite`; conferir o carimbo; colar o Apêndice A; `diff` contra o apêndice tem de sair vazio.
3. Rodar o roteiro **duas vezes** (`psql "$SUPABASE_DB_URL" -v mg=<arquivo da migration> -f .superpowers/sdd/a5-e10/mg6-prova.sql`). As duas saídas têm de ser iguais entre si e iguais à do Apêndice B (fora os instantes). Diferença = parar e avisar. O roteiro faz `rollback`: nada fica gravado.
4. O controlador aplica a MG6 no `bythiago_int` (nunca `db:reset`); rodar os dois testes de integração.

**Contrato das funções** (todas com `search_path = ''`; `execute` só para `service_role`; as que gravam são `security definer`).

| Função | Assinatura | Devolve ou lança |
|---|---|---|
| `obs_db_size_record` | `(p_now timestamptz default now())` | `{day, db_bytes, competitor_bytes, own_bytes, measured_at}`; grava ou regrava a linha do dia de São Paulo de `p_now` |
| `competitor_channel_pause_covers` | `(p_channel uuid, p_now timestamptz, p_tail interval)` | `boolean` |
| `competitor_channel_pause` | `(p_site uuid, p_channel uuid, p_by uuid)` | `{status: 'pausado' \| 'ja_pausado', paused_at}`; lança `sem_direito`, `canal_nao_encontrado`, `pausa_sem_remendo`, `parametro_nulo` |
| `competitor_channel_unpause` | `(p_site uuid, p_channel uuid, p_by uuid)` | `{status: 'despausado', resumed_at, arquivos_invalidados}` ou `{status: 'nao_pausado'}`; (emenda 1: D-I3) encerra os lotes abertos do canal com `closed_reason = 'despausado'` |
| `obs_archive_registry` | `()` | 20 linhas `(table_name, filter_sql, period_sql, sum_sql, order_sql)` (emenda 1: D-I1; a vigésima é `competitor_video_marks`) |
| `obs_archive_excluded` | `()` | `(table_name, reason)`: hoje só `competitor_video_comment_authors` |
| `obs_archive_uncovered` | `()` | `text[]`; vazio = o export cobre tudo |
| `obs_archive_channel_counts` | `(p_channel uuid)` | `(table_name, period_start, row_count, control_sum)`, uma linha por tabela e mês **com linha** |
| `obs_archive_diff` | `(p_site uuid, p_batch text, p_channel uuid)` | as diferenças entre o banco e o registro; vazio = iguais |
| `obs_archive_register` | `(p_site uuid, p_batch text, p_channel uuid, p_rows jsonb)`; `p_rows` = `[{table_name, period_start, period_end, row_count, control_sum?, file_sha256, csv_sha256, blob_count?, blob_bytes?, blob_missing?}]` | `{status: 'exportado', arquivos, linhas, exported_at}`; lança `nao_pausado`, `pausa_recente`, `sincronizando`, `forja_em_andamento` (emenda 1: D-m8), `tabela_sem_export`, `lote_ja_apagado`, `banco_difere_do_manifesto`, `canal_nao_encontrado` |
| `obs_archive_verify` | `(p_site uuid, p_batch text, p_channel uuid)` | `{status: 'conferido', arquivos, verified_at}`; lança `sem_lote`, `nao_pausado`, `despausado_depois_do_export`, `banco_difere_do_manifesto` |
| `obs_archive_confirm_nas` | `(p_site uuid, p_batch text, p_channel uuid, p_by uuid)` | `{status: 'confirmado', arquivos, nas_confirmed_at}`; lança `sem_direito`, `lote_nao_conferido` e as da guarda |
| `competitor_channel_remove_archived` | `(p_site uuid, p_channel uuid, p_actor uuid)` | `{status: 'removido', batch, arquivos, linhas, blob_urls, featured_refs_cleared}`; lança `sem_lote`, `lote_nao_conferido`, `lote_nao_confirmado`, `despausado_depois_do_export`, `banco_difere_do_manifesto`, `tabela_sem_export`, `sobrou_linha`, `canal_nao_encontrado`. (emenda 1: D-m13) **`p_actor` não é validado pela função** (ela não confere que o ator administra o site): quem garante é o chamador, isto é, a ação do CMS depois de `denyUnlessSiteAdmin` e `requireEditAccess`, ou o comando `remover`, que resolve o `--por` e confere `obs_archive_is_site_admin` antes de chamar. (emenda 1: D-I3) Encerra os outros lotes abertos do canal com `closed_reason = 'substituido'` |
| `obs_archive_blobs_done` | `(p_site uuid, p_batch text, p_channel_ref text, p_urls text[])` | quantas URLs ainda estão pendentes |
| `competitor_archive_suggestions` | `(p_site uuid, p_now timestamptz, p_months integer)` | `{canais_avaliados, canais_sem_video, sugestoes: [{channel_row_id, channel_name, last_published_at, last_ok_synced_at, videos, linhas}]}` (emenda 1: D-m5: `last_ok_synced_at` nulo ou velho quer dizer que "não publica" pode ser "não é lido"); **nulo** com parâmetro nulo ou `p_months < 1` |

Toda exceção de regra tem a mensagem `E10:<codigo>: <texto>`. Os códigos são o contrato; o texto depois do segundo `:` nunca vai para tela.

**Testes de `observatorio-a5-e10-migration.test.ts`** (cada um cria o seu site, dois canais A e B com vídeos, série diária, versões e comentários, um usuário `org_admin` e um usuário comum; todos os cenários marcados "rodado" já foram executados em SQL: seção 11).

| Nome | Entrada | Esperado |
|---|---|---|
| `aplicada: V1 e V2` | o banco com a MG6 | V1 = 3, 3, 2, 17, 4, 4, true, false; V2 = `{}` e 20 (rodado com 19 antes da emenda 1; o 20 ainda não foi rodado) |
| `tamanho: grava uma linha por dia e regrava no mesmo dia` | `obs_db_size_record` duas vezes com o mesmo `p_now` | 1 linha; `db_bytes` maior que zero e maior ou igual a `competitor_bytes + own_bytes`; `top_relations` é objeto (rodado) |
| `tamanho: dois dias, duas linhas` | `p_now` de hoje e de amanhã às 05:10 de São Paulo | 2 linhas, com os dias de São Paulo certos |
| `tamanho: p_now nulo lança` | `null` | exceção `22023`; nenhuma linha |
| `pausar: quem não administra não pausa` | usuário comum | `sem_direito`; coluna nula; zero pausas (rodado) |
| `pausar: canal de outro site não é pausado` (mutação: tirar `c.site_id = p_site`) | site X com o canal do site Y | `canal_nao_encontrado`; canal Y intacto (rodado) |
| `pausar duas vezes` | A, A | `pausado`, depois `ja_pausado`; uma pausa aberta (rodado) |
| `pausar recusa quando uma função perdeu o remendo` | recriar `competitor_hourly_health` sem a chamada (dentro do teste; emenda 2: D-m5: numa transação que termina em `rollback`) | `pausa_sem_remendo` com o nome da função; nada pausado |
| `pausa tira o canal das quatro funções` (item 229) | vídeo de A publicado há 2 dias; pausar A | `videos_na_lista` cai 1; a fila de comentários não devolve vídeo de A; `retratos_atrasados` cai; `fora_da_prova` sobe pelo número de vídeos de A (rodado: 1, 1, 1, 0 antes; 0, 0, 0, 2 depois) |
| `canal B não é afetado pela pausa de A` (mutação: trocar `p.competitor_channel_id = p_channel` por `true`) | o mesmo, lendo B | os números de B não mudam |
| `despausar: a fila volta, as provas esperam a cauda` | despausar A | a fila devolve A de novo; a leitura horária e a série ainda o deixam fora; com `p_now` 8 dias depois, tudo volta (rodado) |
| `despausar invalida a conferência` | A exportado e conferido; despausar | `arquivos_invalidados` = número de arquivos; `verified_at` nulo em todos (rodado: 5 e 0 de 5) |
| `registro: recusa não pausado, pausa recente e sincronizando` (item 229) | três estados de A | `nao_pausado`; `pausa_recente` com a pausa de agora; `sincronizando` com `sync_status = 'syncing'` há 1 minuto (rodado o segundo) |
| `registro: recusa arquivo que não bate e não grava nada` (item 75) | `row_count` de um arquivo trocado por 999 | `banco_difere_do_manifesto`; zero linhas no registro (rodado) |
| `registro: reexportar zera a conferência` (item 230) | registrar, conferir, confirmar, registrar de novo | `verified_at` e `nas_confirmed_at` nulos em todos os arquivos do lote |
| `ordem dos passos` (item 75) | confirmar antes de conferir; remover antes de conferir; remover depois de conferir e antes de confirmar | `lote_nao_conferido`, `lote_nao_conferido`, `lote_nao_confirmado`; nada apagado (rodado) |
| `confirmar: quem não administra não confirma` | usuário comum | `sem_direito` (rodado) |
| `remoção recusa com linha nova depois do export` (item 75) | inserir uma linha de série diária de A depois de confirmar | `banco_difere_do_manifesto` com a tabela e o mês; o canal continua; a contagem de todas as tabelas de A igual à de antes (rodado) |
| `remoção recusa com o canal despausado e pausado de novo` | despausar e pausar depois do export | `despausado_depois_do_export` (rodado na conferência) |
| `remoção recusa com tabela nova em cascata` | criar, no teste, uma tabela com chave em cascata para `competitor_videos` (emenda 2: D-m5: numa transação que termina em `rollback`) | `tabela_sem_export` com o nome; nada apagado |
| `remoção com lote confirmado` (item 76) | A com tudo certo | `removido`; zero linhas de A em todas as tabelas do registro; todos os arquivos com `deleted_at` e `rows_deleted = row_count`; soma de `rows_deleted` = total de linhas apagadas contado antes; **uma** linha em `audit_log` com `resource_id` = id do canal e o ator; o registro do lote continua (rodado) |
| `remoção não toca o canal B` (item 76; mutação: tirar o filtro `$1` de uma entrada do registro) | A removido | para B: mesma contagem e mesmo `md5` do conteúdo de cada tabela antes e depois, **exceto** `featured_channel_id` de comentários de B que apontavam para A, que viram nulo; `featured_refs_cleared` = esse número |
| `remoção com o site errado` (mutação: tirar `c.site_id = p_site` do `delete`) | site X, canal do site Y | `canal_nao_encontrado`; nada apagado |
| `dois canais no mesmo nome de lote` (mutação: tirar `b.channel_ref = p_channel::text` de `obs_archive_diff`) | A e B exportados com o mesmo `batch`; remover A | só os arquivos de A ganham `deleted_at`; os de B seguem conferíveis |
| `blobs_done tira só o que foi apagado` | pendência com 3 URLs; `done` com 2 | devolve 1; a terceira continua |
| `sugestões: canal parado aparece, canal ativo não` (item 79) | A com último vídeo há 13 meses; B com vídeo de ontem; C sem vídeo | `sugestoes` = [A]; `canais_sem_video` = 1; `canais_avaliados` = 3 |
| `sugestões: fronteira de 12 meses` | último vídeo há exatamente 12 meses menos 1 dia; e mais 1 dia | fora; dentro |
| `sugestões: parâmetro nulo devolve nulo, não lista vazia` | `p_site` nulo | `null` (rodado) |
| `sugestões não mudam nada` (item 79) | chamar a função | contagem de todas as tabelas de A igual; nenhum lote; nenhuma pausa |
| `limpeza do bruto não apaga nada` (item 81) | um bruto normalizado há 400 dias e um sem normalizador baixado há 400 dias; `yt_reporting_blobs_purge(array['x'])` | devolve 0; os dois continuam |
| `colunas de mês do registro são not null` | `information_schema` para cada `period_sql` | nenhuma anulável |
| `o registro e o catálogo concordam` | `obs_archive_uncovered()`; e para cada tabela do registro que existe, a consulta montada roda | `{}`; nenhuma lança |
| (emenda 1: D-I2) `a cascata não apaga nada fora do arquivo` (item 76; (emenda 2: D-m1) mutação: acrescentar `and false` ao filtro da entrada de `competitor_changes` no registro, que estreita com certeza: o teste **tem de falhar**. A mutação antiga, `competitor_field_versions` só com `t.competitor_channel_id = $1`, pode passar em verde, porque a coluna é `not null` (F9) e, se toda linha de vídeo carrega o canal do próprio vídeo, tirar o `or t.video_id in (...)` não estreita nada. **Conferência pendente**, no `bythiago_int`: `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.competitor_field_versions'::regclass;` e `select tgname, pg_get_triggerdef(oid) from pg_trigger where tgrelid = 'public.competitor_field_versions'::regclass and not tgisinternal;`. Se nada impede linha com `competitor_channel_id` de B e `video_id` de A, a semente ganha uma linha assim e a mutação antiga entra como **segunda** mutação; se algo impede, fica só a nova) | canal A com linha em todas as tabelas, inclusive nas que não têm coluna de canal e só são alcançadas pela chave por vídeo. Por conexão direta, numa transação `repeatable read`: contar o **total** de cada tabela do fecho de cascata (lista tirada do catálogo com a mesma consulta recursiva de `obs_archive_uncovered`, **não** do registro), remover, contar de novo, `commit` | por tabela: `antes - depois` = soma de `row_count` do lote para essa tabela; para `competitor_video_comment_authors` (excluída de propósito) = as linhas de identidade do canal, contadas pelo teste; para tabela do fecho sem arquivo no lote = 0. É a única prova do plano que conta a tabela inteira, e só pode porque as duas contagens estão no mesmo retrato |
| (emenda 1: D-I1) `tabela do registro que ainda não existe não quebra nada` | o banco sem a MG4 | `obs_archive_channel_counts` não devolve linha de `competitor_video_marks`; `obs_archive_uncovered()` = `{}`; criando no teste uma `competitor_video_marks` com o DDL do spec e duas marcas de A, a contagem passa a devolver a linha e a remoção a apaga. (emenda 2: D-m5) O `create table`, as marcas e a remoção ficam **dentro de uma transação que termina em `rollback`**, por conexão direta; nunca `drop` no fim: outros agentes ensaiam a MG4 no mesmo `bythiago_int`, e um `drop` apagaria a tabela deles. Se a tabela já existir no banco (MG4 ensaiada), o teste não a cria e usa a que está lá, ainda dentro do `rollback` |
| (emenda 2: D-m4) `closed_at e closed_reason andam juntos` | `update` direto em `obs_archive_batches` pondo só `closed_at`; depois só `closed_reason` | os dois dão violação de `check` (`23514`); pondo os dois, passa |
| (emenda 1: D-I3, S-M4) `despausar encerra o lote` | A exportado, com e sem conferência; despausar | todos os arquivos com `closed_at` e `closed_reason = 'despausado'`; `arquivos_invalidados` continua contando só os que tinham conferência; reexportar com o mesmo nome regrava o lote com `closed_at` nulo |
| (emenda 1: D-I3, S-M4) `a remoção encerra os lotes anteriores do canal` | A exportado em dois lotes (o primeiro despausado, o segundo confirmado); remover | o segundo com `deleted_at`; nenhum arquivo de A com `deleted_at` nulo e `closed_at` nulo |
| (emenda 1: D-m8) `registro recusa com tarefa da forja em execução` | uma `youtube_intelligence_tasks` com `status = 'running'` e `target_video_id` de um vídeo de A; depois a mesma com `status = 'completed'` | `forja_em_andamento`; depois registra |
| (emenda 1: D-m5) `sugestões trazem a última leitura boa` | canal parado com `last_ok_synced_at` nulo; outro com leitura de ontem | os dois aparecem, cada um com o seu `last_ok_synced_at` (nulo no primeiro) |
| (emenda 1: S-M10) `os 6 minutos do banco são os do código` | `pg_get_functiondef('public.obs_archive_register(uuid,text,uuid,jsonb)'::regprocedure)` | o corpo contém `interval '6 minutes'` uma vez, e 6 = `RULES.pause.minMinutesBeforeExport` |
| (emenda 1: S-I3, D-I5) `tempo da remoção com um ano de dado` (medida, não só prova) | semente no site do teste: 200 vídeos, 365 dias de série diária por vídeo, 14 dias de leitura horária, versões e mudanças na proporção, 2.000 comentários com marcas; e 5 canais parados pequenos | grava no ledger e na seção 5.2 o tempo de `obs_archive_register`, `obs_archive_verify`, `competitor_channel_remove_archived` e `competitor_archive_suggestions`; falha se a remoção passar de 10 minutos (o teto do comando). O número é do `bythiago_int` no Mac do dono, não de produção: vale como ordem de grandeza, e o runbook diz isso. (emenda 2: S-m8, D-m7) A semente passa de 140 mil linhas: o caso fica num `describe` próprio que só roda com `E10_MEDIR=1` (sem a variável é pulado **e a saída diz "medida não rodada"**, nunca conta como passou), declara tempo-limite de 11 minutos e é rodado **em segundo plano, com a saída em arquivo** (um agente não fica mais de 4 minutos parado num comando). Enquanto a medida não rodar, as linhas "MEDIDA PENDENTE" da seção 5.2 continuam pendentes |

Os testes `aplica duas vezes`, `recusa sem as funções de que depende` e `âncora ausente faz a migration recusar` **ficam no roteiro psql** (precisam reaplicar o arquivo dentro de transação): Apêndice B.

**Testes de `observatorio-a5-e10-rls.test.ts`.** `anon não lê nenhuma das três tabelas` (por `has_table_privilege`); `usuário sem vínculo não lê obs_db_size_daily, forjando o GUC app.site_id` (item 231; usuário criado no teste, sem `super_admin`); `editor de um site lê obs_db_size_daily` (é o que `is_member_staff` dá); `editor do site lê obs_archive_batches e competitor_collection_pauses do seu site`; `editor de outro site, com o GUC forjado para este, não lê as duas` (mutação: trocar `can_edit_site(site_id)` por `true`); `authenticated não tem insert, update nem delete nas três` (por `has_table_privilege` e por tentativa, que tem de dar "permission denied"); (emenda 1: S-M1, D-m13) `authenticated não lê top_relations` (`has_column_privilege` falso para `top_relations` e verdadeiro para as cinco colunas do spec; um `select top_relations` como editor dá "permission denied"; o teste `editor de um site lê obs_db_size_daily` pede as cinco colunas pelo nome, nunca `*`); `as 17 funções: has_function_privilege falso para anon e authenticated`.
**Armadilhas.** Não usar `db:reset`. Os instantes de pausa são do relógio do banco (`clock_timestamp()`): para testar "pausado há 10 minutos" o teste atualiza `collection_paused_at` e `paused_at` direto, como o roteiro faz. A semente de `competitor_videos` não tem `site_id`.
**Pronto quando:** `diff` do arquivo contra o Apêndice A vazio; o roteiro deu a saída guardada, duas vezes, **com as diferenças esperadas da emenda 1 e só elas** (seção 11, última linha da tabela; a restrição da emenda 2 não muda a saída); a V4b rodou; os tempos estão na seção 5.2 (emenda 2: medidos com `E10_MEDIR=1`, em segundo plano); os dois arquivos de teste passam contra o `bythiago_int`.

### Tarefa 2: regras e modelo puro do sinal

**Arquivos.** `rules.ts` (quatro chaves; emenda 1), `arquivo/sinal-do-banco.ts`, o teste.
**Contrato.**

```ts
// rules.ts (acrescentar ao objeto RULES, em bloco próprio)
archiveCutMonths: 12,
dbSize: { limitMb: 500, yellowMb: 350, redMb: 425, redDaysToLimit: 90, trendMinDays: 14, trendWindowDays: 28, readingDayStartHourSP: 5, unmeasuredRedHours: 72 },
pause: { forgottenDays: 7, minMinutesBeforeExport: 6 },
archive: { blobPendingAlertDays: 3, blobRetryMaxPerDay: 200, suggestionFreshDays: 7 },   // emenda 1: D-I3, D-m5

// arquivo/sinal-do-banco.ts
export interface LinhaTamanho { day: string; db_bytes: number; competitor_bytes: number; own_bytes: number; measured_at: string }
export type CorDoBanco = 'verde' | 'amarelo' | 'vermelho'
export type Projecao =
  | { estado: 'nao_medida'; medidas: number; minimo: number }
  | { estado: 'sem_crescimento' }
  | { estado: 'medida'; mbPorDia: number; diasAteOLimite: number; chegaEm: string /* AAAA-MM */ }
export interface SinalDoBanco {
  estado: 'medido' | 'sem_leitura_hoje' | 'nunca_medido'
  cor: CorDoBanco | null
  diaDeLeitura: string
  ultima: { day: string; dbMb: number; competitorMb: number; ownMb: number; restoMb: number; medidoEm: string } | null
  horasSemMedida: number | null
  projecao: Projecao
  frase: string
}
export function diaDeLeitura(agoraMs: number, horaDeInicioSP?: number): string
export function sinalDoBanco(linhas: readonly LinhaTamanho[], agoraMs: number, regras?: typeof RULES.dbSize): SinalDoBanco
```

`minMinutesBeforeExport` é usado na frase e, pela emenda 1 (D-m4), na recusa antecipada do passo 3 de `exportarCanal`; quem decide de verdade é o banco, no registro. (emenda 1: S-M10) Dois testes amarram o número: aqui, `RULES.pause.minMinutesBeforeExport * 60_000 > LIMITE_FUNCAO_MS` (300 s, `agenda/relogio.ts:2`: a espera tem de cobrir um disparo inteiro); na integração da Tarefa 1, o literal do corpo da função. `sinal-do-banco.ts` importa `RULES` por caminho relativo.
**Testes (escrever primeiro; todos têm de falhar antes do código).**

| Nome | Entrada | Esperado |
|---|---|---|
| `dia de leitura: 04:59 de São Paulo ainda é ontem; 05:00 já é hoje` | dois instantes | datas certas |
| `tabela vazia` | `[]` | `nunca_medido`, `cor: null`, `ultima: null`, frase "banco: sem leitura hoje; nunca foi medido" |
| `sem a linha do dia (item 80)` | 10 linhas até ontem, verde | `sem_leitura_hoje`, **`cor: null`** (nunca verde), frase com a data e o valor de ontem, `horasSemMedida` > 0 |
| `sem a linha do dia, último nível amarelo` | última com 360 MB | `sem_leitura_hoje`, `cor: 'amarelo'` |
| `apagar a linha do dia muda o veredito` (item 80) | a mesma lista com e sem a última linha | `medido` verde; depois `sem_leitura_hoje` sem cor |
| `borda de 350 MB` | 349,99 MB; 350,00 MB | verde; amarelo |
| `borda de 425 MB` | 424,99; 425,00 | amarelo; vermelho |
| `borda de 90 dias` | reta que chega em 89 dias; em 90 dias | vermelho; não vermelho pela projeção |
| `borda de 14 medidas` | 13 linhas nos últimos 28 dias; 14 | `nao_medida` com `medidas: 13`; `medida` |
| `linha fora da janela de 28 dias não entra na reta` | 20 linhas, 10 delas com mais de 28 dias | `nao_medida`, `medidas: 10` |
| `reta parada ou descendo` | valores iguais; valores caindo | `sem_crescimento`; cor só pelo tamanho |
| `valor nulo, negativo ou não numérico numa linha` | linha com `db_bytes` inválido | a linha é ignorada e **contada**: a frase diz "N medida(s) ilegível(is)"; se era a de hoje, `sem_leitura_hoje` |
| `frase do spec` | 216 MB, reta chegando em jan/2030 | "banco: 216 de 500 MB; no ritmo dos últimos 28 dias, chega ao limite em jan/2030" |
| `já acima do limite` | 510 MB | vermelho; `diasAteOLimite: 0` |

**Pronto quando:** os testes passam; `typecheck` limpo; nenhum outro teste que confere `RULES` quebrou (o de `RULES.hourly` em `catalogo.test.ts` usa `toEqual` só na chave `hourly`).

### Tarefa 3: a medida e o leitor do sinal

**Contrato.**

```ts
// arquivo/medir-tamanho.ts
export const MOTIVOS_TAMANHO: Record<string, string>   // medida_falhou, resposta_invalida, inesperado
export function rodarTamanhoDoBanco(c: Pick<ContextoTarefa, 'sb' | 'agora'>): Promise<ResultadoTarefa>
// arquivo/ler-sinal.ts
export type SinalLido = { valor: SinalDoBanco } | { porque: 'schema_ausente' | 'erro_do_banco' | 'forma_invalida' | 'prazo' | 'excecao' }
export function lerSinalDoBanco(sb: SupabaseClient, agoraMs: number): Promise<SinalLido>
```

`rodarTamanhoDoBanco`: guarda `schemaTablesReady(sb, [['MG6', [['obs_db_size_daily', 'day, db_bytes, competitor_bytes, own_bytes, measured_at']]]], { signal: AbortSignal.timeout(BANCO_MS) })`; depois `sb.rpc('obs_db_size_record', { p_now: iso }).abortSignal(AbortSignal.timeout(BANCO_MS))`. Sucesso: `{ estado: 'ok', feitas: 1, deixadas: 0, detalhe: { db_mb, competitor_mb, own_mb } }`. Nunca lança (o `catch` devolve `inesperado` e relata ao Sentry só o código). `lerSinalDoBanco`: (emenda 1: D-m1) `select` das cinco colunas, `order by day desc limit 29`, **sem filtro de data** (uma ida ao banco; se a última medida tem 40 dias, ela vem, e o estado é `sem_leitura_hoje` com a data dela, e não `nunca_medido`); passa por um guarda de forma linha a linha; chama `sinalDoBanco`, que já deixa fora da reta o que tem mais de 28 dias.

(emenda 1: D-I1, D-I3) Terceiro módulo desta tarefa:

```ts
// arquivo/ler-pendencias.ts
export interface PendenciasDoArquivo {
  semExport: { valor: string[] } | { porque: string }                                                   // obs_archive_uncovered(); só nomes que casam com ^[a-z0-9_]+$, no máximo 5 na frase
  miniaturas: { valor: { urls: number; lotes: number; diasDaMaisAntiga: number | null } } | { porque: string }   // obs_archive_batches com table_name = 'competitor_channels', deleted_at preenchido e blob_urls_pending não vazio
}
export function lerPendenciasDoArquivo(sb: SupabaseClient, agoraMs: number): Promise<PendenciasDoArquivo>
```

As duas idas rodam em paralelo, cada uma com `AbortSignal.timeout(PROOF_MIN_MS)`, e cada parte falha sozinha. Nunca lança.
**Testes.**

| Nome | Entrada | Esperado |
|---|---|---|
| `medida ok` | função devolve o objeto certo | `ok`, `feitas: 1`, `detalhe` em MB inteiros |
| `tabela ausente` | guarda devolve `ausente` | `erro`, `schema_ausente`; **a função não é chamada** |
| `guarda não conferida` | guarda lança | `erro`, `schema_nao_conferido`; a função não é chamada |
| `erro do banco`, `prazo` | `error` preenchido; chamada pendurada | `erro`, `medida_falhou`; nenhuma mensagem do banco no resultado |
| `resposta nula`, `sem db_bytes`, `db_bytes 0`, `day de outro dia` | quatro respostas | `erro`, `resposta_invalida` nas quatro |
| `a função lança` | exceção | `erro`, `inesperado`; não propaga |
| `leitor: tabela ausente` | erro `42P01` e `PGRST205` | `{ porque: 'schema_ausente' }` |
| `leitor: lista vazia é "nunca medido", não erro` | `[]` | `valor.estado = 'nunca_medido'` |
| `leitor: resposta que não é lista` | `null`; objeto | `{ porque: 'forma_invalida' }` |
| `leitor: mais de 29 linhas não acontece` | a consulta limita | (emenda 1: D-m1) o teste confere `order('day', { ascending: false })` e `limit(29)`, e que **não** há filtro por data |
| (emenda 1: D-m1) `leitor: a última medida tem 40 dias` (mutação: recolocar o filtro de 29 dias) | uma linha, de 40 dias atrás, com 360 MB | `sem_leitura_hoje`, `cor: 'amarelo'`, a frase com a data dela; nunca `nunca_medido` |
| (emenda 1) `pendências: nada pendente` | `obs_archive_uncovered` devolve `{}`; nenhum lote com pendência | `semExport.valor = []`; `miniaturas.valor.urls = 0` |
| (emenda 1) `pendências: tabela sem export` | a função devolve `{competitor_x}` | `semExport.valor = ['competitor_x']`; nome fora de `^[a-z0-9_]+$` é trocado por "(nome ilegível)" e contado |
| (emenda 1) `pendências: miniaturas de dois canais removidos` | dois lotes, 3 e 2 URLs, removidos há 1 e 5 dias | `urls: 5`, `lotes: 2`, `diasDaMaisAntiga: 5` |
| (emenda 1) `pendências: uma leitura falha e a outra vem; erro é porque, nunca lista vazia` | a função lança; a tabela responde | `semExport.porque`; `miniaturas.valor` |

**Pronto quando:** testes verdes; nenhuma string do erro do banco aparece em valor devolvido (teste que injeta `message: 'segredo'` e procura).

### Tarefa 4a: pausa na sincronização

**Arquivos.** Os sete da tabela.
**Mudanças.**
1. `competitor-health.ts`: `schemaGroups` devolve, depois dos grupos de hoje, `['MG6', [['competitor_channels', 'collection_paused_at']]]`, para `'e1'` e para `'e1e2'`.
2. `competitor-sync-batch.ts`: `BatchRow` ganha `collection_paused_at: string | null`; `isBatchRow` exige o campo **presente** e `string` ou `null`; `loadBatchRows` acrescenta a coluna ao `select`; funções novas:
   ```ts
   export function semPausados(rows: BatchRow[]): BatchRow[]
   export interface NotasDePausa { acao: string[]; nota: string | null; esquecidos: Array<{ siteId: string; canalId: string; nome: string; dias: number }> }
   export function notasDePausa(rows: BatchRow[], nowMs: number): NotasDePausa
   ```
   Frases: nota `'N canal com a coleta pausada'` (ou `canais`); ação `'canal <nome> com a coleta pausada há N dias e ainda não removido: remover ou despausar'` para pausa com mais de `RULES.pause.forgottenDays`. O nome sai de `nameOf` (já limpa e corta). Data ilegível em `collection_paused_at` = conta como pausado e entra em `acao` com "há tempo desconhecido" (nunca some).
   No lote antigo (`runCompetitorBatch`): `const todas = await loadBatchRows(sb); const rows = semPausados(todas)`; tudo o que hoje usa `rows` continua usando `rows`; `acao_do_dono` passa a `[...ownerActions(rows, started), ...notasDePausa(todas, started).acao]`.
3. `competitor-sync.ts`: `SyncResult` e o resultado semanal ganham `paused?: boolean`. No modo `slot`, o `update` da trava ganha `.is('collection_paused_at', null)`; quando a trava não é tomada, **uma** leitura de `collection_paused_at` do canal decide `paused: true` (erro nessa leitura = `paused` indefinido, o resultado continua `skipped`). No modo `weekly`, a leitura de estado que já existe ganha a coluna e devolve `skipped: true, paused: true`.

**Testes (primeiro).**

| Nome | Entrada | Esperado |
|---|---|---|
| `um canal pausado entre 15: 14 sincronizações` (item 229; mutação: tirar `semPausados`) | 15 linhas devidas, uma com `collection_paused_at` | `syncCompetitorChannel` chamada 14 vezes, nunca com o id pausado; `remainingDue` 0 |
| `canal pausado não é dívida semanal` (mutação) | idem, na fase semanal | `pending` conta 14; `weeklyPendingCount` 14 |
| `canal pausado não segura "sobrou"` | lote que cabe | `remainingDue` 0; o disparo fecha `ok` |
| `linha sem o campo é forma inválida` | linha sem `collection_paused_at` | `loadBatchRows` lança "competitor batch" |
| `nota e ação` | pausado há 2 dias; há 8 dias; data ilegível | nota com 3; `acao` com o de 8 dias (com o nome e "8 dias") e o ilegível |
| `fronteira de 7 dias` | 7 dias exatos; 7 dias e 1 minuto | fora; dentro |
| `nenhum pausado` | 15 linhas sem pausa | `nota: null`, `acao: []` |
| (emenda 1: S-M12) `campo ausente é não pausado nas duas funções puras` | linha sem a chave `collection_paused_at` | `semPausados` mantém a linha; `notasDePausa` não a conta |
| (emenda 1: S-M8) `todos pausados` | 3 linhas, as 3 pausadas | `semPausados` devolve `[]`; o lote faz zero chamadas; `remainingDue` 0; a nota diz "3 canais com a coleta pausada"; o resultado **não** é erro |
| `a trava não é tomada com o canal pausado` (mutação: tirar o `.is(...)`) | harness com o canal pausado | zero chamadas à API; `skipped: true, paused: true`; `last_synced_at` não muda |
| `pausa gravada depois de a lista ser lida` | lista lida sem pausa; pausa antes da trava | idem (é a trava que decide) |
| `leitura semanal de canal pausado` | modo `weekly` | `skipped: true, paused: true`; zero chamadas |
| `guarda: coluna ausente` | `42703` para `collection_paused_at` | `schemaReady` devolve o texto com "MG6"; tipo `ausente` |

**Armadilhas.** Não mexer nos filtros `missing_since`: ausência do YouTube e pausa são coisas diferentes (canal ausente continua sendo tentado; pausado, não). Os testes existentes que montam `BatchRow` à mão precisam do campo novo: acrescentar `collection_paused_at: null` no construtor de linha do harness, e só. (emenda 1: S-M12) Três construtores de linha ficam fora da lista desta tarefa e montam `BatchRow` sem o campo (`test/youtube/agenda/fecho.test.ts:107`, `executar.test.ts:112`, `tarefas.test.ts:56`; não passam por `isBatchRow`): por isso `semPausados` e `notasDePausa` tratam campo **ausente** (`undefined`) como não pausado, comparando com `!= null`. Quem recusa a linha sem o campo é só `isBatchRow`, na leitura do banco. A Tarefa 9 acrescenta o campo nos dois construtores que estão na lista dela.
**Pronto quando:** os testes novos e os existentes dos três arquivos passam; `typecheck` limpo.

### Tarefa 4b: pausa na leitura horária

**Mudanças.** `gravar.ts`: `COLUNAS_CONCORRENTE` passa a `…competitor_channels!inner(site_id, missing_since, collection_paused_at)`; `eCanalEmbutido` exige o campo presente e `string` ou `null`; o candidato ganha `canalPausado: boolean`. `lista.ts`: `CandConcorrente.canalPausado`; `Fora.pausado`; em `montarLista`, depois do teste de ausente, `if (c.canalPausado) { fora.pausado += 1; continue }`. `executar.ts`: `fora_pausado` no detalhe. `agenda/tarefas/leitura-horaria.ts`: a guarda ganha o grupo `['MG6', [['competitor_channels', 'collection_paused_at']]]`.
**Testes (primeiro).** `vídeo de canal pausado sai da lista e é contado` (mutação: tirar o `continue`); `15 vídeos, um de canal pausado: 14 alvos` (item 229, conta os ids pedidos ao YouTube); `canal embutido sem o campo é forma inválida` (lista falha com `lista_falhou`, nunca lista vazia); `nenhum pausado: fora.pausado 0 e a lista igual à de antes`; `ausente e pausado ao mesmo tempo conta só em ausente` (a ordem dos testes é fixa); `guarda com a coluna ausente: schema_ausente e zero chamadas`.
**Pronto quando:** os testes dos três arquivos passam; nenhum teste existente mudou além de acrescentar o campo nos objetos de entrada.

### Tarefa 5: CSV e manifesto (puros)

**Contrato.**

```ts
// arquivo/csv.ts
export function linhaCsv(valores: ReadonlyArray<string | null>): string          // sem o fim de linha
export function lerCsv(texto: string): { colunas: string[]; linhas: Array<Array<string | null>> }
// arquivo/manifesto.ts
export const VERSAO_DO_MANIFESTO = 1
export interface ArquivoDoManifesto { tabela: string; canal: string; periodo: string /* AAAA-MM ou 'unico' */; periodStart: string; periodEnd: string; caminho: string; linhas: number; soma: string | null; menorChave: string | null; maiorChave: string | null; sha256: string; csvSha256: string; colunas: Array<{ nome: string; tipo: string; nulo: boolean }> }
export interface MiniaturaDoManifesto { url: string; caminhoNoBlob: string; caminho: string | null; bytes: number | null; sha256: string | null; ausente: boolean }
export interface Manifesto { versao: 1; script: string; lote: string; site: string; canal: { id: string; youtubeId: string; nome: string | null }; geradoEm: string; sessao: { timezone: 'UTC'; extraFloatDigits: 3 }; arquivos: ArquivoDoManifesto[]; tabelasSemLinha: string[]; tabelasAusentes: string[]; excluidas: Array<{ tabela: string; motivo: string }>; miniaturas: MiniaturaDoManifesto[]; esquema: Record<string, string /* create table reconstruído do catálogo */> }
export function caminhoDoArquivo(tabela: string, canal: string, periodo: string): string   // '<tabela>/<canal>/<AAAA-MM>.csv.gz'
export function nomeDoLote(canalId: string, dia: string): string                           // 'canal-<8>-<AAAA-MM-DD>'
export function validarManifesto(x: unknown): { valor: Manifesto } | { porque: string }
export function textoDoSha256(m: Manifesto, sha256DoManifestoJson: string): string         // formato de `sha256sum -c`
export function paraRegistro(m: Manifesto): Array<Record<string, unknown>>                 // o p_rows de obs_archive_register
```

Regras do CSV: separador vírgula; fim de linha `\n`; campo com vírgula, aspas, `\n` ou `\r` vai entre aspas com aspas dobradas; **nulo é campo vazio sem aspas; texto vazio é `""`**; primeira linha é o cabeçalho.
(emenda 2: S-m4) Terceiro módulo desta tarefa, `arquivo/codigos.ts`, puro e só com importação relativa: mora aqui o que a emenda 1 punha em `remover.ts` e que o comando também precisa: o tipo `CodigoE10`, `codigoE10(erro)` e `FRASES_E10` (contrato e regras na Tarefa 11a, sem mudança). `remover.ts` fala com o Blob e com o Sentry e o comando não pode importá-lo (restrição do `tsx`, seção 9); `cli.ts`, `exportar.ts`, `conferir.ts` e `remover.ts` importam de `codigos.ts`. Os testes de código e frase da Tarefa 11a (`um teste por código`, `mensagem sem o prefixo é inesperado`, `função ausente é schema_ausente`, `57014 vira demorou_demais`) passam para `arquivo-codigos.test.ts`, nesta tarefa.
**Testes.** `nulo e texto vazio são diferentes na ida e na volta`; `vírgula, aspas e quebra de linha dentro do campo` (item 74); `texto que parece número ou data volta igual`; `jsonb e vetor real[] como texto voltam byte a byte` (item 74, M-4: `{0.1,0.30000001,1e-05}`); `instante com fração volta igual`; `cabeçalho sem linhas`; `última linha sem fim de linha e com fim de linha`; `campo aberto sem fechar aspas lança`; `linha com número de campos diferente do cabeçalho lança` (nunca completa com nulo); `nome de lote`; `manifesto com chave faltando é recusado` (uma por vez, por laço sobre as chaves); `versão desconhecida é recusada`; `textoDoSha256 lista todo arquivo, toda miniatura presente e o manifesto.json`; `miniatura ausente não entra no sha256 e entra na contagem de ausentes`; `paraRegistro: blob_count, blob_bytes e blob_missing só nas linhas de competitor_video_versions, e nulo nas outras`.
**Pronto quando:** testes verdes; os três módulos (emenda 2: S-m4) sem importação fora de `node:` e relativa.

### Tarefa 6: exportar e conferir

**Contrato.**

```ts
// arquivo/sessao.ts
export interface ClienteSql { query(texto: string, valores?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }> }
export function abrirLeitura(sql: ClienteSql): Promise<void>     // begin isolation level repeatable read read only + os cinco `set local` + statement_timeout 60 s
export function fechar(sql: ClienteSql, como: 'commit' | 'rollback'): Promise<void>
export function consultaDoArquivo(e: { tabela: string; filtro: string; periodo: string | null; ordem: string; colunas: string[] }): string   // select "c1"::text, … where <filtro> and <mês> = $2 order by <ordem>
// arquivo/miniaturas.ts
export type Baixar = (url: string) => Promise<{ status: number; corpo: Uint8Array | null }>
export function baixarMiniaturas(urls: string[], o: { baixar: Baixar; paralelo: 4; tentativas: 3 }): Promise<Array<{ url: string; status: number; corpo: Uint8Array | null }>>
// arquivo/exportar.ts
export interface Disco { existe(p: string): Promise<boolean>; listar(p: string): Promise<string[]>; criarPasta(p: string, modo: number): Promise<void>; gravar(p: string, d: Uint8Array): Promise<void>; ler(p: string): Promise<Uint8Array>; apagar(p: string): Promise<void>; dentroDeRepositorio(p: string): Promise<boolean> }
export type ResultadoExport = { ok: true; lote: string; arquivos: number; linhas: number; miniaturas: number; miniaturasAusentes: number } | { ok: false; codigo: string; frase: string; detalhe?: string[] }
export function exportarCanal(o: { sql: ClienteSql; disco: Disco; baixar: Baixar; pastaRaiz: string; lote: string; siteId: string; canalId: string; aceitarMiniaturasAusentes: boolean; refazer: boolean; porIdade: boolean; agora: () => Date; versaoDoScript: string }): Promise<ResultadoExport>
// arquivo/conferir.ts
export type ResultadoConferencia = { ok: true; arquivos: number; miniaturas: number } | { ok: false; codigo: string; frase: string; diferencas: string[] /* até 20 */ }
export function conferirLote(o: { sql: ClienteSql; disco: Disco; pastaRaiz: string; lote: string; siteId: string; canalId: string }): Promise<ResultadoConferencia>
```

**Passos de `exportarCanal`, nesta ordem (a ordem é parte do contrato).**
1. `porIdade` verdadeiro: recusa `lote_por_idade_e_da_manutencao` (item 77, D10). Nome de lote fora de `^[a-z0-9][a-z0-9-]{2,60}$`: recusa.
2. Pasta: dentro de repositório git, recusa; existe e não está vazia e `refazer` falso, recusa; com `refazer`, apaga **só** os caminhos que o manifesto anterior lista (pasta sem manifesto legível e não vazia: recusa, nunca apaga às cegas).
3. `abrirLeitura`. Confere: canal no site; `collection_paused_at` preenchido; (emenda 1: D-m4) pausa com mais de `RULES.pause.minMinutesBeforeExport` minutos pelo relógio do banco (`select now()` na mesma transação), senão `pausa_recente`; `sync_status` diferente de `'syncing'` recente, senão `sincronizando`; `obs_archive_uncovered()` vazio. Qualquer um falha: `rollback` e recusa, **sem criar a pasta** (item 229). O banco confere os mesmos pontos de novo no passo 9.
4. Lê `obs_archive_registry()`, `obs_archive_excluded()` e `obs_archive_channel_counts(canal)`. Para cada tabela do registro: se `to_regclass` é nulo, vai para `tabelasAusentes`; se não tem linha, para `tabelasSemLinha`; senão, lê as colunas e os tipos (`format_type`) do catálogo, em ordem.
5. Para cada (tabela, mês): cursor de 5.000 linhas com `consultaDoArquivo`; escreve o CSV; calcula o sha256 do CSV sem compressão; comprime com gzip (nível 9); grava; calcula o sha256 do arquivo. **A contagem do arquivo tem de ser igual à de `obs_archive_channel_counts` para o mesmo par; senão para** (`contagem_do_arquivo_difere`).
6. (emenda 1: S-M3, ordem trocada com o passo 7) Lê, **ainda dentro da transação**, a lista das URLs distintas de `thumb_blob_url` das versões do canal, e então `fechar('commit')` (a transação é só de leitura). O retrato `repeatable read` não fica aberto em produção durante os downloads.
7. Miniaturas, **com a transação já fechada**: 200: grava em `miniaturas/<id do vídeo>/<arquivo>` e registra bytes e sha256. 404: `ausente`; sem `aceitarMiniaturasAusentes`, para com a contagem. Outro status ou prazo, depois de 3 tentativas: para.
8. Grava `manifesto.json` e `manifesto.sha256` (**por último**: pasta sem manifesto é pasta sem valor).
9. Numa segunda transação, de escrita: `select public.obs_archive_register($1, $2, $3, $4)`. Se lançar, `rollback` e devolve o código; os arquivos ficam no disco e o lote não existe no banco.

**Passos de `conferirLote`.** (a) manifesto válido e `manifesto.sha256` batendo com **todo** arquivo e toda miniatura presente; arquivo listado que falta ou arquivo na pasta que o manifesto não lista: diferença. (b) Cada CSV: descomprime, confere o `csvSha256`, o cabeçalho contra `colunas`, o número de registros contra `linhas`, a soma contra `soma`. (c) No banco, com `abrirLeitura`: refaz cada consulta e compara o sha256 do CSV que ela daria com `csvSha256`; compara o conjunto de URLs de miniatura com o do manifesto. (d) Só com tudo igual: `select public.obs_archive_verify(…)`. Em qualquer diferença: lista até 20, não marca nada, devolve `ok: false`.
**Testes unitários** (cliente, disco e `fetch` falsos).

| Nome | Entrada | Esperado |
|---|---|---|
| `lote por idade é recusado` (item 77) | `porIdade: true` | recusa; nenhuma consulta |
| `canal não pausado: recusa sem criar a pasta` (item 229) | canal com a coluna nula | recusa; `criarPasta` nunca chamado |
| `canal de outro site` (mutação: tirar o filtro de site da leitura do canal) | site errado | `canal_nao_encontrado`; nada escrito |
| `tabela sem export` | `obs_archive_uncovered` devolve um nome | recusa com o nome |
| `pasta dentro de repositório` | `dentroDeRepositorio: true` | recusa |
| `tabela sem linha e tabela ausente vão para o manifesto` | uma de cada | listas certas; nenhum arquivo delas |
| `erro do banco no meio: nenhum manifesto` | a 3ª consulta lança | `ok: false`; `manifesto.json` nunca gravado; `rollback` chamado |
| `contagem do arquivo difere da do banco` | cursor devolve uma linha a menos | para; nenhum manifesto |
| `mais de 5.000 linhas: o cursor é lido até o fim` | 12.001 linhas | arquivo com 12.001 registros |
| `miniatura 404 sem a opção` e `com a opção` | uma 404 entre três | para com "1 miniatura ausente"; com a opção, segue e `blob_missing` = 1 |
| `miniatura 500, 429, 403 e prazo` | cada um, três vezes | para; nenhum manifesto; três tentativas contadas |
| `o registro recusa: os arquivos ficam e o resultado diz o código` | `obs_archive_register` lança `E10:banco_difere_do_manifesto: …` | `codigo: 'banco_difere_do_manifesto'`; a frase vem do catálogo, não do banco |
| `a sessão é fixada antes de qualquer leitura` | registrar a ordem das consultas | as seis instruções de `abrirLeitura` antes do primeiro `select` de dado |
| (emenda 1: D-m4) `pausa de 2 minutos: recusa antes de criar a pasta` (mutação: tirar a conferência do passo 3) | canal pausado há 2 minutos | `pausa_recente`; `criarPasta` e `baixar` nunca chamados |
| (emenda 1: S-M3) `nenhuma miniatura é baixada com a transação aberta` (mutação: voltar a ordem) | registrar a ordem das chamadas | o `commit` da leitura vem antes da primeira chamada de `baixar` |
| `conferir: um byte trocado numa miniatura` (item 230) | disco com um byte diferente | `ok: false`, diferença com o caminho; `obs_archive_verify` não chamada |
| `conferir: arquivo a mais na pasta`, `arquivo faltando`, `sha256 do gzip diferente`, `registro a menos`, `soma diferente` | um por vez | diferença nomeada em cada um; nada marcado |
| `conferir: o banco mudou depois do export` | a consulta devolve uma linha a mais | diferença com tabela e mês; nada marcado |
| `conferir: miniatura nova no banco que o manifesto não tem` | URL a mais | diferença; nada marcado |
| `conferir sem manifesto` | pasta sem o arquivo | `sem_manifesto` |

**Teste de integração `observatorio-a5-e10-ida-e-volta.test.ts`** (banco `bythiago_int`, com `pg`; pasta temporária do sistema; miniaturas servidas por um `baixar` falso).
- `ida e volta` (item 74): semente de um canal com linhas em todas as tabelas do registro que existem, incluindo: `jsonb` com aspas e unicode, texto com vírgula e com quebra de linha, texto vazio e nulo na mesma coluna, `real[]` do mapa de horas com valores que não têm representação decimal curta, instante com microssegundos, `bigint` acima de 2^53. Exporta, confere, e para cada arquivo recarrega as linhas numa tabela temporária (`create temp table … (like public.<tabela>)`, com `insert` de parâmetros de texto convertidos pelo tipo do manifesto) e compara com o original nos dois sentidos (`except`): zero linhas de diferença em todas.
- `conferir marca o lote; trocar um byte de um CSV faz conferir parar e não marca`.
- `reexportar zera verified_at e nas_confirmed_at` (item 230).
- `blob_count e blob_bytes batem com as miniaturas baixadas` (item 230).
- `com a sincronização rodando no meio a contagem não muda` (item 229): pausar, exportar, chamar `syncCompetitorChannel` do canal com `fetch` que falha o teste se for chamado, chamar a montagem da lista horária e `competitor_comment_due`; `obs_archive_diff` continua vazio.
- `remoção de canal não é bloqueada por vídeo com idade 30 fechada e sem marca` (item 77, segundo caso): vídeo publicado há 40 dias, sem marca; o fluxo inteiro termina em `removido`.

**(emenda 1: D-m9, S-M9) Prova de recarga pelo comando que o runbook manda.** O teste de ida e volta recarrega por `insert`, e o runbook manda `\copy`. São caminhos diferentes, e `pg-copy-streams` não está instalado (F13), então a prova do `\copy` é um roteiro `psql`, `.superpowers/sdd/a5-e10/recarga-prova.sql`, com a saída guardada ao lado: para três arquivos exportados pelo teste (um com nulo e texto vazio na mesma coluna, um com `real[]`, um com `jsonb`), `create temp table x (like public.<tabela>)`, depois a linha que `comandos-recarga` imprime (`\copy x (c1, c2, ...) from program 'gzip -dc <arquivo>' csv header`, **com a lista de colunas do manifesto**) e a comparação com o original por `except` nos dois sentidos: zero linhas. Sem a lista de colunas, um arquivo antigo deixaria de recarregar no dia em que a tabela ganhasse coluna (`csv header` não casa por nome).

**Armadilhas.** `gzip` do Node grava a hora no cabeçalho por padrão em algumas versões: comprimir com as opções que zeram a hora não é necessário para a prova (o sha256 é do arquivo gravado, e não é refeito por recompressão), mas `conferir` nunca recomprime para comparar. `bigint` chega do `pg` como texto: não converter para `number`. O cursor (`declare … cursor` e `fetch`) só existe dentro da transação aberta.
**Pronto quando:** unitários verdes; o teste de integração verde contra o `bythiago_int` com a MG6 aplicada; (emenda 1) o roteiro de recarga rodado, com a saída guardada e zero linhas de diferença.

### Tarefa 7: o comando

(emenda 2: S-m4) As frases e os códigos vêm de `arquivo/codigos.ts` (Tarefa 5, de que esta já depende); `cli.ts` **não** importa `remover.ts`.
**Contrato.** `arquivo/cli.ts` exporta `interpretar(argv: string[], env: NodeJS.ProcessEnv): Comando | { erro: string }` (puro) e `rodar(comando, deps): Promise<{ codigo: 0 | 1 | 2; saida: string[] }>`. `scripts/obs-arquivo.ts` só cria o `pg.Client` com `process.env.OBS_ARQUIVO_DB_URL`, o disco real, o `fetch` real, chama `rodar`, imprime e sai.

| Subcomando | Argumentos | O que faz |
|---|---|---|
| `estado` | `[--site <uuid>]` | lista canais pausados, lotes e em que passo cada um está, e o sinal do banco; só leitura. (emenda 2: D-m8, D-m9) Lista também os lotes **encerrados** (com o motivo e a pasta, para o dono decidir se apaga do disco) e o número de lotes de canal que não existe mais, marcado "histórico, não pendência" |
| `pausar` | `--canal <uuid> --por <e-mail>` | `competitor_channel_pause` |
| `despausar` | `--canal <uuid> --por <e-mail>` | `competitor_channel_unpause`; avisa quantos arquivos perderam a conferência |
| `exportar` | `--canal <uuid> [--lote <nome>] [--pasta <raiz>] [--refazer] [--aceitar-miniaturas-ausentes]` | `exportarCanal`; a raiz padrão é `~/Workspace/arquivo-observatorio` |
| `conferir` | `--canal <uuid> --lote <nome> [--pasta <raiz>]` | `conferirLote` |
| `comandos-nas` | `--lote <nome> --destino <usuario@host:/caminho>` | **só imprime**, um por linha: o `rsync` da pasta, e o `ssh … 'cd … && sha256sum -c manifesto.sha256'`. Não executa nada |
| `confirmar-nas` | `--canal <uuid> --lote <nome> --por <e-mail>` | recusa se a entrada não é um terminal; pede o nome do lote digitado; `obs_archive_confirm_nas` |
| `remover` (emenda 1: S-I3, D-I5) | `--canal <uuid> --por <e-mail>` | recusa se a entrada não é um terminal; confere `obs_archive_is_site_admin` para o `--por`; mostra o nome do canal e o lote que vai liberar a remoção e pede o nome do lote digitado; numa transação com `set local statement_timeout = '10min'`, chama `competitor_channel_remove_archived`; se o lote devolvido não for o digitado, `rollback` e recusa (`lote_mudou`); imprime linhas, arquivos e quantas miniaturas ficaram pendentes no Blob (a tarefa diária as apaga, até 200 por dia) e, (emenda 2: S-m6) a linha "o canal pode continuar aparecendo no CMS por até 15 minutos" (o comando não invalida o cache do CMS, que vale 900 s: `load-page.ts:24`). **Só o dono roda**, como `confirmar-nas` |
| `comandos-recarga` (emenda 1: D-m9) | `--lote <nome> [--pasta <raiz>]` | **só imprime**, um por linha e na ordem pai antes de filho, o `\copy <tabela> (<colunas do manifesto>) from program 'gzip -dc <arquivo>' csv header` de cada arquivo. Lê só o manifesto; não chama o banco |

Códigos de saída: 0 feito; 1 recusado ou diferença; 2 argumento ou ambiente inválido. `--site` é opcional: sem ele vale o único site que tem canal de concorrente; mais de um, exige a opção. O e-mail de `--por` é resolvido para o id em `auth.users` (zero ou mais de um resultado: código 2). (emenda 1: S-I3) O subcomando `remover` existe e é o caminho que não depende da Tarefa 11b nem do teto de tempo da API do banco; a remoção pelo CMS (Tarefa 11b) continua sendo o caminho de todo dia quando a C10 e a medida de tempo permitirem.
**Testes.** `variável ausente: código 2, e nenhuma leitura de .env.local` (teste que **apaga** `OBS_ARQUIVO_DB_URL`); `variável vazia: código 2`; `subcomando desconhecido`; `--canal que não é uuid`; `--lote com maiúscula ou barra`; `raiz padrão quando --pasta falta` (com `HOME` injetado); `confirmar-nas sem terminal recusa` ; `confirmar-nas com o nome digitado diferente recusa`; `comandos-nas não chama o banco nem o disco` (dependências que falham se chamadas); `--por com e-mail que não existe`; `a URL do banco nunca aparece na saída` (injeta uma senha e procura); `código do banco vira frase do catálogo` (um teste por código de `E10:`); (emenda 1) `remover sem terminal recusa e não abre transação`; `remover com o nome do lote digitado errado recusa`; `remover com --por que não administra o site recusa antes de chamar a função`; `remover: o lote devolvido difere do digitado: rollback` (mutação: tirar a comparação); `remover declara o statement_timeout antes de chamar a função` (ordem das instruções); `remover: 57014 vira demorou_demais e a saída diz que nada foi apagado`; `comandos-recarga não chama o banco, lista as colunas do manifesto e põe pai antes de filho`; (emenda 2: S-m6, D-m8, S-m4) `remover avisa dos 15 minutos de cache`; `estado lista o lote encerrado com o motivo e a pasta`; `cli.ts não importa remover.ts` (lê o texto-fonte).
**Pronto quando:** testes verdes; `npx tsx scripts/obs-arquivo.ts` sem argumento imprime o uso e sai com 2 (rodado à mão contra nada: sem a variável ele não conecta).

### Tarefa 8: leitores sem tela

**Contrato.**

```ts
// arquivo/aviso.ts
export interface LoteAberto { lote: string; canalRef: string; canalNome: string | null; exportadoEm: string; conferido: boolean; dias: number; arquivos: number }
export interface AvisoDoArquivo {
  banco: SinalLido
  lotesNaoConfirmados: { valor: LoteAberto[] } | { porque: string }
  lotesDeCanalInexistente: { valor: number } | { porque: string }   // emenda 1: D-I3, S-M4
  pausados: { valor: Array<{ canalId: string; nome: string | null; desde: string; dias: number; esquecido: boolean }> } | { porque: string }
  miniaturasPendentes: { valor: number } | { porque: string }
}
export function lerAvisoDoArquivo(sb: SupabaseClient, siteId: string, agoraMs: number): Promise<AvisoDoArquivo>
// arquivo/sugestoes.ts
export type Sugestoes = { valor: { avaliados: number; semVideo: number; cortaEmMeses: number; itens: Array<{ canalId: string; nome: string | null; ultimaPublicacao: string; videos: number; linhas: number; mbEstimado: number }> } } | { porque: string }
export function lerSugestoes(sb: SupabaseClient, siteId: string, agoraMs: number): Promise<Sugestoes>
```

Cada parte do aviso falha sozinha (uma leitura que falha não zera as outras). `mbEstimado` = `linhas × 156 B`, e o nome diz que é estimativa. Quem chama já fez `requireEditAccess`; o comentário do arquivo diz isso na primeira linha.
(emenda 1: D-I3, S-M4) "Lote aberto" é o que tem `deleted_at` nulo **e** `closed_at` nulo **e** cujo `channel_ref` ainda existe em `competitor_channels` do site. Lote encerrado não aparece; lote aberto de canal que não existe mais não aparece na lista e é contado em `lotesDeCanalInexistente`. (emenda 1: D-m5) Em `lerSugestoes`, cada item ganha `ultimaLeituraBoa: string | null` e `naoAvaliado: boolean` (verdadeiro quando `last_ok_synced_at` é nulo ou tem mais de `RULES.archive.suggestionFreshDays` dias): a tela futura mostra esses canais como "não avaliado: sem leitura boa há N dias", e não como sugestão de arquivar.
**Testes.** `lote exportado e não confirmado aparece; confirmado some; apagado some`; (emenda 1) `lote encerrado por despausar some; lote substituído some`; `lote aberto de canal que não existe mais não é listado e é contado` (mutação: tirar a conferência do canal); `sugestão de canal sem leitura boa há 8 dias vem com naoAvaliado: true; com leitura de ontem, false; com last_ok_synced_at nulo, true`; `lotes de outro site não aparecem` (mutação: tirar `.eq('site_id', siteId)`); `pausado há 8 dias vem com esquecido: true`; `canal pausado de outro site não aparece` (mutação); `uma leitura falha e as outras vêm`; `lista vazia é lista vazia; erro é porque` (nunca trocados); `miniaturas pendentes somam as URLs`; `sugestões: resposta nula é forma_invalida, não lista vazia`; `sugestões: avaliados 0 e itens vazio são devolvidos como estão`; `sugestões usam RULES.archiveCutMonths` (teste que confere o argumento).
**Pronto quando:** testes verdes; nenhum componente criado.

### Tarefa 9: integração na agenda

**Mudanças.**
1. `definicoes.ts`: `DEFINICAO_TAMANHO_DO_BANCO` (`nome: 'tamanho_do_banco'`, `rotulo: 'tamanho do banco'`, `ordem: 4`, `peso: 'leve'`, `periodo: 'dia'`, `aPartirDaHoraSP: 5`, `tetoTentativas: 12`, `toleranciaVigiaH: 36`, `naoTerminouVermelhoEm: null`, `comecaAteMs: LEVE_COMECA_ATE_MS`, `fimAteMs: 85_000`, `motivos` = os três de `MOTIVOS_TAMANHO`, **escritos por extenso aqui**: este módulo é leve e não importa `observatorio/arquivo`). `TODAS_AS_DEFINICOES` passa a incluí-la.
2. `tarefas/tamanho-do-banco.ts` (novo): `export const tamanhoDoBanco: Tarefa = { ...DEFINICAO_TAMANHO_DO_BANCO, rodar: c => rodarTamanhoDoBanco(c) }`. `catalogo.ts`: uma importação e uma entrada, na posição da ordem 4.
3. `aviso.ts`: `ChaveAviso` ganha `'banco_no_limite'` e `'coleta_pausada_esquecida'`; `Aviso` ganha `periodo?: 'dia' | 'semana' | 'mes'` (padrão `'dia'`: nada muda para os avisos de hoje); a chave de dedupe usa o dia, a semana ISO de São Paulo (`AAAA-Www`) ou o mês (`AAAA-MM`); `textoDe` ganha os dois títulos ("O banco do site está chegando ao limite do plano", "Um canal está com a coleta pausada há mais de 7 dias"). (emenda 1: S-M7) Hoje `textoDe` cai em "A tarefa X esgotou as tentativas" para toda chave que não é `leitura_horaria_parada` (`agenda/aviso.ts:35-52`): o `if` final vira ramo explícito por chave, e o TypeScript recusa chave sem ramo.
4. `extras-arquivo.ts` (novo, puro):
   ```ts
   export interface ExtrasDoDisparo { acao: string[]; notas: string[]; avisos: Aviso[]; problemas: string[]; banco: Record<string, unknown> }
   export function extrasDoDisparo(e: { todas: BatchRow[] | null; sinal: SinalLido | { porque: 'prazo' }; agoraMs: number; agendaDesde: string | null; pendencias: PendenciasDoArquivo | { porque: 'prazo' }; tamanhoOkHa36h: boolean | null }): ExtrasDoDisparo   // emenda 1: os dois últimos campos (D-I1, D-I3, S-I2)
   export function juntarVermelho(f: { vermelho: boolean; mensagem: string | null }, problemas: string[], max: number): { vermelho: boolean; mensagem: string | null }
   ```
5. `executar.ts`, um bloco: depois de ler os canais, `const todas = lidas.valor; linhas = semPausados(todas)`; depois de `despachar`, `const [f, sinal] = await Promise.all([fecharDisparo({ … }), comPrazo(lerSinalDoBanco(sb, agora()), PROOF_MIN_MS)])`; `const extras = extrasDoDisparo(…)`; o vermelho e a mensagem passam por `juntarVermelho` (respeita `CRON_MESSAGE_MAX`); `acao_do_dono: [...f.acaoDoDono, ...extras.acao]`; `notas.push(...extras.notas)`; os avisos enviados são `[...f.avisos, ...extras.avisos]`; a resposta ganha `banco: extras.banco`.
6. (emenda 1: D-I1, D-I3, S-I2) No mesmo bloco de `executar.ts`, a leitura das pendências entra no mesmo `Promise.all` (`comPrazo(lerPendenciasDoArquivo(sb, agora()), PROOF_MIN_MS)`), e `tamanhoOkHa36h` sai do estado da agenda que já está na mão (`last_ok_at` de `tamanho_do_banco`; estado não lido = `null`). Regras novas de `extrasDoDisparo`: sinal não lido por `forma_invalida` ou `schema_ausente` vai para `problemas`; por `prazo`, `erro_do_banco` ou `excecao` vai para `notas` e, com `tamanhoOkHa36h` verdadeiro, também para `acao`; `semExport` não vazio vira a linha "arquivo: N tabela(s) sem export: <nomes>" em `acao`; miniaturas pendentes com `diasDaMaisAntiga` maior ou igual a `RULES.archive.blobPendingAlertDays` viram "N miniatura(s) de canal removido ainda públicas há D dias" em `acao`; pendências não lidas viram a nota "arquivo: não foi possível ler as pendências". (emenda 2: S-m3) Com `agendaDesde: null` e `todas: null` (o caminho sem agenda), sinal não lido por qualquer causa vai também para `acao`. (emenda 2: D-m3) A linha das miniaturas termina com o ritmo: "; a tarefa diária apaga até 200 por dia: no ritmo normal faltam K dia(s)".
7. (emenda 1: S-I1; **reescrito pela emenda 2: N1**) O caminho sem agenda. A emenda 1 mudava `AntesDoLote` e fazia `rodarAntesDoLoteAntigo` ler o banco também com a lista vazia. Conferido no código, isso quebrava o que está fora da lista da tarefa: `cron-competitors-prova.test.ts:19` e `cron-competitors-invalidate.test.ts:18` trocam a função por um falso sem os campos novos (42 testes); `cron-competitors-agenda.test.ts:73` confere o texto literal desse falso; `route.ts:87` inicia `antes` com a forma antiga; e o contrato "lista vazia devolve na hora, sem ida ao banco" (`agenda/executar.ts:163-165`) é afirmado em `executar.test.ts:660-664` e usado de propósito por `test/integration/agenda-despacho.test.ts:48`. **Por isso `AntesDoLote` e `rodarAntesDoLoteAntigo` não mudam.** O que entra:
   - Módulo novo `agenda/arquivo-sem-agenda.ts` (só desta etapa):
     ```ts
     export interface ArquivoSemAgenda { problemas: string[]; notas: string[]; acao: string[]; banco: Record<string, unknown> }
     export function lerArquivoSemAgenda(o: { supabase: SupabaseClient; agora?: () => number; ler?: { sinal: typeof lerSinalDoBanco; pendencias: typeof lerPendenciasDoArquivo } }): Promise<ArquivoSemAgenda>
     ```
     Lê o sinal e as pendências em paralelo, cada um com `comPrazo(…, PROOF_MIN_MS)`, e chama `extrasDoDisparo` com `todas: null`, `agendaDesde: null` e `tamanhoOkHa36h: null`. **Nunca lança** (o `catch` devolve a nota "banco: não foi possível ler o tamanho", a mesma frase em `acao` e `banco: { nao_lido: 'excecao' }`). `banco` **nunca** volta vazio: ou traz o estado, ou `nao_lido`. (emenda 2: S-m3) Com `agendaDesde: null` e `todas: null`, `extrasDoDisparo` põe o sinal não lido, por qualquer causa, também em `acao`. Com `agendaDesde: null`, "nunca medido" não fica vermelho (não há de onde contar as 72 h): fica a linha em `acao`. A medida não entra em `antesDoLoteAntigo` (não é `nuncaDesliga`).
   - Em `route.ts`, quatro pontos e só eles: (i) a importação; (ii) `let arquivo: ArquivoSemAgenda | null = null` ao lado de `antes`, e `arquivo = await lerArquivoSemAgenda({ supabase })` logo depois de `rodarAntesDoLoteAntigo` (linha 98 de hoje), dentro do mesmo `if (mode === 'competitors')`; (iii) em `alemDoLote`: `...(arquivo && Object.keys(arquivo.banco).length > 0 ? { banco: arquivo.banco } : {})`, `...(arquivo && arquivo.acao.length > 0 ? { acao_do_dono_arquivo: arquivo.acao } : {})`, e `notas_antes` passa a juntar `antes.notas` e `arquivo.notas`; (iv) nos três pontos em que `antes.problemas` entra no vermelho (linhas 174, 190 e 220-221 de hoje), a lista passa a ser `[...antes.problemas, ...(arquivo?.problemas ?? [])]`, por uma constante só, declarada uma vez. `arquivo` é `null` só quando a agenda rodou e respondeu (aí a rota já devolveu antes): o `?? []` não esconde forma errada, porque o tipo é conferido.
   - O campo `acao_do_dono_arquivo` continua separado do `acao_do_dono` do lote antigo: este é `string[]` e só vai para a resposta e o log (`competitor-sync-batch.ts:141, 377`), e `cron-competitors-prova.test.ts:361` compara a lista inteira com `toEqual`; juntar os dois quebraria esse teste sem ganho.
   - Nos três arquivos de teste que passam pela rota com a agenda desligada (`cron-competitors-prova`, `cron-competitors-invalidate`, `agenda-despacho`), **uma** linha: `vi.mock('@/lib/youtube/agenda/arquivo-sem-agenda', () => ({ lerArquivoSemAgenda: vi.fn(async () => ({ problemas: [], notas: [], acao: [], banco: {} })) }))`. Sem ela a função de verdade rodaria contra o cliente falso desses testes (resultado imprevisível, podendo virar `forma_invalida` e vermelho) ou, na integração, leria `obs_db_size_daily` do banco compartilhado num caso desenhado para não tocá-lo. É arranjo, não afirmação; o falso neutro (`banco: {}`) só existe em teste. O falso de `rodarAntesDoLoteAntigo` e o literal da linha 73 ficam como estão.
8. (emenda 1: D-I3) `tarefas/tamanho-do-banco.ts`: depois de `rodarTamanhoDoBanco`, e só se faltarem mais de 25 s para o `fimAteMs`, chama `retentarMiniaturasPendentes` (Tarefa 11a). O resultado da tarefa continua sendo o da medida: a nova tentativa só acrescenta números ao `detalhe` (`miniaturas_apagadas`, `miniaturas_pendentes`, `miniaturas_sem_tempo`) e nunca troca `ok` por `erro`.
   **Bordas (emenda 2: D-m2, S-m1, S-m7).** (a) A tentativa **só roda quando a medida deu `ok`**. Medida com erro: não tenta, e a tarefa volta no disparo seguinte só para medir. Como a tarefa não roda de novo no dia depois do `ok`, a tentativa acontece **uma vez por dia**, e `blobRetryMaxPerDay` (200) é de fato o máximo do dia, e não 200 por cada uma das até 12 tentativas. (b) `retentarMiniaturasPendentes` devolve `{ porque }` (token ausente, lista não lida): o `detalhe` ganha `miniaturas_nao_tentadas: 1`, e **não** `miniaturas_apagadas: 0`, que quereria dizer "nada a fazer". (c) URL fora do prefixo: `miniaturas_fora_do_prefixo: N`. (d) A tentativa inteira roda dentro de `comPrazo(…, min(20 s, fimAteMs − agora − 5 s))`; estourou: `miniaturas_sem_tempo: 1` e a tarefa devolve `ok` **antes** do `fimAteMs` (sem isso, um Blob pendurado faria o despachante encerrar a tarefa com `passou_do_tempo`: medida gravada e tarefa vermelha, repetindo até 12 vezes). O mesmo prazo vai como `abortSignal` para o `del`. **Conferência pendente** (a leitura de `node_modules` foi negada a este autor): `grep -n "abortSignal" node_modules/@vercel/blob/dist/index.d.ts`. Se o `del` instalado não aceitar o sinal, fica só o `comPrazo`: a tarefa devolve no tempo do mesmo jeito e a chamada pendurada é abandonada. Se a tentativa for cortada depois de o Blob apagar e antes de a pendência ser baixada, as mesmas URLs são pedidas de novo no dia seguinte; **não está medido** se o `del` aceita URL que já não existe: se recusar, a pendência não desce e a linha dos 3 dias aparece (visível, sem perda).

**Testes (primeiro).**

| Nome | Onde | Esperado |
|---|---|---|
| `são seis, em ordem` | `catalogo.test.ts` (asserts existentes atualizados) | nomes `leitura_horaria, anular_identidade, tamanho_do_banco, sincronizar_canais, retratos_comentarios, serie_semanal`; ordens `1, 2, 4, 6, 7, 8` |
| `tamanho_do_banco, valor por valor` | idem | todos os campos da definição; começo antes do fim; fim dentro de `LEVE_FIM_MS` |
| `o vigia acusa tamanho_do_banco pelo nome` (itens 80 e 211) | `saude.test.ts` | apagando as linhas `ok` dela, o relatório a traz `late` com as outras em dia; em `OBS_AGENDA_TASKS_OFF`, "desligada" (teste que **apaga** a variável: ligada) |
| `arranque com o catálogo real` (item 214, OP-3) | `tarefas.test.ts` | com a tabela de execuções vazia e tudo devido às 13:00: a horária, as duas leves e uma pesada rodam; as outras pesadas ficam `adiada` com `uma_pesada_por_disparo` |
| `pior disparo com o catálogo real` (item 215, OP-3) | idem | cada tarefa gastando até o seu `fimAteMs`: nenhuma começa depois do seu `comecaAteMs`, nunca duas pesadas, fim dentro de `LIMITE_FUNCAO_MS` menos a reserva |
| `a leve que não coube vira adiada sem_tempo` | idem | com `anular_identidade` terminando aos 85 s, `tamanho_do_banco` não começa e não gasta tentativa |
| `chave de aviso por semana e por mês` | `aviso.test.ts` | dois avisos `banco_no_limite` no mesmo mês com `periodo: 'mes'` dão a mesma chave; em meses diferentes, chaves diferentes; os avisos de hoje (sem `periodo`) têm a chave de antes, byte a byte |
| `extras: sinal verde, sem pausa` | `extras-arquivo.test.ts` | `acao: []`, `problemas: []`, `avisos: []`, `banco` com estado e cor |
| `extras: amarelo` e `vermelho` | idem | uma linha em `acao`; um aviso por site com `periodo` `'mes'` e `'semana'`; `problemas: []` (P2) |
| `extras: sem leitura há 10 h` e `há 73 h` | idem | linha em `acao` nas duas; `problemas` vazio na primeira e com a frase na segunda |
| `extras: nunca medido com a agenda de 1 h` e `de 80 h` | idem | sem problema; com problema |
| `extras: sinal não lido` | `{ porque: 'prazo' }` | nota "banco: não foi possível ler o tamanho"; `banco: { nao_lido: 'prazo' }`; sem problema; **sem** a palavra "verde" nem cor |
| (emenda 1: S-I2) `extras: sinal não lido, uma causa por teste` (mutação: trocar `problemas` por `notas`) | `forma_invalida`; `schema_ausente`; `erro_do_banco`; `excecao` | as duas primeiras em `problemas`; as duas últimas só em `notas` |
| (emenda 1: S-I2) `extras: leitura transitória falhando com a medida em dia` | `{ porque: 'erro_do_banco' }` com `tamanhoOkHa36h: true`; com `false`; com `null` | linha em `acao` só no primeiro caso |
| (emenda 1: D-I1) `extras: tabela sem export` | `semExport.valor = ['competitor_x']` | uma linha em `acao` com o nome; `problemas: []` |
| (emenda 1: D-I3) `extras: miniaturas pendentes há 2 dias e há 3 dias` | `diasDaMaisAntiga` 2; 3 | sem linha; com a linha, com a contagem e os dias; (emenda 2: D-m3) com 450 URLs a linha diz "faltam 3 dia(s)", e com 200, "falta 1" |
| (emenda 1) `extras: pendências não lidas` | `{ porque: 'prazo' }` | nota "arquivo: não foi possível ler as pendências"; nenhuma linha "nenhuma pendência" |
| (emenda 1: S-M7) `cada ChaveAviso tem o seu título` (mutação: esquecer o ramo de `banco_no_limite`) | `aviso.test.ts`, um aviso por chave | quatro títulos diferentes; nenhum das chaves novas contém "esgotou as tentativas" |
| (emenda 1: S-I1) `agenda desligada, última medida há 73 h` e `há 10 h` | `cron-competitors-agenda.test.ts`, com `OBS_AGENDA=off` (emenda 2: N1: neste arquivo `lerArquivoSemAgenda` é falso de módulo com o resultado de cada caso; a leitura de verdade é provada em `arquivo-sem-agenda.test.ts`) | cron **vermelho** com a frase do banco no primeiro; no segundo, verde com `acao_do_dono_arquivo` trazendo "sem leitura hoje" e o campo `banco` na resposta |
| (emenda 1: S-I1) `guarda da MG10 falhando: o sinal é lido do mesmo jeito` | idem, com a guarda falhando (emenda 2: N1: `lerArquivoSemAgenda` chamada uma vez, depois de `rodarAntesDoLoteAntigo` e antes do lote antigo) | campo `banco` presente; a frase da MG10 continua na mensagem |
| (emenda 1: S-I1) `agenda desligada e banco nunca medido` | tabela vazia | linha em `acao_do_dono_arquivo`; sem vermelho por causa do banco |
| (emenda 2: N1) `lerArquivoSemAgenda`: `última medida há 73 h`; `há 10 h`; `tabela vazia`; `as duas leituras lançam`; `a leitura do sinal pendurada` | `arquivo-sem-agenda.test.ts`, com `ler` injetado | `problemas` com a frase do banco; só `acao`; `acao` sem problema; nota, `acao` e `banco.nao_lido`, sem lançar; devolve dentro de `PROOF_MIN_MS` com `banco.nao_lido = 'prazo'`. Em **todos**, `banco` não é vazio |
| (emenda 2: S-m3) `sem agenda: sinal não lido, uma causa por teste` (mutação: tirar a linha de `acao`) | `extras-arquivo.test.ts`, com `agendaDesde: null` e `todas: null`: `prazo`; `erro_do_banco`; `excecao` | nas três, nota **e** linha em `acao`; com `agendaDesde` preenchido e `tamanhoOkHa36h: false`, só nota (o comportamento da emenda 1 não muda) |
| (emenda 2: N1) `a rota soma os problemas do arquivo aos da lista` (mutação: esquecer um dos três pontos) | `cron-competitors-agenda.test.ts`: o falso devolve `problemas: ['x']`, nos três desfechos do lote antigo (guarda de schema falhando, lote lançando, lote ok) | `recordCronFailure` recebe a frase nos três |
| (emenda 2: N1) `o contrato antigo continua` | `executar.test.ts:660-664` e `tarefas.test.ts:258`, **sem edição** | passam como estão: lista vazia devolve `{ tarefas: [], problemas: [], notas: [] }` sem ida ao banco |
| (emenda 1: S-M8) `todos os canais pausados` | `executar.test.ts`, 3 linhas pausadas | `sincronizar_canais` recebe lista vazia e não vira erro; a nota diz 3; se uma prova acusar por causa da lista vazia, **parar e avisar** (seção 6.2) |
| (emenda 1: D-I3) `a nova tentativa das miniaturas não muda o resultado da medida` | `tarefas.test.ts`: o Blob falha; faltam 20 s para o fim | `ok` nos dois; no segundo a tentativa nem começa e `miniaturas_sem_tempo` = 1 |
| (emenda 2: D-m2) `medida com erro: a nova tentativa não roda` (mutação: tirar a condição) | `tarefas.test.ts`: `obs_db_size_record` devolve erro | `erro`, `medida_falhou`; `retentarMiniaturasPendentes` nunca chamada |
| (emenda 2: D-m2) `sem token: não tentada é diferente de nada a fazer` | idem: a função devolve `{ porque: 'sem_token' }`; depois `{ apagadas: 0, pendentes: 0, foraDoPrefixo: 0 }` | `miniaturas_nao_tentadas: 1` e **sem** a chave `miniaturas_apagadas`; no segundo, `miniaturas_apagadas: 0` |
| (emenda 2: S-m1) `Blob pendurado: a tarefa devolve ok antes do fimAteMs` (mutação: tirar o `comPrazo`) | idem, com relógio falso: a tentativa nunca responde | `ok`, `miniaturas_sem_tempo: 1`, e o instante da volta é menor que `fimAteMs` |
| `extras: canais não lidos (todas nulo)` | `todas: null` | sem linha de pausa; os avisos de banco não têm site: `avisos: []`, e a linha em `acao` sai |
| `extras: pausado há 8 dias` | uma linha | `acao` com o nome; aviso `coleta_pausada_esquecida` com `periodo: 'semana'` |
| `juntarVermelho corta sem partir frase` | mensagem de 470 caracteres mais um problema de 40 | termina em "e mais 1 aviso"; nunca passa de 480 |
| `a resposta do cron traz banco e as linhas de pausa` | `executar.test.ts` | campo `banco`; `acao_do_dono` com a pausa; a tarefa recebe as linhas **sem** o pausado (o contexto de `sincronizar_canais` tem 14 de 15) |
| `o sinal é lido depois das tarefas` | idem | com a medida gravada pela tarefa neste disparo, o sinal sai `medido` (banco falso que só devolve a linha depois do `rpc`) |
| `a leitura do sinal pendurada não atrasa o disparo` | idem | com a leitura sem resposta, o disparo termina dentro do teto e `banco.nao_lido = 'prazo'` |

**Armadilhas.** (emenda 2: N1) Não tocar `AntesDoLote`, `rodarAntesDoLoteAntigo` nem a linha 87 de `route.ts`; não usar `antes.acao ?? []` nem nada parecido para calar teste. `definicoes.ts` não pode importar nada de `observatorio/arquivo` nem de `tarefas/`. Os testes de `despachante.test.ts` usam uma `tamanho_do_banco` fictícia: não tocar. `vercel.json` não muda (item 150): 49 entradas.
**Pronto quando:** os seis arquivos de teste da agenda, `arquivo-sem-agenda.test.ts` e, (emenda 2: N1) os **três** `test/youtube/cron-competitors-*.test.ts` (`agenda`, `prova`, `invalidate`) passam inteiros; `test/integration/agenda-despacho.test.ts` passa contra o `bythiago_int` (a CI não o roda: é aqui que ele é conferido); `typecheck` limpo.

### Tarefa 10: a lista fechada do que apaga

**Objetivo.** O teste do item 231, com a OP-11, e as provas dos itens 78 e 67 que saem dele.
**`lista-fechada-do-que-apaga.test.ts`** (estático, roda na CI). Varre, lendo o código-fonte: `src/lib/youtube/` inteiro menos `ab-*` (o A/B Lab não é do Observatório), `src/app/api/cron/sync-youtube/`, `src/app/api/cron/sync-analytics-metrics/`, `src/app/cms/(authed)/youtube/competitors/`, `src/lib/pipeline/services/forja-queue.ts` e `scripts/obs-arquivo.ts`. Procura `.delete(` em cadeia de cliente e `delete from` em texto. Cada ocorrência tem de casar com um par (arquivo, tabela) da lista; ocorrência sem par falha; **par sem ocorrência também falha**.

**(emenda 1: S-I4) A regra de varredura, escrita.** Em 13/10 o `grep` por `\.delete\(` nessas pastas devolve **18 linhas**, e só **6** são de cliente do banco: as outras 12 são `Map`, `Set` e `URLSearchParams` (`competitor-sync-batch.ts:217` e `:227`, e dez em `competitors/`). Das seis, `sync-analytics-metrics/route.ts:608` tem o `.delete()` sozinho na linha e `forja-queue.ts:246` usa `from(TASKS)`, com a tabela numa constante. Por isso:
1. Conta toda ocorrência de `\.delete\(\s*(\{[^)]*\})?\s*\)` (sem argumento, ou só com um objeto de opções). `.delete(<expressão>)` com argumento não conta. (emenda 2: S-m5) O teste **não afirma mais o número** das ignoradas (12 hoje, dez delas em `competitors/`, zona da A4: um `q.delete(k)` novo de outra trilha deixaria o teste da E10 vermelho sem motivo); ele **imprime** o número e afirma, para cada ignorada, duas coisas: que tem argumento, e que **não** há `.from(` antes dela na mesma cadeia. Uma ignorada com `.from(` antes (um `delete` de cliente com argumento) falha: é o caso que a contagem fixa queria pegar.
2. A tabela é resolvida voltando até o `.from(` anterior da mesma cadeia, mesmo em linhas acima. Se o argumento de `from` for uma constante, vale o valor da constante declarada no arquivo. **Se não resolver, o teste falha**; nunca ignora.
3. (emenda 1: D-I4, S-I4) A mesma varredura procura a importação de `@vercel/blob` com `del` e toda chamada `del(`. O par é (arquivo, prefixo de caminho no Blob), e a lista tem **uma** linha: `lib/youtube/observatorio/arquivo/remover.ts`, prefixo `observatorio/thumbs/`. Hoje nenhum código apaga miniatura (só existe o `put` em `thumb-fingerprint.ts:104`); a Tarefa 11a cria o primeiro. A miniatura antiga tem uma cópia só e o YouTube não a devolve. A lista de hoje (as linhas são as do spec, mais 15 e 16 do desvio D8):

| Linha | Arquivo | Tabela | Quem dispara | Classe |
|---|---|---|---|---|
| 2 | `competitors/actions.ts` | `competitor_channels` | o dono | dado coletado, com export (depois da 11b a ocorrência some daqui e passa à função do banco: a 11b atualiza a lista no mesmo commit) |
| 12 | `app/api/cron/sync-analytics-metrics/route.ts` | `yt_own_collection_runs` | cron | estado de execução |
| 13 | `lib/youtube/coleta/alerts.ts` | `ops_alert_state` | cron | estado de execução |
| 16 | `lib/pipeline/services/forja-queue.ts` | `youtube_intelligence_tasks` (pendentes) | o dono | fila |
| 16 | `lib/pipeline/services/forja-queue.ts` | `competitor_readings` (duas ocorrências) | a forja, na mesma chamada que gravou | desfaz gravação órfã ou incompleta |
| 17 (emenda 1: D-I4) | `lib/youtube/observatorio/arquivo/remover.ts` | Blob, prefixo `observatorio/thumbs/` (`del`) | o dono (remoção com lote confirmado) e a nova tentativa diária das pendências dessa mesma remoção | miniatura de canal removido, com cópia conferida no arquivo |

(emenda 2: S-m2) **A linha 17 não nasce com esta tarefa.** O teste afirma "par sem ocorrência também falha", e `remover.ts` só passa a existir na Tarefa 11a: com a linha 17 na lista desde já, o teste nasceria vermelho. A Tarefa 10 entrega a varredura de `del(` (provada pelo exemplo ruim embutido) e a lista **sem** a linha 17; a Tarefa 11a acrescenta a linha no mesmo commit em que cria `remover.ts`, como a 11b já faz com a linha 2.

Testes do arquivo: `toda ocorrência tem par e todo par tem ocorrência`; `o teste enxerga: exemplos ruins embutidos são acusados` (emenda 1: S-I4, D-I4: **quatro**, passados à mesma função de varredura: `.from('competitor_video_daily').delete()` numa linha; a mesma cadeia quebrada em três linhas; `from(CONSTANTE).delete()` com a constante declarada no texto; e um `del(url)` de `@vercel/blob` num arquivo fora da lista); `cadeia cuja tabela não resolve faz o teste falhar` (um `from(funcao()).delete()`); (emenda 2: S-m5) `toda ocorrência ignorada tem argumento e não vem de um from` (exemplo ruim embutido: `sb.from('competitor_raw').delete(opcoes)` tem de ser acusado; o número de ignoradas é impresso, não afirmado); `nenhum par com disparo "cron" aponta para tabela de série, versão, texto de comentário ou bruto` (item 78: o conjunto proibido é escrito por extenso: `competitor_video_daily`, `competitor_video_early`, `competitor_video_hourly`, `competitor_video_versions`, `competitor_field_versions`, `competitor_raw`, `competitor_video_comments`, `competitor_channel_snapshots`, `yt_reporting_report_blobs`, `yt_own_video_daily`); `a varredura leu pelo menos N arquivos` (pasta vazia ou caminho errado falha, não passa).

**`observatorio-a5-e10-lista-fechada.test.ts`** (integração). Lê do catálogo do banco toda função de `public` com `delete from` cujo nome começa por `competitor_`, `yt_`, `youtube_channel_` ou `obs_`, e casa cada (função, tabela) com a lista (F17, com a linha do spec de cada uma: 3, 6, 9, 11, 14 e as duas da MG6: remoção de canal na linha 2, registro na 15). Função com `delete` fora da lista falha; par da lista sem função falha. Mais dois testes: `24 meses depois nada de série foi apagado` (itens 78 e 67): semeia série diária, horária e versões com datas de 30 meses atrás, chama **toda função da lista com disparo de cron** com `p_now` de hoje mais 24 meses (as que aceitam instante) ou como estão (as outras), e a contagem das tabelas do conjunto proibido não cai; `limpeza do bruto: 0` (item 81, o mesmo da Tarefa 1, aqui com o relógio adiantado).
**Pronto quando:** o estático passa no código de hoje com as **seis** ocorrências de cliente em cinco pares (emenda 1: S-I4; o plano dizia "cinco ocorrências", e a F18 já listava seis) e sem a linha 17; depois da Tarefa 11a, que a acrescenta (emenda 2: S-m2), com o par do Blob; o de integração passa contra o `bythiago_int` com a MG6.

### Tarefa 11a: remoção liberada por lote (biblioteca)

(emenda 2: S-m4) `CodigoE10`, `codigoE10` e `FRASES_E10`, abaixo, **moram em `arquivo/codigos.ts`** (Tarefa 5); `remover.ts` os importa e reexporta. (emenda 2: S-m2) Esta tarefa acrescenta a linha 17 ao teste estático da Tarefa 10, no mesmo commit.
**Contrato.**

```ts
export type CodigoE10 = 'demorou_demais' | 'forja_em_andamento' /* emenda 1: S-I3, D-m8 */ | 'canal_nao_encontrado' | 'nao_pausado' | 'sem_lote' | 'lote_nao_conferido' | 'lote_nao_confirmado' | 'despausado_depois_do_export' | 'banco_difere_do_manifesto' | 'tabela_sem_export' | 'sobrou_linha' | 'sem_direito' | 'pausa_recente' | 'sincronizando' | 'lote_ja_apagado' | 'pausa_sem_remendo' | 'parametro_nulo' | 'schema_ausente' | 'inesperado'
export function codigoE10(erro: { message?: string; code?: string } | null | undefined): CodigoE10
export const FRASES_E10: Record<CodigoE10, string>
export function removerCanalArquivado(sb: SupabaseClient, e: { siteId: string; canalId: string; actorId: string }, deps?: { apagarDoBlob?: (urls: string[]) => Promise<void> }): Promise<{ ok: true; lote: string; linhas: number; miniaturasPendentes: number; foraDoPrefixo: number } | { ok: false; codigo: CodigoE10; frase: string }>
// emenda 1: D-I3, D-I4
export const PREFIXO_DAS_MINIATURAS = 'observatorio/thumbs/'
export function soMiniaturasDoObservatorio(urls: string[]): { apagar: string[]; fora: string[] }   // pelo caminho da URL, não por `includes`
export function retentarMiniaturasPendentes(sb: SupabaseClient, o: { agoraMs: number; maximo: number; prazoMs: number }, deps?: { apagarDoBlob?: (urls: string[]) => Promise<void> }): Promise<{ apagadas: number; pendentes: number; foraDoPrefixo: number } | { porque: string }>
```

`codigoE10` lê **só** o que casa com `^E10:([a-z_]+):` na mensagem; função ausente (`PGRST202`, `42883`) vira `schema_ausente`; qualquer outra coisa, `inesperado`. Depois de `removido`: apaga as URLs do Blob em blocos de 100; o que foi apagado é tirado da pendência por `obs_archive_blobs_done`; falha é relatada ao Sentry só com a contagem e não muda o `ok: true`. (emenda 1: S-I3, D-I5) `codigoE10` olha o `code` antes da mensagem: `57014` (instrução cancelada por tempo) vira `demorou_demais`, com a frase "nada foi apagado; o canal continua pausado e o lote continua confirmado; remova pelo comando `remover`". (emenda 1: D-I4, S-M2) Antes de falar com o Blob, `soMiniaturasDoObservatorio` separa as URLs: só as que estão sob `observatorio/thumbs/` são apagadas; as outras ficam em `blob_urls_pending`, são contadas em `foraDoPrefixo` e relatadas ao Sentry só pela contagem. (emenda 1: D-I3) `retentarMiniaturasPendentes` lê os lotes com pendência de **todos** os sites, apaga no máximo `RULES.archive.blobRetryMaxPerDay` URLs com o mesmo filtro de prefixo e baixa a pendência por `obs_archive_blobs_done`; nunca lança; token do Blob ausente é `{ porque: 'sem_token' }`, e a pendência fica. (emenda 2: S-m1) A baixa da pendência é **uma chamada de `obs_archive_blobs_done` por lote**, e 200 URLs são duas chamadas ao Blob (blocos de 100); `o.prazoMs` é o prazo da tentativa **inteira**, e o `del` recebe o `abortSignal` desse prazo quando a versão instalada aceitar (conferência pendente na Tarefa 9, passo 8). Cortada no meio, devolve o que já baixou em `apagadas` e o resto em `pendentes`.
**Testes** (emenda 2: S-m4: os quatro primeiros e o do `57014` são escritos na Tarefa 5). `um teste por código: a frase vem do catálogo e nenhuma parte da mensagem do banco aparece` (injeta `E10:banco_difere_do_manifesto: competitor_video_daily 2026-10-01 banco=3 arquivo=2` e procura "competitor_video_daily" na frase: não pode estar); `mensagem sem o prefixo é inesperado`; `função ausente é schema_ausente`; `resposta nula ou sem status "removido" é inesperado` (nunca `ok: true`); `removido: o Blob é chamado com as URLs e a pendência é baixada`; `o Blob falha: ok continua true e miniaturasPendentes diz quantas`; `sem URLs: o Blob não é chamado`; `os três ids vão para a função` (mutação: passar outro site); (emenda 1) `57014 vira demorou_demais e a frase diz que nada foi apagado`; `URL de outro prefixo não vai ao Blob, fica na pendência e é contada` (mutação: tirar o filtro; inclui uma URL que tem o prefixo no meio do caminho, e não no começo); `nova tentativa: a pendência some quando o Blob responde`; `nova tentativa: o Blob falha de novo e a pendência fica inteira`; `nova tentativa: sem token devolve porque e não apaga`; `nova tentativa respeita o máximo por dia` (mutação: tirar o corte); (emenda 2: S-m1) `nova tentativa com dois lotes: uma baixa de pendência por lote`; `nova tentativa cortada pelo prazo: devolve o que baixou e não lança`. (emenda 2: S-m4) Os testes de código e frase passaram para `arquivo-codigos.test.ts` (Tarefa 5); aqui fica um só, `remover reexporta o catálogo de codigos.ts`.
**Pronto quando:** testes verdes.

### Tarefa 11b: a ação do CMS (só com o aval do controlador)

**Antes de começar:** `git status` tem de mostrar `competitors/actions.ts` limpo; a A4 tem de estar em `staging` ou o controlador tem de dizer que a edição pode entrar.
**Mudança.** Em `removeCompetitorChannel`: as duas checagens de hoje ficam como estão e **antes** de qualquer cliente de serviço (`denyUnlessSiteAdmin`, `requireEditAccess`); o `delete` direto sai; entra `removerCanalArquivado(supabase, { siteId, canalId: id, actorId })`, com o id do usuário da sessão; `ok: false` devolve `{ ok: false, error: frase }`; `ok: true` invalida o cache como hoje. Em `syncCompetitorNow` e `syncCompetitorsNow`: resultado com `paused` devolve "a coleta deste canal está pausada" no lugar de "outra sincronização já estava em andamento". (emenda 1: D-m6) Em `syncFullHistory`: hoje ela grava `sync_mode: 'full', full_sync_completed_at: null` na linha do canal **antes** de chegar à trava de `runChannel` (`competitors/actions.ts:278-282`), o que muda o conteúdo da linha de um canal já conferido e agenda um histórico completo (cota) para quando despausar. A leitura do canal (que já existe logo abaixo) sobe para antes desse `update`, ganha `collection_paused_at`, e canal pausado devolve a mesma frase, sem gravar nada. (emenda 1: S-I3) Se a C10 e a medida de tempo disserem que o teto da API não cobre a remoção, `removeCompetitorChannel` não chama a função: devolve a frase que manda usar o comando `remover`.
**Testes (`canais-remove-action.test.ts`).** `sem administrar o site: recusa antes de criar o cliente de serviço`; `canal sem lote: a frase diz o que falta e nada é apagado`; `canal com lote confirmado: remove e invalida o cache`; `o delete direto não existe mais` (o teste da lista fechada perde o par da linha 2 de `actions.ts`, no mesmo commit); `canal pausado: a frase da sincronização manual`; (emenda 1: D-m6) `histórico completo de canal pausado: recusa e nenhum update é feito` (mutação: deixar o `update` antes da conferência); (emenda 1: S-I3) `remoção que passa do tempo: a frase manda usar o comando e nada é invalidado no cache`.
**Pronto quando:** os testes passam; o teste da lista fechada foi atualizado no mesmo commit; o runbook perde o aviso "não remover pelo CMS".

### Tarefa 12: runbook

`docs/ops/observatorio-arquivo-runbook.md`, com: a regra de processo (escrita no NAS e confirmação são do dono; o agente prepara); os comandos, um por linha, na ordem (`pausar`, esperar 6 minutos, `exportar`, `conferir`, `comandos-nas`, colar os dois comandos, `confirmar-nas`, `remover`; pelo CMS só depois da Tarefa 11b e se a C10 permitir: emenda 1, S-I3); o que cada recusa quer dizer e o que fazer; como voltar atrás em cada passo (despausar; reexportar; antes da remoção tudo se desfaz; depois dela, só recarregando o arquivo); como recarregar um arquivo num Postgres (emenda 1: D-m9: as linhas que `comandos-recarga` imprime, `\copy <tabela> (<colunas do manifesto>) from program 'gzip -dc <arquivo>' csv header`, na ordem pai antes de filho; nunca o `\copy` sem a lista de colunas); a tabela da OP-9 (seção 5.4), marcada como estimativa, com a data em que será refeita; o sinal de limite: como ler, o que fazer no amarelo e no vermelho, e o que fazer com "sem leitura"; o interruptor `OBS_AGENDA_TASKS_OFF=tamanho_do_banco` e por que ele deixa o cron vermelho em 72 h; a nota de que o NAS é cópia única (uma segunda cópia é decisão do dono, a anotar aqui); o aviso de que, até a Tarefa 11b, o botão do CMS apaga sem export; o espaço para o resultado do ensaio (item 82).
**Linhas acrescentadas pela emenda 1.**
- (S-M11) **Não pausar nenhum canal antes da conferência `e10-d0`.** O comando `pausar` existe assim que a MG6 é aplicada, mas o código antigo não respeita a pausa (a trava antiga não tem a condição) e as provas já tiram o canal. E, antes de reverter o código para o anterior, **despausar todos** (a V5 e `estado` conferem).
- (S-M5) **Pausar por engano custa prova.** Mesmo uma pausa de um minuto deixa o canal 7 dias fora da prova de comentários, 3 dias fora da de série e 26 horas fora da horária depois de despausar (risco 6). A cauda é fixa de propósito: encurtá-la pela duração da pausa mexeria nas quatro funções remendadas por um caso raro.
- (D-m10) **A pasta local `~/Workspace/arquivo-observatorio/<lote>/` não tem prazo.** Ela guarda texto de comentários e miniaturas de terceiros no Mac do dono. O dono decide e anota aqui se ela é a segunda cópia (fica) ou se sai depois do `sha256sum -c` no NAS. A resposta "apagar" da fila (E9) tem de alcançar esta pasta também, além do NAS.
- (S-M3) **Qual endereço usar em `OBS_ARQUIVO_DB_URL`.** O comando precisa de sessão fixa (cursor, `set local`). A conexão direta do Supabase pode ser só IPv6 no plano gratuito (**não medido**): se a rede do dono não alcançar, usar o endereço do pooler em **modo sessão** (porta 5432), nunca o modo transação (porta 6543), que quebra o cursor. O ensaio anota qual funcionou.
- (S-I3, D-I5) **Os tempos medidos** de `exportar`, `conferir` e `remover` no `bythiago_int` (seção 5.2), com a nota de que são do Mac do dono e não de produção, e o tempo real do ensaio ao lado.
- (D-I3) **O que fazer com "miniaturas ainda públicas"** e com "lote de canal que não existe mais".
- (D-I1) **O que fazer com "arquivo: N tabela(s) sem export"**: nada pode ser exportado nem removido até uma migration recriar `obs_archive_registry()`; pedir ao agente.
**Linhas acrescentadas pela emenda 2.**
- (D-m3) **Como ler "N miniatura(s) ainda públicas há D dias".** A tarefa diária apaga até 200 por dia, uma vez por dia. Um canal com mais de 600 miniaturas leva mais de 3 dias para esvaziar sem haver falha: a frase traz o ritmo ("faltam K dias"). N caindo de um dia para o outro = fila andando, nada a fazer. N parado por dois dias = está falhando: olhar o `detalhe` da tarefa `tamanho_do_banco` (`miniaturas_nao_tentadas` = token do Blob ausente; `miniaturas_sem_tempo` = Blob lento). **Não há comando para esvaziar na hora nesta etapa** (seria um segundo caminho de apagamento no Blob, fora da lista fechada, com o token no terminal do dono); se a C8 mostrar canal com mais de 600 miniaturas, o que muda é a constante `RULES.archive.blobRetryMaxPerDay`.
- (D-m3) **"N fora do prefixo"** (`miniaturas_fora_do_prefixo` no `detalhe`, e em `estado`): é URL que não está sob `observatorio/thumbs/`; hoje não tem como nascer (só existe um `put`, com o prefixo). O código nunca a apaga e ela fica na pendência. Ver quais são: `select batch, channel_ref, u from public.obs_archive_batches, unnest(blob_urls_pending) u where deleted_at is not null and u not like '%/observatorio/thumbs/%';`. O dono decide; baixar a pendência é pedido ao agente, em migration ou comando próprio, nunca à mão.
- (D-m6) **Com a agenda desligada (`OBS_AGENDA=off`) ou a MG10 falhando**, as linhas do banco e do arquivo não estão em `acao_do_dono`: estão em `acao_do_dono_arquivo`, e o estado em `banco`, na mesma resposta do cron. O vermelho das 72 h vai para a mensagem do cron do mesmo jeito.
- (S-m6) **Remover pelo comando não limpa o cache do CMS.** O canal removido pode continuar aparecendo na tela por até 15 minutos (o pacote vale 900 s). Não é falha, e não é para remover de novo.
- (S-m7, D-m2) **`OBS_AGENDA_TASKS_OFF=tamanho_do_banco` desliga duas coisas:** a medida e a nova tentativa de apagar as miniaturas pendentes. E a nova tentativa só roda no disparo em que a medida deu certo: banco sem medida = miniaturas sem nova tentativa.
- (D-m8) **Lote encerrado pode sair do disco.** Um lote com motivo `despausado` é de um canal que continua vivo no banco online, e a pasta dele (no Mac e, se já copiada, no NAS) guarda texto de comentários e miniaturas de terceiros sem servir de arquivo de nada. `estado` lista os encerrados com a pasta; o dono apaga quando quiser (é escrita no NAS: do dono).
- (D-m9) **"Lotes de canal que não existe mais" é histórico, não pendência.** É o número de lotes abertos cujo canal foi removido por fora do caminho com arquivo. Nunca desce, e não há o que fazer com ele além de saber.
- (S-m8, D-m7) **A medida de tempo** roda com `E10_MEDIR=1`, em segundo plano, com a saída em arquivo; sem a variável ela é pulada e os tempos deste runbook ficam "não medidos".
**Pronto quando:** cada comando do runbook foi executado contra o banco local, na ordem, e a saída colada bate.

### Tarefa 13: ensaio com o dono (item 82)

Com tudo em produção e a resposta à P1. (emenda 1: S-I3) A remoção do ensaio é pelo comando `remover`: o ensaio não espera a Tarefa 11b. Num canal que o dono queira remover, ou num canal de teste que ele crie para isso. O agente prepara, um por linha; o dono cola. Registrar no runbook: os tempos de cada passo, o tamanho da pasta, a saída do `sha256sum -c` **rodado no NAS**, a linha de `audit_log`, **(emenda 1: D-I2) a contagem total de cada tabela do fecho de cascata antes e depois da remoção (a mesma consulta do teste `a cascata não apaga nada fora do arquivo`, que o agente prepara e o dono cola: é leitura), com `antes - depois` comparado por tabela com o `row_count` do lote**, a contagem de um segundo canal antes e depois, e o `\copy` de um arquivo para uma tabela temporária do banco local com a contagem igual. **Pronto quando:** o runbook tem o resultado, ou o ledger diz por que o ensaio não foi feito e o que isso deixa sem prova (seção 13).

### Tarefa 14: envio e conferências

**Ordem que não inverte.** (1) MG6 aplicada pelo dono; (2) V1 a V4b em produção, anotadas; **(emenda 1: S-C1) só então nascem os commits das Tarefas 4a, 4b, 9 e 11b** (seção 0.3); (3) push do código para `staging` (lista explícita de commits: há outros lotes locais não enviados); CI verde; (4) promoção para `main`, fora de 11:55 a 12:15 UTC e fora dos minutos 0, 20 e 40; (5) conferência `e10-d0`.
**O que fica vermelho se inverter.** Código antes da MG6: todo disparo de concorrentes fica vermelho com "migration MG6 não aplicada", nada é coletado, e as horas da leitura horária desse intervalo se perdem. **Como voltar:** o caminho preferido é aplicar a MG6 (minutos); o outro é reverter o deploy para o anterior. Não há variável que resolva: a pausa não tem interruptor, de propósito.
**Como voltar depois de tudo aplicado.** Desligar só a medida: `OBS_AGENDA_TASKS_OFF=tamanho_do_banco` e redeploy (a variável só vale para deploy novo); a pausa e os comandos não têm o que desligar, porque nada acontece sem o dono pausar um canal. A MG6 não precisa ser desfeita para o código antigo voltar: é inerte para ele. **O que não se desfaz:** a remoção de um canal (só recarregando o arquivo).
**Conferências com data** (`conferenciasE10(deploy)`, constante `E10_DEPLOY`, no molde de `conferenciasE14`; `null` = nenhuma; data malformada = uma entrada vermelha de 1970; teste com os três casos; cópia legível em `.superpowers/sdd/a5/conferencias-com-data.md`).

| Id | Quando | O quê, e o esperado |
|---|---|---|
| `e10-d0` | D | V1 = 3, 3, 2, 17, 4, 4, true, false; V2 = `{}` e 20 (emenda 1: D-I1); V3 com `medidas` = 1 depois do primeiro disparo; a resposta do cron tem `banco` com `estado: 'medido'`; anotar `db_bytes`, `competitor_bytes`, `own_bytes` e as 10 maiores de `top_relations`; comparar `db_bytes` com os 170,7 MB de 12/10 (diferença acima de 30% = refazer a seção 5.4) e com o painel do Supabase (C2) |
| `e10-d1` | D+1 | `select count(*), max(day) from obs_db_size_daily` = 2 e o dia de hoje; a tarefa `ok` duas vezes em `competitor_agenda_runs`; o vigia mostra `tamanho_do_banco` em dia; nenhum e-mail de banco (salvo se já acima de 350 MB); V5 = 0 |
| `e10-d7` | D+7 | 8 linhas, sem dia faltando; crescimento médio por dia contra a estimativa (com 13 a 15 canais, cerca de 0,6 MB por dia: ESTIMATIVA); as relações que mais cresceram entre `top_relations` de D e de D+7, para fechar "de onde vêm os 20 MB por ano do site" (item 80) |
| `e10-d14` | D+14 | a projeção deixou de ser "não medida"; anotar a data de chegada que o sinal diz |
| `e10-d28` | D+28 | a tabela da OP-9 refeita com a reta medida e gravada no runbook |
| `e10-ensaio` (responsável: dono) | D+14 | o ensaio do item 82 feito e anotado |

**Pronto quando:** CI verde, deploy pronto, `e10-d0` anotada.

---

## 11. Consultas de conferência e o que foi rodado

Tudo no banco local `bythiago_int` (`127.0.0.1:54422`), em 13/10/2026, dentro de `begin; … rollback;`, com o texto do Apêndice A. Nada ficou gravado (a última linha do roteiro confere que `obs_archive_batches` não existe depois do `rollback`). Nada foi lido nem escrito em produção.

| O que rodou | Resultado |
|---|---|
| A MG6 duas vezes seguidas na mesma transação | sem erro; na segunda, as quatro funções já remendadas são puladas |
| V1 | `3, 3, 2, 17, 4, 4, true, false` |
| V2 | `{}` e `19`; nenhuma tabela do registro ausente no banco local |
| `obs_db_size_record` duas vezes | uma linha; `top_relations` é objeto; `db_bytes >= competitor_bytes + own_bytes` |
| Pausar: usuário comum, canal inexistente, canal certo, de novo | `sem_direito`, `canal_nao_encontrado`, `pausado`, `ja_pausado`; uma pausa aberta |
| As quatro funções antes e depois de pausar um canal com um vídeo de 2 dias | lista horária 1 para 0; fila de comentários do canal 1 para 0; retratos atrasados 1 para 0; fora da prova de série 0 para 2 |
| Despausar | a fila volta (1); a lista horária, os atrasados e a série continuam fora; 8 dias depois a lista volta e a série volta a 0 fora |
| Pausar com o site errado | `canal_nao_encontrado` |
| Registrar com a pausa de agora | `pausa_recente` |
| Registrar com uma contagem errada | `banco_difere_do_manifesto`; zero linhas no registro |
| Registrar certo, e de novo | `exportado`, 10 arquivos, 32 linhas; `exportado` |
| Confirmar e remover antes de conferir | `lote_nao_conferido` nas duas |
| Conferir; confirmar com usuário comum; remover antes de confirmar | `conferido`; `sem_direito`; `lote_nao_confirmado` |
| Confirmar | `confirmado` |
| Inserir uma linha de série e remover | `E10:banco_difere_do_manifesto: competitor_video_daily 2031-01-01 banco=1 arquivo=sem arquivo`; o canal continua |
| Remover | `removido`, 10 arquivos, 32 linhas; canal 0; um canal a menos; zero vídeo de outro canal a menos; 10 arquivos com `deleted_at` e `rows_deleted = row_count`; uma linha em `audit_log` com o ator; zero pausas órfãs |
| Segundo canal: exportar, conferir, despausar | 5 arquivos invalidados; 0 de 5 conferidos; cauda de 3 dias verdadeira, cauda zero falsa |
| Pausar de novo e conferir o lote antigo | `despausado_depois_do_export` |
| Sugestões | objeto com `canais_avaliados` e `canais_sem_video`; com o relógio 30 anos à frente, lista não vazia; com `p_site` nulo, `null` |
| A MG6 com `competitor_hourly_health` trocada por um corpo sem a âncora | `ERROR: MG6: a âncora do remendo aparece 0 vez(es) em public.competitor_hourly_health(...)`; nada criado |
| O roteiro inteiro uma segunda vez | saída igual à primeira, fora os instantes |
| **(emenda 1) O que mudou no Apêndice A depois dessas rodadas e ainda NÃO foi rodado** | seis mudanças da emenda 1 e **uma da emenda 2** (D-m4: a restrição `obs_archive_batches_closed_par`, que obriga `closed_at` e `closed_reason` a andarem juntos; não muda nenhuma saída do roteiro, porque as duas únicas gravações preenchem as duas colunas). As seis da emenda 1, todas marcadas `emenda 1` no SQL (em nove pontos do texto): a vigésima entrada do registro; `stable` no lugar de `immutable` em duas funções; `closed_at` e `closed_reason` e os dois `update` que as gravam; a recusa `forja_em_andamento`; `last_ok_synced_at` nas sugestões; `select` por coluna em `obs_db_size_daily`. A Tarefa 1 roda o roteiro de novo. **Diferenças esperadas na saída guardada do Apêndice B, e só estas:** em `== V2`, `20` no lugar de `19`, e a terceira consulta (tabelas do registro ausentes do banco) passa a imprimir `competitor_video_marks` enquanto a MG4 não estiver aplicada. V1 continua `3|3|2|17|4|4|t|f` (nenhuma função nova). Qualquer outra diferença: parar e avisar |

**Não rodado, e por quê:** o código TypeScript (este plano não escreve código); os testes de RLS com usuário de verdade (são da Tarefa 1); o `\copy` de ida e volta (Tarefa 6); qualquer coisa em produção (seção 3.2).

---

## 12. Onde está cada item de aceite

| Item | O que pede | Tarefa | Observação |
|---|---|---|---|
| 74 | ida e volta idêntica, com `jsonb`, nulos, vírgula, quebra de linha, `real[]`, instante com fração, sessão fixa | 5 (CSV), 6 (integração) | |
| 75 | remoção recusa sem lote confirmado e com contagem ou soma diferente; não apaga nada; exportar recusa não pausado | 1, 6, 11a, 11b | a exceção "apagar" de 4.5 é da E9 |
| 76 | linhas removidas batem; outro canal intacto; uma linha em `audit_log`; o registro continua | 1, 13 | com a exceção nomeada de `featured_channel_id` (D9); (emenda 1: D-I2) a prova compara o total de cada tabela do fecho de cascata, tirado do catálogo, com o arquivo |
| 77 | export por idade recusa série sem marca; remoção de canal não é bloqueada | 6 | **parcial**: o lote por idade é recusado inteiro nesta fase; a regra fina vai para a manutenção e depende da MG4 (D10) |
| 78 | nenhum caminho apaga série por idade | 10 | pela lista fechada e pelo teste do relógio de 24 meses |
| 79 | canal parado há 12 meses aparece em "Sugestões"; nada acontece sem o dono | 1 (função), 8 (leitor) | **a tela espera mockup**; o item fecha no dado |
| 80 | linha do dia, "não medida" com menos de 14, "sem leitura hoje", limiares com borda, vigia pelo nome, anotação do dia do deploy | 2, 3, 9, 14 (`e10-d0`, `e10-d7`) | o aviso na tela espera o mockup 18 |
| 81 | a limpeza do bruto não apaga o que não está em lote confirmado | 1, 10 | a função continua devolvendo 0 (D1) |
| 82 | ensaio com o dono, de ponta a ponta, com `sha256sum -c` no NAS | 13 | depende da P1; (emenda 1: S-I3) não depende mais da 11b: a remoção do ensaio é pelo comando `remover` |
| 229 | pausado não é lido por tarefa nenhuma (conta chamadas, 1 em 15); exportar recusa não pausado; contagem igual com a sincronização no meio; pausado há mais de 7 dias no cabeçalho e no retorno, pelo nome | 4a, 4b, 1, 6, 9, 8 | no retorno: 9; no cabeçalho: o leitor da 8, a tela espera mockup |
| 230 | miniaturas no manifesto com caminho, bytes e sha256; contagens batem; um byte trocado para o `conferir`; reexportar zera a conferência | 5, 6, 1 | |
| 231 | lista fechada com teste nos dois sentidos; `obs_db_size_daily` com RLS | 10, 1 (RLS) | com as linhas 15 e 16 (D8) |
| 67 (vizinho) | relógio de 400 dias com a lista fechada | 10 | o teste daqui usa 24 meses, que cobre |
| 150 (vizinho) | `vercel.json` com 49 entradas, zero job de `pg_cron` novo | 9 | nada é acrescentado; a Tarefa 9 não abre `vercel.json` |
| 211, 214, 215 (vizinhos) | o vigia enxerga a tarefa nova; arranque; pior disparo, com o catálogo real | 9 | OP-3 |
| 246 (vizinho) | toda conferência com data em `lib/conferencias.ts` | 14 | |
| OP-3 | catálogo cresce por etapa, com os testes rodando no catálogo de cada ordem | 9 | |
| OP-9 | cenários de 20 a 200 canais | seção 5.4, 12, 14 (`e10-d28`) | estimativa agora; medida no D+28 |
| OP-11 | classificar os `delete` de `forja-queue.ts` | 10 | linha 16 |

Nenhum item da etapa ficou sem tarefa. Ficam **fora, por decisão escrita**: as telas (mockup), o lote por idade (manutenção), a reabertura da limpeza do bruto (manutenção, D1).

---

## 13. Riscos que ficam, sem suavizar

1. **Até a Tarefa 11b, o botão do CMS remove canal sem export.** É o estado de hoje, mas a etapa existe para acabar com ele, e a parte que fecha a porta depende de um arquivo que outra trilha reserva. (emenda 1: S-I3) O caminho **com** arquivo deixa de depender da 11b (comando `remover`); o que continua aberto é o botão antigo. Se o dono remover um canal nesse intervalo, o dado se perde como se perderia hoje.
2. **Inverter a ordem custa dado que não volta.** Código novo sem a MG6 para a coleta de concorrentes, e a leitura horária perdida não é recuperada.
3. **O remendo das quatro funções é frágil a recriações futuras.** A falha é segura (pausar recusa, com o nome da função), mas trava o dono até alguém reaplicar o bloco. Três planos vizinhos mexem nessas funções.
4. **Um canal pausado que estava em erro continua nas regras de erro** (vermelho entre 12 horas e 3 dias): `competitor_capture_health` não foi remendada, para não mexer numa quinta função por um caso raro.
5. **Gravações raras num canal pausado fazem a remoção recusar.** Uma leitura da forja pedida pelo dono para um vídeo do canal, e toda tarefa futura que grave por canal sem olhar a pausa (`soma_do_mapa` roda às 04:00 sobre o dia anterior). A recusa é segura e diz a tabela e o mês; o conserto é exportar de novo, o que custa ao dono repetir a cópia ao NAS.
6. **Depois de despausar, o canal fica até 7 dias fora da prova de comentários, 3 dias fora da de série e 26 horas fora da horária.** Uma falha real de coleta nesse canal, nessa janela, não fica vermelha.
7. **A identidade dos autores some com o canal e não vai para o arquivo** (decisão 20); o texto dos comentários vai. Guardar comentário de terceiros no NAS é a mesma retenção do online, sem prazo: é a posição do spec, e a resposta "apagar" da fila (E9) tem de alcançar o arquivo (o expurgo no arquivo não é deste plano).
8. **`pg_database_size` pode não ser o número que o plano gratuito cobra** (C2). Até a conferência, os limiares são sobre um número que pode ser otimista.
9. **A projeção é uma reta de 28 dias.** Uma carga pontual (uma migration de dieta, um canal de 200 vídeos adicionado) entorta a reta para os dois lados por até 28 dias. O sinal diz a reta, não a causa; `top_relations` ajuda a ler.
10. **O NAS é cópia única e a confirmação é a palavra do dono.** O banco não tem como saber se o arquivo está mesmo lá: `confirmar-nas` registra que ele disse que conferiu. Um lote confirmado sem ter sido copiado é perda na remoção.
11. **O e-mail de banco não sai no disparo em que a lista de canais não foi lida** (sai no seguinte), e depende de existir dono cadastrado no site.
12. **A tabela da OP-9 é estimativa** feita com constantes do spec; a medida só existe 28 dias depois do deploy.
13. **(emenda 1: D-m7) Depois do `conferir`, só contagem e soma de views são reconferidas.** Uma mudança de conteúdo sem mudança de contagem entre o `conferir` e a remoção não é vista: `author_purged_at` pela anulação aos 28 dias, `status` de tarefa da forja pelo `expire-notifications`, fixados e decisões pelo CMS. É o que o item 75 pede, e não há perda material conhecida; o arquivo guarda o conteúdo do instante do export.
14. **(emenda 1) Seis mudanças do Apêndice A não foram rodadas** (seção 11), (emenda 2: D-m4) **e mais uma da emenda 2**, a restrição que amarra `closed_at` a `closed_reason`: sete ao todo. O plano foi emendado sem banco; a Tarefa 1 é quem prova.
15. **(emenda 1: S-I3, D-I5) Ninguém mediu o tempo da remoção nem o teto de tempo dos papéis.** Até a C10 e a medida da Tarefa 1, o único caminho de remoção que o plano sustenta é o comando `remover`, com o teto que ele mesmo declara.
16. **(emenda 1: D-I1) A entrada de `competitor_video_marks` no registro foi escrita a partir do DDL do spec, para uma tabela que ainda não existe.** Se a MG4 nascer com outra chave, a consulta do export falha com erro visível no primeiro export depois dela; a V2 e o teste `o registro e o catálogo concordam` têm de rodar depois da MG4.
17. **(emenda 1: S-I1) Banco nunca medido com a agenda nunca ligada não fica vermelho** (não há de onde contar as 72 h); fica a linha em `acao_do_dono` a cada disparo.
18. **(emenda 2: D-m3) Miniatura pendente não tem saída manual nesta etapa.** Se a tarefa diária não conseguir apagar (token, Blob fora), a imagem de terceiro continua em URL pública e o que existe é a linha em `acao_do_dono` depois de 3 dias. Não foi criado comando para o dono apagar na hora.

### O que nenhum teste vai provar

- Que o download das miniaturas do Blob de produção funciona e em quanto tempo (o teste usa um `fetch` falso; só o ensaio mede).
- Que `rsync` e `sha256sum -c` no NAS dão certo (é o ensaio, e é do dono).
- Que a guarda "não é um terminal" impede um agente (é uma barreira, não uma prova).
- Que as chaves estrangeiras de produção são as do banco local (C5 e a V2 depois de aplicar).
- Que a trava de linhas segura a concorrência com a coleta real em produção: o teste de integração prova a recusa por contagem, e a ausência de entrada no meio vem da regra de travas do Postgres, lida na documentação e não exercitada sob carga.
- Que o e-mail chega à caixa do dono.
- Que 350 e 425 MB são os números certos para o plano gratuito de hoje (C2).
- Que um arquivo exportado hoje é legível por um Postgres daqui a cinco anos (o formato é CSV com cabeçalho e o manifesto guarda os tipos; a prova é só a ida e volta de hoje).

---

## 14. Apêndices

### Apêndice A: MG6 (rodado duas vezes antes da emenda 1; as seis mudanças marcadas `emenda 1` e a marcada `emenda 2` ainda não foram rodadas: seção 11)

```sql
-- MG6 (A5, E10): registro dos lotes de export, pausa de coleta e sinal de tamanho do banco.
-- Depende de: MG13 (yt_reporting_blobs_purge devolve 0: esta migration NÃO a toca), MG2b/MG9 (competitor_series_health,
-- competitor_hourly_health) e MG8 (competitor_comment_due, competitor_comment_health). Recusa sem elas.
-- Inerte para o código antigo: nada do que está em produção lê ou grava o que nasce aqui; os quatro corpos remendados
-- (bloco 10) só mudam de resposta quando existe uma linha em competitor_collection_pauses, e só as funções daqui a criam.
-- Idempotente: pode ser aplicada duas vezes.
set lock_timeout = '5s';

-- ───────────────────────── 0. Dependências ─────────────────────────
do $$
declare
  v_falta text;
begin
  select string_agg(x, ', ') into v_falta
    from unnest(array[
      'public.can_edit_site(uuid)', 'public.is_member_staff()',
      'public.competitor_series_health(uuid,timestamptz)',
      'public.competitor_hourly_health(uuid,timestamptz,integer,integer)',
      'public.competitor_comment_due(timestamptz,jsonb,interval,integer,text[],interval,timestamptz,uuid)',
      'public.competitor_comment_health(uuid,timestamptz,jsonb,integer,interval,timestamptz)',
      'public.yt_reporting_blobs_purge(text[])'
    ]) x
   where to_regprocedure(x) is null;
  if v_falta is not null then
    raise exception 'MG6 depende de funções que não existem (MG13, MG2b, MG9, MG8): %', v_falta;
  end if;
end $$;

-- ───────────────────────── 1. Registro dos lotes ─────────────────────────
create table if not exists public.obs_archive_batches (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  batch text not null check (batch ~ '^[a-z0-9][a-z0-9-]{2,60}$'),
  kind text not null default 'canal' check (kind in ('canal', 'idade')),
  table_name text not null,
  channel_ref text not null,
  channel_label text,
  period_start date not null,
  period_end date not null,
  row_count bigint not null check (row_count >= 0),
  control_sum numeric,
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  csv_sha256 text not null check (csv_sha256 ~ '^[0-9a-f]{64}$'),
  blob_count integer check (blob_count is null or blob_count >= 0),
  blob_bytes bigint check (blob_bytes is null or blob_bytes >= 0),
  blob_missing integer check (blob_missing is null or blob_missing >= 0),
  exported_at timestamptz not null,
  verified_at timestamptz,
  nas_confirmed_at timestamptz,
  nas_confirmed_by uuid,
  deleted_at timestamptz,
  rows_deleted bigint,
  blob_urls_pending text[],
  unique (site_id, batch, table_name, channel_ref, period_start),
  check (period_end >= period_start),
  check (nas_confirmed_at is null or verified_at is not null),
  check (deleted_at is null or nas_confirmed_at is not null)
);
-- (emenda 1: D-I3, S-M4) encerramento sem apagamento: o dono despausou (o export não vale mais) ou o canal foi removido por outro lote.
alter table public.obs_archive_batches
  add column if not exists closed_at timestamptz,
  add column if not exists closed_reason text check (closed_reason in ('despausado', 'substituido'));
-- (emenda 2: D-m4) as duas colunas andam juntas: protege contra uma terceira função futura que grave só uma. drop + add: reaplicável.
alter table public.obs_archive_batches drop constraint if exists obs_archive_batches_closed_par;
alter table public.obs_archive_batches add constraint obs_archive_batches_closed_par check ((closed_at is null) = (closed_reason is null));
create index if not exists idx_obs_archive_batches_channel on public.obs_archive_batches (site_id, channel_ref, exported_at desc);
alter table public.obs_archive_batches enable row level security;
drop policy if exists "obs_archive_batches_select" on public.obs_archive_batches;
create policy "obs_archive_batches_select" on public.obs_archive_batches
  for select using (public.can_edit_site(site_id));
revoke all on table public.obs_archive_batches from anon, authenticated;
grant select on table public.obs_archive_batches to authenticated;
grant all on table public.obs_archive_batches to service_role;

comment on table public.obs_archive_batches is
  'Uma linha por arquivo de export (tabela × canal × mês). O registro fica online para sempre: é ele que diz o que foi arquivado. Só as funções obs_archive_* e competitor_channel_remove_archived gravam aqui.';
comment on column public.obs_archive_batches.control_sum is 'Soma de controle (a soma de views, onde a tabela tem). Nulo = a tabela não tem coluna somável.';
comment on column public.obs_archive_batches.csv_sha256 is 'sha256 do CSV sem compressão. conferir relê o banco com a mesma consulta e compara com este valor.';
comment on column public.obs_archive_batches.blob_missing is 'Miniaturas que o Blob respondeu 404 no export (aceitas de propósito pelo dono). Nulo = a tabela não tem miniatura.';
comment on column public.obs_archive_batches.blob_urls_pending is 'Só na linha de table_name = competitor_channels: miniaturas do canal removido que ainda estão no Blob. Vazio ou nulo = nada pendente.';

-- ───────────────────────── 2. Pausa de coleta ─────────────────────────
alter table public.competitor_channels
  add column if not exists collection_paused_at timestamptz,
  add column if not exists collection_paused_by uuid;
comment on column public.competitor_channels.collection_paused_at is 'Nulo = coleta ligada. Preenchido = nenhuma tarefa lê este canal (passo 0 do export). Só competitor_channel_pause e competitor_channel_unpause gravam.';

create table if not exists public.competitor_collection_pauses (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  paused_at timestamptz not null,
  paused_by uuid not null,
  reason text not null default 'exportar' check (reason in ('exportar')),
  resumed_at timestamptz,
  resumed_by uuid,
  check (resumed_at is null or resumed_at >= paused_at)
);
create unique index if not exists uq_competitor_collection_pauses_open
  on public.competitor_collection_pauses (competitor_channel_id) where resumed_at is null;
create index if not exists idx_competitor_collection_pauses_channel
  on public.competitor_collection_pauses (competitor_channel_id, paused_at);
alter table public.competitor_collection_pauses enable row level security;
drop policy if exists "competitor_collection_pauses_select" on public.competitor_collection_pauses;
create policy "competitor_collection_pauses_select" on public.competitor_collection_pauses
  for select using (public.can_edit_site(site_id));
revoke all on table public.competitor_collection_pauses from anon, authenticated;
grant select on table public.competitor_collection_pauses to authenticated;
grant all on table public.competitor_collection_pauses to service_role;
comment on table public.competitor_collection_pauses is
  'Histórico das pausas de coleta por canal. É o que permite dizer, depois, "sem coleta de dd/mm a dd/mm" em vez de buraco. Uma pausa aberta por canal.';

-- ───────────────────────── 3. Sinal de tamanho do banco ─────────────────────────
create table if not exists public.obs_db_size_daily (
  day date primary key,
  db_bytes bigint not null check (db_bytes >= 0),
  competitor_bytes bigint not null check (competitor_bytes >= 0),
  own_bytes bigint not null check (own_bytes >= 0),
  measured_at timestamptz not null default now()
);
alter table public.obs_db_size_daily add column if not exists top_relations jsonb not null default '{}'::jsonb;
alter table public.obs_db_size_daily enable row level security;
drop policy if exists "obs_db_size_daily_select" on public.obs_db_size_daily;
create policy "obs_db_size_daily_select" on public.obs_db_size_daily
  for select using (public.is_member_staff());
revoke all on table public.obs_db_size_daily from anon, authenticated;
-- (emenda 1: S-M1, D-m13) top_relations é o mapa do banco: só o cliente de serviço lê. authenticated lê as cinco colunas do spec.
grant select (day, db_bytes, competitor_bytes, own_bytes, measured_at) on table public.obs_db_size_daily to authenticated;
grant all on table public.obs_db_size_daily to service_role;
comment on table public.obs_db_size_daily is
  'Uma linha por dia de São Paulo com o tamanho do banco. Gravada só por obs_db_size_record (tarefa tamanho_do_banco). Dia sem linha = sem leitura, nunca zero.';
comment on column public.obs_db_size_daily.top_relations is 'As 30 maiores relações do banco no instante da medida: {"schema.nome": bytes}.';

create or replace function public.obs_db_size_record(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date;
  v_db bigint;
  v_comp bigint;
  v_own bigint;
  v_top jsonb;
begin
  if p_now is null then
    raise exception 'E10:parametro_nulo: obs_db_size_record' using errcode = '22023';
  end if;
  v_day := (p_now at time zone 'America/Sao_Paulo')::date;
  v_db := pg_catalog.pg_database_size(pg_catalog.current_database());
  select coalesce(sum(pg_catalog.pg_total_relation_size(c.oid)) filter (where c.relname like 'competitor\_%'), 0)::bigint,
         coalesce(sum(pg_catalog.pg_total_relation_size(c.oid)) filter (where c.relname like 'yt\_own\_%' or c.relname like 'yt\_reporting\_%'), 0)::bigint
    into v_comp, v_own
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r';
  select coalesce(jsonb_object_agg(z.nome, z.bytes), '{}'::jsonb) into v_top
    from (
      select n.nspname || '.' || c.relname as nome, pg_catalog.pg_total_relation_size(c.oid) as bytes
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where c.relkind in ('r', 'm') and n.nspname not in ('pg_catalog', 'information_schema')
       order by 2 desc, 1
       limit 30
    ) z;
  insert into public.obs_db_size_daily as d (day, db_bytes, competitor_bytes, own_bytes, measured_at, top_relations)
  values (v_day, v_db, v_comp, v_own, p_now, v_top)
  on conflict (day) do update
    set db_bytes = excluded.db_bytes, competitor_bytes = excluded.competitor_bytes, own_bytes = excluded.own_bytes,
        measured_at = excluded.measured_at, top_relations = excluded.top_relations;
  return jsonb_build_object('day', v_day, 'db_bytes', v_db, 'competitor_bytes', v_comp, 'own_bytes', v_own, 'measured_at', p_now);
end $$;

-- ───────────────────────── 4. Quem pode confirmar (o dono) ─────────────────────────
create or replace function public.obs_archive_is_site_admin(p_site uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.organization_members om
      join public.organizations o on o.id = om.org_id
      join public.sites s on s.id = p_site
     where om.user_id = p_user and om.role = 'org_admin'
       and (om.org_id = s.org_id or o.parent_org_id is null)
  ) and exists (select 1 from auth.users u where u.id = p_user);
$$;

-- ───────────────────────── 5. Pausar e despausar ─────────────────────────
create or replace function public.competitor_channel_pause_covers(p_channel uuid, p_now timestamptz, p_tail interval)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.competitor_collection_pauses p
     where p.competitor_channel_id = p_channel
       and p.paused_at <= p_now
       and (p.resumed_at is null or p.resumed_at > p_now - p_tail)
  );
$$;

create or replace function public.competitor_channel_pause(p_site uuid, p_channel uuid, p_by uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paused timestamptz;
  v_falta text;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_site is null or p_channel is null or p_by is null then
    raise exception 'E10:parametro_nulo: competitor_channel_pause' using errcode = '22023';
  end if;
  -- As quatro funções que escolhem ou cobram vídeo por canal têm de conhecer a pausa. Se outra migration as recriou sem o
  -- remendo, pausar deixaria o cron vermelho (provas) e a fila de comentários gravando no canal: recusa.
  select string_agg(p.proname, ', ' order by p.proname) into v_falta
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('competitor_series_health', 'competitor_hourly_health', 'competitor_comment_due', 'competitor_comment_health')
     and p.prosrc not like '%competitor_channel_pause_covers%';
  if v_falta is not null then
    raise exception 'E10:pausa_sem_remendo: %', v_falta using errcode = 'P0001';
  end if;
  if not public.obs_archive_is_site_admin(p_site, p_by) then
    raise exception 'E10:sem_direito: quem pausa tem de administrar o site' using errcode = '42501';
  end if;
  select c.collection_paused_at into v_paused
    from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site
     for update;
  if not found then
    raise exception 'E10:canal_nao_encontrado: neste site' using errcode = 'P0002';
  end if;
  if v_paused is not null then
    return jsonb_build_object('status', 'ja_pausado', 'paused_at', v_paused);
  end if;
  update public.competitor_channels c
     set collection_paused_at = v_now, collection_paused_by = p_by
   where c.id = p_channel and c.site_id = p_site;
  insert into public.competitor_collection_pauses (site_id, competitor_channel_id, paused_at, paused_by)
  values (p_site, p_channel, v_now, p_by);
  return jsonb_build_object('status', 'pausado', 'paused_at', v_now);
end $$;

create or replace function public.competitor_channel_unpause(p_site uuid, p_channel uuid, p_by uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paused timestamptz;
  v_invalidados integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_site is null or p_channel is null or p_by is null then
    raise exception 'E10:parametro_nulo: competitor_channel_unpause' using errcode = '22023';
  end if;
  if not public.obs_archive_is_site_admin(p_site, p_by) then
    raise exception 'E10:sem_direito: quem despausa tem de administrar o site' using errcode = '42501';
  end if;
  select c.collection_paused_at into v_paused
    from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site
     for update;
  if not found then
    raise exception 'E10:canal_nao_encontrado: neste site' using errcode = 'P0002';
  end if;
  if v_paused is null then
    return jsonb_build_object('status', 'nao_pausado');
  end if;
  update public.competitor_channels c
     set collection_paused_at = null, collection_paused_by = null
   where c.id = p_channel and c.site_id = p_site;
  update public.competitor_collection_pauses p
     set resumed_at = v_now, resumed_by = p_by
   where p.competitor_channel_id = p_channel and p.resumed_at is null;
  -- A coleta volta a gravar: o arquivo exportado deixa de ser o retrato do canal. A conferência antiga não vale.
  update public.obs_archive_batches b
     set verified_at = null, nas_confirmed_at = null, nas_confirmed_by = null
   where b.site_id = p_site and b.channel_ref = p_channel::text and b.deleted_at is null
     and (b.verified_at is not null or b.nas_confirmed_at is not null);
  get diagnostics v_invalidados = row_count;
  -- (emenda 1: D-I3, S-M4) o lote exportado antes de despausar está encerrado: deixa de contar como "exportado e não confirmado"
  update public.obs_archive_batches b
     set closed_at = v_now, closed_reason = 'despausado'
   where b.site_id = p_site and b.channel_ref = p_channel::text and b.deleted_at is null and b.closed_at is null;
  return jsonb_build_object('status', 'despausado', 'resumed_at', v_now, 'arquivos_invalidados', v_invalidados);
end $$;

-- ───────────────────────── 6. O que o export cobre, e a contagem por canal ─────────────────────────
-- filter_sql usa o apelido t e $1 = id (uuid) do canal. period_sql devolve uma data; nulo = arquivo único (1970-01-01).
create or replace function public.obs_archive_registry()
returns table (table_name text, filter_sql text, period_sql text, sum_sql text, order_sql text)
language sql
stable   -- (emenda 1: D-m13) era immutable; a função é recriada por migrations futuras
set search_path = ''
as $$
  values
    ('competitor_channels', 't.id = $1', null, null, 't.id'),
    ('competitor_collection_pauses', 't.competitor_channel_id = $1', null, null, 't.id'),
    ('competitor_channel_snapshots', 't.competitor_channel_id = $1', 't.snapshot_date', 't.view_count', 't.id'),
    ('competitor_channel_hour_map', 't.competitor_channel_id = $1', 't.month', null, 't.month, t.format, t.phase'),
    ('competitor_videos', 't.competitor_channel_id = $1', null, null, 't.id'),
    ('competitor_field_versions',
     '(t.competitor_channel_id = $1 or t.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1))',
     '(t.first_seen_at at time zone ''UTC'')::date', null, 't.id'),
    ('competitor_raw',
     '(t.competitor_channel_id = $1 or t.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1))',
     '(t.first_seen_at at time zone ''UTC'')::date', null, 't.id'),
    ('competitor_video_versions',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.first_seen_at at time zone ''UTC'')::date', null, 't.id'),
    ('competitor_changes',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)', null, null, 't.id'),
    ('competitor_video_tier_spans',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     't.from_date', null, 't.video_id, t.from_date'),
    ('competitor_video_daily',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     't.snap_date', 't.views', 't.video_id, t.snap_date'),
    -- (emenda 1: D-I1) tabela da MG4, que ainda não existe: a contagem a pula até existir. Chave primária (video_id, age_days) do spec.
    ('competitor_video_marks',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     null, null, 't.video_id, t.age_days'),
    ('competitor_video_early',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.taken_at at time zone ''UTC'')::date', 't.views', 't.video_id, t.taken_at'),
    ('competitor_video_hourly',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.hour_slot at time zone ''UTC'')::date', 't.views', 't.video_id, t.hour_slot'),
    ('competitor_hour_fold_log',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     't.day', null, 't.video_id, t.day'),
    ('competitor_video_comment_snaps',
     '(t.competitor_channel_id = $1 or t.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1))',
     '(t.taken_at at time zone ''UTC'')::date', null, 't.video_id, t.mark'),
    ('competitor_video_comments',
     '(t.competitor_channel_id = $1 or t.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1))',
     '(t.first_seen_at at time zone ''UTC'')::date', null, 't.id'),
    ('competitor_video_comment_marks',
     't.comment_id in (select k.id from public.competitor_video_comments k where k.competitor_channel_id = $1 or k.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1))',
     null, 't.likes', 't.comment_id, t.mark'),
    ('competitor_readings',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.generated_at at time zone ''UTC'')::date', null, 't.id'),
    ('youtube_intelligence_tasks',
     't.target_video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.requested_at at time zone ''UTC'')::date', null, 't.id');
$$;

-- Tabelas que somem em cascata com o canal e que, de propósito, NÃO vão para o arquivo.
create or replace function public.obs_archive_excluded()
returns table (table_name text, reason text)
language sql
stable   -- (emenda 1: D-m13)
set search_path = ''
as $$
  values ('competitor_video_comment_authors', 'identidade do autor do comentário: decisão 20 do dono, não se guarda além de 28 dias');
$$;

-- Toda tabela que some em cascata com um canal e não está no registro nem na lista de exclusão. Vazio = o export cobre tudo.
create or replace function public.obs_archive_uncovered()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  with recursive alvo (rel) as (
    select 'public.competitor_channels'::regclass::oid
    union
    select k.conrelid
      from pg_catalog.pg_constraint k
      join alvo a on k.confrelid = a.rel
     where k.contype = 'f' and k.confdeltype = 'c' and k.conrelid <> k.confrelid
  )
  select coalesce(array_agg(c.relname::text order by c.relname::text), '{}'::text[])
    from alvo a
    join pg_catalog.pg_class c on c.oid = a.rel
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where not (n.nspname = 'public' and c.relname::text in (select r.table_name from public.obs_archive_registry() r))
     and not (n.nspname = 'public' and c.relname::text in (select e.table_name from public.obs_archive_excluded() e));
$$;

create or replace function public.obs_archive_channel_counts(p_channel uuid)
returns table (table_name text, period_start date, row_count bigint, control_sum numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if p_channel is null then
    raise exception 'E10:parametro_nulo: obs_archive_channel_counts' using errcode = '22023';
  end if;
  for r in select * from public.obs_archive_registry() loop
    -- tabela do registro que ainda não existe neste banco (migration de outra etapa não aplicada) não tem linha: pula
    continue when to_regclass('public.' || quote_ident(r.table_name)) is null;
    return query execute format(
      'select %L::text, %s, count(*)::bigint, %s::numeric from public.%I t where %s group by 2',
      r.table_name,
      case when r.period_sql is null then 'date ''1970-01-01''' else format('date_trunc(''month'', (%s)::timestamp)::date', r.period_sql) end,
      case when r.sum_sql is null then 'null' else format('coalesce(sum(%s), 0)', r.sum_sql) end,
      r.table_name, r.filter_sql
    ) using p_channel;
  end loop;
end $$;

-- As diferenças entre o banco e o registro de um lote: vazio = iguais. Só nomes de tabela, meses e números.
create or replace function public.obs_archive_diff(p_site uuid, p_batch text, p_channel uuid)
returns table (table_name text, period_start date, db_rows bigint, file_rows bigint, db_sum numeric, file_sum numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(d.table_name, b.table_name), coalesce(d.period_start, b.period_start),
         d.row_count, b.row_count, d.control_sum, b.control_sum
    from public.obs_archive_channel_counts(p_channel) d
    full join (select x.table_name, x.period_start, x.row_count, x.control_sum
                 from public.obs_archive_batches x
                where x.site_id = p_site and x.batch = p_batch and x.channel_ref = p_channel::text and x.deleted_at is null) b
      on b.table_name = d.table_name and b.period_start = d.period_start
   where d.row_count is distinct from b.row_count or d.control_sum is distinct from b.control_sum
   order by 1, 2;
$$;

-- ───────────────────────── 7. Os quatro comandos ─────────────────────────
-- Passo 1 (exportar): registra o lote. Recusa canal não pausado, pausado há menos de 6 minutos, em sincronização,
-- e arquivo que não bate com o banco.
create or replace function public.obs_archive_register(p_site uuid, p_batch text, p_channel uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c record;
  v_n integer;
  v_falta text[];
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_site is null or p_batch is null or p_channel is null or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'E10:parametro_nulo: obs_archive_register' using errcode = '22023';
  end if;
  v_falta := public.obs_archive_uncovered();
  if cardinality(v_falta) > 0 then
    raise exception 'E10:tabela_sem_export: %', array_to_string(v_falta, ', ') using errcode = 'P0001';
  end if;
  select c.channel_name, c.collection_paused_at, c.sync_status, c.sync_started_at into v_c
    from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site
     for update;
  if not found then
    raise exception 'E10:canal_nao_encontrado: neste site' using errcode = 'P0002';
  end if;
  if v_c.collection_paused_at is null then
    raise exception 'E10:nao_pausado: pause a coleta do canal antes de exportar' using errcode = 'P0001';
  end if;
  if v_c.collection_paused_at > v_now - interval '6 minutes' then
    raise exception 'E10:pausa_recente: espere 6 minutos depois de pausar (um disparo em andamento ainda pode gravar)' using errcode = 'P0001';
  end if;
  if v_c.sync_status = 'syncing' and v_c.sync_started_at > v_now - interval '10 minutes' then
    raise exception 'E10:sincronizando: o canal está sendo sincronizado agora' using errcode = 'P0001';
  end if;
  -- (emenda 1: D-m8) uma tarefa da forja em execução para um vídeo do canal ainda pode gravar uma leitura depois do export
  if exists (select 1 from public.youtube_intelligence_tasks t
              where t.status = 'running'
                and t.target_video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = p_channel)) then
    raise exception 'E10:forja_em_andamento: há leitura da forja em execução para um vídeo deste canal; espere terminar' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.obs_archive_batches b
              where b.site_id = p_site and b.batch = p_batch and b.channel_ref = p_channel::text and b.deleted_at is not null) then
    raise exception 'E10:lote_ja_apagado: use outro nome de lote' using errcode = 'P0001';
  end if;
  -- reexportar: o registro antigo deste lote e canal sai inteiro (a conferência e a confirmação antigas não valem)
  delete from public.obs_archive_batches b
   where b.site_id = p_site and b.batch = p_batch and b.channel_ref = p_channel::text and b.deleted_at is null;
  insert into public.obs_archive_batches
    (site_id, batch, kind, table_name, channel_ref, channel_label, period_start, period_end, row_count, control_sum,
     file_sha256, csv_sha256, blob_count, blob_bytes, blob_missing, exported_at)
  select p_site, p_batch, 'canal', x.table_name, p_channel::text, v_c.channel_name, x.period_start, x.period_end, x.row_count, x.control_sum,
         x.file_sha256, x.csv_sha256, x.blob_count, x.blob_bytes, x.blob_missing, v_now
    from jsonb_to_recordset(p_rows) as x(table_name text, period_start date, period_end date, row_count bigint, control_sum numeric,
                                          file_sha256 text, csv_sha256 text, blob_count integer, blob_bytes bigint, blob_missing integer);
  get diagnostics v_n = row_count;
  if exists (select 1 from public.obs_archive_diff(p_site, p_batch, p_channel)) then
    raise exception 'E10:banco_difere_do_manifesto: %',
      (select string_agg(d.table_name || ' ' || d.period_start || ' banco=' || coalesce(d.db_rows::text, 'sem linha') || ' arquivo=' || coalesce(d.file_rows::text, 'sem arquivo'), '; ')
         from (select * from public.obs_archive_diff(p_site, p_batch, p_channel) limit 10) d)
      using errcode = 'P0001';
  end if;
  return jsonb_build_object('status', 'exportado', 'arquivos', v_n, 'exported_at', v_now,
    'linhas', (select sum(b.row_count) from public.obs_archive_batches b where b.site_id = p_site and b.batch = p_batch and b.channel_ref = p_channel::text));
end $$;

-- A guarda comum dos passos 2, 3 e 4: trava a linha do canal e confere em que passo o lote está.
create or replace function public.obs_archive_guard(p_site uuid, p_batch text, p_channel uuid, p_need text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paused timestamptz;
  v_n integer;
  v_min_exp timestamptz;
  v_sem_conf integer;
  v_sem_nas integer;
begin
  select c.collection_paused_at into v_paused
    from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site
     for update;
  if not found then
    raise exception 'E10:canal_nao_encontrado: neste site' using errcode = 'P0002';
  end if;
  if v_paused is null then
    raise exception 'E10:nao_pausado: o canal não está com a coleta pausada' using errcode = 'P0001';
  end if;
  select count(*), min(b.exported_at), count(*) filter (where b.verified_at is null), count(*) filter (where b.nas_confirmed_at is null)
    into v_n, v_min_exp, v_sem_conf, v_sem_nas
    from public.obs_archive_batches b
   where b.site_id = p_site and b.batch = p_batch and b.channel_ref = p_channel::text and b.deleted_at is null;
  if v_n = 0 then
    raise exception 'E10:sem_lote: não há lote exportado deste canal com este nome' using errcode = 'P0001';
  end if;
  if v_min_exp < v_paused then
    raise exception 'E10:despausado_depois_do_export: exporte de novo' using errcode = 'P0001';
  end if;
  if p_need in ('conferido', 'confirmado') and v_sem_conf > 0 then
    raise exception 'E10:lote_nao_conferido: rode conferir antes' using errcode = 'P0001';
  end if;
  if p_need = 'confirmado' and v_sem_nas > 0 then
    raise exception 'E10:lote_nao_confirmado: falta confirmar a cópia no NAS' using errcode = 'P0001';
  end if;
end $$;

-- Passo 2 (conferir): o script já releu o disco; aqui o banco é recontado e comparado com o registro.
create or replace function public.obs_archive_verify(p_site uuid, p_batch text, p_channel uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_site is null or p_batch is null or p_channel is null then
    raise exception 'E10:parametro_nulo: obs_archive_verify' using errcode = '22023';
  end if;
  perform public.obs_archive_guard(p_site, p_batch, p_channel, 'exportado');
  if exists (select 1 from public.obs_archive_diff(p_site, p_batch, p_channel)) then
    raise exception 'E10:banco_difere_do_manifesto: %',
      (select string_agg(d.table_name || ' ' || d.period_start || ' banco=' || coalesce(d.db_rows::text, 'sem linha') || ' arquivo=' || coalesce(d.file_rows::text, 'sem arquivo'), '; ')
         from (select * from public.obs_archive_diff(p_site, p_batch, p_channel) limit 10) d)
      using errcode = 'P0001';
  end if;
  update public.obs_archive_batches b set verified_at = v_now
   where b.site_id = p_site and b.batch = p_batch and b.channel_ref = p_channel::text and b.deleted_at is null;
  get diagnostics v_n = row_count;
  return jsonb_build_object('status', 'conferido', 'arquivos', v_n, 'verified_at', v_now);
end $$;

-- Passo 3 (confirmar-nas): só quem administra o site.
create or replace function public.obs_archive_confirm_nas(p_site uuid, p_batch text, p_channel uuid, p_by uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_site is null or p_batch is null or p_channel is null or p_by is null then
    raise exception 'E10:parametro_nulo: obs_archive_confirm_nas' using errcode = '22023';
  end if;
  if not public.obs_archive_is_site_admin(p_site, p_by) then
    raise exception 'E10:sem_direito: só quem administra o site confirma a cópia no NAS' using errcode = '42501';
  end if;
  perform public.obs_archive_guard(p_site, p_batch, p_channel, 'conferido');
  update public.obs_archive_batches b set nas_confirmed_at = v_now, nas_confirmed_by = p_by
   where b.site_id = p_site and b.batch = p_batch and b.channel_ref = p_channel::text and b.deleted_at is null;
  get diagnostics v_n = row_count;
  return jsonb_build_object('status', 'confirmado', 'arquivos', v_n, 'nas_confirmed_at', v_now);
end $$;

-- Passo 4 (nesta fase): remover o canal inteiro, liberado pelo lote confirmado. Trava o canal, os vídeos e os comentários
-- (nenhuma linha filha entra entre a recontagem e o apagamento), reconta, compara com o registro e só então apaga.
create or replace function public.competitor_channel_remove_archived(p_site uuid, p_channel uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch text;
  v_c record;
  v_falta text[];
  v_urls text[];
  v_linhas bigint;
  v_arquivos integer;
  v_featured integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_site is null or p_channel is null or p_actor is null then
    raise exception 'E10:parametro_nulo: competitor_channel_remove_archived' using errcode = '22023';
  end if;
  v_falta := public.obs_archive_uncovered();
  if cardinality(v_falta) > 0 then
    raise exception 'E10:tabela_sem_export: %', array_to_string(v_falta, ', ') using errcode = 'P0001';
  end if;
  select c.channel_id, c.channel_name into v_c
    from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site
     for update;
  if not found then
    raise exception 'E10:canal_nao_encontrado: neste site' using errcode = 'P0002';
  end if;
  -- o lote mais recente deste canal que ainda não foi apagado
  select b.batch into v_batch
    from public.obs_archive_batches b
   where b.site_id = p_site and b.channel_ref = p_channel::text and b.deleted_at is null
   order by b.exported_at desc, b.batch desc
   limit 1;
  if v_batch is null then
    raise exception 'E10:sem_lote: este canal ainda não foi exportado' using errcode = 'P0001';
  end if;
  perform public.obs_archive_guard(p_site, v_batch, p_channel, 'confirmado');
  perform 1 from public.competitor_videos v where v.competitor_channel_id = p_channel for update;
  if to_regclass('public.competitor_video_comments') is not null then
    perform 1 from public.competitor_video_comments k
      where k.competitor_channel_id = p_channel
         or k.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = p_channel)
      for update;
  end if;
  if exists (select 1 from public.obs_archive_diff(p_site, v_batch, p_channel)) then
    raise exception 'E10:banco_difere_do_manifesto: %',
      (select string_agg(d.table_name || ' ' || d.period_start || ' banco=' || coalesce(d.db_rows::text, 'sem linha') || ' arquivo=' || coalesce(d.file_rows::text, 'sem arquivo'), '; ')
         from (select * from public.obs_archive_diff(p_site, v_batch, p_channel) limit 10) d)
      using errcode = 'P0001';
  end if;
  select coalesce(array_agg(distinct x.thumb_blob_url), '{}'::text[]) into v_urls
    from public.competitor_video_versions x
    join public.competitor_videos v on v.id = x.video_id
   where v.competitor_channel_id = p_channel and x.thumb_blob_url is not null;
  select count(*) into v_featured from public.competitor_video_comments k
   where k.featured_channel_id = p_channel and k.competitor_channel_id <> p_channel;
  select sum(b.row_count), count(*) into v_linhas, v_arquivos
    from public.obs_archive_batches b
   where b.site_id = p_site and b.batch = v_batch and b.channel_ref = p_channel::text and b.deleted_at is null;

  delete from public.competitor_channels c where c.id = p_channel and c.site_id = p_site;

  if exists (select 1 from public.obs_archive_channel_counts(p_channel)) then
    raise exception 'E10:sobrou_linha: uma tabela do registro não apaga em cascata' using errcode = 'P0001';
  end if;
  update public.obs_archive_batches b
     set deleted_at = v_now, rows_deleted = b.row_count,
         blob_urls_pending = case when b.table_name = 'competitor_channels' then v_urls else b.blob_urls_pending end
   where b.site_id = p_site and b.batch = v_batch and b.channel_ref = p_channel::text and b.deleted_at is null;
  -- (emenda 1: D-I3, S-M4) os outros lotes abertos deste canal apontam para um canal que não existe mais: encerrados
  update public.obs_archive_batches b
     set closed_at = v_now, closed_reason = 'substituido'
   where b.site_id = p_site and b.channel_ref = p_channel::text and b.deleted_at is null and b.closed_at is null;
  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, before_data, after_data)
  select p_actor, 'observatorio_canal_removido_com_arquivo', 'competitor_channel', p_channel, s.org_id, p_site,
         jsonb_build_object('channel_id', v_c.channel_id, 'channel_name', v_c.channel_name),
         jsonb_build_object('batch', v_batch, 'arquivos', v_arquivos, 'linhas', v_linhas,
                            'miniaturas_no_blob', cardinality(v_urls), 'featured_refs_cleared', v_featured)
    from public.sites s where s.id = p_site;
  return jsonb_build_object('status', 'removido', 'batch', v_batch, 'arquivos', v_arquivos, 'linhas', v_linhas,
                            'blob_urls', to_jsonb(v_urls), 'featured_refs_cleared', v_featured);
end $$;

-- Depois de apagar do Blob as miniaturas de um canal removido: tira as URLs da pendência.
create or replace function public.obs_archive_blobs_done(p_site uuid, p_batch text, p_channel_ref text, p_urls text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restam integer;
begin
  if p_site is null or p_batch is null or p_channel_ref is null or p_urls is null then
    raise exception 'E10:parametro_nulo: obs_archive_blobs_done' using errcode = '22023';
  end if;
  update public.obs_archive_batches b
     set blob_urls_pending = coalesce((select array_agg(u) from unnest(b.blob_urls_pending) u where u <> all (p_urls)), '{}'::text[])
   where b.site_id = p_site and b.batch = p_batch and b.channel_ref = p_channel_ref
     and b.table_name = 'competitor_channels' and b.deleted_at is not null
  returning cardinality(b.blob_urls_pending) into v_restam;
  return v_restam;
end $$;

-- ───────────────────────── 8. Sugestões: canal sem publicar há N meses ─────────────────────────
create or replace function public.competitor_archive_suggestions(p_site uuid, p_now timestamptz, p_months integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with canais as (
    select c.id, c.channel_name, c.last_ok_synced_at,   -- (emenda 1: D-m5)
           (select max(v.published_at) from public.competitor_videos v where v.competitor_channel_id = c.id) as ultima,
           (select count(*) from public.competitor_videos v where v.competitor_channel_id = c.id) as videos
      from public.competitor_channels c
     where c.site_id = p_site and c.missing_since is null and c.collection_paused_at is null
  ), parados as (
    select k.*, (select coalesce(sum(n.row_count), 0) from public.obs_archive_channel_counts(k.id) n) as linhas
      from canais k
     where k.ultima is not null and k.ultima < p_now - make_interval(months => p_months)
  )
  select case when p_site is null or p_now is null or p_months is null or p_months < 1 then null else jsonb_build_object(
    'canais_avaliados', (select count(*) from canais),
    'canais_sem_video', (select count(*) from canais where ultima is null),
    'sugestoes', coalesce((select jsonb_agg(jsonb_build_object(
        'channel_row_id', p.id, 'channel_name', p.channel_name, 'last_published_at', p.ultima, 'last_ok_synced_at', p.last_ok_synced_at, 'videos', p.videos, 'linhas', p.linhas)
        order by p.ultima, p.id) from parados p), '[]'::jsonb)
  ) end;
$$;

-- ───────────────────────── 9. Privilégios das funções ─────────────────────────
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.obs_db_size_record(timestamptz)',
    'public.obs_archive_is_site_admin(uuid, uuid)',
    'public.competitor_channel_pause_covers(uuid, timestamptz, interval)',
    'public.competitor_channel_pause(uuid, uuid, uuid)',
    'public.competitor_channel_unpause(uuid, uuid, uuid)',
    'public.obs_archive_registry()',
    'public.obs_archive_excluded()',
    'public.obs_archive_uncovered()',
    'public.obs_archive_channel_counts(uuid)',
    'public.obs_archive_diff(uuid, text, uuid)',
    'public.obs_archive_register(uuid, text, uuid, jsonb)',
    'public.obs_archive_guard(uuid, text, uuid, text)',
    'public.obs_archive_verify(uuid, text, uuid)',
    'public.obs_archive_confirm_nas(uuid, text, uuid, uuid)',
    'public.competitor_channel_remove_archived(uuid, uuid, uuid)',
    'public.obs_archive_blobs_done(uuid, text, text, text[])',
    'public.competitor_archive_suggestions(uuid, timestamptz, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ───────────────────────── 10. As quatro funções que escolhem ou cobram vídeo por canal ─────────────────────────
-- Remendo por âncora sobre o corpo INSTALADO (o de quem é dono da função: MG2b, MG9, MG8), para não copiar corpo de outra
-- migration: acrescenta uma condição e nada mais. Recusa (e desfaz a migration) se a âncora não aparecer exatamente uma vez.
-- Já remendada = pula. Cauda: por quanto tempo depois de despausar o canal continua fora da prova.
do $$
declare
  r record;
  v_def text;
  v_n integer;
begin
  for r in
    select * from (values
      ('public.competitor_series_health(uuid,timestamptz)',
       'or v.missing_since is not null or c.missing_since is not null',
       'or v.missing_since is not null or c.missing_since is not null or public.competitor_channel_pause_covers(c.id, p_now, interval ''3 days'')'),
      ('public.competitor_hourly_health(uuid,timestamptz,integer,integer)',
       'and v.missing_since is null and c.missing_since is null',
       'and v.missing_since is null and c.missing_since is null and not public.competitor_channel_pause_covers(c.id, p_now, interval ''26 hours'')'),
      ('public.competitor_comment_due(timestamptz,jsonb,interval,integer,text[],interval,timestamptz,uuid)',
       'and v.missing_since is null and c.missing_since is null and v.published_at is not null',
       'and v.missing_since is null and c.missing_since is null and not public.competitor_channel_pause_covers(c.id, p_now, interval ''0'') and v.published_at is not null'),
      ('public.competitor_comment_health(uuid,timestamptz,jsonb,integer,interval,timestamptz)',
       'and v.missing_since is null and c.missing_since is null and v.published_at is not null',
       'and v.missing_since is null and c.missing_since is null and not public.competitor_channel_pause_covers(c.id, p_now, interval ''7 days'') and v.published_at is not null')
    ) as t(assinatura, ancora, troca)
  loop
    v_def := pg_catalog.pg_get_functiondef(r.assinatura::regprocedure);
    continue when v_def like '%competitor_channel_pause_covers%';
    v_n := (length(v_def) - length(replace(v_def, r.ancora, ''))) / length(r.ancora);
    if v_n <> 1 then
      raise exception 'MG6: a âncora do remendo aparece % vez(es) em % (esperado: 1). O corpo da função mudou: conferir antes de aplicar.', v_n, r.assinatura;
    end if;
    execute replace(v_def, r.ancora, r.troca);
  end loop;
end $$;
```

### Apêndice B: roteiro de prova (psql) e a saída guardada

Rodar com `psql "postgresql://postgres:postgres@127.0.0.1:54422/postgres" -v mg=<caminho do SQL da MG6> -f <roteiro>`. Os dois roteiros terminam em `rollback`. A Tarefa 1 grava o primeiro em `.superpowers/sdd/a5-e10/mg6-prova.sql`, o segundo em `.superpowers/sdd/a5-e10/mg6-prova-2.sql` e a saída em `mg6-prova-saida.txt`.

**Roteiro 1: aplicar duas vezes, V1, V2 e o fluxo inteiro.**

```sql
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
begin;
\i :mg
\i :mg
\echo == V1
select (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and c.relname in ('obs_archive_batches','competitor_collection_pauses','obs_db_size_daily')) as tabelas_rls_de_3,
 (select count(*) from pg_policies where schemaname='public' and tablename in ('obs_archive_batches','competitor_collection_pauses','obs_db_size_daily') and cmd='SELECT') as policies_de_3,
 (select count(*) from information_schema.columns where table_schema='public' and table_name='competitor_channels' and column_name in ('collection_paused_at','collection_paused_by')) as colunas_de_2,
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('obs_db_size_record','obs_archive_is_site_admin','competitor_channel_pause_covers','competitor_channel_pause','competitor_channel_unpause','obs_archive_registry','obs_archive_excluded','obs_archive_uncovered','obs_archive_channel_counts','obs_archive_diff','obs_archive_register','obs_archive_guard','obs_archive_verify','obs_archive_confirm_nas','competitor_channel_remove_archived','obs_archive_blobs_done','competitor_archive_suggestions') and not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute') and has_function_privilege('service_role', p.oid, 'execute')) as funcoes_so_service_role_de_17,
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('competitor_series_health','competitor_hourly_health','competitor_comment_due','competitor_comment_health') and p.prosrc like '%competitor_channel_pause_covers%') as remendadas_de_4,
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('competitor_series_health','competitor_hourly_health','competitor_comment_due','competitor_comment_health') and not has_function_privilege('anon', p.oid, 'execute') and has_function_privilege('service_role', p.oid, 'execute')) as remendadas_com_grant_de_4,
 (select p.prosrc !~* 'delete' from pg_proc p where p.oid='public.yt_reporting_blobs_purge(text[])'::regprocedure) as limpeza_do_bruto_sem_delete,
 (select has_table_privilege('anon','public.obs_db_size_daily','select') or has_table_privilege('authenticated','public.obs_archive_batches','insert') or has_table_privilege('authenticated','public.competitor_collection_pauses','delete')) as privilegio_indevido;
\echo == V2 uncovered / registro
select public.obs_archive_uncovered();
select count(*) from public.obs_archive_registry();
select string_agg(r.table_name, ',') from public.obs_archive_registry() r where to_regclass('public.'||r.table_name) is null;
\echo == S0 escolha
create temp table e on commit drop as
select c.id as canal, c.site_id as site,
  (select om.user_id from public.organization_members om join public.sites s on s.id = c.site_id where om.role='org_admin' and om.org_id = s.org_id limit 1) as admin,
  (select u.id from auth.users u where not exists (select 1 from public.organization_members om where om.user_id=u.id and om.role='org_admin') limit 1) as nao_admin,
  (select count(*) from public.competitor_videos v where v.competitor_channel_id=c.id) as videos
from public.competitor_channels c order by 5 desc, 1 limit 1;
select videos, admin is not null as tem_admin, nao_admin is not null as tem_nao_admin from e;
\echo == S1 tamanho do banco, duas vezes
select (public.obs_db_size_record() ->> 'db_bytes')::bigint > 0;
select (public.obs_db_size_record() ->> 'db_bytes')::bigint > 0;
select count(*), min(jsonb_typeof(top_relations)), bool_and(db_bytes >= competitor_bytes + own_bytes) from public.obs_db_size_daily;
\echo == S2 provas antes
create temp table antes on commit drop as select
  public.competitor_series_health(e.site, now()) as serie,
  public.competitor_hourly_health(e.site, now(), 14, 25) as hora,
  (select count(*) from public.competitor_comment_due(now(), '[{"mark":1,"from_h":0,"until_h":100000}]'::jsonb, interval '20 hours', 10000, '{}', interval '15 minutes', null, e.site)) as due,
  (select jsonb_object_agg(x.table_name || ' ' || x.period_start, x.row_count) from public.obs_archive_channel_counts(e.canal) x) as contagem,
  (select count(*) from public.competitor_video_daily) as daily_total,
  (select count(*) from public.competitor_videos) as videos_total,
  (select count(*) from public.competitor_channels) as canais_total
from e;
select serie->>'fora_da_prova', hora->>'videos_na_lista', due, contagem from antes;
\echo == S3 pausar
do $$ declare x e%rowtype; begin select * into x from e;
  begin perform public.competitor_channel_pause(x.site, x.canal, x.nao_admin); raise exception 'devia recusar'; exception when insufficient_privilege then raise notice 'ok sem_direito'; end;
  begin perform public.competitor_channel_pause(x.site, gen_random_uuid(), x.admin); raise exception 'devia recusar'; exception when no_data_found then raise notice 'ok canal_nao_encontrado'; end;
end $$;
select public.competitor_channel_pause(e.site, e.canal, e.admin) ->> 'status' from e;
select public.competitor_channel_pause(e.site, e.canal, e.admin) ->> 'status' from e;
select count(*) filter (where resumed_at is null), count(*) from public.competitor_collection_pauses;
\echo == S4 provas depois de pausar (fora sobe, lista e due caem ou ficam)
select (public.competitor_series_health(e.site, clock_timestamp()) ->> 'fora_da_prova')::int - (a.serie->>'fora_da_prova')::int as fora_a_mais,
       (a.hora->>'videos_na_lista')::int - (public.competitor_hourly_health(e.site, clock_timestamp(), 14, 25) ->> 'videos_na_lista')::int as lista_a_menos,
       a.due - (select count(*) from public.competitor_comment_due(clock_timestamp(), '[{"mark":1,"from_h":0,"until_h":100000}]'::jsonb, interval '20 hours', 10000, '{}', interval '15 minutes', null, e.site)) as due_a_menos,
       (select count(*) from public.competitor_videos v where v.competitor_channel_id = e.canal and v.missing_since is null) as videos_do_canal
from e, antes a;
select public.competitor_comment_health(e.site, clock_timestamp(), '[{"mark":1,"from_h":20,"until_h":36}]'::jsonb, 28, interval '2 hours', null) is not null from e;
\echo == S5 registrar
do $$ declare x e%rowtype; begin select * into x from e;
  begin perform public.obs_archive_register(x.site, 'canal-teste-2026-10-13', x.canal, '[{"table_name":"competitor_channels","period_start":"1970-01-01","period_end":"1970-01-01","row_count":1,"file_sha256":"aa","csv_sha256":"aa"}]'::jsonb); raise exception 'devia recusar';
  exception when others then raise notice 'ok %', split_part(sqlerrm, ':', 2); end;
end $$;
update public.competitor_channels c set collection_paused_at = collection_paused_at - interval '10 minutes' from e where c.id = e.canal;
update public.competitor_collection_pauses p set paused_at = paused_at - interval '10 minutes' from e where p.competitor_channel_id = e.canal;
create temp table linhas on commit drop as
select jsonb_agg(jsonb_build_object('table_name', x.table_name, 'period_start', x.period_start, 'period_end', (x.period_start + interval '1 month - 1 day')::date,
  'row_count', x.row_count, 'control_sum', x.control_sum, 'file_sha256', repeat('a', 64), 'csv_sha256', repeat('b', 64),
  'blob_count', case when x.table_name = 'competitor_video_versions' then 0 end)) as j
from e, public.obs_archive_channel_counts(e.canal) x;
do $$ declare x e%rowtype; j jsonb; errado jsonb; begin select * into x from e; select l.j into j from linhas l;
  errado := jsonb_set(j, '{0,row_count}', '999');
  begin perform public.obs_archive_register(x.site, 'canal-teste-2026-10-13', x.canal, errado); raise exception 'devia recusar';
  exception when others then raise notice 'ok %', split_part(sqlerrm, ':', 2); end;
end $$;
select count(*) as registro_depois_da_recusa from public.obs_archive_batches;
select public.obs_archive_register(e.site, 'canal-teste-2026-10-13', e.canal, l.j) - 'exported_at' from e, linhas l;
select public.obs_archive_register(e.site, 'canal-teste-2026-10-13', e.canal, l.j) ->> 'status' as reexportar from e, linhas l;
\echo == S6 ordem dos passos
do $$ declare x e%rowtype; begin select * into x from e;
  begin perform public.obs_archive_confirm_nas(x.site, 'canal-teste-2026-10-13', x.canal, x.admin); raise exception 'devia recusar';
  exception when others then raise notice 'ok %', split_part(sqlerrm, ':', 2); end;
  begin perform public.competitor_channel_remove_archived(x.site, x.canal, x.admin); raise exception 'devia recusar';
  exception when others then raise notice 'ok %', split_part(sqlerrm, ':', 2); end;
end $$;
select public.obs_archive_verify(e.site, 'canal-teste-2026-10-13', e.canal) ->> 'status' from e;
do $$ declare x e%rowtype; begin select * into x from e;
  begin perform public.obs_archive_confirm_nas(x.site, 'canal-teste-2026-10-13', x.canal, x.nao_admin); raise exception 'devia recusar';
  exception when others then raise notice 'ok %', split_part(sqlerrm, ':', 2); end;
  begin perform public.competitor_channel_remove_archived(x.site, x.canal, x.admin); raise exception 'devia recusar';
  exception when others then raise notice 'ok %', split_part(sqlerrm, ':', 2); end;
end $$;
select public.obs_archive_confirm_nas(e.site, 'canal-teste-2026-10-13', e.canal, e.admin) ->> 'status' from e;
\echo == S7 linha nova depois do export: a remocao recusa e nao apaga
insert into public.competitor_video_daily (video_id, snap_date, views, taken_at)
select v.id, date '2031-01-15', 5, now() from public.competitor_videos v, e where v.competitor_channel_id = e.canal limit 1;
do $$ declare x e%rowtype; begin select * into x from e;
  begin perform public.competitor_channel_remove_archived(x.site, x.canal, x.admin); raise exception 'devia recusar';
  exception when others then raise notice 'ok %', sqlerrm; end;
end $$;
select count(*) as canal_ainda_existe from public.competitor_channels c, e where c.id = e.canal;
delete from public.competitor_video_daily where snap_date = date '2031-01-15';
\echo == S8 remover
select public.competitor_channel_remove_archived(e.site, e.canal, e.admin) - 'blob_urls' from e;
select (select count(*) from public.competitor_channels c, e where c.id = e.canal) as canal,
       (select count(*) from public.competitor_channels) - a.canais_total as canais_delta,
       (select count(*) from public.competitor_videos) - a.videos_total + e.videos as videos_de_outros_delta,
       (select count(*) from public.obs_archive_batches where deleted_at is not null and rows_deleted = row_count) as arquivos_marcados,
       (select count(*) from public.obs_archive_batches where deleted_at is null) as arquivos_nao_marcados,
       (select count(*) from public.audit_log where action = 'observatorio_canal_removido_com_arquivo' and actor_user_id = e.admin) as auditoria,
       (select count(*) from public.competitor_collection_pauses) as pausas_restantes
from e, antes a;
\echo == S9 despausar invalida a conferencia (outro canal)
create temp table e2 on commit drop as select c.id as canal, c.site_id as site, e.admin from public.competitor_channels c, e where c.site_id = e.site order by 1 limit 1;
select public.competitor_channel_pause(e2.site, e2.canal, e2.admin) ->> 'status' from e2;
update public.competitor_channels c set collection_paused_at = collection_paused_at - interval '10 minutes' from e2 where c.id = e2.canal;
update public.competitor_collection_pauses p set paused_at = paused_at - interval '10 minutes' from e2 where p.competitor_channel_id = e2.canal;
select public.obs_archive_register(e2.site, 'canal-dois', e2.canal,
  (select jsonb_agg(jsonb_build_object('table_name', x.table_name, 'period_start', x.period_start, 'period_end', x.period_start, 'row_count', x.row_count, 'control_sum', x.control_sum, 'file_sha256', repeat('c', 64), 'csv_sha256', repeat('d', 64))) from public.obs_archive_channel_counts(e2.canal) x)) ->> 'status' from e2;
select public.obs_archive_verify(e2.site, 'canal-dois', e2.canal) ->> 'status' from e2;
select public.competitor_channel_unpause(e2.site, e2.canal, e2.admin) - 'resumed_at' from e2;
select count(*) filter (where verified_at is not null) as ainda_conferidos, count(*) as arquivos from public.obs_archive_batches where batch = 'canal-dois';
select public.competitor_channel_pause_covers(e2.canal, clock_timestamp(), interval '3 days') as cauda_3d, public.competitor_channel_pause_covers(e2.canal, clock_timestamp(), interval '0') as cauda_0 from e2;
select public.competitor_channel_pause(e2.site, e2.canal, e2.admin) ->> 'status' from e2;
do $$ declare x e2%rowtype; begin select * into x from e2;
  begin perform public.obs_archive_verify(x.site, 'canal-dois', x.canal); raise exception 'devia recusar';
  exception when others then raise notice 'ok %', split_part(sqlerrm, ':', 2); end;
end $$;
\echo == S10 sugestoes
select public.competitor_archive_suggestions(e.site, now(), 12) - 'sugestoes', jsonb_array_length(public.competitor_archive_suggestions(e.site, now(), 12) -> 'sugestoes') from e;
select jsonb_array_length(public.competitor_archive_suggestions(e.site, now() + interval '30 years', 12) -> 'sugestoes') > 0 as daqui_a_30_anos from e;
select public.competitor_archive_suggestions(null, now(), 12) is null;
rollback;
select to_regclass('public.obs_archive_batches') is null as nada_ficou;
```

**Saída do roteiro 1** (13/10/2026; sem as linhas de eco de comando e sem os avisos de "já existe" da segunda aplicação; os instantes mudam a cada rodada).

```text
== V1
3|3|2|17|4|4|t|f
== V2 uncovered / registro
{}
19
== S0 escolha
1|t|t
== S1 tamanho do banco, duas vezes
t
t
1|object|t
== S2 provas antes
0|0|1|{"competitor_raw 2026-10-01": 2, "competitor_videos 1970-01-01": 1, "competitor_changes 1970-01-01": 2, "competitor_channels 1970-01-01": 1, "competitor_video_daily 2026-10-01": 1, "competitor_field_versions 2026-10-01": 17, "competitor_video_versions 2026-10-01": 5, "competitor_video_tier_spans 2026-10-01": 1, "competitor_channel_snapshots 2026-10-01": 1}
== S3 pausar
NOTICE:  ok sem_direito
NOTICE:  ok canal_nao_encontrado
pausado
ja_pausado
1|1
== S4 provas depois de pausar (fora sobe, lista e due caem ou ficam)
1|0|0|1
t
== S5 registrar
NOTICE:  ok pausa_recente
NOTICE:  ok banco_difere_do_manifesto
0
{"linhas": 32, "status": "exportado", "arquivos": 10}
exportado
== S6 ordem dos passos
NOTICE:  ok lote_nao_conferido
NOTICE:  ok lote_nao_conferido
conferido
NOTICE:  ok sem_direito
NOTICE:  ok lote_nao_confirmado
confirmado
== S7 linha nova depois do export: a remocao recusa e nao apaga
NOTICE:  ok E10:banco_difere_do_manifesto: competitor_video_daily 2031-01-01 banco=1 arquivo=sem arquivo
1
== S8 remover
{"batch": "canal-teste-2026-10-13", "linhas": 32, "status": "removido", "arquivos": 10, "featured_refs_cleared": 0}
0|-1|0|10|0|1|0
== S9 despausar invalida a conferencia (outro canal)
pausado
exportado
conferido
{"status": "despausado", "arquivos_invalidados": 5}
0|5
t|f
pausado
NOTICE:  ok despausado_depois_do_export
== S10 sugestoes
{"canais_avaliados": 2, "canais_sem_video": 1}|1
t
t
ROLLBACK
t
```

**Roteiro 2: as quatro funções antes de pausar, pausado, despausado e oito dias depois.**

```sql
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
begin;
\i :mg
create temp table e on commit drop as
select c.id as canal, c.site_id as site,
  (select om.user_id from public.organization_members om join public.sites s on s.id = c.site_id where om.role='org_admin' and om.org_id = s.org_id limit 1) as admin
from public.competitor_channels c where c.missing_since is null order by 1 limit 1;
insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at, discovered_at, view_count)
select e.canal, 'e10provaAAA', 'prova', now() - interval '2 days', now() - interval '2 days', 10 from e;
create temp table m on commit drop as select '[{"mark":1,"from_h":20,"until_h":100}]'::jsonb as marks;
\echo == antes de pausar: lista horaria, due do canal, atrasados do site, fora da serie
select (public.competitor_hourly_health(e.site, clock_timestamp(), 14, 25) ->> 'videos_na_lista')::int as lista,
       (select count(*) from public.competitor_comment_due(clock_timestamp(), m.marks, interval '20 hours', 10000, '{}', interval '15 minutes', null, e.site) d where d.channel_row_id = e.canal) as due_do_canal,
       (public.competitor_comment_health(e.site, clock_timestamp(), m.marks, 28, interval '2 hours', null) ->> 'retratos_atrasados')::int as atrasados,
       (public.competitor_series_health(e.site, clock_timestamp()) ->> 'fora_da_prova')::int as fora
from e, m;
select public.competitor_channel_pause(e.site, e.canal, e.admin) ->> 'status' from e;
\echo == pausado
select (public.competitor_hourly_health(e.site, clock_timestamp(), 14, 25) ->> 'videos_na_lista')::int as lista,
       (select count(*) from public.competitor_comment_due(clock_timestamp(), m.marks, interval '20 hours', 10000, '{}', interval '15 minutes', null, e.site) d where d.channel_row_id = e.canal) as due_do_canal,
       (public.competitor_comment_health(e.site, clock_timestamp(), m.marks, 28, interval '2 hours', null) ->> 'retratos_atrasados')::int as atrasados,
       (public.competitor_series_health(e.site, clock_timestamp()) ->> 'fora_da_prova')::int as fora
from e, m;
select public.competitor_channel_unpause(e.site, e.canal, e.admin) ->> 'status' from e;
\echo == despausado agora (cauda: horaria 26 h, comentarios 7 d e serie 3 d ainda fora; a fila de comentarios volta)
select (public.competitor_hourly_health(e.site, clock_timestamp(), 14, 25) ->> 'videos_na_lista')::int as lista,
       (select count(*) from public.competitor_comment_due(clock_timestamp(), m.marks, interval '20 hours', 10000, '{}', interval '15 minutes', null, e.site) d where d.channel_row_id = e.canal) as due_do_canal,
       (public.competitor_comment_health(e.site, clock_timestamp(), m.marks, 28, interval '2 hours', null) ->> 'retratos_atrasados')::int as atrasados,
       (public.competitor_series_health(e.site, clock_timestamp()) ->> 'fora_da_prova')::int as fora
from e, m;
\echo == 8 dias depois de despausar (tudo volta a ser cobrado)
select (public.competitor_hourly_health(e.site, clock_timestamp() + interval '8 days', 14, 25) ->> 'videos_na_lista')::int as lista,
       (public.competitor_series_health(e.site, clock_timestamp() + interval '8 days') ->> 'fora_da_prova')::int as fora,
       public.competitor_channel_pause_covers(e.canal, clock_timestamp() + interval '8 days', interval '7 days') as coberto_7d
from e;
\echo == outro site nao e tocado: pausar com site errado
do $$ declare x e%rowtype; outro uuid; begin select * into x from e; select s.id into outro from public.sites s where s.id <> x.site limit 1;
  if outro is null then raise notice 'sem segundo site na semente'; return; end if;
  begin perform public.competitor_channel_pause(outro, x.canal, x.admin); raise exception 'devia recusar';
  exception when others then raise notice 'ok %', split_part(sqlerrm, ':', 2); end;
end $$;
rollback;
```

**Saída do roteiro 2** (as quatro colunas são: vídeos na lista horária, vídeos do canal na fila de comentários, retratos atrasados, vídeos fora da prova de série).

```text
== antes de pausar
1|1|1|0
pausado
== pausado
0|0|0|2
despausado
== despausado agora
0|1|0|2
== 8 dias depois de despausar (lista horária, fora da série, coberto pela cauda de 7 dias)
2|0|f
== pausar com o site errado
NOTICE:  ok canal_nao_encontrado
```

**Roteiro 3: a âncora ausente faz a migration recusar.** Dentro de `begin;`, recriar `public.competitor_hourly_health(uuid, timestamptz, integer, integer)` com o corpo `select '{}'::jsonb`, aplicar a MG6 e fazer `rollback`. Saída esperada: `ERROR:  MG6: a âncora do remendo aparece 0 vez(es) em public.competitor_hourly_health(uuid,timestamptz,integer,integer) (esperado: 1). O corpo da função mudou: conferir antes de aplicar.` Depois do `rollback`, `to_regclass('public.obs_archive_batches')` é nulo e a função continua sem a chamada.
