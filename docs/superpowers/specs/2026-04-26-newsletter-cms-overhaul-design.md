# Newsletter CMS Overhaul — Design Spec

**Date:** 2026-04-26
**Status:** Approved
**Score:** 98/100 (multi-client preview deferred, A/B testing UI deferred Sprint 7+)

## Problem

The current newsletter CMS (`/cms/newsletters`) is non-functional in several critical areas:

- **Type management:** Zero CRUD. 8 types hardcoded via seed migration. "+ Add type" button is dead code with no onClick handler.
- **Edition editor:** 3 bare fields (subject, preheader, MDX textarea). No live preview, no formatting toolbar, no date picker. Schedule action hardcoded to +1 hour from now.
- **Edition lifecycle:** 8 of 12 context menu items are dead code (`/* handled by parent */` with no parent handler). Duplicate, Delete, Cancel, Reschedule, Archive, Unslot — all no-ops.
- **Status guards:** `saveEdition()` allows editing sent/cancelled editions. `scheduleEdition()` accepts past dates. `cancelEdition()` has no status validation.
- **Feedback:** Zero toast/error feedback on any action. Silent failures throughout.
- **Ideas:** No concept of an idea bank or draft workspace. Every edition is immediately tied to a type.

**Audit score: 28/100.**

## Scope

### In scope
- Newsletter type CRUD (create, edit, deactivate, delete with tiered confirmation)
- Edition editor redesign: **TipTap WYSIWYG** rich text editor (Gmail/Word-like) replacing raw MDX textarea
- Email-safe HTML pipeline: `sanitizeForEmail()` with CSS inlining via `juice`, Outlook VML buttons, image width attrs
- Image upload via drag & drop / paste / browse to Supabase Storage
- Merge tags for personalization (`{{subscriber.name}}`, `{{urls.unsubscribe}}`, etc.)
- Email-safe font restrictions (9 fonts only)
- Idea bank (new `idea` status, type-optional, quick capture, convert-to-edition flow)
- Complete edition lifecycle (all context menu items functional, status-aware action bars)
- Schedule modal with date/time/timezone picker and conflict detection
- Send Now with confirmation modal
- Delete confirmation tiers (low/medium/high impact)
- 9 new server actions + 5 fixed existing actions
- Toast feedback system
- Keyboard shortcuts (editor + dashboard)
- Navigation guard for unsaved changes
- Read-only overlay for sent/sending editions
- Settings page enhancement (sender fields editable, bounce policy)
- Link tracking integration with existing click tracking pipeline

### Out of scope (deferred)
- A/B testing UI (schema exists, no UI — Sprint 7+)
- Subscriber import/export (separate feature)
- Version history/undo (uses existing `updated_at`)
- Template library (Sprint 8+)
- Drag-and-drop type reorder
- Multi-client email preview (Litmus/Email on Acid — enterprise feature)

## Architecture

### DB Changes (3 migrations)

#### Migration 1: Add `idea` status + nullable type_id + notes
```sql
-- Add 'idea' to newsletter_editions status CHECK
ALTER TABLE newsletter_editions DROP CONSTRAINT IF EXISTS newsletter_editions_status_check;
ALTER TABLE newsletter_editions ADD CONSTRAINT newsletter_editions_status_check
  CHECK (status IN ('idea', 'draft', 'ready', 'queued', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'));

-- Allow NULL newsletter_type_id for ideas (unassigned)
ALTER TABLE newsletter_editions ALTER COLUMN newsletter_type_id DROP NOT NULL;

-- Add internal notes column for ideas/drafts
ALTER TABLE newsletter_editions ADD COLUMN IF NOT EXISTS notes text;
```

