# Spec S8: gravação por variante e dia, placar com alcance da A5 e regra nova de duração

Escrito em 18/10/2026 (1º rascunho, Opus); r2 em 18/10 (conserto da r1 de Phil e Yannis); r4 em 24/10 (só F2–F4: conserto dos pareceres r1 de Phil, 74 NÃO, e Yannis, 79 NÃO, de 23/10); r5 em 23/10 (só F2–F4: emendas dos pareceres r2 de Phil, 87 NÃO, N1–N3 + M1–M5, e Yannis, 88 NÃO, N-1 a N-4 + m-1 a m-6); **r5.1 em 23/10 (emendas finais dos pareceres r3: Phil 92 SIM, N4, N5, R1–R3; Yannis 94 SIM, R-1 a R-4; a F1 está em produção e não muda)**. Fatia S8 do plano conjunto
(`.superpowers/sdd/ab-lab/2026-10-18-nativo-vs-nosso/plano-conjunto.md`, §1, §2, §4, §9).
Revisão: Phil e Yannis no fim (portão G4); a r5.1 tem o SIM de Phil (92) e Yannis (94); sem nova rodada. Só documento: nenhum código, nenhuma migration criada.

**Ajuste do dono (18/10):** a coleta vem primeiro. A S8 tem quatro fases. A F1 só grava. As outras
três leem o que a F1 gravou.

| Fase | O que faz | Toca avaliação ou placar? | Vai ao ar |
|---|---|---|---|
| **F1. Gravação** | carimbo da regra no teste, retrato diário por teste e dia, sonda horária da miniatura | não | **antes do E8** (seção 2.5) |
| F2. Falha em verde (G3) | para a gravação de views como impressões e tudo que as soma; "não medido" até a F3 | sim (estatística e placar) | depois do E8 (G0) |
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
estão em estado final (`medido`, `zero_medido`, `ausente_no_relatorio` depois de D+10, `nao_medido`) **e** o dia está
no D+10 (emenda r3, abaixo); no D+10, `aguardando` vira `nao_medido`.
**Emenda r3:** `final` só vale no D+10 (`diffDias(day_pt, ontemPt) >= 10`): a A5 relê os últimos 10 dias do diário, então
antes disso as views ainda mudam e o relatório pode ser reemitido. Estado final do alcance antes do D+10 (ex.:
`expirado_sem_baixar` = `nao_medido`) vale para o **estado**, não para `final`. Exceções: teste apagado e linha aberta
antiga demais para a janela de leitura são fechadas na hora. `motivo_nulo_meta` é recálculo da S8 com os ciclos só do
teste, não o valor da A5. Relatório reescrito depois do `final` não muda o retrato.
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

`medido` inclui linha existente com 0 impressões (`estado.ts:12`): a tela mostra 0 e esse dia não conta para o piso (predicado `diaValido`, 5.1).

CTR: só entra no CTR ponderado o dia com `impressoes` e `ctr` não nulos. Dia com impressões e CTR nulo
conta nas impressões e não no CTR; a tela mostra quantos dias ficaram fora do CTR.
Cliques reconstruídos = `round(impressoes × ctr)` (o CSV não tem cliques; spec honesto §6).

---

## 4. F2: falha em verde (G3) — r4

**Fonte da falha (Phil A1, Yannis Y-1).** `calculateZTest` não tem chamador fora de teste. O número que o dono vê hoje sai de
`ab-lab/queries.ts:202-226`, que soma `ab_test_cycles.impressions/clicks`, e essas colunas guardam **views** com cliques 0, CTR 0 e
`backfill_status = 'confirmed'` (`lib/youtube/ab-youtube.ts:55-88` pede `metrics: 'views'`; `app/api/cron/ab-backfill/route.ts:159-172`
grava; agenda `vercel.json:21`, `0 11 * * *`). Sonda de Yannis: `calculateBayesianConfidence` com cliques 0 devolve vencedor B com 56%
quando B tem **menos** views (1.200 contra 900; 5.000 contra 4.000): vencedor falso, não ausência.

**Escolha registrada:** F2 e F3 continuam em **envios separados**. Entre as duas, o placar mostra "não medido" em toda variante
(esperado, não defeito; o Gio confere isso). A alternativa "F2 e F3 no mesmo deploy" fica descartada pela decisão do controlador.

A F2 faz:
1. **Corta a escrita.** `ab-backfill` deixa de gravar `impressions`, `clicks` e `ctr` em `ab_test_cycles` e deixa de pedir `views` à
   Analytics API para isso. Os valores antigos ficam no banco, sem leitura, e **não são apagados** (views com rótulo errado; nenhuma
   migration destrutiva). **Padrão (Phil r2 M1): rota fora do `vercel.json`** (zero chamada à Analytics API, zero escrita; a rota sem as três colunas ainda
   marcaria `confirmed` sem dado e deixaria ciclos `pending`/`partial` em retentativa). O plano da F2 lê a rota inteira, confere o grep de
   outro leitor de `backfill_status` e confere `cron-health-report.ts` (cita `ab-backfill` em comentário; se a lista de crons esperados
   vem do `vercel.json`, nenhum alarme eterno; se vem de lista própria, tirar `ab-backfill` de lá). Só se achar função útil que o plano
   prove necessária volta a "rota sem as três colunas"; o que não pode sobrar é a escrita.
2. **Corta toda leitura.** Nenhum código do placar lê `ab_test_cycles.impressions/clicks/ctr`. Até a F3, `total_impressions`,
   `total_clicks` e `avg_ctr` são `null` em toda variante (`number | null`; nulo = nenhum dia com dado). Regra única: **nulo = não
   medido, nunca entra em soma nem em comparação com 0**. Pontos de `queries.ts` (um teste por ponto no plano da F2):
   `:209-226` (soma e gate `hasEnoughData >= 100`), `:233` e `:944` (`calculateBayesianConfidence`, `pBest`, `suggested_winner_id`),
   `:402` (CTR por ciclo), `:937-944` e `:1031` (`minImpressions` / `computeGates`), `:963` (gráfico diário `cycle.ctr ?? 0`),
   `:1264` (guarda `every total_impressions === 0`; `null === 0` é falso e a guarda passaria a dizer "teve vencedor" num teste
   sem dado), `:1288-1304` (vista de concluído, `avg_ctr ?? 0`, soma total, `lift` sem CTR medido não é calculado). Mais
   `semImpressoes` (`ab-constants.ts:75`), que trata `null` como sem medição e não libera a "faixa provável de CTR", e
   `IntelligenceAbTestSummary.total_impressions` (`intelligence-types.ts:213`, sem leitor: apagar ou tornar `number | null`).
3. **Estatística com estado.** `calculateZTest` vira `zDuasProporcoes(a, b)`: `{estado:'nao_medido'}` (alguma variante nula),
   `{estado:'sem_volume'}` (alguma com 0 medido) ou `{estado:'calculado', z, p}`; nunca `pValue: 1` como resposta padrão; é a base da F4.
   `calculateBayesianConfidence`, `calculatePlayoffStats` e `computeGates` recebem o estado e devolvem `nao_medido` sem amostrar.
