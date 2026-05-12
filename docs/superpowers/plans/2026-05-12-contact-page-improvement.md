# Contact Page Improvement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the minimal contact page into a rich Pinboard-themed page with CMS-configurable settings per locale, leveraging existing author data.

**Architecture:** Two new DB tables (`contact_page_settings` per-locale, `contact_page_visibility` per-site) store CMS config. Public page fetches settings + default author data in parallel. CMS admin adds a "Contact Page" section to `settings-connected.tsx` with 5 sub-tabs. Existing contact form gains optional subject selector and CMS-driven labels.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, Supabase (PostgreSQL 17), Zod, Vitest, Pinboard design system (Paper/Tape/CSS tokens)

**Spec:** `docs/superpowers/specs/2026-05-12-contact-page-improvement-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/YYYYMMDDHHMMSS_contact_page_settings.sql` | DB tables, RLS, triggers, seed |
| `apps/web/src/app/(public)/contact/_components/hero-section.tsx` | Hero: title, subtitle, avatar, bio, badge |
| `apps/web/src/app/(public)/contact/_components/social-links-column.tsx` | Social cards with copy-to-clipboard |
| `apps/web/src/app/(public)/contact/_components/faq-section.tsx` | Accordion FAQ |
| `apps/web/src/app/(public)/contact/_components/contact-form-card.tsx` | Paper card wrapping ContactForm |
| `apps/web/src/app/(public)/contact/_components/success-state.tsx` | Post-submit success message |
| `apps/web/src/lib/contact/types.ts` | Shared TypeScript interfaces |
| `apps/web/src/lib/contact/defaults.ts` | Fallback values when no CMS config exists |
| `apps/web/test/app/contact-settings-actions.test.ts` | CMS server action tests |
| `apps/web/test/components/contact-page.test.tsx` | Component render tests |

### Modified Files
| File | Changes |
|------|---------|
| `apps/web/src/app/cms/(authed)/settings/page.tsx` | Add contact settings + visibility + author queries |
| `apps/web/src/app/cms/(authed)/settings/actions.ts` | Add 7 new server actions |
| `apps/web/src/app/cms/(authed)/settings/settings-connected.tsx` | Add `contact-page` section with 5 sub-tabs |
| `apps/web/src/app/(public)/contact/page.tsx` | Fetch CMS settings, render new components |
| `apps/web/src/app/(public)/contact/actions.ts` | Add subject field to schema + insert |
| `apps/web/src/components/contact-form.tsx` | Accept CMS-driven props, subject selector |
| `apps/web/src/locales/en.json` | Contact page fallback keys |
| `apps/web/src/locales/pt-BR.json` | Contact page fallback keys |
| `apps/web/test/app/contact-actions.test.ts` | Add subject field test cases |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260512120000_contact_page_settings.sql`

- [ ] **Step 1: Create migration file**

```bash
npx supabase migration new contact_page_settings
```

Rename the generated file to match convention, then write:

```sql
BEGIN;

-- ═══════════════════════════════════════════════════════
-- 1. contact_page_settings (per-site, per-locale)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.contact_page_settings (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id            uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  locale             text        NOT NULL,
  hero_title         text        NOT NULL DEFAULT '',
  hero_subtitle      text        DEFAULT '',
  response_time_text text        DEFAULT '',
  form_title         text        DEFAULT '',
  auto_reply_text    text        DEFAULT '',
  subject_options    jsonb       DEFAULT '[]'::jsonb,
  faq_items          jsonb       DEFAULT '[]'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, locale),
  CONSTRAINT cps_hero_title_len CHECK (char_length(hero_title) <= 80),
  CONSTRAINT cps_hero_subtitle_len CHECK (char_length(hero_subtitle) <= 300),
  CONSTRAINT cps_response_time_len CHECK (char_length(response_time_text) <= 100),
  CONSTRAINT cps_form_title_len CHECK (char_length(form_title) <= 100),
  CONSTRAINT cps_auto_reply_len CHECK (char_length(auto_reply_text) <= 500),
  CONSTRAINT cps_subject_options_arr CHECK (
    subject_options IS NULL OR jsonb_typeof(subject_options) = 'array'
  ),
  CONSTRAINT cps_faq_items_arr CHECK (
    faq_items IS NULL OR jsonb_typeof(faq_items) = 'array'
  )
);

ALTER TABLE public.contact_page_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cps_public_read" ON public.contact_page_settings;
CREATE POLICY "cps_public_read"
  ON public.contact_page_settings FOR SELECT
  USING (public.site_visible(site_id));

DROP POLICY IF EXISTS "cps_staff_insert" ON public.contact_page_settings;
CREATE POLICY "cps_staff_insert"
  ON public.contact_page_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "cps_staff_update" ON public.contact_page_settings;
CREATE POLICY "cps_staff_update"
  ON public.contact_page_settings FOR UPDATE
  TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "cps_staff_delete" ON public.contact_page_settings;
CREATE POLICY "cps_staff_delete"
  ON public.contact_page_settings FOR DELETE
  TO authenticated
  USING (public.can_edit_site(site_id));

DROP TRIGGER IF EXISTS "cps_set_updated_at" ON public.contact_page_settings;
CREATE TRIGGER "cps_set_updated_at"
  BEFORE UPDATE ON public.contact_page_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ═══════════════════════════════════════════════════════
