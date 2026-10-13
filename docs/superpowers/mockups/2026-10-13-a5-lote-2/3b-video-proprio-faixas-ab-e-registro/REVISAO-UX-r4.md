# Revisão de UX, rodada 4: mockup 3b (vídeo próprio com faixa "em teste A/B" e faixa "antes do início do registro")

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Material lido: `REVISAO-UX-r3.md`, `NOTAS.md` (seções 2, 7 e 8), `3b.js`, `3b-dados.js`, `coerencia.mjs`, capturas em `shots/`. Medi e capturei por conta própria (Chromium headless por servidor estático nas portas 47721 a 47732, todas derrubadas ao fim; nada na 3099, nenhum spec do projeto): 10 estados x 1440 escuro, 1440 claro, 390 claro e 390 escuro (40 capturas), texto e rótulos de cada estado a 1440 e a 390, tabelas "Ver como tabela", leitura dia a dia, ⓘ abertos, foco por Tab, contraste de todo texto. Nenhum arquivo do mockup foi alterado; acrescentei só este parecer e quatro recortes `shots/r4rev-*.png`. Navegador fechado.

## Veredito

**NÃO PODE ir ao dono ainda: 2 bloqueios e 2 "corrige".** Todos os itens da r3 (B1, C1, C2, C3 e S1 a S4) foram resolvidos de verdade e não criaram defeito novo (conferi cada um na captura e por medida). O que sobra é o que o dono mais cobra: **dois números ou frases que se contradizem dentro do mesmo estado**. Eles escaparam porque o `coerencia.mjs` confere o total contra a conta feita sobre a mesma série, não contra o que está desenhado na tela (ponto cego descrito abaixo). Os dois consertos são de uma linha cada.

A pergunta de quem abre: "esta capa ou este título que troquei funcionou, e o que esteve no ar?". Primeiro olhar, sem rolar, 1440: a linha "Trocas deste vídeo: ..." e o gráfico com colchete "em teste A/B" e pontilhado "antes do início do registro" respondem em menos de 3 segundos. A 390 em `extremo` a linha-resumo ocupa 4 linhas e o gráfico entra na mesma tela.

| Resumo | Contagem |
|---|---|
| Estados "pronto para o dono" | 5 de 10 (`zero`, `so-teste`, `so-reconstruido`, `vazio`, `erro`) |
| Estados "volta para ajuste" | 5 de 10 (`tipico` e `extremo` por B1; `hoje` e `semnumero` por B2; `leitura` por C1) |
| Reprovado | 0 |
| Bloqueios | 2 |
| Corrige | 2 |
| Sugestões | 6 |

As três coisas que mais derrubam o conjunto agora:
1. Soma dos cliques por dia não fecha com o total do cabeçalho do gráfico (B1).
2. Frase "Primeiro dia depois da troca: 15/10" contradiz, na mesma tela, a janela "depois" que começa no dia seguinte à troca (B2).
3. O ⓘ afirma "o canal tem poucas impressões" em três estados cujas caixas mostram de 295 a 25.750 impressões por lado (C1).

## Conferência da rodada 3

| Item r3 | Resolvido? | Evidência desta rodada |
|---|---|---|
| B1 só leitura dava veredito de taxa | Sim | `leitura`, 1440 e 390: nenhum chip de leitura nas duas trocas, só a caixa com cadeado; linha do topo sem veredito; contagem trocada por "taxa de clique: só para quem administra". O chip de origem (público) continua só onde existe. Texto de 390 idêntico ao de 1440. |
| C1 faixa de cliques vazia a 390 | Sim | `extremo` e `tipico` a 390: 35 pontos para 35 barras, rótulo "cliques estimados · valor ao ler o dia". |
| C2 "Os dois lados foram cortados" | Sim | Frases novas conferidas nos 10 estados ("A troca (1) vem 2 dias antes desta e a troca (3), 2 dias depois: não sobra dia inteiro para nenhum dos lados."). Zero ocorrência de "cortad" na tela. |
| C3 "482310 views" | Sim | Cabeçalho "231 mil" e "3,06 mil". Resta "10480 curtidas" e "1643 comentários" (S2, herdado do aprovado). |
| S1 "·" sobrando | Sim | 390 `extremo`: itens com símbolo, sem "·". |
| S3 pastilha "0" solta | Sim | "0 trocas" na caixa vazada (`vazio`, `so-reconstruido`, `so-teste`). |
| S4 listras sobre o texto | Sim | `hoje` e `semnumero`: retângulo sólido atrás de "não medido: ainda sem dia fechado"; legível. |

