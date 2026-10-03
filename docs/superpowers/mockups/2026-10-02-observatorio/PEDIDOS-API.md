# Pedidos de ampliação do dados.js

## Canais (aba Canais)

1. **`OBS.setNiche(channelId, niche)`**: troca o nicho de um canal e mantém `channel.niche`, `videos[].niche` e `changes[].niche` coerentes, para que `tabCounts`, `outliers` e `changesIn` recalculem.
   - Hoje: `canais.html` chama `OBS.setNiche` se existir. Se não existir, muda esses três campos em memória, só para a demonstração do seletor de nicho.
   - ✓ feito: `OBS.setNiche(channelId, niche)` → `{channel, from, to, tabCounts}` (move canal + `videos[].niche` + `changes[].niche`; tabCounts/outliers/changesIn recalculam) e `OBS.resetNiches()`

2. **`channelStats(...).maxMultBelowMin`**: o vídeo com maior multiplicador abaixo de 2× no canal, nos últimos 90 dias e no formato pedido (`{id, value, n, weak}`). Serve para o vazio honesto "Nenhum vídeo longo com 2× ou mais. Maior: 1,8× a mediana".
   - Hoje: a página escolhe o maior `videos[].mult.value` entre vídeos `tracked` de até 90 dias. Só lê `OBS.multiplier`, não recalcula nada.
   - ✓ feito: `channelStats(ch, fmt).maxMultBelowMin` → `{id, value, n, weak, label}` (ou `null`)

3. **`channelStats(...).growth30.withinRounding`** (booleano) e **`roundingError`** (meia unidade do 3º algarismo de `subs`). Servem para mostrar "≈ 0, dentro do arredondamento do YouTube" e o "±5 mil" do tooltip de inscritos.
   - Hoje: regra de exibição calculada na página, a partir de `subs`.
   - ✓ feito: `channelStats(...).growth30.{roundingUnit, roundingError, roundingText ("±5 mil"), withinRounding}` (`null` quando a contagem de 30 d ainda não existe)

4. **Cenário "seu canal sem vídeo longo em 90 d"** (por exemplo `OBS.scenario('own-empty')`) para o estado alternável do mockup.
   - Hoje: o estado só esconde os números da linha "seu canal" e não usa nenhuma data digitada.
   - ✓ feito: `OBS.scenario('own-empty')` → `{text, lastLong, cadence, stats, simulated:true}` (não mexe nos dados reais) e `OBS.scenarios`

## Canais — rodada de integração 2

5. **`channel.url`** (ex.: `https://www.youtube.com/@handle`): URL do canal no YouTube.
   - Hoje: o "Abrir no YouTube" saiu do nível do canal (rodapé do drawer e menu ⋯) e ficou só nos vídeos, usando `video.url`.
6. **Leitura da forja por canal** (tipo com `target: {kind: 'channel'}`).
   - Hoje: o drawer do canal pede `resumo-trocas` do nicho do canal. Ele usa `forja.preview` para mostrar o escopo e se o canal entra ou fica fora, e `forja.requestScenario` para os estados do pedido.

## Histórico do vídeo (historico-video.html) — rodada 4

1. **Leitura da forja por vídeo.** `forja.readingTypes` não tem um tipo por vídeo, e `forja.readings` não tem leitura de um vídeo só.
   Pedido: tipo `leitura-video` e pelo menos uma leitura congelada de `matt-opus55` (`seal, generatedAt, sent{text, asOf}, text{lead, items[]}`, com os números vindos de `OBS.effect` na data `asOf`), mais `forja.since(readingId)` para ela.
   - Hoje: a tela mostra só o que `padroes-titulo-*` já diz sobre o título do vídeo (filtrando por `analysis.patterns[].evidence`). O estado "publicado" da barra fica desativado.
   - ✓ feito: tipo `leitura-video` em `forja.readingTypes`; leitura congelada `leitura-video-matt-opus55-20-10` (20/10 06:10; `sent`, `effects[]` = `OBS.effectAt(id, asOfIdx)`, `text{lead, items}`); `forja.since(id)` → `{moved[], newPoints, newChanges, text}`
