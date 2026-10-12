# Ajustes depois da revisão de UX (12/10/2026)

Responde a `REVISAO-UX.md`. Todos os 3 achados "bloqueia" e os 41 "corrige" foram tratados (44 de 44 corrigidos). Das 18 "sugestão", 12 foram aplicadas (uma só em parte), 4 não (motivos abaixo) e 2 pediam "nenhuma". Nada fora desta pasta foi editado; `REVISAO-UX.md` e `ux-revisao-shots/` estão como o revisor deixou.

Como foi conferido: Playwright por `file://`, 1440 e 390 px (390 com toque), escuro e claro. Auditoria do revisor reaproveitada (contraste de texto lido da página, fonte, alvos, transbordo) em 23 páginas ou estados × 2 larguras × 2 temas (92 combinações): nenhum texto abaixo de 4,5:1, nenhum abaixo de 12 px, nenhum alvo abaixo de 44 px a 390 px nas telas, nenhuma rolagem lateral da página. Contraste de marcas gráficas calculado dos tokens, nos dois temas. Escala de cinza: `shots/cinza-*.png`. Capturas novas em `shots/` (todas regeneradas).

## Tabela de significado das cores

Vale para todas as telas da pasta. Cada cor tem um sentido; nenhum estado depende só de cor (a coluna "Forma e palavra" diz o que sustenta em cinza). Valores escuro / claro; contraste contra a superfície do cartão.

| Significado | Cor (escuro / claro) | Forma e palavra | Contraste |
|---|---|---|---|
| **Seu canal, dado medido do seu canal, seleção e foco** | laranja `#FF8240` / `#B8481A` | chip "seu canal"; barras de impressão, views e % assistido; contorno de foco | 6,72 / 4,94 |
| **Lado A** (comparações) | areia `#EAD9B2` / `#5C4710` | quadrado com a letra A, sempre | 11,88 / 8,32 |
| **Lado B** (comparações) | azul `#5AAEE6` / `#1B78BA` | círculo com a letra B, sempre | 6,80 / 4,43 |
| **Cliques estimados** | marca clara neutra `#F5EFE6` / `#231C14` | bolinha com anel e o número embaixo; legenda "cliques estimados" | bolinha sobre a barra: o anel de 1,6 px na cor do cartão a separa (a bolinha sozinha sobre o laranja dá 2,16 / 3,19) |
| **Troca de descrição** (hábito) | violeta `#A78BFA` / `#6D28D9` | marca de semana com "1" ou "2+"; selo "costuma trocar" com quadradinho; filete do cartão; semana sem troca = contorno tracejado vazio | 6,08 / 6,65; "1" sobre a marca 6,80 / 7,10 |
| **Subindo / acima do normal** | verde `#22C55E` / `#11692F` | ▲ no quadrado e a palavra "subindo"; na comparação com a faixa, "+4 pontos acima" | 7,26 / 6,37 |
| **Descendo / abaixo do normal / canal parado** | âmbar `#F59E0B` / ocre `#8A5A00` (rodada 2) | ▼ no quadrado e a palavra "descendo"; "−3 pontos abaixo"; "parado" com o ícone de pausa | 7,71 / 5,55 (4,64 sobre a linha destacada da Retenção; ΔE 30 do laranja "seu canal" no claro) |
| **Estável / igual** | cinza quente `#A89D88` / `#5E5240` | ＝ no quadrado e a palavra "estável"; "= igual" | 6,18 / 7,13 |
| **Não medido** | malva `#E59CC0` / `#8E2A62` com hachura | pastilha "não medido" ou o quadradinho hachurado com a legenda; hachura baixa nos gráficos | borda 4,09 / 4,57 |
| **Zero medido** | ardósia `#7A8FA6` / `#5B6F86` | caixa vazada (só contorno) e a legenda "zero medido" | 4,97 / 4,84 |
| **Ressalva de método, "exemplo", pouco dado** | neutro (contorno e texto `--dim`, `--muted`) | ícone "i" em círculo; chip "exemplo" tracejado; barra tracejada cinza quando não conclui | 4,86 / 5,59 |

