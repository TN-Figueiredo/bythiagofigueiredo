# Revisão de UX 8 (12/10/2026): tela do vídeo próprio depois do AJUSTES-UX-8

Revisor: revisor-ux-senior. Não editei nenhum mockup. Medi uma CÓPIA da pasta (scratchpad `video-rev8/`; `diff -r` contra a original: sem diferença nos arquivos de código), a cópia da 2ª conferência (`video-rev7/`, o estado que o dono aprovou nos blocos "Taxa de clique deste vídeo" e "Retenção") e uma extração do `HEAD` (`git archive HEAD`, igual ao `headfull/` da rodada anterior). Chromium via Playwright sobre `file://`, fontes e capa do YouTube bloqueadas (rodada determinística), 1440 e 390 px (390 com `hasTouch`/`isMobile`), escuro e claro. Lidos, nesta ordem: REVISAO-UX-7, PLANO-UX-8, AJUSTES-UX-8. Capturas em `ux-revisao-8-shots/`. Navegador fechado.

Nota sobre o estado da pasta: o `canal.js` desta cópia já traz `bordaFinal: true` nas duas séries do canal (comentário "ligado por decisão do dono em 12/10"). O AJUSTES-UX-8 ainda diz "não ligado": está desatualizado nesse ponto, a medida abaixo é do estado ligado.

## Resumo

| Item | Veredito |
|---|---|
| 3. Tela do vídeo com marcas de troca (`video.html`, 9 estados) | **pronto para o dono**. Concordo que está bom o bastante. |
| 4. "Taxa de clique deste vídeo" e "Retenção" (cheio e magro) | **pronto para o dono**: HTML, texto e tamanho idênticos aos da 2ª conferência; 0 pixel (2 de 32 combinações com 1 pixel de antialias) |
| Canal (`?caso=magro`, `?caso=cheio`, `?caso=cheio&aba=retencao`) | **pronto para o dono**: as únicas diferenças são as 4 admitidas; nada mais mudou (provas abaixo) |

N1 a N10, A2, A3, S1, S3: todos resolvidos. Nenhum achado **bloqueia** nem **corrige**. Há 5 **sugestões** novas, nenhuma impede o dono de ver a tela.

**As três coisas que ainda mais pesam no conjunto (todas sugestão)**

1. A faixa de cliques a 390 px lê-se, de relance, como "duas linhas de números com divisórias": o fio de 1 px que liga o número de baixo ao ponto passa ao lado dos números da linha de cima e parece divisória de tabela (S1 abaixo).
2. O aviso "marcas de exemplo: trocas inventadas" é o elemento de MENOR contraste do gráfico (6,18 : 1) e as marcas que ele avisa são o de MAIOR (14,48 : 1; as barras de dado têm 6,72 : 1). Está ao lado das marcas e se lê, mas a hierarquia está invertida (S2).
3. Código morto de pré-visualização (`?borda=sim`) ficou em `a4-comum.js` depois de `bordaFinal` ser ligado de vez (S3). Só higiene.

## Julgamento do PLANO-UX-8 (antes do resultado)

O plano é bom e honesto: aceita N1 a N4 e N6 a N10, mostra o raciocínio de cada divergência e declara o que não toca. Três observações:
- **Aceito as três soluções diferentes das minhas** (N2/N4, N3, N5), com a ressalva da medida logo abaixo. As razões do plano são verdadeiras e as soluções são melhores que as minhas em N2 (a regra "nada se confunde com a hachura aprovada" é do dono) e N3.
- **N5: eu estava errado.** A folga de 2 px que propus não resolve o magro: os dois pontos estão a 10,03 px um do outro e os textos "1" e "<1" têm 7,2 + 14,4 px de largura (meias-larguras 3,6 + 7,2 = 10,8 px, maior que 10,03 mesmo sem folga). A 2ª linha com fio é a saída correta. Retiro a proposta.
- **O que o plano não previu:** a leitura do fio na faixa de duas linhas (S1). O AJUSTES-UX-8 admite "não testei com o dono". Medi: ver S1.
- Fora do plano: o plano mantinha `bordaFinal` desligado por decisão sobre o canal aprovado; depois o dono mandou ligar. Ver item 4(c).

