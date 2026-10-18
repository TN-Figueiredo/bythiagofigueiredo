# Spec S8: gravação por variante e dia, placar com alcance da A5 e regra nova de duração

Escrito em 18/10/2026 (1º rascunho, Opus); r2 em 18/10 (conserto da r1 de Phil e Yannis). Fatia S8 do plano conjunto
(`.superpowers/sdd/ab-lab/2026-10-18-nativo-vs-nosso/plano-conjunto.md`, §1, §2, §4, §9).
Revisão: Phil e Yannis no fim (portão G4). Só documento: nenhum código, nenhuma migration criada.

**Ajuste do dono (18/10):** a coleta vem primeiro. A S8 tem quatro fases. A F1 só grava. As outras
três leem o que a F1 gravou.

| Fase | O que faz | Toca avaliação ou placar? | Vai ao ar |
|---|---|---|---|
| **F1. Gravação** | carimbo da regra no teste, retrato diário por teste e dia, sonda horária da miniatura | não | **antes do E8** (seção 2.5) |
| F2. Falha em verde (G3) | impressão nula vira "não medido", nunca `p = 1` | sim (estatística e placar) | depois do E8 (G0) |
| F3. Placar | impressões e CTR da A5 na tela, por variante | sim (placar) | depois do E8, depois da F2 |
| F4. Regra v2 | piso 8/12 dias, volume, teto 14, "inconclusivo por volume" | sim (avaliação) | depois do E8, depois da F3 |

---

## 1. Fatos conferidos no código (18/10, árvore `bythiago-ab-p4a`, base `7bd60eb98`)

1. **Alcance.** `yt_own_video_reach_daily` (migration `20261009000001`): PK `(youtube_video_id, day_pt)`;
   `thumbnail_impressions bigint` e `thumbnail_ctr numeric` (0 a 1), os dois anuláveis;
   `source_report_id`, `report_create_time`. Gravado por `lib/youtube/coleta/alcance-step.ts` a partir do
   relatório `channel_reach_basic_a1`. CTR que não veio fica fora do payload (nulo).
2. **Relatório vazio não grava linha.** `alcance-step.ts:22` conta "vazios" e não chama o banco. O
   relatório fica em `yt_reporting_reports` com `status = 'vazio'` e `normalized_at` preenchido. Logo:
   *sem linha* pode ser "zero impressões" (relatório do dia normalizado) ou "ainda não chegou" (sem
   relatório). Só `yt_reporting_reports` separa os dois.
3. **Variante do dia.** `yt_own_video_meta_daily` (migration `20261007000006`): `ab_test_id`,
   `ab_variant_id`, `seconds_on_air_analytics`, `seconds_other_analytics`, `seconds_on_air_reporting`,
   `seconds_other_reporting`, sem FK para o teste (sobrevive a teste apagado). Calculado por
   `coleta/ab-seconds.ts` a partir de `ab_test_cycles.started_at/ended_at` (hora em que o servidor gravou,
   não a hora em que o YouTube passou a mostrar). Gravado uma vez por dia (`meta-step.ts`, ~12:00 UTC),
   para o dia de ontem.
4. **Dia de teste A/B nunca sai da dieta** da `meta_daily` (plano da E18 parte 2, regra 8, emenda D-I-2).
5. **Fronteira do dia.** `day-pt.ts`: `boundsAnalytics` = dia do Pacífico com horário de verão (23, 24 ou
   25 h); `boundsReporting` = UTC-8 fixo. Mas o spec do A/B honesto (§6) **mediu em 09/10** que o dia do
   relatório de alcance começa às 07:00 UTC no verão: o par `_reporting` está 1 h deslocado até 01/11, e o
   par certo para cruzar com o alcance é o `_analytics`.
6. **Rotação.** `ab-rotate` às `0 8 * * *` UTC (`apps/web/vercel.json:20`); ABBA em `ab-rotation.ts`
   (2 variantes `[0,1,1,0]`, 3 variantes `[0,1,2,2,1,0]`). Atraso do cron até 84 min (spec honesto 4.2.2).
   Miniatura leva até ~3 h para assentar (parecer do Phil, não medido).
7. **Falha em verde hoje.** `ab-lab/queries.ts:211` soma `cycle.impressions ?? 0`; `:218` dá `avg_ctr = 0`;
   `ab-statistics.ts:13` devolve `pValue: 1, significant: false` com impressão zero. `ab-gates.ts` usa 1.000
   impressões, 7 dias e `variantCount * 7` ciclos. Desde a P2 nenhum gate tem chamador na rota.
8. **Avaliação hoje.** `ab-evaluate-phases.ts:88-91`: dias = `floor((agora - started_at) / 86 400 000)`,
   em milissegundos, contando pausa. Só encerra por `max_duration_days` (padrão 14; schema 7 a 28) com
   `settleOnAir(original, 'duracao_maxima')`.
9. **Onde nasce um teste.** Três inserts: `createAbTest` (`ab-lab/actions.ts:216`), lote
   (`actions.ts:1319`, `config: {}`) e o playoff em SQL (`20260529000001_playoff_mode.sql:80`, desligado
   desde a P2). `completed_reason` tem CHECK fechado (`20260531000007`).
10. **Mudança de horário.** Conferido com `Intl` (America/Los_Angeles): o dia 01/11/2026 vai de 07:00 UTC
    de 01/11 a 08:00 UTC de 02/11, ou seja, **25 h**. O Brasil não tem horário de verão. Do dia 02/11 em
    diante a meia-noite do Pacífico é 08:00 UTC, a mesma hora da rotação.

---

## 2. F1: gravação (começa o quanto antes)

Objetivo: guardar, por teste, variante e dia, tudo o que o placar e a regra futuros vão precisar, e
principalmente o que **não dá para reconstruir depois**.

### 2.1 O que expira ou não se reconstrói (ordem de prioridade)

