# Telas do Observatório, fase A2 (Histórico do vídeo) — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development. Um implementador por vez,
> Sonnet, `effort: high` (desce para `medium` quando as revisões voltarem limpas; nunca `xhigh` nem `max`). Revisão
> final do lote em Opus, `high`. Os passos usam caixas (`- [ ]`).

**Objetivo:** o Histórico do vídeo de produção ganha a chegada pela troca (`troca=`), o gráfico em 30 dias por padrão, a trilha e o pager vindos da página do canal, a moldura só com a trilha, o visualizador de thumbnail e o cartão novo da leitura da forja, com o botão do cabeçalho que rola e pede. **Nada do que a tela já tem se perde.**

**Arquitetura:** a rota `video/[id]` continua de servidor e continua lendo o conjunto do site (`openObservatoryPage`); `buildHistoricoView` passa a entender `troca`, o novo padrão de `range` e a origem "página do canal" (`canal=` + `back=`). A moldura troca `ObservatoryChromeServer` por `TrailChrome` (A1). O visualizador é um componente cliente compartilhado em `_chrome/`, aberto pelo Histórico e pela página do canal. O cartão da forja ganha um modelo puro (situação, etapas, frases) e um componente novo no lugar de `VideoReading`.

**Stack:** Next 16, React 19, TypeScript estrito, Vitest (happy-dom; jsdom onde indicado), Playwright (projeto `observatorio`, banco local).

**Spec:** `docs/superpowers/specs/2026-10-07-observatorio-canal-video-ui-design.md` (v9): seção 4.2 "A2", seções 3, 6 (inteira), 7.1, 7.2, 7.4, 11 e 19. Quem executa lê o spec junto com a tarefa: **todo texto de tela citado aqui está no spec e vale o do spec, letra por letra.** Onde o corpo e uma emenda discordarem, vale a emenda.

**Fonte visual (mockup aprovado em 10/10):** `docs/superpowers/mockups/2026-10-07-pagina-canal/{video.html,video.js,hist.css,viewer.js,viewer.css,forja.js,forja-etapas.css}`. Medidas, espaçamento e ordem saem dali. O mockup tem dados próprios e não tem banco: copia-se a forma, nunca o dado.

**Ledger:** `.superpowers/sdd/2026-10-11-telas-a2-historico-plan/progress.md` (criar na Tarefa 1). Relatório de cada tarefa em `task-N-report.md` na mesma pasta; a resposta do agente ao controlador tem até 10 linhas.

Abreviações de caminho:
- `C/` = `apps/web/src/app/cms/(authed)/youtube/competitors/`
- `L/` = `apps/web/src/lib/youtube/observatorio/`
- `T/` = `apps/web/test/youtube/observatorio/`
- `E/` = `apps/web/e2e/tests/cms/observatorio/`
- `M/` = `docs/superpowers/mockups/2026-10-07-pagina-canal/`

## Restrições globais

- Trabalho em `staging`, sem branch nem worktree. Nunca `git stash`, `git reset`, `--no-verify`, `pkill`. Commit por caminho explícito (`git add <caminhos>` e `git commit -- <caminhos>`). **Nunca** commitar `apps/web/next-env.d.ts` nem `apps/web/tsconfig.json`. **Sem push**: push e promoção são do controlador.
- Nenhum `color-mix()` em CSS. Cores em hex ou `rgba` literal. Nenhum `z-index` numérico em arquivo novo: só `var(--z-*)` (`C/_chrome/camadas.css`; o diálogo usa `--z-modal`).
- Nulo nunca vira zero. Dado ausente é `null` no tipo e uma frase na tela. Este sistema falha em verde: pergunte "o que aparece quando o dado não existe?" antes de "quando dá erro?".
- Toda dica, popover e menu usa `Popover` ou `HoverTip` de `C/_chrome/flut/flut.tsx`.
- `strict: true`, nunca `any`. Arquivos em kebab-case. Corpo de texto mínimo de 12 px na interface nova. No máximo um botão preenchido por vista (os dois da forja são o caso previsto no spec 7.1).
- Nunca passar `next/link` (nem componente importado num Server Component) como prop para componente cliente; server actions chegam por props.
- **Next 16 não remonta componente cliente quando só a query muda:** estado em `useState(inicial)` fica velho. Todo estado que nasce da URL (troca selecionada, período) é ressincronizado por efeito ou por `key`. E a árvore anterior da rota fica escondida no DOM depois do Voltar: buscar elemento por `ref` da raiz, nunca `document.getElementById`; nos specs de Playwright, localizadores com `:visible`.
- A casca do CMS rola em `main`, não na janela (ver `C/_canal/use-rolagem-ao-voltar.ts`).
- **A2.5, "nada se perde":** teste existente do Histórico não muda de **expectativa**, salvo o padrão de período e a moldura. Teste que dependia do vídeo inteiro por padrão recebe `range: 'tudo'` na **entrada**; a afirmação fica igual. Toda mudança de teste vai no **mesmo commit** da mudança de código.
- Fixture novo de teste segue `T/canal-fixture.ts`: o conjunto base é lido **uma vez por arquivo** e guardado (o CI tem limite de 60 s por executor do Vitest).
- Horários em São Paulo (`obs.date`). Datas em `<time datetime>`.
- `$SCRATCH` = o diretório de rascunho da sessão, que o controlador informa no brief.
- Subagente nunca espera mais de 4 min parado: suíte, build e Playwright vão em fundo, com saída em arquivo; no contexto entram só as falhas.
- Suíte de uma pasta: `cd apps/web && npx vitest run test/youtube/observatorio > $SCRATCH/vitest.txt 2>&1`. Typecheck: `cd apps/web && npx tsc --noEmit -p . > $SCRATCH/tsc.txt 2>&1`.
- E2E local: `npm run db:start` (nunca `db:reset`), depois `cd apps/web && npx playwright test --project=observatorio <spec> > $SCRATCH/pw.txt 2>&1`. O servidor sobe sozinho na porta 3099.
- Navegador (DevTools/Chrome MCP) só em subagente Sonnet; capturas vão para arquivo, o veredito volta em texto.
- Os e2e antigos de fidelidade (`E/canais.spec.ts` e os que comparam DOM com os mockups de 02/10) estão aposentados: não rodar, não consertar.

## Decisões deste plano (o spec deixou para o plano; o dono pode reverter)

