# Revisão de UX 5: c2-trocas.html reenquadrado como acréscimo à Lista de Canais (12/10)

Revisor: revisor-ux-senior. Não editei nada. Capturas em `ux-revisao-5-shots/`. Brief e relatório lidos: `.superpowers/sdd/a5/mockup-ajuste-c2-enquadramento-brief.md` e `AJUSTES-UX-5.md`.

## Resumo

**Veredito: VOLTA PARA AJUSTE.** O conteúdo do acréscimo continua certo e o enquadramento melhorou muito (some a seção de andaime, a marca "+ novo" funciona, `?novo=0` limpa). Mas a pergunta central ainda falha em duas das três partes:

- (a) "estou na tela de sempre?": só em parte. O código de produção tem o cabeçalho do Observatório (título "Observatório de Competidores", abas Canais / Mudanças / Outliers / Insights, barra de nichos, botões) e o mockup não o tem. Quem conhece a tela real vê outra moldura.
- (b) "o que é novo?": sim, em 3 segundos (tracejado verde-água + "+ novo").
- (c) "como cheguei?": não. A frase "Como se chega" está dentro da barra recolhida; no estado padrão ela não aparece (medido: `checkVisibility() = false`). E, aberta, diz "Observatório → Canais", mas o que o dono vê na tela é "YouTube → aba Competidores".

Os três pontos que mais derrubam o conjunto:
1. "Como se chega" escondida, e com nomes que não estão na tela (achados 1 e 2).
2. O cabeçalho real do Observatório e duas colunas reais (Comparar, ⋯) faltam sem declaração (achados 2 e 3).
3. O acréscimo triplica a altura das linhas da lista (73 para 208-233 px), o que o dono vai ler como "a lista piorou" (achado 4).

Telas: 1 (a página única, 7 estados) = volta para ajuste. Não há bloqueio; há 5 "corrige" e 4 sugestões.

## Pergunta do usuário

"Estou na Lista de Canais de sempre, o que mudou nela e como cheguei até aqui?" Resposta em 5 s hoje: o que mudou, sim; "é a lista de sempre", mais ou menos; "como cheguei", não.

## Achados (por severidade)

### Corrige

1. **"Como se chega" invisível no estado padrão.** A frase foi inserida em `#mock .mk-in`, dentro do `<details>` recolhido. Medido em 1440 e 390: `details.open = false`, `.c2-como.checkVisibility() = false`. A única coisa visível no topo é "Estados do mockup (não faz parte da tela)", que não diz nada sobre caminho. Aberta (`barra-aberta-1440.png`) a frase aparece, mas o dono não abre a barra, e foi exatamente isso que o brief queria evitar. Conserto: pôr a frase numa linha sempre visível (ao lado ou sob o resumo da barra), ou abrir a barra na primeira visita.

2. **Caminho e moldura não batem com a tela real.** No código, `Competidores` (aba do YouTube) renderiza `CanaisScreen` dentro de `ObservatoryChrome`: `h2 "Observatório de Competidores"` + subtítulo longo, botões "Sincronizar concorrentes", "Adicionar canal", "Meu canal", faixa de frescor, abas "Canais | Mudanças | Outliers | Insights" com contagem e a barra de nichos (`_chrome/view-model.ts` linhas 12-16; `observatory-chrome.tsx` linhas 190-215). O mockup não tem nada disso: pula direto para a migalha "Canais", um `h1 Canais` e um subtítulo ("Nicho Viagem. 6 concorrentes...") que não achei no código. A premissa do brief ("título e migalha = os da tela real") não se confirma no código: a migalha e o h1 "Canais" vêm do mockup antigo `canais.html`, não de produção. Além disso a frase diz "Observatório → Canais", mas na tela só aparece "Competidores" (aba) e "Canais" (item do menu lateral, que no mockup é outra coisa). Conserto: reproduzir estaticamente o cabeçalho do Observatório com a aba "Canais" atual (assim "Observatório → Canais" passa a estar escrito na tela) e trocar a frase por "YouTube → aba Competidores → aba Canais; clique num canal". Não pude abrir a produção (sem sessão); base: código. Os mockups já aprovados (ex.: `2026-10-07-pagina-canal/shots/r7-1440-canais-14-tabela.png`) também omitem o cabeçalho, então a divergência é herdada, mas o dono compara com a produção, não com o mockup antigo.

