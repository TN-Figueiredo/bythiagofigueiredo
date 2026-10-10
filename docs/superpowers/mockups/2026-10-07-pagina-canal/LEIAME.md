# Página do canal e do vídeo: mockup para aprovação

Mockup 1 da seção 12 de `docs/superpowers/specs/2026-10-07-observatorio-canal-video-ui-design.md` (a página do canal é a §5). HTML, CSS e JS estáticos, sem framework e sem build. Não é código de produção.

## Como abrir

Abra `canal.html` direto do disco. A barra "Estados do mockup" fica no topo, recolhida, fora da tela simulada.

Aberto do disco (`file://`), o navegador recusa `pushState`, então o estado vai depois do `#` (`canal.html#fmt=longos&sort=vistos`). Servido por HTTP (`python3 -m http.server` nesta pasta), vai na query, como no produto (`canal.html?fmt=longos&sort=vistos`). Os dois caminhos foram testados: filtrar, recarregar e voltar devolvem o mesmo estado.

No mundo do mockup, "agora" é o instante da exportação: **07/10/2026 22:15 (São Paulo)**. A última sincronização real do canal foi às 18:03.

## Arquivos

| Arquivo | O que é |
|---|---|
| `canal.html` + `canal.js` | A página do canal: cabeçalho, abas Vídeos / Trocas / Leitura, controles, Capas e Lista, estados. |
| `canal.css` | Estilo. Os tokens são cópia literal de `_chrome/chrome.css:8-17` (tema escuro). Nenhuma cor nova. |
| `dados.js` | Os dados exportados do banco e o motor que calcula views/dia, múltiplo, ritmo e contagens. Gerado por script. |
| `video.html` + `video.js` | A página do vídeo de concorrente (spec §6), com Anterior/Próximo e a volta para o canal. |
| `forja.js` | O cartão "Leitura da forja" (§7), compartilhado pela aba Leitura do canal e pela seção Leitura do vídeo. |
| `shots/` | Capturas (lista no fim; as da rodada 2 estão na seção "Rodada 2"). |

## O canal e os dados

**Leo Khev** (nicho Viagem, 1,5 mil inscritos, `competitor_channels.id = 750c7dfd…`), **133 vídeos**: 61 longos, 71 Shorts e 1 com formato não confirmado (fabricado).

Por que ele: é o único canal com muitos vídeos e uma mistura real de longos e Shorts com duração de longo de verdade. O primeiro candidato (Travel with Luke Damant, 279 vídeos) foi descartado porque os "longos" dele no banco têm quase todos 61 a 105 s: são Shorts com `is_short = false`.

Reais, lidos de produção só com `SELECT`: nome, inscritos, nicho, horário da sincronização, os 133 vídeos (id, título, views, curtidas, comentários, duração, data, marca de Short, última conferência), a série diária de 03/10 a 07/10 dos 50 vídeos acompanhados e os inscritos de 07/09 e 07/10.

**O pedido era um canal com fixado e algumas trocas. Não existe.** Em produção nenhum canal tem vídeo fixado (`pinned_at` é nulo em todos) e nenhum tem mais de 2 trocas de título ou thumbnail; o Leo Khev tem zero. Por isso:

| Fabricado | Vídeo real usado (id do YouTube) | Valor real que foi trocado |
|---|---|---|
| Comentários nulos | `vWZkllvlGgw` "Qual é o meu custo de vida morando em Bangkok…" | 34 comentários |
| Formato não confirmado | `qTOnqtCc7AM` "O Shopping mais LEGAL da Tailândia!! Terminal 21" | `is_short = false` (tem 70 s) |
| Duração nula | `KentO6LP8cM` "O que dá para comprar em um mercado de rua…" | 1.230 s |
| Views nulas ("sem contagem") | `NfcuoEnPLig` "TERREMOTO NA TAILÂNDIA - DE NOVO!" | 168 views e 5 pontos de série |
| Sem data de publicação | `MFtD3-KPrP4` "Realizando sonho de infância…" | 22/05/2025 |
| Sem data de publicação | `-NvcZajdbsQ` "#tailandia #imigração #viagem #dicas" | 09/05/2025 |
| Fixado (recente) | `cGg6cVAyNPE` e `JMzU5DC-7Ag` | não fixados |
| Fixado antigo, sem views/dia | `NSj9xiaoqFw` "Indo para o Japão com a Tailandesa…" | não fixado; está fora dos 50 acompanhados de verdade |
| 7 trocas em 30 dias (4 de título, 3 de thumbnail) | `YekRfvf4gz0`, `7Cr3DLfUvW8` (2), `Lr0p4pTWuVk` (2), `cGg6cVAyNPE`, `B9pkK1_-YMY` | nenhuma troca; os títulos "Antes" são inventados |

A barra do mockup tem um botão para cada caso: ele rola até o cartão e põe o foco nele.

**Dado ausente que é real, sem fabricar:** 83 dos 133 vídeos estão fora dos 50 acompanhados (`video_limit = 50`) e não têm série diária. Neles a tela diz "não medido" em views/dia, e ordenar por "Mais views por dia" manda 82 para o divisor "Sem views por dia ainda (82)". A contagem de views deles é antiga (junho a agosto); o menu "Ações do vídeo" mostra a data.

**O múltiplo é uma aproximação.** `dados.js` calcula views ÷ mediana de views dos vídeos do mesmo formato no canal (longos: 507 em 59 vídeos; Shorts: 1,4 mil em 71), com mínimo de 5 vídeos. O motor real (`lib/multiplier.ts`) compara por faixa de idade e tira o próprio vídeo da base; aqui não. Os valores do mockup não batem com os do produto.

**Views/dia** = (última contagem − primeira) ÷ dias entre elas, na série de 03/10 a 07/10 (4 dias). O canal é pequeno: a maioria dá 0 ou menos de 1 por dia. É zero medido, não ausência.

**O @ do canal não existe no banco** (`competitor_channels` não tem coluna de handle). O cabeçalho do mockup sai sem o @; o spec o pede na linha 1.

## Provas

Medidas no Chrome das ferramentas de desenvolvimento, em contexto isolado, viewport 1440×900, servido por HTTP local.

### 1. Dobra em 1440×900

| Medida | Meta | Medido |
|---|---|---|
| Cartões inteiros em Capas | ≥ 10 | **10** (5 colunas × 2 fileiras; cartão de 224 × 247 px) |
| Linhas inteiras em Lista | ≥ 8 | **9** (linha de 56 px) |
| Altura do cabeçalho do canal | ≤ 150 px | **79 px** |
| Topo da grade | ≤ 300 px | **297 px** do topo da tela simulada |

As contagens de cartões e linhas foram feitas com a barra do mockup (33 px) ocupando o topo da janela; sem ela sobram 33 px a mais. O topo da grade, medido da janela com a barra, é 330 px.

A moldura acima do conteúdo (cabeçalho "YouTube" de 49 px e abas do YouTube de 41 px) é estática e copia as dimensões do mockup de 06/10, não o `YouTubeShell` real. Se o real for mais alto, os 297 px sobem na mesma medida: a folga é de 3 px.

A linha "133 vídeos: 61 longos, 71 Shorts, 1 com formato não confirmado." fica à direita das abas, na mesma linha, justamente para não custar altura.

Sem rolagem horizontal da página em 1440, 1280, 1024, 768, 390 e 320 px (largura de rolagem = largura da janela nas seis).

### 2. Contraste

Calculado pela fórmula da WCAG sobre os valores hex; fundos translúcidos compostos sobre o fundo real.

| Tipo | Par | Razão | Mínimo | Resultado |
|---|---|---|---|---|
| texto | `--text` sobre `--bg` | 15,61:1 | 4,5:1 | passa |
| texto | `--text` sobre `--surface` (título do cartão) | 14,48:1 | 4,5:1 | passa |
| texto | `--text` sobre `--surface-2` (segmento ativo) | 13,82:1 | 4,5:1 | passa |
| texto | `--muted` sobre `--bg` (linhas 2 e 3, rodapé) | 6,67:1 | 4,5:1 | passa |
| texto | `--muted` sobre `--surface` (números e rótulos do cartão) | 6,18:1 | 4,5:1 | passa |
| texto | `--muted` sobre `--surface-2` (item de menu em foco) | 5,90:1 | 4,5:1 | passa |
| texto | `--muted` sobre `--sunk` (barra do mockup) | 6,92:1 | 4,5:1 | passa |
| texto | `--dim` sobre `--surface` (data do cartão, 12 px) | 4,86:1 | 4,5:1 | passa |
| texto | `--dim` sobre `--bg` (separador da trilha) | 5,24:1 | 4,5:1 | passa |
| texto | `--accent` sobre `--bg` (aba ativa da moldura) | 7,24:1 | 4,5:1 | passa |
| texto | `--on-accent` sobre `--accent` (botão preenchido) | 7,51:1 | 4,5:1 | passa |
| texto | `--viagem` sobre `--bg` (seletor de nicho) | 7,87:1 | 4,5:1 | passa |
| texto | `--tier-mid` sobre `--surface` ("alto", 12 px) | 7,73:1 | 4,5:1 | passa |
| texto | `--tier-high` sobre `--surface` ("muito alto", 12 px) | 6,08:1 | 4,5:1 | passa |
| texto | `--tier-top` sobre `--surface` ("topo", 12 px) | 5,34:1 | 4,5:1 | passa |
| texto | `--tier-mid` / `--tier-high` / `--tier-top` sobre `--bg` (Lista) | 8,33 / 6,56 / 5,76:1 | 4,5:1 | passa |
| texto | `--warning-text` sobre `--bg` (linha 3 atrasada) | 8,31:1 | 4,5:1 | passa |
| texto | `--warning-text` sobre `--warn-subtle` (faixa "Atenção") | 6,74:1 | 4,5:1 | passa |
| texto | `--text` sobre `--warn-subtle` | 12,67:1 | 4,5:1 | passa |
| texto | `--danger` sobre `--bg` | 6,03:1 | 4,5:1 | passa |
| texto | `--danger` sobre `--danger-subtle` (faixa "Erro") | 5,34:1 | 4,5:1 | passa |
| texto | `--danger` sobre `--surface` (item "Remover canal…") | 5,59:1 | 4,5:1 | passa |
| texto | `--forja` 12,5 px sobre `--forja-subtle` (selo) | 6,25:1 | 4,5:1 | passa |
| texto | `--forja-soft-text` sobre `--forja-soft-bg` (botão apagado) | 6,42:1 | 4,5:1 | passa |
| texto | `--on-forja` sobre `--forja` (botão aceso) | 7,19:1 | 4,5:1 | passa |
| texto | branco sobre o selo `rgba(0,0,0,.82)`, com capa branca atrás (pior caso) | 13,60:1 | 4,5:1 | passa |
| componente | `--dim`: borda da busca e do seletor de ordenação | 5,24:1 | 3:1 | passa |
| componente | `--muted`: contorno do segmento ativo (filtro e vista) | 6,18:1 | 3:1 | passa |
| componente | `--accent`: anel de foco sobre `--bg` / sobre `--surface` | 7,24 / 6,72:1 | 3:1 | passa |
| componente | `--viagem`: borda do seletor de nicho | 7,87:1 | 3:1 | passa |
| componente | `--forja`: borda do selo | 7,81:1 | 3:1 | passa |
| componente | `--warning`: borda da faixa e do selo "exemplo" | 8,31:1 | 3:1 | passa |
| componente | `--danger`: borda da faixa de erro | 6,03:1 | 3:1 | passa |
| componente | `--muted`: ícone do botão "Ações do vídeo" | 6,18:1 | 3:1 | passa |
| componente | **`--border-strong`: borda dos botões e do grupo de filtro, sobre `--bg`** | **1,55:1** | 3:1 | **REPROVA** |
| componente | **`--border-strong`: borda do botão contra o fundo do próprio botão** | **1,44:1** | 3:1 | **REPROVA** |
| componente | **`--border-subtle`: borda do cartão** | **1,18:1** | 3:1 | **REPROVA** |
| componente | **`--border`: linha das abas e da tabela** | **1,31:1** | 3:1 | **REPROVA** |
| componente | **`--forja-line`: borda do cartão da forja** | **2,11:1** | 3:1 | **REPROVA** |

Sobre os cinco reprovados: são os tokens de linha do produto, usados como estão. Em todos eles a borda não é o único sinal (botão tem rótulo ou ícone que passa; cartão, linha de aba e linha de tabela são separadores). Onde a borda **é** o que identifica o controle (campo de busca, seletor de ordenação, estado ativo do filtro), o mockup trocou `--border`/`--border-strong` por `--dim` e `--muted`, que passam. Se a regra do spec ("par reprovado bloqueia") valer também para borda decorativa, os três tokens de linha precisam de valor novo, e isso é decisão de paleta, fora deste mockup.

### 3. Paradas de Tab

**24 paradas em 12 cartões: 2 por cartão** (o link capa + título e o botão "Ações do vídeo: <título>"). Contado no DOM e conferido com a tecla Tab de verdade nos dois primeiros cartões (link, ações, link, ações). Na Lista, também 2 por linha, mais 4 nos cabeçalhos ordenáveis.

Antes da grade há 17 paradas (trilha, nicho, Abrir no YouTube, ações do canal, ⓘ, 3 abas, 4 de filtro, ordenar, busca, 2 de vista, "Pular a lista de vídeos").

Menu "Ações do vídeo", com teclas de verdade: Enter abre com o foco no primeiro item; setas, Home e End circulam; Esc fecha e devolve o foco ao botão.

### 4. Tempo do filtro

Seis trocas seguidas de filtro com 133 vídeos:

| | Medido |
|---|---|
| Só o JavaScript (clique até o DOM pronto) | 3 a 25 ms |
| Clique até dois quadros desenhados | 16 a 29 ms |
| Indicador de carregamento | nenhum |

A primeira troca é a mais lenta (25 / 29 ms); as seguintes ficam em 10 / 17 ms. Meta: menos de 100 ms, sem indicador.

### Outras conferências feitas

- Esqueleto e página final: as 10 primeiras caixas de cartão têm posição e tamanho idênticos; a linha de controles não se move. Com carga de 800 ms o esqueleto aparece depois de 100 ms; com carga de 60 ms, nunca aparece.
- Todos os cartões têm 247 px de altura, com ou sem dado.
- Voltar do vídeo: canal → vídeo 59 → Próximo três vezes → Voltar. O histórico não cresceu, a lista subiu para 120 e o foco caiu no cartão do vídeo 62. No segundo teste (Voltar do navegador), a rolagem voltou ao mesmo ponto (458 px).
- "Mostrar mais 60" põe o foco no primeiro cartão novo.
- Alvos: nenhum controle abaixo de 24 px em 1440; nenhum abaixo de 44 × 44 em 390 px com toque (142 controles medidos).
- Menor texto da tela: 12 px. Nenhum `color-mix()`.
- A busca anuncia depois de 500 ms; filtro, vista e ordenação anunciam na hora, um anúncio por mudança.
- Os três números ficam na mesma ordem em qualquer ordenação; só muda qual fica em `--text` com peso 600.

**Não conferido:** leitor de tela de verdade (só os atributos no DOM), zoom de 200% e 400%, escala de cinza, `prefers-reduced-motion` ligado (a regra está no CSS; não foi exercitada) e outros navegadores além do Chrome.

## O dono decide aqui

1. **Vista padrão: Capas ou Lista?** O mockup abre em Capas (recomendação do spec). A Lista mostra 9 vídeos na dobra com curtidas, comentários e trocas; as Capas mostram 10 com a thumbnail.
2. **Densidade do cartão.** A barra do mockup troca entre três:

   | Por linha em 1440 | Cartão | Inteiros na dobra | Observação |
   |---|---|---|---|
   | 4 (capa maior) | 281 px | 4 | não bate a meta de 10 |
   | **5 (proposto)** | 247 px | 10 | os três números cabem sem encostar |
   | 6 (compacto) | 225 px | 12 | "não medido" passa da coluna e encosta no vizinho |

3. **Os números do cabeçalho estão certos?** Hoje: ritmo (longos e Shorts por semana, 90 dias), views/dia mediana dos longos, inscritos em 30 dias. Num canal pequeno como este dão "0,2 longo + 0,1 Short por semana · 0,3 views/dia · +1,3%": verdadeiros, pouco úteis. Falta decidir também o que a linha 3 diz quando o canal tem mais vídeos guardados que acompanhados ("133 vídeos: 50 acompanhados, 1 fixado antigo, 82 mais antigos sem contagem diária").
4. **O que fazer com os vídeos fora dos acompanhados.** O spec fala em "até 200 vídeos no pacote", mas hoje só 50 por canal têm contagem. Os outros aparecem com views antigas e "não medido". Mostrar assim, esconder, ou subir o limite?

## Diferenças em relação ao spec

| Spec | Mockup | Motivo |
|---|---|---|
| Três números em **uma linha** de texto ("84 mil views 6,1 mil/dia 3,4× alto") | Três colunas fixas, valor em cima e rótulo embaixo | A frase tem ~240 px e o cartão de 5 por linha tem 204 px úteis. Em colunas, a posição fica fixa de verdade. |
| Botão ⓘ no múltiplo de cada cartão | Sem ⓘ no cartão. A base está no topo do menu "Ações do vídeo" e numa nota sob a grade | O spec pede também no máximo 2 paradas de Tab por cartão; as duas regras não cabem juntas. |
| Um ⓘ para cada número do cabeçalho | Um ⓘ só, "Sobre os números do canal", com as três bases | Três paradas de Tab a menos antes da grade. |
| Linha de resultado sob os controles | À direita das abas, na mesma linha | Custaria 20 px e a grade passaria de 300 px. |
| Lista vira pilha em ≤ 480 px | Vira pilha em ≤ 820 px (duas colunas de blocos até 480, uma abaixo) | Nove colunas não cabem em 768 px sem rolagem horizontal. |
| "Buscando: 12 de 48 vídeos…" | "Sincronizando: 12 de 48 vídeos. Os números aparecem quando a sincronização terminar." | Texto do pedido deste mockup e do vocabulário do próprio spec ("sincronizar"). |
| @ do canal na linha 1 | Ausente | Não existe no banco. |
| "51 vídeos: 48 recentes, 3 fixados antigos" | "133 vídeos: 50 acompanhados, 1 fixado antigo, 82 mais antigos sem contagem diária" | O canal real tem mais vídeos guardados do que acompanhados; a frase do spec não cobre esse caso. |
| Células "não medido" por número | Quando faltam views/dia **e** múltiplo, uma frase só: "views/dia e múltiplo: não medido" | Duas células "não medido" lado a lado se sobrepõem em 204 px. |
| Borda de controle nos tokens `--border*` | `--dim` na busca e no seletor, `--muted` no segmento ativo | Os tokens de linha dão 1,2 a 1,6:1 (ver prova 2). |
| `SwapCard` de hoje na aba Trocas | Cartão simples: campo, quando, antes e agora | Aba pedida como "simples e honesta". Para thumbnail, o "antes" diz "imagem anterior não arquivada". |
| Trilha e tema | Só tema escuro; "Canais" na trilha abre o mockup de 04/10 | O spec fixa desktop e tema escuro para estas telas. |

Acréscimos que o spec não descreve: a nota fixa sob a grade explicando múltiplo e views/dia; o divisor "Sem contagem de views" na ordenação "Mais vistos"; "Em Todos, há N vídeos com esse texto" quando a busca dá vazio dentro de um filtro; o motivo de cada "não medido" no menu de ações.

## O que não foi feito

- Tudo da §13 ("Depois da primeira versão"): filtro "Com troca", capa anterior no hover, faixa de números presa.
- **Canal próprio** (§5.2: selo "seu canal", aba Retenção, cartão sem múltiplo). A seção 12 do spec pede um; ficou fora deste pedido.
- Estados "Canal não encontrado" e "Erro: a última sincronização falhou" (§5.7). O pedido listava sete estados e esses dois não estavam.
- Fixado "o YouTube não devolveu este vídeo" (`sem-resposta`). O "aguardando a primeira sincronização" aparece ao fixar, pelo menu, um vídeo fora dos acompanhados.
- Múltiplo "poucos vídeos para comparar (2; precisa de 5)": o texto está no código, mas o canal tem base de sobra e nenhum cartão o mostra.
- Pré-carga no hover e transição da thumbnail para a capa do vídeo (§10): dependem do roteador do produto.
- Tema claro e o menu lateral do CMS em telas estreitas (a lateral some abaixo de 1100 px, sem botão para abrir).
- (Rodada 1) A página do vídeo era placeholder: feita na rodada 2, abaixo.
- "Sincronizar só este canal", "Remover canal…" e o seletor de nicho só mostram um aviso; "Fixar" muda o cartão e a contagem em memória e se perde ao recarregar.
- (Rodada 1) A aba Leitura era um parágrafo-placeholder: refeita na rodada 2.

## Capturas (`shots/`)

| Arquivo | Mostra |
|---|---|
| `1440-capas.png`, `1440-lista.png` | A dobra nas duas vistas (Lista ordenada por views) |
| `768-capas.png`, `768-lista.png` | 768 px; a Lista já em pilha de duas colunas |
| `390-capas.png`, `390-lista.png` | 390 px com toque; alvos de 44 px |
| `1440-menu-acoes.png` | Menu "Ações do vídeo" com o motivo de "Comentários: não medido" |
| `1440-divisor-sem-views-por-dia.png` | Ordenado por views/dia, no divisor "Sem views por dia ainda (82)" |
| `1440-fixados-com-atraso.png` | Filtro Fixados com a sincronização atrasada; o cartão "fixado antigo" |
| `1440-estado-carregando.png`, `-erro.png`, `-primeira-sincronizacao.png`, `-atrasada.png`, `-sem-videos.png`, `-busca-sem-resultado.png` | Os estados da barra do mockup |
| `1440-aba-trocas.png`, `1440-aba-leitura.png` | As outras duas abas |

Seis capturas de estado e as duas de aba foram tiradas antes do último ajuste das colunas de números do cartão; a diferença é de poucos pixels na largura das colunas. `1440-capas.png`, `1440-fixados-com-atraso.png` e `1440-divisor-sem-views-por-dia.png` são do estado final.

---

# Rodada 2: trocas que levam ao histórico, página do vídeo e leitura da forja

> **Substituída em parte pela Rodada 3 (no fim deste arquivo).** A página do vídeo que esta seção descreve (Resumo, barra presa, tira de capas, Versões) foi **reprovada pelo dono e trocada pela tela "Histórico do vídeo" de produção**. Continuam valendo desta seção: a aba Trocas, o cartão da forja (`forja.js`) e as URLs de situação da leitura. As capturas `1440-video-*`, `768-video-*` e `390-video-*` dessa rodada foram apagadas.

Pedido do dono ao ver a rodada 1: (1) "não tem como ver histórico a partir de trocas" e (2) "falta me mostrar como vai ficar depois de a leitura ter sido feita". Spec: `2026-10-07-observatorio-canal-video-ui-design.md` §6, §7, §10, §11.

## Como chegar em cada tela (servidor estático em 127.0.0.1:8791)

| Tela | URL |
|---|---|
| Aba Trocas | `canal.html?tab=trocas` |
| Do clique numa troca ao vídeo | clicar em "Ver histórico do vídeo" (ou na linha, título ou capa): `video.html?id=…&troca=<ms>&back=…&ids=…` |
| Vídeo, padrão | `video.html?id=7Cr3DLfUvW8` (2 trocas: título e thumbnail) |
| Leitura, qualquer situação | acrescente `&leitura=<situação>` (canal: `canal.html?tab=leitura&leitura=pronta`; vídeo: `video.html?id=7Cr3DLfUvW8&leitura=pronta`) |
| Situações | `nunca`, `fila`, `trabalhando`, `retry`, `liberado`, `atraso`, `semmaquina`, `pronta`, `limite`, `desatualizada`, `precisa`, `falhou`, `travou`, `semevid`; só no canal, `hoje` (como é hoje, sem a §7.3) |
| Variações do vídeo | `video.html?id=HxTpJA-z0Gg` (sem contagem diária, sem troca, versão única), `?id=NfcuoEnPLig` (views nulas), `?id=NSj9xiaoqFw` (fixado antigo), `?id=r9KVNPLMZ1c&serie=1` (série de 1 dia, fabricada), `&sync=atrasada` (faixa de sincronização atrasada). Todas também na barra "Estados do mockup" |