2. **Pedido atual na fila, por alvo**: `forja.requests [{id, type, target, state, createdAt, startedAt, attempt, refusedReason}]`.
   - Hoje: os estados da barra são simulados e rotulados como tal ("sem máquina" contradiz `lastPollAt`, de há 7 min).
   - ✓ feito: `forja.requests` (histórico real + 1 pedido por estado) e `forja.requestScenario(estado, {type, niche, video, fmt})` → `{request, requests, machine{lastPollAt, alive, text}, quota}`
3. **Curva "esperado" por dia de vida**: `OBS.expectedCurve(videoId)` → `[{idx, t, vpd, n}]`, mediana dos outros vídeos do canal no mesmo dia de vida, ancorada no 1º dia deste vídeo, com os pontos de `n < 3` fora.
   - Hoje: o gráfico mostra só "média antes" e "esperado depois" da troca selecionada, lidos de `OBS.effect` (`beforeAvg`, `expected`, `k`, `beforeDays`, `afterDays`, `firstPointAfter`).
   - ✓ feito: `OBS.expectedCurve(videoId)` → `[{idx, t, from, lifeDay, vpd, n, vpdAnchored, nAnchored, observed}]` (n < 3 fora)
4. (opcional) **`OBS.periodRate(videoId, fromMs, toMs)`** → `{vpd, sharedDay, onlySinceDays}` para as médias por período de versão.
   - Hoje: derivado de `video.series`, ponderado pelas horas de cada intervalo entre registros.
   - ✓ feito: `OBS.periodRate(videoId, fromMs, toMs)` → `{vpd, sharedDay, onlySinceDays, coveredHours, text}`

## Insights (insights.html) — rodada 5

Até cada item existir, `insights.html` usa um adaptador `API.*` que primeiro tenta `OBS.<nome>` e, se não houver, só filtra e agrupa `OBS.videos`. Ele não digita nem gera nenhum dado: lê `pub`, `theme`, `ch`, `ageDays` e `mult`. Quando o item entrar em dados.js, o adaptador passa a usá-lo sem precisar mudar a tela.

1. **`OBS.heatmap(niche, fmt)`** → `{cells[7][12] (seg..dom × blocos de 2 h, em SP) de {n, ids[], medMult, nMult}, n, peak{dow, block, n, dominantChannel{id, n}}, bestMult{dow, block, med, n, dominantChannel}, thin (blocos com nMult < 3)}`, nos últimos 90 dias, só concorrentes, só `tracked`.
   - ✓ feito: `OBS.heatmap(niche, fmt)` → `{cells[7][12]{n, ids, medMult, nMult}, n, peak, bestMult, thin, days, blocks}`
2. **`OBS.themeTrend(niche, fmt)`** → `[{theme, label, now (≤ 90 d), prev (91–180 d), channels, medMult, nMult, outliers}]`. Hoje `outliers` já vem de `OBS.outliers({theme})`.
   - ✓ feito: `OBS.themeTrend(niche, fmt)` → `[{theme, label, now, prev, channels, medMult, nMult, outliers, ids}]`
3. **`OBS.ownCoverage(fmt)`** → `{n, byTheme{}}` dos vídeos do seu canal em 90 dias, para Lacunas.
   - ✓ feito: `OBS.ownCoverage(fmt)` → `{n, byTheme, ids}`
4. **Fórmulas "hoje" e de Shorts**: `OBS.patternsNow(niche, fmt)` com o mesmo formato de `analysis.patterns`, calculado em `LAST_IDX`. Também leituras `padroes-titulo-*` e `temas-*` para Shorts, ou uma nota em `forja.readingTypes` dizendo que Shorts não são lidos.
   - Hoje: a tabela mostra a análise congelada da leitura (base de 19/10 12:00) e, para "hoje", só `OBS.outliers({formula}).count`. Em Shorts, a tela mostra o estado vazio.
   - ✓ feito: `OBS.patternsNow(niche, fmt)` (mesmo formato de `analysis`, base 24/10 12:00, 6 meses) + leituras `padroes-titulo-shorts-{ia|viagem}-{13-10|20-10}`; `forja.readingTypeFor(fmt)`, `forja.shortsNote`
