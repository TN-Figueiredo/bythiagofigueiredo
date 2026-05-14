# Social Posts Redesign — Design Spec

**Date:** 2026-05-14
**Status:** Draft
**Sprint:** 5h — Social Hub (fase 2: Social Posts + Links Engine integration)
**Estimated effort:** ~58h (Phase 1: ~52h sem IG Reel pipeline)
**Pre-conditions:** Social Hub module operacional (Sprint 5h fase 1). Links Engine operacional (Sprint 5f). OAuth connections ativas (YouTube, Facebook, Instagram, Bluesky). `@vercel/og` instalado como dependência para story generation (`npm i @vercel/og -w apps/web`).

---

## 1. Overview & Goals

### 1.1 Contexto

O Social Hub atual opera de forma isolada: o usuario cria posts manualmente no Composer (`/cms/social/new`), seleciona plataformas, redige captions e agenda. Nao existe integracao com o fluxo de publicacao de conteudo do CMS (blog, newsletter, campaign, video). Isso gera atrito: toda vez que um blog post e publicado, o usuario precisa abrir o Social Hub, copiar link, redigir captions para cada plataforma, e agendar manualmente.

O redesign unifica os dois mundos — conteudo CMS e distribuicao social — num unico fluxo coeso. O `SocialPost` passa a ser a entidade central que conecta publicacao de conteudo, criacao de short links, validacao de OG tags, e entrega multi-plataforma.

### 1.2 Goals

1. **Unificar Posts + Composer** numa experiencia coesa onde conteudo CMS dispara social posts automaticamente
2. **Permitir compartilhamento de conteudo CMS** (blog, newsletter, campaign, video) em redes sociais com captions por plataforma e por idioma (PT/EN)
3. **Integrar o Links Engine** (shortener + analytics) no fluxo de criacao — todo conteudo compartilhado ganha um `go.bythiagofigueiredo.com` short link com tracking
4. **Automatizar o pipeline completo:** publicar conteudo -> criar short link -> Facebook Debugger OG scrape -> postar nas plataformas (~2-3 min end-to-end)
5. **Dois caminhos de uso:**
   - **"Set and forget"** — opt-in no editor de conteudo (toggle no Social Tab). Ao publicar, o pipeline roda automaticamente
   - **Manual** — criacao direta no Social Hub Composer com selecao de conteudo fonte
6. **Instagram:** Stories para blog/newsletter/campaign (perfil pessoal), Reels para video
7. **YouTube:** videos promovidos em OUTRAS plataformas (FB, IG, Bluesky), nunca publicados via Social Hub no YouTube (ja gerenciado pelo modulo YouTube existente)

### 1.3 Non-Goals

| Item | Motivo |
|------|--------|
| Analytics de engajamento (likes, comments, shares) | Futuro sprint — requer Graph API Insights + AT Protocol firehose |
| Multi-account por provider | v1 = 1 conta por provider por site. Suficiente para CMS pessoal |
| YouTube publishing via Social Hub | Ja gerenciado pelo modulo YouTube existente (`/cms/youtube`) |
| Editor de imagem/video inline | Usa Media System existente (Sprint 5g) |
| A/B testing de captions | Futuro — depende de analytics de engajamento |

### 1.4 Pre-condicoes

- **Social Hub operacional:** tabelas `social_connections`, `social_posts`, `social_deliveries` criadas (migration `20260513100000_social_hub.sql`). OAuth flows para YouTube, Facebook, Instagram e Bluesky funcionais
- **Links Engine operacional:** tabela `tracked_links` + `link_clicks`. Subdomain `go.bythiagofigueiredo.com` configurado. Watermark-based aggregation
- **Conexoes OAuth ativas:** pelo menos 1 provider conectado para testar o pipeline
- **Media System (Sprint 5g):** operacional para upload de imagens de Story/Reel

---

## 2. Arquitetura — Abordagem "Social Post First"

### 2.1 A Entidade Central

A entidade `SocialPost` e o ponto de convergencia de toda criacao de social posts — automatica ou manual. Toda interacao que resulta em publicacao nas redes sociais passa pela mesma funcao core: `createSocialPostFromContent()`.

Os editores de conteudo (blog, newsletter, campaign) permanecem enxutos: adicionam apenas um toggle de social sharing + um thin hook de ~5 linhas no server action de publish. O hook dispara `createSocialPostFromContent()` como fire-and-forget — se falhar, a publicacao do conteudo continua normalmente. Erros sao capturados pelo Sentry.

O Composer no Social Hub tambem usa `createSocialPostFromContent()` quando o usuario seleciona conteudo fonte, mantendo um unico code path para toda criacao de social posts.

### 2.2 Abordagens Rejeitadas

Tres alternativas foram avaliadas antes de chegar ao "Social Post First":

#### Rejeitada 1: "Publish Hook" (extensao direta dos server actions)

Nesta abordagem, cada server action de publicacao (`publishPost()`, `sendNow()`, `publishCampaign()`) importaria diretamente a logica de social posting — criacao de short link, OG scrape, entrega multi-plataforma — tudo inline no action.

**Por que foi rejeitada:**
- **Acoplamento excessivo.** Cada editor (blog, newsletter, campaign) precisaria importar `@tn-figueiredo/social`, `@tn-figueiredo/links`, logica de OG scrape e formatacao por plataforma. Mudancas no pipeline social quebrariam N editores
- **Duplicacao.** A mesma logica de pipeline (link -> scrape -> deliver) seria replicada 3-4 vezes com variacoes sutis
- **Testabilidade comprometida.** Testes de publish precisariam mockar toda a stack social. Testes de social precisariam mockar publicacao de conteudo
- **Estimativa: ~65h** — mais codigo, mais duplicacao, mais manutencao

#### Rejeitada 2: "Event Bus" (pipeline desacoplado via DB triggers)

Nesta abordagem, a publicacao de conteudo emitiria um evento generico (`content_published`) numa tabela de eventos. Um trigger/cron processaria eventos e criaria social posts automaticamente via regras configuradas.

**Por que foi rejeitada:**
- **Over-engineering para CMS single-user.** Event bus faz sentido em sistemas multi-tenant com dezenas de consumers. Para um hub pessoal com 4 providers, adiciona complexidade sem beneficio proporcional
- **Debugging opaco.** Falhas no pipeline ficariam enterradas em triggers de DB, longe do codigo da aplicacao. Rastreabilidade ruim
- **Latencia.** Cada etapa adicionaria round-trip ao DB. Pipeline de 4 steps levaria 8+ queries
- **Estimativa: ~70h** — mais infraestrutura (tabela de eventos, consumer, retry queue, dead letter)

#### Rejeitada 3: Status Quo (Composer separado)

Manter o Composer como ferramenta isolada, sem integracao com publicacao de conteudo.

**Por que foi rejeitada:**
- Nao resolve o problema central: o usuario precisa replicar manualmente cada publicacao nas redes sociais
- Zero automacao

### 2.3 Por Que "Social Post First" Vence

| Criterio | Publish Hook | Event Bus | Social Post First |
|----------|-------------|-----------|-------------------|
| Estimativa | ~65h | ~70h | **~58h** |
| Acoplamento | Alto | Baixo | **Baixo** |
| Code paths | 3-4 duplicados | 1 (consumer) | **1 (core function)** |
| Testabilidade | Ruim | Media | **Boa** |
| Debugging | Inline | Opaco (DB) | **Transparente (pipeline_steps)** |
| Complexidade infra | Baixa | Alta | **Media** |

**Vantagens decisivas:**

1. **Single code path.** `createSocialPostFromContent()` e a unica funcao que cria social posts a partir de conteudo. Auto, manual, modal — todos passam por ela
2. **Reutiliza arquitetura do Composer.** O Composer existente ja sabe criar `social_posts` e `social_deliveries`. A funcao core usa a mesma estrutura de dados
3. **Pipeline observavel.** O campo `pipeline_steps` (JSONB) registra cada etapa com status, timestamp e dados. UI mostra progresso em tempo real via Supabase Realtime
4. **Editores ficam lean.** Cada editor adiciona ~5 linhas (if enabled -> fire-and-forget). Zero importacao de logica social
5. **DRY por design.** Mudancas no pipeline (ex: adicionar step de AI caption) alteram 1 funcao, nao N editores

---

## 3. Data Model

### 3.1 `social_posts` — Novas Colunas

Adicionadas via migration ALTER TABLE sobre a tabela existente (migration `20260513100000_social_hub.sql`):

```sql
-- Origem do conteudo (qual tipo de conteudo CMS gerou este social post)
ALTER TABLE social_posts
  ADD COLUMN source_content_type TEXT
    CHECK (source_content_type IN ('blog','newsletter','campaign','video'));

-- Referencia ao conteudo fonte (FK logica, sem constraint — tabelas distintas)
ALTER TABLE social_posts
  ADD COLUMN source_content_id UUID;

-- Como o post foi criado
ALTER TABLE social_posts
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual'
    CHECK (origin IN ('manual','auto','publish_modal'));

-- Short link gerado pelo Links Engine
ALTER TABLE social_posts
  ADD COLUMN short_link_id UUID REFERENCES tracked_links(id);

-- Tracking de cada etapa do pipeline
ALTER TABLE social_posts
  ADD COLUMN pipeline_steps JSONB DEFAULT '[]';
```

**Notas:**
- `source_content_id` nao tem FK constraint porque referencia tabelas distintas (`blog_posts`, `newsletter_editions`, `campaigns`) dependendo do `source_content_type`. A integridade e garantida pela aplicacao
- `origin` distingue os 3 caminhos: `auto` (toggle no editor), `publish_modal` (modal de agendamento), `manual` (Composer direto)
- `pipeline_steps` e um array JSONB append-only — cada step e adicionado conforme o pipeline progride. Nunca removido, apenas atualizado

### 3.2 Extensao do `content` JSONB Existente

O campo `content JSONB NOT NULL` existente em `social_posts` e mantido e estendido com um sub-objeto `captions` que suporta captions por plataforma e por idioma:

```json
{
  "title": "AI Empire: O Que Vem Por Ai",
  "description": "O futuro da inteligencia artificial...",
  "url": "https://bythiagofigueiredo.com/blog/ai-empire",
  "hashtags": ["#AI", "#BuildInPublic"],
  "media_urls": ["https://...cover.jpg"],
  "captions": {
    "facebook": { "pt": "Novo post no blog...", "en": "New blog post..." },
    "instagram": { "pt": "Confira o novo artigo..." },
    "bluesky": { "pt": "AI Empire — novo artigo..." }
  }
}
```

**Regras de resolucao de caption:**
1. Se `captions.{provider}.{locale}` existe, usa
2. Senao, fallback para `captions.{provider}.pt`
3. Senao, gera caption generico a partir de `title` + `url` + `hashtags`

### 3.3 `social_deliveries` — Novas Colunas

```sql
-- Formato de entrega por plataforma (determina como o conteudo e apresentado)
ALTER TABLE social_deliveries
  ADD COLUMN format TEXT
    CHECK (format IN ('link_share','image_post','story','reel','link_card','video_share'));

-- Configuracao de template (especifico por formato)
ALTER TABLE social_deliveries
  ADD COLUMN template_config JSONB;
```

**Mapeamento content type -> formato por plataforma:**

| Content Type | Facebook | Instagram | Bluesky |
|-------------|----------|-----------|---------|
| blog | `link_share` | `story` | `link_card` |
| newsletter | `link_share` | `story` | `link_card` |
| campaign | `link_share` | `story` | `link_card` |
| video | `video_share` | `reel` | `link_card` |

**Shape de `template_config` por formato:**

- **IG Story:** `{ "template": "card" | "minimal" | "bold", "link_sticker": true }`
- **IG Reel:** `{ "source": "youtube_download", "aspect_ratio": "9:16" }`
- **FB Link Share:** `{ "og_preview": true }`
- **BS Link Card:** `{ "thumb_blob_ref": "..." }` (blob CID apos upload para AT Protocol)

### 3.4 Content Tables — Coluna `social_config` JSONB

