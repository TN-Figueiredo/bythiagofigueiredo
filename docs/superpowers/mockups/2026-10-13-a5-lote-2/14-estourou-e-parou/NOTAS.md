# Notas do mockup 14: a leitura M10 (13/10/2026)

Abrir: `cd docs/superpowers/mockups/2026-10-13-a5-lote-2/14-estourou-e-parou && python3 -m http.server 47750 --bind 127.0.0.1`, depois `http://127.0.0.1:47750/index.html` (ou abrir o arquivo direto do disco). O plano está em `PLANO.md`. `a4.css`, `a4-comum.js`, `lote.css` e `lote.js` são cópias congeladas do lote 1 (não editadas); o que é deste mockup está em `m14.css`, `m14.js` e `m14-dados.js`.

Parâmetros: `?tela=historico|outliers`, `?caso=` (lista abaixo), `?nome=a|b|ambos`, `?filtro=todos|com|nao|nm` (Outliers), `?tema=claro`. A barra "Estados do mockup", recolhida no topo e fora da tela simulada, tem um botão por estado.

- Histórico do vídeo: `tipico`, `extremo`, `borda`, `zero`, `nao`, `nao-rende`, `nm-semv30`, `nm-v30baixo`, `nm-canal`, `nm-semreacao`, `nm-aovivo`, `nm-cedo`, `sem-dado`, `erro`, `carregando`.
- Outliers: `cheio`, `magro`, `zero` (já abre no filtro "Com a leitura", vazio), `sem-dado`, `erro`, `carregando`.
- O mundo do exemplo é 20/04/2027 (a leitura só existe a partir de 01/01/2027); `sem-dado` mostra o dia de verdade, 13/10/2026.

## 1. Decisões de desenho e por quê

