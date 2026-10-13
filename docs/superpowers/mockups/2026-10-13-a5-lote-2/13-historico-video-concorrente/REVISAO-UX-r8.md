# Revisão de UX, rodada 8: Mockup 13, Histórico do vídeo de concorrente (A5, lote 2)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Lido: `REVISAO-UX-r7.md`, `NOTAS.md` (seções 16 e 17), `CONVENCOES.md`, `m13.js`, `m13-dados.js`, `m13-graf.js`.
Como medi: servidor estático próprio nas portas 47751 a 47764 (todas derrubadas ao terminar; a 3099 e os specs do projeto não foram tocados) e Chromium headless do Playwright. Refiz as 56 capturas com o `capturar.mjs` do lote e abri e olhei: `cheio` 1440 escuro (página inteira), `aovivo` 1440 escuro (topo), `semanal` 1440 escuro, `naomedido`, `zero`, `semanal` e `magro` a 390 claro (faixa de cima), `cheio` 390 claro (blocos de 72 horas e dia a dia). Medi no DOM: geometria do SVG das 72 horas (posição do eixo, da hachura, da marca de publicação e da linha de 1/2 contra o `cw` de cada barra), altura de barra por valor nos 11 estados com barra (razão altura por view constante), largura dos pares de barras e posição da régua contra os números, contraste de texto computado em 4 cruzamentos de largura e tema, os ⓘ (abrir, caber na tela, Esc, foco, 44 px) em 3 estados, e a leitura ponto a ponto dos três gráficos.

Evidência nova desta rodada (em `shots/`):
- `r8-B1-eixo-72h-uma-hora-adiante-1440-escuro.png` e `r8-B1-eixo-72h-uma-hora-adiante-390-claro.png`
- `r8-C1-naomedido-mudou-neste-dia-1440-escuro.png`

## Resumo

**Veredito do mockup: NÃO VAI AO DONO. 1 "bloqueia", 1 "corrige", 5 sugestões.**

O que a r7 pediu foi resolvido de verdade (tabela abaixo): a leitura das 72 horas agora sai em ordem nos 8 estados (72 de 72 intervalos de 1 hora, 0 saltos, 0 voltas), a conta do `semanal` fecha (44.910 + 27.449 + 1.470 = 73.829) e o ⓘ do `semanal` diz o que faltava. 56 de 56 cruzamentos sem rolagem horizontal, 0 texto abaixo de 12 px, 0 alvo abaixo de 44 px a 390, 0 erro de script nos 14 estados nas duas larguras, 0 `color-mix` em CSS que carrega a interface.

O que sobrou é a mesma classe de erro que derrubou o mockup em todas as rodadas, agora **no desenho e não no texto**: o eixo do gráfico das 72 horas diz uma hora e o texto, a legenda e a leitura dizem outra. Os scripts das rodadas anteriores (os meus inclusive) conferiam texto contra texto; nenhum conferia o texto contra a posição do que está desenhado. Fiz isso nesta rodada.

1. **R8-B1 (bloqueia).** Nos 8 estados com as 72 horas, o gráfico está numa escala de "hora depois de publicar" (barra j ocupa o espaço j a j+1 a partir da marca de publicação), mas o eixo e a leitura usam a hora do relógio. Resultado: a barra que a leitura chama de "01:00 a 02:00" está desenhada onde o eixo diz 02:00 a 03:00; a hachura de "não medido" termina onde o eixo diz 02:00 e o texto diz "primeira contagem às 01:00"; a marca "publicado 20:40" fica onde o eixo diz 21:00. Diferença: 60 min nas barras, 20 a 40 min na marca de publicação e 30 min na linha de "1/2 das views". A r5 (S2) chamou isso de "até 50 min à esquerda" e aceitou como sugestão: errei duas vezes, na grandeza (é exatamente 1 hora nas barras) e na gravidade (é número contradito pelo próprio desenho, que é o que o dono cobra).
2. **R8-C1 (corrige).** `naomedido`: a leitura do dia 11/10 e a tabela dizem "Mudou neste dia: miniatura" e a lista diz "em algum momento entre 10/10 e 12/10 (a contagem ficou parada)". A frase afirma um dia que o dado não sustenta.
3. Varredura de coerência dos números de exemplo (seção própria abaixo): tudo o mais fecha, em todos os estados e nas duas larguras.

