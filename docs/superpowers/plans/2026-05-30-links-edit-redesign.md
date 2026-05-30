# Links Edit Page — Visual Redesign Plan

> **Goal:** Redesign `/cms/links/[id]/edit` to match the design system with breadcrumb toolbar, design tokens, and proper layout.

**Current state:** Functional with old Tailwind styling. Missing breadcrumb, uses bg-background/border-border instead of design tokens.

**Reference:** Same toolbar pattern as linktree editor (breadcrumb + badge + Cancelar/Salvar buttons).

**Estimated effort:** ~3-4h

---

## Design Reference

### Toolbar (56px height)
- Background: `var(--bg-side)`
- Breadcrumb: `Links > {title} > Editar` (12.5px, ink-dim → ink)
- Source badge: purple "Newsletter" (or whatever source_type)
- Domain: mono 11.5px ink-dim (go.bythiagofigueiredo.com/slug)
- Right: Cancelar (ghost) + Salvar (accent with checkmark)

### Form Sections
Each section has:
- Eyebrow header (10.5px uppercase ink-faint) with icon
- Inputs: `var(--surface)` bg, `var(--line-strong)` border, 9px radius, 11px 13px padding, 13.5px font
- Labels: 12px ink-dim, mb 7px

### Sections:
1. **DESTINATION** — URL input + Title input
2. **IDENTIFIER** — Custom Slug (disabled, readonly) + Preview link
3. **CLASSIFICATION** — Source Type (pill buttons) + Tags input
4. **BEHAVIOR** — Redirect Type (301/302/307/308 grid), Expires At, Click Limit, Ativação programada
5. **OPTIONS** — Password Protection, Active toggle

### UTM Section (collapsible)
- utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id
- All inline style inputs with design tokens

---

## Files to Modify

1. `apps/web/src/app/cms/(authed)/links/[id]/edit/page.tsx` — Server component (add breadcrumb data)
2. `apps/web/src/app/cms/(authed)/links/[id]/edit/_edit-form.tsx` — Client form (or create new)

## Tasks

### Task 1: Toolbar with breadcrumb (~30min)
Same pattern as linktree editor toolbar.

### Task 2: Form inputs migration (~1.5h)
Replace all Tailwind classes with inline styles using design tokens.

### Task 3: Source type pill buttons (~30min)
Same pattern as CreateLinkModal source selector.

### Task 4: Redirect type grid (~30min)
4-option grid (307/302/301/308) with active state.

### Task 5: UTM section (~30min)
Collapsible accordion with 6 inputs.

### Task 6: Active toggle + Save wiring (~30min)
Toggle switch matching linktree editor pattern.
