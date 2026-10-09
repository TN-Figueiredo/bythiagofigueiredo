# Coleta dos canais próprios — lote L2 (diário por vídeo e alcance normalizado) — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development. Um implementador por tarefa, um de cada vez (o pre-commit faz typecheck da árvore inteira). Passos com caixa (`- [ ]`).

**Objetivo:** gravar, todo dia, o diário real por vídeo (Analytics API) em `yt_own_video_daily` e as impressões e o CTR de miniatura por vídeo e dia (CSV bruto da Reporting API) em `yt_own_video_reach_daily`.

**Arquitetura:** dois passos novos na fase `depois` de `rodarColeta` (`lib/youtube/coleta/index.ts`), depois do passo de relatórios: `alcance` (normaliza o bruto já baixado; só banco) e `diario` (uma chamada à Analytics API por vídeo). A regra "só sobrescreve se o relatório for mais novo" mora numa função do banco. Três critérios novos fecham as falhas em verde. Nenhum cron novo, nenhuma variável de ambiente, nada em `packages/`, nenhuma rota de pipeline, nenhuma tela.

**Stack:** Next.js 16 (rota de cron), TypeScript estrito, Supabase (PostgREST + função SQL), Vitest (`// @vitest-environment node`).

**Spec:** `docs/superpowers/specs/2026-10-07-coleta-canais-proprios-design.md` — seções 1, 2 (L2), 5 ("Normalizar o alcance básico"), 6 ("Diário por vídeo"), 7, 9 e aceite 9. A seção "Emendas de 08/10/2026" e a "Emendas de 09/10/2026" (Task 9 deste plano) mandam sobre o resto.

**Base:** `staging` 4cea52a5 = `main` 560a9e59 (conferir com `git rev-parse origin/staging origin/main` na Task 1).

## Fatos de produção que este plano usa (VERIFICADOS em 09/10/2026 por SELECT e gunzip do bruto)

- Cabeçalho real de `channel_reach_basic_a1`: `date,channel_id,video_id,video_thumbnail_impressions,video_thumbnail_impressions_ctr`.
- `date` = `AAAAMMDD`. CTR em 0–1 (`0.33333333333333331` com 3 impressões). Não há coluna de cliques.
- Uma linha por vídeo e dia. Vídeo sem impressão no dia não aparece. Dia sem impressão vem só com o cabeçalho (`status = 'vazio'`, 71 bytes).
- 40 brutos baixados: 11 `baixado`, 29 `vazio`. Os 33 ids de vídeo distintos dos 11 CSVs existem todos em `youtube_videos`.
- Canais: `tnFigueiredo` (35 vídeos, publicados de 27/08/2015 a 10/12/2024, 0 Shorts) e `Thiago Figueiredo` (0 vídeos).
- Documentação do Google (lida em 09/10): `views`, `engagedViews`, `estimatedMinutesWatched`, `averageViewDuration`, `averageViewPercentage`, `likes`, `comments`, `shares`, `subscribersGained`, `subscribersLost`, `cardImpressions`, `cardClickRate` são aceitas juntas com `dimensions=day` e `filters=video==<id>`. `maxResults` não tem padrão nem teto documentado. `columnHeaders[]` traz `name`.

## Restrições globais

- Trabalhar em `staging`. Sem branch, sem worktree, sem `git stash`, sem `git reset`, sem `--no-verify`.
- Commit **por caminho explícito** (`git commit -m "…" -- <arquivos>`), mensagem `tipo: descrição` em português. Nunca commitar `apps/web/next-env.d.ts` nem `apps/web/tsconfig.json`. Outros terminais trabalham no mesmo repositório: não tocar no que não é seu.
- Migration só com `npm run db:new <nome>` (raiz). Quem aplica em produção é o dono.
- **Nulo, nunca zero.** Métrica que não veio é `NULL`. **Nunca de não nulo a nulo:** numa segunda execução, coluna sem valor fica FORA do payload.
- `youtube_video_id` nas tabelas novas é o id de 11 caracteres do YouTube (texto). `video_id` é o uuid de `youtube_videos.id`. Em `youtube_video_analytics` e `ab_tests` a coluna `youtube_video_id` é o uuid: nunca juntar pelo nome.
- `day_pt` é gravado como veio da fonte e nunca convertido. `attempt_day` é UTC e nunca se junta a `day_pt`.
- Datas "hoje"/"ontem" no Pacífico só por `dayPt`/`addDays` de `lib/youtube/coleta/day-pt.ts`. Nunca `toISOString()` para isso.
- Toda leitura e toda escrita no Supabase passa por `conferirBanco` (`lib/youtube/coleta/schema.ts`). Leitura que falha nunca vira "não há dado".
- Respostas da Analytics API são lidas por `columnHeaders[].name`, nunca por posição.
- Toda chamada ao Google usa o `fetch` de `fetchComPrazo(deadline)` (`lib/youtube/coleta/clock.ts`).
- Notas de falha em pt-BR, sem o texto cru do Postgres nem o corpo do Google.
- Testes: `// @vitest-environment node` na primeira linha; datas com `vi.useFakeTimers({ now, toFake: ['Date'] })`; nenhuma data futura fixa (`test/unit/test-hygiene.test.ts` recusa).
- Regra para os implementadores: **nunca afrouxar** `test/youtube/coleta/fake-supabase.ts` para um teste passar. Corrija o código ou a semente.
- `youtube_video_analytics.views` é o total da janela de 90 dias: nada neste lote o lê.

## Foco da revisão

Modos de falha que o spec implica e que mais provavelmente mordem. Cada um tem o teste na tarefa dona.

1. **Diário em verde sem dado.** Todos os vídeos voltam vazios (perda de escopo) e o dia fecha `ok`. Esperado: vermelho na 3ª execução seguida (Task 6, critério A) — e a janela sempre inclui o último dia gravado, então vídeo que já teve linha só volta vazio se a API parou de responder (Task 5).
2. **Normalizador parado em verde.** Relatórios `baixado` se acumulam com `normalized_at` nulo e ninguém nota. Esperado: vermelho depois de 2 dias (Task 6, critério C).
3. **Relatório antigo por cima do novo.** O Google reemite o relatório de um dia; o mais velho é normalizado depois. Esperado: a linha fica com o mais novo (Task 1, função do banco; Task 3).
4. **Coluna que some da resposta.** A API deixa de mandar `averageViewPercentage` num dia em que a linha já tem o valor. Esperado: o valor gravado fica (Task 5).
5. **Código no ar sem a migration.** Esperado: `schema_ausente: yt_own_video_daily`, cron vermelho, metadados e relatórios do dia gravados normalmente (Tasks 3, 5 e 7).

## Mapa de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `supabase/migrations/<ts>_coleta_canais_proprios_l2.sql` | duas tabelas, função `yt_own_reach_apply`, impacto de remoção | 1 |
| `apps/web/src/types/database.types.ts` | tipos das duas tabelas e da função (inserção manual) | 1 |
| `apps/web/test/integration/coleta-l2-migration.test.ts` | schema no banco local | 1 |
| `apps/web/test/youtube/coleta/fake-supabase.ts` | chaves únicas das tabelas novas; `comReachApply` | 1 |
| `apps/web/src/lib/youtube/coleta/metric-version.ts` | `metricVersion(dayPt)` | 2 |
| `apps/web/src/lib/youtube/reporting/reach-csv.ts` | ler e agregar o CSV do alcance básico (puro) | 2 |
| `apps/web/test/fixtures/yt-reporting/*.csv` | CSV real, exportado pelo dono | 2 |
| `apps/web/src/lib/youtube/coleta/alcance-step.ts` | passo `alcance` | 3 |
| `apps/web/src/lib/youtube/coleta/analytics-diario.ts` | cliente do diário (rede) | 4 |
| `apps/web/src/lib/youtube/coleta/diario-step.ts` | passo `diario` | 5 |
| `apps/web/src/lib/youtube/coleta/criteria-l2.ts` | três critérios novos | 6 |
| `apps/web/src/lib/youtube/coleta/index.ts`, `clock.ts` | ligação, tetos | 7 |
| `apps/web/src/lib/youtube/coleta/meta-step.ts` | buraco das tags (adiado do L1b) | 8 |
| `docs/ops/youtube-coleta-canais-proprios-runbook.md`, spec | documentação e emendas | 9 |

Ordem de execução: **1 → 4 → 5 → 6 → 8 → 2 → 3 → 7 → 9 → 10 → 11.** As Tasks 2 e 3 dependem dos três arquivos de `apps/web/test/fixtures/yt-reporting/` que só o dono exporta; ficam por último para o resto não esperar.

---

### Task 1: Migration, tipos, banco em memória e teste de schema

**Files:**
- Create: `supabase/migrations/<timestamp>_coleta_canais_proprios_l2.sql` (pelo `npm run db:new`)
- Create: `apps/web/test/integration/coleta-l2-migration.test.ts`
- Modify: `apps/web/src/types/database.types.ts`
- Modify: `apps/web/test/youtube/coleta/fake-supabase.ts`
- Modify: `apps/web/test/youtube/coleta/fake-supabase.test.ts`
- Modify: `apps/web/test/integration/youtube-channel-remove.test.ts` (só se o teste da linha ~340 contar série; ver Step 7)

**Interfaces:**
- Produces: tabelas `yt_own_video_daily` e `yt_own_video_reach_daily`; função `public.yt_own_reach_apply(p_rows jsonb) returns integer`; no arnês, `comReachApply(db: FakeDb): FakeDb` e as chaves únicas das duas tabelas em `CHAVES_UNICAS_L1A`.

- [ ] **Step 1: Pré-voo**

```bash
git rev-parse origin/staging origin/main
ls supabase/migrations | tail -3
npx supabase db query --linked "select to_regclass('public.yt_own_video_daily') as diario, to_regclass('public.yt_own_video_reach_daily') as alcance"
```
Esperado: `staging` 4cea52a5 ou descendente; última migration `20261008000002_…`; as duas tabelas nulas em produção.

- [ ] **Step 2: Criar a migration**

```bash
npm run db:new coleta_canais_proprios_l2
```

Conteúdo do arquivo gerado (inteiro):

```sql
-- =============================================================================
-- MIGRATION: Coleta dos canais próprios — lote L2
-- Spec: docs/superpowers/specs/2026-10-07-coleta-canais-proprios-design.md (seções 2, 5 e 6)
-- Aditiva. Roda duas vezes sem erro. Depende de 20261008000002 (L1b).
--
-- O que faz:
--   1. yt_own_video_daily: o diário real por vídeo (Analytics API). Toda métrica é nula quando não veio.
--   2. yt_own_video_reach_daily: impressões e CTR de miniatura por vídeo e dia (Reporting API).
--   3. yt_own_reach_apply: grava o alcance sem deixar um relatório mais velho passar por cima do mais novo.
--   4. youtube_channel_removal_impact: as duas tabelas novas contam como série coletada.
-- youtube_video_id = id de 11 caracteres do YouTube (NÃO o uuid de youtube_videos.id).
-- day_pt = o dia como veio da fonte; as duas fontes não documentam o mesmo dia (spec, seção 1).
-- =============================================================================

-- ── 1. Diário por vídeo ─────────────────────────────────────────────────────
create table if not exists public.yt_own_video_daily (
  youtube_video_id text not null,
  day_pt date not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  views bigint,
  engaged_views bigint,
  watch_time_minutes numeric,
  avg_view_duration_seconds numeric,
  avg_view_percentage numeric,
  likes bigint,
  comments bigint,
  shares bigint,
  subscribers_gained bigint,
  subscribers_lost bigint,
  card_impressions bigint,
  card_click_rate numeric,
  source text not null default 'analytics_api' check (source in ('analytics_api', 'reporting_api')),
  collected_at timestamptz not null default now(),
  metric_version text not null
    check (metric_version in ('views_ate_2025-03-30', 'views_2025-03-31_a_2026-08-26', 'views_desde_2026-08-27')),
  primary key (youtube_video_id, day_pt)
);
create index if not exists idx_yt_own_video_daily_channel_day
  on public.yt_own_video_daily (channel_id, day_pt);

-- ── 2. Alcance por vídeo e dia ──────────────────────────────────────────────
-- thumbnail_ctr fica na unidade em que veio do relatório (0–1, conferido no CSV real em 09/10/2026).
create table if not exists public.yt_own_video_reach_daily (
  youtube_video_id text not null,
  day_pt date not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  thumbnail_impressions bigint,
  thumbnail_ctr numeric,
  source_report_id text not null,
  report_create_time timestamptz not null,
  source text not null default 'reporting_api' check (source in ('analytics_api', 'reporting_api')),
  collected_at timestamptz not null default now(),
  metric_version text not null
    check (metric_version in ('views_ate_2025-03-30', 'views_2025-03-31_a_2026-08-26', 'views_desde_2026-08-27')),
  primary key (youtube_video_id, day_pt)
);
create index if not exists idx_yt_own_video_reach_daily_channel_day
  on public.yt_own_video_reach_daily (channel_id, day_pt);

-- ── 3. RLS: leitura por quem edita o site; escrita só por service role ──────
alter table public.yt_own_video_daily enable row level security;
drop policy if exists "yt_own_video_daily_select" on public.yt_own_video_daily;
create policy "yt_own_video_daily_select" on public.yt_own_video_daily
  for select using (public.can_edit_site(site_id));

alter table public.yt_own_video_reach_daily enable row level security;
drop policy if exists "yt_own_video_reach_daily_select" on public.yt_own_video_reach_daily;
create policy "yt_own_video_reach_daily_select" on public.yt_own_video_reach_daily
  for select using (public.can_edit_site(site_id));

-- ── 4. Gravar o alcance (o PostgREST não faz upsert condicional) ────────────
-- Uma linha só é sobrescrita por um relatório de create_time MAIOR, ou pelo MESMO relatório
-- (re-normalização). Devolve quantas linhas foram inseridas ou sobrescritas.
create or replace function public.yt_own_reach_apply(p_rows jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare v_n integer;
begin
  insert into public.yt_own_video_reach_daily as t
    (youtube_video_id, day_pt, site_id, video_id, channel_id, thumbnail_impressions, thumbnail_ctr,
     source_report_id, report_create_time, source, collected_at, metric_version)
  select r.youtube_video_id, r.day_pt, r.site_id, r.video_id, r.channel_id, r.thumbnail_impressions, r.thumbnail_ctr,
         r.source_report_id, r.report_create_time, 'reporting_api', now(), r.metric_version
  from jsonb_to_recordset(p_rows) as r(
    youtube_video_id text, day_pt date, site_id uuid, video_id uuid, channel_id uuid,
    thumbnail_impressions bigint, thumbnail_ctr numeric,
    source_report_id text, report_create_time timestamptz, metric_version text)
  on conflict (youtube_video_id, day_pt) do update
    set thumbnail_impressions = excluded.thumbnail_impressions,
        thumbnail_ctr = excluded.thumbnail_ctr,
        source_report_id = excluded.source_report_id,
        report_create_time = excluded.report_create_time,
        video_id = coalesce(excluded.video_id, t.video_id),
        collected_at = now(),
        metric_version = excluded.metric_version
    where excluded.report_create_time > t.report_create_time
       or excluded.source_report_id = t.source_report_id;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.yt_own_reach_apply(jsonb) from public, anon, authenticated;
grant execute on function public.yt_own_reach_apply(jsonb) to service_role;

-- ── 5. Remover canal: as duas tabelas novas contam como série ───────────────
-- Recriada por inteiro. Única mudança em relação a 20261008000002: duas parcelas a mais em serie_coletada.
-- public.youtube_channel_remove não muda (ela lê serie_coletada daqui).
```