1. **As três casas** (cheia, vazada com ✕, hachurada, pontilhada) são a resposta de relance e o único elemento memorável. Contam sinais; não dão nota, percentual nem cor de bom ou ruim. Aparecem no bloco do Histórico (22 px), na coluna "Leitura" do Outliers (16 px) e nos filtros. Resposta ao risco 11: a tela mostra "quantos sinais batem", e o texto obrigatório diz o que isso não prova.
2. **Nenhuma cor nova e nenhuma cor de direção.** Bate = casa/pastilha cheia na cor do texto + ✓ + a palavra "bate"; não bate = contorno + ✕ + "não bate" (um nome só em toda a tela; r1 C1). O único matiz de dado é o azul `--lado-b` (o vídeo "do outro canal") no marcador. Verde e âmbar são direção, vermelho é erro; nenhum dos três entra aqui. Legível em escala de cinza.
3. **Nome da leitura em título discreto, com a pastilha "indício" sempre colada** (contorno, ícone de pico que cai). Nunca selo preenchido. Na lista do Outliers a pastilha repete o nome como link e leva "indício".
4. **Três cartões com a mesma anatomia** (título, bate/não bate, número, comparação com o normal do canal, frase "Bate se…", régua, legenda de 3 colunas). A régua tem sempre os mesmos cinco elementos: trilho, faixa que vale (faixa opaca neutra, 3:1 contra o trilho nos dois temas), limite (traço grosso tracejado), normal do canal (linha fina), este vídeo (círculo azul). Passou do fim: o marcador vira ▶ na ponta. Zero medido: caixa vazada com borda `--im-zero`, como no lote 1. Em tela larga os cartões usam subgrade, então as três réguas ficam alinhadas.
5. **Cada régua tem eixo próprio** (0 a 4× o normal; 0 a 2× o normal), porque num eixo único as de "pouco" ficavam coladas no zero. A legenda sob a régua dá os valores reais, não só em ×.
6. **"Quase nada depois" tem duas condições que valem juntas** (parte das views depois do dia 30, e "ainda rende" até 2%). Ficam no mesmo cartão, a segunda numa sub-régua sem "normal do canal" (o limite de 2% é fixo).
7. **O texto obrigatório entra no corpo, inteiro, frase por frase**, em três linhas com símbolo e rótulo: círculo cheio "O que vimos", círculo tracejado com ? "Hipótese nossa", círculo riscado "O que ninguém de fora vê". As frases são idênticas às do spec; só os rótulos e o título "Indício, não medição." foram separados. O leitor distingue dado, palpite e o que é invisível pela forma, não só lendo.
8. **O texto só aparece quando o resultado é `pico_sem_cauda`** (no Histórico, logo abaixo da frase-resumo e antes dos cartões) ou quando a lista VISÍVEL do Outliers tem linha com a leitura (filtros Todos e Com a leitura; uma vez, logo abaixo da última linha com a leitura, com a linha de abertura "Sobre cada vídeo marcado com Estourou e parou acima:" fora do texto literal). Em "não é o caso" e "não medido" ele afirmaria "este vídeo teve muitas views… e pouca reação", o que não vale. Ver dúvida 2.
9. **"Não é o caso" mostra os três números**, com a frase dizendo qual sinal não bateu e por quanto ("a reação do público (1,6% das views) ficou acima do limite de 1%"). Sem o texto obrigatório, sem selo.
10. **Não medido por motivo, com "Passa a existir"** (data, condição ou "nunca para este vídeo"), com a forma do que falta: barra "640 de 1.000", cinco casas "3 de 5", barra "61 de 90 dias". Essas barras são de contagem real, então não usam a hachura rosa (que fica só para "o dado não chegou"). **Sem reação pública** é o único não medido que mantém os dois primeiros cartões; o terceiro vira "não medido" e as casas ficam ✓ ✓ ▨ (nunca ✓ ✓ ✕, que pareceria "não é o caso").
11. **"Ainda não existe"** (a leitura não existe para nenhum vídeo) usa contorno pontilhado, três casas pontilhadas e uma linha do tempo (hoje, janeiro, abril). É o estado real de hoje. Não é hachura, porque o dado não "deixou de chegar": ainda não pode existir.
12. **Erro** na família do erro (borda e ícone), texto em `--text`, e a frase "Isto não quer dizer que o vídeo não estourou": o erro nunca pode parecer "não é o caso" (o sistema falha em verde).
13. **Outliers:** frase-resumo ("2 dos 9 outliers têm a leitura; 3 não são o caso e 4 não foram medidos"), barra de cobertura em três formas (cheia, contorno, hachura), filtros que também servem de legenda (casa + número), e a coluna Leitura. **Zero medido** no filtro "Com a leitura" é a caixa vazada com 0 e a frase "Zero aqui é um resultado, não falta de dado".
14. **"exemplo" no cabeçalho de cada cartão** (e da sub-condição), na frase-resumo e em cada linha da lista, em vez de ao lado de cada número (seria um chip por número, quatro por cartão). Cobre todos os números do cartão.
15. **Aviso do topo "Só exemplo até 2027"** na tela, com a data de cada medida. Só do mockup: em produção o equivalente é o estado `sem-dado`.
16. **Hospedeiros:** os mockups 13 (Histórico do vídeo) e 17b (Outliers) ainda não existem, então o Histórico é o cabeçalho do vídeo da casca do lote 1 mais um espaço marcado "curva por idade (mockup 13)", e o Outliers é o cabeçalho do Observatório com os filtros em contorno. O que a proposta acrescenta leva "+ novo" tracejado, como no lote 1.
17. **Nenhum percentual de chance, nenhuma nota, nenhum "veredito"**; a palavra proibida do item 56 não aparece em nenhum arquivo do mockup (`grep` conferido, inclusive no texto da tela).

## 2. Tabela de frases da tela (texto exato)

