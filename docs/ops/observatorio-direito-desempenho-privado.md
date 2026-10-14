# Observatório — o direito "ver desempenho privado" (runbook do dono)

Estado de 14/10/2026. Plano: `docs/superpowers/plans/2026-10-13-a5-e17-passo-0-direito-desempenho-privado-plan.md` (Apêndice C).
Papéis do CMS em geral: `docs/ops/papeis-e-limites-cms.md` (este arquivo não o altera).

## O que é

- Hoje só lê impressões, taxa de clique, retenção, origem das views e texto de comentário do canal próprio quem **edita** o site.
- O direito separa "ver" de "editar": uma pessoa com vínculo `reporter` no site e uma linha em vigor em `site_private_viewers` **vê** esses números e continua sem editar nada.
- A regra mora numa função só, `can_view_private_site(site_id)`: quem edita, ou quem tem **vínculo com o site E linha em vigor**. Sem uma das duas coisas, não lê.
- Conceder e retirar é SQL deste runbook, rodado por você (não há tela). Cada concessão e cada retirada grava uma linha em `audit_log`.

## NÃO conceder a ninguém antes do plano de fechamento

Hoje um login `reporter` alcança outras telas do CMS além do Observatório (inventário da Tarefa 10 do plano). O fechamento ("só o Observatório por enquanto", pergunta 37 do dono) é plano próprio, ainda sem código. Até ele estar em produção: **nenhuma concessão**. A tabela `site_private_viewers` tem de continuar vazia.

## Antes de começar: o seu e-mail

Os comandos gravam **quem concedeu** e **quem retirou** pelo e-mail do seu login. Onde estiver `EMAIL-DO-LOGIN-DO-DONO`, troque pelo e-mail com que você entra no CMS em produção. Confira antes (tem de dar `1`):

```sql
select count(*) from auth.users where email = 'EMAIL-DO-LOGIN-DO-DONO';
```

Se der `0`, o e-mail está errado e todo comando gravaria o autor em branco, sem erro. (Em 14/10 o e-mail `tnfigueiredotv@gmail.com` deu `0` em produção: **não é o do login**; o do login ainda não foi anotado.)

## Quem lê o quê depois da MG11

| Dado | Pela tela | Pelo banco, com sessão | Quem escreve |
|---|---|---|---|
| As doze tabelas privadas do canal próprio | quem edita, ou quem tem vínculo e concessão em vigor | `can_view_private_site(site_id)` | só a coleta (`service_role`) |
| Identidade do autor de comentário | só quem edita | `can_edit_site(site_id)` (não muda) | só `service_role` |
| Bruto da coleta e tentativas | ninguém | só quem edita, ou ninguém (não muda) | só `service_role` |
| `site_private_viewers` | ninguém | o administrador do site (todas as do site) e a própria pessoa (a dela) | você, pelos comandos abaixo |

## Comandos

Rode no editor de SQL do painel do Supabase, **um por vez**. Troque o slug do site e o e-mail dela. Se o painel não mostrar o resultado de uma escrita, **confira sempre por "quem tem o direito hoje"**, não pela contagem de linhas.

**Quem tem o direito hoje** (zero linhas = ninguém além de quem edita). Rode também logo depois de conceder e de retirar. `concedido_por` em branco numa linha em vigor, ou `retirado_por` em branco numa linha retirada, quer dizer que o seu e-mail foi digitado errado, ou que quem fez foi apagado (veja "Corrigir autor em branco").

```sql
select u.email, s.slug, v.granted_at, g.email as concedido_por, v.revoked_at, r.email as retirado_por from public.site_private_viewers v join auth.users u on u.id = v.user_id join public.sites s on s.id = v.site_id left join auth.users g on g.id = v.granted_by left join auth.users r on r.id = v.revoked_by order by 2, 1;
```

**Conceder.** Resultado esperado: uma linha devolvida, com `revoked_at` em branco. Nenhuma linha devolvida = ela já tinha o direito em vigor e nada mudou. Erro `null value in column "site_id"` = o slug não existe. Erro `null value in column "user_id"` = o e-mail dela não existe.

```sql
insert into public.site_private_viewers (site_id, user_id, granted_by) values ((select id from public.sites where slug = 'SLUG-DO-SITE'), (select id from auth.users where email = 'email-dela@exemplo.com'), (select id from auth.users where email = 'EMAIL-DO-LOGIN-DO-DONO')) on conflict (site_id, user_id) do update set revoked_at = null, revoked_by = null, granted_by = excluded.granted_by, granted_at = now() where public.site_private_viewers.revoked_at is not null returning user_id, granted_at, granted_by, revoked_at;
```

Depois de conceder, rode "quem tem o direito hoje" e leia `concedido_por`: tem de ser o seu e-mail.

**Retirar.** Resultado esperado: uma linha devolvida, com `revoked_at` preenchido. Nenhuma linha = ela não tinha o direito em vigor.