## Bloqueios

### B1. `tipico` e `extremo`: a soma dos cliques por dia não fecha com o total

- Tela e estado: `tipico`, 1440 escuro (os 35 números de cliques estão desenhados sob o gráfico de impressões) e, nos dois estados, a tabela "Ver como tabela" em qualquer largura. Capturas: `shots/r4rev-tipico-1440-escuro-cliques-por-dia-soma-131.png` e `shots/index-caso-tipico-1440-escuro.png`.
- O que está errado: a frase do gráfico diz "132 cliques estimados em 36 dias" e os 35 números desenhados abaixo (4 4 4 5 5 4 4 4 3 4 3 3 4 4 4 3 3 4 3 3 4 3 3 3 3 3 4 3 3 5 5 4 4 4 5) somam **131**. Em `extremo` a coluna "Cliques estimados" da tabela soma **5.217** e a frase diz **5.220**. A conta do total usa o valor exato de cada dia (131,52 e 5.220,16) e arredonda no fim; o rótulo de cada dia arredonda antes. É a armadilha "soma de partes tem de fechar com o total" do CONVENCOES §8, que já derrubou o lote 1 (horas do mês somando 303).
- Evidência: `D.mundo('tipico').vistaImp`: soma exata 131,518 (frase: 132), soma dos arredondados 131; `extremo`: 5.220,163 contra 5.217. Contagem por mim dos rótulos desenhados em `tipico`. `coerencia.mjs` linha 38 compara a frase com `Math.round(soma exata)`, que é a mesma conta da frase, por isso passa.
- Conserto: em `3b.js` (e onde mais `ri.clR` é calculado), fazer o total de cliques ser a soma dos valores por dia já arredondados (`Σ Math.round(cl)`: 131 e 5.217), e o `coerencia.mjs` passar a somar também os rótulos de cliques desenhados e as linhas da coluna da tabela e comparar com a frase. Os estados com "<1" por dia (`hoje`, `zero`, `semnumero`, `so-*`, `vazio`, `erro`) não somam; lá a frase "3 cliques estimados" fica como está.

### B2. `hoje` e `semnumero`: "Primeiro dia depois da troca: 15/10" contradiz a janela "depois" da mesma tela

- Tela e estado: `hoje` (troca 2, 12/10) e `semnumero` (troca 3, 12/10), 1440 e 390, os dois temas. Captura: `shots/r4rev-hoje-1440-escuro-primeiro-dia-troca1-e-troca2.png`.
- O que está errado: na troca 1 da mesma tela o lado "Depois" começa no dia seguinte à troca (troca 09/10, "Depois: 1 dia (10/10)"). Na troca 2, a frase diz "Primeiro dia depois da troca: 15/10", três dias após a troca de 12/10. O primeiro dia depois da troca é 13/10; 15/10 é o dia em que o YouTube entrega esse dia (atraso de 2 dias). Quem lê as duas trocas lado a lado vê duas regras diferentes para "primeiro dia depois". O ⓘ já diz certo ("o primeiro dia depois da troca aparece cerca de 3 dias depois"); a frase da tela perdeu o verbo.
- Evidência: `3b.js` linha 149 (`'Primeiro dia depois da troca: ' + DM(d.primeiro)`); `3b-dados.js`: `primeiro = troca + 3`, mas a janela cheia usa `lo3 = i + 1`.
- Conserto: trocar a frase por "Ainda não dá para comparar. O primeiro dia depois da troca (13/10) só chega do YouTube em 15/10. Leitura completa em 21/10." (13/10 = troca + 1; 15/10 e 21/10 como estão). Atualizar a regra (e) de `coerencia.mjs`, que hoje valida "troca + 3" como "primeiro dia depois".

## Corrige (vai ao dono só depois de corrigido)

### C1. O ⓘ "Como ler antes e depois" afirma o oposto do que `tipico`, `extremo` e `leitura` mostram

- Tela e estado: ⓘ do bloco "Trocas deste vídeo", nos três estados "um mês depois". Captura: `shots/r4rev-tipico-1440-escuro-info-hoje-poucas-impressoes.png`.
- O que está errado: o item "Menos de 100 impressões num lado" termina com "Hoje isso vale para quase toda troca, porque o canal tem poucas impressões: é a leitura honesta, não um defeito." Em `tipico` os lados têm 295 e 462 impressões; em `extremo`, de 12.299 a 25.750; nenhuma troca cai em "poucas". Além de contradizer a tela, a segunda metade é defesa em prosa ("não um defeito").
- Conserto: deixar só "Menos de 100 impressões num lado: sem taxa e sem faixa, só 'ainda não dá para dizer'." O fato de hoje (158 impressões em 30 dias) já está no texto da barra "Estados do mockup" e nas NOTAS.

