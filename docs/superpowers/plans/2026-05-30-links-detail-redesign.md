# Links Detail Page — Visual Redesign Plan

> **Goal:** Redesign `/cms/links/[id]` detail page to match the design reference from Claude Design.

**Current state:** Functional but uses old Tailwind styling (bg-background, border-border, text-foreground). Needs design token migration.

**Estimated effort:** ~4-6h

---

## Design Reference Elements

### 1. Header Section
- Breadcrumb: `Social > Links > {title}` with Link2 icon + chevron separators
- Title: Fraunces serif, 29px, 600w
- Action buttons row: Copy URL (ghost), QR (ghost), Pausar (ghost), Editar (accent primary)
- Status row: green dot + "Ativo" + source badge (Newsletter purple) + slug mono + health badge (green "saudável")

### 2. Destination Card
- `var(--surface)` bg, `var(--line)` border, `var(--r)` radius
- "DESTINATION" eyebrow label
- URL with external link icon

### 3. KPI Row (4 tiles)
- Total Clicks, Last 30 Days, Unique Visitors, Top Country
- Same stat tile pattern as hub (icon circles, mono values)

### 4. Details Panel
- Redirect type: `301` + "click IDs on" badge
- Created date
- Health status badge

### 5. Analytics Accordion (expandable)
- Full analytics for this specific link
- Reuses existing chart components

### 6. "View Full Analytics" link → navigates to analytics tab

---

## Files to Modify

1. `apps/web/src/app/cms/(authed)/links/[id]/_detail.tsx` — Main detail component (rewrite)
2. `apps/web/src/app/cms/(authed)/links/[id]/page.tsx` — Server component (data loading)

## Tasks

### Task 1: Header with breadcrumb + actions (~1h)
- Breadcrumb: Social > Links > {title} (same pattern as hub)
- Title: serif 29px
- Buttons: Copy URL, QR, Pausar, Editar
- Status: dot + "Ativo" + source badge + slug + health

### Task 2: Destination card (~30min)
- Card with var(--surface/--line/--r)
- "DESTINATION" eyebrow
- URL as link with external icon

### Task 3: KPI tiles (~30min)
- 4 stat tiles: clicks, last30, unique, top country
- Same inline style pattern as hub

### Task 4: Details panel (~30min)
- Redirect, Created, Health rows
- Badges with proper colors

### Task 5: Analytics section (~1h)
- Sparkline chart for this link
- Source breakdown for this link
- Device/browser/referrer for this link

### Task 6: Action wiring (~1h)
- Copy URL to clipboard
- QR navigation
- Pause/unpause toggle
- Edit navigation
- Delete with confirmation

---

## Dependencies
- All design tokens already defined in globals.css
- Chart components ready in packages/links-admin
- Actions exist in links/actions.ts (toggleLinkActive, deleteLink, etc.)