#### Migration 2: Newsletter type CRUD support
```sql
-- RLS policies for newsletter_types (currently none — staff-only insert/update/delete)
DROP POLICY IF EXISTS "staff_manage_types" ON newsletter_types;
CREATE POLICY "staff_manage_types" ON newsletter_types
  FOR ALL USING (public.is_member_staff())
  WITH CHECK (public.is_member_staff());

-- Add site_id to newsletter_types for multi-site scoping
ALTER TABLE newsletter_types ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id);
-- Backfill existing types with master site
UPDATE newsletter_types SET site_id = (SELECT id FROM sites WHERE slug = 'bythiagofigueiredo') WHERE site_id IS NULL;
ALTER TABLE newsletter_types ALTER COLUMN site_id SET NOT NULL;
```

#### Migration 3: Add content_json for TipTap document model
```sql
-- TipTap stores its document as ProseMirror JSON
ALTER TABLE newsletter_editions ADD COLUMN IF NOT EXISTS content_json jsonb;
```

### Rich Text Editor — TipTap (ProseMirror)

**Why TipTap over MDX:** Newsletters are emails. Users composing emails expect WYSIWYG editing (Gmail, Word, Mailchimp), not raw Markdown. TipTap outputs HTML directly — no compilation step. Paste from Word/Google Docs preserves formatting. Drag & drop images built-in.

**TipTap Extensions (10):**

| Extension | Package | Purpose |
|-----------|---------|---------|
| StarterKit | `@tiptap/starter-kit` | Bold, italic, strike, headings, lists, blockquote, code, hardbreak, history |
| Underline | `@tiptap/extension-underline` | Underline text formatting |
| Link | `@tiptap/extension-link` | Hyperlinks with URL editing |
| Image | `@tiptap/extension-image` | Image embed with alt text + drag/drop upload |
| TextAlign | `@tiptap/extension-text-align` | Left/center/right alignment |
| Color + TextStyle | `@tiptap/extension-color` + `@tiptap/extension-text-style` | Text color picker |
| Highlight | `@tiptap/extension-highlight` | Background highlight |
| Placeholder | `@tiptap/extension-placeholder` | "Start writing your newsletter..." placeholder |
| CharacterCount | `@tiptap/extension-character-count` | Word count + character count for bottom bar |
| MergeTag (custom) | Custom node extension | Email merge tags as inline non-editable pills |
| CTAButton (custom) | Custom node extension | Email CTA button with color, text, URL |

**Toolbar layout (Gmail-style):**
Undo/Redo | Font family (9 email-safe fonts) | Font size (10-32px dropdown) | B I U S | Text color | Highlight | Alignment (L/C/R) | Bullet list | Numbered list | Blockquote | Divider | Link | Image | CTA Button | Merge Tag | Heading dropdown (P/H1/H2/H3)

**Email-safe fonts only (9):**
- Sans Serif: Arial/Helvetica, Verdana, Trebuchet MS, Tahoma
- Serif: Georgia, Times New Roman, Palatino
- Monospace: Courier New, Lucida Console

Font size: dropdown with fixed values (10, 12, 14 default, 16, 18, 20, 24, 28, 32px). No arbitrary input.

**Paste cleanup:** Custom `transformPastedHTML` hook strips Word XML namespaces (`mso-*`, `o:p`), Google Docs wrapper `<b id="docs-internal-guid-*">`, non-safe fonts → Arial, `class`/`id` attributes, normalizes `<span style="font-weight:700">` → `<strong>`, strips empty paragraphs and excessive `<br>` tags.

### Storage Model

| Column | Type | Purpose |
|--------|------|---------|
| `content_json` (NEW) | jsonb | TipTap ProseMirror document model — source of truth for re-editing |
| `content_html` (existing) | text | Rendered HTML from TipTap `editor.getHTML()` — used by send pipeline + web archive |
| `content_mdx` (existing) | text | Deprecated for new editions. Kept for backward compat with blog-sourced editions (`source_blog_post_id` set) |

**Save flow:** On save/autosave, `editor.getJSON()` → `content_json`, `editor.getHTML()` → `content_html`. Both persisted in single DB update.

