# Revisão de UX, rodada 1: mockup 17a, Comparar canais com as medidas novas (13/10/2026)

Revisor: `revisor-ux-senior`. Material: PLANO.md, NOTAS.md, index.html, ce.css, ce.js, ce-dados.js, as 24 capturas em `shots/` (abri as de 1440 escuro e de 390 claro dos 12 estados), mais medições minhas no navegador (Chromium headless sobre servidor estático nas portas 47731 a 47734, derrubadas ao fim): contraste de todo texto da tela nos 12 estados x 4 cruzamentos (1440 e 390, escuro e claro), alvos de toque, foco por Tab, abrir e fechar ⓘ por teclado, aria, posição dos blocos a 390. Nada foi alterado fora desta revisão; nenhuma captura nova foi gravada em `shots/` (as minhas ficaram no scratchpad da sessão).

## Resumo

**Pergunta do dono nesta tela:** "cada canal está subindo ou descendo, e o que eu ainda não posso afirmar?" Em 1440 a resposta está no primeiro olhar: a Leitura rápida fica a 400 px do topo, abaixo dos dois cartões, e a primeira linha da tabela repete ▲ ou ▼ em quadrado cheio com a régua do nicho. A "forma memorável" do plano (uma direção de verdade, duas de apoio em contorno) funciona e se lê em escala de cinza (testei: ▲ ▼ ＝ distinguem pelo desenho, não pelo tom). O desenho é forte e coerente com o lote 1. Mas há oito problemas que o dono vai ver ou sentir, dois deles afirmam o que o dado não sustenta.

**Veredito do mockup: VOLTA PARA AJUSTE.** Não vai ao dono. Dois itens "bloqueia" e seis "corrige" (pela convenção do lote 2, os dois tipos impedem ir ao dono; por isso o total de impedimentos é 8).

| Veredito por estado | 1440 escuro | 390 claro |
|---|---|---|
| tipico (dois concorrentes) | volta para ajuste (1, 6) | volta para ajuste (1, 6, 8) |
| proprio (seu canal x concorrente) | volta para ajuste (2, 5, 6) | volta para ajuste (2, 5, 6, 8) |
| extremo | pronto, com os itens gerais 5 e 6 | idem |
| zero | pronto, com os itens gerais 5 e 6 | idem |
| naomedido | pronto, com os itens gerais 4, 5 e 6 | idem |
| magro | volta para ajuste (3, 4) | volta para ajuste (3, 4, 8) |
| fora | volta para ajuste (2) | idem |
| nichos | pronto, com os itens gerais 5 e 6 | idem |
| 2027 | volta para ajuste (4: "contagem diária" na linha de (c)) | idem |
| erro | volta para ajuste (7) | volta para ajuste (1, 7) |
| vazio | pronto | pronto |
| leitura (só leitura) | pronto, com o item 5 | idem |

Nenhum estado foi reprovado: a base é boa.

**As três coisas que mais derrubam a qualidade do conjunto:**
1. Exemplos que contradizem a regra do próprio mockup ("Em queda" em 13/11, "estável" para 3 contra 4): a tela afirma mais do que o dado sustenta (itens 1 e 2).
2. Texto corrido onde o dono pediu frase curta e ⓘ: a faixa do estado magro, a Leitura rápida com três frases por lado e jargão que a convenção proíbe (itens 3, 4 e 6).
3. A cor laranja (a de "seu canal") usada para uma etiqueta que não é "seu canal" (item 5), e a resposta fora da primeira tela a 390 px (item 8).

**O que está certo e não deve mudar:** frase-resumo no topo com símbolo; "zero medido" (caixa vazada com 0) distinto de "não medido" (hachura rosa com o motivo) e de "ainda não existe" (pontilhado), provados lado a lado no estado `zero`; método só nos ⓘ (todos com a frase fixa "cálculo do Observatório sobre dados públicos do YouTube", base, janela e conta); régua que sai da escala com ◀ ▶ (extremo); casas do acerto (M4) sem coluna de "quem ganha"; "Leituras diferentes" em vez de "×" no M7; erro com forma própria; só leitura com cadeado e saída dita; nenhuma ocorrência de `color-mix()` fora de comentário.

