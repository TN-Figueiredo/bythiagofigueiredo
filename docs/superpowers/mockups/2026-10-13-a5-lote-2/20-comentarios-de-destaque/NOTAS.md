# Mockup 20: Comentários de destaque do vídeo de concorrente (notas)

Abrir: `cd` nesta pasta, `python3 -m http.server <porta 47710-47790> --bind 127.0.0.1`, `open http://127.0.0.1:<porta>/index.html`. O seletor "Estados do mockup" (barra recolhida no topo, fora da tela simulada) troca entre os 13 estados da página do vídeo e os 3 da página do canal. `?tema=claro` liga o tema claro; `?idade=1|7|30` abre a aba; `?todos=1` mostra os 12 cartões de uma vez (o estado "extremo" já abre assim). Capturas em `shots/` (1440 escuro e 390 claro de cada estado; `medidas.json`: rolagem horizontal 0, fonte menor que 12 px 0, alvo menor que 44 px 0 a 390 px, em todas). Peças: `index.html`, `c20.css`, `c20.js` (desenho), `c20-dados.js` (exemplo), mais cópias congeladas de `a4.css`, `a4-comum.js`, `lote.css`, `lote.js` do lote 1. `grep color-mix` só acha comentários "sem color-mix".

Tudo é exemplo (marca "exemplo" na tela): canal Leo (6,2 mil inscritos), vídeo publicado em 06/10, hoje 13/10, marcos 07/10, 13/10 e 05/11. Nada é dado real do dono. A coleta (E14) só existe depois do passo 0 da E17; com uma semana de dado só existem os retratos de 1 e 7 dias, como a tela mostra.

## 1. Decisões de desenho e por quê

1. **A fileira de 12 casas é a forma memorável.** Uma casa por comentário guardado, na cor e no símbolo do motivo; cada casa é um link para o cartão (44 px de altura; a 390 px viram 2 fileiras de 6). Responde de relance "quem está aqui e por quê" sem ler nada. A barra fina "12 de 100" ao lado diz o tamanho da amostra por posição, não só por número.
2. **Quatro motivos, cada um com cor E símbolo** (nenhum matiz novo, só tokens do lote 1): mais curtido = areia + polegar; com o criador = azul (o mesmo do concorrente no mockup 13) + microfone; canal que você acompanha = violeta (`--tier-high`) + olho; canal grande = coral (`--tier-top`) + alvo. O cartão leva o motivo numa etiqueta e na borda esquerda; a cor nunca vai para o texto do comentário.
3. **Motivo com zero nunca some:** "nenhum canal que você acompanha comentou" e "nenhum canal grande entre os 20 mais curtidos" aparecem na legenda como caixa vazada com 0 (zero medido). "1 autor com inscritos ocultos" é hachura rosa (não medido: o tamanho não se sabe, nunca lido como pequeno). É o caso magro, que é o comum, dito em vez de calado.
4. **As três idades são abas de ESTADO.** Cada aba mostra a forma do seu estado (guardados, zero, desligados, não coletado, antes da coleta, fecha em dd/mm) antes de o dono clicar; a aba escolhe a lista. Dentro de cada cartão, as curtidas nas três idades (número + barra na mesma escala de todos os cartões). Um comentário que não estava nos 12 do dia 1 mostra "fora dos 12" em hachura (não medido: não guardamos), **nunca 0**. O que entrou e saiu vem numa linha com + e − ("3 entraram nos 12 do dia 1 ao dia 7 · 3 saíram") e o botão "Ver os 3 que saíram dos 12". Esses 3 aparecem como cartões na aba de 1 dia.
5. **Quatro estados sem comentário, quatro formas:** zero medido (caixa vazada com 0, borda `--im-zero`), desligados pelo canal (hachura rosa + balão cortado, "motivo do canal"), não coletado (hachura rosa + relógio, "motivo nosso" com a data, dois casos: descoberto tarde e lista vazia com contagem maior que 0), fecha em dd/mm (pontilhado + calendário, "ainda não existe"). Os dois rosa se separam pelo símbolo e pela linha de motivo; "antes da coleta" é o quinto, também rosa com calendário.
6. **A resposta do criador é presa ao comentário** (faixa azul com seta de resposta, marca do canal dele: disco com a inicial + "Leo" + selo "criador"). Duas formas próprias para o que não é "sim": "Não vimos resposta do criador" (caixa vazada com 0, a tela nunca diz "não respondeu") e "Não sabemos se o criador respondeu" (hachura rosa + interrogação, com "5 das 62 respostas").
7. **Autor de destaque:** "canal grande" e "canal que você acompanha" têm cor e símbolo próprios; a base vem em faixa, como **duas escadas de 3 degraus** (tamanho: 100 mil a 1 mi, 1 a 10 mi, mais de 10 mi; vezes este canal: 10 a 100, 100 a 1.000, mais de 1.000) com a faixa por extenso ao lado e o ⓘ da regra e dos sete limites. "Razão não medida" é hachura. Os dois momentos do mesmo comentário estão lado a lado na referência fora da tela (com nome e foto até 10/11; depois "Um canal com mais de 10 milhões de inscritos comentou").
8. **Quatro estados do autor:** com identidade ("identidade guardada até dd/mm"), foto que não carrega (disco com a inicial, sem foto), "Um espectador" (disco pontilhado com pessoa), e canal grande sem nome. O criador e o canal acompanhado vêm sempre com nome (cadastro).
9. **Texto de terceiros num bloco rebaixado e neutro, como veio:** sem cor para ofensivo, golpe ou palavrão; endereço é texto, com uma linha "Este comentário tem um endereço. Aqui ele é só texto, não abre." (ícone de elo cortado, sem cor). Longo: 4 linhas, "Ver tudo" (44 px) e a marca "cortado aos 2.000 caracteres". `dir="auto"` no bloco (o árabe alinha à direita), fonte com emoji, `overflow-wrap:anywhere` (a 390 px o endereço de 200 caracteres não gera rolagem, testado aberto e fechado).
10. **Cinco cartões de cada vez** ("Mostrar os outros 7"), para a seção não empurrar a página; a casa da fileira revela tudo e leva ao cartão. **O foco vai para o cartão:** "Mostrar os outros 7" leva o foco ao primeiro cartão revelado e o botão vira "Mostrar só os 5 primeiros" (`aria-expanded` verdadeiro), que recolhe e devolve o foco ao botão; a casa da fileira leva o foco ao cartão de destino (`tabindex="-1"`). É a regra "10 por vez" do lote 1 aplicada com 5 porque o cartão tem 280 a 330 px (a meta do lote 1 para linha de tabela não vale para cartão).
11. **Só leitura, dois níveis (pergunta 41):** "sem o texto" (cadeado, "Texto reservado", autor reservado; vê contagem, estado, curtidas por idade e que o criador respondeu) e "com o texto, sem o nome" (vê o texto; autor vira "Um espectador" e o canal grande vira a faixa). Os dois levam uma faixa no topo dizendo o que não veem e quem vê.
12. **Pastilha "Não veio mais do YouTube desde hoje (13/10)"** com borda tracejada e ícone de balão, a mesma forma do item "comentários" do mockup E aprovado, e o botão "Ver na fila “Saíram do YouTube”" (link para o mockup E).
13. **Página do canal (encaixe no 15):** bloco novo "O criador responde" (frase com "5 de 14", percentual só com 10 ou mais; 14 casas azuis com seta ou vazadas; as 3 sem retrato de 30 dias fora da conta, pontilhadas; ⓘ com a regra e o aviso "é um mínimo") e a lista nova "O que o criador respondeu" (comentário, resposta presa, curtidas aos 7 dias, link para o vídeo). Três estados: com dado (exemplo), "fecha em dd/mm" (o caso real de hoje: 12 vídeos anteriores à coleta em hachura e 4 pontilhados, "05/11 e 09/11") e não medido por poucos vídeos (3 de 14, a conta pede 5). Na lista do canal o texto é o mesmo dado privado.
14. **A moldura do 13** (cabeçalho do vídeo e "curva, 72 horas, dia a dia") aparece só como uma caixa pontilhada cinza dizendo "mockup 13"; a seção nova é o que tem contorno verde-água e "+ novo". Quando o 13 estiver pronto, a seção entra logo depois dele sem mudar.

