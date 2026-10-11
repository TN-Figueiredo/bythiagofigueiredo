# Telas do Observatório, fase A3 (lista de Canais e comparação entre dois canais) — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development. Um implementador por vez,
> Sonnet, `effort: high` (desce para `medium` quando as revisões voltarem limpas; nunca `xhigh` nem `max`). Revisão
> final do lote em Opus, `high`. Os passos usam caixas (`- [ ]`).

**Objetivo:** a lista de Canais ganha o filtro de formato "Todos | Longos | Shorts", a posição de cada canal (no nicho ou geral), o bloco "Seus canais" com a frase de posição, o canal próprio na posição dele e a linha presa no pé; nasce a tela `comparar?a=&b=`, com quatro entradas ("Comparar" na linha e no cartão, "Comparar com o meu canal" no cabeçalho do concorrente, e o atalho "Meu canal" nas duas molduras). **As colunas da lista continuam as de produção** (pergunta 6). Onde falta dado do canal próprio a tela diz "não medido" com o motivo, nunca zero.

**Arquitetura:** a lista continua de servidor (`C/page.tsx`, conjunto do site), e `buildCanaisView` passa a devolver uma lista única ordenada (com posição) no lugar dos grupos por nicho e do grupo fixo dos canais próprios. A comparação é uma rota nova de servidor (`C/comparar/page.tsx`) que lê o **conjunto do site** (a posição precisa de todos os canais) e entrega ao navegador um pacote serializável com os 13 números de **todos** os canais; o par (relações, Leitura rápida, régua, rodapés) é calculado por funções puras **no navegador**, para trocar o seletor sem rede. O atalho "Meu canal" é um componente cliente compartilhado, alimentado por uma lista pequena de canais próprios: derivada do motor nas telas que leem o site, lida por uma consulta leve na página do canal (cujo conjunto LANÇA em `ownChannels`).

**Stack:** Next 16, React 19, TypeScript estrito, Vitest (happy-dom; jsdom onde indicado), Playwright (projeto `observatorio`, banco local).

**Spec:** `docs/superpowers/specs/2026-10-07-observatorio-canal-video-ui-design.md` (v9): emendas 29, 30, 33, 44 e 45; seção 3; seção 4.2 "A3"; seções 10, 11 (linhas 3, 16 a 21), 15 (inteira), 18 (inteira), 19 e 20. Quem executa lê o spec junto com a tarefa: **todo texto de tela citado aqui está no spec e vale o do spec, letra por letra.** Onde o corpo e uma emenda discordarem, vale a emenda; entre duas emendas, a mais recente (a 45 corrige 15.4 e a seção 18).

**Fonte visual (mockup aprovado em 10/10):** `docs/superpowers/mockups/2026-10-07-pagina-canal/{canais.html,canais.js,canais.css,comparar.html,comparar.js,comparar.css,regua.js,regua.css,meu-canal.js,meu-canal.css}`. Medidas, espaçamento e ordem saem dali. O mockup tem dados próprios, seis colunas que a lista de produção NÃO terá (D1) e textos de rodadas antigas (D12): copia-se a forma, nunca o dado nem a coluna.

**Ledger:** `.superpowers/sdd/2026-10-11-telas-a3-canais-comparacao-plan/progress.md` (criar na Tarefa 1). Relatório de cada tarefa em `task-N-report.md` na mesma pasta; a resposta do agente ao controlador tem até 10 linhas.

Abreviações de caminho:
- `C/` = `apps/web/src/app/cms/(authed)/youtube/competitors/`
- `L/` = `apps/web/src/lib/youtube/observatorio/`
- `T/` = `apps/web/test/youtube/observatorio/`
- `E/` = `apps/web/e2e/tests/cms/observatorio/`
- `M/` = `docs/superpowers/mockups/2026-10-07-pagina-canal/`

## Restrições globais

- Trabalho em `staging`, sem branch nem worktree. Nunca `git stash`, `git reset`, `--no-verify`, `pkill`. Commit por caminho explícito (`git add <caminhos>` e `git commit -- <caminhos>`). **Nunca** commitar `apps/web/next-env.d.ts` nem `apps/web/tsconfig.json`. **Sem push**: push e promoção são do controlador.
- **Nenhuma migration, nenhuma tabela nova, nenhuma escrita de dados.** A A3 só lê o que a produção já tem. Nenhuma tarefa lê `yt_own_*` (é da A4).
- Nenhum `color-mix()` em CSS. Cores em hex ou `rgba` literal; as cores dos lados e do "não medido" são os tokens de `C/_chrome/tokens-telas.css` (`--lado-o`, `--lado-b`, `--lado-n`, `--nm`, `--nm-line`, `--nm-bg`, classe `.obs-ch-nm`). Nenhum `z-index` numérico em regra nova: só `var(--z-*)` de `C/_chrome/camadas.css` (a linha presa usa `--z-grudado`). As regras antigas de `canais.css` com número ficam como estão.
- **Nulo nunca vira zero.** Dado ausente é `null` no tipo e uma frase na tela, com o motivo. Zero medido é "0". Este sistema falha em verde: pergunte "o que aparece quando o dado não existe?" antes de "quando dá erro?". Nenhuma ordenação usa sentinela numérica (`-1`, `-99`) para "sem medida": o valor é `null` e a linha vai para o fim.
- **Cor nunca é o único sinal:** todo lado tem letra (A/B) e chip; todo "não medido" tem a hachura e a palavra; ▲ ＝ ● têm texto equivalente para leitor de tela.
- Toda dica, popover e menu usa `Popover` ou `HoverTip` de `C/_chrome/flut/flut.tsx` (nunca um balão filho de célula, cartão ou régua).
- `strict: true`, nunca `any`. Arquivos em kebab-case. Corpo de texto mínimo de 12 px na interface nova. No máximo um botão preenchido por vista (nenhuma destas telas precisa de um novo).
- **Palavras internas não aparecem em tela:** "pack", "pacote" (fora do cartão da forja, onde o spec 18.8 usa "pacote novo"), "dataset", "conjunto do site", "motor", "sentinela", "R73", "escala √", "ranking". Cada modelo tem um teste que varre todos os textos.
- **Escolha de frase por estado é exaustiva:** `switch` com `default` que atribui a `never`. Vale para o motivo de "não medido", o tipo de relação e o conjunto da posição.
- **Invariante testado sobre todos os cenários:** frase que promete uma ação ("Ir até a linha", "Abrir meu canal", "Comparar") só aparece com a ação habilitada e com destino válido; frase de posição só aparece com valor medido. Os testes percorrem todas as ordenações × formatos × nichos do fixture, não um caso.
- Nunca passar `next/link` (nem componente importado num Server Component) como prop para componente cliente; server actions chegam por props. Do servidor para o cliente passam só dados simples (nenhuma função).
- **Next 16 não remonta componente cliente quando só a query muda:** estado em `useState(inicial)` fica velho. Todo estado que nasce da URL (formato, par `a`/`b`) é ressincronizado por valor, no modelo de `C/_canal/use-canal-state.ts`. E a árvore anterior da rota fica escondida no DOM depois do Voltar: buscar elemento por `ref` da raiz, nunca `document.getElementById`/`document.querySelector` global; nos specs de Playwright, localizadores com `:visible`.
- A casca do CMS rola em `main`, não na janela (ver `C/_canal/use-rolagem-ao-voltar.ts` e o `__sc()` de `E/canal.spec.ts`). `IntersectionObserver`, "Ir até a linha" e "Voltar ao topo" usam esse contêiner.
- `localStorage` e `sessionStorage` sempre em try/catch; sem eles a tela funciona com o padrão.
- Teste que muda de expectativa (grupo "Seus canais" fixo no topo, grupos por nicho, `fmt`, "Comparar com o meu canal não existe") vai no **mesmo commit** da mudança de código, e cada um é listado no relatório com o porquê.
- Fixture novo de teste segue `T/canal-fixture.ts`: o conjunto base é lido **uma vez por arquivo** e guardado (o CI tem limite de 60 s por executor do Vitest).
- Playwright: gesto de mouse de verdade (`page.mouse.move/down/up`, `page.keyboard`), nunca `locator.dblclick()` nem `dispatchEvent`. Estas telas não têm ação de escrita nova; mesmo assim **todo spec da A3 intercepta TODO `POST` com cabeçalho `next-action` e falha se algum escapar** (a lista tem "Sincronizar", "Remover", "Adicionar" a um clique de distância).
- Horários em São Paulo (`obs.date`). Datas em `<time datetime>`.
- `$SCRATCH` = o diretório de rascunho da sessão, que o controlador informa no brief.
- Subagente nunca espera mais de 4 min parado: suíte, build e Playwright vão em fundo, com saída em arquivo; no contexto entram só as falhas.
- Suíte de uma pasta: `cd apps/web && npx vitest run test/youtube/observatorio > $SCRATCH/vitest.txt 2>&1`. Typecheck: `cd apps/web && npx tsc --noEmit -p . > $SCRATCH/tsc.txt 2>&1`.
- E2E local: `npm run db:start` (nunca `db:reset`), depois `cd apps/web && npx playwright test --project=observatorio <spec> > $SCRATCH/pw.txt 2>&1`. O servidor sobe sozinho na porta 3099.
- Navegador (DevTools/Chrome MCP) só em subagente Sonnet; capturas vão para arquivo, o veredito volta em texto.
- Os e2e antigos de fidelidade (`E/canais.spec.ts` e os que comparam DOM com os mockups de 02/10) estão aposentados: não rodar, não consertar.
- **Canal próprio continua sem página nesta fase** (A4). Todo link para "o meu canal" passa por `ownChannelHref` (Tarefa 2), que hoje devolve o painel lateral (`link.canais({ channel })`); a A4 troca uma linha.

## Decisões deste plano (o spec deixou para o plano; o dono pode reverter)

