# Revisão de UX, rodada 9: mockup 3b (vídeo próprio com faixa "em teste A/B" e faixa "antes do início do registro")

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Lido: `REVISAO-UX-r8.md`, `NOTAS.md` (seção 13 e 13.1), `3b.js`, `3b-dados.js`, `coerencia.mjs`, `derivacao.mjs`, `CONVENCOES.md`. Medi por conta própria com Chromium headless sobre `file://` e com o `capturar.mjs` do lote (porta 47751, servidor encerrado ao fim; nada na 3099, nenhum spec do projeto). Nenhum arquivo do mockup foi alterado; só este parecer. Navegadores fechados.

## Veredito

**PODE ir ao dono. Zero bloqueio, zero "corrige".** O N3 da r8 está resolvido de verdade, o ajuste (N3, S1, S2, S3, S4 da r8) não criou defeito novo, e a varredura de coerência que fiz sobre o que a tela escreve, nos 10 estados, não achou nenhum número que se contradiga. Há 5 sugestões e 1 correção da minha própria r8 (item "primeira tela a 390", abaixo): nenhuma bloqueia.

Pergunta de quem abre: "esta capa ou este título que troquei funcionou, e o que esteve no ar?". A linha "Trocas deste vídeo: ..." responde, logo abaixo dos botões, em 10 de 10 estados a 1440 (y = 383 a 410, dentro da tela de 900). A 390 ela vem depois da primeira tela (ver S1).

| Resumo | Contagem |
|---|---|
| Estados "pronto para o dono" | 10 de 10: `tipico`, `extremo`, `hoje`, `zero`, `semnumero`, `so-teste`, `so-reconstruido`, `vazio`, `erro`, `leitura` |
| "Volta para ajuste" / "reprovado" | 0 / 0 |
| Bloqueios / corrige / sugestões | 0 / 0 / 5 |

Três coisas que ainda pesam no conjunto (todas pequenas):
1. A 390 a frase-resumo fica abaixo da primeira tela em todos os estados (S1); herdado do cabeçalho do mockup 3, mas é pergunta de produto que o dono deve responder.
2. As tabelas de coerência das seções 7, 9.1, 10.1 e 11.1 da `NOTAS.md` ainda trazem números que a tela já não mostra (S2): quem implementar a partir delas escreve teste errado.
3. O lado "Antes" de várias trocas começa antes do registro e só o ⓘ avisa (S3); e o caminho de erro sem nenhuma troca nunca é exercido por estado nenhum (S4).

## Conferência da rodada 8

| Item r8 | Resolvido? | Evidência |
|---|---|---|
| **N3 (bloqueio)** `erro`: frase do topo sem o aviso de falha | **Sim** | `erro`, 1440 escuro (`shots/index-caso-erro-1440-escuro.png`): "Trocas deste vídeo até 11/10: título (1) em 09/10, ainda não dá para dizer." e, na linha de baixo, símbolo de aviso (triângulo) + "A leitura de 12/10 e a de 13/10 falharam: pode haver troca nova (aviso abaixo)." Frase em y = 383 a 425, dentro da primeira tela (900). 390 claro: a frase ocupa y = 904 a 1.030 (4 linhas de texto + o link), o aviso cabe sem cortar; só não está na primeira tela por causa da miniatura (S1). As três datas saem de `M.registro` e `hoje`. Contraste medido: símbolo 6,03:1 (escuro) e 5,90:1 (claro) contra o fundo, texto 15,61:1 e 15,09:1. Forma + palavra + cor (nada só por cor). Regra nova no `coerencia.mjs` (linha 67) e linha nova no `derivacao.mjs` (linha 51): as duas rodam com 0 falha. |
| S1 views contra cliques | Sim, por código | Views do dia = cliques do dia x 1,3 a 2,5. Razão views/cliques medida da tela: `tipico` 261/131 = 2,0; `extremo` 10.083/5.217 = 1,9; `hoje`, `vazio`, `so-teste`, `erro` 4/cerca de 3; `so-reconstruido` 4/cerca de 2; `semnumero` 5/cerca de 3; `zero` 1/cerca de 1. Em nenhum dia views > impressões (conferido dia a dia nas tabelas dos 10 estados). |
| S2 tabela de coerência incompleta | Sim | A 13.1 lista taxa e faixa de cada lado, "N,N× o normal", duração, total por tipo de leitura. Conferi o que me importa (ver varredura). |
| S3 rótulos de 3 dígitos | Sim | O ⓘ dos dois gráficos ganhou "Números sobre as barras: aparecem quando cabem". |
| S4 três nomes da faixa | Sim | Dois nomes: "antes do início do registro (07/10): trocas não registradas" (longo) e "antes do registro" (curto, igual no rótulo curto, na legenda e na tabela). |
| Capturas refeitas | Sim | Recapturei os 40 casos: **byte a byte idênticos** às de `shots/`; `medidas.json` idêntico (rolagem 0, texto menor que 12 px 0, alvo menor que 44 px a 390 0). 0 erros de JavaScript nos 20 carregamentos. |

