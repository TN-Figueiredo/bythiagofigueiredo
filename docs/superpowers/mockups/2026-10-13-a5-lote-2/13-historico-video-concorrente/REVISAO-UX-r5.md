# Revisão de UX, rodada 5: Mockup 13, Histórico do vídeo de concorrente (A5, lote 2)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Lido: `REVISAO-UX-r4.md`, `NOTAS.md` (seção 3, seção 10 "Resposta à r4" e seção 11, a tabela de coerência), `PLANO.md`, `CONVENCOES.md`, `m13.js`, `m13-dados.js`, `m13-graf.js`, `lote.js` (diferença contra o do lote 1: só `nMud` e `pager(total, daLista)`).
Como medi: servidor estático próprio nas portas 47741 a 47748 (derrubadas ao terminar; a 3099 e os specs do projeto não foram tocados) e Chromium headless do Playwright. Refiz as 56 capturas com o `capturar.mjs` do lote (14 estados x 1440/390 x escuro/claro). Abri por captura, olhando: `recente`, `cheio`, `extremo`, `naomedido`, `zero`, `saiu`, `aovivo`, `semanal`, `vazio`, `carregando` e `erro` a 1440 escuro; `recente`, `extremo`, `cheio`, `carregando` a 390 claro; `naomedido` e `zero` em escala de cinza. Para a varredura de coerência extraí por script, dos 14 estados: o texto da tela, os rótulos de aria, as tabelas escondidas ("Ver como tabela"), o texto dos 4 ⓘ (ficam em `<template>`, não aparecem no texto da tela) e o `M13_DEBUG`. Refiz de forma independente: soma dos dias = total; soma das horas até as 12:00 = barra do dia; "metade em N horas" recalculada das tabelas de horas; datas fora da janela [publicação, hoje]; "X de Y" com X > Y; dias da semana; "há N dias"; razões; "são N / faltam / fecha em"; palavras proibidas; contraste computado do DOM; ordem de foco por Tab.

Evidências novas desta rodada (em `shots/`): `r5-B1-semanal-info-descreve-o-dia-a-dia-1440-escuro.png`, `r5-C1-extremo-primeira-contagem-7h40-1440-escuro.png`, `r5-C2-cheio-faixa-subida-8-barras-1440-escuro.png`, `r5-C3-vazio-sincronizado-ha-3h-1440-escuro.png`.

## Resumo

**Veredito do mockup: NÃO PODE IR AO DONO nesta rodada. 1 bloqueio, 3 "corrige", 8 sugestões.**

O que a r4 pediu foi resolvido de verdade (tabela de conferência abaixo) e o ajuste não criou defeito de layout: 56 de 56 cruzamentos sem rolagem horizontal, sem texto abaixo de 12 px, 0 alvo abaixo de 44 px a 390, 0 erro de script, 0 `color-mix` em CSS que carrega a interface, ordem de foco correta, foco visível em todos os controles.

A varredura de números que o dono pediu agora ficou limpa **em tudo o que está na tela**: o mesmo critério que derrubou as rodadas 1 a 4 não achou mais nenhuma contradição aritmética visível. Conferi por script e à mão: totais, somas, razões, datas, dias da semana, "são N / faltam / fecha em" (3 + 12 = 25/10, 11 + 4 = 17/10, 9 + 6 = 19/10, 5 + 10 = 23/10, 0 + 15 = 28/10), "5 dos 8 dias", "47 das 67 horas" (47 + 20 = 67), 12 das 14 mudanças (5 título + 6 miniatura + 3 outras = 14), 7.750 + 849 + 752 + 1.467 + 724 = 11.542. O que sobrou está **escondido ou é de leitura fina**, onde a classe de erro de antes se repete em escala menor: o texto de um ⓘ que descreve outro gráfico, um número gerado por código que contraria a regra escrita no ⓘ, uma faixa que sombreia 8 barras para "7 dias", e um "sincronizado há 3 h" que não bate com a hora da descoberta.

