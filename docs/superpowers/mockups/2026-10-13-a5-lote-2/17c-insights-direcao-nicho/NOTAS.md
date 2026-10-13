# Mockup 17c: Insights, "quem sobe e quem desce no nicho" (13/10/2026)

Abrir: `cd docs/superpowers/mockups/2026-10-13-a5-lote-2/17c-insights-direcao-nicho && python3 -m http.server 47711 --bind 127.0.0.1` e `http://127.0.0.1:47711/index.html` (também abre direto do disco). A barra "Estados do mockup", recolhida no topo, troca entre os 12 estados, escolhe a divisão por 0 (padrão ou alternativa), a cor do "＝" e o tema. `?leitura=a|b|c` escolhe a leitura; a escolha dentro do cartão funciona de verdade e vai para a URL.

Arquivos: `index.html`, `m17c.css`, `m17c.js`, `m17c-dados.js` (exemplo), `PLANO.md`, `REVISAO-UX-r1.md`, `shots/` (rodada 2; as da revisão estão em `shots/r1/`). A base (`a4.css`, `a4-comum.js`, `lote.css`, `lote.js`) é lida do lote 1 congelado por caminho relativo (`../../2026-10-13-a5-lote-1/`), sem cópia e sem edição. Capturas: script próprio de Playwright em Chromium headless sobre `file://`, fontes externas bloqueadas, nenhuma porta de rede usada.

## 1. O que a tela é

Um **cartão novo** da aba Insights, de largura cheia, logo depois de "Você no nicho" (os outros cartões da aba não mudam; no mockup aparecem como faixas "já existe, não muda"). Só existe com um nicho escolhido (com "Todos" a aba continua mostrando o cartão de hoje que pede para escolher um nicho). Contorno tracejado verde-água e "+ novo" marcam o acréscimo.

Pergunta de 3 segundos: **neste nicho, quem sobe e quem desce, cada canal contra ele mesmo?** Resposta de relance, em camadas: frase, barra de contagem (▲ ▼ ＝ ◌ proporcionais), régua desdobrada (um canal por linha, mesma escala de −60% a +60%).

## 2. Decisões de desenho e por quê

