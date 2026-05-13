# Social Hub — Design Spec

**Date:** 2026-05-12
**Status:** Draft
**Sprint:** 5h — Social Hub (`@tn-figueiredo/social`)
**Estimated effort:** ~78h
**Pre-conditions:** Supabase prod project `novkqtvcnsiwhkxihurk` on-schema. Vercel Pro plan (cron every minute). Media system (Sprint 5g) operational. Google OAuth verification + Meta App Review submitted (2+ weeks lead time).

---

## 1. Overview

Modulo cross-platform de gestao de redes sociais. Permite agendar posts, gerenciar videos do YouTube (metadata, thumbnails), distribuir conteudo em multiplas plataformas, e monitorar status de entrega em tempo real via Supabase Realtime.

### 1.1 Providers (Phase 1)

| Provider | Protocolo | Custo | SDK |
|----------|-----------|-------|-----|
| YouTube | Data API v3 | Gratis (10k units/dia) | `@googleapis/youtube` |
| Facebook Pages | Graph API v25.0 | Gratis | `facebook-nodejs-business-sdk` |
| Instagram (Stories/Reels) | Graph API v25.0 | Gratis | `facebook-nodejs-business-sdk` |
| Bluesky | AT Protocol | Gratis (open API) | `@atproto/api` |

**X.com removido do escopo** — pricing pay-per-use inviavel para uso pessoal.

### 1.2 Custo total: $0

Todos os providers sao completamente gratuitos:
- YouTube Data API v3: free, 10.000 units/dia
- Meta Graph API (FB + IG): free, sem tiers pagos
- Bluesky AT Protocol: free, API aberta

### 1.3 Non-Goals

- Analytics de engajamento (likes, shares, comments) — futuro sprint
- Multi-account por provider (v1 = 1 conta por provider por site)
- Editor de imagem/video inline (usa Media System existente)
- Mobile app
- Gerenciamento de DMs/inbox de redes sociais

---

## 2. Arquitetura

### 2.1 Package Structure

```
@tn-figueiredo/social/
  src/
    core/
      types.ts                  → Provider, Job, Token, Schedule, ContentSpec
      token-vault.ts            → AES-256-GCM encrypted token storage
      media-validator.ts        → per-placement format/size/duration validation
      content-adapter.ts        → platform-specific text formatting + truncation
      quota-manager.ts          → per-provider daily quota tracking (YouTube focus)

    providers/
      youtube/
        client.ts               → resumable upload session init, metadata CRUD, thumbnail swap
        scheduler.ts            → private→public transition orchestrator
        quota.ts                → unit costs per operation, daily tracker
      meta/
        oauth.ts                → shared OAuth for Facebook + Instagram
        facebook.ts             → page post, OG scrape+verify, link sharing
        instagram.ts            → story publish, reel publish, media spec validation
      bluesky/
        client.ts               → AT Protocol session management
        post.ts                 → create post with rich text facets
        link-embed.ts           → fetch OG → upload blob → embed external

    index.ts                    → tree-shakeable public API
```

### 2.2 CMS Integration (`apps/web`)

```
apps/web/
  src/
    app/
      cms/
        social/
          page.tsx              → Social Calendar (lista + calendario)
          new/
            page.tsx            → Social Composer
          [id]/
            page.tsx            → Social Status Dashboard
        settings/
          social/
            page.tsx            → Social Settings (connections)
      api/
        social/
          youtube/
            upload-session/
              route.ts          → Cria resumable upload session
          cron/
            social-publish/
              route.ts          → Vercel Cron (every minute)
    lib/
      social/
        actions.ts              → Server actions (CRUD posts, connections)
        workflows.ts            → Vercel Workflows orchestration
        realtime.ts             → Supabase Realtime subscriptions
```

### 2.3 Fluxo de Dados

```
                                  +-----------------------+
                                  |   CMS UI (Composer)   |
                                  |  /cms/social/new      |
                                  +-----------+-----------+
                                              |
                                   schedules post (UTC)
                                              |
                                              v
                              +-------------------------------+
                              |     social_posts (DB)         |
                              |   status = 'scheduled'        |
                              |   scheduled_at = TIMESTAMPTZ  |
                              +-------------------------------+
                                              |
                               Vercel Cron (every 1min)
                               polls: scheduled_at <= now()
                                              |
                                              v
                              +-------------------------------+
                              |    Vercel Workflow Engine      |
                              |  (parallel per platform)       |
                              +--+-------+--------+-------+---+
                                 |       |        |       |
                                 v       v        v       v
                              YouTube  Facebook Instagram Bluesky
                                 |       |        |       |
                                 v       v        v       v
                              +-------------------------------+
                              |   social_deliveries (DB)      |
                              |   status per platform         |
                              +-------------------------------+
                                              |
                                  Supabase Realtime event
                                              |
                                              v
                              +-------------------------------+
                              |  CMS UI (Status Dashboard)    |
                              |  /cms/social/[id]             |
                              |  live updates per platform    |
                              +-------------------------------+
```

---

## 3. Database Schema

### 3.1 Tables

4 novas tabelas com RLS, todas em `public` schema.

#### `social_connections` — OAuth connections

Tokens encriptados AES-256-GCM na camada de aplicacao (nao pgcrypto).

```sql
CREATE TABLE IF NOT EXISTS public.social_connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL CHECK (provider IN ('youtube','facebook','instagram','bluesky')),
  account_id          TEXT NOT NULL,
  account_name        TEXT,
  access_token_enc    TEXT NOT NULL,
  refresh_token_enc   TEXT,
  page_token_enc      TEXT,           -- Facebook Page token (never expires)
  token_expires_at    TIMESTAMPTZ,
  scopes              TEXT[],
  metadata            JSONB DEFAULT '{}',   -- provider-specific: channel_id, ig_user_id, page_id, did
  connected_at        TIMESTAMPTZ DEFAULT now(),
  revoked_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(site_id, provider, account_id)
);
```

**`metadata` JSONB por provider:**

| Provider | Campos esperados |
|----------|-----------------|
| YouTube | `{ channel_id, channel_title }` |
| Facebook | `{ page_id, page_name }` |
| Instagram | `{ ig_user_id, ig_username, business_account_id }` |
| Bluesky | `{ did, handle, pds_url }` |

#### `social_posts` — Posts agendados

