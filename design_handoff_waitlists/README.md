# Handoff: Waitlists — Listas de espera (CMS admin + superfícies públicas)

## Overview

A new **Waitlists** capability for ByThiagoFigueiredo: visitors sign up to be emailed when a not-yet-released product launches, and the operator manages those lists — and fires the one-shot launch broadcast — from the CMS.

It spans **two environments**, each in its own design language:

1. **CMS admin** (dark dashboard, English-first) — a new **Waitlists** module wired into the existing CMS shell. Five surfaces: the **list** (six status states), the **create/edit drawer**, the **detail page** (status-transition strip + overview + signups), the **signups** table (filters + keyset pagination + CSV export), and the high-stakes **launch broadcast** dialog (type-the-slug to confirm).
2. **Public surfaces** (the live "Pinboard" editorial aesthetic, pt-BR primary + EN) — the **hosted landing** in every state, the **embeddable block** (iframe), and the **inline node inside a blog post** (+ how the TipTap editor represents it).

Core product principle, enforced in the UI: **single opt-in, honest by construction.** Email + one consent checkbox — no name, no phone, no price. The launch broadcast is one email, cannot be undone, and is gated behind typing the waitlist's slug. The public copy never claims residency the creator doesn't have (DNA rule: the narrative is the *transition* Brazil→Asia, not "I live there").

---

## About the Design Files

The files in `design_files/` are **design references built in HTML/React-via-Babel** — runnable prototypes that show the intended look and behavior. They are **not** meant to be copied into production as-is. The task is to **recreate these designs in the target codebase's environment** (the real app is Next.js + React + Supabase, per the project) using its established components, data layer, and patterns.

Specifically:
- The prototypes render React 18 through an in-browser Babel transformer and store ephemeral state in `localStorage`. In production, replace that with real components and Supabase tables.
- The CMS module reuses the **existing CMS design system** (tokens, `Icon`, `Card`, `EmptyState`, `Badge`, drawer/tabs/table primitives, `pushToast`). Do **not** rebuild these — reuse what the codebase already has.
- The public surfaces reuse the live site's **Pinboard kit** (`makePinboardTheme` / `makePinboardKit` / `PageHeader` from `shared.jsx`). In production these are the real site components; the prototype loads them from CDN-pinned React + Babel.

To run the prototypes:
- **CMS admin** — open `design_files/index.html` and click **Waitlists** in the sidebar.
- **Public surfaces** — open `design_files/waitlist-publico.html`. Toggle PT/EN and light/dark from the top strip; the three surfaces stack down the page (landing → state gallery → embed → blog node).

---

## Fidelity

**High-fidelity.** Final colors, typography, spacing, interactions, every state, and motion are specified. Recreate accurately using the codebase's component library, then wire to real data + the email pipeline.

---

## Architecture of the prototype (map to production)

### CMS admin module

| Prototype file | Responsibility | Production equivalent |
|---|---|---|
| `waitlist-data.js` | Seed data + the shape of waitlists, signups, and linked campaigns. Exposes `window.WL`. | Supabase schema + seed; enums as TS unions. |
| `views-waitlists.jsx` | The create/edit **drawer**, the **broadcast** dialog, the **export** dialog, and the **embed** dialog (all portalled to `document.body`); status/source/suppression enums; `WlBadge`. | Feature components + server actions. |
| `views-waitlists-main.jsx` | The **list**, **status strip**, **detail** (overview + signups tabs), and the `WaitlistsView` entry + all state/mutations. | A `WaitlistsModule` feature. |
| `waitlists.css` | Module-specific styles (six status badges, status strip, modals, signups table bits). No new color tokens — reuses existing domain/semantic tokens. | Component styles using existing tokens. |

#### Wiring into the CMS shell (what changed in `shell.jsx` + `index.html`)
- Added a `waitlists` nav item (icon `gift`) in the sidebar, after Newsletters.
- Added `waitlists` to `CORE` (routes that render a real view) and to `ROUTES` (valid hash routes), and `waitlists: ["Waitlists", null]` to `TITLES`.
- Rendered `{route === "waitlists" && <WaitlistsView go={go} state={dataState} />}` in the content area.
- `index.html`: added `<link rel="stylesheet" href="waitlists.css">`, `<script src="waitlist-data.js">`, and the two `text/babel` view scripts (`views-waitlists.jsx` then `views-waitlists-main.jsx`) **before** `shell.jsx`.

> **Implementation note (a bug we fixed):** the drawer + all three dialogs **must render through `ReactDOM.createPortal(..., document.body)`**. Rendering an overlay inside the module tree crashed React with a `removeChild` reconciliation error on unmount (and the rich-text intro field must be uncontrolled — `contentEditable` + `dangerouslySetInnerHTML` read on save via a ref — or the same crash recurs). Keep both.