3. **Colunas reais ausentes, sem declaração.** `channel-table.tsx` tem, depois de Sincronização, a coluna "Com o meu canal" (link "Comparar"; existe sempre que há canal próprio, e o mockup tem "tnFigueiredo") e a coluna de ações (⋯ por linha). Os cabeçalhos reais são botões de ordenação com seta; aqui são texto. O relatório declara só "cabeçalhos inertes". Conserto: acrescentar as duas colunas (são de hoje, não levam "+ novo") ou declarar a omissão na nota da barra.

4. **O acréscimo infla a lista.** Altura de linha em 1440 com painel aberto: 73 px (Lucas, Leo, tnFigueiredo) contra 208-233 px (Nômade 233; Dale, Vou, Paddy 208), ou seja 2,8 a 3,2 vezes. A coluna Trocas tem ~165 px de largura e o bloco quebra em 7 linhas ("Descrição: 3 trocas em 2 vídeos" / marcas / "antiga recente" / "em 3 das 4 últimas semanas" / selo). Resultado: a primeira dobra de 900 px mostra 3 linhas em vez de 6. O contraste de ritmo da lista (uma linha por canal, comparável de relance) se perde. O conteúdo não está em julgamento, mas o enquadramento como "acréscimo a uma lista existente" é que revela o custo. Conserto: na célula, só "Descrição: 3 em 2 vídeos" + as quatro marcas + selo (3 linhas, ~110 px); "em 3 das 4 últimas semanas" e o eixo "antiga/recente" ficam no painel.

5. **Estado escolhido na barra não aparece no recorte.** Ao escolher "Nenhuma troca" (Leo, 6ª linha) ou "Canal próprio" (7ª), a linha realçada fica abaixo da dobra (em 390, Leo está a 3.469 px do topo e o painel a 4.508 px). Quem troca o estado vê o painel mudar e uma lista sem nenhuma linha realçada na tela; a ligação lista-painel, que é o ponto do enquadramento, some. Conserto: ao carregar, rolar a linha do canal aberto para a vista (`scrollIntoView({block:'center'})`).

### Sugestão

6. **Em 390 o acréscimo principal está a ~4.500 px.** Declarado, mas a rolagem é de cerca de 5 telas. Um link no topo "Ir ao painel de Paddy Doyle" resolve. Em 390 a marca "+ novo" só aparece na 1ª linha (cartão de Nômade); em Paddy (`paddy-390-escuro-linha.png`) há uma caixa tracejada sem rótulo. Repetir o rótulo em cada cartão no celular ou pôr uma legenda curta sob o título: "tracejado verde-água = novo".
7. **Verde-água x verde de "subindo".** Teal `#5CC3B2` (matiz 170°) contra `--dir-up #22c55e` (142°): 28-30° de matiz, razão de luminância 1,07:1 (escuro) e 1,04:1 (claro, `#17695C` vs `#11692F`). Em cinza os dois são indistinguíveis; só a forma separa (contorno + rótulo "+ novo" contra "▲ +1,8%"). Em 1100 px a coluna Crescimento fica ao lado do bloco tracejado (`nomade-1100-escuro-topo.png`), mas não vi confusão real porque a forma é diferente. Em 1440 com painel aberto a coluna some, então não coexistem. Não bloqueia; se quiser folga, usar contorno na cor do texto (`--text`) tracejado.
8. **Tracejado com quatro sentidos:** "novo" (teal), "semana sem troca" (cinza, dentro do bloco novo), chip "números de exemplo" (cinza) e botões da barra. A cor separa; na escala de cinza (`nomade-1100-cinza.png`) o rótulo "+ novo" ainda segura a leitura.
9. **Alvo de toque em 390:** "Ver comparação" tem 30 px de altura (é `btn small` de produção; "Ver as trocas em Mudanças" e "Abrir no YouTube" têm 44). Nome do canal na linha tem 44 px em 390 e 16 px em 1440 (a linha inteira é clicável, ok).

## O que confere (sem achado)

