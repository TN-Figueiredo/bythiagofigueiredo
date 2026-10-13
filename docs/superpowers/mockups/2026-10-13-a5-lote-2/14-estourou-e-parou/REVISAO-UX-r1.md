# Revisão de UX, rodada 1: mockup 14, a leitura M10 "Estourou e parou" (13/10/2026)

Revisor: `revisor-ux-senior`. Pasta: `docs/superpowers/mockups/2026-10-13-a5-lote-2/14-estourou-e-parou/`. Nada foi editado no mockup.

## Resumo

**Veredito do conjunto: VOLTA PARA AJUSTE (não vai ao dono).** 2 bloqueios, 4 "corrige", 6 sugestões.

| Tela | Veredito |
|---|---|
| Histórico do vídeo (15 estados) | **volta para ajuste** (nenhum bloqueio; 4 "corrige") |
| Outliers (6 estados + filtros) | **reprovado nesta rodada** (2 bloqueios) |

O desenho é bom: a forma das três casas responde de relance "quantos dos três sinais batem", sem nota, sem percentual e sem cor de bom ou ruim. A cor é estável, o zero medido é caixa vazada, o não medido é hachura e o "ainda não existe" é pontilhado. Régua e números alinhados, texto de interface limpo (nenhuma "retenção", nenhum jargão da lista proibida nos 49 estados medidos), o texto obrigatório é idêntico ao do spec, o ⓘ tem a frase fixa. Os dois bloqueios são de **honestidade do dado** (o que o texto afirma ao lado de linhas que não o sustentam), e é exatamente o risco 11.

As três coisas que mais derrubam a tela:
1. O texto obrigatório do Outliers afirma "Este vídeo teve muitas views… e pouca reação" sobre linhas que a própria tela diz "não medido" ou "não é o caso" (bloqueio 1), e o estado `zero` tem linhas impossíveis (bloqueio 2).
2. Duas palavras para a mesma coisa: a frase diz "os sinais **batem**", o selo e o texto dizem "**vale**". E o ✓ de "vale" num vídeo que "parou" lê-se como boa notícia (C1).
3. A ressalva "Indício, não medição" está a 1.100 px (1440) e a 1.400 px (390) de distância da frase que parece resposta (C2); a zona "vale" da régua não passa de 3:1 (C3).

## Pergunta do usuário e leitura de relance

- **Histórico:** "Este vídeo estourou e parou, ou não? E isso é medido ou é palpite?" Resposta em 3 segundos, a 1440, sem rolar: título + pastilha "indício" + três casas + "Os 3 sinais batem" (bloco começa em y=481, frase em y=537-562, dentro dos 900 px). Em "não é o caso" a frase diz o sinal que falhou e por quanto. Passa.
- **Outliers:** "Quais destes outliers estouraram e pararam, e quantos eu nem consigo julgar?" Frase "2 dos 9 outliers têm a leitura; 3 não são o caso e 4 não foram medidos", barra de cobertura (cheia, contorno, hachura), filtros com a casa. Passa no primeiro olhar; o que derruba é o texto (bloqueio 1) e o estado `zero` (bloqueio 2).

## Bloqueios

### B1. Outliers, filtros "Não medido" e "Não é o caso" (e "Todos"): o texto obrigatório afirma o que a lista não sustenta
- **Tela e estado:** Outliers `cheio` com `?filtro=nm` e `?filtro=nao`; `magro` com `?filtro=nm`; também `cheio` em "Todos".
- **O que está errado:** o código mostra o texto sempre que existe alguma linha com a leitura em **toda a lista** (`c.pico > 0`), mesmo com o filtro escondendo essas linhas. Resultado: "Este vídeo teve muitas views nos primeiros 30 dias, quase nenhuma depois, e pouca reação do público" aparece em cima de 4 linhas "não medido" (captura `shots/r1-out-nm-1440-escuro-p0.png`; no `magro` com filtro "Não medido" são 8 linhas não medidas sob o texto, e a frase-resumo diz "0 não são o caso"). Em "Todos" o "Este vídeo" não aponta para nenhum vídeo (está acima da lista inteira, a cerca de 230 px da primeira linha que tem a leitura). É uma frase mais forte do que o dado sustenta, ao lado de um "não medido".
- **Evidência:** `m14.js` linha 249 (`var txt = c.pico > 0 && caso !== 'erro' ? texto() : ''`); medição `index.html?tela=outliers&caso=magro&filtro=nm` traz "O que vimos" no texto da tela.
- **Correção exata:** mostrar o texto só quando a lista **visível** contém pelo menos uma linha com a leitura (filtros "Todos" e "Com a leitura", nunca "Não é o caso" nem "Não medido"); e ancorá-lo ao que ele descreve: logo abaixo da última linha com a leitura (as linhas com a leitura vêm primeiro), com uma linha de abertura **fora** do texto literal: "Sobre os vídeos marcados com Estourou e parou:". As três frases do spec ficam idênticas.

