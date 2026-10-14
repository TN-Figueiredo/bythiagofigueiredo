# Revisão Naksu (UI), desenho 2 (rodada 2): Remover canal e 18-v2

Método: Playwright/Chromium sobre `file://`; Remover canal em D3, D4a/b/c, nome curto e de 100 caracteres, claro e escuro, 390x844, 390x667 e 1440x900; 18-v2 em V1a, V1b, V2, V4, V6, V9, V10, claro e escuro, 390 e 1440. Capturas em `revisao-naksu-shots/r2/`. Não verificado: Opera real, leitor de tela, aparelho real, rede lenta.

## Remover canal: ACORDO
- RC-1 fechado. D4a/b/c a 390x844: campo em y 610-654 (44 px), corpo termina em 708, status 654-675, também visível; com nome de 100 caracteres, 610-654. Em 390x667: campo 433-477, corpo até 531. A 1440x900: campo 726-766, rodapé em 818. Foco inicial continua em "Cancelar"; `scrollIntoView` roda sem tirar o foco.
- RC-2 fechado: "Não dá para desfazer" fica antes de "O que acontece:". D3 a 390: y 475-491 (antes 731), acima da dobra de 708, também com nome de 100 caracteres (540-556).
- RC-3 fechado: `.rc-clamp` só com D4 (h2 de 100 caracteres = 64,8 px, 3 linhas); D3 mantém o nome inteiro (86 px, 4 linhas), correto porque não há outro lugar com o nome.
- Rolagem horizontal 0 em todas as combinações. Defeito novo: nenhum. Observação (sugestão, sem bloquear): em 390x667 a rolagem automática esconde o título e a lista de perdas acima do campo; o texto do próprio D4 ("Eles se perdem de vez") fica visível e dá para rolar para cima.

## 18-v2: ACORDO COM CONDIÇÃO (1 sugestão a aplicar, não bloqueia o dono)
- V2-1 fechado: `.v2-pt` a 390 = 230x32 px, 2 linhas (V2 59-289, V4 95-325, V6 38-268), dentro da tela, sem cobrir a legenda (conferido a olho em V2 escuro e V4 claro).
- V2-2 fechado: "novembro pronto em 01/05" a 390 em left 28, direita 215 (V2 e V4); V6 47-241. Nada abaixo de 16 px de gutter.
- V2-3 fechado: "Abrir o Arquivo" claro usa #A23E14 (`--accent-hover`) sobre o âmbar/vermelho: 5,19 a 5,36:1 (âmbar) e 5,21 a 5,38:1 (vermelho) sobre `--surface` #FBF7F0 e vizinhos; antes 4,34:1. Escuro: #FF9A60, acima de 4,5:1 nos dois fundos.
- V2-4 fechado: V9 mostra Exportações como "não medido" (pastilha hachurada) com a frase "a leitura de hoje não chegou: não dá para dizer se alguma espera confirmação"; o "0" ficou só no caso de leitura bem-sucedida sem lote (`bl-zero`, zero medido).
- Rolagem horizontal 0 em 390 e 1440, em todos os casos.
- Defeito novo, sugestão (V-N1): a 390 px, na régua do tempo (V2, V4, V6), o traço vertical de "o próximo mês fica pronto" cruza a palavra "90 dias" do eixo e a corta ("9|dias"), nos dois temas (ver `crop-v2-v4-claro-390.png`). Correção: dar ao rótulo "90 dias" `background:var(--surface);padding:0 3px` com `z-index` acima do traço, ou descer o eixo `.v2-ax` 18 px quando `.v2-l2` estiver a menos de 40 px do marco de 90 dias. Não bloqueia.
