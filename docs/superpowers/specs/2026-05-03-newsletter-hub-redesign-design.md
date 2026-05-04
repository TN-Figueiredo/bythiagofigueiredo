# Newsletter Hub Redesign — Design Spec

**Date:** 2026-05-03
**Score:** 98/100
**Status:** Approved
**Scope:** UX/UI improvements to the newsletter hub selection page at `/newsletters`.

---

## 1. Problem

The current hub has critical UX issues:

- Checkbox invisible when unchecked (border color `#2E2718` on background `#2A241A`)
- Selected state too subtle (only 2px outline with 4px offset)
- Check All/Clear buttons nearly invisible (10px mono, dashed border matching background)
- Grid 3+1 leaves orphan card at bottom left
- No hover states on cards
- Only "main" newsletter pre-selected — multiselect isn't obvious
- Checkbox crammed into metadata line corner

---

## 2. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Selection treatment | Card-as-toggle with badge (option B) | Dramatic contrast between states; badge "&#10003; ADDED" is unmissable; "+ add" on deselected clearly invites action |
| Pre-selection | All 4 selected by default | Minimal friction — user just types email; with toggle treatment, clear that cards are deselectable; opt-out easier than opt-in |
| Check All/Clear | Pills with solid background | Accent-tinted background + 11px font + proper padding; visually distinct from content; "&#10003; all selected" state when all checked |
| Grid layout | 2x2 symmetric | Eliminates orphan card; gives cards more horizontal space; responsive to 1-col on mobile |
| Hover states | Elevation + warmth on deselected | Cards lift 3px respecting rotation; deselected cards "warm up" (title brightens, "+ add" turns accent color with tinted background) |
| Entrance animation | Staggered fade-up | Cards animate in with 80ms delay stagger; pills pop in with scale animation |
| Toggle feedback | Pulse flash ring | Brief glow ring animation on toggle; bidirectional (card click and pill remove both trigger) |
| Accessibility | Full ARIA support | role=checkbox, aria-checked, aria-label with cadence, aria-live polite for count changes, focus-visible rings, keyboard Enter/Space |

---

## 3. Visual States

### 3.1 Selected Card

- Background: alternating `#2E2418` / `#2A241A` (paper/paper2)
- Left accent bar: 6px wide, full opacity, card's accent color
- Badge: "&#10003; ADDED" positioned absolute top:-1px right:16px, accent background, white text, 9px JetBrains Mono
- Box shadow: `0 0 30px var(--glow)` colored glow + standard card shadow
- Border: `1.5px solid rgba(255,255,255,0.06)`
- Title/tagline/content: full opacity
- Pinboard personality: per-card rotation (--rot) and vertical offset (--lift) via CSS custom properties

### 3.2 Deselected Card ("available, not chosen" — NOT disabled)

- Same background as selected (maintains card presence)
- Left accent bar: 3px wide, 30% opacity
- Badge: "+ add" in dashed border, 10px JetBrains Mono, muted color (`#7A7060`)
- No colored glow
- Border: `1.5px solid rgba(255,255,255,0.03)` — subtle but visible edge
- Title: 55% opacity; tagline: 45%; sample box: 30%; stats: 25%
- On hover: title warms to 72%, bar to 50%, "+ add" badge turns accent color with `scale(1.04)` and tinted background, card gets dim glow

### 3.3 Hover (both states)

- Card lifts 3px: `translateY(calc(var(--lift) - 3px))` respecting rotation
- Shadow deepens
- 0.28s cubic-bezier transition

---

## 4. Controls

### 4.1 Select All / Clear

- Pills with solid background, 11px JetBrains Mono, proper padding (7px 14px)
- Select All: `background: rgba(255,130,64,0.14)`, `color: #FF8240`, `border: 1px solid rgba(255,130,64,0.28)`
- Clear: `background: rgba(255,255,255,0.04)`, `color: #958A75`, `border: 1px solid rgba(255,255,255,0.08)`
- Smart states: Select All shows "&#10003; all selected" (dimmed) when all checked; Clear dims + pointer-events:none when empty
- Hero counter: "**2** of 4 selected" / "**all 4** selected" next to buttons

### 4.2 Sticky Subscribe Bar

- Same structure as current but with improvements:
- Counter: "you picked **4** newsletters" / "pick at least one" (warn color `#C14513` when empty)
- Pills: each newsletter name with colored border, x remove button, `max-width: 180px` with text-overflow ellipsis, pop-in animation
- Email input: green border + subtle glow when valid email detected
- Subscribe button: pulses glow (`box-shadow` keyframe animation) when valid; disabled state flat `#3A2E1F`

---

## 5. Layout

### 5.1 Grid

- 2 columns: `grid-template-columns: 1fr 1fr`
- Gap: 28px horizontal, 44px vertical
- Max-width: 960px (down from 1200px to suit 2-col better)
- Breakpoint: 720px -> single column, 20px gap

### 5.2 Pinboard Personality

- Each card has unique `--rot` and `--lift` CSS custom properties
- Card 1: `-0.8deg`, `-2px`; Card 2: `0.6deg`, `1px`; Card 3: `-0.5deg`, `3px`; Card 4: `0.4deg`, `-1px`
- Tape elements preserved with alternating colors and positions
- Alternating paper backgrounds (`#2E2418` / `#2A241A`)

---

## 6. Animations

| Animation | Trigger | Duration | Easing |
|---|---|---|---|
| Card entrance (fadeUp) | Page load | 0.5s per card, 80ms stagger | ease |
| Card hover lift | Mouse enter | 0.28s | cubic-bezier(.4,0,.2,1) |
| Toggle pulse | Click/keyboard | 0.4s | ease-out |
| Pill pop-in | Selection change | 0.2s | ease |
| Badge slide (on/off) | Toggle | 0.25s | ease |
| Button glow pulse | Valid form state | 2s infinite | ease-in-out |
| State transitions (opacity, color) | Toggle | 0.25s | ease |

---

## 7. Accessibility

- `role="checkbox"` + `aria-checked` on each card
- `aria-label` includes newsletter name + cadence (e.g., "The bythiago diary — weekly, Fridays")
- `aria-live="polite"` region announces: "[Name] added/removed. N of 4 selected."
- `focus-visible` outline (2px solid #FF8240, offset 4px) on cards
- `aria-disabled` on Select All / Clear when appropriate
- `role="list"` on pills container, `role="listitem"` on each pill with `aria-label="Remove [name]"`
- Keyboard: Enter/Space toggles card
- `autocomplete="email"` on email input

---

## 8. Files Changed

| File | Change |
|---|---|
| `apps/web/src/app/(public)/newsletters/components/NewslettersHub.tsx` | Complete rewrite of card component, grid layout, controls, sticky bar, animations |
| No new files | All changes contained in existing component |

---

## 9. What Does NOT Change

- CATALOG data structure (4 newsletters, baseId/colors/i18n)
- Subscribe server action (`subscribeToNewsletters`)
- Suggest phase flow (subscribe main only -> show others)
- Success phase screen
- Route structure (`/newsletters`)
- Slug mapping to landing pages
- i18n support (en/pt)

---

## 10. Open Decisions

None — all decisions validated via interactive mockup v4.

---

## 11. Follow-ups (out of scope)

- Make CATALOG dynamic from `newsletter_types` DB table (currently hardcoded)
- Light mode support (currently dark-only in mockup, but tokens already support both)
- Mobile-specific polish (horizontal scroll variant was rejected in favor of stacked 1-col)