| # | Dado | Por que se perde | Quem grava |
|---|---|---|---|
| R3 | Instante em que a miniatura nova **de fato** aparece no CDN | Só existe na hora; nada no YouTube guarda | F1 (sonda, 2.4) |
| R1 | Versão da regra com que o teste foi criado | Só se sabe na criação (G2) | F1 (coluna, 2.2) |
| R2 | Atribuição dia → variante, alcance e views lidos naquele dia | Ciclos somem com o teste (cascade); relatório pode ser reescrito; leitor de 3 tabelas muda de regra | F1 (retrato, 2.3) |
| — | Relatório bruto de alcance | A Reporting API guarda o relatório por tempo limitado | já é da A5: o blob é guardado sem prazo (E20/MG13), **mas** `yt_reporting_blobs_purge` apaga o bruto 90 dias após `normalized_at`; depois disso o retrato é a única cópia do número usado na decisão |
| — | Views por hora do vídeo próprio | `yt_own_public_video_hourly`: sem poda nem partição com descarte (E15 parte 1); poda futura só por migration da A5, com aviso | nada a fazer na S8 (A5, 18/10) |

O alcance diário e o diário de views já são gravados pela A5 e não dependem da S8. O risco deles é a
coleta atrasar além da janela da origem; o alerta da A5 ("relatório listado há mais de 14 dias") cobre.
A `guarda.ts` da A5 confere a cada execução `baixados_sem_bruto`, `perdas_reconhecidas` e `expirado_sem_baixar`.

### 2.2 R1: carimbo da regra no teste

- Coluna nova `ab_tests.regra_duracao text not null default 'v1' check (regra_duracao in ('v1','v2'))`.
- A migration grava `'v1'` em todo teste existente (o default faz isso; o T19 fica `v1`).
- Na F1 **nenhum código escreve a coluna**: todo teste criado até o deploy da F4 nasce `v1`. A F4 passa a
  escrever `'v2'` nos três caminhos de criação (fato 9). Assim o G2 vale sozinho: "regra nova só para
  teste criado depois do deploy da regra".
- A mesma migration acrescenta `'regra_v2'` aos **dois** CHECKs (usado só pela F4): `ab_tests_completed_reason_check`
  (reescrito com a lista inteira em vigor: `auto_resolve, manual_winner, manual_archive, max_duration,
  inconclusive, manual_no_apply, manual_apply, regra_v2`) e `ab_test_cycles_end_reason_check` (`pausa, encerrado,
  falha_api, duracao_maxima, drift, rotacao, regra_v2`), os dois por `drop constraint if exists` + `add
  constraint`. Sem o segundo, `ab_settle_claim(... p_end_reason = 'regra_v2')` viola o CHECK, a transação desfaz
  e o teste v2 continua girando além do teto. A F4 acrescenta `'regra_v2'` a `MotivoSaida` e a `caminhoDe` em
  `ab-settle.ts` (de `['active']` para `completed`, `winner_variant_id: null`): **a F4 toca `ab-settle.ts`**
  (seção 9). Teste de integração (`HAS_LOCAL_DB`): `ab_settle_claim` com `p_end_reason = 'regra_v2'` deixa o
  ciclo fechado e o teste `completed`.
- Aplicar a migration fora de 07:50 a 08:10 e 11:50 a 12:10 UTC (rotação e avaliação do T19): o `ALTER` em
  `ab_tests` pega trava exclusiva, curta (só metadado, tabela de dezenas de linhas).
- *O que acontece quando o dado não existe?* Não existe linha sem valor: `not null` com default.
  Um caminho de criação que a F4 esquecer cai em `v1` (regra antiga, que só encerra por duração): falha
  conservadora, mas é falha. O C-12 pega.

### 2.3 R2: retrato diário por teste e dia

Tabela nova `ab_test_dias` (nome proposto). Uma linha por **teste × dia do Pacífico** em que algum ciclo
do teste esteve no ar. Só dias `day_pt <= ontemPt(agora)` (o dia de hoje no Pacífico está aberto às 14:00 UTC).

| Coluna | Conteúdo | Nulo quer dizer |
|---|---|---|
| `test_id uuid`, `day_pt date` | PK `(test_id, day_pt)`. Sem FK para o teste: o retrato sobrevive ao teste apagado | — |
| `site_id uuid not null references sites(id) on delete cascade`, `youtube_video_id` (11 caracteres) | como em `yt_own_video_*` (nunca juntar com `ab_tests.youtube_video_id`, que é outra coisa: spec honesto 4.2.2) | — |
| `regra_duracao` | cópia do carimbo do teste | — |
| `variant_id uuid` | variante atribuída ao dia (2.3.1) | dia não atribuído |
| `motivo_sem_variante` | `menos_de_90` (inclui pausa parcial), `meta_ausente`, `meta_nula` (com o `motivoNulo` da A5), `dia_de_outro_teste` (a `meta_daily` do dia existe com `ab_test_id` de outro teste), `teste_apagado` | — |
| `segundos_no_ar`, `segundos_do_dia` | `seconds_on_air_analytics` e a duração do dia por `boundsAnalytics` (82 800, 86 400 ou 90 000) | meta ausente |
| `dia_de_troca boolean` | a variante do dia é diferente da do dia anterior do mesmo teste | primeiro dia ou anterior sem variante |
| `ciclos jsonb` | ids, `started_at`, `ended_at` dos ciclos que tocam o dia (janelas de rotação) | — (array vazio nunca: sem ciclo não há linha) |
| `impressoes bigint`, `ctr numeric` | de `yt_own_video_reach_daily` | ver `alcance_estado` |
| `alcance_estado` | `medido`, `zero_medido`, `ausente_no_relatorio`, `aguardando`, `nao_medido` (regra abaixo) | — |
| `source_report_id`, `report_create_time` | de onde veio o número | sem linha de alcance |
| `views bigint`, `views_estado`, `views_fonte`, `metric_version` | de `yt_own_video_daily.views` do **dia** (nunca o total de 90 dias do diário do Observatório); estado pela cobertura da MG14 (`medido`, `zero_medido`, `nao_medido`); `views_fonte` = `source` da linha (pode ser `reporting_api`, cujo dia é outro) | ver estado |
| `engaged_views`, `watch_time_minutes`, `avg_view_percentage` | do mesmo dia e da mesma leitura (~40 bytes por linha). A decisão de hoje não usa; o dono pediu gravar mais do que usa | não veio |
| `troca_vista_em timestamptz` | **só quando `dia_de_troca = true`**: primeira sonda (2.4) do dia que viu a miniatura da variante do dia. `m` medido = `troca_vista_em` menos o início do dia, dividido por `segundos_do_dia` | dia sem troca, sem sonda, ou teste só de título |
| `retratado_em`, `final boolean` | hora da gravação; `final` = não muda mais | — |

