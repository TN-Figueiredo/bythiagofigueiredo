# Revisão de UX, rodada 2: mockup 14, a leitura M10 "Estourou e parou" (13/10/2026)

Revisor: `revisor-ux-senior`. Pasta: `docs/superpowers/mockups/2026-10-13-a5-lote-2/14-estourou-e-parou/`. Nada foi editado no mockup (só acrescentei capturas `shots/r2-*.png` e `shots/medidas-r2.json`). Escopo da rodada: conferir se cada bloqueio e cada "corrige" da r1 foi resolvido e se o ajuste criou defeito novo; o resto do mockup foi remedido.

## Resumo

**Veredito do conjunto: NÃO PODE IR AO DONO. 2 bloqueios (novos, ambos no Outliers `magro`), 1 "corrige", 6 melhorias.**

Todos os itens da r1 (B1, B2, C1 a C4, as 6 sugestões) foram resolvidos de verdade, com medida e captura. Os dois bloqueios de agora **não vêm do ajuste**: são da mesma família do B2 da r1 (linha ou frase que o resto da tela desmente) e estavam no estado `magro` do Outliers, que na r1 eu abri só para o texto obrigatório e não para as linhas. Admito a omissão: eu devia tê-los achado na r1. Como o `magro` é "o caso real por meses" (o estado que o dono vai ver primeiro em produção), não dá para deixar passar.

| Tela | Veredito |
|---|---|
| Histórico do vídeo (15 estados) | **pronto para o dono** (1 "corrige" de aparência no `carregando`, não bloqueia; ver C1) |
| Outliers `cheio`, `zero`, `sem-dado`, `erro`, `carregando`, filtros | **pronto para o dono** (C1 no `carregando`) |
| Outliers `magro` | **volta para ajuste** (B1, B2) |
| Comparação de nome (`nome=ambos`, `nome=b`) | **pronto para o dono** |

As três coisas que mais derrubam o conjunto agora:
1. O `magro` do Outliers tem linhas impossíveis (B1) e um filtro cuja frase contradiz o topo da tela (B2): exatamente o risco 11 (afirmar mais que o dado).
2. O estado `carregando` (Histórico e Outliers) desenha as três casas pontilhadas esticadas em pílulas de 92 px (C1).
3. Dado de exemplo solto em dois pontos (Chiang Mai com 2,2× quando a conta dá 1,9×; filtro "Idade: 30 dias" sobre linhas sem a medida dos 30 dias): não bloqueiam, mas o `magro` reabre a mesma conversa (melhorias 5 e 6).

## Pergunta do usuário e leitura de relance

- **Histórico:** "Este vídeo estourou e parou, ou não? E isso é medido ou é palpite?" Passa: título, pastilha "indício", três casas e "Os 3 sinais batem" na primeira tela (frase em y=549; texto "Indício, não medição." em y=577-783; os cartões começam em y=798, dentro dos 900 px). A ressalva agora está colada à frase (C2 da r1 resolvido).
- **Outliers:** "Quais destes outliers estouraram e pararam, e quantos eu nem consigo julgar?" Passa: "2 dos 9 outliers têm a leitura; 3 não são o caso e 4 não foram medidos", barra em três formas (cheia, contorno, hachura), filtros que também são legenda. Em escala de cinza continua legível (✓ preenchido, ✕ contorno, "–" com hachura; capturei e olhei).

## Conferência da r1, item por item

