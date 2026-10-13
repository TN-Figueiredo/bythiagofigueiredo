# Revisão de UX, rodada 4: Mockup 13, Histórico do vídeo de concorrente (A5, lote 2)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Lido: `REVISAO-UX-r3.md`, `NOTAS.md` (seções 8 e 9), `PLANO.md`, `CONVENCOES.md`, `m13.js`, `m13-dados.js`, `m13-graf.js`.
Como medi: scripts próprios de Chromium headless sobre servidor estático (portas 47731 a 47738, derrubadas ao terminar), mais o `capturar.mjs` do lote (56 páginas). Os 14 estados foram abertos a 1440 escuro e 390 claro (os pares obrigatórios); colisões e rolagem também a 390 escuro e a 360. Dos 14 estados dumpei o texto da tela, o texto das tabelas escondidas ("Ver como tabela"), os rótulos de aria e o objeto `M13_DEBUG` (dados de exemplo), e refiz as contas à mão contra o texto. Abri por captura: `cheio` 1440 escuro e 390 claro, `extremo` 1440 escuro e 390 claro, `recente`, `zero`, `naomedido`, `semanal`, `vazio`, `saiu`, `aovivo`, `magro` a 390 claro, `carregando` e `erro` a 1440 escuro, `naomedido` e `cheio` em escala de cinza.
Evidências novas desta rodada (em `shots/`): `r4-B1-subida-off-by-one-{recente,magro,zero,aovivo}-390-claro.png`, `r4-C1-carregando-titulo-1440-escuro.png`, `r4-C2-extremo-aba-mudancas-12-1440-escuro.png`.

## Resumo

**Veredito do mockup: NÃO PODE IR AO DONO nesta rodada. 1 bloqueio (uma frase, escrita em 4 estados), 2 "corrige", 5 sugestões.**

Tudo o que a r3 pediu foi resolvido de verdade (tabela de conferência abaixo) e o ajuste não criou defeito novo de layout: 56 de 56 cruzamentos sem rolagem horizontal, sem texto abaixo de 12 px, sem alvo abaixo de 44 px no toque, sem erro de console, sem `color-mix` em CSS que carrega a interface (só em comentário), zero colisão de rótulo na régua de 72 horas a 1440, 390 e 360.

A varredura de coerência dos números de exemplo, que o dono pediu para fechar de uma vez, achou **uma contradição aritmética dentro da mesma frase** (bloqueio, mesma classe das rodadas anteriores) e **duas incoerências menores**. Os números derivados do motor (`m13-dados.js`) fecham em todos os estados: refiz as somas e as razões e bateram (lista na seção "Varredura de coerência").

As três coisas que ainda mais pesam no conjunto:
1. A frase "precisa de 14 dias de contagem por dia; são N. Fecha em D" não fecha em nenhum dos 4 estados em que aparece (14 menos N dá um dia a menos do que a data). Um número de 14 digitado à mão e um "são N" e um "fecha em" calculados em lugares diferentes (`m13.js:203-207`).
2. O estado `carregando` troca o título do vídeo por "Carregando o histórico do vídeo" e a capa muda de cor; no `erro`, o mesmo vídeo mostra o título verdadeiro, e a própria tela do erro diz que o título "veio da lista".
3. A casca do lote 1 (aba "Mudanças 12", "vídeo 1 de 12") fica ao lado de um vídeo com 14 mudanças e de vídeos sem nenhuma mudança.

## A pergunta do dono e o relance

Pergunta: **"Esse vídeo foi bem para a idade dele, e algo que o canal mexeu veio antes de ele subir?"**

