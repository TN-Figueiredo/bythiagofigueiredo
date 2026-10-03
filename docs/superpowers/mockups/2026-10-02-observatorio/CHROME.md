# chrome.js / chrome.css: a moldura compartilhada do Observatório

Uma chamada desenha, igual nas 6 telas:
- a sidebar do CMS em PT (vira painel abaixo de 1100 px);
- o cabeçalho YouTube com as abas da shell;
- o cabeçalho do Observatório: título, subtítulo, ações, linha de sincronização com popover de frescor, heartbeat da forja e botão de status do pedido;
- a barra de nicho e as abas do Observatório;
- o toggle de tema;
- a barra "Estados do mockup", com o painel "Dependências novas";
- os toasts.

`chrome.css` também traz os tokens dos dois temas e `[hidden]{display:none!important}`.

Prova de integração: `moldura-forja.html`.

## Carregar

```html
<link rel="stylesheet" href="chrome.css">          <!-- antes do CSS da tela -->
...
<body>
  <div id="screen">…conteúdo da tela…</div>        <!-- o chrome move este nó para baixo das abas -->
  <aside id="drawer" hidden>…</aside>               <!-- opcional: painel lateral (forja etc.) -->
  <script src="dados.js"></script>
  <script src="chrome.js"></script>
  <script>CHROME.mount({ tab: 'mudancas' });</script>
</body>
```

A tela **remove** o que tinha de chrome local: tokens `:root`, sidebar, cabeçalhos, barra de nicho, abas, barra de estados, toggle de tema, toasts e as leituras de `localStorage`.

Todo o CSS do chrome usa o prefixo `.ch-`. Classes da tela (`.btn`, `.tag`…) não colidem.

## `CHROME.mount(opts)` → `CHROME`

| opção | tipo | o que faz |
|---|---|---|
| `tab` | `'canais' \| 'mudancas' \| 'outliers' \| 'insights' \| 'historico'` | **Obrigatória.** Aba marcada com `aria-current`. Em `historico`, a aba marcada é a de `?from=`; sem `from`, Mudanças. |
| `forjaVariant` | `'solid' \| 'outline' \| 'none'` | Botão "Pedir nova leitura à forja" no cabeçalho (Hierarquia de ações). `'none'` esconde esse botão em telas que já têm a ação no contexto (Histórico, que tem o botão sólido no cabeçalho do vídeo); o status de pedido em andamento ("Pedido em andamento" + "na fila · HH:MM") continua no cabeçalho. Padrão: sólido (teal) em `insights` e `historico`, contornado nas demais. Com o drawer aberto (`CHROME.drawer(true)`), fica sempre contornado, porque o preenchido é o do drawer. Os estados de pedido em andamento são sempre contornados. Com `'none'`, some também o "Pedido em andamento" desabilitado, e o cabeçalho mostra só o status. |
| `title`, `subtitle` | string | Padrão: "Observatório de Competidores" e a frase de propósito. |
| `content` | seletor ou elemento | Padrão: `#screen`. Vai para dentro de `main.ch-content`, abaixo das abas, com a classe `ch-screen`. **O espaço acima é do chrome** (D8): 16 px abaixo das abas, nas 6 telas (topo em 418 px a 1440 e 283 px a 768). O contêiner vira `display:flow-root`, então a margem do primeiro filho fica dentro dele. A tela não muda isso: `margin-top`, `padding-top`, `border-top`, `float`, `top` e `transform` do contêiner são fixados com `!important`. O respiro interno é da tela, nos filhos. |
| `drawer` | seletor ou elemento | Painel lateral; ganha `.ch-drawer` e entra na grade da página. Veja `CHROME.drawer()`. |
| `mockStates` | `[{label, items:[{id,label,pressed?}], note?}]` (ou `[{id,label}]`) | Botões da barra de estados, um grupo por linha. O clique chama `onMock(id, groupIndex)`. |
| `deps` | `[[título, html]]` ou `[{title, text}]` | Itens do painel "Dependências novas", dentro da barra de estados. |
| `onNiche(n)` | função | Chamada quando o usuário troca o nicho (`'todos'\|'viagem'\|'ia'`). O chrome já gravou `obs-niche`. |
| `onTheme(t)` | função | Chamada depois da troca de tema (`'light'\|'dark'`). O chrome já gravou `obs-theme`. |
| `onMock(id, g)` | função | Clique num botão da barra de estados. |
| `onForja()` | função | Clique em "Pedir nova leitura à forja". Padrão: abre `insights.html`. Nunca crie pedido se já houver um em andamento. |
| `onSynced(res)` | função | Chamada depois de "Sincronizar concorrentes" com o resultado de `OBS.runSync()` (`{ok, problems, at, text}`). **Obrigatória nas 6 telas** (CONVENCOES F7): redesenhe o que depende de sincronização, como tabelas, avisos e "fica fora". O chrome já redesenhou o cabeçalho. |
| `onStatus()` | função | Clique no botão de status do pedido (`#ch-req-status`). **Nunca cria pedido**: mostra o andamento. Padrão: rola até o primeiro `[data-forja-anchor]` da tela e põe o foco nele. |
| `onSync()` | função | "Sincronizar concorrentes". Padrão: toast "Sincronização iniciada". |
| `onBackdrop()` | função | Clique no fundo escuro quando o drawer está em modo modal (abaixo de 1280 px). |
| `cowork({tab, niche})` | função → string | Texto de "Copiar pedido para o Cowork" (menu ⋯). Há um texto padrão por aba. |
| `menuItems` | `[{label, ctx?, href? \| onClick?}]` | Itens extras do menu ⋯. |