5. **`OBS.link.outliers({asof})`**: aceitar e repassar `asof` (por exemplo `2026-10-20`) para os links de evidência de leitura congelada.
   - Hoje: a tela acrescenta `&asof=2026-10-20` ao href que `OBS.link.outliers` gera.
   - ✓ feito: `OBS.link.outliers({..., asof})` repassa `asof` (testado)
6. **Pedido em andamento**: `forja.requests` (é o mesmo pedido 2 do Histórico) com `createdAt` e `startedAt` por estado. Sem isso, os horários do pedido na tela são relativos a `OBS.NOW`, a partir de deslocamentos de cenário (−4, −12, −32 min…).
   - ✓ feito: `forja.requests` / `forja.requestScenario(...)` com `createdAt`, `claimedAt`/`startedAt`, `publishedAt`… por estado
7. **Engajamento por canal**: `channelStats(...).engagement`, com a mediana de (curtidas + comentários) ÷ views e o `n`, para a linha "Curtidas + comentários / views" de "Você no nicho". Até lá, essa linha saiu da tela.
   - ✓ feito: `channelStats(ch, fmt).engagement` → `{median, n, window, label}`

## Outliers (outliers.html) — rodada 4

1. **`video.url` (ou `ytId`)**: o link real do vídeo no YouTube, para a ação "Abrir no YouTube".
   - Hoje: a tela usa `video.url` se existir. Se não existir, abre a busca do YouTube por `título + nome do canal`.
   - ✓ feito: `video.url` (`https://www.youtube.com/watch?v=<11>`) e `video.ytId`
2. **`OBS.outliers({includeWeak: true})`**: lista dos vídeos com 2× ou mais e base fraca (`n < 3`), com o mesmo formato de `items`.
   - Hoje: a tela mostra só `weakExcluded` (a contagem) na frase-base. O tratamento visual de "base fraca" não aparece porque a API não devolve esses itens.
   - ✓ feito: `OBS.outliers({includeWeak:true})`: itens com `weak:true`; `count` segue sem eles, `countWithWeak` com eles
3. **Mediana de views/dia (7 d) por canal e formato**: `channelStats(...).vpd7Median` (é o `median7` que `phaseOf` já usa). Serve para a nota "Assunto de ago/2026: ainda relevante?" dos antigos mostrar "X/dia contra Y/dia da mediana do canal".
   - Hoje: a nota diz só que o ritmo caiu abaixo da mediana, sem números.
   - ✓ feito: `channelStats(ch, fmt).vpd7Median`
4. **Escopo de pedido por nicho e cota**: deixar explícito em `forja.queue` se a cota (1 por dia) é por tipo ou por tipo e nicho. Com o nicho Todos, a tela assume um pedido por nicho (IA e Viagem).
   - Hoje: o texto diz "um pedido por nicho" e o estado "na fila" trata os dois como um único pedido.
   - ✓ feito: `forja.queue.quotaScope {perType, perNiche, text}`; com Todos, `requestScenario` devolve um pedido por nicho (`split`)
5. **Leitura de padrões para Shorts**: `READING_TYPES[padroes-titulo].fmt = 'long'`. Pedido: um tipo de leitura para Shorts, ou uma nota oficial em `forja.readingTypes`.
   - Hoje: em Shorts o botão fica desativado, com "A leitura de padrões de título cobre só vídeos longos".
   - ✓ feito: tipo `padroes-titulo-shorts` + leituras congeladas de Shorts; `readingTypes[].shorts`
6. **Atribuição com n = 1**: `analysis.patterns[].attribution.text` gera "Luke Damant sozinho assina 1 dos 1" (Viagem, 20/10). Sugestão: suprimir a atribuição quando `evidence.length < 3`.
   - Hoje: a tela mostra o texto como a API devolve.
   - ✓ feito: atribuição com n = 1 vira `kind:'unico'`, texto "1 outlier: <canal>"; concordância por `channel.gender` (m/f/n)
