# Observatório em torno de canal e vídeo — telas

Data: 07/10/2026 · Estado: rascunho v7 · Base: `staging` 6dd468ae. Specs irmãos: `2026-10-07-coleta-canais-proprios-design.md` ("spec de coleta") e `2026-10-07-ab-lab-honesto-design.md` ("spec do A/B"). Este documento descreve telas, em texto e wireframe; mockup HTML vem depois (seção 12). Caminhos sem prefixo são relativos a `apps/web/src/app/cms/(authed)/youtube/competitors/`; `lib/` é `apps/web/src/lib/youtube/observatorio/`. Nos wireframes, 📌 🔍 ↗ ⋯ ⓘ representam ícones SVG de `_historico/icons.tsx` (`HIcon`), nunca emoji.

## 1. Para quem e para quê
- Quem usa: o dono do canal e uma editora de vídeo, no desktop, tema escuro.
- Pergunta que a pessoa traz: "o que este canal publicou e o que deu certo?" e depois "o que aconteceu com este vídeo?".
- Hoje o caminho passa por "trocas" e por um painel de 404 px que mostra 5 vídeos. Passa a ser canal → vídeo.
- Precisa parecer produto que se vende: navegar não dá tranco e nenhum número é inventado.
- Nenhuma tabela nova de métricas. A grade exige as mudanças no carregador de 5.8; leitura por canal exige o trabalho de servidor de 7.3.

**Vocabulário, igual em todas as telas.** "Sincronizar" e "sincronização": buscar dados de concorrente no YouTube. "Coleta": só os dados dos canais próprios. "Leitura": só o texto da forja. "Resumo": só a faixa de números do vídeo. "Múltiplo": quantas vezes o vídeo fica acima do normal do canal, com o nível por escrito: de 2 a 5, "alto"; de 5 a 10, "muito alto"; 10 ou mais, "topo"; abaixo de 2, sem palavra. "Trocas": mudanças de título e de thumbnail nos últimos 30 dias, a mesma janela em todo lugar. Horários em São Paulo; só os dados dos canais próprios são "dia do YouTube", dito uma vez por seção, no cabeçalho, com o botão ⓘ.

## 2. Linguagem visual reutilizada
Nada de paleta ou fonte nova.

| O quê | Valor real | Onde |
|---|---|---|
| Superfícies e linhas | `--bg #1A1714`, `--surface #221E1A`, `--surface-2 #272219`, `--sunk #16130F`; `--border #332D25`, `--border-subtle #2A251F`, `--border-strong #40382D` | `_chrome/chrome.css:8-9` |
| Texto | `--text #F5EFE6`, `--muted #A89D88`, `--dim #958A75`. Corpo mínimo de 12 px na interface nova (há 11 e 11,5 px em `chrome.css`; não se copiam) | `chrome.css:10` |
| Ação da pessoa | `--accent #FF8240` sobre `--on-accent #1A120A`; no máximo um botão preenchido por vista | `chrome.css:11`; `docs/superpowers/mockups/2026-10-02-observatorio/CONVENCOES.md`, "Hierarquia de ações" |
| Forja | `--forja #5CC3B2`, `--forja-subtle rgba(92,195,178,.12)`, `--forja-line rgba(92,195,178,.35)`, `--on-forja #0E2A25` | `chrome.css:13` |
| Estado | `--success`, `--warning-text`, `--danger #F26B6B`; fundos `--warn-subtle`, `--danger-subtle`, `--ok-subtle` (rgba literais) | `chrome.css:12,16` |
| Níveis do múltiplo | `--tier-mid #38BDF8`, `--tier-high #A78BFA`, `--tier-top #E0735C`, sempre com a palavra do nível | `chrome.css:15` |
| Tipos | Inter (`--font-sans`) na interface; JetBrains Mono (`.num`/`.mono`, `tabular-nums`) só em números; Fraunces só no título da página e no texto das leituras | `CONVENCOES.md`, "Tipografia e números" |
| Botões | `.obs-ch-btn` (34 px, `chrome.css:57`), `.obs-ch-ghost`, `.obs-ch-forja-solid` (`chrome.css:67`). A tela nova adota 34 px. Os `.btn` de cada tela não são copiados: 36 px em `canais.css:33` (32 px é `.btn.small`), 34 px em `historico.css:37` | `_chrome/chrome.css` |
| Largura, grade, raios | conteúdo em `max-width:1240px` (`chrome.css:44`); `.obs-out-grid` `repeat(auto-fill,minmax(232px,1fr))`, `gap:14px` (`_outliers/outliers.css:86`); raio 8 px cartão, 6 px controle, 4 px selo | contagem nos seis `.css` |
| Foco | `outline:2px solid var(--accent); outline-offset:2px`, nunca cortado pelo `overflow` do cartão | `canais.css` |

**Reuso exige promoção.** As classes estão presas a uma tela por seletor: `.dstats`, `.btn`, `.youtag` sob `[data-obs-screen="canais"]`; `.stamp` sob `[data-obs-screen="insights"]`; `.obs-out-card`, `.obs-out-ttl` sob `.obs-out`. O plano as promove para `_chrome/` com prefixo `obs-ch-`. `Thumb` e `MultBlock` (`_outliers/outlier-card.tsx`) recebem hoje o `OutlierCardView` inteiro; passam a aceitar uma prop mínima.

Princípios destas telas:
1. **A thumbnail é o assunto.** Em Capas ela aparece inteira, em 16:9. O corte 2,6:1 de Outliers (`outliers.css:92`) não se repete.
2. **Os números não mudam de lugar.** Views, views/dia e múltiplo ficam na mesma ordem. A ordenação só muda qual fica em `--text` com peso 600.
3. **O que falta ocupa o lugar do que faltou.** Célula sem dado mostra uma frase curta ("não medido", "sem contagem"). Nunca "0" inventado, nunca "—" sozinho. Vídeo que não pode ser ordenado vai para o fim, sob um divisor com contagem; nenhum some.
4. **A página não se mexe enquanto carrega.** Cabeçalho, abas e controles ficam; só o miolo troca.
5. **Teal é a forja, laranja é a ação da pessoa.** Texto do modelo vem sob o selo, em Fraunces; frase do site fica fora do selo, em Inter (como em `_insights/reading-hero.tsx`).
6. **O conteúdo começa cedo.** Em 1440×900 a grade começa a no máximo 300 px do topo, e o gráfico do vídeo e a comparação aparecem sem rolar.

## 3. Mapa de navegação
`link` hoje tem `canais`, `mudancas`, `outliers`, `insights`, `historico` (`lib/links.ts:68-153`). Nas páginas de canal e de vídeo a moldura do Observatório mostra só a trilha (sem as abas de seção nem a barra de nicho); a seção de origem continua sendo "Canais".

| Tela | URL | Helper |
|---|---|---|
| Canal | `/cms/youtube/competitors/canal/<id>?tab=videos\|trocas\|leitura\|retencao&fmt=todos\|longos\|shorts\|fixados&sort=recentes\|vistos\|multiplo\|vpd&dir=asc\|desc&q=<texto>&ver=capas\|lista&n=<quantos na tela>` | novo `link.canal(id, p)`; os padrões ficam fora da URL. Aceita `from` e `back` só quando vem de Outliers, Mudanças ou do vídeo |
| Vídeo | `/cms/youtube/competitors/video/<id>?from=canais&canal=<id>&back=…&ids=…#resumo` (rota que já existe) | `link.historico` ganha `canal` (o nome do helper e o valor `from=canais` não mudam) |

- `link.canais({ channel })` continua aceito por um ciclo e redireciona para `link.canal(id)`.
- `ids=` leva no máximo 100 ids, em torno do vídeo aberto. O pager conta a lista filtrada ("7 de 51").
- Anterior/Próximo **substituem** a entrada do histórico. "Voltar" sai para a lista de origem, no cartão do **último** vídeo visto, com o foco nele; `n` cresce até incluí-lo. Rolagem e foco voltam pelo histórico do navegador, não pela URL. O item do canal na trilha equivale ao Voltar do navegador quando a pessoa veio do canal.

