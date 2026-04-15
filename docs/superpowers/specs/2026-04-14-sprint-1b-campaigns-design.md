# Sprint 1b — Campaigns Design

**Data:** 2026-04-14
**Sprint:** 1b (Campaigns — épicos 6–8 do Sprint 1 no roadmap)
**Horas estimadas:** 18h
**Depende de:** Sprint 1a (auth + CMS shell + RLS helpers)
**Desbloqueia:** Sprint 2 (CMS engine)

## Goal

Sistema de landing pages de campanha com form de captura → Brevo + entrega de PDF. Schema multi-site/multi-locale desde já. Scheduling de publicação (blog + campaign) via cron compartilhado.

## Exit criteria

- [ ] Schema `campaigns`, `campaign_translations`, `campaign_submissions` criado + RLS
- [ ] Bucket Supabase Storage `campaign-files` provisionado via migration (SQL insert em `storage.buckets`)
- [ ] Landing page renderiza via `/campaigns/[slug]` (Next route com locale detection)
- [ ] Form submission: Next route handler valida consent LGPD → insere em `campaign_submissions` → cria contato Brevo → gera signed URL do PDF
- [ ] Cron `/api/cron/publish-scheduled` promove `status=scheduled` para `published` (blog + campaigns) a cada 5min
- [ ] Turnstile (Cloudflare) protegendo form contra spam
- [ ] `cron_runs` log table populando
- [ ] `npm test` verde

## Schema

### `campaigns`

```sql
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  site_id uuid,                                       -- null = bythiagofigueiredo
  interest text not null,                             -- 'creator'|'fitness'|'style'|livre
  status post_status not null default 'draft',        -- enum compartilhado com blog (S1a)
  pdf_storage_path text,                              -- path em bucket 'campaign-files'
  brevo_list_id int,
  brevo_template_id int,
  form_fields jsonb not null default '[]',            -- [{ name, label, type, required, placeholder, options? }]
  scheduled_for timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index on campaigns (status, published_at desc);
create index on campaigns (status, scheduled_for) where status = 'scheduled';
```

### `campaign_translations`

```sql
create table campaign_translations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  locale text not null,

  -- SEO
  meta_title text,
  meta_description text,
  og_image_url text,
  slug text not null,

  -- beforeForm
  main_hook_md text not null,
  supporting_argument_md text,
  introductory_block_md text,
  body_content_md text,

  -- form
  form_intro_md text,
  form_button_label text not null default 'Enviar',
  form_button_loading_label text not null default 'Enviando...',

  -- afterForm
  context_tag text not null,
  success_headline text not null,
  success_headline_duplicate text not null,
  success_subheadline text not null,
  success_subheadline_duplicate text not null,
  check_mail_text text not null,
  download_button_label text not null,

  -- extras (youtube embed, testimonials, whoAmI, whatsappCtas) — jsonb livre
  extras jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index on campaign_translations (campaign_id, locale);
-- slug único por (site, locale) via trigger (igual blog)
create unique index on campaign_translations (campaign_id, locale, slug);
```

Estrutura espelha `campaignContent` do Sanity antigo (beforeForm / form / afterForm). Portable Text foi decomposto em colunas Markdown + `extras jsonb` pros blocos não-textuais.

### `campaign_submissions`

```sql
create table campaign_submissions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete restrict,
  email citext not null,
  name text,
  locale text not null,
  interest text,

  -- LGPD
  consent_marketing boolean not null,
  consent_text_version text not null,            -- ex: 'v1-2026-04'
  ip inet,
  user_agent text,

  -- Brevo sync
  brevo_contact_id text,
  brevo_sync_status text not null default 'pending',  -- pending|synced|failed
  brevo_sync_error text,
  brevo_synced_at timestamptz,

  -- PDF download tracking
  downloaded_at timestamptz,
  download_count int not null default 0,

  -- LGPD phase 2+ anonymization
  anonymized_at timestamptz,

  submitted_at timestamptz not null default now()
);

create unique index on campaign_submissions (campaign_id, email) where anonymized_at is null;
create index on campaign_submissions (brevo_sync_status) where brevo_sync_status = 'pending';
```

`citext` extension precisa estar habilitada (`create extension if not exists citext`).

### `cron_runs`

```sql
create table cron_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,                      -- 'publish-scheduled'
  ran_at timestamptz not null default now(),
  status text not null,                   -- 'ok'|'error'
  duration_ms int,
  items_processed int,
  error text
);
create index on cron_runs (job, ran_at desc);
```