| Onde | Texto |
|---|---|
| Título (opção A) | Estourou e parou |
| Título (opção B) | Muitas views, pouco sinal de que agradou |
| Título nos estados sem a leitura (não é o caso, não medido, ainda não existe, erro, carregando) | **Leitura:** Estourou e parou (prefixo "Leitura:" em cinza, para o título não afirmar o que o estado nega) |
| Pastilha ao lado do título | indício |
| Botão ⓘ (rótulo) | Como a leitura Estourou e parou é calculada (ou o nome B) |
| Título do popover | Como a leitura é calculada |
| Frase-resumo, 3 de 3 | **Os 3 sinais batem**: muitas views cedo, quase nada depois e pouca reação do público. |
| Frase-resumo, 2 de 3 (reação) | **Só 2 dos 3 sinais batem, então não é o caso:** a reação do público (1,6% das views) ficou acima do limite de 1%. |
| Frase-resumo, 2 de 3 (ainda rende) | **Só 2 dos 3 sinais batem, então não é o caso:** o vídeo ainda rende 3,1% nos últimos 28 dias, acima do limite de 2%. |
| Frase-resumo, 2 de 3 (cauda ou views cedo) | "…a parte das views depois do dia 30 (X%) ficou acima do limite de Y%." / "…as views dos 30 primeiros dias não chegaram a 2× o normal." |
| Frase-resumo, não medido | **Não medido:** <motivo curto>. |
| Cartão 1 | Muitas views cedo; "views nos 30 primeiros dias"; "3,4× o normal do canal"; "**Bate** se tiver 108.000 views ou mais (2× o normal)." |
| Cartão 2 | Quase nada depois; "das views vieram depois do dia 30"; "**Bate** se for até 17% (metade do normal)."; sub: "E ainda rende pouco", "ganhos nos últimos 28 dias (2.190 views)", "**Bate** se for até 2% das views dos 30 primeiros dias." |
| Cartão 2, zero | "nenhuma view depois dos 30 primeiros dias"; "view ganha nos últimos 28 dias"; "O normal do canal é 34%" |
| Cartão 3 | Pouca reação do público; "curtidas e comentários por view, aos 30 dias"; "0,3× o normal do canal · 1.102 de 183.640 views"; "**Bate** se for até 1,1% (metade do normal)." |
| Valores muito baixos | "menos de 0,1× o normal do canal" |
| Igual ao limite | "**Igual ao limite: bate.**" (acrescentado à frase "Bate se…") |
| Selos de estado | ✓ bate · ✕ não bate · não medido; no cartão 2 o selo do cabeçalho conta as duas condições ("✓ 2 de 2 batem", "✕ 1 de 2 bate") e a primeira condição leva o seu próprio selo |
| Legenda da régua | Este vídeo · Limite · Normal (valor embaixo de cada; o `aria-label` diz "Normal do canal") |
| Texto obrigatório (no Outliers, com uma linha de abertura antes, fora do texto) | Abertura no Outliers: "Sobre cada vídeo marcado com **Estourou e parou** acima:" / **Indício, não medição.** / O que vimos: "Este vídeo teve muitas views nos primeiros 30 dias, quase nenhuma depois, e pouca reação do público (curtidas e comentários)." / Hipótese nossa: "Isso costuma acontecer quando o YouTube para de recomendar um vídeo; essa é uma hipótese nossa sobre como a recomendação funciona, não um dado." / O que ninguém de fora vê: "O YouTube não mostra a ninguém de fora quanto tempo as pessoas assistiram ao vídeo de outro canal." |
| Não medido: falta a medida | "Não medido: este vídeo não tem a medida dos 30 primeiros dias." / "Os vídeos publicados antes de 03/10/2026 não a têm: começamos a guardá-la nessa data." / "Passa a existir: nunca para este vídeo." |
| Não medido: poucas views | "…o vídeo teve menos de 1.000 views nos 30 primeiros dias." / "Poucas views para comparar." / "Nos 30 primeiros dias o vídeo teve 640 views; a leitura pede 1.000." / "640 de 1.000" / "Passa a existir: nunca para este vídeo (a medida dos 30 primeiros dias não muda)." |
| Não medido: canal pequeno | "…o canal tem menos de 5 vídeos longos para comparar." / "O canal ainda tem poucos vídeos para servir de normal." / "Leo tem 3 vídeos longos com 90 dias e a medida dos 30 dias; a leitura compara com o canal e pede 5." / "3 de 5, faltam 2" / "Passa a existir: quando o canal tiver 5 vídeos longos com 90 dias e a medida dos 30 dias." |
| Não medido: sem reação pública | Frase: "Não medido: sem reação pública para comparar." Cartão 3: pastilha "sem reação pública para comparar"; "Curtidas ocultas e comentários desligados: nenhum número de reação, nem zero."; "Passa a existir: se o canal mostrar as curtidas ou ligar os comentários." Cabeçalho do vídeo: curtidas e comentários "não medido". |
| Não medido: ao vivo ou estreia | "…ao vivo e estreia ficam de fora." / "Ao vivo e estreia ficam de fora." / "O pico desses vídeos vem da data marcada, então a leitura não se aplica a eles." / chip "ao vivo ou estreia" / "Passa a existir: nunca para este vídeo." |
| Não medido: menos de 90 dias | "…o vídeo ainda não tem 90 dias." / "O vídeo tem 61 dias; a leitura pede 90." / "61 de 90 dias, faltam 29" / "Passa a existir: em 19/05/2027 (faltam 29 dias)." |
| Ainda não existe | "Esta leitura ainda não existe para nenhum vídeo. Ela precisa de 90 dias de vídeo e da medida dos 30 primeiros dias." / "hoje, 13/10" · "janeiro" · "abril" / "Janeiro de 2027: o primeiro vídeo chega aos 90 dias. Abril de 2027: um canal com cerca de 5 vídeos longos a cada 90 dias passa a ter 5 para comparar." |
| Aviso do topo (só mockup) | "Só exemplo até 2027. A leitura passa a existir em janeiro de 2027 e, num canal com cerca de 5 vídeos longos a cada 90 dias, em abril de 2027." |
| Erro | "Não foi possível calcular a leitura agora." / "Isto não quer dizer que o vídeo não estourou: a leitura não foi calculada. Os números do vídeo acima estão certos." / botão "Tentar de novo" |
| Carregando | "Calculando a leitura..." (`aria-busy`) |
| Outliers, resumo | "**2 dos 9 outliers têm a leitura**; 3 não são o caso e 4 não foram medidos." |
| Outliers, filtros | Todos · Com a leitura · Não é o caso · Não medido (cada um com casa e número; "0" em caixa vazada quando zero medido) |
| Outliers, coluna Leitura | com a leitura: casas + "Estourou e parou" (link) + "indício" + "3 de 3 sinais"; não é o caso: "Não é o caso" + "não bateu: pouca reação"; não medido: pastilha + motivo curto ("sem a medida dos 30 primeiros dias", "ainda não tem 90 dias", "ao vivo ou estreia", "menos de 1.000 views em 30 dias", "sem reação pública para comparar", "canal com menos de 5 vídeos"); erro: "leitura indisponível agora" |
| Outliers, vazio, filtro "Com a leitura" | "Nenhum dos 9 outliers tem a leitura." / "5 foram medidos e não são o caso; 4 não foram medidos. Zero aqui é um resultado, não falta de dado." / botão "Ver todos os 9" |
| Outliers, vazio, filtro "Não é o caso" (r2 B2) | "Nenhum dos 9 outliers deu “não é o caso”." / "1 tem a leitura e 8 não foram medidos. Zero aqui é um resultado: houve medida, e nenhum vídeo ficou de fora." / botão "Ver todos os 9" |
| Outliers, vazio, filtro "Não medido" (r2 B2; nenhum exemplo chega aqui) | "Todos os 9 outliers foram medidos." / "2 têm a leitura e 7 não são o caso. Zero aqui é um resultado, não falta de dado." / botão "Ver todos os 9" |
| Outliers, frase-resumo com 1 | "1 dos 9 outliers **tem** a leitura; 0 não são o caso e 8 não foram medidos." (singular concorda) |
| Outliers, faixa de filtros (só do mockup) | "Idade: hoje" (era "Idade: 30 dias": o múltiplo do Outliers de hoje não vem da medida dos 30 dias, r2 melhoria 6) |
| Outliers, erro | "A lista de outliers está completa; só a coluna Leitura falta. Isto não quer dizer que nenhum vídeo estourou e parou." |
| ⓘ (corpo) | "Cálculo do Observatório sobre dados públicos do YouTube. É um indício, não uma medição." + base (90 dias ou mais, a medida dos 30 dias, mediana do canal, 5 vídeos) + as três condições com os limites + "Igual ao limite bate. Se só 2 dos 3 sinais batem, não é o caso. Ao vivo e estreia ficam de fora." (e "As duas precisam bater juntas" no cartão 2) + "Os limites são nossos, valem para este canal e são só um ponto de partida: vamos conferi-los contra vídeos reais." |