**Estado do alcance (mapa relatório, dia, estado).** Relatório do dia = `report_type_id = 'channel_reach_basic_a1'`,
mesmo canal, `dayPt(start_time) = day_pt` (função `dayPt`, nunca `start_time::date`; vale no verão, 07:00 UTC, e no
inverno, 08:00 UTC). Pode haver mais de um por dia (backfill, reemissão): **vale o de maior `create_time`**.
- `medido`: há linha em `yt_own_video_reach_daily` para o vídeo e o dia com impressões não nulas, qualquer que seja o
  número de relatórios do dia.
- `zero_medido`: o relatório que vale está `vazio` com `normalized_at` não nulo (relatório de canal vazio = zero).
- `ausente_no_relatorio`: o que vale está `baixado` e normalizado, **sem** a linha do vídeo. A tela mostra 0, mas é
  estado próprio até a A5 e o dono responderem se um relatório não vazio pode faltar um vídeo só (seção 11). Não conta
  para o piso de dias.
- `aguardando`: o que vale está `listado`, `baixado` sem normalizar, ou não há relatório, tudo dentro de D+10. Vale
  também quando o relatório mais antigo está normalizado e o mais novo ainda `listado`.
- `nao_medido`: `expirado_sem_baixar` (final na hora, perda definitiva), impressão nula na linha, ou D+10 vencido.
  `erro` volta à fila (`normalized_at` nulo): é `aguardando` até D+10, nunca final.
- D+10 é `diffDias(day_pt, ontemPt(agora)) >= 10`, a mesma função em todo lugar.
- Implementação: função pura `estadoDoAlcance(relatorios, linha, agora)`, sem banco, testada com tabela de casos
  (inclusive dois relatórios do mesmo dia, velho normalizado e novo `listado` = `aguardando`, e relatório não vazio sem
  a linha do vídeo = `ausente_no_relatorio`).

**Escritor:** rota nova `/api/cron/ab-retrato`, uma vez por dia às 14:00 UTC (depois da meta das 12:00 e fora das
janelas de promoção), com `withCronLock`, `export GET` (guard `vercel-get-export-guard.test.ts`), `JOB` = nome da
pasta, e `recordCronSuccess` também com zero teste. Seleciona: testes `active` ou `paused`, **mais** todo `test_id`
com alguma linha `final = false` em `ab_test_dias` (índice parcial `where not final`), **mais** testes encerrados
há até 11 dias (o último dia do teste vence em `completed_at` + 10 dias). Teste que não existe mais: as linhas
abertas viram `final = true`, `aguardando` vira `nao_medido`, e `motivo_sem_variante = 'teste_apagado'` se não havia
variante (assim nenhuma linha fica `aguardando` para sempre).
Lê `ab_tests`, `ab_test_cycles`, `yt_own_video_meta_daily`, `yt_own_video_reach_daily`, `yt_reporting_reports`,
`yt_own_video_daily`, `yt_own_video_coverage` e a sonda, em **lote** (uma leitura por tabela com `in (test_ids)`,
8 consultas por rodada, não 8 × T), e monta `Map` por `day_pt` (nunca `find` dentro do laço dos dias).
Escreve **só** em `ab_test_dias`. Não escreve em `ab_tests`, nos ciclos nem no YouTube.
- **Escrita** pela função SQL `ab_test_dias_apply(p_rows jsonb)` (security definer, só service role) com `on
  conflict (test_id, day_pt) do update ... where not ab_test_dias.final`, como `yt_own_reach_apply`. Upsert do
  supabase-js não tem `WHERE` e reabriria a linha final. Teste: rodar o retrato duas vezes com o alcance mudado
  entre elas; a linha `final` não muda, as demais ficam iguais exceto `retratado_em`.
- **Erro de leitura** em qualquer das tabelas aborta a rodada sem escrever e chama `recordCronFailure('ab-retrato',
  ...)`; nunca classifica como `aguardando`. Dia de teste `active` com `alcance_estado = 'aguardando'` e
  `diffDias(day_pt, ontemPt) >= 5` vira nota de falha da rodada (nível `info`, uma vez por teste e dia) com o id do
  teste e o dia. Teste: 6 dias aguardando, registra; 4 dias, não.
- **Primeira execução** retrata o passado inteiro do T19 e congela na hora os dias com mais de D+10: 20+ linhas no
  primeiro dia é o esperado.

**Regravação:** uma linha com `final = false` é recalculada a cada dia. Vira `final = true` quando alcance e views
estão em estado final (`medido`, `zero_medido`, `ausente_no_relatorio` depois de D+10, `nao_medido`), ou no D+10 (o
que vier antes); no D+10, `aguardando` vira `nao_medido`. Relatório reescrito depois do `final` não muda o retrato.
O bruto da A5 fica 90 dias após normalizado; depois disso o retrato é a única cópia do número da decisão.

**Retenção e saída das duas tabelas novas (`ab_test_dias`, `ab_test_sondas`):** `site_id references sites(id) on
delete cascade` (somem com o site, como as `yt_own_*`); apagar o teste não apaga retrato nem sonda (intencional, R2);
sem dado pessoal (LGPD não se aplica); leitura `can_edit_site(site_id)`, escrita só por service role; não saem na API
do Cowork na F1. Índice `(report_type_id, channel_id, start_time)` em `yt_reporting_reports` na mesma migration
(~1 MB/ano; os índices atuais começam por `status` e `job_id`).

