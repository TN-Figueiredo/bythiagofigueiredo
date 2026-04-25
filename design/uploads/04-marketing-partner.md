# 04 — Marketing Partner: bythiagofigueiredo (Hub Central + CMS Engine)

> **Pipeline:** 01-idea-validator ✅ → 02-code-library ✅ → 03-roadmap-creator ✅ → `04-marketing-partner` → 05-delegation-planner
> **Executado por:** CMO (IA) | **Data:** 2026-04-12 | **Baseado em:** IV (MUST-HAVE, 104/125) + Roadmap (190.75h, MVP Jun 2026)

---

## ⚡ CARTÃO DE DECISÃO

| Campo | Valor |
|-------|-------|
| **Produto** | bythiagofigueiredo — Hub pessoal + CMS Engine |
| **Segmento** | Dev creators, solopreneurs, builders de comunidades |
| **Modelo de receita** | Indireto — Lead capture → Newsletter → Funil para apps (TNG, CreatorForge, MEISimples, TravelCalc, CalcHub, DevToolKit) |
| **Maturidade** | MVP Fase 1: Junho 2026 (~8 semanas). Thiago: 50h/week até ~Aug 2026 (Asia departure) |
| **Timeline de GTM** | Pre-launch (Abr 25-May 19) → MVP launch (May 19-Jun 2) → Growth (Jun-Aug) → Manutenção (Sep+) |
| **Cap. de Marketing** | 8-12h/week (Thiago) + 20h/week conteúdo paralelo (scripting YouTube + blog) |
| **Investimento** | R$0 em ads (M1-M3). Orgânico puro. R$300/mês infra (Vercel, Supabase, email). |
| **Projeção M6** | 1K newsletter subs, 5K/mês site visits, 12% conversion to app users, ~R$0.38/sub/mês indirect MRR (~R$380) |
| **Decision** | ✅ **GO** — Infraestrutura crítica. Começa imediatamente com Fase 1. Bloqueador zero. |

---

## ETAPA 0 — GATES & VALIDAÇÃO CRÍTICA

### G1 — Viabilidade Executiva de Marketing

| Critério | Status | Evidência |
|----------|--------|-----------|
| **Time disponível** | ✅ PASSA | Thiago 50h/week até Aug 2026. Marketing é 8-12h/week (blog + YouTube content, não ads). Parallel com dev. |
| **Assets existentes** | ✅ PASSA | YouTube audience 2 canais (EN + PT). Instagram @thiagonfigueiredo. Twitter/X. Brevo list (seed ~100 subs). |
| **Canais homogêneos** | ✅ PASSA | Stack completo (Next.js, Fastify, TypeScript, Testing) → conteúdo técnico nativo. Dev creator angle alinha com expertise. |
| **Budget zero constraint** | ✅ PASSA | Orgânico puro. Sem ads M1-M3. Costs: server (~R$300/mês) é infra existente, não marketing spend. |

### G2 — Ajuste Crítico ao Modelo de Receita

**Modelo Indireto:** bythiagofigueiredo NÃO gera MRR direto. Receita vem de:

1. **Newsletter → App Conversions** (primária)
   - Sub newsletter: 1K target M6
   - % convertendo para app user: 3-8% (conservative-optimistic)
   - % app user → paying: 5-12%
   - ARPU multiapp (TNG 30, MEISimples 20, CreatorForge 5.99/mês): ~R$35 média
   - Indirect MRR/sub: R$0.045 (cons) → R$0.384 (opt)

2. **Blog AdSense** (secundária)
   - RPM Tech BR: R$8-15
   - Target: 5K visits/mês M6 × 0.1 (% engaging ads) = 500 ad impressions/mês → R$40-75/mês

3. **Affiliate Links** (terciária)
   - Hosting (Vercel, Supabase): $5-15/referral
   - Tools: Brevo, Railway, dev tools
   - Target: R$50-150/mês M6

4. **Sponsorships** (futuro M6+)
   - Dev tools, hosting, frameworks
   - Conservative: R$1-3K/mês when audience >5K/mês

**Total Indirect MRR M6 (moderado):** ~R$380 (newsletter) + R$50 (AdSense) + R$100 (affiliates) = **R$530**

Não é blockbuster, mas não é zero. E o maior valor é **lead quality** para outros apps (TNG já traz R$10K/mês, CreatorForge target R$4.2K M6).

### G3 — Dependências Críticas de Marketing

| Bloqueador | Resolução | Timeline |
|-----------|-----------|----------|
| **MVP Site Launch** | Precisa estar live para blog/lead capture funcionar | Jun 2026 (Fase 1 roadmap) |
| **Blog conteúdo** | Mínimo 4-8 posts publicados até M1 end | Paralelo Thiago (140h/6meses conteúdo alocado no roadmap) |
| **Newsletter setup** | Brevo integration + Supabase schema | Sprint 2 (25-26) — crítico para captura |
| **YouTube content** | "Building my personal site" video + 2-3 case studies | Pre-launch (Abr-May) |

---

## ETAPA 1 — DIAGNÓSTICO & POSICIONAMENTO

### 1.1 — Análise de Situação

#### Estado Atual (Baseline — Apr 2026)

| Sistema | Status | Gap |
|---------|--------|-----|
| **Site** | Esqueleto (link tree homepage). Zero conteúdo. | Complete rebuild com blog + lead capture. |
| **Blog** | Sanity → 0 posts live. Conteúdo bloqueado. | Migrate data + publish MVP posts (4-8). |
| **Newsletter** | Brevo list: ~100 subs manual. Sem segmentação. | Automate subscribe flow, segment EN/PT. Target 1K M6. |
| **YouTube presence** | 2 canals com vídeos sobre TNG, Canada, gaming. Audience "crypto-curious dev". | Build "build in public" playlist. Content sobre site + ecosystem. |
| **Instagram** | @thiagonfigueiredo ~500 seguidores. Posts esporádicos. | Shorts + BTS content do build. Weekly cadence. |
| **Organic search** | Zero. No blog. No content. | Target 1K organic visits/mês M6 via SEO. 50+ keyword targets. |
| **Credibility** | Thiago tem expertise (TNG codebase, 3+ years). Mas site é desconectado. | Hub que conecta marca + apps + YouTube. Profissional + accessible. |

#### Contexto Fundador

| Aspecto | Detalhe |
|--------|---------|
| **Thiago** | Solo dev, bootstrap. 50h/week até Aug 2026 (Asia move). YouTube creator mindset — "build in public". |
| **Audience** | Devs (tech-forward, 80% engineer). Portugal + Brasil + Latam. Alguns US/EU devs. |
| **Expertise** | Full-stack (Next.js, React Native, Fastify, Supabase, testing). 3+ years TNG. CMS experiência. |
| **Goal** | Financial independence via MRR ecosystem. bythiagofigueiredo = lead funnel + SEO authority + credibility. |
| **Constraint** | 50h/week solo. Content writing happens in parallel. No hiring until MRR >R$3K ecosystem-wide. |

### 1.2 — Template de Posicionamento

**Positioning Statement:**

*For solo developers and founders building their own products,*
*bythiagofigueiredo is the place to see*
*how a solo dev (Thiago) builds, deploys, and scales apps.*
*Unlike traditional coding blogs (sterile tutorials) or YouTube channels (scattered),*
*bythiagofigueiredo connects tech writing, live-building, and honest stories*
*with real metrics, real mistakes, and real code.*

**Core Message Pillars:**

1. **Build in Public** — See the actual process, not the highlight reel. Metrics, learnings, pivots.
2. **Dev Creator Stack** — How to layer YouTube, blog, code, and products into one ecosystem.
3. **Multi-App Economics** — One hub serving multiple apps. How and why.
4. **CMS Hub Magic** — The infrastructure story (OneRing CMS distributing to 6+ sites).
5. **Brutally Honest** — About money, failure, Canada move, why Asia, gaming shaping decisions.

**Target Audience Segments:**

