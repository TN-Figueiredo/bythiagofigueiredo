# A5 · Canais, 2ª leva: ordem, setas e dica por célula. Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** levar à tela Canais do Observatório o mockup 17 aprovado pelo dono em 15/10: coluna P numerando toda ordenação (posição canônica, empate de competição com "empate"), Crescimento com + e − e "dentro do arredondamento (±N)" por canal, cabeçalho Direção ordenável, barra de ordenação fixa no celular e dica por célula em todas as colunas.

**Architecture:** a regra de número fica no motor e nos modelos puros (`lib/youtube/observatorio/channels.ts`, `medidas/direcao.ts`, `_canais/view-model.ts`, `_canais/posicao-model.ts`, novo `_canais/dicas-model.ts`); a tela só escreve o que o modelo entrega. Uma posição canônica por ordenação (`numero`), calculada uma vez sobre o conjunto da lista com a chave do texto mostrado; `pos` continua existindo só para Inscritos e Views/dia, onde as frases do dono falam de posição do seu canal. As dicas por célula usam um componente novo (`celula-dica.tsx`) sobre o `HoverTip` que o lote rápido já usa. Zero leitura nova de banco e nenhuma migration: tudo sai do dataset do motor, de `carregarMedidasDoSite` (M3a, M8), dos extras do canal próprio e dos retratos MG20 que a página já lê.

**Tech Stack:** Next.js 16 (App Router, Server Components), React 19, TypeScript 5 strict, Vitest (node, jsdom), Playwright (e2e do Gio).

**Spec:** mockup aprovado `docs/superpowers/mockups/2026-10-15-canais-ordem-e-setas/index.html` (r3) com `NOTAS.md`, `REVISAO-LOGAN.md`, `REVISAO-NAKSU.md`, `REVISAO-LOGAN-R3.md` (textos das dicas); decisões do dono no fim de `.superpowers/sdd/a5/decisoes-do-dono.md`; contexto `.superpowers/sdd/a5/discussao-direcao/hanna.md`.

## Global Constraints

- Base: **a 2ª leva começa depois do lote rápido (50 linhas, Tip em cabeçalhos, casas) consertado e integrado em `origin/staging`.** Os consertos do lote (veredito CORRIGE de Yannis: `yannis-lote-rapido.md`, I1, I2, M1, M3) mexem em `canais-screen.tsx`, `canais-lote-rapido-dicas.test.tsx` e `numeros-nao-mudam-e5a.test.ts`, que esta leva também toca. A Tarefa 0 prova isso **por assunto de commit, não por hash** (o hash muda se o lote for rebaseado) antes de qualquer código.
- Sem migration e sem leitura nova de banco. Se uma tarefa achar que precisa, para e devolve ao controlador.
- Textos de interface **à letra** (aspas tipográficas “ ”, sinal de menos U+2212 "−", espaço fino/rígido `NB` como o código já usa). Texto que este plano marca `TEXTO-A-REVISAR (Logan)` entra com esse comentário no código, igual ao resto do produto.
- Sem medida nunca vale 0: valor `null`, fim da lista em qualquer sentido, fora da numeração.
- Fixtures sintéticas (o repo é público): nenhum nome, id ou número de canal real em teste ou semente.
- TypeScript strict, nunca `any`; arquivos kebab-case.
- Cada tarefa: lista FECHADA de arquivos. Tocar arquivo fora da lista exige parar e avisar o controlador.
- Testes: saída para arquivo (`> $SCRATCH/<tarefa>.txt 2>&1`), no contexto só as falhas. `$SCRATCH` = diretório de rascunho da sessão.
- Commits: `git commit -- <caminhos>` com caminhos explícitos, na `staging` local; nunca `git add -A`, `stash`, `reset` (há outros terminais). Hook falhando só por arquivo de outro terminal: `--no-verify` com o seu arquivo já verificado (regra da memória do projeto).
- Mexeu em `packages/*/src`? Não deveria: este plano não toca pacote.
- O "pode" do dono para este documento libera **escrever o plano**. Implementar exige o acordo de Phil e Yannis e o "pode executar" do dono.

## Ordem das tarefas (serial onde há arquivo compartilhado)

`git commit -- <arquivo>` leva o arquivo **inteiro** da árvore de trabalho: duas tarefas que tocam o mesmo arquivo nunca rodam em paralelo na mesma `staging` local.

```
T0 → (T1 ∥ T2) → T3 → T3b → T4 → T5 → T7 → T8 → T9 → T10 → T11
```

- **T1 ∥ T2** podem rodar juntas: listas de arquivos disjuntas (T1: `channels.ts` e seus testes; T2: `medidas/direcao.ts` e o teste dela). Cada uma comita só os seus caminhos.
- **T3 depende de T1** (`withinRounding`); **T3b depende de T3**; **T4 depende de T1 e T3b** (mesmo `view-model.ts`).
- **T6 (componente `CelulaDica`) pode rodar em paralelo a T3..T5 somente porque o CSS dela vai para um arquivo novo `celula-dica.css`**, importado pelo próprio componente: a lista da T6 fica disjunta de `canais.css`. Sem esse arquivo novo, T6 entra na fila serial depois da T5.
- **T7 depende de T2** (`n`/`fechaEm` da Direção) **e de T4** (`GrowthCell`); `dicas-model.ts` usa `import type { GrowthCell }` (evita ciclo de valor com `view-model.ts`, que importa `dicas-model` na T8).
- **T8 depende de T4, T5, T6 e T7**; **T9 depois de T8** (`canais-screen.tsx` e `canais.css` foram tocados na T5 e na T4/T5); **T10 depois de T9**; **T11 por último**.
- Arquivos compartilhados e a ordem em que são tocados: `canais.css` (T4 → T5 → T9), `view-model.ts` (T3 → T3b → T4 → T8), `canais-screen.tsx` (T5 → T9), `numeros-nao-mudam-e5a.test.ts` (T1 → T4 → T8), `canais-lote-rapido-dicas.test.tsx` (T4 → T5 → T8). `celula-dica.css` é só da T6.

## Review Focus

1. **Zero exato e "dentro do arredondamento" no mesmo lugar:** um canal com ganho 0 e outro com ganho +1.000 num canal de 1,2 mi (passo 10 mil) têm de ficar na mesma posição, os dois "sem variação", entre quem cresceu e quem perdeu, em ordem alfabética. Teste na Tarefa 3.
2. **Ordem crescente não muda a posição:** clicar de novo inverte a lista, mas o 1º continua sendo o maior valor e o empate continua A–Z (não Z–A). Teste na Tarefa 3.
3. **Canal próprio sem nicho, com valor, dentro de um nicho:** aparece na lista, não recebe número na coluna P (fora do conjunto) e o bloco diz por quê; nunca um número que pula outro canal. Teste na Tarefa 3.
4. **Clique na dica dentro da linha:** tocar ou clicar numa célula com dica não abre o painel lateral do canal, e os botões e links da célula (Tentar de novo, Remover canal, Planejar em Próximos) continuam funcionando sem virar gatilho de dica. Teste na Tarefa 8.
5. **Direção "não carregou" e canal próprio:** na ordenação por Direção ficam abaixo de "Sem medida", nunca no meio como zero, e o canal próprio nunca recebe ▲ ＝ ▼. Teste na Tarefa 3.

Também cobertos pelas tarefas, fora do top 5: canal abaixo de mil inscritos com ganho zero mostra "sem variação", nunca "−0,0%" (Tarefas 1 e 4); canal próprio e concorrente decidem "oculto" pelo mesmo predicado (Tarefa 4); célula de "Todos" com duas medidas (uma dica por linha de formato, Tarefa 8); dica a 390 px sem sair da tela (Tarefa 6 e e2e da Tarefa 10); filtro e busca não renumeram (Tarefa 3).

---

## Decisões que este plano toma (leitura do código)

### As 3 pendências do Logan

**(a) Outliers é por dia (7 d)? Não.** `lib/youtube/observatorio/multiplier.ts` compara as views **totais** do vídeo com a mediana das views dos outros vídeos acompanhados do mesmo canal **no mesmo dia de vida** (precisa de pelo menos `RULES.weakBase` = 3 vídeos; sem isso, usa a faixa de idade, "aproximação por faixa"). `vpd7` só rotula fase. Na dica: `V` = `Math.round(m.value * m.base)` (as views do vídeo na idade comparada), `E` = `m.base` (a mediana esperada). O texto do Logan ("“T”: M× as views típicas do canal (V contra E).") vale como está. A observação dele de que "a base é a mediana do canal, não a idade" está errada: a base é a mediana **na mesma idade**. Sugestão ao Logan, sem bloquear: "M× as views típicas do canal na mesma idade". Fica `TEXTO-A-REVISAR (Logan)`.

**(b) Corte da mediana de Views/dia: vale o código, 3.** `S.vpdMedian` é a mediana sobre todos os vídeos acompanhados do formato, das views por dia de cada um desde o início da série (`vpdSince`), com `vpdN` e `vpdWindow` = "desde DD/MM". Abaixo de `RULES.weakBase` (3) a célula já se marca fraca. O mockup dizia 5: vale 3. **Desvio a mais:** o texto do Logan diz "dos últimos 90 dias", o que é falso no código (a janela é "desde DD/MM", o início da série). O plano usa "V views por dia, a mediana dos N vídeos longos acompanhados, desde DD/MM. Por mil inscritos: Z views por dia." e marca `TEXTO-A-REVISAR (Logan)`; não se muda a regra do número para caber no texto.

**(c) Data em que o canal próprio passa a medir.**
- **Crescimento:** há fonte. A página já lê os retratos públicos diários do canal próprio (`lerRetratosProprios`, tabela `yt_own_channel_snapshots`, MG20, ≤ 91 linhas por canal pelo índice da PK, janela de 90 dias) e hoje só os passa para a seção Inscritos. A Tarefa 4 passa o mesmo `Map` para `buildCanaisView` e mede o Crescimento do canal próprio pela **mesma** regra dos concorrentes (30 dias, ≥ 29 dias entre os retratos). Custo: zero consulta nova. Sem retrato: o texto do Logan ("Seu canal ainda não tem a coleta de inscritos ligada. Passa a medir 30 dias depois de ligada."). Com retratos mas menos de 30 dias: o texto de "novo" com a data (primeiro retrato + 30 d). Leitura falhou (`'erro'`): "não carregou", nunca 0.
- **Direção:** não há fonte. O canal próprio nunca é medido na M3a (`celulaDeDirecao` devolve `canal_proprio`: o YouTube não dá o número público de views do canal próprio pela mesma via). Logo "Sem data prevista". O texto do Logan ("Seu canal ainda não tem 56 dias de coleta (28 contra 28). Sem data prevista.") sugere que bastaria esperar 56 dias, o que é falso. O plano usa "Seu canal ainda não tem Direção medida. Sem data prevista." e marca `TEXTO-A-REVISAR (Logan)`.

### D1. "Dentro do arredondamento" passa a ser menos de 2 passos, no motor

O mockup aprovado diz "se o ganho ou a perda é menor que 2 passos do arredondamento" e mostra "±N" com N = 2 × passo. Hoje `roundingOf` (em `channels.ts`) usa `|ganho| <= passo` (1 passo). A seção Inscritos (`inscritos-28d.ts`) já usa `|ganho| < 2 × passo` (`REGRAS_INSCRITOS.multiploDoPasso`). A regra muda **no motor** (não só na lista), para a lista, o cabeçalho da página do canal (`_canal/header-model.ts:65`), o Comparar (`_comparar/numeros-model.ts:148`) e o Cowork (que lê o mesmo motor) continuarem iguais entre si. Consequência (conta do Phil, `phil-plano.md` §2): acima de mil inscritos o YouTube corta a contagem a 3 algarismos, então dentro da mesma década as duas contagens são múltiplos do passo P e o ganho é sempre d × P. A regra antiga (`|g| <= P`) e a nova (`|g| < 2P`) dão o **mesmo** resultado para d = 0, ±1 (dentro) e d >= ±2 (fora): **dentro da mesma década nenhum canal muda de "±%" para "sem variação"; o que muda é o N do "±N", que dobra** (±10 mil vira ±20 mil), e o ±2P é o limite honesto (cada leitura erra até 1 passo, a diferença erra até 2). Mudam de célula só três casos: (1) cruzou a década na janela (995.000 → 1.010.000); (2) abaixo de mil inscritos (a regra antiga tratava |g| <= 1 como "≈ 0"; a nova trata só o zero exato como "sem variação", ver I1 na Tarefa 1); (3) `ch.subs` diferente do retrato mais novo, só na virada de década. O oráculo é sintético e **não prevê produção**: a contagem real vem da consulta de leitura do dono (§ "Passo do dono" na Tarefa 1). O teste `numeros-nao-mudam-e5a.test.ts` ganha a exceção declarada **em duas partes** (texto e número, Tarefa 1). **Portão do Phil:** ele confere a exceção.

### D2. M3a `pouco_registro` passa a dizer quantos dias e quando fecha

`pontos()` em `medidas/direcao.ts` devolve só o motivo. Passa a devolver `n` (dias do primeiro retrato até o mais novo) e `fechaEm` (primeiro retrato + 56 dias). Mudança pura de biblioteca, aditiva; as frases atuais (`medidas-frases.ts`, `medidas-telas/frases.ts`) ignoram esses campos, então nada muda nelas. Efeito colateral visível e desejado: a casa "não medido" do resumo, que já escreve "fecha em DD/MM" quando `fechaEm` existe, passa a escrevê-lo também para canal novo. Sem migration (a M3a é calculada na hora, não é gravada).

### D3. Numeração

- Campo novo na linha: `numero: Posicao | null`, para **toda** ordenação, calculado com `posicoes()` (já canônico: 1 + quantos têm valor maior; empate de competição pela `chave`). O conjunto é o mesmo de hoje (`all.filter(inNiche)`), então filtro e busca não renumeram.
- `pos` continua `temPosicao(sort) ? numero : null`: as frases do dono ("Nº de N em inscritos") só existem em Inscritos e Views/dia.
- Chave do empate (o texto mostrado): `subs` → `subsTxt`; `vpd` → `vpdAbs` (como hoje); `growth` → o texto da célula (`"+1,8%"`, e `"0"` para "sem variação"); `direcao` → o percentual inteiro; `active` → `F.dec1(pw)`; `outliers` e `swaps` → o inteiro.
- Ordenação: pelo valor, no sentido escolhido; valores com a **mesma chave** ficam em ordem alfabética pt-BR (`localeCompare(b, 'pt-BR')`) nos dois sentidos. Sem medida no fim: concorrentes antes dos próprios (regra da A3, protegida por teste), e dentro de cada grupo A–Z (o mockup pede A–Z; antes era por inscritos).
- `CanaisSort` ganha `'direcao'`, valor `d.pct` quando `direcao.tipo === 'medido'`, senão `null`. Primeiro clique: maior primeiro (quem mais sobe).
- Crescimento "sem variação" vale 0 para ordenar (fica entre quem cresceu e quem perdeu) e chave `"0"` (empate de todos eles).

### D4. Pontos fora do mockup, decididos aqui (para o Logan conferir na revisão do implementado)

- Faixa "Seus canais" nas ordenações sem posição: os botões são "Ordenar por Inscritos" e "Ordenar por Views/dia" (o mockup); some o "Abrir meu canal" nessas ordenações. `TEXTO-A-REVISAR (Logan)` no código.
- Barra fixa do celular: as 4 ordenações do mockup primeiro (Inscritos, Views/dia, Crescimento, Direção) e depois Ritmo, Outliers, Trocas, em rolagem horizontal da própria barra. Para a Naksu conferir.
- Shorts: as dicas trocam "vídeos longos" por "Shorts".
- Inscritos abaixo de mil (o YouTube mostra o número exato): "N inscritos. Abaixo de mil, o YouTube mostra o número exato." `TEXTO-A-REVISAR (Logan)`.
- Célula sem texto novo no Logan (estados que o mockup não desenhou: atrasado, buscando vídeos, sem Shorts, sem vídeos): a dica é o texto que hoje está no `title` nativo daquela célula, movido para a dica. **A regra "sem `title` nativo" vale para as células de valor** (`td[data-col] [title]`, o `data-col` que a Tarefa 8 cria). Ficam fora da regra, porque não são dica de valor: o nome truncado (`title={r.name}` em `cells.tsx`, a única forma de ler o nome inteiro cortado), o `abbr.langtag title` (semântica do `abbr`), o motivo de botão desabilitado ("Você só pode ler esta lista.") e o botão de ordenar do cabeçalho "Canal".

### Fonte de cada número das dicas

| Dica | Número | De onde vem | Leitura nova? |
|---|---|---|---|
| Inscritos | N, m = passo/2 | `c.subs` (dataset), `passoDoYouTube` | não |
| Views/dia | V, N, desde, Z | `S.vpdMedian`, `S.vpdN`, `S.vpdWindow`, `S.perMilSubs` (motor); canal próprio: extras diário (`o.ev.n`, janela) | não |
| Ritmo | L, S, X | `obs.cadence(id,'long').n`, `obs.cadence(id,'short').n`, `lastUpload` | não |
| Outliers | T, M, V, E | `S.bestOutlier` (título, `mult.value`, `mult.base`), `S.outliers90`, `vpdN` | não |
| Trocas | tipo, T, N, data | `trocasDe30(obs, id)` (ObsChange `type`, `at`, vídeo) | não |
| Sincronização | X, N, horários | `c.sync.last`/`errorSince`, `S.tracked`, `obs.SYNC.slots` | não |
| Crescimento | X, Y, G, P, N | `S.growth30` (`from`/`to` → retratos do dataset), `roundingUnit`; canal próprio: MG20 já lido pela página | não |
| Direção | R, A, P, n, fecha | `direcaoNumeros` e `CelulaDeDirecao` (M3a de `carregarMedidasDoSite`); `n`/`fechaEm` da D2 | não |

---

## Mapa de arquivos

Base: `apps/web/src/app/cms/(authed)/youtube/competitors/` = `$C`; `apps/web/src/lib/youtube/observatorio/` = `$L`; `apps/web/test/youtube/observatorio/` = `$T`.

| Arquivo | Tarefa | Responsabilidade |
|---|---|---|
| `$L/channels.ts` | 1 | `crescimento30()` exportada; regra de 2 passos |
| `$L/medidas/direcao.ts` | 2 | `pouco_registro` com `n` e `fechaEm` |
| `$C/_canais/posicao-model.ts` | 3, 3b | textos da numeração, faixa, divisor, frase de ordem |
| `$C/_canais/view-model.ts` | 3, 3b, 4, 8 | `numero`, chave, `'direcao'`, Crescimento, dicas na linha |
| `$C/_canais/dicas-model.ts` (novo) | 7 | texto de cada dica, puro |
| `$C/_canais/celula-dica.tsx` (novo) | 6 | gatilho e caixa da dica por célula |
| `$C/_canais/cells.tsx` | 4, 8 | Crescimento +/−, dicas nas células |
| `$C/_canais/channel-table.tsx` | 5, 8 | P "empate", chevrons, Direção ordenável, ⓘ, legenda, linha de ordem |
| `$C/_canais/channel-cards.tsx` | 5, 8, 9 | canto com número e "empate", dicas |
| `$C/_canais/canais-screen.tsx` | 5, 9 | linha de ordem, barra fixa |
| `$C/_canais/own-block.tsx` | 5 | faixa nas ordenações sem posição |
| `$C/_canais/direcao-dica.tsx` | 8 | removido (substituído por `celula-dica.tsx`) |
| `$C/_canais/canais.css` | 4, 5, 9 (nessa ordem, serial) | estilos |
| `$C/_canais/celula-dica.css` (novo) | 6 | estilos só da dica por célula (importado por `celula-dica.tsx`; deixa a T6 disjunta de `canais.css`) |
| `$C/page.tsx` | 4 | passa `retratosProprios` à lista |
| `apps/web/e2e/tests/cms/observatorio/canais-a5-ordem-setas.spec.ts` (novo) | 10 | e2e do Gio |
| `apps/web/e2e/fixtures/observatorio-seed.ts` | 10 | empates sintéticos |

