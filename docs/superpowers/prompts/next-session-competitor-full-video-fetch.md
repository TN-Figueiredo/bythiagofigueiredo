# Prompt: Fetch completo de videos de competidores

## Contexto

O sync de competidores (`apps/web/src/lib/youtube/competitor-sync.ts`) busca apenas os **50 videos mais recentes** de cada canal via YouTube Data API (uploads playlist, maxResults=50). Canais com 500+ videos perdem os primordios — o usuario quer estudar a evolucao completa do canal concorrente.

Videos ja salvos no banco NAO sao deletados — o problema e que videos antigos que nunca foram buscados nunca aparecem.

## O que resolver

1. **No sync inicial (quando canal e adicionado):** fazer paginacao completa do uploads playlist ate buscar TODOS os videos. Usa `nextPageToken` para paginar (cada page = 50 results = 1 quota unit). Um canal com 500 videos = 10 requests = 10 quota units (one-time cost).

2. **Nos syncs subsequentes (cron a cada 30min):** manter o comportamento atual — buscar apenas os 50 mais recentes e upsert. Isso pega videos novos sem custo excessivo de quota.

3. **Diferenciar sync inicial vs incremental:** adicionar um campo `full_sync_completed_at` na tabela `competitor_channels`. Se NULL, o proximo sync faz fetch completo (paginado). Apos completar, seta o timestamp. Syncs futuros fazem apenas os 50 mais recentes.

## Arquivos a modificar

- `apps/web/src/lib/youtube/competitor-sync.ts` — a funcao `syncCompetitorChannel()`:
  - Adicionar loop de paginacao com `nextPageToken`
  - Condicionar: se `full_sync_completed_at IS NULL`, paginar tudo; senao, buscar 50
  - Apos sync completo, update `full_sync_completed_at = NOW()`

- `supabase/migrations/` — nova migration via `npm run db:new add_full_sync_completed_at`:
  ```sql
  ALTER TABLE competitor_channels
    ADD COLUMN IF NOT EXISTS full_sync_completed_at timestamptz;
  ```

- `apps/web/src/app/cms/(authed)/youtube/competitors/_components/channel-card.tsx` — mudar "Ver todos os {videoCount} videos" para usar o count real de videos no banco (ja disponivel via `ch.recentVideos.length` ou `ch.videoCount`)

## Cuidados

- **Quota budget:** YouTube Data API quota = 10.000 units/dia. Cada playlistItems.list = 1 unit. Cada videos.list (para stats) = 1 unit. Um canal com 1000 videos = 20 units (10 pages playlist + 10 pages video details). Com 15 canais monitorados fazendo full sync = ~300 units. Seguro.

- **Rate limiting:** nao disparar todos os requests de uma vez. Usar `for...of` sequencial com os page tokens (nao Promise.all).

- **Idempotencia:** usar `ON CONFLICT (competitor_channel_id, video_id) DO UPDATE` no upsert — ja e o padrao existente.

- **Nao quebrar o cron:** o sync incremental (50 mais recentes) deve continuar funcionando normalmente. O full sync so roda uma vez por canal.

## Teste

```bash
# Apos implementar, disparar sync manual:
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3001/api/cron/sync-youtube?mode=competitors"

# Verificar que videos antigos foram buscados:
npx supabase db query --linked "SELECT cc.channel_name, COUNT(cv.id) as video_count, MIN(cv.published_at) as oldest, MAX(cv.published_at) as newest FROM competitor_channels cc JOIN competitor_videos cv ON cv.competitor_channel_id = cc.id GROUP BY cc.channel_name;"
```