Mudanças em relação ao que já existia, todas para tirar uma cor de dois sentidos: o azul deixou de ser "cliques", "lado B" e "semana com troca" e ficou só lado B; o laranja deixou de ser lado A (o seu canal é o chip laranja); o âmbar deixou de ser também o aviso "descer pode ser só idade" (agora neutro); o roxo deixou de ser "mais de uma troca" e "costuma trocar" ao mesmo tempo no aria-label (agora a marca tem "2+" na tela); o ▲ deixou de ser "é maior". Lado A e B em escala de cinza: razão de luminância 1,75 (escuro) e 1,88 (claro), antes 1,04 e 1,09, mais a forma (quadrado × círculo) e a letra.

## Os três bloqueios

| # | Achado | O que foi feito | Como conferi | Estado |
|---|---|---|---|---|
| B1 | c1-seletor, 390 px: o cartão do Lado B pintava por cima da lista do Lado A; "Thiago Figueiredo" intocável | A lista virou `popover="manual"` (camada do navegador), posicionada sob o campo e reposicionada ao rolar ou redimensionar; o teclado, `aria-activedescendant` e Esc seguem iguais | `elementFromPoint` no centro de cada opção visível (390 escuro, 390 claro, 1440): todas devolvem a própria opção, inclusive "Thiago Figueiredo"; depois de rolar 60 px a lista acompanha o campo; Seta, Seta, Esc testados (abre, anda, fecha e devolve o nome); captura `shots/seletor-aberto-390-escuro.png` | corrigido |
| B2 | video.html?caso=novo: cabeçalho com números do vídeo cheio contra seções "vídeo novo" | O caso novo é um vídeo de 1 dia: 212 views, 9 curtidas, 1 comentário, "há 1 dia"; "o normal do canal" e % assistido em não medido, com o motivo | Captura `shots/video-novo-1440-escuro.png`: nenhuma seção contradiz o cabeçalho | corrigido |
| B3 | comparar-direcao: "Aldinho está descendo: caíram 19%" sem a ressalva e sem "exemplo" | A frase de "descendo" traz "(pode só ser idade: os vídeos mais velhos tiveram mais tempo para juntar views)" junto; o bloco ganha o chip "exemplo" no título e a nota diz que vale o exemplo da tabela; o aviso do viés ficou em tom neutro | `shots/comparar-direcao-base90-1440-escuro.png` | corrigido |

## Achados "corrige"

Numerados na ordem do arquivo do revisor (T1 a T9 = telas 1 a 9).

