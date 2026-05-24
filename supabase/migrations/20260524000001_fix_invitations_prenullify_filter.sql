CREATE OR REPLACE FUNCTION "public"."lgpd_phase3_prenullify_fks"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.authors SET user_id = NULL WHERE user_id = p_user_id;
  UPDATE public.blog_posts SET owner_user_id = NULL WHERE owner_user_id = p_user_id;
  UPDATE public.campaigns SET owner_user_id = NULL WHERE owner_user_id = p_user_id;
  UPDATE public.audit_log SET actor_user_id = NULL WHERE actor_user_id = p_user_id;
  UPDATE public.invitations SET invited_by = NULL WHERE invited_by = p_user_id;
  UPDATE public.invitations SET accepted_by_user_id = NULL WHERE accepted_by_user_id = p_user_id;
END $$;