## Métodos

| método | o que faz |
|---|---|
| `CHROME.niche()` / `CHROME.setNiche(n, {silent, persist})` | Lê e troca o nicho global. Grava `obs-niche`, atualiza `?niche=` na URL (`history.replaceState`), fecha o menu ⋯, refaz contagens e links e chama `onNiche`. Com `silent`, não chama `onNiche`. Com `persist:false`, muda só a exibição desta tela, sem tocar no `localStorage` nem na URL (caso ?video/?channel de outro nicho). **Os links das abas usam sempre o nicho persistido** (CONVENCOES F4), então a exibição temporária não vaza para as outras telas. |
| `CHROME.theme()` / `CHROME.setTheme(t)` | Lê e troca o tema: grava `obs-theme`, atualiza `?theme=` na URL (`replaceState`) e chama `onTheme`. |
| `CHROME.openSide()` / `CHROME.closeSide(focusBtn)` | Abaixo de 1100 px, abre ou fecha a sidebar como painel: fundo clicável, resto da página `inert`, botão "Fechar menu" de 32×32 e `100dvh`. Com o painel aberto, o Tab circula dentro dele (do último volta ao primeiro). Fecha com Esc, com o ✕ ou com clique no fundo, e o foco volta ao botão de menu. |
| `CHROME.forjaFromScenario(sc)` | Monta o objeto de `setForja` a partir de `OBS.forja.requestScenario(...)`. O `status` segue o formato único da CONVENCOES (F3 e F4), sempre com a hora do evento que o rótulo nomeia: "na fila · pedido 14:58", "trabalhando desde 14:45", "atrasado · pedido 14:33", "sem máquina desde 12:55", "nova tentativa · 15:05", "liberado pelo vigia · 15:05", "falhou às 14:21", "recusado às 14:56", "publicado às 14:50" (também em `CHROME.statusLabel(sc)`). Nos estados terminais (publicado, falhou, recusado), devolve `terminal:true`, e o cabeçalho mostra uma pílula de status ao lado do botão normal, sem botão de andamento. Obedece aos campos do motor `sc.anyActive`, `sc.terminal` e `sc.statusLines`. Num pedido dividido (Todos), se algum pedido do split ainda estiver ativo, o resultado é `active:true` e o status é a `statusLine` desse pedido. Exemplo: publicado + Todos dá "Pedido em andamento" + "Viagem: trabalhando desde 14:55". Quando todos terminam, a pílula junta as linhas ("IA: publicado às 14:50 · Viagem: …"). Também monta `statusText` = `sc.statusText`, `warn` em atrasado, sem máquina, nova tentativa e liberado pelo vigia, e `machine`. **Use sempre**: assim o status sai igual nas 6 telas. |
| `CHROME.setForja(f)` | Botão da forja e segmento de heartbeat. `f = {active, canAsk, askLabel, askShort, status, statusText, secondary (texto ou {text, active}), warn, machine:{alive,lastPollAt,text}, label, labelShort, disabled, disabledText}`. **Ativo + nicho livre** (CONVENCOES F10): com `active:true, canAsk:true, askLabel`, o botão habilitado "Pedir leitura de Viagem à forja" (rótulo curto `askShort` no compacto) ocupa o lugar de "Pedido em andamento". O pedido ocupado continua como linha de status ATIVA (`#ch-req-status`, clicável), nunca como pílula terminal, e o leitor de tela ouve "Pedido em andamento. …". `forjaFromScenario` não sabe quais nichos estão livres; a tela calcula e acrescenta `canAsk`/`askLabel`. Com `active`, mostra "Pedido em andamento" (desabilitado) e o botão de status. O nome acessível do botão é o próprio texto visível (`status`), e `statusText` vai em `aria-describedby` e no `title`. Com `terminal`, mostra a pílula `.ch-pill` com o `status`. Com `disabled`, mostra o botão desabilitado com `disabledText` como dica (use para a cota usada, com `quota.text`). No variante sólido, o botão continua preenchido, em teal mais suave (`--forja-soft-bg`/`--forja-soft-text`), sem opacity. Com `machine.alive === false`, o segmento vira "forja sem consulta desde HH:MM". |
| `CHROME.setDeps(deps)` | Troca os itens do painel "Dependências novas" depois do mount (mesmo formato de `deps`) e preserva o painel aberto ou fechado. |
| `CHROME.update({tab, niche, persist, forja, newTab})` | Faz várias mudanças com um só redesenho. `niche` aqui não chama `onNiche`; com `persist:false`, não grava o nicho. |
| `CHROME.setTab(tab)` | Troca a aba ativa. Só a moldura usa, porque mostra amostras de cada aba. |
| `CHROME.setTabNew(tab \| null)` | Marca "nova" numa aba (por exemplo, Insights depois de uma leitura publicada). |
| `CHROME.setMockPressed(id \| {groupIndex: id})` | Marca qual botão da barra de estados está ativo. |
| `CHROME.drawer(open)` → `modal` | Abre ou fecha o drawer. A partir de 1280 px ele vira coluna da grade; abaixo, é modal: backdrop, `role=dialog`, `aria-modal`, e o resto (sidebar, cabeçalhos, conteúdo e barra de estados) fica `inert`. O chrome reaplica o modo no resize. A armadilha de foco e o Esc do drawer ficam com a tela. Os botões da forja só levam `aria-haspopup="dialog"` quando há drawer e ele é modal. |
| `CHROME.toast(kind, title, text, act?, {selectable}?)` / `CHROME.clearToasts()` | Toasts numa região `aria-live` (sem `role` aninhado). `kind` é `''` (neutro: ícone de informação e borda neutra), `'ok'`, `'warn'`, `'bad'` ou `'forja'` (bigorna e borda teal, só para avisos da forja). Com o drawer modal aberto, os avisos sobem acima do rodapé dele. No aviso de cópia que falhou, o texto já vem selecionado e com foco; `act` é `{label, onClick}`; `selectable` põe um texto selecionável (somente leitura) no aviso. Cada aviso entra e sai como nó próprio, sem redesenhar os outros, e todos têm ✕ de 32 px. Sem ação, somem em 6,5 s, com pausa enquanto o mouse ou o foco estiver em cima; com ação ou texto para copiar, ficam até alguém fechar. Ao fechar um aviso que tinha o foco, o foco volta para onde estava antes. |
| `CHROME.link(name, params)` | `OBS.link[name]` sem "?" sobrando. Use em todo link entre telas. |
| `CHROME.destroy()` | Desmonta: devolve `content` e `drawer` ao `<body>`, remove os nós, os ouvintes e os avisos. `mount()` é idempotente: se já houver um chrome montado, ele chama `destroy()` antes, zera o estado interno e relê a URL atual (`?niche=`, `?theme=`, `?from=`). |
| `CHROME.refresh()` | Redesenha cabeçalho, nicho e abas, preservando o foco. |
| `CHROME.el` | `{content, page, mockSlot, mock}`. `mockSlot` é um espaço livre na barra de estados para controles próprios da tela. |
| `CHROME.store` | `localStorage` protegido (`get`/`set`). |

