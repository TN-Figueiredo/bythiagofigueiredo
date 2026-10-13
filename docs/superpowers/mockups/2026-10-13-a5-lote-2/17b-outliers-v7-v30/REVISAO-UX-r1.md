# Revisão de UX, mockup 17b (Outliers por views aos 7 ou 30 dias, selo "ao vivo ou estreia"), rodada 1 (13/10/2026)

Revisor: `revisor-ux-senior`. Escopo: `PLANO.md`, `NOTAS.md`, `index.html`, `q.css`, `q.js`, `q-dados.js` e as 18 capturas de `shots/`, contra o spec (04, linhas 9, 13, 14, 86 e 158) e `CONVENCOES.md`. Medi no navegador (Chromium headless sobre servidor estático próprio nas portas 47731 a 47735, derrubado ao fim), em 1440 e 390 px, nos dois temas, nos estados `padrao`, `v7`, `nao-medido`, `zero`, `erro`, `vazio` e `extremo`; `futuro` e `leitura` julguei pelas capturas. Nada foi editado fora deste arquivo.

## Resumo

**Veredito da tela: VOLTA PARA AJUSTE (não vai ao dono). 2 bloqueios, 6 correções, 9 melhorias.**

| Estado | 1440 escuro | 390 claro |
|---|---|---|
| `padrao` | volta para ajuste (B1) | volta para ajuste (B2 no que couber; sem B1) |
| `v7` (o caso real de hoje) | volta para ajuste (B1) | pronto no desenho, sujeito a C1 |
| `nao-medido` | volta para ajuste (B1, B2) | volta para ajuste (B2: botão de 34 px) |
| `futuro` | pronto no desenho, sujeito a C3 | pronto no desenho |
| `extremo` | pronto no desenho (melhoria M3) | pronto no desenho |
| `zero` | volta para ajuste (C1 na frase) | volta para ajuste (C1) |
| `erro` | volta para ajuste (B1, B2) | volta para ajuste (C2: aviso espremido, B2) |
| `vazio` | volta para ajuste (B2, C4) | volta para ajuste (B2, C4) |
| `leitura` | volta para ajuste (B1, M7) | idem |

Onde o desenho acerta (e o dono vai gostar de ver): a faixa de cobertura responde sozinha a "quantos entram na conta" (3 de 11 e 0 de 11 lidos em um olhar, e a escala de cinza preserva as três formas: casa cheia clara, caixa vazada com 0, hachura escura); zero medido e não medido nunca se confundem; o seletor diz quantos têm a medida antes do clique; o multiplicador continua sendo o padrão; a lista não perde vídeo; o erro tem forma própria ("não carregou", triângulo, nunca "não medido"); `grep color-mix` só acha comentários; sem rolagem horizontal da página em nenhum dos 28 cruzamentos medidos; contraste de texto e de gráfico acima de 4,09:1 em tudo que importa.

**As três coisas que mais derrubam o conjunto**
1. Texto de uma célula invadindo a coluna ao lado ("sem views por dia recentes" por cima de "não medido / descoberto tarde"), em 4 dos 9 estados: é a primeira linha de erro que o dono vê.
2. Botões desenhados como `<span>`: o botão laranja de maior destaque da tela (`Voltar ao multiplicador (padrão)`), "Tentar de novo" e os três do vazio não recebem foco, não respondem ao teclado e o principal tem 34 px de altura a 390.
3. Frase-resumo errada no singular ("os outros 1 ficam no fim") e linha do selo com jargão ("medianas"): a frase de topo é o que o dono lê primeiro.

---

## Bloqueios (impedem ir ao dono)