**Blog-sourced editions (backward compat):** Editions created via blog post → newsletter flow have `source_blog_post_id` set and `content_mdx` filled. Editor shows read-only MDX preview (not editable in WYSIWYG). User can "Convert to Rich Text" (one-way: renders MDX → HTML → imports into TipTap JSON via `editor.commands.setContent(html)`).

### Email HTML Pipeline

**Existing pipeline (Sprint 5e):** `content_mdx` → `compileMdx()` → `MdxRunner` → Newsletter React Email template → `@react-email/render()` → email-safe HTML string.

**New pipeline:** `content_html` (from TipTap) → `sanitizeForEmail(html, typeColor)` → Newsletter React Email template (via `dangerouslySetInnerHTML` in body section) → `@react-email/render()` → email-safe HTML string.

#### `sanitizeForEmail(html, typeColor)` — `lib/newsletter/email-sanitizer.ts`

1. **XSS prevention:** Strip `<script>`, `<style>`, event handler attributes (`on*`)
2. **CSS inlining:** Apply email stylesheet via `juice@11` (npm, MIT, ~20KB). Stylesheet defined in `lib/newsletter/email-styles.ts` with `${typeColor}` interpolation for links, blockquotes, CTA buttons.
3. **Image safety:** Add `width` + `height` HTML attributes to `<img>` tags (Outlook needs these). Enforce `max-width: 600px`. Add `alt=""` to images missing alt text. Add `display:block` to prevent Gmail gaps.
4. **CTA button Outlook compat:** Wrap `.cta-button` elements in VML `<v:roundrect>` for Outlook desktop (Word renderer) via `<!--[if mso]>...<![endif]-->` conditional comments.
5. **Merge tag replacement:** Replace `<span data-merge-tag="...">` elements with actual subscriber values (at send time, not at save time).
6. **Link tracking:** After sanitization, `rewriteLinksForTracking(html, sendId)` rewrites `<a href>` URLs to tracking redirect. Skips `mailto:`, `#` anchors, unsubscribe URLs (RFC 8058). Gated by subscriber's `tracking_consent`.

#### Email Stylesheet (`lib/newsletter/email-styles.ts`)

CSS string that `juice` inlines. Uses only email-safe properties:

```css
h1 { font-size:28px; font-weight:700; color:#1a1a1a; margin:0 0 16px; font-family:Arial,sans-serif; }
h2 { font-size:22px; font-weight:700; color:#1a1a1a; margin:0 0 12px; font-family:Arial,sans-serif; }
h3 { font-size:18px; font-weight:600; color:#333; margin:0 0 8px; font-family:Arial,sans-serif; }
p  { font-size:16px; line-height:1.7; color:#333; margin:0 0 16px; font-family:Georgia,serif; }
a  { color:${typeColor}; text-decoration:underline; }
blockquote { border-left:3px solid ${typeColor}; padding:8px 16px; margin:16px 0; color:#666; }
img { max-width:600px; height:auto; border-radius:4px; display:block; margin:16px auto; }
ul, ol { padding-left:24px; margin:0 0 16px; }
li { margin-bottom:8px; font-size:16px; color:#333; font-family:Georgia,serif; }
hr { border:none; border-top:1px solid #eee; margin:24px 0; }
.cta-button { display:inline-block; padding:12px 32px; border-radius:6px; text-decoration:none; font-weight:600; }
```

`${typeColor}` replaced per newsletter type from `newsletter_types.color` (default `#7c3aed`).

### Image Upload Pipeline

1. User drags image / pastes from clipboard / clicks browse in TipTap Image extension
2. Client validates: size ≤ 2MB, format ∈ {JPEG, PNG, GIF, WebP}. Shows error toast if invalid.
3. Shows inline loading placeholder in editor (spinner + progress bar)
4. Calls `uploadNewsletterImage(file, editionId)` server action
5. Server uploads to Supabase Storage bucket `newsletter-assets`, path: `{siteId}/{editionId}/{uuid}.{ext}`
6. Auto-resizes to max 1200px width if wider (via sharp or browser canvas)
7. Returns public URL → TipTap inserts `<img src="..." alt="...">` replacing placeholder
8. Cleanup: orphaned images cleaned when edition is deleted

