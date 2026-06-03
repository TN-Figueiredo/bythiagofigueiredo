# Prompt: Enrich Own Video Tags via YouTube API

## Problema

Os vídeos dos nossos canais (`youtube_videos` onde `site_id` é o nosso) podem não ter a coluna `tags` preenchida. A aba Insights > Lacunas depende dessas tags para cruzar "tags deles" vs "suas tags". Sem tags nos nossos vídeos, tudo aparece como lacuna.

## O que verificar

```sql
-- Verificar quantos dos nossos vídeos têm tags
SELECT 
  COUNT(*) as total,
  COUNT(tags) as com_tags,
  COUNT(*) - COUNT(tags) as sem_tags
FROM youtube_videos
WHERE site_id = (SELECT id FROM sites LIMIT 1)
  AND is_hidden = false;
```

Se `sem_tags` > 0, precisa fazer enrich.

## Como fazer o enrich

O enrich de tags vem da YouTube Data API v3 (`videos.list` com `part=snippet`). O campo `snippet.tags` retorna um array de strings.

### Opção 1: Via cron existente

Se já existe um cron de sync de vídeos (`/api/cron/youtube-sync` ou similar), verificar se ele já busca `snippet.tags` e persiste em `youtube_videos.tags`. Se não, adicionar.

### Opção 2: Script one-shot

```typescript
// Para cada vídeo nosso sem tags:
// 1. Buscar via YouTube API: GET /videos?id={videoId}&part=snippet
// 2. Extrair snippet.tags (array de strings)
// 3. UPDATE youtube_videos SET tags = $tags WHERE video_id = $videoId
```

### Opção 3: Via Supabase SQL + API

```sql
-- Listar video_ids sem tags para buscar via API
SELECT video_id FROM youtube_videos
WHERE site_id = (SELECT id FROM sites LIMIT 1)
  AND is_hidden = false
  AND tags IS NULL
ORDER BY published_at DESC
LIMIT 50;
```

Depois usar a YouTube API para buscar tags em batch (até 50 IDs por request) e atualizar.

## Resultado esperado

Após enrich, a aba Insights > Lacunas deve mostrar:
- **Tags deles**: temas que competidores cobrem mas nós NÃO (gap-chip com + icon, dashed border)
- **Suas tags**: temas que nós JÁ cobrimos (gap-chip ours, accent background)
- Tags em comum aparecem como `gap-chip` sem + no lado esquerdo (shared topics)

## Arquivos relevantes

- `apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx` — gaps computation (lines ~444-452)
- `apps/web/src/lib/youtube/competitor-sync.ts` — sync logic
- `apps/web/src/app/api/cron/youtube-sync/` — cron endpoint
