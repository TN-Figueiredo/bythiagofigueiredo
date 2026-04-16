-- Sprint 4.75: drop legacy increment_invitation_resend (Sprint 3 variant
-- returned boolean). Recreate with v3 signature in 20260420000015. Split
-- into two files because Supabase CLI 2.90 fails when DROP + CREATE-with-$$
-- appear in the same migration (multi-statement + dollar-quoted block =
-- prepared-statement splitter bug).
DROP FUNCTION IF EXISTS public.increment_invitation_resend(uuid);