- 1440 escuro, `cheio` e `extremo`: respondem em 3 s. A frase-resumo diz as duas metades ("2,8 vezes o normal", "▲ Subiu em 16/10", "Nos 14 dias antes, o canal mudou o título (11/10) e a miniatura (13/10)"), logo abaixo a faixa de 5 números; sem rolar. Os números fecham: 94.319 / 33.760 = 2,79; subida 49.601 = 63.689 - 14.088; 7.086 / 1.497 = 4,73.
- 390 claro: o resumo começa em y 905 a 1.087, abaixo da primeira tela (S1 da r2, casca do lote 1, mantida como sugestão).
- Estados sem dado dizem o que falta e quando passa a existir; `recente` (o caso real de hoje) responde "1,1 vez o normal com 3 dias" e declara o que ainda não existe, com data.

## Bloqueio (nada vai ao dono com ele aberto)

**R4-B1. `recente`, `magro`, `zero` e `aovivo` (1440 e 390, dois temas): "precisa de 14 dias de contagem por dia; são N. Fecha em D" não fecha.**
Tela e estado: cartão "Subida: não medido" no fim do bloco "Views por dia e cada mudança" (e, no `magro`, a mesma frase). Texto exato e a conta de quem lê:

| Estado | Frase na tela | 14 menos N | Data que a conta dá (hoje 13/10) | Data escrita |
|---|---|---|---|---|
| `recente` | "precisa de 14 dias de contagem por dia; são 3. Fecha em 25/10" | faltam 11 | 24/10 | 25/10 |
| `magro` | "precisa de 14 dias ...; são 11 (começou em 03/10). Fecha em 17/10" | faltam 3 | 16/10 | 17/10 |
| `zero` | "precisa de 14 dias ...; são 9. Fecha em 19/10" | faltam 5 | 18/10 | 19/10 |
| `aovivo` | "precisa de 14 dias ...; são 5. Fecha em 23/10" | faltam 9 | 22/10 | 23/10 |

Causa (verifiquei no código): "14" está digitado (`m13.js:203-207`), "são N" é a contagem de leituras (`nDias`, que inclui o primeiro dia) e "fecha em" é publicação + 1 + 14, isto é, 15 leituras (7 antes, o dia da subida e 7 depois, a regra do ⓘ). Os três números saem de três lugares e o dono, que faz a conta de cabeça (14 - 3 = 11 dias), cai um dia antes da data escrita. É a mesma classe das rodadas anteriores (número de exemplo que não fecha com o vizinho na mesma frase). Os cartões de `vazio` ("fecha em 28/10") e de `saiu` ("com 4 dias de contagem") não têm "são N" ao lado do "14" e estão certos como a conta pede, desde que o texto mude junto (veja o conserto).
Evidência: `shots/r4-B1-subida-off-by-one-aovivo-390-claro.png` (5 barras de 09/10 a 13/10; "são 5"; "Fecha em 23/10"), e as outras três com o mesmo nome. A tabela de coerência da NOTAS (seção 9) lista "Subida fecha em 25/10, são 3 | 10/10 + 1 + 14" e confere a data contra a fórmula, mas não confere a frase contra o "14".
Conserto exato (uma troca de número e uma derivação): em `subidaMotivo()` escrever "precisa de **15** dias de contagem por dia (7 antes, o dia e 7 depois)" no lugar de "14" nos quatro textos (`m13.js:203, 204, 205, 207`), tirando o 15 de uma constante `NECESSARIOS = 15` e calculando "fecha em" como `hoje + (NECESSARIOS - nDias)` em vez de `publicação + 1 + 14`, para as duas contas nascerem do mesmo número; no aviso de topo dos estados de novembro ("nenhum vídeo tem 14 dias de contagem") trocar para 15 pela mesma constante; atualizar a linha da NOTAS. Conferir depois: `recente` 3 + 12 = 25/10, `magro` 11 + 4 = 17/10, `zero` 9 + 6 = 19/10, `aovivo` 5 + 10 = 23/10, `vazio` 0 + 15 = 28/10 (todas as datas já escritas ficam como estão; só o texto muda).

## Corrige (vai ao dono só depois de corrigido, junto com o bloqueio)