### B2. Outliers `zero`: linhas impossíveis, que contradizem a regra e os outros estados
- **Tela e estado:** Outliers `zero`, ao clicar em "Todos" ou "Ver todos os 9" (captura `shots/r1-out-zero-todos-1440-escuro.png`).
- **O que está errado:**
  - "Bangkok em 48 horas sem gastar nada", 2,6× o normal, mostra "não bateu: **muitas views cedo**" (✕ na primeira casa). A lista é de outliers com múltiplo de 2× ou mais aos 30 dias, e "muitas views cedo" vale a partir de 2×. Impossível. Além disso esse vídeo tem 212 dias e, em `cheio`, é "não medido: sem a medida dos 30 primeiros dias".
  - "Quanto custa uma semana em Chiang Mai?", 61 dias, aparece como "Não é o caso" (✕✕ com ✓), mas no Histórico (`nm-cedo`) e em `cheio` o mesmo vídeo é "não medido: ainda não tem 90 dias".
  - "Vietnã de moto", "A passagem mais barata" e "O voo" mudam de resultado entre `zero`, `cheio` e o Histórico (ex.: Vietnã é ✓✓✕ no `nao`/`cheio` e ✓✕✓ no `zero`).
  - Quem abre "Zero medido" e clica em "Todos" vê uma tela que desmente o resto do mockup, num recurso cujo risco é justamente credibilidade.
- **Evidência:** `m14-dados.js`, `M.OUTLIERS.zero` (`lin(4,'nao','nvv')`, `lin(5,'nao','vnn')`, `lin(0..3)` com sinais diferentes dos de `cheio`); captura acima.
- **Correção exata:** no `zero`, reaproveitar os resultados de `cheio` para os mesmos vídeos (Bangkok = não medido "sem a medida dos 30 primeiros dias"; Chiang Mai = não medido "ainda não tem 90 dias"; Vietnã ✓✓✕; O voo ✓✕✓) e, para zerar "Com a leitura", trocar só as duas linhas que eram `pico` (12 países e A passagem) por "não é o caso" **com a primeira casa ✓** (nunca ✕ em linha de múltiplo ≥ 2×). Conferir que toda linha com ✕ na primeira casa seja impossível em qualquer estado (a primeira casa nunca é ✕ no Outliers).

## Corrige (vai ao dono só depois de corrigido)

### C1. "vale" contra "batem": dois nomes para a mesma coisa, e o ✓ lê-se como boa notícia
- **Onde:** todo estado do Histórico com cartões e as casas do Outliers.
- **O quê:** a frase diz "Os 3 sinais **batem**"; o selo de cada cartão diz "✓ **vale**" e "✕ **não vale**"; a linha de apoio diz "**Vale** com 108.000 views ou mais"; as casas têm `aria-label` "vale". "Vale" sem sujeito é ambíguo ("vale a pena?", "é válido?") e "Pouca reação do público: ✓ vale / ✕ não vale" faz o leitor trocar o sentido de ✓ (num vídeo que "parou", ✓ parece bom).
- **Evidência:** capturas `index-caso-tipico-1440-escuro.png` e `index-caso-nao-1440-escuro.png`; `m14.js` linhas 32, 52, 62, 75, 79, 87.
- **Correção:** um nome só em toda a tela e nos `aria-label`: selo "✓ bate" / "✕ não bate", apoio "Bate com 108.000 views ou mais (2× o normal)", casa "bate / não bate / não medido".