| # | Decisão | Por quê | Custo se errado |
|---|---|---|---|
| D1 | **A3.4, colunas: ficam as de produção** (Ritmo, Views/dia, Outliers, Trocas, Crescimento, Sincronização; `C/_canais/channel-table.tsx:15-21`), mais uma coluna estreita de posição à esquerda e "Com o meu canal" à direita; o menu ⋯ da linha fica. As quatro colunas novas do mockup (por mil, mediana, longos em 90 d, acompanhados) existem só na comparação | pergunta 6, respondida (emenda 44) | a lista aprovada no mockup difere da construída; trocar colunas é tarefa própria |
| D2 | **A lista vira uma só, sem grupos por nicho, em qualquer filtro de nicho.** Hoje "Todos" desenha um grupo por nicho (`C/_canais/view-model.ts:367-379`); a emenda 45 exige ordenar e numerar todos juntos. O nicho continua em cada linha (o seletor). Os avisos por grupo ("2 com erro de sincronização") saem; "Ver só canais com problema (N)" continua | emenda 45; uma posição "7º" dentro de um grupo de 5 seria ilegível | quem usava o agrupamento perde a separação visual; voltar é reintroduzir `groups` |
| D3 | **Posição escrita só em duas ordenações da lista: Inscritos e Views/dia** (esta nas duas escalas, absoluta e por mil). Em Ritmo, Outliers, Trocas e Crescimento a linha fica no lugar dela na ordem, sem ordinal, e o bloco diz a frase de D4 | emenda 45 (d): posição só para os seis números; destes, a lista mantida por D1 só ordena por dois | o bloco "Seus canais" fala de posição em poucas ordenações; ampliar é acrescentar a chave em `POSICIONADAS` |
| D4 | **Frases novas, que o spec não traz letra por letra** (o controlador confere antes do push): (a) posição com o conjunto: "14º de 14 em Viagem, em inscritos, com 1,16 mil." e "40º de 75 no geral, em inscritos, com 1,16 mil." (vírgula entre o conjunto e o número, para não repetir "em"); (b) ordenação sem posição: "Sem posição escrita nesta ordenação: ela existe em Inscritos e em Views/dia."; (c) comparação entre nichos, subtítulo: "Dois canais de nichos diferentes, lado a lado, com o mesmo peso. A régua e as posições são as gerais."; (d) site com menos de dois canais: "Para comparar é preciso ter dois canais."; (e) cartão da forja sem canal próprio no par: selo "ainda não disponível" e "A leitura de comparação é um pacote novo para a forja e ainda não existe." | emenda 45 (c) exige o conjunto em toda frase; 18.8 pede o estado sem dar a frase | trocar texto é uma linha por frase |
| D5 | **`fmt` da lista: `todos \| longos \| shorts`, sempre na URL.** `fmt=short` vira `shorts` e `fmt=long` vira `longos` (links antigos). Sem `fmt` na URL o servidor desenha Longos; no navegador, um efeito lê `localStorage` (`obs:canais-fmt`) e grava `fmt=` com `router.replace` (se o lembrado difere de Longos a tela troca uma vez) | o servidor não vê `localStorage`; o spec 15.3 pede URL sempre e lembrança | um lampejo de Longos para quem lembra outro formato; some se a lembrança for para cookie |
| D6 | **"Todos" leva o rótulo para o cabeçalho da coluna** ("longos em cima, Shorts embaixo") e cada célula que depende de formato mostra duas linhas; o rótulo "longos"/"Shorts" fica só para leitor de tela na tabela e **visível** nos cartões (não há cabeçalho de coluna) e quando falta um formato ("sem Shorts"). Outliers em "Todos" mostra duas contagens com o maior múltiplo, sem thumbnail | spec 15.3 ("o plano leva o rótulo para o cabeçalho") e seção 20, item 1 | se o dono achar ambíguo, o rótulo volta para a célula (CSS e uma flag) |
| D7 | **Vídeo com `is_short` nulo continua contado como longo pelo motor** (`ObsVideo.isShort` nulo mantém `fmt: 'long'`, `L/types.ts`), como já faz a página do canal (A1.2 exige números iguais aos de Canais). A lista mostra na linha o aviso "formato não confirmado (N)" com a dica dizendo que entram como longos até a confirmação | 15.5 diz "fora de longos e de Shorts", mas tirar do motor mudaria views/dia e múltiplo em todas as telas | números de longos levemente contaminados em canais com nulos; mudar o motor é tarefa própria com paridade |
| D8 | **O formato do canal próprio continua deduzido** (duração e "#Shorts", `L/load.ts:158`); usar `yt_own_video_meta_daily.is_short` (pergunta 7) **fica para a A4**, junto dos outros leitores do canal próprio | a A3 não mexe no carregador; a A4 já cria os leitores das tabelas da coleta (emenda 46) | Short próprio de 61 a 180 s sem "#Shorts" aparece como longo em "Todos" até a A4 |
| D9 | **"Longos em 90 dias" usa 90 dias corridos** (`ageDays <= 90`, como `recent()` em `C/_canal/header-model.ts:49`), contando todo longo guardado com data, acompanhado ou não. O ritmo continua em 13 semanas | o spec 18.9 mandou conferir; a linha diz "90 dias" e o cabeçalho do canal já usa 90 | 1 dia de diferença para a janela do ritmo (91 d) |
| D10 | **"Longos acompanhados" = `tracked && fmt === 'long'`**, não `channelStats().tracked`, que soma todos os formatos (`L/channels.ts:155`); **"Vídeos acima de 2×" é só dos longos** (`outliers90` de `'long'`, como o cabeçalho do canal, `header-model.ts:109-113`); **"Trocas" conta título e thumbnail** (`header-model.ts:118`), não `changes30`, que inclui descrição | 18.9 aponta campos que não medem o que a linha diz | números diferentes dos do mockup; cada base está escrita na linha |
| D11 | **O conjunto da posição:** com filtro de nicho (lista) ou com os dois canais no mesmo nicho (comparação), os canais daquele nicho, próprios incluídos; em "Todos" ou com nichos diferentes ou algum sem nicho, todos os canais do site. Canal sem o valor fica fora e o "de N" encolhe. Posição = 1 + quantos têm valor maior; empate dito. Busca e "só com problema" não mudam a posição | emenda 45 e 15.4 | nenhum; é a regra escrita |
| D12 | **Onde o mockup se contradiz, vale a rodada 12:** a relação sempre nomeia o maior (`comparar.js`, `relacao()`), então a coluna se chama "Relação" (o mockup ainda diz "B em relação a A"), o subtítulo perde "Todas as relações partem do lado A." e a forma "8,7% dos inscritos de…" (spec 18.4) **não é feita**: abaixo de 2× vale "+N%" | 18.4 pede "sempre nomeando o maior" e a forma "8,7% dos…" só existe partindo do lado A | uma frase a mais em `relacao` |
| D13 | **Uma só dica "Como ler esta tabela" (ⓘ no título)**, que lista as linhas em escala comprimida; nenhum "escala √" sob a régua e nenhum ⓘ por linha | seção 20, itens 2 e 4 (texto de engenheiro; paradas de Tab demais) | o dono queria por linha: 13 botões a mais |
| D14 | **A comparação lê o conjunto do site** (`openObservatoryPage`) e manda ao navegador os números de todos os canais; trocar o seletor não vai ao servidor | 18.1 e seção 10 (menos de 100 ms, sem recarregar); a posição precisa de todos | pacote maior; a Tarefa 8 mede e registra (teto: 250 KB com gzip para 75 canais) |
| D15 | **O atalho "Meu canal" na página do canal usa uma leitura leve nova** (`youtube_channels` + contagem de `youtube_videos` do site, cliente de serviço depois da guarda de acesso), porque o conjunto de um canal lança em `ownChannels` (`L/insights.ts:142`). Nas outras telas a lista sai do motor | não carregar o site inteiro só para um menu (decisão da A1) | duas origens para a mesma lista; um teste de paridade as mantém iguais |
| D16 | **Com mais de um canal próprio, "o meu canal" de "Comparar" e do rótulo do atalho é o primeiro com vídeos na ordem do motor** (inscritos, maior primeiro; `ownChannels`). A linha presa no pé fala desse mesmo canal | o mockup usa o primeiro; a comparação deixa trocar pelo seletor | o dono queria escolher o principal: vira preferência salva |
| D17 | **"Só o seu canal mede" não é desenhado na A3** (18.6: depende do leitor da A4). Um teste afirma que o cartão não existe em nenhum par | A4.9 | nenhum |
| D18 | **Voltar da comparação devolve o foco ao gatilho** por `sessionStorage` (`obs:gatilho-comparar`, o id do canal e o lugar), lido pela lista e pela página do canal no Voltar; sem ele, a página volta como hoje | seção 3 ("com foco no gatilho"); o navegador restaura a rolagem, não o foco | o foco fica onde o navegador deixar |
| D19 | **Os cinco mais vistos abrem o Histórico do vídeo** (`link.historico(id, { from: 'canais' })`) também para vídeo próprio, que abre como abre hoje até a A4 | 18.7 ("cada vídeo abre a tela dele"); a tela do vídeo próprio é A4.6 | nenhum; a A4 troca o destino |
| D20 | **O corte do painel lateral de concorrente (Tarefa 12) é a única tarefa que pode ser pulada** sem afetar nenhum aceite; se o controlador pular, a A4 corta o painel inteiro quando o canal próprio ganhar página | pendência da A1 (roteiro 3g); o painel morre de vez na A4 | código morto e uns 25 testes por mais uma fase |

## Fica esperando o dono

Nada da A3 depende de migration. Ficam fora, com o porquê, e aparecem na tela como "não medido" com o motivo: views por dia e views por dia por mil do canal próprio (leitor de `yt_own_video_daily`, A4.1); impressões e cliques ("Só o seu canal mede", A4.9); inscritos em 30 dias do canal próprio (contagem diária de inscritos, lote L5, que **exige tabela nova**: não é planejado aqui); trocas do canal próprio ("ficam no A/B Lab"). O pedido real de leitura de comparação à forja é pacote novo (L4).

## Foco de revisão

Entradas que o spec implica e que mais mordem quem usa; cada linha tem o teste na tarefa dona do código.

1. **`fmt`, `a` e `b` com valor ruim** (`fmt=abc`, `fmt=` vazio, `fmt=short` antigo, `a` igual a `b`, `a=lixo`, `b` de canal removido, site com um canal só): a tela abre no padrão, sem mensagem de erro e sem 500; a URL é reescrita para o estado válido. → Tarefas 1 e 9.
2. **Canal sem medida na coluna ordenada** (canal próprio sem views por dia; concorrente aguardando o 2º registro; canal em primeira sincronização; inscritos ocultos; canal próprio sem vídeos; sem Shorts no filtro Shorts): vai para o fim sob "Ainda sem medida para ordenar (N)", **em qualquer direção**, sem ordinal, e o bloco diz o motivo; nunca "0º", nunca posição calculada sobre `-1`. → Tarefa 2.
3. **Posição lida no conjunto errado** (nicho escolhido × "Todos"; canal próprio sem nicho; busca ativa; "só com problema"; dois canais de nichos diferentes na comparação): toda frase diz o conjunto ("em Viagem", "no geral"), o "de N" é o de quem tem o valor, e a busca não renumera. → Tarefas 2 e 6.
4. **Zero, nulo e empate na comparação** (um lado em zero; os dois em zero; um lado nulo; os dois nulos; valores iguais; diferença de 9,9% e de 10%; razão de 1,99× e de 2×): zero em linguagem de gente, nulo com hachura e motivo e sem relação, linha com os dois nulos fora da tabela e contada no rodapé, nunca "Infinity×" nem "NaN%". → Tarefa 6.
5. **Site sem canal próprio, com um, ou com dois (um sem vídeos):** sem canal próprio não há bloco, linha presa, coluna "Com o meu canal", atalho nem botão no cabeçalho do concorrente, e a comparação abre com os dois maiores concorrentes (lado A areia); canal sem vídeos vira a linha fina, aparece apagado no menu e entra na comparação dizendo "sem vídeos". → Tarefas 2, 3, 9 e 11.

---

### Tarefa 1: filtro de formato "Todos | Longos | Shorts" (modelo, URL e controle)

**Arquivos:**
- Modificar: `L/links.ts`, `C/_canais/view-model.ts`, `C/_canais/canais-screen.tsx`, `C/_canais/cells.tsx`, `C/_canais/channel-table.tsx`, `C/_canais/channel-cards.tsx`, `C/_canais/canais.css`
- Criar: `C/_canais/formato.ts`, `.superpowers/sdd/2026-10-11-telas-a3-canais-comparacao-plan/progress.md`
- Teste: criar `T/a3-fixture.ts`, `T/canais-a3-formato.test.ts`, `T/canais-a3-formato-tela.test.tsx` (jsdom); ajustar `T/canais-view-model.test.ts`, `T/canais-screen.test.tsx`, `T/links.test.ts`

**Interfaces:**
- Consome: `obs.channelStats(id, 'long' | 'short')` (`L/channels.ts:131`), `obs.cadence(id, fmt)` (`:71`); `buildCanaisView` (hoje `fmt = pick(p.fmt, ['long','short'], 'long')`, `view-model.ts:167`); `pickFmt` e o grupo "Formato" (`canais-screen.tsx:280` e `:330-333`).
- Produz:
  ```ts
  // C/_canais/formato.ts — puro
  export type CanaisFmt = 'todos' | 'longos' | 'shorts'
  export const FMT_PADRAO: CanaisFmt = 'longos'
  /** 'short' → 'shorts' e 'long' → 'longos' (links antigos); ausente, vazio ou lixo → null (quem chama aplica o padrão). */
  export function parseCanaisFmt(raw: string | undefined): CanaisFmt | null
  /** O formato que ordena e posiciona: Shorts só no filtro Shorts; "Todos" ordena pelos longos. */
  export function fmtDaOrdem(f: CanaisFmt): 'long' | 'short'
  // L/links.ts — link.canais ganha fmt?: CanaisFmt (emitido como veio; a ordem das chaves não muda para quem não o passa)
  // C/_canais/view-model.ts — CanaisView.fmt passa a ser CanaisFmt; ganha:
  fmtNota: string | null            // spec 15.3: o aviso sob o controle; null em Longos
  fmtNaUrl: boolean                 // a URL trouxe um fmt válido? (false = o navegador grava)
  // Células que dependem de formato ganham a segunda medida (só em 'todos'; undefined fora dele):
  // CanaisRow.cells.cadence2 / vpd2 / out2  — a medida dos Shorts, com o mesmo tipo da primeira (CadenceCell | VpdCell | OutCell compacto)
  // CanaisRow.semFormato: { n: number; tip: string } | null    // "formato não confirmado (N)" (D7)
  ```
  `T/a3-fixture.ts` exporta `a3World(mut?: (ds: Dataset) => void, preset: OwnPreset = '2'): { obs: Observatory; ds: Dataset; owns: string[] }`, sobre `loadOracleOwns(preset)` + `datasetFromOracle`, com a base **guardada uma vez por arquivo** (um `Map` por preset) e a mutação numa cópia (`plain`).