| # | Decisão | Por quê | Custo se errado |
|---|---|---|---|
| D1 | **`changeId` é estável entre cargas: confirmado.** É `<videoId>/<tipo>/<índice da versão>` (`L/changes.ts:61`); versões só são acrescentadas no fim, então o índice não muda. `troca=` leva esse valor | o spec (seção 3) marcava como INFERÊNCIA | se um dia uma versão for apagada do meio, o link aponta para a troca vizinha; a tela não quebra (D2) |
| D2 | `troca=` que não é deste vídeo, é lixo, ou é de uma troca que não tem par em "Antes e depois": abre como hoje, sem mensagem. `troca=` de **descrição** vale como qualquer outra | spec 6.2 | nenhum |
| D3 | Troca de `troca=` mais antiga que 30 dias, sem `range` na URL: o gráfico abre no **menor** de 90 ou `tudo` que a inclui. Com `range` explícito na URL, vale o da URL, e a troca continua selecionada em "Antes e depois" mesmo fora do gráfico | spec 6.2 (pergunta 3, aceita) | uma linha em `rangeFor` |
| D4 | `ids=` **continua** na URL nesta fase, com a janela de 100 vizinhos; a frase de posição passa a contar a lista de origem por dois parâmetros novos, `pos=<posição do vídeo aberto, a partir de 1>` e `tot=<total da lista>` | reconstruir a grade no servidor exigiria repetir, sobre outro conjunto, o filtro, a ordenação e a busca que hoje rodam no navegador; o spec (seção 3) aceita os 100 ids | URL de cerca de 4 KB; encolher vira tarefa quando o canal próprio (A4) tiver lista de servidor |
| D5 | O **foco no último vídeo visto** ao voltar para o canal usa `sessionStorage` (`obs:ultimo-video:<canalId>`), escrito pelo Histórico e lido pela página do canal no Voltar; leitura e escrita em try/catch, e sem ele a página volta como hoje (rolagem do navegador) | Anterior/Próximo substituem a entrada do histórico, então a URL do canal que volta é a de antes do primeiro vídeo | sem armazenamento, o foco fica onde o navegador deixar |
| D6 | Etapas: 'nova tentativa' fica em **Escrevendo** e 'liberado pelo vigia' em **Na fila**, como no mockup aprovado | spec 7.4 pede confirmação do dono; o mockup aprovado é a referência mais recente | trocar é uma linha no mapa de etapas |
| D7 | A atualização automática com pedido em andamento (hoje feita pela moldura inteira, `C/_chrome/observatory-chrome.tsx:110-116`) vira um hook compartilhado em `_chrome/`; o Histórico passa a chamá-lo, com "Pausar atualização automática" no cartão | a moldura só com a trilha não tem esse efeito, e a tela pararia de se atualizar | a tela ficaria parada em "Na fila" até recarregar |
| D8 | O atalho de "pedir ao Cowork" e os botões de forja da moldura antiga **saem** do Histórico junto com as abas e a barra de nicho | emenda 25: só a trilha | o pedido de leitura continua nos dois botões da própria tela |
| D9 | A aba **Leitura** da página do canal continua com o cartão do nicho de Mudanças; o cartão novo vale só no Histórico | A2.7 fala do cartão do vídeo; a leitura por canal não existe (7.3) | o comentário em `C/canal/[id]/page.tsx:16` continua valendo para uma fase futura |
| D10 | "Baixar": tenta `fetch` + blob; se o navegador recusar (CORS do `i.ytimg.com` ou do Blob), abre a imagem em outra aba e o status diz para salvar por lá | spec 6.3 [INFERÊNCIA] | a Tarefa 5 mede e registra qual caminho cada origem de imagem toma |
| D11 | Índices ¹ ² só aparecem quando a leitura guardada traz a evidência por item; sem ela, o texto sai sem índice (nunca um link inventado) | o formato da leitura em produção é o que manda | a Tarefa 7 registra o que o formato traz |

## Foco de revisão

Entradas que o spec implica e que mais mordem quem usa; cada linha tem o teste na tarefa dona do código.

1. **`troca=` e `range=` com valor ruim** (`troca=` de outro vídeo, `troca=abc`, `range=abc`, `range=` vazio, os dois juntos): a tela abre no padrão (30 dias, par padrão, foco no título), sem mensagem e sem 500. → Tarefa 1, teste "parâmetros inválidos".
2. **Vídeo sem gráfico** (fora dos acompanhados, fixado ainda não conferido, vídeo não encontrado) aberto com `troca=` e na moldura nova: sem seletor de período, sem foco perdido, a trilha continua levando de volta. → Tarefas 1 e 3.
3. **Origem que não dá para descrever** (`back=` com estado inválido do canal, `canal=` de outro canal, `pos`/`tot` ausentes ou incoerentes com `ids`): a frase de posição cai na forma genérica e conta só `ids`; nunca "vídeo 0 de 0" nem "vídeo 120 de 51". → Tarefa 2.
4. **Visualizador sem imagem** (versão não arquivada, imagem que não carrega em nenhuma resolução, vídeo com uma versão só): quadro explicativo ou "A imagem não carregou.", "Baixar" e "Abrir original" apagados, sem Anterior/Próxima, "Comparar lado a lado" apagado com o motivo. → Tarefa 5.
5. **Pedido à forja repetido ou que falha** (clique duplo, ação que lança, `refresh` chegando no meio): uma só chamada; na falha o botão volta a "Pedir leitura à forja" com o motivo; sem pedido não há etapa. → Tarefa 8.

---

### Tarefa 1: período de 30 dias por padrão e chegada pela troca (modelo e tela)

**Arquivos:**
- Modificar: `L/links.ts`, `C/_historico/many-versions.ts`, `C/_historico/view-model.ts`, `C/_historico/historico-screen.tsx`, `C/_historico/compare.tsx`, `C/_historico/lanes.tsx`, `C/_historico/historico.css`
- Teste: criar `T/historico-a2-range-troca.test.ts`, `T/historico-a2-chegada.test.tsx` (jsdom); ajustar `T/historico-*.test.ts*`, `T/links.test.ts`
- Criar: `.superpowers/sdd/2026-10-11-telas-a2-historico-plan/progress.md`

