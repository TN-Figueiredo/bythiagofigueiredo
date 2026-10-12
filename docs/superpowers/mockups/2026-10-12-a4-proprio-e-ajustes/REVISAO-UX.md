# Revisão de UX: mockups da A4 e dos ajustes (12/10/2026)

Revisor: engenheiro sênior de frontend e UX, sem participação no desenho. Método: Playwright por `file://`, 1440 e 390 px (390 com toque), escuro e claro, todos os estados; 92 capturas em `ux-revisao-shots/`; contraste calculado com as cores lidas da página (WCAG); alvos, fontes e transbordo medidos por script; escala de cinza simulada (`cinza-*.png`); teclado e toque exercitados de verdade (seletor, passo do gráfico, popover). Script e medidas brutas estão no scratchpad (`ux-revisao/`). Nada foi editado nos mockups.

## Resumo

| Veredito | Telas |
|---|---|
| Pronto para o dono | 1 (6. retenção, a curva) |
| Volta para ajuste | 8 (1, 2, 3, 4, 5, 7, 8, 9) |
| Reprovado | 0 |

Achados "bloqueia" (não vão ao dono assim):

1. **c1-seletor, 390 px, lista aberta:** o cartão do Lado B pinta por cima da lista do Lado A; a opção "Thiago Figueiredo" (sem vídeos) não pode ser tocada (`elementFromPoint` no centro dela devolve o cartão B).
2. **video.html?caso=novo:** a tela se contradiz. Cabeçalho "4,43 mil views, publicado há 20 dias, 1,3×" e "% assistido 43%, baseado em 4.426 views", mas as seções dizem "vídeo novo: com menos de 3 dias de vida, ainda não há dia fechado".
3. **comparar-direcao, Leitura rápida:** diz "Aldinho está descendo: caíram 19%" com quadrado âmbar e sem a ressalva da idade, que só aparece 400 px abaixo, e não leva a marca "exemplo" (os 34% e 19% são exemplo). A frase afirma mais do que o dado sustenta, na linha que o dono vai ler primeiro.

As três coisas que mais derrubam o conjunto:

1. **Conversa de projeto dentro da tela.** Em quase todas as telas há texto de quem desenha, não de quem usa: "seguem como no mockup aprovado (rodada 7 / 8)", "decisão do dono", "Duas linhas novas na tabela aprovada", "tabela e rotina que ainda não existem", "alvo de 44 px" (dentro do ⓘ do gráfico), "Antes da A4, o seu lado desta linha era não medido". A REVISAO.md (A.2-4) já reprovou isso na tela implementada e o mockup refaz o erro.
2. **A mesma cor com vários significados e informação só por cor.** Lado A é laranja em `c1-seletor` e `comparar-so-seu-canal`, mas bege em `comparar-direcao`. Azul é "cliques estimados", "lado B" e "semana com troca". ▲ é "subindo" e "é maior". Âmbar é "descendo" e é o aviso "Descer pode ser só idade". Roxo (semana com mais de uma troca) só existe no `aria-label`. No tema claro, "descendo" (`#92400E`) e o lado A (`#7A5C14`) viram dois marrons quase iguais. Marcas "sem troca" e a faixa "estável" têm 1,4 a 1,8:1 de contraste.
3. **O dado magro e os estados vazios dizem mais do que sabem ou repetem demais.** "2º de 35" para 0,1 view por dia e "3º de 4" logo abaixo de "com tão poucas views não dá para comparar"; "Você não teve views por dia" ao lado de 7 views no canal; o grupo "mediana 0" que vira posição. E no caso sem dado, a mesma pastilha malva "sem leitura / sem relatório" aparece 20 vezes só na grade e as três palavras de ausência ("sem relatório", "sem leitura", "não coletada") não são explicadas.

Fora das três: alvos de toque a 390 px (ⓘ do gráfico 36 px, "Todos os números" 19 px, "Comparar com…" 34 px, links de breadcrumb 20 px) e a aba Retenção do canal a 390 px, que corta a coluna que responde à pergunta ("Contra a faixa").

---

## 1. canal.html: página do canal próprio (magro, cheio, sem dado, novo; aba Retenção)

**Pergunta do usuário:** "Como está o meu canal e o que mudou?" No caso real dele (parado): "o canal está vivo?".

**Veredito: volta para ajuste.**

**Achados**

