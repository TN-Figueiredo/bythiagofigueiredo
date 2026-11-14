-- Observatório C1, passo fixo P6: só os consentimentos (aprovar/negar) dos últimos 7 dias, SEM o limite de 200 da 4.3
-- (cada chamada de ferramenta grava uma linha; a aprovação de ontem sumiria da 4.3 numa conversa longa). Phil T24 I5.
-- Conferir: a linha é da pessoa certa (e-mail) e do cliente certo. `desfecho = aprovado` é o valor gravado (`result = ok`).
select l.at, u.email, l.result, l.params->>'desfecho' as desfecho, l.params->>'cliente' as cliente
  from public.obs_ai_access_log l
  left join auth.users u on u.id = l.user_id
 where l.origin = 'oauth' and l.action = 'consentimento' and l.at > now() - interval '7 days'
 order by l.at desc;