**Interfaces:**
- Consome: `buildHistoricoView(obs, id, p, opts)`, `parseRange`, `rangeStart`, `pairOfChange` (interno ao view-model), `Hl` de `lanes.tsx`.
- Produz:
  ```ts
  // L/links.ts — historico ganha range, pos e tot. Ordem fixa das chaves: from, back, ids, canal, troca, range, pos, tot
  historico(videoId: string, p?: { from?: ...; back?: string; ids?: string[]; canal?: string; troca?: string; range?: '7' | '90' | 'tudo'; pos?: number; tot?: number }): string
  // C/_historico/many-versions.ts
  export const RANGE_DEFAULT: RangeId = '30'
  /** Ausente ou lixo = 30 dias; 'tudo' = o vídeo inteiro. `offered` deixa de existir: o seletor aparece sempre que há gráfico. */
  export function parseRange(raw: string | undefined): RangeId
  /** O menor período que inclui `at` (ms): '30', senão '90', senão 'tudo'. */
  export function rangeFor(at: number, now: number): RangeId
  // C/_historico/view-model.ts — HistoricoView ganha:
  arrival: { pairK: string; changeId: string; lane: LaneType; markerIdx: number; line: string; status: string } | null
  // line = "Aberta pela aba Trocas do canal: <troca>, <quando>."  status = "Aberta a troca: <troca>, <quando>. Ela está destacada no gráfico, na faixa e em Antes e depois."
  ```
  `defaultPair` passa a ser o par da troca de chegada quando `arrival` não é nulo. `range` (RangeView) deixa de ser nulo sempre que `chart` existe.

- [ ] **Passo 1: testes que falham** (`T/historico-a2-range-troca.test.ts`)
```ts
it('sem range o gráfico mostra 30 dias e o seletor tem 7 d, 30 d, 90 d e tudo, com 30 d marcado', ...)
it('o seletor aparece em vídeo com série curta (antes só aparecia acima de 30 dias de série)', ...)
it('range=tudo mostra o vídeo inteiro; range=7 e range=90 como hoje', ...)
it('parâmetros inválidos: range=abc, range vazio e range=30 dão 30 dias', ...)
it('vídeo sem gráfico (fora dos acompanhados, não encontrado): range é null, sem erro', ...)
it('a faixa "antes de 03/10, sem registro" continua no gráfico de 30 dias', ...)
it('troca= de uma troca deste vídeo: arrival preenchido, defaultPair é o par dela, a linha e o status com o texto do spec 6.2', ...)
it('troca= de troca agrupada (duas trocas no mesmo par): arrival.pairK é o par do grupo', ...)
it('troca= de outro vídeo, troca=abc, troca vazio: arrival null e defaultPair igual ao de hoje', ...)
it('troca= mais antiga que 30 dias, sem range: o período é 90; mais antiga que 90: tudo', ...)
it('troca= antiga com range=7 na URL: vale o 7 e a troca continua selecionada (comparisons a contém com inRange false)', ...)
it('link.historico emite range só quando difere de 30, e pos/tot quando dados; ordem fixa das chaves', ...)
```
`T/historico-a2-chegada.test.tsx` (jsdom):
```ts
it('com arrival: a troca chega selecionada em "Antes e depois" com a linha "Aberta pela aba Trocas do canal: …"', ...)
it('com arrival: o marcador da troca na raia tem o anel (data-arrival) e recebe o foco; o status lê a frase do spec', ...)
it('sem arrival: o foco fica no título e não há linha nem status de chegada', ...)
it('a seleção é só o estado inicial: escolher outra troca tira a linha de chegada e não muda a URL', ...)
it('navegação que só muda a query (rerender com outra view.arrival) ressincroniza a seleção', ...)
it('onRange: 30 tira o parâmetro; tudo grava range=tudo; "Mostrar o vídeo inteiro" leva a range=tudo', ...)
```
- [ ] **Passo 2: rodar e ver falhar.** `cd apps/web && npx vitest run test/youtube/observatorio/historico-a2 > $SCRATCH/t1.txt 2>&1`
- [ ] **Passo 3: implementar.** `parseRange` perde o segundo argumento; `rangeOffered` deixa de decidir o seletor (o seletor existe sempre que há gráfico), mas a regra de recolher a grade de thumbnails (`collapseAbove`) não muda. No view-model, resolva `troca` logo depois de `pairs`: `pairOfChange(p.troca)`; o período efetivo é `p.range` válido, senão `rangeFor(change.at, now)` quando há chegada, senão 30. Na tela, `onRange` inverte (30 = sem parâmetro). O foco no marcador roda num efeito depois da montagem, a partir de `root.current`, e só rola se o marcador estiver fora da área visível do contêiner que rola (`main`). O anel do marcador sai de `M/hist.css` (procure "anel").
- [ ] **Passo 4: ajustar os testes existentes.** Rode a pasta inteira; em cada teste do Histórico que falhar por causa do padrão de período, acrescente `range: 'tudo'` à entrada e não toque na afirmação. Liste no relatório cada arquivo e quantos testes mudaram de entrada; qualquer afirmação alterada precisa de justificativa por escrito.
- [ ] **Passo 5: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 6: commit** — `feat: Historico: grafico em 30 dias por padrao e chegada pela troca`.

---

### Tarefa 2: trilha e pager vindos da página do canal; Anterior/Próximo sem crescer o histórico

**Arquivos:**
- Modificar: `C/_historico/view-model.ts` (bloco "context"), `C/_historico/pager.tsx`, `C/_historico/historico-screen.tsx`, `C/_canal/canal-screen.tsx` (links com `pos`/`tot`; foco no Voltar), `C/_canal/trocas-model.ts` (idem), `C/_canal/use-rolagem-ao-voltar.ts` (só se o foco precisar dele)
- Criar: `C/_historico/origem-canal.ts`, `C/_chrome/ultimo-video.ts`
- Teste: `T/historico-a2-origem.test.ts`, `T/historico-a2-pager.test.tsx` (jsdom), ajustar `T/canal-trocas-model.test.ts` e o teste de links da grade

**Interfaces:**
- Consome: `parseCanalState` e os tipos de `C/_canal/params.ts`; `link.canal`, `link.canais`, `link.historico` (com `pos`, `tot` da Tarefa 1).
- Produz:
  ```ts
  // C/_historico/origem-canal.ts — puro
  /** A frase da lista de origem, lida de back= (o estado da página do canal). null quando back não descreve um estado válido. */
  export function origemDoCanal(back: string | null, canalNome: string): { of: string; outside: string } | null
  // grade:  of = "de Leo Khev (longos, do mais novo ao mais antigo)"   — filtro, ordenação e busca ativos, nas palavras dos controles do spec 5.5
  // trocas: of = "com trocas de Leo Khev (trocas dos últimos 30 dias, da mais recente à mais antiga)"
  // C/_chrome/ultimo-video.ts — sessionStorage em try/catch
  export function lembrarUltimoVideo(canalId: string, videoId: string): void
  export function lerUltimoVideo(canalId: string): string | null
  // PagerView ganha: replace: true (sempre) e status: string  // "Vídeo 8 de 51: <título>"
  ```

