# Revisão de UX, rodada 1: mockup 11b (Retenção do vídeo próprio: janela e faixa do YouTube)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Pasta: `docs/superpowers/mockups/2026-10-13-a5-lote-2/11b-retencao-janela-e-faixa/`.
Método: abri a tela num Chromium headless (Playwright, `file`/servidor estático nas portas 47751 a 47757, derrubado ao fim), 1440 e 390 (e 360) px, os dois temas, os 13 estados e as 3 janelas. Olhei as capturas, medi com `getBoundingClientRect` e `getComputedStyle` (contraste por cálculo sobre o fundo composto), testei teclado, toque, popover e `ariaSnapshot`. Não toquei em nada fora desta pasta de mockup; as 4 capturas desta revisão estão em `shots/revisao-r1-*.png`.

## Veredito: VOLTA PARA AJUSTE (não vai ao dono nesta rodada)

2 bloqueios e 6 "corrige" abertos. Nenhum mockup vai ao dono com "bloqueia" ou "corrige" aberto (CONVENCOES, seção 7, item 3). O desenho em si é bom: a régua do YouTube é a forma certa, o par ▲ ▼ ＝ com a palavra negrita lê em escala de cinza, o contraste de texto é folgado e o resto está limpo. O que derruba são defeitos de acabamento a 390 px, uma frase-resumo fora do lugar e dados de exemplo que contradizem a regra da própria tela.

Contagem por estado e largura (13 estados, 1440 escuro e 390 claro; os outros dois cruzamentos conferidos por medida):

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| típico | volta | volta | B1 (leituras sem rótulo), C1 (frase), C2 (cartões desalinhados), C6 (zonas fracas) |
| aberta | ok | ok | só C2 a 390 |
| short | ok | ok | C6 |
| antigo | ok | ok | C2 |
| serrilhada | volta | volta | C4 (30 dias lido antes de fechar), sugestão sobre o veredito "Abaixo" com 41 views |
| vazia | volta | volta | C4 |
| sem-faixa | ok | ok | |
| zero | ok | **volta** | B2 (rótulo "0,02" para fora do cartão a 390) |
| não coletada | ok | ok | C2 |
| novo | ok | ok | C2 |
| erro | ok | ok | C5 (texto "lida" nos outros estados; este só pelo banner) |
| erro sem leitura | ok | ok | C5; texto duplicado (sugestão) |
| só leitura | ok | ok | C3 (rosa para "privado") |

## A pergunta de quem abre

"Esse vídeo segura as pessoas bem ou mal, onde elas saem, e isso vale para a estreia ou para a vida toda?" A 1440 a resposta está no primeiro olhar depois de rolar até a seção: três cartões com a curva e "metade saiu aos m:ss", a frase, e a faixa "▲ Acima de vídeos de duração parecida" com a marca cravada na régua (contraste 14,5:1 contra o cartão). A 390 também cabe numa tela depois de chegar à seção (faixa a 456 px do topo da seção), mas depende de rolar o cabeçalho do vídeo, que já ocupa 887 px antes da seção; isso vem do mockup 6 aprovado e não é culpa do 11b.

## Bloqueios (não vão ao dono)

### B1. 390 px, "Ver as N leituras": três números por linha sem nenhum rótulo
- Tela e estado: `?caso=tipico` (e todo caso com leituras), 390 px, `<details>` "Ver as 3 leituras" aberto. Captura: `shots/revisao-r1-leituras-sem-rotulo-390-claro.png`.
- Problema: a tabela vira cartão, mas as colunas "Metade saiu aos", "No fim" e "Comparação do YouTube" somem. A linha lê "12/10 mais recente · 7:14 · 31% · ▲ 0,62" e ninguém sabe qual número é qual. A tabela "Como a curva mudou" logo acima rotula bem ("antes:", "agora:"); esta ficou para trás.
- Correção: no CSS de `max-width:640px` para `.rj-mt2`, mostrar o `<th>` da coluna antes de cada valor (padrão `td::before{content:attr(data-r)}` com `data-r="Metade saiu aos"`, `"No fim"`, `"Comparação do YouTube"` gerado em `11b.js` linha ~140), como já se faz em `.rj-mt`.

