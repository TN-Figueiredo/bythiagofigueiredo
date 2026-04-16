-- Sprint 4.75: set_audit_context helper RPC — middleware / server actions
-- call this at the start of every authenticated request to inject IP + UA
-- into the DB session context. The audit trigger (next migration) reads
-- these GUCs when inserting audit_log rows.

CREATE OR REPLACE FUNCTION public.set_audit_context(p_ip text, p_user_agent text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    set_config('app.client_ip', COALESCE(p_ip, ''), true),
    set_config('app.user_agent', COALESCE(p_user_agent, ''), true);
  SELECT;
$$;

GRANT EXECUTE ON FUNCTION public.set_audit_context(text, text) TO authenticated, anon;