## 3. Dúvidas para o dono (com o padrão adotado)

1. **Qual nome?** Adotei **A, "Estourou e parou"**: curto, cabe no filtro e na linha do Outliers, e "estourou" e "parou" são os dois fatos medidos (views cedo, quase nada depois); a hipótese fica só no texto. O B ("Muitas views, pouco sinal de que agradou") é mais cauteloso, mas insinua um julgamento sobre o público ("agradou") que a medida não faz, e não cabe numa pastilha. Os dois estão lado a lado em `?nome=ambos`, no Histórico e no Outliers.
2. **O texto obrigatório aparece quando a leitura é "não é o caso" ou "não medido"?** Adotei: **não**, só no resultado `pico_sem_cauda`, porque o texto diz "este vídeo teve muitas views… e pouca reação" e seria falso. O spec diz "em toda tela em que a leitura aparecer": entendi "aparecer" como "o vídeo recebe a leitura". Se o dono quiser o texto sempre, vira uma versão de uma frase só para os outros estados.
3. **Outliers: a coluna Leitura aparece em todas as linhas ou só nas que têm a leitura?** Adotei **em todas**, com "não é o caso" e "não medido" (hachura e motivo), porque sem isso uma linha sem a leitura seria indistinguível de uma que não foi medida (o sistema falha em verde). Em 2027 quase todas serão hachuradas (estado `magro`); se ficar pesado, a alternativa é só a pastilha nas que têm a leitura e a barra de cobertura no alto.
4. **"Menos de 90 dias" como motivo de não medido.** Não está na lista fechada de 6.1.5 do spec (é uma condição da tabela M10, "idade ≥ 90 dias"). Adotei como motivo próprio, com a data em que passa a existir. Confirmar para a lista.
5. **"Ainda rende" com nome de tela.** Chamei de "E ainda rende pouco" (a segunda condição do cartão 2). Se o dono preferir o rótulo seco "Ainda rende", troca-se uma linha.
6. **Usuário só de leitura:** não desenhei porque M10 não usa número privado (views, curtidas e comentários de concorrente são públicos), então quem só lê vê o mesmo que quem edita; a barra de estados traz essa nota. Se algum dia a leitura for mostrada para o canal do dono (onde há número privado), vira estado novo.
7. **A marca "exemplo" por cartão, não por número** (decisão 14). Se o dono quiser um chip em cada número, acrescenta-se, ao custo de poluição.

