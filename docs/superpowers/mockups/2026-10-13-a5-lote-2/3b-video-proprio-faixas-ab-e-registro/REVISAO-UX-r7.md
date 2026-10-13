# Revisão de UX, rodada 7: mockup 3b (vídeo próprio com faixa "em teste A/B" e faixa "antes do início do registro")

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Lido: `REVISAO-UX-r6.md`, `NOTAS.md` (seção 11 e 11.1), `3b.js`, `3b-dados.js`, `coerencia.mjs`, `derivacao.mjs`, `shots/`. Medi por conta própria com Chromium headless sobre `file://` e com o `capturar.mjs` do lote (porta 47772, servidor derrubado ao fim; nada na 3099, nenhum spec do projeto): texto renderizado dos 10 estados a 1440 e a 390; fala de cada dia dos dois gráficos (10 estados x 2 larguras, clicando "Dia anterior/seguinte" do primeiro ao último dia); tabelas "Ver como tabela" somadas contra as frases; dias da semana de todo rótulo; "ainda" e "dia da publicação" na fala; todos os ⓘ lidos; contraste de todo texto de `#screen` (14.228 textos, 4 combinações de largura e tema, 10 estados); contraste dos marcadores, colchete e barras; alvos de 44 px e rolagem (`shots/medidas.json`, 40 casos); foco do ⓘ por Enter/Esc; regeração de `zero`, `hoje` e `extremo` (12 capturas idênticas, byte a byte, às de `shots/`: as capturas vigentes são as da pasta). Rodei `coerencia.mjs` (1440 e 390) e `derivacao.mjs`: 0 falhas. Nenhum arquivo do mockup foi alterado; só este parecer. Navegador fechado.

## Veredito

**NÃO PODE ir ao dono ainda: 1 bloqueio (N2) e 1 "corrige" (N1), os dois de uma linha.** Os três itens da r6 (B1, C1, C2) foram resolvidos de verdade. Nenhum número de exemplo se contradiz em nenhum dos 10 estados (varredura abaixo). O que sobra é (a) dois estados sem a frase-resumo no topo, que o dono exige e que eu mesmo deixei passar na r6, e (b) o mesmo erro do C1 num segundo ⓘ que a correção não alcançou.

Pergunta de quem abre: "esta capa ou este título que troquei funcionou, e o que esteve no ar?". Respondida no primeiro olhar em 8 de 10 estados (linha "Trocas deste vídeo: ..." ou contagem com símbolos, logo abaixo dos botões). Em `vazio` e `so-reconstruido` a resposta só existe no fim da página.

| Resumo | Contagem |
|---|---|
| Estados "pronto para o dono" | 8 de 10: `tipico`, `extremo`, `hoje`, `zero`, `semnumero`, `so-teste`, `erro`, `leitura` (com N1 aplicado ao ⓘ, que existe em 7 deles) |
| Estados "volta para ajuste" | 2 de 10: `vazio` e `so-reconstruido` (N2) |
| Reprovado | 0 |
| Bloqueios | 1 (N2) |
| Corrige | 1 (N1) |
| Sugestões | 6 |

Três coisas que mais derrubam o conjunto agora:
1. Frase-resumo ausente onde o bloco começa vazio (N2): a regra "resposta no topo" foi aplicada por estado, não por tela.
2. Método escrito duas vezes com redações diferentes (N1): corrigiu-se um ⓘ e não o irmão.
3. O `coerencia.mjs` procura frases exatas ("escritos sob as barras"); texto equivalente com outras palavras passa. Vale para o ⓘ e vale para a presença da frase-resumo, que ele não confere.

## Conferência da rodada 6

