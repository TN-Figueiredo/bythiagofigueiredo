# Next Sprint Specs — Generated from Phase 6

**Date:** 2026-06-01
**Source:** YouTube Ecosystem Uplift spec Phase 6 items
**Status:** Ready for implementation in future sessions

---

## 6.1 Collections Feature (Library evoluida)

### Goal
Evoluir a Thumbnail Library de lista flat com tags para colecoes nomeadas (tipo Pinterest boards).

### Features
- **Colecoes nomeadas** (ex: "Close-ups", "Texto Bold", "Antes/Depois")
- **Drag-to-collection** para organizar entries
- **Collection metadata** (descricao, cor, icone)
- **Browse por colecao** com filtros internos
- **Auto-collection** de winners agrupados por pattern tag
- **Import de competitor thumbnails** para colecoes (via observatory)

### DB Changes
```sql
CREATE TABLE thumbnail_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text DEFAULT '#FF8240',
  icon text DEFAULT 'folder',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE thumbnail_collection_entries (
  collection_id uuid NOT NULL REFERENCES thumbnail_collections(id) ON DELETE CASCADE,
  library_entry_id uuid NOT NULL REFERENCES thumbnail_library(id) ON DELETE CASCADE,
  sort_order integer DEFAULT 0,
  PRIMARY KEY (collection_id, library_entry_id)
);
```

### UI
- Sidebar de colecoes + grid de entries (como Finder/Pinterest)
- LibraryPickerDialog evolui para mostrar colecoes como tabs

### Dependencias
Fase 2b (competitor UI), Fase 3.5 (LibraryPickerDialog) — ambas completas

### Estimativa: 6-8h

---

## 6.2 Perceptual Hash (pHash) para Drift Detection

### Goal
Substituir comparacao URL por comparacao visual de conteudo (elimina edge cases de CDN hostname rotation).

### Approach
- Implementar dHash (difference hash) em Node.js usando sharp (~50 linhas)
- Computar hash da thumbnail apos cada apply, armazenar em `applied_metadata.thumbnail_hash`
- No watchdog, baixar thumbnail atual, computar hash, comparar Hamming distance
- Threshold: <= 10 bits = mesma imagem

### Implementation
```typescript
import sharp from 'sharp'

async function computeDHash(imageBuffer: Buffer): Promise<string> {
  const { data } = await sharp(imageBuffer)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  
  let hash = ''
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = data[y * 9 + x]!
      const right = data[y * 9 + x + 1]!
      hash += left < right ? '1' : '0'
    }
  }
  return hash
}

function hammingDistance(a: string, b: string): number {
  let d = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++
  return d
}
```

### Fallback
Se hash computation falhar, cair de volta pra URL comparison (fix 0.1 atual).

### Estimativa: 3-4h

---

## 6.3 Social Blade-style Channel Analytics

### Goal
Projecao de crescimento, ranking no nicho, daily subscriber delta.

### Features
- **Projecao de crescimento** — regressao linear sobre `competitor_channel_snapshots`. Projecao 30d, 90d, 1 ano.
- **Ranking no nicho** — leaderboard entre competidores trackeados por: subs, views/video, engagement, upload frequency.
- **Daily subscriber delta** — grafico barras verdes (ganho) e vermelhas (perda).
- **Channel grade card** — grades A+ a F baseadas em metricas relativas ao nicho.
- **Comparison table** — side-by-side: seu canal vs competidores.
- **Growth alerts** — notificacao quando competidor cresce >10% em 7 dias.

### Dados necessarios
`competitor_channel_snapshots` (Fase 2a — ja implementada e em producao).
Minimo 7 dias de snapshots para projecao, 30 dias para ranking confiavel.

### UI
Sub-tab "Crescimento" na aba Insights do Competitor Observatory.
Widget "Social Blade" no Dashboard principal.

### Estimativa: 8-12h

---

## 6.4 Runtime Quota Monitoring

### Goal
Dashboard e alertas para monitorar consumo da YouTube Data API quota.

### DB Changes
```sql
CREATE TABLE youtube_quota_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date date NOT NULL,
  operation text NOT NULL,
  units_used integer NOT NULL DEFAULT 0,
  cron_source text,
  UNIQUE(site_id, date, operation)
);
```

### Features
- Barra de progresso diaria (usado/10,000)
- Breakdown por operacao (pie chart)
- Historico 30 dias (area chart)
- Alertas: warning >50%, critical >80%, emergency >95%

### Estimativa: 4-6h

---

## 6.5 Pendencias Tecnicas (Tech Debt)

### From Phase 0-1a Reviews
- [ ] analytics-client.test.ts — atualizar teste "impressions always 0" para validar dados reais
- [ ] KPI sparkline com dados reais de testes completados
- [ ] mock-dashboard.ts mover para test fixtures
- [ ] Testes para acknowledgeAbTestDrift + resumeAbTest drift gate
- [ ] Testes para watchdog drift branch (ciclo fechado, revert, notificacao)
- [ ] || 0 fallback consistente em fetchYtChannelMetrics indices 0-8

### From Phase 1b Reviews
- [ ] pullPipelineThumbnails UI button em step-variantes
- [ ] AbEndTestDialog leadingVariant — passar leaderId do active-detail
- [ ] AbEndTestDialog hasLowConfidence — computar de props, nao hardcoded false
- [ ] OAuth per-channel completo (channelId no OAuth route, login_hint, callback validation)

### From Phase 2a Reviews
- [ ] AB test detection query (2+ thumbnail changes em 14 dias) — function + feature flag
- [ ] YouTube quota error classification (YouTubeQuotaError vs generic 403)
- [ ] video_count integer→bigint na snapshots table
- [ ] Supabase mutation error handling (.throwOnError() nos criticos)

### From Phase 2b Reviews
- [ ] Competitor remove channel confirmation dialog
- [ ] Competitor sync/remove loading states (useTransition + spinner)
- [ ] Tags cast cleanup em page.tsx
- [ ] Video expand lazy loading / paginacao

### Estimativa total: 8-12h across items
