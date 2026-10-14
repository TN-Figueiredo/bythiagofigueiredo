# Fase de manutenção de dados (NAS e forja): spec, parte 01: fatos, conferências pendentes e capacidade

> Parte do spec de 13/10/2026. Índice e marcas de fato: [`00-indice.md`](00-indice.md). Arquivos de trabalho citados ficam em `.superpowers/sdd/manutencao-nas/`.
>
> **Emenda de 14/10/2026 nesta parte:** seção 6.8 (fatos novos), seção 7.5 (conferências novas), seções 8.5 (capacidade refeita com a saída por idade do vídeo) e 8.6 (alavanca registrada), e os ajustes marcados "emenda de 14/10" nas seções 8 e 8.4. **No conserto da rodada 1:** os números das seções 8.5 e 8.6 refeitos pelo engenheiro de dados (o toco fica inteiro; o registro dos anexos entrou na conta na rodada 1 e o dos resumos por canal, na rodada 2), a fórmula que o portão refaz (seção 8), a CP29 pela unidade inteira e a CP32, do item 12. **No conserto da rodada 2:** o registro dos resumos por canal e a URL de origem dos anexos entraram na fórmula (seções 8 e 8.5), e o número de capa passou de 24 para **23 canais por 5 anos** (15 por 10 fica); todos os números das seções 8.5 e 8.6 são os de `apoio/emenda/revisao_dados_r2.py`, bloco "r2 B".

## 6. Fatos conferidos (o que manda no desenho)

### 6.1 Produção

Todos **MEDIDO em 13/10/2026**, pelo dono, só com `select`; saída em `saidas/producao.txt`.

| # | Fato | Valor |
|---|---|---|
| F1 | Tamanho do banco (`pg_database_size` do banco do projeto) | **180.620.435 bytes = 172,25 MB** (1 MB = 1.048.576 bytes, a mesma conta do sinal da E10) = **34% de 500 MB**. **(M0, 14/10/2026):** o cluster só tem `postgres` (186.649.747 B = 178 MiB, medido às 15:11 UTC) e os dois templates, `template1` (7.594.511 B) e `template0` (7.520.783 B), cerca de 7,2 MiB cada; nenhum outro banco. A margem do limite perde esses ~14,5 MiB fixos, e o banco do projeto cresceu 6,0 MB desde a medida de F1 |
| F2 | Por esquema | `public` 103 MB; **`cron` 49 MB**; `pg_catalog` 17 MB; `auth` 1,8 MB; o resto abaixo de 1 MB. **(M0, 14/10/2026):** o esquema `cron` segue em ~49 MiB só por `job_run_details`; o cluster não tem outro banco além dos dois templates (F1) |
| F3 | Maiores relações | `yt_own_video_daily` 68,7 MB (93 mil linhas; é a da dieta da A5); **`cron.job_run_details` 49,4 MB, com 16 linhas estimadas**; `cron_runs` 7,3 MB (35.718 linhas); `content_pipeline` 2,8; `competitor_videos` 2,6; `competitor_video_versions` 2,1; `research_items` 1,1; `competitor_video_daily` 1,0; tudo o mais abaixo de 1 MB |
| F4 | **Achado: `cron.job_run_details` ocupa 29% do banco e quase não tem linha.** O agendamento `pgcron-run-details-retention` apaga o que tem mais de 7 dias, todo dia às 05:30; as linhas somem e o espaço não volta | É o mesmo fenômeno que justifica particionar |
| F5 | As três séries existem em produção | `competitor_video_daily`: 6.828 linhas, só outubro de 2026 (03/10 a 13/10, 701 vídeos), 1,0 MB. **`competitor_video_early` e `competitor_video_hourly`: existem e estão VAZIAS.** Também com zero linha: `competitor_video_comments`, `competitor_raw`, `competitor_readings`, `competitor_video_comment_marks`, `competitor_hour_fold_log` |
| F6 | Colunas das três séries | `competitor_video_daily (video_id uuid, snap_date date, views, likes, comments bigint, taken_at timestamptz)`; `competitor_video_early (video_id, taken_at timestamptz, site_id, views, likes, comments)`; `competitor_video_hourly (video_id, hour_slot timestamptz, taken_at timestamptz, site_id, views, likes, comments)` |
| F7 | Dependentes das três séries | Nenhuma chave estrangeira aponta para elas; nenhuma função usa `on conflict on constraint` com elas; nenhuma view as lê (três consultas, zero linhas). **As três consultas não olharam `pg_depend`** (policy de outra tabela, função `begin atomic`): a conferência é repetida com ele no dia da conversão (seção 10.2) |
| F8 | Canais de concorrente | **15, todos no ar** (fecha a dúvida "13 ou 15" dos planos) |
| F9 | Última migration aplicada | `20261013000003`. `obs_archive_batches` **não existe**: a MG6 da E10 não foi aplicada |
| F10 | Ajustes | `statement_timeout` 120 s no servidor; papel `authenticator` com 8 s e `lock_timeout` 8 s; `anon` 3 s; `service_role` sem ajuste próprio; `max_connections` 60; autovacuum com `scale_factor` 0,2 e `threshold` 50 |
| F11 | Extensões | `pg_cron` 1.6.4 instalado, com 3 agendamentos (`pgcron-run-details-retention`, `purge-old-contact-submissions`, `purge-sent-emails`). `pg_partman`, `pg_repack` e `pgstattuple` não instalados |
| F12 | Candidatas a poda | `cron_runs`: 35.718 linhas, 7,3 MB, colunas `(id, job, ran_at, status, duration_ms, items_processed, error)`. `yt_own_collection_attempts`: 693 linhas, 608 kB. `youtube_sync_log`: 1.051 linhas, 352 kB |
| F13 | Partições que já existem | `link_clicks_2026_05` a `_2026_11` mais `link_clicks_default`; `linktree_events_2026_05` a `_2026_07` mais `linktree_events_default`. Todas com RLS ligada e com `select` concedido a `anon` (quem segura é a policy). **Não há partição de `linktree_events` depois de julho** (risco adjacente, seção 19.3) |

**Uma reconciliação que os documentos da A5 deixaram aberta.** Eles citam "170,7 MB" e "179 MB" como duas medidas diferentes de 12/10. São a mesma: 178.990.227 bytes dividido por 1.048.576 dá 170,70; dividido por 1.000.000 dá 179,0 (conta minha sobre o número de bytes LIDO em `fatos-banco-inteiro.md`, seção 2). De 12/10 para 13/10 o banco foi de 178.990.227 para 180.620.435 bytes. **Essa diferença de um dia não é ritmo de crescimento:** no intervalo entraram três migrations com tabelas e índices novos. O ritmo real só existe depois de 28 dias do registro diário da E10.

### 6.2 Código e planos

| # | Fato | Fonte |
|---|---|---|
| F14 | `snap_date` é dia de São Paulo, calculado no código (`spDate`). Logo a partição mensal da série diária tem limite em data, sem fuso a declarar | LIDO: `apps/web/src/lib/youtube/competitor-sync.ts:92-94` e `:914` |
| F15 | A chave primária de cada série já contém a coluna de tempo: `(video_id, snap_date)`, `(video_id, taken_at)`, `(video_id, hour_slot)`. As três têm RLS; a da diária decide por subconsulta em `competitor_videos` e `competitor_channels`; as outras duas por `can_view_site(site_id)`. Índices secundários: `idx_cvd_date (snap_date)` e `idx_cvh_slot (hour_slot)` | LIDO: `supabase/migrations/20261003000002_observatorio_versoes.sql:31-62`; `20261012000003_observatorio_a5_e2_serie_faixas.sql:31-42`; `20261013000002_observatorio_a5_e15_leitura_horaria.sql:10-21, 71-75` |
| F16 | O carregador das telas corta a série diária em 365 dias fixos (`DAILY_MAX_DAYS`) e só marca o vídeo como `truncated` quando esse corte atinge a série. Com uma janela menor que 365 dias, a primeira saída de mês deixaria série cortada sem marca | LIDO: `apps/web/src/lib/youtube/observatorio/load.ts:119`, `:321`, `:544-549` |
| F17 | O batimento da forja é uma linha por site (`onConflict: 'site_id'`) e o claim da fila o regrava a cada consulta. Um segundo trabalhador na mesma linha apagaria as capacidades do primeiro | LIDO: `apps/web/src/lib/pipeline/services/forja-queue.ts:83-89` |
| F18 | O teto de canais no código é 75 | LIDO: `apps/web/src/lib/youtube/observatorio/rules.ts:25` (`channelLimit: 75`) |
| F19 | O plano da E10 entrega o export de canal inteiro, a pausa, o registro `obs_archive_batches` e o sinal de limite em percentual do banco inteiro. Está com 0% de código. O `exportar` de lá **recusa** lote por idade. O sinal usa a reta dos últimos 28 dias | LIDO: plano da E10, topo e seções 4.5 e 4.6 |
| F20 | A dieta de `yt_own_video_daily` (plano E6 P3, MG15) apaga cerca de 97,5% das linhas e devolve o espaço com `vacuum full`, comando do dono: de 72 MB (decimais) para menos de 2 MB. Se o `vacuum full` não rodar, a tabela continua do mesmo tamanho | LIDO: `docs/superpowers/plans/2026-10-13-a5-e6-p3-apagar-linhas-vazias-do-diario-plan.md:5`, `:72`, `:328` |
| F21 | `OBS_HOURLY_RAW_PURGE` (apagar a leitura crua por idade, desligado de fábrica) aparece no plano E16 e E15 parte 1 e nos specs 00 e 03 da A5. Não aparece em código nem em migration | LIDO: `2026-10-12-a5-e16-e15-parte-1-plan.md:294`; spec 00 linhas 124, 411, 424; spec 03 linhas 46, 198, 452, 457 |
| F22 | Formato do arquivo da E10: CSV com cabeçalho, vírgula, `\n`; nulo é campo vazio sem aspas e texto vazio é `""`; toda coluna lida como texto; sessão fixada em `UTC` e `extra_float_digits = 3`; gzip nível 9; manifesto JSON com contagem, soma, menor e maior chave, sha256 do `.gz` e do CSV, colunas e tipos | LIDO: `fatos-contrato-a5.md`, seção 3 (plano da E10, linhas 211-217, 706-729) |
| F23 | Identidade do autor de comentário (`competitor_video_comment_authors`) é **excluída** do export. O texto do comentário e o `youtube_comment_id` vão. A anulação aos 28 dias zera também `featured_channel_id` | LIDO: `fatos-lgpd-arquivo.md`, seções 0 a 2 (MG8 linhas 316 e 472; plano da E10 linhas 496 e 1504) |

### 6.3 NAS

Colado pelo dono em 13/10 e transcrito em `medidas-e-decisoes-13-10.md`, seção 3. **MEDIDO em 13/10.**

| # | Fato |
|---|---|
| F24 | TrueNAS SCALE 25.10.4. Pool `fast`: dois espelhos, 4 NVMe, 6,17 T livres. Os 5 NVMe com `SMART PASSED`. No-break configurado (`MASTER`, `nutdrv_qx`, `shutdowntimer` 30) |
| F25 | `fast/appdata` é cifrado (aes-256-gcm), `recordsize` 16K, sem quota. Filhos atuais: adguard, firefly, homarr, lidarr, navidrome, paperless, slskd, soularr, vaultwarden |
| F26 | Tarefa "appdata -> B2": `PUSH`, modo **`SYNC`** (propaga apagamento), `encryption: true`, `filename_encryption: true`, `snapshot: false`, sem exclusões, bucket `tnf-nas-backup-4x9k2`. A senha da cifra mora na configuração do TrueNAS |
| F49 | **Object Lock: desligado** no bucket `tnf-nas-backup-4x9k2` (resposta do dono, lida no painel do B2 em 13/10; `medidas-e-decisoes-13-10.md`, seção 5). O expurgo consegue apagar. **Fecho de 14/10: a regra de versões foi lida no painel:** versões anteriores por 30 dias (captura do dono); o pior caso deixou de valer. O bucket do arquivo nasce com a mesma regra |
| F27 | Snapshots: `fast/appdata` recursivo, 2 semanas (o filho herda). `fast/production`: 1 ano e 2 semanas |
| F28 | NFS: 7 exportações, restritas por `hosts`; `esteira` com `maproot root`, as demais com `mapall truenas_admin`; `media/biblioteca` é `ro` |
| F29 | Não há segundo pool: `sudo zpool import` não lista nada, e o pool `backup` das replicações não existe. **As duas cópias do arquivo são o NAS e o B2** |

