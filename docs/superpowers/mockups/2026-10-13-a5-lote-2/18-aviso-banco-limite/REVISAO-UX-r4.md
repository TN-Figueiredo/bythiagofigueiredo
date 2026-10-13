# Revisão de UX, mockup 18 (aviso "banco chegando ao limite"), rodada 4

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Escopo: conferir se o retorno do dono (`RETORNO-DO-DONO-13-10.md`) foi atendido de verdade em todos os estados, a coerência dos números de exemplo, e o de sempre (390 px, alvos, foco, contraste, color-mix, zero x não medido).

Medi no Chromium headless (Playwright) sobre servidores estáticos meus nas portas 47721 a 47725, todos derrubados ao terminar (nada na 3099, 47700 ou 47701; sem specs do projeto; nada fora desta pasta foi tocado). Gerei 96 capturas (12 estados x painel aberto e fechado x 1440 e 390 x escuro e claro), mais 24 recortes do painel aberto (`shots/r4/`) e medi cada uma: rolagem, texto menor que 12 px, alvos a 390, todo texto e todo atributo (`aria-label`, `title`, `alt`) em busca de "MB" e "lote". Abri e olhei 14 capturas e o recorte em cinza de 3 estados.

## Veredito: VOLTA PARA AJUSTE (zero bloqueio, 2 "corrige", ambos de uma linha)

Pergunta de quem abre: "quanto do limite do banco do site já usei, e quando enche?". Em 3 segundos, sem rolar e sem abrir dica: a pastilha da faixa diz "Banco do site: 43% do limite" com minibarra e símbolo; em alerta ela ganha borda e forma (triângulo, octógono) e, quando há previsão curta, "enche em 80 dias". O painel aberto responde com a barra de 0% a 100% (cortes em 70% e 85% desenhados), a frase em negrito e a régua do tempo. Funciona, e o retorno do dono foi atendido, como mostra a tabela abaixo.

Não dou "pronto para o dono" porque sobraram dois defeitos reais, pequenos e baratos: um `aria-label` que contradiz a tela em "acima do limite" e as fatias de "quem ocupa" que só se distinguem por cor. Quem desenhou corrige e eu confiro só esses dois pontos na rodada 5.

## O retorno do dono, item por item

| Pedido do dono | Atendido? | Evidência medida ou vista |
|---|---|---|
| 1. O limite é do banco INTEIRO, não do Observatório | sim | Toda frase, pastilha, título e `aria-label` começa por "Banco do site". "Quem ocupa o banco do site" mostra o colchete "Observatório 60%" ao lado de "Resto do site 40%"; a frase diz "O Observatório ocupa 60% do banco do site". O ⓘ diz "o tamanho de todo o banco do site, não só o do Observatório". Visto em `verde-1440.png` e `verde-390.png`. |
| 2. Percentual, sem valores | sim | Varredura de TODO texto visível e de `aria-label`, `title`, `alt` nos 12 estados, aberto e fechado, 1440 e 390: **0 ocorrências de "MB" fora do ⓘ** (23 ocorrências, todas dentro de `[popover]`). Pastilha, minibarra, barra, frase, "Ainda livre", "Cresceu", rótulo da barra, última leitura, régua: tudo em %. A única menção a "MB" fora do ⓘ é a nota da barra de estados do mockup (`#mock`, "não faz parte da tela") e a tabela de referência `.fora`. |
| 3. Cortes em 70% e 85% | sim | Linhas e zonas da barra em 70% e 85% (eixo 0, 70, 85, 100); legenda "até 70%", "70% a 85%", "acima de 85%"; minibarra com os dois traços; ⓘ com "70% (350 MB)" e "85% (425 MB)". A previsão segue em dias e data ("enche em 80 dias", "01/01/2027"). |
| 4. "Quem ocupa" em parte percentual | sim | Barra empilhada com colchete, tabela "Do banco" e "Do crescimento", cada coluna soma 100, Observatório = soma dos dois filhos (conferido por código nos 8 estados com partes; veja a varredura abaixo). Sem crescimento medido a coluna some (ver S1). |
| 5. Lugar do backup no NAS, só se couber sem poluir | sim | Uma linha de contorno pontilhado `--dim` no pé do painel aberto, ícone de disco, "Backup no NAS ao chegar a um percentual do limite" e a etiqueta "ainda não existe". Sem botão, campo, cor de estado ou foco (`role="note"`). Ocupa 1 linha a 1440 e 2 a 390. Não parece funcionalidade pronta: texto em `--muted`, nenhum controle. Ressalva em S5 (o ⓘ promete "será"). |
| 6. "Lote" vira "exportação" | sim | **0 ocorrências de "lote"** em qualquer texto ou atributo, incluindo popovers e a barra de estados (`?caso=lote-pendente` continua como apelido de URL, que o usuário não vê). Pastilha "2 exportações a confirmar", título "Exportações", frase "2 exportações esperam a sua confirmação". |

