-- M3B-RECUSA (D-M9-26 antecipada, decisão do dono de 23/10): enquanto a M9 não existe, o banco recusa apagar vídeo e comentário
-- do site que a M3b já tocou. O helper tem o MESMO nome e assinatura do da M9 (Tarefa 2), que o recria com "and not obs_archive_m9_ligado".
do $g$ begin
  if to_regclass('public.obs_archive_units') is null or to_regclass('public.obs_archive_switch') is null then
    raise exception 'm3b_recusa_sem_m3b' using errcode = 'P0001', hint = 'a migration da M3b (Tarefa 10) vem antes';
  end if;
end $g$;

-- Phil M1: volatile + lock share fecham a corrida do 1º plano (SHARE conflita com o ROW EXCLUSIVE do upsert do plano; dois purges não se bloqueiam).
-- A M9 Tarefa 2 tem de recriar o helper também volatile e com o lock.
create or replace function public.obs_archive_m9_pronto(p_site uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  lock table public.obs_archive_switch in share mode;
  -- "a M3b tocou o site" = unidade gravada OU switch com first_month_at/armed_at (monótonos, nascem antes da 1ª leitura). NÃO usar disarmed_at.
  if exists (select 1 from public.obs_archive_units x where x.site_id = p_site)
     or exists (select 1 from public.obs_archive_switch s where s.site_id = p_site
                 and (s.first_month_at is not null or s.armed_at is not null)) then
    raise exception 'm9_desligada' using errcode = 'P0001', hint = 'o apagar do arquivo ainda não está ligado; espere';
  end if;
end $$;
revoke all on function public.obs_archive_m9_pronto(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_m9_pronto(uuid) to service_role;  -- as funções da E9 são security invoker e rodam como service_role

-- Injeção única por texto, fail-closed: md5 do corpo conferido, âncora exatamente uma vez, marcador obs_archive_m9_pronto.
do $r$
declare r record; v_def text; v_md5 text; v_n integer; v_pos integer;
  c_txt constant text := 'perform public.obs_archive_m9_pronto(p_site);';
begin
  -- a âncora do vídeo é concatenada de propósito: a varredura saiu-varredura não deve tomar este texto por um delete
  for r in select * from (values
    ('competitor_video_purge', '8c6d51b2ae774671c2fa15c3e8d48535', 'delete from public.' || 'competitor_videos v where v.id = p_video;'),
    ('competitor_comments_purge', '2233c4edb3613594ed363ed68eb2378a', 'insert into public.competitor_removed_items as r')
  ) as t(nome, md5_esperado, ancora) loop
    select pg_get_functiondef(p.oid), md5(p.prosrc) into v_def, v_md5
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = r.nome;
    if v_def is null then raise exception 'm3b_recusa_sem_e9' using errcode = 'P0001', detail = r.nome; end if;
    continue when position('obs_archive_m9_pronto' in v_def) > 0;                       -- já injetada (reaplicação)
    if v_md5 <> r.md5_esperado then raise exception 'm3b_recusa_e9_mudou' using errcode = 'P0001', detail = r.nome || ' md5 ' || v_md5; end if;
    v_n := (length(v_def) - length(replace(v_def, r.ancora, ''))) / length(r.ancora);
    if v_n <> 1 then raise exception 'm3b_recusa_ancora' using errcode = 'P0001', detail = r.nome || ' n=' || v_n; end if;
    v_pos := position(r.ancora in v_def);
    v_def := left(v_def, v_pos - 1) || c_txt || E'\n  ' || substr(v_def, v_pos);
    execute v_def;
  end loop;
end $r$;