## 4. O que o implementador precisa saber

- **A conta** (`m14-dados.js`, função `avaliar`): (i) V30 ≥ 2× a mediana de V30 do canal; (ii) cauda = (views de hoje − V30) ÷ views de hoje ≤ metade da mediana de cauda do canal **e** "ainda rende" = ganho dos últimos 28 dias ÷ V30 ≤ 2%; (iii) (curtidas + comentários aos 30 dias) ÷ V30 ≤ metade da mediana de engajamento do canal. **Igual ao limite vale** (≥ e ≤), com tolerância de ponto flutuante (o caso `borda` tem 2,0× exato, metade exata e 2% exato). Três valem = `pico_sem_cauda`; duas valem (ou uma) = `nao_e_o_caso`; motivo de não medido = não medido. Item de aceite 55: testes de borda sobre inteiros ou com tolerância, e `nao_e_o_caso` com duas de três.
- **Ordem dos motivos de não medido** (a que o código do mockup usa): ao vivo/estreia, sem V30, V30 < 1.000, canal com menos de 5 vídeos, menos de 90 dias, sem reação pública (curtidas ocultas **e** comentários desligados; com só um dos dois, a reação do outro existe e a leitura é dada). Definir a ordem no código evita dois motivos na tela.
- **Sem reação pública:** a leitura não é dada com duas condições; os cartões 1 e 2 aparecem medidos e o cartão 3 "não medido"; o resultado continua não medido (casas ✓ ✓ ▨).
- **Texto obrigatório:** componente único, três frases separadas e inteiras; teste do item 56: ele aparece (substring de cada frase) no Histórico e no Outliers quando há leitura, e a palavra proibida do item 56 não aparece em nenhuma tela de concorrente. As frases não levam número nem interpolação.
- **Tela do Outliers:** o texto aparece uma vez, logo abaixo da última linha com a leitura, e só quando a lista visível (filtro Todos ou Com a leitura) tem pelo menos uma; nos filtros Não é o caso e Não medido ele não aparece. Linhas com a leitura vêm primeiro; a lista do Outliers continua sendo a de hoje (o múltiplo "N× o normal do canal" é o do Outliers atual, sem mudança).
- **Acessibilidade:** casas e réguas são `role="img"` com `aria-label` por extenso ("Três sinais: muitas views cedo bate; quase nada depois bate; pouca reação não bate"); a régua diz "o vídeo está do lado que bate". Estados de erro `role="alert"`; carregando `role="status"` + `aria-busy`. ⓘ por popover do navegador, como no lote 1. Alvos de 44 px a 390 px e texto de 12 px ou mais (medidas em `shots/medidas.json`: zero rolagem horizontal, zero fonte menor que 12 px, zero alvo menor que 44 px, nas 100 capturas).
- **Cor:** só tokens do lote 1 e duas variáveis locais neutras (`--lm-vale`, `--lm-vale-b` em `m14.css`), literais nos dois temas. Sem `color-mix()` em nenhum arquivo novo.
- **Container query:** o bloco usa `container-type: inline-size`; três cartões lado a lado a partir de 860 px de largura do bloco (por isso ficam em uma coluna quando o bloco está pela metade, em `?nome=ambos`), subgrade para alinhar as réguas.
- **Fora do que este mockup resolve:** a curva por idade do Histórico (mockup 13), a página do Outliers inteira (17b), o Comparar. A leitura não vai para o Cowork nem para a forja (spec 07).