- [ ] **Passo 1: testes que falham** (`T/historico-a2-origem.test.ts`)
```ts
it('vindo da grade (canal=<id>, back=?fmt=longos): "vídeo 7 de 51 de Leo Khev (longos, do mais novo ao mais antigo)"', ...)
it('a frase leva o filtro, a ordenação, a direção e a busca que estavam ativos', ...)
it('vindo da aba Trocas (back=?tab=trocas): "vídeo 3 de 5 com trocas de Leo Khev (trocas dos últimos 30 dias, da mais recente à mais antiga)"', ...)
it('pos e tot contam a lista de origem mesmo com ids cortado em 100 vizinhos', ...)
it('origem que não dá para descrever: back inválido, pos/tot ausentes, pos > tot, pos que não bate com ids → frase genérica contando só ids', ...)
it('canal= de outro canal: ignora canal, pos e tot (o vídeo manda)', ...)
it('Anterior e Próximo levam canal=, back=, ids= e pos±1/tot adiante; nunca levam troca=', ...)
it('vindo do canal: o crumb "Canais" aponta para a lista de Canais sem o estado do canal; o item do canal aponta para a página com o estado (back)', ...)
it('lista de origem vazia (sem ids e sem lista reconstruível): pager null', ...)
it('origens antigas (Mudanças, Outliers, Insights, Canais sem canal=): frase e links iguais aos de hoje', ...)
```
`T/historico-a2-pager.test.tsx` (jsdom):
```ts
it('Anterior e Próximo usam replace (o histórico do navegador não cresce)', ...)
it('depois de trocar de vídeo o foco fica no botão usado e o status lê "Vídeo 8 de 51: <título>"', ...)
it('"[" e "]" andam só com o foco no título ou dentro do pager; em campo de texto e fora dali não fazem nada', ...)
it('Anterior ausente no primeiro e Próximo no último', ...)
it('o Histórico grava o último vídeo visto do canal; armazenamento que lança não quebra a tela', ...)
it('a página do canal, no Voltar, põe o foco no cartão do último vídeo visto e cresce n até incluí-lo; sem registro volta como hoje', ...)
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** No bloco `from === 'canais'` do view-model, o ramo `p.canal === vv.ch` usa `origemDoCanal`; os outros ramos ficam como estão. Em `canal-screen.tsx:224` e `trocas-model.ts:86`, acrescente `pos` e `tot` ao link. Antes de escrever, **confira e registre no relatório**: um vídeo "antigo" da grade do canal (fora dos acompanhados) existe em `obs.video(id)` do conjunto do site? Se não, o que o Histórico mostra ao abri-lo e o que o pager faz ao passar por ele (o filtro `obs.video(x)` de `qids` o descarta). Não conserte isso aqui: só relate com o caminho exato; o controlador decide. O `Link` do pager recebe `replace`. O foco depois da troca de vídeo: como o Next não remonta, guarde "qual botão foi usado" num `ref` e refoque num efeito que depende de `view.video?.id`.
- [ ] **Passo 4: rodar e ver passar**, mais `tsc` e a pasta inteira.
- [ ] **Passo 5: commit** — `feat: Historico: trilha e pager a partir da pagina do canal`.

---

### Tarefa 3: moldura só com a trilha, em todas as origens

**Arquivos:**
- Modificar: `C/video/[id]/page.tsx`, `C/_historico/view-model.ts` (sai `chromeNiche` e `nicheToast`), `C/_historico/historico-screen.tsx`, `C/_historico/pager.tsx` (o pager fica; a trilha passa para a moldura), `C/_chrome/trail-chrome.tsx` (só se precisar crescer), `C/_chrome/observatory-chrome.tsx` (extrai o hook), `C/_historico/historico.css`
- Criar: `C/_chrome/use-forja-refresh.ts`
- Teste: `T/historico-a2-moldura.test.tsx`; ajustar `T/historico-screen.test.tsx`, `T/historico-view-model.test.ts`, `T/chrome.test.tsx` (onde citarem a moldura do Histórico, o `nicheOverride` do Histórico ou o aviso de nicho)

**Interfaces:**
- Consome: `TrailChrome({ crumbs: Crumb[] })`, `view.crumbs` (`{ crumb, href, sub }`).
- Produz:
  ```ts
  // C/_chrome/use-forja-refresh.ts — o efeito de observatory-chrome.tsx:110-116, extraído sem mudar o intervalo
  /** Com pedido em andamento, chama router.refresh() a cada FORJA_REFRESH_MS; `paused` suspende. Devolve o instante do último refresh. */
  export function useForjaRefresh(active: boolean, paused?: boolean): { lastAt: number }
  ```

- [ ] **Passo 1: testes que falham** (`T/historico-a2-moldura.test.tsx`, jsdom)
```ts
it('a moldura do Histórico tem só a trilha: nenhuma aba de seção, nenhuma barra de nicho, nenhum botão de forja da moldura', ...)
it('a trilha é "Canais › <canal> › Histórico do vídeo" vindo do canal e "<origem> › <canal> › Histórico do vídeo" nas outras origens', ...)
it('quem chega de Mudanças, de Outliers e de Insights volta pelo primeiro item da trilha, com os filtros de back=', ...)
it('vídeo não encontrado: a mesma moldura, a trilha de volta e o cartão "Vídeo não encontrado"', ...)
it('vídeo de outro nicho: sem aviso de "Nicho mudou…" (o nicho aparece só ao lado do canal, no cabeçalho do vídeo)', ...)
it('com pedido da forja em andamento a tela continua se atualizando sozinha (useForjaRefresh ativo); sem pedido, não', ...)
it('os avisos (toasts) da tela continuam funcionando dentro da moldura nova', ...)
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** `page.tsx` passa a renderizar `<TrailChrome crumbs={[...]}>` com os itens de `view.crumbs` e "Histórico do vídeo" no fim; a leitura continua sendo `openObservatoryPage()` (o Histórico precisa do conjunto do site para o pager de Mudanças e de Outliers). `Crumbs` vira `Pager` (só o pager; a `nav` de trilha sai dele). O `nicheOverride` deixa de ser passado por esta rota; **não o apague de `chrome-server.tsx`**: `outliers/page.tsx:32` ainda usa. `chromeNiche` e `nicheToast` saem do tipo e os testes deles saem **no mesmo commit** (A2.6); o parâmetro `niche` continua valendo para os links de volta. Extraia o efeito de atualização da moldura antiga para `use-forja-refresh.ts` e chame-o nos dois lugares (D7): `T/chrome.test.tsx` fica verde sem mudar afirmação.
- [ ] **Passo 4: rodar e ver passar**, mais `tsc` e a pasta inteira.
- [ ] **Passo 5: commit** — `feat: Historico: moldura so com a trilha em todas as origens`.

