# M10a. Vídeo antigo, o que não depende de ninguém: plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development` (recomendada) ou
> `superpowers:executing-plans`. Os passos usam caixas (`- [ ]`) para acompanhar.

Escrito em 14/10/2026. Spec: `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/` (commit `8b4dd7b61`). Índice dos
planos: `docs/superpowers/plans/2026-10-14-manutencao-nas-00-indice.md` (linha 3). Brief: `.superpowers/sdd/manutencao-nas/brief-planos.md`.

**Objetivo.** Pôr em produção, com **zero vídeo marcado**, tudo o que a saída por idade do vídeo (D15, H = 24 meses) precisa
antes do primeiro congelamento: as colunas do toco em `competitor_videos`; `obs_archive_video_policy` com H = 24 e a classe
**fechada**; a guarda de `insert` nas 8 tabelas da classe; o teste dos leitores de `competitor_videos`; os oito pontos em que
a coleta e os carregadores respeitam a marca; e a prova "com zero vídeo marcado, o conjunto de dados é idêntico" (item de
aceite 135). Nada congela nesta etapa: a função de congelar, a leitura mensal e as telas são da M10b; a retirada, da M10c;
a classe na chave do registro e no caminho do arquivo, da M3b.

**Arquitetura.** Uma migration (colunas, gatilho de imutabilidade do toco, política, guarda de `insert` nas 8 tabelas,
índice de `competitor_readings`, e as quatro funções SQL dos oito pontos redefinidas); um predicado único no código
(`estaCongelado`, `estaNoArquivo`) usado pela sincronização, pelos carregadores, por `weeklyRate` e pela ação de fixar; uma
lista em arquivo dos leitores de `competitor_videos`, com teste que varre código e migrations e, com banco local, as funções
vivas. A ordem de produção é dura (02 §10.8, "Ordem de entrada", passos 1 e 2): **migration antes do código**; código novo
sem as colunas faz a sincronização de todo canal terminar em erro.

**Tecnologia.** Postgres 17 (Supabase), plpgsql; Next.js 16 / TypeScript strict; Vitest (unidade e integração com
`HAS_LOCAL_DB`); `pg` nos testes de SQL direto; `pgbench` na medida CP29.

---

## Restrições globais (valem para toda tarefa)

1. **Onde se trabalha: direto no `staging`** (regra do dono; conciliação C1 do controlador sobre Yannis Y1). Duas travas, escritas no ledger na Tarefa 0 e conferidas pelo agente antes do primeiro commit de cada fase:
   - `TRAVA M10a-1: nenhum arquivo em supabase/migrations/ desta etapa (nem não commitado) antes de a M2 estar aplicada e conferida no ledger.` Até lá o SQL vive em `supabase/rascunhos/m10a.sql` (rastreado; o CLI do Supabase só lê `migrations/` e `seeds/dev.sql`, `config.toml:29`) e os testes das Tarefas 2 a 5 o leem desse caminho (constante `M10A_SQL` num só lugar, `apps/web/test/integration/video-antigo-m10a-caminho.ts`).
   - `TRAVA M10a-2: nenhum commit das Tarefas 6 a 12 antes de a migration da M10a estar em produção e a prova depois-migration anotada no ledger.` As Tarefas 6 a 12 também não começam antes (não ficam "prontas e sem commit" na árvore comum: outra trilha que commita o mesmo arquivo por caminho levaria o trabalho junto).
      - `.superpowers/` é ignorado pelo git: ledger, `cp29/`, `prova-zero.sh`, `desligar-guarda.sql` e `saidas/` vivem só no disco desta máquina, nunca entram em `git commit` (um caminho ignorado faz o `git commit -- <caminho>` falhar a linha inteira, sem commitar nada). O ledger é o portão entre trilhas por estar no mesmo disco; perder o disco perde o ledger (dívida aceita, sem gatilho: a prova de produção é refeita por `prova-zero.sh`).
   Commits por caminho explícito (`git commit -- <caminhos>`), um por tarefa, `tipo: descrição`; nunca `git add -A`, stash ou reset. **Arquivo novo:** `git add -- <caminhos>` antes de todo `git commit -- <caminhos>` (o commit por caminho não leva arquivo não rastreado: falha com "pathspec did not match"; Yannis, revisão da M2 r2, N1). Depois da TRAVA M10a-2 solta, cada tarefa pode ser promovida a `main` a qualquer hora: com zero vídeo marcado todo estado parcial equivale ao de hoje.
2. **Migration só por `npm run db:new <nome>`**, rodado na Tarefa 5b, na árvore comum, **depois** de a migration da M2 estar aplicada e conferida no ledger. Idempotência: `add column if not exists`, `create table if not exists`,
   `drop trigger if exists` antes de `create trigger`, `create or replace function`, `drop function if exists` só onde a
   assinatura muda (`pin_competitor_video`).
3. **`db:push:prod` é do dono**, precedido de `npx supabase migration list --linked`; só segue se a única pendente for a
   desta etapa (05 §16). Janela: fora de 11:30 a 13:00 UTC e entre os minutos 6 e 18 de um intervalo de 20 (`:06-:18`, `:26-:38` ou `:46-:58`): a sincronização do minuto `:x0` já passou do teto de 300 s e a próxima não começou. O par `antes`/`depois` da migration cabe todo dentro desse trecho; se não couber, recomeça no trecho seguinte com um `antes` novo (Phil I-5). **Depois** de a M2 estar aplicada e conferida (dois pushes separados).
4. **Banco local de integração:** `bythiago_int` (API 54421, Postgres 54422). Linha de teste:
   `HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run <arquivo> > /tmp/…/saida.txt 2>&1`
   (sem paralelismo entre arquivos; no contexto entram só as falhas). Migration nova: aplicar nos dois bancos locais por
   `psql -f` e registrar a versão em `supabase_migrations.schema_migrations`. **Nunca chamar função sem EXECUTE como
   `anon`/`authenticated` nesse Postgres (SIGSEGV):** permissão se testa com `has_function_privilege`.
5. **Falha em verde.** Cada tarefa diz o que acontece quando o dado **não existe** antes de dizer o que acontece no erro.
   Regra geral desta etapa: chave ausente numa linha lida (coluna não pedida no `select`) leria "não congelado"; isso é
   fechado por teste das colunas pedidas (Tarefas 7 e 9) e pelo `PACK_VERSION` novo **no deploy**; depois do primeiro congelamento, pela invalidação do cache que a M10b entrega (Yannis Y10). Nunca por padrão silencioso.
6. TypeScript strict, sem `any`; arquivos kebab-case; sanitizers não entram aqui. Nenhum pacote em `packages/*` é tocado.
7. Escopo da fase 2a da forja e o kit da forja: **não são tocados**. NAS: nada.
8. **Relatório de subagente em até 10 linhas;** saída de teste em arquivo; modelo Sonnet para executar, `medium`.

## Foco da revisão (Phil e Yannis, no fim do plano e do lote)

- **Phil:** a CP29 (método, carga concorrente, limiar); o gatilho de `insert` como segunda linha e seu custo por lote; o
  `revoke` da política para `service_role`; a prova de produção do item 135 (o que é "igual" e em que intervalo); a lista das
  tabelas com chave para `competitor_videos` (disjunção e `competitor_hour_fold_log`).
- **Yannis:** a troca de assinatura de `pin_competitor_video` sem janela de erro; o predicado nos quatro caminhos da
  sincronização (`asked` nunca recebe congelado: a guarda nunca é atingida por `markMissing`); o teste de leitores
  (falso negativo por string, migrations pelo nome); o `PACK_VERSION`; reverter código antes da M10b.

## Dependência da M2 (exatamente o que é, e o que não é)

M10a **não usa nenhum objeto que a M2 cria** (`obs_part`, `obs_partitions_ensure`, a tabela de ensaio, o registro) e a
M2 não usa nada desta. A dependência é de **ordem e de disco**, por quatro fatos:

1. **Timestamp.** O arquivo desta etapa tem de ser posterior ao da M2 (senão o `db push` acusa "out of order" e pede
   `--include-all`). Por isso ele só é criado (`npm run db:new`) na Tarefa 5b, com a M2 aplicada e conferida no ledger;
   antes disso o SQL vive no rascunho, fora de `supabase/migrations/` (TRAVA M10a-1). Se o nome do arquivo da M2 mudar
   depois, o desta etapa é recriado com `db:new` e o conteúdo copiado.
2. **Árvore do push.** Pela mesma trava, o `migration list --linked` do dia da M2 nunca mostra duas pendentes: o arquivo
   desta etapa não existe no disco até a M2 estar aplicada (o `db push` lê o disco, não o git).
3. **Funções que leem as séries.** `competitor_series_health` e `competitor_channel_removal_impact` (redefinidas aqui)
   leem `competitor_video_daily`, `competitor_video_early` e `competitor_video_hourly` **pelo nome**. Depois da M2 esses nomes
   são as tabelas mãe particionadas, com as mesmas colunas: nada muda no texto. São `language sql`/`plpgsql` comuns, não
   `begin atomic`: a conferência `pg_depend` da M2 não as acusa (02 §10.2). Os testes de integração desta etapa rodam no
   `bythiago_int` **com a M2 aplicada** (Tarefa 12, passo 1), como em produção.
4. **Conferida antes.** O segundo push só acontece depois de o dono registrar no ledger que a M2 foi conferida (a
   conferência é definida no plano da M2).

