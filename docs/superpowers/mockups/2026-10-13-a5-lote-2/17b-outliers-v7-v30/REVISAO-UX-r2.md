# Revisão de UX, mockup 17b (Outliers por views aos 7 ou 30 dias, selo "ao vivo ou estreia"), rodada 2 (13/10/2026)

Revisor: `revisor-ux-senior`. Escopo: conferir se os 2 bloqueios e as 6 correções da r1 (`REVISAO-UX-r1.md`) foram resolvidos e se o ajuste criou defeito novo. Li `PLANO.md`, `NOTAS.md`, `q.js`, `q.css`, `index.html` e abri as capturas de `shots/`. Medi de novo, por conta própria, num Chromium headless sobre servidor estático meu (portas 47741 a 47747, derrubado ao fim; nada na 3099, nenhum spec do projeto): 9 estados x 1440/390 x escuro/claro (36 cruzamentos), Tab real em 4 estados, contraste por cálculo sobre o estilo computado, escala de cinza e o ⓘ aberto a 390. Nada foi editado fora deste arquivo; minhas capturas ficaram no scratchpad da sessão.

## Resumo

**Veredito da tela: PRONTO PARA O DONO. 0 bloqueios, 0 correções pendentes, 7 melhorias (nenhuma impede).**

Cada item da r1 foi conferido contra a tela, não contra a NOTAS:

| Item r1 | Resultado r2 | Evidência |
|---|---|---|
| B1 texto invade a coluna ao lado | Resolvido | "sem views por dia recentes" agora quebra em duas linhas dentro da célula (`padrao-1440-escuro.png`, grupo "Sem ritmo medido", última linha). Medi todo filho de célula contra a borda da célula: 0 transbordos em 36 cruzamentos (r1: 60 px em 4 estados). "41,0 mil/dia" do `extremo` tem folga (`ex-1440`). |
| B2 botões eram `<span>` | Resolvido | `span.btn`/`div.btn` na tela: 0 em todos os estados. Tab a 1440 para em "Voltar ao multiplicador (padrão)", "Tentar de novo" e nos 3 do vazio, todos com anel sólido de 2 px (`rgb(255,130,64)`). A 390: 225x44, 328x44, 171x44, 138x44, 196x44. O botão de `nao-medido` deixou de ser laranja cheio (`.btn` comum, contraste do texto 14,48 / 15,76); a frase "Nenhum dos 11 outliers..." é o que domina. |
| C1 singular | Resolvido | `zero` e `extremo`: "13 de 14 outliers já têm essa medida (2 com zero medido); **o outro 1 fica** no fim". |
| C2 aviso espremido a 390 | Resolvido | `erro-390-claro`: ícone e texto em cima, botão de 328x44 embaixo; texto em 4 linhas. |
| C3 "mediana" | Resolvido | 0 ocorrências de "median" no texto visível em todos os estados; 1 no ⓘ, como declarado. |
| C4 texto repetido no vazio | Resolvido | `vazio-390-a`: frase de topo + título + uma linha; o motivo ("nenhum passa de 2x") aparece só no topo. |
| C5 "Só leitura" com ✓ | Resolvido | cadeado, e a linha diz o que significa. O estado segue candidato a sair (dúvida 4 do dono). |
| C6 faixa abaixo da dobra a 390 | Atendido no mínimo pedido | faixa a 803 px (padrao) a 882 px (leitura), contra 904 px na r1; ordem frase, faixa, selo, lista. A dobra é 844 px e o cabeçalho de 700 px é do lote 1, declarado. |
| M1 a M4, M6 a M9 | Feitos ou anotados | trilho com borda, traço na régua do tempo, estrela de 6 pontas (lê como estrela, não como "+"), erro sem sopa vermelha. M5 não feito, de propósito (conselho ao implementador). |