| Sev. | Estado | Achado | Evidência | Conserto |
|---|---|---|---|---|
| corrige | magro (o caso real) | O dado mais importante do canal parado, "666 dias desde o último vídeo", tem o mesmo peso dos outros cinco números da faixa (mesma fonte, mesma cor). A resposta a "o canal está vivo?" não é o que mais chama atenção. | `canal-magro-1440-escuro.png`, faixa superior | Dar à célula "desde o último vídeo" o único destaque da faixa quando passar de um limite (cor de aviso + a palavra "parado"), e pôr a frase-resumo "Canal parado há 666 dias; 140 impressões em 29 dias" acima da faixa. |
| corrige | todos | Texto de projeto na tela: "“No nicho” e “Comparar com…” seguem como no mockup aprovado (rodada 7)." e "A lista, a ordenação e os filtros seguem o mockup aprovado." | todas as capturas de canal | Tirar da tela. Se precisar ficar, vai na barra "Estados do mockup", fora do `.scr`. |
| corrige | magro e cheio, 1440 e 390 | A hachura "não medido" tem a altura do eixo inteiro (80 de 80) e é o elemento mais alto e mais contrastado do gráfico; a barra real de 71 impressões fica do mesmo tamanho dos "buracos". Dez dias de hachura gritam mais que os 140 dados. Em cinza (`cinza-canal-magro-1440.png`) o gráfico lê "faltou dado" antes de "pouco dado". | hachuras 100% da altura; 10 de 29 dias | Hachura com altura fixa baixa (uma faixa de 24 px na base, ou 25% do eixo) e linha tracejada até o topo só no foco. |
| corrige | magro, 390 | No gráfico da taxa de clique, os rótulos "0,7%" e "6,1%" ficam dentro da barra e o ponto de 2,1% cai em cima de "6,1%" ("0,7%●6,1%"). | `canal-magro-passo-390-escuro.png` | Rótulos fora da barra (abaixo, nas pontas) e o valor 2,1% acima do ponto. |
| corrige | 390, todos | "Todos os números" mede 132 × 19 px; "Comparar com…" 132 × 34 px; breadcrumb "Canais" 42 × 20 px; título do vídeo na lista 250 × 18 px (toque). | tabela de medidas | `min-height: 44px` em ponteiro grosso, como já foi feito nos botões de passo. |
| corrige | sem dado, 1440 | A pastilha malva "sem leitura / sem relatório" aparece 2 vezes por cartão × 10 cartões e mais 7 na faixa do topo: cerca de 27 pastilhas quase idênticas. A cor do estado "não medido" está certa, mas o bloco virou parede. As duas palavras também não se distinguem para o dono. | `canal-sem-dado-1440-escuro.png` | Uma pastilha por cartão ("sem relatório de alcance") e uma só palavra para a ausência em toda a tela; a frase de motivo já existe acima da faixa. |
| corrige | sem dado | "Relatório de alcance" é termo do sistema; o dono não tem esse nome para o que o YouTube entrega. | texto "O relatório de alcance deste canal ainda não foi baixado" | "Os números de alcance (impressões e cliques) deste canal ainda não chegaram." |
| corrige | aba Retenção, 390 | A tabela (462 px) corta a coluna "Contra a faixa", justamente a que diz se o vídeo está acima ou abaixo; os títulos viram colunas de 6 letras. Não há dica de rolagem lateral. | `canal-cheio-retencao-390-claro.png` | No 390, cada vídeo vira um cartão de duas linhas (título + barra + "4 pontos acima"); a tabela fica só no 1440. |
| corrige | aba Retenção, 1440 | A frase "1 vídeo tem views acima do normal e % assistido abaixo do normal da faixa" não marca qual é; a coluna "Contra a faixa" é texto cinza em todas as linhas e a barra de % assistido é laranja idêntica em 36% e 43%: bloco monocromático (reprovado pelo dono). | `canal-cheio-retencao-1440-escuro.png` | Cor e seta na coluna "Contra a faixa" (acima / igual / abaixo, com o símbolo), a linha do vídeo apontado pela frase destacada, e a barra com a marca da mediana da faixa como na página do vídeo. |
| sugestão | cheio, 1440 | O bloco "Como o canal está" tem 1.040 px de altura; a lista de vídeos (a pergunta seguinte) só começa em y = 1.390. | `canal-cheio-1440-escuro.png` | Recolher os gráficos de views por dia por padrão ou pôr as abas acima. |
| sugestão | novo | Bem resolvido (página mínima, frase clara, botão de saída). Só falta a contagem "0 vídeos" ficar em âmbar ou malva para diferenciar de "0 medido". | `canal-novo-1440-escuro.png` | idem |

