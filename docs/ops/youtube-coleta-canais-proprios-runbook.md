# Coleta dos canais próprios do YouTube — runbook (lotes L1a e L1b)

Spec: `docs/superpowers/specs/2026-10-07-coleta-canais-proprios-design.md`. Planos: `docs/superpowers/plans/2026-10-07-coleta-l1a-plan.md` e `docs/superpowers/plans/2026-10-08-coleta-l1b-plan.md`.
Ledgers: `.superpowers/sdd/2026-10-07-coleta-l1a-plan/progress.md` e `.superpowers/sdd/2026-10-08-coleta-l1b-plan/progress.md`.

Em produção desde: a data da promoção entra no ledger, não aqui.

Tudo roda dentro do cron `sync-analytics-metrics`, uma vez por dia às 12:00 UTC (09:00 em São Paulo). Não há cron novo nem variável de ambiente nova.

**Este sistema falha em verde.** Um passo sem dado termina sem erro. Ao investigar, olhe primeiro se a linha existe, depois se houve erro.

**Regra deste arquivo:** comando de leitura em produção é `npx supabase db query --linked "<SELECT … LIMIT n>"`. Todo comando que escreve em produção ou no Google tem "(você roda)" e vai um por linha, nunca encadeado.

## 1. O que a coleta guarda

| O quê | Onde fica | Volta se perder? |
|---|---|---|
| Título, thumbnail e variante de A/B no ar em cada dia, por vídeo | `yt_own_video_meta_daily` (uma linha por vídeo por dia do Pacífico) | Não |
| Relatórios em lote da Reporting API (impressões, CTR, tráfego), CSV bruto | `yt_reporting_reports` + `yt_reporting_report_blobs.csv_gz` (bytea, gzip; não é Vercel Blob) | Em parte: ver abaixo |
| Jobs da Reporting API por canal e tipo | `yt_reporting_jobs` | Sim, mas a contagem recomeça do zero |
| O que foi tentado e o que aconteceu | `yt_own_collection_attempts` | — |
| `privacy_status` e `is_short` de cada vídeo em cada dia (L1b) | colunas de `yt_own_video_meta_daily` | Não |
| Estado de autorização de cada canal (L1b) | `youtube_channels.collection_status` (`ok` ou `reautorizar`) e `authorization_verified_at` | — |
| Cada execução do cron: tempos por passo, falhas, ação do dono, resumo (L1b) | `yt_own_collection_runs` (90 dias; só service role) | — |

Tipos de relatório habilitados (`REPORT_TYPES_ENABLED`, a ordem é a prioridade de download): `channel_reach_basic_a1`, `channel_reach_combined_a1`, `channel_traffic_source_a3`, `channel_basic_a3`. Os dois primeiros são os "de alcance".

**O que se perde de vez e o que não.** Impressões e CTR de miniatura só existem a partir da criação do job: o Google guarda o histórico de cada job por 30 dias e os relatórios diários por 60. A linha diária de metadados de um dia em que o cron não rodou nunca é escrita (aparece como `dias_sem_meta`). Todo o resto pode ser buscado de novo depois.

Ainda **não** existe: a normalização do alcance, o diário por vídeo, a retenção (lotes L2 e L3).

`privacy_status` vem da `videos.list` com o token do canal dono: sem token, com a chamada falhando, ou para um vídeo que a resposta não trouxe, fica nulo. `is_short` fica nulo quando a duração é desconhecida ou quando um vídeo de 61 a 180 s ainda não teve a sonda de Shorts confirmada.

## 2. Orçamento e tetos

- Relógio global do pedido: 270 s (`maxDuration` = 300 s). Cada passo recebe `min(teto, o que resta do relógio)`.
- Tetos: metadados 30 s, jobs 20 s, relatórios 60 s. Cada chamada ao Google tem no máximo 15 s; até 4 em paralelo.
- Ordem: metadados, jobs (fase "antes"), a parte antiga (analytics por janela), relatórios e critérios (fase "depois").
- No máximo **40 downloads de relatório por execução**. Bater nesse teto é normal e **não é falha**: na primeira semana a fila inicial tem cerca de 240 relatórios de histórico, ou seja, uns 6 dias para esvaziar. `pendentes` em `coleta.relatorios` vai caindo.
- Só o **relógio** produz `nao_alcancado_orcamento`. O teto de 40 não.
- Bruto comprimido acima de 2 MB vira relatório em `erro` com `error = 'grande_demais'`.