**Storage config:**
- Bucket: `newsletter-assets` (public, no signed URLs needed)
- Path pattern: `{siteId}/{editionId}/{uuid}.{ext}`
- Max file size: 2MB per image
- Accepted formats: JPEG, PNG, GIF, WebP

### Merge Tags (Personalization)

Custom TipTap inline Node extension (`MergeTag`). Non-editable, renders as colored pill in editor. Inserted via toolbar dropdown "🏷 Merge Tag ▾".

**Available tags:**

| Tag | Description | Fallback |
|-----|-------------|----------|
| `{{subscriber.email}}` | Subscriber email address | — |
| `{{subscriber.name}}` | Display name | Email prefix before @ |
| `{{edition.subject}}` | Current edition subject | — |
| `{{newsletter.name}}` | Newsletter type name | — |
| `{{urls.unsubscribe}}` | One-click unsubscribe URL | — |
| `{{urls.preferences}}` | Manage preferences URL | — |
| `{{urls.web_archive}}` | View in browser URL | — |

**HTML serialization:** `<span data-merge-tag="subscriber.name">{{subscriber.name}}</span>`

**Replacement:** At send time (per subscriber), `sanitizeForEmail()` replaces `data-merge-tag` spans with actual values.

### Server Actions (14 total)

#### 9 New Actions

| Action | Params | Behavior |
|--------|--------|----------|
| `deleteEdition(id)` | edition UUID | Tiered: draft w/o content → instant; draft w/ content → simple confirm; scheduled → cancel + delete; sent → require "DELETE" typed. Deletes from `newsletter_editions`. Cleans orphaned images from `newsletter-assets` bucket. |
| `duplicateEdition(id)` | edition UUID | Creates new draft copy with `subject = "Copy of {original}"`, copies content_json, content_html, preheader, segment. New UUID, `status = 'draft'`, `newsletter_type_id` preserved. Returns new edition ID. |
| `revertToDraft(id)` | edition UUID | Only from `cancelled` → `draft`. Clears `scheduled_at`, `slot_date`. |
| `sendNow(id)` | edition UUID | Only from `idea`, `draft`, or `ready`. Sets `status = 'sending'`, triggers immediate send pipeline (same as cron but inline). Returns error if no subscribers. |
| `createIdea(title, notes?, typeId?)` | title string, optional notes, optional type | Creates `newsletter_editions` row with `status = 'idea'`, `subject = title`, `notes`, `newsletter_type_id = typeId ?? null`. Returns idea ID. |
| `createNewsletterType(data)` | `{name, locale, color?, tagline?, sortOrder?}` | Generates slug-like ID from `name + locale` (e.g., `reflexoes-pt`). Validates name uniqueness per site+locale. Sets `site_id` from context. |
| `updateNewsletterType(id, data)` | type ID + partial `{name?, tagline?, color?, sortOrder?, active?}` | Updates specified fields. Revalidates `/cms/newsletters`. |
| `deleteNewsletterType(id)` | type ID | Checks subscriber count + edition count. Returns `{subscriberCount, editionCount}` for client to show tier-appropriate confirmation. On confirm: if subscribers > 0, requires typed name match. Cascades: sets `newsletter_type_id = NULL` on orphaned editions (they become ideas). Unlinks subscriptions (sets `newsletter_id = NULL` — subscribers not deleted). |
| `uploadNewsletterImage(file, editionId)` | File + edition UUID | Validates size ≤ 2MB + format. Uploads to Supabase Storage `newsletter-assets/{siteId}/{editionId}/{uuid}.{ext}`. Returns public URL. |