## 2. Tabela de frases da tela (texto exato)

| Onde | Texto |
|---|---|
| Título da seção | Comentários de destaque (+ marca "exemplo" e ⓘ "Como escolhemos os comentários") |
| Abas | "1 dia", "7 dias", "30 dias"; segunda linha: "12 guardados" / "nenhum comentário" / "desligados pelo canal" / "não coletado" / "antes da coleta" / "fecha em 05/11" |
| Frase-resumo (amostra) | Com 7 dias, guardamos **12 dos 100** primeiros comentários que o YouTube mostra, na ordem de relevância dele: 8 mais curtidos e 4 com o criador (ele respondeu a 3). (O trecho entre parênteses só aparece quando há resposta vista.) |
| Frase-resumo (extremo) | ... 6 mais curtidos, 4 com o criador (ele respondeu a 3), 1 de canal que você acompanha e 1 de canal grande. |
| Frase-resumo (lote completo) | Com 7 dias, guardamos **12 de todos os 37** comentários do vídeo: ... (variante não desenhada: "guardamos todos os 9 comentários do vídeo" quando há menos de 12) |
| Barra | "12 de 100" (completo: "12 de 37 (todos)") |
| Motivos (etiqueta e legenda) | Mais curtido / Com o criador / Canal que você acompanha / Canal grande; legenda "8 mais curtidos", "4 com o criador", "1 de canal que você acompanha", "1 de canal grande, entre os 20 mais curtidos" |
| Motivo com zero | "nenhum canal que você acompanha comentou" (0); "nenhum canal grande entre os 20 mais curtidos" (0); com autor de inscritos ocultos na amostra: "nenhum canal grande entre os 19 que deu para medir" (0) |
| Inscritos ocultos | [não medido] 1 autor com inscritos ocultos |
| Entrou e saiu | "3 entraram nos 12 do dia 1 ao dia 7" · "3 saíram"; "Ver os 3 que saíram dos 12"; no dia 1: "Este é o primeiro retrato. O dia 7 mostra quem entrou e quem saiu dos 12." |
| Cartão | "1 de 12" + motivo; "entrou nos 12 no dia 7"; "Publicado em 07/10 · 62 respostas" (com 0: [0] respostas) |
| Autor | "identidade guardada até 04/11"; "Um espectador"; "Um canal com mais de 10 milhões de inscritos comentou"; "canal do seu cadastro; o nome fica"; selo "criador" |
| Base do canal grande | "mais de 10 milhões de inscritos" · "mais de 1.000 vezes este canal"; faixas: "de 100 mil a 1 milhão de inscritos", "de 1 a 10 milhões de inscritos", "de 10 a 100 vezes este canal", "de 100 a 1.000 vezes este canal"; "razão não medida" + "os inscritos do canal do vídeo estão ocultos" |
| Texto longo | "Ver tudo" / "Mostrar menos"; "cortado aos 2.000 caracteres" |
| Endereço | "Este comentário tem um endereço. Aqui ele é só texto, não abre." |
| Saiu do YouTube | "Não veio mais do YouTube desde hoje (13/10). O YouTube não diz por quê." + botão "Ver na fila “Saíram do YouTube”" |
| Resposta do criador | "Leo [criador] respondeu" + texto; "Não vimos resposta do criador. Conferimos as 4 respostas que o YouTube mostrou e nenhuma é dele." (1 resposta: "Conferimos a única resposta que o YouTube mostrou e ela não é dele."); "Não sabemos se o criador respondeu. O YouTube mostrou só 5 das 62 respostas e nenhuma é dele." |
| Curtidas por idade | "1 dia", "7 dias", "30 dias" + número; "fora dos 12" (não medido); "fecha em 05/11" |
| Zero medido | "Com 7 dias, **nenhum comentário**. O YouTube informou 0 comentários neste vídeo em 13/10." + "zero medido" + "Medimos e deu zero. Isto não é falta de dado: o YouTube confirmou a contagem." |
| Desligados | "**Comentários desligados pelo canal.** O canal Leo desligou os comentários deste vídeo." + [não medido] "motivo do canal" + "Não é zero comentários e não é falha nossa: ninguém pode comentar neste vídeo. Se o canal religar, o próximo retrato mostra." |
| Não coletado (tarde) | "**Não coletado com 1 dia.** Descobrimos o vídeo com 4 dias, depois do prazo de 3 dias para esta idade." + "motivo nosso · 10/10" |
| Não coletado (falhou) | "**Não coletado com 7 dias.** O YouTube diz que o vídeo tem 1.240 comentários, mas devolveu a lista vazia em 13/10." + "motivo nosso · tentativa de 13/10" + "Isto não é “nenhum comentário”: a contagem diz que há. Tentamos de novo até 16/10; se não vier, esta idade fica sem retrato." |
| Antes da coleta | "**Este vídeo é anterior à coleta de comentários.** A coleta começou em 06/10; o vídeo foi publicado em 20/08." + "a coleta começou em 06/10" |
| Fecha em dd/mm | "O retrato de **30 dias fecha em 05/11**." + "ainda não existe" + "O vídeo faz 30 dias em 05/11. Até lá não há o que mostrar, e isto não é zero." |
| Carregando | "Carregando os comentários guardados…" (`aria-busy`, `role="status"`) |
| Erro de leitura | "**Não deu para abrir os comentários agora.** A leitura falhou. Nada foi apagado: o que está guardado continua lá." + "Tentar de novo" (`role="alert"`) |
| Só leitura, sem texto | "**Você vê quantos comentários há e como cada um evoluiu.** O texto fica reservado a quem tem o direito “ver desempenho privado” ou edita o site; o nome e a foto, só a quem edita."; no cartão: "**Texto reservado.** Há um comentário aqui que você não vê."; "Autor reservado" (o criador e o canal acompanhado mostram o nome, que vem do cadastro); "O criador respondeu. O texto da resposta é reservado." |
| Só leitura, sem nome | "**Você vê o texto, mas não o nome nem a foto** de quem comentou. Nos primeiros 28 dias, isso é só de quem edita o site." |
| ⓘ da seção | amostra de 100, quem entra (4 criador, 2 destaque, resto mais curtidos), três idades e "fora dos 12", nome e foto por 28 dias, respostas (até 3 do criador), "Cálculo do Observatório sobre dados públicos do YouTube." |
| ⓘ do canal grande | regra (100 mil inscritos e 10 vezes o canal do vídeo, entre os 20 mais curtidos) e os sete limites, em frases curtas; a mesma frase fixa do cálculo |
| M11 (canal) | "Leo respondeu a comentários em **5 de 14** vídeos com retrato de 30 dias (**36%**). Outros 3 vídeos recentes ainda não fecharam os 30 dias. É um mínimo: só vemos as respostas dele nos 12 comentários guardados de cada vídeo." / "**Ainda não dá para medir.** Só 4 dos 16 vídeos dos últimos 90 dias têm coleta de comentários, e o primeiro retrato de 30 dias fecha em **05/11**." / "**Ainda não dá para medir.** Só 3 dos 14 vídeos têm retrato de 30 dias, e a conta pede pelo menos 5." |
| M11, legenda | "5 vídeos com resposta dele" · "9 vídeos em que não vimos resposta" · "3 ainda sem retrato de 30 dias, fora da conta" · "12 vídeos anteriores à coleta, que começou em 06/10" · "4 esperando os 30 dias (05/11 e 09/11)" · "11 sem retrato de 30 dias (o motivo de cada um está na página do vídeo)" |
| Lista do canal | "O que o criador respondeu"; "Leo respondeu a **6 comentários** guardados, em 5 vídeos com retrato de 30 dias. O mais recente primeiro." (plural por `L.pl`: "2 comentários, em 1 vídeo", "3 comentários, em 2 vídeos"; no estado "fecha": "Leo respondeu a 9 comentários guardados, em 3 vídeos", sem "com retrato de 30 dias", porque aqui nenhum vídeo tem esse retrato); "comentário de 24/11 · 64 curtidas aos 7 dias" (as datas do estado com dado são de 2027-01-12, ver seção 7)". Cabeçalho do canal: "17 vídeos nos últimos 90 dias" no estado com dado, "16" no "fecha" e "14" no "não medido" (três exemplos independentes, ver seção 8, sugestão 2), tudo contado por código (ver seção 7) |
| Nomes acessíveis dos dois ⓘ | no título "Como escolhemos os comentários"; ao lado da frase "Como contamos os 12 de 100 comentários" (vídeo pequeno: "Como contamos os 12 de 37 comentários", e com o retrato de 1 dia "os 12 de 28") |