| Item da r1 | Situação | Evidência |
|---|---|---|
| B1 texto obrigatório sobre linhas que não o sustentam | **Resolvido** | `m14.js` só monta o texto quando a lista visível tem linha `pico`. Medido por script nos 49 estados: texto presente só em `cheio` (Todos, Com a leitura), `magro` (Todos, Com a leitura), `ambos`; ausente em `cheio&nao`, `cheio&nm`, `magro&nm`, `zero&*`. Fica uma vez, logo abaixo da última linha com a leitura, com "Sobre cada vídeo marcado com Estourou e parou acima:" fora do texto literal (`shots/r2-tela-outliers-caso-cheio-1440-escuro.png`). |
| B2 `zero` com linhas impossíveis | **Resolvido** | Nenhuma linha do `zero` tem ✕ na primeira casa; Bangkok e Chiang Mai são "não medido" nos mesmos motivos de `cheio`; Vietnã ✓✓✕ e O voo ✓✕✓ nos três lugares (Histórico, `cheio`, `zero`). Cruzei os nove vídeos contra `M.VIDEOS`: 12 países, A passagem, Vietnã, O voo, Bangkok, AO VIVO e Trem batem em múltiplo, idade e resultado (`shots/r2-tela-outliers-caso-zero-filtro-todos-1440-escuro.png`). |
| C1 "vale" contra "batem" | **Resolvido** | "bate / não bate" em selos, apoio, casas e `aria-label`; "vale" não aparece em nenhum bloco renderizado (checado por `textContent`, 6 estados). A única ocorrência da página é "valem para este canal" no ⓘ, que é verbo comum e não o sinal. |
| C2 ressalva longe da frase | **Resolvido** | ver "Pergunta do usuário". |
| C3 zona da régua abaixo de 3:1 | **Resolvido** | zona vs trilho **3,28:1 escuro e 3,40:1 claro** (era 2,21 e 1,38), medido no navegador; anel do marcador em `--text` (4,94:1 e 4,18:1 contra a zona). Sem `color-mix()`. |
| C4 selo do cartão 2 contradiz o primeiro número | **Resolvido** | selo do cabeçalho "✕ 1 de 2 bate" e a primeira condição leva o seu "✓ bate" (`shots/r2-caso-nao-rende-1440-escuro.png`). |
| Sug. 1 a 6 | **Resolvidas** | cartões 1 e 3 já não ficam com 230 px de vão sob a régua (sobra ainda um vão a 1440, ver melhoria 4); "–" na hachura; círculos no "3 de 5"; "Normal" na legenda; filtros e link da linha com 44 px de altura (medidos). |

## Bloqueios

### B1. Outliers `magro`: duas linhas impossíveis e três linhas que contradizem a regra do próprio ⓘ
- **Tela e estado:** Outliers `?caso=magro`, filtro Todos e Não medido (captura `shots/r2-evid-out-magro-1440-escuro-linhas.png`; também `shots/r2-tela-outliers-caso-magro-1440-escuro.png`).
- **O que está errado:**
  - "Ilhas da Tailândia fora da temporada" aparece com **3,2× o normal do canal** e o motivo "**menos de 1.000 views em 30 dias**". Paddy Doyle tem normal de 47.000 views aos 30 dias: 3,2× é cerca de 150.400 views. Impossível. (Em `cheio` e `zero` o mesmo vídeo é ✓✓✕, como deve.)
  - "Trem noturno de Hanói a Sapa" aparece com "**há 103 dias**" e o motivo "**ainda não tem 90 dias**". Contradição na mesma linha. (Em `cheio` e `zero` o motivo é "canal com menos de 5 vídeos", que é o correto e o do Histórico `nm-canal`.)
  - "A passagem mais barata" (há 101 dias), "Vietnã de moto" (há 102) e "O voo" (há 98) aparecem "sem a medida dos 30 primeiros dias". Pelo ⓘ e pelo Histórico, só vídeo publicado **antes de 03/10/2026** não tem essa medida; no mundo do exemplo (hoje = 20/04/2027) isso é idade **a partir de 199 dias**, e esses três têm cerca de 100.
  - É o caso que o dono verá primeiro em produção e o `magro` diz de si "o real por meses". Linha que desmente o ⓘ é a mesma falha que reprovou o `zero` na r1: credibilidade de uma leitura que já nasce sob o risco 11.
- **Evidência:** `m14-dados.js`, `M.OUTLIERS.magro`: `lin(7,'nm','mmm','v30baixo')` (Ilhas), `lin(8,'nm','mmm','cedo')` (Trem), `lin(1..3,'nm','mmm','semv30')`; o `lin()` herda a idade de `OUT` (97 a 104 dias), que só vale para `cheio` e `zero`. A frase da própria nota (`m14-dados.js`, comentário de `M.OUTLIERS`) diz que "o mesmo vídeo tem o mesmo resultado em `cheio`, `zero` e no Histórico", mas não inclui o `magro`.
- **Correção exata:** no `magro`, (a) Ilhas passa a "não medido: sem a medida dos 30 primeiros dias" **ou** volta a ✓✓✕ como em `cheio`; (b) Trem volta a "canal com menos de 5 vídeos"; (c) toda linha `semv30` do `magro` ganha idade **de 199 dias ou mais** (Bangkok já tem 212; dar às outras três algo como 205, 210 e 230), com o múltiplo mantido, ou então só Bangkok fica `semv30` e as outras ficam em `cheio` ou `cedo` coerentes. Reconferir por script: nenhuma linha com motivo `cedo` e idade ≥ 90, nenhuma `semv30` com idade < 199, nenhuma `v30baixo` com múltiplo ≥ 2×.

