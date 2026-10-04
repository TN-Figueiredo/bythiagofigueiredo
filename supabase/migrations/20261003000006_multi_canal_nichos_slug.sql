-- =============================================================================
-- MIGRATION:
-- =============================================================================


-- Multi-canal: nicho vira dado (youtube_niches), cada canal próprio ganha um slug estável (saído do handle) e dois
-- canais do mesmo site podem ter o mesmo idioma. Substitui os CHECKs de nicho criados em 20261003000001/0004/0005.
-- Idempotente: rodar de novo não duplica nicho, não reescreve slug e não falha.
-- Compatível com o código anterior a ela: 'viagem' e 'ia' existem em todo site, e um insert sem slug recebe um.
-- A ORDEM IMPORTA: nichos semeados -> valores órfãos registrados -> CHECK vira FK -> slug preenchido -> slug
-- obrigatório e único -> só então cai a UNIQUE(site_id, locale).

-- 1. Nichos por site ---------------------------------------------------------------------------------------------
create table if not exists youtube_niches (
  site_id uuid not null references sites(id) on delete cascade,
  slug text not null,
  label text not null,
  color_dark text not null,
  color_light text not null,
  sort_order integer not null default 100,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (site_id, slug)
);

alter table youtube_niches drop constraint if exists youtube_niches_slug_check;
alter table youtube_niches add constraint youtube_niches_slug_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 24
    and slug not in ('todos', 'all', 'sem', 'none'));
alter table youtube_niches drop constraint if exists youtube_niches_label_check;
alter table youtube_niches add constraint youtube_niches_label_check
  check (char_length(btrim(label)) between 1 and 24);
-- Cores (escuro / claro). Os dois de fábrica mantêm as do Observatório, e só eles as usam. Nicho criado pelo dono
-- usa uma das QUATRO da paleta aprovada (ameixa, rosa, lima, ardósia); passando de quatro, as cores se repetem,
-- por isso não há unicidade de cor. Violeta, ciano, laranja e âmbar não são cor de nicho.
alter table youtube_niches drop constraint if exists youtube_niches_color_check;
alter table youtube_niches add constraint youtube_niches_color_check
  check (
    (slug = 'viagem' and upper(color_dark) = '#5BBF8A' and upper(color_light) = '#11692F')
    or (slug = 'ia' and upper(color_dark) = '#6EA8FE' and upper(color_light) = '#1D4ED8')
    or (upper(color_dark), upper(color_light)) in (
      ('#D29AE8', '#7B2A91'),  -- ameixa
      ('#F293C2', '#A3216B'),  -- rosa
      ('#B9CB62', '#55650B'),  -- lima
      ('#AAB4C0', '#4B5563')   -- ardósia
    )
  );
create unique index if not exists youtube_niches_site_label_key on youtube_niches (site_id, lower(label));

-- Leitura para quem enxerga o site; escrita só por service role (sem policy de escrita), como competitor_settings.
alter table youtube_niches enable row level security;
drop policy if exists "youtube_niches_select" on youtube_niches;
create policy "youtube_niches_select" on youtube_niches for select using (public.can_view_site(site_id));
drop trigger if exists set_youtube_niches_updated_at on youtube_niches;
create trigger set_youtube_niches_updated_at before update on youtube_niches
  for each row execute function public.tg_set_updated_at();

-- Os dois nichos de fábrica para todo site que existe…
insert into youtube_niches (site_id, slug, label, color_dark, color_light, sort_order)
select s.id, n.slug, n.label, n.cd, n.cl, n.ord
from sites s cross join (values ('viagem', 'Viagem', '#5BBF8A', '#11692F', 10), ('ia', 'IA', '#6EA8FE', '#1D4ED8', 20))
  as n(slug, label, cd, cl, ord)
on conflict (site_id, slug) do nothing;

-- …e para todo site criado depois.
create or replace function public.tg_seed_youtube_niches() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.youtube_niches (site_id, slug, label, color_dark, color_light, sort_order) values
    (new.id, 'viagem', 'Viagem', '#5BBF8A', '#11692F', 10),
    (new.id, 'ia', 'IA', '#6EA8FE', '#1D4ED8', 20)
  on conflict (site_id, slug) do nothing;
  return new;
end $$;
drop trigger if exists seed_youtube_niches on sites;
create trigger seed_youtube_niches after insert on sites
  for each row execute function public.tg_seed_youtube_niches();

