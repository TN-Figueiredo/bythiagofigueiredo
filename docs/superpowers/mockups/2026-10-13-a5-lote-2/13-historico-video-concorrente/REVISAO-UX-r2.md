# Revisão de UX, rodada 2: Mockup 13, Histórico do vídeo de concorrente (A5, lote 2)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Lido: `REVISAO-UX-r1.md`, `PLANO.md`, `NOTAS.md` (seções 1, 2, 5 e 6), `index.html`, `m13.css`, `m13.js`, `m13-graf.js`, `m13-dados.js`. Medi com script próprio de Chromium headless sobre servidor estático na porta 47745 a 47746 (derrubado ao terminar), 14 estados x 4 cruzamentos (1440 e 390, escuro e claro) = 56 páginas, e abri as capturas do meu script (fatias de página, sem reduzir): `cheio`, `extremo`, `recente`, `magro`, `zero`, `naomedido`, `semanal`, `saiu`, `erro`, `carregando` a 1440 escuro, e `cheio`, `recente`, `zero`, `semanal`, `extremo`, `aovivo`, `vazio`, `mantido`, `leitura`, `erro` a 390 claro. Quatro evidências ficaram em `shots/r2-*.png`.

## Resumo

**Veredito do mockup: NÃO PODE IR AO DONO nesta rodada. 2 bloqueios novos, 4 "corrige", 6 sugestões.**

Os 4 bloqueios e os 10 "corrige" da r1 foram resolvidos (o C4, parcialmente; tabela abaixo). Nenhum conserto da r1 quebrou outra coisa, **exceto um**: o rótulo do pico das 72 horas, que o conserto C1 passou para a esquerda da barra e agora sai do gráfico a 390 px. E achei um defeito que a r1 não viu, e que já estava lá: **os pares de barras "1, 7 e 30 dias" não têm proporção**. É a régua de relance da tela e ela mente. Assumo a falha de não ter medido a largura das barras na r1.

Vão ao dono em condições de "pronto" assim que os dois bloqueios forem consertados (ambos são de uma ou duas linhas): `magro`, `vazio`, `carregando`, `erro`, `naomedido`, `aovivo`. Os demais voltam para o ajuste dos dois bloqueios mais os "corrige" que os tocam.

As três coisas que mais derrubam o conjunto agora:
1. **Barras dos pares sem proporção** (`m13.js:232-233`): a largura é `calc(P% - 90px)`, que não é proporcional ao valor.
2. **Rótulo do pico das 72 horas sai do desenho a 390 px** em 6 estados.
3. **Rótulos de valor da série semanal se tocam a 390 px** ("722723", "78Z"), consequência do mesmo tipo de colisão que a r1 mandou consertar.

## A pergunta do dono e o relance

Pergunta: **"Esse vídeo foi bem para a idade dele, e algo que o canal mexeu veio antes de ele subir?"**

- 1440 escuro: responde em 3 s. A frase-resumo está em y = 680 a 727 (cabe na janela de 900 px) e já traz as duas metades: "2,8 vezes o normal", "▲ Subiu em 16/10" e "Nos 14 dias antes, o canal mudou o título (11/10) e a miniatura (13/10)." (C3 resolvido; lista, sem causa). Para o `extremo` a frase diz "14 mudanças, 12 delas nos 14 dias antes" e confere com a lista (12 dentro, 2 fora).
- 390 claro: o resumo começa em y = 905 (`recente`, `magro`, `zero`, `naomedido`), 911 (`aovivo`), 952 a 979 (`cheio`, `semanal`, `saiu`), 975 (`extremo`) e 1.087 (`leitura`); viewport 844. Melhorou (era 1.100 a 1.207), mas **nunca cabe na primeira tela**, e a casca de 680 px é a do lote 1. Registro como sugestão S1, não bloqueio: o dono aprovou essa casca no lote 1.

## Bloqueios (nada vai ao dono com eles abertos)

