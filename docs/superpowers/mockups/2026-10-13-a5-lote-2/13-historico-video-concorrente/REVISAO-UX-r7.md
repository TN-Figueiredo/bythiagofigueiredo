# Revisão de UX, rodada 7: Mockup 13, Histórico do vídeo de concorrente (A5, lote 2)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Lido: `REVISAO-UX-r6.md`, `NOTAS.md` (seções 14 e 15), `CONVENCOES.md`, `m13.js`, `m13-dados.js`, `m13-graf.js`.
Como medi: servidor estático próprio nas portas 47731 a 47734 e 47741 (todas derrubadas ao terminar; a 3099 e os specs do projeto não foram tocados) e Chromium headless do Playwright. Refiz as 56 capturas com o `capturar.mjs` do lote (14 estados x 1440/390 x escuro/claro). Abri e olhei: `extremo` e `semanal` a 1440 escuro; `extremo` a 390 claro (três faixas da página, do resumo ao fim da lista de mudanças); o gráfico das 72 horas de `cheio` com um ponto selecionado.
Varredura de coerência desta rodada, por script sobre o DOM e sobre `M13_DEBUG`, nos 14 estados: texto visível, tabelas escondidas, ⓘ, `aria-label`, e (novo nesta rodada) **o texto de leitura de cada ponto dos três gráficos** (setas Home/Direita em 72 horas, dias e idades; 9 estados, 10 + 72 + até 35 pontos cada). Refiz do zero em Python: soma dos dias = total; horas até as 12:00 = barra do dia (21 conferências, 0 diferenças); primeira contagem + horas seguintes = total das 72 horas; marcos de 1/4, 1/2 e 3/4 contra as tabelas; "metade em N horas"; o n por idade e o n das 72 horas contra a lista `PUBS_OUTROS` (recontado por mim, 14 estados, 0 diferenças); "há N dias", "fecha em", "faltam", dias da semana; razões; subida (soma dos 7 dias seguintes e dos 7 antes).

Evidência nova desta rodada: `shots/r7-C1-hora-23-00-com-a-data-do-dia-seguinte-1440-escuro.png`.

## Resumo

**Veredito do mockup: AINDA NÃO VAI AO DONO. 0 "bloqueia" de desenho, 2 "corrige", 5 sugestões.**
Pelo rito (CONVENCOES, seção 7), "corrige" aberto segura o envio. Os dois são de uma ou duas linhas.

O que a r6 pediu foi resolvido de verdade (tabela abaixo) e o ajuste não criou defeito de layout: 56 de 56 cruzamentos sem rolagem horizontal, 0 texto abaixo de 12 px, 0 alvo abaixo de 44 px a 390, 0 erro de script nos 14 estados a 1440, 0 `color-mix` em CSS que carrega a interface. Os números que a tela mostra de forma direta fecham, em todos os estados.

O que sobrou é uma contradição que **só aparece quando se lê o gráfico ponto a ponto**, e uma frase da NOTAS que a conta desmente:
1. **R7-C1.** Nas 72 horas, a leitura da hora "23:00 a 00:00" sai com a data do dia seguinte ("sex 09/10, 23:00 a 00:00" logo antes de "sex 09/10, 00:00 a 01:00"). Acontece 3 vezes por gráfico, em 8 estados.
2. **R7-C2.** A NOTAS (seção 15, linha do `semanal`) afirma "5 médias x 7 + a 1ª contagem = 73.829". A conta dá 72.357. Faltam 1.472 views, que são os 2 dias entre o último ponto semanal (09/11) e o dia da tela (11/11), e a tela não diz isso.
3. A varredura da r6 e a seção 15 da NOTAS não cobriam os textos de leitura por ponto; por isso a frase final da seção 15 ("nenhuma contradição aberta") era verdadeira só para o que estava na página.

## A pergunta do dono e o relance

Pergunta: **"Esse vídeo foi bem para a idade dele, e algo que o canal mexeu veio antes de ele subir?"**
1440 escuro: responde em 3 s em todo estado com dado (frase-resumo com número em destaque e símbolo, faixa de 5 números dentro da primeira tela, pares de barras que dão a razão, régua de 72 horas, faixa verde da subida com a lista de mudanças). Os estados sem dado (`vazio`, `magro`, `naomedido`, `semanal`, `carregando`, `erro`) dizem o que falta e quando passa a existir. 390 claro: o resumo começa abaixo da primeira tela (casca do lote 1; sugestão mantida desde a r2).

## Bloqueios

Nenhum.

## Corrige (vai ao dono só depois de corrigido)