As três coisas que mais pesam agora:
1. O ⓘ do `semanal` (nome certo desde a r3) abre o texto do gráfico por dia: fala de barra de 24 horas, de raias, de faixa verde e de soma que dá o total do cabeçalho, nada disso existe naquela tela (R5-B1).
2. Dois estados (`extremo`, `zero`) saem do mesmo motor com a primeira contagem por hora uma hora depois da regra que o ⓘ e o estado `vazio` escrevem (R5-C1): é erro de arredondamento do código, não escolha.
3. A faixa verde "7 dias da subida" sombreia 8 barras e inclui a barra do dia 16/10, que entra na conta dos 7 dias de ANTES, não na dos 7 de depois (R5-C2).

## A pergunta do dono e o relance

Pergunta: **"Esse vídeo foi bem para a idade dele, e algo que o canal mexeu veio antes de ele subir?"**

- 1440 escuro: responde em 3 s em todos os estados com dado. A frase-resumo (uma frase, número em destaque, símbolo) vem logo abaixo do título e a faixa de 5 números dentro da primeira tela (resumo entre y 655 e 790 em `recente`, `zero`, `naomedido`; y 705 a 840 nos estados de novembro, por causa do aviso). Os estados sem dado dizem o que falta e quando passa a existir.
- 390 claro: o resumo começa em torno de y 880, abaixo da primeira tela (844 px): a casca do lote 1 (Observatório, abas, migalha, pager) ocupa a dobra. Mantido como sugestão desde a r2 (S1), porque vem da casca aprovada.

## Bloqueio (nada vai ao dono com ele aberto)

**R5-B1. `semanal` (1440 e 390, dois temas): o ⓘ "Como ler a contagem por semana" explica o gráfico por dia, que não está na tela.**
Evidência: `shots/r5-B1-semanal-info-descreve-o-dia-a-dia-1440-escuro.png` (popover aberto sobre o gráfico de pontos semanais). Texto exato do popover: "Cada barra: views ganhas nas 24 horas até as 12:00 (São Paulo) daquele dia. A soma dos dias com a primeira contagem dá o total do cabeçalho. / Raias: título, miniatura e 'outras' ... / Quando a mudança foi feita: a janela entre duas contagens (de 6 em 6 horas, ou de dia em dia) ... / Faixa verde: os 7 dias da subida. Faixa tracejada: os 14 dias antes dela." A tela tem pontos semanais (um por semana, média por dia da semana), sem barra por dia, sem raias, sem faixa verde, sem faixa tracejada; e a soma dos pontos não dá o total do cabeçalho (73.829). Causa: `m13.js:361` monta um só `infoHtml` (o do dia a dia) e `m13.js:363` só troca o nome do botão para o `semanal` (era o R3-C4: foi consertado o nome, não o conteúdo). É a regra do dono "método no botão de informação" falhando por afirmar mais do que o dado sustenta, na mesma classe dos bloqueios anteriores, só que dentro do popover.
Conserto exato: no `semanal`, trocar o `infoHtml` por um texto próprio: "Cada ponto: média de views por dia na semana que termina na data (soma das views da semana dividida por 7). Uma contagem por semana: o que sobe e desce dentro da semana não aparece, e uma mudança não pode ser ligada a uma subida. Hachura: semana sem contagem (antes de 05/10). Linha tracejada de 24/08: o YouTube mudou a regra de contar views. Cálculo do Observatório sobre dados públicos do YouTube." Os dois ⓘ que seguem (curva por idade e 72 horas) podem ficar como estão.

## Corrige (vai ao dono só depois de corrigido, junto com o bloqueio)

**R5-C1. `extremo` e `zero`: a primeira contagem por hora cai uma hora depois da regra que o motor e o `vazio` usam.**
Regra escrita na tela: ⓘ das 72 horas, "Começa na primeira contagem depois que o vídeo é descoberto (a descoberta roda de 6 em 6 horas)"; `vazio`: "O vídeo foi descoberto às 18:00 ... A primeira contagem por hora entra às 19:00" (descoberta no marco de 6 h seguinte à publicação, contagem na hora cheia depois). Os 9 estados com hora seguem essa regra, menos dois:

| Estado | Publicado | Marco de 6 h | Primeira contagem pela regra | Primeira contagem na tela |
|---|---|---|---|---|
| `extremo` | 09/10 18:20 | 00:00 | 01:00 (6 h 40 min depois) | **02:00 (7 h 40 min depois)** |
| `zero` | 04/10 09:10 | 12:00 | 13:00 (3 h 50 min depois) | **14:00 (4 h 50 min depois)** |

Evidência: `shots/r5-C1-extremo-primeira-contagem-7h40-1440-escuro.png` ("A curva começa 7 h 40 min depois de publicar (primeira contagem às 02:00), com 24.832 views já"). Em `extremo`, 7 h 40 min passa do máximo possível pela regra do próprio ⓘ (até 6 h para ser descoberto + 1 h). Causa (verifiquei no código): `m13-dados.js`, `jFirst = Math.max(0, Math.ceil(tardeH - first))`; para as horas de publicação com minutos 20 e 10 a subtração dá 6,000000000000001 e 3,0000000000000004, e o `ceil` sobe um. Os outros estados dão números exatos (4, 1, 2, 5, 4, 1).
Conserto exato: arredondar antes do `ceil`: `Math.ceil(Math.round((tardeH - first) * 1e6) / 1e6)`. Tudo o que depende disso é gerado por código e se refaz sozinho; depois conferir na tela e atualizar a NOTAS: `extremo` ("6 h 40 min", "01:00", as views da primeira contagem, "1/4 não medido" pode virar medido, "metade em N horas" e "N medidas") e `zero` ("primeira contagem às 13:00", "N das 68 horas medidas", zeros e "ganhou algumas"; o par "47 das 67" muda). Conferir de novo: nenhum "X das Y" com X > Y, soma das horas até as 12:00 = barra do dia, e `zero` com o total 32.

**R5-C2. `cheio`, `extremo`, `leitura`: a faixa verde "▲ 7 dias da subida" sombreia 8 barras e inclui a de 16/10.**
Medi: banda de 238 px (cheio) com 8 barras de 29,8 px dentro (centros dentro da banda); `extremo`, 8 barras de 30,6 px; a 390, 8 de 7,1 px. A frase abaixo diz "nos 7 dias seguintes o vídeo ganhou 49.601 views ... (7.086 contra 1.497 por dia)". A conta 49.601 = 63.689 - 14.088 (leituras de 23/10 e 16/10, 12:00) soma as barras de 17/10 a 23/10, que são 7. A barra de 16/10 (866 views) fica pintada de verde mas entra na média dos 7 dias de antes (1.497). Quem soma as barras sombreadas chega a 50.467, não a 49.601. Evidência: `shots/r5-C2-cheio-faixa-subida-8-barras-1440-escuro.png` (a primeira barra verde é a pequena, antes do salto).
Causa: `m13-graf.js`, retângulo `hv-sub-band` com `x: L + cw * is` e `width: cw * (ie - is + 1)`; a barra do dia D é o ganho até as 12:00 de D, então o instante "subida em D" é a borda direita da barra de D.
Conserto exato: começar a banda na borda direita da barra do dia da subida: `x: L + cw * (is + 1)`, `width: cw * (ie - is)`, e pôr o rótulo "▲ subida" no começo da nova banda. Se o designer preferir mostrar o dia da subida, marcar só o rótulo "16/10" do eixo com o ▲ e manter a legenda "7 dias da subida" para as 7 barras.