### B1. Texto da coluna "Views por dia" invade a coluna "Views aos 7 dias" (padrao, v7, nao-medido, erro; 1440; também 1100 a 901)
- **O que está errado:** na linha "Dormi 24 horas na rodoviária de Bangkok" (id `a11`) o texto "sem views por dia recentes" passa 60 px da borda da célula e se escreve por cima do "não medido / descoberto tarde" (ou da pastilha "não carregou" no estado de erro). As duas leituras ficam ilegíveis, justamente na linha que mostra o motivo de não medido.
- **Evidência:** capturas `shots/v7-1440-escuro.png` (linha 8 da lista), `padrao-1440-escuro.png` (grupo "Sem ritmo medido"), `nao-medido-1440-escuro.png`, `erro-1440-escuro.png`. Medida: soma dos retângulos do texto da 3ª célula excede a largura da célula em 60 px (`overflowCelula: [{lin: a11, col: 2, excede: 60}]`), nos 4 estados, e o mesmo valor em 1100, 1000 e 920 px. Não acontece a 390 (cartão). Nos estados `zero`, `extremo` e `futuro` não aparece só porque esse vídeo não está na amostra.
- **Conserto:** na célula "views por dia" sem ritmo, quebrar em duas linhas ("sem views por dia" / "recentes") com largura máxima da coluna e `white-space: normal`, ou trocar o texto por "sem ritmo" (o grupo "Sem ritmo medido" já explica); e dar `overflow-wrap: anywhere` à célula.
- **Também aqui:** no estado `extremo` o texto "41,0 mil/dia" e "22,0 mil/dia" encosta na coluna ordenada (folga medida de 0 px). Dar 12 px de folga à direita da coluna "Views por dia" (`padding-right`), senão o próximo valor longo repete o problema.

### B2. Os botões de ação são `<span class="btn">`: sem foco, sem teclado, sem efeito; o principal tem 34 px a 390
- **O que está errado:** "Voltar ao multiplicador (padrão)" (estado `nao-medido`), "Tentar de novo" (`erro`) e "Voltar ao multiplicador", "Ver vídeos longos", "Ampliar a idade para Todos" (`vazio`) são `span`. Na ordem de Tab o foco pula direto do ⓘ para os links da primeira linha (testei 22 paradas: nenhum desses botões aparece), logo não há foco visível, não há `role`/`tabindex`, e o dono, ao clicar no botão laranja, não vê nada acontecer. O de `nao-medido` é o elemento de maior contraste da tela (laranja cheio, `--accent`), maior que a frase-resumo, e a 390 px mede 229 x 34 px (exigido: 44 x 44). O `medidas.json` não pegou por ser `span`.
- **Evidência:** `shots/nao-medido-390-claro.png` e `shots/nao-medido-1440-escuro.png` (botão laranja logo acima da tabela); medida a 390: `SPAN.btn pri [229, 34]`; `spanBtn` com `tabindex=null|role=null` nos 3 estados; Tab percorre `SUMMARY, SELECT, BUTTON.ibtn, A, A, A...` sem passar por eles.
- **Conserto:** trocar por `<button type="button" class="btn ...">` com foco global (`:focus-visible` já existe em `a4.css`), altura 44 px a 390 (o `.btn.big` já existe) e fazer "Voltar ao multiplicador" levar a `?ordem=mult` (o seletor já faz isso, `q.js` linha 235). "Tentar de novo" e os outros dois podem não fazer nada, mas precisam ser botões e anunciar isso na NOTAS. Rebaixar o laranja cheio do estado `nao-medido` a botão comum (sem `.pri`): a ação não deve ser mais forte que a frase "Nenhum dos 11 outliers tem views aos 30 dias ainda...", que é a resposta de relance desse estado.

---

## Correções (vão ao dono só depois de corrigidas)

### C1. "os outros 1 ficam no fim" (estados `zero` e `extremo`, todas as larguras)
- Frase-resumo de topo, singular errado. Evidência: `shots/zero-1440-escuro.png`, `shots/zero-390-claro.png`, `extremo-1440-escuro.png`; `q.js` linha 199 não flexiona.
- Conserto: "o outro 1 fica no fim" (singular), "os outros N ficam" (plural); mesma checagem para "1 outlier"/"N outliers" e "tem a medida"/"têm" se N = 1.

### C2. Aviso de erro espremido a 390 px (`erro`)
- O parágrafo do aviso mede 166 x 147 px (7 linhas) ao lado do botão "Tentar de novo": uma coluna de texto estreita, a frase "Não deu para carregar..." quebra a cada 3 palavras. Evidência: `shots/erro-390-claro.png`, quarta faixa do aviso; medida `banP [166, 147]`.
- Conserto: abaixo de 640 px empilhar (ícone e texto em cima, botão de 44 px de largura total embaixo).