```sql
CREATE TABLE IF NOT EXISTS public.social_posts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  created_by          UUID NOT NULL REFERENCES auth.users(id),
  type                TEXT NOT NULL CHECK (type IN ('link','video','image','text')),
  status              TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','publishing','completed','partial_failure','failed','cancelled')),
  scheduled_at        TIMESTAMPTZ,
  user_timezone       TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  published_at        TIMESTAMPTZ,
  content             JSONB NOT NULL,
  template_id         TEXT,
  idempotency_key     TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

**`content` JSONB schema:**

```typescript
const SocialPostContent = z.object({
  title:        z.string().optional(),
  description:  z.string().optional(),
  url:          z.string().url().optional(),
  hashtags:     z.array(z.string()).optional(),
  media_urls:   z.array(z.string().url()).optional(),
  video_id:     z.string().optional(),        // YouTube video ID (pre-uploaded)
});
```

**Status machine:**

```
  draft ──────────> scheduled ──────────> publishing
    ^                   |                    |
    |                   v                 +--+--+--------+
    |               cancelled             |     |        |
    |                                     v     v        v
    +──────────────────────────────── completed  partial  failed
                                                _failure
```

#### `social_deliveries` — Tracking per-platform

```sql
CREATE TABLE IF NOT EXISTS public.social_deliveries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id             UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  connection_id       UUID NOT NULL REFERENCES public.social_connections(id),
  provider            TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','publishing','published','failed','retrying','skipped')),
  platform_post_id    TEXT,
  platform_url        TEXT,
  content_override    JSONB,           -- platform-specific text/media overrides
  attempt             INT DEFAULT 0,
  max_attempts        INT DEFAULT 3,
  last_error          TEXT,
  error_type          TEXT CHECK (error_type IN ('permanent','transient','auth')),
  published_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);
```

**Error classification:**

| Tipo | Exemplos | Acao |
|------|----------|------|
| `permanent` | Formato invalido, policy violation, conta suspensa | Nao retenta, notifica user |
| `transient` | Rate limit, network error, server error | Retry exponential backoff (max 3x) |
| `auth` | Token expirado/revogado | Tenta refresh, se falhar → `skipped`, pede re-auth |

#### `youtube_quota_usage` — YouTube quota tracking

```sql
CREATE TABLE IF NOT EXISTS public.youtube_quota_usage (
  date                DATE PRIMARY KEY,
  site_id             UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  units_used          INT NOT NULL DEFAULT 0,
  operations          JSONB DEFAULT '[]',
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

**Quota costs por operacao:**

| Operacao | Units |
|----------|-------|
| `videos.insert` (upload) | 1.600 |
| `videos.update` (metadata) | 50 |
| `thumbnails.set` | 50 |
| `videos.list` (read) | 1 |
| `search.list` | 100 |

Budget diario: 10.000 units = ~6 uploads + metadata ops. Warning automatico ao atingir 80%.

### 3.2 Indexes

```sql
CREATE INDEX idx_social_connections_site ON social_connections(site_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_social_posts_scheduled ON social_posts(scheduled_at)
  WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;
CREATE INDEX idx_social_posts_site ON social_posts(site_id, status);
CREATE INDEX idx_social_deliveries_post ON social_deliveries(post_id);
CREATE INDEX idx_social_deliveries_status ON social_deliveries(status)
  WHERE status IN ('pending', 'publishing', 'retrying');
CREATE INDEX idx_youtube_quota_site_date ON youtube_quota_usage(site_id, date);
```

**Rationale:** O index `idx_social_posts_scheduled` e o mais critico — usado pelo cron a cada minuto para encontrar posts prontos para publicar. Partial index (`WHERE status = 'scheduled'`) mantem o index compacto.

### 3.3 RLS Policies

```sql
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_quota_usage ENABLE ROW LEVEL SECURITY;

-- social_connections: site admin CRUD
DROP POLICY IF EXISTS social_connections_read ON social_connections;
CREATE POLICY social_connections_read ON social_connections FOR SELECT
  USING (public.can_edit_site(site_id));
DROP POLICY IF EXISTS social_connections_write ON social_connections;
CREATE POLICY social_connections_write ON social_connections FOR ALL
  USING (public.can_edit_site(site_id));

-- social_posts: members read, admin CRUD
DROP POLICY IF EXISTS social_posts_read ON social_posts;
CREATE POLICY social_posts_read ON social_posts FOR SELECT
  USING (public.can_view_site(site_id));
DROP POLICY IF EXISTS social_posts_write ON social_posts;
CREATE POLICY social_posts_write ON social_posts FOR ALL
  USING (public.can_edit_site(site_id));

-- social_deliveries: members read, service role write
DROP POLICY IF EXISTS social_deliveries_read ON social_deliveries;
CREATE POLICY social_deliveries_read ON social_deliveries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM social_posts p
    WHERE p.id = post_id AND public.can_view_site(p.site_id)
  ));

-- youtube_quota_usage: members read, service role write
DROP POLICY IF EXISTS youtube_quota_read ON youtube_quota_usage;
CREATE POLICY youtube_quota_read ON youtube_quota_usage FOR SELECT
  USING (public.can_view_site(site_id));
```

`social_deliveries` e `youtube_quota_usage` escrita exclusivamente via service role (workflow engine). Sem policy de escrita para usuarios normais.

### 3.4 Triggers

```sql
-- Auto-update updated_at
CREATE OR REPLACE FUNCTION social_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_social_connections_updated ON social_connections;
CREATE TRIGGER trg_social_connections_updated
  BEFORE UPDATE ON social_connections
  FOR EACH ROW EXECUTE FUNCTION social_updated_at();

DROP TRIGGER IF EXISTS trg_social_posts_updated ON social_posts;
CREATE TRIGGER trg_social_posts_updated
  BEFORE UPDATE ON social_posts
  FOR EACH ROW EXECUTE FUNCTION social_updated_at();
```

---

## 4. Token Vault

### 4.1 Encriptacao AES-256-GCM

Encriptacao na camada de aplicacao (nao pgcrypto — nao suporta GCM):

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH  = 12
const TAG_LENGTH = 16

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  // Format: base64(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(encoded: string, key: Buffer): string {
  const buf = Buffer.from(encoded, 'base64')
  const iv  = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ct  = buf.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ct).toString('utf8') + decipher.final('utf8')
}
```

### 4.2 Master Key

Env var: `SOCIAL_MASTER_KEY` — 32 bytes, hex-encoded (64 caracteres hex).

```bash
# Gerar novo master key:
openssl rand -hex 32
```

### 4.3 Key Rotation

Re-encriptar todos os tokens quando master key muda:

```typescript
async function rotateTokens(oldKey: Buffer, newKey: Buffer): Promise<void> {
  const connections = await db.selectAll('social_connections')
  for (const conn of connections) {
    const updates: Record<string, string> = {}
    if (conn.access_token_enc) {
      updates.access_token_enc = encrypt(decrypt(conn.access_token_enc, oldKey), newKey)
    }
    if (conn.refresh_token_enc) {
      updates.refresh_token_enc = encrypt(decrypt(conn.refresh_token_enc, oldKey), newKey)
    }
    if (conn.page_token_enc) {
      updates.page_token_enc = encrypt(decrypt(conn.page_token_enc, oldKey), newKey)
    }
    await db.update('social_connections', conn.id, updates)
  }
}
```

### 4.4 Token Refresh Strategy

**Proativo:** refresh 60-180s antes do `token_expires_at`.
**On-demand:** fallback se proativo falhou.
**Concurrency guard:** coluna `metadata.refreshing_at` com advisory lock — previne refreshes concorrentes.

```typescript
async function getValidToken(connectionId: string): Promise<string> {
  const conn = await getConnection(connectionId)
  if (!conn.token_expires_at || conn.token_expires_at > new Date(Date.now() + 60_000)) {
    return decrypt(conn.access_token_enc, masterKey)
  }
  // Token expiring soon — refresh
  return refreshToken(conn)
}
```

### 4.5 Token Lifetimes por Provider

| Provider | Access Token | Refresh/Long-lived |
|----------|-------------|-------------------|
| YouTube/Google | 1h | Refresh token: sem expiracao (Production mode) |
| Meta (FB/IG) | 1h → 60d (long-lived) | Page token: nunca expira |
| Bluesky | Session-based | App Password: sem expiracao |

### 4.6 Audit

Leitura de tokens registrada na tabela `audit_log` existente. Campos: `action = 'token_decrypt'`, `entity_type = 'social_connection'`, `entity_id`, `user_id`.

---

## 5. Provider Specifications

### 5.1 YouTube Data API v3

**SDK:** `@googleapis/youtube` (oficial Google)

#### Upload Flow (Client-Side Resumable)

```
  Browser                          API Server                       YouTube API
    |                                  |                                |
    |  1. POST /api/social/youtube/    |                                |
    |     upload-session               |                                |
    |  ─────────────────────────────>  |                                |
    |                                  |  2. POST resumable upload init |
    |                                  |  ──────────────────────────>   |
    |                                  |                                |
    |                                  |  3. Return session URI         |
    |                                  |  <──────────────────────────   |
    |  4. Return session URI           |                                |
    |  <─────────────────────────────  |                                |
    |                                                                   |
    |  5. PUT chunks (256KB multiples) directly to YouTube              |
    |  ────────────────────────────────────────────────────────────────> |
    |                                                                   |
    |  6. Upload complete → video ID                                    |
    |  <──────────────────────────────────────────────────────────────── |
    |                                  |                                |
    |  7. POST /api/social/youtube/    |                                |
    |     complete {videoId}           |                                |
    |  ─────────────────────────────>  |                                |
    |                                  |  8. Store video ID + metadata  |
    |                                  |  (social_posts.content.video_id)|