**Também depende de:** pedido 15 do §17 (janela combinada com o controlador da A5: os oito pontos tocam arquivos da A5,
que são relidos no dia, Tarefa 0); CP29 (Tarefa 1). **Quem depende desta etapa:** a M3b lê `obs_archive_video_policy.released`
para a condição 1 do portão da classe `video_antigo`; a M10b usa as colunas, o predicado, a guarda e a lista de leitores. **Portões da M10b registrados no ledger (Tarefa 0):** (i) toda escrita de `archive_frozen_at`/`archive_dropped_at` invalida `observatoryTag(siteId)` e entra em `WRITES` de `cache-writers.test.ts` (Yannis Y10); (ii) `'M10b'` sai de `ETAPAS_EM_ABERTO` (Tarefa 11) com `tsc` verde antes do primeiro congelamento (Y4); (iii) todo descongelar (fixar ou comando do runbook) zera `series_tier` e `series_tier_since`, e um teste da M10b repete o caso da Tarefa 5 (caso 6) pelo comando de descongelar (Phil I-3; a coluna já existe nesta etapa, então a função de fixar já cumpre; falta o comando).

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/rascunhos/m10a.sql` | criar (Tarefa 2), `git rm` (Tarefa 5b) | rascunho rastreado do SQL até a vez da migration (TRAVA M10a-1) |
| `supabase/migrations/<ts>_observatorio_m10a_video_antigo_base.sql` | criar na Tarefa 5b (`db:new`) | colunas, gatilhos, política, guarda, índice, 5 funções |
| `apps/web/test/youtube/video-antigo/__golden__/dataset-antes{,-semente}.json` | criar (Tarefa 0) | retrato do conjunto de dados ANTES de qualquer edição (Yannis Y3) |
| `.superpowers/sdd/manutencao-nas/m10a/desligar-guarda.sql` | criar (Tarefa 5b) | comandos que o DONO roda para desligar a guarda; o agente nunca aplica (C4) |
| `apps/web/src/lib/youtube/video-antigo/esta-congelado.ts` | criar | o predicado único e o estado do vídeo |
| `apps/web/src/lib/youtube/video-antigo/leitores-competitor-videos.ts` | criar | a lista de leitores, tabelas e funções vivas |
| `apps/web/src/lib/youtube/competitor-sync.ts` | editar | pontos 1, 2 e 3 |
| `apps/web/src/lib/youtube/competitor-health.ts` | editar | leitura da chave `arquivados` (ponto 5) |
| `apps/web/src/lib/youtube/competitor-removal-impact.ts` | editar | as duas parcelas novas (ponto 8) |
| `apps/web/src/lib/youtube/observatorio/load.ts` | editar | `VIDEO_COLS`, `VideoRow`, `rowsToDataset` (ponto 6) |
| `apps/web/src/lib/youtube/observatorio/types.ts` | editar | `ObsVideo.arquivo` |
| `apps/web/src/lib/youtube/observatorio/pack.ts` | editar | `PACK_VERSION = 3` |
| `apps/web/src/lib/youtube/observatorio/series.ts` | editar | `weeklyRate` do vídeo congelado (V15) |
| `apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts` | editar | fixar (ponto 7) |
| `apps/web/src/types/database.types.ts` | regenerar | colunas e tabela novas |
| testes (lista em cada tarefa) | criar/editar | |
| `.superpowers/sdd/manutencao-nas/m10a/cp29/*` | criar | scripts e resultado da medida CP29 (fora do código do produto) |
| `.superpowers/sdd/manutencao-nas/m10a/prova-zero.sh` | criar (Tarefa 5b) | as leituras de produção do item 135 (o dono roda) |
| `.superpowers/sdd/manutencao-nas/ledger-video-antigo.md` | criar | os cinco passos da §10.8 com data (item 146) |

**Os oito pontos, lidos hoje (14/10) no `staging` `a1094bfe3`. Relidos no dia (Tarefa 0): as linhas mudam com a A5.**

| # | Ponto (pedido 15) | Onde está hoje |
|---|---|---|
| 1 | Classificação de faixas e passada diária | `competitor-sync.ts:350` (`ALL_COLS`), `:370-372` (`classify`), `:931-936` (plano e prova do dia), `:1205-1207` (reclassificação), `:1221-1223` (passada diária); `extendPromotions(all, …)` em `:1307` |
| 2 | Passada semanal e a conta que a fecha | `competitor-sync.ts:821-823` (`weeklyRows`), `:893-894` (`complete`) |
| 3 | Caminho da página de uploads | `competitor-sync.ts:1062-1069` (busca dos já gravados e `asked`), `:1116-1167` (insere, reconcilia, captura, regrava) |
| 4 | Fechamento da faixa | `apply_competitor_tier_plan`, `supabase/migrations/20261012000003_observatorio_a5_e2_serie_faixas.sql:66-111`; chamada em `competitor-sync.ts:1211` |
| 5 | Prova da série, chave `arquivados` | `competitor_series_health`, `20261012000004_observatorio_a5_e1_e2_provas_corretiva.sql:85-163`; leitor `competitor-health.ts:98`, `:139-157` |
| 6 | Carregadores das telas | `observatorio/load.ts:94` (`VIDEO_COLS`), `:260-323` (`rowsToDataset`), `:542` (`readVideos`); `observatorio/load-channel.ts:24`; `observatorio/series.ts:137-150` (`withUnobserved`, `weeklyRate`, F76) |
| 7 | Ação de fixar | `competitors/actions.ts:437-470` (`pinTarget`, `pinVideo`); `pin_competitor_video`, `20261007000002_observatorio_fixar_video_teto.sql:25-70` |
| 8 | Contagens do diálogo de remover canal | `competitor_channel_removal_impact`, `20261013000002_observatorio_a5_e15_leitura_horaria.sql:274-308`; leitor `competitor-removal-impact.ts:5-16` |

---

## Tarefa 0. As duas travas, releitura no dia, o retrato do "antes" e janela combinada com a A5

**Arquivos:** nenhum do produto. **Saída:** uma linha no ledger.

- [ ] **Passo 1.** Escrever no ledger as duas travas, com estas palavras: `TRAVA M10a-1: nenhum arquivo em supabase/migrations/ desta etapa (nem não commitado) antes de a M2 estar aplicada e conferida no ledger.` e `TRAVA M10a-2: nenhum commit das Tarefas 6 a 12 antes de a migration da M10a estar em produção e a prova depois-migration anotada no ledger.`
- [ ] **Passo 2.** Base verde no `staging` comum: `npx tsc -p apps/web --noEmit > …/tsc-base.txt 2>&1` e os testes dos arquivos que esta etapa toca (`apps/web/test/youtube/competitor-sync*.test.ts`, `apps/web/test/youtube/observatorio/load.test.ts`, `pack-shape.test.ts`, `cache-writers.test.ts`). Falha na base é anotada e levada ao controlador, não consertada aqui.
- [ ] **Passo 2b. O retrato do "antes" (Yannis Y3; Phil M-1 conciliado)**, antes de qualquer edição de código: gravar `apps/web/test/youtube/video-antigo/__golden__/dataset-antes.json` = `JSON.stringify(rowsToDataset(<fixture maior de load.test.ts>, NOW_FIXO))` (ajustar à assinatura do dia) e, com banco, `dataset-antes-semente.json` da semente do Observatório com `now` fixo; commit `test: retrato do conjunto de dados antes da M10a`. É deste arquivo, não do código novo, que a Tarefa 12 compara.
- [ ] **Passo 3.** Reler os oito pontos (tabela acima) com `grep -n` e corrigir as linhas citadas neste plano (a tarefa que edita usa a linha do dia). Conferir com o controlador da A5 (pedido 15) que nenhum lote dele está editando `competitor-sync.ts`, `load.ts`, `load-channel.ts` ou `actions.ts` sem ter chegado ao `staging`; se estiver, a edição desta etapa entra assim mesmo e o conflito é resolvido no próprio commit (05 §17, linha 15).
- [ ] **Passo 4.** Criar `.superpowers/sdd/manutencao-nas/ledger-video-antigo.md` com a tabela dos cinco passos da §10.8 (colunas: passo, o que é, data, quem, prova), as duas travas, os três portões da M10b (seção "Quem depende desta etapa") e a primeira linha: "M10a iniciada no `staging` de `<sha>`".
- [ ] **Passo 5.** Commit no `staging` (só o retrato; o ledger fica no disco): `git commit -m "test: retrato do conjunto de dados antes (M10a, Tarefa 0)" -- apps/web/test/youtube/video-antigo/__golden__`. O ledger não entra (`.superpowers/` é ignorado).

---

## Tarefa 1. CP29: o custo do gatilho e o tempo de uma retirada cheia, medidos antes da migration

**Arquivos:** criar `.superpowers/sdd/manutencao-nas/m10a/cp29/{semear.sql,lote-sem.sql,lote-com.sql,guarda.sql,retirada.sql,medir.sh,resultado.md}`.

**Por quê agora.** O spec manda medir antes (01 §7.5, CP29; 06 §18, item 138) e põe o teto de 100 vídeos por unidade na
política que **esta** migration grava (02 §10.8, "Os tetos"). Se a retirada de uma unidade cheia passar de 4 s, o valor
gravado já nasce menor: é a forma barata de "baixar o teto antes da migration da retirada".

**O que acontece quando o dado não existe:** o `bythiago_int` sem a M2 aplicada mede tabelas não particionadas; a medida
vale para o gatilho (que não toca as séries) e é refeita para a retirada só se a M2 mudar algo das 8 tabelas (não muda).
Banco local desligado: a tarefa para, sem número inventado.

- [ ] **Passo 1. Semear** (`semear.sql`, rodado com `psql -v ON_ERROR_STOP=1`): um site e uma organização de medida
  (`slug` `cp29-medida`), 20 canais com 100 vídeos cada (2.000 vídeos), e mais um canal "cheio" com **200 vídeos ativos e
  100 a retirar** (P39); para cada vídeo, as linhas típicas das 8 tabelas com **15 linhas por vídeo** na unidade cheia (item 143), na proporção de F66 (por vídeo,
  ~5,7 linhas de `competitor_field_versions`, ~1,7 de `competitor_video_versions`, ~0,6 de `competitor_raw`, 1 faixa,
  ~0,03 troca; zero retrato, dia somado e leitura da forja, e por isso o canal cheio recebe 1 retrato e 1 leitura por vídeo
  para não medir tabela vazia), completando com histórico de campo (que é o que cresce com a idade do vídeo) até 15 por vídeo; e com a **largura** de F66: `value` do histórico de campo com ~300 B, `value_text` das versões com ~850 B, `raw` com um JSON de 1.989 B (copiar a forma de um `raw` real do banco local, nunca `'x'`). `resultado.md` traz, por tabela, linhas e `pg_total_relation_size` da semente (Phil I-8). Esqueleto (o restante segue o mesmo molde por tabela):

```sql
begin;
insert into public.organizations (name, slug) values ('CP29', 'cp29-medida') on conflict do nothing;
insert into public.sites (org_id, name, slug, primary_domain)
select o.id, 'CP29', 'cp29-medida', 'cp29.invalid' from public.organizations o where o.slug = 'cp29-medida'
on conflict do nothing;
insert into public.competitor_channels (site_id, channel_id, channel_name, video_limit)
select s.id, 'UCcp29_' || g, 'CP29 ' || g, 50 from public.sites s, generate_series(1, 21) g where s.slug = 'cp29-medida';
insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at)
select c.id, 'cp29v' || c.channel_id || '_' || g, 'v' || g, now() - make_interval(days => 10 * g)
  from public.competitor_channels c cross join generate_series(1, 100) g
 where c.channel_id like 'UCcp29_%' and c.channel_id <> 'UCcp29_21';
insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at)
select c.id, 'cp29v21_' || g, 'v' || g, now() - make_interval(days => 3 * g)
  from public.competitor_channels c cross join generate_series(1, 300) g where c.channel_id = 'UCcp29_21';
-- competitor_field_versions: 6 campos por vídeo (molde; os demais seguem igual)
insert into public.competitor_field_versions (site_id, competitor_channel_id, video_id, field, value, value_hash, first_seen_at, last_seen_at, precision, is_current)
select c.site_id, c.id, v.id, f, to_jsonb(repeat('x', 300)), md5(v.id::text || f), now() - interval '30 days', now(), 'first', true
  from public.competitor_videos v join public.competitor_channels c on c.id = v.competitor_channel_id
 cross join unnest(array['title','description','tags','duration','category','lang']) f
 where c.channel_id like 'UCcp29_%';
commit;
analyze;
```

  Antes de rodar, ler os `check` das 8 tabelas (`\d+` de cada uma) e ajustar os valores literais (`precision`, `field`,
  `tier`) aos aceitos; a contagem final por tabela vai para `resultado.md`.
- [ ] **Passo 2. Lote sem gatilho.** `lote-sem.sql` é o script do `pgbench`: um `insert` de 50 linhas em
  `competitor_field_versions` com `is_current = false` (a chave única só vale para a corrente) e `value_hash` aleatório, para 50 vídeos sorteados (ids lidos de uma tabela temporária pré-sorteada, não por `order by random()` dentro da transação medida)
  entre os 2.000 (`\set c random(1, 20)`). Carga concorrente: `pgbench -n -c 4 -j 4 -T 60 -f lote-sem.sql -r` (4 clientes,
  60 s; `-r` dá a latência por comando). Anotar média, p95 (`--log` e `sort` da coluna de latência) e transações por segundo. Rodar o passo 2 duas vezes, intercaladas com o passo 3 (sem, com, sem): a diferença entre as duas rodadas sem gatilho é o piso de ruído (Phil I-9).
- [ ] **Passo 3. Lote com gatilho.** Aplicar `guarda.sql` (a função `obs_video_antigo_guarda_insert` e o gatilho da
  Tarefa 4, só nas 8 tabelas, idêntico ao texto da migration) e rodar o mesmo `pgbench`. Depois, congelar 40 vídeos de um
  canal (`update … set archive_frozen_at = now()`: as colunas da Tarefa 3 aplicadas antes, pelo mesmo rascunho) e rodar de
  novo com o sorteio só entre os ativos. Anotar as três rodadas lado a lado.
- [ ] **Passo 4. Retirada cheia** (`retirada.sql`): numa transação, no canal cheio (os 100 a retirar semeados **já congelados**: `update … set archive_frozen_at = now()` antes de instalar a guarda, senão o `update … set archive_dropped_at` abaixo recusa com `retirada_sem_congelamento` pelo gatilho da Tarefa 3), `count(*)` das 8 tabelas para os 100
  vídeos a retirar e para os 200 demais; `delete` das linhas dos 100 nas 8 tabelas, na ordem `competitor_changes`,
  `competitor_readings`, `competitor_video_comment_snaps`, `competitor_hour_fold_log`, `competitor_video_tier_spans`,
  `competitor_raw`, `competitor_field_versions`, `competitor_video_versions`; `count(*)` de novo; `update competitor_videos
  set archive_dropped_at = now()` nos 100; `rollback`. Medir com `\timing on` e `explain (analyze, buffers)` de cada
  `delete`. Repetir 5 vezes e anotar o maior.
- [ ] **Passo 5. Decidir e anotar** em `resultado.md`:
  (a) custo do gatilho por linha = (mediana do lote com gatilho − mediana sem gatilho) / 50, e o mesmo com p95; o **piso de
  ruído** é a diferença entre duas rodadas sem gatilho. Limiar (Phil, 14/10, pela conta do parecer): segue se o incremento
  p95 por linha, **multiplicado pelo fator de máquina de (b)**, ficar abaixo de **0,2 ms** E o custo diário projetado
  (linhas inseridas por dia nas 8 tabelas × incremento × fator) ficar abaixo de **10 s**. As linhas por dia são lidas em
  produção pelo dono, só leitura: `select relname, n_tup_ins from pg_stat_user_tables where relname in (<as 8>)` em dois
  dias seguidos, a diferença é o número. Acima de qualquer um dos dois: para e leva ao Phil e ao Yannis. Se o incremento
  ficar abaixo do piso de ruído, anotar "indistinguível do ruído (< X ms por lote)" e seguir.
  (b) Retirada. **Fator de máquina:** o dono roda em produção, 3 vezes, a leitura só de CPU
  `explain (analyze, timing off) select count(*) from (select md5(g::text) from generate_series(1, 2000000) g order by 1) s`
  (`npx supabase db query --linked`, só leitura, sem tabela); o agente roda a mesma no `bythiago_int`. `fator =
  mediana(prod) / mediana(local)`, no mínimo 1. **O teto nasce 100 se `maior dos 5 × fator < 4 s`**; senão, o maior valor
  em {75, 50, 25} cuja medida (repetida com esse número de vídeos) vezes o fator fique abaixo de 4 s, e a Tarefa 3 grava
  esse valor como padrão de `teto_unidade`.
  (c) A contagem dos 200 demais é a mesma antes e depois (prova da condição e, P39).
- [ ] **Passo 6.** Limpar o site de medida (`delete from sites where slug = 'cp29-medida'`, a cascata leva o resto) e
  **sem commit**: `cp29/` e `cp29/resultado.md` ficam só no disco (`.superpowers/` é ignorado pelo git; Yannis R2 C-1).

---

## Tarefa 2. O rascunho do SQL nasce (fora de `supabase/migrations/`) e o teste de forma

**Arquivos:** criar `supabase/rascunhos/m10a.sql`; criar `apps/web/test/integration/video-antigo-m10a-caminho.ts`
(exporta `M10A_SQL = path.resolve(__dirname, '../../../../supabase/rascunhos/m10a.sql')`, relativo ao arquivo e nunca ao `cwd`, que muda entre `npm test -w` e `npx vitest` da raiz; `M10A_EM_MIGRATION = false`; e `async function m10aNoBanco(): Promise<boolean>`, que consulta `information_schema.columns` por `competitor_videos.archive_frozen_at`; **o único lugar** que a Tarefa 5b muda: `M10A_SQL` e `M10A_EM_MIGRATION = true`); criar
`apps/web/test/integration/video-antigo-m10a-migration.test.ts`.

**TRAVA M10a-1:** nenhum arquivo desta etapa em `supabase/migrations/` até a Tarefa 5b. `npm run db:new` **não** roda aqui.

- [ ] **Passo 1.** Criar o rascunho `m10a.sql` com o cabeçalho abaixo e `M10A_SQL` apontando para ele. Conferir que `supabase/migrations/` não tem arquivo desta etapa (`ls supabase/migrations | grep m10a` vazio).
- [ ] **Passo 2.** Cabeçalho do arquivo:

```sql
-- M10a (fase de manutenção, emenda de 14/10): o vídeo antigo, o que não depende de ninguém.
-- Spec: docs/superpowers/specs/2026-10-13-fase-manutencao-nas/02 §10.8; 05 §15.1 (M10a) e §17 (pedido 15); 06 §18, itens 135, 138 e 139.
-- Com ZERO vídeo marcado nada disto muda dado nem saída, salvo chaves novas que valem 0:
--   competitor_series_health.arquivados; competitor_channel_removal_impact.videos_leitura_mensal e .videos_no_arquivo;
--   apply_competitor_tier_plan.ignorados_congelados.
-- Ordem dura (02 §10.8, passos 1 e 2): esta migration ANTES do código que lê as colunas.
-- Depende só de ordem da M2 (arquivo posterior e push separado, depois da M2 conferida); não usa objeto dela.
-- Idempotente: add column/create table/create index if not exists, create or replace function, drop trigger if exists.
set lock_timeout = '3s';
```

- [ ] **Passo 3. Teste de forma, falhando** (`video-antigo-m10a-migration.test.ts`, `// @vitest-environment node`,
  `describe.skipIf(skipIfNoLocalDb())`, cliente `pg` em `SUPABASE_DB_URL`): lê `M10A_SQL`, afirma que o texto contém
  `set lock_timeout`, e que `supabase/migrations` (resolvido por `__dirname`, como `M10A_SQL`; Yannis R2 C-4) **não** tem arquivo `*_observatorio_m10a_*` enquanto `M10A_SQL` aponta para o rascunho (a TRAVA M10a-1 como teste).
- [ ] **Passo 3b (Yannis R2 C-3).** Os três arquivos de integração das Tarefas 3 a 5 (`video-antigo-m10a-migration`, `video-antigo-guarda-insert`, `video-antigo-funcoes`) abrem com `const pular = skipIfNoLocalDb() || (!M10A_EM_MIGRATION && !(await m10aNoBanco()))` (top-level await) e `describe.skipIf(pular)('... (pula até a Tarefa 5b se o rascunho não foi aplicado)', ...)`. Depois da 5b a condição volta a ser só a do banco: migration ausente com `M10A_EM_MIGRATION = true` **falha**, não pula (sem verde falso). Motivo: a CI (`ci.yml:149`) roda a integração só com `supabase/migrations/`; sem isto ela ficaria vermelha da Tarefa 2 até a 5b. Dívida declarada: entre as Tarefas 3 e 5b o SQL só é provado no banco local de quem o escreve; gatilho de pagamento: Tarefa 5b. Prova da troca: com o rascunho não aplicado, `npx vitest run apps/web/test/integration/video-antigo-*` mostra os `describe` pulados e zero falhas; com `M10A_EM_MIGRATION = true` e sem a migration, os mesmos falham.
- [ ] **Passo 4.** `npx vitest run apps/web/test/integration/video-antigo-m10a-migration.test.ts` com banco local: passa.
- [ ] **Passo 5.** Commit no `staging`: `git commit -m "feat: rascunho do SQL da M10a e teste de forma, fora de supabase/migrations (M10a, Tarefa 2)" -- supabase/rascunhos/m10a.sql apps/web/test/integration/video-antigo-m10a-caminho.ts apps/web/test/integration/video-antigo-m10a-migration.test.ts`.

---

## Tarefa 3. As colunas do toco, o gatilho de imutabilidade e a política

**Arquivos:** editar o rascunho `M10A_SQL`; editar `video-antigo-m10a-migration.test.ts`.

**Interfaces que a M10b e a M3b usam:**
- `competitor_videos.archive_frozen_at timestamptz null`, `archive_dropped_at timestamptz null`,
  `archive_view_count bigint null`, `archive_like_count bigint null`, `archive_comment_count bigint null`,
  `archive_stats_at timestamptz null`.
- `public.obs_archive_video_policy(site_id uuid pk, h_meses int, released bool, teto_unidade int, teto_auto_minimo int, teto_auto_fracao numeric)`.
- Recusas do gatilho (texto da exceção, `errcode P0001`): `ja_no_arquivo`, `archive_frozen_imutavel`,
  `retirada_sem_congelamento`, `contagens_do_arquivo_imutaveis`, `descongelar_sem_limpar`.

**O que acontece quando o dado não existe:** site sem linha na política (site criado depois desta migration) não tem H nem
`released`; quem lê (M10b, M3b) trata a ausência como **classe fechada e nada elegível** (`politica_ausente`), nunca como
24 por omissão. Esta tarefa grava a linha de todo site existente e um teste afirma que todo site tem linha.

- [ ] **Passo 1. Testes, falhando** (no mesmo arquivo de teste):
  1. as seis colunas existem, anuláveis, sem padrão; toda linha existente tem as seis nulas;
  2. `update … set archive_frozen_at = now()` passa; trocar por outra data recusa `archive_frozen_imutavel`; voltar a nulo
     com as quatro contagens ainda preenchidas recusa `descongelar_sem_limpar`; voltar a nulo limpando as quatro passa;
     mudar `archive_view_count` sem mudar `archive_frozen_at` recusa `contagens_do_arquivo_imutaveis`; gravar
     `archive_dropped_at` com `archive_frozen_at` nulo recusa `retirada_sem_congelamento`; com `archive_dropped_at`
     preenchido, qualquer mudança nas seis recusa `ja_no_arquivo`;
  3. um `update` que não cita as seis colunas (o da sincronização: `last_seen_at`, `view_count`) não dispara o gatilho
     (`pg_stat_user_functions.calls` da função não muda; `track_functions = 'all'` na sessão);
  4. `obs_archive_video_policy`: todo site tem linha; `h_meses = 24`, `released = false`, `teto_unidade` = valor da CP29;
     `update … set h_meses = 11` como `postgres` recusa com `23514`; com `set local role service_role`, `update`, `insert`
     e `delete` recusam com `42501`; `has_table_privilege('service_role', 'public.obs_archive_video_policy', 'select')` é
     verdadeiro; `has_table_privilege('authenticated', …, 'select')` e o de `anon` são falsos;
  5. subir H (`update … set h_meses = 36` como `postgres`, numa transação desfeita) não muda nenhuma linha de
     `competitor_videos` (contagem de `archive_frozen_at is not null` igual antes e depois).
- [ ] **Passo 2. SQL** (anexar ao rascunho):

```sql
-- 1. O toco (02 §10.8, "O toco e os três estados"). Contagem nula fica nula ("não medido"), nunca zero.
alter table public.competitor_videos
  add column if not exists archive_frozen_at timestamptz,
  add column if not exists archive_dropped_at timestamptz,
  add column if not exists archive_view_count bigint,
  add column if not exists archive_like_count bigint,
  add column if not exists archive_comment_count bigint,
  add column if not exists archive_stats_at timestamptz;
comment on column public.competitor_videos.archive_frozen_at is 'M10a: quando o vídeo passou à leitura mensal (estágio 1). Só volta a nulo (descongelar) antes da retirada. Nulo = ativo.';
comment on column public.competitor_videos.archive_dropped_at is 'M10a: quando as linhas do vídeo nas 8 tabelas da classe video_antigo saíram do online (estágio 2). Nulo = ainda online.';
comment on column public.competitor_videos.archive_stats_at is 'M10a: a last_checked_at do instante do congelamento: a data das três contagens "na passagem à leitura mensal".';

create or replace function public.competitor_videos_archive_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.archive_dropped_at is not null then
    if (new.archive_frozen_at, new.archive_dropped_at, new.archive_view_count, new.archive_like_count, new.archive_comment_count, new.archive_stats_at)
       is distinct from
       (old.archive_frozen_at, old.archive_dropped_at, old.archive_view_count, old.archive_like_count, old.archive_comment_count, old.archive_stats_at) then
      raise exception 'ja_no_arquivo' using errcode = 'P0001', detail = old.id::text;
    end if;
    return new;
  end if;
  if new.archive_dropped_at is not null and new.archive_frozen_at is null then
    raise exception 'retirada_sem_congelamento' using errcode = 'P0001', detail = old.id::text;
  end if;
  if old.archive_frozen_at is not null and new.archive_frozen_at is not null
     and new.archive_frozen_at <> old.archive_frozen_at then
    raise exception 'archive_frozen_imutavel' using errcode = 'P0001', detail = old.id::text;
  end if;
  if new.archive_frozen_at is not distinct from old.archive_frozen_at
     and (new.archive_view_count, new.archive_like_count, new.archive_comment_count, new.archive_stats_at)
         is distinct from (old.archive_view_count, old.archive_like_count, old.archive_comment_count, old.archive_stats_at) then
    raise exception 'contagens_do_arquivo_imutaveis' using errcode = 'P0001', detail = old.id::text;
  end if;
  if old.archive_frozen_at is not null and new.archive_frozen_at is null
     and (new.archive_view_count is not null or new.archive_like_count is not null
          or new.archive_comment_count is not null or new.archive_stats_at is not null) then
    raise exception 'descongelar_sem_limpar' using errcode = 'P0001', detail = old.id::text;
  end if;
  return new;
end $$;
revoke all on function public.competitor_videos_archive_guard() from public, anon, authenticated, service_role;
drop trigger if exists competitor_videos_archive_guard on public.competitor_videos;
create trigger competitor_videos_archive_guard
  before update of archive_frozen_at, archive_dropped_at, archive_view_count, archive_like_count, archive_comment_count, archive_stats_at
  on public.competitor_videos for each row execute function public.competitor_videos_archive_guard();

-- 2. A política (02 §10.8, "A política"). Muda só por migration: nenhuma ação de servidor troca H nem libera a classe.
create table if not exists public.obs_archive_video_policy (
  site_id uuid primary key references public.sites(id) on delete cascade,
  h_meses integer not null default 24 check (h_meses >= 12),
  released boolean not null default false,
  teto_unidade integer not null default 100 check (teto_unidade between 1 and 100),
  teto_auto_minimo integer not null default 25 check (teto_auto_minimo >= 0),
  teto_auto_fracao numeric(4,3) not null default 0.050 check (teto_auto_fracao >= 0 and teto_auto_fracao <= 1),
  updated_at timestamptz not null default now()
);
comment on table public.obs_archive_video_policy is 'M10a: a saída por idade do vídeo (classe video_antigo), uma linha por site. H em meses (D15: 24). released = a classe liberada (só por migration, no release das telas da peça 8). Site sem linha = classe fechada e nada elegível (politica_ausente), nunca 24 por omissão. Toda migration que alterar uma linha grava updated_at = now() no mesmo update.';
insert into public.obs_archive_video_policy (site_id) select s.id from public.sites s on conflict (site_id) do nothing;
alter table public.obs_archive_video_policy enable row level security;
revoke all on table public.obs_archive_video_policy from public, anon, authenticated, service_role;
grant select on table public.obs_archive_video_policy to service_role;
```

  Se a CP29 baixou o teto, trocar `default 100` pelo número dela **e** acrescentar
  `update public.obs_archive_video_policy set teto_unidade = <n> where teto_unidade = 100;` logo depois do `insert`.
- [ ] **Passo 3.** Aplicar o rascunho nos dois bancos locais (`psql -v ON_ERROR_STOP=1 -f`), rodar o teste:
  passa. Aplicar de novo: passa (idempotência).
- [ ] **Passo 4.** Commit: `git commit -m "feat: colunas do toco, gatilho de imutabilidade e política do vídeo antigo com H = 24 e a classe fechada (M10a, Tarefa 3)" -- <rascunho M10A_SQL> <teste>`.

---

## Tarefa 4. A guarda de `insert` nas 8 tabelas e o índice de `competitor_readings`

**Arquivos:** editar o rascunho `M10A_SQL`; criar `apps/web/test/integration/video-antigo-guarda-insert.test.ts`.

**Contrato (02 §10.8, "A guarda no banco"):** `before insert`, por linha, nas 8 tabelas da classe; linha com `video_id`
nulo passa sem consulta; vídeo com `archive_frozen_at` preenchido recusa com a exceção `video_congelado` (`P0001`, `detail` =
id do vídeo, `hint` = tabela). É a **segunda** linha de defesa: quem impede a escrita é o predicado (Tarefas 7 a 10).

**Escolha deste plano: a função da guarda é `security definer`** (dono `postgres`, `search_path` vazio). Com
`security invoker`, um papel que gravasse sem poder ler `competitor_videos` veria "nenhuma linha" e a guarda passaria em
silêncio: falharia em verde. Não confundir com o item 143, que pede `security invoker` para **outro** gatilho (o de
`obs_archive_units`, da M3b). O `revoke` de `execute` não impede o disparo do gatilho.

**O que acontece quando o dado não existe:** `video_id` que não existe em `competitor_videos` passa a guarda e é recusado
pela chave estrangeira, como hoje. Tabela nova com chave para `competitor_videos` criada depois: não tem gatilho; quem pega é o teste de catálogo e o teste das listas (Tarefa 11).

- [ ] **Passo 1. Testes, falhando** (`pg`, banco local; um canal com 2 vídeos, um congelado por `update` direto):
  1. para cada uma das 8 tabelas, `insert` de linha mínima válida do vídeo congelado recusa com `video_congelado` e
     `hint` = nome da tabela; a mesma linha do vídeo ativo passa (e é desfeita);
  2. os mesmos inserts com `set local role service_role` recusam igual;
  3. `competitor_field_versions`, `competitor_raw` e `competitor_readings` com `video_id` nulo passam;
  4. **catálogo:** `select c.relname from pg_trigger t join pg_class c on c.oid = t.tgrelid where t.tgname = 'obs_video_antigo_guarda' and not t.tgisinternal`
     é exatamente o conjunto das 8; e `pg_proc.prosecdef` da função é verdadeiro;
  5. **regressão documentada (custo da volta atrás, item 138):** `insert` de 50 linhas em `competitor_field_versions` num
     só comando, com 1 vídeo congelado e 49 ativos, recusa inteiro e nenhuma das 49 fica gravada;
  6. `upsert` com `on conflict do nothing` de linha de vídeo congelado também recusa (o `before insert` dispara antes do
     conflito);
  7. o índice `idx_competitor_readings_video` existe e é parcial (`pg_indexes.indexdef` contém `WHERE (video_id IS NOT NULL)`).
- [ ] **Passo 2. SQL** (anexar):

```sql
-- 3. A guarda de insert nas 8 tabelas da classe video_antigo (02 §10.8). Segunda linha: o predicado do código é a primeira.
create or replace function public.obs_video_antigo_guarda_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.video_id is null then
    return new;
  end if;
  perform 1 from public.competitor_videos v where v.id = new.video_id and v.archive_frozen_at is not null;
  if found then
    raise exception 'video_congelado' using errcode = 'P0001', detail = new.video_id::text, hint = tg_table_name;
  end if;
  return new;
end $$;
revoke all on function public.obs_video_antigo_guarda_insert() from public, anon, authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array['competitor_video_versions', 'competitor_field_versions', 'competitor_raw',
                           'competitor_video_tier_spans', 'competitor_video_comment_snaps', 'competitor_hour_fold_log',
                           'competitor_changes', 'competitor_readings']
  loop
    execute format('drop trigger if exists obs_video_antigo_guarda on public.%I', t);
    execute format('create trigger obs_video_antigo_guarda before insert on public.%I for each row execute function public.obs_video_antigo_guarda_insert()', t);
  end loop;
end $$;

-- 4. P36: a retirada e a remoção buscam leituras da forja por vídeo.
create index if not exists idx_competitor_readings_video on public.competitor_readings (video_id) where video_id is not null;
```

- [ ] **Passo 3.** Aplicar o rascunho, rodar o teste: passa. Rodar o teste da Tarefa 3 de novo: passa.
- [ ] **Passo 4.** Anotar no `resultado.md` da CP29 que o texto da guarda medido é o mesmo da migration (`diff` entre
  `guarda.sql` e o trecho).
- [ ] **Passo 5.** Commit: `git commit -m "feat: guarda de insert do vídeo congelado nas 8 tabelas da classe video_antigo (M10a, Tarefa 4)" -- <rascunho M10A_SQL> <teste>`.

---

## Tarefa 5. As quatro funções SQL dos pontos 4, 5, 7 e 8

**Arquivos:** editar o rascunho `M10A_SQL`; criar `apps/web/test/integration/video-antigo-funcoes.test.ts`; a edição de
`apps/web/test/integration/competitor-pin-schema.test.ts:56` (acrescentar `videos_leitura_mensal` e `videos_no_arquivo`, valendo 0; Yannis Y2) **não** entra aqui: vai no commit da Tarefa 5b, passo 2 (na CI o banco só tem `migrations/`; Yannis R2 C-3).

**O que acontece quando o dado não existe:** com zero vídeo marcado, as quatro funções devolvem exatamente o que devolviam,
mais as chaves novas valendo 0 (contagem sobre linhas reais: 0 medido, não "não medido"). Canal ou site ausente: as
respostas de hoje (`not_found`, exceção do canal de outro site) não mudam.

- [ ] **Passo 1. Testes, falhando.** O teste compara **com o texto antigo**, não com uma cópia escrita à mão: lê o arquivo
  da migration anterior, extrai com expressão regular o bloco `create or replace function public.<nome>(…) … $$;`, troca
  `public.<nome>` por `pg_temp.<nome>_antes` e cria a função temporária na sessão (`pg_temp` aceita função; chamada sempre
  qualificada). Arquivos de origem: `competitor_series_health` de `20261012000004_…:85-163`;
  `competitor_channel_removal_impact` de `20261013000002_…:274-305`; `apply_competitor_tier_plan` de
  `20261012000003_…:66-111`; `pin_competitor_video` de `20261007000002_…:25-70`. Casos:
  1. **zero marcado** (o banco semeado pelo helper da E2 que os testes `observatorio-a5-e1-e2-*` já usam): `new - 'arquivados'`
     é igual a `pg_temp.competitor_series_health_antes` byte a byte (`::text`), e `arquivados = 0`; o mesmo para
     `competitor_channel_removal_impact` sem as duas chaves novas, que valem 0; e o mesmo para `apply_competitor_tier_plan` sem `ignorados_congelados`, que vale 0 (M-2);
  2. **V5:** canal com 3 vídeos semanais atrasados ativos e 2 congelados: `semanal_atrasados = 3`, `arquivados = 2`, e
     `fora_da_prova` não conta os congelados;
  3. **ponto 4:** `apply_competitor_tier_plan` com um plano que pede `semanal` para 1 ativo e 1 congelado: o ativo troca de
     faixa e ganha linha em `competitor_video_tier_spans`; o congelado não muda (`series_tier`, spans) e a chamada **não**
     cai na guarda (nenhuma exceção); a resposta traz `ignorados_congelados = 1`;
  4. **ponto 8 / V12 na parte desta etapa:** canal com 5 vídeos, 2 congelados e 1 congelado e retirado (colunas postas por
     `update`): `videos = 5` (o toco conta: a contagem não cai), `videos_leitura_mensal = 2`, `videos_no_arquivo = 1`;
  5. **ponto 7:** `pin_competitor_video` em vídeo congelado sem `p_pode_descongelar` devolve `{"status":"precisa_admin"}`
     e nada muda; com `true` devolve `ok` com `descongelado: true`, o vídeo fica fixado e as cinco colunas
     (`archive_frozen_at` e as quatro contagens), mais `series_tier` e `series_tier_since`, ficam nulas (Phil I-3); em vídeo com `archive_dropped_at` devolve
     `{"status":"ja_no_arquivo"}` e nada muda; em vídeo ativo devolve exatamente o mesmo que `pg_temp.pin_competitor_video_antes`
     (sem exceção de chave: `descongelado` só existe na resposta quando descongela; Yannis Y2); a chamada com **só os quatro argumentos nomeados** de hoje funciona
     (é o código antigo entre a migration e o deploy); `select count(*) from pg_proc where proname = 'pin_competitor_video'` é 1;
  6. **descongelar reabre a faixa (Phil I-3):** simular o congelamento da M10b (`update` que fecha o span aberto com `to_date = hoje - 1` e grava `archive_frozen_at`), fixar com `p_pode_descongelar`, rodar `apply_competitor_tier_plan` com a faixa que o classificador daria: exatamente um span aberto, e `competitor_series_health.sem_faixa` volta ao valor de antes do congelamento.
- [ ] **Passo 2. SQL** (anexar):

```sql
-- 5. Ponto 4 (fechamento da faixa): vídeo congelado nunca troca de faixa (o congelamento só fecha a aberta, na M10b).
--    Cópia literal de 20261012000003_observatorio_a5_e2_serie_faixas.sql:66-111, com DUAS mudanças: o retorno ganha `ignorados_congelados` (os congelados do plano, que não são tocados: a defesa não fica calada; M-2) e o "where" do laço
--    ganha "and v.archive_frozen_at is null". O resto (trava, reabertura da semanal, retorno) é idêntico.
create or replace function public.apply_competitor_tier_plan(
  p_site_id uuid, p_channel_id uuid, p_changes jsonb, p_today date
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  r record;
  v_changed integer := 0;
  v_reopen boolean := false;
begin
  if not exists (select 1 from public.competitor_channels c where c.id = p_channel_id and c.site_id = p_site_id) then
    raise exception 'apply_competitor_tier_plan: canal % não é do site %', p_channel_id, p_site_id;
  end if;
  for r in
    select x.video_id, x.tier
      from jsonb_to_recordset(coalesce(p_changes, '[]'::jsonb)) as x(video_id uuid, tier text)
      join public.competitor_videos v on v.id = x.video_id and v.competitor_channel_id = p_channel_id
     where v.series_tier is distinct from x.tier
       and v.archive_frozen_at is null
     order by x.video_id
  loop
    update public.competitor_video_tier_spans s
       set tier = r.tier
     where s.video_id = r.video_id and s.from_date = p_today and s.to_date is null;
    if not found then
      update public.competitor_video_tier_spans s
         set to_date = p_today - 1
       where s.video_id = r.video_id and s.to_date is null and s.from_date < p_today;
      insert into public.competitor_video_tier_spans (video_id, from_date, to_date, tier, site_id)
      values (r.video_id, p_today, null, r.tier, p_site_id);
    end if;
    update public.competitor_videos
       set series_tier = r.tier, series_tier_since = p_today
     where id = r.video_id;
    v_changed := v_changed + 1;
    if r.tier = 'semanal' then v_reopen := true; end if;
  end loop;
  if v_reopen then
    update public.competitor_channels set weekly_pass_date = null where id = p_channel_id and weekly_pass_date is not null;
  end if;
  return jsonb_build_object('changed', v_changed, 'ignorados_congelados', (select count(*) from jsonb_to_recordset(coalesce(p_changes, '[]'::jsonb)) as x(video_id uuid, tier text) join public.competitor_videos v on v.id = x.video_id and v.competitor_channel_id = p_channel_id where v.archive_frozen_at is not null));
end $$;
revoke all on function public.apply_competitor_tier_plan(uuid, uuid, jsonb, date) from public, anon, authenticated;
grant execute on function public.apply_competitor_tier_plan(uuid, uuid, jsonb, date) to service_role;
```

  **Ponto 5 (`competitor_series_health`):** cópia literal do bloco de `20261012000004_…:85-163` com **três** mudanças, e
  nenhuma outra: (a) a CTE `vid` passa a se chamar `vid_todos` e ganha, depois de `canal_em_dia`, a coluna
  `(v.archive_frozen_at is not null) as congelado`; (b) logo depois dela, a CTE nova
  `vid as (select * from vid_todos where not congelado)` (assim toda conta de hoje, que lê `vid`, deixa o congelado de fora
  sem tocar no texto dela); (c) no `jsonb_build_object`, logo depois de `'fora_canal_em_erro_3d'`, a chave
  `'arquivados', (select count(*) from vid_todos where congelado),` com o comentário
  `-- M10a: vídeos em leitura mensal ou no arquivo. Fora de todas as contas acima; nunca alarme, nunca sumiço calado.`
  Depois do bloco, o `revoke`/`grant` de hoje (`20261012000004_…:165-167`).

  **Ponto 8 (`competitor_channel_removal_impact`):** cópia literal de `20261013000002_…:274-305` com duas chaves a mais,
  logo depois de `'pinned'`:

```sql
    'videos_leitura_mensal', (select count(*) from public.competitor_videos v
                              where v.competitor_channel_id = p_channel_id and v.archive_frozen_at is not null and v.archive_dropped_at is null),
    'videos_no_arquivo', (select count(*) from public.competitor_videos v
                          where v.competitor_channel_id = p_channel_id and v.archive_dropped_at is not null),
```

  e o `revoke`/`grant` de `:307-308`. (`videos` continua contando todo vídeo do canal, tocos inclusive: é o que mantém a
  contagem do diálogo sem cair depois da retirada. As contagens de versões e demais linhas depois da retirada, que caem
  online, ganham a parcela "no arquivo" do registro na M10c.)

  **Ponto 7 (`pin_competitor_video`):**

```sql
-- 6. Ponto 7 (fixar). Assinatura nova com o 5º argumento com padrão: o código antigo (4 argumentos nomeados) segue
--    funcionando entre esta migration e o deploy. A antiga sai antes, ou a chamada de 4 argumentos ficaria ambígua.
drop function if exists public.pin_competitor_video(uuid, uuid, uuid, integer);
create or replace function public.pin_competitor_video(
  p_site_id uuid, p_video_id uuid, p_user_id uuid, p_limit integer, p_pode_descongelar boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_channel uuid;
  v_name text;
  v_pinned_at timestamptz;
  v_frozen timestamptz;
  v_dropped timestamptz;
  v_count integer;
begin
  if p_limit is null or p_limit < 0 then
    raise exception 'pin_competitor_video: p_limit inválido';
  end if;
  select v.competitor_channel_id into v_channel from public.competitor_videos v where v.id = p_video_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  select c.channel_name into v_name from public.competitor_channels c
   where c.id = v_channel and c.site_id = p_site_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  select v.pinned_at, v.archive_frozen_at, v.archive_dropped_at into v_pinned_at, v_frozen, v_dropped
    from public.competitor_videos v
   where v.id = p_video_id and v.competitor_channel_id = v_channel for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  -- no arquivo: não há descongelar (02 §10.8, "Desfazer")
  if v_dropped is not null then
    return jsonb_build_object('status', 'ja_no_arquivo');
  end if;
  if v_pinned_at is not null then
    return jsonb_build_object('status', 'ok', 'already', true);
  end if;
  -- em leitura mensal: fixar descongela, e só quem administra o site (a ação diz quem é, depois do guard)
  if v_frozen is not null and not coalesce(p_pode_descongelar, false) then
    return jsonb_build_object('status', 'precisa_admin');
  end if;
  select count(*) into v_count from public.competitor_videos v
   where v.competitor_channel_id = v_channel and v.pinned_at is not null;
  if v_count >= p_limit then
    return jsonb_build_object('status', 'cap', 'name', v_name, 'pinned', v_count);
  end if;
  if v_frozen is not null then
    -- descongelar devolve o vídeo ao classificador sem faixa: a próxima passada abre um span novo a partir de hoje (o congelamento fechou o antigo). Sem isso, sem_faixa eterno.
    update public.competitor_videos
       set pinned_at = now(), pinned_by = p_user_id, archive_frozen_at = null, series_tier = null, series_tier_since = null,
           archive_view_count = null, archive_like_count = null, archive_comment_count = null, archive_stats_at = null
     where id = p_video_id;
  else
    update public.competitor_videos set pinned_at = now(), pinned_by = p_user_id where id = p_video_id;
  end if;
  return jsonb_build_object('status', 'ok', 'already', false) || case when v_frozen is not null then jsonb_build_object('descongelado', true) else '{}'::jsonb end;
end $$;
revoke all on function public.pin_competitor_video(uuid, uuid, uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.pin_competitor_video(uuid, uuid, uuid, integer, boolean) to service_role;
comment on function public.pin_competitor_video(uuid, uuid, uuid, integer, boolean) is 'Fixa um vídeo de concorrente travando a linha do canal. M10a: vídeo em leitura mensal só é fixado (e descongelado) com p_pode_descongelar; vídeo no arquivo recusa ja_no_arquivo. Devolve ok / cap / not_found / precisa_admin / ja_no_arquivo.';

notify pgrst, 'reload schema';
reset lock_timeout;
```

- [ ] **Passo 3.** Aplicar o rascunho e rodar os testes desta etapa (os três arquivos de integração e, só localmente, a versão editada de `competitor-pin-schema.test.ts`, que chama `sb.rpc('pin_competitor_video', {4 chaves})` pela API local 54421: é a prova de que a chamada **pelo PostgREST** com 4 argumentos resolve para a função nova depois do `notify pgrst`). Antes, `grep -rn "apply_competitor_tier_plan\|pin_competitor_video\|competitor_channel_removal_impact" apps/web/test` para achar toda asserção exata sobre a resposta (Y2, M-2): passam. A suíte de integração só roda local (a CI não tem banco); declarar isso no ledger.
- [ ] **Passo 4.** Commit: `git commit -m "feat: faixa, prova da série, fixar e contagens de remoção respeitam o vídeo congelado no banco (M10a, Tarefa 5)" -- <rascunho M10A_SQL> <teste>`.

---

## Tarefa 5b. A vez da migration (arquivo, push e prova em produção)

**Arquivos:** criar `supabase/migrations/<ts>_observatorio_m10a_video_antigo_base.sql` (`db:new`); apagar o rascunho
`m10a.sql`; editar `video-antigo-m10a-caminho.ts`, `video-antigo-m10a-migration.test.ts` e `competitor-pin-schema.test.ts:56`; criar
`.superpowers/sdd/manutencao-nas/m10a/{prova-zero.sh,desligar-guarda.sql}` (só disco); editar o ledger (só disco).

**O que acontece quando o dado não existe:** se a M2 não estiver aplicada e conferida no ledger, nada desta tarefa começa e o
arquivo não é criado (TRAVA M10a-1). Se a leitura "antes" não tiver saído (arquivo vazio em `saidas/`), a prova não existe e o
push espera: a prova sem o "antes" não prova nada. Enquanto esta tarefa não fechar, a TRAVA M10a-2 segura as Tarefas 6 a 12.

- [ ] **Passo 1 (Phil e Yannis, controlador).** Revisão do **SQL** (rascunho e testes das Tarefas 1 a 5); conserta-se até acordo.
  Conferir no ledger que a M2 está aplicada e conferida. Custo declarado: duas revisões (SQL antes do push, código depois); um
  defeito do SQL achado na revisão do código vira migration corretiva para a frente (com zero marcado, barata).
- [ ] **Passo 2 (agente).** `git fetch origin staging`; `npm run db:new observatorio_m10a_video_antigo_base`; copiar o rascunho
  para o arquivo novo; `M10A_SQL` passa a apontar para ele; `M10A_EM_MIGRATION` passa a `true`; **`git rm supabase/rascunhos/m10a.sql` no mesmo commit** (rastreado, o pathspec passa a valer como deletado); a edição de `competitor-pin-schema.test.ts:56` entra aqui; o teste de forma troca a
  asserção da TRAVA M10a-1 por "o nome do arquivo é maior que o de todo arquivo da M2" (o padrão do nome vem do plano da M2; se
  não houver arquivo da M2 aplicado, o teste **falha** com "a M2 ainda não está aplicada": é a dependência 1). Aplicar o arquivo
  nos dois bancos locais e registrar a versão em `supabase_migrations.schema_migrations`; rodar os testes das Tarefas 2 a 5:
  passam. Commit: `git commit -m "feat: migration da M10a, depois da M2 (M10a, Tarefa 5b)" -- supabase/migrations/<ts>_observatorio_m10a_video_antigo_base.sql apps/web/test/integration/video-antigo-m10a-caminho.ts apps/web/test/integration/video-antigo-m10a-migration.test.ts apps/web/test/integration/competitor-pin-schema.test.ts supabase/rascunhos/m10a.sql`.
- [ ] **Passo 3 (agente).** Criar os dois arquivos de comandos do dono, **só no disco** (`.superpowers/` é ignorado; não há commit).

`desligar-guarda.sql` (**comandos que o DONO roda** no SQL do painel do Supabase, exceção do `05` §16; **o agente nunca o
aplica**; oito `drop trigger` e nada mais, além do `set lock_timeout`: as colunas, a política e as funções ficam, porque com zero marcado não fazem nada).
Religar = rodar de novo o bloco `do $$ … $$` da migration:

```sql
set lock_timeout = '5s';   -- se falhar por trava, rode de novo
drop trigger if exists obs_video_antigo_guarda on public.competitor_video_versions;
drop trigger if exists obs_video_antigo_guarda on public.competitor_field_versions;
drop trigger if exists obs_video_antigo_guarda on public.competitor_raw;
drop trigger if exists obs_video_antigo_guarda on public.competitor_video_tier_spans;
drop trigger if exists obs_video_antigo_guarda on public.competitor_video_comment_snaps;
drop trigger if exists obs_video_antigo_guarda on public.competitor_hour_fold_log;
drop trigger if exists obs_video_antigo_guarda on public.competitor_changes;
drop trigger if exists obs_video_antigo_guarda on public.competitor_readings;
```

`prova-zero.sh` (o dono roda; só `select`; um comando por linha; recebe o momento e o **instante de referência `ref`** como
argumentos, e grava em `saidas/m10a-prova-<momento>.txt`; **sem `limit`**, porque truncar faz o "igual" passar em verde; o
tamanho da saída é de poucas centenas de linhas):

```bash
#!/bin/bash
# M10a, item 135: leituras de produção, só select. Uso: bash .superpowers/sdd/manutencao-nas/m10a/prova-zero.sh <antes-migration|depois-migration|antes-codigo|depois-codigo|ciclo> <ref> [<dep>]
# <ref> = instante de referência fixo (ex. 2026-10-20T15:10:00Z), o MESMO nas duas leituras de um par. <dep> (só no ciclo) = instante do Ready do deploy.
set -euo pipefail
m="${1:?momento}"; ref="${2:?instante de referencia, ex. 2026-10-20T15:10:00Z}"; mkdir -p saidas; o="saidas/m10a-prova-$m.txt"; { date -u '+%F %T UTC'; echo "ref=$ref"; } > "$o"
npx supabase db query --linked "select (select count(*) from competitor_channels) as canais, (select count(*) from competitor_videos) as videos, (select count(distinct site_id) from competitor_channels) as sites" >> "$o"
npx supabase db query --linked "select c.site_id, public.competitor_series_health(c.site_id, '$ref'::timestamptz) from (select distinct site_id from competitor_channels) c order by 1" >> "$o"
npx supabase db query --linked "select competitor_channel_id, series_tier, count(*) as videos, count(*) filter (where pinned_at is not null) as fixados, count(*) filter (where published_at is null) as sem_data from competitor_videos group by 1, 2 order by 1, 2" >> "$o"
npx supabase db query --linked "select c.id, max(c.last_ok_synced_at) as ultima_sync, max(c.weekly_pass_date) as semanal from competitor_channels c group by 1 order by 1" >> "$o"
npx supabase db query --linked "select count(*) as canais_em_erro from competitor_channels where sync_status = 'error'" >> "$o"      # no ciclo: <= ao do antes-codigo; no passo 6: igual ao do depois-migration
[ "$m" = "antes-migration" ] || npx supabase db query --linked "select count(*) filter (where archive_frozen_at is not null) as congelados, count(*) filter (where archive_dropped_at is not null) as no_arquivo from competitor_videos" >> "$o"
[ "$m" = "antes-migration" ] || npx supabase db query --linked "select site_id, h_meses, released, teto_unidade from obs_archive_video_policy order by 1" >> "$o"
if [ "$m" = "ciclo" ]; then
  dep="${3:?dep: instante do Ready do deploy}"; echo "dep=$dep" >> "$o"
  npx supabase db query --linked "select count(*) as vivos_sem_sync_nova from competitor_channels where missing_since is null and coalesce(last_ok_synced_at, 'epoch') < '$dep'" >> "$o"      # esperado: 0
  npx supabase db query --linked "select (select count(*) from competitor_videos) - (select count(*) from competitor_videos where discovered_at >= '$dep') as videos_de_antes" >> "$o"      # esperado: igual ao total de videos do antes-codigo (V1)
  npx supabase db query --linked "select count(*) as trocas_de_faixa from competitor_video_tier_spans where from_date >= ('$dep'::timestamptz at time zone 'America/Sao_Paulo')::date" >> "$o"      # a diferenca por (canal, faixa) contra o antes-codigo e explicada por este numero
  npx supabase db query --linked "select (select count(*) from competitor_field_versions where first_seen_at >= '$dep') as field_versions, (select count(*) from competitor_raw where first_seen_at >= '$dep') as raw, (select count(*) from competitor_video_tier_spans where from_date >= ('$dep'::timestamptz at time zone 'America/Sao_Paulo')::date) as tier_spans" >> "$o"      # esperado: > 0 nas tres (o codigo novo grava; a guarda nao derrubou lote)
fi
echo "ok: $o"
```

  (As colunas de data de criação das oito tabelas e `competitor_channels.sync_status` são conferidas contra o catálogo local
  neste passo; a quinta leitura do ciclo cobre as três tabelas que a captura grava, `congelados = 0` e `no_arquivo = 0` já saem da leitura 5 do bloco comum.)

- [ ] **Passo 4 (dono, na árvore comum, na janela da restrição 3).** `npm run db:link:prod`; `npx supabase migration list --linked`
  (segue só se a **única** pendente for `<ts>_observatorio_m10a_video_antigo_base`); então, **no mesmo trecho**:
  `bash .superpowers/sdd/manutencao-nas/m10a/prova-zero.sh antes-migration <ref>` (o `ref` é o instante desta leitura),
  `npm run db:push:prod` (YES), `bash …/prova-zero.sh depois-migration <ref>` com o **mesmo** `ref`. Diferenças esperadas e só estas: `arquivados: 0`
  na prova da série; `congelados 0, no_arquivo 0`; uma linha por site na política com `24, false, <teto da CP29>`. Qualquer
  outra diferença: para, e a TRAVA M10a-2 não solta.
- [ ] **Passo 5 (dono), catálogo, na mesma leitura (só catálogo):**
  `select count(*) from pg_trigger where tgname = 'obs_video_antigo_guarda' and not tgisinternal` → **8**;
  `select count(*) from pg_proc where proname = 'pin_competitor_video'` → **1**;
  `select indexdef from pg_indexes where indexname = 'idx_competitor_readings_video'` → contém `WHERE (video_id IS NOT NULL)`.
- [ ] **Passo 6 (dono), a coleta antiga grava depois da migration (Phil I-7).** Entre o push e o deploy do código roda o
  código **antigo** sobre o banco novo; se a guarda tiver um defeito, toda captura falha e a gravação daquele intervalo não
  volta (o YouTube só devolve o estado corrente). Na primeira sincronização depois do push (minuto `:x0` seguinte), o dono
  roda `select count(*) from competitor_field_versions where first_seen_at >= '<push>'` e o mesmo em `competitor_raw` e
  `competitor_video_tier_spans` (filtrando por `from_date`), e o número de canais em `sync_status = 'error'`. Esperado: gravou
  (maior que zero onde a passada tinha o que gravar) e `canais_em_erro` igual ao do `depois-migration`. Se não: o dono roda `desligar-guarda.sql` no
  mesmo minuto, a TRAVA M10a-2 não solta e o controlador leva ao Phil e ao Yannis.
- [ ] **Passo 7 (controlador).** Ledger: "passo 1 da §10.8 em <data hora>" e a linha **"TRAVA M10a-2 solta em <data hora>"**.
  Só então as Tarefas 6 a 12 começam. **Sem commit**: ledger, `prova-zero.sh` e `desligar-guarda.sql` ficam só no disco (`.superpowers/` é ignorado).

---

## Tarefa 6. O predicado único e os tipos

**Pré-condição (TRAVA M10a-2):** a migration está em produção e o ledger tem a linha "TRAVA M10a-2 solta". Cada tarefa 6 a 12 commita no `staging` ao terminar.

**Arquivos:** criar `apps/web/src/lib/youtube/video-antigo/esta-congelado.ts`; criar
`apps/web/test/youtube/video-antigo/esta-congelado.test.ts`; regenerar `apps/web/src/types/database.types.ts`.

**Interface (usada pelas Tarefas 7 a 10 e pela M10b):**

```ts
// O vídeo antigo (02 §10.8): o predicado ÚNICO da marca. Todo código que decide se lê, grava ou mostra um vídeo de
// concorrente pergunta aqui; nenhum outro lugar compara archive_frozen_at.
export interface LinhaComMarca { archive_frozen_at?: string | null; archive_dropped_at?: string | null }
export type EstadoDoVideo = 'ativo' | 'leitura_mensal' | 'no_arquivo'

/** Fora da coleta: em leitura mensal OU já no arquivo. */
export function estaCongelado(v: LinhaComMarca): boolean { return v.archive_frozen_at != null }
/** As linhas dele nas 8 tabelas da classe já saíram do online. */
export function estaNoArquivo(v: LinhaComMarca): boolean { return v.archive_dropped_at != null }
export function estadoDoVideo(v: LinhaComMarca): EstadoDoVideo {
  return estaNoArquivo(v) ? 'no_arquivo' : estaCongelado(v) ? 'leitura_mensal' : 'ativo'
}
/** A marca já em tipo estreito (nulo = ativo), para quem monta `ObsVideo.arquivo` sem `!` nem `as` (Yannis Y8). */
export function marcaDoArquivo(v: LinhaComMarca): { estado: 'leitura_mensal' | 'no_arquivo'; desde: string } | null {
  const desde = v.archive_frozen_at
  if (desde == null) return null
  return { estado: estaNoArquivo(v) ? 'no_arquivo' : 'leitura_mensal', desde }
}
/** As colunas que todo select de competitor_videos que decide algo tem de pedir (um teste confere cada um). */
export const COLUNAS_DA_MARCA = 'archive_frozen_at, archive_dropped_at' as const
```

**O que acontece quando o dado não existe:** chave ausente (`undefined`) lê "ativo". Isso é aceitável **só** porque toda
leitura que decide algo pede `COLUNAS_DA_MARCA` (teste das colunas pedidas, Tarefas 7 e 9) e o pacote em cache muda de
versão (Tarefa 9): uma linha sem a chave não chega a estas funções em produção **no deploy**; depois do primeiro congelamento quem fecha o cache velho é a invalidação da M10b (Yannis Y10). Coluna ausente no banco: o `select` falha
alto (ordem dura migration → código).

- [ ] **Passo 1. Teste, falhando:** os três estados; `undefined`, `null` e data; `estaNoArquivo` sem `archive_frozen_at`
  (estado impossível pelo gatilho) devolve `no_arquivo` em `estadoDoVideo` (a retirada é o fato mais forte); `marcaDoArquivo` devolve nulo para ativo e o par `{estado, desde}` para os outros dois.
- [ ] **Passo 2.** Escrever o módulo. **Passo 3.** `npm run db:types` com a migration aplicada no banco local 54321; o
  `git diff` de `database.types.ts` só pode ter as seis colunas, a tabela da política e as assinaturas das funções; outra
  diferença (banco local atrasado) é desfeita à mão, deixando só essas.
- [ ] **Passo 4.** `npx vitest run apps/web/test/youtube/video-antigo/esta-congelado.test.ts` e `npx tsc -p apps/web --noEmit`: passam.
- [ ] **Passo 5.** Commit: `git commit -m "feat: predicado único estaCongelado do vídeo antigo e tipos do banco (M10a, Tarefa 6)" -- apps/web/src/lib/youtube/video-antigo/esta-congelado.ts apps/web/test/youtube/video-antigo/esta-congelado.test.ts apps/web/src/types/database.types.ts`.

---

## Tarefa 7. A sincronização: pontos 1, 2 e 3

**Arquivos:** editar `apps/web/src/lib/youtube/competitor-sync.ts`; editar `apps/web/src/lib/youtube/competitor-health.ts` (grupo de schema, Y7); editar `apps/web/test/youtube/competitor-sync-a5.test.ts`;
criar `apps/web/test/integration/video-antigo-coleta.test.ts`.

**O que acontece quando o dado não existe:** canal sem nenhum congelado: as três passadas fazem exatamente o que fazem hoje
(testes da A5 inalterados passam). Canal **só** com congelados e nenhum ativo: a passada diária não tem o que pedir, a
semanal fecha (`complete = true`, sem vídeo sem faixa entre os ativos) e a página de uploads não insere nada, porque os
congelados continuam "conhecidos": `needsBackfill` continua contando todo vídeo do canal (`:325-329`), tocos inclusive,
e é isso que impede o ciclo de recriação de F69 (V1).

- [ ] **Passo 1. Testes de unidade, falhando** (no `competitor-sync-a5.test.ts`, com o falso de PostgREST e o falso do
  YouTube que o arquivo já usa):
  1. **as colunas pedidas:** o `select` de `loadAll` e o da busca dos já gravados da página de uploads contêm
     `archive_frozen_at` (o falso registra `selects`);
  2. **ponto 1:** canal com 20 ativos (10 dentro do `video_limit`) e 40 congelados com `published_at` mais recentes que
     alguns ativos: `classifyTiers` recebe só os ativos; nenhum congelado entra na passada diária nem em
     `apply_competitor_tier_plan.p_changes`; `extendPromotions` não recebe congelado;
  3. **ponto 2 / V5:** a passada semanal com congelados semanais e devidos: nenhum é pedido ao YouTube; `complete = true`
     mesmo com um congelado de `series_tier` nulo;
  4. **ponto 3:** a página de uploads traz 2 congelados e 1 ativo já gravados e 1 novo: os congelados não são reconciliados,
     não entram na captura, não recebem `update` de linha nem de `last_seen_at`, não entram em `asked`, e o vídeo novo é
     inserido; `hitKnownVideo` fica verdadeiro com só congelados na página (a incremental para);
  5. **`markMissing` nunca recebe congelado:** em nenhum dos **quatro** caminhos (diária, semanal, uploads, fixados) um congelado que o YouTube não devolveu vira
     falta;
  6. **fixados (Yannis Y6):** linha com `pinned_at` e `archive_frozen_at` (posta por `update` no falso) não é pedida nem capturada;
  7. **guarda de schema (Y7):** coluna `archive_frozen_at`/`archive_dropped_at` ausente → "migration M10a não aplicada" (padrão do grupo `E2`), não o erro cru do PostgREST;
  8. **página de uploads (Phil M-5):** o `select` dos já gravados com `error` lança (`competitor_videos (página de uploads): …`); a página nunca trata todo vídeo como novo;
  9. **fechamento da faixa (Phil M-2):** `apply_competitor_tier_plan` devolvendo `ignorados_congelados > 0` vai ao Sentry.
- [ ] **Passo 2. Código** (linhas do dia, relidas na Tarefa 0):
  - `import { estaCongelado } from '@/lib/youtube/video-antigo/esta-congelado'`.
  - `FullRow` ganha `archive_frozen_at: string | null`; `ALL_COLS` ganha `, archive_frozen_at` no fim.
  - Logo depois de `outOfProof`: `const ativos = (rows: readonly FullRow[]): FullRow[] => rows.filter(r => !estaCongelado(r))`
    com o comentário `// M10a (02 §10.8): o vídeo em leitura mensal não tem faixa, não é pedido e não é capturado; a guarda do banco é a segunda linha.`
  - `classify` passa a mapear `ativos(rows)` em vez de `rows` (cobre `:931` e `:1207`, e com isso a prova do dia em
    `:934` e a passada diária em `:1221`).
  - Passada semanal: `const weeklyRows = all.filter(r => r.series_tier === 'semanal' && !estaCongelado(r))` e
    `const complete = deferred === 0 && !ativos(all).some(r => r.series_tier == null)`.
  - `extendPromotions(all, snapDate)` passa a `extendPromotions(ativos(all), snapDate)`.
  - Fixados (Y6): `pinned = all.filter(r => r.pinned_at != null)` (`:927`) passa a `pinned = ativos(all).filter(r => r.pinned_at != null)`.
  - Guarda de schema (Y7): acrescentar `['competitor_videos', 'archive_frozen_at, archive_dropped_at']` ao grupo `E2` de `competitor-health.ts` (ou um grupo `M10A` em `schemaGroups`), com o motivo "migration M10a não aplicada" em `MG2B_WHY`.
  - Fechamento da faixa (M-2): o chamador de `apply_competitor_tier_plan` (`:1211`) registra no Sentry quando `ignorados_congelados > 0`.
  - Página de uploads: o `select` de `:1063` ganha `, archive_frozen_at` **e passa a ler o `error`: `if (existingErr) throw new Error('competitor_videos (página de uploads): ' + existingErr.message)`** (hoje o erro é descartado e uma falha do `select` faz todo vídeo parecer novo; Phil M-5); `for (const v of existingVideos ?? []) asked.add(v.id as string)`
    passa a `for (const v of existingVideos ?? []) if (!estaCongelado(v)) asked.add(v.id as string)`; dentro do laço,
    logo depois de `const existing = existingMap.get(videoId) ?? null`:

```ts
        // M10a (02 §10.8, ponto 3): o vídeo em leitura mensal continua "conhecido" (a incremental para nele e ninguém o
        // reinsere), mas não é reconciliado, capturado nem regravado: a única leitura dele é a mensal (M10b).
        if (existing && estaCongelado(existing)) { hitKnownVideo = true; continue }
```

- [ ] **Passo 3. Teste de integração** (`video-antigo-coleta.test.ts`, banco local, YouTube falso por `fetchImpl`, o mesmo
  molde de `apps/web/test/integration/competitor-sync-a5.test.ts`): canal com 20 ativos e 40 congelados (por `update`
  direto); três passadas do código novo (diária às 12:00 de São Paulo por `opts.now`, semanal, e a da página de uploads com 2
  congelados nela). Afirma: nenhuma recusa `video_congelado` (o teste espiona `Sentry.captureException` e o resultado das
  três: o texto `video_congelado` não aparece **nenhuma vez**); o histórico de campo, o bruto e a faixa dos 20 ativos foram
  gravados; para os 40, a contagem de linhas e o `max(last_seen_at)` em cada uma das 8 tabelas são iguais antes e depois, e
  a linha deles em `competitor_videos` é igual byte a byte (`row_to_json`); a contagem de `competitor_videos` do canal não
  muda (V1). **E o par de regressão:** `captureItems` chamado direto com 1 congelado e 49 ativos lança e não grava nenhum
  dos 49 (é o custo de reverter o código depois de congelar, documentado no runbook da Tarefa 13).
