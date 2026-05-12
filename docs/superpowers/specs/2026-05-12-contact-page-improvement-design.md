# Contact Page Improvement — Design Spec

**Date:** 2026-05-12
**Status:** Draft
**Scope:** Public contact page redesign + CMS admin settings

## Goals

1. Transform the current minimal contact page into a rich, Pinboard-themed page leveraging existing author data (avatar, bio, social links)
2. Add CMS admin UI to configure every visible element per locale (pt-BR, en)
3. All text content is locale-dependent and CMS-editable; no hardcoded strings remain
4. Maintain existing LGPD compliance, Turnstile CAPTCHA, rate limiting, and auto-reply email

## Non-Goals

- Changing header/footer (global layout components stay as-is)
- Editing author social link URLs (managed in Authors section)
- Adding new locales beyond pt-BR and en
- Changing the contact form server action security model

---

## 1. Database Schema

### New table: `contact_page_settings`

Stores per-site, per-locale configuration for the contact page.

```sql
CREATE TABLE public.contact_page_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  locale        text NOT NULL,

  -- Hero section
  hero_title         text NOT NULL DEFAULT '',
  hero_subtitle      text DEFAULT '',
  response_time_text text DEFAULT '',

  -- Form section
  form_title         text DEFAULT '',
  auto_reply_text    text DEFAULT '',
  subject_options    jsonb DEFAULT '[]'::jsonb,

  -- FAQ
  faq_items          jsonb DEFAULT '[]'::jsonb,

  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),

  UNIQUE (site_id, locale),
  CONSTRAINT hero_title_len CHECK (char_length(hero_title) <= 80),
  CONSTRAINT hero_subtitle_len CHECK (char_length(hero_subtitle) <= 300),
  CONSTRAINT response_time_len CHECK (char_length(response_time_text) <= 100),
  CONSTRAINT form_title_len CHECK (char_length(form_title) <= 100),
  CONSTRAINT auto_reply_len CHECK (char_length(auto_reply_text) <= 500)
);
```

**JSONB shapes:**

```typescript
// subject_options
type SubjectOption = string  // e.g. "💼 Projeto / Freelance"
// stored as: ["💼 Projeto / Freelance", "🤝 Collab / Parceria", ...]

// faq_items
interface FaqItem {
  q: string  // question
  a: string  // answer
}
// stored as: [{ q: "...", a: "..." }, ...]
```

### New table: `contact_page_visibility`

Stores per-site (locale-independent) visibility and display options.

```sql
CREATE TABLE public.contact_page_visibility (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE UNIQUE,

  -- Section visibility
  show_hero          boolean DEFAULT true,
  show_social_links  boolean DEFAULT true,
  show_contact_form  boolean DEFAULT true,
  show_faq           boolean DEFAULT true,

  -- Hero elements
  show_avatar        boolean DEFAULT true,
  show_bio           boolean DEFAULT true,
  show_response_badge boolean DEFAULT true,

  -- Social behavior
  social_order       jsonb DEFAULT '["email","instagram","youtube","x","github","rss"]'::jsonb,
  social_visible     jsonb DEFAULT '{"email":true,"instagram":true,"youtube":true,"x":true,"github":true,"rss":true}'::jsonb,
  email_highlight    boolean DEFAULT true,
  handwritten_note   boolean DEFAULT true,

  -- Form options
  show_subject_selector  boolean DEFAULT true,
  show_marketing_consent boolean DEFAULT true,

  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
```

### Existing column (already in schema)

`sites.contact_notification_email` (citext, max 320) — used for admin alert email. Currently not exposed in CMS UI; this spec adds it to the Form tab.

### RLS Policies