#### 2.3.1 Atribuição do dia à variante (o JOIN)

- Chave: `yt_own_video_meta_daily` por `(youtube_video_id, day_pt)` com `ab_test_id = test_id`.
- O dia é da variante `ab_variant_id` se `seconds_on_air_analytics >= 0,9 × segundos_do_dia`.
  **Mudança em relação ao spec honesto 4.2.2:** o limiar deixa de ser 77 760 s fixos e passa a ser 90% do
  próprio dia (23, 24 ou 25 h). No dia de 25 h, 77 760 s são só 86,4%. Teste de aceite em 6 (G5).
- Usa o par `_analytics`, nunca o `_reporting` (fato 5).
- Margem do limiar no verão: até 31/10 o dia de troca perde 1 h estrutural (dia começa 07:00 UTC, rotação 08:00), e
  `86 400 − 3 600 − atraso >= 77 760` só vale com atraso até 84 min (o máximo medido). No dia de 25 h a folga é de 90
  min; de 02/11 em diante, de 144 min. Sem efeito na F4 se ela for ao ar depois de 02/11; quem ler o retrato de
  outubro deve saber que `menos_de_90` em dia de troca pode ser o atraso do cron.
- Alcance e views do dia vão inteiros para a variante atribuída. Dia não atribuído fica no retrato, sem
  variante, e conta como "descartado" na tela.

#### 2.3.2 O viés da rotação (documentado, não consertado)

- Num **dia de troca**, parte do dia mostra ainda a variante anterior. Fração `m` (estimativa):
  - a partir de 02/11/2026 (fronteira do dia = 08:00 UTC = rotação): até 3 h de assentamento
    → `m ≈ 3/24 = 12,5%`;
  - até 31/10 (dia começa às 07:00 UTC): 1 h do dia anterior mais até 3 h → `m ≈ 4/24 ≈ 16,7%`;
  - atraso do cron (até 84 min) soma por cima nos dois casos.
- Em ABBA com 2 variantes só metade dos dias é de troca (A→B, B→B, B→A, A→A). A mistura média do teste
  fica em ~6% (inverno) a ~8% (verão).
- A mistura é simétrica. O efeito medido é `(1 − 2m) ×` o efeito real no dia de troca: **puxa para zero,
  não cria vencedor falso.** A tela diz que o ganho medido é um limite inferior.
- A sonda (2.4) mede `m` de verdade por dia (`troca_vista_em`). A F4 **não usa** essa medida para
  corrigir números neste ciclo; só a mostra no ⓘ.
- Hora do cron de rotação não muda (plano conjunto: "sai").

### 2.4 R3: sonda horária da miniatura

- Rota nova `/api/cron/ab-sonda-miniatura`, a cada hora no minuto 15 (`export GET`, `JOB` = nome da pasta,
  `withCronLock`, `recordCronSuccess` também com zero teste, para o `cron-watchdog` não acusá-la morta). Para cada
  teste `active` do tipo `thumbnail` ou `combo`, em paralelo (`Promise.allSettled`, `maxDuration = 60`): leitura
  anônima de `https://i.ytimg.com/vi/<id>/hqdefault.jpg`. A sonda faz o próprio `fetch` (injetável) e importa
  `thumbUrl`, `dhashOf`, `hamming`, `DHASH_MAX_SAME` e `uploadInstant` de `lib/youtube/thumb-fingerprint.ts`, que
  **não muda** (arquivo partilhado com a A5; `probeThumb` não devolve o status HTTP e lança em timeout). HEAD
  primeiro; GET só se o ETag mudou.
- dHash de cada variante: `ab_test_variants.thumbnail_dhash` se presente (referência; nunca baixar a imagem só para
  isso quando existe); senão, calculado na rodada a partir do `blob_url` com `hqdefaultLike` + `dhashOf`, em
  memória. A F1 nunca escreve em `ab_test_variants`. Variante sem Blob fica fora da comparação.
- Tabela nova `ab_test_sondas`: `test_id uuid not null`, `site_id uuid not null references sites(id) on delete
  cascade`, `youtube_video_id text`, `hora timestamptz not null` (= `date_trunc('hour', lida_em)`), `lida_em
  timestamptz not null`, `http int` (nulo = sem resposta), `erro text` (nulo = ok; `timeout`, `rede`, `http_<n>`,
  `imagem_invalida`), `etag`, `enviada_em timestamptz` (instante de upload que o ETag numérico carrega,
  `uploadInstant`), `sha16`, `dhash`, `variante_esperada` (a do ciclo aberto), `variante_vista`, `leitura_estado text
  not null check (in ('bate','nenhuma_bate','sem_referencia','ambigua','falhou'))`.
  PK `(test_id, hora)`; escrita por `insert ... on conflict do nothing` (entrega dupla do cron não duplica).
  `variante_vista` = a única variante a Hamming <= `DHASH_MAX_SAME`; duas ou mais = `ambigua` com `variante_vista`
  nulo; variante sem referência = `sem_referencia`; nenhuma = `nenhuma_bate`. Nulo nunca é `""` nem `0`.
- RLS: `select using (public.can_edit_site(site_id))`, sem policy de escrita (só service role). O mesmo vale para
  `ab_test_dias`. Teste com usuário não superusuário e GUC `app.site_id` forjado.
- Zero teste ativo = zero requisição. Sem cota da Data API (o CDN não tem cota).
- Só lê o YouTube. Não escreve no YouTube, não fala com o drift, não pausa nada.
- *Dado ausente:* sonda que falhou grava a linha com `leitura_estado = 'falhou'` e `erro`. Hora sem linha = cron não
  rodou; a tela nunca deduz "troca não vista" de hora sem linha nem de `sem_referencia`/`ambigua`.
- Testes: duas chamadas na mesma hora gravam 1 linha; `fetch` que rejeita grava `http` nulo e `erro = 'timeout'`;
  variante sem `thumbnail_dhash` calculada pelo `blob_url`, ou `sem_referencia` se sem Blob; duas variantes iguais =
  `ambigua`.