Nenhuma tela usa "lido", "gravou", "série", "snapshot", "payload" nem "retenção". Onde o spec escreve "12 de 100 lidos por relevância" a tela diz "guardamos 12 dos 100 primeiros comentários que o YouTube mostra, na ordem de relevância dele" (ver dúvida 1).

## 3. Dúvidas para o dono (padrão adotado)

1. **Palavra "lidos".** O spec (4.6.3, ponto 8) e o pedido dizem "12 de 100 lidos por relevância"; as regras do dono proíbem "lido" na tela. Padrão adotado: "guardamos 12 dos 100 primeiros comentários que o YouTube mostra, na ordem de relevância dele". Serve? Padrão: sim.
2. **Cores dos motivos.** O lote 2 não cria matiz; usei `--tier-high` (violeta) e `--tier-top` (coral) como cor de "canal que você acompanha" e "canal grande", porque nos vídeos de concorrente essas duas cores não significam faixa de desempenho. Se o dono preferir um matiz novo e fixo para os dois, é só trocar quatro variáveis em `c20.css` (`.g-a`, `.g-g` e seus fundos). Padrão: manter.
3. **"Fecha em dd/mm" do M11:** o spec lista "a coleta começou há menos de 30 dias" entre os "não medido"; desenhei como "ainda não existe" (pontilhado) para ser a mesma forma do "fecha em dd/mm" dos comentários, e deixei em hachura só o "poucos vídeos com retrato". Padrão: pontilhado.
4. **Cinco cartões por vez** (e não dez, como o lote 1 pede para fila). Padrão: 5.
5. **Pergunta 41 (nome e foto só de quem edita nos 28 dias; quem vê só o texto vê "Um espectador" e "Um canal com mais de 10 milhões de inscritos comentou"):** desenhado no padrão, o mais restrito.
6. **Perguntas 9 e 10** (já respondidas em 12/10; autor de destaque e divisão 4/2/resto): desenhadas como o spec as fechou; nenhuma tela usa "verificado" nem "famoso".
7. **O canal acompanhado mantém o nome depois dos 28 dias (pergunta 21, respondida):** o cartão diz "canal do seu cadastro; o nome fica". Se o dono mudar a resposta, a linha vira "Um canal que você acompanha comentou".
8. **O dono comentando** (`canal_proprio`): não desenhei cartão; a tela reaproveita o selo "seu canal" que já existe, com "Você comentou aqui". Se for para ter cartão e casa próprios, é um quinto motivo.

## 4. O que o implementador precisa saber

- **Nada aparece sem o estado da coleta.** Um retrato tem sempre uma linha (`ok`, `sem_comentarios`, `desligados`, `erro`); **sem linha** é "não coletado" ou "antes da coleta" (conforme a data da primeira coleta), nunca vazio e nunca zero. Mapa: `ok` guardados; `sem_comentarios` zero medido; `desligados` não medido do canal; `erro` e lista vazia com `commentCount` maior que 0 = não coletado (motivo nosso, com a data da tentativa); sem linha e marco futuro = "fecha em dd/mm" (idade + 0 dias; a coleta tem tolerância de 3, 10 e 37 dias).
- **Os três estados de cada aba vêm de dados diferentes:** ok/zero/desligados/erro do retrato; "fecha" e "antes da coleta" da data de publicação contra hoje e contra a data em que a coleta começou. A aba aberta por padrão é a última com estado diferente de "fecha".
- **"fora dos 12" é não medido, não zero:** o comentário não estava no conjunto guardado daquele marco. A conta de "entrou e saiu" é por conjunto de ids entre dois marcos.
- **Ordem da lista:** curtidas do marco aberto, maior primeiro (desempate: respostas, posição, id), igual à seleção. A fileira de casas tem a mesma ordem.
- **O motivo mostrado é o grupo de seleção** (criador, destaque, mais curtidos); a tela mostra o grupo como motivo e os sinalizadores como etiquetas (o criador respondeu, entrou no dia 7). Um comentário só tem um motivo na etiqueta.
- **Privacidade, no leitor e no banco:** texto só para quem edita ou tem "ver desempenho privado"; nome, foto, id de canal só para quem edita nos 28 dias (tabela própria, policy `can_edit_site`). A tela "só leitura sem texto" não pode receber o texto nem escondê-lo por CSS: o leitor devolve só contagens e estados. Teste de saída: o nome sentinela não está no HTML nem no RSC depois dos 28 dias.
- **Texto de terceiros:** renderizar como texto (nunca HTML, nunca `href`), `dir="auto"`, `overflow-wrap:anywhere`, fonte com emoji. O "Ver tudo" só aparece se o texto passar de 4 linhas; o corte de 2.000 caracteres vem do dado (`truncated`), a tela só mostra a marca. Foto: `<img>` com URL do YouTube carregada pelo navegador de quem vê, com `onerror` caindo na inicial; nada de cópia nossa.
- **Cores:** as variáveis `--cd-*-bg` são rgba literais (nenhum `color-mix()`); o texto dos selos e das pastilhas fica em `--text`, só a borda e o ícone levam a cor do motivo.
- **Aba como `role="tablist"`** com setas (testado no mockup); o painel tem `aria-live="polite"`. A fileira de casas é uma `ol` com `aria-label` por casa ("Comentário 3 de 12, mais curtido, 902 curtidas").
- **Não verificado:** leitor de tela, Safari, Opera, ordem de tabulação completa; contraste medido só por inspeção dos tokens do lote 1 (os pares novos, símbolo colorido sobre fundo rgba, estão acima de 3:1 pelos valores, não medidos no navegador); o revisor de UX ainda não viu esta tela.

## 5. Resposta à revisão r2 (`REVISAO-UX-r2.md`)

Conferido nas capturas refeitas (1440 escuro e 390 claro) de: típico, aba de 1 dia, extremo, vídeo pequeno, só leitura (os dois níveis), página do canal (os três estados). Teste de comportamento por script próprio: foco, Home/End, rolagem horizontal 0, nenhuma fonte abaixo de 12 px, nenhum alvo abaixo de 44 px a 390.

- **B1, M11 com dado que não fecha: aceito e resolvido.** Frase "5 de 14 vídeos com retrato de 30 dias (36%). Outros 3 vídeos recentes ainda não fecharam os 30 dias."; cabeçalho "17 vídeos" (14 + 3) e `aria-label` da fileira "...: 17 vídeos"; a lista agora tem 6 comentários em 5 vídeos, o mesmo 5 do M11. Para o exemplo ser coerente, os vídeos do estado "com dado" têm 30 dias fechados (a r4 refez as datas, seção 7); no estado "fecha em dd/mm" a lista é do vídeo de hoje.
- **B2, faixa do só leitura sem texto: aceito e resolvido.** Texto trocado pelo da revisão; agora a faixa concorda com o ⓘ e com o estado "com o texto, sem o nome".
- **B3, foco perdido: aceito e resolvido.** Escolhi a opção que mantém o botão: ele vira "Mostrar só os 5 primeiros" e recolhe; o foco vai ao primeiro cartão revelado (medido: `ARTICLE#c-6`) e, pela casa da fileira, ao cartão de destino (`#c-9`). Anel de foco no cartão só para teclado.
- **B4, "em 1 vídeos": aceito e resolvido.** `L.pl` nas três frases ("2 comentários, em 1 vídeo", "3 comentários, em 2 vídeos").
- **Melhoria 1, trilho da barra: feito.** Borda da barra "12 de 100" e das barras de curtidas em `--dim`.
- **Melhoria 2, zero na casa do M11: feito.** O 0 entra na casa e na legenda ("9 vídeos em que não vimos resposta").
- **Melhoria 3, "0" ao lado de ocultos: feito.** Com autor de inscritos ocultos na amostra a legenda diz "entre os 19 que deu para medir"; sem ocultos, a frase de antes.
- **Melhoria 4, data do comentário que saiu: feito.** "Desde 13/10", o mesmo dia do retrato de 7 dias.
- **Melhoria 5, nome do criador no só leitura sem texto: feito.** Leo aparece nos dois níveis (cadastro, como o spec 9b diz); só o autor comum fica "Autor reservado".
- **Melhoria 6, Home e End nas abas: feito.** Home vai a "1 dia", End a "30 dias" (a aba "fecha em 05/11" recebe foco e mostra o estado "ainda não existe").
- **Melhoria 7, dois ⓘ com o mesmo nome: feito.** O da frase passou a "Como contamos os 12 de 100 comentários".
- **Melhoria 8, ⓘ sozinho a 390 px: feito.** O ⓘ fica colado ao título e a marca "exemplo" (do mockup, não do produto) desce para a linha de baixo.
- **Melhoria 9, "respondeu" na frase: feito em parte.** A frase ganhou "(ele respondeu a 3)", contado nos cartões; não troquei "com o criador" por "em conversa com o criador" para a frase continuar igual à legenda e à etiqueta.
- **Melhoria 10, textos secundários em duas linhas: sem mudança**, como a revisão sugere (convenção 13; o ⓘ da seção é o lugar se o dono achar prosa).

