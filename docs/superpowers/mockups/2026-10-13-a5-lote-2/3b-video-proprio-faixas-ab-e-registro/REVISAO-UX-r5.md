# Revisão de UX, rodada 5: mockup 3b (vídeo próprio com faixa "em teste A/B" e faixa "antes do início do registro")

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Material lido: `REVISAO-UX-r4.md`, `NOTAS.md` (seções 2, 7, 8, 9 e 9.1), `3b.js`, `3b-dados.js`, `coerencia.mjs`, capturas em `shots/`. Medi por conta própria, com scripts de Chromium headless por servidor estático nas portas 47751 a 47758 (todas derrubadas ao fim; nada na 3099, nenhum spec do projeto): texto renderizado dos 10 estados a 1440 e a 390, as duas tabelas "Ver como tabela" de cada estado (somas por coluna), a leitura dia a dia dos dois gráficos (todos os dias de `tipico`, `extremo`, `hoje`, `zero`, `semnumero`, `so-teste`, `erro`), o conteúdo de todos os ⓘ, recálculo independente dos lados antes e depois (9 estados, 15 trocas) a partir de `D.mundo(id).serie`, contraste de todo texto (40 combinações de estado, largura e tema), alvos de 44 px e rolagem a 390, foco por Tab e ⓘ por teclado. Abri as capturas `index-caso-*` (1440 escuro e 390 claro de todos os estados, em montagem). Nenhum arquivo do mockup foi alterado; acrescentei só este parecer e dois recortes `shots/r5rev-*.png`. Navegador fechado.

## Veredito

**NÃO PODE ir ao dono ainda: 1 bloqueio e 1 "corrige".** Todos os itens da r4 (B1, B2, C1, C2 e S2 a S6) foram resolvidos de verdade e não criaram defeito novo nas telas. O que sobra é a mesma classe de erro, agora num lugar que o `coerencia.mjs` e a r4 não olharam: **a fala do dia do gráfico de impressões diz "o dia ainda não chegou" para dias que já passaram, enquanto o gráfico de views, na mesma tela e no mesmo dia, diz "o YouTube não entregou este dia"**. É uma troca de duas linhas em `3b.js`.

A pergunta de quem abre: "esta capa ou este título que troquei funcionou, e o que esteve no ar?". Respondida no primeiro olhar a 1440 e a 390 (linha "Trocas deste vídeo: ...", colchetes, depois a régua das versões), sem rolar além do primeiro gráfico. Sem mudança desde a r4.

| Resumo | Contagem |
|---|---|
| Estados "pronto para o dono" | 0 de 10 |
| Estados "volta para ajuste" | 10 de 10 (B1 em 9: `tipico`, `extremo`, `hoje`, `zero`, `semnumero`, `so-teste`, `so-reconstruido`, `vazio`, `erro`; C1 em `tipico`, `extremo`, `hoje`, `semnumero`, `leitura`, e em todos por ser o mesmo ⓘ) |
| Reprovado | 0 |
| Bloqueios | 1 (B1) |
| Corrige | 1 (C1) |
| Sugestões | 6 |

Nota sobre a contagem: B1 e C1 são duas linhas de código. O ⓘ do bloco de trocas é o mesmo texto em todos os estados que o têm, então C1 vale para os 10; a divisão por estado é de exposição, não de gravidade. Depois do conserto os 10 estados ficam prontos.

As três coisas que mais derrubam o conjunto agora:
1. Mesma situação ("não medido") com duas frases diferentes e uma delas falsa para o dia (B1).
2. O `coerencia.mjs` só lê o que está estático na tela; não lê a fala do dia nem o conteúdo dos ⓘ, que é onde sobraram as duas contradições desta rodada e a da r4 (C1 da r4 estava num ⓘ).
3. Pequena: o ⓘ diz "janela cheia, cerca de 10" dias, a tela diz 9 (C1).

## Conferência da rodada 4