- [ ] **Passo 4.** Rodar os testes da sincronização inteiros (`apps/web/test/youtube/competitor-sync*.test.ts`,
  `competitor-backfill.test.ts`, `competitor-video-limit.test.ts`) e o de integração: passam.
- [ ] **Passo 5.** Commit: `git commit -m "feat: a coleta não lê, não captura e não regrava o vídeo em leitura mensal (M10a, Tarefa 7, pontos 1 a 3)" -- apps/web/src/lib/youtube/competitor-sync.ts apps/web/src/lib/youtube/competitor-health.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/integration/video-antigo-coleta.test.ts`.

---

## Tarefa 8. Leitores das provas: `arquivados` e as duas parcelas da remoção

**Arquivos:** editar `apps/web/src/lib/youtube/competitor-health.ts`, `apps/web/src/lib/youtube/competitor-removal-impact.ts`
e os testes deles (`apps/web/test/youtube/competitor-health*.test.ts`, `competitor-removal-impact*.test.ts`; nomes do dia).

**O que acontece quando o dado não existe:** a chave `arquivados` (ou uma das parcelas) ausente na resposta é **erro de
leitura da prova** (o mesmo tratamento de hoje para chave obrigatória ausente: `readProof` devolve não lido, e não lido nunca
é verde). Isso só acontece se o código chegar antes da migration, o que a ordem do dia impede.