---

### Task 0: Pré-condição e linha de base

**Files:**
- Nenhum arquivo de código. Saída em `$SCRATCH/a5-canais-t0-base.txt`.

**Interfaces:**
- Produces: a linha de base de falhas da suíte de Canais (para separar falha antiga de falha nova).

- [ ] **Step 1: Provar que o lote rápido está na base**

Conferir **por assunto do commit, não por hash** (o lote pode ser rebaseado antes do push e o hash muda). Dois assuntos têm de existir em `origin/staging`: o do lote rápido (o commit que "conserta o seletor do cabeçalho Outliers") **e** o do commit de consertos do lote (I1, I2, M1, M3 do `yannis-lote-rapido.md`).

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && git fetch origin staging && git log origin/staging --format=%s > $SCRATCH/a5-t0-assuntos.txt && grep -qF "conserta o seletor do cabeçalho Outliers" $SCRATCH/a5-t0-assuntos.txt && echo LOTE-OK; grep -iE "lote rápido|lote-rapido|consert" $SCRATCH/a5-t0-assuntos.txt | head -20`
Expected: `LOTE-OK` e, na lista, o assunto do commit de consertos do lote (I1/I2/M1/M3 do Yannis). Sem os dois: **parar** e avisar o controlador (o plano escreve sobre o `Tip` dos cabeçalhos e a `direcao-dica.tsx` do lote rápido, e as Tarefas 1, 4, 5, 8 e 9 colidem com os consertos dele em `canais-screen.tsx`, `canais-lote-rapido-dicas.test.tsx` e `numeros-nao-mudam-e5a.test.ts`). Conferir também que a árvore de trabalho está na ponta de `origin/staging` para esses três arquivos (`git log origin/staging -1 --format=%h -- <arquivo>` contra o `HEAD` local).

- [ ] **Step 2: Rodar a suíte de Canais e guardar a linha de base**

Run (**mesmo escopo do fecho da Tarefa 11**, para falha antiga não aparecer como nova): `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/observatorio > $SCRATCH/a5-canais-t0-base.txt 2>&1; grep -E "Test Files|Tests " $SCRATCH/a5-canais-t0-base.txt; grep -E "FAIL|×" $SCRATCH/a5-canais-t0-base.txt | sort -u > $SCRATCH/a5-canais-t0-falhas.txt; wc -l $SCRATCH/a5-canais-t0-falhas.txt`
Se a suíte inteira passar de 4 min, rodar em background com saída em arquivo e devolver o controle ao controlador.
Expected: tudo verde (ou a lista de falhas antigas em `$SCRATCH/a5-canais-t0-falhas.txt`). Falha aqui é anterior a este plano: anotar no ledger e avisar, não consertar.

---

### Task 1: Crescimento em 30 dias exportado e "dentro do arredondamento" = menos de 2 passos

**Files:**
- Modify: `apps/web/src/lib/youtube/observatorio/channels.ts` (`roundingOf`, `channelStats` linhas ~100-152)
- Create: `apps/web/test/youtube/observatorio/crescimento30-a5.test.ts`
- Modify: `apps/web/test/youtube/observatorio/channels.test.ts` (~linha 99)
- Modify: `apps/web/test/youtube/observatorio/comparar-numeros.test.ts` (~linhas 64-76)
- Modify: `apps/web/test/youtube/observatorio/numeros-nao-mudam-e5a.test.ts` (exceções declaradas, em duas partes: texto e número)

**Interfaces:**
- Consumes: `passoDoYouTube(n)` e `REGRAS_INSCRITOS.multiploDoPasso` de `inscritos-28d.ts`; `ChannelSnapshot` de `types.ts`; `EngineCtx` de `series.ts`.
- Produces:
  ```ts
  export interface Crescimento30 {
    abs: number | null; pct: number | null; from?: number; to?: number; pending?: string
    /** Inscritos nas duas pontas da comparação (Yannis M5): a célula e a dica não refazem `snapshots.find`. */
    fromSubs?: number; toSubs?: number
    /** Quantos dias de retrato existem (primeiro → mais novo), para a dica de canal novo. null sem retrato. */
    diasDeRegistro: number | null
    /** Primeiro retrato + 30 dias (ms), quando ainda falta; null fora disso. */
    fechaEm: number | null
    roundingUnit: number; roundingError: number; roundingText: string
    /** |abs| < 2 × passo (passo da maior das duas contagens); abaixo de mil inscritos só o zero exato. null sem contagem ou sem medida. */
    withinRounding: boolean | null
    /** 2 × passo: o "±N" que a tela mostra. 0 abaixo de mil inscritos. */
    limiteArred: number
    uncertainty: number; text: string | null
  }
  export function crescimento30(deps: Pick<EngineCtx, 'clock' | 'fmt'>, snapshots: readonly ChannelSnapshot[], subs: number | null): Crescimento30
  ```
  `channelStats(...).growth30` passa a ser `crescimento30(ctx, ch.snapshots, ch.subs)`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// @vitest-environment node
// A5 2ª leva, D1: crescimento em 30 dias como função do motor; "dentro do arredondamento" = |ganho| < 2 passos (igual à seção Inscritos).
import { describe, it, expect } from 'vitest'
import { crescimento30 } from '@/lib/youtube/observatorio/channels'
import { createTestObservatory } from './oracle'
import type { ChannelSnapshot } from '@/lib/youtube/observatorio/types'

const DAY = 86_400_000
const T0 = Date.UTC(2026, 7, 1, 12)
const snap = (dia: number, subs: number): ChannelSnapshot => ({ t: T0 + dia * DAY, date: new Date(T0 + dia * DAY).toISOString().slice(0, 10), subs, views: 1000 * dia })
const obs = createTestObservatory()
const deps = { clock: obs.date, fmt: obs.fmt }

describe('crescimento30', () => {
  it('ganho de 1 passo fica dentro do arredondamento, com ±2 passos (já era "dentro" na regra antiga; o que muda é o ±N)', () => {
    const g = crescimento30(deps, [snap(0, 1_200_000), snap(30, 1_210_000)], 1_210_000)
    expect(g.abs).toBe(10_000)
    expect(g.roundingUnit).toBe(10_000)
    expect(g.withinRounding).toBe(true)
    expect(g.limiteArred).toBe(20_000)
  })
  it('virada de década na janela: 995.000 → 1.010.000 (ganho 15.000) agora é "dentro" (passo da maior contagem, igual a inscritos-28d)', () => {
    const g = crescimento30(deps, [snap(0, 995_000), snap(30, 1_010_000)], 1_010_000)
    expect(g.withinRounding).toBe(true)
    expect(g.limiteArred).toBe(20_000)
  })
  it('ganho de exatamente 2 passos fica fora (regra estrita, igual a inscritos-28d)', () => {
    const g = crescimento30(deps, [snap(0, 1_200_000), snap(30, 1_220_000)], 1_220_000)
    expect(g.withinRounding).toBe(false)
    expect(g.pct).toBeCloseTo(20_000 / 1_200_000)
  })
  it('abaixo de mil inscritos: zero exato é "sem variação" (nunca "−0,0%"); ±1 é ganho de verdade', () => {
    const zero = crescimento30(deps, [snap(0, 800), snap(30, 800)], 800)
    expect(zero.withinRounding).toBe(true)
    expect(zero.limiteArred).toBe(0)
    const um = crescimento30(deps, [snap(0, 800), snap(30, 801)], 801)
    expect(um.withinRounding).toBe(false)
    expect(um.abs).toBe(1)
    expect(um.limiteArred).toBe(0)
  })
  it('janela de 29 a 33 dias: com buraco na coleta (comparação de 60 dias) não mede e diz "buraco na contagem"', () => {
    const g = crescimento30(deps, [snap(0, 1_200_000), snap(60, 1_300_000)], 1_300_000)
    expect(g.abs).toBeNull()
    expect(g.pending).toMatch(/buraco na contagem/)
  })
  it('devolve as contagens das duas pontas', () => {
    const g = crescimento30(deps, [snap(0, 1_200_000), snap(30, 1_250_000)], 1_250_000)
    expect(g.fromSubs).toBe(1_200_000)
    expect(g.toSubs).toBe(1_250_000)
  })
  it('canal novo: diz quantos dias tem e quando fecha', () => {
    const g = crescimento30(deps, [snap(0, 5000), snap(12, 5100)], 5100)
    expect(g.abs).toBeNull()
    expect(g.diasDeRegistro).toBe(12)
    expect(g.fechaEm).toBe(T0 + 30 * DAY)
  })
  it('sem retrato: sem contagem, sem data', () => {
    const g = crescimento30(deps, [], 5000)
    expect(g.pending).toBe('sem contagem')
    expect(g.diasDeRegistro).toBeNull()
    expect(g.fechaEm).toBeNull()
  })
  it('inscritos ocultos: nada a comparar', () => {
    const g = crescimento30(deps, [snap(0, 5000), snap(30, 5100)], null)
    expect(g.withinRounding).toBeNull()
  })
})
```

Se `createTestObservatory` em `oracle.ts` pedir argumento, usar o mesmo que `channels.test.ts` usa (ler o topo dele e copiar).

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/crescimento30-a5.test.ts > $SCRATCH/a5-t1.txt 2>&1; grep -E "FAIL|✓|×" $SCRATCH/a5-t1.txt | head`
Expected: FAIL, `crescimento30` não exportada.

- [ ] **Step 3: Implementar**

Em `channels.ts`, importar `passoDoYouTube` e `REGRAS_INSCRITOS` de `./inscritos-28d` e `ChannelSnapshot` de `./types`. Trocar `snapAt` para receber a lista e criar a função:

```ts
const snapAt = (snaps: readonly ChannelSnapshot[], ms: number) => { let best: ChannelSnapshot | null = null; for (const x of snaps) { if (x.t <= ms) best = x; else break } return best }

export function crescimento30(deps: Pick<EngineCtx, 'clock' | 'fmt'>, snapshots: readonly ChannelSnapshot[], subs: number | null): Crescimento30 {
  const { clock, fmt } = deps
  const now = snapshots.length ? snapshots[snapshots.length - 1]! : null
  const first = snapshots.length ? snapshots[0]! : null
  const prev = now ? snapAt(snapshots, now.t - 30 * DAY) : null
  // Phil I3: "em 30 dias" não pode ser 31 a 90. Só mede com 29 <= dias <= 33 (a seção Inscritos usa 28 a 31 com folga de 3); fora disso é buraco na coleta, fora da numeração.
  const dias = now && prev ? (now.t - prev.t) / DAY : null
  const medido = dias != null && dias >= 29 && dias <= 33
  const buraco = dias != null && dias > 33
  const growth = medido
    ? { abs: now!.subs - prev!.subs, pct: prev!.subs > 0 ? (now!.subs - prev!.subs) / prev!.subs : null, from: prev!.t, to: now!.t, fromSubs: prev!.subs, toSubs: now!.subs }
    : { abs: null, pct: null, pending: buraco ? 'buraco na contagem (última comparação de ' + Math.round(dias!) + ' d)' : now ? 'faltam ' + Math.ceil(30 - (now.t - first!.t) / DAY) + ' d (primeira contagem ' + clock.dm(first!.t) + ')' : 'sem contagem' }
  const diasDeRegistro = now && first ? Math.floor((now.t - first.t) / DAY) : null
  const fechaEm = !medido && !buraco && first ? first.t + 30 * DAY : null
  // Phil M1: o passo sai da maior das duas contagens comparadas (como inscritos-28d.ts:53); `subs` só decide "oculto".
  const base = medido ? Math.max(prev!.subs, now!.subs) : subs
  return { ...growth, diasDeRegistro, fechaEm, ...roundingOf(fmt, subs, base, growth.abs) }
}

function roundingOf(fmt: EngineCtx['fmt'], subs: number | null, base: number | null, abs: number | null) {
  // subs null = o YouTube esconde a contagem: nada a arredondar, nada a comparar.
  if (subs == null) return { roundingUnit: 1, roundingError: 0, roundingText: 'sem contagem', withinRounding: null, limiteArred: 0, uncertainty: 0, text: null }
  const b = base ?? subs
  const unit = b < 1000 ? 1 : Math.pow(10, Math.floor(Math.log10(b)) - 2)
  const err = b < 1000 ? 0 : unit / 2
  // A5 2ª leva, D1: a mesma regra da seção Inscritos (inscritos-28d): menos de 2 passos pode ser só arredondamento
  const limite = REGRAS_INSCRITOS.multiploDoPasso * passoDoYouTube(b)
  // I1 (Phil e Yannis): abaixo de mil não há arredondamento (limite 0); o zero exato continua "sem variação", senão a célula escreveria "−0,0%".
  const dentro = abs == null ? null : limite > 0 ? Math.abs(abs) < limite : abs === 0
  return {
    roundingUnit: unit, roundingError: err, roundingText: err ? '±' + fmt.num(err) : 'exato',
    withinRounding: dentro, limiteArred: limite, uncertainty: b < 1000 ? 0 : unit,
    text: abs == null ? null : dentro ? (limite > 0 ? '≈ 0 (dentro do arredondamento do YouTube, ±' + fmt.num(limite) + ')' : '0 (mesmo número nas duas contagens)')
      : (abs > 0 ? '+' : '') + fmt.num(abs) + (unit > 1 ? ' (±' + fmt.num(unit) + ')' : ''),
  }
}
```

Conferir que `passoDoYouTube(b)` devolve o mesmo `unit` acima de mil (ler `inscritos-28d.ts:16`); se divergir, **parar** e avisar (as duas regras têm de concordar). Em `channelStats`, apagar o bloco `now/prev/growth` e usar `growth30: crescimento30(ctx, ch.snapshots, ch.subs)`. Exportar `Crescimento30`. O teto de 33 dias (`pending: 'buraco na contagem …'`) é conserto do Phil (I3, recomendado): os canais que ele atinge hoje entram na exceção declarada do Step 5 e a consulta do dono (abaixo) conta quantos são. Atualizar o `interface Growth` de `view-model.ts`? **Não nesta tarefa** (arquivo fora da lista): `Crescimento30` é superconjunto de `Growth`, então compila.

- [ ] **Step 4: Rodar o teste novo e os consumidores**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/crescimento30-a5.test.ts test/youtube/observatorio/channels.test.ts test/youtube/observatorio/comparar-numeros.test.ts test/youtube/observatorio/numeros-nao-mudam-e5a.test.ts test/youtube/observatorio/canal-header-model.test.ts > $SCRATCH/a5-t1.txt 2>&1; grep -E "FAIL|×|AssertionError" $SCRATCH/a5-t1.txt | head -30`
Expected: o teste novo passa; falham só as asserções de "≈ 0 / ±passo" em `channels.test.ts:99`, `comparar-numeros.test.ts:64-76` e as linhas de Crescimento do retrato em `numeros-nao-mudam-e5a.test.ts` (o "±N" de **todo** canal "dentro" dobra; não só dos que mudam de célula).

- [ ] **Step 5: Ajustar os três testes antigos, um a um**

- `channels.test.ts`: o texto do caso "dentro" passa a `±{2×passo}`; acrescentar o caso de 2 passos exatos `false`, o de virada de década (995.000 → 1.010.000 = dentro) e os dois de abaixo de mil (800 → 800 `true`; 800 → 801 `false`).
- `comparar-numeros.test.ts`: o par que esperava `kind: 'ok'` e agora cai em `flat` (virada de década ou abaixo de mil) é ajustado caso a caso; manter um par com ganho >= 2 passos em `ok`.
- `numeros-nao-mudam-e5a.test.ts` (guarda de regressão; **a exceção é declarada em duas partes, por extenso**, como os desvios 13 e 14 que o arquivo já traz):
  1. **Texto:** o "±N" dos campos de texto do crescimento (`cells.growth`, `growthTitle`, `painel.stats`, `cabecalho`) passa a "±2N". Normalizar com regex que troca o "±N" pelo "±2N" no valor *antigo* antes de comparar, com o comentário `// A5 2ª leva D1 (dono aprovou no mockup 17, 15/10): o ±N do "dentro do arredondamento" dobra (1 passo -> 2 passos)`.
  2. **Número:** a lista de ids que mudam de "dentro/fora" é uma exceção por **predicado calculado no próprio teste**, para provar que a exceção é a D1 e nada mais: `ids que mudaram == ids com (P < |g| < 2P) ou (subs < 1000 e |g| <= 1 e g != 0)` ou, pelo teto de 33 dias, com janela > 33 dias (os que passam a "buraco na contagem"). Calcular `P` com `passoDoYouTube(max(contagens))`.
  3. Nunca regravar `e5a-retrato-antes.json`.
- Contar quantos canais do oráculo mudam e escrever no ledger (`.superpowers/sdd/a5/progress.md`, seção "2ª leva Canais"): "D1: N de M canais do oráculo mudam de célula". **Esta contagem não prevê produção** (o oráculo é sintético, contagens podem não ser múltiplos do passo): ela só prova que a exceção é exatamente a D1. Phil confere.

- [ ] **Passo do dono (leitura de produção; o agente NÃO roda): contagem real da D1 e do teto de 33 dias**

Para o dono rodar no SQL Editor do Supabase (produção) antes do deploy da Tarefa 1. Só `select`, lê ~75 canais × <= 91 retratos pelo índice `(competitor_channel_id, snapshot_date desc)`. Texto do Phil (`phil-plano.md` §6):

```sql
with s as (
  select competitor_channel_id cid, snapshot_date d, subscriber_count n
  from competitor_channel_snapshots
  where subscriber_count is not null and snapshot_date >= current_date - 90
), ult as (
  select distinct on (cid) cid, d, n from s order by cid, d desc
), ant as (
  select distinct on (u.cid) u.cid, s.d, s.n
  from ult u join s on s.cid = u.cid and s.d <= u.d - 30
  order by u.cid, s.d desc
), b as (
  select c.id, c.channel_name, c.subscriber_count atual, a.n n0, u.n n1, u.n - a.n g, (u.d - a.d) dias
  from competitor_channels c join ult u on u.cid = c.id join ant a on a.cid = c.id
  where (u.d - a.d) >= 29
), p as (
  select *,
    case when atual < 1000 then 0 else power(10, floor(log(atual::numeric)) - 2) end pa,
    case when greatest(n0, n1) < 1000 then 0 else power(10, floor(log(greatest(n0, n1)::numeric)) - 2) end pm
  from b where atual is not null
), r as (
  select *,
    case when atual < 1000 then abs(g) <= 1 else abs(g) <= pa end antigo,
    (2 * pa > 0 and abs(g) < 2 * pa) novo_plano,
    case when pm > 0 then abs(g) < 2 * pm else g = 0 end novo_phil
  from p
)
select count(*) medidos,
  count(*) filter (where antigo <> novo_plano) muda_plano,
  count(*) filter (where antigo <> novo_phil) muda_com_conserto,
  count(*) filter (where atual < 1000 and g = 0) zero_abaixo_de_mil,
  count(*) filter (where dias > 33) janela_maior_que_33d,
  string_agg(case when antigo <> novo_phil then channel_name || ' (' || n0 || '→' || n1 || ')' end, '; ') quais
from r;
```

Valor esperado: `muda_plano` e `muda_com_conserto` entre 0 e 2 (só viradas de década e canais abaixo de mil); `zero_abaixo_de_mil` é quantas linhas sairiam com "−0,0%" sem o conserto I1; `janela_maior_que_33d` mede o teto de 33 dias. **Se `muda_*` passar de 5: parar e devolver a saída ao Phil** (a premissa "as contagens são múltiplos do passo" estaria falsa). Os números vão para o ledger; no dia do deploy, `quais` deve bater com os canais que mudaram de célula.