```sql
-- contact_page_settings
CREATE POLICY settings_public_read ON contact_page_settings
  FOR SELECT USING (public.site_visible(site_id));
CREATE POLICY settings_staff_write ON contact_page_settings
  FOR ALL USING (public.can_edit_site(site_id)) WITH CHECK (public.can_edit_site(site_id));

-- contact_page_visibility
CREATE POLICY visibility_public_read ON contact_page_visibility
  FOR SELECT USING (public.site_visible(site_id));
CREATE POLICY visibility_staff_write ON contact_page_visibility
  FOR ALL USING (public.can_edit_site(site_id)) WITH CHECK (public.can_edit_site(site_id));
```

Both tables follow the same RLS pattern as `authors`: public read for rendering, staff-only write.

### Migration

Single migration file: `supabase/migrations/YYYYMMDDHHMMSS_contact_page_settings.sql`

Must be idempotent (`DROP POLICY IF EXISTS` before `CREATE POLICY`, etc.) per CLAUDE.md convention.

Seed default rows for existing sites using `INSERT ... ON CONFLICT DO NOTHING` with sensible defaults matching current hardcoded values.

---

## 2. Public Contact Page Design

### Layout

- **Max-width:** 920px, centered
- **Theme:** Pinboard dark (bg `#14110B`, ink `#F2EBDB`, accent `#D4A853`, marker `#FFE37A`)
- **Fonts:** Fraunces (headings), Source Serif 4 (body copy), Inter (UI), JetBrains Mono (labels), Caveat (handwritten accents)

### Sections (top to bottom)

#### 2.1 Hero

- **H1 title** with marker highlight on last word (Fraunces, ~42px)
- **Subtitle** in Source Serif 4 (serif, muted color)
- **Author avatar** (72px circle, gradient fallback if no photo)
- **Short bio** from `author_about_translations.headline` for active locale
- **Response time badge** — green pulsing dot + text (e.g. "Respondo em 24-48h")
- All elements individually toggleable via CMS

#### 2.2 Two-column grid (1fr 1fr, gap 48px)

**Left column — Social Links:**
- Vertical stack of social cards (gap 14px between cards, no connected borders)
- Each card: icon + label + handle + copy/link action
- Email card optionally highlighted with accent border
- Optional Caveat handwritten note below email ("↑ email = mais rápido")
- Order and visibility controlled via CMS
- Data source: `authors.social_links` + `identity-profiles.ts`

**Right column — Contact Form (Paper card):**
- Paper component with subtle Tape decoration at top
- Form title heading (Fraunces, e.g. "Manda um salve")
- Fields: name, email, subject (optional select), message (textarea)
- LGPD consent checkbox (required, data processing)
- Marketing opt-in checkbox (optional, toggleable)
- Cloudflare Turnstile widget
- Submit button (accent gold)

#### 2.3 FAQ Section

- Full-width below the two-column grid
- Accordion/toggle items with arrow rotation animation
- Per-locale questions and answers from CMS
- Section toggleable via CMS

### Responsive (breakpoint: 720px)

- Two-column grid → single column stack
- Social links first, then form below
- Hero flex direction → column, center-aligned
- H1 font size capped at 36px

### Success State

On form submit success:
- Form card content replaced with success message
- Handwritten "recebido!" / "got it!" heading (Caveat font)
- Explanation text + two CTA buttons (back home, read blog)
- Reset button to show form again

### Error States

- Validation errors shown inline per field
- Rate limit → redirect with `?error=rate_limited`
- Turnstile failure → redirect with `?error=bot_check_failed`
- Server error → redirect with `?error=submit_failed`
- All error messages locale-aware

---

## 3. CMS Admin Settings Design

### Integration Point

New section in `settings-connected.tsx`:
- Added to `SectionId` union type as `'contact-page'`
- Inserted in `SECTIONS` array between `instagram` and `localization`
- Badge "new" on sidebar item (removed after first save or via localStorage)

### Sub-tabs

The Contact Page section uses internal tabs (not scrollable sections) due to content volume:

| Tab | Content |
|-----|---------|
| **Hero & Textos** | Title, subtitle, response time (per locale) + avatar/bio/badge toggles |
| **Social Links** | Visibility toggles + order + behavior (email highlight, handwritten note) |
| **Formulário** | Notification email, form title, auto-reply text (per locale), subject options, optional fields |
| **FAQ** | FAQ items editor (per locale), add/remove/reorder |
| **Visibilidade** | Section-level show/hide toggles + wireframe preview |