- [ ] **Passo 1. Testes, falhando:** `readSeries` com `arquivados: 0` lê igual a hoje (as outras chaves intactas);
  `arquivados` ausente → não lido; `arquivados: 3` → a nota `3 vídeos em leitura mensal, fora da prova da série` entre as
  notas (nunca alarme); a leitura de remoção com `videos_leitura_mensal` e `videos_no_arquivo` devolve
  `videosLeituraMensal` e `videosNoArquivo`; ausentes → `resposta inesperada` como hoje. **E a compatibilidade da volta
  atrás:** conferido em 14/10 (Yannis): `counts` ignora chave extra; o teste fixa esse comportamento: `readSeries` de uma resposta com `arquivados` e uma chave inventada `zzz` lê igual ao de hoje (por isso reverter o código antes do primeiro congelamento não exige migration de volta).
- [ ] **Passo 2. Código:** `SeriesHealth` ganha `arquivados: number`; `SERIES_KEYS` ganha `'arquivados'`; a nota acima em
  `:224`; `CompetitorRemovalImpact` ganha `videosLeituraMensal: number; videosNoArquivo: number` e a checagem `isCount` das
  duas chaves em `:15`. Quem renderiza o diálogo de remoção não muda nesta etapa (as frases são da M10b, peça 8). Em `readSeries`, antes de `counts`: `if (!hasKey(d, 'arquivados')) return { why: 'migration M10a não aplicada (falta o campo arquivados)' }` (Yannis Y7).