4. **Arquivos da F2 (C-1 de F2–F4, conferido por `git diff --name-only`):** `ab-types.ts`, `ab-statistics.ts`, `ab-gates.ts`,
   `intelligence-types.ts`, `ab-lab/queries.ts`, `ab-lab/_components/{ab-constants,variant-table,active-detail,rank-bars}.tsx`, `app/api/cron/ab-backfill/route.ts`,
   `lib/youtube/ab-youtube.ts` e, se a rota sair da agenda, `vercel.json`.
5. **Testes:** (a) semente com 2 variantes, ciclos `confirmed` com `impressions = 1200/900`, `clicks = 0`: `getTestResults` e
   `toDetailView` devolvem impressões `null`, `pBest` ausente, gate `min_impressions` "não medido"; `calculateZTest`/`zDuasProporcoes`
   nunca é chamado com esses números; mutante que volta a somar `cycle.impressions` falha; (b) apagar o alcance de uma variante: "não
   medido", nunca 0 nem "sem diferença"; (c) `ab-backfill` não faz nenhum `update` de `impressions/clicks/ctr`.
6. **Conferência pendente pelo dono/controlador (leitura em produção, antes do plano da F2):** Q1
   `select backfill_status, count(*), sum(impressions) imp, sum(clicks) cliques, max(ctr) ctr_max from ab_test_cycles group by 1;`
   esperado: `confirmed` com `cliques = 0` e `ctr_max = 0` (prova a mentira em produção; hoje provada só no código).
   **D+1 do deploy da F2:** log da rota `ab-backfill` com **zero invocações** (rota fora do `vercel.json`; não só "sem update") e o T19 mostrando "não medido".

---

## 5. F3: placar e F4: regra v2

### 5.1 F3: placar

- Fonte única: `ab_test_dias` do teste (detalhe: uma leitura pela PK; lista do Cowork: uma leitura em lote, abaixo). Vale para todo teste, `v1` ou `v2`: o placar é leitura, não decisão.
- **Função pura `placarDoTeste(dias, variantes)`** em `lib/youtube/ab-gravacao/placar.ts`, usada pela tela **e** pelo Cowork
  (`projetarTeste`, `lib/pipeline/services/youtube.ts:1037-1050`), de modo que os dois mostram o mesmo número (paridade, dono 13/10).
  O Cowork deixa de mandar `total_impressions: null` e `AVISO_SEM_METRICA_DE_ENTREGA` quando há dia medido.
  **Lista do Cowork sem N+1** (Yannis r2 N-2): `projetarTeste(row, agora, placar)` continua pura e síncrona e recebe o `placar` já calculado
  (`null` = sem dado). `listAbTests` (`youtube.ts:1081`) faz **uma** leitura de `ab_test_dias` `.in('test_id', ids).eq('site_id', siteId)`
  paginada por `lerPaginado` (≤ 38 linhas por teste) com **ordem determinística `order('test_id').order('day_pt')` (a PK; sem ordem o `.range` duplica ou perde linha, `paginar.ts:17`)**, `ids` **fatiados em lotes de 100** (o `.in` vai na URL, ~37 caracteres por id; com mais de ~150 testes o GET estoura) e agrupa por `Map`; `getAbTest` (`:1109`) faz uma leitura pela PK. Erro de leitura
  devolve `err('DB_ERROR', ...)`, nunca `placar = null` silencioso; lista e detalhe mandam o mesmo número. O(D) tempo e memória, D = linhas
  dos testes listados (~100 hoje, ~1.000 em um ano). Doc do domínio em
  `data/pipeline-docs/cowork-docs-youtube.md` e `docs/cowork-pipeline-reference.md` atualizados (Pipeline Integrity). Dado privado do
  canal (Analytics), sem dado pessoal; sai só pela chave por pessoa do Cowork, com uso registrado.
- **Predicados** (uma função cada, usados por F3 e F4): `diaComAlcanceValido` = `alcance_estado == 'medido' && impressoes > 0 && ctr != null`
  (não olha a variante; é o que o `p1` usa, pois os dias anteriores ao teste não têm variante) e **`diaValido` = `diaComAlcanceValido &&
  variant_id != null`**. Em produção `medido` inclui linha com 0 impressões (`estado.ts:12`); esse dia a tela mostra 0 e **não conta para o
  piso**. `VariantStats` ganha `impressoes_com_ctr`: CTR ponderado, z, φ̂ e o piso de volume usam **só** `impressoes_com_ctr` e
  `cliques = Σ round(impressoes × ctr)` desses dias; `total_impressions` (inclui dias sem CTR) é só exibição, e a tela diz quantos
  dias ficaram fora do CTR. Teste: variante com um dia de 5.000 impressões e CTR nulo: CTR, z e N não mudam com ou sem esse dia.
- Por variante: dias válidos, impressões, CTR ponderado, views; contagens de dias descartados, aguardando e não medidos; "atualizado
  em" = `max(retratado_em)` com aviso se > 26 h; "ganho medido é limite inferior" no ⓘ.
- **Leitura:** filtra `.eq('site_id', siteId)` além do `test_id`. **Erro da leitura de `ab_test_dias` (e de variantes e ciclos, que
  `getTestResults` hoje ignora em `queries.ts`) vira estado de erro da página, nunca "não medido".**
- Teste `v1` (T19): números, sem régua de volume, sem "vencedor", com "regra antiga: encerra por duração".
- Desenho: o do mockup S9 aprovado (placar, faixa de CTR "faixa não calculada" quando não há dado, régua de quanto falta, relógio
  parado na pausa, "congelado em ... (dia X de 14)").
- **Arquivos da F3:** `ab-gravacao/placar.ts`, `ab-lab/queries.ts`, `ab-lab/_components/*`, `lib/pipeline/services/youtube.ts`, docs acima.
- **Testes:** mock de erro em `ab_test_dias`: a página não mostra "não medido"; mesma semente: tela e Cowork com os mesmos totais; spy no
  cliente conta 1 chamada a `ab_test_dias` para 20 testes na lista do Cowork; erro na leitura faz a lista falhar.

### 5.2 F4: regra v2 (só teste com `regra_duracao = 'v2'`)

Decisões do dono (§9 do plano conjunto): piso 8 dias com 2 variantes e 12 com 3; teto 14 (`max_duration_days`, estende até 28);
decide o que vier por último entre piso e volume; ganho mínimo 20%; pouco volume = avisar e deixar iniciar.

**Definições (r4, uma só conta para os dois revisores).**
- **Relógio do teste** = `diasDoTeste(ciclos, teste, ontem, diaDoPrimeiroCiclo)` (`ab-gravacao/atribuicao.ts:41`), **sem** a janela de
  40 dias que o retrato usa (`desde = max(janela, início)`; com pausa longa o relógio perderia os primeiros dias e o teto se
  estenderia calado). Pausa para o relógio. O dia de 25 h conta 1. Tela v2 e decisão usam o mesmo número; `diaDoTeste` em ms
  (`ab-dia-do-teste.ts`) segue só para `v1` (dívida: apagar quando não houver teste `v1` ativo).
- **Relógio da decisão = dias fechados** (`day_pt <= ontemPt(agora)`, com ciclo no ar). A decisão roda às 14:00 UTC, quando o dia
  corrente do Pacífico está aberto e parcial; ele não conta. O **teto é atingido quando os dias fechados = `max_duration_days`**, e o
  último dia inteiro conta. O dia do início conta 1 no relógio mesmo parcial (início às 23:50 PT gasta 1 dos 14 com minutos no ar, e
  vai a descartado); a tela de início diz isso. Efeito (Phil A3): teto T dá no máximo T − 1 dias inteiros.
