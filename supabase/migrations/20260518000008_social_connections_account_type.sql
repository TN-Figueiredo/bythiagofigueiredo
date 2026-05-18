-- Add account_type to social_connections for business vs personal detection

ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'business'
    CHECK (account_type IN ('business', 'personal'));

COMMENT ON COLUMN public.social_connections.account_type IS 'Set during OAuth based on instagram_business_account field presence.';
