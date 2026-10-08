# Coleta dos canais próprios — lote L1b — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar à coleta o estado de autorização do canal (`reautorizar` e a volta a `ok`), capturar `privacy_status` e `is_short` pela `videos.list` com o token do canal dono, trancar as tabelas da coleta com chave estrangeira `on delete restrict` (com a RPC de remover canal sabendo lidar com isso), e gravar cada execução do cron numa tabela, para que o resumo deixe de existir só na resposta HTTP.

**Architecture:** tudo continua dentro de `sync-analytics-metrics`. Um módulo novo (`coleta/autorizacao.ts`) concentra a decisão "perdeu a autorização / sem conexão / outro erro" e é usado pelos três passos novos e pela parte antiga da rota. O passo de metadados ganha uma chamada `videos.list` por canal (1 unidade de cota a cada 50 vídeos) e uma segunda passada, depois de gravar as linhas, só para a sonda de Shorts. A migration é aditiva, roda duas vezes e vai para produção antes do código.

**Tech Stack:** Next.js 16 (rota de cron), Supabase/PostgREST, Vitest, YouTube Data API v3 (`videos.list`), TypeScript estrito.

**Spec:** `docs/superpowers/specs/2026-10-07-coleta-canais-proprios-design.md` — linhas L1b das seções 0, 2, 3, 6 ("Autorização"), 9 e 11 (aceite 4b). Ledger do lote anterior: `.superpowers/sdd/2026-10-07-coleta-l1a-plan/progress.md`.

**Método (aprovado pelo dono em 08/10):** um subagente por tarefa, com revisor, nas Tasks 3 a 10; execução direta nas Tasks 1, 2, 11, 12 e 13. Implementadores no modelo mais barato que dê conta (Sonnet); a revisão final do lote, uma só, no modelo mais capaz. Sem polling.

## Global Constraints

- Trabalhar em `staging`, sem branch e sem worktree. Nunca `git stash`, nunca `git reset`. Commit por caminho explícito (`git commit -m "..." -- <caminhos>`), mensagem `tipo: descrição` em português. Nunca `--no-verify`.
- Nunca commitar `apps/web/next-env.d.ts` nem `apps/web/tsconfig.json`.
- Migration só com `npm run db:new <nome>`. Quem aplica em produção é o dono (`npm run db:push:prod`). Leitura em produção: `npx supabase db query --linked "<select … limit n>"`, só SELECT.
- **Ordem de rollout:** a migration vai para produção **antes** de o código chegar a `main`. Dois pushes em `staging`: (1) migration + tipos, (2) código. Promoção para `main`: pedir autorização explícita ao dono na hora.
- Suíte inteira (`cd apps/web && npx vitest run`) verde antes de cada push.
- TypeScript `strict`, nunca `any`. Arquivos em kebab-case. Mensagens e rótulos novos em pt-BR (decisão 5 do spec).
- Toda leitura e toda escrita no Supabase confere `error` com `conferirBanco` (`coleta/schema.ts`). Nenhuma escrita é descartada em silêncio.
- Nulo, nunca zero. Campo não medido é `NULL`; uma segunda execução no mesmo dia nunca leva um campo de não nulo a nulo (o campo sem valor fica **fora** do payload do upsert).
- Datas de teste sempre com `vi.useFakeTimers({ now, toFake: ['Date'] })` ou relativas; nenhuma data futura fixa (o teste `test-hygiene` recusa).
- Testes de código de servidor começam com `// @vitest-environment node`.
- O corpo de uma resposta de erro do Google nunca é gravado nem logado: só o status e o `reason`.
- Nunca criar nem revogar chaves do pipeline. Nada em `packages/` (então `build:packages` não se aplica). Pipeline Integrity não é tocada.
- Sem tela nova neste lote: o único texto que chega à tela é a recusa "Este canal tem série coletada…", na resposta de uma action que já existe.
- Este sistema falha em verde. Em cada tarefa, pergunte "o que acontece quando o dado não existe?" antes de "o que acontece quando dá erro?".

## Review Focus

1. **Canal reconectado pelo OAuth com o carimbo de aviso ainda aberto.** Se o dono reconecta e o canal é revogado de novo em menos de 7 dias, ele espera ser avisado de novo. → teste na Task 10 (o callback apaga o carimbo `reautorizar`).
2. **`privacyStatus` com um valor que o `check` da coluna não aceita.** A linha do dia não pode se perder por causa de um valor desconhecido: grava com `privacy_status` fora do payload e a falha fica visível. → teste na Task 8.
3. **`videos.list` falhando numa segunda execução do mesmo dia.** O `privacy_status` e o `is_short` da primeira execução não podem voltar a nulo. → teste na Task 8.
4. **Migration aplicada com linhas órfãs** (canal removido durante o L1a). O dono espera que nada seja apagado: a migration aborta com a contagem e a instrução. → teste na Task 2.
5. **Código em produção antes da migration** (coluna `collection_status` ausente). O dono espera a falha visível (`schema_ausente`) e a parte antiga do cron rodando igual. → teste na Task 6 e na Task 9.

---

## File Structure

| Arquivo | O que faz | Tarefa |
|---|---|---|
| `supabase/migrations/<TS>_coleta_canais_proprios_l1b.sql` (criar com `npm run db:new`) | colunas de `youtube_channels`, guarda de órfãos, quatro FKs `on delete restrict`, tabela `yt_own_collection_runs`, as duas funções de remover canal recriadas | 2 |
| `apps/web/src/types/database.types.ts` | só os blocos novos | 2 |
| `apps/web/test/integration/youtube-channel-remove.test.ts` | casos `serie_coletada` e FK; lista de chaves atualizada | 2 |
| `apps/web/src/lib/youtube/channel-registry.ts` | `serie_coletada` no schema, no tipo e no texto | 3 |
| `apps/web/src/app/cms/(authed)/youtube/_actions/channels.ts` | ramo `serie_coletada` na remoção | 3 |
| `apps/web/src/lib/youtube/coleta/alerts.ts` | motivo `reautorizar`; `avisarSaida` com lista de motivos | 4 |
| `apps/web/src/lib/youtube/coleta/google-erro.ts` (novo) | `motivoDoGoogle`, `ehPerdaDeAutorizacao` — puro, sem banco | 5 |
| `apps/web/src/lib/youtube/coleta/autorizacao.ts` (novo) | `classificarErroDeToken`, `marcarReautorizar`, `marcarAutorizado`, `obterToken` | 5 |
| `apps/web/src/lib/youtube/coleta/types.ts` | `ColetaChannel.collection_status`, `.video_count` | 5 |
| `apps/web/src/lib/youtube/coleta/token.ts` | sai `registrarSemConexao` | 6 |
| `apps/web/src/lib/youtube/coleta/jobs-step.ts`, `reports-step.ts` | usam `obterToken` | 6 |
| `apps/web/src/lib/youtube/coleta/criteria.ts` | lê `sem_autorizacao` junto de `sem_conexao` | 6 |
| `apps/web/src/lib/youtube/coleta/index.ts` | lê as colunas novas; `ms` por passo; `reautorizar`; canal com vídeos no YouTube e nenhum cadastrado | 6 |
| `apps/web/src/lib/youtube/coleta/videos-list.ts` (novo) | cliente `videos.list` com o token do canal | 7 |
| `apps/web/src/lib/youtube/coleta/meta-step.ts` | captura pela Data API, `privacy_status`, `is_short`, critério de thumbnail sem privados/ausentes | 8 |
| `apps/web/src/app/api/cron/sync-analytics-metrics/route.ts` | parte antiga com `reautorizar`; aviso antigo calado para canal em `reautorizar`; linha em `yt_own_collection_runs` | 9 |
| `apps/web/src/app/api/social/oauth/[provider]/callback/route.ts` | reconexão devolve o canal a `ok` e apaga o carimbo | 10 |
| `docs/ops/youtube-coleta-canais-proprios-runbook.md` | seções novas e corrigidas | 11 |

Testes: `apps/web/test/youtube/coleta/{alerts,google-erro,autorizacao,token,jobs-step,reports-step,criteria,index,videos-list,meta-step,tres-dias}.test.ts`, `apps/web/test/youtube/channel-registry.test.ts`, `apps/web/test/youtube/channel-registry-actions.test.ts`, `apps/web/test/api/cron/sync-analytics-metrics.test.ts`, `apps/web/test/cron/sync-analytics-metrics.test.ts`, `apps/web/test/api/oauth/social-routes.test.ts`.

**Nomes compartilhados entre tarefas** (use exatamente estes):

```ts
// coleta/types.ts
export interface ColetaChannel {
  id: string; channel_id: string; site_id: string; name: string; sync_enabled: boolean
  collection_status: 'ok' | 'reautorizar'
  video_count: number | null
}
// coleta/google-erro.ts
export async function motivoDoGoogle(res: Response): Promise<string | null>
export function ehPerdaDeAutorizacao(status: number, reason: string | null): boolean
// coleta/autorizacao.ts
export type ClasseToken = 'reautorizar' | 'sem_conexao' | 'outro'
type CtxAut = Pick<StepCtx, 'supabase' | 'falhas' | 'tentativas'>
export async function classificarErroDeToken(ctx: CtxAut, c: ColetaChannel, e: unknown): Promise<ClasseToken>
export async function marcarReautorizar(ctx: CtxAut, c: ColetaChannel): Promise<void>
export async function marcarAutorizado(ctx: CtxAut, c: ColetaChannel): Promise<void>
export async function obterToken(ctx: StepCtx, c: ColetaChannel, base: Omit<Tentativa, 'outcome' | 'http_status' | 'error'>): Promise<string | null>
// coleta/alerts.ts
export type MotivoAviso = 'api_nao_ativada' | 'sem_acesso' | 'tipo_indisponivel' | 'reautorizar'
export async function avisarSaida(ctx: Ctx, ch: ColetaChannel, motivos?: readonly MotivoAviso[]): Promise<void>
// coleta/videos-list.ts
export class DataApiError extends Error { readonly status: number; readonly reason: string | null }
export interface VideoCapturado { id: string; title: string | null; description: string | null; tags: string[]; durationSeconds: number | null; privacyStatus: string | null }
export async function videosList(token: string, ids: readonly string[], f: typeof fetch): Promise<Map<string, VideoCapturado>>
```

---

### Task 1: Pré-voo e ledger (execução direta)

**Files:**
- Create: `.superpowers/sdd/2026-10-08-coleta-l1b-plan/progress.md` (não commitado; `.superpowers/` está no `.gitignore`)

**Interfaces:**
- Consumes: nada.
- Produces: o ledger do lote, com `BASE` e os pré-requisitos.

- [ ] **Step 1: Conferir a base**

Run (raiz):

```bash
git rev-parse --short HEAD
git rev-parse --short origin/main
git log --oneline -3 -- apps/web/src/lib/youtube/coleta apps/web/src/app/api/cron/sync-analytics-metrics
```

Expected: o último commit que toca a coleta é `fb95477d` ou um posterior deste lote. Se outro terminal mexeu nesses caminhos, leia o diff antes de seguir.

- [ ] **Step 2: Conferir produção (só SELECT)**

```bash
npx supabase db query --linked "select column_name from information_schema.columns where table_name = 'youtube_channels' and column_name in ('collection_status', 'authorization_verified_at') limit 5"
npx supabase db query --linked "select (select count(*) from yt_reporting_jobs j where not exists (select 1 from youtube_channels c where c.id = j.channel_id)) as jobs_orfaos, (select count(*) from yt_reporting_reports r where not exists (select 1 from youtube_channels c where c.id = r.channel_id)) as relatorios_orfaos, (select count(*) from yt_own_video_meta_daily m where not exists (select 1 from youtube_channels c where c.id = m.channel_id)) as meta_orfas"
```

Expected: zero linhas na primeira (as colunas ainda não existem) e três zeros na segunda. Se houver órfão, pare e avise o dono: a migration da Task 2 aborta de propósito nesse caso.

- [ ] **Step 3: Criar o ledger**

Conteúdo inicial de `.superpowers/sdd/2026-10-08-coleta-l1b-plan/progress.md`:

```markdown
# SDD ledger — plan: docs/superpowers/plans/2026-10-08-coleta-l1b-plan.md

BASE: staging <sha> · origin/main <sha> (conferido em <data>)
Spec: docs/superpowers/specs/2026-10-07-coleta-canais-proprios-design.md
Método: execução direta nas Tasks 1, 2, 11–13; um subagente por tarefa com revisor nas Tasks 3–10.

## ROLLOUT (ordem obrigatória)
A migration vai para produção ANTES de o código chegar a main. Só o dono roda, um por linha:

    npm run db:which
    npm run db:push:prod
    npx supabase db query --linked "select collection_status, count(*) from youtube_channels group by 1 limit 5"

## Commits (staging)

## Desvios do plano

## Revisão de totalidade

## O que o L1b ensinou para os specs restantes

## Progresso
```

---

### Task 2: Migration, tipos e teste de banco (push 1 — execução direta)

**Files:**
- Create: `supabase/migrations/<TS>_coleta_canais_proprios_l1b.sql` (o nome exato é o que `npm run db:new` imprime)
- Modify: `apps/web/src/types/database.types.ts`
- Modify: `apps/web/test/integration/youtube-channel-remove.test.ts`

**Interfaces:**
- Consumes: as cinco tabelas do L1a; `public.youtube_channel_remove` e `public.youtube_channel_removal_impact` de `20261003000007`.
- Produces: colunas `youtube_channels.collection_status` (`'ok' | 'reautorizar'`, padrão `'ok'`) e `authorization_verified_at`; tabela `yt_own_collection_runs`; chave `serie_coletada` no jsonb do impacto; status `'serie_coletada'` na remoção.

- [ ] **Step 1: Criar o arquivo**

Run (raiz): `npm run db:new coleta_canais_proprios_l1b`

- [ ] **Step 2: Escrever o SQL**

Conteúdo completo do arquivo criado:

```sql
-- =============================================================================
-- MIGRATION: Coleta dos canais próprios — lote L1b
-- Spec: docs/superpowers/specs/2026-10-07-coleta-canais-proprios-design.md (seções 0, 2 e 6)
-- Aditiva. Roda duas vezes sem erro. Depende de 20261007000006 (L1a) e 20261003000007.
--
-- O que faz:
--   1. youtube_channels ganha collection_status e authorization_verified_at;
--   2. linhas órfãs (canal removido durante o L1a): tentativas perdem o vínculo; série órfã ABORTA a migration;
--   3. channel_id das quatro tabelas da coleta vira chave estrangeira ON DELETE RESTRICT;
--   4. yt_own_collection_runs: uma linha por execução do cron (tempos, falhas, resumo);
--   5. as duas funções de remover canal são recriadas: canal com série coletada não é removido pela tela.
-- =============================================================================

-- ── 1. Estado de autorização do canal ───────────────────────────────────────
alter table public.youtube_channels add column if not exists authorization_verified_at timestamptz;
alter table public.youtube_channels add column if not exists collection_status text not null default 'ok';
alter table public.youtube_channels drop constraint if exists youtube_channels_collection_status_check;
alter table public.youtube_channels add constraint youtube_channels_collection_status_check
  check (collection_status in ('ok', 'reautorizar'));

-- ── 2. Órfãos ───────────────────────────────────────────────────────────────
-- Tentativa é registro de execução, não série: perde o vínculo e fica.
update public.yt_own_collection_attempts a
   set channel_id = null
 where a.channel_id is not null
   and not exists (select 1 from public.youtube_channels c where c.id = a.channel_id);

-- Série órfã (o que estava no ar, relatórios, jobs) não volta se for apagada: quem decide é o dono.
do $$
declare
  v_jobs bigint;
  v_rel bigint;
  v_meta bigint;
begin
  select count(*) into v_jobs from public.yt_reporting_jobs j
   where not exists (select 1 from public.youtube_channels c where c.id = j.channel_id);
  select count(*) into v_rel from public.yt_reporting_reports r
   where not exists (select 1 from public.youtube_channels c where c.id = r.channel_id);
  select count(*) into v_meta from public.yt_own_video_meta_daily m
   where not exists (select 1 from public.youtube_channels c where c.id = m.channel_id);
  if v_jobs + v_rel + v_meta > 0 then
    raise exception 'coleta L1b: há série de canal que não existe mais (jobs %, relatórios %, metadados %). Nada foi apagado. Exporte e apague a série órfã pelo runbook (docs/ops/youtube-coleta-canais-proprios-runbook.md, "Apagar a série de um canal") e rode a migration de novo.',
      v_jobs, v_rel, v_meta;
  end if;
end $$;

-- ── 3. Chaves estrangeiras ──────────────────────────────────────────────────
alter table public.yt_reporting_jobs drop constraint if exists yt_reporting_jobs_channel_id_fkey;
alter table public.yt_reporting_jobs add constraint yt_reporting_jobs_channel_id_fkey
  foreign key (channel_id) references public.youtube_channels(id) on delete restrict;

alter table public.yt_reporting_reports drop constraint if exists yt_reporting_reports_channel_id_fkey;
alter table public.yt_reporting_reports add constraint yt_reporting_reports_channel_id_fkey
  foreign key (channel_id) references public.youtube_channels(id) on delete restrict;

alter table public.yt_own_video_meta_daily drop constraint if exists yt_own_video_meta_daily_channel_id_fkey;
alter table public.yt_own_video_meta_daily add constraint yt_own_video_meta_daily_channel_id_fkey
  foreign key (channel_id) references public.youtube_channels(id) on delete restrict;

alter table public.yt_own_collection_attempts drop constraint if exists yt_own_collection_attempts_channel_id_fkey;
alter table public.yt_own_collection_attempts add constraint yt_own_collection_attempts_channel_id_fkey
  foreign key (channel_id) references public.youtube_channels(id) on delete restrict;

-- ── 4. Uma linha por execução do cron ───────────────────────────────────────
-- O resumo do cron (tempos por passo, acao_do_dono, perdidos, vazios) só existia na resposta HTTP,
-- que ninguém guarda. Sem site_id: a execução é do cron inteiro. Só service role lê e grava.
create table if not exists public.yt_own_collection_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  ms_total integer not null,
  ms_existente integer not null,
  ms_passos jsonb not null default '{}'::jsonb,
  falhas text[] not null default '{}',
  acao_do_dono text[] not null default '{}',
  resumo jsonb not null default '{}'::jsonb
);
create index if not exists idx_yt_own_collection_runs_ran_at on public.yt_own_collection_runs (ran_at desc);
alter table public.yt_own_collection_runs enable row level security;
revoke all on table public.yt_own_collection_runs from anon, authenticated;

-- ── 5. Remover canal: série coletada bloqueia ───────────────────────────────
-- As duas funções são recriadas por inteiro. Única mudança em relação a 20261003000007:
-- a chave serie_coletada no impacto e o status 'serie_coletada' na remoção (depois de not_found e
-- slug_mismatch, antes de blocked). Apagar a série continua sendo passo manual do dono.
create or replace function public.youtube_channel_removal_impact(p_site_id uuid, p_channel_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_name text;
  v_slug text;
  v_yt text;
begin
  select c.name, c.slug, c.channel_id into v_name, v_slug, v_yt
  from public.youtube_channels c where c.id = p_channel_id and c.site_id = p_site_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

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
    -- linhas da coleta que apontam para o canal (o bruto vai junto com o relatório, por cascata)
    'serie_coletada', (select count(*) from public.yt_own_video_meta_daily m where m.channel_id = p_channel_id)
                    + (select count(*) from public.yt_reporting_reports r where r.channel_id = p_channel_id)
                    + (select count(*) from public.yt_reporting_jobs j where j.channel_id = p_channel_id)
                    + (select count(*) from public.yt_own_collection_attempts a where a.channel_id = p_channel_id),
    'blockers', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'status', t.status, 'started_at', t.started_at,
                                          'paused_at', t.paused_at, 'video_title', v.title)
                       order by t.started_at nulls last, t.id)
      from public.ab_tests t join public.youtube_videos v on v.id = t.youtube_video_id
      where v.channel_id = p_channel_id and t.status in ('active', 'paused', 'queued')), '[]'::jsonb)
  );
end $$;

create or replace function public.youtube_channel_remove(p_site_id uuid, p_channel_id uuid, p_confirm_slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_slug text;
  v_yt text;
  v_videos uuid[];
  v_tests uuid[];
  v_impact jsonb;
begin
  select c.slug, c.channel_id into v_slug, v_yt from public.youtube_channels c
  where c.id = p_channel_id and c.site_id = p_site_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if p_confirm_slug is distinct from v_slug then
    return jsonb_build_object('status', 'slug_mismatch');
  end if;

  select coalesce(array_agg(s.id), '{}') into v_videos
  from (select v.id from public.youtube_videos v where v.channel_id = p_channel_id for update) s;
  select coalesce(array_agg(s.id), '{}') into v_tests
  from (select t.id from public.ab_tests t where t.youtube_video_id = any(v_videos) for update) s;

  v_impact := public.youtube_channel_removal_impact(p_site_id, p_channel_id);
  -- Série coletada: a chave estrangeira recusaria o delete do canal de qualquer jeito. Recusa aqui, antes de
  -- apagar qualquer coisa, com um estado que a tela sabe explicar.
  if (v_impact ->> 'serie_coletada')::bigint > 0 then
    return v_impact || jsonb_build_object('status', 'serie_coletada');
  end if;
  if jsonb_array_length(v_impact -> 'blockers') > 0 then
    return v_impact || jsonb_build_object('status', 'blocked');
  end if;

  update public.social_connections sc
  set revoked_at = now(), access_token_enc = '', refresh_token_enc = null, page_token_enc = null, token_expires_at = null
  where sc.site_id = p_site_id and sc.provider = 'youtube' and sc.account_id = v_yt and sc.revoked_at is null;

  delete from public.yt_notifications nt
  where nt.youtube_video_id = any(v_videos) or nt.ab_test_id = any(v_tests)
     or nt.optimization_cycle_id in (select oc.id from public.optimization_cycles oc where oc.youtube_video_id = any(v_videos));

  update public.optimization_cycles oc set ab_test_id = null
  where oc.ab_test_id = any(v_tests) and not (oc.youtube_video_id = any(v_videos));
  delete from public.optimization_cycles oc where oc.youtube_video_id = any(v_videos);
  delete from public.ab_tests t where t.id = any(v_tests);
  delete from public.youtube_videos v where v.channel_id = p_channel_id;
  delete from public.youtube_sync_log l where l.channel_id = p_channel_id;
  delete from public.youtube_channels c where c.id = p_channel_id and c.site_id = p_site_id;

  return v_impact || jsonb_build_object('status', 'removed');
end $$;

revoke all on function public.youtube_channel_removal_impact(uuid, uuid) from public, anon, authenticated;
revoke all on function public.youtube_channel_remove(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.youtube_channel_removal_impact(uuid, uuid) to service_role;
grant execute on function public.youtube_channel_remove(uuid, uuid, text) to service_role;

comment on function public.youtube_channel_removal_impact(uuid, uuid) is 'Conta o que a remoção de um canal próprio apagaria, a série coletada que a impede e os testes A/B (active/paused/queued) que a bloqueiam. Só leitura; só service role.';
comment on function public.youtube_channel_remove(uuid, uuid, text) is 'Remove um canal próprio e tudo o que depende dele em uma transação. Série coletada ou teste A/B active/paused/queued recusam antes de apagar. Só service role.';
```