| Entrada | Leva a | "Voltar" preserva |
|---|---|---|
| Linha ou cartão em Canais (nome e avatar) | Canal, aba Vídeos | nicho, busca, ordenação e rolagem da tabela |
| Nome do canal em Outliers, em Mudanças ou na trilha do vídeo | Canal | filtros da tela de origem (em `back=`) |
| "Ver fixados" (Canais) | Canal com `fmt=fixados` | idem |
| Thumbnail ou título na grade ou na lista do canal | Vídeo, com `canal=<id>` e `ids=` da vizinhança filtrada e ordenada | aba, filtro, ordenação, busca, vista e quantidade |
| Cartão de Outliers, linha de Mudanças, item de Insights | Vídeo, com o `from` de hoje | como hoje (`back=` começa com `?`, `links.ts:147`) |
| Capa anterior na tira de capas, ou marca de troca no gráfico | preenche a comparação na mesma página | — |

Trilha do vídeo: "Canais › <canal> › Vídeo". O segundo item já existe como `crumbs.sub` (`_historico/pager.tsx:12`); o rótulo "Histórico do vídeo" (`pager.tsx:13`, `video/[id]/page.tsx:12`) passa a "Vídeo".

## 4. Fase A — paliativo no painel atual
1. Ordem das abas: "Vídeos", "Outliers", "Trocas" (hoje `TABS` começa por Trocas, `_canais/channel-drawer.tsx:21-25`).
2. Aba inicial "Vídeos" (hoje `'trocas'` em `channel-drawer.tsx:94` e `_canais/view-model.ts:540`). `link.canais` passa a aceitar `tab: 'trocas'` e deixa de emitir `tab=videos`.
3. Nas listas de vídeos e de outliers, thumbnail e título viram link para o vídeo (hoje o título é um `div.t`; painel `cn-pVid`). O botão "Ver histórico do vídeo" continua.

Não muda agora: o corte em 5 vídeos (`view-model.ts:520`), a largura (`canais.css:315`: `minmax(0,1fr) var(--drawer-w,404px)` a partir de 1280 px), o botão da forja.

## 5. Página do canal
### 5.1 Wireframe, 1440×900 (concorrente, vista Capas)
```
 Canais › Nomad Capitalist BR                                                    Horários em São Paulo
 (av) Nomad Capitalist BR  [Viagem ▾]  @nomadbr ↗  212 mil inscritos           [Abrir no YouTube] [⋯]
      1,5 longo + 3,0 Shorts por semana · 4,2 mil views/dia nos longos · +2,1% inscritos em 30 d
      Sincronizado há 6 h · 51 vídeos: 48 recentes, 3 fixados antigos                 (cabeçalho ≤ 150 px)
  Vídeos 51     Trocas 7 em 30 d     Leitura
 ──────────────────────────────────────────────────────────────────────────────────────────────────────
 [Todos 51|Longos 31|Shorts 18|Fixados 3]  [Mais recentes ▾]  [🔍 Buscar por título     ]  [Capas|Lista]
 ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐  ← ≤ 300 px
 │ thumb 16:9      │ │ thumb           │ │ thumb  formato  │ │ thumb 📌        │ │ thumb           │    do topo
 │ 2 trocas   12:41│ │            Short│ │ não confirmado  │ │             8:02│ │ 1 troca    21:15│
 │ Título em até   │ │ Título em até   │ │ Título…         │ │ Título…         │ │ Título…         │
 │ duas linhas     │ │ duas linhas     │ │                 │ │                 │ │                 │    cartão
 │ há 3 d      [⋯] │ │ há 5 d      [⋯] │ │ há 9 d      [⋯] │ │ há 14 meses [⋯] │ │ há 22 d     [⋯] │    ~215 px
 │ 84 mil views    │ │ 1,2 mi views    │ │ sem contagem:   │ │ 310 mil views   │ │ 12 mil views    │
 │ 6,1 mil/dia     │ │ 40 mil/dia      │ │ ainda buscando  │ │ fixado antigo:  │ │ 480/dia         │
 │ 3,4× alto       │ │ 8,2× muito alto │ │                 │ │ sem views/dia   │ │ 0,6×            │
 └─────────────────┘ └─────────────────┘ └─────────────────┘ │ nem múltiplo    │ └─────────────────┘
 … segunda fileira inteira visível …                         └─────────────────┘
 ── Sem data de publicação (3) ────────────────────────────────────────────────────── [Mostrar mais 60]
```
No wireframe os três números estão empilhados só por falta de largura do desenho: no cartão real ficam em **uma** linha ("84 mil views   6,1 mil/dia   3,4× alto"). Ao rolar, só a linha de controles fica presa.