## 6. Resposta à revisão r3 (`REVISAO-UX-r3.md`)

- **B1, "5 das 3 respostas" no lote completo: aceito e resolvido nas duas pontas.** O dado do vídeo pequeno passou a `resp: 'nao'` quando o vídeo tem 3 respostas, e a regra está no desenho (`resposta()`): "Não sabemos" só com mais de 5 respostas; com 5 ou menos o YouTube mostrou todas e a faixa é "Não vimos resposta". A auditoria falha se aparecer "não sabemos" com 5 ou menos, ou "não vimos" com 0 ou mais de 5.
- **B2, datas dos cartões antes do vídeo (vídeo novo): aceito e resolvido.** Os 12 comentários do vídeo de 10/10 são de 10/10 ou 11/10 (o retrato de 1 dia é de 11/10; a sugestão de ir até 13/10 contradiria o próprio retrato). A auditoria confere cada cartão contra a data do vídeo e contra o marco.
- **B2, página do canal (06/09 num vídeo de 06/10): aceito e resolvido, e foi além.** Os dois comentários de 06/09 saíram do vídeo "Mochilão" e foram para vídeos mais antigos, com comentário e resposta próprios (antes eram os mesmos textos do vídeo de hoje). Mas havia uma contradição maior que a revisão não citou (seção 7, item 9): "com dado" e "não medido" mostravam retratos de 30 dias com a coleta começando em 06/10; ganharam um "hoje" próprio, dito fora da tela.
- **Melhoria 1, "relido" no ⓘ: feito.** "Depois dos 30 dias não guardamos mais nada deste vídeo."
- **Melhoria 2, casa vazia da fileira: feito.** O `li` do espaço leva `role="presentation"` e `aria-hidden`.
- **Melhoria 3, textos de 2 linhas: sem mudança** (a revisão não reprova).
- **Melhoria 4, "Nenhum comentário aos N dias" na tabela fora da tela: feito.** Agora "Nenhum comentário" (sem N literal). Segue sendo referência do mockup; o implementador não copia a tabela.
- **Melhoria 5, página do vídeo longa a 390 px: sem mudança.** A alavanca (3 linhas em vez de 4 a 390 px) fica com o dono; os 5 cartões por vez já seguram.

## 7. Varredura de coerência da r4 (todos os estados) e tabela de coerência

Método: os números não são digitados duas vezes. Contagens (guardados, partes da frase, legenda, barra, aba, "Mostrar os outros", "entraram/saíram", "ele respondeu a N", "5 de 14", "36%", "17 vídeos", casas do M11, "N comentários em M vídeos", datas de fechamento, "identidade guardada até") saem por código de `c20-dados.js` (fonte única). `c20.js` ainda confere os dados ao abrir (`window.C20_AUDITORIA`, lista vazia = fecha) e `shots/auditoria-r4.mjs` abre os 16 estados mais 5 abas extras e confere o texto na tela contra os dados (resultado final: AUDITORIA LIMPA, 0 contradições). Antes do conserto, a mesma auditoria acusou 58 contradições; as reais estão nos itens abaixo.

### 7.1 Contradições achadas além das duas da revisão (todas consertadas)

1. **Comentário de 08/10 no retrato de 1 dia (07/10)** (cartões 6 e 11 do típico, 6 do extremo): agora 07/10.
2. **Comentário com mais curtidas que o vídeo** (4.108 curtidas num vídeo de 1,9 mil; no vídeo novo, 1.109 num de 260): curtidas dos comentários reescaladas (~10% das do vídeo; 411 no típico; no pequeno 41 no topo aos 7 dias e 13 no dia 1; 37 no novo).
3. **Vídeo novo com amostra "12 de 100" e 92 comentários:** agora "12 de todos os 92"; respostas somam 37, mais 12 comentários = 49, cabem nos 92. Texto "o item 4" num vídeo de "Três erros" virou "o item 3".
4. **Zero medido com 1.240 comentários no cabeçalho:** o vídeo do estado "zero" tem 0 comentários e 412 views. **Desligados** mostrava 1.240: agora a célula é "não medido".
5. **Zero medido no retrato de 1 dia: "Com 1 dias" e "em 13/10":** agora "Com 1 dia" e "em 07/10" (o dia do retrato).
6. **"Antes da coleta" com vídeo de 28/09:** o retrato de 30 dias (28/10) ainda viria depois da coleta (06/10). O vídeo agora é de 20/08 (47 dias na coleta) e a frase diz isso.
7. **Lote completo, aba de 1 dia com 9 guardados** (deviam ser 12): ganhou os 3 que saíram.
8. **Só leitura sem texto: a lista "Ver os 3 que saíram" mostrava o texto dos comentários:** agora "Texto reservado".
9. **Página do canal, "com dado" e "não medido" com retratos de 30 dias e coleta de 06/10:** impossível em 13/10. Os dois estados simulam 12/01/2027 (nota "Data deste exemplo" fora da tela); "fecha em dd/mm" segue em 13/10. O comentário do "fecha" agora é dos 3 comentários do vídeo de hoje em que o criador respondeu (antes eram 2, e o vídeo diz 3).
10. **"Identidade guardada até" digitada por cartão:** agora derivada (primeiro retrato + 28 dias; 04/11, 10/11 e, no vídeo novo, 08/11). A referência fora da tela deixou de seguir o vídeo aberto.
11. **Lista do canal repetia os mesmos comentários e curtidas do vídeo "Mochilão" em outros vídeos:** textos e números próprios.

### 7.2 Tabela de coerência (cada número, de onde deriva, com o que tem de fechar)

Dados de exemplo: hoje 13/10/2026; coleta desde 06/10. Marcos: pub + 1, 7 e 30 dias. Sinal de ok na última coluna = conferido pela auditoria e pelas capturas.

