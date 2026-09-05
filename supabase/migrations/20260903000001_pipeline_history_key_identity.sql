-- =============================================================================
-- MIGRATION: pipeline_history_key_identity — attribute API-key writes in history
-- =============================================================================
-- Finding: public.content_pipeline_history.changed_by is a strict FK to
-- auth.users(id). Every write made via a pipeline_api_keys credential (Cowork/
-- MCP tools) has no auth.users session, so changed_by is always written NULL —
-- a leaked or misused API key leaves no reconstructible identity trail in the
-- audit history, only "someone, via API key, at this timestamp".
--
-- Fix: additive nullable column changed_by_key_id, FK to pipeline_api_keys(id),
-- populated by write paths when ServiceContext.source === 'api_key'
-- (ServiceContext.keyId, sourced from PipelineAuth.keyId / McpServiceContext.keyId,
-- both now populated from pipeline_api_keys.id in lib/pipeline/auth.ts and
-- lib/pipeline/mcp/auth.ts). changed_by and changed_by_key_id are mutually
-- exclusive in practice — session writes populate the former, key writes the
-- latter — but nothing here enforces that as a DB constraint, since a stricter
-- CHECK is out of scope for this pass.
--
-- Aditivo e nullable — sem backfill (identidade das linhas antigas, gravadas
-- antes desta coluna existir, e irrecuperavel: changed_by ja era NULL nelas e
-- nao ha outro campo que aponte para a chave usada).
-- =============================================================================

alter table public.content_pipeline_history
  add column if not exists changed_by_key_id uuid
    references public.pipeline_api_keys(id) on delete set null;

comment on column public.content_pipeline_history.changed_by_key_id is
  'pipeline_api_keys.id da chave que fez esta escrita, quando source = api_key. NULL para escrita por sessao ou linha antiga.';
