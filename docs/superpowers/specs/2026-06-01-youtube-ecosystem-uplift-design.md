# YouTube Ecosystem Uplift — Design Spec v2

**Date:** 2026-06-01 (revised 2026-06-01)
**Original research:** 27 sub-agents, 2.1M tokens, 913 tool calls
**Review round:** 14 specialist reviewers, average score 43/110
**Score atual:** 46/110 (backend 72, frontend 38-62, cross-feature 38)
**Objetivo:** Levar o ecossistema YouTube de prototipo funcional a produto utilizavel

---

## Contexto

O backend do AB Lab Observatory e genuinamente sofisticado -- motor Bayesiano com rotacao ABBA, scoring 6 eixos com sigmoid normalization, longevity tracking com auto-fatigue detection. Porem:

- 4 bugs criticos de integridade de dados no AB Lab (drift false positive, auto-pause incompleto, original thumbnail mutavel, resume sem seguranca)
- ~40% dos dados visiveis na UI sao valores hardcoded/fake
- 14 features backend completas nao tem trigger na UI
- 12 conexoes entre features estao quebradas
- Performance page mostra TUDO ZERO (bug CTR no analytics-client.ts)
- Competitor Observatory e uma lista basica vs ViewStats que oferece Outliers, Thumbnail Search, AB test detection

### O que ViewStats faz que NAO podemos replicar
- **Thumbnail Search global** -- requer index proprietario de milhoes de videos
- **Browse AB tests de qualquer criador** -- requer monitoramento global
- **Outliers globais** -- requer dados de milhoes de canais

### O que PODEMOS construir
- Outliers nos competidores trackeados (view/sub ratio acima da media)
- AB test detection nos competidores (2+ mudancas thumb em 14 dias)
- Alerts de mudancas de competidores
- Fix da Performance page (bug CTR = tudo zero)
- Competitor rich cards com engagement, top videos, upload patterns
- Library evoluida com tags e curacao (Collections em spec futuro)

---

## Regras de implementacao

1. **TESTE CADA MUDANCA NO BROWSER** antes de prosseguir. Rode `npm run dev` e verifique visualmente.
2. **Siga a ordem das fases** -- cada fase tem uma gate de verificacao. NAO pule.
3. **Rode `npm run test:web`** antes de commitar qualquer fase.
4. **Linguagem da UI: portugues** salvo termos tecnicos (ver Politica Bilingue, Fase 5.2).

---

## Fase 0: Correcoes Criticas AB Test (BLOQUEANTE, ~3-4h)

> **STOP: NAO prosseguir para Fase 1 ate que TODOS os fixes da Fase 0 passem nos testes.**
> Estes 4 bugs corrompem dados de testes ativos EM PRODUCAO.

### 0.1 Bug: Drift Detection False Positive

**Arquivos:**
- `apps/web/src/lib/youtube/ab-drift.ts` (linhas 22-23)
- `apps/web/src/lib/youtube/ab-apply.ts` (linha 54)
- `apps/web/src/lib/youtube/ab-types.ts` (linha 96)
- `apps/web/src/app/api/cron/ab-watchdog/route.ts` (linhas 86-106)

**Causa raiz:** `checkDrift` compara `expectedThumbnailUrl` (que vem de `ab_test_variants.blob_url`, uma URL Vercel Blob como `https://xxx.public.blob.vercel-storage.com/...`) contra a URL retornada pela YouTube API (como `https://i.ytimg.com/vi/xxx/hqdefault.jpg`). Esses dominios SEMPRE diferem, causando false positive em CADA teste ativo com variante challenger.

**Cadeia do bug:**
1. `ab-watchdog/route.ts:95` le `expectedUrl` de `ab_test_variants.blob_url` (Vercel Blob URL)
2. `checkDrift` em `ab-drift.ts:17` busca `currentUrl` da YouTube API (YouTube CDN URL)
3. `ab-drift.ts:23` compara `normalize(currentUrl) !== normalize(expectedThumbnailUrl)` -- sempre `true`
4. Watchdog pausa o teste com `status_note: 'Thumbnail alterado externamente'` -- FALSO

**Fix -- 3 passos:**

**Passo 1:** Estender `AppliedMetadata` em `ab-types.ts:96`:
```typescript
export interface AppliedMetadata {
  thumbnail_set?: boolean
  title_set?: string | null
  description_set?: string | null
  links_resolved?: Record<string, string>
  youtube_thumbnail_url?: string // NEW: URL retornada pelo YouTube apos apply
}
```

**Passo 2:** Em `ab-apply.ts`, apos `setThumbnail` bem-sucedido (linha 52-53), capturar a URL que o YouTube retorna:
```typescript
// After line 53: meta.thumbnail_set = true
// Fetch the YouTube-assigned URL for this video's thumbnail
const ytResponse = await fetch(
  `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${youtubeVideoId}&key=${process.env.YOUTUBE_API_KEY}`,
  { signal: AbortSignal.timeout(10_000) },
)
if (ytResponse.ok) {
  const ytData = await ytResponse.json()
  meta.youtube_thumbnail_url = ytData.items?.[0]?.snippet?.thumbnails?.high?.url ?? undefined
}
```

**Passo 3:** Em `ab-watchdog/route.ts`, mudar a origem do `expectedUrl` (linhas 86-95). Em vez de usar `ab_test_variants.blob_url`, buscar `applied_metadata->>'youtube_thumbnail_url'` do ciclo aberto:
```typescript
const { data: openCycle } = await driftClient
  .from('ab_test_cycles')
  .select('variant_id, applied_metadata')
  .eq('test_id', test.id)
  .is('ended_at', null)
  .limit(1)
  .maybeSingle()

if (!openCycle) continue
const appliedMeta = openCycle.applied_metadata as AppliedMetadata | null
const expectedUrl = appliedMeta?.youtube_thumbnail_url ?? null
// If no youtube_thumbnail_url stored yet (old cycles), skip drift check
if (!expectedUrl) continue
```

**Observabilidade:** Adicionar Sentry breadcrumb no checkDrift:
```typescript
Sentry.addBreadcrumb({
  category: 'ab-drift',
  message: `Drift check: test=${testId}, expected=${normalize(expectedUrl)}, current=${normalize(currentUrl)}, drifted=${drifted}`,
  level: drifted ? 'warning' : 'info',
})
```

**Nota:** `applied_metadata` ja e uma coluna JSONB existente em `ab_test_cycles` (ver `ab-types.ts:118`). Nenhuma migration necessaria para este campo -- apenas atualizar a interface TypeScript.

**Rollback:** Se o fix introduzir regressao, como kill switch temporario: setar `YOUTUBE_API_KEY=''` desabilita drift check inteiro (checkDrift retorna `drifted: false` quando `!apiKey` no watchdog, linha 74).

### 0.2 Bug: Auto-Pause Incompleto

**Arquivo:** `apps/web/src/app/api/cron/ab-watchdog/route.ts` linhas 108-113

**Causa raiz:** Quando drift e detectado, o watchdog so faz `update({ status: 'paused', status_note: ... })`. NAO fecha o ciclo aberto (nao seta `ended_at` em `ab_test_cycles`) e NAO reverte a thumbnail no YouTube. Compare com `pauseAbTest` em `actions.ts:619-682` que FAZ ambos.

**Estado atual (bugado):**
```typescript
if (drifted) {
  await driftClient
    .from('ab_tests')
    .update({ status: 'paused', status_note: 'Thumbnail alterado externamente' })
    .eq('id', test.id)
  // ... notification only
}
```

**Fix:** Substituir o bloco `if (drifted)` (linhas 108-136) por:
```typescript
if (drifted) {
  const now = new Date().toISOString()

  // 1. Close the open cycle
  await driftClient
    .from('ab_test_cycles')
    .update({ ended_at: now })
    .eq('test_id', test.id)
    .is('ended_at', null)

  // 2. Attempt thumbnail revert to original
  try {
    const { data: testFull } = await driftClient
      .from('ab_tests')
      .select('original_thumbnail_url, site_id')
      .eq('id', test.id)
      .single()

    if (testFull?.original_thumbnail_url) {
      const { ensureFreshToken } = await import('@/lib/youtube/token-refresh')
      const { fetchVariantImageBuffer, setThumbnail } = await import('@/lib/youtube/ab-youtube')
      const { accessToken } = await ensureFreshToken(testFull.site_id, 'youtube')
      const { buffer, contentType } = await fetchVariantImageBuffer(testFull.original_thumbnail_url as string)
      await setThumbnail(video.youtube_video_id, buffer, contentType, accessToken)
    }
  } catch (revertErr) {
    // Non-fatal: revert failed but test is still paused
    Sentry.captureException(revertErr, { extra: { context: 'ab-watchdog-revert', testId: test.id } })
  }

  // 3. Pause the test
  await driftClient
    .from('ab_tests')
    .update({ status: 'paused', paused_at: now, status_note: 'Thumbnail alterado externamente' })
    .eq('id', test.id)

  // 4. Notify owner (existing code)
  // ... keep existing notification code
}
```

**Rollback:** Se o revert falhar, o teste ainda e pausado (fail-safe). O try/catch garante que falha de revert nao impede a pausa.