### C3. "ao vivo ou estreia ficaram fora das medianas": palavra que o dono não usa
- Aparece em todos os estados na linha do selo e em toda linha com selo ("não entra nas medianas do canal"). A tela de hoje diz "o normal do canal" (frase do vazio e do grupo "Estourando agora"); "mediana" não é palavra da tela e vira "não entra nas medianas" repetida 1 vez por vídeo. É jargão estatístico, e a regra do dono é "frases sem jargão interno".
- Conserto: "2 vídeos ao vivo ou estreia ficaram fora do cálculo do normal do canal; um aparece na lista com o selo." e, na linha do vídeo, "não conta no normal do canal". Mediana fica só no ⓘ.

### C4. Texto repetido no estado `vazio`
- A frase de topo ("0 outliers entre 87 Shorts com até 30 dias: nenhum passa de 2× o normal do canal.") e o bloco logo abaixo ("Entre os Shorts com até 30 dias nenhum passa de 2× o normal do canal; sem outlier, não há views...") dizem a mesma coisa duas vezes, a 1 cm de distância. Evidência: `shots/vazio-1440-escuro.png`, `vazio-390-claro.png`. Também o seletor mostra "Views aos 7 dias: sem vídeos" escolhido, o que contradiz o "Voltar ao multiplicador" do bloco sem dizer por quê.
- Conserto: manter no bloco só o título "Nenhum outlier para ordenar" + "Sem outlier não há views aos 7 ou aos 30 dias para comparar." e deixar a frase de topo como está.

### C5. Estado `leitura` com ícone de "certo" e sem dizer o que o leitor não vê
- O selo "Só leitura" usa o ✓ (ícone `ok`), que lê como "tudo certo / confirmado", e a tela não diz o que está escondido (nada). `shots/leitura-1440-escuro.png`. A dúvida 4 da NOTAS já admite que o estado talvez não exista.
- Conserto: trocar por cadeado (`IC.lock` já existe em `q.js`) e, se o dono confirmar que não há dado privado, retirar o estado; até lá, escrever uma linha: "Você só lê: não há nada aqui que precise de permissão." ou eliminar o estado antes de levar ao dono.

### C6. O que a faixa de cobertura não amarra à lista (a 390 px)
- A faixa fica a 904 px do topo (frase de resumo em 743 px, dobra em 844 px): quem abre no celular lê a frase, mas a faixa (a forma de relance) só aparece depois de rolar, e acima dela há um cabeçalho de 700 px (abas empilhadas, filtro de nicho solto no meio das abas). O cabeçalho vem do lote 1 aprovado e a NOTAS declara que não faz parte do ajuste; não bloqueio por isso. Mas a tela 17b a 390 px deve ao menos subir a faixa para logo abaixo da frase **antes** da linha do selo e dos filtros de formato, ou dobrar a linha do selo (ela ocupa 3 linhas).
- Conserto mínimo: a 390 px, ordem frase → faixa (só a linha "7 dias"/"30 dias" e "N de M medidos") → selo → legenda no ⓘ ou recolhida. Aceito que o dono decida se o cabeçalho copiado fica como está.

---

## Melhorias (não bloqueiam)

