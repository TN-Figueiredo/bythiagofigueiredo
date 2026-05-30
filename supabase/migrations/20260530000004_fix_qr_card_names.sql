-- =============================================================================
-- MIGRATION: Fix generic "QR Card" names — use link title instead
-- =============================================================================

UPDATE link_qr_cards c
SET name = COALESCE(NULLIF(t.title, ''), '/' || t.code)
FROM tracked_links t
WHERE c.link_id = t.id
  AND c.name = 'QR Card';