### 0.3 Bug: Original Thumbnail Armazenado como URL Mutavel

**Arquivo:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts` linhas 161, 178

**Causa raiz:** `createAbTest` armazena `video.thumbnail_hq_url` (URL do CDN do YouTube, ex: `https://i.ytimg.com/vi/xxx/hqdefault.jpg`) tanto em `ab_tests.original_thumbnail_url` (linha 161) quanto em `ab_test_variants.blob_url` para a variante original (linha 178). Quando a rotacao aplica outra variante, o YouTube ATUALIZA a URL do CDN para refletir a nova thumbnail. O "original" armazenado agora aponta para a thumbnail errada.

**Impacto:** `revertWinner` (actions.ts:1380-1381) usa `original_thumbnail_url` para reverter -- se a URL foi sobrescrita pelo CDN, reverte para a thumbnail ERRADA.

**Fix:** Em `createAbTest`, apos verificar o video (linha 105-107), ANTES de inserir o test (linha 153), fazer download da thumbnail original e upload para Vercel Blob:

```typescript
import { put } from '@vercel/blob'

// After line 107 (video validation), before line 153 (test insert):
let immutableOriginalUrl = video.thumbnail_hq_url ?? null

if (video.thumbnail_hq_url) {
  try {
    const res = await fetch(video.thumbnail_hq_url, { signal: AbortSignal.timeout(15_000) })
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer())
      const ct = res.headers.get('content-type') ?? 'image/jpeg'
      const ext = ct.includes('png') ? 'png' : 'jpg'
      // Use a temporary UUID since test.id does not exist yet
      const tempKey = `ab-originals/${crypto.randomUUID()}/original.${ext}`
      const blob = await put(tempKey, buffer, {
        access: 'public',
        contentType: ct,
        addRandomSuffix: true,
      })
      immutableOriginalUrl = blob.url
    }
  } catch (blobErr) {
    // If Blob upload fails, the test CANNOT be created safely
    return { ok: false, error: 'Falha ao salvar thumbnail original. Tente novamente.' }
  }
}

// Then use immutableOriginalUrl in both places:
// line 161: original_thumbnail_url: immutableOriginalUrl,
// line 178: blob_url: immutableOriginalUrl,
```

**Backfill para testes existentes:** Criar script de backfill (rodar uma vez apos deploy):
```sql
-- Identify affected tests (active/paused with YouTube CDN URLs as original)
SELECT id, original_thumbnail_url
FROM ab_tests
WHERE status IN ('active', 'paused', 'draft')
  AND original_thumbnail_url LIKE 'https://i.ytimg.com%'
  OR original_thumbnail_url LIKE 'https://img.youtube.com%';
```
Para cada teste encontrado: download da thumbnail, upload para Vercel Blob, update de `ab_tests.original_thumbnail_url` e `ab_test_variants.blob_url WHERE is_original = true AND test_id = X`. Implementar como server action `repairOriginalThumbnails()` chamavel manualmente.

**Rollback:** Se `put()` para Blob falhar, rejeitar criacao do teste com erro claro. Se Blob estiver fora do ar temporariamente, o usuario pode tentar novamente. Fallback: armazenar tanto `blob_url` (Blob) quanto `source_cdn_url` (YouTube CDN) na variante original para re-download futuro.

### 0.4 Bug: Resume sem Verificacao de Drift

**Arquivo:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts` linhas 688-766

**Causa raiz:** `resumeAbTest` permite retomar qualquer teste pausado sem verificar: (a) se o teste foi pausado por drift detection, (b) se o usuario reconheceu o drift, (c) se a thumbnail atual no YouTube corresponde ao esperado. Um teste pausado por drift pode ser retomado blindamente.

**Fix -- 2 passos:**

**Passo 1:** Migration SQL (usar `npm run db:new ab_tests_drift_acknowledged`):
```sql
ALTER TABLE ab_tests
  ADD COLUMN IF NOT EXISTS drift_acknowledged_at timestamptz;
```

**Passo 2:** Em `resumeAbTest` (actions.ts), apos a verificacao `test.status !== 'paused'` (linha 708), adicionar:
```typescript
// After line 708
// If paused by drift, require acknowledgement before resume
if (test.status_note === 'Thumbnail alterado externamente') {
  const { data: testFull } = await supabase
    .from('ab_tests')
    .select('drift_acknowledged_at')
    .eq('id', testId)
    .single()

  if (!testFull?.drift_acknowledged_at) {
    return { ok: false, error: 'Drift nao reconhecido. Use acknowledgeAbTestDrift antes de retomar.' }
  }
}
```

Adicionar nova action `acknowledgeAbTestDrift`:
```typescript
export async function acknowledgeAbTestDrift(
  testId: string,
): Promise<{ ok: boolean; error?: string }> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('ab_tests')
    .update({ drift_acknowledged_at: new Date().toISOString() })
    .eq('id', testId)
    .eq('site_id', siteId)
    .eq('status', 'paused')

  if (error) return { ok: false, error: error.message }
  revalidateTag('youtube')
  return { ok: true }
}
```

**UI:** No detalhe do teste pausado com `status_note === 'Thumbnail alterado externamente'`, mostrar banner:
```
Este teste foi pausado automaticamente porque a thumbnail do YouTube foi
alterada fora do A/B Lab. Verifique a situacao antes de retomar.

[Reconhecer e Retomar]  [Ver detalhes]
```
O botao "Reconhecer e Retomar" chama `acknowledgeAbTestDrift` e depois `resumeAbTest`.

**Rollback:** Se a verificacao de `drift_acknowledged_at` causar problemas, a coluna e nullable e a verificacao pode ser removida sem migration -- apenas remover o bloco de codigo. Fail-open: se a query de `testFull.drift_acknowledged_at` falhar, permitir resume (evitar bloquear usuarios por erro do sistema).

### 0.5 Recuperacao de testes corrompidos

Apos deploy dos fixes 0.1-0.4, executar:

1. **Identificar testes pausados por false positive:**
```sql
SELECT id, youtube_video_id, status_note, updated_at
FROM ab_tests
WHERE status = 'paused'
  AND status_note = 'Thumbnail alterado externamente';
```

2. **Para cada teste:** verificar manualmente se a thumbnail no YouTube e a esperada. Se sim (false positive confirmado), limpar `status_note` e oferecer retomada.

3. **Executar backfill de original thumbnails** (ver 0.3).

4. **Verificar ciclos orfaos** (abertos sem `ended_at` em testes pausados):
```sql
UPDATE ab_test_cycles
SET ended_at = NOW()
WHERE test_id IN (SELECT id FROM ab_tests WHERE status = 'paused')
  AND ended_at IS NULL;
```

### 0.6 Testes afetados -- Fase 0

| Bug | Arquivo de teste | Casos necessarios |
|-----|-----------------|-------------------|
| 0.1 Drift false positive | **NOVO:** `test/youtube/ab-drift.test.ts` | (1) YouTube URL vs YouTube URL iguais = no drift, (2) YouTube URL vs YouTube URL diferentes = drift, (3) Blob URL vs YouTube URL = deve usar youtube_thumbnail_url do applied_metadata, (4) null expectedUrl = no drift, (5) API failure = no drift + Sentry warning |
| 0.1 Applied metadata | `test/youtube/ab-apply.test.ts` | (6) Apos setThumbnail, `meta.youtube_thumbnail_url` e preenchido |
| 0.2 Auto-pause completo | `test/ab-cron-watchdog.test.ts` | (7) Drift detected fecha ciclo aberto, (8) Drift detected tenta revert da thumbnail, (9) Revert failure nao impede pause, (10) Notificacao enviada com link correto |
| 0.3 Original immutavel | **NOVO:** `test/youtube/ab-create-immutable.test.ts` | (11) createAbTest faz download + upload para Blob, (12) blob_url da variante original e URL Vercel Blob nao YouTube CDN, (13) Blob upload failure rejeita criacao do teste |
| 0.4 Resume seguro | `test/ab-p3-actions.test.ts` | (14) Resume de teste pausado por drift SEM acknowledgement = rejeitado, (15) Resume apos acknowledgement = sucesso, (16) Resume de teste pausado por outro motivo = sucesso sem acknowledgement |

**ATUALIZAR teste existente:** `test/app/cms/youtube/analytics-client.test.ts` linha 231 -- o teste 'returns core metrics with impressions always 0' DEVE SER MANTIDO ate Fase 1.1 ser implementada. NAO alterar antes.

### Gate de verificacao -- Fase 0

Antes de prosseguir para Fase 1:
1. `npm run test:web` -- todos os testes passam (incluindo novos)
2. Criar um teste AB de thumbnail em dev
3. Verificar que drift detection NAO dispara false positive (aguardar watchdog ou chamar manualmente)
4. Verificar que pausar manualmente fecha o ciclo e reverte thumbnail
5. Verificar que resume de teste pausado por drift requer acknowledgement

---

## Fase 1a: Fix CTR Bug + Purge Mock Data (~4-5h)

### 1.1 Fix CTR/Impressions zero bug

**Arquivo:** `apps/web/src/lib/youtube/analytics-client.ts` linhas 168-192

**Bug:** Comentario na linha 170 diz "impressions/CTR NOT available in YouTube Analytics API v2" -- FALSO. O arquivo `ab-youtube.ts:53` ja usa com sucesso `'impressions,impressionClickThroughRate'` via a mesma Analytics API.

**Fix:**
```typescript
// Line 168 - change coreMetrics to include impressions:
const coreMetrics = 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares,impressions,impressionClickThroughRate'

