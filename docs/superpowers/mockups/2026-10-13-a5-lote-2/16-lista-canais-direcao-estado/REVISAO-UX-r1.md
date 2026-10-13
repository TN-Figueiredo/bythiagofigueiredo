# Revisão de UX, mockup 16 (Lista de Canais: direção, estado, filtros), rodada 1, 13/10/2026

Revisor: `revisor-ux-senior`. Material lido: PLANO.md, NOTAS.md, index.html, lista.css, lista.js, lista-dados.js, medidas.json, CONVENCOES.md, spec 04 (linhas 15, 20, 69 a 74, 82, 89, 157) e lote 1 (`e.js`, `lote.js`). Abri as capturas existentes e gerei as minhas (script próprio em Chromium headless sobre servidor estático nas portas 47732 a 47737 e 47761, cada um derrubado ao fim; nada na 3099). Capturas de evidência desta rodada: `shots/r1-*.png`. Cópias de `a4.css`, `a4-comum.js`, `lote.css`, `lote.js` conferidas iguais às do lote 1 (diff vazio). `grep color-mix`: só comentários "sem color-mix".

## Veredito

**NAO PODE ir ao dono. 1 bloqueio, 6 itens "corrige".** A tela é boa no que importa (a coluna Direção, a régua, as pastilhas, o vazio explicado de "em queda" e o zero medido são de bom nível, e as medidas fecham). O que a derruba é o elemento mais chamativo da tela, a barra de direção, dizer uma coisa e a frase ao lado dizer outra.

Pergunta do dono nesta tela: "Algum canal que eu acompanho parou, está caindo ou sumiu, e quais estão subindo?"

| Estado | 1440 escuro | 390 claro |
|---|---|---|
| típico (13/10) | volta para ajuste (B1) | volta para ajuste (B1) |
| completo (15/12) | volta para ajuste (B1: "1 em queda" contra ▼ 5) | volta para ajuste (B1) |
| extremo | volta para ajuste (B1: "3 em queda" contra ▼ 7; C1; C4) | volta para ajuste (B1; C4) |
| zero (parados e em queda) | pronto | pronto |
| zero + filtro "parados" (vazio com zero medido) | pronto | pronto |
| magro | volta para ajuste (S2: frase longa) | volta para ajuste (S2) |
| erro | volta para ajuste (C1) | volta para ajuste (C4) |
| fora do ar | volta para ajuste (C2) | volta para ajuste (C2) |
| carregando | pronto (S5) | pronto |
| só leitura | volta para ajuste (C1: tabela apertada; C5) | volta para ajuste (C4) |
| 78 canais / nicho | pronto (C1 no nicho IA, que tem linha em erro) | pronto |
| típico + filtro "em queda" (vazio explicado) | volta para ajuste (C3: "contagem certa") | idem |
| típico + filtro "parados" | pronto | pronto |

## Bloqueio (impede ir ao dono)

### B1. A barra de direção e a frase-resumo se contradizem na palavra "queda", e a barra não tem rótulo. Telas típico, completo e extremo, 1440 e 390.