O ajuste **não criou defeito novo**: o `.vb-rs-av` usa as mesmas cores de aviso dos outros blocos, sem rolagem a 390, sem texto menor que 12 px, ordem de foco e Esc dos ⓘ intactos (ver "Medidas").

## Varredura de coerência dos números de exemplo (todos os estados, de uma vez)

Feita sobre o que a tela escreve (texto renderizado de `#screen` a 1440 e a 390 e as tabelas "Ver como tabela" dos dois gráficos), com scripts meus, sem usar `3b-dados.js` nem `derivacao.mjs`. **Nenhuma contradição entre números em nenhum estado.** Cada linha é um cálculo que refiz:

| Cálculo | Resultado |
|---|---|
| Soma de views da tabela = número da frase "N views em M dias medidos" e número de dias medidos = M | 10 de 10 (261/35, 10.083/35, 4/26 em 5 estados, 1/26, 5/6, 261/35 em `leitura`) |
| Soma de impressões e de cliques da tabela = frase "N impressões e (cerca de) C cliques estimados em D dias"; D = dias do eixo | 9 de 9 estados com o gráfico (`leitura` não tem; é privado) |
| Dia "não medido" igual nos dois gráficos | 9 de 9 (`tipico`/`extremo` 16/11; `hoje`/`erro`/`so-*`/`vazio` 27/09, 28/09, 12/10; `zero` 30/09, 15/10, 19/10; `semnumero` 12/10) |
| views do dia > impressões do dia | 0 casos |
| Cada lado "Antes/Depois: N dias (dd/mm a dd/mm), X impressões": N = dias medidos do intervalo e X = soma da tabela nesse intervalo | 14 de 14 (inclui `zero`: "6 dias medidos (10/10 a 16/10, sem 15/10)" = 7 de calendário menos 1; `hoje`: "1 dia (10/10), 1 impressão" nas duas trocas) |
| Taxa e faixa de 95% de cada lado com 100 impressões ou mais | Mesmos 7 valores que a r8 conferiu (4,1% [2,3 a 7,0] duas vezes; 5,8% [4,0 a 8,4]; 2,8% [2,6 a 3,0] duas vezes; 7,5% [7,0 a 8,0] duas vezes): as impressões de cada lado não mudaram com a S1 (295, 462, 24.976, 25.750, 12.299), logo as taxas seguem fechando; a ordem de grandeza da faixa confere com Wilson (2,8% com 24.976 impressões dá cerca de mais ou menos 0,2 ponto) |
| Cabeçalho: views >= soma do gráfico; engajamento = (curtidas + comentários) / views; "N,N× o normal do canal" = views / mediana; "há N dias"; "vídeo N de 35" = 1 + idade / 5 | `tipico` 511 >= 261, 26/511 = 5,1%, 511/300 = 1,7×, 56 dias, 12; `extremo` 29.292 >= 10.083, 1.535/29.292 = 5,2%, 29.292/3.300 = 8,9×, 105, 22; `hoje`/`erro` 88 = 84 + 4, 6/88 = 6,8%, 91, 19; `zero` 102, 7/102 = 6,9%, 98, 20; `so-reconstruido` 216 = 212 + 4, 7/216 = 3,2%, 148, 30; `semnumero` 6 >= 5, 0/6, 7, 2. Todos fecham |
| Dia da semana de todo rótulo ("ter 03/11" etc.) | 17 de 17 certos nos textos de 1440 |
| Encadeamento de datas | Toda troca e todo ciclo é posterior à publicação; teste ao vivo dentro das datas do teste; o teste reconstruído (31/05 a 07/06, ciclos a cada 2 dias) é posterior à publicação (18/05) e anterior ao registro (07/10); vencedor aplicado um dia depois do fim do teste (03/11 e 20/10); teste parado em 12/11 = troca 5 em 12/11; `erro`: "até 11/10" < "12/10" < hoje 13/10 e a troca de 09/10 é anterior ao corte; "chega em 15/10" (+3) e "leitura completa em 21/10" (+9) conferem com o ⓘ "Atraso" |
| Contagens por chip | `extremo` 1 + 4 + 1 = 6 trocas = os 6 cartões; `tipico`/`leitura` 1 + 1 = 2; `hoje` 1 + 1 = 2; testes: 5, 3 + 2, 4 ciclos nos dentes e no texto |
| Cadeia de títulos e miniaturas | Fecha em `extremo` e `semnumero`; título e miniatura do cabeçalho = "depois" da última troca do tipo |
| 1440 contra 390 | Diferença de texto só de formato (mesma contagem escrita de outro jeito; o lado "Antes/Depois" a 390 em `extremo` e `zero` leva a contagem de impressões na linha de baixo) |
| "Zero medido" contra "não medido" | Distintos por forma, palavra e cor em todos (caixa vazada, hachura rosa); `zero` é o caso mais difícil e lê certo |
| Número privado em `leitura` | Nenhum: a tela só escreve impressões e cliques para dizer que não os vê |

