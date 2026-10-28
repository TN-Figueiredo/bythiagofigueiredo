-- Manutenção M3b: o fileId real do B2 tem 16 hex depois de `_f` (ex.: 4_z…_f1003c83b5487736b_d…), e a regra de 3 hex
-- recusava o canário (canario_ok falso → controle_falhou no conferir-b2 de 28/10 11:07) e todo
-- arquivo presente (file_id_invalido). Mesmo conserto do kit da forja (b2.py, commit 1709851): `_f[0-9a-f]+_`.
-- Só as duas funções que validam o fileId mudam; o corpo é o da 20261025000002 com a regra trocada.

create or replace function public.obs_archive_b2_run_gate(p_site uuid, p_run uuid, p_item jsonb)
returns text language plpgsql security definer set search_path = '' as $$
-- Aplica um informe de controle (negativo ou canário) e devolve a resposta; para arquivo comum, devolve 'seguir' ou o motivo da recusa.
declare v_run public.obs_archive_b2_runs; v_id text := p_item->>'arquivo_id'; v_filho text; v_can public.obs_archive_canaries;
begin
  select * into v_run from public.obs_archive_b2_runs where id = p_run and site_id = p_site for update;
  if not found then return 'desconhecido'; end if;
  if v_run.expires_at < public.obs_archive_agora() then return 'execucao_vencida'; end if;
  if v_id = 'controle_negativo' then
    if p_item->>'resultado' = 'ausente' then
      update public.obs_archive_b2_runs set negative_ok = true where id = p_run;
    elsif p_item->>'resultado' in ('sem_acesso', 'chave_ausente') then
      return 'aceito';                       -- sem acesso o negativo fica pendente e nada atesta; não é "o controle falhou" (Phil I3)
    else
      update public.obs_archive_b2_runs set negative_ok = false, estado = 'controle_falhou' where id = p_run;
    end if;
  elsif v_id in ('canario:numerico', 'canario:texto') then
    v_filho := split_part(v_id, ':', 2);
    select * into v_can from public.obs_archive_canaries c
     where c.site_id = p_site and c.filho = v_filho and c.dia = (v_run.canary_days->>v_filho)::date;
    if found and p_item->>'resultado' = 'presente' and p_item->>'sha256' = v_can.sha256
       and coalesce(p_item->>'file_id', '') ~ '^4_z[0-9a-f]{24}_f[0-9a-f]+_[0-9a-z_]+$' then
      update public.obs_archive_b2_runs set canary_ok = canary_ok || jsonb_build_object(v_filho, true) where id = p_run;
      update public.obs_archive_canaries set b2_ok_at = now(), b2_file_id = p_item->>'file_id' where site_id = p_site and filho = v_filho and dia = v_can.dia;
    else
      update public.obs_archive_b2_runs set canary_ok = canary_ok || jsonb_build_object(v_filho, false), estado = 'controle_falhou' where id = p_run;
      update public.obs_archive_canaries set b2_failed_at = now() where site_id = p_site and filho = v_filho and dia = v_can.dia;
    end if;
  else
    if v_run.estado = 'controle_falhou' then return 'controle_falhou'; end if;
    v_filho := public.obs_archive_filho_do_arquivo(p_site, v_id);       -- pela classe do registro; nulo = desconhecido
    if v_filho is null then return 'desconhecido'; end if;
    -- o arquivo só passa depois do negativo ausente E do canário do mesmo filho (C2; Phil I3)
    if not coalesce(v_run.negative_ok, false) or not coalesce((v_run.canary_ok->>v_filho)::boolean, false) then
      return 'controle_pendente';
    end if;
    return 'seguir';
  end if;
  update public.obs_archive_b2_runs set estado = 'controle_ok'
   where id = p_run and estado = 'aguardando_controle' and negative_ok
     and coalesce((canary_ok->>'numerico')::boolean, false) and coalesce((canary_ok->>'texto')::boolean, false);
  return 'aceito';
