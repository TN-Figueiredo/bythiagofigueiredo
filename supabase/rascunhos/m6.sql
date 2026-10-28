-- Manutenção M6: a saída do mês. RASCUNHO (TRAVA M6-1): fora de supabase/migrations até a Tarefa 14 do plano
-- docs/superpowers/plans/2026-10-14-manutencao-nas-m6-saida.md. Depende de M2 (obs_part, partições) e M3b (registro).
-- M6 PARTE 1: o hash sobre uma relação (a partição anexada ou a tabela destacada)
-- obs-archive-hash-rel.sql: início
-- Tabela-mãe (p_rel nulo), partição anexada ou tabela destacada (_saida): o mesmo from_where da M3b, trocando só a relação (M6, decisão 5).
create or replace function public.obs_archive_unit_source_rel(p_class text, p_table text, p_rel regclass)
returns table (rel regclass, from_where text, order_by text, control_expr text)
language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
declare
  s record;
  v_modo text;
  v_de text;
begin
  select * into s from public.obs_archive_unit_source(p_class, p_table);
  if p_rel is null then
    rel := s.rel; from_where := s.from_where; order_by := s.order_by; control_expr := s.control_expr;
    return next; return;
  end if;
  select p.exit_mode into v_modo from public.obs_archive_policy() p where p.class = p_class and p.table_name = p_table;
  if v_modo is distinct from 'particao' then raise exception 'relacao_so_em_particao' using errcode = 'P0001', detail = p_class || '/' || p_table; end if;
  if not exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
                  where c.oid = p_rel and n.nspname = 'obs_part' and c.relname::text ~ ('^' || p_table || '_[0-9]{6}(_saida)?$')) then
    raise exception 'relacao_invalida' using errcode = 'P0001', detail = p_rel::text;
  end if;
  v_de := 'from public.' || pg_catalog.quote_ident(p_table) || ' t ';
  rel := p_rel; order_by := s.order_by; control_expr := s.control_expr;
  from_where := pg_catalog.replace(s.from_where, v_de, 'from ' || p_rel::text || ' t ');
  if from_where = s.from_where then raise exception 'fonte_sem_tabela' using errcode = 'P0001', detail = p_table; end if;
  return next;
end $$;

-- Os três valores de obs_archive_content_hash, lidos de p_rel (sem paginação). Mesma serialização de obs_archive_read_unit.
create or replace function public.obs_archive_content_hash_rel(p_site uuid, p_class text, p_table text, p_rel regclass, p_channel uuid, p_month date)
returns table (row_count bigint, control_sum text, hash_conteudo text)
language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
declare
  s record; v_cols text;
  v_ini timestamptz := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := (((p_month + interval '1 month')::date)::text || ' 00:00:00-03')::timestamptz;