### B2. 390 px, faixa com valor perto de 0: o rótulo "0,02" sai do cartão e atravessa duas bordas
- Tela e estado: `?caso=zero` (vale para todo valor abaixo de 0,12), 390 e 360 px. Captura: `shots/revisao-r1-zero-faixa-rotulo-fora-390-claro.png`.
- Medida: rótulo de x=10 a 59; cartão tracejado de x=33 a 357 e cartão da seção a partir de ~16. O rótulo cobre a borda tracejada verde-água e a borda da seção, 23 px para fora do cartão. A NOTAS (decisão 3) diz que a etiqueta é "puxada para dentro para não sair do cartão"; a 390 isso é falso. A 1440 não ocorre (rótulo de 632 a 681, dentro do cartão em 257 a 1157).
- Correção: em `.rj-mk.ini b` e `.rj-mk.fim b` o deslocamento fixo (`translateX(-18px)` e `calc(-100% + 18px)`) tem de ser `translateX(0)` com o `left` do rótulo limitado ao início da régua (`left:0` relativo a `.rj-bw`, não ao marcador), e a haste continua no valor. Conferir `short` (0,97) no mesmo ponto: hoje cabe (279 a 328 contra 343).

## Corrige (vai ao dono só depois de corrigido)

### C1. A frase-resumo não está no topo do bloco e diverge do lote 1 aprovado
- Em 11b a ordem é: cabeçalho, seletor de três cartões, depois a frase ("Na vida inteira do vídeo, metade das pessoas já saiu aos 7:14 (42% do vídeo)."). No lote 1 (mockup B, `shots/b-canal-cheio-28-1440-escuro.png`) a frase vem primeiro e o seletor logo abaixo. A regra 1 do dono é "frase-resumo no topo". O 11b também não declara essa divergência em NOTAS.
- Correção: subir a frase (e o chip "Leitura de dd/mm") para antes do seletor, como no lote 1, ou declarar a divergência e justificá-la. Recomendo subir: a frase muda com o seletor e o dono lê a resposta antes de escolher.

### C2. 390 px: o cartão "Vida inteira" quebra em duas linhas e desalinha as três colunas
- Medida em todos os 13 estados a 390 e 360: nos cartões "7 dias" e "30 dias" a linha "Metade saiu aos" começa a 66 px do topo do cartão; em "Vida inteira" a 83 px (17 px a mais). Captura: `shots/revisao-r1-cartoes-desalinhados-390-claro.png` (a miniatura e as linhas de baixo ficam fora de prumo). Nos estados sem curva a pastilha "não medido" também quebra em duas linhas dentro do cartão.
- Correção: abaixo de 640 px usar o rótulo curto "Vida toda" (cabe em uma linha com o ●) ou reservar `min-height:44px` para a linha do título nos três cartões; manter `white-space:nowrap` na pastilha com `font-size:12px` e padding horizontal de 6 px.

### C3. Só leitura: "curva privada" usa a borda rosa de "não medido"
- `?caso=leitura`: as três caixas com cadeado têm borda `--nm-line` (rosa) (medida: borda 4,09:1 no escuro, mesma da hachura). Cor com um significado só (regra 3): rosa é "o dado não chegou"; aqui o dado existe e o usuário não pode ver. Os dois ficam parecidos para quem alterna os estados.
- Correção: borda `--dim` e fundo `--sunk` (já usados em `.rj-lock`), sem nenhum rosa no estado de só leitura.