**Medidas**

| Item | Escuro | Claro | Regra |
|---|---|---|---|
| Menor contraste de texto lido da página (todos os estados) | sem falha ≥ 4,5:1 | idem | 4,5:1 |
| Barra de impressões (`lado-o`) sobre a superfície | 6,72:1 | 4,94:1 | 3:1 |
| Caixa vazada "zero medido" (`im-zero`) | 4,97:1 | 4,84:1 | 3:1 |
| Borda da hachura "não medido" (`nm-line`) | 4,09:1 | 4,57:1 | 3:1 |
| Rolagem horizontal da página a 390 px | nenhuma (390/390) | nenhuma | sem rolagem |
| Botões dia anterior / seguinte a 390 px | 44 × 44 px | | 44 px |
| ⓘ do gráfico (`ibtn.compacto`) no toque | 36 × 36 px | | 44 px |
| Texto menor que 12 px | nenhum | | 12 px |
| Escala de cinza | legível (hachura, caixa e barra se separam pela forma) | | |

---

## 2. Gráfico de impressões por dia (zero como caixa vazada; passo a passo a 390 px)

**Pergunta do usuário:** "Em que dias o canal apareceu, e nos outros, foi zero ou faltou medir?"

**Veredito: volta para ajuste** (a mecânica funciona; faltam a correção do ⓘ e o peso da hachura).

O que está certo, medido: a caixa vazada se separa da barra mínima pela forma (e pela cor, 4,97:1); em cinza continua legível; o passo funciona por toque (1º toque cai em 09/09, o 3º em "11/09: relatório ainda não baixado (não medido)"), o dia lido ganha um retângulo laranja que atravessa o eixo, setas, Home e End funcionam (End: 07/10, Home: 09/09), o botão "dia anterior" desabilita no início, a página não rola de lado e os botões medem 44 × 44 px.

| Sev. | Achado | Evidência | Conserto |
|---|---|---|---|
| corrige | O ⓘ do gráfico, o único jeito de saber o que é "caixa vazada" e "hachura", mede 36 × 36 px no toque (REVISAO.md diz 44). | `ibtn.compacto` 36 × 36 a 390 px | 44 × 44 no ponteiro grosso. |
| corrige | O texto do ⓘ fala do mockup: "Os botões abaixo do gráfico leem um dia por vez, com alvo de 44 px; as colunas continuam clicáveis para quem usa mouse." | `canal-magro-info-390-escuro.png` | "Use os botões abaixo do gráfico para ler um dia de cada vez." |
| corrige | A hachura "não medido" ocupa a altura inteira do eixo e vence as barras de dado em peso visual (ver achado 3 da tela 1). | `canal-magro-1440-escuro.png` | Hachura baixa. |
| corrige | Pelo teclado, quando o foco está em "dia anterior" e o botão vira `disabled` no 1º dia, o foco se perde. | `disabled` aplicado no início | `aria-disabled="true"` mantendo o foco no botão, ou mover o foco para "dia seguinte". |
| sugestão | A caixa com "Use os botões ou as setas para ler um dia." tem 55 px de altura e a frase de instrução some só depois do 1º toque; a 1440 ocupa uma faixa escura vazia. | `canal-magro-1440-escuro.png` | Em 1440 mostrar só "Passe o mouse ou use as setas" em uma linha de 20 px. |
| sugestão | O rótulo de dia é do tipo "11/09: ..." sem dia da semana; o dono vê "dias em que apareceu" e o fim de semana importa para um canal pequeno. | texto de `.ic-out` | "qua 11/09". |

---

## 3. video.html: página do vídeo próprio (cheio, magro, sem dado, novo)

**Pergunta do usuário:** "Como foi este vídeo, e a capa e o conteúdo seguraram quem viu?"

**Veredito: volta para ajuste.**