Vista **Lista** (`ver=lista`): tabela, linha de 56 px, pelo menos 8 na dobra; o cabeçalho de coluna ordena.
```
 Vídeo                                          Publicado  Views    Views/dia  Múltiplo         Curtidas  Comentários  Trocas
 [thumb 96 12:41] Como morar em Lisboa gast…    há 3 d     84 mil   6,1 mil    3,4× alto        2,1 mil   140          2
 [thumb 96 Short] 3 erros na imigração          há 5 d     1,2 mi   40 mil     8,2× muito alto  40 mil    não medido   0
```
### 5.2 Canal próprio e ~390 px
```
 (av) tnfigueiredotv  [seu canal] [PT]  [Viagem]  @tnfigueiredotv ↗  1,9 mil inscritos
  Vídeos 35     Trocas —     Leitura     Retenção
 ─────────────────────────────────────────────────────────────────────────────────────────
 ┌ thumb      12:41 ┐   cartão do canal próprio: "1,2 mil views" e "sem views diárias";
 │ Título…          │   sem múltiplo e sem selo de troca
 └──────────────────┘
```
Em canal próprio o carregador monta os vídeos sem série diária e sem versões de capa (5.8). Por isso: a aba "Trocas" mostra "—" e, dentro dela, "Trocas de título e capa dos seus vídeos ainda não são lidas nesta tela."; a página do vídeo próprio diz "Sem série diária do seu canal ainda." no lugar do gráfico.
```
 ‹ Canais                                   (~390 px)
 (av) Nomad Capitalist BR   [Viagem ▾] @nomadbr ↗  212 mil inscritos
 1,5 longo + 3,0 Shorts por semana · 4,2 mil views/dia nos longos · +2,1% em 30 d
 Sincronizado há 6 h · 51 vídeos
 Vídeos 51 │ Trocas 7 em 30 d │ Leitura      ← abas e filtro rolam na horizontal; alvos de 44 px
 [Todos|Longos|Shorts|Fixados]  [Mais recentes ▾]  [Capas|Lista]  [🔍 Buscar…]     (nada fica preso)
 ┌ thumb 16:9 ──────── 12:41 ┐   uma coluna. Lista vira pilha: cada vídeo é um bloco
 │ Título em até duas linhas │   com rótulo e valor ("Views: 84 mil").
 └ 84 mil views  6,1 mil/dia  3,4× alto ┘
```
### 5.3 Cabeçalho (até 150 px)
- **Linha 1:** avatar, nome (`h1`, Fraunces, 22 px), selo "seu canal" quando próprio, nicho, @ com link externo, inscritos; à direita "Abrir no YouTube" e o menu ⋯ ("Sincronizar só este canal"; "Remover canal…" só para quem administra). `NicheSelect` é editável para todos em concorrente; em canal próprio é só leitura para a editora (`channel-drawer.tsx:116`).
- **Linha 2, em texto:** os números que o painel já calcula em `DrawerView.stats` (`_canais/view-model.ts:436-460`): ritmo (`obs.cadence`), views/dia (`S.vpdMedian`), crescimento (`S.growth30`). Cada um tem o botão ⓘ com a base ("mediana em 14 longos, últimos 90 dias"). O engajamento sai do cabeçalho.
- **Linha 3:** "Sincronizado há 6 h · 51 vídeos: 48 recentes, 3 fixados antigos". Em `--warning-text` quando a sincronização está atrasada; em `--danger`, com "Erro:", quando falhou.
- Nenhum botão preenchido no cabeçalho.
### 5.4 Cartão de vídeo (vista Capas, ~215 px)
Reaproveita `Thumb`, `.obs-out-ttl` (13,5 px, 2 linhas) e `MultBlock` compacto, com as props mínimas da seção 2. Muda:
- Sai o cartão principal de duas colunas (`.obs-out-lead`), o nome do canal, o chip de nicho, a régua e a frase "por quê".
- Thumbnail em 16:9; ela e o título são um link só para o vídeo.
- Três números numa linha, na mesma ordem. O múltiplo leva a palavra do nível e, no botão ⓘ, "contra os longos do canal" ou "contra os Shorts do canal".
- Selos sobre a thumbnail, todos texto e nenhum controle: duração ou "Short", "fixado", "sem duração", "formato não confirmado", "sem data", "2 trocas".
- Um botão "Ações do vídeo" (⋯), sempre visível: "Fixar"/"Desafixar", "Abrir no YouTube", "Ver trocas". Curtidas e comentários ficam na Lista e na página do vídeo.
### 5.5 Controles (uma linha; rótulos exatos)
- Grupo "Formato": "Todos 51", "Longos 31", "Shorts 18", "Fixados 3".
- Ordenação (select): "Mais recentes", "Mais vistos", "Maior múltiplo", "Mais views por dia". Na Lista, o cabeçalho da coluna faz o mesmo e inverte a direção.
- Busca: texto de apoio "Buscar por título"; botão "Limpar busca". Ignora acento e maiúsculas.
- Grupo "Vista": "Capas", "Lista".
- Linha de resultado visível só em dois casos: busca ativa ("5 vídeos com “lisboa”") ou vídeos com formato não confirmado ("51 vídeos: 31 longos, 18 Shorts, 2 com formato não confirmado."). O anúncio para leitor de tela existe sempre (seção 11, linha 3).
- Divisores de fim de lista, com contagem: "Sem data de publicação (3)" em toda ordenação; "Sem múltiplo ainda (6)" e "Sem views por dia ainda (4)" só na ordenação que depende do número.
### 5.6 Abas
- **Vídeos** (padrão): a grade ou a lista.
- **Trocas**, com a contagem "7 em 30 d": os cartões de troca de hoje (`SwapCard`), em largura cheia, com o link "Ver as 7 trocas em Mudanças" (`d.swaps.link`).
- **Leitura**: o cartão de leitura (seção 7). Até 7.3 existir, mostra a leitura do nicho, rotulada "Leitura do nicho Viagem (não é só deste canal)".
- **Retenção**: só em canal próprio, desde o primeiro dia (seção 8).
### 5.7 Vazios, erros e dado ausente
- Canal sem vídeos: "Este canal ainda não tem vídeos buscados." + "Sincronizar só este canal". Aba Trocas vazia: "Nenhuma troca de título ou thumbnail nos últimos 30 dias."
- Filtro ou busca sem resultado: "Nenhum Short neste canal." / "Nenhum vídeo fixado. Fixe um vídeo para acompanhá-lo mesmo quando sair dos mais recentes." / "Nenhum vídeo com “<texto>”." + "Limpar busca".
- Id desconhecido, dentro da moldura e nunca 500: "Canal não encontrado. Ele pode ter sido removido." + "Voltar para Canais".
- Falha no miolo, com o cabeçalho no lugar: "Os vídeos não carregaram. Os números do cabeçalho são de 05/10 09:00." + "Tentar de novo".

| Dado ausente | Hoje | Na tela nova |
|---|---|---|
| Comentários nulos | viram 0 (`lib/load.ts:278`) | "não medido"; no ⓘ, "O YouTube não devolveu a contagem." |
| Curtidas nulas | sem engajamento | "não medido" |
| Marca de Short nula | entra como longo (`load.ts:240`) | selo "formato não confirmado"; conta em "Todos", fora de "Longos" e de "Shorts"; a linha de resultado mostra a soma |
| Vídeo sem data | some (`load.ts:234-235`) | entra no fim, sob "Sem data de publicação (3)", com selo "sem data", sem idade nem múltiplo |
| Duração nula | o selo some (`outlier-card.tsx:44`) | selo "sem duração" no mesmo canto |
| Fixado fora dos recentes | views congeladas, sem aviso | "fixado antigo: sem views/dia nem múltiplo", com a data da última contagem no ⓘ |
| Fixado ainda não conferido | — | "aguardando a primeira sincronização" (`aguardando-primeira`) ou "o YouTube não devolveu este vídeo" (`sem-resposta`), de `pinState` (`lib/types.ts`) |
| Views nulas | "sem contagem: <motivo>" (`view-model.ts:229`) | a mesma frase, no lugar de views e de views/dia |
| Múltiplo sem base | "—" | "poucos vídeos para comparar (2; precisa de 5)" [INFERÊNCIA: o mínimo real sai de `lib/multiplier.ts`]; vai para "Sem múltiplo ainda" |
| Canal em busca inicial | "Buscando vídeos" | faixa sobre a grade: "Buscando: 12 de 48 vídeos. Os números aparecem quando a busca terminar." |
| Sincronização atrasada | só na célula | linha 3 em `--warning-text` + faixa "Atenção: dados de 04/10 09:02. A sincronização está atrasada." |
| Sincronização com erro | só na célula | faixa "Erro: a última sincronização falhou em 06/10 09:00. Os números são de 05/10." |
| Série ou capas de canal próprio | não existem | "sem views diárias" no cartão; frases de 5.2 |

### 5.8 Trabalho no carregador (pré-requisito da grade)
- `ObsVideo.comments` passa a `number | null` (hoje `v.comment_count ?? 0`, `load.ts:278`). Todo leitor é revisto.
- `ObsVideo.isShort: boolean | null` ao lado de `fmt` (hoje `v.is_short ? 'short' : 'long'`, `load.ts:240`).
- `ObsVideo.tags`, só na rota do vídeo. A coluna já vem em `VIDEO_COLS` (`load.ts:71`), mas `rowsToDataset` não a mapeia.
- Lista e contagem dos vídeos sem data, por canal (hoje filtrados em `load.ts:234-235` e, nos próprios, `:304`).
- `loadChannelDataset(siteId, channelId)`: função nova que exporta e usa `cachedPack` (`lib/load-page.ts:59`) para um canal só, e reduz as leituras vivas ao que a tela usa. O múltiplo só compara vídeos do próprio canal, então um canal basta.
- `ChannelVideoView`: campos brutos (id, título, `pub` em ms, views, `vpd7`, `mult`, `fmt`, `isShort`, `pinned`, `pinState`, `dur`, likes, comments, `swaps` dos últimos 30 dias, `thumbSrc` = blob atual ou `mqdefault`) e, ao lado, o texto já formatado. Até 200 vídeos mais os fixados no pacote; 60 por vez na tela.
- Canal próprio: série e capas passam a vir de `yt_own_video_daily` (L2) e `yt_own_video_meta_daily` (L1a) do spec de coleta. Até lá, as frases de 5.2.
- Testes de `load`: um vídeo por caso (comentário nulo, marca nula, sem data, tags, canal próprio sem série), afirmando o valor nulo, nunca o padrão.

