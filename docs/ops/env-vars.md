# Variáveis de ambiente e flags operacionais

Movido do `CLAUDE.md` em 2026-10-09. Fonte de verdade para o detalhe de cada variável.

## Remaining operational flags (boolean feature flags removed 2026-05-07)

LGPD: `LGPD_CRON_SWEEP_ENABLED` (safety valve — irreversible data deletion cron)
SEO: `SEO_AI_CRAWLERS_BLOCKED` (controls robots.txt AI crawler rules)
Links: `LINKS_SHORT_DOMAIN` (string)
Tracking: `GEO_PROVIDER` (string — default `auto`, set `stub` for dev/test)
Ads: `AD_GOOGLE_ENABLED`, `AD_TRACKING_ENABLED`, `AD_REVENUE_SYNC_ENABLED` (require external Google setup)

## Agenda do cron de concorrentes (A5, `sync-youtube`)

Variável de ambiente na Vercel só vale para deployment novo: mudar a variável **e fazer um redeploy** (sem mudar código). Plano: `docs/superpowers/plans/2026-10-12-a5-e16-e15-parte-1-plan.md`.

- `OBS_AGENDA`: desliga a agenda SÓ com o valor exato `off` (`OFF`, `0`, vazio e espaço deixam ligada; ausente = ligada). Desligada, a rota volta ao lote antigo inteiro e a leitura horária para (a hora não lida não volta). **Roda mesmo assim, antes do lote antigo, só `anular_identidade`** (obrigação de LGPD: apaga a identidade de autores de comentários aos 28 dias); as demais tarefas aparecem como `agenda_desligada`. **Aviso (E14): desligada por mais de 48 h, perde retratos de comentários que não voltam (cerca de 4 por dia por marco).**
- `OBS_AGENDA_TASKS_OFF`: nomes de tarefa separados por vírgula (nome exato, minúsculo; espaços e vazios ignorados). Aceitos: `leitura_horaria`, `sincronizar_canais`, `serie_semanal`, `retratos_comentarios` (E14) e `anular_identidade` (E14). Nome desconhecido é ignorado e aparece numa nota. **`anular_identidade` é `nuncaDesliga`: o nome é aceito, mas a tarefa continua ligada e a nota diz que foi ignorado.** **Aviso (E14): `retratos_comentarios` desligada por mais de 48 h perde retratos de comentários que não voltam (cerca de 4 por dia por marco).** Também pede redeploy.
- `OBS_X3_PLAYLISTS` (A5 X3): liga a tarefa `playlists_semanais` (playlists e seções dos concorrentes) SÓ com o valor exato `on` (`ON`, `1`, vazio e ausente = desligada; o vigia diz "tarefa ainda não ligada"). **Ligar só depois da migration `20261017000001` aplicada em produção** (sem ela a tarefa sai `schema_ausente`). Ligar = variável na Vercel + redeploy; ao ligar, preencher `X3_LIGADA` em `apps/web/src/lib/conferencias.ts`. Plano: `docs/superpowers/plans/2026-10-17-a5-x3-playlists-e-secoes-plan.md`.
- `OBS_WATCH_READ` (A5 S4): liga a tarefa `leitura_watch` (leitura anônima da página watch, 3 leituras por rodada) SÓ com o valor exato `on` (`ON`, `1`, vazio e ausente = desligada; o padrão é desligado). **Ligar só depois da migration `observatorio_a5_s4_leitura_watch` aplicada e do P-V aprovado, longe das 05:00 SP.** Desligar NÃO para a poda (`poda_leituras_watch` não tem `ligaCom`). Spec: `docs/superpowers/specs/2026-10-18-a5-s4-tc-coleta-design.md`.
- `AB_NATIVO_REGISTRO` (S7 fase 1): liga a tarefa `registro_teste_nativo` (registro do teste nativo do YouTube em `ab_native_tests`/`ab_native_avaliacoes`, a partir das leituras da watch) SÓ com o valor exato `on` (`ON`, `1`, vazio e ausente = desligada; o padrão é desligado; desligada = nenhuma avaliação gravada). **Ligar só depois da migration `ab_lab_s7_teste_nativo` aplicada e da S4 ligada (`OBS_WATCH_READ=on`).** Spec: `docs/superpowers/specs/2026-10-18-ab-s6-s7-guarda-e-nativo-design.md`.
- `OBS_TROCAS_CONCORRENTE` (F1a-dado T13, spec §5.8): liga o observador de trocas nos concorrentes (etapa do `registro_teste_nativo`, depois dos próprios; grava `ab_native_observados` e `ab_native_obs_cursor`) SÓ com o valor exato `on` (`ON`, `1`, vazio e ausente = desligado; o padrão é desligado: nenhuma leitura, nenhuma escrita). **Só roda se a tarefa `registro_teste_nativo` estiver ligada (`AB_NATIVO_REGISTRO=on`).** **Ligar só depois das migrations `ab_native_observados` e `ab_native_observados_registro` aplicadas em produção (as duas, nessa ordem) e por decisão do controlador.** Com a flag ligada e a migration ausente, a tarefa sai `parcial` com `observados_schema_ausente`. Falha do observador sai `parcial` com `observados_falhou`, nunca reprova os próprios. Contadores no `detalhe`: `obs_avaliados`, `obs_trocas`, `obs_falhou`, `obs_sem_tempo`, `obs_indeterminadas`, `obs_sem_publicacao`.
- `OBS_SINAIS_NICHO` (F2 T7): liga a tarefa `sinais_do_nicho` (sinais do nicho em `niche_signals`, uma passada diária por site) SÓ com o valor exato `on` (`ON`, `1`, vazio e ausente = desligada; o padrão é desligado). **Ligar só depois da migration `f2_niche_signals` aplicada em produção e do portão de precisão da T6b.** Dono: controlador do A/B Lab. Com ela desligada, `niche_signals_expirar` continua rodando no outbox.
- `OBS_MEDIDA_D2` (F2b T4): liga a tarefa `medida_d2` (fecha, por par sinal `destino` x outlier e métrica, a medida da hipótese D2 em `niche_signal_efeitos`) SÓ com o valor exato `on` (`ON`, `1`, vazio e ausente = desligada; o padrão é desligado). Lida na hora da chamada. Sem `OBS_SINAIS_NICHO=on` a tarefa devolve `d2_sem_entrada: 1`. **Setar no Vercel ANTES do push que a lê, e só com a migration `f2b_niche_signal_efeitos` aplicada em produção e a F2 com vistos > 0.** Recuo: desligar só esta variável (os sinais da F2 seguem). Dono: controlador do A/B Lab.
- `AB_PAUSA_POR_DETECTADO` (F1a-dado): `off` | `log` | `on`; padrão `off` (ausente ou valor desconhecido = `off`, comparação exata). `log` só grava `ab_pausa_detectado_log` no `audit_log` (nunca toca `status_note`). `on` só no deploy da F1a-tela-1 com o botão "Não é teste". Remover no plano da F1b (dono: controlador do A/B Lab; data: no fecho da F1b).
- `OBS_PROVA_AUSENTES` (E9): desliga SÓ com o valor `off` (sem diferenciar maiúsculas nem espaços; vazio, `0`, `false` e ausente = ligada) a prova dos ausentes e a conclusão de apagamentos do cron de concorrentes (agenda e lote antigo). Desligada, todo disparo traz a nota `prova dos ausentes desligada (OBS_PROVA_AUSENTES=off)`; a aba e as respostas da tela não têm interruptor. Variável da Vercel: só vale depois de redeploy de produção. Ver `docs/ops/observatorio-fila-sairam-runbook.md`.
- `OBS_ARQUIVO_DB_URL` (E10): URL de conexão direta (ou pooler em modo sessão, porta 5432) ao Postgres de produção para o comando `scripts/obs-arquivo.ts` (exportar, conferir, remover canal de concorrente). **De terminal do dono, NÃO da Vercel e NÃO do `.env.local`**: o comando nunca lê o `.env.local` nem imprime a URL. Runbook: `docs/ops/observatorio-arquivo-runbook.md`.
- `OBS_ARQUIVO` (manutenção M3b): liga as rotas do arquivo mensal (`/api/pipeline/archive/*`, usadas pelo copiador, pelo conferidor do B2 e pelo respondedor da forja) SÓ com o valor exato `on`. **Padrão: desligado** (ausente, vazio, `ON`, `1` e `true` desligam). Desligado, depois de chave e permissão aprovadas, a rota responde `503 arquivo_desligado` (sem chave continua `401`), o copiador fica vermelho no pulso e nada é selado. Pede novo deploy na Vercel para valer; o `on` vem **antes** de instalar o copiador. Runbook: `docs/ops/runbook-arquivo-mensal.md`.
- `OBS_ARQUIVO_LIMPEZA_CANAL` (M3b, P54): só o valor exato `on` diz "sim, o servidor sabe limpar o arquivo de canal removido"; **padrão: não**. Hoje sem efeito, porque o comando só vale junto da constante `BLOCO_CANAIS_REMOVIDOS` (`false` até o commit da M5 que traz o bloco da tela): `on` sem o bloco continua `comandoDeLimpeza = false`. Só servidor (`arquivo-mensal/capacidades.ts`); muda o texto do diálogo de remover canal.
- `OBS_ARQUIVO_LIMPEZA_CANAL_DATA` (M3b, P54): texto livre (por exemplo `02/03`), mostrado no diálogo de remover canal como a data em que o comando de limpeza fica pronto. **Padrão: nenhuma** (ausente ou vazia = `null`, e o diálogo não cita data). Não liga nada sozinha.