| Sev. | Estado | Achado | Evidência | Conserto |
|---|---|---|---|---|
| bloqueia | novo | Estado contraditório (resumo, item 2). O "caso novo" reaproveita os números do vídeo cheio. | `video-novo-1440-escuro.png` | O caso novo precisa de vídeo de 1 a 2 dias: views, curtidas e comentários pequenos, "há 1 dia", razão 1,3× em "não medido" e sem "% assistido 43%". |
| corrige | magro | "Este vídeo no canal" põe 0,1 view por dia em "2º de 35", e % assistido em "3º de 4", enquanto a seção de cima diz "Com tão poucas views, não dá para comparar". Uma posição desenhada por 0 e 0,1 view é empate de zeros, não colocação. | `video-magro-1440-escuro.png`, final | Abaixo do mínimo de views/dia (e do mínimo de 10 views), trocar a posição por "empate: 34 de 35 vídeos também estão em zero" e sem marcador laranja. |
| corrige | todos | Texto de projeto na tela: "Duas linhas novas na tabela aprovada…", "A leitura da forja… seguem como no mockup aprovado (rodada 8)", etiqueta "decisão do dono" no título da taxa de clique, e "(tabela e rotina que ainda não existem)" na seção Retenção. | capturas de vídeo | Tirar. "A curva ainda não é coletada. Quando for, esta seção mostra onde as pessoas saem e onde voltam." |
| corrige | sem dado, magro | "sem leitura / sem relatório / não coletada / vídeo novo" são quatro pastilhas malva iguais, com 4 palavras para ausência, e a pastilha ocupa a mesma linha da frase, dando linhas em duas alturas. | `video-sem-dado-1440-escuro.png` | Pastilha curta e frase na linha de baixo, como já foi proposto para o canal (REVISAO.md, A.2-3). |
| corrige | 390 | Alvos: ⓘ do gráfico 36 px; breadcrumb 42 × 20 px e "tnFigueiredo" 77 × 20 px; "Próximo" 81 × 30 px (1440). | medidas | 44 px no toque. |
| sugestão | cheio | "Anterior" desabilitado tem 2,36:1 (escuro) e 2,49:1 (claro). Desabilitado é isento, mas some. | `span.d` | Usar `--dim`. |
| sugestão | cheio | Em "Este vídeo no canal" os traços não têm rótulo de extremidades ("menos" / "mais"); só o "1º de 12" diz para que lado é bom. | `video-cheio-1440-escuro.png` | Rotular as pontas. |

**Medidas**

| Item | Valor |
|---|---|
| Contraste de texto (menor, exceto "Anterior" desabilitado) | ≥ 4,5:1 nos dois temas |
| Rolagem horizontal a 390 px | nenhuma (4 casos × 2 temas) |
| Botões de passo | 44 × 44 px |
| ⓘ do gráfico | 36 × 36 px |
| Altura da página a 390 px (cheio) | 3.517 px |

---

## 4. Taxa de clique em percentual (canal, vídeo, comparar-so-seu-canal)

**Pergunta do usuário:** "A capa está funcionando?" (no canal parado: "quantos viraram clique, e dá para confiar?")

**Veredito: volta para ajuste.**

O desenho com intervalo e veredito honesto ("Ainda não dá para dizer se é alta ou baixa") é a decisão certa e a frase-resumo do canal é a melhor frase do conjunto.

| Sev. | Achado | Evidência | Conserto |
|---|---|---|---|
| corrige | No vídeo magro o intervalo "3,1% a 32,8%" é a barra laranja mais larga e mais saturada da página, para um dado que a própria frase diz que não conclui nada. O peso visual contradiz o texto. | `video-magro-1440-escuro.png` | Quando o intervalo for mais largo que, por exemplo, 3 vezes o canal, pintar a barra com o tom "não conclusivo" (cinza/malva, contorno tracejado), mantendo o laranja só para intervalos estreitos. |
| corrige | A 390 px os rótulos do intervalo colidem com o ponto ("0,7%●6,1%"). | `canal-magro-passo-390-escuro.png` | Rótulos para fora da barra. |
| corrige | O veto de 09/10 é reaberto na tela com a etiqueta "decisão do dono" colada no título. Isso é pergunta ao dono, não texto de interface. | `video-magro-1440-escuro.png` | Tirar da tela e deixar a pergunta só no REVISAO.md. |
| corrige | "Você não teve views por dia nos 28 dias; Leo Khev tem 0,2" (comparar-so) fica ao lado do número "7 views em 26 dias" do mesmo canal. É a mediana por vídeo, mas a frase diz o canal. | `comparar-so-1440-escuro.png` | "A mediana dos seus vídeos é 0 views por dia; a de Leo Khev é 0,2." |
| corrige | "Uma das treze linhas. Antes da A4, o seu lado desta linha era “não medido”." é nota de projeto. | idem | Tirar. |
| sugestão | No vídeo cheio, "Fica acima da taxa do canal (4,6% a 4,8%)" com o ponto do vídeo em 4,8% a 5,2%: os intervalos se tocam em 4,8%. A frase "acima" é arriscada; "levemente acima" ou "no limite" seria honesto. | `video-cheio-1440-escuro.png` | Reescrever a frase quando os intervalos se tocarem. |