**R7-C1. `cheio`, `extremo`, `recente`, `zero`, `saiu`, `mantido`, `aovivo`, `leitura` (os 8 estados com as 72 horas; 1440 e 390): a leitura da hora das 23:00 às 00:00 leva a data do dia seguinte.**
Evidência: `shots/r7-C1-hora-23-00-com-a-data-do-dia-seguinte-1440-escuro.png`. Com o foco no gráfico e a quarta barra selecionada (`cheio`), a legenda diz "sex 09/10, 23:00 a 00:00: não medido..."; a barra marcada está à esquerda do "00:00 sex 09/10" do eixo, isto é, é de quinta 08/10. A seta seguinte diz "sex 09/10, 00:00 a 01:00": a sequência volta de 23:00 para 00:00 no mesmo dia. Por script, em 6 estados (`cheio`, `extremo`, `recente`, `zero`, `saiu`, `aovivo`): 3 pontos de 72 em cada gráfico saem de ordem, 18 ao todo (`cheio`: índices 3, 27 e 51; `extremo`: 5, 29 e 53). `mantido` e `leitura` usam o mesmo código e os mesmos dados (`saiu` e `cheio`); não os percorri ponto a ponto. `naomedido` não tem gráfico de 72 horas, e `magro`, `semanal`, `vazio` não são afetados. Casos reais na leitura: "sáb 10/10, 23:00 a 00:00: 190 views. Total até aqui: 6.104" (`cheio`) é de sexta 09/10; "qua 07/10, 23:00 a 00:00: 0 views (medido)" (`zero`) é de terça 06/10.
Causa: `m13.js:433`, `fala` das horas: `A.ds(x.d)` usa a data do instante da contagem (o fim do intervalo) e o início do intervalo é `(x.hc + 23) % 24`; quando a contagem é à 00:00, o início (23:00) é do dia anterior.
Conserto exato: em `m13.js:433`, trocar `A.ds(x.d)` por `A.ds(x.hc === 0 ? D.addDias(x.d, -1) : x.d)`. Refazer o conferidor para os 6 estados (o intervalo 23:00 a 00:00 passa a trazer a data do dia em que começa).

**R7-C2. NOTAS, seção 15, linha do `semanal`: a conta escrita não fecha, e a tela não explica a diferença.**
Evidência: leitura por ponto do gráfico semanal e `M13_DEBUG`: contagens acumuladas 05/10 = 44.910, 12/10 = 49.964, 19/10 = 55.023, 26/10 = 61.799, 02/11 = 67.283, 09/11 = 72.359, 11/11 = 73.829. Médias por dia: 722, 723 (722,7), 968, 783, 725. A NOTAS diz "5 médias x 7 + a 1ª contagem = 73.829": 27.447 + 44.910 = **72.357**, não 73.829. Os 1.472 que faltam são os 2 dias de 09/11 a 11/11 (735 por dia). Na tela: "Views agora 73,8 mil", último ponto semanal em 09/11 e o eixo vai até 11/11; nada diz que "views agora" tem 2 dias a mais que a última semana fechada. A leitura do ponto "Semana de 05/10: primeira contagem do vídeo (44.910 views no total)" também não bate com o número que a NOTAS cita como primeira contagem.
Conserto exato: (1) corrigir a linha da NOTAS para "44.910 (05/10) + 5 semanas x 7 dias (27.447) + 2 dias de 09/11 a 11/11 (1.472) = 73.829"; (2) no ⓘ do gráfico semanal, acrescentar: "Views agora inclui os dias depois da última semana fechada (09/11 a 11/11)." (a data sai de `SEM_DATAS` e do dia da tela, não digitada).

## Sugestões (não bloqueiam)