**R2-B1. Os pares de barras ("Os mesmos pontos, lado a lado") não são proporcionais aos valores.**
Tela e estado: bloco "Views por idade", todos os estados com par (`cheio`, `extremo`, `recente`, `zero`, `saiu`, `mantido`, `leitura`, `aovivo`), 1440 e 390. É a régua de relance do bloco; o dono compara as duas barras sem ler a curva.
Evidência: medi a largura de cada `.hv-bar` no navegador. `extremo` 1440, "1 dia": 46,9 mil contra 7.280 (razão 6,4) aparece como 178 px contra 8 px (razão 22). `extremo` "30 dias": 1,02 mi contra 47,3 mil (razão 21,6) aparece como 178 contra 8. `cheio` "30 dias": 94,3 mil contra 33,8 mil (razão 2,8) aparece como 178 contra 8 px (razão 22) e a barra do normal vira um risco de 8 px (a 390: 226 contra 23). `zero` "1 dia": 20 contra 160 (1 para 8) aparece como 8 contra 178 (1 para 22). `saiu` "1 dia": 4.260 contra 5.200 (0,82) aparece como 130 contra 178 (0,73). `cheio` "7 dias": 13,5 mil contra 15,2 mil (0,89) aparece como 149 contra 178 (0,84). Captura: `shots/r2-B1-pares-sem-proporcao-extremo-1440-escuro.png`. Causa: `m13.js:232` e `:233` escrevem `width:calc(P% - 90px)`; a subtração de 90 px é aplicada depois da porcentagem e acaba achatando as diferenças (e o `min-width:8px` de `m13.css:96` segura tudo o que fica abaixo de 8 px). A tela afirma "2,8 vezes o normal" por escrito e desenha 22 vezes.
Conserto: trocar por `width:calc((100% - 90px) * R)` com `R = valor / max` (de 0 a 1, ponto como separador decimal), nas duas barras (do vídeo e do normal). Manter `min-width:8px` só para valor maior que zero. Depois, medir de novo: a razão das larguras deve bater com a razão dos valores com erro menor que 1 px.

**R2-B2. Rótulo do pico das 72 horas ("300 em 1 hora") sai do desenho a 390 px.**
Tela e estado: bloco "As primeiras 72 horas", 390 px (claro e escuro), estados `cheio`, `recente`, `zero`, `saiu`, `mantido` e `leitura` (6 de 14). É defeito criado pelo conserto C1 da r1 ("o rótulo do pico troca de lado"): o texto foi para a esquerda do pico, onde a 390 px não cabe.
Evidência (medi `getBoundingClientRect` de cada `svg text` contra o seu `svg`): `cheio` "300 em 1 hora" começa 43 px à esquerda do SVG (sai do cartão e a borda da tela corta o começo: na captura lê-se "00 em 1 hora"); `saiu` e `mantido` "322 em 1 hora" 43 px; `recente` "436 em 1 hora" 31 px e cai em cima do "600" do eixo; `zero` "2 em 1 hora" 34 px e cai em cima do "2" do eixo (colisão medida: "2 x 2 em 1 hora"). Captura: `shots/r2-B2-pico-cortado-cheio-390-claro.png`. `recente` é o estado real de hoje.
Conserto: em `m13-graf.js` (rótulo do pico), calcular a largura do texto e, se `x_do_pico - largura < margem_esquerda_do_eixo`, ancorar o rótulo com `text-anchor:start` à direita do pico; só trocar para a esquerda se couber. Se também colidir com a linha de "½ das views", subir uma linha em vez de trocar de lado. A conferência é a mesma da r1 mais uma: nenhum `svg text` com retângulo fora do `svg` (script `clip` da r2) em nenhum dos 56 cruzamentos.

## Corrige (vai ao dono só depois de corrigido)

**R2-C1. `semanal`, 390 claro e escuro: os rótulos de valor dos pontos se tocam.**
"722" e "723" viram "722723" e "782" fica "78Z" sob o ponto vizinho (colisões medidas: "722 x 723", "783 x 725"). Captura: `shots/r2-C1-semanal-rotulos-colidem-390-claro.png` (coluna do meio). A 1440 estão limpos. Conserto: a 390, alternar a altura dos rótulos (um em cima, o seguinte embaixo do ponto) quando a distância horizontal for menor que a largura do texto, ou mostrar o rótulo só no ponto selecionado e na máxima/mínima.

**R2-C2. `mantido`, 390: a pastilha "saiu do YouTube em 09/10 · mantido para análise" quebra em duas linhas coladas no contorno.**
Captura: `shots/r2-C2-mantido-pastilha-390-claro.png` (coluna 3). Altura de linha e padding não acompanham a quebra; o texto encosta nas bordas. Conserto: `padding:8px 12px` e `line-height:20px` na pastilha abaixo de 420 px, ou encurtar para "saiu em 09/10 · mantido" nessa largura (a frase inteira fica na leitura do cabeçalho).

