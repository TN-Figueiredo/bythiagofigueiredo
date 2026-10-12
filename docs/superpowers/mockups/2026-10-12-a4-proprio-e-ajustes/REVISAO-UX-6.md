# Revisão de UX 6: c2-trocas.html depois do AJUSTES-UX-6 (12/10)

Revisor: revisor-ux-senior. Não editei nada. Medi uma CÓPIA da pasta (scratchpad `c2-rev6/`), porque outro agente mexia em `a4.css`, `a4-comum.js` e `video.*`. Chromium via Playwright sobre `file://`, fontes do Google carregadas. Capturas em `ux-revisao-6-shots/` (1440, 1280, 390; escuro e claro; `?canal=` dos 7; `?painel=0`; `?novo=0`). Lidos: REVISAO-UX-5, PLANO-UX-6, AJUSTES-UX-6, `c2-trocas.js` e, no código de produção, `observatory-chrome.tsx`, `_chrome/view-model.ts`, `_chrome/chrome.css`, `_canais/channel-table.tsx`, `_canais/canais.css`, `youtube-shell.tsx`, `cms-sections.ts`.

## Veredito: PRONTO PARA O DONO

**Concordo que está bom o bastante.** Resolvi cada item da rodada anterior com medida própria; sobram 0 bloqueios, 0 "corrige" e 6 sugestões. Quatro pontos ficam declarados ao dono como discordância ou limite (seção "O que sobra para o dono ver").

Pergunta do usuário: "Estou na Lista de Canais de sempre, o que mudou nela e como cheguei até aqui?" Em 5 segundos, em 1440 e a partir do carregamento:
- (a) é a tela de sempre: **sim.** Menu YouTube, abas do YouTube (a ordem bate com `TABS` de `youtube-shell.tsx`), título e subtítulo `CHROME_TITLE`/`CHROME_SUBTITLE` literais, botões, faixa de frescor, abas Canais/Mudanças/Outliers/Insights, barra de nichos, ferramentas e a tabela com as colunas reais (Comparar e ⋯ incluídos; `drawer-open` esconde Crescimento e Sincronização, igual a `canais.css` linha 307).
- (b) o que é novo: **sim.** Tracejado verde-água com "+ novo", e a legenda dele está na faixa.
- (c) como cheguei: **sim.** Faixa fixa no topo, fora da barra recolhida.

Três coisas que seguram a qualidade do conjunto (todas sugestões, nenhuma bloqueia): a densidade (132-155 px por linha com acréscimo), o painel que, em 1280, empurra a coluna nova para fora da caixa, e o fechamento do diálogo que recarrega a página e perde o lugar.

## 1. Os 5 "corrige" e as 4 sugestões da REVISAO-UX-5