## 3. Ler a resposta do cron

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/cron/sync-analytics-metrics
```

Rodar à mão é seguro: os passos são idempotentes no dia (a segunda execução sobrescreve e soma `attempts`). O Vercel dispara sozinho às 09:00 de São Paulo.

| Campo | O que diz |
|---|---|
| `synced`, `errors`, `emptyReports`, `skipped_no_connection`, `notifications`, `fatigueAlerts`, `errorDetails` | a parte antiga (analytics por janela), como sempre |
| `sem_autorizacao` | canais pulados pela parte antiga porque perderam a autorização do YouTube (seção 5, `reautorizar`). Não é erro |
| `ms_existente` | quanto a parte antiga levou, em ms. O relógio global é de 270 s |
| `coleta.metadados` | `gravados`, `tentativas` por resultado, `pendentes`, `day_pt`, `dias_sem_meta` por canal (chave ausente = a leitura falhou, não é zero). `sem_tempo: true` = o passo recebeu 0 s. Desde o L1b: `sem_privacidade` (linhas gravadas sem `privacy_status`) e `sem_is_short` (linhas com `is_short` nulo). **`sem_privacidade` igual a `gravados` num canal com conexão viva é falha em verde: olhe a tentativa `meta` de escopo `canal`** |
| `coleta.ms` | milissegundos de cada passo (`metadados`, `jobs`, `relatorios`). Os tetos são 30 000, 20 000 e 60 000 |
| `coleta.reautorizar` | `youtube_channels.id` dos canais em `reautorizar` |
| `coleta.autorizados`, `coleta.negados` | `youtube_channels.id` dos canais que tiveram, nesta execução, uma chamada autenticada bem-sucedida / uma negação de autorização. É com esses dois conjuntos que o cron decide, no fim, quem sai de `reautorizar` |
| `coleta.jobs` | `estados` por canal e tipo, `tipo_indisponivel`, `acao_do_dono`, `pendentes` |
| `coleta.relatorios` | `vistos`, `baixados`, `vazios`, `expirados`, `erros_download`, `bruto_apagado`, `pendentes`, `perdidos`, `atrasados` |
| `coleta.perdidos`, `coleta.atrasados` | os mesmos dois números, no nível de cima. `perdidos` = sem conserto; `atrasados` = `listado` há mais de 14 dias (esses viram falha) |
| `coleta.vazios_sem_publicacao` | nomes dos canais cujos 4 relatórios de alcance mais recentes vieram vazios e que **não publicaram nos últimos 90 dias**. É informação, **não** falha (canal sem vídeo recebe relatório só com cabeçalho todo dia). Lista vazia = ninguém nessa situação |
| `coleta.desconhecido` | nomes de canais cujo `dias_sem_meta` não pôde ser lido. Nunca é contado como zero |
| `acao_do_dono` | o que só você resolve (seção 5). **Não** deixa o cron vermelho |
| `falhas` | o que deixou o cron vermelho (seção 6). Presente só quando há falha |

A resposta não precisa mais ser guardada à mão: cada execução que chega ao veredito grava uma linha em `yt_own_collection_runs`.

```bash
npx supabase db query --linked "select ran_at, ms_total, ms_existente, ms_passos, falhas, acao_do_dono from yt_own_collection_runs order by ran_at desc limit 5"
```

Para o resumo inteiro de uma execução, troque as colunas por `resumo`. As linhas de mais de 90 dias são apagadas pelo próprio cron.

Com zero canais cadastrados a resposta traz `status: "no_channels"` e os campos de coleta mesmo assim.

O veredito é um só, no fim: `falhas` vazio grava sucesso em `cron_health`; qualquer nota grava falha, e o `/api/health` fica degradado.

## 4. Ler as tabelas

Todos os comandos são de leitura.

```bash
npx supabase db query --linked "select c.name, j.report_type_id, j.status, j.job_id is not null as tem_job, j.job_create_time, j.last_listed_at, j.error from yt_reporting_jobs j join youtube_channels c on c.id = j.channel_id order by 1, 2 limit 100"
```

```bash
npx supabase db query --linked "select c.name, r.report_type_id, r.status, count(*), min(r.create_time), max(r.create_time) from yt_reporting_reports r join youtube_channels c on c.id = r.channel_id group by 1, 2, 3 order by 1, 2, 3 limit 100"
```

Tamanho do bruto guardado (nunca faça `select *` em `yt_reporting_report_blobs`):

```bash
npx supabase db query --linked "select count(*), pg_size_pretty(coalesce(sum(octet_length(csv_gz)), 0)::bigint) as tamanho from yt_reporting_report_blobs"
```

```bash
npx supabase db query --linked "select day_pt, count(*) as linhas, count(thumbnail_dhash) as com_thumbnail, count(ab_test_id) as com_teste, count(ab_variant_id) as com_variante from yt_own_video_meta_daily group by 1 order by 1 desc limit 14"
```

```bash
npx supabase db query --linked "select attempt_day, kind, outcome, count(*), sum(attempts) as execucoes from yt_own_collection_attempts group by 1, 2, 3 order by 1 desc, 2, 3 limit 80"
```

```bash
npx supabase db query --linked "select last_success_at, last_failure_at, consecutive_failures, last_error from cron_health where cron_name = 'sync-analytics-metrics' limit 1"
```

Como ler `yt_own_collection_attempts`: sem linha = nunca tentado; linha com resultado diferente de `ok` = tentado e sem dado. `attempt_day` é a data **UTC** da execução; `day_pt` é o dia do **YouTube (Pacífico)**, nunca convertido. Nunca junte um ao outro.

| `outcome` | Significa |
|---|---|
| `ok` | gravou |
| `sem_conexao` | o canal nunca teve conexão OAuth (ou ela foi apagada sem ser revogada). Não muda o estado do canal |
| `sem_autorizacao` | o canal perdeu a autorização do YouTube e está em `reautorizar` (seção 5): a coleta por token foi pulada |
| `erro_http` | a chamada falhou. `http_status` nulo = timeout de 15 s ou erro de banco (`error` diz qual) |
| `nao_alcancado_orcamento` | o relógio acabou antes. Três tentativas seguidas no mesmo escopo viram falha. Com `kind = 'thumbnail'`: o prazo acabou no meio da captura da thumbnail; a linha do dia **foi gravada** (título e A/B), só sem os campos de thumbnail |
| `schema_ausente` | a migration não está aplicada em produção |

`kind`: `sondagem` (passo de jobs), `meta`, `thumbnail`, `relatorio`. Os outros (`diario`, `retencao_vida`) são de lotes futuros.

## 5. Ação do dono (não é falha crítica)

Estes estados **não** entram em `falhas` e não deixam o cron vermelho. Você os vê em dois lugares: no campo `acao_do_dono` da resposta (lista de textos como `<canal>: api_nao_ativada` ou `<canal>: <tipo> em sem_acesso`) e numa notificação do CMS para os admins do site (link para `/cms/youtube`). A notificação repete a cada 7 dias enquanto o problema durar, exceto `tipo_indisponivel`, que avisa uma vez só. Quando a chamada volta a passar, chega "A coleta do canal <nome> voltou ao normal." (só para `api_nao_ativada` e `sem_acesso`).

### `api_nao_ativada`
Texto do aviso: "A YouTube Reporting API não está ativada no projeto do Google. Impressões e CTR não estão sendo coletados."
A YouTube Reporting API é **separada** da YouTube Analytics API e precisa estar ativada no projeto do Google Cloud usado pelo OAuth do site.
1. Abra https://console.cloud.google.com/apis/library/youtubereporting.googleapis.com?project=63502769279 e clique em Ativar.
2. Não precisa reconectar o canal. A execução seguinte do cron cria os jobs e manda o aviso de volta ao normal.

### `sem_acesso`
Texto do aviso: "O YouTube recusou o acesso aos relatórios do canal <nome>. Impressões e CTR não estão sendo coletados."
O Google recusou o token na Reporting API (401, ou 403 `insufficientPermissions`). O escopo necessário é `https://www.googleapis.com/auth/yt-analytics.readonly`.
1. Em `/cms/youtube`, reconecte o canal.
2. A execução seguinte tenta de novo sozinha.