A barra "Estados do mockup" (topo, recolhida) tem as linhas "Leitura da forja" (as 5 situações pedidas), "Variantes da leitura" (as frases restantes da §7.2) e, no vídeo, "Outro vídeo" e "Sincronização". O botão "Pedir leitura" percorre fila (2 s) → escrevendo (3 s) → pronta e o cartão diz, em texto, "Simulação do mockup". "Pausar atualização automática" congela o avanço; "Cancelar pedido" volta a "nunca pedida".

## Entrega A: aba Trocas

- Cada troca é um caminho: thumbnail e título são links; mais uma ação visível, "Ver histórico do vídeo ›", com nome acessível completo ("Ver histórico do vídeo: <título>, troca de thumbnail de 04/10"). A linha inteira também é clicável com o mouse; o teclado usa os dois links (a capa fica fora da ordem de Tab, é redundante).
- Destino: `video.html` com a troca clicada **destacada em Versões (anel laranja de 3 px + selo "aberta pela lista de trocas") e com o foco nela**, a comparação já preenchida com essa troca e o status lendo "Aberta a troca: …". O pager anda pelos vídeos que têm troca ("3 de 5").
- Voltar (botão do navegador, "Voltar" ou a trilha) cai na aba Trocas, no botão da troca aberta, com o foco, na mesma rolagem. Medido: rolagem 484,5 px antes e depois; foco em `#sw-<ms>`. Com Anterior/Próximo, o foco da volta vai para a troca mais recente do último vídeo visto.
- Trocas vizinhas do mesmo vídeo viram um grupo: uma capa, um título, o selo "Mesmo vídeo: 2 trocas", uma linha por troca ligada por uma barra vertical. Trocas do mesmo vídeo que não são vizinhas ganham a frase "Este vídeo teve mais 1 troca nos 30 dias, em outra data: título em 22/09" (link) e o selo.

## Entrega B: página do vídeo (spec §6)

Cabeçalho (capa 280×158, título em Fraunces, publicação/formato/sincronização, Fixar e Abrir no YouTube), tira de capas, barra presa de seções, Resumo, Linha do tempo, Comparação, Versões e Leitura.

- **Tira de capas:** uma capa anterior por troca de thumbnail, 96×54, com o período embaixo e `aria-pressed`. A imagem anterior nunca foi arquivada, então cada uma é o quadro tracejado "imagem não arquivada". Escolher uma preenche a comparação. Sem troca: "Esta é a única capa vista nos últimos 30 dias."
- **Barra presa:** só com largura ≥ 768 px e altura ≥ 600 px; `--sticky-h` = 44 px; `nav` "Seções do vídeo" com `aria-current="location"`; clicar foca o `h2`; o observador de rolagem nunca move o foco. Pager "‹ 3 de 5 ›" na barra e na trilha, `[` e `]` só com o foco no título ou no pager.
- **Resumo:** 5 células (views, views/dia, múltiplo com o nível por escrito, curtidas, comentários) com a taxa sobre views. O que falta diz por quê na própria célula.
- **Linha do tempo:** barras de views ganhas por dia (a série é 03/10 a 07/10, então 4 barras), trecho tracejado "sem contagem diária antes de 04/10", faixa de títulos (T1, T2…) e de thumbnails (Capa 1, Capa 2…), marcadores de troca em `role="toolbar"` com setas, Home, End, Enter/Espaço preenche a comparação; título trocado mostra a janela ("entre 05/10 12h e 18h") como faixa translúcida, thumbnail tem o horário exato. 7 d / 30 d / 90 d / Tudo e "Ver como tabela" (`aria-expanded`, tabela com `caption` e `th scope`). Nota fixa "A série começa em 03/10, não na publicação".
- **Comparação** (logo abaixo, ≤ 150 px): antes/depois, escolha por botões e "Efeito em 7 dias". Hoje **nenhuma troca tem efeito medido** (a série começa em 03/10 e a comparação pede 7 dias depois): as de até 7 dias dizem "Aguardando: faltam N dias", as mais velhas "Sem série". Isso é verdade, não esboço.
- **Versões:** títulos (T1, T2) e thumbnails (Capa 1, Capa 2) em duas colunas, com datas em São Paulo, "entre X e Y" para título, horário exato para thumbnail e "imagem anterior não arquivada". Cada versão criada por uma troca tem `id="tr-<ms>"` (é o alvo do foco).
- **Dado ausente (§6.5):** sem contagem diária (fora dos 50 acompanhados), sem troca nenhuma, versão única, views nulas, série de 1 dia, fixado antigo, comentários/curtidas nulos, duração nula, formato não confirmado, sem data, sincronização atrasada. Canal próprio e "Não encontrado" ficam como estão (não pedidos).

## Entrega C: leitura da forja nas duas páginas

As situações da §7.2 estão todas, com as frases do spec: nunca pedida, na fila, escrevendo, nova tentativa, liberado sozinho, com atraso, forja desligada, pronta, precisa de você, não deu (3 motivos); mais "pronta, desatualizada" (pedida pelo dono) e "pronta com limite do dia" (o texto de botão apagado da §7.1). Ícones distintos para espera, atraso, ok, desatualizada e falha, e as palavras "cota", "vigia", "validador" e "conferência" não aparecem.

**A situação "pronta"** mostra o cartão da §7.1: selo único "forja · Gemma 12B · em treino · gerada 07/10 20:18 (SP)" com ⓘ ("O modelo ainda não é especialista…"), "Leu 133 vídeos e 7 trocas, dados de 07/10 18:03", título e texto em Fraunces, evidências numeradas (cada número no texto é um link para o vídeo ou a troca, dentro do mockup; no vídeo, a troca da própria página só rola e foca a versão), lista "Evidências" com nota por item, "Do site: desde então, nenhum vídeo novo e nenhuma troca." e o botão "Pedir nova leitura…". "Desatualizada" é a mesma leitura de 05/10 (dados de 05/10 09:00, 4 trocas, uma por vez com os números da época) com a faixa âmbar "saíram 3 trocas" e o link "Ver as 3 trocas" que abre a aba Trocas.

### O que é fabricado, de propósito

- **Todo texto de leitura** (canal e vídeo) é escrito por mim, **não pela forja, que nunca produziu uma leitura real**. Vai marcado com o selo "exemplo" e uma faixa tracejada que diz isso. Os números, porém, não são digitados: saem de `dados.js` (views, medianas, múltiplo, contagens, datas das trocas), para os links de evidência baterem com vídeos e trocas que existem.
- As 7 trocas (e os títulos "Antes") e os 3 fixados continuam fabricados (ver a tabela da rodada 1). Isso contamina as leituras: "o longo mais visto trocou de título em 28/09" descreve uma troca inventada.
- O horário "gerada 07/10 20:18", "na fila desde 22:11", "esperando há 40 min" e "forja desligada desde 20:40" são cenário do mockup. A leitura do vídeo é montada por um gabarito a partir dos dados do vídeo aberto, então o texto é parecido entre vídeos.
- O "Do site" do vídeo desatualizado usa só trocas do próprio vídeo.

### Escopo honesto e o contrato do validador

Seguido a partir de `~/Workspace/forja/observatorio/LEIAME.md`: só views públicas, títulos, thumbnails, datas e trocas. Nenhum texto cita CTR, retenção ou impressões, e **também não cita curtidas e comentários** (a forja não os recebe de concorrente; os dois aparecem só no Resumo). Nenhuma frase liga thumbnail a causa; as que citam troca terminam com "não prova causa". O pacote real hoje não traz variação medida em nenhuma troca (série desde 03/10), e o texto de exemplo diz isso em vez de inventar um efeito. Os números do texto não foram conferidos contra um `sent.numbers` real (não existe para este canal).

## Medidas (Chrome, 1440×900, servido por HTTP; a barra do mockup ocupa 32 px)

| Medida | Resultado |
|---|---|
| Cabeçalho da página do vídeo | 164 px (meta ≤ 190) |
| Barra presa | 44 px |
| Resumo | 74 px (células de 72 px mais a borda) |
| Gráfico com faixas (placa inteira) | 192 px (meta ≤ 240) |
| Comparação | 138 px (meta ≤ 150) |
| Fim da comparação na janela | 903 px com a barra do mockup; **871 px sem ela**. Com a barra aberta/recolhida, os últimos 3 px da comparação passam da dobra. Antes de eu reduzir o gráfico de 120 para 100 px de altura e as margens, passava 29 px |
| Rolagem horizontal da página | nenhuma em 1440, 768 e 390 px (largura de rolagem = largura da janela) |
| Alvos em 390 px (toque) | tudo ≥ 44 px, exceto os números de nota ¹ ² (inline em frase, com área de toque ampliada na vertical) e os links inline de "Este vídeo teve mais 1 troca…" (inline em frase) |
| Console | sem erros |

Verificado no navegador (script e prints): a navegação Trocas → vídeo (foco, destaque, pager "3 de 5") e a volta; a simulação fila → escrevendo → pronta (foco no cartão, status lido, URL com `leitura=pronta`); as telas dos prints. **Inferência, não verificada:** leitor de tela, teclado completo nos marcadores do gráfico (a lógica de setas está no código, não foi exercitada com teclas reais), contraste dos tokens novos (`--success` do selo "no ar", `--forja` nas notas, `--on-accent` no selo "aberta pela lista de trocas") fora da tabela da rodada 1, movimento reduzido, zoom 200–400%, outros navegadores. A faixa translúcida da janela de título usa `rgba(255,130,64,.18)` literal.

## Decisões minhas (reverta o que não servir)

1. **Thumbnails ficam em Versões**, além da tira de capas. O spec (§6.2) as tira de Versões, mas o pedido pede "histórico de título e thumbnail" na seção; como nenhuma imagem anterior existe, a duplicação é barata.
2. **Canal com leitura própria:** a aba Leitura do canal mostra o cartão como se a §7.3 estivesse pronta (botão aceso, texto do canal). O comportamento de hoje (botão apagado + leitura do nicho) é a situação `hoje`.
3. "Efeito em 7 dias" nunca mostra número: dado que não existe é ausência explicada.
4. Gráfico: padrão 30 d, que deixa quase tudo tracejado (a série tem 5 dias). É o retrato honesto; "7 d" aproxima.
5. ⓘ do Resumo viraram texto visível na própria célula ("não medido" + motivo), sem popover.
6. A forja é "vista como exemplo": o cartão de leitura traz selo e faixa de exemplo em todas as telas desta rodada; na tela real isso some.
7. Vídeo sem views + situação "pronta" cai em "Precisa de você" (a mensagem fala de dado antigo; o motivo certo seria "sem contagem de views").
8. Estados de fila: "Cancelar pedido" e "Pausar atualização" só mexem na simulação.

## Não feito

- Canal próprio na página do vídeo (selo, Retenção, % assistido) e "Vídeo não encontrado" dentro da moldura (já existe, sem print novo).
- "Leitura anterior" visível enquanto um novo pedido está na fila (a §7.1 mostra no cartão); no mockup o cartão troca de situação.
- "Ver as N capas" acima de 6 capas, expansão de tags (não há tags no banco exportado), e a transição de elemento compartilhado capa→cabeçalho (§10).
- Tema claro. Impressão. Comparação por palavra (diff) nos títulos.
- Prints dos estados `trabalhando`, `retry`, `liberado`, `semmaquina`, `precisa` do canal, `limite` e `travou`/`semevid`: existem pela URL, sem print. Print de 390 e 768 só de Trocas, Leitura pronta (canal) e vídeo com leitura pronta.

## Perguntas ao dono

1. **O dado de Trocas da rodada 1 era fabricado e agora alimenta uma leitura "pronta". Aceita ver a leitura sobre um canal de verdade sem troca?** Recomendo manter a fabricação para o mockup e exigir, na implementação, o canal real com pelo menos 2 trocas medidas com 7 dias; hoje nenhum canal passa.
2. **Linha inteira clicável nas Trocas ou só os links?** Recomendo o que está: linha clicável com o mouse, dois links por teclado (título e "Ver histórico do vídeo").
3. **Thumbnails em Versões (decisão 1): manter ou seguir o spec?** Recomendo manter enquanto a imagem anterior não existir; quando existir, a tira de capas basta.
4. **O texto de exemplo da leitura é útil ou chato?** A frase "Nenhuma das 7 trocas tem variação medida" será a leitura real por semanas. Recomendo que o treino da forja produza isso mesmo (o validador exige), e que o produto abra a leitura com o que a pessoa pode fazer ("espere 7 dias") em vez de só dizer que não há efeito.
5. **Gráfico em 30 d por padrão ou 7 d?** Com 5 dias de série, 30 d é quase todo tracejado. Recomendo manter 30 d (as trocas estão nesse horizonte) até a série passar de 14 dias.

## Capturas da rodada 2 (`shots/`)

| Arquivo | Mostra |
|---|---|
| `1440-aba-trocas.png`, `768-aba-trocas.png`, `390-aba-trocas.png` | A aba Trocas com grupos, selos e a ação "Ver histórico do vídeo" |
| `1440-aba-leitura-nunca.png`, `-fila.png`, `-fila-com-atraso.png`, `-pronta.png`, `-desatualizada.png`, `-falhou.png` | A aba Leitura do canal em cada situação |
| `768-aba-leitura-pronta.png`, `390-aba-leitura-pronta.png` | A leitura pronta do canal estreita |
| `1440-video-dobra.png` | A primeira tela do vídeo em 1440×900 |
| `1440-video-completa-leitura-pronta.png`, `768-video-leitura-pronta.png`, `390-video-leitura-pronta.png` | A página inteira com a leitura pronta |
| `1440-video-troca-destacada.png` | Chegada pela aba Trocas: troca destacada em Versões, comparação preenchida |
| `1440-video-leitura-desatualizada.png` | Seção Leitura do vídeo, pronta porém desatualizada |
| `1440-video-sem-contagem-diaria-sem-troca.png` | Sem série, sem troca, versão única, leitura nunca pedida |
| `1440-video-views-nulas.png` | Views nulas e o "Precisa de você" |
| `1440-video-fixado-antigo-leitura-falhou.png` | Fixado antigo e a situação "Não deu" |
| `1440-video-serie-de-1-dia-leitura-fila.png` | Série de 1 dia e a leitura na fila |


---

# Rodada 3: a página do vídeo é o "Histórico do vídeo" de produção

O dono reprovou o desenho novo (mais pobre) e pediu que o clique da aba Trocas leve à tela especializada que já existe em `/cms/youtube/competitors/video/[id]`. **`video.html` agora é essa tela**, copiada do mockup aprovado `2026-10-07-historico-muitas-versoes` (motor `dados.js`, `tela.js`, `historico-base.css`, `fase4.css`), ligada aos dados do Leo Khev. Nada da outra pasta foi editado.

## Arquivos desta rodada

| Arquivo | O que é |
|---|---|
| `video.html` + `video.js` | O Histórico do vídeo. `video.js` é o `tela.js` aprovado com as mudanças marcadas "rodada 3" (pager e Voltar vindos do canal, cabeçalho para formato/dado ausente, eixo comprimido, thumbnail "não arquivada", chegada pela troca, cartão da forja, barra do mockup). |
| `hist-dados.js` | O motor aprovado (effect, series, changes, R115/R116/R121, versões, resumo por imagem) ligado a `dados.js`: vídeos, séries e trocas do Leo Khev. Mudanças marcadas "rodada 3". |
| `hist.css` | Tokens e moldura do `canal.css` + `historico-base.css` e `fase4.css` **sem edição** + o cartão da forja e os acréscimos. A tela não usa mais o `canal.css`. |
| `forja.js` | O cartão "Leitura da forja" (rodada 2), agora também dentro do histórico. |
| `canal.html` / `canal.js` / `canal.css` | A aba Trocas, "Carregar mais" e o múltiplo alinhado (abaixo). |

## Como chegar (127.0.0.1:8791)

| Tela | URL |
|---|---|
| Aba Trocas (resumo) | `canal.html?tab=trocas` |
| Chegada pela troca | clicar em "Abrir histórico do vídeo": `video.html?id=7Cr3DLfUvW8&troca=1791234000000&back=%3Ftab%3Dtrocas&ids=…` |
| Histórico direto | `video.html?id=7Cr3DLfUvW8` |
| Leitura em qualquer situação | `…&leitura=pronta` (`nunca`, `fila`, `trabalhando`, `retry`, `liberado`, `atraso`, `semmaquina`, `pronta`, `limite`, `desatualizada`, `precisa`, `falhou`, `travou`, `semevid`) |
| Variações | `?id=HxTpJA-z0Gg` (sem registro diário, sem troca, versão única), `NfcuoEnPLig` (views nulas), `NSj9xiaoqFw` (fixado antigo), `Lr0p4pTWuVk` (duas trocas antes da série), `&sync=atrasada`; todas na barra "Estados do mockup" |
| Período do gráfico | `&range=7`, `30` (padrão), `90`, `tudo` |

## O que a tela tem (da produção, sem perder nada)

Trilha "Canais / Leo Khev / Histórico do vídeo" e pager "vídeo 3 de 5 com trocas de Leo Khev (trocas dos últimos 30 dias, da mais recente à mais antiga)" (ou "(longos, do mais novo ao mais antigo)" vindo da grade); capa com duração, título, canal, nicho, views, "publicado há 257 dias (23/01 17:00)", formato, "sincronizado há 4 h" e o multiplicador "2,1× vs vídeos do canal com 91–365 dias (n = 18), método: aproximação por faixa"; selos "2 títulos", "2 thumbnails em 2 períodos" ou "Nenhuma troca registrada"; Fixar vídeo, Abrir no YouTube, Pedir leitura à forja; o cartão "Views por dia e cada troca" com a linha em degraus, valor de cada dia, dia em coleta hachurado, as **três faixas alinhadas ao eixo (Título T1…, Thumbnail A…, Descrição D1)** com marcadores, janelas de sincronização e agrupamento de faixas densas, legenda e "Ver os registros diários em tabela"; "Antes e depois de cada troca" (botões de par, antes/depois, veredito e frase); a seção Thumbnails, Títulos (com diff por palavra) e Descrições; filtro de período 7/30/90/tudo. As regras 7 dias depois contra até 7 antes, R115 (outra troca em 7 dias), R116 e R121 (trocas em sequência) são as do motor aprovado.

## O que é novo

1. **Chegada pela troca.** Com `troca=` na URL a troca fica selecionada em "Antes e depois" (com a linha "Aberta pela aba Trocas do canal: …"), marcada no gráfico (faixa/linha), nas faixas (marcador com anel) e o **foco vai para o marcador dela**; o status lê "Aberta a troca: …". Voltar (botão do navegador ou item do canal na trilha) cai no botão da troca, na mesma rolagem (medido: 300 px antes e depois, foco em `#sw-<ms>`). Anterior/Próximo substituem o histórico e levam o foco para o botão, `[` e `]` só no título ou no pager.
2. **Pedir leitura à forja.** O botão do cabeçalho rola até a seção Leitura e dispara o pedido (fila → escrevendo → pronta, simulado; a barra do mockup e o cartão dizem que é simulação). Se já existe uma situação, só rola e põe o foco nela. O cartão é o de `forja.js` com as situações da §7.2.
3. **Janela padrão de 30 dias** no gráfico (decisão do dono), seletor 7/30/90/tudo sempre visível (na produção só aparece com muitos dados).
4. **Eixo comprimido "antes de 03/10, sem registro".** A contagem diária só existe desde 03/10. O trecho anterior vira uma faixa hachurada (34% da largura) com o texto, e o resto do eixo vai de 03/10 até agora. Os eventos antes de 03/10 continuam nas faixas, na escala comprimida.
5. **Aba Trocas** continua sendo o resumo, mas a ação diz para onde vai: "Abrir histórico do vídeo ›" (nome acessível "Abrir histórico do vídeo: <título>, troca de título de 05/10"), uma frase no topo explica a tela especializada e **cada linha antecipa o efeito em 7 dias com o mesmo motor da tela**: "aguardando: 1 de 7 dias coletados, leitura na terça, 13/10", "sem série: a contagem diária começa em 03/10…" ou "sem base: só há o primeiro registro diário…". Nenhum número é inventado.

## Decisões do dono desta rodada

1. **Capas, 5 por linha em 1440**: é o padrão desde a rodada 1 (medido de novo: 5 colunas, cartão de 224 px, 10 cartões inteiros na dobra).
2. **"Carregar mais"** em Capas e Lista. Entram primeiro os 50 acompanhados e o fixado antigo (51); o botão diz "Carregar mais 40" e, ao lado, "Faltam 82 vídeos antigos, sem contagem diária. 51 de 133 na tela." Cada clique traz 40 sob o divisor "Mais antigos, sem contagem diária (82)", com o aviso de que a contagem de views é antiga e de que não há views por dia. Medido: 51 → 91 → 131 → 133; o foco vai para o primeiro cartão novo, **a rolagem não se mexe** (2519 px antes e depois) e o botão some no fim, com o anúncio "2 vídeos antigos carregados. Não falta nenhum." O número carregado vai na URL (`?n=40`), então o Voltar do vídeo reabre a grade com os mesmos cartões. Com busca ou filtro que só casa vídeos antigos, uma frase diz quantos há e o botão aparece.
3. **Cabeçalho do canal**: os quatro números de sempre, sem mudança.
4. **Thumbnails continuam em Versões**: a seção Thumbnails da produção está inteira (cartões com período, no ar por, média de views/dia). Nada da tela de produção foi retirado.
5. **Texto da leitura sem efeito medido** abre com o que fazer: "O que fazer: esperar 7 dias depois da troca antes de tirar conclusão; a leitura da mais recente fica possível em 13/10." (a data é a do motor, a mesma do "Antes e depois"). Cada troca cita o **desempenho anterior** quando existe ("Antes da troca, o vídeo ganhava 3,0 views por dia (média de 2 dias de registro, até 05/10)") e diz "não há registro diário" quando não existe, sempre com "não prova causa". A leitura do canal diz também quantas trocas têm registro antes dela.

## Diferenças que restam entre o mockup e a tela de produção

| Diferença | Por quê |
|---|---|
| Moldura: o CMS estático (menu lateral e abas do YouTube) com só a trilha, sem o cabeçalho "Observatório de Competidores", abas de seção e barra de nicho | Spec §3: nas páginas de canal e vídeo a moldura mostra só a trilha |
| Pager vem da lista de origem (a grade ou a aba Trocas), não da lista de Mudanças | O dono pediu canal → vídeo; a produção de hoje pagina por Mudanças |
| Só a imagem atual da thumbnail existe; as anteriores são o quadro "imagem anterior não arquivada" (`.th.missing`, com a letra A na faixa) | O banco nunca arquivou as imagens anteriores. A produção mostra a imagem quando existe |
| Descrição: uma versão D1 sem texto ("texto da descrição não exportado") e a seção Descrições diz que não dá para saber se mudou | A descrição não foi exportada para o mockup. A raia D1 existe |
| "Antes e depois" nunca chega a um veredito com número (ganhou/perdeu/neutro): só aguardando, sem série e sem base | A série diária começa em 03/10 e a regra pede 7 dias depois. A comparação ajustada pela idade (faixa normal dos outros vídeos) **não é exercitada** com estes dados (`peers` vazio); o código dela está lá, igual ao aprovado |
| Título trocado tem janela de 6 h a 24 h ("entre 21/09 09h e 22/09 09h"), e a legenda diz "janela de 6 h a 24 h neste canal" | As janelas das trocas fabricadas da rodada 1; a produção sincroniza a cada 6 h |
| O registro diário vale às 12:00 de cada dia; o primeiro é o de 03/10 | O banco guarda só a data; 12:00 é a convenção do mockup aprovado |
| "Resumo por imagem" e a lista de comparação com filtros (7 trocas ou mais) existem no código mas **não aparecem**: nenhum vídeo do Leo Khev tem imagem que voltou nem 7 trocas | Dados reais: ≤ 2 trocas por vídeo. Não foram verificadas aqui |
| O filtro de período aparece sempre | A produção só mostra com mais de 30 dias de série ou grade recolhida. É pedido do dono (30 d por padrão) |
| Tema claro: as regras do mockup aprovado estão em `hist.css`, mas a moldura é só escura e não foi testada | Spec: telas em tema escuro |
| "Fixar vídeo" muda só em memória; "Sincronizar só este canal" só avisa | Mockup |
| Vídeo sem data de publicação usa a data real para a geometria, mas o cabeçalho diz "sem data de publicação" e o multiplicador diz "sem multiplicador: sem data de publicação" | A data real está em `casos` de `dados.js` |
| Vídeo sem views + leitura "pronta" cai em "Precisa de você" com a frase de "dado antigo" | O motivo certo seria "sem contagem de views" |
| O cartão da forja é o novo (§7.1/§7.2: selo, evidências, "Do site"), no lugar do texto fixo do mockup aprovado | Pedido desta e da rodada 2 |
| **Múltiplo**: a grade do canal passou a usar o mesmo número do histórico (mediana dos outros vídeos do mesmo formato e da mesma faixa de idade, ex. 2,1× para "Tailândia Barrou…"), em vez da mediana geral de antes (3,4×) | Para o mesmo vídeo não mostrar dois números. É a aproximação por faixa do mockup, não o motor de produção |

