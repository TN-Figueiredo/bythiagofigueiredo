# Coleta dos canais próprios — lote L1a — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Começar hoje a guardar o que não volta dos canais próprios do YouTube — jobs da Reporting API criados, o CSV bruto de cada relatório baixado e uma linha por vídeo por dia com título, thumbnail e variante de A/B no ar — dentro do cron `sync-analytics-metrics`, com um único veredito de saúde.

**Architecture:** Uma migration aditiva cria cinco tabelas e duas funções. O código novo vive em `apps/web/src/lib/youtube/coleta/` atrás de `rodarColeta({ supabase, relogio, fase })`, chamado duas vezes pela rota (`fase: 'antes'` = metadados + 1A; `fase: 'depois'` = 1C + critérios), com a parte antiga da rota rodando entre as duas, dentro de um `try`. Tudo acumula em `falhas[]`; a última linha da rota chama `recordCronFailure` uma vez ou `recordCronSuccess`.

**Tech Stack:** Next.js 16 (route handler, `maxDuration`), TypeScript 5 strict, Supabase (PostgreSQL 17, PostgREST, service role), Vitest 3, `sharp` + `@vercel/blob` (já usados por `thumb-fingerprint.ts`), `node:zlib`, `node:crypto`, `Intl.DateTimeFormat`.

**Spec:** `docs/superpowers/specs/2026-10-07-coleta-canais-proprios-design.md` (rascunho v5). Onde este plano diverge do spec, a divergência está na seção final "Divergências do spec encontradas ao planejar", com a decisão tomada.

## Global Constraints

- Trabalho direto em `staging`. Nunca criar branch, nunca `git stash`, nunca `git reset`, nunca `--no-verify`, nunca force-push.
- Commit sempre por caminho explícito: `git add <caminhos>` e `git commit -m "tipo: descrição em português" -- <caminhos>`. Tipos: `feat`, `fix`, `chore`, `refactor`, `docs`, `ci`, `test`.
- Nunca commitar `apps/web/next-env.d.ts` nem `apps/web/tsconfig.json` (estão modificados na árvore por outro terminal).
- Migration só com `npm run db:new <nome>`. Nunca criar o arquivo à mão. Quem aplica em produção é o dono (`npm run db:push:prod`).
- Em produção o agente só lê: `npx supabase db query --linked "<SELECT ... LIMIT n>"`.
- Nenhuma variável de ambiente nova. Nada em `packages/` (`build:packages` não se aplica). Pipeline Integrity não é tocada.
- Nenhum cron novo: tudo entra em `apps/web/src/app/api/cron/sync-analytics-metrics/route.ts` (12:00 UTC).
- Relógio global: **270 s** (`maxDuration = 300`). Tetos por passo, para o passo inteiro e todos os canais: metadados **30 s**, 1A **20 s**, 1C **60 s**. Cada passo recebe `min(teto, relógio global − decorrido)`.
- Toda chamada às APIs do Google leva `AbortSignal.timeout(min(15_000, tempo que resta ao passo))`. Estouro vira tentativa `erro_http` com `http_status` nulo.
- Até **4** chamadas em paralelo.
- No máximo **40** downloads de relatório por execução. Bruto comprimido acima de **2 MB** vira `erro` com `error = 'grande_demais'`.
- Métrica não medida é `NULL`, nunca zero. `is_short` e `privacy_status` ficam `NULL` em todo o L1a.
- Datas "hoje" e "ontem" no Pacífico usam `Intl.DateTimeFormat` com `America/Los_Angeles`. Nunca deslocamento fixo, nunca `toISOString()` para achar o dia do Pacífico. `attempt_day` é a data UTC e nunca se junta a `day_pt`.
- Todo `upsert`, `update`, `insert` e `rpc` confere `error`. Códigos `42P01`, `42703`, `PGRST204`, `PGRST205` (e, para função, `PGRST202` e `42883`) viram `schema_ausente` e falha crítica. Nenhuma escrita é descartada em silêncio.
- Todo passo grava a tentativa também quando o resultado é `ok`, pela função `yt_own_attempt_record`.
- Avisos: `fanOutToSiteAdmins`, domínio `youtube`; deduplicação por `lib/ops/alert-state.ts` com chave `sync-analytics:<youtube_channels.id>:<motivo>`, janela `'7 days'`. Sem destinatário = falha crítica.
- Textos novos em pt-BR, exatamente estes:
  - `api_nao_ativada`: "A YouTube Reporting API não está ativada no projeto do Google. Impressões e CTR não estão sendo coletados."
  - `sem_acesso`: "O YouTube recusou o acesso aos relatórios do canal <nome>. Impressões e CTR não estão sendo coletados."
  - `tipo_indisponivel`: "O YouTube não oferece o relatório de alcance para o canal <nome>."
  - saída: "A coleta do canal <nome> voltou ao normal."
- Testes: fixtures temporais sempre com `vi.useFakeTimers({ now, toFake: ['Date'] })` ou relativas a `Date.now()`. Todo teste de código de servidor deste plano começa com `// @vitest-environment node`.
- Comandos de teste rodam a partir de `apps/web`: `npx vitest run <arquivo>`. Suíte inteira (`npx vitest run`, ~160 s) antes de cada push.
- TypeScript `strict`, nunca `any`. Arquivos em kebab-case.
- **Este sistema falha em verde.** Em cada tarefa, pergunte "o que acontece quando o dado não existe?" antes de "o que acontece quando dá erro?".
- **Simplificação declarada de L1a:** não existe `collection_status`. Canal cujo `ensureFreshToken` lança `TokenRevokedError` ou `NoActiveConnectionError` é pulado nos passos com token (1A e 1C), gravando tentativa `sem_conexao`, sem aviso e sem falha crítica. O estado `reautorizar` entra em L1b.

## Review Focus

Os cinco modos de falha que o spec implica e que mais provavelmente morderiam. Cada um tem o teste na tarefa dona.

1. **Dia de 25 horas (01/11/2026) e de 23 horas (08/03/2026).** Esperado: `boundsAnalytics('2026-11-01')` dura 90 000 s e `boundsAnalytics('2026-03-08')` dura 82 800 s; um teste no ar o dia inteiro grava a variante certa com `seconds_on_air_analytics` igual à duração real, sem cair na regra "soma acima da duração do dia". Testes: Task 4 (`day-pt.test.ts`) e Task 5 (`ab-seconds.test.ts`, bloco "dias de 23, 24 e 25 horas").
2. **Pausa e retomada no mesmo dia.** A pausa automática não fecha o ciclo e a retomada abre outro: ficam dois ciclos abertos. Esperado: `ab_variant_id`, `title` e `thumbnail_sha256` nulos, `ab_test_id` preenchido. Teste: Task 5 ("pausar e retomar no mesmo dia").
3. **`download_url` vencido.** A URL gravada na listagem devolve 401 ou 403 dias depois. Esperado: uma chamada `reportsList` sem `createdAfter`, `update download_url ... where status = 'listado'`, e o download refeito com a URL nova; o relatório termina `baixado`. Teste: Task 11 ("URL que devolve 403 é renovada").
4. **Tabela ou função ausente em produção** (código promovido antes de o dono aplicar a migration). Esperado: tentativa `schema_ausente`, item em `falhas[]`, os demais passos rodam, a rota responde 200, a escrita da parte antiga não é perdida, e `recordCronFailure` é chamado uma vez. Testes: Task 3 (`schema.test.ts`), Task 6 (função ausente, `PGRST202`), Task 9 (`42P01` na tabela de metadados), Task 14 (rota).
5. **`probeThumb` que devolve `dhash` nulo sem lançar** (o HEAD ou o GET de `i.ytimg.com` respondeu não-ok). Esperado: a linha do dia é gravada com `thumbnail_dhash`, `thumbnail_sha256_at_capture` e `thumbnail_sha256` nulos, `thumbnail_blob_url` repete a última, e fica uma tentativa `thumbnail` com `erro_http`. Teste: Task 9 ("probeThumb devolve dhash nulo sem lançar").

---

## File Structure

**Criados**

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/<TS>_coleta_canais_proprios_l1a.sql` | Cinco tabelas, índices, RLS, `yt_own_attempt_record`, `yt_reporting_blobs_purge`. `<TS>` é o que `npm run db:new` imprimir. |
| `apps/web/src/lib/youtube/coleta/types.ts` | Tipos compartilhados: `ColetaChannel`, `Tentativa`, `StepCtx`, `StepResumo`, `ColetaResult`, `Outcome`, `AttemptKind`. |
| `apps/web/src/lib/youtube/coleta/clock.ts` | Relógio global, tetos, `fetchComPrazo`, `emParalelo`, `comPrazo`. Sem import de banco nem de rede. |
| `apps/web/src/lib/youtube/coleta/schema.ts` | `ehSchemaAusente`, `conferirBanco`, `pushUnico`. |
| `apps/web/src/lib/youtube/coleta/day-pt.ts` | `dayPt`, `ontemPt`, `addDays`, `diffDias`, `utcDay`, `boundsAnalytics`, `boundsReporting`. Funções puras. |
| `apps/web/src/lib/youtube/coleta/ab-seconds.ts` | `calcularAbDoDia`: segundos de A/B nos dois fusos e todas as regras de nulo. Função pura. |
| `apps/web/src/lib/youtube/coleta/attempts.ts` | `registrarTentativa` (chama a função do banco), `contarPorResultado`, `scopeJob`. |
| `apps/web/src/lib/youtube/coleta/alerts.ts` | `avisarEntrada`, `avisarSaida`, `textoAviso`, `chaveAviso`. |
| `apps/web/src/lib/youtube/reporting/types.ts` | `REPORT_TYPES_ENABLED`, `REACH_TYPES`, tipos da API, `ReportingHttpError`. |
| `apps/web/src/lib/youtube/reporting/client.ts` | `criarReportingClient`, `classificarErro`, `empacotarCsv`, `paraBytea`, `deBytea`. |
| `apps/web/src/lib/youtube/coleta/meta-step.ts` | `passoMetadados`: uma linha por vídeo no dia fechado. |
| `apps/web/src/lib/youtube/coleta/jobs-step.ts` | `passoJobs`: passo 1A (sondagem e jobs). |
| `apps/web/src/lib/youtube/coleta/reports-step.ts` | `passoRelatorios`: passo 1C (listar, expirar, baixar o bruto, limpar). |
| `apps/web/src/lib/youtube/coleta/criteria.ts` | Critérios da seção 9 que valem em L1a: relatórios, jobs em erro, orçamento. |
| `apps/web/src/lib/youtube/coleta/index.ts` | `rodarColeta(ctx)`, `PASSOS_LIGADOS`. |
| `docs/ops/youtube-coleta-canais-proprios-runbook.md` | Runbook do dono. |
| `apps/web/test/youtube/coleta/fake-supabase.ts` | Banco em memória para os testes dos passos. |
| `apps/web/test/youtube/coleta/*.test.ts` | Um arquivo por módulo (lista em cada tarefa). |
| `apps/web/test/integration/coleta-l1a-migration.test.ts` | Schema no banco local (`HAS_LOCAL_DB=1`). |
| `apps/web/test/cron/sync-analytics-metrics-veredito.test.ts` | Veredito único da rota. |
| `.superpowers/sdd/2026-10-07-coleta-l1a-plan/progress.md` | Ledger. O diretório `.superpowers/` está no `.gitignore` (linha 62): o ledger **não** é commitado. |

**Modificados**

| Arquivo | Mudança |
|---|---|
| `apps/web/src/app/api/cron/sync-analytics-metrics/route.ts` (inteiro, 353 linhas) | `maxDuration` 300; parte antiga dentro de `parteAntiga()` e de um `try`; timeout nos `fetch`; `error` conferido nas escritas; duas chamadas a `rodarColeta`; veredito único. |
| `apps/web/src/types/database.types.ts` | Regenerado por `npm run db:types`. |
| `apps/web/test/cron/sync-analytics-metrics.test.ts:36-39` | Ganha `vi.mock('@/lib/youtube/coleta', ...)`. |
| `apps/web/test/api/cron/sync-analytics-metrics.test.ts:54-57` | Ganha `vi.mock('@/lib/youtube/coleta', ...)`. |

**Ordem de dependência das tarefas:** 1 → 2 (push da migration; o dono aplica enquanto o resto é escrito) → 3 → 4 → 5 → 6 → 7 → 8 → 9, 10, 11 (qualquer ordem) → 12 → 13 → 14 → 15 → 16 → 17.

---

### Task 1: Pré-voo e ledger

**Files:**
- Create: `.superpowers/sdd/2026-10-07-coleta-l1a-plan/progress.md` (ignorado pelo git; não commitar)

**Interfaces:**
- Consumes: nada.
- Produces: o ledger, que as Tasks 2, 16 e 17 atualizam.

- [ ] **Step 1: Conferir a base**

Run (a partir da raiz do repositório):

```bash
git rev-parse --abbrev-ref HEAD
git rev-parse staging
git rev-parse origin/main
git status --short
```

Expected: branch `staging`. O spec foi escrito com `staging` em `6dd468ae` e `origin/main` em `c20b6ff2`. Se `staging` andou, rode `git log --oneline 6dd468ae..HEAD -- apps/web/src/app/api/cron/sync-analytics-metrics apps/web/src/lib/youtube/thumb-fingerprint.ts apps/web/src/lib/cron-health.ts apps/web/src/lib/ops/alert-state.ts apps/web/src/lib/social/token-refresh.ts`. Saída vazia = pode seguir. Saída não vazia = PARAR e reler os arquivos tocados antes de continuar. (O `main` local pode estar atrás de `origin/main`; a referência é `origin/main`.)

- [ ] **Step 2: Conferir que as tabelas ainda não existem**

Run:

```bash
ls supabase/migrations | grep -i "coleta\|yt_reporting\|yt_own" ; echo "saida=$?"
npx supabase db query --linked "select table_name from information_schema.tables where table_schema = 'public' and (table_name like 'yt_reporting_%' or table_name like 'yt_own_%') order by 1 limit 20"
```

Expected: `saida=1` (nenhuma migration) e `rows: []`. Se já existir alguma, PARAR e perguntar ao dono.

- [ ] **Step 3: Criar o ledger**

Create `.superpowers/sdd/2026-10-07-coleta-l1a-plan/progress.md`:

```markdown
# Coleta dos canais próprios — lote L1a — ledger

BASE: staging <sha do Step 1> · origin/main <sha do Step 1>
Spec: docs/superpowers/specs/2026-10-07-coleta-canais-proprios-design.md
Plano: docs/superpowers/plans/2026-10-07-coleta-l1a-plan.md

## Pré-requisitos do dono (antes do código chegar a main)
1. YouTube Reporting API ativada no projeto do Google Cloud usado pelo OAuth: [ ] confirmado em __/__ por ____
2. Limite de duração de função do plano na Vercel: ____ s (precisa ser >= 300): [ ] confirmado em __/__

## ROLLOUT (ordem obrigatória)
A migration vai para produção ANTES de o código chegar a main. Só o dono roda, um por linha:

    npm run db:which
    npm run db:push:prod
    npx supabase db query --linked "select count(*) from yt_reporting_jobs"

## Commits (staging)
(preencher: Tn <sha> <assunto>)

## Primeira execução em produção (passo 1A)
Tipos de relatório oferecidos por canal e estado de cada job:
(preencher a partir do SELECT da Task 17)

## Desvios do plano
(preencher)

## Revisão de totalidade
(preencher na Task 17)

## O que o L1a ensinou para os specs restantes
(preencher na Task 17)
```

- [ ] **Step 4: PARAR: pedir ao dono os dois pré-requisitos**

Mensagem ao dono, um item por linha:

```
Pré-requisito 1: no Google Cloud Console, projeto do OAuth do site, ativar "YouTube Reporting API" (é separada da "YouTube Analytics API").
Pré-requisito 2: na Vercel, conferir o limite de duração de função do plano. Precisa permitir 300 s. Qual é o valor?
```

Anote as respostas no ledger. Se o plano não permitir 300 s, o L1a não começa: PARAR. O pré-requisito 1 não bloqueia a escrita do código (a primeira execução detecta `api_nao_ativada`), mas bloqueia o aceite da Task 17.

---

### Task 2: Migration, tipos e teste de schema (push 1)

**Files:**
- Create: `supabase/migrations/<TS>_coleta_canais_proprios_l1a.sql`
- Create: `apps/web/test/integration/coleta-l1a-migration.test.ts`
- Modify: `apps/web/src/types/database.types.ts` (regenerado)

**Interfaces:**
- Consumes: `public.sites(id)`, `public.youtube_videos(id)`, `public.can_edit_site(uuid)`.
- Produces (o resto do plano depende destes nomes exatos):
  - Tabelas `yt_reporting_jobs` (PK `channel_id, report_type_id`), `yt_reporting_reports` (PK `report_id`), `yt_reporting_report_blobs` (PK `report_id`), `yt_own_video_meta_daily` (PK `youtube_video_id, day_pt`), `yt_own_collection_attempts` (PK `scope_type, scope_id, kind, attempt_day`).
  - `public.yt_own_attempt_record(p_site_id uuid, p_scope_type text, p_scope_id text, p_kind text, p_outcome text, p_http_status integer default null, p_error text default null, p_channel_id uuid default null) returns integer` — devolve o `attempts` depois da gravação.
  - `public.yt_reporting_blobs_purge(p_sem_normalizador text[]) returns integer` — devolve quantos brutos apagou.

- [ ] **Step 1: Subir o banco local**

Run (raiz): `npm run db:start`
Expected: endpoints locais impressos, banco em `127.0.0.1:54322`.

- [ ] **Step 2: Escrever o teste de schema que falha**

Create `apps/web/test/integration/coleta-l1a-migration.test.ts`:

```ts
// @vitest-environment node
// apps/web/test/integration/coleta-l1a-migration.test.ts — tabelas e funções do lote L1a, no banco local.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, SUPABASE_URL, ANON_KEY } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const DIA = 864e5
const SEM_NORMALIZADOR = ['channel_reach_combined_a1', 'channel_traffic_source_a3', 'channel_basic_a3']

describe.skipIf(skipIfNoLocalDb())('coleta L1a: schema (banco local)', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId = ''
  const canal = randomUUID()
  const sufixo = randomUUID().slice(0, 8)
  const relatorio = (id: string, extra: Record<string, unknown> = {}) => ({
    site_id: siteId, report_id: `${id}-${sufixo}`, job_id: `job-${sufixo}`, channel_id: canal,
    report_type_id: 'channel_reach_basic_a1',
    start_time: new Date(Date.now() - 2 * DIA).toISOString(), end_time: new Date(Date.now() - DIA).toISOString(),
    create_time: new Date().toISOString(), download_url: 'https://example.test/r', ...extra,
  })

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    siteId = (await seedSite(sb)).siteId
  })
  afterAll(async () => {
    await sb.from('sites').delete().eq('id', siteId)
  })

  it('yt_own_attempt_record soma attempts na segunda chamada do dia e sobrescreve o resultado', async () => {
    const args = { p_site_id: siteId, p_scope_type: 'video', p_scope_id: `yt-${sufixo}`, p_kind: 'meta', p_outcome: 'erro_http', p_http_status: 503, p_error: 'x', p_channel_id: canal }
    const a = await sb.rpc('yt_own_attempt_record', args)
    expect(a.error).toBeNull()
    expect(a.data).toBe(1)
    const b = await sb.rpc('yt_own_attempt_record', { ...args, p_outcome: 'ok', p_http_status: null, p_error: null })
    expect(b.data).toBe(2)
    const lido = await sb.from('yt_own_collection_attempts').select('outcome, attempts, http_status, attempt_day').eq('scope_id', `yt-${sufixo}`)
    expect(lido.data).toHaveLength(1)
    expect(lido.data![0]).toMatchObject({ outcome: 'ok', attempts: 2, http_status: null, attempt_day: new Date().toISOString().slice(0, 10) })
  })

  it('resultado fora da lista é recusado pelo check (23514)', async () => {
    const r = await sb.rpc('yt_own_attempt_record', { p_site_id: siteId, p_scope_type: 'video', p_scope_id: `bad-${sufixo}`, p_kind: 'meta', p_outcome: 'talvez' })
    expect(r.error?.code).toBe('23514')
  })

  it('csv_gz: ida e volta de um gzip que contém os bytes 0x00 e 0xff', async () => {
    const csv = Buffer.concat([Buffer.from('a,b\n'), Buffer.from([0x00, 0xff, 0x00, 0xff]), Buffer.from('\n')])
    const gz = gzipSync(csv)
    const linha = relatorio('blob')
    expect((await sb.from('yt_reporting_reports').insert(linha)).error).toBeNull()
    const gravado = await sb.from('yt_reporting_report_blobs').insert({ report_id: linha.report_id, site_id: siteId, csv_gz: `\\x${gz.toString('hex')}` })
    expect(gravado.error).toBeNull()
    const lido = await sb.from('yt_reporting_report_blobs').select('csv_gz').eq('report_id', linha.report_id).single()
    const texto = lido.data!.csv_gz as string
    expect(texto.startsWith('\\x')).toBe(true)
    expect(gunzipSync(Buffer.from(texto.slice(2), 'hex')).equals(csv)).toBe(true)
  })

  it('listar de novo com ignoreDuplicates não altera um relatório já baixado', async () => {
    const linha = relatorio('dup', { status: 'baixado', row_count: 7 })
    expect((await sb.from('yt_reporting_reports').insert(linha)).error).toBeNull()
    const de_novo = await sb.from('yt_reporting_reports').upsert({ ...linha, status: 'listado', row_count: null, download_url: 'https://example.test/outra' }, { onConflict: 'report_id', ignoreDuplicates: true })
    expect(de_novo.error).toBeNull()
    const lido = await sb.from('yt_reporting_reports').select('status, row_count, download_url').eq('report_id', linha.report_id).single()
    expect(lido.data).toEqual({ status: 'baixado', row_count: 7, download_url: 'https://example.test/r' })
  })

  it('linha de metadados aceita is_short, privacy_status e os campos de A/B nulos, e a chave é (youtube_video_id, day_pt)', async () => {
    const base = { site_id: siteId, youtube_video_id: `yt-${sufixo}`, day_pt: '2026-10-06', channel_id: canal, captured_at: new Date().toISOString(), title_at_capture: 'T' }
    expect((await sb.from('yt_own_video_meta_daily').insert(base)).error).toBeNull()
    const repetida = await sb.from('yt_own_video_meta_daily').insert(base)
    expect(repetida.error?.code).toBe('23505')
    const lido = await sb.from('yt_own_video_meta_daily').select('is_short, privacy_status, ab_test_id, video_id').eq('youtube_video_id', `yt-${sufixo}`).single()
    expect(lido.data).toEqual({ is_short: null, privacy_status: null, ab_test_id: null, video_id: null })
  })

  it('anon não lê o bruto, nem as outras tabelas', async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    for (const tabela of ['yt_reporting_report_blobs', 'yt_reporting_reports', 'yt_reporting_jobs', 'yt_own_video_meta_daily', 'yt_own_collection_attempts']) {
      const r = await anon.from(tabela).select('*').limit(1)
      expect(r.error !== null || (r.data ?? []).length === 0, tabela).toBe(true)
    }
    const f = await anon.rpc('yt_own_attempt_record', { p_site_id: siteId, p_scope_type: 'video', p_scope_id: 'anon', p_kind: 'meta', p_outcome: 'ok' })
    expect(f.error).not.toBeNull()
  })

  it('yt_reporting_blobs_purge apaga o bruto normalizado há mais de 90 dias e o de tipo sem normalizador com mais de 180 dias; o alcance básico não normalizado fica', async () => {
    const velho = (dias: number) => new Date(Date.now() - dias * DIA).toISOString()
    const a = relatorio('purge-a', { report_type_id: 'channel_basic_a3', status: 'baixado', downloaded_at: velho(181) })
    const b = relatorio('purge-b', { status: 'baixado', downloaded_at: velho(400) })
    const c = relatorio('purge-c', { status: 'baixado', downloaded_at: velho(120), normalized_at: velho(91) })
    const d = relatorio('purge-d', { report_type_id: 'channel_basic_a3', status: 'baixado', downloaded_at: velho(10) })
    expect((await sb.from('yt_reporting_reports').insert([a, b, c, d])).error).toBeNull()
    const blob = (id: string) => ({ report_id: id, site_id: siteId, csv_gz: `\\x${gzipSync(Buffer.from('h\n')).toString('hex')}` })
    expect((await sb.from('yt_reporting_report_blobs').insert([a, b, c, d].map(r => blob(r.report_id)))).error).toBeNull()
    const purge = await sb.rpc('yt_reporting_blobs_purge', { p_sem_normalizador: SEM_NORMALIZADOR })
    expect(purge.error).toBeNull()
    expect(purge.data as number).toBeGreaterThanOrEqual(2)
    const restam = await sb.from('yt_reporting_report_blobs').select('report_id').in('report_id', [a, b, c, d].map(r => r.report_id))
    expect(restam.data!.map(r => r.report_id).sort()).toEqual([b.report_id, d.report_id].sort())
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run (de `apps/web`): `HAS_LOCAL_DB=1 npx vitest run test/integration/coleta-l1a-migration.test.ts`
Expected: FAIL — os testes quebram com erro `PGRST202` (função não encontrada) ou `PGRST205` (tabela `yt_reporting_reports` não encontrada).

- [ ] **Step 4: Criar a migration**

Run (raiz): `npm run db:new coleta_canais_proprios_l1a`
Expected: `Created: supabase/migrations/<TS>_coleta_canais_proprios_l1a.sql`. Anote o caminho; ele é `<ARQ>` nos passos seguintes.

Substitua o conteúdo inteiro de `<ARQ>` por:

```sql
-- =============================================================================
-- MIGRATION: Coleta dos canais próprios — lote L1a
-- Spec: docs/superpowers/specs/2026-10-07-coleta-canais-proprios-design.md (seção 2)
-- Só cria. Roda duas vezes sem erro. O código antigo não percebe estas tabelas.
--
-- channel_id é uuid SEM chave estrangeira neste lote: uma FK sem ON DELETE é NO ACTION e
-- faria public.youtube_channel_remove (20261003000007) falhar. A FK com ON DELETE RESTRICT
-- entra em L1b, junto com a RPC que sabe lidar com ela.
-- =============================================================================

-- ── 1. Jobs da Reporting API ────────────────────────────────────────────────
create table if not exists public.yt_reporting_jobs (
  site_id uuid not null references public.sites(id) on delete cascade,
  channel_id uuid not null,
  report_type_id text not null,
  job_id text,
  job_create_time timestamptz,
  status text not null
    check (status in ('ativo', 'desativado', 'sem_acesso', 'api_nao_ativada', 'tipo_indisponivel', 'erro')),
  error text,
  created_at timestamptz not null default now(),
  last_listed_at timestamptz,
  last_create_time timestamptz,
  primary key (channel_id, report_type_id)
);

-- ── 2. Relatórios listados ──────────────────────────────────────────────────
-- Sem FK para yt_reporting_jobs: o job_id muda quando o job é recriado.
create table if not exists public.yt_reporting_reports (
  report_id text primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  job_id text not null,
  channel_id uuid not null,
  report_type_id text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  create_time timestamptz not null,
  job_expire_time timestamptz,
  download_url text not null,
  is_backfill boolean not null default false,
  status text not null default 'listado'
    check (status in ('listado', 'baixado', 'vazio', 'erro', 'expirado_sem_baixar')),
  error text,
  row_count bigint,
  bytes bigint,
  sha256 text,
  unmatched_video_ids jsonb,
  downloaded_at timestamptz,
  normalized_at timestamptz
);
create index if not exists idx_yt_reporting_reports_status
  on public.yt_reporting_reports (status, report_type_id, create_time);
create index if not exists idx_yt_reporting_reports_job
  on public.yt_reporting_reports (job_id, create_time);

-- ── 3. Bruto (CSV comprimido). Fora de qualquer select * ─────────────────────
create table if not exists public.yt_reporting_report_blobs (
  report_id text primary key references public.yt_reporting_reports(report_id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  csv_gz bytea not null
);

-- ── 4. O que estava no ar em cada dia, por vídeo ────────────────────────────
-- youtube_video_id = id de 11 caracteres do YouTube (NÃO o uuid de youtube_videos.id).
-- ab_test_id / ab_variant_id sem FK: testes são apagados e a linha do dia tem de sobreviver.
create table if not exists public.yt_own_video_meta_daily (
  youtube_video_id text not null,
  day_pt date not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null,
  title text,
  thumbnail_sha256 text,
  thumbnail_dhash text,
  thumbnail_blob_url text,
  title_at_capture text,
  thumbnail_sha256_at_capture text,
  description_sha256 text,
  description_text text,
  tags_sha256 text,
  tags text[],
  duration_seconds integer,
  is_short boolean,
  privacy_status text
    check (privacy_status is null or privacy_status in ('public', 'unlisted', 'private')),
  ab_test_id uuid,
  ab_variant_id uuid,
  seconds_on_air_analytics integer,
  seconds_other_analytics integer,
  seconds_on_air_reporting integer,
  seconds_other_reporting integer,
  captured_at timestamptz not null,
  primary key (youtube_video_id, day_pt)
);
create index if not exists idx_yt_own_video_meta_daily_channel_day
  on public.yt_own_video_meta_daily (channel_id, day_pt);

-- ── 5. Tentativas de coleta ─────────────────────────────────────────────────
-- attempt_day = data UTC da execução. Nunca se junta a day_pt.
create table if not exists public.yt_own_collection_attempts (
  scope_type text not null check (scope_type in ('video', 'canal', 'job')),
  scope_id text not null,
  kind text not null
    check (kind in ('sondagem', 'meta', 'thumbnail', 'relatorio', 'diario', 'retencao_vida')),
  attempt_day date not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  channel_id uuid,
  outcome text not null
    check (outcome in ('ok', 'sem_dado_na_janela', 'video_novo', 'sem_conexao', 'sem_autorizacao',
                       'erro_http', 'nao_alcancado_orcamento', 'schema_ausente')),
  http_status integer,
  error text,
  attempts integer not null default 1,
  last_attempt_at timestamptz not null default now(),
  primary key (scope_type, scope_id, kind, attempt_day)
);
create index if not exists idx_yt_own_collection_attempts_kind
  on public.yt_own_collection_attempts (kind, outcome, attempt_day);
create index if not exists idx_yt_own_collection_attempts_channel
  on public.yt_own_collection_attempts (channel_id, attempt_day);

-- ── 6. RLS: leitura por quem edita o site; escrita só por service role ──────
alter table public.yt_reporting_jobs enable row level security;
drop policy if exists "yt_reporting_jobs_select" on public.yt_reporting_jobs;
create policy "yt_reporting_jobs_select" on public.yt_reporting_jobs
  for select using (public.can_edit_site(site_id));

alter table public.yt_reporting_reports enable row level security;
drop policy if exists "yt_reporting_reports_select" on public.yt_reporting_reports;
create policy "yt_reporting_reports_select" on public.yt_reporting_reports
  for select using (public.can_edit_site(site_id));

alter table public.yt_own_video_meta_daily enable row level security;
drop policy if exists "yt_own_video_meta_daily_select" on public.yt_own_video_meta_daily;
create policy "yt_own_video_meta_daily_select" on public.yt_own_video_meta_daily
  for select using (public.can_edit_site(site_id));

alter table public.yt_own_collection_attempts enable row level security;
drop policy if exists "yt_own_collection_attempts_select" on public.yt_own_collection_attempts;
create policy "yt_own_collection_attempts_select" on public.yt_own_collection_attempts
  for select using (public.can_edit_site(site_id));

-- O bruto não tem policy de leitura: só service role.
alter table public.yt_reporting_report_blobs enable row level security;
revoke all on table public.yt_reporting_report_blobs from anon, authenticated;

-- ── 7. Registro de tentativa (o PostgREST não soma num upsert) ──────────────
create or replace function public.yt_own_attempt_record(
  p_site_id uuid,
  p_scope_type text,
  p_scope_id text,
  p_kind text,
  p_outcome text,
  p_http_status integer default null,
  p_error text default null,
  p_channel_id uuid default null
) returns integer
language sql
set search_path = ''
as $$
  insert into public.yt_own_collection_attempts as t
    (scope_type, scope_id, kind, attempt_day, site_id, channel_id, outcome, http_status, error, attempts, last_attempt_at)
  values
    (p_scope_type, p_scope_id, p_kind, (now() at time zone 'utc')::date, p_site_id, p_channel_id,
     p_outcome, p_http_status, left(p_error, 500), 1, now())
  on conflict (scope_type, scope_id, kind, attempt_day) do update
    set outcome = excluded.outcome,
        http_status = excluded.http_status,
        error = excluded.error,
        channel_id = excluded.channel_id,
        site_id = excluded.site_id,
        attempts = t.attempts + 1,
        last_attempt_at = now()
  returning t.attempts;
$$;

revoke all on function public.yt_own_attempt_record(uuid, text, text, text, text, integer, text, uuid)
  from public, anon, authenticated;
grant execute on function public.yt_own_attempt_record(uuid, text, text, text, text, integer, text, uuid)
  to service_role;

-- ── 8. Limpeza do bruto ─────────────────────────────────────────────────────
-- Apaga: (a) bruto de relatório normalizado há mais de 90 dias; (b) bruto de tipo sem
-- normalizador (lista vinda do código) baixado há mais de 180 dias. O alcance básico
-- nunca é apagado antes de normalizado, mesmo que a lista venha errada.
create or replace function public.yt_reporting_blobs_purge(p_sem_normalizador text[])
returns integer
language plpgsql
set search_path = ''
as $$
declare v_n integer;
begin
  delete from public.yt_reporting_report_blobs b
   using public.yt_reporting_reports r
   where b.report_id = r.report_id
     and (
       r.normalized_at < now() - interval '90 days'
       or (
         r.report_type_id = any(p_sem_normalizador)
         and r.report_type_id <> 'channel_reach_basic_a1'
         and r.downloaded_at < now() - interval '180 days'
       )
     );
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.yt_reporting_blobs_purge(text[]) from public, anon, authenticated;
grant execute on function public.yt_reporting_blobs_purge(text[]) to service_role;
```

- [ ] **Step 5: Aplicar no banco local e provar que roda duas vezes**

Run (raiz), um por linha:

```bash
npm run db:reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f <ARQ>
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f <ARQ>
```

Expected: `db:reset` termina sem erro; as duas execuções de `psql` terminam com código 0 (avisos `NOTICE: ... already exists, skipping` são esperados; nenhuma linha `ERROR`).

- [ ] **Step 6: Rodar o teste e ver passar**

Run (de `apps/web`): `HAS_LOCAL_DB=1 npx vitest run test/integration/coleta-l1a-migration.test.ts`
Expected: PASS, 7 testes.

- [ ] **Step 7: Regenerar os tipos**

Run (raiz):

```bash
npm run db:types
git diff --stat -- apps/web/src/types/database.types.ts
git diff -- apps/web/src/types/database.types.ts | grep -E "^[+-] {6}[a-z_]+: \{" | sort -u
```

Expected: o diff só acrescenta os blocos `yt_own_collection_attempts`, `yt_own_video_meta_daily`, `yt_reporting_jobs`, `yt_reporting_report_blobs`, `yt_reporting_reports` e as funções `yt_own_attempt_record` e `yt_reporting_blobs_purge`. **Se o diff mexer em qualquer tabela ou função não relacionada, a versão do CLI divergiu: PARAR e perguntar ao dono** (o spec manda parar; o ledger de `2026-10-06-observatorio-fixar-video-plan`, desvio 2, registra que isso já aconteceu uma vez).

- [ ] **Step 8: Typecheck**

Run (de `apps/web`): `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 9: Commit**

```bash
git add <ARQ> apps/web/src/types/database.types.ts apps/web/test/integration/coleta-l1a-migration.test.ts
git commit -m "feat: migration da coleta dos canais próprios, lote L1a (cinco tabelas, registro de tentativa e limpeza do bruto)" -- <ARQ> apps/web/src/types/database.types.ts apps/web/test/integration/coleta-l1a-migration.test.ts
```

- [ ] **Step 10: Suíte inteira e push 1**

Run (de `apps/web`): `npx vitest run`
Expected: 0 falhas (~160 s).

Run (raiz): `git push origin staging`

- [ ] **Step 11: PARAR: pedir ao dono para aplicar a migration**

O código das tarefas seguintes pode ser escrito e commitado em `staging` enquanto isso, mas **não vai para `main`** antes de o dono confirmar. Comandos do dono, um por linha:

```
npm run db:which
npm run db:push:prod
npx supabase db query --linked "select count(*) from yt_reporting_jobs"
npx supabase db query --linked "select proname from pg_proc where proname in ('yt_own_attempt_record','yt_reporting_blobs_purge') order by 1"
```

Esperado: `novkqtvcnsiwhkxihurk`; depois `count = 0`; depois duas linhas. Anote no ledger a data e o sha do commit.

---

### Task 3: Fundações — tipos, relógio e detecção de schema ausente

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/types.ts`
- Create: `apps/web/src/lib/youtube/coleta/clock.ts`
- Create: `apps/web/src/lib/youtube/coleta/schema.ts`
- Test: `apps/web/test/youtube/coleta/clock.test.ts`
- Test: `apps/web/test/youtube/coleta/schema.test.ts`

**Interfaces:**
- Consumes: nada de outras tarefas.
- Produces:
  - `types.ts`: `Outcome`, `AttemptKind`, `ScopeType`, `ColetaChannel { id; channel_id; site_id; name; sync_enabled }`, `Tentativa { site_id; scope_type; scope_id; kind; outcome; http_status?; error?; channel_id? }`, `StepCtx { supabase: SupabaseClient; channels: ColetaChannel[]; deadline: number; falhas: string[]; tentativas: Tentativa[] }`, `StepResumo { gravados: number; tentativas: Partial<Record<Outcome, number>>; pendentes: number }`, `ColetaResult { falhas: string[]; resumo: Record<string, unknown> }`.
  - `clock.ts`: `RELOGIO_GLOBAL_MS = 270_000`, `TETOS_MS = { metadados: 30_000, jobs: 20_000, relatorios: 60_000 }`, `FETCH_TIMEOUT_MS = 15_000`, `PARALELO = 4`, `interface Relogio { inicio: number; fim: number; decorrido(): number; prazo(tetoMs: number): number }`, `criarRelogio(inicio?: number, totalMs?: number): Relogio`, `restante(deadline: number): number`, `class SemTempoError`, `fetchComPrazo(deadline: number, f?: typeof fetch): typeof fetch`, `emParalelo<T, R>(itens: readonly T[], limite: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]>`, `comPrazo<T>(p: Promise<T>, deadline: number): Promise<T | null>`.
  - `schema.ts`: `CODIGOS_SCHEMA_AUSENTE`, `interface ErroBanco { code?: string | null; message?: string | null }`, `ehSchemaAusente(e): boolean`, `type Escrita = 'ok' | 'schema_ausente' | 'erro'`, `conferirBanco(res, onde: string, falhas: string[], verbo?: 'gravar' | 'ler'): Escrita`, `pushUnico(falhas: string[], nota: string): void`.

- [ ] **Step 1: Escrever os testes que falham**

Create `apps/web/test/youtube/coleta/clock.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  criarRelogio, restante, fetchComPrazo, emParalelo, comPrazo, SemTempoError,
  RELOGIO_GLOBAL_MS, TETOS_MS, FETCH_TIMEOUT_MS, PARALELO,
} from '@/lib/youtube/coleta/clock'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('relógio da coleta', () => {
  it('as constantes são as do spec', () => {
    expect(RELOGIO_GLOBAL_MS).toBe(270_000)
    expect(TETOS_MS).toEqual({ metadados: 30_000, jobs: 20_000, relatorios: 60_000 })
    expect(FETCH_TIMEOUT_MS).toBe(15_000)
    expect(PARALELO).toBe(4)
  })

  it('prazo do passo = min(teto, o que resta do relógio global)', () => {
    vi.useFakeTimers({ now: new Date('2026-10-07T12:00:00.000Z'), toFake: ['Date'] })
    const r = criarRelogio()
    expect(r.prazo(30_000) - Date.now()).toBe(30_000)
    vi.setSystemTime(new Date('2026-10-07T12:04:20.000Z')) // 260 s depois: restam 10 s
    expect(r.decorrido()).toBe(260_000)
    expect(r.prazo(30_000) - Date.now()).toBe(10_000)
    vi.setSystemTime(new Date('2026-10-07T12:05:00.000Z')) // relógio estourado
    expect(restante(r.prazo(30_000))).toBe(0)
  })

  it('fetchComPrazo aplica 15 s quando sobra mais que isso, e o que resta quando sobra menos', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-07T12:00:00.000Z'), toFake: ['Date'] })
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const f = vi.fn(async () => new Response('ok'))
    await fetchComPrazo(Date.now() + 60_000, f as unknown as typeof fetch)('https://x.test')
    expect(timeout).toHaveBeenLastCalledWith(15_000)
    await fetchComPrazo(Date.now() + 4_000, f as unknown as typeof fetch)('https://x.test')
    expect(timeout).toHaveBeenLastCalledWith(4_000)
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].signal).toBeInstanceOf(AbortSignal)
  })

  it('fetchComPrazo sem tempo lança SemTempoError e não chama a rede', async () => {
    const f = vi.fn()
    await expect(fetchComPrazo(Date.now() - 1, f as unknown as typeof fetch)('https://x.test')).rejects.toBeInstanceOf(SemTempoError)
    expect(f).not.toHaveBeenCalled()
  })

  it('fetch que nunca responde é abortado pelo prazo de 15 s', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      const c = new AbortController()
      queueMicrotask(() => c.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError')))
      return c.signal
    })
    const nuncaResponde = ((_u: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_ok, falha) => init!.signal!.addEventListener('abort', () => falha(init!.signal!.reason)))) as typeof fetch
    await expect(fetchComPrazo(Date.now() + 60_000, nuncaResponde)('https://x.test')).rejects.toMatchObject({ name: 'TimeoutError' })
    expect(timeout).toHaveBeenCalledWith(15_000)
  })

  it('fetchComPrazo respeita também o sinal que quem chama já passou', async () => {
    const dele = new AbortController()
    const f = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
      dele.abort()
      return new Response(init!.signal!.aborted ? 'abortado' : 'vivo')
    })
    const res = await fetchComPrazo(Date.now() + 60_000, f as unknown as typeof fetch)('https://x.test', { signal: dele.signal })
    expect(await res.text()).toBe('abortado')
  })

  it('emParalelo nunca passa do limite e devolve na ordem de entrada', async () => {
    let ativos = 0
    let pico = 0
    const out = await emParalelo([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, async (n) => {
      ativos++
      pico = Math.max(pico, ativos)
      await new Promise(r => setTimeout(r, 5))
      ativos--
      return n * 2
    })
    expect(pico).toBeLessThanOrEqual(4)
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18])
  })

  it('comPrazo devolve null quando a promessa não termina a tempo, e o valor quando termina', async () => {
    expect(await comPrazo(Promise.resolve('a'), Date.now() + 1_000)).toBe('a')
    expect(await comPrazo(new Promise<string>(() => {}), Date.now() + 20)).toBeNull()
    expect(await comPrazo(Promise.resolve('a'), Date.now() - 1)).toBeNull()
  })
})
```

Create `apps/web/test/youtube/coleta/schema.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { ehSchemaAusente, conferirBanco, pushUnico } from '@/lib/youtube/coleta/schema'

describe('schema ausente', () => {
  it.each(['42P01', '42703', 'PGRST204', 'PGRST205', 'PGRST202', '42883'])('código %s é schema ausente', (code) => {
    expect(ehSchemaAusente({ code, message: 'x' })).toBe(true)
  })

  it('outro código, erro sem código e ausência de erro não são schema ausente', () => {
    expect(ehSchemaAusente({ code: '23505', message: 'x' })).toBe(false)
    expect(ehSchemaAusente({ message: 'x' })).toBe(false)
    expect(ehSchemaAusente(null)).toBe(false)
    expect(ehSchemaAusente(undefined)).toBe(false)
  })

  it('conferirBanco: sem erro devolve ok e não toca em falhas', () => {
    const falhas: string[] = []
    expect(conferirBanco({ error: null }, 'yt_reporting_jobs', falhas)).toBe('ok')
    expect(conferirBanco(undefined, 'yt_reporting_jobs', falhas)).toBe('ok')
    expect(falhas).toEqual([])
  })

  it('conferirBanco: tabela ausente (42P01) e coluna ausente (PGRST204) viram schema_ausente, uma nota só por tabela', () => {
    const falhas: string[] = []
    expect(conferirBanco({ error: { code: '42P01', message: 'relation does not exist' } }, 'yt_own_video_meta_daily', falhas)).toBe('schema_ausente')
    expect(conferirBanco({ error: { code: 'PGRST204', message: 'column not found' } }, 'yt_own_video_meta_daily', falhas)).toBe('schema_ausente')
    expect(falhas).toEqual(['schema_ausente: yt_own_video_meta_daily'])
  })

  it('conferirBanco: outro erro vira nota legível, sem o texto do Postgres', () => {
    const falhas: string[] = []
    expect(conferirBanco({ error: { code: '23505', message: 'duplicate key value violates unique constraint "segredo"' } }, 'yt_reporting_reports', falhas)).toBe('erro')
    expect(conferirBanco({ error: { code: '57014', message: 'statement timeout' } }, 'youtube_videos', falhas, 'ler')).toBe('erro')
    expect(falhas).toEqual(['erro de banco ao gravar yt_reporting_reports', 'erro de banco ao ler youtube_videos'])
  })

  it('pushUnico não repete', () => {
    const falhas = ['a']
    pushUnico(falhas, 'a')
    pushUnico(falhas, 'b')
    expect(falhas).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/clock.test.ts test/youtube/coleta/schema.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/youtube/coleta/clock"`.

- [ ] **Step 3: Implementar**

Create `apps/web/src/lib/youtube/coleta/types.ts`:

```ts
// Tipos compartilhados pelos passos da coleta dos canais próprios (lote L1a).
import type { SupabaseClient } from '@supabase/supabase-js'

export const OUTCOMES = [
  'ok', 'sem_dado_na_janela', 'video_novo', 'sem_conexao', 'sem_autorizacao',
  'erro_http', 'nao_alcancado_orcamento', 'schema_ausente',
] as const
export type Outcome = (typeof OUTCOMES)[number]
export type AttemptKind = 'sondagem' | 'meta' | 'thumbnail' | 'relatorio' | 'diario' | 'retencao_vida'
export type ScopeType = 'video' | 'canal' | 'job'

/** Linha de `youtube_channels` como a coleta lê. `id` é o uuid; `channel_id` é o UC… do YouTube. */
export interface ColetaChannel {
  id: string
  channel_id: string
  site_id: string
  name: string
  sync_enabled: boolean
}

/** Uma linha de `yt_own_collection_attempts` (o dia é posto pelo banco, em UTC). */
export interface Tentativa {
  site_id: string
  scope_type: ScopeType
  /** video: id do YouTube · canal: youtube_channels.id · job: `<youtube_channels.id>:<report_type_id>` */
  scope_id: string
  kind: AttemptKind
  outcome: Outcome
  http_status?: number | null
  error?: string | null
  channel_id?: string | null
}

/** O que cada passo recebe. `deadline` é um instante (epoch ms), não uma duração. */
export interface StepCtx {
  supabase: SupabaseClient
  channels: ColetaChannel[]
  deadline: number
  falhas: string[]
  tentativas: Tentativa[]
}

export interface StepResumo {
  gravados: number
  tentativas: Partial<Record<Outcome, number>>
  pendentes: number
}

export interface ColetaResult {
  falhas: string[]
  resumo: Record<string, unknown>
}
```

Create `apps/web/src/lib/youtube/coleta/clock.ts`:

```ts
// Relógio global e tetos da coleta. Sem import de banco nem de rede: a rota importa daqui.

export const RELOGIO_GLOBAL_MS = 270_000
export const TETOS_MS = { metadados: 30_000, jobs: 20_000, relatorios: 60_000 } as const
export const FETCH_TIMEOUT_MS = 15_000
export const PARALELO = 4

export interface Relogio {
  inicio: number
  fim: number
  decorrido(): number
  /** Instante (epoch ms) em que o passo tem de parar: min(agora + teto, fim do relógio global). */
  prazo(tetoMs: number): number
}

export function criarRelogio(inicio: number = Date.now(), totalMs: number = RELOGIO_GLOBAL_MS): Relogio {
  const fim = inicio + totalMs
  return {
    inicio,
    fim,
    decorrido: () => Date.now() - inicio,
    prazo: (tetoMs: number) => Math.min(Date.now() + tetoMs, fim),
  }
}

/** Milissegundos que faltam até o prazo; nunca negativo. */
export function restante(deadline: number): number {
  return Math.max(0, deadline - Date.now())
}

export class SemTempoError extends Error {
  constructor() {
    super('sem tempo: o prazo do passo acabou')
    this.name = 'SemTempoError'
  }
}

/** Um `fetch` que aborta em min(15 s, o que resta ao passo). Sem tempo, lança sem tocar na rede. */
export function fetchComPrazo(deadline: number, f: typeof fetch = fetch): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const ms = Math.min(FETCH_TIMEOUT_MS, restante(deadline))
    if (ms <= 0) throw new SemTempoError()
    const prazo = AbortSignal.timeout(ms)
    const signal = init?.signal ? AbortSignal.any([init.signal, prazo]) : prazo
    return f(input, { ...init, signal })
  }) as typeof fetch
}

/** Roda `fn` sobre os itens com no máximo `limite` em voo. `fn` não pode lançar: trate o erro dentro dela. */
export async function emParalelo<T, R>(
  itens: readonly T[],
  limite: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(itens.length)
  let proximo = 0
  const operario = async () => {
    while (proximo < itens.length) {
      const i = proximo++
      out[i] = await fn(itens[i]!, i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, operario))
  return out
}

/** `Promise.race` contra min(15 s, o que resta ao passo). Devolve null quando o tempo vence. */
export async function comPrazo<T>(p: Promise<T>, deadline: number): Promise<T | null> {
  const ms = Math.min(FETCH_TIMEOUT_MS, restante(deadline))
  if (ms <= 0) return null
  let timer: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms)
  })
  try {
    return await Promise.race([p, limite])
  } finally {
    clearTimeout(timer)
  }
}
```

Create `apps/web/src/lib/youtube/coleta/schema.ts`:

```ts
// Detecção de "a migration não foi aplicada" e conferência de erro em toda leitura e escrita.
// Regra: nenhuma escrita é descartada em silêncio. A nota nunca leva o texto do Postgres.

/** 42P01 tabela, 42703 coluna, PGRST204 coluna (PostgREST), PGRST205 tabela (PostgREST),
 *  PGRST202 função (PostgREST), 42883 função (Postgres). */
export const CODIGOS_SCHEMA_AUSENTE: readonly string[] = ['42P01', '42703', 'PGRST204', 'PGRST205', 'PGRST202', '42883']

export interface ErroBanco {
  code?: string | null
  message?: string | null
}

export function ehSchemaAusente(e: ErroBanco | null | undefined): boolean {
  return !!e?.code && CODIGOS_SCHEMA_AUSENTE.includes(e.code)
}

export function pushUnico(falhas: string[], nota: string): void {
  if (!falhas.includes(nota)) falhas.push(nota)
}

export type Escrita = 'ok' | 'schema_ausente' | 'erro'

/** Confere o `error` de uma resposta do Supabase e registra a falha crítica correspondente. */
export function conferirBanco(
  res: { error?: ErroBanco | null } | null | undefined,
  onde: string,
  falhas: string[],
  verbo: 'gravar' | 'ler' = 'gravar',
): Escrita {
  const e = res?.error
  if (!e) return 'ok'
  if (ehSchemaAusente(e)) {
    pushUnico(falhas, `schema_ausente: ${onde}`)
    return 'schema_ausente'
  }
  pushUnico(falhas, `erro de banco ao ${verbo} ${onde}`)
  return 'erro'
}
```

- [ ] **Step 4: Rodar e ver passar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/clock.test.ts test/youtube/coleta/schema.test.ts`
Expected: PASS (8 + 11 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/coleta/types.ts apps/web/src/lib/youtube/coleta/clock.ts apps/web/src/lib/youtube/coleta/schema.ts apps/web/test/youtube/coleta/clock.test.ts apps/web/test/youtube/coleta/schema.test.ts
git commit -m "feat: relógio global, fetch com prazo e detecção de schema ausente da coleta" -- apps/web/src/lib/youtube/coleta/types.ts apps/web/src/lib/youtube/coleta/clock.ts apps/web/src/lib/youtube/coleta/schema.ts apps/web/test/youtube/coleta/clock.test.ts apps/web/test/youtube/coleta/schema.test.ts
```

---

### Task 4: O dia do Pacífico

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/day-pt.ts`
- Test: `apps/web/test/youtube/coleta/day-pt.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `dayPt(instante: Date): string` (`YYYY-MM-DD` em `America/Los_Angeles`), `ontemPt(agora: Date): string`, `addDays(day: string, n: number): string`, `diffDias(de: string, ate: string): number`, `utcDay(agora: Date): string`, `interface Intervalo { start: number; end: number }` (epoch ms, fim exclusivo), `boundsAnalytics(day: string): Intervalo` (meia-noite a meia-noite do Pacífico com horário de verão: 23, 24 ou 25 horas), `boundsReporting(day: string): Intervalo` (UTC-8 fixo: sempre 24 horas).

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/test/youtube/coleta/day-pt.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { dayPt, ontemPt, addDays, diffDias, utcDay, boundsAnalytics, boundsReporting } from '@/lib/youtube/coleta/day-pt'

const H = 3_600_000
const iso = (ms: number) => new Date(ms).toISOString()

afterEach(() => {
  vi.useRealTimers()
})

describe('dayPt', () => {
  it('usa o Pacífico com horário de verão: 06:59 UTC ainda é a véspera, 07:00 UTC já é o dia', () => {
    expect(dayPt(new Date('2026-10-31T06:59:59.000Z'))).toBe('2026-10-30')
    expect(dayPt(new Date('2026-10-31T07:00:00.000Z'))).toBe('2026-10-31')
  })

  it('no inverno a virada é às 08:00 UTC', () => {
    expect(dayPt(new Date('2026-12-10T07:59:59.000Z'))).toBe('2026-12-09')
    expect(dayPt(new Date('2026-12-10T08:00:00.000Z'))).toBe('2026-12-10')
  })

  it('01/11/2026 (fim do horário de verão): o dia começa às 07:00 UTC e só acaba às 08:00 UTC do dia 2', () => {
    expect(dayPt(new Date('2026-11-01T07:00:00.000Z'))).toBe('2026-11-01')
    expect(dayPt(new Date('2026-11-02T07:30:00.000Z'))).toBe('2026-11-01')
    expect(dayPt(new Date('2026-11-02T08:00:00.000Z'))).toBe('2026-11-02')
  })
})

describe('ontemPt com o relógio do cron (12:00 UTC)', () => {
  it.each([
    ['2026-11-01T12:00:00.000Z', '2026-10-31'],
    ['2026-11-02T12:00:00.000Z', '2026-11-01'],
    ['2026-11-03T12:00:00.000Z', '2026-11-02'],
    ['2026-03-09T12:00:00.000Z', '2026-03-08'],
    ['2026-01-01T12:00:00.000Z', '2025-12-31'],
  ])('agora = %s → ontem = %s', (agora, esperado) => {
    vi.useFakeTimers({ now: new Date(agora), toFake: ['Date'] })
    expect(ontemPt(new Date())).toBe(esperado)
  })
})

describe('boundsAnalytics (dia do Pacífico com horário de verão)', () => {
  it('31/10/2026: 24 horas, das 07:00 UTC às 07:00 UTC', () => {
    const b = boundsAnalytics('2026-10-31')
    expect(iso(b.start)).toBe('2026-10-31T07:00:00.000Z')
    expect(iso(b.end)).toBe('2026-11-01T07:00:00.000Z')
    expect((b.end - b.start) / H).toBe(24)
  })

  it('01/11/2026: 25 horas, das 07:00 UTC às 08:00 UTC do dia seguinte', () => {
    const b = boundsAnalytics('2026-11-01')
    expect(iso(b.start)).toBe('2026-11-01T07:00:00.000Z')
    expect(iso(b.end)).toBe('2026-11-02T08:00:00.000Z')
    expect((b.end - b.start) / H).toBe(25)
  })

  it('02/11/2026: 24 horas, das 08:00 UTC às 08:00 UTC', () => {
    const b = boundsAnalytics('2026-11-02')
    expect(iso(b.start)).toBe('2026-11-02T08:00:00.000Z')
    expect(iso(b.end)).toBe('2026-11-03T08:00:00.000Z')
    expect((b.end - b.start) / H).toBe(24)
  })

  it('08/03/2026: 23 horas, das 08:00 UTC às 07:00 UTC do dia seguinte', () => {
    const b = boundsAnalytics('2026-03-08')
    expect(iso(b.start)).toBe('2026-03-08T08:00:00.000Z')
    expect(iso(b.end)).toBe('2026-03-09T07:00:00.000Z')
    expect((b.end - b.start) / H).toBe(23)
  })

  it('todo instante dentro do intervalo pertence ao dia, e os vizinhos não', () => {
    for (const dia of ['2026-10-31', '2026-11-01', '2026-11-02', '2026-03-08']) {
      const b = boundsAnalytics(dia)
      expect(dayPt(new Date(b.start))).toBe(dia)
      expect(dayPt(new Date(b.end - 1))).toBe(dia)
      expect(dayPt(new Date(b.start - 1))).not.toBe(dia)
      expect(dayPt(new Date(b.end))).not.toBe(dia)
    }
  })
})

describe('boundsReporting (UTC-8 fixo)', () => {
  it.each(['2026-10-31', '2026-11-01', '2026-11-02', '2026-03-08', '2026-07-15'])('%s: sempre 24 horas a partir das 08:00 UTC', (dia) => {
    const b = boundsReporting(dia)
    expect(iso(b.start)).toBe(`${dia}T08:00:00.000Z`)
    expect((b.end - b.start) / H).toBe(24)
  })
})

describe('aritmética de dias', () => {
  it('addDays atravessa mês, ano e 29 de fevereiro', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('diffDias conta dias de calendário, sem se perder na troca de horário', () => {
    expect(diffDias('2026-10-31', '2026-11-03')).toBe(3)
    expect(diffDias('2026-03-07', '2026-03-09')).toBe(2)
    expect(diffDias('2026-11-03', '2026-11-03')).toBe(0)
  })

  it('utcDay é a data UTC, não a do Pacífico', () => {
    expect(utcDay(new Date('2026-10-07T03:00:00.000Z'))).toBe('2026-10-07')
    expect(dayPt(new Date('2026-10-07T03:00:00.000Z'))).toBe('2026-10-06')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/day-pt.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/youtube/coleta/day-pt"`.

- [ ] **Step 3: Implementar**

Create `apps/web/src/lib/youtube/coleta/day-pt.ts`:

```ts
// O "dia" das duas fontes do YouTube.
//  - Analytics API: dia do Pacífico COM horário de verão (UTC-7 ou UTC-8) → boundsAnalytics.
//  - Reporting API: UTC-8 fixo → boundsReporting.
// Nunca deslocamento fixo para achar o dia do Pacífico, nunca toISOString(): só Intl.

const FORMATO_PT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const DIA_MS = 86_400_000

/** O dia (`YYYY-MM-DD`) em que este instante cai em America/Los_Angeles. */
export function dayPt(instante: Date): string {
  const partes = FORMATO_PT.formatToParts(instante)
  const valor = (tipo: string) => partes.find(p => p.type === tipo)!.value
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

function partesDe(day: string): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) throw new Error(`dia inválido: ${day}`)
  return [y, m, d]
}

const dois = (n: number) => String(n).padStart(2, '0')

function formatarUtc(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`
}

/** Soma dias de calendário a um `YYYY-MM-DD` (aritmética em UTC: não há troca de horário). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = partesDe(day)
  return formatarUtc(Date.UTC(y, m - 1, d + n))
}

/** Dias de calendário de `de` até `ate`. */
export function diffDias(de: string, ate: string): number {
  const [y1, m1, d1] = partesDe(de)
  const [y2, m2, d2] = partesDe(ate)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DIA_MS)
}

/** Ontem no Pacífico: o dia fechado que o passo de metadados grava. */
export function ontemPt(agora: Date): string {
  return addDays(dayPt(agora), -1)
}

/** A data UTC da execução (`attempt_day`). Nunca se junta a `day_pt`. */
export function utcDay(agora: Date): string {
  return formatarUtc(agora.getTime())
}

export interface Intervalo {
  /** epoch ms, inclusivo */
  start: number
  /** epoch ms, exclusivo */
  end: number
}

/** A meia-noite do Pacífico que abre o dia: 07:00 UTC no verão, 08:00 UTC no inverno. */
function meiaNoitePt(day: string): number {
  const [y, m, d] = partesDe(day)
  for (const hora of [7, 8]) {
    const t = Date.UTC(y, m - 1, d, hora)
    if (dayPt(new Date(t)) === day && dayPt(new Date(t - 1)) !== day) return t
  }
  throw new Error(`não achei a meia-noite do Pacífico de ${day}`)
}

/** Dia do Pacífico com horário de verão: 23, 24 ou 25 horas. */
export function boundsAnalytics(day: string): Intervalo {
  return { start: meiaNoitePt(day), end: meiaNoitePt(addDays(day, 1)) }
}

/** Dia em UTC-8 fixo, como a Reporting API documenta: sempre 24 horas. */
export function boundsReporting(day: string): Intervalo {
  const [y, m, d] = partesDe(day)
  const start = Date.UTC(y, m - 1, d, 8)
  return { start, end: start + DIA_MS }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/day-pt.test.ts`
Expected: PASS (21 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/coleta/day-pt.ts apps/web/test/youtube/coleta/day-pt.test.ts
git commit -m "feat: dia do Pacífico para a coleta, com os limites de 23, 24 e 25 horas" -- apps/web/src/lib/youtube/coleta/day-pt.ts apps/web/test/youtube/coleta/day-pt.test.ts
```

---

### Task 5: Segundos de A/B nos dois fusos e as regras de nulo

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/ab-seconds.ts`
- Test: `apps/web/test/youtube/coleta/ab-seconds.test.ts`

**Interfaces:**
- Consumes (Task 4): `boundsAnalytics(day: string): Intervalo`, `boundsReporting(day: string): Intervalo`, `interface Intervalo { start: number; end: number }` de `./day-pt`.
- Produces:
  - `interface AbTest { id: string; status: string; paused_at: string | null; completed_at: string | null; original_title: string | null }`
  - `interface AbCycle { id: string; test_id: string; variant_id: string; started_at: string; ended_at: string | null; applied_metadata: { title_set?: string | null } | null }`
  - `type MotivoNulo = 'mais_de_um_teste' | 'ciclo_aberto_duplicado' | 'soma_acima_do_dia' | 'fora_de_ciclo'`
  - `interface AbDia { ab_test_id: string | null; ab_variant_id: string | null; seconds_on_air_analytics: number | null; seconds_other_analytics: number | null; seconds_on_air_reporting: number | null; seconds_other_reporting: number | null; title: string | null; thumbCopiaCaptura: boolean; motivoNulo: MotivoNulo | null }`
  - `calcularAbDoDia(i: { day: string; tests: AbTest[]; cycles: AbCycle[]; capturedAt: number; titleAtCapture: string | null }): AbDia`
  - `TOLERANCIA_SOMA_MS = 5_000`

**Regras (spec, seção 3, "O que vale para o dia").** `cycles` são todos os ciclos dos testes do vídeo que estão abertos ou terminaram depois do começo do dia; podem incluir ciclos que começaram depois do dia.
1. Fim efetivo do ciclo: `ended_at`; se aberto e o teste está `active`, infinito; se aberto e o teste está em qualquer outro estado, `paused_at` (ou `completed_at` para `completed`/`archived`); com as duas nulas, `started_at`. O fim nunca é menor que o começo.
2. Segundos de cada ciclo = sobreposição com o dia, calculada duas vezes (`boundsAnalytics` e `boundsReporting`). Ciclo sem sobreposição em nenhum dos dois não é "do dia".
3. Sem ciclo do dia: `title = titleAtCapture`, `thumbCopiaCaptura = true`, tudo de A/B nulo.
4. `ab_test_id` = o teste com mais segundos no cálculo `_analytics`. `ab_variant_id` = a variante de mais segundos desse teste no cálculo `_analytics`; `on_air` é dela e `other` é a soma das demais.
5. `ab_variant_id`, `title` e `thumbCopiaCaptura` ficam nulos/falso (e `ab_test_id` continua preenchido) quando: há ciclos de mais de um teste no dia; o teste tem mais de um ciclo aberto que começa antes do fim do dia, ou um ciclo aberto com outro de `started_at` posterior; a soma dos segundos passa da duração real do dia em qualquer dos dois cálculos (com 5 s de tolerância para a ordem de gravação entre fechar um ciclo e abrir o seguinte); ou o tempo fora de qualquer ciclo (duração do dia `_analytics` menos a soma) é maior que `on_air`.
6. `title` = `applied_metadata.title_set` do ciclo dessa variante com mais segundos no dia; se ausente ou vazio, `original_title`; se ausente, `titleAtCapture`.
7. `thumbCopiaCaptura` = a variante do ciclo que contém `capturedAt` é a mesma `ab_variant_id`.

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/test/youtube/coleta/ab-seconds.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { calcularAbDoDia, type AbCycle, type AbTest } from '@/lib/youtube/coleta/ab-seconds'
import { boundsAnalytics } from '@/lib/youtube/coleta/day-pt'

// Dia de verão: no Pacífico vai de 2026-07-15T07:00Z a 2026-07-16T07:00Z; em UTC-8 fixo, das 08:00Z às 08:00Z.
const D = '2026-07-15'
const CAPTURA = Date.parse('2026-07-16T12:00:00.000Z')

const teste = (extra: Partial<AbTest> = {}): AbTest => ({
  id: 't1', status: 'active', paused_at: null, completed_at: null, original_title: 'Título original', ...extra,
})
const ciclo = (id: string, variant: string, started: string, ended: string | null, extra: Partial<AbCycle> = {}): AbCycle => ({
  id, test_id: 't1', variant_id: variant, started_at: started, ended_at: ended, applied_metadata: null, ...extra,
})
const calc = (o: Partial<Parameters<typeof calcularAbDoDia>[0]>) =>
  calcularAbDoDia({ day: D, tests: [teste()], cycles: [], capturedAt: CAPTURA, titleAtCapture: 'Título na captura', ...o })

describe('sem ciclo de teste no dia', () => {
  it('copia a captura e deixa tudo de A/B nulo', () => {
    expect(calc({ tests: [] })).toEqual({
      ab_test_id: null, ab_variant_id: null,
      seconds_on_air_analytics: null, seconds_other_analytics: null,
      seconds_on_air_reporting: null, seconds_other_reporting: null,
      title: 'Título na captura', thumbCopiaCaptura: true, motivoNulo: null,
    })
  })

  it('ciclo aberto de teste pausado antes do dia não conta', () => {
    const r = calc({
      tests: [teste({ status: 'paused', paused_at: '2026-07-10T00:00:00.000Z' })],
      cycles: [ciclo('c1', 'vA', '2026-07-01T00:00:00.000Z', null)],
    })
    expect(r.ab_test_id).toBeNull()
    expect(r.title).toBe('Título na captura')
  })

  it('ciclo aberto de teste não ativo sem paused_at nem completed_at termina em started_at', () => {
    const r = calc({
      tests: [teste({ status: 'paused' })],
      cycles: [ciclo('c1', 'vA', '2026-07-15T10:00:00.000Z', null)],
    })
    expect(r.ab_test_id).toBeNull()
  })
})

describe('os dois fusos', () => {
  it('rotação às 08:00 UTC num dia de horário de verão: other_analytics = 3600 e other_reporting = 0', () => {
    const r = calc({
      cycles: [
        ciclo('c1', 'vA', '2026-07-14T08:00:00.000Z', '2026-07-15T08:00:00.000Z'),
        ciclo('c2', 'vB', '2026-07-15T08:00:00.000Z', null),
      ],
    })
    expect(r).toMatchObject({
      ab_test_id: 't1', ab_variant_id: 'vB',
      seconds_on_air_analytics: 82_800, seconds_other_analytics: 3_600,
      seconds_on_air_reporting: 86_400, seconds_other_reporting: 0,
      motivoNulo: null,
    })
  })

  it('ciclo que só toca o dia em UTC-8 fixo: ab_test_id preenchido, variante nula', () => {
    const r = calc({ cycles: [ciclo('c1', 'vA', '2026-07-16T07:30:00.000Z', null)] })
    expect(r).toMatchObject({
      ab_test_id: 't1', ab_variant_id: null, title: null,
      seconds_on_air_analytics: 0, seconds_on_air_reporting: 1_800, motivoNulo: 'fora_de_ciclo',
    })
  })
})

describe('dias de 23, 24 e 25 horas, com teste no ar o dia inteiro', () => {
  it.each([
    ['2026-10-31', 86_400],
    ['2026-11-01', 90_000],
    ['2026-11-02', 86_400],
    ['2026-03-08', 82_800],
  ])('%s grava a variante certa com %i segundos no cálculo do Pacífico', (dia, segundos) => {
    const r = calc({
      day: dia,
      capturedAt: boundsAnalytics(dia).end + 5 * 3_600_000,
      cycles: [ciclo('c1', 'vA', '2026-01-01T00:00:00.000Z', null)],
    })
    expect(r).toMatchObject({
      ab_test_id: 't1', ab_variant_id: 'vA', title: 'Título original', thumbCopiaCaptura: true,
      seconds_on_air_analytics: segundos, seconds_other_analytics: 0,
      seconds_on_air_reporting: 86_400, seconds_other_reporting: 0,
      motivoNulo: null,
    })
  })
})

describe('regras de nulo', () => {
  it('pausar e retomar no mesmo dia (a pausa não fecha o ciclo e a retomada abre outro): variante, título e thumbnail nulos', () => {
    const r = calc({
      cycles: [
        ciclo('c1', 'vA', '2026-07-13T00:00:00.000Z', null),
        ciclo('c2', 'vB', '2026-07-15T15:00:00.000Z', null),
      ],
    })
    expect(r).toMatchObject({ ab_test_id: 't1', ab_variant_id: null, title: null, thumbCopiaCaptura: false, motivoNulo: 'ciclo_aberto_duplicado' })
  })

  it('dois ciclos abertos do mesmo teste, mesmo que da mesma variante: nulo', () => {
    const r = calc({
      cycles: [
        ciclo('c1', 'vA', '2026-07-13T00:00:00.000Z', null),
        ciclo('c2', 'vA', '2026-07-14T00:00:00.000Z', null),
      ],
    })
    expect(r.motivoNulo).toBe('ciclo_aberto_duplicado')
    expect(r.ab_variant_id).toBeNull()
  })

  it('pausa manual que fechou o ciclo, com buraco de 10 minutos: a variante de mais tempo vale', () => {
    const r = calc({
      cycles: [
        ciclo('c1', 'vA', '2026-07-14T00:00:00.000Z', '2026-07-15T13:00:00.000Z'),
        ciclo('c2', 'vB', '2026-07-15T13:10:00.000Z', null),
      ],
    })
    expect(r).toMatchObject({
      ab_variant_id: 'vB', motivoNulo: null,
      seconds_on_air_analytics: 64_200, seconds_other_analytics: 21_600,
      seconds_on_air_reporting: 67_800, seconds_other_reporting: 18_000,
    })
  })

  it('teste pausado no meio do dia: o ciclo aberto termina em paused_at, e o tempo fora de ciclo vence', () => {
    const r = calc({
      tests: [teste({ status: 'paused', paused_at: '2026-07-15T13:00:00.000Z' })],
      cycles: [ciclo('c1', 'vA', '2026-07-14T00:00:00.000Z', null)],
    })
    expect(r).toMatchObject({ ab_test_id: 't1', ab_variant_id: null, seconds_on_air_analytics: 21_600, motivoNulo: 'fora_de_ciclo' })
  })

  it('teste concluído no dia: o ciclo aberto termina em completed_at', () => {
    const r = calc({
      tests: [teste({ status: 'completed', completed_at: '2026-07-16T06:00:00.000Z', paused_at: '2026-07-01T00:00:00.000Z' })],
      cycles: [ciclo('c1', 'vA', '2026-07-14T00:00:00.000Z', null)],
    })
    expect(r).toMatchObject({ ab_variant_id: 'vA', seconds_on_air_analytics: 82_800, motivoNulo: null, thumbCopiaCaptura: false })
  })

  it('teste iniciado às 23:00 do Pacífico: campos de variante nulos, ab_test_id preenchido', () => {
    const r = calc({ cycles: [ciclo('c1', 'vA', '2026-07-16T06:00:00.000Z', null)] })
    expect(r).toMatchObject({ ab_test_id: 't1', ab_variant_id: null, title: null, seconds_on_air_analytics: 3_600, motivoNulo: 'fora_de_ciclo' })
  })

  it('ciclos de mais de um teste no dia: nulo, e ab_test_id é o de mais segundos', () => {
    const r = calc({
      tests: [teste({ id: 't1', status: 'completed', completed_at: '2026-07-15T20:00:00.000Z' }), teste({ id: 't2' })],
      cycles: [
        ciclo('c1', 'vA', '2026-07-14T00:00:00.000Z', '2026-07-15T20:00:00.000Z'),
        { ...ciclo('c2', 'vX', '2026-07-15T20:00:00.000Z', null), test_id: 't2' },
      ],
    })
    expect(r).toMatchObject({ ab_test_id: 't1', ab_variant_id: null, title: null, motivoNulo: 'mais_de_um_teste' })
  })

  it('soma dos ciclos acima da duração real do dia: nulo', () => {
    const r = calc({
      cycles: [
        ciclo('c1', 'vA', '2026-07-14T00:00:00.000Z', '2026-07-17T00:00:00.000Z'),
        ciclo('c2', 'vB', '2026-07-14T00:00:00.000Z', '2026-07-17T00:00:00.000Z'),
      ],
    })
    expect(r).toMatchObject({ ab_test_id: 't1', ab_variant_id: null, motivoNulo: 'soma_acima_do_dia' })
  })

  it('sobreposição de 2 segundos entre fechar e abrir (ordem de gravação) é tolerada', () => {
    const r = calc({
      cycles: [
        ciclo('c1', 'vA', '2026-07-14T00:00:00.000Z', '2026-07-15T19:00:02.000Z'),
        ciclo('c2', 'vB', '2026-07-15T19:00:00.000Z', null),
      ],
    })
    expect(r.motivoNulo).toBeNull()
    expect(r.ab_variant_id).toBe('vA')
  })
})

describe('título e thumbnail do dia', () => {
  const umCiclo = (meta: AbCycle['applied_metadata']) => [ciclo('c1', 'vA', '2026-07-01T00:00:00.000Z', null, { applied_metadata: meta })]

  it('title_set do ciclo vence', () => {
    expect(calc({ cycles: umCiclo({ title_set: 'Título da variante' }) }).title).toBe('Título da variante')
  })

  it('teste só de thumbnail, applied_metadata nulo: title é o original e ab_variant_id fica preenchido', () => {
    const r = calc({ cycles: umCiclo(null) })
    expect(r.title).toBe('Título original')
    expect(r.ab_variant_id).toBe('vA')
  })

  it('title_set vazio ou nulo cai no original; sem original, cai na captura', () => {
    expect(calc({ cycles: umCiclo({ title_set: '' }) }).title).toBe('Título original')
    expect(calc({ cycles: umCiclo({ title_set: null }), tests: [teste({ original_title: null })] }).title).toBe('Título na captura')
  })

  it('thumbnail copia a captura quando a variante no ar na captura é a do dia', () => {
    expect(calc({ cycles: umCiclo(null) }).thumbCopiaCaptura).toBe(true)
  })

  it('rotação entre o fim do dia e a captura: a thumbnail do dia NÃO copia a captura', () => {
    const r = calc({
      cycles: [
        ciclo('c1', 'vA', '2026-07-01T00:00:00.000Z', '2026-07-16T09:00:00.000Z'),
        ciclo('c2', 'vB', '2026-07-16T09:00:00.000Z', null),
      ],
    })
    expect(r).toMatchObject({ ab_variant_id: 'vA', title: 'Título original', thumbCopiaCaptura: false, motivoNulo: null })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/ab-seconds.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/youtube/coleta/ab-seconds"`.

- [ ] **Step 3: Implementar**

Create `apps/web/src/lib/youtube/coleta/ab-seconds.ts`:

```ts
// O que valeu para o dia quando havia teste A/B: segundos de cada variante dentro do dia, calculados
// duas vezes (dia do Pacífico com horário de verão e dia em UTC-8 fixo), e as regras de nulo.
// Função pura. `started_at` é a hora em que o servidor gravou o ciclo, não uma confirmação do YouTube.
import { boundsAnalytics, boundsReporting, type Intervalo } from './day-pt'

export interface AbTest {
  id: string
  status: string
  paused_at: string | null
  completed_at: string | null
  original_title: string | null
}

export interface AbCycle {
  id: string
  test_id: string
  variant_id: string
  started_at: string
  ended_at: string | null
  applied_metadata: { title_set?: string | null } | null
}

export type MotivoNulo = 'mais_de_um_teste' | 'ciclo_aberto_duplicado' | 'soma_acima_do_dia' | 'fora_de_ciclo'

export interface AbDia {
  ab_test_id: string | null
  ab_variant_id: string | null
  seconds_on_air_analytics: number | null
  seconds_other_analytics: number | null
  seconds_on_air_reporting: number | null
  seconds_other_reporting: number | null
  /** O título que valeu para o dia; null quando não dá para afirmar. */
  title: string | null
  /** true = `thumbnail_sha256` do dia pode copiar o sha256 da captura. */
  thumbCopiaCaptura: boolean
  motivoNulo: MotivoNulo | null
}

/** Fechar um ciclo e abrir o seguinte são duas gravações: até 5 s de sobreposição não é "soma acima do dia". */
export const TOLERANCIA_SOMA_MS = 5_000

const ms = (s: string): number => new Date(s).getTime()
const texto = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)
const segundos = (v: number): number => Math.round(v / 1000)
const soma = (m: Map<string, number>): number => [...m.values()].reduce((s, v) => s + v, 0)

/** Ciclo aberto só vai até o fim do dia se o teste está ativo; senão termina onde o teste parou. */
function fimEfetivo(c: AbCycle, t: AbTest | undefined): number {
  if (c.ended_at) return ms(c.ended_at)
  if (t?.status === 'active') return Number.POSITIVE_INFINITY
  const inicio = ms(c.started_at)
  const pausa = t?.paused_at ? ms(t.paused_at) : null
  const conclusao = t?.completed_at ? ms(t.completed_at) : null
  const parou = t?.status === 'completed' || t?.status === 'archived' ? (conclusao ?? pausa) : (pausa ?? conclusao)
  return Math.max(inicio, parou ?? inicio)
}

function sobreposicao(inicio: number, fim: number, i: Intervalo): number {
  return Math.max(0, Math.min(fim, i.end) - Math.max(inicio, i.start))
}

/** A chave de maior valor; empate resolve pela menor chave, para o resultado ser estável. */
function maior(m: Map<string, number>): [string, number] {
  let melhor: [string, number] | null = null
  for (const e of m) {
    if (!melhor || e[1] > melhor[1] || (e[1] === melhor[1] && e[0] < melhor[0])) melhor = e
  }
  return melhor!
}

export function calcularAbDoDia(i: {
  day: string
  tests: AbTest[]
  cycles: AbCycle[]
  /** epoch ms do instante da captura */
  capturedAt: number
  titleAtCapture: string | null
}): AbDia {
  const A = boundsAnalytics(i.day)
  const R = boundsReporting(i.day)
  const testes = new Map(i.tests.map(t => [t.id, t]))

  const linhas = i.cycles.map((c) => {
    const inicio = ms(c.started_at)
    const fim = fimEfetivo(c, testes.get(c.test_id))
    return { c, inicio, fim, a: sobreposicao(inicio, fim, A), r: sobreposicao(inicio, fim, R) }
  })
  const doDia = linhas.filter(l => l.a > 0 || l.r > 0)

  if (doDia.length === 0) {
    return {
      ab_test_id: null, ab_variant_id: null,
      seconds_on_air_analytics: null, seconds_other_analytics: null,
      seconds_on_air_reporting: null, seconds_other_reporting: null,
      title: i.titleAtCapture, thumbCopiaCaptura: true, motivoNulo: null,
    }
  }

  const porTeste = new Map<string, number>()
  for (const l of doDia) porTeste.set(l.c.test_id, (porTeste.get(l.c.test_id) ?? 0) + l.a)
  const [testId] = maior(porTeste)
  const doTeste = doDia.filter(l => l.c.test_id === testId)

  const varA = new Map<string, number>()
  const varR = new Map<string, number>()
  for (const l of doTeste) {
    varA.set(l.c.variant_id, (varA.get(l.c.variant_id) ?? 0) + l.a)
    varR.set(l.c.variant_id, (varR.get(l.c.variant_id) ?? 0) + l.r)
  }
  const [variantId, onAirA] = maior(varA)
  const somaA = soma(varA)
  const somaR = soma(varR)
  const onAirR = varR.get(variantId) ?? 0
  const duracaoA = A.end - A.start
  const duracaoR = R.end - R.start

  // Todos os ciclos do teste, inclusive os que começaram depois do dia (retomada, rotação pós-dia).
  const todosDoTeste = linhas.filter(l => l.c.test_id === testId)
  const fimDoDia = Math.max(A.end, R.end)
  const abertos = todosDoTeste.filter(l => l.c.ended_at === null && l.inicio < fimDoDia)
  const duplicado =
    abertos.length > 1 || abertos.some(a => todosDoTeste.some(o => o.c.id !== a.c.id && o.inicio > a.inicio))

  let motivoNulo: MotivoNulo | null = null
  if (porTeste.size > 1) motivoNulo = 'mais_de_um_teste'
  else if (duplicado) motivoNulo = 'ciclo_aberto_duplicado'
  else if (somaA > duracaoA + TOLERANCIA_SOMA_MS || somaR > duracaoR + TOLERANCIA_SOMA_MS) motivoNulo = 'soma_acima_do_dia'
  else if (duracaoA - somaA > onAirA) motivoNulo = 'fora_de_ciclo'

  const cicloDaVariante = doTeste
    .filter(l => l.c.variant_id === variantId)
    .sort((x, y) => y.a - x.a || y.inicio - x.inicio)[0]!
  const noArNaCaptura = [...todosDoTeste]
    .sort((x, y) => y.inicio - x.inicio)
    .find(l => l.inicio <= i.capturedAt && i.capturedAt < l.fim)

  return {
    ab_test_id: testId,
    ab_variant_id: motivoNulo ? null : variantId,
    seconds_on_air_analytics: segundos(onAirA),
    seconds_other_analytics: segundos(somaA - onAirA),
    seconds_on_air_reporting: segundos(onAirR),
    seconds_other_reporting: segundos(somaR - onAirR),
    title: motivoNulo
      ? null
      : (texto(cicloDaVariante.c.applied_metadata?.title_set) ?? texto(testes.get(testId)?.original_title) ?? i.titleAtCapture),
    thumbCopiaCaptura: !motivoNulo && noArNaCaptura?.c.variant_id === variantId,
    motivoNulo,
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/ab-seconds.test.ts`
Expected: PASS (23 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/coleta/ab-seconds.ts apps/web/test/youtube/coleta/ab-seconds.test.ts
git commit -m "feat: segundos de A/B por dia nos dois fusos, com as regras de nulo do spec" -- apps/web/src/lib/youtube/coleta/ab-seconds.ts apps/web/test/youtube/coleta/ab-seconds.test.ts
```

---

### Task 6: Registro de tentativas e o banco em memória dos testes

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/attempts.ts`
- Create: `apps/web/test/youtube/coleta/fake-supabase.ts`
- Test: `apps/web/test/youtube/coleta/attempts.test.ts`

**Interfaces:**
- Consumes (Task 3): `StepCtx`, `Tentativa`, `Outcome`, `AttemptKind` de `./types`; `conferirBanco`, `ErroBanco` de `./schema`. (Task 2): a função `yt_own_attempt_record`.
- Produces:
  - `registrarTentativa(ctx: Pick<StepCtx, 'supabase' | 'falhas' | 'tentativas'>, t: Tentativa): Promise<void>` — nunca lança.
  - `contarPorResultado(tentativas: readonly Tentativa[], kinds: readonly AttemptKind[]): Partial<Record<Outcome, number>>`
  - `scopeJob(channelUuid: string, reportTypeId: string): string` — `"<uuid>:<report_type_id>"`.
  - Helper de teste `fakeSupabase(seed?: Record<string, Row[]>): FakeDb`, com `FakeDb { tables; errors; writeErrors; rpcCalls; rpcHandlers; writes; client }`. `errors[tabela]` faz toda operação na tabela devolver o erro; `writeErrors[tabela]` só as escritas; `errors['rpc:<nome>']` faz a função devolver o erro. O handler padrão de `yt_own_attempt_record` grava em `tables.yt_own_collection_attempts` somando `attempts`.

- [ ] **Step 1: Escrever o banco em memória**

Create `apps/web/test/youtube/coleta/fake-supabase.ts`:

```ts
// Banco em memória para os testes da coleta. Cobre só o que os passos usam do supabase-js:
// from().select/insert/upsert/update/delete com eq, neq, in, lt, lte, gt, gte, is, not, or, order,
// limit, maybeSingle, single, e rpc(). `or()` é ignorado (os testes semeiam só o que interessa).
// Datas são comparadas como texto: use sempre toISOString() ou 'YYYY-MM-DD' nas sementes.
import type { SupabaseClient } from '@supabase/supabase-js'

export type Row = Record<string, unknown>
export interface FakeErr { code: string; message: string }
interface Resposta { data: unknown; error: FakeErr | null; count: number | null }

export interface FakeDb {
  tables: Record<string, Row[]>
  /** Toda operação na tabela (ou em `rpc:<nome>`) devolve este erro. */
  errors: Record<string, FakeErr | undefined>
  /** Só as escritas na tabela devolvem este erro. */
  writeErrors: Record<string, FakeErr | undefined>
  rpcCalls: Array<{ name: string; args: Row }>
  rpcHandlers: Record<string, (args: Row) => { data: unknown; error: FakeErr | null }>
  writes: Array<{ table: string; op: string; payload: unknown }>
  client: SupabaseClient
}

function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a == null) return -1
  if (b == null) return 1
  return (a as string | number) < (b as string | number) ? -1 : 1
}

class Consulta implements PromiseLike<Resposta> {
  private filtros: Array<(r: Row) => boolean> = []
  private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select'
  private payload: Row | Row[] | null = null
  private conflito: string[] = []
  private ignorarDuplicados = false
  private ordens: Array<{ col: string; asc: boolean }> = []
  private max: number | null = null
  private um = false
  private head = false
  private querCount = false

  constructor(private db: FakeDb, private tabela: string) {}

  select(_cols?: string, o?: { count?: string; head?: boolean }) {
    if (this.op === 'select') { this.head = !!o?.head; this.querCount = !!o?.count }
    return this
  }
  insert(p: Row | Row[]) { this.op = 'insert'; this.payload = p; return this }
  upsert(p: Row | Row[], o?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.op = 'upsert'
    this.payload = p
    this.conflito = (o?.onConflict ?? '').split(',').map(s => s.trim()).filter(Boolean)
    this.ignorarDuplicados = !!o?.ignoreDuplicates
    return this
  }
  update(p: Row) { this.op = 'update'; this.payload = p; return this }
  delete() { this.op = 'delete'; return this }

  eq(c: string, v: unknown) { this.filtros.push(r => r[c] === v); return this }
  neq(c: string, v: unknown) { this.filtros.push(r => r[c] !== v); return this }
  in(c: string, vs: readonly unknown[]) { this.filtros.push(r => vs.includes(r[c])); return this }
  lt(c: string, v: unknown) { this.filtros.push(r => r[c] != null && cmp(r[c], v) < 0); return this }
  lte(c: string, v: unknown) { this.filtros.push(r => r[c] != null && cmp(r[c], v) <= 0); return this }
  gt(c: string, v: unknown) { this.filtros.push(r => r[c] != null && cmp(r[c], v) > 0); return this }
  gte(c: string, v: unknown) { this.filtros.push(r => r[c] != null && cmp(r[c], v) >= 0); return this }
  is(c: string, v: unknown) { this.filtros.push(r => (r[c] ?? null) === v); return this }
  not(c: string, _op: string, v: unknown) { this.filtros.push(r => (r[c] ?? null) !== v); return this }
  or(_expr: string) { return this }
  order(col: string, o?: { ascending?: boolean }) { this.ordens.push({ col, asc: o?.ascending !== false }); return this }
  limit(n: number) { this.max = n; return this }
  maybeSingle() { this.um = true; return this }
  single() { this.um = true; return this }

  then<A = Resposta, B = never>(
    ok?: ((v: Resposta) => A | PromiseLike<A>) | null,
    falha?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.rodar()).then(ok, falha)
  }

  private rodar(): Resposta {
    const erro = this.db.errors[this.tabela] ?? (this.op === 'select' ? undefined : this.db.writeErrors[this.tabela])
    if (erro) return { data: null, error: erro, count: null }
    const linhas = (this.db.tables[this.tabela] ??= [])
    const casa = (r: Row) => this.filtros.every(f => f(r))

    if (this.op === 'select') {
      let out = linhas.filter(casa)
      for (const o of [...this.ordens].reverse()) out = [...out].sort((a, b) => cmp(a[o.col], b[o.col]) * (o.asc ? 1 : -1))
      const total = out.length
      if (this.max !== null) out = out.slice(0, this.max)
      if (this.head) return { data: null, error: null, count: total }
      return { data: this.um ? (out[0] ?? null) : out, error: null, count: this.querCount ? total : null }
    }

    this.db.writes.push({ table: this.tabela, op: this.op, payload: this.payload })
    const lista = Array.isArray(this.payload) ? this.payload : this.payload ? [this.payload] : []

    if (this.op === 'insert') {
      linhas.push(...lista.map(p => ({ ...p })))
      return { data: lista, error: null, count: null }
    }
    if (this.op === 'upsert') {
      for (const p of lista) {
        const i = this.conflito.length ? linhas.findIndex(r => this.conflito.every(k => r[k] === p[k])) : -1
        if (i === -1) linhas.push({ ...p })
        else if (!this.ignorarDuplicados) linhas[i] = { ...linhas[i], ...p }
      }
      return { data: lista, error: null, count: null }
    }
    const alvo = linhas.filter(casa)
    if (this.op === 'update') {
      for (const r of alvo) Object.assign(r, this.payload)
      return { data: alvo, error: null, count: null }
    }
    this.db.tables[this.tabela] = linhas.filter(r => !casa(r))
    return { data: alvo, error: null, count: null }
  }
}

export function fakeSupabase(seed: Record<string, Row[]> = {}): FakeDb {
  const db = {
    tables: structuredClone(seed), errors: {}, writeErrors: {}, rpcCalls: [], rpcHandlers: {}, writes: [],
  } as unknown as FakeDb

  // Mesmo comportamento de public.yt_own_attempt_record: uma linha por escopo, kind e dia UTC; soma attempts.
  db.rpcHandlers.yt_own_attempt_record = (a) => {
    const t = (db.tables.yt_own_collection_attempts ??= [])
    const dia = new Date().toISOString().slice(0, 10)
    const linha = {
      scope_type: a.p_scope_type, scope_id: a.p_scope_id, kind: a.p_kind, attempt_day: dia,
      site_id: a.p_site_id, channel_id: a.p_channel_id ?? null, outcome: a.p_outcome,
      http_status: a.p_http_status ?? null, error: a.p_error ?? null,
    }
    const i = t.findIndex(r => r.scope_type === linha.scope_type && r.scope_id === linha.scope_id && r.kind === linha.kind && r.attempt_day === dia)
    if (i === -1) { t.push({ ...linha, attempts: 1 }); return { data: 1, error: null } }
    const n = (t[i]!.attempts as number) + 1
    t[i] = { ...linha, attempts: n }
    return { data: n, error: null }
  }

  db.client = {
    from: (tabela: string) => new Consulta(db, tabela),
    rpc: (name: string, args: Row = {}) => {
      db.rpcCalls.push({ name, args })
      const erro = db.errors[`rpc:${name}`]
      if (erro) return Promise.resolve({ data: null, error: erro })
      const h = db.rpcHandlers[name]
      return Promise.resolve(h ? h(args) : { data: null, error: null })
    },
  } as unknown as SupabaseClient
  return db
}
```

- [ ] **Step 2: Escrever o teste que falha**

Create `apps/web/test/youtube/coleta/attempts.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { registrarTentativa, contarPorResultado, scopeJob } from '@/lib/youtube/coleta/attempts'
import type { Tentativa } from '@/lib/youtube/coleta/types'
import { fakeSupabase } from './fake-supabase'

const base: Tentativa = { site_id: 'site-1', scope_type: 'video', scope_id: 'yt-1', kind: 'meta', outcome: 'ok', channel_id: 'ch-1' }

describe('registrarTentativa', () => {
  it('chama yt_own_attempt_record com os oito parâmetros, grava também quando é ok, e soma attempts na reexecução', async () => {
    const db = fakeSupabase()
    const ctx = { supabase: db.client, falhas: [] as string[], tentativas: [] as Tentativa[] }
    await registrarTentativa(ctx, base)
    await registrarTentativa(ctx, { ...base, outcome: 'erro_http', http_status: 503, error: 'YouTube API 503' })
    expect(db.rpcCalls[0]).toEqual({
      name: 'yt_own_attempt_record',
      args: { p_site_id: 'site-1', p_scope_type: 'video', p_scope_id: 'yt-1', p_kind: 'meta', p_outcome: 'ok', p_http_status: null, p_error: null, p_channel_id: 'ch-1' },
    })
    expect(db.tables.yt_own_collection_attempts).toHaveLength(1)
    expect(db.tables.yt_own_collection_attempts![0]).toMatchObject({ outcome: 'erro_http', http_status: 503, attempts: 2 })
    expect(ctx.tentativas).toHaveLength(2)
    expect(ctx.falhas).toEqual([])
  })

  it('função ausente em produção (PGRST202): vira schema_ausente em falhas, uma vez, e não lança', async () => {
    const db = fakeSupabase()
    db.errors['rpc:yt_own_attempt_record'] = { code: 'PGRST202', message: 'Could not find the function' }
    const ctx = { supabase: db.client, falhas: [] as string[], tentativas: [] as Tentativa[] }
    await registrarTentativa(ctx, base)
    await registrarTentativa(ctx, { ...base, scope_id: 'yt-2' })
    expect(ctx.falhas).toEqual(['schema_ausente: yt_own_collection_attempts'])
    expect(ctx.tentativas).toHaveLength(2)
  })

  it('cliente que lança (rede) vira falha de banco, sem derrubar o passo', async () => {
    const supabase = { rpc: () => { throw new Error('fetch failed') } } as never
    const ctx = { supabase, falhas: [] as string[], tentativas: [] as Tentativa[] }
    await expect(registrarTentativa(ctx, base)).resolves.toBeUndefined()
    expect(ctx.falhas).toEqual(['erro de banco ao gravar yt_own_collection_attempts'])
  })
})

describe('contarPorResultado e scopeJob', () => {
  it('conta só os kinds pedidos', () => {
    const t: Tentativa[] = [
      base,
      { ...base, scope_id: 'yt-2' },
      { ...base, kind: 'thumbnail', outcome: 'erro_http' },
      { ...base, kind: 'sondagem', outcome: 'sem_conexao' },
    ]
    expect(contarPorResultado(t, ['meta', 'thumbnail'])).toEqual({ ok: 2, erro_http: 1 })
    expect(contarPorResultado(t, ['relatorio'])).toEqual({})
  })

  it('scopeJob junta o uuid do canal e o tipo de relatório', () => {
    expect(scopeJob('ch-1', 'channel_reach_basic_a1')).toBe('ch-1:channel_reach_basic_a1')
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/attempts.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/youtube/coleta/attempts"`.

- [ ] **Step 4: Implementar**

Create `apps/web/src/lib/youtube/coleta/attempts.ts`:

```ts
// Registro de tentativas em yt_own_collection_attempts, pela função do banco (o PostgREST não soma
// num upsert). Toda tentativa é gravada, inclusive `ok`: sem linha = nunca tentado.
import { conferirBanco, type ErroBanco } from './schema'
import type { AttemptKind, Outcome, StepCtx, Tentativa } from './types'

/** Nunca lança: erro ao gravar a tentativa vira item de `falhas[]`. */
export async function registrarTentativa(
  ctx: Pick<StepCtx, 'supabase' | 'falhas' | 'tentativas'>,
  t: Tentativa,
): Promise<void> {
  ctx.tentativas.push(t)
  let res: { error: ErroBanco | null }
  try {
    res = await ctx.supabase.rpc('yt_own_attempt_record', {
      p_site_id: t.site_id,
      p_scope_type: t.scope_type,
      p_scope_id: t.scope_id,
      p_kind: t.kind,
      p_outcome: t.outcome,
      p_http_status: t.http_status ?? null,
      p_error: t.error ?? null,
      p_channel_id: t.channel_id ?? null,
    })
  } catch {
    res = { error: { code: null, message: 'rpc lançou' } }
  }
  conferirBanco(res, 'yt_own_collection_attempts', ctx.falhas)
}

export function contarPorResultado(
  tentativas: readonly Tentativa[],
  kinds: readonly AttemptKind[],
): Partial<Record<Outcome, number>> {
  const out: Partial<Record<Outcome, number>> = {}
  for (const t of tentativas) {
    if (!kinds.includes(t.kind)) continue
    out[t.outcome] = (out[t.outcome] ?? 0) + 1
  }
  return out
}

/** `scope_id` de um job: `<youtube_channels.id>:<report_type_id>`. */
export function scopeJob(channelUuid: string, reportTypeId: string): string {
  return `${channelUuid}:${reportTypeId}`
}
```

- [ ] **Step 5: Rodar e ver passar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/attempts.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/youtube/coleta/attempts.ts apps/web/test/youtube/coleta/attempts.test.ts apps/web/test/youtube/coleta/fake-supabase.ts
git commit -m "feat: registro de tentativas da coleta pela função do banco" -- apps/web/src/lib/youtube/coleta/attempts.ts apps/web/test/youtube/coleta/attempts.test.ts apps/web/test/youtube/coleta/fake-supabase.ts
```

---

### Task 7: Avisos deduplicados

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/alerts.ts`
- Test: `apps/web/test/youtube/coleta/alerts.test.ts`

**Interfaces:**
- Consumes (Task 3): `StepCtx`, `ColetaChannel`, `pushUnico`. Do projeto: `claimAlert(supabase, key, interval): Promise<boolean>`, `readAlertStamp(supabase, key): Promise<Date | null>`, `releaseAlert(supabase, key): Promise<void>` de `@/lib/ops/alert-state`; `fanOutToSiteAdmins(opts): Promise<number>` de `@/lib/notifications/fan-out-to-admins`; `getSiteOwners(client, siteId): Promise<ISiteOwner[]>`, `logSemDestinatario(routine, siteId)`, `SEM_DESTINATARIO = 'sem_destinatario'` de `@/lib/notifications/get-site-owners`.
- Produces:
  - `type MotivoAviso = 'api_nao_ativada' | 'sem_acesso' | 'tipo_indisponivel'`
  - `chaveAviso(channelUuid: string, motivo: MotivoAviso): string` → `sync-analytics:<uuid>:<motivo>`
  - `textoAviso(motivo: MotivoAviso | 'saida', nome: string): string`
  - `avisarEntrada(ctx: Pick<StepCtx, 'supabase' | 'falhas'>, ch: ColetaChannel, motivo: MotivoAviso): Promise<void>` — nunca lança.
  - `avisarSaida(ctx: Pick<StepCtx, 'supabase' | 'falhas'>, ch: ColetaChannel): Promise<void>` — nunca lança.

**Comportamento.** Entrada e lembrete: `claimAlert(supabase, chave, '7 days')`; verdadeiro = avisar. `tipo_indisponivel` avisa uma vez (janela `'3650 days'`) e não tem aviso de saída. Se o aviso não puder ser entregue (lista de donos vazia, zero notificações criadas, ou exceção), entra uma falha crítica e o carimbo é liberado com `releaseAlert`, para a próxima execução tentar de novo. Saída: se houver carimbo de `api_nao_ativada` ou `sem_acesso`, envia um aviso de saída e libera os carimbos.

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/test/youtube/coleta/alerts.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ops/alert-state', () => ({
  claimAlert: vi.fn(),
  readAlertStamp: vi.fn(),
  releaseAlert: vi.fn(),
}))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn() }))
vi.mock('@/lib/notifications/get-site-owners', () => ({
  SEM_DESTINATARIO: 'sem_destinatario',
  getSiteOwners: vi.fn(),
  logSemDestinatario: vi.fn(),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { avisarEntrada, avisarSaida, textoAviso, chaveAviso } from '@/lib/youtube/coleta/alerts'
import { claimAlert, readAlertStamp, releaseAlert } from '@/lib/ops/alert-state'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { getSiteOwners } from '@/lib/notifications/get-site-owners'
import type { SupabaseClient } from '@supabase/supabase-js'

const canal = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true }
const novoCtx = () => ({ supabase: {} as SupabaseClient, falhas: [] as string[] })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSiteOwners).mockResolvedValue([{ userId: 'u1', email: 'dono@example.test' }])
  vi.mocked(fanOutToSiteAdmins).mockResolvedValue(1)
  vi.mocked(readAlertStamp).mockResolvedValue(null)
})

describe('textos e chave', () => {
  it('são exatamente os do spec', () => {
    expect(textoAviso('api_nao_ativada', 'Canal Um')).toBe('A YouTube Reporting API não está ativada no projeto do Google. Impressões e CTR não estão sendo coletados.')
    expect(textoAviso('sem_acesso', 'Canal Um')).toBe('O YouTube recusou o acesso aos relatórios do canal Canal Um. Impressões e CTR não estão sendo coletados.')
    expect(textoAviso('tipo_indisponivel', 'Canal Um')).toBe('O YouTube não oferece o relatório de alcance para o canal Canal Um.')
    expect(textoAviso('saida', 'Canal Um')).toBe('A coleta do canal Canal Um voltou ao normal.')
    expect(chaveAviso('ch-1', 'sem_acesso')).toBe('sync-analytics:ch-1:sem_acesso')
  })
})

describe('avisarEntrada', () => {
  it('duas execuções, um só aviso: a segunda cai dentro da janela de 7 dias', async () => {
    vi.mocked(claimAlert).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const ctx = novoCtx()
    await avisarEntrada(ctx, canal, 'api_nao_ativada')
    await avisarEntrada(ctx, canal, 'api_nao_ativada')
    expect(claimAlert).toHaveBeenCalledWith(ctx.supabase, 'sync-analytics:ch-1:api_nao_ativada', '7 days')
    expect(fanOutToSiteAdmins).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fanOutToSiteAdmins).mock.calls[0]![0]).toMatchObject({
      siteId: 'site-1', domain: 'youtube', type: 'youtube.coleta_api_nao_ativada',
      message: 'A YouTube Reporting API não está ativada no projeto do Google. Impressões e CTR não estão sendo coletados.',
    })
    expect(ctx.falhas).toEqual([])
  })

  it('tipo_indisponivel avisa uma vez só: janela de 3650 dias', async () => {
    vi.mocked(claimAlert).mockResolvedValue(true)
    const ctx = novoCtx()
    await avisarEntrada(ctx, canal, 'tipo_indisponivel')
    expect(claimAlert).toHaveBeenCalledWith(ctx.supabase, 'sync-analytics:ch-1:tipo_indisponivel', '3650 days')
  })

  it('sem destinatário: falha crítica, nada é enviado e o carimbo é liberado para tentar de novo', async () => {
    vi.mocked(claimAlert).mockResolvedValue(true)
    vi.mocked(getSiteOwners).mockResolvedValue([])
    const ctx = novoCtx()
    await avisarEntrada(ctx, canal, 'sem_acesso')
    expect(fanOutToSiteAdmins).not.toHaveBeenCalled()
    expect(ctx.falhas).toEqual(['aviso sem_acesso (Canal Um): sem_destinatario'])
    expect(releaseAlert).toHaveBeenCalledWith(ctx.supabase, 'sync-analytics:ch-1:sem_acesso')
  })

  it('zero notificações criadas também é sem destinatário', async () => {
    vi.mocked(claimAlert).mockResolvedValue(true)
    vi.mocked(fanOutToSiteAdmins).mockResolvedValue(0)
    const ctx = novoCtx()
    await avisarEntrada(ctx, canal, 'sem_acesso')
    expect(ctx.falhas).toEqual(['aviso sem_acesso (Canal Um): sem_destinatario'])
    expect(releaseAlert).toHaveBeenCalledTimes(1)
  })

  it('exceção no envio: falha crítica, sem lançar', async () => {
    vi.mocked(claimAlert).mockResolvedValue(true)
    vi.mocked(fanOutToSiteAdmins).mockRejectedValue(new Error('boom'))
    const ctx = novoCtx()
    await expect(avisarEntrada(ctx, canal, 'sem_acesso')).resolves.toBeUndefined()
    expect(ctx.falhas).toEqual(['aviso sem_acesso (Canal Um): falha no envio'])
    expect(releaseAlert).toHaveBeenCalledTimes(1)
  })

  it('exceção no carimbo (ops_alert_claim fora do ar): falha crítica, sem lançar e sem enviar', async () => {
    vi.mocked(claimAlert).mockRejectedValue(new Error('ops_alert_claim failed'))
    const ctx = novoCtx()
    await expect(avisarEntrada(ctx, canal, 'sem_acesso')).resolves.toBeUndefined()
    expect(fanOutToSiteAdmins).not.toHaveBeenCalled()
    expect(ctx.falhas).toEqual(['aviso sem_acesso (Canal Um): falha no envio'])
  })
})

describe('avisarSaida', () => {
  it('com carimbo de entrada: um aviso de saída e os carimbos são liberados', async () => {
    vi.mocked(readAlertStamp).mockImplementation(async (_s, key) => (key.endsWith(':sem_acesso') ? new Date() : null))
    const ctx = novoCtx()
    await avisarSaida(ctx, canal)
    expect(fanOutToSiteAdmins).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fanOutToSiteAdmins).mock.calls[0]![0]).toMatchObject({ type: 'youtube.coleta_saida', message: 'A coleta do canal Canal Um voltou ao normal.' })
    expect(releaseAlert).toHaveBeenCalledWith(ctx.supabase, 'sync-analytics:ch-1:sem_acesso')
    expect(releaseAlert).toHaveBeenCalledTimes(1)
  })

  it('sem carimbo: nada é enviado e o carimbo de tipo_indisponivel nem é consultado', async () => {
    const ctx = novoCtx()
    await avisarSaida(ctx, canal)
    expect(fanOutToSiteAdmins).not.toHaveBeenCalled()
    expect(vi.mocked(readAlertStamp).mock.calls.map(c => c[1])).toEqual(['sync-analytics:ch-1:api_nao_ativada', 'sync-analytics:ch-1:sem_acesso'])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/alerts.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/youtube/coleta/alerts"`.

- [ ] **Step 3: Implementar**

Create `apps/web/src/lib/youtube/coleta/alerts.ts`:

```ts
// Avisos ao dono da classe "ação do dono" (spec, seções 1 e 9). `ops_alert_state` é carimbo de
// aviso, nunca contador. Aviso que não pode ser entregue é falha crítica.
import * as Sentry from '@sentry/nextjs'
import { claimAlert, readAlertStamp, releaseAlert } from '@/lib/ops/alert-state'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { getSiteOwners, logSemDestinatario, SEM_DESTINATARIO } from '@/lib/notifications/get-site-owners'
import { pushUnico } from './schema'
import type { ColetaChannel, StepCtx } from './types'

export type MotivoAviso = 'api_nao_ativada' | 'sem_acesso' | 'tipo_indisponivel'
type Ctx = Pick<StepCtx, 'supabase' | 'falhas'>

/** Motivos que ganham aviso de saída quando a chamada volta a passar. */
const MOTIVOS_COM_SAIDA: readonly MotivoAviso[] = ['api_nao_ativada', 'sem_acesso']

/** Entrada e lembrete a cada 7 dias; `tipo_indisponivel` avisa uma vez. */
const JANELA: Record<MotivoAviso, string> = {
  api_nao_ativada: '7 days',
  sem_acesso: '7 days',
  tipo_indisponivel: '3650 days',
}

const TITULO: Record<MotivoAviso | 'saida', string> = {
  api_nao_ativada: 'YouTube Reporting API não ativada',
  sem_acesso: 'YouTube recusou o acesso aos relatórios',
  tipo_indisponivel: 'Relatório de alcance indisponível',
  saida: 'Coleta do YouTube voltou ao normal',
}

export function chaveAviso(channelUuid: string, motivo: MotivoAviso): string {
  return `sync-analytics:${channelUuid}:${motivo}`
}

export function textoAviso(motivo: MotivoAviso | 'saida', nome: string): string {
  switch (motivo) {
    case 'api_nao_ativada':
      return 'A YouTube Reporting API não está ativada no projeto do Google. Impressões e CTR não estão sendo coletados.'
    case 'sem_acesso':
      return `O YouTube recusou o acesso aos relatórios do canal ${nome}. Impressões e CTR não estão sendo coletados.`
    case 'tipo_indisponivel':
      return `O YouTube não oferece o relatório de alcance para o canal ${nome}.`
    case 'saida':
      return `A coleta do canal ${nome} voltou ao normal.`
  }
}

/** Entrega o aviso. Devolve false (e registra a falha crítica) quando ninguém foi avisado. */
async function entregar(ctx: Ctx, ch: ColetaChannel, motivo: MotivoAviso | 'saida'): Promise<boolean> {
  const nota = `aviso ${motivo} (${ch.name})`
  try {
    const donos = await getSiteOwners(ctx.supabase, ch.site_id)
    if (donos.length === 0) {
      logSemDestinatario('sync-analytics-metrics', ch.site_id)
      pushUnico(ctx.falhas, `${nota}: ${SEM_DESTINATARIO}`)
      return false
    }
    const enviados = await fanOutToSiteAdmins({
      siteId: ch.site_id,
      domain: 'youtube',
      type: `youtube.coleta_${motivo}`,
      priority: 4,
      title: TITULO[motivo],
      message: textoAviso(motivo, ch.name),
      dedupKey: `coleta-${motivo}-${ch.id}-${new Date().toISOString().slice(0, 10)}`,
      actionHref: '/cms/youtube',
    })
    if (enviados === 0) {
      logSemDestinatario('sync-analytics-metrics', ch.site_id)
      pushUnico(ctx.falhas, `${nota}: ${SEM_DESTINATARIO}`)
      return false
    }
    return true
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', aviso: motivo } })
    pushUnico(ctx.falhas, `${nota}: falha no envio`)
    return false
  }
}

/** Entrada ou lembrete. Nunca lança. */
export async function avisarEntrada(ctx: Ctx, ch: ColetaChannel, motivo: MotivoAviso): Promise<void> {
  const chave = chaveAviso(ch.id, motivo)
  let abriu: boolean
  try {
    abriu = await claimAlert(ctx.supabase, chave, JANELA[motivo])
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', aviso: motivo } })
    pushUnico(ctx.falhas, `aviso ${motivo} (${ch.name}): falha no envio`)
    return
  }
  if (!abriu) return
  const entregue = await entregar(ctx, ch, motivo)
  if (!entregue) {
    try {
      await releaseAlert(ctx.supabase, chave)
    } catch (e) {
      Sentry.captureException(e)
    }
  }
}

/** Saída: só quando havia carimbo de entrada. Nunca lança. */
export async function avisarSaida(ctx: Ctx, ch: ColetaChannel): Promise<void> {
  try {
    const abertas: string[] = []
    for (const motivo of MOTIVOS_COM_SAIDA) {
      const chave = chaveAviso(ch.id, motivo)
      if ((await readAlertStamp(ctx.supabase, chave)) !== null) abertas.push(chave)
    }
    if (abertas.length === 0) return
    await entregar(ctx, ch, 'saida')
    for (const chave of abertas) await releaseAlert(ctx.supabase, chave)
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', aviso: 'saida' } })
    pushUnico(ctx.falhas, `aviso saida (${ch.name}): falha no envio`)
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/alerts.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/coleta/alerts.ts apps/web/test/youtube/coleta/alerts.test.ts
git commit -m "feat: avisos deduplicados da coleta (API não ativada, sem acesso, tipo indisponível, saída)" -- apps/web/src/lib/youtube/coleta/alerts.ts apps/web/test/youtube/coleta/alerts.test.ts
```

---

### Task 8: Cliente da YouTube Reporting API

**Files:**
- Create: `apps/web/src/lib/youtube/reporting/types.ts`
- Create: `apps/web/src/lib/youtube/reporting/client.ts`
- Test: `apps/web/test/youtube/coleta/reporting-client.test.ts`

**Interfaces:**
- Consumes: nada de outras tarefas (o `fetch` com prazo é injetado por quem chama).
- Produces:
  - `types.ts`: `REPORT_TYPES_ENABLED = ['channel_reach_basic_a1', 'channel_reach_combined_a1', 'channel_traffic_source_a3', 'channel_basic_a3'] as const` (a ordem É a prioridade de download), `type ReportTypeId`, `REACH_TYPES = ['channel_reach_basic_a1', 'channel_reach_combined_a1'] as const`, `SEM_NORMALIZADOR: string[]` (os habilitados menos `channel_reach_basic_a1`), `interface ReportType { id: string; name?: string }`, `interface Job { id: string; reportTypeId: string; name?: string; createTime?: string }`, `interface Report { id: string; jobId?: string; startTime: string; endTime: string; createTime: string; jobExpireTime?: string; downloadUrl: string }`, `class ReportingHttpError extends Error { status: number; reason: string | null }`.
  - `client.ts`: `REPORTING_BASE = 'https://youtubereporting.googleapis.com/v1'`, `interface PacoteCsv { gz: Buffer; sha256: string; rowCount: number }`, `interface ReportingClient { reportTypesList(): Promise<ReportType[]>; jobsList(): Promise<Job[]>; jobsCreate(i: { reportTypeId: string; name: string }): Promise<Job>; reportsList(jobId: string, o?: { createdAfter?: string; pageToken?: string }): Promise<{ reports: Report[]; nextPageToken: string | null }>; download(downloadUrl: string): Promise<PacoteCsv> }`, `criarReportingClient(accessToken: string, f: typeof fetch): ReportingClient`, `classificarErro(e: unknown): 'api_nao_ativada' | 'sem_acesso' | 'nao_encontrado' | 'outro'`, `empacotarCsv(bruto: Buffer): PacoteCsv`, `paraBytea(buf: Buffer): string`, `deBytea(s: string): Buffer`.

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/test/youtube/coleta/reporting-client.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { criarReportingClient, classificarErro, empacotarCsv, paraBytea, deBytea, REPORTING_BASE } from '@/lib/youtube/reporting/client'
import { REPORT_TYPES_ENABLED, REACH_TYPES, SEM_NORMALIZADOR, ReportingHttpError } from '@/lib/youtube/reporting/types'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const chamada = (f: ReturnType<typeof vi.fn>, i: number) => f.mock.calls[i] as unknown as [string, RequestInit | undefined]

describe('constantes', () => {
  it('tipos habilitados na ordem de prioridade de download, e os derivados', () => {
    expect([...REPORT_TYPES_ENABLED]).toEqual(['channel_reach_basic_a1', 'channel_reach_combined_a1', 'channel_traffic_source_a3', 'channel_basic_a3'])
    expect([...REACH_TYPES]).toEqual(['channel_reach_basic_a1', 'channel_reach_combined_a1'])
    expect(SEM_NORMALIZADOR).toEqual(['channel_reach_combined_a1', 'channel_traffic_source_a3', 'channel_basic_a3'])
    expect(REPORTING_BASE).toBe('https://youtubereporting.googleapis.com/v1')
  })
})

describe('chamadas', () => {
  it('reportTypesList manda o Bearer do canal e percorre nextPageToken', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json({ reportTypes: [{ id: 'a' }], nextPageToken: 'p2' }))
      .mockResolvedValueOnce(json({ reportTypes: [{ id: 'b' }] }))
    const tipos = await criarReportingClient('tok', f as unknown as typeof fetch).reportTypesList()
    expect(tipos.map(t => t.id)).toEqual(['a', 'b'])
    expect(chamada(f, 0)[0]).toBe('https://youtubereporting.googleapis.com/v1/reportTypes')
    expect(new Headers(chamada(f, 0)[1]!.headers).get('authorization')).toBe('Bearer tok')
    expect(new URL(chamada(f, 1)[0]).searchParams.get('pageToken')).toBe('p2')
  })

  it('jobsList devolve [] quando a resposta não traz a chave jobs', async () => {
    const f = vi.fn().mockResolvedValue(json({}))
    expect(await criarReportingClient('tok', f as unknown as typeof fetch).jobsList()).toEqual([])
  })

  it('jobsCreate faz POST com reportTypeId e name', async () => {
    const f = vi.fn().mockResolvedValue(json({ id: 'job-1', reportTypeId: 'channel_basic_a3', createTime: '2026-10-07T12:00:00Z' }))
    const job = await criarReportingClient('tok', f as unknown as typeof fetch).jobsCreate({ reportTypeId: 'channel_basic_a3', name: 'n' })
    expect(job.id).toBe('job-1')
    expect(chamada(f, 0)[0]).toBe('https://youtubereporting.googleapis.com/v1/jobs')
    expect(chamada(f, 0)[1]!.method).toBe('POST')
    expect(JSON.parse(chamada(f, 0)[1]!.body as string)).toEqual({ reportTypeId: 'channel_basic_a3', name: 'n' })
  })

  it('reportsList passa createdAfter e pageToken, e devolve nextPageToken nulo no fim', async () => {
    const f = vi.fn().mockResolvedValue(json({ reports: [{ id: 'r1', startTime: 's', endTime: 'e', createTime: 'c', downloadUrl: 'u' }] }))
    const r = await criarReportingClient('tok', f as unknown as typeof fetch).reportsList('job/1', { createdAfter: '2026-10-01T00:00:00.000Z', pageToken: 'p' })
    const url = new URL(chamada(f, 0)[0])
    expect(url.pathname).toBe('/v1/jobs/job%2F1/reports')
    expect(url.searchParams.get('createdAfter')).toBe('2026-10-01T00:00:00.000Z')
    expect(url.searchParams.get('pageToken')).toBe('p')
    expect(r).toEqual({ reports: [{ id: 'r1', startTime: 's', endTime: 'e', createTime: 'c', downloadUrl: 'u' }], nextPageToken: null })
  })

  it('reportsList sem opções não manda createdAfter', async () => {
    const f = vi.fn().mockResolvedValue(json({}))
    const r = await criarReportingClient('tok', f as unknown as typeof fetch).reportsList('job-1')
    expect(new URL(chamada(f, 0)[0]).search).toBe('')
    expect(r).toEqual({ reports: [], nextPageToken: null })
  })

  it('download usa a URL como veio, com o mesmo token e Accept-Encoding gzip', async () => {
    const f = vi.fn().mockResolvedValue(new Response('date,video_id\n20261006,abc\n'))
    const pacote = await criarReportingClient('tok', f as unknown as typeof fetch).download('https://youtubereporting.googleapis.com/v1/media/CHANNEL/x/jobs/j/reports/r?alt=media')
    expect(chamada(f, 0)[0]).toBe('https://youtubereporting.googleapis.com/v1/media/CHANNEL/x/jobs/j/reports/r?alt=media')
    const h = new Headers(chamada(f, 0)[1]!.headers)
    expect(h.get('authorization')).toBe('Bearer tok')
    expect(h.get('accept-encoding')).toBe('gzip')
    expect(pacote.rowCount).toBe(1)
  })
})

describe('erros', () => {
  it('403 accessNotConfigured → api_nao_ativada', async () => {
    const f = vi.fn().mockResolvedValue(json({ error: { code: 403, errors: [{ reason: 'accessNotConfigured' }] } }, 403))
    const e = await criarReportingClient('tok', f as unknown as typeof fetch).reportTypesList().catch(x => x)
    expect(e).toBeInstanceOf(ReportingHttpError)
    expect(e).toMatchObject({ status: 403, reason: 'accessNotConfigured' })
    expect(classificarErro(e)).toBe('api_nao_ativada')
  })

  it('403 com details SERVICE_DISABLED (formato novo do Google) → api_nao_ativada', async () => {
    const f = vi.fn().mockResolvedValue(json({ error: { code: 403, status: 'PERMISSION_DENIED', details: [{ '@type': 'x', reason: 'SERVICE_DISABLED' }] } }, 403))
    const e = await criarReportingClient('tok', f as unknown as typeof fetch).jobsList().catch(x => x)
    expect(classificarErro(e)).toBe('api_nao_ativada')
  })

  it('401 e 403 insufficientPermissions → sem_acesso; 404 → nao_encontrado; 500, 403 de cota e erro de rede → outro', () => {
    expect(classificarErro(new ReportingHttpError(401, null))).toBe('sem_acesso')
    expect(classificarErro(new ReportingHttpError(403, 'insufficientPermissions'))).toBe('sem_acesso')
    expect(classificarErro(new ReportingHttpError(403, 'ACCESS_TOKEN_SCOPE_INSUFFICIENT'))).toBe('sem_acesso')
    expect(classificarErro(new ReportingHttpError(404, null))).toBe('nao_encontrado')
    expect(classificarErro(new ReportingHttpError(500, null))).toBe('outro')
    expect(classificarErro(new ReportingHttpError(403, 'quotaExceeded'))).toBe('outro')
    expect(classificarErro(new TypeError('fetch failed'))).toBe('outro')
  })

  it('corpo de erro que não é JSON: reason nulo, e a mensagem do erro não carrega o corpo', async () => {
    const f = vi.fn().mockResolvedValue(new Response('<html>ya29.SEGREDO</html>', { status: 502 }))
    const e = await criarReportingClient('tok', f as unknown as typeof fetch).jobsList().catch(x => x) as ReportingHttpError
    expect(e.reason).toBeNull()
    expect(e.message).toBe('YouTube Reporting API HTTP 502')
  })
})

describe('empacotarCsv e bytea', () => {
  const csv = Buffer.from('date,video_id,views\n20261006,abc,10\n20261006,def,20\n')

  it('CSV puro é comprimido: csv_gz é sempre gzip, sha256 é do CSV descomprimido', () => {
    const p = empacotarCsv(csv)
    expect(p.gz[0]).toBe(0x1f)
    expect(p.gz[1]).toBe(0x8b)
    expect(gunzipSync(p.gz).equals(csv)).toBe(true)
    expect(p.sha256).toBe(createHash('sha256').update(csv).digest('hex'))
    expect(p.rowCount).toBe(2)
  })

  it('o que já veio gzip é guardado como veio', () => {
    const gz = gzipSync(csv)
    const p = empacotarCsv(gz)
    expect(p.gz.equals(gz)).toBe(true)
    expect(p.sha256).toBe(createHash('sha256').update(csv).digest('hex'))
    expect(p.rowCount).toBe(2)
  })

  it('só cabeçalho, ou vazio: rowCount 0', () => {
    expect(empacotarCsv(Buffer.from('date,video_id,views\n')).rowCount).toBe(0)
    expect(empacotarCsv(Buffer.from('')).rowCount).toBe(0)
  })

  it('ida e volta do bytea com os bytes 0x00 e 0xff', () => {
    const buf = Buffer.from([0x1f, 0x8b, 0x00, 0xff, 0x00, 0xff])
    const texto = paraBytea(buf)
    expect(texto).toBe('\\x1f8b00ff00ff')
    expect(deBytea(texto).equals(buf)).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/reporting-client.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/youtube/reporting/client"`.

- [ ] **Step 3: Implementar**

Create `apps/web/src/lib/youtube/reporting/types.ts`:

```ts
// Tipos e constantes da YouTube Reporting API (relatórios em lote). API separada da Analytics API.

/** Tipos de relatório que o site pede. A ORDEM é a prioridade de download. Habilitar um tipo é um commit de uma linha. */
export const REPORT_TYPES_ENABLED = [
  'channel_reach_basic_a1',
  'channel_reach_combined_a1',
  'channel_traffic_source_a3',
  'channel_basic_a3',
] as const
export type ReportTypeId = (typeof REPORT_TYPES_ENABLED)[number]

/** "Relatório de alcance" nos critérios da seção 9 do spec. */
export const REACH_TYPES = ['channel_reach_basic_a1', 'channel_reach_combined_a1'] as const

/** Tipos sem normalizador neste spec: o bruto é apagado 180 dias depois do download. */
export const SEM_NORMALIZADOR: string[] = REPORT_TYPES_ENABLED.filter(t => t !== 'channel_reach_basic_a1')

export interface ReportType {
  id: string
  name?: string
}

export interface Job {
  id: string
  reportTypeId: string
  name?: string
  createTime?: string
}

export interface Report {
  id: string
  jobId?: string
  startTime: string
  endTime: string
  createTime: string
  jobExpireTime?: string
  downloadUrl: string
}

/** Resposta não-ok da Reporting API. Leva só o status e o `reason`; nunca o corpo. */
export class ReportingHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string | null,
  ) {
    super(`YouTube Reporting API HTTP ${status}`)
    this.name = 'ReportingHttpError'
  }
}
```

Create `apps/web/src/lib/youtube/reporting/client.ts`:

```ts
// Cliente da YouTube Reporting API. Todas as chamadas levam o token do canal dono.
// O `fetch` é injetado: quem chama passa um fetch que já aplica o prazo do passo.
import { createHash } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import { ReportingHttpError, type Job, type Report, type ReportType } from './types'

export const REPORTING_BASE = 'https://youtubereporting.googleapis.com/v1'
const MAX_PAGINAS = 20

export interface PacoteCsv {
  /** Sempre gzip. */
  gz: Buffer
  /** Do CSV descomprimido. */
  sha256: string
  /** Linhas de dado (sem o cabeçalho). */
  rowCount: number
}

export interface ReportingClient {
  reportTypesList(): Promise<ReportType[]>
  jobsList(): Promise<Job[]>
  jobsCreate(i: { reportTypeId: string; name: string }): Promise<Job>
  reportsList(jobId: string, o?: { createdAfter?: string; pageToken?: string }): Promise<{ reports: Report[]; nextPageToken: string | null }>
  download(downloadUrl: string): Promise<PacoteCsv>
}

/** `csv_gz` é sempre gzip: se os dois primeiros bytes são 1f 8b guarda como veio; senão comprime. */
export function empacotarCsv(bruto: Buffer): PacoteCsv {
  const jaGzip = bruto.length >= 2 && bruto[0] === 0x1f && bruto[1] === 0x8b
  const csv = jaGzip ? gunzipSync(bruto) : bruto
  const gz = jaGzip ? bruto : gzipSync(bruto)
  const linhas = csv.toString('utf8').split('\n').filter(l => l.trim().length > 0).length
  return { gz, sha256: createHash('sha256').update(csv).digest('hex'), rowCount: Math.max(0, linhas - 1) }
}

/** Forma em que o PostgREST aceita e devolve `bytea`: `\x` + hex. */
export function paraBytea(buf: Buffer): string {
  return `\\x${buf.toString('hex')}`
}

export function deBytea(s: string): Buffer {
  return Buffer.from(s.slice(2), 'hex')
}

/** Lê só o `reason` do erro do Google (formato antigo `errors[]` e novo `details[]`). O corpo não é guardado. */
async function motivoDoErro(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as {
      error?: { errors?: Array<{ reason?: string }>; details?: Array<{ reason?: string }> }
    }
    return body.error?.errors?.find(e => e.reason)?.reason ?? body.error?.details?.find(d => d.reason)?.reason ?? null
  } catch {
    return null
  }
}

export function classificarErro(e: unknown): 'api_nao_ativada' | 'sem_acesso' | 'nao_encontrado' | 'outro' {
  if (!(e instanceof ReportingHttpError)) return 'outro'
  if (e.status === 403 && (e.reason === 'accessNotConfigured' || e.reason === 'SERVICE_DISABLED')) return 'api_nao_ativada'
  if (e.status === 401) return 'sem_acesso'
  if (e.status === 403 && (e.reason === 'insufficientPermissions' || e.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT')) return 'sem_acesso'
  if (e.status === 404) return 'nao_encontrado'
  return 'outro'
}

export function criarReportingClient(accessToken: string, f: typeof fetch): ReportingClient {
  const headers = { Authorization: `Bearer ${accessToken}` }

  async function pedir<T>(url: URL, init?: RequestInit): Promise<T> {
    const res = await f(url.toString(), { ...init, headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) } })
    if (!res.ok) throw new ReportingHttpError(res.status, await motivoDoErro(res))
    return (await res.json()) as T
  }

  async function paginar<T>(caminho: string, chave: string): Promise<T[]> {
    const todos: T[] = []
    let pageToken: string | undefined
    for (let i = 0; i < MAX_PAGINAS; i++) {
      const url = new URL(`${REPORTING_BASE}/${caminho}`)
      if (pageToken) url.searchParams.set('pageToken', pageToken)
      const body = await pedir<Record<string, unknown>>(url)
      todos.push(...((body[chave] as T[] | undefined) ?? []))
      pageToken = typeof body.nextPageToken === 'string' && body.nextPageToken ? body.nextPageToken : undefined
      if (!pageToken) break
    }
    return todos
  }

  return {
    reportTypesList: () => paginar<ReportType>('reportTypes', 'reportTypes'),

    jobsList: () => paginar<Job>('jobs', 'jobs'),

    jobsCreate: ({ reportTypeId, name }) =>
      pedir<Job>(new URL(`${REPORTING_BASE}/jobs`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportTypeId, name }),
      }),

    async reportsList(jobId, o = {}) {
      const url = new URL(`${REPORTING_BASE}/jobs/${encodeURIComponent(jobId)}/reports`)
      if (o.createdAfter) url.searchParams.set('createdAfter', o.createdAfter)
      if (o.pageToken) url.searchParams.set('pageToken', o.pageToken)
      const body = await pedir<{ reports?: Report[]; nextPageToken?: string }>(url)
      return { reports: body.reports ?? [], nextPageToken: body.nextPageToken ? body.nextPageToken : null }
    },

    async download(downloadUrl) {
      const res = await f(downloadUrl, { headers: { ...headers, 'Accept-Encoding': 'gzip' } })
      if (!res.ok) throw new ReportingHttpError(res.status, await motivoDoErro(res))
      return empacotarCsv(Buffer.from(await res.arrayBuffer()))
    },
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/reporting-client.test.ts`
Expected: PASS (15 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/reporting/types.ts apps/web/src/lib/youtube/reporting/client.ts apps/web/test/youtube/coleta/reporting-client.test.ts
git commit -m "feat: cliente da YouTube Reporting API e os tipos de relatório habilitados" -- apps/web/src/lib/youtube/reporting/types.ts apps/web/src/lib/youtube/reporting/client.ts apps/web/test/youtube/coleta/reporting-client.test.ts
```

---

### Task 9: Passo de metadados

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/meta-step.ts`
- Test: `apps/web/test/youtube/coleta/meta-step.test.ts`

**Interfaces:**
- Consumes:
  - Task 3: `StepCtx`, `StepResumo`; `emParalelo`, `fetchComPrazo`, `comPrazo`, `restante`, `PARALELO`; `conferirBanco`, `pushUnico`.
  - Task 4: `ontemPt`, `boundsAnalytics`, `boundsReporting`, `addDays`, `diffDias`, `utcDay`.
  - Task 5: `calcularAbDoDia`, `AbTest`, `AbCycle`, `AbDia`.
  - Task 6: `registrarTentativa`, `contarPorResultado`; helper de teste `fakeSupabase`.
  - Do projeto (`apps/web/src/lib/youtube/thumb-fingerprint.ts`): `probeThumb(youtubeId: string, prev: ThumbPrev | null, f?: typeof fetch): Promise<ThumbProbe>` com `ThumbProbe { etag; lastModified; dhash: string | null; bytes: Buffer | null; url }` (devolve `dhash: null` SEM lançar quando o HEAD ou o GET não são ok); `archiveThumb(videoUuid: string, probe: ThumbProbe): Promise<string | null>`; `hamming(a, b): number`; `DHASH_MAX_SAME = 6`. `describeCronCause(err): string` de `@/lib/cron/failure-note`.
- Produces: `interface MetaResumo extends StepResumo { day_pt: string; dias_sem_meta: Record<string, number> }` e `passoMetadados(ctx: StepCtx): Promise<MetaResumo>`. Nunca lança por falha de um vídeo.

**Comportamento (spec, seção 3, recortado para L1a).**
- Roda para todo vídeo de todo canal de `ctx.channels`, independente de `sync_enabled` e de conexão. Não usa token: `privacy_status` e `is_short` ficam nulos.
- `day_pt` = ontem em `America/Los_Angeles`. Só vídeos com `published_at` anterior ao fim do dia.
- Título, descrição, tags e duração vêm de `youtube_videos`. `description_text` e `tags` só entram no upsert no primeiro dia ou quando o hash difere da linha de maior `day_pt` estritamente menor; fora isso a chave é omitida do payload (o upsert não apaga o que já existe). O mesmo vale para `thumbnail_blob_url` quando não há URL.
- Thumbnail: `probeThumb(id, null, fetchComPrazo(deadline))`. Exceção, `dhash`/`bytes` nulos ou `archiveThumb` devolvendo nulo → tentativa `thumbnail` `erro_http`, campos de thumbnail nulos, `thumbnail_blob_url` repetindo a última. "Mudou" = sem linha anterior, ou sem dHash/URL anterior, ou `hamming(anterior, atual) > DHASH_MAX_SAME`; só então arquiva.
- A/B: `calcularAbDoDia`. Se `ab_tests` ou `ab_test_cycles` não puderem ser lidos, é falha crítica e a linha é gravada com `title`, `thumbnail_sha256` e os campos de A/B nulos (a captura não se perde; o que valeu para o dia fica "não sei").
- Ordem: quem tem a linha anterior mais antiga primeiro (nunca coletado primeiro). Sem tempo: tentativa `meta` `nao_alcancado_orcamento` por vídeo; com o passo recebendo 0 s, também uma por canal.
- Critérios (seção 9): `dias_sem_meta` por canal, calculado antes de gravar; menos vídeos com linha no dia do que os devidos; thumbnail falhando em metade ou mais dos vídeos por 2 dias (em L1a todos os vídeos contam: a exclusão de privados depende de `videos.list`, que é L1b).

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/test/youtube/coleta/meta-step.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'node:crypto'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/thumb-fingerprint', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/thumb-fingerprint')>()),
  probeThumb: vi.fn(),
  archiveThumb: vi.fn(),
}))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(),
}))

import { passoMetadados } from '@/lib/youtube/coleta/meta-step'
import { probeThumb, archiveThumb } from '@/lib/youtube/thumb-fingerprint'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import type { StepCtx } from '@/lib/youtube/coleta/types'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'

// Cron às 12:00 UTC de 07/10/2026 → o dia fechado do Pacífico é 06/10/2026 (07:00Z de 06/10 a 07:00Z de 07/10).
const AGORA = new Date('2026-10-07T12:00:00.000Z')
const DIA = '2026-10-06'
const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex')
const BYTES = Buffer.from('imagem')

const canal = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true }
const video = (n: number, extra: Row = {}): Row => ({
  id: `v-${n}`, youtube_video_id: `yt-${n}`, channel_id: 'ch-1', site_id: 'site-1',
  title: `Título ${n}`, description: `Descrição ${n}`, tags: ['a', 'b'], duration_seconds: 600,
  published_at: '2026-09-01T00:00:00.000Z', ...extra,
})
const anterior = (n: number, extra: Row = {}): Row => ({
  youtube_video_id: `yt-${n}`, day_pt: '2026-10-05', channel_id: 'ch-1', site_id: 'site-1',
  description_sha256: sha(`Descrição ${n}`), tags_sha256: sha(JSON.stringify(['a', 'b'])),
  thumbnail_dhash: 'ffffffffffffffff', thumbnail_blob_url: 'https://blob.test/antiga.jpg', ...extra,
})
const probe = (dhash: string | null, bytes: Buffer | null = BYTES) => ({ etag: null, lastModified: null, dhash, bytes, url: 'u' })
const ctxDe = (db: FakeDb, prazoMs = 30_000): StepCtx => ({
  supabase: db.client, channels: [canal], deadline: Date.now() + prazoMs, falhas: [], tentativas: [],
})
const linha = (db: FakeDb, yt: string, dia = DIA) => db.tables.yt_own_video_meta_daily?.find(r => r.youtube_video_id === yt && r.day_pt === dia)
const tentativa = (db: FakeDb, yt: string, kind: string) => db.tables.yt_own_collection_attempts?.find(r => r.scope_id === yt && r.kind === kind)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
  vi.mocked(probeThumb).mockResolvedValue(probe('ffffffffffffffff'))
  vi.mocked(archiveThumb).mockResolvedValue('https://blob.test/nova.jpg')
})
afterEach(() => {
  vi.useRealTimers()
})

describe('passoMetadados: a linha do dia', () => {
  it('grava uma linha por vídeo no dia fechado, sem token, com is_short e privacy_status nulos', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1), video(2)] })
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo).toMatchObject({ gravados: 2, pendentes: 0, day_pt: DIA, dias_sem_meta: { 'ch-1': 0 } })
    expect(resumo.tentativas).toEqual({ ok: 4 })
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(linha(db, 'yt-1')).toMatchObject({
      site_id: 'site-1', video_id: 'v-1', channel_id: 'ch-1', day_pt: DIA,
      title: 'Título 1', title_at_capture: 'Título 1', duration_seconds: 600,
      is_short: null, privacy_status: null,
      description_sha256: sha('Descrição 1'), description_text: 'Descrição 1',
      tags_sha256: sha(JSON.stringify(['a', 'b'])), tags: ['a', 'b'],
      thumbnail_dhash: 'ffffffffffffffff', thumbnail_sha256_at_capture: sha(BYTES), thumbnail_sha256: sha(BYTES),
      thumbnail_blob_url: 'https://blob.test/nova.jpg',
      ab_test_id: null, ab_variant_id: null, seconds_on_air_analytics: null, seconds_other_reporting: null,
      captured_at: AGORA.toISOString(),
    })
    expect(tentativa(db, 'yt-1', 'meta')).toMatchObject({ outcome: 'ok', scope_type: 'video', channel_id: 'ch-1' })
    expect(tentativa(db, 'yt-1', 'thumbnail')).toMatchObject({ outcome: 'ok' })
    expect(ctx.falhas).toEqual([])
  })

  it('canal com sync desligado também é coberto; vídeo publicado depois do fim do dia fica de fora', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1), video(2, { published_at: '2026-10-07T08:00:00.000Z' })] })
    const ctx = { ...ctxDe(db), channels: [{ ...canal, sync_enabled: false }] }
    const resumo = await passoMetadados(ctx)
    expect(resumo.gravados).toBe(1)
    expect(linha(db, 'yt-2')).toBeUndefined()
    expect(ctx.falhas).toEqual([])
  })

  it('o probe recebe um fetch próprio (o do prazo do passo), nunca o estado anterior', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)] })
    await passoMetadados(ctxDe(db))
    const [id, prev, f] = vi.mocked(probeThumb).mock.calls[0]!
    expect(id).toBe('yt-1')
    expect(prev).toBeNull()
    expect(typeof f).toBe('function')
  })
})

describe('passoMetadados: thumbnail', () => {
  it('probeThumb devolve dhash nulo sem lançar: linha gravada com campos de thumbnail nulos, URL repetida e tentativa erro_http', async () => {
    vi.mocked(probeThumb).mockResolvedValue(probe(null, null))
    const db = fakeSupabase({ youtube_videos: [video(1)], yt_own_video_meta_daily: [anterior(1)] })
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.gravados).toBe(1)
    expect(linha(db, 'yt-1')).toMatchObject({
      thumbnail_dhash: null, thumbnail_sha256_at_capture: null, thumbnail_sha256: null,
      thumbnail_blob_url: 'https://blob.test/antiga.jpg', title: 'Título 1',
    })
    expect(tentativa(db, 'yt-1', 'thumbnail')).toMatchObject({ outcome: 'erro_http', http_status: null })
    expect(tentativa(db, 'yt-1', 'meta')).toMatchObject({ outcome: 'ok' })
    expect(archiveThumb).not.toHaveBeenCalled()
  })

  it('probeThumb lança (timeout): mesma coisa, sem derrubar o passo', async () => {
    vi.mocked(probeThumb).mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
    const db = fakeSupabase({ youtube_videos: [video(1), video(2)] })
    const resumo = await passoMetadados(ctxDe(db))
    expect(resumo.gravados).toBe(2)
    expect(linha(db, 'yt-1')).toMatchObject({ thumbnail_dhash: null, thumbnail_sha256: null })
    expect(linha(db, 'yt-1')!.thumbnail_blob_url).toBeUndefined()
    expect(tentativa(db, 'yt-1', 'thumbnail')).toMatchObject({ outcome: 'erro_http', error: 'request timed out' })
  })

  it('archiveThumb devolve nulo: campos de thumbnail nulos e tentativa erro_http (amanhã tenta arquivar de novo)', async () => {
    vi.mocked(archiveThumb).mockResolvedValue(null)
    const db = fakeSupabase({ youtube_videos: [video(1)] })
    await passoMetadados(ctxDe(db))
    expect(linha(db, 'yt-1')).toMatchObject({ thumbnail_dhash: null, thumbnail_sha256_at_capture: null })
    expect(tentativa(db, 'yt-1', 'thumbnail')).toMatchObject({ outcome: 'erro_http' })
  })

  it('imagem igual à última (distância ≤ 6): não arquiva e repete a URL', async () => {
    vi.mocked(probeThumb).mockResolvedValue(probe('fffffffffffffffe'))
    const db = fakeSupabase({ youtube_videos: [video(1)], yt_own_video_meta_daily: [anterior(1)] })
    await passoMetadados(ctxDe(db))
    expect(archiveThumb).not.toHaveBeenCalled()
    expect(linha(db, 'yt-1')).toMatchObject({ thumbnail_dhash: 'fffffffffffffffe', thumbnail_blob_url: 'https://blob.test/antiga.jpg' })
  })

  it('imagem diferente (distância > 6): arquiva e grava a URL nova', async () => {
    vi.mocked(probeThumb).mockResolvedValue(probe('0000000000000000'))
    const db = fakeSupabase({ youtube_videos: [video(1)], yt_own_video_meta_daily: [anterior(1)] })
    await passoMetadados(ctxDe(db))
    expect(archiveThumb).toHaveBeenCalledTimes(1)
    expect(vi.mocked(archiveThumb).mock.calls[0]![0]).toBe('v-1')
    expect(linha(db, 'yt-1')).toMatchObject({ thumbnail_blob_url: 'https://blob.test/nova.jpg' })
  })

  it('a linha anterior falhou a thumbnail (dhash nulo): hoje arquiva de novo', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)], yt_own_video_meta_daily: [anterior(1, { thumbnail_dhash: null })] })
    await passoMetadados(ctxDe(db))
    expect(archiveThumb).toHaveBeenCalledTimes(1)
  })
})

describe('passoMetadados: descrição e tags', () => {
  it('descrição e tags que não mudaram: os hashes são gravados, o texto fica de fora', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)], yt_own_video_meta_daily: [anterior(1)] })
    await passoMetadados(ctxDe(db))
    const l = linha(db, 'yt-1')!
    expect(l.description_sha256).toBe(sha('Descrição 1'))
    expect(l.description_text).toBeUndefined()
    expect(l.tags).toBeUndefined()
  })

  it('descrição que mudou: o texto novo é gravado', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1, { description: 'Nova' })], yt_own_video_meta_daily: [anterior(1)] })
    await passoMetadados(ctxDe(db))
    expect(linha(db, 'yt-1')).toMatchObject({ description_text: 'Nova', description_sha256: sha('Nova') })
  })

  it('segunda execução no mesmo dia mantém o description_text e a URL já gravados', async () => {
    const jaGravada = { ...anterior(1), day_pt: DIA, description_text: 'texto de hoje cedo', tags: ['x'], thumbnail_blob_url: 'https://blob.test/hoje.jpg' }
    vi.mocked(probeThumb).mockResolvedValue(probe(null, null))
    const db = fakeSupabase({ youtube_videos: [video(1)], yt_own_video_meta_daily: [anterior(1, { thumbnail_blob_url: null }), jaGravada] })
    await passoMetadados(ctxDe(db))
    expect(db.tables.yt_own_video_meta_daily).toHaveLength(2)
    expect(linha(db, 'yt-1')).toMatchObject({ description_text: 'texto de hoje cedo', tags: ['x'], thumbnail_blob_url: 'https://blob.test/hoje.jpg' })
  })

  it('"último gravado" é a linha de maior day_pt estritamente menor que o dia', async () => {
    const db = fakeSupabase({
      youtube_videos: [video(1)],
      yt_own_video_meta_daily: [
        anterior(1, { day_pt: '2026-10-01', description_sha256: 'velho' }),
        anterior(1, { day_pt: '2026-10-05' }),
      ],
    })
    await passoMetadados(ctxDe(db))
    expect(linha(db, 'yt-1')!.description_text).toBeUndefined()
  })
})

describe('passoMetadados: teste A/B', () => {
  const testeAtivo = { id: 't1', youtube_video_id: 'v-1', status: 'active', paused_at: null, completed_at: null, original_title: 'Original' }
  const cicloAberto = { id: 'c1', test_id: 't1', variant_id: 'var-a', started_at: '2026-09-20T00:00:00.000Z', ended_at: null, applied_metadata: null }

  it('teste só de thumbnail no ar o dia inteiro: variante gravada, title é o original, thumbnail copia a captura', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1), video(2)], ab_tests: [testeAtivo], ab_test_cycles: [cicloAberto] })
    await passoMetadados(ctxDe(db))
    expect(linha(db, 'yt-1')).toMatchObject({
      ab_test_id: 't1', ab_variant_id: 'var-a', title: 'Original', title_at_capture: 'Título 1',
      seconds_on_air_analytics: 86_400, seconds_other_analytics: 0,
      seconds_on_air_reporting: 86_400, seconds_other_reporting: 0,
      thumbnail_sha256: sha(BYTES),
    })
    expect(linha(db, 'yt-2')).toMatchObject({ ab_test_id: null, title: 'Título 2' })
  })

  it('pausa e retomada no mesmo dia: ab_test_id fica, variante, título e thumbnail do dia ficam nulos', async () => {
    const retomado = { ...cicloAberto, id: 'c2', variant_id: 'var-b', started_at: '2026-10-06T15:00:00.000Z' }
    const db = fakeSupabase({ youtube_videos: [video(1)], ab_tests: [testeAtivo], ab_test_cycles: [cicloAberto, retomado] })
    await passoMetadados(ctxDe(db))
    expect(linha(db, 'yt-1')).toMatchObject({
      ab_test_id: 't1', ab_variant_id: null, title: null, thumbnail_sha256: null,
      title_at_capture: 'Título 1', thumbnail_sha256_at_capture: sha(BYTES),
    })
  })

  it('ab_tests ilegível: falha crítica, e a linha sai com a captura e o "valeu para o dia" nulo', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)] })
    db.errors.ab_tests = { code: '57014', message: 'statement timeout' }
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.gravados).toBe(1)
    expect(ctx.falhas).toContain('erro de banco ao ler ab_tests')
    expect(linha(db, 'yt-1')).toMatchObject({ title: null, thumbnail_sha256: null, title_at_capture: 'Título 1', thumbnail_sha256_at_capture: sha(BYTES) })
  })
})

describe('passoMetadados: critérios e orçamento', () => {
  it('dias_sem_meta no primeiro dia é 0 e não entra em falhas', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)] })
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.dias_sem_meta).toEqual({ 'ch-1': 0 })
    expect(ctx.falhas).toEqual([])
  })

  it('última linha do canal em 03/10 e hoje gravando 06/10: dias_sem_meta = 2, uma falha', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)], yt_own_video_meta_daily: [anterior(1, { day_pt: '2026-10-03' })] })
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.dias_sem_meta).toEqual({ 'ch-1': 2 })
    expect(ctx.falhas).toEqual(['metadados: Canal Um ficou 2 dia(s) sem linha antes de 2026-10-06'])
  })

  it('escrita recusada: falha de banco e o critério "menos linhas que vídeos"', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1), video(2)] })
    db.writeErrors.yt_own_video_meta_daily = { code: '23514', message: 'check violation' }
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.gravados).toBe(0)
    expect(ctx.falhas).toEqual([
      'erro de banco ao gravar yt_own_video_meta_daily',
      'metadados: Canal Um tem 0 de 2 vídeos com linha em 2026-10-06',
    ])
    expect(tentativa(db, 'yt-1', 'meta')).toMatchObject({ outcome: 'erro_http', error: 'erro de banco' })
  })

  it('tabela ausente em produção (42P01): schema_ausente em falhas, tentativa por canal, sem lançar', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1)] })
    db.errors.yt_own_video_meta_daily = { code: '42P01', message: 'relation "yt_own_video_meta_daily" does not exist' }
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.gravados).toBe(0)
    expect(ctx.falhas).toEqual(['schema_ausente: yt_own_video_meta_daily'])
    expect(db.tables.yt_own_collection_attempts).toEqual([expect.objectContaining({ scope_type: 'canal', scope_id: 'ch-1', kind: 'meta', outcome: 'schema_ausente' })])
    expect(probeThumb).not.toHaveBeenCalled()
  })

  it('thumbnail falhando em metade ou mais dos vídeos pelo segundo dia: falha crítica', async () => {
    vi.mocked(probeThumb).mockResolvedValue(probe(null, null))
    const ontemUtc = (yt: string): Row => ({ scope_type: 'video', scope_id: yt, kind: 'thumbnail', attempt_day: '2026-10-06', channel_id: 'ch-1', site_id: 'site-1', outcome: 'erro_http', attempts: 1 })
    const db = fakeSupabase({ youtube_videos: [video(1), video(2)], yt_own_collection_attempts: [ontemUtc('yt-1'), ontemUtc('yt-2')] })
    const ctx = ctxDe(db)
    await passoMetadados(ctx)
    expect(ctx.falhas).toEqual(['metadados: thumbnail falhou em metade ou mais dos vídeos de Canal Um por 2 dias'])
  })

  it('thumbnail falhando só hoje: ainda não é falha crítica', async () => {
    vi.mocked(probeThumb).mockResolvedValue(probe(null, null))
    const db = fakeSupabase({ youtube_videos: [video(1), video(2)] })
    const ctx = ctxDe(db)
    await passoMetadados(ctx)
    expect(ctx.falhas).toEqual([])
  })

  it('passo que recebe 0 s: nao_alcancado_orcamento por canal e por vídeo, pendentes = vídeos, nenhuma linha', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1), video(2)] })
    const ctx = ctxDe(db, -1)
    const resumo = await passoMetadados(ctx)
    expect(resumo).toMatchObject({ gravados: 0, pendentes: 2 })
    expect(resumo.tentativas).toEqual({ nao_alcancado_orcamento: 3 })
    expect(db.tables.yt_own_video_meta_daily ?? []).toEqual([])
    expect(db.tables.yt_own_collection_attempts!.map(r => `${r.scope_type}:${r.scope_id}`).sort()).toEqual(['canal:ch-1', 'video:yt-1', 'video:yt-2'])
    expect(probeThumb).not.toHaveBeenCalled()
    expect(ctx.falhas).toEqual([])
  })

  it('quem nunca foi coletado vem primeiro', async () => {
    const db = fakeSupabase({ youtube_videos: [video(1), video(2), video(3)], yt_own_video_meta_daily: [anterior(1), anterior(3, { day_pt: '2026-10-02' })] })
    await passoMetadados({ ...ctxDe(db), channels: [canal] })
    const ordem = vi.mocked(probeThumb).mock.calls.map(c => c[0])
    expect(ordem.indexOf('yt-2')).toBeLessThan(ordem.indexOf('yt-3'))
    expect(ordem.indexOf('yt-3')).toBeLessThan(ordem.indexOf('yt-1'))
  })

  it('canal sem vídeos fica fora dos critérios por vídeo', async () => {
    const db = fakeSupabase({ youtube_videos: [] })
    const ctx = ctxDe(db)
    const resumo = await passoMetadados(ctx)
    expect(resumo.gravados).toBe(0)
    expect(ctx.falhas).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/meta-step.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/youtube/coleta/meta-step"`.

- [ ] **Step 3: Implementar**

Create `apps/web/src/lib/youtube/coleta/meta-step.ts`:

```ts
// Passo de metadados (spec, seção 3) — recorte do lote L1a: sem privacy_status e sem is_short.
// Grava o DIA FECHADO (ontem no Pacífico) para todo vídeo de todo canal. O que estava no ar em
// cada dia não volta: por isso o passo nunca desiste de gravar a linha por causa da thumbnail.
import * as Sentry from '@sentry/nextjs'
import { createHash } from 'node:crypto'
import { describeCronCause } from '@/lib/cron/failure-note'
import { archiveThumb, DHASH_MAX_SAME, hamming, probeThumb, type ThumbProbe } from '@/lib/youtube/thumb-fingerprint'
import { calcularAbDoDia, type AbCycle, type AbDia, type AbTest } from './ab-seconds'
import { contarPorResultado, registrarTentativa } from './attempts'
import { comPrazo, emParalelo, fetchComPrazo, PARALELO, restante } from './clock'
import { addDays, boundsAnalytics, boundsReporting, diffDias, ontemPt, utcDay } from './day-pt'
import { conferirBanco, pushUnico } from './schema'
import type { StepCtx, StepResumo } from './types'

export interface MetaResumo extends StepResumo {
  day_pt: string
  /** Por `youtube_channels.id`: dias entre a última linha gravada e o dia em gravação. */
  dias_sem_meta: Record<string, number>
}

interface VideoRow {
  id: string
  youtube_video_id: string
  channel_id: string
  site_id: string
  title: string | null
  description: string | null
  tags: string[] | null
  duration_seconds: number | null
  published_at: string
}

/** A linha de maior day_pt estritamente menor que o dia em gravação. */
interface Anterior {
  day_pt: string
  description_sha256: string | null
  tags_sha256: string | null
  thumbnail_dhash: string | null
  thumbnail_blob_url: string | null
}

interface ThumbCaptura {
  ok: boolean
  motivo: string | null
  dhash: string | null
  sha256: string | null
  blobUrl: string | null
}

/** O PostgREST corta em 1000 linhas: bater nesse número é sinal de leitura truncada. */
const LIMITE_LEITURA = 1000

/** Quando ab_tests/ab_test_cycles não puderam ser lidos: a captura é gravada, o "valeu para o dia" fica nulo. */
const AB_ILEGIVEL: AbDia = {
  ab_test_id: null, ab_variant_id: null,
  seconds_on_air_analytics: null, seconds_other_analytics: null,
  seconds_on_air_reporting: null, seconds_other_reporting: null,
  title: null, thumbCopiaCaptura: false, motivoNulo: null,
}

const sha256 = (v: string | Buffer): string => createHash('sha256').update(v).digest('hex')
const somar = (m: Map<string, number>, k: string): void => { m.set(k, (m.get(k) ?? 0) + 1) }

async function carregarAb(
  ctx: StepCtx,
  videos: VideoRow[],
  inicioMs: number,
): Promise<{ ok: boolean; testes: Map<string, AbTest[]>; ciclos: AbCycle[] }> {
  const vazio = { ok: true, testes: new Map<string, AbTest[]>(), ciclos: [] as AbCycle[] }
  if (videos.length === 0) return vazio
  const t = await ctx.supabase
    .from('ab_tests')
    .select('id, youtube_video_id, status, paused_at, completed_at, original_title')
    .in('youtube_video_id', videos.map(v => v.id))
  if (conferirBanco(t, 'ab_tests', ctx.falhas, 'ler') !== 'ok') return { ...vazio, ok: false }
  const linhas = (t.data ?? []) as Array<AbTest & { youtube_video_id: string }>
  if (linhas.length === 0) return vazio
  // Abertos, ou terminados depois do começo do dia. Sem limite superior: a retomada e a rotação
  // posteriores ao dia entram, porque decidem as regras de nulo e a variante no ar na captura.
  const c = await ctx.supabase
    .from('ab_test_cycles')
    .select('id, test_id, variant_id, started_at, ended_at, applied_metadata')
    .in('test_id', linhas.map(x => x.id))
    .or(`ended_at.is.null,ended_at.gt."${new Date(inicioMs).toISOString()}"`)
  if (conferirBanco(c, 'ab_test_cycles', ctx.falhas, 'ler') !== 'ok') return { ...vazio, ok: false }
  const testes = new Map<string, AbTest[]>()
  for (const l of linhas) testes.set(l.youtube_video_id, [...(testes.get(l.youtube_video_id) ?? []), l])
  return { ok: true, testes, ciclos: (c.data ?? []) as AbCycle[] }
}

/** Exceção, dhash nulo ou arquivamento nulo: campos de thumbnail nulos e a URL repete a última. */
async function capturarThumb(ctx: StepCtx, v: VideoRow, ant: Anterior | null, f: typeof fetch): Promise<ThumbCaptura> {
  const repetida = ant?.thumbnail_blob_url ?? null
  const falha = (motivo: string): ThumbCaptura => ({ ok: false, motivo, dhash: null, sha256: null, blobUrl: repetida })
  let probe: ThumbProbe
  try {
    probe = await probeThumb(v.youtube_video_id, null, f)
  } catch (e) {
    return falha(describeCronCause(e))
  }
  if (!probe.dhash || !probe.bytes) return falha('a thumbnail não baixou')
  const mudou = !ant?.thumbnail_dhash || !repetida || hamming(ant.thumbnail_dhash, probe.dhash) > DHASH_MAX_SAME
  let blobUrl = repetida
  if (mudou) {
    try {
      blobUrl = await comPrazo(archiveThumb(v.id, probe), ctx.deadline)
    } catch {
      blobUrl = null
    }
    if (!blobUrl) return falha('o arquivamento da thumbnail falhou')
  }
  return { ok: true, motivo: null, dhash: probe.dhash, sha256: sha256(probe.bytes), blobUrl }
}

export async function passoMetadados(ctx: StepCtx): Promise<MetaResumo> {
  const agora = new Date()
  const day = ontemPt(agora)
  const A = boundsAnalytics(day)
  const R = boundsReporting(day)
  const resumo: MetaResumo = { gravados: 0, tentativas: {}, pendentes: 0, day_pt: day, dias_sem_meta: {} }
  const fechar = (): MetaResumo => {
    resumo.tentativas = contarPorResultado(ctx.tentativas, ['meta', 'thumbnail'])
    return resumo
  }
  const canais = ctx.channels
  if (canais.length === 0) return fechar()
  const canalPorId = new Map(canais.map(c => [c.id, c]))

  const lidos = await ctx.supabase
    .from('youtube_videos')
    .select('id, youtube_video_id, channel_id, site_id, title, description, tags, duration_seconds, published_at')
    .in('channel_id', canais.map(c => c.id))
    .lt('published_at', new Date(A.end).toISOString())
  if (conferirBanco(lidos, 'youtube_videos', ctx.falhas, 'ler') !== 'ok') return fechar()
  const videos = (lidos.data ?? []) as VideoRow[]
  if (videos.length >= LIMITE_LEITURA) {
    pushUnico(ctx.falhas, `metadados: ${videos.length} vídeos lidos — a leitura pode estar truncada em ${LIMITE_LEITURA}`)
  }

  // Passo que recebe 0 s: uma tentativa por canal e uma por vídeo, para o critério reconhecer.
  if (restante(ctx.deadline) <= 0) {
    for (const c of canais) {
      await registrarTentativa(ctx, { site_id: c.site_id, scope_type: 'canal', scope_id: c.id, kind: 'meta', outcome: 'nao_alcancado_orcamento', channel_id: c.id })
    }
    for (const v of videos) {
      await registrarTentativa(ctx, { site_id: v.site_id, scope_type: 'video', scope_id: v.youtube_video_id, kind: 'meta', outcome: 'nao_alcancado_orcamento', channel_id: v.channel_id })
    }
    resumo.pendentes = videos.length
    return fechar()
  }

  // dias_sem_meta: por canal, ANTES de gravar o dia. Sem linha anterior vale 0.
  for (const c of canais) {
    const ult = await ctx.supabase
      .from('yt_own_video_meta_daily')
      .select('day_pt')
      .eq('channel_id', c.id)
      .lt('day_pt', day)
      .order('day_pt', { ascending: false })
      .limit(1)
      .maybeSingle()
    const leitura = conferirBanco(ult, 'yt_own_video_meta_daily', ctx.falhas, 'ler')
    if (leitura === 'schema_ausente') {
      for (const x of canais) {
        await registrarTentativa(ctx, { site_id: x.site_id, scope_type: 'canal', scope_id: x.id, kind: 'meta', outcome: 'schema_ausente', channel_id: x.id })
      }
      return fechar()
    }
    const ultimo = leitura === 'ok' ? ((ult.data as { day_pt: string } | null)?.day_pt ?? null) : null
    const dias = ultimo ? Math.max(0, diffDias(ultimo, day) - 1) : 0
    resumo.dias_sem_meta[c.id] = dias
    if (dias > 0) pushUnico(ctx.falhas, `metadados: ${c.name} ficou ${dias} dia(s) sem linha antes de ${day}`)
  }

  // Linha anterior de cada vídeo: decide a ordem, o que mudou e a URL a repetir.
  const anteriores = new Map<string, Anterior | null>()
  await emParalelo(videos, PARALELO, async (v) => {
    const r = await ctx.supabase
      .from('yt_own_video_meta_daily')
      .select('day_pt, description_sha256, tags_sha256, thumbnail_dhash, thumbnail_blob_url')
      .eq('youtube_video_id', v.youtube_video_id)
      .lt('day_pt', day)
      .order('day_pt', { ascending: false })
      .limit(1)
      .maybeSingle()
    const ok = conferirBanco(r, 'yt_own_video_meta_daily', ctx.falhas, 'ler') === 'ok'
    anteriores.set(v.youtube_video_id, ok ? ((r.data as Anterior | null) ?? null) : null)
  })

  const ab = await carregarAb(ctx, videos, Math.min(A.start, R.start))

  const fila = [...videos].sort((a, b) =>
    (anteriores.get(a.youtube_video_id)?.day_pt ?? '').localeCompare(anteriores.get(b.youtube_video_id)?.day_pt ?? ''))
  const f = fetchComPrazo(ctx.deadline)
  const gravadosPorCanal = new Map<string, number>()
  const naoAlcancados = new Map<string, number>()
  const thumbFalhas = new Map<string, number>()
  const capturedAt = agora.toISOString()

  await emParalelo(fila, PARALELO, async (v) => {
    const base = { site_id: v.site_id, scope_type: 'video' as const, scope_id: v.youtube_video_id, channel_id: v.channel_id }
    try {
      if (restante(ctx.deadline) <= 0) {
        await registrarTentativa(ctx, { ...base, kind: 'meta', outcome: 'nao_alcancado_orcamento' })
        somar(naoAlcancados, v.channel_id)
        resumo.pendentes++
        return
      }
      const ant = anteriores.get(v.youtube_video_id) ?? null

      const thumb = await capturarThumb(ctx, v, ant, f)
      await registrarTentativa(ctx, { ...base, kind: 'thumbnail', outcome: thumb.ok ? 'ok' : 'erro_http', error: thumb.motivo })
      if (!thumb.ok) somar(thumbFalhas, v.channel_id)

      const testes = ab.testes.get(v.id) ?? []
      const idsDosTestes = new Set(testes.map(t => t.id))
      const abDia = ab.ok
        ? calcularAbDoDia({
            day,
            tests: testes,
            cycles: ab.ciclos.filter(c => idsDosTestes.has(c.test_id)),
            capturedAt: agora.getTime(),
            titleAtCapture: v.title,
          })
        : AB_ILEGIVEL

      const descHash = sha256(v.description ?? '')
      const tagsHash = sha256(JSON.stringify(v.tags ?? []))
      const linha: Record<string, unknown> = {
        site_id: v.site_id,
        youtube_video_id: v.youtube_video_id,
        day_pt: day,
        video_id: v.id,
        channel_id: v.channel_id,
        title: abDia.title,
        thumbnail_sha256: abDia.thumbCopiaCaptura ? thumb.sha256 : null,
        thumbnail_dhash: thumb.dhash,
        thumbnail_sha256_at_capture: thumb.sha256,
        title_at_capture: v.title,
        description_sha256: descHash,
        tags_sha256: tagsHash,
        duration_seconds: v.duration_seconds,
        is_short: null,
        privacy_status: null,
        ab_test_id: abDia.ab_test_id,
        ab_variant_id: abDia.ab_variant_id,
        seconds_on_air_analytics: abDia.seconds_on_air_analytics,
        seconds_other_analytics: abDia.seconds_other_analytics,
        seconds_on_air_reporting: abDia.seconds_on_air_reporting,
        seconds_other_reporting: abDia.seconds_other_reporting,
        captured_at: capturedAt,
      }
      // Estas três chaves nunca passam de não nulo a nulo: quando não há valor, ficam fora do payload.
      if (!ant || ant.description_sha256 !== descHash) linha.description_text = v.description ?? ''
      if (!ant || ant.tags_sha256 !== tagsHash) linha.tags = v.tags ?? []
      if (thumb.blobUrl) linha.thumbnail_blob_url = thumb.blobUrl

      const up = await ctx.supabase.from('yt_own_video_meta_daily').upsert(linha, { onConflict: 'youtube_video_id,day_pt' })
      const escrita = conferirBanco(up, 'yt_own_video_meta_daily', ctx.falhas)
      await registrarTentativa(ctx, {
        ...base,
        kind: 'meta',
        outcome: escrita === 'ok' ? 'ok' : escrita === 'schema_ausente' ? 'schema_ausente' : 'erro_http',
        error: escrita === 'ok' ? null : 'erro de banco',
      })
      if (escrita === 'ok') {
        resumo.gravados++
        somar(gravadosPorCanal, v.channel_id)
      }
    } catch (e) {
      Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'metadados' }, extra: { video: v.youtube_video_id } })
      pushUnico(ctx.falhas, `metadados: ${canalPorId.get(v.channel_id)?.name ?? v.channel_id}: ${describeCronCause(e)}`)
    }
  })

  // Critérios da seção 9 que valem para este passo.
  for (const c of canais) {
    const esperados = videos.filter(v => v.channel_id === c.id).length
    if (esperados === 0) continue
    const devidos = esperados - (naoAlcancados.get(c.id) ?? 0)
    const cont = await ctx.supabase
      .from('yt_own_video_meta_daily')
      .select('youtube_video_id', { count: 'exact', head: true })
      .eq('channel_id', c.id)
      .eq('day_pt', day)
    const comLinha = cont.error ? (gravadosPorCanal.get(c.id) ?? 0) : (cont.count ?? 0)
    if (comLinha < devidos) pushUnico(ctx.falhas, `metadados: ${c.name} tem ${comLinha} de ${devidos} vídeos com linha em ${day}`)

    const falhasHoje = thumbFalhas.get(c.id) ?? 0
    if (devidos > 0 && falhasHoje * 2 >= devidos) {
      const ontem = await ctx.supabase
        .from('yt_own_collection_attempts')
        .select('outcome')
        .eq('kind', 'thumbnail')
        .eq('channel_id', c.id)
        .eq('attempt_day', addDays(utcDay(agora), -1))
      const linhas = (ontem.data ?? []) as Array<{ outcome: string }>
      const ruins = linhas.filter(l => l.outcome !== 'ok').length
      if (linhas.length > 0 && ruins * 2 >= linhas.length) {
        pushUnico(ctx.falhas, `metadados: thumbnail falhou em metade ou mais dos vídeos de ${c.name} por 2 dias`)
      }
    }
  }

  return fechar()
}
```

- [ ] **Step 4: Rodar e ver passar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/meta-step.test.ts`
Expected: PASS (25 testes).

- [ ] **Step 5: Typecheck e commit**

Run (de `apps/web`): `npx tsc --noEmit`
Expected: 0 erros.

```bash
git add apps/web/src/lib/youtube/coleta/meta-step.ts apps/web/test/youtube/coleta/meta-step.test.ts
git commit -m "feat: passo de metadados da coleta (linha por vídeo no dia fechado, thumbnail arquivada e variante de A/B)" -- apps/web/src/lib/youtube/coleta/meta-step.ts apps/web/test/youtube/coleta/meta-step.test.ts
```

---

### Task 10: Passo 1A — sondagem e jobs

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/jobs-step.ts`
- Test: `apps/web/test/youtube/coleta/jobs-step.test.ts`

**Interfaces:**
- Consumes:
  - Task 3: `StepCtx`, `StepResumo`, `ColetaChannel`; `emParalelo`, `fetchComPrazo`, `restante`, `PARALELO`; `conferirBanco`, `pushUnico`.
  - Task 6: `registrarTentativa`, `contarPorResultado`, `scopeJob`.
  - Task 7: `avisarEntrada(ctx, ch, motivo)`, `avisarSaida(ctx, ch)`.
  - Task 8: `criarReportingClient(accessToken, f): ReportingClient`, `classificarErro(e)`, `ReportingHttpError`, `REPORT_TYPES_ENABLED`, `Job`.
  - Do projeto: `ensureFreshToken(siteId: string, provider: 'youtube', accountId: string): Promise<{ accessToken: string; ... }>`, `TokenRevokedError`, `NoActiveConnectionError` de `@/lib/social/token-refresh`; `channelNote(label, cause)`, `describeCronCause(err)` de `@/lib/cron/failure-note`.
- Produces: `type JobStatus = 'ativo' | 'desativado' | 'sem_acesso' | 'api_nao_ativada' | 'tipo_indisponivel' | 'erro'`; `interface JobsResumo extends StepResumo { acao_do_dono: string[]; tipo_indisponivel: string[]; estados: Record<string, Record<string, JobStatus>> }`; `passoJobs(ctx: StepCtx): Promise<JobsResumo>`.

**Comportamento (spec, seção 4).**
- Só canais com `sync_enabled`. Canal que já tem job `ativo` para os quatro tipos habilitados não gera chamada nenhuma.
- **Simplificação de L1a:** `TokenRevokedError` ou `NoActiveConnectionError` → tentativa `sondagem` `sem_conexao`, sem aviso, sem falha crítica. Qualquer outro erro de token é falha crítica do passo.
- `reportTypes.list` e `jobs.list` em paralelo; `jobs.create` dos tipos que faltam em paralelo (até 4).
- 403 `accessNotConfigured` → `api_nao_ativada`; 401 ou 403 `insufficientPermissions` → `sem_acesso`. Os dois gravam uma linha por tipo habilitado, avisam (deduplicado), entram em `acao_do_dono` e **não** entram em `falhas[]`. São tentados de novo a cada execução.
- Qualquer outro erro da listagem → linha `erro` só para os tipos que não estão `ativo` (um erro transitório não rebaixa um job que funciona). Não é falha crítica na hora; vira falha depois de 3 dias, pelo critério da Task 12.
- `jobs.create` com 409 → `jobs.list` de novo e adota o job existente.
- Tipo habilitado ausente da lista → `tipo_indisponivel` (avisa uma vez). Tipo listado e não habilitado → `desativado`, sem chamada.
- Cada canal sondado recebe uma tentativa `sondagem` de escopo `canal`; cada tipo habilitado, uma de escopo `job`.

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/test/youtube/coleta/jobs-step.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(),
}))
vi.mock('@/lib/youtube/reporting/client', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/reporting/client')>()),
  criarReportingClient: vi.fn(),
}))
vi.mock('@/lib/youtube/coleta/alerts', () => ({ avisarEntrada: vi.fn(), avisarSaida: vi.fn() }))

import { passoJobs } from '@/lib/youtube/coleta/jobs-step'
import { ensureFreshToken, TokenRevokedError, NoActiveConnectionError } from '@/lib/social/token-refresh'
import { criarReportingClient } from '@/lib/youtube/reporting/client'
import { REPORT_TYPES_ENABLED, ReportingHttpError } from '@/lib/youtube/reporting/types'
import { avisarEntrada, avisarSaida } from '@/lib/youtube/coleta/alerts'
import type { StepCtx } from '@/lib/youtube/coleta/types'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'

const canal = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true }
const api = { reportTypesList: vi.fn(), jobsList: vi.fn(), jobsCreate: vi.fn(), reportsList: vi.fn(), download: vi.fn() }
const TIPOS = REPORT_TYPES_ENABLED.map(id => ({ id }))
const ctxDe = (db: FakeDb, prazoMs = 20_000): StepCtx => ({
  supabase: db.client, channels: [canal], deadline: Date.now() + prazoMs, falhas: [], tentativas: [],
})
const job = (db: FakeDb, tipo: string) => db.tables.yt_reporting_jobs?.find(r => r.channel_id === 'ch-1' && r.report_type_id === tipo)
const estados = (db: FakeDb) => Object.fromEntries((db.tables.yt_reporting_jobs ?? []).map(r => [r.report_type_id as string, r.status]))
const tentativaCanal = (db: FakeDb) => db.tables.yt_own_collection_attempts?.find(r => r.scope_type === 'canal' && r.kind === 'sondagem')
const linhaAtiva = (tipo: string): Row => ({ site_id: 'site-1', channel_id: 'ch-1', report_type_id: tipo, status: 'ativo', job_id: `job-${tipo}`, job_create_time: '2026-10-01T00:00:00.000Z' })

beforeEach(() => {
  vi.clearAllMocks()
  for (const m of Object.values(api)) m.mockReset()
  vi.mocked(criarReportingClient).mockReturnValue(api)
  vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' } as never)
  api.reportTypesList.mockResolvedValue(TIPOS)
  api.jobsList.mockResolvedValue([])
  api.jobsCreate.mockImplementation(async ({ reportTypeId }: { reportTypeId: string }) => ({ id: `job-${reportTypeId}`, reportTypeId, createTime: '2026-10-07T12:00:01Z' }))
})

describe('passoJobs: caminho feliz', () => {
  it('canal sem job: cria os quatro, grava ativo com job_id e job_create_time, e registra a sondagem', async () => {
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(api.jobsCreate).toHaveBeenCalledTimes(4)
    expect(estados(db)).toEqual(Object.fromEntries(REPORT_TYPES_ENABLED.map(t => [t, 'ativo'])))
    expect(job(db, 'channel_reach_basic_a1')).toMatchObject({ site_id: 'site-1', job_id: 'job-channel_reach_basic_a1', job_create_time: '2026-10-07T12:00:01Z', error: null })
    expect(resumo.gravados).toBe(4)
    expect(resumo.estados['ch-1']).toEqual(Object.fromEntries(REPORT_TYPES_ENABLED.map(t => [t, 'ativo'])))
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'ok', scope_id: 'ch-1' })
    expect(db.tables.yt_own_collection_attempts!.filter(r => r.scope_type === 'job')).toHaveLength(4)
    expect(avisarSaida).toHaveBeenCalledTimes(1)
    expect(ctx.falhas).toEqual([])
    expect(resumo.acao_do_dono).toEqual([])
  })

  it('o cliente recebe o token do canal dono', async () => {
    await passoJobs(ctxDe(fakeSupabase()))
    expect(ensureFreshToken).toHaveBeenCalledWith('site-1', 'youtube', 'UC1')
    expect(vi.mocked(criarReportingClient).mock.calls[0]![0]).toBe('tok')
  })

  it('job que já existe do lado do Google é adotado, sem jobs.create', async () => {
    api.jobsList.mockResolvedValue(REPORT_TYPES_ENABLED.map(t => ({ id: `ja-${t}`, reportTypeId: t, createTime: '2026-09-01T00:00:00Z' })))
    const db = fakeSupabase()
    await passoJobs(ctxDe(db))
    expect(api.jobsCreate).not.toHaveBeenCalled()
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'ativo', job_id: 'ja-channel_basic_a3', job_create_time: '2026-09-01T00:00:00Z' })
  })

  it('canal com os quatro jobs ativos: nenhuma chamada, nem de token', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: REPORT_TYPES_ENABLED.map(linhaAtiva) })
    const resumo = await passoJobs(ctxDe(db))
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(api.reportTypesList).not.toHaveBeenCalled()
    expect(resumo.estados['ch-1']).toEqual(Object.fromEntries(REPORT_TYPES_ENABLED.map(t => [t, 'ativo'])))
  })

  it('canal com sync desligado é ignorado', async () => {
    const db = fakeSupabase()
    await passoJobs({ ...ctxDe(db), channels: [{ ...canal, sync_enabled: false }] })
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(db.tables.yt_reporting_jobs ?? []).toEqual([])
  })

  it('jobs.create com 409: lista de novo e adota o job existente', async () => {
    api.jobsCreate.mockImplementation(async ({ reportTypeId }: { reportTypeId: string }) => {
      if (reportTypeId === 'channel_basic_a3') throw new ReportingHttpError(409, 'alreadyExists')
      return { id: `job-${reportTypeId}`, reportTypeId, createTime: '2026-10-07T12:00:01Z' }
    })
    api.jobsList.mockResolvedValueOnce([]).mockResolvedValue([{ id: 'ja-existia', reportTypeId: 'channel_basic_a3', createTime: '2026-08-01T00:00:00Z' }])
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    await passoJobs(ctx)
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'ativo', job_id: 'ja-existia' })
    expect(ctx.falhas).toEqual([])
  })
})

describe('passoJobs: tipos', () => {
  it('tipo habilitado ausente da lista: tipo_indisponivel, avisa e fica na resposta; tipo não habilitado: desativado, sem chamada', async () => {
    api.reportTypesList.mockResolvedValue([{ id: 'channel_basic_a3' }, { id: 'channel_reach_combined_a1' }, { id: 'channel_traffic_source_a3' }, { id: 'channel_demographics_a1' }])
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(job(db, 'channel_reach_basic_a1')).toMatchObject({ status: 'tipo_indisponivel' })
    expect(job(db, 'channel_reach_basic_a1')!.job_id).toBeUndefined()
    expect(job(db, 'channel_demographics_a1')).toMatchObject({ status: 'desativado' })
    expect(api.jobsCreate).toHaveBeenCalledTimes(3)
    expect(api.jobsCreate.mock.calls.map(c => (c[0] as { reportTypeId: string }).reportTypeId)).not.toContain('channel_demographics_a1')
    expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), canal, 'tipo_indisponivel')
    expect(resumo.tipo_indisponivel).toEqual(['Canal Um: channel_reach_basic_a1'])
    expect(resumo.acao_do_dono).toEqual([])
    expect(ctx.falhas).toEqual([])
  })

  it('linha desativado que já existe não é regravada', async () => {
    api.reportTypesList.mockResolvedValue([...TIPOS, { id: 'channel_demographics_a1' }])
    const db = fakeSupabase({ yt_reporting_jobs: [{ site_id: 'site-1', channel_id: 'ch-1', report_type_id: 'channel_demographics_a1', status: 'desativado' }] })
    await passoJobs(ctxDe(db))
    expect(db.writes.filter(w => (w.payload as Row).report_type_id === 'channel_demographics_a1')).toEqual([])
  })
})

describe('passoJobs: ação do dono', () => {
  it('reportTypes.list com 403 accessNotConfigured: uma linha api_nao_ativada por tipo, aviso, sem falha crítica', async () => {
    api.reportTypesList.mockRejectedValue(new ReportingHttpError(403, 'accessNotConfigured'))
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(estados(db)).toEqual(Object.fromEntries(REPORT_TYPES_ENABLED.map(t => [t, 'api_nao_ativada'])))
    expect(avisarEntrada).toHaveBeenCalledTimes(1)
    expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), canal, 'api_nao_ativada')
    expect(avisarSaida).not.toHaveBeenCalled()
    expect(resumo.acao_do_dono).toEqual(['Canal Um: api_nao_ativada'])
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'erro_http', http_status: 403 })
    expect(ctx.falhas).toEqual([])
    expect(api.jobsCreate).not.toHaveBeenCalled()
  })

  it('com 401: sem_acesso, e um job que estava ativo guarda o job_id', async () => {
    api.jobsList.mockRejectedValue(new ReportingHttpError(401, null))
    const db = fakeSupabase({ yt_reporting_jobs: [linhaAtiva('channel_basic_a3')] })
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(estados(db)).toEqual(Object.fromEntries(REPORT_TYPES_ENABLED.map(t => [t, 'sem_acesso'])))
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'sem_acesso', job_id: 'job-channel_basic_a3' })
    expect(avisarEntrada).toHaveBeenCalledWith(expect.anything(), canal, 'sem_acesso')
    expect(resumo.acao_do_dono).toEqual(['Canal Um: sem_acesso'])
    expect(ctx.falhas).toEqual([])
  })

  it('duas execuções com a API desativada: o aviso é pedido nas duas (quem deduplica é avisarEntrada) e a chamada é refeita', async () => {
    api.reportTypesList.mockRejectedValue(new ReportingHttpError(403, 'accessNotConfigured'))
    const db = fakeSupabase()
    await passoJobs(ctxDe(db))
    await passoJobs(ctxDe(db))
    expect(api.reportTypesList).toHaveBeenCalledTimes(2)
    expect(avisarEntrada).toHaveBeenCalledTimes(2)
    expect(db.tables.yt_reporting_jobs).toHaveLength(4)
  })

  it('a chamada volta a passar: os estados saem sozinhos e avisarSaida é chamado', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: REPORT_TYPES_ENABLED.map(t => ({ site_id: 'site-1', channel_id: 'ch-1', report_type_id: t, status: 'api_nao_ativada', error: 'HTTP 403 accessNotConfigured' })) })
    await passoJobs(ctxDe(db))
    expect(estados(db)).toEqual(Object.fromEntries(REPORT_TYPES_ENABLED.map(t => [t, 'ativo'])))
    expect(job(db, 'channel_basic_a3')).toMatchObject({ error: null })
    expect(avisarSaida).toHaveBeenCalledWith(expect.anything(), canal)
  })
})

describe('passoJobs: erros', () => {
  it('500 na listagem: erro só nos tipos que não estavam ativos; não é falha crítica na hora', async () => {
    api.reportTypesList.mockRejectedValue(new ReportingHttpError(500, null))
    const db = fakeSupabase({ yt_reporting_jobs: [linhaAtiva('channel_basic_a3')] })
    const ctx = ctxDe(db)
    const resumo = await passoJobs(ctx)
    expect(job(db, 'channel_basic_a3')).toMatchObject({ status: 'ativo' })
    expect(job(db, 'channel_reach_basic_a1')).toMatchObject({ status: 'erro', error: 'HTTP 500' })
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'erro_http', http_status: 500 })
    expect(avisarEntrada).not.toHaveBeenCalled()
    expect(resumo.acao_do_dono).toEqual([])
    expect(ctx.falhas).toEqual([])
  })

  it('fetch que nunca responde (timeout de 15 s): tentativa erro_http com http_status nulo', async () => {
    api.reportTypesList.mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
    const db = fakeSupabase()
    await passoJobs(ctxDe(db))
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'erro_http', http_status: null, error: 'request timed out' })
    expect(job(db, 'channel_reach_basic_a1')).toMatchObject({ status: 'erro', error: 'request timed out' })
  })

  it.each([
    ['TokenRevokedError', () => new TokenRevokedError('youtube', 'conn-1')],
    ['NoActiveConnectionError', () => new NoActiveConnectionError('youtube', 'site-1')],
  ])('simplificação de L1a: %s pula o canal com tentativa sem_conexao, sem aviso e sem falha', async (_nome, erro) => {
    vi.mocked(ensureFreshToken).mockRejectedValue(erro())
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    await passoJobs(ctx)
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'sem_conexao' })
    expect(api.reportTypesList).not.toHaveBeenCalled()
    expect(avisarEntrada).not.toHaveBeenCalled()
    expect(db.tables.yt_reporting_jobs ?? []).toEqual([])
    expect(ctx.falhas).toEqual([])
  })

  it('outro erro ao obter o token é falha crítica, com o nome do canal e sem o texto do banco', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new Error('Could not read the youtube connection for site site-1: relation "segredo" does not exist'))
    const db = fakeSupabase()
    const ctx = ctxDe(db)
    await passoJobs(ctx)
    expect(ctx.falhas).toEqual(['jobs: Canal Um: database error reading the connection'])
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'erro_http' })
  })

  it('um canal que falha não impede o seguinte', async () => {
    const outro = { ...canal, id: 'ch-2', channel_id: 'UC2', name: 'Canal Dois' }
    vi.mocked(ensureFreshToken).mockRejectedValueOnce(new Error('boom')).mockResolvedValue({ accessToken: 'tok', connectionId: 'c2' } as never)
    const db = fakeSupabase()
    const ctx = { ...ctxDe(db), channels: [canal, outro] }
    await passoJobs(ctx)
    expect(db.tables.yt_reporting_jobs!.filter(r => r.channel_id === 'ch-2')).toHaveLength(4)
    expect(ctx.falhas).toHaveLength(1)
  })

  it('tabela ausente em produção: schema_ausente, tentativa registrada e o passo para', async () => {
    const db = fakeSupabase()
    db.errors.yt_reporting_jobs = { code: 'PGRST205', message: 'Could not find the table' }
    const ctx = ctxDe(db)
    await passoJobs(ctx)
    expect(ctx.falhas).toEqual(['schema_ausente: yt_reporting_jobs'])
    expect(tentativaCanal(db)).toMatchObject({ outcome: 'schema_ausente' })
    expect(ensureFreshToken).not.toHaveBeenCalled()
  })

  it('passo que recebe 0 s: nao_alcancado_orcamento e pendentes', async () => {
    const db = fakeSupabase()
    const resumo = await passoJobs(ctxDe(db, -1))
    expect(resumo.pendentes).toBe(1)
    expect(resumo.tentativas).toEqual({ nao_alcancado_orcamento: 1 })
    expect(ensureFreshToken).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/jobs-step.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/youtube/coleta/jobs-step"`.

- [ ] **Step 3: Implementar**

Create `apps/web/src/lib/youtube/coleta/jobs-step.ts`:

```ts
// Passo 1A (spec, seção 4): sondagem dos tipos de relatório e criação dos jobs da Reporting API.
// Erro da Reporting API afeta só os passos 1A e 1C; nunca para a parte da Analytics API.
import * as Sentry from '@sentry/nextjs'
import { channelNote, describeCronCause } from '@/lib/cron/failure-note'
import { ensureFreshToken, NoActiveConnectionError, TokenRevokedError } from '@/lib/social/token-refresh'
import { classificarErro, criarReportingClient, type ReportingClient } from '@/lib/youtube/reporting/client'
import { REPORT_TYPES_ENABLED, ReportingHttpError, type Job } from '@/lib/youtube/reporting/types'
import { avisarEntrada, avisarSaida } from './alerts'
import { contarPorResultado, registrarTentativa, scopeJob } from './attempts'
import { emParalelo, fetchComPrazo, PARALELO, restante } from './clock'
import { conferirBanco, pushUnico } from './schema'
import type { ColetaChannel, StepCtx, StepResumo } from './types'

export type JobStatus = 'ativo' | 'desativado' | 'sem_acesso' | 'api_nao_ativada' | 'tipo_indisponivel' | 'erro'

export interface JobsResumo extends StepResumo {
  /** `<canal>: api_nao_ativada` / `<canal>: sem_acesso` — só o dono resolve; não entra em falhas[]. */
  acao_do_dono: string[]
  /** `<canal>: <report_type_id>` */
  tipo_indisponivel: string[]
  /** Por `youtube_channels.id`, o estado de cada tipo depois desta execução. */
  estados: Record<string, Record<string, JobStatus>>
}

const HABILITADOS: readonly string[] = REPORT_TYPES_ENABLED

/** Texto curto para `error`: status e reason, nunca o corpo. */
function descreverErro(e: unknown): string {
  if (e instanceof ReportingHttpError) return `HTTP ${e.status}${e.reason ? ` ${e.reason}` : ''}`
  return describeCronCause(e)
}

const statusHttp = (e: unknown): number | null => (e instanceof ReportingHttpError ? e.status : null)

function estadoDoErro(e: unknown): JobStatus {
  const classe = classificarErro(e)
  return classe === 'api_nao_ativada' ? 'api_nao_ativada' : classe === 'sem_acesso' ? 'sem_acesso' : 'erro'
}

/** Só as colunas enviadas são alteradas: job_id e job_create_time sobrevivem a uma mudança de estado. */
async function gravarJob(
  ctx: StepCtx,
  c: ColetaChannel,
  tipo: string,
  campos: { status: JobStatus; error?: string | null; job?: Job },
): Promise<boolean> {
  const linha: Record<string, unknown> = {
    site_id: c.site_id,
    channel_id: c.id,
    report_type_id: tipo,
    status: campos.status,
    error: campos.error ?? null,
  }
  if (campos.job) {
    linha.job_id = campos.job.id
    linha.job_create_time = campos.job.createTime ?? null
  }
  const r = await ctx.supabase.from('yt_reporting_jobs').upsert(linha, { onConflict: 'channel_id,report_type_id' })
  return conferirBanco(r, 'yt_reporting_jobs', ctx.falhas) === 'ok'
}

async function sondarCanal(
  ctx: StepCtx,
  c: ColetaChannel,
  api: ReportingClient,
  status: Map<string, JobStatus>,
  resumo: JobsResumo,
): Promise<void> {
  const tCanal = { site_id: c.site_id, scope_type: 'canal' as const, scope_id: c.id, kind: 'sondagem' as const, channel_id: c.id }
  const tJob = (tipo: string) => ({ ...tCanal, scope_type: 'job' as const, scope_id: scopeJob(c.id, tipo) })
  const estados: Record<string, JobStatus> = {}
  resumo.estados[c.id] = estados

  let oferecidos: Set<string>
  let jobs: Job[]
  try {
    const [tipos, existentes] = await Promise.all([api.reportTypesList(), api.jobsList()])
    oferecidos = new Set(tipos.map(t => t.id))
    jobs = existentes
  } catch (e) {
    // Se a listagem falhar, grava-se uma linha por tipo habilitado com o estado.
    const estado = estadoDoErro(e)
    const tipos = estado === 'erro' ? HABILITADOS.filter(t => status.get(t) !== 'ativo') : HABILITADOS
    for (const tipo of tipos) {
      estados[tipo] = estado
      await gravarJob(ctx, c, tipo, { status: estado, error: descreverErro(e) })
      await registrarTentativa(ctx, { ...tJob(tipo), outcome: 'erro_http', http_status: statusHttp(e), error: descreverErro(e) })
    }
    await registrarTentativa(ctx, { ...tCanal, outcome: 'erro_http', http_status: statusHttp(e), error: descreverErro(e) })
    if (estado === 'api_nao_ativada' || estado === 'sem_acesso') {
      pushUnico(resumo.acao_do_dono, `${c.name}: ${estado}`)
      await avisarEntrada(ctx, c, estado)
    }
    return
  }

  // A chamada passou: os estados de "ação do dono" saem sozinhos.
  await avisarSaida(ctx, c)
  const porTipo = new Map(jobs.map(j => [j.reportTypeId, j]))

  await emParalelo(HABILITADOS, PARALELO, async (tipo) => {
    try {
      if (!oferecidos.has(tipo)) {
        estados[tipo] = 'tipo_indisponivel'
        await gravarJob(ctx, c, tipo, { status: 'tipo_indisponivel' })
        await registrarTentativa(ctx, { ...tJob(tipo), outcome: 'ok' })
        pushUnico(resumo.tipo_indisponivel, `${c.name}: ${tipo}`)
        await avisarEntrada(ctx, c, 'tipo_indisponivel')
        return
      }
      let job: Job | null = porTipo.get(tipo) ?? null
      let erro: unknown = null
      if (!job) {
        try {
          job = await api.jobsCreate({ reportTypeId: tipo, name: `bythiagofigueiredo ${tipo}` })
        } catch (e) {
          erro = e
          if (e instanceof ReportingHttpError && e.status === 409) {
            // Já existe do lado do Google: lista de novo e adota.
            try {
              job = (await api.jobsList()).find(j => j.reportTypeId === tipo) ?? null
            } catch (e2) {
              erro = e2
            }
          }
        }
      }
      if (job) {
        estados[tipo] = 'ativo'
        if (await gravarJob(ctx, c, tipo, { status: 'ativo', job })) resumo.gravados++
        await registrarTentativa(ctx, { ...tJob(tipo), outcome: 'ok' })
        return
      }
      const estado = estadoDoErro(erro)
      estados[tipo] = estado
      await gravarJob(ctx, c, tipo, { status: estado, error: descreverErro(erro) })
      await registrarTentativa(ctx, { ...tJob(tipo), outcome: 'erro_http', http_status: statusHttp(erro), error: descreverErro(erro) })
      if (estado === 'api_nao_ativada' || estado === 'sem_acesso') {
        pushUnico(resumo.acao_do_dono, `${c.name}: ${estado}`)
        await avisarEntrada(ctx, c, estado)
      }
    } catch (e) {
      Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'jobs' }, extra: { canal: c.channel_id, tipo } })
      pushUnico(ctx.falhas, `jobs: ${channelNote(c.name, describeCronCause(e))}`)
    }
  })

  // Tipo que a lista devolve e não está habilitado: linha `desativado`, sem chamada.
  for (const tipo of oferecidos) {
    if (HABILITADOS.includes(tipo)) continue
    estados[tipo] = 'desativado'
    if (status.get(tipo) !== 'desativado') await gravarJob(ctx, c, tipo, { status: 'desativado' })
  }

  await registrarTentativa(ctx, { ...tCanal, outcome: 'ok' })
}

export async function passoJobs(ctx: StepCtx): Promise<JobsResumo> {
  const resumo: JobsResumo = { gravados: 0, tentativas: {}, pendentes: 0, acao_do_dono: [], tipo_indisponivel: [], estados: {} }

  for (const c of ctx.channels.filter(x => x.sync_enabled)) {
    const tCanal = { site_id: c.site_id, scope_type: 'canal' as const, scope_id: c.id, kind: 'sondagem' as const, channel_id: c.id }
    try {
      if (restante(ctx.deadline) <= 0) {
        await registrarTentativa(ctx, { ...tCanal, outcome: 'nao_alcancado_orcamento' })
        resumo.pendentes++
        continue
      }

      const atuais = await ctx.supabase.from('yt_reporting_jobs').select('report_type_id, status').eq('channel_id', c.id)
      const leitura = conferirBanco(atuais, 'yt_reporting_jobs', ctx.falhas, 'ler')
      if (leitura !== 'ok') {
        await registrarTentativa(ctx, { ...tCanal, outcome: leitura === 'schema_ausente' ? 'schema_ausente' : 'erro_http', error: 'erro de banco' })
        if (leitura === 'schema_ausente') break
        continue
      }
      const status = new Map(
        ((atuais.data ?? []) as Array<{ report_type_id: string; status: JobStatus }>).map(r => [r.report_type_id, r.status]),
      )
      if (HABILITADOS.every(t => status.get(t) === 'ativo')) {
        resumo.estados[c.id] = Object.fromEntries(HABILITADOS.map(t => [t, 'ativo' as JobStatus]))
        continue
      }

      let token: string
      try {
        token = (await ensureFreshToken(c.site_id, 'youtube', c.channel_id)).accessToken
      } catch (e) {
        // Simplificação declarada de L1a: sem `collection_status`, canal revogado ou sem conexão é só pulado.
        if (e instanceof TokenRevokedError || e instanceof NoActiveConnectionError) {
          await registrarTentativa(ctx, { ...tCanal, outcome: 'sem_conexao' })
          continue
        }
        throw e
      }

      await sondarCanal(ctx, c, criarReportingClient(token, fetchComPrazo(ctx.deadline)), status, resumo)
    } catch (e) {
      Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'jobs' }, extra: { canal: c.channel_id } })
      pushUnico(ctx.falhas, `jobs: ${channelNote(c.name, describeCronCause(e))}`)
      await registrarTentativa(ctx, { ...tCanal, outcome: 'erro_http', error: describeCronCause(e) })
    }
  }

  resumo.tentativas = contarPorResultado(ctx.tentativas, ['sondagem'])
  return resumo
}
```

- [ ] **Step 4: Rodar e ver passar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/jobs-step.test.ts`
Expected: PASS (20 testes).

- [ ] **Step 5: Typecheck e commit**

Run (de `apps/web`): `npx tsc --noEmit`
Expected: 0 erros.

```bash
git add apps/web/src/lib/youtube/coleta/jobs-step.ts apps/web/test/youtube/coleta/jobs-step.test.ts
git commit -m "feat: passo 1A da coleta (sondagem dos tipos de relatório e jobs da Reporting API)" -- apps/web/src/lib/youtube/coleta/jobs-step.ts apps/web/test/youtube/coleta/jobs-step.test.ts
```

---

### Task 11: Passo 1C — listar e baixar o bruto

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/reports-step.ts`
- Test: `apps/web/test/youtube/coleta/reports-step.test.ts`

**Interfaces:**
- Consumes:
  - Task 2: tabelas `yt_reporting_jobs`, `yt_reporting_reports`, `yt_reporting_report_blobs`; função `yt_reporting_blobs_purge(p_sem_normalizador text[]) returns integer`.
  - Task 3: `StepCtx`, `StepResumo`, `ColetaChannel`; `emParalelo`, `fetchComPrazo`, `restante`, `PARALELO`; `conferirBanco`, `pushUnico`.
  - Task 6: `registrarTentativa`, `contarPorResultado`, `scopeJob`.
  - Task 8: `criarReportingClient`, `classificarErro`, `paraBytea`, `ReportingClient`, `PacoteCsv`; `REPORT_TYPES_ENABLED`, `SEM_NORMALIZADOR`, `ReportingHttpError`, `Report`.
  - Do projeto: `ensureFreshToken`, `TokenRevokedError`, `NoActiveConnectionError`; `channelNote`, `describeCronCause`.
- Produces: `MAX_DOWNLOADS = 40`, `MAX_GZ_BYTES = 2 * 1024 * 1024`, `interface RelatoriosResumo extends StepResumo { vistos: number; baixados: number; vazios: number; expirados: number; erros_download: number; bruto_apagado: number }`, `passoRelatorios(ctx: StepCtx): Promise<RelatoriosResumo>`.

**Comportamento (spec, seção 5, só "Listar e baixar").**
1. **Listar.** Para cada canal com `sync_enabled` e cada job `ativo` com `job_id`: `reportsList` sem `createdAfter` na primeira vez; depois `createdAfter = last_create_time − 1 dia`; percorre `nextPageToken`. Cada relatório entra como `listado` com `download_url` e `job_expire_time`, por `upsert(..., { onConflict: 'report_id', ignoreDuplicates: true })`: a listagem nunca altera linha existente. `is_backfill = start_time < job_create_time`. Atualiza `last_listed_at` e `last_create_time` (o maior `createTime` já visto, comparado como instante, não como texto).
2. `reportsList` com 404 → o job vira `erro` (`error = 'job_removido'`); o 1A o recria na execução seguinte. Com `accessNotConfigured` ou 401/403 de permissão → o job vira `api_nao_ativada` / `sem_acesso`, para o 1A voltar a sondar e avisar.
3. **Expirar por idade.** `listado` com `create_time` há mais de 60 dias (30 se `is_backfill`) → `expirado_sem_baixar`.
4. **Baixar.** Fila dos `listado`, por prioridade de tipo (a ordem de `REPORT_TYPES_ENABLED`) e `create_time` crescente; no máximo 40 por execução, um de cada vez. Usa o `download_url` **gravado**. 401/403 → uma vez por job e por execução, `reportsList` sem `createdAfter`, `update download_url ... where status = 'listado'`, e tenta de novo. 404/410 → `expirado_sem_baixar`. Outro erro → o relatório continua `listado` (tenta amanhã) e fica uma tentativa `relatorio` `erro_http` de escopo `job`. Acima de 2 MB comprimido → `erro`, `error = 'grande_demais'`, sem bruto. `row_count = 0` → `vazio` (o bruto é guardado: o cabeçalho interessa ao L2).
5. **Limpar.** `rpc('yt_reporting_blobs_purge', { p_sem_normalizador: SEM_NORMALIZADOR })`.
6. `pendentes` = canais não alcançados + relatórios ainda `listado`. O teto de 40 e a fila **não** contam como `nao_alcancado_orcamento`: só o relógio conta.
7. **Simplificação de L1a:** `TokenRevokedError` / `NoActiveConnectionError` → tentativa `relatorio` `sem_conexao` de escopo `canal`, sem falha.

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/test/youtube/coleta/reports-step.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { gunzipSync } from 'node:zlib'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(),
}))
vi.mock('@/lib/youtube/reporting/client', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/reporting/client')>()),
  criarReportingClient: vi.fn(),
}))

import { passoRelatorios, MAX_DOWNLOADS, MAX_GZ_BYTES } from '@/lib/youtube/coleta/reports-step'
import { ensureFreshToken, TokenRevokedError } from '@/lib/social/token-refresh'
import { criarReportingClient, empacotarCsv, deBytea } from '@/lib/youtube/reporting/client'
import { ReportingHttpError, SEM_NORMALIZADOR } from '@/lib/youtube/reporting/types'
import type { StepCtx } from '@/lib/youtube/coleta/types'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'

const AGORA = new Date('2026-10-07T12:05:00.000Z')
const DIA_MS = 86_400_000
const ha = (dias: number) => new Date(AGORA.getTime() - dias * DIA_MS).toISOString()
const CSV = Buffer.from('date,video_id,video_thumbnail_impressions\n20261005,abc,100\n20261005,def,50\n')

const canal = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true }
const api = { reportTypesList: vi.fn(), jobsList: vi.fn(), jobsCreate: vi.fn(), reportsList: vi.fn(), download: vi.fn() }
const jobRow = (tipo: string, extra: Row = {}): Row => ({
  site_id: 'site-1', channel_id: 'ch-1', report_type_id: tipo, job_id: `job-${tipo}`, status: 'ativo',
  job_create_time: ha(6), last_create_time: null, ...extra,
})
const doGoogle = (id: string, extra: Record<string, string> = {}) => ({
  id, jobId: 'job-channel_reach_basic_a1', startTime: ha(2), endTime: ha(1), createTime: ha(1),
  jobExpireTime: ha(-60), downloadUrl: `https://dl.test/${id}`, ...extra,
})
const listado = (id: string, extra: Row = {}): Row => ({
  site_id: 'site-1', report_id: id, job_id: 'job-channel_reach_basic_a1', channel_id: 'ch-1',
  report_type_id: 'channel_reach_basic_a1', start_time: ha(2), end_time: ha(1), create_time: ha(1),
  download_url: `https://dl.test/${id}`, is_backfill: false, status: 'listado', ...extra,
})
const ctxDe = (db: FakeDb, prazoMs = 60_000): StepCtx => ({
  supabase: db.client, channels: [canal], deadline: Date.now() + prazoMs, falhas: [], tentativas: [],
})
const rel = (db: FakeDb, id: string) => db.tables.yt_reporting_reports?.find(r => r.report_id === id)
const comStatus = (db: FakeDb, status: string) => (db.tables.yt_reporting_reports ?? []).filter(r => r.status === status)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
  for (const m of Object.values(api)) m.mockReset()
  vi.mocked(criarReportingClient).mockReturnValue(api)
  vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' } as never)
  api.reportsList.mockResolvedValue({ reports: [], nextPageToken: null })
  api.download.mockImplementation(async () => empacotarCsv(CSV))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('passoRelatorios: listar', () => {
  it('primeira vez: sem createdAfter; entra listado com download_url, job_expire_time e is_backfill; o job guarda o maior createTime', async () => {
    api.reportsList.mockResolvedValue({
      reports: [
        // Como texto, '…01.5Z' < '…01Z'; como instante é o maior. O job tem de guardar o maior instante.
        doGoogle('r-antigo', { startTime: ha(20), endTime: ha(19), createTime: '2026-10-06T10:00:01.5Z' }),
        doGoogle('r-novo', { startTime: ha(2), endTime: ha(1), createTime: '2026-10-06T10:00:01Z' }),
      ],
      nextPageToken: null,
    })
    api.download.mockRejectedValue(new ReportingHttpError(500, null))
    const db = fakeSupabase({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(api.reportsList).toHaveBeenCalledWith('job-channel_reach_basic_a1', { createdAfter: undefined, pageToken: undefined })
    expect(rel(db, 'r-antigo')).toMatchObject({
      site_id: 'site-1', channel_id: 'ch-1', report_type_id: 'channel_reach_basic_a1', job_id: 'job-channel_reach_basic_a1',
      status: 'listado', download_url: 'https://dl.test/r-antigo', job_expire_time: ha(-60), is_backfill: true,
    })
    expect(rel(db, 'r-novo')).toMatchObject({ is_backfill: false })
    const job = db.tables.yt_reporting_jobs![0]!
    expect(job.last_create_time).toBe('2026-10-06T10:00:01.5Z')
    expect(job.last_listed_at).toBe(AGORA.toISOString())
    expect(resumo.vistos).toBe(2)
    expect(ctx.falhas).toEqual([])
  })

  it('depois: createdAfter = last_create_time − 1 dia, e percorre nextPageToken', async () => {
    api.reportsList
      .mockResolvedValueOnce({ reports: [doGoogle('p1')], nextPageToken: 'tok2' })
      .mockResolvedValueOnce({ reports: [doGoogle('p2')], nextPageToken: null })
    const db = fakeSupabase({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1', { last_create_time: '2026-10-06T10:00:00.000Z' })] })
    await passoRelatorios(ctxDe(db))
    expect(api.reportsList).toHaveBeenNthCalledWith(1, 'job-channel_reach_basic_a1', { createdAfter: '2026-10-05T10:00:00.000Z', pageToken: undefined })
    expect(api.reportsList).toHaveBeenNthCalledWith(2, 'job-channel_reach_basic_a1', { createdAfter: '2026-10-05T10:00:00.000Z', pageToken: 'tok2' })
    expect(db.tables.yt_reporting_reports).toHaveLength(2)
  })

  it('relistar um relatório já baixado não muda a linha nem baixa de novo', async () => {
    api.reportsList.mockResolvedValue({ reports: [doGoogle('r1', { downloadUrl: 'https://dl.test/outra' })], nextPageToken: null })
    const db = fakeSupabase({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('r1', { status: 'baixado', row_count: 5, sha256: 'abc' })],
    })
    await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')).toMatchObject({ status: 'baixado', row_count: 5, sha256: 'abc', download_url: 'https://dl.test/r1' })
    expect(api.download).not.toHaveBeenCalled()
  })

  it('reports.list com 404: o job vira erro (o 1A recria), sem falha crítica na hora', async () => {
    api.reportsList.mockRejectedValue(new ReportingHttpError(404, 'notFound'))
    const db = fakeSupabase({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    const ctx = ctxDe(db)
    await passoRelatorios(ctx)
    expect(db.tables.yt_reporting_jobs![0]).toMatchObject({ status: 'erro', error: 'job_removido' })
    expect(db.tables.yt_own_collection_attempts!.find(r => r.scope_type === 'job')).toMatchObject({
      scope_id: 'ch-1:channel_reach_basic_a1', kind: 'relatorio', outcome: 'erro_http', http_status: 404,
    })
    expect(ctx.falhas).toEqual([])
  })

  it('reports.list com 403 accessNotConfigured: o job vira api_nao_ativada para o 1A voltar a sondar', async () => {
    api.reportsList.mockRejectedValue(new ReportingHttpError(403, 'accessNotConfigured'))
    const db = fakeSupabase({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    await passoRelatorios(ctxDe(db))
    expect(db.tables.yt_reporting_jobs![0]).toMatchObject({ status: 'api_nao_ativada', job_id: 'job-channel_reach_basic_a1' })
  })

  it('canal sem job ativo: nenhuma chamada, nem de token', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1', { status: 'sem_acesso' })] })
    await passoRelatorios(ctxDe(db))
    expect(ensureFreshToken).not.toHaveBeenCalled()
  })

  it('simplificação de L1a: token revogado pula o canal com tentativa sem_conexao, sem falha', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new TokenRevokedError('youtube', 'conn-1'))
    const db = fakeSupabase({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    const ctx = ctxDe(db)
    await passoRelatorios(ctx)
    expect(db.tables.yt_own_collection_attempts).toEqual([expect.objectContaining({ scope_type: 'canal', kind: 'relatorio', outcome: 'sem_conexao' })])
    expect(api.reportsList).not.toHaveBeenCalled()
    expect(ctx.falhas).toEqual([])
  })
})

describe('passoRelatorios: baixar', () => {
  it('grava o bruto como \\x + hex de um gzip, e bytes, sha256, row_count e downloaded_at no relatório', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    const resumo = await passoRelatorios(ctxDe(db))
    const pacote = empacotarCsv(CSV)
    expect(api.download).toHaveBeenCalledWith('https://dl.test/r1')
    const blob = db.tables.yt_reporting_report_blobs![0]!
    expect(blob).toMatchObject({ report_id: 'r1', site_id: 'site-1' })
    expect((blob.csv_gz as string).startsWith('\\x1f8b')).toBe(true)
    expect(gunzipSync(deBytea(blob.csv_gz as string)).equals(CSV)).toBe(true)
    expect(rel(db, 'r1')).toMatchObject({ status: 'baixado', row_count: 2, sha256: pacote.sha256, downloaded_at: AGORA.toISOString(), error: null })
    expect(rel(db, 'r1')!.bytes).toBe((deBytea(blob.csv_gz as string)).length)
    expect(resumo).toMatchObject({ baixados: 1, gravados: 1, pendentes: 0 })
  })

  it('100 listados: 40 baixados e 60 pendentes; no dia seguinte baixa mais 40 pelo download_url gravado', async () => {
    const cem = Array.from({ length: 100 }, (_, i) => listado(`r-${String(i).padStart(3, '0')}`, { create_time: new Date(AGORA.getTime() - (200 - i) * 60_000).toISOString() }))
    const db = fakeSupabase({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: cem })
    const ctx = ctxDe(db)
    const um = await passoRelatorios(ctx)
    expect(MAX_DOWNLOADS).toBe(40)
    expect(um).toMatchObject({ baixados: 40, pendentes: 60 })
    expect(comStatus(db, 'baixado')).toHaveLength(40)
    expect(rel(db, 'r-000')!.status).toBe('baixado')
    expect(rel(db, 'r-040')!.status).toBe('listado')
    expect(ctx.tentativas.some(t => t.outcome === 'nao_alcancado_orcamento')).toBe(false)
    const dois = await passoRelatorios(ctxDe(db))
    expect(dois).toMatchObject({ baixados: 40, pendentes: 20 })
    expect(api.download).toHaveBeenLastCalledWith('https://dl.test/r-079')
  })

  it('prioridade: alcance básico → combinado → tráfego → channel_basic_a3; dentro do tipo, create_time crescente', async () => {
    const db = fakeSupabase({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [
        listado('basic-velho', { report_type_id: 'channel_basic_a3', create_time: ha(9) }),
        listado('trafego', { report_type_id: 'channel_traffic_source_a3', create_time: ha(8) }),
        listado('combinado', { report_type_id: 'channel_reach_combined_a1', create_time: ha(7) }),
        listado('alcance-2', { create_time: ha(1) }),
        listado('alcance-1', { create_time: ha(2) }),
      ],
    })
    await passoRelatorios(ctxDe(db))
    expect(api.download.mock.calls.map(c => c[0])).toEqual([
      'https://dl.test/alcance-1', 'https://dl.test/alcance-2', 'https://dl.test/combinado', 'https://dl.test/trafego', 'https://dl.test/basic-velho',
    ])
  })

  it('URL que devolve 403 é renovada: reportsList sem createdAfter uma vez, update do download_url e novo download', async () => {
    api.reportsList.mockImplementation(async (_job: string, o?: { createdAfter?: string }) =>
      o?.createdAfter
        ? { reports: [], nextPageToken: null }
        : { reports: [doGoogle('r1', { downloadUrl: 'https://dl.test/r1-nova' })], nextPageToken: null })
    api.download.mockImplementation(async (url: string) => {
      if (url.endsWith('-nova')) return empacotarCsv(CSV)
      throw new ReportingHttpError(403, null)
    })
    const db = fakeSupabase({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1', { last_create_time: ha(1) })],
      yt_reporting_reports: [listado('r1', { create_time: ha(3) }), listado('r2', { create_time: ha(2) })],
    })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(api.reportsList).toHaveBeenCalledTimes(2)
    expect(api.reportsList).toHaveBeenLastCalledWith('job-channel_reach_basic_a1', { createdAfter: undefined, pageToken: undefined })
    expect(api.download.mock.calls.map(c => c[0])).toEqual(['https://dl.test/r1', 'https://dl.test/r1-nova', 'https://dl.test/r2'])
    expect(rel(db, 'r1')).toMatchObject({ status: 'baixado', download_url: 'https://dl.test/r1-nova' })
    expect(rel(db, 'r2')).toMatchObject({ status: 'listado' })
    expect(resumo).toMatchObject({ baixados: 1, erros_download: 1, pendentes: 1 })
    expect(ctx.falhas).toEqual([])
  })

  it.each([404, 410])('download com %i: expirado_sem_baixar', async (status) => {
    api.download.mockRejectedValue(new ReportingHttpError(status, null))
    const db = fakeSupabase({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')).toMatchObject({ status: 'expirado_sem_baixar', error: `HTTP ${status}` })
    expect(resumo.expirados).toBe(1)
  })

  it('download com 500: continua listado para amanhã, com tentativa erro_http no job', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(500, null))
    const db = fakeSupabase({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(rel(db, 'r1')!.status).toBe('listado')
    expect(resumo).toMatchObject({ erros_download: 1, pendentes: 1 })
    expect(db.tables.yt_own_collection_attempts!.find(r => r.scope_type === 'job')).toMatchObject({ outcome: 'erro_http', http_status: 500 })
    expect(ctx.falhas).toEqual([])
  })

  it('acima de 2 MB comprimido: erro grande_demais, sem bruto', async () => {
    api.download.mockResolvedValue({ gz: Buffer.alloc(MAX_GZ_BYTES + 1), sha256: 'x', rowCount: 10 })
    const db = fakeSupabase({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    await passoRelatorios(ctxDe(db))
    expect(MAX_GZ_BYTES).toBe(2 * 1024 * 1024)
    expect(rel(db, 'r1')).toMatchObject({ status: 'erro', error: 'grande_demais', bytes: MAX_GZ_BYTES + 1 })
    expect(db.tables.yt_reporting_report_blobs ?? []).toEqual([])
  })

  it('relatório só com cabeçalho: vazio, com o bruto guardado', async () => {
    api.download.mockResolvedValue(empacotarCsv(Buffer.from('date,video_id\n')))
    const db = fakeSupabase({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')).toMatchObject({ status: 'vazio', row_count: 0 })
    expect(db.tables.yt_reporting_report_blobs).toHaveLength(1)
    expect(resumo).toMatchObject({ vazios: 1, baixados: 0 })
  })

  it('expira por idade: 60 dias, ou 30 se for backfill; o que ainda está no prazo é baixado', async () => {
    const db = fakeSupabase({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [
        listado('velho', { create_time: ha(61) }),
        listado('backfill-velho', { create_time: ha(31), is_backfill: true }),
        listado('backfill-ok', { create_time: ha(29), is_backfill: true }),
        listado('ok', { create_time: ha(59) }),
      ],
    })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(rel(db, 'velho')!.status).toBe('expirado_sem_baixar')
    expect(rel(db, 'backfill-velho')!.status).toBe('expirado_sem_baixar')
    expect(rel(db, 'backfill-ok')!.status).toBe('baixado')
    expect(rel(db, 'ok')!.status).toBe('baixado')
    expect(resumo.expirados).toBe(2)
  })
})

describe('passoRelatorios: limpeza, orçamento e schema', () => {
  it('chama a limpeza do bruto com os tipos sem normalizador', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    db.rpcHandlers.yt_reporting_blobs_purge = () => ({ data: 3, error: null })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(db.rpcCalls.find(c => c.name === 'yt_reporting_blobs_purge')!.args).toEqual({ p_sem_normalizador: SEM_NORMALIZADOR })
    expect(resumo.bruto_apagado).toBe(3)
  })

  it('passo que recebe 0 s: nao_alcancado_orcamento por canal, pendentes > 0, nenhuma chamada', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    const resumo = await passoRelatorios(ctxDe(db, -1))
    expect(resumo.pendentes).toBeGreaterThan(0)
    expect(resumo.tentativas).toEqual({ nao_alcancado_orcamento: 1 })
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(api.download).not.toHaveBeenCalled()
  })

  it('o relógio acaba no meio dos downloads: para, registra nao_alcancado_orcamento e o resto fica listado', async () => {
    api.download.mockImplementation(async () => {
      vi.setSystemTime(new Date(Date.now() + 61_000))
      return empacotarCsv(CSV)
    })
    const db = fakeSupabase({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('r1', { create_time: ha(3) }), listado('r2', { create_time: ha(2) }), listado('r3', { create_time: ha(1) })],
    })
    const resumo = await passoRelatorios(ctxDe(db))
    expect(api.download).toHaveBeenCalledTimes(1)
    expect(resumo).toMatchObject({ baixados: 1, pendentes: 2 })
    expect(db.tables.yt_own_collection_attempts!.find(r => r.scope_type === 'canal')).toMatchObject({ kind: 'relatorio', outcome: 'nao_alcancado_orcamento' })
  })

  it('tabela de relatórios ausente em produção: schema_ausente em falhas, sem lançar e sem baixar', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    db.errors.yt_reporting_reports = { code: '42P01', message: 'relation "yt_reporting_reports" does not exist' }
    api.reportsList.mockResolvedValue({ reports: [doGoogle('r1')], nextPageToken: null })
    const ctx = ctxDe(db)
    await expect(passoRelatorios(ctx)).resolves.toBeDefined()
    expect(ctx.falhas).toEqual(['schema_ausente: yt_reporting_reports'])
    expect(api.download).not.toHaveBeenCalled()
  })

  it('tabela de jobs ausente: schema_ausente e o passo para', async () => {
    const db = fakeSupabase()
    db.errors.yt_reporting_jobs = { code: 'PGRST205', message: 'Could not find the table' }
    const ctx = ctxDe(db)
    await passoRelatorios(ctx)
    expect(ctx.falhas).toEqual(['schema_ausente: yt_reporting_jobs'])
    expect(db.rpcCalls.some(c => c.name === 'yt_reporting_blobs_purge')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/reports-step.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/youtube/coleta/reports-step"`.

- [ ] **Step 3: Implementar**

Create `apps/web/src/lib/youtube/coleta/reports-step.ts`:

```ts
// Passo 1C (spec, seção 5) — recorte do lote L1a: só listar e baixar o bruto. A normalização é L2.
// O histórico inicial some em 30 dias: por isso a fila é por prioridade (alcance primeiro) e o
// download usa a URL gravada na listagem, renovando-a quando o Google a recusa.
import * as Sentry from '@sentry/nextjs'
import { channelNote, describeCronCause } from '@/lib/cron/failure-note'
import { ensureFreshToken, NoActiveConnectionError, TokenRevokedError } from '@/lib/social/token-refresh'
import { classificarErro, criarReportingClient, paraBytea, type PacoteCsv, type ReportingClient } from '@/lib/youtube/reporting/client'
import { REPORT_TYPES_ENABLED, ReportingHttpError, SEM_NORMALIZADOR, type Report } from '@/lib/youtube/reporting/types'
import { contarPorResultado, registrarTentativa, scopeJob } from './attempts'
import { emParalelo, fetchComPrazo, PARALELO, restante } from './clock'
import { conferirBanco, pushUnico } from './schema'
import type { ColetaChannel, StepCtx, StepResumo } from './types'

export const MAX_DOWNLOADS = 40
export const MAX_GZ_BYTES = 2 * 1024 * 1024
const DIA_MS = 86_400_000
const MAX_PAGINAS = 50
const HABILITADOS: readonly string[] = REPORT_TYPES_ENABLED

export interface RelatoriosResumo extends StepResumo {
  /** Relatórios devolvidos pela listagem nesta execução (inclui os que já existiam). */
  vistos: number
  baixados: number
  vazios: number
  expirados: number
  erros_download: number
  bruto_apagado: number
}

interface JobRow {
  site_id: string
  channel_id: string
  report_type_id: string
  job_id: string | null
  job_create_time: string | null
  last_create_time: string | null
}

interface Pendente {
  site_id: string
  report_id: string
  channel_id: string
  report_type_id: string
  job_id: string
  download_url: string
  create_time: string
}

const instante = (s: string): number => new Date(s).getTime()
const statusHttp = (e: unknown): number | null => (e instanceof ReportingHttpError ? e.status : null)
const descreverErro = (e: unknown): string =>
  e instanceof ReportingHttpError ? `HTTP ${e.status}${e.reason ? ` ${e.reason}` : ''}` : describeCronCause(e)

/** Todas as páginas de `reports.list` de um job. */
async function listarTudo(api: ReportingClient, jobId: string, createdAfter?: string): Promise<Report[]> {
  const todos: Report[] = []
  let pageToken: string | undefined
  for (let i = 0; i < MAX_PAGINAS; i++) {
    const p = await api.reportsList(jobId, { createdAfter, pageToken })
    todos.push(...p.reports)
    if (!p.nextPageToken) break
    pageToken = p.nextPageToken
  }
  return todos
}

/** Lista um job e insere os relatórios novos como `listado`. Nunca lança. */
async function listarJob(ctx: StepCtx, c: ColetaChannel, api: ReportingClient, j: JobRow, resumo: RelatoriosResumo): Promise<void> {
  const tJob = { site_id: c.site_id, scope_type: 'job' as const, scope_id: scopeJob(c.id, j.report_type_id), kind: 'relatorio' as const, channel_id: c.id }
  const noJob = () => ctx.supabase.from('yt_reporting_jobs')
  try {
    const createdAfter = j.last_create_time ? new Date(instante(j.last_create_time) - DIA_MS).toISOString() : undefined
    const vistos = await listarTudo(api, j.job_id!, createdAfter)
    resumo.vistos += vistos.length

    if (vistos.length > 0) {
      const criadoEm = j.job_create_time ? instante(j.job_create_time) : null
      const linhas = vistos.map(r => ({
        site_id: c.site_id,
        report_id: r.id,
        job_id: j.job_id,
        channel_id: c.id,
        report_type_id: j.report_type_id,
        start_time: r.startTime,
        end_time: r.endTime,
        create_time: r.createTime,
        job_expire_time: r.jobExpireTime ?? null,
        download_url: r.downloadUrl,
        is_backfill: criadoEm !== null && instante(r.startTime) < criadoEm,
        status: 'listado',
      }))
      // ignoreDuplicates: a listagem nunca altera uma linha que já existe.
      const ins = await ctx.supabase.from('yt_reporting_reports').upsert(linhas, { onConflict: 'report_id', ignoreDuplicates: true })
      const escrita = conferirBanco(ins, 'yt_reporting_reports', ctx.falhas)
      if (escrita !== 'ok') {
        await registrarTentativa(ctx, { ...tJob, outcome: escrita === 'schema_ausente' ? 'schema_ausente' : 'erro_http', error: 'erro de banco' })
        return
      }
    }

    // O maior createTime já listado, comparado como instante (o Google mistura frações de segundo).
    let maior = j.last_create_time
    for (const r of vistos) if (!maior || instante(r.createTime) > instante(maior)) maior = r.createTime
    const upd = await noJob()
      .update({ last_listed_at: new Date().toISOString(), last_create_time: maior })
      .eq('channel_id', c.id)
      .eq('report_type_id', j.report_type_id)
    conferirBanco(upd, 'yt_reporting_jobs', ctx.falhas)
    await registrarTentativa(ctx, { ...tJob, outcome: 'ok' })
  } catch (e) {
    const classe = classificarErro(e)
    const novo =
      classe === 'nao_encontrado' ? { status: 'erro', error: 'job_removido' }
      : classe === 'api_nao_ativada' || classe === 'sem_acesso' ? { status: classe, error: descreverErro(e) }
      : null
    if (novo) {
      const upd = await noJob().update(novo).eq('channel_id', c.id).eq('report_type_id', j.report_type_id)
      conferirBanco(upd, 'yt_reporting_jobs', ctx.falhas)
    }
    await registrarTentativa(ctx, { ...tJob, outcome: 'erro_http', http_status: statusHttp(e), error: descreverErro(e) })
  }
}

/** Baixa um relatório pelo download_url gravado. Nunca lança. */
async function baixarUm(
  ctx: StepCtx,
  api: ReportingClient,
  p: Pendente,
  urls: Map<string, string>,
  renovados: Set<string>,
  resumo: RelatoriosResumo,
): Promise<void> {
  const marcar = (campos: Record<string, unknown>) =>
    ctx.supabase.from('yt_reporting_reports').update(campos).eq('report_id', p.report_id)
  try {
    let pacote: PacoteCsv | null = null
    let erro: unknown = null
    try {
      pacote = await api.download(urls.get(p.report_id) ?? p.download_url)
    } catch (e) {
      erro = e
    }

    // URL vencida: renova as URLs do job uma vez por execução e tenta de novo.
    if (erro instanceof ReportingHttpError && (erro.status === 401 || erro.status === 403) && !renovados.has(p.job_id)) {
      renovados.add(p.job_id)
      try {
        for (const r of await listarTudo(api, p.job_id)) {
          urls.set(r.id, r.downloadUrl)
          const u = await ctx.supabase
            .from('yt_reporting_reports')
            .update({ download_url: r.downloadUrl })
            .eq('report_id', r.id)
            .eq('status', 'listado')
          conferirBanco(u, 'yt_reporting_reports', ctx.falhas)
        }
        const nova = urls.get(p.report_id)
        if (nova) {
          pacote = await api.download(nova)
          erro = null
        }
      } catch (e) {
        erro = e
      }
    }

    if (erro || !pacote) {
      if (erro instanceof ReportingHttpError && (erro.status === 404 || erro.status === 410)) {
        conferirBanco(await marcar({ status: 'expirado_sem_baixar', error: `HTTP ${erro.status}` }), 'yt_reporting_reports', ctx.falhas)
        resumo.expirados++
        return
      }
      // Erro passageiro: continua `listado` e tenta amanhã.
      resumo.erros_download++
      await registrarTentativa(ctx, {
        site_id: p.site_id, scope_type: 'job', scope_id: scopeJob(p.channel_id, p.report_type_id), kind: 'relatorio',
        outcome: 'erro_http', http_status: statusHttp(erro), error: descreverErro(erro), channel_id: p.channel_id,
      })
      return
    }

    if (pacote.gz.length > MAX_GZ_BYTES) {
      conferirBanco(
        await marcar({ status: 'erro', error: 'grande_demais', bytes: pacote.gz.length, sha256: pacote.sha256, row_count: pacote.rowCount }),
        'yt_reporting_reports', ctx.falhas,
      )
      return
    }

    const blob = await ctx.supabase
      .from('yt_reporting_report_blobs')
      .upsert({ report_id: p.report_id, site_id: p.site_id, csv_gz: paraBytea(pacote.gz) }, { onConflict: 'report_id' })
    if (conferirBanco(blob, 'yt_reporting_report_blobs', ctx.falhas) !== 'ok') return

    const vazio = pacote.rowCount === 0
    const fim = await marcar({
      status: vazio ? 'vazio' : 'baixado',
      error: null,
      row_count: pacote.rowCount,
      bytes: pacote.gz.length,
      sha256: pacote.sha256,
      downloaded_at: new Date().toISOString(),
    })
    if (conferirBanco(fim, 'yt_reporting_reports', ctx.falhas) !== 'ok') return
    if (vazio) resumo.vazios++
    else resumo.baixados++
    resumo.gravados++
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'relatorios' }, extra: { report: p.report_id } })
    pushUnico(ctx.falhas, `relatórios: ${describeCronCause(e)}`)
  }
}

export async function passoRelatorios(ctx: StepCtx): Promise<RelatoriosResumo> {
  const resumo: RelatoriosResumo = {
    gravados: 0, tentativas: {}, pendentes: 0, vistos: 0, baixados: 0, vazios: 0, expirados: 0, erros_download: 0, bruto_apagado: 0,
  }
  const fechar = (): RelatoriosResumo => {
    resumo.tentativas = contarPorResultado(ctx.tentativas, ['relatorio'])
    return resumo
  }
  const canais = ctx.channels.filter(c => c.sync_enabled)
  if (canais.length === 0) return fechar()
  const tCanal = (c: ColetaChannel) =>
    ({ site_id: c.site_id, scope_type: 'canal' as const, scope_id: c.id, kind: 'relatorio' as const, channel_id: c.id })

  if (restante(ctx.deadline) <= 0) {
    for (const c of canais) await registrarTentativa(ctx, { ...tCanal(c), outcome: 'nao_alcancado_orcamento' })
    resumo.pendentes = canais.length
    return fechar()
  }

  const f = fetchComPrazo(ctx.deadline)
  const clientes = new Map<string, ReportingClient>()

  // ── 1. Listar ────────────────────────────────────────────────────────────
  for (const c of canais) {
    try {
      if (restante(ctx.deadline) <= 0) {
        await registrarTentativa(ctx, { ...tCanal(c), outcome: 'nao_alcancado_orcamento' })
        resumo.pendentes++
        continue
      }
      const lidos = await ctx.supabase
        .from('yt_reporting_jobs')
        .select('site_id, channel_id, report_type_id, job_id, job_create_time, last_create_time')
        .eq('channel_id', c.id)
        .eq('status', 'ativo')
      const leitura = conferirBanco(lidos, 'yt_reporting_jobs', ctx.falhas, 'ler')
      if (leitura === 'schema_ausente') {
        await registrarTentativa(ctx, { ...tCanal(c), outcome: 'schema_ausente' })
        return fechar()
      }
      if (leitura !== 'ok') {
        await registrarTentativa(ctx, { ...tCanal(c), outcome: 'erro_http', error: 'erro de banco' })
        continue
      }
      const jobs = ((lidos.data ?? []) as JobRow[]).filter(j => !!j.job_id)
      if (jobs.length === 0) continue

      let token: string
      try {
        token = (await ensureFreshToken(c.site_id, 'youtube', c.channel_id)).accessToken
      } catch (e) {
        // Simplificação declarada de L1a: canal revogado ou sem conexão é só pulado.
        if (e instanceof TokenRevokedError || e instanceof NoActiveConnectionError) {
          await registrarTentativa(ctx, { ...tCanal(c), outcome: 'sem_conexao' })
          continue
        }
        throw e
      }
      const api = criarReportingClient(token, f)
      clientes.set(c.id, api)
      await emParalelo(jobs, PARALELO, j => listarJob(ctx, c, api, j, resumo))
      await registrarTentativa(ctx, { ...tCanal(c), outcome: 'ok' })
    } catch (e) {
      Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'relatorios' }, extra: { canal: c.channel_id } })
      pushUnico(ctx.falhas, `relatórios: ${channelNote(c.name, describeCronCause(e))}`)
      await registrarTentativa(ctx, { ...tCanal(c), outcome: 'erro_http', error: describeCronCause(e) })
    }
  }

  // ── 2. Expirar por idade: 60 dias, ou 30 se for backfill ─────────────────
  const agora = Date.now()
  for (const [backfill, dias] of [[true, 30], [false, 60]] as const) {
    const r = await ctx.supabase
      .from('yt_reporting_reports')
      .update({ status: 'expirado_sem_baixar', error: 'passou do prazo sem baixar' })
      .eq('status', 'listado')
      .eq('is_backfill', backfill)
      .lt('create_time', new Date(agora - dias * DIA_MS).toISOString())
      .select('report_id')
    const escrita = conferirBanco(r, 'yt_reporting_reports', ctx.falhas)
    if (escrita === 'schema_ausente') return fechar()
    if (escrita === 'ok') resumo.expirados += ((r.data ?? []) as unknown[]).length
  }

  // ── 3. Baixar: por prioridade de tipo e create_time crescente, no máximo 40 ──
  const idsDosCanais = canais.map(c => c.id)
  const filaLida = await ctx.supabase
    .from('yt_reporting_reports')
    .select('site_id, report_id, channel_id, report_type_id, job_id, download_url, create_time')
    .eq('status', 'listado')
    .in('channel_id', idsDosCanais)
    .order('create_time', { ascending: true })
    .limit(1000)
  if (conferirBanco(filaLida, 'yt_reporting_reports', ctx.falhas, 'ler') !== 'ok') return fechar()
  const prioridade = (tipo: string): number => {
    const i = HABILITADOS.indexOf(tipo)
    return i === -1 ? HABILITADOS.length : i
  }
  const fila = ((filaLida.data ?? []) as Pendente[])
    .filter(p => clientes.has(p.channel_id))
    .sort((a, b) => prioridade(a.report_type_id) - prioridade(b.report_type_id) || instante(a.create_time) - instante(b.create_time))

  const urls = new Map<string, string>()
  const renovados = new Set<string>()
  let semTempo = false
  for (const p of fila.slice(0, MAX_DOWNLOADS)) {
    if (restante(ctx.deadline) <= 0) {
      semTempo = true
      break
    }
    // Um de cada vez: o buffer do relatório anterior já foi liberado.
    await baixarUm(ctx, clientes.get(p.channel_id)!, p, urls, renovados, resumo)
  }
  // Só o relógio conta como nao_alcancado_orcamento; o teto de 40 e a fila não.
  if (semTempo) {
    for (const c of canais) {
      if (clientes.has(c.id)) await registrarTentativa(ctx, { ...tCanal(c), outcome: 'nao_alcancado_orcamento' })
    }
  }

  // ── 4. Limpar o bruto ────────────────────────────────────────────────────
  if (restante(ctx.deadline) > 0) {
    const purge = await ctx.supabase.rpc('yt_reporting_blobs_purge', { p_sem_normalizador: SEM_NORMALIZADOR })
    if (conferirBanco(purge, 'yt_reporting_blobs_purge', ctx.falhas) === 'ok' && typeof purge.data === 'number') {
      resumo.bruto_apagado = purge.data
    }
  }

  // ── 5. O que ficou para depois ───────────────────────────────────────────
  const resta = await ctx.supabase
    .from('yt_reporting_reports')
    .select('report_id', { count: 'exact', head: true })
    .eq('status', 'listado')
    .in('channel_id', idsDosCanais)
  if (conferirBanco(resta, 'yt_reporting_reports', ctx.falhas, 'ler') === 'ok') resumo.pendentes += resta.count ?? 0

  return fechar()
}
```

- [ ] **Step 4: Rodar e ver passar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/reports-step.test.ts`
Expected: PASS (22 testes).

- [ ] **Step 5: Typecheck e commit**

Run (de `apps/web`): `npx tsc --noEmit`
Expected: 0 erros.

```bash
git add apps/web/src/lib/youtube/coleta/reports-step.ts apps/web/test/youtube/coleta/reports-step.test.ts
git commit -m "feat: passo 1C da coleta (lista os relatórios, baixa o bruto pelo download_url gravado, expira e limpa)" -- apps/web/src/lib/youtube/coleta/reports-step.ts apps/web/test/youtube/coleta/reports-step.test.ts
```

---

### Task 12: Critérios de falha da seção 9 que valem em L1a

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/criteria.ts`
- Test: `apps/web/test/youtube/coleta/criteria.test.ts`

**Interfaces:**
- Consumes: Task 3 (`StepCtx`, `AttemptKind`, `conferirBanco`, `pushUnico`), Task 4 (`utcDay`), Task 6 (`scopeJob`, `fakeSupabase`), Task 8 (`REACH_TYPES`).
- Produces:
  - `interface CriteriosRelatorios { perdidos: number; atrasados: number }`
  - `criteriosRelatorios(ctx: Pick<StepCtx, 'supabase' | 'falhas' | 'channels'>): Promise<CriteriosRelatorios>`
  - `criterioJobsEmErro(ctx: Pick<StepCtx, 'supabase' | 'falhas' | 'channels'>): Promise<void>`
  - `criterioOrcamento(ctx: Pick<StepCtx, 'supabase' | 'falhas'>, kinds: readonly AttemptKind[]): Promise<void>`

**Critérios implementados aqui** (os de metadados estão na Task 9):

| Critério do spec | Como fica em L1a |
|---|---|
| relatório de alcance em `erro` | `status = 'erro'`, tipo em `REACH_TYPES`, `create_time` nos últimos 14 dias → falha |
| `vazio` em 4 `create_time` seguidos | por canal e tipo de alcance, os 4 mais recentes (dentro de 14 dias) todos `vazio` → falha |
| `expirado_sem_baixar` | qualquer tipo, `create_time` nos últimos 14 dias → falha; mais antigo que isso → só `perdidos` |
| relatório `listado` há mais de 14 dias | `status = 'listado'` e `create_time` anterior a 14 dias → falha, e `atrasados` na resposta (ver "Divergências", item 3) |
| `perdidos` | `erro` ou `expirado_sem_baixar` com `create_time` anterior a 14 dias: saem de `falhas[]`, ficam na resposta |
| job de alcance `ativo` há mais de 6 dias sem relatório novo | `job_create_time` anterior a 6 dias, nenhum relatório do canal e tipo com `create_time` nos últimos 6 dias, e o canal tem vídeo publicado nos últimos 90 dias → falha |
| job em `erro` por 3 dias | os 3 dias mais recentes com tentativa de escopo `job` (kinds `sondagem` e `relatorio`), nenhum com `ok` → falha |
| mesmo escopo e `kind` com `nao_alcancado_orcamento` nas 3 últimas tentativas | para cada escopo que hoje ficou sem alcançar, as 3 linhas mais recentes; se as 3 são `nao_alcancado_orcamento` → falha (uma nota por `kind`, com a contagem) |

- [ ] **Step 1: Escrever o teste que falha**

Create `apps/web/test/youtube/coleta/criteria.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { criteriosRelatorios, criterioJobsEmErro, criterioOrcamento } from '@/lib/youtube/coleta/criteria'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'

const AGORA = new Date('2026-10-07T12:05:00.000Z')
const DIA_MS = 86_400_000
const ha = (dias: number) => new Date(AGORA.getTime() - dias * DIA_MS).toISOString()
const diaUtc = (dias: number) => ha(dias).slice(0, 10)

const canal = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true }
const ctxDe = (db: FakeDb) => ({ supabase: db.client, falhas: [] as string[], channels: [canal] })
const rel = (id: string, status: string, criadoHa: number, tipo = 'channel_reach_basic_a1'): Row => ({
  report_id: id, channel_id: 'ch-1', report_type_id: tipo, status, create_time: ha(criadoHa), is_backfill: false,
})
const jobAtivo = (criadoHa: number, tipo = 'channel_reach_basic_a1'): Row => ({
  channel_id: 'ch-1', report_type_id: tipo, status: 'ativo', job_id: 'j', job_create_time: ha(criadoHa),
})
const tentativa = (scopeType: string, scopeId: string, kind: string, outcome: string, dias: number): Row => ({
  scope_type: scopeType, scope_id: scopeId, kind, outcome, attempt_day: diaUtc(dias), channel_id: 'ch-1', site_id: 'site-1', attempts: 1,
})

beforeEach(() => {
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('criteriosRelatorios', () => {
  it('tudo baixado: nenhuma falha, perdidos e atrasados zerados', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [rel('a', 'baixado', 1), rel('b', 'baixado', 2)] })
    const ctx = ctxDe(db)
    expect(await criteriosRelatorios(ctx)).toEqual({ perdidos: 0, atrasados: 0 })
    expect(ctx.falhas).toEqual([])
  })

  it('expirado_sem_baixar há 2 dias é falha; há 15 dias sai de falhas e aparece em perdidos', async () => {
    const recente = fakeSupabase({ yt_reporting_reports: [rel('a', 'expirado_sem_baixar', 2)] })
    const c1 = ctxDe(recente)
    expect(await criteriosRelatorios(c1)).toEqual({ perdidos: 0, atrasados: 0 })
    expect(c1.falhas).toEqual(['relatórios: Canal Um tem relatório channel_reach_basic_a1 expirado sem baixar'])

    const antigo = fakeSupabase({ yt_reporting_reports: [rel('a', 'expirado_sem_baixar', 15)] })
    const c2 = ctxDe(antigo)
    expect(await criteriosRelatorios(c2)).toEqual({ perdidos: 1, atrasados: 0 })
    expect(c2.falhas).toEqual([])
  })

  it('relatório de alcance em erro é falha; de outro tipo, não', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [rel('a', 'erro', 1), rel('b', 'erro', 1, 'channel_basic_a3')] })
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual(['relatórios: Canal Um tem relatório de alcance channel_reach_basic_a1 em erro'])
  })

  it('alcance em erro há 15 dias: perdido, não falha', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [rel('a', 'erro', 15)] })
    const ctx = ctxDe(db)
    expect((await criteriosRelatorios(ctx)).perdidos).toBe(1)
    expect(ctx.falhas).toEqual([])
  })

  it('4 relatórios de alcance vazios seguidos é falha; 3 vazios e um baixado, não', async () => {
    const quatro = fakeSupabase({ yt_reporting_reports: [rel('a', 'vazio', 1), rel('b', 'vazio', 2), rel('c', 'vazio', 3), rel('d', 'vazio', 4), rel('e', 'baixado', 5)] })
    const c1 = ctxDe(quatro)
    await criteriosRelatorios(c1)
    expect(c1.falhas).toEqual(['relatórios: Canal Um recebeu 4 relatórios channel_reach_basic_a1 vazios seguidos'])

    const tres = fakeSupabase({ yt_reporting_reports: [rel('a', 'vazio', 1), rel('b', 'vazio', 2), rel('c', 'baixado', 3), rel('d', 'vazio', 4)] })
    const c2 = ctxDe(tres)
    await criteriosRelatorios(c2)
    expect(c2.falhas).toEqual([])
  })

  it('relatório listado há mais de 14 dias é falha e conta em atrasados', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [rel('a', 'listado', 15), rel('b', 'listado', 3)] })
    const ctx = ctxDe(db)
    expect(await criteriosRelatorios(ctx)).toEqual({ perdidos: 0, atrasados: 1 })
    expect(ctx.falhas).toEqual(['relatórios: 1 relatório(s) listado(s) há mais de 14 dias sem baixar'])
  })

  it('job de alcance ativo há 7 dias, sem relatório novo, em canal com vídeo recente: falha', async () => {
    const db = fakeSupabase({
      yt_reporting_jobs: [jobAtivo(7)],
      yt_reporting_reports: [rel('velho', 'baixado', 9)],
      youtube_videos: [{ id: 'v1', channel_id: 'ch-1', published_at: ha(30) }],
    })
    const ctx = ctxDe(db)
    await criteriosRelatorios(ctx)
    expect(ctx.falhas).toEqual(['relatórios: Canal Um está sem relatório novo de channel_reach_basic_a1 há mais de 6 dias'])
  })

  it('o mesmo job não é falha se: tem relatório de 2 dias, ou o canal não publica há 90 dias, ou o job tem 5 dias, ou o tipo não é de alcance', async () => {
    const video = { id: 'v1', channel_id: 'ch-1', published_at: ha(30) }
    const casos: Array<Record<string, Row[]>> = [
      { yt_reporting_jobs: [jobAtivo(7)], yt_reporting_reports: [rel('novo', 'listado', 2)], youtube_videos: [video] },
      { yt_reporting_jobs: [jobAtivo(7)], youtube_videos: [{ ...video, published_at: ha(120) }] },
      { yt_reporting_jobs: [jobAtivo(5)], youtube_videos: [video] },
      { yt_reporting_jobs: [jobAtivo(7, 'channel_basic_a3')], youtube_videos: [video] },
    ]
    for (const seed of casos) {
      const ctx = ctxDe(fakeSupabase(seed))
      await criteriosRelatorios(ctx)
      expect(ctx.falhas).toEqual([])
    }
  })

  it('tabela ausente: schema_ausente, sem lançar', async () => {
    const db = fakeSupabase()
    db.errors.yt_reporting_reports = { code: '42P01', message: 'x' }
    const ctx = ctxDe(db)
    expect(await criteriosRelatorios(ctx)).toEqual({ perdidos: 0, atrasados: 0 })
    expect(ctx.falhas).toEqual(['schema_ausente: yt_reporting_reports'])
  })
})

describe('criterioJobsEmErro', () => {
  const jobErro: Row = { channel_id: 'ch-1', report_type_id: 'channel_reach_basic_a1', status: 'erro' }
  const escopo = 'ch-1:channel_reach_basic_a1'

  it('job em erro com 3 dias seguidos de tentativa sem ok: falha', async () => {
    const db = fakeSupabase({
      yt_reporting_jobs: [jobErro],
      yt_own_collection_attempts: [0, 1, 2].map(d => tentativa('job', escopo, 'sondagem', 'erro_http', d)),
    })
    const ctx = ctxDe(db)
    await criterioJobsEmErro(ctx)
    expect(ctx.falhas).toEqual(['jobs: Canal Um está com o job channel_reach_basic_a1 em erro há 3 dias'])
  })

  it('só 2 dias, ou um ok no meio: ainda não é falha', async () => {
    const dois = fakeSupabase({ yt_reporting_jobs: [jobErro], yt_own_collection_attempts: [0, 1].map(d => tentativa('job', escopo, 'sondagem', 'erro_http', d)) })
    const c1 = ctxDe(dois)
    await criterioJobsEmErro(c1)
    expect(c1.falhas).toEqual([])

    const comOk = fakeSupabase({
      yt_reporting_jobs: [jobErro],
      yt_own_collection_attempts: [
        tentativa('job', escopo, 'relatorio', 'erro_http', 0),
        tentativa('job', escopo, 'sondagem', 'ok', 1),
        tentativa('job', escopo, 'relatorio', 'erro_http', 1),
        tentativa('job', escopo, 'sondagem', 'erro_http', 2),
      ],
    })
    const c2 = ctxDe(comOk)
    await criterioJobsEmErro(c2)
    expect(c2.falhas).toEqual([])
  })

  it('job ativo não é olhado', async () => {
    const db = fakeSupabase({ yt_reporting_jobs: [{ ...jobErro, status: 'ativo' }], yt_own_collection_attempts: [0, 1, 2].map(d => tentativa('job', escopo, 'sondagem', 'erro_http', d)) })
    const ctx = ctxDe(db)
    await criterioJobsEmErro(ctx)
    expect(ctx.falhas).toEqual([])
  })
})

describe('criterioOrcamento', () => {
  it('o mesmo escopo e kind sem alcançar nas 3 últimas tentativas: falha, uma nota por kind com a contagem', async () => {
    const db = fakeSupabase({
      yt_own_collection_attempts: [
        ...[0, 1, 2].map(d => tentativa('video', 'yt-1', 'meta', 'nao_alcancado_orcamento', d)),
        ...[0, 1, 2].map(d => tentativa('video', 'yt-2', 'meta', 'nao_alcancado_orcamento', d)),
        ...[0, 1, 2].map(d => tentativa('canal', 'ch-1', 'relatorio', 'nao_alcancado_orcamento', d)),
      ],
    })
    const ctx = ctxDe(db)
    await criterioOrcamento(ctx, ['meta', 'thumbnail', 'sondagem', 'relatorio'])
    expect(ctx.falhas.sort()).toEqual([
      'orçamento: 1 escopo(s) de relatorio sem alcançar nas 3 últimas tentativas',
      'orçamento: 2 escopo(s) de meta sem alcançar nas 3 últimas tentativas',
    ])
  })

  it('só 2 seguidas, ou um ok no meio, ou nada hoje: não é falha', async () => {
    const db = fakeSupabase({
      yt_own_collection_attempts: [
        ...[0, 1].map(d => tentativa('video', 'yt-1', 'meta', 'nao_alcancado_orcamento', d)),
        tentativa('video', 'yt-2', 'meta', 'nao_alcancado_orcamento', 0),
        tentativa('video', 'yt-2', 'meta', 'ok', 1),
        tentativa('video', 'yt-2', 'meta', 'nao_alcancado_orcamento', 2),
        ...[1, 2, 3].map(d => tentativa('video', 'yt-3', 'meta', 'nao_alcancado_orcamento', d)),
      ],
    })
    const ctx = ctxDe(db)
    await criterioOrcamento(ctx, ['meta'])
    expect(ctx.falhas).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/criteria.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/youtube/coleta/criteria"`.

- [ ] **Step 3: Implementar**

Create `apps/web/src/lib/youtube/coleta/criteria.ts`:

```ts
// Critérios de falha crítica da seção 9 do spec que valem no lote L1a e não cabem dentro de um passo.
// Tudo que entra em falhas[] deixa o /api/health degradado; o que não tem conserto vira `perdidos`.
import { REACH_TYPES } from '@/lib/youtube/reporting/types'
import { scopeJob } from './attempts'
import { utcDay } from './day-pt'
import { conferirBanco, pushUnico } from './schema'
import type { AttemptKind, StepCtx } from './types'

const DIA_MS = 86_400_000
const ALCANCE: readonly string[] = REACH_TYPES
type Ctx = Pick<StepCtx, 'supabase' | 'falhas' | 'channels'>

const iso = (ms: number): string => new Date(ms).toISOString()

export interface CriteriosRelatorios {
  /** `erro` ou `expirado_sem_baixar` com create_time anterior a 14 dias: estado sem conserto, fora de falhas[]. */
  perdidos: number
  /** `listado` com create_time anterior a 14 dias. */
  atrasados: number
}

interface Recente {
  report_id: string
  channel_id: string
  report_type_id: string
  status: string
  create_time: string
}

export async function criteriosRelatorios(ctx: Ctx): Promise<CriteriosRelatorios> {
  const out: CriteriosRelatorios = { perdidos: 0, atrasados: 0 }
  const agora = Date.now()
  const corte14 = iso(agora - 14 * DIA_MS)
  const corte6 = iso(agora - 6 * DIA_MS)
  const nome = (id: string): string => ctx.channels.find(c => c.id === id)?.name ?? id

  // Relatórios dos últimos 14 dias, do mais novo para o mais velho.
  const rec = await ctx.supabase
    .from('yt_reporting_reports')
    .select('report_id, channel_id, report_type_id, status, create_time')
    .gte('create_time', corte14)
    .order('create_time', { ascending: false })
    .limit(1000)
  if (conferirBanco(rec, 'yt_reporting_reports', ctx.falhas, 'ler') !== 'ok') return out
  const recentes = (rec.data ?? []) as Recente[]

  const porJob = new Map<string, Recente[]>()
  for (const r of recentes) {
    if (r.status === 'expirado_sem_baixar') {
      pushUnico(ctx.falhas, `relatórios: ${nome(r.channel_id)} tem relatório ${r.report_type_id} expirado sem baixar`)
    }
    if (!ALCANCE.includes(r.report_type_id)) continue
    if (r.status === 'erro') {
      pushUnico(ctx.falhas, `relatórios: ${nome(r.channel_id)} tem relatório de alcance ${r.report_type_id} em erro`)
    }
    const chave = `${r.channel_id}|${r.report_type_id}`
    porJob.set(chave, [...(porJob.get(chave) ?? []), r])
  }
  for (const lista of porJob.values()) {
    const ultimos = lista.slice(0, 4)
    if (ultimos.length === 4 && ultimos.every(r => r.status === 'vazio')) {
      const r = ultimos[0]!
      pushUnico(ctx.falhas, `relatórios: ${nome(r.channel_id)} recebeu 4 relatórios ${r.report_type_id} vazios seguidos`)
    }
  }

  // Listado há mais de 14 dias: tem conserto (baixar), então é falha enquanto durar.
  const atras = await ctx.supabase
    .from('yt_reporting_reports')
    .select('report_id', { count: 'exact', head: true })
    .eq('status', 'listado')
    .lt('create_time', corte14)
  if (conferirBanco(atras, 'yt_reporting_reports', ctx.falhas, 'ler') === 'ok') {
    out.atrasados = atras.count ?? 0
    if (out.atrasados > 0) pushUnico(ctx.falhas, `relatórios: ${out.atrasados} relatório(s) listado(s) há mais de 14 dias sem baixar`)
  }

  // Perdidos: sem conserto. Manter o vermelho para sempre esconderia as falhas novas.
  const perd = await ctx.supabase
    .from('yt_reporting_reports')
    .select('report_id', { count: 'exact', head: true })
    .in('status', ['erro', 'expirado_sem_baixar'])
    .lt('create_time', corte14)
  if (conferirBanco(perd, 'yt_reporting_reports', ctx.falhas, 'ler') === 'ok') out.perdidos = perd.count ?? 0

  // Job de alcance ativo há mais de 6 dias sem relatório novo, em canal que publicou nos últimos 90 dias.
  const jobs = await ctx.supabase
    .from('yt_reporting_jobs')
    .select('channel_id, report_type_id, job_create_time')
    .eq('status', 'ativo')
    .in('report_type_id', [...ALCANCE])
    .lt('job_create_time', corte6)
  if (conferirBanco(jobs, 'yt_reporting_jobs', ctx.falhas, 'ler') !== 'ok') return out
  for (const j of (jobs.data ?? []) as Array<{ channel_id: string; report_type_id: string }>) {
    const canal = ctx.channels.find(c => c.id === j.channel_id)
    if (!canal || !canal.sync_enabled) continue
    const novo = await ctx.supabase
      .from('yt_reporting_reports')
      .select('report_id', { count: 'exact', head: true })
      .eq('channel_id', j.channel_id)
      .eq('report_type_id', j.report_type_id)
      .gte('create_time', corte6)
    if (conferirBanco(novo, 'yt_reporting_reports', ctx.falhas, 'ler') !== 'ok' || (novo.count ?? 0) > 0) continue
    const publicou = await ctx.supabase
      .from('youtube_videos')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', j.channel_id)
      .gte('published_at', iso(agora - 90 * DIA_MS))
    if (conferirBanco(publicou, 'youtube_videos', ctx.falhas, 'ler') !== 'ok') continue
    if ((publicou.count ?? 0) > 0) {
      pushUnico(ctx.falhas, `relatórios: ${canal.name} está sem relatório novo de ${j.report_type_id} há mais de 6 dias`)
    }
  }

  return out
}

/** Job em `erro` por 3 dias: os 3 dias mais recentes com tentativa de escopo `job`, nenhum com `ok`. */
export async function criterioJobsEmErro(ctx: Ctx): Promise<void> {
  const r = await ctx.supabase.from('yt_reporting_jobs').select('channel_id, report_type_id').eq('status', 'erro')
  if (conferirBanco(r, 'yt_reporting_jobs', ctx.falhas, 'ler') !== 'ok') return
  for (const j of (r.data ?? []) as Array<{ channel_id: string; report_type_id: string }>) {
    const t = await ctx.supabase
      .from('yt_own_collection_attempts')
      .select('attempt_day, outcome')
      .eq('scope_type', 'job')
      .eq('scope_id', scopeJob(j.channel_id, j.report_type_id))
      .in('kind', ['sondagem', 'relatorio'])
      .order('attempt_day', { ascending: false })
      .limit(12)
    if (conferirBanco(t, 'yt_own_collection_attempts', ctx.falhas, 'ler') !== 'ok') continue
    const teveOk = new Map<string, boolean>()
    for (const l of (t.data ?? []) as Array<{ attempt_day: string; outcome: string }>) {
      teveOk.set(l.attempt_day, (teveOk.get(l.attempt_day) ?? false) || l.outcome === 'ok')
    }
    const dias = [...teveOk.values()].slice(0, 3)
    if (dias.length === 3 && dias.every(ok => !ok)) {
      const nome = ctx.channels.find(c => c.id === j.channel_id)?.name ?? j.channel_id
      pushUnico(ctx.falhas, `jobs: ${nome} está com o job ${j.report_type_id} em erro há 3 dias`)
    }
  }
}

/** O mesmo escopo e kind com `nao_alcancado_orcamento` nas 3 últimas tentativas registradas. */
export async function criterioOrcamento(ctx: Pick<StepCtx, 'supabase' | 'falhas'>, kinds: readonly AttemptKind[]): Promise<void> {
  const hoje = await ctx.supabase
    .from('yt_own_collection_attempts')
    .select('scope_type, scope_id, kind')
    .eq('attempt_day', utcDay(new Date()))
    .eq('outcome', 'nao_alcancado_orcamento')
    .in('kind', [...kinds])
    .limit(200)
  if (conferirBanco(hoje, 'yt_own_collection_attempts', ctx.falhas, 'ler') !== 'ok') return
  const porKind = new Map<string, number>()
  for (const e of (hoje.data ?? []) as Array<{ scope_type: string; scope_id: string; kind: string }>) {
    const ult = await ctx.supabase
      .from('yt_own_collection_attempts')
      .select('outcome')
      .eq('scope_type', e.scope_type)
      .eq('scope_id', e.scope_id)
      .eq('kind', e.kind)
      .order('attempt_day', { ascending: false })
      .limit(3)
    const linhas = (ult.data ?? []) as Array<{ outcome: string }>
    if (linhas.length === 3 && linhas.every(l => l.outcome === 'nao_alcancado_orcamento')) {
      porKind.set(e.kind, (porKind.get(e.kind) ?? 0) + 1)
    }
  }
  for (const [kind, n] of porKind) {
    pushUnico(ctx.falhas, `orçamento: ${n} escopo(s) de ${kind} sem alcançar nas 3 últimas tentativas`)
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/criteria.test.ts`
Expected: PASS (14 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/coleta/criteria.ts apps/web/test/youtube/coleta/criteria.test.ts
git commit -m "feat: critérios de falha da coleta (relatórios, jobs em erro e orçamento)" -- apps/web/src/lib/youtube/coleta/criteria.ts apps/web/test/youtube/coleta/criteria.test.ts
```

---

### Task 13: `rodarColeta` — a entrada única dos passos novos

**Files:**
- Create: `apps/web/src/lib/youtube/coleta/index.ts`
- Test: `apps/web/test/youtube/coleta/index.test.ts`
- Test: `apps/web/test/youtube/coleta/orcamento.test.ts`

**Interfaces:**
- Consumes: Task 3 (`ColetaChannel`, `ColetaResult`, `StepCtx`, `Tentativa`, `Relogio`, `TETOS_MS`, `pushUnico`), Task 9 (`passoMetadados`), Task 10 (`passoJobs`, `JobsResumo`), Task 11 (`passoRelatorios`), Task 12 (`criteriosRelatorios`, `criterioJobsEmErro`, `criterioOrcamento`), `describeCronCause`.
- Produces:
  - `PASSOS_LIGADOS = { metadados: true, jobs: true, relatorios: true } as const` — desligar um passo é um commit de uma linha (runbook).
  - `interface ColetaCtx { supabase: SupabaseClient; relogio: Relogio; fase: 'antes' | 'depois' }`
  - `rodarColeta(ctx: ColetaCtx): Promise<ColetaResult>` — nunca lança por falha de um passo.

**Comportamento.**
- A ordem do spec é metadados → 1A → o que o cron já faz → 1C. Como a parte antiga fica na rota, `rodarColeta` é chamada duas vezes: `fase: 'antes'` roda metadados e 1A; `fase: 'depois'` roda 1C e o critério de orçamento.
- Lê os canais sozinha, **sem filtro**: `select id, channel_id, site_id, name, sync_enabled from youtube_channels`. (Em L1a não existe `collection_status`.) Erro nessa leitura entra em `falhas[]` e nenhum passo novo roda.
- Cada passo recebe `deadline = relogio.prazo(teto)`. Exceção num passo vira item de `falhas[]` e os passos seguintes rodam.
- `resumo`: na fase `antes`, as chaves `metadados`, `jobs` e `acao_do_dono`; na fase `depois`, `relatorios` (com `perdidos` e `atrasados`).

- [ ] **Step 1: Escrever os testes que falham**

Create `apps/web/test/youtube/coleta/index.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/coleta/meta-step', () => ({ passoMetadados: vi.fn() }))
vi.mock('@/lib/youtube/coleta/jobs-step', () => ({ passoJobs: vi.fn() }))
vi.mock('@/lib/youtube/coleta/reports-step', () => ({ passoRelatorios: vi.fn() }))
vi.mock('@/lib/youtube/coleta/criteria', () => ({
  criteriosRelatorios: vi.fn(),
  criterioJobsEmErro: vi.fn(),
  criterioOrcamento: vi.fn(),
}))

import { rodarColeta, PASSOS_LIGADOS } from '@/lib/youtube/coleta'
import { passoMetadados } from '@/lib/youtube/coleta/meta-step'
import { passoJobs } from '@/lib/youtube/coleta/jobs-step'
import { passoRelatorios } from '@/lib/youtube/coleta/reports-step'
import { criteriosRelatorios, criterioJobsEmErro, criterioOrcamento } from '@/lib/youtube/coleta/criteria'
import { criarRelogio } from '@/lib/youtube/coleta/clock'
import type { StepCtx } from '@/lib/youtube/coleta/types'
import { fakeSupabase } from './fake-supabase'

const AGORA = new Date('2026-10-07T12:00:00.000Z')
const canais = [
  { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true, slug: 'um' },
  { id: 'ch-2', channel_id: 'UC2', site_id: 'site-1', name: 'Canal Dois', sync_enabled: false, slug: 'dois' },
]
const resumoVazio = { gravados: 0, tentativas: {}, pendentes: 0 }

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
  vi.mocked(passoMetadados).mockResolvedValue({ ...resumoVazio, gravados: 35, day_pt: '2026-10-06', dias_sem_meta: {} })
  vi.mocked(passoJobs).mockResolvedValue({ ...resumoVazio, acao_do_dono: ['Canal Um: sem_acesso'], tipo_indisponivel: [], estados: {} })
  vi.mocked(passoRelatorios).mockResolvedValue({ ...resumoVazio, vistos: 0, baixados: 3, vazios: 0, expirados: 0, erros_download: 0, bruto_apagado: 0 })
  vi.mocked(criteriosRelatorios).mockResolvedValue({ perdidos: 2, atrasados: 0 })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('rodarColeta', () => {
  it('os três passos nascem ligados', () => {
    expect(PASSOS_LIGADOS).toEqual({ metadados: true, jobs: true, relatorios: true })
  })

  it('fase antes: lê todos os canais sem filtro e roda metadados e depois jobs, cada um com o seu teto', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    const ctxMeta = vi.mocked(passoMetadados).mock.calls[0]![0] as StepCtx
    const ctxJobs = vi.mocked(passoJobs).mock.calls[0]![0] as StepCtx
    expect(ctxMeta.channels.map(c => c.id)).toEqual(['ch-1', 'ch-2'])
    expect(ctxMeta.deadline - Date.now()).toBe(30_000)
    expect(ctxJobs.deadline - Date.now()).toBe(20_000)
    expect(vi.mocked(passoMetadados).mock.invocationCallOrder[0]!).toBeLessThan(vi.mocked(passoJobs).mock.invocationCallOrder[0]!)
    expect(criterioJobsEmErro).toHaveBeenCalledTimes(1)
    expect(passoRelatorios).not.toHaveBeenCalled()
    expect(r.falhas).toEqual([])
    expect(r.resumo).toMatchObject({ metadados: { gravados: 35 }, jobs: { acao_do_dono: ['Canal Um: sem_acesso'] }, acao_do_dono: ['Canal Um: sem_acesso'] })
  })

  it('fase depois: roda relatórios com 60 s, junta perdidos e atrasados, e confere o orçamento', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'depois' })
    const ctxRel = vi.mocked(passoRelatorios).mock.calls[0]![0] as StepCtx
    expect(ctxRel.deadline - Date.now()).toBe(60_000)
    expect(passoMetadados).not.toHaveBeenCalled()
    expect(passoJobs).not.toHaveBeenCalled()
    expect(r.resumo).toMatchObject({ relatorios: { baixados: 3, perdidos: 2, atrasados: 0 } })
    expect(criterioOrcamento).toHaveBeenCalledWith(expect.anything(), ['meta', 'thumbnail', 'sondagem', 'relatorio'])
  })

  it('exceção num passo vira item de falhas e o passo seguinte roda', async () => {
    vi.mocked(passoMetadados).mockRejectedValue(new Error('statement timeout'))
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(r.falhas).toEqual(['metadados: database error'])
    expect(passoJobs).toHaveBeenCalledTimes(1)
  })

  it('o que os passos põem em ctx.falhas sai no resultado', async () => {
    vi.mocked(passoJobs).mockImplementation(async (c: StepCtx) => {
      c.falhas.push('schema_ausente: yt_reporting_jobs')
      return { ...resumoVazio, acao_do_dono: [], tipo_indisponivel: [], estados: {} }
    })
    const db = fakeSupabase({ youtube_channels: canais })
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(r.falhas).toEqual(['schema_ausente: yt_reporting_jobs'])
  })

  it('erro ao ler os canais: uma falha e nenhum passo novo roda', async () => {
    const db = fakeSupabase()
    db.errors.youtube_channels = { code: '57014', message: 'statement timeout' }
    const r = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(r.falhas).toEqual(['coleta: erro de banco ao ler os canais'])
    expect(passoMetadados).not.toHaveBeenCalled()
    expect(passoJobs).not.toHaveBeenCalled()
  })

  it('relógio global estourado: o passo recebe um prazo que já passou', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 300_000), fase: 'depois' })
    const ctxRel = vi.mocked(passoRelatorios).mock.calls[0]![0] as StepCtx
    expect(ctxRel.deadline).toBeLessThanOrEqual(Date.now())
  })

  it('restando 10 s de relógio, o passo de 60 s recebe 10 s', async () => {
    const db = fakeSupabase({ youtube_channels: canais })
    await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 260_000), fase: 'depois' })
    const ctxRel = vi.mocked(passoRelatorios).mock.calls[0]![0] as StepCtx
    expect(ctxRel.deadline - Date.now()).toBe(10_000)
  })
})
```

Create `apps/web/test/youtube/coleta/orcamento.test.ts` (passos de verdade, sem mock dos passos — aceite 7 do spec):

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/thumb-fingerprint', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/thumb-fingerprint')>()),
  probeThumb: vi.fn(async () => ({ etag: null, lastModified: null, dhash: 'ffffffffffffffff', bytes: Buffer.from('img'), url: 'u' })),
  archiveThumb: vi.fn(async () => 'https://blob.test/a.jpg'),
}))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(async () => ({ accessToken: 'tok', connectionId: 'c1' })),
}))
vi.mock('@/lib/youtube/reporting/client', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/reporting/client')>()),
  criarReportingClient: vi.fn(() => ({
    reportTypesList: vi.fn(async () => []),
    jobsList: vi.fn(async () => []),
    jobsCreate: vi.fn(),
    reportsList: vi.fn(async () => ({ reports: [], nextPageToken: null })),
    download: vi.fn(),
  })),
}))
vi.mock('@/lib/youtube/coleta/alerts', () => ({ avisarEntrada: vi.fn(), avisarSaida: vi.fn() }))

import { rodarColeta } from '@/lib/youtube/coleta'
import { criarRelogio } from '@/lib/youtube/coleta/clock'
import { REPORT_TYPES_ENABLED } from '@/lib/youtube/reporting/types'
import { fakeSupabase, type Row } from './fake-supabase'

const AGORA = new Date('2026-10-07T12:00:00.000Z')
const canal: Row = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true }
const video: Row = { id: 'v-1', youtube_video_id: 'yt-1', channel_id: 'ch-1', site_id: 'site-1', title: 'T', description: 'D', tags: [], duration_seconds: 300, published_at: '2026-09-01T00:00:00.000Z' }
const jobAtivo: Row = { site_id: 'site-1', channel_id: 'ch-1', report_type_id: 'channel_reach_basic_a1', job_id: 'job-1', status: 'ativo', job_create_time: '2026-10-05T00:00:00.000Z', last_create_time: null }
const semAlcancar = (dia: string): Row => ({ scope_type: 'canal', scope_id: 'ch-1', kind: 'relatorio', outcome: 'nao_alcancado_orcamento', attempt_day: dia, channel_id: 'ch-1', site_id: 'site-1', attempts: 1 })

beforeEach(() => {
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('orçamento, com os passos de verdade', () => {
  it('relógio global estourado depois da parte antiga: metadados rodou, relatórios ficam nao_alcancado_orcamento com pendentes > 0', async () => {
    // Os quatro jobs já ativos: o 1A não tem o que sondar e o teste fica só no orçamento.
    const quatroAtivos = REPORT_TYPES_ENABLED.map(t => ({ ...jobAtivo, report_type_id: t, job_id: `job-${t}` }))
    const db = fakeSupabase({ youtube_channels: [canal], youtube_videos: [video], yt_reporting_jobs: quatroAtivos })

    const antes = await rodarColeta({ supabase: db.client, relogio: criarRelogio(), fase: 'antes' })
    expect(antes.resumo.metadados).toMatchObject({ gravados: 1 })
    expect(db.tables.yt_own_video_meta_daily).toHaveLength(1)

    const depois = await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 300_000), fase: 'depois' })
    const relatorios = depois.resumo.relatorios as { pendentes: number; tentativas: Record<string, number> }
    expect(relatorios.tentativas).toEqual({ nao_alcancado_orcamento: 1 })
    expect(relatorios.pendentes).toBeGreaterThan(0)
    expect(depois.falhas).toEqual([])
  })

  it('terceira execução seguida sem alcançar os relatórios: falha crítica', async () => {
    const db = fakeSupabase({
      youtube_channels: [canal], yt_reporting_jobs: [jobAtivo],
      yt_own_collection_attempts: [semAlcancar('2026-10-05'), semAlcancar('2026-10-06')],
    })
    const depois = await rodarColeta({ supabase: db.client, relogio: criarRelogio(Date.now() - 300_000), fase: 'depois' })
    expect(depois.falhas).toEqual(['orçamento: 1 escopo(s) de relatorio sem alcançar nas 3 últimas tentativas'])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/index.test.ts test/youtube/coleta/orcamento.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/youtube/coleta"`.

- [ ] **Step 3: Implementar**

Create `apps/web/src/lib/youtube/coleta/index.ts`:

```ts
// Coleta dos canais próprios — entrada única dos passos novos do cron sync-analytics-metrics.
// Ordem do spec: metadados → 1A → o que o cron já faz → 1C. A parte antiga mora na rota, então a
// rota chama rodarColeta duas vezes: fase 'antes' (metadados, 1A) e fase 'depois' (1C, orçamento).
// Nada aqui chama recordCronSuccess/recordCronFailure: os passos só acumulam falhas[].
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describeCronCause } from '@/lib/cron/failure-note'
import { TETOS_MS, type Relogio } from './clock'
import { criterioJobsEmErro, criterioOrcamento, criteriosRelatorios } from './criteria'
import { passoJobs, type JobsResumo } from './jobs-step'
import { passoMetadados } from './meta-step'
import { passoRelatorios } from './reports-step'
import { pushUnico } from './schema'
import type { ColetaChannel, ColetaResult, StepCtx, Tentativa } from './types'

/** Desligar um passo é um commit de uma linha (runbook, "Desligar um passo ou um tipo"). */
export const PASSOS_LIGADOS = { metadados: true, jobs: true, relatorios: true } as const

export interface ColetaCtx {
  supabase: SupabaseClient
  relogio: Relogio
  fase: 'antes' | 'depois'
}

export async function rodarColeta(ctx: ColetaCtx): Promise<ColetaResult> {
  const falhas: string[] = []
  const resumo: Record<string, unknown> = {}

  // Leitura própria, sem filtro: o passo de metadados cobre todos os canais; os demais filtram
  // sync_enabled em código. (L1a: ainda não existe collection_status.)
  const lidos = await ctx.supabase.from('youtube_channels').select('id, channel_id, site_id, name, sync_enabled')
  if (lidos.error) {
    Sentry.captureMessage(`sync-analytics-metrics: a coleta não leu os canais: ${lidos.error.message}`)
    return { falhas: ['coleta: erro de banco ao ler os canais'], resumo }
  }
  const channels = (lidos.data ?? []) as ColetaChannel[]
  const tentativas: Tentativa[] = []

  const passo = async (nome: string, tetoMs: number, fn: (c: StepCtx) => Promise<unknown>): Promise<void> => {
    try {
      resumo[nome] = await fn({ supabase: ctx.supabase, channels, deadline: ctx.relogio.prazo(tetoMs), falhas, tentativas })
    } catch (e) {
      Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: nome } })
      pushUnico(falhas, `${nome}: ${describeCronCause(e)}`)
    }
  }

  if (ctx.fase === 'antes') {
    if (PASSOS_LIGADOS.metadados) await passo('metadados', TETOS_MS.metadados, passoMetadados)
    if (PASSOS_LIGADOS.jobs) {
      await passo('jobs', TETOS_MS.jobs, async (c) => {
        const r = await passoJobs(c)
        await criterioJobsEmErro(c)
        return r
      })
    }
    resumo.acao_do_dono = (resumo.jobs as JobsResumo | undefined)?.acao_do_dono ?? []
    return { falhas, resumo }
  }

  if (PASSOS_LIGADOS.relatorios) {
    await passo('relatorios', TETOS_MS.relatorios, async (c) => {
      const r = await passoRelatorios(c)
      return { ...r, ...(await criteriosRelatorios(c)) }
    })
  }
  try {
    await criterioOrcamento({ supabase: ctx.supabase, falhas }, ['meta', 'thumbnail', 'sondagem', 'relatorio'])
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'orcamento' } })
    pushUnico(falhas, `orçamento: ${describeCronCause(e)}`)
  }
  return { falhas, resumo }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run (de `apps/web`): `npx vitest run test/youtube/coleta/index.test.ts test/youtube/coleta/orcamento.test.ts`
Expected: PASS (8 + 2 testes).

- [ ] **Step 5: Rodar a pasta inteira da coleta, typecheck e commit**

Run (de `apps/web`): `npx vitest run test/youtube/coleta`
Expected: PASS, 13 arquivos de teste, 0 falhas.

Run (de `apps/web`): `npx tsc --noEmit`
Expected: 0 erros.

```bash
git add apps/web/src/lib/youtube/coleta/index.ts apps/web/test/youtube/coleta/index.test.ts apps/web/test/youtube/coleta/orcamento.test.ts
git commit -m "feat: rodarColeta, a entrada dos passos novos do cron de analytics, em duas fases" -- apps/web/src/lib/youtube/coleta/index.ts apps/web/test/youtube/coleta/index.test.ts apps/web/test/youtube/coleta/orcamento.test.ts
```

---

### Task 14: A rota — veredito único, relógio de 300 s, timeouts e conferência de `error`

**Files:**
- Modify: `apps/web/src/app/api/cron/sync-analytics-metrics/route.ts` (arquivo inteiro, 353 linhas; o conteúdo final está no Step 4)
- Modify: `apps/web/test/cron/sync-analytics-metrics.test.ts:36-39` (acrescenta um `vi.mock` logo depois)
- Modify: `apps/web/test/api/cron/sync-analytics-metrics.test.ts:54-57` (acrescenta um `vi.mock` logo depois)
- Test: `apps/web/test/cron/sync-analytics-metrics-veredito.test.ts`

**Interfaces:**
- Consumes: Task 13 `rodarColeta(ctx: { supabase; relogio: Relogio; fase: 'antes' | 'depois' }): Promise<{ falhas: string[]; resumo: Record<string, unknown> }>`; Task 3 `criarRelogio(): Relogio`, `FETCH_TIMEOUT_MS`, `conferirBanco(res, onde, falhas, verbo?)`; Task 6 helper de teste `fakeSupabase`.
- Produces: a rota `GET /api/cron/sync-analytics-metrics` com `maxDuration = 300` e a resposta acrescida de `ms_existente`, `coleta`, `acao_do_dono` e (quando houver) `falhas`.

**Mapeamento exato (spec, seção 9) sobre o arquivo de hoje:**

| Hoje | Passa a ser |
|---|---|
| l.26 `maxDuration = 120` | `maxDuration = 300` |
| l.45-50 erro ao ler os canais → `recordCronFailure` + 500 | **igual.** É o único registro fora do veredito, porque nenhum passo rodou |
| l.52-55 `no_channels` → `recordCronSuccess` e resposta | a rota ainda chama `rodarColeta` nas duas fases, dá o veredito, e só então responde `{ status: 'no_channels', ... }` |
| l.57-334 laço por canal, marcos, avisos, fadiga | movido, sem refatorar o laço, para `parteAntiga()` no mesmo arquivo; a chamada fica dentro de um `try`; exceção vira item de `falhas[]` |
| l.90-92 `fetch` sem timeout | `signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)` |
| l.144-149, l.151-161, l.224-228, l.320-326 escritas sem conferir `error` | cada uma passa por `conferirBanco(...)`: `schema_ausente` ou erro de banco vira item de `falhas[]` |
| l.336-337 `errors > 0` → `recordCronFailure(joinNotes(errorDetails))` | `falhas.push(joinNotes(errorDetails))` |
| l.338-347 todos os canais vazios → `recordCronFailure(...)` | `falhas.push(` a mesma mensagem `)` |
| l.348-350 `recordCronSuccess` | só roda com `falhas` vazia, na última linha |

- [ ] **Step 1: Editar os dois testes que já existem**

Em `apps/web/test/cron/sync-analytics-metrics.test.ts`, logo depois do bloco `vi.mock('@/lib/cron-health', ...)` (linhas 36-39), acrescente:

```ts
// Os passos novos têm testes próprios (test/youtube/coleta/); aqui a rota roda só com a parte antiga.
vi.mock('@/lib/youtube/coleta', () => ({
  rodarColeta: async () => ({ falhas: [], resumo: {} }),
}))
```

Em `apps/web/test/api/cron/sync-analytics-metrics.test.ts`, logo depois do bloco `vi.mock('@/lib/cron-health', ...)` (linhas 54-57), acrescente o mesmo bloco:

```ts
// Os passos novos têm testes próprios (test/youtube/coleta/); aqui a rota roda só com a parte antiga.
vi.mock('@/lib/youtube/coleta', () => ({
  rodarColeta: async () => ({ falhas: [], resumo: {} }),
}))
```

(É uma função simples, não `vi.fn`: o `beforeEach` do segundo arquivo chama `vi.restoreAllMocks()`.)

- [ ] **Step 2: Escrever o teste do veredito, que falha**

Create `apps/web/test/cron/sync-analytics-metrics-veredito.test.ts`:

```ts
// @vitest-environment node
// Veredito único da rota: a parte antiga e os passos novos só acumulam falhas[]; a última linha
// chama recordCronFailure UMA vez ou recordCronSuccess. Antes, o sucesso da parte antiga zerava
// a falha de qualquer passo novo.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(),
}))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn() }))
vi.mock('@/lib/cron-health', () => ({ recordCronSuccess: vi.fn(), recordCronFailure: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/analytics-sync', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/analytics-sync')>()),
  detectViral: vi.fn(() => false),
}))
vi.mock('@/lib/youtube/coleta', () => ({ rodarColeta: vi.fn() }))

import { GET, maxDuration } from '../../src/app/api/cron/sync-analytics-metrics/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import { detectViral } from '@/lib/youtube/analytics-sync'
import { rodarColeta } from '@/lib/youtube/coleta'
import { fakeSupabase, type FakeDb } from '../youtube/coleta/fake-supabase'

// Publicado há muito tempo: fica fora das janelas de marco (24h/48h/7d/30d).
const PUBLICADO = new Date(Date.now() - 400 * 86_400_000).toISOString()
const canal = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', subscriber_count: 1000, name: 'Canal Um', sync_enabled: true }
const video = { id: 'v-1', youtube_video_id: 'yt-1', channel_id: 'ch-1', site_id: 'site-1', title: 'Vídeo', view_count: 500, view_count_yesterday: 10, view_count_delta_today: 5, published_at: PUBLICADO }

function banco(): FakeDb {
  const db = fakeSupabase({ youtube_channels: [canal], youtube_videos: [video] })
  vi.mocked(getSupabaseServiceClient).mockReturnValue(db.client)
  return db
}
const pedido = () => new Request('http://localhost/api/cron/sync-analytics-metrics', { headers: { authorization: `Bearer ${CRON_SECRET}` } })
const relatorio = (rows: (string | number)[][]) => ({ ok: true, status: 200, json: async () => ({ rows }) }) as unknown as Response
const coletaLimpa = async () => ({ falhas: [] as string[], resumo: {} })
const nota = () => vi.mocked(recordCronFailure).mock.calls[0]![1] as string

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' } as never)
  vi.mocked(rodarColeta).mockImplementation(coletaLimpa)
  vi.mocked(detectViral).mockReturnValue(false)
  vi.mocked(fanOutToSiteAdmins).mockResolvedValue(1)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(relatorio([['yt-1', 120, 30, 45, 5, 2, 1, 0]])))
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sync-analytics-metrics: veredito único', () => {
  it('maxDuration é 300', () => {
    expect(maxDuration).toBe(300)
  })

  it('tudo certo: recordCronSuccess uma vez, as duas fases da coleta rodam em volta da parte antiga', async () => {
    const db = banco()
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ synced: 1, errors: 0, coleta: {}, acao_do_dono: [] })
    expect(typeof body.ms_existente).toBe('number')
    expect(body.falhas).toBeUndefined()
    expect(vi.mocked(rodarColeta).mock.calls.map(c => c[0].fase)).toEqual(['antes', 'depois'])
    expect(db.tables.youtube_video_analytics).toHaveLength(1)
    expect(recordCronSuccess).toHaveBeenCalledTimes(1)
    expect(recordCronFailure).not.toHaveBeenCalled()
  })

  it('passo novo falha e a parte antiga dá certo: recordCronFailure uma vez, recordCronSuccess nenhuma', async () => {
    banco()
    vi.mocked(rodarColeta).mockImplementation(async (ctx) =>
      ctx.fase === 'antes'
        ? { falhas: ['metadados: Canal Um tem 0 de 2 vídeos com linha em 2026-10-06'], resumo: { metadados: { gravados: 0 } } }
        : { falhas: [], resumo: {} })
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.synced).toBe(1)
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(vi.mocked(recordCronFailure).mock.calls[0]![0]).toBe('sync-analytics-metrics')
    expect(nota()).toBe('metadados: Canal Um tem 0 de 2 vídeos com linha em 2026-10-06')
    expect(recordCronSuccess).not.toHaveBeenCalled()
    expect(body.falhas).toEqual(['metadados: Canal Um tem 0 de 2 vídeos com linha em 2026-10-06'])
  })

  it('schema_ausente num passo novo: falha crítica, os demais passos rodam, a rota responde 200 e a escrita antiga não é perdida', async () => {
    const db = banco()
    vi.mocked(rodarColeta).mockImplementation(async (ctx) =>
      ctx.fase === 'antes' ? { falhas: ['schema_ausente: yt_own_video_meta_daily'], resumo: {} } : { falhas: [], resumo: { relatorios: { baixados: 0 } } })
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(rodarColeta).toHaveBeenCalledTimes(2)
    expect(db.tables.youtube_video_analytics).toHaveLength(1)
    expect(db.tables.youtube_videos![0]).toMatchObject({ view_count_delta_today: 120 })
    expect(nota()).toBe('schema_ausente: yt_own_video_meta_daily')
    expect(body.coleta).toEqual({ relatorios: { baixados: 0 } })
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('falha da parte antiga e falha de passo novo saem juntas, numa chamada só', async () => {
    banco()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('corpo ya29.SEGREDO', { status: 503 })))
    vi.mocked(rodarColeta).mockImplementation(async (ctx) =>
      ctx.fase === 'depois' ? { falhas: ['relatórios: 2 relatório(s) listado(s) há mais de 14 dias sem baixar'], resumo: {} } : { falhas: [], resumo: {} })
    const res = await GET(pedido() as never)
    expect(res.status).toBe(200)
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(nota()).toContain('Canal Um (UC1): YouTube API 503')
    expect(nota()).toContain('relatórios: 2 relatório(s) listado(s) há mais de 14 dias sem baixar')
    expect(nota()).not.toContain('SEGREDO')
  })

  it('todos os canais com relatório vazio continua sendo falha, agora pelo veredito', async () => {
    banco()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(relatorio([])))
    await GET(pedido() as never)
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(nota()).toMatch(/empty analytics report/)
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('escrita antiga em tabela ausente (42P01): schema_ausente em falhas, sem lançar', async () => {
    const db = banco()
    db.writeErrors.youtube_video_analytics = { code: '42P01', message: 'relation "youtube_video_analytics" does not exist' }
    const res = await GET(pedido() as never)
    expect(res.status).toBe(200)
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(nota()).toBe('schema_ausente: youtube_video_analytics')
  })

  it('escrita antiga com coluna ausente (PGRST204) e com outro erro de banco: as duas ficam visíveis', async () => {
    const db = banco()
    db.writeErrors.youtube_videos = { code: 'PGRST204', message: "Could not find the 'x' column" }
    db.writeErrors.youtube_video_analytics = { code: '23505', message: 'duplicate key value violates unique constraint "segredo"' }
    await GET(pedido() as never)
    expect(nota()).toBe('schema_ausente: youtube_videos; erro de banco ao gravar youtube_video_analytics')
  })

  it('leitura da rota vazia: ainda chama a coleta nas duas fases, dá o veredito e só então responde no_channels', async () => {
    const db = fakeSupabase({ youtube_channels: [{ ...canal, sync_enabled: false }] })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(db.client)
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(body.status).toBe('no_channels')
    expect(rodarColeta).toHaveBeenCalledTimes(2)
    expect(fetch).not.toHaveBeenCalled()
    expect(recordCronSuccess).toHaveBeenCalledTimes(1)
  })

  it('leitura da rota vazia e a coleta falha: no_channels com recordCronFailure', async () => {
    const db = fakeSupabase({ youtube_channels: [] })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(db.client)
    vi.mocked(rodarColeta).mockResolvedValue({ falhas: ['coleta: erro de banco ao ler os canais'], resumo: {} })
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(body.status).toBe('no_channels')
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(nota()).toBe('coleta: erro de banco ao ler os canais')
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('erro ao ler os canais: 500 e o registro antigo, fora do veredito; a coleta não roda', async () => {
    const db = fakeSupabase()
    db.errors.youtube_channels = { code: '57014', message: 'statement timeout' }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(db.client)
    const res = await GET(pedido() as never)
    expect(res.status).toBe(500)
    expect(recordCronFailure).toHaveBeenCalledWith('sync-analytics-metrics', 'database error listing the YouTube channels')
    expect(rodarColeta).not.toHaveBeenCalled()
  })

  it('rodarColeta lança: vira falha, a parte antiga roda e a rota responde 200', async () => {
    const db = banco()
    vi.mocked(rodarColeta).mockRejectedValueOnce(new Error('boom')).mockImplementation(coletaLimpa)
    const res = await GET(pedido() as never)
    expect(res.status).toBe(200)
    expect(db.tables.youtube_video_analytics).toHaveLength(1)
    expect(nota()).toBe('coleta (antes): unexpected error (Error)')
  })

  it('a parte antiga lança: vira falha e a fase depois roda', async () => {
    banco()
    vi.mocked(detectViral).mockReturnValue(true)
    vi.mocked(fanOutToSiteAdmins).mockRejectedValue(new Error('boom'))
    const res = await GET(pedido() as never)
    expect(res.status).toBe(200)
    expect(vi.mocked(rodarColeta).mock.calls.map(c => c[0].fase)).toEqual(['antes', 'depois'])
    expect(nota()).toBe('parte existente: unexpected error (Error)')
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('o fetch da parte antiga leva um sinal de timeout', async () => {
    banco()
    await GET(pedido() as never)
    const init = vi.mocked(fetch).mock.calls[0]![1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('acao_do_dono da coleta sai na resposta e não é falha', async () => {
    banco()
    vi.mocked(rodarColeta).mockImplementation(async (ctx) =>
      ctx.fase === 'antes' ? { falhas: [], resumo: { acao_do_dono: ['Canal Um: api_nao_ativada'] } } : { falhas: [], resumo: {} })
    const res = await GET(pedido() as never)
    const body = await res.json()
    expect(body.acao_do_dono).toEqual(['Canal Um: api_nao_ativada'])
    expect(recordCronSuccess).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run (de `apps/web`): `npx vitest run test/cron/sync-analytics-metrics-veredito.test.ts`
Expected: FAIL — `maxDuration é 300` recebe `120`; `rodarColeta` nunca é chamada (`expected [] to deeply equal ['antes', 'depois']`).

- [ ] **Step 4: Reescrever a rota**

Substitua o conteúdo inteiro de `apps/web/src/app/api/cron/sync-analytics-metrics/route.ts` por:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken, NoActiveConnectionError } from '@/lib/social/token-refresh'
import { detectViral, getIsoWeek } from '@/lib/youtube/analytics-sync'
import { buildNotification } from '@/lib/youtube/notification-service'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { detectFatigue, filterFatigueCandidates } from '@/lib/youtube/ab-fatigue'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import { channelNote, describeCronCause, joinNotes, describeHttpCause } from '@/lib/cron/failure-note'
import { SYNC_WINDOW_DAYS } from '@/lib/youtube/analytics-window'
import { rodarColeta } from '@/lib/youtube/coleta'
import { criarRelogio, FETCH_TIMEOUT_MS, type Relogio } from '@/lib/youtube/coleta/clock'
import { conferirBanco } from '@/lib/youtube/coleta/schema'
import * as Sentry from '@sentry/nextjs'

const YT_ANALYTICS_BASE = 'https://youtubeanalytics.googleapis.com/v2/reports'

// dimensions=video + sort=-views means each row is one distinct video. A wider window pulls
// in more distinct videos than a 2-day window ever could, and 50 risked silently truncating
// the lower-ranked ones (no error, just missing rows). 200 covers channels with a few hundred
// videos in the window; if a channel exceeds that, the truncation check below flags it.
const MAX_RESULTS = 200

function channelLabel(channel: { name?: string | null; channel_id: string }): string {
  return channel.name ? `${channel.name} (${channel.channel_id})` : channel.channel_id
}

export const dynamic = 'force-dynamic'
// Relógio global da coleta: 270 s (lib/youtube/coleta/clock.ts). Os 30 s de folga são do veredito e da resposta.
export const maxDuration = 300

type Supabase = ReturnType<typeof getSupabaseServiceClient>

interface ChannelRow {
  id: string
  channel_id: string
  site_id: string
  subscriber_count: number | null
  name: string | null
}

interface ParteAntiga {
  synced: number
  errors: number
  emptyReports: number
  skippedNoConnection: number
  notifications: number
  fatigueAlerts: number
  errorDetails: string[]
}

/**
 * O que o cron já fazia antes da coleta dos canais próprios: analytics por janela, marcos de
 * views, avisos e fadiga. O laço não foi refatorado; mudou só: (a) os fetch levam timeout;
 * (b) toda escrita confere `error` e registra em `falhas`; (c) não chama mais recordCron*.
 */
async function parteAntiga(supabase: Supabase, channels: ChannelRow[], falhas: string[]): Promise<ParteAntiga> {
  let synced = 0
  let errors = 0
  let emptyReports = 0
  // Canal cadastrado mas sem conexão OAuth viva (recém-cadastrado, ou conexão revogada): é
  // estado legítimo, não falha. Pula, conta e avisa o dono; os demais canais seguem.
  const skippedNoConnection: Array<{ channelId: string; siteId: string; label: string }> = []
  const errorDetails: string[] = []
  const notifications: Array<{ siteId: string; payload: ReturnType<typeof buildNotification> }> = []
  const processedVideos: Array<{ id: string; published_at: string | null; view_count: number }> = []

  for (const channel of channels) {
    try {
      const { accessToken } = await ensureFreshToken(channel.site_id, 'youtube', channel.channel_id)

      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - SYNC_WINDOW_DAYS)

      const endStr = end.toISOString().split('T')[0]!
      const startStr = start.toISOString().split('T')[0]!

      const url = new URL(YT_ANALYTICS_BASE)
      url.searchParams.set('ids', `channel==${channel.channel_id}`)
      url.searchParams.set('startDate', startStr)
      url.searchParams.set('endDate', endStr)
      // impressions/impressionClickThroughRate are NOT available in YouTube Analytics API v2
      // — the API returns "Unknown identifier". Per-video impression data is only available
      // through YouTube Studio (internal). We sync what's available: views, watch time, engagement.
      url.searchParams.set('metrics', 'views,estimatedMinutesWatched,averageViewDuration,likes,comments,shares,subscribersGained')
      url.searchParams.set('dimensions', 'video')
      url.searchParams.set('sort', '-views')
      url.searchParams.set('maxResults', String(MAX_RESULTS))

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })

      if (!res.ok) {
        Sentry.captureMessage(`sync-analytics-metrics failed for channel ${channel.channel_id}: ${res.status}`)
        // O corpo do Google não é lido nem gravado: a nota leva só o status.
        errorDetails.push(channelNote(channelLabel(channel), describeHttpCause(res.status)))
        errors++
        continue
      }

      const report = await res.json() as { rows?: (string | number)[][] }

      if (report.rows?.length === MAX_RESULTS) {
        Sentry.captureMessage(
          `sync-analytics-metrics: channel ${channel.channel_id} hit maxResults=${MAX_RESULTS} — report may be truncated`,
        )
      }

      // A report with zero rows is NOT a sync — it means no video had reportable activity in
      // the window (or, before SYNC_WINDOW_DAYS was widened, that the window was too tight).
      // Counting it as `synced` is exactly what let this cron report errors:0 every day while
      // youtube_video_analytics stayed empty, with no signal anywhere that it was wrong.
      if (!report.rows?.length) { emptyReports++; continue }

      const { data: videos } = await supabase
        .from('youtube_videos')
        .select('id, youtube_video_id, title, view_count, view_count_yesterday, view_count_delta_today, published_at')
        .eq('channel_id', channel.id)

      const videoMap = new Map((videos ?? []).map(v => [v.youtube_video_id, v]))

      const channelTotalDelta = (videos ?? []).reduce((s, v) => s + (v.view_count_delta_today ?? 0), 0)
      const channelAvg48h = (videos ?? []).length > 0
        ? (channelTotalDelta + (videos ?? []).reduce((s, v) => s + (v.view_count_yesterday ?? 0), 0)) / (videos ?? []).length
        : 0

      const today = new Date().toISOString().split('T')[0]!

      for (const row of report.rows) {
        const videoExternalId = String(row[0])
        const dbVideo = videoMap.get(videoExternalId)
        if (!dbVideo) continue

        const views = Number(row[1])
        const avgDuration = Number(row[3])
        const likes = Number(row[4])
        const comments = Number(row[5])
        const shares = Number(row[6])
        const subsGained = Number(row[7])

        const previousPeriod = dbVideo.view_count_delta_today ?? 0

        const gravouVideo = await supabase.from('youtube_videos').update({
          avg_view_duration_seconds: avgDuration,
          view_count_delta_today: views,
          view_count_yesterday: previousPeriod,
          last_analytics_sync_at: new Date().toISOString(),
        }).eq('id', dbVideo.id)
        conferirBanco(gravouVideo, 'youtube_videos', falhas)

        const gravouAnalytics = await supabase.from('youtube_video_analytics').upsert({
          youtube_video_id: dbVideo.id,
          site_id: channel.site_id,
          date: today,
          views,
          avg_view_duration_seconds: avgDuration,
          likes,
          comments,
          shares,
          subscribers_gained: subsGained,
        }, { onConflict: 'youtube_video_id,date' })
        conferirBanco(gravouAnalytics, 'youtube_video_analytics', falhas)

        if (detectViral(views, previousPeriod, channelAvg48h)) {
          notifications.push({
            siteId: channel.site_id,
            payload: buildNotification({
              type: 'trending_viral',
              videoId: dbVideo.id,
              videoTitle: dbVideo.title ?? 'Video',
              views48h: views + previousPeriod,
              channelAvg48h,
              weekIso: getIsoWeek(new Date()),
            }),
          })
        }

        processedVideos.push({
          id: dbVideo.id,
          published_at: dbVideo.published_at ?? null,
          view_count: dbVideo.view_count ?? 0,
        })
      }

      synced++
    } catch (e) {
      if (e instanceof NoActiveConnectionError) {
        skippedNoConnection.push({
          channelId: channel.channel_id,
          siteId: channel.site_id,
          label: channelLabel(channel),
        })
        continue
      }
      Sentry.captureException(e, { extra: { channelId: channel.channel_id } })
      errorDetails.push(channelNote(channelLabel(channel), describeCronCause(e)))
      errors++
    }
  }

  // Milestone view snapshots — capture view_count at key ages
  const milestones = [
    { column: 'views_at_24h', minAge: 24, maxAge: 48 },
    { column: 'views_at_48h', minAge: 48, maxAge: 72 },
    { column: 'views_at_7d', minAge: 168, maxAge: 192 },
    { column: 'views_at_30d', minAge: 720, maxAge: 744 },
  ] as const

  for (const video of processedVideos) {
    if (!video.published_at) continue
    const ageHours = (Date.now() - new Date(video.published_at).getTime()) / 3_600_000

    for (const ms of milestones) {
      if (ageHours >= ms.minAge && ageHours < ms.maxAge) {
        const { data: existing } = await supabase
          .from('youtube_video_analytics')
          .select(ms.column)
          .eq('youtube_video_id', video.id)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existing && !(existing as Record<string, unknown>)[ms.column]) {
          const today = new Date().toISOString().slice(0, 10)
          const gravouMarco = await supabase
            .from('youtube_video_analytics')
            .update({ [ms.column]: video.view_count })
            .eq('youtube_video_id', video.id)
            .eq('date', today)
          conferirBanco(gravouMarco, 'youtube_video_analytics', falhas)
        }
      }
    }
  }

  for (const { siteId, payload } of notifications) {
    await fanOutToSiteAdmins({
      siteId,
      domain: 'youtube',
      type: `youtube.${payload.type}`,
      priority: payload.priority,
      title: payload.title,
      message: payload.message,
      dedupKey: payload.dedup_key,
      payload: {
        ...(payload.video_id ? { videoId: payload.video_id } : {}),
      },
      suggestedAction: payload.suggested_action,
      actionHref: payload.action_href,
    })
  }

  // O pulo precisa ser VISTO: um aviso por site e por dia (dedup), não um alarme de cron.
  const skippedBySite = new Map<string, string[]>()
  for (const k of skippedNoConnection) {
    skippedBySite.set(k.siteId, [...(skippedBySite.get(k.siteId) ?? []), k.label])
  }
  for (const [siteId, channelIds] of skippedBySite) {
    try {
      await fanOutToSiteAdmins({
        siteId,
        domain: 'youtube',
        type: 'youtube.channel_skipped_no_connection',
        priority: 2,
        title: 'Canal do YouTube sem conexão',
        message: `${channelIds.length} canal(is) sem conexão OAuth ficaram de fora da sincronização de analytics: ${channelIds.join(', ')}. Conecte o acesso do canal em /cms/youtube.`,
        dedupKey: `channel-skipped-no-connection-${siteId}-${new Date().toISOString().slice(0, 10)}`,
        actionHref: '/cms/youtube',
      })
    } catch (e) {
      Sentry.captureException(e)
    }
  }

  // Phase 3: Fatigue detection (once per site, after all channels processed)
  let fatigueAlerts = 0
  const siteIds = [...new Set(channels.map(c => c.site_id))]

  for (const siteId of siteIds) {
    try {
      const { data: allVideos } = await supabase
        .from('youtube_videos')
        .select('id, published_at, view_count')
        .eq('site_id', siteId)
        .not('published_at', 'is', null)

      const { data: activeTestVideos } = await supabase
        .from('ab_tests')
        .select('youtube_video_id')
        .eq('site_id', siteId)
        .in('status', ['active', 'draft', 'paused', 'queued'])

      const activeVideoIds = new Set((activeTestVideos ?? []).map(t => t.youtube_video_id))
      const candidates = filterFatigueCandidates(allVideos ?? [], activeVideoIds)

      for (const candidate of candidates) {
        const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
        const { data: metrics } = await supabase
          .from('youtube_video_analytics')
          .select('date, views')
          .eq('youtube_video_id', candidate.id)
          .gte('date', sixtyDaysAgo)
          .order('date', { ascending: true })

        if (!metrics?.length) continue

        const result = detectFatigue(
          metrics.map(m => ({ date: m.date as string, views: (m.views as number | null) ?? 0 })),
          candidate.published_at,
        )

        if (result?.isFatigued) {
          const { data: existing } = await supabase
            .from('youtube_fatigue_alerts')
            .select('id')
            .eq('video_id', candidate.id)
            .eq('status', 'pending')
            .limit(1)
            .maybeSingle()

          if (!existing) {
            const gravouAlerta = await supabase.from('youtube_fatigue_alerts').insert({
              video_id: candidate.id,
              site_id: siteId,
              z_score: result.zScore,
              expected_ctr: result.expectedViews,
              actual_ctr: result.actualViews,
            })
            if (conferirBanco(gravouAlerta, 'youtube_fatigue_alerts', falhas) === 'ok') fatigueAlerts++
          }
        }
      }
    } catch (e) {
      Sentry.captureException(e)
    }
  }

  return {
    synced,
    errors,
    emptyReports,
    skippedNoConnection: skippedNoConnection.length,
    notifications: notifications.length,
    fatigueAlerts,
    errorDetails,
  }
}

/** Uma fase dos passos novos. Nunca lança: exceção vira item de falhas[]. */
async function coletar(
  supabase: Supabase,
  relogio: Relogio,
  fase: 'antes' | 'depois',
  falhas: string[],
): Promise<Record<string, unknown>> {
  try {
    const r = await rodarColeta({ supabase, relogio, fase })
    falhas.push(...r.falhas)
    return r.resumo
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', fase } })
    falhas.push(`coleta (${fase}): ${describeCronCause(e)}`)
    return {}
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const relogio = criarRelogio()
  const supabase = getSupabaseServiceClient()

  const { data: channels, error: channelsError } = await supabase
    .from('youtube_channels')
    .select('id, channel_id, site_id, subscriber_count, name')
    .eq('sync_enabled', true)

  // A dropped query error used to fall through to `channels === null` →
  // `channels.length === 0` → recordCronSuccess + HTTP 200 — the system
  // ASSERTING it's healthy about a DB error it never looked at. Distinguish
  // "the query failed" from "the query genuinely returned zero rows".
  // É o único registro fora do veredito: nenhum passo rodou.
  if (channelsError) {
    Sentry.captureMessage(`sync-analytics-metrics: channels query failed: ${channelsError.message}`)
    // O texto do Postgres fica só no Sentry (acima); a nota gravada e a resposta são legíveis e sem ele.
    await recordCronFailure('sync-analytics-metrics', 'database error listing the YouTube channels')
    return NextResponse.json({ error: 'channels query failed' }, { status: 500 })
  }

  const lista = (channels ?? []) as ChannelRow[]

  // A parte antiga e os passos novos só ACUMULAM falhas; o veredito é um só, na última linha.
  // Ordem: metadados → 1A → o que o cron já fazia → 1C.
  const falhas: string[] = []

  const coletaAntes = await coletar(supabase, relogio, 'antes', falhas)

  let antiga: ParteAntiga | null = null
  let msExistente = 0
  if (lista.length > 0) {
    const inicio = Date.now()
    try {
      antiga = await parteAntiga(supabase, lista, falhas)
      const comConexao = lista.length - antiga.skippedNoConnection
      if (antiga.errors > 0) {
        falhas.push(joinNotes(antiga.errorDetails))
      } else if (comConexao > 0 && antiga.emptyReports === comConexao) {
        // Every channel came back with zero rows for the window. One channel alone doing this is
        // legitimate (e.g. a brand-new channel with nothing published yet), but ALL of them at
        // once — with no HTTP error — is the same silent-failure shape this fix closes: a scope
        // loss, a window regression, or an API contract change that a naive errors:0 check would
        // never catch. Do not call this success.
        falhas.push(`all ${comConexao} channel(s) returned an empty analytics report for the ${SYNC_WINDOW_DAYS}-day window`)
      }
    } catch (e) {
      Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', fase: 'existente' } })
      falhas.push(`parte existente: ${describeCronCause(e)}`)
    }
    msExistente = Date.now() - inicio
  }

  const coletaDepois = await coletar(supabase, relogio, 'depois', falhas)

  // Veredito único.
  if (falhas.length > 0) {
    await recordCronFailure('sync-analytics-metrics', joinNotes(falhas))
  } else {
    await recordCronSuccess('sync-analytics-metrics')
  }

  const { acao_do_dono: acaoDoDono, ...resumoAntes } = coletaAntes as { acao_do_dono?: unknown } & Record<string, unknown>
  const extras = {
    ms_existente: msExistente,
    coleta: { ...resumoAntes, ...coletaDepois },
    acao_do_dono: Array.isArray(acaoDoDono) ? acaoDoDono : [],
    ...(falhas.length > 0 && { falhas }),
  }

  if (lista.length === 0) {
    return NextResponse.json({ status: 'no_channels', ...extras })
  }

  return NextResponse.json({
    synced: antiga?.synced ?? 0,
    errors: antiga?.errors ?? 0,
    emptyReports: antiga?.emptyReports ?? 0,
    skipped_no_connection: antiga?.skippedNoConnection ?? 0,
    notifications: antiga?.notifications ?? 0,
    fatigueAlerts: antiga?.fatigueAlerts ?? 0,
    ...(antiga && antiga.errorDetails.length > 0 && { errorDetails: antiga.errorDetails }),
    ...extras,
  })
}
```

- [ ] **Step 5: Rodar o teste novo e os dois antigos**

Run (de `apps/web`): `npx vitest run test/cron/sync-analytics-metrics-veredito.test.ts test/cron/sync-analytics-metrics.test.ts test/api/cron/sync-analytics-metrics.test.ts`
Expected: PASS nos três arquivos (15 testes no novo; os dois antigos com a mesma contagem de antes, todos verdes).

Se algum teste antigo falhar, **não** afrouxe a asserção: compare o comportamento com o mapeamento da tabela desta tarefa. A única diferença admitida nos testes antigos é o `vi.mock` do Step 1.

- [ ] **Step 6: Conferir que nada mais dependia do formato antigo**

Run (raiz):

```bash
grep -rn "sync-analytics-metrics" apps/web/src apps/web/test apps/web/vercel.json --include=*.ts --include=*.tsx --include=*.json -l
```

Expected: a rota, os três testes, `apps/web/vercel.json` (agenda `0 12 * * *`, inalterada) e os arquivos que só citam o nome do cron (health, watchdog, registros). Abra cada arquivo de `src` que não seja a rota e confirme que ele lê `cron_health` ou o nome do cron, não o corpo da resposta. Se algum ler campos da resposta (`synced`, `errors`...), eles continuam existindo; anote no ledger.

- [ ] **Step 7: Typecheck e commit**

Run (de `apps/web`): `npx tsc --noEmit`
Expected: 0 erros.

```bash
git add apps/web/src/app/api/cron/sync-analytics-metrics/route.ts apps/web/test/cron/sync-analytics-metrics-veredito.test.ts apps/web/test/cron/sync-analytics-metrics.test.ts apps/web/test/api/cron/sync-analytics-metrics.test.ts
git commit -m "feat: veredito único no cron de analytics, com a coleta dos canais próprios em volta da parte antiga (300 s, timeouts e escritas conferidas)" -- apps/web/src/app/api/cron/sync-analytics-metrics/route.ts apps/web/test/cron/sync-analytics-metrics-veredito.test.ts apps/web/test/cron/sync-analytics-metrics.test.ts apps/web/test/api/cron/sync-analytics-metrics.test.ts
```

---

### Task 15: Runbook

**Files:**
- Create: `docs/ops/youtube-coleta-canais-proprios-runbook.md`

**Interfaces:**
- Consumes: os nomes de tabela, função, estado e constante definidos nas Tasks 2, 8, 10, 11, 13 e 14.
- Produces: o runbook que o ledger e os próximos lotes passam a citar.

- [ ] **Step 1: Escrever o runbook**

Create `docs/ops/youtube-coleta-canais-proprios-runbook.md`:

````markdown
# Coleta dos canais próprios do YouTube — runbook

Lote L1a em produção desde __/__/2026 (preencher). Spec: `docs/superpowers/specs/2026-10-07-coleta-canais-proprios-design.md`.
Plano: `docs/superpowers/plans/2026-10-07-coleta-l1a-plan.md`. Ledger: `.superpowers/sdd/2026-10-07-coleta-l1a-plan/progress.md`.

Tudo roda dentro do cron `sync-analytics-metrics` (12:00 UTC, uma vez por dia). Não há cron novo nem variável de ambiente nova.

**Este sistema falha em verde.** Um passo que não grava nada por falta de dado termina sem erro. Ao investigar, olhe primeiro se a linha existe, depois se houve erro.

## 1. O que o L1a coleta

| O quê | Onde fica | Volta se perder? |
|---|---|---|
| Título, thumbnail e variante de A/B no ar em cada dia, por vídeo | `yt_own_video_meta_daily` (uma linha por vídeo por dia do Pacífico) | Não |
| Relatórios em lote da Reporting API (impressões, CTR, tráfego), como CSV bruto | `yt_reporting_reports` + `yt_reporting_report_blobs` | Não: o histórico inicial some em 30 dias |
| Jobs da Reporting API por canal e tipo | `yt_reporting_jobs` | Sim, mas a contagem recomeça do zero |
| O que foi tentado e o que aconteceu | `yt_own_collection_attempts` | — |

Ainda **não** existe em L1a: `privacy_status`, `is_short`, o estado `reautorizar`, a normalização do alcance, o diário por vídeo, a retenção.

## 2. Ler a resposta do cron

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/cron/sync-analytics-metrics
```

Rodar à mão é seguro: todos os passos são idempotentes no dia (a segunda execução sobrescreve e soma `attempts`).

| Campo | O que diz |
|---|---|
| `synced`, `errors`, `emptyReports`, `skipped_no_connection` | a parte antiga (analytics por janela), como sempre |
| `ms_existente` | quanto a parte antiga levou. O relógio global é de 270 s |
| `coleta.metadados` | `gravados`, `tentativas` por resultado, `pendentes`, `day_pt`, `dias_sem_meta` por canal |
| `coleta.jobs` | `estados` por canal e tipo, `tipo_indisponivel`, `acao_do_dono` |
| `coleta.relatorios` | `vistos`, `baixados`, `vazios`, `expirados`, `erros_download`, `pendentes`, `bruto_apagado`, `perdidos`, `atrasados` |
| `acao_do_dono` | o que só você resolve (seção 4). **Não** deixa o `/api/health` degradado |
| `falhas` | o que deixou o cron vermelho. Presente só quando há falha |

`pendentes` em `relatorios` é normal nos primeiros dias: são no máximo 40 downloads por execução e a fila inicial tem cerca de 240.

## 3. Ler as tabelas

Todos os comandos são de leitura.

```bash
# Estado dos jobs, por canal e tipo
npx supabase db query --linked "select c.name, j.report_type_id, j.status, j.job_id is not null as tem_job, j.job_create_time, j.last_listed_at, j.error from yt_reporting_jobs j join youtube_channels c on c.id = j.channel_id order by 1, 2 limit 100"

# Relatórios por estado
npx supabase db query --linked "select c.name, r.report_type_id, r.status, count(*), min(r.create_time), max(r.create_time) from yt_reporting_reports r join youtube_channels c on c.id = r.channel_id group by 1, 2, 3 order by 1, 2, 3 limit 100"

# Tamanho do bruto guardado (nunca faça select * em yt_reporting_report_blobs)
npx supabase db query --linked "select count(*), pg_size_pretty(coalesce(sum(octet_length(csv_gz)), 0)::bigint) as tamanho from yt_reporting_report_blobs"

# Linhas de metadados por dia
npx supabase db query --linked "select day_pt, count(*) as linhas, count(thumbnail_dhash) as com_thumbnail, count(ab_test_id) as com_teste, count(ab_variant_id) as com_variante from yt_own_video_meta_daily group by 1 order by 1 desc limit 14"

# Tentativas dos últimos dias
npx supabase db query --linked "select attempt_day, kind, outcome, count(*), sum(attempts) as execucoes from yt_own_collection_attempts group by 1, 2, 3 order by 1 desc, 2, 3 limit 80"

# Saúde do cron
npx supabase db query --linked "select last_success_at, last_failure_at, consecutive_failures, last_error from cron_health where cron_name = 'sync-analytics-metrics' limit 1"
```

Como ler `yt_own_collection_attempts`: sem linha = nunca tentado; linha com resultado diferente de `ok` = tentado e sem dado. `attempt_day` é a data **UTC** da execução; `day_pt` é o dia do **Pacífico**. Nunca junte um ao outro.

| `outcome` | Significa |
|---|---|
| `ok` | gravou |
| `sem_conexao` | o canal não tem conexão OAuth viva (ou ela foi revogada). Em L1a os dois casos caem aqui |
| `erro_http` | a chamada falhou. `http_status` nulo = timeout de 15 s ou erro de banco (`error` diz qual) |
| `nao_alcancado_orcamento` | o relógio acabou antes. Três vezes seguidas no mesmo escopo vira falha |
| `schema_ausente` | a migration não está aplicada em produção |

## 4. Ação do dono

### `api_nao_ativada`
A YouTube Reporting API não está ativada no projeto do Google Cloud usado pelo OAuth do site. É uma API **separada** da YouTube Analytics API.
1. Google Cloud Console → o projeto do OAuth → APIs e serviços → Biblioteca → "YouTube Reporting API" → Ativar.
2. Não precisa reconectar o canal. A execução seguinte do cron tenta de novo, cria os jobs e manda o aviso "A coleta do canal … voltou ao normal".

### `sem_acesso`
O Google recusou o token do canal na Reporting API (401, ou 403 `insufficientPermissions`). O escopo necessário é `https://www.googleapis.com/auth/yt-analytics.readonly`.
1. Em `/cms/youtube`, reconecte o canal.
2. A execução seguinte tenta de novo sozinha.

### `tipo_indisponivel`
O YouTube não oferece aquele tipo de relatório para o canal. Você recebe um aviso, uma vez. Não há o que fazer; o estado fica visível em `coleta.jobs.tipo_indisponivel`. Anote no ledger quais tipos faltam.

### Reconectar um canal
Em L1a não existe o estado `reautorizar`: um canal com a conexão revogada é só pulado nos passos que usam token (tentativa `sem_conexao`) e a parte antiga manda o aviso "Canal do YouTube sem conexão". O passo de metadados continua rodando para ele, porque não usa token. Reconecte em `/cms/youtube`; a execução seguinte volta a coletar.

## 5. Falhas críticas (`falhas`)

| Nota | Causa provável | O que fazer |
|---|---|---|
| `schema_ausente: <tabela>` | código em produção sem a migration | `npm run db:push:prod` |
| `metadados: <canal> tem X de Y vídeos com linha em <dia>` | escrita recusada ou exceção por vídeo | ver `attempt_day` de hoje, `kind = 'meta'`, `outcome <> 'ok'` |
| `metadados: <canal> ficou N dia(s) sem linha antes de <dia>` | o cron não rodou ou não gravou por N dias. **Esse dado não volta** | anotar no ledger os dias perdidos |
| `metadados: thumbnail falhou em metade ou mais …` | `i.ytimg.com` ou o Vercel Blob fora do ar | conferir `BLOB_READ_WRITE_TOKEN`; ver `error` das tentativas `thumbnail` |
| `relatórios: … expirado sem baixar` | o relatório passou de 60 dias (30 se backfill), ou o download devolveu 404/410 | nada: sai sozinho em 14 dias e vira `perdidos` |
| `relatórios: N relatório(s) listado(s) há mais de 14 dias sem baixar` | downloads falhando todo dia | ver tentativas `relatorio` de escopo `job` com `erro_http` |
| `relatórios: <canal> está sem relatório novo de <tipo> há mais de 6 dias` | o Google parou de gerar; job removido do lado dele | ver `yt_reporting_jobs`; se preciso, seção 8 (recriar o job) |
| `jobs: <canal> está com o job <tipo> em erro há 3 dias` | erro persistente na Reporting API | ver `yt_reporting_jobs.error` |
| `orçamento: N escopo(s) de <kind> sem alcançar …` | o relógio de 270 s não está dando | ver `ms_existente`; se a parte antiga cresceu, seção 9 |
| `aviso … : sem_destinatario` | o site não tem `org_admin` na organização raiz | cadastrar o dono |
| `parte existente: …` / `coleta (antes|depois): …` | exceção não prevista | Sentry, tag `cron: sync-analytics-metrics` |

## 6. Exportar um CSV do bruto para fixture (pré-requisito do L2)

O L2 só começa depois de existir um CSV **real** de cada tipo de alcance em `apps/web/test/fixtures/yt-reporting/`.

```bash
# 1. Escolha um relatório baixado
npx supabase db query --linked "select report_id, report_type_id, row_count, bytes, start_time from yt_reporting_reports where status = 'baixado' and report_type_id in ('channel_reach_basic_a1', 'channel_reach_combined_a1') order by row_count desc limit 10"

# 2. Exporte (troque <REPORT_ID> e <TIPO>)
mkdir -p apps/web/test/fixtures/yt-reporting
npx supabase db query --linked "select encode(csv_gz, 'base64') as b64 from yt_reporting_report_blobs where report_id = '<REPORT_ID>' limit 1" > /tmp/yt-blob.json
node -e "const s=require('fs').readFileSync('/tmp/yt-blob.json','utf8');const j=JSON.parse(s.slice(s.indexOf('{'),s.lastIndexOf('}')+1));process.stdout.write(require('zlib').gunzipSync(Buffer.from(j.rows[0].b64,'base64')))" > apps/web/test/fixtures/yt-reporting/<TIPO>.csv
head -3 apps/web/test/fixtures/yt-reporting/<TIPO>.csv
```

Confira o cabeçalho e **anote aqui** as colunas e a unidade do CTR (0–1 ou 0–100):

- `channel_reach_basic_a1`: colunas = (preencher) · unidade do CTR = (preencher)
- `channel_reach_combined_a1`: colunas = (preencher)

O CSV traz ids de vídeo e números do próprio canal; não traz dado pessoal. Pode ser commitado.

## 7. Re-normalizar um relatório

Não existe em L1a. Entra em L2, junto com o normalizador do alcance básico.

## 8. Recriar um job

O passo 1A recria sozinho: quando `reports.list` devolve 404, o job vira `erro` e a execução seguinte chama `jobs.create`. Para forçar (só o dono; é escrita em produção), no SQL Editor do Supabase:

```sql
update yt_reporting_jobs set status = 'erro', error = 'recriar (manual)' where channel_id = '<UUID_DO_CANAL>' and report_type_id = '<TIPO>';
```

Um job novo começa a contar do zero: impressões e CTR anteriores à criação só existem nos 30 dias de backfill que o Google gera.

## 9. Desligar um passo ou um tipo

Não há variável de ambiente. É um commit de uma linha, seguido de deploy:

- **Um passo:** `apps/web/src/lib/youtube/coleta/index.ts`, constante `PASSOS_LIGADOS` (`metadados`, `jobs`, `relatorios`) → `false`.
- **Um tipo de relatório:** `apps/web/src/lib/youtube/reporting/types.ts`, tirar a linha de `REPORT_TYPES_ENABLED`. O job continua existindo do lado do Google; a linha em `yt_reporting_jobs` vira `desativado` na sondagem seguinte e o tipo sai da fila de download.
- **Habilitar um tipo:** acrescentar a linha em `REPORT_TYPES_ENABLED`. A posição na lista é a prioridade de download.

Desligar `metadados` custa caro: cada dia sem linha não volta.

## 10. Apagar a série de um canal

Passo manual, só do dono, e sem volta. Antes, exporte (seção 11). No SQL Editor do Supabase, um por linha:

```sql
delete from yt_reporting_report_blobs where report_id in (select report_id from yt_reporting_reports where channel_id = '<UUID_DO_CANAL>');
delete from yt_reporting_reports where channel_id = '<UUID_DO_CANAL>';
delete from yt_reporting_jobs where channel_id = '<UUID_DO_CANAL>';
delete from yt_own_video_meta_daily where channel_id = '<UUID_DO_CANAL>';
delete from yt_own_collection_attempts where channel_id = '<UUID_DO_CANAL>';
```

Em L1a o `channel_id` destas tabelas não é chave estrangeira: remover o canal pela tela **não** apaga nem bloqueia nada, e as linhas ficam órfãs. A partir do L1b a remoção passa a responder "Este canal tem série coletada".

## 11. Rollback do L1a

Na ordem:

1. **Exportar o que não volta.** Com a connection string de produção (Supabase Dashboard → Project Settings → Database):

   ```bash
   psql "$PROD_DB_URL" -c "\copy (select * from yt_own_video_meta_daily) to 'yt_own_video_meta_daily.csv' csv header"
   psql "$PROD_DB_URL" -c "\copy (select r.*, encode(b.csv_gz, 'base64') as csv_gz_b64 from yt_reporting_reports r left join yt_reporting_report_blobs b using (report_id)) to 'yt_reporting_reports.csv' csv header"
   psql "$PROD_DB_URL" -c "\copy (select * from yt_reporting_jobs) to 'yt_reporting_jobs.csv' csv header"
   ```

2. **Apagar os jobs do lado do Google** (`jobs.delete` por job criado). Com um access token do canal (OAuth Playground, escopo `yt-analytics.readonly`), um por job de `yt_reporting_jobs.csv`:

   ```bash
   curl -X DELETE -H "Authorization: Bearer $ACCESS_TOKEN" "https://youtubereporting.googleapis.com/v1/jobs/<JOB_ID>"
   ```

3. **Reverter o código:** `git revert` dos commits de código do L1a (lista no ledger), do mais novo para o mais velho; push; promoção.

4. **Apagar as tabelas:** `npm run db:new coleta_canais_proprios_l1a_rollback`, com este conteúdo, e `npm run db:push:prod`:

   ```sql
   drop function if exists public.yt_reporting_blobs_purge(text[]);
   drop function if exists public.yt_own_attempt_record(uuid, text, text, text, text, integer, text, uuid);
   drop table if exists public.yt_reporting_report_blobs;
   drop table if exists public.yt_reporting_reports;
   drop table if exists public.yt_reporting_jobs;
   drop table if exists public.yt_own_video_meta_daily;
   drop table if exists public.yt_own_collection_attempts;
   ```

A ordem 3 → 4 importa só para não ficar vermelho: se a tabela sumir com o código no ar, o cron registra `schema_ausente` e a parte antiga continua funcionando.
````

- [ ] **Step 2: Conferir os nomes contra o código**

Run (raiz):

```bash
grep -n "PASSOS_LIGADOS" apps/web/src/lib/youtube/coleta/index.ts
grep -n "REPORT_TYPES_ENABLED = " apps/web/src/lib/youtube/reporting/types.ts
grep -c "yt_reporting_jobs\|yt_reporting_reports\|yt_reporting_report_blobs\|yt_own_video_meta_daily\|yt_own_collection_attempts" docs/ops/youtube-coleta-canais-proprios-runbook.md
```

Expected: uma linha para cada um dos dois primeiros; o terceiro devolve um número maior que 15. Confira também que cada nota da tabela da seção 5 do runbook existe, com o mesmo começo, em algum `pushUnico(` ou `falhas.push(` de `apps/web/src/lib/youtube/coleta/` ou da rota:

```bash
grep -rhn "pushUnico(\|falhas.push(" apps/web/src/lib/youtube/coleta apps/web/src/app/api/cron/sync-analytics-metrics/route.ts | grep -o "\`[^\`]*\`\|'[^']*'" | sort -u
```

- [ ] **Step 3: Commit**

```bash
git add docs/ops/youtube-coleta-canais-proprios-runbook.md
git commit -m "docs: runbook da coleta dos canais próprios do YouTube (lote L1a)" -- docs/ops/youtube-coleta-canais-proprios-runbook.md
```

---

### Task 16: Suíte inteira, push 2 e promoção

**Files:** nenhum arquivo novo. Atualiza o ledger (não commitado).

**Interfaces:**
- Consumes: todos os commits das Tasks 3 a 15; a confirmação do dono pedida na Task 2, Step 11.
- Produces: o código do L1a em `staging` e, depois da promoção do dono, em `main`.

- [ ] **Step 1: Conferir que só os arquivos do plano mudaram**

Run (raiz):

```bash
git status --short
git log --oneline origin/staging..HEAD
git diff --stat origin/staging..HEAD
```

Expected: em `git status`, só os arquivos que já estavam sujos antes do plano (`apps/web/next-env.d.ts`, `apps/web/tsconfig.json`, pastas de mockups e specs não rastreadas). Em `git diff --stat`, só caminhos da seção "File Structure". Se aparecer outro arquivo de código, ele é de outro terminal: não mexa, e siga.

- [ ] **Step 2: Suíte inteira**

Run (de `apps/web`): `npx vitest run`
Expected: 0 falhas (~160 s). Anote no ledger o número de arquivos e de testes.

- [ ] **Step 3: Teste de schema contra o banco local, mais uma vez**

Run (raiz): `npm run db:start`
Run (de `apps/web`): `HAS_LOCAL_DB=1 npx vitest run test/integration/coleta-l1a-migration.test.ts`
Expected: PASS, 7 testes.

- [ ] **Step 4: Typecheck dos dois apps**

Run (de `apps/web`): `npx tsc --noEmit`
Run (de `apps/api`): `npx tsc --noEmit`
Expected: 0 erros nos dois.

- [ ] **Step 5: Conferir que a migration está em produção antes de qualquer promoção**

Run (raiz):

```bash
npx supabase db query --linked "select table_name from information_schema.tables where table_schema = 'public' and (table_name like 'yt_reporting_%' or table_name like 'yt_own_%') order by 1 limit 20"
npx supabase db query --linked "select proname from pg_proc where proname in ('yt_own_attempt_record', 'yt_reporting_blobs_purge') order by 1 limit 5"
```

Expected: cinco tabelas e duas funções. **Se faltar alguma, PARAR:** o dono ainda não aplicou a migration (Task 2, Step 11). O push para `staging` pode acontecer (o cron só roda em produção), mas a promoção para `main` não.

- [ ] **Step 6: Push 2**

Run (raiz): `git push origin staging`

Preencha no ledger a seção "Commits (staging)" com `git log --oneline origin/main..origin/staging -- apps/web/src/lib/youtube/coleta apps/web/src/lib/youtube/reporting apps/web/src/app/api/cron/sync-analytics-metrics supabase/migrations docs/ops/youtube-coleta-canais-proprios-runbook.md`.

- [ ] **Step 7: Esperar o Vercel e a CI de `staging`**

Run (raiz): `gh run list --branch staging --limit 3`
Expected: o workflow `ci.yml` do último commit em `completed` / `success`. Se falhar, diagnostique localmente antes de qualquer novo push (um push só, com a correção verificada).

- [ ] **Step 8: PARAR: pedir ao dono a promoção para `main`**

Mensagem ao dono, um item por linha:

```
A migration do L1a está em produção (conferido no Step 5) e o código está em staging com a CI verde.
Pré-requisito 1 (YouTube Reporting API ativada no Google Cloud): confirmado?
Pré-requisito 2 (limite de função da Vercel >= 300 s): confirmado?
Com os dois confirmados, promova staging para main do jeito de sempre.
Depois do deploy, rode uma vez à mão, para não esperar as 12:00 UTC:
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/cron/sync-analytics-metrics
```

Se o dono promover sem o pré-requisito 1, nada quebra: a primeira execução grava `api_nao_ativada`, manda o aviso e segue.

---

### Task 17: Verificação em produção e revisão de totalidade

**Files:** atualiza o ledger `.superpowers/sdd/2026-10-07-coleta-l1a-plan/progress.md` (não commitado). Preenche a data no topo do runbook e as lacunas da seção 6 quando houver CSV (commit `docs:`).

**Interfaces:**
- Consumes: o deploy de `main` feito pelo dono na Task 16.
- Produces: o aceite 8 do spec adaptado a L1a, a lista de conferência de totalidade e as lições para os specs restantes.

- [ ] **Step 1: Logo depois da primeira execução (T+0)**

Peça ao dono a resposta JSON do `curl` da Task 16, Step 8, ou espere as 12:00 UTC. Depois rode (raiz), um por linha:

```bash
npx supabase db query --linked "select last_success_at, last_failure_at, consecutive_failures, last_error from cron_health where cron_name = 'sync-analytics-metrics' limit 1"
npx supabase db query --linked "select c.name, j.report_type_id, j.status, j.job_id is not null as tem_job, j.job_create_time, j.error from yt_reporting_jobs j join youtube_channels c on c.id = j.channel_id order by 1, 2 limit 100"
npx supabase db query --linked "select day_pt, count(*) as linhas, count(thumbnail_dhash) as com_thumbnail, count(thumbnail_blob_url) as com_url, count(description_text) as com_texto, count(ab_test_id) as com_teste, count(ab_variant_id) as com_variante, count(is_short) as is_short_preenchido, count(privacy_status) as privacy_preenchido from yt_own_video_meta_daily group by 1 order by 1 desc limit 5"
npx supabase db query --linked "select (select count(*) from youtube_videos) as videos, (select count(*) from youtube_channels) as canais, (select count(*) from youtube_channels where sync_enabled) as canais_com_sync"
npx supabase db query --linked "select attempt_day, kind, outcome, count(*) from yt_own_collection_attempts group by 1, 2, 3 order by 1 desc, 2, 3 limit 60"
```

Esperado:
- `consecutive_failures = 0`, ou `last_error` explicando uma falha legítima (leia a seção 5 do runbook). Em particular, `last_error` **não** pode conter `schema_ausente`.
- Uma linha de job por canal com `sync_enabled` e por tipo habilitado (4), mais as `desativado`. Cada linha de tipo habilitado está em `ativo`, ou num estado explícito (`api_nao_ativada`, `sem_acesso`, `tipo_indisponivel`).
- `linhas` do dia mais recente = número de vídeos publicados até o fim daquele dia (compare com `videos`). `com_thumbnail` e `com_url` próximos de `linhas`. `com_texto` = `linhas` no primeiro dia. `is_short_preenchido = 0` e `privacy_preenchido = 0` (L1a).
- Tentativas `meta` e `thumbnail` com `ok` em número igual a `linhas`; uma `sondagem` de escopo canal por canal com sync.

**Anote no ledger**, na seção "Primeira execução em produção (passo 1A)": os tipos oferecidos e o estado por canal. O spec pede isso (seção 4, última frase).

- [ ] **Step 2: No dia seguinte (T+24 h)**

```bash
npx supabase db query --linked "select report_type_id, status from yt_reporting_jobs order by 1, 2 limit 100"
npx supabase db query --linked "select c.name, r.report_type_id, r.status, r.is_backfill, count(*), min(r.start_time), max(r.start_time) from yt_reporting_reports r join youtube_channels c on c.id = r.channel_id group by 1, 2, 3, 4 order by 1, 2, 3, 4 limit 100"
npx supabase db query --linked "select day_pt, count(*) from yt_own_video_meta_daily group by 1 order by 1 desc limit 5"
npx supabase db query --linked "select count(*) as brutos, pg_size_pretty(coalesce(sum(octet_length(csv_gz)), 0)::bigint) as tamanho, max(octet_length(csv_gz)) as maior_em_bytes from yt_reporting_report_blobs"
```

Esperado: jobs `ativo`; relatórios começando a aparecer como `listado` e `baixado` (o Google leva até 48 h para gerar os primeiros; zero relatórios em T+24 h não é falha); dois dias de metadados com a mesma contagem de linhas; `maior_em_bytes` abaixo de 2 097 152.

- [ ] **Step 3: Aceite 8 do spec, adaptado a L1a (T+72 h)**

```bash
npx supabase db query --linked "select c.name, t.tipo, (select count(*) from yt_reporting_reports r where r.channel_id = c.id and r.report_type_id = t.tipo and r.status = 'baixado') as baixados, (select count(*) from yt_reporting_reports r where r.channel_id = c.id and r.report_type_id = t.tipo and r.status = 'listado') as na_fila, (select j.status from yt_reporting_jobs j where j.channel_id = c.id and j.report_type_id = t.tipo) as estado_do_job from youtube_channels c cross join (values ('channel_reach_basic_a1'), ('channel_reach_combined_a1')) as t(tipo) where c.sync_enabled order by 1, 2 limit 20"
npx supabase db query --linked "select m.day_pt, count(*) as linhas, (select count(*) from youtube_videos v where v.published_at < (m.day_pt + 1)::timestamp at time zone 'America/Los_Angeles') as videos_devidos from yt_own_video_meta_daily m group by 1 order by 1 desc limit 5"
npx supabase db query --linked "select status, count(*) from yt_reporting_reports where report_type_id in ('channel_reach_basic_a1', 'channel_reach_combined_a1') group by 1 order by 1 limit 10"
npx supabase db query --linked "select last_success_at, consecutive_failures, last_error from cron_health where cron_name = 'sync-analytics-metrics' limit 1"
```

**O aceite passa quando**, para cada canal com conexão viva e cada tipo de alcance: `baixados >= 1`, **ou** `estado_do_job` é um estado explícito (`api_nao_ativada`, `sem_acesso`, `tipo_indisponivel`) **com a ação do dono anotada no ledger**. Sem uma das duas, o aceite falha. E `linhas = videos_devidos` em cada um dos três dias.

Se `baixados = 0` e o job está `ativo`: olhe `na_fila` (downloads atrasados) e as tentativas `relatorio` com `erro_http`. Use superpowers:systematic-debugging; não promova uma correção sem reproduzir num teste.

- [ ] **Step 4: Fechar o runbook**

Preencha a data de entrada em produção no topo de `docs/ops/youtube-coleta-canais-proprios-runbook.md`. Se já houver relatório de alcance `baixado`, peça ao dono o export da seção 6 e preencha as colunas e a unidade do CTR.

```bash
git add docs/ops/youtube-coleta-canais-proprios-runbook.md
git commit -m "docs: data de produção e cabeçalho real do relatório de alcance no runbook da coleta" -- docs/ops/youtube-coleta-canais-proprios-runbook.md
```

- [ ] **Step 5: Revisão de totalidade**

Confronte cada requisito de L1a no spec com o que foi entregue. Copie esta lista para o ledger e marque cada linha com o sha do commit, ou com `NÃO ENTREGUE: <motivo>`. Uma linha não entregue é um follow-up com dono e data, nunca um silêncio.

| # | Requisito de L1a (seção do spec) | Tarefa | Como conferir |
|---|---|---|---|
| 1 | Migration aditiva com as cinco tabelas, roda duas vezes (§0, §2, aceite 1) | 2 | `psql -f` duas vezes; teste de integração |
| 2 | `yt_own_attempt_record` soma `attempts`, só service role (§2) | 2, 6 | teste de integração; `attempts.test.ts` |
| 3 | `channel_id` como referência simples em L1a (§0) | 2 | migration; divergência 4 |
| 4 | RLS `can_edit_site`, bruto sem policy (§1 Acesso) | 2 | teste de integração "anon não lê" |
| 5 | `database.types.ts` regenerado e commitado (§0, §2) | 2 | diff do commit |
| 6 | Dia: `Intl` + `America/Los_Angeles`; `attempt_day` em UTC (§1 Dia) | 4, 2 | `day-pt.test.ts` |
| 7 | Nulo, nunca zero; `is_short` e `privacy_status` nulos (§1, §3) | 9 | `meta-step.test.ts`; SELECT do Step 1 |
| 8 | Rede: timeout de `min(15 s, resto)`, até 4 em paralelo (§1 Rede, §7) | 3, 9, 10, 11 | `clock.test.ts` |
| 9 | Escrita: todo `upsert`/`update` confere `error`; `schema_ausente` (§1 Escrita, aceite 3) | 3, 6, 9, 10, 11, 14 | `schema.test.ts`; teste do veredito |
| 10 | Avisos deduplicados, textos exatos, `SEM_DESTINATARIO` crítico (§1 Avisos, aceite 4) | 7 | `alerts.test.ts` |
| 11 | Passo de metadados: todo vídeo de todo canal, dia fechado (§3) | 9 | `meta-step.test.ts` |
| 12 | `description_text`/`tags` só quando o hash muda; nunca de não nulo a nulo (§3) | 9 | bloco "descrição e tags" |
| 13 | Thumbnail: `probeThumb` com fetch do prazo, dHash, sha256, `archiveThumb` em `Promise.race`, falha → nulos + tentativa (§3) | 9 | bloco "thumbnail" |
| 14 | Segundos de A/B nos dois fusos e todas as regras de nulo (§3, aceite 6) | 5, 9 | `ab-seconds.test.ts` |
| 15 | Só vídeos com `published_at` anterior ao fim do `day_pt` (§3) | 9 | teste "publicado depois do fim do dia" |
| 16 | 1A: `reportTypes.list` + `jobs.list`, `REPORT_TYPES_ENABLED`, 409 adota (§4, aceite 5) | 8, 10 | `jobs-step.test.ts` |
| 17 | 1A: `desativado`, `tipo_indisponivel`, `api_nao_ativada`, `sem_acesso`; não param a Analytics API (§4, aceite 4) | 10, 14 | `jobs-step.test.ts`; rota |
| 18 | 1A: tentativa `sondagem` por canal; primeira execução anotada no ledger (§4) | 10, 17 | SELECT do Step 1 |
| 19 | 1C: listar com `createdAfter`, paginar, `ignoreDuplicates`, `is_backfill`, 404 → `erro` (§5, aceite 5) | 11 | bloco "listar" |
| 20 | 1C: cliente com `download`, gzip sempre, bytea `\x`+hex, sha256 do CSV (§5, aceite 6) | 8, 11, 2 | `reporting-client.test.ts`; teste de integração |
| 21 | 1C: 40 por execução, prioridade, URL gravada e renovada, 404/410, 2 MB, `vazio` (§5, aceite 5) | 11 | bloco "baixar" |
| 22 | 1C: expiração (60/30 dias) e limpeza do bruto (90/180 dias) (§5) | 11, 2 | `reports-step.test.ts`; teste de integração |
| 23 | Ordem metadados → 1A → existente → 1C; relógio 270 s; tetos 30/20/60 (§7) | 3, 13, 14 | `index.test.ts`; rota |
| 24 | Passo com 0 s grava `nao_alcancado_orcamento`; o teto de 40 não conta (§7, aceite 7) | 9, 10, 11, 13 | `orcamento.test.ts` |
| 25 | `rodarColeta` lê os canais sem filtro; erro → falha e nenhum passo roda (§7) | 13 | `index.test.ts` |
| 26 | Parte antiga dentro de `try`; fetch antigos com timeout; `ms_existente` (§7) | 14 | teste do veredito |
| 27 | Veredito único, mapeamento das l.45-55 e l.336-350; `maxDuration` 300 (§9, §0, aceite 2) | 14 | teste do veredito |
| 28 | Critérios de falha de L1a: linhas de metadados, `dias_sem_meta`, thumbnail 2 dias, relatórios, jobs, orçamento, aviso não entregue (§9) | 9, 12, 7 | `criteria.test.ts` |
| 29 | Classe "ação do dono" fora de `falhas[]`, em `acao_do_dono` (§9) | 10, 13, 14 | `jobs-step.test.ts`; rota |
| 30 | Os dois testes existentes editados com o `vi.mock` e verdes (aceite 0) | 14 | os dois arquivos |
| 31 | Runbook (§10) | 15 | arquivo |
| 32 | Ledger (§10) | 1, 16, 17 | arquivo |
| 33 | Suíte inteira verde antes de cada push (aceite 11) | 2, 16 | ledger |
| 34 | Produção, 72 h (aceite 8) | 17 | Step 3 |
| 35 | Simplificação: sem `collection_status`; revogado/sem conexão → `sem_conexao` | 10, 11 | testes "simplificação de L1a" |

Fora do L1a por decisão (conferir que **não** entrou): colunas de `youtube_channels`, `reautorizar`, callback de OAuth, RPC de remover canal, `videos.list`, `is_short`, `privacy_status`, normalização, diário, retenção, leitores de `impressions`/`ctr`, passo 1D.

```bash
git log --oneline --name-only <SHA_DO_COMMIT_DA_TASK_3>^..HEAD -- apps/web/src/app/api/social apps/web/src/lib/youtube/channel-registry.ts apps/web/src/lib/youtube/scoring.ts apps/web/src/lib/youtube/observatorio/forja apps/web/src/lib/youtube/short-classifier.ts
```

Expected: vazio, ou só commits de outros terminais (assunto sem relação com a coleta). Nenhum commit deste plano toca esses caminhos.

- [ ] **Step 6: O que o L1a ensinou para os specs restantes**

O dono pediu: ao terminar cada plano, revisar se foi implementado na totalidade e **refinar os specs restantes antes de seguir**. Preencha no ledger, com fatos de produção e não com impressão, uma resposta para cada pergunta. Depois proponha ao dono as emendas ao spec (`2026-10-07-coleta-canais-proprios-design.md`, L1b em diante) e aos specs irmãos (`2026-10-07-ab-lab-honesto-design.md`, `2026-10-07-observatorio-canal-video-ui-design.md`); quem aprova e edita o spec é o dono.

1. **Tipos de relatório.** Quais dos quatro tipos o YouTube ofereceu para cada canal? Algum veio `tipo_indisponivel`? → ajusta `REPORT_TYPES_ENABLED` e o que o L2 normaliza.
2. **Cabeçalho real.** Quais são as colunas de `channel_reach_basic_a1` e a unidade do CTR? Há mais de uma linha por vídeo e dia (dimensões extras)? → o normalizador do L2 é escrito contra isso; se a ponderação do CTR não for possível, o spec manda parar e perguntar.
3. **Backfill.** Quantos relatórios de backfill vieram por job, e em quantos dias a fila de `listado` zerou? → confirma ou corrige a estimativa de "~240 downloads iniciais" e o teto de 40.
4. **Tempo.** Quanto foi `ms_existente` e quanto cada passo levou? O relógio de 270 s aguenta o diário (50 s) e a retenção (40 s) do L2 e do L3? → se não, o spec precisa rever os tetos antes do L2.
5. **Dia.** O `start_time`/`end_time` dos relatórios confirma UTC-8 fixo, como o spec assume para a Reporting API? → decide se `seconds_*_reporting` está certo ou se o par deve ser recalculado.
6. **A/B.** Em quantas linhas `ab_test_id` veio preenchido com `ab_variant_id` nulo, e por qual motivo? Apareceu algum caso que as regras de nulo não previram? → entra no spec do A/B Lab honesto.
7. **Divergências.** Para cada item da seção "Divergências do spec encontradas ao planejar": a decisão do plano se sustentou em produção? Em especial o item 3 (`listado` há mais de 14 dias) e o item 4 (`channel_id` sem chave estrangeira: há linhas órfãs antes de o L1b criar o `on delete restrict`?).
8. **Thumbnail.** A taxa de falha de `probeThumb`/`archiveThumb` ficou abaixo de quanto? `DHASH_MAX_SAME = 6` gerou arquivamento a mais ou a menos para vídeos próprios?
9. **Falha em verde.** Algum estado terminou `ok` sem dado (canal sem vídeos, job ativo sem relatório, relatório `vazio`)? O critério correspondente da seção 9 disparou quando devia?
10. **Processo.** O que neste plano estava errado ou faltando e custou tempo? → vira regra do próximo plano (L1b).

---

## Divergências do spec encontradas ao planejar

Cada item traz onde o spec não bate com o código (ou consigo mesmo) e a decisão que este plano tomou. Nenhuma delas muda o que o L1a entrega; todas devem ser lidas pelo dono antes da execução.

1. **`buildNotification` não serve para os avisos novos.** O spec (§1 Avisos) manda entregar "por `fanOutToSiteAdmins` com `buildNotification` (o que a rota já usa)". `buildNotification` (`apps/web/src/lib/youtube/notification-service.ts:1-4`) só aceita os nove tipos da união `NotificationType`, todos com campos de vídeo. **Decisão:** os avisos da coleta chamam `fanOutToSiteAdmins` direto, com título e mensagem literais — o mesmo que a rota já faz para "canal sem conexão" (`route.ts:258-267`). `notifications.type` não tem chave estrangeira para `notification_types` (`supabase/migrations/20260606000001_register_research_digest_notification_type.sql:5-8`), então os tipos `youtube.coleta_*` não precisam de seed.

2. **Destinatários: `getSiteOwners` e `fanOutToSiteAdmins` olham conjuntos diferentes.** `getSiteOwners` (`lib/notifications/get-site-owners.ts:27`) devolve os `org_admin` da organização raiz; `fanOutToSiteAdmins` usa `getSiteAdminUserIds` (`lib/notifications/get-site-admin-users.ts:9`). **Decisão:** `SEM_DESTINATARIO` quando a lista de `getSiteOwners` é vazia **ou** quando `fanOutToSiteAdmins` devolve 0. Nos dois casos o carimbo é liberado (`releaseAlert`) para a execução seguinte tentar de novo — o spec não diz o que fazer com o carimbo quando a entrega falha.

3. **"Relatório `listado` há mais de 14 dias" contradiz a janela de 14 dias (§9).** O spec lista esse critério e, no item seguinte, diz que "os dois itens acima contam só relatórios com `create_time` nos últimos 14 dias". Um relatório listado há mais de 14 dias tem, por definição, `create_time` mais antigo que isso (a tabela nem tem coluna de "listado em"). Lido ao pé da letra, o critério nunca dispara e uma fila de download travada fica verde para sempre. **Decisão:** a janela de 14 dias vale para os estados sem conserto (`erro`, `vazio`, `expirado_sem_baixar`), que é a justificativa que o próprio spec dá; `listado` com `create_time` anterior a 14 dias é falha crítica enquanto durar (tem conserto: baixar) e sai como `atrasados` na resposta. Some sozinho quando baixa ou quando expira (60 dias) e vira `perdidos`.

4. **"Referência simples" não pode ser uma chave estrangeira.** O spec (§0) diz que em L1a `channel_id` é "referência simples, sem `on delete restrict`". Uma FK sem `ON DELETE` é `NO ACTION`, que bloqueia a remoção do canal do mesmo jeito e faria `public.youtube_channel_remove` (`supabase/migrations/20261003000007_youtube_channel_remove.sql`) falhar — exatamente o que o spec quer evitar até o L1b. **Decisão:** em L1a `channel_id` é `uuid` sem chave estrangeira nas cinco tabelas. Consequência para o L1b: antes de criar a FK com `on delete restrict`, a migration tem de tratar linhas órfãs (canal removido durante o L1a).

5. **`rodarColeta(ctx)` como chamada única não cabe na ordem do spec.** O spec (§7) dá a ordem "metadados → 1A → o que o cron já faz → 1C" e diz que os passos vivem atrás de `rodarColeta(ctx)`, que o aceite 0 manda mockar devolvendo `{falhas: [], resumo: {}}`. A parte antiga fica no meio. **Decisão:** `rodarColeta` recebe `fase: 'antes' | 'depois'` e é chamada duas vezes; o mock do aceite 0 serve às duas sem mudança. Cada chamada lê os canais de novo (uma consulta a mais por execução).

6. **`collection_status` no `select` de `rodarColeta` (§7).** A coluna só nasce em L1b. **Decisão:** o `select` de L1a é `id, channel_id, site_id, name, sync_enabled`.

7. **Função ausente não está na lista de códigos de `schema_ausente` (§1 Escrita).** O spec lista `42P01`, `42703`, `PGRST204`, `PGRST205`. O código chama a função `yt_own_attempt_record` em toda tentativa; função inexistente devolve `PGRST202` (PostgREST) ou `42883` (Postgres). **Decisão:** os dois entram em `CODIGOS_SCHEMA_AUSENTE`.

8. **`accessNotConfigured` pode vir em outro formato.** O spec (§4) fala em `reason = accessNotConfigured`. As APIs do Google mais novas devolvem o motivo em `error.details[].reason = 'SERVICE_DISABLED'`, e o escopo insuficiente como `ACCESS_TOKEN_SCOPE_INSUFFICIENT`. Não foi verificado contra a Reporting API real. **Decisão:** `classificarErro` aceita os dois formatos; a primeira execução em produção com a API desativada (se acontecer) confirma, e o resultado vai para o ledger.

9. **Critério de thumbnail "sem contar vídeos privados ou ausentes de `videos.list`" (§9).** `videos.list` é L1b. **Decisão:** em L1a todos os vídeos contam.

10. **Caminho do ledger.** O spec (§10) diz `.superpowers/sdd/2026-10-07-coleta-canais-proprios-plan/progress.md`; o pedido deste plano diz `.superpowers/sdd/2026-10-07-coleta-l1a-plan/progress.md`. **Decisão:** o segundo, um ledger por lote. O diretório `.superpowers/` está no `.gitignore` (linha 62): o ledger não é commitado.

11. **Base do spec.** O spec diz `main c20b6ff2`. O `main` **local** está em `3fb71996`; `origin/main` é que está em `c20b6ff2`. **Decisão:** o pré-voo confere `origin/main`.

12. **Regeneração de tipos com deriva.** O spec (§0) manda parar se o diff de `database.types.ts` mexer em tabelas não relacionadas. O ledger de `2026-10-06-observatorio-fixar-video-plan` (desvio 2) registra que `npm run db:types` já gerou deriva alheia neste repositório e que a saída foi inserir as linhas à mão. **Decisão:** o plano segue o spec (parar e perguntar); o dono decide na hora se repete a saída manual.

## Pontos em que o plano decidiu algo que o spec não fecha

1. **Função extra na migration:** `yt_reporting_blobs_purge(text[])`. O spec pede a limpeza do bruto "pelo próprio passo" sem dizer como; sem uma coluna que marque "bruto já apagado", um `delete` vindo do PostgREST reprocessaria os mesmos relatórios todo dia. Uma função faz o `delete ... using` de uma vez e é testável no banco local.
2. **Tolerância de 5 s na regra "soma acima da duração do dia"** (`TOLERANCIA_SOMA_MS`): fechar um ciclo e abrir o seguinte são duas gravações com relógios do servidor; sem tolerância, um teste no ar o dia inteiro poderia cair em nulo por milissegundos.
3. **Em qual cálculo vale "tempo fora de ciclo > on_air":** no `_analytics`, que é o que define `ab_variant_id`.
4. **Qual `ab_test_id` quando há mais de um teste no dia:** o de mais segundos no cálculo `_analytics`.
5. **Segundos nos casos de nulo:** continuam gravados (o spec só anula `ab_variant_id`, `title` e `thumbnail_sha256`).
6. **Pausa manual que fecha o ciclo, com buraco curto:** a variante de mais tempo vale. O aceite 6 ("pausar e retomar no mesmo dia → campos de variante nulos") é coberto pelo caso do spec em que a pausa **não** fecha o ciclo.
7. **Leitura de `ab_tests` falhando:** a linha do dia é gravada com a captura e com `title`, `thumbnail_sha256` e A/B nulos, mais falha crítica. A alternativa (não gravar) perderia a captura, que não volta.
8. **Erro de banco numa tentativa:** `outcome = 'erro_http'` com `error = 'erro de banco'` (a lista de resultados do spec não tem um valor próprio).
9. **Download com erro passageiro (5xx, timeout):** o relatório continua `listado`. `erro` fica só para `grande_demais`.
10. **Relatório `vazio`:** o bruto é guardado mesmo assim (o cabeçalho interessa ao L2).
11. **1C com 401/403 em `reports.list`:** o job vira `api_nao_ativada` / `sem_acesso`, para o 1A voltar a sondar e avisar. O spec só trata o 404.
12. **Erro transitório na sondagem:** só rebaixa a `erro` os tipos que não estavam `ativo`.
13. **`tipo_indisponivel`:** janela de 3650 dias no carimbo ("avisa uma vez") e sem aviso de saída.
14. **"Job em erro por 3 dias":** como `yt_reporting_jobs` não guarda desde quando, o critério usa as tentativas de escopo `job`.
15. **`privacy_status` com `check`:** `public`, `unlisted`, `private` ou nulo. Se o YouTube devolver outro valor em L1b, a migration de L1b alarga.
16. **Guarda de 1000 linhas** na leitura de `youtube_videos`: bater no teto do PostgREST vira falha crítica em vez de truncar em silêncio.
17. **Ordem dentro do teto nos passos 1A e 1C:** os canais vão na ordem da leitura (hoje são 2). "Quem tem a coleta mais antiga primeiro" está implementado no passo de metadados, que é onde há dezenas de itens; em 1C a ordem que importa é a da fila de download (tipo, depois `create_time`).
18. **A consulta de janela da parte antiga continua lendo a resposta por posição** (`row[1]`, `row[3]`...). A regra "ler por `columnHeaders[].name`" do spec (§1 Rede) entra quando o L3 mexer nessa consulta; o L1a só acrescenta o timeout e a conferência de `error`.
19. **Commits de código antes de a migration estar em produção:** podem ir para `staging` (outro terminal pode dar push a qualquer momento, e o cron só roda em produção). O portão é a promoção para `main` (Task 16, Step 5).

## Auto-revisão (feita ao escrever)

- **Cobertura:** a tabela do Step 5 da Task 17 liga cada requisito de L1a a uma tarefa; os itens fora do lote estão listados logo abaixo dela.
- **Placeholders:** os únicos trechos "a preencher" são dados que só existem depois da execução (sha, datas, respostas do dono, cabeçalho real do CSV) e estão no ledger e no runbook, não em passos de código. `<ARQ>`/`<TS>` é o nome que `npm run db:new` imprime.
- **Nomes entre tarefas:** `conferirBanco` (não `conferirEscrita`), `registrarTentativa`, `contarPorResultado`, `scopeJob`, `fetchComPrazo`, `comPrazo`, `emParalelo`, `restante`, `criarRelogio().prazo()`, `passoMetadados` / `passoJobs` / `passoRelatorios`, `criteriosRelatorios` / `criterioJobsEmErro` / `criterioOrcamento`, `rodarColeta({ supabase, relogio, fase })`, `criarReportingClient(token, f)`, `classificarErro`, `empacotarCsv`, `paraBytea` / `deBytea`, `REPORT_TYPES_ENABLED` / `REACH_TYPES` / `SEM_NORMALIZADOR`, `avisarEntrada` / `avisarSaida` — usados com a mesma assinatura em todas as tarefas.
- **Review Focus:** 1 → Tasks 4 e 5; 2 → Tasks 5 e 9; 3 → Task 11; 4 → Tasks 3, 6, 9, 10, 11, 14; 5 → Task 9.
- **O código deste plano foi executado ao planejar (07/10/2026), fora do repositório.** Os 30 blocos de código das Tasks 3 a 14 (14 arquivos de `src`, a rota, o helper e os 14 arquivos de teste) foram extraídos para uma pasta temporária e rodados com o `vitest.config.ts` do projeto, junto com os dois testes existentes do cron já com o `vi.mock` da Task 14: **16 arquivos, 216 testes, 0 falhas**; `tsc --noEmit` com o `tsconfig.json` do projeto (`strict`, `noUncheckedIndexedAccess`), incluindo o teste de integração: **0 erros**. As contagens de "Expected: PASS (N testes)" de cada tarefa são as dessa execução.
- **Não foi executado ao planejar:** a migration (Task 2) e o teste de integração contra o banco local — nenhum banco foi iniciado nem escrito. O SQL foi só relido. A prova de que roda duas vezes é o Step 5 da Task 2.
