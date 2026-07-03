# Runbook — Submissão das reviews externas do Social Hub

**Google OAuth verification (YouTube) + Meta App Review (Facebook + Instagram)**
Preparado em 2026-07-03 · Repo: `bythiagofigueiredo` · **NADA foi submetido — este documento é o roteiro que VOCÊ executa.**

---

## 0. Fatos extraídos do código (base de tudo que segue)

### 0.1 Fluxo OAuth (rotas reais)

| Etapa | Rota | Arquivo |
|---|---|---|
| Início (redirect ao provider) | `GET /api/social/oauth/google` e `GET /api/social/oauth/meta` | `apps/web/src/app/api/social/oauth/[provider]/route.ts` |
| Callback (troca de code + persist) | `GET /api/social/oauth/{google,meta}/callback` | `apps/web/src/app/api/social/oauth/[provider]/callback/route.ts` |
| UI de conexão | `/cms/social/accounts` (tab "Connections", botão em `_components/oauth-button.tsx`) | `apps/web/src/app/cms/(authed)/social/accounts/page.tsx` |

- State assinado com HMAC-SHA256 (chave derivada de `SOCIAL_MASTER_KEY`), tokens criptografados at-rest (`@tn-figueiredo/social/vault`), consent LGPD gravado em `consents` (categoria `social_integration`) no callback. **Mencione isso nas justificativas — reviewers gostam de "encrypted at rest, never shared".**
- Redirect URIs de produção (derivadas de `NEXT_PUBLIC_APP_URL=https://bythiagofigueiredo.com`):
  - Google: `https://bythiagofigueiredo.com/api/social/oauth/google/callback`
  - Meta: `https://bythiagofigueiredo.com/api/social/oauth/meta/callback`
- Env vars: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `META_APP_ID`/`META_APP_SECRET`.

### 0.2 Scopes Google solicitados no código (route.ts linhas 9-13)

| Scope | Classificação | Onde é usado (endpoints reais) |
|---|---|---|
| `https://www.googleapis.com/auth/youtube.upload` | Sensitive | Upload resumable: `POST upload/youtube/v3/videos?uploadType=resumable` (`packages/social/src/providers/youtube/client.ts` → `createUploadSession`) + rotas `/api/social/youtube/upload-session` e `/api/social/youtube/complete` |
| `https://www.googleapis.com/auth/youtube` | Sensitive | `videos.update` (metadata + privacyStatus), `videos.delete`, `videos.list`, `search.list`, `thumbnails/set`, `channels?mine=true` (callback lê canal do usuário) — tudo em `client.ts` + callback |
| `https://www.googleapis.com/auth/yt-analytics.readonly` | Sensitive | `youtubeanalytics.googleapis.com/v2/reports` — crons `sync-analytics-metrics` (views, watch time, likes, comments, shares, subs) e `lib/youtube/analytics-client.ts` (dimensões `ageGroup,gender`, `country`, `deviceType`, `insightTrafficSourceDetail`) e A/B de thumbnails (`ab-youtube.ts`) |

Leitura vs escrita: **escreve** vídeos/thumbnails/privacidade (upload, update, delete); **lê** canal, lista de vídeos, estatísticas e analytics agregado (sem PII individual de viewers).

### 0.3 Scopes Meta solicitados no código (route.ts linhas 16-23)

| Permission | Uso real no código | Veredito |
|---|---|---|
| `pages_show_list` | `GET /me/accounts` (listar Pages no callback e `getUserPages`) | **Manter** |
| `pages_manage_posts` | `POST /{page_id}/feed`, `POST /{page_id}/photos`, `DELETE /{post_id}` (`providers/meta/facebook.ts`) | **Manter** |
| `pages_read_engagement` | Campos `fan_count`, `followers_count`, `comments.summary(true)`, `shares` do post | **Manter** |
| `instagram_basic` | `instagram_business_account{id,username}`, perfil IG (`profile_picture_url`, `followers_count`, `media_count`), `like_count/comments_count` de mídia | **Manter** |
| `instagram_content_publish` | `POST /{ig_user_id}/media` + `/media_publish` (feed, REELS, STORIES — `providers/meta/instagram.ts`) | **Manter** |
| `business_management` | **NENHUM endpoint chamado exige** (`/me/accounts` só precisa de `pages_show_list`). | **REMOVER do código antes da review** — é permission pesada, atrai escrutínio e atrasa aprovação |