### 6.4 Forja

Lido pelo agente por `ssh`, só leitura; saída em `saidas/forja.txt`. **MEDIDO em 13/10.**

| # | Fato |
|---|---|
| F30 | Python 3.12.3 no sistema e no venv do agente; `csv.QUOTE_NOTNULL` e `csv.QUOTE_STRINGS` existem (a biblioteca padrão lê CSV distinguindo nulo de texto vazio). Sem Node, sem `psql`, sem DuckDB; `docker` presente |
| F31 | Ligada desde 02/10/2026 17:54. Dez partidas desde 04/08 (uma a cada 7 dias em média; duas vezes, duas no mesmo dia) |
| F51 | O relógio da forja está em `-03` (as datas de partida em `saidas/forja.txt`, linhas 12 a 14, saem com `-03`). Uma linha de cron às 03:17 roda às 06:17 UTC |
| F32 | Precedente de serviço contínuo: `biblioteca-trabalhar.service`, `Restart=on-failure`, 30 s, nenhuma repartida desde 11/10 |
| F33 | Molde de montagem `soft`: `mnt-biblioteca-pedidos.mount` (`nfs4`, `rw,nosuid,nodev,noexec,noatime,_netdev,soft,timeo=50,retrans=2,nfsvers=4.1,nofail`, depois de `tailscale-online.target`). As outras montagens do NAS são `hard` |
| F34 | `/opt/agente` é do usuário `thiago`; 774 G livres no disco |
| F35 | Cron atual: `pulso.sh` de hora em hora; `fila_intel.py --cron` a cada 10 minutos com `timeout -k 30s 25m`; `retentar` a cada 3 minutos; uma consulta de `stats` duas vezes ao dia |
| F36 | Forja e NAS se falam direto pela rede privada (`100.89.6.27` e `100.109.2.17`), com cerca de 1 ms |

### 6.5 Fontes externas (o que foi refutado não entra)

| # | Fato | Fonte e certeza |
|---|---|---|
| F37 | Plano gratuito do Supabase: 500 MB de **tamanho de banco**; acima disso o projeto entra em modo somente leitura. O que conta é a soma de `pg_database_size` de **todos os bancos do cluster**. O WAL não conta | LIDO: `pesquisa-acesso-e-supabase.md`, itens 1.1 a 1.4 (página oficial, literal) |
| F38 | Em modo somente leitura toda escrita falha, inclusive tarefa agendada. **Soltar um mês é uma escrita:** com o banco já acima de 500 MB, a saída só roda depois do passo manual documentado pelo Supabase (`set session characteristics as transaction read write`) | LIDO: idem, itens 1.7 e 1.9 |
| F39 | Existe uma segunda restrição, por organização (Fair Use), medida pela **média diária** do tamanho no ciclo de cobrança: reduzir o banco não a levanta na hora. A duração da carência não está escrita em lugar nenhum | LIDO: idem, itens 1.10 e 1.11. **Não se sabe** se o gratuito sai sozinho do somente leitura ao cair abaixo do limite |
| F40 | O plano gratuito não tem backup. O arquivo é a única cópia do que sair do online | LIDO: idem, item 1.13 (página de preços) |
| F41 | Cloud Sync do TrueNAS com B2: a cifra é `rclone crypt`, com senha e sal; perder os dois é perder o conteúdo. O manual avisa para não ligar cifra de nome de arquivo em tarefa nova. No B2, sincronizar não remove versões antigas: elas ficam escondidas até a regra do bucket limpar | LIDO: `pesquisa-truenas-postgres.md`, item 5 (manual do TrueNAS 25.10) |
| F42 | Apagar linha não reduz `pg_database_size`: o espaço é reaproveitado, não devolvido. Soltar partição devolve na hora | **MEDIDO** pelo engenheiro de dados no banco local, com volume sintético (`revisao-direcao-dados-r1.md`, tensão b): 59,06 MB antes e 59,07 depois de apagar um mês de oito; patamar 20% acima da cópia limpa; `DETACH` e `DROP` instantâneos |
| F43 | Partição nova nasce com RLS desligada e com o privilégio padrão de `anon` | **MEDIDO** pelo engenheiro de dados no banco local (`relrowsecurity = f`, `anon_select = t`) |
| F44 | `obs_archive_uncovered()` (E10) passa a acusar cada partição como "tabela sem export" | **MEDIDO** pelo engenheiro de dados no banco local, com o SQL do Apêndice A da E10 |
| F45 | Linha da leitura de hora em hora com chave primária e índice de slot: 162 B | **MEDIDO** pelo engenheiro de dados no banco local (346.752 linhas = 54,0 MB) |

### 6.6 Fatos acrescentados na rodada 1 de revisão

Lidos pelos revisores em 13/10 e conferidos pelo redator nos arquivos citados, salvo indicação.

| # | Fato | Fonte |
|---|---|---|
| F46 | O teto de linhas por resposta da API é `max_rows = 1000` no ambiente local. O de produção não foi lido (conferência CP4). O carregador das telas já registra que leitura maior é truncada em silêncio. A primeira unidade real passa de 1.000 linhas: 701 vídeos em 15 canais são cerca de 47 por canal, vezes 29 dias, cerca de 1.350 linhas | LIDO: `supabase/config.toml:15`; `apps/web/src/lib/youtube/observatorio/load.ts:102` (este, pelo revisor de software) |
| F47 | `competitor_video_hourly` tem uma constraint `check (hour_slot = date_trunc('hour', ...))`. A conversão tem de copiá-la | LIDO: `supabase/migrations/20261013000002_observatorio_a5_e15_leitura_horaria.sql:19` |
| F48 | **Há leitores das séries além do carregador.** `competitor_hourly_health` devolve `desde = min(hour_slot)` da tabela crua, e `apps/web/src/lib/youtube/horaria/prova.ts` usa esse valor; `competitor_channel_removal_impact` conta `early` e `hourly` inteiras **e conta `daily_days` sobre a diária inteira**. Depois de uma saída, os dois mudam de valor sem erro | LIDO: a mesma migration, linhas 243 e 274 a 300; `apps/web/src/lib/youtube/horaria/prova.ts:221-260` (este, pelo revisor de software, conferido de novo na rodada 2) |
| F50 | Em `competitor_video_comments`, `parent_id` aponta para a própria tabela com `on delete cascade`. Apagar um comentário de topo apaga as respostas, mesmo as vistas em outro mês | LIDO: `supabase/migrations/20261013000003_observatorio_a5_e14_comentarios_destaque.sql:62` |
| F52 | No plano da E10, `ClienteSql` é `query(texto, valores)` e a leitura é `consultaDoArquivo`, que monta SQL em TypeScript e lê por cursor. Uma interface que recebe texto SQL não pode ser alimentada por uma função SQL pelo cliente de serviço: daí o pedido 2 mudar | LIDO: plano da E10, linhas 821 a 842 |
| F53 | Os `upsert` de hoje nas três séries usam `onConflict` por colunas: são compatíveis com tabela particionada | LIDO pelo revisor de software, conferido de novo na rodada 2: `apps/web/src/lib/youtube/competitor-sync.ts:862, 1179, 1252`; `apps/web/src/lib/youtube/horaria/gravar.ts:300`. Os caminhos não têm `observatorio/` no meio; só `load.ts` e `series.ts` moram em `apps/web/src/lib/youtube/observatorio/` |
| F54 | Partição destacada: a tabela-mãe passa a devolver zero linha do mês; a tabela destacada perde `relispartition` e **mantém** a chave estrangeira em cascata; recriar a partição do mesmo mês faz o recolocar falhar ("would overlap partition") | **MEDIDO** pelo engenheiro de dados no banco local `bythiago_int`, dentro de `begin; ... rollback;` (`revisao-spec-dados-r1.md`, achados 2 e 3) |
| F55 | **A janela tem dois registros do mesmo dia.** A fala "os 6 meses mais recentes" está em `direcao-v1.md`, gravado pela última vez às 15:24 de 13/10. A decisão 67 (c) da A5, "12 meses online", é de cerca de 16:10 do mesmo dia, dentro de um "estou de acordo com tudo" sobre uma lista de padrões. **A anotação mais recente é a de 12;** a de 6 é a única com as palavras e o motivo dele. É a pergunta 2 da seção 20 | LIDO: `direcao-v1.md`, item 2 (hora pela data de gravação do arquivo); `.superpowers/sdd/a5/decisoes-do-dono.md:133` |
| F56 | `refquota` do ZFS não conta descendentes; `quota` conta | Propriedade documentada do ZFS (citada pelo engenheiro de dados); não medida no NAS |

### 6.7 Fatos acrescentados na rodada 2 de revisão

| # | Fato | Fonte |
|---|---|---|
| F57 | **A agenda do Observatório não tem hora com minuto.** Uma tarefa só diz a partir de que hora cheia de São Paulo fica devida (`aPartirDaHoraSP`) e o período (`hora`, `faixa` ou `dia`); a agenda é chamada pelo cron de coleta dos concorrentes a cada 20 minutos (minutos 0, 20 e 40). "09:10 UTC" não existe | LIDO pelo revisor de software e conferido pelo redator: `apps/web/src/lib/youtube/agenda/tipos.ts:53-57`, `apps/web/src/lib/youtube/agenda/despachante.ts:97`, `apps/web/vercel.json:39` (`*/20 * * * *`) |
| F58 | **O número que um `DELETE` devolve não conta as linhas apagadas pela cascata.** Com a regra antiga do mês (por `first_seen_at` da linha), o `DELETE` devolvia 3 e saíam 4; marcas e identidade do autor só saem pela cascata e nunca aparecem no retorno | **MEDIDO** pelo engenheiro de dados em `bythiago_int`, com tabela de brinquedo da mesma forma, dentro de `begin; ... rollback;` (`revisao-spec-dados-r2.md`, seção 2) |
| F59 | **`obs_archive_is_site_admin` não existe em nenhuma migration.** Está definida só no plano da E10 (MG6), com a regra "administrador da organização do site ou de uma organização raiz" | LIDO pelo revisor de software; o redator conferiu por busca em `supabase/` (zero ocorrência) e no plano da E10 |
| F60 | Antes do destaque, a chave estrangeira herdada de uma partição não se remove ("cannot drop inherited constraint"); depois do destaque ela vira própria e o `drop constraint` funciona. Com um vídeo removido, a tabela destacada sem chave mantém as linhas, e recriar a chave falha por causa da linha órfã | **MEDIDO** pelo engenheiro de dados em `bythiago_int`, com tabelas de brinquedo (`revisao-spec-dados-r2.md`, seções 3 e E3) |
| F61 | **Gatilho `before delete` em `competitor_videos` e em `competitor_channels` segura todo caminho de apagamento com mês destacado:** `delete` direto no vídeo, `delete` no canal, a cascata de canal para vídeo com só o gatilho do vídeo ligado, e função `security definer` chamada como `service_role` recusam com a exceção do gatilho; a tabela destacada fica com a mesma contagem, soma e hash, sem linha órfã; recolocar recria a chave sem apagar nada; fora do destaque e depois do descarte os apagamentos funcionam. `truncate ... cascade` não dispara gatilho de linha: quem o segura é um gatilho `before truncate` por instrução | **MEDIDO** em 13/10 pelo redator em `bythiago_int`, dentro de `begin; ... rollback;` (o SQL e a saída estão em `resolucao-spec-r4.md`). **Duas conexões: MEDIDO em 13/10, na rodada 5, pelo engenheiro de dados** (`revisao-spec-dados-r5.md`), num Postgres 17.11 descartável: zero órfã em `read committed`, em todas as ordens; em `repeatable read` o gatilho não enxerga o destaque e a órfã aparece. Modos de trava MEDIDOS pelo engenheiro de software (`revisao-spec-software-r5.md`). O papel `postgres`, dono das duas tabelas e não superusuário, desliga o gatilho (`disable trigger`, `session_replication_role`), e gatilho com `tgenabled = 'R'` não dispara; `service_role` não consegue nenhum dos dois (MEDIDO no local, NÃO VERIFICADO em produção). **Ressalva:** as medidas da rodada 5 foram em tabelas de brinquedo com a mesma forma, não com as funções do spec, que ainda não existem |