- **Evidência.** `shots/r1-completo-1440-barra.png`: a frase pedida pelo dono diz "2 canais parados, **1 em queda**, 4 subindo.", e logo abaixo a casa mais larga e mais colorida em âmbar é "▼ 5". No extremo a frase diz "3 em queda" e a casa diz "▼ 7". No típico a frase diz "Quais estão em queda ainda não dá para dizer" e a casa âmbar diz "▼ 3" (`shots/r1-tipico-1440-topo.png`). A palavra "descendo" não está na barra: as quatro casas têm só símbolo e número, e a legenda que traduz ▼ para "descendo" mora na faixa da base, 190 px abaixo a 1440 e cerca de 400 px abaixo (fora da primeira tela) a 390 (`shots/r1-tipico-390-topo.png`). Quem lê em 3 segundos junta "queda" com "▼" e sai com a conta errada: acha que há 3, 5 ou 7 canais em queda, quando a frase diz 0 (não medido), 1 ou 3. A frase também cala sobre ＝ e ▼, que são 9 de 15 canais no típico.
- **Escala de cinza** (regra 4). As casas ▲, ＝ e ▼ têm quase a mesma luminância: escuro 0,41 (verde), 0,44 (âmbar), 0,34 (neutro); claro 0,10, 0,13 e 0,09. O que as separa em cinza é só o glifo de 14 px dentro da casa (oito pixels de altura). Sem palavra, a barra não passa no teste.
- **Conserto.** (1) Escrever a palavra em cada casa ou logo abaixo dela, na mesma largura: "subindo", "sem mudança", "descendo", "não medido" (as casas de zero medido mantêm a caixa vazada, com a palavra). (2) A frase passa a dizer os dois fatos sem usar "queda" para o que é só "descendo": "2 canais parados, 5 subindo, 3 descendo neste período. Em queda sustentada só dá para medir a partir de 14/12." (e, no completo, "1 em queda sustentada, 5 descendo"). (3) Se a frase ficar maior que duas linhas a 390, o excedente vai para o ⓘ, que já existe. Com isso, a barra e a frase dizem a mesma coisa com as mesmas palavras e a legenda da faixa da base deixa de ser a única chave da barra.

## Corrige (vai ao dono só depois de corrigido)

### C1. Em quatro estados a coluna Ações incha para 148 a 193 px e aperta o resto; o título "Views/dia" quebra em 4 linhas e o par de números da Direção quebra em duas. Erro, extremo, só leitura e muitos com nicho IA, 1440.
Medida (largura das colunas, 1440, `getBoundingClientRect`): Ações 40 px no típico contra 148 (erro, extremo) e 193 (só leitura); Outliers 87 contra 65 e 60; Views/dia 90 contra 73 e 70; Direção 169 contra 144 e 139. Em `shots/r1-leitura-1440-tabela-apertada.png` o título "Views/dia ▼ mediana nos longos" ocupa 4 linhas (cabeçalho de 104 px contra 89 px) e "2.171 mil × 1.840 mil" cai em duas linhas, na célula de que a tela inteira depende. As linhas continuam em 141 px no máximo (dentro dos 132 a 155), mas a tabela deixa de alinhar de relance. **Conserto:** dar largura fixa a Ações (a mesma nos dois tipos de linha, com o botão "Sincronizar agora" empilhado abaixo da pastilha de erro dentro da coluna Sincronização, como o cartão de 390 já faz) e `white-space: nowrap` no par de números da Direção.

### C2. "Fora do ar" e "Saíram do YouTube" são dois nomes para a mesma coisa, e a aba do lote 1 não aparece. Casos fora do ar e extremo, 1440 e 390.
No lote 1 a aba "Saíram do YouTube N" (`L.obs({fila})`, `lote.js:44`) e a pastilha "saiu do YouTube em dd/mm" (`e.js`) são o que o dono aprovou. Aqui o canal que saiu mostra "Fora do ar desde 04/10" (`shots/r1-fora-1440-topo.png`), o chip do cabeçalho diz "1 fora do ar", e **a aba "Saíram do YouTube" não aparece**, embora o spec (4.5) mande esse canal para a fila de resposta. O spec 6.5b usa "fora do ar" para esta tela e a linha 89 usa "saiu do YouTube" para qualquer tela: o próprio spec tem as duas, então o desenho tem de escolher e dizer. **Conserto:** (a) passar `fila: 1` a `L.obs` nos casos `fora` e `extremo`, para a aba aparecer com o contador; (b) escolher um nome só para a pastilha ("Saiu do YouTube em 04/10" é o aprovado) ou, se mantiver "Fora do ar", declarar a divergência no topo de NOTAS e pôr a pergunta ao dono (a dúvida 2 de NOTAS só trata do 404, não do nome).