| Item r6 | Resolvido? | Evidência |
|---|---|---|
| B1 `zero`: "6 dias (10/10 a 16/10)" são 7 | Sim | 1440: "Depois: 6 dias medidos (10/10 a 16/10, sem 15/10), 0 impressões". 390: forma curta "Depois: 10/10 a 16/10, sem 15/10, 0 impressões", sem corte (capturas `zero` 390 claro e 1440 escuro abertas). 7 dias de calendário menos 1 não medido = 6. O "Antes" ("7 dias (01/10 a 07/10)") fecha. |
| C1 ⓘ do gráfico de impressões diz "números sob as barras" | Sim, no ⓘ do gráfico | `gimi`: "os números aparecem sob as barras quando cabem; senão, leia dia a dia ou na tabela". Mas o ⓘ da seção Trocas repete o método com a redação antiga (N1). |
| C2 lixo em `shots/` | Sim | `shots/` = 40 png + `medidas.json`. |
| S2 miniatura do cabeçalho = "depois" da última troca de thumbnail | Sim | `extremo`: cabeçalho laranja com rosto = "depois" da troca 6. |
| S3 fala do dia da publicação | Sim | `semnumero` 06/10: "5 views. Dia da publicação do vídeo." nos dois gráficos; em nenhum outro dia de nenhum estado. |
| S4 "158 em 30 dias" contra "30 em 29" | Sim (conforme NOTAS; não abri a tela de comparação, fora do 3b) | |
| S6 "mais de um mês" | Sim | texto de `tipico`/`extremo`. |
| `coerencia.mjs` estendido | Sim, com ponto cego (N1) | 0 falhas; a regra (c) só casa a frase "escritos sob as barras". |

## Bloqueio

### N2. `vazio` e `so-reconstruido` não têm frase-resumo no topo; a resposta está depois dos dois gráficos

- Tela e estado: `vazio` e `so-reconstruido`, 1440 e 390, os dois temas. Capturas: `shots/index-caso-vazio-1440-escuro.png` (a primeira coisa depois dos botões é o gráfico de views; "0 trocas registradas desde 07/10/2026" só aparece em y ≈ 1.830 de 2.157) e `shots/index-caso-so-reconstruido-1440-escuro.png` (a faixa reconstruída, que é o conteúdo da tela, começa em y ≈ 1.610 de 2.485; a 390, depois de ~2.900 px de rolagem).
- O que está errado: nos outros 8 estados a linha "Trocas deste vídeo: ..." (ou a contagem com símbolos) fica logo abaixo dos botões. Nestes dois ela não existe (conferido no texto renderizado: 0 ocorrências de "Trocas deste vídeo:" acima dos gráficos; `vazio` 0, `so-reconstruido` 0, os outros 8 com 1 ou, em `extremo`, a forma "6 trocas e 2 testes A/B desde 07/10:"). O dono cobra frase-resumo no topo; em `so-reconstruido`, quem abre não fica sabendo no primeiro olhar que existe um teste antigo reconstruído nem que o registro tem 0 trocas. Eu aprovei os dois na r6 ("pronto") e errei: a linha do topo só foi conferida nos estados que têm troca.
- Evidência: `3b.js`, função que monta a linha do topo; ela só é escrita com `trocas.length` ou `testes.length` maior que 0.
- Conserto (uma linha de texto por estado, na mesma posição e com o mesmo estilo das outras): `vazio`: "Trocas deste vídeo: nenhuma desde 07/10." `so-reconstruido`: "Trocas deste vídeo: nenhuma desde 07/10; um teste A/B de 31/05 a 07/06 foi reconstruído (mais abaixo)." Estender o `coerencia.mjs`: em todo estado, a linha do topo existe e começa com "Trocas deste vídeo" ou com a contagem. Refazer as capturas de `vazio` e `so-reconstruido` (8).

## Corrige (vai ao dono só depois de corrigido)

### N1. ⓘ da seção "Trocas deste vídeo" ainda diz "soma dos números de cada dia" e "nenhum número é escrito": a mesma classe do C1, em outro ⓘ