| Estado | Número na tela | Deriva de | Tem de fechar com | Ok |
|---|---|---|---|---|
| Típico (7 dias) | 12 guardados / "12 dos 100" / barra 12 de 100 / 12 casas / aba "12 guardados" | `D.tipico` (12 com curtida aos 7 dias) | 12 cartões, "k de 12", legenda 8+4 | sim |
| Típico | "8 mais curtidos e 4 com o criador (ele respondeu a 3)" | grupos c/k e `resp==='sim'` (ids 4, 7, 12) | 3 cartões com faixa azul; legenda 8 e 4 | sim |
| Típico | "3 entraram · 3 saíram" | `novo` (ids 3, 7, 9) e `saiuTipico` | 12 − 3 + 3 = 12; 3 etiquetas "entrou nos 12 no dia 7"; "Ver os 3" lista 3 | sim |
| Típico | "entre os 19 que deu para medir" + "1 autor com inscritos ocultos" | `ocultos: 1` | 19 + 1 = 20 | sim |
| Típico | cartão "Publicado em dd/mm" | `pub` de cada comentário | ≥ 06/10; no retrato de 1 dia só até 07/10; quem entrou no dia 7 é de depois de 07/10 | sim |
| Típico | curtidas 1 / 7 / 30 dias | `l` | 1 ≤ 7; nenhuma passa as 1,9 mil do vídeo; "fecha em 05/11" = 06/10 + 30 | sim |
| Típico | "N respostas" e "Conferimos as N" / "só 5 das 62" | `rep` | "Não vimos" com 1 a 5; "Não sabemos" só com mais de 5; soma 109 + 12 ≤ 1.240 | sim |
| Típico | "identidade guardada até 04/11 / 10/11" | primeiro retrato + 28 dias | 07/10 + 28 = 04/11; 13/10 + 28 = 10/11 | sim |
| Aba de 1 dia | 12 guardados, "9 mais curtidos e 3 com o criador (ele respondeu a 2)" | `l[0]` + `saiuTipico` | 9 + 3 = 12; sem etiqueta "entrou no dia 7"; texto "primeiro retrato" | sim |
| Extremo | "6 mais curtidos, 4 com o criador (3), 1 acompanhado, 1 grande" | `D.extremo` | 6+4+1+1 = 12; legenda sem zero; grande "mais de 10 mi" e "mais de 1.000 vezes" = 10 mi / 6,2 mil | sim |
| Lote completo, 7 dias | "12 de todos os 37" / barra "12 de 37 (todos)" | `D.completo`; `C.total` = comentários de hoje (13/10), que é o dia do retrato de 7 dias | total = cabeçalho do vídeo; 12 comentários + 21 respostas = 33 ≤ 37 | sim |
| Lote completo, 1 dia | "12 de todos os 28" / barra "12 de 28 (todos)" / ⓘ "Como contamos os 12 de 28 comentários" | `totalDia(1)` = 37 - 3 comentários posteriores a 07/10 (ids 3, 7, 9) - 6 respostas deles (3 + 3 + 0) = 28 | 28 ≤ 37 (hoje); 28 ≥ 12 guardados + 15 respostas dos que estavam no dia 1 = 27; nenhum cartão da aba é de depois de 07/10 | sim |
| Lote completo | curtidas (41 no topo aos 7 dias, 13 no dia 1) | ~10% do típico por `ranqueia`, sem empate no piso | menor que as 214 curtidas do vídeo; "Não vimos" em todos os de 3 respostas | sim |
| Vídeo novo | publicado em 10/10 (há 3 dias); "1 dia", "fecha em 17/10", "fecha em 09/11" | `D.VIDEO_NOVO` | 10/10 + 7 = 17/10; + 30 = 09/11 | sim |
| Vídeo novo (retrato de 1 dia, 11/10) | "12 de todos os 71" / barra "12 de 71 (todos)"; o cabeçalho do vídeo segue com 92 (hoje) | `totalDia(1)` = 92 - `D.VIDEO_NOVO.fora[1]` (21 comentários de 12/10 e 13/10 fora dos 12) = 71 | 49 (12 + 37 respostas) ≤ 71 ≤ 92; todos os cartões de 10/10 ou 11/10 | sim |
| Vídeo novo | cartões de 10/10 e 11/10; ident. até 08/11 | `PUB_NOVO` | todos ≥ 10/10 e ≤ 11/10 (retrato de 1 dia); 11/10 + 28 = 08/11 | sim |
| Zero medido | cabeçalho "0 comentários"; "O YouTube informou 0 comentários em 13/10 / 07/10" | `D.VIDEO_ZERO`, marco da aba | cabeçalho = frase; data = dia do retrato; "Com 1 dia / 7 dias" | sim |
| Desligados | cabeçalho "comentários: não medido" | `com: null` | a tela diz "desligados": não é zero nem número | sim |
| Não coletado | "1.240 comentários" na frase | `D.VIDEO.com` | = cabeçalho; "descobrimos com 4 dias" = 10/10; "até 16/10" = 06/10 + 10 | sim |
| Antes da coleta | "publicado em 20/08", "47 dias, mais que os 30" | `D.VIDEO_ANTES`, `D.COLETA` | 20/08 → 06/10 = 47 dias; 20/08 + 30 = 19/09, antes da coleta; 3 abas "antes" | sim |
| Carregando / Erro | sem números de comentário | n/a | cabeçalho do vídeo igual ao típico | sim |
| Só leitura, sem texto | mesmos números do típico | `leitor: 'sem'` | texto reservado também na lista dos que saíram | sim |
| Só leitura, com texto | 6+4+1+1 (extremo) | idem extremo | nenhum nome (grande vira a faixa) | sim |
| Canal, com dado | "5 de 14 (36%)"; "3 recentes"; "17 vídeos" | `D.RESPOSTAS` (5 vídeos), `D.CANAL_NAO` (9), `D.CANAL_RECENTES` (3) | 5+9+3 = 17 casas; 5 azuis; 9 com 0; 3 pontilhadas; 5/14 = 35,7% = 36%; mínimo de 5 vídeos | sim |
| Canal, com dado | "6 comentários, em 5 vídeos com retrato de 30 dias" | itens da lista | 5 vídeos = 5 casas azuis; cada comentário ≥ data do vídeo e até 7 dias depois; todos com 30 dias fechados em 12/01/2027; ordem decrescente | sim |
| Canal, fecha | "4 dos 16 vídeos", "12 anteriores", "(05/11 e 09/11)", cabeçalho "16 vídeos" | `D.CANAL_FECHA_VIDEOS` (Mochilão, Pho, Bastidores, Hué: os quatro vídeos recentes das telas de vídeo) + `D.CANAL_ANTES` (12) | 12 + 4 = 16 casas; 06/10 + 30 = 05/11 (3 vídeos); 10/10 + 30 = 09/11; os 12 anteriores têm mais de 30 dias em 06/10 e entram nos 90 dias (o mais antigo, 18/07 ≥ 15/07) | sim |
| Canal, fecha | "9 comentários, em 3 vídeos"; rótulo "curtidas no dia 1" (Hué) e "aos 7 dias" (Mochilão, Pho) | os comentários com resposta de Leo nos conjuntos `D.tipico`, `D.completo`, `D.novo`, por código; Bastidores tem 0 comentários | 3 + 3 + 3: é o "ele respondeu a N" de cada página de vídeo (conferido pela auditoria abrindo as três páginas); datas e curtidas iguais às dos cartões; o marco do rótulo é o retrato que existe (Hué só tem o de 1 dia); nenhum texto repetido na lista | sim |
| Canal, não medido | "3 dos 14"; 2 + 1 + 11 casas; "mínimo 5" | 5 vídeos com resposta + 9 sem, menos 3 com retrato | 2 azuis + 1 com 0 = 3; 11 hachuradas; 3 < 5; lista "3 comentários, em 2 vídeos" = 2 casas azuis | sim |

Conferido contra as capturas (1440 escuro e 390 claro, refeitas em `shots/`): abri novo, completo, zero, antes, canal (com dado) e canal (fecha); os demais passaram só pela auditoria de texto da tela e pelas medidas (rolagem horizontal 0, nenhuma fonte abaixo de 12 px, nenhum alvo abaixo de 44 px a 390 px, em 32 capturas).

### 7.3 Não verificado
- Leitor de tela, Safari, Opera; fontes reais (a captura cai nas do sistema); tema claro a 1440 e escuro a 390 não foram refeitos nesta rodada; a tabela de referência "Os quatro estados" rola na horizontal dentro da área fora da tela a 390 px (já era assim, fora da tela simulada).


## 8. Resposta à revisão r4 (`REVISAO-UX-r4.md`)

Método: a fonte única continua sendo `c20-dados.js`. Novos dados: `D.CANAL_FECHA_VIDEOS` (os vídeos do "fecha") e `D.VIDEO_NOVO.fora`; novas contas por código em `c20.js`: `totalDia(k)`, `curt()` e a lista do canal-fecha. A auditoria passou a `shots/auditoria-r5.mjs` (a r4 fica como estava) e agora também abre as páginas de vídeo e compara com a lista do canal.