## Bloqueios (impedem ir ao dono)

### 1. [bloqueia] "Em queda" em 13/11/2026 contradiz o ⓘ, a spec e outro estado da mesma data
- Telas: `tipico`, `erro` (Nômade Raiz, pastilha "Em queda · 3 janelas de 28 dias seguidas" e a frase "Em queda sustentada (3 janelas de 28 dias seguidas)" na Leitura rápida).
- Evidência: o ⓘ "Estado do canal" desta própria tela diz "A primeira leitura limpa é de 14/12/2026" (ce.js, `infoEstado`); a spec M8 (linha 20) diz o mesmo; e no estado `naomedido`, que tem a mesma data (13/11), o cartão de Carol Rotas diz "queda sustentada: ainda sem como medir (a partir de 14/12)". Três janelas de 28 dias contadas a partir de 13/11 cruzam 24/08/2026. O dono vê a mesma data afirmar e negar.
- Conserto: tirar "Em queda" de qualquer estado com data antes de 14/12/2026 (Nômade Raiz passa a Ativo ou Parado em `tipico` e `erro`) e mostrar "Em queda" num estado novo datado em 14/12/2026 ou depois (por exemplo 20/12/2026, botão novo na barra "Estados do mockup"), com a janela de 112 dias coerente. Sem estado "Em queda" o desenho de M8 pedido na tabela 6.5b não foi provado.

### 2. [bloqueia] "Longos publicados" usa uma regra escondida e mostra "＝ estável" para queda de 25% e de 11%
- Telas: `proprio` (tnFigueiredo: "3 longos contra 4" com ＝ "estável"; 3 contra 4 é −25%) e `fora` (Vagabundo Digital: "8 longos contra 9" com ＝ "estável"; é −11%).
- Evidência: `dirPub` em ce.js exige diferença de pelo menos 2 longos (`Math.abs(d) >= 2`), além de 10%. Essa regra não está na spec (M3 é ±10%), não está em nenhum ⓘ, e o ⓘ "Longos publicados não é frequência" diz o contrário: "Igual: menos de 10% de diferença entre as duas contagens". Na mesma tela, a linha de apoio "Vídeos novos, views de hoje" de Vagabundo mostra "descendo −11%" com ▼ âmbar, e logo abaixo "8 contra 9" mostra ＝: dois símbolos opostos para o mesmo percentual (item de aceite 241: cor e símbolo de direção são uma regra só).
- Conserto: aplicar só ±10% (3 contra 4 e 8 contra 9 viram ▼ "descendo", cor âmbar). Se o dono quiser um piso de 2 longos por causa de contagem pequena, declarar no ⓘ e nas dúvidas do NOTAS e perguntar a ele; não deixar escondido no código.

### 3. [corrige] Faixa de prosa no estado magro
- Tela: `magro`, bloco rosa tracejado acima de "Primeiras 24 horas" (1440: 645 x 65 px; 390: 4 linhas).
- Evidência: "Ainda sem vídeos com 30 dias de contagem. A contagem diária começou em 03/10: o primeiro fecha em 02/11. As primeiras horas só existem para vídeos publicados depois de 17/10." São duas frases de prosa em bloco monocromático (regra 7), repetem o que as três linhas logo abaixo já dizem com motivo e data ("o primeiro fecha em 02/11", "publicado antes de 17/10…"), e têm o jargão "contagem diária".
- Conserto: apagar a faixa. Se quiser um resumo do bloco, uma linha curta: "Nada fechou ainda: o primeiro vídeo com 30 dias fecha em 02/11." e o resto vai para o ⓘ que já existe ao lado do título do bloco.