**R5-C3. `vazio`: "sincronizado há 3 h" contradiz a hora da descoberta do próprio vídeo.**
O vídeo foi publicado às 17:10, descoberto às 18:00 com 312 views, e a primeira contagem por hora "entra às 19:00 de hoje" (ainda no futuro), ou seja, agora são entre 18:00 e 19:00. A faixa do Observatório, no mesmo estado, diz "sincronizado há 3 h" ("todos em dia"): a última sincronização teria sido antes das 16:00, e o vídeo só existe para o sistema desde as 18:00. Evidência: `shots/r5-C3-vazio-sincronizado-ha-3h-1440-escuro.png`. É a classe "dois números do mesmo estado que não fecham", dessa vez entre a casca e o conteúdo. Nos outros estados não há hora "de agora" escrita, então não há contradição.
Conserto exato: no `vazio`, passar `fresh` a `L.obs` com "sincronizado há 20 min" (a casca já aceita `o.fresh`); a conta fecha com a descoberta às 18:00 e agora às 18:20.

## Sugestões (não bloqueiam)

- **S1. Duas palavras de cor no texto.** `naomedido`: "Passe o mouse/Toque em cada barra com hachura rosa" (`m13.js:367`) depende da cor; em cinza a frase some. "Cada barra hachurada" lê em qualquer cor.
- **S2. Rótulos de hora do eixo de 72 horas ficam até 50 min à esquerda da hora real.** O eixo desenha as barras em casas de 1 hora contadas da publicação, e põe o rótulo "00:00 / 12:00" na casa de índice inteiro: em `zero` o "12:00" cai a 13 px (0,8 h) antes do ponto real; em `recente`, a 9 px (0,6 h); em `cheio`, 5 px. A linha da publicação, o fim da hachura e a régua de 1/4, 1/2 e 3/4 estão certos. Erro de 1% num eixo de 72 h, invisível a olho; só vale corrigir se o designer já estiver mexendo no eixo.
- **S3. ⓘ do dia a dia: "views ganhas nas 24 horas até as 12:00".** A primeira barra de cada vídeo é desde a publicação (em `cheio`, 15 h 20 min; em `extremo`, 17 h 40 min). Acrescentar "(a primeira barra conta desde a publicação)".
- **S4. ⓘ das 72 horas: "Só vídeos publicados depois de 04/10".** `zero` e `saiu` foram publicados no dia 04/10 e têm a curva. Trocar por "a partir de 04/10" (a tela `magro` já diz "antes de 04/10").
- **S5. n do normal igual em canais diferentes.** Nômade Raiz e Lucas Bigodinho têm, nos estados de novembro, os mesmos 14, 14, 14, 13, 12, 10, 7, 5 vídeos por idade (uma lista `PUBS_OUTROS` para todos). Dentro de um estado fecha; só um dono atento nota que dois canais têm exatamente a mesma contagem. Se for barato, um deslocamento por canal.
- **S6. Aviso "Nomes, números e datas são de exemplo" só existe nos estados com dado.** `vazio`, `carregando` e `erro` levam só a etiqueta "exemplo" no cabeçalho do vídeo (e `vazio` mostra "312 views", "fecha em 15/10" sem a frase de que hoje é 13/10). Aceitável; a frase curta de uma linha fecha a regra 12.
- **S7. Frase de só leitura com 3 orações** (`leitura`): cortar a última ("este vídeo é de um concorrente e não tem número privado") ou levá-la ao ⓘ. Mantida da r4.
- **S8. Declarações abertas ao dono (NOTAS seção 3):** "série semanal" (frase do spec; a convenção a proíbe na tela, a alternativa "contagem por semana" está escrita) e a falta de um LEIAME do lote para registrar a mudança de `L.obs({ nMud })` e `L.pager(total, daLista)` (a convenção manda registrar o acréscimo; a NOTAS seção 10 o registra, o LEIAME do lote não existe nesta pasta). Não bloqueiam; o dono escolhe a frase.

## Conferência da r4