- **Bloco ABBA** (Phil A4 + Yannis Y-5, escolha registrada): bloco de um dia = `floor((cycle_number − 1) / (2 × V))` do ciclo que deu a
  variante ao dia (o ciclo com maior sobreposição no dia), com `cycle_number` **1-based** (a posição ABBA é `count(ciclos fechados) + 1`,
  `ab-rotate-phases.ts:399-408`). Nunca por dia do calendário: pausa, drift, `falha_api` e `forceRotate` fecham ciclo e deslocam o
  padrão. A decisão lê `cycle_number` de `ab_test_cycles` (já lida em lote no `rodarRetrato`: acrescentar a coluna ao select; sem
  migration). **Em F4 o retrato também grava `cycle_number` em cada item de `ab_test_dias.ciclos`** (jsonb, sem migration) para
  auditoria; linhas antigas ficam sem ele e não são de teste v2. Bloco completo = bloco em que toda variante tem >= 1 dia válido.
  Função pura `blocoDoDia`; teste com pausa no meio do bloco 1 e com rotação forçada. O plano confere se `forceRotate` incrementa
  `cycle_number` sem quebrar o padrão ABBA (Yannis não conferiu) e se o `cycle_number` é de fato 1-based.
- **Fonte da decisão** (Yannis Y-2): a decisão relê `ab_test_dias` **do banco depois do apply** (uma leitura `in (test_ids v2)`,
  paginada pelo mesmo `lerPaginado`) e nunca usa as `linhas` em memória (dia `final` tem o valor congelado no banco e o recálculo de
  hoje na memória). Teste: linha `final` com 100 impressões no banco e 900 no recálculo: a decisão usa 100.

**Itens.**
1. **Relógio:** como acima. Teste (Yannis Y-9): pausa de 20 dias no meio; relógio correto.
2. **Piso de dias:** **dia válido** = `diaValido` (5.1). Cada variante com >= 4 dias válidos, e >= 2 blocos ABBA completos. Com 2
   variantes isso pede >= 8 dias; com 3, >= 12. Dia descartado adia o piso; nunca é preenchido por estimativa.
3. **Piso de volume:** cada variante com >= N impressões (`impressoes_com_ctr`), `N = k × (p1(1−p1) + p2(1−p2)) / (p2 − p1)²`,
   `p2 = 1,2 × p1`, `k = 7,85` com 2 variantes (α = 0,05) e `k = 9,50` com 3 (α = 0,025, (2,241 + 0,842)²). Com p1 = 4%: N ≈ 10.315
   (2) e ≈ **12.483** (3); contas refeitas por Phil e conferidas. Função pura `volumeMinimo(p1, nVariantes)`, testada com os dois valores.
   - **`p1` com guardas** (Phil A6): usa só dias da janela `[started_at − 14 dias, started_at)` com `diaComAlcanceValido` (5.1; não exige
     `variant_id`). Se < 7 dias, ou < 2.000 impressões com CTR, ou `p1 ∉ (0; 0,5)`: `p1 = 4%` e `base_estimada = true`
     (a tela diz "base estimada"). Grava `p1`, `p1_dias`, `p1_impressoes`. Nunca `NaN`/`Infinity` em `result_metadata`.
   - **Fonte do `p1`** (Yannis r2 N-1; Phil M4): os dias anteriores ao teste **não têm linha em `ab_test_dias`** (o retrato só grava dia com ciclo
     no ar), então o `p1` não sai dela. Função pura `baseDoVideo(entradas, videoId, ate)` recebe `alcancePorVideoDia`, `relatoriosPorCanalDia` e
     `metaPorVideoDia` (as leituras em lote que o `rodarRetrato` já faz; ampliar o `gte` de `desdeStr` para `min(desdeJanela, started_at − 14
     dias)` só para v2 **e só enquanto `result_metadata.v2.p1` ainda é nulo, mais a server action do aviso**: `p1` é congelado uma vez e a janela ampla não se repete a cada rodada, Phil R3) e devolve `{p1, dias, impressoes, p1_dias_sem_meta}` por `estadoDoAlcance` + `diaComAlcanceValido` aplicados ao alcance
     bruto. **Dia que pertenceu a outro teste A/B do mesmo vídeo fica fora**: a informação é `yt_own_video_meta_daily.ab_test_id` não nulo no
     dia (e, para auditoria, `ab_tests` + `ab_test_cycles` do vídeo no intervalo). Dia sem linha de `meta_daily` conta como não excluído e
     entra em `p1_dias_sem_meta` (gravado). Como `p1` é congelado com `p1`, `p1_dias`, `p1_impressoes`, a auditoria lê o congelado, não
     recalcula. O aviso do item 7 chama a mesma função com `ate = hoje` pela server action (14 linhas de `reach_daily` + relatórios do canal).
     Teste: vídeo com 14 dias de alcance antes do teste e nenhuma linha em `ab_test_dias` produz `p1` medido e `base_estimada = false`; dia com
     `ab_test_id` de outro teste fica fora.
   - **Congelamento:** N, `k`, `p1` são calculados e congelados na **primeira rodada v2 que encontra o teste sem eles**. A janela
     **não** é estável na primeira rodada (os 2 a 3 últimos dias ainda estão `aguardando`; o congelamento usa ~11 dias), por isso o
     determinismo vem da gravação, não da janela. Escrita atômica (item 5, RPC) com a flag `p_so_se_sem_n`; os campos congelados são imutáveis dentro da RPC.
     Vale para os três caminhos de criação. Teste: rodar a decisão duas vezes dá N idêntico, gravado uma vez; p1 = 0, janela de 3
     dias e janela com 300 impressões dão `base_estimada`.
4. **Estatística:** z de duas proporções nos totais (`impressoes_com_ctr`), bilateral, α = 0,05 (3 variantes: cada uma contra a
   original, α = 0,025), **corrigido pela superdispersão medida no próprio teste**:
   φ̂ = Σ_dias (cliques_d − imp_d · p̂_{v,b})² / (imp_d · p̂_{v,b}(1 − p̂_{v,b})) ÷ gl, com p̂_{v,b} o CTR da variante no bloco;
   `z_adj = z / √max(1, φ̂)`. Dia com `p̂_{v,b} ∈ {0, 1}` fica fora da soma (divisão por zero).
   - **Graus de liberdade** (Yannis M-3): `gl = D − células (variante, bloco) não vazias`, com D os dias válidos; célula com 1 dia
     entra com resíduo 0; bloco parcial no fim não cria célula vazia. Teste com bloco 3 parcial.
   - **t de Student, não normal** (Phil A2): `p_adj = 2 × (1 − T_gl(|z_adj|))`. Com φ real = 3 e gl = 4, a normal dá α real 0,122 (2,4×
     o prometido); com 3 variantes e gl = 6, 0,066 contra 0,025. Função pura `tCdf` (beta incompleta ou tabela para gl 2 a 30), testada
     contra valores conhecidos (t₄(2,776) = 0,975; t₆(2,969) = 0,9875). Grava `gl` em `result_metadata.v2`.
   - Passa se `p_adj < α` **e** o sinal da diferença é o mesmo em todo bloco completo. Grava `z`, `phi`, `z_adj`, `p_adj`, `gl` e os
     sinais por bloco. Com `gl < 2`, não passa (`sem_diferenca_detectavel`).
   - Motivo (Phil): o sinal por bloco sozinho, com 2 blocos, corta o falso positivo no máximo pela metade; com φ = 3 o p real do z
     nominal 1,96 é ~0,26 (~0,13 com o sinal). O intervalo sobre os blocos não serve (1 grau de liberdade, t = 12,7).
   - Testes: C-13b (φ ≈ 4, z cru p = 0,01, ajustado não passa) e simulação com φ = 1, 10.000 sementes, **PRNG com semente fixa (`mulberry32`), nunca `Math.random`** (teste que muda a cada rodada é flaky): taxa de "vencedor" <= α + 1 ponto.
