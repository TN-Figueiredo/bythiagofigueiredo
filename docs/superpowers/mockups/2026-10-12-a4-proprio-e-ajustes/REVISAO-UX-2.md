# Segunda revisão de UX: mockups da A4 e dos ajustes (12/10/2026)

Revisor: o mesmo papel da primeira revisão (`~/.claude/agents/revisor-ux-senior.md`), sem participação no desenho. Não aceitei "corrigido" por declaração. Método: Playwright por `file://`; 27 páginas/estados × 1440 e 390 px × escuro e claro = 108 combinações (390 com toque). Em cada uma: contraste de todo texto calculado com as cores lidas da página, fonte mínima, alvos de toque, transbordo e rolagem lateral da página. Capturas de todas as 108 e do seletor em `ux-revisao-2-shots/`; escala de cinza simulada (`cinza2-*.png`). Teclado e toque exercitados de verdade (seletor, passo do gráfico). Cores da tabela de significado recalculadas dos tokens de `a4.css` (contraste e ΔE em CIELAB). Nada foi editado nos mockups; `REVISAO-UX.md` e `AJUSTES-UX.md` estão intactos.

## Resumo

| Veredito | Telas |
|---|---|
| Pronto para o dono | 6 de 9: 2 (gráfico de impressões), 3 (vídeo), 4 (taxa de clique), 6 (retenção), 7 (c1-seletor), 8 (c2-trocas) |
| Volta para ajuste (pequeno) | 3 de 9: 1 (canal), 5 (% assistido / aba Retenção), 9 (comparar-direcao) |
| Reprovado | 0 |

**Achados da primeira revisão conferidos: 44 de 44 (3 "bloqueia" + 41 "corrige"); 17 "sugestão" por amostragem.**
**Fechados de fato: 41 de 44** (3 bloqueios e 38 "corrige"). **Parciais: 3** (C6 pastilhas, C33 coluna "B em relação a A", C35 cor do "descendo" no tema claro). O que "bloqueia" não volta: os 3 bloqueios estão fechados.

**Regressões encontradas (4), nenhuma séria:**

1. **Tema claro: "descendo/parado" e "seu canal" viraram quase a mesma cor.** O conserto de C35 trocou o marrom do lado A, mas `--dir-dn` `#A24509` ficou colado em `--accent` `#B8481A`: ΔE 8,6, razão de luminância 1,17. No escuro a distância é ΔE 28. No caso real do dono (canal parado, tema claro) "Canal parado há 666 dias", "666 dias parado", as barras laranja e o chip "seu canal" são o mesmo marrom-laranja. A tabela de cores diz "um sentido por cor", e aqui não se vê.
2. **Popover API sem alternativa:** o conserto do bloqueio 1 quebra de vez onde não há `popover` (ver tela 7).
3. **A 390 × 667 px a lista do Lado B sai 15 px da janela** (piso de 180 px em `--mh`; ver tela 7).
4. **Cabeçalho da coluna "B em relação a A" contradiz as linhas depois que a seta saiu** (ver tela 9). Era latente, o ajuste o expôs.

Não houve rolagem lateral da página em nenhuma das 108 combinações (a faixa de abas do CMS rola por dentro, de propósito). Texto abaixo de 4,5:1: zero. Fonte abaixo de 12 px: zero. Alvo abaixo de 44 px a 390 px nas telas: zero. A curva de retenção (mockup 6) continua pronta.

---

## Os 3 bloqueios

| # | Conferência | Resultado |
|---|---|---|
| B1 c1-seletor 390 px | `elementFromPoint` no centro de cada opção visível, lado A (80 canais) e lado B, 390 × 844 e 390 × 667, escuro e claro, com a lista rolada por dentro em 23 posições: todas as opções 100% visíveis devolvem a própria opção, inclusive "Thiago Figueiredo" (tocar nela escolhe, no toque emulado). A lista fica dentro da janela (x 31 a 359; 390 × 844: B termina em y 832 de 844). Rolar a página 80 px: a lista acompanha o campo (top 302 → 222, 6 px sob o texto de apoio, como no desenho). Teclado: Tab chega ao campo; ↓ abre e anuncia "tnFigueiredo, canal atual, 1 de 80"; ↓/↑ andam; Enter troca; Esc fecha e devolve o nome; Tab com a lista aberta fecha e passa ao campo B; "vou" mostra o canal do outro lado como indisponível, Enter não troca e o texto diz "Escolha outro canal"; foco com contorno laranja de 2 px. Tocar fora (cabeçalho, rótulo, cartão) fecha a lista. **Fechado.** Ressalvas abaixo. |
| B2 video.html?caso=novo | Cabeçalho "212 views, 9 curtidas, 1 comentário, há 1 dia, 4,7% de engajamento", "o normal do canal: não medido, com 1 dia ainda não dá para comparar", seis seções todas "não medido" com o motivo. Nenhuma contradição com o cabeçalho. **Fechado.** |
| B3 comparar-direcao | "Aldinho está descendo: … caíram 19% (pode ser só idade: os vídeos mais velhos tiveram mais tempo para juntar views)": a ressalva está na própria linha, a 12 px da palavra "descendo"; o bloco leva o chip "exemplo" ao lado do título; o aviso virou neutro. **Fechado.** |

