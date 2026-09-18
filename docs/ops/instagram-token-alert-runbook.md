# Runbook — alerta de token do Instagram e superfície de OAuth

> Corrente completa: cron de renovação (`"0 11 * * *"`) → episódio (`CAMPOS_DE_EPISÓDIO`) → alerta
> (ntfy + CMS + e-mail) → **Reconnect em um clique** em `/cms/settings/instagram`.
> Spec: `docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md`.
> Planos: `docs/superpowers/plans/2026-09-06-instagram-oauth-*.md`.

## Gates de C3 (2026-09-06)

> **PENDENTE — executado pelo dono** (exigem token/dashboard/produção; ver Task 1 do plano C3).
> Colar as saídas verbatim nos blocos abaixo. Enquanto não forem preenchidos, C3 **não promove**.

### Identidade (bloqueante) — **APROVADO em 2026-09-18**

Executado pela conexão real, não por curl: o OAuth completou e gravou a linha. Evidência no banco,
logo após o `Connected!`:

| Campo | Valor |
|---|---|
| `ig_user_id` | `36220564007528767` (app-scoped, veio de `me.id`) |
| `ig_professional_id` | `17841401313574613` (veio de `me.user_id`) |
| `ig_user_id_source` | `oauth` (era `legacy`) |
| `access_token` | prefixo `v1:` — cifrado em repouso |
| `token_expires_at` | 2026-11-17 (60 dias) |
| `token_error` | nulo — episódio fechado |

`/me?fields=id,user_id,username` devolveu **os três** campos (se faltasse `user_id`, o
`ig_professional_id` teria ficado nulo). E a aresta de mídia **aceita o id app-scoped**: o sync
manual imediato achou 31 posts, inseriu 1, atualizou 30 e cacheou 1 mídia, em 2 s.

O `ig_professional_id` gravado é exatamente o `account_id` da conexão de PUBLICAÇÃO em
`social_connections` — os dois espaços de id ficaram ligados como o §3.1 desenhou.

Permissões concedidas (verbatim do `instagram_sync_log`): `instagram_business_basic`,
`instagram_business_manage_messages`, `instagram_business_content_publish`,
`instagram_business_manage_comments`.

**Ramo de falha (não ocorreu):** `/media` recusando o `me.id` ⇒ C3 não promove.

### Redirect URIs registradas no App Dashboard (verbatim)

**Host verificado 2026-09-18:** o apex serve direto (sem 308); `www.bythiagofigueiredo.com` **não
resolve em DNS**. Use o apex, sem barra final. Os três valores saem do código, não de memória
(`src/app/api/instagram/oauth/route.ts:98` monta o `redirect_uri` como `${origin}/api/instagram/oauth/callback`):

```
https://bythiagofigueiredo.com/api/instagram/oauth/callback     <- OAuth Redirect URI
https://bythiagofigueiredo.com/api/instagram/deauthorize        <- Deauthorize callback URL
https://bythiagofigueiredo.com/api/instagram/data-deletion      <- Data Deletion Request URL
```

### O app da Meta que já existe NÃO serve (diagnóstico de 2026-09-18)

`META_APP_ID` / `META_APP_SECRET` estão em produção e são válidos — o app é **"bythiagofigueiredo"**,
id `1296945938484937`, categoria Business, e o par obtém um app token no `graph.facebook.com` sem
erro. Ele atende o fluxo antigo (`/api/social/oauth/[provider]`, via Facebook Login).

Mas ele **não serve** para o Instagram Login. Prova, pelo endpoint que a aplicação usa em produção:

| Requisição a `api.instagram.com/oauth/access_token` | Resposta |
|---|---|
| `client_id` = META_APP_ID, `client_secret` = META_APP_SECRET | `"Invalid platform app"` |
| controle: id inexistente | `"Missing required field client_id"` |

O id real passou da validação de formato e foi recusado por **tipo de plataforma**: o produto
"Instagram API with Instagram login" não está configurado nesse app. Ou seja, `INSTAGRAM_APP_ID` e
`INSTAGRAM_APP_SECRET` **ainda não existem** — eles são criados quando o produto Instagram é
adicionado ao app no App Dashboard, e são números diferentes dos do Facebook.

**Não há API pública da Meta para adicionar um produto a um app.** Este passo é App Dashboard, com
sessão do dono — é o único bloqueio que não pode ser automatizado a partir daqui.

