# Revisão de UX, rodada 6: Mockup 13, Histórico do vídeo de concorrente (A5, lote 2)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Lido: `REVISAO-UX-r5.md`, `NOTAS.md` (seção 12 "Resposta à r5" e seção 13, tabela de coerência), `PLANO.md`, `CONVENCOES.md`, `m13.js`, `m13-dados.js`, `m13-graf.js`.
Como medi: servidor estático próprio nas portas 47751 a 47756 (todas derrubadas ao terminar; a 3099 e os specs do projeto não foram tocados) e Chromium headless do Playwright. Refiz as 56 capturas com o `capturar.mjs` do lote (14 estados x 1440/390 x escuro/claro). Abri e olhei: `cheio`, `extremo`, `zero`, `vazio`, `semanal` a 1440 escuro; `extremo`, `semanal`, `carregando`, `erro` a 390 claro; `zero` (72 horas) e `extremo` (dia a dia) em escala de cinza. Para a varredura de coerência extraí por script, dos 14 estados: o texto visível, as tabelas escondidas ("Ver como tabela", por `textContent`), o texto dos ⓘ (ficam em `<template>`), e o `M13_DEBUG` (horas, dias, subida). Refiz do zero, em Python, a partir desses dados: soma dos dias = total; soma das horas até as 12:00 = barra do dia; "metade/um quarto/três quartos em N horas"; "N das M horas medidas"; primeira contagem por hora contra a regra escrita; "Com N dias" contra a metade das 72 horas; datas, dias da semana e "há N dias"; "fecha em" e "faltam"; o n do normal contra a lista `PUBS_OUTROS`. Contraste por cálculo (cor do texto composta sobre o fundo composto, lida do DOM) em 10 cruzamentos.

Evidências novas desta rodada (em `shots/`): `r6-semanal-info-aberto-1440-escuro.png`, `r6-C1-semanal-72h-ate-14-dias-1440-escuro.png`, `r6-C3-cheio-normal-72h-6-videos-1440-escuro.png`, `r6-S1-extremo-barra-17-10-fora-da-faixa-1440-escuro.png`.

## Resumo

**Veredito do mockup: AINDA NÃO VAI AO DONO. 0 "bloqueia", 3 "corrige", 6 sugestões.**
Pelo rito (CONVENCOES, seção 7: nenhum mockup vai ao dono com "bloqueia" ou "corrige" aberto), os 3 "corrige" seguram o envio. Os três são de uma linha de código cada.

O que a r5 pediu foi resolvido de verdade (tabela de conferência abaixo): o ⓘ do `semanal` descreve o gráfico semanal; `extremo` e `zero` têm a primeira contagem na hora da regra; a faixa verde cobre 7 barras; o `vazio` diz "sincronizado há 20 min". O ajuste não criou defeito de layout: 56 de 56 cruzamentos sem rolagem horizontal, 0 texto abaixo de 12 px, 0 alvo abaixo de 44 px a 390, 0 erro de script, 0 `color-mix` em CSS que carrega a interface.

A varredura de números fecha em tudo o que a tela mostra de forma direta (totais, somas, horas contra dias, marcos, datas, "fecha em"). O que sobrou é da mesma família das rodadas anteriores, só que mais fino: **uma regra de contagem escrita de dois jeitos** (C1), **um ⓘ que dá o nome errado a uma marca** (C2) e **um n do normal digitado à mão que contradiz o n do mesmo canal na tela** (C3).

As três coisas que mais pesam agora:
1. `semanal`: o bloco das 72 horas diz que a contagem por hora "só vale para vídeos de até 14 dias"; o ⓘ do mesmo bloco, o `magro` e o `vazio` dizem que ela começou em 04/10 (C1).
2. O ⓘ novo do `semanal` chama de "hachura" o que a legenda chama de pontilhado (C2).
3. O n do normal das 72 horas é número digitado (6, 5, 2, 2, 1, 2, 1), não derivado da lista do canal; em `cheio`, `extremo` e `leitura` ele sai menor do que a própria tela permite (C3). É a mesma classe de falha que a regra do dono manda eliminar ("gerar por código a partir de fonte única").

## A pergunta do dono e o relance

Pergunta: **"Esse vídeo foi bem para a idade dele, e algo que o canal mexeu veio antes de ele subir?"**