## A pergunta do dono e o relance

Pergunta: **"Esse vídeo foi bem para a idade dele, e algo que o canal mexeu veio antes de ele subir?"**
1440 escuro: responde em 3 s em todo estado com dado (frase-resumo com número em destaque e símbolo; faixa de cinco números dentro da primeira tela; pares de barras com a razão; régua das 72 horas; faixa verde da subida com a lista de mudanças). Os estados sem dado (`vazio`, `magro`, `naomedido`, `semanal`, `carregando`, `erro`) dizem o que falta e quando passa a existir. 390 claro: o resumo começa abaixo da primeira tela (casca do lote 1; sugestão S5 mantida desde a r2, não bloqueia).

## Bloqueios

### R8-B1. Eixo das 72 horas uma hora adiante da leitura, da hachura e do texto

**Estados e largura:** `cheio`, `extremo`, `recente`, `zero`, `saiu`, `mantido`, `aovivo`, `leitura`; 1440 e 390, dois temas (mesmo código `G.horas`, `m13-graf.js:99-157`).

**Evidência (captura):** `shots/r8-B1-eixo-72h-uma-hora-adiante-1440-escuro.png` e `...-390-claro.png`. Com o cursor na quarta barra (`cheio`), a leitura diz "qui 08/10, 23:00 a 00:00: não medido..."; a caixa laranja da barra marcada **começa exatamente sobre o traço "00:00 sex 09/10" do eixo e segue para a direita dele**. Uma barra que começa à meia-noite de sexta está sendo descrita como a hora das 23:00 de quinta.

**Medidas no DOM (`cheio`, 1440; `cw` = 15,16 px por barra):**

| O que | Posição | Lido no eixo | Diz o texto | Diferença |
|---|---|---|---|---|
| Traço "00:00 sex 09/10" | x = 81,7 | 00:00 | 00:00 | referência |
| Marca "publicado qui 08/10, 20:40" | x = 36,2, 3,00 barras antes do traço | 21:00 | 20:40 | 20 min |
| Fim da hachura (não medido) | x = 112,0, 2,00 barras depois do traço | 02:00 | "primeira contagem às 01:00" | **60 min** |
| 1ª barra medida ("sex 09/10, 01:00 a 02:00: 300 views") | começa em x = 112,0 | 02:00 a 03:00 | 01:00 a 02:00 | **60 min** |
| Linha "1/2 das views" (metade em 22 h) | x = 377,4, 4,5 barras antes do traço de sáb 10/10 | 19:30 | 22 h depois de 20:40 = 18:40 a 19:00 | 30 a 50 min |

Mesmo desvio nos outros estados (medido): `extremo` (publicado 18:20): a hachura termina 2,0 barras depois do traço "00:00 sáb 10/10" (lido 02:00) e a leitura diz primeira contagem 01:00; `recente` (11:20): a hachura termina 10,0 barras antes do traço "00:00 dom 11/10" (lido 14:00; leitura e texto 13:00); `saiu` (16:00) e `aovivo` (19:00) iguais, 60 min. A distância entre a marca de publicação e o fim da hachura é de 5,0 barras em `cheio` (o texto diz 4 h 20 min) e de 7,0 em `extremo` (o texto diz 6 h 40 min): o desenho conta uma hora cheia por barra, inclusive a barra parcial.

**Causa:** `m13-graf.js`: a barra j é posta em `L + cw*j` (escala "j horas depois da publicação", a mesma da régua de 0 a 72 h embaixo, que está certa). Mas o traço do eixo é posto na borda esquerda da barra que **termina** às 00:00 ou 12:00 (`X(j) - cw/2` quando `x.hc === 0 || 12`), isto é, na hora 23:00 ou 11:00 da barra; e a leitura nomeia a barra pelo intervalo do relógio (`rot`). Três escalas no mesmo desenho.