### C4. Dados de exemplo contradizem a regra que a tela anuncia
- `serrilhada` e `vazia`: vídeo publicado em 17/09; a janela de 30 dias fecha em 17/10, mas os dados trazem a leitura de 30 dias em 12/10 (`serrilhada`) e uma tentativa "sem curva" de 30 dias em 12/10 (`vazia`). A própria tela diz "a curva dessa janela é lida uma vez, quando ela fecha" e o estado `aberta` mostra "fecha em dd/mm". O implementador copiaria o erro.
- Correção: em `11b-dados.js` trocar `pub` de `poucas` para um vídeo de 2026-08-25 (7 e 30 dias já fechados), ou trocar o 30 dias desses casos para "aberta, fecha em 17/10".
- Sugestão relacionada: as linhas do tempo dos casos não fecham entre si (o `aberta` e o `short` têm 7 dias lidos em 05/10 e 07/10, enquanto `nao-coletada` diz que a janela de 7 dias fechada em 07/10 foi "antes da coleta"). Escolher uma data de início da coleta e usar a mesma em todos.

### C5. Palavra "lida" na tela, contra a regra 8 (e contra o que a própria NOTAS diz ter evitado)
- Textos visíveis (fora do ⓘ): "A curva dessa janela é **lida** uma vez, quando ela fecha." (`aberta`), "Esta janela é **lida** uma vez só." (`vazia` 7 e 30 dias), "Esta janela é **lida** uma vez só, quando fecha: ela não muda depois." (`tipico` com 7 ou 30 dias), título "A curva ainda não foi **lida**" (`erro-sem`). A NOTAS (dúvida 4) diz que "lido" foi trocado por "Leitura de" justamente por essa regra.
- Correção: "é buscada uma vez, quando ela fecha", "é buscada uma vez só", "A curva ainda não foi buscada" (ou "coletada", que já aparece em "Ainda não coletamos esta curva"). Manter "Leitura de dd/mm" como está.

### C6. A régua: as zonas quase não se distinguem do cartão (3:1 de elemento gráfico não atendido)
- Medida do preenchimento contra o cartão: escuro, abaixo 1,30:1, média 1,31:1, acima 1,95:1; claro, abaixo 1,15:1, média 1,14:1, acima 1,49:1. A borda externa da régua (`--dim`, 4,86:1 a 5,59:1) e a marca (14,5:1) seguram a leitura, e o símbolo com a palavra em negrito também (conferido em cinza, `shots/revisao-r1-faixa-cinza-390.png`), mas a zona onde o vídeo está, que é a informação, aparece com 1,5:1 no tema claro a 390 px: no `shots/index-caso-tipico-390-claro.png` vira um verde desbotado.
- Correção: subir só o estado `.on` das três zonas para pelo menos 3:1 contra o cartão (claro: `rgba(17,105,47,.55)`, `rgba(138,90,0,.55)`, `rgba(94,82,64,.45)`; escuro: `rgba(34,197,94,.55)`, `rgba(245,158,11,.5)`, `rgba(168,157,136,.45)`), deixando as outras duas como estão (contexto, recuado).

## Melhorias (não bloqueiam)

1. **Veredito forte com 41 views** (`serrilhada`): a faixa diz "Abaixo de vídeos de duração parecida" em negrito, com o aviso "leia como indício" duas linhas acima, só sobre a curva. Repetir o aviso na faixa quando `poucas` (uma linha, em `.rj-fs`) ou esmaecer a zona ativa.
2. **▲ âmbar de "maior saída" convive com ▼ âmbar de "abaixo" e ▲ verde de "acima"** na mesma tela. O triângulo âmbar da curva é do mockup 6 aprovado e não se mexe, mas a legenda "maior saída" já está em linha curta; manter assim e não usar a cor âmbar em mais nada novo.
3. **Larguras irregulares a 1440**: seletor 820 px, faixa e "como a curva mudou" 900 px, bloco "+ novo" externo 1140 px, banner e painel sem curva 820 px. A borda direita fica em escada. Unificar em 900 px.
4. **Faixa a 1440**: o ⓘ fica a ~75 px do título ("Na média de vídeos de duração parecida"), porque a coluna esquerda é mais larga que o texto. Colar o ⓘ ao fim do título (`.rj-fv{justify-content:flex-start}`).
5. **`aria-live="polite"` em `#rjDet`** anuncia ~1.050 caracteres a cada troca de janela. Anunciar só a frase-resumo (um `<span class="sr" aria-live>` com o texto novo).
6. **Nome acessível do cartão selecionado** lê "●Vida inteira" (o círculo vem do `::before`). Usar `content:"●" / ""` ou desenhar o círculo em `<i aria-hidden>`.
7. **"Salvo neste navegador ·" fica sozinho numa linha** a 390 px, com o link na seguinte. Trocar o ponto por quebra: link numa segunda linha sem o "·".
8. **`erro-sem`**: o aviso vermelho e o painel rosa dizem a mesma coisa ("A primeira tentativa falhou" duas vezes) e o banner diz "A última tentativa" quando é a primeira. Deixar só o banner e o painel com "Ainda não há leitura para mostrar".
9. **Frase "Na vida inteira do vídeo..." sem verdicto**: o veredito está na faixa, que vem abaixo. Se o dono responder que prefere o veredito primeiro, a faixa pode subir para antes da frase a 1440 (a 390 já empilha).