- **B1, "fecha em dd/mm" diz 1 vídeo e Hué tem 3 respostas do criador: resolvido, e além do pedido.** A lista do canal-fecha sai de `D.CANAL_FECHA_VIDEOS` (Mochilão, Pho, Bastidores, Hué): "9 comentários, em 3 vídeos". O item de Hué diz "curtidas no dia 1" (`m: 1`), os outros "aos 7 dias". Ordem: data do comentário, depois vídeo mais novo, depois curtidas. A frase do bloco passou a "Só 4 dos 16 vídeos" e a legenda "4 esperando os 30 dias (05/11 e 09/11)". Achado novo na mesma varredura: Pho e Bastidores (06/10) existem nas telas de vídeo e faltavam no canal; entraram. Pho tem 3 respostas do criador, também na lista. Hué e Pho ganharam textos próprios nesses 3 comentários (antes repetiam os do Mochilão, e a lista os mostraria duplicados).
- **C1, aba de 1 dia afirma o total de hoje: resolvido.** `totalDia(k)`: completo 1 dia = 37 - 3 - 6 = 28 ("12 de todos os 28"); novo = 92 - 21 = 71 ("12 de todos os 71"). A frase, a barra (e o preenchimento), o `aria-label` e o ⓘ usam o total do dia; o cabeçalho do vídeo segue com o de hoje. A auditoria confere: total do dia entre guardados + respostas e o total de hoje; retrato de hoje = total de hoje; nenhum cartão do retrato é de depois dele.
- **C2, "1 curtidas": resolvido.** `curt()` no rótulo das casas, "curtida/curtidas" na lista dos que saíram e na lista do canal; "0 curtidas" fica no plural. A auditoria passou a procurar "1 curtidas/respostas/comentários/vídeos/dias/autores" no texto e nos `aria-label` de todos os estados (0 achados).
- **Sugestão 1, "Mais curtido" com empate de 1: feito.** Curtidas do vídeo pequeno reescaladas por posição (`ranqueia`, ~10%, piso 2, cada posição com pelo menos 1 curtida a mais que a de baixo; dia 1 nunca maior que o dia 7). O topo do vídeo pequeno agora é 41 / 15 / 11 / 10 / 9 ... com 214 curtidas no vídeo.
- **Sugestão 2, mundos diferentes: feito.** 20/08 no lugar de 19/08 em `D.CANAL_ANTES` (o vídeo "Hanói de trem" cabe nos 90 dias). O canal-fecha usa os mesmos vídeos das telas de vídeo. Nota fora da tela em cada estado do canal: "fecha em dd/mm" é o canal de 13/10 com esses vídeos; "com dado" e "não medido" são exemplos à parte, com vídeos e números próprios (por isso 17 contra 14 vídeos em 12/01/2027 não é contradição).
- **Sugestão 3, textos que não combinam com o vídeo: feito em parte.** Os 3 comentários com resposta de Pho e de Hué têm texto próprio e sobre o vídeo. Os demais textos de exemplo continuam repetidos entre vídeos (não entram em nenhuma lista junta).
- **Sugestão 4, ⓘ "12 de 37 (todos) comentários": feito.** Agora "Como contamos os 12 de 37 comentários".
- **Sugestão 5, "desde 13/10": feito.** "Não veio mais do YouTube desde hoje (13/10)."
- **Sugestão 6, casa vazia, textos de duas linhas e página longa a 390 px: sem mudança** (a revisão não pede).

### 8.1 Varredura de coerência da r5 (todos os estados), o que achei além da revisão
1. Pho e Bastidores faltavam na lista de vídeos do canal-fecha (acima).
2. Textos duplicados entre Mochilão, Pho e Hué nos comentários com resposta (acima).
3. Rótulo "aos 7 dias" não vale para Hué (só tem o retrato de 1 dia): agora vem do marco que existe.
4. A auditoria da r4 não cruzava telas: a r5 abre `tipico` (7 dias), `completo` (7 dias), `novo` (1 dia) e `zero` e compara "ele respondeu a N" com a lista do canal; um vídeo da lista sem página conferida também falha.
5. Tabela de coerência da seção 7.2: linhas "Lote completo", "Vídeo novo" e "Canal, fecha" atualizadas acima; as demais não mudaram.

Resultado: AUDITORIA LIMPA (0 contradições em 16 estados, 5 abas extras e o cruzamento), 34 capturas refeitas em `shots/` (16 estados mais o lote completo com 1 dia, 17 × 2 larguras) (1440 escuro e 390 claro) com rolagem horizontal 0, nenhuma fonte abaixo de 12 px e nenhum alvo abaixo de 44 px a 390. Abri e conferi nas capturas: canal-fecha (1440 e 390) e completo com a aba de 1 dia (1440). Os demais estados passaram pela auditoria de texto e pelas medidas, sem mudança de layout.

### 8.2 Não verificado
Leitor de tela, Safari, Opera, fontes reais; tema claro a 1440 e escuro a 390; escala de cinza (nenhum símbolo ou forma mudou); a captura de 390 do completo com 1 dia não foi aberta (só a de 1440).

## 9. Resposta à revisão r5 (`REVISAO-UX-r5.md`)

Método: a fonte única continua `c20-dados.js`; nada novo é digitado em dois lugares. O piso dos que saíram e o "menos de 20 comentários principais" saem por código. A `shots/auditoria-r5.mjs` ganhou duas conferências (dado e tela) e passou a capturar também o lote completo com 1 dia.

- **B1, quem saiu dos 12 tinha mais curtidas do que quem ficou: resolvido.** `c20-dados.js`: depois do `ranqueia`, `piso` = menor curtida aos 7 dias entre os "mais curtidos" que ficaram (3) e cada um que saiu recebe `piso - 1` (o terceiro, mais 1 abaixo, com mínimo de 1): a lista diz "2 curtidas no dia 1", "2 curtidas no dia 1", "1 curtida no dia 1". Conferido na tela (1440 e 390). Auditoria: `c20.js` (`window.C20_AUDITORIA`) e `auditoria-r5.mjs` falham se, em qualquer estado com "saíram", alguém que saiu tiver mais curtidas do que o menor "Mais curtido" que ficou; desfiz a correção por um instante e as duas conferências acusaram "7, 5, 3 contra 3", depois restaurei. Típico e extremo fecham (10 contra 22).
- **C1, "20 mais curtidos" num vídeo de no máximo 16 comentários principais: resolvido.** `poucosPrincipais()` em `c20.js`: total do dia menos as respostas dos guardados do dia; se der menos de 20, a legenda e o zero medido dizem "nenhum canal grande entre os comentários do vídeo" (lote completo: 37 - 21 = 16, 1 dia: 28 - 15 = 13). Vídeo novo (71 - 37 = 34) e típico seguem com "20 mais curtidos". A auditoria confere a frase contra a conta nos dois sentidos. O ⓘ não muda.
- **C2, NOTAS com números que a tela não mostra: resolvido.** Seção 1 item 12 (desde hoje (13/10)), 7.1 item 2 (41 no topo, 13 no dia 1), 7.2 (linha "curtidas") e a contagem de capturas (34, não 32; a pasta tinha 32 antes de eu acrescentar o completo de 1 dia). Linha nova na tabela abaixo.
- **Sugestão 1, "sábado" no comentário da Carla (Pho): feito.** O comentário é de 07/10 e o vídeo de 06/10; agora "Fui na terceira barraca hoje cedo e confirmo".
- **Sugestão 2, empates no "Mais curtido": mantida.** Piso dos que saíram aplicado como a revisão pede; ficam os empates 6 e 6 do dia 1 (Valentina e Diego) no vídeo pequeno e 2 e 2 no fim do vídeo novo, que não contradizem nada.
- **Sugestão 3, "12 de 37 (todos)" mistura base: não feita.** Fica como dúvida para o dono se ele estranhar (os 12 são principais e os 37 incluem respostas; o ⓘ explica a conta).
- **Sugestão 4, "11 sem retrato de 30 dias": feito.** A legenda diz "sem retrato de 30 dias (o motivo de cada um está na página do vídeo)".
- **Sugestões 5 e 6 (textos repetidos entre vídeos; casa vazia, textos de duas linhas e altura a 390 px): sem mudança**, como na r4.

### 9.1 Varredura de coerência (todos os estados), o que achei além da revisão

1. A mesma regra do B1 vale para o típico, o extremo e as duas telas de só leitura (os que saem têm 10, 7 e 5; o piso é 22). Passou a ser conferida em todos pela auditoria; nenhum outro falhava.
2. Aba de 1 dia do lote completo: quem saiu (2, 2 e 1) tem curtidas iguais ou menores que o menor "Mais curtido" que estava nos 12 do dia 1 (Yuki, 3). Fecha.
3. Texto dos comentários com dia da semana, "ontem" ou "hoje": só havia o "sábado" da Carla (consertado); os demais não citam data.
4. "o item 4" só existe em vídeos com 4 itens ou mais (Mochilão e Pho; Hué virou "item 3"). **Esta conferência de nomes estava errada e foi trocada na r6 (seção 10): a resposta do criador não pode citar o nome do autor, porque o só leitura esconde esse nome.**
5. Zero medido e antes da coleta, carregando e erro, desligados, não coletado, canal (com dado, fecha, não medido): sem número que dependa do que mudou; refeitos pela auditoria e pelas capturas sem contradição.

