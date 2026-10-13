# Revisão de UX, rodada 9: Mockup 13, Histórico do vídeo de concorrente (A5, lote 2)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Lido: `REVISAO-UX-r8.md`, `NOTAS.md` (seções 5, 18 e 19), `CONVENCOES.md`, `m13.js`, `m13-dados.js`, `m13-graf.js`.
Como medi: servidores estáticos próprios nas portas 47771 a 47777 (todos caíram ao terminar; a 3099 e os specs do projeto não foram tocados) e Chromium headless do Playwright. Refiz as 56 capturas com o `capturar.mjs` do lote (fora da pasta do mockup, em scratchpad) e abri e olhei: `cheio` 1440 escuro (página inteira) e 390 claro (idade, 72 horas, dia a dia, lista), `zero`, `extremo`, `naomedido`, `saiu`, `semanal`, `aovivo`, `magro` 1440 escuro (página inteira), `leitura` 1440 escuro (topo), `vazio` 1440 escuro, `erro` e `carregando` 390 claro, `recente`, `extremo` e `naomedido` 390 claro. Recortes do gráfico das 72 horas a 390 claro (2x) em 6 estados. Medi no DOM: geometria do SVG das 72 horas contra o texto (16 cruzamentos), ⓘ (abrir, caber, Esc, foco, 44 px) em 3 estados nas duas larguras, contraste de texto computado nos 4 cruzamentos de largura e tema em 6 estados. Li ponto a ponto, com a seta do teclado, todas as leituras dos 3 gráficos de 11 estados nas duas larguras (72 horas: 72 de 72 pontos; dias; idades; semanas) e extraí o texto visível e o escondido (tabelas e ⓘ) dos 14 estados nas duas larguras para a varredura.

## Resumo

**Veredito do mockup: AINDA NÃO VAI AO DONO. 0 "bloqueia", 1 "corrige" (uma frase, em 2 dos 14 estados), 6 sugestões.**

O bloqueio da r8 (eixo das 72 horas uma hora adiante do texto) foi **resolvido de verdade**: o gráfico agora tem uma escala só e a medi contra o texto nos 8 estados com 72 horas, em 1440 e 390 (16 de 16 cruzamentos, 0 falhas; tabela abaixo). A frase mais forte que o dado (R8-C1, `naomedido`) também: leitura, lista e tabela dizem a mesma janela "entre 10/10 e 12/10" e a marca está na divisa dos dois dias. As sugestões S1 (primeira hora "20:40 a 21:00") e S2 (origem da data "24/08") foram feitas. O ajuste não criou defeito de desenho: 0 barra fora do intervalo da hora que a leitura nomeia, razão altura por view constante, 0 texto sobreposto, 0 rolagem horizontal, 0 erro de script.

A varredura de coerência que fiz agora, de uma vez, em todos os estados, achou **uma única contradição de número** (a frase-resumo de `saiu` e `mantido`: "7.657 views com 4 dias" contra "Com 3 dias" do resto da tela) e sugestões que não seguram o envio. Todo o resto fecha.

As três coisas que ainda pesam no conjunto:
1. **A palavra "dia" tem dois sentidos na mesma tela** (idade do vídeo: "Com 3 dias"; dias de contagem: "4 dias com contagem"). É a causa do único corrige (R9-C1) e a origem provável do próximo, se ninguém padronizar: "Com N dias" é só idade; contagem é "N dias de contagem".
2. **Dois números diferentes para "72 horas" e "3 dias" no mesmo estado** (9.671 contra 9.729 em `cheio`): explicado só no ⓘ (S4).
3. **Texto de exemplo que carrega número digitado em mais de um lugar** (`76 horas` em `m13.js:94` e no bloco das 72 horas do `naomedido`, mais o `descoberto: 76` dos dados): fecha hoje, quebra quando alguém mexer (S6).

## A pergunta do dono e o relance

Pergunta: **"Esse vídeo foi bem para a idade dele, e algo que o canal mexeu veio antes de ele subir?"**
1440 escuro: responde em 3 segundos em todo estado com dado (frase-resumo com número em destaque e símbolo; cinco números dentro da primeira tela; pares de barras com a razão; régua das 72 horas; faixa verde da subida com a lista de mudanças). Os estados sem dado (`vazio`, `magro`, `naomedido`, `semanal`, `carregando`, `erro`) dizem o que falta e quando passa a existir. 390 claro: o resumo começa abaixo da primeira tela (casca do lote 1; sugestão antiga, não bloqueia).

