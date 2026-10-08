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