- **S1. Tabela das horas e leitura dizem a mesma hora de dois jeitos.** A tabela escondida de `cheio` tem a linha "09/10 02:00 = 300" sob o título "Hora (São Paulo)"; a leitura do ponto diz "01:00 a 02:00: 300 views". Quem confere a tabela contra a legenda lê 300 views às 02:00 e 300 views entre 01:00 e 02:00. Troque o título da coluna por "Hora que termina em (São Paulo)" ou escreva o intervalo na linha ("01:00 a 02:00"). Mesma regra para a coluna de datas depois do conserto da R7-C1.
- **S2. `semanal` não mostra a mudança que existe nos dados.** Os dados têm uma troca de título em 21/10; a tela só diz "não dá para dizer se uma mudança veio antes de uma subida". Para o dono comparar, a lista "Mudanças deste vídeo" (1 item, "Título em 21/10") pode aparecer abaixo da pílula "inconclusivo", sem faixa nem número de ordem no gráfico. Se a decisão foi esconder, diga no ⓘ.
- **S3. A contagem de "Mudanças" da casca difere entre estados do mesmo dia de exemplo.** `cheio`, `semanal` e `leitura` (todos em 11/11) mostram "Mudanças 12"; `extremo` (11/11) mostra 31. Cada tela é coerente consigo (14 mudanças do vídeo, pager "1 de 31"); a diferença só aparece a quem troca de estado. Alinhar os três em 31 (como no `extremo`) tira a pergunta.
- **S4. Texto da legenda "contagem incompleta".** O ⓘ do `semanal` chama a hachura de "contagem incompleta"; o motivo real na leitura do ponto é "primeira contagem, sem a anterior para tirar a diferença". Usar a mesma frase nos dois.
- **S5. Mantidas das rodadas anteriores:** eixo de horas até 50 min à esquerda da hora real (r5 S2; as 72 horas terminam em 71 h 20 min no `cheio`: última leitura "dom 11/10, 19:00 a 20:00"); "servidor" no `erro` (aceitável); resumo abaixo da primeira tela a 390 (r2 S1); as marcas do normal das 72 horas (1/4, 1/2, 3/4) são dado de exemplo digitado, o n delas sai da lista (aceito).

## Conferência da r6

| Item | Resultado | Evidência |
|---|---|---|
| R6-C1 (`semanal`: duas regras para a contagem por hora) | resolvido | Tela: "publicado em 11/08/2026, antes de 04/10: a contagem por hora começou nesse dia e só vale para vídeos publicados depois"; igual ao `magro` e ao ⓘ. Nenhum "até 14 dias" sobrou |
| R6-C2 (ⓘ do `semanal`: hachura x pontilhado) | resolvido, com a sugestão S4 | ⓘ aberto no DOM: "Pontilhado: semanas sem contagem, antes de 05/10. Hachura: a semana que termina em 05/10, com contagem incompleta (não medido)." A faixa larga pontilhada e a fatia hachurada da captura são o que o texto descreve |
| R6-C3 (n do normal das 72 horas digitado) | resolvido | Recontei contra `PUBS_OUTROS`: 13 em `cheio`, `extremo`, `leitura` (11/11), 2 nos demais (13/10); 0 diferenças. Tela de `cheio`/`extremo`: "normal do canal (13 vídeos)"; `recente`, `zero`, `saiu`, `mantido`, `naomedido`, `aovivo`: "só 2 vídeos com as 72 horas completas (o mínimo é 3)", e a marca fica "não medido" |
| R6-S1 (barra do dia da subida do `extremo`) | resolvido | 17/10 = 8.513 (como as vizinhas); primeira barra alta, 18/10 (87.626), abre a faixa verde; o ⓘ diz que a barra do dia da subida fica entre as duas faixas. Subida refeita: 520.210 = soma de 18/10 a 24/10; 87.305 dos 7 dias antes; 74.316 contra 12.472 por dia; 5,96 vezes. A razão deixou de coincidir com o "6,4× o normal" do cartão de 1 dia |
| R6-S2 ("primeira contagem por dia") | resolvido | `vazio`: "a primeira contagem por dia é às 12:00 de amanhã" |
| R6-S3 (datas fixas) | resolvido | `grep` de "03/10" e "04/10" em `m13.js`: só em comentário |
| R6-S4 (`carregando` sem pager) | resolvido | Texto do `carregando`: "vídeo 1 de 12" presente |
| R6-S5 (rótulo cruzado pela linha a 390) | resolvido | Captura de `extremo` a 390 claro: "969 mil" livre da linha; "47,3 mil" acima do marcador |
| Extra (`aovivo`: "2 vídeos saíram da conta") | resolvido | "vídeos ao vivo ou estreia não entram na conta do normal" |
| NOTAS seção 14 | conferida | Todas as linhas conferem com a tela, salvo a afirmação final "nenhuma contradição aberta" (R7-C1) |
| NOTAS seção 15 | uma linha errada | Linha do `semanal` (R7-C2). As demais conferem (ver varredura) |

## Varredura de coerência dos números de exemplo (feita agora, em todos os estados, de uma vez)

