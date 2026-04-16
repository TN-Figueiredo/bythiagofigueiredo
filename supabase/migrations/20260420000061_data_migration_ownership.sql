-- Sprint 4.75 data migration — Step 2/5: backfill content ownership.
-- blog_posts.owner_user_id ← authors.user_id via authors FK.
-- campaigns.owner_user_id ← any org_admin of the site's org (DISTINCT ON).


BEGIN;

UPDATE blog_posts bp SET owner_user_id = a.user_id
FROM authors a
WHERE bp.author_id = a.id AND bp.owner_user_id IS NULL;

-- Fallback: assign each campaign's owner_user_id to any org_admin of the
-- campaign's org. PostgreSQL doesn't allow LIMIT on UPDATE, so we use a
-- DISTINCT ON subquery to pick one deterministic candidate per site.
UPDATE campaigns c SET owner_user_id = sub.user_id
FROM (
  SELECT DISTINCT ON (s.id) s.id AS site_id, om.user_id
  FROM organization_members om
  JOIN sites s ON s.org_id = om.org_id
  WHERE om.role = 'org_admin'
  ORDER BY s.id, om.user_id
) sub
WHERE c.site_id = sub.site_id AND c.owner_user_id IS NULL;

COMMIT;