### 0.4 ⚠️ Gap encontrado no código — decidir ANTES de submeter

`apps/web/src/lib/social/metrics-poller.ts` chama:
- `GET /{post_id}/insights?metric=post_reactions_by_type_total,post_media_views,post_clicks` → **exige `read_insights`** (não solicitado)
- `GET /{ig_media_id}/insights?metric=views,reach` → **exige `instagram_manage_insights`** (não solicitado)

**Opção A (recomendada):** adicionar `read_insights` + `instagram_manage_insights` a `META_SCOPES` no route.ts e ao array `scopes` do callback, e incluí-las na review (justificativas prontas na seção 2). **Opção B:** adiar métricas FB/IG (o poller falhará silenciosamente nesses providers) e fazer segunda review depois — mesma regra do messaging. Não submeta permissions que o screencast não demonstra.

### 0.5 URLs públicas (pré-requisitos das duas reviews) — status verificado

| Requisito | URL | Status no repo |
|---|---|---|
| Homepage pública | `https://bythiagofigueiredo.com` | OK — `app/(public)/page.tsx` |
| Privacy policy | `https://bythiagofigueiredo.com/privacy` | OK — `content/legal/privacy.{en,pt-BR}.mdx`. **Já cobre os processadores**: Google LLC (YouTube/OAuth + Analytics) e Meta Platforms (Facebook/Instagram) com SCCs+DPA, tokens OAuth, YouTube channel intelligence (demographics agregado), retenção ("deleted upon disconnecting"), base legal consent (v1.1/v1.2 do changelog) |
| Terms | `https://bythiagofigueiredo.com/terms` | OK — `content/legal/terms.*.mdx` |
| Data deletion (Meta exige) | `https://bythiagofigueiredo.com/account/delete` (fluxo LGPD 3 fases, documentado na privacy §7) | OK — usar como "Data Deletion Instructions URL" |

⚠️ **Deploy freeze (2026-06-18) ainda vigente:** as duas reviews exigem o app EM PRODUÇÃO funcionando (reviewers acessam as URLs e testam de verdade). Libere o deploy antes de submeter qualquer coisa.

---

## 1. Google OAuth Verification (YouTube)

### 1.1 Por que verificar (e a alternativa)

- App "External" em **Testing**: refresh tokens **expiram em 7 dias** → quebra `refreshToken()` do provider e todos os crons. Inviável.
- App em **Production sem verificação** com scopes sensitive: tela "Google hasn't verified this app" + cap de 100 usuários. Funciona para uso próprio (clicando em "Advanced → continue"), mas a tela assusta e o cap existe.
- **Verificação** remove a tela e o cap. Os 3 scopes usados são **sensitive** (não restricted) → **não há CASA/security assessment**, só brand verification + justificativas + vídeo demo.

### 1.2 Console exato — passo a passo

1. `https://console.cloud.google.com` → projeto que contém o `GOOGLE_CLIENT_ID` usado em prod (confira em `apps/web/.env.local` / Vercel env).
2. Menu **APIs & Services → OAuth consent screen** (hoje rebatizado **Google Auth Platform**): confira **Branding**:
   - App name: `ByThiagoFigueiredo CMS` (deve bater com o que aparece no consent screen do screencast)
   - User support email + Developer contact: e-mail que você lê (Google manda TUDO por lá)
   - App logo (120x120) — subir logo dispara brand verification; ok, faz parte
   - Homepage: `https://bythiagofigueiredo.com` · Privacy: `https://bythiagofigueiredo.com/privacy` · Terms: `https://bythiagofigueiredo.com/terms`
   - Authorized domain: `bythiagofigueiredo.com`