Em seguida, **copie do arquivo `supabase/migrations/20261008000002_coleta_canais_proprios_l1b.sql` (linhas 85 a 141) a função `public.youtube_channel_removal_impact` inteira**, e troque só a parcela `serie_coletada` por:

```sql
    'serie_coletada', (select count(*) from public.yt_own_video_meta_daily m where m.channel_id = p_channel_id)
                    + (select count(*) from public.yt_reporting_reports r where r.channel_id = p_channel_id)
                    + (select count(*) from public.yt_reporting_jobs j where j.channel_id = p_channel_id)
                    + (select count(*) from public.yt_own_collection_attempts a where a.channel_id = p_channel_id)
                    + (select count(*) from public.yt_own_video_daily d where d.channel_id = p_channel_id)
                    + (select count(*) from public.yt_own_video_reach_daily h where h.channel_id = p_channel_id),
```

Feche o arquivo com:

```sql
revoke all on function public.youtube_channel_removal_impact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.youtube_channel_removal_impact(uuid, uuid) to service_role;
```

- [ ] **Step 3: Aplicar duas vezes no banco local**

```bash
npm run db:status
```
Se o banco local não estiver no ar: `npm run db:start`. **Não** rode `npm run db:reset` (outro terminal pode estar usando o banco). Depois, duas vezes:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/migrations/<arquivo novo>
```
Esperado: as duas execuções terminam sem `ERROR`.

- [ ] **Step 4: Escrever o teste de schema (falha antes do Step 3; se você seguiu a ordem, confirme que ele acusa a tabela ausente comentando o Step 3 mentalmente: rode-o contra o nome errado de tabela e veja falhar)**

`apps/web/test/integration/coleta-l2-migration.test.ts`:

```ts
// @vitest-environment node
// Tabelas e função do lote L2, no banco local.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, SUPABASE_URL, ANON_KEY } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

describe.skipIf(skipIfNoLocalDb())('coleta L2: schema (banco local)', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId = ''
  let canal = ''
  const sufixo = randomUUID().slice(0, 8)
  const yt = `yt2-${sufixo}`
  const V = 'views_2025-03-31_a_2026-08-26'
  const alcance = (extra: Record<string, unknown> = {}) => ({
    youtube_video_id: yt, day_pt: '2026-09-25', site_id: siteId, video_id: null, channel_id: canal,
    thumbnail_impressions: 3, thumbnail_ctr: 0.33333333333333331,
    source_report_id: `rel-a-${sufixo}`, report_create_time: '2026-10-01T10:00:00.000Z', metric_version: V, ...extra,
  })
  const lerAlcance = async () =>
    (await sb.from('yt_own_video_reach_daily').select('thumbnail_impressions, thumbnail_ctr, source_report_id').eq('youtube_video_id', yt).single()).data

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    siteId = (await seedSite(sb)).siteId
    const ch = await sb.from('youtube_channels').insert({
      site_id: siteId, channel_id: `UCl2${sufixo}`, locale: 'pt', handle: `@l2${sufixo}`, name: 'Canal L2', uploads_playlist_id: `UUl2${sufixo}`,
    }).select('id').single()
    if (ch.error || !ch.data) throw new Error(ch.error?.message ?? 'canal não criado')
    canal = ch.data.id as string
  })
  afterAll(async () => {
    for (const t of ['yt_own_video_daily', 'yt_own_video_reach_daily']) await sb.from(t).delete().eq('site_id', siteId)
    await sb.from('sites').delete().eq('id', siteId)
  })

  it('diário: toda métrica nasce nula, a chave é (youtube_video_id, day_pt) e metric_version fora da lista é recusada', async () => {
    const base = { youtube_video_id: yt, day_pt: '2026-10-01', site_id: siteId, channel_id: canal, metric_version: V }
    expect((await sb.from('yt_own_video_daily').insert(base)).error).toBeNull()
    expect((await sb.from('yt_own_video_daily').insert(base)).error?.code).toBe('23505')
    const lido = await sb.from('yt_own_video_daily').select('views, engaged_views, avg_view_percentage, card_click_rate, source, video_id').eq('youtube_video_id', yt).single()
    expect(lido.data).toEqual({ views: null, engaged_views: null, avg_view_percentage: null, card_click_rate: null, source: 'analytics_api', video_id: null })
    const ruim = await sb.from('yt_own_video_daily').insert({ ...base, day_pt: '2026-10-02', metric_version: 'qualquer' })
    expect(ruim.error?.code).toBe('23514')
  })

  it('diário: upsert sem a coluna não apaga o valor que já estava gravado', async () => {
    const chave = { youtube_video_id: yt, day_pt: '2026-10-03', site_id: siteId, channel_id: canal, metric_version: V }
    expect((await sb.from('yt_own_video_daily').upsert({ ...chave, views: 7, avg_view_percentage: 41.5 }, { onConflict: 'youtube_video_id,day_pt' })).error).toBeNull()
    expect((await sb.from('yt_own_video_daily').upsert({ ...chave, views: 9 }, { onConflict: 'youtube_video_id,day_pt' })).error).toBeNull()
    const lido = await sb.from('yt_own_video_daily').select('views, avg_view_percentage').eq('youtube_video_id', yt).eq('day_pt', '2026-10-03').single()
    expect(lido.data).toEqual({ views: 9, avg_view_percentage: 41.5 })
  })

  it('yt_own_reach_apply: insere; relatório mais velho não sobrescreve; mais novo sobrescreve; o mesmo relatório sobrescreve', async () => {
    const a = await sb.rpc('yt_own_reach_apply', { p_rows: [alcance()] })
    expect(a.error).toBeNull()
    expect(a.data).toBe(1)
    expect(await lerAlcance()).toMatchObject({ thumbnail_impressions: 3, source_report_id: `rel-a-${sufixo}` })

    const velho = await sb.rpc('yt_own_reach_apply', { p_rows: [alcance({ thumbnail_impressions: 99, source_report_id: `rel-velho-${sufixo}`, report_create_time: '2026-09-30T10:00:00.000Z' })] })
    expect(velho.data).toBe(0)
    expect(await lerAlcance()).toMatchObject({ thumbnail_impressions: 3 })

    const novo = await sb.rpc('yt_own_reach_apply', { p_rows: [alcance({ thumbnail_impressions: 5, thumbnail_ctr: null, source_report_id: `rel-novo-${sufixo}`, report_create_time: '2026-10-02T10:00:00.000Z' })] })
    expect(novo.data).toBe(1)
    expect(await lerAlcance()).toEqual({ thumbnail_impressions: 5, thumbnail_ctr: null, source_report_id: `rel-novo-${sufixo}` })

    const mesmo = await sb.rpc('yt_own_reach_apply', { p_rows: [alcance({ thumbnail_impressions: 6, source_report_id: `rel-novo-${sufixo}`, report_create_time: '2026-10-02T10:00:00.000Z' })] })
    expect(mesmo.data).toBe(1)
    expect(await lerAlcance()).toMatchObject({ thumbnail_impressions: 6 })
  })

  it('yt_own_reach_apply com lista vazia devolve 0 e não dá erro', async () => {
    const r = await sb.rpc('yt_own_reach_apply', { p_rows: [] })
    expect(r.error).toBeNull()
    expect(r.data).toBe(0)
  })

  it('canal com linha no diário ou no alcance não pode ser apagado (23503) e conta como série coletada', async () => {
    const del = await sb.from('youtube_channels').delete().eq('id', canal)
    expect(del.error?.code).toBe('23503')
    const impacto = await sb.rpc('youtube_channel_removal_impact', { p_site_id: siteId, p_channel_id: canal })
    expect((impacto.data as { serie_coletada: number }).serie_coletada).toBeGreaterThanOrEqual(3)
  })

  it('anon não lê as tabelas nem chama a função', async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    for (const tabela of ['yt_own_video_daily', 'yt_own_video_reach_daily']) {
      const r = await anon.from(tabela).select('*').limit(1)
      expect(r.error !== null || (r.data ?? []).length === 0, tabela).toBe(true)
    }
    expect((await anon.rpc('yt_own_reach_apply', { p_rows: [] })).error).not.toBeNull()
  })
})
```

- [ ] **Step 5: Rodar o teste de schema**

```bash
cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/coleta-l2-migration.test.ts test/integration/coleta-l1a-migration.test.ts test/integration/youtube-channel-remove.test.ts
```
Esperado: tudo verde. Se `youtube-channel-remove.test.ts` falhar na comparação de chaves ou na contagem de `serie_coletada`, a causa só pode ser a função recriada: compare com o original antes de mexer no teste.

- [ ] **Step 6: Tipos**

`npm run db:types` traz deriva alheia (ruling do L1a): **não** rode por cima do arquivo. Gere num arquivo temporário e copie só os blocos novos:

```bash
npx supabase@2.98.2 gen types typescript --local --schema public > /tmp/types-l2.ts
```
Insira em `apps/web/src/types/database.types.ts`, em ordem alfabética dentro de `Tables` e de `Functions`: os blocos `yt_own_video_daily`, `yt_own_video_reach_daily` e `yt_own_reach_apply`. O diff tem só inserções. Depois: `cd apps/web && npx tsc --noEmit` → 0 erros.

- [ ] **Step 7: Banco em memória**

Em `apps/web/test/youtube/coleta/fake-supabase.ts`, acrescente a `CHAVES_UNICAS_L1A`:

```ts
  yt_own_video_daily: [['youtube_video_id', 'day_pt']],
  yt_own_video_reach_daily: [['youtube_video_id', 'day_pt']],
```

E exporte, no fim do arquivo:

```ts
/**
 * Mesmo comportamento de public.yt_own_reach_apply: insere; sobrescreve só quando o relatório é mais novo
 * (create_time maior, comparado como instante) ou é o mesmo relatório. Devolve quantas linhas mudaram.
 */