### 4. [corrige] Jargão que a convenção proíbe, visível em quase todo estado
- Evidência: "contagem diária" em "Existe a partir de abril de 2027, com 180 dias de contagem diária." (coluna Diferença de "Vídeos novos, mesma idade", presente em 11 dos 12 estados) e na faixa do magro; "sem o viés de idade" / "sem o viés de quem é mais velho" (subtítulo de "Vídeos novos, mesma idade" e do bloco "Views nos primeiros dias"); "escala log" nas réguas (herdado do mockup 9, ver melhorias).
- Conserto: "com 180 dias de registro" e "sem favorecer o vídeo mais velho"; o termo exato fica no ⓘ.

### 5. [corrige] A etiqueta "leitura principal" usa o laranja de "seu canal"
- Telas: todas com tabela (1440: 745 a 765 px; 390: 1206 a 1226 px).
- Evidência: `.ce-tag` usa `var(--accent)` (borda e texto), o mesmo `--accent` que a convenção reserva a "seu canal" (chip `.chip.own`), a ação primária e o foco; no estado `proprio` os dois aparecem na mesma tela com o mesmo laranja e significados diferentes (regra 3: cor estável por significado). Contraste do par é bom (4,94:1 claro, 6,72:1 escuro), o problema é o significado.
- Conserto: etiqueta em neutro (borda `--dim`, texto `--text`) com um símbolo de marca (por exemplo ◆) para ler em escala de cinza.

### 6. [corrige] A Leitura rápida tem três frases por lado
- Telas: `tipico`, `extremo`, `2027`, `fora` etc. A regra 1 pede "uma frase só". Medi 2 linhas a 1440 e 4 a 5 linhas a 390 por lado (Nômade em `tipico`: "…ganhou 21% menos views… As outras leituras concordam. Em queda sustentada (3 janelas de 28 dias seguidas)." ; Leo em `extremo`: três frases).
- A parte "Em queda sustentada…" e "Está parado (há 74 dias…)" repete exatamente a pastilha M8 do cartão logo acima (texto repetido, regra 3).
- Conserto: a frase fica com a direção e um fecho curto em símbolo: "Paddy Doyle está subindo: +28% de views no canal inteiro em 28 dias. Outras leituras: ✓ concordam" (ou "≠ divergem"). O estado do canal fica só na pastilha.

### 7. [corrige] No estado erro, o cartão do lado que não carregou continua afirmando estado e números
- Tela: `erro` (Nômade Raiz): aviso "Os números de Nômade Raiz não carregaram" e, ao mesmo tempo, o cartão mostra "Em queda · 3 janelas de 28 dias seguidas" e na Leitura rápida só o ícone "!" com "Nada foi medido agora".
- Evidência: a pastilha M8 é derivada dos mesmos números (queda sustentada vem de M3(a)). Afirmar "Em queda" sem os números é afirmar mais do que o dado sustenta.
- Conserto: no estado erro, a pastilha do lado B vira a pastilha de erro "não carregou" (família do erro, texto em `--text`) e some a linha de apoio.

### 8. [corrige] A 390 px a resposta fica abaixo da primeira tela
- Tela: todas com os dois cartões, 390 x 844 (ponteiro grosso).
- Evidência: os cartões ocupam 342 a 733 px (391 px, com a pastilha M8 e a linha de apoio); a Leitura rápida começa em 747 px, já fora da primeira tela de um celular (a área útil do navegador é menor que 844). Na primeira tela o dono só vê título, subtítulo e dois cartões "Ativo". Em 1440 isso não acontece (Leitura rápida a 400 px). O ⓘ da pastilha ainda cai sozinho numa terceira linha no cartão B de `tipico` (a 390).
- Conserto: a 640 px ou menos, a Leitura rápida vem antes dos cartões (ela já traz os chips A e B e os nomes) ou os cartões ficam com nome e pastilha em duas linhas, sem o "longos acompanhados"; o ⓘ fica na linha da pastilha.

## Melhorias (não bloqueiam)

