# Ad Engine 1.0 --- Full Platform Overhaul

**Date:** 2026-04-26
**Score:** 100/100
**Status:** Approved
**Estimated effort:** 60--70h
**Packages:** ad-engine@1.0.0, ad-engine-admin@1.0.0, ad-components@0.1.0, admin@0.7.0, shared@0.9.0

---

## Overview

The current ad engine scores 32/100 in the quality audit. The kill switch logic is inverted (ads show when they should be hidden), there is zero impression or click tracking, no waterfall resolution, no category targeting, no network adapter abstraction, and no Google Ads integration. Campaign CRUD lacks validation, media upload stubs throw "Not implemented", and the admin dashboard silently swallows errors. The system is unusable for monetization in its present state.

Ad Engine 1.0 replaces the entire stack with a production-grade ad platform designed for reuse across the `@tn-figueiredo` ecosystem. The core is a 3-layer waterfall resolution engine: house campaigns resolve first by priority and pacing budget, then network adapters (AdSense day-1, Prebid.js-ready via `IAdNetworkAdapter`), then a branded template fallback guaranteeing every slot always renders something. Five standard slots cover all page zones: `banner_top` (Leaderboard 728x90), `rail_left` (Wide Skyscraper 160x600), `inline_mid` (Medium Rectangle 300x250), `rail_right` (Medium Rectangle 300x250), and `block_bottom` (Billboard 970x250).

Category targeting maps blog post categories to campaign audience segments, enabling advertisers to reach readers by topic. Google AdSense integration stores the publisher ID at the organization level and ad unit IDs per slot per site, with an OAuth2 flow for the AdSense Management API that imports revenue data daily into `ad_revenue_daily`. A/B testing is built in via variant groups that split traffic deterministically. A pacing algorithm distributes impressions evenly across campaign flight dates to prevent front-loading.

All ad rendering is CLS-zero: server-rendered skeleton placeholders reserve exact slot dimensions before client hydration. The theme system uses CSS custom properties in `ad-components`, making visual integration a single token file per project. Tracking fires via `IntersectionObserver` (impressions) and Beacon API (clicks), gated by LGPD analytics consent. Every ad request respects the cookie banner state --- no tracking code loads without explicit user opt-in.

---

## Table of Contents

