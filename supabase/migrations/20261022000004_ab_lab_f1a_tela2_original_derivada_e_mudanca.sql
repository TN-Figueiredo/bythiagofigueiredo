-- ab_lab_f1a_tela2_original_derivada_e_mudanca (F1a-tela-2, D-2): migration aditiva, só afrouxa.
--   (a) o CHECK ab_native_tests_variante_da_resposta aceita 'venceu_original' (variante_vencedora = 1) também na derivada
--       (variantes nulo); o ramo antigo exigia variantes is not null e estourava 23514 no toque "A (original) ficou".
--   (b) coluna resposta_mudada_em (D-4).
-- Ordem: F1a-dado em produção -> esta migration (db:push:prod, depois do portão) -> conferência de pg_get_constraintdef
--   e da coluna -> código que grava (envio A). Compatível com o código em produção (só aceita mais).
-- Idempotente: reaplicar não faz nada além do que já está feito.
set lock_timeout = '5s';

do $$
declare def text;
begin
  select pg_get_constraintdef(oid) into def from pg_constraint
   where conrelid = 'public.ab_native_tests'::regclass and conname = 'ab_native_tests_variante_da_resposta';
  -- Troca sempre que o ramo novo (venceu_original com variante 1, sem exigir variantes) não está lá: falta a constraint, tem o ramo
  -- antigo ou uma terceira forma. Só não mexe quando já está no formato novo.
  if def is null or def not ilike '%venceu_original''::text) AND (variante_vencedora = 1)%' then
    alter table public.ab_native_tests drop constraint if exists ab_native_tests_variante_da_resposta;
    alter table public.ab_native_tests add constraint ab_native_tests_variante_da_resposta
      check (variante_vencedora is null or (
        (resposta_dono = 'venceu_nova' and (
          (variantes is null and variante_vencedora between 1 and 3) or (variantes is not null and variante_vencedora between 2 and 3)))
        or (resposta_dono = 'venceu_original' and variante_vencedora = 1)));
  end if;
end $$;

alter table public.ab_native_tests add column if not exists resposta_mudada_em timestamptz;