export function comReachApply(db: FakeDb): FakeDb {
  db.rpcHandlers.yt_own_reach_apply = (a) => {
    const linhas = (a.p_rows ?? []) as Row[]
    const t = (db.tables.yt_own_video_reach_daily ??= [])
    let n = 0
    for (const l of linhas) {
      if (l.site_id == null || l.channel_id == null || l.source_report_id == null || l.report_create_time == null || l.metric_version == null) {
        return { data: null, error: { code: '23502', message: 'null value in column of yt_own_video_reach_daily' } }
      }
      const i = t.findIndex(r => r.youtube_video_id === l.youtube_video_id && r.day_pt === l.day_pt)
      const nova = { ...l, source: 'reporting_api', collected_at: new Date().toISOString() }
      if (i === -1) { t.push(nova); n++; continue }
      const atual = t[i]!
      const maisNovo = Date.parse(l.report_create_time as string) > Date.parse(atual.report_create_time as string)
      if (maisNovo || l.source_report_id === atual.source_report_id) {
        t[i] = { ...atual, ...nova, video_id: l.video_id ?? atual.video_id ?? null }
        n++
      }
    }
    return { data: n, error: null }
  }
  return db
}
```

Em `fake-supabase.test.ts`, um teste novo: `comReachApply` insere (1), recusa o mais velho (0, linha intacta), aceita o mais novo (1) e aceita o mesmo relatório (1) — os mesmos quatro casos do teste de integração, com os mesmos valores.

- [ ] **Step 8: Rodar e commitar**

```bash
cd apps/web && npx vitest run test/youtube/coleta && npx tsc --noEmit
git commit -m "feat: migration do lote L2 da coleta (diário por vídeo, alcance normalizado e a função que não deixa relatório velho sobrescrever)" -- supabase/migrations/<arquivo novo> apps/web/src/types/database.types.ts apps/web/test/integration/coleta-l2-migration.test.ts apps/web/test/youtube/coleta/fake-supabase.ts apps/web/test/youtube/coleta/fake-supabase.test.ts
```

---

### Task 2: `metricVersion` e o leitor do CSV de alcance (depende da fixture do dono)

**Pré-condição:** existem `apps/web/test/fixtures/yt-reporting/channel_reach_basic_a1.csv` (25/09, 11 linhas), `channel_reach_basic_a1-2026-09-30.csv` (32 linhas) e `channel_reach_basic_a1-vazio.csv` (só o cabeçalho). Se não existirem: **PARE** e devolva `BLOCKED: fixture ausente`. Não escreva fixture à mão.

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/metric-version.ts`
- Create: `apps/web/src/lib/youtube/reporting/reach-csv.ts`
- Test: `apps/web/test/youtube/coleta/metric-version.test.ts`, `apps/web/test/youtube/coleta/reach-csv.test.ts`

**Interfaces:**
- Produces:
  - `metricVersion(dayPt: string): MetricVersion` com `type MetricVersion = 'views_ate_2025-03-30' | 'views_2025-03-31_a_2026-08-26' | 'views_desde_2026-08-27'`
  - `CABECALHO_ALCANCE_BASICO: readonly string[]`
  - `class CsvAlcanceError extends Error { motivo: 'cabecalho_inesperado' | 'linha_invalida' }`
  - `interface LinhaAlcance { day: string; channelId: string; videoId: string; impressions: number; ctr: number | null }`
  - `lerAlcanceBasico(csv: string): LinhaAlcance[]`
  - `interface AlcanceDoDia { day: string; videoId: string; impressions: number; ctr: number | null }`
  - `agregarAlcance(linhas: readonly LinhaAlcance[]): AlcanceDoDia[]`

- [ ] **Step 1: Testes que falham**

`metric-version.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { metricVersion } from '@/lib/youtube/coleta/metric-version'

describe('metricVersion', () => {
  it.each([
    ['2015-08-27', 'views_ate_2025-03-30'],
    ['2025-03-30', 'views_ate_2025-03-30'],
    ['2025-03-31', 'views_2025-03-31_a_2026-08-26'],
    ['2026-08-26', 'views_2025-03-31_a_2026-08-26'],
    ['2026-08-27', 'views_desde_2026-08-27'],
    ['2026-10-08', 'views_desde_2026-08-27'],
  ])('%s → %s', (dia, esperado) => {
    expect(metricVersion(dia)).toBe(esperado)
  })
  it('dia fora do formato lança (nunca escolhe uma versão por palpite)', () => {
    expect(() => metricVersion('20260925')).toThrow()
    expect(() => metricVersion('')).toThrow()
  })
})
```

`reach-csv.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { agregarAlcance, CABECALHO_ALCANCE_BASICO, CsvAlcanceError, lerAlcanceBasico } from '@/lib/youtube/reporting/reach-csv'

const fixture = (nome: string) => readFileSync(join(__dirname, '../../fixtures/yt-reporting', nome), 'utf8')
const REAL = fixture('channel_reach_basic_a1.csv')
const MAIOR = fixture('channel_reach_basic_a1-2026-09-30.csv')
const VAZIO = fixture('channel_reach_basic_a1-vazio.csv')
const motivo = (fn: () => unknown) => { try { fn() } catch (e) { return e instanceof CsvAlcanceError ? e.motivo : `outro: ${String(e)}` } return 'não lançou' }

describe('lerAlcanceBasico (CSV real exportado de produção)', () => {
  it('o cabeçalho do arquivo real é o esperado', () => {
    expect(REAL.split('\n')[0]!.trim().split(',')).toEqual([...CABECALHO_ALCANCE_BASICO])
  })
  it('lê as 11 linhas de 25/09 com o dia em AAAA-MM-DD, impressões inteiras e CTR em 0–1', () => {
    const linhas = lerAlcanceBasico(REAL)
    expect(linhas).toHaveLength(11)
    expect(new Set(linhas.map(l => l.day))).toEqual(new Set(['2026-09-25']))
    expect(new Set(linhas.map(l => l.channelId))).toEqual(new Set(['UCRHtzTwaEpcjspAS2hbqmrA']))
    expect(linhas.find(l => l.videoId === 'S1iMQVIOFL4')).toEqual({ day: '2026-09-25', channelId: 'UCRHtzTwaEpcjspAS2hbqmrA', videoId: 'S1iMQVIOFL4', impressions: 3, ctr: 0.3333333333333333 })
    expect(linhas.find(l => l.videoId === 'BKczyNOMdoc')).toMatchObject({ impressions: 2, ctr: 0 })
    expect(linhas.every(l => l.ctr === null || (l.ctr >= 0 && l.ctr <= 1))).toBe(true)
  })
  it('lê as 32 linhas de 30/09 e a soma das impressões é a do arquivo', () => {
    const linhas = lerAlcanceBasico(MAIOR)
    expect(linhas).toHaveLength(32)
    expect(linhas.reduce((s, l) => s + l.impressions, 0)).toBe(71)
  })
  it('arquivo só com o cabeçalho → lista vazia, sem erro', () => {
    expect(lerAlcanceBasico(VAZIO)).toEqual([])
  })
  it('aceita fim de linha CRLF e linha em branco no fim', () => {
    expect(lerAlcanceBasico(REAL.replace(/\n/g, '\r\n') + '\r\n')).toHaveLength(11)
  })
  it('as colunas são lidas pelo nome: outra ordem dá o mesmo resultado', () => {
    const [cab, ...resto] = REAL.trim().split('\n')
    const troca = (l: string) => { const c = l.split(','); return [c[2], c[0], c[4], c[3], c[1]].join(',') }
    expect(lerAlcanceBasico([troca(cab!), ...resto.map(troca)].join('\n'))).toEqual(lerAlcanceBasico(REAL))
  })
  it('cabeçalho com coluna a mais, a menos ou com outro nome → cabecalho_inesperado', () => {
    const linhas = REAL.trim().split('\n')
    expect(motivo(() => lerAlcanceBasico([linhas[0] + ',traffic_source_type', ...linhas.slice(1).map(l => l + ',1')].join('\n')))).toBe('cabecalho_inesperado')
    expect(motivo(() => lerAlcanceBasico('date,channel_id,video_id,video_thumbnail_impressions\n'))).toBe('cabecalho_inesperado')
    expect(motivo(() => lerAlcanceBasico(REAL.replace('video_thumbnail_impressions_ctr', 'ctr')))).toBe('cabecalho_inesperado')
    expect(motivo(() => lerAlcanceBasico(''))).toBe('cabecalho_inesperado')
  })
  it('linha com número de campos errado, data ilegível ou impressões não inteiras → linha_invalida (nada é lido pela metade)', () => {
    const cab = CABECALHO_ALCANCE_BASICO.join(',')
    expect(motivo(() => lerAlcanceBasico(`${cab}\n20260925,UC1,abc,3\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceBasico(`${cab}\n2026-09-25,UC1,abc,3,0\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceBasico(`${cab}\n20260925,UC1,abc,três,0\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceBasico(`${cab}\n20260925,UC1,abc,-1,0\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceBasico(`${cab}\n20260925,UC1,,3,0\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceBasico(`${cab}\n20260925,UC1,abc,3,muito\n`))).toBe('linha_invalida')
  })
  it('CTR vazio é nulo, nunca zero', () => {
    const cab = CABECALHO_ALCANCE_BASICO.join(',')
    expect(lerAlcanceBasico(`${cab}\n20260925,UC1,abc,3,\n`)[0]!.ctr).toBeNull()
  })
})

describe('agregarAlcance', () => {
  it('o arquivo real tem uma linha por vídeo e dia: agregar não muda nada', () => {
    const linhas = lerAlcanceBasico(REAL)
    expect(agregarAlcance(linhas)).toEqual(linhas.map(({ day, videoId, impressions, ctr }) => ({ day, videoId, impressions, ctr })))
  })
  it('mais de uma linha por vídeo e dia: impressões somam e o CTR é a média ponderada pelas impressões', () => {
    const base = { day: '2026-09-25', channelId: 'UC1', videoId: 'abc' }
    expect(agregarAlcance([{ ...base, impressions: 3, ctr: 1 / 3 }, { ...base, impressions: 1, ctr: 1 }])).toEqual([{ day: '2026-09-25', videoId: 'abc', impressions: 4, ctr: 0.5 }])
  })
  it('CTR nulo em todas as linhas → nulo; nulo em algumas → pondera só as que têm', () => {
    const base = { day: '2026-09-25', channelId: 'UC1', videoId: 'abc' }
    expect(agregarAlcance([{ ...base, impressions: 2, ctr: null }, { ...base, impressions: 2, ctr: null }])[0]!.ctr).toBeNull()
    expect(agregarAlcance([{ ...base, impressions: 2, ctr: null }, { ...base, impressions: 2, ctr: 0.5 }])[0]).toMatchObject({ impressions: 4, ctr: 0.5 })
  })
  it('zero impressões no total → CTR nulo (não há divisão por zero)', () => {
    expect(agregarAlcance([{ day: '2026-09-25', channelId: 'UC1', videoId: 'abc', impressions: 0, ctr: 0 }])[0]).toEqual({ day: '2026-09-25', videoId: 'abc', impressions: 0, ctr: null })
  })
})
```

Nota sobre o número 71: é a soma das impressões das 32 linhas do relatório de 30/09 lido em produção em 09/10. Se o arquivo exportado der outro valor, **não ajuste o teste sem dizer**: reporte a diferença.

- [ ] **Step 2: Rodar e ver falhar** — `cd apps/web && npx vitest run test/youtube/coleta/metric-version.test.ts test/youtube/coleta/reach-csv.test.ts` → falha por módulo inexistente.

- [ ] **Step 3: Implementar**

`metric-version.ts`:

```ts
// A definição de "view" do YouTube mudou duas vezes; cada linha de métrica diz sob qual definição foi contada.
// Os cortes são por `day_pt` (spec, seção 1). Comparação de texto: AAAA-MM-DD ordena como data.

export type MetricVersion = 'views_ate_2025-03-30' | 'views_2025-03-31_a_2026-08-26' | 'views_desde_2026-08-27'

const DIA = /^\d{4}-\d{2}-\d{2}$/

export function metricVersion(dayPt: string): MetricVersion {
  if (!DIA.test(dayPt)) throw new Error(`dia inválido para metric_version: ${dayPt.slice(0, 20)}`)
  if (dayPt < '2025-03-31') return 'views_ate_2025-03-30'
  if (dayPt < '2026-08-27') return 'views_2025-03-31_a_2026-08-26'
  return 'views_desde_2026-08-27'
}
```

`reach-csv.ts`:

```ts
// Leitor do CSV de `channel_reach_basic_a1` (impressões e CTR de miniatura por vídeo e dia). Puro: sem banco, sem rede.
// Escrito contra o cabeçalho REAL lido de produção em 09/10/2026; o teste roda sobre o arquivo exportado.
// Nenhum campo deste relatório traz vírgula ou aspas, então a linha é separada por vírgula simples —
// e campo com aspas é linha inválida, nunca lido por aproximação.

export const CABECALHO_ALCANCE_BASICO = [
  'date', 'channel_id', 'video_id', 'video_thumbnail_impressions', 'video_thumbnail_impressions_ctr',
] as const

export class CsvAlcanceError extends Error {
  constructor(public readonly motivo: 'cabecalho_inesperado' | 'linha_invalida') {
    super(`CSV de alcance: ${motivo}`)
    this.name = 'CsvAlcanceError'
  }
}

export interface LinhaAlcance {
  /** AAAA-MM-DD, o dia como veio do relatório (só reformatado). */
  day: string
  channelId: string
  videoId: string
  impressions: number
  /** Na unidade do relatório (0–1). Campo vazio = nulo. */
  ctr: number | null
}

export interface AlcanceDoDia { day: string; videoId: string; impressions: number; ctr: number | null }

const DATA = /^(\d{4})(\d{2})(\d{2})$/
const INTEIRO = /^\d+$/