- `YT_OWN_META_DIETA_OFF` (A5 E18 parte 2): `1`, `true` ou `sim` desligam só o enxugamento diário de `yt_own_video_meta_daily`; a cobertura continua sendo gravada. Ausente ou vazia = ligada; valor desconhecido não desliga nada e deixa o cron vermelho. Lida a cada chamada, mas só vale com **redeploy de produção**; o desligamento imediato é o roteiro `docs/ops/sql/dieta-meta-desligar-compactacao.sql`. Enquanto desligada, o cron fica vermelho todo dia. Runbook: seção 16 de `docs/ops/youtube-coleta-canais-proprios-runbook.md`.
- `YT_OWN_STEPS_OFF`: passos da coleta do canal próprio (cron `sync-analytics-metrics`) desligados, separados por vírgula. Aceitos: `retencao`, `dimensoes`, `versoes`, `normalizadores`. Nome desconhecido não desliga nada e deixa o cron vermelho uma vez. É uma lista inteira: gravar um valor novo substitui o anterior. Passo desligado deixa o cron vermelho na 8ª execução seguida. Em produção desde 14/10/2026: `dimensoes,normalizadores` (E11 desligada até o ensaio com a API real). Só vale depois de um novo deploy. Detalhe: `docs/ops/youtube-coleta-canais-proprios-runbook.md`.
- Entrada parcial do cron `sync-analytics-metrics` (`?passos=...`, `7 0 * * *`): **não tem variável**; desligar = tirar a linha do `vercel.json`. Runbook, seção 19: `docs/ops/youtube-coleta-canais-proprios-runbook.md`.
- `OBSERVATORIO_IA_EXTERNA` (E17 degrau 2): liga o acesso direto pelo Claude Code ao Observatório SÓ com o valor exato `on`; ausente = fechado. Não abre sozinha: exige também a E19 em recusa e conferida. Vale só depois de redeploy; ausente em Preview e Development, sempre. Runbook: `docs/ops/observatorio-acesso-ia.md`.

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