| Item | Resultado | Evidência |
|---|---|---|
| R4-B1 (subida: "14 dias... são N... fecha em D") | resolvido | Constante única `NECESSARIOS = 15`. Texto na tela, nos 5 estados: `recente` "são 3. Faltam 12: fecha em 25/10"; `magro` "são 11 (começou em 03/10). Faltam 4: fecha em 17/10"; `zero` "são 9. Faltam 6: fecha em 19/10"; `aovivo` "são 5. Faltam 10: fecha em 23/10"; `vazio` "fecha em 28/10". As cinco somas dão 15 e as datas conferem com 13/10 + faltam. `saiu`/`mantido` dizem 15, sem "fecha em". O aviso de novembro diz 15 |
| R4-C1 (título do `carregando`) | resolvido | `carregando` mostra "Os 5 piores erros em Bangkok", mesma capa do `erro`, e a frase "Carregando o histórico do vídeo." uma vez, visível, abaixo dos botões (1440 escuro e 390 claro abertos) |
| R4-C2 (aba e pager) | resolvido | `extremo`: aba "Mudanças 31", "vídeo 1 de 31 da lista de Mudanças"; pager escondido em `vazio`, `carregando`, `zero`; nos outros diz "da lista de Mudanças". A mudança de `lote.js` é só a esperada (duas linhas). Ver S8 sobre o registro |
| R4-S1 (rótulos do dia) | resolvido | Só o melhor dia e o último em gráficos com mais de 12 barras (9.934 e 948; 111.072 e 8.723) |
| R4-S2 (hachura e pico) | resolvido | Hachura em altura total; "maior hora medida: 300 / 1.996 / 436 / 322 / 232 / 2" |
| R4-S3 (marca dentro/fora) | resolvido | Marca só nos itens de fora; a frase da lista diz quantos estão dentro ("2 das 4", "12 das 14") e bate com os itens marcados |
| R4-S4 (linha cortando número) | resolvido (sem mudança) | Ampliei 3x os pontos de cruzamento (`recente` 12/10 "2.867", `naomedido` 11/10 "11/10"): o contorno de 4 px da cor do cartão cobre a linha; sem corte |
| R4-S5 (palavras de motor) | resolvido, salvo "série" | Em 14 estados, nenhuma de "lido, gravou, CTR, diário, snapshot, payload, pipeline, retenção, cron"; "série" só no `semanal` (declarada); "servidor" uma vez no `erro` (aceitável) |
| NOTAS seção 11, tabela de coerência | conferida contra a tela | Todas as linhas que cobre estão certas. Não cobre os ⓘ nem a regra "descoberta de 6 em 6 horas" (R5-B1, R5-C1) |

## Varredura de coerência dos números de exemplo (feita agora, em todos os estados, de uma vez)

**Fecha (conferido por script no DOM e nas tabelas escondidas, e à mão onde indico):**
- Total do cabeçalho = soma das barras (+ 1ª contagem): `cheio` 97.909, `extremo` 1.043.955, `recente` 10.846, `magro` 22.540 (20.106 + 2.434), `zero` 32, `naomedido` 11.542, `semanal` 73.829, `saiu` e `mantido` 7.657, `aovivo` 12.352.
- Hora e dia saem da mesma curva: em `cheio`, `extremo`, `recente`, `saiu` e `aovivo` a soma das horas (mais o valor da primeira contagem) até as 12:00 de cada dia dá exatamente a barra do dia (3.610 e 7.176; 36.654 e 66.001; 6.330 e 9.197; 3.828 e 5.792; 3.354 e 6.675). `zero`: a soma das horas com as 5 views antes da primeira contagem dá 21 às 12:00 de 05/10.
- "Metade/um quarto/três quartos em N horas" refeito das tabelas: `cheio` 7/22/40, `extremo` 23/39 (1/4 não medido), `recente` 8/17/36, `zero` 7/12/25, `saiu` 6/16/33, `aovivo` 9/25/46. Todos iguais à tela.
- Razões: 1,05 (＝), 0,89, 2,79; 6,44, 5,90, 21,56; 1,20; 0,125 (0,1); 0,82; 0,74 (0,7); 4,73 e 4,68. Todas arredondadas uma vez.
- Datas: nenhuma data anterior à publicação (exceto as constantes 03/10, 04/10, 24/08); nenhuma data futura fora de "fecha em", "aparece em" e dos estados de novembro; dias da semana (08/10 quinta, 04/10 domingo, 13/10 terça) e "há N dias" (34, 33, 3, 40, 9, 8, 92, 9, 5) conferem.
- Contagens: 0 "X de Y" com X > Y nos 14 estados; n do normal sempre não crescente com a idade (14,14,14,13,12,10,7,5 / 5,4,3,3,2); mudanças nas raias = lista (14 = 5 + 6 + 3; 4 = 1 + 1 + 2; 1 em cada estado pequeno).
- Subida: 49.601 = 63.689 - 14.088; 7.086 por dia = 49.601 / 7; 543.292 = 77.613 x 7 e 77.613 / 16.591 = 4,68.

