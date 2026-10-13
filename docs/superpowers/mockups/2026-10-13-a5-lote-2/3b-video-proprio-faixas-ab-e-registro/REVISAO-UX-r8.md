# Revisão de UX, rodada 8: mockup 3b (vídeo próprio com faixa "em teste A/B" e faixa "antes do início do registro")

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Lido: `REVISAO-UX-r7.md`, `NOTAS.md` (seção 12 e 12.1), `3b.js`, `3b-dados.js`, `coerencia.mjs`, `derivacao.mjs`, `CONVENCOES.md`, `PLANO.md`. Medi por conta própria com Chromium headless sobre `file://` e com o `capturar.mjs` do lote (porta 47731, servidor encerrado ao fim; nada na 3099, nenhum spec do projeto). Nenhum arquivo do mockup foi alterado; só este parecer. Navegador fechado.

O que fiz, sem reaproveitar as contas do desenhista (as minhas partem do que a tela escreve, não da fonte `3b-dados.js`):
- Recapturei os 40 casos (10 estados x 1440/390 x escuro/claro): **byte a byte idênticos** às de `shots/` (as capturas vigentes são as da pasta), `medidas.json` idêntico (rolagem 0, texto menor que 12 px 0, alvo menor que 44 px 0).
- Texto renderizado de `#screen` dos 10 estados nas duas larguras (20 arquivos), lido inteiro; diferença 1440 x 390 só de formato.
- Abri as capturas: `vazio`, `so-reconstruido`, `so-teste`, `tipico`, `extremo`, `semnumero`, `zero`, `erro` a 1440 escuro; `vazio`, `so-reconstruido`, `extremo`, `zero` a 390 claro; `extremo` a 390 em escala de cinza.
- Dia da semana de todo rótulo "ter 03/11" (34 ocorrências, 2 larguras): 0 erros.
- Tabelas "Ver como tabela" dos dois gráficos dos 10 estados: soma de views e de impressões contra a frase, número de dias contra "N dias", views nunca acima de impressões no mesmo dia, dia não medido igual nos dois gráficos: 0 divergências. Rótulos desenhados sobre as barras contra a tabela: batem em 16 dos 17 gráficos que desenham rótulo (os 2 de `extremo` não desenham nenhum, por não caberem; a exceção é o de impressões de `tipico`, em S3).
- Taxa de clique e faixa de 95% (Wilson) de **todo lado de toda troca com 100 impressões ou mais**, recalculada da série a partir das datas escritas no cartão: 7 de 7 conferem a 1440 e a 390 (4,1% [2,3 a 7,0] duas vezes; 5,8% [4,0 a 8,4]; 2,8% [2,6 a 3,0] duas vezes; 7,5% [7,0 a 8,0] duas vezes); os lados com menos de 100 dizem "sem faixa" e não escrevem taxa. As duas frases "faixas se cruzam" (`tipico`) e "não se cruzam" (`extremo`) conferem com os intervalos.
- Contraste de todo texto de `#screen` (4 combinações de largura e tema, 10 estados, cor composta com o fundo): **mínimo 4,73:1** (claro) e **4,83:1** (escuro); nenhum texto abaixo de 4,5:1.
- Erros de JavaScript: 0 nos 20 carregamentos.
- `coerencia.mjs` (1440 e 390) e `derivacao.mjs`: 0 falhas, como o desenhista diz.

## Veredito

**NÃO PODE ir ao dono ainda: 1 bloqueio (N3), de uma linha de texto, só no estado `erro`.** Os dois itens da r7 (N2, N1) estão resolvidos de verdade, o ajuste não criou defeito novo, e nenhum número de exemplo se contradiz em nenhum dos 10 estados. O bloqueio é uma omissão que eu mesmo deixei passar nas rodadas anteriores: no `erro`, a frase do topo conta as trocas como se a lista estivesse completa e a falha de leitura só aparece 1.700 px abaixo.