**R4-C1. `carregando` (1440 e 390): o título do vídeo vira "Carregando o histórico do vídeo", e a capa muda de cor.**
O cabeçalho já mostra canal (Nômade Raiz), duração (11:05), data (10/10 às 11:20, há 3 dias) e os botões, mas o título (h1) é um texto de status; na linha de baixo o mesmo texto se repete ("Carregando o histórico do vídeo."). No `erro`, o mesmo vídeo (mesmo canal, duração e data) aparece como "Os 5 piores erros em Bangkok" e a tela diz que "o título, o canal e a data de publicação acima vieram da lista": ou seja, o título é conhecido durante o carregamento. Resultado: dois títulos e duas capas (a cor da capa sai do título) para o mesmo vídeo, e o dono lê "Carregando..." como se fosse o nome do vídeo. Evidência: `shots/r4-C1-carregando-titulo-1440-escuro.png`.
Conserto: em `carregando`, usar o título real ("Os 5 piores erros em Bangkok") no cabeçalho e deixar só os blocos em esqueleto, com a frase "Carregando o histórico do vídeo." uma vez, onde está hoje.

**R4-C2. `extremo` (e a casca em todos os estados): aba "Mudanças 12" e "vídeo 1 de 12" ao lado de um vídeo com 14 mudanças e de vídeos sem mudança nenhuma.**
`lote.js:42` fixa "Mudanças 12" e o `L.pager(12)` fixa "vídeo 1 de 12, na ordem da lista"; no `extremo` a mesma tela diz "O canal fez 14 mudanças no vídeo" (um vídeo só, mais do que o 12 da aba) e, em `zero`, `vazio` e `magro` (0 ou 1 mudança), o vídeo aparece como o 1º de 12 numa lista de Mudanças. (Observação: o normal de `recente` e de `cheio` cita outros vídeos do mesmo canal publicados depois do vídeo da tela; isso só é coerente com "1 de 12" se a lista for a de Mudanças, o que a tela não diz.) Evidência: `shots/r4-C2-extremo-aba-mudancas-12-1440-escuro.png`.
Conserto: o acréscimo de um parâmetro em `L.obs` (`nMud`) e em `L.pager(total)` já é permitido (a convenção deixa acrescentar, com registro no LEIAME); no `extremo` passar um número maior que 14 (por exemplo 31), e nos estados sem mudança do vídeo manter o pager mas trocar o texto fixo por "vídeo N de M da lista de Mudanças" apenas quando o vídeo tem mudança; em `vazio`, `zero` e `carregando` esconder o pager ("Anterior/Próximo" some). Se o dono preferir não mexer na casca aprovada, a alternativa mínima é só o `extremo` com a aba maior que 14.

## Sugestões (não bloqueiam)

- **S1. Rótulos de valor do gráfico por dia ficam nas barras erradas.** O rótulo só é desenhado quando cabe na largura da coluna (`m13-graf.js`, linha do `ic-val`): em `cheio` a 1440 saem "928 855 866" e "985 998 948" nas barras pequenas e o 9.934 do melhor dia (que a frase de cima destaca) fica sem número; em `extremo` nenhum número aparece. O destaque da tela é o melhor dia, não a cauda. Conserto: rotular só o melhor dia e o último dia, sempre, e tirar o resto.
- **S2. Altura da hachura nas primeiras horas diz uma grandeza que não existe.** Nas 72 horas, as horas antes da primeira contagem são hachuradas com uma altura fixa (cerca de 25% do eixo). Em `extremo` a hachura sugere uns 750 por hora, mas as 7 h 40 min antes da primeira contagem somaram 24.832 views (média acima de 3.200 por hora); em `cheio` sugere uns 100 por hora contra 413 de média (1.789 em 4 h 20 min). O rótulo "1.996 em 1 hora" também parece o pico e é só o maior valor medido. Conserto: hachura na altura total do gráfico, ou duas linhas na legenda ("pico medido") e o rótulo do pico dizendo "maior hora medida: 1.996".
- **S3. A marca de "dentro/fora dos 14 dias antes" muda de lado entre estados.** `cheio` marca os dois itens que estão dentro ("dentro dos 14 dias antes da subida"); `extremo` marca os 2 que estão fora. A mesma lista, duas convenções. Conserto: marcar sempre os que estão fora (ou sempre uma coluna) e dizer na frase da lista, como `extremo` já faz, quantos estão dentro.
- **S4. Linha vertical da mudança atravessa o número da barra** (`recente` 390: a linha de 12/10 corta o "2.867"; `naomedido`: a de 11/10 corta o rótulo do eixo). Conserto: contorno de 4 px da cor do cartão no texto (já usado no pico das 72 horas).
- **S5. Palavras de motor.** "descoberto tarde" (cartões do `naomedido`), "primeira leitura" (`semanal`, `vazio`), "série semanal" (a frase é do spec, pergunta 16, mas a convenção proíbe "série" na tela). Conserto: "entrou na contagem tarde", "primeira contagem", e manter "série semanal" só se o dono aceitar a frase do spec. Mantida da r2: S1 (resumo abaixo da primeira tela a 390 px), por vir da casca do lote 1.

