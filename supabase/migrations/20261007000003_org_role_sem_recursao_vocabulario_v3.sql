-- org_role sem recursão + vocabulário do RBAC v3 nos últimos lugares que ainda falavam 'owner'/'admin'.
--
-- O defeito (em produção até esta migration):
--   * `org_role(uuid)` rodava como o usuário (SECURITY INVOKER) e lia `organization_members`.
--   * As policies de `organization_members` chamam `org_role` ("members admin write") e
--     `is_org_staff` → `org_role` ("members self read").
--   => toda leitura da tabela por um usuário autenticado reavalia a policy, que chama a função,
--      que lê a tabela... "stack depth limit exceeded" (54001). Vale para `org_role`,
--      `is_org_staff`, `can_admin_site` e para QUALQUER comando em `organization_members`,
--      `organizations` (escrita), `sites` (escrita), `invitations` e `sent_emails` (leitura).
--   * Mesmo sem a recursão nada passaria: as comparações são com 'owner'/'admin'/'editor', e o
--     CHECK de `organization_members.role` só aceita 'org_admin' desde o RBAC v3.
--
-- O que muda de acesso (ninguém ganha nada além do que o papel já deveria ter):
--   1. org_role             → SECURITY DEFINER. Cada um continua lendo só o PRÓPRIO papel.
--   2. is_org_staff         → passa a valer `is_org_admin(org)` (org_admin da org, ou super_admin).
--                             Antes: sempre erro. Editor/reporter de SITE continuam `false` — eles
--                             vivem em `site_memberships`, não em `organization_members`.
--   3. "members admin write" (organization_members, ALL) → `is_org_admin(org_id)`.
--                             Ganha: org_admin da org e super_admin. Perde: ninguém (era inalcançável).
--   4. "invitations admin manage" (invitations, ALL)     → `is_org_admin(org_id)`. Idem.
--   Por tabela, sem mexer no texto da policy (efeito de 2):
--   5. "members self read"  → cada um lê a própria linha (como antes) e o org_admin lê as da org.
--   6. "orgs staff write"   → org_admin altera a própria organização.
--   7. "sites staff write" e "sent_emails staff read" (via can_admin_site) → org_admin da org
--                             do site, ou da org-mãe.
--   Editora de site, reporter e usuário sem vínculo: continuam sem nenhum desses acessos; a
--   diferença é que agora recebem "0 linhas"/42501 em vez de 54001.
--
-- Idempotente: create or replace + drop policy if exists. Assinaturas, retornos e grants preservados
-- (create or replace mantém o ACL existente).

create or replace function public.org_role(p_org_id uuid) returns text
    language sql stable security definer
    set search_path = ''
    as $$
  select m.role from public.organization_members m
  where m.org_id = p_org_id and m.user_id = (select auth.uid())
  limit 1
$$;

comment on function public.org_role(uuid) is
  'Papel do usuário logado na organização (hoje só ''org_admin'') ou null. SECURITY DEFINER: é chamada de dentro das policies de organization_members e não pode reavaliá-las.';

create or replace function public.is_org_staff(p_org_id uuid) returns boolean
    language sql stable
    set search_path = ''
    as $$
  select coalesce(public.is_org_admin(p_org_id), false)
$$;

comment on function public.is_org_staff(uuid) is
  'Nome legado; no RBAC v3 equivale a is_org_admin (org_admin da org ou super_admin). Editor/reporter de site NÃO são staff da organização.';

drop policy if exists "members admin write" on public.organization_members;
create policy "members admin write" on public.organization_members
  for all to authenticated
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

drop policy if exists "invitations admin manage" on public.invitations;
create policy "invitations admin manage" on public.invitations
  for all to authenticated
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));
