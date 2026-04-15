-- Consolidated GRANTs from 20260416* migrations — final state only.
-- Wrapped in a DO block because Supabase CLI 2.90 parser conflates
-- sequential GRANT statements; DO is always parsed as one statement.
--
-- Only signatures that exist in the final schema (post-000017) are granted.
-- Stale entries like accept_invitation_atomic(text, uuid) are omitted —
-- 000008 dropped that overload and replaced it with the 1-arg version.

do $grants$ begin
  execute $stmt$grant execute on function public.get_invitation_by_token(text) to anon, authenticated$stmt$;
  execute $stmt$grant execute on function public.accept_invitation_atomic(text) to authenticated$stmt$;
  execute $stmt$grant execute on function public.confirm_newsletter_subscription(text) to anon, authenticated$stmt$;
  execute $stmt$grant execute on function public.unsubscribe_via_token(text) to anon, authenticated$stmt$;
  execute $stmt$grant execute on function public.user_exists_by_email(text) to service_role$stmt$;
  execute $stmt$grant execute on function public.increment_invitation_resend(uuid) to service_role$stmt$;
  execute $stmt$grant execute on function public.record_password_reset_attempt(text, text) to service_role$stmt$;
  execute $stmt$grant execute on function public.contact_rate_check(uuid, text, text) to anon, authenticated, service_role$stmt$;
  execute $stmt$grant execute on function public.newsletter_rate_check(uuid, text, text) to anon, authenticated, service_role$stmt$;
  execute $stmt$grant execute on function public.cron_try_lock(text) to service_role$stmt$;
  execute $stmt$grant execute on function public.cron_unlock(text) to service_role$stmt$;
  execute $stmt$grant execute on function public.update_campaign_atomic(uuid, jsonb, jsonb) to authenticated$stmt$;
end $grants$;