### C2. NOTAS, seção 2 ("Tabela de frases da tela, texto exato"), ficou com texto da r2

- O que está errado: a linha "Frase de cada leitura" ainda traz "Sem dias para comparar. A troca (1) vem 2 dias antes desta: nenhum dia inteiro fica entre as duas." (a tela diz outra coisa desde a r3/C2); a linha "Sem troca" ainda diz que "trocas" fica só para o leitor de tela (a tela mostra "0 trocas" desde a r3/S3); a linha "Linha acima dos gráficos" ainda descreve "3 linhas a 390". Quem implementa copia a seção 2.
- Conserto: reescrever essas três linhas com o texto atual (o da tabela "Por estado" abaixo e o da seção 8) e, junto, a frase de B2.

## Sugestões (não bloqueiam)

- **S1. Razão views e cliques.** Em `tipico`: 1.477 views e 132 cliques (11x); `extremo`: 57.271 e 5.220 (11x); `hoje`: 11 e 3. Dá a entender que 91% das views vêm de fora das impressões, o que quem conhece o canal estranha. Não é contradição de número, é verossimilhança: gerar as views do dia a partir dos cliques (views = cliques x 1,3 a 2,5) em `viewsDe`. Mexe em todos os números derivados; só vale se o dono quiser.
- **S2. "10480 curtidas", "1643 comentários".** Ao lado de "231 mil views" e "26.210" na mesma faixa. É o formato do vídeo aprovado (`String(v.likes)`), então não bloqueia; `A.n()` resolve em `3b.js` sem tocar em `lote.js`, como foi feito com as views.
- **S3. "<1" repetido 26 vezes** na faixa de cliques de `hoje`, `vazio`, `erro`, `so-*` (a 390 em duas linhas, com separadores, `shots/r4rev-so-reconstruido-390-claro-cliques-menor-que-1.png`). Vem do componente aprovado do A4 (`escalonar`), por isso não reprovo. Melhor: quando todos os dias são "<1", mostrar só os pontos e uma legenda "menos de 1 clique por dia".
- **S4. Mesmo vídeo, datas diferentes entre estados.** `tipico` e `leitura` são "um mês depois" de `hoje`, com o mesmo título e a mesma duração (14:46), mas publicados em 22/09 contra 14/07 (e "há 56 dias" contra "há 91"). Dentro de cada estado fecha; quem alterna os estados na barra vê dois "Quanto custa uma semana em Hanói?" com datas incompatíveis. Dar a `tipico` outro título ou a mesma data de publicação.
- **S5. "Ver antes e depois"** aparece na linha do topo de `so-teste` (só teste, zero troca) e leva a um bloco que diz "0 trocas". Esconder o link quando `nT === 0`.
- **S6. Lixo na pasta:** `shots/r2b-tmp extremo.png` (nome com espaço) e capturas `r2*`, `r2b-*` já respondidas; apagar antes de entregar.

## Varredura de coerência dos números de exemplo (a que pediu o dono)

Método: recalculei de `D.mundo(id).serie`, por código independente do `coerencia.mjs`, os dois lados de cada troca (7 dias, sem o dia anterior, o dia da troca e o da publicação, cortando na troca ou ciclo vizinho): **15 trocas em 6 estados, dias, datas e impressões batem com a tela, nos 15 casos**. Conferi à mão contra o texto renderizado de todos os 10 estados a 1440 e a 390 (iguais fora dos rótulos de eixo): idades ("há N dias"), dias da semana de cada data, contagens, sentenças de contagem por estado, rótulos do leitor de tela, tabelas e leitura dia a dia.