## Coerência dos números de exemplo (varredura de uma vez, 8 estados com tamanho)

Refiz a conta com uma fonte minha (os MB de bl.js) e li os números no DOM, não nas capturas. Pastilha, frase, rótulo da barra, `aria-label` da barra, "Ainda livre", "Cresceu", partes e dias batem em todos.

| Estado | % mostrado (pastilha = frase = barra) | Ainda livre / passou | Cresceu em 28 dias | Partes do banco (conc + canal + resto) | Partes do crescimento | Dias e data |
|---|---|---|---|---|---|---|
| verde (216) | 43 = 43 = 43 | 57 | +1,3% (1,34) | 19 + 41 + 40 = 100; Obs 60 | 43 + 31 + 26 = 100; Obs 74 | 1187 d, jan/2030 |
| amarelo (360) | 72 = 72 = 72 | 28 | +1,1% (1,12) | 31 + 37 + 32 = 100; Obs 68 | 43 + 34 + 23 = 100; Obs 77 | 700 d, set/2028 |
| vermelho por tamanho (440) | 88 = 88 = 88 | 12 | +1,7% (1,68) | 39 + 32 + 29 = 100; Obs 71 | 55 + 25 + 20 = 100; Obs 80 | 200 d, 01/05/2027 |
| vermelho por previsão (392) | 78 = 78 = 78 | 22 | +7,6% (7,56) | 40 + 31 + 29 = 100; Obs 71 | 64 + 23 + 13 = 100; Obs 87 | 80 d, 01/01/2027 (hoje + 80 = 01/01) |
| acima (521) | 104 = 104 = 104 | passou 4 | +1,7% | 39 + 31 + 30 = 100; Obs 70 | 55 + 25 + 20 = 100; Obs 80 | "já passou" (ver C1) |
| zero medido | 43 | 57 | caixa "0%" | 19 + 41 + 40 = 100 | coluna não existe; frase diz "o banco não cresceu em 28 dias" | "sem data" |
| previsão não medida | 43 | 57 | "não medido, só 6 dias de leitura" | 19 + 41 + 40 = 100 | coluna não existe (ver S1) | faltam 8 dias, 21/10 |
| exportações a confirmar | 43 | 57 | +1,3% | igual ao verde | igual ao verde | igual ao verde |

Cor e texto não se contradizem: o estado é decidido sobre o mesmo inteiro (72 é amarelo, 88 é vermelho, 104 é "Acima do limite"). Em "vermelho por previsão" a barra fica âmbar (78% de tamanho) e a pastilha, o octógono do rótulo e o losango da régua ficam vermelhos; a legenda "ou cheio em menos de 90 dias" explica, e o desvio está declarado. Os três estados sem leitura (sem leitura hoje, erro, sem medida) mostram hachura rosa na pastilha, na minibarra, na barra, na régua e em "quem ocupa", e nunca percentual ou verde.

## Achados

### Bloqueia

Nenhum.

### Corrige

**C1. Régua do tempo em "acima do limite": o `aria-label` afirma o contrário da tela.** Tela e estado: "Acima do limite (104%)", régua "Quando chega ao limite". A tela mostra "já passou" (certo). O `aria-label` da régua lê, medido no DOM: "Previsão: chega ao limite em out/2026, daqui a 0 dias. Menos de 90 dias é vermelho." Quem usa leitor de tela ouve que o banco VAI chegar ao limite, quando ele já passou. Evidência: `BL.dias = 0` cai no ramo `proj === 'ok'` da linha 156 de `bl.js`, antes do tratamento de `dias === 0` da linha 158, que só troca o desenho. Conserto: quando `dias === 0`, o `aria-label` diz "Previsão: o banco já passou do limite." (a mesma frase que `projTxt()` já tem).

**C2. "Quem ocupa": concorrentes e seu canal só se distinguem por cor.** Tela e estado: todos os estados com partes, tema claro e escuro. Em escala de cinza (conferi `g-amarelo-1440.png` e `g-vermelho-projecao-390.png`, gerados por mim a partir de `shots/r4/`) as duas fatias do Observatório viram o mesmo cinza, separadas só por um fio de 2 px, e as duas bolinhas da tabela ficam idênticas; a ordem é a única pista. A regra 4 do dono ("símbolo junto da cor, sempre; tem de ler em escala de cinza") e o item "nada depende só de cor" valem aqui, porque "quem ocupa" é um dos pedidos do retorno. O número está na tabela, então nada se perde por completo, por isso não bloqueia. Conserto: escreva o percentual dentro de cada fatia quando ela tiver largura (19%, 41%, 40% medem 57 a 120 px a 1440 e 22 a 40 a 390) ou ponha uma forma diferente no quadradinho da tabela e na fatia (listra e pontos, como a zona vermelha já faz).