### C3. Frase com jargão no vazio de "em queda" e no ⓘ: "com a contagem certa". Típico + filtro "em queda", 1440 e 390 (`shots/caso-tipico-filtro-queda-*`).
"Essa leitura pede 3 períodos de 28 dias seguidos com a contagem certa" não diz o que é "a contagem certa" a quem não leu o spec (é a mudança de 24/08 que a faixa da base cita). **Conserto:** "...3 períodos de 28 dias seguidos depois da mudança de contagem de 24/08/2026. O primeiro dia possível é 14/12/2026, daqui a 62 dias." Mesmo ajuste no ⓘ ("com a contagem certa" vira "depois da mudança de contagem de 24/08"). A conta fecha (13/10 a 14/12 são 62 dias; 24/08 mais 112 dias é 14/12).

### C4. A tag "+ novo" cobre texto no cartão de erro a 390 px. Extremo e erro, 390 claro.
Em `shots/r1-extremo-390-cartoes.png` (primeiro cartão) a tag do botão "Sincronizar agora" fica sobre a linha "Se continuar, e-mail em 16/12" e a esconde em parte. **Conserto:** 8 px de margem acima do bloco do botão no cartão (`.er-act` dentro de `.ls-t` a 390), ou tirar a tag e deixar só o contorno tracejado.

### C5. Só leitura: os botões do cabeçalho ficam desligados sem dizer o motivo ali, e o aviso mora 170 px abaixo deles. Só leitura, 1440 e 390.
Em `shots/r1-leitura-1440-tabela-apertada.png` os botões desligados estão no topo e a frase "Você só pode ler esta lista..." vem depois das abas. A 1440 cabe na mesma tela; a 390 fica fora da primeira tela e, no toque, não existe dica ao tocar num botão desligado. **Conserto:** a frase sobe para logo abaixo dos botões do cabeçalho (antes das abas), ou cada botão desligado leva o motivo curto em texto visível ("só leitura"). Risco baixo, mas a regra do mockup é "a tela diz o que ele não pode fazer, não fica muda".

### C6. A barra de direção parece botão e não é: quatro blocos grandes e coloridos, sem ação, enquanto a pergunta do dono é "quais estão subindo". Todos os casos com direção.
Com 15 canais o olho acha os quadrados verdes na coluna; com 78 canais e 20 por vez ("muitos") não há como listar só os que sobem nem ordenar por Direção (o cabeçalho "Direção" não é ordenável, o filtro de estado só cobre parados, em queda, fora do ar e erro). **Conserto (um dos dois):** transformar as casas em botões de filtro (`aria-pressed`, 44 x 44 px a 390, mesmo gesto do filtro de estado), ou tornar a coluna Direção ordenável por percentual. O spec pede só os filtros "parados" e "em queda", então se o dono preferir manter a barra como desenho, ela precisa deixar de parecer botão (sem sombra, sem hover); o item fica aberto para o dono decidir.

Nota de hierarquia que acompanha C6 e B1: a barra (a medida de views) ocupa a maior área colorida, enquanto "parou" e "sumiu" (o que o dono mais precisa pegar) são só texto em negrito de 15 px e um chip de 34 px, separados da barra pela busca e pelos botões Absoluto e Tabela. **Conserto:** subir a linha de filtros de estado para logo abaixo da barra, antes da busca; assim a resposta (barra + contagens de estado) fica num bloco só.

## Sugestões (não bloqueiam)