- **M1. Barra "medida" no tema claro:** o trilho da barra tem contraste 1,00:1 com a linha (tema claro) e 1,17:1 (escuro): só a parte preenchida aparece, e a ideia "contra o maior da lista" perde a referência. Dar ao trilho uma borda `--border-strong` (1 px) ou 1,5:1.
- **M2. Mesma forma, dois significados:** o ◆ da régua do tempo ("quando fecham", cor areia) e o ◆ do multiplicador alto (5× a 10×, roxo) são o mesmo losango na mesma tela. Usar um traço vertical ou um círculo pequeno para a data na régua do tempo.
- **M3. Estrela do multiplicador de 10× ou mais lê como "+":** "+ 63×" a 16 px parece um sinal de mais ("mais 63×"). Aumentar a ponta da estrela ou usar `✶` de 6 pontas.
- **M4. 22 pastilhas vermelhas no erro:** `erro` repete "não carregou" com borda vermelha em 22 células, o que vira sopa vermelha; o aviso do topo já diz. Cada célula pode ficar como texto `--text` com o triângulo e sem borda de 34 px.
- **M5. Cartão de 290 a 330 px por vídeo a 390:** 11 cartões somam 3.200 px (a página toda tem 5.000 px). A meta dos lotes é 132 a 155 px por linha; no cartão cabem os dois números lado a lado em 2 colunas e o multiplicador ao lado do título. Não vale para o dono hoje, vale para o implementador.
- **M6. Carregando não desenhado:** a convenção 13 pede "carregando onde houver". As duas colunas vêm do banco na mesma leitura da lista, então talvez não haja; escrever isso na NOTAS (uma linha) para o dono não achar que foi esquecido.
- **M7. Exemplo `zero` com vídeo de 700 views por dia e zero views aos 7 dias:** "Hostel em Tbilisi" e "Quanto ganha um nômade digital" têm 0 aos 7 dias e 40 mil aos 30; o dono vai estranhar. Trocar por vídeo que estreou privado ou agendado e dizer isso no ⓘ, ou deixar um exemplo mais plausível (poucas views, não zero).
- **M8. A vizinha "Estourou e parou" cita "mockup 14" dentro da tela.** Está certo para o dono olhando, mas o texto da tela não deve levar o nome de um mockup: pôr a referência só na barra de estados.
- **M9. A cor areia (`--lado-n`) tem dois significados na mesma tela** (barra "medido" e ícone do selo). Funciona porque o ícone é pequeno e o selo tem texto, mas o plano diz "uma cor, um significado". Aceitável; só anotar na NOTAS.

---

## Tabela de medidas

**Contraste (WCAG, valores lidos do estilo computado; fundo composto pelas camadas pais)**

| Elemento | Escuro | Claro | Exigido |
|---|---|---|---|
| Número de views (15 px) | 13,82 | 14,21 | 4,5 |
| "não medido" palavra (12 px) | 8,37 | 7,09 | 4,5 |
| motivo do não medido (12 px) | 6,67 | 6,83 | 4,5 |
| "zero medido" (12 px) | 5,90 | 6,43 | 4,5 |
| contagem da faixa e legenda (12,5 a 13 px) | 6,18 | 7,13 | 4,5 |
| cabeçalho da tabela (12,5 px) | 6,67 | 6,83 | 4,5 |
| multiplicador alto / mediano | 6,56 / 8,33 | 6,37 / 5,32 | 4,5 |
| linha do selo / selo | 6,67 / 15,61 | 6,83 / 15,09 | 4,5 |
| casa medida (areia) contra o cartão | 11,88 | 8,32 | 3 |
| barra medida | 13,28 | 7,50 | 3 |
| caixa/casa zero medido (borda `--im-zero`, 2 px) | 4,97 (casa), 4,75 (célula) | 4,84 (casa), 4,36 (célula) | 3 |
| borda da casa não medido (`--nm-line`) | 4,09 | 4,57 | 3 |
| trilho da barra contra a linha | 1,17 | 1,00 | decorativo (M1) |

Escala de cinza: a faixa de cobertura e as células se leem (medido = claro, não medido = hachura escura, zero = contorno), conferido em `zero-1440-escuro.png`. Texto menor que 12 px: nenhum (menor 12 px). Rolagem horizontal da página: 0 em 28 cruzamentos (7 estados x 1440/390 x escuro/claro).

**Alvos de toque e controles (390 px, ponteiro grosso)**

| Controle | Medida | Resultado |
|---|---|---|
| Seletor "Ordenar por" | 277 x 44 | ok |
| ⓘ | 44 x 44 | ok |
| Links de ação da linha (histórico, YouTube) | 44 x 44 | ok |
| Chips de idade/formato | 44 de altura | ok (mas `aria-hidden`, não são interativos no mockup) |
| "Tentar de novo" | 120 x 44 | ok no tamanho, mas é `span` (B2) |
| "Voltar ao multiplicador" (vazio) | 171 x 44 | ok no tamanho, `span` (B2) |
| "Voltar ao multiplicador (padrão)" (nao-medido) | 229 x **34** | **falha** (B2) |
| Casas da faixa (22 px de altura) | não são alvo; sem ação | ok |

1440: seletor 265 x 36 (36 px no ponteiro fino, aceito), ⓘ 44 x 44, foco 2 px `--accent` em todos os focáveis (SELECT, ⓘ, os 22 links). Esc fecha o ⓘ e devolve o foco ao botão. Ordem de Tab: botão de estados do mockup, select, ⓘ, links por linha (coerente com a ordem visual).