- [ ] **Passo 3.** Testes passam. **Passo 4.** Commit: `git commit -m "feat: a prova da série lê arquivados e a remoção de canal lê as duas parcelas do vídeo antigo (M10a, Tarefa 8, pontos 5 e 8)" -- <arquivos>`.

---

## Tarefa 9. Os carregadores e a taxa semanal: ponto 6 (V2, V3, V4, V15)

**Arquivos:** editar `observatorio/load.ts`, `observatorio/types.ts`, `observatorio/pack.ts`, `observatorio/series.ts`;
editar `apps/web/test/youtube/observatorio/load.test.ts` e `pack-shape.test.ts`; criar
`apps/web/test/youtube/observatorio/video-antigo-carregador.test.ts`.

**Contrato de saída:** o vídeo ativo sai **exatamente** como hoje (nenhuma chave nova). O vídeo congelado sai com
`arquivo: { estado: 'leitura_mensal' | 'no_arquivo'; desde: number }` (`desde` = `archive_frozen_at` em ms), `tracked`
sempre falso, sem a versão de título inventada; o vídeo no arquivo também sem troca legada. As telas que leem `arquivo` são
da M10b; até lá nada lê a chave, e com zero marcado ela não existe.

**O que acontece quando o dado não existe:** pacote em cache de antes do deploy (sem as colunas): descartado pelo
`PACK_VERSION` novo (a entrada de outra versão lê o banco: `load-page.ts:73`). Depois do primeiro congelamento o `PACK_VERSION` não basta: a invalidação é da M10b (Yannis Y10). Vídeo congelado sem nenhuma versão de título
e com `title` nulo: título `''` (nunca a versão inventada "igual desde a publicação").