Onde a tela acerta (e o dono vai ver de relance): a faixa de cobertura responde "quantos entram na conta" sem ler nada (3 de 11 e 0 de 11 aos 30 dias); em escala de cinza, medido (casa clara cheia), zero medido (caixa vazada com 0) e não medido (hachura escura) continuam três coisas distintas (`cz-zero-1440`); "zero medido" e "não medido" nunca se confundem em tela nenhuma; o erro tem forma própria (triângulo e "não carregou"); nenhuma cor de direção foi usada para ordenar.

## Pergunta do usuário e resposta de relance

Pergunta: **"Se eu ordenar pelo que cada vídeo fez nos primeiros 7 ou 30 dias, quem aparece e quantos entram na conta?"**
Resposta em 3 segundos, a 1440 sem rolar: a frase ("3 de 11 outliers já têm essa medida; os outros 8 ficam no fim") e a faixa (3 casas claras, 8 hachuradas) estão a 512 e 602 px do topo, dentro da primeira tela de 900 px. A 390 a frase está a 743 px e a faixa a 803 a 882 px: a frase cabe na primeira tela, a faixa aparece com meia rolagem (por causa do cabeçalho do lote 1, que não é desta tela).

## Veredito por estado e por largura

| Estado | 1440 escuro | 390 claro |
|---|---|---|
| `padrao` | pronto | pronto |
| `v7` (o caso real de hoje) | pronto | pronto |
| `nao-medido` | pronto | pronto (M1 abaixo) |
| `futuro` | pronto | pronto |
| `extremo` | pronto | pronto |
| `zero` | pronto | pronto |
| `erro` | pronto (M2 abaixo) | pronto |
| `vazio` | pronto | pronto |
| `leitura` | pronto (candidato a sair) | pronto (M4 abaixo) |

Tema oposto (escuro a 390, claro a 1440): medi rolagem, transbordo, fonte menor que 12 px, contraste e alvo; olhei só as capturas do par obrigatório.

## Bloqueios

Nenhum.

## Correções pendentes

Nenhuma.

## Melhorias (não bloqueiam; ordenadas pelo que mais vale a pena)

- **M1. `nao-medido`: a nota repete a frase.** A frase de topo termina "Enquanto isso, a lista segue o multiplicador." e, 300 px abaixo, a nota diz "A lista abaixo está na ordem do multiplicador porque nenhum vídeo pode ser ordenado ainda." (`nm-1440-topo.png`, `nm-390-a.png`). Cortar a nota e deixar só o botão "Voltar ao multiplicador (padrão)", ou cortar a última frase da frase de topo.
- **M2. `erro`: frase de topo e aviso dizem o mesmo.** "As views aos 7 e aos 30 dias não carregaram agora." logo acima de "Não deu para carregar as views aos 7 e aos 30 dias." (`erro-1440-topo.png`). Tirar a segunda frase da frase de topo e deixar o aviso carregá-la.
- **M3. Selo solto da sua frase a 390.** Abaixo de 900 px o chip "ao vivo ou estreia" fica sozinho numa linha e o texto "2 vídeos ao vivo ou estreia ficaram fora do cálculo..." vai para a linha de baixo (`nm-390-a.png`, `ex-390.png`): o chip parece um filtro clicável (não é). Manter chip e texto na mesma linha com quebra, ou tirar o chip nessa linha e deixar só o texto com o ícone.
- **M4. `leitura` a 390: "Só leitura" quebra em duas linhas** ("Só" / "leitura", `le-390.png`). Dar `white-space: nowrap` ao rótulo ou largura ao bloco. Vale só se o estado ficar.
- **M5. Barras de colunas diferentes com o mesmo comprimento.** No `extremo` a 390, "1,2 mi" aos 7 dias e "3,2 mi" aos 30 dias têm barras do mesmo tamanho no mesmo cartão (cada coluna tem a sua escala, decisão 7 da NOTAS). Está declarado e o número está ao lado, mas é o ponto mais fácil de confundir o dono; considerar uma escala só para as duas colunas, ou a legenda "cada barra é contra o maior da coluna" dentro do ⓘ.
- **M6. Borda do botão comum com contraste de 1,4 a 1,7:1** (escuro 1,37/1,55; claro 1,49/1,69), herdada do `.btn` do lote 1. O rótulo tem 14,5:1, então o botão se identifica pelo texto; fica registrado como dívida do lote 1, não deste mockup.
- **M7. Trilho da barra de views: 1,37 a 1,69:1 contra a linha** (a r1 pedia 1,5). É referência decorativa; o preenchimento tem 13,28 (escuro) e 7,50 (claro). Subir um tom a borda se sobrar tempo.

