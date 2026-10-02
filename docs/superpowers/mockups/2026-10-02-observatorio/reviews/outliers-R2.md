NOTA R2: 79/100 (dados 18/25, utilidade 17/20, hierarquia 12/15, sistema 9/10, texto 8/10, a11y 8/10, técnica 7/10)

BLOQUEADOR
1. Lista quebra em ≤ 1100px: @media esconde td.views/td.age mas o <colgroup> mantém 6 <col> → cabeçalho do multiplicador espremido (~45px), sobreposição, faixa vazia. Gerar colgroup sem os col ocultos (ou não renderizar as células); col.c-mult ≥ 180px em 768.

IMPORTANTES
1. Fallback do método não aplicado e n impossíveis no "mesmo dia de vida": nSameDay = outros vídeos do canal/formato publicados entre 03/10 e hoje−idade; < 3 → faixa com texto da CONVENCOES; "base fraca" só se a faixa também < 3.
2. n dos vídeos não batem com CH: derivar bn de CH (faixa de base − 1, faixa 91–365 = soma das duas).
3. Contagem de acompanhados > 200 por canal (Luke 340, Dale 338, Matt 260) → longos+Shorts ≤ 200 por canal; recalcular #basisText.
4. Horário de sync inventado → "sincronizado há 3 h" (24/10 12:00 SP) — CONVENCOES Rodada 2.
5. "horário de Brasília" 3× → "Horários em São Paulo" uma vez.
6. Painel "Dependências novas" na barra de estados (task_type, niche, escopo, cota, last_poll_at).
7. Leitura existente vs rótulo: se existe leitura desse escopo, botão "Pedir nova leitura à forja" + selo + "Ver leitura"; no estado normal mostrar a leitura existente (resumo de 1 linha).
8. Card herói com ~246px vazios sob a thumb (pior nos Shorts) → mover .why/.reuse para baixo da thumb ou .meta em largura total.
9. Contraste: dim sobre surface-2 4,46 (th da lista, .subtabs .n) → --muted; selo forja claro 4,31 → #1A6B5F (CONVENCOES).
+ Aplicar o novo "Links entre telas" da CONVENCOES: Outliers deve LER e APLICAR os parâmetros de URL (niche, fmt, age, min, theme, formula, channel) com um chip "Filtro vindo de Insights: tema 'comida de rua' ✕".

MENORES
1. Arredondamento: calcular mult = views/base no código (4,86→4,9×; 11,23→11,2×).
2. Vídeo fora dos acompanhados não entra no denominador → "+1 fora dos acompanhados".
3. "sync"/"snapshot" no aviso → "sincronização"/"último dado em 15/10".
4. Limiar único: "2× ou mais".
5. .ytbar links 31px → min-height 32.
6. Erro de console file:// = artefato aceito (CONVENCOES), nada a fazer.
7. Contorno do .ask ~2:1 → ~3:1.
8. Aviso de pedido na fila: "tempo deste tipo ainda não medido" + cota 1/dia.
9. warning claro sobre hover 4,24 → evitar (fundo de hover mais claro ou cor mais escura).

EXCELENTE (não mexer): seletor de faixas exclusivas com atalho e contagens; #basisText + tooltip com método; vazio honesto que restaura filtros; agrupamento por fase com "assunto de ago 2025: ainda relevante?" e "fora dos acompanhados"; botão da forja contornado com escopo.