5. **Quando decide, e como escreve:** a decisão v2 roda **no fim da própria rodada do `ab-retrato`** (14:00 UTC), depois do apply,
   com o mesmo `withCronLock`, lendo o banco (fonte da decisão, acima). Fora das janelas de promoção.
   - pisos de dias e de volume atingidos → encerra; relógio no teto sem os dois pisos → encerra;
   - **Dia da decisão** (Phil M3, N4 r3): `encerrado_em_dia` = último dia PT fechado antes de `ab_tests.completed_at` (o `settleOnAir` grava
     `completed_at`), **derivado do banco**, não do que a gravação do desfecho conseguiu escrever. A decisão o grava em `v2.encerrado_em_dia`
     junto com o desfecho, mas o recálculo do desfecho provisório usa `day_pt <= encerrado_em_dia` **mesmo sem o campo gravado** (calcula de
     `completed_at`), para `desfecho_no_encerramento` ser o que o nome diz também no caso "settle ok, gravação falhou". `encerrado_em_dia` é
     imutável na RPC (lista `c`, abaixo). Teste: settle ok + RPC do desfecho falhando; no dia seguinte, com dia novo de alcance chegando depois,
     `desfecho_no_encerramento` sai igual ao de um recálculo no dia da decisão.
   - encerrar = `settleOnAir(original, 'regra_v2')`, `completed_reason = 'regra_v2'`; **nunca** grava `winner_variant_id` (P2). O
     sugerido vai em `result_metadata.v2.vencedor_sugerido`.
   - **Ordem de escrita (escolha registrada entre Phil A7 e Yannis Y-6):** (i) `ab_settle_claim`/`settleOnAir` primeiro; (ii) só depois
     de confirmado, grava o desfecho. Settle que falha (YouTube, tempo, `naoVoltou`, `pausadoPorTesteYoutube`, `em_andamento`) não
     grava `desfecho`: grava `result_metadata.v2.tentativa_falhou` com a hora, chama `recordCronFailure('ab-retrato', ...)` com `etapa: 'decisao_v2'` no payload
     (nome sem entrada própria no `vercel.json` poderia virar `unknown`, alarme permanente no watchdog/`cron-health-report`: o plano
     confere; se o watchdog tolera nome sem agenda, `'ab-regra-v2'` serve) e a próxima rodada tenta de novo. **Só contam como falha**
     (Yannis m-1): `naoVoltou`, `em_andamento` repetido por 2 rodadas e exceção. `pausadoPorTesteYoutube` é desfecho legítimo (o
     `ab-evaluate` o trata como `continue`, `:84`): grava `tentativa_falhou` com `motivo: 'teste_youtube'` e **não** chama `recordCronFailure`. Settle ok e gravação do
     desfecho falhando: o teste fica `completed/regra_v2` **sem** `v2.desfecho`; a tela trata isso como "desfecho pendente", nunca "sem
     vencedor", e a próxima rodada grava (a seleção da decisão inclui esse caso). **`tentativa_falhou` limpa no sucesso** (Yannis R-3): o merge da RPC não apaga chave, então o
     sucesso grava `tentativa_falhou: null` no `p_v2`; `ResultadoV2` (Zod) declara `.nullish()` e a tela testa `!= null`. Teste: falha, depois sucesso: leitura sem aviso.
   - **Escrita atômica, com migration pequena na F4** (opção 1 de Yannis; **a F4 deixa de ser "sem migration"**): função SQL
     `ab_test_v2_gravar(p_test_id, p_v2, p_hist, p_so_se_sem_n) returns smallint`. Nunca ler-modificar-gravar pelo cliente (lost update).
     Migration por `npm run db:new`, G1 (antes do código que a chama). Texto pronto da migration (Yannis r3 R-2, com Phil N4 e R1; **proposta não
     rodada em banco: deve passar pelo teste de integração `HAS_LOCAL_DB`**):
     ```sql
     create or replace function public.ab_test_v2_gravar(
       p_test_id uuid, p_v2 jsonb, p_hist jsonb default null, p_so_se_sem_n boolean default false)
     returns smallint language plpgsql security definer set search_path = '' as $$
     declare
       -- imutáveis: entram uma vez e nunca mudam (inclui encerrado_em_dia, Phil N4)
       c constant text[] := array['n','k','p1','p1_dias','p1_impressoes','base_estimada',
                                  'p1_dias_sem_meta','desfecho_no_encerramento','encerrado_em_dia'];
       v_regra text;
       v_atual jsonb;
     begin
       -- trava a linha: dois escritores se serializam e o segundo reavalia o v2 já gravado
       select t.regra_duracao, coalesce(t.result_metadata->'v2','{}'::jsonb)
         into v_regra, v_atual
         from public.ab_tests t where t.id = p_test_id for update;
       if not found or v_regra is distinct from 'v2' then
         return -1;                                   -- inexistente ou não é v2
       end if;
       if p_so_se_sem_n and v_atual ? 'n' then
         return 0;                                    -- outro escritor já congelou
       end if;
       update public.ab_tests t set result_metadata = jsonb_set(
         coalesce(t.result_metadata,'{}'::jsonb), '{v2}',
         v_atual
         || (p_v2 - c - 'historico')                  -- congelados e historico nunca vêm direto de p_v2
         || coalesce((select jsonb_object_agg(f.k, p_v2->f.k) from unnest(c) as f(k)
                      where p_v2 ? f.k and not (v_atual ? f.k)), '{}'::jsonb)   -- teste de existência `?`, não coalesce (JSON null não é SQL NULL)
         || case when p_hist is null then '{}'::jsonb
                 else jsonb_build_object('historico',
                        coalesce(v_atual->'historico','[]'::jsonb) || p_hist) end,
         true)
       where t.id = p_test_id;
       return 1;                                      -- gravou
     end $$;
     revoke all on function public.ab_test_v2_gravar(uuid, jsonb, jsonb, boolean) from public, anon, authenticated;
     grant execute on function public.ab_test_v2_gravar(uuid, jsonb, jsonb, boolean) to service_role;
     ```
     Regras que o SQL cumpre (Phil r2 N1 = Yannis r2 N-4; Yannis R-2; Phil R1): (1) merge **um nível abaixo** (`jsonb_set` em `{v2}`; o `||` raso da r4
     apagava `n`, `p1`, `desfecho_no_encerramento`); `p_v2` carrega só o que muda e a RPC tira dele `historico` e os congelados; (2) **congelados gravados
     uma vez, dentro da RPC**, pelo teste `?` de existência: `n`, `k`, `p1`, `p1_dias`, `p1_impressoes`, `base_estimada`, `p1_dias_sem_meta`,
     `desfecho_no_encerramento`, `encerrado_em_dia`; (3) `historico` anexado em SQL, nunca substituído; (4) **retorno `smallint`** (Phil R1): `1` gravou, `0`
     já havia congelado (`p_so_se_sem_n`), `-1` teste inexistente ou não `v2`; o chamador trata `-1` como erro e `0` como "já havia"; (5) segurança como na
     migration da F1 (`:119-124`): `security definer`, `search_path = ''`, nomes qualificados, `revoke`/`grant` só `service_role`; (6) o `select ... for update`
     serializa dois escritores sem depender de reavaliação do `update`.
     **Testes de integração (`HAS_LOCAL_DB`):** (a) grava `n`, depois `tentativa_falhou`, depois `desfecho`, depois `desfecho_final`: `n`, `p1`,
     `base_estimada` e `desfecho_no_encerramento` continuam; (b) duas chamadas com a flag gravam `n` uma vez e a segunda devolve `0`; (c) segunda gravação de
     `desfecho_no_encerramento` e de `encerrado_em_dia` não muda; (d) `historico` cresce, não é substituído; **`p_v2` que traz `historico` não apaga o existente**;
     (e) `anon` e `authenticated` recebem `permission denied` (só por chamada com cliente comum e `expect(error)`: o banco de integração dá SIGSEGV ao chamar
     função sem EXECUTE por outra via); (f) teste inexistente e teste `v1` devolvem `-1`, diferente do `0` de "já congelado"; (g) `n: null` nunca é gravado
     (o Zod do chamador recusa). **Conferência pós-deploy:** `select result_metadata->'v2' - 'historico' from ab_tests where regra_duracao='v2' and
     status='completed'` com `n`, `p1` e `desfecho_no_encerramento` não nulos em todo teste que tenha `desfecho_final`, sem `NaN|Infinity`.
   - **Tempo e orçamento** (Yannis Y-3): `maxDuration = 120` no `ab-retrato`; extrair do `phaseEvaluateActiveTests` o laço
     `encerrarComPrazo(testes, motivo, inicioDaFuncao)` e chamá-lo das duas rotas, com `prazo = início + 105 s` e o mesmo
     `SETTLE_MINIMO_MS`/`FIM_DA_AVALIACAO_MS`. Com ~2 settles por rodada, o resto fica para a rodada seguinte. Teste: relógio injetado
     com 50 s gastos, o settle não começa e a nota "adiado por tempo" sai.
   - **Rede de segurança** (Yannis Y-4; r5 por Phil N2 = Yannis N-3): o relógio v2 para na pausa e o `started_at` não, então **a rede não
     mede em ms corridos** (`ab-evaluate-phases.ts:53`; teto 14, pausa de 5 dias: aos 17 dias em ms o relógio v2 está em 12, e a rede
     mataria um teste saudável). Para cada teste v2 `active`, o `ab-evaluate` lê os ciclos (uma consulta `in (ids v2)`, O(C) por teste, C <= 30) e
     calcula `diasDoTeste(ciclos, teste, ontem, primeiroDia).length`, o **mesmo relógio da decisão e da tela**, que não depende de `ab_test_dias` e por
     isso continua valendo com o retrato parado. Pula enquanto `< max_duration_days + 3`; acima disso encerra com `settleOnAir(original,
     'regra_v2')` e grava `desfecho = 'inconclusivo_por_falha'`. Testes: pausa de 5 dias com 12 dias de relógio (ms = 17): não encerra; retrato
     parado e relógio = 17: encerra; relógio = 15: pula. Fora isso o `ab-evaluate` não é tocado.