1. **Régua desdobrada, não traços numa linha só.** A régua aprovada em Comparar canais (faixa tracejada de "estável", linha do zero, rótulos descendo/estável/subindo, símbolo cheio) é a mesma, mas com um canal por linha. Com 7 ou mais canais nomeados, os rótulos de uma linha única se sobrepõem a 390 px e o traço anônimo não diz quem é quem. A faixa tracejada atravessa todas as linhas e vira uma coluna "estável": o olho vê o nicho se abrir em torno do centro.
2. **Posição escrita, nunca percentil** ("1º", "2º"; "empate" escrito sob a posição). A posição é "1 + quantos canais têm percentual arredondado maior": três canais empatados em +24% são os três "2º", e o seguinte é "5º". A ordem da lista é do que mais subiu para o que mais desceu. "A régua ordena, não julga" está dito no ⓘ ("ser 1º não quer dizer que o canal é melhor"); na tela não há nota, cor de ranking nem "melhor/pior".
3. **Uma leitura ordena por vez; as três nunca viram três vereditos.** O seletor "Leitura da direção" tem três botões (Canal inteiro, Vídeos novos, Vídeos novos na mesma idade). Só a escolhida pinta a régua, ordena, entra na frase e na contagem. Em cada linha, "As 3 leituras" abre um painel com as três: a principal com símbolo cheio e a etiqueta "a que ordena a régua"; as de apoio com símbolo só de contorno, sem etiqueta de veredito. Divergência (Mala Pronta sobe no canal inteiro e desce nos vídeos novos; Casal Itinerante o contrário) aparece lado a lado, sem frase que conclua. Padrão do spec: (a) hoje; (c) é a principal quando existir.
4. **"Mesma idade" aparece desde já, toda "não medido: fecha em 01/04/2027"**, para o dono ver que existe e quando chega (180 dias de registro desde 03/10/2026). O botão diz "nenhum medido" com a hachura, nunca "0 medidos".
5. **Cor estável**: ▲ verde `--dir-up`, ▼ âmbar `--dir-dn` (ocre no claro), ＝ neutro `--dir-eq`, não medido rosa com hachura, zero medido caixa vazada com 0 e borda `--im-zero`, "fora desta régua" contorno pontilhado, erro `--danger` só na borda e no ícone (texto em `--text`). Símbolo cheio e cor sempre juntos; funciona em escala de cinza.
6. **Não medido tem forma própria na trilha**: contorno pontilhado com preenchimento hachurado proporcional aos dias de registro (11 de 56). "Ainda não existe" fica pontilhado; a hachura é o que já veio. Nunca é um ＝ nem um zero.
7. **Zero medido ≠ não medido**, na mesma tela (estado `zero`): 0 views é caixa vazada com 0 ("0 views contra 41.000": ▼ −100%, uma medida). **Sem base para comparar** (r1, C2): quando o período anterior tem 0 views ("3.100 contra 0" ou "0 contra 0"), o canal fica **não medido**, com o motivo "sem base para comparar" e a linha "0 views nos 28 dias anteriores (19/08 a 15/09)"; a caixa vazada com 0 continua na linha de base. Não tem posição, não entra na contagem nem na frase. Dividir por 0 não dá percentual, e 28 dias seguidos sem nenhuma view é mais provável de ser dado que não chegou do que uma fase. A alternativa antiga (▲ "de 0" em 1º lugar e ＝ "sem mudança") continua visível em `?caso=zero&base0=sobe` (botão "Divisão por 0" da barra) e vai como pergunta ao dono (5.4).
8. **Fora da escala**: de −60% a +60%. Passou, a barra encosta na borda e termina em seta (› ou ‹); o número verdadeiro continua escrito (+340%, −78%).
9. **Classificação sobre o número que aparece.** O percentual é arredondado ao inteiro e a regra (≥ +10, ≤ −10) vale sobre o arredondado: 119.000 contra 108.500 é 9,68%, aparece "+10%" e é ▲ (estado `extremo`). A conta de cada canal fica no bloco de referência, fora da tela.
10. **Base e janela por canal**, em duas linhas sob o nome: os dois números e as duas janelas de datas ("612.000 views contra 431.000 / 16/09 a 13/10 contra 19/08 a 15/09"). Números cheios, não "612 mil", para o dono poder refazer a conta (armadilha do lote 1). Cada canal pode ter a sua janela (um canal sem o registro de 13/10 fica "não medido: sem o registro de 13/10").
11. **O viés vai na tela, em uma linha por leitura** (o spec manda dizer): "Inclui Shorts e vídeos apagados. O filtro de formato não vale aqui." / "Só vídeos longos. Descer pode ser só idade: os mais velhos tiveram mais tempo." / "Compara cada vídeo aos 30 dias de vida, sem o efeito do tempo." E, enquanto "hoje" for antes de 19/10, a linha com ícone de aviso: "Até 18/10, os 28 dias anteriores incluem a mudança de contagem do YouTube (24/08)." (18/10 é o último dia em que a janela anterior ainda alcança 24/08.) Ela some sozinha a partir de 19/10 (data comparada com a de hoje). O aviso usa o ícone neutro, não o âmbar, que é só de direção.
12. **Seu canal não está na régua, e a tela diz**: uma linha final "seu canal · tnFigueiredo · fora desta régua ⓘ". O spec (6.1.6 e C-5) diz que o canal do dono não entra em `competitor_*` e que o dia a dia público dele não é coletado; inventar uma direção para ele seria falsa precisão.
13. **Método só no ⓘ.** Três botões: o do título ("Como ler esta régua"), o da legenda do seletor ("As três leituras da direção") e o da linha do seu canal. Todos terminam com a frase fixa "Cálculo do Observatório sobre dados públicos do YouTube."
14. **A linha vira cartão até 1099 px** (r1, C1; antes só até 900, e entre 901 e 1023 a página rolava de lado) **e a 390 px**: linha 1 (posição, nome, símbolo + percentual, botão ▾ de 44 x 44), linha 2 a trilha em largura cheia, linha 3 base e janela. A palavra "subindo/descendo" fica só para leitor de tela (símbolo e cor ficam). A tabela de referência do mockup rola na horizontal dentro do próprio bloco; a página não rola.
15. **Seletor compacto e régua mais perto da frase** (r1, C4). A 1440 cada leitura é um botão de uma linha (nome, janela, "N de M medidos"), a legenda e o aviso dividem uma linha e a frase cabe numa só; a 390 o seletor vira três botões lado a lado ("Canal inteiro", "Vídeos novos", "Mesma idade", com "N de M" embaixo, o nome por extenso para leitor de tela), o título deixa o ⓘ na mesma linha e a janela divide a linha com a marca "exemplo". O botão escolhido leva ✓ além da borda. A primeira linha de canal fica a 330 px da frase a 390 (eram 540) e a 234 px a 1440 (eram 292).
16. **Frase-resumo num `<span>` só** (lição do lote 1) e `aria-live="polite"`: trocar a leitura reescreve a frase.