## 5. Verificação feita (e o que não foi)

Feita: 25 estados e variantes capturados nos quatro cruzamentos (1440 e 390, escuro e claro) com o `capturar.mjs` do lote; ficam em `shots/` os dois pares obrigatórios de cada um (1440 escuro e 390 claro) e o `medidas.json` (100 medidas, todas limpas). Abri as capturas de: típico, extremo, não é o caso, sem dado, erro, sem reação pública, poucas views, canal pequeno, os dois nomes lado a lado, Outliers cheio (1440 e 390), Outliers vazio, e o popover do ⓘ (1440 e 390): nada cortado, nada sobreposto, sem rolagem horizontal. Corrigi: barra de poucas views (estava na hachura rosa, que é só do que "não chegou"), alinhamento das réguas entre cartões (subgrade), migalha com nome curto a 390 px (alvo < 44 px), e linhas do Outliers que contradiziam o Histórico do mesmo vídeo.

Não feito: contraste medido no navegador (olhei as capturas, mas não rodei medição de razão de contraste nos dois temas; os tokens são os do lote 1, que já foram medidos); leitor de tela, Safari e Opera; ordem de teclado completa; os estados `carregando` e as combinações menos comuns foram capturados, mas só abri as capturas listadas acima.

## 6. Resposta à revisão r1 (13/10/2026)

Revisão: `REVISAO-UX-r1.md`. Feito em `m14.js`, `m14.css` e `m14-dados.js`; os quatro arquivos do lote 1 seguem congelados. Capturas refeitas em `shots/` (116 medidas; rolagem horizontal, fonte menor que 12 px e alvo menor que 44 px: zero em todas; abri por mim 1440 escuro e 390 claro dos estados afetados).

