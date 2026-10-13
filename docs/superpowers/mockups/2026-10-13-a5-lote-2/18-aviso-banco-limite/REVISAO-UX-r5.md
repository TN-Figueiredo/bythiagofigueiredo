# Revisão de UX, mockup 18 (aviso "banco chegando ao limite"), rodada 5

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Escopo: conferir o retorno do dono (`RETORNO-DO-DONO-13-10.md`) ponto a ponto em todos os estados, a resposta à r4 (C1 e C2), a coerência dos números de exemplo, e o de sempre (390 px, alvos, foco, contraste, color-mix, zero x não medido).

Medi no Chromium headless (Playwright) sobre servidores estáticos meus nas portas 47731 a 47733, todos derrubados ao terminar (nada na 3099, 47700 ou 47701; sem specs do projeto; nada fora desta pasta foi tocado, e nada foi escrito aqui além deste arquivo). Passei 12 estados x painel aberto e fechado x 1440 e 390 x escuro e claro (96 páginas) por um script que lê o DOM: todo texto, todo `aria-label`, `title` e `alt`, o conteúdo dos botões de informação, rolagem, fontes, alvos, contraste. Olhei 12 capturas (página inteira e recortes do painel, incluindo o painel a 390 px em cinza e o botão de informação a 390 px).

## Veredito: PRONTO PARA O DONO (zero bloqueio, zero "corrige", 6 sugestões)

Pergunta de quem abre: "quanto do limite do banco do site já usei, e quando enche?". Em 3 segundos, sem rolar e sem abrir dica: a pastilha da faixa diz "Banco do site: 43% do limite" com minibarra e símbolo; em alerta ganha borda e forma (triângulo, octógono) e, com previsão curta, "enche em 80 dias". O painel aberto responde de relance com a barra de 0% a 100% (cortes em 70% e 85% desenhados, percentual em cima do preenchimento), a frase em negrito e a régua do tempo. O que o dono pediu foi atendido de verdade, inclusive nos cantos (aria-label, popover, estados sem dado). Os dois "corrige" da r4 estão resolvidos e conferidos no DOM e nas capturas.

## O retorno do dono, ponto a ponto

| Pedido do dono | Atendido? | Evidência |
|---|---|---|
| 1. O limite é do banco INTEIRO, não do Observatório | sim | Pastilha, frase, título, `aria-label` e régua dizem "Banco do site". Em "Quem ocupa o banco do site" o colchete "Observatório 60%" fica ao lado de "Resto do site 40%", com a frase "O Observatório ocupa 60% do que o banco do site ocupa" e a tabela com Observatório = concorrentes + seu canal. O botão de informação diz "o tamanho de todo o banco do site, não só o do Observatório". Visto em `verde` 1440 e 390. |
| 2. Percentual, sem valores | sim | Varredura de TODO texto visível e de `aria-label`, `title`, `alt` nos 12 estados, aberto e fechado, 1440 e 390, escuro e claro (96 páginas): **0 ocorrências de "MB" (nem "GB", "megabyte") fora dos dois botões de informação**. Dentro do botão de informação "Como o tamanho do banco do site é medido" ficam os MB (216,0 de 500 MB; partes; crescimento; os cortes 350 e 425; a conta da previsão), e a conta fecha: 41,3 + 88,1 + 86,6 = 216,0; 2,9 + 2,1 + 1,7 = 6,7; (500 − 216,0) ÷ 0,24 = 1.187 dias. |
| 3. Cortes em 70% e 85% | sim | Eixo "0%, 70%, 85%, 100%", linhas e zonas na barra, legenda "até 70%", "70% a 85%", "acima de 85%", traços na minibarra, `aria-label` da barra "Corte amarelo em 70% e vermelho em 85%". Previsão em dias e data ("enche em 80 dias", "01/01/2027"). |
| 4. "Quem ocupa" em parte percentual, com o Observatório como uma parte | sim | Barra empilhada com colchete, tabela "Do que está ocupado" e "Do crescimento", cada coluna soma 100 nos 8 estados com partes; sem MB. Resposta à S3 da r4 incluída ("do que o banco ocupa", não "do limite"). |
| 5. Lugar do NAS, só se couber sem poluir | sim | Uma linha de contorno pontilhado (`border: dotted`, `role="note"`, 0 botões, 0 campos, sem `tabindex`), ícone de disco, "Backup no NAS ao chegar a um percentual do limite" e a etiqueta "ainda não existe", só com o painel aberto. Não parece funcionalidade: sem botão, sem cor de estado, texto em tom secundário, nenhum foco. O botão de informação diz "A ideia é, quando existir, enviar ao chegar a um percentual do limite, por botão ou agendado" (S5 da r4 resolvida). Ocupa 1 linha a 1440 e 2 a 390. |
| 6. "Lote" vira "exportação" | sim | **0 ocorrências de "lote"** em texto, `aria-label`, `title`, popovers e na barra de estados. Pastilha "2 exportações a confirmar", título "Exportações", frase "2 exportações esperam a sua confirmação". |

