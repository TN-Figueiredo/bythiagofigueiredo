# 01 — Idea Validator: bythiagofigueiredo (Hub Central + CMS Engine)

> **Pipeline:** 01-idea-validator → 02-code-library → 03-roadmap-creator → 04-marketing-partner → 05-delegation-planner
> **Avaliado por:** CPO (IA) | **Data:** 2026-04-12 | **Atualizado:** Incorpora visão CMS Hub ("OneRing")

---

## ⚡ Classificação Especial: MUST-HAVE (Bypass Scoring)

**bythiagofigueiredo NÃO compete por slot de desenvolvimento no pipeline de 6 apps.** É infraestrutura do ecossistema — o hub central que:

1. Conecta marca pessoal, YouTube, e todos os apps
2. Captura leads (newsletter) e alimenta funil de todos os produtos
3. **[NOVO — 2026-04-12]** Serve como CMS Engine ("OneRing") que gerencia e distribui conteúdo para TODOS os content sites do ecossistema

**Sem bythiagofigueiredo, os outros apps são ilhas desconectadas.** O hub é o multiplicador de tudo.

### Por que Bypass?

O IV framework (Seção 12 — Mix Estratégico) assume apps que geram MRR direto. bythiagofigueiredo gera valor de 3 formas indiretas:

| Valor | Como |
|-------|------|
| **Lead capture** | Newsletter → funil para todos os apps (subscriber vira user de TNG, MEISimples, etc.) |
| **SEO orgânico** | Blog posts rankeiam e trazem tráfego → distribui para apps via product placement |
| **Credibilidade** | Site profissional → sponsorship, collabs, autoridade como dev creator |
| **[NOVO] CMS Engine** | Painel único que gerencia blog posts para bythiagofigueiredo + tonagarantia + devtoolkit + creatorforge + travelcalc + calchub |

**Analogia:** bythiagofigueiredo é para o ecossistema o que YouTube é para Thiago — não gera MRR direto, mas sem ele, nada escala.

---

## Definição Atualizada (Abr 2026)

**Nome:** bythiagofigueiredo — Hub Pessoal + CMS Engine do Ecossistema
**URL:** bythiagofigueiredo.com
**Stack:** Next.js 15, React 19, Tailwind CSS 4, Supabase, Vercel, Brevo, GTM, Turnstile
**Path:** `personal/bythiagofigueiredo`

### O Que É

1. **Site pessoal profissional** — Homepage, bio, social links, portfolio de apps
2. **Blog engine bilíngue** — Posts em MDX (PT+EN) com tradução assistida por AI
3. **Campaign & lead capture** — Landing pages dinâmicas, newsletter segmentada, UTM tracking
4. **[NOVO] CMS Engine ("OneRing")** — Admin panel que gerencia e distribui conteúdo para TODOS os sites do ecossistema

### O Que NÃO É

- ❌ Não é um produto SaaS vendável (avaliado como "OneRing CMS" — score 62/125, ⛔ rejeitado)
- ❌ Não é CMS genérico para terceiros
- ❌ Não compete com WordPress/Ghost/Contentful
- ✅ É infraestrutura interna exclusiva do Thiago

---

## Atualização CMS Hub ("OneRing") — 2026-04-12

### Contexto

A visão original de um "CMS que controla todos os outros" (inspirada nos Anéis de Poder do Senhor dos Anéis) foi avaliada como produto SaaS e rejeitada (62/125). Porém, como **infraestrutura interna**, a ideia é excelente:

- Thiago escreve um post UMA vez no admin do bythiagofigueiredo
- Marca checkboxes de destino: ☑ bythiagofigueiredo ☑ tonagarantia ☐ devtoolkit ☐ creatorforge
- Cada site puxa os posts relevantes com sua própria identidade visual
- Um painel único, uma base de dados, distribuição para N sites

### Schema Additions (sobre o schema existente no brainstorming)