### Public surfaces

| Prototype file | Responsibility | Production equivalent |
|---|---|---|
| `waitlist-content.js` | The featured product + all copy (pt + en). Exposes `window.WL_PUB`. | CMS-authored waitlist record (name, intro, slug). |
| `waitlist-public.jsx` | `WaitlistForm` — the single form that drives **every** state (idle/submitting/success/duplicate/closed/launched/error/rateLimited/unavailable), the Turnstile slot, the consent + email fields, the message blocks. Exposes `window.WaitlistForm`. | `<WaitlistForm slug>` component + a POST endpoint. |
| `waitlist-surfaces.jsx` | Composition: hosted landing, the labeled **state gallery**, the **embed** frames + copy-paste snippet, and the **blog article + inline node + TipTap inset**. Exposes `window.WaitlistPublic`. | A `/waitlists/[slug]` page, an `/embed/...` route, and a TipTap node-view. |
| `waitlist-publico.html` | Fonts, top-strip (PT/EN + theme), bootstrap. Loads `shared.jsx` (Pinboard kit) + `content.js` (site i18n/nav). | The real site shell + components. |
| `shared.jsx`, `content.js` | **Existing live-site** kit + content (context — do not re-implement). | Existing site design system. |

---

## Data model

All on `window.WL` (`waitlist-data.js`). Suggested Supabase tables in parentheses.

### Waitlist — `waitlists`
```
{
  id, name, slug,                  // slug is unique per site; public URL /waitlists/{slug}
  status,                          // see lifecycle below
  signups, pending, suppressed,    // counts (pending = eligible recipients)
  campaign,                        // optional linked campaign id (first-party context only)
  description, intro,              // intro = rich text shown above the public form
  sender_name, sender_email, reply_to,   // sender_email validated against owned domains
  sources: { landing, embed, post },     // signup attribution
  created, updated, launched_at
}
```
- **status lifecycle** (the six states, with badge colors reusing existing tokens):
  - `draft` (muted/grey) — private, not public.
  - `open` (green / `--ok`) — accepting signups.
  - `closed` (amber / `--warn`) — public, signups rejected, still broadcastable.
  - `launching` (cyan / `--c-pipeline`, **pulsing dot**) — broadcast in flight.
  - `launched` (purple / `--c-newsletter`) — **terminal**; the launch email was sent.
  - `failed` (rose / `--danger`) — operator-recoverable.
- **Legal transitions** (enforced by the status strip): `draft→open`; `open→closed` or `open→launching` (Launch); `closed→open` (Reopen) or `closed→launching` (Launch); `launching→launched` (automatic, when the send finishes); `launched→` *nothing* (terminal); `failed→closed` (Resume/Retry — reverts so you can re-launch, deleting the failed edition). Enforce server-side.

### Signup — `signups`
```
{ id, email, status, suppression_reason, source, created, locale }
```
- **status**: `pending` (eligible) | `suppressed`.
- **suppression_reason** (only when suppressed): `unsubscribe` | `bounce` | `complaint`.
- **source**: `landing` | `embed` | `post`. These three values are the only ones that ever render (as mono pills).
- A waitlist's `pending` count = eligible recipients = exactly what the broadcast dialog sends to and what "Exclude suppressed" leaves in the CSV.

### Campaign — `campaigns` (link target only)
`{ id, title }` — a waitlist may link one campaign for first-party lead-magnet context. Never a third-party promo.

---

## Screens / Views — CMS admin

### 1. Module header + KPIs + list
- **Header** (`.mod-head`): title "Waitlists", a live pill, spacer, primary **"New waitlist"**.
- **KPI strip** (`.wl-kpis`, 4 cards): Waitlists (+ open count), Total signups, Linked campaigns, Needs attention (failed + launching; turns `--danger` when > 0).
- **Table** (`.data`): Name (name + `/waitlists/{slug}`), Status (`WlBadge`), Signups (count, with a `−N` suppressed sub showing a tooltip), Linked campaign (megaphone + title, or `—`), Updated (relative). Whole row is clickable → detail.
- **Empty state**: `EmptyState` (icon `gift`) + a "New waitlist" CTA. **Loading**: KPI + row skeletons. (Toggle via the topbar Tweaks → data state.)

### 2. Create / edit drawer (`EditDrawer`, portalled)
Right-side drawer. Fields: **Name**; **Slug** (auto-filled from name via `slugify`, editable; shows an inline **`.wl-field-err` "slug already taken"** when it collides with another list); **Description**; **Intro** (a minimal rich-text field — uncontrolled `contentEditable`, read on save); **Linked campaign** (a searchable `CampaignPicker` popover, or None); **Sender name / Sender email / Reply-to** (sender email shows an inline error unless on an owned domain); and a **consent preview** showing the exact line the visitor will see. Foot: Cancel + Create/Save. **Esc closes.**

