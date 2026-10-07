# Papéis e limites do CMS — o que o código permite hoje

Retrato de 2026-10-07 (`staging`, depois das migrations `20261007000003/4` **e do degrau
"administrar o site"**, decidido pelo dono no mesmo dia). É o que os guardas reais deixam passar.
Como validar de novo: `docs/ops/runbook-cms-e2e-local.md` (seção "Convite de editora").

**Marcação:** ✔ = **verificado** (executado no Supabase local, na tela ou por teste de integração
como usuário autenticado) · 🧪 = **coberto por teste unitário** com o guarda real e a resposta do
banco trocada (`test/cms/site-admin-step-*.test.ts`) · 📖 = **lido no código** (não executado).

## Em uma frase

Dentro do `/cms` existem agora **dois degraus**: **editar** (`can_edit_site` — org_admin e editora:
o dia a dia) e **administrar o site** (`can_admin_site_users` — só super_admin/org_admin: o que é
caro, irreversível, manda algo para fora em massa, expõe dado pessoal em lote ou mexe em
credencial). `mode: 'publish'` continua sendo literalmente `can_edit_site`.

## O degrau "administrar o site"

- **Guarda único:** `requireSiteAdminScope(siteId)` em `apps/web/lib/cms/auth-guards.ts` (e a forma
  curta `denyUnlessSiteAdmin(siteId, 'ação')`). Pergunta `can_admin_site_users(site_id)` ao banco
  pelo cliente da **sessão**, no topo da action, antes de qualquer `getSupabaseServiceClient()`.
  **Falha fechado:** sem usuário, erro de RPC, exceção ou qualquer resposta diferente de `true` negam.
- **Não existe papel novo em tabela.** Passa quem é `org_admin` da organização dona do site ou da
  organização raiz (`super_admin`). O dono — `org_admin` da raiz, **sem** linha em
  `site_memberships` — passa ✔ (`test/integration/site-admin-scope.test.ts` e na tela).
- **Recusa:** no formato que a action já usava, com a frase *"Só quem administra o site pode …"*.
- **Tela:** o layout do `/cms` pergunta uma vez e entrega o booleano por `SiteAdminProvider`
  (`lib/cms/site-admin-context.tsx`); o controle restrito some e o motivo fica escrito
  (`AdminOnlyNote`). A tela é cortesia — o servidor confere de novo em toda action.
- **Para restringir mais uma ação:** duas linhas no topo da action
  (`const denied = await denyUnlessSiteAdmin(siteId, '…'); if (denied) return denied`), o controle
  atrás de `useCanAdminSite()` e um caso em `test/cms/site-admin-step-*.test.ts`.
- **Não muda:** `/api/pipeline/*`, `/api/mcp`, crons e a chave `PIPELINE_COWORK_KEY` (são máquina).
  As rotas de pipeline também aceitam sessão com `can_edit_site`, mas nenhuma delas faz o que o
  degrau restringe (não há envio de newsletter, export de dado pessoal, aplicar vencedor, remover
  canal nem integração por ali) 📖.

## Quem é quem

| Papel | Onde mora | Como se ganha |
|---|---|---|
| `super_admin` | `organization_members.role='org_admin'` na organização **raiz** | convite escopo `org`. Com uma organização só, todo `org_admin` é `super_admin` ✔ |
| `org_admin` | `organization_members` de uma org filha | idem (hoje não existe org filha em produção) |
| `editor` | `site_memberships.role='editor'` | convite escopo `site`, papel editor ✔ |
| `reporter` | `site_memberships.role='reporter'` | o formulário de convite **não oferece mais** (07/10); convites antigos e a tela de editar usuário ainda criam 📖 |

Os guardas, do mais largo para o mais estreito:

| Guarda | Passa quem | Onde é usado |
|---|---|---|
| layout do `/cms` (`is_member_staff`) | os quatro papéis (✔ adm, editor · 📖 reporter) | entrar no CMS |
| `can_view_site` (`mode: 'view'`) | os quatro, no site em que têm vínculo (✔ editor · 📖 reporter) | notificações, prévia de newsletter, playlists (GET), leitura de nichos |
| `can_edit_site` (`mode: 'edit'`, `requireEditAccess`, `requireSiteAdminForRow`, `requireEditScope`) | super_admin, org_admin, **editor** ✔ — reporter não 📖 | o dia a dia: quase toda escrita que não está no degrau |
| `can_publish_site` (`mode: 'publish'`) | igual a `can_edit_site` ✔ | publicar vídeo, upload para o YouTube, textos de página do YouTube |
| trigger `enforce_publish_permission` | só age em `blog_posts` e `campaigns`, e **ignora o service role** — que é como as ações escrevem 📖 | na prática não barra nada vindo da tela |
| **`can_admin_site_users`** (`requireSiteAdminScope`) | super_admin, org_admin ✔ — **editora não** ✔ | **o degrau "administrar o site"** (tabelas abaixo), "+25 vagas" do Observatório, reenviar convite |
| `is_org_admin` | super_admin, org_admin ✔ | `/admin/users`, `/admin/sites`, `/admin/audit` |
| `requireArea('admin')` (`is_admin`) | quem tem `app_metadata.role` = admin/super_admin **no JWT** ✔ | toda a área `/admin`, anúncios, AdSense |