## Bloqueios

Nenhum.

## Corrige (vai ao dono só depois de corrigido)

### R9-C1. `saiu` e `mantido`: "7.657 views com 4 dias" contradiz "Com 3 dias" da mesma tela

**Estados e largura:** `saiu` e `mantido`, 1440 e 390 (a frase-resumo, a primeira coisa que se lê).
**Evidência:** a frase diz "A última contagem, em 08/10, foi de 7.657 views com 4 dias. A contagem termina nessa data." O vídeo foi publicado em 04/10 às 16:00; a última contagem foi às 12:00 de 08/10: **3 dias e 20 horas de idade**. Em todo o resto da tela "Com N dias" é a idade: a curva por idade termina em "Com 3 dias, 7.016 views", e não existe ponto de 4 dias ("Com 5 dias" e adiante dizem "saiu antes desta idade"). O gráfico de dias diz "7.657 views em 4 dias com contagem" (aí os 4 são dias de contagem: 05, 06, 07 e 08/10, e é certo). A mesma palavra "dias" tem dois valores na mesma tela. Em segundo plano, "nessa data" pode ser lida como 09/10 (data da saída, a última citada antes) ou 08/10 (a da última contagem); o gráfico diz "saiu em 09/10: a contagem termina aqui" na divisa antes de 09/10.
**Conserto exato (`m13.js`, resumo do `saiu`):** trocar por "O vídeo saiu do YouTube em 09/10. A última contagem, em 08/10, foi de 7.657 views, depois de 4 dias de contagem. A contagem termina em 08/10." (sem "com 4 dias"). Conferir que o resumo do `mantido` herda a mesma frase.
**Por que é "corrige" e não "bloqueia":** o número 7.657 é o mesmo em toda a tela e a soma fecha (3.828 + 1.964 + 1.076 + 789); o que contradiz é a unidade da palavra, numa frase só. É a classe que o dono cobra (número de exemplo contra número de exemplo), mas é de uma linha e de dois estados.

## Sugestões (não bloqueiam)

- **S1. "só 0 vídeos (o mínimo é 3)"** nas leituras de `saiu` e `mantido` (idades de 14 a 90 dias: "O normal do canal: não medido, só 0 vídeos"). Trocar por "nenhum vídeo chegou a esta idade (o mínimo é 3)". O 0 não está errado; "só 0" lê estranho.
- **S2. `cheio`, marca 3 (descrição em 18/10, entre 12:00 e 18:00).** Cada barra de dia vai até as 12:00 (ⓘ: "views ganhas nas 24 horas até as 12:00"). Uma mudança entre 12:00 e 18:00 de 18/10 acontece depois de a barra "18/10" (9.934, a mais alta) fechar, mas a marca 3 está na coluna 18/10 e a leitura diz "18/10: 9.934 views. Mudou neste dia: descrição". Verdadeiro para o calendário, ruim para quem junta a marca com a barra do pico. Dizer na leitura "Mudou neste dia, depois da contagem das 12:00: descrição" quando a janela começa às 12:00 ou depois. Só `cheio` e `leitura` têm essa janela; nenhuma mudança antes de 12:00 precisa disso.
- **S3. `vazio`: chip "sincronizado há 3 h" (casca, igual em todos os estados) contra "descoberto às 18:00" e "a primeira contagem por hora entra às 19:00 de hoje".** Se a hora de agora é antes das 19:00 e o vídeo foi descoberto às 18:00, a sincronização não pode ter sido há 3 horas. Ambíguo (sincronização de canais não é a descoberta de vídeos), por isso sugestão: no `vazio`, mostrar "sincronizado há 40 min" ou tirar o "descoberto às 18:00" do texto.
- **S4. Total das 72 horas contra "Com 3 dias" no mesmo estado.** `cheio` 9.671 (72 horas) contra 9.729 (3 dias); `extremo` 85.708 contra 85.952; `recente` 10.803 contra 10.817; `zero`, `saiu`, `mantido`, `aovivo` iguais (publicados em hora cheia). A janela das 72 barras termina na última hora cheia antes de completar 3 dias (71 h 20 min em `cheio`). O ⓘ das 72 horas diz isso ("pode ficar um pouco abaixo do 'Com 3 dias'"); o texto visível não. Pôr na linha de apoio "Horário de São Paulo. Primeira contagem às 01:00 de 09/10." um "Última hora: 19:00 a 20:00 de 11/10." Está declarado, por isso não é corrige.
- **S5. 390: a faixa "exemplo" perde "Hoje é 13/10/2026; a contagem por dia começou em 03/10 e a por hora em 04/10"** (a 1440 ela traz). Em `recente`, `magro`, `naomedido`, `zero`, `saiu`, `aovivo` e `vazio`, "há 3 dias" e "publicado hoje" ficam sem âncora no celular. Manter "Hoje é 13/10/2026" nas duas larguras.
- **S6. Número digitado em dois lugares no código.** `m13.js:94` ("entrou tarde na contagem: 76 horas depois de publicado") e o bloco das 72 horas do `naomedido` escrevem "76" à mão; a fonte é `p.descoberto: 76` e `desde: '2026-10-08'` (05/10 08:00 + 76 h = 08/10 12:00: fecha hoje). Derivar do dado. Mais o que a NOTAS já declara (marcos 1/4, 1/2 e 3/4 do normal, digitados).
- **Mantidas de rodadas anteriores:** "O servidor não respondeu" no `erro`; resumo abaixo da primeira tela a 390 (casca); a frase de leitura do `naomedido` ("Mudou entre 10/10 e 12/10, em momento que a contagem parada não mostra") está correta e densa, vale encurtar para "Mudou entre 10/10 e 12/10 (contagem parada)" quando o implementador escrever o texto final.

