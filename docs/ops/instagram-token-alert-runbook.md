# Runbook — alerta de token do Instagram e superfície de OAuth

> Corrente completa: cron de renovação (`"0 11 * * *"`) → episódio (`CAMPOS_DE_EPISÓDIO`) → alerta
> (ntfy + CMS + e-mail) → **Reconnect em um clique** em `/cms/settings/instagram`.
> Spec: `docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md`.
> Planos: `docs/superpowers/plans/2026-09-06-instagram-oauth-*.md`.

## Gates de C3 (2026-09-06)

> **PENDENTE — executado pelo dono** (exigem token/dashboard/produção; ver Task 1 do plano C3).
> Colar as saídas verbatim nos blocos abaixo. Enquanto não forem preenchidos, C3 **não promove**.

### Identidade (bloqueante)
`GET /v25.0/me?fields=id,user_id,username` →
```json
<colar a saída verbatim>
```
`GET /v25.0/<me.id>/media?fields=id&limit=1` → HTTP `<colar>`
Conclusão esperada: `ig_user_id = me.id` (app-scoped) é aceito pela aresta que o feed usa.
`ig_professional_id = me.user_id` → `<presente | ausente ⇒ null>`.
**Ramo de falha:** `/media` recusando o `me.id` ⇒ C3 não promove; a precedência de identidade
(§3.1 passo 7) é corrigida antes.

### Redirect URIs registradas no App Dashboard (verbatim)
```
<colar as URIs, incluindo eventual barra final>
```
Host que serve sem 308: `<apex | www>`.

### Envs de produção
`INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `SOCIAL_MASTER_KEY` presentes em `production`
(`vercel env ls production | grep -E 'INSTAGRAM_APP_ID|INSTAGRAM_APP_SECRET|SOCIAL_MASTER_KEY'`).

### Consentimento
`select count(*) from consent_texts where category='social_feed_read'` = `<esperado: 2>`.

### Conta no app
App Dashboard > Roles > Instagram Testers: a conta profissional do dono aparece como tester
**aceito** (convite pendente falha a autorização sem mensagem útil).

### Gate móvel de ponta a ponta
Executado depois da promoção (exige o código em produção): é **bloqueante para manter C3 em
produção** — se falhar, rollback pelo §7. Procedimento e resultado ficam registrados abaixo, na
seção "Pós-deploy C3".

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
C3 = <FIRST>..<LAST>
git revert --no-commit <FIRST>^..<LAST> && git commit -m "revert(instagram): C3 — OAuth de um clique"
```

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