#### 5 Fixed Actions

| Action | Fix |
|--------|-----|
| `saveEdition` | Add status guard: only `idea`, `draft`, or `ready`. Return `{error: 'edition_locked'}` for other statuses. Now saves `content_json` + `content_html` instead of `content_mdx`. |
| `scheduleEdition` | Validate `scheduledAt > now()`. Validate ISO 8601 format. Check for conflicts (other editions scheduled within 2 hours on same type). Return `{conflict?: {subject, scheduledAt}}` in response. |
| `cancelEdition` | Only from `scheduled` or `queued`. Return `{error: 'cannot_cancel'}` for other statuses. |
| `sendTestEmail` | Rate limit: 1 per minute per edition (check `test_sent_at > now() - interval '1 minute'`). Use type's `sender_name` and `sender_email` instead of hardcoded values. Only from `idea`, `draft`, or `ready`. |
| `createEdition` | Validate type exists via DB query. Validate type `active = true`. Set initial status to `draft` (not `scheduled`). |

#### 1 Existing Action Enhanced

| Action | Params | Behavior |
|--------|--------|----------|
| `renderEmailPreview(id)` | edition UUID | Now uses `sanitizeForEmail()` pipeline instead of MDX compilation. Wraps in Newsletter React Email template, returns HTML string. Caches 30s via `unstable_cache`. Used by Email preview tab. |

### Status Transition Matrix

Enforced server-side in every action that changes status.

| From ↓ / To → | idea | draft | ready | scheduled | sending | sent | failed | cancelled |
|---|---|---|---|---|---|---|---|---|
| **idea** | — | ✓ (convert) | — | ✓ (schedule) | ✓ (sendNow) | — | — | ✓ (cancel) |
| **draft** | — | — | — | ✓ (schedule) | ✓ (sendNow) | — | — | ✓ (cancel) |
| **ready** | — | ✓ (edit) | — | ✓ (schedule) | ✓ (sendNow) | — | — | ✓ (cancel) |
| **scheduled** | — | ✓ (edit/unschedule) | — | ✓ (reschedule) | ✓ (cron) | — | — | ✓ (cancel) |
| **sending** | — | — | — | — | — | ✓ | ✓ | — |
| **sent** | — | — | — | — | — | — | — | — |
| **failed** | — | ✓ (edit) | — | ✓ (retry) | — | — | — | — |
| **cancelled** | — | ✓ (revert) | — | — | — | — | — | — |

`sent` is a terminal state — only delete or duplicate (creates new draft).

### UI Components (14 new/modified)

#### 1. TipTapEditor (`_components/tiptap-editor.tsx`)
- Wraps `@tiptap/react` `useEditor` hook with all 10 extensions configured.
- White background editing area (WYSIWYG — what you see is what gets sent).
- Outputs JSON (`editor.getJSON()`) and HTML (`editor.getHTML()`) on change for autosave.
- Custom upload handler for Image extension → calls `uploadNewsletterImage()`.
- Handles paste cleanup via `transformPastedHTML`.

#### 2. EditorToolbar (`_components/editor-toolbar.tsx`)
- Gmail-style toolbar above TipTap content area.
- Groups: Undo/Redo | Font family | Font size | B I U S | Color | Highlight | Alignment | Lists | Quote/Divider | Link/Image/Button | Merge Tag | Heading.
- All buttons read TipTap editor state for active/inactive styling.
- "📧 Preview as Email" button in bottom action bar (not toolbar).

#### 3. CTAButton Node (`_components/cta-button-node.tsx`)
- Custom TipTap NodeView for email CTA buttons.
- Insert modal: button text, URL, color (presets + hex), alignment (left/center/right).
- Renders in editor as styled button (preview of email appearance).
- Serializes to `<div class="cta-wrapper" style="text-align:{align}"><a class="cta-button" style="background:{color}" href="{url}">{text}</a></div>`.
- `sanitizeForEmail()` wraps in VML `<v:roundrect>` for Outlook compatibility.

