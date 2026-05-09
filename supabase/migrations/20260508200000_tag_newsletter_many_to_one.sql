-- Allow multiple newsletter types (one per locale) to link to the same blog tag.
-- Changes the relationship from 1:1 to N:1 (many newsletter_types → one blog_tag).

BEGIN;

-- 1. Drop triggers FIRST (they depend on the column we're about to drop)
DROP TRIGGER IF EXISTS trg_sync_tag_newsletter_link ON public.blog_tags;
DROP TRIGGER IF EXISTS trg_sync_newsletter_tag_link ON public.newsletter_types;

-- 2. Drop the unique indexes
DROP INDEX IF EXISTS public.newsletter_types_linked_tag_unique;
DROP INDEX IF EXISTS public.blog_tags_linked_nl_unique;

-- 3. Drop FK + column on blog_tags (no longer needed for N:1)
ALTER TABLE public.blog_tags
  DROP CONSTRAINT IF EXISTS blog_tags_linked_newsletter_type_id_fkey;

ALTER TABLE public.blog_tags
  DROP COLUMN IF EXISTS linked_newsletter_type_id;

-- 4. Replace sync function: newsletter_types side only (cross-site validation)
CREATE OR REPLACE FUNCTION public.sync_tag_newsletter_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_other_site_id uuid;
BEGIN
  IF current_setting('app.skip_link_sync', true) = '1' THEN
    RETURN NEW;
  END IF;

  SET LOCAL app.skip_link_sync = '1';

  IF TG_TABLE_NAME = 'newsletter_types' THEN

    IF TG_OP = 'INSERT' THEN
      IF NEW.linked_tag_id IS NOT NULL THEN
        SELECT site_id INTO v_other_site_id
          FROM blog_tags WHERE id = NEW.linked_tag_id;
        IF v_other_site_id IS DISTINCT FROM NEW.site_id THEN
          RAISE EXCEPTION 'cross-site link forbidden'
            USING ERRCODE = 'P0001', HINT = 'cross_site_link_forbidden';
        END IF;
      END IF;

    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.linked_tag_id IS DISTINCT FROM NEW.linked_tag_id THEN
        IF NEW.linked_tag_id IS NOT NULL THEN
          SELECT site_id INTO v_other_site_id
            FROM blog_tags WHERE id = NEW.linked_tag_id;
          IF v_other_site_id IS DISTINCT FROM NEW.site_id THEN
            RAISE EXCEPTION 'cross-site link forbidden'
              USING ERRCODE = 'P0001', HINT = 'cross_site_link_forbidden';
          END IF;
        END IF;
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- 5. Re-create trigger only on newsletter_types
CREATE TRIGGER trg_sync_newsletter_tag_link
  AFTER INSERT OR UPDATE OF linked_tag_id
  ON public.newsletter_types
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tag_newsletter_link();

COMMIT;