- Tela e estado: todos os estados com impressões (`tipico`, `extremo`, `hoje`, `zero`, `semnumero`, `erro`, `so-teste`, `so-reconstruido`), ⓘ "Como ler antes e depois", último item ("Fonte"). A 390 em `extremo` nenhum número de cliques é escrito sob as barras (legenda "cliques estimados · valor ao ler o dia").
- O que está errado: o ⓘ diz "O total é a soma dos números de cada dia; quando todo dia tem menos de 1 clique, nenhum número é escrito e o total é a soma exata arredondada". Em `extremo` a 390 não há número nenhum para somar (e o caso não é "todo dia menos de 1"). E contradiz o ⓘ do gráfico, que diz "os números aparecem sob as barras quando cabem; senão, leia dia a dia ou na tabela". Duas redações do mesmo método na mesma tela. O `coerencia.mjs` não pega porque a regra casa só a frase "escritos sob as barras".
- Evidência: texto do `<template id="infoTr">` (item "Fonte"), lido nos 8 estados.
- Conserto: trocar o fim do item "Fonte" por exatamente a frase do ⓘ do gráfico: "O total é a soma dos cliques de cada dia: os números aparecem sob as barras quando cabem; senão, leia dia a dia ou na tabela. Quando todo dia tem menos de 1 clique, o total é a soma exata arredondada (“cerca de”)." Estender a regra (c) do `coerencia.mjs` para casar também "soma dos números" e "nenhum número é escrito".

## Sugestões (não bloqueiam)

- **S1. Views contra cliques, de novo (r4, r5, r6; pergunta 7 da NOTAS).** A tabela mostra na mesma linha 97 impressões, 4 cliques e 47 views (`tipico`, 12/10). Views/cliques = 11,3 em `tipico`, 11,0 em `extremo`, 11,0 em `hoje`. Quem conhece o canal estranha: views de uma ordem de grandeza acima dos cliques. Não é contradição de número fechado (views vêm também de busca e fora do YouTube), por isso segue como pergunta ao dono, mas ela tem de ir escrita junto da entrega. Conserto de uma linha, se ele pedir: views do dia = cliques x 1,3 a 2,5 em `viewsDe`.
- **S2. Mesmo vídeo, histórias diferentes entre estados.** "Quanto custa uma semana em Hanói?" (14/07) aparece em `hoje`, `zero`, `erro`, `vazio` e `so-teste`; em `zero` (hoje 20/10) falta a troca de thumbnail de 12/10 que `hoje` (13/10) tem. Ao alternar, o leitor vê um vídeo "perder" uma troca. Dar outro título ao vídeo de `zero` ou escrever no seletor de estados que cada estado é um mundo à parte.
- **S3. ⓘ da faixa reconstruída cita "os 2 vídeos que tiveram teste".** Nada na tela diz 2 (só um vídeo reconstruído aparece). Trocar por "os vídeos que tiveram teste".
- **S4. A 390 a forma curta do lado perde a contagem de dias só em alguns cartões.** `extremo`: "Antes: 22/10 a 28/10, 25.750 impressões" (sem "7 dias"); `tipico` mantém "4 dias (04/11 a 07/11)". As datas permitem conferir; vale padronizar (se não couber, tirar o "(...)" e manter "7 dias").
- **S5. Régua das versões.** O marcador fica no centro da célula do dia e o rótulo "início do registro" no canto esquerdo da régua; a diferença é de meio dia (≈ 31 px a 1440 em `zero`). Não confunde, só nota.
- **S6. Herdadas, sem mudança:** miniatura do cabeçalho a 390 empurra a pergunta para y ≈ 905 (r6/S5, mockup 3 aprovado); chip "seu canal" em `leitura` (r6/S7, pergunta de produto). Seguem como perguntas ao dono.

## Varredura de coerência dos números de exemplo (todos os estados, de uma vez)