| # | Tela, achado | O que foi feito | Como conferi | Estado |
|---|---|---|---|---|
| C1 | T1 magro: "666 dias desde o último vídeo" com o mesmo peso dos outros | Acima da faixa, "Canal parado há 666 dias; 140 impressões em 29 dias" (parte em âmbar); na célula, o número em âmbar com o selo "parado" (pausa + palavra). Limite de 60 dias | `shots/canal-magro-1440-escuro.png`; em cinza o selo e a frase seguem legíveis | corrigido |
| C2 | T1 texto de projeto ("rodada 7", "lista… seguem o mockup aprovado") | Removido da tela; a conversa foi para `REVISAO.md`, Parte E | Varredura do texto de `#screen` e das ⓘ das 17 páginas: nenhuma ocorrência de rodada, mockup aprovado, decisão do dono, A4 | corrigido |
| C3 | T1 e T2 hachura "não medido" na altura inteira | Faixa de 24 px na base (20% a 15% do eixo, antes 100%); linha tracejada fina até o topo só no dia em foco | Captura `canal-magro-1440-escuro.png`: a barra de 71 passa a ser o elemento mais alto; `canal-magro-passo-a-passo-390-escuro.png` mostra a linha do dia em foco | corrigido |
| C4 | T1 e T4: rótulos "0,7%●6,1%" a 390 px | Os dois limites ficam abaixo da barra, nas pontas (um rótulo central se a barra tem menos de 84 px); o valor fica acima do ponto; nada dentro da barra | `canal-magro-390-escuro.png` | corrigido |
| C5 | T1 alvos a 390 px (Todos os números 19, Comparar com… 34, breadcrumb 20, título 18) | 44 px em ponteiro grosso ou tela estreita (também ⓘ, "Próximo", link dos cartões da Retenção) | `getBoundingClientRect` em `canal.html?caso=magro` a 390 com toque: ⓘ 44×44, "Todos os números" 134×44, "Comparar com…" 132×44, breadcrumb 50×44, link dos vídeos 250×44, passo 44×44 | corrigido |
| C6 | T1 sem dado: ~27 pastilhas iguais, duas palavras | Uma palavra ("não medido"); nas faixas só o quadradinho hachurado, com uma legenda única; um item por cartão da lista (quadradinho + "não medido: views por dia e alcance"); a pastilha de texto só na taxa de clique | `canal-sem-dado-1440-escuro.png`: 8 quadradinhos nas duas faixas e 1 por cartão, 1 pastilha | corrigido (ver nota 1) |
| C7 | T1 "relatório de alcance" é termo do sistema | "Os números de alcance (impressões e cliques) deste canal ainda não chegaram"; "dia ainda não baixado" virou "dia ainda não chegou"; vale para vídeo, comparação e ⓘ | Varredura de texto (acima) | corrigido |
| C8 | T1 Retenção a 390 px cortava "Contra a faixa" | A 390 (até 700 px) cada vídeo vira um cartão: título, faixa e views, barra com % e a comparação; a tabela fica de 701 px em diante | `canal-cheio-retencao-390-claro.png`: sem corte, sem rolagem lateral | corrigido |
| C9 | T1 Retenção 1440: tabela monocromática, frase sem apontar o vídeo | A frase cita o vídeo ("Comi só street food por 48 horas"); a linha dele tem filete e fundo; coluna "Contra a faixa" com sinal, palavra e cor (+4 pontos acima em verde, −1 ponto abaixo em âmbar, = igual em cinza); legenda embaixo; a barra já tinha a marca da mediana da faixa | `canal-cheio-retencao-1440-escuro.png`, `cinza-retencao-1440.png` | corrigido |
| C10 | T2 ⓘ do gráfico com 36×36 px | 44×44 em toque (28×28 só com mouse, onde o gráfico lê pelo passar do mouse) | medida acima (C5) | corrigido |
| C11 | T2 texto do ⓘ fala de "alvo de 44 px" | "Use os botões abaixo do gráfico para ler um dia de cada vez." | ler o texto do popover (`canal-magro-grafico-info-390-escuro.png`) | corrigido |
| C12 | T2 hachura pesada | Igual a C3 | idem | corrigido |
| C13 | T2 foco se perdia ao desabilitar "dia anterior" | O botão usa `aria-disabled="true"` e fica focável; Enter nele não faz nada | Teste: foco no botão no 1º dia, Enter: foco continua nele e o texto do dia não muda | corrigido |
| C14 | T3 magro: "2º de 35" para 0,1 view por dia e "3º de 4" ao lado de "não dá para comparar" | Abaixo de 10 views no período, a linha troca a régua por "Com 2 views em 28 dias não dá para posicionar: 34 dos 34 outros também ficam abaixo de 1 view por dia"; o valor fica cinza; mesma regra em % assistido ("Com só 2 views não dá para posicionar") | `video-magro-1440-escuro.png` | corrigido (ver nota 2) |
| C15 | T3 texto de projeto (tabela aprovada, rodada 8, "tabela e rotina que ainda não existem") | Removido; "Ainda não coletamos esta curva. Quando coletarmos, esta seção mostra onde as pessoas saem do vídeo e onde voltam." | varredura de texto | corrigido |
| C16 | T3 pastilhas malva iguais com 4 palavras, na mesma linha da frase | Uma pastilha curta "não medido" e a frase na linha de baixo (`.nml`) em todo o vídeo | `video-sem-dado-1440-escuro.png`, `video-novo-1440-escuro.png` | corrigido |
| C17 | T3 alvos: ⓘ 36, breadcrumb 42×20, "tnFigueiredo" 77×20, "Próximo" 30 | 44 px em toque; "Próximo" e "Anterior" com 36 px com mouse | auditoria a 390: nenhum alvo abaixo de 44 | corrigido |
| C18 | T4 vídeo magro: intervalo largo em laranja saturado | Quando o intervalo é mais de 3 vezes o do canal, a faixa fica cinza e tracejada, o ponto vazado, com o texto "faixa tracejada: ainda não conclui" | `video-magro-1440-escuro.png` | corrigido |
| C19 | T4 etiqueta "decisão do dono" no título | Removida; a pergunta está em `REVISAO.md` (B1 e Parte E) | varredura de texto | corrigido |
| C20 | T4 "Você não teve views por dia" ao lado de "7 views em 26 dias" | "A mediana dos seus vídeos é 0 views por dia; a de Leo Khev é 0,2." | `comparar-so-magro-1440-escuro.png` | corrigido |
| C21 | T4 "Uma das treze linhas. Antes da A4…" | Removido | varredura | corrigido |
| C22 | T5 magro: 25% em cor de destaque, valor do vídeo e do canal | Número em cinza quando há menos de 10 views, barra com contorno tracejado e preenchimento fraco (sem hachura, que é "não medido"); na faixa do canal o 25% também fica cinza | `video-magro-1440-escuro.png`, `comparar-so-magro-1440-escuro.png` | corrigido |
| C23 | T5 magro: triângulo da mediana parecia selo de "igual" | Abaixo de 10 views a mediana não aparece | idem | corrigido |
| C24 | T5 Retenção: tabela monocromática e cortada | Igual a C8 e C9 | idem | corrigido |
| C25 | T7 c1: linha "indisponível" parecida com opção escolhível | Nome em cinza, "⊘" antes do nome, "indisponível" em texto cheio, barra de foco tracejada | `seletor-outro-lado-1440-escuro.png` | corrigido |
| C26 | T7 iniciais com 11 px | 12 px (também no c2) | auditoria: nenhum texto abaixo de 12 px | corrigido |
| C27 | T7 "✓" de "atual" com 4,45 e 4,31:1 no claro | Usa `--accent-hover`: 6,08:1 sobre a superfície, 5,48:1 sobre a linha de foco | cálculo dos tokens | corrigido |
| C28 | T8 marcas "sem troca" com 1,44 e 1,77:1 | Contorno tracejado em `--dim` (4,86 / 5,59:1) e rótulos "antiga … recente" | `trocas-nomade-1440-escuro.png`, `cinza-c2-1440.png` | corrigido |
| C29 | T8 marca roxa só no aria-label | A marca mostra "1" ou "2+" e a legenda aparece no painel ("semana sem troca / uma troca / mais de uma"); em cinza as duas se separam pelo texto | `trocas-paddy-1440-claro.png` | corrigido |
| C30 | T8 azul das marcas = azul de cliques | Marcas em violeta; o azul ficou só para o lado B | tabela de cores | corrigido |
| C31 | T8 links dos canais com 20 px a 390 | 44 px | auditoria | corrigido |
| C32 | T8 iniciais 11 px | 12 px | idem C26 | corrigido |
| C33 | T9 "Tamanho do canal" e coluna "B em relação a A" com ▲ de "é maior" | A seta saiu (a coluna mostra a letra do lado maior e a frase "Aldinho: 2,4× os inscritos…"); o bloco "Tamanho do canal" desceu para depois de "Desempenho" | `comparar-direcao-base90-1440-escuro.png` | corrigido (ver nota 3) |
| C34 | T9 lado A em laranja num lugar e bege noutro; A e B iguais em cinza | A areia e B azul em todas as telas, com quadrado e círculo; luminância separada (1,75 / 1,88:1) | `cinza-direcao-1440.png` | corrigido |
| C35 | T9 claro: "descendo" e lado A dois marrons | No claro A é um marrom-oliva escuro `#5C4710` e "descendo" um laranja-avermelhado `#A24509`; os nomes dos canais não são mais coloridos (a letra A/B vem antes do nome) | `comparar-direcao-base90-1440-claro.png`; razão de luminância 1,77:1 entre os dois | corrigido (ver nota 4) |
| C36 | T9 âmbar com dois sentidos (descendo e aviso) | Aviso neutro (círculo cinza com "i", fundo da superfície); âmbar só para descendo, abaixo do normal e parado | captura acima | corrigido |
| C37 | T9 verde reabre o veto | Mantido (como o revisor aceita) e levado ao dono em `REVISAO.md`, Parte E, com a alternativa em cinza; em cinza o sentido sobra por forma e palavra | `cinza-direcao-1440.png` | corrigido (a decisão é do dono) |
| C38 | T9 chip "exemplo" 9 vezes | Uma faixa "exemplo — Os números deste bloco são de exemplo" por bloco; chip por linha só onde o dado é exemplo e o resto do bloco é real (engajamento, base "todos") | `comparar-direcao-todos-1440-escuro.png` | corrigido |
| C39 | T9 chip "exemplo" 4,06:1 na caixa malva | `--muted`: 5,15:1 (escuro), 5,83:1 (claro) | cálculo | corrigido |
| C40 | T9 faixa "estável" a 1,44 / 1,77:1 | Contorno tracejado em `--dim` (4,64 / 5,04:1 sobre o fundo da faixa) | `comparar-direcao-base90-1440-escuro.png` | corrigido |
| C41 | T3 e T9: estados vazios repetidos nos "primeiros dias" | Células vazias com quadradinho e a frase curta (sem pastilha), a explicação inteira fica na caixa de cima | `comparar-direcao-base90-1440-escuro.png` | corrigido |