6. **Desfechos** (`result_metadata.v2.desfecho`), em ordem de precedência no teto:
   - `vencedor_provavel` (variante): pisos atingidos, estatística passa;
   - `sem_diferenca_detectavel`: pisos atingidos, estatística não passa ("nenhuma diferença de 20% ou mais com este volume"; nunca "empate");
   - `inconclusivo_por_dado`: teto sem o piso de dias (dias não medidos ou descartados). **Vence `inconclusivo_por_volume`** quando faltam
     os dois (sem dias o volume nem se mede);
   - `inconclusivo_por_volume`: teto com o piso de dias e sem N;
   - `inconclusivo_por_falha`: encerrado pela rede de segurança do `ab-evaluate` (item 5);
   - `aguardando_alcance`: encerrado com dias ainda `aguardando`. Na precedência fica **antes** de `inconclusivo_por_dado` quando o piso de dias
     é fechável pelos dias ainda `aguardando` (a tela diz "esperando o YouTube" e não "sem dado").
   **Ciclo de vida** (Phil A7 + Yannis Y-7, escolha registrada): todo desfecho nasce `provisorio = true` quando algum dia do teste não é
   `final`. A rodada recalcula a cada dia; quando todas as linhas do teste ficam `final`, recalcula uma última vez e grava `provisorio =
   false` com `desfecho_final`, **ao lado** de `desfecho_no_encerramento` (imutável); cada mudança de `desfecho` vai para
   `v2.historico` (desfecho e data). O encerramento não é desfeito; só o desfecho muda. A seleção da decisão inclui explicitamente
   `regra_duracao = 'v2' and status = 'completed' and coalesce((result_metadata->'v2'->>'provisorio')::boolean, true) = true`
   (em PostgREST, que não tem `coalesce` no filtro: `.eq('regra_duracao','v2').eq('status','completed').or('result_metadata->v2->>provisorio.is.null,result_metadata->v2->>provisorio.eq.true')`;
   teste com teste sem a chave `v2`, com `provisorio:false` e com `provisorio:true`; assim o teste não sai da seleção quando a última linha fecha pela RPC `ab_test_dias_fechar_antigas`). Nunca fica provisório depois do
   D+10 do último dia. Testes: settle que lança não deixa `desfecho`; teste encerrado com 2 dias `aguardando` que invertem o sinal
   muda de desfecho no D+10, mantém o inicial e guarda os dois no histórico.
   **Leitura do tipo:** `ResultMetadata` (`ab-types.ts:186`) passa a `{ v2?: ResultadoV2 } & Partial<legado>`; leitura por Zod
   (`safeParse`; inválido = "desfecho ilegível", nunca vazio).
7. **Aviso antes de iniciar:** impressões/dia = média dos dias com `diaComAlcanceValido` nos últimos 14 dias do vídeo (`baseDoVideo`, a mesma função de `p1`);
   dias previstos = `n_variantes × N / (impressões/dia)`. Se passa do teto: "este teste não chega ao volume em X dias; o desfecho
   provável é inconclusivo por volume", e o botão de iniciar continua. Com o teto entre o mínimo de validação (item 8) e mínimo + 2: "um dia sem medição já deixa o teste
   sem resultado" (a mesma conta do item 8; o aviso de teto abaixo do mínimo nem chega a aparecer, a validação recusa). Sem dado de alcance: "sem medição para estimar o volume", nunca "ok". O Cowork (`manage_ab_test`) devolve o mesmo
   aviso no mesmo campo, **pelo mesmo serviço único `avisoDeVolume(sb, videoId, agora)`** (3 leituras de 14 dias: alcance, meta, relatórios do canal; Yannis R-4) chamado pela server action e pelo Cowork, nunca dois cálculos (teste: mesma semente, mesmo texto nos dois caminhos), e **a F4 acrescenta à projeção do Cowork `result_metadata.v2`** (desfecho, provisório, N, p1, base_estimada,
   gl, p_adj, vencedor_sugerido), com o doc do domínio atualizado (Phil A9).