- [ ] **Step 3: Escrever os testes de banco (falham antes da migration)**

Em `apps/web/test/integration/youtube-channel-remove.test.ts`:

(a) Na asserção `toEqual` do impacto (perto da linha 148) acrescente `serie_coletada: 0` ao objeto esperado. No `toMatchObject` da linha ~158 acrescente `serie_coletada: 0`.

(b) Na lista de chaves ordenadas (perto da linha 227) acrescente `'serie_coletada'` na posição alfabética (entre `'pipeline_links'` e `'slug'`).

(c) Acrescente, dentro do `describe` principal, depois do último `it` de remoção:

```ts
  it('L1b: canal com série coletada não é removido, nada é apagado, e a série apagada libera a remoção', async () => {
    const { ch, v1, v2 } = await fullChannel(siteA, `@serie${run}`)
    const dia = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
    must(await sb.from('yt_own_video_meta_daily').insert({
      site_id: siteA, youtube_video_id: `serie${run}`.slice(0, 11).padEnd(11, 'x'), day_pt: dia, video_id: v1,
      channel_id: ch.id, captured_at: new Date().toISOString(),
    }))
    must(await sb.from('yt_reporting_jobs').insert({ site_id: siteA, channel_id: ch.id, report_type_id: 'channel_reach_basic_a1', status: 'ativo', job_id: `job-${run}` }))
    const before = await counts(ch.id as string, [v1, v2])

    const impact = (await sb.rpc('youtube_channel_removal_impact', { p_site_id: siteA, p_channel_id: ch.id })).data as Record<string, unknown>
    expect(impact).toMatchObject({ status: 'ok', serie_coletada: 2 })

    const recusa = await sb.rpc('youtube_channel_remove', { p_site_id: siteA, p_channel_id: ch.id, p_confirm_slug: ch.slug })
    expect(recusa.error).toBeNull()
    expect(recusa.data).toMatchObject({ status: 'serie_coletada', serie_coletada: 2, name: ch.name })
    expect(await counts(ch.id as string, [v1, v2])).toEqual(before)

    // A chave estrangeira segura o canal mesmo fora da função.
    const direto = await sb.from('youtube_channels').delete().eq('id', ch.id)
    expect(direto.error?.code).toBe('23503')

    must(await sb.from('yt_own_video_meta_daily').delete().eq('channel_id', ch.id))
    must(await sb.from('yt_reporting_jobs').delete().eq('channel_id', ch.id))
    const ok = await sb.rpc('youtube_channel_remove', { p_site_id: siteA, p_channel_id: ch.id, p_confirm_slug: ch.slug })
    expect(ok.data).toMatchObject({ status: 'removed', serie_coletada: 0 })
  })

  it('L1b: youtube_channels nasce com collection_status ok e recusa valor fora da lista', async () => {
    const { ch } = await fullChannel(siteA, `@estado${run}`)
    const lido = await sb.from('youtube_channels').select('collection_status, authorization_verified_at').eq('id', ch.id).single()
    expect(lido.data).toEqual({ collection_status: 'ok', authorization_verified_at: null })
    const ruim = await sb.from('youtube_channels').update({ collection_status: 'quebrado' }).eq('id', ch.id)
    expect(ruim.error?.code).toBe('23514')
    const bom = await sb.from('youtube_channels').update({ collection_status: 'reautorizar' }).eq('id', ch.id)
    expect(bom.error).toBeNull()
  })

  it('L1b: yt_own_collection_runs aceita a linha da execução e não é lida por anon', async () => {
    const ins = await sb.from('yt_own_collection_runs').insert({
      ms_total: 43000, ms_existente: 15000, ms_passos: { metadados: 13000, jobs: 10000, relatorios: 2000 },
      falhas: [], acao_do_dono: ['Canal: reautorizar'], resumo: { ok: true },
    }).select('id, ran_at').single()
    expect(ins.error).toBeNull()
    const anon = createClient(SUPABASE_URL, ANON_KEY)
    const lido = await anon.from('yt_own_collection_runs').select('id').limit(1)
    expect(lido.data ?? []).toEqual([])
    must(await sb.from('yt_own_collection_runs').delete().eq('id', (ins.data as { id: number }).id))
  })
```

Se o arquivo não importa `createClient`, `SUPABASE_URL` e `ANON_KEY`, acrescente no topo, como em `coleta-l1a-migration.test.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, ANON_KEY } from '../helpers/db-seed'
```

`fullChannel`, `counts`, `must`, `siteA`, `run` e `sb` já existem no arquivo; leia as primeiras 100 linhas para confirmar as assinaturas antes de colar (em particular: `v1` é o uuid de `youtube_videos.id`).

- [ ] **Step 4: Rodar e ver falhar**

Run (raiz): `npm run db:status` (o banco local precisa estar no ar; se não estiver, `npm run db:start`).

Run: `cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/youtube-channel-remove.test.ts`
Expected: FAIL nos três testes `L1b:` e nos dois que comparam chaves (a função antiga não devolve `serie_coletada`).

- [ ] **Step 5: Aplicar a migration no banco local, duas vezes**

Não rode `npm run db:reset`: outro terminal pode estar usando o banco local (ruling do L1a). Aplique só o arquivo novo:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/migrations/<ARQ>
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/migrations/<ARQ>
```

Expected: as duas execuções terminam sem `ERROR`.

- [ ] **Step 6: Provar a guarda de órfãos (Review Focus 4)**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 <<'SQL'
begin;
alter table public.yt_reporting_jobs drop constraint yt_reporting_jobs_channel_id_fkey;
insert into public.yt_reporting_jobs (site_id, channel_id, report_type_id, status)
  select id, gen_random_uuid(), 'orfao_de_teste', 'desativado' from public.sites limit 1;
\i supabase/migrations/<ARQ>
rollback;
SQL
```