Adicionada a 3 tabelas de conteudo CMS:

```sql
ALTER TABLE blog_posts ADD COLUMN social_config JSONB;
ALTER TABLE newsletter_editions ADD COLUMN social_config JSONB;
ALTER TABLE campaigns ADD COLUMN social_config JSONB;
```

**Shape do `social_config`:**

```json
{
  "enabled": true,
  "platforms": ["facebook", "instagram", "bluesky"],
  "captions": {
    "facebook": { "pt": "Novo post sobre IA no blog!", "en": "New AI blog post!" },
    "instagram": { "pt": "Confira o novo artigo sobre AI Empire" },
    "bluesky": { "pt": "AI Empire — novo artigo no blog" }
  },
  "hashtags": ["#AI", "#BuildInPublic"],
  "image_source": "og_image",
  "ig_template": "card",
  "formats": {
    "facebook": "link_share",
    "instagram": "story",
    "bluesky": "link_card"
  }
}
```

**Campos:**

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `enabled` | `boolean` | Se `true`, publicar conteudo dispara pipeline social automaticamente |
| `platforms` | `string[]` | Quais plataformas recebem o post. So mostra providers com conexao ativa |
| `captions` | `object` | Captions por plataforma e idioma. Editados no Social Tab do editor |
| `hashtags` | `string[]` | Hashtags aplicadas a todos os posts. Auto-importadas das tags do conteudo |
| `image_source` | `string` | De onde vem a imagem: `og_image`, `cover_image`, ou `custom` |
| `ig_template` | `string` | Template do IG Story: `minimal`, `card`, `bold` |
| `formats` | `object` | Override de formato por plataforma (default inferido do content type) |

**Nota:** `social_config` e `NULL` por default. `NULL` = social sharing desabilitado. Quando o usuario ativa o toggle no Social Tab, o campo e populado com defaults baseados no content type.

### 3.5 Pipeline Steps — Shape JSONB

O campo `pipeline_steps` em `social_posts` e um array JSONB onde cada elemento representa uma etapa do pipeline:

```json
[
  {
    "step": "post_created",
    "status": "completed",
    "at": "2026-05-12T14:22:00Z"
  },
  {
    "step": "short_link",
    "status": "completed",
    "at": "2026-05-12T14:22:01Z",
    "data": {
      "link_id": "a1b2c3d4-...",
      "code": "ai-empire"
    }
  },
  {
    "step": "og_scrape",
    "status": "completed",
    "at": "2026-05-12T14:23:12Z",
    "data": {
      "tags": 7,
      "latency_ms": 1200,
      "status": 200
    }
  },
  {
    "step": "deliver",
    "status": "completed",
    "at": "2026-05-12T14:25:38Z"
  }
]
```

**Status possiveis por step:** `pending`, `in_progress`, `completed`, `warning`, `failed`

| Status | Significado |
|--------|------------|
| `pending` | Etapa ainda nao iniciada |
| `in_progress` | Etapa em execucao |
| `completed` | Etapa finalizada com sucesso |
| `warning` | Etapa finalizada com problema nao-bloqueante (ex: OG scrape timeout, mas pipeline continua) |
| `failed` | Etapa falhou de forma bloqueante (pipeline para) |

**Invariante:** steps sao append-only e ordenados cronologicamente. Status de um step nunca regride (nao volta de `completed` para `in_progress`).

### 3.6 Novos Indices

```sql
-- Busca rapida: qual social post corresponde a este conteudo?
CREATE INDEX idx_social_posts_source
  ON social_posts(source_content_type, source_content_id)
  WHERE source_content_id IS NOT NULL;

-- Busca por short link (join com tracked_links para analytics)
CREATE INDEX idx_social_posts_short_link
  ON social_posts(short_link_id)
  WHERE short_link_id IS NOT NULL;

-- Unique partial index: no maximo 1 social post ativo por conteudo
-- Impede duplicacao acidental quando pipeline esta em andamento
CREATE UNIQUE INDEX idx_social_posts_active_per_content
  ON social_posts(source_content_type, source_content_id)
  WHERE status IN ('draft','scheduled','publishing')
    AND source_content_id IS NOT NULL;
```

### 3.7 Estrategia de Re-publish

O unique partial index `idx_social_posts_active_per_content` governa a logica de re-publicacao:

| Cenario | Acao |
|---------|------|
| Nenhum social post anterior para este conteudo | Criar novo normalmente |
| Social post anterior com status `completed` ou `partial_failure` ou `failed` | Criar NOVO post (anterior permanece como historico) |
| Social post anterior com status `draft` ou `scheduled` | ATUALIZAR existente (evita duplicacao) |
| Social post anterior com status `publishing` | Rejeitar com erro `"Pipeline em execucao — aguarde conclusao ou cancele"` |
| Social post anterior com status `cancelled` | Criar novo normalmente (cancelled nao esta no partial index) |

Essa estrategia garante que:
1. Nunca existam 2 posts ativos para o mesmo conteudo (enforced pelo DB)
2. Historico de publicacoes anteriores e preservado
3. Rascunhos e agendamentos podem ser atualizados sem criar duplicatas

---

## 4. Core Function: `createSocialPostFromContent()`

### 4.1 Localizacao

`apps/web/src/lib/social/create-from-content.ts`

### 4.2 Assinatura

```typescript
export async function createSocialPostFromContent(params: {
  siteId: string
  contentType: 'blog' | 'newsletter' | 'campaign' | 'video'
  contentId: string
  config: SocialConfig
  origin: 'auto' | 'publish_modal' | 'manual'
  scheduledAt?: string   // ISO 8601 — se ausente, execucao imediata
  userId: string
}): Promise<{ postId: string; shortLinkId: string }>
```

### 4.3 Fluxo de Execucao

```
1. requireSiteAdmin(siteId)
   |
2. extractContentMetadata(contentType, contentId)
   |   -> { title, url, image, excerpt, tags, locale }
   |
3. Verificar regras de re-publish (unique index guard)
   |   -> Se draft/scheduled existente: full update (content, captions, platforms, pipeline_steps resetado)
   |   -> Se publishing existente: throw
   |   -> Se completed/failed existente: create novo (historico preservado)
   |   -> Senao: create
   |
4. createTrackedLink({ source_type, source_id, destination_url, redirect_type: 301 })
   |   -> shortLink { id, code, short_url }
   |
5. Criar/atualizar social_post com todos os campos
   |   + pipeline_steps[0] = post_created (completed)
   |   + pipeline_steps[1] = short_link (completed)
   |
6. Criar social_deliveries por plataforma
   |   + format inferido do content-format mapping
   |   + template_config baseado no ig_template / provider defaults
   |
7. Se scheduledAt: status = 'scheduled' (cron pega depois)
   Se imediato: call triggerPipeline(postId)
   |
8. Return { postId, shortLinkId }
```

**Step 1 — Autorizacao:**
```typescript
await requireSiteAdmin(siteId)
```
Segue a regra do CLAUDE.md: write actions DEVEM chamar `requireSiteAdmin` no topo. Sem essa validacao, cross-ring writes sao possiveis via `getSupabaseServiceClient()`.

**Step 2 — Extracao de Metadados:**

Helper: `extractContentMetadata()` em `apps/web/src/lib/social/content-metadata.ts`

```typescript
export async function extractContentMetadata(
  contentType: ContentType,
  contentId: string,
): Promise<ContentMetadata>
```

| Content Type | title | url | image | excerpt | tags |
|-------------|-------|-----|-------|---------|------|
| `blog` | `blog_posts.title` | `/{locale}/blog/{slug}` | `cover_image_url` | `excerpt` | `tags[]` |
| `newsletter` | `newsletter_editions.subject` | `/{locale}/newsletter/{newsletter_type.slug}/editions/{edition.id}` (archive URL construída via `newsletter_types.slug` + `edition.id`) | Cover image extraída do `content` HTML (primeiro `<img>`) ou og_image do newsletter_type | Preheader ou primeiros 160 chars do `content` | — |
| `campaign` | `campaigns.meta_title` | `/{locale}/campaign/{slug}` | `og_image_url` | `meta_description` | — |
| `video` | YouTube `title` | `youtube.com/watch?v={videoId}` | `thumbnail_url` | `description` (160 chars) | `tags[]` |

**Step 3 — Re-publish Guard:**
```typescript
const existing = await supabase
  .from('social_posts')
  .select('id, status')
  .eq('source_content_type', contentType)
  .eq('source_content_id', contentId)
  .in('status', ['draft', 'scheduled', 'publishing'])
  .maybeSingle()

if (existing?.status === 'publishing') {
  throw new Error('Pipeline em execucao — aguarde conclusao ou cancele')
}
// Se draft/scheduled: update existing.id em vez de insert
```

**Step 4 — Short Link:**
Reutiliza `createTrackedLink()` do Links Engine existente (`apps/web/src/lib/links/`). O short link aponta para a URL canonica do conteudo com UTM parameters automaticos:
- `utm_source={provider}` (setado na hora da entrega, nao na criacao do link)
- `utm_medium=social`
- `utm_campaign={contentType}-{contentId}`

**Step 6 — Criacao de Deliveries:**
Uma `social_delivery` por plataforma habilitada. O `connection_id` e resolvido buscando a conexao ativa do provider para o site. Se nao houver conexao ativa, a plataforma e ignorada (com warning log).

### 4.4 Idempotencia

A funcao e idempotent para chamadas com o mesmo `(contentType, contentId)` enquanto o post estiver em `draft` ou `scheduled` — nesse caso, atualiza o existente. Isso protege contra:
- Double-click no botao "Publicar"
- Retry apos timeout de rede
- Cron re-execucao

---

## 5. Pipeline Orchestration

### 5.1 Visao Geral

O pipeline tem 4 etapas sequenciais. As 2 primeiras sao sincronas (executadas em `createSocialPostFromContent`). As 2 ultimas sao assincronas (executadas via API route):

```
Step 1: Post Created        (sincrono — em createSocialPostFromContent)
Step 2: Short Link Created   (sincrono — em createSocialPostFromContent)
          |
          v
Step 3: OG Scrape            (assincrono — POST graph.facebook.com/?id={url}&scrape=true)
Step 4: Deliver              (assincrono — publishSocialPost() existente, aprimorado)
```

Tempo estimado end-to-end: **~2-3 minutos** (OG scrape ~1-2s, delivery paralela ~30s-2min dependendo de upload de media).

### 5.2 Posts Imediatos

Para posts com execucao imediata (sem `scheduledAt`):

1. `createSocialPostFromContent()` executa Steps 1-2 sincronamente
2. Chama `POST /api/social/pipeline/run` com `{ postId }` via `fetch()` server-side (fire-and-forget: `fetch(...).catch(captureException)` sem `await` no caller). Se o fetch falhar, o cron de scheduled posts funciona como safety net — ele identifica posts com `status='scheduled'` e `pipeline_steps` incompleto e re-tenta
3. O route handler executa:

```typescript
// POST /api/social/pipeline/run
export async function POST(req: Request) {
  const { postId } = await req.json()
  const supabase = getSupabaseServiceClient()

  // Step 3: OG Scrape
  await updatePipelineStep(supabase, postId, 'og_scrape', 'in_progress')

  const post = await getPostWithShortLink(supabase, postId)
  const scrapeResult = await scrapeOg(post.shortUrl, post.pageToken)

  if (scrapeResult.status === 'ok') {
    await updatePipelineStep(supabase, postId, 'og_scrape', 'completed', scrapeResult)
  } else {
    // OG scrape failure NAO bloqueia delivery
    await updatePipelineStep(supabase, postId, 'og_scrape', 'warning', scrapeResult)
  }

  // Step 4: Deliver
  await updatePipelineStep(supabase, postId, 'deliver', 'in_progress')
  const post = await getSocialPost(postId) // fetch full SocialPost object
  await publishSocialPost(post)  // funcao existente recebe SocialPost object (nao apenas ID)
  await updatePipelineStep(supabase, postId, 'deliver', 'completed')
}
```