| Item r4 | Resolvido? | Evidência desta rodada |
|---|---|---|
| B1 soma dos cliques por dia não fecha com o total | Sim | `tipico`: frase 131, os 35 rótulos desenhados somam 131, coluna "Cliques estimados" da tabela soma 131. `extremo`: frase 5.217, 35 rótulos somam 5.217, coluna da tabela 5.217. Lido do DOM, não do `coerencia.mjs`. Nos estados "<1" a frase diz "cerca de 3" e a faixa mostra só pontos com a legenda "menos de 1 em cada dia". |
| B2 "Primeiro dia depois da troca: 15/10" | Sim | `hoje` troca 2 e `semnumero` troca 3 (1440 e 390): "O primeiro dia depois da troca (13/10) só chega do YouTube em 15/10. Leitura completa em 21/10." 13/10 = 12/10 + 1, a mesma regra do "depois" da troca 1 da mesma tela (09/10, depois a partir de 10/10). |
| C1 ⓘ afirma "o canal tem poucas impressões" | Sim | Item agora diz só "Menos de 100 impressões num lado: sem taxa e sem faixa, só 'ainda não dá para dizer'." (lido no `<template>` de todos os estados). |
| C2 NOTAS seção 2 com texto da r2 | Sim | Linhas "Linha acima dos gráficos", "Frase de cada leitura", "Sem troca" e "Total de cliques" iguais à tela. |
| S2 "10480 curtidas" | Sim | "10.480" e "1.643" no `extremo`. |
| S3 "<1" repetido | Sim | Faixa de pontos com legenda; a tabela mantém "<1". |
| S4 mesmo vídeo com datas diferentes | Sim, com efeito colateral (S2 abaixo) | `tipico` e `leitura` agora "Quanto custa uma semana em Bangkok?" (22/09, 13:32). |
| S5 "Ver antes e depois" em `so-teste` | Sim | Linha do topo de `so-teste`: "Trocas deste vídeo: teste A/B desde 03/10, em andamento." sem o link. |
| S6 lixo em `shots/` | Em parte | Ficaram só `index-caso-*`, `medidas.json` e os 4 recortes `r4rev-*` (os meus; podem sair). |

## Bloqueios

### B1. Fala do dia do gráfico de impressões: "o dia ainda não chegou" para dia do passado, contradizendo o gráfico de views da mesma tela

- Tela e estado: `hoje`, `erro`, `vazio`, `so-teste`, `so-reconstruido` (dias 27/09, 28/09 e 12/10), `zero` (30/09, 15/10 e 19/10), `semnumero` (12/10); nos três estados "um mês depois" só difere a redação do dia 16/11. 1440 e 390, os dois temas (texto de `fala` igual em todos). Capturas: `shots/r5rev-hoje-1440-escuro-27-09-views-diz-nao-entregou.png` e `shots/r5rev-hoje-1440-escuro-27-09-impressoes-diz-ainda-nao-chegou.png`.
- O que está errado: em `hoje` (13/10), o dia 27/09 é "não medido". O gráfico de views diz "dom 27/09: o YouTube não entregou este dia (não medido)", a legenda das duas telas também ("não medido: o YouTube não entregou o dia"). O gráfico de impressões, logo abaixo, diz "dom 27/09: o dia ainda não chegou (não medido)": a frase afirma que o dia vai chegar, 16 dias depois. Em `zero` (hoje 20/10) o dia 15/10, de cinco dias atrás, recebe a mesma frase. É o mesmo dia, o mesmo estado, a mesma tela, com duas explicações incompatíveis, e uma delas promete uma entrega que o dado não sustenta (CONVENCOES e cobrança do dono: "nenhuma frase afirma mais do que o dado sustenta"). Aparece ao passar o mouse sobre a barra hachurada ou ao usar as setas, exatamente o que a tela convida a fazer.
- Evidência: `3b.js` linha 80 (views): `'o YouTube não entregou este dia (não medido)'`; linha 87 (impressões): `'o dia ainda não chegou (não medido)'`. Lista completa dos dias por estado em `dia-all.txt` do meu levantamento (7 estados, 2 gráficos, todos os dias lidos).
- Conserto: na linha 87 de `3b.js`, usar a mesma frase da linha 80, "o YouTube não entregou este dia (não medido)", para todo dia `nm`. Se quiser distinguir o dia que ainda vai chegar (só o dia seguinte ao último fechado), a regra tem de valer nos dois gráficos, depender da data ("o YouTube ainda não entregou este dia") e nunca ser usada para dia com mais de 3 dias. Incluir no `coerencia.mjs` uma conferência que percorra os dois leitores e exija a mesma frase para o mesmo dia `nm`.

