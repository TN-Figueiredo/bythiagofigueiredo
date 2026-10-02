NOTA R2: 80/100 (dados 20/25, utilidade 17/20, hierarquia 12/15, sistema 7/10, texto 8/10, a11y 7/10, técnica 9/10)
R1: B1–B3 ok; I1, I2, I4, I6, I8 ok; I3 parcial (links usam params que Outliers ignora — agora Outliers vai aplicar; use os nomes da CONVENCOES "Links entre telas"); I5 parcial (heat nível 1 < 3:1: 1,82 escuro / 1,45 claro); I7 parcial (nome truncado sem title).

BLOQUEADORES
1. Ação da forja em laranja → .btn.forja-primary teal (CONVENCOES Rodada 2).
2. Estados da fila: atrasado se contradiz ("aos 20 min volta para a fila") → "Na fila desde 14:30 (SP), há 32 min, e a forja ainda não pegou; a máquina respondeu há 4 min."; adicionar "liberado pelo watchdog (travou > 30 min) — volta para a fila"; tempo "ainda não medido (2 leituras…)"; dado velho = aviso + desabilitar no seletor, recusado só para o imprevisível (ex.: "não conseguiu classificar 40% dos títulos"); painel "Dependências novas".
3. Texto publicado recalculado após gerado → congelar na base de 20/10 + "Desde então: +5 vídeos… Peça nova leitura".

IMPORTANTES
1. Parágrafo 2 vende 1,1× vs 1,0× → regra de padrão da CONVENCOES (n ≥ 10, diferença ≥ 0,3×) senão "nenhum formato de título separa os outliers (maior diferença: …)".
2. "dois canais assinam" quando é um só → regra de atribuição da CONVENCOES.
3. "costuma" com 1 vídeo → regra ≥ 3 e ≥ 30%, senão "horário variado (n = 4)".
4. Heatmap modo views: escala não codifica o normal e o rótulo está errado → escala divergente centrada em 1,0× e botão "Multiplicador mediano".
5. Contraste: forja claro → #1A6B5F; heat-3 claro → #A8561F; .reading.old .prose → --muted; .seg .n pressionado → --muted; heat nível 1 ≥ 3:1 vs vizinhos.
6. Alvos: sup a 16×16, .evid a/.vlink 28px → 32px.
7. Esq Unltd Daily em IA/Shorts "não publica Shorts" → testar parado (≥ 90 d) antes: "parado · sem upload há 127 d".
8. Recusado com dois botões → pedido desabilitado; "Sincronizar concorrentes" vira primário do contexto.
9. Rodapé de Fórmulas: método completo (sem contar este vídeo; mesmo dia de vida; fallback; base fraca).
10. "sync" → "sincronização".
11. Nomes truncados em 768 → title= ou 2 linhas.

MENORES
1. Temas: mostrar "3 acima de 3×" na .tsub para conferir com a forja.
2. "2 canais · … · ◌ só 2 canais" duplicado → só o chip.
3. Selos de classificação no formato padrão ("forja · Gemma 12B · gerada 20/10 06:10 (SP)"); no vazio explicar que a classificação de temas roda à parte da leitura.
4. #runbook morto → link para docs/ops/forja-fila-inteligencia-runbook.md.
5. "2ª de 3" sem fonte → remover o máximo ou dizer a fonte.
6. Contagens das abas respeitam o nicho global.
7. Sidebar "Competitors" → "Competidores".
8. --bar-b ≥ 3:1.

EXCELENTE (não mexer): fonte única de dados; card da forja herói com notas numeradas e "Ver os N vídeos"; refazer a conta sem o canal dominante; nota "hábito de um canal" e tabela oculta; "Você no nicho" relativo e Lacunas por tema.