## Tabela de medidas (rodada 2)

**Contraste de texto (WCAG, estilo computado, fundo composto pelas camadas pais; pior caso entre os estados e as larguras)**

| Elemento | Escuro | Claro | Exigido |
|---|---|---|---|
| Frase-resumo (15 px) | 15,61 | 15,09 | 4,5 |
| Linha do selo (12 px) | 15,61 | 15,09 | 4,5 |
| Número de views (15 px) | 13,82 | 14,21 | 4,5 |
| "não medido" (12 px) | 7,76 | 7,09 | 4,5 |
| motivo do não medido (12 px) | 6,18 | 6,83 | 4,5 |
| "zero medido" (12 px) | 5,90 | 6,43 | 4,5 |
| contagem da faixa (13 px) / motivos (12,5) / legenda | 6,18 | 6,43 a 7,13 | 4,5 |
| cabeçalho da tabela (12,5 px) | 6,18 | 6,83 | 4,5 |
| multiplicador: médio / alto / topo (16 px) | 7,73 / 6,08 / 5,34 | 5,32 / 6,37 / 4,91 | 4,5 (texto grande 3) |
| aviso de erro (14 px) | 13,83 | 13,28 | 4,5 |
| botão comum / botão principal (13 px) | 14,48 / 7,51 | 15,76 / 5,01 | 4,5 |
| nota "lista na ordem do multiplicador" | 6,67 | 6,83 | 4,5 |
| texto do vazio (14 px) | 6,18 | 7,13 | 4,5 |

Menor texto da tela: 12 px (nenhum abaixo, em 36 cruzamentos). O tier "abaixo de 2x" não aparece em nenhum estado (por definição todo outlier passa de 2x), então não foi medido.

**Contraste de elemento gráfico**

| Elemento | Escuro | Claro | Exigido |
|---|---|---|---|
| casa medida (areia) / barra medida | 11,88 / 13,28 | 8,32 / 7,50 | 3 |
| casa e célula de zero medido (borda 2 px) | 4,97 / 4,75 | 4,84 / 4,36 | 3 |
| casa e ícone de não medido (borda 1 px) | 4,09 | 4,57 (4,12 no vazio/erro) | 3 |
| aviso de erro (borda e triângulo) | 6,03 | 5,90 | 3 |
| seletor / selo / ⓘ | 5,24 / 5,24 / 6,18 | 5,35 / 5,35 / 7,13 | 3 |
| trilho da barra contra a linha | 1,37 a 1,55 | 1,59 a 1,69 | decorativo (M7) |
| borda do botão comum | 1,37 a 1,55 | 1,49 a 1,69 | ver M6 |

**Alvos de toque (390 px, ponteiro grosso)**

| Controle | Medida | Resultado |
|---|---|---|
| Seletor "Ordenar por" | 277x44 | ok |
| ⓘ | 44x44 | ok |
| Voltar ao multiplicador (padrão), `nao-medido` | 225x44 (r1: 229x34) | ok |
| Tentar de novo, `erro` | 328x44 | ok |
| Voltar ao multiplicador / Ver vídeos longos / Ampliar a idade, `vazio` | 171x44 / 138x44 / 196x44 | ok |
| Links de ação por linha | 44x44 (do `medidas.json` do autor, conferido por amostra) | ok |