Expected: `ERROR:  coleta L1b: há série de canal que não existe mais (jobs 1, relatórios 0, metadados 0). Nada foi apagado. …` e a transação desfeita. Confirme que nada ficou:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select count(*) from public.yt_reporting_jobs where report_type_id = 'orfao_de_teste'"
```

Expected: `0`.

- [ ] **Step 7: Rodar os testes de banco**

Run: `cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/youtube-channel-remove.test.ts test/integration/coleta-l1a-migration.test.ts`
Expected: PASS. Se `coleta-l1a-migration.test.ts` falhar com `23503` (ele usa um `channel_id` aleatório, que a FK agora recusa), troque nele o `const canal = randomUUID()` por um canal de verdade criado no `beforeAll` com o mesmo `insert` em `youtube_channels` que `fullChannel` usa, e remova esse canal no `afterAll` depois de apagar as linhas da coleta. Esse ajuste vai no mesmo commit.

- [ ] **Step 8: Tipos**

Run (raiz): `npm run db:types` e depois `git diff --stat -- apps/web/src/types/database.types.ts`.

O arquivo tem deriva conhecida (ledger do L1a): o gerador mexe em blocos alheios. **Não commite a saída inteira.** Descarte-a com `git checkout -- apps/web/src/types/database.types.ts` e insira à mão, em ordem alfabética, só: o bloco `yt_own_collection_runs` (Row/Insert/Update/Relationships), as duas colunas novas nos três sub-blocos de `youtube_channels`, e as `Relationships` novas das quatro tabelas da coleta. Copie o texto dos blocos da saída do gerador (guarde-a antes num arquivo do diretório de rascunho).

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 9: Suíte inteira e commit**

Run: `cd apps/web && npx vitest run`
Expected: 0 falhas.

```bash
git add supabase/migrations/<ARQ> apps/web/src/types/database.types.ts apps/web/test/integration/youtube-channel-remove.test.ts apps/web/test/integration/coleta-l1a-migration.test.ts
git commit -m "feat: migration da coleta dos canais próprios, lote L1b (estado de autorização, chaves estrangeiras, execuções do cron e remoção de canal com série)" -- supabase/migrations/<ARQ> apps/web/src/types/database.types.ts apps/web/test/integration/youtube-channel-remove.test.ts apps/web/test/integration/coleta-l1a-migration.test.ts
```

- [ ] **Step 10: Push 1 e pedido ao dono**

Run: `git push origin staging`

Anote no ledger e peça ao dono, um por linha:

```
npm run db:which
npm run db:push:prod
npx supabase db query --linked "select collection_status, count(*) from youtube_channels group by 1 limit 5"
```

O código das tarefas seguintes pode ser commitado em `staging` antes de o dono aplicar; o portão é a promoção para `main` (Task 12).

---

### Task 3: `serie_coletada` no cadastro de canais

**Files:**
- Modify: `apps/web/src/lib/youtube/channel-registry.ts:102-171` (tipos e parser) e `:175-189` (textos)
- Modify: `apps/web/src/app/cms/(authed)/youtube/_actions/channels.ts:313-317`
- Test: `apps/web/test/youtube/channel-registry.test.ts`, `apps/web/test/youtube/channel-registry-actions.test.ts`

**Interfaces:**
- Consumes: o jsonb das funções da Task 2 (`serie_coletada: number`, status `'serie_coletada'`).
- Produces: `RemovalImpact.serieColetada: number`; `RemovalRpc` com `status: 'serie_coletada'`; `CHANNEL_TEXT.serieColetada`.

- [ ] **Step 1: Testes que falham**

Em `apps/web/test/youtube/channel-registry.test.ts`, no `describe` de `parseRemovalRpc` (procure por `parseRemovalRpc(`; reaproveite o objeto de impacto que o arquivo já usa como base, aqui chamado `BASE`):

```ts
  it('L1b: status serie_coletada traz o impacto com a contagem', () => {
    const r = parseRemovalRpc({ ...BASE, status: 'serie_coletada', serie_coletada: 71 })
    expect(r.status).toBe('serie_coletada')
    expect('impact' in r && r.impact.serieColetada).toBe(71)
  })

  it('L1b: banco antigo, sem a chave serie_coletada, ainda é entendido e vale 0', () => {
    const { serie_coletada: _fora, ...antigo } = { ...BASE, serie_coletada: 0 }
    const r = parseRemovalRpc({ ...antigo, status: 'ok' })
    expect(r.status).toBe('ok')
    expect('impact' in r && r.impact.serieColetada).toBe(0)
  })
```

Em `apps/web/test/youtube/channel-registry-actions.test.ts`, no `describe('removeYouTubeChannel')`, usando o `mk`, o `IMPACT` e o `input` que o arquivo já tem:

```ts
  it('L1b: série coletada recusa a remoção com o texto do runbook e não revalida nada', async () => {
    const t = mk({ ...IMPACT, status: 'serie_coletada', serie_coletada: 71 })
    expect(await (await t.load()).removeYouTubeChannel(input)).toEqual({
      ok: false,
      error: 'Este canal tem série coletada. Apagar a série é um passo manual, descrito no runbook.',
    })
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/channel-registry.test.ts test/youtube/channel-registry-actions.test.ts`
Expected: FAIL (`status` vira `'invalid'`; a action responde "Unexpected answer from the database").

- [ ] **Step 3: Implementar**

Em `channel-registry.ts`:

```ts
export interface RemovalImpact {
  // … campos existentes …
  /** Linhas da coleta (metadados diários, relatórios, jobs, tentativas) que apontam para o canal. Maior que zero impede a remoção. */
  serieColetada: number
  blockers: RemovalBlocker[]
}
```

```ts
const impactRow = z.object({
  status: z.enum(['ok', 'blocked', 'removed', 'serie_coletada']),
  name: z.string(),
  slug: z.string(),
  videos: count, comments: count, sync_logs: count, ab_tests: count, ab_drafts: count, analyses: count, tasks: count, notes: count,
  notifications: count, connections: count, pipeline_links: count,
  // Ausente quando o banco ainda não tem a migration do L1b: vale 0 (a função antiga não bloqueia por série).
  serie_coletada: count.default(0),
  blockers: z.array(z.object({ /* inalterado */ })),
})
export type RemovalRpc =
  | { status: 'ok' | 'blocked' | 'removed' | 'serie_coletada'; impact: RemovalImpact }
  | { status: 'not_found' | 'slug_mismatch' }
  | { status: 'invalid' }
```

No objeto `impact` devolvido por `parseRemovalRpc`, acrescente `serieColetada: r.serie_coletada,` antes de `blockers`.

Em `CHANNEL_TEXT`, depois de `removalUnavailable`:

```ts
  serieColetada: 'Este canal tem série coletada. Apagar a série é um passo manual, descrito no runbook.',
```

Em `channels.ts`, na função `removeYouTubeChannel`, depois da linha do `slug_mismatch` e antes da do `blocked`:

```ts
  if (res.status === 'serie_coletada') return { ok: false, error: CHANNEL_TEXT.serieColetada }
```

`getYouTubeChannelRemovalImpact` não muda: a função de impacto continua devolvendo `status: 'ok'`.

- [ ] **Step 4: Rodar**

Run: `cd apps/web && npx vitest run test/youtube/channel-registry.test.ts test/youtube/channel-registry-actions.test.ts && npx tsc --noEmit`
Expected: PASS; 0 erros. Se `tsc` acusar objeto `RemovalImpact` sem `serieColetada` em outro arquivo (fixtures de teste da tela), acrescente `serieColetada: 0` neles.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: canal com série coletada recusa a remoção com o texto do runbook" -- apps/web/src/lib/youtube/channel-registry.ts "apps/web/src/app/cms/(authed)/youtube/_actions/channels.ts" apps/web/test/youtube/channel-registry.test.ts apps/web/test/youtube/channel-registry-actions.test.ts
```

(Inclua no commit qualquer fixture que o `tsc` tenha obrigado a tocar.)

---

### Task 4: Aviso `reautorizar`

**Files:**
- Modify: `apps/web/src/lib/youtube/coleta/alerts.ts`
- Test: `apps/web/test/youtube/coleta/alerts.test.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces: `MotivoAviso` com `'reautorizar'`; `avisarSaida(ctx, ch, motivos = MOTIVOS_COM_SAIDA)`; `chaveAviso(id, 'reautorizar')` = `sync-analytics:<id>:reautorizar`.

- [ ] **Step 1: Testes que falham**

Acrescente em `alerts.test.ts` (o `canal` do arquivo precisa ganhar `collection_status: 'ok' as const, video_count: 1` — faça isso já, a Task 5 torna os campos obrigatórios):

```ts
describe('aviso reautorizar (L1b)', () => {
  beforeEach(() => {
    vi.mocked(getSiteOwners).mockResolvedValue(['u1'] as never)
    vi.mocked(fanOutToSiteAdmins).mockResolvedValue(1)
  })

  it('texto exato do spec, com o nome do canal', () => {
    expect(textoAviso('reautorizar', 'Canal Um')).toBe(
      'O canal Canal Um perdeu a autorização do YouTube. A coleta parou. Reconecte o canal em Configurações.',
    )
    expect(chaveAviso('ch-1', 'reautorizar')).toBe('sync-analytics:ch-1:reautorizar')
  })

  it('entrada: pede o carimbo de 7 dias e avisa uma vez', async () => {
    vi.mocked(claimAlert).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const { supabase } = novoBanco()
    const falhas: string[] = []
    await avisarEntrada({ supabase, falhas }, canal, 'reautorizar')
    await avisarEntrada({ supabase, falhas }, canal, 'reautorizar')
    expect(vi.mocked(claimAlert).mock.calls[0]).toEqual([supabase, 'sync-analytics:ch-1:reautorizar', '7 days'])
    expect(fanOutToSiteAdmins).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fanOutToSiteAdmins).mock.calls[0]![0]).toMatchObject({
      type: 'youtube.coleta_reautorizar', title: 'Canal do YouTube perdeu a autorização',
    })
    expect(falhas).toEqual([])
  })

  it('saída padrão NÃO olha o carimbo reautorizar; saída com a lista olha só ele', async () => {
    const chave = 'sync-analytics:ch-1:reautorizar'
    const a = novoBanco([chave])
    await avisarSaida({ supabase: a.supabase, falhas: [] }, canal)
    expect(a.lidas).not.toContain(chave)
    expect(fanOutToSiteAdmins).not.toHaveBeenCalled()

    const b = novoBanco([chave])
    await avisarSaida({ supabase: b.supabase, falhas: [] }, canal, ['reautorizar'])
    expect(b.lidas).toEqual([chave])
    expect(fanOutToSiteAdmins).toHaveBeenCalledTimes(1)
    expect(b.apagadas).toEqual([chave])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/coleta/alerts.test.ts`
Expected: FAIL (tipo `'reautorizar'` não existe; `avisarSaida` não aceita o terceiro parâmetro).

- [ ] **Step 3: Implementar**

Em `alerts.ts`:

```ts
export type MotivoAviso = 'api_nao_ativada' | 'sem_acesso' | 'tipo_indisponivel' | 'reautorizar'

/** Motivos da Reporting API que ganham aviso de saída quando a chamada volta a passar. `reautorizar` tem saída própria (autorizacao.ts). */
const MOTIVOS_COM_SAIDA: readonly MotivoAviso[] = ['api_nao_ativada', 'sem_acesso']

const JANELA: Record<MotivoAviso, string> = {
  api_nao_ativada: '7 days',
  sem_acesso: '7 days',
  tipo_indisponivel: '3650 days',
  reautorizar: '7 days',
}

const TITULO: Record<MotivoAviso | 'saida', string> = {
  api_nao_ativada: 'YouTube Reporting API não ativada',
  sem_acesso: 'YouTube recusou o acesso aos relatórios',
  tipo_indisponivel: 'Relatório de alcance indisponível',
  reautorizar: 'Canal do YouTube perdeu a autorização',
  saida: 'Coleta do YouTube voltou ao normal',
}
```

No `switch` de `textoAviso`, antes de `case 'saida'`:

```ts
    case 'reautorizar':
      return `O canal ${nome} perdeu a autorização do YouTube. A coleta parou. Reconecte o canal em Configurações.`
```

`avisarSaida` ganha o parâmetro e usa-o no laço:

```ts
export async function avisarSaida(ctx: Ctx, ch: ColetaChannel, motivos: readonly MotivoAviso[] = MOTIVOS_COM_SAIDA): Promise<void> {
  try {
    const abertas: string[] = []
    for (const motivo of motivos) {
      const chave = chaveAviso(ch.id, motivo)
      if ((await carimboExiste(ctx, chave)) === 'sim') abertas.push(chave)
    }
    // … o resto fica igual …
```

- [ ] **Step 4: Rodar**

Run: `cd apps/web && npx vitest run test/youtube/coleta/alerts.test.ts`
Expected: PASS (todos os anteriores e os 3 novos).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: aviso de canal que perdeu a autorização do YouTube, com saída própria" -- apps/web/src/lib/youtube/coleta/alerts.ts apps/web/test/youtube/coleta/alerts.test.ts
```

---

### Task 5: Estado de autorização (`google-erro.ts`, `autorizacao.ts`, tipos)

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/google-erro.ts`
- Create: `apps/web/src/lib/youtube/coleta/autorizacao.ts`
- Modify: `apps/web/src/lib/youtube/coleta/types.ts:13-19`
- Modify: `apps/web/src/lib/youtube/reporting/client.ts:44-55` (passa a importar `motivoDoGoogle`)
- Test: `apps/web/test/youtube/coleta/google-erro.test.ts`, `apps/web/test/youtube/coleta/autorizacao.test.ts`
- Modify (fixtures): todo teste de `apps/web/test/youtube/coleta/` que monta um canal

**Interfaces:**
- Consumes: `avisarEntrada`, `avisarSaida(ctx, ch, ['reautorizar'])` da Task 4; `registrarTentativa`; `comPrazo`, `restante`, `SemTempoError`; `ensureFreshToken`, `TokenRevokedError`, `NoActiveConnectionError`.
- Produces: as assinaturas do bloco "Nomes compartilhados". Regras:
  - `classificarErroDeToken`: `TokenRevokedError` → `'reautorizar'`; `NoActiveConnectionError` com linha em `social_connections` (`site_id`, `provider = 'youtube'`, `account_id = c.channel_id`, `revoked_at` não nulo) → `'reautorizar'`; sem essa linha → `'sem_conexao'`; leitura que falha → `'outro'` (e a falha de banco entra em `ctx.falhas`); qualquer outro erro → `'outro'`.
  - `marcarReautorizar`: grava `collection_status = 'reautorizar'` (só se ainda não estiver), muda `c.collection_status` em memória e chama `avisarEntrada(ctx, c, 'reautorizar')`. Se a gravação falhar, não avisa e não muda a memória. Nunca lança.
  - `marcarAutorizado`: grava `authorization_verified_at = agora`; se `c.collection_status === 'reautorizar'`, grava também `collection_status = 'ok'`, muda a memória e chama `avisarSaida(ctx, c, ['reautorizar'])`. Nunca lança.
  - `obterToken`: devolve o token; devolve `null` depois de registrar a tentativa (`sem_autorizacao` para `'reautorizar'`, `sem_conexao` para `'sem_conexao'`); relança `SemTempoError` e todo erro de classe `'outro'`. Token obtido num canal em `reautorizar` chama `marcarAutorizado`.

- [ ] **Step 1: Tipos**

Em `types.ts`:

```ts
/** Linha de `youtube_channels` como a coleta lê. `id` é o uuid; `channel_id` é o UC… do YouTube. */
export interface ColetaChannel {
  id: string
  channel_id: string
  site_id: string
  name: string
  sync_enabled: boolean
  /** `reautorizar` = o canal perdeu a autorização: a coleta por token para até o dono reconectar. */
  collection_status: 'ok' | 'reautorizar'
  /** O que o YouTube informou no último sync do canal. Nulo = não sabemos. */
  video_count: number | null
}
```

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -40`
Expected: erros nos testes que montam um canal sem os dois campos. Em cada um, acrescente `collection_status: 'ok' as const, video_count: 1` ao objeto do canal (procure com `grep -rln "sync_enabled: true" apps/web/test/youtube/coleta apps/web/test/api/cron apps/web/test/cron`). Não mude nenhuma asserção.

- [ ] **Step 2: Teste de `google-erro.ts` (falha)**

`apps/web/test/youtube/coleta/google-erro.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { ehPerdaDeAutorizacao, motivoDoGoogle } from '@/lib/youtube/coleta/google-erro'

const resposta = (corpo: unknown, status = 403) =>
  new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status })

describe('google-erro', () => {
  it('motivoDoGoogle lê o formato antigo (errors[]) e o novo (details[])', async () => {
    expect(await motivoDoGoogle(resposta({ error: { errors: [{ reason: 'insufficientPermissions' }] } }))).toBe('insufficientPermissions')
    expect(await motivoDoGoogle(resposta({ error: { details: [{}, { reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] } }))).toBe('ACCESS_TOKEN_SCOPE_INSUFFICIENT')
  })

  it('motivoDoGoogle devolve nulo para corpo vazio, não-JSON ou sem reason', async () => {
    expect(await motivoDoGoogle(resposta(''))).toBeNull()
    expect(await motivoDoGoogle(resposta('<html>'))).toBeNull()
    expect(await motivoDoGoogle(resposta({ error: { message: 'x' } }))).toBeNull()
  })

  it.each([
    [401, null, true],
    [401, 'qualquer', true],
    [403, 'insufficientPermissions', true],
    [403, 'ACCESS_TOKEN_SCOPE_INSUFFICIENT', true],
    [403, 'quotaExceeded', false],
    [403, null, false],
    [500, null, false],
    [404, 'insufficientPermissions', false],
  ])('ehPerdaDeAutorizacao(%s, %s) = %s', (status, reason, esperado) => {
    expect(ehPerdaDeAutorizacao(status, reason)).toBe(esperado)
  })
})
```

Run: `cd apps/web && npx vitest run test/youtube/coleta/google-erro.test.ts` → Expected: FAIL (módulo não existe).

- [ ] **Step 3: `google-erro.ts`**

```ts
// Leitura do erro das APIs do Google. Puro: sem banco e sem token. O corpo nunca é guardado nem logado.

/** Lê só o `reason` do erro (formato antigo `errors[]` e novo `details[]`). */
export async function motivoDoGoogle(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as {
      error?: { errors?: Array<{ reason?: string }>; details?: Array<{ reason?: string }> }
    }
    return body.error?.errors?.find(e => e.reason)?.reason ?? body.error?.details?.find(d => d.reason)?.reason ?? null
  } catch {
    return null
  }
}

/**
 * A resposta diz que o canal perdeu a autorização (spec, seção 6): 401, ou 403 por permissão insuficiente.
 * Vale para a Analytics API e a Data API. A Reporting API tem estado próprio (`sem_acesso`) e NÃO passa por aqui.
 */
export function ehPerdaDeAutorizacao(status: number, reason: string | null): boolean {
  if (status === 401) return true
  return status === 403 && (reason === 'insufficientPermissions' || reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT')
}
```

Em `reporting/client.ts`, apague a função local `motivoDoErro` (linhas 44-55) e importe `motivoDoGoogle` de `@/lib/youtube/coleta/google-erro`, trocando as chamadas. Nenhum outro comportamento muda.

Run: `cd apps/web && npx vitest run test/youtube/coleta/google-erro.test.ts test/youtube/coleta/reporting-client.test.ts` → Expected: PASS.

- [ ] **Step 4: Teste de `autorizacao.ts` (falha)**

`apps/web/test/youtube/coleta/autorizacao.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(),
}))
vi.mock('@/lib/youtube/coleta/alerts', () => ({ avisarEntrada: vi.fn(), avisarSaida: vi.fn() }))

import { classificarErroDeToken, marcarAutorizado, marcarReautorizar, obterToken } from '@/lib/youtube/coleta/autorizacao'
import { SemTempoError } from '@/lib/youtube/coleta/clock'
import { avisarEntrada, avisarSaida } from '@/lib/youtube/coleta/alerts'
import { ensureFreshToken, NoActiveConnectionError, TokenRevokedError } from '@/lib/social/token-refresh'
import type { ColetaChannel, StepCtx } from '@/lib/youtube/coleta/types'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'

const canal = (extra: Partial<ColetaChannel> = {}): ColetaChannel => ({
  id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true,
  collection_status: 'ok', video_count: 1, ...extra,
})
const linhaCanal = (extra: Row = {}): Row => ({ id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', collection_status: 'ok', authorization_verified_at: null, ...extra })
const conexao = (extra: Row = {}): Row => ({ id: 'c1', site_id: 'site-1', provider: 'youtube', account_id: 'UC1', revoked_at: null, ...extra })
const ctxDe = (db: FakeDb, prazoMs = 30_000): StepCtx => ({ supabase: db.client, channels: [], deadline: Date.now() + prazoMs, falhas: [], tentativas: [] })
const base = { site_id: 'site-1', scope_type: 'canal' as const, scope_id: 'ch-1', kind: 'sondagem' as const, channel_id: 'ch-1' }
const semConexao = () => new NoActiveConnectionError('youtube', 'site-1')

beforeEach(() => { vi.clearAllMocks() })

describe('classificarErroDeToken', () => {
  it('token revogado → reautorizar, sem ler o banco', async () => {
    const db = fakeSupabase()
    expect(await classificarErroDeToken(ctxDe(db), canal(), new TokenRevokedError('youtube', 'c1'))).toBe('reautorizar')
  })

  it('sem conexão, com conexão revogada deste canal → reautorizar', async () => {
    const db = fakeSupabase({ social_connections: [conexao({ revoked_at: '2026-10-01T00:00:00.000Z' })] })
    expect(await classificarErroDeToken(ctxDe(db), canal(), semConexao())).toBe('reautorizar')
  })

  it('sem conexão e nenhuma conexão revogada → sem_conexao', async () => {
    const db = fakeSupabase({ social_connections: [] })
    expect(await classificarErroDeToken(ctxDe(db), canal(), semConexao())).toBe('sem_conexao')
  })

  it('conexão revogada de OUTRO canal, de outro site ou de outro provedor não conta', async () => {
    const db = fakeSupabase({ social_connections: [
      conexao({ account_id: 'UC2', revoked_at: '2026-10-01T00:00:00.000Z' }),
      conexao({ site_id: 'site-2', revoked_at: '2026-10-01T00:00:00.000Z' }),
      conexao({ provider: 'instagram', revoked_at: '2026-10-01T00:00:00.000Z' }),
    ] })
    expect(await classificarErroDeToken(ctxDe(db), canal(), semConexao())).toBe('sem_conexao')
  })

  it('leitura das conexões falha → outro, e a falha de banco fica visível (não vira "sem conexão")', async () => {
    const db = fakeSupabase()
    db.errors.social_connections = { code: '57014', message: 'timeout' }
    const ctx = ctxDe(db)
    expect(await classificarErroDeToken(ctx, canal(), semConexao())).toBe('outro')
    expect(ctx.falhas).toEqual(['erro de banco ao ler social_connections'])
  })

  it('erro qualquer → outro', async () => {
    expect(await classificarErroDeToken(ctxDe(fakeSupabase()), canal(), new Error('rede'))).toBe('outro')
  })
})

describe('marcarReautorizar / marcarAutorizado', () => {
  it('marcarReautorizar grava o estado, muda a memória e avisa', async () => {
    const db = fakeSupabase({ youtube_channels: [linhaCanal()] })
    const c = canal()
    await marcarReautorizar(ctxDe(db), c)
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'reautorizar' })
    expect(c.collection_status).toBe('reautorizar')
    expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), c, 'reautorizar')
  })

  it('canal que já está em reautorizar não é regravado, mas o lembrete é pedido', async () => {
    const db = fakeSupabase({ youtube_channels: [linhaCanal({ collection_status: 'reautorizar' })] })
    await marcarReautorizar(ctxDe(db), canal({ collection_status: 'reautorizar' }))
    expect(db.writes.filter(w => w.table === 'youtube_channels')).toEqual([])
    expect(avisarEntrada).toHaveBeenCalledTimes(1)
  })

  it('migration não aplicada (coluna ausente): schema_ausente, sem aviso e memória inalterada', async () => {
    const db = fakeSupabase({ youtube_channels: [linhaCanal()] })
    db.writeErrors.youtube_channels = { code: 'PGRST204', message: 'coluna' }
    const ctx = ctxDe(db)
    const c = canal()
    await marcarReautorizar(ctx, c)
    expect(ctx.falhas).toEqual(['schema_ausente: youtube_channels'])
    expect(c.collection_status).toBe('ok')
    expect(avisarEntrada).not.toHaveBeenCalled()
  })

  it('marcarAutorizado num canal ok só grava authorization_verified_at', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-08T12:00:00.000Z'), toFake: ['Date'] })
    try {
      const db = fakeSupabase({ youtube_channels: [linhaCanal()] })
      await marcarAutorizado(ctxDe(db), canal())
      expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'ok', authorization_verified_at: '2026-10-08T12:00:00.000Z' })
      expect(avisarSaida).not.toHaveBeenCalled()
    } finally { vi.useRealTimers() }
  })

  it('marcarAutorizado num canal em reautorizar volta a ok e pede a saída do aviso reautorizar', async () => {
    const db = fakeSupabase({ youtube_channels: [linhaCanal({ collection_status: 'reautorizar' })] })
    const c = canal({ collection_status: 'reautorizar' })
    await marcarAutorizado(ctxDe(db), c)
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'ok' })
    expect(c.collection_status).toBe('ok')
    expect(avisarSaida).toHaveBeenCalledWith(expect.anything(), c, ['reautorizar'])
  })
})

describe('obterToken', () => {
  it('token bom: devolve o token e não grava tentativa', async () => {
    vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' })
    const db = fakeSupabase({ youtube_channels: [linhaCanal()] })
    const ctx = ctxDe(db)
    expect(await obterToken(ctx, canal(), base)).toBe('tok')
    expect(ensureFreshToken).toHaveBeenCalledWith('site-1', 'youtube', 'UC1')
    expect(db.tables.yt_own_collection_attempts ?? []).toEqual([])
  })

  it('token revogado: reautorizar no banco, tentativa sem_autorizacao, devolve null', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new TokenRevokedError('youtube', 'c1'))
    const db = fakeSupabase({ youtube_channels: [linhaCanal()] })
    const ctx = ctxDe(db)
    const c = canal()
    expect(await obterToken(ctx, c, base)).toBeNull()
    expect(c.collection_status).toBe('reautorizar')
    expect(db.tables.yt_own_collection_attempts![0]).toMatchObject({ outcome: 'sem_autorizacao', scope_id: 'ch-1', kind: 'sondagem' })
    expect(ctx.falhas).toEqual([])
  })

  it('sem conexão e sem conexão revogada: tentativa sem_conexao, nenhum aviso, estado inalterado', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(semConexao())
    const db = fakeSupabase({ youtube_channels: [linhaCanal()], social_connections: [] })
    const ctx = ctxDe(db)
    const c = canal()
    expect(await obterToken(ctx, c, base)).toBeNull()
    expect(c.collection_status).toBe('ok')
    expect(db.tables.yt_own_collection_attempts![0]).toMatchObject({ outcome: 'sem_conexao' })
    expect(avisarEntrada).not.toHaveBeenCalled()
  })

  it('canal em reautorizar cujo token volta a passar: volta a ok sozinho', async () => {
    vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' })
    const db = fakeSupabase({ youtube_channels: [linhaCanal({ collection_status: 'reautorizar' })] })
    const c = canal({ collection_status: 'reautorizar' })
    expect(await obterToken(ctxDe(db), c, base)).toBe('tok')
    expect(c.collection_status).toBe('ok')
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'ok' })
  })

  it('erro de rede no refresh: relança (falha do passo), estado inalterado, nenhuma tentativa de pulo', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new Error('Google token refresh failed (500)'))
    const db = fakeSupabase({ youtube_channels: [linhaCanal()] })
    const c = canal()
    await expect(obterToken(ctxDe(db), c, base)).rejects.toThrow('Google token refresh failed')
    expect(c.collection_status).toBe('ok')
    expect(db.tables.yt_own_collection_attempts ?? []).toEqual([])
  })

  it('prazo do passo vencido: SemTempoError, sem tocar no estado', async () => {
    vi.mocked(ensureFreshToken).mockReturnValue(new Promise(() => undefined))
    const db = fakeSupabase({ youtube_channels: [linhaCanal()] })
    await expect(obterToken(ctxDe(db, 0), canal(), base)).rejects.toBeInstanceOf(SemTempoError)
  })
})
```

O banco em memória precisa de chave única para `youtube_channels` só se algum teste usar `upsert`; aqui só há `update`. Se `fakeSupabase` recusar `update` numa tabela sem chave declarada, passe `{ ...CHAVES_UNICAS_L1A, youtube_channels: [['id']] }` como segundo argumento.

Run: `cd apps/web && npx vitest run test/youtube/coleta/autorizacao.test.ts` → Expected: FAIL (módulo não existe).

- [ ] **Step 5: `autorizacao.ts`**

```ts
// Estado de autorização do canal (spec, seção 6, "Autorização" — lote L1b).
// `reautorizar` = o canal perdeu a autorização do YouTube: a coleta por token para, nada é apagado e o dono é
// avisado. Volta a `ok` sozinho quando o token volta a passar, ou pelo callback do OAuth.
import { ensureFreshToken, NoActiveConnectionError, TokenRevokedError } from '@/lib/social/token-refresh'
import { avisarEntrada, avisarSaida } from './alerts'
import { registrarTentativa } from './attempts'
import { comPrazo, restante, SemTempoError } from './clock'
import { conferirBanco, type ErroBanco } from './schema'
import type { ColetaChannel, StepCtx, Tentativa } from './types'

type CtxAut = Pick<StepCtx, 'supabase' | 'falhas' | 'tentativas'>
export type ClasseToken = 'reautorizar' | 'sem_conexao' | 'outro'

/**
 * O que um erro de `ensureFreshToken` significa para a coleta.
 * O caso comum de revogação é o SEGUNDO dia: o token revogado marca a conexão antes de lançar, e dali em diante só
 * aparece "sem conexão". Por isso "sem conexão" com uma conexão revogada deste canal também é `reautorizar`.
 * Leitura que falha não é "sem conexão revogada": devolve `outro` e a falha de banco fica em `falhas`.
 */
export async function classificarErroDeToken(ctx: CtxAut, c: ColetaChannel, e: unknown): Promise<ClasseToken> {
  if (e instanceof TokenRevokedError) return 'reautorizar'
  if (!(e instanceof NoActiveConnectionError)) return 'outro'
  let r: { data: unknown; error: ErroBanco | null }
  try {
    r = await ctx.supabase
      .from('social_connections')
      .select('id')
      .eq('site_id', c.site_id)
      .eq('provider', 'youtube')
      .eq('account_id', c.channel_id)
      .not('revoked_at', 'is', null)
      .limit(1)
  } catch {
    r = { data: null, error: { code: null, message: 'leitura lançou' } }
  }
  if (conferirBanco(r, 'social_connections', ctx.falhas, 'ler') !== 'ok') return 'outro'
  return ((r.data ?? []) as unknown[]).length > 0 ? 'reautorizar' : 'sem_conexao'
}

async function gravarCanal(ctx: CtxAut, c: ColetaChannel, patch: Record<string, unknown>): Promise<boolean> {
  let r: { error: ErroBanco | null }
  try {
    r = await ctx.supabase.from('youtube_channels').update(patch).eq('id', c.id)
  } catch {
    r = { error: { code: null, message: 'update lançou' } }
  }
  return conferirBanco(r, 'youtube_channels', ctx.falhas) === 'ok'
}

/** Marca o canal e avisa (entrada, e lembrete a cada 7 dias). Se a gravação falhar, nada mais acontece. Nunca lança. */
export async function marcarReautorizar(ctx: CtxAut, c: ColetaChannel): Promise<void> {
  if (c.collection_status !== 'reautorizar') {
    if (!(await gravarCanal(ctx, c, { collection_status: 'reautorizar' }))) return
    c.collection_status = 'reautorizar'
  }
  await avisarEntrada(ctx, c, 'reautorizar')
}

/** Uma chamada autenticada passou: carimba a data e, se o canal estava em `reautorizar`, devolve-o a `ok`. Nunca lança. */
export async function marcarAutorizado(ctx: CtxAut, c: ColetaChannel): Promise<void> {
  const voltou = c.collection_status === 'reautorizar'
  const patch: Record<string, unknown> = { authorization_verified_at: new Date().toISOString() }
  if (voltou) patch.collection_status = 'ok'
  if (!(await gravarCanal(ctx, c, patch))) return
  if (!voltou) return
  c.collection_status = 'ok'
  await avisarSaida(ctx, c, ['reautorizar'])
}

/**
 * O token do canal para um passo. `null` = o canal foi pulado e a tentativa já está registrada
 * (`sem_autorizacao` quando perdeu a autorização, `sem_conexao` quando nunca foi conectado).
 * Lança `SemTempoError` quando o prazo do passo acaba, e relança qualquer outro erro (falha do passo, estado inalterado).
 */
export async function obterToken(
  ctx: StepCtx,
  c: ColetaChannel,
  base: Omit<Tentativa, 'outcome' | 'http_status' | 'error'>,
): Promise<string | null> {
  let token: string
  try {
    const t = await comPrazo(ensureFreshToken(c.site_id, 'youtube', c.channel_id), ctx.deadline)
    if (!t) {
      if (restante(ctx.deadline) <= 0) throw new SemTempoError()
      throw new Error('token refresh timed out')
    }
    token = t.accessToken
  } catch (e) {
    if (e instanceof SemTempoError) throw e
    const classe = await classificarErroDeToken(ctx, c, e)
    if (classe === 'outro') throw e
    if (classe === 'reautorizar') await marcarReautorizar(ctx, c)
    await registrarTentativa(ctx, { ...base, outcome: classe === 'reautorizar' ? 'sem_autorizacao' : 'sem_conexao' })
    return null
  }
  // O token voltou a passar num canal marcado: o estado volta a `ok` sem esperar o OAuth.
  if (c.collection_status === 'reautorizar') await marcarAutorizado(ctx, c)
  return token
}
```

- [ ] **Step 6: Rodar**

Run: `cd apps/web && npx vitest run test/youtube/coleta && npx tsc --noEmit`
Expected: PASS em toda a pasta (os testes antigos só ganharam os dois campos na fixture); 0 erros de tipo.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/youtube/coleta/google-erro.ts apps/web/src/lib/youtube/coleta/autorizacao.ts apps/web/test/youtube/coleta/google-erro.test.ts apps/web/test/youtube/coleta/autorizacao.test.ts
git commit -m "feat: estado de autorização do canal na coleta (reautorizar, volta a ok e token por passo)" -- apps/web/src/lib/youtube/coleta apps/web/src/lib/youtube/reporting/client.ts apps/web/test/youtube/coleta apps/web/test/api/cron apps/web/test/cron
```

Antes de commitar, rode `git status --short` e confirme que os caminhos do commit só trazem arquivos desta tarefa (outro terminal pode ter arquivos abertos nas mesmas pastas; nesse caso liste os arquivos um a um).

---

### Task 6: Passos 1A e 1C, critérios e `rodarColeta` com o estado novo

**Files:**
- Modify: `apps/web/src/lib/youtube/coleta/token.ts:18-31` (remove `registrarSemConexao`)
- Modify: `apps/web/src/lib/youtube/coleta/jobs-step.ts:223-236`
- Modify: `apps/web/src/lib/youtube/coleta/reports-step.ts:295-302`
- Modify: `apps/web/src/lib/youtube/coleta/criteria.ts:230-246`
- Modify: `apps/web/src/lib/youtube/coleta/index.ts`
- Test: `apps/web/test/youtube/coleta/{token,jobs-step,reports-step,criteria,index}.test.ts`

**Interfaces:**
- Consumes: `obterToken` (Task 5).
- Produces, no `resumo` de `rodarColeta`:
  - `ms: Record<string, number>` — milissegundos de cada passo que rodou na fase (`metadados`, `jobs` na fase `'antes'`; `relatorios` na `'depois'`);
  - `reautorizar: string[]` — `youtube_channels.id` dos canais em `reautorizar` ao fim da fase;
  - `acao_do_dono` passa a incluir `"<nome>: reautorizar"` e `"<nome>: o YouTube informa <n> vídeo(s) e nenhum está cadastrado"`.
  - A leitura de canais passa a ser `id, channel_id, site_id, name, sync_enabled, collection_status, video_count`.

- [ ] **Step 1: Testes que falham**

Em `token.test.ts`: apague o bloco `it.each` de `registrarSemConexao` e o teste seguinte que o usa, e tire `registrarSemConexao` do import.

Em `jobs-step.test.ts` (o arquivo já mocka `ensureFreshToken`), acrescente:

```ts
describe('passoJobs: autorização (L1b)', () => {
  it('token revogado: canal vira reautorizar, tentativa sem_autorizacao, nenhuma falha crítica e nenhuma chamada à Reporting API', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new TokenRevokedError('youtube', 'c1'))
    const db = fakeSupabase({ youtube_channels: [{ id: 'ch-1', collection_status: 'ok' }] })
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(resumo.tentativas).toEqual({ sem_autorizacao: 1 })
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'reautorizar' })
    expect(ctx.channels[0]!.collection_status).toBe('reautorizar')
    expect(ctx.falhas).toEqual([])
    expect(db.tables.yt_reporting_jobs ?? []).toEqual([])
  })

  it('sem conexão e sem conexão revogada: sem_conexao, estado ok', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new NoActiveConnectionError('youtube', 'site-1'))
    const db = fakeSupabase({ youtube_channels: [{ id: 'ch-1', collection_status: 'ok' }], social_connections: [] })
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(resumo.tentativas).toEqual({ sem_conexao: 1 })
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'ok' })
  })

  it('401 da Reporting API não muda collection_status (é sem_acesso do job, e só isso)', async () => {
    vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' })
    // Reaproveite o helper do arquivo que faz a Reporting API responder com um status (procure por `401` nos testes
    // existentes de `sem_acesso`) e monte o mesmo cenário aqui.
    const db = fakeSupabase({ youtube_channels: [{ id: 'ch-1', collection_status: 'ok' }] })
    const ctx = ctxDe(db)
    await rodarComReporting401(ctx)
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'ok' })
    expect(ctx.channels[0]!.collection_status).toBe('ok')
  })
})
```

`rodarComReporting401` é o nome que este plano dá ao trecho de preparação que o teste existente de `sem_acesso` já tem: extraia-o para uma função local com esse nome em vez de copiar. Se o teste antigo de "canal sem conexão é pulado" esperava `{ sem_conexao: 1 }` para `TokenRevokedError`, ele passa a esperar `{ sem_autorizacao: 1 }`: atualize a asserção e o título.

Em `reports-step.test.ts`, o mesmo par (revogado → `sem_autorizacao` e `reautorizar`; sem conexão → `sem_conexao`), com `kind: 'relatorio'`:

```ts
describe('passoRelatorios: autorização (L1b)', () => {
  it('token revogado: reautorizar, tentativa sem_autorizacao de escopo canal, nada listado', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new TokenRevokedError('youtube', 'c1'))
    const db = fakeSupabase({
      youtube_channels: [{ id: 'ch-1', collection_status: 'ok' }],
      yt_reporting_jobs: [jobAtivo('channel_reach_basic_a1')],
    })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(db.tables.yt_own_collection_attempts!.find(t => t.scope_type === 'canal')).toMatchObject({ outcome: 'sem_autorizacao', kind: 'relatorio' })
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'reautorizar' })
    expect(resumo.vistos).toBe(0)
    expect(ctx.falhas).toEqual([])
  })
})
```

(`jobAtivo` é o construtor de linha de `yt_reporting_jobs` que o arquivo já usa; use o nome que estiver lá.)

Em `criteria.test.ts`, no bloco dos jobs de alcance sem relatório novo:

```ts
  it('L1b: canal com tentativa sem_autorizacao hoje não vira falha nem "sem conexão" (a nota reautorizar vem de rodarColeta)', async () => {
    // Mesmo cenário do teste "canal sem conexão vai para acao_do_dono", trocando o outcome da tentativa de hoje.
    const db = semRelatorioNovoHa7Dias({ outcomeHoje: 'sem_autorizacao' })
    const ctx = ctxDe(db)
    const r = await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual([])
    expect(r.acao_do_dono ?? []).toEqual([])
  })