- S1. A régua de -50% a +50% (124 x 14 px) não tem legenda de escala; o ⓘ não cita a escala, a faixa tracejada de "sem mudança" nem que a ponta vira triângulo. Uma linha no ⓘ resolve.
- S2. Frase do magro: "Direção medida em 4 de 15 canais; 10 fecham entre 17/10 e 26/11, e o seu canal ainda não entra. Em queda: só a partir de 14/12." Quatro afirmações em 2 linhas (4 linhas a 390). Dividir: a frase fica com "Direção medida em 4 de 15 canais." e as datas vão para o ⓘ ou para a linha de apoio da casa hachurada.
- S3. Cabeçalho "Canal / nicho, inscritos / e / estado" deixa a palavra "e" sozinha numa linha a 1440. Trocar por "nicho, inscritos e estado" com largura de coluna que o comporte, ou "nicho, inscritos, estado".
- S4. Motivo da direção do seu canal: "contagem pública por dia do seu canal ainda não é guardada" ainda soa técnico. Proposta: "o YouTube não dá esse número do seu canal; o Observatório começa a guardar o seu em dd/mm" (só se houver data; sem data, "ainda não é guardado").
- S5. Esqueleto de carregamento no escuro: as linhas somem no fundo (a olho; não medi o contraste do esqueleto). Não é texto, mas a tela parece vazia. Subir o tom das barras do esqueleto um degrau.
- S6. Glifo ▲ ▼ ＝ nas casas da barra a 14 px: subir para 16 px junto com os rótulos de B1.
- S7. Crescimento (inscritos, ▲ ▼ em verde e âmbar) fica ao lado da Direção (views): no extremo o canal da linha 1 mostra ▼ -24% (Direção) e ▲ +1,8% (Crescimento) juntos. Já está na dúvida 6 de NOTAS; confirmo o risco e a ordem das colunas ajuda (Direção bem longe de Crescimento). Se o dono confundir, o Crescimento perde o símbolo, como NOTAS propõe.
- S8. A referência do mockup ("As pastilhas de estado") a 390 mostra a tabela cortada à direita (quarta coluna fora da tela). Está fora da tela simulada e a página não rola; só reflua em duas colunas para não parecer defeito.
- S9. Itens abertos de NOTAS que concordo em levar ao dono juntos (não bloqueiam): dúvidas 1 (hachura em "em queda" até 14/12; recomendo manter), 3 (parado e em queda ao mesmo tempo), 5 (texto do seu canal), 7 (parado x ＝, ainda sem resposta do dono) e 8.

## O que está certo (não mexer)

- Zero medido (caixa vazada com 0, `--im-zero`), não medido (hachura rosa com motivo e data) e carregando (tracejado cinza) são três formas distintas, e a tela nunca troca uma por outra: "Em queda" no típico mostra a hachura, não um 0 (`caso-tipico-filtro-queda`); no zero, "Em queda 0" é caixa. É a pergunta "o que acontece quando o dado não existe?" respondida.
- Cor estável: verde só em ▲, âmbar só em ▼, parado e em queda, nenhum vermelho em direção; fora do ar e erro usam a família do erro (borda e ícone, texto em `--text`).
- Contas fecham sobre os números exibidos: Dale Philip 858/640 = +34%; Lodir 107/96,0 = +11% (▲); Aldinho 37,9/41,2 = -8% (＝); Terra Firme 8,83/12,8 = -31%; "fecha em 29/10" e "14/11" batem com 56 dias; 19/10 = 24/08 + 56; 14/12 = 24/08 + 112; "daqui a 62 dias" confere; 5 + 4 + 3 + 3 = 15 no típico, 3 + 1 + 0 + 11 = 15 no magro, 0 + 5 + 7 + 3 = 15 no extremo.
- Parado: 38 dias com ritmo de 7 passa o limite de 28; 52 dias com ritmo de 9 passa 36.
- Linha com acréscimo: 86 a 121 px (típico), 141 (erro e extremo), 124 (fora): dentro dos 132 a 155 aceitos (as de 86 a 97 estão abaixo da meta, melhor que o aprovado).
- A frase única em `<span>` (sem quebra em duas colunas) e o método num ⓘ (dois botões, um no resumo, um no cabeçalho da coluna), com a frase fixa "Cálculo do Observatório sobre dados públicos do YouTube".
- Zero medido não contradiz cabeçalho: "Nenhum canal parado nem em queda; 8 subindo" bate com a barra (8, 6, 0, 1) e com os chips (0 em caixa).

## Medidas

Contraste medido no navegador (cor composta sobre o fundo composto, valores lidos do estilo computado); mínimo do conjunto 4,68:1 (texto), nenhum texto abaixo de 4,5 em 14 casos x 4 cruzamentos (1440 e 390, escuro e claro).