- **Barra hachurada de "não medido" com comprimento fixo** (blocos "Primeiros dias", `pb-nm`): uma barra rosa de uns 60 px ao lado de uma barra real sugere um valor pequeno. Trocar por uma pastilha só com a hachura, sem barra.
- **"divergem" para +16% contra +8%** (`proprio`, A: "estão estáveis"): a divergência é um efeito do limiar de 10%. Sugestão: "concordam em parte" quando a diferença entre as leituras é de menos de 10 pontos.
- **Estado erro:** 14 repetições de "tente de novo no aviso acima" na coluna B. Uma pastilha por célula basta, sem a segunda linha.
- **Símbolo de "sem direção medida" na Leitura rápida:** quadrado de hachura com um "o" quase invisível (captura ampliada em 4x). Herdado do mockup 9 aprovado (`.sy.nmk`), então não é bloqueio; dar ao "o" a cor `--nm` cheia e traço de 2 px.
- **Linha "queda sustentada: ainda sem como medir (a partir de 14/12)"** aparece só em Leo (`magro`) e em Carol Rotas (`naomedido`); Lodir, no mesmo estado `magro` e também ativo, não tem a linha. Ou aparece em todo canal com menos de 112 dias, ou só no ⓘ (dúvida 8 do NOTAS).
- **Diferença entre janelas diferentes** (`fora`: "Paddy Doyle: +63% de longos publicados" compara 13 contra 8 "até 01/11"): acrescentar "até 01/11" na linha de Diferença, como já está nas células.
- **Motivos no estado magro com data futura:** em 13/10 a data 17/10 ainda não chegou, e a frase "publicado antes de 17/10: as primeiras horas não foram contadas" lê como passado. Sugestão: "as primeiras horas passam a ser contadas em 17/10".
- **"escala log"** (14 canais, escala log) é jargão herdado do mockup 9; sugestão "escala de proporção" ou deixar só no ⓘ do bloco.
- **Hierarquia de títulos:** `h3` "Leitura rápida" e os `h3` dos popovers aparecem dentro de `h2` de canal; leitor de tela vai anunciar "Estado do canal" como seção da tela. Trocar os `h3` dos popovers por `p` com `role="heading"` fora da árvore, ou `aria-hidden` enquanto fechados (não verifiquei com leitor de tela).
- **Vazio:** o esqueleto da tabela ocupa 900 de 1176 px e deixa um vazio à direita; igualar a largura da tabela real.
- **Alvo de toque do ⓘ a 1440:** 28 x 28 px (ponteiro fino, acima de 900 px); é o padrão aprovado do lote 1 e fica como está. A 390 todos medem 44 x 44.

## Medidas

| Medida | Valor | Meta | Resultado |
|---|---|---|---|
| Rolagem horizontal da página, 12 estados x 2 larguras | 0 px (scrollWidth = clientWidth, 1440 e 390) | 0 | passa |
| Texto menor que 12 px (medidas.json do autor, conferido) | 0 | 0 | passa |
| Alvos menores que 44 px a 390 (ponteiro grosso), tipico, proprio, leitura, erro, vazio | 0 | 0 | passa |
| Menor razão de contraste de texto, escuro (1440 e 390), 12 estados | 4,86:1 (símbolo "■" do contexto, 12 px) | 4,5:1 | passa |
| Menor razão de contraste de texto, claro (1440 e 390), 12 estados | 4,73:1 (chip "B", 12 px) | 4,5:1 | passa |
| Zero medido, borda `--im-zero` sobre `--surface` | 4,97 (escuro), 4,84 (claro) | 3:1 | passa |
| Hachura e borda `--nm-line` sobre `--surface` / sobre `--nm-bg` | 4,09 / 3,56 (escuro); 4,57 / 3,94 (claro) | 3:1 | passa |
| Casas do acerto e contorno "ainda não existe", `--dim` sobre `--surface` | 4,86 (escuro), 5,59 (claro) | 3:1 | passa |
| Direção ▲ `--dir-up`, ▼ `--dir-dn`, ＝ `--dir-eq`, sobre `--surface` | 7,26 / 7,71 / 6,18 (escuro); 6,37 / 5,55 / 7,13 (claro) | 3:1 | passa |
| Lados A (`--lado-n`) e B (`--lado-b`) sobre `--surface` | 11,88 / 6,80 (escuro); 8,32 / 4,43 (claro) | 3:1 | passa |
| Etiqueta "leitura principal" em `--accent` sobre `--surface` | 6,72 (escuro), 4,94 (claro) | 4,5:1 | passa em contraste, falha em significado (item 5) |
| Foco por Tab (tipico, 1440 claro) | contorno sólido 2 px `--accent` em todos os 13 itens da tela | visível | passa |
| ⓘ por teclado (Enter abre, Esc fecha) | abre o popover; Esc fecha e o foco volta ao ⓘ | funciona | passa |
| Controles sem nome acessível, `role="img"` sem `aria-label`, `svg` sem `aria-hidden` | 0, 0, 0 (5 estados medidos) | 0 | passa |
| Erro: `role="alert"` no aviso; botão "Tentar de novo" | presente; 44 px (`.btn.big`) | sim | passa |
| `color-mix()` no CSS e no JS da pasta | só em comentários "sem color-mix" | 0 de uso | passa |
| Altura da página a 1440 / a 390 (tipico) | 2625 / 5063 px | sem meta | informativo (longa; 5063 px a 390 é a tabela empilhada em cartões) |
| Posição da Leitura rápida a 1440 / a 390 (tipico) | 400 px / 747 px do topo | a 390, dentro de ~730 px | falha a 390 (item 8) |
| Cartões dos dois lados a 390 | 342 a 733 px (391 px) | sem meta no lote | informativo (item 8) |