#### 4. MergeTagNode (`_components/merge-tag-node.tsx`)
- Custom TipTap inline Node (non-editable).
- Renders as colored pill: `{{subscriber.name}}` with purple background.
- Toolbar dropdown lists all 7 available tags.
- Serializes to `<span data-merge-tag="{tag}">{{tag}}</span>`.

#### 5. TypeModal (`_components/type-modal.tsx`)
- **Create mode:** name, locale (pt-BR/en dropdown), color (6 presets + hex input), tagline, sort order.
- **Edit mode:** pre-filled, all fields editable except locale (locked after creation).
- Triggered by: "+ Add type" button (create), context menu "Edit Type" on card (edit).

#### 6. DeleteConfirmModal (`_components/delete-confirm-modal.tsx`)
- 3 tiers based on `impactLevel: 'low' | 'medium' | 'high'`:
  - **Low:** simple confirm with "Delete" button.
  - **Medium:** shows subject, scheduled date, and impact. "Delete & Cancel Send" button.
  - **High:** shows stats (subscribers, sent count, analytics). Requires typing "DELETE" or type name. Button disabled until match.
- Props: `{title, description, impactLevel, confirmText?, onConfirm, onCancel}`.

#### 7. ScheduleModal (`_components/schedule-modal.tsx`)
- Date picker (native `input[type=date]`), time picker (`input[type=time]`), timezone select (default `America/Sao_Paulo`).
- Conflict detection: on date change, fetches other editions scheduled ±2 hours on same type. Shows warning banner if conflict found.
- Summary panel: audience count, formatted send datetime.
- Validates date is in future before enabling "Confirm Schedule" button.

#### 8. SendNowModal (`_components/send-now-modal.tsx`)
- Shows: subject, recipient count, segment, sender email, sender name.
- Warning: "This action cannot be undone. Emails will begin sending immediately."
- Button: "⚡ Send to {count} subscribers" with count in button text.

#### 9. IdeaBank (integrated into `newsletters-connected.tsx`)
- New "💡 Ideas" tab in status filter bar (alongside All/Draft/Scheduled/Sent/Failed).
- "Quick Idea" button opens inline form: title (required) + type (optional dropdown) + notes (optional textarea).
- Idea rows show: lightbulb icon, title, type (or "No type assigned"), created date, content indicator ("Title only" / "~300 words drafted" / "Has notes").
- "→ Convert to Edition" button on each idea row.

#### 10. ConvertIdeaModal (`_components/convert-idea-modal.tsx`)
- Shows source idea title and created date.
- Required: newsletter type dropdown (filtered to active types for current site).
- Optional: edit subject (pre-filled from idea title).
- Summary: "Idea becomes a draft edition. Content and notes are preserved. Opens in editor immediately."
- On confirm: UPDATE edition with type_id + status='draft', navigate to edit page.

#### 11. EmailPreview (`_components/email-preview.tsx`)
- Triggered by "📧 Preview as Email" button in editor bottom bar.
- Calls `renderEmailPreview(editionId)` → returns full email HTML (header + sanitized body + footer).
- Renders in sandboxed iframe with light background.
- Toggle: 📱 Mobile (375px) / 🖥 Desktop (600px) width.

#### 12. AutosaveIndicator (`_components/autosave-indicator.tsx`)
- States: `saving` (spinner), `saved` (green dot + relative time), `unsaved` (yellow dot), `error` (red dot + retry link), `offline` (gray dot).
- Debounce: 3 seconds after last keystroke.
- `Cmd+S` saves immediately, cancels pending debounce.
- Retry on failure: exponential backoff 2s → 4s → 8s, max 3 attempts.
- Offline: stores pending changes in `localStorage` key `newsletter-draft-{editionId}`, syncs on `navigator.onLine` event.
- Conflict detection: compares `updated_at` from server response. If server version is newer, shows merge prompt.
- Disabled for `sent`, `sending`, `cancelled` statuses.