8. **Validação na criação v2** (Phil r2 N3): `rotation_pattern = 'abba'` e `max_duration_days >= piso + 1 + ATRASO_ALCANCE`, com `ATRASO_ALCANCE = 3`
   constante nomeada. Conta: dia válido exige `alcance_estado = medido`, o relatório chega em D+2 a D+3 (estimativa; o p95 real define a
   constante antes da F4, §11) e na decisão das 14:00 UTC os 2 a 3 últimos dias fechados estão `aguardando`; dias válidos no teto T = T − 1
   (início parcial) − 3 = **T − 4**. Logo o mínimo é **12 com 2 variantes (piso 8) e 16 com 3 (piso 12)**; abaixo disso, recusa com o motivo em
   uma frase ("o YouTube leva até 3 dias para enviar o alcance; com este teto o teste não chega a fechar os dias mínimos"). Com 3 variantes e
   teto 14 (o padrão de hoje) o máximo seria 10 dias válidos (< 12): o teste só decidiria no D+10; por isso o padrão de `max_duration_days` na criação vira
   `max(14, piso + 4)` (2 variantes 14, 3 variantes 16; **decidido pelo dono em 23/10/2026**, §10b). Testes: a semente do caso "teto aceito" põe `alcance_estado = medido` nos dias que
   provam o piso; 2 variantes com teto 12 é aceito e 11 recusado; 3 variantes com 16 aceito e 15 recusado; criação sem teto com 3 variantes grava 16 e com 2 grava 14, e um teste que apaga o parâmetro afirma o padrão (só se o dono aceitar a recomendação). Os campos `confidence_threshold`, `burn_in_days` e `stability_threshold` ficam no schema e são ignorados pela v2.
9. **`CompletedReason` e consumidores** (Yannis Y-10): a F4 acrescenta `'regra_v2'` a `CompletedReason` (`ab-types.ts:6`) e, em
   `coleta/versoes-origem.ts:86-104` (`papelNaThumb`, `default: never`, arquivo da A5: avisar a frente antes) e
   `coleta/versoes-step.ts:95`, trata como `inconclusive` (o encerramento é `settleOnAir(original)`; senão a reconstrução das versões deixa
   de marcar a volta da miniatura original). Em `ab-settle.ts`: `caminhoDe('regra_v2')` igual ao de `duracao_maxima` com
   `completed_reason: 'regra_v2'`, e `regra_v2` entra em `MOTIVOS_QUE_PAUSAM_SEM_ESCREVER`. Teste em `versoes-origem.test.ts`.
10. **Arquivos da F4 (C-1):** `ab-settle.ts`, `ab-evaluate-phases.ts`, `app/api/cron/ab-retrato/*`, `ab-gravacao/retrato-step.ts`,
   `ab-gravacao/retrato.ts` (grava `cycle_number` em `ciclos`), `ab-gravacao/decisao-v2.ts` (módulo novo: decisão, `blocoDoDia`, `volumeMinimo`,
   `tCdf`, `baseDoVideo`), `ab-gravacao/placar.ts`/`diaValido`, `ab-types.ts`,
   `coleta/versoes-origem.ts`, `coleta/versoes-step.ts`, `ab-lab/actions.ts`, playoff SQL (desligado), `lib/pipeline/services/youtube.ts`,
   a migration de `ab_test_v2_gravar`, docs do Cowork; conferido por `git diff --name-only`.

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
- Placar: uma leitura de `ab_test_dias` pela PK por abertura de tela. A lista do CMS não calcula placar; a lista do Cowork faz **uma** leitura em lote `in (test_ids)` (5.1), nunca uma por teste.
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
  `ausente_no_relatorio`, `expirado_sem_baixar` fica `nao_medido` na hora (o **estado**; `final` só no D+10, emenda r3 do §2.3) (semente local com os casos). Confere: Phil.
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
- **C-13.** Com menos de 4 dias válidos (`diaValido`) por variante, nenhum desfecho é `vencedor_provavel`, nem com
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
- **C-18.** Dois casos (Phil A11, Yannis M-1): pausa de 00:00 a 00:00 PT por 48 h tira 2 dias do relógio (o teto chega 2 dias depois);
  pausa de 12:00 a 12:00 PT por 48 h tira **1** dia (o dia da pausa e o da volta têm ciclo no ar, os dois parciais e `menos_de_90`).
  Confere: Yannis.
- **C-19 (F2).** Semente `confirmed` com `impressions = 500`, `clicks = 0`: placar e estatística dizem `nao_medido` por variante;
  `ab-backfill` não escreve as três colunas; um teste por ponto de `queries.ts` da lista do §4. Confere: Yannis.
- **C-20 (F3).** Tela e Cowork com os mesmos totais; erro de leitura vira erro de página; `diaValido` único (teste do dia sem CTR). Confere: Yannis, Gio.
- **C-21 (F4).** `p1` com guardas e sem `NaN`/`Infinity`; `t` de Student (simulação φ = 1 com taxa <= α + 1 ponto); bloco por `cycle_number`
  (pausa e rotação forçada); teto T dá T − 1 dias inteiros e validação `piso + 1 + 3` (12/16); `p1` por `baseDoVideo` sem linhas em `ab_test_dias`; RPC `ab_test_v2_gravar` com merge um nível abaixo e imutáveis; rede do `ab-evaluate` pelo relógio por ciclos (pausa de 5 dias não encerra); lista do Cowork com 1 leitura; settle que falha não deixa `desfecho`; `desfecho_final`
  ao lado de `desfecho_no_encerramento`; `inconclusivo_por_falha` pela rede do `ab-evaluate`; `regra_v2` em `versoes-origem.ts`. Confere: Phil, Yannis.

---

## 9. Deploy e portões

- F1: pode ir antes do E8 (2.5), com a migration pela fila, antes de 30/10, e G1 (migration antes do
  código que lê a tabela).
- F2, F3 e F4: **presas ao G0**. Código pode ser escrito já; deploy só depois do E8 do T19 e do lembrete
  do título do `Uy5_DPzoGi8`. Ordem: F2 → F3 → F4 (G3: o conserto da falha em verde antes de o alcance
  aparecer).
- G2: garantido pelo default `v1` da F1 e pela F4 escrever `v2`.
- G4: Phil e Yannis no fim deste spec e de cada lote.
- **F2 e F3 em envios separados.** Entre as duas o placar fica "não medido" para todos (esperado; o Gio confere isso, não "placar quebrado").
- **`npm run db:push:prod` antes do push do commit 2 da F4** (Yannis m-6): o commit chama a RPC.
- A F4 tem **uma migration pequena** (`ab_test_v2_gravar`, 5.2 item 5; a coluna e os dois CHECKs vêm na F1), **toca `ab-settle.ts`**
  (`MotivoSaida`, `caminhoDe`, `MOTIVOS_QUE_PAUSAM_SEM_ESCREVER`), `ab-evaluate` (guarda `v2` no commit 1; rede de segurança pelo relógio por ciclos no commit 2) e `versoes-origem.ts`
  (A5); tudo só vai ao ar depois do E8.