### Sugestão (não bloqueia, decisão de quem desenha ou do dono)

**S1. Previsão não medida: a coluna "Do crescimento" some sem aviso.** Em "previsão não medida" a tabela "Quem ocupa" mostra só "Do banco" e a frase não diz nada do crescimento. O motivo está na célula "Cresceu em 28 dias: não medido, só 6 dias de leitura", mas quem olha a tabela vê uma coluna que não existe, e não uma coluna não medida. Em "zero medido" a frase explica; aqui nada. Sugestão: manter a coluna com a hachura rosa "não medido" nas quatro linhas, ou acrescentar "o crescimento ainda não foi medido" à frase.

**S2. "Exportações: 0 exportações esperando" em "erro ao ler".** O quadro de zero medido aparece também com o aviso "o banco não respondeu, nada indica que está tudo bem". Se a leitura das exportações vem do mesmo banco, esse 0 é um "não sei" posando de zero (o sistema falha em verde). Sugestão: no erro, trocar por "não medido" com hachura; se for outra consulta que respondeu, vale uma palavra no ⓘ dizendo isso.

**S3. A base de "60% do banco do site" pode ser lida como 60% do limite.** O dono vê "43% do limite" e logo abaixo "Observatório 60%". São bases diferentes (60% do que o banco ocupa hoje, que equivale a 26% do limite). A coluna "Do banco" e a frase ajudam, mas "do banco" e "do limite" se parecem. Sugestão: "60% do que o banco ocupa" na frase e "Do que está ocupado" na coluna. Confirmar com o dono se ele entendeu assim.

**S4. Redundância em "acima do limite".** O 4% aparece quatro vezes: "104% do limite" na pastilha, "4% acima" na barra, "Passou 4% do limite" na frase e "Passou 4% do limite" na célula. Corte a frase para "Banco do site acima do limite: 104% do limite." ou a célula.

**S5. O ⓘ promete o que a tela diz que não existe.** "Backup no NAS: ainda não existe. Quando existir, será ao chegar a um percentual do limite, por botão ou agendado." O dono disse "talvez" e "eventualmente". Sugestão: "a ideia é, quando existir, ...". Mesma frase fora do ⓘ não existe, só o ⓘ.

**S6. "14 dias depois da primeira leitura (14/10)" em "ainda sem medida".** 27/10 é 13 dias depois de 14/10; é o dia da 14ª leitura, coerente com "faltam 8 dias, 21/10" de "previsão não medida". Sugestão: "quando houver 14 dias de leitura, em 27/10".

**S7. "Antes disso não existe dado, e isso não é 0%" em "ainda sem medida".** Frase que responde a uma dúvida do desenhista, não do usuário. Sugestão: "Antes disso não há dado." (a hachura rosa já diz que não é zero).

**S8. Zona vermelha da régua do tempo em estado calmo (repetida da r2 e da r3).** Em "Com folga" e "Zero medido" a faixa dos primeiros 90 dias continua em vermelho cheio e é o bloco mais saturado da tela, mesmo sem risco. Contorno e listras, sem preenchimento cheio, quando não há data prevista ou ela é distante.

**S9. Faixa vazia na coluna da esquerda em "exportações a confirmar" a 1440** (cerca de 300 px abaixo da régua, ao lado dos dois cartões). Só estética; o NAS reservado fica longe da pastilha. Pode ficar.

**S10. "exemplo" sozinho numa linha a 390 px abaixo da pastilha** (repetida da r3) e **âmbar e laranja de "seu canal" parecidos no claro** (herança dos tokens do lote 1; no claro a barra amarela e a fatia "seu canal" usam ocres próximos, mas ficam em blocos separados e com legenda diferente).

## Estados: veredito por largura (medidos nos quatro cruzamentos, aberto e fechado)

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| verde (Com folga) | pronto | pronto | também fechado: só a pastilha |
| amarelo (72%) | pronto | pronto | pastilha com "limite em set/2028" |
| vermelho por tamanho (88%) | pronto | pronto | |
| vermelho por previsão (78%) | pronto | pronto | chip "enche em 80 dias"; 2 linhas a 390 |
| acima do limite (104%) | ajuste (C1) | ajuste (C1) | só o `aria-label` da régua |
| zero medido | pronto | pronto | caixa vazada "0%", sem rosa |
| previsão não medida | pronto (S1) | pronto (S1) | |
| sem leitura hoje | pronto | pronto | hachura rosa, última leitura em % |
| exportações a confirmar | pronto | pronto | chip em 2 linhas a 390 |
| erro ao ler | pronto (S2) | pronto (S2) | "Tentar de novo" 44 px |
| ainda sem medida | pronto (S6, S7) | pronto | |
| só leitura (não vê) | pronto | pronto | nenhuma pastilha no DOM; desvio da regra 13 já declarado ao dono |