## Conferência da r3

| Item | Resultado | Evidência |
|---|---|---|
| R3-B1 ("1/41/2" na régua de 72 horas, `zero` 390 e 360) | resolvido | Caixas das frações e das horas: 0 colisões nos 11 estados com régua, a 1440, 390 e 360 (folga de 4 px no teste, 6 px no código). `zero` 390: "1/4" e "3/4" em cima, "1/2 · 12 h" na segunda linha, sem leitura errada |
| R3-C1 (linha de 1/2 atravessa o pico) | resolvido | Nenhum traço dentro do texto; a linha abre um vão ("436 em 1 hora" com o vão no meio, `recente` 390; "300 em 1 hora" e "1.996 em 1 hora" à direita da linha). Não mexeu na escala |
| R3-C2 (prosa de datas no `extremo`) | resolvido | Cartão: "12 mudanças nos 14 dias antes da subida (a lista está logo abaixo)"; a lista dos 14 itens tem 12 sem marca e 2 com "fora dos 14 dias antes", e bate (4 título + 6 miniatura + 2 outras = 12 nas raias) |
| R3-C3 (duas datas no `semanal`) | resolvido | Bloco de idade: "contagem começou (03/10), e a primeira leitura dele é de 05/10"; gráfico: "sem contagem por semana antes de 05/10"; a barra hachurada fica em 05/10; os 5 pontos (722, 723, 968, 783, 725) conferem com (soma das semanas)/7 |
| R3-C4 (nome do ⓘ do `semanal`) | resolvido | "Como ler a contagem por semana" |
| S2 a S5 da r3 | mantidas como sugestão, nenhuma piorou | |
| Resposta da NOTAS (V1 a V7, tabela da seção 9) | conferida contra a tela e contra as tabelas escondidas | A tabela de coerência está certa em tudo o que cobre, menos na linha da subida (R4-B1) |

## Varredura de coerência dos números de exemplo (feita agora, em todos os estados)