### Storage bucket

```sql
insert into storage.buckets (id, name, public)
values ('campaign-files', 'campaign-files', false)
on conflict (id) do nothing;

-- RLS: só service_role escreve; leitura via signed URL gerada server-side
create policy "campaign-files staff write" on storage.objects
  for all to authenticated
  using (bucket_id = 'campaign-files' and auth.is_staff())
  with check (bucket_id = 'campaign-files' and auth.is_staff());
```

## RLS

**`campaigns`**: select pública `status='published' AND published_at<=now()`; escrita staff.
**`campaign_translations`**: mesma via join em `campaigns.status`.
**`campaign_submissions`**: insert pública permitida (form público) mas **validada por trigger** (Turnstile token + consent_marketing true). Select só staff. Update só service role (pra Brevo sync + download tracking).
**`cron_runs`**: insert/select service role only.

Trigger `validate_submission_before_insert()`:
- Verifica `consent_marketing = true` senão raise
- Verifica `turnstile_token` (passado via parâmetro de sessão `current_setting('app.turnstile_verified', true)`) — ou validação feita no route handler antes do insert (mais simples).

**Decisão: validação Turnstile no route handler, não no trigger.** Trigger só valida `consent_marketing = true`.

## Fluxo de submissão

1. Cliente preenche form na landing `/campaigns/[locale]/[slug]`.
2. Client-side: Turnstile gera token invisível.
3. `POST /api/campaigns/[slug]/submit` (Next route handler) com `{ email, name, campaignId, locale, consent_marketing, consent_text_version, turnstile_token }`.
4. Handler:
   a. Valida Turnstile token contra `https://challenges.cloudflare.com/turnstile/v0/siteverify`. Se falhar → 400.
   b. Valida consent_marketing=true (Zod). Senão → 400.
   c. Insert em `campaign_submissions` (via service role, captura `ip` + `user_agent` do request). Duplicate key (email já existe) → retorna success com flag `duplicate=true` (UX mostra `success_headline_duplicate`).
   d. Tenta sync Brevo: cria contato via API, adiciona ao `brevo_list_id`. Se falhar → marca `brevo_sync_status='failed'`, registra erro, log Sentry, mas **não aborta** (submission já persistiu).
   e. Gera signed URL do PDF (`supabase.storage.from('campaign-files').createSignedUrl(pdf_storage_path, 7*24*3600)`).
   f. Retorna `{ success: true, duplicate: boolean, pdfUrl: string, successCopy: { headline, subheadline, checkMailText, downloadButtonLabel } }`.
5. Cliente mostra estado afterForm + botão download.

### Retry de Brevo

Sprint 1b não tem queue. Admin UI (Sprint 2+) lista submissions com `brevo_sync_status='failed'` + botão "Retry sync" manual. Suficiente pro volume inicial.

## Cron (scheduling)

### `/api/cron/publish-scheduled`

Next route handler em `apps/web/app/api/cron/publish-scheduled/route.ts`:

```typescript
export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return new Response('unauthorized', { status: 401 });

  const start = Date.now();
  let processed = 0;
  try {
    const { data: posts } = await supabaseService
      .from('blog_posts')
      .update({ status: 'published', published_at: 'now()' })
      .eq('status', 'scheduled')
      .lte('scheduled_for', new Date().toISOString())
      .select('id');
    processed += posts?.length ?? 0;

    const { data: camps } = await supabaseService
      .from('campaigns')
      .update({ status: 'published', published_at: 'now()' })
      .eq('status', 'scheduled')
      .lte('scheduled_for', new Date().toISOString())
      .select('id');
    processed += camps?.length ?? 0;

    await supabaseService.from('cron_runs').insert({
      job: 'publish-scheduled', status: 'ok',
      duration_ms: Date.now() - start, items_processed: processed,
    });
    return Response.json({ processed });
  } catch (e) {
    Sentry.captureException(e);
    await supabaseService.from('cron_runs').insert({
      job: 'publish-scheduled', status: 'error',
      duration_ms: Date.now() - start, error: String(e),
    });
    return new Response('error', { status: 500 });
  }
}
```

Vercel Cron config (`apps/web/vercel.json`):
```json
{ "crons": [{ "path": "/api/cron/publish-scheduled", "schedule": "*/5 * * * *" }] }
```

