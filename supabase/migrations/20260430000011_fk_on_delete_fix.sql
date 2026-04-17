DO $fk_precheck$
DECLARE v_orphan_owner integer; v_orphan_actor integer;
BEGIN
  SELECT count(*) INTO v_orphan_owner FROM blog_posts bp
  WHERE owner_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = bp.owner_user_id);
  IF v_orphan_owner > 0 THEN
    RAISE EXCEPTION 'Pre-check failed: % blog_posts have orphan owner_user_id', v_orphan_owner;
  END IF;

  SELECT count(*) INTO v_orphan_actor FROM audit_log al
  WHERE actor_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = al.actor_user_id);
  IF v_orphan_actor > 0 THEN
    RAISE NOTICE 'Warning: % audit_log rows have orphan actor_user_id', v_orphan_actor;
  END IF;
END $fk_precheck$;

ALTER TABLE blog_posts DROP CONSTRAINT IF EXISTS blog_posts_owner_user_id_fkey;
ALTER TABLE blog_posts ADD CONSTRAINT blog_posts_owner_user_id_fkey
  FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_owner_user_id_fkey;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_owner_user_id_fkey
  FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_user_id_fkey;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_actor_user_id_fkey
  FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