---

### Tarefa 4: prova no navegador do que as Tarefas 1 a 3 mudaram (`historico-a2.spec.ts`)

**Arquivos:**
- Criar: `E/historico-a2.spec.ts`
- Modificar: `apps/web/e2e/fixtures/observatorio-seed*` só se faltar um caso (vídeo com troca há mais de 30 dias)

**Interfaces:**
- Consome: `ADMIN_STATE`, `ensureSeeded`, `seedIdsOf` de `E/fidelity.ts`; o padrão de `E/canal.spec.ts` (contêiner que rola, `medida()`, localizadores `:visible`).

- [ ] **Passo 1: escrever o spec.** Cada teste mede na moldura real, em 1440×900, tema escuro:
```ts
test('A2.6 a moldura tem só a trilha, vindo do canal, de Mudanças, de Outliers e de Insights', ...)
test('A2.4 sem range o gráfico mostra 30 dias; o seletor 7/30/90/tudo existe; range=tudo mostra o vídeo inteiro; recarregar mantém', ...)
test('A2.1 "Abrir nesta troca" na aba Trocas: a troca chega selecionada, com a linha de chegada, o anel na raia e o foco no marcador', ...)
test('A2.1 troca= inválido abre como hoje, sem erro no console e sem resposta 500', ...)
test('A2.2 Anterior e Próximo não fazem o histórico crescer: um Voltar devolve a página do canal', ...)
test('A2.2 Voltar devolve a aba, a rolagem e o foco no cartão do último vídeo visto', ...)
test('A2.2 a frase de posição descreve a origem (grade com filtro; aba Trocas)', ...)
test('A2.5 o gráfico e as três raias cabem sem rolar em 1440×900 (terminam em até 760 px)', ...)
test('sem rolagem horizontal da página em 1440, 1024, 768 e 390 px', ...)
```
- [ ] **Passo 2: rodar em fundo** (`npm run db:start`; depois o Playwright com saída em `$SCRATCH/pw-t4.txt`). Cada falha é defeito real ou do spec: defeito de código das Tarefas 1 a 3 é **consertado aqui**, com o teste unitário que faltava, e relatado um por um.
- [ ] **Passo 3: medidas** em `apps/web/test-results/historico-a2-medidas.txt`, copiadas para o relatório.
- [ ] **Passo 4: commit** — `test: prova em navegador do Historico (A2): moldura, periodo, chegada pela troca e pager`.

---

### Tarefa 5: visualizador de thumbnail (componente)

**Arquivos:**
- Criar: `C/_chrome/thumb-viewer/viewer-model.ts`, `C/_chrome/thumb-viewer/zoom.ts`, `C/_chrome/thumb-viewer/thumb-viewer.tsx`, `C/_chrome/thumb-viewer/thumb-viewer.css`
- Teste: `T/thumb-viewer-zoom.test.ts`, `T/thumb-viewer-model.test.ts`, `T/thumb-viewer.test.tsx` (jsdom)

**Interfaces:**
- Produz:
  ```ts
  // viewer-model.ts — puro
  export interface ViewerVersion {
    label: string                 // "Capa B"
    current: boolean
    /** Imagem arquivada (Blob). null = não arquivada. */
    archived: string | null
    /** Só na versão atual: o id do vídeo no YouTube, para pedir maxresdefault → sddefault → hqdefault → mqdefault. */
    youtubeId: string | null
    caption: string               // "Capa B (no ar): 05/10 14:22 até agora; no ar por 2 d 7 h"
    from: string; to: string      // para o quadro da versão não arquivada
  }
  export interface ViewerInput { title: string; versions: ViewerVersion[]; start: number }
  export const YT_VARIANTS = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault'] as const
  export function candidates(v: ViewerVersion): string[]          // URLs a tentar, na ordem; [] = sem imagem
  export function resolutionLine(file: string, w: number, h: number, fellBack: boolean, archived: boolean): string
  // zoom.ts — puro
  export interface View { scale: number; x: number; y: number }
  export function fit(img: { w: number; h: number }, box: { w: number; h: number }): View
  export function zoomAt(v: View, factor: number, at: { x: number; y: number }, img, box): View   // em torno do cursor, com limites
  export function pan(v: View, dx: number, dy: number, img, box): View
  // thumb-viewer.tsx — cliente
  export function ThumbViewer({ input, onClose }: { input: ViewerInput; onClose: () => void }): JSX.Element
  export function useThumbViewer(): { open: (input: ViewerInput, trigger: HTMLElement | null) => void; node: ReactNode }
  ```