## Respostas às perguntas do pedido

- **A tela deixa claro que o limite é do banco inteiro do site?** Sim. Três lugares: o nome da pastilha ("Banco do site"), "Quem ocupa o banco do site" (Observatório como parte) e o botão de informação.
- **A leitura em percentual responde "quão perto estou e quando encho"?** Sim. "43% do limite" e a barra com os cortes respondem "quão perto"; "enche em 80 dias" na pastilha e a régua "Quando chega ao limite" respondem "quando". Em "acima do limite" lê-se 104%, "4% acima" e "já passou", nunca um número menor que 100.
- **Sobrou MB em pastilha, barra, frase, `aria-label` ou `title`?** Não (0 em 96 páginas, texto e atributos).
- **O lugar do NAS parece funcionalidade pronta?** Não.

## Resposta à r4

| Item da r4 | Conferido |
|---|---|
| C1 (`aria-label` da régua em "acima do limite" dizia "chega ao limite em out/2026, daqui a 0 dias") | Resolvido. Medido no DOM em "acima": "Previsão: o banco já passou do limite." (a mesma frase da tela, "já passou"). |
| C2 (concorrentes e seu canal só por cor) | Resolvido. Concorrentes liso, seu canal listrado na diagonal, resto do site pontilhado, na barra e no quadradinho da tabela. Em escala de cinza (recorte do painel a 390 e do painel a 1440) as três fatias e os três quadradinhos se distinguem sem a cor. Ressalva de contraste em S3. |
| S1 a S8 | S1 (coluna "Do crescimento" em previsão não medida agora existe, com a hachura "não medido" nas cinco linhas e a frase "o crescimento ainda não foi medido"), S2 (erro: exportações "não medido" com a frase "As exportações também vêm do banco, que não respondeu"), S3 (frase e coluna), S4, S5, S6, S7 e S8 (régua só listrada quando a previsão não é vermelha) feitas e vistas. |

## Coerência dos números de exemplo (varredura de uma vez)

Li pelo DOM (pastilha, frase, rótulo e `aria-label` da barra, "Ainda livre", "Cresceu", partes, dias) e refiz a conta com os MB de `bl.js`. Tudo bate; o estado (cor, nome, pastilha) é decidido sobre o mesmo inteiro mostrado.

| Estado | % mostrado (pastilha = frase = barra) | Ainda livre / passou | Cresceu em 28 dias | Do banco (conc + canal + resto) | Do crescimento | Dias, data |
|---|---|---|---|---|---|---|
| verde | 43 | 57 | +1,3% (6,7/500) | 19+41+40 = 100 (Obs 60) | 43+31+26 = 100 (Obs 74) | 1187 d, jan/2030 |
| amarelo | 72 | 28 | +1,1% | 31+37+32 = 100 (68) | 43+34+23 = 100 (77) | 700 d, set/2028 |
| vermelho por tamanho | 88 | 12 | +1,7% | 39+32+29 = 100 (71) | 55+25+20 = 100 (80) | 200 d, 01/05/2027 |
| vermelho por previsão | 78 (barra âmbar, pastilha vermelha, declarado na legenda) | 22 | +7,6% | 40+31+29 = 100 (71) | 64+23+13 = 100 (87) | 80 d, 01/01/2027 |
| acima | 104 | passou 4 | +1,7% | 39+31+30 = 100 (70) | 55+25+20 = 100 (80) | "já passou" (tela e `aria-label`) |
| zero medido | 43 | 57 | caixa "0%" + "medido: o banco não mudou" | 19+41+40 = 100 | coluna não existe, frase explica | "sem data" |
| previsão não medida | 43 | 57 | "não medido, só 6 dias de leitura" | 19+41+40 = 100 | "não medido" (hachura) | faltam 8 dias, 21/10 |
| exportações a confirmar | 43 | 57 | +1,3% | igual ao verde | igual ao verde | igual ao verde |
| sem leitura hoje, erro, sem medida | nenhum percentual na pastilha (hachura rosa); sem leitura mostra a última (12/10: 43%) | não medido | não medido | não medido | não medido | não medido |
| só leitura | nenhuma pastilha no DOM (conferido) | | | | | |