## Verificado no navegador × inferência

Verificado (Chrome, 1440, 768 e 390 px, servido por HTTP): a aba Trocas e o clique até a tela nova (foco no marcador da troca, seleção em Antes e depois, faixa e linha marcadas), o Voltar (rolagem e foco), "Carregar mais" (contagens, foco, rolagem, botão que some), o botão "Pedir leitura à forja" do cabeçalho com a simulação até "pronta", a leitura pronta/desatualizada/falhou nas duas páginas, as variações de dado ausente (sem registro diário, views nulas, fixado antigo, sem troca), ausência de erros de console e de rolagem horizontal da página em 1440, 768 e 390 px. Medido em 1440×900 (a barra do mockup ocupa 32 px): cabeçalho 137 px; gráfico 200 px e três faixas 148 px, terminando em 737 px (**cabem na dobra**); "Antes e depois" começa em 934 px, **abaixo da dobra** (a tela de produção é mais alta que o desenho da rodada 2). Alvos em 390 px: tudo ≥ 44 px, exceto os números de nota ¹ ² (em frase) e os links dentro de frase da aba Trocas.

Inferência, não verificada: leitor de tela e teclado completo nas faixas (a lógica de setas é a do aprovado, mantida), contraste dos tokens acrescentados, movimento reduzido, zoom de 200 a 400%, outros navegadores, o comportamento com `file://` (a URL guarda o estado no `#`, só testei por HTTP) e o tema claro. As capturas de 768 e 390 de Capas, Lista e Leitura do canal foram tiradas antes do ajuste final do múltiplo e do texto de abertura; os números dos cartões nelas diferem dos de `1440-capas.png` e `1440-lista.png`.

## Não feito

- Canal próprio no histórico; "Vídeo não encontrado" tem a frase mas não tem captura.
- "Leitura anterior" visível enquanto um novo pedido está na fila.
- O comparativo ajustado pela idade com número (faltam dados), o resumo por imagem e a lista filtrável de trocas com estes dados.
- Capturas de 768 e 390 das variações de dado ausente e das situações `trabalhando`, `retry`, `liberado`, `semmaquina`, `limite`, `travou`, `semevid` (existem por URL).
- Atualização automática real do cartão da forja: só a simulação do botão.

## Perguntas ao dono

1. **Eixo comprimido "antes de 03/10": 34% da largura é boa proporção?** Em 30 dias o gráfico fica 1/3 hachurado. Recomendo manter até a série passar de 14 dias e então reduzir a faixa.
2. **A grade do canal pode usar o múltiplo por faixa de idade (como o histórico), mesmo mudando os números da rodada 1?** Recomendo que sim: um número só por vídeo.
3. **"Carregar mais" de 40 em 40 ou de uma vez?** Recomendo 40: com 82 antigos são três cliques e a grade não passa de 133 cartões.
4. **O cartão da forja substitui o texto fixo da tela de produção?** Recomendo que sim, e que o botão "Pedir leitura à forja" do cabeçalho continue rolando até ele em vez de pedir às cegas.

## Capturas da rodada 3 (`shots/`)

| Arquivo | Mostra |
|---|---|
| `1440-aba-trocas.png`, `768-aba-trocas.png`, `390-aba-trocas.png` | A aba Trocas com a ação "Abrir histórico do vídeo" e o efeito em 7 dias por linha |
| `1440-video-chegada-pela-troca.png` | Chegada pela troca: gráfico, faixas e "Antes e depois" destacados, foco no marcador |
| `1440-video-historico-leitura-pronta.png` | A tela inteira com a leitura pronta dentro da seção |
| `768-video-chegada-leitura-pronta.png`, `390-video-chegada-leitura-pronta.png` | O mesmo, estreito |
| `1440-video-leitura-desatualizada.png` | Leitura pronta, porém desatualizada, dentro do histórico |
| `1440-video-sem-registro-diario-sem-troca.png` | Sem registro diário, sem troca, versão única, "Nenhuma troca registrada" |
| `1440-video-views-nulas-precisa-de-voce.png` | Views nulas e "Precisa de você" |
| `1440-video-fixado-antigo-leitura-falhou.png` | Fixado antigo e "Não deu" |
| `1440-carregar-mais.png` | Depois do primeiro "Carregar mais": divisor dos antigos, foco no primeiro cartão novo |
| `1440-capas.png`, `1440-lista.png`, `768-capas.png`, `768-lista.png`, `390-capas.png`, `390-lista.png`, `1440-fixados-com-atraso.png` | A grade e a lista com o botão "Carregar mais" e o múltiplo novo |
| `1440-aba-leitura-*.png`, `768-aba-leitura-pronta.png`, `390-aba-leitura-pronta.png` | A aba Leitura do canal (rodada 2, atualizada na pronta e na desatualizada) |

---

# Rodada 4: um botão por vídeo nas Trocas, visualizador de thumbnail e "Carregar mais" que se vê

## 1. Aba Trocas: um botão por vídeo

Antes: o grupo "Mesmo vídeo: 2 trocas" tinha um botão "Abrir histórico do vídeo" em cada troca, os dois para o mesmo lugar, e o mesmo vídeo podia aparecer em dois cartões separados (trocas não vizinhas), cada um com o seu botão.

Agora:
- **Um cartão por vídeo**, mesmo quando as trocas não são vizinhas. Os cartões saem na ordem da troca mais recente de cada vídeo; dentro do cartão, as trocas ficam da mais recente para a mais antiga com a data de cada uma. Medido: 7 trocas viram 5 cartões e 5 botões (Lr0p4pTWuVk, que tinha dois cartões, virou um).
- **O botão fica no cartão, ao lado do título**: "Abrir histórico do vídeo". Com 2 ou mais trocas ele abre o histórico **do vídeo todo, sem troca escolhida** (foco no título, "Antes e depois" no padrão da tela). Com uma troca só, o botão abre já nela.
- **Cada troca de um cartão com 2 ou mais trocas** tem o seu link de texto, **"Abrir nesta troca ›"** (sublinhado, sem forma de botão), que chega ao histórico com **aquela** troca destacada, como na rodada 3. A frase sob o título diz: "O botão abre o histórico do vídeo todo. Cada troca abaixo tem o seu link e abre o histórico já nela." A linha inteira da troca continua clicável com o mouse.
- **Por que assim e não um destino só.** Um destino só (sempre a troca mais recente) perderia o caminho "quero ver a troca de 22/09" e deixaria a troca antiga sem como chegar nela; e dois botões iguais não dizem a diferença. O botão (forma de botão, uma vez) é o vídeo; o link de texto (uma vez por troca) é a troca. Em cartão com uma troca só não há link de troca: seria repetir o botão.
- **Voltar:** do botão do cartão, o foco volta para o botão do vídeo (`#sg-<id>`); do link de uma troca, para o link dela (`#sw-<ms>`). Verificado com rolagem de 300 px.
- O pager do histórico continua andando pelos vídeos com trocas ("vídeo 3 de 5").

## 2. Visualizador de thumbnail

Diálogo modal (`viewer.js` + `viewer.css`): `role="dialog"`, `aria-modal`, o fundo fica `inert`, foco preso (Tab e Shift+Tab giram), Esc fecha, o foco volta ao gatilho. Abre com o foco no título do diálogo.

- **Resolução:** pede `maxresdefault` (1280×720), cai para `sddefault` (640×480), `hqdefault` (480×360) e `mqdefault` (320×180), e escreve a que carregou com o tamanho medido: "Exibindo maxresdefault.jpg, 1280×720 px (maior resolução disponível; …). Acima de 100% a imagem é aumentada: ganha tamanho, não detalhe." Quando cai para uma menor, diz "o YouTube não tem versão maior deste vídeo". Medido no Leo Khev: os vídeos testados têm `maxresdefault`.
- **Zoom:** botões − e +, roda do mouse (em torno do cursor), pinça, arrastar para mover (clique duplo alterna "Ajustar" e 100%), "Ajustar", "100%" (um pixel da imagem por pixel CSS) e teclas `+`, `-`, `0` e `1`; com o foco na imagem, as setas movem (com zoom) ou trocam de versão (sem zoom).
- **Abrir original em nova aba** (a resolução que está na tela) e **Baixar**: baixa por `fetch`; se o navegador recusar (CORS), abre a imagem em outra aba e diz, na região viva, para salvar por lá.
- **Versões:** com mais de uma versão de thumbnail, Anterior/Próxima ("Capa B · 2 de 2"), legenda de cada uma ("Capa B (no ar): 05/10 14:22 até agora; no ar por 2 d 7 h") e **"Comparar lado a lado"** com um seletor "Comparar com". No modo comparar não há zoom (os botões ficam apagados, o contador diz "sem zoom").
- **Versão não arquivada:** sem imagem quebrada. Um quadro tracejado explica: "A coleta só guarda a thumbnail a partir do momento em que a vê. Esta versão (23/01 17:00 (publicação) até 05/10 14:22) saiu do ar antes disso, então não há imagem para mostrar nem para baixar.", e Baixar/Abrir original ficam apagados.
- **Gatilhos:** a capa do cabeçalho do histórico, as thumbnails de "Antes e depois" e dos cartões da seção Thumbnails (cada uma com o ícone de lupa no canto e `role="button"`), os cartões da aba Trocas (botão de lupa sobre a imagem) e a grade do canal (botão discreto de lupa no canto da imagem, **sempre visível**, 28 px, 44 px com toque). Na grade e na Lista há também o item **"Ampliar thumbnail"** no menu "Ações do vídeo".
- **Decisões a revisar:**
  - **Raia Thumbnail do histórico:** o clique simples continua levando ao cartão da versão (comportamento da produção, "nada se perde"); **o clique duplo** abre o visualizador, e a legenda do gráfico diz isso. Para quem usa teclado, a imagem está um Tab depois, no cartão da versão. Se o dono preferir que o clique simples amplie, o caminho até o cartão passa a ser o item da lista abaixo.
  - **Botão de lupa na grade com `tabindex="-1"`:** o spec (§11, linha 5) limita a 2 paradas de Tab por cartão; o teclado usa o item do menu. Na aba Trocas o botão de lupa **é** uma parada (3 por cartão, pois ali o limite não vale).

### Que resolução o arquivamento guarda hoje (lido em `apps/web/src/lib/youtube/thumb-fingerprint.ts`)

**Só `hqdefault`: 480×360, JPEG.** `VARIANT = 'hqdefault'` define a URL que `probeThumb` baixa e `archiveThumb` grava em `observatorio/thumbs/<video>/<dhash>.jpg`. É 4:3 com as barras pretas do próprio YouTube, não os 1280×720 do `maxresdefault`. **Limitação a dizer ao dono:** a thumbnail **atual** pode ser ampliada em 1280×720 (o visualizador busca ao vivo no YouTube), mas as **versões anteriores** arquivadas só existem em 480×360 e não ganham qualidade ao ampliar. Para guardar as futuras em alta, basta trocar `VARIANT` para `maxresdefault` com queda para `sddefault`/`hqdefault` (vale para versões novas; as já arquivadas ficam como estão). `competitor-sync.ts` lê `maxres` da API só para o campo `thumbnail_url`, não para o arquivo. No mockup nenhuma versão anterior existe, então o visualizador mostra "não arquivada"; em produção, uma versão arquivada mostraria a imagem em 480×360 e a linha de resolução diria isso.

## 3. "Carregar mais"

Antes: um botão pequeno, à esquerda, no fim da grade, com o texto ao lado. O dono custou a achar.

Agora (`.more`): **bloco centralizado no fim da grade ou da Lista**, com borda e fundo, que tem:
- linha de progresso (`role="progressbar"`, 51 de 133) em laranja;
- **"Mostrando 51 de 133 vídeos"** em destaque;
- o que vem: **"Mais 40 vídeos antigos, sem contagem diária. Depois deste lote faltam 42."** (no último lote: "…Depois deste lote não falta nenhum.");
- um **botão cheio**, o único da tela, de 44 px: **"Carregar mais 40 vídeos"** (no fim: "Carregar os últimos 2 vídeos" / "Carregar o último vídeo").
Medido a 390 px: botão de 216 × 44 px, bloco sem rolagem horizontal.

**Só botão, sem carregar sozinho ao chegar perto do fim.** Justificativa: (a) o dono pediu foco e rolagem estáveis; carregar por observador de rolagem empurra o conteúdo abaixo do cursor enquanto a pessoa lê e tira o rodapé (a nota do múltiplo) do alcance, sem fim de página; (b) o teclado e o leitor de tela precisam do botão de qualquer jeito, então o botão não some; (c) os 82 vídeos que faltam são os de menos valor (sem contagem diária), carregá-los é uma escolha; (d) o Voltar do histórico precisa reabrir a grade com os mesmos cartões, e isso fica determinístico com `?n=40` na URL (carregamento por rolagem teria de gravar o mesmo estado, o que é possível, mas não muda a conclusão). Se o dono quiser o automático depois, a mudança é pequena: um `IntersectionObserver` sobre o bloco, mantendo o botão.

Foco e rolagem: o foco vai para o primeiro cartão novo com `preventScroll`; medido 2519 px antes e depois do clique. O anúncio agora diz **"Mostrando 91 de 133 vídeos. 40 vídeos antigos carregados."** (ou "Não falta nenhum.").

## Capturas da rodada 4 (`shots/`)

| Arquivo | Mostra |
|---|---|
| `1440-aba-trocas.png`, `768-aba-trocas.png`, `390-aba-trocas.png` | Um botão por vídeo; "Abrir nesta troca" nos cartões com 2 trocas; lupa sobre a imagem |
| `1440-visualizador-aberto.png`, `768-visualizador-aberto.png`, `390-visualizador-aberto.png` | O visualizador com a imagem em maxresdefault e a linha de resolução |
| `1440-visualizador-zoom-100.png` | Zoom em 100%, imagem movida |
| `1440-visualizador-comparando.png` | Comparar lado a lado: Capa B (arquivo) e Capa A (não arquivada) |
| `1440-visualizador-versao-nao-arquivada.png` | A Capa A sozinha, com a explicação |
| `1440-carregar-mais.png`, `768-carregar-mais.png`, `390-carregar-mais.png` | O novo bloco "Carregar mais" |
| `1440-capas.png`, `768-capas.png`, `390-capas.png`, `768-lista.png`, `390-lista.png`, `1440-lista.png` | A grade e a Lista com a lupa e o múltiplo atual (refeitas) |
| `768-aba-leitura-pronta.png`, `390-aba-leitura-pronta.png`, `768-video-chegada-leitura-pronta.png`, `390-video-chegada-leitura-pronta.png`, `1440-video-chegada-pela-troca.png`, `1440-video-historico-leitura-pronta.png` | Refeitas com os números atuais |

## Verificado × inferência

Verificado no navegador (1440, 768 e 390 px, por HTTP): um botão por vídeo (5 cartões, 5 botões, 4 links de troca) e os dois caminhos de chegada e de volta; o visualizador (abrir pela capa, `maxresdefault` 1280×720, 100%, +, arrastar, Ajustar, Anterior com versão não arquivada, Comparar, Esc devolve o foco ao gatilho, o fundo fica `inert`), o gatilho da grade e o item de menu, "Carregar mais" (51 → 91 → 131 → 133, foco, rolagem, botão que some), sem rolagem horizontal e sem erros de console; botões do visualizador em 390 px todos com 44 px ou mais.

Inferência, não verificado: roda e pinça (o código usa eventos de ponteiro; só simulei o arrastar), Baixar e a queda para `sddefault`/`hqdefault` (os vídeos testados têm `maxresdefault`; sem rede o diálogo mostra "A imagem não carregou"), o clique duplo na raia, leitor de tela, contraste do ícone de lupa sobre as imagens, zoom do navegador de 200 a 400%, `file://` e outros navegadores. O Baixar depende de o `i.ytimg.com` aceitar CORS; se não aceitar, cai para a nova aba.

## Perguntas ao dono

1. **O clique simples na raia Thumbnail deve ampliar em vez de ir ao cartão da versão?** Recomendo manter o clique duplo: o cartão é o comportamento de hoje e a raia é pequena; quem quer ampliar tem a capa do cabeçalho e os cartões.
2. **Guardar as próximas thumbnails arquivadas em maxresdefault?** Recomendo que sim, com queda para `sddefault`; custa mais armazenamento (cerca de 4× por imagem), mas é o que o visualizador de versões antigas promete.
3. **"Carregar mais" automático ao chegar perto do fim?** Recomendo só o botão, pelas razões acima, e rever quando os antigos virarem mais úteis.

---

# Rodada 5 (09/10/2026): faixa de números, pedido à forja com andamento, canal próprio

## Respostas do dono que motivaram a rodada

a. O cartão novo da leitura da forja entra na fase A.
b. No Histórico, sem abas de seção e sem barra de nicho. Conferido: `video.html` só tem a trilha; nenhuma aba de seção nem barra de nicho sobrou (as regras `.vbar` em `hist.css` são CSS morto da rodada 2, sem HTML que as use).
c. O botão "Pedir leitura à forja" do cabeçalho rola até o cartão **e já pede**, e a tela mostra o andamento.
d. O painel lateral de Canais **sai para concorrente**: linha e cartão de Canais levam à página do canal. Neste mockup não há painel. Para o canal próprio, ver a proposta abaixo.
e. Cabeçalho do canal com a maior riqueza possível.

## O que mudou em cada tela

**`canal.html` (concorrente).** A linha de números em frase virou a **faixa de números**: 6 células sem cartão, fio vertical entre elas, valor em JetBrains Mono em cima e rótulo em Inter 12 px embaixo, alinhadas ao nome do canal. "Todos os números" (botão com `aria-expanded`, estado na URL: `?nums=1`) abre mais 13 células **abaixo** da linha de sincronização, empurrando a grade, sem modal. O ⓘ único lista a base de cada número (e a dos 13, quando abertos). A linha de sincronização perdeu os pontos médios e virou frase. Inscritos saiu da linha do nome e é a primeira célula.

**`video.html` (Histórico).** Botão do cabeçalho: "Pedir leitura à forja" → "Pedindo…" (`aria-busy`, ponto que pulsa) → a página rola, o foco vai para o título do cartão ("Leitura da forja, em andamento") → "Leitura em andamento: ver" (contorno teal, só rola) → "Ver a leitura" (só rola). No limite do dia: "Ver a leitura" com a frase "Já houve uma leitura deste vídeo hoje. Libera amanhã às 00:00." e, no cartão, o botão apagado com a mesma frase. Depois de "Não deu": "Pedir leitura à forja de novo".

**Cartão da forja (`forja.js`, nas duas páginas).** Com pedido em andamento ele mostra as **etapas**, na ordem: Na fila, Escrevendo, Conferindo os números, Pronta. A etapa atual tem o ponto que pulsa e as palavras "em andamento"; as concluídas têm o visto; "com atraso" e "forja desligada" marcam a etapa Na fila em âmbar ("em andamento, com atraso"); "Não deu" marca em vermelho a etapa em que parou ("parou aqui": Conferindo para números que não batem e para leitura sem evidências, Escrevendo para o pedido que travou). Embaixo, a frase da §7.2 e a linha "Pedido feito há 16 min, às 21:59. Tela atualizada há 1 min. Pode sair desta página: o pedido continua.", com "Cancelar pedido" enquanto está na fila. Em andamento não há botão de pedir. Movimento: só o ponto da etapa atual; com `prefers-reduced-motion` ele para. A barra "Estados do mockup" percorre o pedido inteiro: Nunca pedida, Na fila, Escrevendo, Conferindo os números, Pronta, Com atraso, Forja desligada, Não deu (as demais ficam em "Variantes"). O clique real percorre fila (2,2 s), escrevendo (2,6 s), conferindo (2,2 s) e pronta.

**`canal-proprio.html` (novo, proposta).** Ver a seção própria abaixo.

## Números do cabeçalho: origem de cada um

Arquivos de produção lidos: `apps/web/src/lib/youtube/observatorio/channels.ts` (`cadence` 71–93, `channelStats` 131–158), `rules.ts`, `insights.ts`, `outliers.ts`, e `_canais/view-model.ts` (`drawerOf`, 425–460) e `_canais/channel-table.tsx` (colunas, 15–20).

| Número na tela | Onde | De onde vem | Situação |
|---|---|---|---|
| inscritos | faixa | `view-model.ts` (`subsText`); arredondamento em `channels.ts:96-109` | já existe em produção |
| inscritos em 30 dias (% e "≈ 0" dentro do arredondamento) | faixa | `channels.ts:136-139,150`; painel em `view-model.ts:454-455` | já existe |
| longos + Shorts por semana (13 semanas) | faixa | `channels.ts:77` (`cadence.pw`); painel `view-model.ts:449`; tabela `channel-table.tsx:16` | já existe |
| views/dia nos longos (mediana) | faixa | `channels.ts:134,145`; painel `view-model.ts:451`; tabela `:17` | já existe |
| engajamento nos longos | faixa | `channels.ts:116-120,154`; painel `view-model.ts:457` | já existe |
| acima de 2× em 90 dias | faixa | `channels.ts:148` (`outliers90`); tabela `channel-table.tsx:18` | já existe (no mockup soma longos e Shorts; em produção é por formato) |
| trocas em 30 dias | todos | `channels.ts:149` (`changes30`); tabela `:19` | já existe |
| views/dia por mil inscritos | todos | `channels.ts:146` (`perMilSubs`) | já existe |
| views/dia nos Shorts | todos | `channelStats(id, 'short')`, `channels.ts:134,145` | já existe |
| engajamento nos Shorts | todos | `channelStats(id, 'short')`, `channels.ts:154` | já existe |
| múltiplo típico em 90 dias | todos | `channels.ts:147` (`typicalMult`) | já existe no motor, sem tela hoje |
| maior múltiplo em 90 dias | todos | `channels.ts:148,151` (`bestOutlier`, `maxMultBelowMin`) | já existe |
| % dos vídeos de 90 dias acima de 2× | todos | `channels.ts:152` (`pctOutliers`) | já existe no motor, sem tela hoje |
| desde o último vídeo | todos | `channels.ts:89` (`lastUpload`); "Parado" em `view-model.ts:450` | já existe |
| dia e hora em que mais publica | todos | `channels.ts:78-85` com `RULES.habit` (`rules.ts:12`) | já existe |
| duração mediana dos longos | todos | `duration_seconds` dos vídeos carregados | derivável, novo |
| views somadas dos acompanhados | todos | `view_count` dos vídeos carregados | derivável, novo |
| mediana de views, longos e Shorts | todos | base do múltiplo geral do mockup (`dados.js`) | derivável, novo |
| tema dominante | todos | regra `RULES.theme` (`rules.ts:8`); hoje só por nicho (`insights.ts:243-249`) | derivável, novo; sem dado: "sem tema ainda" |
| sincronização e vídeos acompanhados | linha de frase | `channels.ts:155-156`; `view-model.ts:435` | já existe |

Existe em produção e **não entrou**: `vpd7Median` (`channels.ts:153`, `outliers.ts:15`), porque com a série de 5 dias do mockup é o mesmo número de views/dia.

Base fraca: quando a mediana tem menos de 3 vídeos (`RULES.weakBase`), o valor aparece com "n = 2" ao lado, como a produção faz. Sem base nenhuma, a célula mostra a frase ("nenhum longo em 90 dias", "horário variado (2 longos)", "sem tema ainda"), nunca zero nem traço. Os zeros que aparecem são medidos (0 vídeos acima de 2× entre 2; 0 views/dia na mediana de 16 Shorts).

