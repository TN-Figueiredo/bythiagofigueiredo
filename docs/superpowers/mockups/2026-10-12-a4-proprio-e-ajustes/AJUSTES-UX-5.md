# Ajuste 5: troca de descrição reenquadrada como acréscimo (c2-trocas.html)

Pedido do dono (12/10), ao não aprovar: "Essa página eu não entendi nem como a gente chega nela [...] Tá meio estranho quando penso que essa seria a view principal". Brief: `.superpowers/sdd/a5/mockup-ajuste-c2-enquadramento-brief.md`.

## Diagnóstico

O conteúdo estava certo; o enquadramento errou. O mockup se apresentava como página própria (título "Troca de descrição", tabela de 3 colunas, seção "A frase de cada estado" no corpo) e o dono leu o andaime como produto. A ideia é um acréscimo a duas coisas que já existem em produção: a coluna Trocas da Lista de Canais e o painel que abre ao clicar numa linha.

## O que mudou (só `c2-trocas.html`, `c2-trocas.js` e regras `c2-*` acrescentadas ao fim de `a4.css`)

1. **A tela real como contexto.** Migalha e título são os da tela ("Canais"). Barra de ferramentas (busca, Formato, Escala, Tabela/Cards, "7 de 20 canais") e tabela com as colunas de hoje: posição, Canal (nicho e inscritos), Ritmo, Views/dia, Outliers, Trocas, Crescimento, Sincronização. Crescimento e Sincronização somem a partir de 1280 px, como em produção com o painel aberto (`.c-hide` em `canais.css`); abaixo disso aparecem. A linha inteira abre o painel (clique), a linha do canal aberto fica realçada.
2. **O painel também é o de hoje.** Cabeçalho (avatar, nome, nicho, inscritos, fechar), os 5 números (Ritmo, Views/dia, Crescimento, Engajamento, Sincronização), abas **Trocas / Outliers / Vídeos** (o mockup antigo dizia "Leitura", que não existe), título "Trocas nos últimos 30 dias" com a frase de intro real, cartões e rodapé "Abrir no YouTube".
3. **O acréscimo marcado como novo.** Contorno tracejado verde-água (a cor do andaime desta pasta, a mesma do item ativo da barra) mais rótulo "+ novo" (símbolo + texto, não só cor). Marcados: a linha da descrição em cada célula Trocas (rótulo só na primeira, para não repetir), o resumo das duas contas no painel (com a frase do filete violeta) e cada troca de descrição. `?novo=0` (ou o botão "Marca de novo: Desligada" na barra) tira todas as marcas e devolve o visual sem andaime.
4. **Andaime fora do corpo.** Sumiu a seção "A frase de cada estado". Os sete estados viraram a linha "Estado (abre o canal)" da barra "Estados do mockup", recolhida; cada um troca o canal aberto no painel, e a frase do estado atual aparece na nota da barra. A frase "Como se chega: Observatório → Canais; clique num canal para abrir o painel" abre a barra.
5. **Conteúdo e regras intactos:** número principal = título + thumbnail; descrição à parte; selo "costuma trocar" (3 das 4 semanas e 2+ vídeos); "no mesmo vídeo"; quatro marcas de semana; filete violeta; "Antes de 03/10 só registramos que mudou".

## De onde vieram as colunas reais

`apps/web/src/app/cms/(authed)/youtube/competitors/_canais/channel-table.tsx` (constante `COLS`: Ritmo "uploads por semana, 13 sem", Views/dia, Outliers "2× ou mais, até 90 dias", Trocas "título e thumbnail, 30 d, longos e Shorts", Crescimento "inscritos, 30 d", Sincronização), `cells.tsx` (formato de cada célula), `canais.css` linha 307 e 222 (o que some com o painel aberto), `channel-drawer.tsx` (abas, intro, rodapé) e `view-model.ts` (rótulos dos 5 números do painel; intro: "a cada 6 h", "diária às 09:00", desde 03/10).

## Capturas (`ajuste-5-shots/`)

- `c2-1440-escuro.png`, `c2-1440-claro-paddy.png`: 1440, escuro e claro.
- `c2-1440-escuro-barra-aberta-sem-novo.png`: barra aberta e `?novo=0`.
- `c2-390-escuro-topo.png`, `c2-390-escuro-linha.png`, `c2-390-claro-painel.png`: 390 (a tabela vira cartões; sem rolagem horizontal da página; medido `scrollWidth = innerWidth` em 390, 900, 1280 e 1440).
- Console: sem erros de página (o único aviso é de segurança do `file://` do navegador).

## Não conferido ou diferente da produção

- Tela de produção nunca aberta (sem sessão autenticada); a fidelidade vem do código e dos mockups aprovados. Larguras exatas, hover e foco das células não foram comparados lado a lado.
- Abaixo de 1280 px o painel de produção é um diálogo modal; aqui ele empilha abaixo da lista, com a frase "Painel do canal X, aberto ao clicar na linha" (só nesse caso). A rolagem até o painel no celular é longa.
- Em 1280 px a tabela rola um pouco para o lado dentro da própria caixa (31 px), como a produção faz com o painel aberto.
- Barra de ferramentas e cabeçalhos de coluna são estáticos (inertes); ordenação e filtros não funcionam. Ritmo, Views/dia, Outliers, Crescimento, Sincronização e os números do painel (Engajamento, o "+ Shorts" do Ritmo) são **valores de exemplo** inventados; o chip "números de exemplo" está no cabeçalho. Outliers usa só os tons azul e vermelho de produção; os valores de exemplo ficam entre 2× e 5× (azul) para não colidir com o violeta da descrição.
- Revisor de UX não rodou nesta passada.
- Não toquei em `video.*`, `canal.*`, `c1-*`, `comparar-*`, nem em regras existentes de `a4.css` e `a4-comum.js` (o `a4.css` tem alterações de outro agente na árvore; só acrescentei o bloco `c2-*` no fim). Nada commitado.