**Popover sem suporte (lido no código, `c1-seletor.js` linhas 47 a 66; simulei removendo `showPopover` e fazendo `:popover-open` inválido):** não há alternativa. `lista.matches(':popover-open')` lança `SyntaxError` em navegador sem Popover API, o `abrir()` aborta antes de posicionar e de marcar `aria-expanded`, e a lista nunca aparece (`display:none`). Captura `c1-sem-popover-390.png`. **Risco registrado, não bloqueio:** a Popover API é Baseline desde 2024 (Chrome 114, Safari 17, Firefox 125; Opera acompanha o Chromium), então para o dono não pesa; mas na implementação de verdade é preciso `if (!HTMLElement.prototype.showPopover)` e cair em `position:absolute` com `isolation:isolate` no cartão ativo, ou aceitar a perda explicitamente.

---

## Os 41 "corrige"

Conferidos os 41 (todos os de cor, contraste, sobreposição, alvo e texto que afirma demais, medindo de novo; os demais, pelo olhar nas capturas e em texto). 38 fechados, 3 parciais.

| Grupo | Itens | Como conferi | Estado |
|---|---|---|---|
| Alvos de toque a 390 px | C5, C10, C17, C31 | `getBoundingClientRect` de todo `a, button, input, summary, [role=option]` fora da barra do mockup, 54 combinações a 390 px: nenhum abaixo de 44 (botões de passo 44 × 44; ⓘ 44 × 44; popover do ⓘ cabe na janela, x 12 a 378). A 1440 o ⓘ tem 28 px com mouse: aceito (ver discordância 7). | fechados |
| Fonte e contraste de texto | C26, C32, C27, C39 | 108 combinações: zero texto < 4,5:1 e zero fonte < 12 px. "✓ atual" no claro `#A23E14` sobre `#F2EBDF`: 5,4:1. | fechados |
| Cor e contraste gráfico | C28, C29, C30, C34, C36, C38, C40, C41 | Lado A areia/B azul em c1, comparar-so e direcao (conferido nas três). Marcas "sem troca" tracejadas em `--dim` (4,86 / 5,59). Marcas de troca em violeta com "1" e "2+" mais a legenda no painel. Aviso do viés neutro (círculo cinza com "i"). Faixa "estável" tracejada em `--dim`. Chip "exemplo" por bloco em vez de um por linha (8 na tela cheia, antes 9+; ainda 8, mas agora o bloco é que carrega a faixa e a linha só onde o dado é real). | fechados |
| Sobreposição e rótulos | C3, C12, C4 | Hachura de 24 px de altura numa série de 80 (antes 100%); a barra de 71 voltou a ser o elemento mais alto (`canal-caso_magro-1440-escuro.png`). A 390 px os limites 0,7% e 6,1% ficam abaixo da barra e o 2,1% acima do ponto, sem colisão. | fechados |
| Texto de projeto e jargão | C2, C7, C15, C19, C21, C11 | Varredura do texto visível, dos popovers e dos `aria-label` das 27 páginas por "rodada, mockup, aprovado, decisão do dono, A4, A3, protótipo, REVISAO, dono, veto, brief, revisor, tabela e rotina": zero ocorrência dentro das telas (só "dono do canal", que é o produto). "relatório": zero. Das quatro palavras de ausência sobrou uma: "não medido". O texto do ⓘ agora é "Use os botões abaixo do gráfico para ler um dia de cada vez." | fechados |
| Estados e dado magro | C1, C14, C18, C20, C22, C23, C13 | Ver caso magro abaixo. C13: o botão "dia anterior" fica `aria-disabled="true"` e continua focável; o passo a passo por toque e por teclado (setas, Home, End) lê "qua 09/09: 2 impressões, menos de 1 clique estimado", "sex 11/09: o dia ainda não chegou (não medido)". | fechados |
| Retenção no canal | C8, C24, C9 | 390 px: cada vídeo é um cartão com barra, "+4 pontos acima do normal da faixa (39%)" em verde e "−1 ponto abaixo" em âmbar; sem corte e sem rolagem lateral. Frase aponta o vídeo e a linha dele tem filete. | C8 e C24 fechados; C9 fechado com ressalva (achado novo N3) |
| c1 indisponível | C25 | Nome em cinza, "⊘" antes, barra de foco tracejada, "indisponível" legível. | fechado |
| Tela cheia de ausência | C6, C16 | `canal-caso_sem-dado-1440-escuro.png`: faixas com um quadradinho hachurado cada e legenda única (bom); mas **cada um dos 10 cartões ainda repete o quadradinho e a mesma frase "não medido: views por dia e alcance"** (18 hachuras e 10 frases iguais), embora a linha acima da grade já diga o motivo. | C16 fechado; **C6 parcial** |
| Coluna "B em relação a A" | C33 | A seta saiu e o bloco desceu para depois de "Desempenho". Mas o cabeçalho continua "B em relação a A" e as linhas dizem "Lodir Negrini: 2,9× as views por dia de Aldinho" (A em relação a B) ou "Aldinho: +14%". | **C33 parcial** |
| Cor do "descendo" no claro | C35 | O par lado A × descendo mudou (areia `#5C4710` × `#A24509`: ΔE 37, luminância 1,43; ele escreveu 1,77, a medida é 1,43), mas descendo ficou colado em `--accent` (regressão 1). | **C35 parcial** |
| Verde e âmbar | C37 | Levado ao dono como pergunta (aceito, ver Parte E). Em cinza os quadrados ▲ ▼ ＝ ficam com a mesma luminância (razão 1,06 / 1,10) e a leitura vem do triângulo e da palavra: confirmado em `cinza2-direcao-1440-escuro.png` e `-claro.png`. | fechado |

