-- Consolidated GRANTs from 20260416* migrations.
-- Moved here because Supabase CLI 2.90 parser conflates CREATE FUNCTION
-- with trailing GRANT statements in the same file.

-- from 20260416000001_invitations.sql

-- from 20260416000004_newsletter_subscriptions.sql

-- from 20260416000005_unsubscribe_tokens.sql

-- from 20260416000008_epic2_review_fixes.sql

-- from 20260416000009_epic2_hardening.sql

-- from 20260416000011_user_exists_rpc.sql

-- from 20260416000012_forgot_password_rate_limit.sql

-- from 20260416000013_resend_cooldown.sql

-- from 20260416000014_contact_rate_limit_and_cron_locks.sql

-- from 20260416000016_update_campaign_atomic.sql

do $grants$ begin
  execute $stmt$grant execute on function public.get_invitation_by_token(text) to anon, authenticated$stmt$;
  execute $stmt$grant execute on function public.accept_invitation_atomic(text, uuid) to authenticated$stmt$;
  execute $stmt$grant execute on function public.confirm_newsletter_subscription(text) to anon, authenticated$stmt$;
  execute $stmt$grant execute on function public.unsubscribe_via_token(text) to anon, authenticated$stmt$;
  execute $stmt$grant execute on function public.accept_invitation_atomic(text) to authenticated$stmt$;
  execute $stmt$grant execute on function public.confirm_newsletter_subscription(text) to anon, authenticated$stmt$;
  execute $stmt$grant execute on function public.unsubscribe_via_token(text) to anon, authenticated$stmt$;
  execute $stmt$grant execute on function public.confirm_newsletter_subscription(text) to anon, authenticated$stmt$;
  execute $stmt$grant execute on function public.accept_invitation_atomic(text) to authenticated$stmt$;
  execute $stmt$grant execute on function public.get_invitation_by_token(text) to anon, authenticated$stmt$;
  execute $stmt$grant execute on function public.user_exists_by_email(text) to service_role$stmt$;
  execute $stmt$grant execute on function public.increment_invitation_resend(uuid) to service_role$stmt$;
  execute $stmt$grant execute on function public.record_password_reset_attempt(text, text) to service_role$stmt$;
  execute $stmt$grant execute on function public.increment_invitation_resend(uuid) to service_role$stmt$;
  execute $stmt$grant execute on function public.confirm_newsletter_subscription(text) to anon, authenticated$stmt$;
  execute $stmt$grant execute on function public.unsubscribe_via_token(text) to anon, authenticated$stmt$;
  execute $stmt$grant execute on function public.contact_rate_check(uuid, text, text) to anon, authenticated, service_role$stmt$;
  execute $stmt$grant execute on function public.newsletter_rate_check(uuid, text, text) to anon, authenticated, service_role$stmt$;
  execute $stmt$grant execute on function public.cron_try_lock(text) to service_role$stmt$;
  execute $stmt$grant execute on function public.cron_unlock(text) to service_role$stmt$;
  execute $stmt$grant execute on function public.update_campaign_atomic(uuid, jsonb, jsonb) to authenticated$stmt$;
end $grants$;
