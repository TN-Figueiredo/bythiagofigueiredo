# Spec S8: gravação por variante e dia, placar com alcance da A5 e regra nova de duração

Escrito em 18/10/2026 (1º rascunho, Opus). Fatia S8 do plano conjunto
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
| — | Relatório bruto de alcance | A Reporting API guarda o relatório por tempo limitado (janela **não conferida**) | já é da A5: `yt_reporting_report_blobs` guarda o CSV |
| — | Views por hora do vídeo próprio | `yt_own_public_video_hourly` pode ser dobrada e podada (retenção **não conferida**) | pedido à A5 (2.6) |

O alcance diário e o diário de views já são gravados pela A5 e não dependem da S8. O risco deles é a
coleta atrasar além da janela da origem; o alerta da A5 ("relatório listado há mais de 14 dias") cobre.

### 2.2 R1: carimbo da regra no teste

- Coluna nova `ab_tests.regra_duracao text not null default 'v1' check (regra_duracao in ('v1','v2'))`.
- A migration grava `'v1'` em todo teste existente (o default faz isso; o T19 fica `v1`).
- Na F1 **nenhum código escreve a coluna**: todo teste criado até o deploy da F4 nasce `v1`. A F4 passa a
  escrever `'v2'` nos três caminhos de criação (fato 9). Assim o G2 vale sozinho: "regra nova só para
  teste criado depois do deploy da regra".
- A mesma migration acrescenta `'regra_v2'` ao CHECK de `completed_reason` (usado só pela F4). Aditivo.
- *O que acontece quando o dado não existe?* Não existe linha sem valor: `not null` com default.
  Um caminho de criação que a F4 esquecer cai em `v1` (regra antiga, que só encerra por duração): falha
  conservadora, mas é falha. O C-12 pega.

### 2.3 R2: retrato diário por teste e dia

Tabela nova `ab_test_dias` (nome proposto). Uma linha por **teste × dia do Pacífico** em que algum ciclo
do teste esteve no ar.

| Coluna | Conteúdo | Nulo quer dizer |
|---|---|---|
| `test_id uuid`, `day_pt date` | PK `(test_id, day_pt)`. Sem FK: o retrato sobrevive ao teste apagado | — |
| `site_id`, `youtube_video_id` (11 caracteres) | como em `yt_own_video_*` (nunca juntar com `ab_tests.youtube_video_id`, que é outra coisa: spec honesto 4.2.2) | — |
| `regra_duracao` | cópia do carimbo do teste | — |
| `variant_id uuid` | variante atribuída ao dia (2.3.1) | dia não atribuído |
| `motivo_sem_variante` | `menos_de_90`, `meta_ausente`, `meta_nula` (com o `motivoNulo` da A5), `teste_pausado` | — |
| `segundos_no_ar`, `segundos_do_dia` | `seconds_on_air_analytics` e a duração do dia por `boundsAnalytics` (82 800, 86 400 ou 90 000) | meta ausente |
| `dia_de_troca boolean` | a variante do dia é diferente da do dia anterior do mesmo teste | primeiro dia ou anterior sem variante |
| `ciclos jsonb` | ids, `started_at`, `ended_at` dos ciclos que tocam o dia (janelas de rotação) | — (array vazio nunca: sem ciclo não há linha) |
| `impressoes bigint`, `ctr numeric` | de `yt_own_video_reach_daily` | ver `alcance_estado` |
| `alcance_estado` | `medido`, `zero_medido` (relatório do dia normalizado, sem linha do vídeo), `aguardando` (sem relatório e dentro do prazo), `nao_medido` (prazo vencido ou erro) | — |
| `source_report_id`, `report_create_time` | de onde veio o número | sem linha de alcance |
| `views bigint`, `views_estado` | de `yt_own_video_daily.views` do **dia** (nunca o total de 90 dias do diário do Observatório) e o estado pela cobertura da MG14 (`medido`, `zero_medido`, `nao_medido`) | ver estado |
| `troca_vista_em timestamptz` | primeira sonda (2.4) do dia que viu a miniatura da variante do dia | sem sonda, ou teste só de título |
| `retratado_em`, `final boolean` | hora da gravação; `final` = não muda mais | — |

**Escritor:** rota nova `/api/cron/ab-retrato`, uma vez por dia às 14:00 UTC (depois da meta das 12:00 e
fora das janelas de promoção). Lê `ab_tests` (ativos, pausados e encerrados há até 10 dias),
`ab_test_cycles`, `yt_own_video_meta_daily`, `yt_own_video_reach_daily`, `yt_reporting_reports`,
`yt_own_video_daily`, `yt_own_video_coverage` e a sonda. Escreve **só** em `ab_test_dias` (upsert).
Não escreve em `ab_tests`, nos ciclos nem no YouTube.