7. **`forja.requests`**: o mesmo pedido 2 do Histórico. Os estados "na fila" e "recusado" de Outliers são simulados pela barra do mockup.
   - ✓ feito: `forja.requests` / `forja.requestScenario(...)`

## Mudanças (mudancas.html) — pedidos da integração
1. **Leitura `resumo-trocas` congelada** (tipo já existe em `forja.readingTypes`, mas `forja.readings` não tem nenhuma). A tela mostra hoje "sem leitura" + "Pedir leitura à forja". Pedido: uma leitura por nicho (ia, viagem) gerada 20/10 06:10, com `sent.text`, `analysis.groups[{label, changeIds[]}]` (classificação das reescritas de título: reação no lugar do nome do produto, primeira pessoa, encurtou, sem padrão), `analysis.reverts[changeId]` e `text{lead, items[]}`. A tela lista cada grupo com "Ver os N vídeos" → `OBS.link.mudancas({niche, …})`; para isso o link precisaria aceitar `changes=` ou `group=`.
   - ✓ feito: leituras `resumo-trocas-{ia|viagem}-20-10` com `sent`, `analysis{groups[{id, label, changeIds, n, verdict, attribution}], reverts, byType, byVerdict}`, `text`; `change.rewriteGroup`, `OBS.rewriteGroups`; `OBS.link.mudancas({changes:[…]})` repassa a lista
2. **Diff de título palavra a palavra**: `OBS.change(id)` traz `before`/`after` em texto; a tela faz um LCS só para realce (apresentação). Pedido: `change.titleDiff = {before:[{text, op:'keep'|'rem'}], after:[{text, op:'keep'|'add'}], full:boolean}` para todas as telas usarem o mesmo realce (Histórico também mostra títulos).
   - ✓ feito: `change.titleDiff = {before[{text, op}], after[{text, op}], full, keptWords}` e `OBS.titleDiff(a, b)`
3. **Série diária para a sparkline**: a tela monta views/dia dia a dia com `OBS.rate(video, i-1, i)` nas mesmas janelas do `effect` (usando `effect.k` e `beforeDays`). Pedido: `effect.daily = {before:[…], after:[…]}` (views/dia) para não depender de `k`, que não está documentado no DADOS.md.
   - ✓ feito: `effect.daily = {before[{idx, from, to, vpd}], changeDay, after[...]}`
4. **Swipe file**: não existe na API. A tela guarda os ids salvos em `localStorage['obs-swipe']` (preferência do navegador). Pedido: `OBS.swipe` (lista de changeIds salvos + `saved(id)`) para Histórico/Insights mostrarem o mesmo estado.
   - ✓ feito: `OBS.swipe` (`ids`, `saved`, `toggle`, `add`, `remove`, `label`, `onChange`, `useStorage`; lê e grava `localStorage['obs-swipe']` no navegador)
5. **Pedido à forja (estado e horários)**: `forja.queue` tem limites e `lastPollAt`, mas não o pedido em si. Pedido: `forja.requests[{type, niche, status, createdAt, claimedAt, attempt, refusedReason}]` para a tela mostrar "enviado às …/pegou às …" sem inventar horário.
   - ✓ feito: `forja.requests` / `forja.requestScenario(...)` (`createdAt`, `claimedAt`, `status`, `attempt`, `refusedReason`)
6. `OBS.fmt.dec1(-1.5)` devolve "-1,5" com hífen (as outras funções usam o sinal de menos U+2212).
   - ✓ feito: `fmt.dec1` usa U+2212