- [ ] **Passo 1: testes que falham** (`T/canais-a3-formato.test.ts`)
```ts
it('sem fmt: Longos, fmtNaUrl false; fmt=longos, fmt=todos e fmt=shorts são aceitos', ...)
it('links antigos: fmt=short abre Shorts e fmt=long abre Longos', ...)
it('parâmetros inválidos: fmt=abc, fmt vazio e fmt=TODOS (maiúsculas) dão Longos, sem erro', ...)
it('Longos e Shorts: as células e as unidades falam só daquele formato (como hoje)', ...)
it('Todos: Ritmo, Views/dia e Outliers têm duas medidas, a dos longos e a dos Shorts; nenhuma mediana misturada', ...)
it('Todos: Inscritos, Trocas, Crescimento e Sincronização não mudam com o formato', ...)
it('Todos: canal sem Shorts diz "sem Shorts" na segunda medida, nunca 0; canal sem vídeos diz "sem vídeos"', ...)
it('Todos: concorrente aguardando o 2º registro diz o motivo nas duas medidas; canal próprio diz que não há views diárias', ...)
it('Todos ordena pelos longos: a ordem é a mesma de Longos e sortNote diz "ordenado pelos longos"', ...)
it('Shorts: quem não tem Shorts não tem valor para ordenar (null), nunca -1', ...)
it('vídeos com isShort nulo: a linha traz semFormato com a contagem; sem nulos é null', ...)
it('fmtNota: o texto do spec 15.3 em Todos e em Shorts; null em Longos', ...)
it('os links que o modelo monta (problemas, limpar) levam o fmt atual', ...)
it('link.canais emite fmt quando dado; sem ele a URL de hoje não muda', ...)
```
`T/canais-a3-formato-tela.test.tsx` (jsdom):
```ts
it('o grupo "Formato" tem três botões com aria-pressed, na ordem Todos, Longos, Shorts', ...)
it('escolher um formato grava fmt= na URL SEMPRE, inclusive Longos, e guarda em localStorage', ...)
it('URL sem fmt: grava o lembrado (ou longos) com replace, uma vez só; localStorage que lança não quebra a tela', ...)
it('navegação que só muda a query (rerender com outro view.fmt) atualiza o botão pressionado', ...)
it('a mudança é anunciada no status: "Formato: Todos, longos e Shorts lado a lado, ordem pelos longos."', ...)
it('Todos na tabela: o cabeçalho da coluna diz "longos em cima, Shorts embaixo" e cada medida tem o rótulo para leitor de tela', ...)
it('Todos nos cartões: o rótulo "longos" / "Shorts" é visível em cada medida', ...)
it('"formato não confirmado (N)" aparece na linha, com a dica na camada flutuante', ...)
```
- [ ] **Passo 2: rodar e ver falhar.** `cd apps/web && npx vitest run test/youtube/observatorio/canais-a3-formato > $SCRATCH/t1.txt 2>&1`
- [ ] **Passo 3: implementar.** Em `buildCanaisView`, `fmt` (o do filtro) e `fo = fmtDaOrdem(fmt)` (o que ordena) passam a ser coisas diferentes: tudo o que hoje usa `fmt` para **calcular** usa `fo`; em `'todos'` calcule também a medida do outro formato (`stats(c.id, 'short')`, `obs.cadence(c.id, 'short')`) e preencha `cadence2`, `vpd2`, `out2`. `out2` é compacto (contagem e maior múltiplo, sem thumbnail; D6). `semFormato` conta os vídeos acompanhados do canal com `isShort == null` (D7); o texto da dica mora no modelo. No controle, o padrão de hoje ("o padrão fica fora da URL") **não vale para `fmt`**: `pickFmt` grava sempre. O efeito de `fmtNaUrl === false` roda uma vez por montagem e de novo quando a query perde o `fmt` (compare por valor, como `use-canal-state.ts:42-55`). Forma das duas medidas em `M/canais.css` (procure `.dois`, `.fm`, `.fl`, `.nd`); o `padding` vertical da célula cai para 3 px só em "Todos" (spec 15.3). Nenhuma regra nova com `z-index` numérico.
- [ ] **Passo 4: ajustar os testes existentes.** Os que passam `fmt: 'short'` continuam valendo (link antigo); os que afirmam `view.fmt === 'long'` passam a afirmar `'longos'`. Liste cada um no relatório.
- [ ] **Passo 5: rodar e ver passar**, mais `tsc` e a pasta inteira.
- [ ] **Passo 6: commit** — `feat: Canais: filtro de formato Todos, Longos e Shorts, sempre na URL`.

---

### Tarefa 2: posição, lista única e bloco "Seus canais" (modelo)

**Arquivos:**
- Criar: `L/posicao.ts`, `C/_canais/posicao-model.ts`
- Modificar: `C/_canais/view-model.ts` (campos novos; `groups`, `own.rows` e `rows` de hoje **ficam até a Tarefa 3**), `C/_chrome/own-channels.ts`
- Teste: `T/posicao.test.ts`, `T/canais-a3-posicao.test.ts`

**Interfaces:**
- Consome: `obs.ownChannels()` (ordem do motor; `C/_canais/view-model.ts:237`), `rowOf` e `sortKeys` (`:335-338`, hoje com `-1` e `-99`), `fmtDaOrdem` (Tarefa 1), `obs.nicheLabel`.
- Produz:
  ```ts
  // L/posicao.ts — puro, sem motor
  export interface Posicao { pos: number; de: number; empate: boolean }
  /** 1 + quantos têm valor MAIOR; `de` conta só quem tem valor; quem não tem valor não entra e recebe null. */
  export function posicoes(vals: ReadonlyArray<{ id: string; x: number | null }>): Map<string, Posicao | null>
  /** O conjunto de uma posição (emenda 45). */
  export type Conjunto = { tipo: 'nicho'; niche: string; label: string } | { tipo: 'geral' }
  export const conjuntoTexto = (c: Conjunto): string        // "em Viagem" | "no geral"
  // C/_chrome/own-channels.ts
  /** Para onde "Abrir meu canal" leva. A3: o painel lateral (link.canais({ channel })); a A4 troca por link.canal(id). */
  export function ownChannelHref(id: string): string
  // C/_canais/posicao-model.ts — puro
  export const POSICIONADAS: readonly CanaisSort[] = ['subs', 'vpd']                    // D3
  export type MotivoSemMedida = 'sem-videos' | 'sem-shorts' | 'sem-views-dia-proprio' | 'aguarda-2o-registro' | 'buscando-videos' | 'inscritos-ocultos' | 'sem-nicho' | 'ordenacao-sem-posicao'
  export function motivoTexto(m: MotivoSemMedida): string   // switch exaustivo; os textos são os de 15.2, 15.5 e D4 (b)
  // CanaisRow ganha:
  valor: Record<CanaisSort, number | null>          // null = sem medida (substitui as sentinelas de sortKeys na ordenação)
  pos: Posicao | null                               // na ordenação atual; null fora de POSICIONADAS ou sem valor
  semMedida: MotivoSemMedida | null                 // por que não tem valor na coluna ordenada
  // CanaisView ganha:
  list: { ranked: CanaisRow[]; unranked: CanaisRow[]; divisor: { titulo: string; nota: string } | null }   // "Ainda sem medida para ordenar (N)"
  conjunto: Conjunto
  conjuntoAviso: string | null                      // emenda 45: o aviso da posição geral; null dentro de um nicho
  own: { ...; block: OwnBlock | null }
  pe: { canalId: string; texto: string } | null     // a linha presa: "seu canal · 14º de 14 em Viagem, em inscritos, com 1,16 mil."
  buscaNota: string                                 // "Posição na lista inteira, não só nos resultados da busca."
  interface OwnBlock {
    titulo: 'Seus canais' | 'Seu canal'
    linhas: Array<
      | { tipo: 'cheia'; id: string; name: string; avatar: string | null; ini: string; color: string; frase: string; vizinhos: string | null; abrirHref: string }
      | { tipo: 'fina'; id: string; texto: string }>   // canal próprio sem vídeos: "<nome>: sem vídeos, fora das posições por vídeo."
    partes: OwnGroupPart[]                           // as de hoje ("1 em outro nicho (aparece em Todos)", "fora do limite de concorrentes")
  }
  ```