## "Sugestão"

| Tela, sugestão | Estado e motivo |
|---|---|
| T1 recolher o painel de gráficos do canal cheio (1.040 px antes da lista) | **Não aplicada.** Muda a estrutura da página, não é ajuste; vale pedir ao dono se ele prefere abas acima. |
| T1 canal novo: "0 vídeos" em âmbar ou malva | **Não aplicada.** "0" é um zero real, não ausência; já se distingue do "não medido" pela forma. Âmbar passou a significar "parado", e um canal novo ainda não está parado. |
| T2 caixa de leitura do dia de 55 px | **Aplicada em parte.** Com mouse o gráfico lê o dia ao passar o ponteiro e o texto é "Passe o mouse sobre o gráfico ou use as setas para ler um dia"; a altura da caixa (44 px dos botões) não mudou. |
| T2 dia da semana ("qua 11/09") | Aplicada. |
| T3 "Anterior" desabilitado com 2,36:1 | Aplicada (`--dim`). |
| T3 rótulos "menos" e "mais" nas pontas da régua | Aplicada. |
| T4 "acima" quando os intervalos se tocam | Aplicada: "Fica um pouco acima… as duas faixas quase se tocam, então a diferença é pequena". |
| T5 linha do triângulo até a barra | Aplicada: a marca da mediana agora é um traço na própria barra. |
| T6 estado "não coletada" sem jargão | Aplicada. |
| T6 legenda dos triângulos de "maiores saídas" | Aplicada (legenda de uma linha sob a curva). |
| T6 faixas azuis "trechos revistos" | Aplicada: faixa neutra, com legenda. |
| T7 pastilha "sem vídeos" em malva | Aplicada: contorno neutro. |
| T7 lista "solta" no 1440 | **Não aplicada.** É cosmética; a lista tem a largura do campo e fica por cima, agora sem sobrepor nada. |
| T8 âncora "Ver detalhes" a 390 | **Não aplicada.** Num protótipo de arquivos estáticos a âncora não mostra o ganho; a pergunta é de navegação e vale testar com o código. |
| T8 um só significado para o roxo | Aplicada (violeta = troca de descrição). |
| T9 sugestão "nenhuma" (Leo Khev) e "nenhuma" (barras dos 30 dias) | Sem ação pedida. |
| T9 frase da Leitura rápida cobrindo a 1ª tela a 390 | Resolvida junto do bloqueio B3. |