```sql
-- =============================================================
-- 003_cms_hub.sql — CMS Engine ("OneRing") tables
-- =============================================================

-- Sites do ecossistema (cada "anel de poder")
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,             -- 'bythiagofigueiredo', 'tonagarantia', 'devtoolkit', etc.
  name TEXT NOT NULL,                    -- 'By Thiago Figueiredo', 'TôNaGarantia', etc.
  domain TEXT,                           -- 'bythiagofigueiredo.com', 'tonagarantia.com.br', etc.
  description TEXT,
  primary_lang TEXT DEFAULT 'pt' CHECK (primary_lang IN ('en', 'pt')),
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',             -- site-specific settings (branding, SEO defaults, etc.)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Junction: qual post aparece em quais sites
CREATE TABLE post_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  is_featured BOOLEAN DEFAULT false,     -- post destacado naquele site
  custom_slug TEXT,                      -- slug override para o site (opcional)
  custom_excerpt TEXT,                   -- excerpt override para o site (opcional)
  published_at TIMESTAMPTZ,             -- publicação pode ser em datas diferentes por site
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, site_id)
);

-- Indexes
CREATE INDEX idx_post_sites_site ON post_sites(site_id);
CREATE INDEX idx_post_sites_post ON post_sites(post_id);
CREATE INDEX idx_post_sites_published ON post_sites(site_id, published_at DESC) WHERE published_at IS NOT NULL;

-- RLS
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active sites" ON sites
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public can read published post_sites" ON post_sites
  FOR SELECT USING (published_at IS NOT NULL AND published_at <= now());

-- Admin full access (ambas tabelas)
CREATE POLICY "Admin manages sites" ON sites
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin manages post_sites" ON post_sites
  FOR ALL USING (auth.role() = 'authenticated');

-- Seed: sites iniciais
INSERT INTO sites (slug, name, domain, primary_lang) VALUES
  ('bythiagofigueiredo', 'By Thiago Figueiredo', 'bythiagofigueiredo.com', 'en'),
  ('tonagarantia', 'TôNaGarantia', 'tonagarantia.com.br', 'pt');
-- Adicionar conforme novos sites surgirem:
-- ('devtoolkit', 'DevToolKit', 'devtoolkit.io', 'en'),
-- ('creatorforge', 'CreatorForge', 'creatorforge.io', 'en'),
-- ('travelcalc', 'TravelCalc', 'travelcalc.io', 'en'),
-- ('calchub', 'CalcHub', 'calchub.io', 'en'),
-- ('meisimples', 'MEISimples', 'meisimples.com.br', 'pt'),
```

### Alteração no blog_posts existente

```sql
-- Adicionar flag para indicar se post é "hub-only" ou distribuível
ALTER TABLE blog_posts ADD COLUMN is_hub_only BOOLEAN DEFAULT false;
-- is_hub_only = true → aparece SÓ no bythiagofigueiredo (posts pessoais)
-- is_hub_only = false → pode ser distribuído para outros sites via post_sites
```

### Como Sites Externos Consomem

Cada site do ecossistema tem 3 opções de consumo (do mais simples ao mais robusto):

| Opção | Como | Quando Usar |
|-------|------|-------------|
| **A. API Route** | `GET /api/v1/posts?site=tonagarantia` retorna JSON | Sites com frontend próprio (TNG web admin já tem Next.js) |
| **B. Supabase Direct** | Query direto no Supabase com RLS filtrado por `site_id` | Sites no mesmo projeto Supabase |
| **C. RSC/Server Component** | Import de função `getPostsBySite('tonagarantia')` em apps Next.js | Apps no mesmo deploy ou monorepo futuro |

**Recomendação para TôNaGarantia:** Opção B (Supabase direct). TNG web admin já usa Supabase — adicionar query de posts filtrada por `site_id = 'tonagarantia'` é ~2h de trabalho.

### Impacto no Roadmap (Faseamento)

| Fase | O que | Quando | Esforço | Dependência |
|------|-------|--------|---------|-------------|
| **Fase 1** | Admin panel + Blog bythiagofigueiredo (já no brainstorming MVP) | Semana 1-4 | ~102h | Nenhuma |
| **Fase 2** | Tabelas `sites` + `post_sites` + checkboxes no admin + API `/api/v1/posts` | Semana 5-6 | ~16h | Fase 1 completa |
| **Fase 3** | Blog no tonagarantia.com.br consumindo posts via Supabase | Quando TNG web for atualizado | ~8h | Fase 2 + TNG web update |
| **Fase 4** | Novos sites (DevToolKit, CreatorForge, etc.) registrados e consumindo | Conforme cada app lança | ~2h por site | Fase 2 |

**Fase 2 é a única adição nova. São ~16h incrementais sobre o brainstorming original:**
- `sites` CRUD no admin (~4h)
- `post_sites` junction + checkboxes de destino no editor de post (~6h)
- API route `/api/v1/posts?site={slug}` (~3h)
- Testes (~3h)

### Admin UX do CMS Hub

Na tela de edição de post, abaixo do editor:

```
┌─────────────────────────────────────────────┐
│ 📡 Distribuição                             │
│                                             │
│ Publicar em:                                │
│ ☑ bythiagofigueiredo.com    [Publicado]     │
│ ☑ tonagarantia.com.br      [Agendar ▼]     │
│ ☐ devtoolkit.io            [—]             │
│ ☐ creatorforge.io          [—]             │
│                                             │
│ ☐ Hub-only (não distribuir)                 │
│                                             │
│ Overrides por site:                         │
│ tonagarantia: [Excerpt customizado...]      │
│               [Slug: /blog/como-organizar]  │
└─────────────────────────────────────────────┘
```