## 6. Página do vídeo
### 6.1 Wireframe, 1440×900 (gráfico e comparação cabem sem rolar)
```
 Canais › Nomad Capitalist BR › Vídeo                                      ‹ Anterior  7 de 51  Próximo ›
 ┌─────────────────┐  Como morar em Lisboa gastando pouco em 2026
 │ capa atual      │  publicado há 22 d (15/09 11:00) · Longo · Sincronizado há 6 h
 │ 280×158   12:41 │  [📌 Fixar]  [Abrir no YouTube]                                  (cabeçalho ≤ 190 px)
 └─────────────────┘  Capas anteriores:  [capa 1, 96 px]    [capa 2, 96 px]
                                         15/09 a 22/09      22/09 a 01/10
 ┌ Como morar em Lisboa…   Resumo │ Linha do tempo │ Versões │ Leitura     ‹ 7 de 51 › ┐ ← só isto fica preso
 ┌────────────┬─────────────┬────────────────────────────┬────────────┬──────────────┐
 │ 84 mil     │ 6,1 mil     │ 3,4× alto                  │ 2,1 mil    │ 140          │   (Resumo: 72 px)
 │ views      │ views/dia   │ contra os longos do canal  │ curtidas   │ comentários  │
 └────────────┴─────────────┴────────────────────────────┴────────────┴──────────────┘
 Linha do tempo: 2 trocas de título, 1 de thumbnail           [7 d|30 d|90 d|Tudo]  [Ver como tabela]
 │ views/dia  ▂▃▅█▇▅▄▃▃▂▂▂▃▆▇▅▄▃▂▂▂                                                 │   (gráfico + faixas
 │ título     ├── A ─────────┤▼├── B ─────────────────────                          │    ≤ 240 px)
 │ thumbnail  ├── 1 ──────────────┤▼├── 2 ────────────────                          │
 Comparação: capa 1 (15/09 a 22/09) │ capa 2 (desde 22/09) │ efeito em 7 dias          (≤ 150 px)
 ─────────────────────────────────── dobra em 900 px ───────────────────────────────────────────────
 Versões     títulos e descrições, com o período de cada um
 Tags (14)   lisboa, custo de vida, portugal, nômade digital, …                          [Ver as 14]
 Leitura     cartão de leitura do vídeo (seção 7)
```
A barra só fica presa com largura de 768 px ou mais **e** altura de 600 px ou mais. Fora disso segue o fluxo normal. Em ~390 px: capa em largura cheia, tira de capas rolando na horizontal, botões de 44 px; a faixa Resumo vira 2 colunas; o gráfico mantém a altura e ganha rolagem própria.
### 6.2 Seções, em ordem

| Seção (âncora) | Pergunta que responde | De onde vem |
|---|---|---|
| "Resumo" (`#resumo`) | Como este vídeo está hoje, perto dos outros do canal? | novo; números de `ObsVideo` |
| "Linha do tempo" (`#linha-do-tempo`) | O que aconteceu com as views, e quando o título ou a capa mudaram? | `Timeline` e `Compare` de hoje (`_historico/historico-screen.tsx`) |
| "Retenção" (`#retencao`), só canal próprio | Onde as pessoas saem e o que reassistem? | spec de coleta, `yt_own_video_retention` |
| "Versões" (`#versoes`) | Quais foram os títulos e as descrições? E as tags? | `Versions` de hoje, sem as thumbnails |
| "Leitura" (`#leitura`) | O que a forja escreveu sobre este vídeo? | `VideoReading` de hoje |

A comparação antes/depois fica logo abaixo do gráfico: uma marca de troca ou uma capa anterior a preenche. É isso que une "detalhe" e "histórico" sem aba.
### 6.3 Cabeçalho, tira de capas e Resumo
- Título (`h1`, Fraunces), "publicado há 22 d (15/09 11:00)", formato, sincronização. Ações: "Fixar"/"Desafixar" e "Abrir no YouTube". O botão da forja sai do cabeçalho (hoje em `.frow`) e vai para a seção Leitura.
- **Tira de capas (a validar no mockup; o dono ainda não respondeu).** Capa atual em 280×158; na mesma linha, as anteriores em 96 px, cada uma com o período embaixo. Escolher uma preenche a comparação. Mais de 6: "Ver as 9 capas". Versão cuja imagem não foi guardada: quadro vazio com "imagem não arquivada". Sem troca de thumbnail: só a capa atual e "Esta é a única capa desde 03/10."
- Faixa Resumo, cinco células de 72 px, com o rótulo junto do valor: "84 mil views", "6,1 mil views/dia" (média dos últimos 7 dias), "3,4× alto" com "contra os longos do canal", "2,1 mil curtidas" e "140 comentários" (cada um com a taxa sobre views). Duração fica só no selo da capa; a contagem de trocas é o título do gráfico.
- Tags depois de Versões: uma linha, até 8 visíveis, "Ver as 14" expande no lugar.
### 6.4 Barra presa e pager
- Barra de 44 px: título truncado, as seções e "‹ 7 de 51 ›". Fundo `--surface` opaco. O item da seção visível fica com peso 600 e 2 px de `--accent`. Seção sem conteúdo continua na barra e diz por quê ("Este vídeo nunca mudou desde que passou a ser observado em 03/10"). Só "Retenção" some, e só em vídeo de concorrente.
- Pager (`_historico/pager.tsx`): "‹ Anterior", "7 de 51", "Próximo ›". Sem lista de origem (link colado), não aparece. No fim da lista o botão fica desabilitado, não some. A troca mantém a barra no lugar e preserva a seção em que a pessoa estava.
### 6.5 Variações e dado ausente
- **Canal próprio.** Selo "seu canal"; a barra ganha "Retenção" entre "Linha do tempo" e "Versões"; o Resumo ganha "% assistido" (8.3). Sem múltiplo. Sem série: "Sem série diária do seu canal ainda."
- **Fixado antigo** (hoje `view.untracked`). O Resumo mostra views com "contagem de 12/08" e "fixado antigo: sem views/dia nem múltiplo". A Linha do tempo mostra só as faixas de versões, com o aviso que já existe (`fx-notice`).
- **Não encontrado.** O estado `not-found` de hoje, dentro da moldura.

| Dado ausente | Na tela |
|---|---|
| Comentários ou curtidas nulos | célula com "não medido" e o motivo no ⓘ; sem taxa |
| Duração nula | selo "sem duração"; "formato não confirmado" se a marca de Short também for nula |
| Tags | nulas: "O YouTube não devolveu tags para este vídeo." Lista vazia: "Nenhuma tag." |
| Views nulas | "sem contagem: <motivo>" na célula e no lugar do gráfico |
| Série com menos de 2 dias | "Primeira contagem diária em 08/10. O gráfico aparece no segundo dia." |
| Série cortada (`truncated`) | sob o gráfico: "A série começa em 03/10, não na publicação." |
| Sincronização do canal atrasada ou com erro | a mesma faixa da página do canal, acima da barra presa |

## 7. Forja
**Explicação, igual em todo cartão:** "A forja é um computador nosso que lê estes números e escreve uma leitura com as evidências. Não muda nada no canal. Leva de 10 a 25 minutos; pode sair desta página." Depois da primeira leitura publicada no escopo, recolhe no botão "O que é a forja?".
### 7.1 Cartão de leitura
```
┌ Leitura da forja ─────────────────────────────────────────────────────────────┐
│ [O que é a forja? ▸]                                                          │
│ ◷ Aguardando: na fila desde 14:58, atrás do pedido de temas de IA.            │
│   atualizado há 1 min        [Cancelar pedido]  [Pausar atualização automática]│
│ ───────────────────────────────────────────────────────────────────────────── │
│ [forja · Gemma 12B · em treino · gerada 05/10 14:10 (SP)]    Leitura anterior │
│ Leu 31 vídeos e 7 trocas, dados de 05/10 09:00                                │
│ Texto da leitura em Fraunces, com as evidências numeradas¹ ²                  │
│ Do site: desde então, 2 vídeos novos e 1 troca. Ver os 2 vídeos               │
│                                      [Pedir nova leitura deste vídeo à forja] │
└───────────────────────────────────────────────────────────────────────────────┘
```
Um selo só, com "em treino" dentro dele; no ⓘ: "O modelo ainda não é especialista neste assunto. Leia como rascunho e confira as evidências." Sob o selo, "Leu N vídeos e M trocas, dados de dd/mm hh:mm". Os índices ¹ ² são links para o vídeo ou a troca citados. Um botão por cartão, o único preenchido em teal (`.obs-ch-forja-solid`).