3. **Domain verification:** `https://search.google.com/search-console` → verificar propriedade de `bythiagofigueiredo.com` (DNS TXT) com a MESMA conta Google owner/editor do projeto GCP. Depois em **APIs & Services → Domain verification** adicionar o domínio.
4. **Data Access / Scopes:** declarar EXATAMENTE os 3 scopes da seção 0.2 (nem mais nem menos — scope declarado ≠ scope pedido no código é motivo clássico de reprovação).
5. Habilitar as APIs no projeto (se ainda não): **YouTube Data API v3** e **YouTube Analytics API**.
6. Publishing status → **In production** → botão **Prepare for verification / Submit for verification** (Verification Center). Preencher justificativas (1.3) + link do vídeo (1.4).

### 1.3 Justificativas por scope — copy-paste (inglês)

> Formato que o reviewer espera: "My app will use [scope] to [função]. This lets users [benefício]." Sempre explique por que um scope mais estreito não basta.

**`https://www.googleapis.com/auth/youtube.upload`**
```
ByThiagoFigueiredo CMS is a content-management system used by the site owner and
editorial staff to plan, produce and publish content. The app will use the
youtube.upload scope to upload video files to the user's own YouTube channel
directly from the CMS publishing pipeline (resumable uploads via
POST /upload/youtube/v3/videos). This lets users schedule and publish videos
they authored without leaving their editorial workflow. Upload is a write-only
operation that this scope is specifically designed for; no narrower scope
provides video upload capability.
```

**`https://www.googleapis.com/auth/youtube`**
```
The app will use the youtube scope to manage the videos it publishes on the
user's own channel: update video title, description, tags and privacy status
(videos.update) — including scheduled publishing by flipping privacyStatus from
private to public at the scheduled time — set custom thumbnails
(thumbnails.set), list the channel's videos (search.list, videos.list) to show
publishing status inside the CMS, read the connected channel identity
(channels.list mine=true), and delete a video when the user deletes the
corresponding post in the CMS (videos.delete). The narrower youtube.upload
scope only allows uploading and cannot update metadata, thumbnails, privacy
status or delete videos, so full channel management access is required.
```

**`https://www.googleapis.com/auth/yt-analytics.readonly`**
```
The app will use the yt-analytics.readonly scope to retrieve aggregate,
channel-owner analytics for the user's own connected channel via the YouTube
Analytics API (v2 reports): views, watch time, likes, comments, shares,
subscriber changes, traffic sources, and aggregate audience demographics
(age group / gender / country percentages). This data is displayed only to the
channel owner inside the CMS analytics dashboard to support editorial decisions
(e.g. thumbnail A/B evaluation, content strategy). It is read-only, contains no
personally identifiable viewer data, is never shared with third parties, and is
deleted when the user disconnects the channel, as described in our privacy
policy (https://bythiagofigueiredo.com/privacy).
```

**Campo "How will the data be used" (resumo geral):**
```
The app is a self-hosted publishing CMS (https://bythiagofigueiredo.com). Users
explicitly connect their own YouTube channel via OAuth from the CMS accounts
page. Google user data (OAuth tokens, channel metadata, video metadata,
aggregate analytics) is used solely to publish and manage the user's own videos
and to display channel performance to that same user. Tokens are encrypted at
rest (AES, application-managed key); data is never sold, never used for
advertising, never shared with third parties, and is deleted on disconnect.
Data handling is disclosed in our privacy policy at
https://bythiagofigueiredo.com/privacy.
```

### 1.4 Roteiro do screencast (YouTube, "Unlisted", narração ou legendas em inglês)

Duração-alvo: 3-5 min. Gravar em prod (`bythiagofigueiredo.com`), UI em inglês.

