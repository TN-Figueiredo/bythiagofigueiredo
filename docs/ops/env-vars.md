# Variáveis de ambiente e flags operacionais

Movido do `CLAUDE.md` em 2026-10-09. Fonte de verdade para o detalhe de cada variável.

## Remaining operational flags (boolean feature flags removed 2026-05-07)

LGPD: `LGPD_CRON_SWEEP_ENABLED` (safety valve — irreversible data deletion cron)
SEO: `SEO_AI_CRAWLERS_BLOCKED` (controls robots.txt AI crawler rules)
Links: `LINKS_SHORT_DOMAIN` (string)
Tracking: `GEO_PROVIDER` (string — default `auto`, set `stub` for dev/test)
Ads: `AD_GOOGLE_ENABLED`, `AD_TRACKING_ENABLED`, `AD_REVENUE_SYNC_ENABLED` (require external Google setup)
YouTube A/B Lab: `AB_AUTO_APPLY_WINNER` (default off — a confiança bayesiana do teste roda sobre cliques que são sempre zero, então o vencedor é só sugerido e espera confirmação humana antes de ser aplicado no canal)

## Agenda do cron de concorrentes (A5, `sync-youtube`)

Variável de ambiente na Vercel só vale para deployment novo: mudar a variável **e fazer um redeploy** (sem mudar código). Plano: `docs/superpowers/plans/2026-10-12-a5-e16-e15-parte-1-plan.md`.

- `OBS_AGENDA`: desliga a agenda SÓ com o valor exato `off` (`OFF`, `0`, vazio e espaço deixam ligada; ausente = ligada). Desligada, a rota volta ao lote antigo inteiro e a leitura horária para (a hora não lida não volta). **Roda mesmo assim, antes do lote antigo, só `anular_identidade`** (obrigação de LGPD: apaga a identidade de autores de comentários aos 28 dias); as demais tarefas aparecem como `agenda_desligada`. **Aviso (E14): desligada por mais de 48 h, perde retratos de comentários que não voltam (cerca de 4 por dia por marco).**
- `OBS_AGENDA_TASKS_OFF`: nomes de tarefa separados por vírgula (nome exato, minúsculo; espaços e vazios ignorados). Aceitos: `leitura_horaria`, `sincronizar_canais`, `serie_semanal`, `retratos_comentarios` (E14) e `anular_identidade` (E14). Nome desconhecido é ignorado e aparece numa nota. **`anular_identidade` é `nuncaDesliga`: o nome é aceito, mas a tarefa continua ligada e a nota diz que foi ignorado.** **Aviso (E14): `retratos_comentarios` desligada por mais de 48 h perde retratos de comentários que não voltam (cerca de 4 por dia por marco).** Também pede redeploy.
- `YT_OWN_STEPS_OFF`: passos da coleta do canal próprio (cron `sync-analytics-metrics`) desligados, separados por vírgula. Aceitos: `retencao`, `dimensoes`, `versoes`, `normalizadores`. Nome desconhecido não desliga nada e deixa o cron vermelho uma vez. É uma lista inteira: gravar um valor novo substitui o anterior. Passo desligado deixa o cron vermelho na 8ª execução seguida. Em produção desde 14/10/2026: `dimensoes,normalizadores` (E11 desligada até o ensaio com a API real). Só vale depois de um novo deploy. Detalhe: `docs/ops/youtube-coleta-canais-proprios-runbook.md`.

## Variáveis por app

### Web (`apps/web/.env.local`)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `CRON_SECRET`, `NEWSLETTER_FROM_DOMAIN`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `CAMPAIGN_PDF_SIGNED_URL_TTL`, `YOUTUBE_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `PIPELINE_MCP_HMAC_SECRET`, `YT_ANALYTICS_SYNC_WINDOW_DAYS`, `NTFY_URL`, `UPTIME_PROBE_TARGET`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_ALLOW_META_SECRET_FALLBACK`, `SOCIAL_MASTER_KEY` + operational flags above.

`PIPELINE_MCP_HMAC_SECRET` (gerar com `openssl rand -hex 32`): assina os confirmation tokens de ações destrutivas do MCP pipeline (`lib/pipeline/mcp/safety.ts`). Deliberadamente separado de `PIPELINE_COWORK_KEY` — essa viaja em todo request via `X-Pipeline-Key`, então usá-la para assinar os tokens deixaria quem tem a chave forjar a própria confirmação. **Ordem obrigatória de rollout:** setar a variável (`.env.local` e Vercel) primeiro, deploy do código depois — invertido, `getHmacSecret()` lança e derruba as tools MCP.

`META_REQUEST_INSIGHTS_SCOPES` (opcional, default desligado): quando `1`, o start do OAuth social
pede também `read_insights` e `instagram_manage_insights`. **Desligado desde 2026-09-18** porque o
diálogo da Meta recusou o pedido inteiro com `Invalid Scopes: read_insights,
instagram_manage_insights` — um escopo indisponível não degrada o pedido, ele BLOQUEIA o diálogo e
derruba a reconexão de publicação junto. Ligue só depois que as duas permissões estiverem liberadas
para o app (App Review / acesso avançado) e reconecte uma vez; enquanto estiver desligado, as
chamadas a `/insights` do `metrics-poller` falham por entrega e aparecem em `cron_runs`.

`YT_ANALYTICS_SYNC_WINDOW_DAYS` (opcional, default `90`): controla o tamanho da janela consultada na YouTube Analytics API pelo cron `app/api/cron/sync-analytics-metrics/route.ts`.

`INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET` (App Dashboard > Instagram > API setup with Instagram login >
Business login settings): habilitam `Connect with Instagram` em `/cms/settings/instagram`. Lidos de
`process.env` direto (declarados `.optional()` no `serverSchema`) — `getServerEnv()` lançaria e derrubaria
a rota inteira. Sem eles a UI mostra "Instagram OAuth isn't configured yet" e a cola manual continua
funcionando. `INSTAGRAM_ALLOW_META_SECRET_FALLBACK=1` aceita `META_APP_SECRET` na verificação do
`signed_request` até **2026-10-06** (`META_SECRET_FALLBACK_DEADLINE_MS`); depois é ignorado.
`SOCIAL_MASTER_KEY` (32 bytes hex) cifra o token em repouso — sem ela o OAuth responde 503
`vault_unavailable`.

Sentry: `NEXT_PUBLIC_SENTRY_DSN` required em prod/preview, optional em dev (empty → no-op). `SENTRY_ORG/PROJECT/AUTH_TOKEN` build-only (source map upload).

### API (`apps/api/.env.local`)
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`, `WEB_URL`, `SENTRY_DSN`

### Production (Vercel)
`NEXT_PUBLIC_APP_URL=https://bythiagofigueiredo.com`, `NEXT_PUBLIC_API_URL=https://bythiagofigueiredo-api.vercel.app`