### 6.8 Fatos acrescentados na emenda de 14/10/2026

Medidas de produção **MEDIDO em 13/10/2026, 23:12 UTC**, pelo dono, só com `select` (saída em `saidas/producao-onda3.txt`; as consultas M1 a M10 estão em `medidas-onda3.sh`). Os fatos de código foram LIDOS pelo engenheiro de software no `staging` (`direcao-onda3-software-r1.md`, seção 1, e `-r2.md`, seção 0); os dois de `load.ts` foram conferidos pelo redator em 13/10.

| # | Fato | Fonte |
|---|---|---|
| F62 | **1.391 vídeos de concorrente guardados; nenhum sem data de publicação.** Com mais de 1 ano de publicados: 521 (37%); mais de 2 anos: **174**; mais de 3 anos: 15. Dos de mais de 2 anos: nenhum fixado, 26 na faixa diária, nenhum fora do ar | MEDIDO (M1) |
| F63 | **(Fecho de 14/10: o canal `15db7dc5…` é um dos 5 removidos em 13/10. Sem ele, 144 vídeos elegíveis em 2 canais, e nenhum canal com `H_ef` acima de H. Recontar na M0.)** Os vídeos com mais de 2 anos estavam em **3 dos 15 canais** (88, 56 e 30). Um canal (`15db7dc5…`, 54 vídeos guardados, o mais antigo de 05/08/2022, cerca de 13 vídeos por ano) tem **26 dos seus 30 vídeos antigos entre os 50 mais recentes**: é o caso em que a coleta regravaria um vídeo retirado, e em que a regra "os mais recentes nunca saem" segura a saída. **Elegíveis na primeira leva com 24 meses: 174 menos 26, ou 148 vídeos, em 3 canais** (conta sobre o medido; as trocas salvas, que também isentam, não foram contadas: conferência CP28) | MEDIDO (M1 e M2) |
| F64 | **`video_limit` é 50 nos 15 canais** (1 em modo `full`, 14 em `recent`) | MEDIDO (M9) |
| F65 | Pela unidade por mês de publicação seriam 36 pares de canal e mês, em 3 canais. Pela unidade adotada (mês do congelamento, seção 10.8), a primeira leva são no máximo 3 canais vezes 8 tabelas: **24 unidades** | MEDIDO (M10); conta |
| F66 | Tamanho e bytes por linha: `competitor_videos` 2,76 MB (1.985 B por linha; 1,54 MB são índice, e o maior índice é o de `tags`, com 0,72 MB); `competitor_field_versions` 2,56 MB (7.895 linhas, 324 B); `competitor_raw` 2,18 MB (794 linhas, 2.744 B; bruto médio de 1.989 B); `competitor_video_versions` 2,16 MB (2.422 linhas, 2.400 correntes, 893 B); `competitor_channel_snapshots` 0,65 MB (1.252 linhas, 517 B); `competitor_video_tier_spans` 0,31 MB (1.391 linhas, 224 B); `competitor_changes` 0,24 MB (42 linhas). **Continuam vazias:** comentários, leituras da forja, retratos e marcas de comentário, mapa de horas e registro de dias somados. (`competitor_raw` estava vazia na medida da tarde, F5: a captura começou a gravar no intervalo) | MEDIDO (M3, M4, M6) |
| F67 | 807 miniaturas no Vercel Blob, 807 versões de miniatura, nenhuma sem cópia no Blob | MEDIDO (M5) |
| F68 | `cron.job_run_details` tem **51,8 MB e 3 linhas** (confirma F4); `yt_own_video_daily` 72,0 MB (96.927 linhas); `cron_runs` 7,66 MB (35.762 linhas) | MEDIDO (M7). **(M0, 14/10/2026):** `cron.job_run_details` tem 17 linhas e **51.814.400 B** (heap 46.186.496 + índices 5.578.752); 51,8 MB decimais = 49,4 MiB; `n_dead_tup` 15 |
| F69 | **Apagar a linha do vídeo faria a coleta recriá-lo em ciclo.** A sincronização preenche o canal quando a contagem de linhas fica abaixo de `video_limit` e insere, com id novo, todo vídeo da lista de uploads que não acha; e os `video_limit` mais recentes do canal são sempre da faixa diária, qualquer que seja a idade. Num canal que publica pouco, o vídeo apagado voltaria, seria lido todo dia e seria apagado de novo, tudo com desfecho "ok" | LIDO: `apps/web/src/lib/youtube/competitor-sync.ts:325-329`, `:1062-1126`; `competitor-tiers.ts:27-33` |
| F70 | **Dois defeitos de leitura que a retirada das versões acenderia.** (a) `competitor_changes.from_version_id` e `to_version_id` são `on delete set null`, e o carregador lê como **troca legada** toda linha de `competitor_changes` com `from_version_id` nulo: retiradas as versões, uma troca moderna passaria a ser lida como legada, com histórico de título fabricado. (b) Vídeo sem nenhuma versão de título ganha no carregador uma versão inventada, "igual desde a publicação": um vídeo com nove trocas no arquivo apareceria como "nunca trocou" | LIDO: `supabase/migrations/20261003000002_observatorio_versoes.sql:43-44`; `apps/web/src/lib/youtube/observatorio/load.ts:572-573` e `:298` (as duas linhas de `load.ts` conferidas pelo redator em 13/10) |
| F71 | Toda leitura (diária, semanal e a da página de uploads) regrava `last_seen_at` das versões e do bruto do vídeo. O `hash_conteudo` de uma unidade de vídeo ainda lido mudaria toda semana: sem parar a coleta antes, a unidade nunca sela | LIDO: `competitor-sync.ts:598-606`, `:1173`; `competitor-capture.ts:326-339` |
| F72 | A cascata de `competitor_videos` leva, além das séries, versões, histórico de campo, bruto, faixas, comentários e retratos: `competitor_changes` (com as trocas salvas pelo dono, `bookmarked`), `competitor_readings` (leituras da forja) e `youtube_intelligence_tasks.target_video_id` | LIDO: `20260531000008_competitor_observatory.sql:28,37`; `20261003000004_observatorio_forja.sql:16,53` |
| F73 | A ausência de um vídeo no YouTube é gravada hoje também em `competitor_field_versions` (`markMissing`) | LIDO: `apps/web/src/lib/youtube/competitor-capture.ts:383` |
| F74 | `thumb_blob_url` só existe em `competitor_video_versions`; o banco não guarda hash dos bytes da miniatura (só `thumb_etag` e `thumb_dhash`) | LIDO: `20261003000002:17`, `20261003000003:39` |
| F75 | `competitor_hour_fold_log` é por vídeo (`video_id`, `day`), com `on delete cascade`; nenhum código em `apps/web/src` a escreve ainda. `competitor_video_marks` (marcas de idade, MG4) não existe em nenhuma migration | LIDO pelo engenheiro de software: `20261013000002:61`; busca em `apps/web/src` e em `supabase/migrations` |
| F76 | Existe um leitor da série semanal do vídeo que não é acompanhado (`withUnobserved` e a taxa semanal). Para o vídeo fora da coleta essa série para no dia do congelamento; **os chamadores não foram levantados** | LIDO pelo engenheiro de software: `apps/web/src/lib/youtube/observatorio/series.ts:97-140`. É entrada do plano (seção 19.4, P21) |
| F77 | Na forja: `rclone` **ausente**; `docker`, `gpg`, `openssl`, `python3` e `curl` presentes. O `pulso.sh` já avisa um serviço de fora da casa (healthchecks.io), com uma verificação por assunto; o runbook da fila fixa período e folga por verificação | MEDIDO por `ssh`, só leitura, em 13/10 (`direcao-onda3-software-r2.md`, seção 0); LIDO: `docs/ops/forja-fila-inteligencia-runbook.md:35` |
| F78 | As montagens NFS da forja usam o endereço da rede privada (F33, F36): uma mudança de rede local não as quebra; uma chave de nó vencida na rede privada as derruba sem erro de máquina | Leitura do engenheiro de software sobre F33 e F36; a expiração da chave é a conferência CP23 |

**Não entram como fato** (refutados ou sem fonte nas verificações adversariais): que o Supabase volta sozinho do somente leitura abaixo de 95%; a duração da carência do Fair Use; que `pg_cron`, `postgres_fdw` e Wrappers tenham restrição por plano; o prazo de 1 ano de snapshot para o dataset do arquivo (vale o medido: 2 semanas em `appdata`); a janela "11:58 a 12:05 UTC" da fila de inteligência como fato único (o runbook diz 11:45; documento e código divergem).

## 7. Conferências pendentes

Tudo abaixo é **NÃO VERIFICADO**. Cada linha diz o que decide, o comando de **leitura** exato e quem roda. Nenhum comando escreve.

### 7.1 Produção (o dono roda, no Mac, em `~/Workspace/bythiagofigueiredo`)

CP1. O limite conta todos os bancos do cluster; só o banco do projeto foi medido. Decide quanto de margem a conta de capacidade precisa.

```
npx supabase db query --linked "select datname, pg_database_size(datname) as bytes from pg_database order by 2 desc;"
```

**MEDIDO em 14/10/2026 (M0, `saidas/m0-2026-10-14-1211.txt`):** `postgres` 186.649.747 B (178 MiB); `template1` 7.594.511 B e `template0` 7.520.783 B (cerca de 7,2 MB cada); nenhum outro banco no cluster. Os templates somam cerca de 14,5 MiB que contam no limite e não são do projeto.

CP2. O papel `postgres` pode reescrever `cron.job_run_details`? Decide a alavanca de 49 MB.

```
npx supabase db query --linked "select c.relowner::regrole as dono, has_table_privilege('postgres', c.oid, 'MAINTAIN') as pode_manter, has_table_privilege('postgres', c.oid, 'TRUNCATE') as pode_esvaziar, pg_has_role('postgres', 'pg_maintain', 'member') as e_pg_maintain from pg_class c where c.oid = 'cron.job_run_details'::regclass;"
```

**RESPONDIDA em 14/10/2026 (M0, `saidas/m0-2026-10-14-1211.txt`):** o dono do objeto é `supabase_admin`; `pode_manter` = t e `pode_esvaziar` = t; `postgres` não é membro de `pg_maintain` (o privilégio vem direto na tabela). A Tarefa 6 da M1 tenta `vacuum` e depois `vacuum full`.

CP3. As estatísticas da tabela estão em dia, e quanto dela é índice? Decide se um `vacuum` comum basta.

```
npx supabase db query --linked "select (select count(*) from cron.job_run_details) as linhas, (select min(end_time) from cron.job_run_details) as mais_antiga, pg_relation_size('cron.job_run_details') as heap, pg_indexes_size('cron.job_run_details') as indices, s.n_dead_tup, s.last_autovacuum, s.last_vacuum from pg_stat_all_tables s where s.schemaname = 'cron' and s.relname = 'job_run_details';"
```

**MEDIDO em 14/10/2026 (M0, `saidas/m0-2026-10-14-1211.txt`):** 17 linhas (mais antiga 07/10 05:30 UTC); heap 46.186.496 B, índices 5.578.752 B, total 51.814.400 B; `n_dead_tup` 15; último autovacuum 07/10, último vacuum 05/09. Inchaço de cerca de 49,4 MiB para 17 linhas: um `vacuum` comum não devolve, o `vacuum full` sim.

CP4. Quantas linhas a API devolve por chamada neste projeto (no ambiente local são 1.000, F46), e qual é o teto de tempo efetivo de uma função chamada pelo cliente de serviço? **Não decide mais a forma do retorno:** a função de leitura devolve uma linha só, e o teto de linhas não se aplica a ela (seção 9.3). Decide só a margem do teto de linhas por parte. (O primeiro é leitura do painel: Project Settings, API, "Max rows". O segundo:)

```
npx supabase db query --linked "select rolname, rolconfig from pg_roles where rolname in ('authenticator','service_role','authenticated');"
```

