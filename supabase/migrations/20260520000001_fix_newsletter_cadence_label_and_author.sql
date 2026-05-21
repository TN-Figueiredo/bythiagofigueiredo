-- Clear all stale cadence_label values so deriveCadenceLabel() auto-derives
-- from cadence_days + cadence_start_date. Covers all standard cadences (7/14/30).
-- Scoped to ByThiagoFigueiredo site only.
UPDATE newsletter_types
SET cadence_label = NULL,
    updated_at = now()
WHERE cadence_label IS NOT NULL
  AND cadence_days IN (7, 14, 30)
  AND site_id = (SELECT id FROM sites WHERE name = 'ByThiagoFigueiredo' LIMIT 1);

-- Link author_id to the default author for newsletter types that have none.
-- Scoped to ByThiagoFigueiredo site only.
UPDATE newsletter_types nt
SET author_id = a.id,
    updated_at = now()
FROM authors a
WHERE a.site_id = nt.site_id
  AND a.is_default = true
  AND nt.author_id IS NULL
  AND nt.site_id = (SELECT id FROM sites WHERE name = 'ByThiagoFigueiredo' LIMIT 1);