**Medidas:** barra do intervalo no canal magro: 0,7% a 6,1% (ocupa 54% da régua 0-10%); no vídeo magro, 3,1% a 32,8% (73% da régua 0-40%). Contraste da barra laranja sobre a superfície: 6,72:1 (escuro), 4,94:1 (claro). Texto: sem falha.

---

## 5. % assistido

**Pergunta do usuário:** "Quem abre o vídeo vê até onde? Está acima ou abaixo do normal do canal?"

**Veredito: volta para ajuste.**

O desenho no vídeo (barra com o tamanho do vídeo, marca "mediana do canal: 39%", "Acima do normal do canal (39%)") é claro e responde em um olhar. O problema está na aba Retenção do canal e no magro.

| Sev. | Achado | Evidência | Conserto |
|---|---|---|---|
| corrige | Aba Retenção: tabela monocromática, sem destaque do vídeo que a frase acima aponta, e cortada a 390 px (ver tela 1). | `canal-cheio-retencao-1440-escuro.png` / `...390-claro.png` | Ver tela 1. |
| corrige | Magro: "25%" aparece em laranja cheio no vídeo e na faixa do canal ("só 7 views: pouco para uma média"); a cor de destaque da tela é dada a um número que o texto manda ignorar. | `video-magro-1440-escuro.png` | Quando abaixo de 10 views, número em cor neutra e a barra tracejada. |
| corrige | Magro: a mediana do canal (25%) é igual ao valor do vídeo, mas a frase diz que "não dá para comparar com o normal do canal"; o triângulo "mediana do canal" encosta no fim da barra e parece um selo de "igual". | idem | Tirar o triângulo abaixo do mínimo. |
| sugestão | O rótulo "mediana do canal: 39%" fica 40 px abaixo do eixo com um triângulo sem linha de ligação. | `video-cheio-1440-escuro.png` | Linha fina do triângulo até a barra. |

**Medidas:** barra laranja 6,72:1 (escuro) / 4,94:1 (claro) sobre o fundo da barra; textos ≥ 4,5:1. A barra é a mesma cor de "views por dia"; está certo, mas a legenda não diz que % assistido e views por dia usam o mesmo laranja.

---

## 6. Retenção (curva)

**Pergunta do usuário:** "Onde as pessoas saem do meu vídeo?"

**Veredito: pronto para o dono.**

A curva é a melhor peça do conjunto: frase-resumo ("Metade das pessoas já saiu aos 6:52"), linha vertical de mediana, faixas de "trechos revistos" e triângulos de "maiores saídas" com texto embaixo; a marca "exemplo" é inequívoca; o estado real ("não coletada") é dito sem culpar o usuário. Funciona em 390 px sem rolagem lateral.

| Sev. | Achado | Evidência | Conserto |
|---|---|---|---|
| sugestão | O estado "não coletada" fala de "tabela e rotina que ainda não existem" (jargão; está na tela 3 como corrige). | `video-magro-1440-escuro.png` | "Ainda não coletamos esta curva." |
| sugestão | Os triângulos âmbar (`terco-baixo`) de "maiores saídas" não têm legenda; só o texto abaixo os explica. | `video-cheio-1440-escuro.png` | Legenda de uma linha sob o eixo. |
| sugestão | As faixas azuis "trechos revistos" usam o azul de "cliques estimados" (`im-cl`). | idem | Aceitável se a legenda disser; do contrário, usar o tom da curva. |

**Medidas:** curva `lado-o` 6,72:1 / 4,94:1; triângulo `terco-baixo` 9,86:1 (escuro) / 5,55:1 (claro); sem rolagem a 390 px; texto ≥ 12 px.

---

## 7. c1-seletor.html: seletor de canal da comparação (7 estados)

**Pergunta do usuário:** "Como troco o canal deste lado para o que eu quero?"

**Veredito: volta para ajuste.**

Teclado de verdade, passo a passo: Tab chega ao campo; Seta para baixo abre e anuncia "tnFigueiredo, canal atual, 1 de 80"; a 2ª seta anda; Esc fecha e devolve o nome atual; digitar "pass" filtra e escolhe "Passaporte Carimbado" (Enter troca); "bussola" sem acento acha "Bússola Quebrada"; "vou" mostra o canal do lado B como "indisponível" com o motivo na própria linha, e Enter nele não troca e anuncia "Escolha outro canal"; "zzz" mostra "Nenhum canal encontrado"; Tab sai sem trocar. O foco tem contorno laranja de 2 px. Tudo isso passa.

