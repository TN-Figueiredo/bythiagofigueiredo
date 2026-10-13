# A5, ordem 9: E17, passo 0: o direito "ver desempenho privado" (plano de implementação)

Escrito em 13/10/2026. Spec: `docs/superpowers/specs/2026-10-12-observatorio-a5/07-forja-cowork-e-contexto-para-ia.md`, seção 8.1.4 (linhas 80 a 170), e `05-canal-proprio.md`, bloco PL (linhas 41 a 54); itens de aceite 169, 170, 191, 232 (metade), 236 (metade de banco), 237 e 239 (metade de banco); obrigações de plano OP-2, OP-7 e OP-16; riscos 31(a) e 39. Migration: **MG11** (lote C, segunda da fila).

**Objetivo, em três frases.** Separar "ver o desempenho privado do canal próprio" de "editar o site": hoje só lê impressões, taxa de clique, retenção e texto de comentário quem edita, e a irmã do dono precisa ver sem editar. A MG11 cria o direito (uma tabela de concessão, uma função de sessão que as policies chamam e cinco funções com o usuário por parâmetro), troca a policy de leitura das tabelas privadas que já existem e deixa prontas, sem uso, as peças de banco do degrau 2 (chave por pessoa, registro de acesso de IA, contador de taxa). No código, os leitores passam a pedir um token novo de leitura (`LeituraPrivadaDoSite`), que nasce para quem edita ou para quem tem o direito, e o token de edição continua sendo o único que autoriza escrita.

**Fica FORA deste plano.**
- **Criar o usuário da irmã e conceder o direito a ela.** As duas coisas esperam o item 237 (o inventário do que um `reporter` alcança) e o fechamento que a resposta do dono à pergunta 37 exige ("só o Observatório por enquanto"). O fechamento pede código e migration que não estão na MG11 nem em etapa numerada do spec: é plano próprio (pergunta 6 da seção 1). **(reconciliação 13/10: R5) Número reservado para essa migration: MG19. Não tem desenho nem SQL; só passa a existir com o plano de fechamento, e nada da A5 depende dela, salvo a criação do usuário e a primeira concessão.**
- **Tela de concessão.** Não há mockup, e o projeto não faz tela sem mockup aprovado. A concessão é SQL do runbook, rodado pelo dono (pergunta 1).
- **Degrau 1 e degrau 2 da E17:** o botão "Perguntar a uma IA", o servidor MCP do perfil, o comando `observatorio:acesso`, a variável `OBSERVATORIO_IA_EXTERNA`, o limite de taxa em código, a recusa de `observatorio_leitura` em `/api/pipeline/*`, a poda do registro de acesso. A MG11 só cria as tabelas e a função que eles vão usar.
- **O leitor de texto de comentário da E14** (não existe ainda): nasce depois deste plano, já pedindo `LeituraPrivadaDoSite`. O item 117 fica com ele.
- **Mudar as frases de tela "só quem edita o site vê…"** (20 ocorrências em 9 arquivos de `src`, e 32 arquivos de teste que as afirmam): é texto de UX e fica para o lote da criação do usuário (pergunta 2).
- Nenhuma rota em `apps/web/src/app/api/pipeline/`, nenhum cron, nenhuma variável de ambiente, nada em `vercel.json`, nada em `types/database.types.ts`.

---

## Estado deste plano (13/10/2026)

Ainda **não passou pelo portão** dos dois especialistas (dados e software). O que já foi feito para chegar aqui:

- O SQL do Apêndice A foi **rodado duas vezes seguidas dentro de `begin; … rollback;`** no banco local de integração (`bythiago_int`, porta 54422, Postgres 17.11, migrations até `20261012000003` mais tabelas dos lotes B e C que os testes de outras etapas deixaram aplicadas). A segunda aplicação não deu erro. O roteiro de prova (*emenda 1: D-I1 e S-I1*: o da rodada 0, que se perdeu; **não** o texto que está hoje no Apêndice B) foi rodado **quatro vezes** (duas com a primeira versão de `can_view_private_site_as`, duas com a versão final, mais barata): as quatro saídas são iguais entre si linha a linha, fora as linhas de tempo. Depois de cada rodada conferi que nada ficou gravado (`to_regclass('public.site_private_viewers')` nulo, zero usuário `@mg11.test`).
- **Nada foi lido em produção.** O estado de produção que este plano usa vem da conferência C0.7 (12/10) e do que o controlador informou no brief (MG13, MG1, MG2, MG2b, MG10, MG9 e MG8 aplicadas). As leituras que faltam estão na seção 0.2, cada uma com o comando e com o que muda conforme a resposta.
- **Não foi possível ler `node_modules/`** (o sandbox negou): a forma de `requireSiteScope` vem do uso no repositório (`_chrome/page-data.ts`, em `openObservatoryPage`, lê `access.ok`, `access.reason` e `access.user.id` com `mode: 'view'`). É a conferência P0.
- Nenhum código, teste ou arquivo de migration foi criado. Os arquivos usados na rodada estavam numa pasta temporária **compartilhada com outros agentes**. *(emenda 1: D-I1 e S-I1)* Conferido em 13/10, depois dos pareceres: o `mg11.sql` de lá sobreviveu e é igual ao Apêndice A da rodada 0 (`diff` vazio); a saída guardada sobreviveu (igual à que estava no Apêndice B, fora o nome do arquivo e uma linha de tempo); **o roteiro de prova se perdeu**: outro agente gravou por cima dele o roteiro de outra etapa, e foi esse texto errado que entrou no Apêndice B da rodada 0. O Apêndice B de agora é um roteiro **reescrito** a partir da saída guardada, e **ainda não foi rodado** (o brief desta rodada só permite ler o repositório).
- *(emenda 1: D-I1 e S-I1)* **O que vale como "rodado" depois da emenda 1.** Toda linha deste plano que diz "rodado" descreve a rodada de 13/10 com o SQL da rodada 0 e com o roteiro que se perdeu: tem saída guardada, mas hoje não tem roteiro que a reproduza. A emenda 1 mudou três coisas no Apêndice A (o gatilho passa a `after insert or update of revoked_at`; a coluna `revoked_by`; o índice dela) e cinco comandos no Apêndice C (conceder, retirar, retirar de todos e as duas consultas): **nada disso foi rodado**. **Conferência pendente, do controlador, com o banco de integração livre** (nenhum outro teste de integração rodando): gravar os Apêndices A e B nos dois arquivos da Tarefa 1 e rodar o comando do passo 2 dela duas vezes. Se a saída for a do Apêndice B, as afirmações "rodado" voltam a valer e passam a ser reproduzíveis. Se um **valor** vier diferente (matriz, contagem, código de erro), não se ajusta o roteiro até bater: a diferença volta a este plano como emenda. *(emenda 2: S-n1)* A Tarefa 1b não começa sem isso. **O acordo dos especialistas nas rodadas de revisão é sobre o plano** (desenho, tarefas, ordem, testes e o texto dos apêndices); **a MG11 só vai ao dono (decisão 45a) depois de os dois especialistas verem a saída da Tarefa 1, passo 2, igual à do Apêndice B.** Acordo sobre o plano não libera a migration.
- *(emenda 2: D-N1, D-m-g, S-n6)* **O que a emenda 2 acrescentou e também nunca rodou:** no Apêndice A, o `check` `site_private_viewers_revoked_by_so_retirada`; no Apêndice B, o bloco "corrigir autor em branco" (cinco linhas novas na saída esperada, contando o título do bloco); no Apêndice C, o sexto comando ("corrigir autor em branco"), o `returning` nas instruções de escrita e os e-mails no histórico. Entram na mesma rodada pendente do controlador; o momento barato de rodá-la é entre esta emenda e a rodada 3.
- *(emenda 1: S-I2)* **Todo commit desta etapa viaja no próximo push de qualquer trilha** (o ramo local é o mesmo de todas, e a CI roda a pasta `test/integration/` inteira com banco, como portão duro: `.github/workflows/ci.yml`, job "Integration (DB-gated)"). Por isso cada commit daqui tem de ficar verde na CI sozinho, com a MG11 ainda sem arquivo em `supabase/migrations/`. É o que mudou o lugar do SQL de ensaio (Tarefa 1) e as regras das listas das Tarefas 3, 4 e 10 B.

**O que pode começar JÁ**, sem esperar migration, A4 nem resposta do dono: as Tarefas **0a** (leituras em produção, do controlador), **0b**, **1** (SQL de ensaio no repositório e os testes de schema), **2**, **3**, **4** (testes de banco, que aplicam o SQL de ensaio numa transação desfeita), **7** (teste das ações, que não toca código de produção), **9** (runbook) e a parte A da **10** (inventário por leitura de código). Esperam a **A4 fechada e liberada pelo controlador** (a zona `lib/youtube/observatorio/proprio/**`, `app/cms/(authed)/youtube/competitors/**`, `e2e/**` e `test/youtube/observatorio/proprio-*` é dela): as Tarefas **5** e **6**. Esperam o arquivo da migration (a vez do lote C): a **1b**, a **8** e as partes B e C da **10**. A **11** é o envio.

---

## 0. Dependências duras (ler antes de tudo)

### 0.1 O que este plano usa do que já existe (conferido no código local e no banco local)

| O que uso | Forma exata | Onde uso |
|---|---|---|
| `public.can_edit_site(uuid)`, `can_view_site(uuid)`, `can_admin_site_users(uuid)`, `is_super_admin()`, `is_org_admin(uuid)` | `LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'`; leem `auth.uid()`; nenhuma lê o GUC `app.site_id` (`supabase/migrations/20260507000001_schema.sql:3751-3785, 4283-4332`). Executáveis por `anon`, `authenticated` e `service_role` (C0.7) | as cinco funções `_as` são o espelho delas com `p_user`; a MG11 **não as altera** |
| `public.site_memberships` | `role` só admite `'editor'` e `'reporter'`; `user_id` com `on delete cascade` para `auth.users` | o vínculo que o direito exige |
| `public.organizations` | índice único `organizations_single_master` (só uma organização com `parent_org_id` nulo): achado ao rodar a prova | o roteiro de prova usa a organização raiz que já existe |
| As policies `<tabela>_select` das tabelas privadas | uma por tabela, `for select`, papel `public`, `using (public.can_edit_site(site_id))` (C0.7 para as 3 de produção; o bloco PL para as outras) | o laço da seção 3 do Apêndice A as troca |
| `public.pipeline_api_keys` | `id uuid`, `permissions text[] not null default '{}'`, **sem** `check` em `permissions`, sem `user_id` nem `expires_at`; o código lê por lista de colunas (`lib/pipeline/auth.ts:86`, `lib/pipeline/mcp/auth.ts:53`), nunca `select *` | duas colunas novas e um `check` |
| `public.audit_log` | 12 colunas (`actor_user_id`, `action`, `resource_type`, `resource_id`, `org_id`, `site_id`, `before_data`, `after_data`, `ip`, `user_agent`, `created_at`, `id`); `site_id` e `org_id` com chave estrangeira **sem** `on delete`; a policy de leitura exige `org_id` preenchido | o rastro de concessão e retirada |
| `EdicaoDoSite`, `provarEdicao`, `edicaoValida` | `apps/web/src/lib/youtube/observatorio/proprio/edicao.ts` (só local; não está em `origin/staging`) | o token novo nasce dele quando a pessoa edita; **o arquivo não muda** |
| `requireSiteScope({ area: 'cms', siteId, mode: 'view' })` | devolve `{ ok, reason, user: { id } }` (uso em `_chrome/page-data.ts`, `openObservatoryPage` e `openChannelPage`) | a sessão e o id de quem pede, antes da conferência do direito |

**Três dependências que não são de arquivo:**
1. **A A4 em `staging`.** O token de edição e os leitores só existem no HEAD local. As Tarefas 5 e 6 escrevem em cima deles, na zona reservada da A4: só começam quando o controlador avisar que a A4 está fechada e que não há trabalho dela sem commit nos arquivos da lista (hoje há, **e dentro da lista**: relido em 13/10 depois dos pareceres, `git status` mostra modificados e sem commit `_proprio/dados.ts` e `lib/youtube/observatorio/proprio/ler.ts`, que a Tarefa 6 edita, mais outros arquivos de `_proprio/`, de `_canal/` e de `lib/youtube/observatorio/proprio/`, e dois testes novos, `proprio-portao-dados-ler.test.ts` e `proprio-portao-dados-modelos.test.ts`. A frase da rodada 0, "nenhum deles está na lista", deixou de ser verdade *(emenda 1: releitura do autor)*. A regra continua sendo a liberação explícita).
2. **A vez do lote C** para o arquivo da migration: o carimbo da MG11 tem de ser posterior ao da MG14 ~~e anterior ao da MG5~~. (reconciliação 13/10, emenda 2: D2-m1) Com o lote C partido, MG14, MG5 e MG7 (o C1) já estão em produção quando a MG11 nasce: o carimbo dela é posterior ao das três. "Anterior ao da MG5" ficou impossível e não é mais condição.
3. **Nenhuma linha em `site_private_viewers` em produção antes do fechamento do CMS para `reporter`.** A MG11 aplicada sem linha não muda quem lê o quê.

### 0.2 Conferências pendentes (o controlador roda; produção só leitura)

Nenhuma trava o começo das tarefas que podem começar já. Todas travam a **Tarefa 1b** (criar o arquivo da migration), menos a P13, que trava a Tarefa 8, e a P14, que trava o fechamento da Tarefa 9 *(emenda 1: P11 a P13 são novas; P11 e P13 são locais, P12 tem uma metade em produção. Emenda 2: D-N1: a P14 é nova e é de produção)*. Comando: `npx supabase db query --linked "<consulta>"`. O resultado vai para `.superpowers/sdd/a5/conferencias-c0-resultado.md`, numa seção "C0.7b (E17 passo 0)".

| Nº | Consulta | Esperado | O que muda se vier diferente |
|---|---|---|---|
| P0 (local, não é produção) | `grep -n "mode\|reason\|user" node_modules/@tn-figueiredo/auth-nextjs/dist/server/*.d.ts` | `mode: 'view' \| 'edit'`; retorno com `ok`, `reason`, `user.id` | se houver outra forma de retorno, a Tarefa 5 ajusta só a leitura de `guarda.user.id`; o desenho não muda |
| P1 | `select version from supabase_migrations.schema_migrations order by version desc limit 6;` | a mais nova é `20261013000003` (MG8) | se a MG8 não estiver aplicada, a MG11 troca 3 tabelas em produção em vez de 5 (o laço já trata: pula a que não existe); o carimbo da MG11 só precisa ser posterior ao último aplicado |
| P2 | `select tablename, policyname, cmd, roles, qual from pg_policies where schemaname='public' and tablename in ('yt_own_video_daily','yt_own_video_reach_daily','yt_own_video_meta_daily','yt_own_video_coverage','yt_own_video_retention','yt_own_video_dim_daily','yt_own_video_traffic_detail_daily','yt_own_video_reach_dim_daily','yt_own_video_versions','yt_own_versions_state','competitor_video_comments','competitor_video_comment_marks','competitor_video_comment_authors','competitor_video_comment_snaps','competitor_raw','yt_reporting_reports','yt_reporting_jobs','yt_reporting_report_blobs','yt_own_collection_attempts','yt_own_collection_runs','yt_own_public_video_hourly','yt_own_public_video_early','yt_own_public_hour_map','yt_own_public_hour_fold_log') order by 1, 2;` | para cada tabela da lista das doze que existe: **uma** linha, `policyname = <tabela>_select`, `cmd = SELECT`, `qual = can_edit_site(site_id)` | policy com outro nome numa das doze: **a MG11 recusa** (a guarda do laço lança "tem policy fora do padrão") e não aplica nada. Antes de criar o arquivo, o plano ganha uma linha `drop policy if exists "<nome real>"` naquela tabela e o roteiro é rodado de novo |
| P3 | as quatro consultas da Tarefa 10, parte B (lista de policies de leitura; tabelas sem RLS; tabelas com RLS e sem policy; e, *emenda 1: D-I2 e S-I6*, funções executáveis por `authenticated` ou por `anon`) | não há esperado: é o inventário | vai ao dono com a pergunta 37 já respondida ("só o Observatório"); decide o tamanho do plano de fechamento. **Não muda a MG11** |
| P4 | `select column_name, data_type from information_schema.columns where table_schema='public' and table_name='pipeline_api_keys' order by ordinal_position;` e `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.pipeline_api_keys'::regclass;` e `select count(*) from public.pipeline_api_keys where 'observatorio_leitura' = any(permissions);` | 9 colunas, sem `user_id` nem `expires_at`; três constraints (`_pkey`, `_site_id_fkey`, `_created_by_fkey`); `0` | já existe `check` em `permissions`: a MG11 passa a recriá-lo com `observatorio_leitura` incluída. A contagem maior que 0 com permissão misturada faria o `check` novo falhar: parar e levar ao dono (seria uma chave criada fora do processo) |
| P5 | `select to_regclass('public.site_private_viewers'), to_regclass('public.obs_ai_access_log'), to_regclass('public.obs_ai_rate'), to_regprocedure('public.can_view_private_site(uuid)'), to_regprocedure('public.can_view_site_as(uuid,uuid)'), to_regprocedure('public.can_edit_site_as(uuid,uuid)'), to_regprocedure('public.can_view_private_site_as(uuid,uuid)'), to_regprocedure('public.is_super_admin_as(uuid)'), to_regprocedure('public.is_org_admin_as(uuid,uuid)'), to_regprocedure('public.obs_ai_rate_hit(uuid,timestamp with time zone)'), to_regprocedure('public.tg_site_private_viewers_audit()');` | onze nulos | algum já existe: parar. `create or replace` não troca nome de parâmetro nem tipo de retorno, e uma tabela homônima com outra forma faria o `create table if not exists` passar em silêncio com a forma errada |
| P6 | `select defaclrole::regrole, defaclnamespace::regnamespace, defaclobjtype, defaclacl from pg_default_acl where defaclnamespace = 'public'::regnamespace;` | igual ao local: função criada por `postgres` em `public` nasce com `execute` para `anon` e `authenticated` | nada muda no SQL (o `revoke` explícito já está lá); confirma que ele é **obrigatório**, não enfeite |
| P7 | `select role, count(*) from public.site_memberships group by role;` e `select count(*) from public.organization_members where role = 'org_admin';` | `editor` 1; `org_admin` 1; nenhum `reporter` | existe `reporter`: ele continua sem ler nada privado (não tem linha de concessão), mas o inventário da Tarefa 10 passa a ser urgente, porque já descreve um login real |
| P8 | `select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'lgpd_phase%';` | a fase 3 apaga a linha de `auth.users` | se a fase 3 **não** apaga `auth.users` (só anonimiza), as chaves estrangeiras da MG11 não disparam e a limpeza LGPD precisa de três linhas próprias (apagar de `site_private_viewers`, anular `obs_ai_access_log.user_id` e `pipeline_api_keys.user_id`): vira item do plano de fechamento, **antes** de existir a primeira linha de concessão |
| P9 | `select column_name \|\| ':' \|\| data_type from information_schema.columns where table_schema='public' and table_name='audit_log' order by ordinal_position;` | as 12 colunas de 0.1 | coluna obrigatória a mais: o gatilho da seção 4 do Apêndice A ganha a coluna, e o roteiro é rodado de novo |
| P10 | `select p.proname, md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('is_super_admin','is_org_admin','can_view_site','can_edit_site','can_admin_site_users') order by 1;` | `can_admin_site_users` `9033e7ad6b4de34b6ff9e49819326ae1`; `can_edit_site` `6d6c32924fcc665d2ccfd8fc6d91142f`; `can_view_site` `df45c50ea5227460e94f6f36fd89f020`; `is_org_admin` `1f3abb7a269da195958a610a504e3d92`; `is_super_admin` `7115a5fbae7c81e990e431cad6fac7e7` (medidos no banco local) | md5 diferente: o corpo de produção não é o que as `_as` espelham. Parar, ler o corpo real (`pg_get_functiondef`) e refazer o espelho antes de criar o arquivo |
| P11 (local, não é produção) *(emenda 1: D-m7)* | A CLI do Supabase aplica cada arquivo de migration numa transação só? Numa **pasta temporária fora do repositório** (`npx supabase@2.98.2 init`), com uma migration de duas instruções, `create table public._atomica (x int);` e `select 1/0;`: `npx supabase@2.98.2 db reset --local` e depois `select to_regclass('public._atomica');`. O plano não sabe se `db push` usa o mesmo caminho de aplicação que `db reset`: se a documentação da versão disser que não, repetir com `db push` contra esse banco descartável. *(emenda 2: D-m-e e S-n4)* **Como está acima a receita não roda:** `db reset --local` exige a pilha daquele projeto de pé, e uma terceira pilha disputa as portas das duas que já rodam (54321/54322 do navegador e 54421/54422 da integração). Antes de `npx supabase@2.98.2 start`, editar o `supabase/config.toml` da pasta temporária: `project_id` próprio (por exemplo `mg11_p11`) e portas livres em todas as seções que tiverem porta (por exemplo a faixa 54521 a 54529; API em 54521, banco em 54522). No fim, `npx supabase@2.98.2 stop --no-backup` na mesma pasta. Se subir a terceira pilha não for possível no dia, a P11 fica **sem resposta** (não vira "sim"), e o plano segue pelo caso mais fraco, "pode ficar aplicada em parte; repetir converge" | nulo (a primeira instrução foi desfeita junto) | não nulo: as frases "nada fica aplicado" das seções 2 e 6 viram "pode ficar aplicada em parte; repetir converge". O SQL não muda: a troca das policies é um bloco `do` só (atômica para as doze juntas) e o arquivo inteiro é idempotente |
| P12 *(emenda 1: D-m4)* | `select jobname, schedule, active from cron.job order by 1;` e, local, `grep -n "agenda" apps/web/vercel.json` (hoje, local: nenhuma linha) | nenhum cron que escreva em `competitor_video_comments` nem em `competitor_video_comment_marks` (o lote B, que traz o despachante da agenda, ainda é só local) | existe: a janela do `db:push:prod` passa a excluir também o minuto em que ele roda |
| P13 (local) *(emenda 1: S-m5)* | `npx supabase migration up --help` e a seção de banco de `docs/ops/runbook-cms-e2e-local.md` (que hoje só cita `db:start` e `db:reset`, linha 16) | existe um comando que aplica só a migration pendente no banco do navegador, sem `db:reset` | não existe: a Tarefa 8 espera um momento em que o controlador possa fazer `db:reset` sem apagar o estado das outras trilhas |
| P14 *(emenda 2: D-N1)* | `select count(*) from auth.users where email = 'tnfigueiredotv@gmail.com';` (o e-mail que o Apêndice C escreve como "quem concede e quem retira" é o do login do dono em produção? **Não foi medido**) | `1` | `0`: toda instrução de conceder e de retirar gravaria o autor em branco, sem erro. O Apêndice C e o runbook passam a levar o e-mail real do login do dono (o controlador pergunta a ele qual é e repete a contagem com esse e-mail até dar `1`); o roteiro do Apêndice B não muda (usa `dono@mg11.test`). Trava o "Pronto quando" da Tarefa 9, não a 1b |

### 0.3 Avisos de topo
- **Nenhuma rota nova de pipeline.** Nada a registrar em `api-registry.ts` nem em `apps/web/data/pipeline-docs/`.
- **Nenhum cron e nenhuma variável.** Não há interruptor: o que fecha o direito é a ausência de linha em vigor em `site_private_viewers`.
- **A migration só vai ao dono depois do acordo dos dois especialistas** sobre este plano (decisão 45a), e ela vai **completa** (com as peças do degrau 2), porque ele não quer rodar e ter de alterar.
- **O arquivo da MG11 não é criado antes da vez do lote C.** O `db:new` carimba pela hora; um arquivo criado cedo entraria no próximo `db:push:prod` de outro lote. Até lá o SQL vive no Apêndice A e em `apps/web/test/fixtures/sql/a5-e17-p0-mg11.sql` (Tarefa 1). *(emenda 1: S-I2)* O caminho é versionado de propósito: `.superpowers/` é ignorado pelo git (`.gitignore:62`) e a CI não o enxerga.
- **Regra do Postgres local:** chamar função sem `EXECUTE` como `anon` ou `authenticated` derruba o servidor. As cinco funções `_as`, `obs_ai_rate_hit` e a função do gatilho são conferidas pelo **catálogo** (`has_function_privilege`), nunca chamadas por esses papéis. Todo teste de banco deste plano roda só no `bythiago_int` (54421/54422), nunca no 54321/54322.
- **Tudo o que este plano avisa ao dono é texto de tela ou evento no Sentry.** Não há cron para ficar vermelho; a seção 6 diz, falha por falha, o que aparece e onde.
- **`apps/web/.env.local` aponta para produção.** Nenhuma tarefa roda script que o carregue.

---

## 1. Perguntas que só o dono responde

Nenhuma trava o início. Cada uma tem a recomendação e o padrão que vale se ele não responder (decisão 44).