Zero medido (caixa vazada com 0, borda `--im-zero`) e não medido (hachura rosa) são distintos em toda a tela; o 0 de "Cresceu" só aparece em "zero medido".

## Achados

### Bloqueia
Nenhum.

### Corrige
Nenhum.

### Sugestão (decisão de quem desenha ou do dono; nada aqui impede de ir ao dono)

**S1. "Volta quando o banco puder ser lido" (erro ao ler, painel aberto).** É a única ocorrência da palavra "lido" em tela, e a convenção do lote a lista entre os jargões. As demais frases usam "leitura" e "ler" (decisão de rodadas anteriores). Conserto de uma linha: "Volta quando o banco responder."

**S2. Observatório mostra 74% do crescimento, a conta exata é 74,6%.** O inteiro de "Observatório" é a soma dos dois filhos já arredondados (43 + 31), para a coluna fechar em 100; arredondado uma vez só seria 75 (5,0 ÷ 6,7). Fica coerente na tela (quem soma confere), só diverge do "UM inteiro arredondado uma vez" do plano. Se o dono pedir precisão, ele só vê a diferença de 1 ponto no verde; anotar na regra do implementador.

**S3. Textura de "seu canal": a listra clara tem 2,2:1 (claro) e a escura 2,6:1 (escuro) contra o fundo do cartão.** Medido nos pixels do recorte: laranja cheio 4,94 (claro) e 6,72 (escuro), azul 4,43 e 6,80, areia 11,88 (escuro). A fatia continua delimitada pela listra cheia e o valor está escrito na tabela e no `aria-label`, então nada se perde; o 3:1 vale para cada listra se o desenho fosse só o padrão. Só aperte (listra clara menos clara) se o dono reclamar de legibilidade da barra de "quem ocupa" no claro.

**S4. Linha do NAS: 640 px de largura a 1440, alinhada a lugar nenhum da grade, e presente também nos estados de alerta.** Não polui (1 linha, tom secundário), mas fica ancorada à esquerda e não ao pé das duas colunas. Pode esperar a decisão do dono (dúvida 16: fica ou sai).

**S5. "0 exportações esperando" em "sem leitura hoje" e "ainda sem medida" é zero medido (`aria-label` "zero medido").** Só vale se a lista de exportações vem de outra consulta que respondeu; no erro já virou "não medido". É a dúvida 17 do `NOTAS.md`, já endereçada ao dono. Nada a mudar até ele responder.

**S6. Em "acima do limite", a legenda "menos de 90 dias até o limite: vermelho, qualquer que seja o tamanho de hoje" continua embaixo da régua que diz "já passou".** Ruído: a régua já se resolveu. Cortar a legenda quando "já passou". Também: o botão de informação no toque não tem botão de fechar (fecha por Esc ou toque fora); aceitável, anotar para a implementação.

## Estados: veredito por largura

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| verde (Com folga) | pronto | pronto | fechado: só a pastilha |
| amarelo (72%) | pronto | pronto | "limite em set/2028" na pastilha |
| vermelho por tamanho (88%) | pronto | pronto | |
| vermelho por previsão (78%) | pronto | pronto | "enche em 80 dias"; 2 linhas a 390 |
| acima do limite (104%) | pronto (S6) | pronto (S6) | C1 resolvida |
| zero medido | pronto | pronto | caixa vazada, sem rosa |
| previsão não medida | pronto | pronto | coluna "Do crescimento" em hachura |
| sem leitura hoje | pronto | pronto | hachura rosa; última leitura em % |
| exportações a confirmar | pronto (S4) | pronto | chip em 2 linhas a 390 |
| erro ao ler | pronto (S1, S5) | pronto | "Tentar de novo" 44 px |
| ainda sem medida | pronto | pronto | |
| só leitura | pronto | pronto | nenhuma pastilha no DOM; desvio da regra 13 já declarado ao dono |