| Sev. | Estado | Achado | Evidência | Conserto |
|---|---|---|---|---|
| bloqueia | aberto, 390 px | O cartão do Lado B cobre a lista do Lado A. `.cb-lista` é `position:absolute` sem camada; o cartão que vem depois a cobre. A opção "Thiago Figueiredo" (86 px de altura, y 368 a 454) fica sob o cartão B (y 376 a 466): tocar nela atinge o cartão B. | `c1-toque-aberto-390-viewport.png`; `elementFromPoint` = cartão B | Usar a Popover API como o ⓘ já faz (camada do navegador, sem `z-index`), ou criar `isolation: isolate` + `position: relative` no cartão do lado ativo. |
| corrige | indisponível | A linha "indisponível" tem a mesma aparência de uma opção que dá para escolher (barra laranja de foco, nome em texto cheio); só a palavra "indisponível" à direita e o motivo em cinza. A cor muda pouco. | `c1-indisponivel-enter-1440-real.png` | Linha com nome em `--muted`, ícone de cadeado ou "—" antes do nome, e sem a barra laranja de foco (ou barra tracejada). |
| corrige | todos | Iniciais nos avatares com 11 px (`span.av`), abaixo de 12 px. | auditoria de fontes | 12 px. |
| corrige | tema claro | O "✓" de "atual" tem 4,45:1 e 4,31:1 (`#B8481A` sobre `#F2EBDF` / `#F4E5DA`). A palavra "atual" ao lado cobre o sentido, mas o ✓ está abaixo de 4,5:1. | auditoria | Usar `--accent-hover` (`#A23E14`). |
| sugestão | sem vídeos | A pastilha "sem vídeos" usa o malva de "não medido": são duas coisas diferentes (canal sem vídeos × dado não medido) com a mesma cor. | `c1-aberto-1440-escuro.png` | Contorno neutro. |
| sugestão | 1440 | Com a lista aberta, o cartão do Lado A (altura 175 px) é menor que a lista (420 px) e a lista cobre a área em branco abaixo do Lado B. Funciona, mas deixa a lista "solta". | `c1-aberto-1440-escuro.png` | Largura do cartão. |

**Medidas**

| Item | Valor |
|---|---|
| Altura do campo | 44 px (o `input` 42 px; o botão de chevron 40 × 40 px; ele tem `tabindex="-1"`) |
| Altura das opções | 54 px (86 px a de "sem vídeos") |
| Campo a 390 px | 16 px de fonte (sem zoom no iOS) |
| Rolagem horizontal a 390 | nenhuma |
| Contraste do texto | ≥ 4,5:1 (exceto o ✓ no claro, acima) |

---

## 8. c2-trocas.html: troca de descrição na lista e no painel

**Pergunta do usuário:** "Quem mexe nos próprios vídeos com frequência, e o que mudou?"

**Veredito: volta para ajuste.**

A hierarquia (número principal da conta antiga, descrição à parte, "silêncio é informação") está bem pensada e o painel em ordem de tempo com filete lateral é claro.

| Sev. | Estado | Achado | Evidência | Conserto |
|---|---|---|---|---|
| corrige | todos | As quatro marcas de semana (16 × 8 px) mostram "sem troca" por contorno de `--border-strong`: 1,44:1 (escuro) e 1,77:1 (claro). A semana vazia some, e o que dá o hábito é justamente o vazio entre as cheias. | `c2-nomade-1440-escuro.png`; contraste calculado | Contorno em `--dim` (4,86:1 / 5,59:1) e rótulo "antiga → recente" no começo e no fim. |
| corrige | Paddy Doyle | A marca roxa (semana com mais de uma troca) só é explicada no `aria-label`; na tela é um quadrado roxo sem legenda e, em cinza, é idêntico ao azul (`cinza-c2-1440.png`). | `.sem i.rep` | Legenda "uma troca / mais de uma" ou um ponto dentro da marca. |
| corrige | todos | Azul (`tier-mid`) das marcas "semana com troca" é o mesmo azul de "cliques estimados" (gráficos) e do "lado B". | `.sem i.on` | Usar o laranja/âmbar do conjunto ou um azul diferente de `im-cl`. |
| corrige | 390 px | Os nomes de canal na lista são links de 20 px de altura. | `a.cn` 58 a 103 × 20 px | 44 px no toque. |
| corrige | todos | Iniciais com 11 px nos avatares. | `span.av` | 12 px. |
| sugestão | 390 | O painel só aparece depois do último cartão da lista; quem toca em um canal não vê nada mudar. | `c2-nomade-390-escuro.png` | No mockup, uma âncora "Ver detalhes" abaixo do cartão. |
| sugestão | todos | O selo "costuma trocar" (`tier-high`, roxo, 6,08:1 e 6,65:1) está bom em contraste; mas o roxo é cor nova para "hábito", e a mesma cor identifica a marca "mais de uma troca" (item acima). | tokens | Usar um só significado para o roxo. |