| Escopo | Onde mora | Rótulo do botão (primeira vez / depois) | Tipo |
|---|---|---|---|
| Nicho | Mudanças | "Pedir leitura das trocas de <nicho> à forja" / "Pedir nova leitura das trocas de <nicho> à forja" | `resumo-trocas` |
| Canal | Canal, aba Leitura | "Pedir leitura deste canal à forja" / "Pedir nova leitura deste canal à forja" | `leitura-canal` (7.3) |
| Vídeo | Vídeo, seção Leitura | "Pedir leitura deste vídeo à forja" / "Pedir nova leitura deste vídeo à forja" | `leitura-video` |
| Padrões | Insights | "Pedir leitura de padrões de <nicho> à forja" / "Pedir nova leitura de padrões de <nicho> à forja" | `padroes-titulo`, `padroes-titulo-shorts`, `temas` |

**Quem vê os botões:** quem pode editar o site (o dono e a editora) vê e usa os quatro e "Cancelar pedido". [INFERÊNCIA: `forja-actions.ts` não foi lido linha a linha; o plano confirma o guarda.] Sai o botão do rodapé do painel de canal, que pede `resumo-trocas` do nicho inteiro sob rótulo de canal (`_canais/drawer-forja.tsx:39`).

Texto sob o botão apagado:
- Antes do primeiro pedido (botão aceso): "Ainda não há leitura deste vídeo. Ninguém pediu uma até hoje."
- Leitura por canal: "Leitura por canal ainda não existe. Por enquanto, a leitura do nicho Viagem está logo abaixo."
- Pedido em andamento: "Há um pedido de 06/10 14:58 ainda em andamento."
- Limite do dia usado (um por tipo e nicho, `lib/forja/quota.ts`): "Já houve uma leitura de Viagem hoje. Libera amanhã às 00:00."
### 7.2 Quatro situações
A pessoa vê uma de quatro situações; o estado do código vira o detalhe da frase.

| Situação | Estado no código (`lib/forja/states.ts:33`) | Frase | Ação |
|---|---|---|---|
| Aguardando | na fila | "Aguardando: na fila desde 14:58." | "Cancelar pedido" |
| | trabalhando | "Aguardando: a forja está escrevendo desde 15:00. Leva de 10 a 25 minutos." | — |
| | nova tentativa | "Aguardando: o texto citava números que não batem com os dados. A forja tenta de novo às 15:30." | — |
| | liberado pelo vigia | "Aguardando: o pedido travou e voltou para a fila sozinho, às 15:30." | — |
| Aguardando, com atraso | atrasado | "Aguardando, com atraso: esperando há 40 min, mais que o normal. Se passar de 15:40, a tela avisa aqui." | "Cancelar pedido" |
| | sem máquina | "Aguardando, com atraso: a forja está desligada ou sem internet desde 13:40. O pedido fica guardado e roda quando ela voltar." | "Cancelar pedido" |
| Pronta | publicado | "Pronta: leitura publicada às 15:18." | — |
| Precisa de você | recusado (dado velho) | "Precisa de você: os dados deste canal são de 02/10, antigos demais para ler." | "Sincronizar este canal"; depois, "Pode pedir de novo." |
| Não deu | falhou | "Não deu: o texto citava números que não batem com os dados, em todas as tentativas. Pode pedir de novo." (travamento: "Não deu: o pedido travou 3 vezes. Pode pedir de novo.") | "Pedir de novo" |
| | publicado, sem itens nem evidência | "Não deu: a leitura saiu sem evidências. Pode pedir de novo." | "Pedir de novo" |

"Aguardando, com atraso" é a variante de atenção de "Aguardando" (`--warning-text`, ícone de relógio com aviso). "Precisa de você" e "Não deu" usam `--danger` e ícone de aviso (grupos `WARN_STATES` e `DEAD`, `_chrome/forja-view-model.ts:115-116`). A última linha é estado de tela, derivado da leitura (hoje a frase de `forja-view-model.ts:208`). As palavras "cota", "vigia", "validador" e "conferência" não aparecem em tela.
### 7.3 Trabalho de servidor da leitura por canal (plano próprio)
Nada desta lista existe hoje. Até existir, o botão de canal fica apagado.
1. **Tipo `leitura-canal`.** O CHECK de `task_type` em `youtube_intelligence_tasks` aceita seis valores, e a regra `(task_type = 'leitura-video') = (target_video_id is not null)` recusa alvo novo (`supabase/migrations/20261003000004_observatorio_forja.sql:24-31`). Não há coluna de canal-alvo na tarefa nem em `competitor_readings` (`load.ts:510`). Migration com `npm run db:new`.
2. **Listas de tipos:** `OBS_TYPES` (`apps/web/src/lib/pipeline/services/forja-queue.ts:32`), `OBS_TASK_TYPES` (`load.ts:101`), `TYPE_SHORT` (`states.ts:107`).
3. **Limite por canal** em `lib/forja/quota.ts`, que hoje conta por tipo e nicho, e por vídeo só em `leitura-video`.
4. **Pacote de canal** em `lib/forja/sent.ts` (`buildSentCtx` só conhece vídeo e nicho, `sent.ts:151-160`).
5. **Capacidade anunciada:** a forja escreve o tipo em `forja_heartbeat.capabilities` (`lib/types.ts:99`); o kit da forja é do dono.
6. **"Só se os dados mudaram":** precisa de um marcador (comparar o conteúdo de `items` do pacote com o da última leitura do escopo). Sem marcador, a regra não é mostrada.

## 8. Retenção dos canais próprios
Cabeçalho da aba e da seção: "Retenção · datas no dia do YouTube ⓘ" ("O YouTube fecha o dia no horário do Pacífico, não em São Paulo"; `day_pt`, spec de coleta, seção 1). Datas de tentativa são outra coisa e dizem "coleta de 05/10".
### 8.1 Aba Retenção: "views boas, retenção ruim"
```
 Retenção · datas no dia do YouTube ⓘ        % assistido e views: os 90 dias até 05/10.
 Faixa de duração    Vídeos   Normal da faixa (mediana de % assistido)
 Short               12       71%
 Até 5 min            3       poucos vídeos para comparar (3; precisa de 5)
 5 a 15 min           9       42%
 Acima de 15 min      6       31%
 Sem faixa            5       duração ou formato ainda não coletados
 Views acima do normal do canal e % assistido abaixo do normal da faixa: 4 vídeos
 Vídeo                                  Faixa       Views nos 90 dias  % assistido          Contra a faixa
 [thumb 12:41] Como morar em Lisboa…    5–15 min    84 mil             33%                  9 pontos abaixo (normal da faixa: 42%)
 [thumb  3:10] Mala de mão: o que levar até 5 min   51 mil             38%                  poucos vídeos para comparar
 [thumb 18:22] Roteiro de 7 dias…       > 15 min    40 mil             sem dado: vídeo novo sem comparação
```
- **Antes de 28 dias:** "Coletando: 9 de 28 dias. A comparação por faixa aparece em 26/10. Os percentuais de cada vídeo já aparecem na página dele." N = dias distintos com linha em `yt_own_video_daily` do canal.
- **Comparação por faixa:** exige N ≥ 28 e 5 ou mais vídeos na faixa. Abaixo disso, "poucos vídeos para comparar (3; precisa de 5)"; os vídeos aparecem com o próprio percentual e ficam fora da contagem "4 vídeos".
- **Faixa:** a de Short vem de `yt_own_video_meta_daily.is_short`; as outras, de `duration_seconds`. Vídeo sem um dos dois fica em "Sem faixa (5)".
- **Views da lista:** as da mesma janela de 90 dias do percentual, nunca o total da vida.
### 8.2 Seção Retenção na página do vídeo próprio
```
 Retenção · datas no dia do YouTube ⓘ        curva da vida inteira do vídeo, coletada em 05/10   [Ver como tabela]
 100% ┤█▇
      │  ▆▅▅▄▄▄▃▃▃▃▃▃▂▂▂▂▂▂▃▄▃▂▂▂▂▂▂▁▁▁▁
   0% └┬────────┬────────┬▲───────┬────────┬      ▲ trecho reassistido
      0:00     3:10     6:20     9:30    12:41
 % assistido: 33% nos 90 dias até 05/10   (normal da faixa 5–15 min: 42%)
 O número é dos últimos 90 dias; a curva é da vida inteira do vídeo. As janelas são diferentes.
 Trechos reassistidos:  6:05 a 6:40, vistos 1,3 vez em média   Abrir neste ponto no YouTube
 Maiores saídas:  0:00 a 0:25, de 100% para 71%;  3:00 a 3:20, de 58% para 49%;  9:10 a 9:30, de 31% para 26%
```
Trecho reassistido = pontos seguidos com `ratio` acima de 1 em `yt_own_video_retention.points`. Nenhum: "Nenhum trecho reassistido." `point_count` menor que 100: "Curva com 37 de 100 pontos: o YouTube devolveu só parte."
### 8.3 De onde vem cada número, e o que dizer quando falta
- **% assistido:** `youtube_video_analytics.avg_view_percentage`, total da janela de 90 dias na data da coleta. A tela sempre mostra a data. **Curva:** `yt_own_video_retention`, `window_kind = 'vida'`.
- **Impressões e CTR:** `yt_own_video_reach_daily`, valor de **um** dia, o último com linha ("em 04/10"). A célula do CTR só é desenhada depois de o runbook fixar a unidade de `thumbnail_ctr`.
- Canal com `youtube_channels.collection_status = 'reautorizar'`: faixa "Erro: o YouTube pede nova autorização deste canal. A coleta parou em 02/10." Quem administra vê "Reconectar"; a editora vê "Peça a quem administra para reconectar este canal."