export function lerAlcanceBasico(csv: string): LinhaAlcance[] {
  const linhas = csv.split(/\r?\n/).filter(l => l.trim().length > 0)
  const cab = (linhas[0] ?? '').split(',').map(c => c.trim())
  const esperado: readonly string[] = CABECALHO_ALCANCE_BASICO
  if (cab.length !== esperado.length || !esperado.every(c => cab.includes(c))) throw new CsvAlcanceError('cabecalho_inesperado')
  const pos = (nome: string) => cab.indexOf(nome)
  const [iData, iCanal, iVideo, iImp, iCtr] = esperado.map(pos) as [number, number, number, number, number]

  return linhas.slice(1).map((l) => {
    const c = l.split(',').map(x => x.trim())
    if (c.length !== cab.length || l.includes('"')) throw new CsvAlcanceError('linha_invalida')
    const d = DATA.exec(c[iData]!)
    if (!d || !c[iCanal] || !c[iVideo] || !INTEIRO.test(c[iImp]!)) throw new CsvAlcanceError('linha_invalida')
    const bruto = c[iCtr]!
    const ctr = bruto === '' ? null : Number(bruto)
    if (ctr !== null && (!Number.isFinite(ctr) || ctr < 0)) throw new CsvAlcanceError('linha_invalida')
    return { day: `${d[1]}-${d[2]}-${d[3]}`, channelId: c[iCanal]!, videoId: c[iVideo]!, impressions: Number(c[iImp]), ctr }
  })
}

/** Uma linha por vídeo e dia: impressões somam; CTR = média ponderada pelas impressões das linhas que têm CTR. */
export function agregarAlcance(linhas: readonly LinhaAlcance[]): AlcanceDoDia[] {
  const grupos = new Map<string, { day: string; videoId: string; impressions: number; peso: number; cliques: number }>()
  for (const l of linhas) {
    const chave = `${l.videoId}|${l.day}`
    const g = grupos.get(chave) ?? { day: l.day, videoId: l.videoId, impressions: 0, peso: 0, cliques: 0 }
    g.impressions += l.impressions
    if (l.ctr !== null) { g.peso += l.impressions; g.cliques += l.impressions * l.ctr }
    grupos.set(chave, g)
  }
  return [...grupos.values()].map(g => ({ day: g.day, videoId: g.videoId, impressions: g.impressions, ctr: g.peso > 0 ? g.cliques / g.peso : null }))
}
```

- [ ] **Step 4: Rodar e ver passar.** Depois `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: leitor do CSV real de alcance e versão da métrica por dia" -- apps/web/src/lib/youtube/coleta/metric-version.ts apps/web/src/lib/youtube/reporting/reach-csv.ts apps/web/test/youtube/coleta/metric-version.test.ts apps/web/test/youtube/coleta/reach-csv.test.ts apps/web/test/fixtures/yt-reporting/channel_reach_basic_a1.csv apps/web/test/fixtures/yt-reporting/channel_reach_basic_a1-2026-09-30.csv apps/web/test/fixtures/yt-reporting/channel_reach_basic_a1-vazio.csv
```

---

### Task 3: Passo `alcance` (normalização)

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/alcance-step.ts`
- Test: `apps/web/test/youtube/coleta/alcance-step.test.ts`

**Interfaces:**
- Consumes: `lerAlcanceBasico`, `agregarAlcance`, `CsvAlcanceError` (Task 2); `metricVersion` (Task 2); `deBytea` de `@/lib/youtube/reporting/client`; `comReachApply` (Task 1); `conferirBanco`, `pushUnico`; `restante`.
- Produces: `passoAlcance(ctx: StepCtx): Promise<AlcanceResumo>`, `MAX_NORMALIZAR = 200`, e

```ts
export interface AlcanceResumo extends StepResumo {
  /** Relatórios com dado normalizados nesta execução. */
  normalizados: number
  /** Relatórios `vazio` conferidos (cabeçalho certo) e marcados como normalizados. */
  vazios: number
  /** Relatórios que viraram `erro` nesta execução (cabeçalho, linha, canal, bruto). */
  erros: number
  /** Linhas de vídeo sem par em youtube_videos (gravadas com video_id nulo e listadas no relatório). */
  sem_par: number
}
```
`gravados` = linhas que a função do banco inseriu ou sobrescreveu. `pendentes` = relatórios que ficaram por normalizar (prazo, leitura que falhou, ou além do teto de 200).

**Comportamento, na ordem:**

1. `canais = ctx.channels` (todos: normalizar não usa token). Sem canais → resumo zerado.
2. Lê a fila: `yt_reporting_reports`, colunas `report_id, site_id, channel_id, status, create_time`, `report_type_id = 'channel_reach_basic_a1'`, `status in ('baixado','vazio')`, `normalized_at is null`, `channel_id in (ids)`, `order create_time asc`, `limit MAX_NORMALIZAR + 1`. `conferirBanco(..., 'yt_reporting_reports', falhas, 'ler')`: `schema_ausente` ou erro → devolve o resumo (a nota já está em `falhas`). Se vierem mais de 200, processa 200 e soma o excedente em `pendentes` (o excedente exato não é conhecido: some `1` e deixe o critério C da Task 6 cuidar; comente isso).
3. Por relatório, **em série**:
   - `restante(ctx.deadline) <= 0` → soma os que faltam em `pendentes` e para.
   - Vídeos do canal: uma leitura por canal, guardada num `Map<channelUuid, Map<youtubeVideoId, uuid> | null>`: `youtube_videos`, `youtube_video_id, id`, `eq('channel_id', c.id)`, `limit(1000)`. Leitura que falha → `null` → relatório fica pendente (`pendentes++`). 1000 linhas ou mais → `pushUnico(falhas, 'alcance: vídeos do canal <nome> lidos até o limite de 1000 — a leitura pode estar truncada')` e trata como `null`.
   - Bruto: `yt_reporting_report_blobs`, `csv_gz`, `eq('report_id', id)`, `.maybeSingle()`. Leitura que falha → pendente. Sem linha → `marcarErro('bruto_ausente')`.
   - `gunzipSync(deBytea(csv_gz))` dentro de `try`: exceção → `marcarErro('gzip_invalido')`.
   - `lerAlcanceBasico(texto)`: `CsvAlcanceError` → `marcarErro(e.motivo)`.
   - Canal do relatório: se alguma linha tem `channelId !== canal.channel_id` → `marcarErro('canal_inesperado')`.
   - `agregarAlcance` → linhas para a função, uma por vídeo e dia:
     `{ youtube_video_id, day_pt, site_id: rel.site_id, video_id: mapa.get(videoId) ?? null, channel_id: rel.channel_id, thumbnail_impressions, thumbnail_ctr, source_report_id: rel.report_id, report_create_time: rel.create_time, metric_version: metricVersion(day) }`.
   - Se houver linhas: `ctx.supabase.rpc('yt_own_reach_apply', { p_rows })`, com `try/catch` (exceção vira `{ error: { code: null, message: 'rpc lançou' } }`), `conferirBanco(res, 'yt_own_reach_apply', falhas)`. Não `ok` → pendente; se `schema_ausente`, **para o passo** (devolve o resumo). `ok` → `gravados += typeof data === 'number' ? data : 0`.
   - Marca o relatório: `update({ normalized_at: agora, unmatched_video_ids: semPar.length ? { count: semPar.length, ids: semPar } : null }).eq('report_id', id)`, com `conferirBanco`. `semPar` = ids de vídeo distintos sem par, ordenados. Só depois disso `normalizados++` (ou `vazios++` quando o relatório não tinha linhas) e `sem_par += semPar.length`.
4. `marcarErro(motivo)`: `update({ status: 'erro', error: motivo }).eq('report_id', id)` com `conferirBanco`; `erros++`. **Não** empurra nota em `falhas`: o critério "relatório de alcance em erro" (`criteriosRelatorios`, que roda depois na mesma fase) já faz isso, e continua fazendo nos 14 dias seguintes.
5. O passo **não** registra tentativas (`yt_own_collection_attempts` não tem `kind` para ele; o estado mora no relatório). `resumo.tentativas` fica `{}`.
6. O passo inteiro nunca lança por causa de um relatório: `try/catch` por relatório, com `Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'alcance' }, extra: { report } })` e `pushUnico(falhas, \`alcance: ${describeCronCause(e)}\`)`; o relatório fica pendente.

- [ ] **Step 1: Testes que falham**

Arnês (copie o estilo de `reports-step.test.ts`): `vi.mock('@sentry/nextjs', …)`; `AGORA = new Date('2026-10-09T12:05:00.000Z')` com fake timers só de `Date`; fixture real lida do disco como na Task 2; `gz = (csv: string) => paraBytea(gzipSync(Buffer.from(csv)))`; banco `comReachApply(fakeSupabase({...}))`; canal `{ id: 'ch-1', channel_id: 'UCRHtzTwaEpcjspAS2hbqmrA', site_id: 'site-1', name: 'Canal Um', sync_enabled: true, collection_status: 'ok', video_count: 35 }`; `youtube_videos` semeado com os 11 ids da fixture de 25/09 (`{ id: 'v-<id>', youtube_video_id: '<id>', channel_id: 'ch-1' }`); relatório `rel(id, extra)` = `{ site_id: 'site-1', report_id: id, job_id: 'job-1', channel_id: 'ch-1', report_type_id: 'channel_reach_basic_a1', status: 'baixado', create_time: '2026-10-09T11:02:00.000Z', normalized_at: null, unmatched_video_ids: null, error: null, ...extra }` com o blob correspondente.

Casos, cada um um `it` com as asserções escritas:

1. **CSV real de 25/09:** 11 linhas em `yt_own_video_reach_daily`; a de `S1iMQVIOFL4` é `{ day_pt: '2026-09-25', thumbnail_impressions: 3, thumbnail_ctr: 0.3333333333333333, video_id: 'v-S1iMQVIOFL4', channel_id: 'ch-1', site_id: 'site-1', source_report_id: 'r1', report_create_time: '2026-10-09T11:02:00.000Z', metric_version: 'views_desde_2026-08-27' }`; relatório com `normalized_at === AGORA.toISOString()`, `status: 'baixado'`, `unmatched_video_ids: null`; resumo `{ gravados: 11, normalizados: 1, vazios: 0, erros: 0, sem_par: 0, pendentes: 0 }`; `falhas` vazia.
2. **Relatório `vazio` (fixture só com cabeçalho):** nenhuma linha gravada, `rpcCalls` sem `yt_own_reach_apply`, `normalized_at` preenchido, `status` continua `vazio`, `vazios: 1`.
3. **Cabeçalho inesperado:** relatório `status: 'erro'`, `error: 'cabecalho_inesperado'`, `normalized_at` nulo, nenhuma linha, `erros: 1`. Vale também para um relatório `vazio` cujo arquivo tem outro cabeçalho.
4. **Relatório mais antigo não sobrescreve (aceite 9):** semeie a linha de `S1iMQVIOFL4`/`2026-09-25` com `thumbnail_impressions: 99`, `source_report_id: 'r-novo'`, `report_create_time: '2026-10-09T12:00:00.000Z'`; normalize `r1` (11:02): a linha continua com 99 e `r-novo`; as outras 10 entram; `gravados: 10`; o relatório `r1` é marcado normalizado mesmo assim.
5. **Dois relatórios do mesmo dia, o mais novo por último na fila:** a linha fica com o mais novo.
6. **Vídeo sem par:** tire `S1iMQVIOFL4` de `youtube_videos`: a linha é gravada com `video_id: null`; `unmatched_video_ids` do relatório = `{ count: 1, ids: ['S1iMQVIOFL4'] }`; `sem_par: 1`.
7. **`channel_id` do CSV diferente do canal do relatório:** `erro`, `error: 'canal_inesperado'`, nenhuma linha.
8. **Bruto ausente** (`baixado` sem linha em blobs) → `error: 'bruto_ausente'`. **Gzip corrompido** (`csv_gz: '\\x00ff'`) → `error: 'gzip_invalido'`.
9. **Prazo vencido** (`deadline = Date.now()`): nada é lido nem gravado além da fila; `pendentes` = tamanho da fila; relatórios intactos.
10. **Sem a migration:** `db.errors['rpc:yt_own_reach_apply'] = { code: 'PGRST202', message: 'x' }` → `falhas` contém `schema_ausente: yt_own_reach_apply`; relatório **não** é marcado normalizado nem `erro`; o passo para (o segundo relatório da fila não é tocado). E `db.errors.yt_reporting_reports = { code: '42703', message: 'x' }` → `schema_ausente: yt_reporting_reports`, resumo zerado.
11. **Leitura de `youtube_videos` que falha:** relatório fica pendente (`normalized_at` nulo, `status` intacto), `pendentes: 1`, `falhas` contém `erro de banco ao ler youtube_videos`.
12. **Erro ao marcar o relatório** (`db.writeErrors.yt_reporting_reports`): `normalizados` continua 0 e `falhas` tem a nota de banco (as linhas já gravadas ficam; a próxima execução refaz e a função aceita o mesmo relatório).
13. **Re-normalização:** rode duas vezes pondo `normalized_at: null` entre as duas: mesmas 11 linhas, `gravados: 11` nas duas.
14. **Só normaliza o tipo básico:** um relatório `channel_reach_combined_a1` `baixado` com `normalized_at` nulo não é tocado.
15. **Uma exceção num relatório não derruba os outros:** faça o `rpc` lançar na primeira chamada (`db.client.rpc` espiado com `mockImplementationOnce(() => { throw new Error('boom') })`): o segundo relatório é normalizado.

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** `alcance-step.ts` seguindo "Comportamento". Cabeçalho do arquivo:

```ts
// Passo `alcance` (spec, seção 5, "Normalizar o alcance básico" — lote L2). Só banco: lê o bruto que o passo de
// relatórios já baixou e grava uma linha por vídeo e dia em yt_own_video_reach_daily.
// Pode ser refeito a partir do bruto: `normalized_at` nulo põe o relatório de volta na fila.
// Quem decide "o mais novo vence" é a função do banco yt_own_reach_apply, não este arquivo.
```