- 1440 escuro: responde em 3 s em todo estado com dado. Frase-resumo logo abaixo do título (número em destaque, símbolo), faixa de 5 números dentro da primeira tela, pares de barras que dão a razão sem decifrar a curva, régua de 72 horas, faixa verde com a lista de mudanças. Os estados sem dado (`vazio`, `magro`, `naomedido`, `semanal`, `carregando`, `erro`) dizem o que falta e quando passa a existir.
- 390 claro: o resumo começa em torno de y 880, abaixo da primeira tela (casca do lote 1 ocupa a dobra). Mantida como sugestão desde a r2 (vem da casca aprovada).

## Bloqueios

Nenhum.

## Corrige (vai ao dono só depois de corrigido)

**R6-C1. `semanal` (1440 e 390, dois temas): o bloco das 72 horas dá uma regra que o ⓘ do mesmo bloco e os outros estados desmentem.**
Evidência: `shots/r6-C1-semanal-72h-ate-14-dias-1440-escuro.png`. Texto na tela: "o vídeo é de 11/08/2026: a contagem por hora só vale para vídeos de até 14 dias". ⓘ do mesmo bloco ("Como ler as 72 horas"): "Só vídeos publicados a partir de 04/10". `magro`: "publicado em 03/09/2026, antes de 04/10: a contagem por hora começou nesse dia e só vale para vídeos publicados depois". São duas regras para a mesma coisa (uma por idade do vídeo, outra por data de publicação); quem lê o `semanal` e depois o `magro` não sabe qual vale. Causa: `m13.js:255`, o ramo `c.semanal` escreve uma frase própria.
Conserto exato: no `semanal`, usar a mesma frase do `magro`: "publicado em 11/08/2026, antes de 04/10: a contagem por hora começou nesse dia e só vale para vídeos publicados depois" (apague o ramo `c.semanal ? ... 'até 14 dias'`).

**R6-C2. `semanal`: o ⓘ novo chama de "hachura" o que a legenda chama de pontilhado.**
Evidência: `shots/r6-semanal-info-aberto-1440-escuro.png`. ⓘ: "Hachura: semana sem contagem (antes de 05/10)". Legenda do gráfico e tabela: hachura rosa = "não medido" (é só a semana que termina em 05/10, uma faixa estreita); retângulo pontilhado = "sem contagem (antes da primeira contagem)" (é a faixa larga, de 11/08 a 05/10, com o texto "sem contagem por semana antes de 05/10"). Quem procura a "hachura" no gráfico acha a sliver pequena e não a faixa grande que o ⓘ descreve. É o mesmo tipo de falha do R5-B1, só que numa palavra.
Conserto exato: no `infoHtml` do `semanal` (`m13.js:362`), trocar o item por: "Pontilhado: semanas sem contagem, antes de 05/10. Hachura: a semana que termina em 05/10, com contagem incompleta (não medido)."

**R6-C3. `cheio`, `extremo`, `leitura` (e `saiu`, `mantido`): o n do normal das 72 horas é digitado e contradiz a lista do canal.**
Evidência: `shots/r6-C3-cheio-normal-72h-6-videos-1440-escuro.png` ("normal do canal (6 vídeos)"). O ⓘ define esse n como "outros vídeos do canal com as 72 horas completas na contagem por hora". A mesma tela mostra o normal com 14 vídeos em 1 dia e 12 em 7 dias. A contagem por hora começou em 04/10 e só um vídeo da lista (03/10) é anterior a isso; logo, todo vídeo que já tem 7 dias completos (12) e todos os de 3 dias menos o de 03/10 (13) têm as 72 horas. O n das 72 horas não pode ser 6 (`cheio`) nem 5 (`extremo`), ao lado de 12 em 7 dias. Medi com a própria fonte do mockup: `teto72` dá 13 em 11/11 e 2 em 13/10.
Tabela do n das 72 horas, tela contra derivado (`m13.js:60`: `c.m14.n = Math.min(c.m14.n, teto72(c.agora))` usa o número digitado como valor, e a fonte única só como teto):

| Estado | Na tela (digitado) | Derivado de `teto72(agora)` |
|---|---|---|
| `cheio`, `leitura` | 6 | 13 |
| `extremo` | 5 | 13 |
| `saiu`, `mantido` | só 1 vídeo | 2 (com 3 vídeos de 3 dias na mesma tela) |
| `recente`, `zero`, `aovivo` | 2 | 2 (confere) |