### `tipo_indisponivel`
Texto do aviso: "O YouTube não oferece o relatório de alcance para o canal <nome>."
O YouTube não oferece aquele tipo para o canal. Avisa uma vez. Não há o que fazer; o estado fica em `coleta.jobs.tipo_indisponivel`. Anote no ledger quais tipos faltam.
Quais tipos o canal recebe só a primeira execução responde; anote aqui: (preencher depois da primeira execução em produção).

### `<canal>: reautorizar`
Texto do aviso: "O canal <nome> perdeu a autorização do YouTube. A coleta parou. Reconecte o canal em Configurações."
O canal perdeu a autorização: token revogado, 401 da Analytics API ou da Data API, 403 por permissão insuficiente, ou "sem conexão" com uma conexão revogada desse canal. `youtube_channels.collection_status` vira `reautorizar`. Enquanto o token não funciona, a coleta por token fica parada para ele (sem `privacy_status`, sem jobs novos, sem relatórios, sem analytics por janela). O cron continua tentando todo dia: se o token renova, as chamadas são feitas, e é assim que o canal pode voltar sozinho (item 2). O passo de metadados grava a linha do dia de qualquer jeito, com o que há em `youtube_videos`. Nada é apagado. Um 401 **da Reporting API** não entra aqui: é `sem_acesso`.
1. Reconecte o canal em `/cms/social/accounts` (botão do YouTube, escolhendo a conta dona do canal). Ao voltar do Google o canal volta a `ok` na hora e o aviso é liberado.
2. Sem reconectar, o canal só volta a `ok` no fim de uma execução do cron em que teve pelo menos uma chamada autenticada bem-sucedida (`videos.list` ou Analytics API) e **nenhuma** negação de autorização; aí chega "A coleta do canal <nome> voltou ao normal." O token voltar a renovar, sozinho, não basta: evita que o estado oscile no mesmo dia quando o refresh passa e a API nega.
3. Um canal em `reautorizar` cuja conexão foi apagada continua em `reautorizar` até ser reconectado.

```bash
npx supabase db query --linked "select name, collection_status, authorization_verified_at from youtube_channels order by 1 limit 10"
```

Você recebe um aviso na entrada e um lembrete a cada 7 dias enquanto alguma chamada continuar sendo negada. No dia em que o canal volta a `ok`, `acao_do_dono` já não traz a nota dele. Enquanto o canal está em `reautorizar`, o aviso antigo "Canal do YouTube sem conexão" não é enviado para ele.

### Canal sem conexão (nunca conectado)
Canal cadastrado que nunca teve conexão OAuth (ou cuja conexão foi apagada, não revogada): é pulado nos passos que precisam de token, com tentativa `sem_conexao`. Não muda `collection_status`.
- A parte antiga manda a notificação "Canal do YouTube sem conexão" (uma por site por dia) e `skipped_no_connection` sobe na resposta.
- Se o canal tem job de alcance ativo há mais de 6 dias e nenhum relatório novo, `acao_do_dono` ganha `<canal>: sem conexão com o YouTube` (em vez de uma falha de "sem relatório novo").
- O que fazer: conecte em `/cms/social/accounts`; a execução seguinte volta a coletar.

### `<canal>: o YouTube informa N vídeo(s) e nenhum está cadastrado`
O sync de vídeos desse canal nunca gravou nada, embora o YouTube diga que o canal tem vídeos. Não é da coleta: olhe o cron `youtube-sync` e a tabela `youtube_sync_log`. Canal vazio de verdade (0 vídeos no YouTube) não gera esta nota.

## 6. Falhas críticas (`falhas`)