- [ ] **Passo 1: testes que falham.**
`T/thumb-viewer-zoom.test.ts`: `fit` centraliza e nunca amplia além de 100%; `zoomAt` mantém o ponto sob o cursor; limites mínimo (ajustar) e máximo; `pan` não deixa a imagem sair da caixa; "100%" é um pixel da imagem por pixel da tela.
`T/thumb-viewer-model.test.ts`: versão atual pede as quatro resoluções na ordem; arquivada usa só a guardada; não arquivada devolve `[]`; a linha de resolução diz o arquivo e o tamanho medido, "o YouTube não tem versão maior deste vídeo" quando caiu, e o aviso de que ampliar não dá detalhe.
`T/thumb-viewer.test.tsx` (jsdom):
```ts
it('role="dialog", aria-modal, título "Thumbnail: <título>"; abre com o foco no título do diálogo', ...)
it('o foco fica preso: Tab e Shift+Tab giram dentro do diálogo; o fundo fica inerte', ...)
it('Esc fecha e o foco volta ao gatilho', ...)
it('uma versão só: sem Anterior/Próxima; "Comparar lado a lado" apagado com o motivo', ...)
it('várias versões: "Capa B · 2 de 2", Anterior e Próxima trocam a imagem e a legenda', ...)
it('versão não arquivada: quadro tracejado com o texto do spec 6.3; Baixar e Abrir original apagados (aria-disabled)', ...)
it('imagem que falha: tenta a resolução seguinte; se todas falharem, "A imagem não carregou."', ...)
it('teclas +, -, 0 e 1; com zoom as setas movem, sem zoom trocam de versão', ...)
it('clique duplo na imagem alterna Ajustar e 100%', ...)
it('"Comparar lado a lado": duas imagens, seletor "Comparar com", zoom apagado e o contador diz "sem zoom"', ...)
it('"Baixar" que o navegador recusa: abre em outra aba e o status diz para salvar por lá', ...)
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** Forma e medidas de `M/viewer.css` e `M/viewer.js`. O diálogo é montado por portal no `<body>` com `data-obs` (para herdar os tokens), `z-index: var(--z-modal)`; o fundo fica inerte com o atributo `inert` na raiz da tela (guardar e devolver o valor anterior). O gatilho é guardado no `open` e refocado no fechamento. A roda do mouse e a pinça usam `zoomAt`; registre o listener de `wheel` como não passivo. Para D10, meça e escreva no relatório: `fetch` de uma imagem do Blob e de `i.ytimg.com` a partir da página passa ou é recusado? `next.config.ts` só libera `i.ytimg.com` para `next/image`; confira se existe cabeçalho de política de conteúdo que barre `<img>` ou `fetch` (procure `Content-Security-Policy` em `apps/web`).
- [ ] **Passo 4: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 5: commit** — `feat: visualizador de thumbnail (dialogo com zoom, versoes e comparacao)`.

---

### Tarefa 6: os seis gatilhos do visualizador

**Arquivos:**
- Modificar: `C/_historico/view-model.ts` (monta `ViewerInput`), `C/_historico/historico-screen.tsx`, `C/_historico/thumb.tsx`, `C/_historico/compare.tsx`, `C/_historico/versions.tsx`, `C/_historico/lanes.tsx`, `C/_historico/views-chart.tsx` (legenda), `C/_historico/historico.css`, `C/_canal/view-model.ts` ou `videos-model.ts` e `trocas-model.ts` (versões de thumbnail por vídeo), `C/_canal/canal-screen.tsx`, `C/_canal/trocas.tsx`
- Teste: `T/historico-a2-viewer.test.tsx` (jsdom), `T/canal-viewer.test.tsx` (jsdom); acrescentar a `E/historico-a2.spec.ts`

**Interfaces:**
- Consome: `useThumbViewer`, `ViewerInput`, `ViewerVersion` (Tarefa 5).
- Produz: `HistoricoView.viewer: ViewerInput | null` (null sem nenhuma versão de thumbnail); `ChannelVideoView.viewer: ViewerInput | null`; `TrocaCard.viewer: ViewerInput | null`.

- [ ] **Passo 1: testes que falham.**
```ts
// T/historico-a2-viewer.test.tsx
it('gatilho 1: a thumbnail do cabeçalho abre o visualizador na versão atual', ...)
it('gatilho 2: as thumbnails de "Antes e depois" abrem na versão de cada lado', ...)
it('gatilho 3: as thumbnails dos cartões de "Thumbnails" abrem na versão do cartão; têm a lupa e role="button" com nome acessível', ...)
it('gatilho 4: clique duplo na miniatura da raia abre o visualizador; o clique simples continua indo ao cartão da versão', ...)
it('a legenda do gráfico diz que o clique duplo amplia', ...)
it('thumbnail sem imagem não vira botão quebrado: abre o visualizador no quadro explicativo', ...)
it('vídeo fora dos acompanhados: os gatilhos das versões funcionam igual', ...)
// T/canal-viewer.test.tsx
it('gatilho 6: a lupa do cartão e "Ampliar thumbnail" do menu abrem o visualizador na thumbnail atual, com as outras versões do vídeo', ...)
it('gatilho 6 na Lista: idem', ...)
it('gatilho 5: a lupa do cartão da aba Trocas abre o visualizador', ...)
it('vídeo antigo (forma enxuta, sem versões): abre só com a thumbnail atual', ...)
it('nenhum window.open de thumbnail sobra na página do canal', ...)
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** No Histórico, `viewer.versions` sai das versões de thumbnail que o view-model já monta (`VersionsView`): rótulo, período e tempo no ar são os dos cartões, sem recalcular. O clique simples e o duplo na raia: o simples continua imediato (não atrase com temporizador); o duplo abre o visualizador por cima. Na página do canal, `canal-screen.tsx:220` e `:377` trocam `window.open` pelo visualizador; o conjunto do canal já traz as versões (`L/load-channel.ts`).
- [ ] **Passo 4: prova no navegador:** acrescente a `E/historico-a2.spec.ts` os testes `A2.3 os gatilhos do Histórico abrem o visualizador e Esc devolve o foco`, `A2.3 a roda amplia em torno do cursor e arrastar move`, `A2.3 o diálogo fica acima de tudo e dentro da janela em 1440 e 390 px`, `A2.3 a lupa da grade do canal abre o visualizador`. Rode em fundo; conserte o que falhar.
- [ ] **Passo 5: rodar e ver passar** (pasta inteira, `tsc`).
- [ ] **Passo 6: commit** — `feat: visualizador de thumbnail nos seis gatilhos (Historico e pagina do canal)`.

---

### Tarefa 7: modelo do cartão novo da leitura da forja

**Arquivos:**
- Criar: `C/_historico/forja-card-model.ts`
- Modificar: `C/_historico/view-model.ts` (`forjaOf` passa a devolver também `forjaCard2`; o `HistForjaCard` de hoje fica até a Tarefa 8)
- Teste: `T/historico-a2-forja-model.test.ts` (usa `T/forja-scenarios.ts` e `T/forja-scenario-readings.ts`)

