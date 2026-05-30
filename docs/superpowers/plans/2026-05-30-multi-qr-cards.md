# Multi QR Cards per Link — Implementation Plan

> **Goal:** Allow creating multiple QR cards per tracked link, each with different designs/templates for different channels (YouTube, site, newsletter, etc.)

**Current state:** Each link has a single `qr_config` JSONB column + `qr_storage_path`. The QR editor at `/cms/links/[id]/qr` creates/edits one QR card.

**New behavior:** Each link can have N QR cards. The detail page shows a horizontal scrollable list. The QR editor creates new cards or edits existing ones.

**Estimated effort:** ~6-8h

---

## Database Changes

### New table: `link_qr_cards`

```sql
CREATE TABLE IF NOT EXISTS public.link_qr_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES tracked_links(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'QR Card',
  template_id text, -- references QR_TEMPLATES
  config jsonb NOT NULL DEFAULT '{}', -- QrConfig (colors, logo, etc.)
  composition jsonb, -- CardComposition (canvas layout)
  storage_path text, -- exported image path in Vercel Blob
  preview_url text, -- thumbnail for listing
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_link_qr_cards_link ON link_qr_cards (link_id);
ALTER TABLE link_qr_cards ENABLE ROW LEVEL SECURITY;

-- RLS: same as tracked_links
CREATE POLICY link_qr_cards_staff_read ON link_qr_cards
  FOR SELECT TO authenticated USING (public.can_view_site(site_id));
CREATE POLICY link_qr_cards_staff_write ON link_qr_cards
  FOR ALL TO authenticated USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));
```

### Migration of existing data

Move existing `tracked_links.qr_config` + `tracked_links.qr_storage_path` to `link_qr_cards` for links that have QR configured:

```sql
INSERT INTO link_qr_cards (link_id, site_id, name, config, storage_path)
SELECT id, site_id, 'QR Card', COALESCE(qr_config, '{}'), qr_storage_path
FROM tracked_links
WHERE has_qr = true AND qr_config IS NOT NULL;
```

---

## UI Changes

### 1. Detail page — QR Cards section (replaces single QR Card)

Instead of one QR Card tile, show a horizontal scrollable list:

```
QR CARDS · N/∞
┌──────────┐  ┌──────────┐  ┌──────────┐
│  [QR]    │  │  [QR]    │  │   + Novo  │
│ YouTube  │  │ Site     │  │  QR Card  │
│ Editar   │  │ Editar   │  │           │
└──────────┘  └──────────┘  └──────────┘
```

- Each card: 120x140px, QR preview, name, "Editar" button
- Last card: "+ Novo QR Card" button (creates new and navigates to editor)
- Horizontal scroll with `overflow-x: auto`, `gap: 12px`

### 2. QR Editor — support card ID

Update `/cms/links/[id]/qr` route to accept `?card=<cardId>`:
- No card param → create new card
- With card param → edit existing card
- Save creates/updates in `link_qr_cards` table

### 3. Card naming

When creating, auto-name based on template:
- "QR Card — Newsletter"
- "QR Card — Story"
- "QR Card — Adesivo"

User can rename in the editor.

---

## Tasks

### Task 1: Migration (~30min)
- Create `link_qr_cards` table
- Migrate existing QR data
- RLS policies

### Task 2: Server actions for QR cards (~1h)
- `createQrCard(linkId, config)` → creates new card
- `updateQrCard(cardId, config)` → updates existing
- `deleteQrCard(cardId)` → deletes card
- `listQrCards(linkId)` → lists all cards for a link

### Task 3: Detail page QR section (~1.5h)
- Horizontal scrollable card list
- Each card shows QR preview + name
- "+ Novo QR Card" button
- Editar navigates to `/cms/links/[id]/qr?card=<cardId>`

### Task 4: QR Editor route update (~1h)
- Accept `?card=<cardId>` query param
- Load existing card data if editing
- Create new card on save if no card param
- Update existing card if card param present

### Task 5: Card naming + management (~30min)
- Auto-name from template
- Rename in editor toolbar
- Delete card confirmation

### Task 6: Preview thumbnails (~1h)
- Generate preview thumbnail on save
- Store in Vercel Blob
- Display in card list

---

## Dependencies
- `QR_TEMPLATES` already defined in packages/links-admin
- `QrCardBuilder` component already exists
- Server actions for single QR already exist at `/cms/links/[id]/qr/actions.ts`
