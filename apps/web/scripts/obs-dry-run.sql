-- Ensaio a seco da leitura dos concorrentes (§8.0). SÓ LEITURA: um select, nada é escrito.
-- Um arquivo por semana (4 arquivos de ~5 MB). Troque :ini e :fim (datas ISO, fim exclusivo) por sed e rode do diretório do repo linkado:
--   sed -e "s/:ini/2026-09-23/" -e "s/:fim/2026-09-30/" apps/web/scripts/obs-dry-run.sql > /tmp/obs-q1.sql
--   npx supabase db query --linked --agent=no -o json -f /tmp/obs-q1.sql > /tmp/obs-export-1.json
-- (sem --agent=no a CLI devolve o envelope de agente e o carregador lança "export ilegível")
-- Confira `wc -c` de cada arquivo (~5 MB) e as 3 últimas linhas. Depois:
--   cd apps/web && npx tsx --require ./scripts/_sem-server-only.cjs scripts/obs-dry-run.ts /tmp/obs-export-*.json
-- Formato colunar { colunas, linhas } (sem repetir as chaves por linha); só ids e títulos públicos.
select json_build_object(
  'colunas', json_build_array('yt','rodada_id','lida_em','http','erro','jogador_bloqueado','idioma','titulo_exibido','thumb_http','dhash','variante','largura','altura','publicado_em','canal','saiu_em','saiu_por','alvo_rodadas','ultima_rodada_em'),
  'linhas', coalesce(json_agg(json_build_array(t.yt,t.rodada_id,t.lida_em,t.http,t.erro,t.jogador_bloqueado,t.idioma,t.titulo_exibido,t.thumb_http,t.dhash,t.variante,t.largura,t.altura,t.publicado_em,t.canal,t.saiu_em,t.saiu_por,t.alvo_rodadas,t.ultima_rodada_em) order by t.yt, t.lida_em, t.id), '[]'::json)
)
from (
  select l.id, l.youtube_video_id as yt, l.rodada_id, l.lida_em, l.http, l.erro, l.jogador_bloqueado, l.idioma, l.titulo_exibido,
         th.http as thumb_http, th.dhash, th.variante, th.largura, th.altura,
         (select min(v.published_at) from public.competitor_videos v where v.video_id = l.youtube_video_id) as publicado_em,
         (select v.competitor_channel_id from public.competitor_videos v where v.video_id = l.youtube_video_id order by v.published_at limit 1) as canal,
         a.saiu_em, a.saiu_por, a.rodadas as alvo_rodadas, a.ultima_rodada_em
  from public.yt_watch_readings l
  join public.yt_watch_alvos a on a.site_id = l.site_id and a.youtube_video_id = l.youtube_video_id and a.tipo = 'concorrente'
  left join public.yt_watch_thumbs th on th.id = l.miniatura_id
  where l.lida_em >= ':ini' and l.lida_em < ':fim'
) t;