Pergunta de quem abre: "esta capa ou este título que troquei funcionou, e o que esteve no ar?". Respondida no primeiro olhar, sem rolar, em 10 de 10 estados pela linha "Trocas deste vídeo: ..." (ou pela contagem com símbolos) logo abaixo dos botões. Em 9 deles a linha é fiel ao dado; no `erro` ela é incompleta sem avisar.

| Resumo | Contagem |
|---|---|
| Estados "pronto para o dono" | 9 de 10: `tipico`, `extremo`, `hoje`, `zero`, `semnumero`, `so-teste`, `so-reconstruido`, `vazio`, `leitura` |
| Estados "volta para ajuste" | 1 de 10: `erro` (N3) |
| Reprovado | 0 |
| Bloqueios | 1 (N3) |
| Corrige | 0 |
| Sugestões | 5 |

Três coisas que mais derrubam o conjunto agora (todas pequenas):
1. A frase do topo não carrega o aviso de falha no `erro` (N3): a regra "a resposta e o aviso no primeiro olhar" foi aplicada aos estados de dado e esquecida no estado de erro.
2. Views e cliques do exemplo guardam uma razão que quem conhece o canal estranha (S1, pergunta ao dono desde a r4): views por dia 11 vezes os cliques por dia. Não é contradição fechada; é o que o dono mais provavelmente vai notar.
3. O que os scripts conferem sai da própria fonte de dados; nenhum deles lê "o que a tela afirma sobre o que falta" (erro, dado incompleto). O N3 passou por 7 rodadas por isso.

## Conferência da rodada 7

| Item r7 | Resolvido? | Evidência |
|---|---|---|
| **N2 (bloqueio)** `vazio` e `so-reconstruido` sem frase-resumo no topo | **Sim** | `vazio`, 1440 escuro e 390 claro: "Trocas deste vídeo: nenhuma desde 07/10." em y = 383 (1440) e 904 (390), mesma posição e mesmo estilo dos outros estados, antes do primeiro gráfico. `so-reconstruido`: "Trocas deste vídeo: nenhuma desde 07/10; um teste A/B de 31/05 a 07/06 foi reconstruído (mais abaixo)." A data do teste confere com a faixa reconstruída (ciclos 31/05, 02/06, 04/06, 06/06, todos dentro de 31/05 a 07/06, todos antes de 07/10) e com a publicação (18/05). A quebra em duas linhas a 390 não corta. Capturas abertas. |
| **N1 (corrige)** ⓘ "Como ler antes e depois", item "Fonte" | **Sim** | Busca no código: 0 ocorrências de "soma dos números", "nenhum número é escrito", "2 vídeos que tiveram", "escritos sob as barras". O item "Fonte" diz agora "O total é a soma dos cliques de cada dia: os números aparecem sob as barras quando cabem; senão, leia dia a dia ou na tabela. Quando todo dia tem menos de 1 clique, o total é a soma exata arredondada (“cerca de”).", igual ao ⓘ do gráfico (que só diz "O total da frase" no começo). Uma redação só. A 390 em `extremo` nenhum número de cliques é escrito sob as barras e o ⓘ já não afirma o contrário. |
| S2 mundos diferentes por estado | Sim (pelo caminho barato) | A nota da barra "Estados do mockup" diz "Cada estado é um mundo à parte". A barra é um `<details>` fechado por padrão (33 px de alto): quem não abri-la não lê. Convenção do lote; não bloqueia. |
| S3 "os 2 vídeos que tiveram teste" | Sim | Texto agora "os vídeos que tiveram teste". |
| S4 forma curta do lado sem a contagem | Sim | 390: `extremo` "Antes: 7 dias (22/10 a 28/10)" e "25.750 impressões" em duas linhas; `zero` "Depois: 6 dias medidos (10/10 a 16/10, sem 15/10)" e "0 impressões". Toda forma escreve a contagem. |
| S5 régua das versões | Mantido sem mudança | Aceito: meio dia. Confirmei na régua de `so-teste` que a escala é 125 px por dia, com o rótulo "hoje" no fim do último dia e os dentes no começo de cada dia. |
| S1, S6 perguntas ao dono | Seguem como perguntas | Ver S1 abaixo. |
| `coerencia.mjs`, `derivacao.mjs` | 0 falhas | Rodei os dois. Ponto cego novo: nenhum confere se o aviso de falha aparece junto da frase do topo (N3). |
| Capturas refeitas | Sim | Idênticas às que gerei hoje. `shots/` = 40 png + `medidas.json`. |