## Corrige (vai ao dono só depois de corrigido)

### C1. ⓘ "Como ler antes e depois": "a janela cheia, cerca de 10" contra "Leitura completa em 21/10" (9 dias) na tela

- Tela e estado: `hoje` (troca 2, 12/10) e `semnumero` (troca 3, 12/10), com o ⓘ do bloco "Trocas deste vídeo" aberto, que é o mesmo texto em todos os estados.
- O que está errado: a tela diz "O primeiro dia depois da troca (13/10) só chega do YouTube em 15/10. Leitura completa em 21/10": 12/10 + 9 = 21/10. O ⓘ do mesmo bloco diz "O primeiro dia depois da troca aparece cerca de 3 dias depois; a janela cheia, cerca de 10." O primeiro número (3) confere com 15/10; o segundo (10) não confere com 21/10 (9). A NOTAS (seção 4) diz o certo: troca + 9.
- Evidência: `3b.js`, texto do item "Atraso" em `infoTr()`; `3b-dados.js` (`cheia: A.addDias(t.d, 3 + J - 1)` = troca + 9).
- Conserto: trocar "cerca de 10" por "cerca de 9" no item "Atraso" (e, se quiser fechar com a tela sem "cerca": "a leitura completa, 9 dias depois").

## Sugestões (não bloqueiam)

- **S1. Razão entre views e cliques (já na r4/S1).** Continua: `tipico` 1.477 views e 131 cliques (11 vezes), `extremo` 57.271 e 5.217. As views do dia valem de 42% a 54% das impressões do dia com taxa de clique de 4% a 7%, o que só fecha se 90% das views vierem de fora das impressões. Não é contradição de número e o desenhista levou a pergunta ao dono (NOTAS, dúvida 7); mantenho como pergunta, não como bloqueio. Se o dono quiser, é uma linha em `viewsDe`.
- **S2. "Vídeo 1 de 35, na ordem da lista: do mais novo ao mais antigo" em todos os estados.** Em `so-reconstruido` o vídeo mais novo do canal tem 148 dias; entre estados, `tipico` (Bangkok, 22/09) existiria já em `hoje` (13/10), e então o vídeo de Hanói (14/07) não seria o "1 de 35". Efeito colateral do conserto de S4 da r4; só aparece a quem alterna os estados. Dar a cada estado a sua posição (`pager(35)` aceita número?) ou aceitar como mockup.
- **S3. ⓘ do gráfico de impressões repete o ⓘ do gráfico de views.** O método dos cliques estimados ("impressões × taxa do dia", "o total é a soma dos números de cada dia") só está no ⓘ de "Trocas deste vídeo", duas telas abaixo. A cobrança do dono é método no botão de informação; hoje ele está em um ⓘ, não no mais próximo. Acrescentar duas frases ao ⓘ do gráfico de impressões.
- **S4. `leitura`: o ⓘ de "Trocas deste vídeo" ainda descreve cliques e "do seu canal".** Quem só lê não vê cliques nem impressões; o ⓘ fala em "total" de cliques estimados e em "seu canal". Cortar o item "Fonte" para o texto que valha para quem só lê, ou aceitar.
- **S5. Texto da barra "Estados do mockup": "158 impressões em 30 dias".** É o fato real dos dois canais; na tela `hoje` o vídeo tem 30 impressões em 29 dias. Quem lê a barra e depois a tela vê 158 e 30. Escrever "158 nos dois canais; neste vídeo, 30".
- **S6. ⓘ "Não é teste A/B": "quem troca costuma trocar porque o vídeo ia mal".** Afirma um hábito sem dado. Trocar por "pode ter trocado porque o vídeo ia mal". Também: apagar os quatro `shots/r4rev-*.png` e os dois `r5rev-*.png` antes da entrega.

## Varredura de coerência dos números de exemplo (a que pediu o dono)