| Estado (hoje) | Número na tela | Deriva de | Fecha com | Resultado |
|---|---|---|---|---|
| `tipico` (17/11) | 3,06 mil views; 139 + 17 = 156 = 5,1%; 1,7x | 3.058 = série desde 22/09; mediana 1.790 | gráfico 1.477 em 35 dias (soma dos 35 rótulos 1.477) | ok |
| `tipico` | 3.031 impressões, 132 cliques, 35+0+1=36 dias | `vistaImp` | soma dos 35 rótulos de cliques = 131 | **B1** |
| `tipico` | troca 1: depois 4 dias (04/11 a 07/11), 295, 4,1% (2,3 a 7,0); troca 2: antes os mesmos 4 dias e 295; depois 6 dias (10/11 a 15/11), 462, 5,8% (4,0 a 8,4) | série e corte pela troca 1 e pelo ciclo 01/11 | faixas cruzam = "sem diferença firme" | ok |
| `extremo` (17/11) | 231 mil, 8,8x, 5,2%; há 105 dias | 231.352 / 26.210; (10.480 + 1.643) / 231.352 | gráfico 57.271 / 35 = 1.636 | ok |
| `extremo` | 118.798 impressões, 5.220 cliques, 36 dias | `vistaImp` | coluna da tabela soma 5.217 | **B1** |
| `extremo` | 6 trocas, 2 testes; 1 + 4 + 1 = 6; trocas 1 a 6 e cortes por ciclo e troca vizinha | dados | frase de cada troca cita a vizinha certa (1 dia, 2 dias, ciclo 08/11, ciclo 10/11) | ok |
| `hoje` (13/10) | 96 views, 7,3%; 11 views em 26 dias (0,4 por dia); 30 impressões, 3 cliques; 26+0+3=29 | 84 + 11 + 1; 6+1 = 7 / 96 | rótulos de views somam 11; de impressões, 30 | ok |
| `hoje` | troca 2: "Primeiro dia depois da troca: 15/10" | troca + 3 | troca 1 da mesma tela: depois começa em troca + 1 | **B2** |
| `zero` (20/10) | 108 views; 6 views em 26 dias; 12 impressões, 1 clique; 7 + 19 + 3 = 29 | 101 + 6 + 1 | antes 7 dias e depois 6 dias, ambos "0 impressões", sem contar 15/10 (não medido) | ok |
| `semnumero` (13/10) | 32 views, 6,3%; 27 em 6 dias (4,5 por dia); 55 impressões (10+8+10+8+9+10), 3 cliques; há 7 dias | 27 + 5 estimadas | 7 dias de 06/10 a 12/10; "sem antes: publicado em 06/10, 2 dias antes da troca" | ok |
| `semnumero` | troca 3: "Primeiro dia depois da troca: 15/10" | troca + 3 | idem `hoje` | **B2** |
| `so-teste`, `vazio`, `erro` | 96 views; 11 em 26 dias; 30 impressões | iguais a `hoje` | `erro`: depois 2 dias (10/10 a 11/10), 3 impressões; "leitura de 12/10 e 13/10 falharam, trocas certas até 11/10" | ok |
| `so-teste` | teste desde 03/10, 4 ciclos (03, 06, 09, 12/10), em andamento, "0 trocas" | dados | começa antes do registro (07/10): régua diz "começou em 03/10" | ok |
| `so-reconstruido` | 223 views, 3,6%; há 148 dias; 10 views, 28 impressões, 2 cliques; teste 31/05 a 07/06, ciclos 1 a 4 | 212 + 10 + 1; 8 / 223 | ciclos depois da publicação (18/05) e antes do registro (07/10) | ok |
| `leitura` | igual a `tipico` nas partes públicas; nenhuma impressão, clique ou taxa em lugar nenhum (nem em chip, linha do topo, rótulos de leitor de tela) | privado | caixa com cadeado | ok (C1 só no ⓘ) |

Ponto cego do `coerencia.mjs`: ele lê a tela, mas confere a frase de total contra uma recontagem feita na mesma série e com a mesma regra de arredondamento, e confere "primeiro dia" contra a mesma fórmula (`troca + 3`) que gerou a frase. Falta conferir contra o que está desenhado (soma dos rótulos e da coluna da tabela) e contra o que outra parte da tela diz da mesma coisa (B1 e B2).

## Por estado e por largura

Pergunta e leitura de relance iguais em todos os estados (acima). Par obrigatório 1440 escuro e 390 claro; 1440 claro e 390 escuro por amostra e por medida.

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| `tipico` | volta (B1, C1) | volta (B1 na tabela, C1) | resto conferido |
| `extremo` | volta (B1, C1) | volta (B1 na tabela, C1) | marcas, faixa de cliques e linha-resumo ok |
| `hoje` | volta (B2) | volta (B2) | hachura rosa com texto legível |
| `zero` | pronto | pronto | caixa vazada com 0, nunca hachura |
| `semnumero` | volta (B2) | volta (B2) | ▾ da publicação acima do número; frases novas corretas |
| `so-teste` | pronto | pronto | S5 |
| `so-reconstruido` | pronto | pronto | S3 |
| `vazio` | pronto | pronto | "0 trocas" na caixa |
| `erro` | pronto | pronto | pastilha com ícone, diz até quando está certo |
| `leitura` | volta (C1) | volta (C1) | sem fuga de taxa; só o ⓘ |