### B2. Outliers `magro`, filtro "Não é o caso": a frase diz o contrário do topo e o zero não vem na caixa vazada
- **Tela e estado:** Outliers `?caso=magro&filtro=nao` (um clique em "Não é o caso 0" a partir do `magro`). Captura: `shots/r2-evid-out-magro-nao-vazio-1440-escuro.png`.
- **O que está errado:**
  - A frase-resumo no alto diz "**1 dos 9 outliers têm a leitura**" e, logo abaixo, a caixa diz "**Nenhum dos 9 outliers tem a leitura.**" Duas frases opostas a 120 px uma da outra. A caixa vazia é a mensagem do filtro "Com a leitura" e foi reaproveitada para o filtro "Não é o caso" (e valeria para "Não medido" se ele ficasse vazio).
  - O filtro "Não é o caso 0" mostra o 0 em mono comum; a caixa vazada de zero medido só está no "Com a leitura 0". Aqui o 0 é um zero medido (há 1 vídeo medido e nenhum ficou fora), então a regra 6 do dono pede a caixa nos dois. O 0 da frase-resumo ("0 não são o caso") também fica em texto corrido, mas esse eu aceito.
  - Efeito: o estado mais real e o primeiro clique de quem quer ver "o que não deu" mostram uma tela que se contradiz.
- **Evidência:** `m14.js` linhas do `f('nao', ...)` (a caixa `.lm-z` só sai quando `k === 'com'`) e o ramo `if (!mostrar.length) lista = '<div class="lm-vazio">...Nenhum dos ... tem a leitura'`, que não olha o filtro. Medido: `vazio: "Nenhum dos 9 outliers tem a leitura. 0 foram medidos e não são o caso; 8 não foram medidos."` com `resumo: "1 dos 9 outliers têm a leitura..."`.
- **Correção exata:** (a) a mensagem do vazio depende do filtro: "com" = "Nenhum dos N outliers tem a leitura"; "nao" = "Nenhum dos N outliers foi medido e ficou de fora da leitura (0 não são o caso)"; "nm" = "Todos os N outliers foram medidos"; sempre com a caixa 0 e sem a frase "Nenhum dos 9 tem a leitura" quando `c.pico > 0`; (b) o contador de qualquer filtro com valor 0 medido usa `.lm-z` (caixa vazada), não só o de "Com a leitura"; "zero medido" só quando o grupo foi medido (em `magro`, "Não é o caso 0" é medido; "Não medido 0" num estado em que nada ficou sem medida também).

## Corrige (vai ao dono só depois de corrigido)

### C1. `carregando` (Histórico e Outliers): as três casas pontilhadas viram pílulas de 92 px
- **Tela e estado:** `?caso=carregando` e `?tela=outliers&caso=carregando`, 1440 escuro e 390 claro (`shots/r2-evid-carregando-casas-esticadas.png`; confirmado também em `shots/r2-caso-carregando-1440-escuro.png`).
- **O que está errado:** as casas, que no `sem-dado` são quadrados de 22 px, aqui ficam com 22 x 92 px. O estado de carregamento é o primeiro que o dono vê toda vez que abre a tela; parece quebrado, não "calculando".
- **Evidência:** `m14.css` linha 137, `.lm-sk i{display:block;height:92px;...}`, tem a mesma especificidade das casas (`<i class="lm-cs p">` dentro do `.lm-sk`) e as sobrescreve.
- **Correção exata:** trocar o seletor para `.lm-sk > i`. Reconferir que o esqueleto (os retângulos de 92 px) continua igual e que as três casas voltam a 22 x 22.

## Melhorias (não bloqueiam)