// Lines 180-192 - update return to read real values:
return {
  views: Number(row[0]),
  estimatedMinutesWatched: Number(row[1]),
  averageViewDuration: Number(row[2]),
  averageViewPercentage: Number(row[3]),
  subscribersGained: Number(row[4]),
  subscribersLost: Number(row[5]),
  likes: Number(row[6]),
  comments: Number(row[7]),
  shares: Number(row[8]),
  impressions: Number(row[9]) || 0,                    // fallback 0 if missing
  impressionClickThroughRate: Number(row[10]) || 0,     // fallback 0 if missing
}
```

**IMPORTANTE:** Os nomes corretos dos metricas sao `impressions` e `impressionClickThroughRate` (comprovado por `ab-youtube.ts:53`). NAO usar `videoThumbnailImpressions` ou `videoThumbnailImpressionsClickRate` (nomes errados do spec original).

**Impacto:** Performance page inteira volta a funcionar. Radar, Saude do Canal, scoring 6 eixos, AB suggestions -- tudo depende de CTR real.

**Error handling:** Se a Analytics API retornar menos colunas que esperado (channel novo sem dados de impressions), o `|| 0` fallback garante backward compatibility.

**Teste afetado:** `test/app/cms/youtube/analytics-client.test.ts` linha 231:
- Renomear teste para: `'returns core metrics with real impressions from API response'`
- Atualizar mock `coreRow` para incluir valores de impressions nos indices 9 e 10
- Assert `result!.impressions > 0` e `result!.impressionClickThroughRate > 0`

### 1.2 Purge mock/hardcoded data from AB Lab UI

| Componente | Linha | Valor fake | Fix |
|-----------|-------|-----------|-----|
| `hero-band.tsx` | 54-56 | `originalCtr: 5.2`, `leaderChance: 93` | Passar como props computadas do `AbTestActiveView` usando dados reais de ciclos |
| `live-monitor.tsx` | 60,79 | `"12 dias"`, `"5.2% da original"` | Computar do `monitor` prop: dias = diff(startedAt, now), CTR original = ciclo original ctr |
| `suggested-card.tsx` | 128 | `{video.confidence ?? 85}% conf.` | Remover fallback 85%. Se nao tem confidence, mostrar `'--'` |
| KPI sparkline | varies | Rampa fake `[40,52,58,...]` | Buscar de testes completados reais via `fetchCompletedTestStats` |
| `step-config.tsx` | 137 | `'Com ~11k impressoes/variante e CTR atual de 4,9%'` | Computar de analytics reais passados como props: `impressions={video.impressions}` `ctr={video.ctr}` |
| `playoff-banner.tsx` | varies | Probabilidades fake | Computar do Bayesian engine via `abTestStatistics` |
| `mock-dashboard.ts` | entire file | Dados mock para dashboard | **DELETE** arquivo inteiro -- nao e importado em producao |
| `mock-views.ts` | imported in `[testId]/page.tsx` | MOCK_MAP | Gate atras de `process.env.NODE_ENV === 'development'`: `const MOCK_MAP = process.env.NODE_ENV === 'development' ? { ... } : {}` |

**Nota:** `active-test-card.tsx:135 confidence * 0.7` foi reportado como "ja corrigido nesta sessao" -- CONFIRMAR no browser. Se confirmado, remover da lista. Se nao, corrigir para usar `Math.round(test.confidence)` diretamente.

### Testes afetados -- Fase 1a

- `test/youtube/ab-constants.test.ts` -- verificar se formatacao continua correta
- Adicionar smoke test visual (manual) para Performance page com dados reais

### Gate de verificacao -- Fase 1a

1. Abrir `/cms/youtube/analytics` (Performance page) -- CTR e impressions mostram valores reais (> 0)
2. Abrir `/cms/youtube/ab-lab` -- dashboard NAO mostra dados mock em producao
3. `npm run test:web` passa

---

## Fase 1b: Wire Backend Features + OAuth (~6-8h)

### 1.3 Wire built-but-disconnected backend features

| Feature | Backend ready | UI trigger needed | Arquivo UI |
|---------|-------------|-------------------|-----------|
| `AbPauseDialog` | Dialog + `pauseAbTest` action | Wire ao botao "Pausar" em `active-detail.tsx` (atualmente disabled com 'Em breve') | `active-detail.tsx` |
| **Resume** | `resumeAbTest` action | **NOVO:** Botao "Retomar" visivel quando `view.status === 'paused'` | `active-detail.tsx` |
| `AbEndTestDialog` | Dialog + `endAbTest` action | Adicionar botao "Encerrar" na toolbar | `active-detail.tsx` |
| `archiveAbTest` | Action completa | Wire ao botao "Arquivar" (atualmente disabled) | `winner-detail.tsx` |
| `pullPipelineThumbnails` | Importa thumbs do Pipeline | Botao "Importar do Pipeline" no step-variantes | `step-variantes.tsx` |
| `fetchAbBriefingData` | Briefing IA completo | Wire ao botao Cowork no step-ideias | `step-ideias.tsx` |
| `FeedView` | Preview YouTube completo | Aba "Preview" no test detail | `active-detail.tsx` |
| `BayesCurves` | Grafico curvas Bayesian | Adicionar ao test detail abaixo do confidence chart | `active-detail.tsx` |
| `autoImportWinner` | Importacao para Library | **FIX:** Chamar em `endAbTest` quando `winnerId` presente (actions.ts:850, apos update) | `actions.ts` |

**Detalhe critico -- autoImportWinner em endAbTest:**

Atualmente `autoImportWinner` so e chamado em `applyWinnerNow` (actions.ts:1276) e `ab-evaluate-phases.ts` (linhas 297, 463). Quando o usuario manualmente encerra um teste via `AbEndTestDialog` escolhendo "Aplicar variante lider", o `endAbTest` (actions.ts:772-855) aplica a thumbnail mas NAO salva na Library. Fix:

```typescript
// In endAbTest, after line 850 (after the status update succeeds):
if (winnerId) {
  try {
    await autoImportWinner(testId, siteId)
  } catch {
    // Non-fatal
  }
}
```

**Detalhe critico -- Resume button:**

O `resumeAbTest` action existe em actions.ts:688 mas tem ZERO triggers na UI. Um teste pausado e um dead end. Adicionar:
- Botao "Retomar" na toolbar de `active-detail.tsx` quando `view.status === 'paused'`
- Botao "Retomar" nos cards de testes pausados no dashboard
- Para testes pausados por drift: mostrar banner contextual (ver Fase 0.4 UI)

**Security fix -- pullPipelineThumbnails:**

`actions.ts:466-469` nao filtra por `site_id`. Fix: capturar `siteId` de `requireEditAccess()` e adicionar `.eq('site_id', siteId)` tanto na query de `ab_tests` (linha 466) quanto na query de `content_pipeline` (linha 477).

### 1.4 Fix Reconectar Token per-channel

**Arquivos:**
- `apps/web/src/app/api/social/oauth/[provider]/route.ts`
- `apps/web/src/app/api/social/oauth/[provider]/callback/route.ts`

**Problema:** OAuth popup e generico -- nao sabe qual canal reconectar. Com 2+ canais em emails diferentes, impossivel.

**Fix -- 4 passos:**

**Passo 1:** Aceitar `channel_id` como query param no botao Reconectar:
```
/api/social/oauth/google?channelId=UC_xxx
```

**Passo 2:** Em `route.ts` (linha 60), adicionar `channelId` ao state payload:
```typescript
const channelId = req.nextUrl.searchParams.get('channelId') ?? undefined
const statePayload = JSON.stringify({ siteId, userId: auth.user.id, channelId })
```

**Passo 3:** Adicionar `login_hint` ao Google OAuth URL (apos linha 72):
```typescript
// Look up channel email from youtube_channels table if channelId provided
if (channelId) {
  // login_hint pre-selects the Google account
  const { data: channel } = await getSupabaseServiceClient()
    .from('youtube_channels')
    .select('channel_name')
    .eq('channel_id', channelId)
    .eq('site_id', siteId) // SECURITY: verify channel belongs to this site
    .single()
  // YouTube channels don't store email, but login_hint with channel name helps
  // The critical validation happens in the callback (step 4)
}
url.searchParams.set('login_hint', '') // Set if email available
```

**Passo 4 (SEGURANCA):** No callback (`callback/route.ts`), apos receber o token:
```typescript
// Extract channelId from state
const { channelId } = JSON.parse(statePayload)