## Ação × papel

`adm` = super_admin/org_admin = **quem administra o site**. ⚠ = caro ou irreversível.
**só adm** = passou a exigir o degrau em 2026-10-07 (antes a editora podia).

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
| Adicionar canal concorrente; mudar o nicho de um concorrente | sim | sim | não | ✔ editor (tela) · 🧪 |
| ⚠ Remover canal concorrente (`removeCompetitorChannel`) | sim | **só adm** | não | ✔ dono removeu na tela · ✔ editora sem o item · 🧪 |
| Sincronizar **um** canal por vez (`syncCompetitorNow`, `triggerSync(channelId)`) | sim | sim | não | 🧪 · ✔ item no menu da editora |
| ⚠ "Sincronizar concorrentes" (todos), "Sincronizar tudo" (todos os canais próprios), histórico completo (`syncCompetitorsNow`, `triggerSync()`, `syncFullHistory`) | sim | **só adm** | não | 🧪 · ✔ botões só para o dono |
| "+25 vagas" de canais no Observatório | sim | não | não | 📖 (`can_admin_site_users`) |
| Adicionar canal próprio, criar nicho | sim | sim | não | 📖 (`edit`) |
| ⚠ Remover canal próprio; mudar idioma/nicho dele (`removeYouTubeChannel`, `updateYouTubeChannelIdentity`, `setOwnChannelNiche`) | sim | **só adm** | não | 🧪 · ✔ nicho do canal próprio vira texto para a editora |
| Criar, iniciar, pausar, retomar teste A/B; encerrar restaurando o original | sim | sim | não | 🧪 |
| ⚠ `applyWinnerNow`, `forceRotate`, `revertWinner`, encerrar aplicando a variante líder (`endAbTest` com vencedor ≠ original) | sim | **só adm** | não | 🧪 |
| Configurações do A/B do site, categorias, comentários curados | sim | sim | não | 📖 (`edit`) |

### Blog, newsletter, campanhas, audiência

| Ação | adm | editor | reporter | |
|---|---|---|---|---|
| Criar/editar/publicar post; ⚠ apagar em lote | sim | sim | não | 📖 (`edit`) |
| Criar/editar edição de newsletter, enviar **teste**, descartar/apagar rascunho | sim | sim | não | 🧪 · ✔ "Send Test Email" no menu da editora |
| ⚠ Disparar para a base: `sendNow`, `scheduleEdition`, `scheduleEditionToSlot`, `swapSlotEdition`, `scheduleEditionAsSpecial`, `retryEdition`, `moveEdition` → agendada | sim | **só adm** | não | 🧪 · ✔ na tela (dono vê Schedule/Send Now; editora vê o motivo) |
| ⚠ Cancelar envio real: `cancelEdition`/`moveEdition`/`deleteEdition` de edição **agendada** | sim | **só adm** | não | 🧪 |
| ⚠ Apagar edição enviada; apagar tipo de newsletter (apaga os assinantes junto) | sim | **só adm** | não | 🧪 |
| ⚠ `exportSubscribers`, `exportContacts`, `exportWaitlistSignups` (CSV com dados pessoais) | sim | **só adm** (o de waitlist aceitava até `view`) | não | 🧪 · ✔ dono exportou; editora sem o botão |
| ⚠ `batchUnsubscribe` (anonimiza), `anonymizeSubmission`, `bulkAnonymize` | sim | **só adm** | não | 🧪 |
| Marcar contato como respondido, ligar/desligar consentimento de rastreio de um assinante, responder contato por e-mail | sim | sim | não | 🧪 (os dois primeiros) · 📖 |
| Campanhas, links, linktree, QR, autores, waitlists (criar/editar/abrir/fechar), playlists | sim | sim | não | 📖 (`edit`) |

### Integrações e configuração

| Ação | adm | editor | reporter | |
|---|---|---|---|---|
| ⚠ Conectar / desconectar / remover conta e trocar credencial: Instagram (`addInstagramAccount`, `removeInstagramAccount`, `setInstagramToken`, `disconnectInstagramAccount`, `authorizeInstagramRebind`), redes sociais (`connectSocial`, `disconnectSocial`) e as rotas de OAuth (`/api/instagram/oauth` + callback, `/api/social/oauth/[provider]` + callback — inclui reconectar o token do YouTube) | sim | **só adm** | não | 🧪 · ✔ editora recebeu 403 nas duas rotas com a própria sessão |
| ⚠ Zona de perigo: desligar o CMS, apagar o site (`disableCms`, `deleteSite`) | sim | **só adm** | não | 🧪 · ✔ aba some para a editora |
| Sincronizar o Instagram agora, ajustar slots e opções da conta | sim | sim | não | 🧪 (não perguntam pelo degrau) |
| ⚠ Publicar post / story social | sim | **sim** | não | 📖 (`edit`) |
| Resto de `/cms/settings` (branding, identidade do site, SEO, idiomas, fuso, cadência, página de contato, notificações) | sim | **sim** | não | 📖 (`edit`) |
| AdSense, anúncios, configurações do site em `/admin/sites` | sim | não | não | 📖 (`requireArea('admin')`) |

