# Prompt: Social Metrics Polling Pipeline

## Contexto

O Social Studio exibe FeedCards com métricas (views, likes, comments, engagement) no footer. Os componentes estão prontos (`FeedCard` renderiza `item.metrics` quando presente), mas o **pipeline de coleta de métricas das APIs das plataformas não existe**.

Posts criados via "Do CMS" já salvam título, source e idioma. O que falta é popular as métricas APÓS publicação.

## O que implementar

### 1. Tabela de métricas (migration)

```sql
-- npm run db:new social_delivery_metrics
CREATE TABLE IF NOT EXISTS social_delivery_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES social_deliveries(id) ON DELETE CASCADE,
  polled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  reach INTEGER,
  engagement_rate NUMERIC(5,2),
  raw_data JSONB,
  UNIQUE(delivery_id, polled_at)
);

CREATE INDEX idx_delivery_metrics_delivery ON social_delivery_metrics(delivery_id);
```

### 2. Cron de polling (`/api/cron/social-metrics-poll`)

- Roda a cada 1h (ou 30min)
- Busca `social_deliveries` com `status = 'published'` e `published_at` nos últimos 7 dias
- Para cada delivery, chama a API da plataforma:
  - **Instagram**: Graph API `/media/{platform_post_id}/insights` → impressions, reach, likes, comments
  - **YouTube**: Data API `/videos?id={platform_post_id}&part=statistics` → viewCount, likeCount, commentCount
  - **Facebook**: Graph API `/{platform_post_id}?fields=insights` → impressions, reactions, comments, shares
- Salva em `social_delivery_metrics`
- Usa token da `social_connections` (descriptografa via `decrypt()` + `getMasterKey()`)
- Respeita rate limits de cada API
- CRON_SECRET validation
- Sentry error tracking

### 3. Agregação no feed-view-loader

`feed-view-loader.tsx` deve fazer um JOIN ou query separada para buscar as métricas mais recentes de cada delivery:

```typescript
// Após buscar posts com deliveries, buscar métricas
const deliveryIds = result.data.flatMap(item => item.deliveries.map(d => d.id))
const { data: metrics } = await supabase
  .from('social_delivery_metrics')
  .select('delivery_id, views, likes, comments, shares')
  .in('delivery_id', deliveryIds)
  .order('polled_at', { ascending: false })
  // Pegar só o mais recente por delivery (distinct on)

// Mapear métricas para cada FeedItem
```

### 4. Atualizar FeedItem mapping

No `feed-view-loader.tsx`, popular o campo `metrics` do FeedItem com os dados reais:

```typescript
metrics: latestMetrics ? {
  views: latestMetrics.views ?? undefined,
  likes: latestMetrics.likes ?? undefined,
  comments: latestMetrics.comments ?? undefined,
  engagement: latestMetrics.shares ?? undefined,
} : undefined,
```

### 5. API keys necessárias

- `YOUTUBE_API_KEY` — já existe em `.env.local`
- Instagram Graph API — usa token do `social_connections` (já armazenado)
- Facebook Graph API — usa `page_token_enc` do `social_connections`

### 6. Referências no codebase

- `apps/web/src/lib/social/metrics-poller.ts` — arquivo existente (verificar se tem lógica reutilizável)
- `apps/web/src/lib/social/token-refresh.ts` — refresh de tokens OAuth
- `apps/web/src/lib/social/actions/connections.ts` — `checkConnectionHealth` como referência de query
- `apps/web/src/app/api/cron/social-auto-draft/route.ts` — padrão de cron existente
- `packages/social/src/core/types.ts` — tipos de Provider

### 7. Testes

- `apps/web/test/social-metrics-poll.test.ts` — mock das APIs, verificar que métricas são salvas
- `apps/web/test/social-feed-with-metrics.test.ts` — verificar que FeedItem inclui métricas

### 8. Vercel cron config

```json
{ "path": "/api/cron/social-metrics-poll", "schedule": "0 * * * *" }
```

## Resultado esperado

Após implementar, os FeedCards no `/cms/social` vão mostrar automaticamente:
- 👁 1.204 (views)
- 💬 18 (comments)  
- ❤️ 142 (likes)
- 📊 312 (engagement)

Para todos os posts publicados nos últimos 7 dias, com dados atualizados a cada hora.
