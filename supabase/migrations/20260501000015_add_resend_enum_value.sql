-- supabase:disable-transaction

-- Add 'resend' to email_provider enum
ALTER TYPE public.email_provider ADD VALUE IF NOT EXISTS 'resend';