Método e resultado, tudo medido nesta rodada:
- **Fala dos dias** (10 estados x 2 gráficos x 2 larguras, 2.600 falas): 0 erros de dia da semana; "ainda não entregou" só no dia de ontem de cada estado e "não entregou" em todos os outros dias não medidos; o mesmo dia não medido tem a mesma frase nos dois gráficos; "Dia da publicação do vídeo" só no dia da publicação (`semnumero` 06/10); dia com número nunca "não medido".
- **Tabelas contra frases:** views `tipico` 1.477, `extremo` 57.271, `hoje`/`erro`/`vazio`/`so-teste` 11, `zero` 6, `semnumero` 27, `so-reconstruido` 10; impressões 3.031, 118.798, 30, 12, 55, 28; dias medidos batem com "N dias medidos"; em nenhum dia views passam de impressões.
- **Cada lado de cada troca contra a janela:** `derivacao.mjs` 0 falhas; reconferi por leitura os de `zero` (7 dias calendário - 1 não medido = 6), `extremo` (21/10 a 27/10, 22/10 a 28/10, 31/10 a 03/11: 7, 7 e 4 dias de calendário, todos fechados), `tipico` (04/11 a 07/11 = 4; 10/11 a 15/11 = 6, último dia fechado) e `hoje` (os dois "1 dia (10/10)" são o mesmo dia, 12/10 menos 2).
- **Faixas de taxa:** conferi duas por Wilson: 12 de 295 (4,1%) dá 2,3% a 7,0%; 27 de 462 (5,8%) dá 4,0% a 8,4%; 2,8% de 24.976 e 7,5% de 12.299 dão 2,6% a 3,0% e 7,0% a 8,0%. Cruzamento das faixas = "sem diferença firme" em `tipico`; não cruzam = "subiu" em `extremo`.
- **Datas encadeadas:** troca + 1, + 3 e + 9 (13/10, 15/10, 21/10 em `hoje` e `semnumero`); "a troca (N) vem K dias depois/antes" confere com as datas de `extremo` (05/11, 06/11, 08/11, 10/11, 12/11, 14/11); cadeia de títulos e de miniaturas fecha (o "antes" da troca 6 é azul e a troca 4 deixou azul); título atual = "depois" da última troca de título em todo estado; ciclos dentro do teste; teste B parado em 12/11 = troca 5 em 12/11; `erro`: "12/10 e 13/10 falharam", "até 11/10", "amanhã às 09:00" = 14/10.
- **Cabeçalho:** idades, duração (13:32, 14:46, 11:42, 30:40), "vídeo N de 35" = 1 + idade ÷ 5, engajamento = (curtidas + comentários) ÷ views, "vezes o normal" = views ÷ mediana (3.058/1.790 = 1,7; 231.352/26.210 = 8,8), todos conferem com `derivacao.mjs` e com o texto renderizado.
- **Contagens:** chips de leitura somam as trocas (`extremo` 1 + 4 + 1 = 6; `hoje` 1 + 1 = 2); "0 trocas" em `so-teste`, `vazio`, `so-reconstruido`.
- **Larguras:** as diferenças de texto entre 1440 e 390 são só de formato (S4 acima, legendas curtas, "use os botões").

Achados da varredura: **N1 (texto de método) e N2 (frase-resumo ausente)**, mais as sugestões S1 a S4. Nenhuma contradição entre números.

## Por estado e por largura

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| `tipico` | pronto | pronto | com N1 |
| `extremo` | pronto | pronto | com N1; 390 sem números sob as barras, agora dito no ⓘ do gráfico |
| `hoje` | pronto | pronto | com N1 |
| `zero` | pronto | pronto | B1 resolvido nas duas larguras; com N1 |
| `semnumero` | pronto | pronto | com N1 |
| `so-teste` | pronto | pronto | com N1 |
| `so-reconstruido` | **volta (N2)** | **volta (N2)** | sem frase-resumo no topo |
| `vazio` | **volta (N2)** | **volta (N2)** | sem frase-resumo no topo |
| `erro` | pronto | pronto | com N1 |
| `leitura` | pronto | pronto | ⓘ próprio, sem o item "Fonte" afetado |

