-- Rollback da F3b (migration 20261024000001_f3_niche_signals_adiar). Transação única; os adiados voltam ao N na hora.
-- Depois: npx supabase migration repair --status reverted 20261024000001
begin;
set local lock_timeout = '5s';
create or replace function public.niche_signals_sincronizar_sino(p_site uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.notifications n set expired_at = now()
   where n.site_id = p_site and n.domain = 'youtube' and n.type = 'youtube.niche_signal'
     and n.expired_at is null and n.dedup_key like 'nicho:%'
     and not exists (select 1 from public.niche_signals s
                      where s.site_id = p_site and 'nicho:' || s.id::text = n.dedup_key and s.status = 'aberto');
  update public.notifications n set expired_at = now()
   where n.site_id = p_site and n.domain = 'youtube' and n.type = 'youtube.niche_signal'
     and n.expired_at is null and n.dedup_key like 'nicho-resumo:%'
     and not exists (select 1 from jsonb_array_elements_text(coalesce(n.payload -> 'ids', '[]'::jsonb)) i(id)
                      join public.niche_signals s on s.id::text = i.id and s.site_id = p_site and s.status = 'aberto');
end $$;
revoke all on function public.niche_signals_sincronizar_sino(uuid) from public, anon, authenticated;
grant execute on function public.niche_signals_sincronizar_sino(uuid) to service_role;
drop function if exists public.niche_signals_adiar(uuid, uuid, text);
alter table public.niche_signals drop column if exists adiado_ate, drop column if exists adiado_por;
commit;