### Patterns (matching existing settings-connected.tsx)

- Each tab is a `<form>` with independent `useSaveState()` → `SaveButton`
- Dirty state tracking per tab via `Set<string>`
- Unsaved changes dialog when switching tabs with dirty state (Cancel / Discard / Save & switch)
- `Cmd+S` keyboard shortcut saves current tab
- `FieldError` for inline validation
- `CharCount` with soft warning at 90% and hard warning when exceeded
- `DataSource` indicators showing where data originates (e.g. "authors.social_links")
- `LocaleTabs` (🇧🇷 Português / 🇺🇸 English) for locale-dependent fields
- `MoveButtons` (▲/▼) for reordering FAQ items, subject options, and social links
- Preview button in topbar links to public contact page

### Visibility Tab Special Features

- Interactive wireframe preview showing/hiding sections as toggles change
- Warning banner when all sections disabled ("página vazia")
- Dynamic hints showing counts (e.g. "6 canais visíveis", "4 perguntas (pt-BR)")

### FAQ Tab

- Shows "Hidden on page" warning badge when FAQ section is disabled in Visibility tab (single source of truth — no duplicate toggle)
- Inline edit with expand/collapse per item
- Confirm dialog on delete
- Empty state with illustration when no items exist for locale

---

## 4. Data Flow

### Public Page (read path)

```
page.tsx (server component)
  ├── getSiteContext() → site_id, locale
  ├── Supabase parallel queries:
  │   ├── contact_page_settings WHERE site_id AND locale
  │   ├── contact_page_visibility WHERE site_id
  │   ├── authors WHERE site_id AND is_default = true
  │   │   └── JOIN author_about_translations WHERE locale
  │   └── (author.social_links already in authors row)
  └── Render ContactPageContent (client component)
        ├── HeroSection (title, subtitle, avatar, bio, badge)
        ├── SocialLinksColumn (filtered + ordered by visibility settings)
        ├── ContactFormCard (Paper + Tape + form)
        └── FaqSection (accordion from faq_items)
```

### CMS Admin (write path)

```
settings page.tsx
  ├── Parallel fetch: site + contact_page_settings (both locales) + contact_page_visibility + default author
  └── Pass to SettingsConnected as props

Server actions (new in actions.ts):
  ├── updateContactHeroText(locale, {title, subtitle, responseTime})
  ├── updateContactHeroDisplay({showAvatar, showBio, showBadge})
  ├── updateContactSocial({socialOrder, socialVisible, emailHighlight, handwrittenNote})
  ├── updateContactForm({notifEmail, showSubject, showMktg})
  ├── updateContactFormText(locale, {formTitle, autoReply, subjects})
  ├── updateContactFaq(locale, {faqItems})
  └── updateContactVisibility({showHero, showSocialLinks, showContactForm, showFaq})

Each action:
  1. requireEditAccess() → siteId
  2. Zod validation
  3. UPSERT to contact_page_settings (locale-dependent) or contact_page_visibility (locale-independent)
  4. revalidatePath('/contact') + revalidatePath('/pt/contact')
  5. Return { ok: true } or { ok: false, error: string }

Note: Hero tab calls two actions — updateContactHeroText (locale-dependent, writes to contact_page_settings) and updateContactHeroDisplay (locale-independent, writes to contact_page_visibility). Form tab similarly splits: updateContactForm (locale-independent toggles + notif email) and updateContactFormText (locale-dependent titles/auto-reply/subjects).
```

---

## 5. Component Architecture

### New Components

