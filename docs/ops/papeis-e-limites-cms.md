# Papéis e limites do CMS — o que o código permite hoje

Retrato de 2026-10-07 (`staging`, depois das migrations `20261007000003/4`). Não é o desenho
desejado: é o que os guardas reais deixam passar, para o dono decidir onde apertar.
Como validar de novo: `docs/ops/runbook-cms-e2e-local.md` (seção "Convite de editora").

**Marcação:** ✔ = **verificado** (executado no Supabase local, na tela ou por teste de integração
como usuário autenticado) · 📖 = **lido no código** (não executado).

## Em uma frase

Dentro do `/cms`, **editora = administradora**. Quase toda ação é guardada por
`requireSiteScope({ mode: 'edit' })` → `can_edit_site`, que vale para `org_admin` e para `editor`.
`mode: 'publish'` → `can_publish_site`, que é literalmente `select can_edit_site(...)`. O que separa
os dois hoje é só: a área `/admin`, a gestão de pessoas e três pontos isolados.

## Quem é quem

| Papel | Onde mora | Como se ganha |
|---|---|---|
| `super_admin` | `organization_members.role='org_admin'` na organização **raiz** | convite escopo `org`. Com uma organização só, todo `org_admin` é `super_admin` ✔ |
| `org_admin` | `organization_members` de uma org filha | idem (hoje não existe org filha em produção) |
| `editor` | `site_memberships.role='editor'` | convite escopo `site`, papel editor ✔ |
| `reporter` | `site_memberships.role='reporter'` | convite escopo `site`, papel reporter 📖 |

Os guardas, do mais largo para o mais estreito:

| Guarda | Passa quem | Onde é usado |
|---|---|---|
| layout do `/cms` (`is_member_staff`) | os quatro papéis (✔ adm, editor · 📖 reporter) | entrar no CMS |
| `can_view_site` (`mode: 'view'`) | os quatro, no site em que têm vínculo (✔ editor · 📖 reporter) | notificações, prévia de newsletter, playlists (GET), leitura de nichos |
| `can_edit_site` (`mode: 'edit'`, `requireEditAccess`, `requireSiteAdminForRow`, `requireEditScope`) | super_admin, org_admin, **editor** ✔ — reporter não 📖 | ~95% das ações de escrita |
| `can_publish_site` (`mode: 'publish'`) | igual a `can_edit_site` ✔ | publicar vídeo, upload para o YouTube, textos de página do YouTube |
| trigger `enforce_publish_permission` | só age em `blog_posts` e `campaigns`, e **ignora o service role** — que é como as ações escrevem 📖 | na prática não barra nada vindo da tela |
| `can_admin_site_users` | super_admin, org_admin ✔ | "+25 vagas" do Observatório; reenviar convite |
| `is_org_admin` | super_admin, org_admin ✔ | `/admin/users`, `/admin/sites`, `/admin/audit` |
| `requireArea('admin')` (`is_admin`) | quem tem `app_metadata.role` = admin/super_admin **no JWT** ✔ | toda a área `/admin`, anúncios, AdSense |

## Ação × papel

`adm` = super_admin/org_admin. ⚠ = caro ou irreversível.

### Entrar e ver

| Ação | adm | editor | reporter | |
|---|---|---|---|---|
| Entrar no `/cms`, sidebar completa | sim | sim | sim | ✔ adm, editor · 📖 reporter |
| Abrir todas as telas do CMS (44 rotas varridas: Dashboard, Vídeos, YouTube ×8, Competitors com Mudanças/Outliers/Insights/Histórico, Schedule, Up Next, Media, Blog, Newsletters, Campaigns, Subscribers, Contacts, Settings ×4, Social, Links, Authors, Analytics…) | sim | **sim, idêntico ao dono** | sim (as telas leem pelo service role depois do portão) | ✔ adm, editor · 📖 reporter |
| Ver lista de assinantes e de contatos (e-mails, mensagens) | sim | **sim** | sim | ✔ editor (tela abre) · 📖 reporter |
| Ver o feed "Atividade" do Dashboard (inclui quem entrou/saiu da equipe) | sim | **sim** | sim | ✔ |
| Abrir o detalhe de um contato (`/cms/contacts/[id]`) | sim, **depois da migration 0003** (antes: ninguém) | não — volta para `/cms` sem mensagem | não | 📖 (`can_admin_site`) |
| `/admin`, `/admin/users`, `/admin/sites`, `/admin/audit` | sim (só com papel admin no JWT) | não — cai em `/?error=insufficient_access`, sem mensagem | não | ✔ |