C2 vale para todos os estados com "quem ocupa" (8 de 12).

## Tabela de medidas

| Medida | Resultado |
|---|---|
| Rolagem horizontal (96 capturas) | 0 px em todas |
| Texto menor que 12 px (96 capturas, fora do popover) | nenhum |
| Alvos a 390 px com ponteiro grosso (48 capturas) | nenhum menor que 44 x 44 (pastilha, ⓘ, "Tentar de novo", links) |
| Alvos a 1440 | pastilha e ⓘ de 28 px, permitidos pela convenção (ponteiro fino) |
| "MB" fora do ⓘ (texto e atributos, 96 capturas) | 0 |
| "lote" em qualquer texto ou atributo (96 capturas, popovers incluídos) | 0 |
| `color-mix` | só em comentários "sem color-mix" (`bl.css`, `lote.css`, `a4.css`); nenhum em `bl.js` |
| Pior contraste de texto da pastilha e do painel, calculado sobre cor e fundo lidos da página (mínimo 4,5:1) | 5,59 (vermelho, escuro, "Banco do site: 88%" e "enche em 80 dias"), 5,90 a 6,16 (vermelho, claro), 6,18 (exportações, escuro), 6,64 a 6,83 (demais). Os textos sobre hachura rosa ("não medido", pastilha "Sem leitura hoje") ficam sem número do script (fundo em gradiente); calculei à mão cerca de 5,5 e 6,0 (escuro) e cerca de 6,0 (claro), todos acima de 4,5 |
| Elementos gráficos (3:1) | CSS de zonas e preenchimento sem mudança desde a r3: zona âmbar 3,40 / 3,42, zona vermelha 3,53 / 3,93, preenchimento verde 8,13 / 5,74 (escuro / claro). Novos nesta rodada: bordas pontilhadas do NAS e da régua de dias (`--dim`) 5,5 e 5,6; caixa de zero (`--im-zero`) 5,6 e 4,9; hachura rosa (linha) cerca de 4,2 e 4,4. Todos acima de 3:1 |
| Escala de cinza | conferi 3 estados: ícone, forma e listra continuam distinguindo verde, âmbar e vermelho; hachura rosa continua distinta; falha só em C2 |
| Foco visível | 2 px sólido laranja (rgb 255 130 64) na pastilha e nos links; Enter abre o painel (`aria-expanded` vira `true`), Tab chega ao ⓘ, Enter abre o popover, Esc fecha e devolve o foco ao próprio ⓘ |
| Alturas do painel aberto, 1440 / 390 | verde 516 / 1090, amarelo 516 / 1107, vermelho por tamanho 536 / 1130, por previsão 516 / 1084, acima 516 / 1090, zero medido 536 / 1087, previsão não medida 495 / 1017, sem leitura 383 / 736, exportações 743 / 1402, erro 411 / 788, vazio 403 / 779 |
| Erros de console | nenhum erro de página (o recurso externo de fonte é bloqueado de propósito na captura) |

## O que NÃO consegui verificar

- Leitor de tela (VoiceOver, NVDA): li `aria-label`, `aria-expanded`, `aria-controls` e `role` no DOM e por interação; não ouvi nada. C1 foi achado assim.
- Safari e Opera (o navegador do dono renderiza `color-mix()` transparente): confirmei só a ausência no CSS.
- Toque em dispositivo real (emulação de toque do Chromium).
- Movimento reduzido: li o CSS (só a seta da pastilha anima e é desligada), não gravei a transição.
- Fontes da web (Fraunces, Inter, JetBrains Mono): bloqueadas na captura; larguras reais podem diferir poucos pixels, o que pode mudar onde o rótulo "Resto do site 32%" quebra a 390.
- Contraste de texto sobre hachura rosa: calculei à mão, não pelo script.
- Abri 14 das 96 capturas e 3 recortes em cinza; o restante conferi por medida e pela varredura de texto.
- A conta de "cresceu em 28 dias" e dos dias usa os números de exemplo de `bl.js`; a produção terá outra série.

## Arquivos

- Esta revisão: `docs/superpowers/mockups/2026-10-13-a5-lote-2/18-aviso-banco-limite/REVISAO-UX-r4.md`
- Capturas e medidas da rodada: `docs/superpowers/mockups/2026-10-13-a5-lote-2/18-aviso-banco-limite/shots/r4/` (recortes do painel aberto por estado, 1440 escuro e 390 claro, em cinza para três, o popover do ⓘ, `medidas-r4.json` e `contraste-r4.json`).