| Component | Type | Location |
|-----------|------|----------|
| `ContactPageContent` | Client | `app/(public)/contact/contact-page-content.tsx` |
| `HeroSection` | Server | `app/(public)/contact/_components/hero-section.tsx` |
| `SocialLinksColumn` | Client | `app/(public)/contact/_components/social-links-column.tsx` |
| `ContactFormCard` | Client | `app/(public)/contact/_components/contact-form-card.tsx` |
| `FaqSection` | Client | `app/(public)/contact/_components/faq-section.tsx` |
| `ContactSettingsSection` | Client | Inline in `settings-connected.tsx` (follows existing pattern) |

### Reused Components

- `Paper`, `Tape` from existing Pinboard design system (if extracted) or inline styled
- `ContactForm` (existing, enhanced with subject selector + CMS-driven labels)
- Turnstile widget (existing integration)

### Modified Files

| File | Change |
|------|--------|
| `app/(public)/contact/page.tsx` | Fetch contact settings + visibility + author data; pass to new components |
| `app/(public)/contact/actions.ts` | Add `subject` field to Zod schema + `contact_submissions`; use CMS auto-reply text |
| `components/contact-form.tsx` | Accept CMS-driven props (labels, subjects, visibility flags); remove hardcoded strings |
| `app/cms/(authed)/settings/page.tsx` | Add contact settings + visibility + author queries |
| `app/cms/(authed)/settings/actions.ts` | Add 5 new server actions |
| `app/cms/(authed)/settings/settings-connected.tsx` | Add `contact-page` section with 5 sub-tabs |
| `locales/en.json` | Add contact page keys (fallback only) |
| `locales/pt-BR.json` | Add contact page keys (fallback only) |

---

## 6. Subject Field Addition

The contact form gains an optional subject selector. This requires:

1. **DB migration:**
```sql
ALTER TABLE public.contact_submissions ADD COLUMN subject text DEFAULT NULL;
ALTER TABLE public.contact_submissions
  ADD CONSTRAINT contact_submissions_subject_len CHECK (char_length(subject) <= 100);
```
2. **Zod schema update** in `actions.ts`: add optional `subject` field (max 100 chars)
3. **Email templates:** Include subject in admin alert email
4. **CMS contacts list:** Show subject column if populated

---

## 7. Error Handling

- **Missing settings:** If `contact_page_settings` row doesn't exist for a locale, fall back to hardcoded defaults (current page behavior)
- **Missing visibility:** If `contact_page_visibility` row doesn't exist, default all sections visible
- **Missing author:** If no default author exists, hide avatar/bio/social sections gracefully
- **Empty FAQ:** Hide FAQ section entirely (no empty state on public page)
- **Empty subjects:** Filter out blank entries before rendering select dropdown
- **LGPD consent:** Mandatory checkbox remains hardcoded (not CMS-editable) — consent text versions tracked in `consent.ts`

---

## 8. Testing Strategy

### Unit Tests

- Contact settings Zod schemas validation
- Subject options filtering (empty removal)
- FAQ items serialization/deserialization
- CharCount warning thresholds

### Integration Tests (require local DB)

- CRUD operations on `contact_page_settings` and `contact_page_visibility`
- RLS: anon can read, staff can write, non-staff cannot write
- Contact form submission with subject field
- Auto-reply with CMS-configured text
- Locale fallback behavior

### Component Tests

- Hero section renders/hides elements based on visibility flags
- Social links respect order and visibility
- FAQ accordion expand/collapse
- Form subject selector conditional rendering
- Success state rendering

### Smoke Tests

- Public page loads with default settings (no CMS config yet)
- Public page loads with full CMS config
- CMS settings save and reload correctly
- Locale switching shows correct content

---

## 9. Migration Strategy

1. Deploy DB migration first (additive — no breaking changes)
2. Deploy code with fallback behavior (page works without settings rows)
3. Admin creates settings via CMS → page starts using CMS data
4. Remove hardcoded fallback strings in future cleanup (optional)

---

## 10. Design References

- Public page mockup: `.superpowers/brainstorm/3502-1778590324/content/contact-v4.html`
- CMS admin mockup: `.superpowers/brainstorm/3502-1778590324/content/contact-cms-v4.html`
- Existing design reference: `design/contact.html`
