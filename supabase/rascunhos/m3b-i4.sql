-- RASCUNHO M3b-I4 (r1, 28/10). NÃO é migration: sai por `npm run db:new m3b_i4_unidade_presa` depois do verde.
-- Troca só o ramo "versão em andamento com parte já recebida" de obs_archive_record_core. O resto é a definição da 000002 (a única vigente).
-- (1) parte_mudou / mudou_durante_a_leitura + parte já recebida -> versão seguinte (o else): regravar na mesma versão colidiria com a
--     parte 1 que já está no NAS (o copiador nunca sobrescreve o final) e daria um divergente falso (Yannis I1).
-- (2) redo_reason nulo + recebimento parcial cujas partes batem com o payload -> 'mesma' SEM apagar nada (Phil I1); se não batem, nao_devida (M16).
-- (3) partes_invalidas vale para toda gravação de unidade, inclusive a primeira (Yannis M1 = Phil m1).
create or replace function public.obs_archive_record_core(p_site uuid, p_kind text, p_payload jsonb, p_origem text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_class text := p_payload->>'classe'; v_table text := p_payload->>'tabela';
  v_channel uuid := (p_payload->>'canal')::uuid; v_month date := (p_payload->>'mes')::date;
  v_dec text; v_pol record; v_last record; v_id uuid; v_ver int; v_empty boolean; v_novo_par boolean;
begin
  -- payload sem canal ou sem mês: hashtextextended(null) daria trava nula e o status sairia canal_removido (Yannis 11)
  if v_channel is null or v_month is null then raise exception 'payload_invalido' using errcode = 'P0001'; end if;
  -- duas gravações da versão 1 ao mesmo tempo: o for update sem linha não trava nada (Phil M6)
  perform pg_advisory_xact_lock(hashtextextended(p_site::text || '|' || p_kind || '|' || coalesce(v_class, '') || '|' || coalesce(v_table, '')
                                                 || '|' || v_channel::text || '|' || v_month::text, 0));
  -- a marca é gravada em toda chamada, antes de qualquer insert (P56): vazia fora do expurgo
  perform set_config('obs_archive.origem', case when p_origem = 'expurgo' then 'expurgo:' || pg_current_xact_id()::text else '' end, true);
  perform 1 from public.competitor_channels c where c.id = v_channel and c.site_id = p_site for key share;
  if not found then
    select r.archive_decision into v_dec from public.obs_archive_channel_removals r
     where r.site_id = p_site and r.channel_ref = v_channel::text for share;
    if p_origem = 'expurgo' and v_dec = 'guardar' then null;            -- a única exceção (02 §10.5)
    elsif p_origem = 'expurgo' and v_dec is null then return jsonb_build_object('status', 'sem_destino');
    else return jsonb_build_object('status', 'canal_removido');
    end if;
  end if;
  if p_kind = 'unidade' then
    -- Dado ausente (falha em verde): partes > 1 sem o mesmo número de itens em parts deixaria a unidade sem nunca fechar; partes = 1 manda parts vazio.
    if jsonb_array_length(coalesce(p_payload->'parts', '[]'::jsonb))
       <> (coalesce((p_payload->>'partes')::smallint, 1) > 1)::int * coalesce((p_payload->>'partes')::smallint, 1) then
      raise exception 'partes_invalidas' using errcode = 'P0001';
    end if;
    select * into v_pol from public.obs_archive_policy() p where p.class = v_class and p.table_name = v_table;
    if not found then raise exception 'classe_tabela_invalida' using errcode = 'P0001'; end if;
    if p_origem is distinct from 'expurgo' and public.obs_archive_due_on(v_month, v_pol.seal_margin_days) > public.obs_archive_hoje_sp() then
      return jsonb_build_object('status', 'mes_aberto');
    end if;
    -- mês destacado ou descartado nunca se reexporta a partir do online (02 l.352, l.578; Phil C3)
    if p_origem is distinct from 'expurgo' and exists (select 1 from public.obs_archive_months m
         where m.site_id = p_site and m.class = v_class and m.table_name = v_table and m.month = v_month
           and (m.detached_at is not null or m.dropped_at is not null)) then
      return jsonb_build_object('status', 'mes_fora_do_banco');
    end if;
    -- a rota não grava o que o plano não pediria (Yannis M17)
    if p_origem is distinct from 'expurgo' and not public.obs_archive_unit_due(p_site, v_class, v_table, v_channel, v_month) then
      return jsonb_build_object('status', 'nao_devida');
    end if;
    select * into v_last from public.obs_archive_units u
     where u.site_id = p_site and u.class = v_class and u.table_name = v_table and u.channel_ref = v_channel::text and u.month = v_month
     order by u.version desc limit 1 for update;
    v_novo_par := not found;
    if found and v_last.dropped_at is not null and p_origem is distinct from 'expurgo' then return jsonb_build_object('status', 'unidade_retirada'); end if;
    -- reaproveita a versão nunca recebida também quando ela só foi marcada parte_mudou ou mudou_durante_a_leitura (Phil M3)
    if found and v_last.hash_conteudo = p_payload->>'hash_conteudo' and v_last.received_at is null
       and (v_last.redo_reason is null or v_last.redo_reason in ('parte_mudou', 'mudou_durante_a_leitura'))
       and v_last.superseded_at is null and p_origem is distinct from 'expurgo'
       and not (coalesce(v_last.redo_reason in ('parte_mudou', 'mudou_durante_a_leitura'), false)
                and exists (select 1 from public.obs_archive_unit_parts x where x.unit_id = v_last.id and x.received_at is not null)) then
      -- versão em andamento com parte já recebida: não reescreve as partes (Yannis M16). Aqui só sobra redo_reason nulo (com marca, o if acima cai na v+1).
      if exists (select 1 from public.obs_archive_unit_parts x where x.unit_id = v_last.id and x.received_at is not null) then
        -- recebimento parcial (lote de recibos do copiador partido): as partes recebidas batem com o novo export -> 'mesma' sem apagar nada;
        -- a rota devolve a parte 1 (o copiador acha o final e reinforma) e part_info libera só as que faltam (Phil I1). Se não batem, nao_devida.
        if jsonb_array_length(coalesce(p_payload->'parts', '[]'::jsonb)) = v_last.parts
           and not exists (select 1 from public.obs_archive_unit_parts x
                            left join jsonb_array_elements(coalesce(p_payload->'parts', '[]'::jsonb)) j on (j->>'parte')::smallint = x.part
                           where x.unit_id = v_last.id and x.received_at is not null
                             and (j is null or x.sha256_bytes is distinct from j->>'sha256_bytes' or x.row_count is distinct from (j->>'row_count')::bigint)) then
          return jsonb_build_object('status', 'mesma', 'arquivo_id', 'u:' || v_last.id, 'versao', v_last.version);
        end if;
        return jsonb_build_object('status', 'nao_devida', 'arquivo_id', 'u:' || v_last.id, 'versao', v_last.version);
      end if;
      update public.obs_archive_units set sha256_bytes = nullif(p_payload->>'sha256_bytes', ''), csv_sha256 = nullif(p_payload->>'csv_sha256', ''),
             file_bytes = (p_payload->>'file_bytes')::bigint, parts = coalesce((p_payload->>'partes')::smallint, 1), min_key = p_payload->>'min_key', max_key = p_payload->>'max_key',
             redo_reason = null
       where id = v_last.id;
      delete from public.obs_archive_unit_parts where unit_id = v_last.id;
      v_id := v_last.id; v_ver := v_last.version;
    elsif found and v_last.hash_conteudo = p_payload->>'hash_conteudo' and v_last.received_at is not null and v_last.redo_reason is null
          and v_last.superseded_at is null and p_origem is distinct from 'expurgo' then
      return jsonb_build_object('status', 'nao_devida', 'arquivo_id', 'u:' || v_last.id, 'versao', v_last.version);
    else
      v_ver := coalesce(v_last.version, 0) + 1;
      -- par novo: trava as linhas do mês (units -> months, a ordem do receive) ANTES de gravar a unidade. Sem isto, a selagem que confirma entre
      -- o insert e o teste de sealed_at abaixo sela sem o par novo e o reabrir (unidade_nova) se perde (Yannis 5). For update, não for share:
      -- dois pares novos ao mesmo tempo num mês selado se enfileiram em vez de travar um no outro ao subir para o update do reabrir.
      if v_novo_par then
        perform 1 from public.obs_archive_months m where m.site_id = p_site and m.class = v_class and m.month = v_month order by m.table_name for update;
      end if;
      v_empty := (p_payload->>'row_count')::bigint = 0;
      insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, control_sum, hash_conteudo, schema_fp,
             sha256_bytes, csv_sha256, file_bytes, parts, min_key, max_key, origem, received_at, received_row_count, received_control_sum)
      values (p_site, v_class, v_table, v_channel::text, v_month, v_ver, (p_payload->>'row_count')::bigint, (p_payload->>'control_sum')::numeric,
              p_payload->>'hash_conteudo', p_payload->>'schema_fp', nullif(p_payload->>'sha256_bytes', ''), nullif(p_payload->>'csv_sha256', ''),
              (p_payload->>'file_bytes')::bigint, coalesce((p_payload->>'partes')::smallint, 1), p_payload->>'min_key', p_payload->>'max_key',
              case when p_origem = 'expurgo' then 'expurgo' else 'rota' end,
              case when v_empty then now() end, case when v_empty then 0 end, case when v_empty then (p_payload->>'control_sum')::numeric end)
      returning id into v_id;
    end if;
    insert into public.obs_archive_unit_parts (unit_id, part, sha256_bytes, csv_sha256, file_bytes, row_count, control_sum, row_offset, min_key, max_key)
    select v_id, (x->>'parte')::smallint, x->>'sha256_bytes', x->>'csv_sha256', (x->>'file_bytes')::bigint, (x->>'row_count')::bigint,
           (x->>'control_sum')::numeric, (x->>'row_offset')::bigint, x->>'min_key', x->>'max_key'
      from jsonb_array_elements(coalesce(p_payload->'parts', '[]'::jsonb)) x;
    insert into public.obs_archive_months (site_id, class, table_name, month) values (p_site, v_class, v_table, v_month) on conflict do nothing;
    -- par novo num mês já selado reabre o selo (Phil C1)
    if v_novo_par and exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = v_class and m.month = v_month and m.sealed_at is not null) then
      update public.obs_archive_months set unsealed_at = now(), unsealed_reason = 'unidade_nova'
       where site_id = p_site and class = v_class and month = v_month;
    end if;
    return jsonb_build_object('status', case when v_id = v_last.id then 'mesma' else 'nova' end, 'arquivo_id', 'u:' || v_id, 'versao', v_ver);
  elsif p_kind = 'resumo' then
    if not exists (select 1 from public.obs_archive_policy() p where p.class = v_class) then raise exception 'classe_tabela_invalida' using errcode = 'P0001'; end if;
    -- o resumo de um mês fora do banco não se refaz do online (02 l.578)
    if exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = v_class and m.month = v_month and (m.detached_at is not null or m.dropped_at is not null)) then
      return jsonb_build_object('status', 'ja_no_arquivo');
    end if;
    select * into v_last from public.obs_archive_summaries s
     where s.site_id = p_site and s.class = v_class and s.channel_ref = v_channel::text and s.month = v_month
     order by s.version desc limit 1 for update;
    if found and v_last.unit_hashes = p_payload->'unit_hashes' and v_last.superseded_at is null and v_last.nas_withdrawn_at is null then
      if v_last.received_at is not null then return jsonb_build_object('status', 'nao_devida', 'arquivo_id', 's:' || v_last.id, 'versao', v_last.version); end if;
      update public.obs_archive_summaries set canal_sha256 = p_payload->>'canal_sha256', canal_bytes = (p_payload->>'canal_bytes')::bigint,
             canal_rows = (p_payload->>'canal_rows')::int, video_sha256 = p_payload->>'video_sha256', video_bytes = (p_payload->>'video_bytes')::bigint,
             video_rows = (p_payload->>'video_rows')::int, received_papers = '{}'
       where id = v_last.id;
      return jsonb_build_object('status', 'mesma', 'arquivo_id', 's:' || v_last.id, 'versao', v_last.version);
    end if;
    v_ver := coalesce(v_last.version, 0) + 1;
    v_empty := (p_payload->>'vazio')::boolean;
    insert into public.obs_archive_summaries (site_id, class, channel_ref, month, version, empty, canal_sha256, canal_bytes, canal_rows,
           video_sha256, video_bytes, video_rows, unit_hashes, received_at)
    values (p_site, v_class, v_channel::text, v_month, v_ver, v_empty, p_payload->>'canal_sha256', (p_payload->>'canal_bytes')::bigint,
            (p_payload->>'canal_rows')::int, p_payload->>'video_sha256', (p_payload->>'video_bytes')::bigint, (p_payload->>'video_rows')::int,
            p_payload->'unit_hashes', case when v_empty then now() end)
    returning id into v_id;
    return jsonb_build_object('status', 'nova', 'arquivo_id', 's:' || v_id, 'versao', v_ver);
  end if;
  raise exception 'tipo_invalido' using errcode = 'P0001';
end $$;
revoke all on function public.obs_archive_record_core(uuid, text, jsonb, text) from public, anon, authenticated, service_role;