## 3. Tabela de frases da tela (texto exato)

`N` = número; `{nicho}` = nome do nicho; `{c}` = nome do canal.

| Onde | Texto |
|---|---|
| Título do cartão | Quem sobe e quem desce no nicho {nicho} |
| Marca | exemplo (em todo número de exemplo; no vazio e no erro não há número, então não há marca) |
| Marca de proposta | + novo |
| Meta (leitura a) | Últimos 28 dias contra os 28 anteriores |
| Meta (leituras b e c) | Últimos 90 dias contra os 90 anteriores |
| Chip (nicho com 2) | só 2 canais |
| Frase, caso comum (r1, B1: objeto e janela dentro da frase, por leitura) | ▲ N sobem, ▼ N descem e ＝ N ficam estáveis {objeto}, no nicho {nicho}. (singular: "sobe", "desce", "fica estável"; âmbar: "parado" / "parados") |
| {objeto}, leitura a | em views nos últimos 28 dias |
| {objeto}, leitura b | nas views do vídeo típico dos longos publicados nos últimos 90 dias |
| {objeto}, leitura c | nas views do vídeo típico dos longos publicados nos últimos 90 dias, medidas aos 30 dias de vida |
| Frase, com não medido | … no nicho {nicho}. N canal ainda não pôde ser medido. / N canais ainda não puderam ser medidos. |
| Frase, nenhum medido | Nenhum canal do nicho {nicho} tem medida {objeto} ainda: o primeiro fecha em dd/mm. (leitura c: dd/mm/aaaa) |
| Botão sob a frase, nenhum medido (r1, S3) | {Leitura} já mede N de M. (vira essa leitura; só aparece quando outra leitura mede ao menos um canal) |
| Frase, nicho com 1 canal | Só 1 canal no nicho {nicho}, e ele sobe ▲ {objeto}. Sem outro canal, não há com quem comparar. (desce / fica estável / está parado) |
| Linha sob o canal único | Único canal do nicho: sem posição. |
| Barra de contagem (rótulo de leitor de tela) | N sobem, N descem, N estáveis, N não medidos, de N canais |
| Segmentos da barra | ▲ N sobem · ▼ N descem · ＝ N estáveis (ou parados) · ◌ N não medidos (singular quando N = 1; a 390 px só símbolo e número) |
| Grupo do seletor | Leitura da direção |
| Botão 1 | Canal inteiro · 28 dias contra 28 · N de M medidos (a 390 px: "Canal inteiro" e "N de M", numa linha de três botões lado a lado; o nome acessível continua por extenso) |
| Botão 2 | Vídeos novos · 90 dias contra 90 · N de M medidos (390 px: "Vídeos novos" e "N de M") |
| Botão 3 | Vídeos novos, mesma idade · views aos 30 dias · nenhum medido (ou N de M medidos) (390 px: "Mesma idade" e "nenhum") |
| Botão escolhido | ✓ antes do nome, borda forte e fundo (o selecionado não depende só da borda) |
| Legenda a | Inclui Shorts e vídeos apagados. O filtro de formato não vale aqui. |
| Legenda b | Só vídeos longos. Descer pode ser só idade: os mais velhos tiveram mais tempo. |
| Legenda c | Compara cada vídeo aos 30 dias de vida, sem o efeito do tempo. |
| Aviso até 18/10 (só leitura a; r1, S1: o último dia em que a janela ainda cruza 24/08 é 18/10; a partir de 19/10 some) | Até 18/10, os 28 dias anteriores incluem a mudança de contagem do YouTube (24/08). |
| Eixo | descendo · estável · subindo; −60% · −10% · +10% · +60% |
| Posição | 1º, 2º…; "empate" sob a posição; "–" quando não medido (leitor de tela: "sem posição") |
| Base, leitura a | {N} views contra {N} / dd/mm a dd/mm contra dd/mm a dd/mm |
| Base, leitura b (r1, S4) | vídeo típico: {N} views (mediana de N longos) contra {N} (N) / publicados de dd/mm a dd/mm contra dd/mm a dd/mm |
| Direção | subindo +42% · descendo −20% · estável +1% (ou parado). ("subindo de 0" e "estável sem mudança" só na alternativa `?base0=sobe`) |
| Não medido, sem base (r1, C2) | pastilha "não medido" · sem base para comparar / linha de baixo: {N} views contra 0 (caixa vazada) / 0 views nos 28 dias anteriores (dd/mm a dd/mm) (leitura b: vídeo típico de 0 views nos 90 dias anteriores) |
| Zero medido | caixa vazada com 0, aria-label "zero medido" |
| Não medido, pastilha | não medido |
| Motivo, falta registro | fecha em dd/mm (linha de baixo do nome: "N de 56 dias de registro, desde dd/mm") |
| Motivo, dia sem registro | sem o registro de 13/10 (linha: "volta a medir quando houver o dado de 13/10"; r1, S4) |
| Motivo, poucos longos | N longos nos últimos 90 dias; precisa de 3 / N longos nos 90 anteriores; precisa de 3 |
| Motivo, mesma idade | fecha em 01/04/2027 (linha: "precisa de 180 dias de registro dos vídeos novos") |
| Botão da linha | As 3 leituras (a 390 px, só o ícone ▾; nome acessível "As 3 leituras") |
| Painel das 3 leituras | rótulo de cada leitura + subtítulo; "a que ordena a régua" na principal; símbolo e palavra; base e janela, ou o motivo |
| Seu canal | seu canal · tnFigueiredo · fora desta régua |
| Sem dado | Nenhum canal neste nicho / Adicione um canal de {nicho} para ver quem sobe e quem desce. / botão Adicionar canal |
| Sem dado, só leitura | mesmo texto; botão Adicionar canal desabilitado (tracejado) e, abaixo, "Só quem edita este site adiciona canais." |
| Erro (r1, C3: não afirma o que não sabe; sem ⓘ no título) | Não deu para carregar as views dos canais deste nicho. / Os outros cartões desta tela carregaram. Tente de novo; se o erro continuar, confira se a sincronização dos canais está atrasada. / botão Tentar de novo |
| Sem dado (r1, S6) | sem ⓘ no título: não há régua para explicar |
| Eixo (r1, S7) | não aparece quando nenhum canal está medido |
| Barra de contagem (r1, S5) | não aparece quando o nicho tem 1 canal só |
| ⓘ do título (r1, S2) | Como ler esta régua: o que é, **na leitura escolhida nos botões** (a janela de cada leitura está na frase do alto); símbolos e a regra do arredondado; a régua e a seta de borda; posição (ordem, não nota; empate); não medido (motivo e data; "sem base para comparar" quando o período anterior tem 0 views); zero medido; frase fixa |
| ⓘ da legenda | As três leituras da direção: uma ordena por vez; (a) canal inteiro, 56 dias de registro, Shorts e apagados, aviso até 19/10; (b) mediana dos longos, 3 por período, viés de idade; (c) mesma idade, a partir de 01/04/2027; frase fixa |
| ⓘ do seu canal | Por que o seu canal não aparece |