Cada nota vira texto em `cron_health.last_error` (juntas, até 500 caracteres) e a resposta lista todas em `falhas`. `<canal>` é só o **nome** do canal nas notas da coleta (metadados, jobs, relatórios, critérios e avisos); só as notas da parte antiga (analytics por janela) trazem `Nome (UC…)`. `<causa>` é uma frase curta derivada do tipo do erro, nunca o texto cru do Postgres: `database error`, `request timed out`, `Google token refresh failed (HTTP nnn)`, `token revoked by Google — the channel must be reconnected`, `unexpected error (NomeDoErro)`; o detalhe completo está no Sentry (tag `cron: sync-analytics-metrics`).

### Banco (valem para qualquer passo)

| Nota | Significa | O que fazer |
|---|---|---|
| `schema_ausente: youtube_channels` | o código do L1b está no ar sem a migration `20261008000002`: o cron segue rodando (parte antiga e linha de metadados do dia), mas sem estado de autorização | `npm run db:push:prod` (você roda) |
| `schema_ausente: <tabela ou função>` | o código está no ar sem a migration `20261007000006` (L1a) ou `20261008000002` (L1b: `youtube_channels`, `yt_own_collection_runs`) | `npm run db:push:prod` (você roda) |
| `registro da execução: <causa>` | a linha de `yt_own_collection_runs` não foi gravada (a execução em si rodou) | ver o Sentry; se vier com `schema_ausente`, é a migration do L1b |
| `erro de banco ao ler social_connections` | a coleta não conseguiu saber se o canal sem conexão foi revogado; o canal vira erro do passo nesse dia, sem mudar de estado | transitório; se repetir, olhe o log do Supabase |
| `metadados: <canal>: videos.list falhou (HTTP nnn \| <causa>)` | a Data API não respondeu para o canal: as linhas do dia foram gravadas, mas sem `privacy_status` | transitório; some na execução seguinte. 403 por cota: ver o painel de cotas da YouTube Data API |
| `metadados: <canal>: videos.list não devolveu nenhum dos N vídeos` | a Data API respondeu, mas sem nenhum vídeo do canal: token de outra conta, ou os vídeos cadastrados não existem mais no YouTube. As linhas do dia foram gravadas sem `privacy_status` | conferir em `/cms/social/accounts` se a conexão é a da conta dona do canal; reconectar com a conta certa |
| `metadados: <canal>: videos.list não trouxe privacy_status de nenhum dos N vídeos` | a resposta veio sem o campo de privacidade em todos os vídeos | ver o Sentry; se repetir, a API mudou e o cliente `videos-list.ts` precisa de ajuste |
| `metadados: <canal>: a captura pela videos.list não coube em 8 s` | a Data API (ou a renovação do token) demorou além do teto da captura; as linhas do dia foram gravadas, sem `privacy_status` | transitório; se repetir 3 dias, olhe `ms_passos.metadados` em `yt_own_collection_runs` |
| `canais: <causa>` | a conferência de "canal com vídeos no YouTube e nenhum cadastrado" lançou exceção | Sentry (tag `passo: canais`) |
| `metadados: privacy_status desconhecido "<valor>"` | o YouTube devolveu um valor de privacidade fora de `public`, `unlisted`, `private`; a linha foi gravada sem o campo | migration alargando o `check` de `yt_own_video_meta_daily.privacy_status` e a lista `PRIVACIDADES` em `meta-step.ts` |
| `database error listing the YouTube channels` (só em `cron_health.last_error`; a resposta é 500) | a rota não conseguiu ler `youtube_channels` nem na segunda tentativa: nenhum passo rodou, nem a linha de metadados do dia | ver o Sentry e o log do Supabase; rode o cron à mão (seção 3) assim que o banco voltar, ainda no mesmo dia |
| `critérios: não foi possível avaliar canais sem vídeos cadastrados (youtube_videos): contagem ausente` | a contagem de vídeos de um canal veio sem número | transitório; se repetir, Sentry |
| `erro de banco ao ler <onde>` / `erro de banco ao gravar <onde>` | a leitura ou a escrita foi recusada (não é tabela ausente) | ver o Sentry; costuma ser transitório. Se repetir 2 dias, olhe `cron_health` e o log do Supabase |
| `critérios: não foi possível avaliar <critério> (<tabela>)` | a leitura de um critério falhou; o cron não afirma verde sem ter olhado | resolva a nota `erro de banco …` que vem junto |
| `critérios: … leitura cortada em 1000` ou `… contagem ausente` | a leitura bateu no corte de 1000 linhas (veja "Limites conhecidos") | com poucos canais não deve acontecer; abra o Sentry |

### Metadados