### C2. A ressalva "Indício, não medição" está longe da frase que parece resposta
- **Onde:** Histórico `tipico` (e demais com a leitura); Outliers `cheio`.
- **O quê:** a 1440 a frase "Os 3 sinais batem…" fica em y=537-562 e o texto obrigatório em y=1106-1314 (abaixo da primeira tela de 900 px); a 390 a frase fica em y=1096-1167 e o texto em y=2437-2847. Entre os dois há três cartões com régua. A única ressalva visível de relance é a pastilha "indício" de 12 px ao lado do título. É o risco 11 do spec (parecer veredito).
- **Correção:** subir o bloco do texto obrigatório para logo abaixo da frase-resumo, antes dos cartões (custo: cerca de 210 px a 1440; os cartões continuam começando dentro dos 900 px), ou, se o desenhista preferir manter a ordem, levar "Indício, não medição." para dentro da frase-resumo. Reconferir a 1440 que casas + frase + ressalva cabem na primeira tela.

### C3. Zona "bate" da régua: contraste de elemento gráfico abaixo de 3:1
- **Onde:** os cinco desenhos de régua, todos os estados com cartões.
- **Medida (cor composta lida do navegador):** zona contra o trilho: **2,21:1 no escuro** e **1,38:1 no claro** (`--lm-vale`). O marcador azul contra a zona no claro: 2,89:1 (o anel de 2 px ameniza). O trilho tem borda `--dim` (4,64:1 escuro, 5,04:1 claro): isso está bom. Limite 7,32:1 e 10,29:1, normal do canal 6,92:1 e 6,43:1: bons. Só a zona, que diz de que lado está o "bate", fica abaixo do exigido.
- **Correção:** escurecer a zona para pelo menos 3:1 contra o trilho nos dois temas (por exemplo opaco `#6F6659` no escuro, 3,28:1; `#8A7D68` no claro, 3,40:1) e trocar o anel do marcador (`border-color: var(--surface-2)`) por `var(--text)` para o marcador continuar separado da zona mais escura. Sem `color-mix()`.

### C4. Cartão "Quase nada depois" mostra "✕ não vale" com o primeiro número dentro da zona
- **Onde:** Histórico `nao-rende` (390 claro: `shots/r1-nao-rende-390-claro-p0.png`).
- **O quê:** o cartão tem duas condições que valem juntas. Quando só a segunda falha ("ainda rende" 3,1% acima de 2%), o selo do cabeçalho do cartão diz "✕ não vale", mas logo abaixo a cauda (11,8%, limite 18%) está dentro da zona, com o marcador do lado certo e sem selo próprio. O leitor vê "não vale" ao lado de um número que passa.
- **Correção:** dar ao primeiro bloco do cartão o seu próprio selo (✓ bate com 11,8%) e deixar o selo do cabeçalho com a regra explícita "as duas precisam bater" (por exemplo "✕ 1 de 2 bate"), em todos os estados com cartão 2.

## Sugestões