| Item | Escuro | Claro | Limite |
|---|---|---|---|
| Número e glifo sobre ▲ (`--on-lado` sobre `--dir-up`) | 8,13 | 6,81 | 4,5 |
| sobre ＝ (`--dir-eq`) | 6,92 | 7,62 | 4,5 |
| sobre ▼ (`--dir-dn`) | 8,62 | 5,93 | 4,5 |
| Casa ▲ contra a superfície (gráfico) | 7,26 | 6,37 | 3 |
| Casa ＝ contra a superfície | 6,18 | 7,13 | 3 |
| Casa ▼ contra a superfície | 7,71 | 5,55 | 3 |
| Texto "não medido" sobre a hachura (pior ponto, com o fio) | 5,13 | 5,47 | 4,5 |
| Borda da hachura (`--nm-line`) | 4,09 | 4,57 | 3 |
| Borda do zero medido (`--im-zero`) | 4,97 | 4,84 | 3 |
| Faixa tracejada "sem mudança" da régua (`--dim`) | 4,86 | 5,59 | 3 |
| Texto de apoio (`--muted`) sobre a faixa da base | 6,92 | 6,43 | 4,5 |
| Texto sobre a pastilha de parado | 11,61 | 13,75 | 4,5 |
| Borda da pastilha de fora do ar (`--danger`) | 5,59 | 6,16 | 3 |
| Menor texto do conjunto (4,1x, herdado do lote 1) | n/a | 4,68 (390 claro, extremo) | 4,5 |
| Luminância ▲ / ▼ / ＝ (teste de cinza) | 0,41 / 0,44 / 0,34 | 0,10 / 0,13 / 0,09 | separar por símbolo e palavra (B1) |

| Medida | Valor |
|---|---|
| Rolagem horizontal da página (14 casos x 4 cruzamentos) | 0 px em todos |
| Rolagem dentro da tabela (`.ls-tw`) | 0 px em todos |
| Alvos de toque abaixo de 44 x 44 px a 390 (ponteiro grosso), fora da referência do mockup | 0 |
| Fonte abaixo de 12 px | 0 (`medidas.json`, conferido) |
| Altura de linha 1440 (típico / erro e extremo / fora) | 86 a 121 / 141 / 124 px |
| Altura de cartão 390 | 342 a 475 px |
| Tabela 1440 | 1174 px de largura; Ações 40 px (normal) contra 148 e 193 px (C1) |
| Foco | contorno de 2 px `--accent` (rgb 255,130,64) em todos os 22 primeiros controles testados; ordem do foco segue a leitura (nicho, ⓘ, filtros, ⓘ da coluna, canal, Comparar, Mais ações) |
| `aria-pressed` nos filtros | presente; "Em queda" antes de 14/12 diz "não medido até 14/12" ao leitor de tela |
| Barra | `ul` com `aria-label` e `li` com texto por extenso ("5 subindo"); regra de movimento reduzido presente (`prefers-reduced-motion`) |

## O que NÃO consegui verificar

- Leitor de tela de verdade (li só o DOM e os `aria-label`), Safari e Opera (usei Chromium), e a ordem de teclado da barra de ferramentas e das abas: os botões "Sincronizar concorrentes", "Adicionar canal", a busca e os alternadores Absoluto e Tabela não recebem foco neste mockup (herdado da casca do lote 1); não julguei isso como defeito desta tela.
- Esc fechando o popover do ⓘ e o retorno de foco: vêm de `a4-comum.js`, congelado e já aprovado; abri o ⓘ e li o conteúdo, não testei o fechamento.
- Tema claro a 1440 e escuro a 390 foram medidos (contraste, rolagem, alvos) mas não abri as capturas deles além do que cabe no par obrigatório.
- Telas 1440 de zero + filtro "parados" e 78 canais foram vistas em recorte, não de página inteira.

## Condição para a rodada 2

Corrigir B1 e C1 a C6 (C5 e C6 podem virar pergunta ao dono se quem desenhou discordar, com os dois lados escritos aqui). As sugestões S1 a S9 não condicionam. Na rodada 2 reabro: típico, completo e extremo a 1440 escuro e 390 claro (barra, frase, grayscale por conta de luminância e rótulos), erro, só leitura e muitos-IA a 1440 (largura das colunas), fora do ar (aba e nome) e o vazio de "em queda".
