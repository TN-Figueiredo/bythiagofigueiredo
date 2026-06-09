-- =============================================================================
-- MIGRATION: one story = one id (kill duplicate pipeline items, forever)
-- =============================================================================
-- Two content_pipeline rows for the same story fragment work across ids (write
-- to X, the card link opens Y empty). This:
--   1. archives the known broken duplicate (v2 of "Acordei às 6h…");
--   2. archives losers in any EXACT normalized-title duplicate group (keeps the
--      most-recently-updated; reversible via is_archived);
--   3. adds a DB-level partial UNIQUE index so a second NON-archived item with the
--      same normalized title (per site + format) is IMPOSSIBLE — on every path
--      (REST, MCP/Cowork, the CMS server action, raw SQL, future tools, races).
-- Archiving is a soft, reversible flag (restore by flipping is_archived) and is
-- tagged via archive_reason so the cleanup is auditable/undoable.

-- 1) Archive the known broken duplicate (its twin has a *different* title, so the
--    title-dedup below won't catch it — target it explicitly).
update public.content_pipeline
   set is_archived = true, archived_at = now(), archive_reason = 'duplicate-cleanup (one-story-one-id)'
 where id = '023ef45d-8429-46f3-a50d-29f082a14c45'
   and is_archived = false;

-- 2) Archive exact normalized-title duplicate LOSERS, keeping the most-recently
--    updated row per (site, format, normalized title). Required before the unique
--    index so its creation can't fail on pre-existing duplicates.
with normalized as (
  select
    id, site_id, format, updated_at, created_at,
    lower(btrim(coalesce(nullif(title_pt, ''), title_en, ''))) as title_key
  from public.content_pipeline
  where is_archived = false
), ranked as (
  select id,
         row_number() over (
           partition by site_id, format, title_key
           order by updated_at desc nulls last, created_at desc nulls last, id
         ) as rn
  from normalized
  where title_key <> ''
)
update public.content_pipeline cp
   set is_archived = true, archived_at = now(), archive_reason = 'duplicate-title-cleanup (one-story-one-id)'
  from ranked r
 where cp.id = r.id
   and r.rn > 1
   and cp.is_archived = false;

-- 3) Race-proof backstop: at most ONE non-archived item per (site, format, title).
--    A video and a blog post may legitimately share a title (different format), and
--    archived/empty-title rows are excluded.
create unique index if not exists content_pipeline_active_title_uniq
  on public.content_pipeline (
    site_id,
    format,
    lower(btrim(coalesce(nullif(title_pt, ''), title_en, '')))
  )
  where is_archived = false
    and coalesce(nullif(title_pt, ''), title_en, '') <> '';