## Tabela de medidas

Contraste (WCAG, cor composta sobre o fundo composto, lido do estilo computado; escuro / claro):

| Elemento | Escuro | Claro | Mínimo |
|---|---|---|---|
| Frase-resumo `.rj-fra` (16 px) | 14,48 | 15,76 | 4,5 ok |
| Texto de apoio `.rj-s`, `.rj-fs`, `.rj-lab`, `.exband`, legenda (12 a 13 px) | 6,18 | 7,13 | 4,5 ok |
| Palavra da zona `▲ acima` (negrito) | 14,48 | 15,76 | ok |
| Símbolo ▲ da faixa `.rj-sim` | 7,26 | 6,37 | 3 (gráfico) ok |
| Chip `▲ +2:35 mais tarde` | 7,26 | 6,37 | 4,5 ok |
| Pastilha "não medido" | 7,76 | 7,40 | 4,5 ok |
| Texto do banner de erro | 12,77 | 13,85 | 4,5 ok |
| Texto de só leitura `.rj-lkt` | 6,92 | 6,43 | 4,5 ok |
| Eixos da curva (12 px) | 6,18 | 7,13 | 4,5 ok |
| Borda do cartão `.rj-c` | 4,86 | 5,59 | 3 ok |
| Borda do cartão ativo | 14,48 | 15,76 | 3 ok |
| Hachura, borda tracejada `.rj-nmbox` | 4,09 | 4,57 | 3 ok |
| Caixa "0" (zero medido), borda 2 px | 4,97 | 4,84 | 3 ok |
| Marca do vídeo na régua | 14,48 | 15,76 | 3 ok |
| **Preenchimento da zona ativa na régua** | **1,95** | **1,49** | **3 (falha: C6)** |
| Preenchimento das zonas inativas | 1,30 / 1,31 | 1,15 / 1,14 | contexto |

Alvos e geometria a 390 e 360 px (13 estados, ponteiro grosso): rolagem horizontal 0 (`scrollWidth` 390 e 360); nenhum alvo abaixo de 44 x 44 px (cartões do seletor 165 a 182 px de altura, ⓘ 44 px, `summary` e "Voltar ao padrão" medidos); nenhum texto abaixo de 12 px. Cartões do seletor a 390: altura 164 a 181 px, linha "Metade saiu aos" a 66 / 66 / **83** px do topo (C2). Popover do ⓘ da faixa a 390: 366 x 328 px, dentro da tela (esquerda 12 px), sem rolagem interna. Seção "Retenção" a 390: 1.215 a 1.740 px de altura conforme o estado; faixa a 456 px do topo da seção. A 1440: faixa 900 px de largura.