## Item 3. `video.html` com marcas de troca

**Pergunta de quem abre:** "a capa ou o título que troquei funcionou?". **Primeiro olhar (1440, cheio, sem rolar):** vê-se "o que mudou e quando" (losango 1 em 27/09, triângulo 2 em 02/10 sobre o gráfico) e, na linha logo acima do primeiro gráfico (y = 383 px), a resposta escrita: "Trocas deste vídeo: título (1) em 27/09, sem diferença firme; thumbnail (2) em 02/10, taxa subiu. Ver antes e depois". A 390 px essa linha fica em y = 910 px (um pouco abaixo da primeira tela de 900 px); o chip "exemplo" do cabeçalho do cheio está na primeira tela. **Veredito: pronto para o dono.**

### N1 a N10, A2, A3, S1, S3 e `bordaFinal`, um por um (medida minha)

| # | Antes | Agora | Evidência |
|---|---|---|---|
| N1 | corrige | **resolvido** | Linha "marcas de exemplo: trocas inventadas" dentro do SVG, 12 px, acima das marcas, em todos os casos com marca (cheio, magro, recente), 1440 e 390 (`cheio-exemplo-*`, `magro-exemplo-*`). Legenda "troca de título (exemplo)" e "troca de thumbnail (exemplo)". Leitura por teclado: "Título trocado neste dia (troca 1, exemplo)" (27/09), "Thumbnail trocada ... (troca 2, exemplo)" (02/10), "(troca 3, exemplo)" (09/10 em `recente`), magro "sex 25/09 ... (troca 1, exemplo)". Tabela: "◆ título (1, exemplo)". ⓘ: "As marcas são de exemplo: hoje o sistema não registra trocas". Contraste do aviso: 6,18 (escuro) / 7,13 (claro). |
| N2 | corrige | **resolvido** | Escala de cinza (`cinza-trocas-sem-registro-390-escuro.png`, `cinza-trocas-nenhuma-390-escuro.png`): "não registrado" = pastilha de contorno pontilhado de 2 px com losango e triângulo fantasma de contorno; "nenhuma" = caixa de borda contínua com o dígito "0 trocas registradas". Pontilhado contra contínuo e fantasma contra "0" separam sem cor, e as palavras também são diferentes. Sem hachura e sem magenta. Contraste: pastilha "não registrado" texto e borda 6,18 / 7,13; caixa "0" borda 4,97 / 4,84, número 14,48 / 15,76. |
| N3 | corrige | **resolvido** | Ver "N3 em particular". |
| N4 | corrige | **resolvido** | Legenda de "não registrado" (`cheio-semreg-1440-escuro-impressoes.png`): swatch próprio (losango e triângulo fantasma pontilhados), não repete a hachura de "não medido" da linha de cima. Em `nenhuma` não há item (correto: não há marca a explicar). Fantasma contra o cartão 6,18 / 7,13. |
| N5 | sugestão | **resolvido (com a sugestão S1)** | Pontos e números iguais nos 9 estados x 2 larguras x 2 temas: cheio 18/18 (390: 9 fios), magro 2/2 (1 fio), 0 sobreposições. Antes: 9/18 e 1/2. Fio: 1 px, 5,44 (escuro) / 5,04 (claro) contra a faixa. A folga de 2 px que eu propus não bastava (ver plano). |
| N6 | sugestão | **resolvido** | Legenda "cliques estimados do dia"; a frase "a altura do ponto não mede nada" só no ⓘ. Mudança também no canal (admitida). |
| N7 | sugestão | **resolvido** | `?caso=magro&trocas=nenhuma`: "0 trocas registradas desde a publicação, em 10/12/2024". |
| N8 | sugestão | **resolvido** | Faixa do vídeo e do canal usam ponto de milhar. Canal cheio 1440: "1.139" (era "1139"); os outros 13 números não mudaram. |
| N9 | sugestão | **resolvido** | "título (1), sem diferença que se sustente; thumbnail (2), subiu." |
| N10 | sugestão | **resolvido** | Linha "exemplo | Trocas deste vídeo: ..." com o link "Ver antes e depois": só nos estados com marca; link 116 x 44 no toque (390), 116 x 28 com mouse a 1440; Enter leva ao bloco `#trocas` (`scrollY` 1.875 a 1440 e 2.732 a 390; o bloco fica encostado no topo, S4). Na ordem de Tab vem logo depois do cabeçalho, antes do primeiro gráfico. |
| A2 | em parte | **resolvido** | O desenhista cedeu: a frase só no ⓘ. Sem discordância que sobre para o dono. |
| A3 | em parte | **resolvido** | Número em todo ponto, no cheio e no magro, a 1440 e 390 (N5). No canal (não escalonado) ficam 9 números a 390 e 14 a 1440, como já aprovado. |
| S1 | em parte | **resolvido** | Ver N2 e N4. |
| S3 | em parte | **resolvido** | Ver N3. |
| bordaFinal no canal | decisão aberta | **resolvido, ligado** | Ver item 4(c). |