1. [Package Architecture & Upgrade Map](#1-package-architecture--upgrade-map)
2. [Waterfall Resolution Engine](#2-waterfall-resolution-engine)
3. [LGPD Consent Integration](#3-lgpd-consent-integration)
4. [Database Schema](#4-database-schema)
5. [Tracking Architecture](#5-tracking-architecture)
6. [Theme System (ad-components)](#6-theme-system-ad-components)
7. [Category Targeting](#7-category-targeting)
8. [CLS-Zero & Performance](#8-cls-zero--performance)
9. [Migration Path (0.x to 1.0)](#9-migration-path-0x--10)
10. [Preview System (Admin)](#10-preview-system-admin)
11. [AdSense Revenue Import](#11-adsense-revenue-import)
12. [Multi-Network Adapter (Header Bidding Ready)](#12-multi-network-adapter-header-bidding-ready)

---

## Section 1: Package Architecture & Upgrade Map

### 1.1 Packages afetados

5 packages mudam nesta release. Semver major em `ad-engine` e `ad-engine-admin` reflete breaking changes nas interfaces exportadas.

| Package | Atual | Nova | Escopo |
|---------|-------|------|--------|
| `@tn-figueiredo/ad-engine` | 0.3.0 | **1.0.0** | Core: waterfall resolver, tracking SDK, `IAdNetworkAdapter` interface, category targeting, pacing algorithm, A/B variant assignment (murmurhash `user_id % 100`). Zero deps, pure TypeScript. Contract: `app_id = site.slug` (string, nao UUID). |
| `@tn-figueiredo/ad-engine-admin` | 0.4.3 | **1.0.0** | Admin UI: campaign wizard com preview por slot, slot config com toggles (house/cpa/google/template), AdSense settings UI (pub ID, ad unit IDs por slot), dashboard com metricas reais (house+google combinados), metas contratuais (impressions/clicks target + progress bar), category targeting picker, validacao de aspect ratio por slot. RSC-first. Peers: `ad-engine`, `ad-components`, `supabase-js`. |
| `@tn-figueiredo/ad-components` | NEW | **0.1.0** | Client React 19 components: 5 variantes de ad (Banner, Rail, Inline, Anchor, Block). Hook `useAdSlot()` com tracking automatico via IntersectionObserver. Hook `useAdConsent()` le consent de marketing do consumer. Componente `GoogleAdUnit` renderiza `<ins>` com skeleton. Theme via CSS variables (`--ad-*`). Fallback chain built-in. Ad blocker detection + timeout (3s) para template fallback. CLS-zero: skeleton com dimensoes IAB reservadas. |
| `@tn-figueiredo/admin` | 0.6.2 | **0.7.0** | Settings page shell com tabs (General, Ads, SEO). Ganha: formulario de AdSense settings. |
| `@tn-figueiredo/shared` | 0.8.0 | **0.9.0** | Slot definitions com aspect ratios, IAB sizes, zone metadata, category enum type. |

### 1.2 Dependency graph

```
ad-components@0.1.0
  └── peer: ad-engine@1.0.0 (types only)

ad-engine-admin@1.0.0
  ├── peer: ad-engine@1.0.0
  ├── peer: ad-components@0.1.0 (preview rendering)
  └── peer: @supabase/supabase-js

ad-engine@1.0.0
  └── (zero deps — pure TS core)

admin@0.7.0
  └── peer: ad-engine@1.0.0 (slot config types)

shared@0.9.0
  └── (zero deps — types + constants)
```

### 1.3 Responsabilidades

| Package | Responsavel por | NAO responsavel por |
|---------|----------------|---------------------|
| `ad-engine` | Waterfall resolution puro (targeting, pacing, schedule filtering), interfaces (`IAdNetworkAdapter`, `IAdTracker`), event tracking SDK, A/B variant assignment. | React, Supabase, rendering, DOM. |
| `ad-engine-admin` | RSC components para admin UI (campaign CRUD, wizard, dashboard, slot config, AdSense settings). Queries Supabase. | Rendering de ads no site publico. |
| `ad-components` | Client React components para renderizar ads no site publico. Theme system via CSS variables. `useAdSlot()` com impression/click tracking automatico. `GoogleAdUnit` com skeleton + timeout. | Admin UI, Supabase queries, resolution logic (consome resultado do resolver). |
| `admin` | Layout geral e settings pages. Formulario de configuracao de ad (publisher ID, toggles globais). | Campaign CRUD (delegado a `ad-engine-admin`). |
| `shared` | Typed slot definitions (`AdSlotDefinition` com `aspectRatio`, `iabSize`, `zone`), category enum, IAB size constants. | Logica de negocio. |

### 1.4 Breaking changes (0.x -> 1.0.0)

**ad-engine@1.0.0:**

- `AdSlotDefinition` ganha campos required: `zone`, `aspectRatio`, `iabSize`. Antes eram optional (`@ts-expect-error` no consumer). Remove os 6 `@ts-expect-error` no `packages/shared/src/config/ad-slots.ts`.
- `resolveSlot()` retorna `AdResolution` (novo tipo) em vez de `AdSlotCreative | null`. Inclui `source: 'house' | 'cpa' | 'network' | 'template' | 'empty'`.
- Nova interface `IAdNetworkAdapter` para adapters de ad network (Google, futuro: Amazon, etc).
- `AdTracker` SDK ganha `trackNetworkImpression()` e `trackNetworkClick()` alem dos existentes.
- `pacingAllows(campaign, now)` exportado como pure function (antes era internal).
- `assignVariant(userId, variantGroup)` usa murmurhash deterministic em vez de `Math.random()`.

**ad-engine-admin@1.0.0:**

- `AdAdminConfig` ganha `networkAdapters` (obrigatorio). Antes so tinha `slots` e `locales`.
- `CampaignFormModal` vira `CampaignWizard` (3 steps em vez de 2). Step 3: targeting + pacing.
- Dashboard recebe `networkRevenue` prop para metricas combinadas.
- `SlotConfigPanel` (novo) substitui toggles avulsos no `PlaceholderManager`.
- `fetchAdConfigs` query retorna `ad_slot_config` rows em vez de `ad_placeholders` (tabela nova).

### 1.5 Migration path para consumers

```
1. Bump shared@0.9.0 → remove @ts-expect-error em ad-slots.ts, add aspectRatio + iabSize
2. Bump ad-engine@1.0.0 → update resolveSlot() call sites, add IAdNetworkAdapter impl
3. Install ad-components@0.1.0 → replace hardcoded ad components with <AdSlot /> wrappers
4. Bump ad-engine-admin@1.0.0 → update admin wiring (config, actions, slot config page)
5. Bump admin@0.7.0 → wire AdSense settings form
6. Run DB migration → ad_slot_config + ad_revenue_daily + ad_campaigns columns
```

---

## Section 2: Waterfall Resolution Engine

### 2.1 Modelo de resolucao

O waterfall e per-slot, resolvido server-side (RSC, cached 5min via `unstable_cache`). Cada slot produz exatamente um resultado: um criativo house/CPA, um ad de network, um template placeholder, ou vazio.

```typescript
interface AdResolution {
  source: 'house' | 'cpa' | 'network' | 'template' | 'empty'
  creative?: AdSlotCreative       // house/cpa: dados completos
  networkAdapter?: string         // network: adapter ID (e.g. 'adsense')
  networkConfig?: Record<string, unknown>  // network: config pra client render
  placeholder?: AdPlaceholder     // template: conteudo editavel
  slot: AdSlotDefinition
  variantId?: string              // A/B: ID do variante selecionado
  cached: boolean                 // true se veio do cache
}
```

### 2.2 Algoritmo do waterfall

```typescript
function resolveSlot(
  slot: AdSlotConfig,
  context: AdResolutionContext,
): AdResolution {
  // 1. Kill switch check
  if (slot.killed || context.masterKilled) {
    return { source: 'empty', slot: slot.definition, cached: false }
  }

  // 2. House campaign (prioridade maxima entre house)
  if (slot.houseEnabled) {
    const candidates = getActiveCampaigns(slot.key, context.appId)
      .filter(c => c.type === 'house')
      .filter(c => matchesCategory(c.targetCategories, context.postCategory))
      .filter(c => withinSchedule(c, context.now))
      .filter(c => withinBudget(c))
      .filter(c => pacingAllows(c, context.now))

    if (candidates.length > 0) {
      const winner = selectWinner(candidates, context.userId)
      return { source: 'house', creative: winner.creative, slot: slot.definition,
               variantId: winner.variantId, cached: false }
    }
  }

  // 3. CPA campaign (mesma logica, tipo diferente)
  if (slot.cpaEnabled) {
    const candidates = getActiveCampaigns(slot.key, context.appId)
      .filter(c => c.type === 'cpa')
      .filter(c => matchesCategory(c.targetCategories, context.postCategory))
      .filter(c => withinSchedule(c, context.now))
      .filter(c => withinBudget(c))
      .filter(c => pacingAllows(c, context.now))

    if (candidates.length > 0) {
      const winner = selectWinner(candidates, context.userId)
      return { source: 'cpa', creative: winner.creative, slot: slot.definition,
               variantId: winner.variantId, cached: false }
    }
  }

  // 4. Network adapters (client-side, consent-gated, ordenados)
  if (slot.googleEnabled || slot.networkAdaptersOrder.length > 0) {
    for (const adapterId of slot.networkAdaptersOrder) {
      const adapter = context.networkAdapters[adapterId]
      if (!adapter?.enabled) continue
      if (adapter.requiresConsent && !context.marketingConsent) continue

      return {
        source: 'network',
        networkAdapter: adapterId,
        networkConfig: adapter.configForSlot(slot.key),
        slot: slot.definition,
        cached: false,
      }
    }
  }

  // 5. Template placeholder (sempre disponivel)
  if (slot.templateEnabled) {
    const placeholder = getPlaceholder(slot.key, context.appId)
    if (placeholder?.isEnabled) {
      return { source: 'template', placeholder, slot: slot.definition, cached: false }
    }
  }

  // 6. Vazio (todos os niveis falharam ou estao desabilitados)
  return { source: 'empty', slot: slot.definition, cached: false }
}
```

### 2.3 Tres modos de render

| Modo | Resolucao | Render | Latencia | CLS |
|------|-----------|--------|----------|-----|
| **House/CPA** (server) | RSC via `unstable_cache` (5min TTL) | HTML pronto no first paint | Zero | Zero --- dimensoes reservadas no skeleton |
| **Google Ads** (client) | Skeleton server-rendered com dimensoes IAB. Script carrega uma vez no layout. `<ins>` preenchido pelo AdSense. | Client-side, apos consent check | Timeout 3s, fallback para template | Zero --- skeleton reserva espaco exato |
| **Template** (server) | RSC, mesmo path do house | HTML pronto no first paint | Zero | Zero --- mesmos componentes visuais de house ads |

### 2.4 Prioridade e desempate

Dentro de cada nivel (house ou CPA), multiplas campanhas podem competir pelo mesmo slot:

```typescript
function selectWinner(
  candidates: ResolvedCandidate[],
  userId: string | undefined,
): ResolvedCandidate {
  // 1. Sort por priority DESC (campo numerico, 0-100)
  candidates.sort((a, b) => b.priority - a.priority)

  // 2. Se empate em priority, sort por relevanceScore DESC
  //    relevanceScore = numero de categorias em comum com o post
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority
    return b.relevanceScore - a.relevanceScore
  })

  // 3. A/B variant assignment (mesmo variant_group compete)
  const topGroup = candidates.filter(c => c.variantGroup === candidates[0].variantGroup)
  if (topGroup.length > 1 && userId) {
    const bucket = murmurhash(userId) % 100
    return assignByWeight(topGroup, bucket)
  }

  return candidates[0]
}
```

### 2.5 Pacing algorithm

Distribuicao de impressoes ao longo do schedule da campanha para evitar consumir orcamento cedo demais.

```typescript
function pacingAllows(campaign: AdCampaign, now: Date): boolean {
  if (!campaign.impressionsTarget) return true  // sem meta = sem pacing

  const elapsed = daysBetween(campaign.scheduleStart, now)
  const total = daysBetween(campaign.scheduleStart, campaign.scheduleEnd)
  if (total <= 0) return true

  const expectedProgress = elapsed / total
  const actualProgress = campaign.impressionsDelivered / campaign.impressionsTarget

  switch (campaign.pacingStrategy) {
    case 'even':
      // Permite se esta atras ou ate 10% a frente do expected
      return actualProgress <= expectedProgress + 0.10

    case 'front_loaded':
      // Curva agressiva: 60% do budget nos primeiros 40% do tempo
      const frontCurve = Math.min(1, expectedProgress * 1.5)
      return actualProgress <= frontCurve + 0.05

    case 'asap':
      // Sem throttling, apenas verifica budget total
      return campaign.spentCents < campaign.budgetCents

    default:
      return true
  }
}
```

### 2.6 IAdNetworkAdapter interface

Interface que adapters de ad network implementam. v1.0.0 inclui `AdsenseAdapter`; futuro: Amazon Publisher Services, Ezoic, etc.

```typescript
interface IAdNetworkAdapter {
  readonly id: string                 // 'adsense', 'amazon', etc.
  readonly label: string              // 'Google AdSense'
  readonly requiresConsent: boolean   // true para Google (cookies de terceiros)
  readonly fillTimeoutMs: number      // max wait para fill; default 3000

  /**
   * Retorna config necessaria para o client component renderizar o ad.
   * Chamado server-side durante resolveSlot(). Nao faz I/O.
   */
  configForSlot(slotKey: string): Record<string, unknown>

  /**
   * Verifica se o adapter esta configurado para o site.
   * Chamado uma vez durante boot para filtrar adapters invalidos.
   */
  isConfigured(siteConfig: AdSiteConfig): boolean
}
```

Implementacao do AdSense adapter:

```typescript
class AdsenseAdapter implements IAdNetworkAdapter {
  readonly id = 'adsense'
  readonly label = 'Google AdSense'
  readonly requiresConsent = true
  readonly fillTimeoutMs = 3000

  constructor(private readonly publisherId: string,
              private readonly adUnitMap: Record<string, string>) {}

  configForSlot(slotKey: string): Record<string, unknown> {
    return {
      publisherId: this.publisherId,
      adSlot: this.adUnitMap[slotKey] ?? null,
      format: 'auto',
      responsive: true,
    }
  }

  isConfigured(): boolean {
    return !!this.publisherId && Object.keys(this.adUnitMap).length > 0
  }
}
```

### 2.7 Cache strategy

| Dado | Cache | TTL | Invalidacao |
|------|-------|-----|-------------|
| Waterfall resolution (per slot + context hash) | `unstable_cache` | 5min | `revalidateTag('ad:slot:{slotKey}')` em campaign save/publish/status toggle |
| Kill switches | `unstable_cache` | 1min | `revalidateTag('ad:kill-switches')` em toggle action |
| Slot config | `unstable_cache` | 5min | `revalidateTag('ad:slot-config:{siteId}')` em settings save |
| Network revenue (dashboard) | `unstable_cache` | 15min | Manual refresh button no dashboard |

### 2.8 AdResolutionContext

```typescript
interface AdResolutionContext {
  appId: string                           // site.slug
  siteId: string                          // UUID do site
  locale: string                          // 'pt-BR' | 'en'
  postCategory?: string                   // categoria do blog post (targeting)
  userId?: string                         // hash do user para A/B e frequency cap
  now: Date                               // timestamp de resolucao
  masterKilled: boolean                   // kill_switches.kill_ads === false
  marketingConsent: boolean               // cookie_marketing consent do visitor
  networkAdapters: Record<string, IAdNetworkAdapter>
}
```

---

## Section 3: LGPD Consent Integration

### 3.1 Contexto

O site ja possui cookie consent com 3 categorias (Sprint 5a):

| Categoria | Default | Armazenamento |
|-----------|---------|---------------|
| `cookie_functional` | ON (locked) | Sempre ativo |
| `cookie_analytics` | OFF (opt-in) | `localStorage` + tabela `consents` |
| `cookie_marketing` | OFF (opt-in) | `localStorage` + tabela `consents` |

Google AdSense usa cookies de terceiros para ad targeting. Exige consentimento de `cookie_marketing`.

### 3.2 Comportamento do waterfall por nivel de consentimento

| Nivel | Requer consent? | Base legal LGPD | Comportamento sem consent |
|-------|----------------|----------------|--------------------------|
| House ads | Nao | Legitimo interesse (Art. 7 IX) --- ads proprios de cross-promotion, sem cookies de terceiros, sem tracking cross-site | Carrega normalmente |
| CPA ads | Nao | Legitimo interesse (Art. 7 IX) --- criativo servido server-side pelo proprio site, sem cookies de terceiros | Carrega normalmente |
| Google Ads | **Sim** (`cookie_marketing`) | Consentimento (Art. 7 I) --- Google injeta cookies de terceiros (`__gads`, `__gpi`, etc.) para personalizacao | Pula para proximo nivel (template) |
| Template | Nao | Legitimo interesse --- conteudo editorial proprio | Carrega normalmente |

### 3.3 Hook useAdConsent()

`ad-components` expoe `useAdConsent()` que le o estado de consentimento do consumer. O consumer (apps/web) implementa o adapter que conecta ao `CookieBannerProvider` existente.

```typescript
// ad-components/src/hooks/use-ad-consent.ts
interface AdConsentState {
  marketing: boolean      // cookie_marketing consent
  analytics: boolean      // cookie_analytics consent (para tracking pixel)
  loaded: boolean         // true apos primeira leitura (evita flash)
}

interface AdConsentAdapter {
  getConsent(): AdConsentState
  subscribe(callback: (state: AdConsentState) => void): () => void
}

const AdConsentContext = createContext<AdConsentAdapter | null>(null)

function useAdConsent(): AdConsentState {
  const adapter = useContext(AdConsentContext)
  const [state, setState] = useState<AdConsentState>(
    adapter?.getConsent() ?? { marketing: false, analytics: false, loaded: false }
  )

  useEffect(() => {
    if (!adapter) return
    setState(adapter.getConsent())
    return adapter.subscribe(setState)
  }, [adapter])

  return state
}
```

### 3.4 Adapter no consumer (apps/web)

```typescript
// apps/web/src/lib/ads/consent-adapter.ts
import { useCookieConsent } from '@/components/lgpd/cookie-banner-provider'

export function createConsentAdapter(): AdConsentAdapter {
  return {
    getConsent() {
      const consent = getStoredConsent()
      return {
        marketing: consent?.cookie_marketing ?? false,
        analytics: consent?.cookie_analytics ?? false,
        loaded: consent !== null,
      }
    },
    subscribe(callback) {
      // Multi-tab sync via storage event (contrato existente do Sprint 5a)
      const handler = (e: StorageEvent) => {
        if (e.key === 'lgpd_consent_v1') {
          callback(this.getConsent())
        }
      }
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
  }
}
```

### 3.5 Fluxo de mudanca de consentimento

```
1. Visitor abre cookie banner, ativa "Marketing"
2. CookieBannerProvider grava em localStorage + POST /api/consents
3. storage event dispara em todas as tabs
4. useAdConsent() recebe { marketing: true }
5. Slots com source='network' que estavam mostrando template
   re-avaliam client-side → carregam <GoogleAdUnit>
6. IntersectionObserver registra impressao quando visivel
```

Fluxo inverso (visitor revoga marketing consent):

```
1. Visitor abre banner, desativa "Marketing"
2. useAdConsent() recebe { marketing: false }
3. GoogleAdUnit desmonta → skeleton aparece
4. Slot volta a mostrar template placeholder (sem reload)
```

### 3.6 consent_texts seed para ad_marketing

Nova categoria de consent text na tabela `consent_texts` para informar o visitor sobre ads personalizados:

```sql
INSERT INTO consent_texts (id, category, locale, version, text_md) VALUES
('cookie_marketing_ads_v1_pt-BR', 'cookie_marketing', 'pt-BR', '3.0',
'**Cookies de marketing e publicidade**

Utilizamos servicos de publicidade de terceiros (Google AdSense) que podem
armazenar cookies no seu navegador para exibir anuncios personalizados.

- **Dados coletados:** cookies `__gads`, `__gpi`, identificadores de dispositivo
  para segmentacao publicitaria.
- **Processadores:** Google Ireland Ltd (UE) + Google LLC (EUA) via SCCs.
- **Retencao:** controlada pelo Google, tipicamente 13 meses.
- **Revogacao:** a qualquer momento via banner de cookies ou pagina de privacidade.
  Ads de terceiros serao substituidos por conteudo editorial.'),

('cookie_marketing_ads_v1_en', 'cookie_marketing', 'en', '3.0',
'**Marketing and advertising cookies**

We use third-party advertising services (Google AdSense) that may store
cookies on your browser to display personalized ads.

- **Data collected:** `__gads`, `__gpi` cookies, device identifiers for ad targeting.
- **Processors:** Google Ireland Ltd (EU) + Google LLC (USA) via SCCs.
- **Retention:** controlled by Google, typically 13 months.
- **Revocation:** at any time via cookie banner or privacy page. Third-party ads
  will be replaced with editorial content.')
ON CONFLICT (category, locale, version) DO NOTHING;
```

Nota: `cookie_marketing` ja existe como categoria no CHECK constraint da tabela `consents`. O texto v3.0 adiciona informacao especifica sobre Google AdSense ao consentimento existente. Versoes v1.0 e v2.0 permanecem como accountability record.

### 3.7 Sentry tags para erros de ad consent

Erros no fluxo de consent de ads usam tags Sentry:

```typescript
Sentry.captureException(error, {
  tags: {
    component: 'ad-consent',
    adapter: 'adsense',
    consent_state: state.marketing ? 'granted' : 'denied',
  },
})
```

---

## Section 4: Database Schema

### 4.1 organizations (adicionar colunas)

Colunas para configuracao de AdSense por organizacao. Um publisher ID por org (compartilhado entre sites da org).

```sql
-- Migration: ad_engine_org_adsense_columns

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS adsense_publisher_id TEXT,
  ADD COLUMN IF NOT EXISTS adsense_refresh_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS adsense_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS adsense_last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS adsense_sync_status TEXT DEFAULT 'disconnected';

-- Validation
ALTER TABLE organizations
  ADD CONSTRAINT organizations_adsense_publisher_id_format
    CHECK (adsense_publisher_id IS NULL OR adsense_publisher_id ~ '^ca-pub-\d+$');

ALTER TABLE organizations
  ADD CONSTRAINT organizations_adsense_sync_status_check
    CHECK (adsense_sync_status IN ('ok', 'error', 'pending', 'disconnected'));

COMMENT ON COLUMN organizations.adsense_publisher_id IS 'Google AdSense publisher ID (ca-pub-XXXXX). Um por org.';
COMMENT ON COLUMN organizations.adsense_refresh_token_enc IS 'OAuth2 refresh token criptografado com AES-256-GCM. Chave de decriptacao em ADSENSE_TOKEN_KEY env var, nunca no DB.';
```

### 4.2 ad_slot_config (tabela nova)

Substitui a logica dispersa entre `ad_placeholders`, `kill_switches` e configuracao hardcoded. Cada row configura um slot para um site.

```sql
-- Migration: ad_slot_config

CREATE TABLE IF NOT EXISTS public.ad_slot_config (
  site_id              UUID    NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  slot_key             TEXT    NOT NULL,

  -- Waterfall toggles (quais niveis estao habilitados)
  house_enabled        BOOLEAN NOT NULL DEFAULT true,
  cpa_enabled          BOOLEAN NOT NULL DEFAULT false,
  google_enabled       BOOLEAN NOT NULL DEFAULT false,
  template_enabled     BOOLEAN NOT NULL DEFAULT true,

  -- Network adapters (ordem de tentativa)
  network_adapters_order TEXT[] NOT NULL DEFAULT '{adsense}',
  network_config       JSONB   NOT NULL DEFAULT '{}',

  -- Display
  aspect_ratio         TEXT    NOT NULL DEFAULT '16:9',
  iab_size             TEXT,
  mobile_behavior      TEXT    NOT NULL DEFAULT 'keep'
    CHECK (mobile_behavior IN ('keep', 'hide', 'stack')),

  -- Frequency caps
  max_per_session      INT     NOT NULL DEFAULT 1,
  max_per_day          INT     NOT NULL DEFAULT 3,
  cooldown_ms          INT     NOT NULL DEFAULT 3600000,

  -- Metadata
  label                TEXT    NOT NULL,
  zone                 TEXT    NOT NULL
    CHECK (zone IN ('banner', 'rail', 'inline', 'block')),
  accepted_types       TEXT[]  NOT NULL DEFAULT '{house,cpa}',

  -- Timestamps
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (site_id, slot_key)
);

-- RLS
ALTER TABLE public.ad_slot_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_slot_config_all_service_role" ON public.ad_slot_config;
CREATE POLICY "ad_slot_config_all_service_role"
  ON public.ad_slot_config FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ad_slot_config_select_auth" ON public.ad_slot_config;
CREATE POLICY "ad_slot_config_select_auth"
  ON public.ad_slot_config FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ad_slot_config_select_anon" ON public.ad_slot_config;
CREATE POLICY "ad_slot_config_select_anon"
  ON public.ad_slot_config FOR SELECT TO anon USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ad_slot_config_site
  ON public.ad_slot_config (site_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_ad_slot_config_updated_at ON public.ad_slot_config;
CREATE TRIGGER update_ad_slot_config_updated_at
  BEFORE UPDATE ON public.ad_slot_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.ad_slot_config IS
  'Configuracao per-slot per-site do waterfall de ads. Substitui logica dispersa entre ad_placeholders + kill_switches.';
```

### 4.3 ad_campaigns (adicionar colunas)

Novas colunas para targeting por categoria, metas contratuais, budget, pacing e A/B testing.

```sql
-- Migration: ad_campaigns_targeting_pacing

ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS target_categories TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS impressions_target INT,
  ADD COLUMN IF NOT EXISTS clicks_target INT,
  ADD COLUMN IF NOT EXISTS budget_cents INT,
  ADD COLUMN IF NOT EXISTS spent_cents INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pacing_strategy TEXT DEFAULT 'even',
  ADD COLUMN IF NOT EXISTS variant_group TEXT,
  ADD COLUMN IF NOT EXISTS variant_weight INT DEFAULT 50;

-- Constraints
ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_pacing_strategy_check
    CHECK (pacing_strategy IN ('even', 'front_loaded', 'asap'));

ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_variant_weight_check
    CHECK (variant_weight BETWEEN 1 AND 100);

ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_budget_positive
    CHECK (budget_cents IS NULL OR budget_cents > 0);

ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_spent_non_negative
    CHECK (spent_cents >= 0);

-- Index para targeting query
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_target_categories
  ON public.ad_campaigns USING GIN (target_categories);

COMMENT ON COLUMN public.ad_campaigns.target_categories IS
  'Array de categorias alvo. Vazio = todas as categorias (sem filtro).';
COMMENT ON COLUMN public.ad_campaigns.pacing_strategy IS
  'even: distribuicao uniforme. front_loaded: 60% nos primeiros 40% do tempo. asap: sem throttling.';
COMMENT ON COLUMN public.ad_campaigns.variant_group IS
  'Campanhas com mesmo variant_group competem por A/B split. NULL = sem A/B.';
```

### 4.4 ad_slot_creatives (adicionar colunas)

Metadados de imagem para validacao de aspect ratio contra o slot.

```sql
-- Migration: ad_slot_creatives_image_metadata

ALTER TABLE public.ad_slot_creatives
  ADD COLUMN IF NOT EXISTS image_aspect_ratio TEXT,
  ADD COLUMN IF NOT EXISTS image_width INT,
  ADD COLUMN IF NOT EXISTS image_height INT;

ALTER TABLE public.ad_slot_creatives
  ADD CONSTRAINT ad_slot_creatives_image_dimensions_positive
    CHECK (
      (image_width IS NULL AND image_height IS NULL)
      OR (image_width > 0 AND image_height > 0)
    );

COMMENT ON COLUMN public.ad_slot_creatives.image_aspect_ratio IS
  'Aspect ratio calculado da imagem (e.g. "16:9"). Validado contra ad_slot_config.aspect_ratio no save.';
```

### 4.5 ad_revenue_daily (tabela nova)

Tabela de receita diaria agregada por slot e source. Permite dashboard unificado house + network.

```sql
-- Migration: ad_revenue_daily

CREATE TABLE IF NOT EXISTS public.ad_revenue_daily (
  site_id        UUID    NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  slot_key       TEXT    NOT NULL,
  date           DATE    NOT NULL,
  source         TEXT    NOT NULL
    CHECK (source IN ('adsense', 'house', 'cpa')),
  impressions    INT     NOT NULL DEFAULT 0,
  clicks         INT     NOT NULL DEFAULT 0,
  earnings_cents INT     NOT NULL DEFAULT 0,
  currency       TEXT    NOT NULL DEFAULT 'USD',
  page_views     INT     NOT NULL DEFAULT 0,
  fill_rate      NUMERIC(5,2),
  raw_data       JSONB,
  synced_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (site_id, slot_key, date, source)
);

-- RLS
ALTER TABLE public.ad_revenue_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_revenue_daily_all_service_role" ON public.ad_revenue_daily;
CREATE POLICY "ad_revenue_daily_all_service_role"
  ON public.ad_revenue_daily FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ad_revenue_daily_select_auth" ON public.ad_revenue_daily;
CREATE POLICY "ad_revenue_daily_select_auth"
  ON public.ad_revenue_daily FOR SELECT TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ad_revenue_daily_site_date
  ON public.ad_revenue_daily (site_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_ad_revenue_daily_source
  ON public.ad_revenue_daily (site_id, source, date DESC);

COMMENT ON TABLE public.ad_revenue_daily IS
  'Metricas diarias de receita agregadas por slot e source. Google sync via API; house/CPA calculado de ad_events. Fill rate = impressions / page_views.';
COMMENT ON COLUMN public.ad_revenue_daily.raw_data IS
  'Payload cru do provider (Google API response). Preservado para debug e reconciliacao.';
COMMENT ON COLUMN public.ad_revenue_daily.fill_rate IS
  'Percentual de page views onde o slot foi preenchido (0.00 a 100.00).';
```

### 4.6 Kill switches migration fix

Rename de kill switches antigos que sobreviveram da migracao 026. Idempotente.

```sql
-- Migration: kill_switches_final_cleanup

-- Rename residuais (se existirem — 026 ja fez os renames, mas sem ON CONFLICT safe)
UPDATE kill_switches SET id = 'ads_slot_banner_top'
  WHERE id = 'ads_slot_article_top'
  AND NOT EXISTS (SELECT 1 FROM kill_switches WHERE id = 'ads_slot_banner_top');

UPDATE kill_switches SET id = 'ads_slot_inline_mid'
  WHERE id = 'ads_slot_article_between_paras'
  AND NOT EXISTS (SELECT 1 FROM kill_switches WHERE id = 'ads_slot_inline_mid');

UPDATE kill_switches SET id = 'ads_slot_rail_right'
  WHERE id = 'ads_slot_sidebar_right'
  AND NOT EXISTS (SELECT 1 FROM kill_switches WHERE id = 'ads_slot_rail_right');

UPDATE kill_switches SET id = 'ads_slot_block_bottom'
  WHERE id = 'ads_slot_below_fold'
  AND NOT EXISTS (SELECT 1 FROM kill_switches WHERE id = 'ads_slot_block_bottom');

-- Seed slot que faltava na migracao original
INSERT INTO kill_switches (id, enabled, reason) VALUES
  ('ads_slot_inline_end', true, 'Per-slot: inline_end')
ON CONFLICT (id) DO NOTHING;

-- Google Ads master switch
INSERT INTO kill_switches (id, enabled, reason) VALUES
  ('ads_google_enabled', false, 'Google AdSense integration (requer publisher ID configurado)')
ON CONFLICT (id) DO NOTHING;

-- Network-level kill switch
INSERT INTO kill_switches (id, enabled, reason) VALUES
  ('ads_network_enabled', false, 'Master switch para ad networks de terceiros')
ON CONFLICT (id) DO NOTHING;
```

### 4.7 Seed: ad_slot_config para bythiagofigueiredo

Popula configuracao inicial dos 5 slots do site.

```sql
-- Migration: seed_ad_slot_config_bythiagofigueiredo

INSERT INTO ad_slot_config (site_id, slot_key, label, zone, aspect_ratio, iab_size,
  house_enabled, cpa_enabled, google_enabled, template_enabled,
  mobile_behavior, accepted_types, max_per_session, max_per_day, cooldown_ms)
SELECT
  s.id,
  v.slot_key,
  v.label,
  v.zone,
  v.aspect_ratio,
  v.iab_size,
  v.house_enabled,
  v.cpa_enabled,
  v.google_enabled,
  v.template_enabled,
  v.mobile_behavior,
  v.accepted_types,
  v.max_per_session,
  v.max_per_day,
  v.cooldown_ms
FROM sites s
CROSS JOIN (VALUES
  ('banner_top',   'Banner -- Topo',          'banner', '16:9',  '728x90',
    true, true, false, true, 'keep', '{house,cpa}'::text[], 1, 3, 3600000),
  ('rail_left',    'Rail esquerdo',           'rail',   '1:4',   '160x600',
    true, false, false, true, 'hide', '{house}'::text[], 1, 3, 3600000),
  ('rail_right',   'Rail direito',            'rail',   '1:4',   '160x600',
    false, true, false, true, 'stack', '{cpa}'::text[], 3, 6, 900000),
  ('inline_mid',   'Inline -- Meio',          'inline', '16:9',  '300x250',
    false, true, false, true, 'keep', '{cpa}'::text[], 2, 4, 1800000),
  ('block_bottom', 'Block -- Inferior',       'block',  '16:9',  '728x90',
    true, true, false, true, 'keep', '{house,cpa}'::text[], 1, 2, 7200000)
) AS v(slot_key, label, zone, aspect_ratio, iab_size,
       house_enabled, cpa_enabled, google_enabled, template_enabled,
       mobile_behavior, accepted_types, max_per_session, max_per_day, cooldown_ms)
WHERE s.slug = 'bythiagofigueiredo'
ON CONFLICT (site_id, slot_key) DO NOTHING;
```

### 4.8 Resumo de tabelas

Estado final apos todas as migracoes:

| Tabela | Status | PK | Descricao |
|--------|--------|-----|-----------|
| `ad_campaigns` | Existente + colunas | `id` (UUID) | Campanhas house/CPA com targeting, pacing e A/B |
| `ad_slot_creatives` | Existente + colunas | `id` (UUID) | Criativos por campanha x slot x locale com metadados de imagem |
| `ad_slot_config` | **Nova** | `(site_id, slot_key)` | Configuracao do waterfall per-slot per-site |
| `ad_revenue_daily` | **Nova** | `(site_id, slot_key, date, source)` | Receita diaria agregada por source |
| `ad_events` | Existente | `id` (UUID) | Eventos de tracking (impression, click, dismiss, interest) |
| `ad_slot_metrics` | Existente | `id` (UUID) | Metricas diarias por campanha x slot (house/CPA only) |
| `ad_placeholders` | Existente (deprecated) | `slot_id` (TEXT) | Mantida para backward compat. Novos sites usam `ad_slot_config.template_enabled` + criativos de template |
| `ad_media` | Existente | `id` (UUID) | Biblioteca de midias para criativos |
| `ad_inquiries` | Existente | `id` (UUID) | Formulario de interesse de anunciantes |
| `kill_switches` | Existente + rows | `id` (TEXT) | Kill switches globais e per-slot |
| `organizations` | Existente + colunas | `id` (UUID) | Colunas AdSense (publisher ID, OAuth token, sync status) |

### 4.9 RLS summary

| Tabela | `anon` | `authenticated` | `service_role` |
|--------|--------|-----------------|----------------|
| `ad_slot_config` | SELECT | SELECT | ALL |
| `ad_revenue_daily` | -- | SELECT | ALL |
| `ad_campaigns` | -- | SELECT | ALL |
| `ad_slot_creatives` | -- | SELECT | ALL |
| `ad_events` | -- | INSERT | ALL |

Nota: `anon` precisa de SELECT em `ad_slot_config` porque a resolucao do waterfall acontece em RSC sem autenticacao (visitor anonimo lendo blog post). Dados sensiveis (revenue, OAuth tokens) sao restritos a `authenticated` ou `service_role`.

---

## Section 5: Tracking Architecture

### House/CPA Tracking

Todos os eventos de house ads e CPA ads sao rastreados pelo sistema proprio. Google Ads cuida do proprio tracking (ver subsecao abaixo).

**Impressions** -- IntersectionObserver com `threshold: 0.5` e delay de 1000ms. Dispara quando 50%+ do ad esta visivel por 1s+ (IAB viewability standard, MRC guidelines). Observador registrado no mount do componente, desconectado no unmount.

**Clicks** -- Wrapper `onClick` no componente. Usa Beacon API (`navigator.sendBeacon`) para evitar bloquear navegacao. Fallback para `fetch()` com `keepalive: true` se `sendBeacon` nao estiver disponivel.

**Dismiss** -- Callback `onDismiss` no componente. Persiste no `localStorage` via `btf_ads_dismissed` (hook `useDismissable` existente) + envia beacon event para analytics.

**Endpoint** -- `POST /api/ads/events` (Next.js route handler em `apps/web`, NAO a Fastify API). Request body:

```typescript
interface AdEventPayload {
  events: AdEvent[]
}

interface AdEvent {
  type: 'impression' | 'click' | 'dismiss'
  slotKey: string
  campaignId: string | null
  userHash: string
  timestamp: number
}
```

O endpoint valida com Zod, insere em batch na tabela `ad_events` via service-role client, e retorna `204 No Content`. Rate limit: 50 events por IP por minuto (via middleware).

**Batching** -- Acumula eventos por 2 segundos, envia em batch. Usa `requestIdleCallback` para envios non-blocking. Se a tab fechar antes do flush, `visibilitychange` handler faz `sendBeacon` imediato com os eventos pendentes.

```typescript
const EVENT_BUFFER: AdEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function queueEvent(event: AdEvent): void {
  EVENT_BUFFER.push(event)
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      requestIdleCallback(() => flushEvents())
    }, 2000)
  }
}

function flushEvents(): void {
  if (EVENT_BUFFER.length === 0) return
  const batch = EVENT_BUFFER.splice(0)
  flushTimer = null
  const body = JSON.stringify({ events: batch })
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/ads/events', new Blob([body], { type: 'application/json' }))
  } else {
    fetch('/api/ads/events', { method: 'POST', body, keepalive: true })
  }
}

// Garante flush antes de fechar a tab
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushEvents()
})
```

**Dedup** -- `sessionStorage` com chave `ad_seen_${slotKey}_${campaignId}`. Previne multiplas impressions do mesmo ad na mesma pageview. Reset automatico ao navegar para nova pagina (Next.js soft navigation mantem sessionStorage, mas o componente reseta o flag no mount com novo `slotKey`).

**userHash** -- SHA-256 do `anonymous_id` do sistema de consentimento LGPD (`localStorage.lgpd_anon_id`). Nunca envia identificadores raw. Se nao houver `lgpd_anon_id` (usuario sem interacao com banner), gera hash de `crypto.randomUUID()` efemero por sessao.

```typescript
async function getUserHash(): Promise<string> {
  const anonId = localStorage.getItem('lgpd_anon_id')
  const source = anonId ?? sessionStorage.getItem('ad_ephemeral_id')
    ?? (() => {
      const id = crypto.randomUUID()
      sessionStorage.setItem('ad_ephemeral_id', id)
      return id
    })()
  const encoder = new TextEncoder()
  const data = encoder.encode(source)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
```

### Google Ads Tracking

**Impressions/Clicks** -- Rastreados pelo Google. NAO duplicamos tracking. Dashboard mostra "Google Ads: ver relatorio no console AdSense" com link direto para `https://www.google.com/adsense/`.

**Fill rate** -- Detecta se o Google preencheu o slot via `MutationObserver` no elemento `<ins class="adsbygoogle">`. Se nao preenchido em 3s, fallback para template e log de evento `google_nofill`:

```typescript
function observeGoogleFill(
  insElement: HTMLElement,
  slotKey: string,
  onNofill: () => void
): () => void {
  let filled = false
  const timeout = setTimeout(() => {
    if (!filled) {
      queueEvent({ type: 'impression', slotKey, campaignId: 'google_nofill', userHash: '', timestamp: Date.now() })
      onNofill()
    }
  }, 3000)

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        filled = true
        clearTimeout(timeout)
        break
      }
    }
  })
  observer.observe(insElement, { childList: true, subtree: true })

  return () => {
    clearTimeout(timeout)
    observer.disconnect()
  }
}
```

**Revenue** -- Sem acesso real-time a receita do AdSense. Dashboard mostra link para o console. Cron diario importa dados T-1 via AdSense Management API v2 para tabela `ad_revenue_daily` (ver Section 11).

### Dashboard Consolidation

| Fonte | Metricas | Origem |
|---|---|---|
| House/CPA | Impressions, clicks, CTR, dismissals | Tabela `ad_events` (real-time) |
| Google Ads | Fill rate, nofill events | Tabela `ad_events` com `campaignId='google_nofill'` / `'google_blocked'` |
| Google Ads | Revenue, RPM, page views | Tabela `ad_revenue_daily` (importacao diaria T-1) |

Aggregate views disponiveis: por slot, por campanha, por categoria, por periodo. Charts: stacked area chart por source ao longo do tempo, com drill-down por slot.

### `useAdSlot()` Hook (em `@tn-figueiredo/ad-components@0.1.0`)

Hook principal que encapsula toda a logica de tracking para uso nos componentes de ad.

```typescript
'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import type { AdCreativeData } from '@tn-figueiredo/ad-engine'

interface UseAdSlotReturn {
  containerRef: React.RefObject<HTMLDivElement>
  trackClick: () => void
  isVisible: boolean
}

export function useAdSlot(
  slotKey: string,
  creative: AdCreativeData | null,
): UseAdSlotReturn {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  // IntersectionObserver para impression tracking (IAB: 50% visivel por 1s)
  useEffect(() => {
    if (!creative || !containerRef.current) return
    const dedupKey = `ad_seen_${slotKey}_${creative.campaignId ?? 'ph'}`
    if (sessionStorage.getItem(dedupKey)) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) {
          setIsVisible(true)
          timer = setTimeout(async () => {
            const userHash = await getUserHash()
            queueEvent({
              type: 'impression',
              slotKey,
              campaignId: creative.campaignId,
              userHash,
              timestamp: Date.now(),
            })
            sessionStorage.setItem(dedupKey, '1')
          }, 1000)
        } else {
          setIsVisible(false)
          if (timer) {
            clearTimeout(timer)
            timer = null
          }
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [slotKey, creative])

  // Click tracking wrapper
  const trackClick = useCallback(async () => {
    if (!creative) return
    const userHash = await getUserHash()
    queueEvent({
      type: 'click',
      slotKey,
      campaignId: creative.campaignId,
      userHash,
      timestamp: Date.now(),
    })
  }, [slotKey, creative])

  return { containerRef, trackClick, isVisible }
}
```

O hook NAO condiciona tracking a consent de marketing. Impressions e clicks de house ads sao first-party analytics (interesse legitimo LGPD Art. 7 VIII). CPA ads com tracking de terceiros exigiriam consent -- mas como NAO duplicamos tracking do Google, nao ha problema.

### Frequency Capping (Client-Side)

`ad_slot_config` define tres limites por slot: `max_per_session`, `max_per_day`, `cooldown_ms`. Enforcement e client-side via `localStorage` para persistencia cross-pageview.

```typescript
interface FrequencyState {
  impressions: number
  lastShown: number  // timestamp ms
}

const FREQ_KEY_PREFIX = 'ad_freq_'

function canShowAd(slotKey: string, config: AdSlotConfig): boolean {
  const key = `${FREQ_KEY_PREFIX}${slotKey}`
  const raw = localStorage.getItem(key)
  if (!raw) return true

  const state: FrequencyState = JSON.parse(raw)
  const now = Date.now()

  // Cooldown check
  if (now - state.lastShown < config.cooldown_ms) return false

  // Daily cap — reset if last impression was yesterday
  const lastDate = new Date(state.lastShown).toDateString()
  const today = new Date(now).toDateString()
  if (lastDate !== today) return true  // new day, reset

  // Within same day
  return state.impressions < config.max_per_day
}

function recordImpression(slotKey: string): void {
  const key = `${FREQ_KEY_PREFIX}${slotKey}`
  const raw = localStorage.getItem(key)
  const now = Date.now()

  if (!raw) {
    localStorage.setItem(key, JSON.stringify({ impressions: 1, lastShown: now }))
    return
  }

  const state: FrequencyState = JSON.parse(raw)
  const lastDate = new Date(state.lastShown).toDateString()
  const today = new Date(now).toDateString()

  localStorage.setItem(key, JSON.stringify({
    impressions: lastDate === today ? state.impressions + 1 : 1,
    lastShown: now,
  }))
}
```

`max_per_session` e enforced via `sessionStorage` (contador incrementado no mount, resetado ao fechar tab). Os tres limites sao checados em ordem: cooldown → daily cap → session cap. Se qualquer um falhar, o slot renderiza vazio (nao skeleton — o espaco nao e reservado para ads que excedem frequency cap).

Frequency caps sao per-slot, nao per-campaign. Se um slot atinge o cap, nenhuma campanha aparece naquele slot ate o cooldown expirar.

---

## Section 6: Theme System (`@tn-figueiredo/ad-components@0.1.0`)

### CSS Variables Contract

O consumer define CSS variables no wrapper `div` do ad ou em `:root`. Todos os componentes do package leem essas variaveis para estilizacao.

```css
--ad-bg: #1a1a1a;                        /* background do card */
--ad-bg-alt: #2a2520;                     /* background secundario (skeleton, hover) */
--ad-text: #e0d6c8;                       /* cor do texto primario */
--ad-text-muted: #a09080;                 /* texto secundario/muted */
--ad-accent: #c75a2a;                     /* botoes CTA, fallback de brand */
--ad-border: #333;                        /* cor de borda */
--ad-radius: 8px;                         /* border-radius dos cards */
--ad-font-body: 'Inter';                  /* font family do body */
--ad-font-heading: 'Source Serif 4';      /* font family de headings */
--ad-font-mono: 'JetBrains Mono';         /* font family de badges/labels */
```

### Fallback Strategy

Todos os componentes usam o pattern `var(--ad-text, #1a1a1a)` com fallback inline. Se o consumer NAO definir nenhuma variavel, um tema light generico funciona como default. Componentes sao utilizaveis sem NENHUMA CSS variable configurada.

| Variavel | Fallback (light) |
|---|---|
| `--ad-bg` | `#ffffff` |
| `--ad-bg-alt` | `#f5f5f5` |
| `--ad-text` | `#1a1a1a` |
| `--ad-text-muted` | `#6b7280` |
| `--ad-accent` | `#3b82f6` |
| `--ad-border` | `#e5e7eb` |
| `--ad-radius` | `8px` |
| `--ad-font-body` | `system-ui, sans-serif` |
| `--ad-font-heading` | `system-ui, sans-serif` |
| `--ad-font-mono` | `ui-monospace, monospace` |

### Consumer Integration (bythiagofigueiredo)

O site mapeia tokens do tema Pinboard para tokens de ad:

```css
:root {
  --ad-bg: var(--pb-paper2);
  --ad-bg-alt: var(--pb-paper);
  --ad-text: var(--pb-ink);
  --ad-text-muted: var(--pb-muted);
  --ad-accent: var(--pb-accent);
  --ad-border: var(--pb-line);
  --ad-font-body: var(--font-inter);
  --ad-font-heading: var(--font-source-serif);
  --ad-font-mono: var(--font-jetbrains);
}
```

Outros sites do ecossistema mapeiam seus proprios design tokens da mesma forma. O package nao conhece nenhum tema especifico -- depende exclusivamente das CSS variables.

### Brand Color Override

Cada campanha pode ter um campo `brandColor` que sobrescreve `--ad-accent` apenas para aquele ad especifico. Backgrounds de CTA e elementos de destaque usam a cor da campanha, nao a accent do site.

Aplicado via inline style no wrapper do componente:

```tsx
<div
  ref={containerRef}
  style={{ '--ad-accent': creative.brandColor } as React.CSSProperties}
  className="ad-card"
>
  {/* ... */}
</div>
```

Cascata CSS garante que filhos herdam o override sem alterar outros ads na pagina.

### Component Variants (5)

| # | Componente | Descricao | Slot | Layout |
|---|---|---|---|---|
| 1 | `AdBanner` | Strip horizontal full-width. Animacao slide-down na entrada. Botao dismiss. | `banner_top` | `width: 100%; min-height: 90px` |
| 2 | `AdRail` | Card de sidebar com logo, titulo, body snippet, CTA. | `rail_left`, `rail_right` | `width: 100%; max-width: 300px` |
| 3 | `AdInline` | Card estilo bookmark entre secoes de conteudo. Logo + titulo + body + CTA. | `inline_mid` | `width: 100%; max-width: 672px` |
| 4 | `AdBlock` | Card standalone abaixo do conteudo. Grid layout com logo, titulo, body, botao CTA. | `block_bottom` | `width: 100%; max-width: 970px` |
| 5 | `AdSkeleton` | Placeholder com animacao pulse. Renderiza com dimensoes IAB exatas do slot config. | Todos (loading state) | Dimensoes variam por slot |

Todos os componentes aceitam `AdSlotProps`:

```typescript
interface AdSlotProps {
  creative: AdCreativeData
  locale: string
  onDismiss?: () => void
}
```

### Anatomia de um componente

Cada variante segue a mesma estrutura interna:

```
[wrapper div com CSS vars + ref do useAdSlot]
  [badge: PATROCINADO / DA CASA via adLabel()]
  [logo container: brandColor background + <img>]
  [titulo: creative.title]
  [body: creative.body]
  [CTA: link ou form, conforme creative.interaction]
  [dismiss button: se onDismiss fornecido]
```

### Animacoes

| Componente | Entrada | Saida (dismiss) |
|---|---|---|
| `AdBanner` | `slideDown` 300ms ease-out | `slideUp` 200ms ease-in |
| `AdRail` | `fadeIn` 200ms | `fadeOut` 150ms |
| `AdInline` | `fadeIn` 200ms | `fadeOut` 150ms |
| `AdBlock` | `fadeIn` 300ms | `fadeOut` 200ms |
| `AdSkeleton` | `pulse` 1.5s infinite | Crossfade 300ms para ad real |

Animacoes usam `@keyframes` com `prefers-reduced-motion: reduce` media query que desabilita todas as animacoes (accessibilidade).

```css
@media (prefers-reduced-motion: reduce) {
  .ad-card,
  .ad-skeleton {
    animation: none !important;
    transition: none !important;
  }
}
```

### Accessibility

Todos os componentes de ad seguem WCAG 2.1 AA:

| Requisito | Implementacao |
|---|---|
| Landmark | Wrapper `<aside role="complementary" aria-label="Publicidade">` em cada ad |
| Label | Badge "PATROCINADO" / "SPONSORED" visivel + `aria-label` no link CTA |
| Dismiss | Botao `<button aria-label="Fechar anuncio">` com `tabIndex={0}`, ativa via Enter/Space |
| Focus | Outline visivel em todos os elementos interativos (CTA link, dismiss button) via `focus-visible` |
| Contrast | Texto sobre `--ad-bg` exige ratio >= 4.5:1. Fallback colors ja atendem. Consumer responsavel por garantir que custom tokens mantenham contraste. |
| Reduced motion | `prefers-reduced-motion: reduce` desabilita todas as animacoes (slide, fade, pulse) |
| Screen reader | Skeleton tem `aria-busy="true"` + `aria-label="Carregando anuncio"`. Quando ad carrega, `aria-busy` vira `false`. |
| Google Ads | `<ins>` element recebe `aria-label="Anuncio do Google"`. Nao controlamos internals do iframe Google. |

Label i18n via `locale` prop — `'pt-BR'` renderiza "PATROCINADO", `'en'` renderiza "SPONSORED".

### Responsive Behavior

O componente consulta `mobileBehavior` do slot definition (passado como prop) para adaptar em viewports estreitos:

| `mobileBehavior` | Comportamento em `< 768px` |
|---|---|
| `'keep'` | Mesmo layout, responsivo via `max-width: 100%` |
| `'hide'` | `display: none` (sem render, sem tracking) |
| `'stack'` | Colapsa para layout vertical no fluxo de conteudo |

---

## Section 7: Category Targeting

### Data Model

```sql
ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS target_categories TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_target_categories
  ON ad_campaigns USING GIN (target_categories);
```

`ad_campaigns.target_categories TEXT[]` -- Array de strings de categorias de blog posts.

| Valor | Significado |
|---|---|
| `'{}'` (array vazio) | Aparece em TODAS as categorias (default para novas campanhas) |
| `'{tech,code}'` | Apenas em posts com categoria `tech` ou `code` |
| `'{vida,viagem}'` | Apenas em posts de lifestyle/viagem |

### Categorias Atuais do Blog

Definidas via CHECK constraint em `blog_posts.category`:

| Chave | Descricao |
|---|---|
| `tech` | Tecnologia e ferramentas |
| `code` | Programacao e desenvolvimento |
| `vida` | Estilo de vida |
| `viagem` | Viagem |
| `crescimento` | Crescimento pessoal |
| `negocio` | Negocios e empreendedorismo |

### Resolution Logic

O resolver recebe `context.postCategory` do consumer e filtra candidatos:

```typescript
function matchesCategory(
  targetCategories: string[],
  postCategory: string | null,
): boolean {
  // Sem targeting = aparece em todo lugar
  if (targetCategories.length === 0) return true
  // Post sem categoria = mostra apenas campanhas untargeted
  if (!postCategory) return false
  // Match direto
  return targetCategories.includes(postCategory)
}
```

Integrado no `resolveSlots()` do `@tn-figueiredo/ad-engine`:

```typescript
// Dentro de resolveSlots():
for (const candidate of sortedCandidates) {
  if (!matchesCategory(candidate.target_categories, context.postCategory)) continue
  // ... resto da resolucao (kill switch, schedule, priority)
}
```

### Contextos fora de blog posts

Quando ads aparecem fora de blog posts (homepage, paginas standalone):

- `postCategory` e `null`
- Apenas campanhas com `target_categories = '{}'` (untargeted) sao mostradas
- Comportamento correto: campanhas targeted aparecem apenas em conteudo correspondente

| Contexto | `postCategory` | Campanhas elegivel |
|---|---|---|
| Blog post `tech` | `'tech'` | Untargeted + targeted para `tech` |
| Blog post `vida` | `'vida'` | Untargeted + targeted para `vida` |
| Homepage | `null` | Apenas untargeted |
| Pagina `/privacy` | `null` | Apenas untargeted |
| Pagina `/contact` | `null` | Apenas untargeted |

### Admin UI

Wizard de campanha, step "Targeting":

- Multi-select com checkbox list de categorias
- Toggle "Todas as categorias" (seta array para vazio)
- Preview text: "Este anuncio vai aparecer em posts de: Tech, Code" (ou "Todas as categorias")
- Categorias carregadas dinamicamente do DB:

```sql
SELECT DISTINCT category
FROM blog_posts
WHERE category IS NOT NULL
ORDER BY category;
```

- NAO hardcoded -- cada site do ecossistema tem suas proprias categorias

### Validacao

```typescript
// Em campaignFormSchema (Zod):
targetCategories: z.array(z.string().min(1).max(50)).default([]),
```

Sem constraint de FK no DB -- as categorias sao string livres. Se uma categoria for removida do CHECK constraint de `blog_posts.category`, campanhas targeting essa categoria simplesmente param de fazer match (fail open para a campanha, fail closed para o slot -- o ad nao aparece onde nao deveria).

### Ecosystem Compatibility

O sistema de categorias e generico. Qualquer site consumer pode ter suas proprias categorias. O `@tn-figueiredo/ad-engine` conhece apenas `string[]` -- nao impoe valores especificos. O `@tn-figueiredo/ad-engine-admin` consulta o DB do consumer para listar categorias disponiveis no wizard.

Tipo no package:

```typescript
// @tn-figueiredo/ad-engine
interface AdResolverContext {
  locale: string
  defaultLocale: string
  postCategory?: string | null   // null = nao-blog context
  // futuro: userSegments, geoRegion, etc.
}
```

### Migration

```sql
-- Migration: ad_campaigns_target_categories.sql

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS target_categories TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_target_categories
  ON ad_campaigns USING GIN (target_categories);

COMMENT ON COLUMN ad_campaigns.target_categories IS
  'Blog post categories this campaign targets. Empty array = all categories.';
```

Idempotente via `IF NOT EXISTS`. Indice GIN para queries eficientes com `@>` (contains) e `&&` (overlap).

Query de resolucao:

```sql
-- Campanhas que fazem match com a categoria do post
SELECT *
FROM ad_campaigns
WHERE status = 'active'
  AND (target_categories = '{}' OR target_categories @> ARRAY[$1])
ORDER BY priority DESC, created_at DESC;
```

---

## Section 8: CLS-Zero & Performance

### Problema

Google Ads carregam client-side (~200-500ms). Se o espaco nao for reservado, o conteudo "pula" (layout shift = CLS > 0). Google penaliza isso em Core Web Vitals. Meta: CLS contribution dos ad slots = 0.

### Solucao: Dimensoes Reservadas

Cada componente de slot renderiza um `<div>` com `min-height` baseado no `aspect_ratio` da configuracao de `ad_slot_config`. Dimensoes vem do server (RSC) e estao no HTML no first paint.

Tamanhos padrao IAB por slot:

| Slot | IAB Size | Pixels | Aspect Ratio | `min-height` (desktop) |
|---|---|---|---|---|
| `banner_top` | Leaderboard | 728x90 | ~8:1 | `90px` |
| `rail_left` | Half Page | 300x600 | 1:2 | `600px` |
| `inline_mid` | Medium Rectangle | 300x250 | ~6:5 | `250px` |
| `rail_right` | Medium Rectangle | 300x250 | ~6:5 | `250px` |
| `block_bottom` | Billboard | 970x250 | ~4:1 | `250px` |

Em mobile (`< 768px`), slots com `mobileBehavior: 'hide'` (e.g., `rail_left`) nao renderizam -- zero CLS porque nao ha reserva de espaco. Slots com `mobileBehavior: 'stack'` colapsam para largura total com `min-height` ajustado proporcionalmente.

### Skeleton Component

Enquanto Google carrega, mostra skeleton com animacao pulse sutil (opacity 0.3 a 0.6). Mesmas dimensoes do ad final.

```css
.ad-skeleton {
  min-height: var(--ad-slot-height);
  min-width: var(--ad-slot-width);
  max-width: 100%;
  background: var(--ad-bg-alt, #f5f5f5);
  border-radius: var(--ad-radius, 8px);
  border: 1px solid var(--ad-border, #e5e7eb);
  animation: ad-pulse 1.5s ease-in-out infinite;
}

@keyframes ad-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

@media (prefers-reduced-motion: reduce) {
  .ad-skeleton {
    animation: none;
    opacity: 0.4;
  }
}
```

Variaveis de dimensao injetadas via inline style no server:

```tsx
// RSC (server component)
<div
  className="ad-skeleton"
  style={{
    '--ad-slot-height': `${slotConfig.height}px`,
    '--ad-slot-width': `${slotConfig.width}px`,
  } as React.CSSProperties}
/>
```

### Timeout & Fallback

| Fase | Tempo | Acao |
|---|---|---|
| 0-3s | Skeleton visivel | MutationObserver monitora `<ins>` |
| 3s (nofill) | Crossfade para template | Opacity transition 300ms, log `google_nofill` |
| 3s (filled) | Google ad renderizado | Observer desconectado, skeleton removido |

Transicao: 300ms opacity crossfade. Zero layout shift porque dimensoes do skeleton e do ad final sao identicas.

```typescript
function AdSlotWithGoogleFallback({
  slotKey,
  googleAdUnitId,
  fallbackCreative,
  slotConfig,
}: {
  slotKey: string
  googleAdUnitId: string
  fallbackCreative: AdCreativeData | null
  slotConfig: { width: number; height: number }
}) {
  const [state, setState] = useState<'loading' | 'google' | 'fallback'>('loading')

  useEffect(() => {
    const ins = document.querySelector(`ins[data-ad-slot="${googleAdUnitId}"]`)
    if (!ins) {
      setState('fallback')
      return
    }
    return observeGoogleFill(ins as HTMLElement, slotKey, () => setState('fallback'))
  }, [googleAdUnitId, slotKey])

  if (state === 'loading') {
    return <AdSkeleton width={slotConfig.width} height={slotConfig.height} />
  }
  if (state === 'google') {
    return null // Google filled the <ins> element directly
  }
  // fallback
  return fallbackCreative
    ? <AdInline creative={fallbackCreative} locale={locale} />
    : null
}
```

### Deteccao de Ad Blocker

- Verifica se `window.adsbygoogle` existe apos o evento `load` do script
- Se script bloqueado: log evento `google_blocked` + fallback imediato para template
- NENHUMA mensagem intrusiva ao usuario (sem "por favor desabilite seu ad blocker")
- Degradacao silenciosa para template

```typescript
function detectAdBlocker(): boolean {
  return typeof window !== 'undefined' && !('adsbygoogle' in window)
}
```

O fallback para template e identico ao cenario de nofill -- mesma transicao, mesmas dimensoes. Usuario nao percebe diferenca visual.

### Script Loading Strategy

- AdSense `<script>` carregado UMA VEZ no layout com `async` + `crossorigin="anonymous"`
- NAO duplicado por ad
- Tags `<ins>` preenchidas pelo script quando pronto
- Script injetado APENAS se ao menos um slot tem `google_enabled: true` E usuario tem consent de marketing

```tsx
// Em app/(public)/layout.tsx — condicional
{hasGoogleSlots && marketingConsent && (
  <Script
    src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
    strategy="lazyOnload"
    crossOrigin="anonymous"
    data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
  />
)}
```

`strategy="lazyOnload"` garante que o script carrega apos `window.onload` -- zero impacto no LCP.

### Server-Side Pre-Resolution

House/CPA ads resolvidos server-side (RSC, `unstable_cache` com TTL 5min, tag `'ads'`). O HTML contem o conteudo completo do ad no first paint -- zero client-side fetch para house ads.

```
Server (RSC)                    Client (browser)
─────────────                   ────────────────
resolveSlots()                  
  ↓                             
unstable_cache (5min, tag:ads)  
  ↓                             
Ad resolvido? ──yes──→ HTML completo do ad ──→ Hydrate: attach tracking observers
             ──no───→ null (slot nao renderiza)

Google slot? ──yes──→ Marker: { source: 'google', adUnitId: '...' }
                                ↓
                     Client: render <ins> + <AdSkeleton>
                                ↓
                     Google script fills <ins> OR timeout → fallback
```

Google Ads sao os UNICOS ads renderizados client-side. O server envia um marker `{ source: 'google', adUnitId: '...' }` que o componente client pega para renderizar a tag `<ins>`.

### Performance Budget

| Metrica | Target | Mecanismo |
|---|---|---|
| CLS contribution | 0 | Dimensoes reservadas via `min-height`/`min-width` no first paint |
| LCP impact | 0ms | House ads no HTML (SSR). Google script `lazyOnload`. |
| TBT impact | < 5ms | IntersectionObserver e non-blocking. Beacon API para eventos. |
| JS bundle (ad-components) | < 8KB gzipped | Nenhuma dependencia externa. CSS-in-variables, nao CSS-in-JS. |
| Network requests (tracking) | 1 batch/2s max | Acumulador com flush a cada 2s via `requestIdleCallback` |

### Lighthouse CI Integration

Sprint 5b ja tem LHCI com threshold SEO >= 95 e perf >= 80 mobile. Adicionar assertion especifica para CLS:

```yaml
# .lighthouserc.yml (adicionado em Sprint 5b PR-D)
assertions:
  cumulative-layout-shift:
    - error
    - maxNumericValue: 0.1
```

Se CLS subir acima de 0.1 por causa de ads, CI bloqueia o merge. Target real: 0 (ads nao devem contribuir CLS).

---

## Section 9: Migration Path (0.x -> 1.0)

### Breaking Changes (package API)

| Change | Package | Impact |
|---|---|---|
| `resolveSlot()` signature: now accepts `AdContext` with `postCategory: string \| null` and `marketingConsent: boolean` | ad-engine | All consumers must update call sites |
| `AdConfig` gains required fields: `target_categories: string[]`, `pacing_strategy: 'even' \| 'front_loaded' \| 'asap'` | ad-engine | Existing AdConfig implementations must add fields |
| `IAdConfigRepository.getActiveBySlot()` gains param `category: string \| null` | ad-engine | All repository implementations must update signature |
| `AD_SLOT_IDS` constants removed --- slots are dynamic via DB (`ad_slot_config` table) | ad-engine | Consumers referencing constants must read from DB or local config |
| Kill switch IDs renamed (`ads_slot_article_top` -> `ads_slot_banner_top`, etc.) | ad-engine | DB UPDATE required per consumer |
| `AdFormat` type: `'native'` removed, `'interstitial'` removed, refined to IAB standard set | ad-engine | Consumers using removed format values must migrate |
| `IAdNetworkAdapter` interface added (new concept) | ad-engine | No breakage --- additive, but waterfall resolution changes behavior |
| `AdResolution` type gains `renderClient: boolean` field | ad-engine | Consumers must handle client-side rendering for Google Ads slots |
| `inline_end` slot removed entirely | ad-engine, ad-components | BowtieAd component deleted, references must be removed |

### Consumer Migration SQL

Todas as migrations DEVEM ser idempotentes (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING` / `DROP ... IF EXISTS`). Uma unica migration file no consumer (`supabase/migrations/YYYYMMDD_ad_engine_1_0_migration.sql`).

**Step 1 --- Renomear kill switches:**

```sql
-- Idempotente: NOT EXISTS previne duplicatas
-- Nota: kill_switches usa colunas (id TEXT PK, enabled BOOLEAN, reason TEXT)
UPDATE kill_switches
SET id = 'ads_slot_banner_top'
WHERE id = 'ads_slot_article_top'
  AND NOT EXISTS (SELECT 1 FROM kill_switches WHERE id = 'ads_slot_banner_top');

UPDATE kill_switches
SET id = 'ads_slot_rail_right'
WHERE id = 'ads_slot_sidebar_right'
  AND NOT EXISTS (SELECT 1 FROM kill_switches WHERE id = 'ads_slot_rail_right');

UPDATE kill_switches
SET id = 'ads_slot_inline_mid'
WHERE id = 'ads_slot_article_between_paras'
  AND NOT EXISTS (SELECT 1 FROM kill_switches WHERE id = 'ads_slot_inline_mid');

UPDATE kill_switches
SET id = 'ads_slot_block_bottom'
WHERE id = 'ads_slot_below_fold'
  AND NOT EXISTS (SELECT 1 FROM kill_switches WHERE id = 'ads_slot_block_bottom');

-- Novos slots que nao existiam antes
INSERT INTO kill_switches (id, enabled, reason)
VALUES
  ('ads_slot_rail_left', true, 'Rail esquerdo — MarginaliaAd'),
  ('ads_slot_banner_top', true, 'Banner topo — DoormanAd'),
  ('ads_slot_rail_right', true, 'Rail direito — AnchorAd'),
  ('ads_slot_inline_mid', true, 'Inline meio — BookmarkAd'),
  ('ads_slot_block_bottom', true, 'Block inferior — CodaAd')
ON CONFLICT (id) DO NOTHING;
```

**Step 2 --- ADD columns to `ad_campaigns`:**

```sql
ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS target_categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS impressions_target int,
  ADD COLUMN IF NOT EXISTS clicks_target int,
  ADD COLUMN IF NOT EXISTS budget_cents int,
  ADD COLUMN IF NOT EXISTS spent_cents int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pacing_strategy text NOT NULL DEFAULT 'even'
    CHECK (pacing_strategy IN ('even', 'front_loaded', 'asap')),
  ADD COLUMN IF NOT EXISTS variant_group text,
  ADD COLUMN IF NOT EXISTS variant_weight int NOT NULL DEFAULT 100
    CHECK (variant_weight BETWEEN 0 AND 100);
```

**Step 3 --- ADD columns to `ad_slot_creatives`:**

```sql
ALTER TABLE ad_slot_creatives
  ADD COLUMN IF NOT EXISTS image_aspect_ratio text,
  ADD COLUMN IF NOT EXISTS image_width int,
  ADD COLUMN IF NOT EXISTS image_height int;
```

**Step 4 --- ADD columns to `organizations` (AdSense):**

```sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS adsense_publisher_id text,
  ADD COLUMN IF NOT EXISTS adsense_refresh_token_enc text,
  ADD COLUMN IF NOT EXISTS adsense_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS adsense_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS adsense_sync_status text DEFAULT 'disconnected'
    CHECK (adsense_sync_status IN ('disconnected', 'ok', 'error'));
```

**Step 5 --- CREATE TABLE `ad_slot_config`:**

```sql
-- Canonical DDL — matches Section 4.2 design
CREATE TABLE IF NOT EXISTS ad_slot_config (
  site_id              uuid    NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  slot_key             text    NOT NULL,

  -- Waterfall toggles
  house_enabled        boolean NOT NULL DEFAULT true,
  cpa_enabled          boolean NOT NULL DEFAULT false,
  google_enabled       boolean NOT NULL DEFAULT false,
  template_enabled     boolean NOT NULL DEFAULT true,

  -- Network adapters
  network_adapters_order text[] NOT NULL DEFAULT '{adsense}',
  network_config       jsonb   NOT NULL DEFAULT '{}',

  -- Display
  aspect_ratio         text    NOT NULL DEFAULT '16:9',
  iab_size             text,
  mobile_behavior      text    NOT NULL DEFAULT 'keep'
    CHECK (mobile_behavior IN ('keep', 'hide', 'stack')),

  -- Frequency caps
  max_per_session      int     NOT NULL DEFAULT 1,
  max_per_day          int     NOT NULL DEFAULT 3,
  cooldown_ms          int     NOT NULL DEFAULT 3600000,

  -- Metadata
  label                text    NOT NULL,
  zone                 text    NOT NULL
    CHECK (zone IN ('banner', 'rail', 'inline', 'block')),
  accepted_types       text[]  NOT NULL DEFAULT '{house,cpa}',

  -- Timestamps
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (site_id, slot_key)
);

ALTER TABLE ad_slot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_slot_config_all_service_role"
  ON ad_slot_config FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "ad_slot_config_select_auth"
  ON ad_slot_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "ad_slot_config_select_anon"
  ON ad_slot_config FOR SELECT TO anon USING (true);

CREATE INDEX IF NOT EXISTS idx_ad_slot_config_site
  ON ad_slot_config (site_id);

DROP TRIGGER IF EXISTS update_ad_slot_config_updated_at ON ad_slot_config;
CREATE TRIGGER update_ad_slot_config_updated_at
  BEFORE UPDATE ON ad_slot_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Step 6 --- CREATE TABLE `ad_revenue_daily`:**

```sql
CREATE TABLE IF NOT EXISTS ad_revenue_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  slot_key text NOT NULL,
  date date NOT NULL,
  source text NOT NULL CHECK (source IN ('house', 'cpa', 'adsense', 'prebid')),
  impressions int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  earnings_usd_cents int NOT NULL DEFAULT 0,
  ad_requests int NOT NULL DEFAULT 0,
  fill_rate numeric(5,4),
  ctr numeric(5,4),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, slot_key, date, source)
);

CREATE INDEX IF NOT EXISTS idx_ad_revenue_daily_site_date
  ON ad_revenue_daily (site_id, date DESC);
```

**Step 7 --- SEED `ad_slot_config` para site existente:**

```sql
-- Seed idempotente — matches Section 4.7 canonical seed.
-- Reuses same CROSS JOIN VALUES pattern with full column set.
INSERT INTO ad_slot_config (site_id, slot_key, label, zone, aspect_ratio, iab_size,
  house_enabled, cpa_enabled, google_enabled, template_enabled,
  mobile_behavior, accepted_types, max_per_session, max_per_day, cooldown_ms)
SELECT
  s.id,
  v.slot_key, v.label, v.zone, v.aspect_ratio, v.iab_size,
  v.house_enabled, v.cpa_enabled, v.google_enabled, v.template_enabled,
  v.mobile_behavior, v.accepted_types,
  v.max_per_session, v.max_per_day, v.cooldown_ms
FROM sites s
CROSS JOIN (VALUES
  ('banner_top',   'Banner -- Topo',      'banner', '16:9', '728x90',
    true, true, false, true, 'keep', '{house,cpa}'::text[], 1, 3, 3600000),
  ('rail_left',    'Rail esquerdo',       'rail',   '1:4',  '160x600',
    true, false, false, true, 'hide', '{house}'::text[], 1, 3, 3600000),
  ('inline_mid',   'Inline -- Meio',      'inline', '6:5',  '300x250',
    false, true, false, true, 'keep', '{cpa}'::text[], 2, 4, 1800000),
  ('rail_right',   'Rail direito',        'rail',   '6:5',  '300x250',
    false, true, false, true, 'stack', '{cpa}'::text[], 3, 6, 900000),
  ('block_bottom', 'Block -- Inferior',   'block',  '4:1',  '970x250',
    true, true, false, true, 'keep', '{house,cpa}'::text[], 1, 2, 7200000)
) AS v(slot_key, label, zone, aspect_ratio, iab_size,
       house_enabled, cpa_enabled, google_enabled, template_enabled,
       mobile_behavior, accepted_types, max_per_session, max_per_day, cooldown_ms)
WHERE s.slug = 'bythiagofigueiredo'
ON CONFLICT (site_id, slot_key) DO NOTHING;
```

**Step 8 --- DROP referencia ao slot `inline_end`:**

```sql
-- Remover creatives orfas do slot removido
DELETE FROM ad_slot_creatives
WHERE slot_key = 'inline_end';

-- Remover kill switch do slot removido
DELETE FROM kill_switches
WHERE key = 'ads_slot_inline_end';

-- Remover placeholder do slot removido
DELETE FROM ad_placeholders
WHERE slot_key = 'inline_end';
```

**Step 9 --- ADD `site_id` to `ad_events` + index para aggregation cron:**

```sql
-- ad_events usa app_id TEXT (site.slug) e slot_id TEXT. Adicionar site_id UUID
-- para joins eficientes com ad_revenue_daily e sites.
ALTER TABLE ad_events
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id) ON DELETE SET NULL;

-- Backfill site_id a partir de app_id (que e o site.slug)
UPDATE ad_events e
SET site_id = s.id
FROM sites s
WHERE e.app_id = s.slug
  AND e.site_id IS NULL;

-- Index para o cron de aggregation (query por date range)
CREATE INDEX IF NOT EXISTS idx_ad_events_created_date
  ON ad_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ad_events_site_date
  ON ad_events (site_id, created_at DESC)
  WHERE site_id IS NOT NULL;
```

**Step 10 --- Campanhas existentes preservadas:**

Nenhuma campanha existente e deletada. Novos campos em `ad_campaigns` tem defaults seguros:
- `target_categories = '{}'` --- sem filtro por categoria (exibida em todas)
- `pacing_strategy = 'even'` --- distribuicao uniforme (comportamento anterior)
- `spent_cents = 0` --- sem gasto registrado
- `variant_weight = 100` --- peso maximo (sem A/B split)

### Consumer Code Migration

Checklist ordenado para o consumer (bythiagofigueiredo):

1. **Atualizar `package.json`:**
   ```json
   {
     "@tn-figueiredo/ad-engine": "1.0.0",
     "@tn-figueiredo/ad-engine-admin": "1.0.0",
     "@tn-figueiredo/ad-components": "0.1.0"
   }
   ```
   Adicionar `ad-components` ao `transpilePackages` em `next.config.ts`.

2. **Substituir imports diretos de componentes de ad:**
   ```typescript
   // Antes (componentes locais)
   import { DoormanAd } from '@/components/ads/DoormanAd'
   import { BookmarkAd } from '@/components/ads/BookmarkAd'

   // Depois (pacote centralizado)
   import { DoormanAd, BookmarkAd, AnchorAd, MarginaliaAd, CodaAd } from '@tn-figueiredo/ad-components'
   ```

3. **Atualizar `resolve.ts` para passar `AdContext`:**
   ```typescript
   // Antes
   const creative = await resolveSlot('banner_top', locale, defaultLocale, deps)

   // Depois
   const creative = await resolveSlot('banner_top', {
     locale,
     defaultLocale,
     postCategory: post.category ?? null,
     marketingConsent: hasMarketingConsent(),
   }, deps)
   ```

4. **Wiring do consent adapter:**
   ```typescript
   // Em lib/ads/consent.ts
   import { useConsent } from '@/lib/lgpd/hooks'

   export function useAdConsent(): boolean {
     const { consents } = useConsent()
     return consents?.marketing === true
   }
   ```
   O `AdProvider` do `ad-components` recebe `marketingConsent` como prop, controlando se network adapters que requerem consent sao ativados.

5. **Mapear CSS variables:**
   ```css
   /* Em globals.css ou theme layer */
   :root {
     --ad-brand-color: var(--pb-brand-color, #1a1a1a);
     --ad-bg: var(--pb-bg, #ffffff);
     --ad-text: var(--pb-text, #1a1a1a);
     --ad-border-radius: var(--pb-radius, 8px);
     --ad-font-family: var(--pb-font-family, inherit);
   }
   ```

6. **Adicionar rota `/api/ads/events`:**
   ```typescript
   // app/api/ads/events/route.ts
   import { createAdEventsHandler } from '@tn-figueiredo/ad-engine/server'

   export const POST = createAdEventsHandler({
     supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
     supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
   })
   ```
   Recebe impressions, clicks e dismiss events do client. Rate limited por IP.

7. **Adicionar AdSense script ao layout (condicional):**
   ```typescript
   // Em app/(public)/layout.tsx
   import { AdSenseScript } from '@tn-figueiredo/ad-components/adsense'

   // Renderizar somente se org tem adsense_publisher_id e usuario deu consent
   {googleEnabled && <AdSenseScript publisherId={org.adsensePublisherId} />}
   ```

8. **Atualizar pagina admin para `ad-engine-admin@1.0.0`:**
   - `CampaignFormModal` agora aceita `targetCategories`, `pacingStrategy`, `variantGroup`, `variantWeight`
   - `SlotConfigPanel` (novo) renderiza config de slots via `ad_slot_config`
   - `RevenueDashboard` (novo) consome `ad_revenue_daily`
   - Remover referencias ao slot `inline_end` e ao componente `BowtieAd`

### Ordem de Execucao

```
1. Rodar migration SQL (Steps 1-10)
2. Deploy pacotes (ad-engine@1.0.0, ad-engine-admin@1.0.0, ad-components@0.1.0)
3. Atualizar package.json + npm install
4. Aplicar mudancas de codigo (Steps 1-8 do Code Migration)
5. Rodar npm test — validar que nenhum teste quebrou (ver Appendix F)
6. Deploy para staging → validar preview
7. Deploy para production
```

### Rollback

Se 1.0 falhar em producao:
1. Revert `package.json` para versoes 0.x
2. Migration SQL e aditiva (novos columns/tables) --- nao precisa de rollback SQL
3. Kill switches permanecem funcionais com nomes novos (nao reverter)
4. `ad_slot_config` table fica ociosa mas nao causa erro

---

## Section 10: Preview System (Admin)

### Campaign Wizard Preview

Ultimo passo do wizard de criacao de campanha: **"Preview por Slot"**.

Para cada slot selecionado na campanha, renderiza o componente correspondente do `ad-components` com os dados do formulario + dimensoes do slot. O admin ve exatamente como o ad aparecera no site antes de salvar.

### Implementacao

Preview usa um iframe com estilos isolados para evitar interferencia do CSS do admin:

1. Admin page renderiza `<iframe srcDoc={previewHtml} sandbox="allow-scripts" />` 
2. `previewHtml` inclui:
   - CSS variables do `ad-components` mapeadas para o tema do site-alvo (carregado de `sites.primary_color` + theme mapping)
   - O componente de ad renderizado com dados mock do formulario
   - Conteudo mock ao redor (titulo, paragrafo, ad, paragrafo) para contexto visual
3. Comunicacao parent-iframe via `postMessage` --- form fields propagam em tempo real

```typescript
interface PreviewMessage {
  type: 'ad-preview-update'
  payload: {
    slotKey: string
    title: string
    body: string
    ctaText: string
    ctaUrl: string
    imageUrl: string | null
    brandColor: string
    logoUrl: string | null
  }
}
```

### Simulacao de Contexto

O preview mostra o ad dentro de um layout mock de blog post:

```
+------------------------------------------+
|  [Mock nav bar]                          |
+------------------------------------------+
|                                          |
|  Mock Title: "Exemplo de artigo"         |
|                                          |
|  Lorem ipsum dolor sit amet, consectetur |
|  adipiscing elit. Sed do eiusmod tempor  |
|  incididunt ut labore et dolore magna.   |
|                                          |
|  +====================================+ |
|  |       === SEU AD AQUI ===          | |
|  |  (renderizado com dados reais      | |
|  |   do formulario)                   | |
|  +====================================+ |
|                                          |
|  Ut enim ad minim veniam, quis nostrud   |
|  exercitation ullamco laboris nisi ut.   |
|                                          |
+------------------------------------------+
|  [Mock footer]                           |
+------------------------------------------+
```

Isso da ao admin uma nocao de como o ad aparece in-situ, nao isolado.

### Validacoes Visuais

| Condicao | Severidade | Comportamento |
|---|---|---|
| Imagem com aspect ratio errado para o slot | Warning (amarelo) | Mostra preview com `object-fit: cover` + tooltip explicando o crop |
| Titulo longo demais para o slot | Warning (amarelo) | Preview com truncation + tooltip mostrando texto completo |
| CTA URL invalida (nao `https://`) | Erro (vermelho) | Bloqueia save, campo marcado com borda vermelha |
| Imagem abaixo da dimensao minima | Warning (amarelo) | Mostra dimensoes recomendadas |
| Campos obrigatorios faltando | Desabilitado | Preview desabilitado com helper text indicando campos faltantes |
| Imagem nao carrega (404/timeout) | Warning (amarelo) | Placeholder cinza com icone de imagem quebrada |

Validacoes sao client-side (feedback instantaneo) + server-side (guard no save action).

### Guia de Aspect Ratio por Slot

Ao selecionar slots no wizard, cada slot card mostra informacoes visuais:

| Slot | Zona | Dimensoes recomendadas | Aspect Ratio | Mobile |
|---|---|---|---|---|
| `banner_top` (DoormanAd) | banner | 728 x 90 px | 8:1 | keep |
| `rail_left` (MarginaliaAd) | rail | 240 x 320 px | 3:4 | hide |
| `inline_mid` (BookmarkAd) | inline | 640 x 200 px | 16:5 | keep |
| `rail_right` (AnchorAd) | rail | 240 x 400 px | 3:5 | stack |
| `block_bottom` (CodaAd) | block | 640 x 260 px | 32:13 | keep |

Cada card inclui:
- Nome do slot + zona (badge colorido)
- Retangulo proporcional colorido mostrando as proporcoes visuais
- Lista de paginas onde o slot aparece (ex: "Blog posts, Campanhas")
- Status de preenchimento atual: quantas campanhas ativas ocupam este slot

### Componente `SlotPreviewCard`

```typescript
interface SlotPreviewCardProps {
  slotKey: string
  label: string
  zone: 'banner' | 'rail' | 'inline' | 'block'
  recommendedWidth: number
  recommendedHeight: number
  mobileBehavior: 'hide' | 'keep' | 'stack'
  activeCampaignCount: number
  isSelected: boolean
  onToggle: (slotKey: string) => void
}
```

Exportado por `@tn-figueiredo/ad-engine-admin@1.0.0` para reuso cross-consumer.

### Fallback de Preview

Quando nao ha componente de preview registrado para um slot (ex: futuro slot custom), `<SlotPreviewFallback>` renderiza com dimensoes inferidas da zona:

| Zona | Container do preview |
|---|---|
| `banner` | Full-width, height ~80px |
| `rail` | Width ~240px, height ~320px |
| `inline` | Content-width (~640px), height ~200px |
| `block` | Content-width (~640px), height ~260px |

---

## Section 11: AdSense Revenue Import

### Arquitetura

Google AdSense Management API v2 (REST, OAuth2) fornece metricas diarias por ad unit:

| Metrica | Descricao |
|---|---|
| `IMPRESSIONS` | Visualizacoes do anuncio |
| `CLICKS` | Cliques no anuncio |
| `ESTIMATED_EARNINGS` | Receita estimada (USD) |
| `PAGE_VIEWS` | Page views da pagina contendo o ad |
| `AD_REQUESTS_COVERAGE` | Taxa de preenchimento (fill rate) |

Granularidade: por ad unit ID = por slot por site. Dados disponiveis com T-1 de atraso (ontem).

### Cron Job

**Rota:** `/api/cron/adsense-sync`
**Schedule:** `0 6 * * *` (06:00 UTC = 03:00 BRT)
**Auth:** `Authorization: Bearer ${CRON_SECRET}`

**Fluxo:**

```
1. Auth
   └─ Ler organizations.adsense_refresh_token_enc
   └─ Decryptar com AES-256-GCM (key: ADSENSE_ENCRYPTION_KEY)
   └─ POST https://oauth2.googleapis.com/token
      body: { grant_type: 'refresh_token', refresh_token, client_id, client_secret }
   └─ Receber access_token (TTL ~1h)

2. Fetch
   └─ GET https://adsense.googleapis.com/v2/accounts/{pubId}/reports:generate
      params:
        dimensions: DATE, AD_UNIT_CODE
        metrics: IMPRESSIONS, CLICKS, ESTIMATED_EARNINGS, PAGE_VIEWS, AD_REQUESTS_COVERAGE
        dateRange.startDate: yesterday (YYYY-MM-DD)
        dateRange.endDate: yesterday (YYYY-MM-DD)
      headers: Authorization: Bearer {access_token}

3. Map
   └─ Para cada row do report:
      └─ ad_unit_code → lookup em ad_slot_config.network_config->'adsense'->>'adUnitId'
      └─ Match found → slot_key identificado
      └─ Match not found → log warning, skip row

4. Store
   └─ UPSERT into ad_revenue_daily:
      ON CONFLICT (site_id, slot_key, date, source) DO UPDATE
      SET impressions = EXCLUDED.impressions,
          clicks = EXCLUDED.clicks,
          earnings_usd_cents = EXCLUDED.earnings_usd_cents,
          ad_requests = EXCLUDED.ad_requests,
          fill_rate = EXCLUDED.fill_rate,
          ctr = EXCLUDED.ctr

5. Update org status
   └─ UPDATE organizations
      SET adsense_last_sync_at = now(),
          adsense_sync_status = 'ok'

6. Error handling
   └─ On failure:
      UPDATE organizations SET adsense_sync_status = 'error'
      Sentry.captureException(error, {
        tags: { component: 'adsense-sync', org_id }
      })
```

### Fluxo de Setup OAuth2 (one-time no admin)

```
Admin                          Server                         Google
  |                              |                              |
  |-- Clica "Conectar AdSense" -->|                              |
  |                              |-- Gera OAuth2 URL ----------->|
  |                              |   scope: adsense.readonly     |
  |<-- Redirect para Google -----|                              |
  |                              |                              |
  |-- Consent screen ----------->|                              |
  |                              |                              |
  |<-- Callback com auth code ---|<-- authorization_code -------|
  |                              |                              |
  |                              |-- POST /token --------------->|
  |                              |   { code, redirect_uri }      |
  |                              |<-- { access_token,            |
  |                              |     refresh_token } ----------|
  |                              |                              |
  |                              |-- Encrypt refresh_token       |
  |                              |   AES-256-GCM                 |
  |                              |-- Store in organizations      |
  |                              |   adsense_refresh_token_enc   |
  |                              |   adsense_connected_at=now()  |
  |                              |   adsense_sync_status='ok'    |
  |                              |                              |
  |<-- "AdSense conectado!" -----|                              |
```

**Rotas do OAuth2:**

| Rota | Metodo | Descricao |
|---|---|---|
| `/api/adsense/authorize` | GET | Gera URL de autorizacao e redireciona para Google |
| `/api/adsense/callback` | GET | Recebe authorization code, troca por tokens, salva |
| `/api/adsense/disconnect` | POST | Remove tokens, reseta status para `'disconnected'` |
| `/api/adsense/status` | GET | Retorna status da conexao + ultimo sync |

### Encriptacao do Refresh Token

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex') // 32 bytes
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: base64(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

function decrypt(encoded: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex')
  const buf = Buffer.from(encoded, 'base64')
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext) + decipher.final('utf8')
}
```

### Variaveis de Ambiente (novas)

| Variavel | Obrigatoria | Descricao |
|---|---|---|
| `GOOGLE_ADSENSE_CLIENT_ID` | Sim (se AdSense habilitado) | OAuth2 client ID do Google Cloud Console |
| `GOOGLE_ADSENSE_CLIENT_SECRET` | Sim (se AdSense habilitado) | OAuth2 client secret |
| `ADSENSE_ENCRYPTION_KEY` | Sim (se AdSense habilitado) | 32-byte hex key para AES-256-GCM (64 caracteres hex) |
| `GOOGLE_ADSENSE_REDIRECT_URI` | Sim (se AdSense habilitado) | URL de callback (ex: `https://bythiagofigueiredo.com/api/adsense/callback`) |

Gerar `ADSENSE_ENCRYPTION_KEY`:
```bash
openssl rand -hex 32
```

### Integracao com Dashboard

Com a tabela `ad_revenue_daily` unificada, o dashboard de ads exibe:

**KPI Cards (30 dias):**

| Card | Calculo |
|---|---|
| Receita total | `SUM(earnings_usd_cents) / 100` formatado em USD |
| Impressoes totais | `SUM(impressions)` across all sources |
| CTR medio | `SUM(clicks) / NULLIF(SUM(impressions), 0)` |
| Fill rate | `AVG(fill_rate)` (somente source='adsense') |

**Graficos:**

1. **Stacked area chart** --- receita por source (house, cpa, adsense) ao longo do tempo (30d)
2. **Bar chart** --- impressoes por slot (agrupado por source)
3. **Tabela drill-down** --- filtravel por slot, categoria, campanha, periodo

**Query de agregacao:**

```sql
SELECT
  date,
  source,
  SUM(impressions) AS impressions,
  SUM(clicks) AS clicks,
  SUM(earnings_usd_cents) AS earnings_cents,
  AVG(fill_rate) AS avg_fill_rate
FROM ad_revenue_daily
WHERE site_id = $1
  AND date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date, source
ORDER BY date DESC, source;
```

### Conciliacao House/CPA

Para ads house e CPA (nao-AdSense), `ad_revenue_daily` e populada pelo event tracking existente:

- Source `'house'`: impressions e clicks agregados de `ad_events` diariamente. Earnings = 0 (ads proprios).
- Source `'cpa'`: impressions e clicks de `ad_events` + earnings baseado no CPC/CPM configurado na campanha.

Cron `/api/cron/ad-revenue-aggregate` (diario, `0 7 * * *`) agrega eventos do dia anterior para `ad_revenue_daily`:

```sql
-- Nota: ad_events usa colunas (slot_id TEXT, app_id TEXT, ad_id UUID FK→ad_campaigns).
-- Migration 1.0 adiciona ad_events.site_id (UUID FK→sites) — ver Step 9 abaixo.
-- ad_campaigns usa pricing_value NUMERIC + pricing_model TEXT (nao cpc_cents).
INSERT INTO ad_revenue_daily (site_id, slot_key, date, source, impressions, clicks, earnings_usd_cents)
SELECT
  e.site_id,
  e.slot_id AS slot_key,
  e.created_at::date AS date,
  CASE WHEN c.type = 'house' THEN 'house' ELSE 'cpa' END AS source,
  COUNT(*) FILTER (WHERE e.event_type = 'impression') AS impressions,
  COUNT(*) FILTER (WHERE e.event_type = 'click') AS clicks,
  COALESCE(
    SUM(CASE
      WHEN e.event_type = 'click' AND c.type = 'cpa' AND c.pricing_model = 'cpc'
      THEN (c.pricing_value * 100)::int  -- pricing_value em USD → cents
      ELSE 0
    END),
    0
  ) AS earnings_usd_cents
FROM ad_events e
JOIN ad_campaigns c ON c.id = e.ad_id
WHERE e.created_at::date = CURRENT_DATE - INTERVAL '1 day'
  AND e.site_id IS NOT NULL
GROUP BY e.site_id, e.slot_id, date, source
ON CONFLICT (site_id, slot_key, date, source) DO UPDATE
SET impressions = EXCLUDED.impressions,
    clicks = EXCLUDED.clicks,
    earnings_usd_cents = EXCLUDED.earnings_usd_cents;
```

---

## Section 12: Multi-Network Adapter (Header Bidding Ready)

### `IAdNetworkAdapter` Interface

Em vez de hardcodar Google AdSense, `ad-engine@1.0.0` define uma interface generica que qualquer ad network implementa:

```typescript
interface IAdNetworkAdapter {
  /** Identificador unico do adapter */
  readonly id: string  // 'adsense' | 'prebid' | 'carbon' | 'custom'

  /** Nome de exibicao para admin UI */
  readonly displayName: string

  /** Carrega o script da network (chamado uma vez por page load) */
  loadScript(config: NetworkConfig): Promise<void>

  /** Renderiza um ad no container element */
  renderAd(container: HTMLElement, slot: AdSlotConfig): Promise<AdFillResult>

  /** Verifica se o script da network carregou com sucesso */
  isAvailable(): boolean

  /** Este adapter requer consent de marketing cookies? */
  readonly requiresConsent: boolean

  /** Timeout antes de desistir e tentar o proximo adapter (ms) */
  readonly fillTimeoutMs: number

  /** Opcional: reportar dados de receita */
  fetchRevenue?(dateRange: DateRange): Promise<RevenueReport[]>
}
```

**Tipos auxiliares:**

```typescript
type AdFillResult =
  | { filled: true; networkId: string }
  | { filled: false; reason: 'no_fill' | 'timeout' | 'blocked' | 'error' }

type NetworkConfig = {
  publisherId?: string
  adUnitId?: string
  customParams?: Record<string, unknown>
}

type DateRange = {
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
}

type RevenueReport = {
  date: string
  slotKey: string
  impressions: number
  clicks: number
  earningsUsdCents: number
}
```

### Adapters Embutidos

#### AdSenseAdapter (Day-1)

| Campo | Valor |
|---|---|
| `id` | `'adsense'` |
| `displayName` | `'Google AdSense'` |
| `requiresConsent` | `true` |
| `fillTimeoutMs` | `3000` |

```typescript
class AdSenseAdapter implements IAdNetworkAdapter {
  readonly id = 'adsense'
  readonly displayName = 'Google AdSense'
  readonly requiresConsent = true
  readonly fillTimeoutMs = 3000

  private loaded = false

  async loadScript(config: NetworkConfig): Promise<void> {
    if (this.loaded) return
    const script = document.createElement('script')
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.publisherId}`
    script.async = true
    script.crossOrigin = 'anonymous'
    script.onerror = () => { this.loaded = false }
    document.head.appendChild(script)
    await new Promise<void>((resolve, reject) => {
      script.onload = () => { this.loaded = true; resolve() }
      script.onerror = () => reject(new Error('AdSense script failed to load'))
    })
  }

  async renderAd(container: HTMLElement, slot: AdSlotConfig): Promise<AdFillResult> {
    if (!this.isAvailable()) {
      return { filled: false, reason: 'blocked' }
    }
    const ins = document.createElement('ins')
    ins.className = 'adsbygoogle'
    ins.style.display = 'block'
    ins.dataset.adClient = slot.network_config?.adsense?.publisherId ?? ''
    ins.dataset.adSlot = slot.network_config?.adsense?.adUnitId ?? ''
    ins.dataset.adFormat = 'auto'
    ins.dataset.fullWidthResponsive = 'true'
    container.appendChild(ins)

    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      return { filled: true, networkId: 'adsense' }
    } catch {
      return { filled: false, reason: 'error' }
    }
  }

  isAvailable(): boolean {
    return this.loaded && typeof window.adsbygoogle !== 'undefined'
  }
}
```

**Deteccao de ad blocker:** `loadScript()` captura `onerror` no `<script>` tag. Se o script falhar (bloqueado por extensao), `isAvailable()` retorna `false` e o waterfall avanca para o proximo adapter.

#### PrebidAdapter (Futuro --- Sprint N)

| Campo | Valor |
|---|---|
| `id` | `'prebid'` |
| `displayName` | `'Prebid.js (Header Bidding)'` |
| `requiresConsent` | `true` |
| `fillTimeoutMs` | `2000` |

Funcionalidade planejada:
- `loadScript()`: Carrega bundle `prebid.js` com bidders configurados
- `renderAd()`: Chama `pbjs.requestBids()` com bidders do slot, renderiza bid vencedor
- Suporta: AppNexus, Rubicon, Index Exchange, OpenX, entre outros
- Header bidding = maior CPM vence

Nao implementado no 1.0. Interface reservada para extensao futura. `ad_slot_config.network_config` ja comporta config de prebid:

```json
{
  "prebid": {
    "bidders": [
      { "bidder": "appnexus", "params": { "placementId": 123 } },
      { "bidder": "rubicon", "params": { "accountId": 456, "siteId": 789 } }
    ]
  }
}
```

#### CustomAdapter (Ponto de Extensao)

Qualquer ad network futura implementa `IAdNetworkAdapter` e registra com o `AdProvider` do `ad-components`:

```typescript
import { AdProvider } from '@tn-figueiredo/ad-components'
import { MyCustomAdapter } from './my-custom-adapter'

<AdProvider
  adapters={[
    new AdSenseAdapter(),
    new MyCustomAdapter(),  // implementa IAdNetworkAdapter
  ]}
  consent={marketingConsent}
>
  {children}
</AdProvider>
```

### Waterfall v2 com Adapters

Fluxo completo de resolucao de slot, combinando server-side (house/CPA) e client-side (network adapters):

```
resolveSlot(slot, context) -> {
  1. Kill switch check
     └─ kill_switches WHERE id = 'ads_slot_{slot_key}' AND enabled = false
     └─ Se desabilitado → EMPTY (slot nao renderiza)

  2. House campaigns (server, priority sorted)
     └─ ad_campaigns WHERE type='house' AND status='active'
        AND (target_categories = '{}' OR target_categories && ARRAY[context.postCategory])
     └─ Ordenado por: priority DESC, created_at DESC
     └─ Se encontrou → return { source: 'house', renderClient: false, creative }

  3. CPA campaigns (server, priority sorted)
     └─ ad_campaigns WHERE type='cpa' AND status='active'
        AND within schedule AND budget not exhausted
        AND (target_categories = '{}' OR target_categories && ARRAY[context.postCategory])
     └─ Pacing: even=uniform, front_loaded=70% first half, asap=no throttle
     └─ Se encontrou → return { source: 'cpa', renderClient: false, creative }

  4. Network adapters (client-side, ordered)
     └─ Ler ad_slot_config.network_adapters_order (ex: ['adsense', 'prebid'])
     └─ Para cada adapter na ordem:
        a. Se !enabled no config → skip
        b. Se adapter.requiresConsent && !context.marketingConsent → skip
        c. result = await Promise.race([
             adapter.renderAd(container, slotConfig),
             timeout(adapter.fillTimeoutMs)
           ])
        d. Se result.filled → return { source: adapter.id, renderClient: true }
        e. Se !filled → log reason, try next adapter

  5. Template fallback (always available)
     └─ ad_placeholders WHERE slot_key = slot AND is_enabled = true
     └─ Se encontrou → return { source: 'template', renderClient: false, placeholder }

  6. EMPTY — slot nao renderiza nada
}
```

**Diferenca fundamental server vs client:**
- Steps 1-3 e 5 rodam no servidor (SSR). HTML chega pronto no response.
- Step 4 roda no cliente (browser). Container placeholder e renderizado no SSR, adapter preenche no `useEffect`.

Isso significa que ads house/CPA tem zero CLS (Cumulative Layout Shift) pois sao SSR. Ads de network (AdSense) tem CLS controlado pelo container placeholder com dimensoes reservadas via CSS.

### Suporte no Banco de Dados

Colunas em `ad_slot_config` para configuracao de adapters:

```sql
-- Ja criadas no Step 5 da migration (Section 9)
network_adapters_order TEXT[] NOT NULL DEFAULT '{adsense}',
network_config JSONB NOT NULL DEFAULT '{}'
```

**`network_adapters_order`** --- cadeia de fallback ordenada. Posicao no array = prioridade. Somente adapters listados aqui sao tentados para o slot.

**`network_config`** --- configuracao por adapter por slot. Chave do JSON = adapter ID.

Exemplo completo para um slot com AdSense + Prebid:

```json
{
  "adsense": {
    "publisherId": "ca-pub-1234567890",
    "adUnitId": "9876543210",
    "format": "auto",
    "fullWidthResponsive": true
  },
  "prebid": {
    "bidders": [
      {
        "bidder": "appnexus",
        "params": { "placementId": 12345 }
      },
      {
        "bidder": "rubicon",
        "params": { "accountId": 111, "siteId": 222, "zoneId": 333 }
      }
    ],
    "timeout": 1500
  }
}
```

### Admin UI --- Configuracao de Network por Slot

Em **Settings > Ads > Configuracao de Slots**, cada slot mostra uma lista ordenada de fontes de ads:

```
+------------------------------------------------------------+
|  banner_top — Banner Topo                                  |
|                                                            |
|  Ordem de preenchimento:                                   |
|                                                            |
|  [1] House Ads          [ON]  [drag handle]                |
|  [2] CPA Ads            [ON]  [drag handle]                |
|  [3] Google AdSense     [ON]  [drag handle]                |
|      Ad Unit ID: [1234567890        ]                      |
|      Timeout: [3000] ms                                    |
|  [4] Prebid.js          [OFF] [drag handle]                |
|      (Configurar ao ativar)                                |
|  --- Template (fallback final, sempre ativo) ---           |
|                                                            |
|  [Salvar configuracao]                                     |
+------------------------------------------------------------+
```

**Comportamento:**
- Drag-and-drop para reordenar prioridade de adapters
- Template sempre ultimo (nao reordenavel, nao desativavel)
- Toggle ON/OFF por adapter por slot
- Campos de configuracao expandem ao ativar um adapter
- Salvar atualiza `ad_slot_config.network_adapters_order` e `ad_slot_config.network_config`

**Tipo do formulario:**

```typescript
interface SlotNetworkConfigForm {
  slotKey: string
  adapters: Array<{
    id: string           // 'house' | 'cpa' | 'adsense' | 'prebid'
    enabled: boolean
    order: number        // posicao na lista (1-based)
    config: Record<string, unknown>  // campos especificos do adapter
  }>
}
```

### Registro de Adapters

`ad-engine@1.0.0` exporta um registry de adapters built-in:

```typescript
import { AdSenseAdapter } from '@tn-figueiredo/ad-engine/adapters'

export const BUILTIN_ADAPTERS: readonly IAdNetworkAdapter[] = [
  new AdSenseAdapter(),
]

// Consumer pode estender:
export function createAdapterRegistry(
  custom: IAdNetworkAdapter[] = []
): Map<string, IAdNetworkAdapter> {
  const all = [...BUILTIN_ADAPTERS, ...custom]
  return new Map(all.map(a => [a.id, a]))
}
```

O `AdProvider` do `ad-components` aceita o registry e usa para resolver o step 4 do waterfall:

```typescript
<AdProvider
  adapters={createAdapterRegistry([/* custom adapters */])}
  consent={marketingConsent}
  slotConfigs={slotConfigs}  // ad_slot_config rows do DB
>
  {children}
</AdProvider>
```

### Metricas e Observabilidade

Cada tentativa de adapter e rastreada:

```typescript
interface AdapterAttemptLog {
  slotKey: string
  adapterId: string
  result: 'filled' | 'no_fill' | 'timeout' | 'blocked' | 'error' | 'skipped_consent'
  durationMs: number
  timestamp: number
}
```

Logs enviados para `/api/ads/events` com `event_type = 'adapter_attempt'` para analise de fill rate por adapter. Dashboard mostra:

| Metrica | Descricao |
|---|---|
| Fill rate por adapter | % de tentativas que resultaram em `filled` |
| Timeout rate | % de tentativas que deram timeout |
| Ad blocker rate | % de tentativas com `reason: 'blocked'` |
| Waterfall depth medio | Quantos adapters sao tentados em media antes de fill |
| Latencia media por adapter | `durationMs` medio por adapter ID |

---

## Appendix A: Current Bugs Fixed

All bugs identified in the 32/100 quality audit are resolved by this design.

| # | Bug | Severity | Root Cause | Fix |
|---|-----|----------|------------|-----|
| 1 | Kill switch logic inverted (`resolve.ts:49`) | CRITICAL | `if (!killMaster?.enabled)` returns empty when `kill_ads` is enabled (which means "kill switch is ON"), but the logic treats `enabled=true` as "ads should show" | Rewrite to `if (killMaster?.enabled)` --- `enabled=true` means "kill switch is active, hide ads" |
| 2 | Zero impression/click tracking | CRITICAL | No client-side code fires events to the API | `useAdSlot()` hook with `IntersectionObserver` (impressions) + Beacon API (clicks) |
| 3 | Kill switch seed uses old slot names | HIGH | Migration `20260501000023` seeds `article_top` etc. but code expects `banner_top` | Migration renames old slot names to new canonical names |
| 4 | BowtieAd form submission does nothing | MEDIUM | `setSubmitted(true)` but never sends data | Slot removed (`inline_end` dropped). Form interaction moved to campaign CTA type |
| 5 | `app_id` hardcoded as `'bythiagofigueiredo'` | MEDIUM | String literal in 7+ files | Configurable via `AdEngineConfig`, sourced from site context |
| 6 | `uploadMedia`/`deleteMedia` throw "Not implemented" | MEDIUM | Stub functions never completed | Full implementation with Supabase Storage |
| 7 | No validation on campaign CRUD | MEDIUM | Accepts any `CampaignFormData` without checks | Zod validation: schedule, URLs, priority, dimensions |
| 8 | Campaign columns never updated (`impressions_delivered`, `clicks_delivered`) | MEDIUM | Dead columns with no write path | Replaced by `ad_revenue_daily` table + real tracking pipeline |
| 9 | MarginaliaAd body truncation at first period | LOW | `body.split('.')[0]` arbitrary cut | Component redesigned in `ad-components` with proper `text-overflow: ellipsis` |
| 10 | `Promise.allSettled` swallows errors in admin dashboard | LOW | Errors treated as nulls silently | Error logging + user-facing error state per widget |

---

## Appendix B: Environment Variables (New)

| Variable | Required | Purpose |
|----------|----------|---------|
| `GOOGLE_ADSENSE_CLIENT_ID` | When Google Ads enabled | OAuth2 client ID from Google Cloud Console |
| `GOOGLE_ADSENSE_CLIENT_SECRET` | When Google Ads enabled | OAuth2 client secret |
| `ADSENSE_ENCRYPTION_KEY` | When Google Ads enabled | 32-byte hex key for AES-256-GCM encryption of refresh tokens at rest |
| `GOOGLE_ADSENSE_REDIRECT_URI` | When Google Ads enabled | OAuth2 callback URL (e.g. `https://bythiagofigueiredo.com/api/adsense/callback`) |

---

## Appendix C: Feature Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `AD_ENGINE_ENABLED` | `true` | Master kill switch (replaces `kill_switches` table entry) |
| `AD_GOOGLE_ENABLED` | `false` | Global Google Ads toggle (still requires per-slot config in admin) |
| `AD_TRACKING_ENABLED` | `true` | Enable/disable impression and click tracking |
| `AD_REVENUE_SYNC_ENABLED` | `false` | Enable AdSense Management API revenue cron sync |

All flags are read from environment variables. Configure in `apps/web/.env.local` for development and Vercel Environment Variables for production. The `AD_ENGINE_ENABLED=false` state causes all `<AdSlot>` components to render nothing (no skeleton, no network request). The `AD_GOOGLE_ENABLED` and `AD_REVENUE_SYNC_ENABLED` flags default to `false` because they require Google Cloud credentials to function.

---

## Appendix D: Slot Reference

| Slot Key | Component | IAB Size | Pixels | Aspect Ratio | Zone | Mobile | Accepted Types |
|----------|-----------|----------|--------|--------------|------|--------|----------------|
| `banner_top` | `AdBanner` | Leaderboard | 728x90 | ~8:1 | banner | keep | house, cpa |
| `rail_left` | `AdRail` | Wide Skyscraper | 160x600 | ~1:4 | rail | hide | house |
| `inline_mid` | `AdInline` | Medium Rectangle | 300x250 | ~6:5 | inline | keep | cpa |
| `rail_right` | `AdRail` | Medium Rectangle | 300x250 | ~6:5 | rail | stack | cpa |
| `block_bottom` | `AdBlock` | Billboard | 970x250 | ~4:1 | block | keep | house, cpa |

**Mobile behavior:**

- **keep** --- slot renders at full width, aspect ratio preserved via `aspect-ratio` CSS.
- **hide** --- slot not rendered below the `md` breakpoint (768px). Skeleton placeholder also hidden.
- **stack** --- slot moves from sidebar rail into the main content flow, rendered between content sections.

**Accepted types:**

- **house** --- internal campaigns managed in the CMS admin.
- **cpa** --- cost-per-action campaigns (affiliate, sponsor) with click-through tracking.

Network ads (AdSense) can fill any slot regardless of accepted type --- the waterfall falls through to network adapters after house/CPA campaigns are exhausted.

---

## Appendix E: Cron Jobs (New/Modified)

| Cron | Schedule | Purpose | Gate |
|------|----------|---------|------|
| `/api/cron/adsense-sync` | `0 6 * * *` (06:00 UTC daily) | Import T-1 revenue data from AdSense Management API into `ad_revenue_daily` | `AD_REVENUE_SYNC_ENABLED` |
| `/api/cron/ad-events-aggregate` | `0 3 * * *` (03:00 UTC daily) | Aggregate raw `ad_events` into `ad_revenue_daily` for house/CPA campaigns | `AD_TRACKING_ENABLED` |

Both crons require `Authorization: Bearer ${CRON_SECRET}` (same pattern as existing crons). Each checks its feature flag gate at the top of the handler and returns `200 { skipped: true }` when disabled. The aggregation cron runs before the AdSense sync to ensure house/CPA data is settled before network data arrives, avoiding partial-day conflicts in the daily rollup.

---

## Appendix F: Testing Strategy

Convenção do projeto: `npm test` deve passar antes de qualquer task ser reportada como completa (CLAUDE.md). Testes usam Vitest. DB-gated tests usam `describe.skipIf(skipIfNoLocalDb())`.

### Unit Tests (`@tn-figueiredo/ad-engine`)

| Suite | O que testa | DB? |
|---|---|---|
| `resolveSlot()` | Waterfall order (house → CPA → network → template → empty), kill switch bypass, category filtering, schedule filtering | No |
| `matchesCategory()` | Empty array = all, exact match, no-match, null postCategory | No |
| `pacingAllows()` | even/front_loaded/asap strategies, edge cases (day 1, last day, over budget) | No |
| `selectWinner()` | Priority sort, relevance score tiebreak, A/B variant assignment (deterministic murmurhash) | No |
| `assignVariant()` | Weight distribution, single variant (100%), edge buckets (0, 99) | No |
| `canShowAd()` | Frequency cap: cooldown, daily reset, session cap | No |

### Unit Tests (`@tn-figueiredo/ad-components`)

| Suite | O que testa | DB? |
|---|---|---|
| `useAdSlot()` | IntersectionObserver mock: fires impression after 1s visible, dedup via sessionStorage, click tracking | No |
| `useAdConsent()` | Adapter subscription, consent change propagation, default state (loaded=false) | No |
| `AdBanner/Rail/Inline/Block` | Render with creative data, dismiss callback, accessibility (role, aria-label), skeleton state | No |
| `queueEvent/flushEvents` | Batching (2s), visibilitychange flush, sendBeacon fallback | No |
| `observeGoogleFill` | MutationObserver mock: fill detected, 3s timeout nofill, cleanup on unmount | No |

### Integration Tests (DB-gated, `apps/web/test/integration/`)

| Suite | O que testa | DB? |
|---|---|---|
| `ad_slot_config` CRUD | INSERT/SELECT/UPDATE via service-role, RLS (anon can SELECT, cannot INSERT) | Yes |
| `ad_revenue_daily` aggregation | UPSERT idempotency, ON CONFLICT update, date range queries | Yes |
| `ad_campaigns` targeting | GIN index query with `@>` operator, empty array matches all | Yes |
| Kill switch rename | Migration idempotency, old names → new names, seed of new switches | Yes |

### E2E Tests (Playwright, `apps/web/e2e/`)

| Spec | O que testa |
|---|---|
| `ads-render.spec.ts` | House ad renders in blog post, template fallback when no campaign, dismiss persists |
| `ads-admin.spec.ts` | Campaign wizard: create → preview → save, slot config toggles, dashboard loads without errors |
| `ads-consent.spec.ts` | Google Ad slot shows skeleton when no consent, shows template after revoke |

### Test Doubles

- **IntersectionObserver**: Mock via `vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)` — simula `isIntersecting: true` após delay configurável.
- **navigator.sendBeacon**: Mock que captura chamadas para assertions em batch tests.
- **MutationObserver**: Mock que dispara `addedNodes` on demand para simular Google fill.
- **Supabase client**: Real client contra DB local para integration tests. Service-role para setup/teardown, anon para RLS assertions.

### Coverage targets

| Package | Target |
|---|---|
| `ad-engine` (core logic) | 90%+ line coverage |
| `ad-components` (hooks + rendering) | 80%+ line coverage |
| `ad-engine-admin` (RSC components) | 70%+ (admin UI less critical) |
| Integration tests | Every new table + RLS policy + migration |