A 1440 (ponteiro fino) o seletor e os botões da tela medem 36 px (o botão do vazio, 44); aceito, como na r1.

**Teclado e foco (1440)**: Tab percorre o botão de estados do mockup, o seletor, o ⓘ (onde existe), o botão de ação do estado e depois os dois links de cada linha; anel de 2 px sólido `--accent` em todos. Esc fecha o ⓘ e devolve o foco ao botão. A 390 o ⓘ abre dentro da tela (12 a 378 px de largura, 600 px de altura, sem rolagem interna).

**Rolagem horizontal e transbordo**: 0 px de rolagem horizontal em 36 cruzamentos; 0 elementos da tela além da borda da janela; 0 filhos de célula além da borda da célula.

**Alturas e posições**

| Medida | Valor |
|---|---|
| Altura de linha da tabela, 1440 | 79 a 105 px (`extremo`: 119) |
| Altura de cartão a 390 | 270 a 336 px |
| Página, 1440 / 390 (`v7`) | 2.147 / 5.052 px |
| Frase-resumo, topo, 1440 / 390 | 512 / 743 px (761 nos estados de exemplo) |
| Faixa de cobertura, topo, 1440 / 390 | 579 a 648 / 803 a 882 px |
| Aviso de erro a 390 | parágrafo em 4 linhas, botão 328x44 embaixo |

## Regras do dono, uma por uma

| Regra | Resultado |
|---|---|
| Frase-resumo no topo | ok; singular e plural certos (`zero`, `extremo`) |
| Régua ou barra para comparar de relance | ok (faixa de cobertura, barra do número, régua do tempo) |
| Cor estável, inclusive "não medido" | ok (hachura rosa só para não medido; areia vale "medido", e a NOTAS anota que ela também marca o selo) |
| Símbolo junto da cor | ok (forma por casa, triângulo no erro, ícone no selo, formas por faixa de multiplicador) |
| Método no ⓘ, não em prosa | ok (ⓘ único; "mediana" só lá) |
| Zero medido distinto de não medido | ok em toda parte, inclusive em cinza |
| Sem bloco monocromático nem parágrafo de prosa | ok (M1 e M2 apontam duas frases repetidas, não prosa) |
| Sem jargão | ok |
| Sem `color-mix()` | ok (`grep`: só comentários que dizem "sem color-mix") |
| Escuro a 1440, claro a 390 | ok |
| Alvo de 44x44 | ok a 390 em todos os controles medidos |
| Foco visível | ok, inclusive nos 6 botões que eram `span` |
| aria | ok: faixa e régua com `role="img"` e texto por extenso, `aria-sort` na coluna ordenada, `label` no seletor, `aria-label` em zero, não medido e erro |

## Coerência com o lote 1 e com o spec

Tokens, hachura rosa, caixa vazada do zero, "+ novo" tracejado, ⓘ do método e linha "exemplo" são os do lote 1; nenhum matiz novo. Spec 6.2 e regra (b) (ao vivo e estreia ficam fora das medianas e a tela diz quantos) cumpridos: a linha do selo diz 2 (3 nos estados de exemplo) e a lista traz o selo e "não conta no normal do canal". O padrão continua sendo o multiplicador. A ordem frase, faixa, selo a 390 e selo, faixa a 1440 é uma diferença declarada (C6).

## O que não consegui verificar

- Leitor de tela (VoiceOver, NVDA): `aria-label` lidos no código, não ouvidos.
- Safari e Opera (o navegador do dono): só Chromium. O CSS não usa `color-mix()`, que era o risco conhecido no Opera.
- Os estados `futuro` e `leitura` a 1440, e o tema oposto ao obrigatório: só medi, não olhei captura por captura.
- Movimento reduzido, impressão e zoom de 200%.
- A hachura sobre o fundo: o contraste das bordas foi medido, o das listras não (são decorativas; a borda e a palavra "não medido" carregam o significado).