O ajuste (N1, N2, S3, S4) **não criou defeito novo**: as linhas novas usam o mesmo `.tr-res` dos outros estados, contraste igual, sem rolagem a 390, 0 erros de JavaScript.

## Bloqueio

### N3. `erro`: a frase do topo conta as trocas como se a lista estivesse completa; o aviso de falha está 1.700 px abaixo

- Tela e estado: `erro`, 1440 e 390, os dois temas. Capturas: `shots/index-caso-erro-1440-escuro.png` (frase do topo em y = 383, dentro da primeira tela de 900 px; o aviso "Não foi possível atualizar as trocas" em y = 1.699 de 2.816) e `shots/index-caso-erro-390-claro.png` (frase em y = 904, aviso em y = 2.503 de 4.230; a primeira tela de 844 px não chega a nenhum dos dois).
- O que está errado: o que o `erro` existe para dizer ("a leitura de 12/10 e a de 13/10 falharam; o que aparece vai até 11/10") não está no primeiro olhar. A frase do topo diz "Trocas deste vídeo: título (1) em 09/10, ainda não dá para dizer." sem data de corte nem aviso; os dois gráficos ficam sem marca depois de 09/10 e leem como "nada mudou desde então". Quem trocou a capa em 12/10 (como em `hoje`) vê uma tela que afirma o contrário do que aconteceu. Nos outros estados com dado incompleto a frase do topo já carrega o caveat ("depois ainda não medido" em `hoje`, `semnumero`); aqui o caveat vive só no aviso lá embaixo. Dois critérios do dono: resposta no primeiro olhar; nenhuma frase afirma mais do que o dado sustenta.
- Evidência: texto renderizado, `.tr-res` do `erro` não contém "falh" nem data de corte; `3b.js` linha 44: `if (M.registro.ok === false && !trocas.length) return '';` (caminho sem exemplo: com falha e 0 trocas a linha do topo some, o que reabre o N2 do mesmo jeito).
- Conserto (texto, na mesma linha e no mesmo estilo; símbolo de aviso `L.IC.aviso` antes da segunda frase, em cor de aviso, nunca só cor): `erro`: "Trocas deste vídeo até 11/10: título (1) em 09/10, ainda não dá para dizer. ⚠ A leitura de 12/10 e a de 13/10 falhou: pode haver troca nova (aviso abaixo)." Para o caminho `ok === false` sem trocas: "Trocas deste vídeo: não foi possível atualizar. ⚠ A leitura de 12/10 e a de 13/10 falharam (aviso abaixo)." Os dois a partir de `M.registro.ultima` e `M.registro.falhaDe`, sem digitar a data. Estender o `coerencia.mjs`: se `M.registro.ok === false`, o `.tr-res` existe e contém "falh" e a data `M.registro.ultima`. Refazer as 4 capturas do `erro` e conferir a 390 que a frase não passa de 3 linhas. Atualizar a linha "frase do topo" do `derivacao.mjs` para o `erro`.

## Sugestões (não bloqueiam)