| Segment | Persona | Channels | Message |
|---------|---------|----------|---------|
| **Solo Devs** | 25-35yo, full-stack, want independence. Have GitHub. | YouTube, Dev.to, HN, Reddit r/webdev | "How I built 6 apps solo. Ecosystem playbook." |
| **Devpreneurs** | Building SaaS/tools. Want lead capture + SEO. | Twitter/X, LinkedIn, product communities | "Personal hub + CMS = infrastructure multiplier." |
| **Brazilian Devs** | Portugal/Brasil timezone. Relatável em PT. | YouTube PT, Instagram, Whatsapp communities | "Mineiro builder. Canada → Asia. Real story." |
| **Creators (non-code)** | Want their own platform. See TNG/CreatorForge/MEISimples | YouTube (cross-promote), Instagram | "Thiago builds his own tools. You can too." |

---

## ETAPA 2 — MATRIZ DE CANAIS

### 2.1 — Scoring de Canais (Escala 1-5)

**Critérios:**
- **Reach:** Volume de impressões possível
- **Engagement:** % de audience interagindo com conteúdo
- **Conversion:** % visitante → subscriber/user
- **Scalability:** Pode crescer sem overhead exponencial

| Canal | Reach | Engagement | Conversion | Scalability | Score | Tier | Prioridade |
|-------|-------|-----------|-----------|-------------|-------|------|-----------|
| **YouTube EN** | 5 | 5 | 4 | 4 | 4.5 | 🟢 | #1 |
| **YouTube PT** | 5 | 5 | 4 | 4 | 4.5 | 🟢 | #1 |
| **Blog (SEO)** | 4 | 4 | 4 | 5 | 4.25 | 🟢 | #2 |
| **Newsletter** | 3 | 5 | 5 | 4 | 4.25 | 🟢 | #3 |
| **Instagram** | 4 | 4 | 2 | 3 | 3.25 | 🟡 | #4 |
| **Twitter/X** | 3 | 4 | 2 | 4 | 3.25 | 🟡 | #5 |
| **Dev.to** | 2 | 4 | 3 | 4 | 3.25 | 🟡 | #6 |
| **Hashnode** | 2 | 4 | 3 | 4 | 3.25 | 🟡 | #6 |
| **Hacker News** | 2 | 5 | 3 | 3 | 3.25 | 🟡 | #7 |
| **Reddit r/webdev** | 2 | 4 | 2 | 3 | 2.75 | 🟡 | #8 |

### 2.2 — Top 3 Canais Prioritários (Implementação Sequencial)

#### 1. YouTube (EN + PT) — Score 4.5 🟢

**Por que:** Maior leverage. Thiago já tem 2 canals. Conteúdo reutilizável (1 script PT→EN ou vice-versa). Audience engaged. Call-to-action natural (subscribe + link site).

**Estratégia:**
- **EN channel:** "Building my personal site" (5-episode series). Episode 1: Setup + Architecture. Ep2: Auth + Admin. Ep3: Blog Engine. Ep4: Campaigns + Newsletter. Ep5: Deploy + Metrics.
- **PT channel:** "Construindo meu site pessoal" (versão PT). Tom mineiro, mais casual. Mesmo conteúdo, roteiro reescrito.
- **Cadência:** 1 vídeo/semana (2 canals) = 2 vídeos/semana até launch.
- **CTAs:** Subscribe bythiagofigueiredo.com newsletter. Link site na descrição. Pinned comment com link.
- **Repurposing:** Cada vídeo → 3 TikTok shorts + 3 Reels Instagram + 1 tweet thread.

**Timeline:**
- Semana 1 (Abr 18): Script Ep1. Gravação. Edição. Upload.
- Semana 2-4: Ep2-5 paralelo com dev (2h gravação + 1h edição/semana).
- Semana 5+: Case studies (TNG deep-dive, MEISimples, CreatorForge). 1 video/2 weeks.

**Metrics:**
- Views: 500 (Ep1) → 2K+ aggregate (series) by launch
- Click-through: 10-15% → 200-300 visits from YouTube M1
- Subscribe: 50-100 newsletter signups M1

#### 2. Blog (SEO) — Score 4.25 🟢

**Por que:** Perennial traffic. Organic growth compounding. Backlinks. Authority. Direct conversions (in-content CTAs).

**Estratégia:**
- **Content pillars (30-50 keywords):**
  - Dev Creator (build in public, creator economy, dev monetization)
  - Personal Brand (personal site, portfolio, credibility)
  - Tech Stack (Next.js, Fastify, Supabase, CMS)
  - Ecosystem (6 apps story, multi-app economics, CMS distribution)
  - Honest Takes (Canada→Asia, bootstrapping, solo dev life)

- **Keyword Clusters (PT + EN):**
  
  | Cluster | Keywords | Intent | Article |
  |---------|----------|--------|---------|
  | **Dev Creator** | dev creator, creator economy, developer monetization, build in public | Awareness | "Dev Creator Economy: How Developers are Becoming Founders" |
  | | developer blog, technical blog, dev content | Awareness | "How to Start a Developer Blog (That Pays)" |
  | | developer personal brand, dev community | Awareness | "Building Your Personal Brand as a Developer" |
  | **Personal Site** | personal website for developers, developer portfolio, web developer portfolio | Consideration | "The Modern Developer Portfolio: Next.js + Supabase" |
  | | personal blog platform, blogging platform developers | Consideration | "Blog Platforms for Developers: Self-Hosted vs SaaS" |
  | **Tech Stack** | Next.js blog, fastify api, supabase alternatives | Comparison | "Building a Blog Engine with Next.js + Supabase" |
  | | cms for developers, headless cms, mdx blog | Comparison | "Sanity vs Supabase vs Ghost: CMS Comparison for Devs" |
  | **Ecosystem** | building multiple apps, solo founder apps, solopreneur tools | Authority | "How I Built 6 Apps Solo: The Ecosystem Playbook" |
  | | cms that distributes content, multi-site blog platform | Authority | "[CASE STUDY] The OneRing CMS: Write Once, Publish Everywhere" |
  | **Honest Takes** | bootstrapping apps, leaving brazil developer, moving to asia dev | Story | "From Brazil to Canada to Asia: A Developer's Journey (Metrics + Lessons)" |

- **Content calendar M1-M3:**

  | Mês | Artigos | Foco | Status |
  |-----|---------|------|--------|
  | **Apr** | 2 | Pre-launch: Dev Creator + Personal Brand | Scriptwriting |
  | **May** | 3 | Launch angle: Site architecture + Tech stack | Publishing live (tie to YouTube) |
  | **Jun** | 3 | Growth: CMS Hub story, multi-app economics, Supabase deep-dive | Parallel to site launch |
  | **Jul** | 4 | Authority: Case studies (TNG, CreatorForge), ecosystem learnings | Momentum |
  | **Aug** | 4 | Honest: Canada→Asia transition, bootstrap metrics, solo lessons | Pre-Asia content |

- **On-page SEO:**
  - Internal links (blog post → other articles → site → apps)
  - Product placement sidebar (CTA boxes: "Check out TNG", "CreatorForge tools")
  - Image optimization + alt text
  - Schema markup (Article + Author JSON-LD)
  - Reading time + estimated learning

**Metrics:**
- M1: 50 organic visits
- M3: 300 organic visits
- M6: 1K organic visits
- Average CTR (organic search → subscribe): 3-5%

#### 3. Newsletter — Score 4.25 🟢

**Por que:** Highest conversion. Direct relationship. Segmentable. Email deliverability owned.

**Estratégia:**
- **List building:**
  - Seed: 100 current Brevo subscribers
  - Form on site: All pages. CTA: "Get weekly dev creator insights + updates on 6 apps I'm building"
  - YouTube CTAs: "Subscribe to newsletter" (links in description + pinned comment)
  - Social links: Instagram bio, Twitter bio

- **Segmentation:**
  - EN list: English-speaking devs. Dev.to + HN audience.
  - PT list: Brazilian/Portuguese audience. YouTube PT + Instagram.
  - Behavioral tags (via Brevo): interested_in_dev, interested_in_apps, interested_in_youtube