1. **Vazio nos cartões 1 e 3 a 1440:** o cartão 2 (com duas condições) define a altura; os cartões 1 e 3 ficam com cerca de 230 px de espaço vazio sob a régua (cartão de 516 px). Sugiro alinhar o conteúdo ao topo e usar o espaço para a legenda ou reduzir a altura com `align-self: start`.
2. **Título em estados sem a leitura:** "Estourou e parou" como título de um bloco que diz "Só 2 dos 3 sinais batem, então não é o caso" ou "Não medido" lê-se como afirmação. Trocar o título nesses dois estados por um rótulo ("Leitura: Estourou e parou?"), ou deixar como está e confirmar com o dono. Nome A ou B: concordo com a escolha do plano (A, mais curto, com "indício" colada); o B ("pouco sinal de que agradou") fala do público, que é justamente a hipótese que o texto declara não medida. Decisão do dono.
3. **Casas de 16 px do "não medido" no Outliers:** a hachura quase some (a 390 claro e em escala de cinza parece uma caixa vazia clara). Continua distinta de ✓ (cheia) e de ✕ (glifo), então não bloqueia; um traço "–" ou a hachura de 3 px ajudaria.
4. **Cinco quadrados "3 de 5" (`nm-canal`)** têm o mesmo formato e a mesma cor das casas "bate": podem ser lidos como casas. Usar círculos ou miniaturas.
5. **Legenda da régua a 390:** "Normal do canal" quebra em duas linhas e o valor desce uma linha em relação aos outros dois (54.000 fica mais baixo que 183.640 e 108.000). Rótulo curto ("Normal") ou valor na mesma linha.
6. **Controles novos a 1440:** filtros do Outliers com 36 px de altura e o link "Estourou e parou" com 24 px (ponteiro fino); a 390 estão em 44 px. A convenção pede 44 px em controle novo; aceitável, mas nivelar com `.btn.big`.

## Medidas

| Medida | Resultado |
|---|---|
| Rolagem horizontal da página (49 estados e larguras medidos por mim, mais as 100 do `medidas.json` do desenhista) | 0 px em todos |
| Texto menor que 12 px dentro do bloco | 0 |
| Alvos menores que 44 px a 390 (ponteiro grosso) | 0 (migalha, ⓘ, filtros, links, "Tentar de novo") |
| Alvos menores que 44 px a 1440 (ponteiro fino) | migalha 41x20 (casca existente), filtros 36 px de altura, link da linha 24 px (ver sugestão 6) |
| Menor contraste de texto (escuro, 1440) | 4,72:1 (texto de apoio dos painéis "não medido") |
| Menor contraste de texto (claro, 390) | 6,07:1 |
| Zona "bate" contra trilho | 2,21:1 escuro, 1,38:1 claro (C3, abaixo de 3:1) |
| Marcador contra trilho | 7,61:1 escuro, 3,99:1 claro |
| Marcador contra zona | 3,44:1 escuro, 2,89:1 claro (anel de 2 px separa) |
| Borda do trilho contra cartão | 4,64:1 escuro, 5,04:1 claro |
| Limite tracejado contra zona | 7,32:1 escuro, 10,29:1 claro |
| Borda da casa "não vale" (`--muted` 2 px) e do zero (`--im-zero` 2 px) | acima de 3:1 nos dois temas (lidos do estilo; casa "bate" é preenchida em `--text`, 14,5:1) |
| Altura da linha do Outliers | 63 px (81 px com dois motivos), abaixo da meta de 132 a 155 px; bom |
| Altura do bloco do Histórico | 849 px a 1440, 1.847 px a 390 |
| Popover do ⓘ | 380 x 489 px a 1440; 366 x 489 px a 390 (cabe, y=8); foco volta ao botão ao fechar com Esc |
| Foco visível | 2 px `--accent` em todos os controles percorridos por Tab; ordem lógica (ⓘ, filtros, link da linha) |
| `color-mix()` | 0 (só em comentários "sem color-mix") |
| Palavra "retenção" no texto renderizado | 0 em todos os estados (só em comentários dos arquivos copiados do lote 1: `a4-comum.js:259`, `a4.css:268,306`; não aparece na tela, mas o teste do item 56 deve olhar o HTML renderizado, não o código) |
| Arquivos congelados do lote 1 (`a4.css`, `a4-comum.js`, `lote.css`, `lote.js`) | idênticos aos do lote 1 (conferido por `diff`) |

## Veredito por estado e largura