#### 13. NavigationGuard (`_components/navigation-guard.tsx`)
- `beforeunload` event listener when `hasUnsavedChanges = true`.
- Next.js router intercept for client-side navigation.
- Modal: "Unsaved changes" with 3 buttons: "Discard & Leave", "Save & Leave", "Stay on page".

#### 14. ToastProvider (app-level, `_components/toast-provider.tsx`)
- Success: green, auto-dismiss 3s.
- Error: red, persistent until dismissed. Shows error message + retry link.
- Warning: yellow, 5s.
- Position: bottom-right. Max 3 stacked.
- Uses `sonner` library or built with Radix Toast.

### Editor Layout (Modified `[id]/edit/page.tsx`)

Top-to-bottom layout:

1. **Status bar** — status badge, type selector (dropdown, editable while idea/draft), autosave indicator, action buttons (Test, Duplicate, Delete).
2. **Metadata row** — subject input, preheader input (2-column grid).
3. **Options row** — segment dropdown (`all | high_engagement | re_engagement | new_subscribers` with counts), web archive checkbox.
4. **WYSIWYG area** — EditorToolbar + TipTapEditor (white background, rich text). Content area IS the preview — no separate preview pane needed.
5. **Notes** — collapsible `<details>` with textarea for internal notes (not included in email).
6. **Action bar** — bottom sticky bar with audience count, reading time, word count, "📧 Preview as Email" button, "⚡ Send Now" button, "📅 Schedule..." button.

### Dashboard Context Menus (Modified `newsletters-connected.tsx`)

All menu items wired to real actions:

| Status | Menu Items |
|--------|-----------|
| **idea** | Edit, Convert to Edition, Delete |
| **draft** | Edit, Send Test, Schedule..., Send Now, Duplicate, Delete |
| **ready** | Edit, Send Test, Schedule..., Send Now, Duplicate, Delete |
| **scheduled** | Edit (unschedules), Reschedule..., Send Now, Duplicate, Cancel Schedule, Delete |
| **sending** | *(locked — no actions)* Progress indicator: "47/142 delivered..." |
| **sent** | View (read-only), Analytics, Web Archive, Duplicate as Draft, Delete... |
| **failed** | Retry ({n} remaining), Edit & Reschedule, Duplicate, Delete |
| **cancelled** | Revert to Draft, Duplicate, Delete |

### Type Card Context Menu (Modified `_components/type-cards.tsx`)

- **Edit Type** → opens TypeModal in edit mode
- **Type Settings** → navigates to `/cms/newsletters/settings` scrolled to type
- **Type Analytics** → navigates to `/cms/newsletters/analytics?type={id}` (filtered view)
- **Deactivate** → sets `active = false`, hides from "New Edition" dropdown. Reversible.
- **Delete Type...** → opens DeleteConfirmModal with subscriber/edition impact counts.

### Settings Page Enhancement (Modified `settings/page.tsx`)

3 tabs:
1. **Per-Type Settings** (existing, enhanced) — cadence_days, preferred_send_time, cadence_paused. Now also shows sender_name, sender_email, reply_to as editable fields per type.
2. **Sender Defaults** (new tab) — default sender_name, sender_email, reply_to applied to new types.
3. **Bounce Policy** (new tab) — max_bounce_rate_pct (default 5%), auto-pause behavior explanation.

### Keyboard Shortcuts

#### Editor
| Shortcut | Action |
|----------|--------|
| `⌘S` | Save immediately |
| `⌘⇧P` | Toggle email preview |
| `⌘B` | Bold |
| `⌘I` | Italic |
| `⌘U` | Underline |
| `⌘K` | Insert link |
| `⌘⇧T` | Send test email |
| `Esc` | Close modals |