### Pessoas

| Ação | adm | editor | reporter | |
|---|---|---|---|---|
| Convidar, reenviar, revogar, copiar link do convite | sim | não | não | ✔ |
| Mudar papel, revogar acesso, reatribuir conteúdo | sim | não | não | 📖 (`is_org_admin` na ação + policy `can_admin_site_users`) |
| Ler/escrever `organization_members`, `invitations`; alterar `sites`/`organizations` direto pela API | sim | não (0 linhas / 42501) | não | ✔ |
| Promover a si mesma a org_admin | — | não | não | ✔ |

## O que a editora ainda pode e o dono pode querer rever

Ficou como estava, por não estar nas decisões de 07/10 (cada uma é uma linha para restringir):

1. **Apagar conteúdo em lote** — posts (`bulkDelete`), campanhas, links, mídia (some de vez em 30 dias).
2. **Publicar post / story social** e mexer nos padrões e na fila do Social.
3. **Resto de `/cms/settings`** — branding, identidade do site, SEO, idiomas, fuso, cadência.
4. **Adicionar canal próprio** do YouTube e criar nicho (remover e mudar identidade já são do degrau).
5. **`updateVideoLimit`** (50 → 200 vídeos acompanhados por concorrente: sync mais caro dali em diante)
   e adicionar concorrente já com 200.
6. **Configurações do A/B do site** (`updateAbSiteSettings`) e `cancelGracePeriod`.
7. **Cadência da newsletter** (`toggleCadence`, `updateCadence*`, `updateSendTime`) e trocar o tipo ou
   o conteúdo de uma edição já agendada (`reassignEditionType`, `saveEdition`).
8. **Responder contato por e-mail** (`sendReply`) — um e-mail por vez; hoje ela nem abre o detalhe.
9. **Agenda de sync do canal próprio** (`updateYouTubeChannelSettings`).
10. Ver a lista de assinantes/contatos e o feed "Atividade" do Dashboard.

## Onde ela NÃO PODE e talvez precise

1. Abrir o detalhe de um contato (só admin) — ela vê a lista mas o clique devolve para `/cms` sem explicação.
2. "Sincronizar concorrentes"/"Sincronizar tudo" de uma vez: o cron diário já roda os dois; ela
   sincroniza um canal por vez. Se isso atrapalhar, é tirar o guarda de `syncCompetitorsNow` e do
   `triggerSync()` sem canal (leitura literal da decisão 5: "qualquer sync marcado como caro em cota").
3. Trocar o nicho de um canal **próprio** pelo Observatório (entrou junto com "identidade do canal").

## Achados laterais (não corrigidos aqui)

- **`reporter` não bate com a descrição** ("lê/edita o próprio, não publica"): pelo código ele vê tudo e não escreve nada. 📖
- **Papel exibido ≠ papel real em `/admin`**: `/admin` exige `app_metadata.role` no JWT. Uma segunda `org_admin` convidada é `super_admin` no banco mas **não entra em `/admin`** (nem em `/admin/users`). ✔
- **Crons procuram `organization_members.role = 'super_admin'`**, valor que o CHECK da tabela proíbe: `ab-watchdog`, `research-digest`, `ab-escalation` e o aviso do `competitor-sync` nunca acham destinatário e ficam verdes. 📖
- **`/admin/settings` dá 404** para todo mundo (link morto na sidebar do Admin). ✔
- Aceitar convite manda para `https://<primary_domain>/cms/login`; em produção é `https://bythiagofigueiredo.com/cms/login`. ✔

## Decisões do dono (2026-10-07) — implementadas

1. **Existe o degrau "administrar o site"**, acima de editar: `can_admin_site_users`, sem papel novo.
2. **Só quem administra** dispara, agenda ou cancela envio real de newsletter e exporta/anonimiza
   assinantes, contatos e inscritos de waitlist. Editora redige, edita e manda teste.
3. **Só quem administra** aplica/força/reverte vencedor de A/B, remove canal próprio, muda
   identidade/credencial do canal, remove concorrente e conecta/desconecta/remove integrações.
   Editora cria, pausa e retoma teste, adiciona concorrente, fixa/desafixa vídeo.
4. **Editora publica no YouTube** (`publishVideo`, upload) — não mudou.
5. **Sync normal: editora.** Histórico completo e os syncs marcados como caros em cota: só quem administra.
6. **`reporter` saiu do formulário de convite** (`/admin/users`); o banco, a action e os convites
   antigos continuam aceitando o valor. A tela de editar usuário ainda oferece `reporter`.