- [ ] **Passo 1: testes que falham.**
`T/posicao.test.ts`: `1 + quantos são maiores`; empate marca os dois e pula a posição seguinte ("1º, 1º, 3º"); quem tem `x: null` recebe `null` e não conta em `de`; lista vazia; um só canal é "1º de 1" sem empate; zero medido entra e fica atrás de qualquer positivo; `conjuntoTexto` nos dois tipos.
`T/canais-a3-posicao.test.ts`:
```ts
it('lista única: os canais próprios ficam NA POSIÇÃO deles entre os concorrentes, em qualquer ordenação e direção', ...)
it('nicho escolhido: conjunto "em <Nicho>" e a posição conta só os canais do nicho (próprios incluídos)', ...)
it('nicho Todos: conjunto "no geral", todos os nichos e os sem nicho numerados juntos, com o aviso da emenda 45', ...)
it('canal próprio sem nicho: tem posição no geral; dentro de um nicho fica sem posição e a frase é "escolha o nicho do canal para ver a posição"', ...)
it('posição só em Inscritos e Views/dia (nas duas escalas); em Ritmo, Outliers, Trocas e Crescimento pos é null em todas as linhas e a frase é a de D4 (b)', ...)
it('empate: "(empate)" na frase e empate true nos dois', ...)
it('sem medida vai para o fim sob o divisor, em desc E em asc: canal próprio sem views por dia, aguardando o 2º registro, em primeira sincronização, inscritos ocultos (em por mil), sem Shorts (no filtro Shorts)', ...)
it('nenhuma linha sem medida tem pos; nenhuma posição é calculada sobre -1 ou -99', ...)
it('o "de N" é o de quem tem o valor: com 2 sem medida em 14, a frase diz "de 12"', ...)
it('divisor: "Ainda sem medida para ordenar (N)" com a nota do que falta; null quando todos têm medida', ...)
it('bloco: uma linha cheia por canal próprio com vídeos, com a frase da posição, o número e os vizinhos ("Logo acima: …" / "É o último da lista.")', ...)
it('bloco: trocar a ordenação troca a frase (todas as ordenações × formatos × escalas do fixture)', ...)
it('bloco: canal próprio sem vídeos vira linha fina, sem "Abrir meu canal"', ...)
it('bloco: canal próprio sem views por dia na ordenação padrão diz a frase do spec 15.2, sem posição', ...)
it('título "Seu canal" com um e "Seus canais" com mais de um; site sem canal próprio: block e pe são null', ...)
it('a linha presa fala do primeiro canal próprio com vídeos (D16), com a frase curta', ...)
it('Todos (formato): posição e frase seguem os longos; Shorts: seguem os Shorts', ...)
it('filtro "só com problema" e busca não mudam a posição de ninguém', ...)
it('invariante: toda linha cheia do bloco tem abrirHref = ownChannelHref(id) e o canal existe em list', ...)
it('nenhum texto do bloco, do divisor ou da linha presa traz palavra interna (lista das Restrições globais)', ...)
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** `valor` nasce ao lado de `sortKeys` em `rowOf`: onde hoje há `-1` ou `-99` vai `null` (`bf`, `v ?? -1`, `S.growth30.pending`, `c.subs ?? -1`); canal próprio em Trocas é `null` (as trocas dele ficam no A/B Lab). A ordenação nova usa `valor`: com valor primeiro, pela direção; sem valor no fim, **sempre** (concorrentes antes dos próprios, depois inscritos). O conjunto da posição é o de D11: `obs.channels.filter(inNiche)`, próprios incluídos, **antes** de `filter=problemas` e da busca. A frase segue D4 (a); os vizinhos são os de `ranked` imediatamente acima e abaixo, com o valor formatado como a célula o mostra. `sortNote` perde "os seus canais ficam sempre no topo" (o teste de `T/canais-view-model.test.ts:148` muda na Tarefa 3, junto com a tela). **Não apague** `groups`, `own.rows`, `own.group` nem `rows`: a tela ainda os usa até a Tarefa 3.
- [ ] **Passo 4: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 5: commit** — `feat: Canais: posicao no nicho e geral, lista unica e bloco Seus canais (modelo)`.

---

### Tarefa 3: a lista na tela: bloco "Seus canais", posição, linha presa e busca

**Arquivos:**
- Criar: `C/_canais/own-block.tsx`, `C/_canais/pe-preso.tsx`
- Modificar: `C/_canais/canais-screen.tsx`, `C/_canais/channel-table.tsx`, `C/_canais/channel-cards.tsx`, `C/_canais/cells.tsx`, `C/_canais/canais.css`, `C/_canais/view-model.ts` (saem `groups`, `own.rows`, `own.group`, `rows`, `CanaisGroup`, `sortKeys`)
- Teste: `T/canais-a3-tela.test.tsx` (jsdom); ajustar `T/canais-view-model.test.ts` (bloco "Seus canais", linhas 114 a 210), `T/canais-screen.test.tsx` (linhas 437 a 570 e onde citarem grupo), `T/canais-pending.test.tsx`, `T/custom-niche-screens.test.tsx`, `T/canais-vpd-waiting.test.ts`

**Interfaces:**
- Consome: `view.list`, `view.own.block`, `view.pe`, `view.conjunto`, `view.conjuntoAviso`, `view.buscaNota`, `row.pos`, `row.semMedida` (Tarefa 2); `openDrawer` (`canais-screen.tsx:145`).
- Produz: `OwnBlockView({ block, onIr, onAbrir })`, `PePreso({ pe, topoRef, linhaRef, onIr, onTopo })`; em `RowHandlers`, `irAte(id: string): void`.

- [ ] **Passo 1: testes que falham** (`T/canais-a3-tela.test.tsx`)
```ts
it('a tabela não tem linhas de grupo por nicho; as linhas vêm na ordem de view.list.ranked e depois o divisor e as sem medida', ...)
it('a coluna de posição mostra "13º" com "(empate)" para leitor de tela; linha sem posição tem "sem posição" só para leitor', ...)
it('a linha do canal próprio fica na posição dela, com o selo "seu canal" e a classe do fio; não se repete no topo da tabela', ...)
it('o divisor "Ainda sem medida para ordenar (N)" é uma linha de grupo (th scope="rowgroup") com a nota', ...)
it('bloco "Seus canais": título, uma linha por canal, "Ir até a linha" e "Abrir meu canal"; a linha fina não tem avatar, selo nem botão grande', ...)
it('"Abrir meu canal" abre o painel lateral do canal próprio (A3: o mesmo de hoje)', ...)
it('"Ir até a linha" rola o contêiner que rola e põe o foco na linha (tabIndex -1); com busca ativa que esconde a linha, limpa a busca antes', ...)
it('cartões: mesma ordem, o cartão do canal próprio na posição dele com "Você está na 10ª posição de 14 em Viagem nesta ordenação."; o cartão NÃO se repete no topo', ...)
it('linha presa: escondida enquanto o bloco ou a linha do canal estão à vista; aparece quando nenhum dos dois está', ...)
it('linha presa: "Voltar ao topo" rola ao topo e foca o título; sem canal próprio ela não existe no DOM', ...)
it('busca: filtra as linhas, não renumera, e mostra "Posição na lista inteira, não só nos resultados da busca."', ...)
it('busca sem resultado: a frase de vazio de hoje; o bloco "Seus canais" continua', ...)
it('ordenar anuncia no status a ordenação e a posição do seu canal ("Seu canal: 14º de 14 em Viagem.") ou que não há medida', ...)
it('nicho Todos: o aviso da posição geral aparece sob o controle; dentro de um nicho, não', ...)
it('navegação que só muda a query (outro sort): a frase do bloco e a linha presa acompanham', ...)
it('site sem canal próprio: sem bloco, sem linha presa, sem selo', ...)
it('nenhum elemento novo é buscado por document.getElementById (a árvore escondida do Voltar teria o mesmo id)', ...)
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** Forma de `M/canais.css` e `M/canais.js` (procure `.cn-top`, `.fina`, `.cn-pin`, `.grp`, `td.p`, `.own`). O bloco fica **acima da barra de controles**, na mesma superfície, com o fio laranja (`box-shadow: inset 2px 0 0 var(--accent)`). A linha presa: `position: sticky; bottom: 10px; z-index: var(--z-grudado)`, 30 px de altura mínima; o `IntersectionObserver` usa como `root` o contêiner que rola (suba a partir de `ref` até o primeiro ancestral com `overflow-y` auto/scroll) e `threshold: 0.15`; sem `IntersectionObserver` (jsdom) a linha fica escondida. Rolagem suave só sem `prefers-reduced-motion`. A linha do canal próprio recebe `tabIndex={-1}` e é achada por `ref` (um `Map<string, HTMLElement>` na tela), nunca por id global. A busca continua estado local (`canais-screen.tsx:260-261`): filtre `ranked` e `unranked` e não toque em `pos`. Com os campos antigos apagados do tipo, o `tsc` aponta cada uso que sobrou (`rowOf` da tela em `:123`, o `watch` de canal recém-adicionado em `:300`): troque por `view.list`. Em `canais-screen.tsx`, o `empty` de hoje vale quando `ranked` e `unranked` filtrados estão vazios.
- [ ] **Passo 4: ajustar os testes existentes, no mesmo commit.** Os testes "R73" (`T/canais-view-model.test.ts:135-210`, `T/canais-screen.test.tsx:446-570`) passam a afirmar a posição do canal próprio na lista e o bloco; "a coluna clicada não reordena os canais próprios" **inverte** (agora reordena). A ordem do motor continua valendo dentro do bloco e em `obs.ownChannels()` (`T/own-niche.test.ts` não muda). Liste no relatório cada teste alterado, com a afirmação antiga e a nova.
- [ ] **Passo 5: rodar e ver passar** (pasta inteira, `tsc`).
- [ ] **Passo 6: commit** — `feat: Canais: canal proprio na posicao dele, bloco Seus canais e linha presa no pe`.

---

### Tarefa 4: prova no navegador da lista (`canais-a3.spec.ts`)

**Arquivos:**
- Criar: `E/canais-a3.spec.ts`
- Modificar: `apps/web/e2e/fixtures/observatorio-seed*` só se faltar um caso (canal próprio sem vídeos; concorrente sem Shorts)

**Interfaces:**
- Consome: `ADMIN_STATE`, `ensureSeeded({ ownPreset: '2' })`, `seedIdsOf` de `E/fidelity.ts`; o padrão de `E/canal.spec.ts` (o `__sc()` do contêiner que rola, `medida()`, `pronta()`, localizadores `:visible`).

- [ ] **Passo 1: escrever o spec.** Tema escuro, 1440×900, na moldura real. `test.beforeEach` instala a rota que **falha o teste** em qualquer `POST` com cabeçalho `next-action`.
```ts
test('A3.1 o controle tem Todos, Longos e Shorts; a URL ganha fmt= ao abrir e a cada troca; recarregar mantém', ...)
test('A3.1 link antigo fmt=short abre em Shorts; fmt=abc abre em Longos sem erro no console e sem 500', ...)
test('A3.1 Todos mostra duas medidas por célula e o cabeçalho diz "longos em cima, Shorts embaixo"; conta as linhas inteiras na dobra', ...)
test('A3.2 o canal próprio está na posição dele; trocar a ordenação muda a frase do bloco', ...)
test('A3.2 nicho Todos numera todos juntos e diz "no geral"; um nicho diz "em <Nicho>"', ...)
test('A3.2 a linha presa aparece ao rolar para o meio e some no topo e na linha do canal', ...)
test('A3.2 "Ir até a linha" traz a linha à área visível e põe o foco nela; "Voltar ao topo" volta', ...)
test('A3.2 a linha presa não cobre o foco: Tab até a última linha visível, nenhuma fica sob ela', ...)
test('A3.2 os cartões têm a mesma ordem e a frase "Você está na …ª posição"', ...)
test('a dica dos inscritos e o "formato não confirmado" abrem na camada flutuante, inteiras na janela', ...)
test('sem rolagem horizontal da página em 1440, 1280, 1024, 768 e 390 px, tabela e cartões, nos três formatos', ...)
test('cor nunca sozinha: captura em escala de cinza; o canal próprio continua identificável pelo selo', ...)
test('tema claro: bloco, selo, divisor e linha presa legíveis (contraste de texto medido, 4,5:1)', ...)
```
- [ ] **Passo 2: rodar em fundo** (`npm run db:start`; depois o Playwright com saída em `$SCRATCH/pw-t4.txt`). Cada falha é defeito real ou do spec: defeito de código das Tarefas 1 a 3 é **consertado aqui**, com o teste unitário que faltava, e relatado um por um.
- [ ] **Passo 3: medidas** em `apps/web/test-results/canais-a3-medidas.txt`, copiadas para o relatório: linhas inteiras na dobra em Longos, Todos e Shorts (o mockup deu 12, 11 e 11 com 70 linhas e outra casca; registre o que a produção dá, sem forçar o número), altura do bloco com um e com dois canais próprios, largura da tabela contra a do bloco (rola por dentro ou não em 1440).
- [ ] **Passo 4: commit** — `test: prova em navegador da lista de Canais (A3): formato, posicao, bloco e linha presa`.

---

### Tarefa 5: os treze números de um canal e o pacote da comparação (modelo de servidor)

**Arquivos:**
- Criar: `C/_comparar/numeros-model.ts`, `C/_comparar/pack.ts`
- Modificar: `L/links.ts` (`link.comparar`)
- Teste: `T/comparar-numeros.test.ts`, `T/comparar-pack.test.ts`; ajustar `T/links.test.ts`

**Interfaces:**
- Consome: `obs.channel`, `obs.videos`, `obs.channelStats(id, 'long')`, `obs.cadence(id, 'long' | 'short')`, `obs.changesIn({ days: 30, channel })`, `obs.median`, `obs.fmt`, `obs.date`, `obs.RULES`; `vpdText` de `C/_canal/numeros.ts`; `ownChannelHref` (Tarefa 2). **Leia antes** `C/_canal/header-model.ts` (linhas 43 a 180): várias linhas já são calculadas ali, e o número tem de ser o mesmo.
- Produz:
  ```ts
  // L/links.ts
  comparar(a?: string, b?: string): string      // OBS_BASE + '/comparar' + ?a=&b= (só os dados; ordem fixa a, b)
  // C/_comparar/numeros-model.ts — puro
  export type NumeroId = 'inscritos' | 'inscritos30' | 'longosAcomp' | 'longos90' | 'ritmo' | 'diasUltimo' | 'medianaViews' | 'vpd' | 'vpdPorMil' | 'engajamento' | 'acima2x' | 'duracao' | 'trocas30'
  export const NUMEROS: readonly NumeroId[]     // as 13, na ordem do spec 18.4
  export const NO_NICHO: ReadonlySet<NumeroId>  // as seis com régua e posição: inscritos, longosAcomp, longos90, medianaViews, vpd, vpdPorMil
  /** x null = não medido (com `motivo`); x 0 = zero medido. `texto` é o valor como a tela o escreve; `nota` é a segunda linha. */
  export interface Numero { x: number | null; texto: string | null; motivo: string | null; nota: string | null }
  export function numerosDoCanal(obs: Observatory, channelId: string): Record<NumeroId, Numero>
  // C/_comparar/pack.ts — puro; o que vai do servidor para o navegador (só dados simples)
  export interface CanalPack {
    id: string; name: string; own: boolean; niche: string | null; nicheLabel: string | null
    avatar: string | null; ini: string; color: string; subsTexto: string | null
    semVideos: boolean
    /** "Abrir o canal …": página do concorrente; painel do canal próprio com vídeos; null sem página (sem vídeos). */
    href: string | null
    numeros: Record<NumeroId, Numero>
    top5: Array<{ id: string; href: string; titulo: string; thumb: string | null; viewsTexto: string; idadeTexto: string; short: boolean }>
    top5Nota: string                              // "5 de 133 vídeos guardados, por views." | "Só 3 vídeos com contagem de views." | "Este canal não tem vídeos."
    pub90: Array<{ t: number; fmt: 'long' | 'short' | null; dataTexto: string }>
    pub90Nota: string
  }
  export interface CompararPack { now: number; inicio90: number; eixo: [string, string, string, string]; canais: CanalPack[]; ordem: string[] }  // ordem: próprios (ordem do motor), depois concorrentes por inscritos, maior primeiro
  export function buildCompararPack(obs: Observatory): CompararPack
  ```

