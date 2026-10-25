-- =============================================================================
-- MIGRATION:
-- =============================================================================

-- ab_test_v2_gravar (A/B Lab S8-F4, T6): escrita atômica de result_metadata.v2. Merge um nível abaixo, campos congelados
-- gravados uma vez (n JSON null nunca congela), historico anexado em SQL e idempotente. Só service_role executa.
create or replace function public.ab_test_v2_gravar(
  p_test_id uuid, p_v2 jsonb, p_hist jsonb default null, p_so_se_sem_n boolean default false)
returns smallint language plpgsql security definer set search_path = '' as $$
declare
  -- imutáveis: entram uma vez e nunca mudam
  c constant text[] := array['n','k','p1','p1_motivo','p1_dias','p1_impressoes','base_estimada',
                             'p1_dias_sem_meta','desfecho_no_encerramento','encerrado_em_dia'];
  v_regra text;
  v_atual jsonb;
begin
  -- trava a linha: dois escritores se serializam e o segundo reavalia o v2 já gravado
  select t.regra_duracao, coalesce(t.result_metadata->'v2','{}'::jsonb)
    into v_regra, v_atual
    from public.ab_tests t where t.id = p_test_id for update;
  if not found or v_regra is distinct from 'v2' then
    return -1;                                   -- inexistente ou não é v2
  end if;
  if p_so_se_sem_n and v_atual ? 'n' and jsonb_typeof(v_atual->'n') <> 'null' then
    return 0;                                    -- outro escritor já congelou
  end if;
  update public.ab_tests t set result_metadata = jsonb_set(
    coalesce(t.result_metadata,'{}'::jsonb), '{v2}',
    v_atual
    || (p_v2 - c - 'historico')                  -- congelados e historico nunca vêm direto de p_v2
    || coalesce((select jsonb_object_agg(f.k, p_v2->f.k) from unnest(c) as f(k)
                 where p_v2 ? f.k and jsonb_typeof(p_v2->f.k) <> 'null'
                   and not (v_atual ? f.k and jsonb_typeof(v_atual->f.k) <> 'null')), '{}'::jsonb)
    || case when p_hist is null
                 or (v_atual->'historico'->-1->>'desfecho') is not distinct from (p_hist->0->>'desfecho')
            then '{}'::jsonb
            else jsonb_build_object('historico',
                   coalesce(v_atual->'historico','[]'::jsonb) || p_hist) end,
    true)
  where t.id = p_test_id;
  return 1;                                      -- gravou
end $$;
revoke all on function public.ab_test_v2_gravar(uuid, jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.ab_test_v2_gravar(uuid, jsonb, jsonb, boolean) to service_role;