**Conserto exato:** desenhar o gráfico numa escala só, a do tempo real. Cada barra de `cfg.horas` já traz `t` (horas desde a publicação até o fim da hora). Em `G.horas`:
1. `u = (W - L - R) / hs[71].t`.
2. Barra j: borda esquerda `L + max(0, hs[j].t - 1) * u`, borda direita `L + hs[j].t * u` (a 1ª barra, de 20:40 a 21:00, é parcial e é hachura de qualquer forma); largura desenhada = 72% do intervalo, como hoje.
3. Hachura: de `L` até `L + hs[jFirst].t * u`.
4. Traços do eixo (00:00 e 12:00): `x = L + hs[j].t * u` para o `j` cuja hora termina no 00:00 ou no 12:00 (o traço fica na borda direita da barra que termina nessa hora, não na esquerda).
5. Linha de "1/2 das views": `x = L + hs[metadeJ].t * u`.
6. Retângulos de toque (`ic-hit`): o mesmo intervalo da barra.
7. Texto da leitura e tabela escondida não mudam (já estão certos).

**Como conferir depois de consertar:** por script, para cada estado com as 72 horas, ler do SVG a posição do fim da hachura e a do traço "00:00" e converter em horas pela escala (distância / `cw`): tem de dar a hora da "primeira contagem" do texto (cheio 01:00; extremo 01:00; recente 13:00; zero 13:00; saiu 19:00; aovivo 01:00); e a marca de publicação tem de cair a `(hora do traço) - (horas até o traço)` = hora de publicação do texto (20:40 em `cheio`). Acrescentar uma linha por estado na tabela de coerência da NOTAS ("posição no eixo = hora do texto: sim/não").

**Por que bloqueia e não é "preferência":** não é estilo; é dado de exemplo que se contradiz dentro do mesmo estado, quando o dono passa o mouse na barra e olha o eixo logo embaixo. É a classe que o dono já apontou e que cada rodada anterior derrubou. Está em 8 dos 14 estados e em todas as larguras.

## Corrige (vai ao dono só depois de corrigido)

### R8-C1. `naomedido`: "Mudou neste dia" afirma um dia que o dado não sustenta

**Estado:** `naomedido`, 1440 e 390 (a tabela "Mudanças no dia" e a leitura do gráfico).
**Evidência:** `shots/r8-C1-naomedido-mudou-neste-dia-1440-escuro.png`. Com o cursor em 11/10, a leitura termina "Mudou neste dia: miniatura (mudança 1)"; a lista logo abaixo diz "Miniatura em algum momento entre 10/10 e 12/10 (a contagem ficou parada)". A contagem das 12:00 de 11/10 não veio; a mudança pode ter sido em qualquer hora entre as leituras de 10/10 e de 12/10, isto é, tanto na barra de 11/10 quanto na de 12/10. A leitura de 12/10 não menciona a mudança. A frase "nenhuma frase afirma mais do que o dado sustenta" é regra do dono.
**Conserto exato:** na leitura de 11/10 e na linha de 11/10 da tabela, trocar "Mudou neste dia: miniatura (mudança 1)" por "Mudou entre 10/10 e 12/10, em momento que a contagem parada não mostra: miniatura (mudança 1)"; repetir a mesma frase na leitura e na tabela de 12/10 (os dois dias não separados); a marca 1 fica onde está (entre os dois dias).

## Sugestões (não bloqueiam)

- **S1. Primeira hora das 72 horas começa antes de o vídeo existir.** Em `cheio`, a leitura e a tabela escondida dizem "qui 08/10, 20:00 a 21:00: não medido" num vídeo publicado às 20:40. Depois do conserto do B1 a barra é parcial: escrever "20:40 a 21:00" (hora da publicação, não a hora cheia) na primeira linha, só nas leituras e na tabela.
- **S2. "24/08: o YouTube mudou a regra de contar views" é afirmação de fato sobre o YouTube** na linha tracejada e no ⓘ do `semanal`, vinda de uma constante de exemplo (`D.CORTE`). A tela tem a marca "exemplo", mas o implementador pode copiar a frase. Anotar na NOTAS (seção 5, dado real contra exemplo) que a data e a frase têm de vir de fonte real, ou cortar a linha.
- **S3. "o servidor não respondeu" no `erro`.** Aceitável, mantido de rodadas anteriores.
- **S4. Resumo abaixo da primeira tela a 390.** Mantido desde a r2 (casca do lote 1).
- **S5. Marcas do normal das 72 horas (1/4, 1/2, 3/4) são exemplo digitado** (o n vem da lista; os horários não). Aceito; dizer na NOTAS que o implementador calcula.

## Conferência da r7