end $$;
revoke all on function public.obs_archive_b2_run_gate(uuid, uuid, jsonb) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_attest_b2(p_site uuid, p_body jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_agora timestamptz := public.obs_archive_agora();
  v_run uuid; r public.obs_archive_b2_runs; it jsonb; v_id text; v_res text; v_gate text; v_out jsonb := '[]'::jsonb; v_mot text; v_resp text;
  i record; b public.obs_archive_b2_files; v_fid text; v_ts bigint; v_igual boolean; v_novo jsonb; v_tocados jsonb := '{}'::jsonb; v_k text; v_t text; v_ult text := 'ok'; v_n integer := 0; v_tent integer;
  v_lin bigint; v_soma numeric; v_sha text;
begin
  if p_body is null or p_body->>'fonte' is distinct from 'b2' or coalesce(p_body->>'execucao_id', '') !~ '^[0-9a-f-]{36}$' then raise exception 'forma' using errcode = 'P0001'; end if;
  v_run := (p_body->>'execucao_id')::uuid;
  for it in select * from jsonb_array_elements(coalesce(p_body->'itens', '[]'::jsonb)) loop
    v_id := it->>'arquivo_id'; v_res := it->>'resultado'; v_resp := 'aceito'; v_mot := null; v_n := v_n + 1;
    v_fid := it->>'file_id'; v_ts := (it->>'upload_timestamp')::bigint; v_tent := coalesce((it->>'tentativa')::int, 1);
    v_sha := it->>'sha256'; v_lin := (it->>'linhas')::bigint; v_soma := (it->>'soma')::numeric;
    if v_res is null or v_res not in ('presente', 'ausente', 'sem_acesso', 'chave_ausente', 'nao_decifra') then
      v_out := v_out || jsonb_build_array(jsonb_build_object('arquivo_id', v_id, 'resposta', 'recusado', 'motivo', 'forma')); continue;
    end if;
    v_gate := public.obs_archive_b2_run_gate(p_site, v_run, it);
    if v_gate <> 'seguir' then
      if v_gate = 'aceito' then v_out := v_out || jsonb_build_array(jsonb_build_object('arquivo_id', v_id, 'resposta', 'aceito'));
      else v_out := v_out || jsonb_build_array(jsonb_build_object('arquivo_id', v_id, 'resposta', 'recusado', 'motivo', v_gate)); end if;
      continue;
    end if;
    select * into i from public.obs_archive_b2_file_info(p_site, v_id) limit 1;
    if not found then v_out := v_out || jsonb_build_array(jsonb_build_object('arquivo_id', v_id, 'resposta', 'recusado', 'motivo', 'desconhecido')); continue; end if;
    insert into public.obs_archive_b2_files (site_id, arquivo_id, class, month) values (p_site, v_id, i.class, i.month) on conflict (site_id, arquivo_id) do nothing;
    select * into b from public.obs_archive_b2_files x where x.site_id = p_site and x.arquivo_id = v_id for update;
    if v_res in ('presente', 'nao_decifra') and (v_fid is null or v_ts is null) then
      v_resp := 'recusado'; v_mot := 'sem_file_id'; v_res := 'sem_acesso';
      update public.obs_archive_b2_runs set file_id_recusado = true where id = v_run;
    elsif v_res in ('presente', 'nao_decifra') and v_fid !~ '^4_z[0-9a-f]{24}_f[0-9a-f]+_[0-9a-z_]+$' then
      v_resp := 'recusado'; v_mot := 'file_id_invalido'; v_res := 'sem_acesso';
      update public.obs_archive_b2_runs set file_id_recusado = true where id = v_run;
    elsif v_res = 'presente' and (v_sha is null or i.exp_sha is null) then
      -- Phil M2: nulo contra nulo não é "igual". Informe presente sem sha256 é forma errada; arquivo sem sha256 esperado não se atesta
      v_resp := 'recusado'; v_mot := case when i.exp_sha is null then 'desconhecido' else 'forma' end; v_res := 'sem_acesso';
    end if;

    if v_res = 'nao_decifra' then
      -- K4: divergente já no primeiro informe, sem repetir; o file_id nunca vira o "bom"
      perform public.obs_archive_b2_retirar(p_site, v_id, 'divergente', 'forja');
      update public.obs_archive_b2_files set ilegivel_at = v_agora, last_attempt_run = v_run where site_id = p_site and arquivo_id = v_id;
      v_ult := 'divergente';
    elsif v_res = 'presente' then
      -- compara com o registro: unidade com linhas e soma; parte e resumo com linhas; manifesto só o sha256
      v_igual := v_sha is not distinct from i.exp_sha and (v_lin is null or i.exp_rows is null or v_lin = i.exp_rows)
                 and (not i.cmp_soma or v_soma is not distinct from i.exp_soma);
      if v_igual then
        update public.obs_archive_b2_files
           set last_ok_at = v_agora, last_ok_via = 'forja', last_ok_file_id = v_fid, last_ok_upload_ts = v_ts, last_attempt_at = v_agora, last_attempt_result = 'ok',
               last_attempt_run = v_run, pending_mismatch = null, pending_since = null, pending_run = null
         where site_id = p_site and arquivo_id = v_id;
        v_ult := 'ok';
      else
        v_novo := jsonb_build_object('sha256', v_sha, 'linhas', v_lin, 'soma', v_soma::text);
        if b.pending_mismatch is null then
          update public.obs_archive_b2_files set pending_mismatch = v_novo, pending_since = v_agora, pending_run = v_run, last_attempt_at = v_agora,
                 last_attempt_result = 'divergencia_a_confirmar', last_attempt_run = v_run where site_id = p_site and arquivo_id = v_id;
          v_resp := 'repetir'; v_ult := 'divergencia_a_confirmar';
        elsif b.pending_mismatch = v_novo or b.pending_since < v_agora - interval '48 hours' then
          perform public.obs_archive_b2_retirar(p_site, v_id, 'divergente', 'forja');
          update public.obs_archive_b2_files set last_attempt_run = v_run where site_id = p_site and arquivo_id = v_id;
          v_ult := 'divergente';
        else
          update public.obs_archive_b2_files set pending_mismatch = null, pending_since = null, pending_run = null, last_attempt_at = v_agora,
                 last_attempt_result = 'sem_acesso', last_attempt_run = v_run where site_id = p_site and arquivo_id = v_id;
          v_ult := 'sem_acesso';
        end if;
      end if;
    elsif v_res = 'ausente' then
      if i.received_at is not null and i.received_at < v_agora - interval '48 hours' then
        perform public.obs_archive_b2_retirar(p_site, v_id, 'arquivo_ausente', 'forja');
        update public.obs_archive_b2_files set last_attempt_run = v_run where site_id = p_site and arquivo_id = v_id;
        v_ult := 'arquivo_ausente';
      else
        update public.obs_archive_b2_files set last_attempt_at = v_agora, last_attempt_result = 'aguardando_b2', last_attempt_run = v_run where site_id = p_site and arquivo_id = v_id;
        v_ult := 'aguardando_b2';
      end if;
    else   -- sem_acesso e chave_ausente: a tentativa fica registrada, nada retira
      update public.obs_archive_b2_files set last_attempt_at = v_agora, last_attempt_result = v_res, last_attempt_run = v_run where site_id = p_site and arquivo_id = v_id;
      v_ult := v_res;
    end if;
    v_tocados := v_tocados || jsonb_build_object(i.class || '|' || i.month::text, v_ult);
    v_out := v_out || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('arquivo_id', v_id, 'resposta', v_resp, 'motivo', v_mot)));
  end loop;
  for v_k in select jsonb_object_keys(v_tocados) loop
    perform public.obs_archive_b2_recompute_month(p_site, split_part(v_k, '|', 1), split_part(v_k, '|', 2)::date, 'forja', v_tocados->>v_k);
  end loop;
  update public.obs_archive_b2_runs set files_reported = files_reported + v_n where id = v_run and site_id = p_site;
  select * into r from public.obs_archive_b2_runs where id = v_run and site_id = p_site;
  if found and r.modo = 'completo' then perform public.obs_archive_b2_aceitar_paginas(p_site, v_run); end if;
  select * into r from public.obs_archive_b2_runs where id = v_run and site_id = p_site;
  return jsonb_build_object('execucao', jsonb_build_object('estado', coalesce(r.estado, 'aguardando_controle'), 'negativo_ok', coalesce(r.negative_ok, false),
           'canario_ok', jsonb_build_object('numerico', coalesce((r.canary_ok->>'numerico')::boolean, false), 'texto', coalesce((r.canary_ok->>'texto')::boolean, false))),
         'itens', v_out);
end $$;
revoke all on function public.obs_archive_attest_b2(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_attest_b2(uuid, jsonb) to service_role;