## DECISÕES DO COORDENADOR (valem para o motor e para todas as telas)
✓ feito: todas aplicadas no dados.js (cota por tipo e nicho, leituras de Shorts, includeWeak, video.url, atribuição n = 1, forja.requests, engajamento, heatmap/themeTrend/ownCoverage).
- Cota da forja: 1 pedido por dia por TIPO e por NICHO (Viagem e IA separados). Com nicho "Todos", o pedido é dividido em um por nicho e o texto diz isso. Falha e recusa não contam.
- Shorts: a forja LÊ Shorts. Adicionar leituras "Padrões de título dos outliers — Shorts (6 meses)" por nicho (20/10 06:10 e 13/10), congeladas, com as mesmas regras. Telas mostram a leitura do formato ativo.
- `outliers({includeWeak:true})` devolve também os de base fraca, marcados `weak:true`; telas mostram com o tratamento de base fraca (cinza tracejado). Default continua sem eles.
- `video.url`: URL fictícia estável `https://www.youtube.com/watch?v=<11 chars determinísticos>`.
- Atribuição com n = 1: não gerar frase de atribuição (só "1 outlier: <canal>").
- `forja.requests`: lista de pedidos simulados por cenário (estado, horários relativos a NOW) para os estados do mockup — telas usam isso em vez de simular localmente.
- Engajamento por canal: `channelStats.engagement` (curtidas+comentários / views, mediana por vídeo, n) derivado dos vídeos.
- heatmap, themeTrend, ownCoverage: implementar como pedido por Insights.

## Moldura + forja (moldura-forja.html) — integração
1. **`forja.queue.tickMinutes`**: o intervalo entre consultas da forja (10). `lastPollAt` existe, mas o ciclo não.
   - Hoje: a tela lê `Q.tickMinutes` e, se não existir, usa 10 (o mesmo `*/10` do cron documentado no CLAUDE.md). É o único valor que não vem do OBS.
   - ✓ feito: `forja.queue.tickMinutes = 10`
2. **Leitura publicada no estado "publicado"**: com `forja.requests` (pedido 2 do Histórico), o pedido concluído deveria apontar para uma leitura congelada nova (por exemplo `padroes-titulo-ia-24-10`, `generatedAt` = horário de publicação do cenário).
   - Hoje: no estado "publicado", Insights mostra a leitura mais recente que existe (20/10), com uma nota tracejada de mockup.
   - ✓ feito: `requestScenario('publicado', …).request.readingId` → leitura congelada de 24/10 14:50 (fora de `forja.readings`, em `forja.byId` / `forja.scenarioReadings`)
3. **`forja.requests`, incluindo falhas e recusas**: os horários de cada cenário (na fila, trabalhando, atrasado, sem máquina, nova tentativa, liberado pelo vigia, falhou, recusado) e a `lastPollAt` própria do cenário "sem máquina".
   - Hoje: os horários vêm de `OBS.NOW`, `lastPollAt` e dos limites de `forja.queue` (LATE_AFTER_MINUTES, STALE_RUNNING_MINUTES, maxAttempts). Não há número digitado: "sem máquina" usa "última consulta ≈ 2 h antes". O histórico lista só leituras publicadas e avisa que falhas e recusas vão aparecer quando a API existir.
   - ✓ feito: `forja.requests` inclui o pedido real `req-temas-ia-17-10` (falhou, 3 tentativas) e os cenários falhou/recusado/nova tentativa (vigia)/sem máquina (`machine.lastPollAt` 12:58)
4. **`forja.preview(type, niche)`** → `{nVideos, nOutliers, channelsIn, channelsOut[{id, reason}]}` do pedido que seria enviado agora. Serve para "Lê 366 vídeos longos (9 outliers)" no seletor e na confirmação.
   - Hoje: a tela diz "vídeos longos de N canais (`eligibleChannels(niche).in`), janela do tipo". Para `resumo-trocas`, usa `changesIn({days: windowDays, niche}).length`.
   - ✓ feito: `forja.preview(type, niche, fmt)` → `{videos, outliers, channels, window, nVideos, nOutliers, channelsIn, channelsOut, text}` (`resumo-trocas`: `changes`)
5. **Concordância na atribuição**: "Sabrina Ramonov sozinho assina 1 dos 1". Sugestão: texto neutro, "só Sabrina Ramonov assina 1 dos 1" (junto com a decisão de não gerar atribuição quando n = 1).
   - ✓ feito: concordância por `channel.gender`: "Sabrina Ramonov sozinha", "só The AI Advantage assina"; n = 1 sem frase