if (channelId) {
  // Verify the authorized account owns this channel
  const channelsRes = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const channelsData = await channelsRes.json()
  const ownedChannelIds = (channelsData.items ?? []).map((c: any) => c.id)

  if (!ownedChannelIds.includes(channelId)) {
    return NextResponse.json(
      { error: 'Conta Google nao corresponde ao canal selecionado' },
      { status: 400 }
    )
  }

  // Store token linked to specific channel
  // Use channelId as account_id in social_connections
}
```

**Graceful degradation:** Se `channelId` nao for fornecido, o fluxo funciona como antes (generico).

**Estimativa:** 2-3h

### Testes afetados -- Fase 1b

- `test/youtube/ab-p3-actions.test.ts` -- adicionar teste para autoImportWinner em endAbTest
- `test/cms/ab-pause-dialog.test.tsx` -- verificar dialog wiring
- `test/cms/ab-end-test-dialog.test.tsx` -- verificar dialog wiring
- Novo teste para pullPipelineThumbnails site_id check

### Gate de verificacao -- Fase 1b

1. Abrir teste ativo -- Pausar funciona (fecha ciclo, reverte thumbnail)
2. Teste pausado mostra botao Retomar -- Retomar funciona
3. Encerrar teste com vencedor -- thumbnail salva na Library
4. Reconectar token em canal especifico -- OAuth pre-seleciona conta correta
5. `npm run test:web` passa

---

## Fase 2a: Competitor Backend Enrichment (~3h)

> Deploy esta fase CEDO para iniciar cold start de snapshots e dados enriquecidos.

### 2.1 Enriquecer sync para capturar dados descartados

**Arquivo:** `apps/web/src/lib/youtube/competitor-sync.ts`

Dados que JA vem na API response mas sao descartados:
- `like_count` (statistics.likeCount)
- `comment_count` (statistics.commentCount)
- `tags[]` (snippet.tags)
- `category_id` (snippet.categoryId)

Dados que custam ZERO quota extra:
- `duration_seconds` (adicionar `contentDetails` ao `part` param na linha 74, mesma 1 unit/call)
- `is_short` (heuristica: duration <= 60s || '#Shorts' no titulo)

**Mudancas no codigo:**

Linha 74 -- adicionar `contentDetails` ao part:
```typescript
`${YOUTUBE_API_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`
```

Linha 56 -- mudar maxResults de 10 para 50:
```typescript
`${YOUTUBE_API_BASE}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`
```

**CRITICO: Batch DB operations para evitar N+1:**

O loop atual (linhas 81-158) faz SELECT + INSERT/UPDATE POR VIDEO. Com 50 videos x 15 canais = 750 queries sequenciais. Refatorar:

```typescript
// Instead of per-video queries, batch:
// 1. Fetch all existing videos in one query
const { data: existingVideos } = await supabase
  .from('competitor_videos')
  .select('id, video_id, title, description_hash, thumbnail_url, view_count')
  .in('video_id', videoIds)

const existingMap = new Map(existingVideos?.map(v => [v.video_id, v]) ?? [])

// 2. Iterate locally, collect inserts/updates
const newVideos: Array<...> = []
const updates: Array<...> = []
const changes: Array<...> = []

for (const video of videosData.items ?? []) {
  // ... detect changes using existingMap.get(video.id)
  // ... push to newVideos/updates/changes arrays
}

// 3. Batch insert/update
if (newVideos.length) await supabase.from('competitor_videos').insert(newVideos)
if (changes.length) await supabase.from('competitor_changes').insert(changes)
for (const upd of updates) {
  await supabase.from('competitor_videos').update(upd.data).eq('id', upd.id)
}
```

Isso reduz de ~250 DB round-trips por canal para ~4-6, mantendo dentro do timeout de 60s do Vercel.

**Per-channel error isolation:**

Wrap cada canal em try/catch para que falha em 1 canal nao bloqueie os outros 14:
```typescript
for (const channel of channels) {
  try {
    await syncCompetitorChannel(channel, apiKey)
  } catch (err) {
    Sentry.captureException(err, { extra: { channelId: channel.channel_id } })
    errors.push({ channel: channel.channel_id, error: (err as Error).message })
  }
}
```

### 2.2 Migration: novos campos + snapshot table + indexes

Usar `npm run db:new competitor_enrichment`:

```sql
-- 1. competitor_videos: novos campos
ALTER TABLE competitor_videos
  ADD COLUMN IF NOT EXISTS like_count bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS is_short boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS category_id text,
  ADD COLUMN IF NOT EXISTS original_thumbnail_url text;

-- 2. Indexes for new query patterns
CREATE INDEX IF NOT EXISTS idx_competitor_videos_tags
  ON competitor_videos USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_competitor_videos_short
  ON competitor_videos (competitor_channel_id) WHERE is_short = true;

-- 3. Index for AB test detection query
CREATE INDEX IF NOT EXISTS idx_competitor_changes_video_type
  ON competitor_changes (video_id, change_type, detected_at DESC);

-- 4. Composite index for filtered change feed
CREATE INDEX IF NOT EXISTS idx_competitor_changes_type_date
  ON competitor_changes (site_id, change_type, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_changes_bookmarked
  ON competitor_changes (site_id, detected_at DESC) WHERE bookmarked = true;

-- 5. Channel snapshots (growth tracking)
CREATE TABLE IF NOT EXISTS competitor_channel_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_channel_id uuid NOT NULL REFERENCES competitor_channels(id) ON DELETE CASCADE,
  subscriber_count bigint,
  video_count integer,
  view_count bigint,
  snapshot_date date NOT NULL,
  UNIQUE(competitor_channel_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_comp_snapshots_channel_date
  ON competitor_channel_snapshots (competitor_channel_id, snapshot_date DESC);

-- 6. RLS for snapshots
ALTER TABLE competitor_channel_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "competitor_channel_snapshots_select" ON competitor_channel_snapshots;
CREATE POLICY "competitor_channel_snapshots_select"
  ON competitor_channel_snapshots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM competitor_channels cc
    WHERE cc.id = competitor_channel_id
      AND public.can_view_site(cc.site_id)
  ));
-- Writes are service-client-only (cron sync). No INSERT/UPDATE/DELETE policies needed.
```

**Backfill existente:** Apos migration, a proxima execucao do cron competitor sync (09:00 diario) preenchera os novos campos para todos os videos existentes naturalmente. Para dados imediatos, executar `syncCompetitorNow` para cada canal via UI.

**Nota sobre dados existentes:** Rows existentes terao `like_count=0`, `comment_count=0`, `is_short=false`, `tags='{}'`. O UI deve tratar `0` como "nao coletado" para rows com `last_checked_at` anterior a esta migration. Uma flag simples: se `like_count = 0 AND view_count > 0`, provavelmente nao foi coletado ainda.

### 2.4 AB Test Detection em competidores

Query computada (NAO requer migration -- usa dados ja coletados):
```sql
SELECT video_id, count(*) as changes
FROM competitor_changes
WHERE change_type = 'thumbnail'
  AND detected_at > now() - interval '14 days'
  AND site_id = $current_site_id  -- IMPORTANT: filter by site
GROUP BY video_id
HAVING count(*) >= 2
```

Implementar como funcao em `competitor-sync.ts` ou `actions.ts` que retorna `Map<videoId, changeCount>`.

**Feature flag:** `COMPETITOR_AB_DETECTION_ENABLED` (env var, default `'true'`). Se `'false'`, skip a deteccao.

### 2.5 Notificacoes de mudancas de competidores

Em `competitor-sync.ts`, apos processar todos os videos de um canal:

```typescript
if (changesDetected > 0) {
  await createNotification({
    site_id: channelRow.site_id,
    user_id: ownerId, // lookup super_admin do site
    type: 'youtube.competitor_change',
    domain: 'youtube',
    priority: 2,
    title: `Mudanca detectada em ${channelRow.channel_name}`,
    message: `${changesDetected} mudanca(s) em videos de ${channelRow.channel_name}.`,
    action_href: '/cms/youtube/competitors?tab=mudancas',
    dedup_key: `competitor-change-${channelRow.id}-${new Date().toISOString().slice(0, 10)}`,
  })
}
```

**Batching:** Max 1 notificacao por canal por sync run (nao 1 por mudanca). Dedup key por canal + data garante max 1 por dia.

**Feature flag:** `COMPETITOR_NOTIFICATIONS_ENABLED` (env var, default `'true'`).

**Retention:** Adicionar ao ab-watchdog (apos linha 157):
```typescript
// Prune old competitor channel snapshots (365-day retention)
const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
await pruneClient
  .from('competitor_channel_snapshots')
  .delete()
  .lt('snapshot_date', oneYearAgo)