Cada atualizacao de `pipeline_steps` dispara Supabase Realtime -> a UI atualiza em tempo real mostrando progresso do pipeline.

### 5.3 Posts Agendados

Para posts com `scheduledAt`:

- **Na criacao:** Steps 1-2 executados sincronamente. Post salvo com `status = 'scheduled'`
- **Cron existente aprimorado** (`/api/social/cron/social-publish`):

```
Query: WHERE status = 'scheduled'
       AND scheduled_at <= now() + interval '5 minutes'

Para cada post encontrado:
  1. Se scheduled_at - now() <= 5 min E og_scrape nao executado:
     -> Executar Step 3 (OG scrape antecipado)
  2. Se scheduled_at <= now():
     -> Executar Step 4 (delivery)
```

**Por que OG scrape 5 min antes?** O Facebook Debugger leva ~1-2s para processar, mas ocasionalmente pode demorar ate 10s. Executar antecipadamente garante que os OG tags estarao cacheados no Facebook quando o post for publicado — o link preview aparece corretamente desde o primeiro segundo.

### 5.4 OG Scrape Implementation

```typescript
const SCRAPE_TIMEOUT_MS = 10_000

async function scrapeOg(
  url: string,
  pageToken: string,
): Promise<OgScrapeResult> {
  const start = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS)

  try {
    const res = await fetch(
      `https://graph.facebook.com/?id=${encodeURIComponent(url)}&scrape=true`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${pageToken}` },
        signal: controller.signal,
      },
    )
    const data = await res.json()
    const elapsed = Date.now() - start

    return {
      status: 'ok',
      tags: Object.keys(data.og_object || {}).length,
      latency_ms: elapsed,
      http_status: res.status,
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    return {
      status: error.name === 'AbortError' ? 'timeout' : 'error',
      error: error.message,
    }
  } finally {
    clearTimeout(timeout)
  }
}
```

**Decisoes de design:**

- **Timeout de 10s** — Facebook Debugger normalmente responde em 1-2s. 10s cobre edge cases sem travar o pipeline
- **Fallback gracioso** — scrape failure NAO bloqueia delivery. O Facebook pode ter OG tags cacheados de crawls anteriores. O step fica com status `warning` (nao `failed`)
- **Page token obrigatorio** — usa o token da conexao Facebook do site. Se nao houver conexao Facebook, step e skipped com `warning`

### 5.5 Cancelamento de Pipeline

Cada step verifica `post.status` antes de executar. Se o post foi cancelado, o step aborta:

```typescript
async function checkNotCancelled(supabase: SupabaseClient, postId: string): Promise<void> {
  const { data } = await supabase
    .from('social_posts')
    .select('status')
    .eq('id', postId)
    .single()

  if (data?.status === 'cancelled') {
    throw new PipelineCancelledError(postId)
  }
}
```

**UI:** Botao "Cancelar Pipeline" visivel na pagina de detalhe do post enquanto `status = 'publishing'`. Ao clicar:
1. Chama `cancelSocialPost()` existente (seta `status = 'cancelled'`, deliveries para `'skipped'`)
2. Pipeline em execucao detecta cancelamento no proximo checkpoint e aborta
3. Supabase Realtime notifica a UI

**Nota:** se uma delivery ja foi enviada (ex: Facebook ja postou), o cancelamento nao revoga a publicacao na plataforma — apenas impede que as deliveries restantes sejam executadas.

---

## 6. CMS Integration

### 6.1 Social Tab (Tela 1)

Novo componente compartilhado reutilizado em todos os editores de conteudo CMS:

**Localizacao:** `apps/web/src/app/cms/(authed)/_shared/social/social-tab.tsx`

**Props:**
```typescript
interface SocialTabProps {
  contentType: 'blog' | 'newsletter' | 'campaign' | 'video'
  contentId: string
  socialConfig: SocialConfig | null
  onConfigChange: (config: SocialConfig) => void
  connections: SafeConnection[]   // conexoes ativas do site (sem tokens)
}
```

**Secoes da UI (top-down):**

1. **Share Toggle** — switch com label "Compartilhar nas redes sociais ao publicar". Quando ativado, revela o restante do formulario. Gradiente accent sutil (blue->purple) no estado ativo

2. **Platform Chips** — chips horizontais mostrando providers conectados. Cada chip tem icone do provider + nome. Plataformas sem conexao ativa aparecem desabilitadas com tooltip "Conecte em Social > Accounts". Click toggle para incluir/excluir plataforma

3. **Format Badges** — badges auto-inferidos do content type. Ex: blog mostra "FB: Link Share", "IG: Story", "BS: Link Card". Read-only, mas com tooltip explicando o formato. Override disponivel via dropdown em cada badge

4. **Caption Editor** — tabs por plataforma (Facebook | Instagram | Bluesky). Dentro de cada tab: toggle de idioma (PT/EN). Textarea com character count em tempo real (Facebook: 63.206 max, Instagram: 2.200 max, Bluesky: 300 max). Placeholder inteligente: "Escreva uma mensagem para o Facebook..." pre-populado com excerpt do conteudo

5. **Hashtag Manager** — input de tags com autocomplete. Auto-importa tags do conteudo (blog tags, etc). Remove duplicatas. Mostra count de hashtags (Instagram max: 30)

6. **Image Source Picker** — radio group: "OG Image" (default), "Cover Image", "Custom". Preview da imagem selecionada. Para custom: abre MediaGalleryDialog existente

7. **IG Story Template Selector** — visivel apenas quando Instagram esta habilitado e formato = Story. 3 opcoes visuais: Minimal (texto simples + link sticker), Card (card com imagem + titulo + link sticker), Bold (full-bleed imagem + overlay de texto). Preview miniatura de cada template

8. **OG Tags Display** — secao colapsavel "Meta Tags". Mostra tags OG atuais do conteudo (title, description, image, url) — read-only. Link para editar no SEO tab do editor. Indicadores: check verde se tag presente, warning amarelo se ausente

9. **Pipeline Preview** — one-liner no rodape: "Publish -> Short Link -> OG Scrape -> Deliver ~2-3 min". Cada etapa com icone (check, link, globe, send). Tooltip com descricao de cada step

**Integracao nos editores:**

- **Blog:** nova tab "Social" no editor (ao lado de SEO, Media, etc)
- **Newsletter:** nova secao "Social Sharing" no sidebar do editor
- **Campaign:** nova secao "Social Sharing" no sidebar do editor

### 6.2 Publish Hooks (Thin)

Cada server action de publicacao recebe ~5 linhas adicionais. A logica e identica para todos — so muda o `contentType`:

**Blog — `publishPost()`**
Localizacao: `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts`
```typescript
// Apos publicacao bem-sucedida do blog post:
if (post.social_config?.enabled) {
  createSocialPostFromContent({
    siteId,
    contentType: 'blog',
    contentId: postId,
    config: post.social_config,
    origin: 'auto',
    userId,
  }).catch((err) =>
    captureException(err, { context: 'social-auto-share', postId }),
  )
}
```

**Newsletter — `sendNow()`**
Localizacao: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`
```typescript
if (edition.social_config?.enabled) {
  createSocialPostFromContent({
    siteId,
    contentType: 'newsletter',
    contentId: editionId,
    config: edition.social_config,
    origin: 'auto',
    userId,
  }).catch((err) =>
    captureException(err, { context: 'social-auto-share', editionId }),
  )
}
```

**Campaign — `publishCampaign()`**
Localizacao: `apps/web/src/app/cms/(authed)/campaigns/[id]/edit/actions.ts`
```typescript
if (campaign.social_config?.enabled) {
  createSocialPostFromContent({
    siteId,
    contentType: 'campaign',
    contentId: campaignId,
    config: campaign.social_config,
    origin: 'auto',
    userId,
  }).catch((err) =>
    captureException(err, { context: 'social-auto-share', campaignId }),
  )
}
```

**Bulk Operations — `bulkPublish()` e `bulkPublishCampaigns()`**
Itera os IDs publicados com sucesso. Fire-and-forget por item:
```typescript
for (const id of successIds) {
  const item = items.find((i) => i.id === id)
  if (item?.social_config?.enabled) {
    createSocialPostFromContent({
      siteId,
      contentType,
      contentId: id,
      config: item.social_config,
      origin: 'auto',
      userId,
    }).catch((err) =>
      captureException(err, { context: 'social-auto-share-bulk', id }),
    )
  }
}
```

**Principio critico:** hooks sao fire-and-forget (`catch` sem `await`). A publicacao do conteudo CMS SEMPRE tem sucesso independente de falhas sociais. Erros sao capturados pelo Sentry com contexto rico (`contentType`, `contentId`, `origin`) para debugging.

### 6.3 Kanban Modal Enhancement (Tela 2)

O modal de agendamento no pipeline editor e aprimorado quando `social_config.enabled = true`:

**Layout do modal (3 secoes):**

1. **Header** — "Agendar Publicacao" com subtitle mostrando titulo do conteudo

2. **Social Share Confidence Card** — card com header verde "Tudo pronto para compartilhar":
   - Lista de plataformas com status dot (verde = conectado, cinza = desconectado)
   - Preview compacto do conteudo: link curto, caption principal (truncado), imagem thumbnail
   - Mini preview grid: 3 miniaturas lado a lado mostrando como o post aparece em cada plataforma (Facebook card + IG Story + Bluesky card)
   - Pipeline one-liner: "Publish -> Link -> OG -> Post em ~2-3 min"

3. **Actions** — 3 botoes:
   - **"Agendar + Social"** (primary, azul) — agenda conteudo E dispara pipeline social no `scheduledAt`
   - **"Agendar sem Social"** (secondary, outline) — agenda conteudo sem social sharing
   - **"Personalizar no Social Hub"** (link) — redireciona para `/cms/social/new?source={contentType}&id={contentId}` com dados pre-populados no Composer

**Variante Video Pipeline:**
Mesmo modal, mas o mini preview grid mostra:
- Facebook: Link Share com embed do YouTube (thumbnail + play button)
- Instagram: Reel (preview vertical 9:16 com thumbnail)
- Bluesky: Link Card com thumbnail do YouTube

**Nota sobre video:** videos NAO sao publicados no YouTube via este fluxo — ja sao gerenciados pelo modulo YouTube existente. O Social Hub apenas promove o video nas OUTRAS plataformas.

## 7. Composer Redesign (Tela 3)

**Localização:** `apps/web/src/app/cms/(authed)/social/new/`

O Composer é reconstruído em torno da arquitetura "Social Post First". O fluxo principal parte de conteúdo CMS existente (blog, newsletter, campaign, vídeo) e preenche automaticamente todos os campos. O fluxo secundário ("Compor do zero") mantém a experiência manual sem pipeline tracking.

### 7.1 Content Source Picker

Toggle de modo no topo do Composer:

| Modo | Label | Comportamento |
|------|-------|--------------|
| CMS | "Do CMS" | Abre picker de conteúdo, auto-preenche campos, cria short link, pipeline completo (4 etapas) |
| Manual | "Compor do zero" | Sem picker, sem auto-fill, sem short link automático, entrega direta |

**Modo CMS — Tabs de tipo:**

| Tab | Query | Badge count |
|-----|-------|-------------|
| Todos | Sem filtro (todos os conteúdos CMS publicados: blog_posts + newsletter_editions + campaigns + videos) | total |
| Blog | `type = 'blog_post'` | count |
| Newsletter | `type = 'newsletter_edition'` | count |
| Campaign | `type = 'campaign'` | count |
| Vídeo | `type = 'video'` | count |

**Lista pesquisável:**
- Input de busca com debounce 300ms filtrando por título
- Cada item exibe: thumbnail (48×48, `object-cover`, `rounded-md`), título (truncado 1 linha), type badge colorido, status indicator (published = verde, draft = cinza, scheduled = azul)
- Ordenação padrão: mais recente primeiro (`updated_at DESC`)
- Paginação por scroll infinito (20 itens por página)

**Ao selecionar conteúdo:**

