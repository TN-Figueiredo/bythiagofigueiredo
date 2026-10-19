set lock_timeout = '5s';
-- P4b, 32 k (Y-11): campo em `falhou` anterior ao deploy vira `desistiu`/`antes_da_nova_tentativa`; a faixa da P4a
-- já pedia a correção manual. restore_seq + 1 invalida qualquer escritor em voo; o gatilho grava a linha do histórico.
update public.ab_tests t set
  restore_seq = t.restore_seq + 1,
  updated_at = now(),
  restore_status = (
    select jsonb_object_agg(k, case when v ->> 'estado' = 'falhou'
      then v || jsonb_build_object('estado', 'desistiu', 'motivo', 'antes_da_nova_tentativa')
      else v end)
    from jsonb_each(t.restore_status) as e(k, v)
  )
where t.restore_status is not null
  -- P-3: o vigia só lê status <> 'active'; um active com falhou é regravado pela próxima saída e não pode ganhar estado inédito
  and t.status <> 'active'
  and (t.restore_status -> 'title' ->> 'estado' = 'falhou' or t.restore_status -> 'thumbnail' ->> 'estado' = 'falhou')
  -- coalesce: campo ausente dá NULL e `not (... or NULL)` exclui a linha (achado na T6; o SQL do plano falhava com um campo só)
  -- S1 do Phil: linha com escrita em voo fica de fora (restore_seq + 1 perderia o resultado dela)
  and coalesce(t.restore_status -> 'title' ->> 'estado', '') <> 'em_andamento'
  and coalesce(t.restore_status -> 'thumbnail' ->> 'estado', '') <> 'em_andamento';