**PARCIAL (M0, 14/10/2026, `saidas/m0-2026-10-14-1211.txt`):** `authenticated` com `statement_timeout=8s`; `authenticator` com `safeupdate`, `statement_timeout=8s` e `lock_timeout=8s`; `service_role` sem configuração. **"Max rows" continua ABERTA:** o dono não anotou o valor do painel (Project Settings, API).

CP5. As chaves da forja e as permissões em uso (molde das chaves novas: três, com a emenda de 14/10).

```
npx supabase db query --linked "select name, permissions, revoked_at is null as ativa from pipeline_api_keys order by 1;"
```

**MEDIDO em 14/10/2026 (M0, `saidas/m0-2026-10-14-1211.txt`):** `cowork-permanent` [read write admin] ativa; as chaves `cowork-claude-2026-05-*` estão revogadas (lista completa na saída).

CP6. O ponto de partida da leitura de hora em hora (decide se outubro de 2026 terá mês parcial). Rodar de novo no dia da etapa M2.

```
npx supabase db query --linked "select (select min(hour_slot) from public.competitor_video_hourly) as primeira_hora, (select min(taken_at) from public.competitor_video_early) as primeira_early, (select count(*) from public.competitor_hour_fold_log) as dias_somados;"
```

**MEDIDO em 14/10/2026 (M0, `saidas/m0-2026-10-14-1211.txt`):** primeira hora em `competitor_video_hourly` em 13/10/2026 23:00 UTC; `competitor_video_early` vazia (nula); `competitor_hour_fold_log` com 0 dias somados. Rodar de novo no dia da M2.

### 7.2 NAS e B2 (o dono)

CP7. **Painel do Backblaze B2**, no navegador, bucket `tnf-nas-backup-4x9k2`: **Lifecycle Settings** (todas as versões, só a última, ou por quantos dias). O Object Lock já foi respondido: desligado (F49). É a pergunta 1 da seção 20. **Respondida em 14/10:** versões anteriores por 30 dias, no bucket atual; o do arquivo nasce igual. O item de aceite 2 fecha com a captura dessa tela.

**ABERTA em 14/10/2026 (M0):** a captura do Lifecycle Settings não foi guardada (`saidas/cp7-b2-lifecycle.png` não existe); o item de aceite 2 continua aberto até o dono salvar a captura.

CP8. A política de snapshot que o filho de `appdata` herda (confirma o prazo declarado do expurgo). No shell do TrueNAS:

```
midclt call pool.snapshottask.query | python3 -m json.tool | grep -E '"dataset"|"recursive"|"exclude"|"lifetime_value"|"lifetime_unit"|"enabled"'
```

**MEDIDO em 14/10/2026 (M0, `saidas/m0-2026-10-14-1211.txt`):** `fast/appdata` com tarefa recursiva, a cada 2 semanas, `exclude: []`; `fast/production` tem `exclude` não vazio (conteúdo não lido, fora desta fase). Lista completa dos agendamentos na saída.

CP9. Se a tarefa de cópia para o B2 atravessa datasets filhos. **Não há comando de leitura que responda com certeza:** só a restauração a partir do B2 prova (seção 13). Depois de criado o dataset, a contagem no NAS, comparada com a lista do B2 lida no Mac, ajuda:

```
find /mnt/fast/appdata/site-arquivo -type f -not -path '*/_recebendo/*' | wc -l
```

CP16. **Os datasets filhos pelo NFS: o arquivo gravado pela forja cai dentro do filho?** Decide entre o desenho com dois filhos e o plano B com diretórios comuns (seção 9.4). Só se confere no dia da M3a, depois da prova de escrita que o dono faz (seção 16.4, bloco 6). As três leituras:

```
ls -la /mnt/fast/appdata/site-arquivo/numerico/.teste-escrita
```
```
zfs list -o name,used,quota,refquota,mountpoint -r fast/appdata/site-arquivo
```
```
ssh forja 'findmnt -t nfs4 -o TARGET,SOURCE | grep arquivo'
```

A regra para cada resposta:

| Resposta | O que fazer |
|---|---|
| O arquivo de prova aparece no NAS dentro de `numerico` (e depois dentro de `texto`), e o `SOURCE` de cada montagem termina no nome do filho | Seguir com dois filhos |
| O arquivo não aparece no NAS, ou só aparece desmontando o filho | **Parar.** A forja gravou por baixo da montagem. Adotar o plano B (um dataset, diretórios comuns, uma exportação, uma sentinela) e repetir a prova |
| `refquota` aparece como `none` em um filho | Corrigir antes de seguir: sem ela o "NAS cheio" e o alarme de 80% nunca disparam |
| O `touch` da prova falha por permissão | Conferir o dono do dataset (seção 16.4, bloco 4, passo 3) e repetir |

CP19. Como a tarefa `COPY` do TrueNAS trata no B2 um arquivo que mudou no NAS (NÃO VERIFICADO; o comportamento do `rclone copy` é sobrescrever). Não muda o desenho: **o spec assume o pior caso**, que é sobrescrever, e quem protege é a regra de versões (CP7). Leitura, no Mac, depois do ensaio (a profundidade é a da árvore da seção 9.4, com a emenda do item 12: filho, classe, `canais`, canal, tabela e arquivo):

```
rclone lsf b2arq:<bucket>/<pasta> --b2-versions --max-depth 6 | head -40
```

### 7.3 Forja e Mac (na forja o agente pode ler por `ssh`; as duas marcadas "o dono roda" são dele)

CP10. A mesma exportação NFS montada duas vezes no cliente, uma `rw` e outra `ro`, é aceita? Só se confere depois de montar. Leitura para o dia da instalação:

```
ssh forja 'findmnt -t nfs4 -o TARGET,SOURCE,OPTIONS | grep arquivo'
```

CP17. O `sudo` da forja pede senha quando chamado por `ssh` sem terminal? Decide só a forma dos comandos da seção 16 (com `ssh -t` funciona nos dois casos). O dono roda; é leitura:

```
ssh forja 'sudo -n true && echo SEM-SENHA || echo PEDE-SENHA'
```

**MEDIDO em 14/10/2026 (M0, `saidas/m0-2026-10-14-1211.txt`):** `PEDE-SENHA`: o `sudo` da forja pede senha por `ssh` sem terminal; os comandos da seção 16 usam `ssh -t`.

CP18. O Mac do dono tem `docker` e `rclone`? Decide se o preparo da seção 16.7 tem mais um passo. O dono roda:

```
docker --version; rclone version | head -1
```

**MEDIDO em 14/10/2026 (M0, `saidas/m0-2026-10-14-1211.txt`):** Docker 29.8.1 no Mac; **`rclone` não instalado no Mac** (a seção 16.7 ganha o passo de instalar).

CP11. O kit instalado na forja está igual ao do repositório local do kit? (O runbook da fila tem o portão; rodar antes de instalar qualquer peça nova.)

```
cd ~/Workspace/forja/ferramentas && { (cd docs && find sitio.py trilha -type f ! -path '*__pycache__*' | sort | xargs md5 -r); (cd fase2 && md5 -r pulso_f4.py teste_pulso_fila.py); } | sed 's/ /  /' | ssh forja 'cd /opt/agente/docs && md5sum -c --quiet' && echo KIT-IGUAL
```

### 7.4 Documentação e medidas locais (o agente, na fase de plano)

| # | O que falta | Como | O que decide |
|---|---|---|---|
| CP12 | Limite de corpo de resposta de função na Vercel (lembrança: 4,5 MB) | `curl -s https://vercel.com/docs/functions/limitations.md \| grep -inE 'payload\|body\|4\.5\|maxDuration\|duration'` | O teto de 3 MB por parte de arquivo |
| CP13 | Tempo de recalcular o hash de conteúdo de um mês com 75 canais, e de soltar a partição com gravação concorrente; e quantas linhas uma chamada de leitura devolve com folga | Banco local `bythiago_int`, tabela normal (com WAL), volume sintético de 75 canais por 7 meses | **Regra:** recálculo acima de 4 s faz valer a conferência por canal em chamadas anteriores (seção 10.5). Fixa também a constante "teto de linhas por chamada" da leitura em partes (seção 9.3) |
| CP14 | Ida e volta de nulo, texto vazio, `\r`, `real[]`, `jsonb` e `bigint` pelo leitor Python 3.12.3 | Fixtures de ouro geradas pelo TypeScript, lidas no kit | Que nulo nunca vira zero no relatório |
| CP15 | Pooler em modo transação segurando `begin; set local; declare cursor` | Só se a alternativa da URL de banco na Vercel for adotada (seção 9.3) | O plano B do export |
| CP20 | Os bytes do gzip gerado na Vercel e no Mac são iguais? | Não se mede: **o spec trata como "não"**, que é o lado seguro. O que se compara entre máquinas é o sha256 do CSV sem compressão (`csv_sha256`, seção 10.4) | Nada; fica dito para ninguém comparar o `.gz` entre máquinas |

### 7.5 Conferências acrescentadas na emenda de 14/10

Tudo **NÃO VERIFICADO**. Só leitura.

CP21. **O horário da tarefa de cópia do NAS para o B2** (decide a hora do `conferir-b2`, hoje 11:07 no relógio da forja, provisória: seção 10.9; é a pergunta 17). No shell do TrueNAS, o dono:

```
midclt call cloudsync.query | python3 -m json.tool | grep -E '"description"|"minute"|"hour"|"dom"|"dow"|"enabled"'
```

CP22. **Como `fast/appdata`, que é cifrado, destrava depois de um reinício do NAS sem ninguém.** Decide se a casa volta sozinha de uma queda de energia (seção 13.6, situação B). No shell do TrueNAS, o dono:

```
zfs get -H -o name,property,value keyformat,keylocation,keystatus fast/appdata
```

`keyformat` igual a `passphrase` quer dizer que o NAS pede a senha a cada reinício: a casa fica "NAS fora" sozinha, sem erro de máquina. Com `hex` ou `raw` a chave fica guardada no TrueNAS e o dataset destrava sozinho. **Só o reinício do NAS no ensaio (seção 13.3, passo 16) prova.** É a pergunta 14.

CP23. **A chave de nó da rede privada expira?** Chave vencida derruba as montagens sem erro de máquina (F78). No painel da rede privada (clique), em cada uma das duas máquinas; e, na forja:

```
ssh forja 'tailscale status --json' | python3 -c "import json,sys; print(json.load(sys.stdin)['Self'].get('KeyExpiry'))"
```

**Fecho de 14/10: o comando foi trocado e a conferência está RESPONDIDA.** O comando anterior (`grep -m1 KeyExpiry`) pegava a primeira data da lista, que é de outro aparelho da rede privada, e não a da forja: o de agora lê `Self.KeyExpiry`, a chave da própria máquina. **MEDIDO em 14/10:** a forja e o NAS (`truenas-scale`) estão sem `KeyExpiry`, isto é, com a expiração desligada, e o dono confirmou no painel. A pergunta 13 e a linha 1 da seção 16.12 ficam respondidas.

CP24. A regra de gratuidade de saída de dados do B2 (lembrança dos dois engenheiros: até 3 vezes a média guardada por mês) e o preço acima dela. O agente lê a página de preços do Backblaze na fase de plano. Decide o orçamento de bytes por dia do `conferir-b2` (seção 10.9). **Conserto da rodada 1 (observação do engenheiro de dados):** entra na mesma conferência o tamanho das miniaturas no NAS e no B2, que **não foi medido** (a medida M5 conta 807 miniaturas, sem bytes). A 100 kB cada, 50 canais em 5 anos são da ordem de 2 GB no filho `texto` (a `refquota` é de 10 GiB) e passam a dominar a banda do `conferir-b2`, hoje estimada só sobre os CSV (130 MB por ano): ESTIMATIVA.

CP25. A versão do `rclone` no repositório do sistema da forja, e se ela decifra o formato que a tarefa do TrueNAS grava:

```
ssh forja 'apt-cache policy rclone | head -3'
```

**MEDIDO em 14/10 (fecho de 14/10; `saidas/forja-cp23-cp25-2026-10-14-0005.txt`):** o `rclone` não está instalado na forja (`Installed: (none)`); o candidato do repositório é `1.60.1+dfsg-3ubuntu0.24.04.6`. **Continua NÃO VERIFICADO** se essa versão decifra o formato que a tarefa do TrueNAS grava.

