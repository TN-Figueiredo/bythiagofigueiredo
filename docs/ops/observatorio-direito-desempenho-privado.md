# O direito "ver desempenho privado" do Observatório (runbook do dono)

Estado: A2 (MG19) escrita e testada no banco local, **ainda não enviada**. Plano: `.superpowers/sdd/acesso-irma-ia/a2/plano.md`.
Os e-mails abaixo são marcadores: troque `<e-mail do dono>` e `<e-mail dela>` na hora de colar. Nenhum e-mail real fica neste arquivo.

## O que é

`site_private_viewers` guarda a concessão explícita do direito de ler o desempenho privado (as 12 tabelas privadas do canal próprio) a quem só lê o Observatório. Quem edita o site (`can_edit_site`) lê o privado sem concessão. A pessoa com papel `reporter` só alcança o Observatório (`/cms/youtube/competitors/*`) e lê o privado se houver linha em vigor (`revoked_at` nulo) e vínculo (`can_view_private_site_as`).

## Passo do dono (painel SQL do Supabase, produção, uma instrução por vez, só depois do código no ar)

Conceder primeiro (enquanto ela ainda é editora nada muda para ela) e trocar o papel depois, para não haver janela sem o privado. Substitua `<slug>` pelo slug do site.

**0. Conferir os dois ids (só leitura).** Esperado: dois valores preenchidos; se algum vier em branco, parar (e-mail errado).

```sql
select (select id from auth.users where email = '<e-mail do dono>') as quem_concede, (select id from auth.users where email = '<e-mail dela>') as ela;
```

**1. Conceder.** Esperado: uma linha com `granted_by` preenchido e `revoked_at` em branco. Zero linhas = a concessão já existia: rodar a conferência 3; se `privado = t` e `concedido_por` preenchido, seguir.

```sql
insert into public.site_private_viewers (site_id, user_id, granted_by) select m.site_id, m.user_id, (select id from auth.users where email = '<e-mail do dono>') from public.site_memberships m join auth.users u on u.id = m.user_id where u.email = '<e-mail dela>' and m.role = 'editor' and m.site_id = (select id from public.sites where slug = '<slug>') and (select id from auth.users where email = '<e-mail do dono>') is not null on conflict (site_id, user_id) do update set revoked_at = null, revoked_by = null, granted_by = excluded.granted_by, granted_at = now() where public.site_private_viewers.revoked_at is not null returning site_id, user_id, granted_at, granted_by, revoked_at;
```

**2. Trocar o papel.** Esperado: uma linha com `role = reporter` (zero linhas = e-mail errado ou ela já não era editora: parar).

```sql
update public.site_memberships set role = 'reporter' where user_id = (select id from auth.users where email = '<e-mail dela>') and role = 'editor' and site_id = (select id from public.sites where slug = '<slug>') returning site_id, user_id, role;
```

**3. Conferência.** Esperado, uma linha: `vinculo t · editar f · so_observatorio t · privado t`, com `concedido_por` = o e-mail do dono. (`can_view_observatorio` usa `auth.uid()` e dá `f` no painel, sem sessão: a prova dela é entrar.)

```sql
select s.name, public.can_view_site_as(u.id, s.id) as vinculo, public.can_edit_site_as(u.id, s.id) as editar, (public.can_view_site_as(u.id, s.id) and not public.can_edit_site_as(u.id, s.id)) as so_observatorio, public.can_view_private_site_as(u.id, s.id) as privado, (select g.email from public.site_private_viewers v left join auth.users g on g.id = v.granted_by where v.site_id = s.id and v.user_id = u.id and v.revoked_at is null) as concedido_por from public.site_memberships m join auth.users u on u.id = m.user_id join public.sites s on s.id = m.site_id where u.email = '<e-mail dela>';
```

**Depois da 1ª leitura dela pela chave:** só `ok` com `included_private = t`; nenhum `recusado`.

```sql
select result, included_private, count(*) from public.obs_ai_access_log where user_id = (select id from auth.users where email = '<e-mail dela>') and at > '<hora do passo 2>' group by 1, 2;
```

## Desfazer (do mais rápido ao mais lento)

1. Devolver o papel (instantâneo): `update public.site_memberships set role = 'editor' where user_id = (select id from auth.users where email = '<e-mail dela>') and role = 'reporter' returning site_id, role;`
2. Retirar a concessão: `update public.site_private_viewers set revoked_at = now(), revoked_by = (select id from auth.users where email = '<e-mail do dono>') where user_id = (select id from auth.users where email = '<e-mail dela>') and revoked_at is null returning site_id, user_id, revoked_at;`
3. Código e banco: seção 10 do plano da A2 (revert do código só junto com o desfazer 1; migration corretiva pelo SQL de `desfaz-apendice-a.sql`).

## Retenção, acesso e minimização (LGPD)

- **Retenção.** `site_private_viewers` nunca apaga linha retirada: só preenche `revoked_at`. `audit_log` guarda `to_jsonb` com os ids. Ambos somem por `on delete cascade` / fase 3 da LGPD se a conta dela for apagada.
- **Direito de acesso (art. 18).** Ela não lê o próprio `obs_ai_access_log` (a policy é `can_admin_site_users`): o pedido dela é atendido pelo dono.
- **Minimização (art. 6º, III).** Contatos, assinantes, inscrições de campanha, e-mails enviados e waitlists deixam de chegar a ela por tela e por banco (MG19 + porta de papel).
- **Achado fora da A2, fechado na S2.** `ad_revenue_daily`, `ad_inquiries` e `ad_campaigns` tinham policy de leitura `using (true)` para QUALQUER `authenticated`. A migration `20261109000003_fecha_leitura_authenticated_ad.sql` (ramo `fix/anon-views-0911`) as derruba; o push dela vem antes do da MG19 (`20261109000004`). Registro em `ABERTO_DE_PROPOSITO` de `a2-reporter-banco.test.ts`.