## 4. Estados desenhados (todos em `shots/`, 1440 escuro e 390 claro)

`tipico` (7 canais: 3 sobem, 2 descem, 1 estável, 1 sem 56 dias), `leituras` (a mesma tela com uma linha aberta), `videos` (leitura b: Pedro no Mundo fica "não medido, 2 longos"), `justa` (leitura c, nenhum medido, com data), `extremo` (8 canais: +340% fora da escala, −60% na borda, −78% fora, três empatados em +24%, +10% que vem de 9,68%, nome de 69 caracteres, dia sem registro), `zero` (0 contra N, N contra 0, 0 contra 0, ao lado de um não medido), `nao-medido` (todos, com hachura de progresso e a data de cada um), `magro` (nicho IA, 2 canais), `um-canal`, `sem-dado`, `sem-dado-leitura`, `erro`. Mais `17c-tipico-eqambar-*` e `17c-zero-eqambar-*` (o "＝" em âmbar, ver pergunta 1).

**Carregando:** a aba Insights é montada no servidor e o cartão chega junto com a página; não há estado de carregamento próprio. Se o implementador puxar o cartão por requisição à parte, a regra é a de sempre: trilhas em contorno pontilhado sem hachura (não pode parecer "não medido").

**Só leitura:** nada neste cartão é número privado (a direção de canal concorrente é dado público do YouTube) e a escolha de leitura não grava nada; por isso a versão "só leitura" difere só onde há ação: o vazio, em que "Adicionar canal" vira desabilitado e diz por quê.