## Cobertura das cobranças do dono

| Cobrança | Resultado |
|---|---|
| Frase-resumo no topo | **Falha em 2 de 10 estados (N2).** |
| Régua ou barra | Passa: colchetes, régua das versões, faixa de taxa com intervalo. |
| Cor estável com símbolo; escala de cinza | Passa: losango, triângulo, hachura, caixa vazada, tracejado e pontilhado se distinguem por forma; verde só em "taxa subiu", rosa só em "não medido". |
| "Zero medido" distinto de "não medido" | Passa (`zero` é o caso extremo: caixa vazada com 0 nos dois lados, hachura nos dias 30/09, 15/10 e 19/10). |
| Método no ⓘ | Passa, com N1. |
| Sem prosa nem bloco monocromático | Passa. |
| Frases sem jargão; nada afirma mais do que o dado sustenta | Passa (N1 é a única frase que afirma mais do que a tela mostra). |
| Sem `color-mix()` | Só em comentário. |
| 1440 escuro e 390 claro; alvo de 44 px | Passa (tabela abaixo). |
| Números de exemplo sem contradição | **Passa** (varredura acima). |

## Tabela de medidas

| Medida | Resultado |
|---|---|
| Menor contraste de texto de `#screen` (4 combinações, 10 estados, cor composta) | **4,73:1** ("seu canal", 12 px, claro) e **4,83:1** (rótulo do teste A/B, 12,5 px, escuro). Nenhum texto abaixo de 4,5:1 fora o número dentro do marcador, medido à parte |
| Número dentro do marcador de troca contra o marcador | 15,61:1 (escuro) e 15,76:1 (claro) |
| Marcador e colchete contra o fundo | 14,48:1 (escuro) e 15,76:1 (claro); barra de views 6,72:1 (escuro) e 4,94:1 (claro) |
| Rolagem horizontal, 40 casos | 0 px |
| Texto abaixo de 12 px | 0 |
| Alvos abaixo de 44 x 44 a 390 | 0; ⓘ 44 x 44 |
| ⓘ a 390 | popover x = 12, largura 366 (cabe), fonte 13 px; foco volta ao botão de origem (4 ⓘ, 2 estados) |
| Erros de JavaScript | 0 (10 estados) |
| `coerencia.mjs` / `derivacao.mjs` | 0 falhas a 1440 e a 390 / 0 linhas em falha |
| Páginas | 1440: 2.157 a 5.102 px; 390: 3.251 a 7.215 px |

## O que NÃO consegui verificar

- Leitor de tela: conferi rótulos, `role` e o texto do `aria-live` de cada dia; não a fala.
- Safari, Opera (navegador do dono) e Firefox: só Chromium.
- Movimento reduzido, zoom de 200%, fonte maior do sistema; mouse real sobre o gráfico (usei os botões de dia, que chamam a mesma `fala`); 360 px.
- Ordem de foco por Tab no conjunto: a r5 mediu 68 paradas; nesta rodada só reconferi o foco dos ⓘ.
- Medida do tamanho do popover aberto em todos os ⓘ a 390: só o primeiro de cada estado deu leitura utilizável no meu script; os outros três o r6 mediou (cabem).

## Para a rodada 8

1. N2: linha-resumo em `vazio` e `so-reconstruido` (texto sugerido acima) e regra no `coerencia.mjs` (toda tela tem a linha do topo); refazer 8 capturas.
2. N1: trocar a frase do item "Fonte" do ⓘ "Como ler antes e depois" pela do ⓘ do gráfico; estender a regra (c). Sem recaptura (o ⓘ não aparece nas capturas).
3. Responder às sugestões por escrito (S1 e S6 são perguntas ao dono; S2 a S5 o desenhista decide). Se discordar de N1 ou N2, responda com captura.

Com N1 e N2 corrigidos, os 10 estados ficam prontos para o dono; não vejo outro bloqueio.