---

## Gates & Red Flags (Formality — Bypass Scoring)

### G0 — Founder-Market Fit
Alta Expertise × Alta Paixão → 🟢 **PASSA**
Thiago É o bythiagofigueiredo. Zero gap.

### G1 — Problem-First
O problema é vivido: "Tenho 7 apps, 2 canais YouTube, Instagram, mas nenhum ponto central que conecte tudo." Evidência T2 (comportamento observado — site atual é link tree sem conteúdo).
🟢 **PASSA**

### G2 — Demanda Verificável
Dev creators com sites profissionais (Josh Comeau, Fireship, Lee Robinson) validam que o modelo funciona.
🟢 **PASSA**

### Red Flags
Todos ❌ NÃO. Nenhum red flag ativado. (100% TNG stack, sem regulatória, sem marketplace, sem enterprise)

---

## Scoring Informativo (Referência, NÃO decisional)

> **Nota:** Este scoring é informativo para calibração do memory.md. A decisão de GO é baseada no bypass MUST-HAVE, não no score.

| # | Critério | Nota | Peso | Subtotal | Justificativa |
|---|----------|:----:|:----:|:--------:|---------------|
| C1 | Dor Real Validada | 4/5 | 5x | 20/25 | Thiago vive a dor: site atual é link tree sem conteúdo, apps desconectados, sem lead capture, sem blog, sem SEO. Cada app lança sem hub de distribuição. Dor vivida por 6+ meses. Faltam entrevistas externas (mas é infra pessoal, não precisa). |
| C2 | TAM/SAM Acessível | 3/5 | 2x | 6/10 | TAM não se aplica diretamente (é infra, não produto). Como hub de conteúdo, atinge a audiência dos 2 canais YouTube + todos os apps do pipeline. SAM = audiência total de Thiago (~10K-50K reachable). |
| C3 | Pricing Power | 3/5 | 3x | 9/15 | Não gera MRR direto. Valor indireto: lead capture → funil de apps (cada subscriber vale R$5-20 em LTV distribuído). CMS Hub multiplica alcance de cada post. Blog SEO → tráfego orgânico gratuito que substitui ads. |
| C4 | Recorrência Natural | 5/5 | 2x | 10/10 | Publicar conteúdo é semanal/diário. Newsletter é contínua. Lead capture é perpétuo. CMS Hub distribui posts em batch para N sites. |
| C5 | Reuso Stack TNG | 5/5 | 3x | 15/15 | 100% TNG. Admin panel = copy de TNG web. Supabase = mesmo setup. MDX = Next.js nativo. CMS Hub = 2 tabelas + junction + checkboxes. Zero tech nova. |
| C6 | Tempo até MVP | 4/5 | 3x | 12/15 | MVP (Fase 1) = ~3 semanas (102-122h). CMS Hub (Fase 2) = +1 semana (~16h). Total = ~4-5 semanas. Dentro do prazo. |
| C7 | Marketing Orgânico | 4/5 | 2x | 8/10 | O hub É marketing orgânico. Blog posts rankeiam no Google. YouTube direciona pro site. Cada app linka pro hub. Newsletter cresce organicamente. Self-reinforcing. |
| C8 | Sinergia YouTube | 5/5 | 2x | 10/10 | Sinergia MÁXIMA. Todo vídeo YouTube tem link pro site. Todo post do blog pode virar vídeo. Build-in-public do hub é conteúdo. O hub É o conector entre YouTube e apps. |
| C9 | Landscape Competitivo | 5/5 | 1x | 5/5 | Não compete com ninguém. É site pessoal. Nenhum concorrente pode fazer "bythiagofigueiredo.com". |
| C10 | Timing Mercado | 4/5 | 1x | 4/5 | Dev creator economy cresce. "Build in public" é trend. AI-assisted translation é novo. CMS Hub timing perfeito — construir ANTES dos 6 apps lançarem, não depois. |
| C11 | Moat Defensivo | 5/5 | 1x | 5/5 | Marca pessoal é moat absoluto. Ninguém pode copiar "ser o Thiago". Conteúdo acumula. Newsletter é owned media. CMS Hub com dados de todos os sites é lock-in natural. |
| | **TOTAL BASE** | | | **104/125** | |

| # | Bônus | Aplica? | Valor | Justificativa |
|---|-------|---------|-------|---------------|
| B1 | Experiência pessoal | SIM | +3 | Thiago vive o problema TODO DIA — apps desconectados, sem hub, sem lead capture |
| B2 | Cross-promo ecossistema | SIM | +2 | bythiagofigueiredo É o conector de TODOS os apps. Cross-promo é a razão de existir |
| B3 | Creator Serendipity Fit | SIM | +2 | Hub gera 50+ posts, cada post gera vídeo, cada vídeo linka pro hub. Loop infinito. |
| | **TOTAL COM BÔNUS** | | **111/132** | |