---

## Por tela

### 1. canal.html (magro, cheio, sem dado, novo, aba Retenção): volta para ajuste (pequeno)

**Pergunta:** "Como está o meu canal e o que mudou?" No caso real: "o canal está vivo?"

O caso magro, que é o do dono, agora responde em um olhar: a frase "Canal parado há 666 dias; 140 impressões em 29 dias." em âmbar abre a tela, a célula "666 dias [pausa] parado" é a única colorida da faixa, o gráfico lê "poucos dados" e não "faltou dado", "25%" e "0 views por dia" ficam cinza, a taxa mostra "Ainda não dá para dizer se é alta ou baixa", e nenhuma posição ou frase se contradiz.

| Sev. | Estado | Achado | Evidência | Conserto |
|---|---|---|---|---|
| corrige | magro, claro | "parado" (`#A24509`) e "seu canal"/barras (`#B8481A`) são o mesmo marrom-laranja: ΔE 8,6, luminância 1,17 (escuro: ΔE 28). | `cor-parado-x-seucanal-claro.png` | No claro, `--dir-dn` em ocre `#8A5A00` (5,55:1 sobre o cartão, 4,85:1 sobre a linha destacada, ΔE 30 de `--accent`; já é o token `--terco-baixo`). |
| sugestão | sem dado | Os 10 cartões da lista repetem quadradinho + "não medido: views por dia e alcance". | `canal-caso_sem-dado-1440-escuro.png` | Tirar dos cartões; a linha acima da grade já explica. |
| sugestão | magro, cinza | Em escala de cinza o "666 dias" fica mais fraco que os vizinhos (âmbar vira cinza médio); só o selo "parado" segura. | `cinza2-canal-magro-1440-claro.png` | Peso de fonte 600 no número parado. |
| sugestão | cheio, 1440 | (mantida) o bloco de gráficos tem 1.040 px antes da lista; o dono decide. | | |

### 2. Gráfico de impressões por dia: pronto para o dono

Caixa vazada, hachura baixa, barras de dado: separação por forma mantida em cinza; passo por toque e por setas funciona; foco não se perde no limite; dia da semana no rótulo. Sem achados abertos.

### 3. video.html: pronto para o dono