**Medidas**

| Item | Valor |
|---|---|
| Marca "com troca" `tier-mid` sobre a superfície | 7,73:1 (escuro) / 5,56:1 (claro) |
| Marca "mais de uma" `tier-high` | 6,08:1 / 6,65:1 |
| Marca "sem troca" (contorno) | 1,44:1 / 1,77:1 |
| Escala de cinza | marcas "com" e "mais de uma" se confundem |
| Rolagem a 390 px | nenhuma |

---

## 9. comparar-direcao.html: base de 90 dias e direção

**Pergunta do usuário:** "Estes dois canais estão indo na direção certa?" (não "qual é melhor").

**Veredito: volta para ajuste.** O objetivo do dono é atendido no primeiro olhar: a Leitura rápida está no topo, com quadrado + seta + palavra + percentual, e os dois cartões mostram "▲ subindo" e "▼ descendo". Em cinza a leitura continua (setas e palavras). Esse acerto é grande. Os problemas são o que fica ao redor.

| Sev. | Estado | Achado | Evidência | Conserto |
|---|---|---|---|---|
| bloqueia | todos | A Leitura rápida diz "Aldinho está descendo: as views dos vídeos novos caíram 19%" sem a ressalva de idade, que só está no aviso abaixo, 400 px adiante e depois do bloco "Tamanho do canal". O texto do próprio mockup diz que "descer pode ser só idade". Além disso, os 34% e 19% são exemplo e a linha não carrega a marca "exemplo" (as linhas da tabela carregam). | `dir-base90-1440-escuro.png` | Na linha de "descendo": "…caíram 19% (pode ser só idade: os vídeos mais velhos tiveram mais tempo)". Marca "exemplo" no bloco de Leitura rápida. |
| corrige | todos | "Tamanho do canal" e a coluna "B em relação a A" vêm antes da Direção e usam "▲ Aldinho: 2,4× os inscritos" e "▲ Lodir Negrini: 2,9× as views por dia". Em uma tela cujo objetivo é "não é quem é melhor", o ▲ vira "é maior"; é o mesmo símbolo de "subindo". A REVISAO.md já aponta que é "o primeiro corte". | `dir-base90-1440-escuro.png`, coluna direita | Cortar a coluna (libera 18% da largura) ou trocar o símbolo por "2,4×" sem seta; e mover "Tamanho do canal" para depois do Desempenho. |
| corrige | todos | Lado A tem três cores no mesmo fluxo: laranja em `c1-seletor` e `comparar-so-seu-canal`, bege (`lado-n`, `#D9C08F`) em `comparar-direcao`. Em `c1-seletor` o lado B é azul (`#7CC8F8`); em escala de cinza bege e azul têm luminância quase igual (1,04:1 entre si). | `c1-aberto-1440-escuro.png` × `dir-base90-1440-escuro.png` | Um só par de cores para A e B nas três telas, e letra A/B sempre junto (já existe). |
| corrige | claro | No tema claro, "descendo" (`#92400E`) e o lado A (`#7A5C14`) são dois marrons: o rótulo "Lodir Negrini" e o quadrado ▼ de Aldinho parecem da mesma família. | `dir-base90-1440-claro.png` | No claro, usar para "descendo" um tom claramente diferente do bege/marrom do lado A (por exemplo, laranja-avermelhado `#B45309` com contorno, ou o `--danger-text` com símbolo). |
| corrige | todos | O âmbar significa duas coisas: "descendo" e o aviso "Descer pode ser só idade". O mesmo âmbar do ▼ aparece na caixa do aviso, e a pessoa lê "descer = aviso". Na verdade o aviso é uma ressalva do método. | aviso `⚠` em âmbar + ▼ âmbar | Aviso em tom neutro (`--forja`/informação) e o âmbar só para "descendo". |
| corrige | todos | Verde para "subindo" reabre o veto do dono ("sem verde, sem vermelho como única marca"). Aqui o verde não é a única marca (há quadrado, seta e palavra); a escolha de âmbar para "descendo" é correta (descer não é erro) e se lê em cinza. Julgamento: aceitável **se** o dono aprovar o verde explicitamente; verde e âmbar têm a mesma luminância (1,06:1), então a distinção por cor é só de matiz e a forma (▲ ▼) é o que vale. | `cinza-direcao-1440.png` | Manter, mas pedir ao dono "verde só para direção" em uma linha, não dentro do REVISAO. |
| corrige | todos | O chip "exemplo" aparece 9 vezes na tela cheia (uma por linha) e é pontilhado cinza de 12 px. | `dir-base90-1440-escuro.png` | Uma faixa "Números de exemplo" no topo do bloco e um chip só onde o dado for real. |
| corrige | claro e escuro | O chip "exemplo" dentro da caixa malva "Como a tela ficaria…" tem 4,06:1 (escuro). | `dir-trinta-cheio-matheus-1440-escuro.png` | `--muted`. |
| corrige | 1440 | A faixa "estável" da régua de direção tem contorno `--border-strong` (1,44:1 escuro / 1,77:1 claro) e fundo `--surface-2`: a zona central da régua quase não se vê. Ela é a referência para ler os traços. | `dir-base90-1440-escuro.png` | Contorno em `--dim`, ou tracejado. |
| sugestão | 390 | A Leitura rápida cobre a primeira tela do 390 com texto em quatro linhas; boa. A frase de "Descer pode ser só idade" fica a 1.400 px do topo. | `d1.png`/`d2.png` | Ver bloqueia acima. |
| sugestão | Leo Khev | O estado "não medido" (◌, "sem como medir a direção das views (2 longos…)") está correto e honesto; a pastilha "sem traço de Leo Khev" na régua é um bom detalhe. | `dir-leo-1440-escuro.png` | nenhuma |
| sugestão | trinta=cheio | O gráfico de barras dos primeiros 30 dias usa escala própria por canal; a barra de Matheus (todas do mesmo tamanho) parece "tudo igual" e a de Lodir "subindo": é isso mesmo, e está dito na legenda. | `dir-trinta-cheio-matheus-1440-escuro.png` | nenhuma |