**Não fecha (agora é só isto):** R5-B1 (ⓘ do `semanal`), R5-C1 (primeira contagem de `extremo` e `zero`), R5-C2 (faixa de 8 barras), R5-C3 (casca do `vazio`). Mais S5 (mesmo n em canais diferentes), por menos importante.

## Veredito por estado e por largura

| Estado | 1440 escuro | 390 claro | Outros cruzamentos | Pendências |
|---|---|---|---|---|
| `cheio` | volta para ajuste | volta para ajuste | idem | R5-C2 |
| `extremo` | volta para ajuste | volta para ajuste | idem | R5-C1, R5-C2 |
| `recente` (caso real de hoje) | pronto | pronto | pronto | nenhuma (S2) |
| `magro` | pronto | pronto | pronto | nenhuma |
| `zero` | volta para ajuste | volta para ajuste | idem | R5-C1 |
| `naomedido` | pronto | pronto | pronto | S1 |
| `semanal` | volta para ajuste | volta para ajuste | idem | **R5-B1** |
| `saiu` | pronto | pronto | pronto | S4 |
| `mantido` | pronto | pronto | pronto | nenhuma |
| `aovivo` | pronto | pronto | pronto | nenhuma |
| `vazio` | volta para ajuste | volta para ajuste | idem | R5-C3 |
| `carregando` | pronto | pronto | pronto | nenhuma |
| `erro` | pronto | pronto | pronto | nenhuma |
| `leitura` | volta para ajuste | volta para ajuste | idem | R5-C2 (é uma cópia do `cheio`), S7 |

"Volta para ajuste" aqui é só pelos itens listados; nenhum estado está reprovado. Os 8 estados "prontos" não precisam de nova rodada se a única mudança neles for a de `m13-dados.js` (R5-C1) e nada mais.

## Cobrança do dono, ponto a ponto

| Regra | Resultado |
|---|---|
| Frase-resumo no topo | sim, em todo estado com dado; `vazio`, `magro`, `naomedido`, `semanal` dizem o que falta e por quê |
| Régua ou barra para comparar de relance | sim (pares de barras proporcionais, régua de 72 h sem colisão, barras por dia) |
| Cor estável por significado com símbolo | sim: azul/círculo = este vídeo, areia/quadrado tracejado = normal, verde/▲ = subida, rosa hachurado = não medido, caixa vazada = zero medido, pontilhado = ainda não existe. Escala de cinza (`naomedido` 1440, `zero` 390): lê, forma e hachura separam tudo. Só S1 depende de cor numa frase |
| "Zero medido" distinto de "não medido" | sim (`zero`: caixas vazadas nas horas e nos dias; hachura só onde a contagem não existe) |
| Método no botão de informação | sim, com 4 ⓘ por estado, 44 x 44, abre por Enter, Esc fecha; **exceto o texto do ⓘ do `semanal` (R5-B1)** |
| Sem prosa nem bloco monocromático | sim (leitura: S7) |
| Frases sem jargão interno | sim, salvo "série semanal" declarada |
| Sem `color-mix()` | sim; só comentários |
| Escuro a 1440 e claro a 390 | os dois pares abertos nos 11 estados indicados acima; os demais por medição |
| Alvo de 44 px | 0 abaixo de 44 em 28 de 28 (390); pager "Próximo" 80 x 36 e botões do cabeçalho 34 de altura só a 1440 (ponteiro fino) |
| Números de exemplo que se contradizem | nenhum na tela; 4 achados escondidos ou finos (R5-B1, C1, C2, C3) |