```

**Por que client-side:** Videos podem ter GBs. Vercel Functions tem limites de body. Upload direto evita esse gargalo.

#### Scheduling

Upload como `private` → cron altera para `public` no `scheduled_at`. **NAO usar** `publishAt` do YouTube porque precisamos controlar o momento exato para coordenacao cross-platform.

#### Thumbnail Limitations

- Custom thumbnails **NAO podem** ser aplicados em Shorts (API retorna erro)
- Thumbnails sao uma chamada separada APOS upload (nao parte do insert)
- Max 2MB, 1280x720, JPEG/PNG

#### OAuth Scopes

`youtube.upload` + `youtube` (ou `youtube.force-ssl`)

**CRITICO:** OAuth app em Testing mode → refresh tokens expiram em 7 dias! App DEVE estar em Production mode.

#### Analytics

YouTube Analytics API compartilha o mesmo quota de 10k. Metrica `impressionClickThroughRate` permite thumbnail CTR para A/B testing futuro.

### 5.2 Meta Graph API (Facebook + Instagram)

**SDK:** `facebook-nodejs-business-sdk` (oficial Meta)
**API version:** v25.0 (released Feb 2026)
**Deprecation cycle:** ~2 anos por versao

#### Facebook Page Posting

```typescript
// POST /{page-id}/feed
const response = await api.post(`/${pageId}/feed`, {
  message: formattedText,
  link: targetUrl,
  access_token: pageAccessToken,
})
// response.id = "{page-id}_{post-id}"
```

- Link previews auto-gerados a partir de OG tags (nao pode sobrescrever via API desde v2.9)
- Native scheduled posts suportados mas NAO usados (nosso scheduler para consistencia)

#### OG Cache Warming

Antes de postar um link no Facebook, esquentar o cache OG:

```typescript
async function warmOGCache(url: string, accessToken: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `https://graph.facebook.com/v25.0/?id=${encodeURIComponent(url)}&scrape=true`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const data = await res.json()

    // Verificar se og:image esta presente
    if (data.og_object?.image?.[0]?.url) {
      return true
    }
    await sleep(10_000) // 10s entre tentativas
  }
  return false // Publicar mesmo sem cache quente (warning no delivery)
}
```

Cache duration: 24h a 30 dias. Retry: scrape → verify `og:image` → retry ate 3x com 10s de intervalo.

#### Instagram Content Publishing (Container-Based)

```
  1. POST /{ig-user-id}/media           → Create container
     { video_url | image_url }             (media MUST be public URL)
                |
  2. GET /{container-id}?fields=status_code  → Poll every 10s
     Loop until status_code = 'FINISHED'
     Timeout: max(5min, video_duration * 6)
                |
  3. POST /{ig-user-id}/media_publish    → Publish container
     { creation_id: container-id }