## O que o chrome resolve sozinho
- **Nicho:** `?niche=` vence `localStorage['obs-niche']` e é persistido.
- **Tema:** `?theme=` vence `localStorage['obs-theme']` e é persistido. Os links entre telas não levam tema.
- **Contagens das abas:** `OBS.tabCounts(niche)`, com `title=` vindo de `OBS.TAB_TITLES`. Insights fica sem contagem.
- **Barra de nicho:** cor do nicho de `OBS.NICHES[n].color[tema]` e contagem de canais de `tabCounts(n).canais`.
- **Linha de sincronização:** `OBS.SYNC.text`/`title` e problemas contados por `channel.sync.state !== 'ok'` ("3 canais com problema", com o detalhe no `title` e no popover). Problemas aparecem primeiro, e o popover tem ações.
- **Heartbeat:** "forja consultou às HH:MM" (`forja.queue.lastPollAt`), sem quebrar linha. Sem máquina, vira "forja sem máquina · 12:55".
- **Rótulos de sincronização:** vêm do motor (`channel.sync.label`).
- **"Sincronizar concorrentes":** sem sucesso fabricado. O padrão chama `OBS.runSync()` (CONVENCOES F6): só canais ok viram "sincronizado agora", e o frescor é redesenhado. O aviso de resultado lista os problemas reais (`onSynced(res)` opcional). Sem `runSync` no motor, o aviso mostra o resultado da última sincronização real, "Resultado da sincronização das 12:00". Exemplo: aviso `warn` com "11 canais sincronizados agora; 3 com problema" e a lista "Paddy Doyle: atrasado; Vou sem volta: buscando vídeos; Esq Unltd Daily: erro", em Viagem e depois IA. Cliques repetidos durante a rodada são ignorados. Se o botão estava no popover de frescor, o foco volta ao botão de frescor.
- **Frescor por nicho:** com um nicho ativo, o segmento diz "2 com problema em Viagem · 3 no total" (curto: "2/3"). O popover lista todos os canais, com os rótulos do motor (`sync.label`, inclusive "sincronizado"), e o nome acessível do botão leva vírgulas entre os segmentos.
- **Preferências da URL validadas:** `?theme=` só vale se for light ou dark, e `?niche=` só se for todos, viagem ou ia. Valor inválido é ignorado e removido da URL; `setTheme` também valida.
- **Contagens das abas:** usam o mesmo nicho do link (o persistido), então o N da aba bate com o do destino.
- **Menu ⋯:** "Copiar pedido para o Cowork" (com prévia do texto e "cole no Cowork com ⌘V") e "Definir nicho dos canais".
- **Teclado:** setas e Esc no menu; Esc fecha o popover e a sidebar; foco visível; alvos de 32 px ou mais.
- **Barra "Estados do mockup":** no topo, tracejada, recolhida por padrão, com o rótulo "Estados do mockup: não faz parte do produto".