| Cena | O que mostrar | Por quê |
|---|---|---|
| 1. Consent flow | Login no CMS → `/cms/social/accounts` → clicar "Connect YouTube". Na tela de consent do Google: **mostrar a barra de endereço** com `accounts.google.com` e o `client_id` visível na URL, o **nome do app** correto, e a **lista dos 3 scopes**. Aceitar. | Requisito literal do Google: grant process + client ID na address bar + app name |
| 2. Conta conectada | De volta a `/cms/social/accounts`: card do canal com nome/avatar/inscritos (prova o uso de `channels.list mine=true` do scope `youtube`) | Demonstra leitura de canal |
| 3. `youtube.upload` | Criar post de vídeo no CMS → upload de um vídeo de teste → mostrar o vídeo aparecendo no YouTube Studio como private/unlisted | Demonstra o scope de upload |
| 4. `youtube` (write) | Editar título/descrição/thumbnail do vídeo no CMS → mostrar a mudança refletida no YouTube. Se possível, mostrar o publish agendado mudando privacy private→public. Narrar: "this uses the youtube scope: videos.update and thumbnails.set" | Cada scope precisa de funcionalidade demonstrada |
| 5. `yt-analytics.readonly` | Abrir o dashboard de analytics do CMS (`/cms/social/insights` ou dashboard YouTube) mostrando views/watch-time/demographics agregados | Demonstra o scope de analytics |
| 6. Disconnect | Voltar a accounts → Disconnect, narrar que tokens/dados são apagados conforme a privacy policy | Reforça data handling |

### 1.5 Prazos e armadilhas clássicas

- **Prazo oficial:** brand verification 2-3 dias úteis; sensitive scopes "até 10 dias" — na prática **2-6 semanas** com idas e vindas por e-mail. Responda cada e-mail do reviewer em <24h; silêncio > alguns dias = pedido abandonado.
- Reprovações mais comuns:
  1. **Vídeo sem o client ID visível na barra de endereço** ou sem demonstrar TODOS os scopes → pedem novo vídeo (loop de semanas).
  2. **Homepage/privacy inconsistentes:** privacy fora do domínio do app, consent screen com nome diferente do site, domínio não verificado no Search Console.
  3. **Scope mismatch:** código pede scope que não foi declarado (ou vice-versa). Confira `route.ts` ↔ console antes de submeter.
  4. Privacy policy sem descrever acesso/uso/armazenamento/compartilhamento de "Google user data" — a sua já cobre (§ sub-processadores + YouTube channel intelligence), mas se o reviewer pedir menção literal a "Google user data", adicione uma frase.
  5. **YouTube API compliance:** o app usa YouTube API Services → mantenha link para a privacy e, se solicitado, para os YouTube ToS (`https://www.youtube.com/t/terms`) na página de conexão. Auditoria de compliance do YouTube só entra se pedir aumento de quota (>10k units/dia) — não faz parte desta verificação.
- Enquanto a verificação corre, o app já pode ficar "In production" — você continua usando normalmente (com a tela de warning).

---

## 2. Meta App Review (Facebook + Instagram)

### 2.0 DECISÃO PRÉVIA — você talvez nem precise de App Review agora

Regra 2026 da Meta: **Advanced Access (App Review) só é necessário se o app atende contas de terceiros** (Tech Provider). Para publicar **nas suas próprias** Page/IG (usuários com role no app — admin/developer/tester — ou assets do mesmo Business Portfolio que reivindicou o app), **Standard Access basta e é self-service, sem review**.

- **Cenário atual (Social Hub v1, só suas contas):** app tipo Business + você como admin + Page/IG no seu portfólio → funciona em produção com Standard Access. Submeta a review mesmo assim se quiser: (a) preparar o multi-ring/multi-cliente do ecossistema `@tnf/*`, (b) eliminar dependência de roles no app.
- Este runbook prepara a **review completa (Advanced Access)** — é o caminho para o cenário multi-tenant.

### 2.1 App Dashboard — passo a passo

