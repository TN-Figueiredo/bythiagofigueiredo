# Fase de manutenção (NAS e forja), M3b lado do site: o arquivo durável. Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o site passa a saber o que é devido ao arquivo, a servi-lo à forja e a conferir o que ela relê: o registro com a classe na chave, a política, o leitor único da unidade mensal (`obs_archive_read_unit`), as duas funções de hash, a serialização única (`exportarUnidade`), as sete rotas de `/api/pipeline/archive/` que o copiador e o `conferir-b2` usam, a selagem com o resumo por canal, a medida de atraso, e a fatia 12a (remover canal declara o destino do arquivo, por uma função só, com o gatilho que impede um quarto caminho). Tudo pronto e ligado (`OBS_ARQUIVO=on`) antes da primeira selagem real, devida em 28/11/2026.

**Architecture:** uma migration (`*_manutencao_m3b_arquivo.sql`, rascunho em `supabase/rascunhos/m3b.sql` até a vez dela: TRAVA M3b-1) cria o registro (15 tabelas, nenhuma com chave estrangeira para canal, vídeo ou site), a política fechada, o leitor e os hashes (corpo num arquivo só, `supabase/sql/obs-archive-hash.sql`), as funções de gravação (um único caminho de `insert` no registro), a selagem, as conferências do NAS e do B2, o plano, e as funções e gatilhos da fatia 12a. No site, módulos puros em `apps/web/src/lib/youtube/observatorio/arquivo-mensal/` (contrato Zod, caminhos, estado da remoção) podem entrar antes da migration; as rotas, a troca do botão "Remover canal" e os itens do vigia só depois dela estar em produção (TRAVA M3b-2). A serialização é a da E10: as tarefas 5 e 6 da E10 estão no `staging`, mas `exportarUnidade` (pedido 2) não existe; esta fase a extrai de `exportarCanal` pelo contrato do pedido 2 (gatilho do `05` §15.1) e avisa o controlador da A5.

**Tech Stack:** PostgreSQL 17 (Supabase), PL/pgSQL, Next.js 16 (route handlers, server actions), TypeScript strict, Zod, Vitest, `pg` nos testes de integração, `node:zlib` e `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/` (aprovado em 14/10, commit `8b4dd7b61`). Trechos: `05` §15.1 (linha M3b, "Gatilho da dependência da E10", "Outras dependências"), §16.5; `02` §9.1, §9.3 (decisão B e o contrato do leitor), §9.4 (árvore), §10.1, §10.3 a §10.7, §10.9, §10.10, §11; `04` §14.3 (o diálogo de remover canal); `06` §18 itens 19, 21 a 26, 28 a 31, 75 a 78, 80, 119, 131 a 134 (parte do site), 158 a 160, 163 (só a frase do diálogo), 165 (só a função) e 172; `06` §19.4 entradas P1, P2, P8, P12, P13, P14, P28, P33, P34, P36, P37, P38, P39, P47, P51, P54, P55, P56 e P59. O `00` §3 (D1 a D27) vale como lei. Decisões do dono de 14/10: `.superpowers/sdd/manutencao-nas/decisoes-dono-14-10.md`.

**Planos aprovados que este consome (por `grep`, sem copiar):** M2 (`...-m2-particoes.md`: `obs_part.nome_da_particao` = `<tabela>_<AAAAMM>`; `obs_partitions_ensure` lê `public.obs_archive_months(table_name, month, detached_at, dropped_at)`, linhas 1090 e 2537; `obs_archive_rehearsal` com partição por `hour_slot`); M3a (`...-m3a-casa.md`, "Interfaces registradas para a M3b": as três chaves `archive_copy`, `archive_read`, `archive_b2`; `copiador.jsonl`, `conferir-b2.jsonl` com `estado: "aguardando_primeira_selagem"`; `plano.json` com `obtido_em` e `vermelhos`; Su1, o `fileId` da última conferência boa); M10a (`...-m10a-video-antigo-base.md`, Tarefa 3: `competitor_videos.archive_frozen_at` e `archive_dropped_at`, `obs_archive_video_policy`; a classe `video_antigo` entra na chave **aqui**).

**Quem é o outro lado:** o plano `docs/superpowers/plans/2026-10-14-manutencao-nas-m3b-forja.md` (copiador, `conferir-b2`, `pode-desligar`, varredura completa, blocos do pulso) lê a seção "Contrato das rotas" abaixo, gravada também em `.superpowers/sdd/manutencao-nas/contrato-rotas-m3b.md`. **Este plano é o dono do contrato:** mudança nele volta ao redator da forja antes de entrar.

---

## Global Constraints

- **Migration só no dia, e por `npm run db:new manutencao_m3b_arquivo`** (Tarefa 10). Até lá o SQL vive em `supabase/rascunhos/m3b.sql` (rastreado; o CLI só lê `supabase/migrations/` e `supabase/seeds/dev.sql`, `supabase/config.toml:25-29`). Toda migration desta fase leva `_manutencao_` no nome (o teste da M2, Tarefa 1, a reconhece por isso).
- Idempotência: `create table if not exists`, `create index if not exists`, `create or replace function`, `drop policy if exists` antes de `create policy`, `drop trigger if exists` antes de `create trigger`.
- Tabelas novas em `public`, RLS ligada, policy de leitura `public.can_edit_site(site_id)`, **nenhuma** policy de escrita, `revoke all ... from public, anon, authenticated` **e** `revoke insert, update, delete, truncate, references, trigger ... from service_role` (o `select` fica: os privilégios padrão do Supabase dão tudo ao `service_role`, que tem `rolbypassrls`; sonda do Yannis no `bythiago_int`, 14/10); **nenhuma chave estrangeira para canal, vídeo ou site** (`02` §10.1). Funções novas: `security definer`, `set search_path = ''`, nomes por `format('%I')`, `revoke all on function ... from public, anon, authenticated`; **função interna** (gatilho, `obs_archive_record_core`, `obs_archive_seal`, `obs_archive_mark_purged`, `obs_archive_video_antigo_months`, `obs_archive_b2_run_gate`, `obs_archive_b2_aceitar_paginas` (r2.2), `obs_archive_b2_teto_cor` (r2.2), `obs_archive_unit_source`, `obs_archive_class_table_guard`, `obs_archive_insert_guard`, `obs_archive_destino_declarado`, `obs_archive_mark_guard`, `obs_archive_hoje_sp`, `obs_archive_agora`) também `from service_role`; `grant execute ... to service_role` só onde a aplicação chama (K3: o conserto mais restritivo de Phil I5 e Yannis I4). **Permissão se testa com `has_function_privilege`, nunca chamando como `anon`/`authenticated`** (SIGSEGV no Postgres local: memória `reference_banco_local_integracao.md`).
- Todo `db:push:prod` é do dono, precedido de `npx supabase migration list --linked`, e só segue se as pendentes forem exatamente as do dia. Janela: fora de 11:30 a 13:00 UTC e fora dos minutos 0, 20 e 40.
- Testes com banco: `describe.skipIf(skipIfNoLocalDb())`, banco `bythiago_int` (API 54421, Postgres 54422), arquivos em série (`--no-file-parallelism`). Os testes que aplicam o rascunho o fazem dentro de `begin … rollback`, salvo o passo único de "confirmar no banco local" de cada tarefa de SQL (como a M2).
- TypeScript strict, sem `any`; Zod na borda; arquivos em kebab-case; commits `tipo: descrição`, um por tarefa, por caminho explícito no `staging` (`git commit -- <caminhos>`); nunca `git add -A`, stash ou reset. **Arquivo novo:** `git add -- <caminhos>` antes do `git commit -- <caminhos>`. Mensagem termina com `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Arquivo que outra trilha está mexendo sem commit** (hoje: `apps/web/src/lib/pipeline/api-registry.ts`, ligado ao teste não rastreado `youtube-cowork-docs-observatorio.test.ts`, e `apps/web/data/pipeline-docs/cowork-docs-youtube.md` aparecem modificados no `git status`): antes de editar **qualquer arquivo listado em Modify** de qualquer tarefa, `git diff --stat -- <arquivo>`; se houver mudança que não é desta tarefa, **não editar nem commitar o arquivo**: registrar no ledger o arquivo, o dono provável (`git log -1 --format=%an -- <arquivo>` e o teste não rastreado ligado) e a data; se continuar sem commit **na manhã seguinte**, o controlador pergunta ao terminal dono ou ao dono do produto (o commit por caminho levaria o trabalho alheio junto, e o diálogo tem de estar em produção antes de 28/11).
- `.superpowers/` é ignorado pelo git: ledger, LEIAME, arquivos de comandos e saídas ficam só no disco, nunca em `git add`/`git commit`. O que teste ou CI lê vive em caminho rastreado.
- **NAS e forja: escrita é do dono.** Este plano não toca a forja; o que o dono roda no Mac (consultas de leitura em produção) vai como ARQUIVO de comandos com saída em `.superpowers/sdd/manutencao-nas/saidas/`, mais uma linha curta que o roda. A única colagem é a variável na Vercel (clique) e o SQL de painel, se houver (exceções do `05` §16).
- **O sistema falha em VERDE.** Toda tarefa diz o que acontece quando o dado não existe (mês sem linha, canal sem unidade, função ausente, variável apagada, plano velho) antes do que acontece quando dá erro.
- Variáveis com padrão: `OBS_ARQUIVO` (só `on` liga), `OBS_ARQUIVO_LIMPEZA_CANAL` (só `on` é "sim"), `OBS_ARQUIVO_LIMPEZA_CANAL_DATA` (só texto). Cada uma com **teste que apaga a variável** e afirma o padrão, e as três em `docs/ops/env-vars.md` (Tarefa 14).
- **Erro de rota nunca é engolido:** todo `500 erro_do_banco` manda a causa ao Sentry (`Sentry.captureException` no `catch`, `captureMessage` no ramo "outro" de `erroDoRpc`); dado de RPC lido por esquema Zod com `.safeParse`, nunca por `as`.
- Sem datas-meta; o único relógio é o do dado: a primeira selagem é devida em 28/11/2026 (`05` §15.2).

## Travas e ordem de execução

- **TRAVA M3b-1:** nenhum arquivo `*_manutencao_m3b_*` em `supabase/migrations/` (nem fora do git: o `db push` lê o disco) antes da Tarefa 10, Passo 1. Até lá o SQL vive em `supabase/rascunhos/m3b.sql`; os testes o leem por `M3B_SQL_CAMINHO` (um só lugar: `apps/web/test/helpers/m3b.ts`). O teste `migrations-leitura.test.ts` (Tarefa 3) segura a trava.
- **TRAVA M3b-2:** nenhuma linha das Tarefas 11, 12 e 13 (rotas, botão, vigia), nem na árvore sem commit, antes de a migration estar aplicada em produção e conferida (Tarefa 10, Passo 5, linha "TRAVA M3b-2 solta em <data hora>" no ledger `.superpowers/sdd/manutencao-nas/m3b-site-progresso.md`). Parte mecânica (Tarefa 3): enquanto não houver arquivo `*_manutencao_m3b_*` em `supabase/migrations/`, `migrations-leitura.test.ts` exige que `apps/web/src/app/api/pipeline/archive` não exista e que `competitors/actions.ts` não contenha `competitor_channel_remove`; a aplicação em produção continua presa ao ledger. Motivo (P47): código novo sem a função faz o botão "Remover canal" falhar alto e as rotas responderem `erro_do_banco`; com o código no `staging`, a promoção de qualquer outra frente o leva a produção antes da função.
- **TRAVA M3b-0a (dependências de teste):** as Tarefas 3 a 8 só começam com `git ls-files apps/web/test/helpers/migrations.ts apps/web/test/helpers/m2.ts apps/web/test/manutencao/migrations-leitura.test.ts apps/web/test/integration/video-antigo-m10a-caminho.ts` listando os quatro (helpers da M2 Tarefa 1; o da M10a é o que o plano dela exporta na Tarefa 2: `M10A_SQL` e `M10A_EM_MIGRATION`, aplicados pelo texto de `M10A_SQL`). Faltando um, a M3b faz as Tarefas 1, 2 e 9 e registra a espera no ledger; nunca cria cópia própria dos helpers.
- **TRAVA M3b-0 (dependências de produção):** a Tarefa 10 só começa com a M2 **e** a M10a aplicadas em produção e conferidas nos ledgers delas ("TRAVA M2-2 solta" e a linha equivalente da M10a). A M3b lê `obs_archive_rehearsal` (M2) e `competitor_videos.archive_frozen_at` (M10a) e é aplicada depois das duas.
- **TRAVA M3b-3 (desenho):** a frase do diálogo "Remover canal" (Tarefa 12, passos 4 a 7) espera a aprovação do mockup `18-v2` pelo dono (etapa M4, índice dos planos, linha 6). A troca do `.delete()` pela função (Tarefa 12, passos 1 a 3) **não** espera: ela não muda texto. **O diálogo tem de estar em produção antes de 28/11** (`05` §15.1): se o `18-v2` não estiver aprovado quando a Tarefa 12 chegar, o controlador avisa o dono no mesmo dia, com a data.
- **Ordem:** 0 → 1 → 2 → (TRAVA M3b-0a) 3 → 4 → 5 → 6 → 7 → 8 → 9 → 9a → **10** (a vez da migration; espera a TRAVA M3b-0) → 11 → 12 → 13 → 14. As Tarefas 1, 2, 9 e 9a são TypeScript puro e podem ser commitadas antes da migration (a 9a pode subir a qualquer momento: fecha uma exposição que existe hoje); 3 a 8 commitam só o rascunho e os testes.
- **Dívida declarada:** entre as Tarefas 3 e 10 o SQL só é provado no banco local; na CI os testes de banco pulam. Gatilho de pagamento: Tarefa 10, Passo 1. A regra das ~15 funções SQL das Tarefas 5 a 8 está em prosa: o diff de cada uma dessas tarefas passa por Yannis e Phil antes do commit.

## Review Focus

1. **Falha em verde na selagem.** O conjunto devido vem de uma função só (`obs_archive_expected_units`); par esperado **sem unidade nenhuma** é pendente, nunca terminal por vacuidade. Mês com canal sem unidade, resumo ausente ou manifesto não recebido nunca vira `sealed_at`; unidade de par novo num mês selado o reabre; o mês sela uma vez só sob concorrência; mês com zero linha vira "vazio conferido" registrado, e mês com tudo `purged_at` vira "sem dado a guardar", nunca "vazio conferido" (Tarefa 5).
2. **Um só caminho de gravação no registro.** O `service_role` não tem `insert`/`update`/`delete` nas tabelas do registro nem `execute` nas funções internas; `obs_archive_record` (sem `p_origem`) é a única gravação que a aplicação chama, e o expurgo passa por `obs_archive_record_core`, só do dono. O caminho trava a linha do canal com `for key share`; o gatilho de `insert` recusa canal `apagar` e versão de unidade retirada, com a exceção do expurgo presa ao dono da tabela **e** ao `pg_current_xact_id()` (P56). Coberto na Tarefa 5 (corrida de 20 rodadas, três formas) e na Tarefa 8.
3. **O site nunca devolve o valor esperado.** Nenhuma resposta de `plan`, `attest` ou `unit/received` traz hash, contagem ou soma do registro (item 132). Coberto por um teste de contrato que varre as respostas (Tarefa 11).
4. **Controle do B2.** Informe de arquivo antes do controle negativo (`ausente`) e do canário do mesmo filho é recusado (`controle_pendente`); negativo `sem_acesso` deixa o controle pendente, nunca `controle_falhou`; `controle_falhou` não atesta nem retira; sem `file_id`/`upload_timestamp` não atesta; o segundo informe igual é `divergente`; `nao_decifra` é `divergente` já no primeiro; `nada_devido` vem do site por filho (Tarefa 6).
7. **Mês fora do banco nunca se refaz do online** (`mes_fora_do_banco`, `ja_no_arquivo`, `aguardando_dono`), e o dia devido é uma conta só (`obs_archive_due_on`), igual na gravação, no plano e no atraso (Tarefas 5 e 7).
5. **A remoção de canal.** Sem declaração da mesma transação o `delete` recusa (`destino_do_arquivo_nao_declarado`), inclusive por `service_role` e por `truncate`; `guardar` pelo botão é recusado; a decisão `apagar` marca `purged_at` em toda unidade e todo resumo (Tarefa 8).
6. **`OBS_ARQUIVO` apagada** responde `arquivo_desligado` (503) em toda rota, nunca lista vazia (Tarefa 11).

---

## Fatos usados (com fonte)

| Fato | Fonte |
|---|---|
| A E10 tarefa 5 está no `staging`: `arquivo/csv.ts` (`linhaCsv`, `lerCsv`, `CsvInvalido`) e `arquivo/manifesto.ts` (`VERSAO_DO_MANIFESTO`, `caminhoDoArquivo`, `validarManifesto`, `paraRegistro`) | `apps/web/src/lib/youtube/observatorio/arquivo/csv.ts:13-35`, `manifesto.ts:10-203` (lidos em 14/10) |
| A E10 tarefa 6 está no `staging` (`exportarCanal`, `conferirLote`, `sessao.ts`), mas **`exportarUnidade` não existe** (pedido 2): o passo 5 está dentro de `exportarCanal`, com `lerCsvDoBanco` e `gzipSync(..., { level: 9 })` | `arquivo/exportar.ts:106-282` (passo 5 em `:181-215`); `grep -rn exportarUnidade apps/web` vazio em 14/10 |
| A MG6 da E10 **não está** em nenhuma migration: `obs_archive_is_site_admin`, `obs_archive_register`, `obs_archive_batches` não existem | `grep -ln` em `supabase/migrations/*` vazio em 14/10 |
| A E10 define `obs_archive_is_site_admin(p_site uuid, p_user uuid)` (parâmetro **`p_user`**, não `p_by`): `create or replace` com outro nome de parâmetro falharia na E10 | `docs/superpowers/plans/2026-10-13-a5-e10-...-plan.md:1402-1416` |
| A coluna de controle da E10 (`sum_sql`): `views` nas séries; `likes` em `competitor_video_comment_marks`; nula nas demais | idem, `:1527-1597` |
| `competitor_removed_items` existe (E1), com `kind in ('video','canal','comentario')`, `youtube_id not null`, `competitor_channel_id uuid`, `archive_pending boolean`; não tem lista de unidades (é da M9) | `supabase/migrations/20261012000002_...:128-145` |
| `competitor_video_daily` **não tem** `site_id`, e `competitor_videos` também não: o site vem de `competitor_channels.site_id`, por `competitor_videos.competitor_channel_id`; `hourly`, `early`, comentários e bruto têm `site_id`. A coluna do id do YouTube em `competitor_videos` é `video_id` | `20260531000008_competitor_observatory.sql:14-24`; `20261007000002_observatorio_fixar_video_teto.sql:37` ("competitor_videos não tem site_id") |
| Os privilégios padrão do esquema `public` concedem tudo ao `service_role` em tabela e função novas; `revoke ... from public, anon, authenticated` não os tira | sonda do Yannis no `bythiago_int` (14/10): `has_table_privilege('service_role', t, 'insert') = t` depois do `revoke` |
| O gzip nível 9 do Node depende do zlib: Node 25 (Mac, zlib 1.2.12) e Node 22 (`.nvmrc`, CI, zlib 1.3.1) geram bytes diferentes do mesmo CSV | sonda do Yannis (14/10): sha256 `28d5b38d…` × `7b972c27…` |
| `api-registry.test.ts` exige 8 domínios (`:11-24`) e documento de domínio com `# ` e ≥ 100 linhas (`:198-212`); `mcp-registry-sync.test.ts:29` exige `mapped + unmapped = 128` | lidos pelo Yannis em 14/10 |
| O `rpc` do supabase-js devolve `PostgrestFilterBuilder` (`PromiseLike`, não `Promise`) | `tsc --strict` numa sonda, Yannis, 14/10 |
| `authenticateRead` só recusa com `modoLeitura().modo === 'recusa'`, e a E19 está em `aviso` desde 12/10: uma chave só `archive_*` lê hoje as ~60 rotas GET do pipeline | `helpers.ts:46-58`, `leitura-modo.ts:17` |
| `competitor_raw.competitor_channel_id` é `not null`; `is_current` separa a versão corrente | `20261012000002_...:104-118` |
| O botão "Remover canal" apaga direto: `supabase.from('competitor_channels').delete().eq('id', id).eq('site_id', siteId)` | `apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts:152-168` (linha 162) |
| `requireSiteAdminScope` devolve `{ ok: true, user: { id } }`: é de onde sai o `p_actor` | `apps/web/lib/cms/auth-guards.ts:29-58` |
| `can_admin_site_users` = super admin (org_admin de organização raiz) ou org_admin da organização do site | `supabase/migrations/20260507000001_schema.sql:3751-3756`, `:4320-4330` |
| Rotas do pipeline: envelope `{ data }` / `{ error: { code, message, details? } }`; `authenticatePipeline` aceita chave por `X-Pipeline-Key` e cai para sessão; limite de 100 por minuto; 429 sai com `code` `UNAUTHORIZED` | `apps/web/src/lib/pipeline/helpers.ts:7-28`, `auth.ts:72-125` |
| `requirePermission` só conhece `read`, `write`, `admin`, `intelligence`; uma chave só com `archive_*` não passa em nenhum | `auth.ts:133-140` |
| O registro de rotas (`leitura-rotas.ts`) tem um teste que reprova rota nova sem entrada | `apps/web/src/lib/pipeline/leitura-rotas.ts:1-3` |
| `api-registry.ts`: `DomainId` não tem `archive`; `ApiEndpointMeta.auth` é `'read' \| 'write' \| 'intelligence'` | `api-registry.ts:1-8` |
| Rotas do pipeline com trabalho pesado usam `export const maxDuration = 60` | `apps/web/src/app/api/pipeline/youtube/intelligence/route.ts:12` |
| O diálogo de remoção existe: `_canais/remove-dialog.tsx`, alimentado por `competitor_channel_removal_impact` (`competitor-removal-impact.ts`) | `canal-screen.tsx:13-22`; `apps/web/src/lib/youtube/competitor-removal-impact.ts:1-25` |
| A agenda: `Tarefa` com `nome`, `rotulo`, `ordem`, `peso`, `periodo`, `aPartirDaHoraSP`, `tetoTentativas`, `toleranciaVigiaH` | `apps/web/src/lib/youtube/agenda/tipos.ts:38-60` |

## Decisões deste plano (o que o spec deixou ao plano, ou que o plano muda, com motivo)

| # | Decisão | Motivo |
|---|---|---|
| D1 | **Gatilho da E10, forma parcial.** As tarefas 5 e 6 da E10 estão no `staging`; o que falta é o pedido 2. Esta fase **não** reescreve `csv.ts` nem `manifesto.ts`: extrai `exportarUnidade` de `exportarCanal` com o contrato do pedido 2 e avisa o controlador da A5 no mesmo dia (Tarefa 0, Passo 2; Tarefa 2) | O gatilho do `05` §15.1 existe para não haver dois `csv.ts`. Com os dois no `staging`, o mínimo que destrava a M3b é o pedido 2 |
| D2 | **Assinatura do leitor:** `obs_archive_read_unit(p_site uuid, p_class text, p_table text, p_channel uuid, p_month date, p_offset bigint, p_limit integer)`. Entra `p_class` (o bruto tem unidades em duas classes, item 131) e a faixa é por **posição na ordem da chave primária** (`offset`/`limit`), não por chave | Chave composta em comparação de linha exigiria tipos por tabela. Com posição, a regra do spec continua: cada chamada devolve contagem, soma e `hash_conteudo` **da unidade inteira**; se divergirem entre chamadas, a leitura recomeça (até 3 vezes) e depois é `mudou_durante_a_leitura` |
| D3 | **`channel_ref` é `competitor_channels.id::text`** (P1). Confirmado por leitura: o `id` é `uuid default gen_random_uuid()` e nenhum cadastro o reaproveita (Tarefa 0, Passo 4) | Recadastrar cria outro uuid; a unidade antiga continua de canal removido |
| D4 | **Hashes em texto hexadecimal** (64 caracteres), em todas as tabelas, inclusive `obs_archive_summaries` (P39 deixava `bytea`) | Um tipo só entre SQL, TypeScript, JSON e a forja; a economia de `bytea` (0,005 MB por canal por ano) não devolve canal nenhum (P39) |
| D5 | **Quatro tabelas a mais no registro**, além das do spec: `obs_archive_b2_runs` (a execução do `conferir-b2`: controle negativo e canário), `obs_archive_b2_files` (por arquivo: a última conferência boa com o `fileId` (Su1), a última tentativa e o primeiro informe diferente à espera da repetição), `obs_archive_canaries` (o canário do dia, por filho, com o sha256 informado pelo copiador) e `obs_archive_sweeps` (a varredura completa: devida desde, NAS de volta, início, fim) | O spec descreve os estados (`02` §10.9, §10.10) sem dizer onde moram; nas colunas de `obs_archive_months` não cabem por arquivo |
| D6 | **O manifesto é por (classe, mês)**, e não por (classe, tabela, mês): o `arquivo_id` é `m:<classe>:<AAAA-MM>:v<N>:(json\|sha256)`, e as colunas `manifest_*` de toda linha de `obs_archive_months` daquela classe e mês recebem os mesmos valores | O caminho do spec (`<classe>/manifestos/<AAAA-MM>.v<N>.json`) é por classe e mês |
| D7 | **Unidade vazia nasce terminal:** `row_count = 0` grava `received_at` igual a `exported_at`, sem arquivo e sem `sha256_bytes`; o plano nunca a devolve como aguardando, o `attest` não a reconfere e `declarar-perdida` a recusa (P13) | "Vazia conferida: não tem arquivo, tem registro" (`02` §10.4) |
| D8 | **Uma rota de exportação, partes por posição.** A primeira chamada lê a unidade inteira, serializa, divide em partes de até 3 MB comprimidos por fronteira de linha, grava as partes e devolve a parte 1; `parte: k` relê só a faixa da parte e confere o sha256 dos bytes contra o registrado (diferente: `parte_mudou`) | O site não guarda bytes; a reprodução por faixa é determinística **na mesma versão do runtime** (gzip do Node sem hora no cabeçalho, nível 9): uma troca de Node na Vercel entre a parte 1 e a parte k dá `parte_mudou` uma vez, e a unidade é refeita (esperado, não é defeito). Por isso as fixtures de ouro comparam o CSV e o `.gz` descomprimido, nunca o sha256 do `.gz` (Tarefa 2) |
| D9 | **Resumo e manifesto voltam em JSON com `conteudo_base64`**, e a unidade em bytes crus | O resumo de um canal e o manifesto são pequenos (teto de 3 MB por resposta, `grande_demais` acima); a unidade pode chegar a 3 MB e a base64 a levaria a 4 MB, perto do limite de resposta da função |
| D10 | **As rotas aceitam só a permissão exata** (`archive_copy`, `archive_b2`, `archive_read`); `admin` e `write` não as abrem | O spec dá a cada programa a menor permissão (`02` §10.6); uma chave larga de outra frente não pode exportar texto de terceiros |
| D11 | **Domínio novo `archive` no catálogo do pipeline**, com `auth` ampliado para `'archive_copy' \| 'archive_b2' \| 'archive_read'`, e documentação em `apps/web/data/pipeline-docs/cowork-docs-archive.md` | As rotas estão em `/api/pipeline/` (`02` §10.6), logo valem as regras de integridade; elas não são do Cowork, e o `suggest_when` diz isso |
| D12 | **A política fechada mora numa função `obs_archive_policy()`** (lista de valores no corpo); `released` muda só por migration. Na M3b: tudo `false` | `02` §10.3; a M5 libera `serie` e a M10b, `video_antigo` |
| D13 | **Início do arquivo por classe:** o primeiro mês devido de uma classe é o mês da primeira linha da classe no banco (mínimo da coluna de tempo das tabelas dela), nunca antes de outubro de 2026. **O piso de outubro de 2026 não vale para a classe `ensaio`:** os meses dela são os do rol da carga. O início é calculado uma vez e gravado nas colunas `first_month` e `first_month_at` da linha da classe em `obs_archive_switch` na primeira vez que o plano o calcula; depois só é lido dali (Phil M7: `competitor_video_comments` não tem índice em `first_seen_at`) | Sem isso o plano pediria meses anteriores à coleta como "vazio conferido" sem fim; o ensaio do `03` §13.3 é de março de 2026 |
| D14 | **Canais devidos num mês M:** nas classes `serie`, `horaria` e `texto`, todo canal que existe no instante do plano e foi cadastrado antes do fim de M (`coalesce(added_at, '-infinity'::timestamptz) < (M + 1 mês) 00:00-03`; nulo conta como antigo), mais todo canal que existe e tem linha em M; unidade vazia quando não tem linha (item 26). Na classe `ensaio`, os canais do rol gravado pela carga (`obs_archive_rehearsal_seed`, M8), inclusive o sem linha; sem rol, os com linha. Na `video_antigo`, nenhum até a M10b. A regra mora numa função só, `obs_archive_expected_units` (D19) | Item 26 ("canal sem linha no mês tem unidade vazia com o nome do canal"); canal cadastrado depois não ganha "vazio conferido" de mês em que não era coletado (Phil I7); o ensaio precisa de "um canal sem linha" (`03` §13.3) |
| D15 | **A conclusão de itens da E9 na remoção** (`02` §10.5, "Origem, lida do registro") atua sobre `competitor_removed_items` com `kind in ('video','comentario')`, `competitor_channel_id = p_channel` e `archive_pending`, grava `archive_pending = false` e a anotação na coluna nova `archive_note text` | `archive_pending` é sempre falso hoje (E9) e a lista de unidades do item é da M9; com isso a regra existe desde a M3b e não faz nada até lá |
| D16 | **O que a decisão `apagar` faz em `obs_archive_results` é da M7:** a M7 recria `competitor_channel_remove` e `obs_archive_channel_removal_decide` com o apagamento dos resultados e o cancelamento dos pedidos | As tabelas da fila nascem na M7; SQL dinâmico sobre tabela ausente seria falha em verde |
| D17 | **Corpo das duas funções de hash num arquivo só,** `supabase/sql/obs-archive-hash.sql`, incluído **byte a byte** no rascunho entre marcadores; um teste falha se o trecho do rascunho (e, depois, o da migration) diferir do arquivo | `02` §10.4: a migration e o `ensaiar-restauracao` leem o mesmo corpo |
| D18 | **`obs_archive_pode_desligar(p_site)`** nasce aqui (só leitura), e o comando que a chama é da M3b-forja | O comando precisa de uma leitura única e testada no banco; dois redatores escrevendo a mesma consulta dariam duas verdades |
| D19 | **O conjunto devido tem uma definição só:** `obs_archive_expected_units(p_site, p_class, p_month) returns table (table_name text, channel_ref text)`, pela regra D14. O plano, o atraso, o resumo, o manifesto, a selagem e `obs_archive_unit_due` a chamam (teste de catálogo por `prosrc`) | Toda regra que quantifica só sobre as linhas que **existem** em `obs_archive_units` é verdade vazia para canal sem unidade: o mês selaria sem ele (Phil C1) |
| D20 | **O dia devido tem uma conta só:** `obs_archive_due_on(p_month date, p_margin integer) returns date` = último dia do mês + margem. Gravação, plano, atraso e vermelhos a chamam; nenhuma função contém `seal_margin_days >` | A conta antiga da gravação dava um dia a mais (outubro devido em 29/11, não em 28/11): o plano mandava e a rota recusava (Phil C2) |
| D21 | **Chave só `archive_*` não abre nada fora de `/api/pipeline/archive/`:** recusa em `apps/web/src/lib/pipeline/auth.ts`, logo depois da recusa do perfil `observatorio_leitura`, em qualquer modo da E19, com teste (K2) | A chave mora na forja; declarar a dívida até a E19 ir a `recusa` deixaria a forja lendo as ~60 rotas GET do pipeline (Yannis I6) |
| D22 | **Gravação dividida:** `obs_archive_record(p_site, p_kind, p_payload)` (sem `p_origem`, `execute` do `service_role`) chama `obs_archive_record_core(p_site, p_kind, p_payload, p_origem)`, **sem** `execute` para o `service_role`; o expurgo da M9 (função do dono) chama o `_core`. Mais: o `service_role` perde `insert`/`update`/`delete`/`truncate`/`references`/`trigger` nas 15 tabelas e `execute` nas funções internas, e o gatilho `obs_archive_mark_guard` prende `purged_*` à remoção `apagar` e `lost_*` ao canal removido (K3: o mais restritivo de Phil I5 e Yannis I4) | Sem isso a marca do expurgo (P56) é gravável por qualquer código com o cliente de serviço, e o registro é editável por fora do caminho único |
| D23 | **Os arquivos de um mês têm uma definição só:** `obs_archive_month_files(p_site, p_class, p_month)`: unidades com `row_count > 0` e `parts = 1`, as partes das unidades com `parts > 1`, os resumos com `empty = false` e os dois arquivos do manifesto, fora `lost_at` e `purged_at`, da versão selada. Usada em `reconferir`, nos `arquivos` do plano do B2, em `nas_attested_at`, em `b2_forja_ok_at` e em `pode_desligar` | Unidade vazia não tem arquivo (o atestado do mês ficaria nulo para sempre com a early vazia); unidade em partes não tem arquivo no caminho da unidade (Phil I2) |
| D24 | **Unidade devida tem uma função só:** `obs_archive_unit_due(p_site, p_class, p_table, p_channel, p_month) returns boolean`, sobre D19 e D13; usada pelo plano **e** pela gravação (`nao_devida`) | A rota aceitaria (classe, canal, mês) fora do plano e gravaria unidade vazia e linha de mês que o plano e a selagem passariam a carregar (Yannis M17) |
| D25 | **Teto de linhas da unidade antes de ler:** `TETO_LINHAS_DA_UNIDADE` em `contrato.ts`, fixado pela CP13 (Tarefa 0); a rota chama `obs_archive_content_hash` uma vez e responde `413 grande_demais` antes de qualquer página quando `row_count` passa do teto | A leitura completa custa O(N²/L) (cada página recalcula o hash da unidade inteira, `02` §9.3); unidade grande estoura os 60 s antes do teto de partes (Yannis I9). Dívida declarada com gatilho, Tarefa 4 |
| D26 | **Estado do plano do B2 por filho, decidido pelo site** (`aguardando_primeira_selagem`, `nada_devido`, `com_pedidos`); `nada_devido` só é verde com o canário do mesmo filho aceito na mesma execução; sem "um arquivo por dia" (K1) | O plano vazio depois da primeira selagem acenderia vermelho falso no pulso vários dias por semana (Pedido 4); deduzir de "zero pedidos" esconderia um site que devolve plano vazio para sempre; o canário dá a leitura real diária |
| D27 | **`nao_decifra` (B2) e `ilegivel` (NAS) são `divergente` já no primeiro informe** e entram no Zod (K4) | Com `sem_acesso`, uma cópia estragada fica mostrada como boa até a atestação vencer (Pedidos 1 e 12 do Phil) |

---

## Contrato das rotas

Versão r2.3, 14/10. Gravado também em `.superpowers/sdd/manutencao-nas/contrato-rotas-m3b.md` (cópia para o redator da forja; vale este texto). As rotas são do **pipeline**: entram em `api-registry.ts` (domínio `archive`), em `leitura-rotas.ts` e em `cowork-docs-archive.md` (Tarefa 11). A r2 aplica as revisões de Phil e Yannis deste plano e os Pedidos 1 a 13 do plano da forja, com as conciliações K1 a K4; a r2.1 fecha X1 a X5 com as decisões do controlador de 14/10; a r2.3 acrescenta o vermelho `b2_atrasado` (N2 do Phil); a r2.2 fecha os dois "Pedidos ao contrato (r2)" do plano da forja (retomada do `--completo` do B2 entre execuções, I3 do Phil; cor do `teto_bytes` contada pelo site, M6 do Phil); destino de cada achado e de cada decisão: `.superpowers/sdd/manutencao-nas/resolucao-plano-m3b-site.md` (seções "Rodada 2.1" e "Rodada 2.2").

### C0. Regras comuns

| Item | Contrato |
|---|---|
| Base | `${NEXT_PUBLIC_APP_URL}/api/pipeline/archive/` (produção: `https://bythiagofigueiredo.com/api/pipeline/archive/`). São rotas do **pipeline** (`/api/pipeline/`): entram em `api-registry.ts` (domínio novo `archive`), em `leitura-rotas.ts` e em `apps/web/data/pipeline-docs/cowork-docs-archive.md`. Nenhuma vira ferramenta MCP |
| Autenticação | Cabeçalho `X-Pipeline-Key: forja_...`. **Só chave de API:** sessão do CMS recebe `403 FORBIDDEN "API key required"` |
| Permissão | Exata, por rota: `archive_copy` (copiador), `archive_b2` (`conferir-b2`), `archive_read` (respondedor, M7). **`admin` e `write` não abrem estas rotas.** Permissão errada: `403 FORBIDDEN "Insufficient permissions"` |
| Chave do arquivo fora do arquivo | Uma chave cujas permissões são **todas** `archive_*` recebe `403 FORBIDDEN "Forbidden"` em qualquer rota do pipeline fora de `/api/pipeline/archive/` (GET inclusive), em qualquer modo da E19. A recusa mora em `apps/web/src/lib/pipeline/auth.ts` e tem teste |
| Ordem das recusas | 1) chave (401/403/429); 2) permissão (403); 3) `OBS_ARQUIVO` (503); 4) corpo pelo Zod (400); 5) par (classe, tabela) fora da política (422 `classe_tabela_invalida`, nunca 400); 6) regra da rota |
| `OBS_ARQUIVO` | Só o valor `on` liga. Ausente, vazia ou outro valor: `503 {"error":{"code":"arquivo_desligado","message":"arquivo desligado"}}` em **toda** rota, nunca lista vazia. O copiador trata 503 `arquivo_desligado` como desfecho `arquivo_desligado` (vermelho no pulso), nunca `ok` |
| Limite | 100 requisições por minuto por chave (o do pipeline). Passou: `429` (o `code` vem `UNAUTHORIZED` por herança do pipeline: **decida pelo status, nunca pelo `code`**). Cabeçalhos `X-RateLimit-Remaining` e `X-RateLimit-Reset` (segundos) em toda resposta de chave válida. **O copiador espaça as chamadas pelo `X-RateLimit-Remaining` e, no 429, espera `X-RateLimit-Reset` segundos e segue, sem encerrar a execução** (a primeira selagem passa de 200 chamadas numa execução) |
| Envelope JSON | Sucesso `{"data": ...}`. Erro `{"error": {"code": "<código>", "message": "<texto>", "details"?: ...}}`. A forja decide pelo `code`; `message` é para registro |
| Erros gerais | `400 VALIDATION_ERROR` (corpo fora do esquema Zod, `details` = lista de campos), `500 erro_do_banco` (o site manda a causa ao Sentry; a forja não recebe a causa), `504 tempo_esgotado` (o banco respondeu `57014`). 5xx: a forja tenta de novo na execução seguinte e não marca nada |
| Hora | Toda hora que o site grava é a **do banco**. Hora enviada pela forja só é guardada como "hora da máquina" no batimento |
| Valor esperado | **Nenhuma resposta devolve hash, contagem ou soma esperados.** Quem compara é o site |

#### C0.1 Tipos e listas fechadas

| Tipo | Forma |
|---|---|
| `canal` | `competitor_channels.id::text`, uuid em minúsculas (`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`). Nunca o id do YouTube |
| `mes` | `AAAA-MM`, mês de São Paulo, `^20\d{2}-(0[1-9]\|1[0-2])$` |
| `versao` | inteiro 1..9999 |
| `classe` | `horaria`, `serie`, `texto`, `video_antigo`, `ensaio` |
| `filho` | `numerico` (classes `horaria`, `serie`, `ensaio`) ou `texto` (classes `texto`, `video_antigo`). Cada classe mora num filho só |
| Tabelas por classe | `horaria`: `competitor_video_hourly`. `serie`: `competitor_video_daily`, `competitor_video_early`. `texto`: `competitor_video_comments`, `competitor_video_comment_marks`, `competitor_raw`. `ensaio`: `obs_archive_rehearsal`. `video_antigo`: `competitor_video_versions`, `competitor_field_versions`, `competitor_raw`, `competitor_video_tier_spans`, `competitor_video_comment_snaps`, `competitor_hour_fold_log`, `competitor_changes`, `competitor_readings` |
| Coluna de controle | `views` em `competitor_video_hourly`, `competitor_video_daily`, `competitor_video_early`, `obs_archive_rehearsal`; `likes` em `competitor_video_comment_marks`; **nenhuma** (`null`) nas demais e em todo resumo, manifesto e anexo |
| `soma` | Texto decimal inteiro, sem separador (`"123456789012345678"`; pode passar de 2^53: o site a calcula e a transporta como texto do banco à resposta, nunca como número JSON), soma da coluna de controle ignorando nulos; `null` quando o arquivo não tem coluna de controle; `"0"` para coluna de controle sem linha não nula |
| `linhas` | Número de registros de dados do CSV (sem o cabeçalho) |
| `sha256` | 64 caracteres hexadecimais minúsculos, dos **bytes do arquivo como está no disco** (o `.gz` inteiro, ou o `.json`) |
| Nomes reservados | `_recebendo`, `_canario` (primeiro nível do filho); `canais`, `resumo`, `miniaturas`, `manifestos` (nunca classe nem tabela) |

#### C0.2 Identificador de arquivo (`arquivo_id`) e caminho

O site dá a cada arquivo um `arquivo_id` opaco; a forja o devolve sem mudar em `unit/received` e `attest`.
**A forja monta o caminho só com os componentes validados** (classe e tabela das listas, uuid, mês, versão, sha256 do anexo) e recusa o item se o `caminho` que veio no plano for diferente do que ela montou (desfecho `plano_invalido`, vermelho; não grava nada daquele item).

| Tipo | `arquivo_id` (regex) | Caminho, relativo à raiz do filho |
|---|---|---|
| unidade | `^u:<uuid>$` | `<classe>/canais/<canal>/<tabela>/<AAAA-MM>.v<N>.csv.gz` |
| parte | `^p:<uuid>:(0[1-9]\|[1-9][0-9])$` | `<classe>/canais/<canal>/<tabela>/<AAAA-MM>.v<N>.p<NN>.csv.gz` |
| resumo | `^s:<uuid>:(canal\|video\|ficha)$` | `<classe>/canais/<canal>/resumo/<AAAA-MM>.v<N>.<canal\|video\|ficha>.csv.gz` (`ficha` só na classe `video_antigo`) |
| manifesto | `^m:<classe>:<AAAA-MM>:v<N>:(json\|sha256)$` | `<classe>/manifestos/<AAAA-MM>.v<N>.json` e `<classe>/manifestos/<AAAA-MM>.v<N>.sha256` |
| anexo | `^a:<uuid>$` | `<classe>/canais/<canal>/miniaturas/<sha256>.<jpg\|png\|webp>` (só `video_antigo`; nasce na M10b) |
| canário | `canario:<filho>` (só no plano do B2) | `_canario/<AAAA-MM-DD>` |
| escrita parcial | n/a | `_recebendo/<caminho final>` (a mesma árvore, sob `_recebendo/`; o `mv` atômico leva ao caminho final no mesmo filho). A sobra carrega o `channel_ref` no caminho (P34) |

`<uuid>` nos ids é o id da linha no registro (`obs_archive_units.id`, `obs_archive_summaries.id`, `obs_archive_unit_attachments.id`).
**Unidade em partes não tem arquivo no caminho da unidade:** `reconferir`, o plano do B2 e o manifesto listam as partes (`p:<id>:NN`), nunca `u:<id>`. Unidade vazia e resumo vazio não têm arquivo e nunca são listados.

#### C0.3 Formato dos arquivos

- **CSV** (o da E10, `arquivo/csv.ts`): separador vírgula; fim de linha `\n`; campo com vírgula, aspas, `\n` ou `\r` entre aspas, com aspas dobradas; **nulo é campo vazio sem aspas, texto vazio é `""`**; a primeira linha é o cabeçalho. O leitor da forja distingue os dois pela presença das aspas (o `csv.QUOTE_NOTNULL` do Python 3.12 não devolve `None` na leitura: a forja usa leitor próprio, plano da forja). Comprimido com gzip nível 9. **Os bytes do `.gz` dependem da versão do zlib do runtime do site:** a forja compara sempre o sha256 dos bytes que recebeu, nunca um sha256 calculado em outra máquina.
- **Resumo `.canal`** (uma linha por tabela): `canal,tabela,mes,videos_com_linha,linhas,dias_medidos,dias_do_mes,primeira_leitura,ultima_leitura,var_views,var_likes,var_comments,hash_conteudo_unidade,versao_resumo`. **`.video`** (uma linha por vídeo e tabela): `video,canal,tabela,mes,linhas,dias_medidos,views_primeira,views_ultima,likes_primeira,likes_ultima,comments_primeira,comments_ultima,hash_conteudo_unidade,versao_resumo`. Valor não medido é nulo, nunca zero. Variação nula quando algum vídeo tem a coluna nula em **qualquer** das duas pontas. Na classe `texto` as colunas de variação vêm nulas.
- **Manifesto `.json`**: `{"formato":1,"classe","mes","versao","gerado_em","site","arquivos":[{"arquivo_id","tipo","caminho","canal","tabela","linhas","soma","sha256","csv_sha256","estado"}],"unidades_canal_removido":<n>,"unidades_perdidas":<n>,"unidades_expurgadas":<n>}`, `estado` em `normal`, `vazia` (sem arquivo), `perdida`, `expurgada`. Nunca nome de canal nem id do YouTube. **`.sha256`**: formato de `sha256sum -c`, uma linha por arquivo listado (caminho relativo ao filho) mais o `.json`.

### C1. `GET plan` (copiador)

Permissão `archive_copy`. Parâmetros: `completo=1` (opcional: pede a varredura completa à mão), `cursor=<texto>` (opcional, página seguinte de `reconferir`, **em qualquer modo**). **O site decide sozinho** se a execução é completa: há varredura aberta em `obs_archive_sweeps`. Ela abre (uma só: `insert ... on conflict do nothing`) por dois caminhos, ambos medidos pela hora do banco e **só** pelo batimento do trabalhador `copiador` (`02` §10.10): (a) no `GET plan`, se o último batimento do copiador com `nas_ok` verdadeiro tem mais de 24 h (caso "forja ligada, NAS fora"); (b) no `POST heartbeat` do copiador com `nas_ok` verdadeiro, se o anterior com `nas_ok` verdadeiro tinha mais de 24 h, ou não existia e há unidade recebida (caso "forja e NAS desligados": C8). A ordem das chamadas da forja não muda o resultado.

Efeito colateral: grava `obs_archive_heartbeat.last_poll_at` do copiador.

Resposta `200`:

```ts
{ data: {
  plano_id: string,                        // uuid; a forja o grava em plano.json e no registro
  gerado_em: string,                       // ISO, hora do banco
  modo: 'normal' | 'completo',
  cursor_seguinte: string | null,          // há mais páginas de `reconferir`: chamar de novo com ?cursor=; null = última página
  primeira_selagem: string | null,         // 'AAAA-MM' do primeiro mês selado; null = nenhum mês selado ainda
  vermelhos: string[],                     // nunca ausente nem nulo (lista vazia = nenhum vermelho); texto para o registro
  canario: { dia: string },                // 'AAAA-MM-DD' (dia de São Paulo): o copiador grava _canario/<dia> nos dois filhos e informa o sha256 em attest.
                                           // Se _canario/<dia> já existe no filho (segunda execução do dia), NÃO regrava: lê o arquivo e informa o sha256 dele
  exportar: Array<{ classe, tabela, canal, mes, motivo: 'nova' | 'conteudo_mudou' | 'arquivo_ausente' | 'divergente' | 'conteudo_divergente' | 'mudou_durante_a_leitura' | 'parte_mudou' }>,
                                           // nunca de canal removido nem de (classe, tabela, mês) fora do banco (detached/dropped);
                                           // nunca unidade não devida nem de mês aberto: recusa `mes_aberto`/`nao_devida` de item daqui é divergência, vermelha (C3, X5)
  resumos: Array<{ classe, canal, mes }>,  // devidos por (classe, canal, mês); nunca de canal removido nem de mês fora do banco
  manifestos: Array<{ classe, mes }>,
  aguardando_dono: Array<ItemArquivo & { b2_file_id_bom: string | null }>,  // procurar no NAS ou em _recebendo e informar em unit/received
  a_apagar: Array<{ filho, caminho }>,     // sobra em _recebendo de unidade com purged_at nos últimos 30 dias: apagar, nunca refazer
  reconferir: ItemArquivo[],               // reler e informar em attest (fonte 'nas'); paginado
  prefixos_ausentes: [],                   // reservado para a M9: na M3b vem sempre []
} }
ItemArquivo = { arquivo_id, tipo: 'unidade' | 'parte' | 'resumo' | 'manifesto' | 'anexo', filho, caminho, classe,
                tabela: string | null, canal: string | null, mes, versao, coluna_controle: string | null }
```

Erros: os gerais. **Página:** `reconferir` vem em páginas de até 1.000 itens **em qualquer modo**, ordenadas por `arquivo_id`; `cursor_seguinte` não nulo quando há mais; os demais campos vêm só na primeira página (`cursor` ausente). Página seguinte não grava `last_poll_at` de novo nem abre varredura.

### C2. `GET plan?fonte=b2` (`conferir-b2`)

Permissão `archive_b2` (a chave `archive_copy` recebe 403 aqui, e a `archive_b2` recebe 403 sem `fonte=b2`). Parâmetros: `fonte=b2` (obrigatório), `completo=1` (opcional: `conferir-b2 --completo`), `cursor`. **Modo completo:** com `completo=1` ou com o `pode-desligar` pedindo (B2 com mais de 7 dias em mês que saiu do banco), o plano devolve todos os arquivos e vem `modo: 'completo'`; a retomada entre execuções (r2.2, abaixo) vale para os dois casos.

Resposta `200`:

```ts
{ data: {
  execucao_id: string,                     // uuid; todo informe desta execução o carrega; o MESMO em todas as páginas (cursor)
  gerado_em: string, modo: 'normal' | 'completo', cursor_seguinte: string | null,
  primeira_selagem: string | null, vermelhos: string[],
  retomado_de: string | null,              // r2.2: o cursor (`<execucao_id>|<arquivo_id>`, até 200) de onde esta execução retomou um
                                           // --completo que não terminou; null = começou do zero. Sempre null em modo normal
  cobertura: { paginas_aceitas: number, paginas_total: number } | null,   // r2.2: só no modo completo (null no normal); páginas
                                           // aceitas do completo em aberto, somando as execuções anteriores, sobre o total (>= 1)
  estado: { numerico: EstadoFilho, texto: EstadoFilho },   // decidido pelo SITE, nunca deduzido pela forja (K1)
  teto_bytes_dia: number,                  // P59: teto de bytes baixados por dia, somado em todas as execuções
  teto_bytes_mes: number,                  // P59: metade da franquia mensal de saída da CP24, em bytes; o contador da forja soma o mês do relógio dela e vira no dia 1
  controle_negativo: { arquivo_id: 'controle_negativo', filho: 'numerico' | 'texto', caminho: string },  // nome fabricado que não existe
  canarios: Array<{ arquivo_id: 'canario:numerico' | 'canario:texto', filho, caminho: string | null }>,   // sempre DOIS itens, um por filho
  arquivos: ItemArquivo[],                 // sem hash esperado; até 500 por página
  prefixos_ausentes: [],                   // reservado para a M9
} }
EstadoFilho = 'aguardando_primeira_selagem' | 'nada_devido' | 'com_pedidos'
```

- **`canarios`:** `caminho` é `_canario/AAAA-MM-DD` do canário mais recente daquele filho informado pelo copiador há pelo menos 6 horas; `null` = o site não conhece canário assim (a forja informa `ausente` e o controle daquele filho não passa). Falta de um filho na lista é `plano_invalido` na forja.
- **`estado` por filho (K1):** `aguardando_primeira_selagem` quando nenhuma classe do filho tem mês selado; `nada_devido` quando o filho tem mês selado e `arquivos` não traz nenhum arquivo dele (em todas as páginas); `com_pedidos` nos demais casos. **`nada_devido` só vale como verde se o canário do mesmo filho tiver sido aceito na mesma execução** (`execucao.canario_ok.<filho> = true` na resposta do `attest`, C7.2); sem isso, o desfecho da execução não é `ok`. O site nunca devolve plano vazio sem estado, e a forja nunca deduz o estado de "zero pedidos" nem de `primeira_selagem`.
- **Páginas e validade (X1):** todas as páginas de uma execução devolvem o mesmo `execucao_id`; até 500 itens em `arquivos` por página. A validade é de **2 horas a partir de cada página pedida**: todo `GET plan?fonte=b2` (a primeira página e cada `cursor`) renova o prazo para agora + 2 h, com o mesmo `execucao_id`. Informe que chega depois do prazo: `recusado`/`execucao_vencida` (C7.2). **Vencida a validade, a forja pede um plano novo e retoma do cursor da última página aceita, sem recomeçar do zero:** chama `GET plan?fonte=b2` (com `completo=1` se era o `--completo`) passando em `cursor` o cursor com que pediu a última página cujos informes voltaram `aceito`. Cursor de execução vencida não é erro: o site abre uma execução nova (outro `execucao_id`, outro controle negativo, canários pendentes, prazo de 2 h) e devolve a página seguinte àquele cursor. Com `execucao_id` diferente do que estava no cursor, a forja refaz o controle negativo e os dois canários antes de informar arquivos (ordem obrigatória abaixo). Cursor fora da forma `<execucao_id>|<arquivo_id>`, ou de execução que não é deste site: `400 VALIDATION_ERROR` (`details: ['cursor']`).
- **Retomada do `--completo` entre execuções (r2.2, I3 do Phil):** o site guarda na tabela das execuções do B2 (`obs_archive_b2_runs`) o cursor da última página aceita de cada `--completo` que não terminou. **Página aceita** = todo arquivo dela tem, desde o início do completo em aberto, um informe aceito com resultado conclusivo (o site concluiu `ok`, `divergente`, `arquivo_ausente` ou `aguardando_b2`; nunca `sem_acesso`, `chave_ausente` nem `repetir` sem a segunda tentativa); as páginas são aceitas em ordem, e a primeira não aceita segura o cursor. O próximo `GET plan?fonte=b2&completo=1` (sem `cursor`) **retoma desse cursor, num `execucao_id` novo** (outro controle negativo, canários pendentes, prazo de 2 h), com `retomado_de` = o cursor e `arquivos` = os seguintes a ele, até cobrir tudo; sem cursor guardado (nenhuma página aceita ainda), parte do primeiro, com `retomado_de: null`, no mesmo completo. Quando a última página (`cursor_seguinte: null`) é aceita, o completo fecha (hora do banco); **só então** o próximo `completo` recomeça do zero. `cobertura.paginas_total` = páginas aceitas + páginas de 500 que faltam depois do cursor, contadas na abertura da execução (arquivo que nasce no meio entra na conta da execução seguinte); cada página devolve a `cobertura` do momento. A retomada dentro da execução (X1, por `cursor`) não muda: a execução nova aberta por cursor vencido herda o completo da execução do cursor. A forja não guarda ponto nenhum: pede sem cursor e lê `retomado_de`.
- **`b2_completo_atrasado` (r2.2):** um `--completo` aberto que não fecha não fica verde. A execução completo mais recente do site, sem `completo_fechado_em` e com `completo_desde` de mais de 35 dias, põe `b2_completo_atrasado` em `vermelhos` (nos dois planos), com o texto "conferência completa do B2 aberta há N dias: rode `conferir-b2 --completo` até fechar". A idade conta de `completo_desde`, nunca da última cobertura completa: o completo é sob pedido (`pode-desligar`, `02` §10.9), e contar da última cobertura deixaria o vermelho aceso desde 02/01/2027 sem arquivo em risco. Sem completo aberto, não há este vermelho. A idade da conferência de rotina de cada arquivo é medida por outro vermelho: `b2_atrasado` (abaixo, N2).
- **`b2_atrasado` (r2.3, N2 do Phil):** o site põe `b2_atrasado: N meses selados não descartados com algum arquivo sem `b2_ok_at` há mais de 7 dias` em `vermelhos` (a conta é por `b2_ok_at` de `obs_archive_month_files`; vale desde a primeira selagem). Para os meses descartados, o vermelho "mês descartado sem releitura há mais de 45 dias" conta os dois lados (NAS pelo `nas_reported_at`, B2 pelo `b2_ok_at`): o mês entra se qualquer arquivo dele estiver acima de 45 dias em qualquer dos dois.
- **Pulo é divergência (X5):** o plano, do copiador (C1) ou do B2, nunca pede o que não é devido. Item pedido que termina pulado por recusa do site conta em `incompleto`, e `incompleto` é **vermelho** (C9), nunca âmbar. No copiador, os casos são `mes_aberto` e `nao_devida` (C3).

**Ordem obrigatória dos informes** (`02` §10.9): primeiro o controle negativo e os dois canários (podem ir na mesma chamada), depois os arquivos, em lotes. Informe de arquivo antes de o site ter aceito o controle negativo como `ausente` **e** o canário do filho do arquivo: `recusado`, motivo `controle_pendente`. Controle negativo informado `sem_acesso` ou `chave_ausente`: `aceito`, e o controle continua pendente (nada desta execução atesta; não é `controle_falhou`).

### C3. `POST unit/export` (copiador)

Permissão `archive_copy`. Corpo: `{ classe, tabela, canal, mes, parte?: number }` (`parte` 1..99, só depois de a primeira resposta dizer que há partes). Par (classe, tabela) fora da política: `422 classe_tabela_invalida` (a rota confere depois do Zod; nunca 400).

Resposta `200` **com arquivo**: corpo = bytes `.csv.gz`, `Content-Type: application/gzip`, e os cabeçalhos:

| Cabeçalho | Valor |
|---|---|
| `X-Arquivo-Id` | `u:<uuid>` (unidade inteira) ou `p:<uuid>:NN` (parte) |
| `X-Arquivo-Versao` | `N` |
| `X-Arquivo-Caminho` | o caminho da tabela C0.2 (a forja confere contra o que ela monta) |
| `X-Arquivo-Linhas` | linhas **do arquivo devolvido** (numa parte, as da parte) |
| `X-Arquivo-Soma` | soma do arquivo devolvido; **vazio quando `null` e vazio em toda parte**, com ou sem coluna de controle |
| `X-Arquivo-Sha256`, `X-Arquivo-Csv-Sha256`, `X-Arquivo-Bytes` | dos bytes devolvidos e do CSV sem compressão |
| `X-Arquivo-Partes`, `X-Arquivo-Parte` | total de partes (1 = não dividida) e a parte devolvida |
| `X-Arquivo-Coluna-Controle` | nome da coluna, ou vazio |

Resposta `200` **unidade vazia conferida** (`Content-Type: application/json`): `{ data: { arquivo_id: 'u:<uuid>', versao, vazia: true, linhas: 0 } }`. Não há arquivo a gravar; a unidade já é terminal.

**Unidade em partes:** a forja **não compara a soma de uma parte com o cabeçalho** (vem vazio); compara só as linhas e o sha256. Em `unit/received`, informa de cada parte as linhas relidas **da parte** e a soma relida **da parte**; o site compara a soma das partes recebidas com a da unidade quando a última chega (`conteudo_divergente` se diferir). Peça as partes 2..N com `parte: k` na mesma execução; parte já recebida ou versão já recebida: `409 nao_devida`.

Idempotência por (classe, tabela, canal, mês, versão): repetir com o mesmo `hash_conteudo` devolve a mesma versão (os mesmos bytes no mesmo runtime); uma versão nunca recebida e marcada `parte_mudou` ou `mudou_durante_a_leitura` é reaproveitada; com `hash_conteudo` diferente, ou com a unidade dada por ausente/`divergente`/`conteudo_divergente`, nasce a versão seguinte. Uma versão já recebida nunca tem o `sha256_bytes` regravado.

| Status | `code` | Quando | O que a forja faz |
|---|---|---|---|
| 409 | `canal_removido` | canal ausente, ou com remoção registrada | **pula a unidade**; nunca é erro da execução |
| 409 | `sem_destino` | (só `expurgar --item`, nunca nesta rota) | n/a |
| 409 | `unidade_retirada` | (classe, tabela, mês, canal) já tem versão com `dropped_at` | pula; vermelho no registro |
| 409 | `mes_fora_do_banco` | o (classe, tabela, mês) tem `detached_at` ou `dropped_at`: nunca se reexporta do online (`02` l.352, l.578) | pula; vermelho no registro |
| 409 | `mes_aberto` | o mês ainda não chegou ao dia devido (fim do mês + 28 ou 45 dias, `obs_archive_due_on`) | pula e conta o item em `incompleto`, **vermelho** (C9): o plano nunca pede o que não é devido, então a recusa é divergência do site (X5) |
| 409 | `nao_devida` | a unidade não é devida (`obs_archive_unit_due`: mês antes do início da classe, classe fora da M3b, canal fora do rol), ou a parte/versão já foi recebida | pula e conta o item em `incompleto`, **vermelho** (C9): divergência, como `mes_aberto` (X5) |
| 409 | `mudou_durante_a_leitura` | a unidade em partes mudou em 3 leituras seguidas | pula; o plano a devolve de novo |
| 409 | `parte_mudou` | `parte` k relida não bate com a parte registrada (também: troca do Node na Vercel entre a parte 1 e a k, esperado) | descarta as partes já baixadas da versão; o plano devolve a unidade com `motivo: 'parte_mudou'` |
| 413 | `grande_demais` | passou do teto de partes (99), ou a contagem da unidade passou de `TETO_LINHAS_DA_UNIDADE` (conferido antes de ler qualquer página) | pula; vermelho no plano |
| 422 | `classe_tabela_invalida` | par (classe, tabela) fora da política | `plano_invalido`, vermelho |
| 422 | `faixa_invalida` | faixa de leitura fora dos limites (defeito do site) | pula; vermelho |
| 409 | `tabela_ausente` | a tabela da política não existe no banco | pula; vermelho (o mês não sela). A forja decide pelo `code` |

### C4. `POST month/summary` (copiador)

Permissão `archive_copy`. Corpo: `{ classe, canal, mes }`. Responde só quando **cada tabela esperada** do canal na classe e no mês (`obs_archive_expected_units`) tem unidade terminal (recebida, vazia conferida ou perdida); zero unidade é pendente, nunca terminal. Recalcula o `hash_conteudo` de cada uma, uma chamada de função por unidade.

Resposta `200`: `{ data: { arquivo_base: 's:<uuid>', versao, vazio: boolean, arquivos: Array<{ arquivo_id, tipo: 'resumo', papel: 'canal' | 'video' | 'ficha', caminho, sha256, bytes, linhas, conteudo_base64 }> } }`. `vazio: true` → `arquivos: []` (só quando há unidade terminal para **cada** tabela esperada do canal e todas têm zero linha: o resumo é terminal sem arquivo).

| Status | `code` | Quando |
|---|---|---|
| 409 | `unidades_pendentes` | alguma tabela esperada do canal não tem unidade terminal (`details`: os `arquivo_id` pendentes e `faltando:<tabela>` para cada tabela sem unidade) |
| 409 | `conteudo_mudou` | um `hash_conteudo` recalculado diferiu; a unidade volta a devida |
| 409 | `canal_removido` | canal ausente ou com remoção |
| 409 | `ja_no_arquivo` | o (classe, mês) tem tabela com `detached_at` ou `dropped_at`: o resumo não se refaz do online |
| 409 | `resumo_da_m10b` | classe `video_antigo` (o resumo dela nasce na M10b) |
| 413 | `grande_demais` | o par passaria de 3 MB |

### C5. `POST month/manifest` (copiador)

Permissão `archive_copy`. Corpo: `{ classe, mes }`. Só responde depois de cada par (tabela, canal) esperado ter unidade terminal e de todo canal esperado sem `purged_at` ter resumo recebido ou vazio.

Resposta `200`: `{ data: { versao, arquivos: [ { arquivo_id: 'm:<classe>:<mes>:v<N>:json', tipo: 'manifesto', caminho, sha256, bytes, conteudo_base64 }, { arquivo_id: '...:sha256', ... } ] } }`.

Erros: `409 unidades_pendentes` (`details` inclui `faltando:<tabela>:<canal>` para par esperado sem unidade), `409 resumos_pendentes` (`details`: os `canal` sem resumo recebido).

### C6. `POST unit/received` (copiador)

Permissão `archive_copy`. Informa o que foi **relido do NAS** depois do `mv`. Corpo:

```ts
{ itens: Array<{ arquivo_id: string, sha256: string, bytes: number, linhas: number | null, soma: string | null }> }  // 1..100 itens
```

`linhas` e `soma` são os relidos com o leitor de produção (numa parte, os da parte); `null` em manifesto e anexo. O par (ou o trio) de resumo de um canal vai na mesma chamada.

Resposta `200`: `{ data: { itens: Array<{ arquivo_id, resultado: 'recebida' | 'ja_recebida' | 'divergente' | 'conteudo_divergente' | 'canal_removido' | 'desconhecido' }>, selados: Array<{ classe, mes, versao }> } }`. **Só `recebida` e `ja_recebida` são bons.** `conteudo_divergente` = sha256 igual e contagem ou soma diferente. `canal_removido` (unidade ou resumo com `purged_at`): não grava; o arquivo fica para a vigia de ausência. `divergente` de mês fora do banco não volta a devida: o item vai a `aguardando_dono` (restaurar do B2). `selados` lista os meses que este informe selou (o manifesto recebido fecha o selo); um mês sela uma vez só, mesmo com dois informes simultâneos do último arquivo (um deles traz o mês em `selados`, o outro não). Unidade de par novo gravada num mês já selado o reabre (`unsealed_reason = 'unidade_nova'`) e o mês volta a `manifestos`.

### C7. `POST attest` (copiador, fonte `nas`; `conferir-b2`, fonte `b2`)

#### C7.1 `fonte: 'nas'` (permissão `archive_copy`; a `archive_b2` recebe 403)

```ts
{ fonte: 'nas', plano_id: string,
  filhos: { numerico: { montado: boolean, sentinela: boolean }, texto: { montado: boolean, sentinela: boolean } },
  canarios: Array<{ filho, dia: 'AAAA-MM-DD', sha256 }>,          // o canário do dia em cada filho (gravado nesta execução, ou relido se já existia)
  itens: Array<{ arquivo_id, resultado: 'presente' | 'ausente' | 'nas_fora' | 'ilegivel',
                 sha256?: string, bytes?: number, linhas?: number | null, soma?: string | null }> }   // 0..500 itens
```

**Toda execução do copiador manda ao menos um `attest`, com os dois canários do dia, mesmo com `itens: []`:** é o único caminho do sha256 do canário ao site, e sem ele o `conferir-b2` não chega a `controle_ok` (C2). `ausente` só com a pasta montada e a sentinela presente **no filho do arquivo**; o site confere contra `filhos` e trata como `nas_fora` o que vier de filho desmontado ou sem sentinela. **`ilegivel`**: o arquivo existe no caminho final, com a pasta montada e a sentinela, e a leitura deu erro de E/S; vai sem `sha256`, `linhas` e `soma`; o site o trata como `divergente` (volta a devida, ou `aguardando_dono` se o canal foi removido ou o mês está fora do banco) e põe `nas_ilegivel:<arquivo_id>` em `vermelhos`. `ausente` de mês fora do banco (`detached_at`/`dropped_at`) nunca volta a devida: vai a `aguardando_dono`.

**Arquivo só em `_recebendo/` (X2):** na reconferência só o caminho final conta; arquivo que só existe em `_recebendo/` é informado **`ausente`**, sem campo novo no item (o r1 dizia "conta como `presente`": verde falso, porque o arquivo não sobe ao B2 e nenhum programa o move). Em `aguardando_dono` o copiador procura nos dois lugares (caminho final e `_recebendo/`) e informa o que achou por `unit/received`.

Resposta `200`:

```ts
{ data: { itens: Array<{ arquivo_id, resposta: 'aceito' | 'recusado', motivo?: 'desconhecido' | 'filho_fora' | 'forma' }>,
          canarios: Array<{ filho, dia, resposta: 'aceito' | 'recusado', motivo?: 'sha256_diferente_no_dia' | 'dia_invalido' }> } }
```

Canário com sha256 diferente do já registrado no mesmo dia e filho: o site mantém o primeiro, responde `recusado` (`sha256_diferente_no_dia`) e põe `canario_regravado:<filho>` em `vermelhos`. **Canário `recusado` é desfecho vermelho `controle_falhou` no copiador.** O que o site concluiu dos itens (ok, `divergente`, `conteudo_divergente`, ausente) **não** volta na resposta: aparece no plano seguinte (`exportar`, `aguardando_dono`, `vermelhos`).

#### C7.2 `fonte: 'b2'` (permissão `archive_b2`; a `archive_copy` recebe 403)

```ts
{ fonte: 'b2', execucao_id: string,
  itens: Array<{ arquivo_id: string,                  // de ItemArquivo, ou 'controle_negativo', ou 'canario:numerico' | 'canario:texto'
                 resultado: 'presente' | 'ausente' | 'sem_acesso' | 'chave_ausente' | 'nao_decifra',
                 sha256?: string, bytes?: number, linhas?: number | null, soma?: string | null,
                 file_id?: string, upload_timestamp?: number,   // obrigatórios com 'presente' e 'nao_decifra' (ms desde 1970, do B2)
                 tentativa: 1 | 2 }> }                          // 2 só depois de 'repetir'; 1..200 itens por chamada
```

- **`ausente`** só quando a listagem do B2 (`b2_list_file_versions`) respondeu 200 e não trouxe o nome exato com uma versão `upload` mais nova que qualquer `hide` (versão `hide` mais nova conta como ausente; versão `start`, envio em curso, não conta como presente nem como ausente: o arquivo é informado `sem_acesso`). Qualquer outro erro, inclusive `401`, `5xx`, rede e corpo ilegível, é `sem_acesso`.
- **`nao_decifra`** (K4): o `fileId` listado foi baixado inteiro e o `rclone` não o decifrou com a chave que decifrou os canários desta execução. Exige `file_id` e `upload_timestamp`; proíbe `sha256`, `bytes`, `linhas` e `soma`. Aceito só com a execução em `controle_ok` (antes disso, `recusado` com `controle_pendente`). **O site o trata como `divergente` já no primeiro informe** (item 132; sem `repetir`): retira a atestação do B2 daquele arquivo, põe `b2_ilegivel:<arquivo_id>` em `vermelhos` e nunca grava esse `file_id` como `b2_file_id_bom`. Canário que não decifra é informado `nao_decifra` e leva a execução a `controle_falhou`.
- **Controle negativo presente:** vai com `file_id` e `upload_timestamp` da listagem e **sem** `sha256`, `bytes`, `linhas` e `soma` (a forja não baixa o que não devia existir); o site aceita a forma e responde `execucao.estado = 'controle_falhou'`.
- `file_id` no formato do B2 (`^4_z[0-9a-f]{24}_f[0-9a-f]{3}_[0-9a-z_]+$`; NÃO VERIFICADO contra o bloco 10 da M3a: a forma final sai do ledger).

Resposta `200`:

```ts
{ data: { execucao: { estado: 'aguardando_controle' | 'controle_ok' | 'controle_falhou',
                      negativo_ok: boolean, canario_ok: { numerico: boolean, texto: boolean } },
          itens: Array<{ arquivo_id, resposta: 'aceito' | 'repetir' | 'recusado',
                         motivo?: 'controle_pendente' | 'controle_falhou' | 'sem_file_id' | 'file_id_invalido' | 'desconhecido' | 'execucao_vencida' | 'forma' }> } }
```

- `repetir`: o primeiro informe `presente` diferente do registro (`divergencia_a_confirmar`). A forja baixa de novo **na mesma execução** e informa com `tentativa: 2`, uma vez. (`nao_decifra` nunca recebe `repetir`.)
- `controle_falhou`: controle negativo informado como presente, ou canário que não decifra ou não bate. Nada desta execução atesta nem retira; o desfecho da execução é `controle_falhou`.
- `canario_ok.<filho>`: o canário daquele filho foi aceito nesta execução; é o que valida `estado: nada_devido` daquele filho (C2, K1).
- Validade da execução (X1): 2 horas a partir da última página pedida (`GET plan?fonte=b2`, primeira página ou `cursor`; cada página renova o prazo, com o mesmo `execucao_id`). Depois disso, `recusado`/`execucao_vencida`; a forja pede plano novo com o cursor da última página aceita e retoma dali (C2).

### C8. `POST heartbeat` (os três programas)

Permissão: `archive_copy` (grava o trabalhador `copiador`), `archive_b2` (`conferir_b2`) ou `archive_read` (`respondedor`). **O trabalhador vem da permissão da chave, nunca do corpo.** Corpo:

```ts
{ versao: string,                                   // versão do kit (git rev curto)
  hora_maquina: string,                             // ISO com fuso
  nas_ok: boolean,
  montagens_ok: { numerico: boolean, texto: boolean },
  sentinela_ok: { numerico: boolean, texto: boolean },
  livre_bytes: { numerico: number | null, texto: number | null },   // statvfs da montagem de escrita (M3a, "Espaço do NAS"): f_bavail × f_frsize
  total_bytes: { numerico: number | null, texto: number | null },   // do mesmo statvfs: f_blocks × f_frsize; obrigatório
  parado_no_teto: 'dia' | 'mes' | null,             // só o conferir_b2 manda não nulo (P59: parou no teto de bytes); os outros, null
  ultimo_erro: string | null }                      // até 200 caracteres, sem caminho de chave
```

Resposta `200`: `{ data: { gravado: boolean, teto: 'verde' | 'ambar' | 'vermelho' | null } }` (`gravado: false` = menos de 30 s desde o último do mesmo trabalhador: nada foi gravado, e não é erro). `teto` (r2.2) só vem não nulo para o `conferir_b2`; nos outros trabalhadores é `null`.

- **Silêncio e varredura são só do copiador:** `nas_checked_at`, que mede o silêncio da casa (`02` §10.10) e abre a varredura completa, é o do batimento do trabalhador `copiador` com `nas_ok` verdadeiro (hora do banco ao receber). Batimento de `conferir_b2` e de `respondedor` grava os campos para a página e não mexe no silêncio nem na varredura.
- **Abertura da varredura no batimento:** batimento do `copiador` com `nas_ok` verdadeiro, cujo anterior com `nas_ok` verdadeiro tem mais de 24 h (ou não existe e há unidade recebida), abre a varredura (`motivo = 'silencio_nas'`, `due_since` = o `nas_checked_at` anterior, `nas_back_at` = agora) na mesma transação, antes de gravar o novo `nas_checked_at`. O `GET plan` seguinte vem `modo: completo`.
- **80% do NAS:** com `total_bytes` e `livre_bytes` do copiador, filho com `(total − livre) / total ≥ 0,8` entra em `vermelhos` como `nas_80:<filho>`.
- **Teto de bytes (r2.2, M6 do Phil): quem conta os dias seguidos é o site, pelo histórico das execuções, nunca o pulso.** O batimento do `conferir_b2` marca a execução que acabou de rodar (a mais recente do site sem batimento, começada há menos de 3 h) com a hora do banco e com o `parado_no_teto`, **também com `gravado: false`** (a marca é por execução, não por batimento). Um dia de São Paulo **estourou** quando alguma execução marcada nele parou no teto. Pelo último dia com execução marcada: não estourou → `verde`; estourou e o dia anterior também → `vermelho`; estourou sozinho → `ambar`. Fronteira: dia 1 com estouro `ambar`, dia 2 seguido `vermelho`, o dia seguinte sem estouro volta a `verde`. A resposta do batimento devolve essa cor em `teto`; `vermelho` também entra em `vermelhos` como `b2_teto_2_dias`; a página mostra "teto de bytes" em âmbar ou vermelho pela mesma cor.

### C9. Desfechos que o site espera ver no registro da forja

Não é rota; é o que o pulso e a página leem (M3a, "Interfaces registradas"). Desfechos vermelhos: `arquivo_desligado` (503), `plano_invalido`, `nas_fora`, `nas_cheio`, `nas_ilegivel`, `controle_falhou`, `chave_ausente`, `chave`, `desligado`, `sem_acesso`, `incompleto`, `informe_recusado`, `unidade_falhou`, `site_fora`, `bug`, `remoto_nao_b2`, `timeout`. `teto_bytes` (r2.2, M6 do Phil): **âmbar no primeiro dia em que o teto estoura, vermelho no segundo dia seguido**, contados pelo site (C8); o kit grava na linha a cor que o batimento devolveu (`teto_cor`), e o bloco do B2 no pulso fica verde com `teto_bytes` só quando `teto_cor` é `ambar` (vermelho com `vermelho`, ou sem cor: batimento que falhou). `nas_quase_cheio` **não é desfecho** (X4): o kit não o emite; o site calcula os 80% a partir de `total_bytes` e `livre_bytes` do batimento do copiador (C8) e põe `nas_80:<filho>` em `vermelhos`. Para o pulso, todo desfecho fora de `ok` é vermelho, exceto `teto_bytes` com `teto_cor: 'ambar'`.
**Estados vindos do site, nunca deduzidos:** `aguardando_primeira_selagem` e `nada_devido` vêm do campo `estado` do plano do B2, por filho (C2); `nada_devido` só é verde com `canario_ok` do mesmo filho na mesma execução (K1). O copiador continua lendo `primeira_selagem: null` do C1 para o seu `estado: "aguardando_primeira_selagem"`.

### C10. Fora da M3b (reservado)

`POST request/claim`, `progress`, `result`, `fail` (respondedor, `archive_read`): M7. `prefixos_ausentes`, `prefixo_ausente`/`prefixo_presente` em `attest`: M9 (na M3b o `attest` recusa esses resultados com `400 VALIDATION_ERROR`).

### C11. Leitura para o `pode-desligar` (comando do Mac, M3b-forja)

A M3b entrega, para o comando, a função só de leitura `public.obs_archive_pode_desligar(p_site uuid) returns jsonb`, chamada pela conexão direta do dono (`OBS_ARQUIVO_DB_URL`): `{ "pode": boolean, "faltam": [ { "motivo": "automatico_armado" | "mes_nao_recebido" | "b2_vencido_mes_fora", "classe", "tabela", "mes", "detalhe" } ] }`. `pode` só é verdadeiro com `faltam` vazio; erro de leitura é erro do comando, nunca "pode desligar". Os arquivos de um mês são os de `obs_archive_month_files` (partes no lugar da unidade em partes; sem unidade vazia nem resumo vazio).

## Estrutura de arquivos

| Arquivo | Tarefa | Responsabilidade |
|---|---|---|
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts` (criar) | 1 | listas fechadas (classes, filhos, tabelas, coluna de controle, reservados), esquemas Zod dos corpos e das respostas, códigos |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/caminho.ts` (criar) | 1 | construtor de caminho e de `arquivo_id`, os dois validados contra as listas |
| `apps/web/test/youtube/observatorio/arquivo-mensal-contrato.test.ts` (criar) | 1 | itens 131 (caminho), 158 (reservados), regex dos ids |
| `apps/web/src/lib/youtube/observatorio/arquivo/exportar.ts` (modificar) | 2 | `exportarUnidade` (pedido 2); `exportarCanal` vira o laço sobre ela |
| `apps/web/src/lib/youtube/observatorio/arquivo/sessao.ts` (modificar) | 2 | `lerLinhasDoBanco` (a fonte do cursor); `lerCsvDoBanco` fica para a conferência |
| `apps/web/test/youtube/observatorio/arquivo-unidade.test.ts` (criar) | 2 | contrato de `exportarUnidade`; identidade de bytes com o caminho antigo |
| `apps/web/test/fixtures/arquivo-mensal/ouro-*.csv.gz`, `ouro.json` (criar) | 2 | fixtures de ouro (item 19) que o kit da forja copia para o teste do leitor Python (item 20) |
| `supabase/sql/obs-archive-hash.sql` (criar) | 4 | o corpo único de `obs_archive_content_hash`, `obs_archive_schema_fp` e `obs_archive_read_unit` |
| `supabase/rascunhos/m3b.sql` (criar; `git rm` na Tarefa 10) | 3 a 8 | o SQL da migration, em seis partes marcadas (`-- M3B PARTE n`) |
| `supabase/migrations/<ts>_manutencao_m3b_arquivo.sql` (criar na Tarefa 10) | 10 | o mesmo SQL |
| `apps/web/test/helpers/m3b.ts` (criar) | 3 | `M3B_SQL_CAMINHO`, `M3B_EM_MIGRATION`, `m3bNoBanco()`, `aplicarM3b(pg, ate?)`, sementes de canal e de série |
| `apps/web/test/manutencao/migrations-leitura.test.ts` (modificar, da M2) | 3 | TRAVA M3b-1; item 119 com a definição desta fase; D17 (corpo dos hashes) |
| `apps/web/test/integration/manutencao-m3b-registro.test.ts` (criar) | 3 | catálogo do registro, RLS, sem FK, índices P36, chave com a classe (131), gatilho classe/tabela |
| `apps/web/test/integration/manutencao-m3b-leitor.test.ts` (criar) | 4 | itens 22 (parte SQL), 75, 131 (as duas classes do bruto), mês da conversa |
| `apps/web/test/integration/manutencao-m3b-selagem.test.ts` (criar) | 5 | itens 23, 26, 31, 76, 77, 78, 158 (resumo e selo), corrida da gravação, P56 |
| `apps/web/test/integration/manutencao-m3b-b2.test.ts` (criar) | 6 | itens 132 e 133 (lado do site), canário do 134 |
| `apps/web/test/integration/manutencao-m3b-plano.test.ts` (criar) | 7 | itens 28, 134 (`vermelhos`), 172, `primeira_selagem`, `pode_desligar` |
| `apps/web/test/integration/manutencao-m3b-remocao.test.ts` (criar) | 8 | itens 159, 160, 165 (função), P51 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-remocao.ts` (criar) | 9 | P38: o estado e a cor da remoção, puros sobre a linha e o relógio |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts` (criar) | 9 | P54: `OBS_ARQUIVO_LIMPEZA_CANAL`, `_DATA` e a constante do bloco, só servidor |
| `apps/web/test/youtube/observatorio/arquivo-mensal-estado.test.ts` (criar) | 9 | relógio falso nos dois lados de cada limiar; variáveis apagadas |
| `apps/web/src/lib/pipeline/auth.ts` (modificar), `apps/web/test/lib/pipeline/auth-arquivo.test.ts` (criar) | 9a | chave só `archive_*` recusada fora de `/api/pipeline/archive/` (K2) |
| `apps/web/test/lib/pipeline/api-registry.test.ts`, `apps/web/test/mcp/mcp-registry-sync.test.ts` (modificar) | 11 | 9 domínios; a conta passa a valor do dia + 7; as rotas do arquivo nunca viram ferramenta MCP |
| `docs/ops/env-vars.md` (modificar) | 14 | as três variáveis `OBS_ARQUIVO*` |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco.ts` (criar) | 11 | a fonte pelo leitor único (chamadas por posição, 3 tentativas, partes) |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/resumo.ts`, `manifesto-mensal.ts` (criar) | 11 | CSV do resumo por canal; JSON e `.sha256` do manifesto |
| `apps/web/src/lib/pipeline/archive-auth.ts` (criar) | 11 | `authenticateArchive(req, permissao)` e `arquivoLigado()` |
| `apps/web/src/app/api/pipeline/archive/{plan,unit/export,month/summary,month/manifest,unit/received,attest,heartbeat}/route.ts` (criar) | 11 | as sete rotas |
| `apps/web/src/lib/pipeline/api-registry.ts`, `leitura-rotas.ts` (modificar) | 11 | domínio `archive`; padrões das rotas |
| `apps/web/data/pipeline-docs/cowork-docs-archive.md` (criar) | 11 | códigos e estados, rota a rota |
| `apps/web/test/api/pipeline-archive.test.ts` (criar) | 11 | permissões, `OBS_ARQUIVO`, valor esperado nunca devolvido, envelope |
| `apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts` (modificar) | 12 | `removeCompetitorChannel` chama `competitor_channel_remove` |
| `apps/web/src/lib/youtube/competitor-removal-impact.ts`, `_canais/remove-dialog.tsx` (modificar) | 12 | o que o diálogo diz do arquivo |
| `apps/web/src/lib/youtube/agenda/arquivo-mensal.ts` (criar), `saude.ts`, `apps/web/src/lib/ops/cron-health-report.ts` (modificar) | 13 | atraso de cópia e as quatro vigias da remoção no relatório |
| `docs/ops/runbook-arquivo-mensal.md` (criar) | 14 | consulta do item 80, consultas 5 e 6 do item 160, volta atrás do gatilho (P47) |

---

### Task 0: leituras do dia e o aviso à A5 (sem código)

**Files:** só disco: `.superpowers/sdd/manutencao-nas/m3b-site-progresso.md` (ledger, criar), `.superpowers/sdd/manutencao-nas/aviso-a5-e10-pedido-2.md` (criar), `.superpowers/sdd/manutencao-nas/m3b/m3b-0-leituras-prod.sh` (criar).

**O que acontece quando o dado não existe:** cada leitura que volta vazia é registrada como "ausente" no ledger e muda uma decisão nomeada abaixo; nenhuma é tratada como "ok".

- [ ] **Passo 1. Gatilho da E10.** Rodar e guardar a saída no ledger:

```bash
cd ~/Workspace/bythiagofigueiredo && git log -1 --format='%h %cI' staging && \
grep -rn "export async function exportarUnidade\|export function exportarUnidade" apps/web/src/lib/youtube/observatorio/arquivo/ ; \
ls apps/web/src/lib/youtube/observatorio/arquivo/csv.ts apps/web/src/lib/youtube/observatorio/arquivo/manifesto.ts
```

Esperado em 14/10: `csv.ts` e `manifesto.ts` existem; `exportarUnidade` não. **Se `exportarUnidade` já existir** (a E10 entregou o pedido 2): a Tarefa 2 vira só a conferência do contrato (passos 1 e 5) e o aviso do Passo 2 não é enviado. **Se `csv.ts` ou `manifesto.ts` não existirem:** parar e avisar o controlador (o gatilho inteiro do `05` §15.1 passa a valer, e este plano precisa da tarefa que os cria).

- [ ] **Passo 2. O aviso à A5** (só se `exportarUnidade` não existe). Gravar `.superpowers/sdd/manutencao-nas/aviso-a5-e10-pedido-2.md` com o texto abaixo e entregar ao controlador da A5 **no mesmo dia** (o controlador desta fase leva o arquivo; registrar data e hora no ledger):

```markdown
# Aviso à A5 (E10): o pedido 2 passa a ser implementado pela fase de manutenção

Em <data>, a M3b da fase de manutenção começou e `exportarUnidade` não estava no `staging`.
Pelo gatilho do spec da manutenção (`05` §15.1), a fase implementa AGORA, em `apps/web/src/lib/youtube/observatorio/arquivo/exportar.ts`:
`exportarUnidade(fonte, disco, { tabela, canal, de, ate, rotulo })`, com `fonte = { ler(): Promise<{ colunas, linhas, contagem, soma }> }`,
e `exportarCanal` passa a ser o laço sobre ela, sem mudança de comportamento (os testes da E10 continuam passando sem edição).
A partir deste aviso, a trilha da E10 NÃO implementa o pedido 2: consome a função. `csv.ts` e `manifesto.ts` continuam da E10.
Commit da fase: <hash da Tarefa 2>.
```

- [ ] **Passo 3. Dependências de produção** (TRAVA M3b-0): ler no ledger da M2 a linha "TRAVA M2-2 solta" e no da M10a a linha equivalente; copiar as duas para o ledger da M3b. Sem as duas, as Tarefas 1 a 9 seguem e a 10 espera.

- [ ] **Passo 4. Leituras de produção, pelo dono** (leitura de produção é negada no modo automático: memória `reference_controlador_muitos_agentes.md`). Gravar `.superpowers/sdd/manutencao-nas/m3b/m3b-0-leituras-prod.sh`:

```bash
#!/bin/bash
# M3b, Tarefa 0: leituras de produção, só leitura. Uso: bash .superpowers/sdd/manutencao-nas/m3b/m3b-0-leituras-prod.sh
set -u
cd ~/Workspace/bythiagofigueiredo || exit 1
S=.superpowers/sdd/manutencao-nas/saidas/m3b-0-$(date +%Y-%m-%d-%H%M).txt
{
echo "== obs_archive_is_site_admin existe? (vazio = não)"
npx supabase db query --linked "select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'obs_archive_is_site_admin';"
echo "== default do id de competitor_channels (P1)"
npx supabase db query --linked "select column_default from information_schema.columns where table_schema = 'public' and table_name = 'competitor_channels' and column_name = 'id';"
echo "== max_rows da API (CP4)"
npx supabase db query --linked "select rolname, rolconfig from pg_roles where rolname in ('authenticator', 'service_role', 'postgres');"
echo "== canais por site, e a primeira linha de cada série (D13)"
npx supabase db query --linked "select site_id, count(*) from public.competitor_channels group by 1;"
npx supabase db query --linked "select 'daily' t, min(snap_date)::text from public.competitor_video_daily union all select 'hourly', min(hour_slot)::text from public.competitor_video_hourly union all select 'early', min(taken_at)::text from public.competitor_video_early union all select 'comments', min(first_seen_at)::text from public.competitor_video_comments;"
echo "== canais sem added_at (D14: nulo conta como antigo) e cadastrados antes de 01/11 (C da conferência do dia)"
npx supabase db query --linked "select count(*) filter (where added_at is null) sem_data, count(*) filter (where coalesce(added_at, '-infinity'::timestamptz) < '2026-11-01 00:00-03') antes_de_nov, count(*) total from public.competitor_channels;"
echo "== maior unidade horária e de comentários (CP13, D25)"
npx supabase db query --linked "select 'hourly', max(n) from (select v.competitor_channel_id, date_trunc('month', h.hour_slot), count(*) n from public.competitor_video_hourly h join public.competitor_videos v on v.id = h.video_id group by 1, 2) x union all select 'comments', max(n) from (select competitor_channel_id, date_trunc('month', first_seen_at), count(*) n from public.competitor_video_comments group by 1, 2) y;"
} > "$S" 2>&1
echo "saída em $S"
```

Linha que o dono roda: `bash .superpowers/sdd/manutencao-nas/m3b/m3b-0-leituras-prod.sh`. **Regras:** `obs_archive_is_site_admin` presente → a parte 1 do SQL mantém o `create or replace` com a mesma assinatura (`p_site uuid, p_user uuid`) e o teste do item 119 continua valendo; `column_default` diferente de `gen_random_uuid()` → parar (D3 cai) e voltar ao controlador; `statement_timeout` de `authenticator` diferente de `8s` → refazer a conta do teto por chamada (Passo 5); `sem_data` maior que zero → registrar (esses canais contam como antigos, D14); a maior unidade horária e de comentários entra na CP13 (Passo 5).

- [ ] **Passo 5. CP13 no banco local** (fixa `TETO_LINHAS_POR_CHAMADA`). Depois da Tarefa 4, com 75 canais sintéticos × 31 dias × 50 vídeos na diária do `bythiago_int`, medir em `psql -p 54422` com `\timing` uma chamada de `obs_archive_read_unit` com `p_limit` 2.000, 5.000 e 10.000, e um `obs_archive_content_hash` de unidade de 1.550 linhas. Medir também a leitura completa (`lerUnidadeInteira`, todas as páginas) de uma unidade sintética do tamanho da **maior unidade horária e da maior de comentários vistas em produção (Passo 4) multiplicadas por 3**, com linhas de largura parecida (~110 B na horária, ~320 B em comentários). Regras: o maior `p_limit` cuja chamada fica abaixo de 3 s (metade do teto de 8 s, com folga para a rede) vira `TETO_LINHAS_POR_CHAMADA` em `contrato.ts`; o maior número de linhas cuja leitura completa fica abaixo de 30 s (metade do `maxDuration = 60`) vira `TETO_LINHAS_DA_UNIDADE` (D25); registrar os números no ledger. Até a medida, os valores são 2.000 e 60.000 (NÃO MEDIDOS; Yannis mediu 72 ms por página de 2.000 com 40 mil linhas estreitas e 349 ms com 100 mil linhas de 320 B). **Dívida declarada (I9 do Yannis):** cada página recalcula o hash da unidade inteira (`02` §9.3), e a leitura completa custa O(N²/L). Separar o hash da página (conferir `content_hash` antes da primeira e depois da última) muda o spec e passa pelo dono; gatilho: CP13 com uma chamada acima de 1 s, ou a leitura da maior unidade × 3 acima de 30 s.

- [ ] **Passo 6. CP24 (P59, Pedido 3).** O agente lê a página de preços do Backblaze (saída de dados gratuita: o múltiplo do guardado por mês, e se vale por conta ou por bucket) e grava no ledger a frase lida, a data e a URL. O valor entra em `obs_archive_b2_franquia_mes()` (Tarefa 6) antes da Tarefa 10; sem a leitura, fica o valor provisório da Tarefa 6, marcado NÃO VERIFICADO, e o teto do mês pode estar errado nos dois sentidos (ledger e controlador avisados).

---

### Task 1: o contrato em TypeScript puro

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts`
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/caminho.ts`
- Create: `apps/web/test/youtube/observatorio/arquivo-mensal-contrato.test.ts`

**Interfaces:**
- Produces: `CLASSES`, `type Classe`, `type Filho`, `FILHO_DA_CLASSE`, `TABELAS_DA_CLASSE`, `COLUNA_DE_CONTROLE`, `RESERVADOS`, `TETO_LINHAS_POR_CHAMADA`, `TETO_LINHAS_DA_UNIDADE`, `TETO_BYTES_POR_PARTE`, `parDaPolitica`, `CorpoExportar`, `CorpoResumo`, `CorpoManifesto`, `CorpoRecebido`, `CorpoAtestar` (união por `fonte`), `CorpoBatimento`, `ItemArquivo`, `RespostaPlano`, `RespostaPlanoB2`, `RespostaBatimento` (r2.2), `RespostaAtestarNas`, `RespostaAtestarB2`, `RespostaParteInfo`, `RespostaRecord`, `CODIGOS`, `STATUS_DO_CODIGO`; `caminhoDaUnidade`, `caminhoDaParte`, `caminhoDoResumo`, `caminhoDoManifesto`, `caminhoDoAnexo`, `caminhoDoCanario`, `idDaUnidade`, `idDaParte`, `idDoResumo`, `idDoManifesto`, `lerArquivoId`. Consumido pelas Tarefas 11 a 13 e, como texto, pelo kit da forja.

**O que acontece quando o dado não existe:** classe ou tabela fora das listas, uuid malformado, mês fora de `AAAA-MM`, versão fora de 1..9999: o construtor **lança** (`CaminhoInvalido`), nunca monta caminho parcial.

- [ ] **Passo 1. Teste, falhando** (o módulo não existe):

```ts
// apps/web/test/youtube/observatorio/arquivo-mensal-contrato.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  CLASSES, TABELAS_DA_CLASSE, FILHO_DA_CLASSE, RESERVADOS, COLUNA_DE_CONTROLE, CorpoExportar, CorpoAtestar, CorpoBatimento,
  RespostaPlanoB2, RespostaBatimento, parDaPolitica, MES_RE,
} from '@/lib/youtube/observatorio/arquivo-mensal/contrato'
import {
  caminhoDaUnidade, caminhoDaParte, caminhoDoResumo, caminhoDoManifesto, caminhoDoCanario, idDaParte, idDoManifesto, lerArquivoId,
  CaminhoInvalido,
} from '@/lib/youtube/observatorio/arquivo-mensal/caminho'

const CANAL = '0b8f7a52-3c1e-4d2a-9f00-1234567890ab'

describe('arquivo mensal: contrato e caminhos (itens 131 e 158)', () => {
  it('a classe é o primeiro nível e o canal vem logo abaixo dela', () => {
    expect(caminhoDaUnidade({ classe: 'serie', canal: CANAL, tabela: 'competitor_video_daily', mes: '2026-10', versao: 1 }))
      .toBe(`serie/canais/${CANAL}/competitor_video_daily/2026-10.v1.csv.gz`)
  })
  it('o bruto nas duas classes gera dois caminhos diferentes, em filhos diferentes só quando a classe pede', () => {
    const a = caminhoDaUnidade({ classe: 'texto', canal: CANAL, tabela: 'competitor_raw', mes: '2026-12', versao: 1 })
    const b = caminhoDaUnidade({ classe: 'video_antigo', canal: CANAL, tabela: 'competitor_raw', mes: '2026-12', versao: 1 })
    expect(a).not.toBe(b)
    expect(FILHO_DA_CLASSE.texto).toBe('texto')
    expect(FILHO_DA_CLASSE.video_antigo).toBe('texto')
  })
  it('parte, resumo, manifesto e canário', () => {
    expect(caminhoDaParte({ classe: 'horaria', canal: CANAL, tabela: 'competitor_video_hourly', mes: '2026-11', versao: 2, parte: 3 }))
      .toBe(`horaria/canais/${CANAL}/competitor_video_hourly/2026-11.v2.p03.csv.gz`)
    expect(caminhoDoResumo({ classe: 'serie', canal: CANAL, mes: '2026-10', versao: 1, papel: 'video' }))
      .toBe(`serie/canais/${CANAL}/resumo/2026-10.v1.video.csv.gz`)
    expect(caminhoDoManifesto({ classe: 'serie', mes: '2026-10', versao: 1, papel: 'sha256' })).toBe('serie/manifestos/2026-10.v1.sha256')
    expect(caminhoDoCanario('2026-11-28')).toBe('_canario/2026-11-28')
  })
  it('a ficha só existe na classe video_antigo', () => {
    expect(() => caminhoDoResumo({ classe: 'serie', canal: CANAL, mes: '2026-10', versao: 1, papel: 'ficha' })).toThrow(CaminhoInvalido)
  })
  it('nenhuma classe e nenhuma tabela usa nome reservado', () => {
    const tabelas = Object.values(TABELAS_DA_CLASSE).flat()
    for (const r of RESERVADOS) {
      expect(CLASSES as readonly string[]).not.toContain(r)
      expect(tabelas).not.toContain(r)
    }
  })
  it('valor fora das listas lança, nunca monta caminho', () => {
    expect(() => caminhoDaUnidade({ classe: 'serie', canal: CANAL, tabela: 'competitor_raw', mes: '2026-10', versao: 1 })).toThrow(CaminhoInvalido)
    expect(() => caminhoDaUnidade({ classe: 'serie', canal: '../x', tabela: 'competitor_video_daily', mes: '2026-10', versao: 1 })).toThrow(CaminhoInvalido)
    expect(() => caminhoDaUnidade({ classe: 'serie', canal: CANAL, tabela: 'competitor_video_daily', mes: '2026-13', versao: 1 })).toThrow(CaminhoInvalido)
    expect(() => caminhoDaUnidade({ classe: 'serie', canal: CANAL, tabela: 'competitor_video_daily', mes: '2026-10', versao: 0 })).toThrow(CaminhoInvalido)
  })
  it('ids: forma, ida e volta', () => {
    expect(idDaParte(CANAL, 7)).toBe(`p:${CANAL}:07`)
    expect(idDoManifesto('texto', '2026-11', 3, 'json')).toBe('m:texto:2026-11:v3:json')
    expect(lerArquivoId(`s:${CANAL}:canal`)).toEqual({ tipo: 'resumo', id: CANAL, papel: 'canal' })
    expect(lerArquivoId('m:texto:2026-11:v3:sha256')).toEqual({ tipo: 'manifesto', classe: 'texto', mes: '2026-11', versao: 3, papel: 'sha256' })
    expect(lerArquivoId('x:1')).toBeNull()
  })
  it('coluna de controle igual à da E10', () => {
    expect(COLUNA_DE_CONTROLE.competitor_video_daily).toBe('views')
    expect(COLUNA_DE_CONTROLE.competitor_video_comment_marks).toBe('likes')
    expect(COLUNA_DE_CONTROLE.competitor_raw).toBeNull()
  })
  it('par (classe, tabela) fora da política: o Zod aceita a forma, a regra recusa (a rota responde 422, nunca 400)', () => {
    expect(CorpoExportar.safeParse({ classe: 'serie', tabela: 'competitor_raw', canal: CANAL, mes: '2026-10' }).success).toBe(true)
    expect(parDaPolitica({ classe: 'serie', tabela: 'competitor_raw' })).toBe(false)
    expect(parDaPolitica({ classe: 'texto', tabela: 'competitor_raw' })).toBe(true)
  })
  it('mês fora de 20xx recusa (o ::date do banco daria 500)', () => {
    expect(MES_RE.test('0000-01')).toBe(false)
    expect(MES_RE.test('2026-10')).toBe(true)
  })
  it('atestar do B2 com presente exige file_id e upload_timestamp; prefixo_* não existe na M3b', () => {
    const base = { fonte: 'b2', execucao_id: CANAL, itens: [{ arquivo_id: `u:${CANAL}`, resultado: 'presente', sha256: 'a'.repeat(64), bytes: 1, linhas: 1, soma: '1', tentativa: 1 }] }
    expect(CorpoAtestar.safeParse(base).success).toBe(false)
    expect(CorpoAtestar.safeParse({ ...base, itens: [{ ...base.itens[0], file_id: '4_zabc', upload_timestamp: 1 }] }).success).toBe(true)
    expect(CorpoAtestar.safeParse({ ...base, itens: [{ arquivo_id: 'x', resultado: 'prefixo_ausente', tentativa: 1 }] }).success).toBe(false)
  })
  it('nao_decifra (K4): exige file_id e upload_timestamp, proíbe sha256', () => {
    const it0 = { arquivo_id: `u:${CANAL}`, resultado: 'nao_decifra', file_id: '4_zabc', upload_timestamp: 1, tentativa: 1 }
    expect(CorpoAtestar.safeParse({ fonte: 'b2', execucao_id: CANAL, itens: [it0] }).success).toBe(true)
    expect(CorpoAtestar.safeParse({ fonte: 'b2', execucao_id: CANAL, itens: [{ ...it0, sha256: 'a'.repeat(64) }] }).success).toBe(false)
    expect(CorpoAtestar.safeParse({ fonte: 'b2', execucao_id: CANAL, itens: [{ ...it0, file_id: undefined }] }).success).toBe(false)
  })
  it('controle negativo presente vai com file_id e sem sha256 (Pedido 10)', () => {
    const neg = { arquivo_id: 'controle_negativo', resultado: 'presente', file_id: '4_zabc', upload_timestamp: 1, tentativa: 1 }
    expect(CorpoAtestar.safeParse({ fonte: 'b2', execucao_id: CANAL, itens: [neg] }).success).toBe(true)
    expect(CorpoAtestar.safeParse({ fonte: 'b2', execucao_id: CANAL, itens: [{ ...neg, sha256: 'a'.repeat(64), bytes: 1 }] }).success).toBe(false)
  })
  it('attest do B2: 1..200 itens', () => {
    const item = { arquivo_id: `u:${CANAL}`, resultado: 'ausente', tentativa: 1 }
    expect(CorpoAtestar.safeParse({ fonte: 'b2', execucao_id: CANAL, itens: Array(201).fill(item) }).success).toBe(false)
    expect(CorpoAtestar.safeParse({ fonte: 'b2', execucao_id: CANAL, itens: [] }).success).toBe(false)
  })
  it('ilegivel no NAS (K4): sem sha256, linhas e soma', () => {
    const nas = { fonte: 'nas', plano_id: CANAL, filhos: { numerico: { montado: true, sentinela: true }, texto: { montado: true, sentinela: true } }, canarios: [] }
    expect(CorpoAtestar.safeParse({ ...nas, itens: [{ arquivo_id: `u:${CANAL}`, resultado: 'ilegivel' }] }).success).toBe(true)
    expect(CorpoAtestar.safeParse({ ...nas, itens: [{ arquivo_id: `u:${CANAL}`, resultado: 'ilegivel', sha256: 'a'.repeat(64), bytes: 1 }] }).success).toBe(false)
  })
  it('batimento exige total_bytes e aceita parado_no_teto', () => {
    const b = { versao: 'abc1234', hora_maquina: '2026-11-28T03:17:00-03:00', nas_ok: true, montagens_ok: { numerico: true, texto: true },
      sentinela_ok: { numerico: true, texto: true }, livre_bytes: { numerico: 10, texto: 10 }, parado_no_teto: null, ultimo_erro: null }
    expect(CorpoBatimento.safeParse(b).success).toBe(false)
    expect(CorpoBatimento.safeParse({ ...b, total_bytes: { numerico: 100, texto: 100 } }).success).toBe(true)
  })
  it('plano do B2: estado por filho e dois canários, caminho nulo aceito (K1, Pedido 8)', () => {
    const r = RespostaPlanoB2.safeParse({ execucao_id: CANAL, gerado_em: '2026-11-30T14:07:00Z', modo: 'normal', cursor_seguinte: null,
      primeira_selagem: '2026-10', vermelhos: [], estado: { numerico: 'nada_devido', texto: 'aguardando_primeira_selagem' },
      teto_bytes_dia: 6e9, teto_bytes_mes: 5e10, controle_negativo: { arquivo_id: 'controle_negativo', filho: 'numerico', caminho: '_canario/x-nao-existe' },
      canarios: [{ arquivo_id: 'canario:numerico', filho: 'numerico', caminho: '_canario/2026-11-29' }, { arquivo_id: 'canario:texto', filho: 'texto', caminho: null }],
      arquivos: [], prefixos_ausentes: [], retomado_de: null, cobertura: null })
    expect(r.success).toBe(true)
  })
  it('plano do B2: retomado_de e cobertura (r2.2, I3 do Phil)', () => {
    const base = { execucao_id: CANAL, gerado_em: '2026-11-30T14:07:00Z', cursor_seguinte: null, primeira_selagem: '2026-10', vermelhos: [],
      estado: { numerico: 'com_pedidos', texto: 'com_pedidos' }, teto_bytes_dia: 6e9, teto_bytes_mes: 5e10,
      controle_negativo: { arquivo_id: 'controle_negativo', filho: 'numerico', caminho: '_controle/x' },
      canarios: [{ arquivo_id: 'canario:numerico', filho: 'numerico', caminho: null }, { arquivo_id: 'canario:texto', filho: 'texto', caminho: null }],
      arquivos: [], prefixos_ausentes: [] }
    const cur = `${CANAL}|u:${CANAL}`
    expect(RespostaPlanoB2.safeParse({ ...base, modo: 'completo', retomado_de: cur, cobertura: { paginas_aceitas: 3, paginas_total: 5 } }).success).toBe(true)
    expect(RespostaPlanoB2.safeParse({ ...base, modo: 'completo', retomado_de: null, cobertura: { paginas_aceitas: 0, paginas_total: 1 } }).success).toBe(true)
    expect(RespostaPlanoB2.safeParse({ ...base, modo: 'completo', retomado_de: null, cobertura: null }).success).toBe(false)          // completo sem cobertura
    expect(RespostaPlanoB2.safeParse({ ...base, modo: 'completo', retomado_de: null, cobertura: { paginas_aceitas: 6, paginas_total: 5 } }).success).toBe(false)
    expect(RespostaPlanoB2.safeParse({ ...base, modo: 'completo', retomado_de: null, cobertura: { paginas_aceitas: 0, paginas_total: 0 } }).success).toBe(false)
    expect(RespostaPlanoB2.safeParse({ ...base, modo: 'normal', retomado_de: cur, cobertura: null }).success).toBe(false)              // normal nunca retoma
    expect(RespostaPlanoB2.safeParse({ ...base, modo: 'normal', retomado_de: null, cobertura: { paginas_aceitas: 0, paginas_total: 1 } }).success).toBe(false)
    expect(RespostaPlanoB2.safeParse({ ...base, modo: 'normal', cobertura: null }).success).toBe(false)                                 // campo ausente
  })
  it('batimento: a cor do teto só nas três cores, ou nula (r2.2, M6 do Phil)', () => {
    for (const teto of ['verde', 'ambar', 'vermelho', null]) expect(RespostaBatimento.safeParse({ gravado: false, teto }).success).toBe(true)
    expect(RespostaBatimento.safeParse({ gravado: true, teto: 'amarelo' }).success).toBe(false)
    expect(RespostaBatimento.safeParse({ gravado: true }).success).toBe(false)
  })
})
```

Run: `npx vitest run apps/web/test/youtube/observatorio/arquivo-mensal-contrato.test.ts` → FAIL (módulo ausente).

- [ ] **Passo 2. `contrato.ts`:**

```ts
// apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts
/**
 * Manutenção M3b: o contrato das rotas /api/pipeline/archive/ (plano M3b-site, seção "Contrato das rotas"). Puro: só `zod`.
 * As listas fechadas são as da política do banco (`obs_archive_policy()`); um teste de integração (Tarefa 3) as compara.
 */
import { z } from 'zod'

export const CLASSES = ['horaria', 'serie', 'texto', 'video_antigo', 'ensaio'] as const
export type Classe = (typeof CLASSES)[number]
export type Filho = 'numerico' | 'texto'
export const FILHO_DA_CLASSE: Readonly<Record<Classe, Filho>> = {
  horaria: 'numerico', serie: 'numerico', ensaio: 'numerico', texto: 'texto', video_antigo: 'texto',
}
export const TABELAS_DA_CLASSE: Readonly<Record<Classe, readonly string[]>> = {
  horaria: ['competitor_video_hourly'],
  serie: ['competitor_video_daily', 'competitor_video_early'],
  texto: ['competitor_video_comments', 'competitor_video_comment_marks', 'competitor_raw'],
  ensaio: ['obs_archive_rehearsal'],
  video_antigo: [
    'competitor_video_versions', 'competitor_field_versions', 'competitor_raw', 'competitor_video_tier_spans',
    'competitor_video_comment_snaps', 'competitor_hour_fold_log', 'competitor_changes', 'competitor_readings',
  ],
}
export const COLUNA_DE_CONTROLE: Readonly<Record<string, string | null>> = {
  competitor_video_hourly: 'views', competitor_video_daily: 'views', competitor_video_early: 'views', obs_archive_rehearsal: 'views',
  competitor_video_comment_marks: 'likes',
  competitor_video_comments: null, competitor_raw: null, competitor_video_versions: null, competitor_field_versions: null,
  competitor_video_tier_spans: null, competitor_video_comment_snaps: null, competitor_hour_fold_log: null, competitor_changes: null,
  competitor_readings: null,
}
export const RESERVADOS = ['_recebendo', '_canario', 'canais', 'resumo', 'miniaturas', 'manifestos'] as const
/** CP13 (Tarefa 0, Passo 5). NÃO MEDIDO até lá. */
export const TETO_LINHAS_POR_CHAMADA = 2_000
/** CP13 (D25): acima disto, 413 grande_demais antes de ler qualquer página. NÃO MEDIDO até a Tarefa 0, Passo 5. */
export const TETO_LINHAS_DA_UNIDADE = 60_000
export const TETO_BYTES_POR_PARTE = 3 * 1024 * 1024
export const TETO_PARTES = 99
export const TENTATIVAS_DE_LEITURA = 3

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const MES_RE = /^20\d{2}-(0[1-9]|1[0-2])$/
export const DIA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
export const SHA_RE = /^[0-9a-f]{64}$/
export const SOMA_RE = /^-?\d{1,40}$/

const classe = z.enum(CLASSES)
const canal = z.string().regex(UUID_RE)
const mes = z.string().regex(MES_RE)
const sha = z.string().regex(SHA_RE)
const soma = z.string().regex(SOMA_RE).nullable()
const arquivoId = z.string().min(3).max(120)
/** Fora do Zod de propósito: o `refine` viraria 400 VALIDATION_ERROR, e o contrato promete 422 classe_tabela_invalida (C0, C3). A rota chama depois do parseBody. */
export const parDaPolitica = (o: { classe: Classe; tabela: string }): boolean => TABELAS_DA_CLASSE[o.classe].includes(o.tabela)

export const CorpoExportar = z.object({
  classe, tabela: z.string().min(1).max(63), canal, mes, parte: z.number().int().min(1).max(TETO_PARTES).optional(),
}).strict()
export const CorpoResumo = z.object({ classe, canal, mes }).strict()
export const CorpoManifesto = z.object({ classe, mes }).strict()
export const CorpoRecebido = z.object({
  itens: z.array(z.object({
    arquivo_id: arquivoId, sha256: sha, bytes: z.number().int().min(0), linhas: z.number().int().min(0).nullable(), soma,
  }).strict()).min(1).max(100),
}).strict()

const estadoDoFilho = z.object({ montado: z.boolean(), sentinela: z.boolean() }).strict()
const AtestarNas = z.object({
  fonte: z.literal('nas'), plano_id: canal,
  filhos: z.object({ numerico: estadoDoFilho, texto: estadoDoFilho }).strict(),
  canarios: z.array(z.object({ filho: z.enum(['numerico', 'texto']), dia: z.string().regex(DIA_RE), sha256: sha }).strict()).max(2),
  itens: z.array(z.object({
    arquivo_id: arquivoId, resultado: z.enum(['presente', 'ausente', 'nas_fora', 'ilegivel']),
    sha256: sha.optional(), bytes: z.number().int().min(0).optional(), linhas: z.number().int().min(0).nullable().optional(), soma: soma.optional(),
  }).strict()
    .refine(i => i.resultado !== 'presente' || (i.sha256 !== undefined && i.bytes !== undefined), { message: 'presente_sem_valores' })
    .refine(i => i.resultado !== 'ilegivel' || (i.sha256 === undefined && i.bytes === undefined && i.linhas === undefined && i.soma === undefined),
      { message: 'ilegivel_com_valores' })).max(500),
}).strict()
const AtestarB2 = z.object({
  fonte: z.literal('b2'), execucao_id: canal,
  itens: z.array(z.object({
    arquivo_id: arquivoId, resultado: z.enum(['presente', 'ausente', 'sem_acesso', 'chave_ausente', 'nao_decifra']),
    sha256: sha.optional(), bytes: z.number().int().min(0).optional(), linhas: z.number().int().min(0).nullable().optional(), soma: soma.optional(),
    file_id: z.string().min(1).max(200).optional(), upload_timestamp: z.number().int().min(0).optional(),
    tentativa: z.union([z.literal(1), z.literal(2)]),
  }).strict().superRefine((i, ctx) => {
    const semValores = i.sha256 === undefined && i.bytes === undefined && i.linhas === undefined && i.soma === undefined
    const comFileId = i.file_id !== undefined && i.upload_timestamp !== undefined
    if (i.arquivo_id === 'controle_negativo' && i.resultado === 'presente') {
      // Pedido 10: a forja não baixa o que não devia existir.
      if (!comFileId || !semValores) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'negativo_presente_forma' })
    } else if (i.resultado === 'presente') {
      if (i.sha256 === undefined || !comFileId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'presente_sem_file_id' })
    } else if (i.resultado === 'nao_decifra') {
      // K4: divergente já no primeiro informe; só o fileId identifica a cópia estragada.
      if (!comFileId || !semValores) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'nao_decifra_forma' })
    }
  })).min(1).max(200),
}).strict()
export const CorpoAtestar = z.discriminatedUnion('fonte', [AtestarNas, AtestarB2])
export type CorpoAtestarNas = z.infer<typeof AtestarNas>
export type CorpoAtestarB2 = z.infer<typeof AtestarB2>

export const CorpoBatimento = z.object({
  versao: z.string().min(1).max(40), hora_maquina: z.string().datetime({ offset: true }), nas_ok: z.boolean(),
  montagens_ok: z.object({ numerico: z.boolean(), texto: z.boolean() }).strict(),
  sentinela_ok: z.object({ numerico: z.boolean(), texto: z.boolean() }).strict(),
  livre_bytes: z.object({ numerico: z.number().int().min(0).nullable(), texto: z.number().int().min(0).nullable() }).strict(),
  total_bytes: z.object({ numerico: z.number().int().min(0).nullable(), texto: z.number().int().min(0).nullable() }).strict(),
  parado_no_teto: z.enum(['dia', 'mes']).nullable(),
  ultimo_erro: z.string().max(200).nullable(),
}).strict()

export const ItemArquivo = z.object({
  arquivo_id: arquivoId, tipo: z.enum(['unidade', 'parte', 'resumo', 'manifesto', 'anexo']), filho: z.enum(['numerico', 'texto']),
  caminho: z.string().min(1).max(300), classe, tabela: z.string().nullable(), canal: canal.nullable(), mes, versao: z.number().int().min(1),
  coluna_controle: z.string().nullable(),
}).strict()
export type ItemArquivo = z.infer<typeof ItemArquivo>

// Respostas: toda rota valida o `data` contra o esquema `.strict()` antes de sair; as RPCs são lidas com `.safeParse`, nunca com `as`.
const filho = z.enum(['numerico', 'texto'])
const vermelhos = z.array(z.string().max(300))
const iso = z.string().datetime({ offset: true })
export const RespostaPlano = z.object({
  plano_id: canal, gerado_em: iso, modo: z.enum(['normal', 'completo']), cursor_seguinte: z.string().max(200).nullable(),
  primeira_selagem: mes.nullable(), vermelhos, canario: z.object({ dia: z.string().regex(DIA_RE) }).strict(),
  exportar: z.array(z.object({ classe, tabela: z.string(), canal, mes, motivo: z.enum(['nova', 'conteudo_mudou', 'arquivo_ausente', 'divergente',
    'conteudo_divergente', 'mudou_durante_a_leitura', 'parte_mudou']) }).strict()),
  resumos: z.array(z.object({ classe, canal, mes }).strict()), manifestos: z.array(z.object({ classe, mes }).strict()),
  aguardando_dono: z.array(ItemArquivo.extend({ b2_file_id_bom: z.string().nullable() })),
  a_apagar: z.array(z.object({ filho, caminho: z.string().min(1).max(320) }).strict()),
  reconferir: z.array(ItemArquivo).max(1000), prefixos_ausentes: z.array(z.never()).length(0),
}).strict()
const estadoFilhoB2 = z.enum(['aguardando_primeira_selagem', 'nada_devido', 'com_pedidos'])
export const RespostaPlanoB2 = z.object({
  execucao_id: canal, gerado_em: iso, modo: z.enum(['normal', 'completo']), cursor_seguinte: z.string().max(200).nullable(),
  primeira_selagem: mes.nullable(), vermelhos, estado: z.object({ numerico: estadoFilhoB2, texto: estadoFilhoB2 }).strict(),
  teto_bytes_dia: z.number().int().min(0), teto_bytes_mes: z.number().int().min(0),
  controle_negativo: z.object({ arquivo_id: z.literal('controle_negativo'), filho, caminho: z.string().min(1) }).strict(),
  canarios: z.array(z.object({ arquivo_id: z.enum(['canario:numerico', 'canario:texto']), filho,
    caminho: z.string().regex(/^_canario\/\d{4}-\d{2}-\d{2}$/).nullable() }).strict()).length(2),
  arquivos: z.array(ItemArquivo).max(500), prefixos_ausentes: z.array(z.never()).length(0),
  // r2.2 (I3 do Phil): o completo que não terminou é retomado pelo site; no normal os dois vêm nulos.
  retomado_de: z.string().min(1).max(200).nullable(),
  cobertura: z.object({ paginas_aceitas: z.number().int().min(0), paginas_total: z.number().int().min(1) }).strict()
    .refine(c => c.paginas_aceitas <= c.paginas_total, 'cobertura_acima_do_total').nullable(),
}).strict().superRefine((d, ctx) => {
  const ok = d.modo === 'normal' ? d.retomado_de === null && d.cobertura === null : d.cobertura !== null
  if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'retomada_fora_do_modo' })
})
// r2.2 (M6 do Phil): a cor do teto de bytes, contada pelo site; não nula só para o conferir_b2.
export const RespostaBatimento = z.object({ gravado: z.boolean(), teto: z.enum(['verde', 'ambar', 'vermelho']).nullable() }).strict()
export const RespostaAtestarNas = z.object({
  itens: z.array(z.object({ arquivo_id: arquivoId, resposta: z.enum(['aceito', 'recusado']), motivo: z.enum(['desconhecido', 'filho_fora', 'forma']).optional() }).strict()),
  canarios: z.array(z.object({ filho, dia: z.string().regex(DIA_RE), resposta: z.enum(['aceito', 'recusado']),
    motivo: z.enum(['sha256_diferente_no_dia', 'dia_invalido']).optional() }).strict()),
}).strict()
export const RespostaAtestarB2 = z.object({
  execucao: z.object({ estado: z.enum(['aguardando_controle', 'controle_ok', 'controle_falhou']), negativo_ok: z.boolean(),
    canario_ok: z.object({ numerico: z.boolean(), texto: z.boolean() }).strict() }).strict(),
  itens: z.array(z.object({ arquivo_id: arquivoId, resposta: z.enum(['aceito', 'repetir', 'recusado']),
    motivo: z.enum(['controle_pendente', 'controle_falhou', 'sem_file_id', 'file_id_invalido', 'desconhecido', 'execucao_vencida', 'forma']).optional() }).strict()),
}).strict()
/** Dado das RPCs que a rota de exportar lê (Yannis M10). */
export const RespostaParteInfo = z.object({
  status: z.literal('ok'), unidade_id: canal, versao: z.number().int().min(1), partes: z.number().int().min(1).max(TETO_PARTES),
  de: z.number().int().min(0), ate: z.number().int().min(0), sha256: sha, recebida: z.boolean(),
}).strict()
export const RespostaRecord = z.object({
  status: z.string().min(1).max(40), unidade_id: canal.optional(), versao: z.number().int().min(1).optional(),
}).passthrough()

/** Códigos que as rotas devolvem em `error.code` (além de VALIDATION_ERROR, FORBIDDEN, UNAUTHORIZED), com o status. */
export const STATUS_DO_CODIGO = {
  arquivo_desligado: 503, erro_do_banco: 500, tempo_esgotado: 504,
  canal_removido: 409, sem_destino: 409, unidade_retirada: 409, mes_aberto: 409, nao_devida: 409, mes_fora_do_banco: 409,
  mudou_durante_a_leitura: 409, parte_mudou: 409, unidades_pendentes: 409, conteudo_mudou: 409, resumos_pendentes: 409,
  ja_no_arquivo: 409, resumo_da_m10b: 409,
  grande_demais: 413, classe_tabela_invalida: 422, faixa_invalida: 422,
  tabela_ausente: 409, // X3 (controlador, 14/10): 409. A forja decide pelo code.
} as const
export const CODIGOS = Object.keys(STATUS_DO_CODIGO) as (keyof typeof STATUS_DO_CODIGO)[]
export type CodigoArquivo = keyof typeof STATUS_DO_CODIGO
```

- [ ] **Passo 3. `caminho.ts`:**

```ts
// apps/web/src/lib/youtube/observatorio/arquivo-mensal/caminho.ts
/** Manutenção M3b: o único construtor de caminho e de `arquivo_id` do site (o da forja é cópia em Python, com o mesmo teste). */
import { CLASSES, TABELAS_DA_CLASSE, UUID_RE, MES_RE, DIA_RE, SHA_RE, TETO_PARTES, type Classe } from './contrato'

export class CaminhoInvalido extends Error {
  constructor(motivo: string) { super(motivo); this.name = 'CaminhoInvalido' }
}
type PapelResumo = 'canal' | 'video' | 'ficha'
const ehClasse = (c: string): c is Classe => (CLASSES as readonly string[]).includes(c)

function conferir(o: { classe: string; canal?: string; tabela?: string; mes?: string; versao?: number; parte?: number }): void {
  if (!ehClasse(o.classe)) throw new CaminhoInvalido('classe')
  if (o.canal !== undefined && !UUID_RE.test(o.canal)) throw new CaminhoInvalido('canal')
  if (o.tabela !== undefined && !TABELAS_DA_CLASSE[o.classe].includes(o.tabela)) throw new CaminhoInvalido('tabela')
  if (o.mes !== undefined && !MES_RE.test(o.mes)) throw new CaminhoInvalido('mes')
  if (o.versao !== undefined && (!Number.isInteger(o.versao) || o.versao < 1 || o.versao > 9999)) throw new CaminhoInvalido('versao')
  if (o.parte !== undefined && (!Number.isInteger(o.parte) || o.parte < 1 || o.parte > TETO_PARTES)) throw new CaminhoInvalido('parte')
}
const nn = (n: number): string => String(n).padStart(2, '0')

export function caminhoDaUnidade(o: { classe: string; canal: string; tabela: string; mes: string; versao: number }): string {
  conferir(o)
  return `${o.classe}/canais/${o.canal}/${o.tabela}/${o.mes}.v${o.versao}.csv.gz`
}
export function caminhoDaParte(o: { classe: string; canal: string; tabela: string; mes: string; versao: number; parte: number }): string {
  conferir(o)
  return `${o.classe}/canais/${o.canal}/${o.tabela}/${o.mes}.v${o.versao}.p${nn(o.parte)}.csv.gz`
}
export function caminhoDoResumo(o: { classe: string; canal: string; mes: string; versao: number; papel: PapelResumo }): string {
  conferir(o)
  if (o.papel === 'ficha' && o.classe !== 'video_antigo') throw new CaminhoInvalido('ficha')
  return `${o.classe}/canais/${o.canal}/resumo/${o.mes}.v${o.versao}.${o.papel}.csv.gz`
}
export function caminhoDoManifesto(o: { classe: string; mes: string; versao: number; papel: 'json' | 'sha256' }): string {
  conferir(o)
  return `${o.classe}/manifestos/${o.mes}.v${o.versao}.${o.papel}`
}
export function caminhoDoAnexo(o: { classe: string; canal: string; sha256: string; ext: string }): string {
  conferir(o)
  if (o.classe !== 'video_antigo') throw new CaminhoInvalido('anexo')
  if (!SHA_RE.test(o.sha256) || !['jpg', 'png', 'webp'].includes(o.ext)) throw new CaminhoInvalido('anexo')
  return `${o.classe}/canais/${o.canal}/miniaturas/${o.sha256}.${o.ext}`
}
export function caminhoDoCanario(dia: string): string {
  if (!DIA_RE.test(dia)) throw new CaminhoInvalido('dia')
  return `_canario/${dia}`
}

export const idDaUnidade = (id: string): string => `u:${id}`
export const idDaParte = (id: string, parte: number): string => `p:${id}:${nn(parte)}`
export const idDoResumo = (id: string, papel: PapelResumo): string => `s:${id}:${papel}`
export const idDoAnexo = (id: string): string => `a:${id}`
export const idDoManifesto = (classe: Classe, mes: string, versao: number, papel: 'json' | 'sha256'): string => `m:${classe}:${mes}:v${versao}:${papel}`

export type IdLido =
  | { tipo: 'unidade' | 'anexo'; id: string }
  | { tipo: 'parte'; id: string; parte: number }
  | { tipo: 'resumo'; id: string; papel: PapelResumo }
  | { tipo: 'manifesto'; classe: Classe; mes: string; versao: number; papel: 'json' | 'sha256' }

const U = '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'
export function lerArquivoId(s: string): IdLido | null {
  let m = new RegExp(`^u:${U}$`).exec(s); if (m) return { tipo: 'unidade', id: m[1]! }
  m = new RegExp(`^a:${U}$`).exec(s); if (m) return { tipo: 'anexo', id: m[1]! }
  m = new RegExp(`^p:${U}:(0[1-9]|[1-9][0-9])$`).exec(s); if (m) return { tipo: 'parte', id: m[1]!, parte: Number(m[2]) }
  m = new RegExp(`^s:${U}:(canal|video|ficha)$`).exec(s); if (m) return { tipo: 'resumo', id: m[1]!, papel: m[2] as PapelResumo }
  m = /^m:(horaria|serie|texto|video_antigo|ensaio):(\d{4}-(?:0[1-9]|1[0-2])):v([1-9]\d{0,3}):(json|sha256)$/.exec(s)
  if (m) return { tipo: 'manifesto', classe: m[1] as Classe, mes: m[2]!, versao: Number(m[3]), papel: m[4] as 'json' | 'sha256' }
  return null
}
```

- [ ] **Passo 4.** Run o teste → PASS. `npx tsc --noEmit -p apps/web` sem erro novo.

- [ ] **Passo 5. Commit:**

```bash
git add -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/caminho.ts apps/web/test/youtube/observatorio/arquivo-mensal-contrato.test.ts
git commit -m "feat: contrato e caminhos do arquivo mensal (manutenção M3b, itens 131 e 158)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/caminho.ts apps/web/test/youtube/observatorio/arquivo-mensal-contrato.test.ts
```

---

### Task 2: `exportarUnidade` (pedido 2 da E10, pelo gatilho) e as fixtures de ouro

**Files:**
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo/exportar.ts` (passo 5 de `exportarCanal`, `:181-215`)
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo/sessao.ts` (acrescenta `lerLinhasDoBanco`; `lerCsvDoBanco` fica, a conferência usa)
- Create: `apps/web/test/youtube/observatorio/arquivo-unidade.test.ts`
- Create: `apps/web/test/fixtures/arquivo-mensal/ouro-serie.csv.gz`, `ouro-texto.csv.gz`, `ouro.json`

**Interfaces:**
- Consumes: `linhaCsv` (`arquivo/csv.ts:13`), `Disco` (`exportar.ts:27`).
- Produces (o contrato do pedido 2, `05` §17):

```ts
export interface FonteDaUnidade {
  ler(): Promise<{ colunas: string[]; linhas: Array<Array<string | null>>; contagem: number; soma: string | null }>
}
export interface UnidadeSerializada {
  caminho: string; linhas: number; soma: string | null; sha256: string; csvSha256: string; bytes: number
  menorChave: string | null; maiorChave: string | null; de: string; ate: string; gz: Uint8Array
}
export class ContagemDaFonteDifere extends Error {}
export function exportarUnidade(
  fonte: FonteDaUnidade, disco: Pick<Disco, 'gravar'> | null,
  o: { tabela: string; canal: string; de: string; ate: string; rotulo: string; colunasDeOrdem?: string[] | null },
): Promise<UnidadeSerializada>
export function serializarLinhas(colunas: string[], linhas: ReadonlyArray<ReadonlyArray<string | null>>): Buffer  // o CSV sem compressão
```

`rotulo` é o caminho relativo em que o arquivo é gravado (no export de canal, `caminhoDoArquivo(tabela, canal, periodo)`; no mensal, `caminhoDaUnidade(...)`). `disco` nulo: não grava, só devolve `gz` (a rota). **Sem SQL dentro.**

**O que acontece quando o dado não existe:** fonte com zero linha devolve o CSV só com o cabeçalho (o export de canal grava assim hoje, e o mensal **não chama** `exportarUnidade` para unidade vazia: grava a unidade vazia conferida sem arquivo, D7). `contagem` diferente de `linhas.length` lança `ContagemDaFonteDifere` (nunca grava). A soma não é refeita aqui: quem a confere é o chamador (Yannis M1: a promessa de refazer saiu, porque não tinha código nem teste).

- [ ] **Passo 1. Teste, falhando:**

```ts
// apps/web/test/youtube/observatorio/arquivo-unidade.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { exportarUnidade, serializarLinhas, ContagemDaFonteDifere } from '@/lib/youtube/observatorio/arquivo/exportar'
import { lerCsv } from '@/lib/youtube/observatorio/arquivo/csv'

const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')
const fonte = (colunas: string[], linhas: Array<Array<string | null>>, soma: string | null = null, contagem = linhas.length) =>
  ({ ler: async () => ({ colunas, linhas, contagem, soma }) })
const O = { tabela: 'competitor_video_daily', canal: 'c', de: '2026-10-01', ate: '2026-10-31', rotulo: 'x/y.csv.gz', colunasDeOrdem: ['video_id', 'snap_date'] }

describe('exportarUnidade (pedido 2 da E10)', () => {
  it('nulo e texto vazio, vírgula, aspas e \\r voltam iguais', async () => {
    const linhas = [['v1', '2026-10-03', '10', null], ['v1', '2026-10-04', '11', ''], ['v2', '2026-10-03', '9007199254740993', 'a,"b"\r\nc']]
    const u = await exportarUnidade(fonte(['video_id', 'snap_date', 'views', 'nota'], linhas, '9007199254741014'), null, O)
    const volta = lerCsv(gunzipSync(u.gz).toString('utf8'))
    expect(volta.linhas).toEqual(linhas)
    expect(u.linhas).toBe(3)
    expect(u.csvSha256).toBe(sha(gunzipSync(u.gz)))
    expect(u.sha256).toBe(sha(u.gz))
    expect(u.menorChave).toBe('v1|2026-10-03')
    expect(u.maiorChave).toBe('v2|2026-10-03')
  })
  it('contagem da fonte diferente das linhas: lança e não grava', async () => {
    const gravados: string[] = []
    await expect(exportarUnidade(fonte(['a'], [['1']], null, 2), { gravar: async p => { gravados.push(p) } }, O)).rejects.toBeInstanceOf(ContagemDaFonteDifere)
    expect(gravados).toEqual([])
  })
  it('grava em `rotulo` quando há disco', async () => {
    const gravados: string[] = []
    await exportarUnidade(fonte(['a'], [['1']]), { gravar: async p => { gravados.push(p) } }, O)
    expect(gravados).toEqual(['x/y.csv.gz'])
  })
  it('os bytes são os do caminho antigo da E10 (cabeçalho, linha terminada em \\n)', () => {
    expect(serializarLinhas(['a', 'b'], [['1', null], ['', 'x']]).toString('utf8')).toBe('a,b\n1,\n"",x\n')
    expect(serializarLinhas(['a'], []).toString('utf8')).toBe('a\n')
  })
  it('fixtures de ouro: regeradas, dão o mesmo CSV e os valores do ouro.json (item 19)', async () => {
    const ouro = JSON.parse(readFileSync(new URL('../../fixtures/arquivo-mensal/ouro.json', import.meta.url), 'utf8')) as
      Array<{ arquivo: string; colunas: string[]; linhas: Array<Array<string | null>>; linhas_n: number; soma: string | null; sha256: string; csv_sha256: string }>
    for (const f of ouro) {
      const u = await exportarUnidade(fonte(f.colunas, f.linhas, f.soma), null, { ...O, rotulo: f.arquivo })
      // Nunca o sha256 do .gz: o zlib do Mac (Node 25) e o da CI (Node 22, .nvmrc) geram bytes diferentes (Yannis I2).
      // O ouro.json guarda `sha256` só para o leitor Python da forja (o arquivo dele é aquele .gz gravado).
      expect(u.csvSha256).toBe(f.csv_sha256)
      expect(gunzipSync(u.gz).equals(gunzipSync(readFileSync(new URL(`../../fixtures/arquivo-mensal/${f.arquivo}`, import.meta.url))))).toBe(true)
    }
  })
})
```

Run: FAIL (`exportarUnidade` não existe).

- [ ] **Passo 2. Implementar em `exportar.ts`** (acima de `exportarCanal`):

```ts
export interface FonteDaUnidade {
  ler(): Promise<{ colunas: string[]; linhas: Array<Array<string | null>>; contagem: number; soma: string | null }>
}
export interface UnidadeSerializada {
  caminho: string; linhas: number; soma: string | null; sha256: string; csvSha256: string; bytes: number
  menorChave: string | null; maiorChave: string | null; de: string; ate: string; gz: Uint8Array
}
export class ContagemDaFonteDifere extends Error {
  constructor(detalhe: string) { super(detalhe); this.name = 'ContagemDaFonteDifere' }
}

/** O CSV sem compressão, byte a byte o que `lerCsvDoBanco` monta: cabeçalho e toda linha terminados em `\n`. */
export function serializarLinhas(colunas: string[], linhas: ReadonlyArray<ReadonlyArray<string | null>>): Buffer {
  const partes = [linhaCsv(colunas) + '\n']
  for (const l of linhas) partes.push(linhaCsv(l) + '\n')
  return Buffer.from(partes.join(''), 'utf8')
}

/** Pedido 2 da E10 (implementado pela manutenção, gatilho do 05 §15.1): serializa UMA unidade. Sem SQL dentro. */
export async function exportarUnidade(
  fonte: FonteDaUnidade, disco: Pick<Disco, 'gravar'> | null,
  o: { tabela: string; canal: string; de: string; ate: string; rotulo: string; colunasDeOrdem?: string[] | null },
): Promise<UnidadeSerializada> {
  const lido = await fonte.ler()
  if (lido.contagem !== lido.linhas.length) throw new ContagemDaFonteDifere(`${o.tabela}: fonte ${lido.contagem}, linhas ${lido.linhas.length}`)
  for (const l of lido.linhas) if (l.length !== lido.colunas.length) throw new ContagemDaFonteDifere(`${o.tabela}: linha com ${l.length} campos`)
  const csv = serializarLinhas(lido.colunas, lido.linhas)
  const gz = gzipSync(csv, { level: 9 })
  const idx = (o.colunasDeOrdem ?? []).map(c => lido.colunas.indexOf(c))
  const chave = (l: ReadonlyArray<string | null> | undefined): string | null =>
    l === undefined || idx.length === 0 || idx.some(i => i < 0) ? null : idx.map(i => l[i] ?? '').join('|')
  if (disco !== null) await disco.gravar(o.rotulo, gz)
  return {
    caminho: o.rotulo, linhas: lido.linhas.length, soma: lido.soma, sha256: sha256(gz), csvSha256: sha256(csv), bytes: gz.byteLength,
    menorChave: chave(lido.linhas[0]), maiorChave: chave(lido.linhas[lido.linhas.length - 1]), de: o.de, ate: o.ate, gz,
  }
}
```

(`sha256` já é a função local de `exportar.ts`; `linhaCsv` passa a ser importada de `./csv`.) **A soma não é refeita aqui:** a fonte devolve a do banco, e quem confere é o chamador (no export de canal, contra `obs_archive_channel_counts`; no mensal, contra a de `obs_archive_read_unit`, que vem da mesma instrução).

- [ ] **Passo 3. `lerLinhasDoBanco` em `sessao.ts`** (mesmo cursor, mesmas conversões de `lerCsvDoBanco`, devolvendo as linhas em vez do CSV):

```ts
export async function lerLinhasDoBanco(
  sql: ClienteSql,
  o: { consulta: string; parametros: unknown[]; colunas: string[]; colunaDaSoma: string | null; nomeDoCursor?: string },
): Promise<{ colunas: string[]; linhas: Array<Array<string | null>>; contagem: number; soma: string | null }> {
  const cursor = o.nomeDoCursor ?? 'arquivo_cursor'
  if (!IDENT.test(cursor)) throw new Error('nome de cursor inválido')
  await sql.query(`declare ${cursor} no scroll cursor for ${o.consulta}`, o.parametros)
  const linhas: Array<Array<string | null>> = []
  let soma: bigint | null = o.colunaDaSoma === null ? null : BigInt(0)
  try {
    for (;;) {
      const r = await sql.query(`fetch forward ${LINHAS_POR_BLOCO} from ${cursor}`)
      if (r.rows.length === 0) break
      for (const row of r.rows) {
        linhas.push(o.colunas.map(c => textoOuNulo(row[c], c)))
        if (soma !== null && o.colunaDaSoma !== null) { const v = row[o.colunaDaSoma]; if (v !== null && v !== undefined) soma += paraBigInt(v, o.colunaDaSoma) }
      }
    }
  } finally {
    await sql.query(`close ${cursor}`).catch(() => undefined)
  }
  return { colunas: o.colunas, linhas, contagem: linhas.length, soma: soma === null ? null : soma.toString() }
}
```

- [ ] **Passo 4. `exportarCanal` vira o laço sobre `exportarUnidade`.** No passo 5 de `exportarCanal` (`exportar.ts:181-215`), trocar `lerCsvDoBanco` + `gzipSync` + `gravar` por:

```ts
        const fonte: FonteDaUnidade = { ler: () => lerLinhasDoBanco(sql, {
          consulta: consultaDoArquivo({ tabela: e.tabela, filtro: e.filtro, periodo: e.periodo, ordem: e.ordem, colunas: colunas.map(x => x.nome) }),
          parametros: unico ? [o.canalId] : [o.canalId, k.inicio], colunas: colunas.map(x => x.nome), colunaDaSoma,
        }) }
        const caminho = caminhoDoArquivo(e.tabela, o.canalId, periodo)
        // Disco nulo: confere antes de gravar, como a E10 faz hoje (Yannis M2); nenhum arquivo é gravado à toa.
        const u = await exportarUnidade(fonte, null, {
          tabela: e.tabela, canal: o.canalId, de: unico ? '1970-01-01' : k.inicio, ate: unico ? '1970-01-01' : ultimoDiaDoMes(k.inicio),
          rotulo: caminho, colunasDeOrdem: colunasDaExpressao(e.ordem),
        })
        if (u.linhas !== k.linhas || (k.soma !== null && u.soma !== k.soma)) {
          await desfazer()
          return recusarLimpando('contagem_do_arquivo_difere', [`${e.tabela} ${unico ? 'arquivo único' : periodo}: banco ${k.linhas}, arquivo ${u.linhas}`])
        }
        await disco.criarPasta(diretorioDe(juntar(pasta, caminho)), MODO_DA_PASTA)
        await gravar(caminho, u.gz)
        arquivos.push({
          tabela: e.tabela, canal: o.canalId, periodo, periodStart: u.de, periodEnd: u.ate, caminho, linhas: u.linhas, soma: k.soma,
          menorChave: u.menorChave, maiorChave: u.maiorChave, sha256: u.sha256, csvSha256: u.csvSha256, colunas,
        })
```

**Sem diferença de ordem:** a contagem continua conferida **antes** de gravar (`disco` nulo, depois `gravar`), como na E10; o teste `contagem do arquivo difere da do banco` (`arquivo-exportar.test.ts`) continua passando sem edição (o teste da E10 manda; não se edita teste da E10).

- [ ] **Passo 5. Os testes da E10 sem edição.** `npx vitest run apps/web/test/youtube/observatorio/arquivo-exportar.test.ts apps/web/test/youtube/observatorio/arquivo-csv.test.ts apps/web/test/youtube/observatorio/arquivo-conferir.test.ts apps/web/test/youtube/observatorio/arquivo-cli.test.ts` → PASS, e, com `HAS_LOCAL_DB=1`, `apps/web/test/integration/observatorio-a5-e10-ida-e-volta.test.ts` → PASS (prova de que `exportarCanal` não mudou de comportamento).

- [ ] **Passo 6. Fixtures de ouro.** Gerar uma vez com um script descartável no scratchpad (que importa `exportarUnidade` e grava `ouro-serie.csv.gz`, `ouro-texto.csv.gz` e `ouro.json`), com: série (`video_id,snap_date,views,likes,comments,taken_at`, uma linha com `likes` nulo, uma com `views` = `9007199254740993`, uma com `taken_at` com microssegundos) e texto (`id,body,parent_id`, uma linha com `body` nulo, uma com `body` = `""`, uma com `body` = `0`, uma com vírgula, aspas, `\r\n` e unicode, e uma `jsonb` `{"a":"é\"x"}`). `ouro.json` traz, por arquivo, as colunas, as linhas, `linhas_n`, `soma`, `sha256` e `csv_sha256`. Gerar com o Node do `.nvmrc` (`npx -y node@22 <script>`), o da CI, e registrar `process.versions.zlib` no ledger. O teste do Passo 1 as regenera e compara o CSV (sha256 do CSV e o `.gz` descomprimido), nunca o sha256 do `.gz`: o zlib muda os bytes comprimidos entre versões do Node (D8). As fixtures são refeitas só se o CSV mudar, **junto** com o aviso ao kit (a forja copia as fixtures para o teste do leitor Python, item 20).

- [ ] **Passo 7.** Run `arquivo-unidade.test.ts` → PASS. `npx tsc --noEmit -p apps/web`.

- [ ] **Passo 8. Commit** (e anotar o hash no aviso do Task 0, Passo 2):

```bash
git add -- apps/web/test/youtube/observatorio/arquivo-unidade.test.ts apps/web/test/fixtures/arquivo-mensal/ouro-serie.csv.gz apps/web/test/fixtures/arquivo-mensal/ouro-texto.csv.gz apps/web/test/fixtures/arquivo-mensal/ouro.json
git commit -m "feat: exportarUnidade, a serialização de uma unidade (pedido 2 da E10, pelo gatilho da manutenção M3b)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/youtube/observatorio/arquivo/exportar.ts apps/web/src/lib/youtube/observatorio/arquivo/sessao.ts apps/web/test/youtube/observatorio/arquivo-unidade.test.ts apps/web/test/fixtures/arquivo-mensal/ouro-serie.csv.gz apps/web/test/fixtures/arquivo-mensal/ouro-texto.csv.gz apps/web/test/fixtures/arquivo-mensal/ouro.json
```

---

### Task 3: SQL parte 1, o registro, a política e o administrador do site (rascunho)

**Files:**
- Create: `supabase/rascunhos/m3b.sql` (partes 1 a 6 nascem nas Tarefas 3 a 8)
- Create: `apps/web/test/helpers/m3b.ts`
- Modify: `apps/web/test/manutencao/migrations-leitura.test.ts` (da M2)
- Create: `apps/web/test/integration/manutencao-m3b-registro.test.ts`

**Interfaces:**
- Consumes: `lerMigrations`, `migrationsDaFase`, `regra119`, `PASTA_DAS_MIGRATIONS` (`apps/web/test/helpers/migrations.ts`, M2 Tarefa 1); `aplicarM2` (`apps/web/test/helpers/m2.ts`); `M10A_SQL` (`apps/web/test/integration/video-antigo-m10a-caminho.ts`, M10a Tarefa 2: o texto do rascunho ou da migration da M10a, aplicado com `c.query(readFileSync(M10A_SQL, 'utf8'))` dentro da transação). Os quatro arquivos são a TRAVA M3b-0a.
- Produces (SQL): as tabelas `obs_archive_units`, `obs_archive_unit_parts`, `obs_archive_months`, `obs_archive_prechecks`, `obs_archive_restores`, `obs_archive_switch`, `obs_archive_heartbeat`, `obs_archive_purges`, `obs_archive_unit_attachments`, `obs_archive_summaries`, `obs_archive_channel_removals` (spec) e `obs_archive_b2_runs`, `obs_archive_b2_files`, `obs_archive_canaries`, `obs_archive_sweeps` (D5); a coluna `competitor_removed_items.archive_note` (D15); as funções `obs_archive_policy()`, `obs_archive_is_site_admin(p_site uuid, p_user uuid)`, `obs_archive_class_table_guard()` (gatilho).
- Produces (TS, `apps/web/test/helpers/m3b.ts`): `M3B_SQL_CAMINHO`, `M3B_EM_MIGRATION` (o único lugar que a Tarefa 10 muda), `M3B_SQL`, `aplicarM3b(c: Client, ate?: 1 | 2 | 3 | 4 | 5 | 6)`, `m3bNoBanco()`, `semearCanal(c, o)`, `semearDiaria(c, o)`, `SITE_TESTE`.

**O que acontece quando o dado não existe:** site sem nenhuma linha no registro é o estado de hoje; toda leitura derivada (plano, lista de removidos, vigias) tem de distinguir "registro vazio" de "registro ilegível" (Tarefas 7 e 8). A M2 ausente no banco (`obs_archive_rehearsal` não existe): a política continua listando a tabela, e `obs_archive_read_unit` sobre ela devolve `tabela_ausente` (Tarefa 4), nunca zero linha.

- [ ] **Passo 1. O helper e a trava, falhando.** `apps/web/test/helpers/m3b.ts`:

```ts
/** Manutenção M3b: o SQL da migration vive em supabase/rascunhos/m3b.sql até a Tarefa 10 (TRAVA M3b-1). Este é o único lugar que a Tarefa 10 muda. */
import type { Client } from 'pg'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

export const M3B_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/rascunhos/m3b.sql')
export const M3B_EM_MIGRATION = false
export const HASH_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/sql/obs-archive-hash.sql')
export const M3B_SQL = (): string => readFileSync(M3B_SQL_CAMINHO, 'utf8')
export const SITE_TESTE = '00000000-0000-0000-0000-00000000a3b0'

/** Aplica o rascunho até a parte `ate` (inclusive), na conexão dada. O chamador abre e desfaz a transação. */
export async function aplicarM3b(c: Client, ate: 1 | 2 | 3 | 4 | 5 | 6 = 6): Promise<void> {
  const sql = M3B_SQL()
  const fim = ate === 6 ? sql.length : sql.indexOf(`-- M3B PARTE ${ate + 1}`)
  if (fim < 0) throw new Error(`parte ${ate + 1} não encontrada no rascunho`)
  await c.query(sql.slice(0, fim))
}
export async function m3bNoBanco(c: Client): Promise<boolean> {
  const r = await c.query(`select to_regclass('public.obs_archive_units') is not null as ok`)
  return r.rows[0]?.ok === true
}
/** Um site e um canal de teste, com N vídeos. Devolve os ids. Só dentro de transação desfeita. */
export async function semearCanal(c: Client, o: { site?: string; videos?: number } = {}): Promise<{ site: string; canal: string; videos: string[] }> {
  const site = o.site ?? SITE_TESTE
  await c.query(`insert into public.sites (id, name, slug, org_id) select $1, 'm3b', 'm3b-' || substr($1::text, 25), (select id from public.organizations order by created_at limit 1) on conflict (id) do nothing`, [site])
  const canal = randomUUID()
  await c.query(`insert into public.competitor_channels (id, site_id, channel_id, channel_name) values ($1, $2, 'UC' || substr(md5($1::text), 1, 22), 'canal m3b')`, [canal, site])
  const videos: string[] = []
  for (let i = 0; i < (o.videos ?? 3); i++) {
    const v = randomUUID()
    // competitor_videos não tem site_id (o site vem do canal) e o id do YouTube mora em video_id (Phil I1).
    await c.query(`insert into public.competitor_videos (id, competitor_channel_id, video_id, title, published_at) values ($1, $2, substr(md5($1::text), 1, 11), 'v', now() - interval '60 days')`, [v, canal])
    videos.push(v)
  }
  return { site, canal, videos }
}
export async function semearDiaria(c: Client, videos: readonly string[], de: string, dias: number): Promise<void> {
  await c.query(`insert into public.competitor_video_daily (video_id, snap_date, views, likes, comments, taken_at)
    select v, d::date, 1000 + (extract(day from d))::int, null, 1, d + interval '12 hours'
      from unnest($1::uuid[]) v, generate_series($2::date, $2::date + ($3 - 1), interval '1 day') d`, [videos, de, dias])
}
```

As colunas obrigatórias de `sites`, `competitor_channels` e `competitor_videos` em `semearCanal` são conferidas no Passo 6 contra o `bythiago_int` (`\d public.competitor_videos`); coluna `not null` a mais entra no `insert` (NÃO VERIFICADO: escrito a partir das migrations lidas).

Em `migrations-leitura.test.ts`, acrescentar:

```ts
import { M3B_EM_MIGRATION, M3B_SQL_CAMINHO, HASH_SQL_CAMINHO } from '../helpers/m3b'

describe('TRAVA M3b-1: o SQL da M3b só entra em supabase/migrations no dia do push', () => {
  const daM3b = (): string[] => readdirSync(PASTA_DAS_MIGRATIONS).filter(n => /_manutencao_m3b_/.test(n))
  it('antes do dia: nenhum arquivo e o rascunho existe; no dia: o arquivo existe e o rascunho saiu', () => {
    if (!M3B_EM_MIGRATION) {
      expect(daM3b()).toEqual([])
      expect(existsSync(M3B_SQL_CAMINHO)).toBe(true)
    } else {
      expect(daM3b().some(n => n.endsWith('_manutencao_m3b_arquivo.sql'))).toBe(true)
      expect(existsSync(resolve(__dirname, '../../../../supabase/rascunhos/m3b.sql'))).toBe(false)
    }
  })
  it('D17: o corpo dos hashes está byte a byte no SQL da M3b', () => {
    const corpo = readFileSync(HASH_SQL_CAMINHO, 'utf8')
    const alvo = M3B_EM_MIGRATION
      ? readFileSync(resolve(PASTA_DAS_MIGRATIONS, daM3b().find(n => n.endsWith('_manutencao_m3b_arquivo.sql'))!), 'utf8')
      : readFileSync(M3B_SQL_CAMINHO, 'utf8')
    const ini = alvo.indexOf('-- obs-archive-hash.sql: início')
    const fim = alvo.indexOf('-- obs-archive-hash.sql: fim')
    expect(ini).toBeGreaterThanOrEqual(0)
    expect(alvo.slice(alvo.indexOf('\n', ini) + 1, fim)).toBe(corpo)
  })
  it('TRAVA M3b-2, parte mecânica: sem a migration no disco, nada de rota nem de botão novo (Yannis M8)', () => {
    if (!M3B_EM_MIGRATION) {
      expect(existsSync(resolve(__dirname, '../../src/app/api/pipeline/archive'))).toBe(false)
      expect(readFileSync(resolve(__dirname, '../../src/app/cms/(authed)/youtube/competitors/actions.ts'), 'utf8')).not.toContain('competitor_channel_remove')
    }
  })
  it('item 119 vale também para o rascunho: ele cita obs_archive_is_site_admin e a define', () => {
    const r = readFileSync(M3B_SQL_CAMINHO, 'utf8')
    if (/obs_archive_is_site_admin/.test(r)) expect(/create or replace function public\.obs_archive_is_site_admin\(p_site uuid, p_user uuid\)/.test(r)).toBe(true)
  })
})
```

(O segundo caso só passa depois da Tarefa 4; até lá ele fica com `it.todo` e vira `it` na Tarefa 4, Passo 1.) Run → FAIL (o rascunho não existe).

- [ ] **Passo 2. Os testes do registro, falhando.** `apps/web/test/integration/manutencao-m3b-registro.test.ts`, todos dentro de `begin … rollback`, com `aplicarM2`, a M10a e `aplicarM3b(c, 1)`:

| Teste | Afirma |
|---|---|
| `as 15 tabelas existem, com RLS e sem FK para canal, vídeo ou site` | `relrowsecurity` em todas; `pg_constraint` de tipo `f` só entre tabelas do registro (`obs_archive_unit_parts → units`, `obs_archive_unit_attachments → units`) |
| `a classe faz parte da chave em units, months, restores, prechecks e purges` (item 131) | `pg_index` único de cada uma contém a coluna `class` |
| `duas unidades do bruto, uma por classe, coexistem` (item 131) | `insert` direto como dono de (`texto`, `competitor_raw`, canal, mês) e (`video_antigo`, `competitor_raw`, canal, mês), as duas passam |
| `o gatilho recusa o par fora da política` | (`serie`, `competitor_raw`) → `classe_tabela_invalida` (P0001), nas cinco tabelas |
| `a política é a mesma lista do TypeScript` | `select class, table_name from obs_archive_policy()` igual a `TABELAS_DA_CLASSE` (importado de `contrato.ts`) |
| `na M3b nenhuma classe está liberada` (D12) | `bool_or(released)` é falso |
| `checks: purged, lost e absent juntos ou nenhum` | cada trio pela metade recusa (`23514`) |
| `índices de P36` | `obs_archive_units (site_id, channel_ref)`, `obs_archive_summaries (site_id, channel_ref)` e o parcial `obs_archive_channel_removals (site_id) where completed_at is null` existem |
| `permissões: nenhuma escrita para authenticated, anon e service_role` (K3) | `has_table_privilege(r, t, p)` falso para `r` em (`authenticated`, `anon`, `service_role`), `p` em (`insert`, `update`, `delete`, `truncate`) nas 15 tabelas; `has_table_privilege('service_role', t, 'select')` verdadeiro; `has_function_privilege('anon', 'public.obs_archive_policy()', 'execute')` falso; `has_function_privilege('service_role', 'public.obs_archive_class_table_guard()', 'execute')` falso |
| `obs_archive_is_site_admin: org_admin do site sim, editor não, org_admin de raiz sim, usuário inexistente não` | quatro usuários semeados em `organization_members` e `site_memberships` |
| `a M2 lê o registro de verdade` (M2, linha 2537) | com uma linha `obs_archive_months` de (`serie`, `competitor_video_daily`, mês + 3) com `detached_at`, `obs_partitions_ensure(12)` não recria esse mês |

Run → FAIL.

- [ ] **Passo 3. A parte 1 do rascunho.** Criar `supabase/rascunhos/m3b.sql`:

```sql
-- Manutenção M3b: o arquivo durável (spec 2026-10-13-fase-manutencao-nas, 02 §10). RASCUNHO até a Tarefa 10 do plano M3b-site
-- (TRAVA M3b-1): não mover para supabase/migrations à mão; o dia é o de `npm run db:new manutencao_m3b_arquivo`.
-- Depende de: M2 (obs_archive_rehearsal, obs_partitions_ensure) e M10a (competitor_videos.archive_frozen_at) em produção.
-- Idempotente: create ... if not exists, create or replace function, drop ... if exists antes de create policy/trigger.

-- M3B PARTE 1: o registro, a política e o administrador do site

-- A política fechada (02 §10.3). Mudada só por migration; `released` falso em tudo na M3b (D12).
create or replace function public.obs_archive_policy()
returns table (class text, table_name text, exit_mode text, window_months int, seal_margin_days int, wait_days int,
               auto_allowed text, released boolean, control_column text, filho text)
language sql immutable set search_path = '' as $$
  values
    ('horaria', 'competitor_video_hourly', 'particao', 3, 28, 7, 'depois_de_3', false, 'views', 'numerico'),
    ('serie', 'competitor_video_daily', 'particao', 6, 28, 7, 'depois_de_3', false, 'views', 'numerico'),
    ('serie', 'competitor_video_early', 'particao', 6, 28, 7, 'depois_de_3_da_tabela', false, 'views', 'numerico'),
    ('texto', 'competitor_video_comments', 'faixa', 6, 45, 0, 'nunca', false, null, 'texto'),
    ('texto', 'competitor_video_comment_marks', 'faixa', 6, 45, 0, 'nunca', false, 'likes', 'texto'),
    ('texto', 'competitor_raw', 'faixa', 6, 45, 0, 'nunca', false, null, 'texto'),
    ('ensaio', 'obs_archive_rehearsal', 'particao', 6, 28, 1, 'nunca', false, 'views', 'numerico'),
    ('video_antigo', 'competitor_video_versions', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_field_versions', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_raw', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_video_tier_spans', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_video_comment_snaps', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_hour_fold_log', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_changes', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_readings', 'lista', 0, 28, 0, 'nunca', false, null, 'texto')
$$;
revoke all on function public.obs_archive_policy() from public, anon, authenticated;
grant execute on function public.obs_archive_policy() to service_role;

-- O administrador do site (02 §10.5, condição 11; pedido 13). Mesma assinatura e regra da MG6 da E10 (plano E10 :1402-1416):
-- o parâmetro chama-se p_user; create or replace com outro nome falharia quando a E10 chegar.
create or replace function public.obs_archive_is_site_admin(p_site uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.organization_members om
      join public.organizations o on o.id = om.org_id
      join public.sites s on s.id = p_site
     where om.user_id = p_user and om.role = 'org_admin'
       and (om.org_id = s.org_id or o.parent_org_id is null)
  ) and exists (select 1 from auth.users u where u.id = p_user);
$$;
revoke all on function public.obs_archive_is_site_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_is_site_admin(uuid, uuid) to service_role;

-- As classes do registro (check) e o par (classe, tabela) da política (gatilho).
create or replace function public.obs_archive_class_table_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.obs_archive_policy() p where p.class = new.class and p.table_name = new.table_name) then
    raise exception 'classe_tabela_invalida' using errcode = 'P0001', detail = new.class || '/' || new.table_name;
  end if;
  return new;
end $$;

create table if not exists public.obs_archive_units (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  class text not null check (class in ('horaria', 'serie', 'texto', 'video_antigo', 'ensaio')),
  table_name text not null,
  channel_ref text not null check (channel_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  month date not null check (month = date_trunc('month', month)::date),
  version integer not null check (version between 1 and 9999),
  row_count bigint not null check (row_count >= 0),
  control_sum numeric,
  hash_conteudo text not null check (hash_conteudo ~ '^[0-9a-f]{64}$'),
  schema_fp text not null check (schema_fp ~ '^[0-9a-f]{64}$'),
  sha256_bytes text check (sha256_bytes ~ '^[0-9a-f]{64}$'),
  csv_sha256 text check (csv_sha256 ~ '^[0-9a-f]{64}$'),
  file_bytes bigint check (file_bytes >= 0),
  parts smallint not null default 1 check (parts between 1 and 99),
  min_key text, max_key text,
  origem text not null default 'rota' check (origem in ('rota', 'expurgo')),
  exported_at timestamptz not null default now(),
  received_at timestamptz, received_sha256 text, received_row_count bigint, received_control_sum numeric,
  nas_attested_at timestamptz,
  nas_withdrawn_at timestamptz,
  nas_withdrawn_reason text check (nas_withdrawn_reason in ('ausente', 'divergente', 'conteudo_divergente')),
  absent_first_at timestamptz, absent_last_at timestamptz,
  redo_reason text check (redo_reason in ('arquivo_ausente', 'divergente', 'conteudo_divergente', 'conteudo_mudou', 'mudou_durante_a_leitura', 'parte_mudou')),
  superseded_at timestamptz,
  dropped_at timestamptz, dropped_by uuid,
  purged_at timestamptz, purged_by uuid, purge_ref text,
  lost_at timestamptz, lost_by text, lost_reason text check (lost_reason in ('ausente_nas_e_b2', 'nunca_recebida')),
  unique (site_id, class, table_name, channel_ref, month, version),
  check ((row_count = 0) = (sha256_bytes is null)),
  check ((purged_at is null) = (purged_by is null) and (purged_at is null) = (purge_ref is null)),
  check ((lost_at is null) = (lost_by is null) and (lost_at is null) = (lost_reason is null)),
  check ((absent_first_at is null) = (absent_last_at is null) and (absent_last_at is null or absent_last_at >= absent_first_at)),
  check ((nas_withdrawn_at is null) = (nas_withdrawn_reason is null))
);
create index if not exists idx_oau_site_channel on public.obs_archive_units (site_id, channel_ref);          -- P36
create index if not exists idx_oau_month on public.obs_archive_units (site_id, class, month);
create index if not exists idx_oau_pending on public.obs_archive_units (site_id) where received_at is null and purged_at is null and lost_at is null;

create table if not exists public.obs_archive_unit_parts (
  unit_id uuid not null references public.obs_archive_units(id) on delete restrict,
  part smallint not null check (part between 1 and 99),
  sha256_bytes text not null check (sha256_bytes ~ '^[0-9a-f]{64}$'),
  csv_sha256 text not null check (csv_sha256 ~ '^[0-9a-f]{64}$'),
  file_bytes bigint not null, row_count bigint not null, control_sum numeric,
  row_offset bigint not null check (row_offset >= 0),
  min_key text, max_key text,
  received_at timestamptz, received_sha256 text, received_row_count bigint, received_control_sum numeric,
  nas_attested_at timestamptz, nas_withdrawn_at timestamptz,
  nas_withdrawn_reason text check (nas_withdrawn_reason in ('ausente', 'divergente', 'conteudo_divergente')),
  primary key (unit_id, part)
);

create table if not exists public.obs_archive_months (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  class text not null check (class in ('horaria', 'serie', 'texto', 'video_antigo', 'ensaio')),
  table_name text not null,
  month date not null check (month = date_trunc('month', month)::date),
  units_total integer, units_empty integer, rows_total bigint, days_measured integer, days_in_month integer,
  manifest_version integer, manifest_sha256 text, manifest_list_sha256 text, manifest_bytes bigint, manifest_list_bytes bigint,
  manifest_received_at timestamptz, manifest_nas_attested_at timestamptz, manifest_nas_withdrawn_at timestamptz,
  sealed_at timestamptz, sealed_version integer, sealed_kind text check (sealed_kind in ('com_dado', 'vazio_conferido', 'sem_dado_a_guardar')),
  nas_attested_at timestamptz,
  b2_forja_ok_at timestamptz, b2_forja_manifest_sha256 text, b2_dono_ok_at timestamptz, b2_dono_manifest_sha256 text, b2_dono_by text,
  b2_attested_at timestamptz, b2_attested_by text, b2_attested_via text check (b2_attested_via in ('forja', 'dono')), b2_manifest_sha256 text,
  b2_last_attempt_at timestamptz, b2_last_attempt_result text, b2_last_attempt_via text check (b2_last_attempt_via in ('forja', 'dono')),
  b2_withdrawn_at timestamptz, b2_withdrawn_reason text, b2_withdrawn_via text check (b2_withdrawn_via in ('forja', 'dono')),
  b2_forja_diverged_at timestamptz,
  detached_at timestamptz, detached_by uuid,
  dropped_at timestamptz, dropped_by uuid, drop_mode text check (drop_mode in ('clique', 'automatico')), rows_dropped bigint, bytes_freed bigint,
  closed_at timestamptz, closed_by uuid,
  unsealed_at timestamptz, unsealed_reason text check (unsealed_reason in ('conteudo_mudou', 'mudou_no_destaque', 'unidade_nova')),
  unique (site_id, class, table_name, month)
);
create index if not exists idx_oam_detached on public.obs_archive_months (site_id) where detached_at is not null and dropped_at is null;

create table if not exists public.obs_archive_prechecks (
  site_id uuid not null, class text not null, table_name text not null, month date not null, channel_ref text not null,
  checked_at timestamptz not null default now(),
  primary key (site_id, class, table_name, month, channel_ref)
);
create table if not exists public.obs_archive_restores (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null, class text not null, table_name text not null, schema_fp text not null,
  origem text not null check (origem = 'b2'), chave text not null check (chave = 'cofre'),
  units_checked integer not null, rows_restored bigint not null, diff_rows bigint not null,
  done_by text not null, done_at timestamptz not null default now()
);
create index if not exists idx_oar_class_table on public.obs_archive_restores (site_id, class, table_name, done_at desc);
create table if not exists public.obs_archive_switch (
  site_id uuid not null, class text not null check (class in ('horaria', 'serie', 'texto', 'video_antigo', 'ensaio')),
  armed_by uuid, armed_at timestamptz, expires_at timestamptz, disarmed_at timestamptz, disarm_reason text,
  refusals_nas integer not null default 0,
  first_month date, first_month_at timestamptz,      -- D13: início da classe, calculado uma vez pelo plano e lido daqui (Phil M7)
  primary key (site_id, class)
);
create table if not exists public.obs_archive_heartbeat (
  site_id uuid not null, worker text not null check (worker in ('copiador', 'respondedor', 'conferir_b2')),
  last_poll_at timestamptz, version text, nas_ok boolean, nas_checked_at timestamptz,
  sentinel_ok jsonb, mounts_ok jsonb, machine_time timestamptz, free_bytes jsonb, total_bytes jsonb,
  stopped_at_cap text check (stopped_at_cap in ('dia', 'mes')),   -- C8: parado_no_teto, só do conferir_b2
  last_error text, updated_at timestamptz,
  primary key (site_id, worker)
);
create table if not exists public.obs_archive_purges (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null, class text not null, table_name text not null, channel_ref text not null, month date not null,
  from_version integer not null, to_version integer not null, rows_removed bigint not null, done_at timestamptz not null default now()
);
create table if not exists public.obs_archive_unit_attachments (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  unit_id uuid not null references public.obs_archive_units(id) on delete restrict,
  class text not null default 'video_antigo' check (class = 'video_antigo'),
  channel_ref text not null,
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'), ext text check (ext in ('jpg', 'png', 'webp')), file_bytes bigint,
  origin_url text not null, blob_url text,
  estado text not null default 'pendente' check (estado in ('pendente', 'baixado', 'perdida_na_origem', 'recusado')),
  missing_first_at timestamptz, missing_last_at timestamptz,
  received_at timestamptz, nas_attested_at timestamptz, nas_withdrawn_at timestamptz,
  nas_withdrawn_reason text check (nas_withdrawn_reason in ('ausente', 'divergente'))
);
create index if not exists idx_oaua_channel on public.obs_archive_unit_attachments (site_id, channel_ref);
create table if not exists public.obs_archive_summaries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  class text not null check (class in ('horaria', 'serie', 'texto', 'video_antigo', 'ensaio')),
  channel_ref text not null, month date not null, version integer not null check (version between 1 and 9999),
  empty boolean not null,
  canal_sha256 text, canal_bytes bigint, canal_rows integer,
  video_sha256 text, video_bytes bigint, video_rows integer,
  ficha_sha256 text, ficha_bytes bigint, ficha_rows integer,
  unit_hashes jsonb not null,                       -- {"u:<id>": "<hash_conteudo>"} das unidades de que foi gerado
  exported_at timestamptz not null default now(), received_at timestamptz,
  nas_attested_at timestamptz, nas_withdrawn_at timestamptz,
  nas_withdrawn_reason text check (nas_withdrawn_reason in ('ausente', 'divergente', 'conteudo_divergente')),
  superseded_at timestamptz, lost_at timestamptz,
  purged_at timestamptz, purged_by uuid, purge_ref text,
  unique (site_id, class, channel_ref, month, version),
  check (empty = (canal_sha256 is null)),
  check ((purged_at is null) = (purged_by is null))
);
create index if not exists idx_oas_site_channel on public.obs_archive_summaries (site_id, channel_ref);       -- P36
create table if not exists public.obs_archive_channel_removals (
  site_id uuid not null, channel_ref text not null,
  youtube_channel_id text, name_at_removal text,
  removed_at timestamptz, removed_by uuid,
  removed_via text not null check (removed_via in ('botao', 'fila', 'e10_export', 'vigia')),
  archive_decision text not null check (archive_decision in ('apagar', 'guardar')),
  decided_at timestamptz not null, decided_by uuid,
  units_at_removal integer not null default 0, bytes_at_removal bigint not null default 0, first_month date, last_month date,
  removed_item_id bigint,
  blobs_pending text[] not null default '{}',
  online_thumbs_known boolean not null,
  thumbs_unknown_ack_at timestamptz,
  declared_xid xid8,
  nas_absent_first_at timestamptz, nas_absent_at timestamptz, b2_absent_at timestamptz, snapshots_clear_on date,
  completed_at timestamptz, reappeared_at timestamptz, reappeared_count integer not null default 0,
  primary key (site_id, channel_ref),
  check (archive_decision = 'apagar' or removed_via = 'e10_export')
);
create index if not exists idx_oacr_open on public.obs_archive_channel_removals (site_id) where completed_at is null;    -- P36

-- D5: o que o spec descreve sem dizer onde mora.
create table if not exists public.obs_archive_b2_runs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null, started_at timestamptz not null default now(), expires_at timestamptz not null,
  modo text not null check (modo in ('normal', 'completo')),
  negative_name text not null, negative_filho text not null check (negative_filho in ('numerico', 'texto')),
  canary_days jsonb not null,                        -- {"numerico": "AAAA-MM-DD" | null, "texto": ...}
  negative_ok boolean, canary_ok jsonb not null default '{}'::jsonb,   -- {"numerico": true|false}
  estado text not null default 'aguardando_controle' check (estado in ('aguardando_controle', 'controle_ok', 'controle_falhou')),
  files_reported integer not null default 0,
  -- r2.2 (I3 do Phil): a retomada do completo entre execuções. Nulas no modo normal.
  completo_desde timestamptz,                        -- início do completo em aberto; herdado pela execução que retoma
  retomado_de text,                                  -- o cursor de onde esta execução partiu (null = do zero)
  paginas jsonb not null default '[]'::jsonb,        -- páginas servidas aqui, em ordem: [{"ate": <arquivo_id>, "ids": [...], "ultima": bool, "aceita": bool}]
  paginas_aceitas integer not null default 0,        -- herdadas + aceitas aqui
  paginas_total integer,                             -- na abertura: aceitas + páginas de 500 que faltam
  cursor_aceito text,                                -- `<execucao_id>|<arquivo_id>` da última página aceita; herdado
  completo_fechado_em timestamptz,                   -- hora do banco em que a última página foi aceita
  -- r2.2 (M6 do Phil): o histórico do teto de bytes, marcado pelo batimento do conferir_b2.
  batimento_em timestamptz,
  parou_no_teto text check (parou_no_teto in ('dia', 'mes'))
);
create index if not exists idx_oab2r_completo on public.obs_archive_b2_runs (site_id, started_at desc) where modo = 'completo';
create table if not exists public.obs_archive_b2_files (
  site_id uuid not null, arquivo_id text not null, class text not null, month date not null,
  last_ok_at timestamptz, last_ok_via text check (last_ok_via in ('forja', 'dono')), last_ok_file_id text, last_ok_upload_ts bigint,
  last_attempt_at timestamptz, last_attempt_result text, last_attempt_run uuid,
  pending_mismatch jsonb, pending_since timestamptz, pending_run uuid,
  primary key (site_id, arquivo_id)
);
create index if not exists idx_oabf_month on public.obs_archive_b2_files (site_id, class, month);
create table if not exists public.obs_archive_canaries (
  site_id uuid not null, filho text not null check (filho in ('numerico', 'texto')), dia date not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'), informed_at timestamptz not null default now(),
  b2_ok_at timestamptz, b2_file_id text, b2_failed_at timestamptz,
  primary key (site_id, filho, dia)
);
create table if not exists public.obs_archive_sweeps (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null, due_since timestamptz not null, nas_back_at timestamptz, started_at timestamptz, finished_at timestamptz,
  motivo text not null check (motivo in ('silencio_nas', 'pedido'))
);
create unique index if not exists idx_oasw_open on public.obs_archive_sweeps (site_id) where finished_at is null;

alter table public.competitor_removed_items add column if not exists archive_note text;     -- D15

do $$
declare t text;
begin
  foreach t in array array['obs_archive_units', 'obs_archive_unit_parts', 'obs_archive_months', 'obs_archive_prechecks', 'obs_archive_restores',
    'obs_archive_switch', 'obs_archive_heartbeat', 'obs_archive_purges', 'obs_archive_unit_attachments', 'obs_archive_summaries',
    'obs_archive_channel_removals', 'obs_archive_b2_runs', 'obs_archive_b2_files', 'obs_archive_canaries', 'obs_archive_sweeps'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    -- K3: os privilégios padrão do Supabase dão tudo ao service_role; o registro só se escreve pelas funções.
    execute format('revoke insert, update, delete, truncate, references, trigger on table public.%I from service_role', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    if t = 'obs_archive_unit_parts' then
      execute format('create policy %I on public.%I for select using (exists (select 1 from public.obs_archive_units u where u.id = unit_id and public.can_edit_site(u.site_id)))', t || '_select', t);
    else
      execute format('create policy %I on public.%I for select using (public.can_edit_site(site_id))', t || '_select', t);
    end if;
    execute format('grant select on table public.%I to authenticated', t);
  end loop;
  foreach t in array array['obs_archive_units', 'obs_archive_months', 'obs_archive_restores', 'obs_archive_prechecks', 'obs_archive_purges'] loop
    execute format('drop trigger if exists obs_archive_class_table on public.%I', t);
    execute format('create trigger obs_archive_class_table before insert or update of class, table_name on public.%I for each row execute function public.obs_archive_class_table_guard()', t);
  end loop;
end $$;
revoke all on function public.obs_archive_class_table_guard() from public, anon, authenticated, service_role;
```

(`grant select ... to authenticated` existe só para a policy de leitura valer na tela: a escrita continua sem concessão para ninguém além do dono das tabelas, inclusive o `service_role`; o teste "nenhuma escrita" confere. NÃO VERIFICADO no projeto: os privilégios padrão do `service_role` em produção; a conferência da Tarefa 10, Passo 5, lê `has_table_privilege('service_role', 'public.obs_archive_units', 'insert')` = falso.)

- [ ] **Passo 4.** Run os dois arquivos de teste → PASS (o caso D17 ainda `todo`). Run também os testes da M2 (`manutencao-m2-particoes.test.ts`) com o novo caso "a M2 lê o registro de verdade".
- [ ] **Passo 5. Confirmar no banco local** (uma vez, só a parte 1, para as Tarefas seguintes testarem contra ela; o `bythiago_int` já tem a M2 e a M10a): `psql -p 54422 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$(sed -n '1,/-- M3B PARTE 2/p' supabase/rascunhos/m3b.sql)"`. Registrar no ledger. Rodar de novo: nada muda (idempotência).
- [ ] **Passo 6.** Conferir as colunas obrigatórias usadas por `semearCanal` (`\d public.sites`, `\d public.competitor_channels`, `\d public.competitor_videos` no 54422) e ajustar o helper.
- [ ] **Passo 7. Commit** (`git add --` dos três arquivos novos antes):

```bash
git add -- supabase/rascunhos/m3b.sql apps/web/test/helpers/m3b.ts apps/web/test/integration/manutencao-m3b-registro.test.ts
git commit -m "feat: rascunho da M3b, parte 1: registro com a classe na chave, política e administrador do site (manutenção M3b)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m3b.sql apps/web/test/helpers/m3b.ts apps/web/test/integration/manutencao-m3b-registro.test.ts apps/web/test/manutencao/migrations-leitura.test.ts
```

---

### Task 4: SQL parte 2, o leitor único e as duas funções de hash (corpo num arquivo só)

**Files:**
- Create: `supabase/sql/obs-archive-hash.sql`
- Modify: `supabase/rascunhos/m3b.sql` (parte 2: inclui o arquivo acima entre marcadores, byte a byte)
- Modify: `apps/web/test/manutencao/migrations-leitura.test.ts` (o caso D17 deixa de ser `todo`)
- Create: `apps/web/test/integration/manutencao-m3b-leitor.test.ts`

**Interfaces:**
- Produces (SQL, todas com os cinco ajustes de sessão no cabeçalho e `search_path` vazio):
  - `obs_archive_schema_fp(p_rel regclass) returns text`
  - `obs_archive_unit_source(p_class text, p_table text) returns table (rel regclass, from_where text, order_by text, control_expr text)` (interna; sem `execute` para ninguém além do dono)
  - `obs_archive_content_hash(p_site uuid, p_class text, p_table text, p_channel uuid, p_month date) returns table (row_count bigint, control_sum text, hash_conteudo text)`
  - `obs_archive_read_unit(p_site uuid, p_class text, p_table text, p_channel uuid, p_month date, p_offset bigint, p_limit integer) returns table (rows jsonb, row_count bigint, control_sum text, hash_conteudo text, columns jsonb, schema_fp text, first_key text, last_key text)` (D2; `execute` para `service_role`). **`control_sum` é texto** (Phil M1): pela PostgREST um `numeric` chega como número JSON e o `JSON.parse` arredonda acima de 2^53; o TypeScript compara texto
- `rows` é a matriz de textos (nulo como `null` do JSON) das linhas de posição `p_offset + 1` a `p_offset + p_limit` na ordem da chave primária; `row_count`, `control_sum` e `hash_conteudo` são **da unidade inteira**, da mesma instrução.

**O que acontece quando o dado não existe:** unidade sem linha devolve `rows = []`, `row_count = 0`, `control_sum` nulo (sem coluna de controle) ou `0` (com), e o hash do texto vazio (`e3b0c442...b855`); tabela que não existe no banco lança `tabela_ausente` (P0001), nunca zero linha; par fora da política lança `classe_tabela_invalida`.

- [ ] **Passo 1. Testes, falhando.** `manutencao-m3b-leitor.test.ts`, com `aplicarM3b(c, 2)` em `begin … rollback`:

| Teste | Afirma |
|---|---|
| `uma linha só, com 2.500 linhas na unidade` (item 75) | `read_unit(..., 0, 5000)` devolve 1 linha com `jsonb_array_length(rows) = 2500` e `row_count = 2500` |
| `as partes por posição trazem os totais da unidade inteira` | `read_unit(..., 0, 1000)`, `(..., 1000, 1000)`, `(..., 2000, 1000)`: os três `hash_conteudo` iguais, as três `row_count` = 2500, e a concatenação das `rows` é igual à de `(..., 0, 5000)` |
| `hash e leitor concordam` | `content_hash` igual ao `hash_conteudo` de `read_unit` |
| `o hash muda com uma linha a mais e volta com ela apagada` | |
| `o mês é o de São Paulo` | linha horária em `2026-11-01 02:00 UTC` (23:00 de 31/10 em SP) entra em outubro e não em novembro |
| `o mês da conversa` (02 §10.3) | resposta com `first_seen_at` em novembro a um comentário de outubro entra na unidade de outubro, e sua marca também |
| `o bruto nas duas classes` (item 131) | versão não corrente com `last_seen_at` em dezembro vai só para (`texto`, `competitor_raw`, dezembro); versão corrente de vídeo com `archive_frozen_at` em dezembro vai só para (`video_antigo`, `competitor_raw`, dezembro); nenhuma linha aparece nas duas |
| `outro canal e outro site não entram` | linhas de outro canal do mesmo site e do mesmo canal em outro site ficam fora |
| `nulo, texto vazio e bigint acima de 2^53 voltam como texto` | `rows` traz `null`, `""` e `"9007199254740993"`; e `control_sum` de duas linhas `views` 9007199254740993 e 2 é o texto `"9007199254740995"` (Phil M1) |
| `schema_fp muda com coluna nova; muda quando a ordem das colunas muda; não muda com alter column set default` (Phil M2) | recriar coluna no fim muda a ordem por `attnum`, e o CSV sai em outra ordem: por isso muda |
| `tabela ausente lança, nunca zero` | `obs_archive_rehearsal` renomeada dentro da transação → `tabela_ausente` |
| `as funções fixam a sessão` | com `set timezone = 'America/Sao_Paulo'` e `extra_float_digits = 0` na sessão, o `hash_conteudo` é o mesmo |
| `o mesmo CSV pelos dois caminhos` (item 22) | a fonte montada pela rota (rpc falso que devolve o resultado de `read_unit`) e a do terminal (`pg`) dão o mesmo `exportarUnidade(...).csvSha256`; e o `consultaDoArquivo` da E10 para a diária do mesmo mês devolve as mesmas linhas, na mesma ordem |
| `o SQL nunca monta CSV` (item 22) | `prosrc` das três funções não contém `E'\n' \|\| ` nem `,` como separador de campo: só `string_agg(r::text, E'\n')` do hash |

Run → FAIL.

- [ ] **Passo 2. `supabase/sql/obs-archive-hash.sql`** (o corpo único, D17):

```sql
-- O corpo único de obs_archive_schema_fp, obs_archive_unit_source, obs_archive_content_hash e obs_archive_read_unit (spec 02 §9.3,
-- decisão B; §10.4). Lido pela migration da M3b (byte a byte, entre marcadores) e pelo comando ensaiar-restauracao (M8).
-- Os cinco ajustes de sessão ficam no cabeçalho de cada função: o resultado não depende de quem chama.

create or replace function public.obs_archive_schema_fp(p_rel regclass)
returns text language sql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
  select encode(sha256(convert_to(string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod), E'\n' order by a.attnum), 'UTF8')), 'hex')
    from pg_catalog.pg_attribute a
   where a.attrelid = p_rel and a.attnum > 0 and not a.attisdropped
$$;

create or replace function public.obs_archive_unit_source(p_class text, p_table text)
returns table (rel regclass, from_where text, order_by text, control_expr text)
language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
-- $1 site, $2 canal, $3 mês (date, dia 1), $4 início e $5 fim do mês em São Paulo com -03 explícito (timestamptz), $6 dia 1 do mês seguinte (date)
declare
  v_rel regclass := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(p_table));
  v_pol record;
  v_pk text;
  -- competitor_videos não tem site_id: o site vem do canal (Phil I1; 20261007000002_...:37).
  v_video text := 'join public.competitor_videos v on v.id = t.video_id join public.competitor_channels ch on ch.id = v.competitor_channel_id where ch.site_id = $1 and v.competitor_channel_id = $2';
begin
  select * into v_pol from public.obs_archive_policy() p where p.class = p_class and p.table_name = p_table;
  if not found then raise exception 'classe_tabela_invalida' using errcode = 'P0001', detail = p_class || '/' || p_table; end if;
  if v_rel is null then raise exception 'tabela_ausente' using errcode = 'P0001', detail = p_table; end if;
  select string_agg('t.' || pg_catalog.quote_ident(a.attname), ', ' order by k.ord) into v_pk
    from pg_catalog.pg_index i
    cross join lateral unnest(i.indkey) with ordinality k(attnum, ord)
    join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
   where i.indrelid = v_rel and i.indisprimary;
  if v_pk is null then raise exception 'sem_chave_primaria' using errcode = 'P0001', detail = p_table; end if;
  rel := v_rel; order_by := v_pk;
  control_expr := case when v_pol.control_column is null then 'null::numeric' else 't.' || pg_catalog.quote_ident(v_pol.control_column) || '::numeric' end;
  from_where := case
    when p_class = 'horaria' then format('from public.%I t %s and t.hour_slot >= $4 and t.hour_slot < $5', p_table, v_video)
    when p_class = 'ensaio' then 'from public.obs_archive_rehearsal t join public.competitor_videos v on v.id = t.video_id where t.site_id = $1 and v.competitor_channel_id = $2 and t.hour_slot >= $4 and t.hour_slot < $5'
    when p_table = 'competitor_video_daily' then format('from public.%I t %s and t.snap_date >= $3 and t.snap_date < $6', p_table, v_video)
    when p_table = 'competitor_video_early' then format('from public.%I t %s and t.taken_at >= $4 and t.taken_at < $5', p_table, v_video)
    when p_class = 'texto' and p_table = 'competitor_video_comments' then
      'from public.competitor_video_comments t left join public.competitor_video_comments p on p.id = t.parent_id
        where t.site_id = $1 and t.competitor_channel_id = $2 and coalesce(p.first_seen_at, t.first_seen_at) >= $4 and coalesce(p.first_seen_at, t.first_seen_at) < $5'
    when p_class = 'texto' and p_table = 'competitor_video_comment_marks' then
      'from public.competitor_video_comment_marks t join public.competitor_video_comments k on k.id = t.comment_id
        left join public.competitor_video_comments p on p.id = k.parent_id
        where k.site_id = $1 and k.competitor_channel_id = $2 and coalesce(p.first_seen_at, k.first_seen_at) >= $4 and coalesce(p.first_seen_at, k.first_seen_at) < $5'
    when p_class = 'texto' and p_table = 'competitor_raw' then
      'from public.competitor_raw t where t.site_id = $1 and t.competitor_channel_id = $2 and not t.is_current and t.last_seen_at >= $4 and t.last_seen_at < $5'
    when p_class = 'video_antigo' and p_table = 'competitor_raw' then
      format('from public.competitor_raw t %s and t.is_current and v.archive_frozen_at >= $4 and v.archive_frozen_at < $5', v_video)
    when p_class = 'video_antigo' then
      format('from public.%I t %s and v.archive_frozen_at >= $4 and v.archive_frozen_at < $5', p_table, v_video)
  end;
  return next;
end $$;

create or replace function public.obs_archive_read_unit(p_site uuid, p_class text, p_table text, p_channel uuid, p_month date, p_offset bigint, p_limit integer)
returns table (rows jsonb, row_count bigint, control_sum text, hash_conteudo text, columns jsonb, schema_fp text, first_key text, last_key text)
language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
declare
  s record; v_cols text; v_colnames jsonb; v_keyexpr text;
  v_ini timestamptz := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := (((p_month + interval '1 month')::date)::text || ' 00:00:00-03')::timestamptz;
begin
  if p_month <> date_trunc('month', p_month)::date then raise exception 'mes_invalido' using errcode = 'P0001'; end if;
  if p_offset < 0 or p_limit < 1 or p_limit > 50000 then raise exception 'faixa_invalida' using errcode = 'P0001'; end if;
  select * into s from public.obs_archive_unit_source(p_class, p_table);
  select string_agg('t.' || pg_catalog.quote_ident(a.attname) || '::text', ', ' order by a.attnum),
         jsonb_agg(jsonb_build_object('nome', a.attname, 'tipo', pg_catalog.format_type(a.atttypid, a.atttypmod), 'nulo', not a.attnotnull) order by a.attnum)
    into v_cols, v_colnames
    from pg_catalog.pg_attribute a where a.attrelid = s.rel and a.attnum > 0 and not a.attisdropped;
  v_keyexpr := 'concat_ws(''|'', ' || s.order_by || ')';
  return query execute format(
    'with u as (select to_jsonb(array[%1$s]::text[]) as r, %2$s as k, %3$s as c, row_number() over (order by %4$s) as n %5$s)
     select (select coalesce(jsonb_agg(u.r order by u.n), ''[]''::jsonb) from u where u.n > $7 and u.n <= $7 + $8),
            (select count(*) from u)::bigint,
            (coalesce((select sum(u.c) from u), $11::numeric))::text,
            (select encode(sha256(convert_to(coalesce(string_agg(u.r::text, E''\n'' order by u.n), ''''), ''UTF8'')), ''hex'') from u),
            $9::jsonb, public.obs_archive_schema_fp($10),
            (select u.k from u where u.n = $7 + 1),
            (select u.k from u where u.n = least($7 + $8, (select count(*) from u)))',
    v_cols, v_keyexpr, s.control_expr, s.order_by, s.from_where)
  using p_site, p_channel, p_month, v_ini, v_fim, (p_month + interval '1 month')::date, p_offset, p_limit, v_colnames, s.rel,
        case when s.control_expr = 'null::numeric' then null::numeric else 0::numeric end;
end $$;

create or replace function public.obs_archive_content_hash(p_site uuid, p_class text, p_table text, p_channel uuid, p_month date)
returns table (row_count bigint, control_sum text, hash_conteudo text)
language sql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
  select r.row_count, r.control_sum, r.hash_conteudo from public.obs_archive_read_unit(p_site, p_class, p_table, p_channel, p_month, 0, 1) r
$$;
```

**Por que `content_hash` chama o leitor com `p_limit` 1:** um corpo só para o hash (princípio 5); o custo da matriz de uma linha é desprezível. **Ressalva NÃO MEDIDA:** o `with u as (...)` referenciado várias vezes é materializado uma vez no Postgres 12+; o `explain analyze` do Passo 5 confere que a tabela é lida uma vez só. Sem coluna de controle, a soma é nula (o `$11` nulo); com coluna e sem linha não nula, é `0` (o `coalesce` com o `$11` igual a `0`).

- [ ] **Passo 3. A parte 2 no rascunho:**

```sql
-- M3B PARTE 2: o leitor único e os hashes. O trecho entre os marcadores é supabase/sql/obs-archive-hash.sql, byte a byte (D17).
-- obs-archive-hash.sql: início
-- (aqui entra supabase/sql/obs-archive-hash.sql inteiro, pelo comando abaixo; nunca à mão)
-- obs-archive-hash.sql: fim
revoke all on function public.obs_archive_schema_fp(regclass) from public, anon, authenticated;
revoke all on function public.obs_archive_unit_source(text, text) from public, anon, authenticated, service_role;
revoke all on function public.obs_archive_read_unit(uuid, text, text, uuid, date, bigint, integer) from public, anon, authenticated;
revoke all on function public.obs_archive_content_hash(uuid, text, text, uuid, date) from public, anon, authenticated;
grant execute on function public.obs_archive_read_unit(uuid, text, text, uuid, date, bigint, integer) to service_role;
grant execute on function public.obs_archive_content_hash(uuid, text, text, uuid, date) to service_role;
grant execute on function public.obs_archive_schema_fp(regclass) to service_role;
```

A inclusão é feita por comando, nunca à mão: `node -e "const f=require('fs');const r=f.readFileSync('supabase/rascunhos/m3b.sql','utf8');const h=f.readFileSync('supabase/sql/obs-archive-hash.sql','utf8');const a='-- obs-archive-hash.sql: início\n',b='-- obs-archive-hash.sql: fim';f.writeFileSync('supabase/rascunhos/m3b.sql',r.slice(0,r.indexOf(a)+a.length)+h+r.slice(r.indexOf(b)))"` (repetir a cada mudança no arquivo; o teste D17 acusa a esquecida).

- [ ] **Passo 4.** Run → PASS. O caso D17 do `migrations-leitura.test.ts` passa de `it.todo` a `it`.
- [ ] **Passo 5. Confirmar a parte 2 no banco local** (só funções) e medir a CP13 (Tarefa 0, Passo 5): `explain (analyze, buffers)` de uma chamada com 1.550 linhas mostra um `CTE Scan` sobre um único `Seq/Index Scan` da tabela. Registrar os números, o `TETO_LINHAS_POR_CHAMADA` e o `TETO_LINHAS_DA_UNIDADE` no ledger; se mudarem, editar `contrato.ts` no mesmo commit. A dívida do hash recalculado em toda página (D25, O(N²/L)) fica no ledger com o gatilho da Tarefa 0, Passo 5.
- [ ] **Passo 6. Commit:**

```bash
git add -- supabase/sql/obs-archive-hash.sql apps/web/test/integration/manutencao-m3b-leitor.test.ts
git commit -m "feat: rascunho da M3b, parte 2: leitor único da unidade e hashes em SQL, corpo num arquivo só (manutenção M3b, itens 22, 75 e 131)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/sql/obs-archive-hash.sql supabase/rascunhos/m3b.sql apps/web/test/integration/manutencao-m3b-leitor.test.ts apps/web/test/manutencao/migrations-leitura.test.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts
```

---

### Task 5: SQL parte 3, gravação, recebimento, resumo, manifesto, selagem e a conferência do NAS

**Files:**
- Modify: `supabase/rascunhos/m3b.sql` (parte 3)
- Create: `apps/web/test/integration/manutencao-m3b-selagem.test.ts`

**Interfaces:**
- Produces (SQL, `execute` só para `service_role`):
  - `obs_archive_due_on(p_month date, p_margin integer) returns date` (D20, `immutable`), `obs_archive_expected_units(p_site uuid, p_class text, p_month date) returns table (table_name text, channel_ref text)` (D19), `obs_archive_unit_due(p_site uuid, p_class text, p_table text, p_channel uuid, p_month date) returns boolean` (D24), `obs_archive_month_files(p_site uuid, p_class text, p_month date) returns table (arquivo_id text, tipo text, filho text, caminho text, table_name text, channel_ref text, version integer, control_column text, file_bytes bigint, received_at timestamptz, nas_attested_at timestamptz, b2_ok_at timestamptz)` (D23; `b2_ok_at` = `obs_archive_b2_files.last_ok_at`). As quatro são a fonte única: o plano, o atraso, o resumo, o manifesto, a selagem, o `reconferir`, o plano do B2 e o `pode_desligar` as chamam (teste de catálogo por `prosrc`).
  - `obs_archive_record(p_site uuid, p_kind text, p_payload jsonb) returns jsonb` (**sem** `p_origem`; `execute` do `service_role`), que só chama `obs_archive_record_core(p_site uuid, p_kind text, p_payload jsonb, p_origem text) returns jsonb` (**sem** `execute` para o `service_role`: o expurgo da M9 é função do dono e chama o `_core`; D22, K3) — **o único caminho de `insert`** em `obs_archive_units`, `obs_archive_unit_parts` e `obs_archive_summaries` (`02` §10.5, "Corrida com a exportação"). `p_kind` `'unidade'` ou `'resumo'`. Devolve `{status: 'nova'|'mesma'|'nao_devida'|'canal_removido'|'sem_destino'|'unidade_retirada'|'mes_aberto'|'mes_fora_do_banco', arquivo_id?, versao?}`.
  - `obs_archive_receive(p_site uuid, p_items jsonb) returns jsonb` (rota `unit/received`, contrato C6).
  - `obs_archive_unit_rehash(p_unit uuid) returns jsonb` — recalcula uma unidade (uma chamada por unidade: `02` §10.7); diferente grava `redo_reason = 'conteudo_mudou'` e devolve `{igual: false}`.
  - `obs_archive_summary_rows(p_site uuid, p_class text, p_channel uuid, p_month date) returns jsonb` — `{canal: [[...]], video: [[...]], colunas_canal: [...], colunas_video: [...], unit_hashes: {...}, vazio: bool}`; recusa `unidades_pendentes` (inclusive tabela esperada sem unidade), `canal_removido`, `ja_no_arquivo` e `resumo_da_m10b`.
  - `obs_archive_manifest_rows(p_site uuid, p_class text, p_month date) returns jsonb` — `{versao, gerado_em, arquivos: [...], contagens: {...}}`; recusa `unidades_pendentes` (inclusive par esperado sem unidade) e `resumos_pendentes`.
  - `obs_archive_record_manifest(p_site uuid, p_class text, p_month date, p_versao int, p_json_sha256 text, p_json_bytes bigint, p_list_sha256 text, p_list_bytes bigint) returns jsonb`.
  - `obs_archive_attest_nas(p_site uuid, p_body jsonb) returns jsonb` (rota `attest`, contrato C7.1).
  - Três leituras pequenas que as rotas usam (Tarefa 11) e que têm de estar na migration: `obs_archive_channel_units(p_site uuid, p_class text, p_channel uuid, p_month date) returns jsonb` (os `arquivo_id` do conjunto corrente do canal, para o recálculo um a um antes do resumo); `obs_archive_unit_part_info(p_site uuid, p_class text, p_table text, p_channel uuid, p_month date, p_part int) returns jsonb` (`{status: 'ok', unidade_id, versao, partes, de, ate, sha256, recebida}` da parte, com `de` = `row_offset` e `ate` = `row_offset + row_count`, só de versão não recebida; recebida ou ausente: `{status: 'nao_devida'}`; unidade com `purged_at` ou canal removido: `{status: 'canal_removido'}`, Phil M3; mês fora do banco: `{status: 'mes_fora_do_banco'}`); o esquema Zod `RespostaParteInfo` (Tarefa 1) tem exatamente esses campos; `obs_archive_mark_redo(p_unit uuid, p_reason text) returns void` (grava `redo_reason`; `parte_mudou` e `mudou_durante_a_leitura` vêm da rota). O `sha256_bytes` da parte só sai para a rota comparar no servidor: a rota nunca o devolve ao chamador.
  - Gatilho `obs_archive_insert_guard` (`before insert` em `obs_archive_units` e `obs_archive_summaries`).

**O que acontece quando o dado não existe:**
- Canal sem linha no mês: `obs_archive_record` grava a unidade **vazia conferida** (`row_count = 0`, sem arquivo, `received_at = exported_at`: D7). Mês em que todos os canais estão vazios sela como `vazio_conferido`.
- **Canal esperado sem unidade nenhuma** (exportação cortada, 409 pulado, orçamento da forja esgotado): é **pendente**, nunca terminal por vacuidade. O resumo dele, o manifesto e o selo esperam (D19, Phil C1). Unidade de par novo gravada num mês já selado o reabre (`unsealed_reason = 'unidade_nova'`).
- Mês fora do banco (`detached_at` ou `dropped_at`): nada se refaz a partir do online (`mes_fora_do_banco`, `ja_no_arquivo`, `pulada`); o que falta vai a `aguardando_dono` (Phil C3).
- Resumo de canal com todas as unidades vazias: linha com `empty = true`, sem arquivo, recebida na gravação (`02` §10.4, "Canal sem linha no mês").
- Unidade de canal removido: nunca recalculada, nunca refeita; carregada no manifesto como está (`02` §10.5).
- Mês com todas as unidades `purged_at`: sela como `sem_dado_a_guardar`, nunca `vazio_conferido`.
- `attest` de filho desmontado ou sem sentinela (`filhos` diz): nada é gravado (`nas_fora`), e a atestação antiga só vence pelo tempo.

- [ ] **Passo 1. Testes, falhando.** `manutencao-m3b-selagem.test.ts`, com `aplicarM3b(c, 3)` em `begin … rollback`, um canal semeado com 31 dias de diária em outubro e o relógio do mês fixado por `set local` de um parâmetro de teste (`obs_archive.hoje`, lido por `obs_archive_hoje_sp()`, que em produção é `(now() at time zone 'America/Sao_Paulo')::date`). Um caso escrito por inteiro, os demais na tabela:

```ts
it('a ordem do selo: unidades, resumo do canal, manifesto, e só então sealed_at (itens 77 e 158)', async () => {
  const { site, canal, videos } = await semearCanal(c, { videos: 2 })
  await semearDiaria(c, videos, '2026-10-03', 29)
  await c.query(`select set_config('obs_archive.hoje', '2026-11-28', true)`)
  const u = await unidadePelaRota(c, { site, classe: 'serie', tabela: 'competitor_video_daily', canal, mes: '2026-10-01' })   // helper: read_unit + exportarUnidade + obs_archive_record
  const e = await unidadePelaRota(c, { site, classe: 'serie', tabela: 'competitor_video_early', canal, mes: '2026-10-01' })     // vazia conferida
  expect(e.status).toBe('nova')
  expect(await selado(c, site, 'serie', '2026-10-01')).toBe(false)
  await receber(c, site, [{ arquivo_id: u.arquivo_id, sha256: u.sha256, bytes: u.bytes, linhas: 58, soma: u.soma }])
  expect(await selado(c, site, 'serie', '2026-10-01')).toBe(false)                    // falta o resumo
  const r = await resumoPelaRota(c, { site, classe: 'serie', canal, mes: '2026-10-01' })
  await receber(c, site, r.arquivos.map(a => ({ arquivo_id: a.arquivo_id, sha256: a.sha256, bytes: a.bytes, linhas: a.linhas, soma: null })))
  expect(await selado(c, site, 'serie', '2026-10-01')).toBe(false)                    // falta o manifesto
  const m = await manifestoPelaRota(c, { site, classe: 'serie', mes: '2026-10-01' })
  const res = await receber(c, site, m.arquivos.map(a => ({ arquivo_id: a.arquivo_id, sha256: a.sha256, bytes: a.bytes, linhas: null, soma: null })))
  expect(res.selados).toEqual([{ classe: 'serie', mes: '2026-10', versao: 1 }])
  const linha = (await c.query(`select sealed_kind, rows_total, days_measured, days_in_month from public.obs_archive_months where site_id = $1 and class = 'serie' and table_name = 'competitor_video_daily'`, [site])).rows[0]
  expect(linha).toEqual({ sealed_kind: 'com_dado', rows_total: '58', days_measured: 29, days_in_month: 31 })
})
```

(`unidadePelaRota`, `resumoPelaRota`, `manifestoPelaRota`, `receber` e `selado` moram no próprio arquivo de teste e usam as mesmas funções TS que as rotas da Tarefa 11 vão usar: `exportarUnidade`, `serializarResumo`, `montarManifesto`; até a Tarefa 11 existir, `serializarResumo` e `montarManifesto` nascem aqui, em `arquivo-mensal/resumo.ts` e `manifesto-mensal.ts`, com o contrato do C0.3.)

| Teste | Afirma |
|---|---|
| `canal sem linha tem unidade vazia com o nome do canal` (item 26) | segundo canal sem diária: `row_count = 0`, `sha256_bytes` nulo, `received_at` preenchido; o mês sela com os dois |
| `canal sem unidade impede resumo, manifesto e selo` (Review Focus 1, Phil C1) | dois canais com diária; exportar e receber só as duas unidades do canal A; `obs_archive_summary_rows(B)` → `unidades_pendentes` com `faltando:competitor_video_daily`; `obs_archive_plan(...)->'resumos'` sem B e `->'manifestos'` vazio; `obs_archive_manifest_rows` → `unidades_pendentes` com `faltando:competitor_video_daily:<B>`; `sealed_at` nulo |
| `unidade nova em mês selado reabre` (Phil C1) | selar; depois gravar unidade de um par que faltava (canal cadastrado antes do fim do mês e semeado depois do selo) → `unsealed_reason = 'unidade_nova'` e `manifestos` traz o mês |
| `o dia devido: 27/11 mes_aberto, 28/11 nova` (Phil C2) | diária de outubro com `obs_archive.hoje` 27/11 → `mes_aberto`; 28/11 → `nova`; classe `texto`, 14/12 → `mes_aberto`, 15/12 → `nova` |
| `uma conta só para o dia devido` (D20) | o `prosrc` de `obs_archive_record_core`, `obs_archive_plan`, `obs_archive_atraso` e `obs_archive_vermelhos` contém `obs_archive_due_on`, e nenhuma função `obs_archive_%` contém `seal_margin_days >` |
| `uma definição só do devido` (D19) | o `prosrc` de `obs_archive_plan`, `obs_archive_atraso`, `obs_archive_summary_rows`, `obs_archive_manifest_rows`, `obs_archive_seal` e `obs_archive_unit_due` contém `obs_archive_expected_units` |
| `unidade fora do devido: nao_devida, nada gravado` (Yannis M17) | exportar 2026-09 da `serie` → `nao_devida`; `video_antigo` na M3b → `nao_devida`; nenhuma linha nova em `obs_archive_units` nem em `obs_archive_months` |
| `canal cadastrado depois do mês não é devido nele` (D14, Phil I7) | canal com `added_at` em 05/11: `obs_archive_expected_units(site, 'serie', '2026-10-01')` não o traz; com linha em outubro, traz; `added_at` nulo, traz |
| `mês fora do banco nunca se refaz do online` (Phil C3) | mês com `detached_at` semeado: `attest` `ausente` → `nas_withdrawn_reason = 'ausente'`, `redo_reason` nulo, item em `aguardando_dono`; `obs_archive_record` da mesma unidade → `mes_fora_do_banco`; `obs_archive_unit_rehash` → `pulada: true`; `obs_archive_summary_rows` → `ja_no_arquivo`; nenhuma versão nova |
| `variação nula com nulo em qualquer ponta` (Phil I10) | vídeo A `likes` 10 → 20 e vídeo B `null` → 5: `var_likes` nulo |
| `sealed_kind e os números são por tabela` (Phil I10) | early vazia e diária com dado no mesmo mês: a linha da early `vazio_conferido`, a da diária `com_dado`; `days_measured` de cada linha contado na tabela dela no online, na hora do selo |
| `dois recebimentos simultâneos do último arquivo selam uma vez` (Yannis I8) | duas conexões, 20 rodadas: exatamente uma resposta traz `selados` com o mês; `superseded_at` gravado uma vez por versão anterior |
| `duas gravações da versão 1 ao mesmo tempo` (Phil M6) | duas conexões, 20 rodadas, mesmo par: uma `nova`, a outra `mesma`; nunca `23505` |
| `parte_mudou reaproveita a versão não recebida` (Phil M3) | `mark_redo('parte_mudou')` em v1 não recebida e nova gravação → `mesma`, `versao = 1` |
| `mesma com parte já recebida: nao_devida` (Yannis M16) | v1 em 2 partes, parte 1 recebida; nova gravação com o mesmo hash → `nao_devida`; `received_at` da parte 1 continua |
| `canário regravado no dia: recusado e vermelho` (Phil I4) | dois `attest` no mesmo dia e filho com sha diferente: o segundo traz `canarios[0].resposta = 'recusado'`, `motivo = 'sha256_diferente_no_dia'`; `obs_archive_canaries` fica com o primeiro; `vermelhos` traz `canario_regravado:numerico` |
| `ilegivel no NAS é divergente` (K4) | unidade recebida, `attest` `ilegivel` → `nas_withdrawn_reason = 'divergente'`, `redo_reason = 'divergente'`, `vermelhos` traz `nas_ilegivel:u:<id>`; de canal removido: sem `redo_reason`, em `aguardando_dono` |
| `mês sem linha em canal nenhum sela como vazio conferido` (item 26) | `sealed_kind = 'vazio_conferido'` |
| `tudo purged: sem dado a guardar` (item 158) | com `purged_at` em todas as unidades, `sealed_kind = 'sem_dado_a_guardar'` |
| `recebido com hash diferente não vira recebida` (item 23) | `resultado = 'divergente'`, `received_at` nulo, `redo_reason = 'divergente'` |
| `hash certo e uma linha a menos: conteudo_divergente` (item 76) | idem, com `redo_reason = 'conteudo_divergente'` |
| `unidade dada por ausente volta como a versão seguinte, mesmo com o hash igual` (item 23) | depois de `attest` `ausente`, `obs_archive_record` com o mesmo `hash_conteudo` devolve `nova` e `versao = 2`; o `sha256_bytes` da versão 1 não muda; o resumo e o manifesto ganham versão nova; `sealed_version` vai a 2 só quando os três novos estão recebidos (item 78: até lá a versão 1 continua a selada e na reconferência) |
| `repetir a exportação com o mesmo hash devolve a mesma versão` | `mesma`, `versao = 1`; `sha256_bytes` regravado só porque ainda não foi recebida |
| `o resumo carrega o hash de cada unidade e é refeito quando o mês é reexportado` (item 31) | `unit_hashes` traz `u:<id>` da diária; depois da versão 2 da unidade, o resumo vai a `versao = 2` só daquele canal (item 158: o do outro canal não muda) |
| `mês com buraco nunca vira zero` (item 31) | outubro começando em 03/10: `dias_medidos = 29`, `dias_do_mes = 31`; `likes` nulo em todas as linhas: `var_likes` nulo, nunca `0` |
| `um hash que mudou entre a unidade e o resumo impede o selo` (item 77) | uma linha nova na diária depois da exportação: `month/summary` (`obs_archive_unit_rehash`) devolve `igual: false`, a unidade fica `redo_reason = 'conteudo_mudou'` e o resumo não é gerado |
| `nas_attested_at do mês é o menor entre os arquivos do mês` (itens 77 e 158, Phil I2) | três `attest` em horas diferentes, com a early **vazia** no mesmo canal: o mês fica com a mais antiga, nunca nulo; unidade em 2 partes: `obs_archive_month_files` traz `p:<id>:01` e `p:<id>:02`, nunca `u:<id>` |
| `a corrida com a remoção, 20 vezes em cada forma` (item 159) | duas conexões, `obs_archive_record` contra `competitor_channel_remove` (Tarefa 8; este caso nasce `skip` e liga na Tarefa 8): nunca sobra unidade nem resumo sem `purged_at` de canal `apagar` |
| `a rede: insert direto de unidade de canal apagar recusa` | `insert` como dono (função de teste `security definer`) → `canal_removido`; como `service_role` → `42501` (sem privilégio, K3) |
| `o service_role não chega ao core nem às internas` (D22, K3) | `has_function_privilege('service_role', 'public.obs_archive_record_core(uuid,text,jsonb,text)', 'execute')` falso; `has_function_privilege('service_role', 'public.obs_archive_record(uuid,text,jsonb)', 'execute')` verdadeiro; falso também para `obs_archive_seal`, `obs_archive_insert_guard`, `obs_archive_hoje_sp` |
| `ausente em unidade selada zera o atestado do mês na mesma chamada` (N1 do Phil) | mês selado, unidade U v1 atestada; `attest` `ausente` de U v1: logo depois, `obs_archive_months.nas_attested_at` é nulo e `obs_archive_month_files` devolve `nas_attested_at` nulo para `u:<v1>` |
| `até a v2 chegar, month_files lista a v1` (N1 do Phil) | antes do `receive` da v2, `arquivo_id = 'u:<v1>'`; depois do `receive`, `'u:<v2>'` |
| `catálogo dos privilégios do service_role` (R2-S1 do Yannis) | `select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'obs_archive%' and has_function_privilege('service_role', p.oid, 'execute')` igual, em ordem, à lista fechada das funções que a aplicação chama (`obs_archive_record`, `obs_archive_read_unit`, `obs_archive_content_hash` e as demais da Tarefa 11); `has_table_privilege('service_role', t, 'insert')`, `'update'` e `'delete'` falsos nas 15 tabelas; função `obs_archive_*` nova fora da lista faz o teste falhar |
| `P56: a marca do expurgo presa ao dono e à transação` | (1) `insert` direto como `service_role` de versão nova de unidade com `dropped_at`, com `set_config('obs_archive.origem', 'expurgo:' \|\| pg_current_xact_id(), true)`: recusa `42501` (sem privilégio de `insert`, K3); (2) por uma função de teste `security definer` do dono: `'expurgo'` puro recusa, `'expurgo:'` com o id de outra transação recusa, com o da própria passa; (3) `obs_archive_record` (sem `p_origem`) depois de uma chamada ao `_core` com `'expurgo'` na mesma transação recusa (a marca é sobrescrita por texto vazio); (4) medida no ledger: `pg_current_xact_id()` igual dentro da função e do gatilho, com a chamada dentro de um bloco com `exception` (subtransação) |
| `attest com filho desmontado não grava nada` | `filhos.numerico.montado = false` e item `ausente`: `recusado`/`filho_fora`; nenhuma coluna muda |
| `unit/received de unidade com purged_at devolve canal_removido e não grava` (item 159) | |

Run → FAIL.

- [ ] **Passo 2. A parte 3 do rascunho.** Acréscimos às tabelas e as funções:

```sql
-- M3B PARTE 3: gravação, recebimento, resumo, manifesto, selagem e conferência do NAS

alter table public.obs_archive_units add column if not exists nas_reported_at timestamptz;          -- último informe com o filho montado (varredura: 02 §10.10)
alter table public.obs_archive_unit_parts add column if not exists nas_reported_at timestamptz;
alter table public.obs_archive_summaries add column if not exists nas_reported_at timestamptz;
alter table public.obs_archive_summaries add column if not exists received_papers text[] not null default '{}';
alter table public.obs_archive_months add column if not exists manifest_created_at timestamptz;
alter table public.obs_archive_months add column if not exists manifest_received_papers text[] not null default '{}';
alter table public.obs_archive_months add column if not exists manifest_nas_reported_at timestamptz;

-- O dia de hoje em São Paulo. Em teste, `obs_archive.hoje` (texto AAAA-MM-DD, local à transação) fixa o relógio.
-- Dívida declarada (Yannis M6): gancho de teste em função de produção; só quem tem SQL fixa o GUC, e só na própria transação.
create or replace function public.obs_archive_hoje_sp() returns date language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('obs_archive.hoje', true), '')::date, (now() at time zone 'America/Sao_Paulo')::date)
$$;
revoke all on function public.obs_archive_hoje_sp() from public, anon, authenticated, service_role;

-- O dia em que o mês fica devido: último dia do mês + margem (02 l.169). A única conta (D20); gravação, plano, atraso e vermelhos a chamam.
create or replace function public.obs_archive_due_on(p_month date, p_margin integer)
returns date language sql immutable set search_path = '' as $$
  select ((p_month + interval '1 month')::date - 1) + p_margin
$$;
revoke all on function public.obs_archive_due_on(date, integer) from public, anon, authenticated;
grant execute on function public.obs_archive_due_on(date, integer) to service_role;

-- O devido num (classe, mês): a única definição (D19, regra D14). O plano, o atraso, o resumo, o manifesto, a selagem e
-- obs_archive_unit_due a chamam (teste de catálogo por prosrc). Provada no bythiago_int em 14/10 (begin … rollback), menos o ramo do rol do ensaio.
-- Canal removido (sem linha em competitor_channels, a regra de obs_archive_record_core) nunca entra.
create or replace function public.obs_archive_expected_units(p_site uuid, p_class text, p_month date)
returns table (table_name text, channel_ref text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_ini timestamptz;            -- 00:00 de São Paulo do dia 1 do mês ($4 do leitor)
  v_fim timestamptz;            -- 00:00 de São Paulo do dia 1 do mês seguinte ($5); também o corte do added_at (D14)
  v_seg date;                   -- dia 1 do mês seguinte ($6)
  v_inicio date;
  v_rol regclass;
  v_t record;
  v_src record;
begin
  if p_month is null or p_month <> date_trunc('month', p_month)::date then
    raise exception 'mes_invalido' using errcode = 'P0001';
  end if;
  if p_class = 'video_antigo' then return; end if;                                -- (c) nenhum até a M10b
  v_seg := (p_month + interval '1 month')::date;
  v_ini := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim := (v_seg::text || ' 00:00:00-03')::timestamptz;
  -- D13: início da classe, lido de obs_archive_switch (gravado pelo plano). Piso de outubro de 2026, menos no ensaio.
  -- Início ainda não calculado: vale só o piso (nunca "nada devido", que seria verde falso).
  select s.first_month into v_inicio from public.obs_archive_switch s where s.site_id = p_site and s.class = p_class;
  if p_class <> 'ensaio' then
    v_inicio := greatest(coalesce(v_inicio, date '2026-10-01'), date '2026-10-01');
  end if;
  if v_inicio is not null and p_month < v_inicio then return; end if;
  v_rol := case when p_class = 'ensaio' then pg_catalog.to_regclass('public.obs_archive_rehearsal_seed') end;
  for v_t in select p.table_name from public.obs_archive_policy() p where p.class = p_class order by p.table_name loop
    if p_class = 'ensaio' and v_rol is not null then
      -- (b) o rol da carga (M8), inclusive o canal sem linha; só canal que existe
      return query execute format(
        'select %L::text, c.id::text
           from public.competitor_channels c
          where c.site_id = $1
            and exists (select 1 from %s r where r.site_id = $1 and r.month = $2 and r.channel_ref = c.id::text)',
        v_t.table_name, v_rol)
        using p_site, p_month;
    elsif pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(v_t.table_name)) is null then
      -- tabela da política ausente: os cadastrados continuam devidos e a exportação responde 409 tabela_ausente (vermelho), nunca some
      return query
        select v_t.table_name, c.id::text from public.competitor_channels c
         where c.site_id = p_site and p_class <> 'ensaio'
           and coalesce(c.added_at, '-infinity'::timestamptz) < v_fim;
    else
      -- (a) cadastrado antes do fim do mês, ou com linha no mês na tabela; (b) sem rol: só os com linha.
      -- Uma consulta por tabela, com o canal correlacionado no from_where do leitor ($2 vira c.id), nunca um laço por canal.
      select * into v_src from public.obs_archive_unit_source(p_class, v_t.table_name);
      return query execute format(
        'select %L::text, c.id::text
           from public.competitor_channels c
          where c.site_id = $1
            and (%s or exists (select 1 %s))',
        v_t.table_name,
        case when p_class = 'ensaio' then 'false' else 'coalesce(c.added_at, ''-infinity''::timestamptz) < $5' end,
        replace(v_src.from_where, '$2', 'c.id'))
        using p_site, null::uuid, p_month, v_ini, v_fim, v_seg;
    end if;
  end loop;
end $$;
revoke all on function public.obs_archive_expected_units(uuid, text, date) from public, anon, authenticated;
grant execute on function public.obs_archive_expected_units(uuid, text, date) to service_role;

-- Unidade devida (D24): o par está em obs_archive_expected_units, o mês não é anterior ao início da classe (D13) e já chegou ao dia devido.
create or replace function public.obs_archive_unit_due(p_site uuid, p_class text, p_table text, p_channel uuid, p_month date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.obs_archive_expected_units(p_site, p_class, p_month) e
                  where e.table_name = p_table and e.channel_ref = p_channel::text)
$$;
revoke all on function public.obs_archive_unit_due(uuid, text, text, uuid, date) from public, anon, authenticated, service_role;

-- Os arquivos de um mês (D23): do conjunto corrente (a versão mais nova já recebida por (tabela, canal): a selada até a nova chegar, item 78;
-- sem nenhuma recebida, a mais nova; arquivo retirado (nas_withdrawn_at) sai com nas_attested_at nulo),
-- unidades com row_count > 0 e parts = 1, as partes das unidades com parts > 1, os resumos (maior versão por canal) com
-- empty = false, um arquivo por papel, e os dois arquivos do manifesto da maior versão; fora lost_at e purged_at.
-- Unidade vazia e resumo vazio não têm arquivo e nunca entram. Usada em reconferir, no plano do B2, em nas_attested_at,
-- em b2_forja_ok_at e em pode_desligar. Os caminhos são os do contrato C0.2. Provada no bythiago_int em 14/10 (begin … rollback).
create or replace function public.obs_archive_month_files(p_site uuid, p_class text, p_month date)
returns table (arquivo_id text, tipo text, filho text, caminho text, table_name text, channel_ref text, version integer,
               control_column text, file_bytes bigint, received_at timestamptz, nas_attested_at timestamptz, b2_ok_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with pol as (
    select p.table_name, p.control_column, p.filho from public.obs_archive_policy() p where p.class = p_class
  ), cls as (
    select min(pol.filho) as filho, to_char(p_month, 'YYYY-MM') as mes from pol      -- cada classe mora num filho só
  ), u as (
    select distinct on (x.table_name, x.channel_ref) x.*
      from public.obs_archive_units x
     where x.site_id = p_site and x.class = p_class and x.month = p_month
     order by x.table_name, x.channel_ref, (x.received_at is not null) desc, x.version desc
  ), s as (
    select distinct on (y.channel_ref) y.*
      from public.obs_archive_summaries y
     where y.site_id = p_site and y.class = p_class and y.month = p_month
     order by y.channel_ref, (y.received_at is not null) desc, y.version desc
  ), man as (
    select o.manifest_version, o.manifest_sha256, o.manifest_list_sha256, o.manifest_bytes, o.manifest_list_bytes,
           o.manifest_received_at, o.manifest_nas_attested_at, o.manifest_nas_withdrawn_at
      from public.obs_archive_months o
     where o.site_id = p_site and o.class = p_class and o.month = p_month and o.manifest_version is not null
     order by o.manifest_version desc
     limit 1
  ), f (arquivo_id, tipo, filho, caminho, table_name, channel_ref, version, control_column, file_bytes, received_at, nas_attested_at) as (
  select 'u:' || u.id, 'unidade', cls.filho,
         p_class || '/canais/' || u.channel_ref || '/' || u.table_name || '/' || cls.mes || '.v' || u.version || '.csv.gz',
         u.table_name, u.channel_ref, u.version, pol.control_column, u.file_bytes, u.received_at, case when u.nas_withdrawn_at is not null then null else u.nas_attested_at end
    from u join pol on pol.table_name = u.table_name cross join cls
   where u.row_count > 0 and u.parts = 1 and u.lost_at is null and u.purged_at is null
  union all
  select 'p:' || u.id || ':' || lpad(pt.part::text, 2, '0'), 'parte', cls.filho,
         p_class || '/canais/' || u.channel_ref || '/' || u.table_name || '/' || cls.mes || '.v' || u.version
           || '.p' || lpad(pt.part::text, 2, '0') || '.csv.gz',
         u.table_name, u.channel_ref, u.version, pol.control_column, pt.file_bytes, pt.received_at, case when pt.nas_withdrawn_at is not null then null else pt.nas_attested_at end
    from u join public.obs_archive_unit_parts pt on pt.unit_id = u.id join pol on pol.table_name = u.table_name cross join cls
   where u.row_count > 0 and u.parts > 1 and u.lost_at is null and u.purged_at is null
  union all
  select 's:' || s.id || ':' || r.papel, 'resumo', cls.filho,
         p_class || '/canais/' || s.channel_ref || '/resumo/' || cls.mes || '.v' || s.version || '.' || r.papel || '.csv.gz',
         null::text, s.channel_ref, s.version, null::text, r.bytes, s.received_at, case when s.nas_withdrawn_at is not null then null else s.nas_attested_at end
    from s cross join lateral (values ('canal', s.canal_sha256, s.canal_bytes),
                                      ('video', s.video_sha256, s.video_bytes),
                                      ('ficha', s.ficha_sha256, s.ficha_bytes)) r(papel, sha, bytes)   -- ficha só existe na video_antigo
         cross join cls
   where not s.empty and s.lost_at is null and s.purged_at is null and r.sha is not null
  union all
  select 'm:' || p_class || ':' || cls.mes || ':v' || man.manifest_version || ':' || k.ext, 'manifesto', cls.filho,
         p_class || '/manifestos/' || cls.mes || '.v' || man.manifest_version || '.' || k.ext,
         null::text, null::text, man.manifest_version, null::text, k.bytes, man.manifest_received_at, case when man.manifest_nas_withdrawn_at is not null then null else man.manifest_nas_attested_at end
    from man cross join lateral (values ('json', man.manifest_bytes), ('sha256', man.manifest_list_bytes)) k(ext, bytes)
         cross join cls
  )
  -- b2_ok_at: a última conferência boa do B2 daquele arquivo (forja ou dono), nula se nunca houve
  select f.*, b.last_ok_at
    from f left join public.obs_archive_b2_files b on b.site_id = p_site and b.arquivo_id = f.arquivo_id
$$;
revoke all on function public.obs_archive_month_files(uuid, text, date) from public, anon, authenticated;
grant execute on function public.obs_archive_month_files(uuid, text, date) to service_role;

-- A rede (02 §10.5): canal com remoção 'apagar' nunca ganha linha; versão nova de unidade retirada só pelo expurgo, de dentro da
-- função de gravação (dono da tabela) e com a marca presa a esta transação. security invoker de propósito (P56).
create or replace function public.obs_archive_insert_guard() returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_owner name; v_retirada boolean;
begin
  if exists (select 1 from public.obs_archive_channel_removals r where r.site_id = new.site_id and r.channel_ref = new.channel_ref and r.archive_decision = 'apagar') then
    raise exception 'canal_removido' using errcode = 'P0001', detail = new.channel_ref;
  end if;
  if tg_table_name = 'obs_archive_units' then
    select exists (select 1 from public.obs_archive_units u where u.site_id = new.site_id and u.class = new.class and u.table_name = new.table_name
                     and u.channel_ref = new.channel_ref and u.month = new.month and u.dropped_at is not null) into v_retirada;
  else
    select exists (select 1 from public.obs_archive_units u where u.site_id = new.site_id and u.class = new.class
                     and u.channel_ref = new.channel_ref and u.month = new.month and u.dropped_at is not null) into v_retirada;
  end if;
  if v_retirada then
    select pg_catalog.pg_get_userbyid(c.relowner) into v_owner from pg_catalog.pg_class c where c.oid = tg_relid;
    if not (current_user = v_owner and current_setting('obs_archive.origem', true) = 'expurgo:' || pg_current_xact_id()::text) then
      raise exception 'unidade_retirada' using errcode = 'P0001', detail = new.channel_ref;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists obs_archive_insert_guard on public.obs_archive_units;
create trigger obs_archive_insert_guard before insert on public.obs_archive_units for each row execute function public.obs_archive_insert_guard();
drop trigger if exists obs_archive_insert_guard on public.obs_archive_summaries;
create trigger obs_archive_insert_guard before insert on public.obs_archive_summaries for each row execute function public.obs_archive_insert_guard();

-- O único caminho de gravação de linha nova no registro. O _core não tem execute para o service_role (D22, K3): só a
-- casca sem p_origem é da aplicação, e a marca do expurgo (P56) só sai de função do dono.
create or replace function public.obs_archive_record_core(p_site uuid, p_kind text, p_payload jsonb, p_origem text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_class text := p_payload->>'classe'; v_table text := p_payload->>'tabela';
  v_channel uuid := (p_payload->>'canal')::uuid; v_month date := (p_payload->>'mes')::date;
  v_dec text; v_pol record; v_last record; v_id uuid; v_ver int; v_empty boolean; v_novo_par boolean;
begin
  -- duas gravações da versão 1 ao mesmo tempo: o for update sem linha não trava nada (Phil M6)
  perform pg_advisory_xact_lock(hashtextextended(p_site::text || '|' || p_kind || '|' || coalesce(v_class, '') || '|' || coalesce(v_table, '')
                                                 || '|' || v_channel::text || '|' || v_month::text, 0));
  -- a marca é gravada em toda chamada, antes de qualquer insert (P56): vazia fora do expurgo
  perform set_config('obs_archive.origem', case when p_origem = 'expurgo' then 'expurgo:' || pg_current_xact_id()::text else '' end, true);
  perform 1 from public.competitor_channels c where c.id = v_channel and c.site_id = p_site for key share;
  if not found then
    select r.archive_decision into v_dec from public.obs_archive_channel_removals r
     where r.site_id = p_site and r.channel_ref = v_channel::text for share;
    if p_origem = 'expurgo' and v_dec = 'guardar' then null;            -- a única exceção (02 §10.5)
    elsif p_origem = 'expurgo' and v_dec is null then return jsonb_build_object('status', 'sem_destino');
    else return jsonb_build_object('status', 'canal_removido');
    end if;
  end if;
  if p_kind = 'unidade' then
    select * into v_pol from public.obs_archive_policy() p where p.class = v_class and p.table_name = v_table;
    if not found then raise exception 'classe_tabela_invalida' using errcode = 'P0001'; end if;
    if p_origem is distinct from 'expurgo' and public.obs_archive_due_on(v_month, v_pol.seal_margin_days) > public.obs_archive_hoje_sp() then
      return jsonb_build_object('status', 'mes_aberto');
    end if;
    -- mês destacado ou descartado nunca se reexporta a partir do online (02 l.352, l.578; Phil C3)
    if p_origem is distinct from 'expurgo' and exists (select 1 from public.obs_archive_months m
         where m.site_id = p_site and m.class = v_class and m.table_name = v_table and m.month = v_month
           and (m.detached_at is not null or m.dropped_at is not null)) then
      return jsonb_build_object('status', 'mes_fora_do_banco');
    end if;
    -- a rota não grava o que o plano não pediria (Yannis M17)
    if p_origem is distinct from 'expurgo' and not public.obs_archive_unit_due(p_site, v_class, v_table, v_channel, v_month) then
      return jsonb_build_object('status', 'nao_devida');
    end if;
    select * into v_last from public.obs_archive_units u
     where u.site_id = p_site and u.class = v_class and u.table_name = v_table and u.channel_ref = v_channel::text and u.month = v_month
     order by u.version desc limit 1 for update;
    v_novo_par := not found;
    if found and v_last.dropped_at is not null and p_origem is distinct from 'expurgo' then return jsonb_build_object('status', 'unidade_retirada'); end if;
    -- reaproveita a versão nunca recebida também quando ela só foi marcada parte_mudou ou mudou_durante_a_leitura (Phil M3)
    if found and v_last.hash_conteudo = p_payload->>'hash_conteudo' and v_last.received_at is null
       and (v_last.redo_reason is null or v_last.redo_reason in ('parte_mudou', 'mudou_durante_a_leitura'))
       and v_last.superseded_at is null and p_origem is distinct from 'expurgo' then
      -- versão em andamento com parte já recebida: não reescreve as partes (Yannis M16)
      if exists (select 1 from public.obs_archive_unit_parts x where x.unit_id = v_last.id and x.received_at is not null) then
        return jsonb_build_object('status', 'nao_devida', 'arquivo_id', 'u:' || v_last.id, 'versao', v_last.version);
      end if;
      update public.obs_archive_units set sha256_bytes = nullif(p_payload->>'sha256_bytes', ''), csv_sha256 = nullif(p_payload->>'csv_sha256', ''),
             file_bytes = (p_payload->>'file_bytes')::bigint, parts = coalesce((p_payload->>'partes')::smallint, 1), min_key = p_payload->>'min_key', max_key = p_payload->>'max_key',
             redo_reason = null
       where id = v_last.id;
      delete from public.obs_archive_unit_parts where unit_id = v_last.id;
      v_id := v_last.id; v_ver := v_last.version;
    elsif found and v_last.hash_conteudo = p_payload->>'hash_conteudo' and v_last.received_at is not null and v_last.redo_reason is null
          and v_last.superseded_at is null and p_origem is distinct from 'expurgo' then
      return jsonb_build_object('status', 'nao_devida', 'arquivo_id', 'u:' || v_last.id, 'versao', v_last.version);
    else
      v_ver := coalesce(v_last.version, 0) + 1;
      v_empty := (p_payload->>'row_count')::bigint = 0;
      insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, control_sum, hash_conteudo, schema_fp,
             sha256_bytes, csv_sha256, file_bytes, parts, min_key, max_key, origem, received_at, received_row_count, received_control_sum)
      values (p_site, v_class, v_table, v_channel::text, v_month, v_ver, (p_payload->>'row_count')::bigint, (p_payload->>'control_sum')::numeric,
              p_payload->>'hash_conteudo', p_payload->>'schema_fp', nullif(p_payload->>'sha256_bytes', ''), nullif(p_payload->>'csv_sha256', ''),
              (p_payload->>'file_bytes')::bigint, coalesce((p_payload->>'partes')::smallint, 1), p_payload->>'min_key', p_payload->>'max_key',
              case when p_origem = 'expurgo' then 'expurgo' else 'rota' end,
              case when v_empty then now() end, case when v_empty then 0 end, case when v_empty then (p_payload->>'control_sum')::numeric end)
      returning id into v_id;
    end if;
    insert into public.obs_archive_unit_parts (unit_id, part, sha256_bytes, csv_sha256, file_bytes, row_count, control_sum, row_offset, min_key, max_key)
    select v_id, (x->>'parte')::smallint, x->>'sha256_bytes', x->>'csv_sha256', (x->>'file_bytes')::bigint, (x->>'row_count')::bigint,
           (x->>'control_sum')::numeric, (x->>'row_offset')::bigint, x->>'min_key', x->>'max_key'
      from jsonb_array_elements(coalesce(p_payload->'parts', '[]'::jsonb)) x;
    insert into public.obs_archive_months (site_id, class, table_name, month) values (p_site, v_class, v_table, v_month) on conflict do nothing;
    -- par novo num mês já selado reabre o selo (Phil C1)
    if v_novo_par and exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = v_class and m.month = v_month and m.sealed_at is not null) then
      update public.obs_archive_months set unsealed_at = now(), unsealed_reason = 'unidade_nova'
       where site_id = p_site and class = v_class and month = v_month;
    end if;
    return jsonb_build_object('status', case when v_id = v_last.id then 'mesma' else 'nova' end, 'arquivo_id', 'u:' || v_id, 'versao', v_ver);
  elsif p_kind = 'resumo' then
    select * into v_last from public.obs_archive_summaries s
     where s.site_id = p_site and s.class = v_class and s.channel_ref = v_channel::text and s.month = v_month
     order by s.version desc limit 1 for update;
    if found and v_last.unit_hashes = p_payload->'unit_hashes' and v_last.superseded_at is null and v_last.nas_withdrawn_at is null then
      if v_last.received_at is not null then return jsonb_build_object('status', 'nao_devida', 'arquivo_id', 's:' || v_last.id, 'versao', v_last.version); end if;
      update public.obs_archive_summaries set canal_sha256 = p_payload->>'canal_sha256', canal_bytes = (p_payload->>'canal_bytes')::bigint,
             canal_rows = (p_payload->>'canal_rows')::int, video_sha256 = p_payload->>'video_sha256', video_bytes = (p_payload->>'video_bytes')::bigint,
             video_rows = (p_payload->>'video_rows')::int, received_papers = '{}'
       where id = v_last.id;
      return jsonb_build_object('status', 'mesma', 'arquivo_id', 's:' || v_last.id, 'versao', v_last.version);
    end if;
    v_ver := coalesce(v_last.version, 0) + 1;
    v_empty := (p_payload->>'vazio')::boolean;
    insert into public.obs_archive_summaries (site_id, class, channel_ref, month, version, empty, canal_sha256, canal_bytes, canal_rows,
           video_sha256, video_bytes, video_rows, unit_hashes, received_at)
    values (p_site, v_class, v_channel::text, v_month, v_ver, v_empty, p_payload->>'canal_sha256', (p_payload->>'canal_bytes')::bigint,
            (p_payload->>'canal_rows')::int, p_payload->>'video_sha256', (p_payload->>'video_bytes')::bigint, (p_payload->>'video_rows')::int,
            p_payload->'unit_hashes', case when v_empty then now() end)
    returning id into v_id;
    return jsonb_build_object('status', 'nova', 'arquivo_id', 's:' || v_id, 'versao', v_ver);
  end if;
  raise exception 'tipo_invalido' using errcode = 'P0001';
end $$;
revoke all on function public.obs_archive_record_core(uuid, text, jsonb, text) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_record(p_site uuid, p_kind text, p_payload jsonb)
returns jsonb language sql security definer set search_path = '' as $$
  select public.obs_archive_record_core(p_site, p_kind, p_payload, null)
$$;
revoke all on function public.obs_archive_record(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_record(uuid, text, jsonb) to service_role;
revoke all on function public.obs_archive_insert_guard() from public, anon, authenticated, service_role;
```

O ramo `resumo` do `_core` ganha o mesmo `pg_advisory_xact_lock` (já no começo da função, pela chave com `p_kind`) e recusa `ja_no_arquivo` quando alguma tabela da classe no mês tem `detached_at` ou `dropped_at`.

E, na mesma parte, as funções de recebimento, resumo, manifesto, selagem e conferência. **Regras que o código tem de seguir, uma por função** (o corpo segue o molde de `obs_archive_record`: `security definer`, `search_path` vazio, erros por código P0001):

| Função | Regras |
|---|---|
| `obs_archive_receive` | Por item, pelo prefixo do `arquivo_id` (`u`, `p`, `s`, `m`, `a`; outro: `desconhecido`). Unidade ou resumo com `purged_at`: `canal_removido`, nada gravado. Unidade vazia: `ja_recebida`. Compara `sha256` com `sha256_bytes` (ou o do papel do resumo, ou `manifest_sha256`/`manifest_list_sha256` da versão do id); `linhas` e `soma` com `row_count` e `control_sum` por `is not distinct from` (manifesto e anexo: só `sha256` e `bytes`). Diferente no `sha256`: `divergente` e `redo_reason = 'divergente'` só se o canal existe, a linha de `obs_archive_months` da (classe, tabela, mês) não tem `detached_at` nem `dropped_at` e a unidade não tem `dropped_at` (fora disso nada de `redo_reason`: o item vai a `aguardando_dono`, restaurar do B2; Phil C3); `sha256` igual e contagem ou soma diferentes: `conteudo_divergente` e o `redo_reason` igual. Igual: grava `received_*`, `received_at = now()`, `nas_attested_at = now()`, `nas_reported_at = now()`, zera `nas_withdrawn_*` e `absent_*` → `recebida` (ou `ja_recebida` se já estava). Parte: compara só `sha256` e `linhas` com o registro da parte e guarda a soma relida em `received_control_sum`; a unidade fica recebida quando **todas** as partes estão, a soma das contagens é `row_count` e a soma das somas relidas é `control_sum` (diferente: `conteudo_divergente` na unidade). Resumo: acrescenta o papel a `received_papers`; recebido quando todos os papéis com `*_sha256` não nulo estão. Manifesto: idem, com `manifest_received_papers`; com os dois papéis, chama a selagem. Devolve `{itens, selados}` |
| selagem (interna, `obs_archive_seal(p_site, p_class, p_month)`; sem `execute` para o `service_role`) | **Começa com** `select 1 from public.obs_archive_months where site_id = p_site and class = p_class and month = p_month order by table_name for update`; depois de travar, relê as condições; já selado na versão do manifesto: não faz nada e não entra em `selados` (Yannis I8). Sela quando: toda unidade do conjunto corrente (a maior versão por (tabela, canal)) é terminal (recebida, vazia, `lost_at` ou `purged_at`); **e cada par de `obs_archive_expected_units` tem unidade terminal** (a função refaz a conta; não confia no manifesto; Phil C1); todo resumo devido está recebido ou vazio (devido = canal esperado sem `purged_at`; canal removido sem resumo conta como terminal: `02` §10.4); o manifesto da versão está recebido. Grava **por tabela** (cada linha de `obs_archive_months` da classe e mês com os seus; Phil I10): `sealed_at`, `sealed_version = manifest_version`, `units_total`, `units_empty`, `rows_total`, `days_measured` (dias de São Paulo distintos com linha **na tabela**, contados no online pela mesma regra do leitor, na hora do selo), `days_in_month`, `sealed_kind` sobre as unidades sem `purged_at` da tabela (nenhuma → `sem_dado_a_guardar`; todas com `row_count = 0` → `vazio_conferido`; senão `com_dado`), `unsealed_at` e `unsealed_reason` nulos; marca `superseded_at` nas versões anteriores **de canal que existe** (a de canal removido nunca: `02` §10.5) e nos resumos anteriores |
| `obs_archive_unit_rehash` | Unidade de canal removido, com `dropped_at`, com `lost_at`, ou de (classe, tabela, mês) com `detached_at` ou `dropped_at`: devolve `{igual: true, pulada: true}` sem ler (Phil C3). Senão chama `obs_archive_content_hash`; igual em contagem, soma e hash: `{igual: true}`; diferente: `redo_reason = 'conteudo_mudou'` e, se o mês estava selado, `unsealed_at = now()`, `unsealed_reason = 'conteudo_mudou'` |
| `obs_archive_summary_rows` | Recusa `canal_removido` (canal ausente ou com remoção); `ja_no_arquivo` quando alguma tabela da classe no mês tem `detached_at` ou `dropped_at` (`02` l.578); e `unidades_pendentes` quando alguma tabela de `obs_archive_expected_units` deste canal não tem unidade terminal, **inclusive quando não tem unidade nenhuma** (`details`: os `arquivo_id` pendentes e `faltando:<tabela>` para cada tabela sem linha; Phil C1). Gera, do online e pelo mesmo predicado do leitor, uma linha por tabela (`.canal`) e uma por (vídeo, tabela) (`.video`), com as colunas do C0.3: `dias_medidos` = dias de São Paulo distintos com linha; `dias_do_mes` = dias do calendário; variação = soma, por vídeo, de (última − primeira leitura do mês), nula se algum vídeo tem a coluna nula em **qualquer uma** das duas pontas (Phil I10); na classe `texto`, variações nulas. `vazio = true` só quando há uma unidade terminal para **cada** tabela esperada do canal e todas têm `row_count = 0`. `unit_hashes` = `{u:<id>: hash}` das unidades do conjunto corrente do canal. Classe `video_antigo`: recusa `resumo_da_m10b` |
| `obs_archive_manifest_rows` | Recusa `unidades_pendentes` quando algum par de `obs_archive_expected_units(p_site, p_class, p_month)` não tem unidade terminal (zero unidade é pendente, nunca terminal; `details` com `faltando:<tabela>:<canal>`), e `resumos_pendentes` quando algum canal esperado, sem `purged_at`, não tem resumo recebido ou vazio do conjunto corrente (Phil C1). Versão: a do manifesto pendente (não recebido) do mesmo conjunto de arquivos, ou a seguinte; `gerado_em` = `manifest_created_at` dessa versão (o JSON sai igual em toda repetição). Lista unidades (com `estado` `normal`, `vazia`, `perdida`, `expurgada`; a perdida e a expurgada com `row_count` e `control_sum` do registro e sem `sha256`), partes, resumos não vazios e as contagens `unidades_canal_removido`, `unidades_perdidas`, `unidades_expurgadas`. Nunca nome de canal nem id do YouTube |
| `obs_archive_expected_units` (D19) | Para cada tabela da classe na política: (a) `serie`, `horaria`, `texto`: os canais do site que existem com `coalesce(added_at, '-infinity'::timestamptz) < ((p_month + interval '1 month')::date::text \|\| ' 00:00:00-03')::timestamptz`, unidos aos que existem e têm linha no mês na tabela (pelo `from_where` de `obs_archive_unit_source`, uma consulta por tabela com o canal correlacionado, nunca um laço por canal); (b) `ensaio`: os canais do rol de `obs_archive_rehearsal_seed` (M8) do mês, inclusive o sem linha, lido por `to_regclass` (tabela ausente: os com linha); (c) `video_antigo`: nenhum até a M10b. Mês anterior ao início da classe (D13, lido de `obs_archive_switch.first_month`; o piso de outubro de 2026 não vale para `ensaio`): nenhum; `first_month` ainda nulo: vale só o piso (nunca "nada devido"). Tabela da política ausente no banco: os cadastrados continuam devidos (a exportação responde `409 tabela_ausente`, vermelho). Nunca devolve canal removido (sem linha em `competitor_channels`, a regra de `obs_archive_record_core`). SQL na parte 3 |
| `obs_archive_record_manifest` | Grava `manifest_version`, os dois `sha256`, os tamanhos e `manifest_created_at` (só na primeira vez da versão) em toda linha da classe e mês; zera `manifest_received_papers` se os `sha256` mudaram |
| `obs_archive_attest_nas` | Grava os canários em `obs_archive_canaries` (`on conflict` atualiza só se o `sha256` for o mesmo; diferente no mesmo dia: mantém o primeiro, devolve `recusado` com `sha256_diferente_no_dia` no campo `canarios` da resposta e grava o vermelho `canario_regravado:<filho>`, lido por `obs_archive_vermelhos`; Phil I4). Por item: filho do arquivo (pela classe) com `montado` e `sentinela` verdadeiros, senão `recusado`/`filho_fora` e nada gravado; `nas_fora`: `aceito`, nada gravado. `presente` igual ao registro: `nas_attested_at = now()`, `nas_reported_at = now()`, zera `nas_withdrawn_*` e `absent_*`. `presente` diferente: `nas_withdrawn_at`, `nas_withdrawn_reason` (`divergente` ou `conteudo_divergente`), `nas_reported_at`, e `redo_reason` igual só se o canal existe, a linha de `obs_archive_months` da (classe, tabela, mês) não tem `detached_at` nem `dropped_at` e a unidade não tem `dropped_at`; fora disso nada de `redo_reason`: o item vai a `aguardando_dono` (restaurar do B2; Phil C3). `ilegivel` (K4): tratado como `presente` diferente com `nas_withdrawn_reason = 'divergente'` (mesma condição para o `redo_reason`) e o vermelho `nas_ilegivel:<arquivo_id>`. `ausente` de unidade recebida: `nas_withdrawn_reason = 'ausente'`, `redo_reason = 'arquivo_ausente'` (mesma condição), `absent_first_at` (se nulo) e `absent_last_at`. **Arquivo só em `_recebendo/` (X2, contrato C7.1):** chega como `ausente` (na reconferência só o caminho final conta) e segue esta mesma regra; não há campo novo nem caso à parte. `ausente` de unidade não recebida (canal removido, P14): só `absent_*`. Unidade vazia, com `lost_at` ou `purged_at`: `recusado`/`desconhecido` (não se reconfere). Depois recalcula `obs_archive_months.nas_attested_at` dos meses tocados: o menor `nas_attested_at` entre os arquivos de `obs_archive_month_files` (unidades com arquivo, partes, resumos não vazios e os dois do manifesto, fora `lost_at` e `purged_at`; unidade vazia e resumo vazio não entram); com algum desses nulo, nulo (Phil I2). Devolve só `aceito`/`recusado` por item e por canário |

- [ ] **Passo 3.** Run → PASS. **Passo 4.** Confirmar a parte 3 no banco local (só funções e `alter table ... add column if not exists`).
- [ ] **Passo 5. Commit:**

```bash
git add -- apps/web/test/integration/manutencao-m3b-selagem.test.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/resumo.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/manifesto-mensal.ts
git commit -m "feat: rascunho da M3b, parte 3: gravação única, recebimento, resumo por canal, manifesto e selagem (manutenção M3b, itens 23, 26, 31, 76 a 78 e 158)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m3b.sql apps/web/test/integration/manutencao-m3b-selagem.test.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/resumo.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/manifesto-mensal.ts
```

`resumo.ts` (`serializarResumo(rows) → { arquivos: Array<{ papel, gz, sha256, bytes, linhas }> }`, pela `serializarLinhas` da E10 e `gzipSync` nível 9) e `manifesto-mensal.ts` (`montarManifesto(rows, site) → { json: Buffer, lista: Buffer }`, com `JSON.stringify(m, null, 2) + '\n'` e a lista no formato de `sha256sum`) são puros e têm teste unitário no mesmo commit (`arquivo-mensal-resumo.test.ts`: nulo nunca vira zero; o manifesto não traz nome de canal; o `.sha256` passa em `sha256sum -c` numa pasta temporária).

---

### Task 6: SQL parte 4, a conferência do B2 pela forja (lado do site)

**Files:**
- Modify: `supabase/rascunhos/m3b.sql` (parte 4)
- Create: `apps/web/test/integration/manutencao-m3b-b2.test.ts`

**Interfaces:**
- Produces (SQL, `service_role`): `obs_archive_b2_plan(p_site uuid, p_completo boolean, p_cursor text) returns jsonb` (contrato C2, sem hash esperado); `obs_archive_attest_b2(p_site uuid, p_body jsonb) returns jsonb` (C7.2); `obs_archive_attest_b2_dono(p_site uuid, p_class text, p_month date, p_by text, p_itens jsonb) returns jsonb` (o comando `atestar-b2` e o `ensaiar-restauracao` do dono, M8: grava a origem `dono`); `obs_archive_b2_month_state(p_site uuid, p_class text, p_month date) returns jsonb` (para o plano e a página: atestação vigente, origem, retirada, idade). Interna (r2.2, I3 do Phil): `obs_archive_b2_aceitar_paginas(p_site uuid, p_run uuid) returns void` (a retomada do completo entre execuções).
- Consumes: Su1 da M3a (o `fileId` da última conferência boa fica em `obs_archive_b2_files.last_ok_file_id`).

**O que acontece quando o dado não existe:** nenhum mês selado: o plano do B2 traz só o controle negativo e os canários, com `primeira_selagem: null` e `estado` dos dois filhos `aguardando_primeira_selagem` (decidido pelo site, K1; a forja copia, nunca deduz). Filho com mês selado e nada a conferir hoje: `estado.<filho> = 'nada_devido'`, que só vale como verde com `canario_ok.<filho>` na mesma execução (K1). Nenhum canário informado pelo copiador ainda: o site só manda canário que conhece por informe do copiador (`obs_archive_canaries`; o `_canario/prova-m3a` da M3a nunca entra no plano); `canarios` traz **sempre dois itens**, com `caminho: null` no filho sem canário de 6 horas (Pedido 8), e a execução **não** chega a `controle_ok` (o controle positivo falta): nada atesta, e o âmbar "a cópia para o B2 não sobe nada há N dias" conta desde o primeiro informe esperado. Informe sem `file_id`/`upload_timestamp` com `presente`: recusado na borda (Zod) e, se chegar ao banco, `sem_file_id`, registrado como tentativa `sem_acesso`.

- [ ] **Passo 1. Testes, falhando** (`manutencao-m3b-b2.test.ts`, `aplicarM3b(c, 4)`, um mês selado semeado pelas funções da Tarefa 5):

| Teste (item) | Afirma |
|---|---|
| `o plano do B2 nunca traz hash esperado` (132) | `jsonb_path_exists(plano, '$.**.sha256')` falso, idem `row_count`, `control_sum`, `hash_conteudo` |
| `informe de arquivo antes do controle: recusado` (132, Phil I3) | primeiro informe só com um arquivo: `recusado`/`controle_pendente`; nada em `obs_archive_b2_files`; com o negativo `ausente` aceito e o canário do **outro** filho aceito, arquivo do filho sem canário: `controle_pendente` |
| `negativo sem acesso deixa o controle pendente, nunca controle_falhou` (Phil I3) | negativo `sem_acesso`: `aceito`, `estado = 'aguardando_controle'`; informe de arquivo depois: `controle_pendente`; idem com `chave_ausente` |
| `negativo presente sem sha256 é aceito na forma e dá controle_falhou` (Pedido 10) | `{arquivo_id: 'controle_negativo', resultado: 'presente', file_id, upload_timestamp}` sem `sha256`: `estado = 'controle_falhou'`, `negativo_ok = false` |
| `nao_decifra é divergente já no primeiro informe` (K4, Pedido 1) | com `controle_ok`: retira o mês, `b2_last_attempt_result = 'divergente'`, `vermelhos` traz `b2_ilegivel:<arquivo_id>`, `last_ok_file_id` não muda; sem `controle_ok`: `recusado`/`controle_pendente`; canário `nao_decifra`: `controle_falhou` |
| `estado por filho decidido pelo site` (K1, Pedido 4) | nenhum mês selado: os dois `aguardando_primeira_selagem`; série selada e conferida há 2 dias: `numerico = 'nada_devido'`, `texto = 'aguardando_primeira_selagem'`; arquivo do filho devido: `com_pedidos`; a resposta do `attest` traz `canario_ok` por filho |
| `canários: sempre dois, caminho nulo no filho sem canário de 6 horas` (Pedido 8) | sem informe do copiador no filho texto: `canarios` com `canario:texto` e `caminho: null` |
| `páginas do completo: o mesmo execucao_id` (Pedido 7) | 1.200 arquivos: três páginas de até 500, o mesmo `execucao_id`; uma só linha em `obs_archive_b2_runs` |
| `validade renovada a cada página e retomada pelo cursor` (X1) | relógio por `obs_archive.agora`: página 1 às 10:00, página 2 às 11:50, informe às 13:40 → `aceito` (prazo renovado às 11:50); informe às 13:51 → `recusado`/`execucao_vencida`; `GET` com o cursor da página 2 às 14:00 → `execucao_id` novo, `negative_name` novo, `estado = 'aguardando_controle'` e a página traz os arquivos depois do último da página 2 (nunca os da página 1); cursor com `execucao_id` de outro site → `cursor_invalido` |
| `teto_bytes_mes` (Pedido 3, P59) | `teto_bytes_mes` = metade da franquia de `obs_archive_b2_franquia_mes()`; piso do dia maior que o teto do mês: `vermelhos` traz `b2_piso_acima_do_teto` (âmbar na página) |
| `controle negativo presente: controle_falhou, nada atesta nem retira` (132) | com uma atestação anterior do mês, ela continua; `estado = 'controle_falhou'` |
| `canário adulterado: controle_falhou e nenhuma retirada, mesmo com todos os arquivos errados` (132) | |
| `primeiro informe diferente responde repetir e não retira; segundo igual é divergente e retira; segundo com outros valores é sem_acesso` (132) | `b2_withdrawn_at` só no segundo caso; `b2_last_attempt_result` em cada passo: `divergencia_a_confirmar`, `divergente`, `sem_acesso` |
| `segundo informe que não vem em 48 horas é divergente` (132) | relógio por `obs_archive.agora` (parâmetro de teste, como `obs_archive.hoje`) |
| `arquivo ausente recebido há mais de 48 h: arquivo_ausente e retira; há menos: aguardando_b2, não atesta nem retira` (132) | |
| `sem file_id, ou file_id fora do formato: não atesta` (132) | `recusado`/`sem_file_id` e tentativa `sem_acesso`; a mesma recusa em 3 execuções seguidas entra em `vermelhos` (Tarefa 7) |
| `upload_timestamp anterior ao received_at é aceito` (132) | |
| `execução cortada depois de N arquivos mantém os N` (132) | dois lotes, sem terceiro: os do primeiro lote têm `last_ok_at` |
| `b2_attested_at só com todos os arquivos do mês ok, com a hora do banco e a da conferência mais antiga do conjunto` (133) | |
| `origens não se sobrescrevem; ok da forja depois do dono não encurta os 35 dias` (133) | `b2_dono_ok_at` fica; `b2_attested_via` derivado é o que vence mais tarde |
| `retirada pelo dono não é limpa por ok da forja; retirada pela forja limpa pelo dono registra a divergência` (133) | `b2_forja_diverged_at` preenchido |
| `o canário nunca vale como atestação de mês` (134) | |
| `o plano do B2 lista partes, nunca a unidade em partes; nunca unidade vazia` (Phil I2) | arquivos de `obs_archive_month_files`; `b2_forja_ok_at` não nulo com a early vazia no mesmo mês |
| `permissões das internas` (K3) | `has_function_privilege('service_role', 'public.obs_archive_b2_run_gate(uuid,uuid,jsonb)', 'execute')` e o mesmo para `obs_archive_agora()` e `obs_archive_b2_aceitar_paginas(uuid,uuid)` (r2.2): falsos |
| `o fileId da última conferência boa fica, não o do último informe` (Su1) | um `ok` com `file_id` A e depois um `divergente` com B: `last_ok_file_id = A` |
| `o canário prova-m3a nunca entra` (M3a, "Canário") | dia fora de `AAAA-MM-DD` nunca é gravado em `obs_archive_canaries` nem mandado no plano |
| `teto_bytes_dia` (P59) | o piso é 2 × a soma de `file_bytes` do registro (unidades, resumos e anexos), recalculada a cada plano; com registro vazio, 1 MiB |
| `completo retomado entre execuções` (r2.2, I3 do Phil) | 1.200 arquivos, `p_completo`: execução A serve as páginas 1 e 2 (`cobertura = {0, 3}` na abertura, `retomado_de: null`); informes conclusivos da página 1 inteira e de metade da 2; a forja para (orçamento). Novo `obs_archive_b2_plan(site, true, null)`: execução B com `execucao_id` novo, `retomado_de = '<A>\|<último arquivo_id da página 1>'`, `cobertura = {1, 3}`, `arquivos` começando no primeiro da página 2 (nunca um da página 1) e `completo_desde` igual ao de A. B informa o resto: na última página aceita, `completo_fechado_em` preenchido e `cobertura = {3, 3}`; o `completo` seguinte vem com `retomado_de: null` e começa do primeiro arquivo |
| `página com sem_acesso não é aceita e segura o cursor` (r2.2) | página 1 com um `sem_acesso` e página 2 toda `ok`: `cursor_aceito` nulo, `paginas_aceitas = 0`; a execução seguinte recomeça da página 1 (`retomado_de: null`), no mesmo completo |
| `retomada dentro e entre execuções juntas` (r2.2 com X1) | cursor vencido de B abre C que herda `completo_desde`, `paginas_aceitas` e `cursor_aceito` de B; item aceito em B e não reinformado em C conta para aceitar a página em C (o critério é "informe conclusivo desde `completo_desde`") |
| `completo pedido pelo pode-desligar também retoma` (r2.2) | sem `p_completo`, com mês fora do banco e B2 de 8 dias: `modo = 'completo'`, `cobertura` não nula, e a retomada vale igual |
| `modo normal: retomado_de e cobertura nulos` (r2.2) | `RespostaPlanoB2` aceita a resposta da função; nenhuma coluna de completo preenchida na execução normal |
| `o purgo de 90 dias não apaga o completo em aberto` (r2.2) | execução completo de 100 dias sem `completo_fechado_em`, a mais recente do site: continua na tabela depois de um plano novo |

(As validades de 7 e 35 dias e o desarme do interruptor são da condição 6 do portão, M6; aqui só se grava o estado que ela lê.)

- [ ] **Passo 2. A parte 4.** Código da execução e do controle (o resto segue as regras da tabela abaixo):

```sql
-- M3B PARTE 4: a conferência do B2 pela forja (02 §10.9)

create or replace function public.obs_archive_agora() returns timestamptz language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('obs_archive.agora', true), '')::timestamptz, now())
$$;
revoke all on function public.obs_archive_agora() from public, anon, authenticated, service_role;   -- Yannis M6; gancho de teste declarado

-- O filho de um arquivo pela classe do registro (u, p, s, a: a linha; m: a classe no id). Nulo = desconhecido.
create or replace function public.obs_archive_filho_do_arquivo(p_site uuid, p_id text) returns text
language sql stable security definer set search_path = '' as $$
  select p.filho from public.obs_archive_policy() p
   where p.class = coalesce(
     (select u.class from public.obs_archive_units u where u.site_id = p_site and p_id ~ '^[up]:' and u.id::text = split_part(p_id, ':', 2)),
     (select s.class from public.obs_archive_summaries s where s.site_id = p_site and p_id ~ '^s:' and s.id::text = split_part(p_id, ':', 2)),
     (select 'video_antigo' where p_id ~ '^a:'),
     (select split_part(p_id, ':', 2) where p_id ~ '^m:'))
   limit 1
$$;
revoke all on function public.obs_archive_filho_do_arquivo(uuid, text) from public, anon, authenticated, service_role;

-- r2.2 (I3 do Phil): aceita as páginas do completo em ordem. Página aceita = todo arquivo dela tem informe conclusivo
-- desde o início do completo em aberto (vale o que outra execução da mesma cadeia já aceitou: X1). A primeira página
-- não aceita para a conta e segura o cursor; sem_acesso e repetir pendente nunca cobrem (não falha em verde).
create or replace function public.obs_archive_b2_aceitar_paginas(p_site uuid, p_run uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_run public.obs_archive_b2_runs; v_pag jsonb; v_i integer; v_novas jsonb; v_n integer := 0; v_ate text; v_ultima boolean := false;
begin
  select * into v_run from public.obs_archive_b2_runs where id = p_run and site_id = p_site for update;
  if not found or v_run.modo <> 'completo' or v_run.estado <> 'controle_ok' or v_run.completo_desde is null then return; end if;
  v_novas := v_run.paginas;
  for v_i in 0 .. jsonb_array_length(v_run.paginas) - 1 loop
    v_pag := v_run.paginas -> v_i;
    continue when (v_pag->>'aceita')::boolean;
    exit when exists (
      select 1 from jsonb_array_elements_text(v_pag->'ids') x(id)
        left join public.obs_archive_b2_files b on b.site_id = p_site and b.arquivo_id = x.id
       where b.arquivo_id is null or b.last_attempt_at is null or b.last_attempt_at < v_run.completo_desde
          or b.last_attempt_result not in ('ok', 'divergente', 'arquivo_ausente', 'aguardando_b2'));
    v_novas := jsonb_set(v_novas, array[v_i::text, 'aceita'], 'true'::jsonb);
    v_n := v_n + 1; v_ate := v_pag->>'ate'; v_ultima := (v_pag->>'ultima')::boolean;
  end loop;
  if v_n = 0 then return; end if;
  update public.obs_archive_b2_runs
     set paginas = v_novas, paginas_aceitas = paginas_aceitas + v_n,
         cursor_aceito = coalesce(p_run::text || '|' || v_ate, cursor_aceito),       -- página vazia (sem `ate`) não move o cursor
         completo_fechado_em = case when v_ultima then public.obs_archive_agora() else completo_fechado_em end
   where id = p_run;
end $$;
revoke all on function public.obs_archive_b2_aceitar_paginas(uuid, uuid) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_b2_run_gate(p_site uuid, p_run uuid, p_item jsonb)
returns text language plpgsql security definer set search_path = '' as $$
-- Aplica um informe de controle (negativo ou canário) e devolve a resposta; para arquivo comum, devolve 'seguir' ou o motivo da recusa.
declare v_run public.obs_archive_b2_runs; v_id text := p_item->>'arquivo_id'; v_filho text; v_can public.obs_archive_canaries;
begin
  select * into v_run from public.obs_archive_b2_runs where id = p_run and site_id = p_site for update;
  if not found then return 'desconhecido'; end if;
  if v_run.expires_at < public.obs_archive_agora() then return 'execucao_vencida'; end if;
  if v_id = 'controle_negativo' then
    if p_item->>'resultado' = 'ausente' then
      update public.obs_archive_b2_runs set negative_ok = true where id = p_run;
    elsif p_item->>'resultado' in ('sem_acesso', 'chave_ausente') then
      return 'aceito';                       -- sem acesso o negativo fica pendente e nada atesta; não é "o controle falhou" (Phil I3)
    else
      update public.obs_archive_b2_runs set negative_ok = false, estado = 'controle_falhou' where id = p_run;
    end if;
  elsif v_id in ('canario:numerico', 'canario:texto') then
    v_filho := split_part(v_id, ':', 2);
    select * into v_can from public.obs_archive_canaries c
     where c.site_id = p_site and c.filho = v_filho and c.dia = (v_run.canary_days->>v_filho)::date;
    if found and p_item->>'resultado' = 'presente' and p_item->>'sha256' = v_can.sha256
       and coalesce(p_item->>'file_id', '') ~ '^4_z[0-9a-f]{24}_f[0-9a-f]{3}_[0-9a-z_]+$' then
      update public.obs_archive_b2_runs set canary_ok = canary_ok || jsonb_build_object(v_filho, true) where id = p_run;
      update public.obs_archive_canaries set b2_ok_at = now(), b2_file_id = p_item->>'file_id' where site_id = p_site and filho = v_filho and dia = v_can.dia;
    else
      update public.obs_archive_b2_runs set canary_ok = canary_ok || jsonb_build_object(v_filho, false), estado = 'controle_falhou' where id = p_run;
      update public.obs_archive_canaries set b2_failed_at = now() where site_id = p_site and filho = v_filho and dia = v_can.dia;
    end if;
  else
    if v_run.estado = 'controle_falhou' then return 'controle_falhou'; end if;
    v_filho := public.obs_archive_filho_do_arquivo(p_site, v_id);       -- pela classe do registro; nulo = desconhecido
    if v_filho is null then return 'desconhecido'; end if;
    -- o arquivo só passa depois do negativo ausente E do canário do mesmo filho (C2; Phil I3)
    if not coalesce(v_run.negative_ok, false) or not coalesce((v_run.canary_ok->>v_filho)::boolean, false) then
      return 'controle_pendente';
    end if;
    return 'seguir';
  end if;
  update public.obs_archive_b2_runs set estado = 'controle_ok'
   where id = p_run and estado = 'aguardando_controle' and negative_ok
     and coalesce((canary_ok->>'numerico')::boolean, false) and coalesce((canary_ok->>'texto')::boolean, false);
  return 'aceito';
end $$;
revoke all on function public.obs_archive_b2_run_gate(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
```

| Função | Regras |
|---|---|
| `obs_archive_b2_franquia_mes()` | Constante (bytes): a franquia mensal de saída do B2 lida na CP24. **NÃO VERIFICADA:** até a leitura, 2.444 GB (3 × 814,8 GB, P59, vale só se a franquia for da conta e não do bucket); a leitura da CP24 é a Tarefa 0, Passo 6, e muda só este número no rascunho (depois da migration, por migration nova) |
| `obs_archive_b2_plan` | Sem `p_cursor`: cria a linha em `obs_archive_b2_runs` (validade 2 h; `negative_name` = `'_controle/' \|\| gen_random_uuid()`, em `numerico` ou `texto` alternados por execução; `canary_days` = o dia do canário mais recente de cada filho informado pelo copiador **há pelo menos 6 horas**, ou nulo) e apaga as execuções com mais de 90 dias (Phil M4: a última boa por arquivo fica em `obs_archive_b2_files`). Com `p_cursor` (`<execucao_id>\|<último arquivo_id>`) de execução **dentro da validade**: não cria execução; renova `expires_at = obs_archive_agora() + 2 h` (X1: a validade conta de cada página pedida) e devolve o **mesmo** `execucao_id` e a página seguinte (Pedido 7). Com `p_cursor` de execução deste site **vencida** (`expires_at < obs_archive_agora()`): cria uma execução nova como no caso sem cursor (outro `execucao_id`, outro `negative_name`, controle pendente, `expires_at` = agora + 2 h, o mesmo `modo`) e devolve a página seguinte ao `arquivo_id` do cursor (a forja retoma da última página aceita, sem recomeçar do zero). `p_cursor` fora da forma ou de execução que não existe neste site: devolve `{"erro": "cursor_invalido"}` e a rota responde `400 VALIDATION_ERROR` com `details: ['cursor']`. `canarios`: sempre dois itens, `caminho` nulo no filho sem `canary_days` (Pedido 8). `estado` por filho (K1): `aguardando_primeira_selagem` sem mês selado em classe do filho; `nada_devido` com mês selado e nenhum arquivo do filho em `arquivos` (em todas as páginas); senão `com_pedidos`. `teto_bytes_mes` = `obs_archive_b2_franquia_mes() / 2` (Pedido 3); piso do dia acima disso grava o vermelho `b2_piso_acima_do_teto`. `arquivos` (de `obs_archive_month_files`, D23: partes no lugar da unidade em partes, sem unidade vazia nem resumo vazio): (a) todo mês selado que pode sair nos próximos 7 dias (na M3b: nenhum, a saída é da M6; a regra nasce aqui e devolve vazio enquanto nenhuma classe estiver liberada); (b) os demais meses selados e não descartados com a conferência de algum arquivo há mais de 5 dias, nunca conferida, ou com versão nova; (c) os descartados em rodízio, cada um ao menos a cada 30 dias, até o orçamento de bytes (total guardado ÷ 30 × 1,2). Ficam fora: unidade vazia, com `lost_at` ou `purged_at`; resumo vazio ou com `purged_at` (item 165). Com `p_completo` ou com o `pode-desligar` pedindo (B2 com mais de 7 dias em mês que saiu do banco), devolve tudo, em páginas de 500 por `p_cursor` (`arquivo_id` maior que o do cursor, em ordem). Mais `teto_bytes_dia`, `teto_bytes_mes`, `primeira_selagem`, `vermelhos` (da Tarefa 7). **Sem "um arquivo por dia"** (K1): plano sem arquivo depois da primeira selagem é `nada_devido`, e a leitura real diária é a do canário. **Retomada do completo entre execuções (r2.2, I3 do Phil):** toda execução que devolve tudo (`p_completo` ou o `pode-desligar` pedindo) é `modo = 'completo'`. Sem `p_cursor`, lê a execução completo mais recente do site (`idx_oab2r_completo`): sem nenhuma, ou com `completo_fechado_em` preenchido, abre completo novo (`completo_desde = obs_archive_agora()`, `retomado_de` e `cursor_aceito` nulos, `paginas_aceitas = 0`); senão herda `completo_desde`, `paginas_aceitas` e `cursor_aceito` dela, grava `retomado_de = cursor_aceito` e começa os `arquivos` depois do `arquivo_id` desse cursor (do primeiro, se nulo). Cursor vencido (X1) herda os mesmos campos da execução do cursor e grava `retomado_de = p_cursor`. `paginas_total` = `paginas_aceitas` + `ceil(arquivos que faltam depois do ponto / 500)`, mínimo 1, contado na abertura. Cada página servida (a primeira e cada `p_cursor`) é acrescentada a `paginas` (`ate` = último `arquivo_id`, `ids`, `ultima` = `cursor_seguinte` nulo, `aceita: false`). A resposta traz `retomado_de` e `cobertura = {paginas_aceitas, paginas_total}` da execução; no modo normal, os dois `null`. O purgo de 90 dias nunca apaga a execução completo mais recente do site (ela guarda o ponto) |
| `obs_archive_attest_b2` | Para cada item, `obs_archive_b2_run_gate`. Com `seguir`: **`nao_decifra`** (K4) é `divergente` já no primeiro informe: retira o mês, `b2_last_attempt_result = 'divergente'`, grava o vermelho `b2_ilegivel:<arquivo_id>` e nunca grava o `file_id` como `last_ok_file_id`; nunca `repetir`. `presente` exige `file_id` no formato (senão `recusado`/`file_id_invalido`, tentativa `sem_acesso`) e compara `sha256`, `linhas` e `soma` com o registro. Igual: `ok` em `obs_archive_b2_files` (`last_ok_at = now()`, `last_ok_file_id`, `last_ok_upload_ts`, zera `pending_*`). Diferente, `tentativa = 1` e sem `pending_mismatch`: grava `pending_mismatch` com os três valores informados e `pending_since`, resultado `divergencia_a_confirmar`, resposta `repetir`. Diferente com `pending_mismatch` igual: `divergente` e **retira** o mês. Diferente com outro valor: `sem_acesso`. `ausente`: com `received_at` há mais de 48 h, `arquivo_ausente` e retira; senão `aguardando_b2`. `sem_acesso` e `chave_ausente`: tentativa registrada, nada retira. Depois, por mês tocado: `b2_last_attempt_*` sempre; `b2_forja_ok_at` = a **mais antiga** `last_ok_at` do conjunto de arquivos do mês, só se todos os arquivos do conjunto têm `last_ok_at` da mesma versão selada e dentro de 7 dias entre si (30 no rodízio); `b2_attested_at`, `_via`, `_by` derivados das duas origens (vence a que vence mais tarde: forja + 7 dias contra dono + 35 dias). Retirada: `b2_withdrawn_at`, `_reason`, `_via = 'forja'`, `b2_attested_at` nulo. Uma rodada de `pending_mismatch` sem segundo informe em 48 h vira `divergente` na leitura seguinte do plano. `b2_forja_ok_at` olha os arquivos de `obs_archive_month_files` (D23). A resposta traz `execucao: {estado, negativo_ok, canario_ok: {numerico, texto}}` (C7.2). **r2.2:** no fim de cada chamada de execução `completo`, `obs_archive_b2_aceitar_paginas(p_site, run)` (abaixo) |
| `obs_archive_attest_b2_dono` | O mesmo com `via = 'dono'` e `b2_dono_ok_at`; a retirada feita pelo dono só é limpa por `ok` do dono; `ok` do dono que limpa retirada da forja grava `b2_forja_diverged_at = now()` (a M6 desarma o interruptor por ela) |

- [ ] **Passo 3.** Run → PASS. **Passo 4.** Confirmar a parte 4 no banco local.
- [ ] **Passo 5. Commit:**

```bash
git add -- apps/web/test/integration/manutencao-m3b-b2.test.ts
git commit -m "feat: rascunho da M3b, parte 4: conferência do B2 pela forja, controle negativo, canário e fileId bom (manutenção M3b, itens 132 a 134)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m3b.sql apps/web/test/integration/manutencao-m3b-b2.test.ts
```

---

### Task 7: SQL parte 5, o plano do copiador, o atraso, os vermelhos, a varredura completa, o batimento e o `pode-desligar`

**Files:**
- Modify: `supabase/rascunhos/m3b.sql` (parte 5)
- Create: `apps/web/test/integration/manutencao-m3b-plano.test.ts`

**Interfaces:**
- Produces (SQL, `service_role`): `obs_archive_plan(p_site uuid, p_completo boolean, p_cursor text) returns jsonb` (C1); `obs_archive_vermelhos(p_site uuid) returns text[]`; `obs_archive_atraso(p_site uuid) returns jsonb` (`{amarelos: n, vermelhos: n, mais_antiga: date, meses_sem_selo: n}`); `obs_archive_heartbeat_write(p_site uuid, p_worker text, p_body jsonb) returns jsonb` (C8); `obs_archive_pode_desligar(p_site uuid) returns jsonb` (C11; também para o dono pela conexão direta). Interna (r2.2, M6 do Phil): `obs_archive_b2_teto_cor(p_site uuid) returns text` (`verde`, `ambar`, `vermelho`).
- Constantes no corpo (nomeadas, com teste de relógio falso nos dois lados): atraso amarelo 5 dias, vermelho 30; silêncio do NAS para a varredura 24 h; página de `reconferir` 1.000 em qualquer modo (Yannis I5); descartado sem releitura amarelo 21 e vermelho 45 dias, contados pelos dois lados (NAS pelo `nas_reported_at`, B2 pelo `b2_ok_at` de `obs_archive_month_files`; o mês entra se qualquer arquivo dele passar do limite em qualquer lado), e `b2_atrasado` (mês selado não descartado com algum arquivo sem `b2_ok_at` há mais de 7 dias; amarelo 5); NAS 80%; `a_apagar` dos últimos 30 dias.

**O que acontece quando o dado não existe:** nenhum canal no site: `exportar: []`, `primeira_selagem: null`, `vermelhos: []`, e o plano diz isso sem erro. Nenhum batimento do copiador: a varredura não é devida pelo silêncio do plano (só com batimento `nas_ok` verdadeiro antes); o primeiro batimento bom abre a varredura se já há unidade recebida (C8), e o atraso continua medido pelo site. Batimento de `conferir_b2` ou `respondedor` nunca mexe no silêncio. Par esperado sem unidade nenhuma conta no atraso (D19); mês devido sem selo conta em `meses_sem_selo`. `obs_archive_vermelhos` que falha por erro interno: a rota responde `erro_do_banco` (nunca `vermelhos: []`); o pulso da forja falha com plano ausente (M3a).

- [ ] **Passo 1. Testes, falhando** (`manutencao-m3b-plano.test.ts`, `aplicarM3b(c, 5)`, `obs_archive.hoje` e `obs_archive.agora`):

| Teste (item) | Afirma |
|---|---|
| `devido depois da margem: 28/11 para a série de outubro, 15/12 para o texto` | em 27/11 `exportar` sem outubro; em 28/11 com (`serie`, daily e early, cada canal, `2026-10`); texto de outubro só em 15/12 (pela `obs_archive_due_on`) |
| `canais devidos pela regra D14` | classes `serie`, `horaria` e `texto`: os que existem e foram cadastrados antes do fim do mês, mais os com linha; `ensaio`: o rol da carga, inclusive o sem linha (com `obs_archive_rehearsal_seed` semeada como tabela de teste), e sem rol os com linha; `ensaio` de março de 2026 aparece (sem piso de outubro); nenhum em `video_antigo` |
| `o plano nunca pede mês fora do banco` (Phil C3) | (classe, tabela, mês) com `detached_at`: fora de `exportar` e `resumos`, mesmo com `redo_reason` |
| `o início da classe é calculado uma vez` (Phil M7) | primeiro plano grava `obs_archive_switch.first_month`; segundo plano com uma linha mais antiga semeada na tabela não muda |
| `não pede mês anterior ao início da classe` (D13) | setembro de 2026 nunca aparece |
| `o atraso é do site` (28) | unidade devida desde 6 dias: amarelo; 31: vermelho, e entra em `vermelhos`; com o copiador mandando batimento "nada devido" a medida não muda |
| `o atraso conta o que não existe` (Phil I6) | par esperado sem linha nenhuma, 31 dias depois do devido: vermelho; todas as unidades recebidas, nenhum resumo pedido, 6 dias depois do devido: âmbar com `meses_sem_selo = 1` |
| `unidade de canal removido nunca é devida; com arquivo ausente vem em aguardando_dono, com o b2_file_id_bom` | |
| `unidade purged exportada e não recebida vem em a_apagar` | caminho sob `_recebendo/`; com `purged_at` há 31 dias, não vem (Phil M4) |
| `reconferir traz todo mês selado sem dropped_at em toda execução` | pelos arquivos de `obs_archive_month_files`: partes no lugar da unidade em partes, nunca unidade vazia |
| `reconferir pagina sempre` (Yannis I5) | 1.500 arquivos selados semeados, modo normal: a primeira página traz 1.000 e `cursor_seguinte`, a segunda 500 e `null`; os demais campos só na primeira; a resposta da rota com 1.000 itens tem `JSON.stringify(...).length < 4_000_000` (Tarefa 11) |
| `primeira_selagem` (M3a) | nula sem mês selado; `'2026-10'` depois do primeiro selo; com mês selado e nada a conferir, a lista do B2 vem vazia, `primeira_selagem` preenchida **e** `estado.numerico = 'nada_devido'` (K1; o `conferir-b2` não deduz nada) |
| `vermelhos` (134) | cada item entra quando acontece: atraso > 30 dias, retirada do NAS ou do B2 em qualquer mês, `conteudo_divergente`, canal `sem_destino` (Tarefa 8: o caso liga lá), consulta de vigia da remoção diferente de zero (Tarefa 8), a mesma recusa de `file_id` em 3 execuções seguidas, canário de um filho há 5 dias sem achar no B2, mês sem selo há mais de 30 dias, `canario_regravado:<filho>`, `nas_ilegivel:<id>`, `b2_ilegivel:<id>`, `nas_80:<filho>`, `tabela_ausente:<tabela>` (Phil M5), `b2_piso_acima_do_teto`; âmbar (atraso de 6 dias, canário há 2 dias) não entra; nunca nulo |
| `varredura aberta pelo batimento depois de casa desligada` (172; Phil C2 da forja, Pedido 12 do Yannis) | unidade recebida; último batimento bom do copiador há 3 dias; **batimento bom primeiro, plano depois** (a ordem da forja): o plano é `completo`, e `obs_archive_sweeps` tem a linha com `motivo = 'silencio_nas'`, `due_since` = o batimento de 3 dias atrás, `nas_back_at` = agora. Sem nenhum batimento antes e sem unidade recebida: não abre |
| `silêncio e varredura são só do copiador` (Pedido 6) | último bom do copiador há 25 h e batimento bom do `conferir_b2` agora: o plano seguinte é `completo`; `nas_checked_at` do copiador não muda |
| `uma varredura só com dois planos simultâneos` (Yannis M12) | duas conexões: nunca `23505`; uma linha aberta |
| `varredura completa` (172) | batimento com `nas_ok` verdadeiro, depois 25 h só com `nas_ok` falso: o plano seguinte é `completo` com `cursor_seguinte`; a página 2 continua; com a execução cortada, a seguinte (silêncio já < 24 h) continua só com as que faltam e não volta ao rodízio; termina quando toda unidade coberta tem `nas_reported_at` posterior à volta; `purged_at` e a diferente não seguram o fim; `nas_fora` no meio deixa as unidades faltando; relógio da forja 3 dias adiantado sem silêncio: normal; com 23 h de silêncio: normal |
| `batimento: uma gravação por 30 s, hora do banco, nunca forja_heartbeat` (30) | duas chamadas em 10 s: `gravado: false` na segunda; `forja_heartbeat` intocada |
| `teto de bytes: fronteira de dias seguidos` (r2.2, M6 do Phil) | relógio por `obs_archive.agora`, uma execução do `conferir_b2` por dia (plano do B2, depois batimento): dia 1 com `parado_no_teto = 'dia'` → resposta `teto: 'ambar'`, `vermelhos` sem `b2_teto_2_dias`; dia 2 com teto → `teto: 'vermelho'` e `vermelhos` com `b2_teto_2_dias`; dia 3 com `parado_no_teto: null` → `teto: 'verde'` e o vermelho sai. Também: dia 1 com teto, dia 2 sem execução, dia 3 com teto → `ambar` (não são seguidos); batimento do copiador → `teto: null`; segundo batimento do `conferir_b2` em 10 s (`gravado: false`) ainda marca a execução e devolve a cor; execução de `--prova` (plano sem batimento) não conta como dia sem estouro |
| `completo atrasado` (r2.2, I3 do Phil) | completo aberto há 36 dias sem fechar → `vermelhos` com `b2_completo_atrasado`; aberto há 34 → sem; completo fechado há 100 dias e nenhum aberto → sem; completo aberto ontem, última cobertura completa há 100 dias → sem (a idade conta do início do completo em aberto) |
| `b2_atrasado e descartado dos dois lados` (N2 do Phil) | relógio falso: arquivo de mês selado sem `b2_ok_at` há 7 dias → sem `b2_atrasado`; há 8 → com; mês descartado com NAS em dia e B2 sem `b2_ok_at` há 45 dias → sem o vermelho dos 45; há 46 → com (e o inverso: B2 em dia, NAS há 46 → com); amarelo em 21 e 22 pela mesma conta |
| `batimento: total_bytes e os 80%` (Pedido 5) | copiador com `total_bytes.numerico = 100`, `livre_bytes.numerico = 19`: `vermelhos` traz `nas_80:numerico`; com 21 livres, não; `parado_no_teto` do `conferir_b2` gravado em `stopped_at_cap` |
| `pode_desligar` | mês selado não recebido no NAS: `mes_nao_recebido`; com tudo recebido e nada fora do banco: `pode: true`; erro: lança (nunca `pode: true`) |
| `despausar um canal não toca o registro` (29) | só se `obs_archive_unpause` (E10) existir no banco: `skipIf` com o motivo no relatório |

- [ ] **Passo 2. A parte 5.** Regras por função (o corpo segue o molde das Tarefas 5 e 6):

| Função | Regras |
|---|---|
| `obs_archive_plan` | Sem `p_cursor`: grava `obs_archive_heartbeat.last_poll_at` do copiador (página seguinte não grava). **Modo:** completo se `p_completo`, ou se há varredura aberta em `obs_archive_sweeps`, ou se o último batimento **do copiador** com `nas_ok` verdadeiro (`nas_checked_at`, hora do banco) tem mais de 24 h e existe ao menos um (abre a varredura por `insert ... on conflict do nothing` com `motivo = 'silencio_nas'`, `due_since`: Yannis M12; o primeiro batimento bom depois grava `nas_back_at`; a primeira página entregue grava `started_at`; `finished_at` quando nenhum arquivo coberto tem `nas_reported_at` nulo ou anterior a `nas_back_at`). A varredura também abre pelo batimento (`obs_archive_heartbeat_write`, abaixo). **Início da classe** (D13): lido de `obs_archive_switch.first_month`; nulo, calcula uma vez (mínimo da coluna de tempo das tabelas da classe, piso de outubro de 2026 fora do `ensaio`) e grava. **`exportar`:** para cada classe da política, cada mês do início da classe até o último mês com `obs_archive_due_on(mês, margem) <= obs_archive_hoje_sp()`, cada par de `obs_archive_expected_units` (D19): sem unidade, ou com a maior versão tendo `redo_reason` e o canal existindo → item, com `motivo` (`nova` ou o `redo_reason`); **nunca** de (classe, tabela, mês) com `detached_at` ou `dropped_at` (Phil C3). Unidade com `received_at` nulo e `exported_at` há mais de 2 h volta como `nova` (exportada e não recebida: o copiador refaz pela mesma versão, `mesma`). **`resumos`** e **`manifestos`:** as mesmas condições de `obs_archive_summary_rows` e `obs_archive_manifest_rows`, lidas de `obs_archive_expected_units` (zero unidade é pendente; Phil C1), nunca de mês fora do banco; `manifestos` traz também o mês com `unsealed_reason = 'unidade_nova'`. **`aguardando_dono`:** unidade de canal removido sem `purged_at` e sem `lost_at`, com `nas_withdrawn_at` ou nunca recebida; unidade de mês fora do banco com `nas_withdrawn_at` (Phil C3); mais a versão registrada pelo `expurgar` (M9; aqui a regra existe e não há linha). **`a_apagar`:** unidade com `purged_at` **nos últimos 30 dias** e `received_at` nulo, em `_recebendo/<caminho>` (Phil M4). **`reconferir`:** os arquivos de `obs_archive_month_files` (D23) de todo mês selado sem `dropped_at`, e os descartados em rodízio (14 dias), fora `lost_at` e `purged_at`; **em qualquer modo**, em páginas de 1.000 por `arquivo_id > p_cursor`, ordenadas por `arquivo_id` (Yannis I5); no modo completo, todos. Os demais campos só na primeira página |
| `obs_archive_atraso` | Sobre `obs_archive_expected_units` (nunca só sobre as linhas que existem; Phil I6): cada par esperado sem unidade terminal conta, exista a linha ou não; e cada (classe, mês) devido sem `sealed_at` conta como item `mes_sem_selo`. "Devida desde" = `obs_archive_due_on(mês, margem)`. Amarelo acima de 5 dias, vermelho acima de 30. Devolve `{amarelos, vermelhos, mais_antiga, meses_sem_selo}` |
| `obs_archive_vermelhos` | Uma frase curta por item (texto fixo + números; nunca nome de canal): `atraso de cópia: N unidades há mais de 30 dias`; `NAS: N arquivos ausentes ou diferentes`; `B2: N meses com a conferência retirada`; `conteúdo divergente em N arquivos`; `mês descartado sem releitura há mais de 45 dias: N` (conta os dois lados: NAS pelo `nas_reported_at` e B2 pelo `b2_ok_at` de `obs_archive_month_files`; o mês entra se qualquer arquivo dele estiver acima de 45 dias em qualquer dos dois; o amarelo de 21 dias segue a mesma conta); `b2_atrasado: N meses selados não descartados com algum arquivo sem b2_ok_at há mais de 7 dias`; `B2 recusou o fileId em 3 execuções seguidas`; `canário do filho <f> sem chegar ao B2 há N dias` (≥ 5); `mês sem selo há mais de 30 dias: N` (Phil I6); `canario_regravado:<filho>` (Phil I4); `nas_ilegivel:<arquivo_id>` e `b2_ilegivel:<arquivo_id>` (K4); `nas_80:<filho>` (Pedido 5, do último batimento do copiador); `tabela_ausente:<tabela>` (Phil M5); `b2_piso_acima_do_teto` (P59); `b2_completo_atrasado` (r2.2, I3 do Phil, trocado pela r2.3: a execução completo mais recente do site sem `completo_fechado_em` tem `completo_desde` de mais de 35 dias; a idade conta de `completo_desde`, nunca da última cobertura); `b2_teto_2_dias` (r2.2, M6 do Phil: `obs_archive_b2_teto_cor(p_site) = 'vermelho'`); e, da Tarefa 8, `N canais removidos sem destino do arquivo` e `vigia da remoção: consulta <n> com N` |
| `obs_archive_heartbeat_write` | `p_worker` vem da rota (da permissão), nunca do corpo. Grava só se `updated_at` do mesmo trabalhador tem mais de 30 s. **Silêncio e varredura são só do copiador** (Pedido 6): com `p_worker = 'copiador'` e `nas_ok` verdadeiro, lê o `nas_checked_at` anterior **antes** de gravar o novo; se ele tem mais de 24 h, ou não existe e há unidade recebida, insere em `obs_archive_sweeps` (`motivo = 'silencio_nas'`, `due_since` = o anterior ou o `exported_at` mais antigo, `nas_back_at = now()`, `on conflict do nothing`) na mesma transação (Phil C2 da forja, Pedido 12 do Yannis); depois `nas_checked_at = now()`. Para `conferir_b2` e `respondedor`, `nas_checked_at` não é tocado. Grava `free_bytes`, `total_bytes` e, do `conferir_b2`, `stopped_at_cap` (`parado_no_teto`); `machine_time` = a hora da forja (a página compara com a do banco: âmbar acima de 2 min, `02` §10.10). **r2.2 (M6 do Phil), só do `conferir_b2` e fora da regra dos 30 s:** marca a execução mais recente do site sem `batimento_em` e começada há menos de 3 h com `batimento_em = obs_archive_agora()` e `parou_no_teto = parado_no_teto`; responde `{gravado, teto: obs_archive_b2_teto_cor(p_site)}` (`teto: null` para `copiador` e `respondedor`). A página mostra "teto de bytes" em âmbar ou vermelho pela mesma função |
| `obs_archive_pode_desligar` | `faltam`: interruptor de qualquer classe armado e não vencido (`automatico_armado`); mês selado com algum arquivo de `obs_archive_month_files` sem `received_at` (`mes_nao_recebido`); arquivo de mês com `dropped_at` (ou unidade com `dropped_at`) com `last_ok_at` do B2 há mais de 7 dias (`b2_vencido_mes_fora`). `pode = (faltam = [])`. `execute` também para `postgres` (o dono, pela conexão direta) |

Código da cor do teto (r2.2, M6 do Phil; o resto da parte 5 segue as regras da tabela acima):

```sql
-- r2.2: âmbar no primeiro dia em que o teto estoura, vermelho no segundo dia seguido; quem conta é o site, pelo
-- histórico das execuções marcadas pelo batimento do conferir_b2 (o pulso só lê a cor). Dia de São Paulo do batimento.
create or replace function public.obs_archive_b2_teto_cor(p_site uuid) returns text
language sql stable security definer set search_path = '' as $$
  with dias as (
    select (r.batimento_em at time zone 'America/Sao_Paulo')::date as dia, bool_or(r.parou_no_teto is not null) as estourou
      from public.obs_archive_b2_runs r
     where r.site_id = p_site and r.batimento_em is not null
     group by 1
  ), ultimo as (select dia, estourou from dias order by dia desc limit 1)
  select case
    when not coalesce((select estourou from ultimo), false) then 'verde'
    when exists (select 1 from dias d, ultimo u where d.dia = u.dia - 1 and d.estourou) then 'vermelho'
    else 'ambar' end
$$;
revoke all on function public.obs_archive_b2_teto_cor(uuid) from public, anon, authenticated, service_role;
```

- [ ] **Passo 3.** Run → PASS. **Passo 4.** Confirmar a parte 5 no banco local.
- [ ] **Passo 5. Commit:**

```bash
git add -- apps/web/test/integration/manutencao-m3b-plano.test.ts
git commit -m "feat: rascunho da M3b, parte 5: plano do copiador, atraso, vermelhos, varredura completa, batimento e pode-desligar (manutenção M3b, itens 28, 30, 134 e 172)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m3b.sql apps/web/test/integration/manutencao-m3b-plano.test.ts
```

---

### Task 8: SQL parte 6, a fatia 12a (remover canal declara o destino do arquivo)

**Files:**
- Modify: `supabase/rascunhos/m3b.sql` (parte 6)
- Create: `apps/web/test/integration/manutencao-m3b-remocao.test.ts`
- Modify: `apps/web/test/integration/manutencao-m3b-selagem.test.ts` (liga o caso da corrida)
- Modify: `apps/web/test/integration/manutencao-m3b-plano.test.ts` (liga os dois casos de `vermelhos`)

**Interfaces:**
- Produces (SQL, `service_role`):
  - `competitor_channel_remove(p_site uuid, p_channel uuid, p_decision text, p_via text, p_actor uuid) returns jsonb` — `{status: 'ok', decisao, unidades, blobs_pendentes}`; recusas por exceção P0001: `sem_direito`, `canal_nao_encontrado`, `decisao_invalida`, `guardar_so_pela_e10`, e (com a M6) `mes_destacado_em_transito`. **`p_decision` não tem padrão.**
  - Gatilhos em `competitor_channels`: `obs_archive_z_destino_declarado` (`before delete`, por linha) e `obs_archive_z_truncate` (`before truncate`, por instrução). O prefixo `z` põe os dois **depois** do gatilho do mês destacado da M6 (a ordem é a alfabética do nome; a M6 escolhe o nome dela antes de `z` e escreve o teste de catálogo da ordem: `02` §10.5).
  - `obs_archive_channel_removal_decide(p_site uuid, p_channel_ref text, p_actor uuid) returns jsonb` — `{status: 'ok'|'ja_pedido'}` ou `sem_direito`; a UI que a chama é da M9.
  - `obs_archive_removed_channel_list(p_site uuid) returns jsonb` — a lista derivada (`02` §10.5), uma leitura só por linha; erro sobe, nunca lista vazia.
  - `obs_archive_channel_is_removed(p_site uuid, p_channel_ref text) returns jsonb` — `{removido, decisao: 'apagar'|'guardar'|null, sem_destino}` (P55: canal ausente sem linha de remoção é `removido: true, decisao: null, sem_destino: true`; canal que existe é `removido: false`).
  - `obs_archive_vigia_remocao(p_site uuid) returns jsonb` — `{c1, c2, c3, c4}` (item 160).
  - `obs_archive_channel_archive_impact(p_site uuid, p_channel uuid) returns jsonb` — o que o diálogo diz: `{status, meses, de, ate, registros, fora_do_banco: {meses, de, ate}, videos_retirados: {n, de, ate}, imagens_blob}` (Tarefa 12).

**O que acontece quando o dado não existe:** canal sem unidade nenhuma: o gatilho deixa apagar como hoje, e a função grava a remoção mesmo assim (`sem_arquivo`, `02` §11.3). Canal que já não existe: `canal_nao_encontrado`, nada gravado. A lista derivada sem remoção nenhuma e sem unidade órfã devolve `[]`; com erro de leitura, a exceção sobe e a tela diz "não foi possível ler os canais removidos". As consultas de vigia sem tabela (registro ausente): a função não existe e o vigia fica vermelho por "função ausente" (Tarefa 13), nunca zero.

- [ ] **Passo 1. Testes, falhando** (`manutencao-m3b-remocao.test.ts`, `aplicarM3b(c, 6)`):

| Teste (item 159, salvo outro) | Afirma |
|---|---|
| `o botão grava a remoção, e sem ela o delete recusa` | `competitor_channel_remove(..., 'apagar', 'botao', admin)` → `ok`, a linha de remoção existe, o canal sumiu; `delete` direto como `service_role` de canal **com** unidade → `destino_do_arquivo_nao_declarado` e o canal continua; **sem** unidade → passa |
| `truncate com unidade no registro recusa` | |
| `declaração de outra transação não vale` | remoção gravada à mão numa transação confirmada com `declared_xid` dela; `delete` em outra transação recusa |
| `guardar pelo botão é recusado pelo banco` | `('guardar', 'botao')` → `guardar_so_pela_e10` |
| `apagar marca purged_at em toda unidade e todo resumo do canal, em toda classe, tabela, mês e versão, recebida ou não` | |
| `canal removido sem unidade nasce sem_arquivo` | `units_at_removal = 0`; `obs_archive_removed_channel_list` mostra o estado |
| `segunda remoção do mesmo canal do YouTube não falha nem toca na primeira` | recadastro (uuid novo) e nova remoção: duas linhas |
| `mês com unidade não recebida de canal apagar sela` | a unidade com `purged_at` conta como terminal |
| `item pendente da E9 é concluído com a anotação` (D15) | `competitor_removed_items` com `kind = 'video'`, `archive_pending = true` do canal: vira `false`, `archive_note = 'canal apagado inteiro'` |
| `blobs_pending vem da união das online com as dos anexos` | vídeo já retirado com anexo `perdida_na_origem`: a URL dele está em `blobs_pending` (o teste falha se a lista sair só do online) |
| `sem_direito` | editor do site (sem `org_admin`) → `sem_direito`, nada gravado; na decisão também |
| `dois cliques simultâneos gravam uma decisão` | duas conexões em `obs_archive_channel_removal_decide` de um `sem_destino`: uma `ok`, outra `ja_pedido` |
| `a linha da vigia` | `sem_destino` decidido: `removed_via = 'vigia'`, `youtube_channel_id`, `name_at_removal`, `removed_at` e `removed_by` nulos, `decided_at` não nulo (catálogo: `attnotnull`), `online_thumbs_known = false`, `thumbs_unknown_ack_at` preenchido |
| `troca de guardar por apagar grava decided_at e decided_by do clique` | remoção `guardar` semeada como dono (`e10_export`) com `decided_at` de 365 dias atrás: depois do clique, `decided_at` é de agora |
| `expurgo de canal guardado, apagar e sem_destino` | `obs_archive_record_core(..., 'expurgo')` por uma função de teste do dono (o `service_role` não chega ao `_core`, D22): `guardar` grava versão nova; `apagar` → `canal_removido`; `sem_destino` → `sem_destino`; `obs_archive_record` (sem `p_origem`), `guardar` → `canal_removido`; `unit/export` e `month/summary` de canal `guardado` nunca gravam |
| `a troca simultânea ao expurgo espera` | duas sessões, 20 rodadas nas duas ordens; nunca sobra unidade sem marca; o teste falha se a trava da linha da remoção for `for key share` (o caso troca a função por uma cópia com `for key share` e espera ver a falha) |
| `a corrida com a exportação, 20 vezes em cada forma` | (a) `obs_archive_record` de unidade contra a remoção; (b) de resumo contra a remoção; (c) `delete` direto de canal sem unidade com uma exportação em voo: nunca sobra unidade nem resumo sem `purged_at` |
| `vigia (item 160)` | registro limpo: `{c1: 0, c2: 0, c3: 0, c4: 0}`; uma unidade órfã plantada (canal apagado com o gatilho desligado como dono, dentro do teste): `c1 = 1`; remoção cujo canal ainda existe (plantada): `c2 = 1`; remoção `apagar` com unidade sem `purged_at` (plantada): `c3 = 1`; `c4` (remoção `concluido` com prefixo presente) é 0 até a M9 |
| `a função que a restauração consulta` (165, P55) | canal que existe: `removido: false`; removido `apagar`: `decisao: 'apagar'`; ausente sem remoção: `sem_destino: true` |
| `video_antigo: o mês ganha dropped_at quando só sobra unidade retirada de canal que continua` | (`02` §10.5) com dois canais, um removido: o mês do outro, todo com `dropped_at`, ganha `obs_archive_months.dropped_at` |
| `purga só com decisão apagar; perda só de canal removido` (Phil I5, K3) | `update obs_archive_units set purged_at = now(), purged_by = ..., purge_ref = 'x'` como dono, sem remoção `apagar` → `purga_sem_decisao_apagar`; `lost_at` em unidade de canal que existe → `perda_de_canal_que_existe`; `lost_reason = 'nunca_recebida'` com `received_at` preenchido → `perda_incoerente`; o mesmo `purged_at` em `obs_archive_summaries` sem remoção → recusa |
| `o service_role não escreve no registro nem chama as internas` (K3) | `has_function_privilege('service_role', 'public.obs_archive_mark_purged(uuid,text,uuid)', 'execute')` falso; idem `obs_archive_video_antigo_months(uuid,text)`, `obs_archive_destino_declarado()`, `obs_archive_mark_guard()`; `update` direto de `obs_archive_units` como `service_role` → `42501` |
| `os números do diálogo e da lista contam o conjunto corrente` (Phil I8) | v1 e v2 de 1.000 linhas da mesma unidade: `obs_archive_channel_archive_impact` com `registros = 1000`; `units_at_removal = 1`; `bytes_at_removal` soma as duas versões; `sem_destino` na lista com `sum(row_count) = 1000` |
| `p_via nulo é decisao_invalida` (Yannis M9) | `competitor_channel_remove(..., 'apagar', null, admin)` → `decisao_invalida`, nunca `23502` |
| `P51: medida num canal cheio` | 150 vídeos, 13 meses de diária, 1.100 unidades e resumos sintéticos: o tempo de `competitor_channel_remove` vai ao ledger; acima de 4 s, avisar o controlador antes da Tarefa 10 (o teto do `authenticator` é 8 s) |

Run → FAIL.

- [ ] **Passo 2. A parte 6** (a função da remoção e os gatilhos por inteiro; as demais pelas regras da tabela seguinte):

```sql
-- M3B PARTE 6: a fatia 12a (02 §10.5, "O destino do arquivo na remoção de canal"; 02 §11.3)

create or replace function public.obs_archive_mark_purged(p_site uuid, p_ref text, p_actor uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.obs_archive_units set purged_at = now(), purged_by = p_actor, purge_ref = 'remocao:' || p_ref
   where site_id = p_site and channel_ref = p_ref and purged_at is null;
  get diagnostics n = row_count;
  update public.obs_archive_summaries set purged_at = now(), purged_by = p_actor, purge_ref = 'remocao:' || p_ref
   where site_id = p_site and channel_ref = p_ref and purged_at is null;
  -- itens da E9 de vídeo e de comentário do canal (D15): concluídos com a anotação; a condição 10 deixa de contá-los
  update public.competitor_removed_items set archive_pending = false, archive_note = 'canal apagado inteiro'
   where site_id = p_site and competitor_channel_id::text = p_ref and kind in ('video', 'comentario') and archive_pending;
  return n;
end $$;

-- 02 §10.5: o mês video_antigo em que só sobra unidade retirada (dropped_at) de canal que continua ganha dropped_at.
create or replace function public.obs_archive_video_antigo_months(p_site uuid, p_ref_removido text)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  with corrente as (
    select distinct on (u.table_name, u.channel_ref, u.month) u.*
      from public.obs_archive_units u
     where u.site_id = p_site and u.class = 'video_antigo'
     order by u.table_name, u.channel_ref, u.month, u.version desc
  ), vivas as (
    select c.* from corrente c
     where c.purged_at is null and c.channel_ref <> coalesce(p_ref_removido, '')
       and exists (select 1 from public.competitor_channels k where k.id::text = c.channel_ref and k.site_id = p_site)
       and not exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = c.channel_ref)
  ), meses as (
    select v.month from vivas v group by v.month having count(*) > 0 and bool_and(v.dropped_at is not null)
  )
  update public.obs_archive_months m set dropped_at = now()
    from meses x where m.site_id = p_site and m.class = 'video_antigo' and m.month = x.month and m.dropped_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.competitor_channel_remove(p_site uuid, p_channel uuid, p_decision text, p_via text, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ch record; v_ref text := p_channel::text; v_units integer; v_bytes bigint; v_first date; v_last date; v_blobs text[];
begin
  if p_decision not in ('apagar', 'guardar') or p_decision is null then raise exception 'decisao_invalida' using errcode = 'P0001'; end if;
  if p_via is null or p_via not in ('botao', 'fila', 'e10_export') then raise exception 'decisao_invalida' using errcode = 'P0001'; end if;   -- Yannis M9
  if p_decision = 'guardar' and p_via <> 'e10_export' then raise exception 'guardar_so_pela_e10' using errcode = 'P0001'; end if;
  if not public.obs_archive_is_site_admin(p_site, p_actor) then raise exception 'sem_direito' using errcode = 'P0001'; end if;
  select c.id, c.channel_id, c.channel_name into v_ch from public.competitor_channels c where c.id = p_channel and c.site_id = p_site for update;
  if not found then raise exception 'canal_nao_encontrado' using errcode = 'P0001'; end if;
  -- unidades do conjunto corrente (a maior versão por classe, tabela e mês; Phil I8); bytes de todas as versões (o que está no disco)
  select count(*) filter (where u.version = (select max(x.version) from public.obs_archive_units x where x.site_id = u.site_id and x.class = u.class
                                               and x.table_name = u.table_name and x.channel_ref = u.channel_ref and x.month = u.month)),
         coalesce(sum(u.file_bytes), 0), min(u.month), max(u.month)
    into v_units, v_bytes, v_first, v_last
    from public.obs_archive_units u where u.site_id = p_site and u.channel_ref = v_ref and u.purged_at is null;
  select coalesce(array_agg(distinct x.url), '{}') into v_blobs from (
    select vv.thumb_blob_url as url from public.competitor_video_versions vv
      join public.competitor_videos v on v.id = vv.video_id
     where v.competitor_channel_id = p_channel and vv.thumb_blob_url is not null
    union
    select a.blob_url from public.obs_archive_unit_attachments a where a.site_id = p_site and a.channel_ref = v_ref and a.blob_url is not null
  ) x;
  insert into public.obs_archive_channel_removals (site_id, channel_ref, youtube_channel_id, name_at_removal, removed_at, removed_by, removed_via,
         archive_decision, decided_at, decided_by, units_at_removal, bytes_at_removal, first_month, last_month, blobs_pending, online_thumbs_known, declared_xid)
  values (p_site, v_ref, v_ch.channel_id, v_ch.channel_name, now(), p_actor, p_via, p_decision, now(), p_actor, v_units, v_bytes, v_first, v_last,
          v_blobs, true, pg_current_xact_id());
  if p_decision = 'apagar' then perform public.obs_archive_mark_purged(p_site, v_ref, p_actor); end if;
  perform public.obs_archive_video_antigo_months(p_site, v_ref);
  delete from public.competitor_channels where id = p_channel and site_id = p_site;   -- o gatilho da M6 (mês destacado) e o abaixo disparam aqui
  return jsonb_build_object('status', 'ok', 'decisao', p_decision, 'unidades', v_units, 'blobs_pendentes', coalesce(array_length(v_blobs, 1), 0));
end $$;

create or replace function public.obs_archive_destino_declarado() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'TRUNCATE' then
    if exists (select 1 from public.obs_archive_units) then
      raise exception 'destino_do_arquivo_nao_declarado' using errcode = 'P0001', detail = 'truncate com unidade no registro';
    end if;
    return null;
  end if;
  if exists (select 1 from public.obs_archive_units u where u.site_id = old.site_id and u.channel_ref = old.id::text)
     and not exists (select 1 from public.obs_archive_channel_removals r
                      where r.site_id = old.site_id and r.channel_ref = old.id::text and r.declared_xid = pg_current_xact_id()) then
    raise exception 'destino_do_arquivo_nao_declarado' using errcode = 'P0001', detail = old.id::text;
  end if;
  return old;
end $$;
drop trigger if exists obs_archive_z_destino_declarado on public.competitor_channels;
create trigger obs_archive_z_destino_declarado before delete on public.competitor_channels for each row execute function public.obs_archive_destino_declarado();
drop trigger if exists obs_archive_z_truncate on public.competitor_channels;
create trigger obs_archive_z_truncate before truncate on public.competitor_channels for each statement execute function public.obs_archive_destino_declarado();

-- 02 l.206-207: purged_* só com remoção 'apagar' e lost_* só em canal removido, por gatilho, e não só por check (Phil I5, K3).
create or replace function public.obs_archive_mark_guard() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.purged_at is not null and old.purged_at is null and not exists (select 1 from public.obs_archive_channel_removals r
       where r.site_id = new.site_id and r.channel_ref = new.channel_ref and r.archive_decision = 'apagar') then
    raise exception 'purga_sem_decisao_apagar' using errcode = 'P0001', detail = new.channel_ref;
  end if;
  if tg_table_name = 'obs_archive_units' and new.lost_at is not null and old.lost_at is null then
    if exists (select 1 from public.competitor_channels c where c.id::text = new.channel_ref) then
      raise exception 'perda_de_canal_que_existe' using errcode = 'P0001', detail = new.channel_ref;
    end if;
    if (new.lost_reason = 'nunca_recebida') <> (new.received_at is null) then
      raise exception 'perda_incoerente' using errcode = 'P0001', detail = new.lost_reason;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists obs_archive_mark_guard on public.obs_archive_units;
create trigger obs_archive_mark_guard before update of purged_at, lost_at on public.obs_archive_units for each row execute function public.obs_archive_mark_guard();
drop trigger if exists obs_archive_mark_guard on public.obs_archive_summaries;
create trigger obs_archive_mark_guard before update of purged_at on public.obs_archive_summaries for each row execute function public.obs_archive_mark_guard();
```

**Ordem dentro de `competitor_channel_remove`:** a linha de remoção `apagar` é gravada **antes** de `obs_archive_mark_purged` (já é assim acima), e o gatilho `obs_archive_mark_guard` a vê na mesma transação.

| Função | Regras |
|---|---|
| `obs_archive_channel_removal_decide` | Confere `obs_archive_is_site_admin` dentro. Se há remoção: `update ... set archive_decision = 'apagar', decided_at = now(), decided_by = p_actor where site_id = p_site and channel_ref = p_channel_ref and archive_decision = 'guardar' returning` (zero linhas: `ja_pedido`). Se não há e há unidade órfã (`sem_destino`): `insert ... on conflict do nothing returning` com `removed_via = 'vigia'`, nulos em `youtube_channel_id`, `name_at_removal`, `removed_at`, `removed_by`, `blobs_pending` dos anexos, `online_thumbs_known = false`, `thumbs_unknown_ack_at = now()` (zero linhas: `ja_pedido`). Depois `obs_archive_mark_purged`, `obs_archive_video_antigo_months(p_site, null)` e `insert into public.audit_log (actor_user_id, action, resource_type, site_id, after_data) values (p_actor, 'obs_archive_channel_removal_decide', 'obs_archive_channel_removal', p_site, jsonb_build_object('channel_ref', p_channel_ref, 'decisao', 'apagar'))` (sem nome de canal). A trava da linha da remoção pelo expurgo é `for share` em `obs_archive_record_core` (Tarefa 5): o `update` desta função toma `for no key update` e espera por ela |
| `obs_archive_removed_channel_list` | Parte da união das remoções com as unidades de canal ausente (`channel_ref` sem linha em `competitor_channels`), agrupa por `channel_ref` e junta à esquerda com as remoções. Por linha: `channel_ref`, `estado` (`sem_destino` sem linha; `sem_arquivo` sem unidade nem resumo; `guardado`; `pedido` para `apagar` sem marco da M9), `decided_at`, `nas_absent_at`, `b2_absent_at`, `snapshots_clear_on`, `reappeared_at`, `reappeared_count`, `online_thumbs_known`, `thumbs_unknown_ack_at`, `blobs_pendentes` (tamanho de `blobs_pending`), `youtube_channel_id` (quando a linha tem), e para o `sem_destino`: `min(month)`, `max(month)`, meses distintos, `sum(row_count)` **do conjunto corrente** (Phil I8) e as classes, pelo índice `(site_id, channel_ref)`. **Nunca `name_at_removal`** (a tela usa o código interno e o id do YouTube) |
| `obs_archive_vigia_remocao` | c1 = unidades de canal ausente sem linha de remoção (canais distintos); c2 = remoções cujo `channel_ref` ainda existe em `competitor_channels`; c3 = remoções `apagar` com unidade ou resumo sem `purged_at`; c4 = remoções com `completed_at` e prefixo presente na última conferência (0 até a M9: a coluna de prefixo nasce lá, e a função devolve 0 lendo `completed_at is not null and reappeared_at > completed_at`) |
| `obs_archive_channel_archive_impact` | Para o diálogo (Tarefa 12), numa leitura: unidades do canal do **conjunto corrente** (a maior versão por (classe, tabela, mês), sem `purged_at`; Phil I8) com `row_count > 0` → `meses` distintos, `de`, `ate`, `registros`; `fora_do_banco` = meses com `obs_archive_months.dropped_at` ou `detached_at`; `videos_retirados` = vídeos do canal com `archive_dropped_at` (M10a), com o intervalo de `published_at`; `imagens_blob` = tamanho da mesma união de `competitor_channel_remove`. Canal de outro site ou inexistente: `{status: 'nao_encontrado'}` |

Concessões: `revoke all ... from public, anon, authenticated` em todas; `grant execute ... to service_role` em `competitor_channel_remove`, `obs_archive_channel_removal_decide`, `obs_archive_removed_channel_list`, `obs_archive_channel_is_removed`, `obs_archive_vigia_remocao`, `obs_archive_channel_archive_impact`; `obs_archive_mark_purged`, `obs_archive_video_antigo_months`, `obs_archive_destino_declarado` e `obs_archive_mark_guard` com `revoke all ... from public, anon, authenticated, service_role` (sem `execute` para ninguém além do dono; K3).

- [ ] **Passo 3.** Ligar o caso da corrida em `manutencao-m3b-selagem.test.ts` e os de `vermelhos` em `manutencao-m3b-plano.test.ts`. Run os quatro arquivos de integração da M3b → PASS.
- [ ] **Passo 4. Confirmar a parte 6 no banco local** e medir P51 (Passo 1, último caso). **Atenção:** com a parte 6 confirmada, o `bythiago_int` passa a recusar `delete` de canal com unidade sem declaração; as suítes que apagam canal no banco local continuam passando porque não semeiam unidade (conferir com `HAS_LOCAL_DB=1 npx vitest run apps/web/test/integration --no-file-parallelism`, saída em arquivo, só as falhas no contexto).
- [ ] **Passo 5. Commit:**

```bash
git add -- apps/web/test/integration/manutencao-m3b-remocao.test.ts
git commit -m "feat: rascunho da M3b, parte 6: remover canal declara o destino do arquivo, gatilho que impede outro caminho, lista derivada e vigias (manutenção M3b, fatia 12a, itens 159, 160 e 165)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m3b.sql apps/web/test/integration/manutencao-m3b-remocao.test.ts apps/web/test/integration/manutencao-m3b-selagem.test.ts apps/web/test/integration/manutencao-m3b-plano.test.ts
```

---

### Task 9: o estado da remoção e as capacidades, puros (P38, P54)

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-remocao.ts`
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts`
- Create: `apps/web/test/youtube/observatorio/arquivo-mensal-estado.test.ts`

**Interfaces:**

```ts
// estado-remocao.ts
export const IDADE = { pedidoAmbar: 30, pedidoVermelho: 60, nasAmbar: 30, nasVermelho: 60, b2DepoisSnapshotsAmbar: 15, b2SemSnapshotsAmbar: 30, blobAmbar: 14, blobVermelho: 30 } as const
export type EstadoRemocao = 'sem_destino' | 'sem_arquivo' | 'guardado' | 'pedido' | 'apagado_nas' | 'apagado_b2' | 'concluido'
export type Cor = 'nenhuma' | 'ambar' | 'vermelho' | 'cinza'
export interface LinhaRemocao { estado: EstadoRemocao; decided_at: string | null; reappeared_at: string | null; nas_absent_at: string | null
  b2_absent_at: string | null; snapshots_clear_on: string | null; blobs_pendentes: number }
export function corDaRemocao(l: LinhaRemocao, o: { agora: Date; casaResponde: boolean; limpezaEmProducao: boolean }): { cor: Cor; idadeDias: number | null; blob: Cor }
// capacidades.ts ('server-only')
export interface Capacidades { comandoDeLimpeza: boolean; blocoCanaisRemovidos: boolean; dataDoComando: string | null }
export const BLOCO_CANAIS_REMOVIDOS = false   // vira true no commit da M5 que traz o componente (04 §14.3)
export function lerCapacidades(env?: NodeJS.ProcessEnv): Capacidades  // "comando sim, bloco não" volta como "não, não"
```

**O que acontece quando o dado não existe:** `decided_at` e `reappeared_at` nulos (linha da vigia antes do clique): sem idade, cor `nenhuma`, nunca vermelho. Casa sem responder: nenhuma cor por idade (âmbar "espera a casa" é da tela da M5). `OBS_ARQUIVO_LIMPEZA_CANAL` ausente, vazia, `ON`, `1` ou `true`: `comandoDeLimpeza = false`. `OBS_ARQUIVO_LIMPEZA_CANAL_DATA` ausente: `dataDoComando = null` (a frase diz "ainda não tem data para chegar").

- [ ] **Passo 1. Testes, falhando** (relógio falso nos dois lados de cada limiar, item 163, parte de idades):

```ts
// apps/web/test/youtube/observatorio/arquivo-mensal-estado.test.ts
// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { corDaRemocao, type LinhaRemocao } from '@/lib/youtube/observatorio/arquivo-mensal/estado-remocao'
import { lerCapacidades } from '@/lib/youtube/observatorio/arquivo-mensal/capacidades'

const AGORA = new Date('2027-03-01T12:00:00Z')
const dias = (n: number): string => new Date(AGORA.getTime() - n * 86_400_000).toISOString()
const base: LinhaRemocao = { estado: 'pedido', decided_at: null, reappeared_at: null, nas_absent_at: null, b2_absent_at: null, snapshots_clear_on: null, blobs_pendentes: 0 }
const cor = (l: Partial<LinhaRemocao>, o: Partial<{ casaResponde: boolean; limpezaEmProducao: boolean }> = {}) =>
  corDaRemocao({ ...base, ...l }, { agora: AGORA, casaResponde: true, limpezaEmProducao: true, ...o })

describe('cor da remoção (P38, item 163)', () => {
  it('pedido: 29 nenhuma, 30 âmbar, 59 âmbar, 60 vermelho', () => {
    expect(cor({ decided_at: dias(29) }).cor).toBe('nenhuma')
    expect(cor({ decided_at: dias(30) }).cor).toBe('ambar')
    expect(cor({ decided_at: dias(59) }).cor).toBe('ambar')
    expect(cor({ decided_at: dias(60) }).cor).toBe('vermelho')
  })
  it('a idade vem do mais recente entre decided_at e reappeared_at', () => {
    expect(cor({ decided_at: dias(200), reappeared_at: dias(1) }).cor).toBe('nenhuma')
  })
  it('linha da vigia sem decided_at: sem idade', () => { expect(cor({ estado: 'sem_destino' }).idadeDias).toBeNull() })
  it('casa fora: nenhuma cor por idade', () => { expect(cor({ decided_at: dias(90) }, { casaResponde: false }).cor).toBe('nenhuma') })
  it('apagado_nas conta de nas_absent_at', () => {
    expect(cor({ estado: 'apagado_nas', decided_at: dias(300), nas_absent_at: dias(29) }).cor).toBe('nenhuma')
    expect(cor({ estado: 'apagado_nas', decided_at: dias(300), nas_absent_at: dias(60) }).cor).toBe('vermelho')
  })
  it('apagado_b2: 14 nenhuma e 15 âmbar depois dos snapshots; sem snapshots, 30 dias de b2_absent_at', () => {
    expect(cor({ estado: 'apagado_b2', snapshots_clear_on: dias(14).slice(0, 10) }).cor).toBe('nenhuma')
    expect(cor({ estado: 'apagado_b2', snapshots_clear_on: dias(15).slice(0, 10) }).cor).toBe('ambar')
    expect(cor({ estado: 'apagado_b2', b2_absent_at: dias(30) }).cor).toBe('ambar')
  })
  it('imagens no Blob: 13, 14, 29 e 30 dias com o comando; cinza sempre sem ele', () => {
    expect(cor({ decided_at: dias(13), blobs_pendentes: 2 }).blob).toBe('nenhuma')
    expect(cor({ decided_at: dias(14), blobs_pendentes: 2 }).blob).toBe('ambar')
    expect(cor({ decided_at: dias(29), blobs_pendentes: 2 }).blob).toBe('ambar')
    expect(cor({ decided_at: dias(30), blobs_pendentes: 2 }).blob).toBe('vermelho')
    for (const n of [13, 14, 30]) expect(cor({ decided_at: dias(n), blobs_pendentes: 2 }, { limpezaEmProducao: false }).blob).toBe('cinza')
  })
})

describe('capacidades (P54, item 163)', () => {
  const salvo = { ...process.env }
  afterEach(() => { process.env = { ...salvo } })
  it('variável apagada: o comando não existe', () => {
    delete process.env.OBS_ARQUIVO_LIMPEZA_CANAL
    delete process.env.OBS_ARQUIVO_LIMPEZA_CANAL_DATA
    expect(lerCapacidades()).toEqual({ comandoDeLimpeza: false, blocoCanaisRemovidos: false, dataDoComando: null })
  })
  it('só on liga', () => {
    for (const v of ['ON', '1', 'true', '', ' on']) expect(lerCapacidades({ OBS_ARQUIVO_LIMPEZA_CANAL: v } as NodeJS.ProcessEnv).comandoDeLimpeza).toBe(false)
  })
  it('comando sim e bloco não volta como não, não', () => {
    expect(lerCapacidades({ OBS_ARQUIVO_LIMPEZA_CANAL: 'on' } as NodeJS.ProcessEnv)).toMatchObject({ comandoDeLimpeza: false, blocoCanaisRemovidos: false })
  })
  it('a data é só texto', () => {
    expect(lerCapacidades({ OBS_ARQUIVO_LIMPEZA_CANAL_DATA: '02/03' } as NodeJS.ProcessEnv).dataDoComando).toBe('02/03')
  })
})
```

- [ ] **Passo 2. Implementar.** `estado-remocao.ts`: `idade = floor((agora − referência) / 86.400.000)`, referência por estado (`pedido`: máximo de `decided_at` e `reappeared_at`; `apagado_nas`: `nas_absent_at`; `apagado_b2`: `snapshots_clear_on` mais 15, ou `b2_absent_at` mais 30 sem ele; `sem_destino`, `guardado`, `sem_arquivo`, `concluido`: sem cor por idade). `blob`: sem pendência `nenhuma`; sem o comando `cinza`; com o comando, idade de `decided_at` contra `blobAmbar` e `blobVermelho`. `casaResponde` falso zera só a cor por idade. `capacidades.ts` começa com `import 'server-only'` e lê `env ?? process.env`; `comandoDeLimpeza = env.OBS_ARQUIVO_LIMPEZA_CANAL === 'on' && BLOCO_CANAIS_REMOVIDOS`. Nenhuma das duas funções lê banco nem muda estado.
- [ ] **Passo 3.** Run → PASS. **Passo 4. Commit:**

```bash
git add -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-remocao.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts apps/web/test/youtube/observatorio/arquivo-mensal-estado.test.ts
git commit -m "feat: estado e cor da remoção de canal, e as capacidades do item 12, puros (manutenção M3b, P38 e P54)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-remocao.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts apps/web/test/youtube/observatorio/arquivo-mensal-estado.test.ts
```

(Se `server-only` quebrar o teste em ambiente `node`, o teste usa o `alias` que o projeto já tem para ele; conferir em `apps/web/vitest.config.ts` antes de escrever.)

---

### Task 9a: a chave do arquivo não lê o resto do pipeline (K2; não espera a migration)

**Files:**
- Modify: `apps/web/src/lib/pipeline/auth.ts` (logo depois da recusa de `ehDoPerfil`, `:98-100`)
- Create: `apps/web/test/lib/pipeline/auth-arquivo.test.ts` (no molde de `auth-perfil.test.ts`)
- Disco: `.superpowers/sdd/manutencao-nas/aviso-a5-auth-arquivo.md` (aviso ao controlador da A5: `auth.ts` é arquivo da trilha A5/E19)

**Por quê agora:** as chaves `archive_copy`, `archive_b2` e `archive_read` já existem (M3a) e moram na forja; com a E19 em `aviso`, cada uma lê hoje as ~60 rotas GET do pipeline (`helpers.ts:46-58`). A recusa não depende da migration nem de `OBS_ARQUIVO` e vale em qualquer modo da E19 (D21; Yannis I6, opção (a)).

**O que acontece quando o dado não existe:** `permissions` vazia ou fora do formato já chega como lista vazia (`auth.ts:94-97`): `soArquivo` é falso para lista vazia (`length > 0`), e a chave segue as regras de hoje. Chave com `archive_copy` **e** outra permissão (`read`): não é "só arquivo" e segue as regras de hoje (nenhuma chave assim existe; o teste a cobre para a regra não ser lida ao contrário).

- [ ] **Passo 1. Conferir o arquivo compartilhado** (Global Constraints): `git diff --stat -- apps/web/src/lib/pipeline/auth.ts` vazio; se não, registrar e esperar.
- [ ] **Passo 2. Teste, falhando** (`auth-arquivo.test.ts`, `@vitest-environment node`, a tabela de chaves falsa do projeto): `chave archive_copy em GET /api/pipeline/items: 403 "Forbidden"`, com `modoLeitura` simulado em `aviso` **e** em `recusa`; o mesmo para `archive_b2` e `archive_read`; `chave archive_copy em /api/pipeline/archive/plan`: passa da autenticação (`ok: true`); `chave {archive_copy, read} em GET /api/pipeline/items`: segue a regra de hoje (não recusa por esta regra).
- [ ] **Passo 3. Implementar:**

```ts
    // K2 (manutenção M3b): chave só do arquivo (todas as permissões archive_*) não abre nada fora de /api/pipeline/archive/,
    // em qualquer modo da E19. A chave mora na forja; o arquivo não lê pesquisa, canais nem analytics.
    const soArquivo = permissions.length > 0 && permissions.every(p => p.startsWith('archive_'))
    if (soArquivo && !req.nextUrl.pathname.startsWith('/api/pipeline/archive/')) {
      return { ok: false, status: 403, error: 'Forbidden' }
    }
```

- [ ] **Passo 4.** Run `npx vitest run apps/web/test/lib/pipeline` (saída em arquivo; só as falhas no contexto) → PASS. `npx tsc --noEmit -p apps/web`.
- [ ] **Passo 5. Aviso à A5** no mesmo dia (arquivo em disco, entregue pelo controlador): a regra, o teste e o commit. **Commit:**

```bash
git add -- apps/web/test/lib/pipeline/auth-arquivo.test.ts
git commit -m "fix: chave só do arquivo (archive_*) não abre rota do pipeline fora de /api/pipeline/archive (manutenção M3b, K2)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/pipeline/auth.ts apps/web/test/lib/pipeline/auth-arquivo.test.ts
```

---

### Task 10: a vez da migration e o dia da M3b em produção (dono: `db:push:prod`, na janela)

**Files:**
- Create (Passo 1, por `npm run db:new manutencao_m3b_arquivo` + cópia do rascunho): `supabase/migrations/<ts>_manutencao_m3b_arquivo.sql`
- Delete (Passo 1, `git rm` no mesmo commit): `supabase/rascunhos/m3b.sql`
- Modify (Passo 1): `apps/web/test/helpers/m3b.ts` (só `M3B_SQL_CAMINHO` e `M3B_EM_MIGRATION`)
- Disco, sem commit: `.superpowers/sdd/manutencao-nas/LEIAME-COMANDOS.md` (seção "AGORA"), o ledger, `.superpowers/sdd/manutencao-nas/m3b/m3b-10-conferencia-prod.sh`

**Interfaces:**
- Consumes: Tarefas 1 a 9 no `staging`, CI verde; TRAVA M3b-0 (M2 e M10a em produção, com as linhas nos ledgers); a M10a já com o arquivo de migration dela (o da M3b precisa de timestamp posterior: `npm run db:new` garante).
- Produces: M3b em produção e conferida; a linha "TRAVA M3b-2 solta em <data hora>" no ledger.

**O que acontece quando o dado não existe:** sem as duas linhas da TRAVA M3b-0, nada desta tarefa começa e o arquivo não é criado. `migration list --linked` com pendente que não é a do dia: o dono para e o agente avisa o controlador (outra trilha deixou migration por aplicar).

- [ ] **Passo 1. A vez da migration** (agente, no dia, logo antes de o dono fazer o push):

```bash
git fetch origin staging
npm run db:new manutencao_m3b_arquivo
F=$(ls supabase/migrations/*_manutencao_m3b_arquivo.sql); V=$(basename "$F" | cut -c1-14)
cp supabase/rascunhos/m3b.sql "$F"
```

Em `apps/web/test/helpers/m3b.ts`, trocar só as duas constantes:

```ts
export const M3B_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/migrations', readdirSync(resolve(__dirname, '../../../../supabase/migrations')).find(n => n.endsWith('_manutencao_m3b_arquivo.sql')) ?? 'manutencao_m3b_ausente.sql')
export const M3B_EM_MIGRATION = true
```

`git rm supabase/rascunhos/m3b.sql`; registrar a versão no `bythiago_int` (que já tem as seis partes confirmadas):

```bash
PGPASSWORD=postgres /opt/homebrew/bin/psql -h 127.0.0.1 -p 54422 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "insert into supabase_migrations.schema_migrations (version, name) values ('$V', 'manutencao_m3b_arquivo') on conflict do nothing"
```

Rodar `npx vitest run apps/web/test/manutencao/migrations-leitura.test.ts` (TRAVA M3b-1 e D17 contra a migration) e, com `HAS_LOCAL_DB=1`, os seis arquivos de integração da M3b (`--no-file-parallelism`, saída em arquivo): passam. Commit:

```bash
git add -- "$F"
git commit -m "feat: migration da M3b, o arquivo durável (manutenção M3b)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- "$F" supabase/rascunhos/m3b.sql apps/web/test/helpers/m3b.ts
```

- [ ] **Passo 2. O LEIAME do dia** (seção "AGORA" de `LEIAME-COMANDOS.md`, só o caminho para a frente): a janela (fora de 11:30 a 13:00 UTC e dos minutos 0, 20 e 40), os dois comandos do `05` §16.5 e a regra "só segue se a única pendente for `<V>_manutencao_m3b_arquivo`":

```
npx supabase migration list --linked
```
```
npm run db:push:prod
```

- [ ] **Passo 3. O dono aplica** (Passo 2) a partir do disco: o arquivo do Passo 1 já está na árvore local, commitado e **ainda não enviado** (Yannis M14: com o push antes, o `migration list --linked` de outra trilha veria a pendente e pararia). O código das rotas ainda não existe (TRAVA M3b-2): com a migration em produção e o código antigo, o `.delete()` do botão continua valendo, porque nenhum canal tem unidade (P47).
- [ ] **Passo 4. Push do commit do Passo 1** ao `staging` (o agente; conferir o CI), só **depois** da conferência do Passo 5.
- [ ] **Passo 5. Conferência de produção, só leitura**, por arquivo de comandos que o dono roda (`bash .superpowers/sdd/manutencao-nas/m3b/m3b-10-conferencia-prod.sh`, saída em `saidas/`): as 15 tabelas com RLS; `select count(*) from public.obs_archive_policy()` = 15; `has_function_privilege('anon', 'public.obs_archive_read_unit(uuid,text,text,uuid,date,bigint,integer)', 'execute')` falso; os dois gatilhos `obs_archive_z_*` em `competitor_channels` com `tgenabled = 'O'`; `obs_archive_is_site_admin` com os argumentos `p_site uuid, p_user uuid`; `select public.obs_archive_vigia_remocao('<site>')` = `{c1:0,c2:0,c3:0,c4:0}`; `has_table_privilege('service_role', 'public.obs_archive_units', 'insert')` falso e `has_function_privilege('service_role', 'public.obs_archive_record_core(uuid,text,jsonb,text)', 'execute')` falso (K3). **O plano, simulado sem gravar** (Phil I9: `obs_archive_plan` grava `last_poll_at` e pode abrir varredura, e "0 antes de 28/11" é verdade em qualquer plano quebrado): (a) dentro de `begin; ... rollback;`, com `select set_config('obs_archive.hoje', '2026-11-28', true);`: `exportar` traz exatamente C × 2 itens da classe `serie` de `2026-10` (C = canais do site com `added_at` antes de 01/11, lido na Tarefa 0, Passo 4), mais C da `horaria` se `min(hour_slot)` for de outubro, e nenhum da `texto`; `primeira_selagem` nulo; (b) a mesma conta com `2026-11-27`: zero. NÃO VERIFICADO: se `npx supabase db query --linked` aceita o bloco com `rollback` numa chamada; senão, pela conexão direta do dono (`OBS_ARQUIVO_DB_URL`, `psql -1`), no mesmo arquivo de comandos. Tudo certo: linha "TRAVA M3b-2 solta em <data hora>" no ledger. **Volta atrás**, se algo falhar: o texto da migration de desfazer (Tarefa 14, runbook) vira migration própria do dono, por `npm run db:new`.

---

### Task 11: as sete rotas do arquivo, o catálogo do pipeline e a documentação (só depois da TRAVA M3b-2)

**Files:**
- Create: `apps/web/src/lib/pipeline/archive-auth.ts`
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco.ts`
- Create: `apps/web/src/app/api/pipeline/archive/plan/route.ts`, `unit/export/route.ts`, `month/summary/route.ts`, `month/manifest/route.ts`, `unit/received/route.ts`, `attest/route.ts`, `heartbeat/route.ts`
- Modify: `apps/web/src/lib/pipeline/api-registry.ts` (domínio `archive`, `auth` ampliado, `DOMAIN_LABELS`, `capabilities`), `apps/web/src/lib/pipeline/leitura-rotas.ts` (sete padrões)
- Create: `apps/web/data/pipeline-docs/cowork-docs-archive.md`
- Create: `apps/web/test/api/pipeline-archive.test.ts`, `apps/web/test/youtube/observatorio/arquivo-mensal-exportar-do-banco.test.ts`
- Modify: `apps/web/test/lib/pipeline/api-registry.test.ts` (9 domínios, `'archive'` no fim; `:11-24`), `apps/web/test/mcp/mcp-registry-sync.test.ts` (a conta passa a "valor do `:29` no dia" + 7, e não a um número absoluto, porque outra trilha mexe no registro; `:29`) (Yannis I1)

**Interfaces:**

```ts
// archive-auth.ts
export type PermissaoArquivo = 'archive_copy' | 'archive_b2' | 'archive_read'
export const TRABALHADOR: Record<PermissaoArquivo, 'copiador' | 'conferir_b2' | 'respondedor'> = { archive_copy: 'copiador', archive_b2: 'conferir_b2', archive_read: 'respondedor' }
/** Só `on` liga (teste que apaga a variável). */
export function arquivoLigado(env: NodeJS.ProcessEnv = process.env): boolean
/** Ordem do C0: chave → permissão exata (uma das aceitas) → OBS_ARQUIVO. */
export async function authenticateArchive(req: NextRequest, aceitas: readonly PermissaoArquivo[]):
  Promise<{ ok: true; auth: PipelineAuth; permissao: PermissaoArquivo } | NextResponse>
// exportar-do-banco.ts
// PromiseLike: o rpc do supabase-js devolve PostgrestFilterBuilder, que não é Promise (Yannis I3; com Promise o typecheck recusa)
export interface Rpc { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }> }
export class MudouDuranteALeitura extends Error {}
export class GrandeDemais extends Error {}
export async function lerFaixa(rpc: Rpc, u: { site: string; classe: Classe; tabela: string; canal: string; mes: string }, offset: number, quantas: number):
  Promise<{ colunas: string[]; linhas: Array<Array<string | null>>; contagem: number; soma: string | null }>   // a soma da faixa é nula (C3)
export function erroDoRpc(e: { code?: string; message: string }, auth: PipelineAuth): NextResponse   // 57014 → 504; código de CODIGOS → STATUS_DO_CODIGO; outro → 500 + Sentry.captureMessage
export async function lerUnidadeInteira(rpc: Rpc, u: { site: string; classe: Classe; tabela: string; canal: string; mes: string }):
  Promise<{ colunas: string[]; linhas: Array<Array<string | null>>; contagem: number; soma: string | null; hash: string; schemaFp: string }>
export function dividirEmPartes(colunas: string[], linhas: Array<Array<string | null>>, teto?: number):
  Array<{ parte: number; rowOffset: number; linhas: Array<Array<string | null>> }>      // nunca trunca; > 99 lança GrandeDemais
```

**O que acontece quando o dado não existe:** `OBS_ARQUIVO` ausente: `503 arquivo_desligado` em toda rota (item 24), nunca lista vazia; RPC que devolve `data` fora do esquema Zod da resposta (função velha, campo a mais, campo faltando): `500 erro_do_banco` com a causa no Sentry, nunca a resposta parcial; unidade com zero linha: JSON `vazia: true` (C3), nunca arquivo só com cabeçalho; unidade acima de `TETO_LINHAS_DA_UNIDADE`: `413 grande_demais` antes de ler qualquer página (D25).

- [ ] **Passo 1. Conferir os arquivos compartilhados.** `git diff --stat --` de **todos os Modify desta tarefa** (`api-registry.ts`, `leitura-rotas.ts`, `api-registry.test.ts`, `mcp-registry-sync.test.ts`) vazio; se não, a regra do Global Constraints (registrar dono provável e data; na manhã seguinte o controlador pergunta). Hoje `api-registry.ts` tem 4 linhas alheias, ligadas ao teste não rastreado `youtube-cowork-docs-observatorio.test.ts`.
- [ ] **Passo 2. Testes, falhando.** `pipeline-archive.test.ts` (cliente de serviço falso com `rpc` programável; `authenticatePipeline` real com a tabela de chaves falsa do projeto, `test/helpers/fake-supabase.ts`):

| Teste | Afirma |
|---|---|
| `sessão do CMS é recusada` | `403`, `API key required` |
| `chave admin ou write não abre` (D10) | `403` nas sete |
| `cada rota aceita só a sua permissão` (133) | `archive_b2` em `plan` sem `fonte=b2`, em `unit/export`, `unit/received`, `month/*` e em `attest` com `fonte: 'nas'`: `403`; `archive_copy` em `plan?fonte=b2` e em `attest` com `fonte: 'b2'`: `403` |
| `OBS_ARQUIVO apagada: arquivo_desligado em toda rota` (24) | `delete process.env.OBS_ARQUIVO` → `503` com `code: 'arquivo_desligado'` nas sete; `ON`, `1`, `true` também `503` |
| `a resposta nunca traz o valor esperado` (132) | o `rpc` falso devolve um plano com um campo `sha256` a mais num item: a rota responde `500 erro_do_banco` (o esquema da resposta é `.strict()`), e nenhuma resposta de `plan`, `attest`, `unit/received` contém as chaves `hash_conteudo`, `row_count`, `control_sum`, `sha256_esperado` |
| `heartbeat: o trabalhador vem da permissão` | corpo com `worker: 'respondedor'` e chave `archive_copy` → `400 VALIDATION_ERROR` (`.strict()`); sem o campo, `rpc` chamado com `p_worker: 'copiador'` |
| `57014 vira tempo_esgotado` | `504` |
| `attest prefixo_ausente na M3b` | `400 VALIDATION_ERROR` |
| `par fora da política: 422, nunca 400` (Yannis I7) | `unit/export` com (`serie`, `competitor_raw`): `422 classe_tabela_invalida` |
| `erro escondido vai ao Sentry` (Yannis I12) | `rpc` falso lança `new Error('x')`: `500 erro_do_banco` e `Sentry.captureException` chamado uma vez; código fora de `CODIGOS`: `Sentry.captureMessage` uma vez |
| `dado da RPC lido por esquema` (Yannis M10) | `obs_archive_unit_part_info` falso com um campo a menos: `500 erro_do_banco`, nunca `as` |
| `parte: linhas da parte e soma vazia` (Pedido 13) | unidade em 2 partes com coluna de controle: `X-Arquivo-Linhas` é o da parte, `X-Arquivo-Soma` vazio nas duas |
| `códigos novos` | `mes_fora_do_banco` 409, `ja_no_arquivo` 409, `resumo_da_m10b` 409, `faixa_invalida` 422, `tabela_ausente` 409 (X3) |
| `plan com 1.000 itens em reconferir cabe na resposta` (Yannis I5) | `JSON.stringify(resposta).length < 4_000_000` |
| `attest nas devolve canarios` (Phil I4) | a resposta passa por `RespostaAtestarNas` com `canarios` |
| `heartbeat sem total_bytes: 400` (Pedido 5) | |

`arquivo-mensal-exportar-do-banco.test.ts`:

| Teste | Afirma |
|---|---|
| `2.500 linhas em chamadas de 1.000 são lidas inteiras` (75) | três chamadas, `offset` 0, 1000, 2000; linhas concatenadas |
| `uma linha inserida entre duas chamadas: recomeça; depois de 3, mudou_durante_a_leitura` (75) | `rpc` falso que muda o `hash_conteudo` na segunda chamada: 3 tentativas e `MudouDuranteALeitura` |
| `parte maior que 3 MB divide, nunca trunca` (25) | linhas sintéticas de 8 MB: partes de até 3 MB, soma das linhas = total, cada parte com cabeçalho; 100 partes lança `GrandeDemais` |
| `soma da fonte é a do banco` | `exportarUnidade` recebe `soma` de `read_unit` (texto, M1 do Phil) |
| `unidade acima de TETO_LINHAS_DA_UNIDADE: GrandeDemais sem chamar read_unit` (Yannis I9, D25) | o `rpc` falso conta as chamadas: só `obs_archive_content_hash` |

Run → FAIL.

- [ ] **Passo 3. `archive-auth.ts`:**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticatePipeline, type PipelineAuth } from './auth'
import { pipelineError } from './helpers'

export type PermissaoArquivo = 'archive_copy' | 'archive_b2' | 'archive_read'
export const TRABALHADOR = { archive_copy: 'copiador', archive_b2: 'conferir_b2', archive_read: 'respondedor' } as const satisfies Record<PermissaoArquivo, string>

export function arquivoLigado(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OBS_ARQUIVO === 'on'
}

export async function authenticateArchive(req: NextRequest, aceitas: readonly PermissaoArquivo[]):
  Promise<{ ok: true; auth: PipelineAuth; permissao: PermissaoArquivo } | NextResponse> {
  const r = await authenticatePipeline(req)
  if (!r.ok) return pipelineError(r.status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED', r.error, r.status)
  if (r.auth.source !== 'api_key') return pipelineError('FORBIDDEN', 'API key required', 403, r.auth)
  const permissao = aceitas.find(p => r.auth.permissions.includes(p))
  if (!permissao) return pipelineError('FORBIDDEN', 'Insufficient permissions', 403, r.auth)
  if (!arquivoLigado()) return pipelineError('arquivo_desligado', 'arquivo desligado', 503, r.auth)
  return { ok: true, auth: r.auth, permissao }
}
```

- [ ] **Passo 4. As rotas.** Todas: `export const dynamic = 'force-dynamic'`; `export const maxDuration = 60` em `unit/export` e `month/summary`; corpo por `parseBody(req, Corpo...)` (`helpers.ts:117-130`); `rpc` pelo `getSupabaseServiceClient()`; erro do `rpc` com `code === '57014'` → `504 tempo_esgotado`, código `P0001` com mensagem de `CODIGOS` → o status de `STATUS_DO_CODIGO` (Tarefa 1), outro → `500 erro_do_banco` com `Sentry.captureMessage(\`archive rpc: ${e.code ?? '?'} ${e.message}\`, 'error')`; todo `catch` final manda `Sentry.captureException(e, { tags: { rota: 'pipeline/archive/<rota>' } })` antes do 500 (Yannis I12); dado da RPC lido com `.safeParse` do esquema da Tarefa 1 (nunca `as`; Yannis M10); `data` validado contra o esquema `.strict()` da resposta antes de sair. A de exportar, por inteiro:

```ts
// apps/web/src/app/api/pipeline/archive/unit/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateArchive } from '@/lib/pipeline/archive-auth'
import { parseBody, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import * as Sentry from '@sentry/nextjs'
import { CorpoExportar, COLUNA_DE_CONTROLE, parDaPolitica, RespostaParteInfo, RespostaRecord, TETO_LINHAS_DA_UNIDADE } from '@/lib/youtube/observatorio/arquivo-mensal/contrato'
import { caminhoDaUnidade, caminhoDaParte, idDaParte } from '@/lib/youtube/observatorio/arquivo-mensal/caminho'
import { lerUnidadeInteira, lerFaixa, dividirEmPartes, MudouDuranteALeitura, GrandeDemais, erroDoRpc } from '@/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco'
import { exportarUnidade } from '@/lib/youtube/observatorio/arquivo/exportar'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const a = await authenticateArchive(req, ['archive_copy'])
  if (a instanceof Response) return a
  const corpo = await parseBody(req, CorpoExportar, a.auth)
  if (corpo instanceof Response) return corpo
  // C0, ordem 5: o par fora da política é 422, nunca o 400 do Zod (Yannis I7)
  if (!parDaPolitica(corpo)) return pipelineError('classe_tabela_invalida', 'classe e tabela fora da política', 422, a.auth)
  const sb = getSupabaseServiceClient()
  const u = { site: a.auth.siteId, classe: corpo.classe, tabela: corpo.tabela, canal: corpo.canal, mes: corpo.mes }
  const mesData = `${corpo.mes}-01`
  try {
    if (corpo.parte !== undefined) {
      const info = await sb.rpc('obs_archive_unit_part_info', { p_site: u.site, p_class: u.classe, p_table: u.tabela, p_channel: u.canal, p_month: mesData, p_part: corpo.parte })
      if (info.error) return erroDoRpc(info.error, a.auth)
      const st = RespostaRecord.safeParse(info.data)
      if (st.success && st.data.status !== 'ok') return pipelineError(st.data.status, st.data.status, 409, a.auth)   // nao_devida, canal_removido, mes_fora_do_banco
      const lidoInfo = RespostaParteInfo.safeParse(info.data)
      if (!lidoInfo.success) { Sentry.captureMessage('archive part_info fora do esquema', 'error'); return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth) }
      const p = lidoInfo.data
      const faixa = await lerFaixa(sb, u, p.de, p.ate - p.de)
      const s = await exportarUnidade({ ler: async () => faixa }, null, { tabela: u.tabela, canal: u.canal, de: mesData, ate: mesData, rotulo: caminhoDaParte({ ...u, versao: p.versao, parte: corpo.parte }) })
      if (s.sha256 !== p.sha256) {
        await sb.rpc('obs_archive_mark_redo', { p_unit: p.unidade_id, p_reason: 'parte_mudou' })
        return pipelineError('parte_mudou', 'parte mudou', 409, a.auth)
      }
      // X-Arquivo-Linhas é o da parte; X-Arquivo-Soma vazio em toda parte (C3, Pedido 13)
      return bytes(s, { id: idDaParte(p.unidade_id, corpo.parte), versao: p.versao, partes: p.partes, parte: corpo.parte, coluna: COLUNA_DE_CONTROLE[u.tabela] ?? null }, a.auth)
    }
    // D25: a contagem antes de qualquer página; acima do teto, 413 sem ler (Yannis I9)
    const h = await sb.rpc('obs_archive_content_hash', { p_site: u.site, p_class: u.classe, p_table: u.tabela, p_channel: u.canal, p_month: mesData })
    if (h.error) return erroDoRpc(h.error, a.auth)
    const contagem = Array.isArray(h.data) && typeof h.data[0]?.row_count === 'number' ? h.data[0].row_count as number : null
    if (contagem === null) { Sentry.captureMessage('archive content_hash fora do esquema', 'error'); return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth) }
    if (contagem > TETO_LINHAS_DA_UNIDADE) return pipelineError('grande_demais', 'grande demais', 413, a.auth)
    const lido = await lerUnidadeInteira(sb, u)
    const base = { classe: u.classe, tabela: u.tabela, canal: u.canal, mes: mesData, hash_conteudo: lido.hash, schema_fp: lido.schemaFp, row_count: lido.contagem, control_sum: lido.soma }
    if (lido.contagem === 0) {
      const r = await sb.rpc('obs_archive_record', { p_site: u.site, p_kind: 'unidade', p_payload: base })
      if (r.error) return erroDoRpc(r.error, a.auth)
      const gl = RespostaRecord.safeParse(r.data)
      if (!gl.success) { Sentry.captureMessage('archive record fora do esquema', 'error'); return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth) }
      const g = gl.data
      if (g.status !== 'nova' && g.status !== 'mesma') return pipelineError(g.status, g.status, 409, a.auth)
      return pipelineSuccess({ arquivo_id: g.arquivo_id, versao: g.versao, vazia: true, linhas: 0 }, 200, a.auth)
    }
    const partes = dividirEmPartes(lido.colunas, lido.linhas)
    const series = await Promise.all(partes.map(p => exportarUnidade({ ler: async () => ({ colunas: lido.colunas, linhas: p.linhas, contagem: p.linhas.length, soma: null }) }, null,
      { tabela: u.tabela, canal: u.canal, de: mesData, ate: mesData, rotulo: '' })))
    const inteira = partes.length === 1 ? series[0]! : null
    const r = await sb.rpc('obs_archive_record', { p_site: u.site, p_kind: 'unidade', p_payload: {
      ...base, sha256_bytes: inteira?.sha256 ?? series[0]!.sha256, csv_sha256: inteira?.csvSha256 ?? null, file_bytes: series.reduce((t, s) => t + s.bytes, 0),
      partes: partes.length, min_key: series[0]!.menorChave, max_key: series[series.length - 1]!.maiorChave,
      parts: partes.length === 1 ? [] : partes.map((p, i) => ({ parte: p.parte, sha256_bytes: series[i]!.sha256, csv_sha256: series[i]!.csvSha256, file_bytes: series[i]!.bytes,
        row_count: p.linhas.length, control_sum: null, row_offset: p.rowOffset, min_key: series[i]!.menorChave, max_key: series[i]!.maiorChave })),
    } })
    if (r.error) return erroDoRpc(r.error, a.auth)
    const gl = RespostaRecord.safeParse(r.data)
    if (!gl.success) { Sentry.captureMessage('archive record fora do esquema', 'error'); return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth) }
    const g = gl.data
    if (g.status !== 'nova' && g.status !== 'mesma') return pipelineError(g.status, g.status, 409, a.auth)
    const id = g.arquivo_id!.slice(2)
    const primeira = series[0]!
    const caminho = partes.length === 1 ? caminhoDaUnidade({ ...u, versao: g.versao! }) : caminhoDaParte({ ...u, versao: g.versao!, parte: 1 })
    return bytes({ ...primeira, caminho }, { id: partes.length === 1 ? g.arquivo_id! : idDaParte(id, 1), versao: g.versao!, partes: partes.length, parte: 1, coluna: COLUNA_DE_CONTROLE[u.tabela] ?? null }, a.auth,
      partes.length === 1 ? lido.soma : null)
  } catch (e) {
    if (e instanceof MudouDuranteALeitura) return pipelineError('mudou_durante_a_leitura', 'mudou durante a leitura', 409, a.auth)
    if (e instanceof GrandeDemais) return pipelineError('grande_demais', 'grande demais', 413, a.auth)
    Sentry.captureException(e, { tags: { rota: 'pipeline/archive/unit/export' } })   // Yannis I12: nunca 500 sem causa
    return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth)
  }
}

function bytes(s: { gz: Uint8Array; caminho: string; linhas: number; sha256: string; csvSha256: string; bytes: number }, h: { id: string; versao: number; partes: number; parte: number; coluna: string | null },
  auth: Parameters<typeof buildRateLimitHeaders>[0], soma: string | null = null): NextResponse {
  return new NextResponse(Buffer.from(s.gz), { status: 200, headers: {
    ...(buildRateLimitHeaders(auth) ?? {}), 'Content-Type': 'application/gzip',
    'X-Arquivo-Id': h.id, 'X-Arquivo-Versao': String(h.versao), 'X-Arquivo-Caminho': s.caminho, 'X-Arquivo-Linhas': String(s.linhas),
    'X-Arquivo-Soma': soma ?? '', 'X-Arquivo-Sha256': s.sha256, 'X-Arquivo-Csv-Sha256': s.csvSha256, 'X-Arquivo-Bytes': String(s.bytes),
    'X-Arquivo-Partes': String(h.partes), 'X-Arquivo-Parte': String(h.parte), 'X-Arquivo-Coluna-Controle': h.coluna ?? '',
  } })
}
```

(`RespostaParteInfo` na Tarefa 1 tem `status: 'ok'`, `unidade_id`, `versao`, `partes`, `de`, `ate`, `sha256`, `recebida`: `obs_archive_unit_part_info` (Tarefa 5) devolve exatamente isso; recusa com `{status: 'nao_devida' | 'canal_removido' | 'mes_fora_do_banco'}`. O `sha256` só serve para a rota comparar no servidor; nunca sai na resposta.)

**Soma das partes:** a soma por parte não é recalculada em TypeScript (a fonte devolve a soma da unidade inteira); a parte vai com `X-Arquivo-Soma` vazio e `control_sum` nulo no registro da parte, e a conferência da unidade em partes é pela **contagem** de cada parte e pela soma da unidade inteira, que o copiador confere somando as partes depois de receber todas (o C6 manda a soma relida por parte; o site compara a soma das partes recebidas com `control_sum` da unidade quando a última chega). É a regra "Unidade em partes" do C3, e a da parte em `obs_archive_receive` (Tarefa 5).

`plan`: `GET`, `fonte=b2` escolhe `['archive_b2']` e `obs_archive_b2_plan`, senão `['archive_copy']` e `obs_archive_plan`; `completo` e `cursor` da `searchParams` (cursor até 200 caracteres; aceito em qualquer modo, C1). `month/summary`: `obs_archive_channel_units` → `obs_archive_unit_rehash` um por um (qualquer `igual: false` → `409 conteudo_mudou`) → `obs_archive_summary_rows` → `serializarResumo` (Tarefa 5) → `obs_archive_record` (`'resumo'`) → JSON com `conteudo_base64`. `month/manifest`: `obs_archive_manifest_rows` → `montarManifesto` → `obs_archive_record_manifest` → JSON. `unit/received` → `obs_archive_receive`. `attest`: autentica com `['archive_copy', 'archive_b2']`, lê o corpo, e `fonte: 'nas'` exige `archive_copy` e `fonte: 'b2'` exige `archive_b2` (senão `403`) → `obs_archive_attest_nas` ou `obs_archive_attest_b2`. `heartbeat`: `['archive_copy', 'archive_b2', 'archive_read']` → `obs_archive_heartbeat_write(p_worker: TRABALHADOR[permissao])` → `RespostaBatimento` (r2.2: `{gravado, teto}`). `plan?fonte=b2` valida com `RespostaPlanoB2`, que exige `retomado_de` e `cobertura` coerentes com o `modo` (r2.2).

- [ ] **Passo 5. Catálogo e documentação (Pipeline Integrity, CLAUDE.md).** Em `api-registry.ts`: `DomainId` ganha `'archive'`; `ApiEndpointMeta.auth` ganha `'archive_copy' | 'archive_b2' | 'archive_read'`; a constante:

```ts
const ARCHIVE: CapabilityDomain = {
  domain: 'archive',
  name: 'Observatory monthly archive (NAS/B2 workers)',
  description: 'Machine-to-machine routes used only by the home workers (copier, B2 checker) to copy sealed months of the Observatory to the NAS and attest the copies. Not for Cowork.',
  suggest_when: 'Never for Cowork tasks: these routes accept only archive_* keys held by the home workers',
  docs: '/api/pipeline/docs/archive',
  endpoint_count: 7,
  endpoints: [
    { method: 'GET', path: '/api/pipeline/archive/plan', summary: 'What is due, to re-check and red flags (copier); ?fonte=b2: what to check in B2 (B2 checker) — archive_copy | archive_b2', auth: 'archive_copy' },
    { method: 'POST', path: '/api/pipeline/archive/unit/export', summary: 'Serialize one monthly unit (gzip CSV bytes, values in headers) — archive_copy', auth: 'archive_copy' },
    { method: 'POST', path: '/api/pipeline/archive/month/summary', summary: 'Per-channel monthly summary files — archive_copy', auth: 'archive_copy' },
    { method: 'POST', path: '/api/pipeline/archive/month/manifest', summary: 'Monthly manifest (.json and .sha256) — archive_copy', auth: 'archive_copy' },
    { method: 'POST', path: '/api/pipeline/archive/unit/received', summary: 'Report files re-read from the NAS — archive_copy', auth: 'archive_copy' },
    { method: 'POST', path: '/api/pipeline/archive/attest', summary: 'Re-check report: fonte nas (archive_copy) or fonte b2 (archive_b2); never returns expected values', auth: 'archive_copy' },
    { method: 'POST', path: '/api/pipeline/archive/heartbeat', summary: 'Worker heartbeat (worker derived from the key permission) — archive_copy | archive_b2 | archive_read', auth: 'archive_copy' },
  ],
}
```

e entra em `capabilities` e em `DOMAIN_LABELS` (`archive: 'Arquivo mensal'`). **Os testes com contagem fixa vão no mesmo commit** (Yannis I1; sem eles a CI do `staging` compartilhado fica vermelha): `api-registry.test.ts` passa a 9 domínios, com `'archive'` no fim; em `mcp-registry-sync.test.ts`, a conta passa a (valor do `:29` no dia) + 7 (trocar a soma por domínio do comentário; o caso `as rotas do arquivo nunca viram ferramenta MCP` é o que prova a propriedade), o `expect(unmapped.length).toBeLessThan(10)` passa a `expect(unmapped.filter(u => !u.includes('/api/pipeline/archive/')).length).toBeLessThan(10)` (as 7 rotas não consomem a folga de quem vier depois), e o caso novo `it('as rotas do arquivo nunca viram ferramenta MCP', () => { const { mapped, unmapped } = getRegistryCoverage(); expect(mapped.filter(m => m.domain === 'archive')).toEqual([]); expect(unmapped.filter(u => u.includes('/archive/'))).toHaveLength(7) })` prova que o Cowork não ganha ferramenta que exporte texto de terceiros. `cowork-docs-archive.md` começa com `# ` e tem **≥ 100 linhas** (`api-registry.test.ts:198-212`). Em `leitura-rotas.ts`, os sete padrões em ordem alfabética. `cowork-docs-archive.md`: uma seção por rota, com os códigos e estados do contrato (C1 a C8), entre eles `canal_removido` (de `unit/export` e `unit/received`), o resultado `ausente` (de `attest`), "aguardando arquivo do dono" e a unidade perdida (`lost_reason`: `ausente_nas_e_b2` ou `nunca_recebida`) no plano, `ainda_nao_conferido` (do comando `declarar-perdida`, M8/M9, citado para quem lê o plano), `prefixo_ausente`/`prefixo_presente` como "M9", `destino_do_arquivo_nao_declarado` e `ja_pedido` (`02` §10.6). **Não** alterar `docs/cowork-pipeline-reference.md` (nenhuma seção de JSON schema do Cowork muda) e não reenviar as referências do Cowork (as rotas não são do Cowork).

- [ ] **Passo 6.** Run os dois testes novos e as suítes do pipeline e do MCP (`npx vitest run apps/web/test/api apps/web/test/lib/pipeline apps/web/test/mcp`, saída em arquivo) → PASS. `npx tsc --noEmit -p apps/web`. Um `next build` local (rota nova com `maxDuration`): opcional pela regra do projeto; recomendado aqui.
- [ ] **Passo 7. Commit** (`git add --` dos arquivos novos antes):

```bash
git add -- apps/web/src/lib/pipeline/archive-auth.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco.ts apps/web/src/app/api/pipeline/archive apps/web/data/pipeline-docs/cowork-docs-archive.md apps/web/test/api/pipeline-archive.test.ts apps/web/test/youtube/observatorio/arquivo-mensal-exportar-do-banco.test.ts
git commit -m "feat: rotas do arquivo mensal em /api/pipeline/archive, domínio archive no catálogo e documentação (manutenção M3b, itens 24, 25, 75 e 133)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/pipeline/archive-auth.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco.ts apps/web/src/app/api/pipeline/archive apps/web/src/lib/pipeline/api-registry.ts apps/web/src/lib/pipeline/leitura-rotas.ts apps/web/data/pipeline-docs/cowork-docs-archive.md apps/web/test/api/pipeline-archive.test.ts apps/web/test/youtube/observatorio/arquivo-mensal-exportar-do-banco.test.ts apps/web/test/lib/pipeline/api-registry.test.ts apps/web/test/mcp/mcp-registry-sync.test.ts
```

---

### Task 12: o botão "Remover canal" pela função, e a frase do diálogo (antes de 28/11)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts` (`removeCompetitorChannel`, `:152-168`, e a ação do impacto)
- Modify: `apps/web/src/lib/youtube/competitor-removal-impact.ts` (o impacto do arquivo, por `obs_archive_channel_archive_impact`)
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/frases-remocao.ts`
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/remove-dialog.tsx` e `_canal/canal-screen.tsx` (o toast de depois do clique)
- Create: `apps/web/test/youtube/observatorio/arquivo-mensal-frases-remocao.test.ts`; Modify: `apps/web/test/youtube/observatorio/canais-add-action.test.ts` (o `describe('removeCompetitorChannel')`, `:196-205`)

**Interfaces:**
- Consumes: `requireSiteAdminScope` (`apps/web/lib/cms/auth-guards.ts:29`), `competitor_channel_remove`, `obs_archive_channel_archive_impact` (Tarefa 8), `lerCapacidades` (Tarefa 9).
- Produces: `frasesDoDialogo(impacto: ImpactoArquivo | 'lendo' | 'falhou', cap: Capacidades, o: { nomeDoCanal: string; hoje: string }): { corpo: string[]; confirmar: string | null; exigeDigitar: boolean; ocupado: boolean; tentarDeNovo: boolean }` e `fraseDepoisDoClique(impacto, cap, hoje): string`, puras.

**O que acontece quando o dado não existe:** a leitura do impacto falhou: "Não foi possível ler o arquivo deste canal. Nada foi removido." com "Tentar de novo", **sem** botão de confirmar; nunca "0 meses" nem "nada a limpar". Lendo: "contando…", `aria-busy`, confirmar desabilitado. Canal sem arquivo e sem imagem: frase (i). Canal sem arquivo com N imagens: frase (ii), "1 imagem" no singular.

- [ ] **Passo 1. A troca do `.delete()` (não espera a TRAVA M3b-3).** Teste da ação, falhando: com o `rpc` falso, `removeCompetitorChannel('c1')` chama `competitor_channel_remove` com `{ p_site, p_channel: 'c1', p_decision: 'apagar', p_via: 'botao', p_actor: <id da sessão> }` e **nunca** `.from('competitor_channels').delete()`; sem administrador: `ok: false` com `siteAdminOnlyMessage` e nenhum `rpc`; `rpc` com `canal_nao_encontrado`: `ok: false`; `mes_destacado_em_transito` (M6): `ok: false` com a frase do `04` §14.3 (a da M6; até lá, "Nada foi removido."). Implementação:

```ts
export async function removeCompetitorChannel(id: string): Promise<{ ok: boolean; error?: string }> {
  const { siteId: siteDaSessao } = await getSiteContext()
  const admin = await requireSiteAdminScope(siteDaSessao)        // o guarda no TOPO, antes do cliente de serviço; p_actor vem daqui, nunca do formulário
  if (!admin.ok) return { ok: false, error: siteAdminOnlyMessage('remover um canal concorrente do Observatório') }
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.rpc('competitor_channel_remove', { p_site: siteId, p_channel: id, p_decision: 'apagar', p_via: 'botao', p_actor: admin.user.id })
  if (error) return { ok: false, error: fraseDaRecusaDaRemocao(error.message) }
  invalidateObservatory(siteId)
  revalidatePath('/cms/youtube/competitors', 'layout')
  return { ok: true }
}
```

(`fraseDaRecusaDaRemocao` mora em `frases-remocao.ts`: `sem_direito` → `siteAdminOnlyMessage(...)`; `canal_nao_encontrado` → `undefined`; `mes_destacado_em_transito` → "Nada foi removido." até a M6 trocar pela frase dela; outro → "Não deu para remover o canal. Nada foi removido.". O código do banco nunca chega à tela.) No mesmo commit, o mock de `canais-add-action.test.ts:6-9` ganha `siteAdminOnlyMessage: (a: string) => \`Só quem administra o site pode ${a}.\`` (o código novo o chama na recusa) e o caso `nunca chama from('competitor_channels').delete()` (Yannis M3). Run → PASS. Commit só a ação e o teste dela:

```bash
T=apps/web/test/youtube/observatorio/canais-add-action.test.ts   # o describe('removeCompetitorChannel') existente (:196-205): os casos 'other-site-row' e 'c1' passam a programar o rpc, no mesmo commit
git add -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/frases-remocao.ts
git commit -m "feat: remover canal declara o destino do arquivo pela função competitor_channel_remove (manutenção M3b, fatia 12a)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- "apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts" apps/web/src/lib/youtube/observatorio/arquivo-mensal/frases-remocao.ts "$T"
```

(`frases-remocao.ts` é arquivo novo: o `git add --` acima vem antes do commit.)

- [ ] **Passo 2.** Promover este commit junto com as Tarefas 11 e 13 (Tarefa 14). Depois dele, um `delete` de canal **com unidade** por qualquer outro caminho recusa; antes de 28/11 nenhum canal tem unidade, e o botão de hoje não muda de comportamento visível.
- [ ] **Passo 3. TRAVA M3b-3.** Conferir no ledger da M4 a aprovação do mockup `18-v2` pelo dono. Sem ela, parar aqui e avisar o controlador com a data de 28/11 (o diálogo de hoje não mente enquanto nenhum canal tiver unidade: `05` §15.1).
- [ ] **Passo 4. As frases, puras, falhando** (`arquivo-mensal-frases-remocao.test.ts`, item 163, parte da M3b), uma linha da tabela do `04` §14.3 por caso, com `lerCapacidades` sobre `env` falso: com `OBS_ARQUIVO_LIMPEZA_CANAL` apagada, a forma "Não | Não" ("Os arquivos só somem do NAS e do B2 depois de um comando seu, no Mac. Esse comando ainda não existe e ainda não tem data para chegar. Até lá o arquivo continua no NAS e no B2. A página do Arquivo vai mostrar cada passo e o dia em que acabou."); com `OBS_ARQUIVO_LIMPEZA_CANAL_DATA=05/03`, "chega em 05/03"; com o relógio falso depois da data e a variável ainda apagada, a forma não muda; com arquivo: "Este canal tem N meses no arquivo, de mm/aaaa a mm/aaaa (N registros), no NAS e no B2." e confirmar "Remover e apagar do arquivo"; sem arquivo: confirmar "Remover canal"; com `fora_do_banco.meses > 0` ou `videos_retirados.n > 0`: o parágrafo do caso (só meses, só vídeos, os dois) e `exigeDigitar: true`; só nesses casos; sem arquivo e sem imagem: (i); com 1 e com 3 imagens: (ii) no singular e no plural, mais a frase da linha "Não | Não" da segunda tabela; depois do clique, com arquivo e sem, nas mesmas três linhas; "apagado" nunca aparece. As frases são copiadas do `04` §14.3 sem edição (o teste as compara com o texto do spec por literal).
- [ ] **Passo 5. O diálogo.** `getCompetitorRemovalImpactAction` passa a devolver também `arquivo: ImpactoArquivo | null` (leitura falhada: `null` e a flag `arquivoFalhou`) e as `Capacidades` (lidas no servidor, passadas por propriedade: o módulo é `server-only`); `remove-dialog.tsx` renderiza `frasesDoDialogo`: cancelar recebe o foco inicial, Esc cancela e devolve o foco ao botão que abriu, "contando…" com `aria-busy`, a frase digitada (o nome do canal) só quando `exigeDigitar`. O toast de `canal-screen.tsx:500` passa a `fraseDepoisDoClique`.
- [ ] **Passo 6. Revisão de tela.** Logan (UX) e Naksu (UI) revisam a tela contra o `18-v2`; Gio (QA) valida no navegador, autenticado, os três estados (com arquivo, sem arquivo com imagens, leitura falhada) num banco local com unidades semeadas, e devolve o veredito em texto com as capturas em arquivo (memória `feedback_time_de_especialistas_com_nome.md`).
- [ ] **Passo 7. Commit** do diálogo, do impacto e do teste das frases, por caminho.

---

### Task 13: o vigia lê o atraso de cópia e as quatro consultas da remoção (só depois da TRAVA M3b-2)

**Files:**
- Create: `apps/web/src/lib/youtube/agenda/arquivo-mensal.ts`
- Modify: `apps/web/src/lib/youtube/agenda/saude.ts`, `apps/web/src/lib/ops/cron-health-report.ts` (no molde do item `agenda:particoes_meses_a_frente` da M2, Tarefa 7)
- Create: `apps/web/test/youtube/agenda/arquivo-mensal.test.ts`

**Interfaces:**
- Produces: `lerArquivoParaVigia(sb): Promise<Lido<{ atraso: { amarelos: number; vermelhos: number; meses_sem_selo: number }; vigia: { c1: number; c2: number; c3: number; c4: number } }>>` e `avaliarArquivo(l): { gravidade: 'verde' | 'amarelo' | 'vermelho'; motivo: string }`; os itens `agenda:arquivo_atraso_copia` e `agenda:arquivo_vigia_remocao` no relatório.

**O que acontece quando o dado não existe:** função ausente (`42883`) ou erro: `vermelho` com "sem leitura", nunca verde (itens 28 e 160). Leitura certa com tudo zero: verde. A rotina é de leitura, a cada disparo do vigia; não desliga com `OBS_AGENDA=off` (`02` §10.6, tabela de rotinas).

- [ ] **Passo 1. Teste, falhando:** zero em tudo → verde; `atraso.amarelos = 1` → amarelo; `atraso.vermelhos = 1` → vermelho; `atraso.meses_sem_selo = 1` → amarelo (Phil I6); qualquer `c1..c4` ≠ 0 → vermelho com o número da consulta no motivo; `rpc` com `code: '42883'` → vermelho "sem leitura"; `rpc` que lança → vermelho. **Passo 2.** Implementar no molde de `particoes.ts` da M2 (leitura leve por `rpc`, `Lido<T>` de `agenda/tipos.ts`). **Passo 3.** Run → PASS. **Passo 4.** Commit por caminho (arquivo novo com `git add --`).

---

### Task 14: runbook, `OBS_ARQUIVO=on`, promoção e o que fica registrado

**Files:**
- Create: `docs/ops/runbook-arquivo-mensal.md`
- Disco: ledger, `LEIAME-COMANDOS.md`, `.superpowers/sdd/manutencao-nas/m3b/m3b-14-consultas-prod.sh`

- [ ] **Passo 1. Runbook** (`docs/ops/runbook-arquivo-mensal.md`, commit por caminho): (a) a consulta do item 80 (a cadeia de cada mês de cada tabela: selado, verificado no NAS, conferido no B2 com a origem, ensaiado, destacado, descartado, com as datas; e, por canal, vídeos ativos, fora da coleta, no arquivo e sem data, com a contagem de órfãs: as colunas da M10a); (b) as consultas 5 e 6 do item 160 (a 5 lê `obs_archive_results` e, enquanto a M7 não existir, a consulta diz "a fila do relatório ainda não existe" por `to_regclass`); (c) a consulta irmã de P39 (miniatura de vídeo retirado ainda no Blob depois de remoção concluída; zero até a M9); (d) a volta atrás do gatilho `before delete` se ele recusar em falso (P47): migration própria do dono, por `npm run db:new manutencao_m3b_desfaz_gatilho`, com `drop trigger if exists obs_archive_z_destino_declarado on public.competitor_channels; drop trigger if exists obs_archive_z_truncate on public.competitor_channels;`, e a nota de que, depois dela, o botão continua declarando (a função não depende do gatilho); (e) a volta atrás da M3b inteira **antes de 28/11** (nenhuma unidade existe): migration que faz `drop function` das funções desta fase e `drop table` das 15 tabelas, só com `select count(*) from public.obs_archive_units` igual a zero lido no mesmo dia; **antes da migration de desfazer, reverter e publicar os commits das Tarefas 13, 12, 11 e 9a, nessa ordem** (código antes do banco, o inverso da subida; sem isso o botão chama `competitor_channel_remove` ausente e responde "Não deu para remover": Yannis M7); depois de 28/11 não há volta atrás por migration, só conserto para a frente. (f) `docs/ops/env-vars.md` ganha `OBS_ARQUIVO`, `OBS_ARQUIVO_LIMPEZA_CANAL` e `OBS_ARQUIVO_LIMPEZA_CANAL_DATA`, com o padrão e o efeito de cada uma (regra do CLAUDE.md; Yannis M5), no mesmo commit. As consultas do dono vão em `m3b-14-consultas-prod.sh` (arquivo de comandos, saída em `saidas/`).
- [ ] **Passo 2. Promoção.** Com a TRAVA M3b-2 solta e as Tarefas 11, 12 (passos 1 e 2) e 13 no `staging`, CI verde: promover `staging` → `main` (o agente: memória `feedback_push_e_promocao_do_agente.md`), conferindo o CI. A ordem do deploy é a do P47: migration (Tarefa 10) antes do código.
- [ ] **Passo 3. `OBS_ARQUIVO=on`** (dono, clique na Vercel, e um novo deploy para valer), **antes** de instalar o copiador (`05` §16.5). Conferência do site, sem chave: `curl -s -o /dev/null -w '%{http_code}\n' https://bythiagofigueiredo.com/api/pipeline/archive/plan` → `401` (a rota existe e pede chave). A conferência com chave é a execução `--prova` do copiador (M3b-forja), que tem de mostrar `200` com `primeira_selagem: null` e `exportar: []` antes de 28/11; com a variável ainda desligada, ela mostra `arquivo_desligado` e o copiador fica vermelho no pulso.
- [ ] **Passo 4. Ledger** (`m3b-site-progresso.md`): a hora da promoção, a do `OBS_ARQUIVO=on`, a saída da conferência, e o que ficou NÃO VERIFICADO (seção abaixo). **Conferências com data** (Phil I9), cada uma por arquivo de comandos do dono, saída em `saidas/`, e qualquer diferença vira vermelho no ledger e aviso ao controlador no mesmo dia:
  - **28/11, depois das 16:00 de São Paulo** (as duas execuções do dia): por tabela da `serie` de `2026-10`, `sealed_at` não nulo; `units_total` = C em cada tabela; `sealed_kind` `com_dado` na diária e `vazio_conferido` na early se ela seguir vazia; `days_measured = 29`, `days_in_month = 31` na diária; `nas_attested_at` não nulo; número de `channel_ref` distintos no manifesto selado = C. É também a consulta do item 32; a do item 80 vai junto.
  - **29/11, depois das 12:00:** `b2_forja_ok_at` não nulo nas duas linhas; nulo → ler `conferir-b2.jsonl` (canário, controle, sincronização do NAS para o B2).
  - **03/12:** `obs_archive_atraso` com `amarelos = 0` e `meses_sem_selo = 0`; diferente → o mês de outubro está preso.
  - **Primeira volta de casa desligada (mudança) ou ensaio de casa fora** (Phil C2 da forja): `select motivo, due_since, nas_back_at, started_at, finished_at from obs_archive_sweeps order by due_since desc limit 1;` mostra uma linha com `due_since` anterior ao desligamento e `finished_at` preenchido depois de 1 ou 2 execuções; linha ausente = o defeito voltou.

---

## Cobertura dos itens de aceite (`06` §18) desta etapa

| Item | Onde |
|---|---|
| 19 (formato) | Tarefa 2 (fixtures de ouro; os testes de formato da E10 continuam) |
| 20 (leitor Python) | M3b-forja, com as fixtures da Tarefa 2 |
| 21 (exportar, conferir, soltar, recarregar com `\copy`, reexportar: `csv_sha256` igual) | Tarefas 4 e 5 até "reexportar"; "soltar" é da M6; a recarga por `\copy` é a prova da E10 (`recarga-prova.sql`), refeita com uma unidade mensal no Passo 5 da Tarefa 4 |
| 22, 23, 25, 26, 31, 75, 76, 77, 78 | Tarefas 4, 5 e 11 |
| 24 | Tarefa 11 |
| 27, 74, 79 | M3b-forja |
| 28 | Tarefas 7 e 13 |
| 29 | Tarefa 7 (`skipIf` até a E10 existir no banco) |
| 30 | Tarefa 7 (site); o registro e a verificação próprios: M3b-forja |
| 32, 80 | Tarefa 14 (consultas do dono) |
| 33 | M3b-forja |
| 119 | Tarefa 3 (com a regra da M2) |
| 131 | Tarefas 1, 3 e 4 (o ensaio de restauração por (classe, tabela) é a tabela da Tarefa 3; o "não vale para a outra" é da M8) |
| 132, 133 (lado do site), 134 (canário, `vermelhos`) | Tarefas 6, 7 e 11; lado da forja e pulso: M3b-forja |
| 158, 159, 160 | Tarefas 5 e 8 |
| 163 (frase do diálogo) | Tarefa 12; o bloco "Canais removidos" e a marca: M5; a ação e os comandos: M9 |
| 165 (a função) | Tarefa 8 |
| 172 | Tarefa 7 (site); a releitura completa no copiador: M3b-forja |

## NÃO VERIFICADO (o plano escreveu sem ter rodado)

- **r2.2:** `obs_archive_b2_teto_cor` e `obs_archive_b2_aceitar_paginas` foram provadas no `bythiago_int` (54422, `begin … rollback`, tabelas da parte 1 extraídas do plano): teto dia 1 `ambar`, dia 2 `vermelho`, dia 3 sem estouro `verde`, dia 5 depois de um dia sem execução `ambar`; páginas aceitas em ordem, `sem_acesso` segurando a página 2 e fechando o completo depois. **Não rodados:** a abertura e a herança no `obs_archive_b2_plan` (regra em prosa, Tarefa 6) e o Zod novo (Tarefa 1).

- Todo o SQL das Tarefas 3 a 8: escrito a partir das migrations lidas, não rodado. Pontos de maior risco: o `format` de `obs_archive_read_unit` (Tarefa 4), a materialização única do `with u` (medida no Passo 5 da Tarefa 4), e o acesso a campos de `record` não preenchido em `obs_archive_record` quando não há versão anterior.
- As colunas obrigatórias de `sites`, `competitor_channels` e `competitor_videos` em `semearCanal` (Tarefa 3, Passo 6).
- `TETO_LINHAS_POR_CHAMADA` (CP13, Tarefa 0, Passo 5) e o `statement_timeout` de produção (CP4, Tarefa 0, Passo 4).
- A forma do `fileId` do B2 (`^4_z...`): vem do bloco 10 da M3a (ledger); se divergir, o contrato C7.2 e `obs_archive_b2_run_gate` mudam juntos.
- Os privilégios padrão do `service_role` em produção (K3): a sonda foi no `bythiago_int`; a Tarefa 10, Passo 5, confere.
- A franquia de saída do B2 (CP24, Tarefa 0, Passo 6): o `teto_bytes_mes` provisório vale só se a franquia for da conta.
- Se `npx supabase db query --linked` aceita `begin; ...; rollback;` numa chamada (Tarefa 10, Passo 5).
- `TETO_LINHAS_DA_UNIDADE` (CP13 refeita com a maior unidade horária e de comentários × 3, Tarefa 0, Passo 5).
- `obs_archive_expected_units` e `obs_archive_month_files` têm SQL real na parte 3 (Tarefa 5), provado no `bythiago_int` em 14/10 com `begin … rollback` sobre as tabelas da parte 1 e o leitor da parte 2: `serie` de outubro com canal cadastrado antes, no último minuto do mês, depois do mês sem linha e depois do mês com linha, e com `added_at` nulo; piso de outubro; `first_month` da `texto`; `video_antigo` vazio; mês inválido; arquivos do mês com versão 2, unidade vazia, unidade em 2 partes, unidade perdida, resumo vazio e resumo expurgado, e o `nas_attested_at` do mês nulo com um arquivo sem atestado. **NÃO VERIFICADO:** o ramo do rol do ensaio. Ele lê `public.obs_archive_rehearsal_seed` por `to_regclass` como **tabela** com `site_id`, `month` e `channel_ref`, mas o spec (`03` §13.3, `05` l.534) chama `obs_archive_rehearsal_seed(p_month date)` de **função**; `to_regclass` de nome de função é nulo, e o ensaio cairia para sempre em "só os com linha" (sem o canal vazio do `03` §13.3). A M8 cria o rol como tabela com essa forma (outro nome, trocado aqui no mesmo commit) ou muda este ramo.
- O tempo de `competitor_channel_remove` num canal cheio (P51, Tarefa 8).
- Se `server-only` tem alias no Vitest do projeto (Tarefa 9).

## Dependências de outras etapas e trilhas

- **M2 e M10a em produção** (TRAVA M3b-0) antes da Tarefa 10.
- **M4, mockup `18-v2` aprovado** (TRAVA M3b-3) antes dos passos 4 a 7 da Tarefa 12; o diálogo tem de estar em produção antes de 28/11.
- **M3b-forja** consome o contrato (r2); a primeira selagem real (28/11) exige os dois lados instalados e `OBS_ARQUIVO=on`. A r2.1 fechou X1 a X5 (decisões do controlador, 14/10): validade de 2 h renovada a cada página e retomada pelo cursor (X1), arquivo só em `_recebendo/` é `ausente` (X2), `tabela_ausente` 409 (X3), `nas_quase_cheio` fora dos desfechos (X4), `incompleto` por pulo é vermelho (X5). O redator da forja alinha o kit à linha `Versão r2.3`.
- **M8:** `obs_archive_rehearsal_seed` (o rol da carga do ensaio, D14) é lido por `to_regclass`; até a M8, o ensaio usa os canais com linha.
- **A5/E19:** o aviso da Tarefa 9a (`auth.ts` é arquivo da trilha); a recusa vale em qualquer modo da E19 e não muda quando ela for a `recusa`.
- **E10 (A5):** o aviso do pedido 2 (Tarefa 0); o pedido 13 (`obs_archive_is_site_admin` com `p_user`); o pedido 18 (a E9 e a E10 chamam `competitor_channel_remove`: até lá, o gatilho recusa os caminhos delas em canal com unidade, alto).
- **M6:** o gatilho do mês destacado com nome antes de `obs_archive_z_*`, e o teste de ordem; a frase de `mes_destacado_em_transito` no botão; as condições do portão que leem o que esta etapa grava (`b2_*`, `nas_attested_at`, `restores`).
- **M7:** recria `competitor_channel_remove` e `obs_archive_channel_removal_decide` com o apagamento de `obs_archive_results` (D16); as rotas `request/*`.
- **M9:** prefixos ausentes no plano e no `attest`, os marcos da remoção, a ação "Apagar do arquivo" (que chama a função desta etapa), `OBS_ARQUIVO_LIMPEZA_CANAL=on`.
- **M10b:** libera `video_antigo`, os anexos e a ficha no resumo (`obs_archive_summary_rows` recusa `resumo_da_m10b` até lá).