| # | Achado | Situação | Evidência (medida por mim) |
|---|---|---|---|
| 1 | "Como se chega" invisível | **Resolvido** | `.c2-faixa.checkVisibility() = true` nos 3 tamanhos, estado padrão, sem abrir nada. Altura 55 px (1440, 1280) e 87 px (390). Contraste 16,2:1 escuro e 14,2:1 claro. Texto: "menu YouTube, aba Competidores, aba Canais; clique num canal e o painel abre." Bate com a produção: a aba Competidores existe em `youtube-shell.tsx` e a barra de abas Canais está acesa. |
| 2 | Moldura e caminho não batem | **Resolvido** | Migalha, h1 e subtítulo inventado saíram. h2, subtítulo, os 3 botões + ⋯, frescor, abas, nichos conferem com `view-model.ts` (linhas 10-16) e `observatory-chrome.tsx`. No celular a faixa de abas rolável ao lado da barra de nichos copia `chrome.css` (linhas 120-121, 182-186). O menu lateral (Canais, Vídeos, A/B Lab, Desempenho, Competidores) tem a mesma estrutura de `cms-sections.ts` (hoje em inglês: Channels, Videos, A/B Lab, Performance, Competitors). |
| 3 | Colunas ausentes | **Resolvido** | "Com o meu canal" (Comparar sublinhado; "–" na linha própria, com o texto para leitor de tela de `channel-table.tsx` linha 60), coluna ⋯ e seta ▼ em Views/dia. Ordem das colunas igual à de produção. Cabeçalhos seguem inertes (declarado). |
| 4 | Linha infla (73 para 208-233 px) | **Resolvido em parte, e eu aceito** (ver seção 2) | 1440, painel aberto: Nômade 155, Dale/Vou/Paddy 132, Lucas 73, Leo 85, tnFigueiredo 107; soma 816 (era 1.086). Bate com o que o desenhista declarou. Sem a marca: 144 e 121. |
| 5 | Linha realçada fora da dobra | **Resolvido** | Os 7 canais em 1440: a linha do canal aberto está inteira na vista ao carregar (Leo, a 6ª, também). Painel `sticky`: em 1440 ele fica em y=0 durante a rolagem (medido com scrollY 561: top -40 só porque chegou ao fim da página). Em 390 o painel passou a diálogo e a lista começa sem painel; não há mais "linha fora da vista" nem painel a 4.500 px. |
| 6 | 390: painel a 4.500 px, marca só no 1º cartão | **Resolvido** | Documento de 3.596 px (era ~4.500 + cartões longos). Cartões em grade de 2 colunas, 343-468 px cada. "+ novo" em todo cartão e todo bloco do painel (captura `nomade-390-escuro-full.png`). Toque num cartão abre o diálogo (medido: `painel=1&canal=paddy`, `dialog.open = true`). |
| 7 | Verde-água x verde "subindo" | **Retirado** (ver seção 3) | |
| 8 | Tracejado com 4 sentidos | **Aceito sem mudança** | Cada sentido tem cor e rótulo próprios; o "+ novo" segura a leitura em cinza. A marca de "semana sem troca" é regra compartilhada. |
| 9 | Alvos de toque 390 | **Resolvido** | Medido em 390: X 44x44, abas do painel 82/87/68 x 44, botões do painel 130/135/201 x 44 (inclui "Ver comparação"), ⋯ 44x44, Comparar 59x44, nome do canal 82-103 x 44. Os botões do cabeçalho copiado têm 34x34 (e as abas do Observatório 40 px); são o chrome de produção, inertes no mockup, fora do acréscimo. |

## 2. Densidade: 132-155 px contra os 73 de produção

**Julgamento: aceitável para o dono avaliar a ideia. Não corte o "4 sem" nem o selo.**

Medidas:
- O corte pedido não ajudaria: "4 sem" está na MESMA linha das quatro marcas, então tirá-lo não reduz altura nenhuma. O selo "costuma trocar" custa 21 px e só existe em quem tem o hábito (1 de 5 linhas com acréscimo). Cortar o selo tiraria o sinal que o dono mais quer ver (hábito). Cortar o "4 sem" tiraria a única pista de que as 4 caixas são semanas.
- O que enche a linha é a célula que já existe (número + frase de 2 linhas = 73 px; produção), mais o bloco novo de ~59 px (3 linhas: texto, marcas, mais a margem do tracejado). Quem não tem troca de descrição continua em 73 px (Lucas) e o silêncio continua sendo informação.
- Custo medido na primeira dobra de 900 px: com painel aberto aparecem 2-3 linhas (produção, sem o acréscimo e com a mesma moldura: ~4). Mas 220 dos ~496 px que empurram a tabela para baixo são o cabeçalho REAL do Observatório (copiado do código), mais 55 da faixa e 33 da barra do mockup; nada disso é culpa do acréscimo. Com o painel fechado, 3 linhas na dobra e 116-139 px nas linhas com acréscimo.
- Soma das 7 linhas: 816 px com o acréscimo (73-85 sem; 107 a linha própria), contra ~560 sem ele. Com 20 canais, só os que trocam descrição inflam.
- Quando o dono reclamar, o corte certo é o do conteúdo, não dos rótulos: trocar o bloco de 3 linhas por UMA linha ("Descrição: 3 em 2 vídeos" + ponto de hábito), com as marcas no painel. Isso leva a linha para ~100 px. Pergunta a deixar ao dono: "vale 60 px a mais por canal que troca descrição, para ver as 4 semanas na lista?"