### Vídeos, roteiros, agenda (o trabalho dela)

| Ação | adm | editor | reporter | |
|---|---|---|---|---|
| Criar/editar item do pipeline, roteiro, estágio, gravação | sim | sim | não | 📖 (`edit`) |
| Schedule / Up Next: mover, agendar, "trabalhando hoje" | sim | sim | não | 📖 (`edit`) |
| ⚠ `publishVideo` (cria o teste A/B e marca publicado) e upload para o YouTube | sim | **sim** | não | 📖 (`publish` = `edit`) |
| Upload de mídia | sim | sim | não | 📖 (`edit`) |
| ⚠ Apagar mídia (individual e em lote; some de vez em 30 dias) | sim | **sim** | não | 📖 (`edit`) |

### YouTube

| Ação | adm | editor | reporter | |
|---|---|---|---|---|
| Fixar / desafixar vídeo de concorrente, marcar mudança | sim | sim | não | ✔ editor (fixou e desafixou) · 📖 resto |
| Adicionar / ⚠ remover canal concorrente | sim | **sim** | não | 📖 (`edit`) |
| ⚠ Sincronizar concorrentes, histórico completo, "Sincronizar tudo" (gasta cota da API) | sim | **sim** | não | 📖 (`edit`) |
| "+25 vagas" de canais no Observatório | sim | **não** | não | 📖 (`can_admin_site_users`) |
| ⚠ Adicionar / remover canal próprio (`removeYouTubeChannel`; a tela mostra o impacto antes) | sim | **sim** | não | 📖 (`edit`) |
| Criar, iniciar, pausar, encerrar teste A/B | sim | sim | não | 📖 (`edit`) |
| ⚠ `applyWinnerNow`, `forceRotate`, `revertWinner` (trocam título/thumbnail no canal de verdade) | sim | **sim** | não | 📖 (`edit`) |
| Configurações do A/B do site, categorias, comentários curados | sim | sim | não | 📖 (`edit`) |

### Blog, newsletter, campanhas, audiência

| Ação | adm | editor | reporter | |
|---|---|---|---|---|
| Criar/editar/publicar post; ⚠ apagar em lote | sim | sim | não | 📖 (`edit`) |
| Criar/editar edição de newsletter, enviar teste | sim | sim | não | 📖 (`edit`) |
| ⚠ `sendNow` / agendar edição (dispara e-mail para a lista inteira) | sim | **sim** | não | 📖 (`edit`) |
| ⚠ Apagar edição ou tipo de newsletter | sim | **sim** | não | 📖 (`edit`) |
| ⚠ `exportSubscribers`, `exportContacts` (CSV com dados pessoais) | sim | **sim** | não | 📖 (`edit`) |
| ⚠ Cancelar assinaturas em lote, anonimizar contatos (irreversível), responder contato por e-mail | sim | **sim** | não | 📖 (`edit`) |
| Campanhas, links, linktree, QR, autores, waitlists, playlists | sim | sim | não | 📖 (`edit`) |

### Integrações e configuração

| Ação | adm | editor | reporter | |
|---|---|---|---|---|
| ⚠ Conectar / desconectar Instagram, YouTube, Meta, Bluesky (OAuth e tokens) | sim | **sim** | não | 📖 (`edit`) |
| ⚠ Publicar post / story social | sim | **sim** | não | 📖 (`edit`) |
| `/cms/settings` (29 ações: branding, identidade, sync manual do Instagram, notificações…) | sim | **sim** | não | 📖 (`edit`) |
| AdSense, anúncios, configurações do site em `/admin/sites` | sim | não | não | 📖 (`requireArea('admin')`) |