Conserto exato: apagar o `n` de todos os `m14` e fazer `c.m14.n = teto72(c.agora)`. Efeitos: `cheio`/`extremo`/`leitura` passam a "normal do canal (13 vídeos)"; `saiu`/`mantido` passam a "só 2 vídeos com as 72 horas completas (o mínimo é 3)" (continua "não medido", já que 2 < 3). Atualizar a seção 13 da NOTAS (as linhas de `cheio` e `saiu`/`mantido`). Quem implementar usa o n real de cada canal.

## Sugestões (não bloqueiam)

- **S1. `extremo`: a barra do dia da subida fica fora da faixa verde e é a primeira barra alta.** Evidência: `shots/r6-S1-extremo-barra-17-10-fora-da-faixa-1440-escuro.png`. A frase diz "Subida em 17/10"; a barra de 17/10 (36 mil, contra 6 mil nos dias anteriores) cai no vão entre a faixa tracejada e a verde, e a verde começa na barra de 18/10 (111.072). Está certo pela regra (a subida é o instante das 12:00 de 17/10; a barra de 17/10 entra na conta dos 7 dias de antes: 16.591 por dia), mas o olho lê "a subida começou na primeira barra alta". Em `cheio` o vão é a barra de 16/10 (866 views) e não incomoda. Conserto de dado: atrasar o começo do surto de `extremo` em cerca de 12 horas (`burst.s` de 170 para 182) e refazer os números do estado; ou aceitar e pôr no ⓘ "o dia da subida fica entre as duas faixas". Em `cheio`/`leitura`/`extremo` a faixa tracejada de "14 dias antes" termina na borda esquerda dessa barra; a verde, na borda direita. O vão é de uma barra (29,8 px a 1440; 7,1 px a 390) e é igual nos dois.
- **S2. `vazio`: duas "contagens" com sentidos diferentes na mesma tela.** "Views agora 312, contagem de hoje" e "a primeira contagem do dia é às 12:00 de amanhã", mais "A primeira contagem por hora entra às 19:00 de hoje" no bloco de baixo. Troque "do dia" por "por dia": "a primeira contagem por dia é às 12:00 de amanhã".
- **S3. Datas fixas no texto em vez da constante.** `03/10` e `04/10` aparecem digitados em mais de 15 trechos de `m13.js` (uma `D.INICIO_DIARIA`/`D.INICIO_HORA` já existe). Hoje todos concordam; é o mesmo risco que a regra do dono manda tirar (número em dois lugares). Substituir por `A.dm(D.INICIO_DIARIA)` e `A.dm(D.INICIO_HORA)`.
- **S4. `carregando` não tem o pager e o `erro` tem.** Quando o histórico abre, o pager "vídeo 1 de 12" aparece e empurra a tela uns 30 px. Mostrar o pager também em `carregando`, ou reservar a altura.
- **S5. 390 claro, `extremo`: o rótulo "1,02 milhão" da curva por idade é cruzado pela linha.** Medi na captura (x 215 a 295, y 500): o segmento de 14 d a 30 d passa por cima do final do texto. Subir o rótulo 8 px ou dar o contorno da cor do cartão ao texto (como já se faz nos rótulos do dia a dia).
- **S6. Mantidas das rodadas anteriores:** o eixo de horas das 72 horas fica até 50 min à esquerda da hora real (r5 S2; declarado ao implementador); mesmo n do normal em canais diferentes (r5 S5, declarado; some o motivo para a r6 S3 se o n sair da lista); "servidor" no `erro` (aceitável); resumo abaixo da primeira tela a 390 (r2 S1).

## Conferência da r5

