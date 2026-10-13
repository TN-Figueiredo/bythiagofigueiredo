# Revisão de UX, rodada 2: mockup 17a, Comparar canais com as medidas novas (13/10/2026)

Revisor: `revisor-ux-senior`. Material: PLANO.md, NOTAS.md (seção 5, resposta à r1), index.html, ce.css, ce.js, ce-dados.js, as 26 capturas do autor (abri 1440 escuro de tipico, queda, magro, erro, fora, zero, naomedido, extremo, 2027, proprio, nichos e o fim de leitura; 390 de tipico, erro, vazio, magro, queda, fora, zero), o spec (04, linhas 13, 15, 16, 19, 20, 80, 158, 241, 242) e a REVISAO-UX-r1.md. Medi no navegador (Chromium headless, servidor estático meu nas portas 47763 a 47768, derrubado ao fim, sem tocar na 3099): 13 estados x 4 cruzamentos (1440 e 390, escuro e claro) = 52 páginas. Nada foi alterado fora desta pasta. Gravei 4 capturas de evidência em `shots/` com prefixo `r2-evidencia-`.

## Resumo

**Pergunta do dono:** "cada canal está subindo ou descendo, e o que eu ainda não posso afirmar?" Segue respondida de relance a 1440 (Leitura rápida a 436 px do topo, uma frase por lado com ▲ ▼ ＝ e o fecho "Outras leituras: ✓ concordam"). A r1 achou 8 pontos; **os 8 foram resolvidos** (tabela abaixo) e o estado novo `queda` prova "Em queda" numa data possível (20/12/2026). O ajuste, porém, deixou 3 defeitos que o dono vai ver.

**Veredito do mockup: VOLTA PARA AJUSTE. 3 impedimentos (2 afirmam o que o dado não sustenta, 1 de espaçamento visível em todo estado a 390 px).** Todos de conserto curto. Não é reprovação: a base está boa e o resto está pronto.

| Veredito por estado | 1440 escuro | 390 claro |
|---|---|---|
| tipico | pronto | volta (3) |
| proprio | pronto | volta (3) |
| extremo | pronto | volta (3) |
| zero | volta (2) | volta (2, 3) |
| naomedido | pronto | volta (3) |
| magro | pronto | volta (3) |
| fora | pronto | volta (3) |
| nichos | pronto | volta (3) |
| queda (novo) | pronto | volta (3) |
| 2027 | pronto | volta (3) |
| erro | volta (1) | volta (1, 3) |
| vazio | pronto | volta (3) |
| leitura (só leitura) | pronto | volta (3) |

Medi também 1440 claro e 390 escuro (contraste, rolagem, alvos, foco): os mesmos números, sem defeito novo além dos listados. Olhei com os olhos 1440 claro e 390 escuro só em `extremo` (captura `r2-evidencia-extremo-1440claro-e-390escuro.png`).

**As três coisas que mais derrubam o conjunto agora:**
1. No estado `erro`, a tela ainda afirma número do lado que não carregou (bloqueio 1).
2. No estado `zero`, dois números do mesmo canal se contradizem (bloqueio 2): "parado há 61 dias" e "0 longos em 90 dias".
3. A 390 px o texto "último longo há N dias" invade a pastilha do estado (bloqueio 3), e a segunda frase da Leitura rápida ainda cai abaixo de ~750 px (melhoria 1).

## Conferência da r1 (cada bloqueio, resolvido ou não)

| r1 | Pedido | Resultado na r2 |
|---|---|---|
| 1 | "Em queda" só depois de 14/12/2026 e um estado que prove | Resolvido. `tipico` e `erro` (13/11) mostram Nômade Raiz "Ativo"; o estado `queda` (20/12/2026) mostra "Em queda · 3 janelas de 28 dias seguidas"; a janela (30/08 em diante, depois de 24/08) é coerente com o spec M8; a marca de 24/08 sai de (a) e fica em (b), como pede a nota do M3 (a: até 19/10; b: 180 dias). |
| 2 | Longos publicados só por ±10% | Resolvido. `proprio`: "3 longos contra 4" = ▼ descendo (âmbar); `fora`: "8 contra 9" = ▼ descendo, igual ao −11% da linha de cima. Um símbolo por percentual. Dúvida 9 do NOTAS pergunta ao dono sobre piso de 2. |
| 3 | Faixa de prosa do magro | Resolvido. Uma linha: "Nada fechou ainda: o primeiro vídeo com 30 dias fecha em 02/11." |
| 4 | Jargão | Resolvido na tela: varri o texto visível dos 13 estados por "viés", "escala log", "contagem diária", "snapshot", M1 a M9, null, NaN, undefined: 0 ocorrências. Os termos exatos ficam só dentro dos ⓘ (permitido). |
| 5 | Etiqueta em laranja | Resolvido. "◆ leitura principal" em borda e texto neutros; no `proprio` o laranja fica só em "seu canal", no cartão e na ação. |
| 6 | Três frases por lado | Resolvido. Uma frase de direção + "Outras leituras: ✓ concordam" / "≈ concordam em parte" / "≠ divergem" / "ainda sem leitura de apoio". Estado do canal só na pastilha. |
| 7 | Erro afirma estado | Resolvido na pastilha (vira "não carregou") e na linha da Leitura rápida; **mas sobrou outro ponto no mesmo estado: bloqueio 1.** |
| 8 | Resposta fora da primeira tela a 390 | Melhorou: Leitura rápida de 747 para 666 px (cartões compactos). Passa a meta que eu mesmo dei (~730 px) no título; a segunda frase ainda cai fora (melhoria 1). |