```

### Testes afetados -- Fase 2a

- `test/youtube/competitor-sync.test.ts`:
  - Adicionar `contentDetails` ao mock de video API response
  - Testar extracao de `like_count`, `comment_count`, `duration_seconds`, `is_short`, `tags`, `category_id`
  - Testar `is_short` heuristica (duration <= 60 OU '#Shorts' no titulo)
  - Testar `maxResults=50` no URL do playlistItems
  - Testar `original_thumbnail_url` armazenado no primeiro insert
  - Testar batch DB operations (se refatorado)
- **NOVO:** `test/youtube/competitor-ab-detection.test.ts`:
  - 2 thumbnail changes em 14 dias = detectado
  - 1 thumbnail change = nao detectado
  - 2 title changes (nao thumbnail) = nao detectado
  - 2 thumbnail changes > 14 dias apart = nao detectado

### Gate de verificacao -- Fase 2a

1. Migration executada com sucesso: `npm run db:push:prod`
2. Competitor sync captura novos campos: verificar via Supabase dashboard
3. Channel snapshot criado apos sync
4. `npm run test:web` passa

---

## Fase 2b: Competitor Observatory UI (~10-14h)

### 2.3 UI: Competitor Channel Page (drill-down)

Reorganizar `/cms/youtube/competitors` com abas. Usar query params para deep-linking: `?tab=canais|mudancas|outliers|insights`.

**Performance:** Substituir `export const dynamic = 'force-dynamic'` por ISR:
```typescript
export const revalidate = 3600 // 1h fallback
// In competitor-sync.ts after successful sync:
import { revalidateTag } from 'next/cache'
revalidateTag('youtube-competitors')
```

**Aba "Canais" (default `?tab=canais`):**

```
+--------------------------------------------------+
| [Canais]  [Mudancas]  [Outliers]  [Insights]     |
+--------------------------------------------------+
| +----------------------------------------------+ |
| | [Avatar] NomadaRaiz                    [Sync] | |
| | 125K inscritos | 342 videos | 2.1M views     | |
| | Crescimento: +1.2K subs/sem | Upload: 3x/sem | |
| | [> Ver videos]                  [x Remover]   | |
| +----------------------------------------------+ |
| | [Avatar] OutroCanal              [Sync icon]  | |
| | ...                                           | |
| +----------------------------------------------+ |
```

- Channel cards com: avatar, nome, subscriber_count, video_count, total view_count, engagement rate medio
- Indicador de crescimento de subs (calculado de `competitor_channel_snapshots`)
- Expandir (botao olho) mostra grid de videos com thumbnails grandes, `loading='lazy'`
- Limite de 12 videos no expand; click no nome do canal para pagina de detalhe completa (futuro)

**Empty state:** `'Nenhum canal competidor adicionado. Adicione canais para monitorar mudancas de thumbnails, titulos e estrategias.'` + botao `'Adicionar canal'`

**Aba "Mudancas" (`?tab=mudancas`):**

```
+--------------------------------------------------+
| Filtros: [Canal v] [Tipo v] [Salvos] [Periodo v] |
+--------------------------------------------------+
| 2026-06-01                                       |
| +----------------------------------------------+ |
| | [Thumb before] -> [Thumb after]  [AB badge?] | |
| | NomadaRaiz - "Video Title" | 125K views      | |
| | thumbnail | 3h atras                          | |
| | [Salvar]  [Testar esta abordagem]             | |
| +----------------------------------------------+ |
```

- Timeline agrupada por dia
- Filtros: canal, tipo de mudanca (thumbnail/title/description), bookmarked, periodo (7d/30d/90d)
- Before/after thumbnail lado a lado (mobile: stacked vertically)
- Badge "Provavel A/B test" (amber, icone FlaskConical) quando detectado (ver 2.4)
- Botao "Testar esta abordagem" (ver Fase 3.6)
- Cursor-based pagination usando `(detected_at, id)` como cursor, 20 items por pagina

**Empty state:** `'Nenhuma mudanca detectada ainda. Adicione competidores e aguarde o proximo sync (diario as 09:00).'`

**Aba "Outliers" (`?tab=outliers`):**

```
+--------------------------------------------------+
| Periodo: [7d] [30d] [90d] [Todos]  Ordenar: [Multiplicador v] |
+--------------------------------------------------+
| +------+ +------+ +------+                      |
| |[4.2x]| |[3.8x]| |[2.5x]|                      |
| |[Thumb]| |[Thumb]| |[Thumb]|                     |
| |Title  | |Title  | |Title  |                     |
| |Canal  | |Canal  | |Canal  |                     |
| |125K v.| |89K v. | |45K v. |                     |
| +------+ +------+ +------+                      |
```

**Formula para outliers de competidores** (nao temos dados age-bucketed):
```
outlier_multiplier = video.view_count / channel_avg_view_count
```
Onde `channel_avg_view_count = avg(view_count)` de todos os videos trackeados do canal.

Threshold: `outlier_multiplier >= 2.0`

**Badge tiers:**
- 2-5x: azul ("Destaque")
- 5-10x: roxo ("Viral")
- >10x: vermelho ("Mega Outlier")

**Implementacao como DB view:**
```sql
CREATE OR REPLACE VIEW competitor_video_outliers AS
SELECT v.*,
  v.view_count::float / NULLIF(ca.avg_views, 0) as outlier_multiplier
FROM competitor_videos v
JOIN (
  SELECT competitor_channel_id, avg(view_count)::float as avg_views
  FROM competitor_videos
  WHERE view_count > 0
  GROUP BY competitor_channel_id
) ca USING (competitor_channel_id)
WHERE v.view_count > 2 * ca.avg_views;
```

**Nota sobre formula:** Para outliers do PROPRIO canal (Performance page), usar formula age-adjusted do P2.5 (views at age T vs median of 9 prior uploads). A formula simplificada acima e para COMPETIDORES onde nao temos dados age-bucketed.

**Sort options:** por multiplicador (default), por views absolutas, por data
**Time range filter:** 7d/30d/90d/todos (filtra por `published_at`)

**Empty state:** `'Sem outliers nos competidores trackeados. Adicione mais canais e aguarde dados suficientes (minimo 10 videos por canal).'`

**Aba "Insights" (`?tab=insights`):**

Cada sub-secao com titulo claro:

1. **Frequencia de Upload** (heatmap)
   - Extrair `PostingHeatmap` de `social/insights/_components/posting-heatmap.tsx` para `src/components/charts/posting-heatmap.tsx` (shared). Atualizar import no Social.
   - Alimentar com dados de `competitor_videos.published_at` agrupados por dia-da-semana x hora
   - Abaixo: resumo `'Melhor horario: Terca 14h-16h'`

2. **Top Tags** (horizontal bar chart)
   - Query: `SELECT tag, count(*) FROM competitor_videos, unnest(tags) AS tag WHERE ... GROUP BY tag ORDER BY count(*) DESC LIMIT 15`
   - Cada barra clicavel (filtra competidores por tag)

3. **Comparacao de Engajamento** (bar chart)
   - Nosso canal vs cada competidor: avg views/video ultimos 30d

4. **Gap Analysis** (two-column layout)
   - Esquerda: "Tags que eles usam" (competidores)
   - Direita: "Tags que voce usa"
   - Highlighted: interseccao e gaps

**Precomputar durante sync:** Para evitar queries pesadas no page load, computar insights ao final do sync e armazenar como JSONB em `competitor_channels` (coluna `computed_insights`) ou tabela separada `competitor_site_insights`.

**Empty state por sub-secao:** `'Dados insuficientes -- adicione mais competidores para analise.'`

### States Matrix

| Tab | Loading | Empty | Error | Partial Data |
|-----|---------|-------|-------|-------------|
| Canais | 4 skeleton cards com shimmer | Ilustracao + "Nenhum canal adicionado" + CTA | Banner vermelho: "Falha ao carregar. [Tentar novamente]" | Cards normais + skeleton para os carregando |
| Mudancas | 6 skeleton rows com shimmer | "Nenhuma mudanca detectada. Aguarde o proximo sync." | Banner: "Falha ao buscar mudancas. [Tentar novamente]" | Timeline parcial + "Carregando mais..." |
| Outliers | 6 skeleton cards aspect-video | "Sem outliers. Competidores precisam de 10+ videos." | Banner retry | Cards disponiveis + nota de dados parciais |
| Insights | Skeleton heatmap + 2 skeleton charts | "Dados insuficientes. Adicione competidores." | Banner retry | Sub-secoes com dados mostradas, sem dados hidden |

### Responsive Design

- **Mobile (<640px):** Tab bar = horizontal scroll com snap. Cards stacked full-width. Before/after thumbnails stacked vertically. Heatmap scrollavel horizontalmente.
- **Tablet (640-1024px):** 2-column video grid. Side-by-side before/after em tamanho reduzido.
- **Desktop (>1024px):** Layout como especificado acima.

### Novos arquivos

```
competitors/_components/channels-tab.tsx
competitors/_components/changes-tab.tsx
competitors/_components/outliers-tab.tsx
competitors/_components/insights-tab.tsx
competitors/loading.tsx
competitors/error.tsx
```

### Testes afetados -- Fase 2b

- Testes de componente para cada tab (smoke tests de render)
- Testar cursor pagination no changes-tab
- Testar outlier computation via view

### Gate de verificacao -- Fase 2b

1. 4 tabs renderizam com dados reais
2. Filtros funcionam no change feed
3. Outliers mostram badges corretos
4. Mobile: tabs scrollam horizontalmente
5. Empty states corretos quando sem dados

---

## Fase 3: Cross-Feature Connections (~6h)

### Dependency: Fase 3.3 depende de Fase 1.1

`video_grade_history` usa CTR para calcular grades. Sem CTR real (Fix 1.1), grades sao invalidas. Apos deploy de 1.1, aguardar 7-14 dias para acumular historico de grades reais antes que sugestoes baseadas em grade sejam uteis.

### 3.1 Analytics -> AB Lab

**Arquivo:** `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-grades-v2.tsx`

`onCreateAbTest` callback prop EXISTE em `YtVideoDiagnostic` mas ninguem passa. Fix:

```typescript
// In yt-grades-v2.tsx, where YtVideoDiagnostic is rendered:
<YtVideoDiagnostic
  video={video}
  onCreateAbTest={(videoId) => {
    const weakestAxis = video.grade_breakdown?.weakest_axis
    const testType = weakestAxis === 'ctr' ? 'thumbnail' : 'title'
    router.push(`/cms/youtube/ab-lab/new?videoId=${videoId}&type=${testType}`)
  }}
