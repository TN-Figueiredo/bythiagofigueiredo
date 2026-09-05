# Runbook — promoção `staging` → `main` (Next 16)

**Status:** aguardando produção voltar a ficar saudável (degradação em investigação por outro time,
não relacionada a este runbook). Não execute nada aqui até a Seção 0 estar toda verde.

**Contexto:** `origin/staging` está 43 commits à frente de `origin/main`, com a migração
Next 15.5.19 → 16.3.4, o fechamento do gate de audit de dependências, e a correção de paridade de
cache (`6fa9551b`, `{ expire: 0 }` em todos os `revalidateTag` — substitui os perfis nomeados
`'seconds'`/`'minutes'` que a WP-2 tinha adotado por engano). Avaliação de risco completa em
`.superpowers/sdd/2026-09-04-next16-ecosystem-validation/prod-merge-assessment.md` — este runbook
não repete o raciocínio de lá, só transforma o veredito em passos executáveis.

Este documento é uma sequência. Siga na ordem. Nenhum passo pede julgamento — se um comando não
der o resultado esperado, **pare e não avance**, mesmo que pareça "provavelmente não é nada".

---

## Índice

0. Pré-condições verificáveis
1. Sequência do merge
2. Janela de observação pós-deploy (15 min)
3. Gatilhos de rollback
4. O que NÃO fazer durante a janela
5. Riscos residuais aceitos

---

## 0. Pré-condições verificáveis

Rode as 7 checagens abaixo, em ordem. Todas precisam passar antes de tocar na Seção 1.

### 0.1 — Produção está saudável de novo (degradação atual resolvida)

```bash
curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' https://bythiagofigueiredo.com/
curl -s -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health | jq .
```
**Esperado:** `200` na home em menos de ~2s; `/api/health` responde JSON (não 401/500/timeout).
**Se falhar:** pare. A degradação relatada ainda não foi resolvida — confirme com quem está
investigando antes de prosseguir.

### 0.2 — `origin/staging` está com CI 12/12 verde

```bash
gh run list --branch staging --limit 1
gh run view --branch staging  # ou: gh run view <run-id> se o comando acima pedir
```
**Esperado:** o run mais recente do workflow `CI` em `staging` mostra **12 checks**, todos
`success`: `Ecosystem Pinning Check`, `Typecheck (apps/api)`, `Typecheck (apps/web)`,
`Test — API`, `Test — Web`, `Test — Packages`, `Integration (DB-gated)`, `Dependency Audit`,
`Secret Scan (TruffleHog)`, `Schema Sanity Check`, `Wait for Vercel preview (SEO smoke)`,
`SEO Smoke (preview)`.
**Se algum estiver `failure`, `cancelled` ou o run for mais antigo que o último commit de
staging:** pare. Não promova com CI vermelho ou desatualizado — rode de novo primeiro
(`gh workflow run ci.yml --ref staging` se precisar).

