set lock_timeout = '5s';
-- P4b, F9: caminho de volta do corte (NÃO vira migration; fica para emergência). O `falhou` original continua em
-- ab_test_restores, no seq anterior, então a volta é exata. Só campos `desistiu` com motivo `antes_da_nova_tentativa`.
update public.ab_tests t set
  restore_seq = t.restore_seq + 1,
  updated_at = now(),
  restore_status = (
    select jsonb_object_agg(k, case when v ->> 'estado' = 'desistiu' and v ->> 'motivo' = 'antes_da_nova_tentativa'
      then (v - 'motivo') || jsonb_build_object('estado', 'falhou')
      else v end)
    from jsonb_each(t.restore_status) as e(k, v)
  )
where t.restore_status is not null
  and (
    (t.restore_status -> 'title' ->> 'estado' = 'desistiu' and t.restore_status -> 'title' ->> 'motivo' = 'antes_da_nova_tentativa')
    or (t.restore_status -> 'thumbnail' ->> 'estado' = 'desistiu' and t.restore_status -> 'thumbnail' ->> 'motivo' = 'antes_da_nova_tentativa')
  )
  and coalesce(t.restore_status -> 'title' ->> 'estado', '') <> 'em_andamento'
  and coalesce(t.restore_status -> 'thumbnail' ->> 'estado', '') <> 'em_andamento';