Auto-fill é **server-side**: o componente chama uma server action `getContentForSocialPost(contentType, contentId)` que retorna metadata pré-formatada (título, URL, imagem, excerpt, tags). O client recebe e popula o form. Truncação de captions para limites de plataforma acontece no client (ao renderizar o caption editor, não no servidor).

1. Preenche `title` do post a partir do título do conteúdo
2. Preenche `url` a partir da URL pública do conteúdo
3. Preenche `image` a partir de `cover_image` ou `og_image`
4. Importa tags do conteúdo como hashtags
5. Gera captions iniciais a partir de `excerpt` / `description` — cada platform tab recebe o mesmo texto base, user edita por plataforma
6. Badge "Auto-preenchido" (pill roxa, texto `text-xs`) aparece ao lado de cada campo preenchido automaticamente
7. Todos os campos permanecem editáveis — o badge desaparece ao editar manualmente

### 7.2 Platform Selection

Chips toggle horizontais para cada plataforma conectada. Layout: `flex gap-2 flex-wrap`.

| Chip | Cor ativa | Ícone |
|------|-----------|-------|
| Facebook | `bg-blue-500/10 border-blue-500/30` | FB icon 16px |
| Instagram | `bg-pink-500/10 border-pink-500/30` | IG icon 16px |
| Bluesky | `bg-cyan-500/10 border-cyan-500/30` | BS icon 16px |

**Inferência automática de formato por tipo de conteúdo:**

| Tipo de conteúdo | Facebook | Instagram | Bluesky |
|-----------------|----------|-----------|---------|
| Blog | Link Share | Story | Link Card |
| Newsletter | Link Share | Story | Link Card |
| Campaign | Image Post | Story | Link Card |
| Video | Link Share (YouTube embed) | Reel | Link Card |

O formato é exibido como badge (`text-[9px] uppercase tracking-wider`) abaixo de cada chip ativo.

**Plataformas desabilitadas:**
- Não conectada: chip `opacity-40`, cursor `not-allowed`, tooltip "Conta não conectada — vá para Accounts"
- Formato incompatível: chip `opacity-40`, tooltip com explicação (ex: "YouTube requer modo Vídeo")

### 7.3 Caption Editor

Tabs por plataforma no topo do editor de caption. Cada tab exibe ícone da plataforma (14px) + contador de caracteres em tempo real.

| Tab | Limite | Cor do contador |
|-----|--------|-----------------|
| Facebook | 63.206 chars | `text-muted-foreground` (dificilmente atinge) |
| IG Story | 2.200 chars | Amarelo quando >1.800, vermelho quando >2.200 |
| Bluesky | 300 chars | Amarelo quando >250, vermelho quando >300 |

**Toggle de idioma:** Botão `PT / EN` no canto superior direito do editor. Ao alternar, o textarea troca entre as versões. Ambas as versões são salvas em `caption_pt` e `caption_en` no JSONB.

**Auto-fill:** Ao selecionar conteúdo CMS, cada tab recebe um texto inicial derivado do `excerpt` do conteúdo, adaptado ao limite da plataforma. O usuário pode editar livremente.

**Textarea:** `min-h-[120px]`, `font-size: 13px`, `line-height: 1.55`, monospace para URLs inline. Hashtags no texto renderizam em `text-cyan-400`.

### 7.4 Media & OG

**Seção de imagem fonte:**
- Card com preview da cover image (`aspect-ratio: 1200/630`, `rounded-md`, `border border-border`)
- Dimensões exibidas abaixo (`text-xs text-muted-foreground`): "1200 × 630px"
- Botão "Trocar Imagem" abre Media Gallery picker
- Para IG Story: nota "Será gerada imagem 1080×1920 a partir do template"

**Short link (somente modo CMS):**
- Campo read-only exibindo `go.bythiagofigueiredo.com/{code}`
- Ícone de cópia ao lado
- Badge "AUTO" (`text-[8px] bg-cyan-500/10 text-cyan-400 rounded`)
- UTM tags mostrados abaixo: `utm_source=social&utm_medium={platform}`

**OG Tags — grid compacto (3 colunas):**

| Coluna 1 | Coluna 2 | Coluna 3 |
|----------|----------|----------|
| `og:title` | `og:description` | `og:image` |
| Valor truncado (1 linha) | Valor truncado (2 linhas) | Thumbnail 48×25px |
| Char count: `{n}/60` | Char count: `{n}/155` | Dimensões: `1200×630` |

Cada célula com `border border-border rounded-md p-2`. Valores em `font-mono text-xs`.

**Hashtags:**
- Pills horizontais importadas das tags do conteúdo (`bg-cyan-500/8 border-cyan-500/15 text-cyan-400 text-xs rounded`)
- Botão "+ Adicionar" para tags manuais
- Máximo: 30 hashtags (limite IG). Contador: `{n}/30`

### 7.5 Schedule Bar

Barra fixa no rodapé do Composer. `border-t border-border bg-background/95 backdrop-blur-sm p-4`.

**3 modos (toggle group):**

| Modo | Label | Comportamento |
|------|-------|--------------|
| Agora | "Agora" | Pipeline inicia imediatamente ao publicar |
| Agendar | "Agendar" | Date/time picker aparece, publica no horário definido |
| Fila | "Fila" | Auto-schedule para próximo slot livre de 2h entre 9h-21h BRT, busca nos próximos 7 dias |

**Agendar — date/time picker:**
- Input de data (`type="date"`) + input de hora (`type="time"`)
- Timezone display fixo: "BRT (UTC-3)" como badge ao lado
- Validação: não permite datas passadas

**Fila — auto-schedule:**
- Calcula o próximo slot livre de 2h entre 9h e 21h (BRT): 9h, 11h, 13h, 15h, 17h, 19h, 21h
- Slots ocupados = posts com `status = 'scheduled'` nesses horários
- Exibe preview: "Próximo slot: Ter 14 Mai, 15:00 BRT"
- Se todos os slots dos próximos 7 dias estiverem ocupados: mensagem "Fila cheia — use Agendar para escolher horário"

**Pipeline one-liner:**
Texto descritivo abaixo dos modos (somente modo CMS):
```
AUTO → Post → Short Link → OG Scrape → Deliver ~ 2-3 min
```
Cada etapa é um dot (`w-2 h-2 rounded-full`) com label. Dots cinza antes de publicar, azul pulsante durante execução, verde ao completar.

**Botões de ação:**

| Botão | Variante | Visibilidade |
|-------|----------|-------------|
| "Salvar Rascunho" | `variant="outline"` | Sempre visível |
| "Publicar" | `variant="default" bg-emerald-600` | Quando modo = Agora |
| "Agendar" | `variant="default" bg-blue-600` | Quando modo = Agendar |
| "Adicionar à Fila" | `variant="default" bg-purple-600` | Quando modo = Fila |

### 7.6 Free-Form Mode

Quando o toggle está em "Compor do zero":

- Content Picker oculto — não aparece na tela
- Nenhum campo auto-preenchido; todos iniciam vazios
- Short link não é criado automaticamente (usuário pode colar URL manualmente no campo de URL)
- Seção OG Tags oculta (sem URL para validar)
- Pipeline one-liner oculto (sem pipeline tracking)
- Ao publicar, chama `createSocialPost()` existente (entrega direta) ao invés de `createSocialPostFromContent()`
- Fluxo simplificado: post → deliver (sem etapas intermediárias de short link e OG scrape)

**Novos componentes:**

| Arquivo | Responsabilidade |
|---------|-----------------|
| `content-picker.tsx` | Busca e seleção de conteúdo CMS com tabs por tipo, thumbnails, busca e paginação |
| `caption-tabs.tsx` | Editor de caption por plataforma com toggle PT/EN, contadores de caracteres e limites |
| `schedule-bar.tsx` | Seletor de modo de agendamento (Agora / Agendar / Fila) com botões de ação |
| `og-compact.tsx` | Grid compacto de 3 colunas para exibição de OG tags com char counts e thumbnail |

Todos em `apps/web/src/app/cms/(authed)/social/new/_components/`.

---

## 8. OG Validation & Debugger (Tela 4)

**Nova página:** `apps/web/src/app/cms/(authed)/social/[id]/og/page.tsx`

Página dedicada para validação e depuração de OG tags do post social. Acessível via link no Post Detail e após conclusão da etapa "OG Scrape" do pipeline.

### 8.1 Validation Hero

Card hero no topo da página. Duas variantes:

| Estado | Background | Ícone | Título |
|--------|------------|-------|--------|
| Sucesso | `bg-emerald-500/8 border-emerald-500/20` | Check circle verde | "OG Tags validadas com sucesso" |
| Erro | `bg-red-500/8 border-red-500/20` | Alert circle vermelho | "Falha na validação de OG Tags" |

**Checklist de 7 itens** (cada um com status check/cross/na):

| # | Item | Critério de sucesso |
|---|------|-------------------|
| 1 | `og:title` presente e dentro do limite | Existe e `length <= 60` |
| 2 | `og:description` presente e dentro do limite | Existe e `length <= 155` |
| 3 | `og:image` acessível e dimensões corretas | HTTP 200 + `1200×630px` |
| 4 | `og:url` resolve corretamente | Short link → destino, HTTP 200 |
| 5 | `og:type` definido | Não vazio |
| 6 | Facebook cache atualizado | Scrape executado com HTTP 200 |
| 7 | Instagram Story | N/A — usa imagem gerada, não OG tags |

O item 7 sempre exibe badge `N/A` em cinza com tooltip explicativo.

### 8.2 URL Resolution Chain

Visualização horizontal da cadeia de redirecionamento:

```
go.bythiagofigueiredo.com/ai-empire  →  301  →  bythiagofigueiredo.com/blog/ai-empire  →  200 OK
```

Layout: 3 blocos inline com setas conectoras (CSS lines, como no pipeline).

| Bloco | Estilo |
|-------|--------|
| Short URL | `font-mono text-xs bg-background border rounded-md px-3 py-1.5` |
| Status code 301 | `text-[9px] uppercase text-amber-400 bg-amber-500/10 rounded px-1.5` |
| Destination URL | `font-mono text-xs bg-background border rounded-md px-3 py-1.5` |
| Status 200 | `text-[9px] uppercase text-emerald-400 bg-emerald-500/10 rounded px-1.5` |

### 8.3 OG Tags Table

Tabela com 7 linhas. Sem paginação.

| Coluna | Largura | Formatação |
|--------|---------|-----------|
| Tag | `w-[140px]` | `font-mono text-xs text-cyan-400` |
| Value | `flex-1` | `font-mono text-xs`, truncado com tooltip no hover |
| Status | `w-[80px]` | Badge: verde "OK" / vermelho "Missing" / amarelo "Warning" |

**Linhas:**

| Tag | Exemplo de valor | Regra de status |
|-----|-----------------|-----------------|
| `og:title` | "AI Empire: O Que Vem Por Aí" | OK se presente e <= 60 chars |
| `og:description` | "Como construir..." | OK se presente e <= 155 chars |
| `og:image` | `https://...` + thumbnail 48×25px inline | OK se acessível e 1200×630 |
| `og:url` | `https://bythiagofigueiredo.com/blog/...` | OK se HTTP 200 |
| `og:type` | "article" | OK se presente |
| `og:site_name` | "By Thiago Figueiredo" | OK se presente |
| `og:locale` | "pt_BR" | OK se presente |

Para `og:image`, a coluna Value exibe o URL em monospace + thumbnail preview ao lado direito do valor.

### 8.4 Scrape Details

Card de detalhes técnicos do scrape executado.

| Campo | Valor | Formatação |
|-------|-------|-----------|
| Endpoint | `POST graph.facebook.com/?id={url}&scrape=true` | `font-mono text-xs` |
| Status | `200 OK` ou mensagem de erro | Badge verde/vermelho |
| Latência | Ex: `1.2s` | `font-mono` |
| Timestamp | Data/hora da execução | `text-muted-foreground` |
| Pipeline status | 4 dots de 16px com status | Dot visualization inline |