### Envs de produção
`INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `SOCIAL_MASTER_KEY` presentes em `production`
(`vercel env ls production | grep -E 'INSTAGRAM_APP_ID|INSTAGRAM_APP_SECRET|SOCIAL_MASTER_KEY'`).

**RESOLVIDO em 2026-09-18.** `INSTAGRAM_APP_ID = 961792393320874` (não é segredo — vai na URL do
OAuth por desenho) e `INSTAGRAM_APP_SECRET` gravados em Production, e a produção redeployada para
que passassem a valer. Confirmado no ar pela mudança de resposta do callback: era `503`
`not_configured`, virou `400` por `state` ausente — ou seja, passou do app id/secret e do cofre.

O app do Instagram **não era** o do Facebook. Provado com o MESMO segredo falso nos dois ids, de
modo que a única variável foi o id:

| `client_id` em `api.instagram.com/oauth/access_token` | Resposta |
|---|---|
| `961792393320874` (Instagram) | `"Invalid authorization code"` — app aceito |
| `1296945938484937` (Facebook) | `"Invalid platform app"` — app recusado |

Caminho no painel (labels de 2026-09, em PT-BR): *Casos de uso → API do Instagram → Configuração da
API com login do Instagram*. As três URLs ficam no diálogo **Configurações do login da empresa**,
alcançável pelo bloco 4 ("Configurar o login da empresa no Instagram"), e **não** no bloco 3, que é
de webhooks e não é usado por este fluxo.

---

**Histórico — verificado 2026-09-07 (controlador), REPROVADO à época:**
```
SOCIAL_MASTER_KEY   Config   Production   (presente)
NTFY_URL            Secret   Production   (presente)
INSTAGRAM_APP_ID                          AUSENTE
INSTAGRAM_APP_SECRET                      AUSENTE
```
Degradação confirmada no ar e correta: `GET /api/instagram/oauth/callback` responde **503** com
`code: "not_configured"`, mensagem legível ("Instagram OAuth isn't configured yet — see the setup
runbook") e link de volta para `/cms/settings/instagram`. Nenhum vazamento. A cola manual segue
funcionando. Basta definir as duas envs em `production` (+ redeploy) para o botão passar a existir.

### Consentimento
`select count(*) from consent_texts where category='social_feed_read'` = `<esperado: 2>`.
**Verificado em produção 2026-09-07 (controlador): `2`** (duas linhas, ambas `version = 1.0`). APROVADO.

### Conta no app — **APROVADO em 2026-09-18**
`thiagonfigueiredo` consta como **Testador do Instagram**, e o Instagram confirma a autorização em
*Configurações → Apps e sites → Ativos*: `bythiagofigueiredo-IG`, "Authorized by you 18/09/26",
User ID `36220564007528767`.

### Renovação automática — armada, primeira execução real em 2026-09-25
A política está em `api/cron/instagram-token-refresh`: uma conta entra na fila quando o token
vence em menos de **15 dias** (`SELECT_EXPIRY_MS`) **ou** quando não é renovado há ~**7 dias**
(`SELECT_STALE_MS = 167 h`), com piso de 25 h entre renovações. Cada renovação empurra o
vencimento para +60 dias, então o token nunca se aproxima do prazo enquanto o cron rodar.

`token_refreshed_at = 2026-09-18 18:18:33` ⇒ a primeira renovação automática cai em **2026-09-25,
11:00 UTC**. O run de 2026-09-18 logo após a conexão devolveu tudo zerado
(`refreshed:0, failed_permanent:0, step_errors:0`), que é o correto: nada estava vencido.

### Gate móvel de ponta a ponta
Executado depois da promoção (exige o código em produção): é **bloqueante para manter C3 em
produção** — se falhar, rollback pelo §7. Procedimento e resultado ficam registrados abaixo, na
seção "Pós-deploy C3".

## Incidente: o vigia externo ficou cego 11 dias (2026-09-07 → 2026-09-18)

**Sintoma:** as 74 execuções do workflow `Health Watch` entre 2026-09-07 e 2026-09-18 falharam —
100%. `/api/health` respondia `ok` o tempo todo.

**Causa:** o secret `CRON_SECRET` nunca foi criado no repositório. O workflow manda
`Authorization: Bearer ${{ secrets.CRON_SECRET }}`, o header ia vazio, `/api/health` recusava com
401 e o probe classificava 401 como `not-ok` — indistinguível do site fora do ar.

**Por que era grave, e não só barulhento:**
1. `STATE` e `PREV_STATE` travaram os dois em `not-ok`, então **nenhuma transição voltava a ser
   detectável**. Uma queda real do site não geraria alerta nenhum: o vigia já estava gritando.
2. O ramo `re-alert` disparava push **urgente falso** a cada 6 h, gastando o mesmo canal que carrega
   o alerta verdadeiro. O último foi 2026-09-18 04:59 UTC.
3. O GitHub só manda e-mail na **primeira** falha de um workflow agendado e na recuperação — por
   isso 11 dias passaram sem ninguém notar.

**Conserto (2026-09-18):** `printf '%s' "$CRON_SECRET" | gh secret set CRON_SECRET` (o valor de
`apps/web/.env.local`). Atenção: `gh secret set NOME --body -` grava a string literal `-` — o `gh`
lê da entrada padrão **sem** `--body`. Foi assim que a primeira tentativa gravou lixo e o run
seguinte continuou em 401. Confirmado depois: `http_code=200`, `state=ok`, transição
`not-ok → ok`, push `health-watch: recuperado` entregue.

**Endurecimento no mesmo commit** (`.github/workflows/health-watch.yml`):
- **Três estados, não dois.** `blind` (401/403) é "a sonda não consegue autenticar", separado de
  `not-ok` ("o site não respondeu"). `000` de timeout/DNS/TLS continua `not-ok`.
- **Transição = qualquer mudança de estado**, em vez da lista de pares `ok`↔`not-ok`, que não tinha
  saída para um terceiro estado.
- **Cláusula `never-alerted`:** estar num estado ruim sem nunca ter alertado passa a alertar. É o que
  teria quebrado o silêncio deste incidente já no primeiro ciclo.
- Secret vazio emite `::error::` nomeando a causa, mas **não** aborta: abortar recriaria o silêncio.
- `Save state` só roda se o arquivo existir, para não trocar o erro real por um erro de cache.

Verificado por matriz de 11 casos + 5 mutações (todas pegas) antes do push — harness em
`.superpowers/` do dia.

### A cadência do GitHub — medida, e resolvida movendo a classe de falha (2026-09-18)

**Medição:** 40 execuções agendadas dão intervalo **mediano de 204 min** (mínimo 111, máximo 352).
Nunca perto dos 15 min do `cron:`. O repositório é público, então não é cota de minutos; os dois
workflows disparam no mesmo instante (09:35:37 e 09:35:55), ou seja, o GitHub agrupa os
agendamentos vencidos numa janela que abre a cada 2–6 h. **Mexer na expressão não adianta:** o
`uptime.yml` pede `*/5` e recebe a mesma janela. O `uptime-probe` de dentro da Vercel já registrava
isto ("GitHub's scheduler ran that once in 68 minutes during the 2026-09-05 incident window").

**Quem cobria o quê, antes:**

| Classe de falha | Detector | Latência |
|---|---|---|
| Site fora do ar ou lento | `uptime-probe` (Vercel, `*/5`) | ~5 min |
| Vercel inteira morta | `uptime.yml` + `health-watch.yml` | 2–6 h |
| **Um cron parou de rodar** | **só `health-watch.yml`** | **2–6 h** |

`health-watch.yml` era o **único** consumidor de `/api/health` no repositório, e nada dentro da
Vercel lia atraso de cron.

**Resolução:** a avaliação saiu de `src/app/api/health/route.ts` para
`src/lib/ops/cron-health-report.ts`, e o cron `/api/cron/cron-watchdog` (`*/15`, agendador da
Vercel, que cumpre horário) passou a consumi-la com `sendNtfyAlert` + `claimAlert`. "Um cron parou"
cai para **~15–30 min**. O `health-watch.yml` fica responsável só por "a Vercel inteira morreu",
classe em que 2–6 h é adequado e que um cron da Vercel não pode cobrir — ele morreria junto.

Dedupe por status: `down` ≤ 24 pushes/dia, `degraded` ≤ 4/dia. Atraso detectado cujo push foi
recusado em definitivo (ou sem `NTFY_URL`) **falha o run** — a saúde do próprio watchdog cai, o
`/api/health` enxerga, e a perna do GitHub tem o que ver. Barulhento é melhor que silencioso.

### Defeito encontrado no caminho: crons rápidos nunca eram reportados atrasados

Ao instrumentar o watchdog, a janela de atraso se revelou inalcançável para os crons mais
frequentes. Atraso exigia `now >= lastRun + grace`, mas `lastRun` é a ocorrência mais recente
*anterior a now*, logo `now - lastRun` é sempre menor que o intervalo. Com o piso
`MIN_GRACE_MINUTES = 15`, todo cron de intervalo ≤ 15 min tinha `grace >= intervalo` e o prazo
nunca vencia.

**Medido: um cron `*/5` parado há 30 dias era reportado `ok`.** Valia para `publish-scheduled`,
`notification-deliver`, `uptime-probe`, `social-publish`, `send-scheduled-newsletters`,
`notification-unsnooze`, `links-check-expiry` — e para o próprio `cron-watchdog`. Só
`consecutive_failures > 0` os pegava, ou seja, apenas quando rodavam e falhavam; parar de rodar era
invisível.

**Correção:** a referência passou a ser a execução esperada cujo **prazo já venceu**
(`mostRecentDueRun`), varrendo para trás até achá-la. Para crons lentos a semântica é idêntica (a
ocorrência vencida é a última mesmo); para os rápidos ela passa a existir. Verificado contra as **40
linhas reais de `cron_health` de produção**: agregado segue `ok`, zero falso positivo. Regressão
fixada em `apps/web/test/lib/ops/cron-health-report.test.ts` e provada por mutação (a janela antiga
deixa 11 casos vermelhos).

## O ntfy tocou — o que fazer

> Nenhum push carrega handle, id, token ou motivo (REGRA-PII-NTFY, §0), então a triagem é sempre:
> abrir o CMS ou o Sentry.

São **7** títulos (a contagem `=== 7` de `test/api/cron/ntfy.test.ts`, C2): os 4 abaixo agrupam variantes
do mesmo emissor por texto (`expired`/`access revoked`/`token invalid`/`still disconnected` são um só
título parametrizado por `token_error`), então a tabela lista **9 linhas** para as **7** entradas.

| Título do push | Emissor | Primeiro comando | O que fazer |
|---|---|---|---|
| `Instagram token expired · <slug>` · `… access revoked …` · `… token invalid …` · `… still disconnected …` | `deliverTokenAlert` (§3.2) | `select handle, token_error, token_error_at, token_error_mode, token_alert_sent_at, token_alert_attempt_at from instagram_accounts where id = '<uuid>';` (`CAMPOS_DE_EPISÓDIO`, §0) | Abrir `/cms/settings/instagram` (o header `Click` já leva) e usar **Reconnect**. O motivo real está no card e no e-mail, nunca no push. |
| `Instagram auto-renewal failing` / `still retrying` / `still failing · <slug>` | idem, episódio transitório | mesmo `select` acima — `token_error_mode`/`token_alert_attempt_at` mostram há quanto tempo o cron tenta | Até 69 h o cron continua tentando sozinho. Só agir quando o texto virar `still failing` (aí o **Reconnect** do card em `/cms/settings/instagram` já é primário). |
| `Instagram token expiring without renewal · <slug>` | `expiring_clean` (§3.3 passo 3) | mesmo `select` acima, conferir `token_error is null` | A renovação automática não pegou e o token vence em ≤ 7 dias: **Reconnect** em `/cms/settings/instagram` agora, não esperar o próximo ciclo. |
| `Instagram cron degraded` | `step_errors` (§3.3/§3.4 passo 6) | `curl -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health` (mesma chamada do `health-watch.yml`, C2) | Sentry com `component: instagram-token-refresh` ou `instagram-sync` e a tag `step`. O run terminou; alguma etapa não. Máximo 1 push/dia por cron. |
| `Instagram blob store at <N> MB` | censo semanal (§3.4 passo 3) | — | Prefixo `instagram/` acima da linha de 400 MB. Rodar a limpeza de blobs órfãos descrita em **Superfície de OAuth (C3) → Blob store**. |
| `Instagram blob census truncated at <N> objects` | idem, teto de páginas/tempo | — | **Nenhuma comparação de tamanho foi feita.** Paginar `list({ prefix: 'instagram/', cursor, limit: 1000 })` à mão antes de concluir qualquer coisa. |
| `Instagram callback signature mismatch` | `signed-request.ts` (§3.1 passo 4) | — | Sentry → tag `route` (`deauthorize` \| `data-deletion`) e o segredo usado. Quase sempre `INSTAGRAM_APP_SECRET` divergindo do App Dashboard. Guarda de 60 s em memória + 1 claim/dia. |
| `Instagram deletion request matched no account` | `ddmismatch` (§3.1 passo 7) | — | **Nada foi apagado.** Ver a entrada `ddmismatch` em *Superfície de OAuth (C3)* antes de qualquer ação manual — casar por igualdade apagaria dados de terceiro. |
| `Instagram ops probe` (priority `min`) · `Instagram ops heartbeat` (priority `low`) | sonda diária / heartbeat de 5 d | `curl -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health` | Sinal de vida do canal, não incidente. O alarme é a **ausência**: `no heartbeat accepted for 8d` aparece no `status:'error'` dos crons. |

**Nenhum push chegou e você suspeita do canal.** Primeiro comando: `curl -H "Authorization: Bearer
$CRON_SECRET" https://bythiagofigueiredo.com/api/health` — os dois crons devolvem `alert_channels: {
probe, heartbeat, alerts }` e, quando escalam, `status:'error'` com a causa nomeada: `NTFY_URL unset`,
`terminal refusal (HTTP n)`, `transient for 2 runs`, `no heartbeat accepted for 8d`, `fallback email
dead`, `vault unavailable: SOCIAL_MASTER_KEY missing/malformed`. O e-mail **"Instagram alert channel
down"** (ou **"Instagram token storage unavailable"**) é o segundo canal. Se `/api/health` não responde
nada (timeout/DNS/000) e o e-mail também não chegou, o suspeito é o watchdog do home-lab, não o
Instagram: `journalctl -u cron-watchdog -n 50 --no-pager` no host (`.github/workflows/health-watch.yml`
e o `check.sh` do home-lab são a terceira perna).

## Superfície de OAuth (C3)

- **Rotas:** `GET /api/instagram/oauth` (início, auth-gated), `GET /api/instagram/oauth/callback`
  (retorno, `maxDuration = 120`), `POST /api/instagram/deauthorize` e
  `POST /api/instagram/data-deletion` (públicas, autenticadas pelo `signed_request`, `maxDuration = 60`),
  e a página pública `/data-deletion?code=<32 hex>`.
- **Onde registrar os callbacks na Meta:** App Dashboard > Instagram > *API setup with Instagram login* >
  *3. Set up Instagram business login* > *Business login settings* (Instagram App ID = `client_id`);
  o *Data Deletion Request URL* também aparece em *App Dashboard → Settings*. As Redirect URIs
  registradas estão coladas verbatim na seção "Gates de C3" — a doc avisa que o Dashboard "might have
  added a trailing slash", e um descasamento falha no passo 5 com `exchange_failed`, mensagem sobre a
  qual o dono não tem ação nenhuma.
- **`enable_fb_login=false`** esconde a opção de entrar pelo Facebook. Se a conta profissional só for
  alcançável pela conta do Facebook vinculada, a tela de login não oferece caminho: repetir a URL de
  autorização **sem** `enable_fb_login`.
- **iOS / navegador in-app:** o retorno caindo num WebView chega sem cookie de sessão nem nonce ⇒ a
  rota responde **400 `browser_changed`** ("Authorization finished in a different browser…"). Abrir o
  CMS no Safari/Chrome e repetir.
- **Mismatch de conta:** o banner "You authorized @X; this CMS account is @Y" reconecta em **um clique**
  (segunda autorização **sem** senha, fixada por `allowRebindTo`). O cookie de mismatch vale 10 min.
- **Cola manual** continua sendo fallback permanente (`Paste token manually`), inclusive em preview e
  quando `INSTAGRAM_*`/`SOCIAL_MASTER_KEY` faltam.
- **Blob store:** `Remove` apaga a conta e os posts, **não** os blobs. Limpeza (comando pronto):
  paginar `list({ prefix: 'instagram/', cursor, limit: 1000 })`, agrupar por `instagram/<accountId>/`,
  `del(urls)` dos prefixos cujo `<accountId>` já não existe em `instagram_accounts`.
- **Pedido de exclusão travado:** linha em `instagram_deletion_requests` com `completed_at is null` há
  mais de 10 min é retomada pelos **dois** crons — `instagram-token-refresh` (11:00 UTC) e
  `instagram-sync` (13:00 UTC), um pedido por run cada — e pelo replay da Meta após 90 s.
  A página pública diz "in progress" até `completed_at` — **nunca** afirma conclusão com base no
  `requested_at`.
- **`ddmismatch`:** push "Instagram deletion request matched no account" = o `payload.user_id` da Meta
  não casou nenhuma linha `oauth`, mas existe uma linha `legacy` com o mesmo id. Nada foi apagado —
  decidir manualmente (a linha `legacy` veio de outro app e casar por igualdade apagaria dados de
  terceiro).

## Pós-deploy C3

> **PENDENTE — o dono executa depois do push/promoção.** Registrar aqui o intervalo de shas e as
> evidências abaixo.

**Intervalo de commits (rollback é um comando só):**

```
C3 = 4d632382..219d533e   (4d632382 rotas+página, 3382c055 ações+settings, 740f2fde UI+docs, 219d533e fix da rota de exclusão)
git revert --no-commit 4d632382^..219d533e && git commit -m "revert(instagram): C3 — OAuth de um clique"
```
Merge em `main`: `f7234430`.

Ordem obrigatória de rollback: **C3 → C4 → C2 → C1 → B → A5 → A4 → A**. Reverter C2 **exige** o passo
de banco descrito em §7 do design doc — "só reverter o deploy" está proibido para C2.

**Checagens (§7 passo 5):**

```bash
# (a) Referrer-Policy efetivo (o valor do bloco global é strict-origin-when-cross-origin)
curl -sI 'https://bythiagofigueiredo.com/api/instagram/oauth/callback' | grep -i -E 'referrer-policy|cache-control'
curl -sI 'https://bythiagofigueiredo.com/data-deletion?code=00000000000000000000000000000000' | grep -i referrer-policy
# esperado: no-referrer nos dois; no-store no callback