## Web — landing page render

`apps/web/app/campaigns/[locale]/[slug]/page.tsx`:
1. Server component busca `campaigns` + `campaign_translations` por `(slug, locale)`.
2. Renderiza 3 seções (beforeForm, form, afterForm) em componentes separados.
3. Form é client component com Turnstile + estado local (submitted/error).
4. Markdown campos renderizados via `react-markdown + remark-gfm`.
5. `extras` (YouTube, testimonials, whoAmI, whatsappCtas) em componentes discriminated union.

## Brevo integration

**Lib:** cliente HTTP direto (`fetch` + `p-retry`). Sem SDK oficial pra evitar peso.

```typescript
// apps/web/lib/brevo.ts
export async function createBrevoContact(params: {
  email: string; name?: string; listId: number; attributes?: Record<string, unknown>;
}) {
  const r = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      email: params.email,
      listIds: [params.listId],
      attributes: { FIRSTNAME: params.name, ...params.attributes },
      updateEnabled: true,
    }),
  });
  if (!r.ok) throw new Error(`brevo ${r.status}: ${await r.text()}`);
  return r.json();
}
```

Env vars novas: `BREVO_API_KEY`, `TURNSTILE_SITE_KEY` (public), `TURNSTILE_SECRET_KEY`.

## Testes

### RLS
- anon insere em `campaign_submissions` com `consent_marketing=true` → ok
- anon insere com `consent_marketing=false` → trigger rejeita
- anon lê `campaigns` published → ok; draft → não vê
- anon não lê `campaign_submissions`
- staff lê tudo

### Route handler
- Submit válido → 200, row criada, signed URL retornada
- Submit com Turnstile inválido → 400
- Submit sem consent → 400
- Submit duplicado (mesmo email + campaign) → 200 `{duplicate: true}`
- Brevo falhando → submission persiste, status `failed`, Sentry chamado (mock)

### Cron
- POST sem Bearer → 401
- POST com Bearer correto promove scheduled→published
- Cron com 0 items → retorna `{processed: 0}`, cron_runs registra ok

## Seed (dev)

- 1 campaign pt-BR + en publicada (interest=creator), com PDF placeholder em storage
- 1 campaign draft
- 3 submissions fake (1 synced, 1 failed, 1 pending)

## Migrations (ordem)

```
20260414000010_citext_extension.sql
20260414000011_campaigns_schema.sql
20260414000012_campaigns_rls.sql
20260414000013_campaign_submissions.sql
20260414000014_campaign_submissions_rls.sql
20260414000015_storage_bucket_campaign_files.sql
20260414000016_cron_runs.sql
```

## ADRs embutidos

- **ADR-1b-1: Brevo sync inline** (sem queue) — suficiente pro volume S1. Reavaliar quando volume > 100/dia ou latência > 2s.
- **ADR-1b-2: Turnstile** escolhido sobre hCaptcha — free tier generoso, sem branding obrigatório, mesma vendor (Cloudflare) do DNS.
- **ADR-1b-3: PDF signed URL com TTL 7 dias** — balanceia UX (usuário pode baixar depois) com vazamento de link. Regenerável sob demanda na página de sucesso.
- **ADR-1b-4: Duplicate detection por email único** — submissions com `anonymized_at IS NOT NULL` não bloqueiam novo signup (LGPD respeitada).

## Out of scope

- Admin UI para criar/editar campaigns → **Sprint 2** (`/cms/campaigns/[id]/edit`)
- Retry automático Brevo → Sprint 3+ (queue)
- A/B testing de landings → fora do roadmap atual
- Analytics de conversão → Sprint 4 (Sentry + Plausible/Umami)
- Email de confirmação pós-submit (double opt-in) → Sprint 3 (newsletter)

## Riscos

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Brevo API rate limit (400/min free) | Baixa | Médio | Inline + retry 3x; volume S1 baixo |
| Turnstile falso positivo bloqueia user legítimo | Baixa | Baixo | Log 400s, revisar taxa; fallback manual |
| Storage bucket RLS vazar PDF | Média | Alto | Só signed URL; bucket privado; testar em staging |
| Cron duplicar publish em concorrência | Baixa | Baixo | `update ... where status='scheduled'` é atômico |
| jsonb `extras` crescer sem schema → render quebra | Média | Médio | Zod parse em runtime no componente; discriminated union estrita |