- **S1. Views contra cliques, pela quinta vez (r4 a r8; dúvida 7 da NOTAS).** Mesmos números das rodadas anteriores: `tipico` 1.477 views contra 131 cliques estimados (11,3 vezes), `extremo` 57.271 contra 5.217 (11,0), `hoje` 11 contra cerca de 3, `semnumero` 27 contra cerca de 3. Evidência nova desta rodada: em `extremo` a taxa de clique sobe de 2,8% para 7,5% (2,7 vezes) no cartão da troca 2 e as views por dia não se movem no mesmo dia, porque `viewsDe` deriva views das impressões, não dos cliques. Quem acompanha o canal todo dia vai estranhar as duas coisas na mesma página. Não é contradição de número fechada: a tela não afirma relação entre elas e o YouTube conta views de fora das impressões. Por isso fica fora do bloqueio, mas é a primeira coisa que espero o dono perguntar; a pergunta tem de ir escrita na entrega, com o conserto de uma linha em `viewsDe` (views do dia = cliques do dia x 1,3 a 2,5, limitadas pelas impressões), que muda as views, o cabeçalho e "o normal do canal" por código, sem digitar número.
- **S2. A tabela 12.1 da NOTAS não lista todo número mostrado.** O brief pede "cada número mostrado". Faltam na tabela: taxa de clique e faixa de cada lado, "1,7×" e "8,8×" ("o normal do canal"), duração, e o total por tipo de leitura (`extremo`: 1 + 4 + 1 = 6). Eu os conferi todos hoje (taxas e faixas por Wilson, 7 de 7; 3.058 ÷ 1.790 = 1,71; 231.352 ÷ 26.210 = 8,83; 812 s = 13:32, 1.840 s = 30:40, 702 s = 11:42, 886 s = 14:46; 6 = 1 + 4 + 1) e fecham; falta só o desenhista gerá-los na tabela por `derivacao.mjs`, para o próximo revisor não depender de mim.
- **S3. `tipico`, gráfico de impressões a 1440: os 8 dias com 100 ou mais impressões ficam sem número sobre a barra.** Valores 116, 102, 128, 108, 111, 103, 104 e 101 (as barras mais altas) não têm rótulo; as de 99 para baixo têm (`shots/index-caso-tipico-1440-escuro.png`). É a regra "quando cabem" aplicada a 3 dígitos, mas o ⓘ só a explica para os cliques sob as barras. Conserto: rótulo de 3 dígitos com fonte 10 px ou o ⓘ dizer "os números sobre as barras aparecem quando cabem" também para as barras. Os dois gráficos têm tabela e leitura por dia, então nada se perde.
- **S4. Três nomes para a mesma faixa pontilhada.** "antes do início do registro (07/10): trocas não registradas" (rótulo da faixa em `hoje`, `zero`, `vazio`, ...), "antes de 07/10: o sistema não registra trocas" (legenda) e "antes do registro" (rótulo da faixa em `semnumero` a 1440 e em todos a 390; também a legenda de referência). Explicável (a faixa de `semnumero` tem 1 dia de largura), mas a mesma coisa com o mesmo nome em toda tela é regra do dono. Conserto: dois nomes só, longo e curto, e o curto igual em todo lugar.
- **S5. Herdadas, sem mudança:** miniatura do cabeçalho a 390 empurra a pergunta para y = 904 (mockup 3 aprovado); chip "seu canal" em `leitura` (pergunta de produto); barra de estados é um `<details>` fechado.

## Varredura de coerência dos números de exemplo (todos os estados, de uma vez)

Feita sobre o que a tela escreve, não sobre a fonte. Resultado: **nenhuma contradição entre números em nenhum estado.** O que olhei e como fechou:

| Classe de erro das rodadas anteriores | Resultado |
|---|---|
| Barra ou contagem maior que o tempo de registro | Nenhuma. Registro começa em 07/10; toda troca é de 08/10 em diante; "nenhuma desde 07/10" nos 2 estados sem troca; a régua vai de 07/10 até hoje; os dois estados "mais de um mês depois" têm hoje = 17/11 (41 dias depois, "mais de um mês" confere). |
| "N de M" com N maior que M | Nenhum. "vídeo N de 35" = 1 + idade ÷ 5, entre 2 e 30; chips somam as trocas (`extremo` 1 + 4 + 1 = 6, `tipico` e `leitura` 1 + 1 = 2, `hoje` 1 + 1 = 2); "N dias medidos" + "não medidos" = dias do eixo em todos (35 + 1 = 36; 26 + 3 = 29; 6 + 1 = 7). |
| Cabeçalho que diz uma coisa e cartão outra | Nenhum. Cabeçalho de views maior ou igual à soma do gráfico em todos (3.058 >= 1.477; 231.352 >= 57.271; 96 >= 11; 108 >= 6; 32 >= 27; 223 >= 10); engajamento = (curtidas + comentários) ÷ views (5,1%, 5,2%, 7,3%, 6,5%, 6,3%, 3,6%); dias de vida = hoje menos publicação em todos. |
| Data de evento anterior ao vídeo | Nenhuma. Toda troca e todo ciclo é posterior à publicação; ciclos dentro das datas do teste (4 testes ao vivo e o reconstruído); o teste reconstruído (31/05 a 07/06) é posterior à publicação (18/05) e anterior ao registro. |
| Lado de troca com número que não fecha com as datas | Nenhum. "7 dias (22/10 a 28/10)", "4 dias (31/10 a 03/11)", "6 dias medidos (10/10 a 16/10, sem 15/10)" (7 de calendário menos 1), "1 dia (10/10)" nas duas trocas de `hoje`, "2 dias (10/10 a 11/10)" em `erro`; nenhum lado atravessa outra troca nem ciclo; nenhum inclui o dia da troca, o dia anterior, a publicação ou dia não fechado. |
| "Chega em dd/mm" | Troca 12/10: primeiro dia depois 13/10, chega 15/10 (+3), leitura completa 21/10 (+9), depois de hoje (13/10); idem `semnumero` troca 3. O ⓘ "Atraso" diz "cerca de 3 dias" e "cerca de 9 dias": confere. |
| Encadeamento de títulos e miniaturas | Cadeia fecha em `extremo` (antes da 3 = depois da 1; antes da 5 = título do teste B, depois = o que voltou; miniaturas 0, 1, 0, 1) e em `semnumero` (depois da 1 = antes da 3). O título do cabeçalho é o "depois" da última troca de título em todo estado; a miniatura do cabeçalho é o "depois" da última de thumbnail. |
| Teste A/B contra troca | Vencedor aplicado um dia depois do fim do teste (`tipico` 02/11 e 03/11; `extremo` 19/10 e 20/10); teste parado em 12/11 = troca 5 em 12/11, depois do último ciclo (10/11). `so-teste`: teste de 03/10 em andamento com ciclos a cada 3 dias até 12/10 (4 ciclos, conta fecha). Atenção: começa antes do registro (03/10 < 07/10), o que a régua diz ("começou em 03/10") e o recorte da faixa mostra sem sobrepor erradamente. |
| Dia da semana | 34 de 34 certos. |
| Taxas e faixas | 7 de 7 conferem (acima). |
| `erro` | "12/10 e 13/10 falharam", "até 11/10", "amanhã às 09:00" (hoje 13/10) fecham; os lados de `erro` (7 dias, 8 impressões; 2 dias, 3 impressões) fecham com o fato de a troca 2 de `hoje` (12/10) não estar no registro. O texto do topo é o N3. |
| Mesmo vídeo, histórias diferentes entre estados | Declarado na barra de estados (S2 da r7); não é contradição dentro de um estado. |
| Plausibilidade views contra cliques | S1. |

## Por estado e por largura

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| `tipico` | pronto | pronto | S3 (rótulos de 3 dígitos), sugestão |
| `extremo` | pronto | pronto | 390 sem números sob as barras, dito no ⓘ; grayscale conferido |
| `hoje` | pronto | pronto | |
| `zero` | pronto | pronto | "0" vazado e hachura distinguem-se em cinza |
| `semnumero` | pronto | pronto | S4 (nome curto da faixa) |
| `so-teste` | pronto | pronto | |
| `so-reconstruido` | pronto | pronto | N2 resolvido |
| `vazio` | pronto | pronto | N2 resolvido |
| `erro` | **volta (N3)** | **volta (N3)** | frase do topo sem aviso de falha |
| `leitura` | pronto | pronto | sem número privado em nenhum ponto da tela |

## Cobertura das cobranças do dono

