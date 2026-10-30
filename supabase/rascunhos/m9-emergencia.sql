-- M9: EMERGÊNCIA. NINGUÉM RODA ESTE ARQUIVO SEM O DONO PEDIR (escrita em produção).
--
-- Quando usar: o `db:push:prod` da migration 20261029000002 já correu e o CÓDIGO precisa voltar (rollback do deploy no Vercel) para uma versão
-- anterior à M9. Esse código lê `obs_archive_owner_pending` com `z.literal(1)`; a M9 passou a responder `versao 2` e o leitor antigo dá 500
-- (`obs:arquivo` falha e a peça 7 mostra "não medido"). Este arquivo recria a função como era na M3b (migration 20261025000002, PARTE 7,
-- idêntico em texto): `versao 1`, só `sem_comando`.
--
-- O que NÃO desfaz (de propósito): o resto da M9 fica. Os wrappers de `obs_archive_plan`, `obs_archive_b2_plan` e `obs_archive_removed_channel_list`
-- seguem compatíveis com o código antigo enquanto o interruptor estiver DESLIGADO (prefixos_ausentes = []). Por isso, ANTES de voltar o código:
--   1. `select public.obs_archive_m9_ligar('<site>', false);` se alguma vez ligou (interruptor desligado).
--   2. Rodar este arquivo.
-- Para voltar a ter a M9 depois: reaplicar a função `obs_archive_owner_pending` da migration 20261029000004 (corpo VIGENTE, com as chaves de espera por snapshot;
-- a parte 6 da 000002 é o corpo antigo e tiraria essas chaves), `create or replace`, e só então `select public.obs_archive_m9_ligar('<site>', true);`.
-- Caminho no repositório: supabase/rascunhos/m9-emergencia.sql (Phil I3, Yannis I6). Nunca em `supabase/migrations/`.
-- Teste (sem skipIf do arquivo, lê esta cópia): apps/web/test/integration/manutencao-m9-leitores-ts.test.ts (aplica a M9, roda este arquivo, o leitor v1 de origin/staging aceita).

create or replace function public.obs_archive_owner_pending(p_site uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_site  uuid := p_site;
  v_lista jsonb;
  v_itens jsonb;
begin
  if v_site is null then   -- o comando do Mac não sabe o site: o ÚNICO site que tem canal, remoção ou unidade arquivada no observatório, ou erro (nunca "lista vazia"). Phil I2: o hub é multi-site, linhas em `sites` não contam.
    -- Phil N2 (2ª rodada): o site vem de canal, de remoção ou de unidade arquivada: com todos os canais removidos, a pendência de um canal removido continua achando o site.
    if (select count(*) from (select c.site_id from public.competitor_channels c union select r.site_id from public.obs_archive_channel_removals r
                              union select u.site_id from public.obs_archive_units u) x) <> 1 then raise exception 'site_ambiguo' using errcode = 'P0001'; end if;
    select c.site_id into v_site from (select c0.site_id from public.competitor_channels c0 union select r.site_id from public.obs_archive_channel_removals r
                                       union select u.site_id from public.obs_archive_units u) c;
  end if;
  v_lista := public.obs_archive_removed_channel_list(v_site);   -- erro sobe (nunca lista vazia)
  if v_lista is null or jsonb_typeof(v_lista) <> 'array' then raise exception 'lista_de_remocao_ilegivel' using errcode = 'P0001'; end if;
  with canal as (
    select 'canal:' || (r->>'channel_ref') as item_id, 'canal'::text as kind,
           greatest((r->>'decided_at')::timestamptz, (r->>'reappeared_at')::timestamptz) as desde,
           nullif(r->>'channel_ref', '') as channel_ref, nullif(r->>'youtube_channel_id', '') as youtube_id
      from jsonb_array_elements(v_lista) r
     where r->>'estado' = 'pedido'
  ), item as (
    select 'item:' || i.id::text, i.kind, i.decided_at, i.competitor_channel_id::text, i.youtube_id
      from public.competitor_removed_items i
     where i.site_id = v_site and i.archive_pending and i.kind in ('video', 'comentario')
  ), tudo as (select * from canal union all select * from item)
  select coalesce(jsonb_agg(jsonb_build_object(
           'item_id', item_id, 'kind', kind, 'tempo', 'sem_comando', 'desde', desde, 'mes', null,
           'channel_ref', channel_ref, 'youtube_id', youtube_id, 'marcado_rodado_em', null,
           'apagar', '[]'::jsonb, 'b2_nomes', '[]'::jsonb) order by desde, item_id), '[]'::jsonb)
    into v_itens from tudo;
  return jsonb_build_object('versao', 1, 'lido_em', now(), 'total', jsonb_array_length(v_itens), 'itens', v_itens);
end $$;
revoke all on function public.obs_archive_owner_pending(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_owner_pending(uuid) to service_role, postgres;