**Pipeline dot visualization:**
4 dots horizontais (Post → Short Link → OG Scrape → Deliver) com a etapa atual destacada em azul pulsante. Dots anteriores em verde, posteriores em cinza.

### 8.5 Raw Response

Seção colapsável (default: fechada). Toggle "Mostrar resposta raw" / "Ocultar".

**JSON viewer:**
- `pre` com `bg-background/50 border rounded-md p-4 overflow-x-auto`
- Syntax highlighting:
  - Keys: `text-cyan-400`
  - Strings: `text-emerald-400`
  - Numbers: `text-orange-400`
  - Booleans/null: `text-purple-400`
- `font-mono text-xs leading-relaxed`
- Botão "Copiar JSON" no canto superior direito

### 8.6 Right Panel

Painel lateral direito (`w-[320px]`), sticky. Contém:

**Post Info Card:**
- Status badge (published/scheduled/draft)
- Criado: timestamp
- Publicado: timestamp (ou "Pendente")
- Origem: Manual / Auto / Publish Modal

**Facebook Preview:**
- Card de preview estilo Facebook (avatar, page name, caption, OG card)
- Badge no canto: "OG ✓" verde (se validado) ou "OG ✗" vermelho

**Bluesky Preview:**
- Card de preview estilo Bluesky (handle, post text, link card embed)
- Badge: "OG próprio ✓" — nota explicativa: "Bluesky faz fetch OG independente"

**Instagram Note:**
- Card informativo cinza
- "Story não usa OG tags — imagem gerada via template"
- Exibe thumbnail do template que será usado

**Short Link Card:**
- URL com botão copiar
- Status (active/paused)
- Resolution chain compacta (1 linha)

### 8.7 Actions

Barra de ações no topo da página, alinhada à direita.

| Botão | Variante | Ação |
|-------|----------|------|
| "← Voltar" | `variant="ghost"` | Navega para Post Detail |
| "Re-scrape" | `variant="outline"` | Re-executa OG scrape, atualiza `pipeline_steps` |
| "Facebook Debugger ↗" | `variant="outline"` | Abre `https://developers.facebook.com/tools/debug/?q={encoded_url}` em nova tab |

**Server action:** `scrapeOgTags(postId: string)`
1. Busca `social_post` pelo ID com validação de permissão (`requireSiteAdmin`)
2. Obtém token da conexão Facebook via `social_connections`
3. Faz `POST` para `graph.facebook.com/?id={url}&scrape=true` com `access_token`
4. Parseia resposta e estrutura como `OgScrapeResult`
5. Atualiza `pipeline_steps` JSONB no `social_posts` com resultado e timestamp
6. Retorna `OgScrapeResult`

```typescript
interface OgScrapeResult {
  success: boolean
  tags: {
    title?: string
    description?: string
    image?: string
    url?: string
    type?: string
    site_name?: string
    locale?: string
  }
  scrape: {
    status: number
    latency_ms: number
    timestamp: string
    raw_response: Record<string, unknown>
  }
  validation: {
    passed: number
    failed: number
    items: Array<{
      key: string
      status: 'ok' | 'warning' | 'missing' | 'na'
      message: string
    }>
  }
}
```

---

## 9. Links Engine Enhancement (Tela 5)

**Aprimoramento de:** `apps/web/src/app/cms/(authed)/links/page.tsx`

A página de Links Engine existente é enriquecida com dados do Social Hub. Links criados automaticamente via `createSocialPostFromContent()` aparecem com contexto social (plataformas, delivery status, OG validation).

### 9.1 KPI Row (4 cards)

Layout: `grid grid-cols-4 gap-4`. Cada card com `border rounded-md p-4`.

| Card | Valor | Query | Extra |
|------|-------|-------|-------|
| Total Links | Count de `tracked_links` ativos | `WHERE deleted_at IS NULL AND status = 'active'` | Trend vs. período anterior |
| Total Clicks | Soma de `total_clicks` | `SUM(total_clicks)` | Trend vs. período anterior |
| Visitantes Únicos | Soma de `unique_visitors` | `SUM(unique_visitors)` | Trend vs. período anterior |
| Social Links | Count de links com social_posts associados | `JOIN social_posts ON short_link_id = id` | Badge "AUTO" (`text-[8px] bg-cyan-500/10 text-cyan-400`) |

Trends exibidos como porcentagem com seta (verde ↑ positivo, vermelho ↓ negativo). Período padrão: últimos 30 dias vs. 30 dias anteriores.

### 9.2 Charts Row

Layout: `grid grid-cols-2 gap-4`.

**Chart 1 — Daily Clicks Sparkline:**
- Dual-line chart (Recharts `<LineChart>`)
- Linha sólida cyan (`stroke: var(--cyan-400)`): Total clicks por dia
- Linha tracejada pink (`stroke: var(--pink-400)`, `strokeDasharray: "5 3"`): Clicks "Via Social" — clicks em links onde `short_link_id` é referenciado por um `social_post`
- Eixo X: últimos 30 dias, label a cada 7 dias
- Eixo Y: count de clicks
- Tooltip no hover com valores exatos
- Legenda: "Total" (cyan) | "Via Social" (pink)

**Chart 2 — Source Breakdown Bar Chart:**
- Bar chart horizontal (Recharts `<BarChart layout="vertical">`)
- Distribuição por `source_type`: blog, social, newsletter, campaign, manual, vídeo
- Cada barra com cor do tipo (blog = verde, social = roxo, newsletter = azul, campaign = laranja, manual = cinza, vídeo = vermelho)
- Label com porcentagem à direita de cada barra

### 9.3 Social Summary Bar

Barra horizontal entre charts e tabela. `bg-purple-500/5 border border-purple-500/15 rounded-md px-4 py-2`.

Formato do texto:
```
{n} links criados automaticamente | OG validado | FB {n} | IG {n} | BS {n}
```

- `{n} links criados automaticamente`: count de `tracked_links` com `social_posts.short_link_id` associado
- `OG validado`: badge verde se todos os links sociais têm OG validado
- `FB {n}`: count de `social_deliveries` com `provider = 'facebook'` e `status = 'published'`
- `IG {n}`: count de `social_deliveries` com `provider = 'instagram'` e `status = 'published'`
- `BS {n}`: count de `social_deliveries` com `provider = 'bluesky'` e `status = 'published'`

Cada plataforma exibe ícone (12px) + count. Separadores: `|` em `text-muted-foreground`.

### 9.4 Table Enhancements

A tabela existente de tracked_links recebe colunas e indicadores novos.

**Colunas (ordem):**

| # | Coluna | Largura | Conteúdo |
|---|--------|---------|----------|
| 1 | Link | `flex-1` | Código + URL destino (truncada) |
| 2 | Source | `w-[100px]` | Badge colorido do tipo (blog verde, newsletter azul, social roxo, campaign laranja, manual cinza, vídeo vermelho) + ícone de link externo |
| 3 | Social | `w-[100px]` | Dots de plataforma (ver abaixo) |
| 4 | Clicks | `w-[80px]` | Número + sparkline micro (30px de largura) |
| 5 | Únicos | `w-[80px]` | Número |
| 6 | Criado | `w-[100px]` | Data relativa ("há 2 dias") |
| 7 | Ações | `w-[60px]` | Menu dropdown |

**Coluna Social — platform dots:**
- 3 dots circulares (10px) para FB (azul), IG (pink), BS (cyan)
- Status de cada dot:
  - Preenchido + check: delivery `status = 'published'` (verde)
  - Preenchido + relógio: `status = 'pending'` ou `status = 'scheduled'` (amarelo)
  - Preenchido + X: `status = 'failed'` (vermelho)
  - Outline vazio: sem delivery para essa plataforma
- Tooltip no hover de cada dot: "{Platform}: {status} — {timestamp}"

**Row de post agendado:**
- Background com tint amarelo sutil: `bg-yellow-500/[0.015]`
- Indicador lateral esquerdo: borda `border-l-2 border-yellow-500/30`

**Ações adicionais no dropdown:**
- "Ver Social Post" — navega para `/cms/social/{postId}` (visível apenas se link tem social_post associado)

**Sort indicator:**
- Seta ▼ em `text-cyan-400` na coluna ativa de ordenação
- Default: Clicks DESC
- Colunas ordenáveis: Link, Clicks, Únicos, Criado

### 9.5 Filters

Barra de filtros acima da tabela. Layout: `flex flex-wrap gap-2 items-center`.

**Source type pills (toggle group):**

| Pill | Filter | Badge count |
|------|--------|-------------|
| Todos | Sem filtro | Total |
| Blog | `source_type = 'blog'` | Count |
| Social | Links com `social_posts.short_link_id = tracked_links.id` (tem social post associado) | Count |
| Newsletter | `source_type = 'newsletter'` | Count |
| Campaign | `source_type = 'campaign'` | Count |
| Vídeo | `source_type = 'video'` | Count |
| Manual | `source_type = 'manual'` | Count |

Regra de consistência: a soma dos counts de todas as pills individuais deve ser igual ao count de "Todos". Se houver divergência, é bug.

**Status filters (select dropdown):**

| Opção | Filter |
|-------|--------|
| Todos | Sem filtro |
| Active | `status = 'active'` |
| Paused | `status = 'paused'` |
| Expired | `status = 'expired'` |

**Search input:**
- Placeholder: "Buscar por código, título ou URL..."
- Filtra por `code ILIKE`, `title ILIKE`, `destination_url ILIKE`
- Debounce: 300ms

### 9.6 Data Query

Query principal para a tabela com dados sociais integrados:

```sql
SELECT
  tl.*,
  sp.id AS social_post_id,
  sp.status AS social_status,
  array_agg(DISTINCT sd.provider) FILTER (WHERE sd.provider IS NOT NULL) AS social_platforms,
  jsonb_object_agg(sd.provider, sd.status)
    FILTER (WHERE sd.provider IS NOT NULL) AS delivery_statuses
FROM tracked_links tl
LEFT JOIN social_posts sp ON sp.short_link_id = tl.id
LEFT JOIN social_deliveries sd ON sd.post_id = sp.id
WHERE tl.site_id = $1
  AND tl.deleted_at IS NULL
GROUP BY tl.id, sp.id
ORDER BY tl.total_clicks DESC
```

A query usa `FILTER (WHERE ... IS NOT NULL)` nos aggregates para evitar `[null]` em links sem social posts. RLS filters por `site_id` automaticamente.

---

## 10. Post Detail (Tela 6)

**Reconstrução de:** `apps/web/src/app/cms/(authed)/social/[id]/page.tsx`

Página de detalhe completa de um social post. Exibe status de entrega, conteúdo fonte, pipeline, timeline cronológica e painel lateral com cards de entrega por plataforma.

### 10.1 Delivery Hero

Card hero no topo. Duas variantes conforme status:

| Estado | Background | Texto |
|--------|------------|-------|
| Completo | `bg-emerald-500/8 border-emerald-500/20` | "Todas as entregas concluídas {n}/{n}" |
| Parcial | `bg-amber-500/8 border-amber-500/20` | "Entregas parciais {ok}/{total}" |
| Pendente | `bg-blue-500/8 border-blue-500/20` | "Entregas em andamento..." |
| Falhou | `bg-red-500/8 border-red-500/20` | "Falha na entrega {failed}/{total}" |

**Conteúdo do hero:**
- 3 ícones de plataforma (32px) com indicadores de status sobrepostos (checkmark verde, relógio amarelo, X vermelho)
- Duração total: calculada de `pipeline_steps[0].timestamp` até `pipeline_steps[-1].timestamp`. Ex: "2m 38s"
- Range de datas: "12 Mai 14:22 — 14:25"
- Se pipeline ainda em execução: barra de progresso animada

### 10.2 Source Content Card

Visível apenas para posts com `origin != 'manual'` (ou seja, posts criados via `createSocialPostFromContent()`).