## Onde discordo ou fiz diferente (o revisor decide)

1. **Nota 1, C6: o revisor pediu "uma pastilha por cartão".** Nas faixas do topo usei só o quadradinho hachurado com uma legenda, porque são 7 células seguidas; nos cartões usei quadradinho mais frase (não a pastilha). Se o revisor ainda acha que é muita hachura (18 quadradinhos iguais na tela "sem dado"), a alternativa é tirar o quadradinho dos cartões e deixar só a frase acima da grade.
2. **Nota 2, C14: "empate: 34 de 35 vídeos também estão em zero".** O vídeo tem 0,1 view por dia, não zero; escrevi "abaixo de 1 view por dia" para não afirmar zero onde há 2 views.
3. **Nota 3, C33: cortar a coluna "B em relação a A".** Não cortei: é a leitura de tamanho aprovada nas rodadas anteriores. Tirei a seta, mantive a letra do lado maior e movi o bloco para depois do desempenho. Se o revisor ainda a vê como "é melhor", o corte é uma linha.
4. **Nota 4, C35: o laranja-avermelhado `#B45309` que o revisor sugeriu para "descendo" no claro** dá 3,93:1 sobre a linha destacada da aba Retenção (texto "−1 ponto"); usei `#A24509` (4,84:1 ali, 5,80:1 sobre a superfície).
5. **Aviso "descer pode ser só idade" em neutro, não em teal.** O revisor citou `--forja`; o teal é a cor da Leitura da forja no resto do sistema e se parece com o verde de "subindo". Usei cinza neutro com o "i".
6. **Cliques estimados em marca clara, não azul.** Para o azul ficar só lado B. É mudança de uma cor que o dono já tinha visto; está na lista de perguntas.
7. **A pergunta do ⓘ do gráfico (C10).** Mantive 28 px com mouse (onde o gráfico lê pelo ponteiro) e 44 px em toque; o revisor mediu só a medida de toque.

