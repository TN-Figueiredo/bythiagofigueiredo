# Social Metrics Polling — Implementation Status

## Status

**Prioridade:** Pos-MVP (Sprint 5h Phase 2). Nao bloqueia lancamento.
**Estado:** Implementacao aplicada, aguardando validacao visual + testes.

## O que foi implementado nesta sessao

### Gap 1: Feed loader faz JOIN com post_metrics — FEITO

**Arquivos modificados:**
- `lib/social/actions/posts.ts` — `MetricsAggregate` interface + campo `metrics?` em `FeedPostWithDeliveries` + query best-effort com try/catch
- `feed-view-loader.tsx` — mapeamento `item.metrics` → `FeedItem.metrics` + `metricsUpdatedAt`
- `feed-grid.tsx` — `FeedItem.metrics` expandido com `shares?`, `engagement?` + `metricsUpdatedAt?`
- `lib/social/actions/index.ts` — re-export de `MetricsAggregate`

**Logica:** Query `post_metrics` por `post_id` (com `slide_index IS NULL` para pegar agregado), dedup em JS (PostgREST nao suporta DISTINCT ON), `views = impressions` (sem somar reach para evitar double-counting), `engagement = round((likes+comments+shares / views) * 100, 2)`. Catch com Sentry warning (nao silencioso).

### Gap 2: Bluesky le coluna correta — FEITO

**Arquivo:** `metrics-poller.ts`, case `'bluesky'`
**Fix:** Prefere `bluesky_access_jwt_enc` (JWT refreshed); fallback `access_token_enc` (app password legado).

### Gap 3: Facebook comments e shares reais — FEITO

**Arquivo:** `metrics-poller.ts`, `fetchFacebookMetrics()`
**Fix:** Segunda chamada `/{postId}?fields=comments.summary(true),shares` com try/catch. Se falhar, mantem zeros.

### Gap 4: Instagram likes reais — FEITO

**Arquivo:** `metrics-poller.ts`, `fetchInstagramMetrics()`
**Fix:** Segunda chamada `/{mediaId}?fields=like_count,comments_count` com try/catch.

### Gap 5+7: Token refresh + circuit breaker no cron — FEITO

**Arquivo:** `app/api/cron/social-metrics/route.ts`
**Fixes:**
- `import * as Sentry from '@sentry/nextjs'`
- `import { ensureFreshToken, TokenRevokedError }`
- `CONNECTION_SELECT` com todos campos (incluindo `circuit_open_until`, `bluesky_access_jwt_enc`)
- Check circuit breaker ANTES de refresh
- Check `!siteId || !accountId` antes de `ensureFreshToken`
- `ensureFreshToken(siteId, provider, accountId)` com `accountId` TEXT (nao UUID)
- Re-fetch connection apos refresh
- TokenRevokedError → Sentry + continue

### Gap 6: Rate limit 429 handling — FEITO

**Arquivo:** `metrics-poller.ts`
**Fix:** Check `res.status === 429` antes de `!res.ok` nas 3 funcoes fetch. `Sentry.captureMessage` com level warning + throw.

### Gap 8: Ordering ASC para nao starvar posts antigos — FEITO

**Arquivo:** `app/api/cron/social-metrics/route.ts`
**Fix:** `.order('published_at', { ascending: true })` — posts mais antigos primeiro.

### Gap 9 (NOVO): API endpoints deprecated — FEITO

**Achado critico** do agente de verificacao de APIs:

| Endpoint | Issue | Fix aplicado |
|---|---|---|
| Facebook `post_impressions` | Deprecated 15 jun 2026 | → `post_media_views` |
| Instagram `impressions` (insights) | Deprecated abr 2025 | → `views` |
| Instagram `replies` (insights) | So funciona para Stories, nao para feed posts | Removido — comments vem da chamada suplementar `?fields=comments_count` |

**Nota:** API version v21.0 esta 4 versoes atras (v25.0 e a atual). Funcional por enquanto (Meta mantem ~2 anos), mas upgrade para v24/v25 recomendado em proxima sessao.

## Pendencias

### 1. Testes — RESOLVIDO

Testes devem rodar de `apps/web/` (nao da raiz do monorepo), onde o `vitest.config.ts` resolve aliases corretamente. **41 testes passam** (24 em `social-metrics.test.ts` + 17 em `social-metrics-integration.test.ts`), incluindo:
- Supplementary call failure (FB e IG) — verifica fallback para zeros
- API deprecated metrics atualizados (`post_media_views`, `views`)
- `views = impressions` (sem double-counting com reach)

### 2. Validacao visual

Verificar no browser que o FeedCard em `/cms/social` mostra metricas (views, likes, comments, engagement) para posts publicados com dados reais do cron. Requer pelo menos 1 post publicado + 1 ciclo de cron executado.

### 3. API version upgrade (futuro)

Migrar de Graph API v21.0 para v24/v25. Nao urgente (v21.0 suportado ate ~2027), mas good practice.

## Limitacoes conhecidas (v1)

1. **Multi-platform posts:** Metricas somadas, FeedCard mostra icone da primeira plataforma apenas.
2. **YouTube:** Retorna null (Data API v3 nao suporta metricas de community posts).
3. **Dedup em JS:** Volume baixo (~200 rows max). Se escalar, criar RPC ou view Postgres.
4. **Stories Instagram:** Insights disponiveis por apenas 48h apos publicacao.
5. **maxDuration do cron:** 60s. Com muitas connections distintas + 15s timeout cada refresh, pode exceder. Monitorar cron_runs.
6. **Token em URL:** Facebook/Instagram Graph API usa `access_token` como query parameter (padrao da API). Tokens podem aparecer em Sentry breadcrumbs se o fetch falhar. Mitigacao: o try/catch no `pollMetricsForDelivery` captura exceptions com contexto limitado (sem URL). Para v2, considerar sanitizar URLs antes de Sentry capture.
7. **`metricsUpdatedAt` e `shares`** estao wired ate o FeedItem mas o FeedCard existente nao os renderiza ainda. Adicionar em v2.
8. **`engagement` e um percentual** (ex: 3.45) mas o FeedCard exibe como numero absoluto sem sufixo `%`. Corrigir no FeedCard em v2.

## Mapeamento de campos

| post_metrics (DB) | FeedItem.metrics (UI) | Nota |
|---|---|---|
| `impressions` | `views` | Direto (sem somar reach — evita double-counting) |
| `reach` | — | Disponivel no DB mas nao exibido (subconjunto de impressions) |
| `likes` | `likes` | Direto |
| `comments` | `comments` | Direto |
| `shares` | `shares` | Direto |
| `likes + comments + shares` | `engagement` | Computado como % de views |
| `polled_at` | `metricsUpdatedAt` | Para tooltip "atualizado ha Xh" |
| `link_clicks` | — | Disponivel mas nao exibido no FeedCard v1 |