- **F4 em três commits, árvore verde, cada um inerte até o último** (Yannis): (1) `CompletedReason` + `versoes-origem.ts` +
  `caminhoDe('regra_v2')` + só a **guarda** `v2` do `ab-evaluate`, sem teste v2 existente, efeito zero; (2) migration `ab_test_v2_gravar`
  (regenerar `database.types.ts` ali) + **a rede de segurança do `ab-evaluate`** (ela grava pela RPC, que só nasce aqui; Yannis R-1) + decisão
  no `ab-retrato` (`maxDuration = 120`), só age sobre v2, que ainda não existe; (3) os três caminhos de criação gravam `v2`: ativa.
  Desfazer: reverter o 3 para criar sem v2; testes v2 no ar seguem com o 2; reverter o 2 exige antes não haver teste v2 ativo (a rede depende da RPC).
  Teste: typecheck verde em cada commit isolado (checkout de cada um, sem stash).

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
- **Conferência pendente pelo dono/controlador (leitura em produção, `supabase db query --linked`; Phil não leu produção):** Q1 no §4 item 6;
  Q2 `select alcance_estado, count(*), count(*) filter (where impressoes = 0) imp0, count(*) filter (where ctr is null and impressoes is not null)
  sem_ctr from ab_test_dias group by 1;` (mostra se `medido` com 0 e CTR nulo acontece de fato; justifica `diaValido`); Q3 `select thumbnail_ctr from
  yt_own_video_reach_daily where thumbnail_ctr is not null order by day_pt desc limit 20;` (casas decimais do CTR; com 2 casas em porcentagem o erro de
  cliques reconstruídos é <= 0,005% × impressões, desprezível; conferir antes do plano da F4; Phil A13).
- **Portão da F4 (Yannis M-6, m-5) e ação do controlador:** a conferência do D+10 (p95 de `normalized_at − end_time` dos `channel_reach_basic_a1`)
  precisa de uma linha no `ACOMPANHAMENTO.md` ("S8-F1+14: p95 de `normalized_at − end_time`") com a data real do deploy da F1 + 14 dias; o valor
  também define `ATRASO_ALCANCE` (5.2 item 8). **Este spec não edita o `ACOMPANHAMENTO.md`: registrar a linha é ação do controlador**, e a conferência
  **bloqueia o plano da F4**, não é só nota.
- Phil não conferiu se `ab-backfill` tem outro leitor além de `queries.ts`; o plano da F2 faz esse grep. Yannis não rodou suíte nem typecheck e não
  conferiu `forceRotate` com `cycle_number` (5.2, bloco ABBA). Tempo real de `settleOnAir` dentro de 120 s não medido. Valor real de φ no canal idem.
- Horas de cada fase: sem estimativa; pedir a Phil e Yannis.

**Conferências com data (leitura):** D+1 da F1, `select regra_duracao, count(*) from ab_tests group by 1` (só `v1`);
24 sondas em 24 horas do T19 e zero `sem_referencia`; D+3, nenhum `aguardando` com `day_pt < current_date − 10`.

---

## 10b. Decisões do dono: estado na r4

As decisões 2, 3 e 4 do §10 ficam **"recomendação, aguarda dono"** (Phil concorda com as recomendações 1 a 4; 2, 3 e 4 não bloqueiam F2/F3).
Nenhuma foi decidida nesta revisão (r5.1 incluída).

**Nova (r5, Phil r2 N3), decidido pelo dono em 23/10/2026 (forma da r5.1 abaixo):** subir o **padrão** de `max_duration_days` com 3 variantes de 14 para **16** (o de 2
variantes fica 14). Custo: até 2 dias a mais de exposição na variante pior em teste de 3 variantes, contra um teste que nunca decidiria
(com teto 14 e 3 variantes o máximo é 10 dias válidos para um piso de 12). A validação (12 e 16 como mínimos, item 8) entra sem decisão do
dono; só o valor padrão espera. Hanna leva ao dono.

**Padrão na criação (r5.1, Phil r3 N5), DECIDIDO pelo dono em 23/10/2026 ("16, calculado"):** em vez de uma constante, o padrão de `max_duration_days` nos três caminhos de
criação (C-12) vira `max(14, piso + 4)` (= `max(14, piso + 1 + ATRASO_ALCANCE)`): 2 variantes 14, 3 variantes 16, sem constante por número de variantes. Sem
esse padrão, a criação de teste de 3 variantes com o teto omitido (14) leva recusa da validação no dia do deploy da F4. **Alternativa: a F4 só vai a
produção depois da resposta do dono** (portão duro; uma pergunta binária que Hanna leva). Enquanto o dono não responde, vale o texto acima (padrão 14 e a
validação recusando 3 variantes sem teto à mão). Teste se aceito: criação sem teto com 3 variantes grava 16, com 2 grava 14, e o teste apaga o parâmetro. As escolhas técnicas da r4 (RPC `ab_test_v2_gravar`, bloco por `cycle_number`, `t` de Student,
`inconclusivo_por_falha`) são de engenharia e não mudam nenhuma decisão do dono.

---

## Registro de revisões

- r1 (18/10): 1º rascunho, Opus.
- r2 (18/10): conserto da r1 de Phil e Yannis.
- r3 (18/10, emenda do plano da F1): §2.3 e C-3 dizem que `final` só vale no D+10 e que `motivo_nulo_meta` é recálculo da S8.
- **r5 (23/10, só F2–F4):** emendas dos pareceres r2 de Phil (87, NÃO) e Yannis (88, NÃO); detalhe no "Registro r5" ao fim.
- **r5.1 (23/10, só F2–F4):** emendas finais dos pareceres r3 de Phil (92, SIM) e Yannis (94, SIM); detalhe no "Registro r5.1" ao fim.
- **r4 (24/10, só F2–F4):** conserto dos pareceres r1 de Phil (74, NÃO) e Yannis (79, NÃO). Decisão do controlador: a F2 para a gravação de
  views como impressões e toda soma desses ciclos; F2 e F3 em envios separados.

### Registro r4 (achado → onde entrou)

Escolhas onde os dois propunham coisas diferentes: **bloco** = `floor((cycle_number − 1) / (2V))` 1-based (Phil; Yannis usava 0-based, igual
em efeito) com `cycle_number` lido de `ab_test_cycles` (Yannis) **e** gravado em `ciclos` na F4 (Phil); **desfecho/settle** = settle primeiro,
desfecho depois (Phil), com RPC atômica (Yannis) e "desfecho pendente" na tela (Yannis), mais `desfecho_final` ao lado do inicial e `historico`
(Phil + Yannis); **Cowork** = função `placarDoTeste` compartilhada na F3 (Yannis) e `v2` na projeção na F4 (Phil).