| Nota | Significa | O que fazer |
|---|---|---|
| `metadados: <canal> tem X de Y vídeos com linha em <dia>` | a escrita foi recusada ou deu exceção para alguns vídeos | olhe hoje em `yt_own_collection_attempts` com `kind = 'meta'` e `outcome <> 'ok'`; rodar o cron de novo no mesmo dia completa |
| `metadados: <canal> ficou N dia(s) sem linha antes de <dia>` | o cron não rodou ou não gravou por N dias. **Esse dado não volta** | anote os dias perdidos no ledger |
| `metadados: <canal>: <causa>` | exceção ao gravar um vídeo | Sentry (extra `video`) |
| `metadados: thumbnail falhou em metade ou mais dos vídeos de <canal> por 2 dias` | `i.ytimg.com` ou o Vercel Blob fora do ar | conferir `BLOB_READ_WRITE_TOKEN`; ver `error` das tentativas `kind = 'thumbnail'` |
| `metadados: N vídeos lidos — a leitura pode estar truncada em 1000` | o passo leu 1000 vídeos ou mais e pode ter deixado vídeos de fora | com poucos vídeos não acontece; abra o Sentry (veja "Limites conhecidos") |
| `metadados: testes de A/B lidos até o limite de 1000 — a leitura pode estar truncada` | mesmo corte na leitura de `ab_tests`; nenhum vídeo ganha variante calculada com dado parcial, as colunas de A/B ficam nulas no dia | idem |
| `metadados: ciclos de A/B lidos até o limite de 1000 — a leitura pode estar truncada` | mesmo corte nos ciclos de teste A/B; as colunas de A/B ficam nulas no dia | idem |

### Jobs (passo 1A)

| Nota | Significa | O que fazer |
|---|---|---|
| `jobs: <canal>: <causa>` | exceção ao sondar ou criar jobs de um canal | Sentry (extra `canal`, `tipo`) |
| `jobs: <canal> está com o job <tipo> em erro há 3 dias` | erro persistente na Reporting API | ver `error` em `yt_reporting_jobs`; se foi `job_removido`, a execução seguinte recria sozinha |
| `jobs: <canal> não consegue baixar o relatório <tipo> há 3 dias (último erro: …)` | o job está ativo mas o download falha todo dia | ver as tentativas `kind = 'relatorio'` do escopo `job` |

### Relatórios (passo 1C e critérios)

| Nota | Significa | O que fazer |
|---|---|---|
| `relatórios: <canal> tem relatório de alcance <tipo> em erro` | relatório de alcance de até 14 dias em `erro` (`url_inesperada`, `gzip_invalido` ou `grande_demais`); não tem conserto, a nota sai sozinha em 14 dias e passa a contar em `perdidos` | ver `error` em `yt_reporting_reports`; nada a fazer |
| `relatórios: <canal> recebeu 4 relatórios <tipo> vazios seguidos` | alcance vindo sem linhas 4 vezes seguidas, **em canal que publicou nos últimos 90 dias**. Canal sem publicação nesse prazo não gera esta nota: aparece em `coleta.vazios_sem_publicacao` (o spec, seção 9, não trazia esse filtro; a divergência é deliberada) | conferir no Studio se o canal teve visualizações |
| `critérios: não foi possível avaliar vídeos recentes do canal <canal> (youtube_videos)` | a contagem de publicações dos últimos 90 dias falhou; sem ela o cron não decide se "vazios seguidos" ou "sem relatório novo" é falha | resolva a nota `erro de banco ao ler youtube_videos` que vem junto |
| `relatórios: <canal> tem relatório <tipo> expirado sem baixar` | passou do prazo (60 dias; 30 se for histórico) ou o download devolveu 404/410 | nada; sai em 14 dias e vira `perdidos` |
| `relatórios: N relatório(s) listado(s) há mais de 14 dias sem baixar` | downloads falhando ou a fila não anda | ver tentativas `relatorio` com `erro_http` |
| `relatórios: <canal> está sem relatório novo de <tipo> há mais de 6 dias` | job de alcance ativo, canal que publicou nos últimos 90 dias, sem relatório novo | ver `yt_reporting_jobs`; se preciso, recriar o job (seção 9) |
| `relatórios: listagem truncada em 50 páginas (<canal>: <tipo>)` | `reports.list` devolveu mais de 50 páginas; a marca do job não avança, a listagem recomeça no dia seguinte | nada, a menos que repita por muitos dias |
| `relatórios: <canal>: <causa>` | exceção ao listar os relatórios de um canal | Sentry |
| `relatórios: <causa>` | exceção ao baixar um relatório (extra `report`) | Sentry |

### Orçamento

| Nota | Significa | O que fazer |
|---|---|---|
| `orçamento: N escopo(s) de <kind> sem alcançar nas 3 últimas tentativas` | por três tentativas seguidas o relógio acabou antes de o escopo ser atendido (`kind` é `meta`, `thumbnail`, `sondagem` ou `relatorio`) | ver `ms_existente`; se a parte antiga cresceu, o orçamento está apertado (seção 10) |

### Avisos ao dono

| Nota | Significa | O que fazer |
|---|---|---|
| `aviso <motivo> (<canal>): sem_destinatario` | o aviso não tem para quem ir; `motivo` é `api_nao_ativada`, `sem_acesso`, `tipo_indisponivel`, `reautorizar` ou `saida` | cadastrar o dono como `org_admin` da organização do site |
| `aviso <motivo> (<canal>): falha no envio` | o carimbo ou a entrega do aviso lançou exceção | Sentry (tag `aviso`); a execução seguinte tenta de novo |

### Parte antiga e envelope