Valores do Leo Khev que valem um olhar: engajamento 15,7% vem de 2 longos; "trocas em 30 dias: 7" é fabricado (rodada 1).

## Medidas (Chrome, 1440×900, servido por HTTP)

| Medida | Concorrente | Canal próprio |
|---|---|---|
| Topo da grade, da tela simulada, faixa recolhida | **319 px** (meta ≤ 320; era 297) | 317 px |
| Cabeçalho recolhido | 101 px (era 79) | 99 px |
| Cabeçalho com "Todos os números" | 247 px (grade em 465 px) | 201 px (grade em 419 px) |
| Cartões inteiros na dobra, recolhido | 10 | 5 (o cartão próprio tem a terceira linha) |
| Mesma medida em 1280 px | grade em 319 px | 317 px |
| 1024 px | 338 px (a frase de sincronização quebra) | 317 px |

Sem rolagem horizontal da página em 1440, 1280, 1024, 768, 390 e 320 px nas três telas, com a faixa recolhida e aberta (largura de rolagem = largura da janela). Sem erros de console.

**768 e 390 px: a faixa quebra, não rola.** Três colunas iguais em 768 (6 números em 2 linhas cheias) e duas em 390 e 320. Escolhi quebrar porque a rolagem lateral esconde números sem avisar e o pedido é riqueza; o custo é altura (em 390 a grade começa em 784 px).

## Canal próprio: o que decidi e por quê

Arquivo: `canal-proprio.html` + `dados-proprio.js` (os dados reais, gerados do JSON), reaproveitando `canal.js` e `canal.css` inteiros (uma variável `OWN`). Escolhi página separada porque o que muda é o arquivo de dados; o resto é o mesmo código.

- **Cabeçalho:** selo "seu canal" no lugar do nicho; faixa com inscritos, vídeos, views somadas, impressões de 09/09 a 07/10, dias com impressão e dias desde o último vídeo. "Todos os números": cliques estimados, vídeos com alguma impressão, mediana de views, vídeo mais visto, engajamento em 90 dias e de todos os vídeos, duração mediana, ritmo ("parado: nenhum em 13 semanas"), views/dia ("a coleta começa em breve"), retenção ("ainda não coletada (lote L3)").
- **Inscritos aparece como "não exportado":** a contagem não veio no arquivo de dados, e tentei ler do banco e a leitura foi recusada pelo ambiente. Não inventei.
- **"impressões de 09/09 a 07/10", não "28 dias":** é o período real das linhas. São 140 impressões e 3 cliques estimados; 19 relatórios lidos (11 com impressão, 8 vazios) e 12 por baixar.
- **Cartão:** views, impressões e múltiplo. A terceira linha diz o que as impressões permitem dizer daquele vídeo: "2 cliques em 6 dias", "nenhum clique em 4 dias", "poucas impressões para dizer algo" (menos de 10) ou "sem impressão no período". Nunca um percentual.
- **Diferença do brief:** a frase "views por dia: a coleta começa em breve" **não** se repete nos 35 cartões. Fica uma vez na linha das abas ("Views por dia e retenção ainda não são medidas no seu canal."), na nota sob a grade e em "Ações do vídeo". Repetida em cada cartão ela competiria com as capas sem dizer nada novo.
- **Ordenação:** "Mais impressões no período" entra no lugar de "Mais views por dia", que não teria o que ordenar. Filtro sem "Fixados".
- **Lista:** colunas Impressões e Cliques no lugar de Views/dia e Trocas.
- **Abas:** Vídeos, Trocas ("Trocas dos seus vídeos ainda não são lidas nesta tela."), Leitura ("A leitura da forja para o seu canal ainda não foi desenhada.") e Retenção ("Retenção ainda não coletada: chega com o lote L3.").
- **Múltiplo:** contra os outros vídeos do próprio canal na mesma faixa de idade (todos têm mais de 365 dias, n = 34).
- O limite de 10 impressões para falar de cliques é proposta minha, não regra de produção.

## Decisões minhas nesta rodada (reverta o que não servir)

1. **Seis números na faixa, não sete.** "Trocas em 30 dias" foi para "Todos os números": o número já está no rótulo da aba Trocas, logo abaixo, e com sete a faixa quebraria em 1280 px.
2. **ⓘ e "Todos os números" ficam na linha da sincronização, à direita**, não no fim da faixa. Na faixa eles tiravam largura e os rótulos quebravam em duas linhas (a grade passava de 320 px). O painel abre abaixo dessa linha, então o botão não sai de baixo do cursor.
3. **A etapa "Conferindo os números" não existe na §7.2 do spec.** A frase "Aguardando: a forja está conferindo os números do texto contra os dados desde 22:14. Leva poucos minutos." é minha. Não achei `lib/forja/states.ts` no caminho que o spec cita, então não confirmei se o código tem esse estado.
4. **Sem etapas quando a leitura está pronta:** a frase "Pronta: leitura publicada às 20:18." e a própria leitura bastam.
5. O selo "forja · Gemma 12B · em treino · gerada…" manteve os pontos médios: é o formato da §7.1 e não reescrevi esse texto.

## O que NÃO foi feito

- Histórico de um vídeo do canal próprio: o clique no cartão só avisa.
- Leitura da forja para o canal próprio (só o estado vazio).
- "Leitura anterior" visível enquanto um novo pedido anda.
- Contraste dos elementos novos não foi calculado (usam só tokens já medidos na rodada 1: `--muted`, `--text`, `--forja`, `--warning-text`, `--danger`, `--accent`).
- Não conferido: leitor de tela, teclado completo, `prefers-reduced-motion` de verdade (a regra está no CSS), zoom de 200 a 400%, `file://`, outros navegadores.
- Capturas em 768 e 390 só de Capas (concorrente e próprio), "Todos os números" (768) e do Histórico com a leitura sendo escrita.
- O servidor do mockup não ficou no ar.

## Perguntas ao dono

1. **Canal próprio na lista de Canais, junto dos concorrentes, ou num lugar próprio?** Recomendo junto, no topo, com o selo "seu canal".
2. **Quer o canal próprio lado a lado com um concorrente?** Recomendo depois: hoje só inscritos, views e ritmo seriam comparáveis.
3. **A frase "views por dia: a coleta começa em breve" em cada cartão ou uma vez só?** Fiz uma vez só.
4. **Menos de 10 impressões = "poucas impressões para dizer algo". O corte serve?**
5. **A forja deve ler o canal próprio, com impressões?** Hoje ela só recebe dado público de concorrente.
6. **"Conferindo os números" pode ser uma etapa visível?** Se o código não distingue esse estado, o cartão fica com três etapas.
7. **"Trocas em 30 dias" fora da faixa principal está bom?**

## Como chegar (servidor estático nesta pasta, porta 8791)

| Tela | URL |
|---|---|
| Canal, faixa recolhida | `canal.html` |
| Canal, todos os números | `canal.html?nums=1` |
| Canal próprio | `canal-proprio.html` (`?nums=1`, `?sort=imp`, `?ver=lista`, `?tab=trocas`, `?tab=leitura`, `?tab=retencao`) |
| Histórico, pedir de verdade | `video.html?id=7Cr3DLfUvW8` e clicar em "Pedir leitura à forja" |
| Histórico, cada etapa | `video.html?id=7Cr3DLfUvW8&leitura=fila` (`trabalhando`, `conferindo`, `pronta`, `atraso`, `semmaquina`, `falhou`, `travou`, `semevid`, `retry`, `liberado`, `limite`) |
| Leitura do canal, em andamento | `canal.html?tab=leitura&leitura=conferindo` |

## Capturas da rodada 5 (`shots/`)

| Arquivo | Mostra |
|---|---|
| `r5-1440-canal-capas.png`, `r5-768-canal-capas.png`, `r5-390-canal-capas.png` | A faixa de números recolhida e a grade |
| `r5-1440-canal-todos-os-numeros.png`, `r5-768-canal-todos-os-numeros.png` | "Todos os números" aberto |
| `r5-1440-canal-base-dos-numeros.png` | O ⓘ com a base de cada número |
| `r5-1440-proprio-capas.png`, `r5-768-proprio-capas.png`, `r5-390-proprio-capas.png` | O canal próprio |
| `r5-1440-proprio-todos-os-numeros-mais-impressoes.png` | Canal próprio, todos os números, ordenado por impressões (tirada antes de dois ajustes de texto: a terceira linha do cartão e "parado: nenhum em 13 semanas" hoje são mais curtos) |
| `r5-1440-proprio-lista.png`, `r5-1440-proprio-aba-retencao.png` | Lista e aba Retenção do canal próprio |
| `r5-1440-video-cabecalho-leitura-em-andamento.png` | O botão do cabeçalho com pedido em andamento |
| `r5-1440-video-leitura-na-fila.png`, `-escrevendo.png`, `-conferindo.png`, `-pronta.png` | As etapas do pedido |
| `r5-1440-video-leitura-com-atraso.png`, `-forja-desligada.png`, `-nao-deu.png` | Atenção e fim |
| `r5-768-video-leitura-escrevendo.png`, `r5-390-video-leitura-escrevendo.png` | A página inteira, estreita (etapas em coluna a 390) |

---

# Rodada 6 (09/10/2026): canal próprio na lista, posição, lado a lado, 3 ou 4 etapas, cliques

## Respostas do dono que motivaram a rodada

1. Canal próprio em lugar próprio, **mas indicado nas listas**, na posição dele, para comparar desempenho; "você está na posição X deste filtro".
2. Três ou quatro etapas no pedido à forja: quer ver as duas.
3. "Trocas em 30 dias" fora da faixa principal: fica.
4. Corte de 10 impressões para falar de cliques: quer exemplos e argumentos.
5. Lado a lado com um concorrente: sim.

O controlador já tinha trocado "inscritos: não exportado" por **1,16 mil** (1.160, lido em 09/10); mantido.

## O que mudou

**A. `canais.html` (novo) + `canais.js`, `canais.css`, `canais-dados.js`.** A tabela de Canais com os 13 concorrentes reais e o canal próprio **na posição dele**. Colunas ordenáveis: inscritos, views/dia nos longos, views/dia por mil inscritos (padrão), mediana de views dos longos, longos em 90 dias, longos acompanhados. A linha do canal próprio leva o selo "seu canal" e um fio laranja à esquerda, sem fundo; o nome é link para `canal-proprio.html`. Quando a linha está fora da parte visível aparece a **linha presa no pé**: "seu canal · 14º de 14 em inscritos, com 1,16 mil." e "Ir até a linha" (rola e põe o foco na linha; a linha presa some quando a linha real está na tela). Quando a coluna não é medida para o canal próprio (views/dia e views/dia por mil), ele vai para o fim sob o divisor **"Ainda sem medida para ordenar (2)"**, sem posição, e a linha presa diz "Ainda não tem views por dia medidas; a coleta diária começa em breve. Está no fim da lista, sem posição." (o segundo sem medida é real: Sonhe Alto Viagens aguarda o 2º registro diário). Acima da tabela: "Seu canal aparece na lista para comparação. Ele tem página própria." `?n=70` estende a lista com 57 canais de enchimento em linhas esmaecidas ("canais 14 a 18 (enchimento do mockup, sem dados)"), e a linha presa avisa "Posição de exemplo".

Diferença para a produção: hoje os canais próprios ficam **sempre no topo**, num grupo à parte (`view-model.ts`, "os seus canais ficam sempre no topo"). O pedido do dono troca isso por posição na ordenação. A tela do mockup é só a tabela: sem abas de seção, barra de nicho, "Adicionar canal" e as colunas Ritmo, Outliers, Trocas e Sincronização. Só Leo Khev e o canal próprio têm página no mockup; os outros nomes não são links.

**B. Posição no canal próprio.** Uma linha própria sob a faixa de números: "Entre 14 canais de Viagem: 14º em inscritos, 14º em mediana de views, 13º em longos em 90 dias (nenhum). Views/dia por mil inscritos: ainda não medido." Cada trecho é link para `canais.html` já ordenado por aquela coluna. Fica em linha própria, e não dentro de "Todos os números", porque é a resposta ao pedido do dono ("mostrar que ele se encontra ali") e escondida atrás de um clique não cumpriria isso.

**C. Lado a lado.** "Comparar com…" (select com os 13; o primeiro é o canal logo acima em mediana de views, Leo Khev) fica na linha da sincronização. Abre na mesma página a tabela "Seu canal | concorrente" com inscritos, longos acompanhados, longos em 90 dias, mediana de views, views/dia nos longos, views/dia por mil inscritos e dias desde o último vídeo. Onde falta: "ainda não medido" (seu canal) ou "não veio na exportação deste mockup" (dias desde o último vídeo do concorrente). Sem gráfico e sem cor de vencedor. Estado em `?comparar=<id>`; "Fechar comparação" devolve o foco ao select.

**D. Três ou quatro etapas.** `?etapas=3|4` e a linha "Etapas do pedido" na barra do mockup de `video.html`. Com 3, "Conferindo os números" vira detalhe de "Escrevendo" ("em andamento: conferindo os números"; em falha, "parou aqui, ao conferir os números"). A frase de status não muda.

**E. Cliques.** `?cliques=corte|sempre` e a linha "Cliques com poucas impressões" na barra do mockup de `canal-proprio.html`. Em "sempre", todo cartão com impressão mostra a contagem ("nenhum clique em 4 dias"); o número de impressões já está na linha de cima do cartão, então não se repete na frase.

**F. Limpeza.** Saiu "0% dos vídeos de 90 dias acima de 2×" de "Todos os números" do concorrente (agora 12 células); a base ("0 de 2") está no ⓘ da contagem.

Também: a trilha "Canais" de `canal.html`, `canal-proprio.html` e `video.html` agora abre `canais.html`.

## Posições do canal próprio (calculadas de `canais-dados.js`, 14 canais)

| Coluna | Seu canal | Posição |
|---|---|---|
| Inscritos | 1.160 | 14º de 14 (o 13º é Leo Khev, 1.530) |
| Mediana de views dos longos | 135 | 14º de 14 (o 13º é Leo Khev, 493) |
| Longos em 90 dias | 0 | 13º de 14, empate com Esq Unltd Daily (0) |
| Longos acompanhados | 35 | 10º de 14 |
| Views/dia nos longos, views/dia por mil inscritos | sem medida | sem posição (13 concorrentes: 12 medidos, 1 aguardando) |

A mediana de views do canal próprio é **135**, calculada das 35 contagens de `canal-proprio-dados-reais.json`; a nota do arquivo dos concorrentes dizia 104 e pedia conferência. Outra diferença de fonte: nesta leitura (09/10) o Leo Khev tem views/dia 0,2, mediana 493 e 34 longos acompanhados; a página dele no mockup usa a exportação de 07/10 (0,3, 507, 32 com contagem diária).

## D. Três ou quatro etapas: o que o código tem

`apps/web/src/lib/youtube/observatorio/forja/states.ts:33` lista os estados: 'na fila', 'trabalhando', 'publicado', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia', 'falhou', 'recusado (dado velho)'. A linha `running` do banco vira 'trabalhando' (`states.ts:89`). **Não existe estado de "conferindo".** A conferência do texto contra os números acontece dentro de 'trabalhando'; o site só fica sabendo dela pelo resultado ('nova tentativa' ou 'falhou' com motivo de validador, `states.ts:177-186`).

| | A favor |
|---|---|
| **4 etapas** | Explica por que demora depois de o texto estar escrito. Dá lugar exato ao "Não deu" mais comum (números que não batem). Reforça que a leitura foi conferida. |
| **3 etapas** | É o que o site consegue saber hoje: com 4, a tela nunca acenderia "Conferindo" de verdade, ou acenderia por palpite. Não exige mudança na forja nem no banco. Menos uma coisa para explicar; a conferência continua dita na frase quando falha. |

**Recomendo 3.** Uma etapa que a tela não consegue observar é uma etapa inventada. Se um dia a forja passar a reportar a conferência, a quarta etapa entra sem redesenho.

## E. Cliques com poucas impressões: o que cada volume permite afirmar

Exemplos reais do canal (09/09 a 07/10), com o intervalo de Wilson de 95% para a taxa de clique:

| Vídeo | Impressões | Cliques | Taxa | Intervalo de 95% |
|---|---|---|---|---|
| O Que Esperar Do MBK Center… | 18 | 2 | 11,1% | 3,1% a 32,8% |
| Sukhumvit Road… | 17 | 1 | 5,9% | 1,0% a 27,0% |
| 10 - Quem você está copiando | 11 | 0 | 0% | 0% a 25,9% |
| 8 - 9 dicas para debates | 10 | 0 | 0% | 0% a 27,8% |
| quatro vídeos com 8 | 8 | 0 | 0% | 0% a 32,4% |
| dois vídeos com 5 | 5 | 0 | 0% | 0% a 43,4% |
| treze vídeos com 1 | 1 | 0 | 0% | 0% a 79,3% |
| **O canal inteiro** | **140** | **3** | **2,1%** | **0,7% a 6,1%** |

O que a tabela mostra: os intervalos de 18 impressões (3% a 33%) e de 8 impressões (0% a 32%) quase se sobrepõem por inteiro. **Nenhum vídeo, sozinho, permite dizer que a capa funciona melhor ou pior que outra**, com ou sem corte. Só o canal somado começa a dizer algo (entre 0,7% e 6,1%). Hoje 4 vídeos passam do corte de 10, 29 ficam abaixo e 2 não tiveram impressão.

| | A favor |
|---|---|
| **Com corte (10)** | Evita que "nenhum clique" seja lido como "capa ruim" em vídeo que apareceu 3 vezes. Deixa a grade mais calma: a frase só aparece onde há algo. |
| **Sempre a contagem** | É fato, não interpretação: "nenhum clique em 4 dias" não afirma taxa nenhuma. O corte de 10 é arbitrário e, pela tabela, 10 não diz mais que 8. Hoje o corte esconde a contagem em 29 de 35 cartões, que repetem a mesma frase. |

**Recomendo "sempre a contagem", nunca percentual**, e o percentual só no total do canal, com o intervalo ao lado. O corte protege de uma leitura errada que a contagem crua já não convida; e a frase repetida em 29 cartões é ruído.

## Medidas (Chrome, 1440×900, servido por HTTP)

| Medida | Valor |
|---|---|
| Canal próprio, topo da grade, tudo recolhido | **339 px** (limite pedido: cerca de 340; era 317 antes da linha de posição) |
| Canal próprio, cabeçalho recolhido | 121 px |
| Canal próprio em 1280 px | 358 px: a linha de posição quebra em duas |
| Canal próprio com a comparação aberta | cabeçalho de 565 px |
| Concorrente, grade e cabeçalho recolhido | 317 px e 99 px |
| Concorrente com "Todos os números" | 201 px (grade em 419 px) |

Sem rolagem horizontal da página em 1440, 1280, 1024, 768, 390 e 320 px em `canais.html` (13 e 70), `canal-proprio.html` (com comparação e números abertos) e `video.html` com 3 etapas; a tabela de `canais.html` rola dentro do próprio bloco abaixo de 900 px, com a coluna do nome presa. Sem erros de console nas telas abertas.

## Decisões minhas

1. **Lista longa por blocos:** os 57 de enchimento entram como uma linha esmaecida por bloco entre os canais reais, não 57 linhas. A lista fica longa o bastante para a linha presa aparecer sem encher a tela de linhas vazias.
2. **A linha presa fica no pé**, não no topo: o topo já tem o cabeçalho da tabela e a frase de contexto.
3. **"Comparar com…" na linha da sincronização**, junto de ⓘ e "Todos os números": na linha de posição ele a fazia quebrar e a grade passava de 340 px.
4. **Empate na frase de posição:** "(nenhum)" em vez de "(nenhum, empate com Esq Unltd Daily)", para caber em uma linha; o empate aparece em `canais.html`.
5. **Padrão do mockup:** 4 etapas e cliques com corte continuam o padrão até o dono escolher.

## Não feito

- Canal próprio como **cartão** na lista (o dono citou "no cartão"): só a tabela foi desenhada; a vista em cartões de Canais não está neste mockup.
- Comparação com mais de um concorrente, e a comparação a partir de `canais.html`.
- Posição em "dias desde o último vídeo": o dado dos concorrentes não veio.
- Contraste dos elementos novos, leitor de tela, `prefers-reduced-motion` de verdade, outros navegadores.
- O servidor do mockup não ficou no ar.

## Como chegar (porta 8791)

| Tela | URL |
|---|---|
| Lista de Canais | `canais.html` (`?sort=inscritos`, `vpd`, `vpm`, `med`, `l90`, `acomp`; `&dir=asc`) |
| Lista longa | `canais.html?n=70&sort=med` |
| Lista sem canal próprio | `canais.html?own=0` |
| Canal próprio com posição | `canal-proprio.html` |
| Lado a lado | `canal-proprio.html?comparar=leo-khev` (qualquer id de `canais-dados.js`) |
| Cliques | `canal-proprio.html?cliques=corte` e `?cliques=sempre` |
| Etapas | `video.html?id=7Cr3DLfUvW8&leitura=conferindo&etapas=4` e `&etapas=3` |

## Capturas da rodada 6 (`shots/`)

| Arquivo | Mostra |
|---|---|
| `r6-1440-canais-por-inscritos.png` | A lista por inscritos, com a linha presa "14º de 14" (tirada antes de sair o "Seu canal:" em negrito da linha presa) |
| `r6-1440-canais-por-mil-inscritos-sem-medida.png` | Ordenação padrão: linha presa dizendo que ainda não há medida |
| `r6-1440-canais-linha-do-canal-proprio.png` | Depois de "Ir até a linha": o divisor "Ainda sem medida para ordenar (2)" e a linha do canal próprio |
| `r6-1440-canais-70-linha-presa.png` | Lista longa com enchimento e a linha presa "71º de 71 … Posição de exemplo" |
| `r6-768-canais.png`, `r6-390-canais.png` | A lista estreita |
| `r6-1440-proprio-posicao-cliques-com-corte.png`, `r6-1440-proprio-cliques-sempre.png` | Linha de posição; as duas versões dos cliques |
| `r6-1440-proprio-comparar-com-leo-khev.png`, `r6-768-proprio-comparar.png` | Lado a lado |
| `r6-390-proprio-posicao.png` | Canal próprio a 390 px (tirada antes de um ajuste de 10 px na margem do select) |
| `r6-1440-etapas-4.png`, `r6-1440-etapas-3.png` | O mesmo cartão em andamento, com 4 e com 3 etapas |
| `r6-1440-canal-todos-os-numeros.png` | Concorrente sem o percentual duplicado |

---

# Rodada 7 (09/10/2026): topo e lista, lista longa de verdade, atalho "Meu canal", "Como o canal está", histórico do vídeo próprio

O dono ainda não aprovou ("mais um round"). O que ele fechou e o que pediu:

## Decisões do dono (fechadas)

1. **Etapas do pedido à forja: três** (Na fila, Escrevendo, Pronta). "Conferindo os números" é detalhe de "Escrevendo". **A versão de 4 etapas foi descartada**, porque o código só conhece 'na fila', 'trabalhando' e 'publicado' (`observatorio/forja/states.ts:33`): a conferência acontece dentro de 'trabalhando', e uma quarta etapa seria uma coisa que a tela não consegue observar. O seletor saiu da barra do mockup e `?etapas=` deixou de existir.
2. **Cliques: sem corte.** Sempre a contagem, nunca percentual por vídeo. O seletor saiu e `?cliques=` deixou de existir.
3. "Trocas em 30 dias" fora da faixa principal: fica.
4. Canal próprio na lista de Canais: **no topo e na lista**.
5. "A lista com 70 canais é uma simulação pobre" e "melhorar a experiência como um todo do acesso ao próprio canal e às estatísticas".

## O que mudou, por item