/>
```

**Jornada do usuario:**
1. Ve video Grade D na Performance page
2. Expande para ver diagnostico com eixo mais fraco e recomendacao
3. Clica "Criar A/B Test"
4. Navega para `/cms/youtube/ab-lab/new?videoId={id}&type=thumbnail`
5. Wizard abre com video pre-selecionado e tipo pre-determinado

### 3.2 Videos -> AB Lab pre-selection

Links "Start A/B" devem navegar para `/cms/youtube/ab-lab/new?videoId={id}` com o video pre-selecionado.

### 3.3 Scoring -> AB Suggestions

Substituir formula crua de sugestoes por consulta ao `video_grade_history`. Videos grade D com altas impressoes = candidatos ideais.

**Cold start:** Esta feature so produz resultados uteis 7-14 dias apos a Fase 1.1 (fix CTR) ser deployada.

### 3.4 Learnings -> AI prompts

Em `fetchAbBriefingData`, chamar `getLearnings(siteId)` e incluir na prompt: "PATTERNS FROM PAST TESTS" com top 5 winning e top 3 losing tags.

### 3.5 Library -> Wizard (LibraryPickerDialog)

**NOTA: Este e um NOVO componente, nao apenas wiring. Estimativa: 2-3h.**

Adicionar "Escolher da Biblioteca" no `ThumbSlot` do wizard (step-variantes).

**Componente `LibraryPickerDialog`:**
```
+--------------------------------------------------+
| Escolher da Biblioteca                     [X]   |
+--------------------------------------------------+
| Filtros: [Tags v]  Ordenar: [Lift v]             |
+--------------------------------------------------+
| +-------+ +-------+ +-------+                    |
| |[Thumb]| |[Thumb]| |[Thumb]|                     |
| |+12.3% | |+8.7%  | |+5.2%  |                     |
| |lift    | |lift   | |lift   |                     |
| |[tags]  | |[tags] | |[tags] |                     |
| |[o o o] | |[o o o]| |[o o o]|  (longevity dots)  |
| +-------+ +-------+ +-------+                    |
+--------------------------------------------------+
```

- Grid de library entries com thumbnail, lift stats, tags, longevity dots
- Filtrar por tags e source_type (test_winner vs uploaded)
- Ordenar por lift_at_win (default), data
- Ao selecionar, `blob_url` vira imagem da variante no wizard
- Variante card no wizard mostra: "Da Biblioteca: +X% lift em teste anterior"

**Arquivo:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/library-picker-dialog.tsx` (novo)

### 3.6 Competitor -> AB Lab

Botao "Testar esta abordagem" nos items do change feed.

**Fluxo completo:**
1. Usuario clica "Testar esta abordagem" em um change feed item
2. Navega para `/cms/youtube/ab-lab/new?ref=competitor&changeId={changeId}`
3. Wizard abre no Step 1 (Ideias) com hipotese pre-preenchida: `'Inspirado em [channel_name]: mudou [thumbnail/titulo] do video "[titulo]"'`
4. Step 2 (Variantes): mostra thumbnail before/after do competidor como REFERENCIA (read-only, nao como variante -- risco de copyright)
5. Usuario seleciona um de seus proprios videos e cria sua propria variante
6. Se nenhum video selecionado, mostrar sugestoes de videos com CTR baixo na mesma categoria
7. Fluxo normal do wizard dali em diante

**Error states:**
- Canal desconectado (sem OAuth token): mostrar banner "Reconecte seu canal para criar testes"
- Nenhum video disponivel: mostrar seletor de videos completo

### Testes afetados -- Fase 3

- Testar `onCreateAbTest` callback prop passing em component test
- Testar URL query param `videoId` pre-selecao no wizard
- Testar navegacao "Testar esta abordagem" com changeId correto

### Gate de verificacao -- Fase 3

1. Click "Criar A/B Test" em video Grade D navega para wizard correto
2. "Testar esta abordagem" no change feed abre wizard com hipotese
3. Library picker mostra entries com lift stats
4. `npm run test:web` passa

---

## Fase 4: Design Consistency (~4-6h)

### 4.1 Migrate zinc-* -> CMS tokens

83+ referencias em:
- `competitor-dashboard.tsx` (39 ocorrencias)
- `library-dashboard.tsx` (15 ocorrencias)
- `active-detail.tsx` (11 ocorrencias)
- `signal-card.tsx` (8 ocorrencias)
- `freshness-dot.tsx` (5 ocorrencias)
- `fatigue-card.tsx` (3 ocorrencias)
- `suggested-card.tsx` (1 ocorrencia)
- `learnings-panel.tsx` (1 ocorrencia)

**Mapping table (context-dependent):**

| zinc usage | Context | CMS token |
|-----------|---------|-----------|
| `text-zinc-400` | Dim/placeholder text | `text-cms-text-dim` |
| `text-zinc-500` | Muted text, secondary | `text-cms-text-muted` |
| `text-zinc-600` | Muted text, slightly stronger | `text-cms-text-muted` |
| `text-zinc-700` | Primary text on light bg | `text-cms-text` |
| `bg-zinc-50` | Light surface | `bg-cms-surface` |
| `bg-zinc-100` | Surface hover | `bg-cms-surface-hover` |
| `bg-zinc-800` | Dark surface (sidebar bg) | `bg-cms-bg-side` |
| `bg-zinc-900` | Dark background | `bg-cms-bg` |
| `border-zinc-200` | Light border | `border-cms-border` |
| `border-zinc-300` | Stronger border | `border-cms-border` |
| `border-zinc-700` | Dark border | `border-cms-border` |

### 4.2 Portuguese consistency -- YouTube String Dictionary

**PRIORIDADE 1: `ab-constants.ts` locale fix (MAIOR IMPACTO)**

**Arquivo:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-constants.ts` linhas 30-31

```typescript
// CHANGE FROM:
const numberFmt = new Intl.NumberFormat('en')
const dateFmt = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

// CHANGE TO:
const numberFmt = new Intl.NumberFormat('pt-BR')
const dateFmt = new Intl.DateTimeFormat('pt-BR', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
```

Esta unica mudanca corrige formatacao de numeros e datas em TODA o AB Lab.

**PRIORIDADE 2: youtube-shell.tsx tab labels**

**Arquivo:** `apps/web/src/app/cms/(authed)/youtube/_components/youtube-shell.tsx` linhas 12-21

```typescript
const TABS = [
  { label: 'Painel', href: '/cms/youtube' },
  { label: 'Videos', href: '/cms/youtube/videos' },          // Videos stays same
  { label: 'A/B Lab', href: '/cms/youtube/ab-lab' },          // A/B stays same
  { label: 'Categorias', href: '/cms/youtube/categories' },
  { label: 'Comentarios', href: '/cms/youtube/comments' },
  { label: 'Conteudo', href: '/cms/youtube/content' },
  { label: 'Competidores', href: '/cms/youtube/competitors' },
  { label: 'Desempenho', href: '/cms/youtube/analytics' },
] as const
```

**PRIORIDADE 3: dashboard-connected.tsx full translation**

| English | Portuguese | Context |
|---------|-----------|---------|
| `timeAgo`: `'Xm ago'`, `'Xh ago'`, `'Xd ago'` | `'Xm atras'`, `'Xh atras'`, `'Xd atras'` | Funcao `timeAgo` linhas 64-72 |
| `'Never'` | `'Nunca'` | Linha 253 (never synced) |
| `'Latest:'` | `'Mais recente:'` | Linha 323 |
| `'videos'` | `'videos'` | OK as-is |
| `'subscribers'` | `'inscritos'` | |
| `'total views'` | `'views totais'` | |
| `'total likes'` | `'curtidas totais'` | |
| `'Featured'` | `'Destaque'` | |
| `'Hidden'` | `'Oculto'` | |
| `'Last sync'` | `'Ultimo sync'` | |
| `'no changes'` | `'sem mudancas'` | |
| `'Syncing...'` | `'Sincronizando...'` | |
| `'Sync All'` | `'Sincronizar Todos'` | |
| `'First Sync'` | `'Primeiro Sync'` | |
| `'Remove weekly pick?'` | `'Remover video da semana?'` | Dialog |
| `'The home page will fall back...'` | `'A home page mostrara o ultimo video...'` | Dialog body |
| `'Cancel'` | `'Cancelar'` | Dialog button |
| `'Unpin'` | `'Desafixar'` | Dialog button |
| `'No video pinned this week'` | `'Nenhum video fixado esta semana'` | |
| `'Choose Weekly Pick'` | `'Escolher Video da Semana'` | |
| `'Change pick'` | `'Trocar video'` | |
| `'Extend 7d'` | `'Estender 7d'` | |
| `'Pin expired'` | `'Fixacao expirada'` | |
| `'Choose New Pick'` | `'Escolher Novo Video'` | |
| `'No YouTube channels configured'` | `'Nenhum canal YouTube configurado'` | |
| `'pending category suggestions'` | `'sugestoes de categoria pendentes'` | |
| `'Review'` | `'Revisar'` | |
| `'Schedule Config'` | `'Configuracao de Agenda'` | Schedule editor |
| `'Sync enabled'` | `'Sync ativado'` | |
| `'Posting Schedule'` | `'Agenda de Publicacao'` | |
| `'Add group'` | `'Adicionar grupo'` | |
| `'Max 3 groups'` | `'Maximo 3 grupos'` | |
| `'Save'` | `'Salvar'` | |
| `'Saved'` | `'Salvo'` | |
| `'Error saving'` | `'Erro ao salvar'` | |
| `toLocaleDateString('en', ...)` (linha 345) | `toLocaleDateString('pt-BR', ...)` | Date format |

**Tambem corrigir:** `video-row-actions.tsx` linhas 190 e 233: `toLocaleDateString('en')` -> `toLocaleDateString('pt-BR')`

### 4.3 Error boundaries

Criar `error.tsx` para:
- `youtube/error.tsx` (root)
- `youtube/ab-lab/error.tsx`
- `youtube/competitors/error.tsx`
- `youtube/analytics/error.tsx`

Template baseado nos `error.tsx` do Social module:
```typescript
'use client'
import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  return (
    <div className="flex flex-col items-center justify-center p-8 text-cms-text">
      <h2 className="text-lg font-semibold mb-2">Algo deu errado</h2>
      <p className="text-cms-text-muted mb-4">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 bg-cms-accent text-white rounded">
        Tentar novamente
      </button>
    </div>
  )
}
```

### 4.4 Loading skeletons

Adicionar `loading.tsx` para: competitors, categories, comments, content (4 paginas sem skeleton).

### 4.5 Tab overflow mobile

`overflow-x-auto` na nav de 8 tabs em `youtube-shell.tsx`. Atualmente quebra em telas < 900px.

```typescript
// In youtube-shell.tsx, the tab container:
<nav className="flex gap-1 overflow-x-auto scrollbar-hide border-b border-cms-border px-4">
  {TABS.map(tab => ...)}