### 3. Detail page (`WaitlistDetail`)
- **Back** link, title + large `WlBadge`, the full public URL, and **"Embed"** + **"Edit"** buttons.
- **Status-specific banner**: `launching` → in-flight banner; `launched` → "launched on {date}"; `failed` → failure + recovery banner.
- **Status strip** (`.wl-strip`): only the legal transition buttons for the current status (see transitions above), each with a one-line hint; the Launch button is the accent CTA; Resume/Retry is the recover style.
- **Tabs**: Overview · Signups (with count).

**Overview tab**: "What's coming" (description + intro), "Signups by source" (landing/embed/post bars + pending/suppressed), a **Launch broadcast** CTA card (shows eligible-recipient count; disabled when `pending === 0` or status isn't open/closed), and a Details card (campaign, sender, reply-to, created).

**Signups tab** (`SignupsTab`): search by **email prefix**, status filter chips (All/Pending/Suppressed), a table (email · status · suppression · source pill · created), **Export CSV** button, and a **pager** (Prev/Next; production should use keyset/`created_at` cursors, not offset).

### 4. Launch broadcast dialog (`BroadcastDialog`, portalled)
The one-shot launch. A red **"cannot be undone"** warning, a **live recipient count** (`pending`), and a **type-the-slug** confirm input — the "Launch now" button stays **disabled** until the typed text exactly equals the slug (input border goes green on match). At **0 recipients** the input is replaced by "No eligible recipients" and launch is disabled. Autofocuses the confirm input; **Esc closes**. On launch: status → `launching` + a toast; production flips to `launched` when the send completes. Open/click tracking is disabled for this send (stated in the warning).

### 5. CSV export dialog (`ExportDialog`, portalled)
Status filter (All/Pending/Suppressed), optional date range, an **Exclude suppressed** toggle (default on), and a columns note (`email · status · suppression_reason · source · locale · created`; anonymized rows always omitted). The button shows the estimated row count. **Esc closes.**

### 6. Embed dialog (`EmbedDialog`, portalled)
Ties the public embed surface back into the admin: an optional **6-hex accent** input that live-updates the `?accent=` on a copy-paste `<iframe>` snippet (with a swatch preview), a **Copy snippet** button (clipboard + `execCommand` fallback + `aria-live` announcement), and a note that embed signups land tagged `embed`. **Esc closes.**

---

## Screens / Views — Public surfaces

> Aesthetic: the live **Pinboard / Marginalia** language — Fraunces (display) + Source Serif 4 (prose) + Inter (UI) + JetBrains Mono (labels), warm paper cards, brand orange (`#C14513` light / `#FF8240` dark) as the anchor accent (≤10% of the screen). Single opt-in — **no confirmation email anywhere**.

### Surface 1 — Hosted landing (`/waitlists/{slug}`)
Two columns: a pitch (eyebrow + "opens in July" chip + an honest **social-proof chip** "1.284 já na lista" + big Fraunces title + italic tagline + description + a "what you'll get" list) and a sticky **live form card** (taped corner). The form is `WaitlistForm` in `idle`, fully interactive in the prototype.

### Surface 1b — The state gallery
Every state as a labeled frame (the spec made visible): `idle`, `submitting`, `success`, `duplicate`, `closed`, `launched`, `error`, `rateLimited` (429), `unavailable` (503). Rules made explicit in the frames:
- **Email + one consent checkbox** (consent sits directly under email), then the **Turnstile** security slot.
- **success / duplicate** *replace the form in place* (no email field), reassure ("one email only · unsubscribe anytime"), and show the brand **fleuron ❦** end-mark; on submit, keyboard focus moves to the `role="status"` result.
- **closed / launched** are message blocks with **no form**; closed uses a neutral (not orange) stripe; launched offers an optional link to the live product.
- **error / 429 / 503** keep the form and add a `role="alert"` banner (503 = missing Turnstile key failing closed — an honest "temporarily unavailable").

### Surface 2 — Embeddable block (`/embed/waitlists/{slug}`)
The same form in a ~480px card that stands alone on a neutral host page (thin border + shadow). Three frames: **default**, **custom accent** (`?accent=RRGGBB`), **success**. Below them, a **copy-paste snippet**: the `<iframe>` + an optional `postMessage` **`waitlist:resize`** listener for auto-height, with a working Copy button (clipboard + fallback + `aria-live`).

### Surface 3 — Inline node inside a blog post
The form interrupts an article as a distinct, accent-bordered/tinted block (a handwritten "curtiu? entra na lista." lead-in, then the `inline` variant of `WaitlistForm`). Beside it, the **TipTap inset** shows how the editor represents the node: a selectable/draggable "waitlist node" block that **serializes as `<WaitlistForm slug="…" />`** in MDX.

---

## Interactions & Behavior

- **Submit (public, prototype demo)**: typing an email containing `dup` → duplicate; `blocked` → rateLimited; `erro`/`fail` → error; anything else → success. In production this is a POST that returns the real outcome. The Turnstile slot is a click-to-verify micro-interaction in the live form (static in the gallery frames).
- **Status transitions (CMS)**: only legal moves are offered per status; launching disables everything; launched is terminal; failed recovers to closed.
- **Broadcast guard**: disabled until the typed slug matches; disabled at 0 recipients; `launching` toast on send.
- **Esc** closes every CMS overlay (drawer + all dialogs); the broadcast confirm input autofocuses.
- **Persistence (prototype)**: public tweaks (lang/theme) in `localStorage["btf_wlpub"]`; CMS state is in-memory React state. Replace with Supabase + the email provider in production.

### Motion
- Tab/section enter: `.fade-in` (existing CMS) / paper-card presence on public.
- `launching` badge dot: `wlPulseDot` pulse.
- Public spinner honors `prefers-reduced-motion`.
- Modal entrance kept instant (no `opacity:0` keyframe) so it renders under print/backgrounded tabs.

---

## Design Tokens

**CMS admin**: reuse the existing CMS tokens (`styles.css`) — dark default + `[data-theme="light"]`. The module invents **no** new colors; the six status badges map to `--text-muted/--border-soft` (draft), `--ok` (open), `--warn` (closed), `--c-pipeline` (launching), `--c-newsletter` (launched), `--danger` (failed), each with its existing soft fill.

**Public surfaces**: the live-site Pinboard theme (via `makePinboardTheme(dark)`): warm paper/ink, brand orange `#C14513` (light) / `#FF8240` (dark) as anchor, plus the site's Fraunces/Source Serif/Inter/JetBrains Mono stack. Restrained accent per the brand rule (≤10% of any screen).

> Known trade-off (a11y): the decorative mono micro-labels use the site's `faint` token, which can fall below WCAG AA contrast for small text. This is **inherited from the live site** and kept for visual consistency; raising those to `muted` would improve AA but diverge from the site. Flagged for a product decision (an optional high-contrast toggle could satisfy both).

---

## Components reused from existing systems (do not rebuild)

**CMS** (`components.jsx`): `Icon` (uses `gift`, `megaphone`, `archive`, `linkbio`, `user`, `warn`, `checkcircle`, `pause`, `refresh`, etc.), `Card`, `CardHead`, `EmptyState`, `Badge`, `Skel`; CSS primitives `.btn`/`.chip`/`.seg`/`.tabs`/`.tab`/`.data`/`.search-box`/`.drawer*`/`.fgroup`/`.flabel`/`.finput`/`.fhint`/`.fsection` and layout utilities; the toast helper `pushToast({ kind, icon, title, msg })`.

**Public** (`shared.jsx`): `makePinboardTheme`, `makePinboardKit` (→ `PageHeader`, `Paper`, `Tape`), `Brand`. Site i18n/nav from `content.js`.

## Assets
No images. CMS iconography is the existing inline-SVG `Icon` set. Public surfaces use a tiny inline brand asterisk (`WLBrandMark`) + the ❦ fleuron glyph. The only third-party dependency is Turnstile (Cloudflare) on the public form — represented here as a styled slot.

## Files in this bundle
**New — CMS module:** `waitlist-data.js`, `views-waitlists.jsx`, `views-waitlists-main.jsx`, `waitlists.css`.
**New — public surfaces:** `waitlist-content.js`, `waitlist-public.jsx`, `waitlist-surfaces.jsx`, `waitlist-publico.html`.
**Existing CMS (context — reuse, don't rebuild):** `index.html`, `shell.jsx`, `styles.css`, `views.css`, `blog.css`, `research.css`, `video.css`, `components.jsx`, `states.jsx`, and the sibling `data.js` / view files the shell loads.
**Existing site (context):** `shared.jsx`, `content.js`.

## Open items (not yet built)
- Wire the public form POST to a real endpoint + Supabase, and the launch broadcast to the email provider (SES); flip `launching → launched` on send completion and append nothing the operator can't see.
- Enforce server-side: unique slug per site, single legal transition graph, sender-domain validation at save **and** before send, and the 0-recipient guard.
- Real Cloudflare Turnstile (the slot is a visual placeholder); fail closed (503) when the key is missing in prod.
- Keyset pagination on signups (the prototype pager is offset-based for demo).
- Optional: per-product accent on the public landing (today the landing uses the brand orange; the embed already supports `?accent=`), and the optional high-contrast a11y toggle noted above.