## Dado real e dado de exemplo

Todo número da tela é de exemplo (faixa "exemplo" no topo e em cada Leitura rápida; "Números inventados"). O único dado de calendário real é o estado `magro` (13/10/2026: contagem diária desde 03/10, queda sustentada só a partir de 14/12). As datas de 17/10 (primeiras 24 horas) e as 13/11 e 20/04/2027 são suposições declaradas no NOTAS (dúvida 3). As frases do mockup dizem isso em cada estado.

## Verificações cruzadas com o pedido do spec

- 6.2 e 6.5b (mockup 17, parte Comparar): M3 em três leituras (a principal, b e c de apoio, c vira principal em 2027), M4, M7 na idade de 30 dias e M8 no cartão de cada lado estão todos desenhados. M1 com N = 1 também. Falta só provar "Em queda" numa data possível (item 1).
- Item 242 (comparar por direção): sim, a frase do topo e a primeira linha respondem "subindo ou descendo".
- Item 241 (cor de direção): ▲ verde, ▼ âmbar, ＝ neutro; nada de vermelho para direção. Quebrado só pelo item 2 (mesmo percentual com dois símbolos).
- 07-forja 8.1.5 (o exemplo do dono "praticamente iguais"): presente em "Longos publicados" (13 contra 12) com ⓘ ao lado dizendo que a contagem não mede frequência. Passa.
- NC "parado é ＝ ou estado M8": os dois aparecem (＝ neutro na direção, âmbar na pastilha M8), como o lote 1, sem decidir sozinho. Passa.

## O que não consegui verificar

- Leitor de tela (VoiceOver, NVDA): a árvore de títulos e a ordem de leitura dos cartões a 390 ficaram só pela leitura do HTML.
- Safari, Opera (o navegador do dono renderiza `color-mix()` transparente; aqui não há uso, mas outros recursos de CSS não foram conferidos lá) e Firefox.
- Ordem de teclado completa nos 12 estados (testei Tab em `tipico` a 1440 e Enter e Esc no primeiro ⓘ; a barra do mockup é a primeira parada, fora da tela).
- Contraste dos fundos com gradiente e hachura (medi o fundo sólido do ancestral; os traços da hachura medi só como cor do token).
- Movimento reduzido: a tela não tem animação que eu tenha visto; não testei a mídia `prefers-reduced-motion`.
- Capturas do cruzamento 1440 claro e 390 escuro (o contraste desses dois cruzamentos foi medido, mas não olhei as imagens).

## Pedido de reconferência

Quem desenhou corrige os itens 1 a 8, regenera as 24 capturas (e as do novo estado "Em queda") e me chama para a rodada 2. Discordância de um achado vem por escrito com medida ou captura, e eu mantenho ou retiro por escrito.