Os quatro casos coerentes (cheio, magro, sem dado, novo). Magro: "Com 2 views em 28 dias não dá para posicionar este vídeo: 34 dos 34 outros também ficam abaixo de 1 view por dia" e "Com só 2 views não dá para posicionar o % assistido", sem régua nem marcador laranja. Sem achados "corrige". Sugestão: o cabeçalho do vídeo magro diz "0,9× o normal do canal" (views totais, 668 dias) logo acima de "não dá para posicionar" (views por dia); explicar a base no ⓘ.

### 4. Taxa de clique: pronto para o dono

Vídeo magro: faixa cinza tracejada, ponto vazado, "faixa tracejada: ainda não conclui". Vídeo cheio: "Fica um pouco acima… as duas faixas quase se tocam". Sugestão: no vídeo cheio as duas faixas (0,2 ponto numa régua de 0 a 10%) viram marcadores de 14 px quase indistinguíveis; usar régua de 0 a 8% ou ampliar o trecho.

### 5. % assistido (vídeo e aba Retenção): volta para ajuste (pequeno)

| Sev. | Estado | Achado | Evidência | Conserto |
|---|---|---|---|---|
| corrige | Retenção, cheio | A coluna/linha de comparação marca ±1 ponto como "acima" em verde ou "abaixo" em âmbar ("+1 ponto acima do normal da faixa (40%)", "−1 ponto abaixo"), com a mesma voz de "−3 pontos"; e existe uma categoria "= igual". 1 ponto de % assistido sobre 1.066 a 2.325 views é ruído. | `canal-caso_cheio_aba_retencao-390-escuro.png` | Zona de "igual" de ±2 pontos (ou do tamanho do erro da faixa) e cor só além dela; manter o "+4 / −3". |

O vídeo magro (25% em cinza, barra tracejada, sem triângulo) e o vídeo cheio ("Acima do normal do canal (39%)" com a marca da mediana) estão certos.

### 6. Retenção (curva): pronto para o dono

Sem regressão: frase-resumo "Metade das pessoas já saiu aos 6:52", linha da mediana, trechos revistos em faixa cinza com legenda, triângulos de maiores saídas com legenda, "exemplo" inequívoco, "Ainda não coletamos esta curva" no estado real. Sugestão: o âmbar dos triângulos (`--terco-baixo`) e o cinza das faixas não estão na tabela de cores de `AJUSTES-UX.md`.

### 7. c1-seletor.html: pronto para o dono, com um risco registrado

| Sev. | Estado | Achado | Evidência | Conserto |
|---|---|---|---|---|
| risco | navegador sem Popover | Sem `popover` o seletor não abre (ver acima). | `c1-sem-popover-390.png` | Detectar o recurso e cair em lista absoluta. |
| sugestão | 390 × 667, lado B | A lista do lado B termina em y 682 numa janela de 667 (piso de 180 px). Rolar a página resolve; ao abrir, não rola o campo para o topo. | `c1-outro-lado-390x667-*.png` | `scrollIntoView` do campo ao abrir quando a lista não couber. |

### 8. c2-trocas.html: pronto para o dono

Marcas de semana legíveis (tracejado `--dim`, "1" e "2+", legenda, "antiga … recente"), violeta com um só sentido, cinza ainda lê. A faixa "Referência do mockup (não faz parte da tela)" está separada por linha tracejada, fundo mais escuro e rótulo: inequívoca. Sugestão: a 390 px o fundo do cartão selecionado (Nômade Raiz) não preenche o cartão, deixa uma moldura de 6 px sem fundo.

### 9. comparar-direcao.html: volta para ajuste (pequeno)

O objetivo do dono é atendido no primeiro olhar e agora com a ressalva junto.

| Sev. | Estado | Achado | Evidência | Conserto |
|---|---|---|---|---|
| corrige | todos | Cabeçalho "B em relação a A" sobre linhas que falam "Lodir Negrini: 2,9× as views por dia de Aldinho" e "Aldinho: +14% de mediana": a coluna muda de referência a cada linha. | `comparar-direcao--1440-escuro.png` | Cabeçalho "Diferença" (sem A/B), ou sempre B sobre A. |
| sugestão | Leo Khev | Linha "Longos publicados": "＝ estável, 2 longos contra 2" com o mesmo quadrado cinza do "só de contexto", na mesma tela que diz que 2 longos não bastam (precisa de 3). | `comparar-direcao-par_lodir-leo-1440-claro.png` | "2 contra 2" sem veredito "estável", ou ◌ não medido como nas views. |
| sugestão | Leo Khev | Quatro vezes a mesma frase "2 longos em 90 dias; precisa de 3" + 3 pastilhas "sem traço de Leo Khev" (8 pastilhas malva). Honesto, mas repetido. | idem | Uma faixa única acima do bloco, como já foi feito no bloco "primeiros dias". |