Run de novo o Step 4. Expected: PASS.

- [ ] **Step 6: Typecheck e commit**

Run: `cd apps/web && npx tsc --noEmit -p . > $SCRATCH/a5-t1-tsc.txt 2>&1; tail -3 $SCRATCH/a5-t1-tsc.txt`
Expected: sem erro.

```bash
git commit -m "feat: observatório: crescimento em 30 dias exportado e dentro do arredondamento abaixo de 2 passos" -- apps/web/src/lib/youtube/observatorio/channels.ts apps/web/test/youtube/observatorio/crescimento30-a5.test.ts apps/web/test/youtube/observatorio/channels.test.ts apps/web/test/youtube/observatorio/comparar-numeros.test.ts apps/web/test/youtube/observatorio/numeros-nao-mudam-e5a.test.ts
```

---

### Task 2: M3a `pouco_registro` com `n` e `fechaEm`

**Files:**
- Modify: `apps/web/src/lib/youtube/observatorio/medidas/direcao.ts:46-63`
- Modify: `apps/web/test/youtube/observatorio/medidas-direcao-estado.test.ts`

**Interfaces:**
- Consumes: `somaDias`, `MEASURE_RULES.direction.windowDays` (28), `naoMedido(motivo, { n, fechaEm })` de `medidas/tipos.ts`.
- Produces: `Medida` `{ estado: 'nao_medido', motivo: 'pouco_registro', n: number, fechaEm: string /* 'AAAA-MM-DD' */ }` em `direcaoDoCanalInteiro`. `celulaDeDirecao` já repassa `n` e `fechaEm` (`direcao-model.ts:42-44`) para a célula: a célula `nao_medido` passa a carregar `fechaEm`.

- [ ] **Step 1: Escrever o teste que falha** (no fim de `medidas-direcao-estado.test.ts`, reusando o construtor de retratos que o arquivo já tem; se o nome for outro, ler o topo e usar o dele)

```ts
describe('A5 2ª leva D2: pouco registro diz quantos dias e quando fecha', () => {
  it('20 dias de retrato: n = 20 e fecha no primeiro + 56', () => {
    const retratos = Array.from({ length: 21 }, (_, i) => retrato(somaDias('2026-09-20', i), 1000 + i * 10))
    const m = direcaoDoCanalInteiro(retratos, '2026-10-10')
    expect(m).toMatchObject({ estado: 'nao_medido', motivo: 'pouco_registro', n: 20, fechaEm: '2026-11-15' })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/medidas-direcao-estado.test.ts > $SCRATCH/a5-t2.txt 2>&1; grep -E "FAIL|×|Expected" $SCRATCH/a5-t2.txt | head`
Expected: FAIL, `n` e `fechaEm` ausentes.

- [ ] **Step 3: Implementar**

```ts
type Falha = { motivo: 'sem_registro_recente' | 'pouco_registro' | 'sem_registro_na_borda'; desde?: string; n?: number; fechaEm?: string }
// em pontos():
  if (b.primeiro > somaDias(b.d, -passo * k)) {
    // A5 2ª leva D2: quantos dias há e quando a janela fecha. `n` conta dias de REGISTRO do canal (retratos de views totais), não de vídeos.
    // `fechaEm` é "a partir de", a data mais cedo: a M3a exige retrato com views exatamente em D−28 e D−56 e `bordas.primeiro` conta também retrato sem views; faltando um desses dias, depois de `fechaEm` o motivo vira `sem_registro_na_borda` (que tem a sua frase).
    const n = Math.round((Date.parse(b.d) - Date.parse(b.primeiro)) / 86_400_000)
    return { motivo: 'pouco_registro', n, fechaEm: somaDias(b.primeiro, passo * k) }
  }
// em direcaoDoCanalInteiro():
  if (ehFalha(p)) return naoMedido(p.motivo, { ...(p.desde ? { desde: p.desde } : {}), ...(p.n != null ? { n: p.n } : {}), ...(p.fechaEm ? { fechaEm: p.fechaEm } : {}) })
```

Se `direcaoDoCanalInteiro` não for a única chamadora de `pontos` com `ehFalha`, aplicar o mesmo repasse nas outras chamadoras do arquivo (todas dentro de `direcao.ts`).

- [ ] **Step 4: Rodar este teste e os de tela que leem a M3a**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/medidas-direcao-estado.test.ts test/youtube/observatorio/canais-e5a-modelos.test.ts test/youtube/observatorio/canais-e5a-tela.test.tsx test/youtube/observatorio/numeros-nao-mudam-e5a.test.ts > $SCRATCH/a5-t2.txt 2>&1; grep -E "FAIL|×" $SCRATCH/a5-t2.txt | head`
Expected: PASS. Se um teste da tela do resumo falhar porque a casa "não medido" agora escreve "fecha em DD/MM" para canal novo, isso é o efeito declarado em D2: ajustar a asserção **nesse** teste exige acrescentá-lo à lista de arquivos; avisar o controlador antes.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: observatório: direção com pouco registro diz quantos dias tem e quando fecha" -- apps/web/src/lib/youtube/observatorio/medidas/direcao.ts apps/web/test/youtube/observatorio/medidas-direcao-estado.test.ts
```

---

### Task 3: Numeração em toda ordenação, empate A–Z e Direção ordenável (modelo)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/view-model.ts` (tipo `CanaisSort` linha 46, `CanaisRow`, `SORTNAME` 262, `pick` 287, `valoresOf` ~522, `valorTxt`/`posMap`/`byKey`/`ranked`/`unranked` ~625-660)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/posicao-model.ts` (`emTexto`, `motivoSemValor`)
- Create: `apps/web/test/youtube/observatorio/canais-a5-numeracao.test.ts`
- Modify: `apps/web/test/youtube/observatorio/canais-a3-posicao.test.ts` (lista `SORTS` e as asserções de ordem do fim da lista)

**Interfaces:**
- Consumes: `Crescimento30.withinRounding` (Tarefa 1), `CelulaDeDirecao` (`direcao-model.ts`), `posicoes` (`lib/youtube/observatorio/posicao.ts`).
- Produces:
  - `export type CanaisSort = 'active' | 'vpd' | 'outliers' | 'swaps' | 'growth' | 'subs' | 'direcao'`
  - `CanaisRow.numero: Posicao | null` (toda ordenação; `pos` segue só em `POSICIONADAS`)
  - `CanaisRow.valor.direcao: number | null`
  - `SORTNAME.direcao = 'Direção'`
  - `emTexto('direcao', ...) = 'direção das views'`, `emTexto('growth', ...) = 'crescimento em 30 dias'` (se `growth` ainda não tiver caso)

- [ ] **Step 1: Escrever o teste que falha**

```ts
// @vitest-environment node
// A5 2ª leva, D3: a coluna P numera toda ordenação (posição canônica, empate de competição), empate A–Z nos dois sentidos,
// Direção ordenável, sem medida no fim e nunca zero.
import { describe, it, expect } from 'vitest'
import { a3World } from './a3-fixture'
import { medidasDoMotor, direcaoMedida } from './canais-e5a-fixture'
import { buildCanaisView, type CanaisParams, type CanaisRow, type CanaisSort, type CanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import type { Observatory } from '@/lib/youtube/observatorio'
import type { Dataset } from '@/lib/youtube/observatorio/types'

const DAY = 86_400_000
const all = (v: CanaisView): CanaisRow[] => [...v.list.ranked, ...v.list.unranked]
const view = (obs: Observatory, p: Partial<CanaisParams> = {}) => buildCanaisView(obs, { niche: 'todos', limit: 75, ...p })
const comps = (ds: Dataset) => ds.channels.filter(c => !c.own)

/** Retratos sintéticos de 31 dias com o ganho pedido (o último é "hoje" do mundo). */
function retratos(ds: Dataset, id: string, de: number, ganho: number) {
  const ch = ds.channels.find(c => c.id === id)!
  const fim = ds.now
  ch.subs = de + ganho
  ch.snapshots = [
    { t: fim - 30 * DAY, date: new Date(fim - 30 * DAY).toISOString().slice(0, 10), subs: de, views: 1 },
    { t: fim, date: new Date(fim).toISOString().slice(0, 10), subs: de + ganho, views: 2 },
  ]
}

describe('numeração (coluna P)', () => {
  it('Ritmo, Outliers, Trocas e Crescimento também numeram: 1º é o maior', () => {
    const { obs } = a3World()
    for (const sort of ['active', 'outliers', 'swaps', 'growth'] as CanaisSort[]) {
      const v = view(obs, { sort })
      const com = v.list.ranked.filter(r => r.numero)
      expect(com.length, sort).toBeGreaterThan(0)
      const max = Math.max(...com.map(r => r.valor[sort]!))
      expect(com.find(r => r.valor[sort] === max)!.numero!.pos, sort).toBe(1)
      expect(v.list.unranked.every(r => r.numero === null), sort).toBe(true)
    }
  })
  it('pos (as frases do dono) só existe em Inscritos e Views/dia', () => {
    const { obs } = a3World()
    expect(all(view(obs, { sort: 'growth' })).every(r => r.pos === null)).toBe(true)
    expect(all(view(obs, { sort: 'subs' })).some(r => r.pos !== null)).toBe(true)
  })
  it('ordem crescente inverte a lista mas não a posição (1º continua o maior)', () => {
    const { obs } = a3World()
    const desc = view(obs, { sort: 'subs', dir: 'desc' }).list.ranked
    const asc = view(obs, { sort: 'subs', dir: 'asc' }).list.ranked
    expect(asc[0]!.numero!.pos).toBe(Math.max(...asc.map(r => r.numero!.pos)))
    expect(desc[0]!.numero!.pos).toBe(1)
  })
})

describe('empate', () => {
  it('zero exato e dentro do arredondamento dividem a posição, A–Z nos dois sentidos, entre quem cresceu e quem perdeu', () => {
    const { obs } = a3World(ds => {
      const [a, b, c, d] = comps(ds)
      a!.name = 'Zeta'; b!.name = 'Alfa'
      retratos(ds, a!.id, 1_200_000, 0)          // zero exato
      retratos(ds, b!.id, 1_200_000, 10_000)     // 1 passo: dentro de 2 passos
      retratos(ds, c!.id, 1_200_000, 60_000)     // cresceu
      retratos(ds, d!.id, 1_200_000, -60_000)    // perdeu
    })
    for (const dir of ['desc', 'asc'] as const) {
      const r = view(obs, { sort: 'growth', dir }).list.ranked
      // Afirma sobre o subconjunto com chave "0" (valor 0): não depende de nenhum outro canal do a3World cair no meio de "Alfa" e "Zeta".
      const zeros = r.filter(x => x.valor.growth === 0)
      expect(zeros.map(x => x.name), dir).toEqual(zeros.map(x => x.name).sort((p, q) => p.localeCompare(q, 'pt-BR'))) // A–Z também no crescente
      expect(zeros.length).toBeGreaterThanOrEqual(2)
      expect(new Set(zeros.map(x => x.numero!.pos)).size).toBe(1)
      expect(zeros.every(x => x.numero!.empate)).toBe(true)
      expect(zeros.map(x => x.name)).toEqual(expect.arrayContaining(['Alfa', 'Zeta']))
    }
  })
})

describe('Direção ordenável', () => {
  it('abre com quem mais sobe; não medido e não carregou no fim, nunca 0; canal próprio fora', () => {
    const { obs } = a3World()
    const [a, b, c, d] = obs.channels.filter(x => !x.own)
    // `medidasDoMotor` dá a todo concorrente SEM entrada `m3a: direcaoMedida(120, 100)` (+20% medido): o "não medido" tem de ser declarado.
    const medidas = medidasDoMotor(obs, {
      [a!.id]: { m3a: direcaoMedida(1500, 1000) },   // +50%
      [b!.id]: { m3a: direcaoMedida(900, 1000) },    // −10%
      [c!.id]: 'nao_carregou',
      [d!.id]: { m3a: naoMedido('pouco_registro', { n: 20, fechaEm: '2026-11-15' }) }, // import de medidas/tipos
    })
    const v = view(obs, { sort: 'direcao', medidas })
    expect(v.list.ranked[0]!.id).toBe(a!.id)
    expect(v.list.ranked.every(r => r.valor.direcao !== null)).toBe(true)
    const fim = v.list.unranked.map(r => r.id)
    expect(fim).toContain(c!.id)
    expect(fim).toContain(d!.id)
    expect(v.list.unranked.filter(r => r.own).every(r => r.valor.direcao === null)).toBe(true)
  })
  it('sem medida no fim: concorrentes antes dos próprios, A–Z dentro de cada grupo (inscritos em ordem oposta ao nome)', () => {
    // 3 concorrentes "não carregou", nomes e inscritos em ordem oposta: o mutante "manter subsDesc no fim" não sobrevive.
    const { obs } = a3World(ds => {
      const [x, y, z] = comps(ds)
      x!.name = 'Canal Ômega'; x!.subs = 900_000
      y!.name = 'Canal Beta'; y!.subs = 50_000
      z!.name = 'Canal Alfa'; z!.subs = 10_000
    })
    const ids = comps(obs.dataset ?? (obs as never as { ds: Dataset }).ds).slice(0, 3).map(c => c.id) // usar o acessor de dataset que a3-fixture expõe
    const medidas = medidasDoMotor(obs, Object.fromEntries(ids.map(id => [id, 'nao_carregou'])))
    const v = view(obs, { sort: 'direcao', medidas })
    const u = v.list.unranked
    const ultimoComp = u.map(r => r.own).lastIndexOf(false), primeiroOwn = u.findIndex(r => r.own)
    if (primeiroOwn >= 0) expect(ultimoComp).toBeLessThan(primeiroOwn)
    const nomes = u.filter(r => !r.own).map(r => r.name)
    expect(nomes.length).toBeGreaterThanOrEqual(3)
    expect(nomes).toEqual([...nomes].sort((x, y) => x.localeCompare(y, 'pt-BR')))
  })
})

describe('conjunto', () => {
  it('canal próprio sem nicho num nicho: aparece, sem número, e não pula a numeração', () => {
    const { obs } = a3World(ds => { const o = ds.channels.find(c => c.own)!; o.niche = null })
    const nicho = obs.channels.find(c => !c.own)!.niche!
    const v = view(obs, { niche: nicho, sort: 'subs' })
    const own = all(v).find(r => r.own && r.niche == null)!
    expect(own.numero).toBeNull()
    const ns = v.list.ranked.filter(r => r.numero).map(r => r.numero!.pos)
    expect(ns[0]).toBe(1)
  })
  it('filtro "só com problema" não renumera', () => {
    const { obs } = a3World()
    const todos = new Map(all(view(obs, { sort: 'growth' })).map(r => [r.id, r.numero?.pos]))
    const filtrados = all(view(obs, { sort: 'growth', filter: 'problemas' }))
    // Pré-condição: se nenhum canal filtrado tem posição > 1, o mutante "numerar sobre os visíveis" sobreviveria.
    expect(filtrados.some(r => r.numero!.pos > 1)).toBe(true)
    for (const r of filtrados) expect(r.numero?.pos).toBe(todos.get(r.id))
  })
})
```

Notas para o executor: `naoMedido` vem de `@/lib/youtube/observatorio/medidas/tipos`; o acesso ao dataset na 2ª `it` de Direção usa o que `a3-fixture.ts` expõe (ler o arquivo; trocar a linha `const ids = …` por esse acessor, ou pegar os 3 ids dentro do mutador do `a3World`). Se `Dataset` não tiver `now`, usar o campo de "agora" que `a3-fixture.ts` usa (ler o arquivo); se `medidasDoMotor` aceitar `'nao_carregou'` por canal com outro formato, seguir o tipo `PorCanal` de `canais-e5a-fixture.ts:27`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/canais-a5-numeracao.test.ts > $SCRATCH/a5-t3.txt 2>&1; grep -E "FAIL|×|error" $SCRATCH/a5-t3.txt | head -20`
Expected: FAIL (`numero` inexistente, `'direcao'` não aceito).

- [ ] **Step 3: Implementar**

1. `CanaisSort` ganha `'direcao'`; `SORTNAME.direcao = 'Direção'`; a lista do `pick` (linha 287) ganha `'direcao'`.
2. `valoresOf`:
   ```ts
   growth: S.growth30.pending || S.growth30.abs == null ? null : S.growth30.withinRounding ? 0 : S.growth30.pct,
   direcao: (() => { const d = direcaoDe(c); return d.tipo === 'medido' ? d.pct : null })(),
   ```
   (`direcaoDe` é a função que já monta `CelulaDeDirecao` para a linha; se o nome for outro, usar o que `rowOf` usa para `direcao`.) Para o canal próprio, `direcaoDe` devolve `canal_proprio`: `null`.
3. Chave do empate (substitui `valorTxt` de `posMap`, mas `valorTxt` continua para as frases de `subs`/`vpd`):
   ```ts
   const chaveDe = (c: ObsChannel, s: CanaisSort): string | undefined => {
     const x = valoresOf(c)[s]
     if (x == null) return undefined
     switch (s) {
       case 'subs': return subsTxt(x)
       case 'vpd': return vpdAbs(x)
       case 'growth': return x === 0 ? '0' : `${x > 0 ? '+' : '−'}${F.dec1(Math.abs(x * 100))}`
       case 'direcao': return String(x)
       case 'active': return F.dec1(x)
       case 'outliers': case 'swaps': return String(x)
     }
   }
   const conjuntoIds = all.filter(inNiche)
   const numMap = posicoes(conjuntoIds.map(c => ({ id: c.id, x: valoresOf(c)[sort], chave: chaveDe(c, sort) })))
   ```
   Em `rowOf`: `numero: numMap.get(c.id) ?? null`, `pos: temPosicao(sort) ? (numMap.get(c.id) ?? null) : null`. Apagar `posMap`. O `switch` sem `default` precisa cobrir todos os `CanaisSort` (o compilador acusa se faltar).
4. Comparador:
   ```ts
   const chaves = new Map(all.map(c => [c.id, chaveDe(c, sort)]))
   const colador = new Intl.Collator('pt-BR') // montado uma vez (Yannis): menor e mais limpo que localeCompare(…, 'pt-BR') por comparação
   const aZ = (a: CanaisRow, b: CanaisRow) => colador.compare(a.name, b.name)
   const byKey = (a: CanaisRow, b: CanaisRow) => {
     const x = a.valor[sort], y = b.valor[sort]
     if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1
     if (chaves.get(a.id) === chaves.get(b.id)) return aZ(a, b) // empate: A–Z nos dois sentidos
     return (y - x) * sgn
   }
   ```
   `unranked`: `(a.own ? 1 : 0) - (b.own ? 1 : 0) || aZ(a, b)` (troca o `subsDesc`; apagar `subsDesc` se não sobrar uso).
   `fila` (vizinhos da frase do dono): ordenar com o mesmo `byKey` aplicado aos ids, para os vizinhos baterem com a tabela.
5. `posicao-model.ts`: `emTexto` ganha `case 'growth': return 'crescimento em 30 dias'` e `case 'direcao': return 'direção das views'` se ainda não houver; `motivoSemValor` não muda (cai em `'ordenacao-sem-posicao'` para `direcao`).
6. `canais-a3-posicao.test.ts`: acrescentar `'direcao'` a `SORTS`; onde o teste afirmava o fim da lista por inscritos, trocar pela regra A–Z com o comentário `// A5 2ª leva D3: sem medida A–Z (mockup 17)`.