**Medidas**

| Item | Escuro | Claro |
|---|---|---|
| Quadrado ▲ subindo sobre a superfície | 7,26:1 | 6,37:1 |
| Quadrado ▼ descendo | 7,71:1 | 6,64:1 |
| Quadrado ＝ estável | 6,18:1 | 7,13:1 |
| Glifo sobre o quadrado (`on-lado`) | 8,13 / 8,62 / 6,92:1 | 6,81 / 7,09 / 7,62:1 |
| Verde × âmbar entre si (luminância) | 1,06:1 | 1,04:1 |
| Tique da régua (`--dim`) | 4,86:1 | 5,59:1 |
| Faixa "estável" (borda) | 1,44:1 | 1,77:1 |
| Bege (A) × azul (B) entre si | 1,04:1 | 1,09:1 |
| Alvos: ⓘ "Como ler esta tabela" | 28 px (ponteiro fino); 44 px no toque | |
| Seletor "Últimos 90 dias / Todos os acompanhados" | 44 px de altura | |
| Rolagem a 390 px | nenhuma | nenhuma |
| Texto menor que 12 px | nenhum | |

---

## O que não consegui verificar

- **Leitor de tela** (VoiceOver, NVDA): li só os atributos ARIA e o texto de `role="status"`; não ouvi nada.
- **Toque real** em aparelho: usei emulação de toque do Chromium (`hasTouch`, `isMobile`); o gesto de rolagem e o comportamento da lista por cima do iOS não foram vistos.
- **Navegador diferente do Chromium** (Opera, Safari, Firefox), inclusive o `popover` e o `color-scheme`.
- **Zoom de 200 a 400%** e texto aumentado do sistema.
- **Movimento reduzido** (a regra existe no CSS; não alternei a preferência).
- **Fontes da internet** (Inter, JetBrains Mono, Fraunces): sem rede, as capturas usam fontes do sistema; as larguras dos números em mono podem diferir um pouco.
- **Capas dos vídeos**: sem rede, ficam como blocos coloridos (por isso o 1440 claro de algumas capturas mostra roxo e azul lisos).
- **Contraste de gradientes e hachuras**: medi tokens e bordas, não o padrão composto da hachura.
- **O mockup aprovado de 07/10 não tem tema claro**, então não há referência para comparar o tema claro com o que já foi aprovado; só com os tokens.
- **Dado real**: não li o banco; os números "reais" do magro são os que o mockup declara.