### N3 em particular: marcador sem matiz, só forma, ainda se lê?

**Aceito a solução do desenhista** (e é a primeira que eu propus no N3; retiro a alternativa dos "dois matizes novos"). Medidas:

| Medida | Escuro | Claro |
|---|---|---|
| Marcador (losango, triângulo, linha) contra o cartão | 14,48 | 15,76 |
| Número 12 px dentro do marcador contra o marcador | 15,61 | 15,76 |
| Barras de dado contra o cartão (referência) | 6,72 | 4,94 |
| Tamanho do marcador no gráfico (1440 e 390) | losango 26 x 26, triângulo 26 x 23 | igual |
| Swatch da legenda | 13 x 13 | 13 x 13 |

- **De relance, contra barras, caixas vazadas e hachura:** sim. É o elemento de maior contraste do gráfico, com linha vertical até a barra do dia; a linha para junto do rótulo de valor com um halo (não corta o número). Em escala de cinza (`cinza-imp-magro-exemplo-390-claro.png`, `cinza-imp-*`) o losango e o triângulo continuam inconfundíveis ao lado das caixas vazadas e da hachura de "não medido" (que têm outra geometria e ficam na base).
- **Só pela forma, a 390 px e a 12 px:** basta. Forcei o swatch da legenda a 12 px, a 1x, claro e escuro (`leg12-*.png`, `leg12-*-x3.png`): losango e triângulo se distinguem. No gráfico, a 390, as marcas têm 26 px e carregam o número da ordem dentro. Dois itens da legenda no mesmo tom (losango, triângulo) e o círculo de "cliques estimados" no mesmo tom: separados por forma e por lugar (topo, faixa).
- **Colisão de cor:** não há mais cor para colidir (token `--tr` = tom de texto, 0 matiz). O tom é o mesmo dos pontos de cliques (`--im-cl`), declarado e coerente: neutro por desenho.
- **Ressalva (S2):** um tom neutro de contraste máximo para uma marca inventada deixa o aviso de exemplo como o elemento mais fraco do gráfico.

### Estado padrão e honestidade: o dono entende em 5 segundos que as marcas são inventadas?

`video.html` (sem parâmetros) é `?caso=cheio` com `trocas=exemplo`. Medi cada caso e olhei a captura de 1440 e de 390 nos dois temas:

| Caso | O que diz "exemplo" na primeira vista | Veredito |
|---|---|---|
| Cheio, 1440 | chip "exemplo" no cabeçalho do vídeo; chip + "Trocas deste vídeo: ..." na linha acima do gráfico; "marcas de exemplo: trocas inventadas" dentro do gráfico, acima das marcas; legenda "(exemplo)". Quatro avisos sem rolar. | sim |
| Cheio, 390 | chip "exemplo" no cabeçalho na primeira tela; nas marcas, o aviso dentro do gráfico e a legenda. | sim |
| Magro (vídeo real), 1440 | chip + linha "Trocas deste vídeo: título (1) em 25/09, ainda não dá para dizer" na primeira tela; aviso "marcas de exemplo: trocas inventadas" dentro do gráfico de views e do de impressões; bloco: "Esta seção mostra como ficaria, sobre um vídeo real; a troca e a capa de antes são inventadas". | sim |
| Magro, 390 | a primeira tela (900 px) não tem marca nem aviso; a linha com chip fica em y = 914 e o gráfico com o aviso logo abaixo. | sim (a marca nunca aparece sem o aviso) |
| Novo (menos de 3 dias) e sem dado | sem marca; bloco com a pastilha "não registrado"; sem-dado: "Impressões e cliques: não medido ... Nenhum deles é zero". | sim |

**`?trocas=sem-registro` (o estado de hoje) contra `?trocas=nenhuma`, sem cor:** se distinguem (N2). Nos gráficos: sem-registro tem item de legenda com marcas fantasma; nenhuma não tem. Na leitura por teclado e na tabela nenhum dos dois cita troca nem tem coluna "Troca".

**`?caso=cheio&trocas=recente`:** a troca 3 (09/10) diz "ainda não medido" em quatro lugares: linha acima do gráfico ("título (3) em 09/10, o depois ainda não foi medido"), frase-resumo, pastilha "? depois ainda não medido" (hachura de "não medido", 7,76 / 7,40 de contraste do texto) e caixa "Depois: ainda sem dia medido ... não medido: ainda sem dia fechado". Busquei por texto: nenhuma ocorrência de "0 impressões", "0 cliques" ou "0,0%". Nunca zero.

### Achados novos (todos sugestão)

| # | Sev. | Tela e estado | Achado | Evidência | Conserto |
|---|---|---|---|---|---|
| S1 | sugestão | cheio e magro, 390, faixa de cliques | A faixa de duas linhas lê-se, num primeiro olhar, como duas fileiras de números com divisórias: o fio de 1 px do número de baixo passa ao lado dos números da linha de cima (`z-cheio-390-escuro-svg-imp.png`). Para ler em ordem de dia é preciso ziguezaguear. Todo número tem fio e ponto, então não é erro, é custo de leitura. | `z-cheio-390-*-svg-imp.png`: fio 1 px, 5,44 / 5,04 contra a faixa, de y 227 a 243, ou seja, atravessa a altura da linha de números de cima | Deslocar os números da linha de cima 14 px para baixo, ou fazer o fio do número de baixo começar só abaixo da linha de cima; ou deixar como está e ver com o dono. Pode ficar para a implementação. |
| S2 | sugestão | gráficos com marca de exemplo | O aviso "marcas de exemplo: trocas inventadas" (`--muted`, 12 px, 6,18 / 7,13) é o texto de menor contraste do gráfico; a marca que ele avisa é o de maior (14,48 / 15,76). Está colado nas marcas e se lê, mas a hierarquia está invertida. | `contrast.js`, tabela de medidas | Aviso em `--text` (peso 500), ou a mesma pastilha de contorno tracejado do chip "exemplo". |
| S3 | sugestão | `a4-comum.js` | `q.get('borda') === 'sim'` (interruptor de pré-visualização do plano) ficou depois de `bordaFinal` ser ligado nas duas chamadas do canal; é código morto e o plano a remover. | `grep` na linha 167 | Apagar a condição `|| q.get('borda') === 'sim'`. |
| S4 | sugestão | "Ver antes e depois" | O bloco `#trocas` fica encostado no topo da janela (`top` = 0 px) depois do salto e o foco não vai para ele. | `f.js`: `scrollY` 1.875 / 2.732, `#trocas.top` 0, foco no `BODY` | `scroll-margin-top: 16px` no bloco; o foco no título da seção (`tabindex="-1"`), como já se faz em `#vt`. |
| S5 | sugestão (pré-existente, não é desta rodada) | `video.html` cheio, gráficos por dia | A linha tracejada "dia da publicação" cruza o rótulo "9.066" (primeira barra de views e de impressões). Igual no `HEAD`. | `head-cheio-imp-pub-crop.png` | Halo no rótulo ou o rótulo deslocado 4 px para a direita quando coincide com a linha. |