1. `https://developers.facebook.com/apps` → app do `META_APP_ID` (confira env). Tipo deve ser **Business**. Use case: "Manage everything on your Page" / Instagram Graph API com **Facebook Login for Business**.
2. **Settings → Basic** — tudo obrigatório para submeter:
   - App icon 1024x1024
   - Privacy Policy URL: `https://bythiagofigueiredo.com/privacy`
   - Terms of Service URL: `https://bythiagofigueiredo.com/terms`
   - **User data deletion:** escolher "Data deletion instructions URL" → `https://bythiagofigueiredo.com/account/delete` (fluxo LGPD de 3 fases já existente)
   - Category: Business and pages / Content management
   - App domains: `bythiagofigueiredo.com`
   - Business verification: vincular Business Portfolio (2.4)
3. **Facebook Login for Business → Settings:** Valid OAuth Redirect URIs = `https://bythiagofigueiredo.com/api/social/oauth/meta/callback`. Client OAuth login ON, Web OAuth login ON, Enforce HTTPS ON.
4. **Antes de submeter — ajustar o código** (seção 0.3/0.4): remover `business_management` de `META_SCOPES` e do array `scopes` do callback; decidir Opção A/B para insights. Deploy em prod. **O screencast tem que bater com o consent dialog real.**
5. **App Review → Permissions and Features:** pedir **Advanced Access** para cada permission da tabela 2.2. Para cada uma: descrição de uso (colar 2.3) + screencast (2.5).
6. **App Review → Requests:** preencher "Verification details" com instruções de teste para o reviewer:
```
Test steps:
1. Go to https://bythiagofigueiredo.com/cms (credentials below).
2. Log in with the provided test editor account.
3. Navigate to CMS → Social → Accounts (https://bythiagofigueiredo.com/cms/social/accounts).
4. Click "Connect" on the Facebook/Instagram card and complete the Facebook
   Login for Business dialog with the provided test Facebook account
   (it manages a test Page linked to a test Instagram professional account).
5. Create a social post: CMS → Social → New, select the Facebook Page and
   Instagram destinations, attach an image, click Publish.
6. Verify the post appears on the test Page and Instagram account.
7. Open the post detail to see engagement metrics (likes, comments, shares).
```
   Crie uma conta de teste do CMS (role editor) e uma conta FB de teste com Page + IG professional de teste; inclua as credenciais nos campos apropriados (nunca no vídeo).
7. Submit. Acompanhe em App Review → Requests (notificações também por e-mail).

### 2.2 Permissions a pedir (mínimo derivado do código)

| Permission | Pedir? |
|---|---|
| `pages_show_list` | Sim |
| `pages_read_engagement` | Sim |
| `pages_manage_posts` | Sim |
| `instagram_basic` | Sim |
| `instagram_content_publish` | Sim |
| `read_insights` | Só se Opção A (métricas FB) |
| `instagram_manage_insights` | Só se Opção A (métricas IG) |
| `business_management` | **NÃO** — remover do código |
| `pages_manage_metadata`, `pages_messaging`, `instagram_manage_messages`, `instagram_manage_comments` | **NÃO** |

> **⚠️ NÃO incluir permissões de messaging nesta review** (`instagram_manage_messages`, `pages_messaging`, `instagram_manage_comments` do design de inbound messaging). Messaging tem escrutínio muito maior (janela de 24h, políticas próprias) e **misturar atrasa/derruba a review inteira**. O inbound messaging vai numa **segunda review** depois desta aprovada.

### 2.3 Justificativas — copy-paste (inglês)

**`pages_show_list`**
```
Our CMS (https://bythiagofigueiredo.com) lets a Page admin connect their own
Facebook Page for content publishing. We use pages_show_list solely to call
GET /me/accounts after Facebook Login, so the user can see and select which of
their Pages to connect to the CMS. Without it we cannot enumerate the user's
Pages to complete the connection flow.
```

**`pages_manage_posts`**
```
The core feature of our Social Hub module is publishing content the user
authored in the CMS to their own Facebook Page. We use pages_manage_posts to
create text/link posts (POST /{page-id}/feed), photo posts
(POST /{page-id}/photos), and to delete a Page post when the user deletes the
corresponding CMS post (DELETE /{post-id}). All publishing is explicitly
initiated or scheduled by the Page admin in the CMS editor.
```