---

## Os 5 pontos de discordância (mais os 2 que ele listou além)

Ele numerou 7. Veredito de cada um:

1. **C6, quadradinho nos cartões da tela sem dado: mantenho o achado, nos cartões.** Nas faixas do topo (7 células + 1 legenda) o desenho dele está certo e eu aceito. Nos 10 cartões, quadradinho + frase igual 10 vezes: a linha acima da grade já diz o motivo. Medida: 18 hachuras e 10 frases idênticas na tela. A alternativa que ele mesmo propôs (tirar dos cartões) é a certa.
2. **C14, "abaixo de 1 view por dia" em vez de "empate em zero": aceito a solução dele.** O vídeo tem 0,1 view por dia, então "zero" afirmaria mais que o dado. A frase ficou longa; encurtar para "34 de 34 também ficam abaixo de 1 view por dia" não custa nada.
3. **C33, não cortar a coluna: aceito não cortar, mantenho o achado do cabeçalho.** A seta saiu, a coluna ficou neutra e desceu: a leitura já não compete com a direção. Mas o cabeçalho "B em relação a A" contradiz as linhas (tela 9).
4. **C35, `#A24509` em vez de `#B45309` para "descendo" no claro: aceito o raciocínio de contraste, mantenho o achado de cor.** Ele tem razão: `#B45309` dá 4,11:1 sobre a linha destacada (menos que 4,5). Mas `#A24509` ficou a ΔE 8,6 de `--accent`. A saída é `#8A5A00` (4,85:1 sobre a linha, ΔE 30 de `--accent`).
5. **Aviso do viés em neutro, não teal: aceito.** O teal da forja é parecido com o verde de "subindo" (ΔE 27 a 49) e o aviso é ressalva de método, não dado.
6. **Cliques estimados em marca clara, não azul: aceito, com a pergunta ao dono.** Em escuro `#F5EFE6` e areia `#EAD9B2` têm ΔE 18, mas a bolinha com anel e o quadrado com a letra se separam pela forma. Libera o azul para "lado B" sem exceção.
7. **ⓘ de 28 px com mouse, 44 px no toque: aceito.** WCAG 2.5.8 pede 24 px; a 390 px o alvo é 44 × 44.

---

## Tabela de significado das cores: uma cor, um sentido?

Abri as telas lado a lado e calculei. Todas as 11 linhas da tabela se sustentam, com estas exceções:

| Cor | Exceção | Gravidade |
|---|---|---|
| Laranja (`--accent`) | O mesmo laranja é "seu canal", "dado medido", "seleção" e "foco" (ele agrupa em uma linha). Aceitável porque é a cor de ação do sistema, mas no tema claro colide com "descendo" (regressão 1). | corrige (claro) |
| Âmbar `--terco-baixo` (maior saída) | Está em uso e não está na tabela; no escuro difere do âmbar de "descendo" por ΔE 23, no claro por luminância 1,04. Dois âmbares para "queda". | sugestão |
| Cinza `--dir-eq` | É exatamente o `--muted` (ΔE 0,0): "estável" tem a cor do texto secundário. A forma ＝ e a palavra sustentam. | sugestão |
| Areia (A) × claro (cliques) | ΔE 18 no escuro; formas diferentes. Sem confusão observada. | ok |
| Lado B azul × ardósia (zero medido) | ΔE 24 a 27, luminância 1,09 no claro; forma (círculo cheio com B × caixa vazada) separa. | ok |
| Malva "não medido" × violeta "troca" | ΔE 45 (escuro) e 70 (claro); sem confusão. | ok |

Escala de cinza (canal magro, sem dado, retenção, vídeo magro, c2, direção, nos dois temas): todas as telas com estado ainda se leem, porque cada estado tem forma e palavra (▲ ▼ ＝ ◌, quadrado × círculo, caixa vazada × hachura, "parado" com pausa, "1" × "2+"). Lado A × lado B: razão de luminância 1,75 (escuro) e 1,88 (claro), medido, confere com o que ele declarou. Verde × âmbar: 1,06 (escuro) e 1,10 (claro): só a forma e a palavra separam, como ele disse.

## Medidas refeitas