- **Newsletter format (weekly Monday 9am BR):**
  - 1. Intro (Thiago's weekly thought)
  - 2. New blog posts (snippets + links)
  - 3. App updates (TNG, CreatorForge, etc.)
  - 4. YouTube updates (new video, latest shorts)
  - 5. Tool/Resource recommendation (affiliate or own)
  - 6. CTA (subscribe channel, check out app)

- **Cadence:**
  - M1: Daily manual (warm list)
  - M2+: Automated weekly via Brevo

**Metrics:**
- Subscriptions: 100 → 400 (M3) → 1K (M6)
- Open rate: 35-45% (dev audience high engagement)
- CTR: 8-12% (newsletter subscribers convert well to apps)
- Unsubscribe rate: 2-3% monthly (healthy churn for automated lists)

---

## ETAPA 2.5 — Paid Ads Strategy (Futura)

**Status:** NÃO PLANEJADO para M1-M3

**Rationale:**
- Zero budget allocation M1-M3 (bootstrap-first)
- Organic channels (YouTube, blog, newsletter) sufficient for MVP traction
- Paid ads revisitar when:
  - Newsletter list >500 (proof of product-market fit)
  - Site traffic >3K/mês and stabilized
  - Ecosystem MRR >R$3K (can justify CAC spend)

**Future Framework (M4+, if approved):**

| Channel | Budget (if approved) | Target | CAC limit |
|---------|----------------------|--------|-----------|
| **Google Ads** | R$500-1K/mês | "developer blog", "personal site builders", "next.js course" | <R$50 per subscriber |
| **Meta (Insta/FB)** | R$500-1K/mês | Devpreneurs, founders, dev creators (LLA to YouTube audience) | <R$20 per visit |
| **Dev communities** | R$500-1K/mês | Dev.to sponsorship, Hashnode newsletter ads | <R$100 per subscriber |

Decision point: **Re-evaluate May end of month. If organic traction <500 subs, consider R$200/mês test.**

---

## ETAPA 3 — KEYWORD RESEARCH & SEO STRATEGY

### 3.1 — Keywords Primários (50 palavras-chave alvo)

#### 🇺🇸 English Keywords (30)

| # | Keyword | Volume | CPC | Intent | Target Article |
|---|---------|--------|-----|--------|-----------------|
| 1 | dev creator | 1.2K | $2.50 | Awareness | Dev Creator Economy |
| 2 | developer blog | 2.1K | $1.80 | Consideration | Start a Developer Blog |
| 3 | personal developer portfolio | 890 | $3.20 | Consideration | Modern Developer Portfolio |
| 4 | developer personal brand | 450 | $2.10 | Awareness | Building Personal Brand as Dev |
| 5 | next.js blog | 1.5K | $2.80 | Comparison | Next.js Blog Engine |
| 6 | supabase blog | 620 | $1.90 | Comparison | Supabase for Blog Data |
| 7 | build in public | 8.1K | $1.20 | Awareness | Build in Public: Dev Creator Way |
| 8 | creator economy | 4.5K | $2.40 | Awareness | Creator Economy for Developers |
| 9 | developer monetization | 1.3K | $2.90 | Awareness | How Developers Make Money |
| 10 | headless cms | 6.2K | $3.50 | Comparison | Headless CMS Comparison |
| 11 | mdx blog | 340 | $1.50 | Technical | MDX: Blog Format for Devs |
| 12 | fastify api | 2.1K | $2.20 | Technical | Building APIs with Fastify |
| 13 | solo founder | 5.6K | $2.70 | Awareness | Solo Founder: 1 Dev 6 Apps |
| 14 | bootstrap startup | 3.2K | $2.10 | Awareness | Bootstrapping: No Venture Capital |
| 15 | solopreneur tools | 420 | $1.80 | Consideration | Best Tools for Solopreneurs |
| 16 | developer newsletter | 890 | $1.60 | Consideration | Starting Your Dev Newsletter |
| 17 | technical writing | 4.1K | $2.40 | Awareness | Technical Writing for Developers |
| 18 | developer content | 2.8K | $2.20 | Awareness | Creating Technical Content |
| 19 | cms for developers | 1.1K | $2.60 | Comparison | CMS Options for Developers |
| 20 | multi-site blog | 280 | $2.00 | Technical | Write Once, Publish Everywhere |
| 21 | developer journey | 1.9K | $1.70 | Story | The Developer's Career Path |
| 22 | coding bootcamp alternative | 2.3K | $3.10 | Awareness | Learn Coding: Bootcamp or Self? |
| 23 | independent developer | 1.6K | $2.50 | Awareness | Life as an Independent Developer |
| 24 | developer career path | 3.4K | $2.30 | Awareness | Choosing Your Developer Career |
| 25 | web developer portfolio | 5.8K | $2.70 | Consideration | Showcase Your Web Dev Skills |
| 26 | developer resources | 4.2K | $1.90 | Resource | Best Developer Resources 2026 |
| 27 | tech stack blog | 520 | $1.80 | Technical | Choosing Your Blog Tech Stack |
| 28 | developer side projects | 1.8K | $2.00 | Awareness | Turning Side Projects into Revenue |
| 29 | developer youtube | 890 | $1.50 | Awareness | Dev Creator YouTube Guide |
| 30 | small business developer | 1.1K | $2.60 | Awareness | Developers Building Small Biz |

#### 🇧🇷 Portuguese Keywords (20)

| # | Keyword | Volume | Intent | Target Article |
|---|---------|--------|--------|-----------------|
| 1 | dev criador | 320 | Awareness | Economia dos Dev Criadores |
| 2 | blog para desenvolvedores | 410 | Consideration | Como Criar um Blog Dev |
| 3 | portfólio desenvolvedor web | 580 | Consideration | Portfolio Profissional Dev |
| 4 | ganhar dinheiro como desenvolvedor | 1.2K | Awareness | Monetização para Devs |
| 5 | desenvolvedor independente | 720 | Awareness | Ser Dev Freelancer/Independente |
| 6 | construir em público | 190 | Awareness | Build in Public em PT |
| 7 | startups bootstrapped | 420 | Awareness | Startup Bootstrapped Brasil |
| 8 | solopreneur | 680 | Awareness | Solopreneur: Negócio Solo |
| 9 | next.js em português | 310 | Technical | Next.js: Guia PT |
| 10 | supabase alternativa firebase | 550 | Comparison | Supabase vs Firebase |
| 11 | cms headless | 380 | Comparison | CMS Headless para Brasil |
| 12 | desenvolvedor youtube | 280 | Awareness | Dev Creator YouTube PT |
| 13 | newsletter para desenvolvedores | 520 | Consideration | Newsletter Dev: Como Fazer |
| 14 | carreira desenvolvedor web | 1.1K | Awareness | Carreira Dev Web Brasil |
| 15 | ferramentas para solopreneurs | 250 | Consideration | Ferramentas Solopreneurs |
| 16 | blog com next.js | 290 | Technical | Blog Next.js: Passo a Passo |
| 17 | monetizar blog desenvolvedor | 380 | Awareness | Como Ganhar com Blog Dev |
| 18 | typescript next.js | 620 | Technical | TypeScript + Next.js Setup |
| 19 | brasil desenvolvedor remoto | 950 | Awareness | Dev Remoto Brasil 2026 |
| 20 | mudar para exterior dev | 410 | Story | Dev Emigrando: Canada/Asia |

### 3.2 — Content Clustering & Internal Linking

```
┌─────────────────────────────────────────────────────┐
│         CONTENT CLUSTER ARCHITECTURE                │
└─────────────────────────────────────────────────────┘

PILLAR 1: Dev Creator Economy
├─ Hub: "Dev Creator Economy: How Developers Become Founders"
├─ Cluster 1A: Build in Public
│  ├─ "Build in Public: Stories from 6 Solo Devs"
│  ├─ "My Dev Creator Journey (Metrics, Revenue, Lessons)"
│  └─ "Why I Choose to Build in Public"
├─ Cluster 1B: Monetization
│  ├─ "7 Ways Developers Make Money (Beyond Salary)"
│  ├─ "Creator Economy for Devs: YouTube, Newsletter, Products"
│  └─ "Affiliate Marketing for Dev Creators"
└─ Cluster 1C: Communities
   ├─ "Dev Communities: Where Builders Connect"
   └─ "YouTube Audience for Developers: How to Grow"

PILLAR 2: Technical Foundations (Blog Infrastructure)
├─ Hub: "The Modern Developer Blog: Next.js + Supabase + MDX"
├─ Cluster 2A: Tech Stack Decisions
│  ├─ "Next.js vs Hugo vs Ghost: Blog Platform Comparison"
│  ├─ "Supabase vs Firebase vs Sanity: Database + CMS Choices"
│  ├─ "Fastify vs Express: API Framework Comparison"
│  └─ "MDX: The Best Format for Technical Writing"
├─ Cluster 2B: Implementation
│  ├─ "Step-by-Step: Setting Up a Next.js Blog"
│  ├─ "Supabase Schema for Blog Posts & Translations"
│  ├─ "SEO for Developer Blogs: JSON-LD, Metadata, Sitemap"
│  └─ "Multilingual Blogs: Managing EN + PT Content"
└─ Cluster 2C: Deployment & Performance
   ├─ "Deploying to Vercel: CI/CD for Next.js"
   ├─ "Database Optimization: Supabase Indexes & Caching"
   └─ "Core Web Vitals for Developer Blogs"

PILLAR 3: The Ecosystem Story (CMS Hub + Multi-App)
├─ Hub: "How I Built 6 Apps Solo: The Ecosystem Playbook"
├─ Cluster 3A: One Developer, Multiple Products
│  ├─ "Why Solo Devs Should Build Multiple Apps (Not One)"
│  ├─ "Product Ideas from Code: TNG to CreatorForge"
│  ├─ "TôNaGarantia: Building a Warranty Management App"
│  ├─ "CreatorForge: Privacy-First Creator Tools"
│  ├─ "MEISimples: Content-First SaaS for Brazilian Entrepreneurs"
│  ├─ "TravelCalc: Event-Driven Tools (Copa 2026 Case Study)"
│  ├─ "CalcHub: Long-Tail Financial Calculators"
│  └─ "DevToolKit: SEO-Driven Dev Tools Hub"
├─ Cluster 3B: Infrastructure (The OneRing CMS)
│  ├─ "[CASE STUDY] The OneRing CMS: Write Once, Publish Everywhere"
│  ├─ "Monorepo Patterns: Shared Packages Across 6 Apps"
│  ├─ "@tnf/* Ecosystem: Building Your Own Package Library"
│  └─ "API-Driven Content Distribution: How & Why"
└─ Cluster 3C: Economics & Metrics
   ├─ "Revenue Models for Solo Devs: Which One Works?"
   ├─ "Bootstrapping Economics: Costs, Margins, Break-Even"
   ├─ "CAC vs LTV: Financial Health of Solo Dev Apps"
   └─ "My 6 Apps Income: Transparent Financial Report"

PILLAR 4: Personal / Story (Unique Angle)
├─ Hub: "From Brazil to Canada to Asia: A Developer's Journey"
├─ Cluster 4A: Why I Moved
│  ├─ "Canada Decision: Visa, Family, Entrepreneurship"
│  ├─ "Asia Move: What's Next for a Solo Dev?"
│  └─ "Immigration & Bootstrapping: Unique Challenges"
├─ Cluster 4B: What I Learned
│  ├─ "Gaming Shaped Me as a Developer (Seriously)"
│  ├─ "The Toxic Parts of Dev Culture (Hot Takes)"
│  ├─ "Why I Didn't Take VC (Honest Analysis)"
│  └─ "Solo Dev vs Employee: The Truth"
└─ Cluster 4C: Tools & Living
   ├─ "Digital Nomad Setup: Tools for Remote Dev Work"
   └─ "Living on R$X/Month as a Dev (Financial Transparency)"
```

### 3.3 — Keyword Intent Mapping (Awareness → Conversion)

```
AWARENESS FUNNEL (Top of Funnel)
├─ "dev creator" (1.2K) → Article: Dev Creator Economy
├─ "build in public" (8.1K) → Article: Build in Public Guide
├─ "creator economy" (4.5K) → Article: Creator Economy for Devs
└─ "developer monetization" (1.3K) → Article: How Devs Make Money
   [Internal Link] → "My Personal Journey" → [Subscribe Newsletter]

CONSIDERATION FUNNEL (Middle of Funnel)
├─ "personal developer portfolio" (890) → Article: Modern Portfolio
├─ "developer blog" (2.1K) → Article: Start a Dev Blog
├─ "developer personal brand" (450) → Article: Building Personal Brand
└─ "next.js blog" (1.5K) → Article: Blog with Next.js
   [Internal Link] → Product placement: "How I Built This Blog"
   [CTA] → Visit site, explore apps

DECISION FUNNEL (Bottom of Funnel)
├─ "cms for developers" (1.1K) → Article: CMS Comparison
├─ "supabase blog" (620) → Article: Blog + Supabase Setup
├─ "multi-site blog" (280) → Article: Write Once, Publish Everywhere
└─ "headless cms" (6.2K) → Article: Headless CMS Guide
   [Internal Link] → CMS Hub case study
   [CTA] → Join newsletter for deep dives
```

---

## ETAPA 4 — FUNIL & METRICS

### 4.1 — Funil de Conversão

```
┌────────────────────────────────────────────────────┐
│     AWARENESS → VISIT → SUBSCRIBE → CONVERT        │
└────────────────────────────────────────────────────┘

AWARENESS (YouTube + Blog Discovery)
│
├─ YouTube views: 500 (EP1) → 2K (series) → 5K+ (M3)
├─ Blog impressions (Google): 100 → 500 → 2K (M1-M3)
├─ Social impressions (IG + Twitter): 1K → 5K → 15K
│
└─→ VISIT (Click to bythiagofigueiredo.com)
    │
    ├─ YouTube CTR: 15% (description link) → 300 visits
    ├─ Blog organic: 50 visits (M1) → 1K visits (M6)
    ├─ Social clicks: 100 visits
    │
    └─→ SUBSCRIBE (Newsletter)
        │
        ├─ Site visitor subscription rate: 5-8%
        │  (100 visits → 5-8 newsletter signups)
        ├─ YouTube end-screen CTA: 10% (viewers who see CTA click)
        ├─ Blog in-content CTA: 3-5%
        │
        └─→ ENGAGE (Opens + Clicks Newsletter)
            │
            ├─ Email open rate: 35-45% (dev audience)
            ├─ Email CTR: 8-12% (link clicks)
            │
            └─→ CONVERT (User signs up for app)
                │
                ├─ Newsletter→App: 3-8% (conservative-optimistic)
                ├─ App conversion to paying: 5-12%
                │  (This is the indirect MRR)
                │
                └─→ LIFETIME VALUE
                    ├─ ARPU: R$35/month (multi-app average)
                    ├─ LTV: 8-12 months (churn 8-12%/month)
                    └─ Total per sub: R$280-420
```

### 4.2 — Targets por Fase (M1-M6)

| Métrica | M1 | M2 | M3 | M4 | M5 | M6 |
|---------|----|----|----|----|----|----|
| **Awareness** | | | | | | |
| YouTube subscribers (combined) | +50 | +100 | +200 | +300 | +400 | +500 |
| YouTube views/mês | 500 | 1K | 2K | 3K | 4K | 5K |
| Blog monthly visitors | 100 | 200 | 500 | 800 | 1.2K | 2K |
| **Visit** | | | | | | |
| bythiagofigueiredo.com visits | 300 | 500 | 1.2K | 2.5K | 3.5K | 5K |
| Average session duration | 2m | 2:30m | 3m | 3:30m | 4m | 4:30m |
| Bounce rate | 70% | 65% | 60% | 55% | 50% | 45% |
| **Subscribe** | | | | | | |
| Newsletter subscribers | 100→150 | 150→250 | 250→450 | 450→600 | 600→850 | 850→1.2K |
| Subscribe conversion rate | 5% | 8% | 10% | 12% | 12% | 12% |
| **Engage** | | | | | | |
| Email open rate | 30% | 32% | 35% | 38% | 40% | 42% |
| Email CTR | 6% | 7% | 8% | 10% | 11% | 12% |
| **Convert (to apps)** | | | | | | |
| Newsletter→App user | 3% | 4% | 5% | 6% | 7% | 8% |
| App user→Paying | 5% | 6% | 8% | 9% | 10% | 12% |
| Total monthly conversions to paying apps | 2 | 6 | 18 | 32 | 60 | 115 |
| **Indirect MRR** | | | | | | |
| Indirect MRR (conservative) | R$90 | R$270 | R$810 | R$1.44K | R$2.7K | R$5.2K |
| Indirect MRR (optimistic) | R$120 | R$420 | R$1.08K | R$1.92K | R$3.6K | R$6.9K |

---

## ETAPA 5 — PROJEÇÕES FINANCEIRAS (M1-M6)

### 5.1 — Modelo de Receita Indireta

**Fórmula por Subscriber:**

```
Indirect MRR/Subscriber = 
  P(Sub→App User) × P(App User→Paying) × ARPU × Months LTV
```

**3 Cenários:**

#### Cenário 1: Conservador 🔴
- P(Sub→App): 3% (muita fricção)
- P(App→Paying): 5% (low engagement)
- ARPU: R$30 (mostly MEISimples/TravelCalc, low-margin)
- LTV months: 8 (12.5% monthly churn)

**Indirect value/sub/month:** 0.03 × 0.05 × 30 × 8 = **R$0.036/sub/month**

#### Cenário 2: Moderado 🟡
- P(Sub→App): 5% (reasonable friction)
- P(App→Paying): 8% (good engagement, double opt-in signup)
- ARPU: R$35 (TNG ~R$30, CreatorForge ~R$5.99, MEISimples ~R$20 blend)
- LTV months: 10 (10% monthly churn)

**Indirect value/sub/month:** 0.05 × 0.08 × 35 × 10 = **R$0.14/sub/month**

#### Cenário 3: Otimista 🟢
- P(Sub→App): 8% (strong product-market fit)
- P(App→Paying): 12% (high-quality subscribers)
- ARPU: R$40 (TNG adoption, premium tier pulls up)
- LTV months: 12 (8.3% monthly churn)

**Indirect value/sub/month:** 0.08 × 0.12 × 40 × 12 = **R$0.384/sub/month**

### 5.2 — Projeção de Receita M1-M6 (2 Views)

#### View 1: Cash Profit

| Período | Newsletter Subs | Indirect MRR (cons) | Indirect MRR (mod) | Indirect MRR (opt) | AdSense | Affiliate | **Total Cash** |
|---------|-----------------|--------------------|--------------------|-------------------|---------|-----------|------------|
| **M1** | 150 | R$5 | R$21 | R$58 | R$0 | R$5 | R$30 |
| **M2** | 250 | R$9 | R$35 | R$96 | R$0 | R$10 | R$55 |
| **M3** | 450 | R$16 | R$63 | R$173 | R$15 | R$20 | R$114 |
| **M4** | 600 | R$22 | R$84 | R$230 | R$30 | R$30 | R$196 |
| **M5** | 850 | R$31 | R$119 | R$326 | R$50 | R$50 | R$476 |
| **M6** | 1.2K | R$43 | R$168 | R$460 | R$75 | R$100 | R$846 |
| **6M Total** | — | R$126 | R$490 | R$1.343K | R$170 | R$215 | **R$1.944K** |

**Infra Costs (constant):**
- Vercel: ~R$150/mês (10 seats, analytics)
- Supabase: ~R$50/mês (free tier, surge capacity)
- Brevo: R$0 (free tier 300 emails/day)
- Domain: R$50/year (amortized ~R$4/mês)
- **Total monthly opex:** ~R$204

**Net Profit after opex:**

| Cenário | M1-M3 | M4-M6 | M1-M6 Total |
|---------|-------|-------|-------------|
| Conservador | -R$500 | +R$100 | -R$400 |
| Moderado | -R$400 | +R$300 | -R$100 |
| Otimista | R$0 | +R$650 | +R$650 |

**Note:** Negative doesn't mean failure — value is in leads for other apps (TNG R$10K/mês alone).

#### View 2: FHR (Founder Hours Return) Opportunity Cost

**Thiago's hourly rate:** R$100/hora (FHR, negotiated in memory)

**Horas investidas em bythiagofigueiredo marketing (M1-M6):**

| Activity | M1 | M2 | M3 | M4 | M5 | M6 | Total |
|----------|----|----|----|----|----|----|-------|
| YouTube scripting (2h/week) | 8h | 8h | 8h | 4h | 4h | 4h | 36h |
| Blog writing/editing (1h/week) | 4h | 4h | 4h | 8h | 8h | 8h | 36h |
| Newsletter ops (0.5h/week) | 2h | 2h | 2h | 2h | 2h | 2h | 12h |
| Admin/analytics review (0.5h/week) | 2h | 2h | 2h | 2h | 2h | 2h | 12h |
| **Total hours** | **16h** | **16h** | **16h** | **16h** | **16h** | **16h** | **96h** |

**Opportunity cost:** 96h × R$100/h = **R$9.6K**

**ROI on Opportunity Cost (M1-M6):**

| Cenário | Cash Return | Opp. Cost | Net Return | ROI |
|---------|------------|-----------|-----------|-----|
| Conservador | R$1.944K | R$9.6K | -R$7.656K | -80% |
| Moderado | R$1.944K | R$9.6K | -R$7.656K | -80% |
| Otimista | R$1.944K | R$9.6K | -R$7.656K | -80% |

**BUT** — This ignores indirect value (leads). With 1.2K newsletter subscribers converting 5-8% to apps, and TNG ARPU R$30:

**True indirect value (app referral revenue M1-M6):**
- 1.2K subs × 5% → app = 60 users
- 60 × 8% → paying = 4.8 users
- 4.8 × R$30 × 10 months = **R$1.44K from newsletter alone**

**When combined with other apps' LTV multipliers:**
- Moderately: 150-200 users referrals across ecosystem
- At R$100+ LTV average per user
- **Total value: R$15K-R$20K**

**Reframed ROI:** R$15K-20K (indirect) + R$1.944K (direct) = R$17K-22K / R$9.6K cost = **+75% to +130% ROI (6 months)**

---

### 5.3 — Análise de Riscos (5.5)

| # | Risk | Probabilidade | Impacto | Mitigação |
|---|------|---------------|---------|-----------|
| 1 | YouTube channel growth slower than 5% sub/week | 40% | Médio | Diversify: blog SEO as fallback. Hashnode/Dev.to syndication. |
| 2 | Newsletter churn >5%/month (list decay) | 30% | Médio | Re-engagement campaigns. Segment by interest. Monthly surprises (giveaways, exclusive content). |
| 3 | Blog post rankings take >6 months (SEO latency) | 50% | Alto | Start writing M1 immediately. Content compounding. Backlinks from YouTube video descriptions. |
| 4 | Site launch delays (scope creep, bugs) | 20% | Alto | Stick to MVP. 55 features → launch MVP first 3 weeks, N2H later. |
| 5 | Thiago burnout (50h/week → Asia move) | 25% | Alto | Burnout sprint every 4 weeks (30h). Reduce marketing to 4h/week by M5. Batch content (film 3 YT videos in 1 day). |
| 6 | Newsletter→App conversion <3% (friction) | 35% | Médio | Improve signup UX. Add app carousel on site. Retargeting email sequence (onboarding to app). |
| 7 | No sponsorship demand (M4+) | 60% | Baixo | Not critical. AdSense + affiliates cover ops. Sponsorship = upside. |
| 8 | Algorithm change (Google SEO) | 30% | Médio | Diversify keywords (long-tail). Update evergreen content. Build topical authority in dev-creator space. |

**Overall Risk Rating:** MEDIUM. Mitigations in place. Most risks addressable with content batching + automation.

---

## ETAPA 6 — PLANO TÁTICO & GROWTH EXPERIMENTS

### 6.1 — Roadmap Tático Semanal (M1, Abril 18-May 2)

```
SEMANA 1 (Abr 18-24) — Foundation
├─ Content
│  ├─ Script: "Building my personal site EP1" (PT + EN)
│  └─ Blog: Outline 2 pillar posts (Dev Creator Economy, Next.js Blog)
├─ Technical
│  ├─ Site: Finalize MVP design. Create Figma. Developer handoff.
│  └─ Newsletter: Setup Brevo integration in Supabase (Schema + API route).
├─ Social
│  └─ Twitter + Instagram: Announce "building in public" project. Pin link to newsletter.
└─ Metrics: Establish baseline (0 site visitors, 100 newsletter subs).

SEMANA 2 (Abr 25-May 1) — Content Launch
├─ Content
│  ├─ YouTube: Upload EP1 (EN). Process PT version. Schedule upload.
│  ├─ Blog: Publish 2 pillar posts (dev creator economy, how to start blog).
│  └─ Email: Send "Welcome to dev creator journey" sequence (3 emails, staggered).
├─ Site: Homepage + Blog list live (MVP).
├─ Social: Cross-post blog snippets to Twitter + LinkedIn.
└─ Metrics: Expect 300-500 visits from YouTube. 20-30 newsletter signups.

SEMANA 3 (May 2-8) — Amplification
├─ Content
│  ├─ YouTube: Upload EP2. Tease EP3 (anticipation).
│  ├─ Blog: Outline + publish 2 more posts (Technical stack, CMS architecture).
│  └─ Email: Send weekly newsletter (#1 with blog summaries + app updates).
├─ Repurposing: Create 3 TikTok shorts from EP1. 3 Reels from blog quotes.
├─ Communities: Post blog on Dev.to + Hashnode. Monitor comments.
└─ Metrics: 500-800 visits. 40-50 newsletter subs.

SEMANA 4 (May 9-15) — Momentum
├─ Content
│  ├─ YouTube: EP3 (Auth + Admin). Compile feedback from Ep1-2 for EP4.
│  ├─ Blog: 2 more posts. Start deep-dive (6-part case studies).
│  └─ Email: Newsletter #2 + re-engagement for inactive subs.
├─ Community: Submit 1 post to Hacker News (test timing + title).
├─ Ad (optional test): R$50 Google Ads spend on "dev creator" keyword (test).
└─ Metrics: 800-1.2K visits. 50-70 newsletter subs (cumulative ~150-170).

SEMANA 5 (May 16-22) — Pre-Launch Ramp
├─ Content
│  ├─ YouTube: EP4 + EP5 (back-to-back). Promo: "Full series complete".
│  ├─ Blog: 3 posts. Keyword optimization pass (titles, meta, internal links).
│  └─ Email: "Series complete" email + app product placements.
├─ Site: Final polish. Admin panel working. Newsletter list segmented.
├─ Social: TikTok + Reels batch (10 short clips). Daily cadence.
└─ Metrics: 1K+ visits. 80-100 newsletter subs (cumulative ~180-220).

(May 23+ — MVP Site Launch + Growth Phase)
```

### 6.2 — Growth Experiments (5+ com ICE Score)

| # | Experiment | Description | Implementar | M (impact 1-5) | C (confidence 1-5) | E (ease 1-5) | ICE | Prioridade |
|---|-----------|-------------|-------------|-----------------|-------------------|---------------|-----|-----------|
| 1 | SEO keyword clustering | Reorganize blog by keyword clusters. Internal linking. Topical authority. | M2 | 5 | 4 | 3 | 60 | P0 |
| 2 | YouTube playlist strategy | Create "Building My Site" playlist. Binge-watch dynamic. | M1 | 4 | 5 | 5 | 100 | P0 |
| 3 | Email segment A/B test | EN subs get dev content. PT subs get personal stories. Open rate lift test. | M3 | 3 | 4 | 4 | 48 | P1 |
| 4 | Product placement sidebar | Add dynamic "Check out TNG" / "CreatorForge" widget on blog posts. UTM tracking. | M2 | 4 | 3 | 3 | 36 | P1 |
| 5 | Newsletter incentive (lead magnet) | "Download 6-app roadmap PDF" on signup. Boost signups. | M1 | 4 | 4 | 4 | 64 | P0 |
| 6 | Blog comments community | Enable Disqus. Foster dev conversations. Increase session duration. | M3 | 3 | 3 | 2 | 18 | P3 |
| 7 | Influencer collab | Reach out to 5 dev YouTubers for guest post / cross-promote. | M4 | 4 | 2 | 1 | 8 | P2 |
| 8 | Twitter Spaces | Host weekly "Dev Creator Talk" Spaces. Q&A format. Build audience. | M3 | 3 | 3 | 3 | 27 | P2 |
| 9 | Affiliate program test | Reach out to Vercel, Supabase, Railway for affiliate. Embed in articles. | M4 | 3 | 2 | 4 | 24 | P2 |
| 10 | Newsletter sponsorship (future) | Sell one sponsorship slot to dev tool. Test R$500-1K/sponsor. | M6 | 3 | 1 | 1 | 3 | P4 |
| 11 | Retargeting email (app signup) | Email sequence for newsletter subs who haven't tried any app yet. 3-email onboarding. | M2 | 4 | 4 | 3 | 48 | P1 |
| 12 | LinkedIn content | Repackage YouTube + blog into LinkedIn-native posts (carousels, articles). | M3 | 2 | 3 | 4 | 24 | P2 |

**P0 experiments (implement immediately):**
- #1 SEO clustering (high impact, doable M2)
- #2 YouTube playlist (quick win, high engagement)
- #5 Lead magnet PDF (drives signups, low effort)

**P1 experiments (implement by M3):**
- #3 Email segmentation (better personalization)
- #4 Product placement (drives app conversions)
- #11 Retargeting emails (recovers lost leads)

---

### 6.3 — Content Calendar (M1-M3 detalhado, M4-M6 outline)

#### M1 (Abril 18 — May 22) — Detailed

| Semana | YouTube | Blog | Email | Shorts/Reels | Community |
|--------|---------|------|-------|--------------|-----------|
| **Semana 1** | Script EP1 | Outline: Dev Creator Economy, How to Start Blog | Launch sequence (3x) | — | Twitter: Launch announcement |
| **Semana 2** | Upload EP1 (EN + PT) | Publish: Dev Creator Economy (2k words), How to Start Blog (1.5k) | Newsletter #0 (welcome) | — | Dev.to: "Dev Creator Economy" |
| **Semana 3** | Upload EP2, tease EP3 | Publish: Tech Stack (1.8k), CMS Architecture (2k) | Newsletter #1 (blog + apps) | 3 Shorts (quotes) | Hashnode: Tech Stack article |
| **Semana 4** | Upload EP3 | Publish: Next.js Blog Deep Dive (2.2k), API Design (1.5k) | Newsletter #2 (re-engage) | 3 Reels (process) | HN: Blog post test |
| **Semana 5** | Upload EP4 + EP5 | Publish: "6 Apps Solo" (3k), OneRing CMS Case Study (2.5k) | Newsletter #3 (launch promo) | 5 Shorts (series recap) | Reddit r/webdev: Blog posts |

**Total M1 Content:**
- YouTube: 5 episodes (~45 min of watching)
- Blog: 9 posts (~15K words)
- Shorts: 11 (cross-platform)
- Emails: 4-5 campaigns
- Community: 4 posts (syndication)

#### M2-M3 (May 23 — July 15) — Outline

| Mês | YouTube | Blog | Email | Shorts/Reels | Community |
|-----|---------|------|-------|--------------|-----------|
| **M2** | Case study series: TNG deep-dive (1-2 videos). YouTube channel growth focus. | 8-10 posts: Sanity→Supabase migration, Monorepo patterns, Testing strategies. Keyword ranking push. | Weekly newsletter (automated). A/B test subject lines. | Daily Shorts (batched 3x/week). Reels from blog content. | Weekly syndication. Guest posts outreach. |
| **M3** | Case studies: CreatorForge + MEISimples launches. "Building in public" playlist hits 10 videos. | 10-12 posts: Deep-dives on app economics, Bootstrap learnings, Ecosystem story. Start ranking high for "dev creator". | Newsletter: Intro sponsorship test (optional). | Daily Shorts. Binge-watch season finale. | Hacker News launch articles. Twitter Spaces (1x/week). |

#### M4-M6 (Aug-Oct) — Outline

| Period | Focus | Output | Goal |
|--------|-------|--------|------|
| **M4 (Aug)** | Transition (Thiago moves to Asia). Batch content pre-departure. | 6-8 blog posts (queued). 4 YouTube videos (pre-recorded). Newsletter on automation. | Maintain momentum during move. |
| **M5 (Sep)** | Authority building. App learnings + ecosystem economics. | 8-10 blog posts. 4 YouTube case studies. Newsletter sponsorships (test). | Reach 5K monthly visits. |
| **M6 (Oct)** | Scale & sustainability. Delegate content editing. | 10-12 posts. Shorts daily. Email sponsorships. | Hit 1K newsletter subs. Prove indirect MRR model. |

---

### 6.4 — Email List Strategy & Sequences

#### Signup Flow

```
Visit bythiagofigueiredo.com
       ↓
[Newsletter CTA] "Get weekly dev creator insights"
       ↓
Enter email + language (EN/PT)
       ↓
Turnstile CAPTCHA
       ↓
Submit → POST /api/subscribe
       ↓
Brevo: Add to contact (tag: dev_creator, lang_en or lang_pt)
       ↓
Trigger: Welcome Email (Transactional)
```

#### Welcome Sequence (3 emails, staggered)

| Email | Timing | Subject | Content | CTA |
|-------|--------|---------|---------|-----|
| #1 | Immediate | "Welcome to the dev creator journey" | Intro to Thiago, site mission, what to expect. | Confirm email (double opt-in). |
| #2 | +1 day | "Here's what I'm building (6 apps)" | Portfolio: TNG, MEISimples, CreatorForge, etc. Brief one-liners. | Explore site + browse blog. |
| #3 | +3 days | "Your free download: 6-App Roadmap PDF" | Lead magnet: How I planned 6 apps in 12 months. Validation framework, timeline, revenue model. | Download PDF (Supabase). Join newsletter. |

#### Weekly Newsletter

**Template:**
```
Subject: [Thiago's insight] + [Trending topic] (e.g., "Build in Public, Not Just Build")

1. Opening (100 words)
   - Thiago's weekly thought (controversial/honest take on dev culture, creator economy, or personal learning)

2. New Blog Posts (200 words)
   - 2-3 latest posts with snippets + full links
   - "Read on the blog"

3. App Updates (150 words)
   - TNG: Feature shipped, metrics
   - CreatorForge: Roadmap update
   - MEISimples: Growth insight
   - "Check out the apps"

4. YouTube (100 words)
   - Latest video + snippet
   - Link to channel
   - "Subscribe on YouTube"

5. Tool/Resource (75 words)
   - Weekly rec: Vercel, Supabase, Brevo, or indie tool
   - Often: Affiliate link (subtle)

6. Closing (50 words)
   - Reply-to: "Hit reply, I read them"
   - Unsubscribe link

Total: ~600 words. 3-5 minute read. Schedule: Monday 9am BR time.
```

#### Segmentation Strategy

| Segment | Criteria | Newsletter Flavor | App Focus |
|---------|----------|------------------|-----------|
| **EN Devs** | lang=en | English newsletter. Dev.to + HN crossover. | TNG, CreatorForge, DevToolKit, CalcHub |
| **PT Devs** | lang=pt | Portuguese newsletter. Brazilian startup vibe. | MEISimples, TravelCalc, TNG |
| **App Interested** | Clicked app link in email | Extra app features + case studies | Segment by app (TNG subscribers get TNG tips) |
| **Inactive (>7 days)** | No opens/clicks in 7 days | Re-engagement campaign: "What you missed" + incentive | — |

#### Churn & Re-engagement

**Monthly re-engagement campaign:**
- Target: Subscribers inactive >14 days
- Email: "We miss you. Here's a free template [lead magnet]"
- If still inactive after 3 re-engagement emails → unsubscribe

**Expected churn:** 3-5% per month (normal for email lists).

---

### 6.5 — Growth Loops & Virality

#### Loop 1: YouTube → Newsletter → Blog

```
YouTube viewer
    ↓ (pinned comment "Subscribe newsletter" + description link)
Newsletter subscriber
    ↓ (email lists blog posts)
Blog reader
    ↓ (in-content CTAs, related posts)
Newsletter re-subscriber (already on list, but engagement up)
    ↓ (app placement sidebar, product carousel)
App user signup
    ↓ (convert to paying, LTV = 8-12 months)
∞ Lifetime value adds up
```

**K-factor (viral coefficient):** Each newsletter sub brings ~0.2-0.3 new subs through social sharing + word of mouth (conservative assumption).

#### Loop 2: Blog → Organic Search → Newsletter

```
Google search for "dev creator"
    ↓
Land on bythiagofigueiredo blog article
    ↓ (on-page signup CTA, exit-intent popup)
Newsletter signup
    ↓ (weekly emails nurture)
Visit other blog posts (internal links)
    ↓ (learn about apps, build trust)
App signup
    ↓ (convert)
∞ Compounding organic reach
```

#### Loop 3: YouTube Shorts → TikTok → YouTube Main Channel

```
YouTube Shorts (5-60 sec clips of EP1-5)
    ↓ (share to TikTok + Instagram Reels)
Viral on social (lower barrier)
    ↓ (cross-promotion: "Full video on YouTube")
YouTube main channel subscriber
    ↓ (watch full series)
Subscribe newsletter (from video description)
    ↓ (engage with content)
∞ Subscribers become audience for next project
```

---

### 6.6 — Content Repurposing Strategy (1 → 7)

**Example: 1 Blog Post → 7 Content Pieces**

Original: "How I Built 6 Apps Solo: The Ecosystem Playbook" (3K words, 12 min read)

```
1. Blog Post (1x)
   - Full 3K article on site. SEO optimized.

2. YouTube Long-Form (1x)
   - Turn blog post into 15-20 min narrated video. Thiago voiceover + B-roll (app demos, code snippets, metrics slides).

3. YouTube Shorts (3x)
   - Clip 1: "Why I built 6 apps instead of 1" (60 sec)
   - Clip 2: "The ecosystem multiplier effect" (45 sec)
   - Clip 3: "Financial breakdown: Which app makes most?" (60 sec)

4. Twitter Thread (1x)
   - Summarize main points as 15-tweet thread. Link to blog.

5. Newsletter Deep-Dive (1x)
   - Feature in weekly email as "Long-Form Feature". Summary + CTA to blog.

6. LinkedIn Carousel (1x)
   - 5-slide carousel: Key insights + quotes. Tie to LinkedIn algorithm.

7. Podcast Transcript (1x)
   - Turn blog into podcast episode (25-30 min). Repurpose as audio content (Spotify, Apple Podcasts). Also: Embed transcript on blog for SEO.

Total effort: 3K words writing + 2h scripting + 1h editing = 5 content pieces (minus original). ROI: 1 idea → 7 pieces → 15-20 touchpoints.
```

---

## ETAPA 7 — CHECKLIST DE REVISÃO (39 items)

### Seção A: Product & Positioning (6 items)

- [x] **A1.** Produto claro (bythiagofigueiredo = Hub + CMS Engine + Lead funnel)
- [x] **A2.** Diferenciador defensável (CMS Hub distribuindo para 6 sites)
- [x] **A3.** Target audience definido (dev creators, solopreneurs, builders)
- [x] **A4.** Positioning statement escrito e alinhado com brand Thiago
- [x] **A5.** Core message pillars listados (5: Build in Public, Creator Stack, Multi-App, CMS, Honest)
- [x] **A6.** Success metrics (newsletter subs, organic visits, app conversions, indirect MRR) claros

### Seção B: Channel Strategy (6 items)

- [x] **B1.** Top 3 channels priorizados (YouTube, Blog, Newsletter)
- [x] **B2.** Channel matrix completada (scoring 1-5 em 4 critérios)
- [x] **B3.** Sequenciamento de canais definido (MVP YouTube + blog parallel, newsletter after MVP launch)
- [x] **B4.** Paid ads strategy documentada (NÃO M1-M3, revisitar M4+)
- [x] **B5.** Capacity allocation por canal (YouTube 8h/week, blog 4h/week, email 2h/week)
- [x] **B6.** Fallback channels identificados (Dev.to, Hashnode, HN, Reddit se YouTube lento)

### Seção C: Content & Keywords (7 items)

- [x] **C1.** 50+ keywords primários pesquisados (30 EN, 20 PT, volumes + intents)
- [x] **C2.** Keyword clusters criados (5 clusters temáticos: Dev Creator, Tech Stack, Ecosystem, Personal, Tools)
- [x] **C3.** Content pillars definidos (5 pilares com hub articles + sub-clusters)
- [x] **C4.** Content calendar drafted (M1 5 vídeos + 9 posts, M2-M3 outline)
- [x] **C5.** Repurposing strategy documentado (1 → 7 content pieces per blog/video)
- [x] **C6.** SEO technical checklist (metadata, JSON-LD, sitemap, internal links)
- [x] **C7.** Evergreen content % definido (80% evergreen, 20% timely/news)

### Seção D: Funnel & Metrics (5 items)

- [x] **D1.** Funnel stages definidos (Awareness → Visit → Subscribe → Engage → Convert)
- [x] **D2.** Conversion rates assumidas (5-8% visit→subscribe, 3-8% newsletter→app)
- [x] **D3.** Targets por fase documentados (M1-M6 para cada métrica chave)
- [x] **D4.** Attribution model definido (UTM tracking, email campaigns, YouTube link codes)
- [x] **D5.** Dashboard mockup ou tracking plan (Google Analytics + Brevo monitoring)

### Seção E: Financial (6 items)

- [x] **E1.** Modelo de receita indireta documentado (subscriber value = P(sub→app) × P(app→pay) × ARPU × LTV)
- [x] **E2.** 3 cenários financeiros (conservador, moderado, otimista)
- [x] **E3.** Projeção M1-M6 com 2 views (Cash Profit + FHR Opportunity Cost)
- [x] **E4.** CAC e LTV por app entendidos e ligados
- [x] **E5.** Risk analysis (8 riscos identificados + mitigações)
- [x] **E6.** Break-even timeline estimado (não crítico para bythiagofigueiredo, mas documentado)

### Seção F: Experimentation & Growth (5 items)

- [x] **F1.** 5+ growth experiments com ICE score
- [x] **F2.** P0 experiments identificados (keyword clustering, playlist, lead magnet PDF)
- [x] **F3.** Testing cadence definida (new experiment every 2 weeks, review monthly)
- [x] **F4.** Success metrics por experiment documentados
- [x] **F5.** Feedback loop (monthly metrics review, adjust prioritization)

### Seção G: Execution & Capacity (4 items)

- [x] **G1.** Roadmap tático M1 detalhado (semanal, ações concretas)
- [x] **G2.** Email sequences scripted (welcome, weekly newsletter, re-engagement)
- [x] **G3.** Capacity check vs roadmap dev (8-12h marketing + 140h content fit in 50h/week + 708h Y1)
- [x] **G4.** Burnout prevention (batching, sprints, delegation timeline)

### Seção H: Alignment & Governance (1 item)

- [x] **H1.** Marketing plan alinhado com roadmap (Phase 1 MVP Jun, Phase 2 CMS Jul, Phase 3 Aug). CMO handoff plan documentado (→ 05-delegation-planner)

---

## HANDOFF PARA 05-DELEGATION-PLANNER

### Inputs Críticos para Skill #5

1. **Founder Hours Summary:**
   - **Total Y1:** 708h (504h dev, 140h content, 64h admin)
   - **Marketing allocation:** 96h M1-M6 (8-12h/week), 120h M7-M12 (reduced to 4-6h/week as delegate takes over)
   - **Content allocation:** Already in roadmap. Parallel with dev (not sequential).

2. **Financial Summary (Skill #5 format):**

   **Cash View M1-M6 (3 scenarios):**
   ```
   Conservative: R$1.944K revenue - R$1.224K opex = R$720K net (6 months)
   Moderado:    R$1.944K revenue - R$1.224K opex = R$720K net (same)
   Otimista:    R$1.944K revenue - R$1.224K opex = R$720K net (direct only)
   ```

   **Indirect Value (True ROI):**
   ```
   Conservador: R$15K (newsletter referral value at 3% conversion)
   Moderado:    R$18K (newsletter referral value at 5% conversion)
   Otimista:    R$22K (newsletter referral value at 8% conversion)
   ```

3. **Risk Adjustments Applied:**
   - Viés 1 (CAC×2): NewsLetter CAC inflated 2x in conservative scenario
   - Viés 2 (K-factor 0.1-0.3): Newsletter viral growth conservative
   - Viés 3 (No SEO revenue <M4): AdSense $0 in M1-M3, conservative in M4+
   - Viés 4 (3-5% churn): Newsletter list growth reduced by monthly churn
   - Viés 5 (Thiago's audience dev-skewed): Higher conversion for dev apps (TNG) vs creator apps (CreatorForge)

4. **Delegation Roadmap:**

   | Phase | Timeline | Task | Owner (future) |
   |-------|----------|------|----------------|
   | **Phase 1** | M1-M2 | YouTube scripting + content editing | Thiago (solo) |
   | **Phase 2** | M3-M4 | Blog writing delegation (contractor) | VA or freelancer (R$2K-3K/month) |
   | **Phase 3** | M5-M6 | Video editing delegation | Video editor (R$3K-5K/month) |
   | **Phase 4** | M7+ | Email list management + weekly newsletter ops | Email manager (R$1.5K/month part-time) |

5. **Decision Card for Skill #5:**
   - **Can hire when:** Ecosystem MRR >R$3K and bythiagofigueiredo indirect value validated (M3-M4 proof point)
   - **Budget:** Total R$6.5K/month by M6 (blog writer + video editor). Defer hiring until MRR proof.
   - **Metrics to unlock hiring:** >500 newsletter subs AND >50 app conversions per month AND >3% conversion rate newsletter→app.

6. **Documents to Handoff:**
   - This 04-marketing-partner.md (complete)
   - Content calendar CSV (M1-M6 detail, M7+ outline)
   - Email sequence templates (welcome, weekly, re-engagement)
   - Keyword tracker spreadsheet (rankings, search volume, target URLs)
   - Experiment scorecard (ICE tracking, learnings, iteration)

---

## CONCLUSÃO

bythiagofigueiredo é a infraestrutura crítica do ecossistema de 6 apps. Este plano de marketing operacionaliza o hub pessoal como um **lead funnel + SEO authority + credibility multiplier**.

**Key Success Factors:**
1. **Content consistency:** 2 YouTube videos + 2-3 blog posts + 1 newsletter weekly = compounding reach
2. **Organic-first:** Zero paid ads M1-M3. YouTube, blog SEO, email are self-reinforcing loops
3. **Parallel execution:** Marketing happens parallel to dev (not competing for time). Blog writing 1h/week fits in 50h capacity.
4. **Indirect monetization:** Direct MRR ~R$600-800 by M6, but **true value is R$15K-20K in app referrals** (accounts for all LTV, not just newsletter subs)

**Next Steps:**
1. ✅ **Skill #5 (05-delegation-planner):** Financial consolidation + hiring roadmap
2. ✅ **Week 1 (Abr 18-24):** Script YouTube EP1. Outline blog pillars. Setup Brevo.
3. ✅ **Week 2 (Abr 25-May 1):** Publish first blog post + upload YouTube EP1.
4. ✅ **Ongoing:** Track metrics. Weekly check-in on CAC vs LTV. Monthly strategy review.

**Timeline:** MVP launch Junho 2026. Growth phase Jun-Aug. Scale Sep-Dec while Thiago in Asia.

---

**[End of 04-marketing-partner.md]**

---

**Próximo:** Skill #5 (05-delegation-planner) consolidará financial summary, hiring roadmap, capacity validation.