**Fecha (por script e à mão):**
- Total do cabeçalho = soma dos dias (+ primeira contagem): `cheio` 97.909, `extremo` 993.436, `recente` 10.846, `magro` 22.540 (20.106 + 2.434), `zero` 32, `naomedido` 11.542 (7.750 + 849 + 752 + 1.467 + 724), `semanal` 73.829 (ver R7-C2), `saiu`/`mantido` 7.657, `aovivo` 12.352, `leitura` = `cheio`.
- Horas até as 12:00 de cada dia = barra do dia, nos 8 estados com horas: 21 conferências, 0 diferenças.
- Primeira contagem + horas seguintes = total das 72 horas: 9.671, 85.708, 10.803, 27, 7.016, 9.606; a última leitura do gráfico diz o mesmo "Total até aqui".
- Marcos: tela = tabelas (`cheio` 7/22/40; `extremo` não medido/23/39 com a primeira contagem em 26,3% do total; `recente` 8/17/36; `zero` 7/12/25; `saiu` 6/16/33; `aovivo` 9/25/46; `semanal` 11/28/49 calculado, não mostrado). Zero horas: `zero` 47 + 21 = 68 medidas, 72 - 4 não medidas.
- Idades: n por idade (14, 14, 14, 13, 12, 10, 7, 5 em 11/11; 5, 4, 3, 3, 2 em 13/10) = lista; razões (1,05; 0,89; 2,79; 6,44; 5,54; 20,49; 1,20; 0,125 mostrado como 0,1; 0,82; 0,74; 1,14 mostrado como 1,1); "fecha em" de 60 e 90 dias (08/12 e 07/01 em `cheio`; 09/12 e 08/01 em `extremo`); 5 dos 8 dias "não medido" e 1 dos 5 pontos com contagem em `naomedido` (9.226 entre as leituras de 09/10 e 10/10).
- Datas: "há N dias" (34, 33, 3, 40, 9, 8, 92, 9, 5), dias da semana de todos os rótulos (04/10 domingo, 08/10 quinta, 09/10 sexta, 13/10 terça), "faltam"/"fecha em" (3 + 12, 11 + 4, 9 + 6, 5 + 10 = 15; 28/10, 25/10, 19/10, 23/10, 17/10), nenhuma data de mudança anterior à publicação (14 mudanças do `extremo` = 12 dentro dos 14 dias antes de 17/10 + 2 fora; `cheio` 2 das 4).
- Pager e aba: `nMud` 12 e 31 coincidem com "vídeo 1 de N" em todos os estados.

**Não fecha (só isto):** R7-C1 (data da hora 23:00 a 00:00), R7-C2 (linha da NOTAS e dois dias sem explicação no `semanal`). Mais S1 (títulos de hora na tabela) e S3 (casca entre estados).

## Veredito por estado e por largura

| Estado | 1440 escuro | 390 claro | Outros cruzamentos | Pendências |
|---|---|---|---|---|
| `cheio` | volta para ajuste | volta para ajuste | idem | R7-C1 |
| `extremo` | volta para ajuste | volta para ajuste | idem | R7-C1 |
| `recente` (caso real de hoje) | volta para ajuste | volta para ajuste | idem | R7-C1 |
| `magro` | pronto | pronto | pronto | nenhuma |
| `zero` | volta para ajuste | volta para ajuste | idem | R7-C1 |
| `naomedido` | pronto | pronto | pronto | nenhuma (sem gráfico de 72 horas) |
| `semanal` | volta para ajuste | volta para ajuste | idem | R7-C2 (S2, S4) |
| `saiu` | volta para ajuste | volta para ajuste | idem | R7-C1 |
| `mantido` | volta para ajuste | volta para ajuste | idem | R7-C1 (mesmo código de `saiu`) |
| `aovivo` | volta para ajuste | volta para ajuste | idem | R7-C1 |
| `vazio` | pronto | pronto | pronto | nenhuma |
| `carregando` | pronto | pronto | pronto | nenhuma |
| `erro` | pronto | pronto | pronto | nenhuma |
| `leitura` | volta para ajuste | volta para ajuste | idem | R7-C1 (cópia do `cheio`) |

Nenhum estado reprovado. Todo "volta para ajuste" é só pelo R7-C1 (uma linha de código) e, no `semanal`, pelo R7-C2 (uma linha de NOTAS e uma frase no ⓘ). Conserto feito, o que eu meço de novo: a leitura ponto a ponto das 72 horas nos 8 estados (datas em ordem, nenhum "00:00 a 01:00" depois de "23:00 a 00:00" do mesmo dia) e o ⓘ do `semanal`.

## Cobrança do dono, ponto a ponto

