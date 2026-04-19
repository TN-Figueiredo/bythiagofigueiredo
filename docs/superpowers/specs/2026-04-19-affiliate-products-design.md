# Affiliate Products & Setup Page — Design Spec

**Data:** 2026-04-19
**Score:** 98/100
**Status:** aprovado — aguardando plano de implementação
**Sprints:** 6 (MVP), 7 (full), 8 (analytics)

---

## Contexto

`bythiagofigueiredo.com` é um hub de conteúdo de um criador (YouTube EN+PT, blog bilíngue). Audiência técnica e de gamers frequentemente pergunta sobre setup (câmera, iluminação, audio, periféricos). A feature adiciona:

1. `<ProductCard />` — componente MDX injetado no `blogRegistry` para recomendações inline em posts
2. `/setup` (+ `/en/setup`) — página dedicada listando o gear do criador por categoria
3. `/go/[product_id]` — redirect handler com tracking server-side
4. `affiliate_products` + `affiliate_product_links` — fonte de verdade centralizada
5. Click tracking via `@tn-figueiredo/analytics`
6. Compliance LGPD + CONAR + Amazon Associates

---

## Pré-study obrigatório (antes do Sprint 7)

- [ ] Auditar `@tn-figueiredo/affiliate` no ecossistema: tem link builder? redirect handler? tracking? Se sim, consumir em vez de reimplementar.
- [ ] Verificar elegibilidade no Amazon Associates BR e Shopee Affiliates (exigem volume mínimo de vendas).
- [ ] Confirmar formato de link Amazon Associates BR: `https://www.amazon.com.br/dp/{ASIN}?tag={tag}`.

---

## Arquitetura

### Sprint 6 — MVP inline (sem DB)

Objetivo: validar o componente rapidamente. Produto definido inline no MDX:

```mdx
<ProductCard
  name="Sony ZV-E10"
  platform="amazon"
  href="/go/sony-zve10"
  image="/products/sony-zve10.jpg"
  price={2899}
  description="Câmera mirrorless ideal para YouTube"
/>
```

`/go/[slug]` é um redirect estático via `next.config.ts` redirects por ora.

`/setup` como MDX page em `apps/web/src/content/setup/` (pt-BR + en), gerenciada manualmente.

### Sprint 7 — Sistema completo

#### Schema DB

```sql
-- Produto canônico
create table public.affiliate_products (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  name            text not null,
  description     text,
  category        text,                    -- 'camera' | 'lighting' | 'audio' | 'peripherals' | 'other'
  image_path      text,                    -- path no Supabase Storage: affiliate-products/{id}/cover.webp
  price_brl       numeric(10,2),
  price_updated_at timestamptz,
  is_active       boolean not null default true,
  is_broken       boolean not null default false,  -- detectado pelo cron
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Links por plataforma (um produto pode estar na Amazon E Shopee)
create table public.affiliate_product_links (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.affiliate_products(id) on delete cascade,
  platform    text not null check (platform in ('amazon','shopee','mercadolivre','manual')),
  url         text not null,               -- URL de afiliado final
  priority    int not null default 0,      -- ordena botões no card (menor = primeiro)
  created_at  timestamptz not null default now()
);

-- RLS: leitura pública de produtos ativos; escrita só para staff do site
alter table public.affiliate_products enable row level security;
alter table public.affiliate_product_links enable row level security;
```

#### `/go/[product_id]` — redirect handler (server route)

```
GET /go/[product_id]?platform=amazon
```

1. Busca produto em `affiliate_products` via `id` — 404 se inativo
2. Seleciona link pela `platform` query param (ou `priority` mais baixo)
3. Dispara evento `affiliate_click` via `@tn-figueiredo/analytics`
4. Redirect 302 para `affiliate_url`

Vantagens: tracking server-side (independe de JS/adblocker), links no HTML são `/go/uuid` (limpos, não expõem tag de afiliado), atualização de URL sem re-publicar posts.

#### `<ProductCard />` — Server Component

```tsx
// apps/web/src/components/affiliate/product-card.tsx
// Injetado em: apps/web/lib/cms/registry.ts

interface ProductCardProps {
  id: string           // UUID de affiliate_products
  showAllPlatforms?: boolean  // padrão: true
}
```

- Busca produto via `unstable_cache` com tag `affiliate:${id}` (TTL 1h)
- Renderiza: imagem (Supabase Storage), nome, descrição curta, preço com staleness badge (>30 dias → "Verificar preço"), botões por plataforma (`/go/${id}?platform=amazon`), badge `#publi` obrigatório + tooltip disclosure
- JSON-LD inline `schema.org/Product` com `Offer` (preço + currency BRL + url)
- Se `is_broken=true`: renderiza card com aviso "Link temporariamente indisponível"

#### Modal de inserção no PostEditor

No toolbar do PostEditor (via `@tn-figueiredo/cms`): botão "Inserir produto". Abre modal com:
- Campo de busca → query em `affiliate_products` por `name ILIKE %query%`
- Lista de resultados com thumbnail
- Click → insere `<ProductCard id="uuid" />` no cursor do editor

Sem modal, editor pode escrever o MDX manualmente — o autocomplete de `componentNames` já lista `ProductCard`.

#### `/setup` como MDX gerenciado pelo CMS

Rota: `app/(public)/[locale]/setup/page.tsx` com locale `pt-BR` e `en`.