| `yt_own_collection_attempts.outcome` | Frase no lugar do número |
|---|---|
| sem linha de tentativa | "coleta ainda não iniciada" |
| `ok`, com o valor nulo | "o YouTube não devolveu este número" |
| `sem_dado_na_janela` | "sem dado: o YouTube não tem números para este período" |
| `video_novo` | "sem dado: vídeo novo (menos de 3 dias)" |
| `sem_conexao` | "sem dado: o canal não está conectado" |
| `sem_autorizacao` | "sem dado: o canal precisa de nova autorização" |
| `erro_http` | "sem dado: o YouTube respondeu com erro na coleta de 05/10; nova tentativa amanhã" |
| `nao_alcancado_orcamento` | "sem dado: a coleta de 05/10 não chegou a este vídeo; ele entra na próxima" |
| `schema_ausente` | "sem dado: falha interna na coleta de 05/10" |

Para concorrentes, nenhum texto usa a palavra "retenção".

## 9. A/B Lab
Regras: spec do A/B, seções 3 e 4. Aqui só as telas. Caminhos em `ab-lab/_components/`. Horários em São Paulo (a rotação é às 05:00); só a linha de datas das views é "dia do YouTube".
### 9.1 Acompanhamento sem confiança
```
 Teste: Título + thumbnail   mede o conjunto; não separa título de thumbnail.            no ar há 9 dias
 Ainda não dá para comparar: C tem 1 dia inteiro no ar; precisa de 3.
 Views por dia, nos dias em que a variante ficou o dia inteiro no ar (dia do YouTube ⓘ)
                               30/09   01/10   02/10   03/10   04/10   05/10   06/10   07/10     Views/dia  Dias válidos
 A (original) [thumb] Como…    5,9 mil                 5,6 mil                 5,9 mil            5,8 mil    3
 B            [thumb] Lisboa…          6,6 mil                 6,1 mil                 6,5 mil    6,4 mil    3
 C            [thumb] Morar…                   5,1 mil                 descartado                 5,1 mil    1
 9 dias de teste: 7 válidos, 1 descartado por troca atrasada, 1 sem medição.
 Cada variante foi medida em dias diferentes; vídeo novo perde views sozinho, então a ordem da rotação pesa.
```
- **Calendário:** linhas = variantes, colunas = dias. Célula com valor = dia válido; célula vazia = fora do ar; "descartado" e "sem medição" escritos na célula. Definição de dia válido: spec do A/B, 4.2.
- **Três contagens:** dias válidos, "N dias descartados por troca atrasada", "N dias sem medição". Teste anterior à coleta mostra só "sem medição".
- **Destaque:** só quando todas as variantes têm 3 ou mais dias válidos. A de mais views por dia ganha o rótulo "mais views/dia até agora". Nunca "líder", "vencedor", diferença percentual ou intervalo. Abaixo disso, a frase diz o que falta, como no wireframe.
- Saem "Impressões", "CTR", todo número de confiança, as curvas, o medidor, os gates e "será aplicado automaticamente".
### 9.2 Diálogo "Encerrar teste"
Hoje: "Aplicar variante lider" (a primeira da lista, `ab-end-test-dialog.tsx:35-36`), "Manter original" e "Arquivar sem aplicar" com "Encerra o teste e mantem o que esta no ar" (`:78-79`).
```
┌ Encerrar teste ───────────────────────────────────────────────────────── ✕ ┐
│ A rotação para. No ar agora: variante C, desde 07/10 05:00.                 │
│ O que fica no vídeo?                                                        │
│ ( ) [thumb] A (original)  Como morar em Lisboa gastando pouco em 2026       │
│ ( ) [thumb] B  Lisboa por R$ 4 mil por mês                                  │
│             mais views/dia até agora: 6,4 mil em 3 dias. Pode ser acaso.    │
│ ( ) [thumb] C  Morar fora barato                             no ar agora    │
│                                              [Cancelar]  [Encerrar]         │
└─────────────────────────────────────────────────────────────────────────────┘
```
- Uma opção por variante, a original primeiro, nenhuma marcada. "no ar agora" marca a que está. A linha "mais views/dia até agora" só existe com o destaque de 9.1.
- O botão "Encerrar" fica desabilitado até a escolha e passa a nomeá-la: "Encerrar e ficar com B" / "Encerrar e ficar com A (original)". Enviando: "Encerrando…".
- Sem nota prévia sobre edição externa. Só se o servidor responder `precisa_confirmar`, o corpo vira: "O título no YouTube não é de nenhuma variante: alguém editou por fora." + os dois títulos lado a lado ("No YouTube agora" e "Variante B") + "Voltar" e "Trocar pelo título de B e encerrar". Para thumbnail, o mesmo com as duas imagens.
- Escolhendo a original, a edição externa fica como está e a faixa de 9.4 avisa depois.
- Original guardada pequena: "O original foi guardado em baixa resolução.", sob a opção A.
- Quem não administra vê só a opção A e a nota que já existe (`AdminOnlyNote`). Resposta `em_andamento`: "Outra tentativa está em andamento. Tente de novo em instantes." Erro do servidor fica escrito no diálogo.
### 9.3 Depois de encerrado ou pausado
- Ficou uma variante: "Encerrado · variante B no ar desde 07/10 05:00", com o botão "Voltar ao original" até a data de `revert_expires_at` ("disponível até 14/10"), só para quem administra.
- Ficou a original, por escolha: "Encerrado sem vencedor". Por duração máxima: "Encerrado sem vencedor: o prazo acabou". Nunca aparece como playoff.
- Pausado por falha do YouTube ou por edição externa: faixa "Atenção: teste pausado. O YouTube recusou a troca das 05:00." (ou "Alguém editou a thumbnail fora do teste.") + o que aconteceu com título e thumbnail (a faixa de 9.4) + "Retomar".
### 9.4 Faixa de restauração
Lida de `ab_tests.restore_status`, por campo (`title`, `thumbnail`), com `destino` e `motivo`. Uma linha por campo quando os estados diferem. Com `destino` original a frase diz "não voltou ao original"; com `destino` variante, "O título da variante B não foi aplicado".

| `estado` | Faixa | Ações |
|---|---|---|
| `falhou` | "Erro: o título não voltou ao original: o YouTube recusou em 07/10 05:02. Nova tentativa automática na próxima verificação." | "Tentar agora", "Já corrigi no YouTube: dispensar aviso" |
| `desistiu` | "Erro: a restauração falhou 3 vezes e parou. O título no ar ainda é o da variante B." | as duas, e "Abrir no YouTube Studio" |
| `pulado_drift` | "Atenção: a thumbnail no ar não é de nenhuma variante deste teste: alguém editou por fora. Nada foi alterado." | "Já corrigi no YouTube: dispensar aviso" |
| `pulado_drift`, motivo `sem_base_de_comparacao` | "Atenção: não foi possível comparar a thumbnail no ar com as variantes. Nada foi alterado." | idem |
| `pulado_sem_original` | "Atenção: o título original não foi guardado quando o teste começou. Nada foi alterado." | "Abrir no YouTube Studio para conferir", "Já corrigi no YouTube: dispensar aviso" |
| `ok` | sem faixa; linha "Título e thumbnail voltaram ao original em 07/10 05:02." | — |