</nav>
```

Aplicar mesma correcao ao sub-nav de 4 tabs dos Competitors.

### Politica de Termos Bilingues

**Sempre em ingles (termos tecnicos universais do YouTube):**
CTR, A/B, ABBA, thumbnail, burn-in, playlist, Shorts, upload, sync, views (como unidade metrica), likes, subscribers, live, stream, SEO, tags

**Sempre em portugues (UI labels e acoes):**
visualizacoes (quando label completo), inscritos, curtidas, comentarios, compartilhamentos, buscar, salvar, cancelar, configurar, retomar, pausar, encerrar, arquivar, duplicar, escolher, adicionar, remover

**Flexivel (usar portugues com termo em ingles se necessario):**
outlier, engagement ("taxa de engajamento"), heatmap ("mapa de calor"), gap analysis ("analise de gaps"), feed

### Testes afetados -- Fase 4

- Verificar que ab-constants formatacao funciona com pt-BR (test/youtube/ab-constants.test.ts)
- Visual: verificar todas as paginas YouTube em portugues

### Gate de verificacao -- Fase 4

1. Zero zinc-* references nos arquivos listados
2. Navegar todas as paginas YouTube -- tudo em portugues
3. Numeros formatados pt-BR (1.000,50 nao 1,000.50)
4. Error boundaries funcionam (testar com throw manual)
5. `npm run test:web` passa

---

## Fase 5: Observabilidade (~2h)

### 5.1 Sentry nos crons de competidores

Em `sync-youtube?mode=competitors`, adicionar:
```typescript
Sentry.captureMessage('Competitor sync completed', {
  level: 'info',
  extra: { channelsProcessed, totalChanges, totalErrors },
  tags: { cron: 'sync-youtube-competitors' },
})
```

### 5.2 LGPD basis para dados de competidores

Dados de competidores (nomes de canais, subscriber counts, titulos de videos, view counts, thumbnail URLs) constituem processamento de dados pessoais de terceiros sob LGPD.

**Base legal:** Interesse legitimo (Art. 7 IX) para analise competitiva.
**Retencao:** 90 dias auto-prune para competitor_changes (ja implementado, bookmarked excluido). competitor_videos retidos enquanto canal trackeado. Ao remover canal, CASCADE deleta todos dados associados.

### 5.3 URL allowlist para fetchVariantImageBuffer

**Arquivo:** `apps/web/src/lib/youtube/ab-youtube.ts` linha 74

Adicionar validacao de URL no inicio da funcao:
```typescript
export async function fetchVariantImageBuffer(blobUrl: string) {
  // Defense-in-depth: only allow known image hosts
  const allowed = [
    '.public.blob.vercel-storage.com',
    '.ytimg.com',
    '.ggpht.com',
    '.googleusercontent.com',
  ]
  const hostname = new URL(blobUrl).hostname
  if (!allowed.some(suffix => hostname.endsWith(suffix))) {
    throw new Error(`Blocked image fetch from untrusted host: ${hostname}`)
  }
  // ... rest of function
}
```

---

## Quota Budget (corrigido)

### YouTube Data API v3 (10,000 units/dia)

| Operacao | Units/dia | % | Notas |
|----------|-----------|---|-------|
| **Reads** | | | |
| Own channel schedule sync (48 runs x ~3 units) | ~144 | 1.44% | playlistItems + videos.list + channelStats |
| Own channel catchall (1 run x ~5 units) | ~5 | 0.05% | |
| Own channel metrics (2 runs x ~3 units) | ~6 | 0.06% | |
| AB poll (24 runs x N tests x 1 unit) | ~24/teste | 0.24%/teste | **Escala: 5 testes = 120 units** |
| AB watchdog drift check (2 runs x N thumb tests x 1) | ~2/teste | 0.02%/teste | |
| Competitor sync (1 run x 15 canais x 3 units) | ~45 | 0.45% | channels + playlistItems + videos.list |
| **Writes** | | | |
| AB rotation thumbnails.set (1/dia/teste) | **50/teste** | **0.5%/teste** | **CRITICO: esquecido no spec original** |
| AB rotation videos.update (combo tests) | **50/teste combo** | **0.5%/teste** | read-modify-write = 1 + 50 |
| **Cenarios** | | | |
| Light (1 canal, 5 comp, 1 thumb test) | ~270 | 2.7% | |
| Normal (1 canal, 15 comp, 3 thumb tests) | ~480 | 4.8% | |
| Heavy (1 canal, 15 comp, 5 combo tests) | ~810 | 8.1% | |
| Maximum (2 canais, 30 comp, 10 combo tests) | ~1800 | 18% | Ainda seguro |

### YouTube Analytics API (quota separada, 10,000 units/dia)

| Operacao | Units/dia | Notas |
|----------|-----------|-------|
| AB backfill (1 run x N tests) | ~5-20 | Per-video dimension queries |
| sync-analytics-metrics (1 run) | ~3-5 | Channel-level |
| **Total Analytics** | ~10-25 | **< 0.3%** |

**IMPORTANTE:** YouTube Analytics API tem quota SEPARADA da Data API. Nao conflitar.

### Estrategia de prioridade de quota

Se quota restante < 500 units as 08:00:
1. **Prioridade 1:** AB rotations (mission-critical, thumbnails em videos ao vivo)
2. **Prioridade 2:** AB polling
3. **Prioridade 3:** Own channel sync
4. **Prioridade 4:** Competitor sync (pode ser adiado 1 dia)

Implementar verificacao simples: antes de cada cron, checar `SUM(quota_used) FROM youtube_sync_log WHERE date = TODAY`. Se > 9500, skip operacoes de prioridade 4.

---

## O que NAO esta neste spec (deliberadamente)

- **Crons POST->GET fix** -- auditoria futura, newsletters ainda nao em uso
- **Thumbnail Search global** -- requer infra impossivel ($$$)
- **Browse AB tests globais** -- requer monitoramento global
- **View count time-series** (snapshots por video) -- Tier 2, cold start de 2-4 semanas
- **Topic extraction NLP** -- Tier 2, complexidade moderada
- **Chrome extension** -- fora do escopo CMS
- **Collections** (Library evoluida com named groups) -- spec separado, Fase 2b Library ja tem tags
- **Perceptual hash (pHash) para drift detection** -- especificado como future enhancement. SHA-256 ou URL comparison suficiente por agora com o fix 0.1
- **Cron health dashboard UI** -- nice-to-have, dados ja existem em cron_health table
- **Runtime quota tracking table** -- implementar quando usage se aproximar de 50%

---

## Estrategia de deploy

| Deploy | Conteudo | Motivo |
|--------|---------|--------|
| **Deploy 1** | Fase 0 (bug fixes) + Migration drift_acknowledged | Para dados de testes ativos sendo corrompidos AGORA |
| **Deploy 2** | Fase 1a (CTR fix) | Desbloqueia dados reais na Performance page |
| **Deploy 3** | Fase 2a backend + Migration competitor_enrichment | Inicia cold start de dados enriquecidos e snapshots |
| **Deploy 4** | Fase 1b + Fase 2b + Fase 3 + Fase 4 + Fase 5 | Batch de features e polish |

**Total estimado: 3-4 pushes para prod. Cada push aciona 4 builds Vercel.**

---

## Grafo de dependencias

```
Fase 0 (bugs) ──┬──> Fase 1a (CTR fix) ──> Fase 3.3 (scoring suggestions, +7-14d cold start)
                │
                ├──> Fase 1b (wire features, parallel)
                │
                └──> Fase 2a (backend enrich) ──> Fase 2b (UI) ──> Fase 3.6 (competitor->AB)