-- Nenhum valor existente fica órfão. Os CHECKs antigos só deixavam 'viagem' e 'ia', então em produção isto não
-- insere nada; se aparecer outro valor (CHECK derrubado à mão, nova execução depois de uma FK removida), ele vira
-- nicho do site, com rótulo saído do slug e uma cor da paleta em ciclo. Um valor que não tem formato de slug não é
-- reescrito às escondidas: o CHECK de youtube_niches o recusa e a migration para aí, dizendo qual é.
-- competitor_user_prefs fica de fora: não é FK, e a aplicação volta a 'todos' quando o nicho salvo não existe.
with usados as (
  select site_id, niche as slug from youtube_channels where niche is not null
  union select site_id, niche from competitor_channels where niche is not null
  union select site_id, niche from competitor_readings where niche is not null
  union select site_id, target_niche from youtube_intelligence_tasks where target_niche is not null
), orfaos as (
  select u.site_id, u.slug, row_number() over (partition by u.site_id order by u.slug) as rn
  from usados u
  where not exists (select 1 from youtube_niches n where n.site_id = u.site_id and n.slug = u.slug)
)
insert into youtube_niches (site_id, slug, label, color_dark, color_light, sort_order)
select o.site_id, o.slug, initcap(replace(o.slug, '-', ' ')),
       (array['#D29AE8', '#F293C2', '#B9CB62', '#AAB4C0'])[((o.rn - 1) % 4) + 1],
       (array['#7B2A91', '#A3216B', '#55650B', '#4B5563'])[((o.rn - 1) % 4) + 1],
       100
from orfaos o
on conflict do nothing;

-- 2. Os CHECKs fixos ('viagem','ia') viram chave estrangeira. null continua valendo "sem nicho" (MATCH SIMPLE).
--    Nenhum índice nem constraint supõe um canal por nicho: vários canais podem apontar para o mesmo nicho.
--    Sem ON DELETE: um nicho em uso não pode ser apagado. Apagar o SITE continua funcionando (o nicho e quem o
--    usa caem juntos, e a checagem NO ACTION só roda no fim do comando).
alter table youtube_channels drop constraint if exists youtube_channels_niche_check;
alter table youtube_channels drop constraint if exists youtube_channels_niche_fkey;
alter table youtube_channels add constraint youtube_channels_niche_fkey
  foreign key (site_id, niche) references youtube_niches (site_id, slug);

alter table competitor_channels drop constraint if exists competitor_channels_niche_check;
alter table competitor_channels drop constraint if exists competitor_channels_niche_fkey;
alter table competitor_channels add constraint competitor_channels_niche_fkey
  foreign key (site_id, niche) references youtube_niches (site_id, slug);

alter table competitor_readings drop constraint if exists competitor_readings_niche_check;
alter table competitor_readings drop constraint if exists competitor_readings_niche_fkey;
alter table competitor_readings add constraint competitor_readings_niche_fkey
  foreign key (site_id, niche) references youtube_niches (site_id, slug);

alter table youtube_intelligence_tasks drop constraint if exists youtube_intelligence_tasks_target_check;
alter table youtube_intelligence_tasks add constraint youtube_intelligence_tasks_target_check
  check ((task_type = 'diagnostico' and channel_id is not null and target_niche is null and target_video_id is null)
      or (task_type <> 'diagnostico' and target_niche is not null
          and ((task_type = 'leitura-video') = (target_video_id is not null))));
alter table youtube_intelligence_tasks drop constraint if exists youtube_intelligence_tasks_target_niche_fkey;
alter table youtube_intelligence_tasks add constraint youtube_intelligence_tasks_target_niche_fkey
  foreign key (site_id, target_niche) references youtube_niches (site_id, slug);

-- A preferência do usuário guarda 'todos' ou um slug; não é FK porque 'todos' não é um nicho.
alter table competitor_user_prefs drop constraint if exists competitor_user_prefs_niche_check;
alter table competitor_user_prefs add constraint competitor_user_prefs_niche_check
  check (niche = 'todos' or (niche ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(niche) between 2 and 24));

