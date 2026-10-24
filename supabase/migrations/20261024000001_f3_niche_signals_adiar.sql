-- =============================================================================
-- MIGRATION: f3_niche_signals_adiar
-- F3b "Adiar 7 dias": `adiado_ate`, `adiado_por`, `adiado_em`, `adiado_vezes`, `niche_signals_adiar` (mesmo lock de `niche_signals_dispensar`) e
-- `niche_signals_sincronizar_sino` recriada: um sinal adiado (adiado_ate no futuro) não conta como aberto no sino.
-- Aditivo e idempotente. Rollback: supabase/rascunhos/f3b-rollback.sql (transação única).
-- O status continua `aberto` (índice único e gravador intactos); "adiado" é `adiado_ate > now()`.
-- =============================================================================
set lock_timeout = '5s';

alter table public.niche_signals add column if not exists adiado_ate timestamptz;
alter table public.niche_signals add column if not exists adiado_por text;
-- Quando foi adiada pela última vez e quantas vezes (a tela mostra "Adiada por você em"; não se deduz de adiado_ate - 7 d).
alter table public.niche_signals add column if not exists adiado_em timestamptz;
alter table public.niche_signals add column if not exists adiado_vezes integer not null default 0;

-- Devolve {ok:false, motivo} em: nao_encontrado, nao_aberto (inclui vencida), ja_adiado (com adiado_ate),
-- expira_antes (vence em até 7 dias: não adia; com expira_em). Sucesso: {ok:true, adiado_ate}.
create or replace function public.niche_signals_adiar(p_site uuid, p_id uuid, p_por text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  s public.niche_signals;
  c_dias constant interval := interval '7 days'; -- = DIAS_DO_ADIAR (frases.ts); o único 7 deste SQL
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('niche_signals:' || p_site::text, 0));
  select * into s from public.niche_signals where id = p_id and site_id = p_site for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado'); end if;
  if s.status <> 'aberto' or s.expires_at <= now() then return jsonb_build_object('ok', false, 'motivo', 'nao_aberto'); end if;
  if s.adiado_ate is not null and s.adiado_ate > now() then
    return jsonb_build_object('ok', false, 'motivo', 'ja_adiado', 'adiado_ate', s.adiado_ate);
  end if;
  if s.expires_at <= now() + c_dias then
    return jsonb_build_object('ok', false, 'motivo', 'expira_antes', 'expira_em', s.expires_at);
  end if;
  update public.niche_signals
     set adiado_ate = now() + c_dias, adiado_por = p_por, adiado_em = now(), adiado_vezes = adiado_vezes + 1
   where id = p_id;
  perform public.niche_signals_sincronizar_sino(p_site);
  return jsonb_build_object('ok', true, 'adiado_ate', now() + c_dias);
end $$;

-- Igual à F2 (20261022000003), com "aberto" = status aberto e não adiado.
create or replace function public.niche_signals_sincronizar_sino(p_site uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.notifications n set expired_at = now()
   where n.site_id = p_site and n.domain = 'youtube' and n.type = 'youtube.niche_signal'
     and n.expired_at is null and n.dedup_key like 'nicho:%'
     and not exists (select 1 from public.niche_signals s
                      where s.site_id = p_site and 'nicho:' || s.id::text = n.dedup_key and s.status = 'aberto'
                        and (s.adiado_ate is null or s.adiado_ate <= now()));
  update public.notifications n set expired_at = now()
   where n.site_id = p_site and n.domain = 'youtube' and n.type = 'youtube.niche_signal'
     and n.expired_at is null and n.dedup_key like 'nicho-resumo:%'
     and not exists (select 1 from jsonb_array_elements_text(coalesce(n.payload -> 'ids', '[]'::jsonb)) i(id)
                      join public.niche_signals s on s.id::text = i.id and s.site_id = p_site and s.status = 'aberto'
                       and (s.adiado_ate is null or s.adiado_ate <= now()));
end $$;

revoke all on function public.niche_signals_sincronizar_sino(uuid) from public, anon, authenticated;
revoke all on function public.niche_signals_adiar(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.niche_signals_sincronizar_sino(uuid) to service_role;
grant execute on function public.niche_signals_adiar(uuid, uuid, text) to service_role;

reset lock_timeout;