### 0.3 — Migrations aplicadas em produção (via PostgREST, só SELECT)

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
(async () => {
  const { error } = await supabase
    .from('content_pipeline_history')
    .select('changed_by_key_id')
    .limit(0);
  if (error) { console.error('FALTA migration 20260903000001:', error.message); process.exit(1); }
  console.log('OK: changed_by_key_id existe em content_pipeline_history (20260903000001 aplicada)');
})();
"
```
Rode com as env vars de **produção** (`vercel env pull .env.production.check --environment=production`
e `source`, ou copie os dois valores do dashboard da Vercel — nunca do `.env.local`, que aponta
para o mesmo projeto único mas convém confirmar explicitamente que é prod).
**Esperado:** `OK: changed_by_key_id existe...`. Isso é exatamente o padrão que o job
`check-migration-applied` do `ci.yml` já usa para as colunas de SEO — reaplicado aqui para a
migration mais recente. Um `select(...).limit(0)` valida a coluna sem RLS bloquear (RLS filtra
linhas, não a existência de coluna), então funciona com a anon key.
**Se falhar:** pare. Rode `npm run db:which` (confirme `novkqtvcnsiwhkxihurk`) e
`npm run db:push:prod` **antes** de qualquer merge — a ordem é obrigatória: o código que grava
em `changed_by_key_id` (`src/lib/pipeline/services/items.ts:1050,1238,1454,1759`) quebra toda
escrita de pipeline via API key (Cowork/MCP) se a coluna não existir ainda.
Aproveite para conferir também as três migrations de 2026-07-03
(`20260703000001_fix_definer_search_path_btf097.sql`,
`20260703000002_lgpd_phase1_anonymize_password_reset_attempts.sql`,
`20260703000003_purge_used_dsar_tokens.sql`) citadas como pendentes numa rodada anterior — se
ainda não foram para prod, este é o momento de resolver isso também, no mesmo `db:push:prod`.

### 0.4 — Env vars da Vercel presentes em Production

Diff `origin/main..origin/staging` de `process.env.*` mostra só duas novas — ambas
**opcionais** (têm default/off): `AB_AUTO_APPLY_WINNER` e `YT_ANALYTICS_SYNC_WINDOW_DAYS`.
Nenhuma env nova é *exigida*. O que muda é que 3 call-sites de e-mail que antes eram no-op
(Resend não estava no lockfile, nunca enviavam nada) agora enviam de verdade via SES — então as
vars de SES, que já deveriam existir por causa de newsletter/contact/waitlists no `main`,
passam a ser exercitadas por caminhos novos. Confira:

```bash
vercel env ls production | grep -E 'AWS_SES_REGION|AWS_SES_ACCESS_KEY_ID|AWS_SES_SECRET_ACCESS_KEY|SES_TRANSACTIONAL_CONFIG_SET|SES_DEFAULT_CONFIG_SET|NEWSLETTER_FROM_DOMAIN|CRON_SECRET|PIPELINE_MCP_HMAC_SECRET|NEXT_PUBLIC_APP_URL'
```
**Esperado:** todas as 8 (ou 7, se só um dos dois `SES_*_CONFIG_SET` existir — está ok, o código
aceita qualquer um dos dois) aparecem na lista, ambiente `production`.
**Se faltar alguma:** pare e adicione via `vercel env add <NOME> production` antes do merge —
depois do deploy fica mais caro de corrigir porque emails já terão tentado sair.
Confirme também, no console AWS SES, que a identidade verificada cobre `alerts@` e `noreply@`
do domínio de produção (não é uma env var, mas é pré-condição do mesmo item).

### 0.5 — Node ≥ 20.9 na Vercel

```bash
vercel project inspect bythiagofigueiredo | grep -i "node"
```
Ou: Vercel Dashboard → Project Settings → General → Node.js Version.
**Esperado:** `20.x` com x ≥ 9, ou `22.x`. O repo local usa `.nvmrc` = `22` e `package.json`
declara só `>= 20.0.0` — a Vercel pode estar configurada com uma versão mais antiga da faixa
20.x. Next 16 exige ≥ 20.9 (`node_modules/next/package.json`).
**Se estiver abaixo:** pare, ajuste a versão no dashboard antes do merge — sem isso o build
falha de forma barata (não chega a promover nada), mas evita o ciclo de descobrir isso só
depois do push.

### 0.6 — Plano da Vercel comporta 50 crons

`apps/web/vercel.json` tem **50 entradas** em `crons` (contei: eram 39 ativos em `main`, mais
11 que nunca tinham rodado — ver Seção 5). Cron jobs por projeto são limitados por plano.
**Esperado:** plano Pro ou superior (Hobby limita a bem menos que 50 e a menos de 1/dia por
job — `social-publish` roda `* * * * *`).
```bash
vercel project inspect bythiagofigueiredo | grep -i plan
```
**Se o plano não comportar:** pare — o deploy sobe mas a Vercel silenciosamente não agenda os
crons que excederem o limite, e não há erro visível no build.

### 0.7 — Backlog de `notification_deliveries` medido e sob controle

Use o SQL Editor do Supabase (dashboard, service role — RLS bloqueia isso via anon/PostgREST):

```sql
select status, count(*), min(next_retry_at), max(next_retry_at)
from notification_deliveries
where status in ('pending', 'failed')
group by status;
```
**Por quê:** `processDeliveryQueue` (`src/lib/notifications/cron/deliver.ts`) deixou de ser stub
e o `select` passou a incluir `status = 'failed'` (antes só `'pending'`) — linhas que nunca eram
reprocessadas voltam à fila. Com o cron `notification-deliver` em `*/5 * * * *` e cap de 50 por
run, um backlog acumulado vira uma rajada de e-mails reais assim que o deploy for para o ar.
**Limiar de decisão:**
- `pending + failed` somando **até ~20 linhas**: ok, deixar o cron ligado normalmente.
- **Dezenas ou mais:** antes do merge, remova a entrada
  `{ "path": "/api/cron/notification-deliver", "schedule": "*/5 * * * *" }` de
  `apps/web/vercel.json` neste merge, drene o backlog manualmente (ou aceite/descarte as linhas
  antigas por decisão de produto), religue o cron num segundo deploy pequeno depois.

---

## 1. Sequência do merge

Só chegue aqui com as 7 checagens da Seção 0 verdes.

```bash
# 1. Sincronizar main local com o remoto
git checkout main
git pull --ff-only