## Item 4. Regressão (por conta própria)

**Veredito: pronto para o dono.** Só as quatro mudanças admitidas, nada mais.

### Blocos do vídeo contra a 2ª conferência (`video-rev7/`)

"Taxa de clique deste vídeo" (`.ctr`) e "Retenção" (seção), cheio e magro, 1440 e 390, claro e escuro, em dois modos (`video.html?caso=X` e `&trocas=sem-registro`) = 32 pares:
- HTML (hash MD5 do `outerHTML`): **igual em 32 de 32**.
- Texto (`innerText`): **igual em 32 de 32**. Tamanho (largura x altura): **igual em 32 de 32**.
- Pixels (captura por elemento, diferença > 30/255): **0 em 30 de 32; 1 pixel em 2** (Retenção do cheio, 390, padrão, escuro e claro: antialias de meio pixel).

### Canal contra o `HEAD` (as 3 telas x 1440 e 390 x claro e escuro = 12 combinações)

Método: marca de cliques (faixa, rótulo, pontos, números, fios) e o item de legenda dela escondidos nos dois lados; 30 blocos por tela fotografados por elemento; SVG recortado na altura do `HEAD`; comparação pixel a pixel.

1. **Estrutura:** os 30 blocos têm a mesma assinatura (tag e classe) em 12 de 12.
2. **SVG "Impressões por dia do canal" e "Views por dia, soma dos vídeos":** a única região diferente em 12 de 12 é a **última data do eixo**: a 1440, x de 663 a 698, y de 186 a 195 (35 x 10 px); a 390, x de 288 a 322, y de 146 a 155. 100 a 190 pixels; nenhuma barra, caixa, hachura, valor ou linha de grade muda. (A 390 o SVG de views mede 161 contra 162 px por arredondamento de posição; alinhado, mesma região.)
3. **Resto da página:** idêntico, exceto 4 pixels de antialias no ⓘ de "Taxa de clique" a 390 em 2 de 12 (já declarado; variação máx. 33/255) e o `DIV` que contém o gráfico, 28 px mais alto a 1440 (a faixa de 48 px entra; admitido (d)).
4. **Texto:** a diferença de texto entre `HEAD` e a cópia são os rótulos da faixa ("cliques estimados por dia"), a legenda ("cliques estimados do dia") e os números; o ⓘ dos gráficos de impressões troca "Bolinha e número embaixo: cliques estimados do dia" por "Todos os pontos ficam na mesma linha: a altura não mede nada" (consequência da faixa, já declarado na 2ª conferência). Os ⓘ da cópia e do `rev7` são IGUAIS.
5. **Altura da página** (`scrollHeight`): `HEAD` 2.611 / 2.591 / 2.658 a 1440 e 4.302 / 4.379 / 4.895 a 390; cópia 2.639 / 2.619 / 2.686 e 4.330 / 4.407 / 4.923: **+28 px em todas** (a faixa). Contra o `rev7`: igual a 1440 e 40 px mais baixa a 390 (legenda de uma linha a menos: N6).
6. 390 sem rolagem lateral nas 12; sem erro de página.

### Contra a 2ª conferência (`rev7`), SVGs do canal, 24 pares

Diferença em todos os pares só na última data do eixo (as mesmas regiões acima) e, no canal cheio a 1440, o número "1.139" (x 305, y de 237 a 243). Nada mais.

### As mudanças admitidas, uma por uma