CP26. **Por onde o healthchecks.io avisa o dono** (e-mail, notificação no celular) e se o aviso chega fora da rede de casa. Painel do serviço (clique); a prova é o passo 15 do ensaio (seção 13.3).

CP27. O NAS e a forja têm, na BIOS, "ligar quando a energia voltar"? Leitura da tela de configuração de cada máquina, pelo dono. Sem isso, quem está no local liga pelo botão (seção 13.6, situação B).

**RESPONDIDA em 14/10/2026 (M0, `saidas/m0-2026-10-14-1211.txt`):** pela palavra do dono em 14/10/2026: voltam sozinhas; a BIOS não foi lida. A prova é uma queda de luz ou o passo 16 do ensaio.

CP28. **As medidas de produção que fecham a primeira leva** (o dono roda, no Mac). Elegíveis com as isenções de fixado e dos `video_limit` mais recentes, com 24 meses; o tamanho da leva por canal (a maior unidade decide se há partes); e as trocas salvas que tiram vídeo da lista:

```
npx supabase db query --linked "select count(*) as elegiveis, count(distinct competitor_channel_id) as canais, count(distinct (competitor_channel_id, date_trunc('month', published_at at time zone 'America/Sao_Paulo'))) as pares_canal_mes_publicacao, count(*) filter (where published_at is null) as sem_data from (select v.competitor_channel_id, v.published_at, v.pinned_at, row_number() over (partition by v.competitor_channel_id order by v.published_at desc nulls last) as rn, c.video_limit from public.competitor_videos v join public.competitor_channels c on c.id = v.competitor_channel_id) x where published_at < now() - interval '24 months' and rn > video_limit and pinned_at is null;"
```
```
npx supabase db query --linked "select competitor_channel_id, count(*) as congelaveis from public.competitor_videos v where published_at < date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '24 months' and pinned_at is null group by 1 order by 2 desc;"
```
```
npx supabase db query --linked "select count(distinct g.video_id) as videos_com_troca_salva from public.competitor_changes g join public.competitor_videos v on v.id = g.video_id where g.bookmarked and v.published_at < now() - interval '24 months';"
```

A primeira é a consulta do engenheiro de dados (`direcao-onda3-dados-r2.md`, seção 2.6), com a sintaxe validada no banco local e o intervalo trocado de 1 ano para 24 meses; as outras duas são do engenheiro de software (`direcao-onda3-software-r2.md`, seção 8), com o mesmo ajuste, e **não foram rodadas em lugar nenhum**: o plano as valida em `bythiago_int` antes de entregar ao dono. Repetir, 28 dias depois de a captura e a leitura de hora em hora gravarem, as medidas M3 e M4 (tamanho por linha das tabelas da classe) e a M7 (resto do site): é o item de aceite 12, que passa a incluí-las.

CP29. Medidas locais do agente, no banco `bythiago_int`, antes da migration: o custo do gatilho de `insert` da seção 10.8 (2.000 vídeos, carga concorrente) e o tempo de uma chamada da retirada de uma unidade cheia (100 vídeos, com as linhas deles nas 8 tabelas, em uma transação), abaixo de 4 s: metade do teto de 8 s (F10). Se não couber em 4 s, o teto de vídeos da unidade baixa antes da migration; a retirada continua inteira, numa transação só (seção 10.8).

CP30. O disco da forja é cifrado? Pesa no risco de a chave da cifra do B2 morar lá (seção 11.1). O agente lê:

```
ssh forja 'lsblk -o NAME,TYPE,FSTYPE,MOUNTPOINT | grep -i crypt || echo SEM-CIFRA'
```

CP31. **Qual é o cofre de senhas do dono, e ele se lê sem o NAS?** **(Fecho de 14/10: virou a pergunta 18 da seção 20, com padrão.)** Entre os aplicativos do NAS há um `vaultwarden` (F25). Se o cofre em que a senha e o sal da cifra são guardados for esse, a perda do NAS leva o cofre junto, e a cópia offline passa a ser a única guarda fora da casa. Conferência do dono (não há comando): onde está cada uma das duas guardas e se ele alcança ao menos uma de longe. **Achado do redator em 14/10, sem lastro nos pareceres;** entra na lista de antes de partir (seção 16.12). **Conserto da rodada 1:** os dois engenheiros o confirmaram e lhe deram dente: passou a ser condição da M3a, antes de gerar a chave (seções 9.4 e 15.1), e o ensaio é feito com a rede privada desligada no Mac (itens de aceite 107 e 154). **Fecho de 14/10 (pergunta 18 respondida):** o cofre é esse, e a cópia offline ainda não existe. A segunda guarda deixa de ser condição da M3a e passa a ser condição do passo 17 do ensaio e do primeiro descarte real (seção 9.4).

CP32. **(Item 12.) A chave `archive_b2` lista versões de objeto no B2, e o que a listagem devolve sem essa capacidade (erro ou vazio)? E o painel do B2 apaga todas as versões de uma pasta, ou só as esconde?** Decide a forma do passo do dono na limpeza de um canal removido (seção 11.3). A prova de ausência não depende da resposta: ela exige o controle positivo da mesma listagem. O dono confere no painel do B2 (clique: "App Keys", as capacidades da chave da forja) e, depois da M3a, o agente lê:

```
ssh forja 'rclone lsf b2arq:<bucket>/<pasta>/numerico/_canario --b2-versions | head -3'
```

Na mesma conferência: a franquia diária de transações de classe C do B2, e quanto a tarefa de cópia do NAS e o `conferir-b2` já gastam dela (cada pasta listada é uma transação; a árvore com o canal acima da tabela soma cerca de um quarto às pastas). **NÃO VERIFICADO** por nenhum dos dois engenheiros.

## 8. Capacidade: o que cabe em 500 MB, sem plano pago

**Tudo nesta seção é ESTIMATIVA, salvo o que está marcado MEDIDO.** O tamanho por canal vem das estimativas do spec da A5 (seção 9.6) e da conta do engenheiro de dados, porque as tabelas que mais pesam (leitura de hora em hora, primeiras horas, comentários) estão vazias em produção. A conta é refeita com medida real 28 dias depois de a leitura de hora em hora começar a gravar, ou em 15/12/2026 (item de aceite 12), e de novo no portão de 01/03/2027 (item 112).

**Emenda de 14/10: qual conta vale.** As seções 8.1 a 8.4 são a conta do texto que teve acordo em 13/10, **sem** a saída por idade do vídeo, e ficam como estão: são a linha de partida e a referência do que cada alavanca vale. **O número que vale para planejar passou a ser o da seção 8.5**, que refaz as parcelas e acrescenta a classe `video_antigo` com 24 meses (decisão D15). Onde as duas diferem, a 8.5 diz em quanto e por quê. **A fórmula que os itens de aceite 12 e 112 refazem é a da seção 8.5.** A da seção 8.1 fica como histórico do acordo de 13/10 e não é mais refeita; as linhas de alavanca das seções 8.3 e 8.4 foram calculadas com ela e valem como ordem de grandeza até o portão.

**O que o item 12 acrescenta, e entrou na fórmula na rodada 2.** `obs_archive_summaries` (o registro do resumo por canal, seção 10.4) ganha uma linha por (classe, canal, mês, versão) e nunca é podada: 36 linhas por canal por ano nas três classes mensais, desde o primeiro mês (cerca de 0,02 MB por canal por ano, a 0,5 kB por linha com índice), e 12 na classe `video_antigo`, depois de H (cerca de 0,01, a 0,9 kB). ESTIMATIVA do engenheiro de dados. **Ela tira um canal dos 5 anos (de 24 para 23):** o 24 tinha 1,9 MB de margem em 425. O 24 não volta por encolher a linha: com a URL de origem dos anexos na conta, só voltaria com a linha do resumo em cerca de 165 B (sem a URL, em cerca de 340 B), e a chave primária e o cabeçalho da linha sozinhos passam de 100 B. O 23 aguenta linhas de até cerca de 2,5 kB (5 vezes a estimativa; a da `video_antigo`, 4,5 kB), com o pico do banco a 424,9 MB contra os 425: ali já não há folga. O item de aceite 12 mede. Os números das seções 8.5 e 8.6 são os de `apoio/emenda/revisao_dados_r2.py`, bloco "r2 B" (saída em `saida-revisao-dados-r2.txt`).

### 8.1 O modelo, com as parcelas e a fórmula

Mês 0 é outubro de 2026. Tamanhos em MB de 1.048.576 bytes.

| Parcela | Valor | Marca |
|---|---|---|
| Banco hoje | 172,25 | MEDIDO (F1) |
| Dieta de `yt_own_video_daily` com `vacuum full` (A5) | menos 66,7 | ESTIMATIVA: 68,7 medidos menos os 2 que sobram (F20) |
| `cron.job_run_details` reescrita | menos 49,0 | ESTIMATIVA: 49,4 medidos menos o que sobra de 7 dias de linhas. **(M0, 14/10/2026):** 49,4 MiB confirmados para 17 linhas (51.814.400 B); `pode_manter` = t, então a M1 tenta `vacuum full` |
| **Base depois das duas recuperações** | **56,5** | conta |
| Peças fixas desta fase, em regime | mais 17 | ESTIMATIVA: patamar de 90 dias de `yt_own_collection_attempts` (cerca de 8); teto da tabela de resultados de relatório (8); partições vazias (1) |
| Resto do site, por ano | mais 17; ou mais 8 depois da dieta de `yt_own_video_meta_daily` (MG17, A5) | ESTIMATIVA do spec da A5: 22, menos 14 de `cron_runs` com a poda, mais 9 da `meta_daily` sem dieta. **(M0, 14/10/2026) taxa real de `cron_runs`:** 35.928 linhas desde 17/04/2026 até 14/10/2026 = 180 dias; 35.928 / 180 = **199,6 linhas/dia** (cerca de 72.800 por ano; antes, F3: 35.718 linhas). Com 7.692.288 B para 35.928 linhas, cerca de 214 B por linha, são ~14,9 MiB por ano sem poda: a parcela "menos 14" fica de pé. Com a poda de 90 dias o patamar é de ~18.000 linhas (3,7 MiB). Antes da M1: 19.939 linhas com mais de 90 dias |
| Por canal, o que **nunca sai** do online | 1,73 por ano, para sempre | ESTIMATIVA: 1,7 do spec da A5 (9.5), mais **0,03 do registro do arquivo**, que cresce com os canais e não tem poda (`obs_archive_units`: 6 linhas por canal por mês, cerca de 450 B por linha; com 75 canais, 2,3 MB por ano) |
| Por canal, série diária e primeiras horas | 3,65 por ano, mais 0,8 por ano de idade (a leitura semanal cobre um catálogo que cresce) | ESTIMATIVA (conta do engenheiro de dados; linha de 156 B MEDIDA) |
| Por canal, leitura de hora em hora crua | 5,4 por ano | ESTIMATIVA: 33.288 linhas por ano a 162 B (linha MEDIDA no banco local) |
| Por canal, texto (comentários, marcas de comentário, bruto não corrente) | 2,05 por ano | ESTIMATIVA (spec 9.5) |
| Entrada de canais | 15 hoje, subindo em linha reta até N em 12 meses, depois constante | suposição, a partir da fala do dono |

**A fórmula, escrita para a conta ser refeita igual em 01/03/2027.** Com `a` a idade do canal em anos e `m` o mês desde outubro de 2026:

```
canal(a) = 1,73·a                                   o que nunca sai
         + S(a)                                     série: integral de (3,65 + 0,8·x) dx, de max(0, a − 7/12) até a
         + 5,4 · min(a, 4/12)                       leitura horária: 4 meses online no pico
         + 1,2 · 2,05 · min(a, 7/12)                texto: 7 meses online, com 20% de espaço morto

banco(m) = 56,5 + 17 + 8·m/12                       base, peças fixas, resto do site
         + 15 · canal(m/12)                         os 15 canais (medido em 13/10 às 20:12; 5 foram removidos depois, contagem nova não lida)
         + soma, para k de 1 até min(m, 12), de (N − 15)/12 · canal((m − k)/12)
```