**Alturas e larguras**

| Medida | Valor |
|---|---|
| Altura de linha de tabela, 1440 | 53 a 105 px (extremo 119); meta aceita 132 a 155 |
| Altura de cartão, 390 | 290 a 336 px |
| Página inteira, 1440 / 390 (v7) | 2.124 / 5.006 px |
| Faixa de cobertura: topo do bloco a 390 | 904 px (dobra 844) |
| Frase-resumo a 390: topo | 743 px |
| Aviso de erro, parágrafo a 390 | 166 x 147 px |
| Transbordamento de célula (B1) | 60 px em `a11` |

**Conferências de coerência com o dado (dia 13/10)**: 5 + 2 + 1 = 8 não medidos aos 7 dias e 5 + 5 + 1 = 11 aos 30 dias fecham com a faixa; "faltam 21 dias" bate com 13/10 a 03/11; as datas de fechamento batem com publicação + 7 e + 30 (04/10 + 30 = 03/11); a ordem dos não medidos é a do multiplicador (5,8; 4,9; 4,6; 4,2...). `futuro` (20/12): 9 de 14, 4 fecham de 25/12 a 04/01 + 1 descoberto tarde = 5, fecha.

## Regras do dono, uma por uma

| Regra | Resultado |
|---|---|
| Frase-resumo no topo | ok (C1 corrige o singular) |
| Régua ou barra para comparar de relance | ok (faixa de cobertura + barra nos números; M1 trilho) |
| Cor estável, inclusive "não medido" | ok (hachura rosa só para não medido; M9 anotar areia) |
| Símbolo junto da cor | ok (forma por casa, triângulo no erro, ícone no selo; M2, M3) |
| Método no ⓘ, não em prosa | ok (ⓘ único; só a "vizinha" é uma linha de prosa, M8) |
| Zero medido distinto de não medido | ok, em toda parte |
| Sem bloco monocromático nem parágrafo de prosa | ok (C4 corta o duplicado do vazio) |
| Sem jargão | corrige (C3) |
| Sem `color-mix()` | ok (só comentários) |
| Escuro a 1440 e claro a 390 | ok |
| Alvo de 44 x 44 | falha em 1 botão (B2) |
| Foco visível | ok onde há foco; os botões em `span` ficam sem (B2) |
| aria correto | faixa, régua e células têm `role="img"` com texto por extenso; `aria-sort` na coluna ordenada; `aria-hidden` nos chips de filtro (não interativos); falta só B2 |

## Coerência com o lote 1 e com o spec

Tokens, hachura rosa, caixa vazada do zero, "+ novo" tracejado verde-água, ⓘ do método e a linha "exemplo" são os do lote 1; nenhum matiz novo. Spec: 6.2 (ordenar por V7 e V30 além do múltiplo, selo) e regra (b) (ao vivo/estreia fora das medianas, a tela diz quantos) estão cumpridos; M1 (motivos da lista fechada, data de fechamento) está cumprido; o padrão continua sendo o múltiplo como pede a coluna de viés. O cabeçalho empilhado a 390 px é do lote 1 (declarado).

## O que não consegui verificar

- Leitor de tela (VoiceOver, NVDA): os `aria-label` foram lidos no código, não ouvidos.
- Safari e Opera (o Opera é o do dono): só Chromium.
- Os estados `futuro` e `leitura` a 390 px (julguei pelo desenho, igual aos vizinhos) e o tema escuro a 390 / claro a 1440 (medi contraste e transbordamento nos quatro cruzamentos, mas só olhei as capturas do par obrigatório).
- Movimento reduzido: uma regra `prefers-reduced-motion` existe no CSS copiado (`a4.css`); não observei animação nesta tela.
- Impressão e zoom de 200%.

## Condição para a rodada 2

Corrigir B1 e B2 e as correções C1 a C5 (C6 pode ser decisão do dono); reabrir `padrao`, `v7`, `nao-medido`, `erro` e `vazio` a 1440 e 390 e anexar à NOTAS: (a) medida de transbordamento em zero, (b) prova de que cada botão de ação recebe foco e mede 44 px a 390, (c) a frase de `zero` no singular. As capturas desta rodada ficam em `shots/` (as minhas, de contraste e uso, ficam no scratchpad da sessão).