| Item | Resposta |
|---|---|
| B1 (texto obrigatório sobre linhas que não o sustentam) | Feito. O texto só existe quando a lista visível tem linha com a leitura (Todos e Com a leitura), nunca em Não é o caso nem Não medido (medido por script: ausente em `cheio` com `nao` e `nm`, e em `magro` com `nm`). As linhas com a leitura vêm primeiro e o texto fica logo abaixo da última, precedido de "Sobre cada vídeo marcado com Estourou e parou acima:" fora do texto literal; as três frases do spec ficam idênticas. |
| B2 (Outliers `zero` com linhas impossíveis) | Feito. O `zero` reaproveita os resultados do `cheio` para o mesmo vídeo (Bangkok, Chiang Mai, AO VIVO e Trem não medidos pelos mesmos motivos; Vietnã ✓✓✕; O voo ✓✕✓; Ilhas ✓✓✕) e só troca as duas linhas que eram com a leitura (12 países, A passagem) por "não é o caso" com a primeira casa ✓. Nenhuma linha de nenhum estado tem ✕ na primeira casa. O vazio agora diz "5 foram medidos e não são o caso; 4 não foram medidos". Único desvio declarado: A passagem é ✓✕✓ no `zero` e ✓✓✓ no `borda` do Histórico, porque o `zero` é um mundo hipotético sem nenhuma leitura. |
| C1 (vale contra batem) | Feito. "bate" em toda a tela e nos `aria-label`: selos "✓ bate / ✕ não bate", "Bate com 108.000 views ou mais (2× o normal)", "Igual ao limite: bate", casas "bate / não bate / não medido", ⓘ "batem". "Vale" não aparece mais no texto renderizado do bloco (conferido nos estados com cartões). |
| C2 (ressalva longe da frase) | Feito. No Histórico o texto vai logo abaixo da frase-resumo, antes dos cartões: a 1440 frase em y=537-562, texto em 576-784, cartões em 798 (a primeira tela de 900 px mostra frase e texto; os cartões começam dentro dela). No Outliers a ressalva fica colada nas linhas que descreve (B1). |
| C3 (zona da régua abaixo de 3:1) | Feito. Zona opaca `#6F6659` (escuro) e `#8A7D68` (claro): 3,28:1 e 3,40:1 contra o trilho, medido no navegador. Anel do marcador em `--text` (4,94:1 e 4,18:1 contra a zona; o miolo azul sozinho tem 2,32:1 e 1,17:1, mas é o anel que o separa). A linha do normal nunca cai dentro da zona (a zona é 2× o normal ou mais, ou metade ou menos) e contra o trilho tem 6,92:1 e 6,43:1. Sem `color-mix()`. |
| C4 (selo do cartão 2 contradiz o primeiro número) | Feito. Selo do cabeçalho conta as condições ("✓ 2 de 2 batem", "✕ 1 de 2 bate") e a primeira condição tem o seu selo ("✓ bate") na linha do "× o normal", como a segunda já tinha no seu subcartão. |
| Sug. 1 (vazio sob cartões 1 e 3) | Feito. Cartões 1 e 3 terminam na sexta linha da subgrade (306 px; o 2 tem 552); as réguas seguem alinhadas (y=1003). |
| Sug. 2 (título afirma o que o estado nega) | Feito pela alternativa da revisão: nos estados sem a leitura o título vira "Leitura: Estourou e parou". Nome A ou B segue sendo decisão do dono (dúvida 1). |
| Sug. 3 (hachura de 16 px some) | Feito. Casas "não medido" levam um traço "–" além da hachura. |
| Sug. 4 (quadrados "3 de 5" parecem casas) | Feito. Viraram círculos. |
| Sug. 5 (legenda a 390) | Feito. "Normal do canal" virou "Normal" na legenda (o `aria-label` da régua mantém o nome completo). |
| Sug. 6 (controles a 1440) | Feito. Filtros e link "Estourou e parou" da linha com 44 px de altura (medido); a linha com a leitura sobe de 63 para 85 px. |