| Achado | Onde entrou |
|---|---|
| Phil A1 (crítico), Yannis Y-1 | §4 itens 1 a 6 (corta escrita do `ab-backfill` e toda leitura; nulo = não medido; Q1), §9, C-19 |
| Phil A2 | §5.2 item 4 (t de Student, `gl` gravado, `tCdf`, simulação φ = 1), C-21 |
| Phil A3 | §5.2 definições (dias fechados, T − 1), item 8 (`piso + 1`), item 7 (aviso 3 variantes), C-21 |
| Phil A4, Yannis Y-5 | §5.2 definições (bloco por `cycle_number`, gravado em `ciclos` na F4), C-21 |
| Phil A5, Yannis M-2 | §3 (`medido` com 0), §5.1 (`diaValido`, `impressoes_com_ctr`), §5.2 item 2 |
| Phil A6 | §5.2 item 3 (guardas de `p1`, congelamento, `NaN`) |
| Phil A7, Yannis Y-6, Y-7 | §5.2 item 5 (ordem de escrita, RPC, desfecho pendente) e item 6 (provisório, `desfecho_final`, `historico`, seleção), §9 |
| Phil A8 | §4 item 2 (todos os pontos de `queries.ts`, `IntelligenceAbTestSummary`) |
| Phil A9, Yannis Y-8 | §5.1 (`placarDoTeste`, Cowork, docs, filtro `site_id`, erro de leitura, "atualizado em"), §5.2 item 7 (`v2` no Cowork) |
| Phil A10 | §5.2 item 6 (precedência `inconclusivo_por_dado`) |
| Phil A11, Yannis M-1 | C-18 (dois casos) |
| Phil A12 | §5.2 (teto = `max_duration_days`, definições e item 8) |
| Phil A13, Q2, Q3 | §11 (conferências pendentes pelo dono/controlador) |
| Phil Q1 | §4 item 6 e §11 (conferência pendente) |
| Yannis Y-2 | §5.2 definições (fonte da decisão: banco pós-apply) |
| Yannis Y-3 | §5.2 item 5 (`maxDuration = 120`, `encerrarComPrazo`, `recordCronFailure('ab-regra-v2')`) |
| Yannis Y-4 | §5.2 item 5 (rede de segurança `max + 3`) e item 6 (`inconclusivo_por_falha`) |
| Yannis Y-9 | §5.2 definições e item 1 (relógio sem a janela de 40 dias) |
| Yannis Y-10 | §5.2 item 9 |
| Yannis M-3 | §5.2 item 4 (`gl` por células não vazias) |
| Yannis M-4 | §5.2 item 6 (tipo `ResultMetadata`, Zod) |
| Yannis M-5 | arquivos por fase: §4 item 4, §5.1, §5.2 item 10 |
| Yannis M-6 | §11 (portão da F4 com data) |
| Yannis §6 (deploy e ordem), dívidas | §9 (três commits, desfazer); dívida `diaDoTeste` v1 em §5.2 definições |
| Decisões 2, 3, 4 do §10 | §10b: recomendação, aguarda dono |
| Não aplicado | nada; os itens que o spec não pode provar sem produção ou código (Q1–Q3, `forceRotate`, grep de outro leitor do `ab-backfill`) ficam como conferência no §11 |

### Registro r5 (achado → onde entrou)

Escolhas onde os dois coincidiam: RPC `ab_test_v2_gravar` (Phil N1 = Yannis N-4) unida num só texto (merge um nível abaixo, congelados uma vez, `historico` em SQL,
retorno `boolean`, `revoke`/`grant` e `search_path` como na migration da F1, testes de integração); rede do `ab-evaluate` (Phil N2 = Yannis N-3) pelo relógio
por ciclos (`diasDoTeste`), não em ms. Phil N3: validação 12/16 entra sem dono; subir o padrão de 3 variantes para 16 vai como "recomendação, aguarda dono".

| Achado | Onde entrou |
|---|---|
| Phil N1, Yannis N-4 | §5.2 item 5 ("Escrita atômica", regras 1 a 6), item 3 (congelamento), §9 (`db:push:prod` antes do commit 2) |
| Phil N2, Yannis N-3 | §5.2 item 5 ("Rede de segurança" pelo relógio por ciclos), §9, C-21 |
| Phil N3 | §5.2 item 8 (validação 12/16, `ATRASO_ALCANCE = 3`, testes), item 7 (aviso), item 6 (`aguardando_alcance` na precedência), §10b (padrão 16, aguarda dono), §11 |
| Phil M1 | §4 item 1 (rota fora do `vercel.json`, `cron-health-report`, D+1 com zero invocações) |
| Phil M2 | §5.1 (`diaComAlcanceValido` e `diaValido`), §5.2 item 3, C-13 |
| Phil M3 | §5.2 item 5 (`v2.encerrado_em_dia`, recálculo só até esse dia) |
| Phil M4 | §5.2 item 3 (fonte do "outro teste": `meta_daily.ab_test_id`, `ab_tests` + `ab_test_cycles`) |
| Phil M5 | §5.2 item 5 (`recordCronFailure('ab-retrato')` com `etapa` no payload; plano confere o watchdog) |
| Yannis N-1 | §5.2 item 3 (`baseDoVideo`, fonte do `p1`, `p1_dias_sem_meta`), item 7 |
| Yannis N-2 | §5.1 (lista do Cowork com 1 leitura em lote, `projetarTeste` pura), §7 |
| Yannis m-1 | §5.2 item 5 (`pausadoPorTesteYoutube` não é falha) |
| Yannis m-2 | §4 item 4 (`intelligence-types.ts`), §5.2 item 10 (arquivos centrais da F4) |
| Yannis m-3 | §5.2 item 4 (PRNG `mulberry32` com semente fixa) |
| Yannis m-4 | §5.2 item 6 (seleção em PostgREST, três casos de teste) |
| Yannis m-5 | §11 (linha do `ACOMPANHAMENTO.md` é ação do controlador; arquivo não editado aqui) |
| Yannis m-6 | §9 (`db:push:prod` antes do push do commit 2) |
| Não aplicado | nada; o p95 do atraso do alcance (define `ATRASO_ALCANCE`) segue conferência com data |

### Registro r5.1 (achado → onde entrou)

Ambos deram SIM (Phil 92, Yannis 94); só texto, sem nova rodada. SQL da RPC colado no §5.2 item 5 (Yannis R-2) unindo Phil N4 (`encerrado_em_dia` na lista de
imutáveis) e Phil R1 (retorno `smallint`: 1 gravou, 0 já havia, -1 não é v2); o SQL não foi rodado em banco, a prova é o teste de integração.

| Achado | Onde entrou |
|---|---|
| Phil N4 | §5.2 item 5 ("Dia da decisão": `encerrado_em_dia` derivado de `completed_at`; RPC: imutável; teste settle ok + gravação falha) |
| Phil N5 | §5.2 item 8 (padrão `max(14, piso + 4)`), §10b (recomendação, aguarda dono; alternativa "F4 só vai a produção depois da resposta"); validação 12/16 inalterada |
| Phil R1, Yannis R-2 | §5.2 item 5 (SQL pronto, retorno `smallint`, `?` no lugar de `coalesce`, `historico` fora de `p_v2`, testes (d), (f), (g)) |
| Phil R2 | §5.1 (ordem `test_id, day_pt` e `ids` em lotes de 100 na lista do Cowork) |
| Phil R3 | §5.2 item 3 (janela ampla de `baseDoVideo` só enquanto `p1` é nulo e na server action) |
| Yannis R-1 | §9 (rede do `ab-evaluate` passa do commit 1 para o 2; desfazer; typecheck por commit) |
| Yannis R-3 | §5.2 item 5 (`tentativa_falhou: null` no sucesso, Zod `.nullish()`) |
| Yannis R-4 | §5.2 item 7 (serviço único `avisoDeVolume`) |
| Não aplicado | nada; `settleOnAir` gravando `completed_at` (N4) e o upsert de `ab_test_id` em `meta-step.ts:81` ficam para o plano conferir |