Método: recalculei, por código independente do `coerencia.mjs` (porta 47753), os dois lados de cada troca (7 dias, sem o dia anterior, o dia da troca e o da publicação, cortando na troca ou ciclo vizinho) e comparei, byte a byte, com a frase que a tela mostra ("Antes: N dias (dd/mm a dd/mm), X impressões"): **todos os lados com número (13 de 15 trocas; as duas restantes são "origem não sabida", sem comparação) batem**. Somei a coluna de cada tabela e comparei com a frase do gráfico. Li, dia a dia, os dois leitores de todos os estados com troca ou teste (a leitura dia a dia nunca tinha sido conferida contra o texto do estado). Conferi idades, dias da semana de cada data, engajamento, vezes o normal, intervalos de 95%.

| Estado (hoje) | Número ou frase na tela | Deriva de | Fecha com | Resultado |
|---|---|---|---|---|
| `tipico` (17/11) | 3,06 mil views; 139+17 = 156 = 5,1%; 1,7× | 3.058 = 3.003 medidos + 55 estimados; 3.058/1.790 | gráfico 1.477 em 35 dias; tabela soma 1.477 | ok |
| `tipico` | 3.031 impressões, 131 cliques, 35+0+1 = 36 | tabela: 3.031 e 131 | 35 rótulos de cliques somam 131 | ok (B1 da r4 resolvido) |
| `tipico` | troca 1: depois 4 dias 04/11 a 07/11, 295; troca 2: antes os mesmos, depois 6 dias 10/11 a 15/11, 462 | série, corte pela troca 2 e pelo ciclo 01/11 | recálculo independente igual | ok |
| `tipico` | fala do dia 16/11 | views: "o YouTube não entregou este dia"; impressões: "o dia ainda não chegou" | os dois deveriam dizer o mesmo | **B1** (dia de ontem: menos grave, mesma divergência) |
| `extremo` (17/11) | 231 mil; 10.480 e 1.643; 5,2%; 8,8× | 231.352; 231.352/26.210 | (10.480+1.643)/231.352 = 5,24% | ok |
| `extremo` | 118.798 impressões, 5.217 cliques, 4,4% | tabela soma 118.798 e 5.217 | entre 2,8% e 7,5% das trocas | ok |
| `extremo` | 6 trocas, 2 testes; 1+4+1 = 6; cadeia de títulos e capas (A, B, longo, restauro; capa 0, 1, 0, 1) | dados | "antes" de cada troca é o "depois" da anterior | ok |
| `extremo` | trocas 3, 4, 5: cada frase cita a vizinha certa (1 dia depois, 1 dia antes e ciclo 08/11, ciclo 10/11 e troca 6) | dados | datas de ciclo e troca na tela | ok |
| `hoje` (13/10) | 96 views, 7,3%; 11 em 26 dias (0,4); 30 impressões, cerca de 3 cliques; 26+0+3 = 29 | 84+11+1; (6+1)/96; 30 impressões × 7 a 11% | 21 dias com 1 impressão + 9 em 5 dias = 30 | ok |
| `hoje` | troca 2: "primeiro dia depois da troca (13/10) só chega em 15/10; completa em 21/10" | troca + 1, + 3, + 9 | troca 1 da tela: depois começa em troca + 1 | ok (B2 da r4 resolvido); ⓘ diz 10 em vez de 9: **C1** |
| `hoje` | fala do dia 27/09, 28/09 | "o YouTube não entregou" × "ainda não chegou" | idem | **B1** |
| `zero` (20/10) | 108 views, 6,5%; 6 em 26 dias; 12 impressões, cerca de 1 clique; 7+19+3 = 29 | 101+6+1; 6/108 | antes 7 dias e depois 6 dias, ambos 0 impressões (15/10 de fora) | ok |
| `zero` | fala do dia 30/09, 15/10, 19/10 | idem | 15/10 é de 5 dias atrás | **B1** |
| `semnumero` (13/10) | 32 views, 6,3%; 27 em 6 dias (4,5); 55 impressões, cerca de 3 cliques; 6+0+1 = 7; há 7 dias | 27+5; 2/32 | 5 views+4+5+4+4+5 = 27; 10+8+10+8+9+10 = 55 | ok |
| `semnumero` | "sem antes: publicado em 06/10, 2 dias antes da troca"; troca 3 "primeiro dia 13/10" | dados | datas conferem | ok; fala de 12/10: **B1** |
| `so-teste` | teste desde 03/10, 4 ciclos (03, 06, 09, 12/10), "0 trocas fora do A/B Lab" | dados | régua "começou em 03/10"; 12/10 "não medido · em teste A/B" | ok |
| `so-reconstruido` | 223 views, 3,6%; há 148 dias; 10 em 26 dias; 28 impressões, cerca de 2 cliques; ciclos 31/05, 02/06, 04/06, 06/06 de 4 | 212+10+1; 8/223 | ciclos depois de 18/05 e antes de 07/10 | ok |
| `vazio`, `erro` | 96 views; `erro`: troca 1 antes 7 dias (8 impr.), depois 2 dias 10/10 a 11/10 (3 impr.); "leitura de 12/10 e 13/10 falharam, trocas certas até 11/10" | dados | último fechado 11/10; hoje 13/10; tenta de novo "amanhã às 09:00" = ⓘ às 09:00 | ok |
| `leitura` | mesmos números públicos de `tipico`; nenhuma impressão, clique ou taxa em lugar nenhum da tela | privado | caixa com cadeado | ok (S4 só no ⓘ) |
| Todos | idades, dias da semana de cada data (03/11 ter, 09/11 seg, 30/10 sex, 05/11 qui, 06/11 sex, 12/11 qui, 14/11 sáb, 09/10 sex, 12/10 seg, 08/10 qui, 10/10 sáb), durações (812, 886, 702, 1.840 s = 13:32, 14:46, 11:42, 30:40) | calendário | tela | ok |
| Todos | intervalos 95%: 4,1% (2,3 a 7,0) e 5,8% (4,0 a 8,4) em 295 e 462 impressões; 2,8% (2,6 a 3,0) em 24.976; 7,5% (7,0 a 8,0) em 12.299 | Wilson sobre cliques/impressões | largura compatível com o tamanho da amostra | ok |