## Sugestões (não bloqueiam)

- **S1. A 390 a frase-resumo está abaixo da primeira tela em 10 de 10 estados (correção da minha r8).** Na r8 escrevi "respondida no primeiro olhar, sem rolar, em 10 de 10 estados". Isso vale a 1440 (frase termina em y = 405 a 454, tela de 900). A 390 a frase começa em y = 870 a 969 e termina em 926 a 1.099, com a tela de 844: a primeira tela mostra miniatura, título, números e botões, não a resposta. Medi `tipico` 887, `extremo` 969, `hoje` 904, `zero` 904, `semnumero` 870, `so-teste` 904, `so-reconstruido` 904, `vazio` 904, `erro` 904, `leitura` 887. A causa é a miniatura de 200 px empilhada do cabeçalho do mockup 3 (aprovado), por isso não é bloqueio do 3b. Pergunta ao dono, com o conserto de uma linha: a 390, subir a frase-resumo para logo abaixo do título (antes dos 6 números do cabeçalho), ou reduzir a miniatura a uma faixa de 96 px, ou aceitar. Quem decide é o dono.
- **S2. `NOTAS.md`: as tabelas das seções 7.1 a 7.7, 9.1, 10.1 e 11.1 trazem números que a tela já não mostra** (por exemplo "231 mil views, 8,8×" e "57.271 views" em `extremo`, hoje 29,3 mil, 8,9× e 10.083; "1.790" e "26.210" nas medianas, hoje 300 e 3.300). A seção 13 diz que são histórico, mas diz "7 a 11" e não marca cada tabela. Conserto: pôr "OBSOLETA, vale a 13.1" na primeira linha de cada uma, ou apagá-las. Quem implementa a partir da NOTAS pode copiar um número que a tela não escreve.
- **S3. Lado "Antes" que começa antes do registro só avisa no ⓘ.** `hoje`, `erro` e `zero`: "Antes: 7 dias (01/10 a 07/10)", 6 dos 7 dias são anteriores a 07/10, quando o sistema não sabe se houve troca (o ⓘ "Início do registro" diz que o "antes" pode misturar versões). O cartão não afirma que o título era o mesmo nesses dias, mas o título "Antes" aparece escrito acima. Conserto de uma linha, se o dono quiser: sufixo "(6 dos 7 dias são de antes do registro)" no lado, em cinza, só quando o lado cruza 07/10. Aceito a decisão de deixar no ⓘ, já registrada na r5.
- **S4. O caminho "erro sem nenhuma troca" não é exercido por nenhum estado.** O código (`3b.js` linha 41) escreve "Trocas deste vídeo: não foi possível atualizar. ⚠ A leitura de 12/10 e a de 13/10 falharam (aviso abaixo)." e o `coerencia.mjs` tem a regra, mas nenhuma das 40 capturas mostra isso. Conserto: um parâmetro `?caso=erro&sem=1` que zere as trocas, e uma captura a 390. Não bloqueia porque o texto e o símbolo são os mesmos do `erro` aprovado.
- **S5. `extremo`: taxa de clique de 6% depois que a thumbnail original volta.** Troca 4 (06/11) devolve a thumbnail que rendia 2,8% e a série depois dela fica em 6% (`ctr` em `3b-dados.js`: .06 depois de 05/11). A tela não afirma nada sobre isso (as trocas 3 a 5 dizem "sem dias para comparar"), e a troca 3 de título no dia anterior explica; mas quem conhece o canal estranha. Conserto: `ctr` de 05/11 em diante = .035 até a troca 6, ou nada.