## Bloqueios (impedem ir ao dono)

### 1. [corrige] No estado `erro`, o lado que não carregou continua dando inscritos e tamanho
- Tela e estado: `erro`, 1440 e 390.
- O que está errado: o cartão de Nômade Raiz mostra "Viagem 2,1 mi inscritos 50 longos acompanhados" e a Leitura rápida diz "Só de contexto: Nômade Raiz tem 6,1× os inscritos de Paddy Doyle", enquanto a linha "Inscritos" da tabela, logo abaixo, diz "não carregou" para o mesmo lado. O mesmo número aparece como lido e como não lido na mesma tela. É o princípio da r1 (item 7): nenhuma frase afirma mais do que o dado sustenta.
- Evidência: `shots/r2-evidencia-erro-390-claro.png` (cartão B com "2,1 mi inscritos", alerta e 3ª linha da Leitura rápida com "6,1×"); `shots/index-estado-erro-barra-0-1440-escuro.png` (a linha "Inscritos" mostra a pastilha "não carregou" para B).
- Conserto: no `erro`, cartão B só com nome e a pastilha "não carregou" (sem "2,1 mi inscritos" e sem "50 longos acompanhados") e a 3ª linha da Leitura rápida some (ou vira "Tamanho: não carregou" com o símbolo de erro). Se o dono entender que inscritos vêm de outra fonte e carregam, então a linha "Inscritos" da tabela tem de mostrar 2,1 mi; hoje as duas versões convivem.

### 2. [corrige] No estado `zero`, "parado há 61 dias" contradiz "0 longos nos últimos 90 dias"
- Tela e estado: `zero`, Dale Philip, 1440 e 390.
- O que está errado: o cartão diz "Parado · há 61 dias sem longo novo", mas Longos publicados diz "0 longos contra 8" (últimos 90 dias) e as medianas dizem "0 longos em 90 dias; precisa de 3". Se o último longo saiu há 61 dias, ele está dentro dos 90 dias: o canal teria pelo menos 1 longo, não 0. O estado `zero` existe justamente para provar o zero medido; o dono lê dois números do mesmo canal que não fecham.
- Evidência: `shots/r2-evidencia-zero-390-claro-parado-61-dias.png` (cartão A "Parado · há 61 dias sem longo novo"); o "0 longos contra 8" está na linha "Longos publicados" do 1440 escuro abaixo; `shots/index-estado-zero-barra-0-1440-escuro.png`. Conferi o resto: `extremo` (Leo "há 74 dias" com "2 longos nos últimos 90 dias") fecha; `naomedido` e `magro` também.
- Conserto: em `ce-dados.js`, Dale Philip no estado `zero` passa a "há 95 dias sem longo novo" (qualquer valor acima de 90; continua "Parado" pela regra do M8, que pede mais de 28 dias).

### 3. [corrige] A 390 px o texto de apoio do cartão invade a pastilha do estado
- Tela e estado: todos os 13 estados, 390 px, cartão de cada lado (Ativo, Parado, Em queda, Fora do ar).
- O que está errado: "último longo há 6 dias" (e "há 61 dias sem longo novo", "3 janelas de 28 dias seguidas", "desde 02/11; último registro em 01/11") fica colado na borda de baixo da pastilha. Medi: pastilha termina em y = 439,3 px e a linha de apoio começa em y = 435,3 px, sobreposição de 4 px (altura da linha 18 px). A leitura é de texto "encostado" na pastilha, na primeira tela, nos dois cartões.
- Evidência: `shots/r2-evidencia-tipico-390-claro-primeira-tela.png` (cartões A e B); mesma medida em todos os cartões.
- Conserto: a 640 px ou menos, `.ce-est-s` com `margin-top: 6px` (e `.ce-est` com `row-gap: 6px`); gasta 10 px por cartão, que a melhoria 1 recupera.