## Conferência da r8 (cada item, de verdade)

| Item | Resultado | Evidência |
|---|---|---|
| R8-B1 (eixo das 72 horas uma hora adiante) | **resolvido** | Script lê o SVG e converte em horas pela escala única (`u = largura útil / hs[71].t`). Hachura termina em: `cheio` 4,333 h (texto: primeira contagem 01:00, 4 h 20 min), `extremo` 6,667 (01:00, 6 h 40), `recente` 1,667 (13:00, 1 h 40), `zero` 3,833 (13:00, 3 h 50), `saiu` e `mantido` 3,000 (19:00), `aovivo` 6,000 (01:00), `leitura` igual ao `cheio`: diferença 0,000 h em 16 de 16 (8 estados x 2 larguras). Marca de publicação em x = L (36,2 px a 1440 e a 390; 51,0 em `extremo`; 21,4 em `zero`) = hora de publicação do texto. Traços de 00:00 e 12:00 (5 a 6 por estado): 0 divergências entre a hora lida na escala e o rótulo. Linha de 1/2: 22,33 h (texto "22 horas"), 22,67 ("23"), 16,67 ("17"), 11,83 ("12"), 16,00, 25,00: o arredondamento a hora inteira está dito no ⓘ. 0 barras fora do intervalo `(t-1, t]` da hora que a leitura nomeia, em 1.082 barras (541 por largura). Razão altura/valor constante em cada estado e largura (variação 0,0000). Captura a 390 claro de 6 estados: hachura, publicação, traço de 00:00 e linha de 1/2 batem; o primeiro "00:00 sex 09/10" do `cheio` a 390 não é rotulado (cai a menos de 18 px da borda; a data seguinte, "sáb 10/10", está). |
| R8-C1 (`naomedido`, "mudou neste dia") | **resolvido** | Leitura de 11/10 e de 12/10: "Mudou entre 10/10 e 12/10, em momento que a contagem parada não mostra: miniatura (mudança 1)". Lista: "Miniatura em algum momento entre 10/10 e 12/10 (a contagem ficou parada)". Tabela escondida: "entre 10/10 e 12/10, sem dia certo". Marca 1 na divisa entre as colunas de 11/10 e 12/10 (x = 756 a 1440; recorte ampliado aberto). As quatro frases dizem a mesma janela e nenhuma nomeia um dia. |
| S1 (primeira hora "20:40 a 21:00") | feito | `cheio`: "qui 08/10, 20:40 a 21:00: não medido"; `extremo`, `recente`, `zero` idem (hora da publicação, não a hora cheia). |
| S2 (origem de "24/08") | feito | NOTAS seção 5, linha própria: data e frase são constantes de exemplo (`D.CORTE`), o implementador usa fonte real ou corta a linha. A tela leva a marca "exemplo". |
| S3, S4, S5 (r8) | mantidas / declaradas | Ver sugestões. |
| NOTAS seção 19 (tabela de coerência, número e desenho) | **conferida contra a tela e o DOM** | Todas as linhas conferem com o que medi (hachura, 00:00, 12:00, marca de publicação, linha de 1/2, `naomedido`: 5 + 3 = 8). **Lacuna da tabela:** não tem linha para a *unidade* de "dias" nas frases ("Com N dias" é idade; "N dias de contagem" é contagem), que é o que R9-C1 mostra, nem para "total das 72 horas contra Com 3 dias" (S4). Acrescentar as duas linhas. |