| Item | Resultado | Evidência |
|---|---|---|
| R5-B1 (ⓘ do `semanal`) | resolvido, com a ressalva R6-C2 | Abri por Enter: "Como ler a contagem por semana: Cada ponto: média de views por dia na semana que termina na data (soma das views da semana dividida por 7). Uma contagem por semana: o que sobe e desce dentro da semana não aparece... Linha tracejada de 24/08...". Nada de raias, faixa verde ou soma que dá o total. Botão 44 x 44, Esc fecha, foco volta ao botão |
| R5-C1 (primeira contagem de `extremo` e `zero`) | resolvido | `extremo`: primeira contagem 01:00 de 10/10, 6 h 40 min (t = 6,667 h), 22.549 views já = 26,3% de 85.708, logo 1/4 "não medido" certo. `zero`: 13:00 de 04/10, 3 h 50 min (t = 3,833 h); 47 das 68 horas medidas e 21 com views (47 + 21 = 68; 72 menos 4 horas "não medido" = 68), conferido na tabela das horas. Os 9 estados com hora seguem a regra (descoberta no marco de 6 h, contagem na hora cheia seguinte) |
| R5-C2 (faixa de 8 barras) | resolvido | Contei por retângulo, nos três estados e nas duas larguras: 7 barras dentro da faixa verde (`cheio`, `extremo`, `leitura` a 1440; `cheio`, `extremo` a 390). `cheio`: 17/10 a 23/10 = 49.601 |
| R5-C3 (casca do `vazio`) | resolvido | Captura: "sincronizado há 20 min", descoberta 18:00, primeira contagem por hora 19:00 de hoje |
| R5-S1, S3, S4, S6, S7 | resolvidos | "cada barra hachurada"; ⓘ "A primeira barra conta desde a publicação"; "a partir de 04/10"; aviso de exemplo nos 3 estados sem dado; frase de leitura com 2 orações |
| R5-S2, S5 | declarados, mantidos | ver S6 acima |
| NOTAS seção 12 e 13 | conferidas contra a tela e o DOM | Todas as linhas estão certas, salvo a afirmação "nenhum número abaixo é digitado em dois lugares": o n do normal das 72 horas é digitado (R6-C3) e as datas 03/10 e 04/10 aparecem digitadas em vários textos (S3) |

## Varredura de coerência dos números de exemplo (feita agora, em todos os estados, de uma vez)

**Fecha (por script sobre o DOM, as tabelas escondidas e o `M13_DEBUG`, e à mão onde indico):**
- Total do cabeçalho = soma dos dias (+ 1ª contagem): `cheio` 97.909, `extremo` 1.043.955, `recente` 10.846, `magro` 22.540 (20.106 + 2.434), `zero` 32 (21+5+2+0+1+1+1+0+1), `naomedido` 11.542 (7.750 + 849 + 752 + 748 + 719 + 724; as duas barras "não medido" de 11/10 e 12/10 somam 1.467), `semanal` 73.829, `saiu` e `mantido` 7.657, `aovivo` 12.352.
- Horas e dias da mesma curva: a diferença entre a contagem acumulada da curva às 12:00 e a do dia dá 0 em todas as barras checadas (`cheio` 3.610, 7.176, 9.094; `extremo` 36.654, 66.001, 82.443; `recente` 6.330, 9.197; `zero` 21, 26; `saiu` 3.828, 5.792, 6.868; `aovivo` 3.354, 6.675, 8.971).
- Soma das horas medidas + primeira contagem = total das 72 horas: `cheio` 9.671, `extremo` 85.708, `recente` 10.803, `zero` 27, `saiu` 7.016, `aovivo` 9.606.
- Marcos: "metade em N horas" refeito das tabelas e arredondado uma vez: `cheio` 7/22/40, `extremo` não medido/23/39, `recente` 8/17/36, `zero` 7/12/25, `saiu` 6/16/33, `aovivo` 9/25/46. Iguais à tela. Em cada estado, "Com 1 dia" é maior que a metade das 72 horas (5.440 contra 4.835; 46,9 mil contra 42,9 mil; 6.257 contra 5,5 mil; 20 contra 13,5; 4.260 contra 3.508; 4.699 contra 4.803 em `aovivo`, que só chega à metade em 25 h: confere).
- "Maior hora medida": 300, 2.283, 436, 2, 322, 232: iguais ao máximo das horas medidas.
- Razões: 5.440/5.200 (＝), 13.535/15.160 = 0,89, 94.319/33.760 = 2,79; 6,44, 5,90, 21,56; 6.257/5.200 = 1,20; 20/160 = 0,125 (0,1); 4.260/5.200 = 0,82; 7.016/9.520 = 0,74. Subida: 49.601 = 63.689 - 14.088, 7.086 por dia, 1.497 antes, 4,73; 543.292, 77.613 contra 16.591, 4,68.
- "Fecha em" e "faltam": 3 + 12 = 15 (25/10), 11 + 4 = 15 (17/10), 9 + 6 = 15 (19/10), 5 + 10 = 15 (23/10), `vazio` primeira leitura 14/10 + 14 = 28/10. 1 dia, 7 dias e 30 dias de `vazio`: 15/10, 21/10, 13/11 (publicado 17:10, leitura das 12:00 do dia seguinte à idade). 60 dias de `cheio` 08/12 e de `extremo` 09/12.
- Datas: nenhuma anterior à publicação (salvo as constantes 03/10, 04/10, 24/08); "há N dias" 34, 33, 3, 40, 9, 9, 5, 8, 92; dias da semana (08/10 quinta, 09/10 sexta, 04/10 domingo, 13/10 terça). Mudanças: 14 do `extremo` = 12 dentro + 2 fora; `cheio` 2 das 4.
- Contagens: 0 "X de Y" com X > Y; n da curva por idade sempre não crescente (14, 14, 14, 13, 12, 10, 7, 5 / 5, 4, 3, 3, 2); `naomedido`: 1 dos 5 pontos que existem tem contagem (idade 5 d = 9.226, entre as leituras de 09/10 e 10/10) e 5 dos 8 dias estão "não medido".