- [ ] **Passo 1: testes que falham** (`T/comparar-numeros.test.ts`): um bloco por número, cada um com o caso medido, o zero medido e o nulo:
```ts
it('inscritos: o número; canal que esconde a contagem → não medido, "inscritos ocultos pelo canal"', ...)
it('inscritos em 30 dias: percentual com a nota "de A para B"; dentro do arredondamento "≈ 0"; canal próprio → não medido com o motivo do spec 16.1; concorrente sem 30 dias de contagem → o motivo do motor', ...)
it('longos acompanhados: só longos (não soma Shorts, D10); canal sem vídeos → não medido "sem vídeos"', ...)
it('longos em 90 dias: 0 é zero medido ("0"), não nulo; canal em primeira sincronização → não medido', ...)
it('ritmo: "0,2 + 1,0" com a nota "N longos e M Shorts em 13 semanas"; os dois em zero → x 0 e texto "0 + 0"', ...)
it('dias desde o último vídeo: dias inteiros até agora, com a nota "publicado em …"; sem vídeo com data → não medido', ...)
it('mediana de views dos longos: igual à célula do cabeçalho do canal (header-model) para o mesmo canal', ...)
it('views por dia e por mil: iguais a channelStats; canal próprio → não medido "a coleta diária do seu canal começa em breve"; concorrente sem 2º registro → o motivo', ...)
it('views por dia abaixo de 10 com uma casa decimal; zero exato é "0" (vpdText)', ...)
it('engajamento SEM janela de 90 dias: entra todo longo guardado com views > 0, curtidas e comentários não nulos; comentário nulo fica de fora, não entra como 0', ...)
it('engajamento: difere do engajamento do cabeçalho do canal quando há longos com mais de 90 dias, e a nota diz a base', ...)
it('vídeos acima de 2×: "k de n" dos longos de até 90 dias; sem nenhum com múltiplo → não medido (canal próprio: "nenhum vídeo seu nos últimos 90 dias")', ...)
it('duração mediana: mm:ss ou h:mm:ss; sem duração → não medido', ...)
it('trocas em 30 dias: título e thumbnail (não descrição); canal próprio → não medido "as trocas do seu canal ficam no A/B Lab"', ...)
it('invariante, todos os canais do fixture: texto null ⇔ x null ⇔ motivo preenchido; nenhum texto é "—", "NaN", "Infinity" ou vazio', ...)
it('nenhum motivo traz palavra interna', ...)
```
`T/comparar-pack.test.ts`:
```ts
it('ordem: canais próprios primeiro (ordem do motor), depois concorrentes por inscritos, maior primeiro', ...)
it('href: página para concorrente; ownChannelHref para canal próprio com vídeos; null para canal sem vídeos', ...)
it('top5: os cinco de mais views entre os vídeos guardados (longos e Shorts juntos), com a marca Short; menos de cinco diz quantos; canal sem vídeos diz isso', ...)
it('top5: vídeo sem contagem de views não entra (nunca como 0)', ...)
it('pub90: um item por vídeo com data nos últimos 90 dias; isShort nulo → fmt null e a nota conta "de formato não confirmado"', ...)
it('pub90: canal sem vídeo em 90 dias diz o último; canal sem nenhum vídeo → "ainda sem vídeos sincronizados"', ...)
it('o pacote é só dado simples: JSON.parse(JSON.stringify(pack)) é igual ao pacote', ...)
it('tamanho: 75 canais com 200 vídeos cada ficam abaixo de 250 KB com gzip (registrar o medido)', ...)
it('o pacote chama só o conjunto do site: buildCompararPack num conjunto de um canal lança (não devolve números de um canal só)', ...)
it('link.comparar: a e b na ordem fixa; sem argumentos, a rota sem query', ...)
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** Fontes por linha: spec 18.9, corrigido por D9 e D10. Para o que `header-model.ts` já calcula (mediana de views, duração, trocas de título e thumbnail, acima de 2×), **extraia a conta para uma função compartilhada** em `C/_canal/numeros.ts` e chame-a dos dois lugares, sem mudar o resultado do cabeçalho (`T/canal-header-model.test.ts` fica verde sem mudar afirmação). Os motivos saem de um `switch` exaustivo sobre um tipo `Motivo`. O `top5` lê `obs.videos` do canal (com data) e `channel.undated` (sem data: "sem data" na idade). A thumbnail é `https://i.ytimg.com/vi/<ytId>/mqdefault.jpg` (como `thumbOf`, `C/_canais/view-model.ts:189`). `buildCompararPack` chama `obs.ownChannels()` logo no início (é o que faz o conjunto de um canal lançar).
- [ ] **Passo 4: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 5: commit** — `feat: comparacao: os treze numeros de um canal e o pacote do par (modelo)`.

---

### Tarefa 6: o par: lados, relação, barras, Leitura rápida e rodapé (modelo que roda no navegador)

**Arquivos:**
- Criar: `C/_comparar/par-model.ts`, `C/_comparar/formatos.ts`
- Teste: `T/comparar-par.test.ts`, `T/comparar-leitura-rapida.test.ts`

**Interfaces:**
- Consome: `CompararPack`, `CanalPack`, `Numero`, `NumeroId`, `NUMEROS`, `NO_NICHO` (Tarefa 5); `posicoes`, `Conjunto`, `conjuntoTexto` (Tarefa 2). **Não importa o motor** (`Observatory`): o arquivo roda no navegador.
- Produz:
  ```ts
  // C/_comparar/formatos.ts — puro: vírgula decimal, "×", "+N%", "há N dias" (os de comparar.js: fx, quanto, haDias, juntar)
  // C/_comparar/par-model.ts — puro
  export type CorLado = 'o' | 'b' | 'n'        // --lado-o (seu canal), --lado-b, --lado-n
  /** a e b válidos e diferentes; a ausente = o canal próprio (D16); b ausente = o concorrente logo acima de A em inscritos (ou o maior). null = não há dois canais. */
  export function resolverPar(pack: CompararPack, a: string | undefined, b: string | undefined): { a: string; b: string } | null
  export type Relacao =
    | { tipo: 'maior'; lado: 0 | 1; quem: string; texto: string }     // "▲ Você: +54% de engajamento"
    | { tipo: 'igual'; texto: string }                                  // "praticamente igual" | "nenhum dos dois publicou longos em 90 dias"
    | { tipo: 'recente'; lado: 0 | 1; quem: string; texto: string }    // dias desde o último vídeo
    | { tipo: 'zero'; texto: string }                                   // "você não publicou longos em 90 dias" (sem símbolo)
  export interface LinhaPar {
    id: NumeroId; grupo: 'tamanho' | 'publicacao' | 'desempenho'; nome: string; base: string
    lados: [Numero, Numero]
    pos: [PosLado | null, PosLado | null]                               // só nas seis de NO_NICHO
    eixo: { tipo: 'regua' } | { tipo: 'barras'; larguras: [number, number]; aviso: string | null } | { tipo: 'nenhum' }
    relacao: Relacao | null                                             // null: um lado não medido, ou linha sem relação (inscritos em 30 dias)
  }
  export interface PosLado { texto: string; geral: string | null }     // "14º de 14 em Viagem" + (mesmo nicho) "40º de 75 no geral"
  export interface ParView {
    a: CanalPack; b: CanalPack; cores: [CorLado, CorLado]
    conjunto: Conjunto; subtitulo: string; titulo: string             // titulo: "Comparar: A e B"
    linhas: LinhaPar[]                                                   // sem as linhas em que nenhum dos dois tem dado
    fora: string[]                                                       // os nomes das linhas que ficaram de fora
    rodape: string                                                       // "Maior não quer dizer melhor: …" + "N números ficaram de fora…" + o aviso do bloco de publicação
    leitura: Array<{ simbolo: 'maior' | 'igual' | 'sem'; lado: 0 | 1 | null; texto: string }>   // Leitura rápida; vazio = o bloco não aparece
    status: string                                                       // "Comparando A e B. 3 números sem dado em nenhum dos dois canais ficaram de fora."
    publicacao: boolean                                                  // algum dos dois tem datas?
  }
  export function buildPar(pack: CompararPack, a: string, b: string): ParView
  ```

- [ ] **Passo 1: testes que falham** (`T/comparar-par.test.ts`)
```ts
it('resolverPar: sem a → o canal próprio; sem b → o concorrente logo acima de A em inscritos; sem ninguém acima → o maior', ...)
it('resolverPar: a = b, a=lixo, b de canal que não existe → o padrão, sem lançar; site sem canal próprio → os dois maiores concorrentes', ...)
it('resolverPar: site com um canal só ou sem canais → null', ...)
it('cores: o canal próprio é laranja no lado A e no lado B; o outro é azul; sem canal próprio, A areia e B azul; dois canais próprios → A laranja e B azul', ...)
it('inverter os lados troca as cores junto com os canais', ...)
it('relação: diferença abaixo de 10% é "praticamente igual"; exatamente 10% já nomeia o maior', ...)
it('relação: "×" só a partir de 2× (1,99× vira "+99%"; 2,0× vira "2,0×"); a partir de 10× sem casa decimal', ...)
it('relação: sempre nomeia o maior ("Você" para o canal próprio), sem sinal de menos', ...)
it('zero em um lado: a frase de gente da linha ("você não publicou longos em 90 dias"); nas outras linhas "<quem> tem 0"; nunca razão', ...)
it('zero nos dois: "nenhum dos dois publicou longos em 90 dias" / "… publicou em 13 semanas" / "… tem vídeo acima de 2× em 90 dias" / "os dois em 0"', ...)
it('um lado não medido: relacao null, eixo sem barra desse lado, e o lado traz o motivo', ...)
it('os dois não medidos: a linha não está em linhas e o nome dela está em fora; o rodapé conta e nomeia', ...)
it('dias desde o último vídeo: frase "<quem> publicou mais recentemente: há N dias; <outro>, há M dias", sem barra; iguais: "Os dois publicaram há N dias"', ...)
it('inscritos em 30 dias: sem barra e sem relação', ...)
it('barras: proporcionais ao maior dos dois; a menor abaixo de 3% ganha a largura mínima e o aviso por escrito', ...)
it('posição: mesmo nicho → "14º de 14 em Viagem" e a geral em geral; nichos diferentes ou um sem nicho → só "no geral" e conjunto geral', ...)
it('posição: empate dito; lado sem valor não tem posição e o "de N" não o conta', ...)
it('o canal sem vídeos entra no par: todas as linhas de vídeo "não medido · sem vídeos"; só inscritos comparável', ...)
it('subtítulo: o do mockup para o mesmo nicho; o de D4 (c) para nichos diferentes', ...)
it('13 linhas no par mais completo do fixture, nos três grupos, na ordem do spec 18.4', ...)
it('nenhum texto contém "ganha", "vencedor", "perdedor", "melhor que", "Infinity", "NaN" ou palavra interna (todos os pares do fixture)', ...)
```
`T/comparar-leitura-rapida.test.ts`:
```ts
it('uma linha por lado que é maior em algo, "▲ <quem> é maior em: …", com no máximo três itens e "e mais N"', ...)
it('os itens vêm do de maior diferença para o menor; contra zero vem primeiro e escreve "(2 contra 0)"', ...)
it('engajamento e duração escrevem os dois valores ("14,9% contra 9,6%"); os outros, a diferença', ...)
it('"publicação mais recente" entra na linha de quem publicou por último', ...)
it('"＝ Praticamente iguais: …" corta em três; "Sem como comparar ainda: N números (falta o dado do seu canal em …)"', ...)
it('linha sem itens não aparece; par sem nada a dizer devolve lista vazia', ...)
it('inscritos em 30 dias e trocas não entram em "é maior em"', ...)
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** As regras são as de `M/comparar.js` (`relacao`, `quemMaior`, `leitura`, `celulaEixo`, `ZERO`), com D12. O conjunto e a posição vêm de `posicoes()` sobre os canais do conjunto (D11), uma vez por número. O tipo de relação é um `switch` exaustivo na tela e no modelo. Comparações de borda: "praticamente igual" é `r > 0.9 && r < 1.1` com `r = b/a` (10% exatos já é "maior"); "×" é `q >= 2`. Nunca divida sem checar zero dos dois lados antes.
- [ ] **Passo 4: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 5: commit** — `feat: comparacao: relacao, barras, Leitura rapida e rodape do par (modelo)`.

---

### Tarefa 7: régua do nicho (modelo e componente)

**Arquivos:**
- Criar: `C/_chrome/regua/regua-model.ts`, `C/_chrome/regua/regua-nicho.tsx`, `C/_chrome/regua/regua.css`
- Teste: `T/regua-model.test.ts`, `T/regua-nicho.test.tsx` (jsdom), `T/regua-css.test.ts`

**Interfaces:**
- Consome: `HoverTip` de `C/_chrome/flut/flut.tsx`; os tokens `--lado-*`.
- Produz (em `_chrome/` porque a A4 reusa a escala e os empates na régua do vídeo próprio, spec 17.3):
  ```ts
  // regua-model.ts — puro
  export interface Escala { min: number; max: number; comprimida: boolean; pct(x: number): number }
  /** Linear; comprimida (raiz quadrada de x − min) quando 60% ou mais dos valores caem no primeiro quarto do eixo. Todos iguais → 50%. */
  export function escalar(xs: readonly number[]): Escala
  export interface Traco {
    id: string; nome: string; x: number; pct: number
    marca: 'A' | 'B' | null
    dx: number                    // px para o lado: empate COM lado destacado abre os outros 2,6 px; o destacado fica em 0
    pilha: { i: number; passo: number } | null   // empate SEM lado destacado: empilha na vertical (bloco de 3 px, passo de até 5 px)
    grupo: string[]               // os nomes de quem tem o mesmo valor (para a dica: "5 canais com 50")
  }
  export interface ReguaView { tracos: Traco[]; n: number; comprimida: boolean; aria: string }
  export function buildRegua(vals: ReadonlyArray<{ id: string; nome: string; x: number; texto: string }>, marcas: ReadonlyArray<{ id: string; letra: 'A' | 'B' }>, o: { numero: string; conjunto: string }): ReguaView
  /** Quanto afastar as duas letras quando os traços colidem (os traços não saem do valor). */
  export function afastarLetras(pctA: number, pctB: number, larguraPx: number): [number, number]
  // regua-nicho.tsx — cliente
  export function ReguaNicho({ regua, cores }: { regua: ReguaView; cores: { A: string; B: string } }): JSX.Element
  ```

- [ ] **Passo 1: testes que falham.**
`T/regua-model.test.ts`: escala linear quando os valores se espalham; comprimida quando 60% caem no primeiro quarto, e não com 59%; todos iguais dão 50% e não comprimem; um valor só; empate sem lado destacado empilha (cinco canais = coluna de até 23 px) e a dica diz "5 canais com 50" e os nomes; empate com lado destacado mantém o destacado no valor exato e abre os outros 2,6 px; nas pontas o empate abre só para dentro; `aria` diz a posição dos dois lados e o conjunto, e diz "escala comprimida" quando é; `afastarLetras` separa letras a menos de 20 px e não mexe quando há folga; nenhum texto diz "escala √" nem "raiz" fora do `aria`.
`T/regua-nicho.test.tsx` (jsdom):
```ts
it('a régua visual é aria-hidden; o grupo tem o aria-label com as duas posições e o conjunto', ...)
it('um traço por canal do conjunto; dois destacados, com a letra A e B embaixo e a cor do lado', ...)
it('uma parada de Tab por régua; o foco mostra a dica do lado A; setas, Home e End andam do menor ao maior; Esc fecha', ...)
it('cada passo é falado numa região aria-live ("Leo Khev: 1,53 mil inscritos")', ...)
it('a dica mora em #flut (HoverTip), nunca dentro da célula; passar o mouse mostra a do traço mais perto', ...)
it('lado sem valor não ganha traço', ...)
it('sem animação: nenhuma transition na régua (teste de CSS)', ...)
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** A conta é a de `M/regua.js` (`escalar`, `espalhar`, `nicho`, `ajustar`); a forma, a de `M/regua.css` (procure `.rg.cmp`, `.rg-t`, `.rg-me`, `.rg-pl`, `.rg-ch`). O afastamento das letras é medido num efeito de layout e refeito por `ResizeObserver`; ache os elementos por `ref`. A dica usa `HoverTip` com `pref="cima"` e `cx` no centro do traço. Sem `transition`. `T/regua-css.test.ts` afirma: nenhum `color-mix`, nenhum `z-index` numérico, corpo de 12 px ou mais.
- [ ] **Passo 4: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 5: commit** — `feat: regua do nicho (escala, empates, teclado e dica na camada flutuante)`.