1. **"Bate com até 1%" ao lado de "✕ não bate".** No cartão 3 de `nao` a linha de apoio começa com "Bate com…" sob um selo "não bate". Lê-se como regra, mas hesita. Sugestão: "Bate se for até 1% (metade do normal)", igual nos três cartões e nos sub-cartões.
2. **O texto obrigatório no meio da lista, no filtro "Todos".** Funciona (ancorado, e é a única forma de o texto não aparecer sobre linhas que não o sustentam), mas o bloco de 207 px (1440) e 340 px (390) separa as linhas com a leitura das demais. Se o dono achar pesado, a alternativa é o texto abaixo da lista inteira com "Vale para cada vídeo marcado com Estourou e parou"; a escolha é do dono, não do desenho.
3. **Ordem das linhas.** O Outliers de hoje ordena por múltiplo; aqui as linhas com a leitura vêm primeiro (3,4× e 2,0×, depois 2,9×, 3,0×, 3,2×, 2,6×...). Está declarado na NOTAS (decisão 8), mas muda uma tela existente. Registrar na lista de decisões do dono.
4. **Vão sob os cartões 1 e 3 a 1440** (cerca de 270 px, porque o cartão 2 tem duas réguas). É o desenho natural; só não deixar que o dono o leia como cartão vazio. Se incomodar: `align-self:start` e nada mais.
5. **Chiang Mai: 2,2× na lista, 1,9× na conta** (77.000 de v30 contra normal de 41.500 do canal). O Histórico `nm-cedo` não mostra o múltiplo, então não aparece na tela, mas um vídeo com 1,9× não entraria no Outliers "2× ou mais". Trocar `x: 2.2` por um múltiplo coerente (por exemplo subir o v30 para 91.000) quando a correção do B1 mexer nos dados.
6. **Filtro "Idade: 30 dias" no Outliers com linhas "sem a medida dos 30 dias".** A faixa de filtros (aria-hidden, só do mockup) diz "Idade: 30 dias" sobre linhas que o `magro` marca sem a medida dos 30 dias. Trocar o chip por "Idade: hoje" ou adicionar uma linha de nota na NOTAS ("o múltiplo do Outliers hoje não vem de V30").
7. **Linha de base da legenda.** Nos valores sob a régua do cartão 2 ("8,9%", "17%", "34%") a base fica uns 5 px abaixo da dos cartões 1 e 3 (cartões lado a lado a 1440, `shots/r2-caso-nao-1440-escuro.png`). Cosmético.

## Medidas

Rodei a mesma bateria nos 30 estados do Histórico e do Outliers, nas quatro combinações de largura e tema (120 medidas em `shots/medidas-r2.json`) e abri por mim 1440 escuro e 390 claro de tipico, extremo, zero, nao, nao-rende, nm-semreacao, nm-canal, nm-cedo, sem-dado, erro, carregando, Outliers cheio, magro, zero, erro, sem-dado, carregando, `nome=ambos`.

| Medida | Resultado |
|---|---|
| Rolagem horizontal da página | **0 px nas 120 medidas** |
| Texto menor que 12 px | **0** |
| Alvos menores que 44 px a 390 (ponteiro grosso) e a 1440 dentro do bloco | **0** (filtros 44 px, link da linha 44 px, ⓘ 44x44, "Tentar de novo" 44 px). Fora do bloco, a migalha "Canais" e "Nômade Raiz" mede 41x20 e 80x20 a 1440 (casca do lote 1, não deste mockup) |
| Menor contraste de texto do bloco, escuro 1440 (todos os textos, cor composta sobre o fundo real) | 4,72:1 (apoio dos painéis "não medido"); demais estados 5,45 a 6,18:1 |
| Menor contraste de texto do bloco, claro 390 | 6,07:1 (painéis "não medido"); demais 6,27 a 7,13:1 |
| Zona "bate" contra trilho | **3,28:1 escuro, 3,40:1 claro** (cumpre 3:1) |
| Anel do marcador contra a zona | 4,94:1 escuro, 4,18:1 claro (o miolo azul sozinho tem 2,32:1 e 1,17:1; é o anel que o separa) |
| Borda do trilho contra o cartão | 4,64:1 escuro, 5,04:1 claro |
| Casa "não bate" (borda `--muted`, contra o fundo) | 6,18 a 7,13:1 |
| Casa "não medido" (borda `--nm-line` + hachura + "–") | 4,57:1 e 4,12:1 a 22 px; 3,90:1 e 4,12:1 a 16 px; todos acima de 3:1 |
| Casa "bate" (preenchida em `--text`) | ✓ legível; mais de 14:1 contra o cartão |
| Foco visível | 2 px `--accent` em todo controle percorrido por Tab (ⓘ, 4 filtros, links das linhas); ordem lógica; Esc fecha o ⓘ e o foco volta ao botão (1440 e 390) |
| Popover do ⓘ | 380 x 489 px a 1440; 366 x 489 px a 390 (cabe, y=8, sem rolagem horizontal) |
| Altura do bloco do Histórico (`tipico`) | 862 px a 1440, 1.847 px a 390 |
| `color-mix()` | 0 nos arquivos novos; só aparece em comentários "sem color-mix" |
| Palavra "retenção" e lista de jargão proibido (lido, gravou, CTR, diário, snapshot, payload, pipeline, série) | **0 no texto renderizado**, página inteira, 6 estados |
| Arquivos congelados do lote 1 (`a4.css`, `a4-comum.js`, `lote.css`, `lote.js`) | idênticos aos do lote 1 (`cmp`) |
| Escala de cinza (Outliers `cheio`) | ✓ preenchido, ✕ contorno, "–" com hachura: os três estados se distinguem sem cor |