**Regravação:** uma linha com `final = false` é recalculada a cada dia. Vira `final = true` quando
alcance e views estão em estado final, ou no dia D+10 (o que vier antes); no D+10, `aguardando` vira
`nao_medido`. Relatório reescrito depois do `final` não muda o retrato; o bruto da A5 guarda a história.

#### 2.3.1 Atribuição do dia à variante (o JOIN)

- Chave: `yt_own_video_meta_daily` por `(youtube_video_id, day_pt)` com `ab_test_id = test_id`.
- O dia é da variante `ab_variant_id` se `seconds_on_air_analytics >= 0,9 × segundos_do_dia`.
  **Mudança em relação ao spec honesto 4.2.2:** o limiar deixa de ser 77 760 s fixos e passa a ser 90% do
  próprio dia (23, 24 ou 25 h). No dia de 25 h, 77 760 s são só 86,4%. Teste de aceite em 6 (G5).
- Usa o par `_analytics`, nunca o `_reporting` (fato 5).
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

- Rota nova `/api/cron/ab-sonda-miniatura`, a cada hora no minuto 15. Para cada teste `active` do tipo
  `thumbnail` ou `combo`: GET anônimo em `https://i.ytimg.com/vi/<id>/hqdefault.jpg`, calcula dHash com
  `lib/youtube/thumb-fingerprint.ts` (importa, não copia; `DHASH_MAX_SAME` não muda neste ciclo).
- Tabela nova `ab_test_sondas`: `test_id`, `lida_em`, `http`, `etag`, `sha16`, `dhash`,
  `variante_vista` (variante cujo dHash bate por Hamming ≤ `DHASH_MAX_SAME`; nulo se nenhuma bate),
  `variante_esperada` (a do ciclo aberto). Nulo = não lido, nunca `""` nem `0`.
- Zero teste ativo = zero requisição. Sem cota da Data API (o CDN não tem cota).
- Só lê o YouTube. Não escreve no YouTube, não fala com o drift, não pausa nada.
- *Dado ausente:* sonda que falhou grava a linha com `http` e o resto nulo. Hora sem linha = cron não
  rodou; a tela nunca deduz "troca não vista" de hora sem linha.
- Título: fora da sonda neste ciclo. Quando a S4 (A5) estiver no ar, as leituras da watch do vídeo em
  teste servem de sonda de título (a A5 já lê todo vídeo em teste nosso, pergunta 8).

### 2.5 A F1 pode ir ao ar antes do E8? Sim, sem ferir o G0

O G0 proíbe ir ao ar, antes do E8, o que muda rotação, `settleOnAir`, drift ou avaliação. A F1:
- não altera `ab-rotate`, `ab-rotation.ts`, `ab-settle*.ts`, `ab-drift.ts`, `ab-watchdog*`,
  `ab-evaluate*`, `ab-statistics.ts`, `ab-gates.ts`, `ab-lab/queries.ts` nem `ab-lab/_components/*`;