## Tabela de medidas

| Medida | Resultado |
|---|---|
| Rolagem horizontal (`capturar.mjs`, 14 estados x 4 cruzamentos) | 0 px em 56 de 56 |
| Texto abaixo de 12 px | 0 em 56 de 56 |
| Alvos abaixo de 44 px a 390 (toque) | 0 em 28 de 28 |
| Erros de console (fora as fontes bloqueadas), 14 estados a 1440 | 0 |
| Contraste de texto, todos os estados e quatro cruzamentos (cor do texto composta sobre o fundo real, lida do DOM) | menor 4,86:1 em 1440 escuro ("contagem de hoje", `--dim`) e 4,73:1 em claro (aba "Competidores" da casca do lote 1); 0 abaixo de 4,5 em texto da tela do mockup |
| Número dentro dos marcadores de mudança (`ic-trn`) | meu script acusa 1,0 por ler a cor do texto contra o fundo do SVG (falso alarme: o texto é `--on-tr` sobre `--tr`, 14,48:1 escuro e 15,76:1 claro, medidos na r3; legível nas capturas) |
| Foco por Tab: `recente` e `cheio` | 20 controles na ordem do desenho (abas, "Próximo", 3 botões, 4 grupos de ⓘ + gráfico + setas + "Ver como tabela"); `erro` 7, `vazio` 5; 0 sem contorno visível; todos os ⓘ e setas 44 x 44 |
| Faixa da subida (R5-C2) | `cheio` 1440: banda 238,2 px, 8 de 34 barras dentro; `extremo` 245,2 px, 8 de 33; `cheio` 390: 57,1 px, 8 de 34 |
| Primeira contagem por hora (R5-C1) | `cheio` 4,33 h; `extremo` 7,67 h (regra: 6,67); `recente` 1,67; `zero` 4,83 h (regra: 3,83); `saiu` 3,00; `aovivo` 6,00; `naomedido` 5,00 (não medido); `magro` 3,00; `vazio` 1,83 |
| Alturas de página, 1440 | `cheio` 3.789; `extremo` 3.948; `recente` 3.520; `carregando` 1.901; `erro` 1.415; `vazio` 1.675 |
| Resumo, a partir do topo, 390 | em torno de y 880 a 1.090 (S1 da r2 mantida) |

## O que não consegui verificar

Leitor de tela (VoiceOver, NVDA): só rótulos e `aria-live` por script. Safari e Opera: a hachura SVG e o `popover` do ⓘ não foram vistos lá (a ausência de `color-mix` protege o Opera). Movimento reduzido: só por leitura do CSS (`a4.css` zera animação e transição). Capturas a 390 escuro e as de `vazio`, `erro`, `aovivo`, `magro`, `mantido` e `leitura` a 390 abertas só por medição, não por olhar; escala de cinza simulada em duas telas, não nas 14. Os 4 ⓘ foram lidos por texto, não abertos um a um (aberto por clique só o do `semanal`). A barra "Estados do mockup" não faz parte da tela e não foi avaliada.

## Condição para a rodada 6 (ou para ir ao dono)

Corrigir R5-B1 (um texto de ⓘ), R5-C1 (um `Math.round` antes do `ceil` e a atualização dos números que a NOTAS cita para `extremo` e `zero`), R5-C2 (duas expressões de largura da banda) e R5-C3 (um parâmetro `fresh`). As sugestões podem ficar. Eu meço de novo só isto: o ⓘ do `semanal` aberto; "primeira contagem" em `extremo` (01:00, 6 h 40 min) e `zero` (13:00) com a coerência hora x dia refeita; a faixa verde com 7 barras a 1440 e 390; o `vazio` com "sincronizado há 20 min". Os estados `recente`, `magro`, `naomedido`, `saiu`, `mantido`, `aovivo`, `carregando` e `erro` ficam como estão e já são "pronto para o dono".