## 5. Dúvidas para o dono (com o padrão adotado)

1. **O "parado" do dono é o "＝" ou o estado "parado" do canal (M8)?** (NC do spec 6.1.9, a mesma do lote 1.) **Padrão:** "＝" neutro com a palavra "estável", como aprovado em Comparar canais; o botão "Cor do ＝" da barra mostra a outra versão (âmbar e "parado"). "Parado" no sentido de M8 (canal que parou de publicar) **não** aparece neste cartão; ele é outra informação e fica para a Lista de Canais.
2. **O seu canal entra na régua?** **Padrão:** não, com a linha "fora desta régua" e o ⓘ. Entrar exigiria acompanhar o canal do dono como concorrente (pergunta 34 do spec), com os efeitos listados em C-5.
3. **Quantos canais já têm 56 dias de registro hoje (13/10)?** Não consultei produção (regra desta tarefa). O estado `tipico` supõe que os canais mais antigos têm registro anterior a 03/10; `nao-medido` mostra o caso em que nenhum tem (o primeiro fecharia em 27/11). Se for este o real, o dono verá `nao-medido` por semanas; vale conferir antes de aprovar o `tipico` como "o normal".
4. **"N contra 0" e "0 contra 0" ficam "não medido, sem base para comparar", ou viram "▲ de 0" (1º da lista) e "＝ sem mudança"?** **Padrão (mudou na r1, C2):** não medido, fora da posição e da contagem; um canal com 0 views em 28 dias seguidos é mais provável de ser dado que não chegou do que uma fase, e dividir por 0 não dá percentual. Alternativa (a que estava na versão anterior): ▲ "de 0" em 1º lugar e ＝ "sem mudança". O botão "Divisão por 0" da barra de estados mostra as duas no estado `zero`; capturas `17c-zero-*` (padrão) e `17c-zero-base0-sobe-*` (alternativa).
5. **Percentil de empate:** três canais empatados em +24% ficam todos "2º" e o próximo é "5º" (posição de competição). Alternativa: "2º ao 4º". **Padrão:** o primeiro.
6. **A escala de −60% a +60%** é a de Comparar canais. Canais com +340% encostam na seta. Alternativa: escala logarítmica, que perde a leitura "a faixa do meio é estável". **Padrão:** a de Comparar.
7. **(nova, r1 S8) O cartão sobe para o topo da aba Insights?** Os cartões "Leitura da forja" e "Você no nicho", que já existem, são bem mais altos do que as tiras de 56 px deste mockup; na tela real o cartão novo começa bem abaixo da dobra (no mockup, a frase já está a cerca de 660 px do topo a 1440). **Padrão:** continua depois de "Você no nicho", como no spec; se o dono quiser a pergunta "quem sobe e quem desce" na primeira tela, o cartão sobe para o topo.

## 6. O que o implementador precisa saber