**Interfaces:**
- Consome: `obs.forja.session.current(null, { type: 'leitura-video', video })`, `buildForjaView`, `forjaReadingView`, `failKindOf` e os estados de `L/forja/states.ts:33`, `obs.forja.since`, `obs.forja.quotaFor`.
- Produz:
  ```ts
  export type Situacao = 'aguardando' | 'atrasado' | 'pronta' | 'desatualizada' | 'precisa-de-voce' | 'nao-deu'
  export type EtapaId = 'fila' | 'escrevendo' | 'pronta'
  export interface EtapaView { id: EtapaId; label: 'Na fila' | 'Escrevendo' | 'Pronta'; estado: 'feita' | 'atual' | 'atrasada' | 'parou' | 'futura'; texto: string }
  export interface LeituraView { id: string; selo: string; seloInfo: string; leu: string | null; lead: string; itens: Array<{ texto: string; refs: Array<{ n: number; href: string; label: string }> }>; doSite: string[]; rotulo: string | null }
  export interface ForjaCardView {
    /** null = nenhum pedido e nenhuma leitura. */
    situacao: Situacao | null
    frase: string | null                       // a frase da tabela 7.2
    etapas: EtapaView[] | null                 // só com pedido em andamento, ou parado em "Não deu"
    andamento: string | null                   // "Pedido feito há 16 min, às 21:59. …Pode sair desta página: o pedido continua."
    cancelar: boolean
    acoes: Array<{ id: 'ver-trocas' | 'sincronizar'; label: string; href: string }>
    explicacao: { aberta: boolean; texto: string }        // "A forja é um computador nosso…"; recolhe depois da primeira leitura publicada
    leitura: LeituraView | null; anterior: LeituraView | null
    botao: { label: string; habilitado: boolean; motivo: string | null }   // o botão DO CARTÃO
    vazio: string | null                       // "Ainda não há leitura deste vídeo. Ninguém pediu uma até hoje."
    excluido: string | null; bloqueado: { text: string; title: string; href: string } | null
    /** O que o site diz sobre este título pela leitura de padrões do nicho (o bloco "niche" de hoje): não se perde. */
    doNicho: HistForjaCard['niche']
  }
  export function buildForjaCard(obs: Observatory, v: ObsVideo, ch: ObsChannel): ForjaCardView | null   // null para canal próprio
  /** O rótulo e o comportamento do botão do CABEÇALHO, por situação (spec 6.5). */
  export interface HeaderAskView { label: string; modo: 'pedir' | 'so-rola' | 'apagado'; frase: string | null }
  export function headerAsk(card: ForjaCardView, forja: ForjaView): HeaderAskView
  ```

- [ ] **Passo 1: testes que falham** — um por linha da tabela 7.2 e da tabela 7.4, com a frase do spec letra por letra:
```ts
it.each(['na fila', 'trabalhando', 'nova tentativa', 'liberado pelo vigia'])('%s → situação "aguardando" com a frase e a etapa certas', ...)
it('atrasado e sem máquina → "Aguardando, com atraso", etapa Na fila em estado "atrasada"', ...)
it('publicado → "Pronta: leitura publicada às …", sem etapas', ...)
it('publicado com troca ou vídeo novo depois → "Pronta, mas desatualizada: …" e a ação "Ver as N trocas" que abre a aba Trocas do canal', ...)
it('recusado (dado velho) → "Precisa de você: …", sem etapas, ação "Sincronizar este canal"', ...)
it('falhou por travamento → "Não deu: o pedido travou 3 vezes…" e a etapa Escrevendo "parou aqui"', ...)
it('falhou por números que não batem e leitura sem evidências → "Escrevendo, parou aqui, ao conferir os números"', ...)
it('sem pedido e sem leitura: vazio com a frase do spec, etapas null, botão do cartão aceso', ...)
it('apaga o estado: sem pedido não há etapa (etapas === null) mesmo havendo leitura antiga', ...)
it('"Leu N vídeos e M trocas, dados de dd/mm hh:mm" sai do que foi enviado; sem esse dado o campo é null, nunca "Leu 0 vídeos"', ...)
it('selo único com "em treino" dentro; a frase do ⓘ é a do spec 7.1', ...)
it('leitura sem efeito medido: a leitura é mostrada como veio (o site não reescreve)', ...)
it('índices: só quando a leitura traz evidência por item; sem ela, refs vazio', ...)
it('limite do dia usado: botão do cartão apagado com "Já houve uma leitura deste vídeo hoje. Libera amanhã às 00:00."', ...)
it('as palavras "cota", "vigia", "validador" e "conferência" não aparecem em nenhum texto do cartão', ...)
it('headerAsk: livre → "Pedir leitura à forja" (pedir); em andamento → "Leitura em andamento: ver" (só rola); pronta → "Ver a leitura" (só rola); depois de Não deu → "Pedir leitura à forja de novo"; limite do dia → "Ver a leitura" com a frase', ...)
it('canal próprio: null', ...)
it('o bloco do nicho ("o que a leitura de padrões diz sobre este título") continua quando não há leitura do vídeo', ...)
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** Antes de escrever, leia `C/_historico/view-model.ts` (função `forjaOf`), `C/_chrome/forja-view-model.ts` (linhas 100 a 380) e `L/forja/states.ts` (33, 85 a 100, 177 a 179). **Reaproveite as frases que o motor já produz** (`sc.statusText`, `quota.text`, `machine.text`) onde elas dizem o mesmo que a tabela 7.2; onde o spec pede outra redação, a frase nova mora aqui e o teste a fixa. Etapas pelo mapa de 7.4 e D6. Registre no relatório (D11) o que o formato da leitura guardada traz de evidência por item, com um exemplo de `T/forja-scenario-readings.ts`.
- [ ] **Passo 4: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 5: commit** — `feat: Historico: modelo do cartao novo da leitura da forja (situacoes e etapas)`.

---

### Tarefa 8: cartão novo na tela e botão do cabeçalho que rola e pede

**Arquivos:**
- Criar: `C/_historico/forja-card.tsx`, `C/_historico/forja-card.css` (ou bloco em `historico.css`, seguindo o que o arquivo já faz)
- Modificar: `C/_historico/historico-screen.tsx`, `C/_historico/view-model.ts` (sai `HistForjaCard`; `forjaCard2` vira `forjaCard`), `C/video/[id]/page.tsx` (ação de sincronizar o canal, se o cartão a oferecer)
- Apagar: `C/_historico/video-reading.tsx`
- Teste: `T/historico-a2-forja-card.test.tsx` (jsdom); ajustar `T/forja-ui.test.tsx` e `T/historico-screen.test.tsx` onde afirmam sobre o cartão antigo; acrescentar a `E/historico-a2.spec.ts`

**Interfaces:**
- Consome: `ForjaCardView`, `HeaderAskView`, `headerAsk` (Tarefa 7); `ForjaAsk`, `ForjaCancel` (`C/_chrome/forja-view-model.ts`); `useForjaRefresh` (Tarefa 3); `Popover`/`HoverTip`.
- Produz: `ForjaCard({ card, forja, onAsk, onCancel, refresh })` e `HeaderAskButton({ ask, forja, onAsk, cardRef })`.

- [ ] **Passo 1: testes que falham** (`T/historico-a2-forja-card.test.tsx`)
```ts
it('o cartão "Leitura da forja" fica depois de "Antes e depois" e antes das versões', ...)
it('um selo só, com "em treino"; o ⓘ abre a frase do spec', ...)
it('três etapas na ordem Na fila, Escrevendo, Pronta; a atual tem "em andamento" e as feitas têm o visto (texto, não só cor)', ...)
it('com pedido em andamento não há botão de pedir no cartão; há "Cancelar pedido" só na fila', ...)
it('"Pausar atualização automática" suspende o refresh e vira "Retomar atualização automática"; "Tela atualizada há N min" é texto', ...)
it('a situação é anunciada (aria-live polite) só quando muda', ...)
it('"O que é a forja?" aberto antes da primeira leitura e recolhido depois', ...)
it('evidências numeradas são links; "Do site" fica fora do selo', ...)
it('"Pronta, mas desatualizada": faixa âmbar com ícone próprio e as duas ações', ...)
it('botão do cabeçalho, livre: UM clique faz UMA chamada de onAsk("leitura-video", nicho, vídeo), rola até o cartão e põe o foco no título do cartão', ...)
it('clique duplo e clique durante "Pedindo…" (aria-busy): continua uma chamada só', ...)
it('com pedido em andamento o botão do cabeçalho diz "Leitura em andamento: ver" e só rola (zero chamadas)', ...)
it('com leitura pronta diz "Ver a leitura" e só rola', ...)
it('servidor recusa ou a ação lança: o botão volta a "Pedir leitura à forja" e diz o motivo; nada de etapa inventada', ...)
it('apaga o estado: view sem pedido → nenhuma etapa no DOM', ...)
it('o botão do cartão envia o mesmo pedido que o do cabeçalho', ...)
it('o status lê "A leitura da forja já tem uma situação; ela está logo abaixo." quando já existe situação', ...)
it('prefers-reduced-motion: o ponto não pulsa e as palavras continuam', ...)
it('canal próprio e vídeo fora dos acompanhados: como hoje (sem cartão / botão apagado com o motivo)', ...)
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** Forma de `M/forja.js` e `M/forja-etapas.css`; as classes de etapa entram com prefixo próprio em CSS novo, sem `color-mix`. O rolar usa o contêiner que rola (`main`) e respeita movimento reduzido; o foco vai para o `h3` do cartão (`tabIndex={-1}`), buscado por `ref`. Depois do pedido aceito: `router.refresh()`; a etapa vem do servidor, nunca de estado otimista. Os testes que afirmavam sobre o cartão antigo mudam no mesmo commit; cada um listado no relatório com o que mudou e por quê (A2.5: o cartão é a única parte da tela cuja expectativa pode mudar aqui).
- [ ] **Passo 4: prova no navegador:** acrescente a `E/historico-a2.spec.ts`: `A2.8 um clique no botão do cabeçalho faz uma requisição só, rola e foca o cartão` (a ação é interceptada e respondida no navegador: **nada é escrito na fila**), `A2.7 o cartão sem leitura mostra a frase de vazio`, `A2.7 as etapas não dependem só de cor (captura em escala de cinza)`. Rode em fundo; conserte o que falhar.
- [ ] **Passo 5: rodar e ver passar** (pasta inteira, `tsc`).
- [ ] **Passo 6: commit** — `feat: Historico: cartao novo da leitura da forja e botao do cabecalho que rola e pede`.