- [ ] **Passo 1. Testes, falhando** (`video-antigo-carregador.test.ts`, com as linhas de fixture de `load.test.ts`):
  1. `VIDEO_COLS` contém `archive_frozen_at` e `archive_dropped_at`; o falso de PostgREST registra que `readVideos` e
     `loadChannelRows` os pedem;
  2. **V4:** canal com `video_limit` 2, 3 vídeos ativos e 1 congelado **mais recente** que todos: o congelado tem
     `tracked: false` e não conta em `nTracked` (os 2 ativos mais recentes são os acompanhados); `pinState` dos ativos é o de
     hoje;
  3. **V3:** congelado sem linha de título em `versions`: `titles` vazio e `title` = `v.title`; o ramo da versão inventada
     (`load.ts:298`) não roda (o teste falha se aparecer um título com `id` terminado em `/title`);
  4. **V2:** vídeo no arquivo com linhas legadas em `legacyChanges`: zero versão legada (`titles` e `descs` sem os itens
     vindos de `withLegacy`) e `arquivo.estado = 'no_arquivo'`;
  5. **V15:** `weeklyRate` de vídeo com `arquivo` devolve `vpd: null` e o texto `em leitura mensal desde dd/mm: sem taxa atual`
     (frase do redator, para o Logan na M10b; nunca "parou de ser lido"). Os chamadores de `weeklyRate` hoje: só a fachada
     `observatorio/index.ts:220`; **nenhuma tela** (`series.ts:142`, "NENHUMA tela chama isto ainda (E5)"): é a lista que
     P21 pede, e entra na lista de leitores (Tarefa 11);
  6. `PACK_VERSION === 3` e o retrato de forma em `pack-shape.test.ts` com as duas chaves novas em `videos`;
  7. `archive_frozen_at: 'lixo'` lança `ObservatoryLoadError` (Y8).
- [ ] **Passo 2. Código:**
  - `VIDEO_COLS` ganha `, archive_frozen_at, archive_dropped_at`; `VideoRow` ganha
    `archive_frozen_at?: string | null; archive_dropped_at?: string | null` (opcional no tipo, como `pinned_at`; a leitura do
    banco sempre os pede).
  - Em `rowsToDataset`, no laço do canal: `const ativosDatados = vs.filter(({ v }) => !estaCongelado(v))`;
    `const nTracked = Math.min(ativosDatados.length, limit)`; um `Map` de id → posição entre os ativos
    (`posAtivo`); no `forEach`, `const k2 = posAtivo.get(v.id)` e `tracked = k2 != null && k2 < nTracked` substitui
    `k < nTracked` em `pinState`, em `observed` e em `tracked` (com zero congelado, `k2 === k`). `deriveSyncState` recebe o
    mesmo `nTracked`.
  - `legacyBy.get(v.id + '|title') ?? []` e o de `description` passam a `estaNoArquivo(v) ? [] : (legacyBy.get(…) ?? [])`.
  - `if (!titles.length && !estaCongelado(v)) titles = [ …a de hoje… ]` e
    `const title = v.title ?? titles[titles.length - 1]?.text ?? ''`.
  - No objeto do vídeo, depois de `pinState`: `const m = marcaDoArquivo(v); const desde = m ? ms(m.desde) : null;` e `...(m && desde != null ? { arquivo: { estado: m.estado, desde } } : {})`; data ilegível com marca é `ObservatoryLoadError` (o padrão do arquivo para dado inconsistente, `load.ts:300`), nunca vídeo "ativo" calado (Yannis Y8).
  - `types.ts`: `ObsVideo` ganha `arquivo?: { estado: 'leitura_mensal' | 'no_arquivo'; desde: number }` com o comentário da
    M10a.
  - `series.ts` `weeklyRate`: logo depois de `if (!stored) throw …`, `if (stored.arquivo) return none('em leitura mensal desde ' + ctx.clock.dm(stored.arquivo.desde) + ': sem taxa atual')`.
  - `pack.ts`: `PACK_VERSION = 3`, e a linha do comentário: `3 = M10a: archive_frozen_at e archive_dropped_at nos vídeos.`
- [ ] **Passo 3.** Rodar `apps/web/test/youtube/observatorio/` inteiro (saída em arquivo; no contexto, só falhas) e
  `cache-writers.test.ts`: passam.
- [ ] **Passo 4.** Commit: `git commit -m "feat: os carregadores rotulam o vídeo em leitura mensal, nunca o acompanham nem inventam título, e a taxa semanal dele não é atual (M10a, Tarefa 9, ponto 6)" -- <arquivos>`.

---

## Tarefa 10. A ação de fixar: ponto 7 (V14)

**Arquivos:** editar `apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts`; editar o teste de fixar
(`apps/web/test/youtube/competitor-pin*.test.ts`, nome do dia).

**O que acontece quando o dado não existe:** resposta da função sem `status` conhecido é falha (`PIN_FAILED`), como hoje.
`canAdminSiteUsers` que falha conta como "não administra" (`competitor-admin.ts:7`, falha fechada): quem administra e caiu
nisso recebe a frase de quem só edita, nunca o vídeo descongelado por engano.

- [ ] **Passo 1. Testes, falhando:** quem só edita fixando vídeo em leitura mensal recebe `{ ok: false, kind: 'denied', error: PIN_PRECISA_ADMIN }`;
  quem administra recebe `ok` e a ação invalida o cache e revalida a página; vídeo no arquivo → `PIN_NO_ARQUIVO`; a chamada
  à função leva `p_pode_descongelar` igual ao resultado de `canAdminSiteUsers(siteId)`; vídeo ativo: resposta igual à de
  hoje.
- [ ] **Passo 2. Código** (frases da §14.10 do `04`, a de quem só edita marcada "do redator, para o revisor de UX"):

```ts
const PIN_PRECISA_ADMIN: PinResult = { ok: false, kind: 'denied', error: 'Este vídeo está em leitura mensal. Só quem administra o site pode voltar a acompanhá-lo por inteiro.' }
const PIN_NO_ARQUIVO: PinResult = { ok: false, kind: 'denied', error: "Este vídeo está no arquivo e não pode ser fixado. As views dele continuam sendo lidas uma vez por mês; o histórico está em 'Ver antigo'. Voltar a acompanhar por inteiro um vídeo que está no arquivo ainda não existe." }
```

  Em `pinVideo`, antes da RPC: `const podeDescongelar = await canAdminSiteUsers(who.siteId)`; a RPC passa
  `p_pode_descongelar: podeDescongelar`; depois de `not_found`: `if (d.status === 'precisa_admin') return PIN_PRECISA_ADMIN`
  e `if (d.status === 'ja_no_arquivo') return PIN_NO_ARQUIVO`. `unpinVideo` não muda (desafixar não congela: congelar é da
  M10b, com a simulação). Escolha anotada (Yannis Y11, opcional): `canAdminSiteUsers` roda em toda fixação (uma ida ao banco a mais por clique, correção inalterada); a alternativa (chamar com `false` e só perguntar em `precisa_admin`, rechamando com `true`) fica registrada para quem medir custo.
- [ ] **Passo 3.** Testes passam. **Passo 4.** Commit: `git commit -m "feat: fixar vídeo em leitura mensal exige quem administra e o descongela; no arquivo recusa (M10a, Tarefa 10, ponto 7)" -- <arquivos>`.

---

## Tarefa 11. A lista dos leitores de `competitor_videos` e o teste das listas (item 139)

**Arquivos:** criar `apps/web/src/lib/youtube/video-antigo/leitores-competitor-videos.ts`; criar
`apps/web/test/youtube/video-antigo/leitores-competitor-videos.test.ts` (sem banco) e
`apps/web/test/integration/video-antigo-leitores-vivos.test.ts` (com banco).

**Interface:**

```ts
export type Trata = 'exclui' | 'inclui_e_rotula' | 'indiferente'
/** Etapas que ainda não entregaram. Quem fecha a etapa TIRA o nome daqui, no mesmo commit que a fecha: o tsc acusa toda entrada que sobrou. */
export const ETAPAS_EM_ABERTO = ['M10b', 'M10c'] as const
export type EtapaEmAberto = (typeof ETAPAS_EM_ABERTO)[number]
export interface LeitorNoCodigo {
  /** caminho a partir da raiz do repositório */
  arquivo: string
  /** quantas vezes o texto `competitor_videos` aparece no arquivo hoje (comentário inclusive): mudou, o teste falha e alguém relê */
  ocorrencias: number
  trata: Trata
  motivo: string
  /** qual dos oito pontos esta entrada fecha (Yannis Y5); o teste exige o conjunto {1..8} */
  ponto?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  /** M10a só fecha os oito pontos; um leitor fora deles que precisa mudar antes do primeiro congelamento leva a etapa que o fecha */
  pendenteAte?: EtapaEmAberto
}
export interface LeitorNaMigration { arquivo: string; funcoes: readonly string[]; trata: Trata; motivo: string; ponto?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; pendenteAte?: EtapaEmAberto }
export interface FuncaoViva { nome: string; trata: Trata; motivo: string; ponto?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; pendenteAte?: EtapaEmAberto }
/** Quem GRAVA nas 8 tabelas e por que nunca grava vídeo congelado (Phil M-4). */
export interface GravadorDasOito { arquivo: string; tabela: string; porQueNuncaCongelado: string; pendenteAte?: EtapaEmAberto }
export type Classe = 'video_antigo' | 'serie' | 'horaria' | 'texto' | 'fica'
export interface TabelaFilha { tabela: string; coluna: string; classe: Classe; motivo: string }
export const LEITORES_NO_CODIGO: readonly LeitorNoCodigo[]
export const LEITORES_NAS_MIGRATIONS: readonly LeitorNaMigration[]
export const FUNCOES_VIVAS: readonly FuncaoViva[]
export const TABELAS_COM_CHAVE_PARA_COMPETITOR_VIDEOS: readonly TabelaFilha[]
export const GRAVADORES_DAS_8: readonly GravadorDasOito[]
```

**Regra de varredura (teste sem banco).** Pastas: `apps/web/src`, `apps/web/lib`, `apps/api/src`, `packages/*/src`,
`scripts`. Fora: `apps/web/src/types/database.types.ts`, arquivos `*.test.*`, e os dois arquivos de `video-antigo/`. O
teste falha (a) por arquivo com o texto e sem entrada; (b) por entrada sem o arquivo ou com `ocorrencias` diferente;
(c) se o conjunto dos `ponto` presentes nas três listas não for exatamente {1..8}, ou se alguma entrada com `ponto` tiver `pendenteAte`; (d) se algum arquivo de `apps/web/src`/`lib` com `.from('<uma das 8>')` seguido de `insert`/`upsert`, ou `rpc('<função que grava numa das 8>')`, não tiver entrada em `GRAVADORES_DAS_8`. Migrations: todo arquivo de `supabase/migrations` que cita
`competitor_videos` tem entrada (pelo nome, que não muda depois do push) e toda entrada tem arquivo; a migration desta
etapa entra na lista. **Limite declarado:** a varredura é por texto; leitura montada por concatenação (`'competitor_' + x`)
escapa. Um teste afirma que nenhum arquivo das pastas contém `'competitor_' +` ou `` `competitor_${`` (hoje: zero).

**Teste com banco (`video-antigo-leitores-vivos.test.ts`).** (a) `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%competitor_videos%'`
é exatamente o conjunto de `FUNCOES_VIVAS`; (b) nenhuma view de `public` cita a tabela (`pg_views.definition`), ou, se
citar, está na lista; (c) **o teste das listas:** as chaves estrangeiras para `competitor_videos`
(`select conrelid::regclass::text, a.attname from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey) where c.confrelid = 'public.competitor_videos'::regclass and c.contype = 'f'`)
são exatamente `TABELAS_COM_CHAVE_PARA_COMPETITOR_VIDEOS`, cada tabela numa classe só, com `competitor_raw` em
`video_antigo` com o motivo "a versão corrente; a não corrente é da classe texto, por isso a classe vai na chave do registro
(M3b)"; e as 8 tabelas com classe `video_antigo` são exatamente as que têm o gatilho `obs_video_antigo_guarda` (liga a
Tarefa 4); (d) **`competitor_hour_fold_log`:** o conjunto de arquivos e funções que leem a tabela é exatamente
{as funções da E15 que somam o dia, que leem só o mês corrente do vídeo}; o teste falha se aparecer leitor novo, e então a
tabela sai da classe (02 §10.8, linha da tabela) por decisão registrada, não em silêncio.

**Conteúdo inicial (lido em 14/10; a contagem de ocorrências é refeita no dia com `grep -o competitor_videos <arquivo> | wc -l`; o teste conta com `texto.split('competitor_videos').length - 1`).** No código, 18 arquivos
(fora `database.types.ts`):

| Arquivo | Trata | Motivo / pendência |
|---|---|---|
| `competitor-sync.ts` | exclui | pontos 1 a 3 (Tarefa 7) |
| `observatorio/load.ts`, `observatorio/load-channel.ts` | inclui_e_rotula | ponto 6 (Tarefa 9); `load.ts:484` e `:606-619` só embutem o canal da série diária, indiferente |
| `competitors/actions.ts` | inclui_e_rotula | ponto 7 (Tarefa 10) |
| `competitor-health.ts` | indiferente | só confere a existência de colunas (`:5`, `:11`) |
| `competitor-capture.ts`, `observatorio/types.ts`, `observatorio/cache-tag.ts`, `observatorio/index.ts`, `_chrome/forja-view-model.ts`, `pipeline/services/forja-queue.ts` | indiferente | só comentário. **`forja-queue.ts` grava em `competitor_readings`:** o alvo congelado da fila de inteligência (recusar ao criar; 422 em `readSent` e `completeReading`) é o pedido 17, `pendenteAte: 'M10b'` (é condição do passo 4 da §10.8) |
| `pipeline/services/competitors.ts` | indiferente | médias dos 50 mais recentes (`:190`); embute o vídeo da troca (`:255`): vídeo no arquivo sem troca online não aparece. `pendenteAte: 'M10c'` (o livro de trocas diz quantas ficaram no arquivo: item 147) |
| `pipeline/services/competitors-campos.ts` | exclui | `:225` a ponta das últimas leituras: o toco de leitura mensal puxaria a menor para trás. `pendenteAte: 'M10b'` (filtro `archive_frozen_at is null`) |
| `short-backfill.ts`, `short-guard.ts` | indiferente | reclassificam formato (`update` de `is_short`), não gravam nas 8 tabelas |
| `horaria/gravar.ts` | indiferente | janela de descoberta da leitura horária (dias, não anos); a condição c da retirada (`horaria_ainda_online`) cobre o resto |
| `observatorio/arquivo/sessao.ts` | indiferente | E10: miniaturas por canal para o arquivo da A5 |
| `conferencias.ts` | indiferente | texto de uma consulta do dono |