Herdadas, sem mudança: chip "seu canal" em `leitura` (pergunta de produto); a barra de estados é um `<details>` fechado; no `tipico` a 390 os números sob as barras de cliques ficam apertados (3 e 4 dígitos lado a lado, legíveis a 12 px, aceitos nas rodadas anteriores).

## Por estado e por largura

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| `tipico` | pronto | pronto | S1 a 390 |
| `extremo` | pronto | pronto | S1; S5 |
| `hoje` | pronto | pronto | S1; S3 |
| `zero` | pronto | pronto | S1; S3 |
| `semnumero` | pronto | pronto | S1 |
| `so-teste` | pronto | pronto | S1 |
| `so-reconstruido` | pronto | pronto | S1 |
| `vazio` | pronto | pronto | S1 |
| `erro` | pronto (N3 resolvido) | pronto | S1; S3; S4 |
| `leitura` | pronto | pronto | S1 |

## Cobertura das cobranças do dono

| Cobrança | Resultado |
|---|---|
| Frase-resumo no topo | Passa a 1440 em 10 de 10, inclusive `erro` (aviso na mesma frase). A 390 existe em 10 de 10 mas abaixo da primeira tela (S1) |
| Régua ou barra | Passa: colchetes, régua das versões, faixa de taxa com intervalo, cada lado com a sua forma |
| Cor estável com símbolo | Passa: verde só em "taxa subiu"; rosa só em "não medido"; vermelho só em falha; losango, triângulo, hachura, caixa vazada, tracejado, pontilhado, barra de corte e triângulo de aviso se distinguem por forma e palavra |
| "Zero medido" distinto de "não medido" | Passa (`zero`, `hoje`) |
| Método no ⓘ | Passa; abre e fecha com Esc e devolve o foco ao botão em `erro`, `extremo`, `hoje`; uma redação só para a fonte dos cliques |
| Sem prosa nem bloco monocromático | Passa |
| Frases sem jargão; nada afirma mais do que o dado sustenta | Passa |
| Sem `color-mix()` | Só em comentário de CSS |
| 1440 escuro e 390 claro; alvo de 44 px | Passa |
| Números de exemplo sem contradição | **Passa** (varredura acima) |

## Medidas

| Medida | Resultado |
|---|---|
| Menor contraste de texto de `#screen` (4 combinações x 10 estados, cor composta com o fundo, ignorando fundos em gradiente) | **4,73:1** (claro, "seu canal") e **4,83:1** (escuro, rótulo "de 20/10 a 02/11"); abaixo de 4,5:1: 0 |
| Contraste do símbolo do aviso de falha | 6,03:1 escuro, 5,90:1 claro (mínimo de elemento gráfico: 3:1) |
| Rolagem horizontal, 40 casos | 0 px |
| Texto abaixo de 12 px | 0 |
| Alvos abaixo de 44 x 44 a 390 | 0 (os ⓘ compactos medem 28 x 28 a 1440, ponteiro fino, e 44 x 44 a 390) |
| Erros de JavaScript | 0 (20 carregamentos) |
| Foco por Tab (`erro`, `extremo`, `hoje`) | 20, 24 e 20 paradas medidas; 0 sem indicador de foco |
| Posição da frase-resumo | 1440: y = 383 a 410, dentro da tela de 900; 390: y = 870 a 969, fora da tela de 844 (S1) |
| `coerencia.mjs` / `derivacao.mjs` | 0 falhas / 0 linhas em falha |
| Capturas | 40 png idênticas às de `shots/` |

## O que NÃO consegui verificar

- Leitor de tela: conferi `role="alert"` do aviso do `erro` e o texto de `aria-live`; não a fala.
- Safari, Opera (navegador do dono) e Firefox: só Chromium.
- Movimento reduzido, zoom de 200%, fonte maior do sistema, 360 px; mouse real sobre o gráfico (a r7 mediu a fala de cada dia pelos botões, que chamam a mesma função); a ordem de foco passou por 20 a 24 paradas por Tab, não pelas 68 que a r5 contou (o laço terminou ao voltar ao corpo da página).
- Contraste de elementos gráficos (marcadores, colchetes, barras): vale o medido na r7 (>= 4,94:1 claro, >= 6,72:1 escuro), porque `a4.css` e `lote.css` não mudaram; `3b.css` mudou só para o `.vb-rs-av`, medido acima.
- Escala de cinza: não refiz esta rodada; vale a conferência da r8 em `extremo` a 390, e o aviso novo tem forma (triângulo) e palavra, não só cor.