```sql
update public.site_private_viewers set revoked_at = now(), revoked_by = (select id from auth.users where email = 'EMAIL-DO-LOGIN-DO-DONO') where site_id = (select id from public.sites where slug = 'SLUG-DO-SITE') and user_id = (select id from auth.users where email = 'email-dela@exemplo.com') and revoked_at is null returning user_id, revoked_at, revoked_by;
```

Depois de retirar, rode "quem tem o direito hoje" e leia `retirado_por`: tem de ser o seu e-mail.

**Retirar de todos, de uma vez.** O resultado traz uma linha por pessoa que perdeu o direito; nenhuma linha = ninguém tinha.

```sql
update public.site_private_viewers set revoked_at = now(), revoked_by = (select id from auth.users where email = 'EMAIL-DO-LOGIN-DO-DONO') where revoked_at is null returning site_id, user_id, revoked_at, revoked_by;
```

**Corrigir autor em branco** (dois comandos, um por vez; só quando "quem tem o direito hoje" mostrar em branco uma concessão ou uma retirada que **você** fez). Nenhum dos dois toca `revoked_at`: não mudam quem lê e não gravam linha no histórico. Uma linha devolvida = corrigido; nenhuma linha = não havia branco para corrigir naquela pessoa (ou o seu e-mail continua errado).

> **Nunca conceder para consertar uma linha retirada.** Numa linha retirada, "retirar" não altera nada e "conceder" **devolve o direito** a quem você tinha tirado. Se quem concedeu ou retirou foi outra pessoa e ela foi apagada, o branco é o estado certo e não se mexe (o comando de corrigir gravaria o seu nome numa ação que não foi sua).

Quem concedeu:

```sql
update public.site_private_viewers set granted_by = (select id from auth.users where email = 'EMAIL-DO-LOGIN-DO-DONO') where site_id = (select id from public.sites where slug = 'SLUG-DO-SITE') and user_id = (select id from auth.users where email = 'email-dela@exemplo.com') and granted_by is null returning user_id, granted_by, revoked_at;
```

Quem retirou (só em linha já retirada):

```sql
update public.site_private_viewers set revoked_by = (select id from auth.users where email = 'EMAIL-DO-LOGIN-DO-DONO') where site_id = (select id from public.sites where slug = 'SLUG-DO-SITE') and user_id = (select id from auth.users where email = 'email-dela@exemplo.com') and revoked_at is not null and revoked_by is null returning user_id, revoked_by, revoked_at;
```

Se o seu e-mail estiver errado de novo neste comando, a subconsulta dá nulo, a coluna continua em branco e a linha volta "corrigida" com o autor vazio: por isso a conferência é sempre pela consulta "quem tem o direito hoje".

**Histórico de concessões e retiradas.** `concedido_por` e `retirado_por` ficam em branco se a pessoa foi apagada; o identificador gravado no rastro vem ao lado.

```sql
select a.created_at, a.action, u.email as para_quem, g.email as concedido_por, r.email as retirado_por, a.after_data->>'granted_by' as id_de_quem_concedeu, a.after_data->>'revoked_by' as id_de_quem_retirou from public.audit_log a left join auth.users u on u.id = a.resource_id left join auth.users g on g.id = (a.after_data->>'granted_by')::uuid left join auth.users r on r.id = (a.after_data->>'revoked_by')::uuid where a.resource_type = 'site_private_viewers' order by a.created_at;
```

**Conferir, depois de conceder, o que a regra responde para ela.** Esperado: `t, f, t` (vê o site, não edita, vê o desempenho privado).

```sql
select public.can_view_site_as(u.id, s.id) as ver, public.can_edit_site_as(u.id, s.id) as editar, public.can_view_private_site_as(u.id, s.id) as privado from auth.users u, public.sites s where u.email = 'email-dela@exemplo.com' and s.slug = 'SLUG-DO-SITE';
```

## O que acontece quando a pessoa sai do site

Tirar o vínculo dela em `site_memberships` corta o acesso **na hora**, mesmo com a linha de concessão em vigor: a regra exige as duas coisas. A linha de concessão fica; se ela voltar ao site, volta a ler sem novo comando. Para encerrar de vez, use "Retirar".

## O que acontece quando o usuário é apagado (LGPD)

Apagar o usuário em `auth.users` apaga a linha de concessão dele (cascata) e anula o id dele nos campos `granted_by` e `revoked_by` das outras linhas, no registro de acesso de IA e na chave por pessoa. Isso **não grava** linha nova em `audit_log`. As linhas que já estavam em `audit_log` guardam os ids no conteúdo, como as dos vínculos.

## Como foi provado

Roteiro de prova `apps/web/test/fixtures/sql/a5-e17-p0-prova.sql` (saída esperada em `a5-e17-p0-prova-saida.txt`) e os testes `apps/web/test/integration/observatorio-a5-e17-p0-*.test.ts`, no banco de integração local (`bythiago_int`, porta 54422), tudo em transação desfeita. Os comandos acima foram rodados desse jeito antes de virarem este arquivo.
