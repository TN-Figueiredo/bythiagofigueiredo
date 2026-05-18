-- =============================================================================
-- MIGRATION: Fix missing UPDATE RLS policy on link_in_bio_entries
--            and add bulk position shift RPC to replace N+1 loop
-- =============================================================================

-- Fix A: Add missing UPDATE policy for link_in_bio_entries
DROP POLICY IF EXISTS link_in_bio_entries_update ON public.link_in_bio_entries;
CREATE POLICY link_in_bio_entries_update ON public.link_in_bio_entries
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Fix B: Bulk position-shift RPC (replaces N+1 loop in addLinkinBioEntry)
CREATE OR REPLACE FUNCTION public.shift_link_in_bio_positions(
  p_site_id uuid,
  p_min_position int DEFAULT 0
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE link_in_bio_entries
  SET position = position + 1
  WHERE site_id = p_site_id
    AND position >= p_min_position;
$$;