**R2-C3. `semanal`: o mesmo fato (Subida) aparece com duas cores.**
A célula "Subida" da faixa usa a pastilha rosa "não medido" e o cartão logo abaixo usa a caixa neutra "inconclusivo: série semanal". O PLANO diz que o dado semanal é "o dado chegou, só não decide" (neutro) e não "o dado não chegou" (rosa). Conserto: a célula "Subida" do `semanal` passa para a forma neutra (meio relógio, contorno cheio) com o texto "contagem por semana"; as células de 1, 7 e 30 dias seguem rosa, porque ali a comparação por idade de fato não é medida.

**R2-C4. Os dois botões ⓘ dos blocos "não medido" ainda têm o mesmo rótulo** ("Como esta parte é calculada"), no `semanal` e no `magro`. A sugestão S5 da r1 foi atendida nos quatro blocos com gráfico e esquecida nos dois sem gráfico. Conserto: "Como ler a curva por idade" e "Como ler as 72 horas" também nesses dois, como já está nos blocos com dado.

## Sugestões (não bloqueiam)

- **S1.** 390 px: o resumo nunca cabe na primeira tela (905 a 1.087 contra 844). Se o dono reclamar, o aviso "exemplo" e o de só leitura podem virar uma linha só, e o cabeçalho do vídeo pode perder a capa de 120 x 68 px. A casca é do lote 1.
- **S2.** "1,02 mi" e "1,04 mi" (`extremo`): "mi" e "mil" se parecem demais. Preferir "1,02 milhão".
- **S3.** `naomedido` curva por idade, ponto de 5 dias: o círculo azul do vídeo (9.226) fica por baixo do quadrado do normal (10,1 mil) e quase some. Desenhar o círculo por cima do quadrado.
- **S4.** `extremo`, 390 px, raias: as caixas "×4", "×6" e "×2" se encostam; funciona, mas é denso. Aceitável pela lista abaixo, que diz tudo.
- **S5.** Régua de horas: as marcas "¼", "½", "¾" estão em tamanho de 12 px com a fração empilhada, difícil de ler. Escrever "1/4", "1/2", "3/4" ou "25%", "50%", "75%".
- **S6.** `erro`: "Os números e os gráficos voltam quando a tela abrir" promete o que a tela não sabe (a r1 B4 consertou a frase principal, esta é a vizinha). Dizer "Os números e os gráficos aparecem quando o histórico abrir."

## Conferência dos bloqueios e dos "corrige" da r1

| Item | Resultado | Evidência |
|---|---|---|
| B1 (47 das 72) | resolvido | `zero`: resumo "47 das 67 horas medidas" e bloco "Em 47 das 67 horas medidas"; mesma conta |
| B2 (1 dos 8) | resolvido | `naomedido`: "Só 1 dos 5 pontos que já existem tem contagem; os outros 4 são "não medido"… Os 5 pontos de idades maiores ainda não existem."; confere com os 10 pontos desenhados (1 medido, 4 hachurados, 5 pontilhados) |
| B3 (perto do normal o normal) | resolvido | pares: "perto do normal", "0,9 vez o normal, abaixo", "2,8 vezes o normal" |
| B4 (Nada foi perdido) | resolvido | `erro`: "O servidor não respondeu. Tente de novo; se continuar assim, avise." |
| C1 (linhas atravessam números) | resolvido nos gráficos de dia e de curva (contorno de 4 px; "1.964", "06/10", "2.867" legíveis); **criou R2-B2** e **sobrou R2-C1** | capturas `saiu`, `recente`, `extremo` |
| C2 ("0" na caixa vazada do dia) | resolvido | `zero`: "0" em 08/10 e 12/10 |
| C3 (pergunta inteira no resumo) | resolvido | `cheio`, `extremo`, `leitura` |
| C4 (resumo cedo a 390) | parcialmente (905 hoje, 952 a 975 em novembro, 1.087 `leitura`); declarado na `NOTAS`; vira S1 | tabela de medidas |
| C5 (passe o mouse x toque) | resolvido | 390: "Toque no gráfico…"; 1440: "Passe o mouse…" |
| C6 (¼ some) | resolvido | `extremo`: marca hachurada "não medido" na ponta de 0 h e frase com "7 h 40 min depois de publicar" |
| C7 (7 h12 h) | resolvido | `zero` 390: "7 h" em cima e "12 h" embaixo |
| C8 (série x contagem por semana) | resolvido, com R2-C3 | células dizem "contagem por semana"; "série" só no veredito e no ⓘ |
| C9 ("com 4.") | resolvido | `saiu`: "o vídeo saiu do YouTube com 4 dias de contagem, então a subida não vai ser medida" |
| C10 (dado real x exemplo) | resolvido | `NOTAS` seção 5 |
| S2, S3, S6, S7 da r1 (aceitos pelo desenhista) | conferidos | botão neutro em "saiu"; dia 09/10 com contorno pontilhado; esqueleto de carregamento visível; duração 11:05 uniforme |