- [ ] **Step 4: Rodar e ver passar**; `npx vitest run test/youtube/coleta` inteiro; `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: passo de alcance normaliza o bruto da Reporting API em impressões e CTR por vídeo e dia" -- apps/web/src/lib/youtube/coleta/alcance-step.ts apps/web/test/youtube/coleta/alcance-step.test.ts
```

---

### Task 4: Cliente do diário (Analytics API)

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/analytics-diario.ts`
- Test: `apps/web/test/youtube/coleta/analytics-diario.test.ts`

**Interfaces:**
- Consumes: `motivoDoGoogle` (`./google-erro`).
- Produces:

```ts
export type ColunaDiario =
  | 'views' | 'engaged_views' | 'watch_time_minutes' | 'avg_view_duration_seconds' | 'avg_view_percentage'
  | 'likes' | 'comments' | 'shares' | 'subscribers_gained' | 'subscribers_lost' | 'card_impressions' | 'card_click_rate'
export const METRICAS_BASE: readonly string[]       // 9 nomes da API
export const METRICAS_ESTENDIDAS: readonly string[] // engagedViews, cardImpressions, cardClickRate
export class AnalyticsApiError extends Error { constructor(public readonly status: number, public readonly reason: string | null) }
export interface DiaDoVideo { day: string; valores: Partial<Record<ColunaDiario, number>> }
export interface RespostaDiario { dias: DiaDoVideo[]; estendidas: 'ok' | 'recusadas' }
export async function diarioDoVideo(i: { token: string; canalUc: string; videoId: string; inicio: string; fim: string; f: typeof fetch }): Promise<RespostaDiario>
```

**Comportamento:**
- URL `https://youtubeanalytics.googleapis.com/v2/reports` com `ids=channel==<canalUc>`, `startDate=<inicio>`, `endDate=<fim>`, `dimensions=day`, `filters=video==<videoId>`, `sort=day`, `metrics=<lista>`. Sem `maxResults`. Cabeçalho `Authorization: Bearer <token>`.
- Primeira chamada com `METRICAS_BASE + METRICAS_ESTENDIDAS`. Resposta **400** → segunda chamada só com `METRICAS_BASE`, e `estendidas: 'recusadas'`. Qualquer outro não-ok (e o 400 da segunda) → `throw new AnalyticsApiError(status, await motivoDoGoogle(res))`. O corpo nunca é guardado.
- JSON inválido num 200 → `AnalyticsApiError(200, 'corpo_invalido')`.
- Sem `columnHeaders` com `name === 'day'` → `AnalyticsApiError(200, 'sem_coluna_day')` (inclusive quando `rows` é vazio e `columnHeaders` veio: aí há `day`; só lança se `columnHeaders` existir sem `day`, **ou** se houver `rows` sem `columnHeaders`). Resposta sem `rows` e sem `columnHeaders` = `{ dias: [] }`.
- Cada linha: `day` tem de casar `^\d{4}-\d{2}-\d{2}$`, senão `AnalyticsApiError(200, 'dia_invalido')` (nada é lido pela metade).
- Mapa nome da API → coluna: `views→views`, `engagedViews→engaged_views`, `estimatedMinutesWatched→watch_time_minutes`, `averageViewDuration→avg_view_duration_seconds`, `averageViewPercentage→avg_view_percentage`, `likes→likes`, `comments→comments`, `shares→shares`, `subscribersGained→subscribers_gained`, `subscribersLost→subscribers_lost`, `cardImpressions→card_impressions`, `cardClickRate→card_click_rate`.
- Um valor só entra em `valores` se a coluna veio em `columnHeaders` **e** o valor da linha é `number` finito (ou texto que `Number()` lê como finito e não é `''`). `null`, `undefined`, `''`, `NaN` → a chave fica **ausente**. Zero legítimo (`0`) entra como `0`.
- Coluna desconhecida em `columnHeaders` é ignorada.

- [ ] **Step 1: Testes que falham** (`fetch` é um `vi.fn` que devolve `new Response(JSON.stringify(corpo), { status })`):

1. Monta a URL certa: confere cada `searchParams` (inclusive que `metrics` tem os 12 nomes e que não há `maxResults`) e o cabeçalho `Authorization`.
2. **Colunas em outra ordem gravam cada valor na coluna certa (aceite 9):** `columnHeaders` = `[likes, day, views, averageViewPercentage]`, linha `[2, '2026-10-01', 40, 51.5]` → `{ day: '2026-10-01', valores: { likes: 2, views: 40, avg_view_percentage: 51.5 } }`.
3. **Sem `averageViewPercentage` no cabeçalho → chave ausente, nunca 0 (aceite 9):** `expect('avg_view_percentage' in dias[0].valores).toBe(false)`.
4. Valor `null` numa coluna presente → chave ausente; valor `0` → `0` presente.
5. **Sem linhas:** `{ columnHeaders: [...], rows: [] }` e `{ columnHeaders: [...] }` (sem `rows`) → `dias: []`, `estendidas: 'ok'`.
6. **400 na lista estendida:** primeira resposta 400, segunda 200 → duas chamadas, a segunda com `metrics` = só as 9 de base; `estendidas: 'recusadas'`.
7. 400 nas duas → lança `AnalyticsApiError` com `status: 400`.
8. 401 → lança com `status: 401`, **uma** chamada só. 403 com corpo `{ error: { errors: [{ reason: 'insufficientPermissions' }] } }` → `reason: 'insufficientPermissions'`. 500 → `status: 500`, uma chamada.
9. 200 com corpo que não é JSON → `reason: 'corpo_invalido'`.
10. `columnHeaders` sem `day` e com linhas → `reason: 'sem_coluna_day'`. Dia `'20261001'` → `reason: 'dia_invalido'`.
11. O `fetch` que lança (`SemTempoError` de `clock.ts`) é propagado sem ser embrulhado.

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Cabeçalho do arquivo:

```ts
// Diário por vídeo da YouTube Analytics API (spec, seção 6 — lote L2): uma chamada por vídeo, `dimensions=day`.
// Lê por `columnHeaders[].name`, nunca por posição. O que não veio fica AUSENTE (vira nulo no banco), nunca zero.
// O `fetch` vem de fora: quem chama passa o do prazo do passo. O corpo de erro do Google nunca é guardado.
```

- [ ] **Step 4: Rodar e ver passar**; `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: cliente do diário por vídeo da Analytics API, lido pelo nome da coluna" -- apps/web/src/lib/youtube/coleta/analytics-diario.ts apps/web/test/youtube/coleta/analytics-diario.test.ts
```

---