**1. `canais.html`: topo e lista.**
- **Bloco "Seus canais" no topo**, na mesma superfície da tabela, com o selo "seu canal" e um fio laranja à esquerda. Uma linha por canal próprio: avatar, nome, a frase de posição na ordenação atual com os vizinhos ("14º de 14 em mediana de views dos longos, com 135. Logo acima: Leo Khev (493). É o último da lista."), "Ir até a linha" e "Abrir meu canal". Trocar a ordenação troca a frase. Métrica não medida: "Ainda sem views por dia medidas: a coleta diária do seu canal começa em breve. Sem posição nesta ordenação."
- **Dois canais próprios**: tnFigueiredo e Thiago Figueiredo (3 inscritos, nenhum vídeo). O segundo só tem posição em inscritos; nas outras colunas diz "Sem vídeos: fora das posições por vídeo." e vai para o divisor "Ainda sem medida para ordenar". Ele não tem "Abrir meu canal" porque não há página para um canal sem vídeos.
- **Na lista**, cada canal próprio continua na posição dele.
- **Linha presa no pé**: continua, mais fina (uma linha de 30 px), e só aparece quando nem o bloco do topo nem a linha do canal estão na tela. Tem "Ir até a linha" e "Voltar ao topo". Mantive porque, no meio de 70 linhas, é o único lugar que diz onde o canal está sem rolar.
- **"Comparar"** no fim de cada linha de concorrente real (coluna "Com o meu canal"; nome acessível "Comparar <canal> com o meu canal"), que abre `canal-proprio.html?comparar=<id>`. Preferi o link visível a um menu por linha: é a única ação da linha e um menu de um item custaria um clique a mais.
- **Vista de cartões** (`?ver=cartoes`, com "Ordenar por…" em select): o bloco do topo é o mesmo, e o cartão do canal próprio aparece na posição dele com a frase pedida, "Você está na 10ª posição de 14 nesta ordenação." Não repeti o cartão no topo da grade: o bloco já é o topo, e dois cartões iguais do mesmo canal confundem a contagem.
- **Busca "Buscar canal"**: filtra as linhas; as posições continuam as da lista inteira, e a tela diz isso.
- Saiu a frase "Seu canal aparece na lista para comparação…": o bloco do topo já diz.

**2. Lista longa de verdade (`?n=70`).** As linhas de enchimento da rodada 6 saíram. `canais-dados.js` gera **57 canais fictícios completos** com um gerador de semente fixa (mulberry32, semente 20261009): nomes inventados de canal de viagem e números dentro das faixas dos 13 reais (inscritos de 3 mil a 5 milhões; mediana de views de 0,04 a 1,4 vez os inscritos; views/dia por mil inscritos de 0,05 a 5,6, menor nos canais acima de 1 milhão; 0 a 28 longos em 90 dias; dois deles "aguarda o 2º registro"). Cada fictício leva a palavra **"exemplo"** em `--dim` ao lado do nome, e a barra do mockup diz: "57 dos 70 concorrentes são fictícios, gerados para testar a lista longa; os 13 reais e o seu canal são dados de produção de 09/10". Fictício não tem "Comparar".

Posições do tnFigueiredo com 70 concorrentes (são contra a lista de teste): 71º de 72 em inscritos (o 72º é o Thiago Figueiredo), 71º de 71 em mediana de views, 64º de 71 em longos em 90 dias (empate), 49º de 71 em longos acompanhados (empate), sem posição em views/dia e views/dia por mil.

**3. Acesso ao canal próprio.**
- **Atalho "Meu canal: tnFigueiredo"** na linha da trilha, à direita, em `canais.html`, `canal.html`, `canal-proprio.html`, `video.html` e `video-proprio.html` (`meu-canal.js`, `meu-canal.css`). Abre um menu com os dois canais (o sem vídeos aparece apagado, "ainda sem página") e "Ver meus canais na lista de Canais". Esc fecha e devolve o foco; setas andam pelos itens. Pus na linha da trilha porque nas páginas de canal e de vídeo a moldura só tem a trilha (spec §3); **na lista, em produção, o lugar é o grupo de ações do cabeçalho** (`.obs-ch-actions` de `_chrome/observatory-chrome.tsx`, ao lado de "Adicionar canal").
- **"Comparar com o meu canal"** no cabeçalho de `canal.html`, **ao lado de "Abrir no YouTube"** e não dentro do menu ⋯: é o caminho que o dono pediu para existir, e dentro do menu ele ficaria tão escondido quanto a linha na lista. Leva a `canal-proprio.html?comparar=leo-khev`.

**4. `canal-proprio.html`: "Como o canal está".** Seção nova **acima das abas**, recolhível, que lembra o estado (localStorage e `?painel=0`). Escolhi acima das abas e não como primeira aba porque como aba ela tiraria a grade de capas da primeira tela por inteiro; recolhida, ela é uma linha ("140 impressões e 3 cliques estimados em 29 dias. 14º de 14 canais de Viagem em inscritos.").
- Uma frase no topo, uma vez: "Com 140 impressões em 29 dias, ainda é pouco para dizer qual vídeo ou qual capa funciona melhor. O que já dá para ver é em que dias o canal apareceu, e em quais não há dado."
- **Gráfico "Impressões por dia"** (`impressoes.js`, `impressoes.css`), 29 dias, com os três estados que nunca se confundem: **barra** para dia com impressões (11), **traço na linha de base** para relatório que veio vazio, zero medido (8), e **coluna hachurada de cima a baixo** para relatório ainda não baixado, não medido (10). Cliques estimados do dia são um círculo com o número sobre a barra. Legenda com a contagem de cada estado e "Ver como tabela" (dia, situação, impressões, cliques; "não medido" por extenso).
- **"Vídeos que mais apareceram"**: os 5 com mais impressões, com a contagem de cliques e de dias; cada um abre o histórico do vídeo.
- **"No nicho"**: a linha de posições (links para `canais.html` já ordenado) e o "Comparar com…" **vieram do cabeçalho para cá**; o cabeçalho voltou a 99 px. A tabela lado a lado abre dentro da seção, sem caixa própria.
- **"O que ainda não é medido"**, em frase: views por dia de cada vídeo (a coleta diária entra nos próximos dias), percentual assistido e retenção (lote seguinte), origem do tráfego (o relatório já é baixado, a tela ainda não o lê).
- **Correção de um número das rodadas 5 e 6:** a tela dizia "faltam baixar 12". Contado dia a dia no próprio dado, de 09/09 a 07/10 são 29 dias: 11 com impressão, 8 vazios e **10** sem relatório. O "12" vem da nota do arquivo e cobre uma janela um pouco maior (08/09 a 07/10). A tela agora mostra o 10 que ela mesma consegue contar.
- O cartão do vídeo diz sempre a contagem ("nenhum clique em 4 dias"). A frase do dono era "8 impressões, nenhum clique em 4 dias"; como "8 impressões" já é o número do meio do cartão, a linha de baixo não repete (repetida, ela não cabe nos 204 px do cartão).

**5. `video-proprio.html` (novo): histórico mínimo do vídeo próprio.** O clique num cartão do canal próprio agora abre esta tela. Cabeçalho (capa, título, data, duração, views, curtidas, comentários, engajamento, múltiplo contra a mediana dos outros 34 vídeos), "Vídeo mais novo" / "Vídeo mais antigo", o **mesmo gráfico dos três estados só daquele vídeo** (dia com relatório em que o vídeo não apareceu é zero medido), a frase com a contagem, e "O que ainda não há deste vídeo": views por dia, percentual assistido e retenção, origem do tráfego, trocas de título e thumbnail ("ainda não são lidas nesta tela"), leitura da forja ("a forja ainda não lê vídeos do seu canal").

## Medidas (Chrome, 1440×900, servido por HTTP)

| Medida | Valor |
|---|---|
| `canais.html` com 70: linhas inteiras na primeira dobra | **11** (linha de 39 px; a tabela começa a 387 px do topo da janela, com a barra do mockup de 33 px e o bloco de dois canais) |
| `canais.html`: a tabela cabe sem rolagem lateral interna | sim em 1440 (1174 de 1174 px) |
| Canal próprio, "Como o canal está" **aberta**: topo da grade | **798 px** do topo da tela simulada (a seção tem 473 px); cerca de 70 px da primeira fileira de capas aparecem na dobra |
| Canal próprio, seção **recolhida**: topo da grade | **365 px** (a seção vira uma linha de 40 px); 5 cartões inteiros na dobra |
| Cabeçalho do canal próprio | 99 px (era 121 na rodada 6) |
| Concorrente: topo da grade | 317 px, sem mudança |

Sem rolagem horizontal da página em 1440, 1280, 1024, 768, 390 e 320 px em `canais.html` (13 e 70, tabela e cartões), `canal.html`, `canal-proprio.html` (seção aberta, comparação e números abertos; Lista), `video-proprio.html` e `video.html`. Abaixo de 640 px o gráfico rola dentro do próprio bloco (largura mínima de 560 px) para os números continuarem legíveis. Sem erros de console.

Verificado no navegador: ordenar pelas 6 colunas com 70 (a frase do topo muda em todas), a linha presa aparecendo no meio da lista e sumindo no topo e na linha, a busca ("nom" acha Nômade Raiz e Casal Nômade), recolher e abrir a seção (URL, localStorage e foco no botão), as três etapas no cartão da forja, o botão de comparar do concorrente.

## "Meu canal" e "seu canal"

"Meu canal" quando é a pessoa agindo: o atalho "Meu canal:", "Meus canais", "Abrir meu canal", "Comparar com o meu canal", "Ver meus canais na lista de Canais". "Seu canal" quando é a tela falando: o selo, "Seus canais", "Você está na 10ª posição…", "a coleta diária do seu canal começa em breve", "a forja ainda não lê vídeos do seu canal", "Seu canal e Leo Khev, lado a lado".

## Decisões minhas que o dono precisa confirmar

1. **A seção "Como o canal está" abre por padrão** na primeira visita e empurra a grade para 798 px. Se a grade for mais importante que o gráfico no dia a dia, o padrão deveria ser recolhida.
2. **O cartão do canal próprio não se repete no topo da grade de cartões**: o bloco "Seus canais" é o topo.
3. **O segundo canal (sem vídeos) aparece** no bloco, na lista e no menu, sempre dizendo "sem vídeos". A alternativa é escondê-lo até ter vídeo.
4. **"Comparar" como link em cada linha**, e só para concorrente real.
5. **A linha presa no pé continua.**
6. **A terceira linha do cartão não repete o número de impressões.**
7. **Barras do gráfico em creme (`--text`), sem laranja nem teal**: laranja é a ação da pessoa e teal é a forja; impressão não é nenhuma das duas.

## O que eu mesmo acho que ainda está fraco

- **O gráfico é pequeno dentro da seção** (cerca de 690 × 140 px) e um dia de 71 impressões achata os outros dez. Uma escala que não seja linear, ou o maior dia cortado com o número por cima, deixaria os dias pequenos legíveis. Não fiz.
- **A primeira dobra do canal próprio com a seção aberta quase não tem capas** (70 px). Cumpre "não some por completo" por pouco.
- **A lista com 70 mostra 11 linhas na dobra.** O bloco de dois canais e o cabeçalho ocupam 387 px antes da tabela. Com um canal próprio só seriam 12; um bloco recolhível daria 14.
- **O canal próprio fica em último em quase tudo**, então a linha dele na lista e a linha presa dizem sempre "último". O desenho só é exercitado de verdade em "longos acompanhados" (10º de 14; 49º de 71).
- **O atalho "Meu canal" disputa a linha da trilha** com "Horários em São Paulo" e, no Histórico, com o paginador; em 390 px ele perde o rótulo e vira só o nome.
- **O Histórico do vídeo próprio é quase só ausências.** É honesto, mas para a maioria dos vídeos (13 têm 1 impressão, 2 têm nenhuma) a tela é um gráfico vazio e uma lista do que falta.
- **A vista de cartões é uma tabela recortada**: seis números por cartão, sem nada que só o cartão mostre.
- Não conferi contraste dos elementos novos, leitor de tela, `prefers-reduced-motion` de verdade nem outros navegadores.

## Não feito

- Página do segundo canal próprio (sem vídeos).
- Comparação com mais de um concorrente, e com um fictício.
- "Dias desde o último vídeo" dos concorrentes (o dado não veio).
- Captura do menu "Meu canal" aberto e do estado de busca.
- Não derrubei nem subi servidor: usei o que já estava na porta 8791.

## Como chegar (porta 8791)

| Tela | URL |
|---|---|
| Lista, 14 canais, tabela | `canais.html` (`?sort=inscritos`, `vpd`, `vpm`, `med`, `l90`, `acomp`; `&dir=asc`) |
| Lista em cartões | `canais.html?ver=cartoes&sort=acomp` |
| Lista com 70 | `canais.html?n=70&sort=inscritos`, `canais.html?n=70&sort=acomp` |
| Busca | `canais.html?n=70&q=nom` |
| Sem canal próprio | `canais.html?own=0` |
| Concorrente, com "Comparar com o meu canal" | `canal.html` |
| Canal próprio, seção aberta e recolhida | `canal-proprio.html?painel=1`, `canal-proprio.html?painel=0` |
| Lado a lado | `canal-proprio.html?painel=1&comparar=lodir-negrini` |
| Histórico do vídeo próprio | `video-proprio.html?id=S1iMQVIOFL4` (18 impressões), `?id=r_3QZBKHqU8` (1 clique), `?id=6jL-jeux_1Y` (sem impressão) |
| Forja em três etapas | `video.html?id=7Cr3DLfUvW8&leitura=conferindo` |

## Capturas da rodada 7 (`shots/`)

| Arquivo | Mostra |
|---|---|
| `r7-1440-canais-14-tabela.png` | 14 canais, por mediana de views, bloco "Seus canais" com vizinhos |
| `r7-1440-canais-14-tabela-metrica-nao-medida.png` | Ordenação padrão: o bloco diz que não há medida |
| `r7-1440-canais-14-cartoes.png` | Cartões, com "Você está na 10ª posição de 14 nesta ordenação." |
| `r7-1440-canais-70-por-inscritos.png`, `r7-1440-canais-70-por-acompanhados.png` | 70 concorrentes em duas ordenações, com "exemplo" nos fictícios |
| `r7-1440-canais-70-rolada-linha-presa.png` | Rolada até o meio: a linha presa fina |
| `r7-768-canais-70.png`, `r7-390-canais.png`, `r7-390-canais-cartoes.png` | A lista estreita |
| `r7-1440-concorrente-comparar-com-o-meu-canal.png` | Concorrente com o botão e o atalho "Meu canal" |
| `r7-1440-proprio-como-o-canal-esta-aberto.png`, `-recolhido.png` | A seção aberta e recolhida |
| `r7-1440-proprio-grafico-ver-como-tabela.png` | O gráfico em detalhe com "Ver como tabela" aberta |
| `r7-1440-proprio-comparar-dentro-do-painel.png` | Lado a lado dentro da seção, sem caixa própria |
| `r7-768-proprio-como-o-canal-esta.png`, `r7-390-proprio-como-o-canal-esta.png` | A seção estreita |
| `r7-1440-video-proprio.png`, `r7-768-video-proprio.png`, `r7-390-video-proprio.png` | Histórico do vídeo próprio |
| `r7-1440-video-tres-etapas.png` | O cartão da forja em três etapas |

# Rodada 8 (09/10/2026)

## O que o dono disse (histórico do vídeo próprio)

(a) "Vídeo mais antigo e mais recente não fica muito claro. Talvez deveria ser anterior ou próximo." (b) "Aqueles números ali não estou entendendo o que significam": o ① em círculo do gráfico e a linha "118 views, 12 curtidas…". (c) "O i de informação não tem nada preenchido." (d) "Precisamos de mais detalhes?" e "vídeo próprio não tem leitura da forja; seria legal pedirmos?" (e) "Perto da versão final, mas ainda precisa melhorar."

## O que mudou, por tela

**`video-proprio.html`**
- **Paginador** igual ao do Histórico de concorrente: "Anterior", "1 de 35", "Próximo" e a frase de ordem ("na ordem da lista: do mais novo ao mais antigo"). No primeiro vídeo "Anterior" fica apagado (`aria-disabled`, continua na tela); no último, "Próximo". Atalhos `[` e `]` com o foco no título ou no paginador, como em `video.html`. A ordem é a da lista de onde a pessoa veio: o canal manda `sort`, `dir`, `q` em `?back=`, e o paginador anda nessa ordem (por views, múltiplo, impressões ou data). Sem `back`, vale do mais novo ao mais antigo.
- **Faixa de números** no lugar da linha em frase: 118 views, 12 curtidas, 6 comentários, 15,3% engajamento (segunda linha: "curtidas + comentários por view"), 0,9× o normal do canal (segunda linha: "mediana dos outros 34 vídeos: 138 views"), 39:57 duração. Valor em JetBrains Mono em cima, rótulo em Inter 12 px embaixo, fio vertical entre as células. Um único ⓘ no fim abre a base dos seis números, com a conta feita ("(12 curtidas + 6 comentários) ÷ 118 views = 15,3%"; "118 ÷ 138 = 0,9×"). Marcação e CSS são os do cabeçalho do canal (`.nstrip`, `.nc`, `.ibtn`, `.pop.tip`); a lógica do popover está em `faixa-numeros.js`, copiada de `canal.js` porque esta página não carrega `canal.js`. A montagem lança erro se uma célula não tiver base, então o ⓘ não abre vazio.
- **Este vídeo no canal:** posição entre os 35 em views, em impressões de 09/09 a 07/10 e em engajamento, com empate dito ("empate com 1 vídeo"). Views e impressões são links para `canal-proprio.html?sort=vistos#v-<id>` e `?sort=imp#v-<id>`. Engajamento não é link: a lista não ordena por engajamento, e a tela diz isso. Vídeo sem impressão: "Sem impressão de 09/09 a 07/10" e quantos outros estão na mesma situação.
- **Dias em que apareceu:** tabela curta (dia, impressões, cliques estimados) só dos dias com impressão, mais a contagem dos outros dias. Sem impressão: uma frase.
- **Leitura da forja**, "ainda não disponível para o seu canal": mesma classe do cartão de `video.html` (`.forja.fj`), sem etapas. O que ela leria, o botão "Pedir leitura deste vídeo à forja" apagado e, logo abaixo, o porquê (a forja só recebe dados públicos de concorrentes; a do canal próprio chega depois da coleta diária).
- **O que ainda não há deste vídeo** virou um parágrafo.

**Gráfico de impressões por dia** (`impressoes.js`, `impressoes.css`; é o mesmo componente em `canal-proprio.html` e `video-proprio.html`)
- O ① saiu. Logo abaixo do eixo das datas há a linha "cliques": o número sob cada dia que teve clique, em branco nos dias sem clique, e a hachura do gráfico nos dias sem relatório.
- O eixo vertical tem o nome "impressões" (12 px, horizontal, acima do eixo). O número em cima da barra continua.
- Cada dia tem dica com mouse e teclado. Uma parada de Tab no gráfico; setas, Home e End percorrem os dias, Esc fecha. Textos: "24/09: 1 impressão, 1 clique estimado", "30/09: 9 impressões, nenhum clique", "26/09: relatório veio vazio (nenhuma impressão)", "12/09: relatório ainda não baixado (não medido)". No vídeo, o dia em que o relatório trouxe outros vídeos mas não este diz "o relatório do dia não trouxe este vídeo". A dica fica ao lado da coluna, no alto, para não cobrir a barra.
- Legenda em frase no lugar das chaves decoradas. Na tela do vídeo o traço na base diz "relatório baixado sem impressão deste vídeo", que é o que ele quer dizer ali.
- O desenho nasce na largura em que aparece (de 560 a 860 px), então o texto fica em 12 px e não encolhe dentro de "Como o canal está". Teto do eixo 4, 10 ou múltiplo de 20 (antes aparecia "2.5").
- Barra com pelo menos 3 px quando há impressão; escala linear, sem corte de eixo. Em `canal-proprio.html` a área de barras tem 180 px (antes 102): o dia de 71 impressões não apaga o de 1 (3 px).
- "Ver como tabela" tem dia, impressões, cliques estimados e estado do relatório.

**`canal-proprio.html`:** "Como o canal está" nasce recolhida (só a linha-resumo e o controle). Lembra o que a pessoa fez (chave nova `pc:painel8`, para ninguém herdar o padrão antigo), `?painel=1` abre, `?painel=0` fecha, e `?comparar=` abre sozinha, porque a comparação mora dentro dela.

**`canais.html`:** o canal sem vídeos (Thiago Figueiredo) no bloco "Seus canais" virou uma linha fina: "Thiago Figueiredo: sem vídeos, fora das posições por vídeo. Ir até a linha". Sem selo, sem avatar e sem botão grande; o link leva à linha da tabela e dá foco a ela.

## Medidas (Chrome, 1440×900, servido por HTTP)

| | Antes | Depois |
|---|---|---|
| Grade de capas, início, seção recolhida | 398 px | 398 px (era opcional; agora é o padrão) |
| Grade de capas, início, seção aberta | 831 px | 907 px (o gráfico ficou 78 px mais alto: abaixo da dobra de 900) |
| `canais.html?n=70`: linhas da tabela inteiras na dobra | 11 | 12 |
| `canais.html?n=70`: altura do bloco "Seus canais" | 135 px | 119 px |
| Rolagem horizontal da página, 1440 a 320 px, 8 telas | nenhuma | nenhuma |

## O que NÃO foi feito

- Ordenação por engajamento na lista de vídeos do canal (por isso o link falta nessa linha).
- Série de views por dia, retenção, origem do tráfego e trocas do vídeo próprio: continuam sem dado.
- Pedir a leitura de verdade: o botão está apagado de propósito.
- Reaproveitamento por código do popover de `canal.js`: a lógica foi copiada para `faixa-numeros.js`. Se o mockup virar produto, é um componente só.
- Os ⓘ de `canal.html` (concorrente) não foram tocados.
- Auditoria dos ⓘ: abri todos os da tela do canal próprio (números fechados e abertos, atrasada, abas Trocas, Leitura e Retenção) e da tela do vídeo próprio. Nenhum abria vazio (de 530 a 1.700 caracteres). Não consegui reproduzir o "ⓘ sem nada" do dono em lugar nenhum; o único sem ⓘ é o estado "Canal sem vídeos". Se ele ainda vir um vazio, preciso saber em qual tela.
- Nenhum teste automatizado: conferência por captura e por script no Chrome.

## Como chegar (porta 8791)

| Tela | URL |
|---|---|
| Vídeo próprio, 18 impressões e 2 cliques | `video-proprio.html?id=S1iMQVIOFL4` |
| Vídeo próprio, 17 impressões e 1 clique | `video-proprio.html?id=r_3QZBKHqU8` |
| Vídeo próprio sem impressão | `video-proprio.html?id=WDRy_uldCI8` (ou `6jL-jeux_1Y`) |
| Paginador na ordem de uma lista | `video-proprio.html?id=S1iMQVIOFL4&back=%3Fsort%3Dimp` |
| Canal próprio recolhido (padrão) e aberto | `canal-proprio.html`, `canal-proprio.html?painel=1` |
| Lista com 70 e a linha fina | `canais.html?n=70` |

## Capturas da rodada 8 (`shots/`)

| Arquivo | Mostra |
|---|---|
| `r8-1440-video-proprio-S1iMQVIOFL4.png`, `-r_3QZBKHqU8.png`, `-sem-impressao.png` | A tela inteira em três vídeos |
| `r8-1440-grafico-tooltip-aberto.png` | O gráfico do vídeo com a dica do dia 30/09 |
| `r8-1440-proprio-grafico-tooltip.png` | O gráfico mais alto do canal, dica do dia de pico |
| `r8-1440-grafico-ver-como-tabela.png` | "Ver como tabela" aberta |
| `r8-1440-video-proprio-info-aberto.png` | O ⓘ da faixa de números aberto |
| `r8-1440-proprio-como-o-canal-esta-recolhido.png`, `-aberto.png` | Canal próprio nos dois estados |
| `r8-1440-canais-70-bloco-fino.png`, `r8-1440-canais-14-bloco-fino.png` | A linha fina no bloco "Seus canais" |
| `r8-390-video-proprio.png`, `r8-390-canal-proprio-recolhido.png`, `r8-390-canal-proprio-aberto.png` | 390 px |


# Rodada 9 (09/10/2026)

## O que o dono disse

"Anteriormente havia como ver comparação entre um canal e outro, especialmente entre meu canal e um canal específico. Seria legal mantermos isso. O botão de Comparar com meu canal parece estar simplesmente navegando para o meu canal, e deveríamos ter uma experiência de comparar as estatísticas do meu canal com este outro específico."