Convenção de entrada: o lote de canais que entra no mês `k` tem idade zero no fim do mês `k`. **"Cabem N canais por X anos"** quer dizer: N é o maior número para o qual `banco(m)` não passa do teto em **nenhum** mês de 0 a 12·X. O teto é 475 MB (95%) ou 425 MB (85%).

**Online por canal, com a fase inteira no ar**, no fim do primeiro ano: série 2,5 MB, texto 1,4 MB (sai por apagamento e não por partição), leitura horária 1,8 MB, mais 1,7 do que nunca sai. Por idade do canal:

| Idade do canal | Sem a fase (nada sai) | Só as três séries no arquivo | Fase inteira (séries e texto) | Fase inteira, **sem leitura horária e sem comentários** |
|---|---|---|---|---|
| 1 ano | 13,2 MB | 8,0 MB | 7,4 MB | 4,2 MB |
| 2 anos | 27,3 MB | 12,3 MB | 9,6 MB | 6,4 MB |
| 3 anos | 42,1 MB | 16,5 MB | 11,8 MB | 8,6 MB |
| 5 anos | 74,2 MB | 25,0 MB | 16,2 MB | 13,0 MB |

A fase corta o custo de um canal de 3 anos de 42 para cerca de 12 MB. Ela não zera o crescimento: sobra cerca de 2,2 MB por canal por ano (o que nunca sai, mais o catálogo da leitura semanal).

### 8.2 Quantos canais cabem, e por quanto tempo

*(Conta sem a saída por idade do vídeo. Com ela: seção 8.5.)*

Cenário de referência: as duas recuperações de espaço, as duas podas, as três séries e o texto no arquivo, e a dieta da `meta_daily`. São todas alavancas que não tiram nada das telas.

| Canais (chegando lá em 12 meses) | Passa de 70% | Passa de 85% | Passa de 100% | Leitura |
|---|---|---|---|---|
| 15 | setembro de 2031 | julho de 2033 | maio de 2035 | Cabe com folga |
| 25 | maio de 2029 | julho de 2030 | setembro de 2031 | Cabe por quase 4 anos sem vermelho |
| 30 | setembro de 2028 | setembro de 2029 | setembro de 2030 | Cabe por quase 3 anos sem vermelho |
| 40 | janeiro de 2028 | agosto de 2028 | maio de 2029 | Vermelho em menos de 2 anos |
| **50** | outubro de 2027 | **fevereiro de 2028** | **agosto de 2028** | **Não se sustenta: 16 meses até o vermelho, 22 até o limite** |
| **75** | julho de 2027 | **setembro de 2027** | **novembro de 2027** | **Não cabe: no mês em que chega a 75 o banco está em 475 de 500 MB (95%)** |

**O número que cabe, em duas colunas.** As duas valem, e querem dizer coisas diferentes:

| Por quanto tempo | Sem passar de **85%** (425 MB): operar sem vermelho | Sem passar de **95%** (475 MB): o teto físico, com 25 MB de margem |
|---|---|---|
| 1 ano | **64** | 74 |
| 2 anos | **37** | 43 |
| 3 anos | **29** | 33 |
| 5 anos | **19** | 22 |

**Por que a coluna de 85% é a que vale para planejar.** Em 85% o sinal fica vermelho; o vermelho desarma o automático (seção 12.4); e a restrição de uso justo, que é por média do ciclo, pede "ficar abaixo de 85% como regra" (risco R12). "43 canais por 2 anos" é operar boa parte do segundo ano no vermelho. A coluna de 95% diz só até onde o banco aguenta antes de entrar em modo somente leitura. **A recomendação da pergunta 5 usa a de 85%: planejar até 37 canais para 2 anos.**

**A faixa de erro.** O custo por canal é estimativa, com três tabelas vazias em produção. Se o custo real for 30% maior ou menor:

| Custo por canal | Cabem por 1 / 2 / 3 / 5 anos, a 85% | Cabem por 1 / 2 / 3 / 5 anos, a 95% |
|---|---|---|
| 30% acima da estimativa | 47 / 28 / 22 / menos de 15 (nem os 15 (medido em 13/10 às 20:12; 5 foram removidos depois, contagem nova não lida) cabem por 5 anos; o modelo parte de 15 canais e não calcula abaixo disso) | 55 / 33 / 25 / 17 |
| A estimativa | 64 / 37 / 29 / 19 | 74 / 43 / 33 / 22 |
| 30% abaixo | 95 / 54 / 42 / 28 | 110 / 63 / 49 / 33 |

Com o custo 30% acima, 50 canais passam de 85% em outubro de 2027 e do limite em dezembro de 2027; 75 passam do limite em setembro de 2027.

**Resposta direta ao dono.**

- **50 canais** ficam vermelhos em fevereiro de 2028 e passam do limite em agosto de 2028. Com as três alavancas que tiram dado das telas (seção 8.4, linhas 8 a 10, a 10 como ela é: só a janela das séries em 4 meses): vermelho em agosto de 2028, limite em maio de 2029. Se a subida for mais lenta (50 canais em 24 meses, não em 12): vermelho em agosto de 2028, limite em janeiro de 2029.
- **75 canais** não cabem com as alavancas que mantêm a coleta inteira: com as alavancas 8, 9 e 10, o limite chega em março de 2028. **Só cabem por 2 anos somando duas alavancas que tiram dado: coletar menos por canal (alavanca 11) e a janela das séries em 4 meses (alavanca 10).** Só com a 11 (todos os canais sem leitura de hora em hora e sem comentários) cabem 70 por 2 anos no limite físico e 61 sem o aviso vermelho: menos de 75 (linha 9 da seção 8.3). Com a 11 e a 10 juntas cabem 82 por 2 anos a 95% (e 71 a 85%); as alavancas 8 e 9 não mudam esse número (a 8 só rende depois do segundo ano, e a 9 não tem o que cortar num canal sem leitura de hora em hora).
- O motivo não é a janela. Só o que nunca sai, com 75 canais, soma 130 MB por ano.

**O que mudou em relação às contas anteriores.**

- **Em relação à direção** (15 canais não cruzam em 72 meses; 25 em setembro de 2030; 50 em março de 2028; 75 em setembro de 2027; cabem 27 por 3 anos e 17 por 5): a base passou a ser a medida, com 49 MB a recuperar que ninguém conhecia; entraram 17 MB fixos das peças desta fase e 20% de espaço morto nas famílias que saem por apagamento; e a dieta da `meta_daily` foi contada.
- **Em relação à primeira versão deste texto** (72 / 43 / 34 / 23, e 489 MB no mês em que se chega a 75): duas coisas. (1) A primeira versão não tinha a fórmula escrita, e os números 72 e 489 não são reproduzíveis com ela: ficam entre as duas convenções de entrada de canal (com idade zero no fim do mês de entrada, que é a fórmula acima, dá 75 no primeiro ano e 474 MB; com um mês inteiro de idade daria 68 e 511). O engenheiro de dados refez a conta de forma independente e obteve 75 / 43 / 34 / 23 e 474 MB; a fórmula acima reproduz exatamente esses números. (2) Depois disso entrou a parcela do registro do arquivo (0,03 MB por canal por ano, pedida pelo mesmo revisor), que leva o resultado a **74 / 43 / 33 / 22** e a 475 MB. É esse o número deste texto.
- A conclusão não mudou em nenhuma das três contas: 50 e 75 canais não se sustentam com a coleta inteira.

### 8.3 O que cada peça vale: do pior ao melhor caso

| # | Situação | Cabem por 1 / 2 / 3 / 5 anos, a 85% | Idem, a 95% | 50 canais passam do limite em | 75 canais passam do limite em |
|---|---|---|---|---|---|
| 0 | Sem a fase (nada sai, sem podas), com a dieta | 26 / 7 / 3 / 0 | 34 / 9 / 5 / 1 | setembro de 2027 | agosto de 2027 |
| 1 | Fase só com as três séries, dieta e podas | 50 / 23 / 15 / 8 | 60 / 28 / 18 / 10 | janeiro de 2028 | outubro de 2027 |
| 2 | Mais a recuperação de `cron.job_run_details` | 60 / 28 / 18 / 10 | 71 / 33 / 22 / 12 | março de 2028 | novembro de 2027 |
| 3 | Mais o texto no arquivo (onda 2) | 62 / 35 / 26 / 16 | 73 / 41 / 31 / 19 | junho de 2028 | novembro de 2027 |
| 4 | Mais a dieta da `meta_daily` (**cenário de referência**) | **64 / 37 / 29 / 19** | **74 / 43 / 33 / 22** | **agosto de 2028** | **novembro de 2027** |
| 5 | Mais versões e bruto corrente saindo aos 24 meses | 64 / 37 / 30 / 22 | 74 / 43 / 35 / 25 | agosto de 2028 | novembro de 2027 |
| 6 | Mais leitura horária com 1 mês fechado | 75 / 42 / 33 / 23 | 87 / 48 / 38 / 27 | dezembro de 2028 | janeiro de 2028 |
| 7 | Mais janela das séries com 4 meses fechados (**alavanca 10 como a seção 8.4 a define: o texto continua em 6**). Refeita na rodada 3. Se a janela do texto também caísse para 4, o que não é alavanca desta lista, daria 88 / 49 / 38 / 26, 101 / 57 / 44 / 31, agosto de 2029 e abril de 2028 | 82 / 46 / 36 / 26 | 96 / 54 / 42 / 30 | maio de 2029 | março de 2028 |
| 8 | Referência (linha 4), com **metade dos canais** sem leitura horária e sem comentários | 87 / 46 / 34 / 21 | 102 / 53 / 39 / 25 | abril de 2029 | março de 2028 |
| 9 | Referência (linha 4), com **todos os canais** sem leitura horária e sem comentários | 135 / 61 / 41 / 24 | 157 / 70 / 48 / 29 | dezembro de 2029 | novembro de 2028 |

Sem a onda 2 (linhas 1 e 2), nem os 15 canais (medido em 13/10 às 20:12; 5 foram removidos depois, contagem nova não lida) cabem em 5 anos: é por isso que ela deixa de ser opcional (seção 4, linha 7).

### 8.4 As alavancas dentro do gratuito

Rendimento medido a partir do cenário de referência, salvo indicação. "Canais" é quantos a mais cabem por 3 anos, a 95%.