| Item | Escuro | Claro | Regra |
|---|---|---|---|
| Menor contraste de texto, 108 combinações | nenhuma falha | nenhuma falha | 4,5:1 |
| `--accent` sobre superfície | 6,72 | 4,94 (sobre `--surface-2`: 4,45) | 3:1 (gráfico) |
| Lado A `--lado-n` / lado B `--lado-b` sobre superfície | 11,88 / 6,80 | 8,32 / 4,43 | 3:1 |
| Letra sobre quadrado A / círculo B | 13,28 / 7,61 | 8,88 / 4,73 | 4,5:1 |
| ▲ `--dir-up` / ▼ `--dir-dn` / ＝ `--dir-eq` sobre superfície | 7,26 / 7,71 / 6,18 | 6,37 / 5,80 / 7,13 | 3:1 |
| Glifo sobre quadrado ▲ / ▼ / ＝ | 8,13 / 8,62 / 6,92 | 6,81 / 6,19 / 7,62 | 4,5:1 |
| `--nm-line` (hachura) / `--im-zero` (zero) sobre superfície | 4,09 / 4,97 | 4,57 / 4,84 | 3:1 |
| `--dim` (tracejados "sem troca" e "estável") sobre superfície | 4,86 | 5,59 | 3:1 |
| Violeta `--tier-high` sobre superfície | 6,08 | 6,65 | 3:1 |
| `--dir-dn` sobre linha destacada da Retenção | n/a | 5,07 (`#B45309`: 4,11) | 4,5:1 |
| ΔE `--accent` × `--dir-dn` | 28,0 | **8,6** | distinção de cor (> 20 desejável) |
| Razão de luminância lado A × descendo (claro) | n/a | **1,43** (ele informou 1,77) | |
| Alvos < 44 px a 390 px (54 combinações) | 0 | 0 | 44 px |
| ⓘ do gráfico, toque / mouse | 44 / 28 px | | 44 / 24 px |
| Botões de passo a 390 px | 44 × 44 | | 44 px |
| Rolagem lateral da página a 390 px | nenhuma (108/108) | nenhuma | sem rolagem |
| Fonte < 12 px | nenhuma | nenhuma | 12 px |
| Lista do seletor a 390 × 844 / 390 × 667 | dentro da janela / lado B 15 px fora | idem | dentro |
| Opções do seletor tocáveis (`elementFromPoint`) | 100% das visíveis | 100% | 100% |
| Altura da hachura nos gráficos | 24 px (série de 80) | idem | |

## Recomendação ao dono, Parte E

1. **Verde para "subindo", só na direção: aprovaria.** Não é a única marca (quadrado, ▲ e a palavra; em cinza continua legível) e a alternativa em cinza perde o relance sem ganhar honestidade.
2. **Âmbar para "descendo" e "parado": aprovaria o âmbar, mas no tema claro trocaria o tom para ocre `#8A5A00`** para não se confundir com o laranja do "seu canal" (ΔE 8,6 hoje); descer não é erro e o âmbar não grita "ruim".
3. **Taxa de clique por vídeo (veto de 09/10): manteria na tela**, porque o intervalo e a faixa tracejada "ainda não conclui" resolvem o motivo do veto (nunca cravar posição com pouco volume); no caso magro a taxa não vira ranking.
4. **Cliques estimados em marca clara em vez de azul: aprovaria**; a bolinha com anel lê bem nos dois temas e o azul fica só para "lado B", sem exceção.

## O que NÃO consegui verificar

- Leitor de tela (VoiceOver, NVDA): só li atributos ARIA e o texto de `role="status"`.
- Toque em aparelho real: usei a emulação de toque do Chromium; o gesto de rolagem sobre a lista e o teclado virtual do iOS não foram vistos.
- Safari, Firefox e Opera de verdade (o `popover` e `:popover-open`); o cenário "sem Popover" foi simulado removendo a API, não visto num navegador antigo.
- Zoom de 200 a 400% e texto aumentado do sistema; movimento reduzido (a regra existe no CSS, não alternei a preferência).
- Fontes da internet e capas dos vídeos (sem rede: fontes do sistema e blocos coloridos); larguras de números em mono podem diferir.
- Contraste do padrão composto da hachura (medi tokens e bordas).
- Os dados "exemplo" (diário de views, % assistido, curva) não foram comparados com o banco; o que é real e o que é exemplo é o que o mockup declara.
- As frases de "dos 34 outros também ficam abaixo de 1 view por dia" e os "2 longos contra 2": confiei no dado do mockup.
