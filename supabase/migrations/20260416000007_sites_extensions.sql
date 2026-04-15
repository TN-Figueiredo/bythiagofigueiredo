alter table public.sites
  add column brevo_newsletter_list_id int,
  add column contact_notification_email citext;

comment on column public.sites.brevo_newsletter_list_id is
  'Per-site Brevo list ID for newsletter sync. NULL = newsletter not configured for this site.';
comment on column public.sites.contact_notification_email is
  'Per-site email for contact form admin alerts. NULL = fallback to first owner of org.';