1. **Como você concede e retira o direito?** O spec diz "ação de servidor" e não prevê tela, comando nem mockup. Recomendo o SQL do runbook (Apêndice C), que você cola no painel do Supabase: uma instrução para conceder e uma para retirar, presas ao e-mail da pessoa e ao site, com o resultado esperado "1 linha". **Padrão:** SQL do runbook; nenhuma ação de servidor é criada (uma ação exportada sem tela que a chame seria só superfície de ataque). **Trava:** nada neste plano; a concessão à sua irmã.
2. **As telas dizem "só quem edita o site vê…". Para quem tem o direito sem editar, a regra escrita fica incompleta.** Quem tem o direito vê os números e nunca lê a frase; quem lê a frase é quem não edita **e** não tem o direito, e para essa pessoa a frase continua verdadeira no efeito (ela não vê) e incompleta na regra. Recomendo trocar para "só quem edita o site ou tem permissão de ver o desempenho vê…" no lote da criação do usuário, com o revisor de UX, porque são 20 frases em 9 arquivos e 32 arquivos de teste que as afirmam. **Padrão:** as frases não mudam neste plano. **Trava:** nada.
3. **O direito exige vínculo com o site, além da linha de concessão?** O spec escreve "quem edita **ou** tem o direito concedido". Recomendo exigir as duas coisas para quem não edita (vínculo em `site_memberships` **e** linha em vigor): tirar a pessoa do site corta a leitura no mesmo instante, na tela e no banco, sem depender de alguém lembrar de retirar o direito. **Padrão:** sim, as duas (é o que o Apêndice A faz; desvio 3 da seção 8). **Trava:** nada.
4. **A sua irmã pode salvar a própria preferência de nicho?** O item 170 diz "toda ação que escreve recusa", e `setUserNiche` grava a preferência de quem está logado com a guarda de leitura (um `reporter` já a usa hoje). Recomendo manter: ela só altera a linha dela em `competitor_user_prefs`. **Padrão:** exceção declarada e escrita no teste, com o motivo. **Trava:** nada.
5. **A MG11 leva junto três peças que ninguém usa até o degrau 2** (duas colunas em `pipeline_api_keys`, o registro de acesso de IA e o contador de taxa). O spec manda assim, e a sua regra de rodar migration uma vez só também. **Padrão:** vão juntas. **Trava:** nada.
6. **Você respondeu "só o Observatório por enquanto" (pergunta 37), e fechar o resto do CMS para `reporter` não está em nenhuma etapa do spec.** São 37 arquivos com `mode: 'view'` e, no banco local, 85 tabelas com policy de leitura por `can_view_site`. Recomendo um plano próprio ("fechamento do CMS para leitura"), escrito depois de você ver o inventário da Tarefa 10. **Padrão:** o usuário dela **não é criado** e **nenhuma linha** é posta em `site_private_viewers` até esse plano estar em produção. **Trava:** a criação do usuário e a concessão, não a MG11 nem o código deste plano.
7. **Cada concessão e cada retirada deixa uma linha no `audit_log`** (para quem, quando, antes e depois), por gatilho do banco. Sem isso, conceder de novo a quem já teve o direito apagaria a data da concessão anterior. *(emenda 1: D-m2)* **O "quem" não vem do `audit_log`:** no editor de SQL do painel não há sessão, então `actor_user_id` fica sempre nulo. Quem concedeu fica em `granted_by` e quem retirou fica em **`revoked_by`**, coluna que a emenda 1 acrescentou para a retirada não ficar sem autor; as duas aparecem no "antes e depois" do rastro. Se o seu e-mail for digitado errado na instrução, a coluna entra em branco sem erro: por isso o runbook manda rodar a consulta "quem tem o direito hoje" logo depois. *(emenda 2: D-N1)* A emenda 1 dizia que em branco queria dizer "retirar e conceder de novo": **isso estava errado e saiu.** Numa linha retirada, "retirar" não altera nada (ela já está retirada) e "conceder" devolve o direito a quem você tinha tirado, sem nada ficar vermelho. Em branco agora quer dizer: rodar o comando "corrigir autor em branco" do Apêndice C, que só preenche o autor e não muda quem lê. **Nunca conceder para consertar uma linha retirada.** Se quem concedeu ou retirou foi outra pessoa e ela foi apagada, o branco é o estado certo e não se mexe. **Padrão:** sim, com as duas colunas. **Trava:** nada.
8. *(emenda 1: S-I4)* **Botões de edição aparecem, nas telas de concorrentes, para quem só lê.** Conferido no código em 13/10: as duas telas privadas (canal próprio e vídeo próprio) não recebem nenhuma ação de escrita. Nas outras telas do Observatório, "Fixar vídeo", "Sincronizar só este canal", pedir e cancelar leitura da forja e salvar uma mudança são mostrados a qualquer pessoa com leitura (a `reporter` de hoje já os vê) e a ação recusa no servidor; só o que depende de administrar o site está escondido. O item 170 pede "nenhum controle de edição" nas **telas privadas**, e isso este plano prova. Esconder os das outras telas muda tela e pede mockup. Recomendo esconder, no mesmo lote de UX das frases (pergunta 2), antes de o usuário da sua irmã existir. **Padrão:** neste plano os botões ficam como estão; o teste de navegador os lista pelo nome e prova que clicar não altera nada; esconder entra como condição do plano de fechamento. **Trava:** nada aqui; a criação do usuário dela.

---

## 2. O que é do dono

**Duas coisas, em momentos diferentes.** (a) Aplicar o lote C, do qual a MG11 é ~~a segunda migration~~ (reconciliação 13/10, emenda 2: D2-m1) a primeira do lote C2 (MG11, MG12, MG17a): nenhum agente roda `db:push:prod`. (b) Bem depois, e só com o fechamento da pergunta 6 em produção, conceder o direito pelo SQL do Apêndice C.

Ordem de aplicação do lote C, fixada pelo controlador: MG14, **MG11**, MG5, MG7, MG12. **(reconciliação 13/10, emenda 1: D-C1, S-C1) O lote C foi partido: C1 = MG14, MG5, MG7, aplicado antes de qualquer push do `staging` local; C2 = MG11, MG12, MG17a, depois. A MG11 continua antes da MG12 (reconciliação 13/10, emenda 3: m2: **só quando as duas vão no mesmo `db:push:prod`; se o acordo da E17 demorar, a MG12 e a MG17a vão sem a MG11 e ela entra depois, trocando a policy das duas tabelas da MG12, como o passo 4 da reconciliação e a seção 2 do plano da E18 já dizem**). Pede o aval do controlador (reconciliação, seção 3).** **Para este plano: MG14, MG5 e MG7 já estarão aplicadas quando a MG11 chegar, com a policy por `can_edit_site`; é o estado que a P2 espera, e o laço de 4.8 troca as três.** **(reconciliação 13/10, emenda 2: S2-C1) "Antes de qualquer push do `staging` local" foi corrigido na reconciliação: o C1 vem antes do lote que leva E6 P2, E8-coleta e E11; o lote B e o Lote 2 vão antes dele, por árvore de lote. Para este plano nada muda: a MG11 continua chegando com as três do C1 já aplicadas.**

| Passo | Quem | O quê |
|---|---|---|
| 1 | controlador | roda P1 a P12 e a P14 (seção 0.2) e anota *(emenda 1: eram P1 a P10; emenda 2: D-N1: a P14)*; avisa que chegou a vez do lote C e que o arquivo da MG14 já existe (reconciliação 13/10, emenda 2: D2-m1: a vez é a do lote C2; os arquivos da MG14, da MG5 e da MG7 já existem e estão aplicados) |
| 2 | agente (Tarefa 1b) | `npm run db:new observatorio_a5_e17_direito_desempenho_privado`, **depois** do arquivo da MG14 e **antes** do da MG5; cola o Apêndice A (o texto de `apps/web/test/fixtures/sql/a5-e17-p0-mg11.sql`); confere `diff` vazio entre os dois; roda o roteiro de prova duas vezes; commit local |
| 2b *(emenda 1: S-m3)* | controlador | aplica o arquivo no `bythiago_int` (pelo comando que ele já usa para esse banco; este plano não o afirma) e roda o teste de 40 conexões da Tarefa 4. **Verde antes do passo 3:** é a única prova de atomicidade do contador, e depois do passo 3 um defeito só se conserta com migration nova |
| 3 | **dono** | `npm run db:push:prod` (digita `YES`), uma vez, com ~~as cinco do lote C~~ (reconciliação 13/10, emenda 2: D2-m1) as do lote C2 que estiverem prontas no dia (MG11; MG12 e MG17a, se os arquivos delas existirem) |
| 4 | agente | V1 a V6 em produção (só leitura), resultado no ledger `.superpowers/sdd/a5-e17-p0/progress.md` |
| 5 | agente | push do código (Tarefa 11), com a A4 já em `staging` |
| 6 | **dono**, depois | Apêndice C, uma instrução por vez, quando o plano de fechamento estiver em produção |

**Nome para o `db:new`:** `observatorio_a5_e17_direito_desempenho_privado`. Uma migration só.

**Janela e travas.** A MG11 cria três tabelas vazias, oito funções e um gatilho numa tabela nova. O que encosta em tabela com tráfego:
- `drop policy` e `create policy` em até doze tabelas existentes (*emenda 2: D-m-a*: a frase dizia "dez", contra a conta logo abaixo; hoje, em produção, 3 ou 5: P1; no dia do lote C, no máximo 6): trava exclusiva por milissegundos em cada uma, sem reescrever linha. A maior é `yt_own_video_daily` (cerca de 97 mil linhas), e ela só recebe escrita no cron das 12:00 UTC. As duas de comentário recebem escrita da tarefa de retratos da agenda.
- `alter table public.pipeline_api_keys add column` (duas colunas anuláveis, sem valor padrão: só catálogo) e `add constraint … check` (lê as linhas da tabela, que são três ou quatro). A tabela é lida a cada chamada do pipeline e pela forja a cada 10 minutos.
- Cinco chaves estrangeiras para `auth.users` (*emenda 1: D-m2*: eram quatro; a quinta é a de `revoked_by`): cada uma pede, por milissegundos, uma trava que espera escrita em andamento em `auth.users` (um login em curso).
- `set lock_timeout = '5s'` na primeira linha: se alguma trava não vier em 5 segundos, a migration falha; repete-se. *(emenda 1: D-m7)* A rodada 0 dizia "falha inteira e nada fica aplicado": isso só vale se a CLI do Supabase aplica o arquivo numa transação só, e **não foi medido** (conferência P11). Se P11 disser que não, a frase certa é "pode ficar aplicada em parte; repetir converge". O desenho aguenta os dois casos: a troca das policies é um bloco `do` só, portanto atômica para as doze juntas, e o arquivo inteiro é idempotente.
- *(emenda 1: D-m4)* **A conta do pior caso, por extenso.** "Milissegundos" é o tempo de cada trava depois de concedida. O limite de 5 s vale por pedido de trava, não para a migration inteira. A trava em `auth.users` é pedida na primeira instrução (o `create table` com chave estrangeira) e, se o arquivo roda numa transação só (P11), fica presa até o fim; depois dela vêm os pedidos de trava exclusiva em tabela com tráfego: um por tabela da lista que existir, mais `pipeline_api_keys`. O teto teórico é 13 pedidos (as doze, se todas existissem), cerca de **65 s** se cada um esperar quase 5 s e conseguir. No dia do lote C, pela ordem de aplicação, existem no máximo seis das doze quando a MG11 roda (as cinco de hoje, se P1 confirmar a MG8, e a da MG14): 7 pedidos, cerca de **35 s**. Nesse tempo fica esperando quem escreve em `auth.users` (um login) e, no trecho final, quem lê `pipeline_api_keys` (a forja, o Cowork). É improvável e não perde dado; é o teto, e é por ele que a janela importa.
- **Janela:** fora de 11:30 a 13:00 UTC (cron da coleta do canal próprio), como as outras do lote C. *(emenda 1: D-m4)* E, se o lote B já estiver em produção no dia (hoje é só local), fora do minuto do despachante da agenda, que é quem escreve nas duas tabelas de comentário: conferência P12.

**Convive com o código que está em `main`?** Sim, nos dois sentidos:
- **MG11 aplicada, código antigo (é inerte).** Nenhum código lê as tabelas novas nem chama as funções novas. As policies trocadas passam a chamar `can_view_private_site`, que sem linha em `site_private_viewers` responde o mesmo que `can_edit_site` para todo usuário (rodado: 18 pares usuário e site, zero divergência, Apêndice B). O código antigo lê as tabelas privadas com o cliente de serviço, que não passa pela RLS. `pipeline_api_keys` é lida por lista de colunas: as duas colunas novas não aparecem. O `check` novo só recusa uma combinação de permissões que nenhuma linha tem (P4).
- **Código novo sem a MG11.** Quem edita não percebe diferença: o token de leitura nasce do token de edição, sem consultar nada novo. Quem não edita cai na chamada `can_view_private_site_as`, que não existe: a chamada dá erro, o token não nasce, a tela mostra o estado "negado" de hoje e um evento vai ao Sentry com a etiqueta `provar-leitura-privada`. Falha fechada. Hoje não há nenhum usuário nessa condição em produção (P7).
- **MG11 antes ou depois das outras do lote C:** o laço da seção 3 troca só as tabelas que já existem; as que nascem depois acham a função e nascem certas pelo bloco PL. Rodado com 10 das 12 tabelas presentes.

### Consultas de conferência depois de aplicar (V1 a V4 rodadas no banco local, duas vezes)

**V1: a migration entrou inteira?** Esperado: **3, 2, 6, 1, 8, 2, 1, 1**. (Em produção, antes: 0, 0, 0, 0, 0, 0, 0, 0.)

```sql
select (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and c.relname in ('site_private_viewers','obs_ai_access_log','obs_ai_rate')) as tabelas_com_rls_de_3, (select count(*) from pg_policies where schemaname='public' and tablename in ('site_private_viewers','obs_ai_access_log','obs_ai_rate')) as policies_de_2, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('is_super_admin_as','is_org_admin_as','can_view_site_as','can_edit_site_as','can_view_private_site_as','obs_ai_rate_hit') and not has_function_privilege('anon',p.oid,'execute') and not has_function_privilege('authenticated',p.oid,'execute') and has_function_privilege('service_role',p.oid,'execute')) as funcoes_so_service_role_de_6, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='can_view_private_site' and has_function_privilege('anon',p.oid,'execute') and has_function_privilege('authenticated',p.oid,'execute') and has_function_privilege('service_role',p.oid,'execute')) as funcao_de_sessao_de_1, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('is_super_admin_as','is_org_admin_as','can_view_site_as','can_edit_site_as','can_view_private_site_as','can_view_private_site','obs_ai_rate_hit','tg_site_private_viewers_audit') and p.proconfig @> array['search_path=""']) as funcoes_com_search_path_vazio_de_8, (select count(*) from information_schema.columns where table_schema='public' and table_name='pipeline_api_keys' and column_name in ('user_id','expires_at')) as colunas_novas_de_2, (select count(*) from pg_constraint where conrelid='public.pipeline_api_keys'::regclass and conname='pipeline_api_keys_observatorio_leitura_sozinha') as check_de_1, (select count(*) from pg_trigger where tgrelid='public.site_private_viewers'::regclass and tgname='audit_site_private_viewers' and not tgisinternal) as gatilho_de_1;
```
`policies_de_2` é 2 de propósito: `obs_ai_rate` tem RLS ligada e **nenhuma** policy.

**V2: as policies das doze.** Esperado: uma linha por tabela da lista **que existe**, todas com `policyname = <tabela>_select`, `cmd = SELECT` e `qual = can_view_private_site(site_id)`. Logo depois do lote C inteiro: 12 linhas (10 se a MG12 ainda não tiver criado `yt_own_video_versions` e `yt_own_versions_state`). Qualquer linha com `can_edit_site` = uma migration posterior recriou a policy sem o bloco PL: avisar e corrigir por migration nova. **Rodar de novo depois de TODO o lote C.**

```sql
select tablename, policyname, cmd, qual from pg_policies where schemaname='public' and tablename in ('yt_own_video_daily','yt_own_video_reach_daily','yt_own_video_meta_daily','yt_own_video_coverage','yt_own_video_retention','yt_own_video_dim_daily','yt_own_video_traffic_detail_daily','yt_own_video_reach_dim_daily','yt_own_video_versions','yt_own_versions_state','competitor_video_comments','competitor_video_comment_marks') order by 1;
```

**V3: as exceções não foram tocadas.** Esperado: `competitor_raw`, `competitor_video_comment_authors`, `yt_own_collection_attempts`, `yt_reporting_jobs` e `yt_reporting_reports` com `can_edit_site(site_id)`; as quatro `yt_own_public_*` com `can_view_site(site_id)`; **nenhuma linha** para `yt_own_collection_runs` nem `yt_reporting_report_blobs` (RLS ligada, sem policy). Nove linhas.

```sql
select tablename, policyname, qual from pg_policies where schemaname='public' and tablename in ('yt_own_collection_attempts','competitor_video_comment_authors','competitor_raw','yt_reporting_reports','yt_reporting_jobs','yt_reporting_report_blobs','yt_own_collection_runs','yt_own_public_video_hourly','yt_own_public_video_early','yt_own_public_hour_map','yt_own_public_hour_fold_log') order by 1;
```

**V4: ninguém ganhou nada.** Esperado: `0, 0, 0, 0` (nenhuma concessão, nenhum registro, nenhum contador, nenhum rastro).

```sql
select (select count(*) from public.site_private_viewers) as concessoes, (select count(*) from public.obs_ai_access_log) as registros, (select count(*) from public.obs_ai_rate) as contadores, (select count(*) from public.audit_log where resource_type = 'site_private_viewers') as rastro;
```

**V5: quem lê o privado hoje, pessoa por pessoa (só produção responde).** Esperado: toda linha com `ver = editar = privado`; `privado = true` só para quem já edita (o dono e o editor: duas linhas com `true`, conforme P7). Uma linha com `privado = true` e `editar = false` = alguém ganhou o direito: parar e avisar.

```sql
select u.email, s.slug, public.can_view_site_as(u.id, s.id) as ver, public.can_edit_site_as(u.id, s.id) as editar, public.can_view_private_site_as(u.id, s.id) as privado from auth.users u cross join public.sites s where u.id in (select user_id from public.organization_members union select user_id from public.site_memberships) order by 1, 2;
```

**V6: as chaves do pipeline continuam como estavam.** Esperado: as mesmas linhas da C0.4 (`cowork-permanent`, `forja (fila)`, `forja (so leitura)`), todas com `user_id` nulo e `expires_at` nulo; nenhuma com `observatorio_leitura`.

```sql
select name, permissions, user_id, expires_at, revoked_at is not null as revogada from public.pipeline_api_keys order by created_at;
```

---

## 3. Fatos medidos

| Nº | Fato | Fonte |
|---|---|---|
| F1 | As quatro funções de sessão usam só `auth.uid()` e o parâmetro do site; nenhuma lê o GUC | `20260507000001_schema.sql:3751-3785, 4283-4332`; C0.7 |
| F2 | `can_view_site` passa para qualquer vínculo (`reporter` incluído); `can_edit_site` só para `editor`, administrador da organização e super-administrador | idem; rodado (Apêndice B, matriz) |
| F3 | Em 12/10, produção tinha 3 das 12 tabelas, cada uma com uma policy `<tabela>_select` em `can_edit_site`. Com a MG8 aplicada (brief do controlador), são 5 | C0.7; `20261013000003_…:143-153`; **P1 e P2 confirmam** |
| F4 | No banco local de integração existem 10 das 12 (faltam `yt_own_video_versions` e `yt_own_versions_state`, da MG12, que ainda não tem SQL) e todas estavam em `can_edit_site` antes da MG11 | rodado em 13/10 |
| F5 | A MG11 aplicada duas vezes seguidas não dá erro; depois dela as 10 estão em `can_view_private_site(site_id)` e as 9 policies das exceções ficaram iguais | rodado; V1 a V3 |
| F6 | Versão de sessão e versão `_as` respondem igual para 9 usuários × 2 sites (18 pares), com o GUC `app.site_id` forjado para o site A | rodado; Apêndice B |
| F7 | `can_view_private_site` custa 0,138 ms por linha contra 0,120 ms de `can_edit_site` (10.800 linhas, usuário sem acesso nenhum, que é o pior caso; 1,48 s contra 1,30 s). A primeira versão, que chamava `can_view_site_as`, custava 0,23 ms | rodado duas vezes |
| F8 | Função criada por `postgres` em `public` nasce com `execute` para `anon` e `authenticated` (privilégio padrão do schema, banco local) | `pg_default_acl`, rodado; **P6 confirma em produção** |
| F9 | O gatilho genérico `tg_audit_mutation` lê `NEW.id`; `site_private_viewers` não tem coluna `id` | `20260922000002_…:63-112` |
| F10 | `audit_log.site_id` tem chave estrangeira sem `on delete`: uma linha de rastro impede apagar o site até ser apagada (já é assim com `site_memberships`, que tem gatilho de auditoria) | `pg_constraint`, rodado; `observatorio-a5-e14-rls.test.ts:66-67` |
| F11 | `pipeline_api_keys.created_by` já usa `references auth.users(id) on delete set null`: é o precedente das chaves novas | `20260509000001_content_pipeline.sql:126-136` |
| F12 | Só existe uma organização raiz por banco (`organizations_single_master`) | erro ao rodar a primeira versão da prova |
| F13 | `canEdit` de `ChannelPage` é `edicao != null` e não é lido por nenhum outro arquivo de `competitors/`. *(emenda 1: S-I4)* Logo, nenhum controle de tela depende da guarda de edição: o botão de fixar não tem condição de permissão, e as páginas passam `pinVideo`, `askForjaReading`, `cancelForjaReading`, `syncCompetitorNow` e `toggleChangeBookmark` às telas de concorrentes sem condição. As duas telas privadas não recebem ação nenhuma | `_chrome/page-data.ts:58,90`; `grep -rn canEdit`; `_chrome/pin-kit.tsx:54-122`; `video/[id]/page.tsx:51-55,70`; `mudancas/page.tsx:27`; `page.tsx:54-56`; `canal/[id]/page.tsx` (`<ProprioScreen view comoEsta>`); `_canal/canal-header.tsx:53` ("Sincronizar só este canal" fora do `canAdmin`) |
| F14 | Todas as ações exportadas de `actions.ts` (14) e de `forja-actions.ts` (2) pedem `mode: 'edit'`; em `niche-actions.ts`, `setChannelNiche` e `setOwnChannelNiche` também; `getUserNiche` e `setUserNiche` pedem `mode: 'view'` | `grep -n requireSiteScope` nos três arquivos |
| F15 | Quem recebe o token hoje: `ler.ts`, `ler-retencao.ts`, `ler-dimensoes.ts`, `_proprio/dados.ts`, `_proprio/carregar-extras.ts`, `_chrome/page-data.ts`, `canal/[id]/page.tsx`, `video/[id]/page.tsx`. *(emenda 1: S-I3)* **27** arquivos de `apps/web/test` citam o token ou a prova (o `grep` desta linha, relido em 13/10; a rodada 0 dizia 17): 25 mudam na Tarefa 6 e 2 não mudam (`proprio-edicao.test.ts` e `edicao-teste.ts`). *(emenda 2: S-n3)* Fora desse `grep` há mais 2 arquivos que mudam (`proprio-impressoes.test.tsx` e `proprio-formato.test.ts`: citam a prova de edição só dentro de uma expressão de segurança), o que leva a Tarefa 6 a 27 arquivos de teste | `grep -rnE "EdicaoDoSite\|edicaoValida\|provarEdicao\|podeVerPrivado"` |
| F16 | `lerRetencao`, `lerDimensoes` e `lerDetalheDaOrigem` ainda não são chamados por nenhuma tela | `grep -rn` fora de `proprio/ler-*` |
| F17 | O e2e já tem uma usuária `reporter` (`e2e-reporter@test.local`) e um teste que afirma que ela não recebe nenhum número privado | `e2e/fixtures/global-setup.ts:47,99-103`; `proprio-a4-seguranca.spec.ts:146` |
| F18 | No banco local: 187 tabelas em `public`, 5 sem RLS, 8 views, 225 policies de leitura em 167 tabelas, 85 tabelas com `can_view_site` na policy de leitura, 17 com `true` | rodado em 13/10; **P3 dá o número de produção** |
| F19 | 37 arquivos de `src` usam `mode: 'view'` | `grep -rl "mode: 'view'" src \| wc -l` |

---

## 4. Desenho, no que difere de "copiar o que já existe"

**4.1 Uma regra, dois jeitos de perguntar.** `can_view_private_site_as(p_user, p_site)` é a regra. `can_view_private_site(p_site_id)` é uma linha que a chama com `auth.uid()`: é a que as policies usam. O código do site pergunta pela `_as`, com o cliente de serviço, passando o id que a guarda de sessão devolveu; o degrau 2 vai perguntar pela mesma função com o `user_id` da chave. Três caminhos, uma regra.

**4.2 O espelho.** As de sessão que já existem (`can_edit_site` e companhia) **não são tocadas**: reescrevê-las como casca das `_as` mexeria na autorização do site inteiro por causa de uma etapa do Observatório. O preço é haver duas cópias da regra de "quem edita" (a antiga e a `can_edit_site_as`). O que segura a igualdade: o teste de equivalência para todo usuário da semente (item 236), a consulta V5 em produção e a conferência P10 (o md5 do corpo que foi espelhado).

**4.3 A regra do direito, por extenso.** Lê o privado quem edita o site. Quem não edita lê só com as duas coisas: linha em vigor em `site_private_viewers` (com `revoked_at` nulo) **e** linha em `site_memberships` daquele site. Usuário nulo (sem sessão), site que não existe e site nulo dão `false`, nunca nulo (rodado). `revoked_at` com data no futuro conta como revogado desde já.

**4.4 O token de leitura.** Arquivo novo, irmão de `edicao.ts`: `lib/youtube/observatorio/proprio/leitura-privada.ts`. Mesma fabricação (construtor privado, campo `#siteId`, chave `Symbol` que só o módulo conhece, `new.target`, `Object.freeze`, brand check `#siteId in x`). Nasce por um caminho só, `provarAcessoPrivado(siteId)`, em até três passos:
1. `provarEdicao(siteId)`. Se devolver o token de edição, a leitura nasce dele e `edita = true`. **Nenhuma consulta nova:** é por isso que quem edita não depende da MG11.
2. Senão, `requireSiteScope({ area: 'cms', siteId, mode: 'view' })`. Sem sessão ou sem vínculo: `{ leitura: null, edita: false }` (*emenda 1: D-m6*: o retorno leva também `negativa`, aqui `'sem_direito'`; ver a Tarefa 5).
3. Com sessão e vínculo: `rpc('can_view_private_site_as', { p_user: guarda.user.id, p_site: siteId })` pelo cliente de serviço. Só `data === true` faz o token nascer. Erro, `null`, `false`, texto `'true'`, qualquer outra coisa: sem token.