### 9.2 Tabela de coerência: linhas novas e alteradas

| Estado | Número na tela | Deriva de | Tem de fechar com | Ok |
|---|---|---|---|---|
| Lote completo, 7 dias | "Ver os 3 que saíram": 2, 2 e 1 curtida no dia 1 | `D.saiuCompleto`, `piso - 1` (e `piso - 2` no terceiro) | cada uma menor ou igual à menor curtida aos 7 dias entre os "mais curtidos" que ficaram (3: Yuki); 12 − 3 + 3 = 12 | sim |
| Lote completo, 1 dia | lista com os mesmos 3 (2, 2, 1) entre os 12 | idem | menor ou igual ao menor "mais curtido" do dia 1 (3); 9 + 3 = 12 | sim |
| Lote completo, 7 dias | legenda "nenhum canal grande entre os comentários do vídeo" | `poucosPrincipais()` = `totalDia(7)` 37 − 21 respostas = 16 | 16 < 20: não pode falar em "20 mais curtidos"; 12 guardados + 3 que saíram = 15 ≤ 16 | sim |
| Lote completo, 1 dia | mesma legenda | `totalDia(1)` 28 − 15 respostas = 13 | 13 < 20; 12 guardados ≤ 13 | sim |
| Vídeo novo, 1 dia | legenda "20 mais curtidos" | 71 − 37 respostas = 34 | 34 ≥ 20 | sim |
| Típico e extremo | legenda "20 mais curtidos" / "19 que deu para medir" | total 100 (amostra de 100) | 100 ≥ 20; 19 + 1 oculto = 20 | sim |
| Típico, extremo, só leitura | "Ver os 3 que saíram": 10, 7 e 5 curtidas no dia 1 | `D.saiuTipico` | menores que o piso de 22 aos 7 dias | sim |
| Canal, não medido | "11 sem retrato de 30 dias (o motivo de cada um está na página do vídeo)" | `D.CANAL_*` | 3 + 11 = 14 casas; "3 dos 14" | sim |
| Pho, comentário da Carla | "hoje cedo", publicado em 07/10 | `D.T.phoQ3` | o vídeo é de 06/10; a visita é depois dele | sim |

Conferido contra as capturas (34 em `shots/`, 1440 escuro e 390 claro): abri o lote completo com 7 dias (1440 e 390, lista dos que saíram aberta) e o canal não medido (390); o texto da aba de 1 dia do completo veio da extração do DOM. Auditoria limpa em 16 estados, 6 abas e o cruzamento; rolagem horizontal 0, nenhuma fonte abaixo de 12 px, nenhum alvo abaixo de 44 px a 390.

### 9.3 Não verificado
Leitor de tela, Safari, Opera, fontes reais; tema claro a 1440 e escuro a 390; a captura de 390 do completo com 1 dia só pela extração de texto.


## 10. Resposta à revisão r6 (`REVISAO-UX-r6.md`)

Método: a fonte única continua `c20-dados.js`; nenhum número novo foi digitado. A conferência nova está em `shots/auditoria-r6.mjs` (a r5 fica como estava): além de tudo o que a r5 conferia, ela (a) falha se, em `leitura` e `leitura-privado`, qualquer nome próprio de autor (completo ou primeiro nome, de `D.tipico`, `D.extremo`, `D.completo`, `D.novo` e dos que saíram; o canal acompanhado, como Nômade Raiz, fica de fora porque o nome dele é do cadastro) aparecer no texto, nos `aria-label`, nos `title`/`alt` ou nos `details` da tela simulada; (b) falha se a resposta do criador cita o nome de um autor em QUALQUER estado; (c) falha se um autor com resposta do criador se repete entre Mochilão, Pho e Hué. Teste de mutação: devolvi "Está sim, Marcos." a uma resposta e a auditoria acusou o nome em todos os estados que mostram o cartão (típico, extremo, só leitura); depois restaurei.

- **B1, resposta do criador cita o nome que o só leitura esconde: resolvido.** Os sete vocativos saíram de `c20-dados.js` ("Está sim. Entrei em setembro...", "Obrigado pelo detalhe. Vou fixar...", "Ainda é o local. Nas barracas...", "Obrigado pelo aviso. Vou fixar...", "O terceiro: reservei o trem...", "Vá de manhã, antes das nove: ...", "Precisa da internacional. Sem ela..."). Conferi nas capturas: `20-leitura-privado-1440-escuro.png` e `-390-claro.png` (cartão 4: "Um espectador" e "Está sim. Entrei em setembro"). Conferência trocada na seção 9.1 item 4.
- **C1, NOTAS descreve frases do canal que a tela já não mostra: resolvido.** As seis linhas foram refeitas a partir da extração do DOM: seção 1 item 13 (4 pontilhados), seção 2 linhas "M11 (canal)" (4 dos 16), "M11, legenda" (4 esperando; 11 sem retrato com a frase atual), "Lista do canal" ("com retrato de 30 dias"; 9 comentários em 3 vídeos no "fecha"; cabeçalho 17, 16 e 14), "Saiu do YouTube" (desde hoje (13/10)). Também corrigi a linha "Frase-resumo (extremo)", que não tinha "(ele respondeu a 3)". Linha nova na tabela de coerência: seção 10.2.
- **Sugestão 1, "12 de todos os 28" ao lado de "37": não feita.** Os números fecham (28 era o total no dia 1; o `aria-label` e o ⓘ dizem isso); fica como dúvida para o dono se ele estranhar.
- **Sugestão 2, "Mais curtido" com 1 e 2 curtidas: não feita.** Fecha com a regra (13 principais, 12 guardados); aceitável, como o revisor diz.
- **Sugestão 3, o mesmo trio comenta em todos os vídeos: feita.** Pho: Ana Beatriz Luz, Kenji Mori, Sofia Lund; Hué: Tomás Reis, Helena Vaz, Ravi Sethi (em `c20-dados.js`, depois do bloco de cada vídeo). Mochilão segue com Marcos, Priya e Carla. A auditoria r6 falha se um autor com resposta do criador se repetir entre os três vídeos.
- **Sugestão 4, textos que não combinam com o vídeo: feita.** Hué: o comentário 1 fala de Hué ("o erro 2", calor do meio-dia), o 3 em inglês fala da cidadela ("imperial city part"), e os de espanhol, árabe e japonês falam de Hué, não de Hanói. Pho: o comentário em inglês fala das barracas ("street food part"), não de Ha Giang.
- **Sugestão 5, jargão "erro commentsDisabled" na tabela fora da tela: feita.** Agora "o canal desligou os comentários" (`c20.js`).
- **Sugestão 6, casa vazia, textos de duas linhas e altura a 390 px: sem mudança**, como na r3.

### 10.1 Varredura de coerência (todos os estados), o que achei além da revisão

A classe de erro desta rodada era nome, não número. Rodei a mesma conferência de nomes em todos os estados e li o texto de cada um (extração do DOM de 21 combinações de estado e aba, `shots/auditoria-r6.mjs` mais uma extração à parte do texto de `leitura-privado`, `novo` e `canal-fecha`).

1. **Texto de comentário que não combina com o vídeo (Hué e Pho): consertado, ver sugestão 4.** Era a mesma classe do "item 4" da r5: um texto que diz uma coisa e o vídeo outra. Nenhuma tela mostra mais uma cidade errada.
2. **Nome do autor em outros pontos da tela só leitura:** além das respostas, olhei a lista "Ver os 3 que saíram dos 12" (mostra "um espectador"), os `aria-label` das casas, as iniciais dos discos e o ⓘ: nenhum nome. Fecha.
3. **Autor do cartão que "Ele respondeu a" na lista do canal:** a lista não mostra nome de autor em nenhum estado.
4. **Datas e "há N dias":** "há 7 dias" (06/10 a 13/10), "há 3 dias" (10/10 a 13/10), "há 54 dias" (20/08 a 13/10); o comentário "hoje cedo" de Pho é de 07/10, depois do vídeo de 06/10. Fecha.
5. **Números:** a auditoria de números da r5 segue limpa nos 17 estados, 6 abas e no cruzamento (0 contradições); nenhum número mudou nesta rodada.

