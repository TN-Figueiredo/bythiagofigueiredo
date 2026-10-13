# Plano da tela 3b: vídeo próprio com faixa "em teste A/B" e faixa "antes do início do registro"

Feito antes do desenho, pela skill frontend-design. Ajuste de tela existente (mockup 3, aprovado em 12/10): nada do que está aprovado muda de lugar ou de forma.

## Quem abre e a pergunta de 3 segundos

O dono (ou a irmã dele, que cuida do marketing) abre um vídeo do canal e quer saber: "esta capa ou este título que troquei funcionou, e o que o sistema sabe sobre o que mudou aqui?". A resposta de relance tem três partes, nesta ordem: **o que esteve no ar** (teste A/B? troca por fora? nada?), **quando** (régua do tempo) e **se já dá para ler** (taxa subiu, caiu, sem diferença, ou ainda não dá para dizer, com o motivo).

Fato que o desenho tem de comportar: nos últimos 30 dias os dois canais somaram 158 impressões. Hoje quase toda troca termina em "ainda não dá para dizer". Isso é a leitura honesta, então esse é o estado que a tela precisa tornar mais claro, não o que ela esconde.

## Direção visual (sem matiz novo)

Mesma linguagem do lote 1: escuro quente, Inter para texto, JetBrains Mono para número e data, Fraunces só no título do vídeo. Cor só por significado e sempre com forma ao lado.

- **Escolha de risco (a única coisa memorável):** o teste A/B é um **colchete aberto sobre o gráfico**, com fundo suave no tom do texto e **marcas de ciclo** como dentes no colchete. Os dentes dizem sem texto por que não há losango nem triângulo ali: o teste troca a cada ciclo e isso é do A/B Lab. O colchete usa o tom neutro `--tr` (o mesmo do marcador de troca), nunca um matiz.
- **Antes do início do registro** é o outro colchete, **pontilhado e sem fundo**, só à esquerda de uma linha pontilhada em 07/10/2026. Pontilhado = "ainda não existe" (convenção do dono); por isso não é hachura rosa (dado que não chegou) nem losango (troca).
- Os dois colchetes ficam em **linhas próprias acima das marcas**, nunca sobre as barras de dado.

## Hierarquia da tela (de cima para baixo)

1. Cabeçalho do vídeo e a linha "Trocas deste vídeo: ..." (do mockup 3): agora a frase conta o teste A/B e as trocas fora dele.
2. Gráfico de views por dia e gráfico de impressões e cliques: ganham os colchetes, as legendas e a leitura por dia ("neste dia o vídeo estava em teste A/B").
3. Bloco **Trocas deste vídeo**: frase-resumo, **régua das versões** (nova: uma linha do tempo de 07/10 até hoje com testes e trocas), lista cronológica. A lista mistura três tipos de linha, cada um com forma própria: troca numerada (losango ou triângulo, com antes × depois), teste A/B (colchete, sem número, sem antes × depois, com link) e, no começo, a **faixa pontilhada das versões reconstruídas**.

## Decisões de cor e símbolo

| Coisa | Forma | Cor | Símbolo |
|---|---|---|---|
| Troca de título / thumbnail | losango / triângulo com a ordem | `--tr` | forma + número |
| Teste A/B | colchete + fundo suave + dentes de ciclo | `--tr` (alfa baixo, rgba literal) | ícone de duas setas trocando (⇄ desenhado) |
| Antes do início do registro | colchete pontilhado, sem fundo, linha pontilhada | `--muted` | traço pontilhado |
| Origem da troca | chip de contorno neutro com ícone | `--muted` | seta para fora (fora do A/B Lab), duas setas (vencedor, restauro), ponto de interrogação (não sabida) |
| Depois ainda não medido | hachura rosa (existente) | `--nm` | "?" |
| Sem antes | contorno pontilhado | `--muted` | círculo pontilhado |
| Janela cortada | caixa de contorno cheio com uma barra grossa no lado cortado | `--dim` | barra de corte |
| Poucas impressões | contorno tracejado (existente) | `--dim` | reticências |
| Zero medido | caixa vazada com o 0 (existente) | `--im-zero` | 0 |

Em escala de cinza as quatro "ausências" se separam por forma de borda (hachura, pontilhado, cheio com barra, tracejado) e por palavra.

## Estados

`tipico` (exemplo, um mês depois do início do registro), `hoje` (o caso real: poucas impressões, registro de 6 dias), `extremo` (3 testes, 6 trocas, título longo, milhares de impressões), `semnumero` (os três estados sem número em um vídeo só), `zero` (zero medido dos dois lados), `so-reconstruido`, `so-teste`, `vazio`, `erro`, `leitura` (sem acesso ao número privado).

## O que fica de fora

Seções após o bloco de trocas (% assistido, retenção, "este vídeo no canal") não mudam e não são redesenhadas. O limiar (100) e a janela (7 dias) são os do mockup 3 e continuam à espera do dono.