- **Marca "+ novo" x cores com significado:** violeta continua só descrição; verde só subindo; âmbar só descendo; azul só outlier. O verde-água é a cor de andaime do mockup (barra, item ativo) e aqui marca o acréscimo.
- **`?novo=0`:** contorno e rótulo somem, sobra um filete tracejado cinza em cima do bloco de descrição; a tela fica como seria em produção **com o acréscimo aprovado** (e com as omissões dos achados 2 e 3). O chip "números de exemplo" permanece, o que é honesto.
- **Andaime no corpo:** nada que pareça produto e não seja. Restam a legenda "Painel do canal X, aberto ao clicar na linha" (só abaixo de 1280, 12,5 px, muted) e o menu lateral rotulado "ilustrativo". Aceitáveis.
- **Regra do color-mix:** nenhuma ocorrência nas regras `c2-*` (linhas 582-668 de `a4.css`; a única menção é o comentário "sem color-mix()").
- **Item 5 (painel empilhado e números inventados):** não engana nem bloqueia, **desde que o dono avalie em 1280 px ou mais** (o painel fica ao lado, como em produção). Abaixo disso a legenda declara. O chip "números de exemplo" fica no título e cobre as colunas inventadas; os nomes são de canais reais com números de exemplo, o que pede o chip, e ele está lá.
- **Console:** sem erro de página. **Rolagem horizontal:** `scrollWidth = innerWidth` em 390, 1100, 1280 e 1440, todos os 7 canais e os dois temas.
- **Teclado:** ordem de foco = barra, depois nomes dos canais em ordem; foco visível 2 px sólido. Esc não se aplica (painel é estático).

## Tabela de medidas

| Item | Escuro | Claro | Mínimo | Resultado |
|---|---|---|---|---|
| Contorno "novo" (`--forja`) vs linha normal | 7,81:1 (`#5CC3B2` / `#221E1A`) | 6,12:1 (`#17695C` / `#FBF7F0`) | 3:1 | passa |
| Contorno vs linha realçada | 6,42:1 | 5,28:1 | 3:1 | passa |
| Texto do rótulo "+ novo" (12 px) | 6,42:1 (`#DCF3EE` / `#2F5D56`) | 9,27:1 (`#0E2A25` / `#A9D2CA`) | 4,5:1 | passa |
| Fundo do rótulo vs superfície | 2,22:1 | 1,54:1 | (rótulo tem texto) | n/a |
| Verde-água vs verde "subindo" (luminância) | 1,07:1 | 1,04:1 | distinguir sem cor | só por forma |
| Matiz verde-água / verde / âmbar | 170° / 142° / 38° | 170° / 140° | | verde-água perto do verde |
| Linha de produção sem acréscimo / com | 73 px / 208-233 px | igual | | achado 4 |
| Largura da coluna Trocas (1440, painel aberto) | ~165 px | | | |
| Linhas visíveis na 1ª dobra de 900 px | 3 | | 6 sem acréscimo | achado 4 |
| `scrollWidth` vs `innerWidth` | 390, 1100, 1280, 1440 iguais | iguais | | passa |
| Abas do painel | 82-87 x 44 px | | 44 | passa |
| Botões do painel em 390 | 30 px ("Ver comparação"); 44 ("Abrir no YouTube", "Ver as trocas") | | 44 | 1 abaixo |
| Nome do canal na linha | 16 px (1440), 44 px (390) | | 44 em toque | passa em toque |
| Itens da barra de estados | 32 px de altura | | andaime | n/a |

## Roteiro de 30 segundos para o dono (depois dos ajustes)

1. Abra `c2-trocas.html` em tela larga (1440). Sem mexer em nada, leia o topo: dá para saber onde você está?
2. Procure os contornos tracejados verde-água com "+ novo": são só eles que não existem hoje (linha "Descrição" na coluna Trocas; resumo e cartões violeta no painel).
3. Clique em "Marca de novo: Desligada" na barra: o que sobra é a lista como ficaria.
4. Troque o estado na barra (ex.: "Mesmo vídeo, várias vezes") e confira se o painel e a linha realçada do mesmo canal aparecem juntos.
5. Pergunta a responder: "esse acréscimo cabe na lista que eu já uso, sem atrapalhar a leitura das outras colunas?" (aqui entra o achado 4: altura das linhas).

## Não verifiquei

- A tela de produção aberta num navegador (sem sessão autenticada): fidelidade conferida só por código (`channel-table.tsx`, `cells.tsx`, `channel-drawer.tsx`, `_chrome/*`) e por mockups aprovados. Larguras exatas, hover e foco das células reais não comparados.
- Leitor de tela; Safari e Firefox (só Chromium via Playwright); dispositivo de toque real.
- Origem do subtítulo "Nicho Viagem. 6 concorrentes e o seu canal..." (não achei no código; pode vir de outra camada).

## Para quem desenhou

Se discordar de algum achado, responda com evidência (medida ou captura) e eu mantenho ou retiro por escrito. Em especial o achado 2 depende de a produção mostrar mesmo o cabeçalho do Observatório; se o desenhista tiver captura da produção sem ele, retiro. Fora isso, depois dos achados 1 a 5 corrigidos eu reviso de novo; os 6 a 9 podem ir como sugestão.