# (b) 302 do início, SEM force_reauth (com o cookie de sessão do CMS)
curl -sI -b "<cookie de sessão>" 'https://bythiagofigueiredo.com/api/instagram/oauth?account_id=<uuid>' | grep -i location
# esperado: .../oauth/authorize?...&scope=instagram_business_basic&...&enable_fb_login=false  (sem force_reauth)

# (c) 405 nas rotas públicas via GET
curl -s -o /dev/null -w '%{http_code}\n' https://bythiagofigueiredo.com/api/instagram/deauthorize
curl -s -o /dev/null -w '%{http_code}\n' https://bythiagofigueiredo.com/api/instagram/data-deletion
# esperado: 405 405
```

**Resultado 2026-09-07 (controlador), contra produção:**

| Checagem | Esperado | Obtido | Veredito |
|---|---|---|---|
| (a) `/api/instagram/oauth/callback` | `no-referrer` + `no-store` | `referrer-policy: no-referrer`, `cache-control: no-store` (HTTP 503 `not_configured`, esperado sem as envs) | **APROVADO** |
| (a) `/data-deletion?code=0…0` | `no-referrer` | HTTP 200, `referrer-policy: no-referrer` | **APROVADO** |
| (c) `GET /api/instagram/deauthorize` | `405` | `405` | **APROVADO** |
| (c) `GET /api/instagram/data-deletion` | `405` | `405` | **APROVADO** |
| (b) 302 do início sem `force_reauth` | — | **APROVADO por evidência mais forte que o curl**: o fluxo real completou em 2026-09-18 e a tela de consentimento do Instagram apareceu nomeando `bythiagofigueiredo-IG`. Um `redirect_uri` não registrado ou um `client_id` errado teriam sido recusados ANTES dessa tela. | aprovado |

**Gate móvel** — o único que continua pendente do dono: forçar um alerta, tocar o `Click` do push no
aparelho e completar até "Connected!". O caminho de desktop está provado de ponta a ponta.

**Gate móvel (bloqueante):** forçar um alerta numa conta de teste, tocar o `Click` do push **no
aparelho do dono** (iOS Safari **e** Android Chrome) e completar até "Connected!"; conferir no card
`Connected · renews automatically · … · Syncing your feed…` e, no segundo `router.refresh()`,
`last sync just now`; conferir a trilha (`select mode, status, error_message from instagram_sync_log
where account_id = '<conta>' order by created_at desc limit 3` ⇒ primeira linha `manual`/`completed`
com `detail: instagram_business_basic`).

**Callbacks da Meta:** desautorizar o app em *Instagram → Configurações → Apps e sites*, conferir no
Sentry a tag do segredo usado; confirmando `INSTAGRAM_APP_SECRET`, **remover**
`INSTAGRAM_ALLOW_META_SECRET_FALLBACK` das envs de produção (expira sozinho em 2026-10-06, mas o
desligamento manual é o gate); reautorizar pelo CMS; pedido de exclusão de teste com
`completed_at` preenchido, `list({ prefix: 'instagram/<accountId>/' })` vazio e a página
`/data-deletion?code=<code>` bilíngue.

**CTA do alerta:**

```sql
select message from notifications
 where type = 'system.token_expired' and created_at > now() - interval '1 day'
 order by created_at desc limit 1;
```

Esperado: termina em `— reconnect at https://bythiagofigueiredo.com/cms/settings/instagram`.