```

(`semRelatorioNovoHa7Dias` é o nome para a preparação que o teste vizinho já faz: extraia-a para uma função com o parâmetro `outcomeHoje`, padrão `'sem_conexao'`.)

Em `index.test.ts`:

```ts
describe('rodarColeta: L1b', () => {
  it('lê collection_status e video_count; resumo traz ms por passo e os canais em reautorizar', async () => {
    const db = fakeSupabase({
      youtube_channels: [
        { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true, collection_status: 'reautorizar', video_count: 0 },
        { id: 'ch-2', channel_id: 'UC2', site_id: 'site-1', name: 'Canal Dois', sync_enabled: true, collection_status: 'ok', video_count: 0 },
      ],
    })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(r.resumo.reautorizar).toEqual(['ch-1'])
    expect(r.resumo.acao_do_dono).toContain('Canal Um: reautorizar')
    expect(Object.keys(r.resumo.ms as object).sort()).toEqual(['jobs', 'metadados'])
    for (const v of Object.values(r.resumo.ms as Record<string, number>)) expect(v).toBeGreaterThanOrEqual(0)
  })

  it('canal que o YouTube diz ter vídeos e não tem nenhum cadastrado vai para acao_do_dono; canal vazio de verdade não', async () => {
    const db = fakeSupabase({
      youtube_channels: [
        { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Com Vídeos', sync_enabled: true, collection_status: 'ok', video_count: 12 },
        { id: 'ch-2', channel_id: 'UC2', site_id: 'site-1', name: 'Vazio', sync_enabled: true, collection_status: 'ok', video_count: 0 },
        { id: 'ch-3', channel_id: 'UC3', site_id: 'site-1', name: 'Desconhecido', sync_enabled: true, collection_status: 'ok', video_count: null },
      ],
      youtube_videos: [],
    })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(r.resumo.acao_do_dono).toEqual(['Com Vídeos: o YouTube informa 12 vídeo(s) e nenhum está cadastrado'])
  })

  it('migration não aplicada (coluna collection_status ausente): schema_ausente e nenhum passo novo roda', async () => {
    const db = fakeSupabase({ youtube_channels: [] })
    db.errors.youtube_channels = { code: '42703', message: 'column youtube_channels.collection_status does not exist' }
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(r.falhas).toEqual(['schema_ausente: youtube_channels'])
    expect(r.resumo).toEqual({})
  })
})
```

O arquivo já mocka os passos ou os deixa rodar contra o banco em memória; siga o que ele faz (se mocka `passoMetadados`/`passoJobs`, mantenha). `ensureFreshToken` deve estar mockado rejeitando com `NoActiveConnectionError` nesses testes.

Run: `cd apps/web && npx vitest run test/youtube/coleta/token.test.ts test/youtube/coleta/jobs-step.test.ts test/youtube/coleta/reports-step.test.ts test/youtube/coleta/criteria.test.ts test/youtube/coleta/index.test.ts`
Expected: FAIL nos testes novos.

- [ ] **Step 2: `token.ts`**

Apague `registrarSemConexao` e os imports que só ela usava (`NoActiveConnectionError`, `TokenRevokedError`, `registrarTentativa`, `StepCtx`, `Tentativa`). Fica só `HABILITADOS`, `statusHttp` e `descreverErro`.

- [ ] **Step 3: `jobs-step.ts`**

Troque o bloco das linhas 223-236 (o `let token` e o `try/catch` em volta de `ensureFreshToken`) por:

```ts
      // Canal que perdeu a autorização ou nunca foi conectado: pulado, com a tentativa registrada por obterToken.
      const token = await obterToken(ctx, c, tCanal)
      if (token === null) continue
```

Imports: sai `ensureFreshToken` e `registrarSemConexao`; entra `import { obterToken } from './autorizacao'`. `comPrazo` sai do import de `./clock` se não for mais usado no arquivo.

- [ ] **Step 4: `reports-step.ts`**

Troque o bloco das linhas 295-302 por:

```ts
      const token = await obterToken(ctx, c, tCanal(c))
      if (token === null) continue
```

Mesmo ajuste de imports.

- [ ] **Step 5: `criteria.ts`**

No trecho das linhas 230-246:

```ts
  // Canal sem token hoje (nunca conectado, ou perdeu a autorização): o passo de relatórios não lista, então
  // "sem relatório novo" é consequência, não parada. Nunca vai para falhas. "Sem conexão" vira nota de
  // acao_do_dono aqui; "perdeu a autorização" já sai como "<canal>: reautorizar" em rodarColeta.
  const canaisSemNovo = [...new Set(semNovo.map(j => j.channel_id))]
  const sc = await ctx.supabase
    .from('yt_own_collection_attempts')
    .select('scope_id, outcome')
    .eq('scope_type', 'canal')
    .eq('kind', 'relatorio')
    .eq('attempt_day', utcDay(new Date()))
    .in('outcome', ['sem_conexao', 'sem_autorizacao'])
    .in('scope_id', canaisSemNovo)
    .limit(LIMITE_LEITURA)
  if (!leituraOk(sc, 'yt_own_collection_attempts', 'jobs de alcance sem relatório novo', ctx.falhas)) return out
  const semToken = (sc.data ?? []) as Array<{ scope_id: string; outcome: string }>
  const semConexao = new Set(semToken.map(l => l.scope_id))
  const semAutorizacao = new Set(semToken.filter(l => l.outcome === 'sem_autorizacao').map(l => l.scope_id))
  for (const id of canaisSemNovo) {
    if (semConexao.has(id) && !semAutorizacao.has(id)) out.acao_do_dono!.push(`${nome(id)}: sem conexão com o YouTube`)
  }
```

O laço seguinte (`if (semConexao.has(j.channel_id)) continue`) fica como está: `semConexao` agora cobre os dois resultados.

- [ ] **Step 6: `index.ts`**

(a) A leitura:

```ts
    lidos = await ctx.supabase.from('youtube_channels').select('id, channel_id, site_id, name, sync_enabled, collection_status, video_count')
```

e o comentário acima dela perde o "(L1a: ainda não existe collection_status.)".

(b) Tempos por passo. Logo depois de `const base = …`:

```ts
  const ms: Record<string, number> = {}
```

e no `passo`, envolvendo o corpo:

```ts
    const t0 = Date.now()
    try {
      // … corpo atual, inalterado …
    } catch (e) {
      falhou(nome, e)
      return undefined
    } finally {
      ms[nome] = Date.now() - t0
    }
```

(c) Notas de "ação do dono" que vêm do estado dos canais. Antes de `const ativos = …`:

```ts
  /** Os passos mudam `collection_status` em memória: lido no fim de cada fase. */
  const emReautorizar = (): ColetaChannel[] => channels.filter(c => c.collection_status === 'reautorizar')

  /** O YouTube diz que o canal tem vídeos e nenhum está cadastrado: a lista de vídeos nunca sincronizou. Canal vazio de verdade (0) e desconhecido (nulo) ficam de fora. */
  const semVideosCadastrados = async (): Promise<string[]> => {
    const notas: string[] = []
    for (const c of channels) {
      if (!c.video_count || c.video_count <= 0) continue
      const cont = await ctx.supabase.from('youtube_videos').select('id', { count: 'exact', head: true }).eq('channel_id', c.id)
      if (conferirBanco(cont, 'youtube_videos', falhas, 'ler') !== 'ok') continue
      if ((cont.count ?? 0) === 0) notas.push(`${c.name}: o YouTube informa ${c.video_count} vídeo(s) e nenhum está cadastrado`)
    }
    return notas
  }
```

(d) Fim da fase `'antes'` (substitui as duas últimas linhas do bloco):

```ts
    let semVideos: string[] = []
    try {
      semVideos = await semVideosCadastrados()
    } catch (e) {
      falhou('canais', e)
    }
    resumo.acao_do_dono = [...new Set([
      ...((resumo.jobs as Partial<JobsResumo> | undefined)?.acao_do_dono ?? []),
      ...emReautorizar().map(c => `${c.name}: reautorizar`),
      ...semVideos,
    ])]
    resumo.reautorizar = emReautorizar().map(c => c.id)
    resumo.ms = ms
    return { falhas, resumo }
```

(e) Fim da fase `'depois'` (antes do `return` final):

```ts
  resumo.acao_do_dono = [...new Set([
    ...((resumo.acao_do_dono as string[] | undefined) ?? []),
    ...emReautorizar().map(c => `${c.name}: reautorizar`),
  ])]
  resumo.reautorizar = emReautorizar().map(c => c.id)
  resumo.ms = ms
```

- [ ] **Step 7: Rodar**

Run: `cd apps/web && npx vitest run test/youtube/coleta && npx tsc --noEmit`
Expected: PASS; 0 erros. O teste `tres-dias.test.ts` roda os passos de verdade: se ele esperava `sem_conexao` para um canal revogado, a asserção passa a `sem_autorizacao` (e só ela).

- [ ] **Step 8: Commit**

```bash
git commit -m "feat: passos de jobs e relatórios com o estado de autorização, tempos por passo e canal sem vídeos cadastrados em ação do dono" -- apps/web/src/lib/youtube/coleta/token.ts apps/web/src/lib/youtube/coleta/jobs-step.ts apps/web/src/lib/youtube/coleta/reports-step.ts apps/web/src/lib/youtube/coleta/criteria.ts apps/web/src/lib/youtube/coleta/index.ts apps/web/test/youtube/coleta
```

---

### Task 7: Cliente `videos.list`

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/videos-list.ts`
- Test: `apps/web/test/youtube/coleta/videos-list.test.ts`

**Interfaces:**
- Consumes: `motivoDoGoogle` (Task 5); `parseDuration` de `@/lib/youtube/api-client`.
- Produces: `videosList(token, ids, f)`, `DataApiError`, `VideoCapturado`, `LOTE_VIDEOS = 50`. Id ausente da resposta simplesmente não está no mapa. O `fetch` é injetado: quem chama passa o `fetchComPrazo` do passo.

- [ ] **Step 1: Teste que falha**

`apps/web/test/youtube/coleta/videos-list.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { DataApiError, LOTE_VIDEOS, videosList } from '@/lib/youtube/coleta/videos-list'

const item = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  snippet: { title: `Título ${id}`, description: `Descrição ${id}`, tags: ['a', 'b'] },
  contentDetails: { duration: 'PT10M' },
  status: { privacyStatus: 'public' },
  ...extra,
})
const ok = (items: unknown[]) => new Response(JSON.stringify({ items }), { status: 200 })

describe('videosList', () => {
  it('uma chamada autenticada com o token do canal, sem chave de API, com as três partes', async () => {
    const f = vi.fn().mockResolvedValue(ok([item('aaaaaaaaaaa')]))
    const m = await videosList('tok-do-canal', ['aaaaaaaaaaa'], f as unknown as typeof fetch)
    expect(f).toHaveBeenCalledTimes(1)
    const [url, init] = f.mock.calls[0]!
    const u = new URL(String(url))
    expect(u.origin + u.pathname).toBe('https://www.googleapis.com/youtube/v3/videos')
    expect(u.searchParams.get('part')).toBe('snippet,contentDetails,status')
    expect(u.searchParams.get('id')).toBe('aaaaaaaaaaa')
    expect(u.searchParams.has('key')).toBe(false)
    expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer tok-do-canal' })
    expect(m.get('aaaaaaaaaaa')).toEqual({
      id: 'aaaaaaaaaaa', title: 'Título aaaaaaaaaaa', description: 'Descrição aaaaaaaaaaa', tags: ['a', 'b'],
      durationSeconds: 600, privacyStatus: 'public',
    })
  })

  it('120 ids → 3 chamadas de no máximo 50', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `v${String(i).padStart(10, '0')}`)
    const f = vi.fn(async (url: string) => {
      const pedidos = new URL(url).searchParams.get('id')!.split(',')
      return ok(pedidos.map(id => item(id)))
    })
    const m = await videosList('t', ids, f as unknown as typeof fetch)
    expect(f).toHaveBeenCalledTimes(3)
    expect(f.mock.calls.map(c => new URL(String(c[0])).searchParams.get('id')!.split(',').length)).toEqual([LOTE_VIDEOS, LOTE_VIDEOS, 20])
    expect(m.size).toBe(120)
  })

  it('id ausente da resposta (privado para o token, ou apagado) fica fora do mapa', async () => {
    const f = vi.fn().mockResolvedValue(ok([item('aaaaaaaaaaa')]))
    const m = await videosList('t', ['aaaaaaaaaaa', 'bbbbbbbbbbb'], f as unknown as typeof fetch)
    expect([...m.keys()]).toEqual(['aaaaaaaaaaa'])
  })

  it('campo que não veio é nulo, nunca inventado; sem tags vira lista vazia (o YouTube omite a chave quando não há)', async () => {
    const f = vi.fn().mockResolvedValue(ok([{ id: 'aaaaaaaaaaa', snippet: {}, contentDetails: {}, status: {} }, { id: 'bbbbbbbbbbb' }]))
    const m = await videosList('t', ['aaaaaaaaaaa', 'bbbbbbbbbbb'], f as unknown as typeof fetch)
    expect(m.get('aaaaaaaaaaa')).toEqual({ id: 'aaaaaaaaaaa', title: null, description: null, tags: [], durationSeconds: null, privacyStatus: null })
    expect(m.get('bbbbbbbbbbb')).toEqual({ id: 'bbbbbbbbbbb', title: null, description: null, tags: [], durationSeconds: null, privacyStatus: null })
  })

  it('resposta não-ok lança DataApiError só com status e reason; a mensagem não leva o corpo', async () => {
    const corpo = { error: { message: 'segredo no corpo', errors: [{ reason: 'insufficientPermissions' }] } }
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify(corpo), { status: 403 }))
    const e = await videosList('t', ['aaaaaaaaaaa'], f as unknown as typeof fetch).catch(x => x)
    expect(e).toBeInstanceOf(DataApiError)
    expect(e).toMatchObject({ status: 403, reason: 'insufficientPermissions' })
    expect(String(e.message)).not.toContain('segredo')
  })

  it('lista vazia não chama a rede', async () => {
    const f = vi.fn()
    expect((await videosList('t', [], f as unknown as typeof fetch)).size).toBe(0)
    expect(f).not.toHaveBeenCalled()
  })

  it('erro do fetch (prazo, rede) sobe como veio', async () => {
    const f = vi.fn().mockRejectedValue(new Error('rede'))
    await expect(videosList('t', ['aaaaaaaaaaa'], f as unknown as typeof fetch)).rejects.toThrow('rede')
  })
})
```

Run: `cd apps/web && npx vitest run test/youtube/coleta/videos-list.test.ts` → Expected: FAIL (módulo não existe).

- [ ] **Step 2: Implementar**

```ts
// `videos.list` da YouTube Data API com o token do canal DONO (spec, seção 3 — lote L1b).
// Nunca a YOUTUBE_API_KEY: a chave pública não vê `status.privacyStatus` de vídeo não público.
// 50 ids por chamada, 1 unidade de cota cada. O fetch vem de fora: quem chama passa o do prazo do passo.
import { parseDuration } from '@/lib/youtube/api-client'
import { motivoDoGoogle } from './google-erro'

const BASE = 'https://www.googleapis.com/youtube/v3/videos'
export const LOTE_VIDEOS = 50

/** Resposta não-ok da Data API. Leva só o status e o `reason`; nunca o corpo. */
export class DataApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string | null,
  ) {
    super(`YouTube Data API HTTP ${status}`)
    this.name = 'DataApiError'
  }
}

/** O estado do vídeo no instante da chamada. Campo que não veio é nulo. */
export interface VideoCapturado {
  id: string
  title: string | null
  description: string | null
  tags: string[]
  durationSeconds: number | null
  /** Como o YouTube devolveu; quem grava decide o que fazer com um valor desconhecido. */
  privacyStatus: string | null
}

interface Item {
  id?: string
  snippet?: { title?: string; description?: string; tags?: string[] }
  contentDetails?: { duration?: string }
  status?: { privacyStatus?: string }
}

/** Id ausente da resposta (privado para o token, ou apagado) não entra no mapa. */
export async function videosList(token: string, ids: readonly string[], f: typeof fetch): Promise<Map<string, VideoCapturado>> {
  const out = new Map<string, VideoCapturado>()
  for (let i = 0; i < ids.length; i += LOTE_VIDEOS) {
    const url = new URL(BASE)
    url.searchParams.set('part', 'snippet,contentDetails,status')
    url.searchParams.set('id', ids.slice(i, i + LOTE_VIDEOS).join(','))
    const res = await f(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new DataApiError(res.status, await motivoDoGoogle(res))
    const corpo = (await res.json()) as { items?: Item[] }
    for (const it of corpo.items ?? []) {
      if (!it.id) continue
      out.set(it.id, {
        id: it.id,
        title: it.snippet?.title ?? null,
        description: it.snippet?.description ?? null,
        tags: it.snippet?.tags ?? [],
        durationSeconds: it.contentDetails?.duration ? parseDuration(it.contentDetails.duration).seconds : null,
        privacyStatus: it.status?.privacyStatus ?? null,
      })
    }
  }
  return out
}
```

- [ ] **Step 3: Rodar**

Run: `cd apps/web && npx vitest run test/youtube/coleta/videos-list.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/youtube/coleta/videos-list.ts apps/web/test/youtube/coleta/videos-list.test.ts
git commit -m "feat: cliente videos.list da coleta, com o token do canal dono" -- apps/web/src/lib/youtube/coleta/videos-list.ts apps/web/test/youtube/coleta/videos-list.test.ts
```

---

### Task 8: Passo de metadados com `privacy_status` e `is_short`

**Files:**
- Modify: `apps/web/src/lib/youtube/coleta/meta-step.ts`
- Test: `apps/web/test/youtube/coleta/meta-step.test.ts`

**Interfaces:**
- Consumes: `obterToken`, `marcarAutorizado`, `marcarReautorizar` (Task 5); `videosList`, `DataApiError`, `VideoCapturado` (Task 7); `ehPerdaDeAutorizacao` (Task 5); `classifyShort`, `needsShortProbe`, `probeShortsBatch`, `newProbeBudget` de `@/lib/youtube/short-classifier`.
- Produces: `MetaResumo` ganha `sem_is_short: number` (linhas gravadas nesta execução cujo `is_short` ficou nulo por falta de confirmação) e `sem_privacidade: number` (linhas gravadas sem `privacy_status`).

**Regras (leia antes de escrever):**

1. **Captura.** Para cada canal com vídeos, `obterToken(ctx, c, tCanal)` com `tCanal = { site_id, scope_type: 'canal', scope_id: c.id, kind: 'meta', channel_id: c.id }`. Com token: `videosList(token, ids do canal, fetchComPrazo(ctx.deadline))`. Deu certo → `marcarAutorizado` e tentativa `meta` de escopo canal `ok`.
   - `SemTempoError` → tentativa de escopo canal `nao_alcancado_orcamento`; o passo segue, com a captura vinda de `youtube_videos`.
   - `DataApiError` com `ehPerdaDeAutorizacao(status, reason)` → `marcarReautorizar` e tentativa `sem_autorizacao` com `http_status`.
   - Qualquer outro erro → falha crítica `metadados: <canal>: videos.list falhou (<HTTP n | causa>)` e tentativa `erro_http`.
   - Em todos os casos sem captura, **a linha do dia é gravada do mesmo jeito**, com título, descrição, tags e duração de `youtube_videos`.
2. **Fonte dos campos.** Vídeo presente na captura: `title_at_capture`, descrição, tags e `duration_seconds` vêm dela (campo nulo na captura cai no de `youtube_videos`). Vídeo ausente da captura de um canal que **respondeu**: campos de `youtube_videos`, `privacy_status` fora do payload, e a tentativa `meta` do vídeo termina `erro_http` com `error = 'ausente de videos.list'` (a linha foi gravada; a tentativa registra a ausência, como o spec manda).
3. **`privacy_status`.** `public`, `unlisted` ou `private` → gravado. Nulo → fora do payload. Qualquer outro texto → fora do payload **e** falha crítica `metadados: privacy_status desconhecido "<valor>"` (a coluna tem `check`; o valor errado derrubaria a linha inteira).
4. **`is_short`, primeira passada** (sem rede), na ordem:
   - duração nula ou 0 → nulo;
   - linha anterior com `is_short` não nulo e a mesma `duration_seconds` → repete (um vídeo confirmado não é sondado de novo);
   - duração de 61 a 180 s sem `#Shorts` no título → nulo por enquanto, entra na fila da sonda;
   - senão `classifyShort({ durationSeconds, title })`: `confirmed` → `isShort`; não confirmado → nulo.
   `is_short` nulo fica **fora** do payload.
5. **`is_short`, segunda passada** (depois de todas as linhas gravadas): `probeShortsBatch(ids da fila, newProbeBudget(), fetchComPrazo(ctx.deadline), () => restante(ctx.deadline) <= 0)`. Para cada resultado, `classifyShort({ durationSeconds, title, probe })`; se `confirmed`, `update({ is_short })` na linha do dia (`youtube_video_id` + `day_pt`), conferindo `error`. A sonda nunca atrasa nem impede a linha: é o que não volta que vem primeiro.
6. **Critério de thumbnail.** Vídeo `private`, ou ausente de uma captura que respondeu, não conta nem no numerador nem no denominador de "metade ou mais" de hoje.
7. As chaves `is_short: null` e `privacy_status: null` saem do objeto `linha`.

- [ ] **Step 1: Ajustar a base dos testes existentes**

Em `meta-step.test.ts`:

(a) Imports e mocks novos, junto dos que já existem:

```ts
vi.mock('@/lib/youtube/coleta/videos-list', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/coleta/videos-list')>()),
  videosList: vi.fn(),
}))
vi.mock('@/lib/youtube/short-classifier', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/short-classifier')>()),
  probeShortsBatch: vi.fn(),
}))
vi.mock('@/lib/youtube/coleta/alerts', () => ({ avisarEntrada: vi.fn(), avisarSaida: vi.fn() }))

import { DataApiError, videosList, type VideoCapturado } from '@/lib/youtube/coleta/videos-list'
import { probeShortsBatch } from '@/lib/youtube/short-classifier'
import { NoActiveConnectionError, TokenRevokedError } from '@/lib/social/token-refresh'
```

(b) `canal` ganha `collection_status: 'ok' as const, video_count: 1` (se a Task 5 ainda não pôs).

(c) No `beforeEach`, o padrão passa a ser "canal nunca conectado" — o caminho sem token, que os testes do L1a exercitam:

```ts
  vi.mocked(ensureFreshToken).mockRejectedValue(new NoActiveConnectionError('youtube', 'site-1'))
  vi.mocked(videosList).mockResolvedValue(new Map())
  vi.mocked(probeShortsBatch).mockResolvedValue(new Map())
```

(d) Ajustes mecânicos nas asserções antigas, e só estes:
- `resumo.tentativas` ganha a tentativa de escopo canal: onde era `{ ok: 4 }` (2 vídeos) passa a `{ ok: 4, sem_conexao: 1 }`; aplique a mesma soma (`sem_conexao: 1` por canal com vídeos) nos demais.
- `expect(ensureFreshToken).not.toHaveBeenCalled()` sai; no lugar, `expect(videosList).not.toHaveBeenCalled()`.
- Em `toMatchObject` de linha, tire `is_short: null, privacy_status: null` e acrescente logo abaixo `nula(linha(db, 'yt-1'), 'is_short', 'privacy_status')` (a chave agora fica fora do payload). Atenção: o vídeo padrão do arquivo tem 600 s, então `is_short` passa a ser `false` — onde o teste afirmava nulo para um vídeo de 600 s, afirme `is_short: false` e mantenha `privacy_status` nulo.
- O título do primeiro teste muda para `'grava uma linha por vídeo no dia fechado; sem token, privacy_status fica nulo'`.

Run: `cd apps/web && npx vitest run test/youtube/coleta/meta-step.test.ts`
Expected: FAIL só nas asserções de `is_short: false` e de `tentativas` (o código ainda não mudou). Nenhum teste antigo pode ser apagado.

- [ ] **Step 2: Testes novos (falham)**

Acrescente ao fim do arquivo:

```ts
const cap = (n: number, extra: Partial<VideoCapturado> = {}): [string, VideoCapturado] => [`yt-${n}`, {
  id: `yt-${n}`, title: `Título API ${n}`, description: `Descrição API ${n}`, tags: ['x'], durationSeconds: 600, privacyStatus: 'public', ...extra,
}]
const comToken = () => vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' })
const canais = (extra: Row = {}): Row[] => [{ id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', collection_status: 'ok', authorization_verified_at: null, ...extra }]
const tentCanal = (db: FakeDb) => db.tables.yt_own_collection_attempts?.find(r => r.scope_type === 'canal' && r.kind === 'meta')

describe('passoMetadados: captura pela Data API (L1b)', () => {
  it('com token: título, descrição, tags, duração e privacy_status vêm de videos.list; carimba a autorização', async () => {
    comToken()
    vi.mocked(videosList).mockResolvedValue(new Map([cap(1, { privacyStatus: 'unlisted', durationSeconds: 700 })]))
    const db = fakeSupabase({ youtube_videos: [video(1)], youtube_channels: canais() })
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(vi.mocked(videosList).mock.calls[0]!.slice(0, 2)).toEqual(['tok', ['yt-1']])
    expect(linha(db, 'yt-1')).toMatchObject({
      title_at_capture: 'Título API 1', title: 'Título API 1', duration_seconds: 700, privacy_status: 'unlisted', is_short: false,
      description_text: 'Descrição API 1', description_sha256: sha('Descrição API 1'), tags: ['x'], tags_sha256: sha(JSON.stringify(['x'])),
    })
    expect(tentCanal(db)).toMatchObject({ outcome: 'ok' })
    expect(tentativa(db, 'yt-1', 'meta')).toMatchObject({ outcome: 'ok' })
    expect(db.tables.youtube_channels![0]!.authorization_verified_at).toBe(AGORA.toISOString())
    expect(resumo).toMatchObject({ gravados: 1, sem_privacidade: 0, sem_is_short: 0 })
    expect(ctx.falhas).toEqual([])
  })

  it('id ausente da resposta: a linha é gravada com os campos de youtube_videos, privacy_status nulo e tentativa erro_http', async () => {
    comToken()
    vi.mocked(videosList).mockResolvedValue(new Map([cap(1)]))
    const db = fakeSupabase({ youtube_videos: [video(1), video(2)], youtube_channels: canais() })
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(linha(db, 'yt-2')).toMatchObject({ title_at_capture: 'Título 2', description_text: 'Descrição 2' })
    nula(linha(db, 'yt-2'), 'privacy_status')
    expect(tentativa(db, 'yt-2', 'meta')).toMatchObject({ outcome: 'erro_http', error: 'ausente de videos.list' })
    expect(resumo).toMatchObject({ gravados: 2, sem_privacidade: 1 })
    expect(ctx.falhas).toEqual([])
  })

  it('privacyStatus fora da lista: linha gravada sem o campo e falha visível (Review Focus 2)', async () => {
    comToken()
    vi.mocked(videosList).mockResolvedValue(new Map([cap(1, { privacyStatus: 'membersOnly' })]))
    const db = fakeSupabase({ youtube_videos: [video(1)], youtube_channels: canais() })
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.gravados).toBe(1)
    nula(linha(db, 'yt-1'), 'privacy_status')
    expect(ctx.falhas).toEqual(['metadados: privacy_status desconhecido "membersOnly"'])
  })

  it('videos.list com 401: canal vira reautorizar, tentativa sem_autorizacao, linhas gravadas, sem falha crítica', async () => {
    comToken()
    vi.mocked(videosList).mockRejectedValue(new DataApiError(401, null))
    const db = fakeSupabase({ youtube_videos: [video(1)], youtube_channels: canais() })
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'reautorizar' })
    expect(tentCanal(db)).toMatchObject({ outcome: 'sem_autorizacao', http_status: 401 })
    expect(resumo.gravados).toBe(1)
    expect(linha(db, 'yt-1')).toMatchObject({ title_at_capture: 'Título 1' })
    expect(ctx.falhas).toEqual([])
  })

  it('videos.list com 500: falha crítica com o status, tentativa erro_http, linhas gravadas, estado inalterado', async () => {
    comToken()
    vi.mocked(videosList).mockRejectedValue(new DataApiError(500, null))
    const db = fakeSupabase({ youtube_videos: [video(1)], youtube_channels: canais() })
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(ctx.falhas).toEqual(['metadados: Canal Um: videos.list falhou (HTTP 500)'])
    expect(tentCanal(db)).toMatchObject({ outcome: 'erro_http', http_status: 500 })
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'ok' })
    expect(resumo.gravados).toBe(1)
  })

  it('token revogado: reautorizar, sem_autorizacao, e a linha do dia sai do mesmo jeito', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new TokenRevokedError('youtube', 'c1'))
    const db = fakeSupabase({ youtube_videos: [video(1)], youtube_channels: canais() })
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(tentCanal(db)).toMatchObject({ outcome: 'sem_autorizacao' })
    expect(videosList).not.toHaveBeenCalled()
    expect(resumo.gravados).toBe(1)
    expect(ctx.falhas).toEqual([])
  })

  it('segunda execução do dia com videos.list falhando não apaga privacy_status nem is_short (Review Focus 3)', async () => {
    comToken()
    vi.mocked(videosList).mockResolvedValueOnce(new Map([cap(1, { privacyStatus: 'private', durationSeconds: 30 })]))
    const db = fakeSupabase({ youtube_videos: [video(1, { duration_seconds: 0 })], youtube_channels: canais() })
    await passoMetadados(ctxDe(db))
    expect(linha(db, 'yt-1')).toMatchObject({ privacy_status: 'private', is_short: true })

    vi.mocked(videosList).mockRejectedValueOnce(new DataApiError(503, null))
    await passoMetadados(ctxDe(db))
    expect(linha(db, 'yt-1')).toMatchObject({ privacy_status: 'private', is_short: true })
  })
})

describe('passoMetadados: is_short (L1b)', () => {
  it.each([
    [30, 'Vídeo', true],
    [60, 'Vídeo', true],
    [181, 'Vídeo', false],
    [600, 'Vídeo', false],
    [120, 'Curto #Shorts', true],
  ])('duração %s s, título "%s" → is_short %s, sem sonda', async (dur, titulo, esperado) => {
    const db = fakeSupabase({ youtube_videos: [video(1, { duration_seconds: dur, title: titulo })] })
    const resumo = await passoMetadados(ctxDe(db))
    expect(linha(db, 'yt-1')).toMatchObject({ is_short: esperado })
    expect(probeShortsBatch).not.toHaveBeenCalled()
    expect(resumo.sem_is_short).toBe(0)
  })

  it.each([[0], [null]])('duração %s → is_short nulo (não se inventa)', async (dur) => {
    const db = fakeSupabase({ youtube_videos: [video(1, { duration_seconds: dur })] })
    await passoMetadados(ctxDe(db))
    nula(linha(db, 'yt-1'), 'is_short')
    expect(probeShortsBatch).not.toHaveBeenCalled()
  })

  it('61 a 180 s: a linha é gravada antes da sonda; sonda "short" confirma depois', async () => {
    vi.mocked(probeShortsBatch).mockImplementation(async (ids) => {
      // Quando a sonda roda, a linha do dia já existe (o que não volta vem primeiro).
      expect(linhaNoMomento!()).toBeDefined()
      return new Map(ids.map(id => [id, 'short' as const]))
    })
    const db = fakeSupabase({ youtube_videos: [video(1, { duration_seconds: 120 })] })
    linhaNoMomento = () => linha(db, 'yt-1')
    const resumo = await passoMetadados(ctxDe(db))
    expect(vi.mocked(probeShortsBatch).mock.calls[0]![0]).toEqual(['yt-1'])
    expect(linha(db, 'yt-1')).toMatchObject({ is_short: true })
    expect(resumo.sem_is_short).toBe(0)
  })

  it('sonda "normal" → false; inconclusiva ou não sondada → nulo e contado em sem_is_short', async () => {
    vi.mocked(probeShortsBatch).mockResolvedValue(new Map([['yt-1', 'normal'], ['yt-2', 'inconclusive']]))
    const db = fakeSupabase({ youtube_videos: [video(1, { duration_seconds: 120 }), video(2, { duration_seconds: 120 }), video(3, { duration_seconds: 120 })] })
    const resumo = await passoMetadados(ctxDe(db))
    expect(linha(db, 'yt-1')).toMatchObject({ is_short: false })
    nula(linha(db, 'yt-2'), 'is_short')
    nula(linha(db, 'yt-3'), 'is_short')
    expect(resumo.sem_is_short).toBe(2)
  })

  it('vídeo já confirmado ontem com a mesma duração não é sondado de novo', async () => {
    const db = fakeSupabase({
      youtube_videos: [video(1, { duration_seconds: 120 })],
      yt_own_video_meta_daily: [anterior(1, { is_short: true, duration_seconds: 120 })],
    })
    await passoMetadados(ctxDe(db))
    expect(probeShortsBatch).not.toHaveBeenCalled()
    expect(linha(db, 'yt-1')).toMatchObject({ is_short: true })
  })

  it('a sonda recebe um jeito de parar quando o prazo do passo acaba', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1, { duration_seconds: 120 })] })
    const ctx = ctxDe(db)
    await passoMetadados(ctx)
    const parar = vi.mocked(probeShortsBatch).mock.calls[0]![3]!
    expect(parar()).toBe(false)
    vi.setSystemTime(ctx.deadline + 1)
    expect(parar()).toBe(true)
  })
})

describe('passoMetadados: critério de thumbnail sem privados nem ausentes (L1b)', () => {
  it('thumbnail falha só nos vídeos privados e ausentes: não conta para "metade ou mais"', async () => {
    comToken()
    vi.mocked(videosList).mockResolvedValue(new Map([cap(1, { privacyStatus: 'private' }), cap(3)]))
    vi.mocked(probeThumb).mockImplementation(async (id) => (id === 'yt-3' ? probe('ffffffffffffffff') : probe(null, null)))
    const ontem = new Date(AGORA.getTime() - 864e5).toISOString().slice(0, 10)
    const db = fakeSupabase({
      youtube_videos: [video(1), video(2), video(3)],
      youtube_channels: canais(),
      yt_own_collection_attempts: [1, 2, 3].map(n => ({ scope_type: 'video', scope_id: `yt-${n}`, kind: 'thumbnail', attempt_day: ontem, site_id: 'site-1', channel_id: 'ch-1', outcome: 'erro_http', attempts: 1 })),
    })
    const ctx = ctxDe(db)
    await passoMetadados(ctx)
    expect(ctx.falhas.filter(f => f.includes('thumbnail falhou'))).toEqual([])
  })
})
```

`linhaNoMomento` é uma variável de módulo do teste: declare `let linhaNoMomento: (() => Row | undefined) | null = null` junto das outras constantes e zere-a no `beforeEach`.

Run: `cd apps/web && npx vitest run test/youtube/coleta/meta-step.test.ts` → Expected: FAIL nos testes novos.

- [ ] **Step 3: Implementar em `meta-step.ts`**

(a) Imports novos:

```ts
import { classifyShort, needsShortProbe, newProbeBudget, probeShortsBatch } from '@/lib/youtube/short-classifier'
import { marcarAutorizado, marcarReautorizar, obterToken } from './autorizacao'
import { ehPerdaDeAutorizacao } from './google-erro'
import { DataApiError, videosList, type VideoCapturado } from './videos-list'
```

(b) Cabeçalho do arquivo: troque a primeira linha do comentário por `// Passo de metadados (spec, seção 3). Desde o L1b captura pela Data API com o token do canal dono (privacy_status) e classifica Shorts.`

(c) Tipos:

```ts
export interface MetaResumo extends StepResumo {
  day_pt: string
  /** Por `youtube_channels.id`: dias entre a última linha gravada e o dia em gravação. */
  dias_sem_meta: Record<string, number>
  /** Linhas gravadas nesta execução sem `privacy_status` (sem token, falha de videos.list ou vídeo ausente dela). */
  sem_privacidade: number
  /** Linhas gravadas nesta execução cujo `is_short` ficou nulo (duração desconhecida ou sonda sem confirmação). */
  sem_is_short: number
}
```

`Anterior` ganha dois campos, e a leitura da linha anterior passa a pedi-los:

```ts
interface Anterior {
  day_pt: string
  description_sha256: string | null
  tags_sha256: string | null
  thumbnail_dhash: string | null
  thumbnail_blob_url: string | null
  is_short: boolean | null
  duration_seconds: number | null
}
```

```ts
        .select('day_pt, description_sha256, tags_sha256, thumbnail_dhash, thumbnail_blob_url, is_short, duration_seconds')
```

(d) Funções puras, acima de `passoMetadados`:

```ts
const PRIVACIDADES: readonly string[] = ['public', 'unlisted', 'private']

/**
 * `is_short` sem rede. `null` = não se sabe ainda; `sonda: true` = só a sonda de /shorts decide (61 a 180 s sem #Shorts).
 * Um vídeo já confirmado num dia anterior, com a mesma duração, não é sondado de novo.
 */
function shortSemSonda(dur: number | null, titulo: string | null, ant: Anterior | null): { valor: boolean | null; sonda: boolean } {
  if (dur == null || dur === 0) return { valor: null, sonda: false }
  if (ant && ant.is_short !== null && ant.duration_seconds === dur) return { valor: ant.is_short, sonda: false }
  if (needsShortProbe(dur) && !(titulo?.includes('#Shorts') ?? false)) return { valor: null, sonda: true }
  const v = classifyShort({ durationSeconds: dur, title: titulo })
  return { valor: v.confirmed ? v.isShort : null, sonda: false }
}
```

(e) Em `passoMetadados`, o `resumo` inicial ganha `sem_privacidade: 0, sem_is_short: 0`.

(f) **Captura**, logo depois do bloco "Passo que recebe 0 s" e antes de "dias_sem_meta". A linha `const f = fetchComPrazo(ctx.deadline)` sobe para cá (apague a de baixo):

```ts
  // Captura pela Data API, com o token do canal dono. Sem token, sem tempo ou com falha: a linha do dia sai do
  // mesmo jeito, com os campos de youtube_videos e sem privacy_status.
  const f = fetchComPrazo(ctx.deadline)
  const captura = new Map<string, VideoCapturado>()
  /** `youtube_channels.id` cuja videos.list respondeu: só para esses "ausente da resposta" quer dizer alguma coisa. */
  const respondeu = new Set<string>()
  for (const c of canais) {
    const doCanal = videos.filter(v => v.channel_id === c.id)
    if (doCanal.length === 0) continue
    const tCanal = { site_id: c.site_id, scope_type: 'canal' as const, scope_id: c.id, kind: 'meta' as const, channel_id: c.id }
    try {
      const token = await obterToken(ctx, c, tCanal)
      if (token === null) continue
      const lidosApi = await videosList(token, doCanal.map(v => v.youtube_video_id), f)
      for (const [id, v] of lidosApi) captura.set(id, v)
      respondeu.add(c.id)
      await marcarAutorizado(ctx, c)
      await registrarTentativa(ctx, { ...tCanal, outcome: 'ok' })
    } catch (e) {
      if (e instanceof SemTempoError) {
        await registrarTentativa(ctx, { ...tCanal, outcome: 'nao_alcancado_orcamento' })
        continue
      }
      if (e instanceof DataApiError && ehPerdaDeAutorizacao(e.status, e.reason)) {
        await marcarReautorizar(ctx, c)
        await registrarTentativa(ctx, { ...tCanal, outcome: 'sem_autorizacao', http_status: e.status })
        continue
      }
      const causa = e instanceof DataApiError ? `HTTP ${e.status}` : describeCronCause(e)
      Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'metadados' }, extra: { canal: c.channel_id } })
      pushUnico(ctx.falhas, `metadados: ${c.name}: videos.list falhou (${causa})`)
      await registrarTentativa(ctx, { ...tCanal, outcome: 'erro_http', http_status: e instanceof DataApiError ? e.status : null, error: causa })
    }
  }
```

(g) Estado novo junto dos outros mapas, antes do laço dos vídeos:

```ts
  /** Vídeos cuja linha foi gravada nesta execução e que só a sonda de /shorts classifica. */
  const filaSonda = new Map<string, { dur: number; titulo: string | null }>()
  /** Fora do critério de thumbnail de hoje: privado, ou ausente de uma videos.list que respondeu. */
  const foraDoCriterio = new Map<string, number>()
```

(h) Dentro do laço, logo depois de `const ant = …`:

```ts
      const cap = captura.get(v.youtube_video_id) ?? null
      const ausente = !cap && respondeu.has(v.channel_id)
      const titulo = cap?.title ?? v.title
      const descricao = cap?.description ?? v.description
      const tags = cap ? cap.tags : v.tags
      const duracao = cap?.durationSeconds ?? v.duration_seconds
      const privacidadeBruta = cap?.privacyStatus ?? null
      const privacidade = privacidadeBruta !== null && PRIVACIDADES.includes(privacidadeBruta) ? privacidadeBruta : null
      if (privacidadeBruta !== null && privacidade === null) {
        pushUnico(ctx.falhas, `metadados: privacy_status desconhecido "${privacidadeBruta.slice(0, 40)}"`)
      }
      const short = shortSemSonda(duracao, titulo, ant)
      const foraThumb = ausente || privacidade === 'private'
      if (foraThumb) somar(foraDoCriterio, v.channel_id)
```

Daí para baixo, no mesmo laço, troque as leituras de `v.title`, `v.description`, `v.tags` e `v.duration_seconds` pelas variáveis novas:

- `if (!thumb.ok && !thumbSemTempo) somar(thumbFalhas, v.channel_id)` → `if (!thumb.ok && !thumbSemTempo && !foraThumb) somar(thumbFalhas, v.channel_id)`
- `titleAtCapture: v.title` → `titleAtCapture: titulo`
- `const descHash = v.description === null ? null : sha256(v.description)` → `const descHash = descricao === null ? null : sha256(descricao)`
- `const tagsHash = sha256(JSON.stringify(v.tags ?? []))` → `const tagsHash = sha256(JSON.stringify(tags ?? []))`
- no objeto `linha`: `title_at_capture: titulo`, `duration_seconds: duracao`, e **saem** as chaves `is_short: null` e `privacy_status: null`
- `if (v.description !== null && …) linha.description_text = v.description` → `if (descricao !== null && (!ant || ant.description_sha256 !== descHash)) linha.description_text = descricao`
- `linha.tags = v.tags ?? []` → `linha.tags = tags ?? []`

Logo antes do `upsert`:

```ts
      // Nunca de não nulo a nulo: sem valor, a chave fica fora do payload (uma segunda execução não apaga a primeira).
      if (privacidade !== null) linha.privacy_status = privacidade
      if (short.valor !== null) linha.is_short = short.valor
```

E a tentativa `meta` do vídeo, com o que vem depois dela:

```ts
      await registrarTentativa(ctx, {
        ...base,
        kind: 'meta',
        outcome: escrita === 'ok' ? (ausente ? 'erro_http' : 'ok') : escrita === 'schema_ausente' ? 'schema_ausente' : 'erro_http',
        error: escrita === 'ok' ? (ausente ? 'ausente de videos.list' : null) : 'erro de banco',
      })
      if (escrita === 'ok') {
        resumo.gravados++
        somar(gravadosPorCanal, v.channel_id)
        if (privacidade === null) resumo.sem_privacidade++
        if (short.sonda && duracao !== null) filaSonda.set(v.youtube_video_id, { dur: duracao, titulo })
        else if (short.valor === null) resumo.sem_is_short++
      }
```

(i) **Segunda passada**, entre o fim do laço dos vídeos e o bloco "Critérios da seção 9":

```ts
  // Sonda de Shorts (61 a 180 s), só depois de todas as linhas gravadas: o que estava no ar não volta, a
  // classificação sim. Sem confirmação, is_short fica nulo e o vídeo é sondado de novo no dia seguinte.
  if (filaSonda.size > 0) {
    let sondas = new Map<string, 'short' | 'normal' | 'inconclusive'>()
    if (restante(ctx.deadline) > 0) {
      try {
        sondas = await probeShortsBatch([...filaSonda.keys()], newProbeBudget(), f, () => restante(ctx.deadline) <= 0)
      } catch (e) {
        Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'metadados' } })
      }
    }
    for (const [id, info] of filaSonda) {
      const veredito = classifyShort({ durationSeconds: info.dur, title: info.titulo, probe: sondas.get(id) ?? null })
      if (!veredito.confirmed) { resumo.sem_is_short++; continue }
      const up = await ctx.supabase
        .from('yt_own_video_meta_daily')
        .update({ is_short: veredito.isShort })
        .eq('youtube_video_id', id)
        .eq('day_pt', day)
      if (conferirBanco(up, 'yt_own_video_meta_daily', ctx.falhas) !== 'ok') resumo.sem_is_short++
    }
  }
```

(j) No bloco dos critérios, o denominador da thumbnail de hoje desconta os que ficaram de fora:

```ts
    const falhasHoje = thumbFalhas.get(c.id) ?? 0
    const contamHoje = devidos - (foraDoCriterio.get(c.id) ?? 0)
    if (contamHoje > 0 && falhasHoje * 2 >= contamHoje) {
```

(o resto do bloco, que lê as tentativas de ontem, fica igual: ontem não se sabe quem era privado, e isso está declarado no runbook, seção de limites).

- [ ] **Step 4: Rodar**

Run: `cd apps/web && npx vitest run test/youtube/coleta && npx tsc --noEmit`
Expected: PASS em toda a pasta; 0 erros. `tres-dias.test.ts` e `orcamento.test.ts` rodam o passo de verdade: se algum esperava `{ ok: N }` em `tentativas` do passo de metadados, soma-se a tentativa de escopo canal (ajuste mecânico, o mesmo do Step 1).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: passo de metadados captura privacy_status pela videos.list e classifica Shorts sem atrasar a linha do dia" -- apps/web/src/lib/youtube/coleta/meta-step.ts apps/web/test/youtube/coleta
```

---

### Task 9: A rota — parte antiga com `reautorizar` e a linha da execução

**Files:**
- Modify: `apps/web/src/app/api/cron/sync-analytics-metrics/route.ts`
- Test: `apps/web/test/api/cron/sync-analytics-metrics.test.ts`, `apps/web/test/cron/sync-analytics-metrics.test.ts`

**Interfaces:**
- Consumes: `classificarErroDeToken`, `marcarAutorizado`, `marcarReautorizar` (Task 5); `ehPerdaDeAutorizacao`, `motivoDoGoogle` (Task 5); `resumo.reautorizar` e `resumo.ms` de `rodarColeta` (Task 6); tabela `yt_own_collection_runs` (Task 2).
- Produces, na resposta do cron: `sem_autorizacao: number`; `coleta.ms` com os tempos das duas fases somados num objeto só. E uma linha em `yt_own_collection_runs` por execução que chega ao veredito.

**Regras:**

1. A leitura de canais da rota pede também `collection_status`.
2. Na parte antiga, um canal é tratado como "perdeu a autorização" quando: a fase `'antes'` já o devolveu em `resumo.reautorizar`; ou `ensureFreshToken` lança `TokenRevokedError`; ou lança `NoActiveConnectionError` e `classificarErroDeToken` responde `'reautorizar'`; ou a Analytics API responde 401, ou 403 com `reason` de permissão insuficiente. Nesse caso: `marcarReautorizar` (se ainda não estava), conta em `semAutorizacao`, **não** é erro, **não** entra em `falhas[]`, **não** entra no aviso antigo de "canal sem conexão".
3. `NoActiveConnectionError` de classe `'sem_conexao'` segue como hoje (pulo legítimo, com o aviso antigo). Classe `'outro'` cai no tratamento genérico de erro.
4. Chamada da Analytics API que passa (`res.ok`) chama `marcarAutorizado`.
5. O critério "todos os canais vieram vazios" desconta os dois tipos de pulo: `comConexao = lista.length − skippedNoConnection − semAutorizacao`.
6. Antes do veredito, a rota grava a linha da execução e apaga as de mais de 90 dias; erro em qualquer das duas entra em `falhas[]` (a gravação vem **antes** do veredito justamente para a falha dela ser vista).

- [ ] **Step 1: Ler o arnês dos dois testes**

Leia os dois arquivos de teste inteiros antes de escrever: eles mockam `@/lib/supabase/service`, `@/lib/social/token-refresh`, `@/lib/youtube/coleta` (`rodarColeta` devolvendo `{ falhas: [], resumo: {} }`) e `fetch`. Em **cada um**, acrescente junto dos outros mocks:

```ts
vi.mock('@/lib/youtube/coleta/autorizacao', () => ({
  classificarErroDeToken: vi.fn(async () => 'sem_conexao'),
  marcarAutorizado: vi.fn(async () => undefined),
  marcarReautorizar: vi.fn(async () => undefined),
}))
```

e faça o cliente Supabase falso aceitar `from('yt_own_collection_runs').insert(...)` e `.delete().lt(...)` devolvendo `{ error: null }` (no formato que o arnês de cada arquivo já usa para as outras tabelas). Rode os dois arquivos: têm de continuar verdes **antes** de qualquer mudança na rota.

Run: `cd apps/web && npx vitest run test/api/cron/sync-analytics-metrics.test.ts test/cron/sync-analytics-metrics.test.ts` → Expected: PASS.

- [ ] **Step 2: Testes novos (falham)**

Em `apps/web/test/api/cron/sync-analytics-metrics.test.ts`, um `describe('autorização e linha da execução (L1b)')` com estes casos. Use os construtores do arnês (canal, resposta da Analytics API, pedido autenticado); os nomes abaixo (`pedir`, `analyticsResponde`, `umCanal`, `runsInseridos`) descrevem o papel — use os que o arquivo tiver, e crie `runsInseridos` como a lista dos payloads passados ao `insert` de `yt_own_collection_runs`.

```ts
  it('Analytics API 401: canal marcado reautorizar, sem erro, sem falha, sem aviso de "sem conexão"', async () => {
    umCanal({ id: 'ch-1', collection_status: 'ok' })
    analyticsResponde(401, { error: { errors: [{ reason: 'authError' }] } })
    const corpo = await (await pedir()).json()
    expect(marcarReautorizar).toHaveBeenCalledTimes(1)
    expect(vi.mocked(marcarReautorizar).mock.calls[0]![1]).toMatchObject({ id: 'ch-1' })
    expect(corpo).toMatchObject({ errors: 0, sem_autorizacao: 1, skipped_no_connection: 0 })
    expect(corpo.falhas).toBeUndefined()
    expect(recordCronSuccess).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fanOutToSiteAdmins).mock.calls.filter(c => c[0].type === 'youtube.channel_skipped_no_connection')).toEqual([])
  })

  it('Analytics API 403 por permissão insuficiente → reautorizar; 403 por cota → erro, como antes', async () => {
    umCanal({ id: 'ch-1' })
    analyticsResponde(403, { error: { errors: [{ reason: 'insufficientPermissions' }] } })
    expect(await (await pedir()).json()).toMatchObject({ errors: 0, sem_autorizacao: 1 })

    vi.mocked(marcarReautorizar).mockClear()
    analyticsResponde(403, { error: { errors: [{ reason: 'quotaExceeded' }] } })
    const corpo = await (await pedir()).json()
    expect(corpo).toMatchObject({ errors: 1, sem_autorizacao: 0 })
    expect(marcarReautorizar).not.toHaveBeenCalled()
    expect(recordCronFailure).toHaveBeenCalled()
  })

  it('TokenRevokedError na parte antiga → reautorizar, não erro', async () => {
    umCanal({ id: 'ch-1' })
    vi.mocked(ensureFreshToken).mockRejectedValue(new TokenRevokedError('youtube', 'c1'))
    const corpo = await (await pedir()).json()
    expect(corpo).toMatchObject({ errors: 0, sem_autorizacao: 1 })
    expect(marcarReautorizar).toHaveBeenCalledTimes(1)
  })

  it('canal que a fase "antes" já devolveu em reautorizar: pulado sem aviso antigo e sem marcar de novo', async () => {
    umCanal({ id: 'ch-1' })
    vi.mocked(rodarColeta).mockResolvedValueOnce({ falhas: [], resumo: { reautorizar: ['ch-1'], ms: { metadados: 10, jobs: 5 } } })
      .mockResolvedValueOnce({ falhas: [], resumo: { ms: { relatorios: 7 } } })
    vi.mocked(ensureFreshToken).mockRejectedValue(new NoActiveConnectionError('youtube', 'site-1'))
    const corpo = await (await pedir()).json()
    expect(corpo).toMatchObject({ sem_autorizacao: 1, skipped_no_connection: 0 })
    expect(classificarErroDeToken).not.toHaveBeenCalled()
    expect(marcarReautorizar).not.toHaveBeenCalled()
    expect(vi.mocked(fanOutToSiteAdmins).mock.calls.filter(c => c[0].type === 'youtube.channel_skipped_no_connection')).toEqual([])
    expect(corpo.coleta.ms).toEqual({ metadados: 10, jobs: 5, relatorios: 7 })
  })

  it('NoActiveConnectionError de canal nunca conectado: pulo legítimo com o aviso antigo, como hoje', async () => {
    umCanal({ id: 'ch-1' })
    vi.mocked(ensureFreshToken).mockRejectedValue(new NoActiveConnectionError('youtube', 'site-1'))
    vi.mocked(classificarErroDeToken).mockResolvedValue('sem_conexao')
    const corpo = await (await pedir()).json()
    expect(corpo).toMatchObject({ skipped_no_connection: 1, sem_autorizacao: 0 })
    expect(vi.mocked(fanOutToSiteAdmins).mock.calls.filter(c => c[0].type === 'youtube.channel_skipped_no_connection')).toHaveLength(1)
  })

  it('chamada da Analytics API que passa carimba a autorização do canal', async () => {
    umCanal({ id: 'ch-1' })
    analyticsResponde(200, { rows: [] })
    await pedir()
    expect(vi.mocked(marcarAutorizado).mock.calls[0]![1]).toMatchObject({ id: 'ch-1' })
  })

  it('único canal em reautorizar não vira "todos os canais vieram vazios"', async () => {
    umCanal({ id: 'ch-1' })
    vi.mocked(ensureFreshToken).mockRejectedValue(new TokenRevokedError('youtube', 'c1'))
    const corpo = await (await pedir()).json()
    expect(corpo.falhas).toBeUndefined()
  })

  it('grava uma linha da execução com tempos, falhas e ação do dono, ANTES do veredito', async () => {
    umCanal({ id: 'ch-1' })
    analyticsResponde(200, { rows: [] })
    vi.mocked(rodarColeta).mockResolvedValueOnce({ falhas: ['metadados: x'], resumo: { ms: { metadados: 10, jobs: 5 }, acao_do_dono: ['Canal: reautorizar'] } })
      .mockResolvedValueOnce({ falhas: [], resumo: { ms: { relatorios: 7 } } })
    await pedir()
    expect(runsInseridos).toHaveLength(1)
    expect(runsInseridos[0]).toMatchObject({
      ms_passos: { metadados: 10, jobs: 5, relatorios: 7 },
      acao_do_dono: ['Canal: reautorizar'],
    })
    expect(runsInseridos[0].falhas).toContain('metadados: x')
    expect(typeof runsInseridos[0].ms_total).toBe('number')
    expect(typeof runsInseridos[0].ms_existente).toBe('number')
  })

  it('tabela yt_own_collection_runs ausente (migration não aplicada): schema_ausente no veredito e a resposta sai 200 (Review Focus 5)', async () => {
    umCanal({ id: 'ch-1' })
    analyticsResponde(200, { rows: [{ /* uma linha válida do arnês */ }] })
    runsRespondeErro({ code: 'PGRST205', message: 'tabela' })
    const res = await pedir()
    expect(res.status).toBe(200)
    expect(vi.mocked(recordCronFailure).mock.calls[0]![1]).toContain('schema_ausente: yt_own_collection_runs')
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })
```

(`runsRespondeErro` faz o `insert` de `yt_own_collection_runs` do cliente falso devolver `{ error }`.)

Run: `cd apps/web && npx vitest run test/api/cron/sync-analytics-metrics.test.ts` → Expected: FAIL nos casos novos.

- [ ] **Step 3: Implementar na rota**

(a) Imports:

```ts
import { ensureFreshToken, NoActiveConnectionError, TokenRevokedError } from '@/lib/social/token-refresh'
import { classificarErroDeToken, marcarAutorizado, marcarReautorizar } from '@/lib/youtube/coleta/autorizacao'
import { ehPerdaDeAutorizacao, motivoDoGoogle } from '@/lib/youtube/coleta/google-erro'
import type { ColetaChannel, Tentativa } from '@/lib/youtube/coleta/types'
```

(b) Tipos e conversão:

```ts
interface ChannelRow {
  id: string
  channel_id: string
  site_id: string
  subscriber_count: number | null
  name: string | null
  collection_status: string | null
}