Resultado: densidade comprometida de forma proporcional ao valor, declarada, e não derruba a tela.

## 3. Resposta ao argumento do desenhista na sugestão 7 (verde-água x verde "subindo")

**Retiro o achado.** O argumento procede e agora tenho a captura que faltava: com o painel fechado em 1440 (`nomade-1440-escuro-fechado-dobra.png`) Crescimento e Trocas coexistem na mesma linha. O texto "▲ +1,8%" (verde, sem contorno, alinhado à direita) e o bloco tracejado com o rótulo "+ novo" (contorno, com texto) são formas muito diferentes e não se confundem. As luminâncias continuam quase iguais (verde #22C55E 0,411 e verde-água #5CC3B2 0,445 no escuro; 0,104 e 0,111 no claro), então em escala de cinza só a forma separa, e ela separa. Contraste do contorno medido de novo: 7,81:1 (linha normal) e 6,39:1 (linha realçada) no escuro; 6,12:1 e 5,35:1 no claro (mínimo 3:1). A convenção da pasta (verde-água = andaime) pesa mais que o ganho. Mantido como está.

## 4. Novidades desta rodada

- **Faixa "como se chega":** boa. Texto curto, sempre visível, a legenda da marca é a própria marca ("+ novo" com o mesmo contorno), muda com `?novo=0` ("tela como ficaria"). Sugestão A abaixo.
- **Cabeçalho, abas e nichos reproduzidos:** conferi contra o código (título, subtítulo, ordem das abas, nichos Todos/Viagem/IA, "Horários em São Paulo"). Não vi produção aberta (sem sessão). Sugestão B sobre o chrome em 390.
- **Painel fixo ≥1280 e `<dialog>` abaixo:** em 390 e 1100: `showModal()` ativo (`:modal`), foco chega ao diálogo ao abrir, Tab circula X > abas > corpo > (navegador) > X, ou seja, foco preso; Esc fecha. Falha de fidelidade, sugestão C: ao fechar, `close` faz `location.href`, a página recarrega no topo e o foco vai para o `body`; em 390 o dono volta ao topo da lista e perde o canal que abriu (Paddy está a ~2.000 px). Os botões do rodapé do painel ("Ver as trocas em Mudanças", "Abrir no YouTube", "Ver comparação") são `span`, não entram na ordem de Tab (andaime estático, declarado como "diálogo estático").
- **`?painel=0|1`:** funciona; padrão aberto em ≥1280, fechado abaixo; a linha "Painel do canal" aparece na barra recolhida.
- **Grade de cartões em 390:** boa, lê de relance (Canal, Ritmo|Views, Outliers|Crescimento, Trocas, Sincronização|Comparar). 343-468 px por cartão, 0 px de rolagem horizontal.
- **1280, tabela rola ~142 px dentro da caixa:** confirmado (136 px sem a marca). **Comparar e ⋯ ficam fora da vista (aceitável)**; o que NÃO é aceitável sem aviso é que o bloco novo (Trocas) também fica cortado: a borda direita do tracejado está em x=865 e a caixa termina em x=832 (33 px cortados; "Descrição: 3 em 2 víde…"). É o acréscimo, a coisa que o dono veio ver. A produção deve rolar de forma parecida (a tabela de `canais.css` tem `min-width` por coluna e `.drawer-open` só zera o da tabela), por isso não é falha de fidelidade, mas o aviso mora na barra recolhida. Sugestão D.
- Contraste de texto (12-14 px), escuro/claro: tag "+ novo" 6,42:1 / 9,27:1; texto secundário (muted) 6,2:1 a 5,1:1 na linha realçada, 6,2-7,1:1 na normal; selo "costuma trocar" 4,98:1 (escuro, linha realçada) e 5,82:1 (claro); legenda "números de exemplo" 5,24:1 e 5,35:1. Tudo acima de 4,5:1.

## 5. Achados (todos sugestão)

**A. [sugestão] Faixa:** acrescentar o "ou" que a produção tem: o menu lateral também tem "Competidores" e outro item "Canais" (a página do canal do YouTube, `/cms/youtube`). Quem lê "aba Canais" com o menu lateral à esquerda pode olhar o item errado. Conserto: "menu YouTube > Competidores > aba Canais".

**B. [sugestão] 390, cabeçalho:** a barra de nichos corta "Mudanças" e esconde Outliers/Insights; as abas só aparecem rolando. É o `chrome.css` de produção (abas com `overflow-x:auto`), fiel, mas o dono vai ler como defeito do mockup. Conserto: nota de uma linha na barra recolhida ("em celular a produção rola as abas").

**C. [sugestão] Diálogo ao fechar:** recarrega e perde posição/foco (medido: `active = BODY`, URL `painel=0`). Conserto: fechar sem recarregar (`dlg.close()` sem `location.href`; atualizar a URL com `history.replaceState`) e devolver o foco à linha. Para o mockup basta declarar; em produção o foco deve voltar ao link do canal.

**D. [sugestão] 1280:** a ressalva "a tabela rola" e o corte do bloco novo estão só na barra recolhida. Conserto: uma linha na faixa ("em 1280 px a tabela rola; para ver a coluna Trocas inteira, 1440 px ou mais, ou Painel: Fechado") ou o roteiro do dono dizer isso. Eu coloquei no roteiro abaixo.

**E. [sugestão] `?canal=proprio` e `?canal=leo` em 1440** rolam a página ~500 px ao carregar (a linha do canal entra na vista pelo `scrollIntoView`), então o cabeçalho e a faixa saem de cena. Para o dono que abre pelo link, a primeira coisa que vê é a tabela sem moldura (`proprio-1440-escuro-dobra.png`). Conserto: rolar só se a linha estiver abaixo da dobra E manter a moldura visível (por exemplo, trazer a linha só se o canal for o 5º ou depois).

**F. [sugestão] Texto "4 sem":** "sem" é também "sem troca" (a legenda do painel diz "semana sem troca"). Na célula, "4 sem" ao lado de quatro caixas lê bem porque as outras colunas já usam "13 sem"; fica como está, mas se o dono tropeçar, trocar por "4 semanas" (cabe: a linha tem folga de ~60 px).

## O que sobra para o dono ver (discordâncias e limites declarados)

1. **Densidade:** o desenhista não atingiu os 110 px que pedi (132-155 px). Eu aceito, com a medida acima; o dono decide se 60 px a mais por canal que troca descrição vale as 4 semanas na lista.
2. **1280 px:** o bloco novo fica parcialmente cortado e Comparar/⋯ fora da vista; vale para produção também (não conferi aberta). Avaliar em 1440 ou mais.
3. **Números e nomes de canais são de exemplo;** o chip "números de exemplo" cobre isso. Botões da forja e menus do cabeçalho não estão (declarado).
4. **Sugestão 7:** desacordo encerrado; eu retirei. Não há mais discordância aberta com o desenhista, exceto a meta de 110 px (item 1).

## Roteiro de 30 segundos para o dono

1. Abra `c2-trocas.html` em tela de 1440 px ou mais, sem mexer em nada. Leia a faixa do topo: ela diz o caminho (menu YouTube, aba Competidores, aba Canais) e o que é a marca "+ novo".
2. Abaixo dela é a tela de sempre: título "Observatório de Competidores", abas Canais/Mudanças/Outliers/Insights, nichos, a lista com Ritmo, Views/dia, Outliers, Trocas, Comparar, ⋯.
3. Procure os contornos tracejados verde-água com "+ novo": só eles são novos (a linha "Descrição: 3 em 2 vídeos" com as 4 semanas na coluna Trocas; o resumo e os cartões violeta no painel).
4. Clique em outra linha (Paddy, "5 no mesmo vídeo"): o painel ao lado acompanha e a linha fica realçada. Na barra do topo (clique em "Estados do mockup") escolha "Marca de novo: Desligada" para ver a tela como ficaria, ou "Painel do canal: Fechado" para ver a lista toda.
5. Pergunta a responder: "esse acréscimo cabe na lista que eu uso todo dia sem atrapalhar a leitura?" (cada linha com troca de descrição cresce de 73 para 121-155 px.) No celular (390), toque num cartão: o painel abre por cima.

## Tabela de medidas

| Item | Escuro | Claro | Mínimo | Resultado |
|---|---|---|---|---|
| Contorno "novo" vs linha normal / realçada | 7,81 / 6,39:1 | 6,12 / 5,35:1 | 3:1 | passa |
| Texto "+ novo" (12 px) | 6,42:1 | 9,27:1 | 4,5:1 | passa |
| Faixa "como se chega" (12,5 px) | 16,2:1 | 14,2:1 | 4,5:1 | passa |
| Texto secundário na linha realçada / normal | 5,06 / 6,18:1 | 6,23 / 7,13:1 | 4,5:1 | passa |
| Selo "costuma trocar" na linha realçada | 4,98:1 | 5,82:1 | 4,5:1 | passa (margem curta no escuro) |
| Luminância verde-água / verde "subindo" | 0,445 / 0,411 | 0,111 / 0,104 | | só a forma separa; basta |
| Altura de linha, 1440 painel aberto | 155 / 73 / 132 / 132 / 132 / 85 / 107 | igual | | soma 816 |
| Altura de linha, 1440 painel fechado | 139 / 66 / 116 / 116 / 132 / 66 / 83 | | | |
| Altura de linha, 390 (cartão) | 468 / 386 / 445 / 445 / 445 / 386 / 343 | | | documento 3.596 px |
| Início da tabela (1440 / 390) | y=496 / y=559 | | | cabeçalho real + faixa |
| Linhas inteiras na dobra de 900 px, painel aberto | 2-3 | | | |
| Faixa fixa (altura) | 55 px (1440, 1280); 87 px (390) | | | visível |
| Rolagem da tabela dentro da caixa | 1440: 0; 1280 aberto: 142; 1280 fechado: 0; 1100 fechado: 0 | | | 1280 declarado |
| Corte do bloco novo em 1280 aberto | 33 px | | | sugestão D |
| `scrollWidth` vs `innerWidth` | 390, 1100, 1280, 1440 iguais | iguais | | passa |
| Alvos 390 (X, abas, botões, ⋯, Comparar, nome) | 44 px de altura | | 44 | passa |
| Foco visível | 2 px sólido (#FF8240) | | | passa |
| Console | sem erro de página | | | passa |
| Diálogo | `:modal` sim, foco preso, Esc fecha; foco volta ao `body` | | | sugestão C |

## Não verifiquei

- Produção aberta num navegador (sem sessão): fidelidade conferida só pelo código e por mockups aprovados; larguras exatas e o comportamento da tabela em 1280 na produção não comparados.
- Leitor de tela (VoiceOver/NVDA); Safari e Firefox (só Chromium); toque em aparelho real (usei `hasTouch` e `tap`).
- Larguras entre 700 e 1279 além de 1100 (modal e tabela); 860 a 1100 só pelo CSS.
- Escala de cinza: calculei luminâncias, não gerei captura em cinza desta versão (a anterior, `ux-revisao-5-shots`, continua valendo para a marca).
- Tema claro nos 7 canais: medi Nômade e Leo (1440 e 1280) e vi Paddy (390); os demais só escuro.
- `prefers-reduced-motion`: a tela não tem animação própria (0 regras); a barra e o painel não se movem.