| Item | Resultado | Evidência |
|---|---|---|
| R7-C1 (leitura "23:00 a 00:00" com a data do dia seguinte) | resolvido | Leitura ponto a ponto, 72 pontos nos 8 estados: cada intervalo dura 1 hora e começa exatamente 1 hora depois do anterior; 0 saltos, 0 voltas, 0 sem padrão. Última leitura: "Total até aqui" = total do cabeçalho de cada gráfico (9.671, 85.708, 10.803, 27, 7.016, 7.016, 9.606, 9.671) |
| R7-C2 (conta do `semanal` e dois dias sem explicação) | resolvido | NOTAS: 44.910 + 27.449 + 1.470 = 73.829 (refeito à mão: confere; as 5 médias x 7 = 27.447, 2 a menos por arredondamento, dito). ⓘ aberto: "Views agora inclui os dias depois da última semana fechada (de 09/11 a 11/11)." |
| S1 (tabela das horas) | resolvido, com a sugestão S1 desta rodada | 72 de 72 linhas "dd/mm hh:00 a hh:00", título "Views nessa hora" |
| S2 (`semanal` com a lista) | resolvido | "Mudanças deste vídeo: Título em 21/10", sem marca de subida; o ⓘ diz isso |
| S3 (aba "Mudanças" entre estados de 11/11) | resolvido | `cheio`, `extremo`, `semanal`, `leitura`: aba "31" e pager "vídeo 1 de 31"; os de 13/10: 12 e 12 |
| S4 (frase da hachura no `semanal`) | resolvido | ⓘ e leitura do ponto dizem a mesma frase: "primeira contagem do vídeo, sem a anterior para tirar a diferença (não medido)" |
| NOTAS seção 16 | conferida, uma linha incompleta | A tabela de coerência da seção 17 não tem linha de posição de desenho (B1); o texto "0 diferenças" é verdadeiro para texto, não para geometria |
| NOTAS seção 17 | conferida | Todas as linhas conferem com a tela; a nova linha "dia da semana de cada data": 0 divergências por regex sobre os 14 estados (1440), `(seg|ter|...) dd/mm` contra o calendário de 2026 |

## Varredura de coerência dos números de exemplo (feita agora, em todos os estados, de uma vez)

Método desta rodada, além do que a r7 fez (texto, tabelas, leitura por seta): **geometria contra número** (o que o desenho mostra contra o que a tela escreve) e **frase contra dado** (o que cada frase afirma contra o que o dado permite).

**Fecha (por script e à mão):**
- Altura de barra por view: razão altura/valor constante nas 72 horas e no dia a dia, em 11 estados e 2 larguras (por exemplo `cheio` 0,400 px por view nas horas e 0,01133 nos dias; variação 0,000); nenhuma barra ficou no piso de 3 px.
- Pares de barras (1, 7 e 30 dias): largura proporcional ao valor (`cheio`: 5.440 e 5.200 = 1,0000 e 0,9559; 13.535 e 15.160 = 0,8928 e 1,0000; 94.319 e 33.760 = 1,0000 e 0,3579; `extremo` 30 dias 0,0488 = 47.270 / 968.554; `zero` 20 e 160 = 0,125).
- Régua das 72 horas: posição em % = horas / 72 (7 h = 9,72%; 22 h = 30,56%; 40 h = 55,56%; 23 h = 31,94% em `extremo`).
- Soma dos dias, horas até as 12:00 contra a barra do dia, primeira contagem + horas seguintes = total das 72 horas, marcos, razões, "fecha em", "faltam": refiz a conta lendo a tela e as leituras (não só os cartões); nenhuma diferença nos 14 estados.
- n por idade e n das 72 horas contra a lista do canal: 14, 14, 14, 13, 12, 10, 7, 5 em 11/11; 5, 4, 3, 3, 2 em 13/10; 13 e 2 nas 72 horas; fechou também a regra "menos de 3 é não medido" (`zero`: 7 dias com n = 2; `naomedido`: 7 dias com n = 2).
- Datas: dia da semana de todo "dd/mm" da tela, dos ⓘ e das leituras (0 divergências); "há N dias" (34, 33, 3, 40, 9, 8, 92, 9, 9, 5); nenhuma data de mudança anterior à publicação nem posterior ao dia da tela; `naomedido`: 1 ponto com contagem em 5 que já existem (idades 1, 2, 3, 5, 7), os outros 4 com motivo.
- Frases "N de M": nenhuma com N maior que M nos 14 estados.
- Textos nas duas larguras: os conjuntos de números e datas de 390 e de 1440 coincidem, salvo os rótulos de eixo que o 390 afina (esperado) e a quebra de linha.