- acrescenta duas rotas novas, duas tabelas novas e uma coluna com default; o T19 ganha `regra_duracao =
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

### 2.6 Pedido à A5 (mensagem do controlador, não deste spec)

1. Confirmar a retenção de `yt_own_public_video_hourly` e se a dobra apaga horas de vídeo em teste nosso.
   Se apagar, pedir que vídeo com teste nosso (ativo ou encerrado há até 30 dias) fique fora da poda.
2. Confirmar a janela de retenção dos relatórios na Reporting API e que o atraso de download nunca
   chega perto dela.

---

## 3. Estados do dado (valem para F3 e F4)

| Estado | Quando | Tela | Conta como |
|---|---|---|---|
| `medido` | linha de alcance com impressões não nulas | número | dado |
| `zero_medido` | relatório do dia normalizado, sem linha do vídeo | **0** (sabido) | dado, com 0 impressões |
| `aguardando` | sem relatório, até D+10 | "aguardando o YouTube" | não é dado |
| `nao_medido` | depois de D+10, erro, ou impressão nula na linha | hachura "não medido" (mockup S9) | não é dado |
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
   conta em milissegundos (fato 8) só para `v2`. Uma função só, reusada pela tela e pela avaliação.
2. **Piso de dias:** cada variante com ≥ 4 dias válidos com alcance em estado de dado (`medido` ou
   `zero_medido`), e ≥ 2 blocos ABBA em que toda variante tem ao menos 1 dia válido. Com 2 variantes
   isso pede ≥ 8 dias; com 3, ≥ 12. Um dia descartado adia o piso; nunca é preenchido por estimativa.
3. **Piso de volume:** cada variante com ≥ N impressões, `N = 7,85 × (p1(1−p1) + p2(1−p2)) / (p2 − p1)²`,
   `p2 = 1,2 × p1`. `p1` = CTR ponderado do vídeo nos 14 dias antes do início, gravado no início em
   `result_metadata.v2.p1`. Sem CTR anterior medido, `p1 = 4%` e a tela diz "base estimada". N é gravado
   no início e não muda no meio do teste. Com 4%: N ≈ 10.300.
4. **Estatística:** z de duas proporções nos totais, bilateral, α = 0,05 (com 3 variantes, cada uma
   contra a original, α = 0,025). E o sinal da diferença igual em todos os blocos completos. As duas
   coisas. `[PARA PHIL]`: confirmar que a checagem de sinal por bloco basta contra a superdispersão
   (parecer 18/10, seção 4), ou trocar por intervalo sobre os blocos.
5. **Quando decide:** na avaliação diária (12:00 UTC), lendo só o retrato.
   - piso de dias e de volume atingidos → encerra;
   - relógio no teto sem os dois pisos → encerra;
   - encerrar = `settleOnAir(original, 'regra_v2')`, `completed_reason = 'regra_v2'`; **nunca** grava
     `winner_variant_id` (P2: escolher o que fica no ar é do dono). O sugerido vai em
     `result_metadata.v2.vencedor_sugerido`.
6. **Desfechos** (`result_metadata.v2.desfecho`):
   - `vencedor_provavel` (variante): pisos atingidos, estatística passa;
   - `sem_diferenca_detectavel`: pisos atingidos, estatística não passa ("nenhuma diferença de 20% ou
     mais com este volume"; nunca "empate");
   - `inconclusivo_por_volume`: teto sem N;
   - `inconclusivo_por_dado`: teto sem o piso de dias por falta de dado (dias não medidos ou descartados);
   - `aguardando_alcance`: encerrado no teto com dias ainda `aguardando`; o retrato reavalia até todos os
     dias ficarem `final` e então grava o desfecho definitivo. Nunca fica em `aguardando_alcance` depois
     do D+10 do último dia.
7. **Aviso antes de iniciar:** impressões/dia = média dos dias com alcance em estado de dado nos últimos
   14 dias do vídeo; dias previstos = `n_variantes × N / (impressões/dia)`. Se passa do teto: "este teste
   não chega ao volume em X dias; o desfecho provável é inconclusivo por volume", e o botão de iniciar
   continua. Sem dado de alcance para estimar: "sem medição para estimar o volume", nunca "ok". O Cowork
   (`manage_ab_test`) devolve o mesmo aviso no mesmo campo.
8. **Validação na criação v2:** `rotation_pattern = 'abba'` (os blocos só existem nela) e
   `max_duration_days ≥` piso (8 ou 12). Os campos `confidence_threshold`, `burn_in_days` e
   `stability_threshold` ficam no schema e são ignorados pela v2 (como `auto_apply_winner`).

---

## 6. Teste de aceite do dia de 25 h (G5)

Por data relativa (regra anti-regressão): o teste acha o próximo dia do Pacífico com 25 h procurando,
com `boundsAnalytics`, o primeiro dia de duração 90 000 s a partir de hoje. Nunca a data escrita.
- dia de 25 h com variante 86 400 s no ar → válido (96%);
- dia de 25 h com 80 000 s → **descartado** (88,9%), embora passe no limiar fixo antigo de 77 760;
- dia de 23 h (procurado do mesmo jeito) com 76 000 s → válido (91,8%), embora falhe no limiar fixo;
- teste que atravessa o dia de 25 h: o relógio conta esse dia como 1; o piso de 8 dias não fecha 1 h
  antes nem depois;
- retrato do dia de 25 h: `segundos_do_dia = 90 000`.

---

## 7. Custo de consulta e volume

- `ab-retrato`: por teste, leituras por faixa de PK em `meta_daily`, `reach_daily`, `video_daily`
  (≤ 38 linhas cada: 28 dias mais 10 de espera) e em `yt_reporting_reports` do canal (sem índice por
  `(channel_id, report_type_id, start_time)`; tabela pequena, varredura aceitável; Phil confere o
  tamanho). Com 3 testes, menos de 1 s.
- Sonda: 24 GET por dia por teste ativo; com 3 testes ao mesmo tempo, 72 linhas por dia (~26 mil por
  ano, alguns MB). Sem poda neste ciclo; gatilho de rever: 100 MB.
- Retrato: ≤ 28 linhas por teste; ~30 testes por mês dão < 1.000 linhas por mês.
- Placar: uma leitura de `ab_test_dias` pela PK por abertura de tela. A lista não calcula placar.
- Cota da Data API: zero chamada nova. Cron: duas rotas novas (`vercel.json` tem 49 agendas hoje; o
  limite do plano da Vercel não foi conferido).
- RLS das tabelas novas: leitura pela mesma função que protege `yt_own_video_reach_daily` hoje (alcance
  é dado privado do canal); escrita só por service role. Nunca `site_visible`.

---

## 8. Critérios de aceite

F1:
- **C-1.** O diff da F1 não toca nenhum arquivo da lista de 2.5 (conferido por `git diff --name-only`
  no lote). Confere: Yannis.
- **C-2.** Depois da migration, `select regra_duracao, count(*) from ab_tests group by 1` dá só `v1`;
  o T19 (`0d31687e`) é `v1`. Confere: Phil.
- **C-3.** Com o T19 ativo, o `ab-retrato` grava uma linha por dia com ciclo no ar; um dia sem
  relatório fica `aguardando`, um dia com relatório vazio fica `zero_medido` (semente local com os dois
  casos). Confere: Phil.
- **C-4.** Teste que apaga a linha de `meta_daily` de um dia: o retrato grava `variant_id` nulo com
  `motivo_sem_variante = 'meta_ausente'`, nunca a variante do ciclo. Confere: Yannis.
- **C-5.** A sonda grava, no T19 em produção, uma linha por hora; sonda com erro grava `http` e nulos,
  nunca `""`. Confere: Phil, depois de 1 dia.
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
- **C-13.** Com menos de 4 dias válidos por variante, nenhum desfecho é `vencedor_provavel`, nem com
  volume enorme. Confere: Phil.
- **C-14.** No teto sem N: `inconclusivo_por_volume`; com dias não medidos: `inconclusivo_por_dado`.
  Confere: Phil.
- **C-15.** Encerramento v2 nunca escreve `winner_variant_id`. Confere: Yannis.
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
- A F4 não precisa de migration nova (a coluna e o CHECK vêm na F1).

---

## 10. Decisões abertas para o dono

1. **F1 antes do E8 com a sonda horária.** Recomendação: sim. Custo: duas rotas e duas tabelas a mais;
   sem ela, o viés de 12,5% fica só estimado para sempre. Contra: a fila do banco ganha uma migration
   antes de 30/10.
2. **N corrigido pela mistura da rotação?** Com mistura média de ~6%, 20% de ganho real aparece como
   ~17,6%; corrigir subiria N de ~10.300 para ~13.300. Recomendação: **não corrigir** (fica o N que o dono
   aprovou); a mistura não cria vencedor falso, só deixa mais testes inconclusivos. A tela diz que o
   ganho medido é limite inferior.
3. **Encerrar cedo quando os pisos fecham, voltando à original.** Recomendação: sim, como hoje no teto
   (nada aplicado sozinho, o dono aplica o sugerido em 1 toque). Custo: a variante vencedora fica fora do
   ar até ele agir. Alternativa: continuar a rotação até o teto e só avisar (gasta dias de exposição na
   variante pior).
4. **Limiar de 90% do próprio dia em vez de 77.760 s fixos.** Recomendação: sim (é o G5). Custo: nenhum
   fora do dia de 25 h ou de 23 h.

---

## 11. O que NÃO conferi

- Janela de retenção dos relatórios na Reporting API e retenção de `yt_own_public_video_hourly` (2.6).
- Atraso real do relatório de alcance (consulta 1 do parecer do Phil não rodada; sem leitura de
  produção nesta sessão).
- Os 3 h de assentamento da miniatura e o atraso do cron: estimativas; a sonda mede.
- Se a fronteira do dia da Reporting passa mesmo a 08:00 UTC depois de 01/11 (spec honesto §6 marca como
  inferência).
- Se existe rascunho de teste criado antes do deploy da F4 que será iniciado depois (ficaria `v1`).
- Se o CSV vazio do alcance é por canal inteiro (todo vídeo do canal sem linha = zero) ou se pode faltar
  um vídeo só num relatório não vazio; a regra `zero_medido` assume a primeira leitura.
- Limite de agendas de cron do plano da Vercel.
- Data do E8 do T19: não sei; nenhuma data foi escrita aqui.
- Horas de cada fase: sem estimativa; pedir a Phil e Yannis.
