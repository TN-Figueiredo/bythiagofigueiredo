-- P3 do Phil: ab_settle_claim confere a letra do desfecho (p_vencedor_esperado opcional, no fim).
-- Nulo = comportamento de sempre. Não nulo = só reivindica se result_metadata.v2.vencedor_sugerido ainda for esse id.
-- Mesmo tipo de retorno: recusa = zero linhas, como o CAS de restore_seq. Implantar ANTES do código que passa o parâmetro.
set lock_timeout = '5s';

drop function if exists public.ab_settle_claim(uuid, int, text[], text, text, jsonb, jsonb);
drop function if exists public.ab_settle_claim(uuid, int, text[], text, text, jsonb, jsonb, uuid);

create function public.ab_settle_claim(
  p_test_id uuid,
  p_seq int,
  p_de text[],
  p_para text,
  p_end_reason text,
  p_restore_status jsonb,
  p_extra jsonb default '{}'::jsonb,
  p_vencedor_esperado uuid default null
) returns table (claimed_seq int, stamped_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_seq int;
  v_status_antes text;
  v_paused_at timestamptz;
begin
  select t.status, t.paused_at into v_status_antes, v_paused_at from public.ab_tests t where t.id = p_test_id for update;
  if not found then return; end if;

  -- P3 do Phil: a letra que o humano viu tem de ser a que está gravada agora (ab_test_v2_gravar troca a letra sem mexer em restore_seq).
  if p_vencedor_esperado is not null and not exists (
    select 1 from public.ab_tests t where t.id = p_test_id and t.result_metadata -> 'v2' ->> 'vencedor_sugerido' = p_vencedor_esperado::text
  ) then return; end if;

  update public.ab_tests t set
    status = p_para,
    restore_seq = t.restore_seq + 1,
    restore_status = p_restore_status,
    last_applied_variant_id = null,
    updated_at = v_now,
    paused_at = case when p_para = 'paused' and v_status_antes <> 'paused' then v_now else t.paused_at end,
    completed_at = case when p_para = 'completed' and v_status_antes <> 'completed' then v_now else t.completed_at end,
    status_note = case when p_extra ? 'status_note' then p_extra ->> 'status_note' else t.status_note end,
    completed_reason = case when p_extra ? 'completed_reason' then p_extra ->> 'completed_reason' else t.completed_reason end,
    winner_variant_id = case when p_extra ? 'winner_variant_id' then (p_extra ->> 'winner_variant_id')::uuid else t.winner_variant_id end,
    confidence_at_completion = case when (p_extra ->> 'limpar_confianca')::boolean then null else t.confidence_at_completion end,
    drift_acknowledged_at = case when (p_extra ->> 'limpar_drift_ack')::boolean then null else t.drift_acknowledged_at end,
    grace_expires_at = case when (p_extra ->> 'limpar_carencia')::boolean then null else t.grace_expires_at end,
    config = case when p_extra ? 'consecutive_failures'
                  then jsonb_set(coalesce(t.config, '{}'::jsonb), '{consecutive_failures}', p_extra -> 'consecutive_failures')
                  else t.config end
  where t.id = p_test_id and t.status = any (p_de) and t.restore_seq = p_seq
  returning t.restore_seq into v_seq;

  if v_seq is null then return; end if;

  if p_end_reason is not null then
    -- Teste pausado: o ciclo aberto fecha na hora da pausa (mesma expressão do ab_resume_commit), não em now().
    update public.ab_test_cycles c
       set ended_at = greatest(c.started_at, least(v_now, case when v_status_antes = 'paused' then coalesce(v_paused_at, v_now) else v_now end)),
           end_reason = p_end_reason
     where c.test_id = p_test_id and c.ended_at is null;
  end if;

  claimed_seq := v_seq; stamped_at := v_now;
  return next;
end $$;

revoke execute on function public.ab_settle_claim(uuid, int, text[], text, text, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.ab_settle_claim(uuid, int, text[], text, text, jsonb, jsonb, uuid) to service_role;

comment on function public.ab_settle_claim(uuid, int, text[], text, text, jsonb, jsonb, uuid) is
  'A/B Lab P4a: reivindica um teste para settleOnAir (estado, restore_seq+1, restore_status em_andamento, fecho do ciclo com end_reason) numa transação. Zero linhas = outro escritor ganhou. P3: p_vencedor_esperado não nulo exige result_metadata.v2.vencedor_sugerido igual.';

reset lock_timeout;