| Nota | Significa | O que fazer |
|---|---|---|
| `<Nome (UC…)>: <causa>` ou `YouTube API nnn …` | a chamada do analytics por janela de um canal falhou | Sentry; `errorDetails` repete a nota |
| `all N channel(s) returned an empty analytics report for the <N>-day window` (N = `YT_ANALYTICS_SYNC_WINDOW_DAYS`, padrão 90) | todos os canais voltaram vazios, sem erro HTTP | suspeitar de perda de escopo OAuth ou mudança na API |
| `aviso de vídeo em alta: <causa>` / `aviso de canal sem conexão: <causa>` | o aviso da parte antiga não saiu | Sentry |
| `fadiga: <causa>` | exceção no bloco de fadiga. Veja "Limites conhecidos": há um bug dormente aqui | Sentry |
| `parte existente: <causa>` | exceção não prevista na parte antiga | Sentry (fase `existente`) |
| `coleta (antes\|depois): <causa>` / `coleta: <causa>` | exceção não prevista na coleta inteira | Sentry (tag `passo: coleta`) |
| `metadados: <causa>` / `jobs: <causa>` / `relatorios: <causa>` / `orçamento: <causa>` | exceção não prevista dentro de um passo ou critério (o prefixo é o nome do passo, escrito `relatorios` sem acento e `orçamento` com) | Sentry (tag `passo`) |

## 7. Exportar um CSV do bruto para fixture (pré-requisito do L2)

O L2 só começa depois de existir um CSV **real** de cada tipo de alcance em `apps/web/test/fixtures/yt-reporting/`. O bruto está em `yt_reporting_report_blobs.csv_gz`; a leitura de bytea por `db query` sai em hexadecimal e um `python3` desfaz o hex e o gzip.

1. Escolha um relatório baixado (leitura):

```bash
npx supabase db query --linked "select report_id, report_type_id, row_count, bytes, start_time from yt_reporting_reports where status = 'baixado' and report_type_id in ('channel_reach_basic_a1', 'channel_reach_combined_a1') order by row_count desc limit 10"
```

2. Crie a pasta (você roda):

```bash
mkdir -p apps/web/test/fixtures/yt-reporting
```

3. Exporte, trocando `<REPORT_ID>` e `<TIPO>` (você roda; escreve só o arquivo local):

```bash
npx supabase db query --linked "select encode(csv_gz, 'hex') as h from yt_reporting_report_blobs where report_id = '<REPORT_ID>' limit 1" 2>/dev/null | python3 -I -c "import sys,json,gzip;s=sys.stdin.read();j=json.loads(s[s.index('{'):s.rindex('}')+1]);sys.stdout.buffer.write(gzip.decompress(bytes.fromhex(j['rows'][0]['h'])))" > apps/web/test/fixtures/yt-reporting/<TIPO>.csv
```

```bash
head -3 apps/web/test/fixtures/yt-reporting/<TIPO>.csv
```

Verificação honesta: a parte do `python3` foi testada de ponta a ponta com um hex gerado na hora (gzip de um CSV pequeno), passando por `supabase db query --linked` com um `select '<hex>'::text`, e devolveu o CSV certo. O `SELECT` sobre `yt_reporting_report_blobs` em si **não foi rodado em produção** por quem escreveu este runbook. Se `rows[0]` vier vazio, o `report_id` está errado ou o bruto já foi apagado.

Confira o cabeçalho e **anote aqui** as colunas e a unidade do CTR (0–1 ou 0–100). A primeira execução responde; anote aqui:

- `channel_reach_basic_a1`: colunas = (preencher depois da primeira execução) · unidade do CTR = (preencher depois da primeira execução)
- `channel_reach_combined_a1`: colunas = (preencher depois da primeira execução)

O CSV traz ids de vídeo e números do próprio canal; não traz dado pessoal. Pode ser commitado.

## 8. Re-normalizar um relatório

Não existe em L1a. Entra no L2, junto com o normalizador do alcance básico.

## 9. Recriar um job

**O que o passo faz sozinho.** Quando `reports.list` devolve 404 (o job não existe mais do lado do Google), a linha vira `erro` (`job_removido`). Na execução seguinte o passo de jobs lista os jobs do canal (`jobs.list`): se **não** encontra um job daquele tipo, chama `jobs.create`; se encontra, **adota** o que existe, com o mesmo `job_id`.

**Pôr a linha em `erro` à mão não recria nada.** Com o job ainda vivo no Google, a execução seguinte o encontra em `jobs.list` e o adota de novo, com o mesmo `job_id`: a linha volta a `ativo` e nada mudou. `jobs.create` só roda quando o job já não existe do lado do Google.

Para recriar de verdade é preciso **apagar o job no Google primeiro**. Só o dono; escreve no Google.

**Antes de apagar:** apagar um job descarta o histórico que o Google guarda para ele. Os relatórios ainda não baixados desse job deixam de poder ser baixados, e o job novo só tem dados a partir da criação (mais os 30 dias de histórico que o Google gera). Confira antes quantos estão por baixar (leitura):

```bash
npx supabase db query --linked "select status, count(*) from yt_reporting_reports where channel_id = '<UUID_DO_CANAL>' and report_type_id = '<TIPO>' group by 1 limit 10"
```

1. Pegue o `job_id` (leitura):

```bash
npx supabase db query --linked "select job_id, status, job_create_time from yt_reporting_jobs where channel_id = '<UUID_DO_CANAL>' and report_type_id = '<TIPO>' limit 1"
```

2. Apague o job no Google (`jobs.delete`), com um access token do canal (OAuth Playground, escopo `yt-analytics.readonly`) (você roda):

```bash
curl -X DELETE -H "Authorization: Bearer $ACCESS_TOKEN" "https://youtubereporting.googleapis.com/v1/jobs/<JOB_ID>"
```

3. Não precisa mexer no banco. Na execução seguinte do cron `reports.list` devolve 404 e a linha vira `erro` (`job_removido`); na execução depois dessa o passo de jobs cria o job novo. Para ganhar um dia, marque a linha você mesmo no SQL Editor do Supabase (você roda) — agora sim tem efeito, porque o job não existe mais no Google:

```sql
update yt_reporting_jobs set status = 'erro', error = 'recriar (manual)' where channel_id = '<UUID_DO_CANAL>' and report_type_id = '<TIPO>';
```

Um job novo começa a contar do zero: impressões e CTR anteriores à criação só existem nos 30 dias de histórico que o Google gera.

## 10. Desligar um passo ou um tipo

Não há variável de ambiente. É um commit de uma linha, seguido de deploy:

- **Um passo:** `apps/web/src/lib/youtube/coleta/index.ts`, constante `PASSOS_LIGADOS` (`metadados`, `jobs`, `relatorios`) para `false`.
- **Um tipo de relatório:** `apps/web/src/lib/youtube/reporting/types.ts`, tirar a linha de `REPORT_TYPES_ENABLED`. A partir do deploy, na execução seguinte:
  - o passo de relatórios **não lista nem baixa** mais esse tipo (ele só olha jobs `ativo` de tipos da lista);
  - o passo de jobs marca a linha desse tipo em `yt_reporting_jobs` como `desativado`, qualquer que fosse o estado dela (`ativo`, `erro`, `api_nao_ativada`…). Isso é feito só no banco, **sem token e sem chamada ao Google**, então vale também para canal sem conexão;
  - o job **continua existindo do lado do Google** e gerando relatórios lá; para parar isso também, apague-o (`jobs.delete`, seção 9);
  - os relatórios desse tipo que já estavam `listado` ficam como estão: não são baixados, não contam em `pendentes` nem em `atrasados`, e não geram nota de "listado há mais de 14 dias" nem de "expirado sem baixar". Passado o prazo (60 dias; 30 se histórico) viram `expirado_sem_baixar` e contam em `perdidos`. O que já foi baixado continua guardado;
  - religar o tipo (repor a linha na lista) faz a sondagem seguinte adotar o job que ficou no Google, com o mesmo `job_id`, e os `listado` que ainda não expiraram voltam para a fila.
- **Habilitar um tipo:** acrescentar a linha em `REPORT_TYPES_ENABLED`. A posição na lista é a prioridade de download.
- **Orçamento apertado:** os tetos estão em `apps/web/src/lib/youtube/coleta/clock.ts` (`TETOS_MS`, `RELOGIO_GLOBAL_MS`). Mexer neles exige refazer a conta com `maxDuration` da rota.

Desligar `metadados` custa caro: cada dia sem linha não volta.

## 11. Apagar a série de um canal

Passo manual, só do dono, sem volta. Antes, exporte (seção 12, passo 1). No SQL Editor do Supabase (você roda), um por vez:

```sql
delete from yt_reporting_report_blobs where report_id in (select report_id from yt_reporting_reports where channel_id = '<UUID_DO_CANAL>');
```

```sql
delete from yt_reporting_reports where channel_id = '<UUID_DO_CANAL>';
```

```sql
delete from yt_reporting_jobs where channel_id = '<UUID_DO_CANAL>';
```

```sql
delete from yt_own_video_meta_daily where channel_id = '<UUID_DO_CANAL>';
```

```sql
delete from yt_own_collection_attempts where channel_id = '<UUID_DO_CANAL>';
```

Desde o L1b o `channel_id` destas tabelas é chave estrangeira (`on delete restrict`). Remover o canal pela tela responde "Este canal tem série coletada. Apagar a série é um passo manual, descrito no runbook." enquanto houver qualquer linha aqui, **inclusive tentativas e jobs** — na prática, todo canal que passou por uma execução do cron. Para remover um canal: exporte (seção 12, passo 1), rode os cinco `delete` acima e remova pela tela em seguida. Se o cron das 09:00 rodar no meio, ele recria tentativas e jobs e a tela volta a recusar.

## 12. Rollback do L1a

Na ordem; cada comando é seu (você roda), um por linha.

1. **Exportar o que não volta** (`yt_own_video_meta_daily` e `yt_reporting_report_blobs`; o resto se reconstrói). Com a connection string de produção (Supabase Dashboard, Project Settings, Database):

```bash
psql "$PROD_DB_URL" -c "\copy (select * from yt_own_video_meta_daily) to 'yt_own_video_meta_daily.csv' csv header"
```

```bash
psql "$PROD_DB_URL" -c "\copy (select r.*, encode(b.csv_gz, 'base64') as csv_gz_b64 from yt_reporting_reports r left join yt_reporting_report_blobs b using (report_id)) to 'yt_reporting_reports.csv' csv header"
```

```bash
psql "$PROD_DB_URL" -c "\copy (select * from yt_reporting_jobs) to 'yt_reporting_jobs.csv' csv header"
```

2. **Apagar os jobs do lado do Google** (`jobs.delete`), um por job de `yt_reporting_jobs.csv`, com um access token do canal (OAuth Playground, escopo `yt-analytics.readonly`):

```bash
curl -X DELETE -H "Authorization: Bearer $ACCESS_TOKEN" "https://youtubereporting.googleapis.com/v1/jobs/<JOB_ID>"
```

3. **Reverter o código:** `git revert` dos commits de código do L1a (lista no ledger), do mais novo para o mais velho; push; promoção.

4. **Apagar as tabelas:** crie a migration com o comando abaixo, cole o SQL no arquivo gerado e aplique.