## Melhorias (não bloqueiam)

1. **A 390 px a segunda frase da Leitura rápida ainda fica fora de ~750 px.** Medi `tipico`: título da Leitura rápida a 666 px; a frase de A termina a 757 px e a de B a ~826 px. Hoje o dono vê uma frase e meia no primeiro olhar. Conserto: a 640 px ou menos, tirar do cartão a linha "queda sustentada: medida a partir de 14/12" (já está no ⓘ da pastilha; repetida em dois cartões, ~26 px cada) e a linha de inscritos do cartão (está na tabela): ganha ~70 px e as duas frases cabem. Não impede, porque a meta da r1 (título dentro de ~730 px) passa.
2. **Tema claro: lado A e "descendo" são quase a mesma cor.** `--lado-n` (#5C4710) e `--dir-dn` (#8A5A00) ficam a cerca de 1,4:1 um do outro; na mesma linha da Leitura rápida o chip "A" e o quadrado ▼ parecem irmãos (captura `r2-evidencia-extremo-1440claro-e-390escuro.png`). No escuro são distintos (creme e âmbar). A forma (letra x ▼) salva a leitura e vem do lote 1 aprovado; fica para decisão do dono, sem mexer nesta tela.
3. **Faixa "Nada fechou ainda" (magro):** a 390 o ícone de hachura fica numa linha sozinha acima do texto; a 1440 a faixa mede ~840 px e a tabela ~870 px. Igualar a largura e manter o ícone na linha do texto.
4. **Leitura rápida longa no `2027` (Lodir):** "≠ divergem (o canal inteiro: estável; vídeos novos (views de hoje): subindo)" quebra deixando "subindo)" órfão. Encurtar para "(canal inteiro: estável; vídeos novos de hoje: subindo)".
5. **Alvo de toque do ⓘ a 1440 px:** 28 x 28 px (ponteiro fino), padrão aprovado do lote 1; a 390 todos medem 44 x 44. Fica.
6. **Faixa "Estados do mockup" a 390:** 16 botões de 32 px de altura aparecem na medição de alvos; são a barra do mockup, fora da tela simulada, e não contam. Todos os controles da tela medem 44 x 44 a 390.

## O que está certo e não deve mudar

- A forma memorável (uma direção de verdade em quadrado cheio, duas de apoio em contorno, "ainda não existe" em pontilhado) se lê à primeira vista e em escala de cinza.
- Zero medido (caixa vazada com 0: "0 longos contra 8", "0 de 12") distinto de não medido (hachura rosa com motivo) e de "ainda não existe" (pontilhado): provados lado a lado em `zero`.
- Método só nos ⓘ (9 popovers distintos, todos com "cálculo do Observatório sobre dados públicos do YouTube"); sem parágrafo de prosa na tela.
- M8: Ativo, Parado, Em queda, Fora do ar e "não carregou" com forma e texto próprios; "Em queda" só em 20/12/2026; a linha "queda sustentada: medida a partir de 14/12" presente em todo canal ativo ou parado antes dessa data.
- Régua que sai da escala com ◀ ▶ (extremo), duas réguas por nicho (nichos), "Leituras diferentes" em vez de "×" no M7, só leitura com cadeado e saída dita, vazio com esqueleto na largura da tabela.
- Cor de direção estável: ▲ verde, ▼ âmbar, ＝ neutro; nenhum vermelho para direção; vermelho só em erro e fora do ar.

## Medidas

| Medida | Valor | Meta | Resultado |
|---|---|---|---|
| Rolagem horizontal, 13 estados x 4 cruzamentos (52 páginas) | 0 px em todas | 0 | passa |
| Texto menor que 12 px | 0 | 0 | passa |
| Alvos menores que 44 px a 390 (ponteiro grosso, só a tela, sem a barra do mockup) | 0 | 0 | passa |
| Menor contraste de texto, escuro (1440 e 390), 13 estados | 4,86:1 (símbolo "■" de contexto, 12 px) | 4,5:1 | passa |
| Menor contraste de texto, claro (1440 e 390), 13 estados | 4,73:1 (chip "B" e "Competidores" da barra) | 4,5:1 | passa |
| Texto "não medido" sobre fundo hachurado (cor do texto contra `--nm-bg`; a hachura é rgba de 14% do mesmo rosa) | escuro: #E59CC0 sobre #3A2232, 8,37:1; claro: #8E2A62 sobre #F7E1EC, bem acima de 4,5 | 4,5:1 | passa |
| Texto abaixo do limite (4,5 normal, 3 grande), todos os nós de texto, 52 páginas | 0 | 0 | passa |
| Foco por Tab (tipico, erro, leitura, vazio, 1440 escuro): paradas sem contorno visível | 0 de 42, 42, 42, 36 | 0 | passa |
| ⓘ por teclado: Enter abre, Esc fecha, foco volta ao botão (testado no "Como ler a régua do nicho") | funciona (popover nativo, `role="note"` com `aria-label`) | funciona | passa |
| Controles sem nome acessível; `role="img"` sem rótulo; `svg` sem `aria-hidden` | 0, 0, 0 em 52 páginas | 0 | passa |
| Hierarquia de títulos | h1 "Comparar canais", h2 por canal, h2 "Leitura rápida", h2 "Número a número" | sem salto | passa (sem leitor de tela para confirmar) |
| `color-mix()` fora de comentário (css e js da pasta) | 0 (4 ocorrências, todas em comentário "sem color-mix") | 0 | passa |
| Posição do título da Leitura rápida, 1440 / 390 (tipico) | 436 px / 666 px (r1: 400 / 747) | 390 dentro de ~730 px | passa |
| Frase de B da Leitura rápida a 390 (tipico) | termina em ~826 px | sem meta | melhoria 1 |
| Sobreposição apoio x pastilha a 390 | 4 px (pastilha termina em 439,3; apoio começa em 435,3) | 0 | falha (bloqueio 3) |
| Altura da página, tipico, 1440 / 390 | 2629 / 4942 px (r1: 2625 / 5063) | sem meta | informativo |

## Verificações cruzadas com o pedido do spec

- 6.2 e 6.5b (mockup 17, parte Comparar): M3 em três leituras (a principal; b e c de apoio; c principal em 2027, com (a) descendo ao apoio), M4 (casas, "3 de 12", percentual só com 10 ou mais), M7 na idade de 30 dias (chips "aos 30 dias", "total de hoje", "só curtidas"), M8 no cartão de cada lado (4 estados + erro), M1 com N = 1 ("Primeiras 24 horas"). Todos desenhados. Faltavam só "Em queda" em data possível (agora existe) e as correções acima.
- Item 242 (comparar por direção): sim, frase do topo e primeira linha respondem "subindo ou descendo".
- Item 241 (cor de direção): ▲ verde, ▼ âmbar, ＝ neutro, um símbolo por percentual (resolvido o conflito de "3 contra 4").
- 07-forja 8.1.5 (o exemplo do dono "praticamente iguais"): "13 longos contra 12" sai "praticamente iguais" com ⓘ que diz que a contagem não mede frequência. Passa.
- Aritmética conferida em amostra, sem erro: 1,6 mi ÷ 66,8 mil = 24×; 5,2 ÷ 2,1 mil = 2,5×; 13 ÷ 8 = +63%; 410 ÷ 380 = +8%; 842 ÷ 18.420 = 4,6%; 15,4 mil ÷ 1,53 mil = 10×; Lodir "fecha em 15/10" com 54 dias e Carol "fecha em 07/12" com 32 dias.

## O que não consegui verificar

- Leitor de tela (VoiceOver, NVDA): árvore de títulos e ordem de leitura só pelo HTML.
- Safari, Opera e Firefox (o navegador do dono renderiza `color-mix()` transparente; aqui não há uso, mas outros recursos de CSS não foram conferidos lá). Só Chromium headless.
- Ordem de teclado completa em todos os 13 estados; testei Tab em 4 estados e Enter e Esc em um ⓘ.
- Contraste do texto sobre a hachura medido pelo token (cor contra o fundo sólido do ancestral), não por amostra de pixel; a hachura é a mesma cor a 14%, por isso o ganho ou perda é pequeno.
- Movimento reduzido: a tela não tem animação que eu tenha visto; não testei a mídia.
- Capturas do autor em 1440 claro e 390 escuro: não existem em `shots/` (o autor grava 1440 escuro e 390 claro, como pede a convenção); medi esses cruzamentos e olhei os dois só em `extremo`.

## Pedido de reconferência

Quem desenhou corrige os bloqueios 1 a 3 (todos de uma ou duas linhas em `ce-dados.js` e `ce.css`) e regenera as capturas de `erro`, `zero` e as de 390 de todos os estados. Eu reconfiro só esses três pontos e se o conserto criou defeito novo; se os três passarem, o veredito é PODE_IR_AO_DONO. Discordância de um achado vem por escrito com medida ou captura.
