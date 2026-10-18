set lock_timeout = '5s';

-- 1) rotate_cycle sai (sem chamador; SECURITY DEFINER sem guarda; emenda 38)
drop function if exists public.rotate_cycle(uuid, uuid, integer, jsonb);

-- 2) Reivindicação dos sete caminhos de 3.1 (D1 do plano). Uma transação: estado, restore_status, fecho do ciclo.
create or replace function public.ab_settle_claim(
  p_test_id uuid,
  p_seq int,
  p_de text[],
  p_para text,
  p_end_reason text,
  p_restore_status jsonb,
  p_extra jsonb default '{}'::jsonb
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

revoke execute on function public.ab_settle_claim(uuid, int, text[], text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ab_settle_claim(uuid, int, text[], text, text, jsonb, jsonb) to service_role;

-- 3) Fecho da rotação (emenda 38; + p_views/p_likes e zera consecutive_failures: D2 do plano).
--    F-D7: o número do ciclo é calculado AQUI, dentro do lock (max + 1); o do chamador só escolhe a variante (ABBA).
--    F-P4: coalesce(p_views, c.views): sem poll novo, não sobrescreve com nulo.
create or replace function public.ab_rotate_commit(
  p_test_id uuid,
  p_seq int,
  p_variant_id uuid,
  p_cycle_number int,
  p_applied_metadata jsonb,
  p_views int default null,
  p_likes int default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text; v_seq int; v_now timestamptz := now(); v_novo uuid; v_num int;
begin
  select t.status, t.restore_seq into v_status, v_seq from public.ab_tests t where t.id = p_test_id for update;
  if not found or v_status <> 'active' or v_seq <> p_seq then return null; end if;

  -- Phil T1 R1 (PODE): retry idempotente. O ciclo aberto carrega a marca _rotate = seq da chamada que o abriu; o mesmo seq
  -- de novo (qualquer p_cycle_number) devolve esse ciclo em vez de fechar e abrir outro. Rotação seguinte legítima reivindica
  -- seq maior (restore_seq + 1), então não casa.
  select c.id into v_novo from public.ab_test_cycles c
   where c.test_id = p_test_id and c.ended_at is null and c.variant_id = p_variant_id
     and c.applied_metadata -> '_rotate' = to_jsonb(p_seq)
   order by c.cycle_number desc limit 1;
  if v_novo is not null then return v_novo; end if;

  select coalesce(max(c.cycle_number), -1) + 1 into v_num from public.ab_test_cycles c where c.test_id = p_test_id;

  update public.ab_test_cycles c set ended_at = v_now, end_reason = 'rotacao',
         views = coalesce(p_views, c.views), likes = coalesce(p_likes, c.likes)
   where c.test_id = p_test_id and c.ended_at is null;

  insert into public.ab_test_cycles (test_id, variant_id, cycle_number, started_at, applied_metadata)
  values (p_test_id, p_variant_id, v_num, v_now,
          coalesce(p_applied_metadata, '{}'::jsonb) || jsonb_build_object('_rotate', p_seq))
  returning id into v_novo;

  update public.ab_tests t set last_applied_variant_id = null, updated_at = v_now,
    status_note = case when t.status_note like 'nova tentativa %' or t.status_note like 'cota do YouTube esgotada%' or t.status_note like 'retry %' or t.status_note like 'auto-paused%' then null else t.status_note end,
    config = case when coalesce((t.config ->> 'consecutive_failures')::int, 0) <> 0
                  then jsonb_set(t.config, '{consecutive_failures}', '0'::jsonb) else t.config end
   where t.id = p_test_id;

  return v_novo;
end $$;

revoke execute on function public.ab_rotate_commit(uuid, int, uuid, int, jsonb, int, int) from public, anon, authenticated;
grant execute on function public.ab_rotate_commit(uuid, int, uuid, int, jsonb, int, int) to service_role;

-- 4) Fecho de retomar e ciclo 0 do início, numa transação (D12; Phil F-D5 = Yannis Y-D4).
--    Retomar: p_de = 'paused'. Início: p_de = 'active' (o teste já foi reivindicado pelo código).
--    Nulo = outro escritor ganhou entre a escrita no YouTube e este fecho: nenhum ciclo é aberto.
create or replace function public.ab_resume_commit(
  p_test_id uuid,
  p_seq int,
  p_de text,
  p_variant_id uuid,
  p_applied_metadata jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text; v_seq int; v_now timestamptz := now(); v_novo uuid; v_num int; v_paused_at timestamptz;
begin
  select t.status, t.restore_seq, t.paused_at into v_status, v_seq, v_paused_at from public.ab_tests t where t.id = p_test_id for update;
  if not found or v_status <> p_de or v_seq <> p_seq then return null; end if;

  select coalesce(max(c.cycle_number), -1) + 1 into v_num from public.ab_test_cycles c where c.test_id = p_test_id;

  update public.ab_tests t set
    status = 'active', paused_at = null, drift_acknowledged_at = null, status_note = null,
    restore_status = '{}'::jsonb, updated_at = v_now,
    config = case when coalesce((t.config ->> 'consecutive_failures')::int, 0) <> 0
                  then jsonb_set(t.config, '{consecutive_failures}', '0'::jsonb) else t.config end
   where t.id = p_test_id;

  -- R1 (conferência v2): fecha ciclo aberto deixado pelo código antigo; sem isto, o índice único diário
  -- (test_id, utc_date(started_at)) where ended_at is null lança duplicate key depois de o YouTube ser escrito.
  -- Phil T1 R1 (DEVE 1): o ciclo antigo termina na hora da pausa (paused_at lido antes do update), não em now():
  -- o tempo parado não é da variante. Para p_de = 'active' paused_at é nulo e fica now().
  update public.ab_test_cycles c
     set ended_at = greatest(c.started_at, least(v_now, coalesce(v_paused_at, v_now))),
         end_reason = coalesce(c.end_reason, case when v_paused_at is not null then 'pausa' end)
   where c.test_id = p_test_id and c.ended_at is null;

  insert into public.ab_test_cycles (test_id, variant_id, cycle_number, started_at, applied_metadata)
  values (p_test_id, p_variant_id, v_num, v_now, p_applied_metadata)
  returning id into v_novo;

  return v_novo;
end $$;

revoke execute on function public.ab_resume_commit(uuid, int, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ab_resume_commit(uuid, int, text, uuid, jsonb) to service_role;

-- 5) Gatilho do histórico (D13; F-B2 = Y-D3): retomar que falha regrava o valor anterior, e a mesma restauração
--    não ganha segunda linha. Corpo inteiro da Migration 0 (20261014000005) + a guarda marcada "P4a".
create or replace function public.tg_ab_tests_restore_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  v jsonb;
begin
  foreach k in array array['title', 'thumbnail'] loop
    v := new.restore_status -> k;
    continue when v is null or v ->> 'estado' = 'em_andamento';
    continue when (old.restore_status -> k) is not distinct from v;
    -- P4a (32 i): retomar que falha regrava o valor anterior; a mesma restauração não ganha segunda linha.
    continue when exists (
      select 1 from public.ab_test_restores r
       where r.test_id = new.id and r.campo = k and r.seq < new.restore_seq
         and r.estado = v ->> 'estado' and r.destino = v ->> 'destino'
         and r.em = (v ->> 'em')::timestamptz and r.attempts = (v ->> 'attempts')::integer);
    insert into public.ab_test_restores (test_id, seq, campo, destino, estado, escreveu, forcado, motivo, erro, attempts, em)
    values (
      new.id, new.restore_seq, k, v ->> 'destino', v ->> 'estado', (v ->> 'escreveu')::boolean,
      (v ->> 'forcado')::boolean, v ->> 'motivo', v ->> 'erro', (v ->> 'attempts')::integer, (v ->> 'em')::timestamptz
    )
    on conflict (test_id, seq, campo) do update set
      destino = excluded.destino, estado = excluded.estado, escreveu = excluded.escreveu, forcado = excluded.forcado,
      motivo = excluded.motivo, erro = excluded.erro, attempts = excluded.attempts, em = excluded.em, gravado_em = now();
  end loop;
  return new;
end;
$$;

revoke all on function public.tg_ab_tests_restore_log() from public, anon, authenticated;

comment on table public.ab_test_restores is
  'A/B Lab, P4: uma linha por campo e por reivindicação (restore_seq) com o resultado final da restauração. Escrito só pelo gatilho tg_ab_tests_restore_log; se a mesma reivindicação regravar o resultado de um campo (não deveria: o passo 4 grava uma vez), a última escrita vence e gravado_em muda. Regravação do valor anterior por uma reivindicação nova (retomar que falha) NÃO gera linha (guarda da P4a). Reivindicação nova (restore_seq + 1) com resultado novo = linha nova; nada é apagado senão pela cascata. Some com o teste (cascata, inclusive na remoção do canal).';

comment on function public.ab_settle_claim(uuid, int, text[], text, text, jsonb, jsonb) is
  'A/B Lab P4a: reivindica um teste para settleOnAir (estado, restore_seq+1, restore_status em_andamento, fecho do ciclo com end_reason) numa transação. Zero linhas = outro escritor ganhou.';
comment on function public.ab_rotate_commit(uuid, int, uuid, int, jsonb, int, int) is
  'A/B Lab P4a: fecho da rotação depois da escrita no YouTube; só age com status active e restore_seq igual ao reivindicado; o número do ciclo é max+1 calculado no lock; nulo = reivindicação perdida.';
comment on function public.ab_resume_commit(uuid, int, text, uuid, jsonb) is
  'A/B Lab P4a: fecho de retomar (p_de paused) e ciclo 0 do início (p_de active) numa transação; restore_status {}, zera falhas; nulo = reivindicação perdida, nenhum ciclo aberto.';

reset lock_timeout;