**Não fecha (só isto):** R8-B1 (eixo das 72 horas contra leitura, hachura e texto, 8 estados) e R8-C1 (`naomedido`, "mudou neste dia"). Mais as sugestões S1 e S2.

**Para a NOTAS (quem desenhou):** acrescentar à tabela de coerência, por estado com as 72 horas, as linhas "posição da hachura no eixo = hora da primeira contagem", "posição da marca de publicação = hora de publicação" e "posição da linha de 1/2 = horas do marco", cada uma com o número medido e o número do texto; e, para `naomedido`, a linha "mudança com contagem parada: a frase não nomeia um dia".

## Veredito por estado e por largura

| Estado | 1440 escuro | 390 claro | Outros cruzamentos | Pendências |
|---|---|---|---|---|
| `cheio` | volta para ajuste | volta para ajuste | idem | R8-B1 |
| `extremo` | volta para ajuste | volta para ajuste | idem | R8-B1 |
| `recente` (caso real de hoje) | volta para ajuste | volta para ajuste | idem | R8-B1 |
| `magro` | pronto | pronto | pronto | nenhuma |
| `zero` | volta para ajuste | volta para ajuste | idem | R8-B1 |
| `naomedido` | volta para ajuste | volta para ajuste | idem | R8-C1 |
| `semanal` | pronto | pronto | pronto | nenhuma (S2 é sugestão) |
| `saiu` | volta para ajuste | volta para ajuste | idem | R8-B1 |
| `mantido` | volta para ajuste | volta para ajuste | idem | R8-B1 |
| `aovivo` | volta para ajuste | volta para ajuste | idem | R8-B1 |
| `vazio` | pronto | pronto | pronto | nenhuma |
| `carregando` | pronto | pronto | pronto | nenhuma |
| `erro` | pronto | pronto | pronto | nenhuma |
| `leitura` | volta para ajuste | volta para ajuste | idem | R8-B1 (cópia do `cheio`) |

Nenhum estado reprovado. Cinco dos 14 estados estão prontos (`magro`, `semanal`, `vazio`, `carregando`, `erro`; `naomedido` depende de duas frases); os 8 com as 72 horas ficam prontos com um conserto em `G.horas` (uma escala só). O B1 é de uma função; o C1 são duas frases.

## Cobrança do dono, ponto a ponto

| Regra | Resultado |
|---|---|
| Frase-resumo no topo | sim, em todo estado com dado; os sem dado dizem o que falta e quando existe |
| Régua ou barra para comparar de relance | sim (pares de barras proporcionais, régua de 72 horas, barras por dia, faixa da subida), **menos** o eixo das 72 horas, que está uma hora fora (B1) |
| Cor estável por significado com símbolo | sim: azul/círculo = o vídeo, areia/quadrado tracejado = normal, verde/▲ = subida, rosa hachurado = não medido, caixa vazada = zero medido, pontilhado = ainda não existe. Contraste de elemento gráfico medido: barra azul 6,80:1 (escuro) e 4,43:1 (claro); areia 11,88 e 8,32; zero 4,97 e 4,84; hachura (linha) 4,09 e 4,57; verde da subida 7,26 e 6,37; marcador de mudança 14,48 e 15,76. Todos acima de 3:1. Escala de cinza não refeita (nada mudou no desenho; forma e símbolo sustentam cada estado) |
| "Zero medido" distinto de "não medido" | sim (`zero`: 47 caixas vazadas nas horas e 2 nos dias; hachura só onde a contagem não existe) |
| Método no botão de informação | sim, 3 a 4 ⓘ por estado, 44 x 44 a 1440 e a 390; abrem dentro da tela, fecham com Esc, o foco volta ao botão (3 estados x 2 larguras) |
| Sem prosa nem bloco monocromático | sim |
| Frases sem jargão interno | sim ("servidor" no `erro` é aceitável) |
| Sem `color-mix()` em CSS que carrega a interface | sim (só comentários "sem color-mix") |
| Escuro a 1440 e claro a 390 | pares abertos nesta rodada: `cheio` (1440 escuro e 390 claro), `semanal` (1440 escuro), `aovivo` (1440 escuro, topo), `naomedido`, `zero`, `magro` (390 claro, topo); o resto por medição |
| Alvo de 44 px | 0 abaixo de 44 em 28 de 28 (390); ⓘ 44 x 44 também a 1440 |
| Números de exemplo que se contradizem | 1 contradição de desenho (B1) e 1 frase mais forte que o dado (C1); nada mais, em 14 estados e duas larguras |