**`pages_read_engagement`**
```
After publishing, the CMS shows the Page admin how their own posts performed.
We use pages_read_engagement to read the connected Page's profile fields
(name, picture, fan_count, followers_count) shown on the account card, and the
comment count and share count of posts published through the app
(GET /{post-id}?fields=comments.summary(true),shares). Read-only, displayed
only to the Page admin, never shared.
```

**`instagram_basic`**
```
We use instagram_basic to discover the Instagram professional account linked to
the user's Facebook Page (GET /{page-id}?fields=instagram_business_account),
display its username, profile picture, follower and media counts on the CMS
accounts page, and read like/comment counts of media published through the app.
This is required to identify the target account for content publishing and to
render the connection UI.
```

**`instagram_content_publish`**
```
The CMS publishes content the user created to their own Instagram professional
account: single images, Reels and Stories, via the Content Publishing API
(POST /{ig-user-id}/media to create the container, polling status_code, then
POST /{ig-user-id}/media_publish). Publishing is always explicitly initiated or
scheduled by the account owner in the CMS editor. We respect the publishing
rate limit by checking the account's remaining budget before multi-slide
Story publishing.
```

**`read_insights`** (se Opção A)
```
We use read_insights to poll performance metrics of Page posts published
through the app (GET /{post-id}/insights: post_reactions_by_type_total,
post_media_views, post_clicks) for up to 7 days after publishing. Metrics are
shown only to the Page admin inside the CMS analytics view to evaluate their
own content. Read-only, aggregate, never shared with third parties.
```

**`instagram_manage_insights`** (se Opção A)
```
We use instagram_manage_insights to poll performance metrics of Instagram media
published through the app (GET /{ig-media-id}/insights: views, reach) — for
Stories within their 24-48h lifetime and posts for up to 7 days. Metrics are
displayed only to the connected account owner inside the CMS analytics view.
Read-only, aggregate, never shared with third parties.
```

### 2.4 Business verification

Obrigatória para Advanced Access (e recomendada mesmo no Standard).

1. `https://business.facebook.com` → Business Portfolio (criar se não houver) → **Settings → Security Center → Start verification**.
2. Documentos Brasil: **CNPJ** (cartão CNPJ / comprovante de inscrição), razão social e endereço batendo com o cadastro, site `https://bythiagofigueiredo.com` exibindo o nome do negócio, telefone/e-mail verificável no domínio (`@bythiagofigueiredo.com` ajuda muito).
3. Vincular o app ao portfólio: App Dashboard → Settings → Basic → Business verification → conectar.
4. Prazo: dias até ~2 semanas. **Pode (e deve) rodar em paralelo** com a preparação do resto — é pré-requisito para a aprovação final.

### 2.5 Roteiro do screencast (um vídeo pode cobrir várias permissions; UI em inglês ou com legendas)

| Cena | O que mostrar | Permission demonstrada |
|---|---|---|
| 1 | Login no CMS → `/cms/social/accounts` → "Connect" no card Meta → dialog do Facebook Login for Business: mostrar a lista de permissões pedidas e a seleção da Page + IG | consent flow (obrigatório) |
| 2 | Voltar a accounts: cards Facebook (nome, foto, followers) e Instagram (username, foto, followers) criados | `pages_show_list`, `instagram_basic`, `pages_read_engagement` |
| 3 | CMS → Social → New: compor post com imagem, selecionar destinos Facebook + Instagram, Publish. Mostrar o post publicado na Page (abrir facebook.com) | `pages_manage_posts` |
| 4 | Mostrar a mesma mídia publicada no perfil IG (abrir instagram.com). Se der, publicar também uma Story/Reel pelo CMS | `instagram_content_publish` |
| 5 | Abrir o detalhe do post no CMS mostrando likes/comments/shares/impressions | `pages_read_engagement` (+ `read_insights`/`instagram_manage_insights` se Opção A) |
| 6 | Deletar o post no CMS e mostrar que sumiu da Page | `pages_manage_posts` (delete) |
| 7 | Disconnect na página de accounts | encerramento |

