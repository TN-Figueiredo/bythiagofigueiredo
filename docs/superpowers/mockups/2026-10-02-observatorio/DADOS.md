# dados.js — fonte única do Observatório

`<script src="dados.js"></script>` (funciona via file://) → `window.OBS`. **Nenhuma tela digita n, multiplicador, contagem, efeito ou data: leia de OBS.** Teste: abra `dados-teste.html` (52 asserções), ou rode `node ../run-dados-teste.js`.

## Tempo
- `OBS.NOW` (epoch ms; 24/10/2026 15:02 SP, sábado) · `OBS.SERIES_START` (03/10 00:00) · `OBS.LAST_IDX` = 21 (24/10 12:00) · `OBS.TZ_LABEL` = "Horários em São Paulo"
- `OBS.SYNC` → `{last, next, cadence, text:'sincronizado há 3 h', title:'24/10 12:00 (SP)', nextText}`
- `OBS.date`: `dm, dmy, hm, dmhm, weekday, weekdayShort, ago(ms)` ("há 6 h", "há 3 dias"), `windowText(a,b)` ("entre 24/10 06h e 12h"), `dur(ms, approx)`, `snapTime(idx)`, `spIso('2026-10-24T12:00')`
- `OBS.fmt`: `num` ("207,6 mil", "1,9 mi"), `mult` ("8,2×"), `pct(fração)` ("−41%"), `pp`, `int`, `plural`, `verVideos(n)`

## Canais: `OBS.channels`, `OBS.channel(id)`
ids: `luke-damant, bald-and-bankrupt, dale-philip, paddy-doyle, leo-khev, nomade-raiz, matheus-fonseca, vou-sem-volta, matt-wolfe, nate-herk, sabrina-ramonov, the-ai-advantage, preguica-artificial, esq-unltd-daily`, mais `tnfigueiredo` (`own: true`).
Campos: `name, fullName, niche ('viagem'|'ia'), lang, subs, video_limit, color, ini, sync {state: ok|atrasado|erro|backfill, last, next, msg, backfill{done,total}}, activity {state: ativo|parado, pausedDays}, lastIdx, snapshots [{t, date, subs, views}]` (diários desde 31/05, às 09:00 até 02/10 e às 12:00 desde 03/10), `videos` (do mais novo para o mais antigo).
- `OBS.cadence(chId, 'long'|'short')` → `{weeks[13]{from,to,n}, pw, n, habit{costuma, text}, lastUpload, lastUploadAgo}`
- `OBS.channelStats(chId, fmt)` → `{vpdMedian, vpdN, perMilSubs, typicalMult, bestOutlier, outliers90, changes30, growth30{abs,pct}|{pending}, tracked, total, syncText}`

## Vídeos: `OBS.videos`, `OBS.video(id)`
`id, ch, niche, fmt, pub, dur, ageDays, tracked, title, thumb {text,bg,fg,face,ink}, theme, formulas[], views, viewsAt, likes, comments, vpd` (views/dia desde 03/10 ou desde a publicação), `vpd7, mult` (= `OBS.multiplier(id)`), `series [{idx, t, views}]` (1 ponto às 12:00; o último, de 24/10, é o parcial de hoje),
`titles / thumbs / descs`: versões `{id, text|art|lines, first_seen, last_seen, current, prec, window}`. `descs[i].lines == null` = texto não guardado (antes de 03/10). Thumbnail anterior a 03/10 tem `seenSinceArchive: true` ("vista desde 03/10").
`OBS.viewsAt(id, idx)`, `OBS.rate(id, idxA, idxB)` (views/dia entre registros).

Nomeados: `matt-opus55` (**vitrine**, `OBS.SHOWCASE`), `matt-fast-cheap, matt-gpt6-astra, sabrina-1m, nate-claude-code-danger, luke-kfc, dale-ninja-dojo, preguica-hailuo, luke-food-street, aiadv-tools-pay, nomade-turcomenistao, paddy-bkk-hotel, matheus-japao-semana, leo-asia-central` (1,7×, abaixo de 2×) etc.

## Trocas: `OBS.changes`, `OBS.change(id)`, `OBS.changesIn({days=30, niche, type, channel, video, fmt})`
id `"<video>/<title|thumb|desc>/<n>"`. Campos: `type, typeLabel, at, prec ('min'|'6h'|'1d'), window, mid, whenText, agoText, before, after, preSeries, diff {lines[{op: ctx|add|rem|utm}], add, rem, utm, label:'+4 −3 linhas + 1 UTM'}, hasText, revertTo, testCompare, cycleMs, sameWindow[], within48h[]`.
- `OBS.effect(changeId)` → `{status: ganhou|perdeu|neutro|inconclusivo|aguardando|sem-serie|sem-antes, label, reason, observed, expected, iqr[q1,q3], n, effectPp, beforeDays, afterDays, readyOn, method, band, numbers:'observado −55% · esperado −56% (n = 6)', willBeInconclusive}`
- `OBS.caveats(changeId)` → outras trocas do vídeo dentro dos 7 dias depois (ressalva).

## Outliers
- `OBS.multiplier(videoId)` → `{value, method: 'mesmo dia de vida'|'aproximação por faixa', n, base, band, weak, fallback, fallbackText, label}`
- `OBS.outliers({niche='todos', fmt='long', ages=['0-30','31-90'] | 'all', min=2, theme, formula, channel})` → `{items[{id, video, mult, phase{id,label}, window, ageDays}], count, byAge, byPhase, analyzed, untracked, weakExcluded}`. Fases: estourando agora · recentes · perenes · antigos · sem ritmo.
- `OBS.tabCounts(niche)` → `{canais, mud, out}`; `OBS.TAB_COUNTS` (14/18/11 · 8/8/5 · 6/10/6, conferido na carga: `OBS.integrity`); `OBS.TAB_TITLES.mud(n)` etc. para o `title=` das abas.
- Catálogos: `OBS.formulas` / `OBS.formula(id)` (`preco, numero, pergunta, reacao-hiperbole, superlativo, nome-do-lugar, primeira-pessoa, nome-do-modelo, tutorial`; `test(title)`), `OBS.themes` / `OBS.theme(id)`. `OBS.RULES`, `OBS.AGE_BANDS`, `OBS.OUT_WINDOWS`.

## Forja: `OBS.forja`
- `readings` (congeladas): `padroes-titulo-{ia|viagem}-{13-10|20-10}`, `temas-{ia|viagem}-20-10`. Campos: `seal, generatedAt, sent{text:'dados enviados à forja: …', nVideos, nOutliers, asOf}, analysis{patterns[{formula, nUse, nNot, medUse, medNot, diff, verdict{id: padrao|recorrencia|sem-diferenca, text}, evidence[], attribution}], dominantTheme}, text{title, lead, items[], theme}`.
- `forja.latest(type, niche)`, `forja.since(readingId)` → `{text:'Desde então: +10 vídeos novos, …', newVideos, leftWindow, becameOutlier, titleChanged, staleNow}`, `forja.eligibleChannels(niche)` → `{in[], out[{id, reason}]}`, `forja.queue` (limites, `timingText`, `quotaNote`), `forja.states`.

## Links: `OBS.link.outliers({niche, fmt, ages, min, theme, formula, channel})`, `.mudancas({niche,type,channel,video})`, `.historico(id)`.

```js
const v = OBS.video('matt-opus55');
OBS.fmt.num(v.views);                         // "207,6 mil"
const e = OBS.effect('matt-opus55/title/1');  // neutro · e.numbers
OBS.outliers({ niche: 'ia' }).count;          // 6
OBS.forja.since('padroes-titulo-ia-20-10').text;
```

## Ampliações (rodada PEDIDOS-API.md — só adições, nada renomeado)
**Canais**
- `OBS.setNiche(chId, 'viagem'|'ia')` → `{channel, from, to, tabCounts{todos, viagem, ia}}` (canal + vídeos + trocas mudam juntos) · `OBS.resetNiches()`
- `channelStats(ch, fmt)` ganhou `maxMultBelowMin {id, value, n, weak, label}`, `vpd7Median`, `engagement {median, n, window, label}` e `growth30.{roundingUnit, roundingError, roundingText:'±5 mil', withinRounding}`
- `OBS.scenario('own-empty')` → `{text, lastLong, cadence, stats, simulated}` (não altera dados) · `OBS.scenarios`
- `channel.gender` ('m'|'f'|'n'), usado para concordar na atribuição ("Sabrina Ramonov sozinha", "só The AI Advantage assina")
- `OBS.link.canais({add: 1})`, `OBS.link.canais({filter: 'problemas'})` repassam os parâmetros (quem trata é canais.html)

**Vídeos e outliers**
- `video.url` (`https://www.youtube.com/watch?v=<11>`, fictícia e estável) e `video.ytId`
- `OBS.outliers({includeWeak: true})`: itens de base fraca entram com `weak: true`; `count` continua sem eles; `countWithWeak` inclui
- Atribuição com n = 1: `{kind: 'unico', text: '1 outlier: <canal>'}`

**Histórico**
- `OBS.periodRate(id, fromMs, toMs)` → `{vpd, sharedDay, onlySinceDays, coveredHours, text}` (< 24 h: "menos de 1 dia no ar, sem média")
- `OBS.expectedCurve(id)` → `[{idx, t, from, lifeDay, vpd, n, vpdAnchored, nAnchored, observed}]` (mediana dos outros vídeos do canal, mesmo formato e idade, sem trocas; `vpdAnchored` = ancorado no 1º dia deste vídeo; n < 3 fora)
- `OBS.effectAt(changeId, idx)`: o mesmo efeito calculado com os dados até o registro `idx`; `effect(id).daily = {before[], changeDay, after[]}` com `{idx, from, to, vpd}`

**Mudanças**
- `change.titleDiff = {before[{text, op: keep|rem}], after[{text, op: keep|add}], full, keptWords}` · `OBS.titleDiff(a, b)`
- `change.rewriteGroup` (`reverteu`, `tirou-segunda-noticia`, `primeira-pessoa`, `reacao-no-lugar`, `encurtou`, `sem-padrao`) · `OBS.rewriteGroups`
- `OBS.swipe`: `ids`, `saved(id)`, `toggle(id)`, `add`, `remove`, `label(id)` ("Salvo no swipe file" / "Salvar no swipe file"), `onChange(fn)`, `useStorage(storage)`; no navegador lê e grava `localStorage['obs-swipe']`
- `OBS.link.mudancas({changes: [...ids]})` repassa a lista · `fmt.dec1` agora usa U+2212

**Insights**
- `OBS.heatmap(niche, fmt)` → `{cells[7 seg..dom][12 blocos de 2 h]{n, ids, medMult, nMult}, n, peak{dow, block, n, dominantChannel}, bestMult{…, med}, thin[{dow, block}], days, blocks}` (90 d, concorrentes acompanhados)
- `OBS.themeTrend(niche, fmt)` → `[{theme, label, now, prev, channels, medMult, nMult, outliers, ids}]` · `OBS.ownCoverage(fmt)` → `{n, byTheme, ids}`
- `OBS.patternsNow(niche, fmt)`: mesmo formato de `reading.analysis`, base 24/10 12:00 (6 meses) · `OBS.link.outliers({…, asof: '2026-10-20'})`

**Forja**
- Novos tipos: `padroes-titulo-shorts` ("Padrões de título dos outliers — Shorts (6 meses)") e `leitura-video`; `readingTypes[].shorts`; `temas.aka = 'Temas emergentes'`; `forja.readingTypeFor(fmt)`, `forja.shortsNote`
- Novas leituras congeladas: `padroes-titulo-shorts-{ia|viagem}-{13-10|20-10}`, `resumo-trocas-{ia|viagem}-20-10` (`analysis.groups[{id, label, changeIds, n, verdict, attribution}]`, `reverts`, `byType`, `byVerdict`) e `leitura-video-matt-opus55-20-10` (`effects[]`, `viewsThen`). Toda leitura tem `analysis.patterns` (vazio quando não é de padrões) e `base`.
- `forja.since(id)` também funciona para `leitura-video` (`moved[]`, `newPoints`) e `resumo-trocas` (`newChanges`, `leftWindowChanges`)
- `forja.queue.tickMinutes` (10), `forja.queue.quotaScope {perType, perNiche, text}`: 1 pedido por dia por tipo e por nicho; com Todos vira um por nicho
- `forja.requests`: histórico real (um pedido por leitura publicada, mais `req-temas-ia-17-10`, que falhou) e um pedido simulado por estado (`scenario: true`)
- `forja.requestScenario(estado, {type, niche, video, fmt})` → `{request, requests (2 com 'todos'), split, machine{lastPollAt, alive, tickMinutes, text}, quota{usedToday}}`. Estados: `forja.requestStates` (na fila, trabalhando, publicado, atrasado, sem máquina, nova tentativa, falhou, recusado (dado velho), liberado pelo vigia). No estado "publicado", `request.readingId` aponta para uma leitura nova de 24/10 14:50 (`*-cenario`, em `forja.byId` e `forja.scenarioReadings`, nunca em `forja.readings`)
- `forja.preview(type, niche, fmt)` → `{videos, outliers, channels, window, nVideos, nOutliers, channelsIn, channelsOut, text: 'Lê 255 vídeos longos (9 outliers)'}`; para `resumo-trocas`: `{changes, text}`

**Rodada 6**
- `OBS.nicheStats(niche, fmt)` → `{channels, pw, perMilSubs, typicalMult, engagement}`, cada um `{median, min, max, n}` entre os canais concorrentes do nicho (sem o seu canal). É a referência de "Você no nicho".
- Textos das leituras: concordância de número em `sent.text`, `lead`, `items`, `since().text` e `preview().text`; os itens de efeito usam `effect.label`.
- `channel.handle` (`@NomadeRaiz`, fictício e estável) e `channel.url` (`https://www.youtube.com/@…`). Nesta fase não existe leitura da forja por canal.

**Rodada final (reviews/final/*-F1.md, itens MOTOR)**
- `effect`: "mesmo dia de vida" com n < 3 cai para a faixa de idade (`method: 'aproximação por faixa'`, `methodFallback`, `sameDayN`, `fallbackText`). Novo `numbersFlat` ("observado −55% · esperado −56% · n = 6", sem parênteses).
- `fmt.labelReason(label, reason)` → "inconclusivo — poucos vídeos…": não repete o rótulo e põe o motivo em minúscula. `fmt.lcfirst`. `fmt.mult` sempre com 1 casa ("4,0×").
- Leitura do vídeo: `sent.nPoints` = pontos da série até `asOfIdx`. O `lead` cita só os tipos que mudaram ("2 trocas de título, 3 trocas de thumbnail e 1 troca de descrição em 13 dias de vídeo"). Os itens usam "rótulo — motivo". `forja.since()` traz `items[]` (lista por troca) e `flipped`, e o texto diz "N trocas mudaram de veredito".
- Padrões e grupos: n = 0 vira "nenhum título com essa fórmula"; n = 1 vira "caso isolado (n = 1)"; o grupo sem padrão vira "N trocas sem padrão de reescrita". `caveats`: "mudou entre …" (janela) ou "mudou em 18/10 09:14" (minuto).
- `forja.preview('resumo-trocas', niche)` conta só as trocas dos canais em `channelsIn`.
- `forja.timing(type, niche)` → `{n, medianMinutes (só com ≥ 5), text}`; `readingTypes[].timingText` e `.timingByNiche`.
- `requestScenario(state, {…, createdAt})`: os demais horários derivam de `createdAt`, e o claim cai na próxima consulta (xx:x5).
  - "atrasado": `busySince` 14:35.
  - "nova tentativa": o validador recusou a tentativa 1 às 14:22 (`retryReason`, `attempts`); "liberado pelo vigia" agora é um cenário separado.
  - "recusado": o motivo é um pacote em cache com dados de 23/10 18:00 (`refusedDataAsOf`).
  - `quota.releasesAt` (25/10 00:00) e `quota.text`.
  - O resultado tem `future: true` se algum horário derivado passar de NOW.
- Inscritos: `snapshots[].subs` com 3 algarismos significativos (como a API do YouTube). `growth30` é calculado sobre eles e traz `uncertainty` e `text` ("+20 mil (±10 mil)" ou "≈ 0 (dentro do arredondamento do YouTube, ±10 mil)").
- `forja.since()` respeita o formato da leitura (`reading.fmt`).
- `nicheStats(niche, fmt, ownId = 'tnfigueiredo')` também traz `own`. Para cada métrica (`pw`, `perMilSubs`, `typicalMult`, `engagement`) dá `{value, median, ratio, verdict ('▲' | '▼' | '≈', limiar ±15%), verdictText, label, n, few (n < 10)}`.
- `themeTrend(niche, fmt)` compara só canais com série nas duas janelas; o array traz `.excluded[{id, reason}]` e `.channelsCompared`.
- `date.ago`: abaixo de 48 h sempre em horas ("há 39 h"). A partir de 48 h, em dias arredondados.
- `forja.since()` de `resumo-trocas` também traz `staleNow` e o aviso no texto.

**Rodada F2 (reviews/f2/*.md, itens MOTOR)**
- Leituras nos links:
  - `OBS.link.outliers({reading: id})` repassa `reading`.
  - `OBS.outliers({reading: id})` aplica o escopo da leitura: canais, formato, nicho e janela (`maxAge` = janela). O resultado traz `scope`, e o count bate com `forja.since(id).nowOutliers`.
  - `OBS.outliers({channels: [ids]})` e `{maxAge}` filtram por conta própria.
  - `forja.readingScope(id)` → `{channels, fmt, niche, windowDays, ages, maxAge, asof: 'AAAA-MM-DD', asOf, nThen, text: 'A leitura de 20/10 (6 meses, 6 canais) via 9'}`.
  - `forja.byId` já tem as leituras de cenário de 24/10 desde a carga.
- `heatmap(...)` deixa de fora os canais ainda buscando vídeos e lista-os em `.excluded[{id, partial, fetchedSince, reason}]`. `cadence(...)` ganhou `partial`, `fetchedSince` e `partialText` ("ritmo parcial: só os 18 vídeos mais recentes foram buscados (desde 13/08)").
- `RULES.theme.trend = {minDelta: 3, minPct: 0.25, text}`: ▲/▼ só com Δ ≥ 3 vídeos E ≥ 25% entre os últimos 90 dias e os 90 anteriores. Os itens de `themeTrend` ganharam `trend`, `trendText`, `delta` e `deltaPct`.
- `channelStats.pctOutliers` / `pctOutliersN`; `nicheStats(...).pctOutliers {median, min, max, n}` e `.own.pctOutliers` (com veredito).
- `fmt.dec1` sempre com 1 casa ("1,0"); `fmt.num` continua "58 mil" e "1,5 mil".
- Atribuição: empate do 2º com o 3º vira "espalhado por N canais" (`tie: true`). As frases dizem o substantivo: "… assinam 4 dos 4 outliers com essa fórmula" / "1 outlier com essa fórmula: Canal" / "… dos 71 vídeos com essa fórmula".
- `requestScenario(...)` ganhou `statusText`, uma frase pronta por estado, sem dois-pontos encadeados (por exemplo: "Voltou para a fila (tentativa 2 de 3). O validador recusou a tentativa 1 às 14:57 porque…"). Também:
  - recusado: "a máquina recebeu dados de 23/10 18:00, anteriores à sincronização das 12:00. Peça de novo."
  - nova tentativa: pego às 14:45, recusado às 14:57 (depois da consulta das 14:55), espera a próxima consulta (`machine.nextPollAt` 15:05).
  - sem máquina: última consulta às 12:55.
- `fmt.labelReason(label, reason, {sentence: true})` põe maiúscula no início. Se o motivo já começa pelo rótulo (ou é igual a ele), devolve só o motivo. "Neutro: …" vira "neutro — …".
- "Testar e comparar (teste A/B do YouTube)" em todos os textos; "Test & Compare" não aparece mais.
- `thumb.text` dos vídeos gerados = palavra-chave do título: preço (+ lugar), número + substantivo, ou nome (lugar, modelo, ferramenta), até 2 palavras. As thumbnails dos vídeos nomeados mantêm o texto desenhado. A ferramenta "Make" do gerador virou "Gumloop" (colidia com o verbo); nenhum número mudou.
- `RULES.tiers = {mid: 2, high: 5, top: 10}` e `OBS.tierOf(mult)` → `'mid' | 'high' | 'top' | null`.
- `effect.method` usa os mesmos rótulos do multiplicador: "mesmo dia de vida" ou "aproximação por faixa" (antes era "mesma faixa de idade"). Novo `effect.methodLabel` ("método: aproximação por faixa").
- `RULES.channelLimit`: limite de canais concorrentes monitorados (50 desde a F9, ver abaixo).
- `fmt.subs(n)`: inscritos com 3 algarismos significativos ("3,21 mil", "4,51 mi", "128 mil"). Nenhum texto gerado pelo motor cita a contagem de inscritos; as variações usam `fmt.num`.

**Rodada F3 (reviews/f3/*.md, itens MOTOR)**
- `forja.readingScope(id, {formula, theme, min})` devolve `null` para leituras que não são de outliers (`leitura-video`, `resumo-trocas`). Nesses casos `outliers({reading})` volta com `readingInvalid: true`. Com filtros, `nThen` conta os vídeos da leitura que passam por eles (mesmas regras de `outliers`).
- `nicheStats(...).own.*`: quando o seu canal e a mediana estão em 0, o resultado é `bothZero: true`, `verdict: '≈'`, "igual à mediana do nicho (as duas em 0%)". Seu canal acima de uma mediana 0 dá '▲'.
- O número de canais de `sent.text`, do `lead` e de `readingScope` é o mesmo: os canais com vídeos na base. Quando é menor que o escopo, aparece como "5 canais com Shorts"; `sent.nChannelsInScope` guarda o total.
- `resumo-trocas`: trocas e texto a partir do `asOf` ("de 19/09 a 19/10 12:00").
- `leitura-video` de canal atrasado: `sent.asOf` = último ponto do vídeo (Paddy: 22/10 12:00).
- `fmt.labelReason`:
  - nunca encadeia separadores; se o motivo já tem travessão ou dois-pontos, vira "rótulo. Motivo." ("inconclusivo. Antes: 1 dia — pouco para comparar.");
  - só tira o prefixo "Rótulo:" quando é o próprio rótulo.
- `thumb.text`: o número de nome de modelo fica com o nome ("GROK 5"); nada de número + adjetivo ("5 LEGAL").
- `forja.shortsNote` com aspas curvas.
- Novo texto de "sem base": "A versão anterior durou menos de 1 dia, antes do primeiro registro diário: sem dias antes para comparar."
- `channel.sync.label` (`sincronizado` | `atrasado` | `erro` | `buscando vídeos`) e `channel.statusLabel`, que também vale `parado`.
- `attribution.textMid` (para o meio da frase, sem mexer na caixa de nomes próprios) e `attribution.textStart`.
- `titleDiff`: segmentos `op: 'case'` para mudança só de caixa, mais `caseChanges` e `hasCaseChange`.
- `readingScope(id, {formula, theme, min, channel})`: `nThen` também filtra por canal.

**Rodada F4 (CONVENCOES "RODADA F4", reviews/f4)**
- `OBS.link.*`:
  - o tema de conteúdo vai em `topic=`; `theme=` só passa se for `light` ou `dark`, e `link.outliers({theme: 'comida-de-rua'})` vira `topic=`;
  - links para um objeto (`video`, `change`, `changes`, `channel`) não levam `niche=`;
  - `outliers({topic})` é sinônimo de `{theme}`.
- Fases: vídeo de canal com sincronização atrasada ou com erro → `sem-ritmo` ("sem ritmo medido", `why` com a data da sincronização), nunca "estourando agora". O `why` de "recentes" é honesto ("de 31 a 90 dias; 'estourando agora' só até 30 dias").
- `change.agoText`: com janela, "vista pela 1ª vez há N h" (a partir da 1ª observação); thumbnail (minuto) continua "há N". `change.agoMidText` = relativo ao meio da janela (é o "há 6 h" do BRIEF).
- Títulos PT gerados com preposição contraída por lugar ("Metrô da Mongólia", "Quanto custa viajar pelo Quirguistão?", "Cheguei em Cusco"). O artigo de cada lugar fica em `PLACE_ART` no gerador. Nenhum número mudou.
- `requestScenario(estado, {niche: 'todos'})`:
  - os 2 pedidos têm o mesmo `createdAt`;
  - em estado ativo, o 2º fica "na fila" atrás do 1º (`behind`), porque a máquina pega um por consulta;
  - em "publicado", o 2º está "trabalhando" desde a consulta seguinte;
  - "sem máquina" vai para o plural ("Seus pedidos das 14:48 estão na fila e rodam quando a máquina voltar.").
- `requestScenario(...).statusLabel`, rótulo curto para cabeçalho: "na fila · pedido 14:58", "trabalhando desde 14:45", "nova tentativa às 15:05", "vigia liberou às 14:56 · volta às 15:05", "publicado às 14:50", "falhou às 14:21", "recusado às 14:56". Mais `terminal`.
- `requestScenario`: nenhum horário depois de NOW. Um horário derivado no futuro (por exemplo, com `createdAt` = NOW) vai para `request.forecast` (previsão) e o campo fica nulo; `readingId` só existe com `publishedAt` ≤ NOW. Em "publicado" com Todos, IA está publicado às 14:50 e Viagem "trabalhando" desde 14:55.
- `OBS.phaseOf(idOuVídeo)` aceita o id ou o objeto do vídeo. Canal atrasado ou com erro → "sem ritmo medido", igual a `outliers().items[].phase`.

**Rodada F5 (reviews/f5/fixes.md, itens MOTOR)**
- M-a: idade única em dias inteiros. A base das leituras usa `floor((asOf − publicação)/dia)`; hoje usa `video.ageDays`, a mesma idade de `outliers`. Com isso `since().nowVideos` = `outliers({reading, min: 0, includeWeak: true}).countWithWeak` e `nowOutliers` = `outliers({reading}).count`.
  - `since()` separa os vídeos que entraram em `freshVideos` (publicados depois), `noBaseThenVideos` (já existiam, mas sem base de comparação na data) e `foundOldVideos` (achados depois pela sincronização).
  - O texto também diz "N deixaram de ser outlier", e `countsText` dá "vídeos: 368 → 367 · outliers: 9 → 9". Com contagens diferentes, o texto nunca é "Nada mudou".
  - As bases congeladas de algumas leituras ganharam 1–2 vídeos (366 → 368 longos na IA de 20/10); os outliers delas não mudaram.
- M-b: com Todos, o 2º pedido que espera mais de 25 min fica "atrasado" (`stateNote`: "atrás do de IA"), e "sem máquina" se a máquina caiu. Em falhou/recusado o 2º é processado depois (falhou 14:21/14:51; recusado: a partir da F6, IA pede às 14:50, é pega às 14:55 e recusada às 14:56; com Todos, o de Viagem segue na fila, sem "atrás do", porque o de IA já terminou).
- M-c: com Todos, um pedido ainda ativo impede o estado terminal. "publicado" fica `statusLabel` "pedido em andamento", `terminal: false`, `anyActive`, e `statusLines` ["IA: publicado às 14:50", "Viagem: trabalhando desde 14:55"].
- M-d: o "antes" do efeito exclui o trecho de < 24 h da estreia, no observado e no esperado (`firstRealIdx`). A troca de título 1 → 2 da vitrine passou para a janela 11/10 06h–12h e segue medida, com 3 dias antes (neutro).
- M-e: `expectedCurve(id)` traz `.method`, `.methodLabel` ("método: aproximação por faixa" ou "método: mesmo dia de vida") e `.band`.
- M-f: leituras de Shorts sempre dizem "N canais com Shorts".
- M-g: nenhum texto do motor com estado cru. `channel.sync.stateLabel` = `sync.label` (sincronizado | atrasado | erro | buscando vídeos).
- `OBS.link.outliers({reading})` não leva `niche=`: a leitura já define o nicho.
- `requestScenario(...)`: cada pedido tem `statusLabel` próprio, com a hora do evento que o rótulo nomeia ("na fila desde 14:58", "sem máquina desde 12:55", "nova tentativa às 15:05", "vigia liberou às 14:56 · volta às 15:05"…). Com Todos, `statusLines[i]` = "<Nicho>: " + `requests[i].statusLabel`.
- Fase `novos` (rótulo "Novos", why "menos de 7 dias de série"): vídeo de canal em dia com menos de 7 dias de série. `sem-ritmo` ("sem ritmo medido") fica só para canal atrasado, com erro ou ainda buscando vídeos. Lista e ordem das fases em `OBS.PHASES`; `outliers().byPhase` usa os mesmos ids.
- `titleDiff`: palavra que aparece nos dois títulos (comparação sem caixa, sem acento, sem pontuação e sem possessivo) não entra em "saiu"/"entrou". Ela vira `op: 'move'` ("mudou de lugar") ou, se mudou só a caixa, `op: 'case'` ("só maiúsculas/minúsculas"). Cada segmento tem `label`, e o resultado traz `labels`, `removed` e `added`.
- `OBS.runSync({channel?})` simula uma sincronização em NOW. Só canais `ok` ficam com `sync.last = NOW`, e a rodada completa também atualiza `OBS.SYNC` ("sincronizado agora"). Erro, atrasado e buscando vídeos mantêm o estado e voltam em `problems[{id, label, state, stateLabel}]`, com `label` = `channel.sync.problemLabel` ("não encontrado no YouTube (404)"). O retorno é `{ok, problems, at, text}`. `OBS.resetSync()` volta ao estado da carga. `date.ago` < 1 min = "agora".
- `change.agoShort` ("há 3 h"), sem particípio; a tela concorda o particípio ("vista", "visto"…).
- `statusLabel` no formato único da CONVENCOES (RODADA F3): "na fila · pedido 14:58", "trabalhando desde 14:45", "atrasado · pedido 14:33", "sem máquina desde 12:55", "nova tentativa · 15:05", "liberado pelo vigia · 15:05", "falhou às 14:21", "recusado às 14:56", "publicado às 14:50". Com Todos, só o 2º pedido, quando de fato está atrás, ganha o sufixo " (atrás do de IA)". "recusado" voltou para 14:56; com Todos, o de Viagem segue na fila atrás do de IA (a vez dele ainda não chegou). Uma previsão ("publicação prevista às …") não é terminal.
- `runSync` não mexe no seu canal (`own`, que sincroniza pelo Painel); ele fica fora de `ok` e da contagem do texto ("11 canais sincronizados; 3 com problema").
- `channel.sync.problemPhrase`, frase única do problema ancorada no último sucesso: "atrasado · última sincronização 23/10 00:00 (há 39 h)", "erro desde 22/10 00:00 · última sincronização boa 21/10 18:00 · não encontrado no YouTube (404)", "buscando vídeos (18 de 50)"; `null` para canal ok.
- `fallbackText` (efeito e multiplicador) = "método: aproximação por faixa — menos de 3 vídeos do canal com série desde o dia 0", sem o n do método descartado.
- `titleDiff` casa palavras repetidas por contagem: só min(ocorrências antes, depois) viram `move`/`case`; o excedente fica "saiu"/"entrou" (Sabrina: dois "$1M" → um).
- `effect.reason` de ganhou/perdeu/neutro = "Efeito +3 pp: fora da faixa normal (−5% a +1%), mas abaixo de 10 pp.": o critério aparece uma vez só e sem o rótulo. As variantes são: acima de +10 pp e fora da faixa · abaixo de −10 pp e fora da faixa · abaixo de 10 pp e dentro da faixa · fora da faixa, mas abaixo de 10 pp · acima de 10 pp, mas dentro da faixa.
- `OBS.fmt.age(idOuVídeo)`: idade pela `ageDays` (a mesma dos filtros de idade): "há 30 dias", "há 1 dia", "há 11 h" abaixo de 1 dia. Use no lugar de `date.ago(pub)`, que arredonda e mostraria 31 dias dentro da faixa 0–30.
- `phaseOf`: canal em dia sem mediana de views/dia (7 d) fica na fase da idade (`recente` até 90 d, `antigo` acima), com `noMedian: true`; nunca `sem-ritmo`. `OBS.phaseOf(x, {m7})` aceita uma mediana para simulação e teste.
- `OBS.outliers(q).orderedIds(sort)` / `.orderedGroups(sort)` → a ordem oficial de exibição, igual à do Outliers. A base é a ordem por multiplicador. `sort = 'vpd'` ordena por views/dia (7 d), com canais atrasados ou com erro no fim; `'recent'` ordena pela publicação. Com `min < 2` saem os grupos "2× ou mais" e "abaixo de 2×"; com `sort ≠ 'mult'`, uma lista única; senão, grupos por fase na ordem de `OBS.PHASES`. As ordenações são estáveis, como na tela hoje. Use o mesmo `q` (com `includeWeak: true`) que o Outliers usa.
- `mult.ageAtRead`: idade em dias inteiros no registro (`viewsAt`), mais `readAt`. Quando a faixa nessa idade ≠ a faixa de `ageDays`, `mult.label` diz o momento: "1,9× vs vídeos do canal com 8–30 dias no registro de 24/10 12:00 (este tinha 30 dias; n = 3)". Sem diferença de faixa, o rótulo fica igual ("(n = 14)").
- `effect.inconclusiveKind` (só em inconclusivo): `janela-dupla` (dois campos na mesma janela ou a < 48 h), `versao-curta` (versão anterior ou nova no ar < 1 dia), `antes-curto` (antes ≤ 2 dias), `outro` (n < 5).
- Fase "estourando agora" e leads das leituras dizem "2,0× ou mais" (`fmt.mult`), nunca "≥ 2×".
- Correção: as leituras publicadas são congeladas e voltam ao texto original da forja ("(≥ 2×)" nos leads). Só a descrição da fase (`OBS.PHASES`/`why`) usa "2,0× ou mais". O teste fixa a assinatura do texto das 13 leituras que não são de cenário.
- `requestScenario`: "atrás do de X" só enquanto o pedido da frente está ativo (na fila, trabalhando, atrasado, sem máquina, nova tentativa, vigia). Em recusado + Todos, o de IA foi recusado às 14:56 e o de Viagem fica "na fila · pedido 14:50", sem sufixo.
- `OBS.forja.compose(base, {niche, createdAt = NOW, state: 'na fila'})`: compõe um pedido novo sobre um cenário, sem trocar o cenário inteiro. O pedido do nicho dado substitui o desse nicho (ou é acrescentado), e os outros ficam. Devolve `{requests, statusLines, statusLabel, statusText, split, active, terminal, quota, machine}`; exemplo: IA publicado às 14:50 + Viagem na fila desde 15:02. O novo ganha "atrás do de X" só se outro pedido ativo estiver na frente.
- `requests` e `statusLines` (em `requestScenario` com Todos e em `compose`) seguem a ordem da fila: pedidos ativos por `createdAt` crescente, com o da frente primeiro, e depois os terminados. `request` = o primeiro dessa ordem. Exemplo: Viagem na fila às 14:50 + IA novo às 15:02 → "Viagem: na fila · pedido 14:50 / IA: na fila · pedido 15:02 (atrás do de Viagem)". Para pegar o pedido de um nicho, procure por `niche`, não pela posição.
- `problemPhrase` de erro diz "última sincronização boa" (21/10 18:00); "último registro diário" fica reservado para o ponto diário da série (21/10 12:00).
- `forja.since(id).shortText`: uma linha, por exemplo "desde então: +8 vídeos novos · 2 ganharam base · 11 saíram da janela · 1 título trocado · 1 canal fora". Usa as mesmas listas de `.text` e diz "nada mudou" só quando nada mudou. Vale também para `leitura-video` ("+5 registros diários · 4 vereditos mudaram · 2 ganharam dias de coleta") e `resumo-trocas`.
- Sincronização entre telas: `runSync` grava em `sessionStorage['obs-sync']` (em try/catch) e o `dados.js` reaplica na carga (`OBS.replaySync()`). `resetSync` limpa. O seu canal nunca é tocado.
- `effect.noBaseText` (só com n = 0): "sem base de comparação: nenhum outro vídeo do canal na faixa 0–7 dias (n = 0)".
- `effect.readyText` (só em "aguardando"): "leitura no domingo, 25/10" / "leitura na quinta, 29/10", com dia da semana do calendário real.
- falhou/recusado com outro pedido ainda ativo (Todos ou `compose`): o `statusText` termina com "O pedido de Viagem segue na fila; peça de novo o de IA quando ele terminar." em vez de "Peça de novo". Sozinho, o recusado continua com "Peça de novo.".
- Com Todos, o `statusText` concorda com as `statusLines`: cada nicho é citado com o estado da sua linha. Falhou com os dois vira plural ("Os 2 pedidos (IA e Viagem) falharam nas 3 tentativas…"); vigia diz "O pedido de Viagem está atrasado, na fila há 57 min, atrás do de IA."; sem máquina diz "Seus pedidos das 14:48 (IA e Viagem) estão na fila…". Em recusado ou falhou com outro ativo, o texto termina com "O pedido de Viagem segue na fila desde 14:50; peça de novo o de IA quando ele terminar." (em `compose` também, sem repetir a frase do pedido ativo).
- `RULES.channelLimit = 50`, só para canais concorrentes (o seu não ocupa vaga). `OBS.channelSlots()` → `{used: 14, limit: 50, free: 36}`; `free` nunca é negativo.
- `forja.timing(type, niche, {count: 0})`: cenário sem leitura → "tempo deste tipo ainda não medido (nenhuma leitura ainda; mediana a partir de 5)".
- `forja.compose(base, req, {niche: 'todos'})`: com Todos, mesmo com 1 pedido, o `statusLabel` e as `statusLines` levam o prefixo do nicho ("Viagem: na fila · pedido 15:02"). Empate de `createdAt`: o que entrou antes fica na frente (estável); `req.seq` opcional desempata, e quem fica atrás ganha "(atrás do de X)".

## Sessão de pedidos à forja — `OBS.forja.session` (F9)
O estado ÚNICO de pedidos do mockup, por nicho. Telas não guardam pedido próprio: leem `current()` e pedem com `ask()`. Trocar de nicho ou de tela nunca cria nem apaga pedido. Fica em `sessionStorage['obs-forja']` (em try/catch) e é reaplicado na carga, como a sincronização.
- `setBase(estado, {type?})`: base da barra de estados do mockup: `'sem pedido'` (padrão) ou um estado de `requestScenario` ('na fila', 'trabalhando', 'publicado', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia', 'falhou', 'recusado (dado velho)'), com os pedidos dos dois nichos de `requestScenario(estado, {niche: 'todos'})`. Também apaga pedidos e cancelamentos feitos antes. Estados válidos: `session.bases`.
- `ask(nicho | 'todos', {type?, createdAt = NOW})` → `{ok, reason, results[{niche, ok, reason}], scenario}`. Compõe um pedido "na fila" só para nicho livre: sem pedido ativo e com cota (falhou ou recusado liberam o nicho; publicado consome a cota). Com `'todos'` pede para cada nicho livre, na ordem dos cliques (`seq`).
- `cancel(nicho | 'todos')`: tira o pedido ativo do nicho; quem estava "atrás" dele perde o sufixo.
- `current(nicho | 'todos')` → cenário completo, no mesmo formato de `requestScenario`/`compose`: `{requests, request, statusLines, statusLabel, statusText, split, active, terminal, quota, machine}`. Sem pedido → `{empty: true, requests: [], statusText: 'Nenhum pedido em andamento.'}`. Com um nicho, só o pedido desse nicho (achado por `niche`); se for exatamente o da base, vêm os textos canônicos de `requestScenario(estado, {niche})`.
- `reset()`: volta a "sem pedido" e limpa o sessionStorage. `replay()`: reaplica o estado salvo (o dados.js já chama na carga). `state()`: cópia do estado.
- Sessão por (tipo, alvo): o alvo é o nicho em padrões, temas e resumo, e o vídeo em `leitura-video`. Assinaturas: `ask(escopo, {type, video})`, `current(escopo, {type, video})`, `cancel(escopo, {type, video})`, `setBase(estado, {type, video})` (em leitura-video usa a leitura de cenário DAQUELE vídeo; sem `video`, a vitrine). Pedir o vídeo A deixa o B livre em `current`. Cota e "ocupado" valem por nicho + tipo: com uma leitura de vídeo de IA ativa, pedir outro vídeo de IA é recusado com o motivo. Chamadas sem `type` usam o tipo da base (padrão `padroes-titulo`).
- `quota.byNiche = {ia: {free, text}, viagem: {free, text}}` em `requestScenario`, `compose` e `session.*`. Com Todos, `quota.text` vai por nicho: "IA: cota livre (recusa não conta) · Viagem: cota usada pelo pedido das 14:50". Com um nicho, o texto de sempre.
- `session.current(nicho)`: a visão de um nicho mantém "(atrás do de X)" no rótulo e no texto quando um pedido ativo de outro nicho, do mesmo tipo, está na frente.
- `forja.since(id).textNoAsk` = `.text` sem a frase final "Peça nova leitura à forja para atualizar." (para quando já há pedido em andamento).
- `session.ask().reason` com pedido ativo: "Nada enviado: já há um pedido de IA na fila · pedido 15:02, atrás do de Viagem.", sem parênteses aninhados.
- `session.current(nicho, {type: 'leitura-video', video})` traz `blockedBy = {video, title, statusLabel, reason}` quando outro vídeo do mesmo nicho tem pedido de leitura ativo (para desabilitar o botão antes do clique); senão `null`.
- Em leitura-video o `statusText` fala do vídeo ("O pedido de leitura deste vídeo está na fila desde 15:02."). Se o pedido espera e a máquina está lendo um pedido de outro tipo ou de outro vídeo, entram `machineBusy` e a frase "A máquina está lendo outro pedido (padrões de título de IA) desde 14:45.".
- `session.current(nicho)` recorta o pedido DESSE nicho do cenário de Todos, com os próprios horários e tentativas (Viagem falha às 14:51, nunca herda o 14:21 da IA). O rótulo é a linha de Todos sem o prefixo. Com um nicho, "sem máquina" diz exatamente "Seu pedido das HH:MM está na fila e roda quando a máquina voltar."; o plural "(IA e Viagem)" só existe com Todos.
- `effect.waitText` (aguardando): "Aguardando: 6 de 7 dias coletados, leitura no domingo, 25/10." + (se for sair inconclusivo) " Vai sair inconclusivo: dois campos do vídeo mudaram na mesma janela de sincronização." O motivo curto também fica em `willBeInconclusiveShort`.
- Fila única (uma máquina): a sessão ordena todos os pedidos ativos de todos os tipos (quem está trabalhando primeiro, depois `createdAt`/`seq`). Cada pedido tem `queuePos`, `queueSize` e `firstInQueue`. O sufixo considera o tipo: "atrás do de IA" (mesmo tipo), "atrás do pedido de padrões de título de IA", "atrás do pedido de leitura de vídeo de Viagem", "atrás do pedido de leitura de outro vídeo". `compose` usa a mesma regra.
- (F10) falhou/recusado com outro pedido ativo: o texto termina com "O pedido de Viagem segue na fila desde 14:50. A recusa de IA não conta na cota; você pode pedir de novo a de IA agora." (com falhou: "A falha de IA…"), porque com Todos o nicho livre pode ser pedido na hora. Substitui o "peça de novo … quando ele terminar".
- `heatmap(...).cells[d][b].dominantChannel = {id, name, share, n, of}` quando um canal tem ≥ 80% dos vídeos da célula; senão `null`.
- `session.current(nicho)` em falhou/recusado traz o motivo completo do próprio pedido: "O pedido de Viagem falhou às 14:51. O validador recusou a saída da forja nas 3 tentativas. Falha não conta na cota."
- `runSync` → `{ok, problems, outOfRound, at, text}`. Canais ainda buscando vídeos não entram na rodada: vão em `outOfRound[{id, label}]`, e `problems` fica só com erro e atrasado. Texto: "11 canais sincronizados agora; 2 com problema; fora da rodada: Vou sem volta (buscando vídeos)".