### 10.2 Tabela de coerência por estado (r6)

Cada número mostrado, de onde ele deriva (tudo em `c20-dados.js`, contado por `c20.js`) e com o que tem de fechar. "Capt." = conferido na captura aberta; "DOM" = conferido na extração de texto da tela (a mesma que a auditoria usa). Hoje = 13/10/2026; coleta desde 06/10.

| Estado | Mostrado | Deriva de | Tem de fechar com | Conf. |
|---|---|---|---|---|
| Típico, 7 dias | "12 dos 100", barra 12 de 100, 12 casas, 12 cartões, aba "12 guardados" | `D.tipico` (12 com curtida aos 7 dias), amostra de 100 | "k de 12" nos cartões; 8 mais curtidos + 4 com o criador = 12; 12 menor que 100 | DOM |
| Típico, 7 dias | "ele respondeu a 3"; "3 entraram · 3 saíram"; saíram com 10, 7 e 5 curtidas; "19 que deu para medir" + 1 oculto | cartões com `resp: 'sim'` (ids 4, 7, 12); `novo` (3, 7, 9); `D.saiuTipico` | 3 faixas azuis; 12 − 3 + 3 = 12; 10, 7 e 5 menores que o piso de 22; 19 + 1 = 20 | DOM |
| Típico, 1 dia | "9 mais curtidos e 3 com o criador (ele respondeu a 2)"; nenhum "entrou no dia 7" | `l[0]` e `resp` dos que estavam no dia 1 | 9 + 3 = 12; Priya (11/10) não entra; cartões até 07/10 | DOM |
| Típico, resposta do criador | nenhuma resposta cita o nome do autor | texto de `D.T.resp*` | auditoria r6, em todos os estados | DOM |
| Extremo, 7 dias | 6 + 4 + 1 + 1 = 12, "1 de canal grande, entre os 20 mais curtidos"; "mais de 10 milhões", "mais de 1.000 vezes" | `D.extremo` (cartão 3 grande, cartão 6 acompanhado) | 10 mi dividido por 6,2 mil = 1.612; o canal grande entrou em 11/10 | Capt. |
| Extremo, 1 dia | 8 + 3 + 1 = 12; "nenhum canal grande entre os 20 mais curtidos" | canal grande só existe a partir de 11/10 | 0 medido, não "sem dado" | DOM |
| Vídeo pequeno, 7 dias | "12 de todos os 37", barra 12 de 37; saíram com 2, 2 e 1 curtida; "nenhum canal grande entre os comentários do vídeo" | `D.completo` e `D.saiuCompleto` (`piso − 1`); 37 − 21 respostas = 16 principais | 12 + 21 + 3 = 36 menor ou igual a 37; saíram menor ou igual ao menor "Mais curtido" que ficou (3); 16 menor que 20 | Capt. + DOM |
| Vídeo pequeno, 1 dia | "12 de todos os 28", barra 12 de 28; "9 + 3 (ele respondeu a 2)" | `totalDia(1)` = 37 − 3 − 6 = 28; 28 − 15 = 13 principais | 28 menor ou igual a 37; 13 menor que 20; cartões até 07/10 | Capt. + DOM |
| Vídeo pequeno | autores com resposta do criador: Ana Beatriz Luz, Kenji Mori, Sofia Lund; texto em inglês fala das barracas | `D.completo[3, 6, 11].au` | não se repetem em Mochilão nem Hué | DOM |
| Vídeo novo, 1 dia | "12 de todos os 71", barra 12 de 71; "ele respondeu a 3"; "fecha em 17/10 e 09/11"; ident. até 08/11 | `totalDia(1)` = 92 − 21 = 71; 10/10 + 7 e + 30; 11/10 + 28 | 49 menor ou igual a 71 menor ou igual a 92; 71 − 37 = 34 maior ou igual a 20; cartões de 10/10 ou 11/10 | Capt. + DOM |
| Vídeo novo | autores Tomás Reis, Helena Vaz, Ravi Sethi; textos de Hué | `D.novo[...]` | cidade e item do texto batem com o vídeo ("erro 2", de 3) | Capt. |
| Zero medido | "0 comentários" no cabeçalho; "O YouTube informou 0 comentários em 13/10 (7 dias) e em 07/10 (1 dia)"; "Com 1 dia" | `D.VIDEO_ZERO`; data = dia do retrato | 412 views e 9 curtidas; não é "não medido" | DOM |
| Desligados | cabeçalho "comentários: não medido", hachura rosa | `com: null` | nunca um zero nem um número | DOM |
| Não coletado | "1.240" na frase; "descobrimos com 4 dias" (10/10); "até 16/10" | `D.VIDEO.com`; 06/10 + 4; 06/10 + 10 | 1.240 = cabeçalho; 4 maior que o prazo de 3 dias | DOM |
| Antes da coleta | "publicado em 20/08", "há 54 dias" no cabeçalho do vídeo; "47 dias" na coleta | `D.VIDEO_ANTES`, `D.COLETA` | 20/08 a 13/10 = 54; 20/08 a 06/10 = 47; 20/08 + 30 = 19/09, antes da coleta | DOM |
| Carregando, erro | sem número de comentário | n/a | cabeçalho igual ao típico | DOM |
| Só leitura, sem texto | mesmos números do típico; "Texto reservado"; "Autor reservado" | `leitor: 'sem'` | nenhum texto de comentário nem de resposta; nenhum nome de autor (auditoria r6) | DOM |
| Só leitura, com texto, sem nome | "Um espectador" nos 12 cartões; grande vira "Um canal com mais de 10 milhões de inscritos comentou"; resposta do criador sem vocativo | `leitor: 'privado'` sobre `D.extremo` | nenhum nome de autor no texto, nos `aria-label`, `title`, `alt` nem nos `details`; "Leo" (criador) e "Nômade Raiz" (cadastro) ficam | Capt. + DOM |
| Canal, com dado (12/01/2027) | "5 de 14 (36%)", "3 recentes", "17 vídeos"; 6 comentários em 5 vídeos | `D.RESPOSTAS` (5 vídeos), `D.CANAL_NAO` (9), `D.CANAL_RECENTES` (3) | 5 + 9 + 3 = 17 casas; 5/14 = 35,7%; cada comentário até 7 dias depois do vídeo | DOM |
| Canal, fecha (13/10) | "4 dos 16", "12 anteriores", "4 esperando (05/11 e 09/11)", cabeçalho "16 vídeos"; "9 comentários, em 3 vídeos" | `D.CANAL_FECHA_VIDEOS` + `D.CANAL_ANTES` (12) | 12 + 4 = 16; 06/10 + 30 = 05/11; 10/10 + 30 = 09/11; 3 + 3 + 3 = o "ele respondeu a N" de cada página de vídeo (cruzamento da auditoria); o mais antigo, 18/07, está dentro de 90 dias | Capt. + DOM |
| Canal, não medido | "3 dos 14", 2 + 1 + 11, "mínimo 5"; "3 comentários, em 2 vídeos" | `D.CANAL_*` | 2 casas azuis = 2 vídeos; 3 menor que 5; 3 + 11 = 14 | DOM |

Capturas refeitas: 34 em `shots/` (17 estados, 1440 escuro e 390 claro); rolagem horizontal 0, nenhuma fonte abaixo de 12 px, nenhum alvo abaixo de 44 px a 390. Abri, depois da mudança: `20-leitura-privado-1440-escuro.png` (cartões 1 a 3) e `-390-claro.png`, e `20-novo-1440-escuro.png` (cartões 1 a 4, com os autores e os textos novos). Os demais estados mudaram só no texto de comentário (autores e frases de exemplo de Pho e Hué) ou em nada, e passaram pela auditoria de DOM.

### 10.3 Não verificado
Leitor de tela, Safari, Opera, fontes reais; tema claro a 1440 e escuro a 390; as capturas de 390 de Pho e de Hué só pela extração de texto.