- Onde entra: novo componente irmão de `you-in-niche.tsx`, em `_insights/`, renderizado por `insights-screen.tsx` logo depois de `YouInNiche`; view-model novo (`directionOfNiche`) devolvendo, por canal, as três leituras já calculadas. Nenhum texto é montado no componente (padrão da pasta).
- **Contas** (spec M3): (a) soma das views ganhas nos últimos 28 dias ÷ nos 28 anteriores, de `competitor_channel_snapshots.view_count`, com 56 dias de registro e o registro de hoje; (b) mediana das views atuais dos longos publicados em 90 dias ÷ a dos 90 anteriores, 3 longos em cada período; (c) o mesmo com as views aos 30 dias, só depois de 01/04/2027. Percentual = (atual ÷ anterior − 1) arredondado ao inteiro; ▲ ≥ +10, ▼ ≤ −10, ＝ no meio; divisão por 0 não gera percentual (ver pergunta 4). **Teste de borda obrigatório:** 9,68% tem de dar ▲ e "+10%"; 9,4% tem de dar ＝ e "+9%".
- **Data do aviso de 19/10** e **da "mesma idade" (01/04/2027)** são constantes com teste (o aviso some a partir de 19/10; fixture com data relativa, nunca ano hardcoded).
- **Ordenação:** do maior arredondado para o menor; não medidos no fim, pela data em que fecham (depois por nome). Posição de competição (empates). Não medido nunca entra na contagem nem na posição.
- **O filtro Longos/Shorts não muda este cartão** (leitura a inclui Shorts; b e c são só longos). O texto da legenda diz isso.
- **`aria-live`:** o mockup refaz o cartão inteiro com `innerHTML`, o que troca o nó da frase; leitor de tela não anuncia uma região `aria-live` que foi substituída. Na versão real, mantenha o nó `<p aria-live="polite">` e troque só o texto dele.
- **Acessibilidade:** a trilha é `role="img"` com `aria-label` por extenso ("Mala Pronta: subindo +21%. 2º de 6 medidos."); a barra de contagem idem; o seletor é `role="group"` com `aria-pressed`; o botão da linha tem `aria-expanded` e `aria-controls`; a frase tem `aria-live="polite"`. Alvo de 44 x 44 px a 390 px (nome do canal, ▾, ⓘ, botões do seletor).
- **Cor:** só tokens existentes; a hachura é a do "não medido" (`--nm`, `--nm-bg`, `--nm-fio`); sem `color-mix()`.
- **Escolha da leitura** vai em `?leitura=` e é lembrada só na URL (não grava no navegador); sem o parâmetro vale "Canal inteiro".
- **Nome do canal** é link para a página do canal (já existe).
- **Não resolvi:** o tamanho do cartão com 40 ou mais canais no nicho (7 linhas medem cerca de 540 px a 1440, 77 px cada; a 390, cerca de 151 px por linha, medido na r1). Pela dívida declarada do lote 1, a regra é mostrar 10 e "Mostrar mais N". Também não verifiquei leitor de tela, Safari e Opera.

## 7. O que é dado real e o que é exemplo

Tudo é exemplo: canais (Rota Solta, Mala Pronta, Trilha Sem Mapa, Pedro no Mundo, Casal Itinerante, Voo Baixo, Ana Passaporte, Prompt de Bolso, Bit Diário, Fogão a Lenha da Vó, Zé Gringo), views, longos e datas de início do registro. "Hoje" é 13/10/2026. Só o que vem do spec é real: as regras (56 dias, ±10%, 3 longos, 19/10, 01/04/2027, 24/08) e o nome do canal próprio tnFigueiredo.

## 8. Medidas das capturas (rodada 2, 30 arquivos em `shots/`: 15 estados x 1440 escuro e 390 claro)

Os 12 estados mais `tipico-eqambar`, `zero-eqambar` e `zero-base0-sobe` (a alternativa da pergunta 5.4). Medido por mim no Chromium, nos 12 estados, nos 4 cruzamentos de largura e tema: rolagem horizontal da página 0 em todos; também 0 a 320, 901, 960, 1024, 1099 e 1100 px (C1). Texto menor que 12 px: nenhum. Alvos menores que 44 x 44 px a 390: nenhum. `grep color-mix` na pasta: só o comentário "Sem color-mix()". Teste de clique: o botão sob a frase troca a leitura, o foco vai para o botão da leitura nova, nenhum erro de página. Capturas abertas e conferidas por mim: tipico 1440 e 390, zero 1440 e 390, extremo 390, videos 1440, justa 1440, nao-medido 390, um-canal 1440, erro 390, sem-dado-leitura 390, e a leitura aberta a 1024. **Não conferi com os olhos** as capturas de `magro`, `sem-dado` e `leituras`, nem os cruzamentos escuro a 390 e claro a 1440 (só medidos); nem contraste dos elementos novos no navegador (✓, botão sob a frase: usam tokens que o lote 1 já mediu).