```
═══════════════════════════════════════════════════════════════════
PONTUAÇÃO (INFORMATIVA): 104/125 (base) + 7/7 (bônus) = 111/132
ZONA: 🟢 Excelente (bypass — MUST-HAVE independente de score)
DECISÃO: ✅ GO — Já está no roadmap. CMS Hub adiciona ~16h à Fase 2.
═══════════════════════════════════════════════════════════════════
```

---

## Análise de Sensibilidade

Não aplicável — é MUST-HAVE. Mas para registro:

**Maior risco:** M3 (Migração Sanity → Supabase) é o item mais complexo do MVP (36h estimado). Se Portable Text → JSONB der mais trabalho que esperado, o MVP atrasa 1-2 semanas.

**Mitigação:** Manter PortableText format como JSONB no Supabase (mesmo formato, diferente storage). O `PortableTextRenderer.tsx` existente continua funcionando. Migração é de data source, não de formato.

**CMS Hub específico:**
- Se CMS Hub (Fase 2) atrasar, impacto zero no MVP — bythiagofigueiredo funciona standalone sem distribuição cross-site.
- Fase 3 (blog no TNG) só faz sentido quando TNG web tiver update planejado — não é urgente.

---

## Próximos Passos

1. **Imediato:** Seguir brainstorming existente (`2026-04-04-bythiagofigueiredo-website.md`) — MVP Fase 1
2. **Semana 5-6:** Implementar CMS Hub (Fase 2) — tables + admin UI + API
3. **Quando TNG web atualizar:** Integrar blog no tonagarantia.com.br (Fase 3)
4. **Conforme apps lançam:** Registrar cada novo site na tabela `sites` (Fase 4, ~2h por site)

---

## Dados para Pipeline

### Metadados
- **Slug:** bythiagofigueiredo
- **Data Avaliação:** 2026-04-12
- **Score Total:** 104/125 (informativo) — MUST-HAVE bypass
- **Zona:** 🟢 GO (bypass)

### Resumo Executivo (para skills seguintes)
- **Nome:** bythiagofigueiredo — Hub Pessoal + CMS Engine
- **Problema:** Apps desconectados, sem hub central, sem lead capture, sem blog, sem distribuição de conteúdo cross-site
- **Persona:** Thiago (único usuário do admin)
- **Modelo de Receita:** Indireto — lead capture, SEO, credibilidade, distribuição
- **Mercado:** Global (bilíngue PT+EN)
- **Plataformas:** Web only (Next.js 15)
- **Score C5 (Reuso TNG):** 15/15 (100% TNG)
- **Deadline:** MVP ~3-4 semanas + CMS Hub +1 semana
- **MRR Potencial:** Indireto — amplifica MRR de TODOS os outros apps

### Scores Detalhados
| Critério | Score | Peso | Total |
|----------|:-----:|:----:|:-----:|
| C1 — Dor | 4/5 | ×5 | 20/25 |
| C2 — TAM/SAM | 3/5 | ×2 | 6/10 |
| C3 — Pricing | 3/5 | ×3 | 9/15 |
| C4 — Recorrência | 5/5 | ×2 | 10/10 |
| C5 — Reuso TNG | 5/5 | ×3 | 15/15 |
| C6 — Tempo MVP | 4/5 | ×3 | 12/15 |
| C7 — Marketing | 4/5 | ×2 | 8/10 |
| C8 — Sinergia YT | 5/5 | ×2 | 10/10 |
| C9 — Competição | 5/5 | ×1 | 5/5 |
| C10 — Timing | 4/5 | ×1 | 4/5 |
| C11 — Moat | 5/5 | ×1 | 5/5 |
| **TOTAL** | | | **104/125** |

### Diferença vs Avaliação "OneRing CMS" (Produto SaaS)

| Aspecto | OneRing CMS (Produto) | bythiagofigueiredo CMS Hub (Infra) |
|---------|:---------------------:|:----------------------------------:|
| Score | 62/125 ⛔ | 104/125 🟢 |
| Competição | WordPress, Ghost, 200+ (C9=1) | Nenhuma — site pessoal (C9=5) |
| Reuso TNG | 35% (C5=2) | 100% (C5=5) |
| Tempo MVP | 13-15 semanas (C6=2) | 4-5 semanas (C6=4) |
| Pricing | R$30-50/mês vs grátis (C3=2) | Indireto — amplifica tudo (C3=3) |
| Escopo | Editor WYSIWYG + newsletter engine + multi-tenant + widgets | MDX + 2 tabelas + checkboxes + API route |

**A mesma visão. Execução radicalmente diferente. Score: +42 pontos.**