---

### Tarefa 8: rota `comparar`: seletores, inverter lados, URL e "Número a número"

**Arquivos:**
- Criar: `C/comparar/page.tsx`, `C/comparar/loading.tsx`, `C/_comparar/comparar-screen.tsx`, `C/_comparar/use-par.ts`, `C/_comparar/lados.tsx`, `C/_comparar/numero-a-numero.tsx`, `C/_comparar/leitura-rapida.tsx`, `C/_comparar/comparar.css`
- Teste: `T/comparar-use-par.test.tsx` (jsdom), `T/comparar-tela.test.tsx` (jsdom), `T/comparar-css.test.ts`, `T/comparar-page.test.ts`

**Interfaces:**
- Consome: `openObservatoryPage()` (`C/_chrome/page-data.ts:23`), `buildCompararPack` (Tarefa 5), `resolverPar`, `buildPar`, `ParView` (Tarefa 6), `ReguaNicho`, `buildRegua` (Tarefa 7), `TrailChrome` (`C/_chrome/trail-chrome.tsx:26`), `Popover`, `ChannelAvatar`.
- Produz:
  ```ts
  // C/_comparar/use-par.ts — cliente; no modelo de C/_canal/use-canal-state.ts
  /** O par na URL, sem navegar (history.replaceState). Ressincroniza por valor quando o servidor manda outro inicial e no popstate. */
  export function usePar(pack: CompararPack, inicial: { a: string; b: string }): { a: string; b: string; trocar(lado: 'a' | 'b', id: string): void; inverter(): void }
  // C/_comparar/comparar-screen.tsx — cliente
  export function CompararScreen({ pack, inicial }: { pack: CompararPack; inicial: { a: string; b: string } | null }): JSX.Element
  ```
  A raiz da tela é `<div data-obs-screen="comparar">`.

- [ ] **Passo 1: testes que falham.**
`T/comparar-page.test.ts` (o módulo da rota, com os carregadores simulados): a página chama `openObservatoryPage` (a guarda de acesso vem antes da leitura); a moldura é `TrailChrome` com a trilha "Canais › Comparar"; `a`/`b` inválidos não lançam; nenhuma server action é passada à tela.
`T/comparar-use-par.test.tsx` (jsdom):
```ts
it('trocar um lado grava ?a=&b= com replaceState, sem push e sem router', ...)
it('escolher no lado A o canal que está no lado B não faz nada (a opção está desabilitada)', ...)
it('inverter troca a e b na URL', ...)
it('rerender com outro inicial (navegação que só muda a query) ressincroniza; rerender com o mesmo inicial não desfaz a escolha local', ...)
it('popstate relê a URL; URL com par inválido cai no padrão de resolverPar', ...)
it('history que lança não quebra a tela', ...)
```
`T/comparar-tela.test.tsx` (jsdom):
```ts
it('h1 "Comparar canais", o subtítulo do par e o botão "Inverter lados"', ...)
it('um cartão por lado: avatar, nome (h2), selo "seu canal" só no canal próprio, nicho, inscritos, chip "Lado A" / "Lado B"', ...)
it('seletores rotulados "Lado A" e "Lado B": optgroup "Seus canais" e um por nicho ("Concorrentes de Viagem, do maior ao menor"), mais "Concorrentes sem nicho"; o canal do outro lado vem disabled; canal sem vídeos diz "(sem vídeos)"', ...)
it('"Abrir o canal <nome>" só quando o canal tem destino; canal sem vídeos diz "Sem vídeos: ainda sem página."', ...)
it('trocar o seletor: a tabela, o título do documento e o role="status" mudam sem navegação', ...)
it('a cor segue o canal: depois de "Inverter lados" o canal próprio continua laranja e passa a ser o lado B', ...)
it('"Número a número" é uma table com caption, th scope col/row/rowgroup e role explícito em cada elemento', ...)
it('três grupos (Tamanho, Publicação, Desempenho) com ícone; cada linha tem nome, base, valor de A, valor de B, eixo e relação', ...)
it('lado não medido: pastilha com a hachura (.obs-ch-nm), a palavra "não medido" e o motivo na segunda linha; a célula de relação tem o texto para leitor de tela', ...)
it('símbolos ▲ ＝ ● têm texto equivalente; a coluna se chama "Relação" (D12)', ...)
it('posição escrita sob o valor nas seis linhas do nicho; nunca percentil', ...)
it('Leitura rápida no topo da seção, com a nota "Calculada dos mesmos números da tabela, sem IA."; lista vazia → o bloco não existe', ...)
it('o ⓘ "Como ler esta tabela" abre na camada flutuante e lista as linhas em escala comprimida e as que ficaram de fora (D13)', ...)
it('rodapé: "Maior não quer dizer melhor: são canais de tamanhos diferentes." e a contagem das linhas de fora', ...)
it('nenhum verde nem vermelho de veredito: a tela não usa --success nem --danger (teste de CSS)', ...)
it('"Só o seu canal mede" não existe nesta fase, em nenhum par (D17)', ...)
it('inicial null (menos de dois canais): a frase de D4 (d) e o link para Canais; sem seletores', ...)
it('foco: ao abrir, no h1; depois de trocar o seletor, continua no seletor', ...)
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** `page.tsx`: `export const dynamic = 'force-dynamic'`, `maxDuration = 60`, `metadata = { title: 'Comparar canais · Competidores' }`; `const { obs } = await openObservatoryPage()`; `pack = buildCompararPack(obs)`; `inicial = resolverPar(pack, a, b)`; se a URL não é a canônica do par resolvido, **não redirecione** (o `usePar` a reescreve no navegador com `replaceState`; um `redirect` aqui custaria outra carga do site). `loading.tsx` cobre só o miolo, na forma final (dois cartões de lado e a tabela; `aria-hidden` no esqueleto e "Carregando…" para leitor de tela). Na tela, `buildPar` roda em `useMemo` sobre `(pack, a, b)`. Forma de `M/comparar.html` e `M/comparar.css` (procure `.cp-sides`, `.cp-side`, `.cp-t`, `.cp-lr`, `.lm`, `.sy`, `.bars2`, `.nm-h`): a cor do lado entra por variável CSS (`--c`) com o valor do token; o sublinhado de 3 px no cabeçalho da coluna e o chip acompanham. `document.title` é atualizado num efeito. A tabela tem cinco colunas em 1440 px e vira pilha com rótulo abaixo de 820 px. `T/comparar-css.test.ts`: nenhum `color-mix`, nenhum `z-index` numérico, nenhum texto abaixo de 12 px, alvos de 44 px sob `pointer:coarse`. Registre no relatório o tamanho do pacote com a semente local (cru e com gzip; D14).
- [ ] **Passo 4: rodar e ver passar** (pasta inteira, `tsc`).
- [ ] **Passo 5: commit** — `feat: tela de comparacao entre dois canais: seletores, lados e Numero a numero`.

---

### Tarefa 9: os cinco mais vistos, publicação em 90 dias, cartão da forja e estados vazios

**Arquivos:**
- Criar: `C/_comparar/mais-vistos.tsx`, `C/_comparar/publicacao.tsx`, `C/_comparar/forja-indisponivel.tsx`
- Modificar: `C/_comparar/comparar-screen.tsx`, `C/_comparar/comparar.css`
- Teste: `T/comparar-blocos.test.tsx` (jsdom)

**Interfaces:**
- Consome: `CanalPack.top5`, `top5Nota`, `pub90`, `pub90Nota`, `CompararPack.inicio90`, `eixo` (Tarefa 5); `ParView.cores`, `publicacao`, `rodape` (Tarefa 6). As classes do cartão da forja são as de `C/_historico/forja-card.css` (A2).
- Produz: `MaisVistos({ par })`, `Publicacao({ par, pack })`, `ForjaIndisponivel({ par })`.

- [ ] **Passo 1: testes que falham** (`T/comparar-blocos.test.tsx`)
```ts
it('"Os 5 vídeos mais vistos de cada canal": duas colunas com o chip do lado; cada item é um link com capa, título, views, idade e a marca "Short"', ...)
it('a capa tem alt="" (o título está no link); o link do vídeo é o Histórico do vídeo (D19)', ...)
it('canal com menos de cinco vídeos com contagem diz quantos; canal sem vídeos diz "Este canal não tem vídeos."', ...)
it('"Publicação nos últimos 90 dias": uma faixa por canal, um traço por vídeo, alto para longo e baixo para Short, e as quatro datas do eixo', ...)
it('os traços dos dois canais usam o mesmo eixo: o mesmo instante dá o mesmo left nas duas faixas', ...)
it('a faixa é role="img" com as datas no aria-label; a frase conta longos, Shorts e os de formato não confirmado', ...)
it('um lado sem datas: a frase do spec 18.7 para produção ("ainda sem vídeos sincronizados") e só a contagem', ...)
it('nenhum dos dois com datas: o bloco não existe e o rodapé diz', ...)
it('cartão da forja com canal próprio no par: "ainda não disponível para o seu canal", o que ela leria, o botão apagado (aria-disabled, aria-describedby no porquê) e o porquê', ...)
it('cartão da forja sem canal próprio: o estado de D4 (e), o mesmo botão apagado; nenhuma etapa, nenhuma leitura de exemplo', ...)
it('o botão apagado não chama nada no clique nem no Enter (não há ação nesta fase)', ...)
it('o cartão é uma region rotulada "Leitura da forja"; fica no fim da página', ...)
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** Forma de `M/comparar.css` (`.cp-vids`, `.cp-t5`, `.cp-pr`, `.cp-strip`, `.cp-axis`, `.cp-fj.off`). As colunas dos mais vistos empilham abaixo de 820 px. O botão apagado: contorno tracejado, texto `--muted`, sem mudança no hover (spec 17.4). O texto do cartão com canal próprio é o de `M/comparar.js` (`forjaCard`, ramo `dono`), conferido contra o spec 18.8 e 17.4; **não porte** o ramo sem dono (a simulação das etapas e a leitura de exemplo são do mockup). A ordem das seções na página: lados, "Número a número" (com a Leitura rápida), os cinco mais vistos, publicação, cartão da forja.
- [ ] **Passo 4: rodar e ver passar** (pasta inteira, `tsc`).
- [ ] **Passo 5: commit** — `feat: comparacao: cinco mais vistos, publicacao em 90 dias e cartao da forja indisponivel`.