-- 2. contact_page_visibility (per-site, locale-independent)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.contact_page_visibility (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE UNIQUE,
  show_hero              boolean     DEFAULT true,
  show_social_links      boolean     DEFAULT true,
  show_contact_form      boolean     DEFAULT true,
  show_faq               boolean     DEFAULT true,
  show_avatar            boolean     DEFAULT true,
  show_bio               boolean     DEFAULT true,
  show_response_badge    boolean     DEFAULT true,
  social_order           jsonb       DEFAULT '["email","instagram","youtube","x","github","rss"]'::jsonb,
  social_visible         jsonb       DEFAULT '{"email":true,"instagram":true,"youtube":true,"x":true,"github":true,"rss":true}'::jsonb,
  email_highlight        boolean     DEFAULT true,
  handwritten_note       boolean     DEFAULT true,
  show_subject_selector  boolean     DEFAULT true,
  show_marketing_consent boolean     DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_page_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cpv_public_read" ON public.contact_page_visibility;
CREATE POLICY "cpv_public_read"
  ON public.contact_page_visibility FOR SELECT
  USING (public.site_visible(site_id));

DROP POLICY IF EXISTS "cpv_staff_insert" ON public.contact_page_visibility;
CREATE POLICY "cpv_staff_insert"
  ON public.contact_page_visibility FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "cpv_staff_update" ON public.contact_page_visibility;
CREATE POLICY "cpv_staff_update"
  ON public.contact_page_visibility FOR UPDATE
  TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "cpv_staff_delete" ON public.contact_page_visibility;
CREATE POLICY "cpv_staff_delete"
  ON public.contact_page_visibility FOR DELETE
  TO authenticated
  USING (public.can_edit_site(site_id));

DROP TRIGGER IF EXISTS "cpv_set_updated_at" ON public.contact_page_visibility;
CREATE TRIGGER "cpv_set_updated_at"
  BEFORE UPDATE ON public.contact_page_visibility
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ═══════════════════════════════════════════════════════
-- 3. Add subject column to contact_submissions
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS subject text DEFAULT NULL;

ALTER TABLE public.contact_submissions
  DROP CONSTRAINT IF EXISTS contact_submissions_subject_len;
ALTER TABLE public.contact_submissions
  ADD CONSTRAINT contact_submissions_subject_len CHECK (char_length(subject) <= 100);

COMMIT;
```

- [ ] **Step 2: Push migration to local DB and verify**

```bash
npm run db:reset
```

Expected: migration applies without errors.

- [ ] **Step 3: Verify tables exist**

```bash
npx supabase db dump --local --schema public | grep -A5 "contact_page_settings\|contact_page_visibility"
```

Expected: both tables listed with columns.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add contact_page_settings and contact_page_visibility tables"
```

---

### Task 2: Shared TypeScript Types and Defaults

**Files:**
- Create: `apps/web/src/lib/contact/types.ts`
- Create: `apps/web/src/lib/contact/defaults.ts`

- [ ] **Step 1: Create types file**

```typescript
// apps/web/src/lib/contact/types.ts

export interface FaqItem {
  q: string
  a: string
}

export interface ContactPageSettings {
  id: string
  site_id: string
  locale: string
  hero_title: string
  hero_subtitle: string
  response_time_text: string
  form_title: string
  auto_reply_text: string
  subject_options: string[]
  faq_items: FaqItem[]
}

export interface ContactPageVisibility {
  id: string
  site_id: string
  show_hero: boolean
  show_social_links: boolean
  show_contact_form: boolean
  show_faq: boolean
  show_avatar: boolean
  show_bio: boolean
  show_response_badge: boolean
  social_order: string[]
  social_visible: Record<string, boolean>
  email_highlight: boolean
  handwritten_note: boolean
  show_subject_selector: boolean
  show_marketing_consent: boolean
}

export interface ContactAuthorData {
  name: string
  avatar_url: string | null
  social_links: Record<string, string>
  headline: string | null
  bio: string | null
}
```

- [ ] **Step 2: Create defaults file**

```typescript
// apps/web/src/lib/contact/defaults.ts

import type { ContactPageSettings, ContactPageVisibility } from './types'

export const DEFAULT_SETTINGS_PT: Omit<ContactPageSettings, 'id' | 'site_id' | 'locale'> = {
  hero_title: 'Vamos conversar?',
  hero_subtitle:
    'Se você quer conversar sobre código, conteúdo, collab, ou só dizer oi — email é o melhor caminho.',
  response_time_text: 'Respondo em 24-48h',
  form_title: 'Manda um salve',
  auto_reply_text: 'Obrigado por entrar em contato! Recebi sua mensagem e respondo em 24-48h.',
  subject_options: [
    '💼 Projeto / Freelance',
    '🤝 Collab / Parceria',
    '💬 Feedback',
    '🎙️ Podcast / Entrevista',
    '🐛 Bug report',
    '👋 Só um oi',
  ],
  faq_items: [
    {
      q: 'Qual o melhor canal pra falar comigo?',
      a: 'Email. Respondo em 24-48h. DM de Instagram funciona pra coisas rápidas.',
    },
    {
      q: 'Aceita freelance?',
      a: 'Depende do projeto. Manda um email descrevendo o escopo e prazo.',
    },
    {
      q: 'Posso mandar PR no seu repo?',
      a: 'Sim. Issues primeiro, PR depois.',
    },
    {
      q: 'Faz collab / participa de podcast?',
      a: 'Sim, se o tema combinar com o que eu faço.',
    },
  ],
}

export const DEFAULT_SETTINGS_EN: Omit<ContactPageSettings, 'id' | 'site_id' | 'locale'> = {
  hero_title: "Let's talk?",
  hero_subtitle:
    "Whether it's about code, content, a collab, or just saying hi — email is the best way.",
  response_time_text: 'I reply within 24-48h',
  form_title: 'Drop a line',
  auto_reply_text: 'Thanks for reaching out! I got your message and will reply within 24-48h.',
  subject_options: [
    '💼 Project / Freelance',
    '🤝 Collab / Partnership',
    '💬 Feedback',
    '🎙️ Podcast / Interview',
    '🐛 Bug report',
    '👋 Just saying hi',
  ],
  faq_items: [
    {
      q: "What's the best way to reach me?",
      a: 'Email. I reply within 24-48h. Instagram DMs work for quick things.',
    },
    {
      q: 'Do you take freelance?',
      a: 'Depends on the project. Send an email describing scope and timeline.',
    },
    {
      q: 'Can I send a PR to your repo?',
      a: 'Yes. Issues first, PR second.',
    },
    {
      q: 'Open to collabs / podcast guest?',
      a: 'Yes, if the topic aligns with what I do.',
    },
  ],
}

export function getDefaultSettings(locale: string) {
  return locale === 'pt-BR' ? DEFAULT_SETTINGS_PT : DEFAULT_SETTINGS_EN
}

export const DEFAULT_VISIBILITY: Omit<ContactPageVisibility, 'id' | 'site_id'> = {
  show_hero: true,
  show_social_links: true,
  show_contact_form: true,
  show_faq: true,
  show_avatar: true,
  show_bio: true,
  show_response_badge: true,
  social_order: ['email', 'instagram', 'youtube', 'x', 'github', 'rss'],
  social_visible: {
    email: true,
    instagram: true,
    youtube: true,
    x: true,
    github: true,
    rss: true,
  },
  email_highlight: true,
  handwritten_note: true,
  show_subject_selector: true,
  show_marketing_consent: true,
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/contact/
git commit -m "feat(contact): add shared types and default values"
```

---

### Task 3: CMS Server Actions

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/settings/actions.ts`
- Test: `apps/web/test/app/contact-settings-actions.test.ts`

- [ ] **Step 1: Write tests for contact settings actions**

Create `apps/web/test/app/contact-settings-actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before imports
const mockUpdate = vi.fn()
const mockUpsert = vi.fn()
const mockEq = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      update: (...a: unknown[]) => {
        mockUpdate(...a)
        return { eq: (...b: unknown[]) => { mockEq(...b); return { error: null } } }
      },
      upsert: (...a: unknown[]) => {
        mockUpsert(...a)
        return { eq: (...b: unknown[]) => { mockEq(...b); return { error: null } } }
      },
    }),
  }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => ({ siteId: 'site-1', orgId: 'org-1' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: () => ({ ok: true }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

import {
  updateContactHeroText,
  updateContactHeroDisplay,
  updateContactSocial,
  updateContactFormSettings,
  updateContactFormText,
  updateContactFaq,
  updateContactVisibility,
} from '@/app/cms/(authed)/settings/actions'

describe('Contact settings actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updateContactHeroText validates required title', async () => {
    const result = await updateContactHeroText({
      locale: 'pt-BR',
      hero_title: '',
      hero_subtitle: 'test',
      response_time_text: '',
    })
    expect(result.ok).toBe(false)
  })

  it('updateContactHeroText accepts valid input', async () => {
    const result = await updateContactHeroText({
      locale: 'pt-BR',
      hero_title: 'Vamos conversar?',
      hero_subtitle: 'Subtítulo',
      response_time_text: '24-48h',
    })
    expect(result.ok).toBe(true)
    expect(mockUpsert).toHaveBeenCalled()
  })

  it('updateContactHeroDisplay saves visibility toggles', async () => {
    const result = await updateContactHeroDisplay({
      show_avatar: true,
      show_bio: false,
      show_response_badge: true,
    })
    expect(result.ok).toBe(true)
    expect(mockUpsert).toHaveBeenCalled()
  })

  it('updateContactVisibility saves section toggles', async () => {
    const result = await updateContactVisibility({
      show_hero: true,
      show_social_links: true,
      show_contact_form: true,
      show_faq: false,
    })
    expect(result.ok).toBe(true)
  })

  it('updateContactFormSettings validates email', async () => {
    const result = await updateContactFormSettings({
      notification_email: 'not-an-email',
      show_subject_selector: true,
      show_marketing_consent: true,
    })
    expect(result.ok).toBe(false)
  })

  it('updateContactFaq accepts valid FAQ items', async () => {
    const result = await updateContactFaq({
      locale: 'en',
      faq_items: [{ q: 'Question?', a: 'Answer.' }],
    })
    expect(result.ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:web -- --run apps/web/test/app/contact-settings-actions.test.ts
```

Expected: FAIL — functions not exported yet.

- [ ] **Step 3: Implement server actions**

Add to `apps/web/src/app/cms/(authed)/settings/actions.ts` (append after existing actions):

```typescript
// ── Contact Page Settings ──────────────────────────────────────────

const contactHeroTextSchema = z.object({
  locale: z.enum(['pt-BR', 'en']),
  hero_title: z.string().min(1, 'Title is required').max(80),
  hero_subtitle: z.string().max(300).default(''),
  response_time_text: z.string().max(100).default(''),
})

export async function updateContactHeroText(
  input: z.infer<typeof contactHeroTextSchema>,
): Promise<ActionResult> {
  const parsed = contactHeroTextSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { locale, ...data } = parsed.data
  const { error } = await supabase
    .from('contact_page_settings')
    .upsert(
      { site_id: siteId, locale, ...data },
      { onConflict: 'site_id,locale' },
    )
  if (error) return { ok: false, error: error.message }
  revalidatePath('/contact')
  revalidatePath('/pt/contact')
  revalidatePath('/cms/settings')
  return { ok: true }
}

const contactHeroDisplaySchema = z.object({
  show_avatar: z.boolean(),
  show_bio: z.boolean(),
  show_response_badge: z.boolean(),
})

export async function updateContactHeroDisplay(
  input: z.infer<typeof contactHeroDisplaySchema>,
): Promise<ActionResult> {
  const parsed = contactHeroDisplaySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('contact_page_visibility')
    .upsert(
      { site_id: siteId, ...parsed.data },
      { onConflict: 'site_id' },
    )
  if (error) return { ok: false, error: error.message }
  revalidatePath('/contact')
  revalidatePath('/pt/contact')
  revalidatePath('/cms/settings')
  return { ok: true }
}

const contactSocialSchema = z.object({
  social_order: z.array(z.string()),
  social_visible: z.record(z.boolean()),
  email_highlight: z.boolean(),
  handwritten_note: z.boolean(),
})

export async function updateContactSocial(
  input: z.infer<typeof contactSocialSchema>,
): Promise<ActionResult> {
  const parsed = contactSocialSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('contact_page_visibility')
    .upsert(
      { site_id: siteId, ...parsed.data },
      { onConflict: 'site_id' },
    )
  if (error) return { ok: false, error: error.message }
  revalidatePath('/contact')
  revalidatePath('/pt/contact')
  revalidatePath('/cms/settings')
  return { ok: true }
}

const contactFormSettingsSchema = z.object({
  notification_email: z.string().email().max(320).or(z.literal('')),
  show_subject_selector: z.boolean(),
  show_marketing_consent: z.boolean(),
})

export async function updateContactFormSettings(
  input: z.infer<typeof contactFormSettingsSchema>,
): Promise<ActionResult> {
  const parsed = contactFormSettingsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { notification_email, ...visData } = parsed.data
  const results = await Promise.all([
    supabase
      .from('sites')
      .update({ contact_notification_email: notification_email || null })
      .eq('id', siteId),
    supabase
      .from('contact_page_visibility')
      .upsert(
        { site_id: siteId, ...visData },
        { onConflict: 'site_id' },
      ),
  ])
  const err = results.find((r) => r.error)
  if (err?.error) return { ok: false, error: err.error.message }
  revalidatePath('/contact')
  revalidatePath('/pt/contact')
  revalidatePath('/cms/settings')
  return { ok: true }
}

const contactFormTextSchema = z.object({
  locale: z.enum(['pt-BR', 'en']),
  form_title: z.string().max(100).default(''),
  auto_reply_text: z.string().max(500).default(''),
  subject_options: z.array(z.string().max(100)),
})

export async function updateContactFormText(
  input: z.infer<typeof contactFormTextSchema>,
): Promise<ActionResult> {
  const parsed = contactFormTextSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { locale, subject_options, ...data } = parsed.data
  const filteredSubjects = subject_options.filter((s) => s.trim())
  const { error } = await supabase
    .from('contact_page_settings')
    .upsert(
      { site_id: siteId, locale, ...data, subject_options: filteredSubjects },
      { onConflict: 'site_id,locale' },
    )
  if (error) return { ok: false, error: error.message }
  revalidatePath('/contact')
  revalidatePath('/pt/contact')
  revalidatePath('/cms/settings')
  return { ok: true }
}

const contactFaqSchema = z.object({
  locale: z.enum(['pt-BR', 'en']),
  faq_items: z.array(
    z.object({
      q: z.string().max(300),
      a: z.string().max(2000),
    }),
  ),
})

export async function updateContactFaq(
  input: z.infer<typeof contactFaqSchema>,
): Promise<ActionResult> {
  const parsed = contactFaqSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { locale, faq_items } = parsed.data
  const filtered = faq_items.filter((f) => f.q.trim() || f.a.trim())
  const { error } = await supabase
    .from('contact_page_settings')
    .upsert(
      { site_id: siteId, locale, faq_items: filtered },
      { onConflict: 'site_id,locale' },
    )
  if (error) return { ok: false, error: error.message }
  revalidatePath('/contact')
  revalidatePath('/pt/contact')
  revalidatePath('/cms/settings')
  return { ok: true }
}

const contactVisibilitySchema = z.object({
  show_hero: z.boolean(),
  show_social_links: z.boolean(),
  show_contact_form: z.boolean(),
  show_faq: z.boolean(),
})

export async function updateContactVisibility(
  input: z.infer<typeof contactVisibilitySchema>,
): Promise<ActionResult> {
  const parsed = contactVisibilitySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('contact_page_visibility')
    .upsert(
      { site_id: siteId, ...parsed.data },
      { onConflict: 'site_id' },
    )
  if (error) return { ok: false, error: error.message }
  revalidatePath('/contact')
  revalidatePath('/pt/contact')
  revalidatePath('/cms/settings')
  return { ok: true }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:web -- --run apps/web/test/app/contact-settings-actions.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/settings/actions.ts apps/web/test/app/contact-settings-actions.test.ts
git commit -m "feat(cms): add contact page settings server actions with tests"
```

---

### Task 4: CMS Settings Page Data Fetching

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/settings/page.tsx`

- [ ] **Step 1: Add contact queries to the parallel fetch**

In `page.tsx`, add to the existing `Promise.all` block:

```typescript
// Add these to the destructured array:
// const [siteRes, typesRes, cadenceRes, ytChannelsRes, igAccountsRes, contactSettingsRes, contactVisRes, defaultAuthorRes] = await Promise.all([
//   ... existing queries ...

  // Contact page settings (both locales)
  supabase
    .from('contact_page_settings')
    .select('*')
    .eq('site_id', siteId),
  // Contact page visibility
  supabase
    .from('contact_page_visibility')
    .select('*')
    .eq('site_id', siteId)
    .maybeSingle(),
  // Default author + translations for preview
  supabase
    .from('authors')
    .select('id, name, avatar_url, social_links, author_about_translations(locale, headline)')
    .eq('site_id', siteId)
    .eq('is_default', true)
    .maybeSingle(),
// ])
```

- [ ] **Step 2: Pass data to SettingsConnected**

Add props to the JSX:

```typescript
<SettingsConnected
  // ... existing props ...
  contactSettings={contactSettingsRes.data ?? []}
  contactVisibility={contactVisRes.data ?? null}
  defaultAuthor={defaultAuthorRes.data ?? null}
/>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/settings/page.tsx
git commit -m "feat(cms): fetch contact page settings in settings page"
```

---

### Task 5: CMS Settings UI — Contact Page Section

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/settings/settings-connected.tsx`

This is the largest task. It adds the `contact-page` section with 5 sub-tabs to the existing settings UI.

- [ ] **Step 1: Add types and section to SectionId**

Update the `SectionId` type:

```typescript
type SectionId =
  | 'branding'
  | 'seo'
  | 'newsletters'
  | 'blog-cadence'
  | 'youtube'
  | 'instagram'
  | 'contact-page'  // ← NEW
  | 'localization'
  | 'danger-zone'
```

Update the `SECTIONS` array — insert between instagram and localization:

```typescript
const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'branding', label: 'Branding' },
  { id: 'seo', label: 'SEO' },
  { id: 'newsletters', label: 'Newsletters' },
  { id: 'blog-cadence', label: 'Blog Cadence' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'contact-page', label: 'Contact Page' },  // ← NEW
  { id: 'localization', label: 'Localization' },
  { id: 'danger-zone', label: 'Danger Zone' },
]
```

- [ ] **Step 2: Add Props interface fields**

Add to the `Props` interface:

```typescript
interface Props {
  // ... existing fields ...
  contactSettings: Array<{
    locale: string
    hero_title: string
    hero_subtitle: string | null
    response_time_text: string | null
    form_title: string | null
    auto_reply_text: string | null
    subject_options: string[] | null
    faq_items: Array<{ q: string; a: string }> | null
  }>
  contactVisibility: {
    show_hero: boolean
    show_social_links: boolean
    show_contact_form: boolean
    show_faq: boolean
    show_avatar: boolean
    show_bio: boolean
    show_response_badge: boolean
    social_order: string[]
    social_visible: Record<string, boolean>
    email_highlight: boolean
    handwritten_note: boolean
    show_subject_selector: boolean
    show_marketing_consent: boolean
  } | null
  defaultAuthor: {
    name: string
    avatar_url: string | null
    social_links: Record<string, string> | null
    author_about_translations: Array<{ locale: string; headline: string | null }>
  } | null
}
```

- [ ] **Step 3: Add imports for new actions**

```typescript
import {
  // ... existing imports ...
  updateContactHeroText,
  updateContactHeroDisplay,
  updateContactSocial,
  updateContactFormSettings,
  updateContactFormText,
  updateContactFaq,
  updateContactVisibility,
} from './actions'
```

- [ ] **Step 4: Implement ContactPageSection component**

Add a `ContactPageSection` function component inside `settings-connected.tsx` (before `SettingsConnected`). This component manages 5 sub-tabs (hero, social, form, faq, visibility) with independent save states, dirty tracking, locale tabs, and all the interactive controls from the CMS admin v4 mockup.

The component should:
- Accept `contactSettings`, `contactVisibility`, `defaultAuthor`, `site`, and `readOnly` props
- Initialize state from props, falling back to defaults from `@/lib/contact/defaults`
- Use `useSaveState()` per sub-tab
- Track dirty state per sub-tab via `Set<string>`
- Implement unsaved-changes confirmation dialog when switching sub-tabs
- Support `Cmd+S` keyboard shortcut
- Render sub-tab content matching the CMS admin v4 mockup exactly

Reference mockup: `.superpowers/brainstorm/3502-1778590324/content/contact-cms-v4.html`

Key patterns to follow from existing code:
- `sectionCls()` for form wrapper
- `inputCls(hasError)` for inputs
- `labelCls()` for labels
- `SaveButton` with `useSaveState()` hook
- `FieldError` for validation errors
- `useTransition()` for async action calls

- [ ] **Step 5: Wire section into main render**

In the `SettingsConnected` component's main render, add the section:

```typescript
{activeSection === 'contact-page' && (
  <ContactPageSection
    contactSettings={contactSettings}
    contactVisibility={contactVisibility}
    defaultAuthor={defaultAuthor}
    site={site}
    readOnly={readOnly}
  />
)}
```

- [ ] **Step 6: Run type check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/settings/settings-connected.tsx
git commit -m "feat(cms): add Contact Page section to settings UI"
```

---

### Task 6: Update Contact Form Component

**Files:**
- Modify: `apps/web/src/components/contact-form.tsx`
- Modify: `apps/web/test/app/contact-actions.test.ts`

- [ ] **Step 1: Add subject selector and CMS-driven props**

Update the `Props` interface in `contact-form.tsx`:

```typescript
interface Props {
  locale?: string
  submitAction: (formData: FormData) => Promise<ContactResult>
  subjectOptions?: string[]
  showSubject?: boolean
  showMarketing?: boolean
  formTitle?: string
}
```

Add subject selector JSX after the email field (conditionally rendered):

```typescript
{showSubject && subjectOptions && subjectOptions.length > 0 && (
  <div>
    <label htmlFor="contact-subject" className="block text-sm font-medium mb-1">
      {locale === 'pt-BR' ? 'Assunto' : 'Subject'}
    </label>
    <select
      id="contact-subject"
      name="subject"
      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
    >
      <option value="">{locale === 'pt-BR' ? 'Selecione...' : 'Select...'}</option>
      {subjectOptions.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </div>
)}
```

Conditionally render marketing consent:

```typescript
{(showMarketing ?? true) && (
  <label className="flex items-start gap-2 text-sm">
    <input type="checkbox" name="consent_marketing" className="mt-0.5 shrink-0" />
    <span>{s.marketingLabel}</span>
  </label>
)}
```

- [ ] **Step 2: Update contact actions to handle subject**

In `apps/web/src/app/(public)/contact/actions.ts`, update the Zod schema:

```typescript
const ContactSchema = z.object({
  // ... existing fields ...
  subject: z.string().max(100).optional(),
})
```

Update the insert call to include subject:

```typescript
.insert({
  // ... existing fields ...
  subject: input.subject || null,
})
```

- [ ] **Step 3: Add subject test to existing test file**

Add to `apps/web/test/app/contact-actions.test.ts`:

```typescript
it('accepts optional subject field', async () => {
  const fd = makeFormData()
  fd.set('subject', '💼 Project / Freelance')
  const result = await submitContact(fd)
  expect(result.status).toBe('ok')
})
```

- [ ] **Step 4: Run tests**

```bash
npm run test:web -- --run apps/web/test/app/contact-actions.test.ts
```

Expected: all tests PASS including new subject test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/contact-form.tsx apps/web/src/app/\(public\)/contact/actions.ts apps/web/test/app/contact-actions.test.ts
git commit -m "feat(contact): add subject selector and CMS-driven form props"
```

---

### Task 7: Public Contact Page — Pinboard Components

**Files:**
- Create: `apps/web/src/app/(public)/contact/_components/hero-section.tsx`
- Create: `apps/web/src/app/(public)/contact/_components/social-links-column.tsx`
- Create: `apps/web/src/app/(public)/contact/_components/faq-section.tsx`
- Create: `apps/web/src/app/(public)/contact/_components/contact-form-card.tsx`
- Create: `apps/web/src/app/(public)/contact/_components/success-state.tsx`

- [ ] **Step 1: Create HeroSection**

```typescript
// apps/web/src/app/(public)/contact/_components/hero-section.tsx

import type { ContactPageSettings, ContactPageVisibility, ContactAuthorData } from '@/lib/contact/types'

interface Props {
  settings: ContactPageSettings
  visibility: ContactPageVisibility
  author: ContactAuthorData | null
}

export function HeroSection({ settings, visibility, author }: Props) {
  if (!visibility.show_hero) return null

  const words = settings.hero_title.split(' ')
  const lastWord = words.pop()
  const rest = words.join(' ')

  return (
    <section className="text-center max-w-2xl mx-auto pb-10">
      <div className="flex flex-col items-center gap-4">
        {visibility.show_avatar && author?.avatar_url && (
          <div className="w-[72px] h-[72px] rounded-full overflow-hidden border-2 border-pb-accent/30">
            <img src={author.avatar_url} alt={author.name} className="w-full h-full object-cover" />
          </div>
        )}
        {visibility.show_avatar && author && !author.avatar_url && (
          <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-pb-accent to-pb-marker flex items-center justify-center text-2xl font-bold text-pb-bg">
            {author.name.charAt(0)}
          </div>
        )}
      </div>

      <h1 className="font-[family-name:var(--font-fraunces-var)] text-[clamp(28px,5vw,42px)] font-semibold text-pb-ink mt-6 leading-tight">
        {rest}{' '}
        {lastWord && (
          <span className="relative inline-block">
            {lastWord}
            <span className="absolute bottom-0 left-0 right-0 h-[0.35em] bg-pb-marker/40 -z-10 rounded-sm" />
          </span>
        )}
      </h1>

      {settings.hero_subtitle && (
        <p className="font-[family-name:var(--font-source-serif-var)] text-pb-muted text-lg mt-4 leading-relaxed italic">
          {settings.hero_subtitle}
        </p>
      )}

      {visibility.show_bio && author?.bio && (
        <p className="text-pb-muted text-sm mt-3">{author.bio}</p>
      )}

      {visibility.show_response_badge && settings.response_time_text && (
        <div className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full bg-pb-paper border border-pb-line text-xs text-pb-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          {settings.response_time_text}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Create SocialLinksColumn**

```typescript
// apps/web/src/app/(public)/contact/_components/social-links-column.tsx
'use client'

import { useState, useCallback } from 'react'
import type { ContactPageVisibility, ContactAuthorData } from '@/lib/contact/types'

interface SocialItem {
  key: string
  label: string
  handle: string
  url: string
  icon: string
}

const SOCIAL_ICONS: Record<string, string> = {
  email: '✉', instagram: '📸', youtube: '▶️', x: '𝕏', github: '🐙', rss: '📡',
}

interface Props {
  visibility: ContactPageVisibility
  author: ContactAuthorData | null
  locale: string
}

export function SocialLinksColumn({ visibility, author, locale }: Props) {
  if (!visibility.show_social_links) return null

  const [copied, setCopied] = useState<string | null>(null)

  const socialLinks = author?.social_links ?? {}
  const items: SocialItem[] = visibility.social_order
    .filter((key) => visibility.social_visible[key] && socialLinks[key])
    .map((key) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      handle: socialLinks[key],
      url: key === 'email' ? `mailto:${socialLinks[key]}` : socialLinks[key],
      icon: SOCIAL_ICONS[key] ?? '🔗',
    }))

  const copyEmail = useCallback((email: string) => {
    navigator.clipboard.writeText(email)
    setCopied(email)
    setTimeout(() => setCopied(null), 1800)
  }, [])

  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-3.5">
      {items.map((item) => (
        <div
          key={item.key}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg bg-pb-paper border transition-all cursor-pointer hover:border-pb-accent/40 hover:shadow-md ${
            item.key === 'email' && visibility.email_highlight
              ? 'border-pb-accent/30'
              : 'border-pb-line'
          }`}
          onClick={() => {
            if (item.key === 'email') copyEmail(item.handle)
            else window.open(item.url, '_blank', 'noopener')
          }}
        >
          <span className={`text-lg ${item.key === 'email' && visibility.email_highlight ? 'text-pb-accent' : ''}`}>
            {item.icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-pb-ink">{item.label}</div>
            <div className="text-xs text-pb-muted font-[family-name:var(--font-jetbrains-var)] truncate">
              {item.handle}
            </div>
          </div>
          {item.key === 'email' && (
            <span className="text-xs text-pb-muted">
              {copied === item.handle
                ? (locale === 'pt-BR' ? 'copiado ✓' : 'copied ✓')
                : (locale === 'pt-BR' ? 'copiar' : 'copy')}
            </span>
          )}
        </div>
      ))}

      {visibility.handwritten_note && (
        <p className="text-center text-sm text-pb-muted font-[family-name:var(--font-caveat-var)] mt-1">
          {locale === 'pt-BR' ? '↑ email = mais rápido' : '↑ email = fastest way'}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create FaqSection**

```typescript
// apps/web/src/app/(public)/contact/_components/faq-section.tsx
'use client'

import { useState } from 'react'
import type { FaqItem } from '@/lib/contact/types'

interface Props {
  items: FaqItem[]
  locale: string
}

export function FaqSection({ items, locale }: Props) {
  const [open, setOpen] = useState<number | null>(null)

  if (items.length === 0) return null

  return (
    <section className="mt-16 max-w-[920px] mx-auto">
      <h2 className="font-[family-name:var(--font-fraunces-var)] text-xl font-semibold text-pb-ink mb-6">
        {locale === 'pt-BR' ? 'Perguntas frequentes' : 'Frequently asked questions'}
      </h2>
      <div className="border-t border-pb-line">
        {items.map((faq, i) => (
          <div key={i} className="border-b border-pb-line">
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between py-4 text-left text-sm font-medium text-pb-ink hover:text-pb-accent transition-colors"
            >
              <span>{faq.q}</span>
              <span
                className="text-pb-accent text-xs transition-transform duration-200 ml-4 shrink-0"
                style={{ transform: open === i ? 'rotate(90deg)' : 'none' }}
              >
                ▸
              </span>
            </button>
            {open === i && (
              <div className="pb-4 text-sm text-pb-muted leading-relaxed font-[family-name:var(--font-source-serif-var)]">
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Create ContactFormCard**

```typescript
// apps/web/src/app/(public)/contact/_components/contact-form-card.tsx

import { Paper } from '@/components/pinboard/paper'
import { Tape } from '@/components/pinboard/tape'
import { ContactForm } from '@/components/contact-form'
import { submitContact } from '../actions'
import type { ContactPageSettings, ContactPageVisibility } from '@/lib/contact/types'

interface Props {
  settings: ContactPageSettings
  visibility: ContactPageVisibility
  locale: string
}

export function ContactFormCard({ settings, visibility, locale }: Props) {
  if (!visibility.show_contact_form) return null

  return (
    <div className="relative">
      <Tape className="absolute -top-2 left-8 z-10" />
      <Paper className="p-6 relative" style={{ transform: 'rotate(0.3deg)' }}>
        {settings.form_title && (
          <h2 className="font-[family-name:var(--font-fraunces-var)] text-lg font-semibold text-pb-ink mb-4">
            {settings.form_title}
          </h2>
        )}
        <ContactForm
          locale={locale}
          submitAction={submitContact}
          subjectOptions={settings.subject_options}
          showSubject={visibility.show_subject_selector}
          showMarketing={visibility.show_marketing_consent}
        />
      </Paper>
    </div>
  )
}
```

- [ ] **Step 5: Create SuccessState**

```typescript
// apps/web/src/app/(public)/contact/_components/success-state.tsx

import { Paper } from '@/components/pinboard/paper'
import { localePath } from '@/lib/i18n/locale-path'

interface Props {
  locale: string
}

export function SuccessState({ locale }: Props) {
  const isPt = locale === 'pt-BR'
  return (
    <Paper className="p-8 text-center max-w-md mx-auto">
      <p className="font-[family-name:var(--font-caveat-var)] text-3xl text-pb-accent mb-3">
        {isPt ? 'recebido!' : 'got it!'}
      </p>
      <p className="text-sm text-pb-muted mb-6 font-[family-name:var(--font-source-serif-var)]">
        {isPt
          ? 'Sua mensagem foi enviada. Respondo em 24-48h.'
          : 'Your message has been sent. I reply within 24-48h.'}
      </p>
      <div className="flex gap-3 justify-center">
        <a
          href={localePath('/', locale)}
          className="px-4 py-2 text-sm rounded-lg border border-pb-line text-pb-muted hover:border-pb-accent/40 transition-colors"
        >
          {isPt ? 'Voltar ao início' : 'Back home'}
        </a>
        <a
          href={localePath('/blog', locale)}
          className="px-4 py-2 text-sm rounded-lg bg-pb-accent text-pb-bg hover:opacity-90 transition-opacity"
        >
          {isPt ? 'Ler o blog' : 'Read the blog'}
        </a>
      </div>
    </Paper>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(public\)/contact/_components/
git commit -m "feat(contact): add Pinboard-themed page components"
```

---

### Task 8: Public Contact Page — Server Component Rewrite

**Files:**
- Modify: `apps/web/src/app/(public)/contact/page.tsx`

- [ ] **Step 1: Rewrite page.tsx to fetch CMS data and render new components**

Replace the entire page with the new version that:
- Fetches `contact_page_settings` for the active locale
- Fetches `contact_page_visibility`
- Fetches default author with translations
- Falls back to `getDefaultSettings(locale)` and `DEFAULT_VISIBILITY` when no CMS config exists
- Renders `HeroSection`, two-column grid (SocialLinksColumn + ContactFormCard), and `FaqSection`
- Shows `SuccessState` when `?notice=contact_received`
- Preserves existing JSON-LD breadcrumb, metadata generation, and error handling

Key data fetching pattern:

```typescript
const supabase = getSupabaseServiceClient()
const [settingsRes, visRes, authorRes] = await Promise.all([
  supabase
    .from('contact_page_settings')
    .select('*')
    .eq('site_id', ctx.siteId)
    .eq('locale', locale)
    .maybeSingle(),
  supabase
    .from('contact_page_visibility')
    .select('*')
    .eq('site_id', ctx.siteId)
    .maybeSingle(),
  supabase
    .from('authors')
    .select('name, avatar_url, social_links, author_about_translations!inner(locale, headline)')
    .eq('site_id', ctx.siteId)
    .eq('is_default', true)
    .eq('author_about_translations.locale', locale)
    .maybeSingle(),
])

const settings = settingsRes.data
  ? (settingsRes.data as ContactPageSettings)
  : { ...getDefaultSettings(locale), id: '', site_id: ctx.siteId, locale } as ContactPageSettings
const visibility = visRes.data
  ? (visRes.data as ContactPageVisibility)
  : { ...DEFAULT_VISIBILITY, id: '', site_id: ctx.siteId } as ContactPageVisibility
```

Layout structure:

```tsx
<main className="max-w-[920px] mx-auto px-7 py-12">
  <HeroSection settings={settings} visibility={visibility} author={authorData} />

  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-8">
    <SocialLinksColumn visibility={visibility} author={authorData} locale={locale} />
    <ContactFormCard settings={settings} visibility={visibility} locale={locale} />
  </div>

  {visibility.show_faq && (
    <FaqSection items={settings.faq_items ?? []} locale={locale} />
  )}
</main>
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(public\)/contact/page.tsx
git commit -m "feat(contact): rewrite public page with Pinboard theme and CMS data"
```

---

### Task 9: Component Tests

**Files:**
- Create: `apps/web/test/components/contact-page.test.tsx`

- [ ] **Step 1: Write component render tests**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HeroSection } from '@/app/(public)/contact/_components/hero-section'
import { FaqSection } from '@/app/(public)/contact/_components/faq-section'
import { SocialLinksColumn } from '@/app/(public)/contact/_components/social-links-column'
import { DEFAULT_VISIBILITY, DEFAULT_SETTINGS_EN } from '@/lib/contact/defaults'
import type { ContactPageSettings, ContactPageVisibility, ContactAuthorData } from '@/lib/contact/types'

const mockSettings: ContactPageSettings = {
  id: '1', site_id: 's1', locale: 'en',
  ...DEFAULT_SETTINGS_EN,
}

const mockVis: ContactPageVisibility = {
  id: '1', site_id: 's1',
  ...DEFAULT_VISIBILITY,
}

const mockAuthor: ContactAuthorData = {
  name: 'Test Author',
  avatar_url: 'https://example.com/avatar.jpg',
  social_links: { email: 'test@test.com', github: 'https://github.com/test' },
  headline: 'Test Headline',
  bio: 'Test bio text',
}

describe('HeroSection', () => {
  it('renders title with marker highlight on last word', () => {
    render(<HeroSection settings={mockSettings} visibility={mockVis} author={mockAuthor} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Let's talk?")
  })

  it('hides when show_hero is false', () => {
    const vis = { ...mockVis, show_hero: false }
    const { container } = render(<HeroSection settings={mockSettings} visibility={vis} author={mockAuthor} />)
    expect(container.innerHTML).toBe('')
  })

  it('hides avatar when show_avatar is false', () => {
    const vis = { ...mockVis, show_avatar: false }
    render(<HeroSection settings={mockSettings} visibility={vis} author={mockAuthor} />)
    expect(screen.queryByAltText('Test Author')).toBeNull()
  })

  it('shows response badge with pulse dot', () => {
    render(<HeroSection settings={mockSettings} visibility={mockVis} author={mockAuthor} />)
    expect(screen.getByText('I reply within 24-48h')).toBeDefined()
  })
})

describe('FaqSection', () => {
  it('renders FAQ items as accordion', () => {
    render(<FaqSection items={mockSettings.faq_items} locale="en" />)
    expect(screen.getByText("What's the best way to reach me?")).toBeDefined()
  })

  it('expands item on click', () => {
    render(<FaqSection items={mockSettings.faq_items} locale="en" />)
    fireEvent.click(screen.getByText("What's the best way to reach me?"))
    expect(screen.getByText(/Email\. I reply within 24-48h/)).toBeDefined()
  })

  it('returns null when no items', () => {
    const { container } = render(<FaqSection items={[]} locale="en" />)
    expect(container.innerHTML).toBe('')
  })
})

describe('SocialLinksColumn', () => {
  it('renders visible social links in order', () => {
    render(<SocialLinksColumn visibility={mockVis} author={mockAuthor} locale="en" />)
    expect(screen.getByText('Email')).toBeDefined()
    expect(screen.getByText('Github')).toBeDefined()
  })

  it('hides when show_social_links is false', () => {
    const vis = { ...mockVis, show_social_links: false }
    const { container } = render(<SocialLinksColumn visibility={vis} author={mockAuthor} locale="en" />)
    expect(container.innerHTML).toBe('')
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npm run test:web -- --run apps/web/test/components/contact-page.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/components/contact-page.test.tsx
git commit -m "test(contact): add component render tests for contact page"
```

---

### Task 10: Locale Keys and Final Polish

**Files:**
- Modify: `apps/web/src/locales/en.json`
- Modify: `apps/web/src/locales/pt-BR.json`

- [ ] **Step 1: Add contact page locale keys**

In `apps/web/src/locales/en.json`, add:

```json
{
  "contact": {
    "title": "Contact",
    "breadcrumb": "Contact",
    "faq_heading": "Frequently asked questions",
    "success_heading": "got it!",
    "success_body": "Your message has been sent. I reply within 24-48h.",
    "back_home": "Back home",
    "read_blog": "Read the blog",
    "subject_label": "Subject",
    "subject_placeholder": "Select...",
    "handwritten_note": "↑ email = fastest way",
    "copy": "copy",
    "copied": "copied ✓"
  }
}
```

In `apps/web/src/locales/pt-BR.json`, add:

```json
{
  "contact": {
    "title": "Contato",
    "breadcrumb": "Contato",
    "faq_heading": "Perguntas frequentes",
    "success_heading": "recebido!",
    "success_body": "Sua mensagem foi enviada. Respondo em 24-48h.",
    "back_home": "Voltar ao início",
    "read_blog": "Ler o blog",
    "subject_label": "Assunto",
    "subject_placeholder": "Selecione...",
    "handwritten_note": "↑ email = mais rápido",
    "copy": "copiar",
    "copied": "copiado ✓"
  }
}
```

- [ ] **Step 2: Update components to use locale keys instead of inline ternaries**

Replace hardcoded ternaries in `faq-section.tsx`, `success-state.tsx`, and `social-links-column.tsx` with the locale key values. The components already accept `locale` prop — read the matching key from the JSON.

- [ ] **Step 3: Run full test suite**

```bash
npm run test:web
```

Expected: all tests PASS, no regressions.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/locales/ apps/web/src/app/\(public\)/contact/
git commit -m "feat(contact): add locale keys and finalize contact page"
```

---

### Task 11: Visual QA and Dev Server Test

- [ ] **Step 1: Start dev server**

```bash
npm run dev -w apps/web
```

- [ ] **Step 2: Test public contact page**

Open `http://localhost:3000/contact` and verify:
- Hero section renders with title, subtitle, avatar, bio, response badge
- Social links display in correct order with copy-to-clipboard on email
- Contact form renders inside Paper card with Tape decoration
- Subject selector appears with options
- LGPD consent checkbox present and required
- FAQ accordion expands/collapses
- Responsive layout works at mobile breakpoint (< 720px)
- Success state displays after form submit (via `?notice=contact_received`)

- [ ] **Step 3: Test Portuguese version**

Open `http://localhost:3000/pt/contact` and verify all text is in Portuguese.

- [ ] **Step 4: Test CMS admin settings**

Open `http://localhost:3000/cms/settings?section=contact-page` and verify:
- All 5 sub-tabs render correctly
- Locale tabs switch content
- Toggles update dirty state
- Save button works (spinner → "Salvo")
- Unsaved changes dialog appears when switching tabs with dirty state
- Cmd+S keyboard shortcut triggers save
- Preview button links to public contact page

- [ ] **Step 5: Run full test suite one final time**

```bash
npm test
```

Expected: all tests in both api and web PASS.

- [ ] **Step 6: Final commit if any polish needed**

```bash
git add -u
git commit -m "fix(contact): visual QA polish"
```