```bash
npm run db:new coleta_canais_proprios_l1a_rollback
```

```sql
drop function if exists public.yt_reporting_blobs_purge(text[]);
drop function if exists public.yt_own_attempt_record(uuid, text, text, text, text, integer, text, uuid);
drop table if exists public.yt_reporting_report_blobs;
drop table if exists public.yt_reporting_reports;
drop table if exists public.yt_reporting_jobs;
drop table if exists public.yt_own_video_meta_daily;
drop table if exists public.yt_own_collection_attempts;
```

```bash
npm run db:push:prod
```

A ordem 3 antes de 4 importa só para não ficar vermelho: se a tabela sumir com o código no ar, o cron registra `schema_ausente` e a parte antiga continua funcionando.

### Se a migration do L1b abortar por série órfã

A migration `20261008000002` para com "há série de canal que não existe mais" quando um canal foi removido pela tela enquanto o `channel_id` ainda não era chave estrangeira. Nada é apagado. Para achar os canais:

```bash
npx supabase db query --linked "select 'jobs' as onde, channel_id, count(*) from yt_reporting_jobs j where not exists (select 1 from youtube_channels c where c.id = j.channel_id) group by 2 union all select 'relatorios', channel_id, count(*) from yt_reporting_reports r where not exists (select 1 from youtube_channels c where c.id = r.channel_id) group by 2 union all select 'metadados', channel_id, count(*) from yt_own_video_meta_daily m where not exists (select 1 from youtube_channels c where c.id = m.channel_id) group by 2 limit 50"
```

Exporte (passo 1 acima), rode os `delete` da seção 11 para cada `channel_id` listado e aplique a migration de novo.

### Rollback do L1b

Só o L1b, mantendo o L1a. Na ordem:

1. **Reverter o código:** `git revert` dos commits de código do L1b (lista no ledger do L1b), do mais novo para o mais velho; push; promoção. Com o código do L1a de volta, as colunas e a tabela novas ficam sem uso e não atrapalham.
2. **Só se precisar desfazer o banco:** crie a migration com `npm run db:new coleta_l1b_rollback` e, nessa ordem dentro do arquivo: (a) recrie `youtube_channel_removal_impact` e `youtube_channel_remove` com o corpo de `supabase/migrations/20261003000007_youtube_channel_remove.sql` (copie de lá, com os `revoke`/`grant`); (b) remova as quatro constraints `yt_reporting_jobs_channel_id_fkey`, `yt_reporting_reports_channel_id_fkey`, `yt_own_video_meta_daily_channel_id_fkey` e `yt_own_collection_attempts_channel_id_fkey` com `alter table … drop constraint if exists`; (c) `drop table if exists public.yt_own_collection_runs`; (d) `alter table public.youtube_channels drop column if exists collection_status, drop column if exists authorization_verified_at`. Aplique com `npm run db:push:prod` (você roda).

## 13. Limites conhecidos

- **Morte da função pela plataforma não deixa rastro.** Se o Vercel mata a função (passou de 300 s, falta de memória), nenhum registro de saúde é escrito e o cron só é notado cerca de 12 horas depois, pela checagem de "atrasado". O relógio de 270 s existe para isso não acontecer.
- **Os critérios supõem poucos canais.** Cada leitura de critério é cortada em 1000 linhas. Acima de uns 25 canais, uma das leituras pode bater no corte e a nota vira `… leitura cortada em 1000` (falha, não verde).
- **Gzip corrompido é definitivo.** Um relatório cujo gzip não abre vira `erro` (`gzip_invalido`) e nunca é baixado de novo.
- **Bug dormente na fadiga.** `youtube_fatigue_alerts.expected_ctr` e `actual_ctr` são `numeric(6,4)` e a rota grava contagens de visualizações neles. No dia em que um vídeo "fadigar" o insert vai falhar e este cron fica vermelho (`erro de banco ao gravar youtube_fatigue_alerts`), até uma migration corrigir as colunas. Não é do L1a, mas aparece nele.
- **O critério de thumbnail só sabe quem é privado hoje.** Vídeo privado, ou ausente da `videos.list`, sai da conta de "metade ou mais" do dia; as tentativas de ontem entram todas, porque ontem não se guardou quem era privado.
- **`is_short` de vídeo de 61 a 180 s depende de uma sonda** a `youtube.com/shorts/<id>`, feita depois de todas as linhas do dia gravadas. Sem confirmação fica nulo e o vídeo é sondado de novo no dia seguinte; uma vez confirmado, não é sondado mais.
- **`authorization_verified_at` é carimbado duas vezes por dia** (passo de metadados e parte antiga), não a cada chamada. Os passos da Reporting API não o carimbam.
- **Remover um canal exige apagar a série à mão** (seção 11).
- **"Não consegue baixar há 3 dias" dispara no 4º dia.** O critério `jobs: <canal> não consegue baixar o relatório <tipo> há 3 dias` (e o de job em erro há 3 dias) roda na primeira fase, antes das tentativas de download do dia. No 3º dia de falha ele ainda só vê duas datas com tentativa; a nota aparece na execução do 4º dia.
- **Quem silenciou o domínio `youtube` nas notificações não recebe o aviso de `api_nao_ativada` / `sem_acesso` / `reautorizar`.** Uma notificação suprimida pela preferência do usuário conta como entregue: não há nota `sem_destinatario` e o cron fica verde. Nesse caso o estado só aparece em `acao_do_dono`, na resposta do cron.