```

**Container timing:** Containers expiram em 24h. Criar just-in-time (no momento do publish, NAO no momento do agendamento).

#### Instagram Media Specs

| Placement | Aspect Ratio | Resolucao | Duracao | Tamanho | Formatos |
|-----------|-------------|-----------|---------|---------|----------|
| Story | 9:16 | 1080x1920 | max 60s video | 8MB img | JPG, PNG (img) / MP4, MOV (video) |
| Reel | 9:16 | 1080x1920 | 5-90s | 1GB video | MP4, MOV (H.264/HEVC, closed GOP, 4:2:0) |
| Feed | 4:5 a 1.91:1 | 1080px min width | — | 8MB img | JPG, PNG |

**LIMITACAO:** Instagram Stories link stickers NAO estao disponiveis via Graph API. Stories publicados via API sao apenas imagem/video, sem stickers interativos. Workaround: publicar story sem link, notificar user para adicionar sticker manualmente no app IG.

**Rate limit:** 100 posts publicados via API por 24h por conta.

#### Resumable Upload (Instagram Videos)

Disponivel para videos grandes via `upload_type=resumable` → upload session em `rupload.facebook.com`.

#### OAuth Token Flow

```
Short-lived user token (1-2h)
  → Exchange: GET /oauth/access_token?grant_type=fb_exchange_token
    → Long-lived user token (60 dias)
      → GET /{user-id}/accounts
        → Page Access Token (NUNCA expira)
```

Page tokens derivados de long-lived user tokens nunca expiram. Armazenar o Page token em `page_token_enc`.

#### Permissoes Necessarias (App Review obrigatorio)

| Permissao | Proposito |
|-----------|-----------|
| `pages_manage_posts` | Publicar no Facebook Page |
| `pages_read_engagement` | Ler metricas de posts |
| `pages_show_list` | Listar Pages do user |
| `instagram_basic` | Acesso basico IG |
| `instagram_content_publish` | Publicar no Instagram |
| `business_management` | Business API access |

App Review leva 2-4 semanas. Meta Business Verification tambem necessario para Advanced Access (processo separado, documentos legais).

### 5.3 Bluesky (AT Protocol)

**SDK:** `@atproto/api` (oficial)

#### Autenticacao

App Password para v1 (simples, nao expira). OAuth+DPoP planejado para v2.

```typescript
import { BskyAgent } from '@atproto/api'

const agent = new BskyAgent({ service: 'https://bsky.social' })
await agent.login({
  identifier: 'handle.bsky.social',
  password: 'app-password',    // Stored encrypted in social_connections
})
```

#### Post Creation

```typescript
import { RichText } from '@atproto/api'

const rt = new RichText({ text: 'Novo post! https://example.com #tech' })
await rt.detectFacets(agent) // Auto-detect links, mentions, hashtags → facets

await agent.post({
  text: rt.text,
  facets: rt.facets,
  createdAt: new Date().toISOString(),
})
```

#### Link Cards (IMPORTANTE)

Bluesky NAO auto-gera link previews. Pipeline necessario:

```
  1. Fetch target URL server-side
  2. Parse OG tags (title, description, image)
  3. Download OG image
  4. Upload image como Bluesky blob (agent.uploadBlob())
  5. Criar post com app.bsky.embed.external embed