interface ParteAntiga {
  synced: number
  errors: number
  emptyReports: number
  skippedNoConnection: number
  /** Canais pulados porque perderam a autorização do YouTube (collection_status = 'reautorizar'). */
  semAutorizacao: number
  notifications: number
  fatigueAlerts: number
  errorDetails: string[]
}

/** O canal da rota no formato que autorizacao.ts espera. `jaMarcado` = a fase 'antes' já o devolveu em reautorizar. */
function comoCanalDaColeta(c: ChannelRow, jaMarcado: boolean): ColetaChannel {
  return {
    id: c.id, channel_id: c.channel_id, site_id: c.site_id, name: c.name ?? c.channel_id, sync_enabled: true,
    collection_status: jaMarcado || c.collection_status === 'reautorizar' ? 'reautorizar' : 'ok',
    video_count: null,
  }
}
```

(c) `parteAntiga` ganha o quinto parâmetro `reautorizar: Set<string>` e, no começo do corpo:

```ts
  let semAutorizacao = 0
  // As tentativas de autorizacao.ts ficam nesta lista descartável: a parte antiga não registra tentativas.
  const aut = { supabase, falhas, tentativas: [] as Tentativa[] }
  /** Marca (se ainda não estava), conta e segue: perder a autorização é ação do dono, não erro do cron. */
  const perdeuAutorizacao = async (channel: ChannelRow): Promise<void> => {
    if (!reautorizar.has(channel.id)) {
      await marcarReautorizar(aut, comoCanalDaColeta(channel, false))
      reautorizar.add(channel.id)
    }
    semAutorizacao++
  }