## Blindagem contra o CSS da tela
- O CSS da tela deve ser escopado em `#screen` (e no drawer), como pede a CONVENCOES.
- Mesmo assim, o chrome se protege. Todos os nós que ele desenha recebem `all:revert` (com especificidade de id), e só depois as regras `#ch-app .ch-…`.
- Uma regra global da tela (`span{…}`, `.forja{display:none}`, `p{text-transform:…}`) não altera o cabeçalho, as abas nem a sidebar.
- As raízes (`#ch-app`, `#ch-mock`, `#ch-toasts`) também voltam ao padrão e recebem fonte, cor, espaçamento e alinhamento explícitos. Assim `body{…}` e `*{…}` da tela não chegam ao chrome nem por herança. Os ícones (svg) recebem `display`, `margin`, `padding` e `line-height` próprios.
- O conteúdo da tela (`#screen`), o drawer (`.ch-drawer`) e o espaço livre da barra de estados (`#ch-mock-slot`) ficam de fora da blindagem.
- A auditoria da moldura roda uma bateria de CSS hostil: `body{…}`, `*{margin;padding;box-sizing}`, elementos, classes genéricas com `!important`, `button{all:unset}` e `svg{display:none}`. Ela confere que nenhum estilo computado do chrome muda.
- A moldura tem uma auditoria disso: compara os estilos computados de `.ch-*` com e sem o `<style id="screen-css">`.

## Layout do cabeçalho
- As ações ("Pedir nova leitura à forja", "Sincronizar concorrentes", "Adicionar canal", ⋯) ficam numa linha própria, abaixo do título e do subtítulo, com altura fixa e igual nas 6 telas.
- Os tiers de outlier têm tokens nos dois temas: `--tier-mid`, `--tier-high` e `--tier-top`.
- No claro, `--tier-mid` vale `#0369A1`, diferente do azul do nicho IA (`#1D4ED8`). As telas não redefinem tiers.