O caminho contrário (de leitura para edição) não existe: não há função que receba `LeituraPrivadaDoSite` e devolva `EdicaoDoSite`, e as duas classes têm campo privado, então uma não é atribuível à outra (prova de tipo).

**4.5 `canEdit` deixa de sair do token.** Hoje `canEdit: edicao != null`. Com o token de leitura no lugar, isso viraria verdadeiro para quem só vê. `provarAcessoPrivado` devolve `{ leitura, edita }`, e `page-data.ts` passa a escrever `canEdit: acesso.edita`. `edita` é uma dica para a tela; toda ação que escreve refaz a guarda de edição sozinha (F14), e isso não muda.

**4.6 Por que o cliente de serviço antes do token.** A regra do projeto é não criar o cliente de serviço antes de provar quem pede. Aqui ele é criado depois da guarda de sessão e de vínculo (passo 2), e só para fazer **uma** pergunta sim ou não sobre o próprio usuário autenticado; não lê dado nenhum. É o mesmo padrão de `openObservatoryPage`, que lê a preferência do usuário com o cliente de serviço logo depois da mesma guarda. A alternativa (cliente com os cookies chamando a função de sessão) faria a mesma pergunta por outro caminho e exigiria montar um segundo cliente em cada página.

**4.7 A concessão.** SQL do runbook, rodado pelo dono como `postgres`. Conceder é `insert … on conflict do update … where revoked_at is not null` (a quem já tem, não altera nada: 0 linhas); retirar é `update … set revoked_at = now(), revoked_by = <o dono> where … and revoked_at is null` *(emenda 1: D-m2: a retirada guarda quem retirou; reconceder limpa `revoked_by`)*. O gatilho grava o rastro. Rodado com as instruções da rodada 0, sem `revoked_by`: reconceder 1 linha, conceder a quem já tem 0, retirar 1, retirar de novo 0; as instruções da emenda 1 esperam a rodada do Apêndice B. *(emenda 2: D-N1 e D-m-g)* Há um terceiro comando, que não é concessão nem retirada: "corrigir autor em branco" preenche `granted_by` ou `revoked_by` quando ficaram nulos, sem tocar `revoked_at` (não muda quem lê e, por causa do gatilho `of revoked_at`, não grava rastro). E o banco recusa `revoked_by` preenchido numa linha em vigor (`check`).

**4.8 O que a MG11 faz com as doze.** Um laço sobre a lista escrita. Para cada tabela que existe: liga a RLS (se já está ligada, não muda nada), apaga `<tabela>_select`, cria `<tabela>_select` com `can_view_private_site(site_id)`, e **confere que não sobrou policy de outro nome** naquela tabela; se sobrou, lança e a migration inteira não se aplica. A conferência existe porque `drop policy if exists` de um nome que não bate passa calado, e a tabela ficaria com duas policies sem ninguém saber.

---

## 5. As contas

**Linhas.**
- `site_private_viewers`: uma linha por pessoa e site. Hoje 0; com a irmã, 1. Não cresce com o tempo.
- `audit_log`: mais uma linha por concessão e por retirada. Ordem de unidades por ano.
- `obs_ai_access_log` e `obs_ai_rate`: **0 linhas** até o degrau 1 ou 2 existir. O teto de lá (500 chamadas por dia por chave, cerca de 80 MB no pior caso, cerca de 2 MB por ano no uso esperado) é do spec (8.1.4 e 9.6) e será conferido no plano do degrau 2; aqui a conta é zero.
- `pipeline_api_keys`: nenhuma linha nova.

**Chamadas de API do YouTube e cota:** zero. Este plano não fala com o YouTube.

**Cron e orçamentos acoplados** (20 min do claim da forja, 25 min do `timeout` do cron dela, 30 min do watchdog, 300 s da função da Vercel, o cron das 12:00 UTC): **nenhum é tocado**. Não há passo novo em cron nenhum.

**Custo por requisição de página.**
- Quem edita: o mesmo de hoje (uma guarda de edição por chamada de `podeVerPrivado`).
- Quem não edita: uma guarda de edição que nega, uma guarda de leitura e uma chamada de função (uma ida ao banco, que faz no máximo cinco buscas por chave em tabelas de poucas linhas). Por página são 1 ou 2 chamadas de `podeVerPrivado`: a página do canal faz uma (`openChannelPage`, e passa o resultado adiante em `previo`); a do vídeo e a da lista fazem uma cada, mais uma quando `carregarExtras` não recebe `previo`. No pior caso, 4 guardas e 2 idas ao banco a mais por página, para uma pessoa.
- **Quando estoura:** não há teto para estourar. Se o banco não responder, o passo 3 dá erro, o token não nasce e a tela mostra "negado" (seção 6).

**Custo da policy por linha (leitura direta pela API do banco, com sessão).** 0,138 ms por linha contra 0,120 ms hoje (F7), mais 15%. Quem lê assim: ninguém no produto (os leitores usam o cliente de serviço, que não passa pela RLS). Uma leitura direta de 1.000 linhas (o limite do PostgREST) custa cerca de 0,14 s; uma contagem sem filtro em `yt_own_video_daily` inteira já custava cerca de 12 s e passa a cerca de 13 s, e nos dois casos passa do tempo limite de instrução que o Supabase dá por padrão ao papel `authenticated` (8 s; o valor deste projeto não foi medido). Não é regressão que alguém sinta, e fica declarada.

**Tempo da migration:** dezenas de milissegundos de trava por tabela existente; nenhuma reescrita de tabela; nenhum índice em tabela com linha, fora o parcial de `pipeline_api_keys` (três ou quatro linhas). *(emenda 1: D-m4)* Isso é o tempo com as travas concedidas na hora; o pior caso de espera (cerca de 35 s no dia do lote C; 65 s no teto teórico) está na conta da seção 2.

---

## 6. O que acontece quando o dado não existe, e em cada falha

Não há cron nem e-mail neste plano. "O que o dono vê" é a tela ou o Sentry. Vermelho, aqui, quer dizer "evento no Sentry com a etiqueta dita"; nota quer dizer "sem aviso, e está certo assim".

| Situação | O que o código faz | Veredito e o que se vê |
|---|---|---|
| **Nenhuma linha em `site_private_viewers`** (o estado do dia do deploy) | a função responde igual a `can_edit_site`; quem edita vê; quem não edita, não | verde, e é o estado esperado. Não é "ok por falta de dado": a ausência **é** a negação |
| Linha existe com `revoked_at` preenchido | sem token; tela "negado" | nota: é a retirada funcionando |
| Linha em vigor, mas a pessoa saiu do site (sem `site_memberships`) | a guarda de leitura já barra no passo 2; no banco a função dá `false` | nota. Rodado (usuário "exmembro": `f, f, f`) |
| **MG11 não aplicada**, quem pede edita | passo 1 resolve; nada novo é chamado | verde de verdade: o caminho de quem edita não depende da MG11 |
| **MG11 não aplicada**, quem pede não edita | a chamada da função dá erro (função inexistente); sem token; tela "negado" | **vermelho**: `Sentry.captureException`, etiquetas `component: observatorio-proprio`, `step: provar-leitura-privada`, extra `motivo: 'funcao_ausente_ou_erro'` e o código do erro. A pessoa lê a frase de "negado", que para ela é verdade naquele momento |
| Erro de banco ou de rede na chamada da função | idem | **vermelho**, idem |
| A função responde `null`, texto ou objeto | sem token (só `=== true` serve) | **vermelho**: `captureMessage` nível `warning`, `motivo: 'resposta_inesperada'`. Não é tratado como "não tem o direito" calado, porque a função nunca devolve nulo |
| A guarda de sessão lança (pacote de autenticação fora do ar) | `try/catch`; sem token | **vermelho**, `motivo: 'guarda_falhou'` (é o que `edicao.ts` já faz no caso dele) |
| `siteId` que não é uuid | sem chamada ao banco; sem token | nota (a página resolve o site antes; é defesa) |
| Token de **edição** passado a um leitor (por cast) | `leituraValida` dá `false`; o leitor devolve `negado` sem consultar | nota em produção (não compila sem cast); teste nomeado |
| Leitor recebe token de leitura de **outro** site | o site da consulta sai de dentro do token; o canal pedido não é daquele site; zero linha | o leitor já trata "canal sem linha" como hoje; teste de site cruzado nomeado |
| Tabela privada ausente (lote C incompleto) | não é deste plano: cada leitor já tem a sua guarda de schema (`ler-retencao`, `ler-dimensoes`) | sem mudança |
| Lista vazia de concessões lida pelo dono (runbook, consulta "quem tem o direito") | devolve zero linhas | nota: o runbook diz "zero linhas = ninguém além de quem edita" |
| A migration acha policy fora do padrão numa das doze | `raise exception`; o laço inteiro é desfeito (é uma instrução só), então **nenhuma** policy é trocada. O que veio antes dele no arquivo (a tabela de concessão e as funções) fica ou não conforme P11 *(emenda 1: D-m7)*; nos dois casos repetir converge | **vermelho na hora**: o `db:push:prod` do dono para com a frase "MG11: a tabela X tem policy fora do padrão (Y): classificar antes de aplicar". P2 existe para isso não acontecer na frente dele |
| A migration espera trava por mais de 5 s | `lock_timeout`; a migration para: nada aplicado, ou aplicada em parte e convergente ao repetir (P11; *emenda 1: D-m7*) | **vermelho na hora**; repetir fora da janela do cron |
| Gatilho de rastro falha (por exemplo `audit_log` com coluna obrigatória nova) | a instrução de conceder falha inteira; nenhuma concessão sem rastro | **vermelho na hora**, na frente do dono, no painel do Supabase. P9 confere antes |
| Dono roda o SQL de conceder com e-mail ou slug de site que não existe | a subconsulta dá nulo; `insert` falha por `not null` (rodado com os valores de exemplo do Apêndice C) | **vermelho na hora**; o runbook manda conferir "1 linha" |
| *(emenda 1: D-m2)* Dono roda o SQL de conceder ou de retirar com **o próprio e-mail** digitado errado | a subconsulta dá nulo, e `granted_by` (ou `revoked_by`) é anulável: a instrução **passa** e a linha entra sem autor, igual a "quem concedeu foi apagado" | **falha em verde**, e por isso tem conferência própria: o runbook manda rodar "quem tem o direito hoje" logo depois, que mostra o e-mail de quem concedeu e de quem retirou; *(emenda 2: D-N1)* em branco = rodar "corrigir autor em branco" (Apêndice C), que não toca `revoked_at`: não muda quem lê e não grava rastro. **Nunca conceder para consertar uma linha retirada** (a emenda 1 mandava "retirar e conceder de novo", e numa linha retirada isso devolvia o direito em verde). A P14 confere antes se o e-mail escrito nos comandos é o do login do dono |
| Apagar um site que tem rastro de concessão | a chave de `audit_log.site_id` impede, como já impede hoje com os vínculos | nota: comportamento que já existe (F10) |
| API do YouTube 403, 429, 500 | não se aplica: o plano não chama API nenhuma | |

*(emenda 1: D-m6)* **Erro não é "sem permissão", e o contrato passa a dizer a diferença.** Nas quatro linhas em vermelho em que o token não nasce por falha (função ausente, erro de banco ou de rede, resposta inesperada, guarda que lança), a pessoa lê hoje a mesma frase de quem não tem permissão, e o único aviso é o Sentry. A tela não muda neste plano, mas o retorno de `provarAcessoPrivado` passa a levar `negativa: 'sem_direito' | 'nao_foi_possivel_conferir'` (Tarefa 5), para o lote de UX poder mostrar "não foi possível conferir agora" sem mexer no contrato.

**Interruptor de desligar.** Não há variável. Fechar o direito de uma pessoa: `revoked_at` na linha dela (Apêndice C). Fechar o de todas: o mesmo `update` sem o filtro de pessoa. Reverter o código devolve os leitores ao token de edição; a MG11 fica aplicada e sem efeito.

---

## 7. Simulação do dia do deploy e dos seguintes

**Antes de tudo (hoje):** produção não tem nenhuma peça nova. Uma pessoa edita o site além do dono (P7).

**D0, manhã: o dono aplica o lote C.** A MG14 cria `yt_own_video_coverage` com a policy em `can_edit_site` (a função do direito ainda não existe). A MG11 entra em seguida: cria o direito e troca a policy das tabelas que já existem, a da MG14 incluída. MG5, MG7 e MG12 entram depois e as tabelas delas já nascem em `can_view_private_site`. O agente roda V1 a V6. Ninguém percebe nada: `site_private_viewers` está vazia. (reconciliação 13/10, emenda 2: D2-m1) Com o lote C partido a narrativa muda de ordem, não de efeito: MG14, MG5 e MG7 já estão em produção com a policy em `can_edit_site`; a MG11 entra e troca as três (laço de 4.8); só a MG12, se vier depois dela, já nasce em `can_view_private_site`.

**D0, tarde: o código vai a `staging` e depois a `main`.** Para o dono e para o editor, nada muda na tela (o token de leitura nasce do de edição). Não existe usuário `reporter` em produção, então o passo 3 não é exercitado por ninguém.

**D+1:** conferir no Sentry zero evento com `step: provar-leitura-privada` e, no banco, V4 (`0, 0, 0, 0`) e V2.

**D+7:** V2 de novo (nenhuma migration posterior desfez a troca), V4 e V5.

**Mais tarde, com o plano de fechamento em produção:** o dono cria o usuário da irmã como `reporter` e roda a instrução de conceder. Na requisição seguinte dela, o passo 3 devolve `true`, as telas do canal próprio mostram os números, nenhum controle de edição aparece e nenhuma ação de escrita aceita. `audit_log` ganha uma linha `private_view_granted`.

**Se o dono retirar o direito:** na requisição seguinte ela volta a ver "negado". Se ele a tirar do site sem retirar o direito: a guarda de leitura a manda para fora do CMS; no banco, a função dá `false`.

---

## 8. Desvios do texto do spec, com o motivo