Fase 1a ──> Fase 1.2 (mock purge, needs real data)

Fase 2b (outliers tab) ──> Fase 3.1 (analytics->AB, independent)
                          ──> Fase 3.5 (library picker, independent)

Fase 4 (design) -- independente de todas, pode ser intercalada
```

Items DENTRO de uma fase que podem ser paralelizados:
- Fase 1b: os 8 wirings sao independentes entre si
- Fase 2b: os 4 tabs sao independentes uma vez que o data layer existe
- Fase 3: todas as 6 conexoes sao independentes

---

## Estimativa total revisada

| Fase | Estimativa | Sessoes |
|------|-----------|---------|
| Fase 0: Bug fixes | 3-4h | 1 sessao |
| Fase 1a: CTR + mock purge | 4-5h | 1 sessao |
| Fase 1b: Wire features + OAuth | 6-8h | 1 sessao |
| Fase 2a: Backend enrichment | 3h | Pode combinar com 1b |
| Fase 2b: Competitor UI (4 tabs) | 10-14h | 2 sessoes |
| Fase 3: Cross-feature connections | 6-8h | 1 sessao |
| Fase 4: Design consistency | 4-6h | 1 sessao |
| Fase 5: Observabilidade | 2h | Pode combinar com 4 |
| Fase 6: Gerar spec proxima sprint | 1-2h | Ao final desta sprint |
| **Total** | **39-52h** | **5-8 sessoes** |

---

## Fase 6: Gerar Spec da Proxima Sprint (~1-2h)

> Executar ao FINAL de todas as fases anteriores, quando o ecossistema estiver estavel.
> O objetivo e preparar o proximo ciclo de melhorias com spec completo pronto pra implementar.

### 6.1 Collections Feature (Library evoluida)

Evoluir a Thumbnail Library de uma lista flat com tags para um sistema de colecoes nomeadas:

**Escopo do spec a gerar:**
- Colecoes nomeadas (ex: "Thumbnails com Close-up", "Texto Bold", "Antes/Depois")
- Drag-to-collection para organizar entries
- Collection-level metadata (descricao, cor, icone)
- Browse por colecao com filtros internos
- Share collection como inspiracao (read-only link)
- Import de thumbnails de competidores para colecoes (via competitor observatory)
- Auto-collection de winners agrupados por pattern tag (ex: "ancoragem de preco" auto-agrupa winners com essa tag)
- UI: sidebar de colecoes + grid de entries, similar ao Finder do macOS ou Pinterest boards

**Dependencias:** Fase 2b (competitor UI com thumbnails enriquecidas), Fase 3.5 (LibraryPickerDialog)

### 6.2 Perceptual Hash (pHash) para Drift Detection

Substituir comparacao de URLs por comparacao de conteudo visual das thumbnails:

**Escopo do spec a gerar:**
- Implementar pHash (perceptual hash) ou dHash (difference hash) para comparar imagens
- No sync/apply, computar hash da thumbnail e armazenar em `ab_test_cycles.applied_metadata.thumbnail_hash`
- No watchdog drift check, baixar thumbnail atual do YouTube, computar hash, comparar com hash armazenado
- Threshold de Hamming distance para determinar "mesma imagem" vs "diferente" (tipicamente <= 10 bits de diferenca = mesma imagem)
- Vantagens: elimina falsos positivos de URL (CDN hostname rotation, query param changes), detecta mudancas REAIS no conteudo visual
- Opcoes de implementacao: (a) sharp + custom dHash em Node.js (~50 linhas), (b) biblioteca `imghash` do npm, (c) Vercel Edge Image Analysis se disponivel
- Performance: computar hash de uma thumbnail 480x360 < 50ms, comparar dois hashes < 1ms
- Fallback: se hash computation falhar, cair de volta pra URL comparison (current fix 0.1)
- Testes: testar com imagens identicas (hash match), thumbnails diferentes (hash diverge), mesma imagem em resolucoes diferentes (hash match), imagem com compressao JPEG diferente (hash match dentro do threshold)

**Dependencias:** Fase 0.1 (drift detection fix com URL comparison como baseline)

### 6.3 Social Blade-style Channel Analytics

Adicionar features inspiradas no Social Blade para canais proprios e competidores:

**Escopo do spec a gerar:**
- **Projecao de crescimento** — "em 1 ano: X inscritos" usando regressao linear sobre `competitor_channel_snapshots` (dados da Fase 2a). Para canais proprios, usar `youtube_channels` snapshots. Mostrar projecao 30d, 90d, 1 ano.
- **Ranking dentro do nicho** — leaderboard entre seus competidores trackeados (nao global). Ranking por: subs, views/video, engagement rate, upload frequency. Badge: "#1 no seu nicho" / "#3 de 15".
- **Daily subscriber delta** — grafico de "+X subs/dia" derivado de `competitor_channel_snapshots`. Barras verdes (ganho) e vermelhas (perda). Comparar com media do periodo.
- **Channel grade card** — similar ao Social Blade grades (A+, A, B+, etc.) mas baseado em metricas relativas ao nicho, nao globais. Eixos: crescimento de subs, regularidade de upload, engajamento, views/video.
- **Comparison table** — tabela side-by-side: seu canal vs competidores com todas as metricas.
- **Growth alerts** — notificacao quando um competidor cresce >10% em 7 dias (spike de growth).

**Dados necessarios:** `competitor_channel_snapshots` (Fase 2a — ja planejado). Para canais proprios, snapshots equivalentes (adicionar `youtube_channel_snapshots` ou reusar analytics daily metrics).

**UI:** Sub-tab "Growth" dentro da aba Insights do Competitor Observatory, e widget "Social Blade" no Dashboard principal.

**Dependencias:** Fase 2a (competitor channel snapshots), Fase 2b (competitor UI com abas)

### 6.4 Runtime Quota Monitoring

Dashboard e alertas para monitorar consumo da YouTube Data API quota:

**Escopo do spec a gerar:**
- Nova tabela `youtube_quota_daily` com colunas: date, operation, units_used, cron_source
- Cada chamada a YouTube API registra units consumidas (channels.list=1, videos.list=1, playlistItems=1, thumbnails.set=50, videos.update=50, search.list=100)
- Dashboard em `/cms/youtube/settings` ou sub-tab de Performance mostrando:
  - Barra de progresso diaria (usado/10,000)
  - Breakdown por operacao (pie chart)
  - Historico 30 dias (area chart)
  - Top consumers (quais crons gastam mais)
- Alertas:
  - Warning quando usage > 50% (5,000 units) -- log + Sentry info
  - Critical quando usage > 80% (8,000 units) -- pausar operacoes de prioridade 4 (competitor sync)
  - Emergency quando usage > 95% (9,500 units) -- pausar tudo exceto AB rotations
- Scaling scenarios: tabela mostrando projecao de quota para N testes ativos x M canais competidores
- Retry budget: cada operacao tem max 2 retries, cada retry conta quota. Abort apos 2 retries pra nao desperdicar quota em failures.
- Integracao com cron health: cron que falha por quota exhaustion deve reportar `reason: 'quota_exhausted'` no cron_health

**Dependencias:** Todas as fases anteriores (pra ter dados reais de consumo), especialmente Fase 2a (competitor sync enriquecido que consome mais)

### Gate de verificacao -- Fase 6

Para CADA sub-spec (6.1, 6.2, 6.3, 6.4):
1. Spec escrito em `docs/superpowers/specs/YYYY-MM-DD-{topic}-design.md`
2. Spec revisado por 3+ sub-agents especializados
3. Score >= 85/110
4. Spec commitado no git
5. Pronto pra implementacao na proxima sprint

---

## Prioridade de implementacao (ordem mandatoria)

1. **Fase 0: Bug fixes AB Lab** (~3-4h) -- BLOQUEANTE, dados sendo corrompidos
2. **Fase 1a: Fix CTR bug + purge mocks** (~4-5h) -- Performance page volta a funcionar
3. **Fase 2a: Enriquecer competitor sync + migration** (~3h) -- cold start de dados
4. **Fase 1b: Wire backend features + OAuth** (~6-8h) -- Pausar/Retomar/Encerrar funcionam
5. **Fase 2b: Competitor UI rich** (~10-14h) -- abas, outliers, change feed, AB detection
6. **Fase 3: Cross-feature connections** (~6-8h) -- ecossistema integrado
7. **Fase 4: Design consistency + i18n** (~4-6h) -- visual unificado, portugues
8. **Fase 5: Observabilidade** (~2h) -- Sentry, LGPD, security hardening
9. **Fase 6: Gerar specs proxima sprint** (~1-2h) -- Collections, pHash, Social Blade analytics, Quota monitoring