```

```typescript
async function createLinkCard(
  agent: BskyAgent,
  url: string,
  text: string,
): Promise<void> {
  // 1-3. Fetch + parse OG
  const og = await fetchOGTags(url) // { title, description, imageUrl }

  // 4. Upload OG image as blob
  const imgResponse = await fetch(og.imageUrl)
  const imgBuffer = await imgResponse.arrayBuffer()
  const { data: blob } = await agent.uploadBlob(
    new Uint8Array(imgBuffer),
    { encoding: 'image/jpeg' }
  )

  // 5. Create post with external embed
  const rt = new RichText({ text })
  await rt.detectFacets(agent)

  await agent.post({
    text: rt.text,
    facets: rt.facets,
    embed: {
      $type: 'app.bsky.embed.external',
      external: {
        uri: url,
        title: og.title,
        description: og.description,
        thumb: blob.blob,
      },
    },
    createdAt: new Date().toISOString(),
  })
}
```

#### Media Limits

| Tipo | Limite |
|------|--------|
| Images | ate 4 por post, 1MB cada, JPEG/PNG/GIF |
| Video | 1 por post, 100MB max, 3 minutos |
| Mix | NAO pode misturar images e video no mesmo post |

#### Rate Limits

5.000 pontos/hora, 35.000 pontos/dia. Post = 3 pontos. ~1.666 posts/hora teorico. Muito generoso.

**User base:** 43.5M registrados, ~27M MAU (crescendo).

---

## 6. Publishing Workflow

### 6.1 Trigger

Vercel Cron (every minute, Pro plan) → `POST /api/cron/social-publish`

```typescript
// route.ts
export async function POST(req: Request) {
  verifyAuthHeader(req, env.CRON_SECRET)

  const now = new Date()
  const pendingPosts = await supabase
    .from('social_posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now.toISOString())
    .limit(10) // Process max 10 per cron tick

  for (const post of pendingPosts.data ?? []) {
    await publishSocialPost(post)
  }
}
```

### 6.2 Workflow Steps

```
  +--------------------------+
  | 1. VALIDATE CONNECTIONS  |
  |   For each target platform:          |
  |   - Connection active (not revoked)? |
  |   - Token valid? Try refresh if not  |
  |   - Revoked → delivery = 'skipped'  |
  |   - Emit Realtime event              |
  +-----------+----------------+
              |
              v
  +--------------------------+
  | 2. PREPARE CONTENT       |
  |   - Apply template vars:             |
  |     {{title}}, {{url}},              |
  |     {{description}}, {{hashtags}}    |
  |   - Adapt per platform (limits)      |
  |   - Validate media specs             |
  +-----------+----------------+
              |
              v
  +--------------------------+
  | 3. PARALLEL PUBLISH      |  (independent per platform)
  |                          |
  |  YouTube ──────────────────────────────────────────+
  |    a. videos.update → privacyStatus = 'public'    |
  |    b. Optionally update metadata                   |
  |    c. Record platform_post_id + URL                |
  |                                                    |
  |  Facebook ─────────────────────────────────────────+
  |    a. OG cache warm (3 retries, 10s interval)      |
  |    b. POST /{page-id}/feed                         |
  |    c. Record platform_post_id + URL                |
  |                                                    |
  |  Instagram ────────────────────────────────────────+
  |    a. Validate media (9:16, duration, codec)       |
  |    b. Create container (media_url = Vercel Blob)   |
  |    c. Poll status every 10s (timeout formula)      |
  |    d. Publish container                            |
  |    e. Record platform_post_id                      |
  |                                                    |
  |  Bluesky ──────────────────────────────────────────+
  |    a. Fetch target URL → parse OG tags             |
  |    b. Download OG image → upload blob              |
  |    c. Build RichText with facets                   |
  |    d. Create post with external embed              |
  |    e. Record platform_post_id                      |
  +-----------+----------------+
              |
              v
  +--------------------------+
  | 4. AGGREGATE RESULTS     |
  |   All succeeded → 'completed'        |
  |   Some failed → 'partial_failure'    |
  |   All failed → 'failed'             |
  |   Emit Supabase Realtime event       |
  +--------------------------+
```

### 6.3 Partial Failures

Cada plataforma e independente. Facebook falhando NAO afeta Instagram ou Bluesky. Deliveries com falha podem ser retentados individualmente via UI.

### 6.4 Retry Strategy

```typescript
const RETRY_DELAYS = [5_000, 30_000, 120_000] // 5s, 30s, 2min

async function executeWithRetry(
  delivery: SocialDelivery,
  publishFn: () => Promise<PlatformResult>,
): Promise<void> {
  for (let attempt = 1; attempt <= delivery.max_attempts; attempt++) {
    try {
      const result = await publishFn()
      await updateDelivery(delivery.id, {
        status: 'published',
        platform_post_id: result.id,
        platform_url: result.url,
        attempt,
        published_at: new Date(),
      })
      return
    } catch (error) {
      const errorType = classifyError(error)
      if (errorType === 'permanent') {
        await updateDelivery(delivery.id, {
          status: 'failed',
          last_error: error.message,
          error_type: 'permanent',
          attempt,
        })
        return // Nao retenta
      }
      if (errorType === 'auth') {
        const refreshed = await tryRefreshToken(delivery.connection_id)
        if (!refreshed) {
          await updateDelivery(delivery.id, {
            status: 'skipped',
            last_error: 'Token refresh failed — re-auth required',
            error_type: 'auth',
            attempt,
          })
          return
        }
        // Token refreshed — retry immediately
        continue
      }
      // transient — wait before retry
      if (attempt < delivery.max_attempts) {
        await sleep(RETRY_DELAYS[attempt - 1])
      }
    }
  }
  // Max attempts exceeded
  await updateDelivery(delivery.id, {
    status: 'failed',
    error_type: 'transient',
    attempt: delivery.max_attempts,
  })
}
```

### 6.5 Idempotency

`idempotency_key` (UUID unico por post) previne double-publish em caso de cron overlap ou retry. Workflow checa: se ja existe delivery com `status = 'published'` para este `post_id + connection_id`, skip.

---

## 7. Content Adapter

### 7.1 Platform Limits

```typescript
const PLATFORM_LIMITS = {
  youtube:   { title: 100, description: 5000, tags: 500 },
  facebook:  { text: 63_206 },
  instagram: { caption: 2200, hashtags: 30 },
  bluesky:   { text: 300 },
} as const
```

### 7.2 Templates

```typescript
const DEFAULT_TEMPLATES: Record<string, string> = {
  'video-launch': '🎬 {title} — {description}\n\n{url}\n\n{hashtags}',
  'blog-post':    '📝 {title}\n\n{description}\n\n{url}',
  'link-share':   '{title}\n{url}',
} as const
```

### 7.3 Truncation

Trunca com ellipsis (`...`) quando conteudo excede limite da plataforma. Composer UI mostra warning com contador de caracteres por plataforma.

```typescript
function truncateForPlatform(
  text: string,
  platform: keyof typeof PLATFORM_LIMITS,
  field: string,
): string {
  const limit = PLATFORM_LIMITS[platform][field]
  if (!limit || text.length <= limit) return text
  return text.slice(0, limit - 3) + '...'
}
```

### 7.4 Hashtag Handling

- Instagram: hashtags separados em bloco no final (max 30)
- Bluesky: hashtags inline (auto-detected via RichText facets)
- Facebook: hashtags inline no texto
- YouTube: hashtags em description + tags field separado

---

## 8. Media Validator

Valida media ANTES do agendamento (nao no momento do publish):

```typescript
interface MediaSpec {
  maxDuration?: number    // seconds
  minDuration?: number
  aspectRatio?: string    // '9:16', '16:9', '1:1'
  maxFileSize: number     // bytes
  allowedFormats: string[]
  resolution?: { width: number; height: number }
}

const MEDIA_SPECS: Record<string, Record<string, MediaSpec>> = {
  instagram: {
    story: {
      aspectRatio: '9:16',
      maxDuration: 60,
      maxFileSize: 8 * 1024 * 1024,
      allowedFormats: ['mp4', 'mov', 'jpg', 'png'],
    },
    reel: {
      aspectRatio: '9:16',
      minDuration: 5,
      maxDuration: 90,
      maxFileSize: 1024 * 1024 * 1024,
      allowedFormats: ['mp4', 'mov'],
    },
    feed: {
      maxFileSize: 8 * 1024 * 1024,
      allowedFormats: ['jpg', 'png'],
    },
  },
  youtube: {
    video: {
      maxFileSize: 256 * 1024 * 1024 * 1024,
      maxDuration: 43200,
      allowedFormats: ['mp4', 'mov', 'avi', 'wmv', 'webm'],
    },
    short: {
      aspectRatio: '9:16',
      maxDuration: 180,
      allowedFormats: ['mp4', 'mov'],
    },
  },
  bluesky: {
    image: {
      maxFileSize: 1 * 1024 * 1024,
      allowedFormats: ['jpg', 'png', 'gif'],
    },
    video: {
      maxDuration: 180,
      maxFileSize: 100 * 1024 * 1024,
      allowedFormats: ['mp4'],
    },
  },
}
```

**Key insight:** Mesmo source video (9:16, H.264, <=60s) funciona para YouTube Shorts + Instagram Story + Bluesky. Um upload, multiplas plataformas.

---

## 9. Media Upload Flow

```
  User seleciona arquivo no browser
    │
    ├─ Client-side validation (format, size, duration, aspect ratio)
    │
    ├─ YouTube video?
    │   └─ Client-side resumable upload direto para YouTube (§5.1)
    │      └─ Salva video_id em social_posts.content.video_id
    │
    └─ Instagram/Bluesky/General?
        └─ Upload para Vercel Blob (public store, via Media System)
           └─ Salva URL em social_posts.content.media_urls
    │
    ▼
  No publish time: workflow usa stored URLs/IDs per platform
```

---

## 10. CMS UI Components

### 10.1 Navegacao

Nova secao "Social" no sidebar do CMS:

```
Social
├── Calendar         /cms/social           → Lista + calendario mensal/semanal
├── New Post         /cms/social/new       → Composer unificado
└── Status           /cms/social/[id]      → Dashboard de entrega (per post)

Settings
└── Social           /cms/settings/social  → Gerenciamento de conexoes
```

### 10.2 Social Settings (`/cms/settings/social`)

```
┌─────────────────────────────────────────────────────────────┐
│  Social Connections                                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ▶ YouTube                                             │   │
│  │   Canal: @ThiagoFigueiredo                            │   │
│  │   Status: ● Conectado (token valido ate 12/06)        │   │
│  │   [Desconectar]                                       │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ ▶ Facebook                                            │   │
│  │   Page: By Thiago Figueiredo                          │   │
│  │   Status: ● Conectado (page token permanente)         │   │
│  │   [Desconectar]                                       │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ ▶ Instagram                                           │   │
│  │   @thiago.figueiredo                                  │   │
│  │   Status: ● Conectado                                 │   │
│  │   [Desconectar]                                       │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ ▶ Bluesky                                             │   │
│  │   Status: ○ Nao conectado                             │   │
│  │   [Conectar]  ← abre modal com handle + app password  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Token Health Legend:                                        │
│  ● Ativo   ◐ Expirando (<24h)   ○ Expirado   ✕ Revogado   │
│                                                              │
│  ─────────────────────────────────────────────────────────   │
│  YouTube Quota (today)                                       │
│  ████████████░░░░░░░░░░░░░░░░░░░  3,200 / 10,000 units     │
│  Operations: 2x upload, 4x metadata update                  │
└─────────────────────────────────────────────────────────────┘
```

**OAuth popup flow:**
1. User clica "Conectar" → abre popup `window.open('/api/social/oauth/{provider}')`
2. Server redireciona para provider OAuth consent screen
3. Provider redireciona para callback `/api/social/oauth/{provider}/callback`
4. Callback salva tokens encriptados, fecha popup, parent window atualiza via `postMessage`

**Bluesky flow diferente:** Modal inline com campos `handle` + `app password` (sem OAuth).

### 10.3 Social Composer (`/cms/social/new`)

```
┌─────────────────────────────────────────────────────────────┐
│  New Social Post                                             │
│                                                              │
│  Type: [Link ▼] [Video] [Image] [Text]                      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                        │   │
│  │  Titulo: [Como construi meu CMS do zero_________]     │   │
│  │                                                        │   │
│  │  Descricao:                                            │   │
│  │  ┌──────────────────────────────────────────────────┐ │   │
│  │  │ Neste post compartilho como construi um CMS      │ │   │
│  │  │ completo usando Next.js, Supabase e TypeScript.  │ │   │
│  │  │ Da ideia ao deploy em producao...                 │ │   │
│  │  └──────────────────────────────────────────────────┘ │   │
│  │                                                        │   │
│  │  URL: [https://bythiagofigueiredo.com/blog/cms______] │   │
│  │                                                        │   │
│  │  Hashtags: [#cms] [#nextjs] [#typescript] [+ add]      │   │
│  │                                                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Platforms:                                                  │
│  [✓] YouTube    [✓] Facebook    [✓] Instagram    [✓] Bluesky│
│                                                              │
│  Template: [blog-post ▼]                                     │
│                                                              │
│  ┌─ Preview per Platform ──────────────────────────────┐    │
│  │ Tab: [YouTube] [Facebook] [Instagram] [Bluesky]      │    │
│  │                                                       │    │
│  │  📝 Como construi meu CMS do zero                    │    │
│  │                                                       │    │
│  │  Neste post compartilho como construi um CMS...       │    │
│  │                                                       │    │
│  │  https://bythiagofigueiredo.com/blog/cms              │    │
│  │                                                       │    │
│  │  Chars: 156 / 300  ⚠ Bluesky limit                   │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                              │
│  Media: [📎 Upload] ou [Selecionar da Media Gallery]         │
│  Specs: ✓ 9:16, H.264, 45s — compativel com IG Story + YT   │
│                                                              │
│  Schedule:                                                   │
│  [📅 2026-05-15] [🕐 14:00] Timezone: America/Sao_Paulo     │
│                                                              │
│  [Salvar Rascunho]          [Agendar Publicacao]             │
└─────────────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- Editor unificado com preview per-platform (tab switching)
- Platform toggles (enable/disable cada provider)
- Media upload com validacao de specs inline
- Template selector com preview em tempo real
- Schedule date/time picker com display de timezone
- Contador de caracteres per platform com warning visual
- Override per platform: `content_override` JSONB no delivery permite texto customizado por rede

### 10.4 Social Calendar (`/cms/social`)

```
┌─────────────────────────────────────────────────────────────┐
│  Social Calendar                          [Month ▼] [Week]  │
│                                                              │
│  ◄  Maio 2026  ►                          [+ New Post]      │
│                                                              │
│  Seg    Ter    Qua    Qui    Sex    Sab    Dom              │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐        │
│  │      │      │      │      │ 01   │ 02   │ 03   │        │
│  │      │      │      │      │      │      │      │        │
│  ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤        │
│  │ 04   │ 05   │ 06   │ 07   │ 08   │ 09   │ 10   │        │
│  │      │      │      │      │      │      │      │        │
│  ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤        │
│  │ 11   │ 12   │ 13   │ 14   │ 15   │ 16   │ 17   │        │
│  │      │ ● Dt │      │      │ ● Sc │      │      │        │
│  │      │      │      │      │ 14h  │      │      │        │
│  ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤        │
│  │ 18   │ 19   │ 20   │ 21   │ 22   │ 23   │ 24   │        │
│  │ ✓ Cp │      │      │      │      │      │      │        │
│  │ ✗ Pf │      │      │      │      │      │      │        │
│  └──────┴──────┴──────┴──────┴──────┴──────┴──────┘        │
│                                                              │
│  Legend: ● Draft  ● Scheduled  ✓ Completed  ✗ Failed        │
│          Pf = Partial Failure                                │
│                                                              │
│  Upcoming:                                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 15 Mai 14:00 — Como construi meu CMS do zero         │   │
│  │   [YT ●] [FB ●] [IG ●] [BS ●]  Status: Scheduled    │   │
│  │   [Edit] [Cancel]                                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 10.5 Social Status Dashboard (`/cms/social/[id]`)

```
┌─────────────────────────────────────────────────────────────┐
│  Post: Como construi meu CMS do zero                        │
│  Scheduled: 15 Mai 2026, 14:00 (America/Sao_Paulo)          │
│  Status: ● Publishing...                                     │
│                                                              │
│  ┌─ Deliveries ────────────────────────────────────────┐    │
│  │                                                       │    │
│  │  YouTube     ✓ Published                              │    │
│  │  └─ https://youtube.com/watch?v=abc123                │    │
│  │    Published at: 15 Mai 14:00:03                      │    │
│  │                                                       │    │
│  │  Facebook    ✓ Published                              │    │
│  │  └─ https://facebook.com/page/posts/456               │    │
│  │    Published at: 15 Mai 14:00:05                      │    │
│  │                                                       │    │
│  │  Instagram   ◐ Publishing... (container processing)   │    │
│  │    Attempt: 1/3                                        │    │
│  │                                                       │    │
│  │  Bluesky     ✗ Failed (permanent)                     │    │
│  │    Error: "Image too large (1.5MB > 1MB limit)"       │    │
│  │    [Retry] (disabled — permanent error)               │    │
│  │                                                       │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                              │
│  Content Preview:                                            │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ 📝 Como construi meu CMS do zero                     │   │
│  │                                                        │   │
│  │ Neste post compartilho como construi um CMS completo  │   │
│  │ usando Next.js, Supabase e TypeScript...               │   │
│  │                                                        │   │
│  │ https://bythiagofigueiredo.com/blog/cms                │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  [Cancel Remaining]    [Delete Post]                         │
└─────────────────────────────────────────────────────────────┘
```

**Real-time updates** via Supabase Realtime:

```typescript
const channel = supabase
  .channel(`social:${postId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'social_deliveries',
    filter: `post_id=eq.${postId}`,
  }, (payload) => {
    // Update delivery status in UI without refresh
    updateDeliveryStatus(payload.new)
  })
  .subscribe()
```

### 10.6 YouTube Manager (Social Settings sub-section)

Secao dedicada dentro de Social Settings para features YouTube-specific:

- **Metadata editor:** Atualizar title, description, tags, category de qualquer video
- **Thumbnail swap:** Upload novo thumbnail (non-Shorts only), com preview current vs new
- **Quota dashboard:** Barra de uso diario com log de operacoes
- **Video list:** Todos os videos gerenciados pelo sistema com status

---

## 11. Post Delete/Edit Apos Publicacao

Cada delivery armazena `platform_post_id`. Acoes possiveis:

| Acao | YouTube | Facebook | Instagram | Bluesky |
|------|---------|----------|-----------|---------|
| Delete | `videos.delete` | `DELETE /{post-id}` | `DELETE /{media-id}` | `deletePost` |
| Edit text | `videos.update` | `POST /{post-id}` | NAO suporta (delete + re-post) | NAO suporta (delete + re-post) |
| Edit media | NAO suporta | NAO suporta | NAO suporta | NAO suporta |

**Implementacao:** Server action `deleteSocialPost(postId)` chama platform delete API para cada delivery com `status = 'published'`, marca como deleted no DB.

---

## 12. Timezone Handling

- Todos os `scheduled_at` armazenados como `TIMESTAMPTZ` (UTC internamente)
- Coluna `user_timezone` armazena nome IANA (e.g., `'America/Sao_Paulo'`)
- UI exibe no timezone do user, converte para UTC no storage
- Cron compara `scheduled_at <= now()` (ambos UTC)
- Library: `date-fns v4` + `@date-fns/tz`

```typescript
import { formatInTimeZone, fromZonedTime } from '@date-fns/tz'

// UI → DB (user input → UTC)
const utcDate = fromZonedTime(userInputDate, 'America/Sao_Paulo')

// DB → UI (UTC → user display)
const display = formatInTimeZone(utcDate, 'America/Sao_Paulo', 'dd MMM yyyy, HH:mm')
```

---

## 13. LGPD Compliance

| Requisito | Implementacao |
|-----------|---------------|
| OAuth tokens sao dados pessoais | Encriptados AES-256-GCM at rest (§4) |
| Data export | Incluir `social_connections` no LGPD data export (Phase 1) |
| Account deletion | CASCADE via `sites.id` → deleta connections automaticamente |
| Terceiros | NAO rastreamos usuarios de terceiros (so gerenciamos contas do site owner) |
| Data categories | Adicionar `social_connections` ao `lgpd_data_categories` mapping |

Integracao com pipeline LGPD existente (3-phase deletion):
- Phase 1 (instant): export inclui `social_connections` metadata (sem tokens)
- Phase 3 (D+15): hard delete via CASCADE ja funciona

---

## 14. Testing Strategy

### 14.1 Test Mode

Env var `SOCIAL_TEST_MODE=mock` para desenvolvimento. Mock providers com fixtures gravadas:

```
test/fixtures/social/
  youtube/
    upload-session.json
    video-update.json
    thumbnail-set.json
  meta/
    og-scrape.json
    page-post.json
    ig-container-create.json
    ig-container-status.json
    ig-media-publish.json
  bluesky/
    login.json
    post-create.json
    blob-upload.json
```

### 14.2 Coverage Targets

| Camada | Target | Foco |
|--------|--------|------|
| `@tn-figueiredo/social` core | 80% | Content adapter, media validator, token vault, quota tracker |
| CMS UI components | 70% | Composer, calendar, status dashboard |
| Workflows | 70% | Publishing orchestration, retry logic, error classification |

### 14.3 Test Patterns

```typescript
// Unit tests: content adapter
describe('ContentAdapter', () => {
  it('truncates text to Bluesky 300-char limit with ellipsis', () => {
    const text = 'a'.repeat(400)
    const result = adaptForPlatform(text, 'bluesky', 'text')
    expect(result).toHaveLength(300)
    expect(result).toMatch(/\.\.\.$/)
  })

  it('limits Instagram hashtags to 30', () => {
    const hashtags = Array.from({ length: 40 }, (_, i) => `#tag${i}`)
    const result = adaptHashtags(hashtags, 'instagram')
    expect(result).toHaveLength(30)
  })
})