Sem discordância de bloqueio. Não verificado nesta rodada (igual à r1): leitor de tela, Safari, Firefox, Opera, toque real e movimento reduzido.

## 7. Resposta à revisão r2 (13/10/2026)

Revisão: `REVISAO-UX-r2.md`. Feito em `m14.js`, `m14.css` e `m14-dados.js`; os quatro arquivos do lote 1 seguem congelados. Capturas refeitas em `shots/r3/` (11 estados x 4 cruzamentos, 44 medidas: rolagem horizontal 0, fonte menor que 12 px 0, alvo menor que 44 px a 390 0; abri 1440 escuro e 390 claro de `magro` Todos, `magro` Não é o caso, `carregando` do Histórico e do Outliers). Conferência por script nas linhas do `magro`: nenhuma `cedo` com idade de 90 dias ou mais, nenhuma `semv30` com menos de 199 dias, nenhuma `v30baixo` com 2× ou mais; nenhum erro de página.

| Item | Resposta |
|---|---|
| B1 (linhas impossíveis do `magro`) | Feito. Ilhas da Tailândia vira "sem a medida dos 30 primeiros dias" com 215 dias (e não 3,2× com "menos de 1.000 views"); Trem noturno volta a "canal com menos de 5 vídeos", como em `cheio`, `zero` e no Histórico; as quatro linhas "sem a medida dos 30 primeiros dias" têm 199 dias ou mais (205, 210, 230, 215; Bangkok segue com 212). A idade passou a ser um quinto argumento opcional de `lin()`. Os títulos do `magro` com idade diferente da do Histórico são o mesmo exemplo em outro canal: o `magro` é um mundo à parte (canal novo na leitura), só o `cheio`, o `zero` e o Histórico precisam concordar entre si. |
| B2 (filtro "Não é o caso" no `magro`) | Feito. A mensagem do vazio agora depende do filtro (tabela de frases, seção 2): em "Não é o caso" diz "Nenhum dos 9 outliers deu “não é o caso”", sem repetir a frase de "Com a leitura" que contradizia o topo. O contador de qualquer filtro com zero usa a caixa vazada de zero medido (antes só "Com a leitura"). Singular concorda ("1 dos 9 outliers tem a leitura"). |
| C1 (casas esticadas no `carregando`) | Feito. Seletor `.lm-sk > i`; medido: casas 22 x 22 px, esqueleto 92 px igual ao anterior, nos dois hospedeiros. |
| Melhoria 1 ("Bate com" ao lado de "não bate") | Feito. "Bate se tiver 108.000 views ou mais", "Bate se for até 17% / 2% / 1,1%", igual nos três cartões e na sub-condição. |
| Melhoria 2 (texto obrigatório no meio da lista, filtro Todos) | Não mudei: decisão do dono, já listada em dúvidas. A alternativa é o texto abaixo da lista inteira, com "Vale para cada vídeo marcado com Estourou e parou". |
| Melhoria 3 (ordem das linhas muda uma tela existente) | Registrada: o Outliers de hoje ordena por múltiplo; aqui as linhas com a leitura vêm primeiro (decisão 8). Entra na lista de decisões do dono. |
| Melhoria 4 (vão sob os cartões 1 e 3 a 1440) | Sem mudança: os cartões já têm `align-self:start`; o vão vem do cartão 2 ter duas réguas e é o desenho natural. |
| Melhoria 5 (Chiang Mai 2,2× na lista, 1,9× na conta) | Feito. V30 do exemplo sobe de 77.000 para 91.000 (91.000 / 41.500 = 2,19×). |
| Melhoria 6 (filtro "Idade: 30 dias") | Feito. Chip da faixa do mockup vira "Idade: hoje". |
| Melhoria 7 (linha de base da legenda do cartão 2, 5 px) | Não feito: cosmético, não consegui separar de efeito da subgrade sem redesenhar a legenda. Fica para o implementador alinhar as legendas pela base. |

Sem discordância de bloqueio. Não verificado nesta rodada: leitor de tela, Safari, Firefox, Opera, toque real, movimento reduzido; claro a 1440 e escuro a 390 só medidos.