| Regra | Resultado |
|---|---|
| Frase-resumo no topo | sim, em todo estado com dado; os sem dado dizem o que falta e quando existe |
| Régua ou barra para comparar de relance | sim (pares de barras proporcionais, régua de 72 horas, barras por dia, faixa da subida de 7 barras) |
| Cor estável por significado com símbolo | sim: azul/círculo = o vídeo, areia/quadrado tracejado = normal, verde/▲ = subida, rosa hachurado = não medido, caixa vazada = zero medido, pontilhado = ainda não existe. A escala de cinza não foi refeita nesta rodada (nada mudou no desenho; r6 simulou `zero` e `extremo`) |
| "Zero medido" distinto de "não medido" | sim (`zero`: 47 caixas vazadas nas horas e 2 nos dias; hachura só onde a contagem não existe) |
| Método no botão de informação | sim, 3 a 4 ⓘ por estado, 44 x 44, texto do `semanal` agora certo |
| Sem prosa nem bloco monocromático | sim |
| Frases sem jargão interno | sim ("servidor" no `erro` é aceitável) |
| Sem `color-mix()` em CSS que carrega a interface | sim (só comentários) |
| Escuro a 1440 e claro a 390 | pares abertos: `extremo` (1440 escuro e 390 claro), `semanal` (1440 escuro); os demais por medição |
| Alvo de 44 px | 0 abaixo de 44 em 28 de 28 (390) |
| Números de exemplo que se contradizem | 1 contradição na leitura por ponto (R7-C1) e 1 conta errada na NOTAS (R7-C2); nada na página aberta |

## Tabela de medidas

| Medida | Resultado |
|---|---|
| Rolagem horizontal (`capturar.mjs`, 14 estados x 4 cruzamentos) | 0 px em 56 de 56 |
| Texto abaixo de 12 px | 0 em 56 de 56 |
| Alvos abaixo de 44 px a 390 (toque) | 0 em 28 de 28 |
| Erros de script, 14 estados a 1440 (fontes bloqueadas) | 0 |
| Contraste de texto | não medido de novo: `a4.css`, `lote.css` e `m13.css` não mudaram desde a medida da r6 (arquivos de 11:54 e 13:06; a r6 é de 14:13): menor 4,86:1 a 1440 escuro e 4,73:1 a 390 claro. Mudou só `m13-graf.js` (posição do rótulo "969 mil" a 390 e a 1440): o texto fica sobre o fundo do cartão, sem cruzar linha, na captura |
| n do normal das 72 horas, tela contra lista | 13, 13, 13 (`cheio`, `extremo`, `leitura`) e 2 nos 11 demais; 0 diferenças |
| Horas até as 12:00 contra barra do dia | 21 de 21 iguais |
| Leitura ponto a ponto das 72 horas, datas em ordem | 18 pontos fora de ordem em 6 estados (3 por estado), todos "23:00 a 00:00" (R7-C1) |
| Alturas de página, 1440 | `cheio` 3.784; `extremo` 3.943; `recente` 3.516; `zero` 3.460; `saiu` 3.655; `aovivo` 3.449; `semanal` 2.429; `vazio` 1.726; `erro` 1.415 |
| Alturas de página, 390 | `extremo` 6.026 |

## O que não consegui verificar

Leitor de tela (VoiceOver, NVDA): só `aria-label` e `aria-live` por script. Safari e Opera: a hachura SVG e o `popover` do ⓘ não foram vistos lá (a ausência de `color-mix` protege o Opera). Movimento reduzido: só por leitura do CSS. Ordem de foco por Tab e Esc nos ⓘ: não refeitos (nada mudou desde a r6, que abriu o do `semanal`). Capturas olhadas: 3 de 56; as demais, só por medição e por texto. Contraste e escala de cinza: herdados da r6 (CSS idêntico). A leitura ponto a ponto percorri em 9 estados (`cheio`, `extremo`, `recente`, `magro`, `zero`, `naomedido`, `semanal`, `saiu`, `aovivo`); `mantido` e `leitura` por compartilharem código e dados. O texto que aparece ao passar o mouse é o mesmo da leitura por seta (mesma função `fala`), mas não passei o mouse. O mundo de exemplo (lista `PUBS_OUTROS`, datas de novembro) é inventado: conferi a coerência interna, não a verdade. A barra "Estados do mockup" não faz parte da tela e não foi avaliada.

## Condição para a rodada 8 (ou para ir ao dono)

Corrigir R7-C1 (`m13.js:433`, a data do início do intervalo) e R7-C2 (linha da NOTAS e frase no ⓘ do `semanal`). As sugestões podem ficar; S1 vale fazer junto (mesma coluna). Cinco dos 14 estados já estão prontos para o dono (`magro`, `naomedido`, `vazio`, `carregando`, `erro`); o `semanal` depende de uma frase e de uma linha da NOTAS; os 8 com 72 horas ficam prontos com o conserto de uma linha. Daqui em diante, a conferência da NOTAS deve incluir o texto de leitura por ponto dos três gráficos de cada estado, não só a página aberta.