- [ ] **Step 4: Rodar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/canais-a5-numeracao.test.ts test/youtube/observatorio/canais-a3-posicao.test.ts test/youtube/observatorio/canais-view-model.test.ts test/youtube/observatorio/proprio-a4-canais.test.ts > $SCRATCH/a5-t3.txt 2>&1; grep -E "FAIL|×" $SCRATCH/a5-t3.txt | head -20`
Expected: PASS. Falha de texto (frase de ordem, nota) é da Tarefa 3b: anotar e deixar para ela **só** se a asserção for de texto que a 3b muda; o resto se conserta aqui.

- [ ] **Step 5: Typecheck e commit**

Run: `cd apps/web && npx tsc --noEmit -p . > $SCRATCH/a5-t3-tsc.txt 2>&1; grep -c "error TS" $SCRATCH/a5-t3-tsc.txt`
Expected: `0`. Um `Record<CanaisSort, ...>` em outro arquivo (ex.: `channel-table.tsx` `COLS`, `channel-cards.tsx`) que não compile por falta de `direcao`: acrescentar a chave com o valor mínimo (`'Direção'`) é permitido **só** nesses dois arquivos, e eles entram no commit.

```bash
git commit -m "feat: canais: coluna P numera toda ordenação, empate A–Z e Direção ordenável no modelo" -- "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/view-model.ts" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/posicao-model.ts" apps/web/test/youtube/observatorio/canais-a5-numeracao.test.ts apps/web/test/youtube/observatorio/canais-a3-posicao.test.ts
```

---

### Task 3b: Textos da ordem, da faixa e do divisor (modelo)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/posicao-model.ts` (`motivoTexto` caso `'ordenacao-sem-posicao'`, `divisorDe`, funções novas abaixo)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/view-model.ts` (`sortNote` ~940, `posicaoNotas` ~687, campos novos de `CanaisView`)
- Create: `apps/web/test/youtube/observatorio/canais-a5-textos.test.ts`
- Modify: `apps/web/test/youtube/observatorio/canais-a3-tela.test.tsx` (linhas 132, 270), `canais-a3-lista-consertos.test.tsx` (132), `proprio-a4-canais.test.ts` (104), `canais-a3-posicao.test.ts` (165, 221, 279-282, 515): só as asserções do texto `'ordenacao-sem-posicao'` e da frase de ordem

**Interfaces:**
- Consumes: `CanaisSort` com `'direcao'` (Tarefa 3), `CanaisRow.numero`.
- Produces (em `posicao-model.ts`):
  ```ts
  export const ORDEM_POSICAO = 'Posição: 1º é o maior valor, em qualquer sentido.'
  export const ORDEM_EMPATE = 'Empate: mesmo valor na tela, mesma posição.'
  export function sentidoDaOrdem(sort: CanaisSort, dir: 'asc' | 'desc'): string | null
  export function semValorDoProprio(sort: CanaisSort): string | null
  export const FAIXA_SEM_POSICAO: string
  export function notaDoDivisor(sort: CanaisSort): string | null
  ```
  Em `CanaisView`: `ordem: { coluna: string; sentido: string | null; empate: boolean }` (linha "Ordenado por …" do mockup) e `faixaSemPosicao: { linha1: string | null; linha2: string } | null` (preenchida só em ordenações fora de `POSICIONADAS`).

- [ ] **Step 1: Escrever o teste que falha**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { a3World } from './a3-fixture'
import { buildCanaisView, type CanaisParams } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { motivoTexto, sentidoDaOrdem, semValorDoProprio, notaDoDivisor, FAIXA_SEM_POSICAO, ORDEM_POSICAO, ORDEM_EMPATE } from '@/app/cms/(authed)/youtube/competitors/_canais/posicao-model'

const { obs } = a3World()
const view = (p: Partial<CanaisParams> = {}) => buildCanaisView(obs, { niche: 'todos', limit: 75, ...p })

describe('textos à letra do mockup 17', () => {
  it('sentido da ordem', () => {
    expect(sentidoDaOrdem('growth', 'desc')).toBe('de quem mais ganhou a quem mais perdeu inscritos em 30 dias')
    expect(sentidoDaOrdem('growth', 'asc')).toBe('de quem mais perdeu a quem mais ganhou inscritos em 30 dias')
    expect(sentidoDaOrdem('direcao', 'desc')).toBe('de quem mais sobe a quem mais cai em views')
    expect(sentidoDaOrdem('direcao', 'asc')).toBe('de quem mais cai a quem mais sobe em views')
    expect(sentidoDaOrdem('subs', 'desc')).toBe('do maior ao menor número de inscritos')
    expect(sentidoDaOrdem('subs', 'asc')).toBe('do menor ao maior número de inscritos')
    expect(sentidoDaOrdem('vpd', 'desc')).toBe('do maior ao menor número de views por dia')
    expect(sentidoDaOrdem('vpd', 'asc')).toBe('do menor ao maior número de views por dia')
    expect(sentidoDaOrdem('active', 'desc')).toBeNull()
  })
  it('posição e empate', () => {
    expect(ORDEM_POSICAO).toBe('Posição: 1º é o maior valor, em qualquer sentido.')
    expect(ORDEM_EMPATE).toBe('Empate: mesmo valor na tela, mesma posição.')
  })
  it('faixa do canal próprio nas ordenações sem posição', () => {
    expect(FAIXA_SEM_POSICAO).toBe('A posição do seu canal em relação aos outros só existe em Inscritos e Views/dia, os números de tamanho e de alcance. Aqui, a coluna P numera os canais da lista.')
    expect(motivoTexto('ordenacao-sem-posicao')).toBe(FAIXA_SEM_POSICAO)
    expect(semValorDoProprio('growth')).toBe('Seu canal ainda não tem Crescimento medido.')
    expect(semValorDoProprio('direcao')).toBe('Seu canal ainda não tem Direção medida.')
    expect(semValorDoProprio('subs')).toBeNull()
  })
  it('notas do divisor', () => {
    expect(notaDoDivisor('growth')).toBe('Estes canais não têm Crescimento medido; o motivo está em cada linha. Sem número, não entram na numeração e nunca valem zero.')
    expect(notaDoDivisor('direcao')).toBe('Estes canais não têm Direção medida; o motivo está em cada linha. Sem número, não entram na numeração e nunca valem zero.')
    expect(notaDoDivisor('subs')).toBe('Estes canais escondem os inscritos.')
    expect(notaDoDivisor('vpd')).toBe('Estes canais ainda não têm views por dia medidas.')
    expect(notaDoDivisor('active')).toBeNull()
  })
  it('a vista entrega a linha de ordem e a faixa', () => {
    const v = view({ sort: 'growth' })
    expect(v.ordem.coluna).toBe('Crescimento')
    expect(v.ordem.sentido).toBe('de quem mais ganhou a quem mais perdeu inscritos em 30 dias')
    expect(v.faixaSemPosicao!.linha2).toBe(FAIXA_SEM_POSICAO)
    expect(view({ sort: 'subs' }).faixaSemPosicao).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/canais-a5-textos.test.ts > $SCRATCH/a5-t3b.txt 2>&1; grep -E "FAIL|×" $SCRATCH/a5-t3b.txt | head`
Expected: FAIL (funções inexistentes).

- [ ] **Step 3: Implementar em `posicao-model.ts`**

```ts
export const ORDEM_POSICAO = 'Posição: 1º é o maior valor, em qualquer sentido.'
export const ORDEM_EMPATE = 'Empate: mesmo valor na tela, mesma posição.'
export const FAIXA_SEM_POSICAO = 'A posição do seu canal em relação aos outros só existe em Inscritos e Views/dia, os números de tamanho e de alcance. Aqui, a coluna P numera os canais da lista.'

export function sentidoDaOrdem(sort: CanaisSort, dir: 'asc' | 'desc'): string | null {
  const d = dir === 'desc'
  switch (sort) {
    case 'growth': return d ? 'de quem mais ganhou a quem mais perdeu inscritos em 30 dias' : 'de quem mais perdeu a quem mais ganhou inscritos em 30 dias'
    case 'direcao': return d ? 'de quem mais sobe a quem mais cai em views' : 'de quem mais cai a quem mais sobe em views'
    case 'subs': return d ? 'do maior ao menor número de inscritos' : 'do menor ao maior número de inscritos'
    case 'vpd': return d ? 'do maior ao menor número de views por dia' : 'do menor ao maior número de views por dia'
    default: return null
  }
}
export function semValorDoProprio(sort: CanaisSort): string | null {
  if (sort === 'growth') return 'Seu canal ainda não tem Crescimento medido.'
  if (sort === 'direcao') return 'Seu canal ainda não tem Direção medida.'
  return null
}
export function notaDoDivisor(sort: CanaisSort): string | null {
  const semNumero = (c: string) => `Estes canais não têm ${c}; o motivo está em cada linha. Sem número, não entram na numeração e nunca valem zero.`
  switch (sort) {
    case 'growth': return semNumero('Crescimento medido')
    case 'direcao': return semNumero('Direção medida')
    case 'subs': return 'Estes canais escondem os inscritos.'
    case 'vpd': return 'Estes canais ainda não têm views por dia medidas.'
    default: return null
  }
}
```

`motivoTexto('ordenacao-sem-posicao')` passa a devolver `FAIXA_SEM_POSICAO`. `divisorDe(n, em, sort)` ganha o terceiro argumento: quando `notaDoDivisor(sort)` não é nulo, a nota é ela; senão, a de hoje ("sem {em}; ficam no fim em qualquer direção"). O título "Ainda sem medida para ordenar (n)" não muda.

- [ ] **Step 4: Implementar em `view-model.ts`**

- `ordem: { coluna: SORTNAME[sort] + (sort === 'vpd' ? (rel ? ' por mil inscritos' : ' em número absoluto') : ''), sentido: sentidoDaOrdem(sort, dir) ?? (dir === 'desc' ? 'maior primeiro' : 'menor primeiro'), empate: list.ranked.some(r => r.numero?.empate) }`. O `sortNote` antigo continua (o leitor de tela e a legenda usam), agora `Ordenado por ${ordem.coluna}, ${ordem.sentido}` + o sufixo de "Todos" de hoje.
- `faixaSemPosicao`: `temPosicao(sort) || !allOwns.length ? null : { linha1: ownRows.some(r => r.valor[sort] == null) ? semValorDoProprio(sort) : null, linha2: FAIXA_SEM_POSICAO }`.
- `posicaoNotas`: tirar o `if (temPosicao(sort))` (a numeração vale para toda ordenação; as notas de conjunto e filtro também).
- `divisorDe(unranked.length, emDaOrdem, sort)`.

- [ ] **Step 5: Rodar o teste novo e ajustar os antigos**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/canais-a5-textos.test.ts test/youtube/observatorio/canais-a3-tela.test.tsx test/youtube/observatorio/canais-a3-lista-consertos.test.tsx test/youtube/observatorio/proprio-a4-canais.test.ts test/youtube/observatorio/canais-a3-posicao.test.ts test/youtube/observatorio/canais-screen.test.tsx test/youtube/observatorio/canais-view-model.test.ts test/youtube/observatorio/canais-a3-formato.test.ts > $SCRATCH/a5-t3b.txt 2>&1; grep -E "FAIL|×|Expected|Received" $SCRATCH/a5-t3b.txt | head -40`
Expected: o novo passa; nos antigos, falham só as asserções do texto antigo de `'ordenacao-sem-posicao'` ("Esta ordenação não mostra posição…") e da frase "maior primeiro"/"menor primeiro" em Inscritos/Views/dia. Trocar cada uma pela constante importada (`FAIXA_SEM_POSICAO`, `sentidoDaOrdem(...)`), nunca por cópia do texto. Rodar de novo: PASS.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: canais: textos da ordem, da faixa do seu canal e do divisor (mockup 17)" -- "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/posicao-model.ts" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/view-model.ts" apps/web/test/youtube/observatorio/canais-a5-textos.test.ts apps/web/test/youtube/observatorio/canais-a3-tela.test.tsx apps/web/test/youtube/observatorio/canais-a3-lista-consertos.test.tsx apps/web/test/youtube/observatorio/proprio-a4-canais.test.ts apps/web/test/youtube/observatorio/canais-a3-posicao.test.ts apps/web/test/youtube/observatorio/canais-screen.test.tsx apps/web/test/youtube/observatorio/canais-view-model.test.ts apps/web/test/youtube/observatorio/canais-a3-formato.test.ts
```
(Entram no commit só os testes que de fato mudaram; os outros saem da lista.)

---

### Task 4: Célula de Crescimento com + e −, "sem variação" e o canal próprio pelo MG20

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/view-model.ts` (`Growth` linha 44, `GrowthCell` 65, `growthCell` 422, linha 581, `CanaisParams`, `valoresOf` para o canal próprio)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/cells.tsx` (`GrowthView`)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/canais.css`
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx` (passa `retratosProprios` a `buildCanaisView`)
- Create: `apps/web/test/youtube/observatorio/canais-a5-crescimento.test.ts`
- Modify: `apps/web/test/youtube/observatorio/numeros-nao-mudam-e5a.test.ts` (a forma da célula de Crescimento muda em **todo** canal: exceção declarada **de forma**, nunca de número; `montarRetrato()` grava `growth`, `growthTitle` e `cells` inteiros)
- Modify: `apps/web/test/youtube/observatorio/canais-lote-rapido-dicas.test.tsx` (asserções de `≈ 0`/seta do Crescimento, se houver)

**Interfaces:**
- Consumes: `crescimento30`, `Crescimento30` (Tarefa 1); `RetratosProprios` (`import type` de `@/lib/youtube/observatorio/retratos-proprios`; só tipo: o arquivo é `server-only`).
- Produces:
  ```ts
  // CanaisParams
  retratosProprios?: ReadonlyMap<string, RetratosProprios> | 'erro'
  // GrowthCell
  export type GrowthCell =
    | { kind: 'na'; text: string; title: string; motivo: 'novo' | 'sem-registro' | 'oculto' | 'nao-carregou' | 'sem-sinal' | 'sem-percentual' | 'buraco'; fechaEm: number | null; dias: number | null }
    | { kind: 'flat'; big: 'sem variação'; cap: string; limite: number; antes: number | null; depois: number | null; de: number | null; ate: number | null; atrasadoAte: number | null; abs: number; passo: number }
    | { kind: 'ok'; big: string; cap: string; antes: number | null; depois: number | null; de: number | null; ate: number | null; atrasadoAte: number | null; abs: number; pct: number }
  ```
  `de`/`ate` = datas (ms) dos dois retratos comparados (a dica escreve "De X em DD/MM para Y em DD/MM", Phil I3). `atrasadoAte` = data do último retrato quando ele está velho (concorrente parado ou canal próprio com retrato com mais de `REGRAS_INSCRITOS.retratoVelhoDias` dias), senão `null` (Phil I4).
  (`title` some de `flat`/`ok`: a dica nasce na Tarefa 7 com esses campos; `na.title` fica até a Tarefa 8 trocá-lo pela dica.)

- [ ] **Step 1: Escrever o teste que falha**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { a3World } from './a3-fixture'
import { buildCanaisView, type CanaisParams, type CanaisRow } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import type { Dataset } from '@/lib/youtube/observatorio/types'

const DAY = 86_400_000
const NB = ' '
function retratos(ds: Dataset, id: string, de: number, ganho: number) {
  const ch = ds.channels.find(c => c.id === id)!, fim = ds.now
  ch.subs = de + ganho
  ch.snapshots = [{ t: fim - 30 * DAY, date: '', subs: de, views: 1 }, { t: fim, date: '', subs: de + ganho, views: 2 }]
}
const rowOf = (rows: CanaisRow[], id: string) => rows.find(r => r.id === id)!

describe('Crescimento: + e −, sem setas', () => {
  it('ganho: "+1,7%" e "+20 mil em 30 d"', () => {
    let id = ''
    const { obs } = a3World(ds => { id = ds.channels.find(c => !c.own)!.id; retratos(ds, id, 1_200_000, 20_000) })
    const v = buildCanaisView(obs, { niche: 'todos', limit: 75, sort: 'growth' })
    const g = rowOf([...v.list.ranked, ...v.list.unranked], id).cells.growth
    expect(g).toMatchObject({ kind: 'ok', big: '+1,7%' })
    expect(g.kind === 'ok' && g.cap.startsWith(`+20${NB}mil em 30${NB}d`)).toBe(true)
  })
  it('perda usa o sinal de menos U+2212', () => {
    let id = ''
    const { obs } = a3World(ds => { id = ds.channels.find(c => !c.own)!.id; retratos(ds, id, 1_200_000, -30_000) })
    const g = rowOf(buildCanaisView(obs, { niche: 'todos', limit: 75 }).list.ranked, id).cells.growth
    expect(g.kind === 'ok' && g.big).toBe('−2,5%')
  })
  it('dentro do arredondamento: "sem variação" e "dentro do arredondamento (±20 mil)"', () => {
    let id = ''
    const { obs } = a3World(ds => { id = ds.channels.find(c => !c.own)!.id; retratos(ds, id, 1_200_000, 10_000) })
    const g = rowOf(buildCanaisView(obs, { niche: 'todos', limit: 75 }).list.ranked, id).cells.growth
    expect(g).toMatchObject({ kind: 'flat', big: 'sem variação', cap: `dentro do arredondamento (±20${NB}mil)` })
  })
})

describe('zero, oculto e retrato velho (Yannis I1/I7, Phil I4)', () => {
  it('abaixo de mil, 800 → 800: "sem variação", nunca "−0,0%" nem "−0"', () => {
    let id = ''
    const { obs } = a3World(ds => { id = ds.channels.find(c => !c.own)!.id; retratos(ds, id, 800, 0) })
    const g = rowOf(buildCanaisView(obs, { niche: 'todos', limit: 75 }).list.ranked, id).cells.growth
    expect(g).toMatchObject({ kind: 'flat', big: 'sem variação' })
    expect(JSON.stringify(g)).not.toContain('−0')
    expect(g.kind === 'flat' && g.cap).toBe('mesmo número nas duas contagens')
  })
  it('um predicado de "oculto": próprio com subs null no dataset e retratos não ocultos mede; concorrente com extras.subscribersHidden fica fora da numeração', () => {
    // próprio: ds own.subs = null + retratosProprios com oculto:false e 31 dias → cells.growth.kind === 'ok'
    // concorrente: extras.subscribersHidden = true (mutador do a3World) → valor.growth === null e numero === null
  })
  it('canal próprio com retrato mais novo de 5 dias atrás: cap termina em "até DD/MM"', () => {
    // retratosProprios com retratos de 31 dias terminando em NOW − 5 d → g.cap.endsWith(`até ${dd/mm}`) e atrasadoAte !== null
  })
  it('buraco: comparação de 60 dias vira "buraco na contagem", fora da numeração', () => {
    // retratos(…) com snapshots em NOW − 60 d e NOW → kind 'na', motivo 'buraco', numero null
  })
})

