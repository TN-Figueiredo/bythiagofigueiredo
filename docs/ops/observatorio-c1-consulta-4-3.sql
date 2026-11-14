-- Observatório C1, spec 4.3: consulta de conferência do registro (pessoa e cliente), últimos 7 dias. O cliente sai do NOME da chave
-- (`observatorio-oauth-<cliente>-…`), que nunca é apagada; a pessoa apagada fica sem e-mail e a chamada continua com o mesmo cliente.
-- Classes devolvidas: chatgpt, claude, chave, botao, consentimento:<cliente> (e sem_chave). O teste
-- apps/web/test/integration/c1-consulta-4-3.test.ts lê ESTE arquivo.
select l.at, u.email, l.action, l.result, l.params->>'desfecho' as desfecho,
       case when l.origin = 'botao' then 'botao'
            when l.origin = 'oauth' then 'consentimento:' || coalesce(l.params->>'cliente', '?')
            when l.key_id is null then 'sem_chave'
            when k.name like 'observatorio-oauth-%' then split_part(k.name, '-', 3)
            else 'chave' end as cliente
  from public.obs_ai_access_log l
  left join public.pipeline_api_keys k on k.id = l.key_id
  left join auth.users u on u.id = l.user_id
 where l.at > now() - interval '7 days' order by l.at desc limit 200;