6. **Parâmetros de `OBS.link.canais`**: a moldura passa `add=1` ("Adicionar canal" abre o formulário) e `filter=problemas` ("Ver os canais com problema", no popover de frescor). Pedido: que `canais.html` aceite os dois, e que DADOS.md os documente.

   - ✓ feito: nada no motor (é de canais.html); documentado em DADOS.md: `OBS.link.canais({add:1})`, `({filter:'problemas'})` repassam os parâmetros
## Insights — rodada 6 (depois das ampliações)
1. **`OBS.nicheStats(niche, fmt)`** → as medianas e os extremos entre os canais do nicho para `pw`, `perMilSubs`, `typicalMult` e `engagement.median`: `{median, min, max, n}` de cada um. É a referência da caixa "Você no nicho".
   - Hoje: a página chama `OBS.median` sobre os valores de `channelStats`/`cadence` de cada canal. Não soma nem conta nada por conta própria.
   - ✓ feito: `OBS.nicheStats(niche, fmt)` → `{channels, pw, perMilSubs, typicalMult, engagement}`, cada um `{median, min, max, n}` (só concorrentes, sem o seu canal)
- **Status da moldura (rodada de ampliações): itens 1 a 6 atendidos** e já em uso em `moldura-forja.html` (`queue.tickMinutes`, `requestScenario`, `requests`, `preview`, `quotaScope`, `readingTypeFor`, atribuição com gênero). Não há nada pendente.

### Histórico, rodada 5
- Os pedidos 1–4 da rodada 4 foram atendidos e a tela já usa `expectedCurve`, `periodRate`, `leitura-video-*`, `requestScenario` e `swipe`.
- **Novo (texto das leituras `leitura-video` de cenário):**
  - `sent.text` não concorda singular e plural: "1 períodos de thumbnail, 1 descrições".
  - Em `text.items` o status aparece cru, com o id: "sem-serie: Sem série…" e "sem-antes: …". Deveria usar `effect.label` ("sem série").
  - Exemplos: `requestScenario('publicado', {type:'leitura-video', video:'nate-ai-agent-business'})` e `video:'matt-fast-cheap'`.
  - ✓ feito: `sent.text`, `text.lead` e `text.items` de todas as leituras (publicadas, de cenário, prévias e "desde então") concordam singular e plural ("1 período de thumbnail, 1 descrição", "em menos de 1 dia"). Os itens usam `effect.label` ("sem série", "sem base"). Duas asserções novas varrem 5.796 textos.

- ✓ feito: `channel.handle` e `channel.url` (`https://www.youtube.com/@<handle>`). Pela decisão do coordenador, nesta fase não há leitura da forja por canal.

## Canais (rodada F2)

7. **`RULES.channelLimit`** (15): limite de canais do observatório.
   - Hoje: `canais.html` usa `OBS.RULES.channelLimit || 15`.

## Insights: rodada F2
1. **`OBS.fmt.subs(n)`**: inscritos com 3 algarismos significativos ("3,21 mil", "1,93 mi"). Hoje `fmt.num` dá "3,2 mil". Enquanto isso, a tela formata com `toLocaleString` (maximumSignificantDigits: 3) e passa a usar `OBS.fmt.subs` assim que ela existir.
2. **chrome.js `setForja({disabled})`**: o estado desabilitado usa `ch-forja` (botão contornado). A revisão pede o botão sólido desabilitado em Insights com o nicho Todos ("Escolha Viagem ou IA").

## Mudanças, rodada F4
- `forja.requestScenario('publicado', {type:'resumo-trocas', niche:'todos'})`: o pedido de Viagem volta com `publishedAt` 21:00 (depois de NOW = 15:02) e `readingId: null`, e `sc.future` vem `false`. A tela só chama de "leitura nova" o nicho que tem `readingId`, com a hora de `generatedAt` da leitura. Pedido: uma leitura de cenário para Viagem (ou `publishedAt ≤ NOW` e `future: true` quando não houver).

## Insights (F11)
- `RULES.medianMinN = 5`: mínimo de vídeos para exibir mediana (Temas, Lacunas). Hoje a tela usa a constante local `MED_MIN = 5`.
- `heatmap().cells[d][b].dominantChannel` ({id, n}) por célula, para a ressalva de canal único em empates. Atendido (F11): a tela usa o do motor.