### Task 5: Passo `diario`

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/diario-step.ts`
- Create: `apps/web/src/lib/youtube/coleta/metric-version.ts` **se a Task 2 ainda não rodou** (a ordem de execução põe esta tarefa antes): crie o arquivo e o teste `metric-version.test.ts` exatamente como estão na Task 2 (Step 1 e Step 3) e inclua os dois no commit; a Task 2 então só confere que existem.
- Test: `apps/web/test/youtube/coleta/diario-step.test.ts`

**Interfaces:**
- Consumes: `diarioDoVideo`, `AnalyticsApiError`, `ColunaDiario` (Task 4); `metricVersion`; `obterToken`, `marcarAutorizado`, `marcarReautorizar` (`./autorizacao`); `ehPerdaDeAutorizacao` (`./google-erro`); `registrarTentativa`, `contarPorResultado`; `emParalelo`, `fetchComPrazo`, `PARALELO`, `restante`, `SemTempoError`; `dayPt`, `addDays`; `conferirBanco`, `pushUnico`.
- Produces: `passoDiario(ctx: StepCtx): Promise<DiarioResumo>` e

```ts
export interface DiarioResumo extends StepResumo {
  /** "Hoje" no Pacífico: o fim da janela pedida. */
  ate: string
  /** Vídeos cuja resposta veio sem as métricas estendidas (a API recusou a lista completa). */
  estendidas_recusadas: number
}
```
`gravados` = linhas (vídeo × dia) gravadas. `pendentes` = vídeos que o relógio não alcançou.

**Comportamento, na ordem:**

1. `canais = ctx.channels.filter(c => c.sync_enabled)`. Vazio → fecha.
2. Lê os vídeos: `youtube_videos`, `id, youtube_video_id, channel_id, site_id, published_at`, `in('channel_id', ids)`, `.not('published_at', 'is', null)`, `limit(1000)`. Falha → fecha (nota em `falhas`); `schema_ausente` não se aplica aqui. 1000 ou mais → `pushUnico(falhas, 'diário: 1000 vídeos lidos — a leitura pode estar truncada em 1000')` e segue.
3. `restante(ctx.deadline) <= 0` → tentativa `diario` `nao_alcancado_orcamento` de escopo `canal` para cada canal; `pendentes = vídeos.length`; fecha.
4. `hoje = dayPt(new Date())`. `f = fetchComPrazo(ctx.deadline)`.
5. Por canal, **em série**. `tCanal = { site_id, scope_type: 'canal', scope_id: c.id, kind: 'diario', channel_id: c.id }`.
   - Canal sem vídeos → `continue` (sem tentativa: fica fora dos critérios por vídeo).
   - `token = await obterToken(ctx, c, tCanal)`; `null` → `continue` (a tentativa `sem_conexao`/`sem_autorizacao` já foi registrada). `SemTempoError` → tentativa `nao_alcancado_orcamento` para este canal e os seguintes, soma os vídeos deles em `pendentes`, sai do laço. Outro erro → `Sentry.captureException`, `pushUnico(falhas, \`diário: ${channelNote(c.name, describeCronCause(e))}\`)`, tentativa de canal `erro_http`, `continue`.
   - **Último dia gravado de cada vídeo** (uma leitura por vídeo, `emParalelo(…, PARALELO)`): `yt_own_video_daily`, `day_pt, collected_at`, `eq('youtube_video_id', id)`, `order('day_pt', { ascending: false })`, `limit(1)`, `.maybeSingle()`. `schema_ausente` → tentativa de canal `schema_ausente` para todos os canais e **fecha o passo**. Outra falha → o vídeo entra num conjunto `semLeitura`.
   - **Ordem:** quem nunca foi coletado primeiro, depois `collected_at` crescente.
   - Por vídeo, `emParalelo(fila, PARALELO)`, `base = { site_id, scope_type: 'video', scope_id: youtube_video_id, kind: 'diario', channel_id }`:
     - canal já negado nesta execução (flag `negado`) → tentativa `sem_autorizacao`; `return`.
     - `restante(ctx.deadline) <= 0` → tentativa `nao_alcancado_orcamento`; `pendentes++`; `return`.
     - em `semLeitura` → tentativa `erro_http`, `error: 'erro de banco'`; conta em `comErro`; `return`.
     - **Janela (spec, seção 6):** sem linha anterior → `inicio = dayPt(new Date(published_at))`; com linha → `inicio = menor(addDays(hoje, -10), ultimo.day_pt)` (comparação de texto). `fim = hoje`. Se `inicio > fim` (vídeo publicado "amanhã" no Pacífico) → `inicio = fim`.
     - `r = await diarioDoVideo({ token, canalUc: c.channel_id, videoId, inicio, fim, f })`.
     - Primeira resposta boa do canal → `await marcarAutorizado(ctx, c)` **uma vez por canal** (guarde uma promessa única para não disparar quatro em paralelo).
     - `r.estendidas === 'recusadas'` → `resumo.estendidas_recusadas++`.
     - `r.dias.length === 0` → tentativa `video_novo` se `Date.now() - Date.parse(published_at) < 3 * 86_400_000`, senão `sem_dado_na_janela`; `return`.
     - Linhas: para cada dia `{ youtube_video_id, day_pt: d.day, site_id, video_id: v.id, channel_id: c.id, source: 'analytics_api', collected_at: agoraIso, metric_version: metricVersion(d.day), ...d.valores }`. **Nunca** preencha com `null` uma coluna que não veio.
     - O PostgREST exige as mesmas chaves em todas as linhas de um upsert em lote: agrupe as linhas pela assinatura `Object.keys(linha).sort().join(',')` e faça um `upsert(grupo, { onConflict: 'youtube_video_id,day_pt' })` por grupo, cada um com `conferirBanco(up, 'yt_own_video_daily', ctx.falhas)`. `schema_ausente` → tentativa `schema_ausente`; outro erro → tentativa `erro_http`, `error: 'erro de banco'`, conta em `comErro`. Todos `ok` → tentativa `ok`; `gravados += linhas.length`.
     - `catch`:
       - `SemTempoError` → tentativa `nao_alcancado_orcamento`; `pendentes++`.
       - `AnalyticsApiError` com `ehPerdaDeAutorizacao(e.status, e.reason)` → `negado = true`; `await marcarReautorizar(ctx, c)` **uma vez por canal**; tentativa `sem_autorizacao` com `http_status`.
       - outro `AnalyticsApiError` → tentativa `erro_http`, `http_status: e.status`, `error: e.reason ? \`HTTP ${e.status} ${e.reason}\` : \`HTTP ${e.status}\``; conta em `comErro` e guarda a primeira causa.
       - qualquer outra exceção → `Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'diario' }, extra: { video } })`; tentativa `erro_http`, `error: describeCronCause(e)`; conta em `comErro`.
   - Fim do canal:
     - `comErro > 0` → `pushUnico(falhas, \`diário: ${c.name}: ${comErro} de ${n} vídeos com erro (${primeiraCausa})\`)`.
     - `resumo.estendidas_recusadas` subiu neste canal → `pushUnico(falhas, \`diário: ${c.name}: a Analytics API recusou as métricas estendidas\`)` e `Sentry.captureMessage` (uma vez por canal).
     - tentativa de **canal**: `sem_autorizacao` se `negado`; `nao_alcancado_orcamento` se algum vídeo ficou pendente; senão `ok`. (`ok` no canal quer dizer "o passo rodou para este canal com token": é o que o critério A da Task 6 lê.)
6. `resumo.tentativas = contarPorResultado(ctx.tentativas, ['diario'])`.

- [ ] **Step 1: Testes que falham**

Arnês: como `reports-step.test.ts`, com `vi.mock('@/lib/social/token-refresh', …ensureFreshToken: vi.fn())`, `vi.mock('@/lib/youtube/coleta/alerts', () => ({ avisarEntrada: vi.fn(), avisarSaida: vi.fn() }))` e `vi.mock('@/lib/youtube/coleta/analytics-diario', async (orig) => ({ ...(await orig()), diarioDoVideo: vi.fn() }))`. `AGORA = new Date('2026-10-09T12:05:00.000Z')` (hoje no Pacífico = `2026-10-09`). Canal `ch-1`/`UC1`, `sync_enabled: true`. Vídeos `v(n, publicadoEm)`. `ctxDe(db, prazoMs = 50_000)` devolve o canal por **cópia**. Banco: `fakeSupabase({ youtube_channels: [canal], youtube_videos: [...], yt_own_video_daily: [] })`.

1. **Primeira vez:** vídeo publicado em `2024-12-10T15:00:00.000Z`, sem linha → `diarioDoVideo` chamado com `inicio: '2024-12-10'`, `fim: '2026-10-09'`, `canalUc: 'UC1'`, `videoId`, `token: 'tok'`.
2. **Grava o que vier:** resposta com dois dias → duas linhas com `video_id`, `channel_id`, `site_id`, `source: 'analytics_api'`, `collected_at: AGORA.toISOString()`, `metric_version` certo para cada dia (`2025-03-30` → `views_ate_2025-03-30`; `2026-10-07` → `views_desde_2026-08-27`); tentativa de vídeo `ok`; `gravados: 2`.
3. **Depois (janela de 10 dias):** última linha em `2026-10-08` → `inicio: '2026-09-29'`.
4. **Vídeo parado 20 dias (aceite 9):** última linha em `2026-09-19` → `inicio: '2026-09-19'`.
5. **Sem linhas (aceite 9):** vídeo antigo → tentativa `sem_dado_na_janela`, nenhuma linha, `falhas` vazia; vídeo publicado há 2 dias → `video_novo`.
6. **Dia da janela sem linha na resposta não é gravado:** resposta só com `2026-10-01` numa janela de 10 dias → uma linha.
7. **Duas execuções no mesmo dia → mesmas linhas (aceite 9):** rode duas vezes com a mesma resposta: 2 linhas, mesmos valores; a tentativa tem `attempts: 2`.
8. **Nunca de não nulo a nulo (Foco 4):** semeie a linha de `2026-10-07` com `views: 5, avg_view_percentage: 41.5`; resposta do dia sem `avg_view_percentage` (`valores: { views: 6 }`) → a linha fica `{ views: 6, avg_view_percentage: 41.5 }`.
9. **Dias com conjuntos de colunas diferentes:** um dia com `{ views, likes }`, outro só com `{ views }` → as duas linhas gravadas, cada uma só com o que veio (`'likes' in linha2` é falso); dois upserts.
10. **Ordem:** três vídeos — um sem linha, um com `collected_at` de ontem, um de anteontem — com `PARALELO` forçado a 1 pela resposta em série (`diarioDoVideo` registra a ordem das chamadas): nunca coletado, anteontem, ontem.
11. **401 da Analytics:** primeira chamada lança `AnalyticsApiError(401, null)` → `youtube_channels.collection_status === 'reautorizar'`, `ctx.negados` tem `ch-1`, tentativa do vídeo `sem_autorizacao` com `http_status: 401`, os outros vídeos do canal `sem_autorizacao` sem chamada nova (aceite: no máximo `PARALELO` chamadas), tentativa de canal `sem_autorizacao`, `falhas` vazia (perda de autorização é ação do dono).
12. **403 `insufficientPermissions`** → igual ao 11. **403 `quotaExceeded`** → tentativa `erro_http` `http_status: 403`, canal continua `ok`, `falhas` contém `diário: Canal Um: 1 de 1 vídeos com erro (HTTP 403 quotaExceeded)`.
13. **500 em 2 de 3 vídeos:** as linhas do terceiro são gravadas; `falhas` = [`diário: Canal Um: 2 de 3 vídeos com erro (HTTP 500)`]; tentativa de canal `ok`.
14. **Sucesso carimba a autorização uma vez:** 4 vídeos, 4 respostas boas → `ctx.autorizados` tem `ch-1` e houve **um** `update` em `youtube_channels` com `authorization_verified_at`.
15. **Métricas estendidas recusadas:** `estendidas: 'recusadas'` → `estendidas_recusadas: 1`, linhas gravadas, `falhas` contém `diário: Canal Um: a Analytics API recusou as métricas estendidas` (uma vez, mesmo com 3 vídeos).
16. **Relógio estourado no começo:** `deadline = Date.now()` → tentativa de canal `nao_alcancado_orcamento`, `pendentes` = nº de vídeos, `diarioDoVideo` não chamado.
17. **`SemTempoError` no meio:** segunda chamada lança `SemTempoError` → tentativa do vídeo `nao_alcancado_orcamento`, `pendentes: 1`, tentativa de canal `nao_alcancado_orcamento`, `falhas` vazia.
18. **Sem conexão:** `ensureFreshToken` lança `NoActiveConnectionError` e não há conexão revogada → tentativa de canal `sem_conexao`, nenhuma tentativa de vídeo, `falhas` vazia. **Token revogado** (`TokenRevokedError`) → tentativa de canal `sem_autorizacao`, canal `reautorizar`.
19. **Canal com sync desligado** é ignorado (nenhuma tentativa, nenhuma chamada).
20. **Sem a migration (Foco 5):** `db.errors.yt_own_video_daily = { code: '42P01', message: 'x' }` → `falhas` = [`schema_ausente: yt_own_video_daily`], tentativa de canal `schema_ausente`, `diarioDoVideo` não chamado.
21. **Erro de banco ao gravar** (`db.writeErrors.yt_own_video_daily = { code: '23514', message: 'x' }`) → tentativa `erro_http` `error: 'erro de banco'`; `falhas` contém `erro de banco ao gravar yt_own_video_daily` e `diário: Canal Um: 1 de 1 vídeos com erro (…)`; `gravados: 0`.
22. **Leitura da última linha que falha para um vídeo** (use `db.client.from` espiado para devolver erro só na leitura daquele `youtube_video_id`) → esse vídeo `erro_http`, os outros gravados. A leitura que falha **não** vira "primeira vez".
23. **Vídeo sem `published_at`** não entra (o filtro da leitura). **Canal sem vídeos**: nenhuma tentativa.

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Cabeçalho do arquivo:

```ts
// Passo `diario` (spec, seção 6, "Diário por vídeo" — lote L2). Uma chamada à Analytics API por vídeo, por dia.
// A janela sempre começa, no máximo, no último dia já gravado do vídeo: um vídeo que já teve linha só volta vazio
// se a API parou de responder — e é isso que o critério de "nenhum vídeo com diário ok" denuncia.
// Dia sem atividade não vem na resposta e não é gravado: sem linha = sem atividade ou não medido, nunca zero.
// Coluna que não veio fica FORA do payload: uma segunda execução nunca leva um campo de não nulo a nulo.
```

- [ ] **Step 4: Rodar e ver passar**; a pasta `test/youtube/coleta` inteira; `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: passo do diário por vídeo grava o que a Analytics API devolve, sem inventar zero" -- apps/web/src/lib/youtube/coleta/diario-step.ts apps/web/test/youtube/coleta/diario-step.test.ts apps/web/src/lib/youtube/coleta/metric-version.ts apps/web/test/youtube/coleta/metric-version.test.ts
```

---

### Task 6: Três critérios novos

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/criteria-l2.ts`
- Test: `apps/web/test/youtube/coleta/criteria-l2.test.ts`

**Interfaces:**
- Consumes: `conferirBanco`, `pushUnico`; `addDays`, `utcDay`; `StepCtx`.
- Produces: `criteriosL2(ctx: Pick<StepCtx, 'supabase' | 'falhas' | 'channels'>): Promise<void>`.

**Regra do arquivo (copie como comentário no topo, é a mesma de `criteria.ts`):** um critério cuja leitura falhou não avalia como "nada de errado": registra `critérios: não foi possível avaliar <critério> (<tabela>)` e segue para o próximo.

**Critério A — diário sem dado (spec, seção 9):** para cada canal com `sync_enabled`:
1. Conta os vídeos: `youtube_videos`, `count: 'exact', head: true`, `eq('channel_id', c.id)`, `.not('published_at', 'is', null)`. `count` nulo → `não foi possível avaliar diário de <canal> (youtube_videos): contagem ausente`. Menos de 5 → fora do critério.
2. Lê os dias em que o passo rodou para o canal: `yt_own_collection_attempts`, `attempt_day`, `scope_type = 'canal'`, `scope_id = c.id`, `kind = 'diario'`, `outcome = 'ok'`, `attempt_day >= addDays(utcDay(agora), -14)`, `order attempt_day desc`, `limit(3)`. Menos de 3 dias → ainda cedo, não é falha.
3. Conta os vídeos com diário `ok` nesses 3 dias: mesma tabela, `count: 'exact', head: true`, `scope_type = 'video'`, `kind = 'diario'`, `outcome = 'ok'`, `channel_id = c.id`, `in('attempt_day', [os 3 dias])`. `count === 0` → `pushUnico(falhas, \`diário: ${c.name} não tem nenhum vídeo com diário ok nas 3 últimas execuções\`)`. `count` nulo → nota de "contagem ausente".

Dias com tentativa de canal `sem_conexao`, `sem_autorizacao`, `nao_alcancado_orcamento` ou `erro_http` não contam como execução (é o "em que o canal tinha conexão viva e `collection_status = 'ok'`" do spec).

**Critério B — alcance sem linha nova (spec, seção 9, com a emenda 2):** para cada canal com `sync_enabled`:
1. Job básico: `yt_reporting_jobs`, `status, job_create_time, created_at`, `eq('channel_id', c.id)`, `eq('report_type_id', 'channel_reach_basic_a1')`, `.maybeSingle()`. Sem linha, ou `status !== 'ativo'`, ou idade (`job_create_time ?? created_at`) menor que 6 dias → fora.
2. Publicou nos últimos 90 dias? `youtube_videos`, `count`, `gte('published_at', iso(agora − 90 d))`. Zero → fora. Nulo → nota.
3. Linha nova: `yt_own_video_reach_daily`, `count: 'exact', head: true`, `eq('channel_id', c.id)`, `gte('collected_at', iso(agora − 4 d))`. Zero → `pushUnico(falhas, \`alcance: ${c.name} está sem linha nova de alcance há mais de 4 dias\`)`.

**Critério C — baixado e não normalizado (fora do spec, decisão 6 deste plano):** uma leitura só: `yt_reporting_reports`, `count: 'exact', head: true`, `eq('report_type_id', 'channel_reach_basic_a1')`, `in('status', ['baixado', 'vazio'])`, `.is('normalized_at', null)`, `lt('downloaded_at', iso(agora − 2 d))`. Maior que zero → `pushUnico(falhas, \`alcance: ${n} relatório(s) baixado(s) há mais de 2 dias sem normalizar\`)`.

- [ ] **Step 1: Testes que falham** (`AGORA = new Date('2026-10-20T12:10:00.000Z')`, fake timers; banco `fakeSupabase`; helpers `tent(dia, escopo, outcome, extra)`):

A:
1. Canal com 5 vídeos, 3 dias com tentativa de canal `ok` e nenhuma de vídeo `ok` (todas `sem_dado_na_janela`) → nota do critério A.
2. O mesmo com um vídeo `ok` no dia do meio → sem nota.
3. Só 2 dias com tentativa de canal `ok` → sem nota (cedo).
4. Canal com 4 vídeos → sem nota.
5. Três dias, sendo o do meio com tentativa de canal `sem_autorizacao`: os 3 dias `ok` considerados são os outros (semeie 4 dias); com um vídeo `ok` só no dia `sem_autorizacao` → **há** nota.
6. Canal com `sync_enabled: false` → sem nota.
7. Leitura de `yt_own_collection_attempts` falhando → `erro de banco ao ler yt_own_collection_attempts` e `critérios: não foi possível avaliar diário de Canal Um (yt_own_collection_attempts)`; nenhuma nota do critério A.

B:
8. Job ativo há 7 dias, vídeo publicado há 30 dias, nenhuma linha de alcance → nota B.
9. O mesmo com uma linha `collected_at` de 3 dias atrás → sem nota; de 5 dias atrás → nota.
10. Job ativo há 5 dias → sem nota. Job `sem_acesso` → sem nota.
11. Última publicação há 200 dias → sem nota (emenda 2).
12. Leitura de `yt_own_video_reach_daily` falhando → nota de "não foi possível avaliar", nunca verde.

C:
13. Um `baixado` e um `vazio` com `downloaded_at` de 3 dias atrás e `normalized_at` nulo → `alcance: 2 relatório(s) baixado(s) há mais de 2 dias sem normalizar`.
14. `downloaded_at` de 1 dia atrás → sem nota. `normalized_at` preenchido → sem nota. Tipo `channel_reach_combined_a1` → sem nota. `status: 'erro'` → sem nota (o critério de relatório em erro cuida).
15. Erro de leitura num critério não impede os outros dois de rodar.

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar**; `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: três critérios do L2 fecham o diário sem dado, o alcance parado e o relatório baixado sem normalizar" -- apps/web/src/lib/youtube/coleta/criteria-l2.ts apps/web/test/youtube/coleta/criteria-l2.test.ts
```

---

### Task 7: Ligar os passos em `rodarColeta`

**Files:**
- Modify: `apps/web/src/lib/youtube/coleta/clock.ts` (`TETOS_MS`)
- Modify: `apps/web/src/lib/youtube/coleta/index.ts`
- Modify: `apps/web/test/youtube/coleta/index.test.ts`
- Modify: `apps/web/test/youtube/coleta/tres-dias.test.ts`
- Modify: `apps/web/test/youtube/coleta/orcamento.test.ts`, `clock.test.ts` (só onde afirmam a lista de tetos ou de kinds)

**Interfaces:**
- Consumes: `passoAlcance` (Task 3), `passoDiario` (Task 5), `criteriosL2` (Task 6).
- Produces: `PASSOS_LIGADOS = { metadados: true, jobs: true, relatorios: true, alcance: true, diario: true }`; `TETOS_MS = { metadados: 30_000, jobs: 20_000, relatorios: 60_000, alcance: 20_000, diario: 50_000 }`; `resumo.alcance`, `resumo.diario`, `resumo.ms.alcance`, `resumo.ms.diario`.

**Mudanças em `index.ts`, fase `depois`, logo depois do bloco `if (PASSOS_LIGADOS.relatorios) { … }` e antes de `if (PASSOS_LIGADOS.metadados)`:**

```ts
  // Alcance: normaliza o bruto que o passo de relatórios acabou de baixar. `servidos` vazio de propósito: sem tempo,
  // este passo NÃO registra tentativa — uma `nao_alcancado_orcamento` de kind `relatorio` no canal sobrescreveria a
  // tentativa `ok` que o passo de relatórios gravou hoje. O que ficou por fazer aparece em `pendentes` e, se durar,
  // no critério "baixado há mais de 2 dias sem normalizar".
  if (PASSOS_LIGADOS.alcance) {
    const r = await passo('alcance', TETOS_MS.alcance, 'relatorio', [], passoAlcance)
    if (r) resumo.alcance = r
  }
  if (PASSOS_LIGADOS.diario) {
    const r = await passo('diario', TETOS_MS.diario, 'diario', ativos, passoDiario)
    if (r) resumo.diario = r
  }
  if (PASSOS_LIGADOS.alcance || PASSOS_LIGADOS.diario) {
    try {
      await criteriosL2({ supabase: ctx.supabase, falhas, channels })
    } catch (e) {
      falhou('critérios do L2', e)
    }
  }
```

Atenção à ordem com o bloco de relatórios: `criteriosRelatorios` (que denuncia "relatório de alcance em erro") roda **antes** do passo `alcance`, então um cabeçalho inesperado achado hoje só ficaria vermelho amanhã. Mova a chamada de `criteriosRelatorios` (o `try` inteiro que preenche `perdidos`, `atrasados`, `vazios_sem_publicacao` e `acao_do_dono`) para **depois** do bloco do `alcance` e antes do bloco do `diario`. O `passo('relatorios', …)` continua onde está; `rel` e `resumo.relatorios` são montados depois do critério, como hoje.

E em `criterioOrcamento(…, ['meta', 'thumbnail', 'sondagem', 'relatorio'])` acrescente `'diario'`.

O comentário do topo do arquivo (linha 2) passa a: `// Ordem do spec: metadados → 1A → o que o cron já faz → 1C → alcance → diário.`

- [ ] **Step 1: Atualizar `index.test.ts` (falha antes da mudança)**

- `vi.mock('@/lib/youtube/coleta/alcance-step', () => ({ passoAlcance: vi.fn() }))`, idem `diario-step` (`passoDiario`) e `criteria-l2` (`criteriosL2`); no `beforeEach`, `passoAlcance` resolve `{ ...resumoVazio, normalizados: 2, vazios: 1, erros: 0, sem_par: 0 }` e `passoDiario` resolve `{ ...resumoVazio, gravados: 9, ate: '2026-10-07', estendidas_recusadas: 0 }`.
- "os três passos nascem ligados" vira "os cinco passos nascem ligados", com o objeto de cinco chaves.
- A asserção de `criterioOrcamento` passa a `['meta', 'thumbnail', 'sondagem', 'relatorio', 'diario']`.
- Testes novos:
  1. fase `depois`: a ordem de chamada é `passoRelatorios` → `passoAlcance` → `criteriosRelatorios` → `passoDiario` → `criteriosL2` (por `mock.invocationCallOrder`); `ctxAlcance.deadline - Date.now() === 20_000`; `ctxDiario.deadline - Date.now() === 50_000`; `resumo` tem `alcance: { normalizados: 2 }`, `diario: { gravados: 9 }`, e `ms` com as chaves `relatorios`, `alcance`, `diario`.
  2. fase `antes`: `passoAlcance`, `passoDiario` e `criteriosL2` **não** são chamados.
  3. exceção em `passoAlcance` → `falhas` = [`alcance: unexpected error (Error)`] e `passoDiario`, `criteriosRelatorios` e `criteriosL2` rodam.
  4. exceção em `passoDiario` → `falhas` = [`diario: unexpected error (Error)`] e `criteriosL2`, `criterioMetadados` e `criterioOrcamento` rodam.
  5. exceção em `criteriosL2` → `falhas` = [`critérios do L2: database error`] (com `new Error('statement timeout')`), e `criterioOrcamento` roda.
  6. relógio global vencido (`criarRelogio(Date.now() - 300_000)`): `passoDiario` não é chamado e há uma tentativa `diario` `nao_alcancado_orcamento` de escopo `canal` só para o canal com sync (`ch-1`); **nenhuma** tentativa de kind `relatorio` é criada pelo passo `alcance` (conte as tentativas `relatorio` de escopo canal: só as do passo de relatórios, uma por canal ativo).
  7. o passo `diario` recebe só... **todos** os canais em `ctx.channels` (o filtro de `sync_enabled` é dele); o que muda é `servidos`. Afirme `ctxDiario.channels.map(c => c.id)` = `['ch-1', 'ch-2']`.

- [ ] **Step 2: Rodar e ver falhar**; **Step 3: implementar** as mudanças de `clock.ts` e `index.ts`; **Step 4: ver passar.**

- [ ] **Step 5: `tres-dias.test.ts` com os passos de verdade**

Leia o arquivo inteiro antes. Mudanças:
- `CSV_COM_DADO` e `CSV_SO_CABECALHO` passam a usar o cabeçalho real. O `channel_id` da linha tem de ser o do canal dono do job e o `video_id` um vídeo dele, então deixam de ser constantes e viram funções: `csvComDado(uc: string, videoId: string, dia: string)` = `` `date,channel_id,video_id,video_thumbnail_impressions,video_thumbnail_impressions_ctr\n${dia},${uc},${videoId},100,0.05\n` `` e `csvSoCabecalho()`; `Google.publicar` passa o `uc` do job e o primeiro vídeo do canal (para `ANTIGO`: `yt-ch-antigo-1`). Sem isso todo relatório de alcance viraria `erro` (`cabecalho_inesperado`) e os três dias ficariam vermelhos — é o comportamento certo do código novo, e é por isso que a semente muda.
- `banco()`: acrescente `yt_own_video_daily: []`, `yt_own_video_reach_daily: []` à semente e envolva em `comReachApply(...)`.
- `vi.mock('@/lib/youtube/coleta/analytics-diario', async (orig) => ({ ...(await orig()), diarioDoVideo: vi.fn() }))`; no `beforeEach`, `diarioDoVideo` resolve `{ dias: [{ day: '2026-10-03', valores: { views: 1 } }], estendidas: 'ok' }`.
- Testes novos, no fim do arquivo:
  1. **três dias saudáveis:** depois do dia 3, `falhas` vazia nos três dias; `yt_own_video_daily` tem uma linha por vídeo de `ANTIGO` (3); `yt_own_video_reach_daily` tem linhas; todo relatório `channel_reach_basic_a1` `baixado` ou `vazio` tem `normalized_at`.
  2. **diário mudo por três dias (Foco 1):** `ANTIGO` com 5 vídeos e `diarioDoVideo` resolvendo `{ dias: [], estendidas: 'ok' }` → dias 1 e 2 sem a nota; no dia 3 `falhas` contém `diário: Canal Antigo não tem nenhum vídeo com diário ok nas 3 últimas execuções`.
  3. **cabeçalho que muda no dia 2 (Foco 2/3):** os relatórios publicados no dia 2 têm uma coluna a mais → no dia 2 `falhas` contém `relatórios: Canal Antigo tem relatório de alcance channel_reach_basic_a1 em erro`; os do dia 1 continuam normalizados.
- Os testes antigos do arquivo continuam verdes sem afrouxar asserção. Se um deles passar a falhar por causa de uma nota nova legítima (por exemplo `diário: …`), **pare e reporte** qual nota e por quê, em vez de editar a expectativa.

- [ ] **Step 6: Rodar a pasta e os testes da rota**

```bash
cd apps/web && npx vitest run test/youtube/coleta test/cron/sync-analytics-metrics.test.ts test/api/cron/sync-analytics-metrics.test.ts && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git commit -m "feat: alcance e diário por vídeo entram na fase final da coleta, com teto e critérios próprios" -- apps/web/src/lib/youtube/coleta/clock.ts apps/web/src/lib/youtube/coleta/index.ts apps/web/test/youtube/coleta/index.test.ts apps/web/test/youtube/coleta/tres-dias.test.ts apps/web/test/youtube/coleta/orcamento.test.ts apps/web/test/youtube/coleta/clock.test.ts
```
(liste só os arquivos que de fato mudaram)

---

### Task 8: Buraco das tags no passo de metadados (adiado da revisão final do L1b)

**Files:**
- Modify: `apps/web/src/lib/youtube/coleta/meta-step.ts:402,422,444`
- Test: `apps/web/test/youtube/coleta/meta-step.test.ts`

**O defeito:** numa execução **sem captura** (`cap` nulo) em que o dia do canal está ilegível (`diaIlegivel`) e `youtube_videos.tags` é nulo, `preservar` é falso, `tagsHash = sha256(JSON.stringify([]))` e o payload leva `tags_sha256` (hash de lista vazia) e `tags: []` por cima do que a primeira execução do dia gravou pela API. É o mesmo buraco que o L1b fechou para `title_at_capture` e `description_sha256` (linhas 420–421), e que ficou aberto para as tags.

**A regra:** tags nulas sem captura = "não sabemos". Sem captura, `tags_sha256` e `tags` só entram no payload quando `v.tags` não é nulo. Com captura, vale o que veio (lista vazia inclusive: a API respondeu).

- [ ] **Step 1: Teste que falha** (leia o arnês de `meta-step.test.ts` e reaproveite os helpers de "segunda execução" e de "dia ilegível" que o arquivo já tem — procure por `diaIlegivel`/`ilegível` e por `sha256`):

```ts
it('sem captura, dia ilegível e tags nulas em youtube_videos: tags_sha256 e tags da primeira execução ficam', async () => {
  // 1ª execução: captura pela API com tags ['a', 'b'].
  // 2ª execução: videos.list falha (sem captura), a leitura das linhas do dia falha (dia ilegível),
  // e youtube_videos.tags é null.
  // Esperado: a linha continua com tags ['a', 'b'] e tags_sha256 = sha256('["a","b"]').
})
it('sem captura e tags nulas no PRIMEIRO dia: tags_sha256 e tags ficam nulos (nunca o hash de uma lista inventada)', async () => {})
it('com captura e lista de tags vazia: grava tags [] e o hash de [] (a API respondeu)', async () => {})
```
Escreva os três com as sementes do arquivo. O primeiro e o segundo têm de falhar antes da correção; o terceiro passa antes e depois.

- [ ] **Step 2: Rodar e ver os dois falharem.**
- [ ] **Step 3: Corrigir**

```ts
      // Tags nulas sem captura = não sabemos: hash nulo, nunca o hash de uma lista vazia inventada.
      const tagsHash = cap || tags !== null ? sha256(JSON.stringify(tags ?? [])) : null
```
```ts
        if (cap || tagsHash !== null) linha.tags_sha256 = tagsHash
```
```ts
      if (!preservar && tagsHash !== null && (!ant || ant.tags_sha256 !== tagsHash)) linha.tags = tags ?? []
```

- [ ] **Step 4: Rodar `meta-step.test.ts` inteiro e `tres-dias.test.ts`.** Se um teste antigo dependia do hash de lista vazia para vídeo sem tags e sem captura, reporte antes de mudar a expectativa.
- [ ] **Step 5: Commit**

```bash
git commit -m "fix: tags nulas sem captura não gravam o hash de uma lista vazia por cima do que a API trouxe" -- apps/web/src/lib/youtube/coleta/meta-step.ts apps/web/test/youtube/coleta/meta-step.test.ts
```

---

### Task 9: Runbook, emendas ao spec e roteiro (execução direta do controlador)

**Files:** `docs/ops/youtube-coleta-canais-proprios-runbook.md`, `docs/superpowers/specs/2026-10-07-coleta-canais-proprios-design.md`, `docs/superpowers/plans/2026-10-08-proximos-passos.md` (leva junto a seção 3a que estava sem commit).

- [ ] Runbook: título e seção 1 (duas tabelas novas, o que volta e o que não volta); seção 2 (tetos `alcance` 20 s e `diario` 50 s); seção 3 (`coleta.alcance`, `coleta.diario`); seção 4 (SELECTs das duas tabelas; `kind = 'diario'` e os resultados `sem_dado_na_janela`/`video_novo`); seção 6 (todas as notas novas: extraia com `grep -n "pushUnico" apps/web/src/lib/youtube/coleta/{alcance-step,diario-step,criteria-l2}.ts` e confira uma a uma); seção 7 (cabeçalho real e unidade do CTR preenchidos; data de produção); seção 8 ("Re-normalizar um relatório": `update yt_reporting_reports set normalized_at = null where report_id = '…'`, e para um relatório em `erro` por cabeçalho: `set status = 'baixado', error = null`; você roda); seção 10 (`PASSOS_LIGADOS.alcance`/`.diario`); seção 11 (sete `delete`, os dois novos primeiro); seção 12 ("Rollback do L2": reverter o código; se precisar, `drop function yt_own_reach_apply`, `drop table` das duas e recriar o impacto de remoção com o corpo de `20261008000002`); seção 13 (limites: `maxResults` sem teto documentado; cliques não são gravados; `metric_version` do alcance usa os mesmos cortes).
- [ ] Spec: seção "Emendas de 09/10/2026 (depois do L2)" no topo, com as decisões da seção seguinte deste plano e os fatos do CSV real.
- [ ] Commit `docs:` por caminho, com os três arquivos.

---

### Task 10: Suíte inteira, push, CI, promoção (execução direta do controlador)

- [ ] `cd apps/web && npx vitest run 2>&1 | tee /tmp/…/suite-l2-1.log` (o log fica guardado). Zero falhas. Se uma rodada falhar e a seguinte passar, o teste intermitente é identificado pelo log **antes** de seguir.
- [ ] `HAS_LOCAL_DB=1 npx vitest run test/integration/coleta-l2-migration.test.ts test/integration/coleta-l1a-migration.test.ts test/integration/youtube-channel-remove.test.ts`.
- [ ] `npx tsc --noEmit` em `apps/web`; `npm run typecheck -w apps/api` se o pre-push pedir.
- [ ] **Portão do dono:** `npm run db:push:prod` (só esse comando; conferir com `npx supabase db query --linked "select count(*) from yt_own_video_daily"` é opcional).
- [ ] **Portão do dono:** autorização para o push em `staging`. Um push.
- [ ] CI de `staging` verde (`gh run list --branch staging --limit 3`).
- [ ] **Portão do dono:** autorização para promover. Antes: `git fetch origin && git log origin/staging..origin/main --oneline` vazio. Depois:

```bash
M=$(git commit-tree "origin/staging^{tree}" -p origin/main -p origin/staging -m "merge: staging → main (lote L2 da coleta)")
git push origin "${M}:refs/heads/main"
```

### Task 11: Conferência em produção (execução direta do controlador)

- [ ] Na manhã seguinte à promoção, depois das 09:00:

```bash
npx supabase db query --linked "select ran_at, ms_total, ms_passos, falhas, acao_do_dono, resumo->'diario' as diario, resumo->'alcance' as alcance from yt_own_collection_runs order by ran_at desc limit 2"
npx supabase db query --linked "select count(*) as linhas, count(views) as com_views, count(engaged_views) as com_engaged, count(avg_view_percentage) as com_percentual, count(distinct youtube_video_id) as videos, min(day_pt) as primeiro, max(day_pt) as ultimo from yt_own_video_daily"
npx supabase db query --linked "select count(*) as linhas, count(thumbnail_impressions) as com_impressoes, count(thumbnail_ctr) as com_ctr, count(video_id) as com_par, min(day_pt), max(day_pt) from yt_own_video_reach_daily"
npx supabase db query --linked "select status, normalized_at is not null as normalizado, count(*) from yt_reporting_reports where report_type_id = 'channel_reach_basic_a1' group by 1, 2 order by 1, 2 limit 10"
npx supabase db query --linked "select scope_type, outcome, count(*) from yt_own_collection_attempts where kind = 'diario' and attempt_day = (now() at time zone 'utc')::date group by 1, 2 order by 1, 2 limit 20"
```
O que olhar primeiro, nesta ordem: (1) existe linha? `linhas = 0` no diário com `falhas` vazia é a falha em verde do lote; (2) `com_views = linhas`; (3) `com_engaged = 0` com `falhas` vazia quer dizer que a lista estendida foi recusada e a nota não saiu; (4) soma das impressões de 25/09 = 22 e de 30/09 = 71 (os dois CSVs lidos em 09/10); (5) `primeiro` perto de 2015 para o vídeo mais antigo — se o primeiro dia de todos os vídeos for recente, suspeite de corte por `maxResults`.
- [ ] Conferir 3 vídeos contra o YouTube Studio (do dono).
- [ ] **Aceite 9, 48 h depois:** `select count(*), count(views) from yt_own_video_daily` com pelo menos 80% preenchido.

---

## Decisões que este plano toma e o spec não fecha

Cada uma vira "Ruling" no ledger, com o custo.

1. **Passo `alcance` separado, com teto próprio de 20 s.** O spec põe a normalização dentro do 1C (60 s), que em 09/10 já gastou 32 s com 40 downloads. Tetos somados: 30 + 20 + 60 + 20 + 50 = 180 s, mais ~21 s da parte antiga, de 270 s. Custo se errado: 20 s a menos de folga para a retenção do L3 (40 s): cabe.
2. **Linha de alcance de vídeo sem par em `youtube_videos` é gravada assim mesmo**, com `video_id` nulo, e o id vai para `unmatched_video_ids`. O spec só diz que o id vai para a lista. Motivo: o bruto é apagado 90 dias depois de normalizado e esse número não volta. Custo se errado: linhas de vídeos fora do catálogo (os leitores juntam por `video_id` e não as veem).
3. **`unmatched_video_ids` = `{ count, ids }`**, ou nulo quando todos têm par.
4. **`canal_inesperado`, `linha_invalida`, `bruto_ausente`:** três motivos de `erro` além de `cabecalho_inesperado`. Um CSV com `channel_id` de outro canal, uma linha que não se lê, ou um relatório `baixado` sem bruto não são normalizados pela metade. Custo se errado: um relatório bom marcado `erro` (o bruto fica; volta com um `update`, runbook §8).
5. **Relatório `vazio` também é "normalizado"** (cabeçalho conferido, `normalized_at` preenchido). Sem isso o bruto de 71 bytes de cada dia vazio nunca seria apagado, e uma mudança de cabeçalho num dia sem impressões passaria despercebida.
6. **Critério novo: relatório básico baixado há mais de 2 dias sem normalizar é falha crítica.** É a falha em verde do normalizador parado. Custo se errado: vermelho por um atraso de 2 dias que se resolveria sozinho.
7. **"Primeira vez" = vídeo sem linha em `yt_own_video_daily`**, e não "nenhuma tentativa `diario` `ok`". São equivalentes (tentativa `ok` = gravou linha) e poupa ler o histórico de tentativas. Consequência: vídeo sem nenhuma atividade na vida é pedido desde a publicação todo dia (é uma chamada de qualquer jeito).
8. **Erro HTTP em vídeo deixa o cron vermelho no dia** (`diário: <canal>: N de M vídeos com erro`). O spec só fala de exceção no passo. Sem isso, a Analytics fora do ar por uma semana terminaria verde. Custo se errado: vermelho por instabilidade passageira do Google.
9. **Métricas estendidas recusadas (400) são falha crítica**, e o passo repete com as nove de base. O spec só define esse recuo para a consulta de janela do L3. Custo se errado: vermelho permanente até um commit tirar a métrica recusada — é um defeito de contrato que precisa mesmo de commit.
10. **Perda de autorização no meio do canal para as chamadas restantes daquele canal** (os outros vídeos ficam `sem_autorizacao` sem chamar).
11. **`metric_version` segue os cortes do spec (31/03/2025 e 27/08/2026) nas duas tabelas.** O histórico de revisões do Google (lido em 09/10) confirma as duas mudanças de contagem nessas datas, mas diz que a Analytics API só passou a refletir a de Shorts em 30/04/2025. O spec manda parar e perguntar nesse caso; a pergunta foi feita ao dono em 09/10 e o lote segue com o corte do spec. Custo se errado: rótulo impreciso em dias de 31/03 a 29/04/2025 de Shorts (o canal tem 0 Shorts); a coluna deriva de `day_pt` e se corrige com um `update`.
12. **`maxResults` não é enviado.** A documentação não dá padrão nem teto. Se houver um corte silencioso, o primeiro carregamento de um vídeo antigo viria truncado: a Task 11 confere o primeiro dia gravado. Custo se errado: histórico antigo incompleto, recuperável (a Analytics API serve o passado).
13. **Cliques não são gravados.** O CSV não tem a coluna; `impressões × CTR` reconstrói o número e fica para o leitor.
14. **A função de impacto de remoção passa a contar as duas tabelas novas** (o runbook vai de cinco para sete `delete`). A pergunta do dono sobre a função apagar sozinha tentativas e jobs continua aberta e não muda esta parcela: diário e alcance são série, não registro de execução.
15. **O passo `alcance` não registra tentativas** (não há `kind` para ele e criar um exigiria mexer no `check` e na função do L1a). O estado mora no relatório: `normalized_at`, `status`, `error`.
16. **`criteriosRelatorios` passa a rodar depois do passo `alcance`**, para um cabeçalho inesperado ficar vermelho no mesmo dia.

## Adiados do L1a/L1b: o que entra e o que fica

| Adiado | Neste lote |
|---|---|
| Buraco das tags (sem captura + dia ilegível) | **entra** (Task 8): é dado que não volta |
| Download que falha consome vaga do teto de 40; `gzip_invalido` final | fica: nunca ocorreu em produção (40 de 40 baixaram em 09/10) e mexe no ciclo de vida do relatório; reavaliar se `erros_download` passar de 0 |
| Filtro de `acao_do_dono` por sufixo de texto | fica: cosmético |
| Testes da rota não cobrem o aviso real | fica |
| Teto de 8 s da captura somado entre canais; `videosList` tudo ou nada | fica: 35 vídeos, 1 chamada |
| M8 sonda de Shorts sempre inconclusiva fica verde | fica: 0 vídeos de 61 a 180 s sem confirmação em 09/10 |
| M10, M11, M12 | ficam |
| Lacuna do rodízio; critérios sem filtro de sync desligado; paginação acima de ~25 canais | ficam |

## Auto-revisão

- **Cobertura do spec:** §2 L2 → Task 1; §5 normalizar → Tasks 2 e 3 (cabeçalho, "só sobrescreve se maior", agregação, sem par); §6 diário → Tasks 4 e 5 (primeira vez, janela, grava o que vier, vazio/vídeo novo, upsert); §6 autorização → Task 5; §7 ordem e tetos → Task 7; §9 "a partir do L2" (dois itens) → Task 6; aceite 9 → Tasks 2 (CSV real), 3 (cabeçalho, mais antigo), 4 (ordem das colunas, sem `averageViewPercentage`), 5 (sem linhas, duas execuções, parado 20 dias), 11 (produção). §10 rollback e runbook → Task 9.
- **Foco da revisão:** 1 → Tasks 5 e 6 e `tres-dias`; 2 → Task 6 (C); 3 → Tasks 1 e 3; 4 → Tasks 1 e 5; 5 → Tasks 3, 5 e 7.
- **Nomes entre tarefas:** `metricVersion`, `lerAlcanceBasico`, `agregarAlcance`, `CsvAlcanceError`, `passoAlcance`, `AlcanceResumo`, `diarioDoVideo`, `AnalyticsApiError`, `ColunaDiario`, `passoDiario`, `DiarioResumo`, `criteriosL2`, `comReachApply`, `yt_own_reach_apply`, `TETOS_MS.alcance`, `TETOS_MS.diario` — a mesma grafia em todas as tarefas.
- **O que este plano não fez:** nenhum teste rodou ao planejar. As Tasks 3, 5, 6 e 8 descrevem os casos de teste com as asserções, mas não trazem o código de cada `it`: o implementador lê o arnês do arquivo vizinho indicado e o revisor confere que todos os casos listados existem e afirmam o que o texto diz. Na Task 8 o plano manda reaproveitar helpers de `meta-step.test.ts` que não foram lidos por inteiro.
- **Risco conhecido:** a soma 71 da Task 2 foi calculada por script a partir do bruto lido em 09/10; se o teste discordar, vale o arquivo, e a diferença é reportada.