| # | Alavanca | Rende em MB | Rende em canais | Custo e o que alguma tela perde | Quem decide |
|---|---|---|---|---|---|
| 1 | **Recuperar `cron.job_run_details`** (reescrever a tabela) | 49, de uma vez | 4 | Nada nas telas. É um comando do dono, numa janela de segundos, fora das 05:30 e 06:00 UTC. Depende da conferência CP2. **Emenda de 14/10:** se o banco recusar a reescrita, o dono aceita esvaziar a tabela (decisão D20); a medida de 13/10 à noite achou 51,8 MB com 3 linhas (F68) | Entra na etapa M1 |
| 2 | **Dieta de `yt_own_video_daily` com `vacuum full`** (A5, já planejada) | 67, de uma vez | 6 (sem ela cabem 27 por 3 anos, não 33) | Nada; já é da A5. Sem o `vacuum full` a dieta não rende um byte | Já decidido; esta fase depende dela |
| 3 | **Poda de `cron_runs`** (90 dias) | 14 por ano | 4 | Nada: a tela do hub lê as execuções recentes (e hoje lê colunas com outro nome: seção 19.3) | Entra na M1 |
| 4 | **Poda de `yt_own_collection_attempts`** (90 dias) | cerca de 22 por ano | 5 | Nada: é estado de execução; o vigia do canal próprio olha o recente | Entra na M1 |
| 5 | **Texto no arquivo aos 7 meses** (comentários, marcas de comentário, bruto não corrente) | 2,05 por canal por ano; com 30 canais, 125 MB em 3 anos | 9, e é o que faz caber por 5 anos | **O texto dos comentários de destaque com mais de 7 meses deixa de poder ser lido no site** (mockup 20): o cartão passa a dizer "o texto está no arquivo e não aparece aqui" (seção 14.1). O marco mais tardio de leitura é aos 30 dias | Entra como etapa certa, por clique |
| 6 | **Dieta de `yt_own_video_meta_daily`** (MG17, A5) | 9 por ano | 2 | Nada; já é da A5 | Já planejado |
| 7 | **Teto de canais** | Cada canal que não entra poupa 7,4 MB no primeiro ano e 9,6 em dois. Remover um canal com export devolve o espaço dele para os que ficam (reaproveitado, não devolvido ao sistema) | 1 por canal | O canal sai das comparações | O dono (pergunta 5) |
| 8 | **Versões de título, miniatura e descrição e o bruto corrente saindo aos 24 meses** (hoje "nunca saem"). **Emenda de 14/10: deixou de ser alavanca de reserva. O dono mandou construir (D15), com mais tabelas e por vídeo: é a classe `video_antigo` da seção 10.8, e o rendimento certo é o da seção 8.5** | cerca de 0,6 por canal por ano depois do segundo ano (suposição minha: metade dessas duas parcelas) | 2 em 3 anos; 3 em 5 anos | **O Histórico do vídeo perde as versões com mais de 24 meses:** uma troca de título antiga aparece como "no arquivo" e a medida de mudança (M5) deixa de cobrir trocas antigas | O dono (pergunta 6) |
| 9 | **Leitura horária crua com 1 mês fechado, não 3** | 0,9 por canal; 68 MB com 75 canais | 3 | **Há telas que leem a leitura crua além do mês em curso** (pelas notas dos mockups): as 72 primeiras horas de cada vídeo, no 13 e no 15, e os períodos de 3, 6 e 12 meses do 21. Com 1 mês fechado, as 72 horas de todo vídeo com mais de cerca de 2 meses passam a "no arquivo", e o 21 só mostra o mês atual e o anterior. Perde-se também a possibilidade de refazer o mapa de um mês com mais de 30 dias sem restaurar do arquivo. Muda a decisão D3 | O dono (pergunta 6) |
| 10 | **Janela das séries com 4 meses fechados, não 6** | 0,9 por canal de cerca de 3 anos (0,67 no primeiro ano); 65 MB com 75 canais (51 no primeiro ano) | 3 (33 para 36; seriam 5 só com a janela do texto também em 4 meses, que não é esta alavanca) | **A medida M2 (vídeos publicados nos últimos 180 dias) perde a base, e as telas de 180 dias (mockups 15, 17a e 17c) quebram:** com 6 meses a folga já é de 1 dia; com 4, vídeos de 4 a 6 meses ficam "não medido". Muda a decisão D2 e só se aplica depois de passar por esses três mockups (seção 14.1) | O dono (pergunta 6) |
| 11 | **Coletar menos por canal:** um canal sem leitura de hora em hora e sem comentários | Custa 4,2 MB no primeiro ano e 6,4 em dois, contra 7,4 e 9,6: poupa 3,2 MB por canal | Com metade dos canais nesse modo, 6 a mais (39 por 3 anos); com todos, 15 a mais (48). É a alavanca que mais muda a resposta dos 75 | **É dado que não se coleta e não volta:** o canal fica sem as 72 primeiras horas, sem o ritmo por hora e sem comentários de destaque. Contraria a orientação do dono de coletar mais do que usa; está aqui, em número, para ele recusar ou aceitar por escrito | O dono (pergunta 6) |

**Descartado, e por quê: um segundo projeto gratuito do Supabase.** A restrição de uso justo soma os projetos da organização (`pesquisa-acesso-e-supabase.md`, item 1.10); seriam dois bancos para o mesmo limite, com duas migrations e duas políticas (decisão J da seção 9.3).

**A folga se nada puder sair** (casa fora do ar desde hoje, com as recuperações e as podas feitas, e nenhum mês saindo). A conta usa a fórmula da seção 8.1 sem as saídas e **sem os 20% de espaço morto do texto**, porque nada é apagado. A última coluna conta os meses a partir de janeiro de 2027, o mês da viagem; como a primeira saída real é em 01/02/2027, "a casa cai em janeiro e não volta" é o mesmo cenário.

| Canais | Passa de 70% | Passa de 85% | Passa de 100% | Meses de casa desligada até o vermelho (85%), contados de janeiro de 2027 |
|---|---|---|---|---|
| 15 | fevereiro de 2028 | julho de 2028 | novembro de 2028 | **18** |
| 25 | novembro de 2027 | janeiro de 2028 | abril de 2028 | **12** |
| 30 | outubro de 2027 | dezembro de 2027 | fevereiro de 2028 | 11 |
| 50 | agosto de 2027 | setembro de 2027 | novembro de 2027 | **8** |
| 75 | junho de 2027 | agosto de 2027 | setembro de 2027 | 7 |

Com os 15 canais (medido em 13/10 às 20:12; 5 foram removidos depois, contagem nova não lida) há um ano e meio de folga depois da viagem. Com 50, oito meses; com 75, sete. Por isso "não acrescentar canal com a casa fora" é a primeira coisa a fazer (seção 13.6, que diz o que acontece com a casa desligada, passo a passo). Se a casa cair mais tarde, a folga é maior: os meses anteriores já terão saído.

**Faixa de erro da folga** (ESTIMATIVA, mesma fórmula; meses até o vermelho com 15, 25 e 50 canais): com o custo por canal 30% acima, **13, 10 e 7**; sem a recuperação dos 49 MB (se nem a reescrita nem o esvaziamento da tabela forem aceitos pelo banco: decisão D20), 15, 11 e 7; os dois juntos, 11, 8 e 6.

**Portão de capacidade (sem plano pago).** Em 01/03/2027 contar os canais e refazer a tabela da seção 8.5, pela fórmula dela, com as medidas reais (item de aceite 112; emenda de 14/10; com o horizonte efetivo de cada canal, medido), e é nesse portão, ou antes de o 26º canal entrar, que a alavanca da seção 8.6 vira spec próprio. Se a projeção passar de 85% em menos de 12 meses, a tela de limite lista, nesta ordem: o que já pode sair agora (meses com a cadeia verde), as alavancas 8 a 11 com quanto cada uma rende, e quantos canais teriam de sair. A decisão é sempre do dono.

**Se o sinal ficar vermelho e a casa estiver fora do ar** (a cadeia não fecha e nada pode sair): não há alavanca automática e não há caminho de saída sem a casa. A seção 13.6 diz o que acontece e o que fazer: não acrescentar canal, pausar a coleta de canais se for preciso (a pausa é o `pausar` da E10: sem a E10 em produção, não existe), e religar a casa. Remover canal com export também pede a confirmação do NAS. Este impasse é risco aberto (seção 19.2, R2), com a folga em números acima.

### 8.5 Capacidade refeita com a saída por idade do vídeo (emenda de 14/10; H = 24 meses)

**Tudo ESTIMATIVA.** O dono decidiu, em 13/10 à noite, que o vídeo de concorrente com mais de 24 meses de publicado sai do online com o que é dele (seção 10.8). Esta seção refaz a conta com isso. O programa é `.superpowers/sdd/manutencao-nas/apoio/emenda/capacidade_emenda.py` (saída ao lado, em `saida-capacidade.txt`), escrito sobre a forma fechada do engenheiro de dados (`apoio/onda3/dois_niveis.py`). **Ele reproduz primeiro a tabela da seção 8.2, com os parâmetros da seção 8.1 (64 / 37 / 29 / 19 a 85% e 74 / 43 / 33 / 22 a 95%), e só depois aplica a emenda.** **Conserto da rodada 1:** os números desta seção e da 8.6 são os que o engenheiro de dados refez na revisão da emenda, com a linha do vídeo inteira e o registro dos anexos de miniatura na conta (`apoio/emenda/revisao_dados_r1.py`, saída em `saida-revisao-dados-r1.txt`, bloco "TOCO INTEIRO + registro de anexos depois de H"). **Rodada 2:** os números passaram a incluir o registro dos resumos por canal e a URL de origem no registro dos anexos (`apoio/emenda/revisao_dados_r2.py`, bloco "r2 B"). O redator copiou os números; não rodou o programa.

**As parcelas, refeitas de baixo para cima** pelo engenheiro de dados (`direcao-onda3-dados-r1.md`, seção 2.b), com 103 vídeos novos por canal por ano (MEDIDO na A5, seção 9.6) e os bytes por linha de F66 onde há linha em produção:

| Parcela, em MB por canal por ano | Na seção 8.1 | Aqui | Por quê |
|---|---|---|---|
| O que é do vídeo e hoje "nunca sai" (versões, histórico de campo, bruto corrente, dias somados, retratos de comentário, faixas, trocas, marcas de idade) | dentro de 1,73 | **1,405**, mais **0,195** da linha do vídeo | O registro de dias somados pesa 0,17 (a seção 10.3 dizia 0,07); o histórico de campo, 0,35; e `competitor_changes` (0,05) não estava em conta nenhuma |
| O que é do canal e não sai (canal por dia 0,18; mapa de horas 0,25; registro do arquivo; linha do canal) | dentro de 1,73 | **0,48**; **0,53** com a classe nova (o registro passa de 0,03 a 0,08, com as 8 tabelas dela) | conta |
| Texto (comentários, marcas de comentário, bruto não corrente) | 2,05 | **1,53** | O bruto estava contado duas vezes: o corrente já está na primeira linha; só o não corrente (0,27) sai pela classe `texto` |
| Série diária e primeiras horas; leitura de hora em hora | 3,65 mais 0,8 por ano de idade; 5,4 | iguais | n/a |

As duas correções quase se anulam na soma (3,78 contra 3,61), mas mudam a composição: mais peso no que não tinha saída. **Com as parcelas refeitas e sem a classe nova** a tabela da seção 8.2 seria 65 / 36 / 27 / 17 a 85% e 76 / 42 / 32 / 21 a 95%: a que tinha acordo estava de 1 a 2 canais otimista em 3 e em 5 anos.

**A fórmula com a classe nova** (as três linhas que mudam em relação à da seção 8.1; `H` em anos, aqui 2):

```
nunca sai  = 0,59·a                                        do canal (0,53), as marcas de idade (0,04) e o registro dos resumos das três classes mensais (0,02, ESTIMATIVA)
           + min(1,365·a ; 1,2 · 1,365 · (H_ef + 2/12))    do vídeo: sai H meses depois da publicação, mais 2 meses até selar; 20% de espaço morto
           + 0,255 · max(0, a − H_ef)                      a linha do vídeo, inteira (0,195); o registro dos anexos de miniatura, com a URL de origem (0,05); e o registro dos resumos da classe video_antigo (0,01). Os dois últimos, ESTIMATIVA
série      = integral de (3,65 + 0,8 · min(x, H_ef + 1/12)) dx, de max(0, a − 7/12) até a
texto      = 1,2 · 1,53 · min(a, 7/12)

H_ef       = max(H ; video_limit ÷ vídeos publicados por ano)
```

**O horizonte efetivo (`H_ef`), e por que ele entra.** Os `video_limit` vídeos mais recentes de um canal nunca saem (seção 10.8). O que fica online é o maior entre "os vídeos publicados em H" e "os `video_limit` mais recentes". A primeira conta do engenheiro de dados não tinha essa regra, e ele a corrigiu na rodada 2 (`direcao-onda3-dados-r2.md`, seção 5.2). Com as medidas:

- `video_limit` é 50 nos 15 canais (MEDIDO, F64). No ritmo médio (103 vídeos por ano) 50 vídeos são 6 meses: **com H = 24 meses, `H_ef` é igual a H no canal médio**, e a tabela abaixo não muda por causa dele. Só passa de H o canal que publica menos de 25 vídeos por ano: era **1 dos 15** (F63, cerca de 13 por ano, `H_ef` de quase 4 anos), e esse canal foi um dos removidos em 13/10 (fecho de 14/10): pela medida de 13/10, hoje nenhum.
- Esse canal lento custa **menos** que a média nessa parcela (guarda 50 vídeos, contra 206 do canal médio: cerca de 0,8 MB contra 3,5), mas a saída por idade quase não libera nada nele: 4 dos 30 vídeos antigos são elegíveis.
- **O que faria `H_ef` pesar:** subir o `video_limit` de um canal (com 200, o canal médio guarda 1,9 ano de vídeo, ainda abaixo de 24 meses; com H = 12 já passaria) ou baixar H para 12 meses. Por isso a tela do canal mostra o horizonte efetivo, não só H (seção 14.10), e mexer em `video_limit` passa a ser decisão de capacidade.
- O modelo usa o ritmo médio (103 vídeos por ano, medido na A5 sobre os canais de então) para todos. Um canal que publica o dobro custa cerca do dobro nas parcelas do vídeo, da série semanal, da leitura de hora em hora e do texto: o que vale para o total é a média do conjunto, e a dos canais que ainda vão entrar é desconhecida. É uma das razões da faixa de 30%, e o portão de 01/03/2027 mede o ritmo por canal.