`FUNCOES_VIVAS` iniciais: `apply_competitor_tier_plan` (exclui, ponto 4), `competitor_series_health` (exclui, ponto 5),
`competitor_channel_removal_impact` (inclui_e_rotula, ponto 8), `pin_competitor_video` (inclui_e_rotula, ponto 7),
`competitor_videos_archive_guard` e `obs_video_antigo_guarda_insert` (indiferente: são a marca),
`competitor_capture_health` (exclui; `videos_vistos_sem_raw` acusaria o toco lido pela leitura mensal depois da retirada:
`pendenteAte: 'M10b'`), `competitor_hourly_health` (indiferente: janela de dias), `apply_competitor_comment_snap`,
`competitor_comment_due`, `competitor_comment_health` (indiferente: comentários só nos primeiros 37 dias; a guarda cobre
`competitor_video_comment_snaps`), e as funções de captura e versões da A5 que a consulta (a) devolver no dia (a lista final
sai da consulta, não deste plano). `TABELAS_COM_CHAVE…` iniciais (13 colunas, lidas nas migrations): as 8 da classe;
`competitor_video_daily` e `competitor_video_early` (`serie`); `competitor_video_hourly` (`horaria`);
`competitor_video_comments` (`texto`); `youtube_intelligence_tasks.target_video_id` (`fica`: o vídeo não é apagado).
`competitor_video_marks` não existe em migration (F75): fora da lista até nascer, e o teste (c) a pega quando nascer.

`GRAVADORES_DAS_8` iniciais (lidos em 14/10, Phil M-4): a sincronização (`competitor-sync.ts:736`, `:1211`); a captura (`competitor-capture.ts:326`, `:339`); a ausência (`competitor-capture.ts:373`, `competitor_mark_missing`); a leitura horária (`horaria/gravar.ts`, janela de dias) e os retratos de comentário (37 dias): os dois de janela curta nunca veem vídeo de 24 meses por construção, e a entrada diz isso; a fila da forja (`forja-queue.ts:399`, pedido 17: `pendenteAte: 'M10b'`).

**Gate da M10b (Y4):** o passo 4 da §10.8 (primeiro congelamento) exige `'M10b'` fora de `ETAPAS_EM_ABERTO` com `tsc` verde; a tarefa da função de congelar na M10b começa por esse commit.

- [ ] **Passo 1.** Escrever os dois testes; rodar: falham (lista ausente). **Passo 2.** Escrever a lista com as contagens
  do dia. **Passo 3.** Rodar os dois: passam. Retirar uma entrada e conferir que o teste falha com o nome do arquivo;
  acrescentar `competitor_videos` num comentário de um arquivo qualquer e conferir que falha por contagem. Desfazer.
- [ ] **Passo 4.** Commit: `git commit -m "feat: lista dos leitores de competitor_videos com o que cada um faz com o vídeo congelado, e o teste das tabelas filhas (M10a, Tarefa 11)" -- <arquivos>`.

---

## Tarefa 12. A prova "zero vídeo marcado": conjunto de dados idêntico (item 135, parte de teste)

**Arquivos:** criar `apps/web/test/youtube/video-antigo/prova-zero-marcado.test.ts` e
`apps/web/test/integration/video-antigo-prova-zero.test.ts`.

- [ ] **Passo 1. Banco local com a M2.** A migration da M2 e a desta etapa já estão aplicadas no `bythiago_int`, nessa ordem, com as duas versões registradas (Tarefa 5b, passo 2). Sem a M2 aplicada, esta tarefa não roda (dependência 3).
- [ ] **Passo 2. Teste sem banco** (`prova-zero-marcado.test.ts`): as linhas de fixture de `load.test.ts` (o maior
  conjunto que o arquivo monta) passam por `rowsToDataset` com `NOW_FIXO` duas vezes: (a) como estão, sem as chaves `archive_*`;
  (b) com as duas chaves `null` em todo vídeo. As duas saídas são iguais, **byte a byte, ao
  `__golden__/dataset-antes.json` gravado na Tarefa 0** (o código de antes das Tarefas 6 a 12). Não há variante com
  `vi.mock` do predicado: (b) e ela percorreriam o mesmo caminho e seriam iguais por construção (Yannis Y3).
- [ ] **Passo 3. Teste com banco** (`video-antigo-prova-zero.test.ts`): semeia um site com o helper de semente do
  Observatório (`apps/web/test/integration/observatorio-seed.test.ts` mostra o uso), roda `loadRows` + `rowsToDataset` com `now` fixo e
  compara byte a byte com `__golden__/dataset-antes-semente.json`. As funções SQL da Tarefa 5 contra o texto antigo já estão
  no teste da Tarefa 5: este teste só importa e repete o caso "zero marcado" sobre **esta** semente.
- [ ] **Passo 4.** Os dois passam. **Passo 5. Revisão final do lote:** suíte completa (`npx vitest run >
  …/suite.txt 2>&1`, ~160 s, só as falhas no contexto) e `npx tsc -p apps/web --noEmit`; depois Phil e Yannis revisam o lote
  (diff dos commits das Tarefas 6 a 12, lista de SHAs no ledger), conserta-se até acordo, e só então a Tarefa 13.
- [ ] **Passo 6.** Commit: `git commit -m "test: com zero vídeo marcado o conjunto de dados das telas é idêntico (M10a, Tarefa 12, item 135)" -- <arquivos>`.

---

## Tarefa 13. O dia da janela: push, deploy e a prova em produção

**Arquivos:** editar o ledger; editar o runbook de manutenção (o arquivo que o plano da M2 criar para a janela; se não houver, a
seção vai no ledger). O `prova-zero.sh` e o `desligar-guarda.sql` nasceram na Tarefa 5b.

**O que acontece quando o dado não existe:** se o ledger não tiver "TRAVA M10a-2 solta" e a Tarefa 12 fechada, nada desta
tarefa começa. Se a leitura "antes" do par não tiver saído (arquivo vazio em `saidas/`), a prova do código não existe e a
promoção espera. Se um minuto `:x0` cair entre as duas leituras do par e o build já estiver `Ready`, o par é declarado
**perdido** no ledger e a prova se apoia no `ciclo`.

Ordem do dia (cada passo com data e hora no ledger; quem roda entre parênteses). Os commits das Tarefas 6 a 12 já estão no `staging`.

- [ ] **Passo 1 (controlador).** Conferir no ledger: Tarefa 5b fechada (migration em produção, `depois-migration` anotado, TRAVA
  M10a-2 solta), Tarefa 12 e revisão final do lote (Phil e Yannis) fechadas, lista de SHAs das Tarefas 6 a 12.
- [ ] **Passo 2 (controlador).** `npx tsc -p apps/web --noEmit`, push do `staging`, CI verde, promoção a `main` pela regra do
  projeto (refspec em `bash -c`). Quando o **último** commit das Tarefas 6 a 12 estiver em `main`, anotar o SHA de `main` no ledger.
  Ledger: "passo 2 da §10.8 em <data hora>".
- [ ] **Passo 3 (dono), o par do código no mesmo intervalo (Phil I-4).** Assim que o build de produção do Vercel começar, e com
  a sincronização do minuto `:x0` anterior terminada (fora do trecho de sincronização, restrição 3), o dono roda
  `bash …/prova-zero.sh antes-codigo <ref>`. Ao ficar `Ready`, e antes do próximo minuto `:x0`, roda
  `bash …/prova-zero.sh depois-codigo <ref>` com o **mesmo** `ref`. Se um minuto `:x0` cair entre as duas, o par não vale:
  refaz-se o `antes-codigo` enquanto o build não estiver `Ready`; se já estiver, o par é declarado perdido no ledger e a prova
  se apoia no `ciclo`. O `ciclo` usa o próprio instante.
- [ ] **Passo 4.** Esperado: `depois-codigo` **idêntico** ao `antes-codigo` (`diff` vazio). Qualquer diferença: para, e o
  controlador leva ao Phil e ao Yannis.
- [ ] **Passo 5 (dono)**, no dia seguinte, depois das 16:00 UTC (passada diária das 12:00 de São Paulo e a semanal do dia
  feitas): `bash …/prova-zero.sh ciclo <ref> <dep>` (`dep` = instante do `Ready`). O `ciclo` traz cinco invariantes com o valor
  esperado escrito ao lado (Phil I-6): canais em erro `<=` ao do `antes-codigo`; vivos sem sincronização nova `= 0`; vídeos de
  antes `=` ao total do `antes-codigo` (V1: nada recriado nem perdido); trocas de faixa que explicam a diferença por (canal,
  faixa); e linhas novas `> 0` em `competitor_field_versions`, `competitor_raw` e `competitor_video_tier_spans`, com `congelados = 0`
  e `no_arquivo = 0`. O Sentry do período sem `video_congelado` entra na linha do ledger. O controlador (com o Gio, que confere
  os números) escreve no ledger **"prova zero marcado fechada"**. Sem essa linha, a M10b não congela nada (02 §10.8, "Prova
  obrigatória antes de congelar").
- [ ] **Passo 6. Até onde dá para voltar** (texto para o runbook, item 146, com estas palavras): "Antes do passo 4 da §10.8
  (o primeiro congelamento), reverter o código é livre: com zero vídeo congelado, o código anterior funciona sobre o banco
  novo (a função de fixar aceita os quatro argumentos de antes e responde igual para vídeo ativo; as chaves novas das provas são
  ignoradas, conferido em 14/10: `counts` ignora chave extra) e a migration fica. A partir do passo 4 não se reverte para
  código anterior ao passo 2: corrige-se para a frente. Com um vídeo congelado, o código antigo o releria, bateria na guarda em
  toda passada e levaria junto os lotes de captura e o plano de faixas do canal (teste de regressão da Tarefa 7). Se reverter
  for inevitável antes de qualquer retirada, descongela-se tudo antes (comando da M10b, por canal). Depois da primeira retirada
  não há volta. O passo 4 da §10.8 (primeiro congelamento) exige `'M10b'` fora de `ETAPAS_EM_ABERTO` com `tsc` verde, a
  invalidação de cache da M10b e o descongelar que zera `series_tier`."
- [ ] **Passo 7.** Commit no `staging`: `git commit -m "docs: prova zero marcado da M10a e os passos 1 e 2 da §10.8 no ledger (M10a, Tarefa 13)" -- <runbook>` (só o runbook; o ledger fica no disco).

---

## Cobertura dos itens de aceite (06 §18, M10) nesta etapa

| Item | Parte desta etapa | Fica para |
|---|---|---|
| 135 | toda (Tarefas 12 e 13) | — |
| 137 | só a política: `check` de 12, `service_role` sem escrita, subir H não descongela (Tarefa 3) | congelamento, simulação, automático: M10b |
| 138 | guarda por tabela, catálogo, `video_id` nulo, 20 ativos + 40 congelados sem recusa, regressão do lote de 50, custo CP29 (Tarefas 1, 4 e 7) | três passadas sem mudar `hash_conteudo` (o hash é da M3b: aqui a prova é contagem e `max(last_seen_at)` iguais), ausência pela leitura mensal, fila de inteligência (pedido 17): M10b |
| 139 | lista de leitores (código, migrations, funções vivas), teste das listas, `competitor_hour_fold_log` (Tarefa 11) | "vídeo pedido por nome devolve não medido, motivo arquivado" e "toda contagem de catálogo diz as duas parcelas" nas medidas e no pipeline: entradas `pendenteAte: 'M10b'` |
| 140 | V1 e V5 (Tarefa 7), V2, V3, V4 e V15 (Tarefa 9), V7 (Tarefa 4), V12 na parte das contagens de vídeo (Tarefa 5), V14 (Tarefas 5 e 10) | V6, V8, V9, V11: M10b; V10, V13: M3b e M10c; V12 depois da retirada: M10c |
| 146 | passos 1 e 2 no ledger, e o texto de "até onde voltar" (Tarefa 13) | o teste "classe liberada sem as telas da peça 8": M10b |

## NÃO VERIFICADO neste plano

1. O nome do arquivo da migration da M2 (o teste de nome da Tarefa 5b depende dele; o plano da M2 está em redação paralela).
2. (Fechado em 14/10, Yannis) `counts` de `competitor-health.ts` ignora chave desconhecida; a Tarefa 8 fixa isso em teste.
3. Os valores aceitos pelos `check` das 8 tabelas usados na semente da CP29 (o passo 1 da Tarefa 1 os lê antes).
4. (Fechado) O limiar de custo do gatilho vem do parecer do Phil de 14/10 (Tarefa 1, passo 5: 0,2 ms por linha × fator de máquina e 10 s por dia); o que continua estimativa é o tempo real, só conhecido com a medida.
5. A lista final de `FUNCOES_VIVAS` (sai da consulta no banco local no dia, Tarefa 11).
6. Se `npm run db:types` (banco 54321) está em dia com as migrations; se não estiver, a Tarefa 6 edita à mão só as entradas
   novas.