---

### Tarefa 9: validação autenticada, suíte inteira e fecho

**Arquivos:**
- Modificar: `docs/superpowers/plans/2026-10-08-proximos-passos.md` (seção nova "3h", no formato da 3g), o ledger

- [ ] **Passo 1: suíte inteira, typecheck e build**, em fundo, com saída em arquivo: `cd apps/web && npx vitest run > $SCRATCH/vitest-all.txt 2>&1`; `npx tsc --noEmit -p . > $SCRATCH/tsc.txt 2>&1`; `npm run build:web > $SCRATCH/build.txt 2>&1` (a partir da raiz). No contexto, só as falhas.
- [ ] **Passo 2: Playwright** `E/historico-a2.spec.ts`, `E/canal.spec.ts` e `E/flutuantes.spec.ts`, em fundo.
- [ ] **Passo 3: validação logada no CMS local** (`docs/ops/runbook-cms-e2e-local.md`), em navegador, 1440 px, tema escuro: abrir o Histórico pelas **quatro origens** (Canais → canal → vídeo; aba Trocas → "Abrir nesta troca"; Mudanças; Outliers; Insights) e conferir, **item a item, a tabela do spec 6.1** (trilha e pager, cabeçalho, gráfico e raias, resumo por imagem, "Antes e depois", leitura da forja, as três seções de versões, os estados). Console sem erro, nenhuma resposta 500. Repetir o roteiro curto em 390 px e no tema claro. Capturas em `M/shots/a2/`, veredito em texto no relatório.
- [ ] **Passo 4: registrar** na seção 3h do roteiro: o que foi medido, as decisões D1 a D11 que o dono pode reverter, o que nenhum agente conferiu (Opera, leitor de tela, zoom alto, toque real) e os achados menores adiados.
- [ ] **Passo 5: commit** — `docs: roteiro 3h, fase A2 das telas`.

## Revisão própria (feita ao escrever)

- **Cobertura do spec:** A2.1 → Tarefas 1 e 4; A2.2 → Tarefas 2 e 4; A2.3 → Tarefas 5 e 6; A2.4 → Tarefas 1 e 4; A2.5 → restrição global, Tarefa 1 (passo 4), Tarefa 8 (passo 3) e Tarefa 9 (passo 3); A2.6 → Tarefas 3 e 4; A2.7 → Tarefas 7 e 8; A2.8 → Tarefa 8. Seção 6.3, gatilhos 5 e 6 (página do canal) → Tarefa 6. Seção 7.4, "Pausar atualização automática" → Tarefas 3 e 8.
- **Fora desta fase, de propósito:** leitura por canal (7.3), vídeo de canal próprio (seção 17, A4), encolher `ids=` (D4), cartão novo na aba Leitura do canal (D9).
- **Nomes entre tarefas:** `arrival` (T1) é lido pela tela na T1 e pelo spec na T4; `pos`/`tot` nascem em `link.historico` (T1) e são usados na T2; `useForjaRefresh` (T3) é consumido na T8; `ViewerInput` (T5) é consumido na T6; `ForjaCardView` e `headerAsk` (T7) são consumidos na T8.
- **Risco maior:** a Tarefa 1 muda o padrão de uma tela aberta por quatro origens; o passo 4 dela é o que segura a regra "nada se perde". O segundo é a Tarefa 8, que apaga um componente em produção.
