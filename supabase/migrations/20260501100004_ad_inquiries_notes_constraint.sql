-- Add length constraint on admin_notes to prevent unbounded text storage
alter table ad_inquiries
  add constraint ad_inquiries_admin_notes_length
  check (admin_notes is null or length(admin_notes) <= 5000);