| Elemento | Formatação |
|----------|-----------|
| Thumbnail | 64×64px, `object-cover rounded-md` |
| Type badge | Pill colorida: "Blog Post" verde, "Newsletter" azul, "Campaign" laranja, "Vídeo" vermelho |
| Título | `text-sm font-medium`, truncado 2 linhas |
| Data | `text-xs text-muted-foreground` |
| Autor | `text-xs text-muted-foreground` |
| Link "Abrir no CMS" | `text-xs text-purple-400 hover:underline`, navega para o editor do conteúdo original |

### 10.3 Caption Tabs

3 tabs de caption, uma por plataforma. Cada tab exibe ícone + char count.

| Tab | Formato | Exemplo |
|-----|---------|---------|
| Facebook | "Facebook (248/63.206)" | Texto com hashtags em `text-cyan-400` |
| IG Story | "IG Story (85/2.200)" | Texto com hashtags em `text-cyan-400` |
| Bluesky | "Bluesky (196/300)" | Texto com hashtags em `text-cyan-400` |

Conteúdo exibido em `font-mono text-sm leading-relaxed`. Hashtags destacadas com `text-cyan-400`. Somente leitura nesta view (edição via botão "Editar Post").

### 10.4 Pipeline Compact

Visualização compacta do pipeline em 4 etapas. Layout: `flex items-center gap-0` com connecting lines entre dots.

| Etapa | Dot | Label | Timestamp |
|-------|-----|-------|-----------|
| Post | 16px circle | "Post" | "14:22" |
| Short Link | 16px circle | "Short Link" | "14:22" |
| OG Scrape | 16px circle | "OG Scrape" | "14:23" |
| Deliver | 16px circle | "Deliver" | "14:25" |

**Cores dos dots:**

| Status | Cor | Ícone interno |
|--------|-----|---------------|
| Completo | `bg-emerald-500` | Checkmark branco (8px) |
| Em progresso | `bg-blue-500` com pulse animation | Spinner (8px) |
| Pendente | `bg-muted` | Vazio |
| Falhou | `bg-red-500` | X branco (8px) |

Connecting lines: `w-[40px] h-[1px]` entre cada dot. Verde se etapa anterior completou, cinza caso contrário.

### 10.5 Timeline

Lista cronológica vertical de eventos. Cada evento é um item com dot lateral, ícone, descrição e timestamp. Layout inspirado em activity feed.

| # | Evento | Dot | Ícone | Detalhes |
|---|--------|-----|-------|----------|
| 1 | Post criado | `bg-purple-500` | Create (plus-circle) | "12 Mai 14:22" — Origem: {origin} |
| 2 | Short link criado | `bg-blue-500` | Link | Código: `ai-empire` — Redireciona para `/blog/ai-empire` |
| 3 | OG Scrape | `bg-blue-500` | Info (search) | "7 tags validadas, 1.2s, 200 OK" — Link para Tela 4 |
| 4 | Facebook Entregue | `bg-emerald-500` | Check | Post ID: `123456789` (link externo para o post no Facebook) |
| 5 | Instagram Entregue | `bg-emerald-500` | Check | Media ID: `17890...`, Template: Card |
| 6 | Bluesky Entregue | `bg-emerald-500` | Check | AT URI: `at://did:plc:.../app.bsky.feed.post/...` (link externo) |

Eventos de falha usam `bg-red-500` com mensagem de erro e botão "Retry" inline.

Linha vertical conectora entre dots: `border-l border-border` com `ml-[7px]` (centralizada no dot de 16px).

**Data source:** Combinação de `pipeline_steps` JSONB (etapas 1-3) + `social_deliveries` rows (etapas 4-6), ordenados por timestamp ASC.

### 10.6 Right Panel

Painel lateral direito (`w-[320px]`), sticky com `overflow-y-auto max-h-screen`.

**Post Info Card:**

| Campo | Valor |
|-------|-------|
| Status | Badge (published/scheduled/draft/failed) |
| Criado | Timestamp absoluto |
| Publicado | Timestamp absoluto (ou "Pendente") |
| Origem | "Manual" / "Auto" / "Publish Modal" — derivado de `social_posts.origin` |
| Duração | "2m 38s" (ou "Em andamento...") |

**Delivery Cards (1 por plataforma):**

Cada card com `border rounded-md p-3` e borda lateral esquerda colorida:

| Plataforma | Borda esquerda | Campos |
|------------|---------------|--------|
| Facebook | `border-l-2 border-blue-500` | Format: "Link Share", Status: badge, Post ID: link externo, OG: "Validado ✓" |
| Instagram | `border-l-2 border-pink-500` | Format: "Story", Status: badge, Media ID, Template: "{template_name}", Link Sticker: "URL visível no card" |
| Bluesky | `border-l-2 border-cyan-500` | Format: "Link Card", Status: badge, AT URI: link externo, OG: "OG próprio ✓" |

Nota sobre Bluesky: badge "OG próprio ✓" com tooltip "Bluesky faz fetch OG independente do Facebook scrape".

Nota sobre Instagram: campo "Link Sticker" exibe "URL visível no card (não interativo)" — referência à limitação da API (seção 11.5).

**Short Link Card:**
- URL completa: `go.bythiagofigueiredo.com/{code}` com botão copiar
- Resolution chain compacta (1 linha): `{short_url} → 301 → {destination} → 200`
- Grid de 3 stats:

| Stat | Valor |
|------|-------|
| Clicks | Total de `link_clicks` para este link |
| Unique | Total de `unique_visitors` |
| % | Taxa de conversão (clicks / impressões, se disponível) |

**OG Compact Card:**
- "7 tags validadas" com check verde
- Latência: "1.2s"
- Link: "Ver detalhes →" navega para `/cms/social/{id}/og` (Tela 4)

**Hashtags:**
- Lista de pills com as hashtags do post
- `text-xs text-cyan-400 bg-cyan-500/8 border border-cyan-500/15 rounded px-1.5 py-0.5`

### 10.7 Actions Bar

Barra de ações no topo, alinhada à direita. `flex gap-2`.

| Botão | Variante | Ação | Visibilidade |
|-------|----------|------|-------------|
| Editar Post | `variant="outline"` | Navega para Composer com dados pré-carregados | Sempre |
| Re-publicar | `variant="outline"` | Cria novos deliveries, re-executa pipeline etapas 3-4 (OG Scrape + Deliver) | `status = 'published'` |
| Excluir | `variant="destructive"` | Confirmação modal → soft delete | Sempre |
| Cancelar Pipeline | `variant="outline" text-amber-500` | Cancela etapas pendentes, marca post como `cancelled` | `status = 'publishing'` |

**Re-publicar:** Não duplica o post. Cria novas rows em `social_deliveries` e re-executa as etapas 3 e 4 do pipeline (OG Scrape e Deliver). Útil para corrigir falhas ou re-postar conteúdo atualizado.

**Excluir — modal de confirmação:**
- Título: "Excluir post social?"
- Mensagem: "O post será removido do CMS. Posts já publicados nas plataformas permanecerão ativos."
- Ações: "Cancelar" / "Excluir" (vermelho)

**Pipeline completion indicator:**
Quando todas as entregas concluem, exibe texto no canto inferior da actions bar:
```
Pipeline completo em 2m 38s
```
`text-xs text-emerald-400` com ícone de check.

### 10.8 Realtime

A página utiliza hooks existentes de Supabase Realtime para atualização em tempo real:

| Hook | Canal | Eventos |
|------|-------|---------|
| `useSocialDeliveries(postId)` | `social_deliveries` filtrado por `post_id` | INSERT, UPDATE — atualiza delivery cards e timeline |
| `useSocialPostStatus(postId)` | `social_posts` filtrado por `id` | UPDATE — atualiza hero, pipeline compact, post info |

Atualizações no campo `pipeline_steps` (JSONB) do `social_posts` disparam eventos Realtime automaticamente via `UPDATE` trigger do Supabase. Não é necessário canal adicional.

**Comportamento de UI durante pipeline ativo:**
- Pipeline compact: dot atual pulsa em azul
- Delivery hero: indicador de progresso animado
- Timeline: novo evento aparece com animação slide-in (200ms ease-out)
- Delivery cards: status badge transiciona de "Pendente" para "Entregue" com flash verde sutil

---

## 11. Instagram Story Generation

### 11.1 Approach

Instagram Stories requerem imagem no formato 9:16 (1080×1920px). Como a API Graph do Instagram não aceita texto puro para Stories, a solução gera imagens PNG programaticamente usando `@vercel/og` (Satori + Resvg), que renderiza componentes React para SVG e depois para PNG.

Vantagens dessa abordagem:
- Zero dependências externas (canvas, puppeteer, etc.)
- Componentes React reutilizáveis como templates
- Tipografia controlada via CSS-in-JS (suportado pelo Satori)
- Edge-compatible — pode rodar em Vercel Functions sem Node.js runtime pesado

### 11.2 Function

**Localização:** `apps/web/src/lib/social/story-generator.ts`

```typescript
type StoryTemplate = 'minimal' | 'card' | 'bold'

interface StoryData {
  title: string
  description?: string
  domain: string
  shortUrl: string        // Exibido visualmente no card (texto, não sticker interativo)
  coverImageUrl?: string  // Background (blur + dimmed)
  logoUrl?: string
}

async function generateStoryImage(
  template: StoryTemplate,
  data: StoryData
): Promise<Buffer>
```

**Retorno:** Buffer PNG de 1080×1920px, pronto para upload.

**Parâmetros opcionais:**
- `coverImageUrl`: quando presente, é usada como background com `filter: blur(20px)` e `opacity: 0.4`. Quando ausente, background sólido `#0a0a0a`.
- `logoUrl`: quando presente, renderiza logo no canto superior (80×80px). Quando ausente, omitido.

### 11.3 Templates

Cada template é um componente React renderizado via `@vercel/og` com `ImageResponse`. Todos compartilham a mesma resolução (1080×1920) e palette de cores do design system.

**Minimal:**
- Background: `#0a0a0a` (dark solid)
- Título: centralizado vertical e horizontalmente, `font-size: 48px`, `font-weight: 700`, `color: #fafafa`, max 4 linhas
- Short URL: posicionado na parte inferior (`bottom: 120px`), `font-size: 24px`, `color: #a1a1aa`, `font-family: monospace`
- Logo: canto superior esquerdo, 60×60px (se presente)

**Card:**
- Background: cover image com `filter: blur(20px) brightness(0.3)` (fallback: gradiente `#0a0a0a → #1a1a2e`)
- Card central: `background: rgba(10, 10, 10, 0.75)`, `backdrop-filter: blur(16px)`, `border: 1px solid rgba(255,255,255,0.1)`, `border-radius: 24px`, `padding: 48px`
- Dentro do card: título (`font-size: 40px`, `font-weight: 700`), domain (`font-size: 20px`, `color: #a78bfa`), short URL (`font-size: 22px`, `color: #22d3ee`, `font-family: monospace`)
- Logo: dentro do card, acima do título, 48×48px

**Bold:**
- Background: gradiente marca — `linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #06b6d4 100%)`
- Título: `font-size: 56px`, `font-weight: 800`, `color: #ffffff`, alinhado à esquerda, max 3 linhas, `padding: 80px`
- Description: `font-size: 24px`, `color: rgba(255,255,255,0.8)`, max 3 linhas
- Short URL: parte inferior, `font-size: 26px`, `color: #ffffff`, `background: rgba(0,0,0,0.3)`, `padding: 12px 24px`, `border-radius: 12px`
- Logo: canto superior direito, 72×72px

### 11.4 Upload Flow

Fluxo sequencial executado como parte da etapa "Deliver" do pipeline para Instagram:

