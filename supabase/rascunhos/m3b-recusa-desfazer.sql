-- Desfaz o m3b-recusa.sql. Rodar ANTES do m3b-desfazer.sql. Uso: psql -v ON_ERROR_STOP=1 -f (atômico: begin/commit, Phil M3).
begin;
do $d$
declare r record; v_def text; v_md5 text;
begin
  for r in select * from (values ('competitor_video_purge', '8c6d51b2ae774671c2fa15c3e8d48535'),
                                 ('competitor_comments_purge', '2233c4edb3613594ed363ed68eb2378a')) t(nome, md5_volta) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = r.nome;
    continue when position('obs_archive_m9_pronto' in v_def) = 0;
    if position('obs_archive_item_capture' in v_def) > 0 then   -- a M9 já entrou: este desfazer não serve, é o da M9
      raise exception 'm3b_recusa_desfazer_m9_presente' using errcode = 'P0001', detail = r.nome;
    end if;
    execute replace(v_def, 'perform public.obs_archive_m9_pronto(p_site);' || E'\n  ', '');
    select md5(p.prosrc) into v_md5 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = r.nome;
    if v_md5 <> r.md5_volta then raise exception 'm3b_recusa_desfazer_md5' using errcode = 'P0001', detail = r.nome || ' ' || v_md5; end if;
  end loop;
end $d$;
drop function if exists public.obs_archive_m9_pronto(uuid);
commit;