**Custo online de um canal, por idade** (coleta inteira; MB):

| Idade do canal | Sem a classe nova (parcelas refeitas) | Com a classe, H = 24 meses |
|---|---|---|
| 1 ano | 7,4 | 7,3 |
| 2 anos | 10,0 | 9,7 |
| 3 anos | 12,5 | 11,5 |
| 5 anos | 17,6 | 13,2 |
| 10 anos | 30,3 | 17,5 |

Depois dos 24 meses o canal segue crescendo **0,85 MB por ano** (canal por dia 0,18; mapa de horas 0,25; linha do vídeo 0,195; registro do arquivo 0,08; registro dos anexos 0,05; marcas 0,04; registro dos resumos 0,03; linha do canal 0,02), contra cerca de 2,5 sem a classe. **A capacidade não fica plana:** com 50 canais são cerca de 42 MB por ano, mais o resto do site.

**Quantos canais cabem** (chegando lá em 12 meses; coleta inteira; janelas de hoje):

| Por quanto tempo | Sem passar de **85%** (operar sem vermelho) | Sem passar de **95%** (teto físico) | Antes da emenda (seção 8.2), a 85% |
|---|---|---|---|
| 1 ano | **66** | 77 | 64 |
| 2 anos | **37** | 43 | 37 |
| 3 anos | **29** | 33 | 29 |
| 5 anos | **23** | 27 | 19 |
| 10 anos | **15** | 18 | menos de 15 |

| Canais | Passa de 70% | Passa de 85% | Passa de 100% | Antes da emenda: 85% e 100% |
|---|---|---|---|---|
| 15 | setembro de 2033 | abril de 2037 | dezembro de 2040 | julho de 2033 e maio de 2035 |
| 25 | abril de 2029 | abril de 2031 | novembro de 2033 | julho de 2030 e setembro de 2031 |
| 30 | setembro de 2028 | setembro de 2029 | setembro de 2031 | setembro de 2029 e setembro de 2030 |
| 40 | janeiro de 2028 | agosto de 2028 | maio de 2029 | agosto de 2028 e maio de 2029 |
| **50** | outubro de 2027 | **fevereiro de 2028** | **agosto de 2028** | iguais |
| **75** | julho de 2027 | **setembro de 2027** | **novembro de 2027** | setembro e novembro de 2027 |

**A frase sem enfeite.**

- **A saída por idade do vídeo não aumenta quantos canais cabem nos dois primeiros anos.** Ela só age sobre vídeo com mais de 24 meses: até outubro de 2028 a conta é a mesma, e **50 canais continuam ficando vermelhos em fevereiro de 2028 e passando do limite em agosto de 2028; 75 continuam passando do limite em novembro de 2027** (no mês em que se chega a 75 o banco está em 465 de 500 MB).
- **O que ela faz é frear a queda, não pará-la** (a tabela continua caindo: 37, 29, 23, 15): por 5 anos cabem **23** canais sem vermelho (eram 19), e passa a existir número para 10 anos (**15**). Com os 15 canais (medido em 13/10 às 20:12; 5 foram removidos depois, contagem nova não lida) o vermelho vai de 2033 para 2037. **O 23 é ESTIMATIVA** (rodada 2: com `obs_archive_summaries` e a URL de origem dos anexos na conta); o 24 não volta por a linha de `obs_archive_summaries` medir menos (seção 8), e o item de aceite 12 mede.
- **Com a coleta inteira, nenhuma política dá 50 canais por 5 anos, e nenhuma dá 75.** Baixar H para 12 meses (o dono pode, mais tarde: seção 10.8) leva os 5 anos de 23 para 27, não para 50. Para 50 só sobram as alavancas que tiram dado (seção 8.4, linhas 9 a 11) e a da seção 8.6.

**A faixa de erro** (custo por canal 30% acima ou abaixo; mesma fórmula):

| Custo por canal | Cabem por 1 / 2 / 3 / 5 / 10 anos, a 85% | Idem, a 95% |
|---|---|---|
| 30% acima | 48 / 28 / 22 / 18 / menos de 15 | 57 / 32 / 25 / 21 / menos de 15 |
| A estimativa | 66 / 37 / 29 / 23 / 15 | 77 / 43 / 33 / 27 / 18 |
| 30% abaixo | 98 / 54 / 42 / 34 / 22 | 114 / 63 / 49 / 39 / 26 |

Com o custo 30% acima, 50 canais passam de 85% em outubro de 2027 e do limite em janeiro de 2028; 75 passam do limite em setembro de 2027. **Várias das tabelas que mais pesam continuam vazias ou quase em produção** (F5, F66): a conta é refeita com a medida real no item de aceite 12 e no portão de 01/03/2027.

**Três sensibilidades, para a revisão.** (1) Com H = 12 meses: 66 / 39 / 34 / 27 / 17 a 85% e 77 / 45 / 40 / 32 / 20 a 95%. (2) Se o toco fosse emagrecido (0,06 no lugar de 0,195; não construído: P29): 66 / 37 / 29 / 24 / 16 a 85% e 77 / 43 / 34 / 28 / 19 a 95%; ganha um canal em 5 anos e um em 10. (3) As marcas de idade online (e não na classe, como o engenheiro de dados propunha) tiram um canal em 5 anos a 85% (23 contra 24 com H = 24; 27 contra 28 com H = 12), um em 3 anos a 95% com H = 24 (33 contra 34) e um em 10 anos a 95% com H = 12 (20 contra 21); nos demais horizontes não mudam nada. É menos que a faixa de erro, e por isso a decisão fica (marcas online, mockup 17b sem mudança). A cláusula que a reabre está na seção 10.8.

**A primeira leva libera quase nada, e isso é esperado.** 144 vídeos elegíveis (fecho de 14/10: eram 148, e um dos canais foi removido em 13/10; F63) a cerca de 8,5 kB cada (ESTIMATIVA do engenheiro de dados) são perto de 1,2 MB, reaproveitados e não devolvidos: o tamanho medido do banco **não cai**, para de subir nessa parcela. O ganho de 2026 é a coleta parar de reler o catálogo velho: cerca de 1,2 MB por ano com os 148 vídeos de hoje (148 vezes 52 leituras semanais vezes 156 B, ESTIMATIVA), e mais a cada vídeo que envelhece.

**O que a emenda não muda:** a folga com a casa desligada (tabela da seção 8.4 e seção 13.6: 18, 12 e 8 meses). Refeita na revisão da emenda (`apoio/emenda/revisao_dados_r1.py`): sem saída, um canal acumula 12,71 MB por ano nesta fórmula e 12,83 na da seção 8.1, mais 0,8 por ano de idade nas duas; a tabela daria 18, 13 e 8 meses. Fica a de 18, 12 e 8, que é o lado seguro.

### 8.6 Alavanca registrada, não construída: profundidade de coleta diferente por canal

**Nada desta seção é construído nesta fase.** O dono pediu a conta em 13/10 e, em 14/10, disse o que quer: "Como meu nicho é viagem eu preciso ver o que muitos criadores estão fazendo. Posso copiar apenas uma coisa de um canal que não parece principal e ser meu melhor resultado. Então precisamos focar no nicho e não especificamente em canais." Logo o que ele quer é **cobertura larga do nicho**, e a pergunta "quais canais são os principais" não lhe é feita. O que fica registrado é quanto a cobertura larga custa, e o que ela perde.

**As duas profundidades da conta** (`capacidade-dois-niveis.md`, do engenheiro de dados; ESTIMATIVA, refeita em `capacidade_emenda.py` com as marcas de idade online):

- **Coleta inteira:** tudo o que este spec e a A5 descrevem.
- **Coleta leve:** views por dia, versões de título e de miniatura, canal por dia, marcas de idade, e as primeiras horas na cadência da sincronização (não hora a hora). **Sem** leitura de hora em hora, **sem** comentários, sem histórico de campo e sem bruto. Custa cerca de 48% da inteira: 6,4 MB por canal em 5 anos, contra 13,2 (H = 24).

**Quantos canais cabem, sem o aviso vermelho (85%) e, depois da barra, no teto físico (95%):**

| Composição | H | 2 anos | 3 anos | 5 anos | 10 anos |
|---|---|---|---|---|---|
| Todos na coleta inteira | 24 meses | 37 / 43 | 29 / 33 | **23** / 27 | 15 / 18 |
| Todos na coleta inteira | 12 meses | 39 / 45 | 34 / 40 | **27** / 32 | 17 / 20 |
| Todos na coleta leve | 24 meses | 93 / 107 | 67 / 78 | **50** / 58 | 29 / 34 |
| Todos na coleta leve | 12 meses | 95 / 110 | 78 / 90 | **57** / 67 | 32 / 38 |
| Misto: 15 na inteira, o resto na leve (total) | 24 meses | 69 / 83 | 47 / 58 | **33** / 41 | 16 / 21 |
| Misto: 15 na inteira, o resto na leve (total) | 12 meses | 73 / 88 | 59 / 71 | **41** / 50 | 19 / 25 |
| Misto: 10 na inteira, o resto na leve (total) | 24 meses | 77 / 91 | 54 / 64 | **39** / 47 | 20 / 26 |
| Misto: 10 na inteira, o resto na leve (total) | 12 meses | 81 / 95 | 65 / 77 | **46** / 56 | 23 / 29 |

**Faixa de erro** (5 anos, 85%; custo por canal 30% acima / a estimativa / 30% abaixo): todos na inteira, H = 24: 18 / 23 / 34; todos na leve, H = 24: 38 / 50 / 72; 15 na inteira mais a leve, H = 24: total de 21 / 33 / 55; com H = 12, na mesma ordem: 21 / 27 / 40; 44 / 57 / 82; 27 / 41 / 66. **A faixa de erro é maior que a diferença entre as opções.**

**Leitura sem enfeite.** 50 canais por 5 anos sem vermelho só existem com quase todos na coleta leve: com H = 24, no máximo 0 na inteira; com H = 12, no máximo 7. **75 por 5 anos não existem em nenhuma composição** (o máximo é 50 com H = 24 e 57 com H = 12, todos na leve); por 3 anos, só com H = 12 e no máximo 2 na inteira. A cota da API do YouTube não é o limite em nenhuma composição (até cerca de 14% da cota diária, ESTIMATIVA).

**O que a coleta leve perde** (dado que a origem não devolve): o mapa das horas em que o público reage e a comparação de janelas (mockup 21 inteiro); a curva hora a hora das primeiras 72 horas e "metade das views em N horas" (mockups 13 e 15); os comentários de destaque, a resposta do criador e o peso do comentário de topo (mockup 20); e a lista de mudanças de tags, categoria, duração, capítulos e descrição. **Promover um canal não traz o passado de volta.** Toda medida que a coleta leve não tem diria "não coletado nesta profundidade", nunca zero.

**Hipótese a avaliar no spec futuro, e que é interpretação do redator, não decisão do dono:** a profundidade seguir o **vídeo** que se destaca, e não o canal. Todo canal entraria na coleta leve, e a leitura de hora em hora e os comentários seriam ligados para o vídeo que passa de um limiar nas primeiras leituras, de qualquer canal. É o que a frase dele descreve ("copiar apenas uma coisa de um canal que não parece principal"). **Não foi calculada nem desenhada:** as primeiras horas de um vídeo, que são o dado que a origem expira, já teriam passado quando o destaque aparecesse, e isso precisa de número antes de virar proposta.

**Gatilho.** Spec próprio **antes de o 26º canal entrar, ou no portão de capacidade de 01/03/2027, o que vier primeiro**, com a medida real por linha (item de aceite 12). Até lá o teto de planejamento é o da seção 8.5: 23 canais sem vermelho em 5 anos, 37 em 2.