-- 3. Slug estável por canal próprio (a forja e o Cowork usam este identificador) ---------------------------------
-- O slug sai do handle: minúsculas, sem acento, tudo que não é [a-z0-9] (o '@', espaço, ponto, sublinhado) vira
-- hífen, sem hífen nas pontas, no máximo 28 caracteres (sobra espaço para o sufixo). Handle que não rende ao menos
-- dois caracteres vira 'canal'. Nunca devolve null nem vazio.
create or replace function public.youtube_channel_slug_base(p_handle text) returns text
language sql immutable set search_path = '' as $$
  select case when char_length(s) >= 2 then s else 'canal' end
  from (
    select btrim(left(btrim(regexp_replace(
      translate(lower(coalesce(p_handle, '')),
        'áàâãäåÁÀÂÃÄÅçÇéèêëÉÈÊËíìîïÍÌÎÏñÑóòôõöÓÒÔÕÖúùûüÚÙÛÜýÿÝ',
        'aaaaaaaaaaaacceeeeeeeeiiiiiiiinnoooooooooouuuuuuuuyyy'),
      '[^a-z0-9]+', '-', 'g'), '-'), 28), '-') as s
  ) t
$$;

-- O slug livre para um handle dentro de um site: a base, ou base-2, base-3… na primeira colisão. Determinístico.
-- SECURITY DEFINER porque precisa enxergar todos os canais do site (a RLS esconderia uma colisão); por isso não
-- é executável por anon/authenticated — só o trigger abaixo e esta migration a chamam.
create or replace function public.youtube_channel_slug_pick(p_site_id uuid, p_handle text, p_exclude_id uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_base text := public.youtube_channel_slug_base(p_handle);
  v_slug text := v_base;
  v_n integer := 1;
begin
  while exists (select 1 from public.youtube_channels c
                where c.site_id = p_site_id and c.slug = v_slug
                  and (p_exclude_id is null or c.id <> p_exclude_id)) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end $$;
revoke all on function public.youtube_channel_slug_pick(uuid, text, uuid) from public, anon, authenticated;

alter table youtube_channels add column if not exists slug text;

-- Backfill ANTES de a coluna virar obrigatória e única, e ANTES de cair a UNIQUE de locale. Só toca canal sem
-- slug: a segunda execução não reescreve nada. Do mais antigo para o mais novo, então numa colisão de handle o
-- canal mais antigo fica com o slug limpo e o seguinte com -2.
do $$
declare r record;
begin
  for r in select id, site_id, handle from youtube_channels
           where slug is null or btrim(slug) = ''
           order by site_id, created_at, id loop
    update youtube_channels set slug = public.youtube_channel_slug_pick(r.site_id, r.handle, r.id) where id = r.id;
  end loop;
end $$;

-- Insert sem slug (o código anterior a esta migration não conhece a coluna) recebe um, do mesmo jeito do backfill.
-- O padrão '' é só a marca de "não informado": o trigger troca antes de o CHECK olhar. Slug informado é respeitado.
create or replace function public.tg_youtube_channels_slug() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    -- dois inserts simultâneos com o mesmo handle no mesmo site não escolhem o mesmo slug
    perform pg_advisory_xact_lock(hashtextextended('youtube_channels.slug:' || new.site_id::text, 0));
    new.slug := public.youtube_channel_slug_pick(new.site_id, new.handle, null);
  end if;
  return new;
end $$;
drop trigger if exists set_youtube_channels_slug on youtube_channels;
create trigger set_youtube_channels_slug before insert on youtube_channels
  for each row execute function public.tg_youtube_channels_slug();

alter table youtube_channels alter column slug set default '';
alter table youtube_channels alter column slug set not null;
alter table youtube_channels drop constraint if exists youtube_channels_slug_check;
alter table youtube_channels add constraint youtube_channels_slug_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 32);
create unique index if not exists youtube_channels_site_slug_key on youtube_channels (site_id, slug);

-- 4. Por último: dois canais do mesmo site podem ter o mesmo idioma. O CHECK locale in ('pt','en') fica, e a
--    UNIQUE(site_id, channel_id) também (o mesmo canal do YouTube não entra duas vezes no site).
alter table youtube_channels drop constraint if exists youtube_channels_site_id_locale_key;

comment on table youtube_niches is 'Nichos do YouTube por site (canais próprios e concorrentes). viagem e ia são os de fábrica. Um nicho pode ter vários canais.';
comment on column youtube_channels.slug is 'Identificador curto e estável do canal próprio, único por site, saído do handle. Usado pela forja e pelo Cowork.';
comment on column youtube_channels.niche is 'Nicho do canal próprio (slug de youtube_niches). null = sem nicho.';
