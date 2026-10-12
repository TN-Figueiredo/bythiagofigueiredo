# Ajuste 6: c2-trocas.html depois da REVISAO-UX-5 (12/10)

Plano escrito antes de mexer: `PLANO-UX-6.md`. Arquivos tocados: `c2-trocas.html` (não precisou), `c2-trocas.js`, regras `c2-*`/`.c2-*` acrescentadas ao FIM de `a4.css` (nada existente alterado). Não toquei em `video.*`, `canal.*`, `a4-comum.js`. Nada commitado. Capturas em `ajuste-6-shots/`.

## O que mudou

1. **Faixa fixa "Como se chega"** (achado 1), fora da barra recolhida, logo abaixo dela: "Como se chega: menu YouTube, aba Competidores, aba Canais; clique num canal e o painel abre." + legenda viva da marca ("+ novo = o que esta proposta acrescenta. Nomes e números de exemplo."). Com `?novo=0` a segunda linha diz que a marca está desligada.
2. **Cabeçalho do Observatório reproduzido do código** (achado 2): h2 "Observatório de Competidores" (Fraunces), subtítulo `CHROME_SUBTITLE`, botões (Sincronizar concorrentes, Adicionar canal, Meu canal: tnFigueiredo, ⋯), faixa de frescor, abas Canais (7, atual) / Mudanças / Outliers / Insights e barra "Nicho" Todos / Viagem / IA com bolinhas de cor. Saíram a migalha "Canais", o h1 e o subtítulo inventado. Compacto abaixo de 860 px, como o container da produção (ícones, subtítulo oculto, abas e nichos na mesma linha).
3. **Colunas que faltavam** (achado 3): "Com o meu canal" (Comparar, "–" no canal próprio), coluna de ações (⋯) e seta ▼ na ordenação (Views/dia).
4. **Célula Trocas compacta** (achado 4): linha 1 "Descrição: 3 em 2 vídeos" (Paddy: "5 no mesmo vídeo"), linha 2 as quatro marcas de semana + "4 sem", linha 3 o selo "costuma trocar" só quando existe. Saíram da célula "em 3 das 4 últimas semanas" e o eixo antiga/recente (a frase completa está no `title`/`aria-label` e no painel). Tracejado e "+ novo" mantidos; a marca vai em toda linha em 390 e só na primeira em tela larga.
5. **Linha realçada e painel** (achado 5): painel `sticky` a partir de 1280 px (o corpo rola por dentro), e a linha do canal aberto entra na vista com `scrollIntoView({block:'nearest'})` depois de as fontes carregarem (medido: Leo, linha 6, fica inteira na vista, bottom 899 de 900).
6. **Painel abaixo de 1280 px é diálogo modal de verdade** (`<dialog>`, Esc e clique no fundo fecham, X é link 44 px em toque); a lista abre sem painel nessa faixa. Novo `?painel=1|0` e linha "Painel do canal: Aberto / Fechado (só a lista)" na barra. Com o painel fechado em 1440 a lista usa a largura toda e Crescimento e Sincronização voltam.
7. **390 px**: cartões em grade de 2 colunas (antes uma coluna longa); "+ novo" em todo cartão e em todo bloco do painel; botões do painel, ⋯, Comparar e X com 44 px em toque; "Ver comparação" perdeu o `min-height:30px` inline. Barra de nichos sem contagens abaixo de 520 px para as abas caberem.
8. **Nota da barra** agora lista onde difere da produção (ver "Declarado").

## Medidas

Altura das linhas, 1440, painel aberto (tabela de 754 px):

| Canal | Antes (ajuste 5) | Depois |
|---|---|---|
| Nômade Raiz (com selo) | 233 | 155 |
| Lucas Bigodinho | 73 | 73 |
| Dale Philip | 208 | 132 |
| Vou sem volta | 208 | 132 |
| Paddy Doyle | 208 | 132 |
| Leo Khev | 73 | 85 |
| tnFigueiredo | 83 | 107 |
| Soma | 1.086 | 816 (-25%) |

Leo e tnFigueiredo subiram porque o Canal ficou mais estreito (a coluna Comparar e o ⋯ comem largura) e o nome/chip/inscritos quebram em mais linhas; a coluna Trocas deles não mudou. Painel fechado em 1440: 139 / 66 / 116 / 116 / 132 / 66 / 83. A meta de ~110 px do revisor não foi atingida: linha com acréscimo sem selo fica em 116 a 132 px (a coluna real Trocas já gasta 73 px com número + "visto pela 1ª vez há N d"), com selo 155 px. Fica acima da meta, abaixo da linha de 208-233.

Outras medidas:
- Início da tabela: y=495 em 1440 (era 281), porque o cabeçalho real do Observatório ocupa ~215 px. Na primeira dobra de 900 px aparecem 2 linhas inteiras (antes 3); é o custo de reproduzir a moldura de verdade, e a rolagem de 'nearest' traz a linha do canal aberto.
- `scrollWidth = innerWidth` em 1440 (todos os 7 canais, escuro; claro em Paddy e Lucas), 1280 (Nômade escuro, Leo claro) e 390 (7 canais com painel; lista escura e clara).
- 1440: a tabela cabe sem rolar dentro da caixa (0 px). 1280: rola 142 px dentro da caixa (Comparar e ⋯ ficam fora da vista). Declarado na barra.
- 390: cartões de 343 a 468 px; documento da lista com 3.596 px (antes: painel a ~4.500 px).
- Alvos 390: X e botões do painel com 44 px (medido); ⋯ e Comparar também 44 px pela regra, não medidos.
- Console: sem erros.
- Sem `color-mix()` nas regras novas (só comentários).

## Onde discordo do revisor

- **Sugestão 7 (verde-água x verde "subindo"):** mantido como está. As duas já se separam por forma (contorno tracejado + "+ novo" contra "▲ +1,8%"), os contrastes que ele mediu passam (7,81:1 e 6,12:1), ele próprio não viu confusão real, e em 1440 com painel a coluna Crescimento some. Trocar para tracejado em `--text` quebraria a convenção da pasta (verde-água = andaime e item ativo da barra).
- **Sugestão 8:** sem mudança; a marca de "semana sem troca" é regra compartilhada fora do meu limite.
- **Achado 4, meta de 110 px:** não atingida (ver acima). Se o revisor exigir, o próximo corte é tirar o "4 sem" ou o selo da célula.

## Declarado (na nota da barra)

Nomes, contagens e números de exemplo; botões da forja do cabeçalho ausentes; cabeçalhos, filtros, abas e menus inertes; abaixo de 1280 o painel é diálogo e a lista começa sem painel; em 1280 o painel sticky não foi comparado com a produção; cartão de 390 simplificado (a produção tem o layout Cards próprio); em 1280 a tabela rola ~140 px.

## Não conferi

- Produção aberta (sem sessão); a fidelidade do cabeçalho, das colunas e das larguras vem do código, não de captura.
- Larguras entre 700 e 1279 (modal e tabela rolando) e 860 a 1100: só pelo CSS, sem captura.
- Teclado dentro do diálogo (foco preso e retorno do foco: comportamento nativo de `showModal`, não testado), leitor de tela, Safari/Firefox, toque em aparelho real, hover e foco de ⋯/Comparar.
- Tema claro em Dale, Vou, tnFigueiredo a 1440 e em todos os canais a 1280; só escuro nesses (o claro foi medido em Nômade, Paddy, Lucas, Leo).
- O revisor ainda não reviu esta versão.