Conferi no texto, nos aria, nas tabelas escondidas e no motor. **Fecha** (nenhuma contradição):
- Total do cabeçalho = "Views agora" = soma das barras por dia (+ primeira contagem quando o vídeo é anterior a 03/10 ou entrou tarde): `cheio` 97.909, `extremo` 1.043.955, `recente` 10.846 (6.330 + 2.867 + 1.649), `magro` 22.540 (20.106 + 2.434), `zero` 32 (21+5+2+0+1+1+1+0+1), `naomedido` 11.542, `semanal` 73.829, `saiu` 7.657 (3.828 + 1.964 + 1.076 + 789), `aovivo` 12.352.
- A contagem por hora e a por dia saem da mesma curva: em `cheio` e `recente` somei a mão as horas da tabela até as 12:00 de cada dia e deu exatamente o dia (3.610, 3.566; 6.330). `zero`: 5 horas antes da primeira contagem + 67 medidas, 47 zero + 20 com views = 67.
- Razões escritas = razão dos números exibidos, arredondada uma vez: 1,05 (＝), 0,89, 2,79; 6,44, 5,90, 21,56; 1,20 e 1,14; 0,125 (0,1); 0,82 e 0,74.
- "Fecha em" por idade (publicação + idade, primeira leitura das 12:00 depois): `recente` 17/10 e 09/11; `cheio` 08/12; `extremo` 09/12; `zero` 18/10 e 03/11; `vazio` 15/10, 21/10, 13/11; `aovivo` 16/10 e 08/11; `naomedido` 04/11. Todas conferem. Só a frase da subida não (R4-B1).
- "Há N dias" e dias da semana: conferem em todos (08/10 quinta, 04/10 domingo, 13/10 terça).
- n do normal: sai de uma lista de datas (`PUBS_OUTROS`), nunca cresce com a idade, e vira "não medido" exatamente quando n < 3. Contagens de pontos: `naomedido` "1 dos 5 pontos que já existem... os 5 de idades maiores ainda não existem" = 10 idades.
- Subida e lista de mudanças: `cheio` 49.601 e 7.086/1.497 = 4,73; `extremo` 543.292 e 77.613/16.591 = 4,68; mudanças nas raias = lista (14 = 5 + 6 + 3; 12 dentro).
- Textos de `vazio`: 312 views em cabeçalho, resumo e bloco de 72 horas; "primeira barra amanhã" e "1 dia fecha em 15/10" se explicam na própria tela.

**Não fecha ou incomoda**: R4-B1, R4-C1, R4-C2, mais S2 e S3. Não achei mais nenhuma contradição de número dentro de um mesmo estado.

## Veredito por estado e por largura

| Estado | 1440 escuro | 390 claro | Outros cruzamentos | Pendências |
|---|---|---|---|---|
| `cheio` | pronto | pronto | pronto | S1, S3 |
| `extremo` | volta para ajuste | volta para ajuste | idem | R4-C2, S1, S2, S3 |
| `recente` (caso real de hoje) | volta para ajuste | volta para ajuste | idem | **R4-B1**, S4 |
| `magro` | volta para ajuste | volta para ajuste | idem | **R4-B1** |
| `zero` | volta para ajuste | volta para ajuste | idem | **R4-B1** |
| `naomedido` | pronto | pronto | pronto | S4, S5 |
| `semanal` | pronto | pronto | pronto | S5 |
| `saiu` | pronto | pronto | pronto | nenhuma |
| `mantido` | pronto | pronto | pronto | nenhuma |
| `aovivo` | volta para ajuste | volta para ajuste | idem | **R4-B1** |
| `vazio` | pronto | pronto | pronto | texto do ⓘ/aviso segue a constante nova (R4-B1), R4-C2 |
| `carregando` | volta para ajuste | volta para ajuste | idem | R4-C1 |
| `erro` | pronto | pronto | pronto | nenhuma |
| `leitura` | pronto | pronto | pronto | nenhuma (a frase de só leitura tem 3 orações: dá para cortar a última) |

## Cobrança do dono, ponto a ponto

| Regra | Resultado |
|---|---|
| Frase-resumo no topo | sim, em todo estado com dado; `vazio`, `magro` e `naomedido` dizem o que falta e por quê |
| Régua ou barra para comparar de relance | sim, proporcional (pares de barras com razão dentro de 1 px; régua de 72 horas sem colisão) |
| Cor estável por significado com símbolo | sim: azul/círculo = este vídeo, areia/quadrado tracejado = normal, verde/▲ = subida, rosa hachurado = não medido, caixa vazada = zero medido, pontilhado = ainda não existe. Escala de cinza (`naomedido`, `cheio` 390): a tela se lê, forma e hachura separam tudo |
| "Zero medido" distinto de "não medido" | sim (`zero`: caixas vazadas nas horas e nos dias; hachura só onde a contagem não existe) |
| Método no botão de informação | sim; 4 ⓘ por estado com nomes distintos, 44 x 44 a 390, abre por Enter, Esc fecha e devolve o foco, popover de 366 px (x 12 a 378) |
| Sem prosa nem bloco monocromático | sim (a frase de só leitura é a mais longa; sugestão menor) |
| Frases sem jargão interno | quase: S5 |
| Sem `color-mix()` | sim; só comentários "sem color-mix" |
| Escuro a 1440 e claro a 390 | os dois pares abertos |
| Alvo de 44 px | 0 alvos abaixo de 44 px a 390 em 28 de 28 estados e temas medidos pelo `capturar.mjs` |
| Números de exemplo que se contradizem | 1 contradição (R4-B1) e 1 incoerência de casca (R4-C2); o resto fecha |