---

### Tarefa 10: as entradas: "Comparar" na lista, "Comparar com o meu canal" no canal e o atalho "Meu canal"

**Arquivos:**
- Criar: `C/_chrome/meu-canal.tsx`, `C/_chrome/meu-canal.css`, `C/_chrome/own-menu.ts`, `L/own-menu.ts`, `C/_chrome/gatilho-volta.ts`
- Modificar: `C/_chrome/view-model.ts`, `C/_chrome/observatory-chrome.tsx`, `C/_chrome/trail-chrome.tsx`, `C/_chrome/trail-chrome.css`, `C/_chrome/page-data.ts`, `C/canal/[id]/page.tsx`, `C/video/[id]/page.tsx`, `C/comparar/page.tsx`, `C/_canal/canal-header.tsx`, `C/_canal/canal-screen.tsx`, `C/_canal/canal.css`, `C/_canais/view-model.ts`, `C/_canais/channel-table.tsx`, `C/_canais/channel-cards.tsx`, `C/_canais/canais-screen.tsx`, `C/_canais/canais.css`
- Teste: `T/own-menu.test.ts`, `T/meu-canal.test.tsx` (jsdom), `T/canais-a3-comparar.test.tsx` (jsdom), `T/gatilho-volta.test.ts`; ajustar `T/canal-header.test.tsx` (linha 276), `T/trail-chrome.test.tsx`, `T/chrome.test.tsx`, `T/chrome-view-model.test.ts`, `T/canal-page-data.test.ts`

**Interfaces:**
- Consome: `link.comparar` (Tarefa 5), `ownChannelHref` (Tarefa 2), `obs.ownChannels()`, `readOwnChannels` (`L/load.ts:471`), `Popover`, `TrailChrome` (`:26`), o grupo `.obs-ch-actions` (`C/_chrome/observatory-chrome.tsx:199`, ao lado de "Adicionar canal"), "Abrir no YouTube" (`C/_canal/canal-header.tsx:82`).
- Produz:
  ```ts
  // C/_chrome/own-menu.ts — puro
  export interface OwnMenuItem { id: string; name: string; nota: string; href: string | null }   // nota: "35 vídeos, 1,16 mil inscritos" | "sem vídeos, 3 inscritos: ainda sem página"; href null = sem vídeos
  export interface OwnMenu { itens: OwnMenuItem[]; principal: OwnMenuItem | null; listaHref: string }   // principal = D16
  export function ownMenuOf(obs: Observatory): OwnMenu                       // telas que leem o site
  export function ownMenuFromRows(rows: ReadonlyArray<{ id: string; name: string; subs: number; videos: number }>, fmt: Fmt): OwnMenu
  // L/own-menu.ts — server-only
  /** Canais próprios do site com a contagem de vídeos visíveis. Cliente de serviço: quem chama já passou a guarda de acesso e tira siteId de getSiteContext(). */
  export async function loadOwnMenuRows(siteId: string): Promise<Array<{ id: string; name: string; subs: number; videos: number }>>
  // C/_chrome/page-data.ts — ChannelPage ganha: owns: OwnMenu
  // C/_chrome/trail-chrome.tsx — TrailChrome ganha: owns?: OwnMenu | null      (dado simples; nenhuma função)
  // C/_chrome/meu-canal.tsx — cliente
  export function MeuCanal({ owns, atual }: { owns: OwnMenu; atual?: string }): JSX.Element | null   // null sem canal próprio
  // C/_chrome/gatilho-volta.ts — sessionStorage em try/catch
  export function lembrarGatilho(lugar: 'canais' | 'canal', canalId: string): void
  export function lerGatilho(lugar: 'canais' | 'canal'): string | null        // lê e apaga
  // CanaisRow ganha: comparar: { href: string; label: string } | null         // label = "Comparar <canal> com o meu canal"
  // CanalHeaderView NÃO muda: o href chega à tela por prop (compararHref: string | null)
  ```