```

(d) No laço, o ramo `!res.ok` ganha, **antes** do `Sentry.captureMessage`:

```ts
      if (!res.ok) {
        // 401, ou 403 por permissão insuficiente: o canal perdeu a autorização. O corpo só é lido para o `reason`.
        const reason = res.status === 403 ? await motivoDoGoogle(res) : null
        if (ehPerdaDeAutorizacao(res.status, reason)) {
          await perdeuAutorizacao(channel)
          continue
        }
        Sentry.captureMessage(/* … como está … */)
```

e, logo depois do bloco `!res.ok` (a chamada passou):

```ts
      await marcarAutorizado(aut, comoCanalDaColeta(channel, reautorizar.has(channel.id)))
      reautorizar.delete(channel.id)
```

(e) O `catch` do laço:

```ts
    } catch (e) {
      if (e instanceof TokenRevokedError || e instanceof NoActiveConnectionError) {
        // Canal que a fase 'antes' já marcou: nem relê as conexões.
        const classe = reautorizar.has(channel.id)
          ? 'reautorizar'
          : await classificarErroDeToken(aut, comoCanalDaColeta(channel, false), e)
        if (classe === 'reautorizar') {
          await perdeuAutorizacao(channel)
          continue
        }
        if (classe === 'sem_conexao') {
          skippedNoConnection.push({ channelId: channel.channel_id, siteId: channel.site_id, label: channelLabel(channel) })
          continue
        }
        // 'outro' (a leitura das conexões falhou): cai no erro genérico abaixo.
      }
      Sentry.captureException(e, { extra: { channelId: channel.channel_id } })
      errorDetails.push(channelNote(channelLabel(channel), describeCronCause(e)))
      pushUnico(falhas, errorDetails[errorDetails.length - 1]!)
      errors++
    }
