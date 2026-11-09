-- Fecha a escrita anônima no bucket público `link-assets` (spec .superpowers/sdd/anon-views-expostas/spec.md §9).
-- As três policies de escrita tinham roles {public} e só conferiam bucket_id: qualquer pessoa com a anon key
-- subia, trocava e apagava arquivo servido publicamente. Nenhum código usa o bucket; o service role ignora RLS.
-- Mantém link_assets_public_read. Idempotente.
drop policy if exists link_assets_service_insert on storage.objects;
drop policy if exists link_assets_service_update on storage.objects;
drop policy if exists link_assets_service_delete on storage.objects;