Permissão das ações: a de encerrar, quando o destino é o original; a de quem administra, quando o destino é uma variante.
### 9.5 Correções de texto na criação
O fluxo de 5 passos fica como está nesta versão. Mudam só os textos: todo o fluxo em pt-BR ("Remove variant", "Title for variant", `step-variantes.tsx:334,423`; "Untitled", `ab-create-wizard.tsx:545`; "MAX. 4 VARIANTES", `step-variantes.tsx:648`, viram "Remover variante B", "Título da variante B", "Sem título", "Até 4 variantes"); o tipo combo se chama "Título + thumbnail", sem selo "recomendado"; somem o interruptor e a frase de aplicação automática. Todo `alert()` (`active-detail.tsx:100,150,161,192-209`; `winner-detail.tsx:51,94`) vira faixa de erro na página.

## 10. Contrato de carregamento
Causas de hoje: as cinco páginas são `force-dynamic` (`page.tsx:16` e as quatro irmãs); cada filtro é uma navegação; `loading.tsx` troca a página inteira por um esqueleto de outra forma; o painel muda o grid (`canais.css:315`). A rota `canal/[id]` usa `loadChannelDataset` (5.8), sobre o cache por canal que já existe (`unstable_cache`, tag `observatoryTag(siteId)` = `observatorio:<siteId>`). A meta de 1 s vale depois dessa função, com cache quente; o plano mede fria e quente e registra as duas.

| Navegação | O que acontece | Alvo | Indicador |
|---|---|---|---|
| Canais → Canal | pré-carga depois de ~150 ms de hover ou foco, no máximo 3 em andamento; a trilha fica; o cabeçalho abre com nome, avatar, nicho e inscritos que a linha tinha | < 1 s (quente) | até 100 ms, nada; depois esqueleto na forma final: 3 linhas de cabeçalho e cartões 16:9 |
| Filtro, ordenação, busca, vista | no navegador, sobre os campos brutos; URL atualizada sem navegar | < 100 ms | nenhum; o status anuncia |
| Troca de aba do canal | Vídeos e Trocas vêm no mesmo pacote; Leitura e Retenção carregam à parte | < 100 ms / < 1 s | esqueleto do miolo após 100 ms |
| Canal → Vídeo | pré-carga igual; a thumbnail do cartão vira a capa do cabeçalho (transição de elemento compartilhado, só sem movimento reduzido); título e duração imediatos | < 1 s (quente) | esqueleto: 5 células, bloco do gráfico na altura final |
| Anterior / Próximo | o vizinho é pré-carregado quando a página assenta; a barra presa fica; o miolo anterior continua visível, esmaecido | < 300 ms | barra fina no topo só depois de 300 ms |
| Voltar | o navegador restaura a rolagem; a URL restaura filtro, ordenação, vista e quantidade | imediato | nenhum |
| Pedir leitura | o botão vira situação na hora; se o servidor recusar, volta e diz o motivo | < 100 ms | linha de situação |

Regras: abaixo de 1 s, nenhum indicador; esqueleto com a mesma forma e altura do conteúdo; conteúdo anterior na tela durante a transição; `loading.tsx` por rota, cobrindo só o miolo.
**Regra de implementação.** Todo `Link` da grade, da lista e do pager é importado dentro de módulo `'use client'`, no modelo de `apps/web/src/app/cms/(authed)/_shared/cms-link.tsx`; nunca passado como prop a partir de Server Component. Server actions (fixar, pedir leitura, encerrar teste) chegam aos componentes cliente por props.

## 11. Acessibilidade
| # | Critério | Regra | Como testar | Bloqueia o mockup? |
|---|---|---|---|---|
| 1 | Foco não encoberto (2.4.11) | Barra presa só com largura ≥ 768 px **e** altura ≥ 600 px; fora disso, fluxo normal e `--obs-sticky-h` = 0. Toda seção e todo alvo de foco com `scroll-margin-top` = `--obs-sticky-h` (medida por `ResizeObserver`) + 12 px. O foco nunca é cortado pelo `overflow` do cartão | Tab e Shift+Tab em 1440, 768 e 390 px e em zoom 200%: nenhum foco sob a barra nem cortado | Sim |
| 2 | Atalhos de tecla (2.1.4) | `[` e `]` valem só com o foco no `h1` ou dentro do pager; ignoram Ctrl, Alt e Meta; nenhum atalho global | digitar `[` no campo de busca: nada acontece | Sim |
| 3 | Filtro, vista e resultado (4.1.2, 4.1.3) | Filtro: `role="group"` "Formato", botões com `aria-pressed`, contagem no nome ("Longos, 31"). Vista: `role="group"` "Vista" com `aria-pressed`; ao trocar, o status diz "Vista Lista, 51 vídeos". "Ordenar" é `select` nativo. Status: `role="status"`, atômico, 500 ms depois da última tecla; nunca move o foco | leitor de tela: filtrar, buscar, trocar a vista; um anúncio por mudança | Sim |
| 4 | Capas e Lista (1.3.1) | Capas = `ul`/`li`. Lista = `table` com `th scope="col"`, botão dentro do `th` ordenável, `aria-sort` só na coluna ativa; anúncio "Ordenado por Views, decrescente". No DOM o rótulo acompanha o valor ("84 mil views") | navegar a tabela por célula no leitor de tela | Sim |
| 5 | Cartão (2.4.1, 2.1.1) | 2 paradas de Tab por cartão: o link thumbnail+título e o botão "Ações do vídeo: <título>". O selo "2 trocas" é texto. Menu no padrão menu button (`aria-haspopup`, `aria-expanded`, setas, Home, End, Esc devolve o foco). Link "Pular a lista de vídeos" antes da grade. Nenhum controle some fora do hover | contar as paradas em 12 cartões: 24 | Sim |
| 6 | Gráficos (1.1.1, 2.1.1) | `figure` com o resumo de uma frase. O SVG `role="img"` é **irmão** do grupo de marcas, nunca pai. Marcas = `role="toolbar"` rotulada "Trocas do vídeo", botões em `tabindex` rolante (setas, Home, End; Enter ou Espaço preenche a comparação), nome "Troca de título, 22/09, de A para B"; a dica aparece também no foco. "Ver como tabela" é botão com `aria-expanded` que abre a tabela logo abaixo (`caption`, `th scope`, coluna "Troca"). Retenção: as 3 maiores saídas em texto + tabela | só teclado: chegar a cada marca, abrir a tabela, ler os números | Sim |
| 7 | Tira de capas (4.1.2) | `ul` de `button` com `aria-pressed`, nome "Capa 1, no ar de 15/09 a 22/09" | só teclado: escolher cada capa e ver a comparação mudar | Sim |
| 8 | Barra de seções e abas (2.4.1, 2.4.5) | Vídeo: `nav` "Seções do vídeo", item ativo com `aria-current="location"` e peso 600; clicar foca o `h2` (`tabindex="-1"`); o observador de rolagem nunca move o foco. Canal: cada aba é URL, então `nav` "Seções do canal" com links e `aria-current="page"`; não é `tablist` | rolar com o foco num botão: o foco não sai dele | Sim |
| 9 | Títulos e regiões (1.3.1, 2.4.6) | `h1` = nome do canal ou título do vídeo. Aba ativa e seções = `h2`. Cartão de vídeo sem título de seção. Leitura da forja = `region` rotulada. "O que é a forja?" é disclosure com `aria-expanded` | lista de títulos do leitor de tela: sem salto de nível | Sim |
| 10 | Diálogo de encerrar (APG) | `role="dialog"`, `aria-modal`, `aria-labelledby` no título, `aria-describedby` na frase "No ar agora…"; `fieldset` com `legend` "O que fica no vídeo?" e `radio` nativo; foco inicial no primeiro radio; "Encerrar" com `aria-disabled="true"` e `aria-describedby` "Escolha uma opção"; Tab preso; Esc cancela e devolve o foco ao botão que abriu. Em `precisa_confirmar` o corpo vira `role="alertdialog"`, com foco em "Voltar". Erro em `role="alert"` sem mover o foco; "Encerrando…" com `aria-busy` | só teclado, do abrir ao cancelar, ao confirmar e à confirmação extra | Sim |
| 11 | Calendário do A/B (1.3.1) | Tabela real: `th` de linha = variante, `th` de coluna = dia; valor em texto na célula ("5,9 mil", "descartado", "fora do ar" só para leitor de tela); nunca caracteres de bloco | ler linha e coluna de qualquer célula no leitor de tela | Sim |
| 12 | Contraste e tamanho (1.4.3, 1.4.11) | O mockup traz a tabela "par → razão medida" de todo token de texto e de borda de componente. Rever: `--dim` sobre `--surface-2`; `--forja` 12 px sobre `--forja-subtle`; `--tier-top` e `--tier-mid` em texto pequeno; `--warning-text` sobre `--warn-subtle`. Borda de selo em cor sólida ≥ 3:1. Texto ≥ 12 px | medir cada par: texto 4,5:1; texto grande e componente 3:1 | Sim: par reprovado bloqueia |
| 13 | Cor nunca sozinha (1.4.1) | Nível do múltiplo por escrito; situações da forja com ícone distinto para atraso e para falha; faixas com "Erro:" ou "Atenção:" | captura em escala de cinza: tudo continua distinguível | Sim |
| 14 | Atualização automática (2.2.2, 4.1.3) | A situação da forja anuncia (`polite`) só quando muda; "atualizado há 1 min" em texto; botão "Pausar atualização automática" | deixar o cartão aberto 5 min com leitor de tela; pausar | Sim |
| 15 | Foco após navegar (2.4.3) | Navegação cliente: foco no `h1`. Voltar: foco no cartão do último vídeo visto. Anterior/Próximo: foco continua no botão, status "Vídeo 8 de 51: <título>", `aria-disabled` no fim da lista. "Mostrar mais": foco no primeiro cartão novo. Esqueleto com `aria-hidden` e "Carregando…" para leitor de tela; miolo com `aria-busy` | navegar canal → vídeo → próximo → voltar só com teclado | Sim |
| 16 | Tamanho do alvo (2.5.8) | 24×24 sempre; 44×44 sob `pointer:coarse` **e** em viewport ≤ 900 px (hoje há alvos de 32 e 40 px em `chrome.css`) | `getBoundingClientRect` em todo controle, nas duas condições | Sim |
| 17 | Truncamento e refluxo (1.4.10, 1.4.4) | Texto truncado tem o nome inteiro no nome acessível. Em 320 px e zoom 200–400%, tabelas viram pilhas com rótulo; só gráfico e faixa de abas rolam na horizontal | 320 px e zoom 400%: sem rolagem horizontal da página | Sim |
| 18 | Texto alternativo, idioma, datas, dicas, avisos | `alt=""` na thumbnail dentro do link com título; na comparação, rótulo + período. `lang` no título e nas tags de canal em outro idioma. Ícones decorativos com `aria-hidden`. Datas em `<time datetime>`. Links externos dizem "abre em nova aba". Nada explicado só em `title`: botão ⓘ com nome único ("Sobre o múltiplo de <título>") e popover que fecha com Esc. Aviso de tela: `status` para sucesso, `alert` para erro, pelo menos 6 s, com fechar | inspeção do DOM e leitor de tela nas duas telas | Não |

