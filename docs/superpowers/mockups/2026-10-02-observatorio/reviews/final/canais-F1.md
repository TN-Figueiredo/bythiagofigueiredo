NOTA F1: 83/100 — 15 linhas × formatos × escalas e 15 gavetas batem com OBS; setNiche ok.
TELA
B1. Pedido à forja na gaveta: (a) rótulo "Pedir nova leitura à forja"; (b) em andamento "Pedido em andamento" + "Seu pedido das HH:MM…"; (c) publicado → "Ver a leitura em Mudanças" via OBS.link.mudancas({niche}); (d) Dependências novas: task_type resumo-trocas, escopo niche, cota 1/dia/tipo/nicho.
B2. Prévia conta trocas de canais fora (motor corrige preview; tela usa pv.text).
B3. Ler ?niche= (aplica e persiste antes do localStorage) e ?channel= (abre a gaveta após render).
I1. effect com n = 0 "mesmo dia de vida" → motor corrige fallback; tela: se n === 0, "sem vídeos do canal para comparar".
I2. Crescimento com precisão falsa → arredondar à roundingUnit e mostrar incerteza ("+20 mil (±10 mil)"); motor: snapshots.subs arredondados.
I3. "Adicionar canal" sem fluxo → desenhar painel: @handle/URL, nicho, limite (até 200), "14 de 15", "entra na próxima sincronização (18:00)".
I4. .btn.danger escuro 3,76 → #B42318 com #fff.
I5. "Adicionar canal" quebra linha → no cabeçalho da aba à direita; sortNote/probChip em linha própria.
I6. "Método: método:" duplicado.
M1 data de Paddy num formato só (39 h + title). M2 "até 23/10 00:00" também no atrasado. M3 "Erro desde 22/10 00h". M4 tirar "simulação:" da UI; 93 vs 94 dias (usar o do motor). M5 pedido recém-enviado "na fila desde 15:02" (requestScenario createdAt). M6 cota usada no painel. M7 title= nos títulos com line-clamp. M8 semana vazia ≥ 3:1 ou legenda. M9 mult com 1 casa (motor fmt.mult). M10 aba Insights via OBS.link.insights({niche}). M11 "Sincronizar só este canal" muda a linha.
MOTOR
B2 preview channelsIn; I1 effect fallback quando n < 3 no mesmo dia de vida (nunca n = 0 com método "mesmo dia"); I2 snapshots.subs arredondados (3 algarismos) e growth calculado sobre arredondados com incerteza; M9 fmt.mult sempre 1 casa ("4,0×").