## Varredura de coerência dos números de exemplo (feita agora, em todos os estados, de uma vez)

Método: (a) texto visível e escondido (tabelas, ⓘ) dos 14 estados em 1440 e 390; (b) leitura ponto a ponto de todos os gráficos de 11 estados; (c) geometria contra número (SVG); (d) frase contra dado (cada frase de comparação, "N de M", "fecha em", "há N dias"); (e) invariantes por script contra o motor `M13_DEBUG`.

**Fecha (por script e à mão):**
- **Soma dos dias contra o total do cabeçalho:** `cheio` 97.909, `extremo` 993.436, `recente` 10.846, `zero` 32, `saiu` e `mantido` 7.657, `aovivo` 12.352: diferença 0. Onde há "primeira contagem" (não medido), soma dos dias medidos mais a primeira contagem = total: `magro` 2.434 + 20.106 = 22.540; `naomedido` 7.750 + 849 + 752 + 1.467 + 724 = 11.542; `semanal` 44.910 + 27.449 + 1.470 = 73.829 (a conta que a r7 pediu, mantida).
- **Curva por idade nunca decresce** (10 estados), e os pontos batem com as barras de dia: `naomedido` idade de 5 dias 9.226 = 8.599 + 752 x 20/24 (interpolação entre as contagens de 09/10 e 10/10); `cheio` idade de 1 dia 5.440 entre as horas 23:20 (5.297) e 00:20 (5.510).
- **Horas contra dias:** `cheio` 1.789 (contagem das 01:00) + 300 + 252 + 208 + 173 + 153 + 131 + 111 + 111 + 122 + 125 + 135 (até as 12:00) = 3.610 = barra de 09/10. Total até aqui das 72 horas sempre crescente, e o último valor = "views das 72 horas" do cabeçalho do gráfico em 9 estados (`cheio` 9.671, `extremo` 85.708, `recente` 10.803, `zero` 27, `saiu` e `mantido` 7.016, `aovivo` 9.606, `leitura` 9.671).
- **`zero`:** "2 dos 9 dias", "47 das 68 horas medidas" e "em 21 horas ganhou algumas": 47 + 21 = 68 (barras vazadas contadas no SVG: 47). Pontos de idade 20, 26, 27, 29, 31 contra total 32 e 72 horas 27.
- **n do normal:** por idade 14, 14, 14, 13, 12, 10, 7, 5 em 11/11; 5, 4, 3, 3, 2 em 13/10; das 72 horas 13 (11/11) e 2 (13/10), todos recalculados da lista `PUBS_OUTROS` (regra "menos de 3 é não medido" fecha em `zero`, `saiu`, `recente`, `naomedido`).
- **Descoberta de 6 em 6 horas contra a primeira contagem:** publicação às 20:40, 18:20, 09:10, 19:00 caem na descoberta das 00:00 ou das 12:00 e a primeira contagem é a hora cheia seguinte (01:00, 13:00); 11:20 vai à de 12:00 (13:00); 16:00 vai à de 18:00 (19:00); 17:10 (`vazio`) vai à de 18:00 (19:00). Todas as 7 coerentes.
- **Datas:** 1.530 ocorrências de "dia da semana dd/mm" nos 14 estados (visível, escondido e leituras) contra o calendário de 2026: 0 divergências. "há N dias": 34, 33, 40, 3, 9, 8, 92, 9, 9, 5 e "publicado hoje" conferidos à mão contra a data de cada estado. "Fecha em": idade de 7, 30, 60 e 90 dias e "subida" em `vazio`, `recente`, `zero`, `aovivo`, `naomedido`, `cheio` (09/11, 15/10, 17/10, 25/10, 03/11, 04/11, 08/12 etc.): a regra "primeira leitura das 12:00 depois do instante" fecha em todas. Nenhuma data de mudança anterior à publicação, nenhuma "N de M" com N maior que M, nenhuma conta de "faltam N" errada (`magro`: 11 de 15, faltam 4, 17/10; `zero`: 9 de 15, 19/10; `aovivo`: 5 de 15, 23/10; `recente`: 3 de 15, 25/10).
- **Razões:** 5.440/5.200 = 1,05 (perto), 13.535/15.160 = 0,89 (0,9 abaixo), 94.319/33.760 = 2,79 (2,8), 46.903/7.280 = 6,44, `extremo` 520.210/7 = 74.316 contra 12.472 = 5,96 (6,0), `cheio` 49.601/7 = 7.086 contra 1.497 = 4,7. O corte "perto do normal" entre 0,9 e 1,1 explica que 11.774/12.600 = 0,93 diga "perto" e 13.535/15.160 = 0,89 diga "0,9 vez o normal, abaixo": mesma casa decimal, rótulos diferentes pelo limite declarado. Aceito.
- **Lista de mudanças contra marcas:** `cheio` 4 (2 nos 14 dias antes), `extremo` 14 (12 nos 14 dias antes), `recente` 1, `magro` 1, `aovivo` 1, `saiu` 1, `naomedido` 1, `semanal` 1; contagens da frase, da aba ("31" e "12") e da lista batem.
- **390 contra 1440:** os conjuntos de números e datas coincidem, salvo os rótulos de eixo que o 390 afina e os números sobre as barras (1440 mostra o pico e o último dia em mais barras); `semanal` a 390 mostra 01/09, 22/09 e 24/08 no eixo e a 1440 mostra 5 em 5 dias.