## Tabela de medidas

| Medida | Resultado |
|---|---|
| Rolagem horizontal (96 páginas) | 0 px em todas |
| Texto menor que 12 px (96 páginas, fora do popover) | nenhum |
| Alvos a 390 px com ponteiro grosso (48 páginas) | nenhum menor que 44 x 44 (pastilha, ⓘ, "Tentar de novo"); pastilha fechada 44 a 53 px de altura |
| Alvos a 1440 | pastilha e ⓘ de 28 px de altura, permitido pela convenção (ponteiro fino); links de canal da tabela existente de 16 px (casca que já existe, fora do 18) |
| "MB" fora do botão de informação (texto + atributos) | 0 |
| "lote" em qualquer texto, atributo ou popover | 0 |
| `color-mix` | só em comentários "sem color-mix" (`bl.css`, `lote.css`); nenhum em `bl.js` |
| Contraste de texto da pastilha e do painel (4,5:1), cor e fundo lidos da página, 4 combinações de tema e largura | menor: 5,59 (vermelho, escuro, "Banco do site: 88%", "enche em 80 dias"); vermelho no claro 5,90 a 6,16; exportações no escuro 6,18; demais 6,64 a 6,83. Texto sobre hachura rosa (fundo em gradiente) fica fora do script; r4 calculou à mão acima de 4,5 e nada mudou ali |
| Elementos gráficos (3:1) | zonas e preenchimento sem mudança desde a r4 (zona âmbar 3,40 e 3,42, vermelha 3,53 e 3,93, verde 8,13 e 5,74). Texturas novas: ver S3 |
| Escala de cinza | verde 390 e acima 1440 conferidos: símbolos (círculo, triângulo, octógono), listras das zonas e as três texturas de "quem ocupa" se distinguem; hachura rosa continua distinta |
| Foco visível | 2 px sólido laranja (rgb 255, 130, 64) na pastilha, nos ⓘ e nos links. Enter na pastilha abre e fecha (`aria-expanded` true e false), Tab vai ao ⓘ da barra, ao ⓘ das exportações e à tabela; Enter abre o botão de informação, Esc fecha e devolve o foco ao próprio ⓘ. A linha do NAS não recebe foco |
| Botão de informação a 390 | 366 x 733 px dentro de 844 de altura, rola por dentro (`overflow-y: auto`); cabe e lê |
| Erros de página no console | nenhum (o recurso externo de fonte é bloqueado de propósito) |

## O que NÃO consegui verificar

- Leitor de tela (VoiceOver, NVDA): li `aria-label`, `aria-expanded`, `role` e o foco no DOM; não ouvi nada.
- Safari e Opera (o navegador do dono renderiza `color-mix()` transparente): só confirmei a ausência no CSS.
- Toque em aparelho real (usei emulação de toque do Chromium).
- Movimento reduzido: li o CSS, não gravei a transição.
- Fontes da web (Fraunces, Inter, JetBrains Mono): bloqueadas na captura, as larguras reais podem diferir poucos pixels e mudar onde quebram "Resto do site 29%" ou a frase da pastilha a 390.
- Contraste de texto sobre hachura rosa: não reabri a conta da r4, que ficou em 5,5 e 6,0 (escuro) e 6,0 (claro).
- Abri 12 capturas; o resto conferi por script (texto, atributos, medidas). A conta de "cresceu" e dos dias usa os números de exemplo de `bl.js`; a produção terá outra série.

## Arquivos

- Esta revisão: `/Users/figueiredo/Workspace/bythiagofigueiredo/docs/superpowers/mockups/2026-10-13-a5-lote-2/18-aviso-banco-limite/REVISAO-UX-r5.md`
- Capturas e dump de medidas da rodada: no diretório temporário da sessão (scratchpad), fora do repositório; nada foi gravado em `shots/`.