Ponto cego do `coerencia.mjs` (descrito de novo porque é o que fez sobrar B1): ele confere o que está estático na tela e os números de cabeçalho, mas não percorre os dois leitores de dia nem abre os ⓘ. As três contradições achadas desde a r3 (cliques somando 131 contra 132, "primeiro dia", ⓘ "poucas impressões") e as duas desta rodada estavam em lugares que ele não lê. Estender: para cada dia de cada gráfico, ler a fala e exigir (a) a mesma frase para o mesmo dia `nm` nos dois gráficos, (b) "ainda" só para dia posterior ao último fechado, (c) toda data e todo "N dias" do ⓘ igual ao da tela (9, não 10).

## Por estado e por largura

Pergunta e leitura de relance iguais em todos os estados. Par obrigatório 1440 escuro e 390 claro; 1440 claro e 390 escuro por medida (contraste, rolagem, alvo) e amostra.

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| `tipico` | volta (B1, C1) | volta (B1, C1) | só a fala do dia 16/11 e o ⓘ |
| `extremo` | volta (B1, C1) | volta (B1, C1) | idem; linha-resumo em 4 linhas a 390, ok |
| `hoje` | volta (B1, C1) | volta (B1, C1) | hachura rosa com texto legível; bloqueio em 3 dias |
| `zero` | volta (B1) | volta (B1) | caixa vazada com 0, nunca hachura |
| `semnumero` | volta (B1, C1) | volta (B1, C1) | ▾ da publicação acima do número; frases corretas |
| `so-teste` | volta (B1) | volta (B1) | sem link "Ver antes e depois" (S5 da r4 resolvido) |
| `so-reconstruido` | volta (B1) | volta (B1) | faixa reconstruída ok |
| `vazio` | volta (B1) | volta (B1) | "0 trocas" na caixa vazada |
| `erro` | volta (B1) | volta (B1) | pastilha com ícone; diz até quando está certo |
| `leitura` | volta (C1) | volta (C1) | sem fuga de taxa; S4 no ⓘ |

Depois de B1 e C1 corrigidos, os 10 estados ficam prontos para o dono; não vejo outro bloqueio.

## Cobertura das cobranças do dono