**Não fecha:** R9-C1 (unidade de "dias" em `saiu` e `mantido`) e as sugestões S1 a S6.

## Veredito por estado e por largura

| Estado | 1440 escuro | 390 claro | Outros cruzamentos | Pendências |
|---|---|---|---|---|
| `cheio` | pronto | pronto | pronto | S2 (sugestão), S4, S5 |
| `extremo` | pronto | pronto | pronto | S4 |
| `recente` (caso real de hoje) | pronto | pronto | pronto | S4, S5 |
| `magro` | pronto | pronto | pronto | S5 |
| `zero` | pronto | pronto | pronto | S5 |
| `naomedido` | pronto | pronto | pronto | S5, S6 |
| `semanal` | pronto | pronto | pronto | nenhuma |
| `saiu` | volta para ajuste | volta para ajuste | idem | R9-C1; S1 |
| `mantido` | volta para ajuste | volta para ajuste | idem | R9-C1; S1 |
| `aovivo` | pronto | pronto | pronto | S5 |
| `vazio` | pronto | pronto | pronto | S3 (sugestão) |
| `carregando` | pronto | pronto | pronto | nenhuma |
| `erro` | pronto | pronto | pronto | nenhuma |
| `leitura` | pronto | pronto | pronto | cópia do `cheio` com a faixa "só ver" |

Nenhum estado reprovado. 12 dos 14 prontos; 2 voltam por uma frase.

## Cobrança do dono, ponto a ponto

| Regra | Resultado |
|---|---|
| Frase-resumo no topo | sim, em todo estado com dado; os sem dado dizem o que falta e quando existe (a de `saiu` e `mantido` precisa do R9-C1) |
| Régua ou barra para comparar de relance | sim: pares de barras proporcionais, régua de 72 horas, barras por dia, faixa da subida. O eixo das 72 horas agora está numa escala só (B1 da r8 fechado) |
| Cor estável por significado com símbolo | sim: azul/círculo = o vídeo, areia/quadrado tracejado = normal, verde/▲ = subida, rosa hachurado = não medido, caixa vazada = zero medido, pontilhado = ainda não existe, losango/triângulo/círculo = título/miniatura/outras. Nada depende só de cor |
| "Zero medido" distinto de "não medido" | sim (`zero`: 47 caixas vazadas nas horas e 2 nos dias; hachura só onde a contagem não existe; `magro` e `naomedido`: hachura com motivo) |
| Método no botão de informação | sim, 3 a 4 ⓘ por estado, 44 x 44 nas duas larguras; abrem dentro da tela, fecham com Esc, o foco volta ao botão (3 estados x 2 larguras, 4 botões cada: 24 de 24) |
| Sem prosa nem bloco monocromático | sim |
| Frases sem jargão interno | sim ("servidor" no `erro` aceito; "dias" com dois sentidos em `saiu`: R9-C1) |
| Sem `color-mix()` em CSS que carrega a interface | sim (`grep`: só comentários "sem color-mix") |
| 1440 escuro e 390 claro | os dois abertos e olhados em `cheio`, `naomedido`, `recente`, `extremo`, `erro`, `carregando`; 1440 escuro em `zero`, `saiu`, `semanal`, `aovivo`, `magro`, `leitura`, `vazio`; 390 claro em recortes das 72 horas de 6 estados |
| Alvo de 44 px | 0 abaixo de 44 em 28 de 28 (390); ⓘ 44 x 44 também a 1440 |
| Números de exemplo que se contradizem | 1 (R9-C1) em 14 estados e duas larguras; mais S2 e S4 de natureza menor, declaradas |