## Modo compacto (largura disponível ≤ 860 px)
- Meta: o chrome ocupa até 300 px antes do conteúdo. Medido a 768: 267 px nas 6 telas, até o fim das abas, e o `#screen` começa em 283 px em todas (desde a 1.8, o espaço acima é fixo).
- Desde a v1.5, a decisão é pela **largura disponível do conteúdo** (container query em `.ch-content`), não pela janela. Com o drawer aberto entre 1280 e 1500 px, o cabeçalho também compacta, em vez de quebrar em duas linhas. Só o espaçamento da shell continua por `@media (max-width:900px)`.
- Sem drawer, a 1440 nada muda (geometria idêntica à da v1.3).
- O que muda abaixo de 900 px:
  - **Título e ações:** dividem a mesma linha. O subtítulo fica só para leitor de tela.
  - **Botões de ação:** só as ações secundárias (Sincronizar, Adicionar canal) viram ícones de 34 px, com rótulo `sr-only` e `title`. O botão "Pedir nova leitura à forja" mantém o rótulo. Com pedido em andamento, o "Pedido em andamento" desabilitado sai e fica só o status (`#ch-req-status`, por exemplo "atrasado · pedido 14:33").
  - **Linha de frescor:** fica numa linha só: "14 canais | sincronizado há 3 h | ⚠ 3 | forja 14:55". Os textos longos ("canais com problema", "consultou às") ficam para leitor de tela, e "Horários em São Paulo" sai da linha e vai para o popover de frescor.
  - **Abas e nicho:** dividem uma linha. As abas rolam na horizontal, com degradê à direita quando há abas depois (`.ch-more`) e à esquerda quando o trilho rolou (`.ch-less`); o rótulo "Nicho" e o alfinete ficam só para leitor de tela.
- Classes de apoio: `.ch-lbl-t` (rótulo dos botões), `.ch-long` / `.ch-short` (texto longo e curto do frescor).

## Copiar para o Cowork
- O item do menu ⋯ espera a cópia de verdade (`await navigator.clipboard.writeText`).
- Se der certo, o aviso diz "Pedido copiado para o Cowork".
- Se o navegador negar, o aviso diz "Não deu para copiar" e traz o texto do pedido num campo selecionável, para copiar com ⌘C.
- O nome acessível do item é curto ("Copiar pedido para o Cowork"); a prévia do texto vai em `aria-describedby`.

## Limites da blindagem (o que é e o que não é protegido)
**Protegido** (a bateria hostil da moldura confere, em 1440, 1280 com drawer, 1200 e 768, claro e escuro):
- Herança e regras globais da tela: `body{…}`, `*{margin;padding;box-sizing;line-height}`, `*{color:red}`, elementos (`span,p,a,button,div,…{font;display;…}`), `nav,header,main,details,summary{display:grid;…}`, classes genéricas com `!important` (`.forja`, `.btn`, `.tag`…), `button{all:unset}`, `a{color}`.
- Pseudo-elementos `::before`/`::after` dos nós do chrome e das raízes.
- Ícones: `svg{display:none;color:red}` e `svg *{stroke:red;fill:red}`. Os ícones levam as classes `ch-i-s` (traço) ou `ch-i-f` (preenchimento), e traço, preenchimento e cor vêm de CSS escopado, não dos atributos. Os filhos herdam a cor do ícone.
- Raízes: fonte, cor, espaçamento, `visibility`, `direction`, `word-break`, `overflow-wrap`, `cursor`, `font-variant` e suavização são fixos.

**Não protegido** (por limite do CSS; a CONVENCOES proíbe estes casos):
- `!important` da tela em seletores de elemento ou universais (`*{margin:0!important}`, `*::before{content:"x"!important}`, `svg *{stroke:red!important}`): `!important` vence o `revert` normal.
- Regras escritas de propósito para `#ch-*` ou `.ch-*`.
- Propriedades que o chrome não declara e que a tela aplique por id ou por seletor mais específico que `#ch-app …`.
- **Geometria dos ícones:** `stroke-width` e as propriedades de forma que o CSS consegue alterar (`d`, `r`, `cx`, `cy`, `x`, `y`, `width` e `height` de `rect`/`circle`/`path`) continuam vindo do atributo. Uma regra da tela como `svg path{d:path("")}` ou `svg *{stroke-width:9}` alcança os ícones; a CONVENCOES proíbe isso, porque o CSS da tela fica escopado em `#screen`.
- O chrome reverte os próprios nós, as raízes e os pseudo-elementos (`::before`/`::after`, inclusive das raízes). Regras globais da tela não chegam a ele.
- A bateria hostil da moldura cobre: `body{…}`, `*{…}`, elementos, classes genéricas, `button{all:unset}`, `svg{display:none}`, `*::before/*::after{content;display;margin}`, `nav,header,main,details,summary{display:grid;…}`, `*{color:red}`, `svg *{stroke;fill}` e três regras de `svg`/`svg *`. Juntas, essas regras de svg cobrem: borda, fundo, sombra, transform, outline, filter, raio, transição, mín./máx., float, clip-path, mask, z-index, overflow, scale, rotate, translate, zoom, order, mix-blend-mode, content-visibility, fill-opacity e stroke-opacity.
- **Não dá para bloquear** declarações `!important` que a tela aplique a elementos (`*{margin:0!important}`) ou a pseudo-elementos (`*::before{content:"x"!important}`), nem regras escritas de propósito para `#ch-*`/`.ch-*`. A CONVENCOES proíbe as duas coisas: o CSS da tela fica escopado em `#screen`.