Conferido: ele tinha razão. O botão do concorrente e o "Comparar" da lista levavam a `canal-proprio.html?comparar=<id>`, que abria uma tabela de 7 linhas dentro de "Como o canal está" sem rolar nem focar: a pessoa caía no topo do canal próprio.

## O que mudou, por tela

**`comparar.html` (nova): `?a=<id>&b=<id>`** (`comparar.js`, `comparar.css`, `comparar-leo.js`). Dois canais lado a lado, colunas de mesmo peso.
- **Cabeçalho:** um cartão por lado (avatar, nome, selo "seu canal", nicho, inscritos), um seletor em cada lado (os 2 canais próprios e os 13 concorrentes reais; os 57 de exemplo ficam fora), "Inverter lados" e "Abrir o canal …" (só Leo Khev e o canal próprio têm página; nos outros o cartão diz "não tem página neste mockup"). `a` vale o canal próprio quando falta ou é inválido; sem `b`, vale o concorrente logo acima de A em inscritos. Trocar um seletor atualiza a URL (`history.replaceState`), o título e a frase do `role="status"`, sem recarregar. O canal do outro lado fica **desabilitado** na lista do seletor (a mesma pessoa não pode ficar dos dois lados).
- **"Número a número":** uma `<table>` de verdade (`caption`, `th scope="col"`/`"row"`/`"rowgroup"`), três grupos (Tamanho, Publicação, Desempenho). Por linha: nome, base do número (12 px), valor de A, valor de B e a RELAÇÃO em palavras, **sempre de B em relação a A**: "1,3× os seus inscritos" (A é o canal próprio) ou "8,7% dos inscritos de Dale Philip" (A é outro). Abaixo de 0,95 vira percentual ("menos de 1%" no piso); entre 0,95 e 1,05 vira "≈ 1×". Sem verde, sem vermelho, sem "vencedor"; a frase "Sem vencedor nem perdedor…" ficou no rodapé da tabela.
- **Barra por linha:** 4 px, `--muted`, proporcional ao maior dos dois, mesmo eixo. Se a menor passa a ser menos de 3% da maior, ela ganha 3 px e a linha diz por escrito "menos de 3% da barra do outro lado" (acontece em inscritos e mediana de views contra Nômade Raiz, bald and bankrupt e Dale Philip). Nada de eixo cortado em silêncio. Sem barra quando um lado não foi medido, e nas linhas em que barra não faz sentido (crescimento em %).
- **Nulo, nunca zero:** o lado sem dado diz "não medido" + o motivo curto, em `--dim`, e a relação da linha some (célula vazia com texto só para leitor de tela). Zero medido é "0" (longos em 90 dias do canal próprio; "0 + 0" no ritmo). Razão com zero não se calcula: "sem razão: tnFigueiredo tem 0"; os dois em zero: "os dois em 0". Linha em que NENHUM dos dois tem dado **não aparece**, e o rodapé conta e nomeia as que ficaram de fora ("3 números ficaram de fora…", "7 números…" em concorrente × concorrente).
- **"Só o seu canal mede":** impressões, cliques estimados e relatórios com impressão do canal próprio, em cartão à parte com fio laranja, com a frase "não porque seja zero". Some quando nenhum dos dois é canal seu.
- **"Os 5 vídeos mais vistos de cada canal":** duas colunas (empilham abaixo de 820 px), capa, título, views, idade, marca "Short"; cada vídeo abre `video.html?id=` (Leo Khev) ou `video-proprio.html?id=` (canal próprio). Canal sem vídeos no mockup diz isso e repete o que o resumo tem ("No resumo ele tem 49 longos acompanhados").
- **"Publicação nos últimos 90 dias":** uma faixa por canal, um traço por vídeo (alto: longo, baixo: Short), no MESMO eixo (10/07 a 07/10). Para o canal sem datas a faixa não é desenhada: o bloco diz "As datas de publicação deste canal não estão neste mockup" e mostra só a contagem real de longos em 90 dias do resumo. **Decisão minha:** o bloco aparece quando UM dos lados tem datas (o brief dizia "deixe o bloco fora" se o concorrente não trouxesse datas; fora por inteiro, a tela perderia a faixa do canal próprio, que é verdadeira). Quando nenhum dos dois tem datas, o bloco não aparece e o rodapé diz.
- **Estreito:** em 390 px a tabela vira linhas de três faixas (rótulo, depois A e B LADO A LADO, depois a relação) e os blocos de vídeos empilham. A tabela ganhou `role` explícito em cada elemento porque `display:grid` em `<tr>` tira a semântica de tabela em alguns navegadores (inferência: não testei leitor de tela).

**Entradas para a tela nova** (as quatro conferidas; ver "VERIFICADO")
1. `canal.js`, cabeçalho do concorrente: "Comparar com o meu canal" → `comparar.html?a=proprio&b=leo-khev`.
2. `canais.js`: o "Comparar" de cada linha e de cada cartão → `comparar.html?a=proprio&b=<id>`.
3. `canal-proprio.html`, "Como o canal está › No nicho": o "Comparar com…" virou um formulário GET (select + botão "Comparar", duas paradas de Tab). Escolhi select + botão e não "navegar ao mudar o select", porque setas num select fechado disparam `change` em alguns navegadores e a pessoa seria levada embora sem querer. A tabela embutida (`comparacao()`) saiu. `?comparar=<id>` redireciona (`location.replace`) para a tela nova.
4. Cabeçalho do canal próprio: botão "Comparar com…" ao lado de "Abrir no YouTube" → `comparar.html?a=proprio&b=leo-khev` (o concorrente logo acima em inscritos; o `title` diz qual). O cabeçalho continua com 99 px.

**Fracos da rodada 8**
1. **Botão da forja (`video-proprio.html`):** sem preenchimento verde, contorno tracejado, texto `--muted` (rgb 168, 157, 136) sobre fundo transparente, `cursor:default`, `aria-disabled="true"` mantido, sem mudança no hover. Só `#screen.vp .vp-fj`: o botão de `video.html` não mudou.
2. **"Este vídeo no canal" × "Dias em que apareceu":** a caixa da esquerda ganhou três posições que já eram calculáveis dos mesmos 35 vídeos (curtidas, comentários, duração: "18º de 35 em curtidas (empate com 2 vídeos)"), nenhum número novo. As duas caixas ficam com a mesma altura (388 px); a da direita ainda tem uns 100 px vazios no pé, bem menos que a meia caixa de antes.
3. **Faixa de números do vídeo:** tirei a segunda linha de explicação de "engajamento" e de "o normal do canal" (a conta e a mediana de 138 views continuam no ⓘ, que já as tinha). Faixa do vídeo 36 px, faixa do canal próprio 36 px (medido nas duas, 1440 px).
4. **Gráfico de impressões em 390 px:** era verdade: o desenho tinha 560 px dentro de uma coluna de 324, e rolava por dentro. Agora, abaixo de 560 px de coluna, o desenho nasce na largura da coluna (324 px), com margem esquerda de 46 px (antes 58), os mesmos 29 dias e os mesmos 5 rótulos de data; o último rótulo alinha à direita para não cortar ("07/10"). Rolagem interna: 324 de 324. Não repinta ao girar o aparelho (ver "fraco").
5. **O "ⓘ sem nada":** a hipótese se confirma por exclusão, não por reprodução. Varri o DOM de `canal-proprio.html` (seção aberta, "Todos os números" aberto, aba Trocas), `video-proprio.html` (dois vídeos), `canal.html` e a tela nova: **nenhum caractere em círculo (①–⑳, ⓘ)** no texto, **nenhum `<circle>` SVG fora de botão ou link** (o único é a lupa da busca) e **nenhum `<circle>` dentro do gráfico**. Os ⓘ que sobraram são todos `<button class="ibtn">` com `aria-label`, e abrem conteúdo (já auditado na rodada 8). Conclusão: o ① em círculo do gráfico da rodada 7 era o glifo que parecia ⓘ e não abria nada; ele já tinha saído na rodada 8 e nada parecido voltou. Se o dono ainda vir um vazio, preciso saber em qual tela e em qual navegador.

## De onde vem cada número da comparação

| Linha | De onde | Real ou fabricado |
|---|---|---|
| Inscritos | `canais-dados.js`, campo `inscritos` (13 reais + `proprio`, `proprio-2`) | real, lido em 09/10 |
| Inscritos em 30 dias | `BRUTO.inscritos30` de `dados.js` (antes 1.510 em 07/09, agora 1.530): só Leo Khev | real; o canal próprio não tem a contagem diária |
| Longos acompanhados, longos em 90 dias, mediana de views, views/dia, views/dia por mil | `canais-dados.js`: `acomp`, `l90`, `med`, `vpd`, `vpm` | real; `vpd`/`vpm` nulos do canal próprio ("coleta diária começa em breve") e da Sonhe Alto ("aguarda o 2º registro") |
| Longos + Shorts por semana | vídeos com `pub` nas últimas 13 semanas (`pub > agora − 91 d`) ÷ 13, de `dados.js` (Leo Khev) e `dados-proprio.js` | real, só para os dois com vídeos |
| Dias desde o último vídeo | maior `pub` de cada canal; agora = `C.NOW` (07/10 22:15 SP) | real; bate com o 666 de `canais-dados.js` (próprio) e com o 55 de `canal.html` (Leo Khev). **Melhora a rodada 7:** a tabela antiga dizia que Leo Khev "não veio na exportação"; as datas dele vieram |
| Engajamento nos longos | mediana de (curtidas + comentários) ÷ views, **todos** os longos com views, curtidas e comentários não nulos (Leo: 59 longos; próprio: 35) | real. **Não é o mesmo número de `canal.html`:** ali é por longo acompanhado de até 90 dias; aqui é sem janela, porque o canal próprio não tem vídeo em 90 dias e a comparação precisa da mesma régua dos dois lados. Excluí os vídeos com comentário nulo em vez de contar 0 |
| Vídeos acima de 2× em 90 dias | múltiplo por `HM.mult` (o de `canal.html`; `comparar-leo.js` guarda a foto antes de `dados-proprio.js` trocar o canal) | real; próprio: "nenhum vídeo seu nos últimos 90 dias" |
| Duração mediana dos longos | mediana de `dur` dos longos com duração (Leo 60, próprio 35) | real |
| Trocas em 30 dias | `C.trocas.length` de Leo Khev = 7 | **FABRICADO** (as 7 trocas de `dados.js` são de teste; o canal real tem 0). A célula leva "exemplo" e "fabricadas neste mockup"; do canal próprio: "as trocas do seu canal ficam no A/B Lab" |
| Impressões, cliques, relatórios | `dados-proprio.js` → `C.reach` (140, 3, 11 de 19; 10 dias sem relatório) | real (cliques = impressões × CTR, estimado) |
| 5 mais vistos, faixa de 90 dias | `videos[].views`, `pub`, `thumb` (Leo: 133 vídeos, 132 com views; próprio: 35) | real |

Não acrescentei campo a nenhum arquivo de dados. Só Leo Khev e o canal próprio têm vídeos no mockup; para os outros 12 concorrentes valem só as seis medidas do resumo.

## Medidas (Chrome, servido por HTTP)

| Medida | Valor |
|---|---|
| Rolagem horizontal da página, 1440, 1280, 1024, 768, 390 e 320 px, 11 telas (5 pares de `comparar.html`, `canal-proprio` aberto, `canal`, `canais` em 70 e em cartões, 2 vídeos próprios) | nenhuma (medida com iframes da largura certa; o Chrome não deixa a janela abaixo de 500 px, por isso 390 e 320 foram emulados assim) |
| Rolagem interna do gráfico de impressões em 390 px | nenhuma (324 de 324; era 324 de 560) |
| Faixa de números: vídeo próprio × canal próprio (1440 px) | 36 px × 36 px |
| Caixas "Este vídeo no canal" e "Dias em que apareceu" (1440 px) | 388,5 px as duas |
| `comparar.html`, tnFigueiredo × Leo Khev, 1440 px | 13 linhas de número, nenhum número de fora |
| tnFigueiredo × Esq Unltd Daily | 10 linhas; 3 de fora; 6 com "não medido" de um lado |
| Dale Philip × Lucas Bigodinho | 6 linhas; 7 de fora; bloco de publicação não aparece |
| Console | sem erros em `comparar.html`, `canal.html`, `canais.html`, `canal-proprio.html`, `video-proprio.html` |

## VERIFICADO no navegador × inferência

**Verificado (Chrome, 1440, 768 e 390):** a tela nova nos cinco pares (próprio × Leo, próprio × concorrente gigante, próprio × pequeno, concorrente × concorrente, próprio × Thiago Figueiredo: 8 linhas, 5 de fora, "sem vídeos" no lado B); troca de seletor com URL, título e status atualizados; opção do outro lado desabilitada; "Inverter lados" (relações refeitas, "menos de 1% dos inscritos de Dale Philip"); caminhos de entrada: botão do concorrente, link "Comparar" da lista (clicados com `.click()` no DOM), formulário do canal próprio (enviado com outro concorrente selecionado: abriu `b=dale-philip`) e redirecionamento de `canal-proprio.html?comparar=bald-and-bankrupt`; os 5 vídeos mais vistos de Leo Khev abrem `video.html` com título certo; os fracos 1 a 5.
**Só inspecionado, não clicado:** o botão "Comparar com…" do cabeçalho do canal próprio (conferi o `href`, `comparar.html?a=proprio&b=leo-khev`, e a altura de 99 px do cabeçalho).
**Inferência:** leitor de tela (a tabela com `role` explícito, o `role="status"`), contraste dos textos novos (`--dim` sobre `--surface` calculei de cabeça, não medi), foco do teclado em ordem real de Tab (só li o DOM: header, 2 selects, 2 links, vídeos), outros navegadores (o Opera do dono: não há `color-mix()` no CSS novo).

## Decisões minhas a confirmar

1. **Relação sempre de B em relação a A**, em palavras ("13× os seus inscritos"). Para valores menores que A uso percentual ("8,7% dos inscritos de Dale Philip"). Alternativa: sempre "N× menos".
2. **Select + botão** na seção "No nicho" do canal próprio, em vez de navegar ao mudar o select.
3. **"Thiago Figueiredo" (sem vídeos) é opção** nos seletores, com "(sem vídeos)". Mostra a tela quase toda em "não medido"; se o dono achar ruído, é só tirar da lista.
4. **O bloco de publicação aparece com um lado só** (o brief dizia para deixar fora; ver acima).
5. **Engajamento sem janela de 90 dias**, para dar a mesma régua aos dois (difere do número de `canal.html`).
6. **A linha das trocas com 7 "exemplo"** para Leo Khev: preferi mostrar fabricado e marcado a esconder a linha, para o desenho de "um lado mede, o outro não" aparecer. Se o dono preferir, sai.
7. **5 mais vistos misturam longos e Shorts** (3 dos 5 de Leo Khev são Shorts, marcados "Short"). Um filtro "só longos" não foi feito.

## O que eu mesmo acho fraco

- **Com 12 dos 13 concorrentes a tela é pobre:** só seis números e nenhum vídeo. É a verdade do mockup, mas em produção cada concorrente teria vídeos, e o desenho com tudo preenchido só foi exercitado em tnFigueiredo × Leo Khev.
- **A frase "não medido, os vídeos deste canal não estão neste mockup" é fala de mockup**, não de produto; em produção o motivo seria "ainda sem vídeos sincronizados".
- **"3.914× os seus inscritos" e "22.324× a sua mediana"** são números tão grandes que a palavra ajuda pouco; a barra de 3 px e o aviso fazem mais.
- **A tabela tem 13 linhas**; sem um resumo no topo ("o canal próprio tem 1,3× os inscritos de…") a pessoa lê tudo para achar a história. Não fiz resumo para não declarar "vencedor".
- **Não repinta o gráfico de impressões ao girar o aparelho** (o desenho nasce na largura da coluna no carregamento).
- **O botão "Comparar com…" do cabeçalho do canal próprio abre sempre com Leo Khev**, mesmo que a pessoa só queira trocar de lado depois.
- A caixa da direita de "Este vídeo no canal" ainda tem uns 100 px de vazio.
- Sem teste de leitor de tela, contraste medido, teclado de verdade nem outros navegadores.

## Não feito

- Comparar mais de dois canais; comparar com canal de exemplo (fictício).
- Página para o segundo canal próprio (sem vídeos); a tela de comparação o aceita (conferido: próprio × Thiago Figueiredo mostra 8 linhas, `acomp` e `l90` nulos viram "sem vídeos", o cartão diz "ainda sem página").
- Filtro "só longos" nos 5 vídeos; ordenação por engajamento na lista de vídeos.
- Nada na aba Trocas, no visualizador, no Histórico de concorrente além das entradas; nenhum dado novo.
- Nenhum teste automatizado; nenhum commit; servidor da porta 8791 usado como estava.

## Como chegar (porta 8791)

| Tela | URL |
|---|---|
| Próprio × Leo Khev (o logo acima) | `comparar.html?a=proprio&b=leo-khev` |
| Próprio × concorrente gigante | `comparar.html?a=proprio&b=bald-and-bankrupt` (ou `nomade-raiz`, `dale-philip`) |
| Próprio × concorrente pequeno | `comparar.html?a=proprio&b=esq-unltd-daily` |
| Concorrente × concorrente | `comparar.html?a=dale-philip&b=lucas-bigodinho` |
| Com "não medido" por falta de 2º registro | `comparar.html?a=proprio&b=sonhe-alto-viagens` |
| Com o canal sem vídeos | `comparar.html?a=proprio&b=proprio-2` |
| Sem parâmetros (A = canal próprio, B = logo acima) | `comparar.html` |
| Link antigo, redireciona | `canal-proprio.html?comparar=leo-khev` |
| Entradas | `canal.html` (botão), `canais.html?sort=inscritos` (link "Comparar"), `canal-proprio.html?painel=1` (select + "Comparar" em "No nicho"; botão "Comparar com…" no cabeçalho) |
| Fracos da rodada 8 | `video-proprio.html?id=S1iMQVIOFL4` (botão da forja, caixas, faixa e gráfico; veja em 390 px) |

## Capturas da rodada 9 (`shots/`)

| Arquivo | Mostra |
|---|---|
| `r9-1440-comparar-proprio-leo.png` | Próprio × Leo Khev, tela inteira: tudo preenchido |
| `r9-1440-comparar-proprio-gigante.png` | Próprio × bald and bankrupt: barras de 3 px com aviso, relações enormes, vários "não medido" |
| `r9-1440-comparar-proprio-pequeno.png` | Próprio × Esq Unltd Daily: "os dois em 0", 3 linhas de fora |
| `r9-1440-comparar-concorrentes.png` | Dale Philip × Lucas Bigodinho: 7 linhas de fora, sem bloco de publicação |
| `r9-768-comparar-proprio-leo.png` | A mesma tela em 768 px |
| `r9-390-comparar-tabela.png` | 390 px: A e B lado a lado dentro da tabela |
| `r9-1440-proprio-aberto-comparar.png` | Canal próprio: "Comparar com…" no cabeçalho e select + botão em "No nicho" |
| `r9-1440-video-proprio.png` | Botão da forja apagado, caixas equilibradas, faixa de números mais baixa |
| `r9-390-video-proprio-grafico.png` | Gráfico de impressões em 390 px, sem rolagem interna |


# Rodada 10 (09/10/2026)

## O que o dono disse

Sobre "Este vídeo no canal" (`video-proprio.html`): "está muito texto e difícil compreender. Talvez adicionar cores ou algo assim para facilitar a compreensão." Eram seis linhas de prosa.

## O que mudou

**`video-proprio.html`** (novos `regua.js` e `regua.css`; `video-proprio.js` monta os dados)
- **Frase no topo, sem número**, gerada dos dados: "Primeiro do canal em impressões, mas com poucas. No meio em views, engajamento, curtidas e comentários." Cada oração leva a forma do seu terço (▲ ● ▼). Duração fica fora da frase. Vídeo sem impressão abre com "Sem impressão no período."
- **Tabela de verdade** (`caption`, `th scope`, `colgroup`) em três grupos apagados, em caixa normal: Alcance (impressões, views), Resposta (engajamento, curtidas, comentários), Formato (duração). Por linha: nome, valor deste vídeo (JetBrains Mono), **régua**, posição.
- **Régua:** um traço por vídeo do canal, posto pelo valor real, menor à esquerda e maior à direita, os dois escritos nas pontas. O traço deste vídeo é maior (4 px × 26 px contra 2 × 12), com contorno e na cor do terço. Triângulo cinza sob a linha = mediana do canal. Empate: o mesmo valor abre 2,6 px para o lado; nas pontas (menor/maior) abre só para dentro da régua; o traço deste vídeo fica no valor exato.
- **Terço:** posição média no empate (`posição + empates/2`) ≤ n/3 cima, ≤ 2n/3 meio, resto baixo. O terço sai da posição média e não da melhor, para o empate não favorecer ninguém. A posição escrita continua "18º de 35 · empate com 2".
- **Posição em texto e leitor de tela:** a célula tem o texto visível (aria-hidden) e um texto só para leitor de tela: "16º de 35 em views, terço do meio, empate com 2; 135 views; no canal de 62 a 929; mediana 138". A régua visual é `aria-hidden`.
- **Dica e teclado:** passar o mouse mostra título e valor do vídeo mais perto do ponteiro. Uma parada de Tab por régua (o foco cai neste vídeo e a dica já aparece), setas/Home/End andam de vídeo em vídeo no valor, Enter abre o vídeo (preserva `?back=`), Esc fecha a dica. Cada passo fala o título e o valor numa região `aria-live`. Toque: o primeiro toque mostra a dica, o segundo no mesmo traço abre. Sem animação nenhuma.
- **Sem impressão (`WDRy_uldCI8`):** a linha de impressões diz "sem impressão de 09/09 a 07/10" ocupando a linha toda: sem régua, sem traço destacado, sem posição, sem zero. A frase também diz.
- **Impressões são "de 33", não "de 35":** 33 vídeos têm impressão; os 2 sem impressão ficam fora da régua e da posição (nulo não vira zero). O brief mostrava "1º de 35"; segui a regra do "de 34".
- **Honestidade de pouco dado**, abaixo da tabela: "18 impressões em 6 dias, somadas dos 19 relatórios diários lidos de 09/09 a 07/10 (10 dias ainda sem relatório baixado). Com tão poucas, a posição em impressões muda de um dia para o outro."
- **Links:** a posição de views (`?sort=vistos#v-<id>`) e de impressões (`?sort=imp#v-<id>`) segue como link. Engajamento, curtidas, comentários e duração não são link (a lista não os ordena). Eles não dizem isso por escrito: o texto da rodada 8 ("a lista ainda não ordena por engajamento") saiu para não pesar.

## Escala de cada régua (calculada nos dados, escrita na legenda)

Regra: se 60% ou mais dos vídeos cai no primeiro quarto do eixo linear, usa raiz quadrada de (valor − menor); senão linear. A legenda diz qual foi usada e por quê.

| Número | Escala | Por quê |
|---|---|---|
| Impressões (33) | raiz | 73% entre 1 e 5, o máximo é 18 |
| Views (35) | raiz | 86% abaixo de 284; um de 929 |
| Curtidas | raiz | cauda longa até 87 |
| Comentários | raiz | cauda longa até 51 |
| Duração | raiz | um de 3h06 e a maioria abaixo de 40 min |
| Engajamento | linear | distribuição já espalhada (4,1% a 36,8%) |

Texto na tela: "Escala comprimida (raiz quadrada) em impressões, views, curtidas, comentários e duração, para caber o maior sem apagar os pequenos; engajamento em escala linear." Nenhum eixo é cortado em silêncio (a ponta esquerda é o menor valor e está escrita).

## Cores e contraste (medido por cálculo WCAG contra o fundo do cartão `#221E1A`)

| Uso | Cor | Contraste |
|---|---|---|
| Terço de cima (traço e ▲) | `#A78BFA` (`--tier-high`, "muito alto" nas capas) | 6,08:1 |
| Terço do meio (traço e ●) | `#38BDF8` (`--tier-mid`, "alto" nas capas) | 7,73:1 |
| Terço de baixo (traço e ▼) e duração | `#F5EFE6` (`--text`) | 14,48:1 |
| Traço dos outros vídeos | `--dim` `#958A75` | 4,86:1 |
| Textos apagados (pontas, posição, grupos) | `--muted` 6,18:1, `--dim` 4,86:1 | passam 4,5:1 |