### Pessoas

| Ação | adm | editor | reporter | |
|---|---|---|---|---|
| Convidar, reenviar, revogar, copiar link do convite | sim | não | não | ✔ |
| Mudar papel, revogar acesso, reatribuir conteúdo | sim | não | não | 📖 (`is_org_admin` na ação + policy `can_admin_site_users`) |
| Ler/escrever `organization_members`, `invitations`; alterar `sites`/`organizations` direto pela API | sim | não (0 linhas / 42501) | não | ✔ |
| Promover a si mesma a org_admin | — | não | não | ✔ |

## Onde a editora PODE e provavelmente não deveria

1. **Disparar newsletter para a lista inteira** (`sendNow`) e apagar edições.
2. **Exportar assinantes e contatos** em CSV, e anonimizar/cancelar em lote (LGPD: ela vira operadora de dados pessoais).
3. **Aplicar/forçar/reverter vencedor de teste A/B** — mexe no canal de verdade.
4. **Conectar e desconectar integrações** (tokens do Instagram/YouTube/Meta) e mexer em todo `/cms/settings`.
5. **Remover canal próprio do YouTube** e canais concorrentes (apaga histórico).
6. **Gastar cota** com sincronizações completas.
7. Ver o feed de atividade com a movimentação da equipe.

## Onde ela NÃO PODE e talvez precise

1. Abrir o detalhe de um contato (só admin) — hoje ela vê a lista mas o clique devolve para `/cms` sem explicação.
2. "+25 vagas" de canais no Observatório.
3. Nada mais: para vídeo, roteiro, schedule, mídia e concorrentes ela tem tudo.

## Achados laterais (não corrigidos aqui)

- **`reporter` não bate com a descrição** ("lê/edita o próprio, não publica"): pelo código ele vê tudo e não escreve nada. 📖
- **Papel exibido ≠ papel real em `/admin`**: `/admin` exige `app_metadata.role` no JWT. Uma segunda `org_admin` convidada é `super_admin` no banco mas **não entra em `/admin`** (nem em `/admin/users`). ✔
- **Crons procuram `organization_members.role = 'super_admin'`**, valor que o CHECK da tabela proíbe: `ab-watchdog`, `research-digest`, `ab-escalation` e o aviso do `competitor-sync` nunca acham destinatário e ficam verdes. 📖
- **`/admin/settings` dá 404** para todo mundo (link morto na sidebar do Admin). ✔
- Aceitar convite manda para `https://<primary_domain>/cms/login`; em produção é `https://bythiagofigueiredo.com/cms/login`. ✔

## Decisões para o dono (com recomendação)

1. **Criar um degrau "administrar o site" entre editar e ser dono?** Hoje `publish` = `edit`.
   *Recomendo sim:* um guard `admin` (`can_admin_site_users`) para as ações ⚠ das perguntas 2–4; `edit` continua sendo o dia a dia.
2. **Editora dispara newsletter e exporta/anonimiza assinantes e contatos?**
   *Recomendo não:* envio, exportação, anonimização e cancelamento em lote só para admin; ela segue redigindo e mandando teste.
3. **Editora aplica vencedor de A/B, remove canais e conecta/desconecta integrações?**
   *Recomendo:* criar/pausar teste sim; `applyWinnerNow`/`forceRotate`/`revertWinner`, remoção de canal próprio e toda conexão OAuth só admin.
4. **Editora publica no YouTube (`publishVideo`, upload)?**
   *Recomendo sim* — é o trabalho dela — desde que a pergunta 3 feche o resto.
5. **Sincronizações que gastam cota ficam livres para a editora?**
   *Recomendo:* sync normal sim; "histórico completo" e "+25 vagas" só admin (o segundo já é).
6. **O que é `reporter`?** O código não implementa "edita o próprio".
   *Recomendo:* tirar a opção do formulário de convite até existir a regra, em vez de oferecer um papel que só lê.