1. **`search_path = ''` em todas as funções novas, com nomes qualificados.** O spec escreve `set search_path = public` no DDL de `obs_ai_rate_hit`, e a C0.7 fecha as `_as` com `'public'`. A OP-2 manda `''` para `obs_ai_rate_hit`; estendi às outras sete, pela mesma razão (função `security definer` com `search_path` nomeado é o alvo clássico de sombra de objeto). Rodado: `proconfig` das oito é `search_path=""`.
2. **Cinco funções `_as`, não duas.** O spec nomeia `can_view_site_as` e `can_view_private_site_as`; a C0.7 fecha o corpo com mais três de apoio (`is_super_admin_as`, `is_org_admin_as`, `can_edit_site_as`). As cinco só são executáveis por `service_role`.
3. **O direito exige vínculo com o site** (pergunta 3). Mais restrito que o texto do spec. A linha N8 da tabela de interruptores ("sem concessão, responde igual a `can_edit_site`") continua verdadeira.
4. **`can_view_private_site_as` não chama `can_view_site_as`.** Confere o vínculo direto em `site_memberships`, porque para quem não edita "ver o site" é exatamente ter essa linha. Mesma resposta nos 18 pares, e o custo por linha cai de 0,23 ms para 0,138 ms (F7).
5. **`granted_by` é anulável e tem chave estrangeira com `on delete set null`** (o spec: `uuid not null`, sem chave). E **`obs_ai_access_log.user_id` é anulável com a mesma chave** (o spec: `not null`, sem chave). Sem isso, apagar um usuário (LGPD, fase 3) deixaria o identificador dele em duas tabelas sem que nada o limpasse. Rodado: apagar a leitora some com a concessão dela, anula o `user_id` do registro e da chave; apagar quem concedeu anula `granted_by`. *(emenda 1: D-m2)* A tabela ganha também **`revoked_by`**, que o spec não tem, com a mesma chave e a mesma regra (`on delete set null`): sem ela a retirada não teria autor em lugar nenhum (no painel `auth.uid()` é nulo). O "Rodado" desta linha é da rodada 0, antes da coluna. *(emenda 2: D-m-g)* E um `check` que o spec também não tem: `revoked_by` só pode estar preenchido numa linha retirada (`revoked_by is null or revoked_at is not null`). Sem ele, uma escrita fora dos comandos do runbook deixaria uma linha "em vigor, retirada por fulano", e a consulta "quem tem o direito hoje" a mostraria assim. Entra agora porque depois seria migration nova. É compatível com o `set null` do apagamento e com os seis comandos do Apêndice C (reconceder limpa as duas colunas na mesma instrução). Não rodado.
6. **`pipeline_api_keys.user_id` com `on delete set null`.** O spec não diz a regra de apagamento. Chave sem `user_id` não entra no perfil (regra do próprio spec). *(emenda 1: D-m3)* "Apagar a pessoa fecha a chave dela" **só passa a ser verdade com o código do degrau 2**: no banco a linha fica com `observatorio_leitura`, `user_id` nulo e `revoked_at` nulo. Hoje não há porta aberta (`lib/pipeline/auth.ts:95-99` recusa essa permissão em `/api/pipeline/*`, e `lib/pipeline/mcp/auth.ts:85-87` só aceita `read`, `write` e `admin`); as duas obrigações do degrau 2 estão em "Dívida registrada".
7. **Um `check` a mais em `pipeline_api_keys`:** quem tem `observatorio_leitura` não tem mais nenhuma permissão. O spec põe essa recusa no comando que cria a chave; aqui ela vale também no banco. Rodado: `insert` e `update` que misturam dão erro 23514. **Não** há `check` exigindo `user_id` e `expires_at` nas chaves do perfil: ele impediria o `set null` do desvio 6.
8. **Rastro de concessão em `audit_log`, por gatilho próprio** (pergunta 7). O spec não pede. O gatilho genérico não serve (F9). Só `insert` e `update of revoked_at` *(emenda 1: D-m1 e S-I5)*. Sem `delete`: no `delete` em cascata de um site o gatilho gravaria uma linha apontando para o site que está sendo apagado. E só quando `revoked_at` é escrito: o `on delete set null` de `granted_by` é um `update`, e com o gatilho da rodada 0 (`update` de qualquer coluna) o apagamento LGPD de quem concedeu gravaria em `audit_log`, no "antes", o id que acabava de ser apagado. Conceder e retirar sempre escrevem `revoked_at`, então continuam deixando rastro. **Não** entrou a saída antecipada por `app.skip_cascade_audit` que o gatilho genérico tem (pedida em S-I5): com `of revoked_at` ela não é necessária para o apagamento, e ela abriria um jeito de conceder sem rastro (bastaria ligar o GUC na sessão), contra a pergunta 7.
9. **`date_trunc(campo, instante, 'UTC')` em `obs_ai_rate_hit`** no lugar de `date_trunc('day', p_now at time zone 'UTC') at time zone 'UTC'`: mesma resposta, sem depender do fuso da sessão. Rodado: 20:59:59 de Brasília cai no balde 23:59 UTC do mesmo dia.
10. **Índice a mais em `obs_ai_access_log (site_id, at desc)`:** a policy e a tela futura filtram por site; os dois índices do spec são por chave e por pessoa.
11. **`revoke` de privilégio de tabela** nas três tabelas novas (tudo de `anon`; escrita de `authenticated`; tudo dos dois em `obs_ai_rate`), como a MG7 faz. O spec só fala das policies.
12. **Os leitores da E8 e da E11 não "nascem" com o token de leitura: são trocados.** O spec (4a' e 8.1.4) supunha que este plano viria antes; os dois já estão commitados com `EdicaoDoSite` (os planos deles declaram a troca como dívida desta etapa: desvio 15 do plano das ordens 8 e 10, decisão 16 do plano da E11). A Tarefa 6 troca `ler.ts`, `ler-retencao.ts` e `ler-dimensoes.ts`.
13. **A concessão não é "ação de servidor"** (pergunta 1): é SQL do runbook.
14. **`podeVerPrivado` continua existindo e devolvendo `LeituraPrivadaDoSite | null`** (como o spec manda), e ganha uma irmã, `acessoPrivado(siteId)`, que devolve também `edita`. O spec diz "a tela passa a carregar `canEdit` e `podeVerPrivado` separados" sem dizer de onde sai o `canEdit`; aqui os dois saem de uma prova só, para não haver duas guardas de edição por página.
15. **O teste do item 191 aceita tabela ausente, por nome e com prazo.** O item manda afirmar as doze; duas delas não têm SQL (MG12). O teste tem a lista `PODEM_FALTAR`. *(emenda 1: S-I2)* A regra da rodada 0, "tabela da lista que já existe derruba o teste", foi retirada: o banco de integração local tem as tabelas de ensaio do lote C e o banco da CI só tem o que está em `supabase/migrations/`, então uma lista só nunca ficaria verde nos dois. Quem obriga a lista a encolher é a Tarefa 11, que a reduz no commit do envio.
16. **O item 237 não é cumprido inteiro aqui.** Este plano entrega o inventário (as três partes) e os dois testes; o que o inventário achar fora de "só o Observatório" é fechado por outro plano (pergunta 6).
17. *(emenda 1: S-I4)* **"Nenhum controle de edição" é provado nas duas telas privadas, que é o que o item 170 escreve.** A rodada 0 deste plano prometia a ausência em sete telas do Observatório sem ter tarefa que escondesse nada, e o teste não teria como passar. Nas outras telas, os controles que já aparecem para quem só lê ficam **listados pelo nome e provados inofensivos** (clicar não altera nada); escondê-los é da pergunta 8.

---

## 9. Arquivos, tarefas, ordem e paralelismo

Caminhos relativos a `apps/web/`, salvo os que começam por `supabase/`, `docs/` ou `.superpowers/`. "Novo" = arquivo criado por esta etapa. **A lista de cada tarefa é fechada:** se a tarefa precisar de outro arquivo, para e avisa.

**Restrições globais (valem para toda tarefa).** Ler primeiro `.superpowers/sdd/a5-e1-e2/regras-implementador.md` e `.superpowers/sdd/a5-e11/regras-implementador.md`. TypeScript estrito, sem `any`, sem `as unknown as` novo (`bash scripts/check-type-debt.sh`, base 148). Arquivos em kebab-case; mensagens que alguém lê, em português. Teste de servidor com `// @vitest-environment node`. Teste antes do código, com o vermelho guardado no relatório. Commit por lista de arquivos (`git add <arquivos>` e `git commit -m … -- <os mesmos>`), nunca `git add -A`, `stash`, `reset`, `checkout`, `--no-verify` nem push. Nunca commitar `apps/web/next-env.d.ts` nem `apps/web/tsconfig.json`. Nada acima de 4 minutos parado: comando longo com saída em arquivo. Teste de banco: só no `bythiago_int` (`HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run <arquivo> --no-file-parallelism`). *(emenda 1: D-m5 e S-m1)* **Banco livre:** cada `it` de banco desta etapa (Tarefas 1 a 4 e 10 B) aplica a MG11 inteira numa transação e segura, até o `rollback`, trava exclusiva em até doze tabelas e em `pipeline_api_keys`; com outro agente rodando integração no mesmo banco, os testes dele esperam ou os daqui caem no `lock_timeout`. O controlador roda os testes de banco desta etapa sem outro teste de integração em paralelo, e o erro 55P03 quer dizer "banco ocupado, repetir", não "falhou". Relatório em `.superpowers/sdd/a5-e17-p0/task-<N>-report.md`, resposta em até 10 linhas. O ledger `.superpowers/sdd/a5-e17-p0/progress.md` é do controlador.

| T | O que | Arquivos (lista fechada) | Depende de | Pode rodar junto com |
|---|---|---|---|---|
| 0a | Conferências P1 a P10, a metade de produção da P12 e a P14 em produção (leitura); P11 e P13, locais *(emenda 2: D-m-a e S-n5)* | `.superpowers/sdd/a5/conferencias-c0-resultado.md` (seção nova "C0.7b"); o ledger | nada; **quem roda é o controlador** | todas |
| 0b | Conferência P0 (forma de `requireSiteScope`) | só o relatório da tarefa | nada | todas |
| 1 | SQL de ensaio da MG11, roteiro de prova e teste de schema | *(emenda 1: S-I2: os três primeiros mudaram para caminho versionado)* `test/fixtures/sql/a5-e17-p0-mg11.sql` (novo); `test/fixtures/sql/a5-e17-p0-prova.sql` (novo); `test/fixtures/sql/a5-e17-p0-prova-saida.txt` (novo); `test/integration/observatorio-a5-e17-p0-schema.test.ts` (novo); `test/helpers/mg11.ts` (novo) | nada | 0a, 0b, 7, 9, 10A |
| 1b | O arquivo da migration. **Só na vez do lote C** | `supabase/migrations/<carimbo>_observatorio_a5_e17_direito_desempenho_privado.sql` (novo, por `db:new`); *(emenda 1: S-I2)* `test/fixtures/sql/a5-e17-p0-mg11.sql` (apagado no mesmo commit: o auxiliar passa a ler o da migration) | Tarefa 1; P1 a P12 anotadas *(emenda 2: D-m-a e S-n5: dizia P1 a P10)*; o arquivo da MG14 existir; o acordo dos dois especialistas sobre o plano **e** a saída da Tarefa 1, passo 2, vista pelos dois; o aviso do controlador | nenhuma de banco |
| 2 | RLS do direito contra o banco (itens 169, 232 e 236) | `test/integration/observatorio-a5-e17-p0-rls.test.ts` (novo) | Tarefa 1 | 3, 4, 7, 9, 10A |
| 3 | A lista das doze e as exceções (item 191, OP-16) | `test/integration/observatorio-a5-e17-p0-doze.test.ts` (novo) | Tarefa 1 | 2, 4, 7, 9, 10A |
| 4 | O contador de taxa e o `check` das chaves (item 239, metade de banco) | `test/integration/observatorio-a5-e17-p0-taxa.test.ts` (novo) | Tarefa 1 | 2, 3, 7, 9, 10A |
| 5 | O token `LeituraPrivadaDoSite` | `src/lib/youtube/observatorio/proprio/leitura-privada.ts` (novo); `src/lib/youtube/observatorio/proprio/leitura-privada.type-test.ts` (novo); `test/youtube/observatorio/proprio-leitura-privada.test.ts` (novo); `test/youtube/observatorio/leitura-teste.ts` (novo); `test/youtube/observatorio/proprio-varredura.test.ts` (existente) | **A4 liberada**; 0b | 1 a 4, 7, 9, 10A |
| 6 | Os leitores e as páginas passam a pedir o token de leitura | os 8 arquivos de `src` e os testes da lista da Tarefa 6 | Tarefa 5 | 1 a 4, 9, 10A (não com a 7, que lê os mesmos mocks) |
| 7 | As ações que escrevem recusam quem só vê (item 170, meio) | `test/youtube/observatorio/acoes-recusam-leitora.test.ts` (novo) | nada (não toca código de produção) | todas menos a 6 |
| 8 | A leitora no navegador (item 170, fim) | `e2e/fixtures/global-setup.ts` (onde vive `E2E_PASSWORDS`) e `e2e/fixtures/auth.setup.ts` (existentes); `e2e/tests/cms/observatorio/direito-leitora.spec.ts` (novo) | Tarefas 6 e 1b; A4 liberada; a MG11 aplicada no banco do navegador pelo controlador (P13; *emenda 1: S-m5*); navegador só em subagente Sonnet | 9, 10 |
| 9 | Runbook da concessão | `docs/ops/observatorio-direito-desempenho-privado.md` (novo) | nada | todas |
| 10 | Inventário do que um `reporter` alcança (item 237, OP-7): A páginas e rotas; B banco; C navegador | A: `.superpowers/sdd/a5-e17-p0/inventario-reporter.md` (novo). B: `test/integration/observatorio-a5-e17-p0-reporter-banco.test.ts` (novo). C: `e2e/tests/cms/reporter-menu.spec.ts` (novo) | A: nada. B: Tarefa 1 e P3. C: Tarefa 8 | A com todas; B com 2 a 4; C depois da 8 |
| 11 | Envio e conferências | `src/lib/conferencias.ts` e `test/lib/conferencias.test.ts` (existentes, compartilhados); `.superpowers/sdd/a5/conferencias-com-data.md`; o ledger; *(emenda 1: S-I2)* `test/integration/observatorio-a5-e17-p0-doze.test.ts` e `observatorio-a5-e17-p0-reporter-banco.test.ts` (só para encolher as listas do que pode faltar) | tudo acima; A4 em `staging`; lote C aplicado e V1 a V6 anotadas | nenhuma |

*(emenda 1: D-m5 e S-m1)* **"Pode rodar junto" vale para escrever, não para rodar contra o banco.** As Tarefas 1, 2, 3, 4 e 10 B podem ser escritas ao mesmo tempo, mas cada rodada de teste de banco delas é feita **uma de cada vez**, e sem teste de integração de outra etapa em paralelo (a regra "Banco livre" das restrições globais): rodadas simultâneas disputariam as mesmas travas exclusivas e cairiam no `lock_timeout`.

**Arquivos compartilhados com OUTRAS etapas (uma tarefa só toca cada um).**

| Arquivo | Quem mais mexe | Tarefa daqui | Cuidado |
|---|---|---|---|
| `src/lib/youtube/observatorio/proprio/ler.ts` | A4 (dona), E6 P2, E18 | 6 | só o tipo `Pedido`, o import e `siteAutorizado`; nenhuma consulta muda. `git status` limpo no arquivo antes de editar |
| `proprio/ler-retencao.ts` (E8), `proprio/ler-dimensoes.ts` (E11) | E8, E11 | 6 | idem: duas e três linhas |
| `_proprio/dados.ts`, `_proprio/carregar-extras.ts`, `_chrome/page-data.ts`, `canal/[id]/page.tsx`, `video/[id]/page.tsx` | A4 | 6 | idem |
| `test/youtube/observatorio/proprio-varredura.test.ts` | A4 | 5 e depois 6, **em sequência** (a 6 depende da 5) | a 5 acrescenta regras; a 6 aperta uma |
| os 27 testes da lista da Tarefa 6 (F15; *emenda 1: S-I3*; *emenda 2: S-n3*: eram 25, entraram `proprio-impressoes.test.tsx` e `proprio-formato.test.ts`) | A4, E8, E11 | 6 | só a troca do auxiliar e do nome do campo; nas sete afirmações de segurança (as duas da emenda 1 e as cinco da emenda 2), o acréscimo dos nomes novos |
| `e2e/fixtures/global-setup.ts`, `auth.setup.ts` | A4 (tem alteração sem commit em fixtures, segundo o plano da E11), E6, E8, E18 | 8 | só editar com `git status` limpo no arquivo; só acrescentar a quarta usuária |
| `supabase/migrations/` (carimbo) | MG14, MG5, MG7, MG12 | 1b | o controlador chama os `db:new` em ordem |
| `src/lib/conferencias.ts`, `test/lib/conferencias.test.ts`, `.superpowers/sdd/a5/conferencias-com-data.md` | todas as etapas | 11 | acrescentar um bloco no fim; não reordenar os dos outros |
| `test/integration/observatorio-a5-e17-p0-reporter-banco.test.ts` e `observatorio-a5-e17-p0-doze.test.ts` (novos, desta etapa) *(emenda 2: S-n7)* | **toda trilha que criar, depois deles, tabela com policy de leitura, tabela `yt_own_*`, view, tabela sem RLS ou função `security definer` executável por `authenticated`** (a MG12 e as seguintes) | 10 B e 3 | os dois ficam **vermelhos de propósito** no push dessa trilha até alguém classificar o objeto novo na lista escrita (é o que os itens 237 e 191 pedem). O controlador avisa isso nos planos da MG12 em diante: quem cria o objeto edita a lista no mesmo commit, com a frase da classe. **(reconciliação 13/10: R10) Avisados, com a obrigação escrita na tarefa da migration de cada plano:** E18 (MG12, as duas tabelas das doze), E10 (MG6: três tabelas com policy de leitura e a função `security definer` `obs_archive_uncovered`), E4 (MG4: duas tabelas lidas por `can_view_site`), E9 (MG18: uma tabela lida por `can_edit_site`). Faltam sem aviso próprio, e ficam com o controlador: MG5 e MG7 (planos de ontem), MG15 (o backup, já classificado aqui como "sem policy, RLS ligada") e MG17a, MG16 e MG17 (só funções `security invoker` e um `drop table`: a CP17 do plano da ordem 23 confere `PODEM_FALTAR`) |
| `edicao.ts`, `edicao.type-test.ts`, `types/database.types.ts`, `lib/pipeline/**`, `lib/youtube/coleta/**`, `rules.ts`, `api-registry.ts`, `vercel.json` | várias | **nenhuma** | este plano não abre nenhum deles |

---

## 10. As tarefas

### Tarefa 0a: conferências em produção (controlador)

**Objetivo.** Trocar por medida os fatos que este plano supõe (*emenda 1*: P1 a P10 e a metade de produção da P12; P11 e P13 são locais e também do controlador. *Emenda 2: D-N1*: mais a P14, de produção). **Passos.** Rodar as consultas da seção 0.2, uma a uma, com `npx supabase db query --linked`; anotar o resultado cru; para cada linha, escrever "igual ao esperado" ou a consequência da coluna da direita. **Pronto quando:** todas estão anotadas e nenhuma manda parar; ou a que manda parar virou emenda deste plano, com o roteiro rodado de novo.

### Tarefa 0b: forma de `requireSiteScope`

**Passos.** O `grep` da linha P0. Anotar os valores aceitos de `mode` e a forma do retorno nos dois casos (`ok: true` e `ok: false`). **Pronto quando:** o relatório diz se `guarda.user.id` existe com `mode: 'view'` (o uso em `_chrome/page-data.ts` diz que sim).

### Tarefa 1: SQL de ensaio, roteiro de prova e teste de schema

**Objetivo.** Pôr no repositório o texto final da MG11 (fora de `supabase/migrations/`), o roteiro que a prova e um teste que qualquer um roda.
**Passos, em ordem.**
1. *(emenda 1: S-I2)* Gravar o Apêndice A, sem mudar um caractere, em `apps/web/test/fixtures/sql/a5-e17-p0-mg11.sql`, e o Apêndice B em `apps/web/test/fixtures/sql/a5-e17-p0-prova.sql`. O roteiro inclui o SQL por `\ir` (relativo ao próprio roteiro), então roda de qualquer pasta.
2. *(emenda 1: D-I1 e S-I1)* Com o banco de integração livre, rodar **duas vezes**: `psql -X "postgresql://postgres:postgres@127.0.0.1:54422/postgres" -f apps/web/test/fixtures/sql/a5-e17-p0-prova.sql 2>&1 | sed -E 's/^psql:[^ ]*:[0-9]+: //' > apps/web/test/fixtures/sql/a5-e17-p0-prova-saida.txt` (o `sed` tira o nome do arquivo e o número da linha dos avisos, que mudam a cada edição do roteiro). As duas saídas têm de ser iguais entre si e à do Apêndice B, fora as três linhas `custo:`. *(emenda 2: D-m-c)* Como o comando grava as duas rodadas no mesmo arquivo com `>`, a segunda apagaria a primeira e "iguais entre si" não teria como ser conferido: a **primeira** rodada grava num arquivo temporário fora do repositório (na pasta de rascunho da sessão, por exemplo `<rascunho>/mg11-prova-1.txt`, trocando só o destino do `>`), a segunda grava no caminho versionado, e a comparação é `diff <(grep -v 'custo:' <rascunho>/mg11-prova-1.txt) <(grep -v 'custo:' apps/web/test/fixtures/sql/a5-e17-p0-prova-saida.txt)`, que tem de sair vazio; o relatório anota o comando e o resultado. **O roteiro foi reescrito e nunca rodou**, então a primeira rodada pode discordar, e a regra é esta: erro de escrita do roteiro (sintaxe, coluna obrigatória de uma tabela da semente) conserta-se no roteiro e anota-se no relatório; **valor diferente** (uma linha da matriz, uma contagem, um código de erro, `PASSOU (defeito)`) não se conserta no roteiro: a tarefa para e a diferença volta ao plano. A saída gravada passa a ser a guardada, e o controlador a copia para o Apêndice B. Conferir depois que nada ficou: `select to_regclass('public.site_private_viewers') is null, (select count(*) from auth.users where email like '%@mg11.test');` tem de dar `t` e `0`.
3. Escrever `test/helpers/mg11.ts`: `garantirMg11(pg: Client): Promise<'ja_aplicada' | 'aplicada_na_transacao'>`. *(emenda 1: S-I2 e D-m5)* O arquivo é procurado nesta ordem: o de `supabase/migrations/` cujo nome termina em `_observatorio_a5_e17_direito_desempenho_privado.sql` (existe depois da 1b) e, se não houver, `test/fixtures/sql/a5-e17-p0-mg11.sql`. Os dois são versionados, então a CI os enxerga antes e depois da 1b. O auxiliar **executa o arquivo sempre**, dentro da transação que o teste abriu (o arquivo é idempotente, e o teste termina sempre em `rollback`), e devolve `ja_aplicada` se `to_regclass('public.site_private_viewers')` não era nulo antes, ou `aplicada_na_transacao`. Executar sempre é o que impede o defeito apontado em D-m5: com a rodada 0, um banco que já tivesse a MG11 de uma versão anterior deixaria os testes verdes contra o SQL velho. Como `create table if not exists` não conserta uma tabela de forma antiga, o auxiliar confere depois, e **lança** com "o banco tem outra versão da MG11" se as colunas de `site_private_viewers` não forem exatamente `site_id, user_id, granted_by, granted_at, revoked_at, revoked_by`, ou se `pg_get_triggerdef` do gatilho não contiver `UPDATE OF revoked_at`, ou, *(emenda 2: D-m-g)*, se não existir em `pg_constraint` o `check` `site_private_viewers_revoked_by_so_retirada`. Se nenhum dos dois arquivos existir, **lança** (nunca pula). *(emenda 2: S-n2)* A assinatura é `garantirMg11(pg: Client, opcoes?: { conferirForma?: boolean })`, com `conferirForma` verdadeiro por padrão. `conferirForma: false` desliga só a conferência de forma deste parágrafo e existe para **um** uso: a rodada da mutação (f) da Tarefa 2, que muda o gatilho de propósito (com a conferência ligada o auxiliar lançaria em todos os testes antes de qualquer afirmação, e a mutação não provaria nada). Nenhum teste commitado passa `false`: o teste de schema afirma, pela leitura dos arquivos `observatorio-a5-e17-p0-*.test.ts`, que `conferirForma` não aparece em nenhum deles.
4. Escrever o teste de schema, que falha primeiro (o auxiliar ainda não existe), e depois o auxiliar.

**Testes** (`observatorio-a5-e17-p0-schema.test.ts`; cada `it` abre `begin`, chama `garantirMg11`, afirma e faz `rollback`):
- `a migration aplica duas vezes seguidas sem erro` (*emenda 1: D-m5*: o auxiliar agora executa o arquivo sempre; o teste o executa mais uma vez depois dele, nos dois estados).
- `V1 dá 3, 2, 6, 1, 8, 2, 1, 1` (a consulta da seção 2, letra por letra).
- `as cinco _as, obs_ai_rate_hit e a função do gatilho não são executáveis por anon nem por authenticated` (por `has_function_privilege`; **nunca chamar**).
- `a função de sessão é executável por anon, authenticated e service_role`.
- `as oito funções têm search_path vazio e nenhuma cita app.site_id no corpo` (`prosrc not ilike '%app.site_id%'` e `not ilike '%current_setting%'`).
- `sem as funções de RBAC a migration recusa com a frase "MG11 depende"`: dentro da transação, `alter function public.can_edit_site(uuid) rename to can_edit_site_x`, executar só o bloco de guardas, esperar a exceção.
- `policy de outro nome numa das doze faz a migration recusar`: criar `"intrusa"` em `yt_own_video_daily`, executar o arquivo, esperar "tem policy fora do padrão (intrusa)"; e afirmar que depois do `rollback` nada mudou.
- `tabela da lista que não existe é pulada, não é erro` (dado ausente): `drop table` de uma das doze que exista e não tenha dependente, dentro da transação, e executar.
- `usuário nulo, site nulo e site inexistente dão false, nunca nulo` (quatro chamadas, como `postgres`).
- `as colunas novas de pipeline_api_keys são anuláveis e nenhuma linha existente mudou` (contagem e `md5` de `string_agg` das linhas antes e depois).
- *(emenda 1: D-m1, S-I5 e D-m2)* `o gatilho de rastro dispara em insert e em update de revoked_at, e em mais nada` (`pg_get_triggerdef`), e `site_private_viewers tem as seis colunas, com revoked_by anulável e chave para auth.users com on delete set null` (`pg_constraint.confdeltype = 'n'`).
- *(emenda 2: D-m-g)* `revoked_by numa linha em vigor é recusado (23514); numa linha retirada entra; reconceder, que limpa as duas colunas, passa`.
- *(emenda 2: S-n2)* `nenhum teste commitado desta etapa desliga a conferência de forma` (o texto `conferirForma` não aparece em nenhum `test/integration/observatorio-a5-e17-p0-*.test.ts`).

**Pronto quando:** as duas saídas da prova são iguais entre si e à do Apêndice B (ou a diferença voltou ao plano); o teste está verde no `bythiago_int`; `git status` mostra só os cinco arquivos da lista. *(emenda 1: S-I2)* Os cinco são versionados; e o commit tem de ficar verde também no banco da CI, que não tem as tabelas de ensaio do lote C: nenhum teste desta tarefa pode supor uma tabela da lista das doze além das que estão em `supabase/migrations/` (o teste "tabela que não existe é pulada" escolhe, entre as que existirem, uma sem dependente).

### Tarefa 1b: o arquivo da migration (só na vez do lote C)

**Passos.** Conferir que P1 a P12 estão anotadas e que nenhuma manda parar *(emenda 1)* (*emenda 2: D-N1*: a P14 não trava esta tarefa; trava a 9), e que o roteiro do Apêndice B já rodou duas vezes com a saída esperada (Tarefa 1, passo 2) e os dois especialistas viram essa saída. `npm run db:new observatorio_a5_e17_direito_desempenho_privado` (o controlador confirma a ordem: depois da MG14, ~~antes da MG5~~ (reconciliação 13/10, emenda 2: D2-m1) e depois da MG5 e da MG7, que já estão aplicadas; ~~antes da MG12~~ (reconciliação 13/10, emenda 3: m2) **antes da MG12 só se as duas forem no mesmo `db:push:prod`. Se a MG12 e a MG17a já tiverem ido sem a MG11 (passo 4 da seção 3 da reconciliação; seção 2 do plano da E18), "antes da MG12" é impossível: o carimbo é o da vez, posterior ao delas, e a lista da MG11 inclui as duas tabelas da MG12**). Copiar `apps/web/test/fixtures/sql/a5-e17-p0-mg11.sql` para o arquivo criado; `diff` entre os dois tem de ser vazio. Rodar a prova duas vezes de novo, agora contra o arquivo da migration (`psql -X … -v mg=<caminho absoluto do arquivo criado> -f apps/web/test/fixtures/sql/a5-e17-p0-prova.sql`). *(emenda 1: S-I2)* Apagar `a5-e17-p0-mg11.sql` no mesmo commit, para não haver duas cópias: `garantirMg11` passa a achar o da migration, e os testes que executam o arquivo continuam verdes na CI. *(emenda 2: D-m-d e S-n5)* A partir deste commit o roteiro `a5-e17-p0-prova.sql` **só roda com `-v mg=<caminho absoluto do arquivo da migration>`**: o padrão de `:mg` aponta para o arquivo apagado, e rodar sem a opção falha com "arquivo não encontrado". É a falha certa (em vermelho) e está escrita no cabeçalho do roteiro; ninguém a "conserta" recriando a cópia. Depois do commit, o passo 2b da seção 2 (o controlador aplica no `bythiago_int` e roda o teste de 40 conexões) vem **antes** do `db:push:prod`. `npm run db:which` para confirmar que **não** há ligação ativa com produção antes de qualquer comando local. Commit só do arquivo. **Nunca** `db:push:prod`.
**Pronto quando:** arquivo commitado localmente; `diff` vazio anotado; saídas da prova iguais; *(emenda 1: S-m3)* o teste de 40 conexões verde no `bythiago_int` com a MG11 aplicada de verdade.

### Tarefa 2: RLS do direito contra o banco (itens 169, 232 metade, 236 metade)

**Objetivo.** Provar, com papel sem superusuário e com o GUC forjado, quem lê e quem não lê cada tabela.
**Molde.** `test/integration/observatorio-a5-e14-rls.test.ts` (o `cenario()`, o `como()` com `set_config('request.jwt.claims', …)`, `set_config('app.site_id', <site A>)` e `set local role`). Diferença: aqui **tudo** roda numa transação só por teste (a MG11 pode estar aplicada só nela), então a semente é feita pela conexão `pg`, não pelo cliente de serviço.
**Cenário (o mesmo do Apêndice B).** Dois sites, A e B, em duas organizações filhas da raiz que já existe (F12). *(emenda 1: S-m2)* O cenário não supõe a raiz: usa a que houver e cria uma se o banco não tiver, como `seedSite` já faz (`test/helpers/db-seed.ts:96-121`) e como o roteiro do Apêndice B faz. Nove usuários: `super` (administrador da raiz), `orgadmin` (administrador da organização de A), `editor` (de A), `leitora` (`reporter` de A com linha em vigor), `reporter` (de A, sem linha), `revogada` (`reporter` de A com linha revogada), `exmembro` (linha em vigor em A e **nenhum** vínculo), `editorB` (editor de B), `sem` (nada). Uma linha no site A em cada tabela da lista das doze que existir no banco, e uma em `competitor_video_comment_authors`. A semente de cada tabela é copiada do teste da etapa dona dela (`a5-e6-e8-schema.test.ts`, `a5-e11-rls.test.ts`, `observatorio-a5-e14-rls.test.ts` com `apply_competitor_comment_snap`). **Tabela que existe e não consegue ser semeada faz o teste falhar; não pula.**
**Testes.**
- `a matriz: ver, editar e privado dos 9 usuários nos 2 sites` (os 18 valores do Apêndice B, escritos no teste).
- `sessão e _as respondem igual para os 9 usuários nos 2 sites, com o GUC forjado` (item 236).
- `a leitora lê cada uma das doze que existem` (uma linha de cada).
- `a reporter sem linha, a revogada, a ex-membro, o editor de B, o usuário sem papel e o anon leem zero linha de cada uma das doze` (item 169; `anon` sem `request.jwt.claims`).
- `quem edita continua lendo como antes` (`editor`, `orgadmin` e `super` leem as doze).
- `a leitora recebe zero linha de competitor_video_comment_authors; o editor lê` (item 232).
- `ninguém escreve: insert, update e delete da leitora e do editor em cada uma das doze dão erro ou zero linha` (item 169, "em nenhum caso escreve").
- `forjar app.site_id para o site A não dá nada ao editor de B` e `forjar para o site B não tira nada do editor de A`.
- `a leitora vê só a própria linha de site_private_viewers; a reporter, zero; o administrador da organização, as três do site; ninguém escreve nela como authenticated` (erro 42501, como na prova).
- `retirar o direito corta na mesma transação` (dado de fronteira): `update … revoked_at = now()` e a leitura seguinte dá zero.
- `tirar a leitora do site corta, mesmo com a linha em vigor`: `delete from site_memberships` e a leitura dá zero.
- `revoked_at no futuro já conta como retirado`.
- `tabela de concessões vazia: só quem edita lê` (o estado do dia do deploy; dado ausente).
- `apagar a leitora de auth.users some com a concessão e anula user_id do registro e da chave; apagar quem concedeu anula granted_by`.
- `cada concessão e cada retirada grava uma linha em audit_log, com org_id preenchido; conceder a quem já tem não grava nada`.
- *(emenda 1: D-m1 e S-I5)* `apagar quem concedeu, e apagar quem retirou, não grava linha nenhuma em audit_log`: a contagem de `audit_log where resource_type = 'site_private_viewers'` é igual antes e depois do `delete from auth.users`, e `granted_by` e `revoked_by` ficam nulos.
- *(emenda 1: D-m2)* `retirar grava revoked_by; reconceder o limpa; a linha de rastro da retirada leva revoked_by no "depois"`.
- *(emenda 2: D-N1)* `corrigir o autor em branco não muda quem lê e não grava rastro`: numa linha retirada com `revoked_by` anulado à mão, o comando "corrigir autor em branco" do Apêndice C altera 1 linha, `revoked_at` continua preenchido, `can_view_private_site_as` da pessoa continua `false` e a contagem de `audit_log where resource_type = 'site_private_viewers'` é igual antes e depois; o mesmo para `granted_by` numa linha em vigor (a pessoa continua lendo, zero rastro novo).
- *(emenda 2: D-N1)* `a receita antiga, pelo nome: numa linha retirada, "retirar" altera 0 linha e "conceder" devolve o direito`: o teste afirma o `UPDATE 0`, o `INSERT … 1 linha` e que a pessoa **volta a ler**. Não é um defeito do SQL (conceder a quem foi retirado é o que a instrução faz); o teste existe para a frase "nunca conceder para consertar uma linha retirada" do runbook ter uma prova de por quê.

**Provas por mutação pedidas** (o implementador faz a mutação no arquivo de ensaio, roda, vê o teste falhar, desfaz, e anota no relatório): (a) tirar `and v.revoked_at is null` → o teste da revogada falha; (b) tirar o `exists` de `site_memberships` → o da ex-membro falha; (c) trocar `v.site_id = p_site` por `true` → falha o teste de site cruzado (a leitora passaria a ler o site B: acrescentar ao cenário uma linha privada em B para isso); (d) trocar `m.role = 'editor'` por `true` em `can_edit_site_as` → a reporter sem linha passa a ler; (e) tirar uma tabela do laço → o teste "a leitora lê cada uma" falha naquela tabela; *(emenda 1: D-m1 e S-I5)* (f) trocar `update of revoked_at` por `update` no gatilho → o teste "apagar quem concedeu não grava linha nenhuma" falha. *(emenda 2: S-n2)* Só nesta rodada o implementador chama, numa cópia de trabalho que **não é commitada**, `garantirMg11(pg, { conferirForma: false })`: com a conferência de forma ligada o auxiliar lançaria "o banco tem outra versão da MG11" em todos os testes, e o teste nomeado cairia pelo auxiliar, não pela contagem. O relatório anota a mensagem de falha **do teste nomeado** (a contagem de `audit_log` diferente antes e depois), não a do auxiliar; se a mensagem anotada for a do auxiliar, a mutação não conta como provada.
**Pronto quando:** verde no `bythiago_int`; as seis mutações anotadas com o nome do teste que cada uma derrubou e, na (f), com a mensagem da contagem.

### Tarefa 3: a lista das doze e as exceções (item 191, OP-16)

**Contrato do teste** (`observatorio-a5-e17-p0-doze.test.ts`, com `garantirMg11` na transação): (reconciliação 13/10, emenda 2: S2-m3) **antes de escrever as listas, ler `.superpowers/sdd/a5/fila-do-db-push.md`, seção "pares e classificações pendentes"**: os planos da E10, da E4, da E9 e da ordem 23 deixam lá as tabelas e funções que criaram antes de este teste existir. Cada linha de lá entra numa das listas abaixo (e no teste `-reporter-banco`) no commit que cria o teste, e a linha sai do arquivo no mesmo commit. (reconciliação 13/10, emenda 3: n6) **Arquivo ausente: parar e perguntar ao controlador. Ausente não é vazio** (quem cria o arquivo é o controlador, antes do primeiro `db:new`; em 13/10 ele ainda não existe).
- `DOZE` (as doze, escritas); `EM_EDICAO = ['yt_own_collection_attempts', 'competitor_video_comment_authors', 'competitor_raw', 'yt_reporting_reports', 'yt_reporting_jobs']`; `EM_LEITURA_DO_SITE = ['yt_own_public_video_hourly', 'yt_own_public_video_early', 'yt_own_public_hour_map', 'yt_own_public_hour_fold_log']`; `SEM_POLICY = ['yt_own_collection_runs', 'yt_reporting_report_blobs', 'yt_own_video_daily_zeros_bkp']` (a última é a classificação que a OP-16 pede: cópia de segurança da MG15, RLS ligada, nenhuma policy); `PODEM_FALTAR = ['yt_own_video_versions', 'yt_own_versions_state', 'yt_own_video_daily_zeros_bkp']` mais as que o lote C ainda não criou no banco do teste.
- `cada uma das doze que existe tem exatamente uma policy, <tabela>_select, de SELECT, com can_view_private_site(site_id)`.
- `nenhuma das doze ficou em can_edit_site`.
- `as exceções, pelo nome: cinco em can_edit_site, quatro em can_view_site, três sem policy e com RLS ligada`.
- `toda tabela yt_own_* de public está na lista das doze ou nas exceções` (lê `pg_class`; tabela nova sem classificação derruba o teste, com o nome dela na mensagem).
- `tabela ausente só é aceita se estiver em PODEM_FALTAR` *(emenda 1: S-I2: a segunda metade da rodada 0, "tabela de PODEM_FALTAR que já existe derruba o teste", saiu; ver "Os três bancos" abaixo)*.
- `nenhuma das doze tem policy de escrita`.

**Dado ausente.** Banco sem nenhuma das doze: o teste **falha** ("nenhuma tabela da lista existe: banco errado"), não passa vazio.
*(emenda 1: S-I2)* **Os três bancos.** (1) `bythiago_int`: tem as tabelas de ensaio dos lotes B e C; faltam as duas da MG12 e a da MG15. (2) Banco da CI antes do lote C virar arquivo: só o que está em `supabase/migrations/`, isto é, das doze só as que as migrations já criam (as três que a produção já tinha em 12/10 e as duas de comentário da MG8: F3). (3) Banco da CI depois do lote C: as doze, menos o que a MG12 ainda não tiver. A regra "o que existe tem de estar classificado e certo" vale nos três. A regra de ausência vale pela lista: `PODEM_FALTAR` nasce com tudo o que o banco (2) não tem (as cinco das MG14, MG5 e MG7, as duas da MG12 e a da MG15), e a Tarefa 11 a encolhe no commit do envio. Banco sem nenhuma das doze continua sendo falha.
**Pronto quando:** verde no `bythiago_int` e, pela leitura das migrations, no banco da CI (o relatório lista, para cada uma das doze, em qual dos três bancos ela existe); a Tarefa 11 reduz `PODEM_FALTAR` a `yt_own_video_daily_zeros_bkp` (que só nasce na MG15), mais as duas da MG12 se ela ainda não tiver entrado, depois do lote C inteiro.

### Tarefa 4: o contador de taxa e o `check` das chaves (item 239, metade de banco)

**Por que agora.** A função é da MG11 e é SQL: provar a atomicidade aqui evita descobrir o defeito no degrau 2. A metade "30 servidas e 10 `limite`" é do código do degrau 2.
**Testes** (`observatorio-a5-e17-p0-taxa.test.ts`).
- `quatro chamadas em sequência contam 1, 2, 3 no mesmo minuto e 1 no minuto seguinte; o dia vira à meia-noite UTC` (os valores do Apêndice B, com as quatro datas de lá, incluída a de 20:59:59 de Brasília).
- `40 chamadas ao mesmo tempo, com a mesma chave e o mesmo instante, devolvem os números de 1 a 40 sem repetição e a linha fica com n = 40`. **Este é o único teste do plano que não cabe numa transação:** exige 40 conexões e dado commitado. Só roda quando a MG11 está aplicada de verdade (`to_regclass('public.obs_ai_rate')` não nulo fora de transação). *(emenda 1: S-I2)* Antes disso o teste **pula com o motivo escrito** ("a MG11 ainda não está aplicada neste banco: roda depois da Tarefa 1b"). A rodada 0 mandava falhar; isso deixaria vermelho o portão de banco da CI no próximo push de qualquer trilha. Pular aqui não é verde falso porque há três cobranças: o relatório da tarefa diz "pulado: 1" pelo nome; o passo 2b da seção 2 exige o teste verde no `bythiago_int` antes do `db:push:prod`; e, depois da 1b, a CI tem a tabela e passa a rodá-lo em todo push. *(emenda 1: S-m4)* O teste grava só pela conexão `pg`, nunca pelo cliente de serviço, e antes de gravar afirma que o host da conexão é `127.0.0.1` ou `localhost` (`apps/web/.env.local` aponta para produção); host diferente = o teste lança sem gravar. *(emenda 2: S-n7)* O host não basta: sem `SUPABASE_DB_URL`, os auxiliares caem na porta 54322 (`test/helpers/db-seed.ts:19-20`), que é o banco do navegador, e é `127.0.0.1` também. Fora da CI (`process.env.CI` ausente), o teste só grava se a porta da conexão for 54422; em outra porta ele **pula com o motivo escrito** ("fora da CI este teste só grava no banco de integração, porta 54422") em vez de lançar, porque lançar deixaria vermelha a suíte de quem roda `HAS_LOCAL_DB=1 npm test` contra o banco padrão, e as três cobranças acima (relatório, passo 2b, CI) continuam valendo. Na CI a porta é a do banco da CI e a regra da porta não se aplica. *(emenda 1: S-m3)* Afirma também que **nenhuma** das 40 chamadas falhou, e em especial que não houve erro 40P01 (travamento cruzado): a função faz os dois `insert` em duas CTEs, e a documentação do Postgres não promete a ordem de execução entre elas. Se aparecer 40P01, a função passa a `language plpgsql` com os dois `insert … returning … into` em sequência (minuto, depois dia), e isso é emenda do Apêndice A **antes** do `db:push:prod`. Limpa a chave de teste e as linhas no `afterAll`.
- `chave que não existe: a chamada dá erro de chave estrangeira e nada é gravado` (dado ausente).
- `tabela vazia: a primeira chamada devolve 1 e 1`.
- `chave com observatorio_leitura e outra permissão é recusada no insert e no update (23514); chave só com observatorio_leitura entra; as três chaves de hoje não são afetadas`.
- `apagar a chave apaga os contadores dela (cascata) e anula key_id no registro`.
- `authenticated não lê nem escreve obs_ai_rate (42501)` e `lê zero linha de obs_ai_access_log sem ser administrador do site`.

**Pronto quando:** os testes de transação verdes; o de 40 conexões anotado como "pulado: espera a 1b" e rodado pelo controlador no passo 2b da seção 2, antes do `db:push:prod` *(emenda 1: S-m3)*.

### Tarefa 5: o token `LeituraPrivadaDoSite`

**Objetivo.** O arquivo irmão de `edicao.ts`, com a mesma fabricação e o caminho de nascimento de 4.4.
**Contrato** (`src/lib/youtube/observatorio/proprio/leitura-privada.ts`, com `import 'server-only'`):
```ts
export class LeituraPrivadaDoSite { get siteId(): string }           // construtor privado, campo #siteId, congelada
export type MotivoSemLeitura = 'sem_direito' | 'nao_foi_possivel_conferir'             // (emenda 1: D-m6)
export interface AcessoPrivado { leitura: LeituraPrivadaDoSite | null; edita: boolean; negativa: MotivoSemLeitura | null }   // negativa é null se, e só se, há leitura
export function provarAcessoPrivado(siteId: string): Promise<AcessoPrivado>             // nunca lança
export const provarLeituraPrivada: (siteId: string) => Promise<LeituraPrivadaDoSite | null>   // = (await provarAcessoPrivado(siteId)).leitura
export const leituraValida: (l: unknown) => l is LeituraPrivadaDoSite                   // brand check do campo privado
```
- Importa de `./edicao` só `provarEdicao` e `edicaoValida`. `edicao.ts` **não muda**.
- Passo 3 de 4.4: `getSupabaseServiceClient().rpc('can_view_private_site_as', { p_user, p_site })`. Os nomes dos parâmetros são os do Apêndice A; errar o nome dá erro de função inexistente, que é falha fechada, e o teste de integração da Tarefa 8 pega.
- Eventos no Sentry, todos com `tags: { component: 'observatorio-proprio', step: 'provar-leitura-privada' }` e `extra: { siteId, motivo }`, onde `motivo` é um de `'guarda_falhou' | 'funcao_ausente_ou_erro' | 'resposta_inesperada'`. O `extra` leva o `code` do erro do banco, **nunca** a mensagem crua nem o id do usuário.
- `edita` só é `true` quando o passo 1 devolveu o token de edição. Nunca é derivado de outra coisa.
- *(emenda 1: D-m6)* `negativa` (o nome é outro de propósito: `motivo` já é o campo do `extra` do Sentry, linha acima, com três valores próprios): `'sem_direito'` quando a resposta foi uma negação de verdade (sem sessão, sem vínculo, a função respondeu `false`, `siteId` que não é uuid); `'nao_foi_possivel_conferir'` quando não houve resposta confiável (a guarda lançou, a função deu erro ou não existe, a resposta não é `true` nem `false`). Nenhuma tela o lê neste plano e ele não entra em `ChannelPage`; existe para o lote de UX. Ausência de resposta nunca vira `'sem_direito'`.

**Prova de tipo** (`leitura-privada.type-test.ts`, mesmo molde de `edicao.type-test.ts`: uma função exportada, nada fora dela; o `tsc` do web a compila). Cinco `@ts-expect-error`: objeto literal não é `LeituraPrivadaDoSite`; `new` não compila; `extends` não compila; **uma `LeituraPrivadaDoSite` não é atribuível a `EdicaoDoSite`** (item 170); uma `EdicaoDoSite` não é atribuível a `LeituraPrivadaDoSite` (a conversão só existe dentro de `provarAcessoPrivado`).

**Testes** (`proprio-leitura-privada.test.ts`, `// @vitest-environment node`, com `vi.mock` de `@tn-figueiredo/auth-nextjs/server`, de `@/lib/supabase/service` e de `@sentry/nextjs`):
- `quem edita recebe a leitura e edita = true, sem chamar a função do banco nem a guarda de leitura` (o mock do cliente de serviço não é chamado: é o que garante que quem edita não depende da MG11).
- `quem não edita, tem vínculo e a função responde true: recebe a leitura e edita = false`.
- `a função responde false: sem token`.
- `a função responde null, 'true', 1, {}, []: sem token e um aviso de resposta inesperada para cada` (dado ausente e forma errada).
- `a função dá erro PGRST202 (função ausente): sem token e uma exceção no Sentry com motivo funcao_ausente_ou_erro`.
- `a função dá erro de rede (o rpc lança): sem token, nada escapa, uma exceção no Sentry`.
- `sem sessão: sem token, sem criar o cliente de serviço` (o construtor do mock não é chamado).
- `sessão sem vínculo: idem`.
- `a guarda lança: sem token, motivo guarda_falhou`.
- `siteId que não é uuid: sem token, sem chamar a guarda de leitura nem o banco`.
- `a função é chamada com o id que a GUARDA devolveu e o site pedido, e com mais nada` (afirma os argumentos exatos; nenhum id vindo de parâmetro externo).
- `o token carrega o site pedido e é congelado; JSON.stringify não mostra o site; structuredClone não passa em leituraValida`.
- `forjados não passam em leituraValida: objeto literal, Object.create(prototype), Reflect.construct, subclasse, e um EdicaoDoSite de verdade`.
- `a classe é congelada: provarAcessoPrivado não se troca por fora`.
- `provarLeituraPrivada devolve exatamente a leitura de provarAcessoPrivado`.
- *(emenda 1: D-m6)* Cada teste acima afirma também a `negativa` do retorno: `null` com leitura; `'sem_direito'` em "responde false", "sem sessão", "sessão sem vínculo" e "siteId que não é uuid"; `'nao_foi_possivel_conferir'` em "responde null, 'true', 1, {}, []", "erro PGRST202", "erro de rede" e "a guarda lança".

**Auxiliar de teste** (`leitura-teste.ts`): `leituraDe(siteId)` (pelo caminho de quem edita, com a guarda simulada) e `leituraPorDireitoDe(siteId)` (guarda de edição negando, guarda de leitura aceitando, função respondendo `true`). Como em `edicao-teste.ts`: não existe construtor de teste.

**Varredura** (`proprio-varredura.test.ts`, só acréscimos; os testes que já existem ficam verdes sem mudar): o módulo novo entra em `PODE_PROVAR`; regras novas, cada uma com o seu controle negativo: `new LeituraPrivadaDoSite` ou `LeituraPrivadaDoSite.provar` fora do módulo; uso da classe como valor; import como valor; import por namespace ou dinâmico; `provarAcessoPrivado(` ou `provarLeituraPrivada(` fora do módulo e de `_proprio/dados.ts`; `can_view_private_site_as` citado em qualquer arquivo de `src` que não seja o módulo; componente cliente importando o módulo; a prova de tipo nova tem 5 diretivas e uma função só; `leitura-privada.ts` pede a guarda de leitura com `mode: 'view'` e **não** contém `mode: 'edit'` (quem pede edição é `edicao.ts`).

**Provas por mutação pedidas:** (a) trocar `data === true` por `data !== false` → o teste do `null` falha; (b) tirar o passo 2 → o teste "sem sessão" falha; (c) passar um id fixo no lugar de `guarda.user.id` → o teste dos argumentos falha; (d) devolver `edita: true` no caminho do direito → o teste "edita = false" falha; *(emenda 1: D-m6)* (e) devolver `'sem_direito'` no caminho do erro de rede → o teste da `negativa` falha.
**Pronto quando:** testes e varredura verdes; `npx tsc --noEmit -p apps/web` sem erro (a prova de tipo compila, isto é, as cinco linhas dão erro como devem); nenhum arquivo fora da lista.

### Tarefa 6: os leitores e as páginas passam a pedir o token de leitura

**Objetivo.** Trocar o tipo que abre o dado privado, sem mudar nenhuma consulta. Um commit só (os oito arquivos precisam compilar juntos).
**Arquivos de `src` (8).** `lib/youtube/observatorio/proprio/ler.ts`, `ler-retencao.ts`, `ler-dimensoes.ts`; `app/cms/(authed)/youtube/competitors/_proprio/dados.ts`, `_proprio/carregar-extras.ts`, `_chrome/page-data.ts`, `canal/[id]/page.tsx`, `video/[id]/page.tsx`. **(reconciliação 13/10: R11) Mais um par, se já existir no dia: `lib/youtube/observatorio/proprio-versoes/ler.ts` e `test/youtube/observatorio/versoes-proprio-ler.test.ts` (plano da E18, Tarefa 9). O leitor de lá é escrito com `edicaoValida(p.edicao)` sobre o mesmo `Pedido`, e o plano dele dizia que acompanharia esta troca sem mudança; não acompanha (o campo muda de nome). Se a Tarefa 9 de lá vier depois desta, é ela que nasce com o token novo.**
**Arquivos de teste.** `test/youtube/observatorio/`: `proprio-varredura.test.ts`, `proprio-dados.test.ts`, `proprio-a4-so-seu-canal-dados.test.ts`, `proprio-ler.test.ts`, `proprio-ler-db.test.ts`, `proprio-ler-retencao.test.ts`, `proprio-ler-retencao-db.test.ts`, `proprio-ler-dimensoes.test.ts`, `proprio-header-model.test.ts`, `proprio-reguas-model.test.ts`, `proprio-videos-model.test.ts`, `proprio-rota.test.ts`, `proprio-video-rota.test.ts`, `canal-page-data.test.ts`; `test/integration/`: `a5-e11-schema.test.ts`, `observatorio-a5-e11-passos.test.ts`. **`proprio-edicao.test.ts` e `edicao-teste.ts` não mudam** (o token de edição continua existindo e sendo testado).
*(emenda 1: S-I3)* **Mais nove, que a rodada 0 deixou de fora** (todos em `test/youtube/observatorio/`; `test/**` está fora do `tsconfig.json` do web, então o `tsc` não acusaria nenhum deles):
- `proprio-carregar-extras.test.ts` (linhas 128 a 175): passa `{ edicao, canalId, diario }` como `previo`; vira `leitura`.
- `proprio-canal-seguranca.test.tsx` (86 a 89) e `proprio-video-seguranca.test.tsx` (93 e 94): obtêm `edicao = await podeVerPrivado(S)` e a passam ao carregador e à página; viram `leitura`, e `canEdit: edicao != null` vira o `edita` de `acessoPrivado`.
- `proprio-a4-comparar.test.ts` (196 e 200): lê `arg.edicao` do carregador simulado; vira `arg.leitura`.
- `proprio-como-esta-rota.test.ts:53` e `proprio-t9-rota.test.ts:52`: montam a página com `edicao: null`; vira `leitura: null`.
- `proprio-portao-dados-ler.test.ts` (arquivo novo da A4, ainda sem commit em 13/10; linhas 6, 7, 25, 26, 68, 74 e 80): monta o pedido com `edicaoDe`; vira `leituraDe`.
- `proprio-t8-modelo.test.ts:297` e `proprio-video-tela.test.tsx:308`: **são afirmações de segurança, e sem mudança continuariam verdes sem proteger nada.** A primeira proíbe `/edicao|EdicaoDoSite|siteId/` no modelo serializado; a segunda proíbe `/proprio\/ler|proprio\/edicao|_proprio\/dados|EdicaoDoSite/` no código do componente cliente. As duas expressões ganham `leitura`, `LeituraPrivadaDoSite` e `proprio\/leitura-privada`, cada uma com um controle negativo (um texto com o nome novo faz a expressão casar). Se `leitura` sozinho casar com algum nome legítimo do modelo (por exemplo um rótulo de tela), a expressão usa o nome exato do campo (`"leitura":`) e o relatório diz qual.
*(emenda 2: S-n3)* **Mais cinco expressões de segurança que citam a prova de edição e não conheceriam o módulo novo** (conferido no código em 13/10; continuariam verdes sem proteger nada contra `proprio/leitura-privada`). Dois arquivos entram na lista desta tarefa, porque o `grep` do "Pronto quando" não os acha: `proprio-impressoes.test.tsx:628` (`/proprio\/ler|proprio\/edicao|_proprio\/dados|server-only/`) e `proprio-formato.test.ts:42` (`/model|proprio\/ler|edicao|dados/`; aqui a palavra é `edicao` sozinha, então o acréscimo é `|leitura-privada`). Três já estavam na lista, descritos como "só a troca do auxiliar": `proprio-videos-model.test.ts:527`, `proprio-header-model.test.ts:658` e `proprio-reguas-model.test.ts:407`. Nas quatro que escrevem `proprio\/edicao`, a expressão vira `proprio\/(edicao|leitura-privada)`. Cada uma das cinco ganha um controle negativo ao lado do que já existe (um import de `…/proprio/leitura-privada` conta como violação). Com isso a lista desta tarefa passa de 25 para **27** arquivos de teste que mudam.
**Contrato.**
- `ler.ts`: `export interface Pedido { leitura: LeituraPrivadaDoSite | null; canalId: string; hoje: DiaYt }`; `siteAutorizado` usa `leituraValida(p.leitura)` e `p.leitura.siteId`. O comentário de cabeçalho passa a dizer "prova de leitura privada".
- `ler-retencao.ts:16,144` e `ler-dimensoes.ts:24,155,163`: o mesmo, três e duas linhas.
- `dados.ts`: `podeVerPrivado(siteId): Promise<LeituraPrivadaDoSite | null>`; nova `acessoPrivado(siteId): Promise<AcessoPrivado>` (chama `provarAcessoPrivado`); `podeVerPrivado` é `(await acessoPrivado(siteId)).leitura`. Nos quatro carregadores (`lerDadosDoCanal`, `lerDadosDoVideo`, `lerDiarioDosCanais`, `lerAlcanceDosCanais`) o parâmetro `edicao` vira `leitura`. `dados.ts` deixa de importar `provarEdicao`.
- `carregar-extras.ts`: `previo.leitura`.
- `page-data.ts`: `ChannelPage` troca `edicao: EdicaoDoSite | null` por `leitura: LeituraPrivadaDoSite | null`; `canEdit` continua existindo e passa a ser `acesso.edita`; `openChannelPage` chama `acessoPrivado(siteId)` no lugar de `podeVerPrivado(siteId)` dentro do mesmo `Promise.all`. O comentário de `canEdit` é reescrito (deixa de dizer "a mesma guarda que dá o token").
- As duas páginas: só o nome do campo.

**Passos, com o teste antes.**
1. Nos testes dos três leitores, acrescentar e ver falhar: `com o token de leitura nascido do DIREITO, sem edição, o leitor lê` (usa `leituraPorDireitoDe`); `com um EdicaoDoSite no lugar do token (por cast) o leitor nega e não consulta nada`; `com leitura null o leitor nega e não consulta nada` (já existe com `edicao: null`: renomear).
2. Em `canal-page-data.test.ts`, acrescentar e ver falhar: `quem só tem o direito: leitura presente e canEdit false`; `quem edita: leitura presente e canEdit true`; `quem não tem nada: leitura null e canEdit false`; `a prova falha: leitura null, canEdit false, a página abre` (dado ausente).
3. Em `proprio-dados.test.ts`: `podeVerPrivado devolve a leitura de acessoPrivado`; `sem leitura, nenhum carregador cria o cliente de serviço` (já existe: renomear o campo).
4. Trocar o código. Trocar nos demais testes `edicaoDe` por `leituraDe` e `edicao:` por `leitura:` onde o destino é um leitor ou um carregador.
5. Varredura (acréscimos à da Tarefa 5): `_proprio/dados.ts` sai de `PODE_PROVAR` para `provarEdicao(` (controle negativo: `dados.ts` chamando `provarEdicao(` passa a ser violação); `ler-dimensoes.ts` entra em `PODE_LER` com os nomes `lerDimensoes` e `lerDetalheDaOrigem` (hoje a varredura só conhece `lerAlcance`, `lerDiario` e `lerRetencao`: os dois leitores da E11 estão fora da regra "quem pode chamar um leitor", e esta tarefa os põe dentro, com controle negativo); nos três leitores e em `dados.ts`, citar `EdicaoDoSite` ou `edicaoValida` vira violação ("o leitor voltou ao token de edição").

**Provas por mutação pedidas (todo filtro de site e de canal dos leitores):** em cada um dos três leitores, (a) tirar o `.eq('site_id', …)` de uma consulta → o teste de site cruzado do leitor falha; (b) tirar o `.eq('channel_id', …)` → o teste de canal cruzado falha; (c) trocar `leituraValida(p.leitura)` por `p.leitura != null` → o teste do `EdicaoDoSite` por cast falha. Se algum leitor não tiver hoje o teste de site ou de canal cruzado, **o teste é escrito nesta tarefa**, antes da mutação. O relatório lista, por leitor e por consulta, o teste que caiu.
**O estado "negado" das telas** (pedido do plano das ordens 8 e 10, D6): a tela da retenção e as demais continuam recebendo `{ acesso: 'negado' }` do mesmo jeito; quem tem o direito recebe `'ok'`. Nenhum modelo de tela muda nesta tarefa.
**Pronto quando:** `npx tsc --noEmit -p apps/web` limpo; *(emenda 1: S-I3)* a pasta `test/youtube/observatorio/` **inteira** verde, mais os dois de integração da lista (saída em arquivo, só as falhas no contexto): "os testes da lista" não basta, porque um teste fora da lista que dependa do nome do campo quebraria em execução sem ninguém ver; `grep -rnlE "EdicaoDoSite|edicaoValida|provarEdicao|podeVerPrivado|edicaoDe|edicao-teste" apps/web/test` relido no começo da tarefa e comparado com a lista (arquivo a mais = parar e avisar, porque a A4 ainda cria testes); *(emenda 2: S-n3)* e um segundo `grep`, para as expressões de segurança que o primeiro não acha: `grep -rnE "proprio\\\\/edicao|\\|edicao\\|" apps/web/test` (em 13/10: as cinco linhas listadas acima, mais `proprio-varredura.test.ts` e `proprio-video-tela.test.tsx`, que já estavam na lista; linha a mais = parar e avisar); varredura verde; `grep -rn "edicao" src/lib/youtube/observatorio/proprio/ler*.ts "src/app/cms/(authed)/youtube/competitors/_proprio/dados.ts"` sem ocorrência fora de comentário histórico.

### Tarefa 7: as ações que escrevem recusam quem só vê (item 170, meio)

**Objetivo.** Um teste que percorre as ações **exportadas** dos três arquivos e prova a recusa. Nenhum código de produção muda.
**Como.** `// @vitest-environment node`. `vi.mock` de `requireSiteScope`: `mode: 'edit'` → `{ ok: false, reason: 'insufficient_access' }`; `mode: 'view'` → `{ ok: true, user: { id: LEITORA } }`. `vi.mock` de `@/lib/supabase/service` com um cliente espião que registra toda chamada de `insert`, `update`, `upsert`, `delete` e `rpc`. `vi.mock` de `fetch` global que falha o teste se for chamado (nenhuma ação recusada pode chegar à API do YouTube).
**Testes.**
- `a lista de ações exportadas é a escrita no teste`: `Object.keys` dos três módulos comparado com a lista (14 de `actions.ts`, 4 de `niche-actions.ts`, 2 de `forja-actions.ts`: F14). Ação nova sem classificação derruba o teste.
- `cada ação que escreve, chamada pela leitora, recusa e não toca o banco nem a rede` (uma linha por ação, com argumentos mínimos válidos; "recusa" = devolve `ok: false`, o resultado de negado próprio da ação, ou lança `forbidden`; o espião tem zero chamada de escrita e o `fetch` zero chamada).
- `as duas leituras que pedem edição também recusam` (`getSyncStatus`, `getCompetitorRemovalImpactAction`).
- `exceções declaradas, com o motivo escrito: getUserNiche (leitura da preferência dela) e setUserNiche (grava só a linha dela em competitor_user_prefs)`; e `setUserNiche grava com o user_id da guarda e o site do contexto, e em nenhuma outra tabela` (o espião vê um `upsert` em `competitor_user_prefs` e mais nada).
- `sem sessão, todas recusam, as duas exceções incluídas`.
- `controle: quem edita passa da guarda` (ao menos uma ação por arquivo, para o teste não passar por recusar tudo sempre).

**Pronto quando:** verde; a lista de exceções tem exatamente dois nomes.

### Tarefa 8: a leitora no navegador (item 170, fim)

**Só em subagente Sonnet; o veredito volta em texto e as capturas ficam em arquivo.** Banco do navegador (54321), com o arquivo da MG11 aplicado pelas migrations locais (por isso depende da 1b). Roteiro: `docs/ops/runbook-cms-e2e-local.md`. *(emenda 1: S-m5)* **Quem aplica é o controlador**, com o comando que aplica só a migration pendente (conferência P13; `db:reset` apagaria o estado das outras trilhas). O commit das fixtures só entra **depois** dessa aplicação: o `global-setup` que lança sem a tabela derrubaria o e2e de todas as trilhas, a A4 incluída, até alguém aplicar.
**Fixtures (só acréscimo).** Quarta usuária `e2e-leitora@test.local`: `site_memberships.role = 'reporter'` e uma linha em `site_private_viewers` (com `granted_by` = o id do administrador de teste), por `upsert`. A `e2e-reporter` **continua sem a linha** (o teste de segurança da A4 depende disso). Estado salvo em `.auth/leitora.json`. Se `site_private_viewers` não existir no banco do navegador, o `global-setup` **lança com a frase "MG11 não aplicada no banco do navegador"**; não segue sem a linha.
**Testes** (`direito-leitora.spec.ts`).
- `a leitora abre a página do canal próprio e a do vídeo próprio e vê os números privados`: os mesmos sentinelas que `proprio-a4-seguranca.spec.ts` prova que o administrador recebe (reusar a lista de lá; não inventar outra).
- *(emenda 1: S-I4; substitui o teste da rodada 0, que prometia a ausência em sete telas e não tinha como passar: F13)* `nenhum controle de edição aparece para ela nas duas telas privadas` (página do canal próprio e página do vídeo próprio): a lista de seletores fica escrita no teste (fixar e desafixar vídeo, sincronizar, remover canal, mudar nicho, pedir e cancelar leitura da forja, salvar mudança, adicionar canal, liberar vagas). **Controle positivo:** os mesmos seletores acham pelo menos um controle na página de um vídeo de concorrente aberta pelo administrador (sem isso o teste passaria com seletor errado). Pela leitura do código as duas telas não recebem ação nenhuma (F13); o navegador é quem confirma. *(emenda 2: S-n8)* **Se o navegador contradisser a leitura** (achar um controle de edição numa das duas telas privadas): a tarefa **para** e o achado volta a este plano como emenda, com a tela, o controle e a captura. Não se afrouxa o seletor, não se tira o controle da lista de seletores e não se move o controle para `CONTROLES_VISIVEIS_A_QUEM_SO_LE`: nas telas privadas o item 170 pede ausência, e este plano não tem tarefa que esconda nada.
- *(emenda 1: S-I4)* `nas outras telas do Observatório, os controles de edição que ela vê são os da lista escrita, e clicar em cada um não altera nada`: lista de Canais, página de um canal concorrente, página de um vídeo concorrente, Comparar, Outliers, Insights, Mudanças. O teste tem a lista `CONTROLES_VISIVEIS_A_QUEM_SO_LE` (tela, controle). **Controle novo visível derruba o teste; controle conhecido fica listado, não escondido.** Para cada um, a leitora clica e o teste afirma, pelo cliente de serviço do e2e, que a contagem das tabelas que a ação escreveria não mudou (`competitor_video_pins` ou a tabela real de fixados, a de pedidos da forja, a de mudanças salvas, e `last_synced_at` do canal: os nomes exatos saem das ações em `actions.ts` e `forja-actions.ts`, e o relatório os lista), e anota o que a tela mostrou. Onde a tela não mostra nada depois do clique recusado, isso entra no relatório como achado para o lote de UX, não como falha deste teste. A lista de partida, pela leitura do código, é: fixar e desafixar vídeo; "Sincronizar só este canal"; pedir e cancelar leitura da forja; salvar mudança. **O que a leitura não determinou** (se adicionar canal aparece para ela) fica "não conferido" até o navegador responder.
- `a reporter sem a linha continua sem nenhum número privado` (chama o cenário que já existe; não duplica).
- `retirar a linha dela no banco e recarregar: os números somem` (o teste põe `revoked_at` pelo cliente de serviço do e2e e desfaz no fim, em `finally`).
- `nenhuma frase "só quem edita" aparece para a leitora nas duas telas privadas` (ela vê o número, não a negação).

**Pronto quando:** veredito em texto "passou" com o número de sentinelas conferidos, de controles ausentes nas duas telas privadas e, *(emenda 1: S-I4)*, a lista dos controles visíveis nas outras telas, que vai ao dono com a pergunta 8; capturas em `docs/superpowers/mockups/…` **não**: em `.superpowers/sdd/a5-e17-p0/shots/`.

### Tarefa 9: runbook da concessão

**Arquivo.** `docs/ops/observatorio-direito-desempenho-privado.md`. Conteúdo: o que é o direito, em quatro linhas; quem lê o quê (a tabela da seção "Segurança e LGPD" abaixo); o Apêndice C (quem tem o direito hoje; conceder; retirar; retirar de todos; o histórico em `audit_log`), cada comando numa linha e com o resultado esperado ao lado; **o aviso de que não se concede a ninguém antes do plano de fechamento** (pergunta 6); o que acontece quando a pessoa sai do site; o que acontece quando o usuário é apagado. Só o caminho para a frente, no molde dos outros runbooks de `docs/ops/`; aponta para `docs/ops/papeis-e-limites-cms.md` sem editá-lo.
**Pronto quando:** os comandos do Apêndice C foram rodados no `bythiago_int` dentro de transação desfeita e deram o resultado escrito. *(emenda 1: D-m2)* Os da rodada 0 foram rodados (seção 11); os da emenda 1, com `revoked_by`, **não**: esta tarefa os roda, e o runbook diz, logo depois de "conceder" e de "retirar", para rodar "quem tem o direito hoje" e ler as colunas de quem concedeu e de quem retirou. *(emenda 2: D-N1)* O runbook leva **seis** comandos (o sexto é "corrigir autor em branco") e, em destaque, a frase "nunca conceder para consertar uma linha retirada; se quem concedeu ou retirou foi apagado, o branco é o estado certo". A tarefa só fecha com a **P14 anotada** (o e-mail escrito nos comandos é o do login do dono em produção); se a P14 der `0`, o e-mail dos comandos é trocado pelo real antes de o runbook ser dado por pronto. *(emenda 2: S-n6)* **Conferência pendente, local, desta tarefa** (não é produção): rodar a instrução de conceder no editor de SQL do painel do Supabase local e anotar o que ele mostra para uma escrita. As instruções de escrita do Apêndice C levam `returning`, então o esperado é a linha alterada aparecer como resultado; se o painel não mostrar as linhas devolvidas, o runbook passa a dizer "o painel não mostra o resultado: conferir sempre por 'quem tem o direito hoje'" e as frases de "resultado esperado" saem.

### Tarefa 10: inventário do que um `reporter` alcança (item 237, OP-7)

**Parte A, páginas e rotas (leitura de código, sem banco).** Para cada arquivo de `grep -rl "mode: 'view'" apps/web/src` (37 hoje) e para cada item do menu do CMS: caminho, o que mostra, se mostra valor em moeda, receita, RPM, CPM ou AdSense, se tem controle de edição visível para leitura, e se é do Observatório. Mais as rotas de API que aceitam sessão de leitura. Saída: `.superpowers/sdd/a5-e17-p0/inventario-reporter.md`, uma tabela. **O que não foi possível determinar pela leitura fica escrito "não conferido", nunca "não mostra".**
**Parte B, banco.** As quatro consultas (*emenda 1: D-I2 e S-I6*: a quarta é nova), em produção (P3, pelo controlador) e no banco local:
```sql
select tablename, policyname, cmd, roles, qual from pg_policies where schemaname='public' and cmd in ('SELECT','ALL') order by 1, 2;
select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m') and (c.relkind in ('v','m') or not c.relrowsecurity) order by 1;
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname) order by 1;
select p.oid::regprocedure as funcao, pg_get_function_result(p.oid) as devolve, p.prosecdef as roda_como_o_dono, has_function_privilege('authenticated', p.oid, 'execute') as authenticated_executa, has_function_privilege('anon', p.oid, 'execute') as anon_executa from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f' and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute')) order by p.prosecdef desc, 1;
```
*(emenda 1: D-I2 e S-I6)* **Por que a quarta.** Uma função `security definer` roda como o dono e passa por cima da RLS, e toda função criada por `postgres` em `public` nasce executável por `anon` e `authenticated` (F8). As três primeiras consultas e a contagem por tabela não enxergam esse caminho: o inventário de tabelas pode vir limpo e a sessão dela ainda alcançar dado por `rpc(...)`. Sem a quarta, a ausência de funções no inventário viraria "não há", que é a falha em verde deste item. O plano não sabe quantas são (há `security definer` em dezenas de arquivos de migration, e não foi contado quantas continuam chamáveis): a consulta é que diz.
Teste (`observatorio-a5-e17-p0-reporter-banco.test.ts`):
- `toda policy de leitura de public está classificada`: o teste tem um mapa de **fragmento da expressão → classe** (`can_view_site(`, `site_visible(`, `is_member_staff(`, `can_view_private_site(` e a expressão `true` → `a_leitora_le`; `can_edit_site(`, `can_publish_site(`, `can_admin_site`, `is_super_admin(`, `is_org_admin(` → `fechada`; `auth.uid()` comparado a coluna de usuário → `so_a_propria_linha`) e uma lista de exceções por `(tabela, policy)` para o que o mapa não decide. Expressão com `or` que mistura classes conta pela mais aberta. **Policy que nenhuma regra classifica derruba o teste, com o nome.**
- `a lista de tabelas que a leitora lê é a escrita no teste` (`LE_COMO_LEITORA`, com uma frase por tabela dizendo o que ela guarda). Tabela nova legível por ela derruba o teste: é a exigência do item.
- `toda tabela sem RLS e toda view estão na lista escrita` (5 tabelas e 8 views no banco local: F18).
- `a contagem empírica não contradiz a lista`: como a leitora (papel `authenticated`, GUC forjado), `select count(*)` em **toda** tabela de `public`, cada um num `savepoint`; toda tabela que devolver uma linha ou mais tem de estar em `LE_COMO_LEITORA`. Tabela vazia não prova nada, e o teste **diz quantas estavam vazias** em vez de contá-las como fechadas.
- `as doze estão em LE_COMO_LEITORA e competitor_video_comment_authors não está`.
- *(emenda 1: D-I2 e S-I6)* `toda função security definer de public que authenticated executa está na lista escrita, com a sua classe`: o teste tem `FUNCOES_QUE_ELA_CHAMA` (assinatura → classe e uma frase), com três classes: `so_responde_sobre_quem_chama` (usa `auth.uid()` e não recebe id de usuário nem devolve linha de outro), `confere_permissao_no_corpo` (a frase diz qual função de permissão o corpo chama) e `devolve_dado_do_site_sem_conferir`. O que a leitura do corpo não decidir fica `nao_conferido`, e conta como aberto. **Função nova derruba o teste, com a assinatura.** A classificação é pelo catálogo e pela leitura do corpo (`pg_get_functiondef`), **nunca chamando** a função (regra do Postgres local). As de `security invoker` executáveis por ela passam pela RLS e ficam só contadas na saída. A terceira classe e a `nao_conferido` vão na mensagem ao dono, junto das tabelas.
- *(emenda 1: S-I2)* **Os três bancos, para as três listas escritas (`LE_COMO_LEITORA`, a de tabelas sem RLS e views, e `FUNCOES_QUE_ELA_CHAMA`).** A regra que derruba é sempre "existe no banco e não está na lista". O contrário, "está na lista e não existe no banco", é aceito só para os nomes de uma lista escrita `SO_DEPOIS_DO_LOTE_C` (o banco da CI só tem o que está em `supabase/migrations/`; o `bythiago_int` tem também as tabelas e funções de ensaio dos lotes B e C); a Tarefa 11 esvazia essa lista no commit do envio. Assim o mesmo arquivo fica verde no `bythiago_int`, na CI de hoje e na CI depois do lote C.

**Cuidado do Postgres local:** uma policy que chame função sem `EXECUTE` para `authenticated` derrubaria o servidor. Antes da contagem, o teste lista as funções citadas nas policies de leitura e confere `has_function_privilege('authenticated', …)`; tabela cuja policy cite função não executável **não é consultada** e entra na saída como "não consultada: a policy chama função fechada", com o nome.
**Parte C, navegador (Sonnet).** `reporter-menu.spec.ts`: entra como `e2e-leitora`, percorre todos os itens do menu do CMS, e em cada página procura valor em moeda (`R$`, `US$`, `$` seguido de dígito), as palavras receita, RPM, CPM e AdSense, e controles de edição. O teste compara o que achou com a lista `ACHADOS_CONHECIDOS` escrita nele (página, o que apareceu): **achado novo derruba o teste; achado conhecido fica listado, não escondido.** Página que não abriu (erro, redirecionamento) entra na saída como "não abriu", nunca como "limpa".
**Entrega.** O inventário das três partes vai ao dono numa mensagem só, com a contagem por classe e a lista do que está fora de "só o Observatório". É a entrada do plano de fechamento (pergunta 6).
**Pronto quando:** as três partes no ledger; os dois testes verdes com as listas escritas, a de funções incluída *(emenda 1: D-I2 e S-I6)*; a mensagem ao dono preparada pelo controlador, com as tabelas, as funções da classe `devolve_dado_do_site_sem_conferir` e as `nao_conferido`.

### Tarefa 11: envio e conferências

**Ordem que não pode inverter.**
1. **A A4 em `staging`** antes do código deste plano (os arquivos que a Tarefa 6 edita são dela).
2. **O arquivo da MG11 criado depois do da MG14 e antes do da MG5**, e o lote C aplicado pelo dono de uma vez.
3. *(emenda 1: S-m3)* **O teste de 40 conexões verde no `bythiago_int`** antes do `db:push:prod` (passo 2b da seção 2), e **V1 a V6 anotadas** antes do push do código.
4. **Push do código** (Tarefas 5, 6, 7 e os testes). Conferir a CI.
5. **Nenhuma linha em `site_private_viewers`** antes do plano de fechamento em produção.

**O que acontece se inverter.**
- Código antes da MG11: quem edita não percebe; quem não edita vê "negado" e cada página dela gera um evento no Sentry. Hoje não há ninguém nessa condição (P7). Não é vermelho, mas é a ordem errada: se P7 mostrar um `reporter` em produção, **não inverter**.
- MG11 antes do código: nada muda (é inerte).
- MG11 antes da MG14: funciona (o laço pula a tabela que falta e a MG14 nasce certa pelo bloco PL), mas o carimbo fora de ordem exigiria `--include-all` no push: **não fazer**; a ordem dos `db:new` é do controlador.
- Concessão antes do fechamento: a irmã leria, pelo banco, as tabelas do pipeline de conteúdo e, pelas telas, o CMS inteiro em leitura. **Este é o único passo cuja inversão expõe dado.** O runbook abre com esse aviso.

**Commits** (cada um com a lista de arquivos da tarefa): Tarefa 1; Tarefas 2, 3 e 4 (um por tarefa); Tarefa 5; Tarefa 6; Tarefa 7; Tarefa 9; Tarefa 10 (A e B); Tarefa 1b (o arquivo da migration, na vez do lote C, e a remoção do SQL de ensaio: *emenda 1: S-I2*); Tarefa 8 e Tarefa 10 C (os dois e2e); o commit do envio (a constante de deploy e as listas `PODEM_FALTAR` e `SO_DEPOIS_DO_LOTE_C` encolhidas). *(emenda 1: S-I2)* Cada commit de teste de banco tem de ficar verde na CI sozinho: antes de commitar, o implementador confere, pela leitura de `supabase/migrations/`, que o teste não supõe tabela que só existe no `bythiago_int`. Mensagens no formato `tipo: descrição`, em português.

**Como voltar.** Reverter o commit da Tarefa 6 (e o da 5): os leitores voltam ao token de edição. A MG11 fica aplicada e sem efeito. Para fechar o direito sem reverter: `revoked_at` nas linhas. Desfazer a MG11 só por migration nova, e não é necessário.

**Conferências com data.** Constante `E17_P0_DEPLOY: string | null` e função `conferenciasE17P0(deploy)` em `src/lib/conferencias.ts`, no molde de `conferenciasE14` (com a entrada "deploy malformado"), mais o teste em `test/lib/conferencias.test.ts` (data nula → nenhuma conferência; data malformada → a entrada de erro; data válida → as três com as datas certas) e o espelho em `.superpowers/sdd/a5/conferencias-com-data.md`.

| Id | Quando | O que olhar | Esperado |
|---|---|---|---|
| (sem id) | D0, logo depois do `db:push:prod` | V1 a V6 | V1 `3, 2, 6, 1, 8, 2, 1, 1`; V2 todas em `can_view_private_site(site_id)`; V3 nove linhas iguais às de antes; V4 `0, 0, 0, 0`; V5 `privado = editar` em toda linha; V6 três chaves, `user_id` e `expires_at` nulos |
| (sem id) | D0, depois do deploy do código | o dono (ou o roteiro autenticado local) abre a página do canal próprio e a de um vídeo próprio | os números de alcance e de views por dia aparecem como antes; nenhuma frase "só quem edita" para ele |
| `e17p0-d1` | D+1 | Sentry: eventos com `step: provar-leitura-privada` desde o deploy; V4 | zero eventos; `0, 0, 0, 0`. Um evento ou mais sem haver `reporter` em produção = alguém sem edição abriu o Observatório, ou a guarda falhou: ler o `motivo` |
| `e17p0-d7` | D+7 | V2 de novo, V4, V5 | V2 com 12 linhas (ou 10, se a MG12 ainda não entrou), todas no direito; V4 `0, 0, 0, 0` enquanto ninguém foi concedido; V5 sem `privado = true` com `editar = false` |
| `e17p0-concessao` | no dia em que o dono conceder | `select * from public.site_private_viewers;` e `select action, created_at from public.audit_log where resource_type = 'site_private_viewers' order by created_at;` | uma linha em vigor, com `granted_by` preenchido; uma linha `private_view_granted`; V5 passa a ter exatamente uma linha com `privado = true` e `editar = false`. *(emenda 1: D-m6)* E mais duas, porque é a primeira vez que o passo 3 de 4.4 roda em produção: **a pessoa abre a página do canal próprio e vê os números** (ela diz, ou o dono olha com ela), e **zero evento `step: provar-leitura-privada` no Sentry naquele dia**. Linha em vigor sem número na tela = a função ou o vínculo falhou: ler o `motivo` do evento |

**Pronto quando:** CI verde; deploy pronto; D0 anotado; `PODEM_FALTAR` da Tarefa 3 reduzida ao que só a MG15 cria (mais as duas da MG12, se ela ainda não entrou) e `SO_DEPOIS_DO_LOTE_C` da Tarefa 10 B vazia *(emenda 1: S-I2)*; o teste de 40 conexões rodado e verde, não pulado; a constante de deploy preenchida no commit do envio.

---

## 11. Consultas de conferência e o que foi rodado

Tudo no `bythiago_int` (porta 54422), dentro de `begin; … rollback;`, em 13/10/2026.

| O que | Vezes | Resultado |
|---|---|---|
| Apêndice A aplicado duas vezes seguidas | 4 rodadas | sem erro; na segunda aplicação só avisos "já existe, pulando" |
| V1 | 2 | `3, 2, 6, 1, 8, 2, 1, 1` |
| V2 (10 das 12 presentes; antes, as 10 em `can_edit_site`) | 2 | as 10 em `can_view_private_site(site_id)`, uma policy cada, `<tabela>_select` |
| V3 | 2 | 9 linhas, iguais às de antes (5 em `can_edit_site`, 4 em `can_view_site`) |
| Apêndice B inteiro (matriz, nulos, sessão contra `_as`, `anon`, RLS de `site_private_viewers`, escrita recusada, rastro, runbook, contador, `check`, apagar usuário) | 4 | saídas iguais linha a linha (fora as de tempo); a do Apêndice B |
| Custo por linha (10.800 linhas, usuário sem acesso) | 2 por versão | `can_edit_site` 1.299 e 1.291 ms; `can_view_private_site` final 1.495 e 1.477 ms; primeira versão 2.489 e 2.523 ms |
| Nada ficou gravado | depois de cada rodada | `to_regclass('public.site_private_viewers')` nulo; zero usuário `@mg11.test` |

*(emenda 1: D-I1 e S-I1)* **Como ler a tabela acima depois da emenda 1.** Ela descreve a rodada 0: o SQL de então (sem `revoked_by`, com o gatilho em qualquer `update`) e um roteiro que se perdeu. A saída guardada existe; o roteiro que a gerou, não. O Apêndice B traz um roteiro reescrito, **não rodado**, e o Apêndice A traz três mudanças **não rodadas**. Até a rodada da Tarefa 1 (ou a conferência pendente da seção "Estado deste plano"), nenhuma linha "rodado" deste plano é reproduzível, e as que tocam o gatilho, a retirada e o apagamento de quem concedeu descrevem o SQL anterior. *(emenda 2)* A emenda 2 somou ao que nunca rodou: o `check` de `revoked_by` no Apêndice A, o bloco "corrigir autor em branco" do Apêndice B e, no Apêndice C, o sexto comando, o `returning` e os e-mails do histórico.

**Não rodado, e por quê.** V5 e V6 (dependem das pessoas e das chaves de produção). O teste de 40 chamadas simultâneas (não cabe em transação desfeita: Tarefa 4). A leitura real das doze tabelas por cada papel (precisa de semente por tabela: Tarefa 2; a prova daqui cobriu as funções, a equivalência, as policies pelo catálogo e a RLS real de `site_private_viewers`). O comportamento com um `reporter` real de produção (não existe). Nenhum teste do repositório, nenhum build, nenhum navegador.

---

## 12. Onde está cada item de aceite

| Item | O que pede (curto) | Tarefa | Observação |
|---|---|---|---|
| 169 | `reporter` com a linha lê as doze e o texto; sem a linha, com a linha revogada, não lê; ninguém escreve; GUC forjado; quem edita lê como antes | 2 | as doze que existirem no banco do teste; as duas da MG12 entram quando a MG12 existir (a Tarefa 3 obriga a classificar) |
| 170, tipo | `LeituraPrivadaDoSite` não serve onde se pede `EdicaoDoSite`; não se fabrica de fora | 5 | prova de tipo e varredura |
| 170, ações | toda ação que escreve recusa a leitora | 7 | duas exceções declaradas (pergunta 4) |
| 170, navegador | telas privadas mostram os números e nenhum controle de edição | 8 | depende da 1b. *(emenda 1: S-I4)* Provado nas duas telas privadas, que é o texto do item; os controles que as outras telas do Observatório mostram a quem só lê ficam listados e provados inofensivos, e escondê-los é da pergunta 8 (desvio 17): **fora**, com dono dito |
| 191 | as doze em `can_view_private_site`; exceções pelo nome; `yt_own_*` nova tem de ser classificada | 3 | fecha de vez na Tarefa 11, com o lote C inteiro; `yt_own_video_daily_zeros_bkp` classificada (OP-16) |
| 232, metade | a leitora lê as duas de texto e zero de `competitor_video_comment_authors`; a policy da identidade continua `can_edit_site` | 2 e 3 | a outra metade (anular identidade) é do plano da E14 |
| 236, metade de banco | `_as` não executáveis por `anon` nem `authenticated`; sessão e `_as` iguais para todo usuário da semente | 1 e 2 | a metade "chave vencida recebe 401 nas duas entradas" é do degrau 2: **fora**, porque não há código de chave por pessoa aqui |
| 237 | inventário (páginas, rotas, banco: tabelas, views e, *emenda 1: D-I2 e S-I6*, funções) e os dois testes, antes de o usuário existir | 10 | o **fechamento** do que o inventário achar é de outro plano (pergunta 6): **fora** |
| 239, metade de banco | o contador é atômico | 4 | "30 servidas e 10 `limite`" é do degrau 2: **fora** |
| 63, 89 | os leitores da E8 e da E11 aceitam o token de leitura | 6 | |
| 117 | o leitor da E14 aceita o token de leitura | **fora** | o leitor não existe; nasce com o token (plano da E14) |
| OP-2 | `search_path = ''` e nomes qualificados | 1 | as oito funções |
| OP-7 | lista de tabelas que a sessão `reporter` lê, de `pg_policies` em produção | 0a (P3) e 10 B | |
| OP-16 | classificar `yt_own_video_daily_zeros_bkp` | 3 | "sem policy, RLS ligada" |
| D6 do plano das ordens 8 e 10 | listar `ler-retencao.ts` e o estado negado da retenção | 6 | |
| 159 a 168, 171, 172, 234, 235, 238, 240, 250 | degraus 1 e 2 | **fora** | não são do passo 0 |

Nenhum item do passo 0 fica sem tarefa. Cada "fora" tem dono dito *(emenda 1: a rodada 0 contava quatro; com a parte do item 170 que foi para a pergunta 8 a contagem deixou de valer)*.

---

## 13. Riscos que ficam, sem suavizar

1. **A barreira de verdade continua sendo o token no código, não a RLS** (risco 39 do spec). Os leitores usam o cliente de serviço. Um leitor novo que não peça `LeituraPrivadaDoSite` vaza, e o banco não impede. O que segura: o tipo nominal, a varredura e a revisão. A troca das policies é defesa a mais.
2. **Duas cópias da regra de "quem edita"** (4.2). Se alguém mudar `can_edit_site` no futuro e esquecer `can_edit_site_as`, a tela e o banco passam a discordar. *(emenda 1: S-I2)* O teste de equivalência fica em `test/integration/`, e a CI roda essa pasta com banco em todo push de `staging` (a rodada 0 dizia o contrário, e estava errada): ele pega a divergência no banco da CI. P10 e V5 pegam em produção só quando alguém as roda.
3. **A concessão é SQL manual.** Um erro de digitação concede à pessoa errada. O que limita: o comando acha a pessoa por e-mail exato, exige "1 linha", grava rastro, e a função ainda exige vínculo com o site.
4. **O login de um `reporter` abre muito mais que o Observatório** (37 arquivos, 85 tabelas no banco local). Este plano não fecha nada disso; só garante que ninguém recebe o direito antes. Se o usuário dela for criado sem o fechamento, a MG11 não é a causa, mas o plano terá sido a ocasião.
5. **As frases "só quem edita" ficam incompletas** até o lote de UX (pergunta 2).
6. **A MG11 leva DDL do degrau 2 sem código que o exercite.** Se o degrau 2 descobrir que a forma está errada, será migration nova. O que reduz: a função e o `check` já são provados contra o banco (Tarefa 4).
7. **O rastro em `audit_log` guarda o id da pessoa concedida** (`resource_id` e `after_data`) e, *(emenda 1: D-m1)*, **o de quem concedeu e o de quem retirou** (`granted_by` e `revoked_by`, dentro de `after_data` e de `before_data`): são três ids por linha de rastro, não um. O que a emenda 1 tirou foi só a linha **nova** que o apagamento gravava. A limpeza LGPD de hoje só anula `actor_user_id`. É o mesmo que já acontece com o rastro de `site_memberships`; fica igual, não melhor.
8. **Evento no Sentry por página enquanto houver alguém sem edição e a função faltar ou falhar.** Sem teto. Com uma pessoa, é ruído pequeno; a D+1 olha.
9. **A zona da A4.** As Tarefas 5 e 6 editam arquivos dela. Se a A4 ainda mexer em `ler.ts` ou `dados.ts` depois da liberação, há conflito de edição entre agentes.

### O que nenhum teste vai provar (declarado)

- Que **produção** tem o mesmo corpo de funções e as mesmas policies do banco local: só P2, P10 e V1 a V6 dizem.
- Que a troca das policies em produção não esperou trava: só a hora do `db:push:prod` diz (*emenda 2: D-m-b e S-n5*: se esperou mais de 5 s, o `lock_timeout` faz a migration parar: nada foi aplicado, ou foi aplicada em parte e repetir converge, conforme a P11; a frase antiga, "nada foi aplicado", afirmava o que não foi medido).
- O comportamento com a **sessão real da irmã** (cookie de verdade, a guarda de verdade do pacote de autenticação): o e2e usa a guarda de verdade no banco local, e os testes de unidade a simulam. Em produção ninguém exercita o passo 3 até a concessão.
- Que nenhum **outro** caminho lê as tabelas privadas com o cliente de serviço sem pedir o token: a varredura cobre os nomes de tabela e de função que conhece; uma consulta por nome montado em texto escaparia.
- Que a lista `LE_COMO_LEITORA` está **certa**, e não só estável: ela é escrita por uma pessoa a partir do catálogo; o teste garante que não muda calada, não que a classificação de cada tabela esteja correta.
- Que uma tabela **vazia** no banco de teste é de fato fechada para ela (a contagem empírica só fala das que têm linha).
- O custo da policy em tabela com 97 mil linhas de produção: medido em 10.800 linhas sintéticas.
- Que o dono vai rodar o SQL certo: o runbook reduz o risco, não o prova.
- *(emenda 1: D-I2 e S-I6)* Que a classe escrita de cada função em `FUNCOES_QUE_ELA_CHAMA` está **certa**: ela sai da leitura do corpo por uma pessoa; o teste garante que função nova não entra calada, não que "confere permissão no corpo" seja verdade.
- *(emenda 1: S-I4)* Que não existe controle de edição visível a ela fora das telas que o teste de navegador percorre.

### Dívida registrada (o que fica para depois, com dono)

- **Plano de fechamento do CMS para leitura** (pergunta 6): quem escreve é o controlador, depois do inventário.
- **Frases de tela** (pergunta 2): lote de UX, junto do fechamento.
- *(emenda 1: S-I4)* **Esconder, de quem só lê, os controles de edição das telas de concorrentes** (pergunta 8): mesmo lote de UX, com mockup; condição do plano de fechamento, antes de o usuário dela existir. A lista de partida é a que a Tarefa 8 entrega.
- *(emenda 1: D-m3)* **Duas obrigações do plano do degrau 2, cada uma com teste.** (a) Chave com `observatorio_leitura` e `user_id` nulo é **recusada** na autenticação: é o que torna verdadeiro "apagar a pessoa fecha a chave dela" (desvio 6). (b) A fase 1 da LGPD bane a pessoa na hora e só apaga a linha de `auth.users` em D+15, e chave não depende de sessão: a fase 1 tem de cortar a chave do perfil **no mesmo dia** (preencher `revoked_at` da chave), senão ela continua lendo por 15 dias. Hoje nenhuma das duas é porta aberta, porque nenhum código aceita essa permissão.
- *(emenda 1: D-m6)* **Mostrar "não foi possível conferir agora"** no lugar da frase de negado, quando `negativa` for `'nao_foi_possivel_conferir'`: lote de UX.
- **Limpeza LGPD das colunas novas**, se P8 mostrar que a fase 3 não apaga `auth.users`: três linhas, no plano de fechamento.
- **Poda de `obs_ai_access_log` (400 dias) e de `obs_ai_rate` (2 dias):** a tarefa `podas` da agenda não existe ainda; é do degrau 2 (hoje as duas tabelas têm zero linha).
- **O leitor de texto de comentário da E14** nasce pedindo `LeituraPrivadaDoSite` e entra na varredura: nota para o plano da E14.
- **`can_edit_site` como casca de `can_edit_site_as`** (acabar com as duas cópias): só com um plano de RBAC, não por tabela do Observatório.

---

## Segurança e LGPD (resumo de quem lê o quê depois deste plano)

| Dado | Quem lê pela tela | Quem lê pelo banco, com sessão | Quem escreve |
|---|---|---|---|
| As doze tabelas privadas (impressões, taxa de clique, views por dia, retenção, origem das views, termos de pesquisa, texto de comentário) | quem tem `LeituraPrivadaDoSite`: quem edita, ou quem tem vínculo e concessão em vigor | `can_view_private_site(site_id)`: a mesma regra | só `service_role` (coleta) |
| Identidade do autor de comentário | só quem edita (regra do leitor da E14, que nasce depois) | `can_edit_site(site_id)`: **não muda** | só `service_role` |
| Bruto (`competitor_raw`, `yt_reporting_*`), tentativas de coleta | ninguém pela tela | `can_edit_site` ou nenhuma policy: **não muda** | só `service_role` |
| `site_private_viewers` | ninguém (não há tela) | o administrador do site (todas as linhas do site) e a própria pessoa (a linha dela) | o dono, como `postgres`, pelo runbook; `service_role` |
| `obs_ai_access_log` | ninguém ainda | só `can_admin_site_users(site_id)` | só `service_role` (degrau 2) |
| `obs_ai_rate` | ninguém | ninguém (sem policy) | só `service_role`, pela função |

- **GUC `app.site_id`:** nenhuma função nova o lê (teste da Tarefa 1) e todo teste de RLS o forja (Tarefa 2).
- **Cliente de serviço:** os leitores só o recebem depois do token (não muda); o token só nasce depois da guarda de sessão; a pergunta do direito usa o cliente de serviço depois dessa guarda e não lê dado (4.6).
- **Dado pessoal novo:** o id de quem recebe, de quem concede e, *(emenda 1: D-m2)*, de quem retira o direito, e (no degrau 2) o id de quem consultou. Base: execução do controle de acesso do próprio site e legítimo interesse de segurança, como o `audit_log`. **Retenção:** a concessão vive enquanto a pessoa existir; o registro de acesso, 400 dias (poda do degrau 2). **Apagamento:** apagar o usuário apaga a concessão (cascata) e anula o id no registro, na chave e em `granted_by` (rodado na rodada 0) e em `revoked_by` *(emenda 1: D-m2; não rodado)*. *(emenda 1: D-m1 e S-I5)* Com o gatilho da rodada 0 esse apagamento **gravava** uma linha nova em `audit_log` com o id de quem acabava de ser apagado, e a frase de então estava incompleta; com `update of revoked_at` ele não grava nada, e o teste da Tarefa 2 e a linha `rastro_novo_ao_apagar|0` do Apêndice B o provam quando rodarem. O rastro que já existia em `audit_log` fica com os ids no conteúdo, como o dos vínculos (risco 7).
- **Termo de pesquisa pode ser nome de pessoa** (aviso do plano da E11): quem ganha o direito passa a lê-lo quando a tela existir. É o que a decisão 32 do dono aprova ("a marqueteira vê impressões, taxa de clique, retenção"), e a pergunta 23 do spec (termos na classe ii) segue pelo padrão.

---

## 14. Apêndices

### Apêndice A: MG11 (texto da emenda 1)

O texto da rodada 0 foi rodado duas vezes seguidas, em quatro rodadas, em 13/10. *(emenda 1)* **Três mudanças, marcadas no SQL com "emenda 1", não foram rodadas:** a coluna `revoked_by` (D-m2), o índice dela, e o gatilho em `update of revoked_at` (D-m1 e S-I5). *(emenda 2: D-m-g)* **Uma quarta, marcada "emenda 2", também não rodada:** o `check` `site_private_viewers_revoked_by_so_retirada`. O resto é o texto da rodada 0, sem mudar um caractere. V1 não muda com a quarta: o `check` novo é de `site_private_viewers`, e a contagem `check_de_1` olha só o de `pipeline_api_keys`.

Nome do arquivo: `supabase/migrations/<carimbo>_observatorio_a5_e17_direito_desempenho_privado.sql`, criado por `npm run db:new` na vez do lote C. Até lá: `apps/web/test/fixtures/sql/a5-e17-p0-mg11.sql` *(emenda 1: S-I2)*.

```sql
-- MG11 · A5 · E17 passo 0 · o direito "ver desempenho privado"
-- Aditiva e idempotente. Sem concessão em site_private_viewers, can_view_private_site responde igual a can_edit_site.
set lock_timeout = '5s';

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Guardas: o que esta migration supõe que já existe.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.can_edit_site(uuid)') is null
     or to_regprocedure('public.can_view_site(uuid)') is null
     or to_regprocedure('public.can_admin_site_users(uuid)') is null then
    raise exception 'MG11 depende dos helpers de RBAC v3 (can_edit_site, can_view_site, can_admin_site_users)';
  end if;
  if to_regclass('public.pipeline_api_keys') is null or to_regclass('public.audit_log') is null
     or to_regclass('public.site_memberships') is null or to_regclass('public.organization_members') is null then
    raise exception 'MG11 depende de pipeline_api_keys, audit_log, site_memberships e organization_members';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Quem tem o direito. Sem linha em vigor (revoked_at nulo), sem direito.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.site_private_viewers (
  site_id    uuid not null references public.sites(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,   -- nulo = quem concedeu foi apagado (LGPD)
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,                                         -- nulo = em vigor
  revoked_by uuid references auth.users(id) on delete set null,   -- (emenda 1: D-m2) quem retirou; nulo = em vigor, ou quem retirou foi apagado (LGPD)
  primary key (site_id, user_id),
  -- (emenda 2: D-m-g) quem retirou só existe numa linha retirada; reconceder limpa as duas colunas na mesma instrução
  constraint site_private_viewers_revoked_by_so_retirada check (revoked_by is null or revoked_at is not null)
);
create index if not exists idx_site_private_viewers_user on public.site_private_viewers (user_id);
create index if not exists idx_site_private_viewers_granted_by on public.site_private_viewers (granted_by) where granted_by is not null;
create index if not exists idx_site_private_viewers_revoked_by on public.site_private_viewers (revoked_by) where revoked_by is not null;   -- (emenda 1: D-m2)

alter table public.site_private_viewers enable row level security;
drop policy if exists "site_private_viewers_select" on public.site_private_viewers;
create policy "site_private_viewers_select" on public.site_private_viewers
  for select using (public.can_admin_site_users(site_id) or user_id = (select auth.uid()));
-- Nenhuma policy de escrita: conceder e retirar é do dono, pelo SQL do runbook (papel postgres) ou por service role.
revoke all on table public.site_private_viewers from anon;
revoke insert, update, delete, truncate, references, trigger on table public.site_private_viewers from authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. As funções com o usuário por parâmetro (só service role) e a de sessão (a que as policies chamam).
--    Espelho das de sessão (is_super_admin, is_org_admin, can_view_site, can_edit_site), com p_user no lugar de auth.uid().
--    Nenhuma lê o GUC app.site_id.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_super_admin_as(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members om
    join public.organizations o on o.id = om.org_id
    where om.user_id = p_user and om.role = 'org_admin' and o.parent_org_id is null);
$$;

create or replace function public.is_org_admin_as(p_user uuid, p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_super_admin_as(p_user)
      or exists (select 1 from public.organization_members om
                 where om.user_id = p_user and om.org_id = p_org and om.role = 'org_admin');
$$;

create or replace function public.can_view_site_as(p_user uuid, p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_super_admin_as(p_user)
      or exists (select 1 from public.sites s where s.id = p_site and public.is_org_admin_as(p_user, s.org_id))
      or exists (select 1 from public.site_memberships m where m.site_id = p_site and m.user_id = p_user);
$$;

create or replace function public.can_edit_site_as(p_user uuid, p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_super_admin_as(p_user)
      or exists (select 1 from public.sites s where s.id = p_site and public.is_org_admin_as(p_user, s.org_id))
      or exists (select 1 from public.site_memberships m where m.site_id = p_site and m.user_id = p_user and m.role = 'editor');
$$;

-- Quem edita vê. Quem não edita vê só com as DUAS coisas: linha em vigor E vínculo com o site.
-- (Para quem não edita, "ver o site" é ter linha em site_memberships: administrador de organização e
--  super-administrador já passaram em can_edit_site_as. Por isso o vínculo é conferido direto na tabela,
--  sem repetir a cadeia de can_view_site_as: uma busca pela chave primária a mais, e só quando há concessão.)
create or replace function public.can_view_private_site_as(p_user uuid, p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_edit_site_as(p_user, p_site)
      or exists (select 1 from public.site_private_viewers v
                 where v.site_id = p_site and v.user_id = p_user and v.revoked_at is null
                   and exists (select 1 from public.site_memberships m where m.site_id = v.site_id and m.user_id = v.user_id));
$$;

-- A de sessão: uma linha, para não haver duas cópias da regra do direito.
create or replace function public.can_view_private_site(p_site_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_view_private_site_as(auth.uid(), p_site_id);
$$;

revoke all on function public.is_super_admin_as(uuid) from public, anon, authenticated;
revoke all on function public.is_org_admin_as(uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_view_site_as(uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_edit_site_as(uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_view_private_site_as(uuid, uuid) from public, anon, authenticated;
grant execute on function public.is_super_admin_as(uuid) to service_role;
grant execute on function public.is_org_admin_as(uuid, uuid) to service_role;
grant execute on function public.can_view_site_as(uuid, uuid) to service_role;
grant execute on function public.can_edit_site_as(uuid, uuid) to service_role;
grant execute on function public.can_view_private_site_as(uuid, uuid) to service_role;
-- A de sessão é chamada pelas policies com o papel de quem consulta: mesmos privilégios de can_edit_site.
revoke all on function public.can_view_private_site(uuid) from public;
grant execute on function public.can_view_private_site(uuid) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. A troca das policies de leitura: toda tabela da lista das doze QUE JÁ EXISTE passa ao direito.
--    As que ainda não existem nascem certas pelo bloco PL da migration delas (que acha a função criada acima).
--    drop e create no mesmo arquivo: não há instante sem policy.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
  v_outras text;
begin
  foreach t in array array[
    'yt_own_video_daily', 'yt_own_video_reach_daily', 'yt_own_video_meta_daily', 'yt_own_video_coverage',
    'yt_own_video_retention', 'yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily',
    'yt_own_video_versions', 'yt_own_versions_state', 'competitor_video_comments', 'competitor_video_comment_marks'
  ] loop
    continue when to_regclass('public.' || t) is null;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (public.can_view_private_site(site_id))', t || '_select', t);
    select string_agg(p.policyname, ', ' order by p.policyname) into v_outras
      from pg_catalog.pg_policies p
     where p.schemaname = 'public' and p.tablename = t and p.policyname <> t || '_select';
    if v_outras is not null then
      raise exception 'MG11: a tabela % tem policy fora do padrão (%): classificar antes de aplicar', t, v_outras;
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Rastro de quem concedeu e retirou: uma linha em audit_log a cada insert e a cada update que escreve revoked_at.
--    (O gatilho genérico tg_audit_mutation lê NEW.id, que esta tabela não tem.)
--    (emenda 1: D-m1 e S-I5) "update OF revoked_at": o "on delete set null" de granted_by e de revoked_by é um update que
--    não cita revoked_at, então apagar quem concedeu ou quem retirou (LGPD) não grava linha nova com o id apagado.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.tg_site_private_viewers_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := case when new.revoked_at is null then 'private_view_granted' else 'private_view_revoked' end;
  elsif old.revoked_at is null and new.revoked_at is not null then
    v_action := 'private_view_revoked';
  elsif old.revoked_at is not null and new.revoked_at is null then
    v_action := 'private_view_granted';
  else
    v_action := 'private_view_changed';
  end if;
  select s.org_id into v_org from public.sites s where s.id = new.site_id;
  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, before_data, after_data)
  values (auth.uid(), v_action, 'site_private_viewers', new.user_id, v_org, new.site_id,
          case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new));
  return new;
end $$;
revoke all on function public.tg_site_private_viewers_audit() from public, anon, authenticated;

drop trigger if exists audit_site_private_viewers on public.site_private_viewers;
create trigger audit_site_private_viewers
  after insert or update of revoked_at on public.site_private_viewers
  for each row execute function public.tg_site_private_viewers_audit();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Do degrau 2, sem código que use ainda: a chave por pessoa, o registro de acesso de IA e o contador de taxa.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.pipeline_api_keys add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.pipeline_api_keys add column if not exists expires_at timestamptz;
create index if not exists idx_pipeline_api_keys_user on public.pipeline_api_keys (user_id) where user_id is not null;
-- A permissão do perfil não se mistura com nenhuma outra (a chave do perfil só lê o Observatório).
alter table public.pipeline_api_keys drop constraint if exists pipeline_api_keys_observatorio_leitura_sozinha;
alter table public.pipeline_api_keys add constraint pipeline_api_keys_observatorio_leitura_sozinha
  check (not ('observatorio_leitura' = any (permissions)) or permissions = array['observatorio_leitura']::text[]);

create table if not exists public.obs_ai_access_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,     -- quem pediu; nulo = a pessoa foi apagada (LGPD)
  key_id uuid references public.pipeline_api_keys(id) on delete set null,   -- nulo = origem 'botao'
  origin text not null check (origin in ('botao', 'mcp')),
  action text not null,
  params jsonb not null default '{}'::jsonb,                     -- ids, janela, formato. NUNCA a pergunta nem a resposta
  included_private boolean not null,
  output_chars integer,
  result text not null check (result in ('ok', 'recusado', 'limite'))
);
create index if not exists idx_oaal_key_at on public.obs_ai_access_log (key_id, at desc);
create index if not exists idx_oaal_user_at on public.obs_ai_access_log (user_id, at desc);
create index if not exists idx_oaal_site_at on public.obs_ai_access_log (site_id, at desc);
alter table public.obs_ai_access_log enable row level security;
drop policy if exists "obs_ai_access_log_select" on public.obs_ai_access_log;
create policy "obs_ai_access_log_select" on public.obs_ai_access_log
  for select using (public.can_admin_site_users(site_id));
revoke all on table public.obs_ai_access_log from anon;
revoke insert, update, delete, truncate, references, trigger on table public.obs_ai_access_log from authenticated;

create table if not exists public.obs_ai_rate (
  key_id uuid not null references public.pipeline_api_keys(id) on delete cascade,
  grain text not null check (grain in ('minuto', 'dia')),
  bucket timestamptz not null,                                   -- início do minuto ou do dia, em UTC
  n integer not null default 0,
  primary key (key_id, grain, bucket)
);
alter table public.obs_ai_rate enable row level security;       -- sem policy nenhuma: só service role
revoke all on table public.obs_ai_rate from anon, authenticated;

create or replace function public.obs_ai_rate_hit(p_key uuid, p_now timestamptz)
returns table (no_minuto integer, no_dia integer)
language sql security invoker set search_path = '' as $$
  with m as (
    insert into public.obs_ai_rate as r (key_id, grain, bucket, n)
    values (p_key, 'minuto', date_trunc('minute', p_now, 'UTC'), 1)
    on conflict (key_id, grain, bucket) do update set n = r.n + 1 returning r.n),
  d as (
    insert into public.obs_ai_rate as r (key_id, grain, bucket, n)
    values (p_key, 'dia', date_trunc('day', p_now, 'UTC'), 1)
    on conflict (key_id, grain, bucket) do update set n = r.n + 1 returning r.n)
  select (select m.n from m), (select d.n from d);
$$;
revoke all on function public.obs_ai_rate_hit(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.obs_ai_rate_hit(uuid, timestamptz) to service_role;

comment on table public.site_private_viewers is 'A5 E17 passo 0: quem tem o direito "ver desempenho privado" do site. Sem linha com revoked_at nulo, sem direito.';
comment on function public.can_view_private_site(uuid) is 'A5 E17 passo 0: quem edita o site, ou quem tem vínculo com ele e linha em vigor em site_private_viewers. Não lê o GUC app.site_id.';
```

### Apêndice B: roteiro de prova (`a5-e17-p0-prova.sql`) e a saída esperada

*(emenda 1: D-I1 e S-I1)* **Este roteiro foi reescrito e ainda não foi rodado.** O bloco que estava aqui na rodada 0 era o roteiro de outra etapa (pausa de canal), colado por engano: a pasta temporária era compartilhada e outro agente gravou por cima do arquivo. O roteiro verdadeiro não existe mais em lugar nenhum. O de baixo foi escrito de novo a partir da saída guardada da rodada 0, que serve de especificação, com três acréscimos: a coluna `revoked_by`, a contagem do rastro antes e depois de apagar quem concedeu, e a criação da organização raiz quando o banco não tem uma. Ele inclui o SQL da MG11 duas vezes seguidas (prova de idempotência) e termina em `rollback`.

Como rodar (Tarefa 1, passo 2): `psql -X "postgresql://postgres:postgres@127.0.0.1:54422/postgres" -f apps/web/test/fixtures/sql/a5-e17-p0-prova.sql 2>&1 | sed -E 's/^psql:[^ ]*:[0-9]+: //'`. Só no banco de integração, com ele livre. Os papéis `anon` e `authenticated` só chamam, no roteiro, as funções de sessão que eles podem executar (`can_view_site`, `can_edit_site`, `can_view_private_site`): nenhuma `_as` é chamada por eles (regra do Postgres local).

```sql
-- Roteiro de prova da MG11 (A5, E17 passo 0). Reescrito na emenda 1: o roteiro da rodada 0 se perdeu.
-- Tudo dentro de uma transação que termina em rollback. Só no banco de integração (porta 54422), com o banco livre.
-- Outro arquivo de SQL: psql -v mg=/caminho/absoluto/do/arquivo.sql -f a5-e17-p0-prova.sql
-- (emenda 2: D-m-d e S-n5) Depois da Tarefa 1b o arquivo padrão abaixo (a5-e17-p0-mg11.sql) deixa de existir, de propósito:
-- o SQL passa a ser o da migration, e -v mg=<arquivo da migration> vira obrigatório. "Arquivo não encontrado" sem -v mg é a
-- falha certa. NÃO recriar a cópia para "consertar".
\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on
\if :{?mg}
\else
\set mg a5-e17-p0-mg11.sql
\endif
begin;
set local client_min_messages = warning;
\ir :mg
\ir :mg

\echo == cenario
create temp table u (nome text primary key, id uuid not null default gen_random_uuid()) on commit drop;
insert into u (nome) values ('super'), ('orgadmin'), ('editor'), ('leitora'), ('reporter'), ('revogada'), ('exmembro'), ('editorB'), ('sem');
create temp table s (nome text primary key, id uuid not null default gen_random_uuid(), org uuid not null default gen_random_uuid()) on commit drop;
insert into s (nome) values ('A'), ('B');
select (select id from s where nome = 'A') as a, (select id from s where nome = 'B') as b, (select org from s where nome = 'A') as org_a,
       (select id from u where nome = 'super') as super, (select id from u where nome = 'orgadmin') as orgadmin, (select id from u where nome = 'editor') as editor,
       (select id from u where nome = 'leitora') as leitora, (select id from u where nome = 'reporter') as reporter, (select id from u where nome = 'revogada') as revogada,
       (select id from u where nome = 'exmembro') as exmembro, (select id from u where nome = 'editorB') as editorb,
       gen_random_uuid() as dono, gen_random_uuid() as k \gset
insert into auth.users (id, aud, role, email) select id, 'authenticated', 'authenticated', nome || '@mg11.test' from u;
-- quem concede e retira: uma pessoa sem papel nenhum, para poder ser apagada no fim sem mexer na matriz
insert into auth.users (id, aud, role, email) values (:'dono', 'authenticated', 'authenticated', 'dono@mg11.test');
-- só existe uma organização raiz por banco (organizations_single_master): usa a que houver, cria se não houver
insert into public.organizations (name, slug, parent_org_id) select 'Raiz MG11', 'mg11-raiz', null where not exists (select 1 from public.organizations where parent_org_id is null);
insert into public.organizations (id, name, slug, parent_org_id) select s.org, 'Org MG11 ' || s.nome, 'mg11-org-' || lower(s.nome), (select o.id from public.organizations o where o.parent_org_id is null) from s;
insert into public.sites (id, org_id, name, slug, domains, primary_domain) select s.id, s.org, 'Site MG11 ' || s.nome, 'mg11-site-' || lower(s.nome), array['mg11-' || lower(s.nome) || '.test'], 'mg11-' || lower(s.nome) || '.test' from s;
insert into public.organization_members (org_id, user_id, role) values ((select o.id from public.organizations o where o.parent_org_id is null), :'super', 'org_admin'), (:'org_a', :'orgadmin', 'org_admin');
insert into public.site_memberships (site_id, user_id, role) values (:'a', :'editor', 'editor'), (:'a', :'leitora', 'reporter'), (:'a', :'reporter', 'reporter'), (:'a', :'revogada', 'reporter'), (:'b', :'editorb', 'editor');
-- três concessões no site A: a leitora (em vigor), a revogada (concedida e retirada) e a ex-membro (em vigor, sem vínculo com o site)
insert into public.site_private_viewers (site_id, user_id, granted_by) values (:'a', :'leitora', :'dono'), (:'a', :'revogada', :'dono'), (:'a', :'exmembro', :'dono');
update public.site_private_viewers set revoked_at = now(), revoked_by = :'dono' where site_id = :'a' and user_id = :'revogada';

\echo == matriz _as (usuario|site|ver|editar|privado)
select u.nome, s.nome, public.can_view_site_as(u.id, s.id), public.can_edit_site_as(u.id, s.id), public.can_view_private_site_as(u.id, s.id) from u cross join s order by u.nome collate "C", s.nome collate "C";

\echo == nulo: usuario nulo, site nulo e site inexistente dao false, nunca nulo; a de sessao, sem sessao, tambem
select public.can_view_private_site_as(null, :'a'), public.can_view_private_site_as(:'leitora', null), public.can_view_private_site_as(:'leitora', gen_random_uuid()), public.can_view_private_site(:'a');

\echo == sessao x _as, com o GUC app.site_id forjado para o site A
create temp table r (usuario text, site text, ver boolean, editar boolean, privado boolean) on commit drop;
do $$
declare
  x record; v boolean; e boolean; p boolean;
  a uuid := (select id from s where nome = 'A');
begin
  for x in select u.nome as un, u.id as uid, s.nome as sn, s.id as sid from u cross join s loop
    perform set_config('request.jwt.claims', json_build_object('sub', x.uid, 'role', 'authenticated')::text, true);
    perform set_config('app.site_id', a::text, true);
    set local role authenticated;
    v := public.can_view_site(x.sid); e := public.can_edit_site(x.sid); p := public.can_view_private_site(x.sid);
    reset role;
    insert into r values (x.un, x.sn, v, e, p);
  end loop;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('app.site_id', '', true);
end $$;
select 'divergencias_sessao_x_as', count(*) from r join u on u.nome = r.usuario join s on s.nome = r.site
 where (r.ver, r.editar, r.privado) is distinct from (public.can_view_site_as(u.id, s.id), public.can_edit_site_as(u.id, s.id), public.can_view_private_site_as(u.id, s.id));
select 'linhas_comparadas', count(*) from r;

\echo == anon: a funcao de sessao responde false
create temp table an (v boolean) on commit drop;
do $$
declare a uuid := (select id from s where nome = 'A'); v boolean;
begin
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  v := public.can_view_private_site(a);
  reset role;
  insert into an values (v);
end $$;
select 'anon', v from an;

\echo == RLS de site_private_viewers (leitora ve a propria; reporter 0; super e orgadmin as 3 do site A; editor 0)
do $$
declare x record; n integer;
begin
  for x in select u.nome, u.id from u where u.nome in ('super', 'orgadmin', 'editor', 'leitora', 'reporter', 'editorB')
           order by array_position(array['super', 'orgadmin', 'editor', 'leitora', 'reporter', 'editorB'], u.nome) loop
    perform set_config('request.jwt.claims', json_build_object('sub', x.id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from public.site_private_viewers;
    reset role;
    raise warning 'rls site_private_viewers: % ve % linha(s)', x.nome, n;
  end loop;
  perform set_config('request.jwt.claims', '', true);
end $$;

\echo == escrita por authenticated e recusada (insert, update, delete)
do $$
declare
  a uuid := (select id from s where nome = 'A');
  oa uuid := (select id from u where nome = 'orgadmin');
  alvo uuid := (select id from u where nome = 'sem');
begin
  perform set_config('request.jwt.claims', json_build_object('sub', oa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin insert into public.site_private_viewers (site_id, user_id) values (a, alvo); raise warning 'insert como org_admin: PASSOU (defeito)';
  exception when insufficient_privilege then raise warning 'insert como org_admin: %', sqlstate; end;
  begin update public.site_private_viewers set revoked_at = now() where site_id = a; raise warning 'update como org_admin: PASSOU (defeito)';
  exception when insufficient_privilege then raise warning 'update como org_admin: %', sqlstate; end;
  begin delete from public.site_private_viewers where site_id = a; raise warning 'delete como org_admin: PASSOU (defeito)';
  exception when insufficient_privilege then raise warning 'delete como org_admin: %', sqlstate; end;
  begin insert into public.obs_ai_rate (key_id, grain, bucket) values (gen_random_uuid(), 'minuto', now()); raise warning 'insert em obs_ai_rate como authenticated: PASSOU (defeito)';
  exception when insufficient_privilege then raise warning 'insert em obs_ai_rate como authenticated: %', sqlstate; end;
  begin perform 1 from public.obs_ai_rate; raise warning 'select em obs_ai_rate como authenticated: PASSOU (defeito)';
  exception when insufficient_privilege then raise warning 'select em obs_ai_rate como authenticated: %', sqlstate; end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

\echo == rastro em audit_log
select action, count(*) from public.audit_log where resource_type = 'site_private_viewers' group by 1 order by 1;
select 'org_id_preenchido', bool_and(org_id is not null) from public.audit_log where resource_type = 'site_private_viewers';

\echo == runbook: conceder de novo a revogada (1 linha), conceder a quem ja tem (0 linhas), revogar (1), revogar de novo (0)
with x as (insert into public.site_private_viewers (site_id, user_id, granted_by) values ((select id from public.sites where slug = 'mg11-site-a'), (select id from auth.users where email = 'revogada@mg11.test'), (select id from auth.users where email = 'dono@mg11.test')) on conflict (site_id, user_id) do update set revoked_at = null, revoked_by = null, granted_by = excluded.granted_by, granted_at = now() where public.site_private_viewers.revoked_at is not null returning 1) select 'reconceder', count(*) from x;
with x as (insert into public.site_private_viewers (site_id, user_id, granted_by) values ((select id from public.sites where slug = 'mg11-site-a'), (select id from auth.users where email = 'revogada@mg11.test'), (select id from auth.users where email = 'dono@mg11.test')) on conflict (site_id, user_id) do update set revoked_at = null, revoked_by = null, granted_by = excluded.granted_by, granted_at = now() where public.site_private_viewers.revoked_at is not null returning 1) select 'conceder_a_quem_ja_tem', count(*) from x;
with x as (update public.site_private_viewers set revoked_at = now(), revoked_by = (select id from auth.users where email = 'dono@mg11.test') where site_id = (select id from public.sites where slug = 'mg11-site-a') and user_id = (select id from auth.users where email = 'revogada@mg11.test') and revoked_at is null returning 1) select 'revogar', count(*) from x;
with x as (update public.site_private_viewers set revoked_at = now(), revoked_by = (select id from auth.users where email = 'dono@mg11.test') where site_id = (select id from public.sites where slug = 'mg11-site-a') and user_id = (select id from auth.users where email = 'revogada@mg11.test') and revoked_at is null returning 1) select 'revogar_de_novo', count(*) from x;
select action, count(*) from public.audit_log where resource_type = 'site_private_viewers' group by 1 order by 1;
select 'revoked_by_na_linha_revogada', revoked_by = :'dono' from public.site_private_viewers where site_id = :'a' and user_id = :'revogada';

-- (emenda 2: D-N1 e D-m-g)
\echo == corrigir autor em branco: preenche quem retirou, nao muda quem le, nao grava rastro; revoked_by em linha em vigor e recusado
select count(*) as rastro_antes_corrigir from public.audit_log where resource_type = 'site_private_viewers' \gset
update public.site_private_viewers set revoked_by = null where site_id = :'a' and user_id = :'revogada';
with x as (update public.site_private_viewers set revoked_by = (select id from auth.users where email = 'dono@mg11.test') where site_id = (select id from public.sites where slug = 'mg11-site-a') and user_id = (select id from auth.users where email = 'revogada@mg11.test') and revoked_at is not null and revoked_by is null returning 1) select 'corrigir_autor', count(*) from x;
select 'continua_retirada', revoked_at is not null and revoked_by = :'dono', public.can_view_private_site_as(:'revogada', :'a') from public.site_private_viewers where site_id = :'a' and user_id = :'revogada';
select 'rastro_novo_ao_corrigir', count(*) - :rastro_antes_corrigir from public.audit_log where resource_type = 'site_private_viewers';
do $$
begin
  begin update public.site_private_viewers set revoked_by = granted_by where revoked_at is null; raise warning 'revoked_by em linha em vigor: PASSOU (defeito)';
  exception when check_violation then raise warning 'revoked_by em linha em vigor: %', sqlstate; end;
end $$;

\echo == contador de taxa (como service_role)
insert into public.pipeline_api_keys (id, site_id, name, key_hash, permissions, user_id) values (:'k', :'a', 'mg11 perfil', 'mg11-hash-perfil', array['observatorio_leitura'], :'leitora');
insert into public.obs_ai_access_log (site_id, user_id, key_id, origin, action, included_private, result) values (:'a', :'leitora', :'k', 'mcp', 'prova', true, 'ok');
set local role service_role;
select no_minuto, no_dia from public.obs_ai_rate_hit(:'k', '2026-10-13 23:59:10+00');
select no_minuto, no_dia from public.obs_ai_rate_hit(:'k', '2026-10-13 23:59:30+00');
select no_minuto, no_dia from public.obs_ai_rate_hit(:'k', '2026-10-13 20:59:59-03');
select no_minuto, no_dia from public.obs_ai_rate_hit(:'k', '2026-10-14 00:00:05+00');
select grain, bucket at time zone 'UTC', n from public.obs_ai_rate where key_id = :'k' order by 1, 2;
reset role;

\echo == check da permissao sozinha
do $$
declare a uuid := (select id from s where nome = 'A');
begin
  begin insert into public.pipeline_api_keys (site_id, name, key_hash, permissions) values (a, 'mg11 mista', 'mg11-hash-mista', array['observatorio_leitura', 'read']); raise warning 'chave com observatorio_leitura + read: PASSOU (defeito)';
  exception when check_violation then raise warning 'chave com observatorio_leitura + read: %', sqlstate; end;
  begin update public.pipeline_api_keys set permissions = array_append(permissions, 'read') where name = 'mg11 perfil'; raise warning 'acrescentar read a chave do perfil: PASSOU (defeito)';
  exception when check_violation then raise warning 'acrescentar read a chave do perfil: %', sqlstate; end;
end $$;

\echo == apagar usuario: a leitora some da concessao; quem concedeu e retirou vira nulo; chave fica sem dono; nenhum rastro novo
select count(*) as rastro_antes from public.audit_log where resource_type = 'site_private_viewers' \gset
delete from auth.users where id = :'leitora';
select 'linhas_da_leitora', count(*) from public.site_private_viewers where user_id = :'leitora';
select 'chave_sem_dono', user_id is null from public.pipeline_api_keys where id = :'k';
select 'log_sem_pessoa', bool_and(user_id is null), count(*) = 1 from public.obs_ai_access_log where action = 'prova';
select 'privado_da_leitora_apagada', public.can_view_private_site_as(:'leitora', :'a');
delete from auth.users where id = :'dono';
select 'granted_by_nulo', count(*) filter (where granted_by is null), count(*) from public.site_private_viewers;
select 'revoked_by_nulo', count(*) filter (where revoked_by is null), count(*) from public.site_private_viewers;
select 'rastro_novo_ao_apagar', count(*) - :rastro_antes from public.audit_log where resource_type = 'site_private_viewers';

\echo == custo: 1000 chamadas da funcao de sessao como o editor, a reporter sem direito e a ex-membro
do $$
declare x record; n integer; t0 timestamptz; a uuid := (select id from s where nome = 'A');
begin
  for x in select u.nome, u.id from u where u.nome in ('editor', 'reporter', 'exmembro')
           order by array_position(array['editor', 'reporter', 'exmembro'], u.nome) loop
    perform set_config('request.jwt.claims', json_build_object('sub', x.id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    t0 := clock_timestamp();
    select count(*) filter (where public.can_view_private_site(a)) into n from generate_series(1, 1000);
    reset role;
    raise warning 'custo: % -> % de 1000 verdadeiras em % ms', x.nome, n, round(extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
  perform set_config('request.jwt.claims', '', true);
end $$;
rollback;
```

**Saída esperada** (depois do `sed`, que tira o nome do arquivo e o número da linha dos avisos). As três linhas `custo:` variam e não entram na comparação; elas medem a função com argumento constante, que o Postgres pode avaliar uma vez só, e por isso não são a medida de custo por linha: essa é a F7. **De onde vem cada linha:** as que não têm marca são a saída guardada da rodada 0 (rodada quatro vezes com o roteiro que se perdeu); as três marcadas com `<- emenda 1` e as cinco marcadas com `<- emenda 2` *(emenda 2: D-N1 e D-m-g)* são novas e **nunca foram observadas** (a marca não faz parte da saída). A primeira linha da saída da rodada 0, `Output format is unaligned.`, some porque o roteiro de agora liga o modo silencioso antes.

```text
== cenario
== matriz _as (usuario|site|ver|editar|privado)
editor|A|t|t|t
editor|B|f|f|f
editorB|A|f|f|f
editorB|B|t|t|t
exmembro|A|f|f|f
exmembro|B|f|f|f
leitora|A|t|f|t
leitora|B|f|f|f
orgadmin|A|t|t|t
orgadmin|B|f|f|f
reporter|A|t|f|f
reporter|B|f|f|f
revogada|A|t|f|f
revogada|B|f|f|f
sem|A|f|f|f
sem|B|f|f|f
super|A|t|t|t
super|B|t|t|t
== nulo: usuario nulo, site nulo e site inexistente dao false, nunca nulo; a de sessao, sem sessao, tambem
f|f|f|f
== sessao x _as, com o GUC app.site_id forjado para o site A
divergencias_sessao_x_as|0
linhas_comparadas|18
== anon: a funcao de sessao responde false
anon|f
== RLS de site_private_viewers (leitora ve a propria; reporter 0; super e orgadmin as 3 do site A; editor 0)
WARNING:  rls site_private_viewers: super ve 3 linha(s)
WARNING:  rls site_private_viewers: orgadmin ve 3 linha(s)
WARNING:  rls site_private_viewers: editor ve 0 linha(s)
WARNING:  rls site_private_viewers: leitora ve 1 linha(s)
WARNING:  rls site_private_viewers: reporter ve 0 linha(s)
WARNING:  rls site_private_viewers: editorB ve 0 linha(s)
== escrita por authenticated e recusada (insert, update, delete)
WARNING:  insert como org_admin: 42501
WARNING:  update como org_admin: 42501
WARNING:  delete como org_admin: 42501
WARNING:  insert em obs_ai_rate como authenticated: 42501
WARNING:  select em obs_ai_rate como authenticated: 42501
== rastro em audit_log
private_view_granted|3
private_view_revoked|1
org_id_preenchido|t
== runbook: conceder de novo a revogada (1 linha), conceder a quem ja tem (0 linhas), revogar (1), revogar de novo (0)
reconceder|1
conceder_a_quem_ja_tem|0
revogar|1
revogar_de_novo|0
private_view_granted|4
private_view_revoked|2
revoked_by_na_linha_revogada|t          <- emenda 1
== corrigir autor em branco: preenche quem retirou, nao muda quem le, nao grava rastro; revoked_by em linha em vigor e recusado          <- emenda 2
corrigir_autor|1          <- emenda 2
continua_retirada|t|f          <- emenda 2
rastro_novo_ao_corrigir|0          <- emenda 2
WARNING:  revoked_by em linha em vigor: 23514          <- emenda 2
== contador de taxa (como service_role)
1|1
2|2
3|3
1|1
dia|2026-10-13 00:00:00|3
dia|2026-10-14 00:00:00|1
minuto|2026-10-13 23:59:00|3
minuto|2026-10-14 00:00:00|1
== check da permissao sozinha
WARNING:  chave com observatorio_leitura + read: 23514
WARNING:  acrescentar read a chave do perfil: 23514
== apagar usuario: a leitora some da concessao; quem concedeu e retirou vira nulo; chave fica sem dono; nenhum rastro novo
linhas_da_leitora|0
chave_sem_dono|t
log_sem_pessoa|t|t
privado_da_leitora_apagada|f
granted_by_nulo|2|2
revoked_by_nulo|2|2          <- emenda 1
rastro_novo_ao_apagar|0          <- emenda 1
== custo: 1000 chamadas da funcao de sessao como o editor, a reporter sem direito e a ex-membro
WARNING:  custo: editor -> 1000 de 1000 verdadeiras em 1 ms
WARNING:  custo: reporter -> 0 de 1000 verdadeiras em 0 ms
WARNING:  custo: exmembro -> 0 de 1000 verdadeiras em 0 ms
```

**O que cada linha nova prova.** `rastro_novo_ao_apagar|0`: apagar a leitora e apagar quem concedeu e retirou não gravou linha nenhuma em `audit_log` (com o gatilho da rodada 0 seria maior que zero, porque o `set null` das duas colunas é um `update`). `revoked_by_na_linha_revogada|t`: a instrução de retirar gravou quem retirou. `revoked_by_nulo|2|2`: sobram duas concessões (a da revogada e a da ex-membro) e nenhuma guarda o id de quem foi apagado. *(emenda 2: D-N1 e D-m-g)* `corrigir_autor|1`: o comando "corrigir autor em branco" achou a linha retirada sem autor e a preencheu. `continua_retirada|t|f`: depois dele a linha continua retirada, com o autor certo, e a pessoa continua **sem** ler. `rastro_novo_ao_corrigir|0`: anular e corrigir o autor não gravaram linha em `audit_log` (nenhum dos dois `update` cita `revoked_at`). `revoked_by em linha em vigor: 23514`: o `check` recusou marcar "quem retirou" em quem ainda tem o direito (há duas linhas em vigor nesse ponto, a da leitora e a da ex-membro). `PASSOU (defeito)` em qualquer aviso = uma escrita que devia ser recusada passou: parar.

### Apêndice C: os comandos do dono (vão para o runbook da Tarefa 9)

Rodar no editor de SQL do painel do Supabase, **um por vez**. Trocar o e-mail e o slug do site. **Não conceder a ninguém antes de o plano de fechamento estar em produção.**

*(emenda 1: D-m2)* As instruções de conceder, de retirar e de retirar de todos mudaram (levam `revoked_by`), e as consultas "quem tem o direito hoje" e "o histórico" passaram a mostrar quem concedeu e quem retirou. **Nenhuma das cinco foi rodada depois da mudança** (Tarefa 9 e o roteiro do Apêndice B as rodam).

*(emenda 2: D-N1, S-n6 e D-m-f)* A emenda 2 acrescentou um **sexto comando**, "corrigir autor em branco"; pôs `returning` nas instruções de escrita, para o resultado ser a própria linha alterada (não se mediu como o painel mostra uma escrita sem `returning`: conferência da Tarefa 9); e fez "o histórico" mostrar e-mail, não só identificador. **Nada disso foi rodado.** O e-mail `tnfigueiredotv@gmail.com` escrito nos comandos como "quem concede e quem retira" **não foi conferido contra o login de produção**: é a P14, e se ela der `0` o e-mail é trocado aqui e no runbook.

Quem tem o direito hoje (zero linhas = ninguém além de quem edita). **Rodar também logo depois de conceder e de retirar.** *(emenda 2: D-N1)* `concedido_por` em branco numa linha em vigor, ou `retirado_por` em branco numa linha retirada, quer dizer que o seu e-mail foi digitado errado na instrução, ou que quem fez foi apagado. **Se foi você e o e-mail saiu errado: rodar "corrigir autor em branco", mais abaixo.** **Nunca conceder para consertar uma linha retirada:** numa linha retirada, "retirar" não altera nada e "conceder" devolve o direito a quem você tinha tirado. **Se quem concedeu ou retirou foi outra pessoa e ela foi apagada, o branco é o estado certo e não se mexe** (o comando de corrigir gravaria o seu nome numa ação que não foi sua).
```sql
select u.email, s.slug, v.granted_at, g.email as concedido_por, v.revoked_at, r.email as retirado_por from public.site_private_viewers v join auth.users u on u.id = v.user_id join public.sites s on s.id = v.site_id left join auth.users g on g.id = v.granted_by left join auth.users r on r.id = v.revoked_by order by 2, 1;
```

Conceder (resultado esperado, *emenda 2: S-n6*: **uma linha devolvida**, com `revoked_at` em branco, que no `psql` aparece junto de `INSERT 0 1`; **nenhuma linha devolvida** (`INSERT 0 0`) = ela já tem o direito em vigor e nada mudou; erro `null value in column "site_id"` = o slug do site não existe; erro `null value in column "user_id"` = o e-mail não existe. Rodado com os valores de exemplo: dá o erro de `site_id` e nada é gravado):
```sql
insert into public.site_private_viewers (site_id, user_id, granted_by) values ((select id from public.sites where slug = 'SLUG-DO-SITE'), (select id from auth.users where email = 'email-dela@exemplo.com'), (select id from auth.users where email = 'tnfigueiredotv@gmail.com')) on conflict (site_id, user_id) do update set revoked_at = null, revoked_by = null, granted_by = excluded.granted_by, granted_at = now() where public.site_private_viewers.revoked_at is not null returning user_id, granted_at, granted_by, revoked_at;
```

Retirar (resultado esperado, *emenda 2: S-n6*: **uma linha devolvida**, com `revoked_at` preenchido (`UPDATE 1`); **nenhuma linha** (`UPDATE 0`) = ela não tinha o direito em vigor):
```sql
update public.site_private_viewers set revoked_at = now(), revoked_by = (select id from auth.users where email = 'tnfigueiredotv@gmail.com') where site_id = (select id from public.sites where slug = 'SLUG-DO-SITE') and user_id = (select id from auth.users where email = 'email-dela@exemplo.com') and revoked_at is null returning user_id, revoked_at, revoked_by;
```

Retirar de todos, de uma vez (o resultado traz uma linha por pessoa que perdeu o direito; nenhuma linha = ninguém tinha):
```sql
update public.site_private_viewers set revoked_at = now(), revoked_by = (select id from auth.users where email = 'tnfigueiredotv@gmail.com') where revoked_at is null returning site_id, user_id, revoked_at, revoked_by;
```

*(emenda 2: D-N1)* Corrigir autor em branco (dois comandos, **um por vez**; usar só quando "quem tem o direito hoje" mostrar em branco uma concessão ou uma retirada que **você** fez). Nenhum dos dois toca `revoked_at`: **não mudam quem lê** e não gravam linha no histórico. O primeiro preenche quem concedeu; o segundo, quem retirou, e só em linha já retirada. Resultado esperado de cada um: **uma linha devolvida** = corrigido; **nenhuma linha** = não havia branco para corrigir naquela pessoa (ou o seu e-mail continua errado: conferir com "quem tem o direito hoje", que tem de mostrar o seu e-mail na coluna):
```sql
update public.site_private_viewers set granted_by = (select id from auth.users where email = 'tnfigueiredotv@gmail.com') where site_id = (select id from public.sites where slug = 'SLUG-DO-SITE') and user_id = (select id from auth.users where email = 'email-dela@exemplo.com') and granted_by is null returning user_id, granted_by, revoked_at;
```
```sql
update public.site_private_viewers set revoked_by = (select id from auth.users where email = 'tnfigueiredotv@gmail.com') where site_id = (select id from public.sites where slug = 'SLUG-DO-SITE') and user_id = (select id from auth.users where email = 'email-dela@exemplo.com') and revoked_at is not null and revoked_by is null returning user_id, revoked_by, revoked_at;
```
Se o seu e-mail estiver errado **de novo** neste comando, a subconsulta dá nulo, a coluna continua em branco e a linha volta "corrigida" com o autor vazio: por isso a conferência é sempre pela consulta "quem tem o direito hoje", não pela contagem de linhas.

O histórico de concessões e retiradas (*emenda 2: D-m-f e S-n6*: as colunas `concedido_por` e `retirado_por` passam a ser e-mail; ficam em branco se a pessoa foi apagada, e por isso o identificador gravado no rastro vem ao lado):
```sql
select a.created_at, a.action, u.email as para_quem, g.email as concedido_por, r.email as retirado_por, a.after_data->>'granted_by' as id_de_quem_concedeu, a.after_data->>'revoked_by' as id_de_quem_retirou from public.audit_log a left join auth.users u on u.id = a.resource_id left join auth.users g on g.id = (a.after_data->>'granted_by')::uuid left join auth.users r on r.id = (a.after_data->>'revoked_by')::uuid where a.resource_type = 'site_private_viewers' order by a.created_at;
```

Conferir, depois de conceder, que a regra responde o que se espera para ela (esperado: `t, f, t`):
```sql
select public.can_view_site_as(u.id, s.id) as ver, public.can_edit_site_as(u.id, s.id) as editar, public.can_view_private_site_as(u.id, s.id) as privado from auth.users u, public.sites s where u.email = 'email-dela@exemplo.com' and s.slug = 'SLUG-DO-SITE';
```