## Acessibilidade do chrome
- O popover de frescor e o menu ⋯ só levam `aria-controls` enquanto estão abertos, e fecham quando o foco sai deles.
- A sidebar tem um estado só (`st.sideOpen`); a classe, o `aria-expanded`, o rótulo e o `inert` derivam dele.
- Com `prefers-reduced-motion`, as animações também são desligadas nos pseudo-elementos.
- No tema claro, o item ativo da sidebar usa `rgba(184,72,26,.08)` com texto `#9A3A12`.
- O tema é um botão "Tema claro" com `aria-pressed`.
- O botão de frescor não tem `aria-label`; o conteúdo dele é o nome acessível, com o prefixo "Frescor dos dados:" só para leitor de tela.
- O status do pedido é escapado: o `status` é texto, não HTML.

## Ganchos estáveis (para auditorias)
- Abas: `a.ch-tab[data-tab]`, com contagem em `[data-count="canais|mudancas|outliers"]`.
- Nicho: `[data-ch-niche]`.
- Frescor: `[data-fresh-probs]`.
- Forja: `.ch-actions .ch-btn.ch-forja` (contornado) ou `.ch-actions .ch-btn.ch-forja-solid` (sólido). Com pedido em andamento, o "Pedido em andamento" é `.ch-btn.ch-forja[disabled]` (some com `forjaVariant:'none'`) e o botão de status é `#ch-req-status` (`title` = `statusText`).
- Sidebar: `#ch-side`, `#ch-side-btn` (`aria-expanded`, `aria-label` dinâmico), `#ch-side-backdrop`, `.ch-side-close`.
- Desde a v1.2, todas as classes internas têm o prefixo `ch-` (`ch-forja`, `ch-ghost`, `ch-icon`, `ch-warn`, `ch-ct`, `ch-sw`…). Os nomes sem prefixo da v1.1 (`.forja`, `.ghost`, `.ct`…) saíram de propósito, para o CSS da tela não alcançar o chrome.
- Barra de estados: `[data-ch-mock]`.
- Painéis: `#ch-content`, `#ch-page` e `.ch-drawer`.

## Exemplo: tela Outliers

```js
CHROME.mount({
  tab: 'outliers',
  mockStates: [{ label: 'Estado', items: [{id:'cheio', label:'Com outliers', pressed:true}, {id:'vazio', label:'Sem outliers'}] }],
  deps: [['<code>video.url</code>', 'link real do vídeo no YouTube.']],
  onNiche: n => { state.niche = n; renderLista(); },
  onTheme: () => renderGrafico(),
  onMock: id => { state.cenario = id; CHROME.setMockPressed(id); renderLista(); },
  onForja: () => abrirPedidoDeLeitura(),
});
// pedido em andamento, vindo do motor:
const sc = OBS.forja.requestScenario('na fila', { type: 'padroes-titulo', niche: CHROME.niche() === 'todos' ? 'ia' : CHROME.niche(), fmt: 'long', createdAt: OBS.NOW });
CHROME.setForja(CHROME.forjaFromScenario(sc));   // "Pedido em andamento" + "na fila · 15:02" (title = sc.statusText)
```