```
1. generateStoryImage(template, data)
   └─ Gera Buffer PNG 1080×1920

2. Upload para Vercel Blob
   └─ put(`stories/${postId}-${Date.now()}.png`, buffer, {
        access: 'public',
        addRandomSuffix: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)  // TTL 24h
      })
   └─ Retorna blob URL público

3. Instagram Graph API — Create Media Container
   └─ POST /{ig_user_id}/media
      ├─ media_type: 'STORIES'
      ├─ image_url: {blob_url}
      └─ access_token: {token}
   └─ Retorna creation_id

4. Poll Container Status
   └─ GET /{creation_id}?fields=status_code
   └─ Loop até status = 'FINISHED' (max 30s, poll interval 2s)
   └─ Se 'ERROR': marca delivery como failed, salva error em pipeline_steps

5. Instagram Graph API — Publish
   └─ POST /{ig_user_id}/media_publish
      ├─ creation_id: {creation_id}
      └─ access_token: {token}
   └─ Retorna media_id publicado

6. Cleanup
   └─ Blob auto-expira após 24h (TTL configurado no passo 2)
   └─ Nenhuma ação de cleanup necessária
```

**Error handling:**
- Se passo 2 falhar (blob upload): retry 1x, depois marca delivery como `failed`
- Se passo 3 falhar (container creation): salva erro no `pipeline_steps`, marca delivery como `failed`
- Se passo 4 timeout (30s): marca delivery como `failed` com mensagem "Container processing timeout"
- Se passo 5 falhar (publish): salva `creation_id` para retry manual posterior

### 11.5 API Limitation — Link Sticker

A API Graph do Instagram **não suporta** Link Stickers interativos em Stories. Essa funcionalidade está disponível exclusivamente via app nativo do Instagram (interface de criação de Stories com sticker "Link").

**Referência:** A documentação oficial da API (`Content Publishing API > Stories`) não inclui parâmetros para stickers interativos. Endpoints disponíveis: `media_type`, `image_url`, `video_url`, `caption`.

**Mitigação adotada:**

Os templates de Story renderizam a short URL como **texto visível** no card. Isso permite que viewers digitem a URL manualmente no navegador. O campo `template_config.link_sticker` nos designs refere-se à **exibição visual** da URL no template, não a um sticker interativo do Instagram.

Impacto esperado: menor taxa de conversão comparado a Link Stickers interativos, mas mantém a URL acessível ao viewer. O short link (`go.bythiagofigueiredo.com/{code}`) é curto o suficiente para digitação rápida.

**Alternativa futura:** Se a Meta adicionar suporte a Link Stickers via API, o campo `template_config.link_sticker` na tabela `social_deliveries` já está preparado para armazenar a configuração do sticker. A migração seria adicionar o parâmetro `link` ao POST de criação de container.
## 12. Video Pipeline

### 12.1 Contexto

Videos do YouTube sao promovidos em OUTRAS plataformas (Facebook, Instagram, Bluesky) — nao no YouTube em si. O upload para o YouTube ja e tratado pelo modulo Social Hub existente. Esta secao cobre exclusivamente a distribuicao de videos do YouTube como conteudo social nas demais plataformas.

### 12.2 Facebook — Video Share

Facebook renderiza links do YouTube com player de video embutido automaticamente. Nao e necessario download nem re-upload do video.

**Implementacao:**

```typescript
// POST /{page_id}/feed
const response = await fb.api(`/${pageId}/feed`, 'POST', {
  link: 'https://youtube.com/watch?v=VIDEO_ID',
  message: caption,
  access_token: pageAccessToken,
})
```

- Facebook auto-gera preview com embed de video a partir do link
- Format = `link_share` (nao `video_share` — sem re-upload)
- Nao requer download do video nem armazenamento temporario
- OG tags do YouTube sao parseados automaticamente pelo Facebook

### 12.3 Instagram — Reel

Instagram Reels exigem upload nativo de video. Pipeline completo:

1. **Fetch video info** via YouTube Data API (`contentDetails`, `duration`)
2. **Validacao de duracao:** se > 90s → skip com delivery status `skipped`, reason `"Video excede 90s para Reels"`. Demais plataformas (FB, Bluesky) procedem normalmente — apenas o delivery de IG Reel é skipped
3. **Download do video** para storage temporario (Vercel Blob, TTL 1h) — via abordagem server-side de download do YouTube
4. **Criar container:** `POST /{ig_user_id}/media` com `media_type=REELS`, `video_url={blob_url}`, `caption`
5. **Poll container status** ate `FINISHED` (pode levar 30s–2min para processamento)
6. **Publicar:** `POST /{ig_user_id}/media_publish` com `creation_id`
7. **Cleanup:** deletar blob temporario

**Constraints do Instagram Reels:**

| Restricao | Valor |
|---|---|
| Formato | MP4 |
| Duracao maxima | 90 segundos |
| Duracao minima | 3 segundos |
| Aspect ratio recomendado | 9:16 (vertical) |

**Comportamento para videos > 90s:**

- Delivery automaticamente marcado como `skipped` com reason descritiva
- Demais plataformas (Facebook, Bluesky) procedem normalmente
- Social Tab (Tela 1) exibe warning: *"Este video excede 90s — Reel sera ignorado"* antes do publish
- Nenhuma acao do usuario necessaria — skip e automatico e silencioso

### 12.4 Bluesky — Link Card

Compartilhamento de URL do YouTube como link card com embed OG:

1. **Extrair OG tags** da pagina do YouTube (title, description, thumbnail)
2. **Upload da thumbnail** como blob no Bluesky
3. **Criar post** com embed `app.bsky.embed.external`
4. Format = `link_card`

Abordagem simples e confiavel — sem necessidade de manipulacao de video. O Bluesky nao suporta embeds de video de terceiros, entao o link card com thumbnail e a melhor opcao disponivel.

---

## 13. Bluesky Link Embed

### 13.1 AT Protocol Embed

O Bluesky utiliza `app.bsky.embed.external` para link cards. Diferente do Facebook (que busca OG tags server-side automaticamente), o Bluesky exige que o publicador forneca os metadados no momento da criacao do post. Isso significa que o client deve:

1. Buscar OG tags da URL de destino
2. Fazer download da imagem de thumbnail
3. Fazer upload da thumbnail como blob no Bluesky
4. Montar o objeto embed com titulo, descricao e referencia ao blob

### 13.2 Implementacao

Parcialmente implementado em `packages/social/src/providers/bluesky/index.ts` via `buildLinkEmbed()`.

Enhancement: reutilizar dados OG do pipeline step 3 (OG scrape) ao inves de re-fetch:

```typescript
async function buildLinkEmbed(
  agent: BskyAgent,
  url: string,
  ogData?: OgScrapeData
) {
  // 1. Usar OG data cacheado se disponivel (do pipeline step 3)
  const og = ogData ?? await fetchOgTags(url)

  // 2. Download da imagem de thumbnail
  const thumbBlob = await downloadImage(og.image)

  // 3. Upload como blob no Bluesky
  const { data: blobRef } = await agent.uploadBlob(thumbBlob, {
    encoding: 'image/jpeg',
  })

  // 4. Retornar objeto embed
  return {
    $type: 'app.bsky.embed.external',
    external: {
      uri: url,
      title: og.title || '',
      description: og.description || '',
      thumb: blobRef.blob,
    },
  }
}
```

### 13.3 Fluxo de Dados OG

O pipeline step 3 (OG scrape via Facebook Graph API) produz dados de OG tags. Esses dados sao armazenados em `pipeline_steps[2].data` e passados ao provider do Bluesky no momento da entrega, evitando fetch redundante.

**Como o ogData flui do step 3 para o step 4:**
No route handler `/api/social/pipeline/run`, após o OG scrape completar, o `scrapeResult` é guardado em memória e passado como argumento para `publishSocialPost()`. O workflow de delivery lê `scrapeResult.ogData` e repassa ao provider Bluesky via `delivery.content_override.ogData`. Isso evita re-query do `pipeline_steps` JSONB.

Fluxo:

```
/api/social/pipeline/run handler:
  1. scrapeResult = await scrapeOg(url, token)
  2. updatePipelineStep(postId, 'og_scrape', scrapeResult)
  3. post = await getSocialPost(postId)
  4. publishSocialPost(post, { ogData: scrapeResult.ogData })
       ├─ Facebook: usa link param (Facebook busca OG sozinho)
       ├─ Instagram: usa coverImageUrl para Story card (nao depende de OG)
       └─ Bluesky: buildLinkEmbed(agent, url, ogData) ← reutiliza dados
```

---

## 14. Realtime & Monitoring

### 14.1 Infraestrutura Existente

Ja operacional no projeto:

- `useSocialDeliveries(postId)` — subscribe a INSERT/UPDATE/DELETE em `social_deliveries`
- `useSocialPostStatus(postId)` — subscribe a UPDATE em `social_posts`
- Supabase Realtime habilitado para ambas as tabelas

Nenhuma nova infraestrutura de realtime necessaria.

### 14.2 Pipeline Live Tracking

Quando o pipeline executa, cada step atualiza o campo `pipeline_steps` (JSONB) em `social_posts`. Isso dispara o evento realtime via `useSocialPostStatus()`. A pagina Post Detail (Tela 6) consome esses eventos para:

- **Animar dots do pipeline** (cinza → azul → verde conforme steps completam)
- **Adicionar eventos na timeline** em tempo real
- **Atualizar contadores do delivery hero card** (ex: "2/3 Entregues" → "3/3 Entregues")
- **Mostrar duracao de conclusao** apos pipeline finalizar

Sequencia de updates esperada durante pipeline:

```
1. social_posts.pipeline_steps[0] → status: "running"    (Short Link)
2. social_posts.pipeline_steps[0] → status: "completed"
3. social_posts.pipeline_steps[1] → status: "running"    (OG Scrape)
4. social_posts.pipeline_steps[1] → status: "completed"
5. social_posts.pipeline_steps[2] → status: "running"    (Deliver)
6. social_deliveries INSERT (Facebook)
7. social_deliveries INSERT (Instagram)
8. social_deliveries INSERT (Bluesky)
9. social_posts.pipeline_steps[2] → status: "completed"
10. social_posts.status → "completed" / "partial_failure" / "failed"
```

### 14.3 Nenhuma Infraestrutura Adicional Necessaria

O subscription existente do Supabase Realtime cobre todas as necessidades de tracking do pipeline. Nao sao necessarios novos canais WebSocket, novos hooks de subscription ou infraestrutura de polling. O update JSONB em `social_posts` e suficiente para triggerar refreshes na UI.

O unico ajuste necessario e garantir que os updates de `pipeline_steps` sejam granulares (um UPDATE por step, nao batch) para que a UI anime cada step individualmente.

---

## 15. Content-Format Mapping

### 15.1 Tabela de Mapeamento

| Tipo de Conteudo | Facebook | Instagram | Bluesky |
|---|---|---|---|
| Blog Post | Link Share | Story (template Card + URL visual) | Link Card (OG embed) |
| Newsletter | Link Share | Story (template Minimal + URL visual) | Link Card (OG embed) |
| Campaign | Image Post | Story (template Bold + URL visual) | Link Card (OG embed) |
| Video (YouTube) | Link Share (YouTube embed) | Reel (se <=90s, senao `skipped`) | Link Card (OG embed) |

### 15.2 Detalhes por Formato

**Facebook Link Share**
POST no feed da pagina com parametro `link`. Facebook auto-gera preview card com OG tags. Melhor para conteudo de blog, newsletter e video. Nao requer upload de midia.

**Facebook Image Post**
POST no feed da pagina com `url` (URL da imagem de capa da campanha) + `message`. Para conteudo visual-heavy de campanhas. Imagem e buscada diretamente da URL — sem upload local.

**Instagram Story**
Imagem gerada (1080x1920) via `@vercel/og`. Tres templates disponiveis:

| Template | Uso principal | Estilo |
|---|---|---|
| Minimal | Newsletter | Limpo, foco no subject line, cores neutras |
| Card | Blog Post | Equilibrado, mostra titulo + dominio + URL |
| Bold | Campaign | Chamativo, gradiente de fundo, fonte grande |

Short URL renderizada visualmente na imagem. Postada via Instagram Graph API com `media_type=STORIES`.

**Instagram Reel**
Upload nativo de video. Somente para conteudo de video YouTube com duracao <=90s. Postado via Instagram Graph API com `media_type=REELS`. Videos acima de 90s sao automaticamente ignorados.