## Veredito por estado e por largura

| Estado | 1440 escuro | 390 claro | Veredito | O que pesa |
|---|---|---|---|---|
| `cheio` | ok com ressalvas | ok com ressalvas | volta para ajuste | R2-B1, R2-B2 |
| `extremo` | ok com ressalvas | ok com ressalvas | volta para ajuste | R2-B1 (o pior: 22 contra 6), S2, S4 |
| `recente` (real de hoje) | ok com ressalvas | **falha** | volta para ajuste | R2-B2 (cai em cima do eixo) |
| `magro` (real de hoje) | ok | ok | pronto, depois de R2-C4 | só R2-C4 |
| `zero` | ok com ressalvas | **falha** | volta para ajuste | R2-B1, R2-B2 |
| `naomedido` | ok | ok | pronto, depois de S3/R2-C4 (não bloqueiam) | nenhum bloqueio |
| `semanal` | ok | ok com ressalvas | volta para ajuste | R2-C1, R2-C3, R2-C4 |
| `saiu` | ok com ressalvas | ok com ressalvas | volta para ajuste | R2-B1, R2-B2 |
| `mantido` | ok com ressalvas | ok com ressalvas | volta para ajuste | R2-B2, R2-C2 |
| `aovivo` | ok | ok | pronto | R2-B1 só se a barra do vídeo ficar sozinha: sem normal, a proporção não se aplica |
| `vazio` | ok | ok | pronto | nenhum |
| `carregando` | ok | ok | pronto | nenhum |
| `erro` | ok | ok | pronto | S6 |
| `leitura` | ok com ressalvas | ok com ressalvas | volta para ajuste | R2-B1, R2-B2 |

## Cobrança do dono, ponto a ponto

| Regra | Resultado |
|---|---|
| Frase-resumo no topo | sim, em todo estado com dado; vazio e magro dizem o que falta |
| Régua ou barra para comparar de relance | tem, mas as barras dos pares estão erradas (R2-B1) |
| Cor estável por significado, inclusive "não medido" | sim: azul = este vídeo, areia = normal, verde = subida, rosa hachurado = não medido (nunca a cor de zero), pontilhado = ainda não existe; uma exceção em R2-C3 |
| Símbolo junto da cor | sim: círculo, quadrado tracejado, ▲, hachura, caixa vazada, losango, triângulo, círculo com número |
| Método no botão de informação | sim, 4 + 2 botões; popover abre por Enter, fecha com Esc e devolve o foco ao botão |
| "Zero medido" distinto de "não medido" | sim (`zero`: caixa vazada com "0" no dia; hachura rosa nas horas antes da primeira contagem) |
| Sem bloco monocromático nem prosa | sim; os blocos têm gráfico, faixa de números ou pastilha |
| Frases sem jargão | sim, exceto "mi" (S2) e "série" no veredito, que é a frase exata do spec |
| `color-mix()` ausente | sim: `grep` só acha 5 comentários "sem color-mix" |
| Escuro a 1440 e claro a 390 | os dois pares abertos para todos os 14 estados (via medição) e para 12 por captura |
| Alvo de 44 px a 390 | 0 abaixo de 44 nos 28 cruzamentos a 390 (ⓘ 44 x 44, anterior/seguinte 44 x 44, "Ver como tabela" 98 x 44, botões 117 a 153 x 44, "Mudanças" 70 x 44, "Próximo" 80 x 44) |
| Foco visível, aria | contorno sólido de 2 px `--accent` em todos os 40 primeiros focos (1440 escuro `cheio`, 390 claro `semanal`); ordem: casca, botões do vídeo, ⓘ, grupo do gráfico, anterior, seguinte, tabela, bloco seguinte; grupos com `role=group` e `aria-label` por extenso; setas, Início e Fim atualizam a linha de leitura (testado) |