```

(f) O `return` de `parteAntiga` ganha `semAutorizacao,`.

(g) Em `GET`: a leitura pede a coluna nova,

```ts
    .select('id, channel_id, site_id, subscriber_count, name, collection_status')
```

a chamada passa o conjunto,

```ts
  const jaReautorizar = new Set<string>(
    Array.isArray(coletaAntes.reautorizar) ? coletaAntes.reautorizar.filter((x): x is string => typeof x === 'string') : [],
  )
  // …
      antiga = await parteAntiga(supabase, lista, relogio, falhas, jaReautorizar)
      const comConexao = lista.length - antiga.skippedNoConnection - antiga.semAutorizacao
```

e a montagem da resposta junta os tempos das duas fases (hoje a fase `'depois'` sobrescreveria a chave `ms` da `'antes'`):

```ts
  const comoMs = (x: unknown): Record<string, number> =>
    typeof x === 'object' && x !== null ? Object.fromEntries(Object.entries(x).filter((e): e is [string, number] => typeof e[1] === 'number')) : {}
  const msPassos = { ...comoMs(coletaAntes.ms), ...comoMs(coletaDepois.ms) }
  const acaoDoDono = [...new Set([...antes.acao, ...depois.acao])].filter((x): x is string => typeof x === 'string')
  const resumoColeta = { ...antes.resto, ...depois.resto, ms: msPassos }
```

`extras` passa a usar `coleta: resumoColeta` e `acao_do_dono: acaoDoDono`. No corpo com canais, acrescente `sem_autorizacao: antiga?.semAutorizacao ?? 0,` depois de `skipped_no_connection`.

(h) A linha da execução, **imediatamente antes** do comentário `// Veredito único`:

```ts
  // A execução fica gravada: o resumo (tempos por passo, ação do dono, perdidos, vazios) só existia nesta resposta,
  // que ninguém guarda. Vem ANTES do veredito para a falha da própria gravação aparecer nele.
  try {
    const gravou = await supabase.from('yt_own_collection_runs').insert({
      ms_total: relogio.decorrido(),
      ms_existente: msExistente,
      ms_passos: msPassos,
      falhas,
      acao_do_dono: acaoDoDono,
      resumo: resumoColeta,
    })
    if (conferirBanco(gravou, 'yt_own_collection_runs', falhas) === 'ok') {
      const limpou = await supabase
        .from('yt_own_collection_runs')
        .delete()
        .lt('ran_at', new Date(Date.now() - 90 * 86_400_000).toISOString())
      conferirBanco(limpou, 'yt_own_collection_runs', falhas)
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', fase: 'execucao' } })
    pushUnico(falhas, `registro da execução: ${describeCronCause(e)}`)
  }
```

Atenção: `extras` é montado **antes** deste bloco e contém `...(falhas.length > 0 && { falhas })`. Mova a montagem de `extras` e de `corpo` para **depois** do bloco, para que uma falha da gravação apareça também na resposta.

Se `tsc` recusar o `insert` por causa do tipo gerado de `resumo`/`ms_passos` (`Json`), converta com `JSON.parse(JSON.stringify(resumoColeta))` atribuído a uma variável tipada como `Json` (importe o tipo de `@/types/database.types`). Não use `any`.

- [ ] **Step 4: Rodar**

Run: `cd apps/web && npx vitest run test/api/cron test/cron/sync-analytics-metrics.test.ts test/youtube/coleta && npx tsc --noEmit`
Expected: PASS; 0 erros.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: cron de analytics trata canal sem autorização como ação do dono e grava cada execução" -- apps/web/src/app/api/cron/sync-analytics-metrics/route.ts apps/web/test/api/cron/sync-analytics-metrics.test.ts apps/web/test/cron/sync-analytics-metrics.test.ts
```

---

### Task 10: Reconexão pelo OAuth devolve o canal a `ok`

**Files:**
- Modify: `apps/web/src/app/api/social/oauth/[provider]/callback/route.ts:294-296` (depois do upsert de `social_connections`, no `case 'google'`)
- Test: `apps/web/test/api/oauth/social-routes.test.ts`

**Interfaces:**
- Consumes: `chaveAviso(id, 'reautorizar')` de `@/lib/youtube/coleta/alerts` (Task 4).
- Produces: depois de uma reconexão do Google, toda linha de `youtube_channels` com o `site_id` do fluxo, `channel_id = channel.channelId` e `collection_status = 'reautorizar'` volta a `'ok'`, e o carimbo `sync-analytics:<id>:reautorizar` é apagado. Zero linhas não é erro. Erro de banco aqui **não** derruba a conexão (vai para o Sentry): o dono acabou de reconectar, e o cron seguinte devolveria o canal a `ok` de qualquer jeito.

- [ ] **Step 1: Teste que falha**

Em `social-routes.test.ts`, `makeServiceClient` ganha `update` e `delete` na cadeia e um jeito de escolher o que o `update … select('id')` devolve:

```ts
function makeServiceClient(voltaram: Array<{ id: string }> = []) {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const insert = vi.fn().mockResolvedValue({ error: null })
  const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'social_integration_v1_pt-BR' }, error: null })
  const chamadas: Array<{ tabela: string; op: string; args: unknown[] }> = []
  const from = vi.fn((tabela: string) => {
    const filtros: unknown[] = []
    let op = 'select'
    const cadeia: Record<string, unknown> = {
      upsert, insert, maybeSingle,
      update: (patch: unknown) => { op = 'update'; chamadas.push({ tabela, op, args: [patch, filtros] }); return cadeia },
      delete: () => { op = 'delete'; chamadas.push({ tabela, op, args: [filtros] }); return cadeia },
      eq: (c: string, v: unknown) => { filtros.push([c, v]); return cadeia },
      is: () => cadeia, order: () => cadeia, limit: () => cadeia,
      select: () => cadeia,
      then: (ok: (v: unknown) => unknown) =>
        Promise.resolve(op === 'update' ? { data: voltaram, error: null } : { data: null, error: null }).then(ok),
    }
    return cadeia
  })
  return { from, upsert, insert, maybeSingle, chamadas }
}
```

Confira que os testes existentes do arquivo continuam passando com essa forma (eles só usam `upsert`, `insert`, `maybeSingle` e `from`); se algum usar `mockServiceClient.chain`, mantenha um `chain` equivalente no retorno.

No `describe('social oauth callback — success path')`:

```ts
  it('L1b: reconexão devolve o canal em reautorizar a ok e apaga o carimbo do aviso (Review Focus 1)', async () => {
    mockServiceClient = makeServiceClient([{ id: 'canal-uuid-1' }])
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const res = await CALLBACK(callbackReq(validState(NOW)), { params: Promise.resolve({ provider: 'google' }) })
    expect(res.status).toBe(200)

    const up = mockServiceClient.chamadas.find(c => c.tabela === 'youtube_channels' && c.op === 'update')!
    expect(up.args[0]).toEqual({ collection_status: 'ok' })
    expect(up.args[1]).toEqual([['site_id', SITE], ['channel_id', 'ch1'], ['collection_status', 'reautorizar']])

    const del = mockServiceClient.chamadas.find(c => c.tabela === 'ops_alert_state' && c.op === 'delete')!
    expect(del.args[0]).toEqual([['key', 'sync-analytics:canal-uuid-1:reautorizar']])
  })

  it('L1b: canal que não estava em reautorizar (zero linhas) não apaga carimbo nenhum e conecta igual', async () => {
    mockServiceClient = makeServiceClient([])
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const res = await CALLBACK(callbackReq(validState(NOW)), { params: Promise.resolve({ provider: 'google' }) })
    expect(res.status).toBe(200)
    expect(mockServiceClient.chamadas.filter(c => c.tabela === 'ops_alert_state')).toEqual([])
    expect(mockServiceClient.insert).toHaveBeenCalledTimes(1)
  })

  it('L1b: erro ao devolver o canal a ok não derruba a conexão', async () => {
    mockServiceClient = makeServiceClient([])
    const original = mockServiceClient.from
    mockServiceClient.from = vi.fn((tabela: string) => {
      if (tabela === 'youtube_channels') throw new Error('banco fora')
      return original(tabela)
    }) as typeof original
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const res = await CALLBACK(callbackReq(validState(NOW)), { params: Promise.resolve({ provider: 'google' }) })
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('"success":true')
  })
```

O arquivo precisa de `vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))` se ainda não tiver.

Run: `cd apps/web && npx vitest run test/api/oauth/social-routes.test.ts` → Expected: FAIL nos três novos.

- [ ] **Step 2: Implementar**

No `case 'google'`, entre `if (error) throw new Error(...)` e `await recordSocialConsent(...)`:

```ts
        // A reconexão devolve a coleta do canal ao normal sem esperar o cron (spec da coleta, seção 6). O carimbo do
        // aviso é apagado para uma nova revogação avisar de novo. Zero linhas não é erro; falha aqui não desfaz a
        // conexão que acabou de ser gravada: o cron seguinte devolve o canal a `ok` quando o token passar.
        try {
          const { data: voltaram, error: erroCanal } = await supabase
            .from('youtube_channels')
            .update({ collection_status: 'ok' })
            .eq('site_id', siteId)
            .eq('channel_id', channel.channelId)
            .eq('collection_status', 'reautorizar')
            .select('id')
          if (erroCanal) {
            Sentry.captureMessage('social oauth callback: não devolveu o canal a ok', { level: 'warning', extra: { code: erroCanal.code } })
          } else {
            for (const c of voltaram ?? []) {
              await supabase.from('ops_alert_state').delete().eq('key', chaveAviso(c.id as string, 'reautorizar'))
            }
          }
        } catch (e) {
          Sentry.captureException(e, { tags: { rota: 'social-oauth-callback', passo: 'coleta-reautorizar' } })
        }
```

Imports no topo do arquivo: `import { chaveAviso } from '@/lib/youtube/coleta/alerts'` e, se o arquivo ainda não importa, `import * as Sentry from '@sentry/nextjs'`.

- [ ] **Step 3: Rodar**

Run: `cd apps/web && npx vitest run test/api/oauth test/cms/site-admin-step-integracoes.test.ts && npx tsc --noEmit`
Expected: PASS; 0 erros.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: reconectar o YouTube devolve a coleta do canal ao normal e libera o aviso de autorização" -- "apps/web/src/app/api/social/oauth/[provider]/callback/route.ts" apps/web/test/api/oauth/social-routes.test.ts
```

---

### Task 11: Runbook (execução direta)

**Files:**
- Modify: `docs/ops/youtube-coleta-canais-proprios-runbook.md`

**Interfaces:**
- Consumes: o que as Tasks 2 a 10 entregaram.
- Produces: o runbook cobrindo o L1b. Toda nota de falha nova emitida pelo código aparece nele.

- [ ] **Step 1: Editar**

1. Título e seção 1: "lote L1a" → "lotes L1a e L1b"; acrescente à lista do que se coleta: `privacy_status`, `is_short`, estado de autorização do canal, e a tabela `yt_own_collection_runs`.
2. Seção 3 ("Ler a resposta do cron"): acrescente os campos `sem_autorizacao`, `coleta.ms`, `coleta.reautorizar`, `coleta.metadados.sem_privacidade` e `coleta.metadados.sem_is_short`, com uma frase cada.
3. Seção 4 ("Ler as tabelas"): acrescente a leitura da execução, que substitui "peça a resposta do curl":