| | Mudança | Confirmado |
|---|---|---|
| (a) | legenda da faixa perdeu "(a altura do ponto não mede nada)" | sim: `rev7` "cliques estimados do dia (a altura do ponto não mede nada)" para "cliques estimados do dia", nas 6 telas; é a única linha de texto que muda do `rev7` além de (b) |
| (b) | "1139" virou "1.139" | sim, 1 número (canal cheio 1440, aba padrão e Retenção); a 390 o número não aparece |
| (c) | `bordaFinal` ligado no canal | **só a última data se move**: a 1440, 2,4 px para a esquerda (HEAD: borda direita do rótulo a 700,4 de 699, 1,4 px fora; agora a 698 de 699, dentro); a 390, 8,6 px (HEAD: 331,6 de 324, 7,6 px fora; agora a 323 de 324). Vão até o vizinho: 1440 imp. 67,7 px, views 31,5 px; 390 imp. 25,1 px, views 42,3 px; magro 1440 54,4 / 35,2 px; 390 56,4 / 52,3 px (`HEAD` entre 33,0 e 70,1 / 33,7 e 64,4). Não colide com o vizinho em nenhuma. O rótulo final fica ~2 a 9 px à esquerda do centro da última barra (barra de 10/10 "não medido"): aceitável, é o preço do conserto. |
| (d) | faixa de cliques sob as datas | já aprovada na 2ª conferência; +28 px na página; mesmos números, exceto (b) |

## Item 5. Regra da casa

- **`color-mix()`:** 3 ocorrências em `a4.css`, todas em comentário; 0 em `a4-comum.js`, `video.js`, `canal.js`, `a4-dados.js`, `video.html`, `canal.html`.
- **Texto >= 12 px:** 0 elementos abaixo de 12 px em 36 combinações do vídeo (9 estados x 2 larguras x 2 temas), medido por `getComputedStyle` em HTML e SVG.
- **Alvo de 44 px a 390 (toque):** 0 alvos abaixo de 44 x 44 nas 18 combinações de 390; a 1440 (mouse) os compactos de 28 px (ⓘ, links de legenda, "Ver antes e depois") são os mesmos já aprovados.
- **390 sem rolagem horizontal:** `scrollWidth` = largura nas 36 combinações do vídeo e nas 12 do canal; 0 textos de SVG cortados; erros de página 0 (as únicas mensagens são as requisições bloqueadas por mim).
- **Claro e escuro:** verificados em tudo acima. Teclado: Tab em ordem lógica, foco visível 2 px (laranja da marca, `rgb(255,130,64)` / `rgb(184,72,26)`), Home e setas leem dia a dia, ⓘ abre e Esc fecha devolvendo o foco ao botão.
- **Movimento reduzido:** o ajuste não cria animação; não testei com a preferência ligada.

## Medidas

| Elemento | Escuro | Claro | Mínimo |
|---|---|---|---|
| Marcador / linha vertical contra o cartão | 14,48 | 15,76 | 3 |
| Número dentro do marcador (12 px) | 15,61 | 15,76 | 4,5 |
| Aviso "marcas de exemplo" (12 px) | 6,18 | 7,13 | 4,5 |
| Chip "exemplo" (texto / borda tracejada) | 6,18 / 4,86 | 7,13 / 5,59 | 4,5 / 3 |
| "decisão sua" (texto e borda) | 7,81 | 6,12 | 4,5 / 3 |
| "não registrado" (texto / borda pontilhada) | 6,18 / 6,18 | 7,13 / 7,13 | 4,5 / 3 |
| Marcadores fantasma da legenda | 6,18 | 7,13 | 3 |
| "0 trocas registradas" (borda / número) | 4,97 / 14,48 | 4,84 / 15,76 | 3 / 4,5 |
| "? depois ainda não medido" (texto) | 7,76 | 7,40 | 4,5 |
| Fio da 2ª linha de números (1 px) | 5,44 | 5,04 | 3 |
| Rótulo, número e ponto da faixa de cliques | 6,18 / 14,48 / 14,48 | 7,13 / 15,76 / 15,76 | 4,5 / 4,5 / 3 |
| Barra de dado (referência) | 6,72 | 4,94 | 3 |