## Tabela de medidas

| Medida | Resultado |
|---|---|
| Rolagem horizontal (`capturar.mjs`, 14 estados x 4 cruzamentos) | 0 px em 56 de 56; também 0 a 390 escuro e a 360 claro |
| Texto abaixo de 12 px | 0 em 56 de 56 |
| Alvos abaixo de 44 px a 390 (toque) | 0 em 28 de 28 |
| Erros de console (fora as fontes bloqueadas) | 0 nos 14 estados a 1440 |
| Texto de SVG fora do SVG | 0 em 56 de 56 |
| Rótulos da régua de 72 horas que se tocam (1440, 390 escuro e claro, 360) | 0 em 11 estados x 4 |
| Menor contraste de texto HTML, composto sobre o fundo real | 4,86:1 (escuro, 1440), 5,01:1 (claro, 390, botão "Tentar de novo" do `erro`), 5,35:1 nos demais; 0 abaixo de 4,5 |
| Tokens (iguais à r3, nada mudou): `--text` 14,48 / 15,76; `--muted` 6,18 / 7,13; `--dim` 4,86 / 5,59; este vídeo `--lado-b` 6,80 / 4,43 (elemento, mín. 3); normal `--lado-n` 11,88 / 8,32; `--dir-up` 7,26 / 6,37; `--nm` 7,76 / 7,40; hachura `--nm-line` 4,09 / 4,57; foco `--accent` 6,72 / 4,94 | todos acima do mínimo (4,5 texto, 3 elemento) |
| Números dentro de círculo preto nos marcadores (1, 2, 3 ...) | meu script lê só a cor do texto contra o fundo do SVG e acusa 1,0 (falso alarme, o texto é `--on-tr` sobre `--tr`: 14,48 / 15,76, medido na r3) |
| Alturas de página, 1440 | `cheio` 3.763; `extremo` 3.948; `carregando` 1.894; `erro` 1.415 |
| Resumo, a partir do topo, 390 | y 905 a 1.087 (S1 mantida) |

## O que não consegui verificar

Leitor de tela (VoiceOver, NVDA): só rótulos e `aria-live` por script. Safari e Opera: a hachura SVG e o `popover` do ⓘ não foram vistos lá (o `color-mix` ausente protege). Movimento reduzido: só por leitura do CSS. Capturas a 390 escuro e `vazio`, `erro`, `carregando` a 390 abertas só por medição, não por olhar. Escala de cinza: simulada em duas telas, não nas 14. Foco por teclado: refeito só no popover e no retorno do Esc (a ordem completa passou na r3 e o código dessa parte não mudou). A barra "Estados do mockup" não faz parte da tela e não foi avaliada.

## Condição para a rodada 5 (ou para ir ao dono)

Corrigir R4-B1 (uma constante e quatro textos), R4-C1 e R4-C2. As sugestões podem ficar. Eu meço de novo: a conta "15 - N = faltam, hoje + faltam = data" nos 5 estados com subida pendente; `carregando` com o título do `erro`; aba e pager do `extremo`; e abro `recente`, `zero`, `aovivo`, `magro`, `carregando` e `extremo` a 390 claro e 1440 escuro. Os outros oito estados não precisam de nova rodada se a única mudança neles for a constante 14 para 15 no aviso de topo.
