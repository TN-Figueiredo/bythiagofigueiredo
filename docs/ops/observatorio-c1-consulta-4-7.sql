-- Observatório C1, spec 4.7: consulta de conferência da fonte única do "pode ler". Devolve ZERO linhas, sempre.
-- Qualquer linha é uma conexão cujo estado (liberação, conexão, chave, tokens) divergiu. O teste
-- apps/web/test/integration/c1-fonte-unica.test.ts lê ESTE arquivo.
select c.id from public.obs_ai_conexoes c
  join public.obs_ai_liberacoes b on b.id = c.liberacao_id
  join public.pipeline_api_keys k on k.id = c.key_id
where (k.revoked_at is null and (c.revoked_at is not null or b.revoked_at is not null or k.expires_at <> b.expires_at))
   or (k.revoked_at is not null and c.revoked_at is null)
   or exists (select 1 from public.obs_ai_oauth_tokens t
               where t.conexao_id = c.id and t.revoked_at is null and c.revoked_at is not null and t.tipo <> 'codigo');