## 9. Resposta à revisão r1 (13/10/2026, designer)

| Item | Resposta |
|---|---|
| **B1** frase sem objeto e sem janela | Feito. A frase diz o objeto e a janela de cada leitura ("em views nos últimos 28 dias", "nas views do vídeo típico dos longos publicados nos últimos 90 dias", "…, medidas aos 30 dias de vida"), em todos os estados com dado; trocar a leitura reescreve a frase. O `.q-meta` ficou. Tabela de frases (seção 3) atualizada. |
| **C1** rolagem de 901 a 1023 px | Feito. O layout de cartão (linha em três faixas) agora vale até 1099 px, a mesma largura em que some o menu lateral; medi 0 de rolagem a 901, 960, 1024, 1099, 1100 e 320. A primeira coluna do layout largo também ficou maior (250 px) por causa do texto "vídeo típico". |
| **C2** "N contra 0" vira 1º, "0 contra 0" vira estável | Feito, aceito o padrão conservador. Os dois ficam não medido, "sem base para comparar", sem posição e fora da contagem; a caixa vazada com 0 continua na linha de base. A alternativa antiga ficou em `?caso=zero&base0=sobe` (botão "Divisão por 0" da barra) com capturas `17c-zero-base0-sobe-*`, e virou pergunta ao dono (5.4). ⓘ explica. |
| **C3** erro afirma o que não sabe | Feito: "Os outros cartões desta tela carregaram." |
| **C4** nomes abaixo de três blocos de controle | Feito em parte, e a parte que falta é do conjunto da tela. A 390: seletor de uma linha (três botões lado a lado, "N de M" embaixo, nome acessível por extenso), título com ⓘ na mesma linha, janela dividindo linha com "exemplo"; a primeira linha de canal sobe de 540 px para 330 px abaixo da frase (ganho de 210 px, a meta era 200). A 1440: botões de uma linha, legenda e aviso numa linha, frase numa linha; de 292 para 234 px. **Discordo em parte:** o aviso de 18/10 continua em duas linhas a 390 (o texto tem 82 caracteres; cortar com reticências esconderia a data), e a primeira linha a 1440 ainda cai na borda da janela de 900 px porque a frase já começa a 661 px: o que empurra é a casca (cabeçalho do Observatório e as duas faixas "já existe"), que não é deste cartão. Isso virou a pergunta 5.7 (subir o cartão para o topo da aba). |
| **C5** borda do botão "As 3 leituras" a 390 | Feito: borda `--dim` abaixo de 640 px (e em ponteiro grosso). |
| **S1** "Até 19/10" | Feito: "Até 18/10" na tela e no ⓘ; o aviso continua sumindo em 19/10. |
| **S2** ⓘ fixo em 28 dias | Feito: o ⓘ fala "na leitura escolhida nos botões (o padrão é o canal inteiro…)" e manda para a frase do alto. |
| **S3** estados sem medido não levam ao que existe | Feito: botão sob a frase, "Vídeos novos já mede 6 de 7" (só aparece quando outra leitura mede ao menos um canal; 44 px de alto a 390). |
| **S4** palavras | Feito: "vídeo típico: 21.500 views (mediana de 8 longos)" na linha e no painel; "volta a medir quando houver o dado de 13/10". |
| **S5** `um-canal` | Feito: sem barra de contagem e frase "Só 1 canal no nicho Culinária, e ele sobe ▲ em views nos últimos 28 dias. Sem outro canal, não há com quem comparar." |
| **S6** ⓘ solto no vazio e no erro | Feito: sem ⓘ nesses dois estados. |
| **S7** eixo sobre trilhas vazias | Feito em parte: sem o eixo (descendo/estável/subindo) quando nada está medido; as trilhas pontilhadas com a hachura de progresso ficam, porque mostram quanto falta para cada canal. |
| **S8** tiras de 56 px | Feito na NOTAS e na pergunta 5.7 ao dono. |
| **S9** "125 px por linha" | Corrigido para 151 px (seção 6), com 77 px a 1440. |
| Para o implementador: `aria-live` | Anotado na seção 6. |
| Extra, por minha conta | O botão da leitura escolhida leva ✓ além da borda (a seleção não dependia só da borda). |