# 2. Merge (preserva o histórico dos 43 commits, não squash)
git merge --no-ff origin/staging

# 3. Push — dispara o build de produção na Vercel e o `ci.yml` volta a rodar em `main`
git push origin main
```

**O que a CI roda em `main`:** o mesmo workflow `ci.yml` da Seção 0.2 (os mesmos 12 checks) —
não há um workflow separado para `main`. Não é bloqueante do deploy (a Vercel builda em
paralelo, por push, não por status de CI), mas se ficar vermelho em `main` depois do merge é
sinal de diferença de ambiente/secrets entre branches — investigar, não ignorar.

**Quanto esperar:** build da Vercel tipicamente 3-6 min (primeira vez com este lockfile e
Turbopack — pode chegar a 8-10 min por cache frio, ver risco residual #6 na Seção 5). Não
prossiga para a Seção 2 antes do deployment aparecer como `Ready` no dashboard da Vercel.

---

## 2. Janela de observação pós-deploy (15 minutos)

Cronometre a partir do momento em que o deployment vira `Ready`.

### Minuto 0-2 — build

Confirme no dashboard da Vercel: `Ready`, sem erros. Se falhou aqui, **nada foi promovido** —
o alias de produção continua no deployment anterior. Não é um rollback, é simplesmente não ter
subido. Vá direto à causa (Node version, `npm ci --legacy-peer-deps` com lockfile novo).

### Minuto 2-4 — fumaça de rotas públicas

```bash
for p in / /blog /about /newsletters /sitemap.xml /robots.txt /og-default.png; do
  echo -n "$p "; curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' https://bythiagofigueiredo.com$p
done
curl -s -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health | jq .
```
**Esperado:** todas `200`, tempos comparáveis ao baseline pré-merge (rode este mesmo bloco
**antes** do merge também, para ter algo a comparar). `/api/health` responde — confirma que o
import estático de `vercel.json` sobreviveu ao file-tracing do Turbopack.
**Problema:** qualquer `5xx`, ou tempo >3x o baseline, ou `/api/health` sem resposta/erro.

### Minuto 4-8 — telas autenticadas (CMS/admin)

Login manual em `/cms/login`, depois `/cms/blog` e `/admin/ads`. Confira visualmente:
CSS carregando (pacote `cms-ui`/Tailwind), guard de auth funcionando (`auth-nextjs`), filtro de
lista funcionando (`cms-admin`). Estes são os itens marcados como "pendente pós-deploy (sessão)"
em `docs/ops/ecosystem-next16-validation.md`.
**Problema:** tela sem estilo (CSS não carregou), erro de hidratação no console do browser,
redirect de auth quebrado.

### Minuto 8-12 — teste de invalidação de cache real

Este é o teste que a preview **não conseguia responder** (tráfego ~zero em preview não exercita
a propagação real para o CDN da Vercel). Agora que `6fa9551b` trocou todos os perfis nomeados
por `{ expire: 0 }`, o comportamento esperado é paridade total com o Next 15: purge imediato.

```bash
# 1. Baseline
curl -s https://bythiagofigueiredo.com/sitemap.xml | head -20

# 2. Editar algo em /cms/settings que dispare revalidateTag('seo-config', { expire: 0 })
#    (ex.: mudar um campo de SEO default, salvar)

