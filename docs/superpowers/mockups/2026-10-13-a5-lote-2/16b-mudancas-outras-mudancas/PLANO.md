# Plano do mockup 16b: Mudanças, filtro "outras mudanças" (feito antes do desenho)

## Para quem e a pergunta de 3 segundos
O dono abre a aba Mudanças para ver o que os concorrentes mexeram. A pergunta: **"além das trocas de título e miniatura, o que mais eles mexeram, e posso confiar no número?"**
Resposta de relance: uma frase ("12 trocas de título ou miniatura; mais 5 outras mudanças fora desta conta"), duas barras separadas por uma linha tracejada (a conta da aba acaba na primeira) e, dentro da visão nova, **uma régua de dias** que mostra desde quando o Observatório guarda esses campos.

## A forma memorável (uma só): a régua de cobertura
Os campos (tags, categoria, duração, capítulos, formato) só têm histórico a partir do deploy da E1. Um "5" sem a janela mentiria: parece "5 em 30 dias" e é "5 em 15 dias medidos". A régua desenha a janela inteira: dias sem histórico em **hachura rosa (não medido)**, dias com histórico em coluna (zero medido = traço baixo, mudança = coluna com a altura da contagem). O que não existe nunca vira zero.

## Hierarquia (de cima para baixo)
1. Cabeçalho do Observatório de hoje (aba Mudanças; a contagem da aba **não muda**: 12 continua 12).
2. Frase-resumo + as duas contas em barras (Trocas, linha tracejada "fora da conta da aba", Outras mudanças) + o seletor de visão "Trocas | Outras mudanças". Acréscimo, contorno tracejado.
3. Visão "Trocas": o que existe hoje, sem mexer (só um marcador de lugar).
4. Visão "Outras mudanças": barra de filtros (Janela, Formato, Ordenar) → frase do bloco + ⓘ → régua de cobertura → filtro de tipo que também é a contagem por tipo (símbolo + número; zero = caixa vazada) → cartões por vídeo com uma linha por mudança → "Mostrar mais N".

## Cor e símbolo (nenhum matiz novo)
- Mudança de campo **não é direção**: nunca verde/âmbar. Cor neutra do marcador de troca (`--tr`) e texto; o tipo se lê pelo **símbolo e pela palavra** (etiqueta, quatro quadrados, relógio, lista com marcas, retângulo largo e estreito).
- Antes/depois dentro da linha: acrescentado = prefixo "+" e contorno cheio; retirado = prefixo "−", riscado e contorno tracejado. Duração: sinal "+"/"−" em número neutro.
- Não medido = hachura rosa (única forma em toda a tela); zero medido = caixa vazada com 0 (`--im-zero`); ainda não existe (nicho sem canal) = contorno pontilhado; erro = família do erro (borda e ícone, texto em `--text`).
- A proposta leva o contorno tracejado verde-água e "+ novo" (convenção do lote).

## Estados
típico (3 semanas de histórico) · magro (poucos dias de histórico, o caso real por semanas) · extremo (90 dias, 213 mudanças, paginação) · zero medido · não medido (histórico começa em dd/mm) · filtro sem resultado (formato 0) · erro (só a lista nova falha) · carregando · sem dado (nicho sem canal) · só leitura · e a visão "Trocas" (default, como hoje).
1440 escuro e 390 claro de todos.

## Revisão do plano contra o óbvio (o que mudei)
- Primeira ideia: um quarto botão no filtro "Tipo" com "Outras". Descartei: o "Todos" do Tipo viraria 17 e a contagem da aba inflaria, o que o pedido proíbe. Virou uma **visão separada** com sua própria contagem.
- Segunda: um número "5" ao lado do "12". Descartei: janelas diferentes (30 dias contra 15 medidos) tornariam a comparação falsa; entrou a régua.
- Evitado: cartão-de-SaaS idêntico repetido, etiquetas em caixa alta, rótulos "ITEM — texto", cor de direção em campo que não tem direção.