| Cobrança | Resultado |
|---|---|
| Frase-resumo no topo | Passa (linha do topo e frase do bloco). |
| Régua ou barra | Passa: colchetes, régua das versões, faixa de taxa com intervalo, faixa de pontos de cliques. |
| Cor estável com símbolo; escala de cinza | Passa. Conferido na r4 e sem mudança de CSS depois dela; `hoje` e `semnumero` a 1440 abertos nesta rodada. |
| "Zero medido" distinto de "não medido" | Passa na tela e nas tabelas; **falha na fala do dia de impressões (B1)**, que explica "não medido" com "ainda não chegou". |
| Método no ⓘ | Passa, com C1 (9, não 10) e S3 (o método dos cliques não está no ⓘ do gráfico). |
| Sem prosa nem bloco monocromático | Passa. |
| Frases sem jargão; nenhuma frase afirma mais do que o dado sustenta | Falha só em B1 ("ainda não chegou" para dia de 16 dias atrás). |
| Sem `color-mix()` | `grep` só acha comentários. |
| 1440 escuro e 390 claro; alvo de 44 px | Passa (medi de novo, ver tabela). |
| Números de exemplo sem contradição | Passa nas telas e nas tabelas; **falha na fala do dia (B1)** e no ⓘ (C1). |

## Tabela de medidas

| Medida | Resultado |
|---|---|
| Menor contraste de texto (todo texto visível de `#screen`, cor composta, 213 a 571 trechos por combinação; 40 combinações de estado, largura e tema; exclui o número claro dentro do marcador escuro, lido na captura) | **4,73:1** ("seu canal", claro) e **4,83:1** (cartão do teste A/B, escuro). Resto de 5,24 a 5,35. Igual à r4 |
| Rolagem horizontal a 390 (10 estados) | 0 px |
| Alvos abaixo de 44 x 44 a 390 (10 estados) | 0 |
| `capturar.mjs` (`shots/medidas.json`, 40 casos) | 0 rolagem, 0 texto abaixo de 12 px, 0 alvo abaixo de 44 px |
| Erros de JavaScript (10 estados a 390) | 0 |
| Foco por teclado (`extremo`, 1440) | 68 paradas de Tab, 0 sem contorno; ⓘ abre com Enter, fecha com Esc e devolve o foco ao botão |
| Soma dos cliques desenhados, da coluna da tabela e da frase | `tipico` 131, 131, 131; `extremo` 5.217, 5.217, 5.217 |
| Soma da coluna de impressões e de views contra a frase | `tipico` 3.031 e 1.477; `extremo` 118.798 e 57.271; `hoje` 30 e 11; `zero` 12 e 6; `semnumero` 55 e 27; `so-reconstruido` 28 e 10 (todos iguais à frase) |
| Texto de 1440 contra 390 | idêntico fora de rótulos de eixo, da frase de leitura do gráfico ("Passe o mouse" contra "Use os botões") e da legenda de cliques (mais curta a 390) |
| Páginas | 1440: 2.135 a 5.102 px; 390: 3.229 a 7.193 px |

## O que NÃO consegui verificar

- Leitor de tela (VoiceOver, NVDA): conferi rótulos, `role` e o texto do `aria-live` de cada dia; não a fala.
- Safari, Opera (navegador do dono) e Firefox: só Chromium.
- Contraste dos elementos gráficos (colchetes, marcadores, hachura): a r3 mediu 14,48:1 escuro e 15,76:1 claro; nada gráfico mudou desde então no CSS (3b.css e a4.css sem alteração depois da r4); não medi de novo.
- Movimento reduzido, zoom de 200% e fonte maior do sistema; mouse real sobre o gráfico (usei os botões de dia, que chamam a mesma `fala`).
- 360 px: fora do par obrigatório, não medi.

## Para a rodada 6

Corrigir B1 e C1 (duas linhas em `3b.js`), responder às sugestões por escrito (S1 e S2 são perguntas ao dono, se o desenhista não quiser decidir sozinho), estender o `coerencia.mjs` aos leitores de dia e aos ⓘ, e regenerar nenhuma captura de tela (o conserto não altera o que está desenhado; basta uma captura do leitor de impressões no dia 27/09 de `hoje`, do 15/10 de `zero` e do 16/11 de `tipico`, e do ⓘ aberto de `hoje`). Se o desenhista discordar de B1 ou C1, responda com captura: mantenho ou retiro por escrito.