````markdown
### A execução de ontem (tempos, falhas, ação do dono)

```bash
npx supabase db query --linked "select ran_at, ms_total, ms_existente, ms_passos, falhas, acao_do_dono from yt_own_collection_runs order by ran_at desc limit 5"
```

`ms_passos` traz `metadados`, `jobs` e `relatorios` em milissegundos. Os tetos são 30 000, 20 000 e 60 000: um passo que encosta no teto por três dias vira falha de orçamento. As linhas de mais de 90 dias são apagadas pelo próprio cron.
````

4. Seção 5 ("Ação do dono"): entrada nova.

````markdown
### `<canal>: reautorizar`

O canal perdeu a autorização do YouTube (token revogado, 401, ou permissão retirada). A coleta por token parou para ele: sem `privacy_status`, sem jobs, sem relatórios. O passo de metadados continua gravando a linha do dia com o que há em `youtube_videos`. Nada é apagado.

O que fazer: reconectar o canal em /cms/social/accounts (botão do YouTube, escolhendo a conta dona do canal). Ao voltar do Google o canal volta a `ok` na hora. Conferir:

```bash
npx supabase db query --linked "select name, collection_status, authorization_verified_at from youtube_channels order by 1 limit 10"
```

Você recebe um aviso na entrada e um lembrete a cada 7 dias enquanto durar.

### `<canal>: o YouTube informa N vídeo(s) e nenhum está cadastrado`

O sync de vídeos desse canal nunca gravou nada. Não é da coleta: olhe o cron `youtube-sync` e `youtube_sync_log`.
````

5. Seção 6 ("Falhas críticas"): acrescente as notas novas, com causa e conserto: `metadados: <canal>: videos.list falhou (…)`; `metadados: privacy_status desconhecido "<valor>"` (conserto: migration alargando o `check` de `yt_own_video_meta_daily.privacy_status`); `schema_ausente: youtube_channels` e `schema_ausente: yt_own_collection_runs` (a migration do L1b não foi aplicada); `registro da execução: …`; `erro de banco ao ler social_connections`.
6. Seção 11 ("Apagar a série de um canal"): troque o último parágrafo por: "Desde o L1b o `channel_id` destas tabelas é chave estrangeira. Remover o canal pela tela responde 'Este canal tem série coletada' enquanto houver qualquer linha aqui, **inclusive tentativas e jobs** — na prática, todo canal que passou por uma execução do cron. Para remover: exporte, rode os cinco `delete` acima e remova pela tela em seguida (o cron das 09:00 recria tentativas e jobs se rodar no meio)."
7. Seção 12 ("Rollback"): subseção "Rollback do L1b" — reverter o código; depois, só se for preciso desfazer o banco, uma migration nova (`npm run db:new`) que: recria as duas funções com o corpo de `20261003000007` (copiar de lá), remove as quatro constraints `*_channel_id_fkey`, e apaga `yt_own_collection_runs` e as duas colunas de `youtube_channels`. Nessa ordem.
8. Seção 13 ("Limites conhecidos"): (a) o critério de thumbnail só sabe quem é privado **hoje**; (b) `is_short` de vídeo de 61 a 180 s depende de uma sonda a `youtube.com/shorts/<id>` e fica nulo até confirmar; (c) `authorization_verified_at` é carimbado pelo passo de metadados e pela parte antiga, não pelos passos da Reporting API.

- [ ] **Step 2: Conferir que nenhuma nota ficou de fora**

```bash
grep -rhoE "pushUnico\(([a-zA-Z.]+), \`[^\`]+\`" apps/web/src/lib/youtube/coleta apps/web/src/app/api/cron/sync-analytics-metrics/route.ts | sed -E 's/.*`//' | sort -u
```

Para cada padrão da saída, procure o trecho fixo dele no runbook. O que não estiver, acrescente na seção 6.

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: runbook da coleta com o lote L1b (reautorizar, execuções gravadas, remoção de canal com série)" -- docs/ops/youtube-coleta-canais-proprios-runbook.md
```

---

### Task 12: Revisão final, suíte inteira, push 2 e promoção (execução direta)

**Files:** nenhum novo. Atualiza o ledger.

**Interfaces:**
- Consumes: todos os commits do lote.
- Produces: `staging` verde e, com a autorização do dono, `main`.

- [ ] **Step 1: Revisão final do lote (uma, no modelo mais capaz)**

Despache um revisor com o diff `BASE..HEAD` restrito aos caminhos do lote e esta pergunta, sem dar conclusões: "Leia o diff e o spec (seções 0, 2, 3, 6 'Autorização', 9 e aceite 4b). Para cada estado em que um dado não existe (canal sem token, vídeo ausente da resposta, coluna ausente, sonda inconclusiva, leitura que falha), diga o que o código grava e se alguém percebe. Liste críticos, importantes e menores, com arquivo e linha." Corrija críticos e importantes numa onda só; menores vão para o ledger como adiados.

- [ ] **Step 2: Suíte inteira**

Run: `cd apps/web && npx vitest run`
Expected: 0 falhas. Anote no ledger arquivos e testes.

Run (se o banco local estiver no ar): `cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/youtube-channel-remove.test.ts test/integration/coleta-l1a-migration.test.ts`
Expected: PASS.

- [ ] **Step 3: Conferir que a migration está em produção**

```bash
npx supabase db query --linked "select column_name from information_schema.columns where table_name = 'youtube_channels' and column_name in ('collection_status', 'authorization_verified_at') order by 1 limit 5"
npx supabase db query --linked "select count(*) from yt_own_collection_runs"
```

Expected: duas colunas e uma contagem (0). Se a tabela não existir, **pare**: o dono ainda não rodou `db:push:prod`. O push em `staging` pode sair; a promoção não.

- [ ] **Step 4: Push 2**

Run: `git push origin staging` e espere a CI de `staging` ficar verde (`gh run list --branch staging --limit 1`).

- [ ] **Step 5: Promoção**

Peça ao dono, com estas palavras: "L1b pronto em staging, CI verde em `<sha>`, migration aplicada. Posso promover para main?" Só com o sim explícito: merge de `staging` em `main` e push. Anote no ledger o sha do merge e o resultado dos deploys da Vercel.

---

### Task 13: Verificação em produção e revisão de totalidade (execução direta)

**Files:** ledger; `docs/superpowers/plans/2026-10-08-proximos-passos.md` (commit `docs:`).

- [ ] **Step 1: Depois da primeira execução com o código novo (09:00 de São Paulo do dia seguinte à promoção)**

```bash
npx supabase db query --linked "select ran_at, ms_total, ms_existente, ms_passos, falhas, acao_do_dono from yt_own_collection_runs order by ran_at desc limit 3"
npx supabase db query --linked "select name, collection_status, authorization_verified_at from youtube_channels order by 1 limit 10"
npx supabase db query --linked "select day_pt, count(*) as linhas, count(privacy_status) as com_privacidade, count(is_short) as com_is_short, count(*) filter (where is_short) as shorts from yt_own_video_meta_daily group by 1 order by 1 desc limit 3"
npx supabase db query --linked "select privacy_status, count(*) from yt_own_video_meta_daily where day_pt = (select max(day_pt) from yt_own_video_meta_daily) group by 1 order by 1 limit 5"
npx supabase db query --linked "select scope_type, kind, outcome, count(*) from yt_own_collection_attempts where attempt_day = (now() at time zone 'utc')::date group by 1, 2, 3 order by 1, 2, 3 limit 40"
npx supabase db query --linked "select last_success_at, consecutive_failures, last_error from cron_health where cron_name = 'sync-analytics-metrics' limit 1"
```

Esperado, e o que cada desvio quer dizer:
- uma linha nova em `yt_own_collection_runs`, com `ms_passos` trazendo as três chaves e `falhas` vazia;
- os dois canais em `ok`, com `authorization_verified_at` de hoje **no canal que tem vídeos** (o canal de 0 vídeos só é carimbado pela parte antiga, se a Analytics API responder);
- no dia mais recente, `com_privacidade = linhas` para o canal com conexão viva. **`com_privacidade = 0` com `falhas` vazia é a falha em verde deste lote:** olhe a tentativa `meta` de escopo `canal` (`sem_conexao`? `sem_autorizacao`?) e o `sem_privacidade` do resumo;
- `com_is_short` igual a `linhas` menos os vídeos de 61 a 180 s que a sonda não confirmou (número em `resumo.metadados.sem_is_short`);
- tentativa `meta` de escopo `canal` com `ok` para o canal com vídeos.

- [ ] **Step 2: Aceite do lote (spec, tabela da seção 0: "canal revogado de teste vira `reautorizar` e volta a `ok`")**

Este passo mexe na conexão real de um canal e é **do dono**. Proponha, e só faça com o sim dele. Roteiro: (1) o dono revoga o acesso do app na conta Google do canal de 0 vídeos (myaccount.google.com → Segurança → Acesso de terceiros); (2) no cron seguinte, conferir `collection_status = 'reautorizar'`, um aviso no sininho com o texto do spec, `acao_do_dono` com `<canal>: reautorizar` e `falhas` vazia; (3) o dono reconecta em /cms/social/accounts; (4) conferir `collection_status = 'ok'` na hora e nenhum carimbo `sync-analytics:<id>:reautorizar` em `ops_alert_state`. Se o dono preferir não revogar um canal de verdade, o aceite fica registrado como "coberto só por teste" no ledger, com essa frase.

- [ ] **Step 3: Revisão de totalidade**

Copie para o ledger e marque cada linha com o sha, ou com `NÃO ENTREGUE: <motivo>`:

| # | Requisito de L1b (seção do spec) | Tarefa | Como conferir |
|---|---|---|---|
| 1 | `youtube_channels.collection_status` e `authorization_verified_at` (§2) | 2 | SELECT do Step 1 |
| 2 | `channel_id` com `on delete restrict` nas quatro tabelas (§0, §2) | 2 | teste de integração (`23503`) |
| 3 | Órfãos tratados antes da FK (divergência 4 do plano do L1a) | 2 | Step 6 da Task 2 |
| 4 | RPC de remover canal com `serie_coletada`, depois de `not_found`/`slug_mismatch` e antes de `blocked` (§2) | 2 | teste de integração |
| 5 | `serie_coletada` no `z.enum`, em `RemovalRpc`, em `CHANNEL_TEXT` e na action (§2) | 3 | testes de registry e de action |
| 6 | Aviso `reautorizar` com o texto exato; entrada, lembrete e saída (§1 Avisos) | 4, 5 | `alerts.test.ts`, `autorizacao.test.ts` |
| 7 | `TokenRevokedError` → `reautorizar` (§6) | 5 | `autorizacao.test.ts` |
| 8 | `NoActiveConnectionError` com conexão revogada → `reautorizar`; sem → `sem_conexao` (§6, aceite 4b) | 5 | `autorizacao.test.ts` |
| 9 | 401 da Analytics/Data API e 403 `insufficientPermissions` → `reautorizar` (§6) | 8, 9 | `meta-step.test.ts`, teste da rota |
| 10 | 401 da Reporting API não muda `collection_status` (aceite 4b) | 6 | `jobs-step.test.ts` |
| 11 | Passos gravam `sem_autorizacao` (§6) | 5, 6, 8 | testes dos três passos |
| 12 | `ensureFreshToken` voltando a passar → `ok` sozinho (§6) | 5 | `autorizacao.test.ts` |
| 13 | Callback do OAuth → `ok` (§6) | 10 | `social-routes.test.ts` |
| 14 | Aviso antigo de "sem conexão" calado para canal em `reautorizar` (§6) | 9 | teste da rota |
| 15 | `authorization_verified_at` em chamada autenticada bem-sucedida (§6) | 5, 8, 9 | testes; SELECT do Step 1 |
| 16 | Cliente `videos.list` com o token do canal, 50 por chamada, sem chave pública (§3) | 7 | `videos-list.test.ts` |
| 17 | `privacy_status`; id ausente → nulo e tentativa `meta` `erro_http` (§3) | 8 | `meta-step.test.ts` |
| 18 | `is_short` por `classifyShort`; 0 → nulo; 61–180 s com sonda; não confirmado → nulo (§3) | 8 | `meta-step.test.ts` |
| 19 | Captura de título/descrição/tags/duração pela `videos.list` quando há token (§3) | 8 | `meta-step.test.ts` |
| 20 | Critério de thumbnail sem privados nem ausentes (§9) | 8 | `meta-step.test.ts` |
| 21 | `collection_status` na leitura de `rodarColeta` (§7) | 6 | `index.test.ts` |
| 22 | Runbook: reconectar canal, apagar série de canal revogado (§10) | 11 | arquivo |
| 23 | Canal revogado de teste vira `reautorizar` e volta a `ok` (§0) | 13 | Step 2 |
| 24 | Suíte inteira verde antes de cada push (aceite 11) | 2, 12 | ledger |

Fora do spec, incluído por decisão registrada na seção seguinte: `yt_own_collection_runs`; `ms` por passo; nota de canal com vídeos no YouTube e nenhum cadastrado.

- [ ] **Step 4: O que o L1b ensinou**

Responda no ledger, com fatos de produção:
1. Quanto o passo de metadados passou a levar com a `videos.list` e a sonda (comparar `ms_passos.metadados` com os ~13 s do L1a)? O teto de 30 s aguenta?
2. Quantos vídeos de 61 a 180 s existem, e quantos a sonda confirmou no primeiro dia?
3. Algum `privacy_status` fora de `public`/`unlisted`/`private` apareceu?
4. A distribuição de `privacy_status` bate com o que o dono vê no Studio (conferir 3 vídeos)?
5. Trocar a fonte da captura (de `youtube_videos` para `videos.list`) mudou o hash de descrição ou de tags de algum vídeo no primeiro dia? Quantos textos foram regravados?
6. O que neste plano estava errado ou faltando e custou tempo?

Depois proponha ao dono as emendas aos specs seguintes (L2 em diante, A/B Lab, telas) e atualize `2026-10-08-proximos-passos.md` (etapa 2 feita).

```bash
git commit -m "docs: L1b da coleta em produção, com o que se aprendeu para o L2" -- docs/superpowers/plans/2026-10-08-proximos-passos.md
```

---

## Decisões que este plano tomou e o spec não fecha

Cada uma deve ser lida pelo dono antes da execução.

1. **Canal com série coletada fica impossível de remover pela tela — e isso vale para praticamente todo canal.** O spec manda contar as linhas `yt_own_*` e `yt_reporting_*`. Tentativas e jobs contam, então qualquer canal com sync ligado que passou por uma execução do cron já tem série. Segui o spec ao pé da letra. Consequência: remover um canal cadastrado por engano passa a exigir os cinco `delete` do runbook. Alternativa, se o dono preferir: a RPC apagar sozinha tentativas e jobs e só recusar por metadados diários e relatórios (ajuda pouco: um canal com vídeos ganha metadados no primeiro cron).
2. **Texto da recusa em pt-BR**, como a decisão 5 do spec manda, embora os outros textos de `CHANNEL_TEXT` estejam em inglês.
3. **Série órfã aborta a migration** em vez de ser apagada ou reatribuída. Hoje há 0 órfãos (conferido em 08/10). Tentativas órfãs só perdem o `channel_id`.
4. **Tabela `yt_own_collection_runs`** (emenda 2 da revisão do L1a): fora do spec. Motivo: tempos por passo, `acao_do_dono`, `perdidos` e `vazios_sem_publicacao` só existiam na resposta HTTP do cron, que ninguém guarda — a pergunta "quanto cada passo levou?" não tinha resposta por SELECT. Sem `site_id` (a execução é do cron inteiro), só service role, 90 dias de retenção.
5. **`authorization_verified_at` é carimbado duas vezes por dia por canal** (passo de metadados e parte antiga), não "em toda chamada autenticada": o significado é o mesmo e são duas escritas em vez de dezenas.
6. **`privacy_status` desconhecido é falha crítica**, não só um campo no resumo: o `check` da coluna recusaria a linha inteira, e um valor novo do YouTube pede uma migration.
7. **Falha passageira da `videos.list` é falha crítica** (`metadados: <canal>: videos.list falhou`). O spec só diz "sem token ou com falha: nulo". Sem isso, um dia inteiro sem `privacy_status` terminaria verde.
8. **A sonda de Shorts roda depois de todas as linhas gravadas**, e um vídeo confirmado não é sondado de novo. O spec não fixa a ordem; a sonda pode custar até 3 s por vídeo e o que estava no ar não volta.
9. **`is_short` com duração nula é nulo.** O spec só fala de duração 0; `classifyShort` responderia pelo título, o que seria um palpite gravado como fato.
10. **O callback do OAuth apaga o carimbo do aviso** e não manda "voltou ao normal" (quem reconectou foi o próprio dono, naquele instante).
11. **Canal com `video_count > 0` e nenhum vídeo cadastrado vai para `acao_do_dono`**, não para `falhas`: o conserto é no sync de vídeos, fora da coleta, e vermelho permanente esconderia as falhas seguintes. O canal `Thiago Figueiredo` não cai aqui: o YouTube informa 0 vídeos (conferido em 08/10, sincronizado no mesmo dia).
12. **Regra dos 90 dias mantida** ("4 vazios seguidos" e "6 dias sem relatório" só valem para canal que publicou nos últimos 90 dias): confirmado pelo dono em 08/10 — canal parado há muito tempo não precisa alertar.

## Adiados do L1a: o que entrou e o que ficou

| Adiado no ledger do L1a | Neste lote |
|---|---|
| Critério de thumbnail sem privados/ausentes | **entra** (Task 8) |
| `acao_do_dono` só na resposta do cron | **entra** (tabela de execuções, Task 9) |
| Tempos por passo não gravados | **entra** (Tasks 6 e 9) |
| Token revogado: dono só sabia pelo aviso antigo | **entra** (aviso `reautorizar`) |
| `createNotification` devolve `success: false` e `fanOutToSiteAdmins` não acusa, nos avisos da parte antiga | fica: não se sabe como o dedup do dia responde numa segunda execução (poderia virar falha falsa); o aviso de "vídeo em alta" sai na etapa 4 |
| Download que falha consome vaga do teto de 40; `gzip_invalido` final | fica para o L2 (mexe no ciclo de vida do relatório) |
| Critérios não filtram canal com sync desligado | fica: 2 canais, ambos ligados |
| Paginação de `criterioJobsEmErro` acima de ~25 canais | fica |
| Lacuna do rodízio (falta dia sim, dia não nunca fica vermelha) | fica: precisa de decisão de spec |
| Demais menores de teste | ficam |

## Auto-revisão (feita ao escrever)

- **Cobertura:** a tabela do Step 3 da Task 13 liga cada requisito de L1b a uma tarefa. O aceite 4b está coberto item a item (linhas 7, 8, 10, 12, 13 e 5).
- **Review Focus:** 1 → Task 10; 2 e 3 → Task 8; 4 → Task 2, Step 6; 5 → Tasks 6 e 9.
- **Nomes entre tarefas:** `obterToken`, `marcarReautorizar`, `marcarAutorizado`, `classificarErroDeToken`, `ehPerdaDeAutorizacao`, `motivoDoGoogle`, `videosList`, `DataApiError`, `VideoCapturado`, `LOTE_VIDEOS`, `avisarSaida(ctx, ch, motivos)`, `chaveAviso`, `collection_status`, `video_count`, `serie_coletada` / `serieColetada`, `sem_autorizacao` / `semAutorizacao`, `yt_own_collection_runs` — a mesma grafia em todas as tarefas.
- **O que este plano NÃO fez, ao contrário do plano do L1a:** o código não foi executado ao planejar. Os blocos foram escritos contra o código lido em 08/10 (`fb95477d`), mas nenhum teste rodou. Em três pontos o plano dá o papel de um helper de teste e manda reaproveitar o que o arquivo já tem, em vez de dar o código pronto, porque o arnês daqueles arquivos não foi lido por inteiro: `jobs-step.test.ts` (`rodarComReporting401`), `criteria.test.ts` (`semRelatorioNovoHa7Dias`) e os dois testes da rota (Task 9). O implementador lê o arnês primeiro; o revisor confere que as asserções listadas aqui estão todas presentes.
- **Risco conhecido:** os testes de integração antigos do L1a usam um `channel_id` aleatório, que a FK passa a recusar (Step 7 da Task 2 trata).