Mapeamento: violeta > azul > sem cor de nível é a mesma ordem da escala do múltiplo nas capas (muito alto > alto > nada). Não usei o coral `--tier-top` ("topo", ≥10×) porque o terço de cima de um canal não é "topo" e porque ele se confunde com o laranja de destaque da tela. O creme do terço de baixo é "sem cor de nível", como nas capas abaixo de 2×.
**Limite medido:** o violeta e o azul contra os traços cinza têm contraste de luminância só 1,25:1 e 1,59:1. O traço deste vídeo se distingue por altura, largura e contorno, não só pela cor, e a posição está escrita; mas a cor sozinha não separa o traço dos vizinhos.

## Os dois consertos em `comparar.html`

1. **"Praticamente igual":** quando os dois valores diferem menos de 10% a relação vira "praticamente igual" (antes "≈ 1× …" só abaixo de 5%). Apareceu em "Longos acompanhados" (35 × 34) e "Duração mediana" (13:46 × 13:25). **VERIFICADO.**
2. **"Dias desde o último vídeo":** a relação virou frase direta, "Leo Khev publicou há 55 dias; você, há 666 dias", e **tirei a barra dessa linha** (fica o número e a data). Escolhi tirar em vez de inverter: inverter exige que a pessoa leia a legenda do sentido, e aqui a barra cheia do lado mais parado leria como vantagem; sem barra o número fala. A nota do rodapé diz que não há barra ali. **VERIFICADO** (0 barras na linha).

## Decisões minhas a confirmar

1. **Caixas do par com alturas diferentes (não segui o item 9 à letra).** "Dias em que apareceu" tem ~300 px de conteúdo; o bloco da régua, ~610 px. Esticar a caixa da direita deixaria 300 px vazios dentro dela (pior que os ~100 px de hoje), então as duas ficam alinhadas no topo e cada uma termina onde o conteúdo termina. Alternativa: levar o parágrafo de honestidade das impressões (86 px) para a caixa da direita, o que ainda deixaria ~200 px de diferença. Em 1440 px a divisão é 2fr/1fr (776 px / 388 px); abaixo de 1180 px empilham (em 1024 também).
2. **Cores do mapeamento** (violeta/azul/creme, acima). Se o dono quiser o terço de baixo "avisando", é só trocar uma cor.
3. **Terço pela posição média no empate** em vez da melhor posição.
4. **Impressões "de 33"** com os 2 sem impressão fora (e não 35 com zero).
5. **A frase do brief ("abaixo da metade em views e curtidas") não bate com terços**: 21º e 18º de 35 estão no terço do meio (12º a 23º). Segui os terços, porque a cor e a frase têm de dizer a mesma coisa. Resultado: para o primeiro vídeo, "No meio em views, engajamento, curtidas e comentários".
6. Nome do vídeo na dica cortado em 58 caracteres.

## O que eu acho fraco

- **O vídeo do meio não "conta história":** com a frase "No meio em quatro coisas" a tela é verdadeira e sem graça. É o canal: a distribuição é parecida em tudo.
- **O terço de baixo é creme, quase igual ao traço da duração**; só a forma ▼ e a posição escrita os separam. Em 3 segundos, vídeos ruins (`WDRy_uldCI8`) se leem pela posição dos traços brancos à esquerda, não por uma cor de alarme.
- **A coluna de impressões tem 13 traços empilhados no valor 1**, abertos 2,6 px cada: leem como "muitos aqui", mas o tamanho do bolo não é contado.
- **Três linhas de nota abaixo da tabela** (legenda, escala, honestidade) ainda pesam; o dono reclamou de texto. A de escala poderia virar um ⓘ.
- **Caixa da direita mais baixa que a da esquerda** (ver decisão 1).
- **Empate com valor idêntico em comentários (0)** aparece como 3 vídeos no zero: é zero medido (comentário 0 existe no dado), não nulo.
- Medi o contraste por conta, não pelo navegador.

## VERIFICADO no navegador × inferência

**Verificado (Chrome DevTools, 1440, 768, 390 e 320 px):** `S1iMQVIOFL4`, `r_3QZBKHqU8`, `WDRy_uldCI8` e o mais visto (`FHIgdLOzODE`, 929 views, traço violeta na ponta direita); sem rolagem horizontal da página em 1440, 768, 390 e 320 (scrollWidth = largura); sem erros no console; em 390 a régua tem 324 px de largura e as pontas vão para a linha de baixo; teclado de verdade (foco na régua mostra a dica deste vídeo, seta esquerda anda para o vizinho com título e valor também na região `aria-live`, Esc fecha, setas seguem depois do Esc, Enter abriu `l2ZcAWDBqX4`); dica de mouse com eventos de ponteiro sintéticos (mais perto de 90% da régua de views = o vídeo de 702 views; some ao sair); `comparar.html` com os dois consertos.
**Inferência:** leitor de tela (a tabela com `role` explícito e a região `aria-live` são desenho, não teste); toque (dois toques) escrito e não exercitado em aparelho; o Opera do dono (não há `color-mix()` no CSS novo); contraste calculado, não medido no navegador.

## Como chegar (porta 8791)

| Tela | URL |
|---|---|
| 1º em impressões (18) | `video-proprio.html?id=S1iMQVIOFL4` |
| Terço de cima em impressões, engajamento e comentários | `video-proprio.html?id=r_3QZBKHqU8` |
| Sem impressão | `video-proprio.html?id=WDRy_uldCI8` |
| Mais visto do canal (929 views) | `video-proprio.html?id=FHIgdLOzODE` |
| Comparar com os dois consertos | `comparar.html?a=proprio&b=leo-khev` |

## Capturas da rodada 10 (`shots/`)

| Arquivo | Mostra |
|---|---|
| `r10-1440-S1iMQVIOFL4.png` | Bloco completo, primeiro em impressões |
| `r10-1440-mais-visto-teclado.png` | Mais visto, foco por teclado e dica; terço de baixo em impressões |
| `r10-1440-r_3QZBKHqU8-teclado.png` | Régua de impressões com a dica depois de Esc e duas setas |
| `r10-1440-sem-impressao.png` | Sem impressão, três views/curtidas/comentários no terço de baixo |
| `r10-768-S1iMQVIOFL4.png` | 768 px: caixas empilhadas |
| `r10-390-r_3QZBKHqU8.png` | 390 px: régua inteira, pontas embaixo |
| `r10-1440-comparar-dias.png` | `comparar.html`: "praticamente igual" e a frase dos dias |

## Não feito

Nada fora do bloco e dos dois consertos; gráfico de impressões, forja e dados intactos; nenhum teste automatizado; nenhum commit.


# Rodada 11 (09/10/2026)

## O que o dono disse (09/10, 23:24)

1. `comparar.html`, "Número a número": "seria bom ter mais cores, símbolos e coisas para conseguirmos entender melhor. Está muito preto e branco. Fica de difícil interpretação e leitura. Talvez falta uma interpretação da forja aqui também?"
2. Gráfico de impressões por dia: "as cores estão faltando, parece que foram excluídas visualmente onde o relatório não está baixado e medido. Talvez precisamos de mais cores aqui também."
3. Cabeçalho do canal (Leo Khev): "precisa aumentar um pouco o espaçamento nas partes do título."
4. Na comparação: "talvez poderíamos até colocar porcentagem ou percentil também. Não sei."

Fio comum: as telas diziam a verdade em texto cinza. Ele quer ver a resposta antes de ler.

## O que mudou, por tela

**`comparar.html`** (`comparar.js`, `comparar.css`; usa `regua.js`/`regua.css` e `faixa-numeros.js`)
- **Cor por lado (A1).** Filete de 3 px no topo de cada cartão de lado, chip "Lado A"/"Lado B" na cor, cabeçalho de cada coluna com chip e sublinhado de 3 px na cor, filete de 3 px à esquerda das células de valor de cada lado, barras e traços da régua, títulos das colunas de vídeos (chip + filete), traços da faixa de publicação e a letra de cada lado. **Decisão minha:** a cor segue o CANAL, não a posição: o canal próprio é sempre o laranja do selo (no lado A ou no B); o outro lado é azul; sem canal próprio no par, o lado A é areia e o B azul. Inverter lados troca as cores junto com os canais (verificado: `a=proprio` vira laranja/azul, depois do "Inverter" vira azul/laranja). Com o canal próprio no B, o A fica azul (o brief só previa "A não é o próprio → areia"; fiz o laranja nunca sair do "seu").
- **Leitura rápida (A2).** Calculada dos mesmos números, sem IA, no topo do cartão: "▲ Você é maior em: engajamento (14,9% contra 9,6%).", "▲ Leo Khev é maior em: inscritos (1,3×), longos em 90 dias (2 contra 0), ritmo de publicação (0,2 por semana contra 0) e mediana de views (3,7×); publicou mais recentemente.", "＝ Praticamente iguais: longos acompanhados e duração.", "◌ Sem como comparar ainda: 5 números (falta o dado do seu canal em …)". Nunca "ganha". Linha sem itens não aparece. "Maior" = 10% ou mais de diferença (a mesma regra do "praticamente igual"); contra zero a linha escreve "(2 contra 0)", não uma razão infinita; "dias desde o último vídeo" vira "publicou mais recentemente".
- **Régua do nicho (A3).** Os seis números que existem no nicho (inscritos, longos acompanhados, longos em 90 dias, mediana de views, views/dia, views/dia por mil) usam a régua da rodada 10 generalizada (ver "De onde vem a posição"): um traço por canal, dois destacados (A e B, cor do lado, letra embaixo), as letras se afastam quando os traços colidem (os traços não saem do valor). O valor continua escrito nas colunas, com a posição em texto apagado ("14º de 14 no nicho", "11º de 14 no nicho (empate)"). Escala comprimida (raiz) quando 60% ou mais cai no primeiro quarto do eixo: o rótulo "escala √" fica sob a régua e a explicação, por linha, vai no ⓘ. Os números só dos dois (engajamento, duração, ritmo, vídeos acima de 2×) têm duas barras finas, uma por lado, com a letra à esquerda, no mesmo eixo; "menos de 3% da barra da outra" continua avisando.
- **Coluna "B em relação a A".** Símbolo antes da frase: ▲ na cor de quem é maior (e a frase diz de quem), ＝ nos praticamente iguais, ● na cor de quem publicou mais recentemente (linha dos dias), nada quando não há razão. "×" a partir de 2× ("3,7× a sua mediana de views"), percentual abaixo ("+32% sobre os seus inscritos", "−35% sobre o seu engajamento"); abaixo de metade, a frase antiga ("8,7% dos inscritos de Dale Philip"), mais clara que "−91%".
- **Não medido visível (A4).** Pastilha com a hachura violeta (a MESMA do gráfico de impressões, classe `.nm-h`) e "não medido", motivo numa segunda linha. Na régua, o lado sem dado não ganha traço e a linha diz de quem falta: "sem traço de tnFigueiredo: não medido".
- **A5, A6.** Os três cabeçalhos de grupo ganharam ícone de traço (barras, calendário, linha subindo; viewBox 16, traço 1,6, como os de `canal.js`) e 22 px de respiro acima (eram 14). O rodapé virou uma linha ("Maior não quer dizer melhor: são canais de tamanhos diferentes.", mais a contagem de "números de fora" quando houver) e o resto está no ⓘ do título, que reusa o popover de `faixa-numeros.js` (`FAIXA.dica`).
- **A7.** Cartão "Leitura da forja" no fim, classe `.forja.fj`. Concorrente × concorrente: botão "Pedir leitura desta comparação à forja", as três etapas (Na fila, Escrevendo, Pronta; simuladas em ~5 s, nada é enviado) e uma leitura de EXEMPLO de 4 frases montada dos números da tela ("Lucas Bigodinho tem 325 mil inscritos e Dale Philip tem 3,74 mi. A mediana de views … Isso descreve o que os números mostram agora; não diz por que a diferença existe."), marcada "exemplo" e "texto escrito para o mockup". Com o canal próprio: "ainda não disponível para o seu canal", botão tracejado e desabilitado e o porquê (igual a `video-proprio.html`). **"Leitura de comparação" é um pacote novo para a forja: NÃO existe no produto** (hoje há leitura de canal e de vídeo). O cartão diz isso na tela.
- **A8.** "Só o seu canal mede": os três números na cor do canal próprio (laranja) e a linha "3 cliques estimados em 140 impressões", em contagem, sem percentual.

**Gráfico de impressões (`impressoes.js`/`.css`; vale em `video-proprio.html` e `canal-proprio.html?painel=1`).** Dia com impressão: barra laranja `#FF8240` com o número em cima. Cliques: ponto `#38BDF8` (borda escura) na base da barra do dia, e a linha "cliques" sob o eixo, com rótulo e números na mesma cor. Zero medido: traço de 3 px em azul-ardósia `#7A8FA6`. Não medido: hachura violeta (listras `#A59BD6` sobre `#2A2640`), coluna inteira e também na faixa dos cliques. Legenda em uma linha, com a amostra de cada estado (quadrado, círculo, traço, hachura) e o texto. A coluna sob o mouse/foco ganha realce claro (`rgba(245,239,230,.09/.13)`). Os dados e o ⓘ não mudaram.

**Cabeçalho do canal (`canal.css`, bloco da rodada 11; vale em `canal.html` e `canal-proprio.html`).** Nome → faixa: 5 → 10 px; entre as células: padding lateral 14 → 20 px (o fio vertical não cola mais no número); faixa → "Sincronizado há…": 3 → 8 px; cabeçalho → abas: 6 → 14 px. Em ≤600 px o padding fica 14 px. **Medido em 1440×900 (`canal.html`):** cabeçalho 99 → 109 px; abas de 264 → 282; grade de capas (`#miolo`) começa em 350 → 368 px: **desceu 18 px** (limite de ~24). O espaçamento da faixa também vale na faixa de números de `video-proprio.html` (mesma classe), sem quebra de linha.

**`video-proprio.html`, restos da rodada 10 (D).** (1) Sob a tabela das réguas ficaram a legenda (uma linha, com amostras) e o aviso de pouco dado (uma frase); a explicação da escala comprimida foi para um ⓘ ao fim da legenda. (2) O terço de baixo deixou de ser creme: é amarelo `#F2C14E`, mantendo o ▼ (o creme `--text` fica só para o traço neutro da duração).

## Cores escolhidas e contraste (cálculo WCAG contra o cartão `#221E1A`)

| Uso | Hex | Contraste |
|---|---|---|
| Lado do canal próprio / barra de impressões | `#FF8240` (`--accent`, `--lado-o`) | 6,72:1 |
| Lado B (outro canal) | `#7CC8F8` (`--lado-b`, azul frio claro) | 9,04:1 |
| Lado A sem canal próprio (neutro-quente) | `#D9C08F` (`--lado-n`, areia) | 9,37:1 |
| "Não medido": texto, linhas da hachura | `#A59BD6` (`--nm`) | 6,51:1 (e 5,70:1 sobre o fundo `#2A2640` da hachura) |
| "Não medido": contorno da pastilha | `#7C72B5` (`--nm-line`) | 3,89:1 |
| Cliques | `#38BDF8` (`--im-cl`) | 7,73:1 |
| Zero medido | `#7A8FA6` (`--im-zero`) | 4,97:1 |
| Terço de baixo | `#F2C14E` (`--terco-baixo`) | 9,86:1 |
| Texto escuro dos chips ("Lado A", "A", "B") `#16130F` sobre laranja / azul / areia | | 7,51 / 10,12 / 10,48:1 |

Todos acima de 4,5:1 (texto) e 3:1 (marca gráfica) contra o cartão; **calculados por script, não medidos no navegador**. **Limite:** a luminância do laranja (0,376) e a do azul (0,524) pouco diferem (razão 1,35); quem separa os lados é o matiz, a letra e o filete, não a luminosidade. Escolhi o azul claro (e não `--ia` `#6EA8FE`, com luminância 0,385, igual à do laranja) justamente para abrir um pouco essa distância.

## De onde vem a posição no nicho

`canais-dados.js`, os 13 concorrentes lidos em 09/10 + `proprio` = **14 canais** (o segundo canal próprio, Thiago Figueiredo, com 3 inscritos e nenhum vídeo, fica fora; se ele é escolhido, entra no conjunto daquela tela e o "de 14" vira "de 15"). Campos: `inscritos`, `acomp`, `l90`, `med`, `vpd`, `vpm`. Canal sem o valor (views/dia do canal próprio e da Sonhe Alto) fica fora da régua e a linha diz "de 12". **1º = o maior.** Empate dito: `acomp` = 50 em cinco canais, "1º de 14 no nicho (empate)". Escala (60% no primeiro quarto → raiz), calculada por linha: **raiz** em inscritos, mediana de views, views/dia e views/dia por mil no par próprio × Leo Khev; **linear** em longos acompanhados e longos em 90 dias (confira no ⓘ de cada par, que lista as réguas comprimidas).

## Decisões minhas a confirmar

1. A cor segue o canal (laranja sempre é "seu", mesmo no lado B).
2. "Maior" a partir de 10% de diferença; "×" a partir de 2×, percentual abaixo, frase antiga abaixo de metade.
3. Posição em texto é "Nº de 14 no nicho" (não "percentil"): com 14 canais, percentil seria falsa precisão.
4. Pastilha "não medido" com o mesmo violeta em dois lugares (comparação e gráfico) e a hachura como forma; o violeta é distinto do azul de B em matiz, mas em deuteranopia os dois ficam azulados (a hachura e o texto resolvem).
5. Impressões em laranja `#FF8240` (a cor do "seu canal"), não âmbar: assim "só o seu canal mede" e o gráfico falam a mesma língua.
6. Terço de baixo em amarelo (lê como "avisando"). Se o dono achar alarmante, troque `--terco-baixo`.
7. Cabeçalho: +18 px na grade de capas.
8. Exemplo de leitura da forja com 4 frases, fabricado, montado dos números do par aberto.

## O que eu acho fraco

- **A comparação ficou mais densa:** cinco colunas, filete colorido em duas colunas de células, régua e chips. Em 3 segundos dá para ver quem é maior em quê pela Leitura rápida e pelos ▲; mas a tabela de 13 linhas com filetes laranja e azul contínuos é pesada (o filete vem do `border-left` de cada célula, interrompido só pelas linhas). Se parecer carnaval, o primeiro corte é tirar o filete das células e deixar só o cabeçalho colorido.
- **A régua do nicho em "longos acompanhados" mostra vários traços colados** (cinco canais com 50): leem como "muitos aqui", mas o tamanho do bolo só se vê pela posição escrita.
- **Sem dica de mouse/teclado na régua da comparação** (a do vídeo tem): é `role="img"` com a posição dos dois lados no `aria-label`. Quem quiser ver o nome dos outros canais precisa de um passo a mais.
- **Em deuteranopia o violeta de "não medido" e o azul do lado B se aproximam.** Distinguem-se pela hachura e pelo texto, não pela cor.
- **Leitura rápida longa quando o lado tem muitos itens** (a de Leo Khev tem 4 itens numa linha); em 390 px quebra em 5 linhas.
- **O símbolo "◌" (sem como comparar) renderiza como anel fino**, quase invisível no fundo escuro; o texto carrega o sentido.
- Contraste e o simulador de daltonismo: calculados e aproximados (filtro de matriz de Machado), não o simulador do DevTools.

## VERIFICADO no navegador × inferência

**Verificado (Chrome DevTools, 1440, 768, 390 e 320):** `comparar.html?a=proprio&b=leo-khev`, `?a=proprio&b=bald-and-bankrupt`, `?a=dale-philip&b=lucas-bigodinho`, `?a=proprio&b=proprio-2` e `?a=proprio&b=sonhe-alto-viagens` (só abertos); `video-proprio.html?id=S1iMQVIOFL4`, `?id=FHIgdLOzODE` (só carregado) e `?id=WDRy_uldCI8`; `canal-proprio.html?painel=1`; `canal.html`; `canais.html`. **Rolagem horizontal: nenhuma em 12 telas × 4 larguras (1440, 768, 390, 320: 48 combinações, `scrollWidth` ≤ largura, medido com iframes da largura certa).** Console sem erro em `comparar.html` (3 pares), `video-proprio.html` (`WDRy_uldCI8`), `canal-proprio.html`; os outros vídeos e `canal.html` só foram carregados (rolagem medida), sem ler o console. Inverter lados (cores trocam com os canais), ⓘ da tabela, ⓘ da legenda das réguas, simulação do cartão da forja (fila → escrevendo → pronta, texto de exemplo com números da tela), 390 px (A e B lado a lado na tabela, régua em largura total) e 768 px (mesma estrutura). **Daltonismo:** apliquei um filtro SVG de deuteranopia (matriz de Machado, severidade 1,0) por `evaluate_script`, porque o `emulate` desta sessão não tem simulação de visão; **resultado:** na comparação os lados continuam distinguíveis (A vira amarelo-oliva, B periwinkle; os chips "Lado A"/"Lado B" e as letras A/B nas réguas resolvem o resto), "não medido" se separa pela hachura; no gráfico impressão (oliva), cliques (azul, círculo) e zero (azul-ardósia, traço) separam-se por forma e posição, e a hachura aparece azulada, com a forma de listras.
**Inferência:** leitor de tela (`role="img"` e `aria-label` da régua, texto só para leitor nos símbolos); toque; o Opera do dono (não há `color-mix()` no CSS novo, só variáveis e literais); contraste (calculado).

## Como chegar (porta 8791)

| Tela | URL |
|---|---|
| Próprio × Leo Khev | `comparar.html?a=proprio&b=leo-khev` |
| Próprio × concorrente gigante (vários "não medido") | `comparar.html?a=proprio&b=bald-and-bankrupt` |
| Concorrente × concorrente (cor areia, forja com exemplo) | `comparar.html?a=dale-philip&b=lucas-bigodinho` |
| Canal próprio no lado B (laranja no B) | `comparar.html?a=leo-khev&b=proprio` |
| Gráfico de impressões | `video-proprio.html?id=S1iMQVIOFL4`, `canal-proprio.html?painel=1` |
| Terço de baixo amarelo | `video-proprio.html?id=WDRy_uldCI8` |
| Cabeçalho com mais respiro | `canal.html`, `canal-proprio.html` |

## Capturas da rodada 11 (`shots/`)

| Arquivo | Mostra |
|---|---|
| `r11-antes-1440-canal.png`, `r11-depois-1440-canal.png` | Cabeçalho do canal antes e depois (grade a 350 e 368 px) |
| `r11-1440-comparar-proprio-leo.png` | Tela inteira: Leitura rápida, cor por lado, régua, não medido, forja desabilitada |
| `r11-1440-comparar-proprio-gigante.png` | Próprio × bald and bankrupt, vários "não medido" |
| `r11-1440-comparar-concorrentes.png` | Areia × azul, cartão da forja com a leitura de exemplo pronta |
| `r11-390-comparar-tabela.png` | 390 px: Leitura rápida e a primeira linha com régua |
| `r11-1440-video-proprio-S1i.png` | Gráfico de impressões colorido, legenda, réguas, ⓘ |
| `r11-1440-video-sem-impressao-reguas.png` | Terço de baixo amarelo (▼) e duração neutra |
| `r11-1440-comparar-deuteranopia.png`, `r11-1440-grafico-deuteranopia.png` | Filtro de deuteranopia sobre a comparação e o gráfico |

## Não feito

Aba Trocas, visualizador, Histórico de concorrente, lista de Canais, dados novos (nenhum campo acrescentado), testes automatizados, commit.


# Rodada 12 (09/10/2026)

## O que o dono disse

1. Em produção, na tabela de Canais, a dica do "?" ao lado dos inscritos abre por baixo da linha seguinte: o texto fica cortado e misturado com o nome do canal de baixo. Ele quer a garantia de que isso não acontece em nenhuma tela. Toda dica e popover fica sempre acima do conteúdo e dentro da janela.
2. A lista de Canais de produção tem "Longos | Shorts" e não tem "os dois ao mesmo tempo". Pedido: "Todos | Longos | Shorts".
3. Os sete acabamentos da comparação (frases, zero em linguagem de gente, densidade, leitura rápida, dica na régua, empates, cor do "não medido") e dois restos (caixa "Dias em que apareceu", gráfico que repinta).