**Bluesky Link Card**
Post com `app.bsky.embed.external`. Requer upload de thumbnail como blob + titulo + descricao. Funciona para todos os tipos de conteudo de forma uniforme.

### 15.3 Selecao de Template Padrao

Cada tipo de conteudo tem um template padrao para IG Story:

- **Blog** → Card (equilibrado, mostra titulo + dominio + URL)
- **Newsletter** → Minimal (limpo, foco no subject line)
- **Campaign** → Bold (chamativo, gradiente de fundo)

O usuario pode sobrescrever o template padrao no Social Tab (Tela 1) via campo `ig_template` em `social_config`:

```typescript
// social_config JSONB em blog_posts / newsletter_editions / campaigns
{
  enabled: true,
  platforms: ['facebook', 'instagram', 'bluesky'],
  ig_template: 'bold',  // Override: usa Bold ao inves do padrao Card
  captions: {
    facebook: 'Texto customizado para Facebook...',
    instagram: null,     // Usa caption padrao
    bluesky: null,       // Usa caption padrao
  },
  schedule_mode: 'queue',
}
```

---

## 16. Error Handling & Edge Cases

### 16.1 Erros de Pipeline

| Cenario | Comportamento |
|---|---|
| OG scrape timeout (>10s) | Log warning, continua para delivery. Facebook pode ter OG cacheado. `pipeline_steps` registra `status="warning"` |
| OG scrape HTTP error | Log warning, continua para delivery. Erro registrado em `pipeline_steps[].data` |
| OAuth token expirado durante pipeline | Provider chama `refreshToken()` no 401. Se refresh falha → delivery `status="failed"`, `error_type="auth"` |
| Rate limited pela plataforma (429) | Retry com exponential backoff (5s, 30s, 120s). `error_type="transient"` |
| Conteudo deletado entre steps do pipeline | Cada step busca dados frescos do post. Se post nao encontrado → abort graceful do pipeline |
| Colisao de codigo de short link | `generateShortCode()` retenta ate 40 vezes com comprimento expandido (6→8 chars) |
| Social post duplicado para mesmo conteudo | Unique partial index previne. Retorna post existente se draft/scheduled, cria novo se completed |
| Todas as deliveries falham | Post status = `"failed"`. Usuario pode retentar via "Re-publicar" no Post Detail |
| Algumas deliveries falham | Post status = `"partial_failure"`. Deliveries com falha mostram botao de retry individual |
| Video >90s para IG Reel | Delivery auto-skipped com reason. Demais plataformas procedem normalmente |

### 16.2 Erros de Social Config

| Cenario | Comportamento |
|---|---|
| `social_config.enabled` mas sem connections | Skip criacao de social post silenciosamente. Log info. |
| Plataforma no config mas connection revogada | Skip delivery daquela plataforma. Demais plataformas procedem. |
| Conteudo despublicado apos social post criado | Social post permanece (historico). Sem cascade delete. Usuario pode deletar manualmente via Post Detail. |

### 16.3 Edge Cases do Queue Mode

| Cenario | Comportamento |
|---|---|
| Todos os slots cheios por 7 dias | Agenda no primeiro slot disponivel da semana 2. Mostra warning na UI. |
| Dois posts enfileirados simultaneamente (race) | Possivel colisao de slot. Aceitavel para CMS single-user. Segundo post recebe proximo slot via deteccao de conflito. |
| Slot da fila no passado (clock skew) | Snap para proximo slot futuro |

---

## 17. File Structure

### 17.1 Arquivos Novos

```
apps/web/src/
  lib/social/
    create-from-content.ts              # Funcao core — createSocialPostFromContent()
    content-metadata.ts                 # Extracao de metadata de conteudo CMS por tipo
    og-scraper.ts                       # Facebook Graph API OG scrape + parsing
    pipeline.ts                         # Helpers de tracking de pipeline steps (update, read, calcular duracao)
    story-generator.ts                  # Geracao de imagem IG Story via @vercel/og
    queue.ts                            # Calculo de slot de fila (getNextQueueSlot)

  app/
    api/social/pipeline/run/route.ts    # Pipeline runner async (OG scrape → deliver)

    cms/(authed)/
      _shared/social/
        social-tab.tsx                  # Componente Social Tab compartilhado para editores de conteudo
        og-compact.tsx                  # Display compacto de OG tags em 3 colunas

      social/
        new/_components/
          content-picker.tsx            # Busca + selecao de conteudo CMS
          caption-tabs.tsx              # Editor de caption por plataforma com contagem de chars
          schedule-bar.tsx              # Seletor de modo de agendamento (Agora/Agendar/Fila)

        [id]/
          og/page.tsx                   # Pagina OG Validation & Debugger (Tela 4)
          _components/
            delivery-hero.tsx           # Hero card "3/3 Entregues"
            pipeline-compact.tsx        # 4 dots de status do pipeline
            timeline.tsx                # Timeline cronologica de eventos
            source-card.tsx             # Card de referencia ao conteudo CMS
            short-link-card.tsx         # Short link + stats de cliques + URL chain
            og-validation.tsx           # Hero de validacao OG + checklist
            url-chain.tsx               # Chain visual de resolucao de URL
            scrape-details.tsx          # Card de metadata da resposta da API
            raw-response.tsx            # Viewer JSON togglable

      links/_components/
        social-summary-bar.tsx          # Resumo de breakdown por plataforma
        source-breakdown.tsx            # Grafico de tipo de source

supabase/migrations/
  YYYYMMDD_social_posts_redesign.sql    # Todas as mudancas de schema
```

### 17.2 Arquivos Modificados

```
apps/web/src/
  lib/social/
    actions.ts                          # Novas actions: export createSocialPostFromContent, scrapeOgTags
    workflows.ts                        # publishSocialPost aprimorado com integracao do step OG

  app/cms/(authed)/
    social/
      new/_components/
        composer-shell.tsx              # Redesenhado com content picker + caption tabs
      [id]/page.tsx                     # Rebuild do post detail (Tela 6)
      _components/
        post-detail.tsx                 # Redesenhado com delivery hero, timeline, etc.

    blog/[id]/edit/
      actions.ts                        # Thin social hook em publishPost()
      _components/                      # Adicionar social-tab nas tabs do editor

    newsletters/
      actions.ts                        # Thin social hook em sendNow() + scheduleEdition()

    campaigns/[id]/edit/
      actions.ts                        # Thin social hook em publishCampaign()

    links/
      page.tsx                          # Aprimorado com social summary, KPI, filtros
```

### 17.3 Conteudo do Arquivo de Migration

```sql
-- Social Posts Redesign — Schema Changes
-- Adicionar tracking de conteudo CMS ao social_posts
ALTER TABLE social_posts
  ADD COLUMN source_content_type TEXT
    CHECK (source_content_type IN ('blog','newsletter','campaign','video'));

ALTER TABLE social_posts
  ADD COLUMN source_content_id UUID;

ALTER TABLE social_posts
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual'
    CHECK (origin IN ('manual','auto','publish_modal'));

ALTER TABLE social_posts
  ADD COLUMN short_link_id UUID REFERENCES tracked_links(id);

ALTER TABLE social_posts
  ADD COLUMN pipeline_steps JSONB DEFAULT '[]';

-- Adicionar tracking de formato ao social_deliveries
ALTER TABLE social_deliveries
  ADD COLUMN format TEXT
    CHECK (format IN ('link_share','image_post','story','reel','link_card','video_share'));

ALTER TABLE social_deliveries
  ADD COLUMN template_config JSONB;

-- Adicionar social config as tabelas de conteudo
ALTER TABLE blog_posts ADD COLUMN social_config JSONB;
ALTER TABLE newsletter_editions ADD COLUMN social_config JSONB;
ALTER TABLE campaigns ADD COLUMN social_config JSONB;

-- Indexes
CREATE INDEX idx_social_posts_source
  ON social_posts(source_content_type, source_content_id)
  WHERE source_content_id IS NOT NULL;

CREATE INDEX idx_social_posts_short_link
  ON social_posts(short_link_id)
  WHERE short_link_id IS NOT NULL;

-- Partial unique index: apenas 1 social post ativo por conteudo
CREATE UNIQUE INDEX idx_social_posts_active_per_content
  ON social_posts(source_content_type, source_content_id)
  WHERE status IN ('draft','scheduled','publishing')
    AND source_content_id IS NOT NULL;
```

---

## 18. Known Limitations & Estimation

### 18.1 Limitacoes Conhecidas

| Limitacao | Impacto | Mitigacao |
|---|---|---|
| IG Story link stickers nao disponiveis via API | Viewers nao conseguem tocar para visitar URL | Short URL renderizada visualmente no story card; viewers digitam manualmente |
| IG Reels limitado a <=90s | Videos mais longos do YouTube nao podem virar Reels | Auto-skip com warning. Usuario pode compartilhar como Story manualmente (escolha manual) |
| Cache de OG do Facebook agressivo | Primeiro share pode mostrar dados OG desatualizados | Step automatizado de scrape forca re-crawl do Facebook antes de postar |
| Google OAuth Testing mode = refresh tokens de 7 dias | Necessidade de refresh semanal de token | Auto-refresh no 401. Se refresh falha, connection mostra warning na pagina Accounts |
| Long-lived tokens da Meta expiram em 60 dias | Re-autenticacao periodica necessaria | Expiracao de token rastreada em `social_connections.token_expires_at`. Warning na UI 7 dias antes da expiracao |
| Bluesky nao tem analytics API oficial | Impossivel rastrear engajamento em posts do BS | Rastrear cliques via short link apenas. Tracking de engajamento adiado para sprint futuro |
| Colisao de slot de fila (race condition) | Dois requests simultaneos de fila podem mirar no mesmo slot | Aceitavel para CMS single-user. Segundo post recebe proximo slot disponivel |

### 18.2 Estimativa de Esforco

| Secao | Esforco |
|---|---|
| Data model (migration + types) | 3h |
| Core function + extracao de metadata de conteudo | 5h |
| Orquestracao de pipeline (API route + cron enhancement) | 6h |
| OG scraper | 3h |
| Social Tab (componente compartilhado) | 6h |
| Publish hooks (blog + newsletter + campaign + bulk) | 3h |
| Kanban Modal enhancement | 4h |
| Composer redesign (content picker + caption tabs + schedule bar) | 8h |
| OG Validation page | 5h |
| Links Engine enhancement (dashboard + table + filtros) | 5h |
| Post Detail rebuild (hero + timeline + pipeline + delivery cards) | 6h |
| Instagram Story generation | 4h |
| Video pipeline (IG Reel download/upload) | 6h — pode ser Phase 2 |
| Bluesky link embed enhancement | 2h |
| Queue slot system | 2h |
| Tests | 8h |
| **Total** | **~58h** (sem video pipeline: ~52h) |

### 18.3 Recomendacao de Fases

**Phase 1 (~52h):** Tudo exceto IG Reel para videos. Videos compartilham no Facebook (link share com YouTube embed) + Bluesky (link card) apenas. Delivery do Instagram para videos = `skipped` com reason descritiva.

**Phase 2 (~6h):** Adicionar pipeline de IG Reel com download de video do YouTube + re-upload. Inclui storage temporario via Vercel Blob, validacao de duracao e cleanup automatico.

### 18.4 Referencia de Telas

Todas as 6 telas aprovadas durante brainstorming:

| Tela | Proposito | Score | Arquivo |
|---|---|---|---|
| 1 | Social Tab no Pipeline Editor | Aprovada | `02-social-tab-v8.html` |
| 2 | Kanban Scheduling Modal | Aprovada | `05-kanban-modal-v3.html` |
| 3 | Social Hub Composer | 98/100 | `07-composer-v2.html` |
| 4 | OG Validation & Debugger | 98/100 | `09-og-validation-v2.html` |
| 5 | Links Engine Dashboard | 98/100 | `11-links-engine-v2.html` |
| 6 | Post Detail | 98/100 | `13-post-detail-v2.html` |

Arquivos visuais companion em: `.superpowers/brainstorm/46821-1778760042/content/`