begin
  if p_month <> date_trunc('month', p_month)::date then raise exception 'mes_invalido' using errcode = 'P0001'; end if;
  if p_rel is not null and p_rel::text !~ ('_' || pg_catalog.to_char(p_month, 'YYYYMM') || '(_saida)?$') then
    raise exception 'relacao_invalida' using errcode = 'P0001', detail = p_rel::text || ' não é a relação de ' || p_month::text;   -- m-13
  end if;
  select * into s from public.obs_archive_unit_source_rel(p_class, p_table, p_rel);
  select string_agg('t.' || pg_catalog.quote_ident(a.attname) || '::text', ', ' order by a.attnum) into v_cols
    from pg_catalog.pg_attribute a
   where a.attrelid = (select x.rel from public.obs_archive_unit_source(p_class, p_table) x) and a.attnum > 0 and not a.attisdropped;
  return query execute format(
    'with u as (select to_jsonb(array[%1$s]::text[]) as r, %2$s as c, row_number() over (order by %3$s) as n %4$s)
     select (select count(*) from u)::bigint,
            (coalesce((select sum(u.c) from u), $7::numeric))::text,
            (select encode(sha256(convert_to(coalesce(string_agg(u.r::text, E''\n'' order by u.n), ''''), ''UTF8'')), ''hex'') from u)',
    v_cols, s.control_expr, s.order_by, s.from_where)
  using p_site, p_channel, p_month, v_ini, v_fim, (p_month + interval '1 month')::date,
        case when s.control_expr = 'null::numeric' then null::numeric else 0::numeric end;
end $$;

-- C-1/I1: o resumo da LINHA INTEIRA do canal no mês, sobre as mesmas linhas do from_where do hash. A conferência o guarda; o tally o compara sob a trava
-- (o hash caro roda antes da trava; contagem e soma sozinhas não pegam uma coluna que não é a de controle).
create or replace function public.obs_archive_row_digest_rel(p_site uuid, p_class text, p_table text, p_rel regclass, p_channel uuid, p_month date)
returns numeric
language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
declare
  s record; v numeric;
  v_ini timestamptz := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := (((p_month + interval '1 month')::date)::text || ' 00:00:00-03')::timestamptz;
begin
  if p_month <> date_trunc('month', p_month)::date then raise exception 'mes_invalido' using errcode = 'P0001'; end if;
  if p_rel is not null and p_rel::text !~ ('_' || pg_catalog.to_char(p_month, 'YYYYMM') || '(_saida)?$') then
    raise exception 'relacao_invalida' using errcode = 'P0001', detail = p_rel::text;
  end if;
  select * into s from public.obs_archive_unit_source_rel(p_class, p_table, p_rel);
  execute pg_catalog.format('select coalesce(sum(pg_catalog.hashtextextended(t::text, 0)::numeric), 0) %s', s.from_where)
    into v using p_site, p_channel, p_month, v_ini, v_fim, (p_month + interval '1 month')::date;
  return v;
end $$;
revoke all on function public.obs_archive_unit_source_rel(text, text, regclass) from public, anon, authenticated, service_role;
revoke all on function public.obs_archive_content_hash_rel(uuid, text, text, regclass, uuid, date) from public, anon, authenticated, service_role;
revoke all on function public.obs_archive_row_digest_rel(uuid, text, text, regclass, uuid, date) from public, anon, authenticated, service_role;
-- obs-archive-hash-rel.sql: fim
-- M6 PARTE 2: o invariante do mês destacado
-- O invariante (02 §10.5): enquanto existir mês destacado e não descartado, de qualquer site e de qualquer tabela que sai por partição
-- (inclusive o ensaio), nada apaga vídeo nem canal de concorrente. VOLATILE: em read committed, lê retrato novo e enxerga um destaque
-- confirmado enquanto o apagamento esperava a trava.
create or replace function public.obs_archive_block_delete_while_detached()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
declare v_meses text; v_n integer; v_site uuid;
begin
  -- A recusa é global (a partição é de todos os sites, decisão 3), mas o detail lista só os meses do site do que se apaga (r1 I-4, Yannis):
  -- o dono de um site não vê tabela nem mês de outro. TRUNCATE não tem linha: lista todos (só o administrador chega lá).
  if tg_level = 'ROW' then
    if tg_table_name = 'competitor_channels' then v_site := old.site_id;
    else select ch.site_id into v_site from public.competitor_channels ch where ch.id = old.competitor_channel_id; end if;
  end if;
  select count(*), string_agg(m.table_name || ' ' || pg_catalog.to_char(m.month, 'MM/YYYY'), ', ' order by m.month, m.table_name) filter (where v_site is null or m.site_id = v_site)
    into v_n, v_meses
    from public.obs_archive_months m
   where m.detached_at is not null and m.dropped_at is null;
  if v_n > 0 then
    raise exception 'mes_destacado_em_transito' using errcode = 'P0001', detail = coalesce(v_meses, 'mes destacado em outro site');
  end if;
  if tg_level = 'ROW' then return old; end if;
  return null;
end $$;
revoke all on function public.obs_archive_block_delete_while_detached() from public, anon, authenticated, service_role;

-- Nomes com "a_": em ordem alfabética antes de obs_archive_z_destino_declarado e obs_archive_z_truncate (M3b). O teste de ordem é da M6.
drop trigger if exists obs_archive_a_mes_destacado on public.competitor_videos;
create trigger obs_archive_a_mes_destacado before delete on public.competitor_videos
  for each row execute function public.obs_archive_block_delete_while_detached();
drop trigger if exists obs_archive_a_mes_destacado_truncate on public.competitor_videos;
create trigger obs_archive_a_mes_destacado_truncate before truncate on public.competitor_videos
  for each statement execute function public.obs_archive_block_delete_while_detached();
drop trigger if exists obs_archive_a_mes_destacado on public.competitor_channels;
create trigger obs_archive_a_mes_destacado before delete on public.competitor_channels
  for each row execute function public.obs_archive_block_delete_while_detached();
drop trigger if exists obs_archive_a_mes_destacado_truncate on public.competitor_channels;
create trigger obs_archive_a_mes_destacado_truncate before truncate on public.competitor_channels
  for each statement execute function public.obs_archive_block_delete_while_detached();

-- Os quatro gatilhos, ligados ('O' ou 'A'); 'D' e 'R' contam como ausentes (MEDIDO 13/10: com 'R' o apagamento passa).
create or replace function public.obs_archive_invariante_faltam()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(e.tab || '.' || e.nome order by e.tab, e.nome) filter (where t.oid is null), '{}'::text[])
    from (values ('competitor_videos', 'obs_archive_a_mes_destacado'), ('competitor_videos', 'obs_archive_a_mes_destacado_truncate'),
                 ('competitor_channels', 'obs_archive_a_mes_destacado'), ('competitor_channels', 'obs_archive_a_mes_destacado_truncate')) e(tab, nome)
    left join pg_catalog.pg_trigger t
      on t.tgrelid = pg_catalog.to_regclass('public.' || e.tab) and t.tgname = e.nome and t.tgenabled in ('O', 'A')
     and t.tgfoid = 'public.obs_archive_block_delete_while_detached()'::pg_catalog.regprocedure
$$;
revoke all on function public.obs_archive_invariante_faltam() from public, anon, authenticated;
grant execute on function public.obs_archive_invariante_faltam() to service_role;

-- Item 89: o mês destacado é imutável no registro também (expurgo e reexportação esperam o reattach).
create or replace function public.obs_archive_unit_in_detached_month() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
begin
  if exists (select 1 from public.obs_archive_months m
              where m.site_id = new.site_id and m.class = new.class and m.table_name = new.table_name and m.month = new.month
                and m.detached_at is not null and m.dropped_at is null) then
    raise exception 'mes_destacado_em_transito' using errcode = 'P0001', detail = new.table_name || ' ' || pg_catalog.to_char(new.month, 'MM/YYYY');
  end if;
  return new;
end $$;
revoke all on function public.obs_archive_unit_in_detached_month() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_a_unidade_em_mes_destacado on public.obs_archive_units;
create trigger obs_archive_a_unidade_em_mes_destacado before insert on public.obs_archive_units
  for each row execute function public.obs_archive_unit_in_detached_month();
-- M6 PARTE 3: colunas novas, o portão e a conferência por canal
alter table public.obs_archive_prechecks add column if not exists row_digest numeric;
comment on column public.obs_archive_prechecks.row_digest is 'M6 (C-1): soma de hashtextextended(t::text, 0) das linhas do canal no mês, medida na conferência; o tally a compara sob a trava.';
alter table public.obs_archive_switch add column if not exists sims_seen integer not null default 0;
alter table public.obs_archive_switch add column if not exists last_sim_at timestamptz;
alter table public.obs_archive_switch add column if not exists refusals_b2 integer not null default 0;
alter table public.obs_archive_switch add column if not exists disarm_month date;
alter table public.obs_archive_switch add column if not exists disarm_detail jsonb;
alter table public.obs_archive_switch add column if not exists disarm_seen_at timestamptz;
alter table public.obs_archive_switch drop constraint if exists obs_archive_switch_disarm_reason_check;
alter table public.obs_archive_switch add constraint obs_archive_switch_disarm_reason_check
  check (disarm_reason is null or disarm_reason in ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '13', 'manual'));
comment on column public.obs_archive_switch.disarm_reason is 'M6: motivo do desligamento, na numeração da lista fechada de 03 §12.4 (o 12 foi retirado); manual = "Desligar" do dono.';
alter table public.obs_archive_months add column if not exists reattached_at timestamptz;
alter table public.obs_archive_months add column if not exists reattach_out_of_order boolean not null default false;
comment on column public.obs_archive_months.reattach_out_of_order is 'M6 (R27, segunda causa): o mês voltou com mês posterior da mesma tabela ainda fora; a página (M5) marca a linha e o "online desde".';

-- Decisão 13: a data de "pode sair" é UMA função (a mesma da Tarefa 4 do plano da M7, D15). `create or replace` idêntica: a que chegar segunda não muda nada.
create or replace function public.obs_archive_piso_registro() returns date
language sql immutable set search_path = '' as $$ select date '2026-10-01' $$;
revoke all on function public.obs_archive_piso_registro() from public, anon, authenticated, service_role;
create or replace function public.obs_archive_pode_sair_em(p_month date, p_window integer) returns date
language sql immutable set search_path = '' as $$
  select (greatest(date_trunc('month', p_month)::date, public.obs_archive_piso_registro()) + pg_catalog.make_interval(months => p_window + 1))::date
$$;
revoke all on function public.obs_archive_pode_sair_em(date, integer) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_exit_class(p_table text) returns text
language sql stable security definer set search_path = '' as $$
  select p.class from public.obs_archive_policy() p where p.table_name = p_table and p.exit_mode = 'particao'
$$;
revoke all on function public.obs_archive_exit_class(text) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_part_rel(p_table text, p_month date, p_saida boolean) returns regclass
language sql stable security definer set search_path = '' as $$
  select pg_catalog.to_regclass(pg_catalog.format('obs_part.%I', obs_part.nome_da_particao(p_table, p_month) || case when p_saida then '_saida' else '' end))
$$;
revoke all on function public.obs_archive_part_rel(text, date, boolean) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_month_green(p_site uuid, p_class text, p_table text, p_month date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.obs_archive_months m
    where m.site_id = p_site and m.class = p_class and m.table_name = p_table and m.month = p_month
      and m.sealed_at is not null and m.unsealed_at is null
      and m.nas_attested_at >= public.obs_archive_agora() - interval '24 hours'
      and m.b2_withdrawn_at is null
      and ((m.b2_forja_ok_at >= public.obs_archive_agora() - interval '7 days' and m.b2_forja_manifest_sha256 = m.manifest_sha256)
        or (m.b2_dono_ok_at >= public.obs_archive_agora() - interval '35 days' and m.b2_dono_manifest_sha256 = m.manifest_sha256)))
$$;
revoke all on function public.obs_archive_month_green(uuid, text, text, date) from public, anon, authenticated, service_role;

-- UMA varredura da relação, agrupada por canal: contagem, soma da coluna de controle e (C-1) o resumo da linha inteira. Linha sobrando = canal_sem_unidade;
-- faltando, soma diferente, ou (com p_resumo) resumo diferente do que a conferência guardou, ou conferência ausente = conteudo_mudou (02 §10.5, canal removido).
-- Devolve também os OUTROS sites com linha na relação (m-5), para a condição 13 sob a trava sem nova varredura.
create or replace function public.obs_archive_tally(p_site uuid, p_class text, p_table text, p_month date, p_rel regclass, p_resumo boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_l bigint := 0; v_s numeric := 0; e_l bigint; e_s numeric; v_col text; g record; v_outros uuid[] := '{}'; v_dif boolean := false;
  v_vistos text[] := '{}'; v_pc numeric;
begin
  select p.control_column into v_col from public.obs_archive_policy() p where p.class = p_class and p.table_name = p_table;
  for g in execute pg_catalog.format(
    'select ch.site_id, ch.id::text as canal, count(*) as n, coalesce(sum(t.%I::numeric), 0) as s,
            coalesce(sum(pg_catalog.hashtextextended(t::text, 0)::numeric), 0) as d
       from %s t join public.competitor_videos v on v.id = t.video_id join public.competitor_channels ch on ch.id = v.competitor_channel_id
      group by ch.site_id, ch.id', v_col, p_rel)
  loop
    if g.site_id <> p_site then v_outros := v_outros || g.site_id; continue; end if;
    continue when exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = g.canal);
    v_l := v_l + g.n; v_s := v_s + g.s; v_vistos := v_vistos || g.canal;
    if p_resumo then
      select pc.row_digest into v_pc from public.obs_archive_prechecks pc
       where pc.site_id = p_site and pc.class = p_class and pc.table_name = p_table and pc.month = p_month and pc.channel_ref = g.canal;
      if v_pc is distinct from g.d then v_dif := true; end if;
    end if;
  end loop;
  select coalesce(sum(u.row_count), 0), coalesce(sum(u.control_sum), 0) into e_l, e_s
    from public.obs_archive_current_units(p_site, p_class, p_month) u
   where u.table_name = p_table and u.lost_at is null and u.purged_at is null
     and exists (select 1 from public.competitor_channels ch where ch.id::text = u.channel_ref and ch.site_id = p_site)
     and not exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = u.channel_ref);
  if p_resumo then
    -- unidade sem conferência com resumo, ou conferência de canal que agora não tem linha mas tinha: o dado mudou (ou nunca foi conferido)
    if exists (select 1 from public.obs_archive_current_units(p_site, p_class, p_month) u
                where u.table_name = p_table and u.lost_at is null and u.purged_at is null
                  and exists (select 1 from public.competitor_channels ch where ch.id::text = u.channel_ref and ch.site_id = p_site)
                  and not exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = u.channel_ref)
                  and not exists (select 1 from public.obs_archive_prechecks pc where pc.site_id = p_site and pc.class = p_class and pc.table_name = p_table
                                     and pc.month = p_month and pc.channel_ref = u.channel_ref and pc.row_digest is not null))
       or exists (select 1 from public.obs_archive_prechecks pc where pc.site_id = p_site and pc.class = p_class and pc.table_name = p_table
                     and pc.month = p_month and pc.row_digest <> 0 and pc.channel_ref <> all (v_vistos)) then
      v_dif := true;
    end if;
  end if;
  return jsonb_build_object('linhas', v_l, 'soma', v_s, 'esperado_linhas', e_l, 'esperado_soma', e_s,
    'sites', pg_catalog.to_jsonb(coalesce((select array_agg(distinct x) from unnest(v_outros) x), '{}'::uuid[])),
    'codigo', case when v_l > e_l then 'canal_sem_unidade' when v_l < e_l or v_s <> e_s or v_dif then 'conteudo_mudou' end);
end $$;
revoke all on function public.obs_archive_tally(uuid, text, text, date, regclass, boolean) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_outros_sites_ok(p_class text, p_table text, p_month date, p_tally jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from jsonb_array_elements_text(coalesce(p_tally->'sites', '[]'::jsonb)) o(s)
                      where not public.obs_archive_month_green(o.s::uuid, p_class, p_table, p_month))
$$;
revoke all on function public.obs_archive_outros_sites_ok(text, text, date, jsonb) from public, anon, authenticated, service_role;

-- C-1: o resumo da linha inteira, o hash e o resumo de novo; os dois resumos têm de ser iguais (o dado não mudou DURANTE a conferência).
-- Com p_gravar: grava a conferência com o resumo, ou apaga a anterior se não bate (M2).
create or replace function public.obs_archive_conferir_canal(p_site uuid, p_class text, p_table text, p_rel regclass, p_channel uuid, p_month date,
                                                             p_row_count bigint, p_control_sum numeric, p_hash text, p_gravar boolean)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare d1 numeric; d2 numeric; h record; v_ok boolean;
begin
  d1 := public.obs_archive_row_digest_rel(p_site, p_class, p_table, p_rel, p_channel, p_month);
  select * into h from public.obs_archive_content_hash_rel(p_site, p_class, p_table, p_rel, p_channel, p_month);
  d2 := public.obs_archive_row_digest_rel(p_site, p_class, p_table, p_rel, p_channel, p_month);
  v_ok := h.row_count = p_row_count and h.control_sum::numeric is not distinct from p_control_sum and h.hash_conteudo = p_hash and d1 = d2;
  if p_gravar then
    if v_ok then
      insert into public.obs_archive_prechecks (site_id, class, table_name, month, channel_ref, checked_at, row_digest)
      values (p_site, p_class, p_table, p_month, p_channel::text, public.obs_archive_agora(), d2)
      on conflict (site_id, class, table_name, month, channel_ref) do update set checked_at = excluded.checked_at, row_digest = excluded.row_digest;
    else
      delete from public.obs_archive_prechecks pc where pc.site_id = p_site and pc.class = p_class and pc.table_name = p_table and pc.month = p_month and pc.channel_ref = p_channel::text;
    end if;
  end if;
  return v_ok;
end $$;
revoke all on function public.obs_archive_conferir_canal(uuid, text, text, regclass, uuid, date, bigint, numeric, text, boolean) from public, anon, authenticated, service_role;

-- O portão (02 §10.5). p_conds: os números da tabela de condições (12 é a trava, medida pela operação; 20 = R27, saída fora de ordem).
-- p_rel: a partição anexada (detach, drop, check) ou a tabela destacada (discard). Fora da simulação, conteudo_mudou dessela o mês.
create or replace function public.obs_archive_gate(p_site uuid, p_class text, p_table text, p_month date, p_by uuid, p_mode text,
                                                   p_rel regclass, p_conds integer[], p_dry_run boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare
  f jsonb := '[]'::jsonb;
  pol record; m public.obs_archive_months; sw public.obs_archive_switch; u record; h record; v_rst record;
  v_agora timestamptz := public.obs_archive_agora();
  v_hoje date := public.obs_archive_hoje_sp();
  v_mae regclass := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(p_table));
  v_join text := 'join public.competitor_videos v on v.id = t.video_id join public.competitor_channels ch on ch.id = v.competitor_channel_id';
  v_ini timestamptz := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := (((p_month + interval '1 month')::date)::text || ' 00:00:00-03')::timestamptz;
  v_lista text[]; v_sites uuid[]; v_mudou uuid[] := '{}'; v_canais text[] := '{}'; v_n bigint; v_pode date; pr record; v_tem boolean; v_pode_txt text;
begin
  select * into pol from public.obs_archive_policy() p where p.class = p_class and p.table_name = p_table;
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = p_class and x.table_name = p_table and x.month = p_month;

  if 1 = any(p_conds) and not pol.released then
    f := f || jsonb_build_array(jsonb_build_object('codigo', 'classe_nao_liberada', 'classe', p_class));
  end if;

  if 2 = any(p_conds) then
    v_pode := public.obs_archive_pode_sair_em(p_month, pol.window_months);       -- Decisão 13 (M7 D15)
    if v_hoje < v_pode then f := f || jsonb_build_array(jsonb_build_object('codigo', 'ainda_na_janela', 'pode_sair_em', v_pode)); end if;
  end if;

  if 3 = any(p_conds) then
    if m.id is null or m.sealed_at is null or m.unsealed_at is not null then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'nao_selado'));
    elsif p_rel is not null then
      execute pg_catalog.format(
        'select array_agg(distinct v.competitor_channel_id::text order by v.competitor_channel_id::text) from %s t %s
          where ch.site_id = $1 and not exists (select 1 from public.obs_archive_current_units($1, $2, $3) cu
                                                 where cu.table_name = $4 and cu.channel_ref = v.competitor_channel_id::text)', p_rel, v_join)
        into v_lista using p_site, p_class, p_month, p_table;
      if v_lista is not null then f := f || jsonb_build_array(jsonb_build_object('codigo', 'canal_sem_unidade', 'canais', pg_catalog.to_jsonb(v_lista))); end if;
    end if;
  end if;

  if 4 = any(p_conds) and p_rel is not null and m.sealed_at is not null and m.unsealed_at is null then
    for u in select cu.id, cu.channel_ref, cu.row_count, cu.control_sum, cu.hash_conteudo
               from public.obs_archive_current_units(p_site, p_class, p_month) cu
              where cu.table_name = p_table and cu.purged_at is null and cu.lost_at is null
                and exists (select 1 from public.competitor_channels ch where ch.id::text = cu.channel_ref and ch.site_id = p_site)
                and not exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = cu.channel_ref)
    loop
      continue when exists (select 1 from public.obs_archive_prechecks pc
                             where pc.site_id = p_site and pc.class = p_class and pc.table_name = p_table and pc.month = p_month
                               and pc.channel_ref = u.channel_ref and pc.row_digest is not null and pc.checked_at >= v_agora - interval '10 minutes'
                               and pc.checked_at >= m.sealed_at and pc.checked_at >= coalesce(m.detached_at, '-infinity'::timestamptz));
      -- sem conferência fresca: hash, resumo antes e depois (C-1); fora da simulação a conferência é gravada para o tally da trava comparar
      if not public.obs_archive_conferir_canal(p_site, p_class, p_table, p_rel, u.channel_ref::uuid, p_month, u.row_count, u.control_sum, u.hash_conteudo, not p_dry_run) then
        v_mudou := v_mudou || u.id; v_canais := v_canais || u.channel_ref;
      end if;
    end loop;
    if cardinality(v_mudou) > 0 then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'conteudo_mudou', 'canais', pg_catalog.to_jsonb(v_canais)));
      if not p_dry_run then
        update public.obs_archive_units set redo_reason = 'conteudo_mudou' where id = any(v_mudou);
        update public.obs_archive_months set unsealed_at = v_agora, unsealed_reason = 'conteudo_mudou'
         where site_id = p_site and class = p_class and month = p_month and sealed_at is not null and unsealed_at is null;
      end if;
    end if;
  end if;

  if 5 = any(p_conds) and (m.nas_attested_at is null or m.nas_attested_at < v_agora - interval '24 hours') then
    select array_agg(distinct cu.channel_ref order by cu.channel_ref) into v_lista
      from public.obs_archive_current_units(p_site, p_class, p_month) cu
     where cu.table_name = p_table and cu.purged_at is null and cu.lost_at is null
       and not exists (select 1 from public.obs_archive_summaries s
                        where s.site_id = p_site and s.class = p_class and s.channel_ref = cu.channel_ref and s.month = p_month
                          and s.superseded_at is null and s.purged_at is null and s.lost_at is null and s.nas_attested_at >= v_agora - interval '24 hours');
    f := f || jsonb_build_array(jsonb_build_object('codigo', 'nas_sem_atestacao',
           'horas', case when m.nas_attested_at is null then null else floor(extract(epoch from (v_agora - m.nas_attested_at)) / 3600)::int end,
           'canais_sem_resumo', coalesce(pg_catalog.to_jsonb(v_lista), '[]'::jsonb)));
  end if;

  if 6 = any(p_conds) then
    if m.b2_withdrawn_at is not null then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'b2_sem_atestacao', 'motivo', 'retirada', 'em', m.b2_withdrawn_at, 'razao', m.b2_withdrawn_reason));
    elsif not coalesce((m.b2_forja_ok_at >= v_agora - interval '7 days' and m.b2_forja_manifest_sha256 = m.manifest_sha256)
                    or (m.b2_dono_ok_at >= v_agora - interval '35 days' and m.b2_dono_manifest_sha256 = m.manifest_sha256), false) then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'b2_sem_atestacao', 'motivo', 'prazo',
             'dias_forja', case when m.b2_forja_ok_at is null then null else floor(extract(epoch from (v_agora - m.b2_forja_ok_at)) / 86400)::int end,
             'dias_dono', case when m.b2_dono_ok_at is null then null else floor(extract(epoch from (v_agora - m.b2_dono_ok_at)) / 86400)::int end));
    end if;
  end if;

  if 7 = any(p_conds) then
    select r.done_at, r.schema_fp into v_rst from public.obs_archive_restores r
     where r.site_id = p_site and r.class = p_class and r.table_name = p_table and r.units_checked > 0 and r.rows_restored > 0 and r.diff_rows = 0
     order by r.done_at desc limit 1;
    if v_rst.done_at is null or v_rst.done_at < v_agora - interval '180 days' then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'restauracao_vencida', 'classe', p_class, 'tabela', p_table, 'ultima', v_rst.done_at));
    elsif v_rst.schema_fp <> public.obs_archive_schema_fp(v_mae) then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'esquema_mudou', 'tabela', p_table));
    end if;
  end if;

  if 8 = any(p_conds) and p_class = 'horaria' and p_rel is not null then
    execute pg_catalog.format(
      'select count(*) from (select distinct t.video_id, (t.hour_slot at time zone ''America/Sao_Paulo'')::date as d from %s t %s where ch.site_id = $1) x
        where not exists (select 1 from public.competitor_hour_fold_log l where l.video_id = x.video_id and l.day = x.d)', p_rel, v_join)
      into v_n using p_site;
    if v_n > 0 then f := f || jsonb_build_array(jsonb_build_object('codigo', 'dia_nao_somado', 'pares', v_n)); end if;
  end if;

  if 9 = any(p_conds) and p_class = 'serie' then
    if pg_catalog.to_regclass('public.competitor_video_marks') is null or pg_catalog.to_regclass('public.competitor_video_mark_misses') is null then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'marcas_ausentes'));
    else
      execute 'select count(*) from public.competitor_videos v join public.competitor_channels ch on ch.id = v.competitor_channel_id
                where ch.site_id = $1
                  and greatest(v.published_at, v.live_actual_start_at) + interval ''30 days'' >= $2
                  and greatest(v.published_at, v.live_actual_start_at) + interval ''30 days'' < $3
                  and not exists (select 1 from public.competitor_video_marks k where k.video_id = v.id and k.age_days = 30)
                  and not exists (select 1 from public.competitor_video_mark_misses k where k.video_id = v.id and k.age_days = 30)'
        into v_n using p_site, v_ini, v_fim;
      if v_n > 0 then f := f || jsonb_build_array(jsonb_build_object('codigo', 'marca_pendente', 'videos', v_n)); end if;
    end if;
  end if;

  if 10 = any(p_conds) then
    select count(*) into v_n from public.competitor_removed_items i
     where i.site_id = p_site and i.archive_pending and i.kind = 'video'
       and exists (select 1 from public.obs_archive_current_units(p_site, p_class, p_month) cu
                    where cu.table_name = p_table and cu.channel_ref = i.competitor_channel_id::text and cu.purged_at is null);
    if v_n > 0 then f := f || jsonb_build_array(jsonb_build_object('codigo', 'expurgo_pendente', 'itens', v_n)); end if;
  end if;

  if 11 = any(p_conds) then
    if p_mode = 'automatico' then
      select * into sw from public.obs_archive_switch s where s.site_id = p_site and s.class = p_class;
      if p_class not in ('horaria', 'serie') or sw.armed_at is null or sw.disarmed_at is not null or sw.expires_at <= v_agora then
        f := f || jsonb_build_array(jsonb_build_object('codigo', 'interruptor_desligado'));
      end if;
    elsif p_by is null or not public.obs_archive_is_site_admin(p_site, p_by) then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'sem_direito'));
    end if;
  end if;

  if 13 = any(p_conds) and p_rel is not null then
    execute pg_catalog.format('select array_agg(distinct ch.site_id) from %s t %s where ch.site_id <> $1', p_rel, v_join) into v_sites using p_site;
    if exists (select 1 from unnest(coalesce(v_sites, '{}'::uuid[])) o(s) where not public.obs_archive_month_green(o.s, p_class, p_table, p_month)) then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'outro_site_na_particao'));
    end if;
  end if;

  if 20 = any(p_conds) then
    -- R27 + I7 (Phil): mês anterior com linha ainda online, pelo registro OU por partição anexada com linha (mesmo sem registro de mês: defeito, não "vazio")
    select array_agg(pg_catalog.to_char(x.month, 'YYYY-MM-DD') order by x.month) into v_lista from public.obs_archive_months x
     where x.site_id = p_site and x.class = p_class and x.table_name = p_table and x.month < p_month
       and coalesce(x.rows_total, 0) > 0 and x.detached_at is null and x.dropped_at is null;
    -- r1 I-2: o catálogo manda. Partição anexada com linha é dado online, diga o registro o que disser; se o registro diz que o mês saiu, o registro mente: registro_diverge.
    for pr in select pg_catalog.to_char(pg_catalog.to_date(pg_catalog.right(c.relname::text, 6), 'YYYYMM'), 'YYYY-MM-DD') as mes, c.oid::regclass as rel
                from pg_catalog.pg_inherits i join pg_catalog.pg_class c on c.oid = i.inhrelid join pg_catalog.pg_namespace n on n.oid = c.relnamespace
               where i.inhparent = v_mae and n.nspname = 'obs_part' and c.relname::text ~ ('^' || p_table || '_[0-9]{6}$')
                 and pg_catalog.to_date(pg_catalog.right(c.relname::text, 6), 'YYYYMM') < p_month loop
      execute pg_catalog.format('select exists (select 1 from %s limit 1)', pr.rel) into v_tem;
      if v_tem then
        if exists (select 1 from public.obs_archive_months x where x.site_id = p_site and x.class = p_class and x.table_name = p_table
                      and x.month = pr.mes::date and (x.detached_at is not null or x.dropped_at is not null)) then
          f := f || jsonb_build_array(jsonb_build_object('codigo', 'registro_diverge', 'mes', pr.mes));
        else
          v_lista := coalesce(v_lista, '{}'::text[]) || pr.mes;
        end if;
      end if;
    end loop;
    if v_lista is not null then
      select min(z) into v_pode_txt from unnest(v_lista) z;
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'saida_fora_de_ordem', 'antes', v_pode_txt));
    end if;
  end if;

  return f;
end $$;
revoke all on function public.obs_archive_gate(uuid, text, text, date, uuid, text, regclass, integer[], boolean) from public, anon, authenticated, service_role;

-- A conferência por canal (CP13): uma chamada por canal, cada uma bem abaixo dos 8 s; vale 10 minutos para a condição 4 (e o resumo da linha inteira dela
-- é o que a trava compara). Com p_only_stale, só os canais sem conferência de menos de 8 minutos (a ação e a tarefa passam true; Phil M5).
create or replace function public.obs_archive_precheck_channels(p_site uuid, p_table text, p_month date, p_only_stale boolean default false) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(cu.channel_ref order by cu.channel_ref), '{}'::text[])
    from public.obs_archive_current_units(p_site, public.obs_archive_exit_class(p_table), p_month) cu
   where cu.table_name = p_table and cu.purged_at is null and cu.lost_at is null
     and exists (select 1 from public.competitor_channels ch where ch.id::text = cu.channel_ref and ch.site_id = p_site)
     and not exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = cu.channel_ref)
     and (not p_only_stale or not exists (
           select 1 from public.obs_archive_prechecks pc
            where pc.site_id = p_site and pc.class = public.obs_archive_exit_class(p_table) and pc.table_name = p_table and pc.month = p_month
              and pc.channel_ref = cu.channel_ref and pc.row_digest is not null and pc.checked_at >= public.obs_archive_agora() - interval '8 minutes'
              and pc.checked_at >= coalesce((select mm.detached_at from public.obs_archive_months mm where mm.site_id = p_site
                                               and mm.class = public.obs_archive_exit_class(p_table) and mm.table_name = p_table and mm.month = p_month), '-infinity'::timestamptz)))
$$;
revoke all on function public.obs_archive_precheck_channels(uuid, text, date, boolean) from public, anon, authenticated;
grant execute on function public.obs_archive_precheck_channels(uuid, text, date, boolean) to service_role;

create or replace function public.obs_archive_precheck_unit(p_site uuid, p_table text, p_month date, p_channel uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_class text := public.obs_archive_exit_class(p_table);
  m public.obs_archive_months; u public.obs_archive_units; v_rel regclass;
begin
  if v_class is null then return jsonb_build_object('ok', false, 'codigo', 'tabela_invalida'); end if;
  begin   -- r1 R-1: a ação de outra aba pode renomear a relação no meio da conferência
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.id is null or m.sealed_at is null or m.unsealed_at is not null then return jsonb_build_object('ok', false, 'codigo', 'nao_selado'); end if;
  if m.dropped_at is not null then return jsonb_build_object('ok', false, 'codigo', 'ja_descartado'); end if;
  v_rel := public.obs_archive_part_rel(p_table, p_month, m.detached_at is not null);
  if v_rel is null then return jsonb_build_object('ok', false, 'codigo', 'particao_ausente'); end if;
  select cu.* into u from public.obs_archive_current_units(p_site, v_class, p_month) cu where cu.table_name = p_table and cu.channel_ref = p_channel::text;
  if u.id is null then return jsonb_build_object('ok', false, 'codigo', 'canal_sem_unidade'); end if;
  if public.obs_archive_conferir_canal(p_site, v_class, p_table, v_rel, p_channel, p_month, u.row_count, u.control_sum, u.hash_conteudo, true) then
    return jsonb_build_object('ok', true);
  end if;
  return jsonb_build_object('ok', false, 'codigo', 'conteudo_mudou');
exception
  when undefined_table or syntax_error then
    select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
    return jsonb_build_object('ok', false, 'codigo', case when m.dropped_at is not null then 'ja_descartado' else 'mudou_durante_a_leitura' end);
end;
end $$;
revoke all on function public.obs_archive_precheck_unit(uuid, text, date, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_precheck_unit(uuid, text, date, uuid) to service_role;

-- O estado da linha do mês, barato (sem hash, sem varrer a série): é o que a página lê para T1, T3, T7, T7a, T9.
create or replace function public.obs_archive_exit_check(p_site uuid, p_table text, p_month date, p_by uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_class text := public.obs_archive_exit_class(p_table);
  m public.obs_archive_months; pol record; v_desc integer; v_rel regclass; f jsonb;
  v_liberar date;
begin
  if v_class is null then return jsonb_build_object('estado', 'invalido', 'faltam', jsonb_build_array(jsonb_build_object('codigo', 'tabela_invalida'))); end if;
  select * into pol from public.obs_archive_policy() p where p.class = v_class and p.table_name = p_table;
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  select count(*) into v_desc from public.obs_archive_months x
   where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.dropped_at is not null and coalesce(x.rows_dropped, 0) > 0;
  if m.dropped_at is not null then
    return jsonb_build_object('estado', 'descartado', 'descartado_em', m.dropped_at, 'bytes_freed', m.bytes_freed, 'faltam', '[]'::jsonb, 'descartes', v_desc, 'dois_passos', v_desc < 3);
  end if;
  if m.detached_at is not null then
    v_liberar := (m.detached_at at time zone 'America/Sao_Paulo')::date + pol.wait_days;
    v_rel := public.obs_archive_part_rel(p_table, p_month, true);
    f := public.obs_archive_gate(p_site, v_class, p_table, p_month, p_by, 'clique', v_rel, array[1, 3, 5, 6, 7, 10, 11], true);
    return jsonb_build_object('estado', 'destacado', 'destacado_em', m.detached_at, 'liberar_a_partir', v_liberar,
                              'faltam', f, 'protecao_faltam', pg_catalog.to_jsonb(public.obs_archive_invariante_faltam()),
                              'particao_ausente', v_rel is null, 'descartes', v_desc, 'dois_passos', v_desc < 3);
  end if;
  v_rel := public.obs_archive_part_rel(p_table, p_month, false);
  f := public.obs_archive_gate(p_site, v_class, p_table, p_month, p_by, 'clique', null, array[1, 2, 3, 5, 6, 7, 10, 11, 20], true);
  return jsonb_build_object('estado', 'online', 'faltam', f, 'descartes', v_desc, 'dois_passos', v_desc < 3, 'particao_ausente', v_rel is null);
end $$;
revoke all on function public.obs_archive_exit_check(uuid, text, date, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_exit_check(uuid, text, date, uuid) to service_role;
-- r1 R-1 (Yannis) = item 2 (Phil): a simulação não trava e lê pelo nome da relação que a ação do vencedor está renomeando ou apagando. O erro cru
-- (undefined_table; syntax_error para o nome que o rename deixou torto) vira a resposta do que mudou: relê o registro e diz quem chegou antes.
-- p_quem: 'detach'/'drop' (esperam mês online: o outro lado destacou ou descartou), 'reattach'/'discard' (esperam mês destacado: o outro lado voltou ou descartou).
create or replace function public.obs_archive_saida_mudou(p_site uuid, p_class text, p_table text, p_month date, p_quem text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m public.obs_archive_months;
begin
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = p_class and x.table_name = p_table and x.month = p_month;
  if m.dropped_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_descartado', 'descartado_em', m.dropped_at); end if;
  if p_quem in ('detach', 'drop') and m.detached_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_destacado'); end if;
  if p_quem in ('reattach', 'discard') and m.id is not null and m.detached_at is null then return jsonb_build_object('status', 'recusado', 'codigo', 'nao_destacado'); end if;
  return jsonb_build_object('status', 'recusado', 'codigo', 'mudou_durante_a_leitura');
end $$;
revoke all on function public.obs_archive_saida_mudou(uuid, text, text, date, text) from public, anon, authenticated, service_role;

-- M6 PARTE 4: destacar e trazer de volta
-- r1 I-1: a trava consultiva por (tabela, mês), pega ANTES de qualquer leitura da partição, da _saida ou da mãe (as leituras da fase 1 seguram ACCESS SHARE e
-- resolvem o nome da relação que o vencedor está renomeando ou apagando). Sem o site: a partição é de todos os sites. Só a ação pega; a simulação não.
-- Espera até 20 s o vencedor terminar (pior ação medida 10,5 s); passou disso, false (o chamador responde `ocupado`). Devolve com lock_timeout de 3 s,
-- o das travas de relação que vêm depois. Ordem total: consultiva, registro, vídeos, mãe, partição. A M3b nunca pega a consultiva: não nasce ciclo.
create or replace function public.obs_archive_saida_trava(p_table text, p_month date) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform pg_catalog.set_config('lock_timeout', '20s', true);
  begin
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('obs_archive_saida|' || p_table || '|' || p_month::text, 0));
  exception when lock_not_available then
    perform pg_catalog.set_config('lock_timeout', '3s', true);
    return false;
  end;
  perform pg_catalog.set_config('lock_timeout', '3s', true);
  return true;
end $$;
revoke all on function public.obs_archive_saida_trava(text, date) from public, anon, authenticated, service_role;

-- Os limites da partição de um mês na mãe, no tipo da chave (date para daily/early/ensaio; timestamptz em hora de SP para a horária).
create or replace function public.obs_archive_part_bounds(p_mae regclass, p_month date) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_tipo text; v_fim date := (p_month + interval '1 month')::date;
begin
  select pg_catalog.format_type(a.atttypid, a.atttypmod) into v_tipo
    from pg_catalog.pg_partitioned_table pt join pg_catalog.pg_attribute a on a.attrelid = pt.partrelid and a.attnum = pt.partattrs[0]
   where pt.partrelid = p_mae;
  if v_tipo = 'date' then return pg_catalog.format('from (%L) to (%L)', p_month, v_fim); end if;
  return pg_catalog.format('from (%L) to (%L)', p_month::text || ' 00:00:00-03', v_fim::text || ' 00:00:00-03');
end $$;
revoke all on function public.obs_archive_part_bounds(regclass, date) from public, anon, authenticated, service_role;

-- A expressão do CHECK que dispensa o attach de varrer a tabela (I-7): os mesmos limites, escritos como condição.
create or replace function public.obs_archive_part_check(p_mae regclass, p_month date) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_col text; v_tipo text; v_fim date := (p_month + interval '1 month')::date;
begin
  select a.attname::text, pg_catalog.format_type(a.atttypid, a.atttypmod) into v_col, v_tipo
    from pg_catalog.pg_partitioned_table pt join pg_catalog.pg_attribute a on a.attrelid = pt.partrelid and a.attnum = pt.partattrs[0]
   where pt.partrelid = p_mae;
  if v_tipo = 'date' then return pg_catalog.format('%I >= %L::date and %I < %L::date', v_col, p_month, v_col, v_fim); end if;
  return pg_catalog.format('%I >= %L::timestamptz and %I < %L::timestamptz', v_col, p_month::text || ' 00:00:00-03', v_col, v_fim::text || ' 00:00:00-03');
end $$;
revoke all on function public.obs_archive_part_check(regclass, date) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_detach_month(p_site uuid, p_table text, p_month date, p_by uuid,
                                                           p_mode text default 'clique', p_dry_run boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_class text := public.obs_archive_exit_class(p_table);
  v_mae regclass := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(p_table));
  v_rel regclass; v_nome text; m public.obs_archive_months; f jsonb; t jsonb; v_fk record; v_sites uuid[]; v_total numeric; v_t0 timestamptz;
begin
  if v_class is null or v_mae is null then return jsonb_build_object('status', 'recusado', 'codigo', 'tabela_invalida'); end if;
  if p_mode not in ('clique', 'automatico') then return jsonb_build_object('status', 'recusado', 'codigo', 'tabela_invalida'); end if;
  -- r1 I-1: a trava consultiva do mês antes de qualquer leitura (só na ação; a simulação não trava, decisão 7)
  if not p_dry_run and not public.obs_archive_saida_trava(p_table, p_month) then return jsonb_build_object('status', 'recusado', 'codigo', 'ocupado'); end if;

  -- (1) leituras e o portão completo, SEM trava (o recálculo do hash é a parte cara; CP13).
  begin   -- r1 R-1: a simulação pode ler uma relação que a ação de outra aba está renomeando
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.dropped_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_descartado'); end if;
  if m.detached_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_destacado'); end if;
  v_nome := obs_part.nome_da_particao(p_table, p_month);
  v_rel := public.obs_archive_part_rel(p_table, p_month, false);
  if v_rel is null then return jsonb_build_object('status', 'recusado', 'codigo', 'particao_ausente'); end if;
  if cardinality(public.obs_archive_invariante_faltam()) > 0 then
    return jsonb_build_object('status', 'recusado', 'codigo', 'gatilho_ausente', 'protecao_faltam', pg_catalog.to_jsonb(public.obs_archive_invariante_faltam()));
  end if;
  f := public.obs_archive_gate(p_site, v_class, p_table, p_month, p_by, p_mode, v_rel, array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 20], p_dry_run);
  if jsonb_array_length(f) > 0 then return jsonb_build_object('status', 'recusado', 'faltam', f); end if;

  if p_dry_run then   -- decisão 7: simulação não trava
    t := public.obs_archive_tally(p_site, v_class, p_table, p_month, v_rel);
    select coalesce(sum(x.rows_total), 0) into v_total from public.obs_archive_months x
     where x.class = v_class and x.table_name = p_table and x.detached_at is null and x.dropped_at is null;   -- m-4: sem count(*) da mãe
    return jsonb_build_object('status', 'simulado', 'linhas', t->'linhas', 'soma', t->'soma',
      'canais', (select count(*) from public.obs_archive_precheck_channels(p_site, p_table, p_month) x),
      'fracao_da_classe', case when v_total > 0 then round(least((t->>'linhas')::numeric / v_total, 1), 4) else 0 end,
      'codigo', t->'codigo');
  end if;
exception
  when undefined_table or syntax_error then   -- r1 R-1: a ação de outra aba renomeou ou apagou a relação no meio da leitura
    if not p_dry_run then raise; end if;
    return public.obs_archive_saida_mudou(p_site, v_class, p_table, p_month, 'detach');
end;

  -- (2) o registro primeiro, na mesma ordem de toda função da M3b (site_id); (3) depois as tabelas: vídeos, mãe, partição.
  perform pg_catalog.set_config('lock_timeout', '3s', true);
  begin
    perform 1 from public.obs_archive_months x where x.class = v_class and x.table_name = p_table and x.month = p_month order by x.site_id for update;
    lock table public.competitor_videos in share row exclusive mode;
    execute pg_catalog.format('lock table %s in access exclusive mode', v_mae);
    v_t0 := pg_catalog.clock_timestamp();   -- r1 I-3: a mãe fica travada daqui até o fim da função (o tally e o detach)
    execute pg_catalog.format('lock table %s in access exclusive mode', v_rel);
  exception
    when undefined_table then   -- a partição mudou de nome ou sumiu enquanto esperava: outra chamada chegou antes (a conexão que perde a corrida)
      select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
      return jsonb_build_object('status', 'recusado', 'codigo', case when m.dropped_at is not null then 'ja_descartado' when m.detached_at is not null then 'ja_destacado' else 'particao_ausente' end);
    when lock_not_available or deadlock_detected then return jsonb_build_object('status', 'recusado', 'codigo', 'ocupado');
  end;

  -- (4) sob a trava: relê o registro e reavalia estado, partição e as condições baratas (C-2). Duas chamadas simultâneas: a segunda acha ja_destacado.
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.dropped_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_descartado'); end if;
  if m.detached_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_destacado'); end if;
  if not exists (select 1 from pg_catalog.pg_inherits i where i.inhparent = v_mae and i.inhrelid = v_rel) then
    return jsonb_build_object('status', 'recusado', 'codigo', 'ja_destacado');
  end if;
  f := public.obs_archive_gate(p_site, v_class, p_table, p_month, p_by, p_mode, null, array[1, 2, 3, 5, 6, 7, 10, 11, 20], false);
  if jsonb_array_length(f) > 0 then return jsonb_build_object('status', 'recusado', 'faltam', f); end if;

  -- Uma varredura, com o resumo da linha inteira (C-1): o que foi conferido tem de ser o que está na partição agora.
  t := public.obs_archive_tally(p_site, v_class, p_table, p_month, v_rel, true);
  if t->>'codigo' is not null then
    if t->>'codigo' = 'conteudo_mudou' then
      update public.obs_archive_months set unsealed_at = public.obs_archive_agora(), unsealed_reason = 'conteudo_mudou'
       where site_id = p_site and class = v_class and table_name = p_table and month = p_month and unsealed_at is null;
    end if;
    return jsonb_build_object('status', 'recusado', 'codigo', t->>'codigo');
  end if;
  if not public.obs_archive_outros_sites_ok(v_class, p_table, p_month, t) then
    return jsonb_build_object('status', 'recusado', 'codigo', 'outro_site_na_particao');
  end if;
  v_sites := array[p_site] || coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(t->'sites') x), '{}'::uuid[]);

  execute pg_catalog.format('alter table %s detach partition %s', v_mae, v_rel);
  for v_fk in select c.conname from pg_catalog.pg_constraint c where c.conrelid = v_rel and c.contype = 'f' loop
    execute pg_catalog.format('alter table %s drop constraint %I', v_rel, v_fk.conname);
  end loop;
  execute pg_catalog.format('alter table %s rename to %I', v_rel, v_nome || '_saida');

  -- Decisão 6: todo site com linha na partição ganha o destaque na mesma transação (os sites vêm do tally: sem segunda varredura, m-5).
  update public.obs_archive_months set detached_at = public.obs_archive_agora(), detached_by = p_by, reattached_at = null, reattach_out_of_order = false
   where class = v_class and table_name = p_table and month = p_month and site_id = any(v_sites);
  return jsonb_build_object('status', 'ok', 'linhas', t->'linhas', 'soma', t->'soma', 'sites', pg_catalog.to_jsonb(v_sites),
                            'mae_travada_ms', round(extract(epoch from pg_catalog.clock_timestamp() - v_t0) * 1000));
end $$;
revoke all on function public.obs_archive_detach_month(uuid, text, date, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.obs_archive_detach_month(uuid, text, date, uuid, text, boolean) to service_role;

create or replace function public.obs_archive_reattach_month(p_site uuid, p_table text, p_month date, p_by uuid, p_dry_run boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_class text := public.obs_archive_exit_class(p_table);
  v_mae regclass := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(p_table));
  v_rel regclass; v_nome text; m public.obs_archive_months; u record; h record; v_fk record; v_col record;
  v_mudou boolean := false; v_fora boolean; v_faltam_col text[] := '{}'; v_t0 timestamptz;
begin
  if v_class is null or v_mae is null then return jsonb_build_object('status', 'recusado', 'codigo', 'tabela_invalida'); end if;
  if p_by is null or not public.obs_archive_is_site_admin(p_site, p_by) then return jsonb_build_object('status', 'recusado', 'codigo', 'sem_direito'); end if;
  -- r1 I-1: a trava consultiva do mês antes de qualquer leitura (só na ação)
  if not p_dry_run and not public.obs_archive_saida_trava(p_table, p_month) then return jsonb_build_object('status', 'recusado', 'codigo', 'ocupado'); end if;

  -- (1) leituras e conferência, SEM trava (a tabela destacada ninguém escreve).
  begin   -- r1 R-1
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.dropped_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_descartado', 'descartado_em', m.dropped_at); end if;
  if m.detached_at is null then return jsonb_build_object('status', 'recusado', 'codigo', 'nao_destacado'); end if;
  v_nome := obs_part.nome_da_particao(p_table, p_month);
  v_rel := public.obs_archive_part_rel(p_table, p_month, true);
  if v_rel is null then return jsonb_build_object('status', 'recusado', 'codigo', 'particao_ausente'); end if;

  -- I3: a mãe pode ter ganhado coluna enquanto o mês estava fora. Coluna que só a mãe tem: a volta acrescenta (tipo e default da mãe) e marca
  -- conteudo_mudou. NOT NULL sem default, ou coluna a mais só na _saida, ou tipo diferente: esquema_divergente (o dono decide).
  if public.obs_archive_schema_fp(v_rel) is distinct from public.obs_archive_schema_fp(v_mae) then
    for v_col in select a.attname::text as nome, pg_catalog.format_type(a.atttypid, a.atttypmod) as tipo, a.attnotnull as nn,
                        pg_catalog.pg_get_expr(d.adbin, d.adrelid) as def
                   from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
                  where a.attrelid = v_mae and a.attnum > 0 and not a.attisdropped
                    and not exists (select 1 from pg_catalog.pg_attribute b where b.attrelid = v_rel and b.attname = a.attname and not b.attisdropped) loop
      if v_col.nn and v_col.def is null then return jsonb_build_object('status', 'recusado', 'codigo', 'esquema_divergente', 'coluna', v_col.nome); end if;
      v_faltam_col := v_faltam_col || pg_catalog.format('%I %s%s%s', v_col.nome, v_col.tipo, coalesce(' default ' || v_col.def, ''), case when v_col.nn then ' not null' else '' end);
    end loop;
    v_mudou := true;
    -- depois de acrescentar, as colunas têm de ser as mesmas: coluna a mais na _saida ou tipo diferente não se conserta aqui
    if exists (select 1 from pg_catalog.pg_attribute b where b.attrelid = v_rel and b.attnum > 0 and not b.attisdropped
                  and not exists (select 1 from pg_catalog.pg_attribute a where a.attrelid = v_mae and a.attname = b.attname and not a.attisdropped
                                     and a.atttypid = b.atttypid and a.atttypmod = b.atttypmod)) then
      return jsonb_build_object('status', 'recusado', 'codigo', 'esquema_divergente');
    end if;
  else
    -- O mês volta igual ou diferente? Recalcula as unidades correntes de canal que existe sobre a tabela destacada.
    for u in select cu.channel_ref, cu.row_count, cu.control_sum, cu.hash_conteudo from public.obs_archive_current_units(p_site, v_class, p_month) cu
              where cu.table_name = p_table and cu.purged_at is null and cu.lost_at is null
                and exists (select 1 from public.competitor_channels ch where ch.id::text = cu.channel_ref and ch.site_id = p_site) loop
      select * into h from public.obs_archive_content_hash_rel(p_site, v_class, p_table, v_rel, u.channel_ref::uuid, p_month);
      if not (h.row_count = u.row_count and h.control_sum::numeric is not distinct from u.control_sum and h.hash_conteudo = u.hash_conteudo) then v_mudou := true; end if;
    end loop;
  end if;
  v_fora := exists (select 1 from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table
                       and x.month > p_month and (x.detached_at is not null or x.dropped_at is not null));
  if p_dry_run then
    return jsonb_build_object('status', 'simulado', 'conteudo_mudou', v_mudou, 'volta_fora_de_ordem', v_fora);
  end if;
exception
  when undefined_table or syntax_error then   -- r1 R-1: a ação de outra aba renomeou ou apagou a relação no meio da leitura
    if not p_dry_run then raise; end if;
    return public.obs_archive_saida_mudou(p_site, v_class, p_table, p_month, 'reattach');
end;

  -- (2) o registro primeiro (mesma ordem da M3b); (3) vídeos e a tabela destacada. A mãe só DEPOIS de FK e CHECK validados (I-7): a trava
  -- exclusiva da mãe dura o rename e o attach, não a varredura.
  perform pg_catalog.set_config('lock_timeout', '3s', true);
  begin
    perform 1 from public.obs_archive_months x where x.class = v_class and x.table_name = p_table and x.month = p_month order by x.site_id for update;
    lock table public.competitor_videos in share row exclusive mode;
    execute pg_catalog.format('lock table %s in access exclusive mode', v_rel);
  exception
    when undefined_table then   -- a tabela destacada já voltou (outra chamada chegou antes) ou sumiu
      select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
      return jsonb_build_object('status', 'recusado', 'codigo', case when m.dropped_at is not null then 'ja_descartado' when m.detached_at is null then 'nao_destacado' else 'particao_ausente' end);
    when lock_not_available or deadlock_detected then return jsonb_build_object('status', 'recusado', 'codigo', 'ocupado');
  end;

  -- (4) sob a trava, reavalia.
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.dropped_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_descartado', 'descartado_em', m.dropped_at); end if;
  if m.detached_at is null then return jsonb_build_object('status', 'recusado', 'codigo', 'nao_destacado'); end if;

  begin
    for v_col in select unnest(v_faltam_col) as def loop
      execute pg_catalog.format('alter table %s add column %s', v_rel, v_col.def);
    end loop;
    -- As FK da mãe, copiadas como NOT VALID e validadas (a varredura é da tabela destacada, que ninguém lê: sem a mãe travada).
    for v_fk in select c.conname, pg_catalog.pg_get_constraintdef(c.oid) as def from pg_catalog.pg_constraint c where c.conrelid = v_mae and c.contype = 'f' loop
      execute pg_catalog.format('alter table %s add constraint %I %s not valid', v_rel, v_fk.conname, v_fk.def);
      execute pg_catalog.format('alter table %s validate constraint %I', v_rel, v_fk.conname);
    end loop;
    -- O CHECK dos limites do mês: validado agora, dispensa a varredura do attach.
    execute pg_catalog.format('alter table %s add constraint m6_limites check (%s) not valid', v_rel, public.obs_archive_part_check(v_mae, p_month));
    execute pg_catalog.format('alter table %s validate constraint m6_limites', v_rel);
    -- Só agora a mãe (ACCESS EXCLUSIVE): rename e attach, que adota as FK iguais (PG17) e pula a varredura.
    execute pg_catalog.format('lock table %s in access exclusive mode', v_mae);
    v_t0 := pg_catalog.clock_timestamp();   -- r1 I-3: a mãe fica travada daqui até o attach
    execute pg_catalog.format('alter table %s rename to %I', v_rel, v_nome);
    execute pg_catalog.format('alter table %s attach partition obs_part.%I for values %s', v_mae, v_nome, public.obs_archive_part_bounds(v_mae, p_month));
    execute pg_catalog.format('alter table obs_part.%I drop constraint m6_limites', v_nome);
  exception
    when foreign_key_violation then return jsonb_build_object('status', 'recusado', 'codigo', 'orfa_inesperada');
    when check_violation then return jsonb_build_object('status', 'recusado', 'codigo', 'fora_do_mes');
    when invalid_table_definition or datatype_mismatch then return jsonb_build_object('status', 'recusado', 'codigo', 'esquema_divergente');
    when lock_not_available or deadlock_detected then return jsonb_build_object('status', 'recusado', 'codigo', 'ocupado');
  end;

  update public.obs_archive_months
     set detached_at = null, detached_by = null, reattached_at = public.obs_archive_agora(), reattach_out_of_order = v_fora,
         unsealed_at = case when v_mudou then public.obs_archive_agora() else unsealed_at end,
         unsealed_reason = case when v_mudou then 'mudou_no_destaque' else unsealed_reason end
   where class = v_class and table_name = p_table and month = p_month and detached_at is not null and dropped_at is null;
  return jsonb_build_object('status', 'ok', 'conteudo_mudou', v_mudou, 'volta_fora_de_ordem', v_fora,
                            'protecao_faltam', pg_catalog.to_jsonb(public.obs_archive_invariante_faltam()),
                            'mae_travada_ms', round(extract(epoch from pg_catalog.clock_timestamp() - v_t0) * 1000));
end $$;
revoke all on function public.obs_archive_reattach_month(uuid, text, date, uuid, boolean) from public, anon, authenticated;
grant execute on function public.obs_archive_reattach_month(uuid, text, date, uuid, boolean) to service_role;
-- M6 PARTE 5: descartar e a composta
create or replace function public.obs_archive_discard_core(p_site uuid, p_class text, p_table text, p_month date, p_rel regclass, p_by uuid, p_mode text)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare v_l bigint; v_b bigint; v_sites uuid[];
begin
  execute pg_catalog.format('select count(*) from %s', p_rel) into v_l;
  v_b := pg_catalog.pg_total_relation_size(p_rel);
  execute pg_catalog.format('select array_agg(distinct ch.site_id) from %s t join public.competitor_videos v on v.id = t.video_id
                               join public.competitor_channels ch on ch.id = v.competitor_channel_id', p_rel) into v_sites;
  execute pg_catalog.format('drop table %s', p_rel);
  update public.obs_archive_months
     set dropped_at = public.obs_archive_agora(), dropped_by = p_by, drop_mode = p_mode,
         rows_dropped = case when site_id = p_site then v_l else rows_dropped end,
         bytes_freed = case when site_id = p_site then v_b else 0 end           -- decisão 6: os bytes só na linha de quem tirou
   where class = p_class and table_name = p_table and month = p_month and dropped_at is null
     and (site_id = p_site or site_id = any(coalesce(v_sites, '{}'::uuid[])));
  return jsonb_build_object('linhas', v_l, 'bytes', v_b);
end $$;
revoke all on function public.obs_archive_discard_core(uuid, text, text, date, regclass, uuid, text) from public, anon, authenticated, service_role;

-- O que o automático faz com uma resposta (m-7: TODA recusa, inclusive as que voltam antes do portão). Fora do automático, ou em simulação, devolve a resposta.
-- A função obs_archive_switch_after_refusal é da PARTE 7 [M6b]: na M6a não existe e só o `ok` zera os contadores.
create or replace function public.obs_archive_after_auto(p_site uuid, p_class text, p_month date, p_resp jsonb, p_mode text, p_dry_run boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_mode <> 'automatico' or p_dry_run then return p_resp; end if;
  if p_resp->>'status' = 'ok' then
    update public.obs_archive_switch set refusals_nas = 0, refusals_b2 = 0 where site_id = p_site and class = p_class;
  elsif p_resp->>'status' = 'recusado' and pg_catalog.to_regprocedure('public.obs_archive_switch_after_refusal(uuid, text, date, jsonb)') is not null then
    execute 'select public.obs_archive_switch_after_refusal($1, $2, $3, $4)' using p_site, p_class, p_month, p_resp;
  end if;
  return p_resp;
end $$;
revoke all on function public.obs_archive_after_auto(uuid, text, date, jsonb, text, boolean) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_discard_month(p_site uuid, p_table text, p_month date, p_by uuid,
                                                            p_mode text default 'clique', p_dry_run boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_class text := public.obs_archive_exit_class(p_table);
  v_mae regclass := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(p_table));
  pol record; m public.obs_archive_months; v_rel regclass; f jsonb; t jsonb; v_lib date; r jsonb;
begin
  if v_class is null or v_mae is null or p_mode not in ('clique', 'automatico') then return jsonb_build_object('status', 'recusado', 'codigo', 'tabela_invalida'); end if;
  -- r1 I-1: a trava consultiva do mês antes de qualquer leitura (só na ação)
  if not p_dry_run and not public.obs_archive_saida_trava(p_table, p_month) then return jsonb_build_object('status', 'recusado', 'codigo', 'ocupado'); end if;
  select * into pol from public.obs_archive_policy() p where p.class = v_class and p.table_name = p_table;
  -- (1) leituras e portão SEM trava
  begin   -- r1 R-1
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.dropped_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_descartado', 'descartado_em', m.dropped_at); end if;
  if m.detached_at is null then return jsonb_build_object('status', 'recusado', 'codigo', 'nao_destacado'); end if;
  v_rel := public.obs_archive_part_rel(p_table, p_month, true);
  if v_rel is null then return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', 'particao_ausente'), p_mode, p_dry_run); end if;
  v_lib := (m.detached_at at time zone 'America/Sao_Paulo')::date + pol.wait_days;     -- dias reais de SP (ensaio: 1)
  if public.obs_archive_hoje_sp() < v_lib then
    return jsonb_build_object('status', 'recusado', 'codigo', 'cedo_demais', 'liberar_a_partir', v_lib);
  end if;
  if cardinality(public.obs_archive_invariante_faltam()) > 0 then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', 'gatilho_ausente'), p_mode, p_dry_run);
  end if;
  -- I3: a mãe ganhou ou perdeu coluna depois do destaque: a cópia no B2 não tem a forma de hoje; apagar a tabela destacada seria perder a única cópia na forma nova.
  if public.obs_archive_schema_fp(v_rel) is distinct from public.obs_archive_schema_fp(v_mae) then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', 'esquema_mudou'), p_mode, p_dry_run);
  end if;
  f := public.obs_archive_gate(p_site, v_class, p_table, p_month, p_by, p_mode, v_rel, array[1, 3, 4, 5, 6, 7, 10, 11, 13], p_dry_run);
  if jsonb_array_length(f) > 0 then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'faltam', f), p_mode, p_dry_run);
  end if;
  if p_dry_run then
    return jsonb_build_object('status', 'simulado', 'linhas', (public.obs_archive_tally(p_site, v_class, p_table, p_month, v_rel))->'linhas',
                              'bytes', pg_catalog.pg_total_relation_size(v_rel));
  end if;
exception
  when undefined_table or syntax_error then   -- r1 R-1: a ação de outra aba renomeou ou apagou a relação no meio da leitura
    if not p_dry_run then raise; end if;
    return public.obs_archive_saida_mudou(p_site, v_class, p_table, p_month, 'discard');
end;

  -- (2) o registro primeiro (ordem da M3b); (3) a tabela destacada
  perform pg_catalog.set_config('lock_timeout', '3s', true);
  begin
    perform 1 from public.obs_archive_months x where x.class = v_class and x.table_name = p_table and x.month = p_month order by x.site_id for update;
    execute pg_catalog.format('lock table %s in access exclusive mode', v_rel);
  exception
    when undefined_table then   -- outra chamada apagou antes: a que perde a corrida acha ja_descartado
      select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
      return jsonb_build_object('status', 'recusado', 'codigo', case when m.dropped_at is not null then 'ja_descartado' else 'particao_ausente' end, 'descartado_em', m.dropped_at);
    when lock_not_available or deadlock_detected then return jsonb_build_object('status', 'recusado', 'codigo', 'ocupado');
  end;

  -- (4) sob a trava: relê e reavalia o barato (estado, prazo, atestação do B2, expurgo pendente), depois a contagem com o resumo da linha inteira
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.dropped_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_descartado', 'descartado_em', m.dropped_at); end if;
  if m.detached_at is null then return jsonb_build_object('status', 'recusado', 'codigo', 'nao_destacado'); end if;
  if public.obs_archive_hoje_sp() < (m.detached_at at time zone 'America/Sao_Paulo')::date + pol.wait_days then
    return jsonb_build_object('status', 'recusado', 'codigo', 'cedo_demais', 'liberar_a_partir', (m.detached_at at time zone 'America/Sao_Paulo')::date + pol.wait_days);
  end if;
  f := public.obs_archive_gate(p_site, v_class, p_table, p_month, p_by, p_mode, null, array[1, 3, 5, 6, 7, 10, 11], false);
  if jsonb_array_length(f) > 0 then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'faltam', f), p_mode, false);
  end if;
  t := public.obs_archive_tally(p_site, v_class, p_table, p_month, v_rel, true);
  if t->>'codigo' is not null then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', t->>'codigo'), p_mode, false);
  end if;
  if not public.obs_archive_outros_sites_ok(v_class, p_table, p_month, t) then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', 'outro_site_na_particao'), p_mode, false);
  end if;
  t := public.obs_archive_discard_core(p_site, v_class, p_table, p_month, v_rel, p_by, p_mode);
  r := jsonb_build_object('status', 'ok', 'linhas', t->'linhas', 'bytes', t->'bytes', 'descartado_em', public.obs_archive_agora());
  return public.obs_archive_after_auto(p_site, v_class, p_month, r, p_mode, false);
end $$;
revoke all on function public.obs_archive_discard_month(uuid, text, date, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.obs_archive_discard_month(uuid, text, date, uuid, text, boolean) to service_role;

-- Em um passo: destaque e descarte na MESMA transação (nunca abre a janela de "trazer de volta"); só depois de 3 descartes com linha DA TABELA.
create or replace function public.obs_archive_drop_month(p_site uuid, p_table text, p_month date, p_by uuid,
                                                         p_mode text default 'clique', p_dry_run boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_class text := public.obs_archive_exit_class(p_table);
  v_mae regclass := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(p_table));
  m public.obs_archive_months; v_rel regclass; v_nome text; f jsonb; t jsonb; r jsonb; v_desc integer; v_fk record; v_sites uuid[];
begin
  if v_class is null or v_mae is null or p_mode not in ('clique', 'automatico') then
    return public.obs_archive_after_auto(p_site, coalesce(v_class, ''), p_month, jsonb_build_object('status', 'recusado', 'codigo', 'tabela_invalida'), p_mode, p_dry_run);
  end if;
  -- r1 I-1: a trava consultiva do mês antes de qualquer leitura (só na ação)
  if not p_dry_run and not public.obs_archive_saida_trava(p_table, p_month) then return jsonb_build_object('status', 'recusado', 'codigo', 'ocupado'); end if;
  -- (1) leituras e portão completo SEM trava de relação
  begin   -- r1 R-1
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.dropped_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_descartado', 'descartado_em', m.dropped_at); end if;
  if m.detached_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_destacado'); end if;
  select count(*) into v_desc from public.obs_archive_months x
   where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.dropped_at is not null and coalesce(x.rows_dropped, 0) > 0;
  if v_desc < 3 then return jsonb_build_object('status', 'recusado', 'codigo', 'dois_passos_obrigatorios', 'descartes', v_desc); end if;
  v_nome := obs_part.nome_da_particao(p_table, p_month);
  v_rel := public.obs_archive_part_rel(p_table, p_month, false);
  if v_rel is null then return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', 'particao_ausente'), p_mode, p_dry_run); end if;
  if cardinality(public.obs_archive_invariante_faltam()) > 0 then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', 'gatilho_ausente'), p_mode, p_dry_run);
  end if;
  f := public.obs_archive_gate(p_site, v_class, p_table, p_month, p_by, p_mode, v_rel, array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 20], p_dry_run);
  if jsonb_array_length(f) > 0 then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'faltam', f), p_mode, p_dry_run);
  end if;
  if p_dry_run then
    return jsonb_build_object('status', 'simulado', 'linhas', (public.obs_archive_tally(p_site, v_class, p_table, p_month, v_rel))->'linhas',
                              'bytes', pg_catalog.pg_total_relation_size(v_rel));
  end if;
exception
  when undefined_table or syntax_error then   -- r1 R-1: a ação de outra aba renomeou ou apagou a relação no meio da leitura
    if not p_dry_run then raise; end if;
    return public.obs_archive_saida_mudou(p_site, v_class, p_table, p_month, 'drop');
end;

  -- (2) o registro, (3) vídeos, mãe, partição
  perform pg_catalog.set_config('lock_timeout', '3s', true);
  begin
    perform 1 from public.obs_archive_months x where x.class = v_class and x.table_name = p_table and x.month = p_month order by x.site_id for update;
    lock table public.competitor_videos in share row exclusive mode;
    execute pg_catalog.format('lock table %s in access exclusive mode', v_mae);
    execute pg_catalog.format('lock table %s in access exclusive mode', v_rel);
  exception
    when undefined_table then
      select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
      return jsonb_build_object('status', 'recusado', 'codigo', case when m.dropped_at is not null then 'ja_descartado' when m.detached_at is not null then 'ja_destacado' else 'particao_ausente' end);
    when lock_not_available or deadlock_detected then
      return jsonb_build_object('status', 'recusado', 'codigo', 'ocupado');   -- ocupado não desarma (Tarefa 7b)
  end;

  -- (4) sob a trava: relê e reavalia (C-2): estado, 3 descartes, partição ainda filha da mãe, condições baratas (b2_withdrawn_at gravado por outra conexão, etc.)
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.dropped_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_descartado', 'descartado_em', m.dropped_at); end if;
  if m.detached_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_destacado'); end if;
  if not exists (select 1 from pg_catalog.pg_inherits i where i.inhparent = v_mae and i.inhrelid = v_rel) then
    return jsonb_build_object('status', 'recusado', 'codigo', 'ja_destacado');
  end if;
  f := public.obs_archive_gate(p_site, v_class, p_table, p_month, p_by, p_mode, null, array[1, 2, 3, 5, 6, 7, 10, 11, 20], false);
  if jsonb_array_length(f) > 0 then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'faltam', f), p_mode, false);
  end if;
  -- C-1: UMA varredura com o resumo da linha inteira contra o que a conferência guardou; sites vêm dela (m-5)
  t := public.obs_archive_tally(p_site, v_class, p_table, p_month, v_rel, true);
  if t->>'codigo' is not null then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', t->>'codigo'), p_mode, false);
  end if;
  if not public.obs_archive_outros_sites_ok(v_class, p_table, p_month, t) then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', 'outro_site_na_particao'), p_mode, false);
  end if;
  v_sites := array[p_site] || coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(t->'sites') x), '{}'::uuid[]);

  execute pg_catalog.format('alter table %s detach partition %s', v_mae, v_rel);
  for v_fk in select c.conname from pg_catalog.pg_constraint c where c.conrelid = v_rel and c.contype = 'f' loop
    execute pg_catalog.format('alter table %s drop constraint %I', v_rel, v_fk.conname);
  end loop;
  -- m-2: o destaque em todos os sites da partição, como no detach (o descarte já grava dropped_at em todos)
  update public.obs_archive_months set detached_at = public.obs_archive_agora(), detached_by = p_by
   where class = v_class and table_name = p_table and month = p_month and site_id = any(v_sites);
  if not found then
    raise exception 'registro_ausente' using errcode = 'P0001';   -- o portão exige selo; sem linha no registro é defeito (aborta tudo)
  end if;
  t := public.obs_archive_discard_core(p_site, v_class, p_table, p_month, v_rel, p_by, p_mode);
  r := jsonb_build_object('status', 'ok', 'linhas', t->'linhas', 'bytes', t->'bytes', 'descartado_em', public.obs_archive_agora());
  return public.obs_archive_after_auto(p_site, v_class, p_month, r, p_mode, false);
end $$;
revoke all on function public.obs_archive_drop_month(uuid, text, date, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.obs_archive_drop_month(uuid, text, date, uuid, text, boolean) to service_role;
-- M6 PARTE 6 [M6a]: contadores do interruptor, simulação vista, em trânsito, vermelhos da saída e encerrar o dado de teste
create or replace function public.obs_archive_switch_counts(p_site uuid, p_class text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'descartes', (select count(*) from public.obs_archive_months m where m.site_id = p_site and m.class = p_class and m.dropped_at is not null
                    and coalesce(m.rows_dropped, 0) > 0 and coalesce(m.drop_mode, 'clique') = 'clique'),
    'simulacoes', coalesce((select s.sims_seen from public.obs_archive_switch s where s.site_id = p_site and s.class = p_class), 0))
$$;
revoke all on function public.obs_archive_switch_counts(uuid, text) from public, anon, authenticated;
grant execute on function public.obs_archive_switch_counts(uuid, text) to service_role;   -- M6a: o leitor mínimo dos contadores (Hanna H-1)

create or replace function public.obs_archive_switch_sim_seen(p_site uuid, p_class text, p_by uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_class not in ('horaria', 'serie') then return jsonb_build_object('simulacoes', 0); end if;
  if p_by is null or not public.obs_archive_is_site_admin(p_site, p_by) then return jsonb_build_object('status', 'recusado', 'codigo', 'sem_direito'); end if;
  insert into public.obs_archive_switch (site_id, class, sims_seen, last_sim_at) values (p_site, p_class, 1, public.obs_archive_agora())
  on conflict (site_id, class) do update set sims_seen = least(public.obs_archive_switch.sims_seen + 1, 2), last_sim_at = excluded.last_sim_at;
  return jsonb_build_object('simulacoes', (select s.sims_seen from public.obs_archive_switch s where s.site_id = p_site and s.class = p_class));
end $$;
revoke all on function public.obs_archive_switch_sim_seen(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_switch_sim_seen(uuid, text, uuid) to service_role;

create or replace function public.obs_archive_em_transito(p_site uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('tabela', m.table_name, 'mes', m.month, 'destacado_em', m.detached_at,
           'liberar_a_partir', (m.detached_at at time zone 'America/Sao_Paulo')::date + p.wait_days) order by m.month, m.table_name), '[]'::jsonb)
    from public.obs_archive_months m join public.obs_archive_policy() p on p.class = m.class and p.table_name = m.table_name
   where m.detached_at is not null and m.dropped_at is null and (m.site_id = p_site or p_site is null)
$$;
revoke all on function public.obs_archive_em_transito(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_em_transito(uuid) to service_role;

create or replace function public.obs_archive_vermelhos_saida(p_site uuid) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare v text[] := '{}'; i record; f text; v_mae regclass; v_rel regclass; v_lib date;
begin
  if exists (select 1 from public.obs_archive_months m where m.detached_at is not null and m.dropped_at is null) then
    foreach f in array public.obs_archive_invariante_faltam() loop v := v || ('saida_protecao_ausente:' || f); end loop;
  end if;
  for i in select m.table_name, m.month, m.detached_at, p.wait_days from public.obs_archive_months m
             join public.obs_archive_policy() p on p.class = m.class and p.table_name = m.table_name
            where m.site_id = p_site and m.detached_at is not null and m.dropped_at is null order by m.month, m.table_name loop
    v_rel := public.obs_archive_part_rel(i.table_name, i.month, true);
    if v_rel is null then
      v := v || ('saida_particao_ausente:' || i.table_name || ':' || pg_catalog.to_char(i.month, 'YYYY-MM'));
      continue;
    end if;
    -- Yannis I-3 / Phil I5: mês em trânsito há mais de 14 dias depois da data de liberar ninguém liberou nem trouxe de volta: vermelho
    v_lib := (i.detached_at at time zone 'America/Sao_Paulo')::date + i.wait_days;
    if public.obs_archive_hoje_sp() > v_lib + 14 then
      v := v || ('saida_transito_longo:' || i.table_name || ':' || pg_catalog.to_char(i.month, 'YYYY-MM'));
    end if;
    -- I3: a mãe mudou de forma depois do destaque; liberar recusa esquema_mudou e a volta acrescenta colunas: o dono precisa saber
    v_mae := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(i.table_name));
    if v_mae is not null and public.obs_archive_schema_fp(v_rel) is distinct from public.obs_archive_schema_fp(v_mae) then
      v := v || ('saida_esquema_divergente:' || i.table_name || ':' || pg_catalog.to_char(i.month, 'YYYY-MM'));
    end if;
  end loop;
  -- r1 (b) = consulta (1) do m6-pre-migration.sql: mês destacado e não descartado, de OUTRO site, cuja tabela _saida não existe. O gatilho do invariante
  -- recusa todo apagamento de todos os sites enquanto ele existir; o dono precisa ver QUAL site, tabela e mês. Não é correção automática. (O do próprio
  -- site já sai como saida_particao_ausente acima.)
  for i in select m.site_id, m.table_name, m.month from public.obs_archive_months m
            where m.detached_at is not null and m.dropped_at is null and m.site_id is distinct from p_site
              and pg_catalog.to_regclass(pg_catalog.format('obs_part.%I', obs_part.nome_da_particao(m.table_name, m.month) || '_saida')) is null
            order by m.site_id, m.table_name, m.month loop
    v := v || ('mes_destacado_sem_tabela:' || i.site_id || ':' || i.table_name || ':' || pg_catalog.to_char(i.month, 'YYYY-MM'));
  end loop;
  return v;
end $$;
revoke all on function public.obs_archive_vermelhos_saida(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_vermelhos_saida(uuid) to service_role;

create or replace function public.obs_archive_vermelhos(p_site uuid) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  v text[] := '{}'; n integer; i record; v_hoje date := public.obs_archive_hoje_sp(); v_agora timestamptz := public.obs_archive_agora(); v_cor text; v_h public.obs_archive_heartbeat;
  v_run public.obs_archive_b2_runs; f text;
begin
  select count(*) into n from public.obs_archive_atraso_itens(p_site) a where a.tipo = 'unidade' and v_hoje - a.desde > 30;
  if n > 0 then v := v || format('atraso de cópia: %s unidades há mais de 30 dias', n); end if;
  select count(*) into n from public.obs_archive_atraso_itens(p_site) a where a.tipo = 'mes' and v_hoje - a.desde > 30;
  if n > 0 then v := v || format('mês sem selo há mais de 30 dias: %s', n); end if;
  select (select count(*) from public.obs_archive_units u where u.site_id = p_site and u.nas_withdrawn_at is not null and u.nas_withdrawn_reason in ('ausente', 'divergente') and u.purged_at is null and u.lost_at is null and u.superseded_at is null)
       + (select count(*) from public.obs_archive_unit_parts pt join public.obs_archive_units u on u.id = pt.unit_id where u.site_id = p_site and pt.nas_withdrawn_at is not null and pt.nas_withdrawn_reason in ('ausente', 'divergente') and u.purged_at is null and u.lost_at is null and u.superseded_at is null)
       + (select count(*) from public.obs_archive_summaries s where s.site_id = p_site and s.nas_withdrawn_at is not null and s.nas_withdrawn_reason in ('ausente', 'divergente') and s.purged_at is null and s.lost_at is null and s.superseded_at is null)
       + (select count(*) from public.obs_archive_months m where m.site_id = p_site and m.manifest_nas_withdrawn_at is not null) into n;
  if n > 0 then v := v || format('NAS: %s arquivos ausentes ou diferentes', n); end if;
  select count(distinct (m.class, m.month)) into n from public.obs_archive_months m where m.site_id = p_site and m.b2_withdrawn_at is not null;
  if n > 0 then v := v || format('B2: %s meses com a conferência retirada', n); end if;
  select (select count(*) from public.obs_archive_units u where u.site_id = p_site and u.nas_withdrawn_reason = 'conteudo_divergente' and u.nas_withdrawn_at is not null and u.purged_at is null and u.lost_at is null and u.superseded_at is null)
       + (select count(*) from public.obs_archive_unit_parts pt join public.obs_archive_units u on u.id = pt.unit_id where u.site_id = p_site and pt.nas_withdrawn_reason = 'conteudo_divergente' and pt.nas_withdrawn_at is not null and u.purged_at is null and u.lost_at is null and u.superseded_at is null)
       + (select count(*) from public.obs_archive_summaries s where s.site_id = p_site and s.nas_withdrawn_reason = 'conteudo_divergente' and s.nas_withdrawn_at is not null and s.purged_at is null and s.lost_at is null and s.superseded_at is null) into n;
  if n > 0 then v := v || format('conteúdo divergente em %s arquivos', n); end if;
  n := public.obs_archive_descartados_sem_releitura(p_site, 45);
  if n > 0 then v := v || format('mês descartado sem releitura há mais de 45 dias: %s', n); end if;
  n := public.obs_archive_b2_atrasados(p_site, 7);
  if n > 0 then v := v || format('b2_atrasado: %s meses selados não descartados com algum arquivo sem b2_ok_at há mais de 7 dias', n); end if;
  -- a mesma recusa de fileId em 3 execuções seguidas (as 3 mais recentes do site)
  if (select count(*) filter (where q.file_id_recusado) from (select r.file_id_recusado from public.obs_archive_b2_runs r where r.site_id = p_site order by r.started_at desc limit 3) q) = 3 then
    v := pg_catalog.array_append(v, 'B2 recusou o fileId em 3 execuções seguidas');
  end if;
  -- canário de um filho sem chegar ao B2 (>= 5 dias): o mais antigo informado depois do último que o B2 achou
  for i in select fl.filho,
                  (select min(c.informed_at) from public.obs_archive_canaries c where c.site_id = p_site and c.filho = fl.filho and c.b2_ok_at is null
                      and c.informed_at > coalesce((select max(k.informed_at) from public.obs_archive_canaries k where k.site_id = p_site and k.filho = fl.filho and k.b2_ok_at is not null), '-infinity'::timestamptz)) as desde
             from (values ('numerico'), ('texto')) fl(filho) loop
    if i.desde is not null and i.desde <= v_agora - interval '5 days' then
      v := v || format('canário do filho %s sem chegar ao B2 há %s dias', i.filho, floor(extract(epoch from (v_agora - i.desde)) / 86400)::int);
    end if;
  end loop;
  -- Phil M3: o alarme dura 30 dias E vai até um canário NOVO do mesmo filho chegar ao B2 (termina por evidência, não só pelo relógio; o dono pode estar fora)
  for i in select distinct c.filho from public.obs_archive_canaries c
            where c.site_id = p_site and c.regravado_at is not null
              and (c.regravado_at > v_agora - interval '30 days'
                   or not exists (select 1 from public.obs_archive_canaries k where k.site_id = p_site and k.filho = c.filho and k.b2_ok_at is not null and k.b2_ok_at > c.regravado_at))
            order by 1 loop
    v := v || ('canario_regravado:' || i.filho);
  end loop;
  for i in select 'u:' || u.id as id from public.obs_archive_units u where u.site_id = p_site and u.nas_unreadable_at is not null and u.purged_at is null and u.lost_at is null
           union all select 'p:' || pt.unit_id || ':' || lpad(pt.part::text, 2, '0') from public.obs_archive_unit_parts pt join public.obs_archive_units u on u.id = pt.unit_id where u.site_id = p_site and pt.nas_unreadable_at is not null
           union all select 's:' || s.id from public.obs_archive_summaries s where s.site_id = p_site and s.nas_unreadable_at is not null
           order by 1 loop
    v := v || ('nas_ilegivel:' || i.id);
  end loop;
  for i in select b.arquivo_id from public.obs_archive_b2_files b where b.site_id = p_site and b.ilegivel_at is not null and (b.last_ok_at is null or b.last_ok_at < b.ilegivel_at) order by 1 loop
    v := v || ('b2_ilegivel:' || i.arquivo_id);
  end loop;
  select * into v_h from public.obs_archive_heartbeat h where h.site_id = p_site and h.worker = 'copiador';
  if found then
    foreach f in array array['numerico', 'texto'] loop
      if coalesce((v_h.total_bytes->>f)::numeric, 0) > 0 and (v_h.free_bytes->>f) is not null
         and ((v_h.total_bytes->>f)::numeric - (v_h.free_bytes->>f)::numeric) / (v_h.total_bytes->>f)::numeric >= 0.8 then
        v := v || ('nas_80:' || f);
      end if;
    end loop;
  end if;
  for i in select p.table_name from public.obs_archive_policy() p where p.class in ('horaria', 'serie', 'texto') and pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(p.table_name)) is null order by 1 loop
    v := v || ('tabela_ausente:' || i.table_name);
  end loop;
  if public.obs_archive_b2_teto_dia(p_site) > public.obs_archive_b2_franquia_mes() / 2 then v := pg_catalog.array_append(v, 'b2_piso_acima_do_teto'); end if;
  select * into v_run from public.obs_archive_b2_runs r where r.site_id = p_site and r.modo = 'completo' order by r.started_at desc limit 1;
  if found and v_run.completo_fechado_em is null and v_run.completo_desde < v_agora - interval '35 days' then
    v := v || format('b2_completo_atrasado: conferência completa do B2 aberta há %s dias: rode conferir-b2 --completo até fechar', floor(extract(epoch from (v_agora - v_run.completo_desde)) / 86400)::int);
  end if;
  v_cor := public.obs_archive_b2_teto_cor(p_site);
  if v_cor = 'vermelho' then v := pg_catalog.array_append(v, 'b2_teto_2_dias'); end if;
  -- da fatia 12a (Tarefa 8): canais removidos sem destino e a vigia da remoção; a função nasce lá
  if pg_catalog.to_regprocedure('public.obs_archive_vermelhos_remocao(uuid)') is not null then
    execute 'select $1 || public.obs_archive_vermelhos_remocao($2)' into v using v, p_site;
  end if;
  -- M6a: os vermelhos da saída (proteção ausente, tabela destacada sumida, trânsito longo, esquema divergente)
  if pg_catalog.to_regprocedure('public.obs_archive_vermelhos_saida(uuid)') is not null then
    execute 'select $1 || public.obs_archive_vermelhos_saida($2)' into v using v, p_site;
  end if;
  -- M6b: o automático desligou sozinho nas últimas 72 h (a função só existe depois da migration da Tarefa 14b)
  if pg_catalog.to_regprocedure('public.obs_archive_vermelhos_automatico(uuid)') is not null then
    execute 'select $1 || public.obs_archive_vermelhos_automatico($2)' into v using v, p_site;
  end if;
  return coalesce(v, '{}'::text[]);
end $$;
revoke all on function public.obs_archive_vermelhos(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_vermelhos(uuid) to service_role;
-- M6 PARTE 7 [M6b]: o interruptor (estado, ligar, desligar, vigia), os candidatos, o vermelho do desarme e a próxima saída