Largura 1440 escuro e 390 claro foram medidas e abertas; claro a 1440 e escuro a 390 vêm do `capturar.mjs` do desenhista (tokens do lote 1) e só passaram por medida de rolagem e fonte.

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| Histórico `tipico` | corrige (C1, C2, C3) | corrige (C1, C2, C3) | frase, casas e cartões respondem de relance |
| `extremo` (▶, "menos de 0,1×", 0,02%) | corrige (C1, C3) | corrige | nada cortado |
| `borda` (igual ao limite) | corrige (C1, C3) | corrige | "Igual ao limite: vale" presente; trocar para "bate" |
| `zero` (0 em caixa vazada) | corrige (C1, C3) | corrige | zero distinto de não medido: ok |
| `nao` (2 de 3, reação) | corrige (C1, C3) | corrige | texto obrigatório ausente (ver nota abaixo) |
| `nao-rende` | corrige (C1, C3, C4) | corrige (C4) | selo do cartão 2 contradiz o primeiro número |
| `nm-semv30`, `nm-v30baixo`, `nm-canal`, `nm-semreacao`, `nm-aovivo`, `nm-cedo` | pronto (sugestões 3 e 4) | pronto | motivo, "passa a existir" e forma do que falta presentes; hachura só no "não medido" de verdade |
| `sem-dado` (ainda não existe) | pronto | pronto | pontilhado, linha do tempo legível |
| `erro` | pronto | pronto | família do erro, "isto não quer dizer que o vídeo não estourou" |
| `carregando` | pronto | pronto | `aria-busy` |
| Outliers `cheio` | reprovado (B1, C1, C2) | reprovado (B1) | cobertura e filtros bons |
| Outliers `magro` | reprovado (B1) | reprovado (B1) | 8 linhas "não medido" sob o texto da leitura |
| Outliers `zero` | reprovado (B2) | reprovado (B2) | tela vazia boa ("Zero aqui é um resultado"); a lista de "Todos" é impossível |
| Outliers `sem-dado`, `erro`, `carregando` | pronto | pronto | |
| `?nome=ambos`, `?nome=b` | pronto | pronto | só comparação de nome; sem rolagem |

**Nota sobre o texto obrigatório nos estados `nao` e `nm`:** concordo com a escolha do desenhista de não mostrá-lo ali (ele diria "este vídeo teve muitas views… e pouca reação" e é falso nesses estados), e com a leitura do spec linha 155 ("não aparece: mostra 'não é o caso' com os números"). Fica declarada como dúvida 2 das NOTAS para o dono. O teste do item 56 precisa dessa regra escrita: o texto aparece exatamente nos resultados `pico_sem_cauda`. Aviso ao implementador: o texto está partido em três linhas com rótulos, então o teste deve procurar cada frase como substring, não a frase inteira contígua.

## Consistência com o lote 1

Mesma casca, mesmos tokens, mesmo ⓘ, `.nm` para não medido (hachura rosa), `.lm-z` igual ao zero do lote 1, "+ novo" tracejado, "exemplo" no lugar do número. Nenhuma cor nova de matiz; as duas variáveis locais (`--lm-vale`, `--lm-vale-b`) são neutras e literais. Duas observações: (a) "exemplo" no cabeçalho do cartão em vez de ao lado de cada número foi declarado na NOTAS (decisão 14) e cobre os números; aceito. (b) o parágrafo do cabeçalho do Observatório ("o que a forja leu disso") vem do lote 1/produção, não deste mockup.

## O que NÃO consegui verificar

- Leitor de tela (VoiceOver, NVDA): li os `aria-label` no código e conferi que `role="img"` descreve casas e réguas por extenso, mas não ouvi nada.
- Safari, Firefox e Opera (só Chromium headless; o `color-mix()` está ausente, então o risco do Opera está coberto por inspeção do CSS, não por renderização).
- Toque real: emulei ponteiro grosso e `tap`, mas não um aparelho; o popover do ⓘ só fecha com Esc ou toque fora (sem botão de fechar).
- Movimento reduzido: o CSS desliga animação, não testei com o sistema ligado.
- Ordem de teclado completa da tela (percorri 30 tabs no Outliers `cheio`; o Histórico só até o ⓘ).
- Os estados claro a 1440 e escuro a 390 não foram abertos por mim (só medidos).

Capturas e scripts desta revisão: `shots/r1-*.png` (fatias do bloco, popover, escala de cinza) e o scratchpad da sessão. Servidores de teste nas portas 47721 a 47723 encerrados ao fim.
