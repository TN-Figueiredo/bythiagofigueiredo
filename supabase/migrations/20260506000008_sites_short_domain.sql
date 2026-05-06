-- Add short_domain to sites: the custom domain used to serve short links
-- (e.g. 'go.bythiagofigueiredo.com').  Nullable — sites without a custom
-- short domain fall back to the primary_domain + /go/ path prefix.
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS short_domain text
    CHECK (short_domain IS NULL OR short_domain ~ '^[a-z0-9]([a-z0-9\-\.]*[a-z0-9])?$');

-- Unique: two sites cannot share the same vanity short domain.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sites_short_domain_unique'
      AND conrelid = 'sites'::regclass
  ) THEN
    ALTER TABLE sites ADD CONSTRAINT sites_short_domain_unique UNIQUE (short_domain);
  END IF;
END $$;

-- Backfill: assign go.bythiagofigueiredo.com to the canonical master site.
UPDATE sites
SET short_domain = 'go.bythiagofigueiredo.com'
WHERE slug = 'bythiagofigueiredo'
  AND short_domain IS NULL;