Dicas: narre ou legende **cada botão não-óbvio** ("this button publishes the post to the selected destinations"); nada de credenciais visíveis; cada permission pedida PRECISA aparecer em uso — permission sem cena = rejeição daquela permission.

### 2.6 Prazos e armadilhas

- Review: oficialmente ~5 dias úteis; na prática **2-6 semanas** contando resubmissões. Rejeição vem com feedback por permission — corrija só o apontado e resubmeta.
- Armadilhas: (1) reviewer não consegue reproduzir → capriche nas instruções de teste + conta de teste funcionando em PROD; (2) pedir permission não demonstrada (ex.: `business_management`) → rejeição; (3) app em Development mode sem as URLs de privacy/deletion → bloqueia submissão; (4) IG de teste precisa ser **professional (Business/Creator) vinculado a uma Page** — conta pessoal não funciona com essa API; (5) misturar messaging — ver box da 2.2.

---

## 3. Checklist final pré-submissão

### Comum
- [ ] Deploy freeze liberado; prod (`bythiagofigueiredo.com`) atualizado e funcional
- [ ] `/privacy`, `/terms`, `/account/delete` acessíveis publicamente (sem login) em prod
- [ ] Código ajustado: `business_management` removido; decisão Opção A/B sobre `read_insights`/`instagram_manage_insights` aplicada em `route.ts` **e** no array `scopes` do callback; `build:packages` + commit + deploy
- [ ] Fluxo OAuth completo testado em prod para os dois providers (conectar, publicar, desconectar)

### Google
- [ ] Projeto GCP correto identificado (`GOOGLE_CLIENT_ID` de prod)
- [ ] YouTube Data API v3 + YouTube Analytics API habilitadas
- [ ] Domínio verificado no Search Console (mesma conta owner do projeto)
- [ ] Consent screen: nome, logo, support email, homepage, privacy, terms, authorized domain
- [ ] Exatamente os 3 scopes declarados no console = scopes do `route.ts`
- [ ] Redirect URI `https://bythiagofigueiredo.com/api/social/oauth/google/callback` no OAuth client
- [ ] Screencast gravado (client ID na barra de endereço! todos os 3 scopes demonstrados), no YouTube como Unlisted
- [ ] Justificativas da seção 1.3 coladas
- [ ] Status "In production" → Submit for verification

### Meta
- [ ] App tipo Business; Facebook Login for Business configurado
- [ ] Settings → Basic completo: icon 1024², privacy URL, terms URL, **data deletion instructions URL**, category, app domain
- [ ] Redirect URI `https://bythiagofigueiredo.com/api/social/oauth/meta/callback` em Valid OAuth Redirect URIs
- [ ] Business verification iniciada/concluída (CNPJ + site + e-mail do domínio)
- [ ] Contas de teste: CMS editor + FB test user com Page de teste + IG professional vinculado
- [ ] Screencast cobrindo TODAS as permissions pedidas (e só elas)
- [ ] Justificativas da seção 2.3 coladas permission a permission
- [ ] **Zero permissions de messaging no pedido**
- [ ] Verification details (passo a passo do reviewer) preenchido com credenciais
- [ ] Submit; monitorar e-mail + App Review → Requests diariamente

---

## 4. Fontes (requisitos vigentes verificados em 2026-07-03)

- Google sensitive scope verification: https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- Google OAuth App Verification Help Center: https://support.google.com/cloud/answer/13463073 · Verification requirements: https://support.google.com/cloud/answer/13464321
- Meta App Review (Instagram Platform): https://developers.facebook.com/docs/instagram-platform/app-review/
- Meta Permissions Reference: https://developers.facebook.com/docs/permissions/
- Instagram Insights (permissions exigidas): https://developers.facebook.com/docs/instagram-platform/insights/
- Instagram Platform overview (Standard vs Advanced Access): https://developers.facebook.com/docs/instagram-platform/overview/