## Veredito por estado e largura

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| Histórico `tipico` | pronto | pronto | frase, ressalva e texto na primeira tela |
| `extremo` (▶, 0,02%, "menos de 0,1×") | pronto | pronto | nada cortado |
| `borda` | pronto | pronto | "Igual ao limite: bate" |
| `zero` | pronto | pronto | caixa vazada distinta do não medido |
| `nao` (reação) | pronto | pronto | sem o texto obrigatório; frase diz qual sinal falhou e por quanto |
| `nao-rende` | pronto | pronto | selos coerentes (C4 resolvido) |
| `nm-semv30`, `nm-v30baixo`, `nm-canal`, `nm-semreacao`, `nm-aovivo`, `nm-cedo` | pronto | pronto | motivo, "passa a existir" e a forma do que falta |
| `sem-dado` | pronto | pronto | pontilhado e linha do tempo |
| `erro` | pronto | pronto | "isto não quer dizer que o vídeo não estourou" |
| `carregando` | corrige (C1) | corrige (C1) | casas esticadas |
| Outliers `cheio` (Todos, Com, Não é o caso, Não medido) | pronto | pronto | texto só onde a lista o sustenta |
| Outliers `magro` | **volta para ajuste** (B1, B2) | **volta para ajuste** | linhas impossíveis e filtro contraditório |
| Outliers `zero` (Com, Todos) | pronto | pronto | caixa "0" e "Ver todos os 9" |
| Outliers `sem-dado`, `erro` | pronto | pronto | |
| Outliers `carregando` | corrige (C1) | corrige (C1) | idem |
| `nome=ambos`, `nome=b` | pronto | pronto | só comparação de nome; sem rolagem |

Claro a 1440 e escuro a 390 foram medidos (rolagem, fonte, alvo, contraste) e **não** abertos um a um por mim; só os pares obrigatórios foram abertos.

## Consistência com o lote 1

Sem mudança desde a r1: mesma casca e tokens, `.nm` e `.lm-z` do lote 1, "+ novo" tracejado, "exemplo" na marca do cartão (decisão 14 declarada e aceita). A faixa "Só exemplo até 2027" é só do mockup e está declarada. Duas variáveis locais neutras (`--lm-vale`, `--lm-vale-b`), literais.

## Sobre o risco 11 (parece veredito) e o item 56

O mockup deixa claro que é indício: pastilha "indício" colada ao nome, caixa "Indício, não medição." com três linhas por forma (círculo cheio, tracejado com ?, riscado), o ⓘ com a frase fixa e o título "Leitura:" prefixado em todo estado sem a leitura. Nenhuma nota, nenhum percentual, nenhuma cor de bom ou ruim. O que ainda ameaça o risco 11 é a credibilidade dos dados do exemplo (B1, B2): uma lista que se contradiz faz o dono duvidar da leitura inteira. Palavra "retenção": zero em tudo o que renderiza. O teste do item 56 deve olhar o HTML renderizado, não o código (a palavra existe em comentários de arquivos copiados do lote 1).

## O que NÃO consegui verificar

- Leitor de tela (VoiceOver, NVDA): li os `aria-label`, `role="img"`, `role="note"`, `aria-current`, `role="alert"` e `aria-busy` no código e conferi pelo DOM, mas não ouvi nada.
- Safari, Firefox e Opera: só Chromium headless. O risco do `color-mix()` no Opera está coberto por inspeção do CSS (zero ocorrências), não por renderização.
- Toque real: emulei ponteiro grosso; não testei em aparelho. O popover do ⓘ só fecha com Esc ou toque fora.
- Movimento reduzido: não liguei a preferência do sistema.
- Ordem completa de teclado no Histórico (percorri 14 Tabs; no Outliers, 8).
- Estados claro a 1440 e escuro a 390: medidos, não abertos.

## Arquivos

- Capturas desta rodada: `shots/r2-*.png` (os pares 1440 escuro e 390 claro de cada estado), com as de evidência `shots/r2-evid-out-magro-nao-vazio-1440-escuro.png`, `shots/r2-evid-out-magro-1440-escuro-linhas.png`, `shots/r2-evid-carregando-casas-esticadas.png`; medidas: `shots/medidas-r2.json`.
- Servidor estático de teste nas portas 47762 a 47767, encerrado ao fim de cada script; sem uso da porta 3099.
