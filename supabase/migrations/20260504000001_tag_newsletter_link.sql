-- Bidirectional 1:1 link between blog_tags and newsletter_types with color sync.
-- Each tag can link to at most one newsletter type and vice-versa.

-- 1. Add FK columns (idempotent)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'blog_tags' AND column_name = 'linked_newsletter_type_id'
  ) THEN
    ALTER TABLE public.blog_tags ADD COLUMN linked_newsletter_type_id text
      REFERENCES public.newsletter_types(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'newsletter_types' AND column_name = 'linked_tag_id'
  ) THEN
    ALTER TABLE public.newsletter_types ADD COLUMN linked_tag_id uuid
      REFERENCES public.blog_tags(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Unique partial indexes (1:1 enforcement — at most one link per side)

DROP INDEX IF EXISTS blog_tags_linked_nl_unique;
CREATE UNIQUE INDEX blog_tags_linked_nl_unique
  ON public.blog_tags(linked_newsletter_type_id)
  WHERE linked_newsletter_type_id IS NOT NULL;

DROP INDEX IF EXISTS newsletter_types_linked_tag_unique;
CREATE UNIQUE INDEX newsletter_types_linked_tag_unique
  ON public.newsletter_types(linked_tag_id)
  WHERE linked_tag_id IS NOT NULL;

-- 3. Sync trigger function (handles both tables via TG_TABLE_NAME)

CREATE OR REPLACE FUNCTION public.sync_tag_newsletter_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other_site_id uuid;
BEGIN
  -- Recursion guard: skip if we're already inside a cross-table update
  IF current_setting('app.skip_link_sync', true) = '1' THEN
    RETURN NEW;
  END IF;

  SET LOCAL app.skip_link_sync = '1';

  -- ── blog_tags side ──
  IF TG_TABLE_NAME = 'blog_tags' THEN

    -- Link changed?
    IF TG_OP = 'INSERT' THEN
      IF NEW.linked_newsletter_type_id IS NOT NULL THEN
        -- Cross-site validation
        SELECT site_id INTO v_other_site_id
          FROM newsletter_types WHERE id = NEW.linked_newsletter_type_id;
        IF v_other_site_id IS DISTINCT FROM NEW.site_id THEN
          RAISE EXCEPTION 'cross-site link forbidden'
            USING ERRCODE = 'P0001', HINT = 'cross_site_link_forbidden';
        END IF;

        UPDATE newsletter_types
          SET linked_tag_id = NEW.id, color = NEW.color, color_dark = NEW.color_dark
          WHERE id = NEW.linked_newsletter_type_id;
      END IF;

    ELSIF TG_OP = 'UPDATE' THEN
      -- linked_newsletter_type_id changed
      IF OLD.linked_newsletter_type_id IS DISTINCT FROM NEW.linked_newsletter_type_id THEN

        -- Clear old counterpart
        IF OLD.linked_newsletter_type_id IS NOT NULL THEN
          UPDATE newsletter_types SET linked_tag_id = NULL
            WHERE id = OLD.linked_newsletter_type_id;
        END IF;

        -- Set new counterpart
        IF NEW.linked_newsletter_type_id IS NOT NULL THEN
          SELECT site_id INTO v_other_site_id
            FROM newsletter_types WHERE id = NEW.linked_newsletter_type_id;
          IF v_other_site_id IS DISTINCT FROM NEW.site_id THEN
            RAISE EXCEPTION 'cross-site link forbidden'
              USING ERRCODE = 'P0001', HINT = 'cross_site_link_forbidden';
          END IF;

          UPDATE newsletter_types
            SET linked_tag_id = NEW.id, color = NEW.color, color_dark = NEW.color_dark
            WHERE id = NEW.linked_newsletter_type_id;
        END IF;

      -- Color changed while linked (no FK change)
      ELSIF NEW.linked_newsletter_type_id IS NOT NULL
        AND (OLD.color IS DISTINCT FROM NEW.color OR OLD.color_dark IS DISTINCT FROM NEW.color_dark)
      THEN
        UPDATE newsletter_types
          SET color = NEW.color, color_dark = NEW.color_dark
          WHERE id = NEW.linked_newsletter_type_id;
      END IF;
    END IF;

  -- ── newsletter_types side ──
  ELSIF TG_TABLE_NAME = 'newsletter_types' THEN

    IF TG_OP = 'INSERT' THEN
      IF NEW.linked_tag_id IS NOT NULL THEN
        SELECT site_id INTO v_other_site_id
          FROM blog_tags WHERE id = NEW.linked_tag_id;
        IF v_other_site_id IS DISTINCT FROM NEW.site_id THEN
          RAISE EXCEPTION 'cross-site link forbidden'
            USING ERRCODE = 'P0001', HINT = 'cross_site_link_forbidden';
        END IF;

        UPDATE blog_tags
          SET linked_newsletter_type_id = NEW.id, color = NEW.color, color_dark = NEW.color_dark
          WHERE id = NEW.linked_tag_id;
      END IF;

    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.linked_tag_id IS DISTINCT FROM NEW.linked_tag_id THEN

        IF OLD.linked_tag_id IS NOT NULL THEN
          UPDATE blog_tags SET linked_newsletter_type_id = NULL
            WHERE id = OLD.linked_tag_id;
        END IF;

        IF NEW.linked_tag_id IS NOT NULL THEN
          SELECT site_id INTO v_other_site_id
            FROM blog_tags WHERE id = NEW.linked_tag_id;
          IF v_other_site_id IS DISTINCT FROM NEW.site_id THEN
            RAISE EXCEPTION 'cross-site link forbidden'
              USING ERRCODE = 'P0001', HINT = 'cross_site_link_forbidden';
          END IF;

          UPDATE blog_tags
            SET linked_newsletter_type_id = NEW.id, color = NEW.color, color_dark = NEW.color_dark
            WHERE id = NEW.linked_tag_id;
        END IF;

      ELSIF NEW.linked_tag_id IS NOT NULL
        AND (OLD.color IS DISTINCT FROM NEW.color OR OLD.color_dark IS DISTINCT FROM NEW.color_dark)
      THEN
        UPDATE blog_tags
          SET color = NEW.color, color_dark = NEW.color_dark
          WHERE id = NEW.linked_tag_id;
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- 4. Triggers (column-specific, idempotent)

DROP TRIGGER IF EXISTS trg_sync_tag_newsletter_link ON public.blog_tags;
CREATE TRIGGER trg_sync_tag_newsletter_link
  AFTER INSERT OR UPDATE OF linked_newsletter_type_id, color, color_dark
  ON public.blog_tags
  FOR EACH ROW EXECUTE FUNCTION sync_tag_newsletter_link();

DROP TRIGGER IF EXISTS trg_sync_newsletter_tag_link ON public.newsletter_types;
CREATE TRIGGER trg_sync_newsletter_tag_link
  AFTER INSERT OR UPDATE OF linked_tag_id, color, color_dark
  ON public.newsletter_types
  FOR EACH ROW EXECUTE FUNCTION sync_tag_newsletter_link();