Teclado, foco e aria (medidos): grupo de opções (`role="radiogroup"`, `aria-labelledby`) com um só item no Tab (`tabindex` 0 / -1 / -1); setas esquerda e direita trocam a janela e levam o foco; Tab sai do grupo para "Voltar ao padrão", o ⓘ da faixa e "Ver a curva em números", nessa ordem; foco visível 2 px sólido `--accent` (#FF8240) em todos; Esc fecha o popover e devolve o foco ao ⓘ; `ariaSnapshot` dos cartões lê "Primeiros 7 dias não medido fechou antes da coleta" etc. Região da curva e da faixa com `role="img"` e `aria-label` por extenso. Console sem erro (a única falha é a fonte do Google bloqueada de propósito). `color-mix`: 0 no CSS e no JS (só comentários "sem color-mix").

## Regras do dono, uma a uma

| Regra | Estado |
|---|---|
| Frase-resumo no topo | **falha parcial (C1)**: existe e é uma frase só num `<span>`, mas fica abaixo do seletor |
| Régua ou barra para comparar de relance | ok: régua de 0 a 1 com marca; miniatura da curva nos cartões; barra "dia N de M" |
| Cor estável por significado, inclusive "não medido" | ok com uma exceção: **C3** (rosa em "privado"); verde ▲ / âmbar ▼ / neutro ＝ declarados na dúvida 1 e coerentes com o lote 1 |
| Símbolo junto da cor | ok: ▲ ▼ ＝, relógio, aviso, cadeado, ● no ativo; lido em escala de cinza |
| Método no ⓘ, não em prosa | ok: seis ⓘ (janela, faixa, mudou, retenção, curva); as frases "lida uma vez" na tela são status, não método (mas ver C5 pela palavra) |
| Zero medido distinto de não medido | ok: caixa vazada "0" (borda 2 px `--im-zero`) contra hachura rosa; nunca curva reta em zero |
| Sem bloco monocromático nem prosa | ok: nenhum parágrafo acima de 2 linhas na tela; os painéis sem curva têm 2 linhas |
| Sem jargão | **falha (C5)**: "lida". "relativeRetentionPerformance" só no ⓘ, aceitável |
| Nenhum `color-mix()` | ok |
| 1440 escuro e 390 claro, alvo 44, foco, aria | ok exceto B1, B2 e C2 |
| Estados desenhados | ok: os 13 de PLANO e NOTAS, com 72 capturas; só falta captura de "Ver as N leituras" aberto (gerada nesta revisão) |
| Consistência com o lote 1 | ok nos tokens, tipografia, "+ novo", padrão de lembrar a escolha e "Voltar ao padrão"; diverge na ordem frase/seletor (C1) e em inventar o cartão com miniatura em vez do cartão numérico do lote 1 (declarado no PLANO e justificado) |

## As três coisas que mais derrubam o conjunto

1. A 390 px o acabamento quebra em três lugares (rótulo para fora do cartão, cartões desalinhados, leituras sem rótulo): o par obrigatório do dono é justamente 390 claro.
2. A frase-resumo foi para baixo do seletor e a ordem diverge do lote 1 aprovado.
3. O exemplo contradiz a regra da tela (30 dias lido antes de fechar) e o texto ainda diz "lida", palavra que a própria NOTAS afirma ter evitado.

## O que NÃO consegui verificar

Leitor de tela real (só o `ariaSnapshot` do Chromium), Safari, Opera e Firefox (o navegador do dono renderiza `color-mix` transparente; confirmei que não há nenhum, mas não abri no Opera), ordem completa do teclado fora da seção Retenção, toque real num aparelho (usei emulação de ponteiro grosso), simulação de escala de cinza só nos 4 estados da faixa (os demais por inspeção do símbolo), e a regra de coleta contra o código real (não revisei implementação). Os cortes 0,45 e 0,55 e a pergunta "a comparação muda com a janela?" são decisões do dono (NOTAS, dúvidas 1 a 3) e não as julguei.

## Reconferência

Depois da correção de B1, B2, C1 a C6, regerar com `capturar.mjs` os estados `tipico`, `zero`, `short`, `serrilhada`, `vazia`, `leitura`, `aberta` e `erro-sem`, e me devolver para a rodada 2: a reconferência mede de novo o alinhamento dos cartões (66 / 66 / 66), a posição do rótulo da faixa (dentro de 33 a 357 a 390 px) e o contraste da zona ativa (3:1).