- A sonda mede do datacenter da Vercel, não do público no Brasil; o ⓘ diz isso. Resolução: minuto 15 de cada hora,
  `m` sai com ±1 h. Opção barata, se o dono quiser: segunda agenda `*/10 8-11 * * *` (24 GET a mais por dia por teste).
- Título: fora da sonda neste ciclo. Quando a S4 (A5) estiver no ar, as leituras da watch do vídeo em
  teste servem de sonda de título (a A5 já lê todo vídeo em teste nosso, pergunta 8).

### 2.5 A F1 pode ir ao ar antes do E8? Sim, sem ferir o G0

O G0 proíbe ir ao ar, antes do E8, o que muda rotação, `settleOnAir`, drift ou avaliação. A F1:
- não altera `ab-rotate`, `ab-rotation.ts`, `ab-settle*.ts`, `ab-drift.ts`, `ab-watchdog*`,
  `ab-evaluate*`, `ab-statistics.ts`, `ab-gates.ts`, `ab-lab/queries.ts` nem `ab-lab/_components/*`;
- acrescenta duas rotas novas, duas tabelas novas, uma função SQL, um índice, a reescrita dos dois CHECKs e uma coluna com default; o T19 ganha `regra_duracao =
  'v1'`, que nada lê na F1;
- o T19 passa a ser retratado e sondado. É leitura, e é desejável: é o primeiro teste com alcance real
  e serve ao C-9 (comparação com a soma da A5).

Condições para valer: (a) o C-1 (lista de arquivos tocados) passa; (b) a migration da F1 entra pela fila
única (plano conjunto 1.2) **antes de 30/10**; (c) o deploy da F1 segue a regra de pushes (um por lote,
fora das janelas). Se a migration não couber antes de 30/10, a F1 espera a janela seguinte; a sonda
(sem a coluna) poderia ir sozinha, mas também precisa de tabela.

**Fila do banco (proposta):** a migration da F1 entra logo depois da Migration A, antes da tabela crua da
S4, porque é a única da fila que guarda dado que expira na hora (a sonda). Se a A5 já tiver criado a
dela, a F1 vem depois, sem discutir: um dia de diferença.

### 2.6 Respostas da A5 (18/10) e o que falta

1. `yt_own_public_video_hourly`: sem poda nem partição com descarte; pode-se contar com o histórico inteiro.
2. Reporting API: o bruto baixado é guardado sem prazo (E20/MG13), com a ressalva dos 90 dias da purga (2.3).
3. **A confirmar com a A5:** a retenção das tabelas normalizadas que saem dos relatórios (`yt_own_video_reach_daily`,
   `yt_own_video_daily`, `yt_own_video_meta_daily`, `yt_reporting_reports`). A MG16/MG17 (~31/10) mexe em metadado e
   backup. A S8 não deve depender delas sem essa confirmação (o retrato copia o que a decisão usa, mas a F1 as lê).
4. Ordem das migrations: S8-F1 logo depois da Migration A nossa, ok pela A5; alinhar antes de cada `db:new`. A partir
   de 30/10 não há dia de migration.

---

## 3. Estados do dado (valem para F3 e F4)

| Estado | Quando | Tela | Conta como |
|---|---|---|---|
| `medido` | linha de alcance com impressões não nulas | número | dado |
| `zero_medido` | o relatório que vale está `vazio` e normalizado | **0** (sabido) | volume 0; **não conta para o piso de dias** |
| `ausente_no_relatorio` | relatório não vazio normalizado, sem linha do vídeo | 0, com marca própria | volume 0; não conta para o piso |
| `aguardando` | relatório ausente, `listado`, `baixado` sem normalizar ou `erro`, até D+10 | "aguardando o YouTube" | não é dado |
| `nao_medido` | `expirado_sem_baixar`, impressão nula, ou depois de D+10 | hachura "não medido" (mockup S9) | não é dado |
| descartado | dia sem variante (2.3.1) | "N dias descartados" | não é dado |

CTR: só entra no CTR ponderado o dia com `impressoes` e `ctr` não nulos. Dia com impressões e CTR nulo
conta nas impressões e não no CTR; a tela mostra quantos dias ficaram fora do CTR.
Cliques reconstruídos = `round(impressoes × ctr)` (o CSV não tem cliques; spec honesto §6).

---

## 4. F2: falha em verde (G3)

Antes de qualquer alcance aparecer no placar:
- `VariantStats.total_impressions` e `total_clicks` passam a `number | null`; nulo = nenhum dia com dado.
- `calculateZTest` devolve um resultado com estado: `nao_medido` (alguma variante nula), `sem_volume`
  (alguma com 0 medido), `calculado` (com z e p). Nunca `pValue: 1` como resposta padrão.
- `calculateBayesianConfidence` recusa entrada nula (mesmo estado).
- `queries.ts`: some o `?? 0` e o `avg_ctr = 0`; os números do placar vêm do retrato (F3), não de
  `ab_test_cycles.impressions`.
- Teste que prova: apagar o alcance de uma variante na semente e afirmar "não medido", nunca 0 nem
  "sem diferença".

---

## 5. F3: placar e F4: regra v2

### 5.1 F3: placar

- Fonte única: `ab_test_dias` do teste (uma leitura pela PK). Vale para todo teste, `v1` ou `v2`: o
  placar é leitura, não decisão.
- Por variante: dias válidos, impressões, CTR ponderado, views; contagens de dias descartados,
  aguardando e não medidos; "ganho medido é limite inferior" no ⓘ.
- Teste `v1` (T19): mostra os números, sem régua de volume, sem "vencedor", com "regra antiga: encerra
  por duração".
- Desenho: o do mockup S9 aprovado (placar, faixa de CTR "faixa não calculada" quando não há dado,
  régua de quanto falta, relógio parado na pausa, "congelado em ... (dia X de 14)").

### 5.2 F4: regra v2 (só teste com `regra_duracao = 'v2'`)

