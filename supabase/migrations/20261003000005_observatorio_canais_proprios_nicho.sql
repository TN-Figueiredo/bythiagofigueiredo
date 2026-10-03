-- =============================================================================
-- MIGRATION:
-- =============================================================================


-- Observatório — nicho por canal próprio (FU-15; absorve o FU-7). Idempotente. O único dado escrito é o nicho inicial
-- 'viagem' dos canais que já existem, e só na criação da coluna.
-- null = "sem nicho": o canal fica fora de "Você no nicho" e de Lacunas até o dono escolher na aba Canais.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'youtube_channels' and column_name = 'niche') then
    alter table youtube_channels add column niche text;
    -- decisão do dono (2026-10-03): os canais próprios que já existem começam em 'viagem'; ele muda na aba Canais.
    -- Só roda na criação da coluna: rodar a migration de novo não reescreve um "sem nicho" escolhido depois.
    update youtube_channels set niche = 'viagem';
  end if;
end $$;

alter table youtube_channels drop constraint if exists youtube_channels_niche_check;
alter table youtube_channels add constraint youtube_channels_niche_check
  check (niche is null or niche in ('viagem', 'ia'));

comment on column youtube_channels.niche is
  'Nicho do canal próprio no Observatório (viagem | ia). null = sem nicho.';