# 3. Ler duas vezes, imediatamente
curl -s https://bythiagofigueiredo.com/sitemap.xml | head -20
curl -s https://bythiagofigueiredo.com/sitemap.xml | head -20
```
**Esperado:** a mudança já aparece na **primeira** leitura pós-save (não só na segunda). Se
aparecer só na segunda ou depois de esperar, o `{ expire: 0 }` não está sendo respeitado como
purge imediato pelo handler da Vercel (`handler.updateTags`, código deles, não deste repo) — é
o cenário ruim descrito no assessment.
Repita o mesmo teste com as outras duas superfícies públicas de maior tráfego:
- `ads` → editar um slot de anúncio, `curl` numa página de blog pública com anúncio.
- `instagram-feed` → forçar um sync (ou aguardar), `curl` na home.

**Problema:** qualquer uma das três fica velha por mais que ~alguns segundos de propagação de
CDN (não minutos). **Isto não é gatilho de rollback** — é gatilho de investigação; ver Seção 3.

### Minuto 12-14 — crons

```sql
select cron_name, last_success_at, last_failure_at, consecutive_failures, severity
from cron_health
order by updated_at desc
limit 20;
```
(Supabase SQL Editor — RLS bloqueia isso via PostgREST/anon key, como no item 0.7.)
Foque em `social-publish` (`* * * * *`) e `notification-deliver` (`*/5 * * * *`) — são os dois
crons de maior frequência, então os dois primeiros sinais depois do deploy.
**Esperado — e importante calibrar a expectativa:** você vai ver **mais** falhas registradas do
que via antes em vários crons (`sync-youtube`, etc.) — isso é a instrumentação nova
(`recordCronSuccess/Failure`) parando de reportar falso-positivo de sucesso, não regressão.
**Problema real:** `consecutive_failures` subindo em `notification-deliver` especificamente com
`severity = 'critical'`, ou qualquer cron novo dos 11 órfãos (ver Seção 5) falhando de forma
que sugira efeito colateral (não apenas "está rodando pela primeira vez e encontrou dado
inesperado" — isso é esperado, investigar sem pânico).

### Minuto 14-15 — checar rajada de e-mail

Confira Sentry (breadcrumbs de `sendStoryEmailNotification`/`sendEscalationEmail`) e, se tiver
acesso, o console AWS SES (Sending statistics) por um pico anômalo de envios no minuto do
deploy.
**Esperado:** volume comparável ao normal, ou zero (se nenhum gatilho ocorreu na janela).
**Problema:** dezenas+ de envios simultâneos — sinal de que o backlog de `notification_deliveries`
(item 0.7) não foi drenado/desligado como planejado.

---

## 3. Gatilhos de rollback

| Sintoma | Como medir | Ação |
|---|---|---|
| `5xx` em qualquer rota pública da lista da Seção 2 | `curl -w '%{http_code}'` | `vercel rollback` |
| Erro de hidratação ou CSS quebrado em `/cms` ou `/admin` | inspeção visual + console do browser | `vercel rollback` |
| Rajada de e-mail (dezenas+ em minutos) | Sentry / AWS SES sending stats | `vercel rollback` **e** remover manualmente `notification-deliver`/desligar o adapter antes de religar |
| `sitemap.xml`/`ads`/`instagram-feed` continuam velhos por mais que alguns segundos após o teste da Seção 2 | repetição do `curl` do teste de cache | **não** é rollback — trocar os `{ expire: 0 }` afetados por outra abordagem é um fix cirúrgico, redeploy pequeno |
| `cron_health.severity = 'critical'` só em `notification-deliver`, sem rajada de e-mail | SQL da Seção 2 | investigar antes de decidir — pode ser `vercel.json` sem a rota removida a tempo; remover a linha do cron e redeploy é mais cirúrgico que rollback |

**Custo de cada caminho de volta:**
- **`vercel rollback` (promover o deployment anterior / troca de alias):** segundos, sem
  rebuild, imune ao lockfile novo. É o caminho recomendado e o único que vale ensaiar mentalmente
  antes do deploy.
- **`git revert` do commit de merge:** custa um ciclo completo de build **frio** — o diff do
  lockfile é grande (~1048/2207 linhas), o `installCommand` é `npm ci --legacy-peer-deps`
  (`vercel.json:3`), e a troca de bundler (webpack → Turbopack) invalida o cache de build da
  Vercel. Não use isto como primeira resposta a um incidente — é para quando `vercel rollback`
  não for suficiente (ex.: precisa também reverter o código no repo, não só o tráfego).

**O rollback de código não desfaz:** e-mails já enviados, os 3 crons destrutivos que já rodaram
(`media-cleanup`, `purge-content-events`, `snapshot-cleanup`), nem escritas do
`youtube-intelligence-watchdog`. Ver Seção 5.

---

## 4. O que NÃO fazer durante a janela

- **Não** rodar `git revert` como primeira reação a qualquer sintoma da Seção 3 — sempre
  `vercel rollback` primeiro; `git revert` é o fallback caro, não o padrão.
- **Não** tratar aumento de falhas em `cron_health` como regressão automática — a instrumentação
  nova (Seção 2, minuto 12-14) faz isso por design. Confirme o cron específico e o padrão do
  erro antes de agir.
- **Não** reagir ao teste de cache (Seção 2, minuto 8-12) com rollback — se `{ expire: 0 }` não
  estiver se comportando como purge imediato, é um ajuste cirúrgico de código (trocar o
  `revalidateTag` afetado), não motivo para desfazer a promoção inteira.
- **Não** desligar o cron `notification-deliver` só por precaução se o item 0.7 já confirmou
  backlog pequeno — desligar sem necessidade atrasa a entrega de notificações reais aos usuários.
- **Não** rodar `db:push:prod` de novo durante a janela — qualquer migration pendente devia ter
  sido resolvida na Seção 0.3, antes do merge. Rodar migration no meio da janela de observação
  mistura duas fontes de mudança e dificulta diagnosticar qual causou o quê.
- **Não** promover um segundo merge/deploy "para testar mais uma coisa" dentro da mesma janela
  de 15 minutos — cada deploy reseta a janela de observação e mistura sinais.
- **Não** ignorar um `check-migration-applied`/CI vermelho em `main` pós-push alegando "já
  passou em staging" — branches podem ter secrets/config diferentes; investigue a diferença.

---

## 5. Riscos residuais aceitos

Ao promover, você está assumindo explicitamente:

1. **11 crons órfãos rodam pela primeira vez em produção:** `notification-deliver`,
   `notification-unsnooze`, `notification-cleanup`, `media-cleanup`,
   `aggregate-content-metrics`, `purge-content-events`, `snapshot-cleanup`,
   `pipeline-deadline-digest`, `ad-events-aggregate`, `adsense-sync`,
   `youtube-intelligence-watchdog`. Total de crons: 39 → 50. Três apagam dados
   (`media-cleanup`, `purge-content-events`, `snapshot-cleanup`) e um envia e-mail de digest
   (`pipeline-deadline-digest`) sem terem sido exercitados em produção antes.
2. **`processDeliveryQueue` deixou de ser stub** e agora envia e-mails de verdade a partir de
   `notification_deliveries`, incluindo linhas `status = 'failed'` que antes nunca eram
   reprocessadas. O próprio código admite uma janela de reenvio duplicado
   (`deliver.ts:78-87`) — aceito, não corrigido neste merge.
3. **Dois caminhos de e-mail que eram no-op silencioso viram envios reais:** escalação do A/B
   Lab (`ab-escalation.ts`) e notificação de story pronta (`email-fallback.ts`). Ambos falham
   fechado e silencioso se as credenciais SES estiverem erradas (não derrubam a request), mas
   isso também significa que uma falha de configuração SES não vai aparecer como erro óbvio —
   só como "o e-mail não chegou".
4. **Propagação real do `{ expire: 0 }` para o CDN da Vercel é código deles, não deste repo** —
   o teste da Seção 2 valida o comportamento observado, mas não há garantia formal fora do
   teste ao vivo em produção.
5. **`savePreferences` força `channel_push`/`channel_telegram = false`** no próximo save de
   qualquer usuário — sobrescreve preferência existente sem aviso. Comportamento pré-existente
   no código de staging, não introduzido por este merge, mas passa a valer em produção junto
   com o resto.
6. **Primeiro `npm ci --legacy-peer-deps` com este lockfile em cache frio de produção** — a
   combinação lockfile-novo + Turbopack nunca rodou no ambiente real da Vercel antes deste
   deploy (só em preview).
7. **Sentry sob Turbopack nunca foi validado em produção** — mitigado por
   `sourcemaps: { disable: true }` já estar ativo desde `main` (sem upload de source map para
   quebrar), mas o comportamento do `withSentryConfig` sob o bundler novo em si é risco não
   testado.