## O que não consegui verificar

Leitor de tela, Safari e Firefox (o `popover` do seletor e o `:popover-open`), zoom de 200 a 400%, movimento reduzido, e as fontes da internet (sem rede as capturas usam fontes do sistema e as larguras dos números em mono diferem um pouco).

## Rodada 2 (12/10, noite): o que a segunda conferência deixou aberto

Responde a `REVISAO-UX-2.md` (6 de 9 telas prontas, 3 com ajuste pequeno). Telas já aprovadas (2, 3, 4, 6, 7, 8) não foram tocadas além do item do seletor. Conferência: Playwright por `file://`, 1440 e 390 px, escuro e claro, sem rolagem lateral e sem erro de página em nenhum caso medido; capturas refeitas em `shots/`. Telas aprovadas comparadas pixel a pixel contra a versão anterior (mesma espera de 1,5 s): sem diferença em c2, vídeo (4 casos), comparar-so (3 casos) e na lista aberta do seletor a 1440.

| # | Achado | O que fez | Como conferiu |
|---|---|---|---|
| R1 (C6) | Tela "sem dado": os 10 cartões repetem o quadradinho e "não medido: views por dia e alcance" (18 hachuras, 10 frases) | Os cartões ficam só com título e views. A explicação é uma só, na nota sobre a grade: "Nestes cartões, views por dia e alcance estão não medidos: a coleta diária ainda não rodou para este canal." Os 8 quadradinhos das faixas do topo e a legenda única ficam como estavam | Em 1440 e 390, nos dois temas: 10 cartões, 0 quadradinhos e 0 frases "não medido" dentro deles, 8 quadradinhos na página |
| R2 (C33) | Cabeçalho "B em relação a A" sobre linhas que falam de A em relação a B | Cabeçalho "Diferença" com a nota "o lado maior sobre o menor" (vale para toda linha: cada frase começa pelo canal maior). Legenda do ⓘ e a descrição da tabela para leitor de tela ajustadas | Texto lido das 5 linhas da coluna nos dois temas e nas duas larguras ("Aldinho: +14% de mediana de views", "Lodir Negrini: 2,9× as views por dia de Aldinho", ...) |
| R3 (C35) | No claro, "descendo/parado" `#A24509` colado no laranja "seu canal" `#B8481A` (ΔE 8,6) | `--dir-dn` do tema claro vira ocre `#8A5A00` (o mesmo `--terco-baixo` da maior saída da curva; o escuro não mudou). Medido: ΔE 30,0 do laranja (era 8,6), 22,2 do lado A `#5C4710`, 23,2 do âmbar `#B45309` de aviso. Contraste (texto e marca): 5,55 sobre o cartão, 5,32 sobre o fundo da página, 4,64 sobre a linha destacada da Retenção (linha criada na página para medir), 5,93 da letra branca sobre o quadrado ▼. Mínimo 4,5:1 para texto e 3:1 para marca: passa em todos os fundos onde aparece | Cálculo dos tokens e leitura dos estilos computados na página: "Canal parado há 666 dias", "666 dias", selo "parado", "−3 pontos", quadrado ▼ (canal magro, Retenção, direção, claro). Tabela de cores atualizada acima |
| R4 | Retenção do canal: ±1 ponto saía colorido como "acima/abaixo" | "Na média" é de −2 a +2 pontos de % assistido (a faixa tem 39% ou 40% e 1 ponto sobre 1.000 a 2.300 views é ruído). Dentro dela: cinza, "= na média da faixa (40%), +1 ponto". Cor só de 3 pontos em diante ("+4 pontos acima", "−3 pontos abaixo"). A legenda e o ⓘ dizem a faixa; o destaque de linha ("views acima do normal e % assistido abaixo") também só vale a partir de 3 pontos | No caso cheio, 12 linhas, 4 larguras e temas: 2 "acima" (+4, +3), 1 "abaixo" (−3), 9 "na média" em cinza (de −2 a +2), sem rolagem lateral |
| R5a | Seletor sem Popover API: não abria e lançava erro em `:popover-open` | Detecção de suporte no início (`showPopover` existe e `:popover-open` é seletor válido). Sem a API a lista é a mesma, `position:fixed`, e o cartão do campo é elevado acima do vizinho (classe `cb-aberto`) | Script remove `showPopover`, `hidePopover` e faz `matches(':popover-open')` lançar `SyntaxError`: lista abre nos dois lados, nos dois temas, a 390 × 568, 667, 844 e 1440 × 900; 0 erros de página; 0 opção tapada (`elementFromPoint` no centro de cada opção visível); tocar numa opção escolhe; ↓ abre, ↓ ↓ Enter troca, Esc fecha e retira a elevação |
| R5b | Lista do lado B 15 px fora da janela a 390 × 667 | O campo sobe a página (até 80 px do topo) se faltar espaço, a lista abre para cima quando há menos de 180 px embaixo e mais espaço em cima, e a altura máxima nunca passa do que cabe (piso de 96 px) | Lado B: 390 × 568 termina em 556, 390 × 667 em 655 (era 682), 390 × 844 em 832; lado A: 556, 655, 722; 1440 × 900 em 706. Todos dentro da janela, da esquerda à direita |
| R6a | "estável" no "Longos publicados" com 2 contra 2 | Se nenhum dos dois períodos tem 3 longos, a célula vira "não medido" com o motivo ("2 longos contra 2; precisa de 3 em um dos períodos") e a Leitura rápida diz "não dá para medir o ritmo de publicação" | Caso Leo Khev, 1440: quadradinho hachurado e motivo no lugar do quadrado ＝ |
| R6b | 8 pastilhas malva no caso Leo Khev | Uma faixa só no começo do bloco Desempenho ("Leo Khev tem 2 longos em 90 dias e a conta pede 3: nas 4 linhas abaixo o lado dele fica sem número e sem traço no nicho. Em “Todos os acompanhados” os números aparecem."). As quatro células ficam só com o quadradinho e "não medido"; as 3 pastilhas "sem traço de Leo Khev" saem desse bloco. Sobra 1 pastilha na linha de views da Direção, onde o motivo é outro | Captura `comparar-direcao-menos-de-3-1440-escuro.png` |

**Não fechado, por decisão:** nada ficou aberto dos 6 itens. Sugestões da revisão 2 não pedidas aqui (cinza do "666 dias", régua da taxa de clique, âmbar de maior saída fora da tabela, fundo do cartão do c2 a 390 px) seguem como estavam.