- [ ] **Passo 1: testes que falham.**
`T/own-menu.test.ts`: `ownMenuOf` devolve os canais na ordem do motor, com a nota e `href = ownChannelHref(id)` para quem tem vídeos e `null` para quem não tem; `principal` é o primeiro com vídeos e é `null` quando nenhum tem; site sem canal próprio devolve `itens: []`; **paridade**: `ownMenuFromRows` com as linhas de `loadOwnMenuRows` (cliente simulado sobre o mesmo fixture) dá o mesmo que `ownMenuOf`; `ownMenuOf` num conjunto de um canal lança (por isso a página do canal usa a leitura leve); `loadOwnMenuRows` filtra por `site_id` e não conta vídeo escondido (`is_hidden`); erro de leitura é propagado (não vira lista vazia: lista vazia esconderia o atalho em silêncio).
`T/meu-canal.test.tsx` (jsdom):
```ts
it('o botão diz "Meu canal: <nome>" com aria-haspopup e aria-expanded; sem canal próprio o componente não existe', ...)
it('abre na camada flutuante: título "Meus canais", um link por canal com vídeos, o sem vídeos apagado com "ainda sem página", e "Ver meus canais na lista de Canais"', ...)
it('o primeiro item recebe o foco; setas, Home e End andam pelos itens; Esc fecha e devolve o foco ao botão', ...)
it('o canal apagado não é link, não entra nas setas e tem aria-disabled', ...)
it('na página do próprio canal o item tem aria-current="page"', ...)
it('invariante: todo item com href leva a um destino montado por ownChannelHref ou por link.canais', ...)
it('TrailChrome com owns desenha o atalho à direita da trilha; sem owns (ou vazio) a trilha fica como hoje', ...)
it('a moldura do Observatório desenha o atalho no grupo de ações, ao lado de "Adicionar canal", nas quatro abas', ...)
```
`T/canais-a3-comparar.test.tsx` (jsdom):
```ts
it('cada linha de concorrente tem "Comparar" na coluna "Com o meu canal", com o nome acessível "Comparar <canal> com o meu canal"', ...)
it('o link leva a comparar?a=<canal próprio principal>&b=<concorrente>', ...)
it('canal próprio não tem "Comparar"; site sem canal próprio não tem a coluna nem o link no cartão', ...)
it('nos cartões o link diz "Comparar com o meu canal"', ...)
it('o clique na linha fora do link continua abrindo a página do canal; o clique em "Comparar" não abre a página', ...)
it('cabeçalho do concorrente: "Comparar com o meu canal" ao lado de "Abrir no YouTube", fora do menu ⋯; sem canal próprio, ausente', ...)
it('o gatilho usado é lembrado; ao voltar (popstate) a lista põe o foco no "Comparar" daquela linha e a página do canal no botão do cabeçalho', ...)
it('sem registro, ou com armazenamento que lança, a tela volta como hoje', ...)
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** `buildChromeView` ganha `owns: ownMenuOf(obs)` (o conjunto do site). `openChannelPage` lê `loadOwnMenuRows(siteId)` **em paralelo** com o conjunto do canal (dentro do `Promise.all` de `page-data.ts:50`) e devolve `owns`; as duas saídas de `C/canal/[id]/page.tsx` (encontrado e "Canal não encontrado") passam `owns` à moldura. `C/video/[id]/page.tsx` e `C/comparar/page.tsx` passam `ownMenuOf(obs)`. O menu é `Popover` com `role="menu"` e os itens são `Link` com `role="menuitem"`, importados no módulo cliente (modelo: `C/_chrome/menu.tsx`). Forma de `M/meu-canal.css`; em 390 px o rótulo "Meu canal:" some e fica o nome. Na linha da trilha a ordem é: trilha, atalho, `aside` (o pager do Histórico), nota de fuso; confira que a regra de `trail-chrome.css:24` (o `aside` desce abaixo de 1180 px) continua valendo com o atalho na linha. Em Canais, "Comparar" é um `Link` dentro da célula e o `onClick` da linha já ignora `a` (`channel-table.tsx:51`). O teste `'"Comparar com o meu canal" não existe nesta fase (D4)'` (`T/canal-header.test.tsx:276`) **inverte** no mesmo commit. O lugar reservado no CSS do cabeçalho pela A1 (D4 daquele plano) é usado; meça de novo a altura do cabeçalho do canal (teto de 150 px).
- [ ] **Passo 4: rodar e ver passar** (pasta inteira, `tsc`).
- [ ] **Passo 5: commit** — `feat: entradas da comparacao (lista, cartao e cabecalho do canal) e atalho Meu canal nas molduras`.

---

### Tarefa 11: prova no navegador da comparação e das entradas (`comparar-a3.spec.ts`)

**Arquivos:**
- Criar: `E/comparar-a3.spec.ts`
- Modificar: `E/canais-a3.spec.ts` (acrescenta as entradas), `E/canal.spec.ts` (só o que mudou no cabeçalho), `E/flutuantes.spec.ts` (inventário: o menu "Meu canal", o ⓘ da tabela, a dica da régua)

**Interfaces:**
- Consome: o padrão da Tarefa 4; `ensureSeeded({ ownPreset: '2', canalCompleto: true })`.

- [ ] **Passo 1: escrever o spec.** 1440×900, tema escuro; todo `POST` de server action falha o teste.
```ts
test('A3.3 "Comparar" de uma linha de Canais abre a comparação com o meu canal no lado A e o concorrente no B', ...)
test('A3.3 Voltar devolve a lista com a rolagem e o foco no "Comparar" usado', ...)
test('A3.3 "Comparar com o meu canal" no cabeçalho do concorrente abre a comparação; Voltar devolve o foco ao botão', ...)
test('A3.3 o atalho "Meu canal" existe em Canais, na página do canal, no Histórico e na comparação; abre, anda com as setas, fecha com Esc e devolve o foco', ...)
test('A3.3 o menu "Meu canal" fica inteiro na janela e acima do conteúdo em 1440 e em 390 px', ...)
test('A3.5 a URL reproduz o par: recarregar mantém os dois lados; a=lixo e a=b abrem no padrão sem erro no console e sem 500', ...)
test('A3.5 trocar o seletor não faz nenhuma requisição de documento nem de RSC, e a tabela muda em menos de 100 ms', ...)
test('A3.5 "Inverter lados" troca os canais e as cores juntos; a URL troca a e b', ...)
test('A3.5 o canal do outro lado está desabilitado no seletor', ...)
test('A3.6 treze linhas no par completo; linha sem dado nos dois lados não aparece e o rodapé a conta', ...)
test('A3.6 o lado do canal próprio mostra "não medido" com o motivo em views por dia; nenhum "0" inventado', ...)
test('A3.6 a régua: um traço por canal do conjunto, dois destacados; a dica abre por teclado e fica dentro da janela', ...)
test('A3.6 dois canais de nichos diferentes: posições "no geral" e o nicho de cada um ao lado do nome', ...)
test('A3.7 os cinco mais vistos abrem o Histórico do vídeo; a faixa de publicação tem os dois canais no mesmo eixo', ...)
test('A3.7 o botão do cartão da forja está apagado e não envia nada', ...)
test('cor nunca sozinha: em escala de cinza os dois lados se distinguem pela letra e pelo chip', ...)
test('sem rolagem horizontal da página em 1440, 1024, 768, 390 e 320 px; abaixo de 820 px a tabela vira pilha com rótulo', ...)
test('tema claro: os dois lados e o "não medido" legíveis (contraste de texto medido)', ...)
test('alvos: 24 px sempre e 44 px em 390 px nos seletores, em "Inverter lados" e nos links', ...)
```
- [ ] **Passo 2: rodar em fundo** (saída em `$SCRATCH/pw-t11.txt`), junto com `E/canais-a3.spec.ts`, `E/canal.spec.ts` e `E/flutuantes.spec.ts`. Defeito de código das Tarefas 5 a 10 é **consertado aqui**, com o teste unitário que faltava, e relatado um por um.
- [ ] **Passo 3: medidas** em `apps/web/test-results/comparar-a3-medidas.txt`: tempo da troca de seletor, altura até "Número a número", altura do cabeçalho do concorrente com o botão novo, quantas linhas da Leitura rápida em 390 px (seção 20, item 5), tamanho do documento da rota.
- [ ] **Passo 4: commit** — `test: prova em navegador da comparacao e das entradas (A3)`.

---

### Tarefa 12: corte do painel lateral de concorrente (código morto da A1) — pode ser pulada (D20)

**Arquivos:**
- Modificar: `C/_canais/view-model.ts` (`drawerOf`, `forjaOf`, `DrawerView`, `CanaisDrawerForja`), `C/_canais/canais-screen.tsx`, `C/_canais/channel-drawer.tsx`, `C/_canais/row-menu.tsx`, `C/page.tsx`
- Apagar (só se nada mais os importar): `C/_canais/drawer-forja.tsx`
- Teste: `T/canais-a3-painel.test.ts`; ajustar ou apagar os testes do painel de concorrente em `T/canais-view-model.test.ts`, `T/canais-screen.test.tsx`, `T/canais-pinned.test.tsx`, `T/canais-pending.test.tsx`, `T/forja-ui.test.tsx`, `T/final-fix-round.test.ts`, `T/fix-wave-a.test.ts`

**Interfaces:**
- Consome: `competitorChannelRedirect` (`C/_canais/legacy.ts:17-21`): a página já manda `?channel=<concorrente>` para `canal/<id>` antes de montar a tela.
- Produz: `buildCanaisView` devolve `drawer` **só para canal próprio**; `CanaisView.drawerForja` e as props `onAskForja`, `onPin`, `onUnpin` de `CanaisScreen` deixam de existir.

- [ ] **Passo 1: o teste que fixa a fronteira, antes de apagar** (`T/canais-a3-painel.test.ts`)
```ts
it('?channel= de um concorrente: drawer null (a página do canal é quem o mostra)', ...)
it('?channel= de um canal próprio: o painel de hoje, com as mesmas abas, números e frases (comparado campo a campo com o de antes do corte)', ...)
it('canal próprio sem vídeo longo recente: as notas de hoje continuam', ...)
it('?channel= desconhecido: drawer null e drawerDropped false, como hoje', ...)
it('a moldura continua recebendo forja e forjaBar (o pedido do nicho em Canais não muda)', ...)
```
O segundo teste guarda **antes** do corte o `drawer` de um canal próprio (um JSON em `T/__fixtures__/` gerado pelo próprio teste na primeira execução e commitado) e o compara depois.
- [ ] **Passo 2: rodar e ver o primeiro falhar** (hoje o modelo monta painel de concorrente).
- [ ] **Passo 3: cortar.** `drawer = dc && dc.own && !drawerDropped ? drawerOf(dc) : null`. Em `drawerOf`, com `c.own` sempre verdadeiro, saem: os cartões de troca (`cards`, `groupsOf` se ficar sem uso), a lista de fixados (`pinnedV`), o `link` de trocas, e os ramos `c.own ? … : …` viram o lado do canal próprio. `forjaOf` passa a devolver só `forja` e `forjaBar`. Na tela saem `DrawerForjaBox`, `DrawerForjaFoot`, `PinProvider` e as props que só eles usavam; `C/page.tsx` deixa de passar `askForjaReading`, `pinVideo` e `unpinVideo` à tela (a moldura continua recebendo o que recebe). **Regra de parada:** se um tipo ou componente apagado ainda for importado por Mudanças, Outliers, Histórico ou pela página do canal, ele fica; na dúvida, fica, e o relatório diz por quê. Não apague `RemoveDialog`, `row-menu.tsx` nem `remove-dialog.tsx` (a lista e a página do canal os usam).
- [ ] **Passo 4: os testes.** Teste cujo assunto é o painel de **concorrente** é apagado; teste do painel de canal próprio fica sem mudar afirmação. Liste no relatório cada teste apagado (arquivo, nome) e a contagem por arquivo.
- [ ] **Passo 5: rodar e ver passar** (pasta inteira, `tsc`, e `E/canais-a3.spec.ts` em fundo: "Abrir meu canal" ainda abre o painel).
- [ ] **Passo 6: commit** — `refactor: Canais: painel lateral so para canal proprio (concorrente tem pagina desde a A1)`.

---

### Tarefa 13: validação autenticada, suíte inteira e fecho

**Arquivos:**
- Modificar: `docs/superpowers/plans/2026-10-08-proximos-passos.md` (seção nova "3i", no formato da 3h), o ledger

- [ ] **Passo 1: suíte inteira, typecheck e build**, em fundo, com saída em arquivo: `cd apps/web && npx vitest run > $SCRATCH/vitest-all.txt 2>&1`; `npx tsc --noEmit -p . > $SCRATCH/tsc.txt 2>&1`; `npm run build:web > $SCRATCH/build.txt 2>&1` (a partir da raiz). No contexto, só as falhas. Registre o tempo dos arquivos novos (`canais-a3-*`, `comparar-*`, `regua-*`, `posicao`, `own-menu`, `meu-canal`): nenhum acima de 20 s.
- [ ] **Passo 2: Playwright** `E/canais-a3.spec.ts`, `E/comparar-a3.spec.ts`, `E/canal.spec.ts`, `E/historico-a2.spec.ts` e `E/flutuantes.spec.ts`, em fundo.
- [ ] **Passo 3: validação logada no CMS local** (`docs/ops/runbook-cms-e2e-local.md`), em navegador, 1440 px, tema escuro, com dois canais próprios semeados (um sem vídeos). Roteiro, conferindo **item a item A3.1 a A3.7** da seção 4.2 do spec:
  1. Canais: os três formatos, as seis ordenações nas duas direções, as duas escalas, tabela e cartões, um nicho e "Todos"; a frase do bloco em cada uma; a linha presa; a busca; "só com problema".
  2. As quatro abas da moldura (Canais, Mudanças, Outliers, Insights): o atalho "Meu canal" presente e funcionando.
  3. As entradas: "Comparar" na linha e no cartão; "Comparar com o meu canal" no cabeçalho de um concorrente; o atalho na página do canal, no Histórico e na comparação.
  4. Comparação: meu canal × concorrente do mesmo nicho; × concorrente de outro nicho; × canal sem nicho; concorrente × concorrente (lado A areia); meu canal × o canal próprio sem vídeos; inverter; trocar os dois seletores.
  5. O que **não** pode ter mudado: adicionar canal (abrir e fechar o formulário, sem enviar), menu ⋯ da linha, editor de nicho, o painel lateral do canal próprio, a página do canal do concorrente, o Histórico.
  Console sem erro, nenhuma resposta 500. Repetir o roteiro curto em 390 px e no tema claro. Capturas em `M/shots/a3/`, veredito em texto no relatório.
- [ ] **Passo 4: registrar** na seção 3i do roteiro: o que foi medido; as decisões D1 a D20 que o dono pode reverter, com destaque para D2, D3, D4, D6, D7 e D12; as frases de tela que não estão no spec (D4 e as que surgirem); os pontos da seção 20 do spec que nascem aqui e como ficaram (itens 1, 2, 3, 4, 5, 6, 7 e 11); o que nenhum agente conferiu (Opera, leitor de tela na tabela da comparação e na régua, zoom alto, toque real, dados reais de produção em concorrente × concorrente); os achados menores adiados; o que a A4 herda (`ownChannelHref`, o cartão "Só o seu canal mede", o destino dos cinco mais vistos do canal próprio, `is_short` da coleta, o corte do painel se a Tarefa 12 foi pulada).
- [ ] **Passo 5: commit** — `docs: roteiro 3i, fase A3 das telas`.

## Revisão própria (feita ao escrever)

- **Cobertura do spec:** A3.1 → Tarefas 1 e 4; A3.2 → Tarefas 2, 3 e 4; A3.3 → Tarefas 10 e 11; A3.4 → D1 (decisão registrada antes de começar) e Tarefa 3; A3.5 → Tarefas 5, 8 e 11; A3.6 → Tarefas 5, 6, 7, 8 e 11; A3.7 → Tarefas 9 e 11. Emenda 45 (a) a (d) → Tarefas 2 e 6, D3 e D11. Seção 11, linhas 20 e 21 → Tarefas 7 e 8. Seção 19.1 (inventário de flutuantes) → Tarefas 3, 7, 8, 10 e 11. Pendência da A1 (painel morto) → Tarefa 12. D4 do plano da A1 ("Comparar com o meu canal" e "Meu canal") → Tarefa 10.
- **Fora desta fase, de propósito:** página do canal próprio e vídeo próprio (A4); "Só o seu canal mede" (D17); `is_short` do canal próprio pela coleta (D8); pedido real de leitura de comparação (L4); as quatro colunas novas do mockup na lista (D1); filtro "só longos" nos cinco mais vistos e comparação com mais de dois canais (spec, seção 13); "Comparar com…" no cabeçalho do canal próprio e o formulário "No nicho" (entradas 3 e 4 de 18.1: moram na página do canal próprio, A4).
- **Nomes entre tarefas:** `CanaisFmt` e `fmtDaOrdem` (T1) são usados na T2; `posicoes`, `Conjunto` e `ownChannelHref` (T2) são usados nas T5, T6 e T10; `view.list`, `own.block` e `pe` (T2) são desenhados na T3; `NumeroId`, `Numero`, `CompararPack` e `link.comparar` (T5) são usados nas T6, T8, T9 e T10; `buildPar` e `resolverPar` (T6) e `ReguaNicho` (T7) são usados na T8; `OwnMenu` (T10) entra nas molduras que as T8 e a A2 já criaram.
- **Contradições achadas ao escrever (todas viraram decisão):** (1) a emenda 45 pede numerar todos juntos em "Todos", e a produção agrupa por nicho (D2); (2) a pergunta 6 mantém colunas que não estão entre os seis números com posição (D3); (3) 15.5 tira os vídeos de formato não confirmado dos longos, e o motor os conta como longos em todas as telas (D7); (4) 18.9 aponta `channelStats().tracked` para "longos acompanhados", que soma todos os formatos (D10); (5) 18.4 pede "sempre nomeando o maior" e também a forma "8,7% dos…", que só existe partindo do lado A, e o mockup ainda escreve "B em relação a A" (D12); (6) 18.5 escreve "no nicho" e a emenda 45 exige o nome do conjunto (D4, D11); (7) a frase "sem contagem diária ainda" que 15.5 atribui a `channelStats` mora em `C/_canal/header-model.ts:92`; (8) a célula de Views/dia do canal próprio diz hoje "Sem views diárias do seu canal." (`view-model.ts:295`), e o bloco dirá a frase do spec 15.2: as duas ficam, a da célula por D1.
- **Risco maior:** a Tarefa 3 troca a estrutura da lista de uma tela em produção (grupos por nicho e canal próprio fixo no topo) e mexe em dezenas de testes; a prova em navegador vem logo depois dela (Tarefa 4). O segundo é a Tarefa 8, a primeira rota nova desde a A1, com o estado na URL sem navegação. A Tarefa 12 só apaga, e por isso tem o teste de fronteira antes do corte e pode ser pulada.
