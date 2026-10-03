NOTA R1: 81/100 (dados 20/25, utilidade 16/20, hierarquia 13/15, sistema 8/10, texto 8/10, a11y 7/10, técnica 9/10)

BLOQUEADORES
1. Forja e Fórmulas se contradizem: FORJA.viagem.long.paras[1] fala em 6 de 11 + 4 de 94 (=10 com preço) e a fórmula "Preço no título" diz n = 13 vs 92; exemplo "$2.70" é dólar, não moeda local. Derive os dois de UMA tabela de dados.
2. Temas em Shorts: renderThemes só multiplica contagem por 0,6; mediana e nº de canais idênticos aos longos; "6 canais" em IA/Shorts inclui Esq Unltd Daily parado (máx 5). Cada formato com contagem, canais (≤ canais com upload) e mediana próprios.
3. Leitura IA/Shorts chama 89 Shorts de "pouco para comparar" → corrigir para conclusão real ou critério explícito.

IMPORTANTES
1. Engajamento e tags: EXISTEM (ver CONVENCOES "Cobertura de dados") — mas Lacunas por tag literal geram falso positivo de idioma; agrupe por tema da forja ou avise "tags em outro idioma não casam".
2. Escalas de ponto em "Você no nicho" decorativas (pos fixos sem eixo) → escala calculada com extremos rotulados, ou remover.
3. Evidência não leva aos vídeos → cada .evid li e cada fórmula com "Ver os N vídeos" (Outliers filtrado).
4. Selo de data nos estados fila/trabalhando/falhou/sem máquina → ver CONVENCOES "Selo de leitura da forja".
5. Contraste: danger #ef4444 em surface 4,40 → #F26B6B; .tabs .ct em --faint → --dim; heatmap heat-0/heat-1 < 3:1 → clarear, borda 1px nas vazias, número visível nas células ≥ nível 2 no modo Uploads.
6. A11y: heatmap role=img genérico → tabela oculta ou aria-label com pico; ticks .tk só title; .cad-row role=button sem Enter/Espaço; abas sem aria-controls/setas.
7. Cadência estoura em 768 (.cad-sub nowrap invade lane; .idle quebra) → quebrar sub em 2 linhas ou mover "costuma" para tooltip; texto curto "há 26 d".
8. Nome do botão: estado vazio deve ser "Pedir leitura à forja"; com leitura existente "Pedir nova leitura à forja" (CONVENCOES).

MENORES
1. Fuso em todo horário: "(SP)".
2. "costumam levar 6 a 9 minutos" → fonte ("mediana das últimas 10 leituras"); fila: "deve começar até 15:10".
3. "veja o runbook da forja" → link.
4. Falhou: "o texto dizia 12; o número certo é 7".
5. "um vídeo já basta" contradiz regra de amostra → n < 3 aparece com "pouco para concluir".
6. Fórmulas sem selo "forja · 20/10" → padronizar com Temas.
7. Card do heatmap esticado com ~200px vazios → align-self:start ou legenda.
8. --muted trocado → usar tokens da CONVENCOES.
9. Leitura anterior com opacity .55 → color var(--dim).
10. "Sem leitura" repete o h3 → remover.
Datas: atualizar leituras para as datas da CONVENCOES (20/10, 13/10; hoje 24/10).

EXCELENTE (não mexer): card da forja como herói com estados honestos; notas de autocrítica ("hábito de um canal, não do nicho", hachuras, "associação, não causa"); fórmulas com lift usam vs não usam; cadência com ticks por multiplicador; "Você no nicho" só relativo com justificativa.