## A. Dicas e popovers sempre acima do conteúdo

### Inventário do que flutua (6 telas)

| Flutuante | Onde | Antes | Agora |
|---|---|---|---|
| ⓘ (`.ibtn` + `.pop.tip`), inclui "Todos os números" | canal, canal-proprio, video-proprio (faixa e legenda das réguas), comparar, **canais (novo: um por linha, no inscritos)** | filho do `body`, `z-index:40`, posição própria em cada arquivo (3 cópias do mesmo `posicionar`) | `FLUT.abrir` (`flut.js`), dentro de `#flut` |
| Menu "…" do vídeo e do canal | canal, canal-proprio | idem | idem |
| Menu "Meu canal" | todas | `position:absolute` dentro da trilha, `z-index:45` | portado para `#flut`, `position:fixed` calculada do gatilho |
| Dica da régua do vídeo | video-proprio | `fixed`, `z-index:60`, no `body` | `#flut` + `FLUT.posicionar` |
| **Dica da régua do nicho (nova, item C5)** | comparar | não existia | `#flut` |
| Dica do gráfico de impressões | canal-proprio (painel), video-proprio | `absolute` DENTRO do `figure` | portada para `#flut`, `fixed`, ao lado da coluna |
| Dica de marcador da linha do tempo (`#tip`) | video | `absolute` dentro do `#tlwrap`, `z-index:10` | portada para `#flut` |
| Lista de grupo da linha do tempo (`.gpop`) | video | `absolute` dentro da faixa, `z-index:21` | portada para `#flut` ao abrir, devolvida ao fechar (ver "fraco") |
| Aviso (toast) | canal, video | `fixed`, `z-index:50` | fora de `#flut`, na escala (`--z-aviso`) |
| Visualizador de thumbnail | canal, video-proprio, video | `z-index:100` | `--z-modal` |
| `title` nativo (Comparar com…, datas, abreviações) e `<select>` nativos | várias | o navegador/SO desenha, acima de tudo | não mexi; não foram substituídos por dica própria |
| `.mtip` (`canal.css`) | nenhuma tela | CSS morto, nenhum JS o usava | removido |

### A escala de camadas (um lugar só: `camadas.css`, carregado primeiro em todas as telas)

| Variável | Valor | Uso |
|---|---|---|
| `--z-fundo` | 0 | hachuras, linhas de grade |
| `--z-conteudo` | 1 | barras, traços, gráfico |
| `--z-marca` | 2 | traço deste vídeo, marcadores |
| `--z-marca-alta` | 3 | rótulo sobre a marca (letra A/B), botão de ampliar |
| `--z-marca-topo` | 4 | alvo clicável sobre as marcas |
| `--z-grudado` | 10 | barra presa (`.vbar`, `.ctl`, linha do canal no pé da lista) |
| `--z-flutuante` | 1000 | o contêiner `#flut` (todas as dicas, popovers e menus) |
| `--z-aviso` | 1100 | toast |
| `--z-modal` | 2000 | visualizador modal |

Nenhum CSS do mockup tem número de `z-index` (conferido por busca: só `camadas.css` tem números; hist.css tinha 20 ocorrências, canal.css 8, mais regua, impressoes, meu-canal, canais, viewer).

### Como funciona (`flut.js`, novo)

- `#flut`: contêiner único, filho direto do `<body>`, `position:fixed; inset:0; pointer-events:none; z-index:var(--z-flutuante)`. Nenhuma flutuante é filha de linha, cartão ou tabela, então `overflow`, `transform`, `contain` e `sticky` de ancestral não a prendem.
- `FLUT.posicionar(el, gatilho, opções)`: `position:fixed` calculada do retângulo do gatilho. Prefere embaixo, vira para cima quando não cabe, desloca-se na horizontal para não encostar na borda, largura máxima = janela − 16 px (em 390 ocupa a largura útil), e, se não couber nem em cima nem embaixo, ganha altura máxima com rolagem interna. Nunca cobre o gatilho.
- `FLUT.abrir`: uma por vez (abrir outra fecha a anterior); fecha com Esc (o foco volta ao gatilho), clique fora (`mousedown`) e perda de foco; reposiciona ao rolar (em qualquer contêiner) e ao redimensionar; fecha se o gatilho sai da janela. Dicas de mouse (régua, gráfico, linha do tempo) usam só `posicionar` e se escondem quando um popover abre.
- Três cópias do posicionamento (`canal.js`, `faixa-numeros.js`, `meu-canal.js` com CSS próprio) viraram uma.

### A prova (`prova-flutuantes.js`, conferência: nenhuma página a carrega)

Para cada flutuante e cada posição do gatilho (**centro da janela, colado embaixo, colado em cima**; "colado embaixo" é a última linha das tabelas, o caso em que não cabe embaixo), abre, espera e confere: (1) `document.elementsFromPoint` no centro e nos quatro cantos da caixa: o elemento do topo é a própria dica ou um filho; (2) a caixa está inteira dentro da janela; (3) mora em `#flut` e não cobre o gatilho; (4) Esc fecha e, nos popovers de clique, o foco volta ao gatilho. Uma vez por tela: clique fora fecha, e abrir um segundo fecha o primeiro. As dicas de mouse têm `pointer-events:none`; a prova as liga durante o teste.

**Controle negativo (VERIFICADO):** uma caixa `position:absolute` dentro de uma célula da última linha da lista, `z-index:40`, dentro de `.cn-tw` (`overflow-x:auto`), reprova (caixa em y=900..990, fora da janela; o topo no ponto era o `<th>` da tabela). A prova enxerga o defeito de produção.

| Tela | 1440×900 | 768 | 390 | Flutuantes (por posição: ×3) |
|---|---|---|---|---|
| `canais.html?n=70&fmt=todos` | 219/219 | 219/219 | 219/219 | 72 ⓘ do inscritos (cada linha, incluída a última) + "Meu canal"; umaPorVez e cliqueFora: ok |
| `canal.html?nums=1` | 24/24 | não rodado | 24/24 | ⓘ de "Todos os números", 6 menus "…" (amostra, o último incluído), "Meu canal" |
| `canal-proprio.html?painel=1&nums=1` | 33/33 | não rodado | 33/33 | idem + 3 dias do gráfico de impressões (primeiro, do meio, último) |
| `video-proprio.html?id=S1iMQVIOFL4` | 36/36 | 36/36 | 36/36 | 2 ⓘ, 6 réguas, 3 dias do gráfico, "Meu canal" |
| `comparar.html?a=proprio&b=leo-khev` | 24/24 | 24/24 | 24/24 | ⓘ da tabela, 6 réguas do nicho, "Meu canal" |
| `comparar.html?a=dale-philip&b=lucas-bigodinho` | 24/24 | não rodado | não rodado | idem |
| `video.html?id=7Cr3DLfUvW8` | 9/9 | não rodado | 9/9 | 2 marcadores da linha do tempo, "Meu canal" |
| **Total** | **369/369** | 279/279 | 345/345 | **123 flutuantes distintas no 1440** |

Total de checagens sem repetir telas: 369 (1440) + 279 (768) + 345 (390) = **993 de 993 aprovadas**. Esc fechou todas e devolveu o foco ao gatilho em todos os popovers de clique (`esc:true` em cada família). Sem rolagem horizontal da página: 9 telas × 4 larguras (1440, 768, 390, 320, medido com iframes da largura certa) mais 12 combinações de cartões em "Todos/Shorts/Longos": a varredura achou uma falha (cartões em "Todos" a 768, rótulo + número estourando 13 px) e ela foi corrigida; refeita, 0 falhas de 12. Console sem erro nem aviso em `canais.html` (Todos, Shorts, cartões), `comparar.html` (2 pares), `canal-proprio.html?painel=1`, `video.html`. (`canal.html` e `video-proprio.html` rodaram a prova sem erro de script, sem ler o console.)

Lista do grupo da linha do tempo: **sem prova real** (ver "o que eu acho fraco").

### Para o produto (item de aceite da fase A)

**Regra, em uma frase:** toda dica, popover e menu é renderizado num contêiner único no fim do `<body>`, com `position:fixed` calculada do gatilho (vira para cima quando não cabe embaixo, desloca-se na horizontal, largura máxima da janela menos 16 px, reposiciona ao rolar e ao redimensionar), acima de todo o conteúdo e abaixo só do modal.

**Causa provável do defeito de produção** (a conferir no código, que não li nem mexi): a dica do "?" é filha da célula da tabela. A tabela de Canais está num contêiner com `overflow-x:auto` (ou a linha tem `position`/`transform`/`contain`), que cria um contexto de empilhamento e de recorte: a dica nunca passa do contêiner, e as linhas seguintes, pintadas depois, ficam por cima dela. Subir o `z-index` não resolve; o ancestral é o problema. No mockup, o controle negativo reproduz exatamente isso.

**Itens de aceite sugeridos:**
1. Nenhuma dica, popover ou menu é descendente de `<td>`, `<tr>`, cartão ou qualquer elemento com `overflow`, `transform`, `filter`, `contain` ou `position:sticky`.
2. Escala de camadas em variáveis num arquivo só (`--z-conteudo`, `--z-grudado`, `--z-flutuante`, `--z-modal`); nenhum `z-index` numérico fora dele.
3. Script de conferência (o `prova-flutuantes.js` serve de modelo): para cada flutuante, na última linha da tabela e com a página rolada, `elementsFromPoint` no centro e nos quatro cantos devolve a própria dica, e a caixa está inteira na janela, em 1440 e 390 px.
4. Esc fecha e devolve o foco ao gatilho; clique fora e perda de foco fecham; uma aberta por vez.

## B. Lista de Canais: filtro de formato "Todos | Longos | Shorts" (`canais.html`, `canais.js`, `canais.css`, `canais-dados.js`)

- **Controle segmentado** ao lado da busca, no padrão `.seg` do mockup (`aria-pressed`, foco volta ao botão, a mudança é anunciada).
- **Longos / Shorts:** as colunas falam só daquele formato (títulos e unidades mudam: "Shorts em 90 dias", "mediana nos Shorts"); ordem e posição são do formato.
- **Todos:** cada célula numérica das cinco colunas que dependem de formato tem duas linhas rotuladas ("longos 79/dia" e "Shorts 310/dia" no mesmo formato da tela), **nunca uma mediana só**. Formato sem dado diz "sem Shorts" (sem rótulo na frente, a frase já diz) ou "não medido" / "aguarda o 2º registro" / "sem vídeos"; nunca 0. Inscritos, posição e a coluna "Com o meu canal" não mudam.
- **Ordenação em "Todos":** pelos longos, e o cabeçalho da coluna ordenada diz "ordenado pelos longos" na linha da unidade; a frase do topo e o aviso sob o controle dizem o mesmo.
- **URL e memória:** `?fmt=todos|longos|shorts` (sempre escrito) e `localStorage` (`pc:canais-fmt`) quando a URL não tem. **Padrão: Longos** (é o que a produção abre hoje). **Decisão a confirmar.**
- **Aviso na tela** (uma linha, em Todos e Shorts): "Mockup: Shorts dos concorrentes (menos Leo Khev) são de exemplo."
- **ⓘ por linha no inscritos (novo):** é o gatilho que a produção tem como "?"; serve de caso real para a prova da parte A ("De onde vem o número: contagem pública, arredondada pelo YouTube a três algarismos").
- **Medida, 1440×900, lista de 70 (72 linhas), linhas inteiras na dobra:**

| Estado | Linhas na dobra | Altura da linha |
|---|---|---|
| Hoje (Longos, antes da rodada) | 12 | 38,5 px |
| Longos (agora) | **12** | 39 px |
| Todos | **11** (−1; limite pedido: −2) | 37 a 39 px (nome em duas linhas: 39) |
| Shorts | **11** (−1, é a linha de aviso) | 39 px |

Para a tabela caber a 1440 sem rolagem interna em "Todos" (o primeiro desenho passava 97 px), o nome do canal pode quebrar em duas linhas, o padding vertical cai para 3 px e as unidades dos cabeçalhos ficam curtas ("longos e Shorts").
- **O que é fabricado:** os Shorts dos **12 concorrentes reais** (exceto Leo Khev) e dos **57 fictícios**, gerados em `canais-dados.js` por uma semente própria (`20261012`), a partir dos números de longos de cada canal (mediana de views ×0,4 a ×6; Shorts em 90 dias, acompanhados, views/dia ×0,5 a ×5); 18 de 70 ficam "sem Shorts" (`shorts: null`). Marcados `shortsFab: true`. **Reais:** Leo Khev (71 Shorts em `dados.js`: mediana 1.398 views, 1 Short em 90 dias, 16 com contagem diária, views/dia mediana 0) e tnFigueiredo (0 Shorts nos 35 vídeos: "sem Shorts"). Os números de longos e dos fictícios da rodada 7 não mudaram.
- **Não feito:** a coluna Ritmo de produção (e por isso o formato "0,9/sem" do brief não aparece): a lista do mockup não tem Ritmo desde a rodada 7; derivá-lo de "longos em 90 dias" só repetiria a coluna.

## C. Comparação (`comparar.html`)

1. **Frases da relação.** Sempre "Quem: quanto", nomeando o MAIOR, sem sinal de menos e sem seta contrariando; ▲ na cor de quem é maior. A partir de 2×: "▲ Lucas Bigodinho: 5,0× os longos acompanhados de Dale Philip", "▲ Leo Khev: 3,7× a sua mediana de views dos longos". Abaixo de 2×: "▲ Você: +54% de engajamento", "▲ Leo Khev: +32% de inscritos" (o brief dava 1,6× no exemplo, mas a regra fechada é "×" só acima de 2×; usei a regra). Valor igual dentro de 10%: "praticamente igual". "Dias desde o último vídeo" não mudou. A "Leitura rápida" usa a mesma regra ("inscritos (+32%)").
2. **Zero em linguagem de gente**, por linha: longos em 90 dias "você não publicou longos em 90 dias" (ou "Leo Khev não publicou…"); ritmo "você não publicou em 13 semanas"; vídeos acima de 2× "você não tem vídeo acima de 2× em 90 dias". Os dois em zero: "nenhum dos dois publicou longos em 90 dias" etc. (esse caminho só está no código; nenhum par dos testados tem os dois em zero). Sem essa linha especial, o texto genérico é "X tem 0".
3. **Densidade.** Sem o filete colorido de cada célula (`border-left` das células A e B). A cor do lado ficou nos cabeçalhos das colunas (sublinhado de 3 px + chip), nas marcas (réguas e barras), nos chips A/B e nos títulos dos blocos de baixo. Padding vertical da linha 8 → 7 px (inferência: ~26 px a menos em 13 linhas; não medi a altura total).
4. **Leitura rápida:** no máximo três itens por linha, os de maior diferença (contra zero primeiro), terminando em "e mais N": "Leo Khev é maior em: longos em 90 dias (2 contra 0), ritmo de publicação (0,2 por semana contra 0), mediana de views (3,7×) e mais 2." O ◌ virou a pastilha de hachura do "não medido" (`.nm-h`), que aparece no fundo escuro. "Praticamente iguais" também corta em três.
5. **Régua do nicho com dica:** igual à do vídeo próprio. Uma parada de Tab por régua (o foco cai no lado A, ou no primeiro destacado), setas/Home/End andam de canal em canal pelo valor, a dica diz o nome e o valor (para um lado destacado, "Leo Khev · lado B" e o valor embaixo), Esc fecha; mouse mostra o traço mais perto do ponteiro; toque mostra a dica no toque. Cada passo é falado numa região `aria-live`. A dica segue a regra A (está em `#flut`; 18/18 na prova).
6. **Empates colados:** valores idênticos sem lado destacado **empilham na vertical** (um bloco de 3 px por canal, passo de 5 px; 5 canais = coluna de 23 px, dá para contar). Empate com um lado destacado mantém o traço alto no valor exato e abre os outros 2,6 px para os lados (não dá para empilhar sob um traço de 24 px). A dica diz "5 canais com 50" e lista os nomes (com o teclado: o nome do canal, o valor e "· 5 canais com 50"). Exemplo verificado: "Longos acompanhados" em `proprio × leo-khev`: pilha de 5 em 50 e de 2 em 49. **VERIFICADO.**
7. **Violeta do "não medido" × azul do lado B:** troquei o matiz do "não medido" de violeta para **malva-rosado**: texto `#E59CC0` (contra o cartão 7,76:1; contra o fundo da hachura 6,77:1), fundo da hachura `#3A2232`, contorno `#B0678F` (4,09:1, marca gráfica ≥ 3:1); a hachura é a mesma e o gráfico de impressões herda (mesmas variáveis `--nm`). Simulação de deuteranopia (matriz de Machado, severidade 1, por script de ΔE em Lab, e filtro SVG sobre a tela): ΔE entre "não medido" e o lado B **10 → 29**; contra o laranja 63; contra a areia 33; contra o azul dos cliques 39; contra o ardósia do zero medido 20 (também separados pela forma). Captura: `r12-1440-comparar-deuteranopia.png` (A vira oliva, B vira azul-pervinca, o "não medido" vira cinza com hachura). **Decisão a confirmar:** a cor.

## D. Restos menores

1. `video-proprio.html`: a caixa "Dias em que apareceu" saiu; "Este vídeo no canal" ocupa a largura inteira (1176 px a 1440). "Ver como tabela" do gráfico de impressões já tinha os mesmos dados e mais: dia, impressões, cliques estimados e estado do relatório, **os 29 dias** (a caixa só listava os com impressão). Conferido no navegador (29 linhas, estados "com impressões", "relatório veio vazio", "ainda não baixado: não medido").
2. Gráfico de impressões: repinta quando a janela muda de largura ou o aparelho gira (`resize` com 120 ms de espera e `orientationchange`); preserva "Ver como tabela" aberto; a dica antiga não fica órfã. **VERIFICADO:** 1440 → 700 → 400 px na mesma página: o desenho passou de 860 para 634 e para 334 de largura, 1 dica em `#flut` o tempo todo. Rotação em aparelho: não testada.

## Decisões minhas a confirmar

1. Padrão do filtro: **Longos**.
2. ⓘ por linha no inscritos da lista de Canais (72 paradas de Tab; a produção tem o "?" por linha também).
3. "Todos" mostra o rótulo "longos" e "Shorts" em todas as células (repetitivo, mas é o que impede ler errado qual é qual); o nome do canal pode quebrar em duas linhas.
4. Cor do "não medido": malva-rosado em vez de violeta.
5. "×" só a partir de 2× (não o 1,6× do exemplo do brief); o "+N%" abaixo.
6. Empate com lado destacado abre 2,6 px em vez de empilhar.
7. A lista do grupo (`.gpop`) foi portada para `#flut` sem poder ser exercitada com os dados do mockup.

## O que eu acho fraco

- **A lista de grupo da linha do tempo (`video.html`) não foi exercitada de verdade.** Nenhum vídeo dos dados tem trocas suficientes para formar grupo (máximo 2 por vídeo). Portei o código (a lista vai para `#flut` ao abrir e volta à faixa ao fechar; cliques, foco e Esc religados) e testei só a geometria com um grupo de mentira montado à mão (3 posições, passou), não o fluxo real. Se um dado futuro formar grupo, rode a prova primeiro.
- **"Todos" é denso:** 66 rótulos "longos"/"Shorts" na dobra, nome do canal quebrando em duas linhas, e a tabela só cabe a 1440 sem rolagem interna porque apertei o espaço. A 768 e menos continua com rolagem interna da tabela (a página não rola).
- **Os Shorts de 69 canais são inventados;** quem abrir "Shorts" ou "Todos" vê números plausíveis. A tela avisa em uma linha, mas é uma linha de rodapé de controle.
- **72 paradas de Tab** pelo ⓘ do inscritos na lista; a produção tem o mesmo problema, mas aqui ele ficou visível.
- **Frases de relação com substantivo comprido:** "+32% de mediana de views dos longos" e "Lucas Bigodinho: 65× as views por dia por mil inscritos de Dale Philip" leem pesadas.
- **"publicação mais recente" como item da Leitura rápida** ("é maior em: … publicação mais recente") é um uso largo de "maior".
- **Teste a 768 só em 3 telas** (canais, comparar leo, video-proprio); a prova de comparar (dale × lucas) só a 1440.
- O ΔE e a simulação de deuteranopia usam a matriz de Machado, não o simulador do DevTools; leitor de tela e toque real não foram testados.

## VERIFICADO no navegador × inferência

**Verificado (Chrome DevTools, 1440×900, 768×1024, 390×844 mobile com toque, e iframes de 320):** a prova (993 checagens, 123 flutuantes distintas no 1440), o controle negativo, a lista em Longos, Todos e Shorts (linhas na dobra, ausência de rolagem), as 12 combinações de cartões, a pilha de empates e a dica "5 canais com 50", as frases novas em dois pares, a Leitura rápida com "e mais N", a hachura no lugar do ◌, a dica do marcador da linha do tempo em `#flut` com imagens, o repaint do gráfico em três larguras, 29 dias em "Ver como tabela", rolagem horizontal (9 telas × 4 larguras), console limpo nas telas listadas, a simulação de deuteranopia por filtro.
**Inferência:** a causa do defeito de produção; a lista do grupo; leitor de tela (`aria-live`, `role="group"` da régua do nicho, `aria-describedby` do ⓘ); dica por toque na régua do nicho (código escrito, não exercitado com toque real); `orientationchange`; o Opera do dono (sem `color-mix()` no CSS novo: só os comentários citam); contraste (calculado por script, não medido no navegador); a altura total da tabela de comparação depois do padding.

## Como chegar (porta 8791)

| Tela | URL |
|---|---|
| Lista em "Todos" (70 canais) | `canais.html?n=70&fmt=todos` |
| Lista em Shorts / Longos | `canais.html?n=70&fmt=shorts`, `canais.html?n=70&fmt=longos` |
| Cartões em Todos | `canais.html?ver=cartoes&fmt=todos` |
| Comparação com régua com dica, empates e frases | `comparar.html?a=proprio&b=leo-khev` |
| Comparação gigante (22.324×) e cor do "não medido" | `comparar.html?a=proprio&b=bald-and-bankrupt` |
| Concorrente × concorrente | `comparar.html?a=dale-philip&b=lucas-bigodinho` |
| Vídeo próprio sem a caixa "Dias" | `video-proprio.html?id=S1iMQVIOFL4` |
| Dica da linha do tempo | `video.html?id=7Cr3DLfUvW8` |
| Prova (cole no console) | `s=document.createElement('script');s.src='prova-flutuantes.js';document.head.appendChild(s);s.onload=()=>PROVA.rodar().then(console.log)` |

## Capturas da rodada 12 (`shots/`)

| Arquivo | Mostra |
|---|---|
| `r12-1440-canais-todos.png` | Lista de 70 em "Todos": duas medidas rotuladas, "ordenado pelos longos", aviso de uma linha |
| `r12-1440-canais-dica-ultima-linha.png` | Dica aberta na ÚLTIMA linha da tabela: subiu e ficou inteira na janela |
| `r12-1440-comparar-regua-empate.png` | Dica "5 canais com 50" sobre a régua do nicho, pilha de empates, Leitura rápida com "e mais 2" |
| `r12-1440-comparar-deuteranopia.png` | Comparação sob filtro de deuteranopia: A oliva, B pervinca, "não medido" cinza com hachura |
| `r12-1440-video-proprio.png` | "Este vídeo no canal" em largura inteira, sem "Dias em que apareceu" |
| `r12-1440-hist-dica.png` | Dica do marcador da linha do tempo, em `#flut`, sobre o gráfico |
| `r12-390-canais-todos-cartoes.png` | 390 px: cartões em "Todos" |

## Arquivos novos e tocados

Novos: `camadas.css`, `flut.js`, `prova-flutuantes.js`. Tocados: `canais.html/js/css`, `canais-dados.js`, `comparar.js/css`, `regua.js/css`, `impressoes.js/css`, `faixa-numeros.js`, `meu-canal.js/css`, `canal.js/css`, `hist.css`, `video.js`, `viewer.css`, `video-proprio.js/html`, os 6 `.html` (camadas + flut + versão `?v=r12`). Nada em `apps/`. Nenhum commit.