| Cobrança | Resultado |
|---|---|
| Frase-resumo no topo | Passa em 10 de 10 estados; no `erro` a frase existe mas omite o aviso (N3). |
| Régua ou barra | Passa: colchetes, régua das versões, faixa de taxa com intervalo, cada lado com a sua forma. |
| Cor estável com símbolo; escala de cinza | Passa: losango, triângulo, hachura, caixa vazada, tracejado, pontilhado e barra de corte se distinguem por forma e palavra; conferido em cinza em `extremo` a 390. Verde só em "taxa subiu"; rosa só em "não medido". |
| "Zero medido" distinto de "não medido" | Passa (`zero`: caixa vazada com 0 nos dois lados da troca; hachura nos dias 30/09, 15/10, 19/10). |
| Método no ⓘ | Passa; uma redação só (N1 resolvido). |
| Sem prosa nem bloco monocromático | Passa. |
| Frases sem jargão; nada afirma mais do que o dado sustenta | Passa, exceto N3. |
| Sem `color-mix()` | Só em comentário de `3b.css`, `a4.css` e `lote.css`. |
| 1440 escuro e 390 claro; alvo de 44 px | Passa (tabela abaixo). |
| Números de exemplo sem contradição | **Passa** (varredura acima). |

## Tabela de medidas

| Medida | Resultado |
|---|---|
| Menor contraste de texto de `#screen`, 4 combinações x 10 estados (cor composta) | **4,73:1** (claro, "seu canal" 12 px) e **4,83:1** (escuro); abaixo de 4,5:1: 0 |
| Rolagem horizontal, 40 casos (`shots/medidas.json`, idêntico ao recapturado) | 0 px |
| Texto abaixo de 12 px | 0 |
| Alvos abaixo de 44 x 44 a 390 | 0 |
| Erros de JavaScript | 0 (20 carregamentos) |
| Posição da frase do topo no `erro` / do aviso de falha | 383 px / 1.699 px (1440, página de 2.816); 904 px / 2.503 px (390, página de 4.230); primeira tela 900 e 844 px |
| Páginas | 1440: 2.157 a 5.102 px; 390: 3.251 a 7.279 px |
| `coerencia.mjs` / `derivacao.mjs` | 0 falhas a 1440 e a 390 / 0 linhas em falha |
| Taxas e faixas de 95% | 7 de 7 conferem |
| Dia da semana | 34 de 34 |

## O que NÃO consegui verificar

- Leitor de tela: conferi `role="alert"` do aviso do `erro`, rótulos e o texto de `aria-live`; não a fala.
- Safari, Opera (navegador do dono) e Firefox: só Chromium.
- Movimento reduzido, zoom de 200%, fonte maior do sistema, 360 px; mouse real sobre o gráfico (a r7 usou os botões de dia, que chamam a mesma `fala`); nesta rodada não refiz a fala de cada dia nem a ordem de foco por Tab (a r5 mediu 68 paradas; a r7 mediu a fala de 2.600 dias e o foco dos ⓘ; `3b.js` só mudou em texto desde então).
- Contraste dos elementos gráficos (marcadores, colchetes, barras): vale o medido na r7 (≥ 4,94:1 claro, ≥ 6,72:1 escuro), porque `3b.css`, `a4.css` e `lote.css` não mudaram desde.

## Para a rodada 9

1. N3: frase do topo do `erro` com data de corte e aviso (texto sugerido acima), mesma correção para o caminho `ok === false` sem troca (`3b.js` linha 44); regra no `coerencia.mjs`; refazer as 4 capturas do `erro`.
2. Responder por escrito às sugestões: S1 e S5 são perguntas ao dono (a S1 vai escrita na entrega); S2 a S4 o desenhista decide.
3. Se discordar do N3, responda com captura da primeira tela do `erro` mostrando o aviso sem rolar.

Com o N3 corrigido, os 10 estados ficam prontos para o dono; não vejo outro bloqueio. Pelo que o dono cobra, também não vejo nada em "preferência de estilo" que eu esteja tratando como bloqueio.