describe('Crescimento do canal próprio pelos retratos MG20 (já lidos pela página)', () => {
  const base = (p: Partial<CanaisParams>) => { const w = a3World(); const own = w.obs.ownChannels()[0]!; return { v: buildCanaisView(w.obs, { niche: 'todos', limit: 75, ...p }), own } }
  it('com 31 dias de retrato: mede como concorrente', () => {
    const w = a3World(); const own = w.obs.ownChannels()[0]!
    const fim = w.obs.NOW
    const retratosProprios = new Map([[own.id, { oculto: false, retratos: [
      { t: fim - 30 * DAY, date: '', subs: 50_000, views: 1 }, { t: fim, date: '', subs: 52_000, views: 2 },
    ] }]])
    const v = buildCanaisView(w.obs, { niche: 'todos', limit: 75, sort: 'growth', retratosProprios })
    const r = rowOf([...v.list.ranked, ...v.list.unranked], own.id)
    expect(r.cells.growth).toMatchObject({ kind: 'ok', big: '+4,0%' })
    expect(r.valor.growth).toBeCloseTo(0.04)
  })
  it('sem retrato: "sem registro", fora da numeração', () => {
    const { v, own } = base({ sort: 'growth', retratosProprios: new Map() })
    const r = rowOf(v.list.unranked, own.id)
    expect(r.cells.growth).toMatchObject({ kind: 'na', motivo: 'sem-registro' })
    expect(r.numero).toBeNull()
  })
  it('leitura falhou: "não carregou", nunca 0', () => {
    const { v, own } = base({ sort: 'growth', retratosProprios: 'erro' })
    const r = rowOf(v.list.unranked, own.id)
    expect(r.cells.growth).toMatchObject({ kind: 'na', motivo: 'nao-carregou' })
    expect(r.valor.growth).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/canais-a5-crescimento.test.ts > $SCRATCH/a5-t4.txt 2>&1; grep -E "FAIL|×" $SCRATCH/a5-t4.txt | head`
Expected: FAIL.

- [ ] **Step 3: Implementar no modelo**

1. `interface Growth` vira `type Growth = Crescimento30` (import de `@/lib/youtube/observatorio/channels`).
2. Crescimento por canal:
   ```ts
   // (`rp` = `p.retratosProprios`, declarado uma vez fora, antes de `ocultoDe` e de `growthDe`.)
   // Yannis I7: UM predicado de "oculto" para a célula, o `rowOf` e o `valoresOf` (próprio: o da seção Inscritos, `rp.get(id).oculto`; concorrente: `subs == null` ou `extras.subscribersHidden`).
   const ocultoDe = (c: ObsChannel): boolean => c.own
     ? (rp !== 'erro' && rp?.get(c.id)?.oculto === true)
     : (c.subs == null || extrasDoCanal(c.id)?.subscribersHidden === true)
   // `valoresOf`: `growth` e `subs` ficam `null` quando `ocultoDe(c)` (canal oculto nunca recebe número na coluna P).
   const growthDe = (c: ObsChannel, S: ReturnType<typeof stats>): Growth | 'nao-carregou' => {
     if (!c.own) return S.growth30
     const rp = p.retratosProprios
     if (rp === 'erro') return 'nao-carregou'
     const meu = rp?.get(c.id)
     return crescimento30({ clock: obs.date, fmt: obs.fmt }, meu?.retratos ?? [], ocultoDe(c) ? null : (meu?.retratos.at(-1)?.subs ?? c.subs))
   }
   ```
   `valoresOf.growth` usa `growthDe` (`'nao-carregou'` → `null`); a célula idem. `rp` ausente (chamadas antigas sem o parâmetro) = `new Map()` = "sem registro", nunca erro.
3. `growthCell(c, g)`:
   ```ts
   function growthCell(c: ObsChannel, g: Growth | 'nao-carregou', oculto: boolean): GrowthCell {
     const na = (text: string, title: string, motivo: Extract<GrowthCell, { kind: 'na' }>['motivo'], extra: { fechaEm?: number | null; dias?: number | null } = {}): GrowthCell =>
       ({ kind: 'na', text, title, motivo, fechaEm: extra.fechaEm ?? null, dias: extra.dias ?? null })
     const sinal = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') // três vias (Yannis I1): zero não ganha sinal
     if (g === 'nao-carregou') return na('não carregou', 'Os registros de inscritos do seu canal não carregaram nesta abertura.', 'nao-carregou') // TEXTO-A-REVISAR (Logan)
     if (oculto) return na('não medido: oculto', 'O canal esconde a contagem de inscritos no YouTube.', 'oculto')
     if (g.pending) {
       if (g.diasDeRegistro == null) return na('sem registro', 'Sem registro de inscritos ainda.', 'sem-registro')
       if (g.fechaEm == null) return na('buraco na contagem', 'A contagem de inscritos tem um buraco: não há dois retratos a cerca de 30 dias um do outro.', 'buraco') // TEXTO-A-REVISAR (Logan)
       return na(g.pending.replace(/ \(.*\)/, ''), `Canal novo no observatório: precisa de 30 d de contagem de inscritos, ${g.pending}`, 'novo', { fechaEm: g.fechaEm, dias: g.diasDeRegistro })
     }
     // Retrato velho (Phil I4): concorrente parado pela `c.sync.state`; canal próprio pelo MESMO limite da seção Inscritos (`REGRAS_INSCRITOS.retratoVelhoDias`).
     const velhoProprio = c.own && g.to != null && (obs.NOW - g.to) / DAY > REGRAS_INSCRITOS.retratoVelhoDias
     const velhoConc = !c.own && c.sync.state !== 'ok' && !isBf(c)
     const atrasadoAte = (velhoProprio || velhoConc) && g.to != null ? g.to : null
     const until = atrasadoAte != null ? `, até ${D.dmhm(atrasadoAte)}` : ''
     const base = { antes: g.fromSubs ?? null, depois: g.toSubs ?? null, de: g.from ?? null, ate: g.to ?? null, atrasadoAte }
     if (g.withinRounding) return { kind: 'flat', big: 'sem variação', cap: g.limiteArred > 0 ? `dentro do arredondamento (±${F.num(g.limiteArred).replace(/ (mil|mi)/g, NB + '$1')})` : 'mesmo número nas duas contagens', /* TEXTO-A-REVISAR (Logan): cap do zero abaixo de mil */ limite: g.limiteArred, ...base, abs: g.abs!, passo: g.roundingUnit }
     const absTxt = `${sinal(g.abs!)}${F.num(Math.abs(g.abs!))}`.replace(/ (mil|mi)/g, NB + '$1')
     if (g.pct == null) return na(`${absTxt} em 30${NB}d${until}`, 'Sem percentual: o canal não tinha inscritos na contagem anterior.', 'sem-percentual')
     return { kind: 'ok', big: `${sinal(g.pct)}${F.dec1(Math.abs(g.pct * 100))}%`, cap: `${absTxt} em 30${NB}d${until}`, ...base, abs: g.abs!, pct: g.pct }
   }
   ```
   `antes`/`depois` vêm de `g.fromSubs`/`g.toSubs` (Tarefa 1, Yannis M5): nenhum `snapshots.find`, nenhum ramo `c.own ? retratosProprios : c.snapshots`. Conferir se `F.num(20000)` já escreve "20 mil" com espaço comum (o código de hoje troca `/ (mil|mi)/` por `NB`): manter essa troca.
   Linha 581: `const growth = growthCell(c, growthDe(c, S), ocultoDe(c))` (e `rowOf` usa `ocultoDe(c)` onde hoje calcula `oculto`; `valoresOf` idem, ver o predicado acima).
   Linha 592 (`growth`/`growthTitle` da linha): `growthTitle: growth.kind === 'na' ? growth.title : growth.cap`.
   Se um canal com inscritos `< 1000` ganhar ou perder 1, o sinal sai do `abs` (`limiteArred` = 0 → "sem variação" só no zero exato; ±1 aparece como "+1"/"−1"). Nunca "−0,0%" nem "−0".
4. `page.tsx`: na chamada de `buildCanaisView`, acrescentar `retratosProprios,` (a variável já existe na linha 70). Sem consulta nova.

- [ ] **Step 4: Implementar a célula (`cells.tsx`, `GrowthView`)**

- `ok`: `<b className="gr-n">{c.big}</b>` (cor neutra, sem `Ic` de seta) e `<span className="cap">{c.cap}</span>`.
- `flat`: `<span className="gr-flat">sem variação</span>` (texto apagado) e `<span className="cap">{c.cap}</span>`.
- `na`: como hoje (texto), sem seta.
- Tirar o `Tip` atual do `GrowthView` (a dica volta como dica por célula na Tarefa 8; até lá, a célula não tem dica, o que é aceitável dentro do lote).
- `canais.css`: `.gr-n { color: var(--text); font-weight: 600 }` e `.gr-flat { color: var(--text-muted) }`, usando os tokens que `canais.css` já usa para texto e texto apagado (ler o arquivo; nunca `color-mix`).

- [ ] **Step 5: Rodar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/canais-a5-crescimento.test.ts test/youtube/observatorio/canais test/youtube/observatorio/proprio-a4-canais.test.ts test/youtube/observatorio/numeros-nao-mudam-e5a.test.ts > $SCRATCH/a5-t4.txt 2>&1; grep -E "FAIL|×" $SCRATCH/a5-t4.txt | head -20`
Expected: PASS, **depois de declarar a exceção de `numeros-nao-mudam-e5a.test.ts` (Step 5b)**. Asserção antiga de `≈ 0`, `kind: 'flat'` com `title`, ou da seta do Crescimento em `canais-lote-rapido-dicas.test.tsx`: trocar pelo texto novo (o arquivo entra no commit).

- [ ] **Step 5b: Exceção de FORMA no retrato `numeros-nao-mudam-e5a`** (nunca de número; nunca regravar `e5a-retrato-antes.json`)

A Tarefa 4 troca a forma de `cells.growth` em todo canal (`up`, `title`, `tip` saem; `antes`, `depois`, `de`, `ate`, `abs`, `pct`, `motivo`, `fechaEm`, `dias` entram; "≈ 0" vira "sem variação"; o canal próprio passa de "sem contagem" a "sem registro"). No teste, comparar `cells.growth` **só pelos campos numéricos** (`pct`, `abs`) e pelo `kind` normalizado (`flat`/`ok`/`na`), com o comentário `// A5 2ª leva T4: forma e texto da célula de Crescimento mudaram (mockup 17); número não`. Declarar a exceção do canal próprio (agora medido pelo MG20) por extenso, como os desvios 13 e 14.

- [ ] **Step 6: Typecheck e commit**

Run: `cd apps/web && npx tsc --noEmit -p . > $SCRATCH/a5-t4-tsc.txt 2>&1; grep -c "error TS" $SCRATCH/a5-t4-tsc.txt`
Expected: `0`.

```bash
git commit -m "feat: canais: Crescimento com + e −, sem variação dentro de 2 passos, e o do seu canal pelos retratos diários" -- "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/view-model.ts" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/cells.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/canais.css" "apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx" apps/web/test/youtube/observatorio/canais-a5-crescimento.test.ts apps/web/test/youtube/observatorio/numeros-nao-mudam-e5a.test.ts
```
(+ `canais-lote-rapido-dicas.test.tsx` se mudou.)

---

### Task 5: Tela da numeração: P com "empate", chevrons, Direção ordenável, linha de ordem, legenda e faixa

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/channel-table.tsx` (`COLS`, `PosCell`, cabeçalho P e Direção, divisor)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/channel-cards.tsx` (canto `cp`)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/canais-screen.tsx` (`.sortnote` → linha de ordem; legenda)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/own-block.tsx` (faixa sem posição)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/canais.css`
- Create: `apps/web/test/youtube/observatorio/canais-a5-tela.test.tsx`
- Modify: `apps/web/test/youtube/observatorio/canais-lote-rapido-dicas.test.tsx` (linha 65: texto da dica do cabeçalho P)

**Interfaces:**
- Consumes: `CanaisRow.numero`, `CanaisView.ordem`, `CanaisView.faixaSemPosicao`, `ORDEM_POSICAO`, `ORDEM_EMPATE` (Tarefas 3 e 3b).
- Produces: `data-testid` estáveis para o e2e: `canais-p` (célula P), `canais-ordem` (linha de ordem), `canais-faixa` (faixa sem posição), `canais-th-<sort>` (cabeçalho ordenável).

Textos à letra desta tarefa:
- Célula P: `{n}º` e, embaixo, `empate` (12 px, apagado) quando `numero.empate`; cartão a 390 px: `{n}º · empate`. Sem número: célula vazia com `aria-label` "sem posição".
- Dica do cabeçalho P (substitui a do lote rápido): `Posição pelo valor da coluna ordenada. 1º é o maior. Canais empatados dividem a posição.`
- Linha de ordem: `Ordenado por <b>{ordem.coluna}</b>, {ordem.sentido}.` + ` Posição: 1º é o maior valor, em qualquer sentido.` + (se `ordem.empate`) ` Empate: mesmo valor na tela, mesma posição.`
- Legenda, ordenação por Direção: `▲ subindo, +10% ou mais` · `＝ sem mudança` · `▼ descendo, −10% ou menos` · `As setas ▲ ▼ valem só para a Direção, que mede views.`
- Legenda, ordenação por Crescimento: `Crescimento mede inscritos e usa + e −. Setas ▲ ▼ ficam para a Direção, que mede views.`
- Cabeçalho Crescimento, dica: `Inscritos que o canal ganhou (+) ou perdeu (−) em 30 dias. O YouTube arredonda os inscritos a 3 algarismos; é diferente da Direção, que mede views.` e, em parágrafo próprio, `<b>Empate:</b> se o ganho ou a perda é menor que 2 passos do arredondamento, a diferença pode ser só arredondamento. Esses canais mostram "sem variação" com o limite de cada canal (±N) e ficam todos na mesma posição, entre quem cresceu e quem perdeu.`
- Cabeçalho Direção, dica: o parágrafo do lote rápido continua; acrescentar `<b>Ordem:</b> o primeiro clique abre com quem mais sobe. Canais sem 56 dias medidos ficam sempre no fim, abaixo de "Sem medida", e nunca valem zero.` e `<b>Empate:</b> o mesmo percentual inteiro mostrado vale a mesma posição, em ordem alfabética; a faixa de ±10% que decide ▲ ＝ ▼ não entra nessa conta.`
- Faixa "Seus canais" nas ordenações sem posição: `<b>{linha1}</b>` (só se houver) + `{linha2}` + botões `Ordenar por Inscritos` e `Ordenar por Views/dia` (links para `obs.link.canais({ ...atual, sort: 'subs' | 'vpd', dir: 'desc' })`). Em Inscritos e Views/dia a faixa continua a de hoje ("Nº de N…" + "Ir até a linha").
- Chevrons: cabeçalho inativo com o ícone duplo ⇅ (SVG, `aria-hidden`); ativo com uma seta só (para baixo = maior primeiro). `aria-sort` no `th` ativo (`descending`/`ascending`). O texto ▼/▲ de hoje sai.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { a3World } from './a3-fixture'
import { buildCanaisView, type CanaisParams } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
// O jeito de montar a tela é o de canais-a3-tela.test.tsx: copiar o helper `montar` de lá (ler o arquivo; ele já envolve os provedores).

describe('tela da numeração', () => {
  it('P mostra 6º e "empate" embaixo; dica do cabeçalho com o texto novo', () => {
    // mundo com dois canais de mesmo Crescimento (ver canais-a5-numeracao.test.ts, describe "empate")
    // …montar com sort: 'growth'
    const p = screen.getAllByTestId('canais-p').find(td => td.textContent?.includes('empate'))!
    expect(p.textContent).toMatch(/^\d+º\s*empate$/)
    expect(screen.getByText('Posição pelo valor da coluna ordenada. 1º é o maior. Canais empatados dividem a posição.', { exact: false })).toBeTruthy()
  })
  it('linha de ordem à letra', () => {
    // …montar com sort: 'growth', dir: 'desc'
    expect(screen.getByTestId('canais-ordem').textContent).toBe('Ordenado por Crescimento, de quem mais ganhou a quem mais perdeu inscritos em 30 dias. Posição: 1º é o maior valor, em qualquer sentido. Empate: mesmo valor na tela, mesma posição.')
  })
  it('Direção é ordenável e o th ativo tem aria-sort', () => {
    // …montar com sort: 'direcao'
    const th = screen.getByTestId('canais-th-direcao')
    expect(th.getAttribute('aria-sort')).toBe('descending')
  })
  it('faixa sem posição com os dois botões', () => {
    // …montar com sort: 'growth' e retratosProprios: new Map() (canal próprio sem Crescimento)
    const f = screen.getByTestId('canais-faixa')
    expect(within(f).getByText('Seu canal ainda não tem Crescimento medido.')).toBeTruthy()
    expect(within(f).getByRole('link', { name: 'Ordenar por Inscritos' })).toBeTruthy()
    expect(within(f).getByRole('link', { name: 'Ordenar por Views/dia' })).toBeTruthy()
  })
  it('legenda da Direção à letra', () => {
    // …montar com sort: 'direcao'
    expect(screen.getByText('As setas ▲ ▼ valem só para a Direção, que mede views.')).toBeTruthy()
  })
})
```

O executor substitui cada `// …montar` pelo helper de `canais-a3-tela.test.tsx` com os parâmetros indicados; o mundo do empate é o mesmo `a3World(ds => …)` de `canais-a5-numeracao.test.ts` (copiar a função `retratos`, sem importar entre arquivos de teste).

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/canais-a5-tela.test.tsx > $SCRATCH/a5-t5.txt 2>&1; grep -E "FAIL|×" $SCRATCH/a5-t5.txt | head`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `channel-table.tsx`: `PosCell` lê `r.numero` (não `r.pos`); `<td data-testid="canais-p" className="pcol">{n}º{empate && <span className="pemp">empate</span>}</td>`; o `sr-only "(empate)"` de hoje sai (o texto visível já diz). Cabeçalho P: largura 64 px, dica com o texto novo (sempre a mesma, em toda ordenação). `COLS`: Direção ganha `sort: 'direcao'`; cada `th` ordenável ganha `data-testid={'canais-th-' + sort}`, `aria-sort` no ativo e o SVG de chevron:
  ```tsx
  const Chevron = ({ estado }: { estado: 'off' | 'desc' | 'asc' }) => (
    <svg className="chev" width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
      {estado !== 'desc' && <path d="M1 5l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />}
      {estado !== 'asc' && <path d="M1 7l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />}
    </svg>
  )
  ```
  Clique no cabeçalho: mesmo `onSort` de hoje (primeiro clique `desc`, de novo inverte). Divisor: `colSpan` igual ao número de colunas de hoje.
- `channel-cards.tsx`: canto `cp` = `{n}º` + (`empate` → ` · empate`), de `r.numero`.
- `canais-screen.tsx`: `.sortnote` vira `<p data-testid="canais-ordem" className="ordl">Ordenado por <b>{v.ordem.coluna}</b>, {v.ordem.sentido}. {ORDEM_POSICAO}{v.ordem.empate ? ' ' + ORDEM_EMPATE : ''}</p>` (o sufixo "; ordenado pelos longos" de "Todos" continua no `fmtCab`). Legenda por ordenação (Direção e Crescimento) com os textos acima, abaixo da linha de ordem.
- `own-block.tsx`: quando `v.faixaSemPosicao`, a faixa (`data-testid="canais-faixa"`) mostra `linha1` em negrito (se houver), `linha2` e os dois links; senão, o que existe hoje.
- `canais.css`: `.pcol { width: 64px }`, `.pemp { display: block; font-size: 12px; color: var(--text-muted) }`, `.chev { margin-left: 4px; vertical-align: middle }`, `.ordl` herda o estilo de `.sortnote`.
- `canais-lote-rapido-dicas.test.tsx:65`: trocar o texto da dica do cabeçalho P pelo novo.

- [ ] **Step 4: Rodar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/canais-a5-tela.test.tsx test/youtube/observatorio/canais > $SCRATCH/a5-t5.txt 2>&1; grep -E "FAIL|×" $SCRATCH/a5-t5.txt | head -20`
Expected: PASS. Teste antigo que procurava "▼"/"▲" de ordenação no cabeçalho de Canais (`canais-view-model.test.ts` usa ▼ também para Direção: só trocar as asserções de **ordenação**) passa a procurar `aria-sort`.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: canais: coluna P com empate, cabeçalhos com chevron, Direção ordenável, linha de ordem e faixa do seu canal" -- "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/channel-table.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/channel-cards.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/canais-screen.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/own-block.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/canais.css" apps/web/test/youtube/observatorio/canais-a5-tela.test.tsx apps/web/test/youtube/observatorio/canais-lote-rapido-dicas.test.tsx
```

---

### Task 6: Componente `CelulaDica`

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/celula-dica.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/celula-dica.css` (importado por `celula-dica.tsx`; **não** toca `canais.css`, para a T6 ficar disjunta das T3..T5 e poder rodar em paralelo)
- Create: `apps/web/test/youtube/observatorio/celula-dica.test.tsx`

**Interfaces:**
- Consumes: `HoverTip` e `useTipShown` de `../_chrome/flut/flut` (o mesmo par que o `Tip` de `cells.tsx` usa: `<HoverTip show anchor={() => el.current} id className pref align maxW>`).
- Produces:
  ```tsx
  export const CELULA_DICA_CLASSE = 'cdica'
  /** hov, foc, toque, Esc, shown: a mesma máquina de estado do `Tip` (Yannis M1). A T8 troca o corpo do `Tip` de cells.tsx por este hook. */
  export function useDica(): { show: boolean; shown: boolean; aberta: boolean; handlers: { onMouseEnter(): void; onMouseLeave(): void; onFocus(): void; onBlur(): void; onKeyDown(e: React.KeyboardEvent): void }; abrirPorToque(): void; fechar(): void }
  export function CelulaDica(props: { texto: string; children: React.ReactNode; className?: string }): JSX.Element
  ```
  Gatilho: `<span className="cdica" role="button" tabIndex={0} aria-describedby={id}>`; caixa: `role="tooltip"`, `id` de `useId()`.

Comportamento (mockup 17): abre no hover e no foco; Esc fecha; toque abre, toque fora ou em outra dica fecha; a célula inteira (a parte de valor) é o gatilho, com sublinhado pontilhado e fundo suave quando aberta; nunca `title` nativo; a caixa cabe na janela (a 390 px também).

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CelulaDica } from '@/app/cms/(authed)/youtube/competitors/_canais/celula-dica'

// O jsdom do projeto (25.0.1) NÃO tem PointerEvent: sem isto o React recebe `e.pointerType === undefined` e o ramo de toque nunca roda (Yannis I3).
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    class PE extends MouseEvent { pointerType: string; constructor(t: string, i: PointerEventInit = {}) { super(t, i); this.pointerType = i.pointerType ?? 'mouse' } }
    Object.defineProperty(window, 'PointerEvent', { value: PE, configurable: true })
  }
})

const dica = (t: string, v: string) => <CelulaDica texto={t}><b>{v}</b></CelulaDica>

describe('CelulaDica', () => {
  it('foco abre, Esc fecha; caixa com role tooltip ligada por aria-describedby', () => {
    render(dica('Explicação A', '12'))
    const g = screen.getByRole('button', { name: /12/ })
    fireEvent.focus(g)
    const box = screen.getByRole('tooltip')
    expect(box.textContent).toBe('Explicação A')
    expect(g.getAttribute('aria-describedby')).toBe(box.id)
    fireEvent.keyDown(g, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
  it('toque abre; toque em outra dica fecha a primeira', () => {
    render(<>{dica('A', '1')}{dica('B', '2')}</>)
    fireEvent.pointerDown(screen.getByRole('button', { name: /1/ }), { pointerType: 'touch' })
    expect(screen.getByRole('tooltip').textContent).toBe('A')
    fireEvent.pointerDown(screen.getByRole('button', { name: /2/ }), { pointerType: 'touch' })
    expect(screen.getAllByRole('tooltip').map(t => t.textContent)).toEqual(['B'])
  })
  it('toque fora fecha', () => {
    render(<div><p>fora</p>{dica('A', '1')}</div>)
    fireEvent.pointerDown(screen.getByRole('button', { name: /1/ }), { pointerType: 'touch' })
    fireEvent.pointerDown(screen.getByText('fora'), { pointerType: 'touch' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
  it('nunca title nativo', () => {
    const { container } = render(dica('A', '1'))
    expect(container.querySelector('[title]')).toBeNull()
  })
  // Mutantes que sobreviviam (Yannis M1): hover e foco são separados
  it('mouseEnter abre e mouseLeave fecha', () => {
    render(dica('A', '1'))
    const g = screen.getByRole('button', { name: /1/ })
    fireEvent.mouseEnter(g)
    expect(screen.getByRole('tooltip')).toBeTruthy()
    fireEvent.mouseLeave(g)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
  it('aberta por foco, continua aberta depois de mouseLeave', () => {
    render(dica('A', '1'))
    const g = screen.getByRole('button', { name: /1/ })
    fireEvent.focus(g); fireEvent.mouseEnter(g); fireEvent.mouseLeave(g)
    expect(screen.getByRole('tooltip')).toBeTruthy()
  })
  it('com um popover aberto, sem role="tooltip" e sem aria-describedby (useTipShown)', () => {
    // abrir um <Popover> do _chrome/flut (helper de flut.test, se houver) e focar a célula: a caixa não existe e o gatilho não aponta para ela
  })
  it('clique no gatilho não é engolido (sem stopPropagation): um ouvinte no document ainda o vê', () => {
    let visto = false
    const h = () => { visto = true }
    document.addEventListener('click', h)
    render(dica('A', '1'))
    fireEvent.click(screen.getByRole('button', { name: /1/ }))
    document.removeEventListener('click', h)
    expect(visto).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/celula-dica.test.tsx > $SCRATCH/a5-t6.txt 2>&1; grep -E "FAIL|×" $SCRATCH/a5-t6.txt | head`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

```tsx
'use client'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { HoverTip, useTipShown } from '../_chrome/flut/flut'
import './celula-dica.css'

export const CELULA_DICA_CLASSE = 'cdica'
const FECHAR_OUTRAS = 'canais:cdica-abriu'

/** A mesma máquina do `Tip` de cells.tsx (hov e foc separados; Esc fecha e mantém o foco; `shown` = a caixa está de fato no documento). */
export function useDica() {
  const [hov, setHov] = useState(false), [foc, setFoc] = useState(false), [toque, setToque] = useState(false)
  const show = hov || foc || toque
  const shown = useTipShown(show)
  return {
    show, shown, aberta: show,
    handlers: {
      onMouseEnter: () => setHov(true), onMouseLeave: () => setHov(false), onFocus: () => setFoc(true), onBlur: () => setFoc(false),
      onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Escape' && show) { e.stopPropagation(); setHov(false); setFoc(false); setToque(false) } },
    },
    abrirPorToque: () => setToque(t => !t),
    fechar: () => { setHov(false); setFoc(false); setToque(false) },
  }
}

/** A5 2ª leva: a dica de uma célula da lista. Hover e foco abrem, Esc fecha, toque alterna; toque fora ou noutra dica fecha. Sem title nativo. */
export function CelulaDica({ texto, children, className }: { texto: string; children: ReactNode; className?: string }) {
  const id = useId()
  const ref = useRef<HTMLSpanElement>(null)
  const d = useDica()
  // Yannis M2: os ouvintes globais só existem enquanto ESTA dica está aberta (O(1) por evento, não O(linhas × colunas)).
  useEffect(() => {
    if (!d.aberta) return
    const outra = (e: Event) => { if ((e as CustomEvent<string>).detail !== id) d.fechar() }
    const fora = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) d.fechar() }
    window.addEventListener(FECHAR_OUTRAS, outra)
    document.addEventListener('pointerdown', fora)
    return () => { window.removeEventListener(FECHAR_OUTRAS, outra); document.removeEventListener('pointerdown', fora) }
  }, [d.aberta, id]) // eslint-disable-line react-hooks/exhaustive-deps -- `d.fechar` é estável em comportamento
  const avisar = () => window.dispatchEvent(new CustomEvent(FECHAR_OUTRAS, { detail: id }))
  return (
    <span
      ref={ref} role="button" tabIndex={0} aria-describedby={d.shown ? id : undefined}
      className={`${CELULA_DICA_CLASSE}${d.aberta ? ' on' : ''}${className ? ' ' + className : ''}`}
      {...d.handlers}
      onMouseEnter={() => { avisar(); d.handlers.onMouseEnter() }}
      onFocus={() => { avisar(); d.handlers.onFocus() }}
      // Toque: alterna. Sem stopPropagation (Yannis M3): o painel do canal não abre porque a LINHA exclui `.cdica` do seu clique (Tarefa 8, testado), e o `stopPropagation` do React 19 esconderia o clique de ouvintes de document (menu "Mais ações", popover).
      onPointerDown={e => { if (e.pointerType === 'touch') { if (!d.aberta) avisar(); d.abrirPorToque() } }}
    >
      {children}
      <HoverTip show={d.show} anchor={() => ref.current} id={id} className="cn-tt" pref="baixo" align="meio" maxW={270}>{texto}</HoverTip>
    </span>
  )
}
```

Conferir as props reais do `HoverTip` (âncora como função `() => el`, `id`, posicionamento que cabe na janela; a 390 px também). Se `HoverTip` não desenhar `role="tooltip"` com o `id`, envolver o texto em `<span role="tooltip" id={id}>` dentro dele. O teste pede `aria-describedby` igual ao `id` da caixa **quando aberta**.

`celula-dica.css` (arquivo novo desta tarefa):
```css
.cdica { cursor: help; text-decoration: underline dotted; text-underline-offset: 3px; border-radius: 4px; outline-offset: 2px }
.cdica.on { background: var(--surface-2) }
```
(usar o token de fundo suave que `canais.css` já usa; nunca `color-mix`.) Se o projeto não importa CSS de dentro de componente client nesta pasta, importar `celula-dica.css` no mesmo ponto onde `canais.css` é importado, **sem** editar `canais.css`.

- [ ] **Step 4: Rodar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/celula-dica.test.tsx > $SCRATCH/a5-t6.txt 2>&1; grep -E "FAIL|×|✓" $SCRATCH/a5-t6.txt | head`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: canais: componente de dica por célula (hover, foco, toque, Esc)" -- "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/celula-dica.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/celula-dica.css" apps/web/test/youtube/observatorio/celula-dica.test.tsx
```

---

### Task 7: Textos das dicas (`dicas-model.ts`, puro)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/dicas-model.ts`
- Create: `apps/web/test/youtube/observatorio/canais-a5-dicas-model.test.ts`

**Interfaces:**
- Consumes: nada do motor (só tipos simples); formatação vem por parâmetro.
- Produces (todas puras, `string` de saída):
  ```ts
  export interface Escrita { num: (n: number) => string; dec1: (n: number) => string; dm: (ms: number) => string; agora: number /* ms; Phil M5: fechaEm no passado => frase sem a data */ }
  export function dicaInscritos(f: { subs: number | null; passo: number }, e: Escrita): string
  export function dicaViewsDia(f: { mediana: number | null; n: number; desde: string; porMil: number | null; oculto: boolean; fraco: boolean; formato: 'long' | 'short' }, e: Escrita): string | null
  export function dicaRitmo(f: { longos: number; shorts: number; ultimoHaDias: number | null; partialText: string | null /* Phil M6: `cadence().partialText` quando `partial` (subconta) */ }): string
  export function dicaOutliers(f: { melhor: { titulo: string; mult: number; views: number; esperado: number } | null; nVideos: number; fraco: boolean; formato: 'long' | 'short' }, e: Escrita): string
  export function dicaTrocas(f: { ultima: { tipo: 'title' | 'thumb' | 'ambos'; titulo: string; haDias: number; em: number } | null }, e: Escrita): string
  export function dicaSync(f: { estado: 'ok' | 'erro'; ha: string; nVideos: number; horarios: readonly string[]; proprio: string | null }): string
  export function dicaCrescimento(g: GrowthCell, e: Escrita, proprio: boolean): string
  export function dicaDirecao(d: CelulaDeDirecao, numeros: { recente: string; anterior: string } | null, e: Escrita): string | null
  ```
  `GrowthCell` vem de `view-model.ts` (Tarefa 4, `import type`), `CelulaDeDirecao` de `direcao-model.ts` (com `fechaEm` da Tarefa 2; `n` repassado: se `CelulaDeDirecao` `nao_medido` não tiver `n`, acrescentar `n?: number` no tipo e no repasse de `direcao-model.ts:44`, e esse arquivo entra na lista desta tarefa).

Textos à letra (REVISAO-LOGAN-R3.md, com os desvios declarados acima):

| Dica | Caso | Texto |
|---|---|---|
| Inscritos | ≥ mil | `{N} inscritos pelo YouTube, que corta para 3 algarismos: o número real fica entre {N} e {N + passo − 1}.` TEXTO-A-REVISAR (Logan; conserto do Phil I5: o YouTube corta para baixo, o "até m acima ou abaixo" do mockup dizia o contrário e metade da margem) |
| Inscritos | < mil | `{N} inscritos. Abaixo de mil, o YouTube mostra o número exato.` TEXTO-A-REVISAR |
| Inscritos | oculto | `O canal esconde o número de inscritos; não há o que mostrar.` |
| Views/dia | medido | `{V} views por dia, a mediana dos {N} vídeos longos acompanhados, {desde}. Por mil inscritos: {Z} views por dia.` (Z < 0,1 → `menos de 0,1`; oculto → `Inscritos ocultos: sem proporção por mil.` no lugar da 2ª frase; fraco → + ` Poucos vídeos: leia com cautela.`; Shorts troca `vídeos longos` por `Shorts`) TEXTO-A-REVISAR na troca de "dos últimos 90 dias" |
| Ritmo | — | `Em 13 semanas: {L} vídeos longos e {S} Shorts. Último vídeo há {X} dias.` (L ou S = 1 → `1 vídeo longo` / `1 Short`; X = 0 → `Último vídeo hoje.`; X = 1 → `há 1 dia`; sem vídeo → sem a 2ª frase). Com `cadence().partial`: + ` {partialText}` (Phil M6; `cadence()` conta só os vídeos buscados e a frase subconta) |
| Outliers | com vídeo | `“{T}”: {M}× as views típicas do canal ({V} contra {E}).` TEXTO-A-REVISAR (sugerir "na mesma idade") |
| Outliers | nenhum | `Nenhum vídeo dos últimos 90 dias passou de 2× as views típicas do canal.` |
| Outliers | fraco | `Só {N} vídeos longos: ainda não dá para saber o que é típico deste canal.` (Shorts: `Só {N} Shorts: …`) |
| Trocas | nenhuma | `Nenhuma troca de título ou thumbnail nos últimos 30 dias.` |
| Trocas | com troca | `Mudou {o título / a thumbnail / o título e a thumbnail} de “{T}”, há {N} dias ({DD/MM}).` (N = 0 → `hoje ({DD/MM})`; N = 1 → `há 1 dia`) |
| Sync | ok | `Última sincronização {ha}, com {N} vídeos acompanhados. Automática às {00h, 06h, 12h e 18h} (São Paulo).` (`ha` já começa com "há") |
| Sync | erro | `A tentativa de {ha} não completou. Seguimos com os dados de antes ({N} vídeos) e tentamos de novo na próxima sincronização.` (sem `errorSince` → `A última tentativa não completou. …`) |
| Sync | canal próprio | 1ª frase igual a "ok"; a 2ª é o texto de `proprio` (o `ownTexts().sync` de hoje: `Seu canal não entra nesta rodada; ele sincroniza pelo Painel.`) |
| Crescimento | ok | `De {X} inscritos em {DD/MM} para {Y} em {DD/MM}: {G} ({P}%).` + ` Inscritos arredondados a 3 algarismos pelo YouTube.` (G e P com sinal, − U+2212; **a dica escreve o intervalo real**, Phil I3: a janela é de 29 a 33 dias, nunca 31 a 90 rotulada "30"). Com `atrasadoAte`: + ` Último retrato em {DD/MM}: a coleta está parada.` (Phil I4) |
| Crescimento | sem variação | `De {X} inscritos em {DD/MM} para {Y} em {DD/MM} ({G}). Dentro do arredondamento do YouTube (passo de {N}): pode ser só isso.` (G = `0` quando zero; com `atrasadoAte`, + a frase do retrato parado). Abaixo de mil (`limite` 0): `De {X} inscritos em {DD/MM} para {Y} em {DD/MM}: o mesmo número nas duas contagens.` TEXTO-A-REVISAR (Logan) |
| Crescimento | próprio sem registro | `Seu canal ainda não tem a coleta de inscritos ligada. Passa a medir 30 dias depois de ligada.` |
| Crescimento | oculto | `O canal esconde os inscritos: não há o que comparar. Sem data prevista; só muda se ele mostrar.` |
| Crescimento | novo | `Só {N} dias de registro; a medida pede 30. A janela fecha em {DD/MM}.` Se `fechaEm < agora` (coleta parada: a data sai do último retrato, não de hoje; Phil M5): `Só {N} dias de registro; a medida pede 30.` sem a data |
| Crescimento | concorrente sem registro (`motivo: 'sem-registro'`, `proprio: false`; Yannis M7) | o `title` da célula: `Sem registro de inscritos ainda.` |
| Crescimento | buraco | o `title` da célula (`buraco na contagem`) |
| Crescimento | não carregou / sem percentual | o `title` da célula |
| Direção | subiu | `Últimos 28 dias: {R} views. 28 dias anteriores: {A}. Subiu {P}%.` |
| Direção | caiu | `… Caiu {P}%.` (P sem sinal) |
| Direção | sem mudança | `… Variou {+P / −P}%: dentro de ±10%, conta como sem mudança.` TEXTO-A-REVISAR (o Logan escreveu "±P") |
| Direção | canal próprio | `Seu canal ainda não tem Direção medida. Sem data prevista.` TEXTO-A-REVISAR |
| Direção | pouco registro | `Só {n} dias de registro; a medida pede 56 (28 contra 28). A janela fecha em {DD/MM}.` (Phil M3: `n` conta dias de registro do canal, não de vídeos; `fechaEm` é "a partir de", Tarefa 2) |
| Direção | outro não medido | `d.longa` (o texto que a célula já tem) |
| Direção | não carregou | `null` (a célula de hoje já explica; sem dica) |

- [ ] **Step 1: Escrever o teste que falha** (uma asserção à letra por linha da tabela; trecho representativo, o executor completa as linhas restantes da tabela no mesmo formato)

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { dicaInscritos, dicaViewsDia, dicaRitmo, dicaOutliers, dicaTrocas, dicaSync, dicaCrescimento, dicaDirecao, type Escrita } from '@/app/cms/(authed)/youtube/competitors/_canais/dicas-model'

const e: Escrita = {
  num: n => n.toLocaleString('pt-BR'),
  dec1: n => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  dm: ms => new Date(ms).toISOString().slice(8, 10) + '/' + new Date(ms).toISOString().slice(5, 7),
  agora: Date.UTC(2026, 9, 14, 15),
}

describe('dicas à letra', () => {
  it('Inscritos', () => {
    expect(dicaInscritos({ subs: 1_230_000, passo: 10_000 }, e)).toBe('1.230.000 inscritos pelo YouTube, que corta para 3 algarismos: o número real fica entre 1.230.000 e 1.239.999.')
    expect(dicaInscritos({ subs: null, passo: 0 }, e)).toBe('O canal esconde o número de inscritos; não há o que mostrar.')
    expect(dicaInscritos({ subs: 812, passo: 0 }, e)).toBe('812 inscritos. Abaixo de mil, o YouTube mostra o número exato.')
  })
  it('Views/dia', () => {
    expect(dicaViewsDia({ mediana: 1200, n: 14, desde: 'desde 01/08', porMil: 0.05, oculto: false, fraco: false, formato: 'long' }, e))
      .toBe('1.200 views por dia, a mediana dos 14 vídeos longos acompanhados, desde 01/08. Por mil inscritos: menos de 0,1 views por dia.')
    expect(dicaViewsDia({ mediana: 300, n: 2, desde: 'desde 01/08', porMil: null, oculto: true, fraco: true, formato: 'short' }, e))
      .toBe('300 views por dia, a mediana dos 2 Shorts acompanhados, desde 01/08. Inscritos ocultos: sem proporção por mil. Poucos vídeos: leia com cautela.')
  })
  it('Ritmo', () => {
    expect(dicaRitmo({ longos: 6, shorts: 1, ultimoHaDias: 3, partialText: null })).toBe('Em 13 semanas: 6 vídeos longos e 1 Short. Último vídeo há 3 dias.')
    expect(dicaRitmo({ longos: 1, shorts: 0, ultimoHaDias: 0, partialText: null })).toBe('Em 13 semanas: 1 vídeo longo e 0 Shorts. Último vídeo hoje.')
    expect(dicaRitmo({ longos: 6, shorts: 1, ultimoHaDias: 3, partialText: 'ritmo parcial: só os 40 vídeos mais recentes foram buscados' })).toBe('Em 13 semanas: 6 vídeos longos e 1 Short. Último vídeo há 3 dias. ritmo parcial: só os 40 vídeos mais recentes foram buscados')
  })
  it('Outliers', () => {
    expect(dicaOutliers({ melhor: { titulo: 'Vídeo X', mult: 3.4, views: 34_000, esperado: 10_000 }, nVideos: 9, fraco: false, formato: 'long' }, e))
      .toBe('“Vídeo X”: 3,4× as views típicas do canal (34.000 contra 10.000).')
    expect(dicaOutliers({ melhor: null, nVideos: 2, fraco: true, formato: 'long' }, e)).toBe('Só 2 vídeos longos: ainda não dá para saber o que é típico deste canal.')
  })
  it('Trocas', () => {
    expect(dicaTrocas({ ultima: null }, e)).toBe('Nenhuma troca de título ou thumbnail nos últimos 30 dias.')
    expect(dicaTrocas({ ultima: { tipo: 'ambos', titulo: 'Vídeo Y', haDias: 4, em: Date.UTC(2026, 9, 10, 15) } }, e)).toBe('Mudou o título e a thumbnail de “Vídeo Y”, há 4 dias (10/10).')
  })
  it('Sync', () => {
    expect(dicaSync({ estado: 'ok', ha: 'há 2 h', nVideos: 40, horarios: ['00h', '06h', '12h', '18h'], proprio: null }))
      .toBe('Última sincronização há 2 h, com 40 vídeos acompanhados. Automática às 00h, 06h, 12h e 18h (São Paulo).')
    expect(dicaSync({ estado: 'erro', ha: 'há 5 h', nVideos: 40, horarios: [], proprio: null }))
      .toBe('A tentativa de há 5 h não completou. Seguimos com os dados de antes (40 vídeos) e tentamos de novo na próxima sincronização.')
  })
  it('Crescimento', () => {
    const de = Date.UTC(2026, 8, 12, 15), ate = Date.UTC(2026, 9, 12, 15) // 12/09 → 12/10
    expect(dicaCrescimento({ kind: 'ok', big: '+1,7%', cap: '', antes: 1_200_000, depois: 1_220_000, de, ate, atrasadoAte: null, abs: 20_000, pct: 20_000 / 1_200_000 }, e, false))
      .toBe('De 1.200.000 inscritos em 12/09 para 1.220.000 em 12/10: +20.000 (+1,7%). Inscritos arredondados a 3 algarismos pelo YouTube.')
    expect(dicaCrescimento({ kind: 'flat', big: 'sem variação', cap: '', limite: 20_000, antes: 1_200_000, depois: 1_210_000, de, ate, atrasadoAte: null, abs: 10_000, passo: 10_000 }, e, false))
      .toBe('De 1.200.000 inscritos em 12/09 para 1.210.000 em 12/10 (+10.000). Dentro do arredondamento do YouTube (passo de 10.000): pode ser só isso.')
    expect(dicaCrescimento({ kind: 'flat', big: 'sem variação', cap: '', limite: 0, antes: 800, depois: 800, de, ate, atrasadoAte: null, abs: 0, passo: 1 }, e, false))
      .toBe('De 800 inscritos em 12/09 para 800 em 12/10: o mesmo número nas duas contagens.')
    expect(dicaCrescimento({ kind: 'ok', big: '+4,0%', cap: '', antes: 50_000, depois: 52_000, de, ate, atrasadoAte: Date.UTC(2026, 9, 8, 15), abs: 2000, pct: 0.04 }, e, true))
      .toContain('Último retrato em 08/10: a coleta está parada.')
    expect(dicaCrescimento({ kind: 'na', text: '', title: '', motivo: 'sem-registro', fechaEm: null, dias: null }, e, true))
      .toBe('Seu canal ainda não tem a coleta de inscritos ligada. Passa a medir 30 dias depois de ligada.')
    expect(dicaCrescimento({ kind: 'na', text: '', title: '', motivo: 'novo', fechaEm: Date.UTC(2026, 10, 2, 15), dias: 12 }, e, false))
      .toBe('Só 12 dias de registro; a medida pede 30. A janela fecha em 02/11.')
    expect(dicaCrescimento({ kind: 'na', text: '', title: '', motivo: 'novo', fechaEm: Date.UTC(2026, 9, 1, 15), dias: 12 }, e, false)) // fechaEm no passado: coleta parada
      .toBe('Só 12 dias de registro; a medida pede 30.')
    expect(dicaCrescimento({ kind: 'na', text: '', title: 'Sem registro de inscritos ainda.', motivo: 'sem-registro', fechaEm: null, dias: null }, e, false)) // concorrente (Yannis M7)
      .toBe('Sem registro de inscritos ainda.')
  })
  it('Direção', () => {
    const med = { tipo: 'medido', pct: 18, simbolo: 'sobe', texto: '', ganhoRecente: 0, ganhoAnterior: 0, foraDaEscala: null, fracao: 0, avisoDeContagem: null } as const
    expect(dicaDirecao(med as never, { recente: '118 mil', anterior: '100 mil' }, e)).toBe('Últimos 28 dias: 118 mil views. 28 dias anteriores: 100 mil. Subiu 18%.')
    expect(dicaDirecao({ tipo: 'canal_proprio', curta: '', longa: '' }, null, e)).toBe('Seu canal ainda não tem Direção medida. Sem data prevista.')
    expect(dicaDirecao({ tipo: 'nao_medido', motivo: 'pouco_registro', n: 20, fechaEm: '2026-11-15', curta: '', longa: '' } as never, null, e)).toBe('Só 20 dias de registro; a medida pede 56 (28 contra 28). A janela fecha em 15/11.')
  })
})
```

O `simbolo` do caso medido usa o valor real de `SimboloDeDirecao` (ler `direcao-model.ts`); trocar `'sobe'` pelo literal certo e tirar o `as never`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/canais-a5-dicas-model.test.ts > $SCRATCH/a5-t7.txt 2>&1; grep -E "FAIL|×" $SCRATCH/a5-t7.txt | head`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar** as funções da tabela, uma por coluna, em `dicas-model.ts`, sem importar nada do motor além de tipos. Sinal de menos: `const sinal = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '')`. Cabeçalho do arquivo: `// A5 2ª leva: os textos das dicas por célula (REVISAO-LOGAN-R3.md, mockup 17). Puro.` Cada texto marcado TEXTO-A-REVISAR na tabela leva o comentário `// TEXTO-A-REVISAR (Logan): <motivo>` na linha.

- [ ] **Step 4: Rodar**

Run: o mesmo do Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: canais: textos das dicas por célula (modelo puro)" -- "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/dicas-model.ts" apps/web/test/youtube/observatorio/canais-a5-dicas-model.test.ts
```
(+ `direcao-model.ts` se precisou repassar `n`.)

---

### Task 8: Dicas nas células da tabela e dos cartões

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/view-model.ts` (campo `dicas` em `CanaisRow`, montado em `rowOf`)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/cells.tsx` (`VpdView`, `OutView`, `SwapView`, `SyncView`, `Cadence`, `GrowthView`: `title` nativo sai, `CelulaDica` entra só na parte de valor)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/channel-table.tsx` (Inscritos, Direção; exclusão do clique da linha)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/channel-cards.tsx` (mesmas dicas)
- Delete: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/direcao-dica.tsx`
- Create: `apps/web/test/youtube/observatorio/canais-a5-dicas-tela.test.tsx`
- Modify: `apps/web/test/youtube/observatorio/canais-lote-rapido-dicas.test.tsx` (as asserções da dica de Direção/Inscritos do lote rápido passam a usar o texto novo)
- Modify: `apps/web/test/youtube/observatorio/numeros-nao-mudam-e5a.test.ts` (a Tarefa 8 mexe em `title` das células, que o retrato grava em `cells`: exceção declarada **de forma**, nunca de número)

**Interfaces:**
- Consumes: as funções de `dicas-model.ts` (Tarefa 7), `CelulaDica` e `CELULA_DICA_CLASSE` (Tarefa 6).
- Produces:
  ```ts
  // CanaisRow
  dicas: {
    subs: string; vpd: string | null; cadence: string; out: string; swap: string | null; growth: string; direcao: string | null; sync: string
    vpd2?: string | null; cadence2?: string; out2?: string
  }
  ```
  (`swap` nulo no canal próprio, que não tem trocas aqui; `direcao` nulo em "não carregou".)

De onde cada campo sai em `rowOf` (tudo já carregado): `subs` ← `c.subs`, `passoDoYouTube(c.subs)`; `vpd` ← `S.vpdMedian`, `S.vpdN`, `S.vpdWindow`, `S.perMilSubs`, `S.vpdN < R.weakBase`; canal próprio ← o que `vpdOf` já usa dos extras (`o.ev.n`, janela); `cadence` ← `obs.cadence(c.id,'long').n`, `obs.cadence(c.id,'short').n`, `lastUpload` → `Math.floor((obs.NOW - lastUpload) / DAY)`; `out` ← `S.bestOutlier` (`title`, `mult.value`, `Math.round(mult.value * mult.base)`, `mult.base`), `S.vpdN`, fraco = `S.vpdN < R.weakBase`; `swap` ← `trocasDe30(obs, c.id)` (o mais recente; `ambos` quando há troca do outro tipo no mesmo vídeo no mesmo dia SP); `sync` ← `agoN(s.last)` ou `agoN(s.errorSince)`, `S.tracked`, `obs.SYNC.slots` escritos `HHh`, `ownTexts().sync` no canal próprio; `growth` ← `dicaCrescimento(cells.growth, …, c.own)`; `direcao` ← `dicaDirecao(r.direcao, r.direcaoNumeros, …)`. Estados sem texto na tabela da Tarefa 7 (atrasado, buscando vídeos, sem Shorts, sem vídeos): a dica é o `title`/`labelTitle` que a célula tem hoje. **Reusar o `trocas` que `rowOf` já calcula** (Yannis, complexidade): não chamar `trocasDe30` de novo para a dica. `cadence` passa `partialText` (Phil M6) quando `cadence().partial`.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
// montar a tabela com o helper de canais-a3-tela.test.tsx (copiar), mundo a3World()

// O jsdom do projeto não tem PointerEvent (Yannis I3): o mesmo bloco beforeAll de celula-dica.test.tsx, aqui também.
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    class PE extends MouseEvent { pointerType: string; constructor(t: string, i: PointerEventInit = {}) { super(t, i); this.pointerType = i.pointerType ?? 'mouse' } }
    Object.defineProperty(window, 'PointerEvent', { value: PE, configurable: true })
  }
})

describe('dicas por célula na tela', () => {
  it('nenhum title nativo nas células de VALOR da lista', () => {
    // …montar tabela
    // Escopo = células de valor (Yannis I5): fora ficam o nome truncado (title={r.name}), abbr.langtag, botão desabilitado e o botão de ordenar "Canal".
    expect(document.querySelectorAll('td[data-col] [title]').length).toBe(0)
  })
  it('toda coluna de valor tem um gatilho de dica na linha de um CONCORRENTE', () => {
    // …montar tabela; escolher a linha pelo id de um concorrente (a 1ª linha pode ser o canal próprio, que não tem Trocas: 7 gatilhos)
    const linha = document.querySelector(`tbody tr[data-id="${idDeUmConcorrente}"]`)!
    expect(linha.querySelectorAll('.cdica').length).toBeGreaterThanOrEqual(8)
  })
  it('tocar a dica não abre o painel do canal (a LINHA exclui .cdica; é o único mecanismo)', () => {
    const onOpen = vi.fn()
    // …montar tabela passando onOpen como o abridor do painel (o mesmo prop que canais-a3-tela usa)
    const g = document.querySelector('tbody tr .cdica') as HTMLElement
    fireEvent.pointerDown(g, { pointerType: 'touch' }); fireEvent.click(g)
    expect(onOpen).not.toHaveBeenCalled()
    expect(screen.getByRole('tooltip')).toBeTruthy()
  })
  it('"Tentar de novo" fica fora do gatilho e chama o onRetry', () => {
    const onRetry = vi.fn()
    // …montar com um mundo em que um concorrente tem sync.state = 'erro' (mutador do a3World), passando onRetry
    const tentar = screen.getByRole('button', { name: 'Tentar de novo' }) // sem `if`: a asserção não pode ser opcional
    expect(tentar.closest('.cdica')).toBeNull()
    fireEvent.click(tentar)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
  it('"Todos": uma dica por linha de formato', () => {
    // …montar com fmt: 'todos', num canal com longos e Shorts
    const td = document.querySelector('tbody tr td[data-col="vpd"]')!
    expect(td.querySelectorAll('.cdica').length).toBe(2)
  })
})
```

Se as células não tiverem `data-col`, acrescentar `data-col={sort}` nos `td` de valor em `channel-table.tsx` (está na lista).

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/canais-a5-dicas-tela.test.tsx > $SCRATCH/a5-t8.txt 2>&1; grep -E "FAIL|×" $SCRATCH/a5-t8.txt | head`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `view-model.ts`: montar `dicas` em `rowOf` pela lista acima, com `const escrita: Escrita = { num: F.num, dec1: F.dec1, dm: D.dm }` (conferir que `F.num` escreve "1.230.000"; se escrever "1,23 mi", usar o formatador inteiro que `subsTxt` usa para o número cheio).
- `cells.tsx`: cada `*View` recebe `dica?: string | null`; quando há, envolve **só** o valor (número, rótulo e legenda) em `<CelulaDica texto={dica}>`; botões e links ficam fora. Apagar os `title=` **de valor** das células (nome truncado, `abbr.langtag`, botão desabilitado e botão de ordenar "Canal" ficam, ver D4). `GrowthView` ganha a dica. **O `Tip` de `cells.tsx` passa a usar o `useDica()` da Tarefa 6** (Yannis M1: uma máquina de hover/foco/Esc só, sem dois componentes de dica divergentes).
- `channel-table.tsx`: Inscritos e Direção usam `CelulaDica` com `r.dicas.subs` / `r.dicas.direcao`; o `Tip` de Inscritos e o `DirecaoDica` saem. No `onClick` da linha, o seletor de exclusão vira `` `select,button,a,.tip,.${CELULA_DICA_CLASSE}` `` (**único** mecanismo de "clique na dica não abre o painel"; a `CelulaDica` não usa `stopPropagation`, Yannis M3). Acrescentar `data-col={sort}` e `data-id={r.id}` nos `td`/`tr` se não houver.
- `channel-cards.tsx`: as mesmas dicas nos rótulos de valor do cartão.
- Apagar `direcao-dica.tsx` (`git rm`) e os imports dele.

- [ ] **Step 4: Rodar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/canais-a5-dicas-tela.test.tsx test/youtube/observatorio/canais test/youtube/observatorio/numeros-nao-mudam-e5a.test.ts > $SCRATCH/a5-t8.txt 2>&1; grep -E "FAIL|×" $SCRATCH/a5-t8.txt | head -20`
Expected: PASS, **depois de declarar a exceção de forma em `numeros-nao-mudam-e5a.test.ts`** (os `title` das células saem de `cells`; comparar só os números, com o comentário `// A5 2ª leva T8: title das células virou dica (mockup 17); número não`; nunca regravar `e5a-retrato-antes.json`). Asserção antiga que lia `title` de célula (`canais-screen.test.tsx`, `canais-lote-rapido-dicas.test.tsx`) passa a abrir a dica (foco) e ler o `role="tooltip"`.

- [ ] **Step 5: Typecheck e commit**

Run: `cd apps/web && npx tsc --noEmit -p . > $SCRATCH/a5-t8-tsc.txt 2>&1; grep -c "error TS" $SCRATCH/a5-t8-tsc.txt`
Expected: `0`.

```bash
git rm -q --cached "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/direcao-dica.tsx" 2>/dev/null; rm -f "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/direcao-dica.tsx"
git commit -m "feat: canais: dica por célula em todas as colunas da tabela e dos cartões" -- "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/view-model.ts" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/cells.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/channel-table.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/channel-cards.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/direcao-dica.tsx" apps/web/test/youtube/observatorio/canais-a5-dicas-tela.test.tsx apps/web/test/youtube/observatorio/canais-lote-rapido-dicas.test.tsx apps/web/test/youtube/observatorio/numeros-nao-mudam-e5a.test.ts
```
(+ `canais-screen.test.tsx` se mudou.)

---

### Task 9: Barra de ordenação fixa no celular

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/canais-screen.tsx` (remove o `<select name="cardSort">` da linha de ferramentas e põe a barra como **irmã imediata da lista de cartões**, no mesmo contêiner que envolve a lista)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/canais.css`
- Create: `apps/web/test/youtube/observatorio/canais-a5-sortbar.test.tsx`

**Interfaces:**
- Consumes: `onSort` de hoje (primeiro clique `desc`, de novo inverte), `CanaisSort` com `'direcao'`, `SORTNAME`.
- Produces: `<div role="group" aria-label="Ordenar canais" className="sortbar" data-testid="canais-sortbar">` com um `button` por ordenação, `aria-pressed` no ativo. (`role="toolbar"` pede setas de teclado pelo padrão ARIA; sem elas, `role="group"` com o mesmo `aria-label`. Naksu decide na revisão do implementado.)

**Onde mora (Yannis I4):** `position: sticky` só gruda dentro do bloco do pai. O `<select name="cardSort">` hoje mora dentro do `<label className="cardsort">`, filho da linha de ferramentas (`canais-screen.tsx` ~484), que termina logo depois: com a barra nesse lugar ela sairia da tela junto com a linha de ferramentas ao rolar. Por isso a barra é **irmã imediata da lista de cartões**, dentro do mesmo contêiner que a envolve. E a tela já tem barra de topo grudada (`--obs-topbar-h: 48px` abaixo de 768 px; os outros grudados da observatória usam `top: var(--obs-top)`): `top: 0` a esconderia por baixo dela.

Mockup: a 390 px a barra fica presa logo abaixo da barra do topo (`position: sticky; top: var(--obs-top)`; se outro grudado da tela usa `--obs-top`, somar a altura da barra em `--obs-sticky-h` enquanto ela existe) com um único `z-index` (`var(--z-grudado)`; se o token não existir, usar o que o pé preso `pe-preso.tsx` usa). Botões: `Inscritos`, `Views/dia`, `Crescimento`, `Direção`, depois `Ritmo`, `Outliers`, `Trocas` (D4). O ativo leva ` ↓` (maior primeiro) ou ` ↑`; tocar o ativo inverte. A barra rola na horizontal dentro dela (`overflow-x: auto`), a página não.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { screen, fireEvent, within } from '@testing-library/react'
// montar a tela em layout de cartões (layout: 'cards') com o helper de canais-a3-tela.test.tsx

describe('barra de ordenação', () => {
  it('7 botões na ordem do mockup, o ativo com ↓ e aria-pressed', () => {
    // …montar com layout: 'cards', sort: 'subs', dir: 'desc'
    const bar = screen.getByTestId('canais-sortbar')
    const nomes = within(bar).getAllByRole('button').map(b => b.textContent)
    expect(nomes).toEqual(['Inscritos ↓', 'Views/dia', 'Crescimento', 'Direção', 'Ritmo', 'Outliers', 'Trocas'])
    expect(within(bar).getByRole('button', { name: /Inscritos/ }).getAttribute('aria-pressed')).toBe('true')
  })
  it('estrutura (o jsdom não faz layout): a barra é irmã da lista de cartões, no mesmo contêiner', () => {
    // …montar com layout: 'cards'
    const bar = screen.getByTestId('canais-sortbar')
    expect(bar.parentElement!.contains(document.querySelector('.cards'))).toBe(true)
    expect(bar.closest('.cardsort')).toBeNull() // não dentro da linha de ferramentas
  })
  it('tocar o ativo inverte; tocar outro abre do maior', () => {
    // …montar e capturar a navegação (o mesmo jeito que canais-a3-tela verifica onSort/URL)
    fireEvent.click(screen.getByRole('button', { name: /Inscritos/ }))
    // espera dir=asc na URL/onSort
    fireEvent.click(screen.getByRole('button', { name: 'Direção' }))
    // espera sort=direcao&dir=desc
  })
  it('o select antigo saiu', () => {
    // …montar
    expect(document.querySelector('select[name="cardSort"]')).toBeNull()
  })
})
```

O executor completa as duas esperas com o mesmo mecanismo que `canais-a3-tela.test.tsx` usa para afirmar a troca de ordenação (mock de `useRouter().replace` ou de `onSort`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/canais-a5-sortbar.test.tsx > $SCRATCH/a5-t9.txt 2>&1; grep -E "FAIL|×" $SCRATCH/a5-t9.txt | head`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```tsx
const ORDEM_DA_BARRA: CanaisSort[] = ['subs', 'vpd', 'growth', 'direcao', 'active', 'outliers', 'swaps'] // D4: as 4 do mockup primeiro (Naksu confere)
<div role="group" aria-label="Ordenar canais" className="sortbar" data-testid="canais-sortbar">
  {ORDEM_DA_BARRA.map(s => {
    const ativo = v.sort === s
    return (
      <button key={s} type="button" aria-pressed={ativo} className={ativo ? 'on' : undefined} onClick={() => onSort(s)}>
        {SORTNAME[s]}{ativo ? (v.dir === 'desc' ? ' ↓' : ' ↑') : ''}
      </button>
    )
  })}
</div>
```
`SORTNAME` precisa ser exportado de `view-model.ts`? Se não for, usar os rótulos que a tela já recebe (`COLS`); **não** exportar de `view-model.ts` nesta tarefa (fora da lista): ler como `canais-screen.tsx` obtém os nomes hoje e seguir.
`onCardSort` (sempre `desc`) some; a barra usa `onSort` (alterna).

`canais.css`:
```css
.sortbar { position: sticky; top: var(--obs-top); z-index: var(--z-grudado); display: flex; gap: 6px; overflow-x: auto; padding: 8px 16px; background: var(--bg) }
.sortbar button { flex: none; min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface) }
.sortbar button.on { font-weight: 600; border-color: var(--text) }
```
(tokens: os que `canais.css` já usa; sem `color-mix`.)

- [ ] **Step 4: Rodar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/canais-a5-sortbar.test.tsx test/youtube/observatorio/canais > $SCRATCH/a5-t9.txt 2>&1; grep -E "FAIL|×" $SCRATCH/a5-t9.txt | head`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: canais: barra de ordenação fixa no celular, tocar de novo inverte" -- "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/canais-screen.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/canais.css" apps/web/test/youtube/observatorio/canais-a5-sortbar.test.tsx
```

---

### Task 10: e2e do Gio

**Files:**
- Create: `apps/web/e2e/tests/cms/observatorio/canais-a5-ordem-setas.spec.ts`
- Modify: `apps/web/e2e/fixtures/observatorio-seed.ts` (dois concorrentes sintéticos com o mesmo Crescimento visível e um com Direção "pouco registro")
- Modify: `apps/web/e2e/tests/cms/observatorio/canais-a3.spec.ts:402` (o texto "Esta ordenação não mostra posição" vira o `FAIXA_SEM_POSICAO`)

**Interfaces:**
- Consumes: os `data-testid` das Tarefas 5, 8 e 9 (`canais-p`, `canais-ordem`, `canais-faixa`, `canais-th-<sort>`, `canais-sortbar`), a classe `.cdica` e `role="tooltip"`.

Casos (o Gio escreve e roda; nomes sintéticos tipo "Canal Teste A"):

1. **1440 px, Crescimento:** clicar no cabeçalho Crescimento → `canais-ordem` com o texto à letra; os dois canais da semente com o mesmo valor mostram o mesmo `Nº` e "empate", em ordem A–Z; clicar de novo → lista invertida, o 1º do topo agora tem o maior `Nº`, empate continua A–Z.
2. **1440 px, Direção:** cabeçalho Direção ordenável; o primeiro clique abre com quem mais sobe; "não medido" e o canal próprio abaixo do divisor "Ainda sem medida para ordenar"; nenhum "0%" inventado.
3. **Sem variação:** a célula do canal da semente dentro do arredondamento mostra "sem variação" e "dentro do arredondamento (±N)"; a dica abre no hover com "Dentro do arredondamento do YouTube (passo de N): pode ser só isso."
4. **Dica por célula, teclado:** Tab até uma célula de Views/dia → `role="tooltip"` visível; Esc fecha; nenhum `[title]` nas células de valor (`td[data-col] [title]`).
5. **Clique na dica não abre o painel:** clicar numa célula com dica não abre o painel lateral; clicar no nome do canal abre.
6. **390 px:** barra `canais-sortbar` presa logo abaixo da barra do topo ao rolar (depois de rolar 2.000 px, `bar.boundingBox().y` igual ao `bottom` da barra do topo, ± 1 px, **não** 0: com `top: 0` ela ficaria por baixo da barra do topo); tocar "Direção" ordena, tocar de novo mostra " ↑"; tocar uma dica abre, tocar fora fecha; a caixa da dica cabe na janela (`boundingBox` dentro de 0..390); sem rolagem horizontal da página (`scrollWidth <= 390`).
7. **Faixa do seu canal:** em Crescimento, `canais-faixa` com "Seu canal ainda não tem Crescimento medido." (semente sem retrato próprio) e os links "Ordenar por Inscritos" / "Ordenar por Views/dia" funcionando.
8. **Regressão:** `canais-a3.spec.ts` inteiro verde com o texto novo.

Capturas em `docs/superpowers/mockups/2026-10-15-canais-ordem-e-setas/shots-implementado/` (1440 e 390, cada caso), veredito do Gio em texto.

- [ ] **Step 1:** o Gio acrescenta à semente os canais sintéticos e roda `canais-a3.spec.ts` antes de escrever a spec nova (prova que a semente não quebrou o que existia).
- [ ] **Step 2:** escrever `canais-a5-ordem-setas.spec.ts` com os 8 casos e rodar (saída em arquivo). Expected: verde.
- [ ] **Step 3:** commit

```bash
git commit -m "test: canais: e2e da 2ª leva (numeração, Direção ordenável, sem variação, dicas, barra fixa)" -- apps/web/e2e/tests/cms/observatorio/canais-a5-ordem-setas.spec.ts apps/web/e2e/fixtures/observatorio-seed.ts apps/web/e2e/tests/cms/observatorio/canais-a3.spec.ts
```

---

### Task 11: Fecho

**Files:**
- Modify: `.superpowers/sdd/a5/progress.md` (seção "2ª leva Canais")

- [ ] **Step 1: Typecheck web e suíte de Canais**

Run: `cd apps/web && npx tsc --noEmit -p . > $SCRATCH/a5-fecho-tsc.txt 2>&1; grep -c "error TS" $SCRATCH/a5-fecho-tsc.txt; npx vitest run test/youtube/observatorio > $SCRATCH/a5-fecho-vitest.txt 2>&1; grep -E "Test Files|Tests " $SCRATCH/a5-fecho-vitest.txt`
Expected: `0` erros; só as falhas da linha de base da Tarefa 0 (comparar com `$SCRATCH/a5-canais-t0-base.txt`).

- [ ] **Step 2: Ledger**

Anotar: commits da 2ª leva; contagem da D1 (Tarefa 1, Step 5); lista dos `TEXTO-A-REVISAR (Logan)` novos (Outliers "na mesma idade", Views/dia "desde DD/MM", Direção do canal próprio, Inscritos < mil, Direção "Variou ±P", "não carregou" do Crescimento próprio, botões da faixa) e o ponto da Naksu (ordem da barra fixa); pendências para o ledger: (a) corrigir o `roundingText` do motor (hoje "±m" simétrico; o YouTube corta para baixo) fica **fora deste plano** (Phil I5); (b) a dúvida da direção do arredondamento (TEXTO-A-REVISAR da dica de Inscritos); (c) a data de conferência: **no dia do deploy (D0)**, abrir Canais ordenado por Crescimento e conferir que todo canal "sem variação" mostra `±` igual a 2 × passo (1,2 mi → ±20 mil), nenhuma célula com "−0,0%" ou "+0,0%", e o canal próprio com Crescimento no mesmo sentido (sobe/desce) da seção Inscritos e com a data do último retrato; rodar a consulta do dono (Tarefa 1) e anotar os números (`quais` deve bater com os canais que mudaram de célula); **no primeiro canal novo após o deploy**, a dica de Direção diz "fecha em DD/MM" = primeiro retrato + 56 dias, e nesse dia (ou no seguinte, por `staleDays = 1`) a célula passa a medido: anotar a data e conferir; revisão final pendente de Phil e Yannis sobre o código, Logan e Naksu sobre a tela implementada, Gio sobre o e2e.

- [ ] **Step 3: Commit do ledger**

```bash
git commit --no-verify -m "docs: ledger da 2ª leva da tela Canais" -- .superpowers/sdd/a5/progress.md
```

---

## Autorrevisão (feita ao escrever)

- **Cobertura do pedido:** (1) P em toda ordenação, posição canônica, empate de competição com "empate", faixa com o texto do Logan → Tarefas 3, 3b, 5. (2) Crescimento + e − e "dentro do arredondamento (±N)" por canal → Tarefas 1, 4. (3) Direção ordenável, abre com quem mais sobe, sem medida no fim e nunca 0 → Tarefas 3, 5. (4) Sortbar fixa → Tarefa 9. (5) Dica por célula com os textos da R3 → Tarefas 6, 7, 8. Pendências do Logan → "Decisões" (a), (b), (c). Fonte de cada número → tabela "Fonte de cada número das dicas". Sem migration → D1, D2 e a tabela. e2e do Gio → Tarefa 10.
- **Tipos entre tarefas:** `Crescimento30`/`crescimento30` (T1 → T4); `numero`, `'direcao'` (T3 → T3b, T5, T9); `GrowthCell` com `motivo/fechaEm/dias/antes/depois/abs/pct/limite/passo` (T4 → T7); `CelulaDica`, `CELULA_DICA_CLASSE` (T6 → T8); `dicas` (T8). `fechaEm` da M3a é `string` 'AAAA-MM-DD' (T2) e o de Crescimento é `number` ms (T1): `dicaDirecao` formata a string (`DD/MM` de `fechaEm.slice`), `dicaCrescimento` usa `e.dm`.
- **Decisão da dúvida do Phil I5 (arredondamento do YouTube corta para baixo?):** conferido no repositório (`git grep` por `subscriberCount`/`subscriber_count` com "arredond", "round", "trunc", "algarism", "floor", "para baixo" em `apps`, `packages`, `docs`): **nada confirma a direção**. O código só diz que o YouTube arredonda a 3 algarismos (`inscritos-28d.ts:15`, `passoDoYouTube`: "Passo com que o YouTube arredonda a contagem … 10^(⌊log10 n⌋−2)") e nenhum arquivo afirma "para baixo". O Phil cita a doc da API (recurso `channels`, `statistics.subscriberCount`: valor "rounded down" a 3 algarismos significativos) **de memória** (ele mesmo registra em §9 que não conferiu o texto). Por isso o texto da dica de Inscritos entra com o conserto exato dele e marcado `TEXTO-A-REVISAR (Logan)` com a dúvida explícita: "confirmar na doc oficial da YouTube Data API que o `subscriberCount` é cortado para baixo, não arredondado ao mais próximo; se for ao mais próximo, a frase volta a ±m simétrico". A conta do "dentro do arredondamento" (±2 passos) vale nos dois casos e não depende disso.
- **Riscos que pedem olho do revisor:** D1 muda número visível em três telas (Phil); `direcaoDe` chamada dentro de `valoresOf` não pode criar ciclo com `rowOf` (Yannis: `valoresOf` é cacheado por canal); `posicoes` passa a rodar em toda ordenação, O(n²) no pior caso de empates sobre ≤ 75 + próprios canais (Yannis confirmou: 77 → 0,23 ms; 1.000 → 24 ms; gatilho para trocar por ordenar + varrer, O(n log n): `channel_limit` > 300).

---

## Consertos da 1ª revisão (Phil e Yannis)

Fontes: `.superpowers/sdd/a5/discussao-direcao/phil-plano.md` (APROVA COM RESSALVA) e `yannis-plano.md` (CORRIGE). Cada achado → onde foi aplicado. Onde os dois falam do mesmo ponto, um conserto só.

| Achado | Onde foi aplicado |
|---|---|
| **Phil I1 + Yannis I1** ("−0,0%" abaixo de mil; zero exato) | Conserto único. T1: `roundingOf` (`dentro = limite > 0 ? |abs| < limite : abs === 0`), dois testes (800→800 `true`; 800→801 `false`). T4: `growthCell` com `sinal()` de três vias, cap `mesmo número nas duas contagens` (do Phil; o `"0 em 30 d"` do Yannis ficou de fora por ser texto de célula `ok`, e o caso é `flat`), teste que nega `−0`. T7: dica do `flat` com `limite` 0. Review Focus. |
| **Phil I2 + Yannis I6** (guarda `numeros-nao-mudam-e5a`) | Conserto único. T1 Step 5: exceção em duas partes (texto "±N"→"±2N" por regex; número por predicado calculado no teste), nunca regravar o retrato. T4: arquivo na lista, no Run e no commit + Step 5b (exceção de **forma**). T8: idem (lista, Run, commit, exceção de forma). |
| Phil I3 (janela "30 dias" podia ser 31 a 90) | T1: `crescimento30` só mede com 29 <= dias <= 33, senão `pending: 'buraco na contagem …'` (fora da numeração) + teste; T4: `motivo: 'buraco'`, `de`/`ate` na célula; T7: a dica escreve "De X em DD/MM para Y em DD/MM". Consulta do dono conta `janela_maior_que_33d`. |
| Phil I4 (canal próprio sem trava de retrato velho) | T4: `atrasadoAte` (`REGRAS_INSCRITOS.retratoVelhoDias`), `cap` com ", até DD/MM", teste; T7: frase do retrato parado. |
| Phil I5 (YouTube corta para baixo) | T7: texto da dica de Inscritos com o conserto exato do Phil, `TEXTO-A-REVISAR (Logan)`. Conferência no repo: **não confirma** a direção; dúvida escrita na autorrevisão e no ledger (T11). Corrigir `roundingText` do motor: fora do plano, anotado no ledger. |
| Phil M1 (passo da maior contagem) | T1: `roundingOf(fmt, subs, base, abs)` com `base = max(prev.subs, now.subs)`; teste 995.000→1.010.000. |
| Phil M2 (teste da T1 não separava regra velha/nova) | T1 Step 1: caso "1 passo" reescrito, virada de década e os dois casos abaixo de mil. |
| Phil M3 ("Só n dias de vídeos") | T7: "Só {n} dias de registro; …"; T2: comentário de que `n` conta dias de registro. |
| Phil M4 (`fechaEm` é "a partir de") | T2: comentário no código. |
| Phil M5 (Crescimento "novo" com coleta parada) | T7: `Escrita.agora`; `fechaEm < agora` => frase sem a data + teste. |
| Phil M6 (Ritmo parcial) | T7: `dicaRitmo` com `partialText`; T8: repasse de `cadence().partialText`. |
| Phil §6 (SQL de leitura) | T1: "Passo do dono", SQL copiado à letra, **não rodado**; limite "se `muda_*` > 5, parar". Phil §7 (conferências com data) → T11 Step 2. |
| Yannis I2 (testes da Direção ordenável) | T3 Step 1: `naoMedido('pouco_registro', …)` explícito para o "não medido"; 2º teste com 3 "não carregou", nomes e inscritos em ordem oposta e `nomes.length >= 3`. |
| Yannis I3 (jsdom sem `PointerEvent`) | T6 e T8: bloco `beforeAll` com a classe `PE`. |
| Yannis I4 (barra "fixa" não ficava fixa; `top: 0`) | T9: barra irmã da lista de cartões, `top: var(--obs-top)`, `--obs-sticky-h`, teste de estrutura, `role="group"` (Naksu decide), e2e do caso 6 (T10) com `bottom` da barra do topo. |
| Yannis I5 (`title` legítimo) | D4 + T8: regra e teste restritos a `td[data-col] [title]`; T10 caso 4. |
| Yannis I7 (predicado único de "oculto") | T4: `ocultoDe(c)` usado por `rowOf`, célula e `valoresOf` (`growth` e `subs` nulos), com testes. |
| Yannis I8 (pré-condição presa a hash) | Global Constraints + T0 Step 1: por assunto de commit, os dois (lote e consertos do lote), árvore na ponta para os 3 arquivos compartilhados. |
| Yannis I9 (ordem e paralelismo) | Seção "Ordem das tarefas" (grafo `T0 → (T1 ∥ T2) → T3 → T3b → T4 → T5 → T7 → T8 → T9 → T10 → T11`), T6 paralela só com `celula-dica.css` novo; mapa de arquivos; `import type` em `dicas-model.ts`. |
| Yannis M1 (`CelulaDica` reimplementava o `Tip`) | T6: `useDica()` (hov, foc, toque, Esc, `shown`) + `useTipShown`; T8: o `Tip` de `cells.tsx` passa a usar o hook; testes novos (mouseEnter/Leave, foco+mouseLeave, popover aberto). |
| Yannis M2 (ouvintes globais por instância) | T6: ouvintes só enquanto a dica está aberta. |
| Yannis M3 (dois mecanismos para "clique não abre o painel") | T6: sem `stopPropagation` (+ teste do clique visto pelo `document`); T8: só o seletor `.cdica` na linha. |
| Yannis M4 (testes dependentes da fixture) | T3 (empate pelo subconjunto de chave "0"; pré-condição do filtro); T8 (linha de concorrente por id; "Tentar de novo" sem `if` e com `onRetry`). |
| Yannis M5 (`fromSubs`/`toSubs`) | T1: `Crescimento30.fromSubs/toSubs`; T4: sem `snapshots.find` nem ramo `c.own`. |
| Yannis M6 (escopo da linha de base) | T0 Step 2: a suíte inteira `test/youtube/observatorio`, igual à da T11. |
| Yannis M7 (concorrente "sem registro") | T7: linha na tabela e teste. |
| Yannis complexidade (`Intl.Collator`, reusar `trocas`) | T3 (`colador`), T8 (reuso de `trocas`). |

**Achados não aplicados:** nenhum. Nenhum achado exigiu mudar decisão do dono nem o mockup 17. Dois pontos de escolha entre os revisores: (1) texto do `cap` de "sem variação" abaixo de mil: usei o do Phil; (2) `role`: o Yannis deixou a decisão `toolbar`/`group` para a Naksu; o plano escreve `group` e marca a decisão dela. O teto de 33 dias (Phil I3) e a regra de 2 passos mudam número só nos casos listados na D1, já cobertos pela exceção declarada; a regra de 2 passos em si foi aprovada pelo dono no mockup.