**Não fecha (só isto):** R6-C1, R6-C2, R6-C3. Mais S2 (palavra "contagem" em dois sentidos no `vazio`) e S1 (barra do dia da subida do `extremo`).

## Veredito por estado e por largura

| Estado | 1440 escuro | 390 claro | Outros cruzamentos | Pendências |
|---|---|---|---|---|
| `cheio` | volta para ajuste | volta para ajuste | idem | R6-C3 |
| `extremo` | volta para ajuste | volta para ajuste | idem | R6-C3 (S1, S5) |
| `recente` (caso real de hoje) | pronto | pronto | pronto | nenhuma |
| `magro` | pronto | pronto | pronto | nenhuma |
| `zero` | pronto | pronto | pronto | nenhuma |
| `naomedido` | pronto | pronto | pronto | nenhuma |
| `semanal` | volta para ajuste | volta para ajuste | idem | R6-C1, R6-C2 |
| `saiu` | volta para ajuste | volta para ajuste | idem | R6-C3 |
| `mantido` | volta para ajuste | volta para ajuste | idem | R6-C3 |
| `aovivo` | pronto | pronto | pronto | nenhuma |
| `vazio` | pronto | pronto | pronto | S2 |
| `carregando` | pronto | pronto | pronto | S4 |
| `erro` | pronto | pronto | pronto | nenhuma |
| `leitura` | volta para ajuste | volta para ajuste | idem | R6-C3 (cópia do `cheio`) |

Nenhum estado está reprovado. "Volta para ajuste" é só pelos itens listados; 8 dos 14 estados já estão "prontos para o dono" e não precisam de nova rodada se a única mudança neles for a de `m13.js` (C3 não toca `recente`, `zero`, `aovivo`, porque o n derivado é igual ao digitado).

## Cobrança do dono, ponto a ponto

| Regra | Resultado |
|---|---|
| Frase-resumo no topo | sim, em todo estado com dado; os sem dado dizem o que falta e quando existe |
| Régua ou barra para comparar de relance | sim (pares de barras proporcionais, régua de 72 horas, barras por dia, faixa da subida de 7 barras) |
| Cor estável por significado com símbolo | sim: azul/círculo = este vídeo, areia/quadrado tracejado = normal, verde/▲ = subida, rosa hachurado = não medido, caixa vazada = zero medido, pontilhado = ainda não existe. Escala de cinza (`zero` 72 horas e `extremo` dia a dia, abertos agora): lê, forma e hachura separam tudo |
| "Zero medido" distinto de "não medido" | sim (`zero`: 47 caixas vazadas nas horas e 2 nos dias; hachura só onde a contagem não existe) |
| Método no botão de informação | sim, 3 a 4 ⓘ por estado, 44 x 44, abrem por Enter, Esc fecha; texto do `semanal` agora certo, salvo a palavra de R6-C2 |
| Sem prosa nem bloco monocromático | sim |
| Frases sem jargão interno | sim ("servidor" no `erro` e "série semanal" fora) |
| Sem `color-mix()` em CSS que carrega a interface | sim (só comentários) |
| Escuro a 1440 e claro a 390 | pares abertos nos estados indicados acima; os demais por medição |
| Alvo de 44 px | 0 abaixo de 44 em 28 de 28 (390); pager "Próximo" 80 x 36 e botões do cabeçalho 34 de altura só a 1440 (ponteiro fino) |
| Números de exemplo que se contradizem | nenhum visível de forma direta; 1 por inferência (R6-C3) e 1 regra escrita de dois jeitos (R6-C1) |