Decisões do dono (§9 do plano conjunto): piso 8 dias com 2 variantes e 12 com 3; teto 14 (estende até
28); decide o que vier por último entre piso e volume; ganho mínimo 20%; pouco volume = avisar e deixar
iniciar.

1. **Relógio do teste** = número de dias do Pacífico com algum ciclo do teste no ar (de
   `ab_test_cycles`, por `boundsAnalytics`). Pausa para o relógio. O dia de 25 h conta 1. Substitui a
   conta em milissegundos (fato 8) só para `v2`. Uma função só, reusada pela tela e pela decisão. O dia do início
   conta 1 mesmo parcial (início às 23:50 PT gasta 1 dos 14 com minutos no ar, e esse dia vai a descartado); a tela
   de início diz isso.
2. **Piso de dias:** **dia válido** = alcance em estado de dado **com impressões > 0** (`medido`); `zero_medido` e
   `ausente_no_relatorio` somam 0 ao volume e não contam para o piso. Cada variante com >= 4 dias válidos, e >= 2
   blocos ABBA em que toda variante tem ao menos 1 dia válido. Com 2 variantes isso pede >= 8 dias; com 3, >= 12.
   Um dia descartado adia o piso; nunca é preenchido por estimativa.
3. **Piso de volume:** cada variante com >= N impressões, `N = k × (p1(1−p1) + p2(1−p2)) / (p2 − p1)²`, `p2 = 1,2 × p1`,
   `k = 7,85` com 2 variantes (α = 0,05) e `k = 9,50` com 3 (α = 0,025, que é (2,241 + 0,842)²). `p1` = CTR
   ponderado do vídeo na janela fixa `[started_at − 14 dias, started_at)`. Com 4%: N ≈ 10.300 (2 variantes) e
   ≈ **12.500** (3 variantes). Com 7,85 o teste de 3 variantes teria poder de ~72%, não 80%. Função pura
   `volumeMinimo(p1, nVariantes)`, testada com os dois valores.
   N, `k` e `p1` saem de função pura sobre a janela fixa e são calculados e congelados em `result_metadata.v2` na
   **primeira rodada v2 que encontra o teste sem eles** (a janela não muda depois do início, então o valor é o
   mesmo em qualquer rodada; vale para os três caminhos de criação, inclusive o lote e o playoff em SQL). Sem
   alcance na janela: `p1 = 4%`, `base_estimada = true` e a tela diz "base estimada". Teste: rodar a decisão duas
   vezes no mesmo teste dá N idêntico, gravado uma vez.
4. **Estatística:** z de duas proporções nos totais, bilateral, α = 0,05 (com 3 variantes, cada uma contra a
   original, α = 0,025), **corrigido pela superdispersão medida no próprio teste**:
   φ̂ = Σ_dias (cliques_d − imp_d · p̂_{v,b})² / (imp_d · p̂_{v,b}(1 − p̂_{v,b})) ÷ (D − V·B), com p̂_{v,b} o CTR da
   variante no bloco, D os dias válidos com impressões > 0, V as variantes, B os blocos; `z_adj = z / √max(1, φ̂)`.
   Passa se `p(z_adj) < α` **e** o sinal da diferença é o mesmo em todo bloco completo. Grava `z`, `phi`, `z_adj`,
   `p_adj` e os sinais por bloco em `result_metadata.v2`. Com `D − V·B < 2`, não passa (`sem_diferenca_detectavel`).
   Motivo (Phil): o sinal por bloco sozinho, com 2 blocos, corta o falso positivo no máximo pela metade; com φ = 3
   o p real do z nominal 1,96 é ~0,26 (~0,13 com o sinal), 2,6 vezes o α prometido. O intervalo sobre os blocos não
   serve (1 grau de liberdade, t = 12,7). Teste (C-13b): semente com φ ≈ 4 em que o z cru dá p = 0,01 e o ajustado
   não passa = `sem_diferenca_detectavel`, nunca `vencedor_provavel`.
5. **Quando decide:** a decisão v2 roda **no fim da própria rodada do `ab-retrato`** (14:00 UTC), depois do upsert,
   com o mesmo `withCronLock`, lendo só o retrato recém-gravado. Assim não lê retrato de 22 h atrás nem acopla dois
   crons por horário, e o teto efetivo não vira 15. Fora das janelas de promoção.
   - piso de dias e de volume atingidos → encerra;
   - relógio no teto sem os dois pisos → encerra;
   - encerrar = `settleOnAir(original, 'regra_v2')`, `completed_reason = 'regra_v2'` (os dois CHECKs vêm na F1, 2.2);
     **nunca** grava `winner_variant_id` (P2: escolher o que fica no ar é do dono). O sugerido vai em
     `result_metadata.v2.vencedor_sugerido`.
   - O `ab-evaluate` continua com a v1. A F4 só acrescenta nele a guarda que **pula teste `v2`** (para a duração
     máxima da v1 não encerrar um teste v2); fora isso ele não é tocado.