## Changelog
- **2.2** (F11)
  - **Cabeçalho (I1):** `.ch-actions` numa linha de 34 px (sem quebra). `.ch-pill-2` com no máximo 28ch e reticências, texto inteiro no `title`. `#ch-req-status` com no máximo 36ch.
  - **Pílula de outro pedido ativo (M5):** `secondary` aceita `{text, active}`; ativa ganha borda e cor da forja (`.ch-on`).
  - **Frescor (I2):** a linha não quebra; abaixo de ~1300 px de janela (conteúdo < 1080 px) "Horários em São Paulo" sai da linha e fica no popover.
  - **Resultado da sincronização (M3):** usa `runSync().ok`, `problems` e `outOfRound`. Título: "11 de 13 canais sincronizados agora; 2 com problema". Corpo: problemas com o `problemPhrase`. Linha própria: "Fora da rodada: Vou sem volta (buscando vídeos)." O `toast()` ganhou `opt.more`, uma linha extra.
  - **Rótulo curto do nicho livre (I5):** "Ler IA" / "Ler Viagem", com o nome inteiro em `aria-label`.
- **2.1.1:** corrige o rótulo duplo no modo "ativo + nicho livre". Cada botão da forja com dois rótulos mostra um só: fora do compacto, o inteiro (`.ch-lf`); no compacto, o curto (`.ch-ls`). Os dois spans são `aria-hidden` e o nome inteiro fica no `aria-label`/`title`. A auditoria da moldura falha se um botão visível mostrar o rótulo inteiro e o curto ao mesmo tempo (a 1440 e a 768).
- **2.1** (F10)
  - **Ativo + nicho livre:** novo modo `{active, canAsk, askLabel, askShort}` (ver `setForja`). O botão habilitado pede o nicho livre; o ocupado fica como status ativo; o leitor de tela diz "Pedido em andamento".
  - **Cabeçalho a 768 (I7):** status ativo e pílula terminal com no máximo 16ch e reticências (texto inteiro no `title` e no leitor de tela). Pílulas secundárias ficam só para o leitor de tela. Com pílula terminal, o botão da forja usa o rótulo curto "Pedir à forja" (`labelShort`). O `#screen` fica em 283 px em todos os estados.
  - **Reset dos ícones (I6):** `flex:none`, `align-self:auto`, `cursor:inherit` no svg. Nos filhos, `stroke-dasharray`, `stroke-dashoffset`, `stroke-linecap`, `stroke-linejoin`, `vector-effect` e `paint-order`. Bateria e assinatura da auditoria cobrem tudo.
  - **Menu ⋯ (M6):** com o foco no botão, seta para baixo abre no primeiro item e seta para cima no último.
  - **Sincronização (Canais M3):** o aviso inicial conta só os concorrentes que entram na rodada; quem está "buscando vídeos" fica fora (13 de 14).
- **2.0** (F9)
  - **Reset dos ícones (I4):** no `svg` e nos filhos, também `scale`, `rotate`, `translate`, `zoom`, `order`, `mix-blend-mode` e `content-visibility`; nos filhos, ainda `fill-opacity` e `stroke-opacity`. Bateria hostil e assinatura da auditoria cobrem tudo. A geometria (`d`, `r`, `stroke-width`) foi documentada como não protegida.
  - **Popover de frescor (M5):** numa linha com problema, a coluna "Última sincronização" mostra "—", porque a frase do motor (`problemPhrase`) já traz a data (menos em "buscando vídeos", que continua com a data). O leitor de tela ouve "data na coluna Situação".
  - **Medição do topo (`auditTopo` da moldura):** só funciona servida por http. Em `file://`, o navegador bloqueia o acesso aos iframes e cada tela irmã volta como "sem acesso (file://)". Sirva com `python3 -m http.server` na pasta `observatorio/`.
- **1.9** (F8)
  - **Pílula terminal:** o nome acessível é um texto só, montado por `srJoin`, sem espaço antes da pontuação e sem ponto duplo ("Último pedido: falhou às 14:21. Falhou nas 3 tentativas…"). O texto visível fica `aria-hidden`, para não ser lido duas vezes.
  - **`problemPhrase` (I3):** o popover de frescor (coluna Situação) e o aviso de resultado da sincronização usam `channel.sync.problemPhrase` do motor. A montagem local é só reserva.
  - **Reset dos ícones (I5):**
    - No `svg`: também `min-width`, `min-height`, `max-width`, `max-height`, `float`, `clip-path`, `mask`, `z-index` e `overflow`.
    - Nos filhos: `transform`, `filter`, `clip-path` e `mask`.
    - Bateria hostil: uma regra nova cobre essas propriedades, e a assinatura de estilo da auditoria as compara.