## Tabela de medidas

| Medida | Resultado |
|---|---|
| Rolagem horizontal (`capturar.mjs`, 14 estados x 4 cruzamentos) | 0 px em 56 de 56 |
| Texto abaixo de 12 px | 0 em 56 de 56 |
| Alvos abaixo de 44 px a 390 (toque) | 0 em 28 de 28 |
| Erros de script, 14 estados, 1440 e 390 | 0 |
| Contraste de texto (computado, 11 estados, fundo composto pelos pais) | menor 4,86:1 (1440 escuro e 390 escuro), 5,01:1 (1440 claro e 390 claro); nenhum texto abaixo de 4,5:1 |
| Contraste de elemento gráfico | menor 4,09:1 (linha da hachura, escuro); todos acima de 3:1 |
| Eixo das 72 horas: hachura contra "primeira contagem" do texto | 60 min de diferença em `cheio`, `extremo`, `recente`, `saiu`, `aovivo` (medido); `zero`, `mantido`, `leitura` pelo mesmo código |
| Marca de publicação contra hora do texto | 20 min (`cheio`, 20:40), 40 min (`extremo` 18:20, `recente` 11:20) |
| Leitura das 72 horas em ordem | 72 de 72, 0 falhas nos 8 estados |
| Razão altura por view das barras (horas e dias) | constante (variação 0,000) em 11 estados e 2 larguras |
| Alturas de página, 1440 | `cheio` 3.789; `semanal` 2.512; `aovivo` 3.452 |
| Alturas de página, 390 | `cheio` 5.558; `extremo` 6.026; `recente` 4.915; `magro` 3.746; `zero` 4.903; `naomedido` 4.384; `semanal` 3.701; `saiu` 5.130; `aovivo` 4.738; `vazio` 2.619; `carregando` 2.397; `erro` 1.922; `leitura` 5.674 |

## O que não consegui verificar

Leitor de tela (VoiceOver, NVDA): só `aria-label` e `aria-live` por script. Safari e Opera: a hachura SVG e o `popover` do ⓘ não foram vistos lá (a ausência de `color-mix` protege o Opera). Movimento reduzido: só por leitura do CSS. Escala de cinza: não simulada de novo nesta rodada (o desenho não mudou desde a r6, que simulou `zero` e `extremo`). Ordem de foco por Tab fora dos ⓘ: não refeita. Capturas olhadas nesta rodada: 9 das 56 (listadas no topo); as demais, por medição e por texto. O mundo de exemplo (lista `PUBS_OUTROS`, datas de novembro, a data "24/08") é inventado: conferi a coerência interna, não a verdade. A barra "Estados do mockup" não faz parte da tela e não foi avaliada. O ajuste do B1 muda a posição das barras das 72 horas e a largura da barra parcial: tenho de olhar de novo `cheio`, `extremo` e `recente` a 390 e 1440 depois do conserto (rótulo "maior hora medida", linha de 1/2 e o traço "00:00" encostando na borda esquerda a 390).

## Condição para a rodada 9 (ou para ir ao dono)

1. R8-B1: uma escala de tempo só no gráfico das 72 horas (conserto exato acima), com as três linhas novas na tabela de coerência da NOTAS e a conferência por script da posição contra o texto nos 8 estados.
2. R8-C1: duas frases (leitura e tabela de 11/10 e 12/10 no `naomedido`).
3. Sugestões S1 (primeira hora "20:40 a 21:00") e S2 (origem da data "24/08") valem fazer junto; não seguram o envio.
Conserto feito, o que eu meço de novo: o eixo das 72 horas nos 8 estados (hachura, publicação, 1/2 e traços contra o texto), a leitura ponto a ponto, e a leitura de 11/10 e 12/10 do `naomedido`. Cinco estados já podem ir ao dono como estão; se a pressa for grande, o dono pode ver `magro`, `semanal`, `vazio`, `carregando` e `erro` enquanto o B1 é consertado, mas o mockup só vai inteiro depois.