6. **Desfechos** (`result_metadata.v2.desfecho`):
   - `vencedor_provavel` (variante): pisos atingidos, estatística passa;
   - `sem_diferenca_detectavel`: pisos atingidos, estatística não passa ("nenhuma diferença de 20% ou
     mais com este volume"; nunca "empate");
   - `inconclusivo_por_volume`: teto sem N;
   - `inconclusivo_por_dado`: teto sem o piso de dias por falta de dado (dias não medidos ou descartados);
   - `aguardando_alcance`: encerrado no teto com dias ainda `aguardando`; o retrato reavalia até todos os
     dias ficarem `final` e então grava o desfecho definitivo. Nunca fica em `aguardando_alcance` depois
     do D+10 do último dia (a seleção do escritor, 2.3, garante que a linha chega a `final`).
7. **Aviso antes de iniciar:** impressões/dia = média dos dias com alcance em estado de dado nos últimos
   14 dias do vídeo; dias previstos = `n_variantes × N / (impressões/dia)`. Se passa do teto: "este teste
   não chega ao volume em X dias; o desfecho provável é inconclusivo por volume", e o botão de iniciar
   continua. Sem dado de alcance para estimar: "sem medição para estimar o volume", nunca "ok". O Cowork
   (`manage_ab_test`) devolve o mesmo aviso no mesmo campo (e o doc do domínio no `data/pipeline-docs/` é
   atualizado: Pipeline Integrity).
8. **Validação na criação v2:** `rotation_pattern = 'abba'` (os blocos só existem nela) e
   `max_duration_days >=` piso (8 ou 12). Os campos `confidence_threshold`, `burn_in_days` e
   `stability_threshold` ficam no schema e são ignorados pela v2 (como `auto_apply_winner`).

---

## 6. Teste de aceite do dia de 25 h (G5)

Por data relativa (regra anti-regressão): o teste acha o próximo dia do Pacífico com 25 h procurando,
com `boundsAnalytics`, o primeiro dia de duração 90 000 s a partir de hoje, com teto de 400 dias e **falha
explícita** se não achar (Node sem ICU completo dá 24 h a todo dia e a busca não acabaria). Nunca a data escrita.
- dia de 25 h com variante 86 400 s no ar → válido (96%);
- dia de 25 h com 80 000 s → **descartado** (88,9%), embora passe no limiar fixo antigo de 77 760;
- dia de 23 h (procurado do mesmo jeito) com 76 000 s → válido (91,8%), embora falhe no limiar fixo;
- teste que atravessa o dia de 25 h: o relógio conta esse dia como 1; o piso de 8 dias não fecha 1 h
  antes nem depois;
- retrato do dia de 25 h: `segundos_do_dia = 90 000`.

---

## 7. Custo de consulta e volume

- `ab-retrato`: por teste, leituras por faixa de PK em `meta_daily`, `reach_daily`, `video_daily`
  (≤ 38 linhas cada: 28 dias mais 10 de espera) e em `yt_reporting_reports` do canal (índice novo `(report_type_id,
  channel_id, start_time)` na F1; ~14 mil linhas por ano com 3 canais). Com 3 testes, menos de 1 s.
- Sonda: 24 leituras por dia por teste ativo; com 3 testes ao mesmo tempo, 72 linhas por dia (~26 mil por
  ano, ~6 MB). Sem poda neste ciclo; gatilho de rever: 100 MB. Retrato: ~0,7 kB por linha, < 9 MB por ano.
- Retrato: ≤ 28 linhas por teste; ~30 testes por mês dão < 1.000 linhas por mês.
- Placar: uma leitura de `ab_test_dias` pela PK por abertura de tela. A lista não calcula placar.
- Cota da Data API: zero chamada nova. Cron: duas rotas novas (49 agendas hoje, 51 depois da F1; conta Pro, limite
  de 100 pela documentação da Vercel, não conferido na conta).
- RLS das tabelas novas: `can_edit_site(site_id)` na leitura (a mesma que protege `yt_own_video_reach_daily`; alcance
  é dado privado do canal); escrita só por service role. Nunca `site_visible`. Detalhe em 2.3 e 2.4.

---

## 8. Critérios de aceite

F1:
- **C-1.** O diff da F1 não toca nenhum arquivo da lista de 2.5 (conferido por `git diff --name-only`
  no lote). Confere: Yannis.
- **C-2.** Depois da migration, `select regra_duracao, count(*) from ab_tests group by 1` dá só `v1`;
  o T19 (`0d31687e`) é `v1`. Confere: Phil.
- **C-3.** Com o T19 ativo, o `ab-retrato` grava uma linha por dia com ciclo no ar; um dia sem
  relatório fica `aguardando`, um dia com relatório vazio fica `zero_medido`, dois relatórios do mesmo dia (velho
  normalizado, novo `listado`) ficam `aguardando`, relatório não vazio sem a linha do vídeo fica
  `ausente_no_relatorio`, `expirado_sem_baixar` fica `nao_medido` na hora (semente local com os casos). Confere: Phil.
- **C-3b.** Segunda rodada com alcance diferente não muda linha `final`; teste encerrado às 00:30 PT e 11 dias de
  rodadas (fake timers) deixam todas as linhas `final`; teste apagado fecha as linhas abertas como `nao_medido`;
  erro de leitura aborta sem escrever. Confere: Yannis.
- **C-4.** Teste que apaga a linha de `meta_daily` de um dia: o retrato grava `variant_id` nulo com
  `motivo_sem_variante = 'meta_ausente'`, nunca a variante do ciclo. Confere: Yannis.
- **C-5.** A sonda grava, no T19 em produção, uma linha por hora (PK `(test_id, hora)`; chamada dupla grava 1);
  sonda com erro grava `leitura_estado = 'falhou'` e `erro`, nunca `""`; variante sem referência fica
  `sem_referencia`. Confere: Phil, depois de 1 dia.
- **C-6.** Com zero teste ativo, a sonda não faz nenhuma requisição (teste da rota). Confere: Yannis.
- **C-7.** Avaliação, rotação e placar do T19 são os mesmos antes e depois da F1 (testes existentes de
  `ab-evaluate`, `ab-rotate` e `queries` passam sem mudança). Confere: Yannis.

F2 e F3:
- **C-8.** Variante sem alcance mostra "não medido"; nenhuma chamada de `calculateZTest` devolve
  `pValue: 1` por falta de dado (teste que apaga o alcance). Confere: Yannis.
- **C-9.** CTR da tela difere menos de 1% da soma ponderada de `yt_own_video_reach_daily` nos dias
  atribuídos à variante (consulta do Phil, no T19 quando terminar). Confere: Phil.
- **C-10.** Relatório vazio aparece como 0; relatório ausente aparece como "aguardando o YouTube" até
  D+10 e "não medido" depois. Nunca um pelo outro. Confere: Gio.
- **C-11.** O T19 mostra números sem "vencedor" e com "regra antiga". Confere: Gio.

F4:
- **C-12.** Os três caminhos de criação (fato 9) gravam `v2` depois do deploy; teste que cria por cada
  um. Confere: Yannis.
- **C-13.** Com menos de 4 dias válidos (impressões > 0) por variante, nenhum desfecho é `vencedor_provavel`, nem com
  volume enorme. Confere: Phil.
- **C-13b.** Semente com φ ≈ 4 em que o z cru dá p = 0,01: o ajustado não passa, desfecho
  `sem_diferenca_detectavel`. Confere: Phil.
- **C-14.** No teto sem N: `inconclusivo_por_volume`; com dias não medidos: `inconclusivo_por_dado`; N com 3
  variantes e 4% é ~12.500 (`k = 9,50`). Confere: Phil.
- **C-15.** Encerramento v2 passa pelo `ab_settle_claim` real (integração `HAS_LOCAL_DB`, `p_end_reason = 'regra_v2'`),
  fecha o ciclo, deixa o teste `completed` e nunca escreve `winner_variant_id`. Confere: Yannis.
- **C-16.** Os casos da seção 6 passam. Confere: Yannis.
- **C-17.** Vídeo com pouco volume: aviso aparece e o início continua possível; sem alcance anterior,
  "sem medição para estimar". O Cowork devolve o mesmo aviso. Confere: Gio.
- **C-18.** Pausa de 2 dias não conta no relógio; o teto chega 2 dias depois. Confere: Yannis.

---

## 9. Deploy e portões

- F1: pode ir antes do E8 (2.5), com a migration pela fila, antes de 30/10, e G1 (migration antes do
  código que lê a tabela).
- F2, F3 e F4: **presas ao G0**. Código pode ser escrito já; deploy só depois do E8 do T19 e do lembrete
  do título do `Uy5_DPzoGi8`. Ordem: F2 → F3 → F4 (G3: o conserto da falha em verde antes de o alcance
  aparecer).
- G2: garantido pelo default `v1` da F1 e pela F4 escrever `v2`.
- G4: Phil e Yannis no fim deste spec e de cada lote.
- A F4 não precisa de migration nova (a coluna e os dois CHECKs vêm na F1), mas **toca `ab-settle.ts`**
  (`MotivoSaida` e `caminhoDe`) e acrescenta a guarda de teste `v2` em `ab-evaluate`; os dois só vão ao ar depois do E8.

---

## 10. Decisões abertas para o dono

1. **F1 antes do E8 com a sonda horária.** Recomendação: sim. Custo: duas rotas e duas tabelas a mais;
   sem ela, o viés de 12,5% fica só estimado para sempre. Contra: a fila do banco ganha uma migration
   antes de 30/10.
2. **N corrigido pela mistura da rotação?** Com mistura média de ~6%, 20% de ganho real aparece como
   ~17,6%; corrigir subiria N de ~10.300 para ~13.300. Recomendação: **não corrigir** (fica o N que o dono
   aprovou); a mistura não cria vencedor falso, só deixa mais testes inconclusivos. A tela diz que o
   ganho medido é limite inferior. Phil: a correção que importa não é a da mistura, é a da superdispersão (corrigida
   no próprio teste, 5.2 item 4) e a do α com 3 variantes (`k = 9,50`, item 3); essas entram sem decisão do dono.
3. **Encerrar cedo quando os pisos fecham, voltando à original.** Recomendação: sim, como hoje no teto
   (nada aplicado sozinho, o dono aplica o sugerido em 1 toque). Custo: a variante vencedora fica fora do
   ar até ele agir. Alternativa: continuar a rotação até o teto e só avisar (gasta dias de exposição na
   variante pior).
4. **Limiar de 90% do próprio dia em vez de 77.760 s fixos.** Recomendação: sim (é o G5). Custo: nenhum
   fora do dia de 25 h ou de 23 h.

---

## 11. O que NÃO conferi

- A retenção das tabelas normalizadas que saem dos relatórios (`yt_own_video_reach_daily`, `yt_own_video_daily`,
  `yt_own_video_meta_daily`, `yt_reporting_reports`): **a confirmar com a A5** antes de a S8 depender delas (2.6, item 3).
  Retenção de `yt_own_public_video_hourly` e do bruto: respondida pela A5 (2.6).
- Atraso real do relatório de alcance (sem leitura de produção). Conferência com data: 14 dias após o deploy da F1, o
  p95 de `normalized_at − end_time` dos relatórios `channel_reach_basic_a1`; se passar de 7 dias, rever o D+10 antes da F4.
- Os 3 h de assentamento da miniatura e o atraso do cron: estimativas; a sonda mede.
- Se a fronteira do dia da Reporting passa mesmo a 08:00 UTC depois de 01/11 (spec honesto §6 marca como inferência).
- Se existe rascunho de teste criado antes do deploy da F4 que será iniciado depois (ficaria `v1`).
- Se o CSV vazio do alcance é por canal inteiro ou se pode faltar um vídeo só num relatório não vazio (por isso
  `ausente_no_relatorio` é estado próprio). Se `yt_own_reach_apply` mantém a linha antiga quando um relatório mais novo
  do mesmo dia vem vazio.
- Se reemissão de relatório do alcance acontece de fato para o mesmo dia (B2 do Phil assume que pode).
- O valor real de φ no canal (o texto usa φ = 3 a 4 só como exemplo de teste).
- Se as variantes do T19 têm `thumbnail_dhash` (a sonda calcula pelo `blob_url` se não tiver).
- Limite de agendas de cron da conta da Vercel.
- Data do E8 do T19: não sei; nenhuma data foi escrita aqui.
- Horas de cada fase: sem estimativa; pedir a Phil e Yannis.

**Conferências com data (leitura):** D+1 da F1, `select regra_duracao, count(*) from ab_tests group by 1` (só `v1`);
24 sondas em 24 horas do T19 e zero `sem_referencia`; D+3, nenhum `aguardando` com `day_pt < current_date − 10`.

---

## Registro de revisões

- r1 (18/10): 1º rascunho, Opus.
- r2 (18/10): conserto da r1 de Phil e Yannis.