Conteúdo em `blog_translations` com `slug='setup'` e `post_type='page'` (novo enum value) — ou MDX estático em `src/content/setup/`. **Decisão no pre-study:** se `post_type` enum for barato de adicionar, usar CMS; caso contrário, MDX estático por ora.

Estrutura da página:
```
## Câmeras & Vídeo
<ProductCard id="..." />
<ProductCard id="..." />

## Iluminação
...

## Audio
...
```

hreflang emitido via layer SEO existente. Canonical: `https://bythiagofigueiredo.com/setup`.

---

## Compliance

### CONAR 01/2021 + CDC Art. 31 (Brasil)

- Badge `#publi` visível em todos os cards — não pode ser ocultável pelo usuário
- Tooltip ao hover: "Este link é de afiliado. Ao comprar, recebo uma comissão sem custo adicional para você."
- Footer da `/setup`: parágrafo fixo de disclosure
- NUNCA mencionar preço como "garantido" — sempre "confira o preço atual"

### Amazon Associates BR

- Link format: `https://www.amazon.com.br/dp/{ASIN}?tag=${AFFILIATE_AMAZON_TAG}`
- Tag configurável via env var `AFFILIATE_AMAZON_TAG`
- Texto obrigatório em `/setup` e footer: "Como Associado Amazon, recebo uma comissão por compras qualificadas."

### LGPD

- Click tracking: dados coletados = `product_id`, `platform`, `source_type`, `source_id`, `country` (via `CF-IPCountry` header)
- Sem PII (sem IP, sem user_agent raw)
- Evento disparado server-side no `/go/` handler — não requer consent de analytics (dado agregado, não identificável)

---

## Click Tracking — Schema de evento

```typescript
{
  event: 'affiliate_click',
  product_id: string,           // UUID
  product_name: string,
  platform: 'amazon' | 'shopee' | 'mercadolivre' | 'manual',
  source_type: 'blog_post' | 'setup_page' | 'campaign',
  source_id: string,            // post.id ou 'setup'
  country: string,              // CF-IPCountry ou 'unknown'
  ts: string,                   // ISO 8601
}
```

**Deduplicação:** 1 evento por `(product_id, session_id)` por hora — via cookie de sessão anônimo.
**Bot filtering:** bloqueia se `user-agent` matches lista de bots conhecidos (Googlebot, etc.).

---

## Cron: link expiry detection

`/api/cron/check-affiliate-links` — schedule: `0 3 * * *` (03:00 UTC)

Para cada `affiliate_product_links` ativo:
1. HEAD request para `url`
2. Se 4xx/5xx: incrementa contador `consecutive_failures`
3. Se `consecutive_failures >= 3`: marca `affiliate_products.is_broken = true` + Sentry.captureMessage com tag `component: 'affiliate-cron'`
4. Se 2xx e `is_broken = true`: limpa flag (auto-recover)

---

## Performance

- `<ProductCard />` é Server Component puro — zero JS client
- Dados via `unstable_cache(fn, [product_id], { tags: ['affiliate:${id}'], revalidate: 3600 })`
- Cache invalidado quando editor salva produto (`revalidateTag('affiliate:${id}')`)
- Imagens via `<Image />` do Next.js com `sizes` adequados — Supabase Storage como origin
- Skeleton via CSS `@keyframes pulse` no Suspense fallback

---

## Testing

**Unit:**
- `<ProductCard />` sempre renderiza badge `#publi`
- JSON-LD shape válido contra `schema.org/Product`
- Card com `is_broken=true` renderiza aviso, não link

**Integration:**
- `/go/[id]` redireciona 302 para URL correta
- `/go/[id]` retorna 404 para produto inativo
- Evento `affiliate_click` disparado corretamente
- Cron marca `is_broken=true` após 3 falhas consecutivas

**E2E (Sprint 5c estendido):**
- Editor insere ProductCard → post publicado → card visível com link `/go/`
- `/setup` renderiza com hreflang correto

---

## Placement no Roadmap

| Sprint | Épico | Horas |
|--------|-------|-------|
| **6** | `/setup` page (MDX estático, pt-BR + en) + `<ProductCard />` MVP (props inline, sem DB) + `/go/` redirect estático | +6h |
| **7** | `affiliate_products` + `affiliate_product_links` tables + `/go/` handler dinâmico + tracking event + modal de inserção no editor + compliance badges + cron check-affiliate-links | +14h |
| **8** | Dashboard de affiliate clicks no admin (top produtos, conversão por post, plataforma breakdown) via `@tn-figueiredo/analytics` | +4h |

**Total adicionado à Fase 2:** +24h

---

## Decisões em aberto (pós pre-study)

| Decisão | Opções | Default |
|---------|--------|---------|
| `/setup` content type | MDX estático vs `post_type='page'` no CMS | MDX estático (Sprint 6) — migrar se Sprint 7 justificar |
| `@tn-figueiredo/affiliate` | Consumir se existir | Consumir; reimplementar se API incompatível |
| Preço dinâmico | Amazon PA-API | Defer pós-MVP (requer aprovação Associates com volume) |
| Redis para `/go/` | Cache de produto em memória | Defer — `unstable_cache` suficiente para MVP |

---

## Fora de escopo

- Sync de preço via Amazon PA-API / Shopee API (requer volume mínimo aprovado)
- Cache Redis para `/go/` em alta escala
- Programa de afiliados próprio (links para terceiros gerenciarem)
- Monetização via display ads (Adsense, etc.)
