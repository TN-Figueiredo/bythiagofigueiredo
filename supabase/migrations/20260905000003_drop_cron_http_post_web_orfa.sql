-- =============================================================================
-- Remover a funcao orfa cron_http_post_web — assinatura correta desta vez
-- =============================================================================
-- A migration 20260905000002 tentou `drop function if exists
-- public.cron_http_post_web(text)`. A funcao real e
-- cron_http_post_web(p_path text, p_timeout_ms integer) — o `if exists` nao
-- casou e engoliu em silencio (NOTICE "does not exist, skipping"). A funcao
-- ficou no banco apontando para net.http_post(), que nao existe mais desde o
-- DROP EXTENSION pg_net.
--
-- Nao ha dependentes (pg_depend deptype='n' = 0) nem chamadores no codigo;
-- a unica referencia e o tipo gerado em apps/web/src/types/database.types.ts,
-- que se atualiza no proximo `supabase gen types`.
--
-- Licao registrada: `drop function if exists` com assinatura errada e falha
-- silenciosa. Sempre confirmar com pg_get_function_identity_arguments antes.
-- =============================================================================

drop function if exists public.cron_http_post_web(text, integer);

-- Guard: se a assinatura mudar de novo no futuro, falhar alto em vez de engolir.
do $check$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cron_http_post_web'
  ) then
    raise exception 'cron_http_post_web ainda existe com outra assinatura — ajuste esta migration';
  end if;
end
$check$;