// Unit tests: token vault
describe('TokenVault', () => {
  it('encrypts and decrypts round-trip', () => {
    const key = randomBytes(32)
    const plaintext = 'ya29.a0AfH6SM...'
    const encrypted = encrypt(plaintext, key)
    expect(encrypted).not.toBe(plaintext)
    expect(decrypt(encrypted, key)).toBe(plaintext)
  })

  it('rejects tampered ciphertext', () => {
    const key = randomBytes(32)
    const encrypted = encrypt('secret', key)
    const tampered = encrypted.slice(0, -2) + 'XX'
    expect(() => decrypt(tampered, key)).toThrow()
  })
})

// Integration tests (gated)
describe.skipIf(skipIfNoSocialTestAccounts())('YouTube Integration', () => {
  it('creates resumable upload session', async () => { ... })
})
```

---

## 15. Environment Variables (novas)

### 15.1 Package/App

| Variavel | Proposito | Onde |
|----------|-----------|------|
| `SOCIAL_MASTER_KEY` | 32-byte hex key para encriptacao de tokens | `apps/web` |
| `GOOGLE_CLIENT_ID` | Google OAuth (YouTube) | `apps/web` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth (YouTube) | `apps/web` |
| `META_APP_ID` | Meta OAuth (Facebook + Instagram) | `apps/web` |
| `META_APP_SECRET` | Meta OAuth (Facebook + Instagram) | `apps/web` |

Bluesky usa App Password armazenado em `social_connections` — sem env var necessaria.

### 15.2 Test Mode

| Variavel | Proposito |
|----------|-----------|
| `SOCIAL_TEST_MODE=mock` | Ativa mock providers em desenvolvimento |

---

## 16. NPM Dependencies (novas)

### 16.1 Package (`@tn-figueiredo/social`)

| Dep | Proposito | Tipo |
|-----|-----------|------|
| `@googleapis/youtube` | YouTube Data API v3 oficial | prod |
| `facebook-nodejs-business-sdk` | Meta Graph API oficial | prod |
| `@atproto/api` | Bluesky AT Protocol oficial | prod |
| `date-fns` | Manipulacao de datas | prod |
| `@date-fns/tz` | Timezone handling | prod |

### 16.2 App (`apps/web`)

Sem novas deps — usa Supabase, Vercel Blob, e Vercel Cron existentes.

---

## 17. Pre-Implementation Requirements

Processos que levam semanas e DEVEM ser iniciados ANTES do sprint:

| Processo | Lead Time | Status Necessario |
|----------|-----------|-------------------|
| Google OAuth verification (scope `youtube.upload`) | 2-6 semanas | Submit via Google Cloud Console |
| Meta App Review (`pages_manage_posts`, `instagram_content_publish`) | 2-4 semanas | Submit via Meta for Developers (requer screencast + privacy policy) |
| Meta Business Verification (Advanced Access) | 1-3 semanas | Documentos legais via Meta Business Suite |

**Sequencia recomendada:**
1. Criar Google Cloud project + configurar OAuth consent screen → submit para verification
2. Criar Meta App + configurar permissoes → submit para App Review
3. Paralelamente: iniciar Business Verification no Meta Business Suite
4. Enquanto aguarda aprovacoes: desenvolver package core + mocks + UI

---

## 18. Gotchas e Limitacoes Criticas

| # | Gotcha | Impacto | Mitigacao |
|---|--------|---------|-----------|
| 1 | YouTube OAuth app DEVE estar em Production mode | Testing mode: refresh tokens expiram em 7 dias | Publicar app antes do sprint |
| 2 | Instagram containers expiram em 24h | Container criado cedo demais = falha no publish | Criar container just-in-time (no momento do publish) |
| 3 | Instagram Stories link stickers NAO disponiveis via API | Stories publicados via API: apenas imagem/video | Notificar user para adicionar sticker manualmente no app IG |
| 4 | YouTube thumbnails NAO podem ser setados em Shorts | API retorna erro | Detectar Shorts (duration <=180s + 9:16) e pular thumbnail |
| 5 | YouTube video files NAO podem ser baixados via API | Nao da para re-upload cross-platform | Usar arquivo original do user |
| 6 | Bluesky NAO auto-gera link previews | Link sem card se nao construir embed | Pipeline server-side: fetch OG → upload blob → embed external |
| 7 | Facebook link preview images NAO podem ser sobrescritas via API | Controlar apenas via OG tags do site | OG cache warming + verificacao antes de postar |
| 8 | Media DEVE estar em URL publica para Instagram | Upload privado = falha no container | Usar Vercel Blob (public store) |

---

## 19. Riscos

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| Google OAuth verification delay | 70% | Medio | Iniciar processo 2+ semanas antes do sprint |
| Meta App Review delay | 60% | Medio | Iniciar processo 2+ semanas antes do sprint |
| YouTube quota insuficiente | 30% | Medio | Quota tracking + warning a 80% + solicitar aumento |
| Instagram container processing timeout | 20% | Baixo | Timeout proporcional + retry |
| Meta Graph API version deprecation | 10% | Baixo | Pinar versao, monitorar changelog |

---

## 20. Hour Breakdown

| Modulo | Horas | Notas |
|--------|-------|-------|
| Core (types, token vault, validators, adapters) | 10h | Fundacao do package |
| YouTube provider + resumable upload | 12h | Provider mais complexo |
| Meta provider (FB + IG + shared OAuth) | 10h | Container flow para IG |
| Bluesky provider | 6h | API mais simples mas link card pipeline |
| Vercel Workflows + Cron | 8h | Orquestracao + scheduling |
| CMS UI — Settings/Connections | 6h | OAuth flows + status |
| CMS UI — Composer + Calendar | 10h | Maior volume de UI |
| CMS UI — Status Dashboard | 4h | Real-time delivery view |
| Database (migrations + RLS) | 4h | 4 tabelas + policies |
| Tests (mocks + fixtures + unit + integration) | 8h | Coverage targets |
| **Total** | **~78h** | |

---

## 21. Exit Criteria

- [ ] `@tn-figueiredo/social` package publicado com providers YouTube, Facebook, Instagram, e Bluesky
- [ ] Token vault com AES-256-GCM encryption operacional
- [ ] Social composer UI funcional (compose, preview per platform, schedule)
- [ ] Publishing workflow entrega para todas as 4 plataformas com error handling
- [ ] YouTube metadata editor (title, description, tags, thumbnail) funcionando
- [ ] YouTube quota tracking com warning a 80%
- [ ] Facebook OG cache warming antes de link posts
- [ ] Instagram container-based publishing (Stories + Reels)
- [ ] Bluesky link card generation (OG fetch + blob upload + embed)
- [ ] Real-time delivery status via Supabase Realtime
- [ ] Post delete/cancel via CMS UI
- [ ] Media validation per platform specs
- [ ] Content adaptation per platform limits
- [ ] LGPD data export inclui social connections
- [ ] 80%+ test coverage no core package
- [ ] Todos os OAuth flows funcionando com token refresh

---

## 22. Reference Implementation

**Postiz** ([github.com/gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app), ~20k stars) — Next.js + NestJS + Prisma + BullMQ + Temporal. Estudar provider integrations e workflow patterns.