Movimento: rolagem suave, esmaecimento e transição de elemento compartilhado só sem `prefers-reduced-motion: reduce`. Fundos translúcidos só com os rgba literais da seção 2, nunca `color-mix()`.

## 12. O que o mockup precisa provar
Quatro mockups, nesta ordem, com dados e capas reais de um canal. Valem para todos as linhas da seção 11 marcadas "Sim".
1. **Página do canal.** Em 1440×900, na carga: a grade começa a no máximo 300 px do topo, com 10 ou mais cartões inteiros em Capas e 8 ou mais linhas em Lista. Sem rolagem horizontal em 1440, 1280, 1024 e 390 px. Filtro, ordenação, busca e vista trocam sem piscar, e a URL devolve o mesmo estado ao recarregar. Um cartão para cada linha da tabela 5.7. "Longos + Shorts + formato não confirmado = Todos". Os três números não mudam de ordem ao reordenar. Esqueleto e página final sobrepostos sem caixa que se mova. Voltar do vídeo cai no cartão do último vídeo visto. Um canal próprio, com as frases de 5.2. **O dono decide aqui:** Capas ou Lista como vista padrão.
2. **Página do vídeo de concorrente, com o cartão da forja.** Em 1440×900 o gráfico e a comparação aparecem sem rolar, dentro do orçamento de 6.1. A barra presa não cobre título nem foco. Anterior/Próximo mantém a barra parada. As variações de 6.5 e uma tela para cada linha da tabela. O cartão da forja nas quatro situações, com as dez frases de 7.2 e os quatro textos de botão apagado; nenhuma ocorrência de "cota", "vigia", "validador" ou "conferência". **O dono decide aqui:** a tira de capas no cabeçalho.
3. **A/B: acompanhamento, diálogo e faixas.** O calendário com destaque e sem destaque. Nenhuma ocorrência de "confiança", "impressões", "CTR", "playoff", "líder", "vencedor" (fora de "Encerrado sem vencedor") ou "automaticamente". O diálogo sem opção marcada e com "Encerrar" desabilitado; a confirmação com os dois títulos lado a lado. Os estados de 9.3 e as seis linhas de 9.4, com destino original e com destino variante. **O dono decide aqui:** o texto do rótulo "mais views/dia até agora" e o do botão "Encerrar e ficar com B".
4. **Retenção.** O estado "Coletando: 9 de 28 dias". A lista com "poucos vídeos para comparar", "Sem faixa" e uma linha para cada frase de 8.3. Canal a reautorizar, visto por quem administra e pela editora. Curva incompleta e a frase das janelas diferentes. Variante opcional: a dispersão acima da lista (seção 13). **O dono decide aqui:** só a lista, ou lista com dispersão.

## 13. Depois da primeira versão
Ficaram de fora desta versão, uma linha cada:
- Filtro "Com troca" na grade do canal.
- Capa anterior ("antes | agora") no hover e no foco do cartão.
- Menu de canais do mesmo nicho na trilha do vídeo.
- Faixa de números do canal presa ao rolar (só a linha de controles fica presa).
- Chip "hipótese: pico e queda" em vídeo de concorrente com 30 dias ou mais de série.
- Dispersão de retenção (views × pontos contra a faixa): segundo mockup opcional; o dono decide vendo.
- Arquivo de leituras em Insights. Exige ler `competitor_readings` sem o corte de 90 dias do carregador (`READING_DAYS`, `load.ts:95`, aplicado em `:510-511`).
- Criação do A/B em 2 passos ("O que testar" e "Revisar e ativar").

## 14. Em aberto
1. **Vista padrão do canal: Capas ou Lista?** Recomendação: Capas. A capa é o que a editora vem estudar; a Lista fica a um clique e na URL.
2. **A tira de capas no cabeçalho do vídeo entra?** Recomendação: sim. Tira as thumbnails de "Versões" e põe a troca de capa à vista sem rolar.
3. **Leitura por canal: vale o trabalho de 7.3 agora?** Recomendação: não antes de a página do canal estar em uso. Até lá a aba mostra a leitura do nicho, rotulada como tal.
4. **Selo "em treino" ou "rascunho da máquina"?** Recomendação: manter "em treino", a palavra do dono, com a explicação no ⓘ; rever quando virar produto.
5. **A URL do canal usa o id interno ou o @?** Recomendação: id interno, que não muda quando o canal troca de @.