## Tabela de medidas

| Medida | Resultado |
|---|---|
| Rolagem horizontal (`capturar.mjs`, 14 estados x 4 cruzamentos) | 0 px em 56 de 56 |
| Texto abaixo de 12 px | 0 em 56 de 56 |
| Alvos abaixo de 44 px a 390 (toque) | 0 em 28 de 28 |
| Erros de console (fora as fontes bloqueadas), 14 estados a 1440 | 0 |
| Contraste de texto, 10 cruzamentos (`cheio`, `zero`, `vazio`, `semanal`, `extremo` a 1440 escuro; `cheio`, `zero`, `vazio`, `semanal`, `naomedido` a 390 claro), todos os textos da página com a cor composta sobre o fundo real | menor 4,86:1 a 1440 escuro ("contagem de hoje") e 4,73:1 a 390 claro (aba "Competidores", casca do lote 1); 0 textos abaixo de 4,5:1 em 3.427 medidos (limite de 3:1 para texto grande) |
| Faixa verde da subida | 7 barras dentro: `cheio` 1440 (banda 208,4 px, barras de 29,8 px), `extremo` 1440 (214,5 px, 30,6 px), `leitura` 1440, `cheio` 390 (49,9 px, 7,1 px), `extremo` 390 (49,9 px, 7,1 px). Vão de 1 barra entre a faixa tracejada e a verde (S1) |
| Primeira contagem por hora | `cheio` 4,33 h; `extremo` 6,67 h (regra: 6,67); `recente` 1,67; `zero` 3,83 h (regra: 3,83); `saiu` 3,00; `aovivo` 6,00; `naomedido` 76 h (não medido); `magro` sem hora; `vazio` 1,83 |
| n do normal das 72 horas | na tela 6, 5, 2, 2, 1, 2, 1; derivado 13, 13, 2, 2, 2, 2, 2 (R6-C3) |
| ⓘ do `semanal` | botão 44 x 44; abre por Enter; Esc fecha e devolve o foco ao botão |
| Alturas de página, 1440 | `cheio` 3.789; `extremo` 3.948; `zero` 3.462; `semanal` 2.430; `vazio` 1.727; `saiu` 3.659 |
| Alturas de página, 390 | `extremo` 6.048; `leitura` 5.674; `saiu` 5.130; `zero` 4.903; `aovivo` 4.716; `naomedido` 4.384; `semanal` 3.599; `magro` 3.746; `vazio` 2.619; `carregando` 2.308; `erro` 1.922 |

## O que não consegui verificar

Leitor de tela (VoiceOver, NVDA): só rótulos e `aria-live` por script. Safari e Opera: a hachura SVG e o `popover` do ⓘ não foram vistos lá (a ausência de `color-mix` protege o Opera). Movimento reduzido: só por leitura do CSS. Ordem de foco por Tab: reaberta só no ⓘ do `semanal` (Enter abre, Esc fecha, foco volta); a ordem completa não foi refeita nesta rodada (nada nela mudou desde a r5). Capturas a 390 escuro e as de `magro`, `mantido`, `aovivo` e `leitura` a 390, abertas só por medição, não por olhar; escala de cinza simulada em duas telas, não nas 14. Os ⓘ foram lidos por texto; aberto por clique só o do `semanal`. A barra "Estados do mockup" não faz parte da tela e não foi avaliada. O mundo de exemplo (lista `PUBS_OUTROS`, datas de novembro) é inventado: conferi a coerência interna, não a verdade.

## Condição para a rodada 7 (ou para ir ao dono)

Corrigir R6-C1 (apagar o ramo "até 14 dias" do `semanal`), R6-C2 (uma frase do ⓘ do `semanal`) e R6-C3 (`c.m14.n = teto72(c.agora)`, apagar os `n` digitados, atualizar a NOTAS). As sugestões podem ficar, mas S3 vale fazer junto com R6-C3 (é a mesma ideia: tirar o número digitado). Eu meço de novo só isto: o bloco das 72 horas e o ⓘ do `semanal`; o n do normal das 72 horas nos 14 estados contra `teto72`; e a varredura de números (script) para garantir que a mudança do n não quebrou nenhum "só N vídeos (o mínimo é 3)". Os 8 estados "prontos" ficam como estão.