## Tabela de medidas

| Medida | Resultado |
|---|---|
| Rolagem horizontal (`capturar.mjs`, 14 estados x 4 cruzamentos) | 0 px em 56 de 56 |
| Texto abaixo de 12 px | 0 em 56 de 56 |
| Alvos abaixo de 44 px a 390 (toque) | 0 em 28 de 28 |
| Erros de script, 14 estados, 1440 e 390 | 0 |
| Contraste de texto (computado, 6 estados, fundo composto pelos pais; o número dentro do marcador de mudança é medido contra o marcador, não contra a página) | menor 4,86:1 (1440 escuro e 390 escuro, "contagem de hoje", 12 px), 4,73:1 (1440 claro e 390 claro, rótulo de menu "Competidores", 13,5 px); nenhum texto abaixo de 4,5:1 |
| Contraste de elemento gráfico | **não refeito nesta rodada**: nenhum CSS mudou desde a r8 (`m13.css` 13:06, `a4.css` e `lote.css` 11:54; a r8 é de 15:13). Valores da r8: menor 4,09:1 (linha da hachura, escuro); barra azul 6,80 e 4,43; areia 11,88 e 8,32; zero 4,97 e 4,84; verde da subida 7,26 e 6,37; marcador 14,48 e 15,76. Todos acima de 3:1 |
| Eixo das 72 horas: hachura, publicação, 00:00, 12:00 e 1/2 contra o texto | 0 diferença em 16 de 16 (8 estados x 2 larguras); 0 barras fora do intervalo da hora em 1.082 |
| Leitura das 72 horas em ordem | 72 de 72 pontos, ordem crescente, "Total até aqui" crescente em 9 estados |
| Dia da semana de cada data | 1.530 ocorrências, 0 divergências |
| Razão altura por view das barras | constante em cada estado e largura (variação 0,0000; por exemplo `cheio` 0,4000 px por view a 1440 e 0,3250 a 390) |
| Alturas de página, 1440 | `cheio` 3.789; `extremo` 3.948; `zero` 3.462; `saiu` 3.659; `aovivo` 3.452; `naomedido` 3.043; `magro` 2.572; `semanal` 2.512 |

## O que não consegui verificar

Leitor de tela (VoiceOver, NVDA): só `aria-label`, `aria-live` e a ordem de leitura por script. Safari e Opera: a hachura SVG e o `popover` do ⓘ não foram vistos lá (a ausência de `color-mix` protege o Opera). Movimento reduzido: só por leitura do CSS. Escala de cinza: não simulada de novo (nada de cor mudou desde a r6, que simulou `zero` e `extremo`). Ordem de foco por Tab fora dos ⓘ: não refeita. Contraste de elemento gráfico: não refeito, só confirmei que o CSS não mudou. Capturas olhadas por inteiro: 10 estados a 1440 escuro e 4 a 390 claro, mais os recortes; as outras por medição e por texto. O mundo de exemplo (lista `PUBS_OUTROS`, datas de novembro, a data "24/08") é inventado: conferi a coerência interna, não a verdade.

## Condição para a rodada 10 (ou para ir ao dono)

1. R9-C1: trocar a frase-resumo de `saiu` e `mantido` ("depois de 4 dias de contagem", "A contagem termina em 08/10"), e padronizar no texto: "Com N dias" só para idade.
2. Acrescentar à tabela de coerência da NOTAS: a linha da unidade de "dias" nas frases e a de "total das 72 horas contra Com 3 dias".
3. S1 a S6 valem fazer junto (todas de uma a três linhas); nenhuma segura o envio.

Feito o conserto, o que eu meço de novo: o texto do resumo de `saiu` e `mantido` nas duas larguras (nenhuma outra frase com "N dias" ambíguo, por regex sobre os 14 estados) e, se o S2 for feito, a leitura de 18/10 do `cheio`. O resto está medido e não depende do conserto. Se a pressa for grande, o dono já pode ver 12 dos 14 estados como estão (todos menos `saiu` e `mantido`); o mockup só vai inteiro depois do R9-C1.