- **1.8** (F7)
  - **Topo do `#screen` (D8):** igual nas 6 telas, 16 px abaixo das abas: 418 px a 1440 e 283 px a 768 (antes ia de 402 a 418 e de 267 a 283). Detalhes na opção `content`.
  - **Reset dos ícones (I4):** os ícones do chrome também zeram `border`, `background`, `box-shadow`, `transform`, `outline`, `filter`, `border-radius` e `transition`. A bateria hostil ganhou uma regra `svg{…}` com tudo isso.
  - **Degradê à esquerda (M4):** o trilho de abas ganha degradê à esquerda quando rolou (`scrollLeft>0`) e à direita quando há abas depois. As duas bordas são recalculadas na rolagem, ao redesenhar e quando o drawer muda a largura.
  - **Status de reserva (M2):** `statusLabel` sem rótulo do motor usa o formato da CONVENCOES F3 ("nova tentativa · 15:05", "liberado pelo vigia · 15:05"). O motor já entrega esse formato; a reserva só vale para cenários antigos.
  - **Avisos (M3):** o aviso de início é "Sincronização iniciada" (CONVENCOES:22).
  - **Leitor de tela (M9):** a pílula secundária é lida como "Outro pedido, IA: publicado às 14:50".
  - **`onSynced`:** documentado e obrigatório (CONVENCOES F7). Com o `runSync` do motor, o canal próprio não é mais tocado: o frescor diz "sincronizado agora" e o popover lista só concorrentes.
  - **Barra de estados:** o rótulo fica numa coluna e os botões noutra, então a quebra de linha alinha com os botões (`.ch-mock-items`, `role="group"`).
- **1.7** (F6)
  - **Status do motor:** `statusLabel` usa o `sc.statusLabel` do motor tal como vem; a montagem local é só reserva e, sem horário, mostra só o estado. Com Todos, as `statusLines` do motor ("<Nicho>: " + rótulo do próprio pedido) são usadas sem reconstrução.
  - **Pedido dividido:** `forjaFromScenario` devolve `secondary`, as linhas dos nichos já terminados, que aparecem como pílula secundária (`.ch-pill-2`) ao lado do status ativo. Exemplo: "Viagem: trabalhando desde 14:55" + "IA: publicado às 14:50".
  - **Popovers:** frescor e menu ⋯ não fecham mais sozinhos. Há `st.inRefresh` durante o redesenho e `focusKey` ao abrir.
  - **Abas:** a aba atual rola para dentro do trilho de abas (sem mexer na página).
  - **"Sincronizar concorrentes":** usa `OBS.runSync`. Os avisos dizem "Sincronização pedida" e, depois, "N canais sincronizados agora; K com problema", sem "próxima rodada" nem "atualiza sozinha".
  - **Frescor:** com nicho, mostra "8 canais em Viagem" (e "· 14 no total" para leitor de tela). A tabela do popover é uma região rolável focável, com rótulo. Canais em busca aparecem como "ainda buscando vídeos".
  - **Leitor de tela:** o `statusText` da pílula terminal entra no texto para leitor de tela. A contagem dos botões de nicho deixou de usar `aria-label` em `span` e passou a usar `.ch-sr`.
- **1.6** (F5): preferências da URL validadas; sincronização sem sucesso fabricado; contagens das abas pelo nicho do link; frescor por nicho; ícones com traço e preenchimento por CSS escopado; toasts neutros, `forja` e acima do drawer modal; resize com rAF; `forjaFromScenario` com `anyActive`, `terminal` e `statusLines`.
- **1.5** (F4): compacto por largura disponível (container query); cópia para o Cowork com falha real; toasts nó a nó com retorno de foco; abas com nicho persistido; nome do status igual ao texto visível; pílula de estados terminais; blindagem de pseudo-elementos.
- **1.4:** modo compacto (267 px a 768).
- **1.3** (F3): `onStatus`, `setNiche({persist})`, `destroy` e `mount` idempotente, blindagem das raízes, toasts acessíveis.
- **1.2** (F2): classes `ch-*`, `all:revert`, sidebar como painel, `forjaFromScenario`.
- **1.0–1.1:** primeira versão; `forjaVariant`, `setDeps`.

**Compatibilidade:** a API de `mount()` não mudou desde a 1.3; tudo foi acrescentado, nada renomeado. As 6 telas foram conferidas com a 1.7 a 1440 e a 768: chrome montado, contagens das abas iguais a `OBS.tabCounts`, sem transbordo e console limpo. Canais também passou na própria auditoria (`audit-canais.js`).