## Tabela de medidas

Contraste WCAG sobre `--surface` (valores lidos da página; tokens iguais aos da r1). Texto: 4,5:1. Elemento gráfico: 3:1.

| Elemento | Escuro | Claro | Mínimo |
|---|---|---|---|
| `--text` | 14,48 | 15,76 | 4,5 ok |
| `--muted` | 6,18 | 7,13 | 4,5 ok |
| `--dim` | 4,86 | 5,59 | 3 ok |
| Este vídeo `--lado-b` | 6,80 | 4,43 | 3 ok |
| Normal do canal `--lado-n` | 11,88 | 8,32 | 3 ok |
| Subida `--dir-up` | 7,26 | 6,37 | 4,5 ok |
| Zero medido `--im-zero` | 4,97 | 4,84 | 3 ok |
| Não medido `--nm` (texto) | 7,76 | 7,40 | 4,5 ok |
| Hachura `--nm-line` | 4,09 | 4,57 | 3 ok |
| Marcador de mudança `--tr` | 14,48 | 15,76 | 3 ok |
| Azul contra areia (distinção sem a forma) | 1,75 | 1,88 | só reforço; a forma (círculo cheio x quadrado tracejado) distingue |
| Todo texto HTML de 9 estados x 4 cruzamentos | 0 abaixo de 4,5 | 0 abaixo de 4,5 | ok (script próprio, fundo composto) |

| Medida de página | Resultado |
|---|---|
| Rolagem horizontal | 0 px em 56 de 56 |
| Texto abaixo de 12 px (HTML e SVG com escala) | 0 em 56 de 56 |
| Alvos abaixo de 44 px a 390 (toque) | 0 em 28 de 28 |
| Erros de console (fora as fontes do Google bloqueadas) | 0 |
| Resumo, a partir do topo da página, 1440 | y 628 (`vazio`) a 805 (`leitura`); `cheio` 727, `recente` 680 |
| Resumo, 390 | y 853 (`vazio`) a 1.087 (`leitura`); `recente`, `magro`, `zero`, `naomedido` 905; `cheio` 952; `extremo` 975 |
| Alturas de página, 1440 (px) | `cheio` 3.758; `extremo` 3.943; `recente` 3.516; `erro` 1.415 |
| Texto de SVG fora do SVG (cortado ou sobre eixo) | 6 casos, todos "pico das 72 horas" a 390 (R2-B2) |
| Rótulos de SVG que se tocam | 4 casos a 390: "0 x dias" (eixo, sem efeito visível), "2 x 2 em 1 hora" (R2-B2), "722 x 723" e "783 x 725" (R2-C1) |
| Razão das larguras de barra dos pares contra a razão dos valores | nenhum dos 9 pares com dois valores (cheio 3, extremo 3, recente 1, zero 2) bate, nas duas larguras (R2-B1) |

## O que não consegui verificar

Leitor de tela (VoiceOver, NVDA); Safari e Opera (o `color-mix` ausente protege, mas hachuras SVG e o `popover` do ⓘ não foram vistos lá); a regra de movimento reduzido só por leitura (1 regra `prefers-reduced-motion` no CSS, nenhum teste com a preferência ligada); simulação em escala de cinza só por luminância, não por imagem (azul e areia diferem em 1,75:1 e a forma dos pontos já os separa); capturas a 390 escuro abertas só em `cheio` e `semanal` (as demais por medição); as 56 capturas do desenhista em `shots/` não são as que abri (usei as minhas, geradas do mesmo código, porque as dele são de antes de duas edições de `m13.css` e `NOTAS.md`).

## Condição para a rodada 3

Corrigir R2-B1 e R2-B2 (as duas são pequenas) e R2-C1 a R2-C4. Na rodada 3 eu meço de novo: razão de largura de cada par contra a razão dos valores (erro menor que 1 px), texto de SVG fora do SVG (0 em 56) e colisão de rótulos (0 em `semanal` a 390), e reabro `cheio`, `extremo`, `recente`, `zero`, `semanal`, `saiu`, `mantido` e `leitura` nos quatro cruzamentos.