#### Dashboard
| Shortcut | Action |
|----------|--------|
| `N` | New edition |
| `I` | Quick idea |
| `/` | Focus search |
| `↑↓` | Navigate editions |
| `Enter` | Open selected edition |
| `?` | Show shortcuts help |

### Delete Confirmation Tiers

| Tier | Trigger | UI |
|------|---------|-----|
| **Low** | Draft without content, idea title-only, type without subscribers | Simple confirm: "Delete this draft?" + Cancel/Delete buttons |
| **Medium** | Draft with content, scheduled edition, type with subscribers but no sent editions | Shows subject + impact info. Button: "Delete & Cancel Send" |
| **High** | Sent edition, type with subscribers + sent editions | Shows full impact stats (subscribers, editions, analytics records). Requires typing "DELETE" (for editions) or type name (for types). Suggests "Deactivate Instead" for types. Button disabled until confirmation text matches. |

### Toast Messages

| Event | Type | Message | Dismiss |
|-------|------|---------|---------|
| Edition saved | success | "Edition saved" | auto 3s |
| Test email sent | success | "Test sent to {email}" | auto 3s |
| Edition scheduled | success | "Scheduled for {date} at {time} {tz}" | auto 3s |
| Edition deleted | success | "Edition deleted" | auto 3s |
| Type created | success | "Newsletter type created" | auto 3s |
| Send now started | success | "Sending to {count} subscribers..." | auto 5s |
| Idea saved | success | "Idea saved" | auto 3s |
| Image uploaded | success | "Image uploaded" | auto 2s |
| Save failed | error | "Failed to save — {error}" + Retry | persistent |
| Schedule failed | error | "Failed to schedule — {error}" | persistent |
| Upload failed | error | "Image upload failed — {error}" | persistent |
| Network error | error | "Connection error — changes saved locally" | persistent |
| Conflict detected | warning | "Edition was modified in another tab" | 5s |
| Schedule conflict | warning | "Another edition is scheduled within 2 hours" | 5s |
| Unsaved nav | warning | "You have unsaved changes" | persistent (modal) |

### Dependencies (4 new)

| Package | Version | Size | Purpose |
|---------|---------|------|---------|
| `@tiptap/react` | latest | ~15KB | React bindings for TipTap |
| `@tiptap/starter-kit` | latest | ~35KB | Core extensions bundle |
| `@tiptap/extension-*` (8) | latest | ~20KB total | Underline, Link, Image, TextAlign, Color, TextStyle, Highlight, Placeholder, CharacterCount |
| `juice` | ^11 | ~20KB | CSS inlining for email HTML |

## Testing

- All 14 server actions: unit tests with status guard assertions (verify blocked transitions return correct error codes).
- Status transition matrix: integration test that attempts every cell in the matrix and asserts allowed/blocked.
- `sanitizeForEmail()`: unit tests verifying CSS inlining, XSS stripping, Outlook VML wrapping, image width attrs, merge tag replacement.
- Delete tiers: test that impact assessment returns correct subscriber/edition counts.
- Autosave: test debounce timing and localStorage fallback.
- Image upload: test size/format validation, Supabase Storage integration.
- Type CRUD: test create, edit, deactivate, delete with and without subscribers.
- Idea bank: test create idea, convert to edition, filter by ideas tab.
- TipTap editor: test that toolbar buttons toggle marks, custom nodes serialize correctly.
- Paste cleanup: test Word/Docs HTML transforms to clean output.

## Migration Safety

- All 3 migrations are additive (ADD COLUMN, ADD CHECK value, ADD POLICY). No destructive changes.
- `ALTER newsletter_type_id DROP NOT NULL` is safe — existing rows all have values, only new `idea` rows will have NULL.
- `content_json` column added as nullable — existing editions with `content_mdx` continue working.
- Backfill `site_id` on `newsletter_types` uses deterministic single-site query.
- Idempotent: uses `IF NOT EXISTS`, `DROP POLICY IF EXISTS` patterns per project convention.