## Cobertura das cobranças do dono

| Cobrança | Resultado |
|---|---|
| Frase-resumo no topo | Passa (linha do topo e frase do bloco, num `<span>` só). |
| Régua ou barra | Passa: colchetes, régua das versões, faixa de taxa com intervalo. |
| Cor estável com símbolo; escala de cinza | Passa: conferi `hoje` em cinza (hachura, tracejado, pontilhado, cheio e o contorno de zero se separam sem cor). |
| "Zero medido" distinto de "não medido" | Passa (`zero`: caixa vazada com 0; `hoje`, `semnumero`: hachura rosa). |
| Método no ⓘ | Passa, com C1 no conteúdo. |
| Sem prosa nem bloco monocromático | Passa. |
| Frases sem jargão | Passa; "ciclo" e "origem não sabida" mantidos de propósito pelo desenhista e aceitos na r3. |
| Sem `color-mix()` | `grep` só acha o comentário "nunca color-mix()" em `lote.css`. |
| 1440 escuro e 390 claro; alvo de 44 px | Passa: `capturar.mjs` nos 40 casos: rolagem 0, texto menor que 12 px 0, alvo menor que 44 px 0 a 390. |
| Números de exemplo sem contradição | **Falha** em B1 e B2 (acima). |

## Tabela de medidas

| Medida | Resultado |
|---|---|
| Menor contraste de texto do conjunto (todo texto visível de `#screen`, cor composta sobre o fundo composto; 213 a 571 trechos por estado, 40 combinações de estado, largura e tema) | **4,73:1** ("seu canal", claro) e **4,83:1** (cartão do teste A/B, escuro). Resto de 5,24 a 5,35. Exclui os números dentro dos marcadores (texto claro sobre marcador escuro, lido na captura) |
| Rolagem horizontal | 0 px nos 40 casos |
| Texto abaixo de 12 px | 0 a 1440 e a 390 |
| Alvos abaixo de 44 x 44 a 390 | 0 |
| Erros de JavaScript | 0 nos 10 estados, a 1440 e a 390 |
| Foco por teclado (`extremo`, 1440) | 44 paradas de Tab, 0 sem contorno visível; ⓘ abre com Enter, fecha com Esc e devolve o foco ao botão |
| Texto de 1440 contra 390 | idêntico fora de rótulos de eixo e das frases de leitura do gráfico ("Passe o mouse" contra "Use os botões") |
| Páginas | 1440: 2.135 a 5.102 px; 390: 3.226 a 7.193 px |
| `coerencia.mjs` | 0 falhas a 1440 e a 390 (com o ponto cego descrito) |

## O que NÃO consegui verificar

- Leitor de tela (VoiceOver, NVDA): conferi rótulos e `role`, não a fala.
- Safari, Opera (navegador do dono) e Firefox: só Chromium; o pontilhado curto dos colchetes não foi visto no Opera.
- Contraste dos elementos gráficos (colchetes, marcadores, hachura) desta rodada: a r3 mediu 14,48:1 escuro e 15,76:1 claro; a única regra de CSS gráfica que mudou depois dela foi o retângulo sólido da caixa hachurada, que conferi só em captura, não em número.
- Movimento reduzido, zoom de 200% e fonte maior do sistema; mouse sobre o gráfico (usei teclado e os botões de dia).
- 360 px: não medi nesta rodada (fora do par obrigatório; a r3 deixou S5 sobre o texto do SVG a 11,4 px).

## Para a rodada 5

Corrigir B1 e B2 (obrigatórios), C1 e C2; responder às sugestões por escrito (S1 e S4 são perguntas ao dono, se o desenhista não quiser decidir sozinho); estender o `coerencia.mjs` para somar o que está desenhado e para comparar "primeiro dia" com o início da janela; regenerar `tipico` e `extremo` (1440 escuro e 390 claro, mais a tabela), `hoje` e `semnumero` (os dois pares) e `leitura` (ⓘ). Se o desenhista discordar de B1 ou B2, responda com captura: mantenho ou retiro por escrito.