| Medida de layout | Valor |
|---|---|
| Marcador no gráfico | losango 26 x 26, triângulo 26 x 23 |
| Swatch de legenda | 13 x 13 |
| Linha "Trocas deste vídeo" (N10), y | 383 px (1440), 910 / 914 px (390) |
| Link "Ver antes e depois" | 116 x 44 (toque), 116 x 28 (mouse) |
| Pontos x números da faixa | 18 x 18 (cheio), 2 x 2 (magro); 0 sobreposições; fios a 390: 9 e 1 |
| Alvos de toque a 390 abaixo de 44 | 0 |
| Texto abaixo de 12 px | 0 |
| `scrollWidth` | = largura em 48 de 48 |

## Discordâncias que sobram para o dono

**Nenhuma entre mim e quem desenhou.** A2 cedida pelo desenhista; N2, N3 e N5 resolvidos por soluções diferentes das minhas, que aceito (N5: eu estava errado).

**Decisões que são DO DONO**, independentes de nós:
1. As duas regras de exemplo: **mínimo de 100 impressões por lado** e **janela de até 7 dias antes e 7 depois** da troca (texto "decisão sua" no bloco "Trocas deste vídeo").
2. `bordaFinal` no canal: ele já mandou ligar (12/10); fica confirmado só ver o antes e depois na última data.

## O que NÃO consegui verificar

- Leitor de tela (a leitura por teclado foi lida do texto do `role="status"`, não ouvida).
- Opera, Safari, Firefox (só Chromium; `clip-path` dos marcadores da legenda e `:popover-open` só vistos no Chromium).
- Movimento reduzido ligado.
- Fontes reais (Fraunces, Inter, JetBrains Mono): bloqueadas para a rodada ser determinística. O desenhista usou 7,2 px por caractere para a mono a 12 px; com a fonte real a largura pode mudar 1 px e mudar quais números cabem em cada linha (S1).
- Dado real: tudo é exemplo; não existe registro de trocas de vídeo próprio e não consultei banco algum.
- Se o dono lê o aviso de exemplo "em 5 segundos": medi onde ele está e seu contraste; não testei com ele.

## Roteiro de 30 segundos para o dono (abrir os arquivos a partir de `docs/superpowers/mockups/2026-10-12-a4-proprio-e-ajustes/`)

1. `video.html` (padrão: vídeo cheio com trocas de EXEMPLO). Em 5 s: ache a linha "exemplo | Trocas deste vídeo: título (1) ...; thumbnail (2) ..., taxa subiu" e, no gráfico, o losango 1 (27/09) e o triângulo 2 (02/10) com o aviso "marcas de exemplo: trocas inventadas" logo acima. Olhe a faixa sob as datas (um ponto por dia, número embaixo). (10 s)
2. Clique em "Ver antes e depois" (ou desça até "Trocas deste vídeo"): leia "decisão sua" e responda as duas decisões: **100 impressões por lado é o mínimo certo? janela de 7 dias antes e 7 depois é a certa?** Veja a frase-resumo e a troca 2 com "taxa subiu". (10 s)
3. O estado de HOJE (não existe registro de trocas): `video.html?caso=cheio&trocas=sem-registro`. Sem marca no gráfico, pastilha pontilhada "◇△ não registrado". Compare com o futuro sem troca: `video.html?caso=cheio&trocas=nenhuma` ("0 trocas registradas"). (5 s)
4. Caso fraco, vídeo real: `video.html?caso=magro` ("ainda não dá para dizer", 1 e 9 impressões). Troca de ontem: `video.html?caso=cheio&trocas=recente` (troca 3: "ainda não medido", nunca zero). (5 s)
5. A 390 px (janela estreita ou celular): `video.html` e `canal.html?caso=cheio`; olhe a última data do eixo (agora inteira) e a faixa de números. (opcional)

Já aprovados e sem mudança desde a 2ª conferência: "Taxa de clique deste vídeo" e "Retenção" (`video.html` e `video.html?caso=magro`), e o canal (`canal.html?caso=magro`, `?caso=cheio`, `?caso=cheio&aba=retencao`), com as quatro mudanças acima.
